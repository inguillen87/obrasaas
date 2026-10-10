import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {participantKycInput,participantReceiptId,PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {scopeStamp,digest} from '../src/lib/workspace-policy.mjs';

// Canonical Workspace/Participant/HTTP implementations, with the SQL and Blob
// boundary simulated in memory. No real JWT, database, storage or provider is used.
const picture='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
function fixture({role='SITE_MANAGER',concurrent=false,change='REVOKED'}={}){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_ReplayFixture',organizationId:'org_ReplayFixture',organizationRole:'org:member'};
 const member={actorId:'actor-fixture',membershipId:'membership-fixture',organizationId:'company-fixture',organizationName:'Synthetic company',role};
 const projectId='project-fixture',scope=scopeStamp(session,member),operationId=randomUUID();
 const body={operationId,projectId,scope,workerId:'worker-fixture',revision:'2026-10-01T00:00:00.000001',noticeVersion:PARTICIPANT_NOTICE_VERSION,consent:true,front:picture,selfie:picture};
 const input=participantKycInput(body),requestDigest=digest([input.projectId,input.scope,input.workerId,input.revision,input.noticeVersion,input.front.digest,input.selfie.digest]);
 const recorded={id:participantReceiptId(member.actorId,projectId,operationId),organizationId:member.organizationId,entityType:'Worker',entityId:body.workerId,metadata:{version:1,projectId,kind:'KYC_SUBMITTED',requestDigest}};
 const row={id:body.workerId,projectId,name:'Synthetic participant',active:true,revision:body.revision,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:true,report:false},invitation:null,kyc:{status:'NOT_SUBMITTED',submissionId:null,images:[]}}}};
 const counts={sql:[],receiptReads:0,symbolicUploads:0,realProviderRequests:0,businessWrites:0},project={id:projectId,name:'Synthetic project',status:'ACTIVE',metadata:{},organizationMetadata:{}};
 let visibleReceipt=!concurrent;
 function changeCurrent(){
  row.revision='2026-10-01T00:00:00.000002';
  row.metadata.participant.kyc={status:'APPROVED',submissionId:'kyc-fixture',submittedAt:'2026-10-01T00:00:00.000Z',review:{decision:'APPROVED',reason:'Synthetic current private review.',recordedAt:'2026-10-01T00:00:01.000Z'},images:['document-front','selfie'].map((id,index)=>({id,kind:index?'SELFIE':'DOCUMENT_FRONT',contentType:'image/png',bytes:input.front.bytes.length,sha256:input.front.digest,url:'https://fixture.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+'a'.repeat(64)+'/image.png'}))};
  if(change==='REVOKED')row.metadata.participant.status='REVOKED';
  if(change==='INACTIVE')row.active=false;
 }
 if(!concurrent)changeCurrent();
 const connect=async()=>({release(){},query:async(sql,args)=>{
  counts.sql.push(sql);assert.ok(/^(SELECT|BEGIN|SET LOCAL|ROLLBACK|COMMIT)/.test(sql),'No product INSERT/UPDATE/DELETE is allowed in this reproduction');
  if(/^(BEGIN|SET LOCAL|ROLLBACK|COMMIT)/.test(sql))return {rows:[]};
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership" m')){assert.deepEqual(args,[session.userId,session.organizationId,session.organizationRole]);return {rows:[member]};}
  if(sql.includes('SELECT id,name,status::text AS status FROM public."Project"')){assert.deepEqual(args,[projectId,member.organizationId]);return {rows:[project]};}
  if(sql.includes('FROM public."ProjectMembership"')){assert.deepEqual(args,[projectId,member.membershipId]);return {rows:[{id:'project-membership-fixture'}]};}
  if(sql.includes('SELECT p.id,p.name,p.metadata,o.metadata')){assert.deepEqual(args,[projectId,member.organizationId]);return {rows:[project]};}
  if(sql.includes('FROM public."AuditLog"')){assert.deepEqual(args,[recorded.id,member.organizationId,member.actorId]);counts.receiptReads++;return {rows:visibleReceipt?[recorded]:[]};}
  if(sql.includes('FROM public."Worker"')){if(sql.includes('JOIN public."Project"'))assert.deepEqual(args,[member.organizationId,session.userId]);else if(sql.includes('WHERE "projectId"=$1'))assert.deepEqual(args,[projectId,session.userId]);else assert.deepEqual(args,[row.id,projectId]);return {rows:[structuredClone(row)]};}
  if(sql.includes('SELECT m.id FROM public."TenantMembership"')){assert.deepEqual(args,[member.membershipId,member.organizationId,session.userId,projectId]);return {rows:[{id:member.membershipId}]};}
  assert.fail('Unexpected canonical SQL: '+sql);
 }});
 const forbidden=()=>assert.fail('No real identity or private storage request is permitted');
 const store=createParticipantStore({workspace:createWorkspaceStore({connect}),connect,identity:{createInvitation:forbidden,findInvitation:forbidden,verifiedEmail:forbidden,verifyMembership:forbidden},get:forbidden,upload:async()=>{
  assert.equal(concurrent,true,'A cached replay must not call upload');counts.symbolicUploads++;
  if(counts.symbolicUploads===2){visibleReceipt=true;changeCurrent();}
  // Symbolic return value only: no bytes are stored or sent anywhere.
  return 'https://fixture.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+'a'.repeat(64)+'/image.png';
 }});
 const handlers=createParticipantHandlers({verify:async()=>session,store});
 const request=(params,options)=>new Request('https://obrasaas.com/api/identity/participants'+(params?'?'+new URLSearchParams(params):''),options);
 const post=(payload=body)=>handlers.POST(request(null,{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(payload)}));
 const status=()=>handlers.GET(request({projectId,scope,operationId}));
 const download=()=>handlers.GET(request({projectId,scope,workerId:row.id,imageId:'selfie'}));
 return {body,row,recorded,counts,member,post,status,download};
}

function privateHeaders(response){
 assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(response.headers.get('vary'),'Cookie, Authorization');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
}

for(const concurrent of [false,true])for(const change of ['REVOKED','INACTIVE'])test(`${concurrent?'concurrent':'cached'} KYC receipt replay must retain current participant gate: ${change}`,async()=>{
 const f=fixture({concurrent,change,role:change==='REVOKED'?'SITE_MANAGER':'FINANCE'});
 if(!concurrent){for(const read of [f.status,f.download]){const denied=await read();assert.equal(denied.status,403);assert.equal((await denied.json()).code,'PARTICIPANT_ACCESS_REQUIRED');}}
 const replay=await f.post(),result=await replay.json();privateHeaders(replay);
 const deniedStatus=await f.status(),deniedDownload=await f.download();assert.equal(deniedStatus.status,403);assert.equal(deniedDownload.status,403);
 assert.equal(f.counts.symbolicUploads,concurrent?2:0);assert.equal(f.counts.businessWrites,0);
 assert.equal(replay.status,403,'POST retry must deny the same current state that receipt GET and private download deny');assert.equal(result.code,'PARTICIPANT_ACCESS_REQUIRED');assert.equal(result.participant,undefined);
});

for(const concurrent of [false,true])test(`${concurrent?'concurrent':'cached'} active owned receipt stays recoverable after revision and KYC-state changes`,async()=>{
 const f=fixture({concurrent,change:'ACTIVE'}),response=await f.post(),result=await response.json();privateHeaders(response);assert.equal(response.status,200);assert.equal(result.saved,true);assert.equal(result.replayed,true);assert.equal(result.receiptId,f.recorded.id);assert.equal(result.participant.revision,'2026-10-01T00:00:00.000002');assert.equal(result.participant.kyc.status,'APPROVED');assert.equal(result.participant.permissions.report,false);assert.equal(result.participant.kyc.images.length,2);assert.equal(JSON.stringify(result).includes('.private.blob.'),false);assert.ok(f.counts.receiptReads>0);assert.equal(f.counts.symbolicUploads,concurrent?2:0);assert.equal(f.counts.businessWrites,0);assert.equal(f.counts.realProviderRequests,0);
});

for(const concurrent of [false,true])for(const corrupt of ['entity','entity-type','kind','project'])test(`${concurrent?'concurrent':'cached'} KYC replay rejects a canonical receipt with wrong ${corrupt}`,async()=>{
 const f=fixture({concurrent,change:'ACTIVE'});if(corrupt==='entity')f.recorded.entityId='other-worker';if(corrupt==='entity-type')f.recorded.entityType='TenantMembership';if(corrupt==='kind')f.recorded.metadata.kind='REVIEW_KYC';if(corrupt==='project')f.recorded.metadata.projectId='other-project';
 const response=await f.post(),result=await response.json();privateHeaders(response);assert.equal(response.status,409);assert.equal(result.code,'PARTICIPANT_RECEIPT_INVALID');assert.equal(result.participant,undefined);assert.equal(f.counts.symbolicUploads,concurrent?2:0);assert.equal(f.counts.businessWrites,0);
});

test('a role change rejects the old scope before looking up an own KYC receipt',async()=>{
 const f=fixture({change:'ACTIVE'});f.member.role='FINANCE';const response=await f.post(),result=await response.json();privateHeaders(response);assert.equal(response.status,409);assert.equal(result.code,'WORKSPACE_CONTEXT_CHANGED');assert.equal(f.counts.receiptReads,0);assert.equal(f.counts.symbolicUploads,0);
});
test('a client supplied foreign scope cannot read a correlated own receipt',async()=>{
 const f=fixture({change:'ACTIVE'}),response=await f.post({...f.body,scope:'f'.repeat(64)}),result=await response.json();privateHeaders(response);assert.equal(response.status,409);assert.equal(result.code,'WORKSPACE_CONTEXT_CHANGED');assert.equal(f.counts.receiptReads,0);assert.equal(f.counts.symbolicUploads,0);
});
