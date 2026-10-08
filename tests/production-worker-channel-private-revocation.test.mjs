import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createWorkerChannelStore} from '../src/lib/worker-channel-identity.mjs';
import {createWorkerChannelHandlers} from '../src/lib/worker-channel-http.mjs';
import {scopeStamp,digest} from '../src/lib/workspace-policy.mjs';
import {buildWorkerTemplateNotice} from '../src/lib/worker-channel-consent-policy.mjs';

function fixture({status='PENDING_REVIEW',role='AUDITOR',assigned=true,activeMembership=true,owned=true,activeWorker=false,workerStatus='REVOKED',phone=null}={}) {
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Private',organizationId:'org_Private',organizationRole:role==='ADMIN'?'org:admin':'org:member'};
 const member={actorId:'actor-private',membershipId:'membership-private',organizationId:'company-private',organizationName:'Private fixture company',clerkUserId:session.userId,clerkRole:session.organizationRole,role};
 const projectId='project-private',scope=scopeStamp(session,member),queries=[],purposes=[],receipts=new Map();
 let updates=0;
 const row={id:'worker-private',projectId,name:'Own fixture identity',phone,active:activeWorker,revision:'2026-10-01T11:00:00.000001',metadata:{preserved:true,participant:{version:1,status:workerStatus,clerkUserId:owned?session.userId:'user_Other',permissions:{attendance:true,report:true},kyc:{version:1,status,submissionId:'private-submission',contentHash:'a'.repeat(64),images:[{id:'document-front'},{id:'selfie'}],review:{decision:'APPROVED',actorId:member.actorId,recordedAt:'2026-10-01T10:00:00Z'}},channelIdentity:{version:1,challenge:{id:'hidden-challenge',status:'PENDING',codeDigest:'b'.repeat(64),expiresAt:'2099-10-01T12:00:00Z'},binding:{version:1,id:'old-binding',status:'VERIFIED',verifiedAt:'2026-10-01T10:00:00Z'},templateConsent:{version:1,status:'GRANTED',receiptId:'old-grant',noticeVersion:'old',noticeSha256:'c'.repeat(64)}}}}};
 const query=async(sql,args=[])=>{
  queries.push({sql,args});
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql))return {rows:[]};
  if(sql.includes('SELECT u.id AS "actorId"'))return {rows:activeMembership&&args[0]===session.userId&&args[1]===session.organizationId&&args[2]===session.organizationRole?[member]:[]};
  if(sql.includes('SELECT w.id FROM public."Worker" w'))return {rows:owned?[{id:row.id}]:[]};
  if(sql.includes("metadata->>'kind'='INVITATION_ACCEPTED'"))return {rows:[{id:'own-account-admission-origin'}]};
  if(sql.includes('SELECT id,"projectId",active,metadata FROM public."Worker"'))return {rows:owned?[row]:[]};
  if(sql.includes('FROM public."ProjectMembership"'))return {rows:assigned?[{id:'pm-private'}]:[]};
  if(sql.includes('SELECT id,name,status::text AS status FROM public."Project"'))return {rows:args[0]===projectId&&args[1]===member.organizationId?[{id:projectId,name:'Own project',status:'ACTIVE'}]:[]};
  if(sql.includes('SELECT p.id,p.name,p.metadata,o.metadata'))return {rows:[{id:projectId,name:'Own project',metadata:{},organizationMetadata:{}}]};
  if(sql.includes('SELECT clock_timestamp() AS now'))return {rows:[{now:new Date('2026-10-01T12:00:00Z')}]};
  if(sql.includes('FROM public."WhatsAppCompanyChannel"')||sql.includes('FROM public."WhatsAppConnection"'))return {rows:[]};
  if(sql.includes('FROM public."Worker"'))return {rows:sql.includes('metadata->\'participant\'->>\'clerkUserId\'=$2')?owned&&args[0]===projectId&&args[1]===session.userId?[row]:[]:args[0]===row.id&&args[1]===projectId?[row]:[]};
  if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[0],row.id);assert.equal(args[1],projectId);row.metadata=JSON.parse(args[2]);row.revision='2026-10-01T12:00:00.000002';updates++;return {rowCount:1,rows:[]};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){receipts.set(args[0],{id:args[0],entityId:args[3],organizationId:args[1],actorId:args[2],metadata:JSON.parse(args[4])});return {rowCount:1,rows:[]};}
  if(sql.includes('FROM public."AuditLog"')){const found=receipts.get(args[0]);return {rows:found&&found.organizationId===args[1]&&found.actorId===args[2]&&(!sql.includes("metadata->>'kind' IN")||['UNLINK','REVOKE_TEMPLATE_MESSAGES'].includes(found.metadata.kind))?[found]:[]};}
  if(sql.includes('count(*)::int AS total FROM public."Task"'))return {rows:[{total:0}]};
  if(sql.includes('FROM public."Task"'))return {rows:[]};
  throw Error('Unsupported behavioral fixture SQL: '+sql);
 };
 const workspace=createWorkspaceStore({connect:async()=>({query,release(){}})}),original=workspace.projectOperation;
 workspace.projectOperation=(...args)=>{purposes.push(args[5]);return original(...args);};
 const store=createWorkerChannelStore({workspace}),context={projectId,scope};
 const command=(action='REVOKE_TEMPLATE_MESSAGES',changes={})=>({...context,operationId:randomUUID(),action,payload:{workerId:row.id,revision:row.revision,...(action==='UNLINK'?{reason:'Own holder withdraws the old binding.'}:{}),...changes}});
 return {session,member,row,context,workspace,store,command,queries,purposes,receipts,updates:()=>updates};
}
for(const status of ['PENDING_REVIEW','REJECTED','APPROVED'])for(const action of ['REVOKE_TEMPLATE_MESSAGES','UNLINK'])test('private '+action+' survives non-admitted '+status+' with inactive worker and absent phone/channel',async()=>{
 const f=fixture({status}),before=structuredClone(f.row.metadata.participant.kyc),view=await f.store.read(f.session,f.context);
 assert.equal(view.channelReady,false);assert.equal(view.records.length,1);assert.equal(view.records[0].eligible,false);assert.equal(view.records[0].templateConsent.canGrant,false);assert.equal(view.records[0].templateConsent.canRevoke,true);assert.equal(view.records[0].challenge,null);assert.equal(view.records[0].connectionNumber,null);
 const input=f.command(action),saved=await f.store.command(f.session,input);assert.equal(saved.kind,action);assert.equal(saved.saved,true);assert.equal(saved.participant.eligible,false);assert.equal(saved.participant.challenge,null);assert.equal(f.updates(),1);assert.deepEqual(f.row.metadata.participant.kyc,before);assert.equal(f.row.metadata.preserved,true);
 const statusView=await f.store.read(f.session,{...f.context,operationId:input.operationId});assert.equal(statusView.kind,action);assert.equal(statusView.receiptId,saved.receiptId);assert.equal((await f.store.command(f.session,input)).replayed,true);assert.equal(f.updates(),1);assert.ok(f.purposes.every(p=>typeof p==='symbol'));assert.ok(f.queries.every(q=>!q.sql.includes('WhatsAppConnection')&&!q.sql.includes('WhatsAppCompanyChannel')));
 const workerReads=f.queries.filter(q=>q.sql.includes('FROM public."Worker"')&&!q.sql.includes('SELECT w.id')&&!q.sql.includes('SELECT id,"projectId",active,metadata'));
 assert.ok(workerReads.every(q=>q.sql.includes('clerkUserId')?q.args[1]===f.session.userId:q.args[0]===f.row.id&&q.args[1]===f.context.projectId));
});
for(const role of ['AUDITOR','DIRECTOR'])test('non-admitted '+role+' sees no activation receipts, other identities, challenge or grant',async()=>{
 const f=fixture({role}),notice=buildWorkerTemplateNotice(f.member);
 for(const action of ['REQUEST_CHALLENGE','GRANT_TEMPLATE_MESSAGES']){const input=f.command(action,action==='GRANT_TEMPLATE_MESSAGES'?{confirmed:true,noticeVersion:notice.version,noticeSha256:notice.sha256}:{});await assert.rejects(f.store.command(f.session,input),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(f.purposes.at(-1),undefined);const id='worker_channel_'+digest([f.member.actorId,f.context.projectId,input.operationId]);f.receipts.set(id,{id,organizationId:f.member.organizationId,actorId:f.member.actorId,entityId:f.row.id,metadata:{kind:action,projectId:f.context.projectId}});assert.equal((await f.store.read(f.session,{...f.context,operationId:input.operationId})).state,'NOT_OBSERVED');}
 assert.equal(f.updates(),0);assert.ok(f.queries.filter(q=>q.sql.includes('SELECT id,"entityId",metadata')).every(q=>q.sql.includes("metadata->>'kind' IN ('UNLINK','REVOKE_TEMPLATE_MESSAGES')")));
 const other=fixture({role,owned:false});assert.equal((await other.store.read(other.session,other.context)).records.length,0);await assert.rejects(other.store.command(other.session,other.command()),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});assert.equal(other.updates(),0);
});
for(const option of [{assigned:false},{activeMembership:false}])test('private withdrawal preserves canonical revoked '+Object.keys(option)[0]+' denial',async()=>{
 const f=fixture(option);for(const fn of [()=>f.store.read(f.session,f.context),()=>f.store.command(f.session,f.command())])await assert.rejects(fn,{code:option.assigned===false?'WORKSPACE_PROJECT_UNAVAILABLE':'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal(f.updates(),0);
});
test('scope, tenant and serialized identity purpose cannot open private revocation authority',async()=>{
 const f=fixture();await assert.rejects(f.store.read(f.session,{...f.context,scope:'f'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});await assert.rejects(f.store.read({...f.session,organizationId:'org_Other'},f.context),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 for(const purpose of ['participant-own-identity',{identityOnly:true},true])await assert.rejects(f.workspace.projectOperation(f.session,f.context,false,()=>{},undefined,purpose),TypeError);
 const handlers=createWorkerChannelHandlers({verify:async()=>f.session,store:f.store}),url='https://obrasaas.com/api/identity/worker-channel';
 for(const extra of [{identityOnly:true},{purpose:'participant-own-identity'}])assert.equal((await handlers.POST(new Request(url,{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:JSON.stringify({...f.command(),...extra})}))).status,400);
 assert.equal((await handlers.GET(new Request(url+'?projectId='+f.context.projectId+'&scope='+f.context.scope+'&identityOnly=true'))).status,400);assert.equal(f.updates(),0);
});

for(const status of ['PENDING_REVIEW','REJECTED','APPROVED'])for(const action of ['REVOKE_TEMPLATE_MESSAGES','UNLINK'])test('active own worker keeps private '+action+' while '+status+' has no valid independent KYC admission',async()=>{
 const f=fixture({status,activeWorker:true,workerStatus:'ACTIVE',phone:'+5491100001111'});
 await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 const before=structuredClone(f.row.metadata.participant),value=await f.store.command(f.session,f.command(action));assert.equal(value.kind,action);assert.equal(value.participant.eligible,false);assert.equal(value.participant.templateConsent.canGrant,false);assert.equal(value.participant.challenge,null);assert.deepEqual(f.row.metadata.participant.kyc,before.kyc);assert.deepEqual(f.row.metadata.participant.permissions,before.permissions);assert.equal(f.updates(),1);
});
test('bootstrap ADMIN office remains available without a private identity exception',async()=>{
 const f=fixture({role:'ADMIN',activeWorker:true,workerStatus:'ACTIVE',phone:'+5491100001111'}),office=await f.workspace.read(f.session,f.context);assert.equal(office.canPlanSchedule,true);assert.equal(office.totalTasks,0);
 assert.equal(f.purposes.length,0);assert.equal(f.updates(),0);
});
