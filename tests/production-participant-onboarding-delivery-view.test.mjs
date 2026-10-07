import assert from 'node:assert/strict';
import test from 'node:test';
import {participantOnboardingDeliveryView as view,participantOnboardingContactNotice as noticeView,participantOnboardingWhatsAppConsent as consent} from '../src/app/(identity)/cuenta/participant-onboarding-delivery-view.mjs';
import {participantOnboardingNextStep as nextStep} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';
import {participantOnboardingNavigationTarget as navigationTarget} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';

const now=Date.parse('2026-10-07T12:00:00.000Z');
const notice=()=>({version:'participant-onboarding-v1',sha256:'b'.repeat(64),text:'Confirmo la autorización de contacto para instrucciones de alta por WhatsApp.'});
const row=()=>({id:'worker-a',revision:'2026-10-07T10:00:00.000001',active:true,self:false,status:'INVITED',accountLinked:false,canSendOnboardingWhatsapp:true,canRevokeOnboardingContact:false,invitation:{id:'invite_'+'a'.repeat(32),state:'SENT',expiresAt:'2026-10-08T12:00:00.000Z',expired:false},kyc:{status:'NOT_SUBMITTED'},kycChatChallenge:null});
const fixture=()=>({context:{scope:'a'.repeat(64),projectId:'project-a',verified:true,now},snapshot:{scope:'a'.repeat(64),projectId:'project-a',canManage:true,records:[row()],onboardingContactNotice:notice()},workerId:'worker-a'});
const delivery=(state='PENDING',patch={})=>({state,contactAuthorized:true,outboundId:'customer_outbound_'+'c'.repeat(64),code:null,providerAccepted:['SENT','STATUS_OBSERVED'].includes(state),deliveryConfirmed:false,providerStatus:null,automaticResendAllowed:false,...patch});
const withDelivery=(state,patch={})=>{const value=fixture();value.snapshot.records[0].onboardingDelivery=delivery(state,patch);return value;};
const unknown=input=>{const result=view(input);assert.equal(result.state,'UNKNOWN');assert.equal(result.observed,false);assert.equal(result.canSend,false);assert.equal(result.canRevoke,false);assert.equal(result.automaticResendAllowed,false);return result;};
const pendingChat=()=>({id:'challenge-a',status:'PENDING',expiresAt:'2026-10-08T12:00:00.000Z',conversationExpiresAt:null,expired:false,canPrepare:false,canCancel:true,blockedCode:null});

test('an explicit current server capability can offer the first request, without inventing delivery',()=>{
 const result=view(fixture());assert.equal(result.state,'NOT_REQUESTED');assert.equal(result.observed,true);assert.equal(result.canSend,true);assert.equal(result.canRevoke,false);assert.equal(result.providerAccepted,false);assert.equal(result.deliveryConfirmed,false);
});

test('legacy absence of the delivery contract and capabilities remains unknown',()=>{
 const input=fixture();delete input.snapshot.records[0].canSendOnboardingWhatsapp;delete input.snapshot.records[0].canRevokeOnboardingContact;unknown(input);
 input.snapshot.records[0].role='ADMIN';input.snapshot.records[0].metadata={paid:true,canSend:true};unknown(input);
});

test('a delivery status cannot grant permission to a different manager',()=>{
 const input=withDelivery('SENT');input.snapshot.records[0].canSendOnboardingWhatsapp=false;
 assert.equal(view(input).canSend,false);assert.equal(view(input).providerAccepted,true);
 delete input.snapshot.records[0].canSendOnboardingWhatsapp;assert.equal(view(input).canSend,false);
 input.snapshot.records[0].canSendOnboardingWhatsapp=true;input.snapshot.canManage=false;assert.equal(view(input).canSend,false);
});

for(const state of ['WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN','REJECTED','CANCELED'])test('truthful delivery projection '+state,()=>{
 const result=view(withDelivery(state));assert.equal(result.observed,true);assert.equal(result.state,state);assert.equal(result.providerAccepted,false);assert.equal(result.deliveryConfirmed,false);assert.equal(result.automaticResendAllowed,false);
 if(['WAITING_CONFIGURATION','PENDING','BLOCKED','SEND_STARTED','SEND_UNKNOWN'].includes(state))assert.equal(result.canSend,false);
 assert.ok(result.label.length<45);assert.ok(result.description.length>20);
});

test('SENT says accepted by the provider, never delivered or accepted by the participant',()=>{
 const result=view(withDelivery('SENT'));
 assert.equal(result.label,'Aceptado por WhatsApp');assert.equal(result.providerAccepted,true);assert.equal(result.deliveryConfirmed,false);assert.match(result.description,/todavía no confirma la entrega/);assert.match(result.description,/aceptación de la invitación/);
});

for(const state of ['sent','delivered','read','failed','deleted'])test('provider status '+state+' distinguishes transport from human acceptance',()=>{
 const failed=['failed','deleted'].includes(state),confirmed=['delivered','read'].includes(state);
 const result=view(withDelivery('STATUS_OBSERVED',{providerStatus:state,providerAccepted:!failed,deliveryConfirmed:confirmed}));
 assert.equal(result.observed,true);assert.equal(result.deliveryConfirmed,confirmed);assert.equal(result.providerAccepted,!failed);assert.equal(result.automaticResendAllowed,false);
 if(confirmed){assert.match(result.description,/no acredita quién/);assert.match(result.description,/aceptación de la cuenta/);}
 assert.equal(Object.hasOwn(result,'humanAccepted'),false);assert.equal(Object.hasOwn(result,'identityApproved'),false);
});

for(const patch of [{state:'READY'},{state:'sent'},{contactAuthorized:'true'},{providerAccepted:false},{deliveryConfirmed:true},{automaticResendAllowed:true},{outboundId:'private-secret'},{code:'IDENTIDAD private-secret'},{providerStatus:'queued'},{unexpected:'private-secret'}])test('malformed delivery fails closed '+JSON.stringify(patch),()=>unknown(withDelivery('SENT',patch)));

test('a claimed delivery without its corresponding observed provider status is not trusted',()=>{
 unknown(withDelivery('STATUS_OBSERVED',{deliveryConfirmed:true}));
 unknown(withDelivery('STATUS_OBSERVED',{providerStatus:'read',deliveryConfirmed:false}));
 unknown(withDelivery('STATUS_OBSERVED',{providerStatus:'failed',providerAccepted:true}));
 unknown(withDelivery('SENT',{providerStatus:'delivered'}));
 unknown(withDelivery('PENDING',{providerAccepted:true}));
});

test('the original manager capability, fresh invitation and an idle identity capture are all required',()=>{
 const input=fixture(),person=input.snapshot.records[0];assert.equal(view(input).canSend,true);
 for(const state of ['ATTEMPTED','REVOKED','UNKNOWN']){person.invitation.state=state;assert.equal(view(input).canSend,false);}
 person.invitation.state='ACCEPTED';assert.equal(view(input).canSend,false);
 person.invitation.state='SENT';
 person.invitation.expiresAt=new Date(now).toISOString();assert.equal(view(input).canSend,false);
 person.invitation.expiresAt='2026-10-08T12:00:00.000Z';person.invitation.expired=true;assert.equal(view(input).canSend,false);
 person.invitation.expired=false;person.kycChatChallenge=pendingChat();assert.equal(view(input).canSend,false);
 person.kycChatChallenge={...pendingChat(),expiresAt:'2026-10-07T11:00:00.000Z',expired:true};assert.equal(view(input).canSend,false);
 person.kycChatChallenge={...pendingChat(),status:'CLAIMED',conversationExpiresAt:'2026-10-07T13:00:00.000Z'};assert.equal(view(input).canSend,false);
 delete person.kycChatChallenge;assert.equal(view(input).canSend,false);
 person.kycChatChallenge=null;for(const status of ['PENDING_ACCOUNT_CLAIM','PENDING_REVIEW','APPROVED','UNKNOWN']){person.kyc.status=status;assert.equal(view(input).canSend,false);}
 person.kyc.status='REJECTED';assert.equal(view(input).canSend,true);
});

test('an active accepted participant keeps the sending capability after the consumed invitation expires',()=>{
 const input=fixture(),person=input.snapshot.records[0];person.status='ACTIVE';person.accountLinked=true;
 person.invitation.state='ACCEPTED';person.invitation.expiresAt='2026-10-06T12:00:00.000Z';person.invitation.expired=true;
 assert.equal(view(input).canSend,true);
 delete person.invitation.expiresAt;assert.equal(view(input).canSend,true);
 person.canSendOnboardingWhatsapp=false;assert.equal(view(input).canSend,false);
 person.canSendOnboardingWhatsapp=true;person.kycChatChallenge=pendingChat();assert.equal(view(input).canSend,false);
});

test('inactive, revoked or unversioned participants cannot request a new delivery',()=>{
 for(const patch of [{active:false},{status:'REVOKED'},{status:'NOT_INVITED'},{revision:''},{revision:null}]){const input=fixture();Object.assign(input.snapshot.records[0],patch);assert.equal(view(input).canSend,false);}
});

test('revoking contact requires an explicit server capability, current contact and current manager or own account',()=>{
 const input=withDelivery('PENDING'),person=input.snapshot.records[0];person.canRevokeOnboardingContact=true;assert.equal(view(input).canRevoke,true);
 input.snapshot.canManage=false;assert.equal(view(input).canRevoke,false);person.self=true;assert.equal(view(input).canRevoke,false);
 person.status='ACTIVE';person.accountLinked=true;assert.equal(view(input).canRevoke,true);
 person.onboardingDelivery.contactAuthorized=false;assert.equal(view(input).canRevoke,false);
 person.onboardingDelivery.contactAuthorized=true;person.canRevokeOnboardingContact=false;assert.equal(view(input).canRevoke,false);
});

for(const state of ['SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED'])test('contact revocation cannot promise to recall a dispatched '+state+' message',()=>{
 const input=withDelivery(state,state==='STATUS_OBSERVED'?{providerStatus:'sent'}:{});input.snapshot.records[0].canRevokeOnboardingContact=true;
 const result=view(input);assert.equal(result.canRevoke,true);assert.match(result.revokeWarning,/No puede borrar ni retirar un mensaje/);
 input.snapshot.records[0].onboardingDelivery.contactAuthorized=false;input.snapshot.records[0].canRevokeOnboardingContact=false;
 assert.match(view(input).revokeWarning,/No puede borrar ni retirar un mensaje/);assert.equal(view(input).canRevoke,false);
});

test('SEND_UNKNOWN preserves observation only, even if stale capability claims a new send',()=>{
 const input=withDelivery('SEND_UNKNOWN');assert.equal(view(input).canSend,false);assert.match(view(input).description,/mismo|consultá/i);assert.match(view(input).description,/no lo vuelvas a enviar/);assert.equal(view(input).automaticResendAllowed,false);
});

test('the server notice is optional until checked, then bound by version and content hash',()=>{
 assert.equal(consent(undefined,false),null);assert.equal(consent(notice(),false),null);assert.equal(consent(notice(),'true'),null);
 assert.deepEqual(consent(notice(),true),{confirmed:true,noticeVersion:'participant-onboarding-v1',noticeSha256:'b'.repeat(64)});
 const reviewed=notice();for(const patch of [{version:'participant-onboarding-v2'},{sha256:'c'.repeat(64)},{text:'Aviso distinto con la misma huella antigua'}])assert.throws(()=>consent({...notice(),...patch},true,reviewed),{code:'PARTICIPANT_ONBOARDING_CONSENT_REQUIRED',requestDispatched:false});
});

test('missing or malformed notices remove the sending option without replacing the notice locally',()=>{
 for(const value of [undefined,null,{},[],{...notice(),sha256:'invalid'},{...notice(),version:'INVALID NOTICE'},{...notice(),text:''},{...notice(),privateToken:'private-secret'}]){
  assert.equal(noticeView(value),null);const input=fixture();input.snapshot.onboardingContactNotice=value;assert.equal(view(input).canSend,false);assert.throws(()=>consent(value,true),{requestDispatched:false});
 }
 assert.deepEqual(noticeView(notice()),notice());
});

test('unknown, switched or unverified contexts do not reuse old row capabilities',()=>{
 for(const patch of [{verified:false},{scope:'c'.repeat(64)},{projectId:'project-b'},{now:NaN},{now:-1}]){const input=fixture();Object.assign(input.context,patch);unknown(input);}
 const input=fixture();input.snapshot.records.push(row());unknown(input);input.snapshot.records=[row()];input.workerId='worker-other';unknown(input);
});

test('private worker metadata, bank data, codes and outbound identifiers are not read or returned',()=>{
 const input=withDelivery('BLOCKED',{code:'PARTICIPANT_ONBOARDING_CONFIGURATION_PENDING'}),person=input.snapshot.records[0];
 for(const field of ['metadata','privateBankAccount','phone','clerkUserId'])Object.defineProperty(person,field,{get(){throw new Error('Private data must not be read');}});
 const result=view(input);assert.equal(result.observed,true);assert.equal(Object.hasOwn(result,'outboundId'),false);assert.equal(Object.hasOwn(result,'code'),false);assert.equal(JSON.stringify(result).includes('customer_outbound_'),false);
});

test('the view and notice projection do not change the canonical snapshot',()=>{
 const input=withDelivery('SENT'),before=JSON.stringify(input);view(input);noticeView(input.snapshot.onboardingContactNotice);consent(input.snapshot.onboardingContactNotice,true);assert.equal(JSON.stringify(input),before);
});

test('the canonical next step prefers instructions only with current explicit sending authority and the server notice',()=>{
 const input=fixture();input.snapshot.canInvite=true;
 assert.deepEqual(nextStep(input).primary,{action:'SEND_ONBOARDING_WHATSAPP',label:'Enviar instrucciones por WhatsApp'});
 assert.equal(nextStep(input).state,'ONBOARDING_WHATSAPP_PREPARATION');
 input.snapshot.records[0].canSendOnboardingWhatsapp=false;
 assert.equal(nextStep(input).primary.action,'PREPARE_KYC_CHAT');
 input.snapshot.records[0].canSendOnboardingWhatsapp=true;delete input.snapshot.onboardingContactNotice;
 assert.equal(nextStep(input).primary.action,'PREPARE_KYC_CHAT');
});

test('authorized instructions already queued are consulted before preparing another identity code',()=>{
 for(const state of ['WAITING_CONFIGURATION','PENDING','BLOCKED']){
  const input=withDelivery(state);input.snapshot.canInvite=true;input.snapshot.records[0].canSendOnboardingWhatsapp=false;
  assert.deepEqual(nextStep(input).primary,{action:'CONSULT_PARTICIPANTS',label:'Consultar envío por WhatsApp'});
  assert.equal(nextStep(input).state,'ONBOARDING_WHATSAPP_PENDING');
  input.snapshot.records[0].onboardingDelivery.contactAuthorized=false;
  assert.equal(nextStep(input).primary.action,'PREPARE_KYC_CHAT');
  input.snapshot.records[0].onboardingDelivery.contactAuthorized=true;input.snapshot.records[0].kycChatChallenge=pendingChat();
  assert.equal(nextStep(input).primary.action,'CANCEL_KYC_CHAT','An existing challenge retains its closure authority');
 }
});

const templatePending=()=>{const input=withDelivery('BLOCKED',{code:'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED'});input.snapshot.canInvite=true;input.snapshot.records[0].canSendOnboardingWhatsapp=false;return input;};
test('the exact template approval blocker offers review without sending or exposing the raw receipt',()=>{
 const input=templatePending(),before=JSON.stringify(input),result=view(input);
 assert.equal(result.blocker,'TEMPLATE_APPROVAL_REQUIRED');assert.equal(result.label,'Plantilla de alta pendiente');assert.match(result.description,/aprobación vigente/);
 assert.equal(result.canSend,false);assert.equal(result.providerAccepted,false);assert.equal(result.deliveryConfirmed,false);assert.equal(result.automaticResendAllowed,false);
 assert.equal(Object.hasOwn(result,'code'),false);assert.equal(Object.hasOwn(result,'outboundId'),false);
 assert.deepEqual(nextStep(input),{state:'ONBOARDING_TEMPLATE_REVIEW',primary:{action:'REVIEW_ONBOARDING_TEMPLATE',label:'Revisar plantilla de alta'},optionalBank:null,requestedJob:null});
 assert.equal(JSON.stringify(input),before);
});
for(const code of [null,'PARTICIPANT_ONBOARDING_AUTHORIZATION_REQUIRED','PARTICIPANT_ONBOARDING_PROVIDER_CLOSED','PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED_PRIVATE','private-provider-text',42])test('other or malformed blockers do not invent template review: '+code,()=>{
 const input=templatePending();input.snapshot.records[0].onboardingDelivery.code=code;
 assert.equal(view(input).blocker,null);assert.notEqual(nextStep(input).primary?.action,'REVIEW_ONBOARDING_TEMPLATE');
 if(typeof code==='string')assert.equal(JSON.stringify(view(input)).includes(code),false);
});
for(const state of ['WAITING_CONFIGURATION','PENDING','SEND_STARTED','SEND_UNKNOWN','SENT','STATUS_OBSERVED','REJECTED','CANCELED'])test('a template code does not replace delivery state '+state,()=>{
 const input=withDelivery(state,{code:'PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED',...(state==='STATUS_OBSERVED'?{providerStatus:'sent'}:{})});
 input.snapshot.canInvite=true;input.snapshot.records[0].canSendOnboardingWhatsapp=false;
 assert.equal(view(input).blocker,null);assert.notEqual(nextStep(input).primary?.action,'REVIEW_ONBOARDING_TEMPLATE');assert.equal(view(input).automaticResendAllowed,false);
});
test('template guidance reads no private worker metadata and returns only static presentation',()=>{
 const input=templatePending(),person=input.snapshot.records[0];for(const field of ['metadata','privateBankAccount','phone','clerkUserId'])Object.defineProperty(person,field,{get(){throw Error('Private field read');}});
 for(const result of [view(input),nextStep(input)])assert.doesNotMatch(JSON.stringify(result),/customer_outbound_|PARTICIPANT_ONBOARDING_TEMPLATE_APPROVAL_REQUIRED|IDENTIDAD |private-provider/);
});
test('uncertainty, chat closure, invitation and own identity precede template navigation',()=>{
 const input=templatePending(),person=input.snapshot.records[0];input.pendingReference={scope:input.context.scope,projectId:input.context.projectId,resource:'participants',operationId:'11111111-1111-4111-8111-111111111111'};
 assert.equal(nextStep(input).primary.action,'CONSULT_OPERATION');input.pendingReference=null;
 for(const status of ['PENDING','CLAIMED']){person.kycChatChallenge={...pendingChat(),status,conversationExpiresAt:status==='CLAIMED'?'2026-10-07T13:00:00.000Z':null};assert.equal(nextStep(input).primary.action,'CANCEL_KYC_CHAT');person.kycChatChallenge.canCancel=false;assert.equal(nextStep(input).primary.action,'CONSULT_PARTICIPANTS');}
 person.kycChatChallenge=null;person.invitation.state='ATTEMPTED';assert.equal(nextStep(input).primary.action,'RECOVER_INVITATION');person.invitation.state='SENT';person.invitation.expired=true;assert.equal(nextStep(input).primary.action,'INVITE');
 person.status='ACTIVE';person.self=true;person.accountLinked=true;assert.equal(nextStep(input).primary.action,'SUBMIT_KYC');person.kyc.status='PENDING_REVIEW';assert.equal(nextStep(input).state,'WAIT_REVIEW');
});
test('template navigation requires active contact and verified current participation',()=>{
 for(const patch of [{active:false},{status:'REVOKED'},{self:true,status:'ACTIVE',accountLinked:true}]){const input=templatePending();Object.assign(input.snapshot.records[0],patch);assert.notEqual(nextStep(input).primary?.action,'REVIEW_ONBOARDING_TEMPLATE');}
 const input=templatePending();input.snapshot.records[0].onboardingDelivery.contactAuthorized=false;assert.equal(nextStep(input).primary.action,'PREPARE_KYC_CHAT');
 input.context.verified=false;assert.equal(nextStep(input).primary.action,'CONSULT_ACCESS');input.context.verified=true;input.context.projectId='other-project';assert.equal(nextStep(input).primary.action,'CONSULT_ACCESS');
});
test('navigation destinations use only the current scoped context and explicit integration capability',()=>{
 const context={scope:'a'.repeat(64),projectId:'project-a',canManageIntegrations:true},value={scope:context.scope,projectId:context.projectId,target:'meta-onboarding'};
 assert.equal(navigationTarget(value,context),'customer-meta-title');assert.equal(navigationTarget({...value,target:'worker-channel'},context),'worker-channel-title');assert.equal(navigationTarget({...value,target:'pending-receipts'},context),'pending-receipts-title');
 for(const current of [null,{...context,scope:'invalid'},{...context,canManageIntegrations:false},{...context,canManageIntegrations:'true'},{...context,canManageIntegrations:undefined}])assert.equal(navigationTarget(value,current),null);
 for(const patch of [{scope:'b'.repeat(64)},{projectId:'other-project'},{target:'unobserved-template'},{target:'customer-template-workbench'}])assert.equal(navigationTarget({...value,...patch},context),null);
 assert.equal(navigationTarget(null,context),null);assert.equal(navigationTarget(value,{...context,projectId:null}),null);
});
