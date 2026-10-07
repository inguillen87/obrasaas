import assert from 'node:assert/strict';
import {WorkspaceError,digest} from '../../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {buildCustomerTemplate} from '../../src/lib/meta-customer-templates.mjs';
import {metaKycChallengeDigest} from '../../src/lib/meta-kyc-challenge.mjs';
import {createParticipantOnboardingDelivery} from '../../src/lib/participant-onboarding-delivery.mjs';
const clone=structuredClone;
export function onboardingDeliveryFixture(options={}){
 const f={now:new Date('2026-10-07T07:00:00.000Z'),allowed:true,transport:true,providerMode:'success',remoteStatus:'APPROVED',prepares:0,calls:[],queries:[],events:new Map(),audits:new Map(),authority:'a'.repeat(64),failCommitAfterSend:false,failQueueInsert:false};
 f.environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,8).toString('base64')};
 f.intent={version:1,organizationId:'organization-a',targetProjectId:'project-b',workerId:'worker-one',invitationId:'invite_'+'1'.repeat(32),issuerActorId:'actor-admin',issuerMembershipId:'membership-admin',consentReceiptId:'onboarding_contact_'+'2'.repeat(64),state:'WAITING_CONFIGURATION',outboundId:null};
 f.member={actorId:f.intent.issuerActorId,membershipId:f.intent.issuerMembershipId,organizationId:f.intent.organizationId,organizationName:'Constructora Piloto',role:'ADMIN'};
 f.project={id:'project-b',organizationId:f.intent.organizationId};
 f.connection={id:'connection-a',projectId:'project-a',phoneNumberId:'12345678901234',whatsappBusinessId:'98765432101234',metadata:{customerTemplateDrafts:{}}};
 f.connection.encryptedAccessToken=encryptCustomerSecret('test-only-token-for-customer',{organizationId:f.intent.organizationId,projectId:f.connection.projectId,purpose:'access-token',resourceId:f.connection.phoneNumberId},f.environment);
 const definition=buildCustomerTemplate(f.connection,'participant_onboarding_v1');
 f.connection.metadata.customerTemplateDrafts.participant_onboarding_v1={definition,state:'SUBMITTED',providerStatus:'APPROVED',providerCategory:'UTILITY',providerId:'34567890123456',observationRevision:1};
 f.worker={id:'worker-one',projectId:'project-b',phone:'+5491112345678',active:true,revision:'2026-10-07T07:00:00.000000',metadata:{siteRegister:{version:1},participant:{version:1,status:'INVITED',kyc:{status:'NOT_SUBMITTED'},invitation:{id:f.intent.invitationId,state:'SENT'},onboardingConsent:{status:'GRANTED'},onboardingDelivery:clone(f.intent)}}};
 let queue=Promise.resolve();
 f.connect=async()=>{
  const client={checkpoint:null,unlock:null,async query(sql,args=[]){
   f.queries.push({sql,args:clone(args)});
   if(sql==='BEGIN'){const previous=queue;queue=new Promise(resolve=>{client.unlock=resolve;});await previous;client.checkpoint={worker:clone(f.worker),events:clone(f.events),audits:clone(f.audits)};return {rows:[],rowCount:0};}
   if(sql==='COMMIT'){if(f.failCommitAfterSend&&[...f.events.values()].some(e=>e.outcome.state==='SENT')){f.failCommitAfterSend=false;throw new Error('controlled lost COMMIT acknowledgement');}client.checkpoint=null;return {rows:[],rowCount:0};}
   if(sql==='ROLLBACK'){if(client.checkpoint){f.worker=client.checkpoint.worker;f.events=client.checkpoint.events;f.audits=client.checkpoint.audits;}client.checkpoint=null;return {rows:[],rowCount:0};}
   if(sql.startsWith('SET LOCAL'))return {rows:[],rowCount:0};
   if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now)}]};
   if(sql.startsWith('SELECT w.id AS "workerId"'))return {rows:['WAITING_CONFIGURATION','PENDING','BLOCKED'].includes(f.worker.metadata.participant.onboardingDelivery.state)?[{workerId:f.worker.id,projectId:f.worker.projectId}]:[]};
   if(sql.startsWith('SELECT ')&&sql.includes('FROM public."Worker"'))return {rows:args[0]===f.worker.id&&args[1]===f.worker.projectId&&(!args[2]||args[2]===f.intent.organizationId)?[clone(f.worker)]:[]};
   if(sql.startsWith('SELECT ')&&sql.includes('FROM public."WebhookEvent"')){const e=f.events.get(args[0]);return {rows:e&&e.projectId===args[1]?[clone(e)]:[]};}
   if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!f.audits.has(args[0]));f.audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],entityId:args[3],metadata:JSON.parse(args[4])});return {rowCount:1,rows:[]};}
   if(sql.startsWith('INSERT INTO public."WebhookEvent"')){if(f.failQueueInsert)throw new Error('controlled outbox insertion failure');assert.ok(!f.events.has(args[0]));f.events.set(args[0],{id:args[0],projectId:args[1],payload:JSON.parse(args[3]),outcome:JSON.parse(args[4]),leaseToken:args[5]});return {rowCount:1,rows:[]};}
   if(sql.startsWith('UPDATE public."WebhookEvent"')){
    const e=f.events.get(args[0]);assert.ok(e&&e.projectId===args[1]);
    if(sql.includes('"leaseToken"=$3')){if(e.leaseToken!==args[2])return {rowCount:0,rows:[]};e.outcome=JSON.parse(args[3]);e.leaseToken=null;}
    else {e.outcome=JSON.parse(args[2]);e.leaseToken=sql.includes('"leaseToken"=$4')?args[3]:null;}
    return {rowCount:1,rows:[]};
   }
   if(sql.startsWith('UPDATE public."Worker"')){assert.equal(args[0],f.worker.id);assert.equal(args[1],f.worker.projectId);f.worker.metadata=JSON.parse(args[2]);return {rowCount:1,rows:[]};}
   throw new Error('Unexpected controlled SQL: '+sql);
  },release(){client.unlock?.();client.unlock=null;}};
  return client;
 };
 f.resolveAuthority=async(_client,intent,{expected=null}={})=>{
  assert.equal(digest(intent),digest(Object.fromEntries(['organizationId','targetProjectId','workerId','invitationId','issuerActorId','issuerMembershipId','consentReceiptId'].map(k=>[k,f.intent[k]]))));
  if(!f.allowed||f.worker.metadata.participant.onboardingConsent.status!=='GRANTED')throw new WorkspaceError('PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED',409);
  if(expected&&expected.authorityDigest!==f.authority)throw new WorkspaceError('PARTICIPANT_ONBOARDING_AUTHORITY_CHANGED',409);
  const c=f.worker.metadata.participant.kycChatChallenge;
  if(c&&['PENDING','CLAIMED'].includes(c.status)&&(!expected?.challengeId||expected.challengeId!==c.id||c.status!=='PENDING'||Date.parse(c.expiresAt)<=f.now.getTime()))throw new WorkspaceError('PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED',409);
  if(expected?.challengeId&&c?.status!=='PENDING')throw new WorkspaceError('PARTICIPANT_ONBOARDING_CHALLENGE_REQUIRED',409);
  return {member:clone(f.member),project:clone(f.project),worker:clone(f.worker),connection:clone(f.connection),now:new Date(f.now),authorityDigest:f.authority};
 };
 f.prepareChallenge=async()=>{
  f.prepares++;const code='IDENTIDAD '+'a'.repeat(43);assert.ok(!['PENDING','CLAIMED'].includes(f.worker.metadata.participant.kycChatChallenge?.status));
  const c={version:1,id:'kyc_chat_'+'3'.repeat(32),status:'PENDING',codeDigest:metaKycChallengeDigest(code),connectionId:f.connection.id,senderE164:f.worker.phone,expiresAt:new Date(f.now.getTime()+86400000).toISOString()};f.worker.metadata.participant.kycChatChallenge=c;
  return {code,codeUnavailable:false,expiresAt:c.expiresAt,receiptId:'meta_kyc_challenge_'+'4'.repeat(64)};
 };
 f.provider={readiness:()=>({gates:Object.fromEntries(['app','secret','configuration','version','vault','review','callback'].map(k=>[k,f.transport]))}),async findTemplate(){return {...clone(definition),id:'34567890123456',status:f.remoteStatus,category:'UTILITY'};},async sendTemplate(input){f.calls.push(clone(input));if(f.providerMode==='timeout')throw new Error('controlled ambiguous transport');if(f.providerMode==='reject')throw new WorkspaceError('META_CUSTOMER_PROVIDER_REJECTED',400);if(f.providerMode==='invalid')return {messageId:null};return {messageId:'wamid.controlledMessage0123456789'};}};
 f.service=createParticipantOnboardingDelivery({connect:f.connect,provider:f.provider,environment:f.environment,resolveAuthority:f.resolveAuthority,prepareChallenge:f.prepareChallenge,...options});
 f.reference={projectId:f.worker.projectId,workerId:f.worker.id};return f;
}
