import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readInventory,readOwnConsumptions,inventoryCatalogHash,applyInventoryFieldAction} from '../src/lib/material-inventory.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {planMetaFieldConversation,metaFieldConsumptionAcknowledgement} from '../src/lib/meta-field-conversation.mjs';
import {createMetaFieldBridge,readMetaFieldConversation} from '../src/lib/meta-field-bridge.mjs';
import {customerReplyMessage} from '../src/lib/meta-customer-provider.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {fieldReceiptId} from '../src/lib/field-operations-policy.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';

// Synthetic records and strict SQL doubles. Native transactions and canonical
// authority are verified separately by the disposable PostgreSQL harness.
const scope='a'.repeat(64),member={organizationId:'company-a',actorId:'actor-a',membershipId:'member-a',clerkUserId:'user_Synthetic',role:'ADMIN'};
const material={id:'material-a',name:'Cemento',unit:'bolsa',balance:'25.000',active:true};
const project={id:'project-a',name:'Obra sintética',metadata:{materialInventory:{version:1,catalogVersion:1,materials:[material]},fieldOperations:{version:1,sectors:[{id:'sector-a',name:'Sector A'}]}}};
const now=new Date('2026-10-12T12:00:00.000Z');
const event=(decision)=>({actorId:'reviewer-a',reason:'Control independiente del material informado.',recordedAt:'2026-10-12T13:00:00.000Z',receiptId:'field_'+digest(decision),...(decision==='REVERSE'?{}:{decision}),movementId:'movement-'+decision});
function consumption(index,changes={}){const state=['PENDING','APPROVED','REJECTED','REVERSED'][index%4];return {id:'consumption-'+index,projectId:project.id,organizationId:member.organizationId,createdAt:2000-index,title:'Consumo de Cemento',revision:'2026-10-12T12:00:00.123456',metadata:{materialInventory:{version:1,kind:'CONSUMPTION',state,workerId:'worker-a',submittedBy:member.actorId,materialId:material.id,materialName:material.name,quantity:'2.500',unit:material.unit,taskId:null,sectorId:'sector-a',reason:'Para la mezcla del sector de la obra.',submittedAt:now.toISOString(),proposalReceiptId:'field_'+digest(['proposal',index]),decision:state==='PENDING'?null:event(state==='REJECTED'?'REJECT':'APPROVE'),reversal:state==='REVERSED'?event('REVERSE'):null,...changes}}};}
const rows=values=>({rows:values,rowCount:values.length});
function database(records){const queries=[];return {queries,async query(sql,args=[]){queries.push({sql,args});
 if(sql.includes('FROM public."Incident" i JOIN public."Project" p')){
  if(sql.includes("->>'workerId'=$3")){
   for(const predicate of ['p."organizationId"=$2',"->>'workerId'=$3","->>'submittedBy'=$4"])assert.ok(sql.includes(predicate),predicate);
   const visible=records.filter(r=>r.projectId===args[0]&&r.organizationId===args[1]&&r.metadata.materialInventory.workerId===args[2]&&r.metadata.materialInventory.submittedBy===args[3]);
   if(sql.startsWith('SELECT i.id FROM'))return rows(visible.filter(r=>r.id===args[4]).map(r=>({id:r.id})));
   assert.match(sql,/LIMIT 6$/);const anchor=visible.find(r=>r.id===args[4]);return rows(visible.filter(r=>(!args[4]||r.createdAt<anchor?.createdAt)&&(args[5]===null||r.id===args[5])).sort((a,b)=>b.createdAt-a.createdAt).slice(0,6));
  }
  assert.ok(sql.includes("->>'submittedBy'=$6"));return rows(records.filter(r=>r.id===args[0]&&r.organizationId===args[1]&&r.projectId===args[2]&&(args[3]||args[4].includes(r.metadata.materialInventory.workerId)&&r.metadata.materialInventory.submittedBy===args[5])).map(r=>({id:r.id})));
 }
 if(sql.includes('FROM public."Incident" WHERE')&&sql.includes("kind'='CONSUMPTION'")){
  assert.ok(sql.includes("->>'submittedBy'=$6"));const visible=records.filter(r=>r.projectId===args[0]&&(args[1]||args[2].includes(r.metadata.materialInventory.workerId)&&r.metadata.materialInventory.submittedBy===args[5]));const anchor=visible.find(r=>r.id===args[3]);return rows(visible.filter(r=>(!args[3]||r.createdAt<anchor?.createdAt)&&(!args[4]||r.id===args[4])).slice(0,101));
 }
 if(sql.includes('FROM public."AuditLog"')||sql.includes('FROM public."Incident"'))return rows([]);
 throw Error('Unexpected synthetic inventory query: '+sql);
 }};}

test('own directed query reaches old reports beyond 100 and paginates every state without exposing other workers or old actors',async()=>{
 const records=[...Array.from({length:130},(_,i)=>consumption(i)),consumption(500,{workerId:'worker-other'}),consumption(501,{submittedBy:'actor-old'}),{...consumption(502),organizationId:'company-other'}],db=database(records);
 let afterConsumption=null;const ids=[],states=new Set();do{const page=await readOwnConsumptions(db,member,project,{workerId:'worker-a',afterConsumption});assert.ok(page.records.length<=5);for(const c of page.records){ids.push(c.id);states.add(c.state);assert.equal(c.submittedBy,member.actorId);assert.equal(c.workerId,'worker-a');for(const forbidden of ['canManage','canDecide','canReverse','materials','balance','metadata','actorName'])assert.equal(c[forbidden],undefined);}afterConsumption=page.nextCursor;}while(afterConsumption);
 assert.equal(new Set(ids).size,130);assert.equal(ids.length,130);assert.deepEqual([...states].sort(),['APPROVED','PENDING','REJECTED','REVERSED']);
 const directed=await readOwnConsumptions(db,member,project,{workerId:'worker-a',consumptionId:'consumption-129'});assert.equal(directed.records[0].id,'consumption-129');assert.equal(directed.records[0].decision.receiptId,event('APPROVE').receiptId);
});
test('own cursor and direct ID deny other company, worker and same reassigned worker history even for ADMIN/DIRECTOR',async()=>{
 const records=[consumption(1),consumption(2,{workerId:'worker-other'}),consumption(3,{submittedBy:'actor-old'}),{...consumption(4),organizationId:'company-other'}];
 for(const role of ['ADMIN','DIRECTOR','AUDITOR'])for(const key of ['afterConsumption','consumptionId'])for(const id of ['consumption-2','consumption-3','consumption-4','absent']){const db=database(records);await assert.rejects(readOwnConsumptions(db,{...member,role},project,{workerId:'worker-a',[key]:id}),{code:'INVENTORY_CURSOR_UNAVAILABLE'});assert.equal(db.queries.length,1,'Rejected before page query');}
 await assert.rejects(readOwnConsumptions(database(records),member,project,{workerId:'worker-a',afterConsumption:'consumption-1',consumptionId:'consumption-1'}),{code:'INVENTORY_QUERY_INVALID'});
});
test('all general non-reviewer inventory list/cursor/direct IDs also retain the original informing actor boundary',async()=>{
 const records=[consumption(1),consumption(2,{submittedBy:'actor-old'}),consumption(3,{workerId:'worker-other'})];
 const listed=await readInventory(database(records),member,project,{workerIds:['worker-a'],reviewer:false});assert.deepEqual(listed.consumptions.map(c=>c.id),['consumption-1']);
 for(const key of ['afterConsumption','consumptionId'])await assert.rejects(readInventory(database(records),member,project,{workerIds:['worker-a'],reviewer:false,[key]:'consumption-2'}),{code:'INVENTORY_CURSOR_UNAVAILABLE'});
 const reviewed=await readInventory(database(records),member,project,{workerIds:[],reviewer:true,consumptionId:'consumption-2'});assert.equal(reviewed.consumptions[0].submittedBy,'actor-old');
});
test('directed history remains available if the catalog was removed and malformed current facts fail closed',async()=>{
 const c=consumption(1),withoutCatalog={...project,metadata:{}},page=await readOwnConsumptions(database([c]),member,withoutCatalog,{workerId:'worker-a',consumptionId:c.id});assert.equal(page.records[0].materialName,'Cemento');
 for(const update of [{quantity:'2.5'},{state:'APPROVED',decision:null},{state:'PENDING',decision:event('APPROVE')},{submittedAt:'yesterday'},{state:'REVERSED',reversal:null}])await assert.rejects(readOwnConsumptions(database([consumption(1,update)]),member,project,{workerId:'worker-a'}));
});
test('own service locks current authority and denies revoked report/KYC before any consumption query',async()=>{
 const db=database([consumption(0)]),session={userId:member.clerkUserId};let allowed=true,kyc=true,authority=0;
 const service=createFieldOperations({workspace:{projectOperation:async(s,context,writable,callback)=>{assert.equal(s,session);assert.equal(context.projectId,project.id);assert.equal(writable,true);return callback(db,member,scope,project);}},assertParticipant:async(_c,m,s,p,w,options)=>{authority++;assert.equal(m.actorId,member.actorId);assert.equal(s,session);assert.equal(p,project.id);assert.equal(w,'worker-a');assert.deepEqual(options,{permission:'report',requireKyc:true});if(!allowed||!kyc)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);return {id:w};}});
 const result=await service.ownConsumptions(session,{projectId:project.id,scope,workerId:'worker-a'});assert.equal(result.records.length,1);assert.equal(result.scope,scope);const queryCount=db.queries.length;
 allowed=false;await assert.rejects(service.ownConsumptions(session,{projectId:project.id,scope,workerId:'worker-a'}),{code:'FIELD_PARTICIPANT_REQUIRED'});allowed=true;kyc=false;await assert.rejects(service.ownConsumptions(session,{projectId:project.id,scope,workerId:'worker-a'}),{code:'FIELD_PARTICIPANT_REQUIRED'});assert.equal(authority,3);assert.equal(db.queries.length,queryCount);
});

const baseFacts={projectName:project.name,workerId:'worker-a',permissions:{attendance:true,report:true},tasks:[],sectors:[],evidence:[],proposals:[],latest:null,inventory:{materials:[]}};
let seq=0;
function plan(message,state=null,page={records:[],afterConsumption:null,consumptionId:null,nextCursor:null},extra={}){const value=planMetaFieldConversation({message,state,facts:{...baseFacts,ownConsumptions:page,...extra},eventId:'consume-event-'+(++seq),now});if(value.state&&!value.preserveConversation)value.state={...value.state,version:1,expiresAt:'2026-10-12T12:15:00.000Z'};customerReplyMessage(value.reply);return value;}
const say=(body,state,page,extra)=>plan({type:'text',text:{body}},state,page,extra);
function pick(value,choice,page,extra){const index=value.state.choices.findIndex(c=>c.value===choice);assert.ok(index>=0,choice);return plan({type:'interactive',interactive:{type:'list_reply',list_reply:{id:value.reply.sections[0].rows[index].id}}},value.state,page,extra);}
const pageFor=async(records,options={})=>readOwnConsumptions(database(records),member,project,{workerId:'worker-a',...options});

test('ESTADO discovers own history with a button; page/detail reads never propose/approve/reverse stock and preserve every state',async()=>{
 const records=Array.from({length:12},(_,i)=>consumption(i)),first=await pageFor(records),second=await pageFor(records,{afterConsumption:first.nextCursor});
 const status=say('ESTADO',null,first);assert.equal(status.reply.type,'interactive');assert.ok(status.state.choices.some(c=>c.title==='Mis consumos'));assert.match(status.reply.body,/últimos 5/);assert.match(status.reply.body,/Hay más informes/);
 const list=pick(status,'OWN_CONSUMPTIONS',first),next=pick(list,'NEXT_CONSUMPTIONS',second);assert.notEqual(next.state.nonce,list.state.nonce);assert.ok(next.reply.sections[0].rows.length<=10);
 const direct=await pageFor(records,{consumptionId:'consumption-7'}),detail=pick(next,'consumption-7',direct);assert.equal(detail.reply.type,'text');assert.equal(detail.preserveConversation,true);assert.equal(detail.state,next.state);assert.match(detail.reply.body,/Revertido/);assert.match(detail.reply.body,/Decisión registrada: Aprobado/);assert.match(detail.reply.body,/Reversión registrada: Revertido/);for(const value of [direct.records[0].submittedAt,direct.records[0].proposalReceiptId,direct.records[0].decision.receiptId,direct.records[0].reversal.receiptId])assert.ok(detail.reply.body.includes(value));assert.ok(detail.reply.body.length<=4096);
 for(const value of [status,list,next,detail]){assert.equal(value.command,undefined);assert.equal(value.media,undefined);assert.equal(value.consumptionRead,true);}
 const reset=pick(next,'FIRST_CONSUMPTIONS',first);assert.equal(reset.state.consumptionAfter,null);assert.match(reset.reply.body,/informados por tu cuenta/);
});
test('missing directed facts, stale/expired choice and revoked permission cannot disclose a prepared own detail',async()=>{
 const records=[consumption(1)],page=await pageFor(records),list=say('CONSUMOS',null,page),selection={type:'interactive',interactive:{type:'list_reply',list_reply:{id:list.reply.sections[0].rows[0].id}}};
 assert.throws(()=>plan(selection,list.state,{...page,records:[]}),{code:'INVENTORY_CURSOR_UNAVAILABLE'});
 const denied=plan(selection,list.state,page,{permissions:{attendance:true,report:false}});assert.equal(denied.state,null);assert.doesNotMatch(denied.reply.body,/Cemento|consumption-1/);assert.equal(denied.command,undefined);
 const newer=say('CONSUMOS',null,page),stale=plan(selection,newer.state,page);assert.match(stale.reply.body,/paso anterior/);assert.doesNotMatch(stale.reply.body,/Cemento/);
 const expired=plan(selection,{...list.state,expiresAt:now.toISOString()},page);assert.equal(expired.command,undefined);assert.doesNotMatch(expired.reply.body,/consumption-1/);
});
test('STATUS never claims absence from general inventory and preserves an active business draft exactly',async()=>{
 const own=await pageFor([consumption(1)]),draft={version:1,purpose:'CONSUMPTION',step:'REASON',materialId:material.id,quantity:'2.500',nonce:'e'.repeat(20),choices:[],expiresAt:'2026-10-12T12:15:00.000Z'};
 const result=say('ESTADO',draft,own,{inventory:{consumptions:[],consumptionsTruncated:true}});assert.equal(result.state,draft);assert.equal(result.preserveConversation,true);assert.match(result.reply.body,/Cemento.*Aprobado/);assert.match(result.reply.body,/CANCELAR.*ESTADO/);
 const missing=say('ESTADO',null,undefined,{ownConsumptions:undefined});assert.doesNotMatch(missing.reply.body,/ninguno/);
 const revoked=say('ESTADO',null,own,{permissions:{attendance:true,report:false}});assert.equal(revoked.reply.type,'text');assert.doesNotMatch(revoked.reply.body,/Consumos|Cemento/);
});
test('new proposal keeps immutable catalog label and proposal receipt without moving stock',async()=>{
 const db=database([]);let stored;db.query=async(sql,args)=>{if(sql.startsWith('INSERT INTO public."Incident"')){stored={id:args[0],metadata:JSON.parse(args[5]),revision:'2026-10-12T12:00:00.123456'};return rows([]);}if(sql.startsWith('SELECT id,metadata'))return rows([stored]);throw Error('Unexpected proposal query');};
 const outcome=await applyInventoryFieldAction({client:db,member,session:{userId:member.clerkUserId},project:structuredClone(project),command:{action:'PROPOSE_CONSUMPTION',operationId:randomUUID(),payload:{workerId:'worker-a',taskId:null,sectorId:'sector-a',materialId:material.id,quantity:'2.500',catalogHash:inventoryCatalogHash(project.metadata.materialInventory),reason:'Para preparar la mezcla del sector.'}},receiptId:'field_'+digest('original-proposal'),at:now.toISOString(),assertWorker:async()=>({id:'worker-a'}),assertTask:async()=>{throw Error('No task');}});
 assert.equal(outcome.stockChanged,false);assert.equal(outcome.consumption.materialName,'Cemento');assert.equal(outcome.consumption.proposalReceiptId,'field_'+digest('original-proposal'));assert.equal(project.metadata.materialInventory.materials[0].balance,'25.000');
 const reply=metaFieldConsumptionAcknowledgement({...outcome,receiptId:outcome.consumption.proposalReceiptId},project.name);for(const value of ['2.500 bolsa','Cemento',project.name,outcome.consumption.id,outcome.consumption.proposalReceiptId])assert.ok(reply.includes(value));assert.match(reply,/no descuenta stock/);customerReplyMessage({type:'text',body:reply});
});
test('recovery preserves the original proposal snapshot separately from its current approval and original stock effect',async()=>{
 const operationId=randomUUID(),id=fieldReceiptId(member.actorId,project.id,operationId),original=consumption(0).metadata.materialInventory,current=consumption(0,{state:'APPROVED',decision:event('APPROVE')}),receipt={id,metadata:{version:1,projectId:project.id,command:'PROPOSE_CONSUMPTION',outcome:{kind:'CONSUMPTION_PROPOSAL',consumption:{id:current.id,...original},stockChanged:false}}};
 const imageSet=[{id:'front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:8,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:8,contentType:'image/png'}],kyc={version:1,status:'APPROVED',submissionId:'kyc-a',contentHash:digest(imageSet.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images:imageSet,review:{decision:'APPROVED',actorId:'reviewer-a',recordedAt:now.toISOString()}},worker={id:'worker-a',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{report:true},kyc}}};
 const query=async(sql,args)=>{if(sql.includes("'REVIEW_KYC'"))return rows([{id:'review',metadata:{}}]);if(sql.includes("'KYC_SUBMITTED'"))return rows([{id:'submission',metadata:{contentHash:kyc.contentHash}}]);if(sql.includes('FROM public."AuditLog"'))return rows([receipt]);if(sql.includes('FROM public."Worker"'))return rows([worker]);if(sql.includes('FROM public."Incident"'))return rows([current]);throw Error('Unexpected recovery query');};
 const service=createFieldOperations({workspace:{projectOperation:async(_s,_c,_w,callback)=>callback({query},member,scope,project)}}),result=await service.status({userId:member.clerkUserId},{projectId:project.id,scope,operationId});
 assert.equal(result.receiptId,id);assert.equal(result.recordedConsumptionSnapshot.state,'PENDING');assert.equal(result.consumption.state,'APPROVED');assert.equal(result.stockChanged,false);assert.equal(receipt.metadata.outcome.consumption.state,'PENDING');assert.match(metaFieldConsumptionAcknowledgement(result,project.name),/Quedó pendiente/);
});

function bridgeFixture(records){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,37).toString('base64')},data=database(records),audits=new Map(),kycImages=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:8,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:8,contentType:'image/png'}],kyc={version:1,status:'APPROVED',submissionId:'kyc-a',contentHash:digest(kycImages.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images:kycImages,review:{decision:'APPROVED',actorId:'reviewer-a',recordedAt:now.toISOString()}};
 const worker={id:'worker-a',name:'Ficha actual',projectId:project.id,active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:true,report:true},kyc}}},connection={id:'connection-a',projectId:project.id,metadata:{}},binding={id:'binding-a'};let currentEvent,message,serial=0,open=0,revoked=false,externalCalls=0,ownQueries=0,evidenceCatalogQueries=0;
 const query=async(sql,args=[])=>{
  if(sql==='BEGIN'){open++;return rows([]);}if(sql==='COMMIT'||sql==='ROLLBACK'){open--;return rows([]);}if(sql.startsWith('SET LOCAL')||sql.startsWith('SAVEPOINT')||sql.startsWith('ROLLBACK TO SAVEPOINT'))return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(Date.now()+serial+20)}]);if(sql.includes('SELECT "eventType"'))return rows([{eventType:'message'}]);
  if(sql.includes("'REVIEW_KYC'"))return rows([{id:'review',metadata:{}}]);if(sql.includes("'KYC_SUBMITTED'"))return rows([{id:'submission',metadata:{contentHash:kyc.contentHash}}]);
  if(sql.includes('FROM public."AuditLog"')){const a=audits.get(args[0]);return rows(a?[a]:[]);}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!audits.has(args[0]));audits.set(args[0],{id:args[0],action:/VALUES\(\$1,\$2,\$3,'([^']+)'/.exec(sql)[1],metadata:JSON.parse(args[4])});return rows([]);}
  if(sql.startsWith('UPDATE public."Worker"')){worker.metadata=JSON.parse(args[2]);return {rows:[],rowCount:1};}if(sql.includes('FROM public."Worker"'))return rows([worker]);
  if(sql.includes('FROM public."Project"')&&!sql.includes('JOIN'))return rows([{revision:'2026-10-12T12:00:00.123456'}]);
  if(sql.includes('FROM public."Task"')||sql.includes('FROM public."AttendanceEntry"')||sql.includes('FROM public."OperationalProposal"'))return rows([]);
  if(sql.startsWith('INSERT INTO public."Incident"')){records.push({id:args[0],projectId:args[1],organizationId:member.organizationId,title:args[2],metadata:JSON.parse(args[5]),revision:'2026-10-12T12:00:00.123456',createdAt:Date.now()});return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT id,metadata')&&sql.includes('WHERE id=$1'))return rows(records.filter(r=>r.id===args[0]&&r.projectId===args[1]));
  if(sql.startsWith("SELECT i.id,i.title,i.metadata->'fieldOperations'->>'taskId'")){
   const field="i.metadata->'fieldOperations'";
   assert.equal(sql,`SELECT i.id,i.title,${field}->>'taskId' AS "taskId",${field}->>'workerId' AS "workerId",${field}->>'sectorId' AS "sectorId",${field}->'media'->>'kind' AS "mediaKind",${field}->'media'->>'contentType' AS "contentType",${field}->'media'->>'bytes' AS "mediaBytes",${field}->'media'->>'sha256' AS "mediaSha256",CASE WHEN ${field}->'review'->>'decision'='APPROVE' THEN 'APPROVED' ELSE 'PENDING' END AS status,to_char(i."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision,to_char(i."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt" FROM public."Incident" i JOIN public."Project" p ON p.id=i."projectId" WHERE i."projectId"=$1 AND p."organizationId"=$5 AND p.status='ACTIVE' AND ${field}->>'version'='1' AND ${field}->>'kind'='EVIDENCE' AND ${field}->>'taskId' IS NOT DISTINCT FROM $2::text AND ${field}->>'workerId'=$3 AND ${field}->>'recordedBy'=$4 AND ${field}->>'sectorId'=$6 AND ${field}->'review'->>'decision' IS DISTINCT FROM 'REJECT' AND ${field}->'media'->>'kind' IN ('image','audio') ORDER BY i."createdAt" DESC,i.id DESC LIMIT 7`);
   assert.deepEqual(args,[project.id,null,worker.id,member.actorId,member.organizationId,'sector-a']);assert.ok(records.every(record=>!record.metadata.fieldOperations),'This bridge fixture has consumption records only and no saved evidence');evidenceCatalogQueries++;return rows([]);
  }
  if(sql.includes('FROM public."Incident"')){if(sql.includes("->>'workerId'=$3"))ownQueries++;return data.query(sql,args);}
  throw Error('Unexpected synthetic bridge SQL: '+sql);
 };
 const resolveIdentity=async()=>{if(revoked||!worker.active||worker.metadata.participant.kyc.status!=='APPROVED')throw new WorkspaceError('WORKER_CHANNEL_IDENTITY_REQUIRED',403);return {kind:'CHANNEL_VERIFIED',member,project,worker,connection,event:currentEvent,proof:{value:message},channelBinding:binding};};
 const noExternal=async()=>{externalCalls++;throw Error('No synthetic history read may call a provider');};
 const bridge=createMetaFieldBridge({connect:async()=>({query,release:()=>assert.equal(open,0)}),resolveIdentity,environment,provider:{downloadMedia:noExternal,sendReply:noExternal}});
 function inbound(body){serial++;message=typeof body==='string'?{type:'text',text:{body},timestamp:String(Math.floor(Date.now()/1000))}:{...body,timestamp:String(Math.floor(Date.now()/1000))};currentEvent={id:'event-'+serial,projectId:project.id,status:'PENDING',createdAt:new Date(Date.now()+serial),leaseToken:'lease-'+serial,leaseExpiresAt:new Date(Date.now()+120000),payload:{payloadDigest:digest(message)}};return {eventId:currentEvent.id,projectId:project.id,channelId:connection.id,payloadDigest:currentEvent.payload.payloadDigest,leaseToken:currentEvent.leaseToken};}
 function seedConversation(state){const envelope={...state,version:1,lastEventId:'previous-event',lastMessageTimestamp:'1',lastReceivedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+120000).toISOString(),bindingId:binding.id};worker.metadata.fieldChannelConversation={version:1,...envelope,encryptedState:encryptCustomerSecret(JSON.stringify(envelope),{organizationId:member.organizationId,projectId:project.id,purpose:'field-conversation',resourceId:worker.id},environment)};}
 return {bridge,inbound,worker,audits,records,seedConversation,externalCalls:()=>externalCalls,ownQueries:()=>ownQueries,evidenceCatalogQueries:()=>evidenceCatalogQueries,revoke:()=>{revoked=true;},conversation:()=>readMetaFieldConversation({worker,member,project,channelBinding:binding},environment)};
}
test('actual bridge new STATUS observes current decisions while identical signed event remains original with no additional read/send',async()=>{
 const records=[consumption(0)],f=bridgeFixture(records),context=f.inbound('ESTADO'),first=await f.bridge.execute(context);assert.equal(first.kind,'CONSUMPTION_READ');assert.equal(first.businessApplied,false);assert.equal(first.replySent,false);assert.match(first.reply.body,/Pendiente de revisión/);customerReplyMessage(first.reply);assert.equal(f.conversation().step,'OWN_CONSUMPTION_STATUS');
 records[0]=consumption(0,{state:'APPROVED',decision:event('APPROVE')});const count=f.ownQueries(),duplicate=await f.bridge.execute(context);assert.deepEqual(duplicate,first);assert.equal(f.ownQueries(),count);assert.equal(f.audits.size,1);assert.equal(f.externalCalls(),0);
 const current=await f.bridge.execute(f.inbound('ESTADO'));assert.match(current.reply.body,/Aprobado/);assert.equal(f.audits.size,2);assert.equal(f.externalCalls(),0);
 const index=current.reply.sections[0].rows.findIndex(r=>r.title==='Mis consumos'),list=await f.bridge.execute(f.inbound({type:'interactive',interactive:{type:'list_reply',list_reply:{id:current.reply.sections[0].rows[index].id}}}));assert.match(list.reply.body,/informados por tu cuenta/);assert.equal(f.conversation().step,'OWN_CONSUMPTION_LIST');
 records[0]=consumption(0,{state:'REVERSED',decision:event('APPROVE'),reversal:event('REVERSE')});const detail=await f.bridge.execute(f.inbound({type:'interactive',interactive:{type:'list_reply',list_reply:{id:list.reply.sections[0].rows[0].id}}}));assert.match(detail.reply.body,/Estado vigente: Revertido/);assert.match(detail.reply.body,/Recibo:/);assert.equal(detail.businessApplied,false);assert.equal(f.externalCalls(),0);customerReplyMessage(detail.reply);
});
test('actual bridge cached history reply rejects current report, KYC, membership and channel revocations before decryption/read',async()=>{
 for(const revoke of [f=>{f.worker.metadata.participant.permissions.report=false;},f=>{f.worker.metadata.participant.kyc.status='REVOKED';},f=>{f.worker.active=false;},f=>f.revoke()]){const f=bridgeFixture([consumption(0)]),context=f.inbound('ESTADO');await f.bridge.execute(context);const count=f.ownQueries();revoke(f);await assert.rejects(f.bridge.execute(context));assert.equal(f.ownQueries(),count);assert.equal(f.audits.size,1);assert.equal(f.externalCalls(),0);}
});
test('actual bridge confirms one consumption with its material/amount/worksite/receipt and replays original ACK after a later decision',async()=>{
 const f=bridgeFixture([]),nonce='e'.repeat(20),state={purpose:'CONSUMPTION',step:'CONFIRM',taskId:null,sectorId:'sector-a',materialId:material.id,catalogHash:inventoryCatalogHash(project.metadata.materialInventory),quantity:'2.500',reason:'Para la mezcla del sector de la obra.',nonce,choices:[{value:'CONFIRM',title:'Guardar'}]};f.seedConversation(state);
 const context=f.inbound({type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+nonce+':0'}}}),first=await f.bridge.execute(context);assert.equal(first.kind,'CONSUMPTION_PROPOSAL');assert.equal(first.businessApplied,true);assert.equal(first.replySent,false);assert.equal(f.records.length,1);assert.equal(f.evidenceCatalogQueries(),1);const c=f.records[0].metadata.materialInventory;
 for(const value of ['Cemento','2.500 bolsa',project.name,first.receiptId,f.records[0].id,c.submittedAt])assert.ok(first.reply.body.includes(value));assert.equal(c.proposalReceiptId,first.receiptId);assert.equal(c.state,'PENDING');assert.equal(c.materialName,'Cemento');assert.equal(project.metadata.materialInventory.materials[0].balance,'25.000');assert.match(first.reply.body,/no descuenta stock/);
 c.state='APPROVED';c.decision=event('APPROVE');const count=f.audits.size,duplicate=await f.bridge.execute(context);assert.deepEqual(duplicate,first);assert.equal(f.audits.size,count);assert.equal(f.records.length,1);assert.equal(f.externalCalls(),0);assert.equal(f.evidenceCatalogQueries(),1);
 f.worker.metadata.participant.permissions.report=false;await assert.rejects(f.bridge.execute(context),{code:'WORKER_CHANNEL_PERMISSION_REQUIRED'});f.worker.metadata.participant.permissions.report=true;
 const current=await f.bridge.execute(f.inbound('CONSUMOS'));assert.equal(current.kind,'CONSUMPTION_READ');assert.match(current.reply.sections[0].rows[0].description,/Aprobado/);assert.equal(f.records.length,1);assert.equal(f.externalCalls(),0);
});
