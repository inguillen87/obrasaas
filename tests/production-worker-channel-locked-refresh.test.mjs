import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWorkerChannelIdentity,refreshLockedWorkerChannelIdentity,releaseLockedWorkerChannelIdentity,decodeWorkerChannelProof} from '../src/lib/worker-channel-identity.mjs';
import {assertApprovedParticipantKyc} from '../src/lib/participant-approved-identity.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256} from '../src/lib/participant-kyc-image-set.mjs';

// The real signed canonical resolver and shared validators run against strict
// memory SQL adapters. No PostgreSQL, provider, private image or worker record
// outside this self-contained synthetic fixture is read or written.
function fixture({adopted=false,threeImages=false}={}){
 const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,37).toString('base64')},clock=Date.parse('2026-10-15T20:00:00.000Z');
 const member={actorId:'person-current',membershipId:'membership-current',organizationId:'organization-current',clerkUserId:'user_Current',role:'AUDITOR',clerkRole:'org:member',clerkOrganizationId:'org_Current',organizationName:'Synthetic company',organizationMetadata:{}};
 const project={id:'project-current',name:'Synthetic worksite',organizationId:member.organizationId,status:'ACTIVE',metadata:{}};
 const connection={id:'connection-current',projectId:project.id,organizationId:member.organizationId,whatsappBusinessId:'123450001',phoneNumberId:'123450002',enabled:true,connectionStatus:'CONNECTED',encryptedAccessToken:'v2.synthetic-credential',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:member.organizationId,customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:'owner-current'},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}}};
 const images=[['document-front','DOCUMENT_FRONT'],['selfie','SELFIE'],...(threeImages?[['document-back','DOCUMENT_BACK']]:[])].map(([id,kind])=>({id,kind,sha256:digest(id),bytes:20,contentType:'image/png',url:'https://fixture.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+digest(id)+'/image.png'}));
 const kyc={version:1,status:'APPROVED',submissionId:'submission-current',contentHash:digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images,review:{decision:'APPROVED',actorId:'reviewer-current',recordedAt:'2026-10-14T12:00:00.000Z'}};
 const worker={id:'worker-current',projectId:project.id,name:'Synthetic person',phone:'+5491100001111',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:member.clerkUserId,permissions:{attendance:true,report:true},kyc}},revision:'2026-10-15T19:00:00.000001'};
 const submission={id:'participant_'+'1'.repeat(64),organizationId:member.organizationId,actorId:member.actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:worker.id,metadata:{version:1,projectId:project.id,kind:'KYC_SUBMITTED',submissionId:kyc.submissionId,contentHash:kyc.contentHash}};
 const review={id:'participant_'+'2'.repeat(64),organizationId:member.organizationId,actorId:kyc.review.actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:worker.id,metadata:{version:1,projectId:project.id,kind:'REVIEW_KYC',submissionId:kyc.submissionId,decision:'APPROVED'}};
 const audits=[submission,review];
 if(adopted){
  const acceptanceReceiptId='participant_'+'3'.repeat(64),invitationId='invite_'+'4'.repeat(32),initial={version:1,kind:'META_KYC_CHAT',receiptId:submission.id,sourceDigest:'a'.repeat(64),challengeId:'challenge-current',invitationId,capturedParticipantClerkUserId:null,accountClaimRequired:true};
  worker.metadata.participant.invitation={id:invitationId,state:'ACCEPTED',email:'synthetic@example.invalid'};worker.metadata.participant.acceptanceReceiptId=acceptanceReceiptId;
  kyc.channelCapture={...initial,accountClaimRequired:false,claimedAt:'2026-10-14T11:00:00.000Z',claimedActorId:member.actorId,claimedClerkUserId:member.clerkUserId,acceptanceReceiptId};
  submission.actorId='issuer-original';Object.assign(submission.metadata,{status:'PENDING_ACCOUNT_CLAIM',channelCapture:initial});
  audits.push({id:acceptanceReceiptId,organizationId:member.organizationId,actorId:member.actorId,action:'participant.operation.recorded',entityType:'Worker',entityId:worker.id,metadata:{version:1,projectId:project.id,kind:'INVITATION_ACCEPTED',invitationId,requestDigest:digest([worker.id,invitationId,member.clerkUserId,worker.metadata.participant.invitation.email])}},{id:acceptanceReceiptId+'_kyc',organizationId:member.organizationId,actorId:member.actorId,action:'participant.kyc_chat.adopted',entityType:'Worker',entityId:worker.id,metadata:{version:1,projectId:project.id,submissionId:kyc.submissionId,contentHash:kyc.contentHash,captureReceiptId:submission.id,acceptanceReceiptId}});
 }
 if(threeImages){
  const version=adopted?PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_VERSION:PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,hash=adopted?PARTICIPANT_WHATSAPP_DOCUMENT_BACK_NOTICE_SHA256:PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256,submittedAt='2026-10-14T10:00:00.000Z';
  Object.assign(kyc,{noticeVersion:PARTICIPANT_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_NOTICE),consentRecorded:true,submittedAt,documentBackConsent:{allowed:true,noticeVersion:version,noticeSha256:hash,recordedAt:submittedAt},...(adopted?{captureImageSetVersion:2}:{})});
  Object.assign(submission.metadata,{noticeVersion:PARTICIPANT_NOTICE_VERSION,requestDigest:'b'.repeat(64),documentBackConsentRecorded:true,documentBackNoticeVersion:version,documentBackNoticeSha256:hash,...(adopted?{captureImageSetVersion:2,identityCertified:false,permissionsGranted:false,whatsAppAccessGranted:false}:{})});
 }
 function signed(label,body){
  const payload={wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,field:'messages',type:'message',value:{id:'wamid.SyntheticLockedRefresh'+label,from:'5491100001111',timestamp:String(clock/1000),type:'text',text:{body}}},externalId=digest([payload.wabaId,payload.phoneNumberId,'message',payload.value.id]),id='customer_webhook_'+externalId,payloadDigest=metaCustomerContentDigest(payload),aad={organizationId:member.organizationId,projectId:project.id,resourceId:id};
  return {id,projectId:project.id,provider:'meta-customer-v1',eventType:'message',externalId,status:'PENDING',leaseToken:'synthetic-current-lease',leaseExpiresAt:new Date(clock+60000),createdAt:new Date(clock),payload:{version:1,organizationId:member.organizationId,channelId:connection.id,payloadDigest,encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',appId:OBRASAAS_META_CHANNEL.appId,payloadDigest,channelId:connection.id,organizationId:member.organizationId}),{...aad,purpose:'webhook-proof'},environment)}};
 }
 const origin=signed('Origin','VINCULAR '+'A'.repeat(43)),event=signed('Current','MENU'),binding={version:1,id:'binding-current',status:'VERIFIED',workerId:worker.id,projectId:project.id,organizationId:member.organizationId,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:member.clerkUserId,senderE164:worker.phone,connectionId:connection.id,wabaId:connection.whatsappBusinessId,phoneNumberId:connection.phoneNumberId,kycSubmissionId:kyc.submissionId,kycReviewedAt:kyc.review.recordedAt,proofEventId:origin.id,proofExternalId:origin.externalId,proofPayloadDigest:origin.payload.payloadDigest};
 worker.metadata.participant.channelIdentity={version:1,binding};
 audits.push({id:'worker_channel_event_'+digest([origin.id,worker.id]),organizationId:member.organizationId,actorId:member.actorId,action:'worker.channel.identity.recorded',entityType:'Worker',entityId:worker.id,metadata:{kind:'CHANNEL_BOUND',projectId:project.id,bindingId:binding.id,proofPayloadDigest:binding.proofPayloadDigest}});
 const state={clock,transactionId:'10001',userPresent:true,membershipActive:true,projectMemberships:1,afterFacts:null,beforeSource:null},queries=[];
 const selectedProofs=()=>{
  const k=worker.metadata.participant.kyc,c=k.channelCapture,adopt=k.channelCapture!==undefined&&c?.invitationId!==null,ids=[c?.receiptId,c?.acceptanceReceiptId,c?.acceptanceReceiptId+'_kyc'];
  return audits.filter(a=>a.organizationId===member.organizationId&&a.entityId===worker.id).flatMap(a=>{
   const submissionProof=a.actorId===member.actorId&&a.action==='participant.operation.recorded'&&a.metadata.projectId===project.id&&a.metadata.kind==='KYC_SUBMITTED'&&a.metadata.submissionId===k.submissionId;
   const reviewProof=a.actorId===k.review?.actorId&&a.action==='participant.operation.recorded'&&a.metadata.projectId===project.id&&a.metadata.kind==='REVIEW_KYC'&&a.metadata.submissionId===k.submissionId&&a.metadata.decision==='APPROVED';
   const adoptionProof=ids.includes(a.id)||a.action==='participant.operation.recorded'&&a.metadata.projectId===project.id&&a.metadata.kind==='KYC_SUBMITTED'&&a.metadata.submissionId===k.submissionId;
   return reviewProof||(adopt?adoptionProof:submissionProof)?[{...structuredClone(a),reviewProof,submissionProof,adoptionProof}]:[];
  });
 };
 const client={async query(sql,args=[]){
  queries.push({sql,args});assert.doesNotMatch(sql,/^(?:UPDATE|INSERT|DELETE|CREATE|DROP)\b/,'This reader fixture never writes');
  const result=rows=>({rows:structuredClone(rows),rowCount:rows.length});
  if(sql.startsWith('WITH "workerChannelPrincipal"')){
   assert.deepEqual(args.slice(0,6),[member.actorId,member.clerkUserId,member.membershipId,member.organizationId,project.id,worker.id]);
   const rows=!state.userPresent||!state.membershipActive||project.status!=='ACTIVE'||args[6]!==state.transactionId?[]:Array.from({length:state.projectMemberships},()=>({user:{id:member.actorId,clerkUserId:member.clerkUserId},member:structuredClone(member),project:structuredClone(project),worker:structuredClone(worker),kycProofs:selectedProofs(),identityTransactionId:state.transactionId}));
   const value=result(rows);if(state.afterFacts)await state.afterFacts();return value;
  }
  if(sql.includes('clock_timestamp() AS now,pg_current_xact_id()::text AS "identityTransactionId"')){if(state.beforeSource)await state.beforeSource();return result([{...event,now:new Date(state.clock),identityTransactionId:state.transactionId}]);}
  if(sql.startsWith('SELECT to_regclass'))return result([{present:false,count:0}]);
  if(sql.startsWith('SELECT clock_timestamp() AS now'))return result([{now:new Date(state.clock),workerChannelTransactionId:state.transactionId}]);
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return result([]);
  if(sql.includes('FROM public."WhatsAppConnection"'))return result([connection]);
  if(sql.startsWith('SELECT w.id,w."projectId",w.metadata,u.id'))return result([{id:worker.id,actorId:member.actorId,clerkUserId:member.clerkUserId,membershipId:member.membershipId,organizationId:member.organizationId}]);
  if(sql.startsWith('SELECT id,"clerkUserId" FROM public."PlatformUser"'))return result(state.userPresent?[{id:member.actorId,clerkUserId:member.clerkUserId}]:[]);
  if(sql.includes('FROM public."TenantMembership" tm JOIN'))return result(state.membershipActive?[member]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return result(Array.from({length:state.projectMemberships},(_,index)=>({id:'pm-'+index})));
  if(sql.includes('FROM public."Project"'))return result(project.status==='ACTIVE'?[project]:[]);
  if(sql.includes('FROM public."Worker"'))return result([worker]);
  if(sql.includes('FROM public."WebhookEvent"'))return result([args[0]===origin.id?origin:event]);
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("kind'='CHANNEL_BOUND'"))return result(audits.filter(a=>a.id===args[0]));
   if(sql.includes('id=ANY'))return result(audits.filter(a=>a.organizationId===args[0]&&a.entityId===args[1]&&(args[2].includes(a.id)||a.action==='participant.operation.recorded'&&a.metadata.projectId===args[3]&&a.metadata.kind==='KYC_SUBMITTED'&&a.metadata.submissionId===args[4])));
   return result(audits.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityId===args[2]&&a.action==='participant.operation.recorded'&&a.metadata.projectId===args[3]&&a.metadata.submissionId===args[4]&&a.metadata.kind===(sql.includes("kind'='REVIEW_KYC'")?'REVIEW_KYC':'KYC_SUBMITTED')));
  }
  assert.fail('Unexpected strict synthetic SQL: '+sql);
 }};
 const resolve=options=>resolveWorkerChannelIdentity(client,{eventId:event.id,environment,...options});
 const refresh=(r,options={})=>refreshLockedWorkerChannelIdentity(client,r,{environment,...options});
 return {environment,member,worker,project,connection,event,origin,audits,state,queries,client,resolve,refresh,submission,review};
}

test('real signed canonical resolution mints a spread-preserving opaque handle and refreshes current facts in two SQL',async()=>{
 const f=fixture(),r=await f.resolve(),before=f.queries.length,spread={...r};
 f.worker.metadata.fieldChannelConversation={syntheticDraft:'new current value'};
 const current=await f.refresh(spread,{permission:'report'}),queries=f.queries.slice(before);
 assert.equal(queries.length,2);assert.ok(queries[0].sql.startsWith('WITH "workerChannelPrincipal"'));assert.match(queries[0].sql,/FOR SHARE OF u,tm,o,p,pm FOR UPDATE OF w/);assert.match(queries[0].sql,/ORDER BY a.id FOR SHARE OF a/);assert.match(queries[0].sql,/id=ANY\(ARRAY\[/);assert.match(queries[0].sql,/OR \(a.action='participant.operation.recorded'.*KYC_SUBMITTED/s);
 assert.doesNotMatch(queries[1].sql,/FOR (UPDATE|SHARE)/);assert.match(queries[1].sql,/clock_timestamp\(\) AS now/);assert.equal(current.now.getTime(),f.state.clock);assert.deepEqual(current.worker.metadata.fieldChannelConversation,{syntheticDraft:'new current value'});assert.equal(r.worker.metadata.fieldChannelConversation,undefined);assert.equal(current.member.clerkUserId,f.member.clerkUserId);
 assert.equal(releaseLockedWorkerChannelIdentity(current),true);assert.equal(releaseLockedWorkerChannelIdentity(r),false);const q=f.queries.length;await assert.rejects(f.refresh(spread),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});assert.equal(f.queries.length,q);
});

test('JSON clones, forged flags, changed principal/context/environment and another client fail before the refresh query',async t=>{
 for(const [label,change] of [['JSON',r=>JSON.parse(JSON.stringify(r))],['forged flags',r=>({...JSON.parse(JSON.stringify(r)),alreadyLocked:true,skipKyc:true})],['actor',r=>({...r,member:{...r.member,actorId:'foreign-person'}})],['worker',r=>({...r,worker:{...r.worker,id:'foreign-worker'}})],['project',r=>({...r,project:{...r.project,id:'foreign-project'}})],['source',r=>({...r,event:{...r.event,id:'foreign-event'}})],['binding',r=>({...r,channelBinding:{...r.channelBinding,id:'foreign-binding'}})],['connection',r=>({...r,connection:{...r.connection,id:'foreign-connection'}})]])await t.test(label,async()=>{const f=fixture(),r=await f.resolve(),q=f.queries.length;await assert.rejects(f.refresh(change(r)),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});assert.equal(f.queries.length,q);});
 const f=fixture(),r=await f.resolve(),q=f.queries.length;await assert.rejects(refreshLockedWorkerChannelIdentity({...f.client},r,{environment:f.environment}),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});await assert.rejects(f.refresh(r,{environment:{...f.environment}}),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});assert.equal(f.queries.length,q);
});

test('a caller-supplied decoder cannot mint the canonical fast path even when it delegates to the real decoder',async()=>{
 const f=fixture(),r=await f.resolve({decodeProof:(...args)=>decodeWorkerChannelProof(...args)}),q=f.queries.length;await assert.rejects(f.refresh(r),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});assert.equal(f.queries.length,q);
});

test('a pooled client in another transaction cannot reuse the handle',async()=>{
 const f=fixture(),r=await f.resolve(),q=f.queries.length;f.state.transactionId='10002';await assert.rejects(f.refresh(r),{code:'WORKER_CHANNEL_PARTICIPANT_REQUIRED'});assert.equal(f.queries.length-q,1);assert.match(f.queries.at(-1).sql,/pg_current_xact_id\(\)::text=\$7/);
});

test('fresh principal, assignment, worker permissions and binding are revalidated instead of memorized',async t=>{
 const cases=[['user removed',f=>{f.state.userPresent=false;},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['membership revoked',f=>{f.state.membershipActive=false;},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['assignment removed',f=>{f.state.projectMemberships=0;},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['assignment duplicated',f=>{f.state.projectMemberships=2;},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['project inactive',f=>{f.project.status='ARCHIVED';},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['organization internal',f=>{f.member.organizationMetadata.internal=true;},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['unknown role',f=>{f.member.role='UNTRUSTED';},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['worker revoked',f=>{f.worker.metadata.participant.status='REVOKED';},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['same worker reassigned',f=>{f.worker.metadata.participant.clerkUserId='user_Foreign';},'WORKER_CHANNEL_PARTICIPANT_REQUIRED'],['report revoked attendance current',f=>{f.worker.metadata.participant.permissions.report=false;},'WORKER_CHANNEL_PERMISSION_REQUIRED'],['binding changed',f=>{f.worker.metadata.participant.channelIdentity.binding.id='new-binding';},'WORKER_CHANNEL_BINDING_REQUIRED'],['sender and binding changed together',f=>{f.worker.phone='+5491100002222';f.worker.metadata.participant.channelIdentity.binding.senderE164=f.worker.phone;},'WORKER_CHANNEL_BINDING_REQUIRED']];
 for(const [label,change,code] of cases)await t.test(label,async()=>{const f=fixture(),r=await f.resolve();change(f);await assert.rejects(f.refresh(r,{permission:'report'}),{code});});
 const f=fixture(),r=await f.resolve();f.worker.metadata.participant.permissions.report=false;assert.equal((await f.refresh(r,{permission:'attendance'})).worker.metadata.participant.permissions.attendance,true);await assert.rejects(f.refresh(r,{permission:'approve'}),{code:'WORKER_CHANNEL_INPUT_INVALID'});
});

test('source and clock are read after the potentially waiting evidence query and preserve the original lease',async t=>{
 for(const [label,change] of [['expired before read',f=>{f.state.clock=f.event.leaseExpiresAt.getTime();}],['expiry during evidence await',f=>{f.state.afterFacts=async()=>{await Promise.resolve();f.state.clock=f.event.leaseExpiresAt.getTime()+1;};}],['source revoked',f=>{f.state.beforeSource=()=>{f.event.status='PROCESSED';};}],['claim changed',f=>{f.state.beforeSource=()=>{f.event.leaseToken='different-claim';};}],['lease extended',f=>{f.state.beforeSource=()=>{f.event.leaseExpiresAt=new Date(f.event.leaseExpiresAt.getTime()+1000);};}],['payload changed',f=>{f.state.beforeSource=()=>{f.event.payload.payloadDigest='f'.repeat(64);};}],['transaction changed after facts',f=>{f.state.beforeSource=()=>{f.state.transactionId='10003';};}]])await t.test(label,async()=>{const f=fixture(),r=await f.resolve(),q=f.queries.length;change(f);await assert.rejects(f.refresh(r),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.queries.length-q,2);});
 const f=fixture(),r=await f.resolve();f.state.afterFacts=async()=>{await Promise.resolve();f.state.clock+=1000;};assert.equal((await f.refresh(r)).now.getTime(),f.state.clock);
});

test('ordinary and adopted evidence both use the existing strict validators on every fresh read',async t=>{
 for(const adopted of [false,true])for(const threeImages of [false,true])await t.test('valid '+(adopted?'adopted':'own')+' '+(threeImages?'three':'two')+' images',async()=>{const f=fixture({adopted,threeImages}),r=await f.resolve();assert.equal((await f.refresh(r)).worker.id,f.worker.id);});
 for(const [label,change] of [['review removed',f=>{f.audits.splice(f.audits.indexOf(f.review),1);}],['duplicate review',f=>{f.audits.push({...structuredClone(f.review),id:'participant_'+'9'.repeat(64)});}],['submission removed',f=>{f.audits.splice(f.audits.indexOf(f.submission),1);}],['content changed',f=>{f.submission.metadata.contentHash='f'.repeat(64);}],['unapproved',f=>{f.worker.metadata.participant.kyc.status='PENDING_REVIEW';}],['self review',f=>{f.worker.metadata.participant.kyc.review.actorId=f.member.actorId;}],['three-image consent removed',f=>{delete f.submission.metadata.documentBackConsentRecorded;}]])await t.test(label,async()=>{const f=fixture({threeImages:true}),r=await f.resolve();change(f);await assert.rejects(f.refresh(r),{code:'WORKER_CHANNEL_KYC_REVIEW_REQUIRED'});});
 for(const [label,change] of [['fourth matching submission',f=>{f.audits.push({...structuredClone(f.submission),id:'participant_'+'9'.repeat(64)});}],['adoption removed',f=>{f.audits.splice(f.audits.findIndex(a=>a.action==='participant.kyc_chat.adopted'),1);}],['acceptance wrong actor',f=>{f.audits.find(a=>a.metadata.kind==='INVITATION_ACCEPTED').actorId='foreign-person';}],['original capture changed',f=>{f.submission.metadata.channelCapture.sourceDigest='f'.repeat(64);}],['back notice changed',f=>{f.submission.metadata.documentBackNoticeSha256='f'.repeat(64);}]])await t.test('adopted '+label,async()=>{const f=fixture({adopted:true,threeImages:true}),r=await f.resolve();change(f);await assert.rejects(f.refresh(r),{code:'WORKER_CHANNEL_KYC_REVIEW_REQUIRED'});});
});

test('the ordinary approved-KYC reader keeps the nonlocking READ ONLY path and its original proof selection',async()=>{
 for(const adopted of [false,true]){const f=fixture({adopted,threeImages:true}),q=f.queries.length;assert.equal((await assertApprovedParticipantKyc(f.client,f.worker,f.member)).status,'ACTIVE');const reads=f.queries.slice(q);assert.equal(reads.length,2);assert.ok(reads.every(query=>!query.sql.includes('FOR SHARE')&&!query.sql.includes('FOR UPDATE')));if(adopted){assert.match(reads[1].sql,/id=ANY\(\$3::text\[\]\) OR/);f.audits.push({...structuredClone(f.submission),id:'participant_'+'8'.repeat(64)});await assert.rejects(assertApprovedParticipantKyc(f.client,f.worker,f.member),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});}}
});
