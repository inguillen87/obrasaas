import assert from 'node:assert/strict';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {createOwnCompanyCapability,createOwnCompanyRuntimeGrant} from '../../src/lib/meta-own-company-policy.mjs';
import {encryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {buildCustomerTemplate} from '../../src/lib/meta-customer-templates.mjs';
import {resolveParticipantOnboardingAuthority} from '../../src/lib/participant-onboarding-authority.mjs';
import {createParticipantOnboardingDelivery} from '../../src/lib/participant-onboarding-delivery.mjs';
import {createParticipantOnboardingPhases,queueParticipantOnboardingIdentity} from '../../src/lib/participant-onboarding-policy.mjs';
import {metaKycChallengeDigest} from '../../src/lib/meta-kyc-challenge.mjs';
import {companyKycGrantDigest} from '../../src/lib/company-channel-kyc.mjs';
import {digest} from '../../src/lib/workspace-policy.mjs';
import {participantOnboardingAuthorityFixture} from './participant-onboarding-authority-memory.mjs';
import {ownCompanyFixture} from './own-company-meta.mjs';

// Fully synthetic rows and fetch. The production canonical authority, vault,
// Own runtime policy, provider and two-phase delivery remain the real modules.
export async function ownParticipantOnboardingFixture({active=false,afterPrepare=async()=>{},afterDispatchMarker=async()=>{}}={}){
 const f=participantOnboardingAuthorityFixture({company:true,active}),operation='11111111-1111-4111-8111-111111111111';
 const own=ownCompanyFixture({time:f.now.getTime(),patch:{organizationId:f.organization.id,actorId:f.issuer.actorId,clerkUserId:f.issuer.clerkUserId,clerkOrganizationId:'org_Synthetic',projectId:f.anchor.id}});
 f.organization.metadata.companyPhoneDeclaration=own.declaration;
 own.context={member:{...f.issuer,organizationName:f.organization.name},session:{authenticated:true,verification:'clerk-production-jwt',userId:f.issuer.clerkUserId,organizationId:'org_Synthetic',organizationRole:'org:admin'},project:{id:f.anchor.id,organizationId:f.organization.id,organizationMetadata:f.organization.metadata}};
 f.environment=own.environment;f.token=own.environment.META_OWN_COMPANY_ACCESS_TOKEN;f.calls=own.calls;f.remote=new Map();f.sent=[];f.providerMode='success';f.afterLookup=null;f.prepares=0;f.events=new Map();
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url),method=options.method||'GET',route=parsed.pathname.replace(/^\/v25\.0\//,'');
  if(route===own.policy.wabaId+'/message_templates'&&method==='GET'){
   f.calls.push({path:route,method});const name=parsed.searchParams.get('name'),remote=f.remote.get(name);if(f.afterLookup)await f.afterLookup(name);return Response.json({data:remote?[structuredClone(remote)]:[]});
  }
  if(route===own.policy.phoneNumberId+'/messages'&&method==='POST'){
   f.calls.push({path:route,method});f.sent.push(JSON.parse(options.body));if(f.providerMode==='timeout')throw new Error('Synthetic uncertain Own POST');return Response.json({messages:[{id:'wamid.syntheticownonboarding123456_'+f.sent.length}]});
  }
  return own.fetchImpl(url,options);
 };
 f.provider=createMetaCustomerProvider({environment:f.environment,fetchImpl,now:()=>f.controls.clock.getTime()});
 const capability=createOwnCompanyCapability(own.context,f.environment,f.now.getTime()),admin=await f.provider.forOwnCapability({capability,token:f.token}),inspection=await admin.inspect({token:f.token,wabaId:own.policy.wabaId,phoneNumberId:own.policy.phoneNumberId});
 Object.assign(f.connection,{phoneNumberId:own.policy.phoneNumberId,whatsappBusinessId:own.policy.wabaId,displayPhoneNumber:own.policy.expectedPhoneE164,encryptedAccessToken:encryptCustomerSecret(f.token,{organizationId:f.organization.id,projectId:f.anchor.id,purpose:'access-token',resourceId:own.policy.phoneNumberId},f.environment)});
 Object.assign(f.connection.metadata,{declaredCompanyPhone:own.declaration,ownCompany:admin.ownProvenance(inspection),customerVerification:{...inspection,registered:true},ownCompanyTemplateDrafts:{}});
 const runtimeReceiptId='company_own_'+digest([f.organization.id,f.issuer.actorId,f.anchor.id,operation]);
 const runtimeGrant=createOwnCompanyRuntimeGrant({capability,connection:f.connection,receiptId:runtimeReceiptId,operationId:operation,channelRevision:f.owner.revision,providerAuthority:admin.ownOperationalAuthority(inspection)},f.environment,f.now.getTime());
 f.connection.metadata.ownCompanyRuntime=runtimeGrant;
 const activationReceipt={id:runtimeReceiptId,metadata:{state:'RECORDED',action:'ACTIVATE_OWN_NUMBER',projectId:f.anchor.id,operationId:operation,connectionId:f.connection.id,policyDigest:f.connection.metadata.ownCompany.policyDigest,runtimeGrant}};
 for(const [index,key]of ['participant_invitation','participant_onboarding_v1'].entries()){
  const definition=buildCustomerTemplate(f.connection,key),providerId=String(310000001+index),draft={definition,state:'SUBMITTED',providerStatus:'APPROVED',providerCategory:'UTILITY',providerId,observationRevision:1,grantDigest:runtimeGrant.grantDigest};
  f.connection.metadata.ownCompanyTemplateDrafts[key]=draft;f.remote.set(definition.name,{...structuredClone(definition),id:providerId,status:'APPROVED'});
 }
 const p=f.worker.metadata.participant;
 p.onboardingDelivery=createParticipantOnboardingPhases({version:1,...f.intent,state:'WAITING_CONFIGURATION',outboundId:null,requestedAt:f.now.toISOString(),nextCheckAt:null,code:null},p,f.now.toISOString());
 const baseQuery=f.client.query.bind(f.client);
 f.client.query=async(sql,args=[])=>{
  if(sql.includes('SELECT u.id AS "actorId",tm."organizationId"')){
   f.controls.queries.push({sql,args:structuredClone(args)});return{rows:f.controls.issuerActive?[{...f.issuer,organizationMetadata:f.organization.metadata}]:[],rowCount:1};
  }
  if(sql.startsWith('SELECT c.*,p."organizationId"')){
   f.controls.queries.push({sql,args:structuredClone(args)});return{rows:args[0]===f.connection.id&&args[1]===f.anchor.id&&args[2]===f.organization.id?[structuredClone(f.connection)]:[],rowCount:1};
  }
  if(sql.includes("action='company.own.number.recorded'")){
   f.controls.queries.push({sql,args:structuredClone(args)});return{rows:f.runtimeReceiptPresent===false?[]:[structuredClone(activationReceipt)],rowCount:1};
  }
  return baseQuery(sql,args);
 };
 f.resolve=expected=>resolveParticipantOnboardingAuthority(f.client,f.intent,{environment:f.environment,...(expected?{expected}:{} )});
 f.accept=()=>{
  const part=f.worker.metadata.participant;part.status='ACTIVE';part.clerkUserId=f.own.clerkUserId;part.invitation.state='ACCEPTED';part.acceptanceReceiptId='acceptance_original';
  f.audit.set('acceptance_original',{id:'acceptance_original',organizationId:f.organization.id,actorId:f.own.actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.operation.recorded',metadata:{version:1,projectId:f.project.id,kind:'INVITATION_ACCEPTED',invitationId:part.invitation.id,requestDigest:digest([f.worker.id,part.invitation.id,f.own.clerkUserId,part.invitation.email])}});
  return queueParticipantOnboardingIdentity(part,f.controls.clock.toISOString());
 };
 f.prepareChallenge=async(_client,member,project,input)=>{
  assert.equal(f.worker.metadata.participant.status,'ACTIVE');f.prepares++;const code='IDENTIDAD '+'a'.repeat(43),now=f.controls.clock.toISOString();
  const c={version:1,id:'kyc_chat_'+'3'.repeat(32),status:'PENDING',codeDigest:metaKycChallengeDigest(code),organizationId:f.organization.id,projectId:project.id,workerId:f.worker.id,senderE164:f.worker.phone,connectionId:f.connection.id,wabaId:f.connection.whatsappBusinessId,phoneNumberId:f.connection.phoneNumberId,issuerActorId:member.actorId,issuerMembershipId:member.membershipId,participantClerkUserId:f.worker.metadata.participant.clerkUserId,invitationId:f.invitation.id,createdAt:now,expiresAt:new Date(f.controls.clock.getTime()+3600000).toISOString(),companyKyc:{version:1,anchorProjectId:f.anchor.id,targetProjectId:f.project.id,ownerRevision:f.owner.revision,assignmentRevision:f.owner.assignmentRevision,grantDigest:companyKycGrantDigest(f.connection),issuerAuthorityDigest:'d'.repeat(64)}};
  f.worker.metadata.participant.kycChatChallenge=c;
  const receiptId='meta_kyc_challenge_'+'4'.repeat(64);f.audit.set(receiptId,{id:receiptId,organizationId:f.organization.id,actorId:member.actorId,entityType:'Worker',entityId:f.worker.id,action:'participant.kyc_chat.prepared',metadata:{version:1,projectId:project.id,challengeId:c.id,expiresAt:c.expiresAt,requestDigest:digest(input)}});return{code,codeUnavailable:false,expiresAt:c.expiresAt,receiptId};
 };
 let queue=Promise.resolve();
 const deliveryColumns=`w.id,w."projectId",w.phone,w.active,w.metadata,to_char(w."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
 const deliveryWorkerReads=new Map([
  [`SELECT ${deliveryColumns} FROM public."Worker" w WHERE w.id=$1 AND w."projectId"=$2`,2],
  [`SELECT ${deliveryColumns} FROM public."Worker" w WHERE w.id=$1 AND w."projectId"=$2 FOR UPDATE`,2],
  [`SELECT ${deliveryColumns} FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" WHERE w.id=$1 AND w."projectId"=$2 AND p."organizationId"=$3 FOR UPDATE OF w`,3],
 ]);
 f.connect=async()=>{
  let unlock,checkpoint=null;
  return{release(){unlock?.();unlock=null;},async query(sql,args=[]){
   if(sql==='BEGIN'){const previous=queue;queue=new Promise(resolve=>{unlock=resolve;});await previous;checkpoint=structuredClone({worker:f.worker,audit:f.audit,events:f.events});return{rows:[]};}
   if(sql==='COMMIT'){checkpoint=null;return{rows:[]};}
   if(sql==='ROLLBACK'){if(checkpoint){Object.assign(f.worker,checkpoint.worker);f.audit.clear();for(const [k,v]of checkpoint.audit)f.audit.set(k,v);f.events=checkpoint.events;}checkpoint=null;return{rows:[]};}
   if(sql.startsWith('SET LOCAL'))return{rows:[]};
   // These complete row reads are not the authority fixture's SELECT w.id
   // duplicate-recipient probe. Match only the three real delivery statements.
   if(deliveryWorkerReads.has(sql)){
    assert.equal(args.length,deliveryWorkerReads.get(sql));f.controls.queries.push({sql,args:structuredClone(args)});
    const matches=args[0]===f.worker.id&&args[1]===f.worker.projectId&&(args.length===2||args[2]===f.organization.id);
    const projected={id:f.worker.id,projectId:f.worker.projectId,phone:f.worker.phone,active:f.worker.active,metadata:f.worker.metadata,revision:f.worker.revision};
    return{rows:matches?[structuredClone(projected)]:[],rowCount:matches?1:0};
   }
   if(sql.startsWith('SELECT '+deliveryColumns))assert.fail('Unmodeled Own delivery Worker row statement: '+sql);
   if(sql.startsWith('SELECT ')&&sql.includes('FROM public."WebhookEvent"')){const e=f.events.get(args[0]);return{rows:e&&(args.length===1||e.projectId===args[1])?[structuredClone(e)]:[]};}
   if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!f.audit.has(args[0]));f.audit.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],entityType:'Worker',entityId:args[3],action:'participant.operation.recorded',metadata:JSON.parse(args[4])});return{rows:[],rowCount:1};}
   if(sql.startsWith('INSERT INTO public."WebhookEvent"')){assert.ok(!f.events.has(args[0]));f.events.set(args[0],{id:args[0],projectId:args[1],payload:JSON.parse(args[3]),outcome:JSON.parse(args[4]),leaseToken:args[5]});return{rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE public."WebhookEvent"')){const e=f.events.get(args[0]);assert.ok(e&&e.projectId===args[1]);if(sql.includes('"leaseToken"=$3')){if(e.leaseToken!==args[2])return{rows:[],rowCount:0};e.outcome=JSON.parse(args[3]);e.leaseToken=null;}else{e.outcome=JSON.parse(args[2]);e.leaseToken=sql.includes('"leaseToken"=$4')?args[3]:null;}return{rows:[],rowCount:1};}
   if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[0],f.worker.id);assert.equal(args[1],f.worker.projectId);f.worker.metadata=JSON.parse(args[2]);return{rows:[],rowCount:1};}
   return f.client.query(sql,args);
  }};
 };
 f.service=createParticipantOnboardingDelivery({connect:f.connect,provider:f.provider,environment:f.environment,prepareChallenge:f.prepareChallenge,afterPrepare,afterDispatchMarker});
 f.reference={projectId:f.project.id,workerId:f.worker.id};f.calls.length=0;return f;
}
