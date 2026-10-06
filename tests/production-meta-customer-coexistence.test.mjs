import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaCustomerProvider,metaCustomerReadiness} from '../src/lib/meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {customerSignupFlow,publicCustomerCoexistence,customerLifecycleRecovery} from '../src/lib/meta-customer-coexistence.mjs';
import {splitMetaCustomerEvents,verifyMetaCustomerSignature} from '../src/lib/meta-customer-callback.mjs';
import {customerAppRecords} from '../src/lib/meta-customer-app-projection.mjs';
import {customerInboxSnapshot,customerInboxEventTitle} from '../src/app/(identity)/cuenta/customer-inbox-view.mjs';
import {metaOnboardingSnapshot} from '../src/app/(identity)/cuenta/meta-onboarding-readiness-view.mjs';
import {publicCustomerActivation,customerActivationLifecycleReady} from '../src/lib/meta-customer-activation.mjs';
import {customerChannelActive} from '../src/lib/meta-customer-outbound.mjs';
const environment={NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-secret-only-12345678',META_CONFIG_ID:'123456789012345',META_COEXISTENCE_CONFIG_ID:'123456789012346',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,24).toString('base64'),META_EMBEDDED_SIGNUP_VERSION:'4',OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',OBRASAAS_META_COEXISTENCE_RELEASE:'business-app-coexistence-v1',META_CUSTOMER_VERIFY_TOKEN:'synthetic-verify-token-only-'.repeat(2)};
const debug={is_valid:true,app_id:OBRASAAS_META_CHANNEL.appId,scopes:['whatsapp_business_management','whatsapp_business_messaging'],granular_scopes:[{scope:'whatsapp_business_management',target_ids:['8888888801']}],expires_at:0};
test('signed account lifecycle timestamps preserve replay but distinguish another offboard cycle',()=>{
 const envelope=(event,time)=>({object:'whatsapp_business_account',entry:[{id:'8888888801',time,changes:[{field:'account_update',value:{event}}]}]});
 const first=splitMetaCustomerEvents(envelope('ACCOUNT_OFFBOARDED',1770000000))[0],replay=splitMetaCustomerEvents(envelope('ACCOUNT_OFFBOARDED',1770000000))[0],next=splitMetaCustomerEvents(envelope('ACCOUNT_OFFBOARDED',1770000001))[0];
 assert.equal(first.phoneNumberId,null);assert.equal(first.payload.providerTimestamp,'1770000000');assert.equal(first.externalId,replay.externalId);assert.notEqual(first.externalId,next.externalId);assert.notEqual(first.payloadDigest,next.payloadDigest);
 for(const time of [-1,0,'unknown','1e9',1.5,Number.MAX_SAFE_INTEGER])assert.throws(()=>splitMetaCustomerEvents(envelope('ACCOUNT_RECONNECTED',time)),{code:'META_CUSTOMER_CALLBACK_INVALID'});
});
test('partner removal reason and initiating party are bounded private observations',()=>{
 const parsed=customerAppRecords({field:'account_update',value:{event:'PARTNER_REMOVED',disconnection_info:{reason:'PRIMARY_INACTIVITY',initiated_by:'SYSTEM'}}});
 assert.equal(parsed.lifecycle,'partner_removed');assert.equal(parsed.disconnectionReason,'PRIMARY_INACTIVITY');assert.equal(parsed.disconnectionInitiatedBy,'SYSTEM');assert.deepEqual(parsed.records,[]);
 const unsafe=customerAppRecords({field:'account_update',value:{event:'PARTNER_REMOVED',disconnection_info:{reason:'private contact +549...',initiated_by:'someone'}}});assert.equal(unsafe.disconnectionReason,null);assert.equal(unsafe.disconnectionInitiatedBy,null);
});
test('a pause blocks activation and import until an authentic reconnect or a different canonical grant',()=>{
 const c={metadata:{customerSignupId:'original',customerLifecycle:{event:'account_offboarded',authorizationSignupId:'original',providerTimestamp:'10'},coexistence:{verified:true,syncDeadlineAt:'2030-01-01T00:00:00.000Z',contacts:{state:'NOT_REQUESTED'},history:{state:'NOT_REQUESTED'},recovery:{state:'PAUSED',automatic:true,authorizationSignupId:'original',previouslyEnabled:true,pauseTimestamp:'10',reason:'USER_RE_REGISTERED',initiatedBy:'USER'}}}};
 assert.equal(customerActivationLifecycleReady(c),false);let view=publicCustomerCoexistence(c,metaCustomerReadiness(environment),0);assert.equal(view.canSelectImport,false);assert.equal(view.recovery.previouslyEnabled,true);assert.equal(view.recovery.reason,'USER_RE_REGISTERED');assert.equal(view.recovery.initiatedBy,'USER');assert.doesNotMatch(JSON.stringify(view),/authorizationSignupId|activationDigest|pauseTimestamp|leaseToken/);
 c.metadata.customerLifecycle={event:'account_reconnected',authorizationSignupId:'original',providerTimestamp:'11'};assert.equal(customerActivationLifecycleReady(c),true);
 c.metadata.coexistence.recovery.automatic=false;c.metadata.coexistence.recovery.state='MANUAL_REVIEW_REQUIRED';assert.equal(customerActivationLifecycleReady(c),false);c.metadata.customerSignupId='new-canonical-grant';assert.equal(customerActivationLifecycleReady(c),true);
 c.metadata.customerSignupId='original';c.metadata.coexistence.recovery.state='KEPT_DISABLED';assert.equal(customerActivationLifecycleReady(c),true);
});
test('ADMIN can stop a pending automatic recovery while the paused channel is already disabled',()=>{
 const c={enabled:false,metadata:{customerActivation:{version:1,state:'ACTIVE'},customerLifecycle:{event:'account_offboarded',recovery:{state:'PAUSED',automatic:true,previouslyEnabled:true,authorizationSignupId:'original',pauseTimestamp:'10'}},customerSignupId:'original'}};
 for(const state of ['PAUSED','VERIFYING','REVIEW_REQUIRED']){c.metadata.customerLifecycle.recovery.state=state;assert.equal(publicCustomerActivation(c,metaCustomerReadiness(environment),{role:'ADMIN'}).canDeactivate,true);assert.equal(publicCustomerActivation(c,metaCustomerReadiness(environment),{role:'DIRECTOR'}).canDeactivate,false);assert.equal(publicCustomerActivation(c,metaCustomerReadiness(environment),{role:'ADMIN'}).canActivate,false);}
 c.metadata.customerActivation.state='DEACTIVATED';assert.equal(publicCustomerActivation(c,metaCustomerReadiness(environment),{role:'ADMIN'}).canDeactivate,false);
});
test('a legacy disconnect without a recovery cursor preserves a restriction and never guesses prior enablement',()=>{
 for(const event of ['partner_removed','account_disconnected','account_offboarded','account_reconnected']){const c={enabled:false,metadata:{customerSignupId:'existing-grant',customerLifecycle:{event,observedAt:'2026-10-01T00:00:00.000Z'}}},before=JSON.stringify(c),recovery=customerLifecycleRecovery(c);assert.equal(recovery.state,'MANUAL_REVIEW_REQUIRED');assert.equal(recovery.automatic,false);assert.equal(recovery.previouslyEnabled,false);assert.equal(customerActivationLifecycleReady(c),false);assert.equal(JSON.stringify(c),before);}
});
test('the canonical transport closes on the same durable restriction even if stale enabled and ACTIVE flags remain',()=>{
 const c={enabled:true,connectionStatus:'CONNECTED',metadata:{customerSubscribed:true,customerSignupId:'existing-grant',customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null},customerActivation:{version:1,state:'ACTIVE',actorId:'owner'}}};assert.equal(customerChannelActive(c),true);
 for(const state of ['PAUSED','VERIFYING','REVIEW_REQUIRED','MANUAL_REVIEW_REQUIRED','KEPT_DISABLED']){c.metadata.customerLifecycle={event:'account_reconnected',recovery:{state,automatic:true,previouslyEnabled:true}};assert.equal(customerChannelActive(c),false);assert.equal(publicCustomerActivation(c,metaCustomerReadiness(environment),{role:'ADMIN'}).operational,false);}
 c.metadata.customerLifecycle.recovery.state='RESTORED';assert.equal(customerChannelActive(c),true);c.metadata.customerLifecycle={event:'partner_removed'};assert.equal(customerChannelActive(c),false);
});
function provider(phones){const calls=[];return {calls,value:createMetaCustomerProvider({environment,fetchImpl:async(url,options)=>{calls.push({url:new URL(url),options});return Response.json(String(url).includes('debug_token')?{data:debug}:String(url).includes('smb_app_data')?{request_id:'synthetic-sync-request'}:phones);}})};}
test('v4, dedicated coexistence configuration and independent release are all required; session schema 3 does not enable ESv3',()=>{
 const ready=metaCustomerReadiness(environment);assert.equal(customerSignupFlow(ready,'BUSINESS_APP').featureType,'whatsapp_business_app_onboarding');
 for(const marker of ['2','3',undefined])assert.equal(metaCustomerReadiness({...environment,META_EMBEDDED_SIGNUP_VERSION:marker}).canLaunchMeta,false);
 for(const patch of [{META_COEXISTENCE_CONFIG_ID:undefined},{META_COEXISTENCE_CONFIG_ID:environment.META_CONFIG_ID},{OBRASAAS_META_COEXISTENCE_RELEASE:undefined}]){const r=metaCustomerReadiness({...environment,...patch});assert.equal(r.flows.DEDICATED.available,true);assert.equal(r.flows.BUSINESS_APP.available,false);assert.throws(()=>customerSignupFlow(r,'BUSINESS_APP'),{code:'META_CUSTOMER_COEXISTENCE_CONFIGURATION_PENDING'});}
 assert.equal(ready.flows.EXISTING_API.available,false);
});
test('waba-only finish resolves exactly one Cloud API business-app phone and never registers',async()=>{
 const {value,calls}=provider({data:[{id:'9999999901',is_on_biz_app:true,platform_type:'CLOUD_API',status:'PENDING'}]});
 const result=await value.inspect({token:'synthetic-token-only',wabaId:'8888888801',phoneNumberId:null,numberMode:'BUSINESS_APP'});assert.equal(result.phoneNumberId,'9999999901');assert.equal(result.registered,true);assert.ok(calls.every(call=>call.options.method==='GET'));assert.ok(calls.every(call=>!call.url.pathname.endsWith('/register')));
 await value.syncAppData({token:'synthetic-token-only',phoneNumberId:result.phoneNumberId,syncType:'history'});const request=calls.at(-1);assert.equal(request.options.method,'POST');assert.equal(request.url.pathname,'/v25.0/9999999901/smb_app_data');assert.deepEqual(JSON.parse(request.options.body),{messaging_product:'whatsapp',sync_type:'history'});assert.doesNotMatch(request.options.body,/pin|register/);
});
test('an unconfirmed ES version blocks new authorization without revoking existing customer transport or prior gates',async()=>{
 let calls=0;const transport=createMetaCustomerProvider({environment:{...environment,META_EMBEDDED_SIGNUP_VERSION:undefined},fetchImpl:async()=>{calls++;return Response.json({data:[]});}});
 assert.equal(transport.readiness().canLaunchMeta,false);assert.equal(transport.readiness().canUseCustomerTransport,true);await transport.inspectSubscription({token:'synthetic-existing-token',wabaId:'8888888801'});assert.equal(calls,1);await assert.rejects(transport.exchange('new-code'),{code:'META_CUSTOMER_CONFIGURATION_PENDING'});assert.equal(calls,1);
 for(const key of ['NEXT_PUBLIC_META_APP_ID','META_APP_SECRET','META_CONFIG_ID','META_GRAPH_API_VERSION','META_CUSTOMER_CREDENTIALS_KEY','OBRASAAS_META_SIGNUP_RELEASE','META_CUSTOMER_VERIFY_TOKEN']){const disabled=createMetaCustomerProvider({environment:{...environment,[key]:undefined},fetchImpl:async()=>{throw new Error('No provider call with missing prior gate');}});await assert.rejects(disabled.inspectSubscription({token:'synthetic-existing-token',wabaId:'8888888801'}),{code:'META_CUSTOMER_CONFIGURATION_PENDING'});}
});
test('existing activation remains available without new signup version, but coexistence proof and prior transport gates cannot be guessed',()=>{
 const time=Date.parse('2026-10-05T12:00:00Z'),readiness=metaCustomerReadiness({...environment,META_EMBEDDED_SIGNUP_VERSION:undefined}),member={role:'ADMIN'},channel={enabled:false,metadata:{coexistence:{verified:true,verifiedAt:'2026-10-05T11:00:00Z'},customerVerification:{registered:true,isOnBizApp:true,platformType:'CLOUD_API'}}};
 assert.equal(publicCustomerActivation(channel,readiness,member,time,'BUSINESS_APP').canActivate,true);assert.equal(publicCustomerActivation(channel,readiness,member,time,'DEDICATED').canActivate,true);assert.equal(publicCustomerActivation(channel,readiness,member,time,'EXISTING_API').canActivate,false);
 for(const metadata of [{...channel.metadata,coexistence:null},{...channel.metadata,coexistence:{verified:true,verifiedAt:'invalid'}},{...channel.metadata,customerVerification:{registered:true,isOnBizApp:false,platformType:'CLOUD_API'}}])assert.equal(publicCustomerActivation({...channel,metadata},readiness,member,time,'BUSINESS_APP').canActivate,false);
 for(const key of Object.keys(readiness.gates).filter(key=>key!=='signupVersion'))assert.equal(publicCustomerActivation(channel,{...readiness,gates:{...readiness.gates,[key]:false}},member,time,'BUSINESS_APP').canActivate,false);
});
test('ambiguous, incomplete, non-app and foreign selection cannot bind a coexistence number',async()=>{
 for(const phones of [{data:[]},{data:[{id:'9999999901',is_on_biz_app:false,platform_type:'CLOUD_API'}]},{data:[{id:'9999999901',is_on_biz_app:true,platform_type:'ON_PREMISE'}]},{data:[{id:'9999999901',is_on_biz_app:true,platform_type:'CLOUD_API'},{id:'9999999902',is_on_biz_app:true,platform_type:'CLOUD_API'}]},{data:[{id:'9999999901',is_on_biz_app:true,platform_type:'CLOUD_API'}],paging:{next:'https://graph.facebook.com/next'}}])await assert.rejects(provider(phones).value.inspect({token:'synthetic-token-only',wabaId:'8888888801',phoneNumberId:null,numberMode:'BUSINESS_APP'}));
 await assert.rejects(provider({data:[{id:'9999999901',is_on_biz_app:true,platform_type:'CLOUD_API'}]}).value.inspect({token:'synthetic-token-only',wabaId:'8888888801',phoneNumberId:'9999999902',numberMode:'BUSINESS_APP'}));
});
const history=(count=51,progress=100)=>({object:'whatsapp_business_account',entry:[{id:'8888888801',changes:[{field:'history',value:{metadata:{phone_number_id:'9999999901'},history:[{metadata:{phase:2,chunk_order:10,progress},threads:[{id:'5491112345678',messages:Array.from({length:count},(_,i)=>({id:'wamid.synthetic_'+String(i).padStart(8,'0'),from:'5491112345678',timestamp:'1700000000',type:'text',text:{body:'Historia sintética '+i}}))}]}]}}]}]});
test('large history is partitioned into immutable bounded source receipts with out-of-order checkpoint identity',()=>{
 const events=splitMetaCustomerEvents(history());assert.equal(events.length,3);assert.deepEqual(events.map(event=>event.payload.checkpoint.part),[0,1,2]);assert.ok(events.every(event=>event.payload.checkpoint.total===3));assert.equal(new Set(events.map(event=>event.payload.checkpoint.chunkDigest)).size,1);assert.equal(events.map(event=>customerAppRecords(event.payload).records.length).reduce((a,b)=>a+b),51);assert.deepEqual(splitMetaCustomerEvents(history()).map(x=>x.externalId),events.map(x=>x.externalId));
 const changed=history();changed.entry[0].changes[0].value.history[0].threads[0].messages[0].text.body='Changed';assert.notEqual(splitMetaCustomerEvents(changed)[0].payloadDigest,events[0].payloadDigest);assert.equal(verifyMetaCustomerSignature(Buffer.from(JSON.stringify(history())),'sha256='+'0'.repeat(64),environment),false);
});
test('history decline is a provider observation without messages, identities or commands',()=>{
 const payload=history(0);payload.entry[0].changes[0].value.history=[{errors:[{code:2593109}]}];const event=splitMetaCustomerEvents(payload)[0];assert.deepEqual(customerAppRecords(event.payload),{records:[],declined:true});
});
test('expired or uncertain requests expose status, and only selected unsent steps permit explicit continuation',()=>{
 const stored={verified:true,syncDeadlineAt:'2026-10-06T00:00:00Z',contacts:{state:'REQUEST_STARTED',leaseExpiresAt:'2026-10-05T00:00:00Z'},history:{state:'NOT_REQUESTED'},importConsent:{operationId:'12345678-1234-4234-8234-123456789012',contacts:true,history:true}};
 const r=publicCustomerCoexistence({metadata:{coexistence:stored}},metaCustomerReadiness(environment),Date.parse('2026-10-05T12:00:00Z'));assert.equal(r.contacts.state,'REQUEST_UNKNOWN');assert.equal(r.canContinueImport,true);assert.equal(r.canSelectImport,false);assert.equal(r.historyCompleteGuaranteed,false);
 assert.equal(publicCustomerCoexistence({metadata:{coexistence:stored}},metaCustomerReadiness(environment),Date.parse('2026-10-07T12:00:00Z')).canContinueImport,false);
});
test('private imported inbox sources never become process/review actions or accepted responses',()=>{
 const context={projectId:'p-a',scope:'a'.repeat(64)},item={id:'meta_app_source_'+'a'.repeat(64),kind:'APP_HISTORY',source:'WHATSAPP_BUSINESS_APP',sourceEventId:'customer_webhook_'+'b'.repeat(64),sourceTimestamp:'1700000000',body:'Historia privada',payloadVerified:true,canProcess:false,canReview:false,businessApplied:false,replySent:false};const dto={...context,inbox:{items:[item]}};
 const view=customerInboxSnapshot(dto,context);assert.equal(view.items[0].source,'WHATSAPP_BUSINESS_APP');assert.equal(customerInboxEventTitle(view.items[0]),'Historial de WhatsApp Business');
 for(const key of ['canProcess','canReview','businessApplied','replySent'])assert.throws(()=>customerInboxSnapshot({...dto,inbox:{items:[{...item,[key]:true}]}},context),{code:'WORKSPACE_CONTEXT_CHANGED'});
 assert.throws(()=>customerInboxSnapshot({...dto,projectId:'p-b'},context),{code:'WORKSPACE_CONTEXT_CHANGED'});
});
test('optimistic coexistence/PIN and invalid import status cannot replace an authorized UI snapshot',()=>{
 const context={projectId:'p-a',scope:'a'.repeat(64)},base={...context,companyName:'Synthetic',projectName:'Synthetic',prepared:true,numberMode:'BUSINESS_APP',readiness:metaCustomerReadiness(environment),signup:{numberMode:'BUSINESS_APP',canRegister:false,registrationRequired:false,canRetryRegistration:false}};
 assert.equal(metaOnboardingSnapshot(base,context),base);assert.throws(()=>metaOnboardingSnapshot({...base,signup:{...base.signup,canRegister:true}},context));
 assert.throws(()=>metaOnboardingSnapshot({...base,readiness:{...base.readiness,flows:{...base.readiness.flows,BUSINESS_APP:{available:true,configId:null}}}},context));
});
