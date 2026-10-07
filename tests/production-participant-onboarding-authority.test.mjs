import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveParticipantOnboardingAuthority} from '../src/lib/participant-onboarding-authority.mjs';
import {companyKycGrantDigest} from '../src/lib/company-channel-kyc.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256} from '../src/lib/participant-onboarding-policy.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';

// Explicit synthetic SQL facts test the canonical resolver, not provider I/O.
// PostgreSQL concurrency/constraint validation belongs to the integration run.
function fixture({company=true,active=false}={}){
 const now=new Date('2026-10-07T06:30:00.000Z'),revision='2026-10-07T06:00:00.000000';
 const organization={id:'organization_A',name:'Synthetic construction company',metadata:{},subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date(now.getTime()+3600000)};
 const issuer={actorId:'actor_issuer',membershipId:'member_issuer',organizationId:organization.id,role:'ADMIN',clerkRole:'org:admin',clerkUserId:'user_Issuer',revision,userRevision:revision};
 const own={actorId:'actor_worker',membershipId:'member_worker',organizationId:organization.id,role:'AUDITOR',clerkRole:'org:member',clerkUserId:'user_Worker',revision,userRevision:revision};
 const project={id:'project_B',name:'Synthetic B',organizationId:organization.id,metadata:{}},anchor={...project,id:'project_A',name:'Synthetic A'};
 const connection={id:'connection_customer',projectId:company?anchor.id:project.id,organizationId:organization.id,phoneNumberId:'123456789001',whatsappBusinessId:'123456789002',encryptedAccessToken:'v2.synthetic.scope.token',enabled:true,connectionStatus:'CONNECTED',metadata:{credentialFormat:'tenant-aad-v2',credentialOrganizationId:organization.id,customerSubscribed:true,customerSignupId:'signup_Synthetic',customerActivation:{version:1,state:'ACTIVE',actorId:issuer.actorId},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:new Date(now.getTime()+7200000).toISOString()}}};
 if(company)connection.metadata.companyRoutingVersion=1;
 const owner={connectionId:connection.id,anchorProjectId:connection.projectId,mode:'COMPANY',revision:2,assignmentRevision:3};
 const invitation={id:'invite_'+'1'.repeat(32),email:'synthetic@example.invalid',state:active?'ACCEPTED':'SENT',providerId:'orginv_Synthetic',expiresAt:new Date(now.getTime()+7200000).toISOString(),createdBy:issuer.actorId,operationId:'11111111-1111-4111-8111-111111111111',requestDigest:'a'.repeat(64)};
 const consent={version:1,status:'GRANTED',purpose:'PARTICIPANT_ONBOARDING',invitationId:invitation.id,senderE164:'+5492212000001',issuerActorId:issuer.actorId,issuerMembershipId:issuer.membershipId,receiptId:'consent_original',recordedAt:new Date(now.getTime()-60000).toISOString(),noticeVersion:PARTICIPANT_ONBOARDING_NOTICE_VERSION,noticeSha256:PARTICIPANT_ONBOARDING_NOTICE_SHA256};
 const worker={id:'worker_A',projectId:project.id,name:'Synthetic person',phone:consent.senderE164,active:true,revision,metadata:{siteRegister:{version:1},participant:{version:1,status:active?'ACTIVE':'INVITED',clerkUserId:active?own.clerkUserId:null,permissions:{attendance:false,report:false},invitation,onboardingConsent:consent,kyc:{version:1,status:'NOT_SUBMITTED'},...(active?{acceptanceReceiptId:'acceptance_original'}:{})}}};
 const intent={organizationId:organization.id,targetProjectId:project.id,workerId:worker.id,invitationId:invitation.id,issuerActorId:issuer.actorId,issuerMembershipId:issuer.membershipId,consentReceiptId:consent.receiptId};
 const audit=new Map([
  ['sent_original',{id:'sent_original',organizationId:organization.id,actorId:issuer.actorId,entityType:'Worker',entityId:worker.id,action:'participant.operation.recorded',metadata:{version:1,projectId:project.id,kind:'INVITATION_SENT',invitationId:invitation.id,providerId:invitation.providerId,requestDigest:invitation.requestDigest}}],
  [consent.receiptId,{id:consent.receiptId,organizationId:organization.id,actorId:issuer.actorId,entityType:'Worker',entityId:worker.id,action:'participant.onboarding.contact_authorized',metadata:{...consent,projectId:project.id,organizationId:organization.id}}],
 ]);
 if(active)audit.set('acceptance_original',{id:'acceptance_original',organizationId:organization.id,actorId:own.actorId,entityType:'Worker',entityId:worker.id,action:'participant.operation.recorded',metadata:{version:1,projectId:project.id,kind:'INVITATION_ACCEPTED',invitationId:invitation.id,requestDigest:digest([worker.id,invitation.id,own.clerkUserId,invitation.email])}});
 const controls={schema:company,partialSchema:false,assignment:true,issuerActive:true,ownActive:true,projectMembership:true,projectActive:true,anchorActive:true,duplicate:false,hook:null,queries:[],clock:new Date(now)};
 const rows=value=>({rows:structuredClone(value),rowCount:value.length});
 const catalogFingerprint=digest({columns:[],keys:[],indexes:[],triggers:[]});
 const client={async query(sql,args=[]){
  controls.queries.push({sql,args:structuredClone(args)});if(controls.hook)await controls.hook(sql,args);
  assert.ok(!/^(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i.test(sql),'authority must not write');
  if(sql.includes('to_regclass'))return rows([{present:sql.includes('WhatsAppCompanySchema')?controls.schema:controls.partialSchema}]);
  if(sql.includes('information_schema.columns'))return rows(sql.includes("column_name='catalogFingerprint'")?[{count:1}]:[]);
  if(sql.includes('FROM public."WhatsAppCompanySchema"'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint}]);
  if(sql.startsWith('SELECT conname,convalidated'))return rows(args[0].map(conname=>({conname,convalidated:true})));
  if(sql.includes('pg_get_indexdef'))return rows([]);
  if(sql.startsWith('SELECT c.relname,i.indisvalid'))return rows(args[0].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})));
  if(sql.startsWith('SELECT tgname'))return rows(args[0].map(tgname=>({tgname,tgenabled:'O'})));
  if(sql.includes('FROM pg_constraint')||sql.includes('FROM pg_index')||sql.includes('FROM pg_trigger'))return rows([]);
  if(sql.includes('FROM public."PlatformUser"')){const p=[issuer,own].find(p=>p.actorId===args[0]||p.clerkUserId===args[0]);return rows(p?[{id:p.actorId,clerkUserId:p.clerkUserId,revision:p.userRevision}]:[]);}
  if(sql.includes('FROM public."TenantMembership"')){const p=[issuer,own].find(p=>p.actorId===args[0]&&p.organizationId===args[1]&&(args.length<3||p.membershipId===args[2]));return rows(p&&(p===issuer?controls.issuerActive:controls.ownActive)?[p]:[]);}
  if(sql.includes('FROM public."Organization"'))return rows(args[0]===organization.id?[organization]:[]);
  if(sql.includes('FROM public."WhatsAppCompanyChannel"')){
   if(sql.includes('JOIN public."WhatsAppChannelProjectAssignment"')){
    if(!controls.assignment||!company||!['PREPARED','COMPANY','SUSPENDED'].includes(owner.mode))return rows([]);
    if(sql.includes('cc.revision=$3')&&(args[2]!==owner.revision||args[4]!==owner.assignmentRevision||args[5]!==owner.mode))return rows([]);
    return rows([owner]);
   }
   return rows([owner]);
  }
  if(sql.includes('FROM public."ProjectMembership"'))return rows(controls.projectMembership?[{id:'assignment_worker',revision}]:[]);
  if(sql.startsWith('SELECT w.id'))return rows(controls.duplicate?[{id:'worker_duplicate'}]:[]);
  if(sql.includes('FROM public."Worker"'))return rows(sql.includes('id<>')?(controls.duplicate?[{id:'worker_duplicate'}]:[]):args[0]===worker.id&&args[1]===worker.projectId?[worker]:[]);
  if(sql.includes('FROM public."Project"')){const p=[anchor,project].find(p=>p.id===args[0]&&p.organizationId===args[1]);return rows(p&&(p===project?controls.projectActive:controls.anchorActive)?[p]:[]);}
  if(sql.includes('FROM public."WhatsAppConnection"'))return rows(args.length===1?args[0]===connection.projectId?[connection]:[]:args[0]===connection.id&&args[1]===connection.projectId?[connection]:[]);
  if(sql.includes('FROM public."AuditLog"')){
   const all=[...audit.values()];
   if(sql.includes('ORDER BY id LIMIT 1001'))return rows(all.filter(a=>a.organizationId===args[0]&&a.action==='participant.operation.recorded'&&((a.entityType==='Worker'&&a.entityId===args[1]&&['REVOKE','RESTORE_ACCESS','EXISTING_ACCOUNT_ASSIGNED','INVITATION_ACCEPTED','INVITATION_SENT'].includes(a.metadata.kind))||(a.entityType==='TenantMembership'&&args[2].includes(a.entityId)&&a.metadata.kind==='OFFICE_ROLE_CHANGED'))).sort((a,b)=>a.id.localeCompare(b.id)).map(({id})=>({id})));
   if(sql.includes("metadata->>'kind'='INVITATION_SENT'"))return rows(all.filter(a=>a.organizationId===args[0]&&a.metadata.kind==='INVITATION_SENT'&&a.entityId===args[args.length===4?2:1]&&a.metadata.invitationId===args[args.length===4?3:2]&&(args.length!==4||a.actorId===args[1])));
   if(sql.includes("action='participant.kyc_chat.prepared'"))return rows(all.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityId===args[2]&&a.action==='participant.kyc_chat.prepared'&&a.metadata.challengeId===args[3]));
   if(sql.includes("metadata->>'kind'='REVIEW_KYC'"))return rows(all.filter(a=>a.organizationId===args[0]&&a.actorId===args[1]&&a.entityType==='Worker'&&a.entityId===args[2]&&a.action==='participant.operation.recorded'&&a.metadata.kind==='REVIEW_KYC'&&a.metadata.projectId===args[3]&&a.metadata.submissionId===args[4]&&a.metadata.decision==='REJECTED'));
   const a=audit.get(args[0]);return rows(a&&a.organizationId===args[1]&&a.actorId===args[2]&&a.entityId===args[3]&&a.action===(sql.includes('contact_authorized')?'participant.onboarding.contact_authorized':'participant.operation.recorded')?[a]:[]);
  }
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(controls.clock)}]);
  assert.fail('Unexpected synthetic SQL: '+sql);
 }};
 return {client,intent,organization,issuer,own,project,anchor,connection,owner,worker,audit,controls,now,consent,invitation};
}

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
