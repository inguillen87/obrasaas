import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticipantChannelKycDeposit,adoptParticipantChannelKyc} from '../src/lib/participant-channel-kyc.mjs';
import {PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {metaKycOperationId} from '../src/lib/meta-kyc-challenge.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';

const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
function fixture(status='INVITED'){
 const eventId='customer_webhook_'+'e'.repeat(64),source={kind:'META_KYC_CHAT',eventId,payloadDigest:'f'.repeat(64),challengeId:'challenge-fixture',connectionId:'connection-fixture',wabaId:'222222',phoneNumberId:'333333',senderE164:'+541155555555'},row={id:'worker-fixture',projectId:'project-fixture',organizationId:'company-fixture',active:true,revision:'2026-10-01T00:00:00.000001',metadata:{unrelated:{keep:true},participant:{version:1,status,clerkUserId:status==='ACTIVE'?'user_Participant':null,permissions:{attendance:false,report:false},invitation:{id:'invite-fixture',state:'SENT'},kyc:{status:'NOT_SUBMITTED'}}}};
 const state={step:'FINALIZING',confirmationEventId:eventId,consent:true,noticeVersion:PARTICIPANT_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_NOTICE),ocrConsent:false,ocrNoticeVersion:PARTICIPANT_OCR_NOTICE_VERSION,ocrNoticeSha256:digest(PARTICIPANT_OCR_NOTICE),front:{eventId:'event-front',mediaId:'11111'},selfie:{eventId:'event-selfie',mediaId:'22222'}};
 const r={kind:'LIMITED_KYC_UPLOAD',worker:row,member:{actorId:status==='ACTIVE'?'actor-worker':'actor-manager',organizationId:'company-fixture',clerkUserId:status==='ACTIVE'?'user_Participant':undefined},project:{id:'project-fixture',organizationId:'company-fixture'},challenge:{id:source.challengeId,invitationId:'invite-fixture',issuerActorId:'actor-manager',issuerMembershipId:'member-manager'},state,source};
 const receipts=new Map(),events=[],counts={resolve:0,upload:0,release:0};let resolveChange,uploadChange,revision=1;
 const client={release:()=>counts.release++,query:async(sql,args)=>{
  events.push(sql);
  if(/^(?:BEGIN|COMMIT|ROLLBACK|SET LOCAL|SELECT pg_advisory)/.test(sql))return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date('2026-10-05T00:00:00Z')}]};
  if(sql.includes('FROM public."AuditLog"'))return {rows:receipts.has(args[0])?[structuredClone(receipts.get(args[0]))]:[]};
  if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[0],row.id);assert.equal(args[1],row.projectId);row.metadata=JSON.parse(args[2]);row.revision='2026-10-01T00:00:00.'+String(++revision).padStart(6,'0');return {rows:[]};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!receipts.has(args[0]));receipts.set(args[0],{id:args[0],entityType:'Worker',entityId:args[3],metadata:JSON.parse(args[4])});return {rows:[]};}
  assert.fail('Unexpected SQL '+sql);
 }};
 const adapter=createParticipantChannelKycDeposit({connect:async()=>client,resolveAuthority:async(_client,context,options)=>{counts.resolve++;assert.deepEqual(context,{eventId});assert.equal(options.deposit,true);resolveChange?.(counts.resolve);return structuredClone(r);},upload:async(_bytes,filename,type)=>{counts.upload++;assert.equal(type,'image/png');uploadChange?.(counts.upload);return 'https://fixture.private.blob.vercel-storage.com/obrasaas/legacy-images/v1/'+digest(filename)+'/image.png';},environment:{}});
 const body={operationId:metaKycOperationId(eventId),noticeVersion:state.noticeVersion,noticeSha256:state.noticeSha256,consent:true,ocrConsent:false,ocrNoticeVersion:state.ocrNoticeVersion,front:image,selfie:image};
 return {adapter,body,context:{eventId},row,r,receipts,counts,events,client,setResolve:fn=>resolveChange=fn,setUpload:fn=>uploadChange=fn};
}
for(const status of ['INVITED','ACTIVE'])test('limited signed-channel '+status+' capture is canonical and never grants access',async()=>{
 const f=fixture(status),result=await f.adapter.deposit(f.context,f.body);assert.equal(result.status,status==='INVITED'?'PENDING_ACCOUNT_CLAIM':'PENDING_REVIEW');assert.equal(result.identityCertified,false);assert.equal(result.permissionsGranted,false);assert.equal(result.whatsAppAccessGranted,false);assert.equal(f.counts.resolve,2);assert.equal(f.counts.upload,2);assert.equal(f.row.metadata.participant.status,status);assert.deepEqual(f.row.metadata.participant.permissions,{attendance:false,report:false});assert.deepEqual(f.row.metadata.unrelated,{keep:true});assert.equal(f.row.metadata.participant.kyc.ocrConsent.allowed,false);
 assert.doesNotMatch(JSON.stringify([...f.receipts.values()]),/541155555555|senderE164|data:image|\.private\.blob|mediaId/);assert.equal(f.events.some(sql=>/(?:INSERT|UPDATE).*"(?:PlatformUser|TenantMembership|ProjectMembership|Attendance|Task)"/.test(sql)),false);
 const replay=await f.adapter.deposit(f.context,f.body);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,result.receiptId);assert.equal(f.counts.upload,2);
});
for(const allowed of [false,true])test('chat biometric authorization is separately pinned: '+allowed,async()=>{const f=fixture();Object.assign(f.r.state,{biometricConsent:allowed,biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,biometricNoticeSha256:digest(PARTICIPANT_BIOMETRIC_NOTICE)});Object.assign(f.body,{biometricConsent:allowed,biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION});await f.adapter.deposit(f.context,f.body);assert.equal(f.row.metadata.participant.kyc.biometricConsent.allowed,allowed);assert.equal(f.row.metadata.participant.kyc.processing,undefined);});
test('chat caller cannot opt into biometrics without the sealed conversational choice',async()=>{const f=fixture();Object.assign(f.body,{biometricConsent:true,biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION});await assert.rejects(f.adapter.deposit(f.context,f.body),{code:'META_KYC_DEPOSIT_REQUIRED'});assert.equal(f.counts.upload,0);});
for(const mode of ['worker-input','consent','notice','ocr','operation','bad-image'])test('chat deposit rejects forged input before storage: '+mode,async()=>{
 const f=fixture();if(mode==='worker-input')f.body.workerId='worker-other';if(mode==='consent')f.body.consent=false;if(mode==='notice')f.body.noticeSha256='a'.repeat(64);if(mode==='ocr')f.body.ocrConsent=true;if(mode==='operation')f.body.operationId='11111111-1111-4111-a111-111111111111';if(mode==='bad-image')f.body.selfie='data:image/png;base64,YmFk';await assert.rejects(f.adapter.deposit(f.context,f.body));assert.equal(f.counts.upload,0);assert.equal(f.receipts.size,0);
});
for(const mode of ['revoked','actor','source','revision','lease'])test('final canonical resolver fences a changed '+mode,async()=>{
 const f=fixture();f.setResolve(count=>{if(count!==2)return;if(mode==='revoked')f.row.metadata.participant.status='REVOKED';if(mode==='actor')f.r.member.actorId='actor-other';if(mode==='source')f.r.source.payloadDigest='a'.repeat(64);if(mode==='revision')f.row.revision='2026-10-01T00:00:00.999999';if(mode==='lease')throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);});await assert.rejects(f.adapter.deposit(f.context,f.body));assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.ok(f.events.includes('ROLLBACK'));
});
test('resolver denial occurs before any Blob write and raw exceptions are redacted',async()=>{const f=fixture();f.setResolve(()=>{throw new Error('PRIVATE_PHONE_541155555555');});await assert.rejects(f.adapter.deposit(f.context,f.body),{code:'PARTICIPANT_OPERATION_UNCONFIRMED',message:'PARTICIPANT_OPERATION_UNCONFIRMED'});assert.equal(f.counts.upload,0);});
test('same signed event concurrent completion preserves a single presentation',async()=>{
 const f=fixture();let first;f.setUpload(count=>{if(count===1)first=f.adapter.deposit(f.context,f.body);});const original=await f.adapter.deposit(f.context,f.body);const concurrent=await first;assert.equal(original.receiptId,concurrent.receiptId);assert.equal(f.receipts.size,1);
});
test('captured invitation KYC is adopted only after explicit canonical account acceptance',async()=>{
 const f=fixture();await f.adapter.deposit(f.context,f.body);const participant=f.row.metadata.participant;participant.status='ACTIVE';participant.clerkUserId='user_Participant';participant.invitation.state='ACCEPTED';const capture=participant.kyc.channelCapture.receiptId,key='participant_'+'a'.repeat(64);
 assert.equal(await adoptParticipantChannelKyc(f.client,{row:f.row,participant,invitationId:'invite-fixture',actorId:'actor-worker',clerkUserId:'user_Participant',acceptanceReceiptId:key}),true);assert.equal(participant.kyc.status,'PENDING_REVIEW');assert.equal(participant.kyc.channelCapture.accountClaimRequired,false);assert.equal(participant.kyc.processing,undefined);assert.equal(f.receipts.get(key+'_kyc').metadata.captureReceiptId,capture);assert.doesNotMatch(JSON.stringify(f.receipts.get(key+'_kyc')),/user_Participant|data:image|senderE164/);
 assert.equal(await adoptParticipantChannelKyc(f.client,{row:f.row,participant,invitationId:'invite-fixture',actorId:'actor-worker',clerkUserId:'user_Participant',acceptanceReceiptId:key}),false);
});
for(const mode of ['not-accepted','wrong-invitation','tampered-hash','missing-receipt'])test('adoption refuses '+mode,async()=>{
 const f=fixture();await f.adapter.deposit(f.context,f.body);const p=f.row.metadata.participant;if(mode!=='not-accepted'){p.status='ACTIVE';p.clerkUserId='user_Participant';p.invitation.state='ACCEPTED';}if(mode==='tampered-hash')p.kyc.contentHash='a'.repeat(64);if(mode==='missing-receipt')f.receipts.clear();await assert.rejects(adoptParticipantChannelKyc(f.client,{row:f.row,participant:p,invitationId:mode==='wrong-invitation'?'invite-other':'invite-fixture',actorId:'actor-worker',clerkUserId:'user_Participant',acceptanceReceiptId:'participant_'+'a'.repeat(64)}));assert.equal(p.kyc.status,'PENDING_ACCOUNT_CLAIM');
});
