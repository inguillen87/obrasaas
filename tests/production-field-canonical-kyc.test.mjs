import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {assertFieldParticipant} from '../src/lib/participant-policy.mjs';
import {digest,scopeStamp} from '../src/lib/workspace-policy.mjs';

// Real workspace and field services with an isolated in-memory SQL adapter.
// Administrative bootstrap remains distinct from the administrator's own work.
function fixture({worker=true}={}){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_FieldAdmin',organizationId:'org_FieldAdmin',organizationRole:'org:admin'};
 const member={actorId:'field-admin',membershipId:'field-member',organizationId:'field-company',organizationName:'Synthetic company',role:'ADMIN',clerkUserId:session.userId,clerkRole:session.organizationRole};
 const revision='2026-10-07T12:00:00.000001',images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:32,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:32,contentType:'image/png'}];
 const row={id:'worker-a',projectId:'project-a',name:'Synthetic own worker',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:true,report:true},kyc:{version:1,status:'APPROVED',submissionId:'kyc-a',contentHash:digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images,review:{decision:'APPROVED',actorId:'independent-reviewer',recordedAt:'2026-10-07T12:00:00.000Z'}}}}};
 const project={id:'project-a',name:'Synthetic project',status:'ACTIVE',revision,metadata:{fieldOperations:{version:1,configRevision:'config-a',sectors:[{id:'sector-a',name:'Sector A',latitude:0,longitude:0,radius:100}]}},organizationMetadata:{}};
 const approval={id:'review-proof',actorId:'independent-reviewer',entityId:row.id,metadata:{version:1,kind:'REVIEW_KYC',projectId:project.id,submissionId:'kyc-a',decision:'APPROVED'}};
 const submission={id:'submission-proof',actorId:member.actorId,entityId:row.id,metadata:{version:1,kind:'KYC_SUBMITTED',projectId:project.id,submissionId:'kyc-a',contentHash:row.metadata.participant.kyc.contentHash}};
 const proof={approval,submission},audits=new Map(),incidents=new Map(),queries=[],writes=[];
 const client={release(){},async query(sql,args=[]){
  queries.push({sql,args});
  if(/^(?:BEGIN |SET LOCAL |COMMIT$|ROLLBACK$)/.test(sql))return {rows:[]};
  if(sql.includes('FROM public."PlatformUser"'))return {rows:[member]};
  if(sql.includes('FROM public."Worker"')){
   const own=worker&&row.id===args[0]&&row.projectId===args[1];
   if(sql.includes("->>'status'='ACTIVE'")&&(!row.active||row.metadata.participant.status!=='ACTIVE'||row.metadata.participant.clerkUserId!==args[2]||row.metadata.participant.kyc.status!=='APPROVED'||row.metadata.participant.permissions[args[3]]!==true))return {rows:[]};
   return {rows:own?[row]:[]};
  }
  if(sql.includes('FROM public."TenantMembership"')||sql.includes('FROM public."ProjectMembership"'))return {rows:[{id:'assignment-a'}]};
  if(sql.includes('FROM public."Project"'))return {rows:args[0]===project.id?[project]:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date('2026-10-07T12:00:01Z')}]};
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("'REVIEW_KYC'"))return {rows:proof.approval&&proof.approval.actorId===args[1]&&proof.approval.entityId===args[2]&&proof.approval.metadata.projectId===args[3]&&proof.approval.metadata.submissionId===args[4]&&proof.approval.metadata.kind==='REVIEW_KYC'&&proof.approval.metadata.decision==='APPROVED'?[proof.approval]:[]};
   if(sql.includes("'KYC_SUBMITTED'"))return {rows:proof.submission&&proof.submission.actorId===args[1]&&proof.submission.entityId===args[2]&&proof.submission.metadata.projectId===args[3]&&proof.submission.metadata.submissionId===args[4]&&proof.submission.metadata.kind==='KYC_SUBMITTED'?[proof.submission]:[]};
   assert.ok(sql.includes("'field.operation.recorded'"),'Unexpected audit query');return {rows:audits.has(args[0])?[audits.get(args[0])]:[]};
  }
  if(sql.startsWith('INSERT INTO public."Incident"')){
   writes.push('Incident');incidents.set(args[0],{id:args[0],title:args[2],description:args[3],severity:args[4],metadata:JSON.parse(args[6]),revision,createdAt:revision});return {rows:[],rowCount:1};
  }
  if(sql.includes('FROM public."Incident"'))return {rows:incidents.has(args[0])?[incidents.get(args[0])]:[]};
  if(sql.startsWith('INSERT INTO public."AuditLog"')){writes.push('AuditLog');audits.set(args[0],{id:args[0],metadata:JSON.parse(args[4])});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."Project"')){writes.push('Project');project.metadata=JSON.parse(args[2]);return {rows:[],rowCount:1};}
  assert.fail('Unexpected synthetic SQL: '+sql);
 }};
 const workspace=createWorkspaceStore({connect:async()=>client}),field=createFieldOperations({workspace}),context={projectId:project.id,scope:scopeStamp(session,member)};
 const command={...context,operationId:randomUUID(),action:'REQUEST_MATERIAL',payload:{workerId:row.id,sectorId:'sector-a',taskId:null,name:'Cemento de ensayo',quantity:'1',unit:'bolsa',reason:'Solicitud sintética sin proveedores',evidenceIds:[]}};
 return {session,member,row,project,proof,client,workspace,field,context,command,queries,writes,incidents,audits};
}
const invalidate={
 'missing independent review receipt':f=>{f.proof.approval=null;},
 'review receipt changed to rejection':f=>{f.proof.approval.metadata.decision='REJECTED';},
 'missing submission receipt':f=>{f.proof.submission=null;},
 'submission receipt with another content digest':f=>{f.proof.submission.metadata.contentHash='0'.repeat(64);}
};
for(const [name,change]of Object.entries(invalidate)){
 test('administrator own field POST refuses '+name+' before recording a report',async()=>{
  const f=fixture();change(f);await assert.rejects(f.field.save(f.session,f.command),{code:'FIELD_KYC_REVIEW_REQUIRED',status:403});assert.deepEqual(f.writes,[]);assert.equal(f.incidents.size,0);assert.equal(f.audits.size,0);
 });
 test('administrator own field replay refuses '+name+' after an earlier valid save',async()=>{
  const f=fixture();await f.field.save(f.session,f.command);change(f);const before=[...f.writes];await assert.rejects(f.field.save(f.session,f.command),{code:'FIELD_KYC_REVIEW_REQUIRED',status:403});assert.deepEqual(f.writes,before);assert.equal(f.incidents.size,1);assert.equal(f.audits.size,1);
 });
 test('administrator own field receipt GET refuses '+name+' without changing stored work',async()=>{
  const f=fixture();await f.field.save(f.session,f.command);change(f);const before=[...f.writes];await assert.rejects(f.field.status(f.session,{...f.context,operationId:f.command.operationId}),{code:'FIELD_KYC_REVIEW_REQUIRED',status:403});assert.deepEqual(f.writes,before);assert.equal(f.incidents.size,1);assert.equal(f.audits.size,1);
 });
 test('explicit personal field guard refuses '+name+' despite approved metadata',async()=>{
  const f=fixture();change(f);await assert.rejects(assertFieldParticipant(f.client,f.member,f.session,f.project.id,f.row.id,{permission:'report',requireKyc:true}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED',status:403});assert.deepEqual(f.writes,[]);
 });
}
test('complete independent review and matching submission admit own work and exact recovery',async()=>{
 const f=fixture();assert.equal(await assertFieldParticipant(f.client,f.member,f.session,f.project.id,f.row.id,{permission:'report',requireKyc:true}),f.row);
 const saved=await f.field.save(f.session,f.command),replayed=await f.field.save(f.session,f.command),recovered=await f.field.status(f.session,{...f.context,operationId:f.command.operationId});
 assert.equal(saved.saved,true);assert.equal(saved.replayed,false);assert.equal(saved.report.type,'MATERIAL_REQUEST');assert.equal(replayed.replayed,true);assert.equal(recovered.state,'RECORDED');assert.equal(recovered.receiptId,saved.receiptId);assert.equal(recovered.report.id,saved.report.id);assert.deepEqual(f.writes,['Incident','AuditLog']);
});
test('canonical office administrator without a Worker can bootstrap site configuration',async()=>{
 const f=fixture({worker:false});let entered=false;await f.workspace.projectOperation(f.session,f.context,false,()=>{entered=true;});assert.equal(entered,true);
 const saved=await f.field.save(f.session,{...f.context,operationId:randomUUID(),action:'CONFIGURE_SITE',payload:{revision:f.project.revision,sectors:[{id:'sector-a',name:'Sector A',latitude:0,longitude:0,radius:100}]}});
 assert.equal(saved.saved,true);assert.equal(saved.kind,'CONFIGURATION');assert.deepEqual(f.writes,['Project','AuditLog']);assert.equal(f.queries.some(q=>q.sql.includes('FROM public."Worker"')),false);
});
test('own participation permission and revocation remain independent of a valid KYC',async()=>{
 const denied=fixture();denied.row.metadata.participant.permissions.report=false;await assert.rejects(denied.field.save(denied.session,denied.command),{code:'FIELD_PARTICIPANT_REQUIRED',status:403});assert.deepEqual(denied.writes,[]);
 const revoked=fixture();revoked.row.metadata.participant.status='REVOKED';await assert.rejects(revoked.field.save(revoked.session,revoked.command),{code:'FIELD_PARTICIPANT_REQUIRED',status:403});assert.deepEqual(revoked.writes,[]);
});
test('non-KYC personal permission checks keep their explicit opt-out for identity presentation',async()=>{
 const f=fixture();f.proof.approval=null;assert.equal(await assertFieldParticipant(f.client,f.member,f.session,f.project.id,f.row.id,{permission:'report',requireKyc:false}),f.row);assert.deepEqual(f.writes,[]);
});
