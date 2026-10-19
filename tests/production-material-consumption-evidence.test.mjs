import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {applyInventoryFieldAction,assertConsumptionEvidenceAccess,inventoryCatalogHash} from '../src/lib/material-inventory.mjs';
import {normalizeFieldCommand} from '../src/lib/field-operations-policy.mjs';
import {createFieldMedia} from '../src/lib/field-media.mjs';
import {createFieldMediaHandlers} from '../src/lib/field-operations-http.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {consumptionEvidenceViews} from '../src/app/(identity)/cuenta/material-inventory-view.mjs';

const revision='2026-10-19T12:00:00.000001',at='2026-10-19T12:00:00.000Z',scope='a'.repeat(64);
function fixture(){
 const bytes=Buffer.from('synthetic-private-consumption-original'),media={kind:'image',contentType:'image/png',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),pathname:'obrasaas/field/v1/'+'c'.repeat(64)+'/evidence.png'};
 const member={actorId:'actor-a',organizationId:'company-a',role:'WORKER',clerkUserId:'user_A'},session={userId:'user_A'},project={id:'project-a',metadata:{fieldOperations:{sectors:[{id:'sector-a'}]},materialInventory:{version:1,catalogVersion:1,materials:[{id:'material-a',name:'Material sintético',unit:'bolsa',active:true,balance:'10.000'}]}}};
 const images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:8,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:8,contentType:'image/png'}],kyc={version:1,status:'APPROVED',submissionId:'kyc-a',contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images,review:{decision:'APPROVED',actorId:'independent-reviewer',recordedAt:at}};
 const worker={id:'worker-a',active:true,clerkUserId:'user_A',metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:'user_A',permissions:{report:true},kyc}}};
 const evidence={id:'evidence-a',projectId:project.id,revision,metadata:{fieldOperations:{version:1,kind:'EVIDENCE',recordedBy:member.actorId,workerId:worker.id,taskId:'task-a',sectorId:'sector-a',media,review:null}}};
 const state={project,worker,evidence,rows:new Map(),movements:[],writes:[],membershipActive:true,reviewReceipt:true,submissionReceipt:true,blobReads:0};
 const client={async query(sql,args=[]){
  if(sql.includes('FROM public."Worker"')){const p=worker.metadata.participant,allowed=state.membershipActive&&worker.active&&p.status==='ACTIVE'&&p.permissions.report===true&&p.clerkUserId===worker.clerkUserId&&args[0]===project.id&&args[1]===member.organizationId&&args[2]===worker.id&&args[3]===member.actorId;return {rows:allowed?[structuredClone(worker)]:[]};}
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'REVIEW_KYC'"))return {rows:state.reviewReceipt&&args[0]===member.organizationId&&args[2]===worker.id?[{id:'review-a',metadata:{}}]:[]};
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'KYC_SUBMITTED'"))return {rows:state.submissionReceipt&&args[1]===member.actorId&&args[2]===worker.id?[{id:'submission-a',metadata:{contentHash:kyc.contentHash}}]:[]};
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Incident"')){const row=args[0]===evidence.id?evidence:state.rows.get(args[0]);return {rows:row&&args[1]===project.id&&row.projectId===project.id?[structuredClone(row)]:[]};}
  if(sql.startsWith('INSERT INTO public."Incident"')){state.writes.push('proposal');state.rows.set(args[0],{id:args[0],projectId:args[1],revision,metadata:JSON.parse(args[5])});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."Incident"')){state.writes.push('decision');state.rows.get(args[0]).metadata=JSON.parse(args[2]);return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."Project"')){state.writes.push('stock');project.metadata=JSON.parse(args[2]);return {rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){state.writes.push('movement');state.movements.push(JSON.parse(args[4]));return {rows:[],rowCount:1};}
  assert.fail('Unexpected query in bounded consumption fixture: '+sql);
 }};
 const base={projectId:project.id,scope,action:'PROPOSE_CONSUMPTION',payload:{workerId:worker.id,taskId:'task-a',sectorId:'sector-a',materialId:'material-a',catalogHash:inventoryCatalogHash(project.metadata.materialInventory),quantity:'2.000',reason:'Consumo confirmado del sector sintético.'}};
 const assertWorker=async(_client,actor,ownSession,projectId,workerId)=>{if(!worker.active||worker.metadata.participant.permissions.report!==true||actor.actorId!==member.actorId||ownSession.userId!==worker.clerkUserId||projectId!==project.id||workerId!==worker.id)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);};
 const apply=async(command,actor=member)=>applyInventoryFieldAction({client,member:actor,session,project,command,receiptId:'field_'+digest(command.operationId),at,assertWorker,assertTask:async(_client,projectId,taskId)=>{assert.equal(projectId,project.id);assert.equal(taskId,'task-a');}});
 const propose=(evidenceIds=['evidence-a'])=>apply(normalizeFieldCommand({...base,operationId:randomUUID(),payload:{...base.payload,...(evidenceIds===undefined?{}:{evidenceIds})}}));
 const approve=consumption=>apply(normalizeFieldCommand({projectId:project.id,scope,operationId:randomUUID(),action:'DECIDE_CONSUMPTION',payload:{proposalId:consumption.id,revision,catalogHash:base.payload.catalogHash,decision:'APPROVE',reason:'Revisé el material, cantidad y original.'}}),{...member,actorId:'reviewer-b',role:'DIRECTOR'});
 const download=(consumption,{afterBlob=null,role='DIRECTOR',actorId='reviewer-b'}={})=>{
  const actor={...member,actorId,role},operations={mediaTransaction:async(_session,_input,_writable,callback)=>callback(client,actor,scope,project),readEvidence:async(_client,projectId,id)=>{assert.equal(projectId,project.id);assert.equal(id,evidence.id);return structuredClone(evidence);}};
  const api=createFieldMedia({operations,get:async()=>{state.blobReads++;afterBlob?.();return {statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+media.pathname,pathname:media.pathname,size:bytes.length,contentType:media.contentType},stream:new Response(bytes).body};},put:async()=>assert.fail('No upload allowed'),analyzer:{}});
  return api.download(session,{projectId:project.id,scope,evidenceId:evidence.id,consumptionId:consumption.id});
 };
 return {state,client,member,session,project,worker,evidence,base,apply,propose,approve,download};
}

test('optional consumption evidence keeps the exact legacy command and rejects tokens or malformed selections',()=>{
 const f=fixture(),input={...f.base,operationId:randomUUID()},legacy=normalizeFieldCommand(input);
 assert.deepEqual(legacy.payload,input.payload);assert.deepEqual(normalizeFieldCommand({...input,payload:{...input.payload,evidenceIds:[]}}).payload,legacy.payload);
 for(const changed of [{evidenceIds:['evidence-a','evidence-a']},{evidenceIds:['not/an/id']},{evidenceIds:Array.from({length:11},(_,i)=>'evidence-'+i)},{evidenceIds:'token'},{evidenceBindings:[]},{evidenceIds:['evidence-a'],token:'forged'}])assert.throws(()=>normalizeFieldCommand({...input,payload:{...input.payload,...changed}}));
});

test('a proposal binds the authorized private original but does not change any stock or movement',async()=>{
 const f=fixture(),result=await f.propose();assert.equal(result.stockChanged,false);assert.equal(f.project.metadata.materialInventory.materials[0].balance,'10.000');assert.deepEqual(f.state.writes,['proposal']);assert.equal(f.state.movements.length,0);
 assert.deepEqual(result.consumption.evidenceIds,['evidence-a']);assert.deepEqual(result.consumption.evidenceBindings,[{id:'evidence-a',media:{kind:'image',contentType:'image/png',bytes:f.evidence.metadata.fieldOperations.media.bytes,sha256:f.evidence.metadata.fieldOperations.media.sha256}}]);assert.doesNotMatch(JSON.stringify(result),/pathname|private\.blob|token|images/);
});

test('a distinct reviewer approves one evidenced consumption and creates exactly one stock movement',async()=>{
 const f=fixture(),proposal=await f.propose(),result=await f.approve(proposal.consumption);assert.equal(result.stockChanged,true);assert.equal(result.consumption.state,'APPROVED');assert.equal(f.project.metadata.materialInventory.materials[0].balance,'8.000');assert.equal(f.state.movements.length,1);assert.equal(f.state.writes.filter(kind=>kind==='stock').length,1);assert.deepEqual(result.consumption.evidenceIds,['evidence-a']);
 await assert.rejects(f.approve(result.consumption),{code:'INVENTORY_ALREADY_DECIDED'});assert.equal(f.state.movements.length,1);
});

test('foreign project author worker task sector or rejected evidence is denied before a proposal is written',async()=>{
 for(const change of [f=>{f.evidence.projectId='other-project';},f=>{f.evidence.metadata.fieldOperations.recordedBy='other-actor';},f=>{f.evidence.metadata.fieldOperations.workerId='other-worker';},f=>{f.evidence.metadata.fieldOperations.taskId='other-task';},f=>{f.evidence.metadata.fieldOperations.sectorId='other-sector';},f=>{f.evidence.metadata.fieldOperations.review={decision:'REJECT'};}]){const f=fixture();change(f);await assert.rejects(f.propose(),{code:'INVENTORY_EVIDENCE_UNAVAILABLE'});assert.equal(f.state.writes.length,0);assert.equal(f.state.movements.length,0);}
});

test('current membership identity and original author bindings are rechecked before approval',async()=>{
 for(const change of [f=>{f.state.membershipActive=false;},f=>{f.worker.metadata.participant.permissions.report=false;},f=>{f.state.reviewReceipt=false;},f=>{f.worker.metadata.participant.kyc.status='PENDING_REVIEW';},f=>{f.evidence.metadata.fieldOperations.recordedBy='new-actor';},f=>{f.evidence.metadata.fieldOperations.media.sha256='d'.repeat(64);}]){const f=fixture(),proposal=await f.propose();change(f);await assert.rejects(f.approve(proposal.consumption),{code:'INVENTORY_EVIDENCE_UNAVAILABLE'});assert.equal(f.project.metadata.materialInventory.materials[0].balance,'10.000');assert.equal(f.state.movements.length,0);assert.equal(f.state.rows.get(proposal.consumption.id).metadata.materialInventory.state,'PENDING');}
});

test('consumption private reads require an exact linked ID and a current authorized reviewer or original author',async()=>{
 const f=fixture(),proposal=await f.propose(),context={consumptionId:proposal.consumption.id,evidenceId:'evidence-a'};
 await assertConsumptionEvidenceAccess(f.client,{...f.member,actorId:'reviewer-b',role:'DIRECTOR'},f.project,context);
 await assert.rejects(assertConsumptionEvidenceAccess(f.client,f.member,f.project,{...context,consumptionId:'foreign-consumption'}),{code:'INVENTORY_CONSUMPTION_UNAVAILABLE',status:404});
 await assert.rejects(assertConsumptionEvidenceAccess(f.client,f.member,f.project,{...context,evidenceId:'foreign-evidence'}),{code:'INVENTORY_EVIDENCE_UNAVAILABLE',status:404});
 await assert.rejects(assertConsumptionEvidenceAccess(f.client,{...f.member,actorId:'other-actor',role:'SITE_MANAGER'},f.project,context),{code:'INVENTORY_EVIDENCE_UNAVAILABLE'});assert.equal(f.state.blobReads,0);
});

test('the existing private download returns the linked original without a write or provider call',async()=>{
 const f=fixture(),proposal=await f.propose(),writes=f.state.writes.length,result=await f.download(proposal.consumption);assert.equal(result.contentType,'image/png');assert.equal(result.bytes.length,f.evidence.metadata.fieldOperations.media.bytes);assert.equal(f.state.blobReads,1);assert.equal(f.state.writes.length,writes);
});

test('revocation or reassignment during the Blob await prevents the consumption download returning bytes',async()=>{
 for(const afterBlob of [f=>{f.state.membershipActive=false;},f=>{f.worker.metadata.participant.permissions.report=false;},f=>{f.evidence.metadata.fieldOperations.recordedBy='other-actor';}]){const f=fixture(),proposal=await f.propose();await assert.rejects(f.download(proposal.consumption,{afterBlob:()=>afterBlob(f)}),{code:'INVENTORY_EVIDENCE_UNAVAILABLE'});assert.equal(f.state.blobReads,1);assert.equal(f.state.movements.length,0);}
});

test('legacy consumption without attachments remains unchanged and does not gain a fabricated evidence array',async()=>{
 const f=fixture(),result=await f.propose([]);assert.equal(Object.hasOwn(result.consumption,'evidenceIds'),false);assert.equal(Object.hasOwn(result.consumption,'evidenceBindings'),false);assert.deepEqual(consumptionEvidenceViews(result.consumption),[]);assert.equal(result.stockChanged,false);assert.equal(f.state.movements.length,0);
});

test('the browser uses only bounded persisted media bindings and rejects crossed or malformed attachment DTOs',async()=>{
 const f=fixture(),proposal=await f.propose(),c=proposal.consumption,views=consumptionEvidenceViews(c);assert.equal(views[0].id,'evidence-a');assert.equal(views[0].media.sha256,f.evidence.metadata.fieldOperations.media.sha256);assert.doesNotMatch(JSON.stringify(views),/pathname|token|private\.blob/);
 for(const changed of [{...c,evidenceIds:['other-id']},{...c,evidenceBindings:[]},{...c,evidenceBindings:[{id:'evidence-a',media:{...c.evidenceBindings[0].media,bytes:0}}]},{...c,evidenceBindings:[{id:'evidence-a',media:{...c.evidenceBindings[0].media,kind:'video'}}]}])assert.throws(()=>consumptionEvidenceViews(changed));
});

test('the existing media GET accepts consumption context only for a unique private download',async()=>{
 const calls=[],session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Test',organizationId:'org_A',organizationRole:'org:admin'},handlers=createFieldMediaHandlers({verify:async()=>session,media:{download:async(_session,input)=>{calls.push(input);return {bytes:Buffer.from('original'),contentType:'image/png',extension:'png'};}}}),query='?'+new URLSearchParams({projectId:'project-a',scope,evidenceId:'evidence-a',consumptionId:'consumption-a'});
 assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/identity/field-media'+query))).status,200);assert.equal(calls[0].consumptionId,'consumption-a');
 for(const suffix of ['&consumptionId=other','&operationId='+randomUUID(),'&token=forged'])assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/identity/field-media'+query+suffix))).status,400);assert.equal(calls.length,1);
});


test('unassigned consumption accepts only an explicitly unassigned original and never crosses to an assigned task',async()=>{
 const f=fixture();f.base.payload.taskId=null;f.evidence.metadata.fieldOperations.taskId=null;const proposal=await f.propose();assert.equal(proposal.consumption.taskId,null);assert.equal(consumptionEvidenceViews(proposal.consumption).length,1);assert.equal(f.state.movements.length,0);await f.approve(proposal.consumption);assert.equal(f.state.movements.length,1);
 const crossed=fixture();crossed.base.payload.taskId=null;await assert.rejects(crossed.propose(),{code:'INVENTORY_EVIDENCE_UNAVAILABLE'});assert.equal(crossed.state.writes.length,0);
});
