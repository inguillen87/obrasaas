import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveParticipantOnboardingAuthority} from '../src/lib/participant-onboarding-authority.mjs';
import {companyKycGrantDigest} from '../src/lib/company-channel-kyc.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

// Explicit synthetic SQL facts test the canonical resolver, not provider I/O.
// PostgreSQL concurrency/constraint validation belongs to the integration run.
import {participantOnboardingAuthorityFixture as fixture} from './fixtures/participant-onboarding-authority-memory.mjs';

const resolve=f=>resolveParticipantOnboardingAuthority(f.client,f.intent);
const expected=r=>({authorityDigest:r.authorityDigest});

test('pre-KYC corporate authority preserves anchor A and Worker B with no operational grants',async()=>{
 const f=fixture(),before=structuredClone(f.worker);const r=await resolve(f);
 assert.equal(r.company,true);assert.equal(r.connection.projectId,f.anchor.id);assert.equal(r.project.id,f.project.id);assert.equal(r.worker.projectId,f.project.id);assert.equal(r.entitlement.basis,'CURRENT_TRIAL');assert.match(r.authorityDigest,/^[a-f0-9]{64}$/);
 assert.equal(r.member.organizationName,f.organization.name);
 assert.deepEqual(f.worker,before);assert.equal(r.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.deepEqual(r.worker.metadata.participant.permissions,{attendance:false,report:false});
 const q=f.controls.queries,issuerLock=q.findIndex(q=>q.sql.includes('FROM public."PlatformUser"')&&q.sql.includes('FOR SHARE')),journey=q.findIndex(q=>q.sql.includes('pg_advisory_xact_lock')),projectLocks=q.filter(q=>q.sql.includes('FROM public."Project"')&&q.sql.includes('FOR UPDATE'));
 assert.ok(issuerLock<journey);assert.deepEqual(projectLocks.slice(0,2).map(q=>q.args[0]),[f.anchor.id,f.project.id]);
 assert.ok(q.indexOf(projectLocks[1])<q.findIndex(q=>q.sql.includes('FROM public."Worker"')&&q.sql.includes('FOR UPDATE')));assert.equal(q.at(-1).sql,'SELECT clock_timestamp() AS now');
 const same=await resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:expected(r)});assert.equal(same.authorityDigest,r.authorityDigest);
});

test('legacy project-only customer authority uses its original credential anchor',async()=>{
 const f=fixture({company:false}),r=await resolve(f);assert.equal(r.company,false);assert.equal(r.connection.projectId,f.project.id);assert.equal(r.entitlement.allowed,true);
});

test('project-only ownership remains pinned when the corporate catalog exists',async()=>{
 const f=fixture({company:false});f.controls.schema=true;f.owner.mode='PROJECT_ONLY';const first=await resolve(f);
 assert.equal(first.company,false);assert.equal(first.connection.projectOnlyOwner.revision,f.owner.revision);
 f.owner.revision++;await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:expected(first)}),{code:'PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED'});
});

test('ACTIVE accepted own account requires exact acceptance and current project membership',async()=>{
 const f=fixture({active:true}),r=await resolve(f);assert.equal(r.worker.metadata.participant.clerkUserId,f.own.clerkUserId);
 const ownLock=f.controls.queries.findIndex(q=>q.sql.includes('FROM public."PlatformUser"')&&q.args[0]===f.own.clerkUserId),firstProjectLock=f.controls.queries.findIndex(q=>q.sql.includes('FROM public."Project"')&&q.sql.includes('FOR UPDATE'));assert.ok(ownLock>=0&&ownLock<firstProjectLock);
 f.audit.get('acceptance_original').metadata.invitationId='invite_'+'2'.repeat(32);await assert.rejects(resolve(f),{code:'PARTICIPANT_ONBOARDING_ACCEPTANCE_REQUIRED'});
});

for(const [label,mutate,code] of [
 ['foreign tenant',f=>{f.intent.organizationId='organization_other';},'PARTICIPANT_ONBOARDING_PRINCIPAL_REQUIRED'],
 ['revoked issuer',f=>{f.controls.issuerActive=false;},'PARTICIPANT_ONBOARDING_PRINCIPAL_REQUIRED'],
 ['non-manager issuer',f=>{f.issuer.role='SITE_MANAGER';},'PARTICIPANT_MANAGE_REQUIRED'],
 ['internal organization',f=>{f.organization.metadata.internal=true;},'PARTICIPANT_ONBOARDING_ORGANIZATION_REQUIRED'],
 ['archived target',f=>{f.controls.projectActive=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['inactive Worker',f=>{f.worker.active=false;},'PARTICIPANT_ONBOARDING_PARTICIPANT_REQUIRED'],
 ['replaced invitation',f=>{f.invitation.id='invite_'+'2'.repeat(32);},'PARTICIPANT_ONBOARDING_PARTICIPANT_REQUIRED'],
 ['foreign original issuer',f=>{f.invitation.createdBy='actor_other';},'PARTICIPANT_ONBOARDING_PARTICIPANT_REQUIRED'],
 ['Clerk invitation unconfirmed',f=>{f.invitation.state='ATTEMPTED';},'PARTICIPANT_ONBOARDING_PARTICIPANT_REQUIRED'],
 ['foreign SENT receipt',f=>{f.audit.get('sent_original').metadata.projectId=f.anchor.id;},'PARTICIPANT_ONBOARDING_INVITATION_REQUIRED'],
 ['SENT receipt for different request',f=>{f.audit.get('sent_original').metadata.requestDigest='e'.repeat(64);},'PARTICIPANT_ONBOARDING_INVITATION_REQUIRED'],
 ['withdrawn contact consent',f=>{f.consent.status='REVOKED';},'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'],
 ['operational consent substituted',f=>{f.consent.purpose='worksite-operational-templates';},'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'],
 ['unknown notice',f=>{f.consent.noticeSha256='f'.repeat(64);f.audit.get(f.consent.receiptId).metadata.noticeSha256=f.consent.noticeSha256;},'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'],
 ['foreign consent phone',f=>{f.audit.get(f.consent.receiptId).metadata.senderE164='+5492212000002';},'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'],
 ['consent receipt missing',f=>{f.audit.delete(f.consent.receiptId);},'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED'],
 ['duplicate recipient',f=>{f.controls.duplicate=true;},'PARTICIPANT_ONBOARDING_RECIPIENT_AMBIGUOUS'],
 ['already submitted KYC',f=>{f.worker.metadata.participant.kyc.status='PENDING_REVIEW';},'PARTICIPANT_ONBOARDING_KYC_ALREADY_SUBMITTED'],
 ['unknown KYC version',f=>{f.worker.metadata.participant.kyc.version=2;},'PARTICIPANT_ONBOARDING_KYC_ALREADY_SUBMITTED'],
 ['captured NOT_SUBMITTED metadata',f=>{f.worker.metadata.participant.kyc.channelCapture={challengeId:'kyc_chat_'+'4'.repeat(32)};},'PARTICIPANT_ONBOARDING_KYC_ALREADY_SUBMITTED'],
 ['trial expired',f=>{f.organization.trialEndsAt=new Date(f.now);},'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'],
 ['subscription suspended',f=>{f.organization.subscriptionStatus='SUSPENDED';},'COMPANY_ENTITLEMENT_SUSPENDED'],
 ['disabled channel',f=>{f.connection.enabled=false;},'WORKER_CHANNEL_CUSTOMER_ACTIVATION_REQUIRED'],
 ['pilot channel',f=>{f.connection.metadata.developmentPilot={};},'META_KYC_COMPANY_ADAPTER_UNAVAILABLE'],
 ['suspended owner',f=>{f.owner.mode='SUSPENDED';},'META_KYC_COMPANY_ADAPTER_UNAVAILABLE'],
 ['revoked corporate assignment cannot fall back',f=>{f.controls.assignment=false;},'PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED'],
])test(label+' denies onboarding before any write',async()=>{
 const f=fixture();mutate(f);const before=structuredClone(f.worker);await assert.rejects(resolve(f),{code});assert.deepEqual(f.worker,before);
});

for(const [label,mutate] of [
 ['token rotation',f=>{f.connection.encryptedAccessToken='v2.rotated.scope.token';}],
 ['phone-number asset changed',f=>{f.connection.phoneNumberId='123456789003';}],
 ['WABA changed',f=>{f.connection.whatsappBusinessId='123456789004';}],
 ['owner revision changed',f=>{f.owner.revision++;}],
 ['assignment revoked and restored',f=>{f.owner.assignmentRevision++;}],
 ['issuer role changed and restored',f=>{f.issuer.revision='2026-10-07T06:10:00.000000';}],
 ['revocation trail appended',f=>{f.audit.set('revocation',{id:'revocation',organizationId:f.organization.id,entityType:'Worker',entityId:f.worker.id,action:'participant.operation.recorded',metadata:{kind:'REVOKE'}});}],
 ['new consent authorization',f=>{f.consent.recordedAt=new Date(f.now.getTime()-30000).toISOString();f.audit.get(f.consent.receiptId).metadata.recordedAt=f.consent.recordedAt;}],
 ['company name changed',f=>{f.organization.name='New company name';}],
])test('pinned authority refuses '+label+' without retargeting',async()=>{
 const f=fixture(),first=await resolve(f);mutate(f);await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:expected(first)}),{code:'PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED'});
});

function challenge(f){
 return {version:1,id:'kyc_chat_'+'3'.repeat(32),status:'PENDING',codeDigest:'c'.repeat(64),organizationId:f.organization.id,projectId:f.project.id,workerId:f.worker.id,senderE164:f.worker.phone,connectionId:f.connection.id,wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId,issuerActorId:f.issuer.actorId,issuerMembershipId:f.issuer.membershipId,participantClerkUserId:f.worker.metadata.participant.clerkUserId,invitationId:f.invitation.id,createdAt:f.now.toISOString(),expiresAt:new Date(f.now.getTime()+60000).toISOString(),companyKyc:{version:1,anchorProjectId:f.anchor.id,targetProjectId:f.project.id,ownerRevision:f.owner.revision,assignmentRevision:f.owner.assignmentRevision,grantDigest:companyKycGrantDigest(f.connection),issuerAuthorityDigest:'d'.repeat(64)}};
}

function storeChallenge(f){
 const c=challenge(f);f.worker.metadata.participant.kycChatChallenge=c;
 f.audit.set('challenge_original',{id:'challenge_original',organizationId:f.organization.id,actorId:f.issuer.actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.kyc_chat.prepared',metadata:{version:1,projectId:f.project.id,challengeId:c.id,expiresAt:c.expiresAt,requestDigest:digest([f.project.id,f.worker.id,f.worker.revision]),identityCertified:false,permissionsGranted:false}});
 return c;
}

function rejectedSubmission(f){
 const p=f.worker.metadata.participant,c={...challenge(f),id:'kyc_chat_'+'4'.repeat(32),status:'COMPLETED'};
 p.kyc={version:1,status:'REJECTED',submissionId:'kyc_historical',contentHash:'a'.repeat(64),images:[{id:'image_document_private'},{id:'image_selfie_private'}],review:{decision:'REJECTED',reason:'Documento ilegible',actorId:f.issuer.actorId,recordedAt:new Date(f.now.getTime()-30000).toISOString()},channelCapture:{version:1,kind:'META_KYC_CHAT',challengeId:c.id,receiptId:'capture_historical'}};
 p.kycChatChallenge=c;p.kycChatConversation={version:1,status:'COMPLETED',challengeId:c.id};
 f.audit.set('review_historical',{id:'review_historical',organizationId:f.organization.id,actorId:p.kyc.review.actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.operation.recorded',metadata:{version:1,projectId:f.project.id,kind:'REVIEW_KYC',submissionId:p.kyc.submissionId,decision:'REJECTED',reason:p.kyc.review.reason}});
 return p.kyc;
}

test('rejected human review permits a fresh onboarding challenge while preserving private history',async()=>{
 for(const company of [true,false]){
  const f=fixture({company,active:true}),history=rejectedSubmission(f),before=structuredClone(history),first=await resolve(f);
  assert.equal(first.worker.metadata.participant.kyc.status,'REJECTED');assert.deepEqual(history,before);
  const c=storeChallenge(f);if(!company)delete c.companyKyc;f.worker.metadata.participant.kycChatConversation=null;
  assert.notEqual(c.id,history.channelCapture.challengeId);
  const pinned={...expected(first),challengeId:c.id},second=await resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:pinned});
  assert.equal(second.authorityDigest,first.authorityDigest);assert.deepEqual(history,before);assert.equal(f.controls.queries.at(-1).sql,'SELECT clock_timestamp() AS now');
 }
});

test('accepted own account can retry rejected KYC after the original invitation expired',async()=>{
 const f=fixture({active:true});rejectedSubmission(f);f.invitation.expiresAt=new Date(f.now.getTime()-60000).toISOString();
 const r=await resolve(f);assert.equal(r.worker.metadata.participant.invitation.state,'ACCEPTED');assert.equal(r.worker.metadata.participant.kyc.status,'REJECTED');
});

for(const status of ['PENDING','CLAIMED'])test('rejected history cannot reopen its captured '+status+' challenge',async()=>{
 const f=fixture({active:true});rejectedSubmission(f);f.worker.metadata.participant.kycChatChallenge.status=status;
 await assert.rejects(resolve(f),{code:'PARTICIPANT_ONBOARDING_KYC_REJECTION_REQUIRED'});
});

for(const [label,mutate] of [
 ['missing historical review',f=>{f.audit.delete('review_historical');}],
 ['foreign review submission',f=>{f.audit.get('review_historical').metadata.submissionId='kyc_other';}],
 ['review decision mismatch',f=>{f.worker.metadata.participant.kyc.review.decision='APPROVED';}],
 ['review reason mismatch',f=>{f.audit.get('review_historical').metadata.reason='Otra razón';}],
 ['unversioned review receipt',f=>{f.audit.get('review_historical').metadata.version=2;}],
 ['review timestamp in future',f=>{f.worker.metadata.participant.kyc.review.recordedAt=new Date(f.now.getTime()+60000).toISOString();}],
])test('rejected retry refuses '+label,async()=>{
 const f=fixture({active:true});rejectedSubmission(f);mutate(f);await assert.rejects(resolve(f),{code:'PARTICIPANT_ONBOARDING_KYC_REJECTION_REQUIRED'});
});

test('pinned retry refuses replacement of the historical rejected submission',async()=>{
 const f=fixture({active:true}),history=rejectedSubmission(f),first=await resolve(f),c=storeChallenge(f);f.worker.metadata.participant.kycChatConversation=null;
 history.submissionId='kyc_replacement';f.audit.get('review_historical').metadata.submissionId=history.submissionId;
 await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:{...expected(first),challengeId:c.id}}),{code:'PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED'});
});

test('prepare can pin its own untouched PENDING challenge without reissuing or changing authority',async()=>{
 const f=fixture(),first=await resolve(f);storeChallenge(f);f.worker.revision='2026-10-07T06:30:01.000000';
 const pinned={...expected(first),challengeId:f.worker.metadata.participant.kycChatChallenge.id};const r=await resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:pinned});assert.equal(r.authorityDigest,first.authorityDigest);assert.equal(r.worker.metadata.participant.kycChatChallenge.status,'PENDING');
 await assert.rejects(resolve(f),{code:'PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED'});
});

for(const [label,mutate] of [
 ['replacement challenge',c=>{c.id='kyc_chat_'+'4'.repeat(32);}],
 ['claimed challenge',c=>{c.status='CLAIMED';}],
 ['expired code',c=>{c.expiresAt='2026-10-07T06:30:00.000Z';}],
 ['foreign sender',c=>{c.senderE164='+5492212000002';}],
 ['foreign challenge grant',c=>{c.companyKyc.grantDigest='e'.repeat(64);}],
])test('owned challenge refuses '+label,async()=>{
 const f=fixture(),first=await resolve(f),c=storeChallenge(f);const pinned={...expected(first),challengeId:c.id};mutate(c);await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:pinned}));
});

test('pending metadata without its canonical prepared receipt cannot authorize code delivery',async()=>{
 const f=fixture(),first=await resolve(f),c=storeChallenge(f),pinned={...expected(first),challengeId:c.id};f.audit.delete('challenge_original');
 await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:pinned}),{code:'PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED'});
});

test('receipt for a different own-account acceptance cannot authorize the ACTIVE participant',async()=>{
 const f=fixture({active:true});f.audit.get('acceptance_original').metadata.requestDigest=digest([f.worker.id,f.invitation.id,'user_Other',f.invitation.email]);
 await assert.rejects(resolve(f),{code:'PARTICIPANT_ONBOARDING_ACCEPTANCE_REQUIRED'});
});

test('pending challenge receipt requires the canonical preparation request digest',async()=>{
 const f=fixture(),first=await resolve(f),c=storeChallenge(f);delete f.audit.get('challenge_original').metadata.requestDigest;
 await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:{...expected(first),challengeId:c.id}}),{code:'PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED'});
});

test('fresh final clock denies trial/invitation/grant expiry during earlier SQL',async()=>{
 for(const kind of ['trial','invitation','grant']){
  const f=fixture();f.controls.hook=async sql=>{if(sql.includes('ORDER BY id LIMIT 1001')){if(kind==='trial')f.controls.clock=new Date(f.organization.trialEndsAt);if(kind==='invitation')f.controls.clock=new Date(f.invitation.expiresAt);if(kind==='grant')f.controls.clock=new Date(Date.parse(f.connection.metadata.customerVerification.expiresAt)-60000);}};
  await assert.rejects(resolve(f));assert.equal(f.controls.queries.at(-1).sql,'SELECT clock_timestamp() AS now');
 }
});

test('accepted account with revoked membership or assignment cannot receive a new onboarding code',async()=>{
 for(const field of ['ownActive','projectMembership']){const f=fixture({active:true});f.controls[field]=false;await assert.rejects(resolve(f));}
});

test('partial corporate catalog cannot silently use legacy project-only mode',async()=>{
 const f=fixture({company:false});f.controls.partialSchema=true;await assert.rejects(resolve(f),{code:'PARTICIPANT_ONBOARDING_CHANNEL_REQUIRED'});
});

test('caller-supplied identity/recipient/expected fields are rejected before database access',async()=>{
 const f=fixture();await assert.rejects(resolveParticipantOnboardingAuthority(f.client,{...f.intent,senderE164:f.worker.phone}),{code:'PARTICIPANT_ONBOARDING_INPUT_INVALID'});assert.equal(f.controls.queries.length,0);
 await assert.rejects(resolveParticipantOnboardingAuthority(f.client,f.intent,{expected:{authorityDigest:'a'.repeat(64),to:'5492212000002'}}),{code:'PARTICIPANT_ONBOARDING_INPUT_INVALID'});assert.equal(f.controls.queries.length,0);
});
