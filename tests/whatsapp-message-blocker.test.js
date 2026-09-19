import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareWhatsAppMessageBlocker, createWhatsAppMessageBlocker } from '../src/lib/whatsapp/message-blocker.js';
import { normalizeMessageBlocker, confirmedMessageBlocker } from '../src/lib/whatsapp/message-blocker-policy.js';
import { updateProjectBlocker, getProjectBlocker } from '../src/lib/project-execution.js';
const scope={organizationId:'org-a',projectId:'project-a'};
const context={scope,actorId:'manager-a',conversationId:'chat-a',messageId:'message-a'};
function database(){
  const state={message:{id:'message-a',conversationId:'chat-a',externalId:'wamid.synthetic',direction:'INBOUND',kind:'TEXT',body:'Faltan diez bolsas de cemento para la mampostería.',sentAt:new Date('2026-09-19T12:00:00Z'),metadata:{provider:'meta',authorized:true,workerId:'worker-a'},conversation:{externalId:'meta:synthetic',projectId:'project-a',channel:'whatsapp'}},
    organization:{id:'org-a',timezone:'America/Argentina/Buenos_Aires',subscriptionPlan:'ENTERPRISE',subscriptionStatus:'ACTIVE'},task:true,owner:true,projectStatus:'ACTIVE',blockers:[],audits:[],failAudit:false,failSourceAudit:false};
  const matches=(row,where)=>Object.entries(where).every(([key,value])=>key==='project'?value.organizationId==='org-a':row[key]===value);
  const tx={
    $executeRawUnsafe:async()=>1,
    project:{findFirst:async({where})=>where.id==='project-a'&&where.organizationId==='org-a'?{id:'project-a',status:state.projectStatus}:null},
    organization:{findUnique:async({where})=>where.id==='org-a'?structuredClone(state.organization):null},
    message:{findFirst:async({where})=>where.id==='message-a'&&where.conversationId==='chat-a'&&where.conversation.projectId==='project-a'&&where.conversation.project.organizationId==='org-a'?structuredClone(state.message):null},
    worker:{findFirst:async({where})=>where.projectId==='project-a'&&['worker-a','manager-a'].includes(where.id)&&(!where.active||state.owner)?{id:where.id}:null,
      findMany:async({where,take})=>{assert.equal(where.projectId,'project-a');assert.equal(take,101);return state.owner?[{id:'manager-a',name:'Responsable de ensayo'}]:[];}},
    workTeam:{findFirst:async({where})=>where.projectId==='project-a'&&where.id==='team-a'&&state.owner?{id:'team-a'}:null,findMany:async()=>[{id:'team-a',name:'Cuadrilla de ensayo'}]},
    task:{findFirst:async({where})=>state.task&&where.id==='task-a'&&where.projectId==='project-a'&&where.metadata.equals==='canonical-task-v1'?{id:'task-a'}:null},
    projectMembership:{findMany:async()=>[]},
    projectBlocker:{findFirst:async({where})=>structuredClone(state.blockers.find(row=>matches(row,where))||null),
      create:async({data})=>{assert.ok(!state.blockers.some(row=>row.id===data.id));const row={...data,revision:0,createdAt:new Date(),updatedAt:new Date()};state.blockers.push(row);return structuredClone(row);},
      updateMany:async({where,data})=>{const row=state.blockers.find(row=>matches(row,where));if(!row)return{count:0};Object.assign(row,{...data,revision:row.revision+1});return{count:1};}},
    auditLog:{findFirst:async({where})=>structuredClone(state.audits.find(row=>matches(row,where))||null),create:async({data})=>{if(state.failAudit||state.failSourceAudit&&data.action==='execution.blocker.created_from_whatsapp')throw new Error('audit-failure');state.audits.push(structuredClone(data));return data;}},
  };
  return{state,prisma:{...tx,$transaction:async operation=>{const before=structuredClone(state);try{return await operation(tx);}catch(error){Object.assign(state,before);throw error;}}}};
}
async function command(prisma,extra={}){const view=await prepareWhatsAppMessageBlocker(prisma,context);return{...context,operationKey:'operation-0000000001',input:{sourceVersion:view.source.version,taskId:'task-a',title:'Faltante de cemento',description:'Verificar disponibilidad de diez bolsas para la actividad.',ownerWorkerId:'manager-a',ownerTeamId:null,severity:'MEDIUM',...extra}};}
test('preparation is read-only and shows the bounded owner catalog',async()=>{
  const {prisma,state}=database();const original=structuredClone(state.message);const view=await prepareWhatsAppMessageBlocker(prisma,context);
  assert.equal(view.source.messageId,'message-a');assert.equal(view.source.organizationId,'org-a');assert.equal(view.existing,null);assert.equal(view.owners.workers[0].id,'manager-a');assert.equal(state.blockers.length,0);assert.equal(state.audits.length,0);assert.deepEqual(state.message,original);
});
test('reviewed message creates an assigned OPEN restriction with two atomic audit records',async()=>{
  const {prisma,state}=database();const before=structuredClone(state.message);const result=await createWhatsAppMessageBlocker(prisma,await command(prisma));
  assert.match(result.blocker.id,/^wa_blocker_[a-f0-9]{64}$/);assert.equal(result.blocker.status,'OPEN');assert.equal(result.blocker.ownerWorkerId,'manager-a');assert.equal(result.blocker.taskId,'task-a');assert.equal(state.audits.length,2);
  assert.equal(state.audits[1].metadata.messageId,'message-a');assert.ok(!JSON.stringify(state.audits).includes(state.message.body));assert.deepEqual(state.message,before);
});
test('another authorized operator and identical retries reuse the same restriction',async()=>{
  const {prisma,state}=database();const request=await command(prisma);const first=await createWhatsAppMessageBlocker(prisma,request);
  const second=await createWhatsAppMessageBlocker(prisma,{...request,actorId:'manager-b',operationKey:'different-key-00001'});
  assert.equal(second.blocker.id,first.blocker.id);assert.equal(second.replayed,true);assert.equal(state.blockers.length,1);assert.equal(state.audits.length,2);
});
test('same source cannot create a second restriction by changing content',async()=>{
  const {prisma,state}=database();const request=await command(prisma);await createWhatsAppMessageBlocker(prisma,request);
  await assert.rejects(createWhatsAppMessageBlocker(prisma,{...request,input:{...request.input,title:'Otra'}}),{code:'WHATSAPP_BLOCKER_ALREADY_USED'});assert.equal(state.blockers.length,1);
});
test('shared execution domain resolves the same record with actual explanation and revision',async()=>{
  const {prisma,state}=database();const request=await command(prisma);const {blocker}=await createWhatsAppMessageBlocker(prisma,request);
  const closed=await updateProjectBlocker(prisma,{scope,actorId:'manager-a',blockerId:blocker.id,expectedRevision:0,input:{status:'RESOLVED',resolution:'Material disponible y verificado en el acopio de la obra.'}});
  assert.equal(closed.status,'RESOLVED');assert.equal(closed.revision,1);assert.match(closed.resolution,/acopio/);assert.equal(state.audits.length,3);
  const replay=await createWhatsAppMessageBlocker(prisma,request);assert.equal(replay.blocker.status,'RESOLVED');assert.equal(replay.blocker.revision,1);assert.equal(state.audits.length,3);
  assert.equal((await getProjectBlocker(prisma,{scope,blockerId:blocker.id})).status,'RESOLVED');
  await assert.rejects(updateProjectBlocker(prisma,{scope,actorId:'manager-a',blockerId:blocker.id,expectedRevision:0,input:{status:'RESOLVED',resolution:'Duplicado'}}),{code:'PROJECT_BLOCKER_STALE'});
});
for(const override of [{scope:{...scope,organizationId:'org-b'}},{scope:{...scope,projectId:'project-b'}},{conversationId:'other'},{messageId:'other'}])test('another context cannot read the source: '+JSON.stringify(override),async()=>{
  await assert.rejects(prepareWhatsAppMessageBlocker(database().prisma,{...context,...override}),{code:'WHATSAPP_REPORT_NOT_FOUND'});
});
for(const [key,value] of [['authorized',false],['quarantined',true],['simulated',true],['sourceContentRestricted',true]])test('ineligible message rejected: '+key,async()=>{
  const {prisma,state}=database();state.message.metadata[key]=value;await assert.rejects(prepareWhatsAppMessageBlocker(prisma,context),{code:'WHATSAPP_REPORT_SOURCE_UNAVAILABLE'});assert.equal(state.blockers.length,0);
});
test('incomplete audio, medical text and outgoing messages never become restrictions',async()=>{
  for(const change of [row=>{row.kind='AUDIO';row.metadata.transcription={status:'failed',text:'No usar'};},row=>{row.body='Tengo un diagnóstico de hepatitis';},row=>{row.direction='OUTBOUND';}]){
    const {prisma,state}=database();change(state.message);await assert.rejects(prepareWhatsAppMessageBlocker(prisma,context));
  }
});
test('completed audio is a source with recorded provenance, not another transcription request',async()=>{
  const {prisma,state}=database();state.message.kind='AUDIO';state.message.metadata.transcription={status:'completed',text:'Falta arena para continuar.'};
  const request=await command(prisma);await createWhatsAppMessageBlocker(prisma,request);assert.equal(state.audits[1].metadata.sourceKind,'AUDIO_TRANSCRIPT');
});
test('changing original text invalidates an open review',async()=>{
  const {prisma,state}=database();const request=await command(prisma);state.message.body+=' Corrección.';
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),{code:'WHATSAPP_BLOCKER_SOURCE_CHANGED'});assert.equal(state.blockers.length,0);
});
test('invalid task or inactive responsible party cannot be assigned',async()=>{
  const {prisma,state}=database();const request=await command(prisma);state.task=false;
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),{code:'WHATSAPP_BLOCKER_TASK_SCOPE'});state.task=true;state.owner=false;
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),{code:'PROJECT_EXECUTION_OWNER_SCOPE'});assert.equal(state.blockers.length,0);
});
test('failure in provenance audit rolls back the blocker and normal domain audit',async()=>{
  const {prisma,state}=database();const request=await command(prisma);state.failSourceAudit=true;
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),/audit-failure/);assert.equal(state.blockers.length,0);assert.equal(state.audits.length,0);
});
test('deleted restriction is never recreated and missing provenance is not trusted',async()=>{
  const {prisma,state}=database();const request=await command(prisma);await createWhatsAppMessageBlocker(prisma,request);state.blockers=[];
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),{code:'WHATSAPP_BLOCKER_GONE'});
  const other=database();const command2=await command(other.prisma);await createWhatsAppMessageBlocker(other.prisma,command2);other.state.audits=[];
  await assert.rejects(prepareWhatsAppMessageBlocker(other.prisma,context),{code:'WHATSAPP_BLOCKER_INTEGRITY'});
});
test('archived project or suspended company blocks creation',async()=>{
  const {prisma,state}=database();const request=await command(prisma);state.projectStatus='ARCHIVED';
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),{code:'PROJECT_READ_ONLY'});state.projectStatus='ACTIVE';state.organization.subscriptionStatus='SUSPENDED';
  await assert.rejects(createWhatsAppMessageBlocker(prisma,request),{code:'WHATSAPP_BLOCKER_READ_ONLY'});
});
test('team ownership and high priority use existing execution rules',async()=>{
  const {prisma,state}=database();const result=await createWhatsAppMessageBlocker(prisma,await command(prisma,{ownerWorkerId:null,ownerTeamId:'team-a',severity:'HIGH'}));
  assert.equal(result.blocker.ownerTeamId,'team-a');assert.equal(result.blocker.severity,'HIGH');assert.equal(state.blockers.length,1);
});
const valid={sourceVersion:'a'.repeat(64),taskId:'task-a',title:'Faltante',description:'Revisar el acopio.',ownerWorkerId:'worker-a',ownerTeamId:null,severity:'MEDIUM'};
for(const bad of [{actorId:'other'},{status:'RESOLVED'},{projectId:'other'},{ownerWorkerId:null},{ownerTeamId:'team-a'},{severity:'whatever'},{sourceVersion:'old'},{description:'El certificado médico indica reposo.'},{description:'Abrir /webview/attendance?token=synthetic-only'}])test('invalid or privileged field denied: '+Object.keys(bad)[0],()=>assert.throws(()=>normalizeMessageBlocker({...valid,...bad})));
test('normalization preserves reviewed content while sharing domain text format',()=>{
  const result=normalizeMessageBlocker({...valid,description:'  Revisar\n  acopio.  '});assert.equal(result.description,'Revisar acopio.');
});
test('client acknowledgement must identify source, context and record',()=>{
  const expected={...scope,conversationId:'chat-a',messageId:'message-a'};
  const payload={source:expected,replayed:false,blocker:{id:'wa_blocker_'+'a'.repeat(64),projectId:'project-a',status:'OPEN',revision:0}};
  assert.equal(confirmedMessageBlocker(payload,expected),payload.blocker);
  for(const bad of [{},{...payload,source:{...expected,messageId:'other'}},{...payload,blocker:{...payload.blocker,projectId:'other'}},{...payload,replayed:null}])assert.throws(()=>confirmedMessageBlocker(bad,expected));
});
test('preparation distinguishes read-only projects from a writable worksite',async()=>{
  const {prisma,state}=database();assert.equal((await prepareWhatsAppMessageBlocker(prisma,context)).canCreate,true);
  state.projectStatus='ARCHIVED';assert.equal((await prepareWhatsAppMessageBlocker(prisma,context)).canCreate,false);
  state.projectStatus='ACTIVE';state.organization.subscriptionStatus='SUSPENDED';assert.equal((await prepareWhatsAppMessageBlocker(prisma,context)).canCreate,false);
  assert.equal(state.blockers.length,0);assert.equal(state.audits.length,0);
});
test('exact restriction lookup does not fall back to another company or project',async()=>{
  const {prisma}=database();const created=await createWhatsAppMessageBlocker(prisma,await command(prisma));
  for(const foreign of [{...scope,organizationId:'org-b'},{...scope,projectId:'project-b'}])await assert.rejects(getProjectBlocker(prisma,{scope:foreign,blockerId:created.blocker.id}),{code:'PROJECT_BLOCKER_NOT_FOUND'});
});
