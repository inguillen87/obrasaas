import assert from 'node:assert/strict';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../../src/lib/company-channel-schema.mjs';
import {PARTICIPANT_ONBOARDING_NOTICE_VERSION,PARTICIPANT_ONBOARDING_NOTICE_SHA256} from '../../src/lib/participant-onboarding-policy.mjs';
import {digest} from '../../src/lib/workspace-policy.mjs';

export function participantOnboardingAuthorityFixture({company=true,active=false}={}){
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
  if(sql.includes('to_regclass'))return rows([{present:sql.includes('WhatsAppCompanySchema')?controls.schema:controls.partialSchema,count:1}]);
  if(sql.startsWith('SELECT\n  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('))return rows([{columns:[],keys:[],indexes:[],triggers:[]}]);
  if(sql.startsWith('SELECT version,contract,"catalogFingerprint",'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint,currentCatalog:{columns:[],keys:[],indexes:[],triggers:[]},catalog:args[1].map(conname=>({conname,convalidated:true})),indexes:args[2].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})),triggers:args[3].map(tgname=>({tgname,tgenabled:'O'}))}]);
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
