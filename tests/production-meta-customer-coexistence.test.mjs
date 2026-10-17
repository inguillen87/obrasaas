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
const appPhone=(id='9999999901',display='+15550001001',patch={})=>({id,display_phone_number:display,is_on_biz_app:true,platform_type:'CLOUD_API',status:'PENDING',...patch});
const nextPhones=(after,patch={})=>({cursors:{after},next:'https://graph.facebook.com/v25.0/8888888801/phone_numbers?'+new URLSearchParams({after}),...patch});
const appInspection={token:'synthetic-token-only',wabaId:'8888888801',phoneNumberId:null,numberMode:'BUSINESS_APP'};
function phoneCatalog(pages){
 const calls=[];let page=0;
 const value=createMetaCustomerProvider({environment,fetchImpl:async(url,options)=>{
  const parsed=new URL(url);calls.push({url:parsed,options});
  assert.equal(parsed.origin,'https://graph.facebook.com');assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
  if(parsed.pathname==='/v25.0/debug_token')return Response.json({data:debug});
  assert.equal(parsed.pathname,'/v25.0/8888888801/phone_numbers');assert.equal(options.headers.Authorization,'Bearer '+appInspection.token);assert.equal(parsed.searchParams.get('limit'),'100');assert.equal(parsed.searchParams.get('fields'),'id,display_phone_number,verified_name,code_verification_status,status,is_on_biz_app,platform_type');assert.match(parsed.searchParams.get('appsecret_proof'),/^[a-f0-9]{64}$/);
  assert.ok(page<pages.length,'Unexpected catalog request after the bounded fixture');return Response.json(pages[page++]);
 }});
 return {value,calls};
}
test('customer Business App resolves the exact declared phone only after a complete multi-page catalog',async()=>{
 const f=phoneCatalog([{data:[appPhone()],paging:nextPhones('page_2')},{data:[appPhone('9999999902','1 (555) 000-1002'),appPhone('9999999903','+15550001003',{is_on_biz_app:false})]}]);
 const selected=await f.value.inspect({...appInspection,expectedPhoneE164:'+15550001002'});
 assert.equal(selected.phoneNumberId,'9999999902');assert.equal(selected.displayPhoneNumber,'1 (555) 000-1002');assert.equal(selected.registered,true);assert.equal(f.calls.length,3);assert.equal(f.calls[1].url.searchParams.has('after'),false);assert.equal(f.calls[2].url.searchParams.get('after'),'page_2');assert.equal(f.calls[1].url.searchParams.get('appsecret_proof'),f.calls[2].url.searchParams.get('appsecret_proof'));
});
test('an explicit eligible phone can select among multiple customer Business App numbers with or without a declaration',async()=>{
 for(const expectedPhoneE164 of [undefined,null,'+15550001002']){
  const f=phoneCatalog([{data:[appPhone()],paging:nextPhones('page_2')},{data:[appPhone('9999999902','+15550001002')]}]);
  const selected=await f.value.inspect({...appInspection,phoneNumberId:'9999999902',expectedPhoneE164});assert.equal(selected.phoneNumberId,'9999999902');assert.equal(f.calls.length,3);
 }
});
test('explicit phone and declared phone must agree; a matching alternate entry cannot replace the selected asset',async()=>{
 const f=phoneCatalog([{data:[appPhone(),appPhone('9999999902','+15550001002')]}]);
 await assert.rejects(f.value.inspect({...appInspection,phoneNumberId:'9999999901',expectedPhoneE164:'+15550001002'}),{code:'META_CUSTOMER_COMPANY_PHONE_MISMATCH'});assert.equal(f.calls.length,2);
 const foreign=phoneCatalog([{data:[appPhone(),appPhone('9999999902','+15550001002',{is_on_biz_app:false})]}]);
 await assert.rejects(foreign.value.inspect({...appInspection,phoneNumberId:'9999999902',expectedPhoneE164:'+15550001001'}),{code:'META_CUSTOMER_COEXISTENCE_PHONE_REQUIRED'});
});
test('waba-only declared selection rejects zero and multiple normalized matches without inferring Argentine mobile aliases',async()=>{
 for(const [phones,expectedPhoneE164,code] of [
  [[appPhone()],'+15550001002','META_CUSTOMER_COMPANY_PHONE_MISMATCH'],
  [[appPhone('9999999901','+54 11 1234-5678')],'+5491112345678','META_CUSTOMER_COMPANY_PHONE_MISMATCH'],
  [[appPhone('9999999901','+5491112345678')],'+541112345678','META_CUSTOMER_COMPANY_PHONE_MISMATCH'],
  [[appPhone(),appPhone('9999999902','1 (555) 000-1001')],'+15550001001','META_CUSTOMER_PHONE_SELECTION_REQUIRED']
 ]){const f=phoneCatalog([{data:phones}]);await assert.rejects(f.value.inspect({...appInspection,expectedPhoneE164}),{code});assert.equal(f.calls.length,2);}
});
test('without a declaration the legacy single eligible customer phone remains sufficient after complete pagination',async()=>{
 const f=phoneCatalog([{data:[appPhone('9999999902','+15550001002',{is_on_biz_app:false})],paging:nextPhones('page_2')},{data:[appPhone()]}]);
 assert.equal((await f.value.inspect(appInspection)).phoneNumberId,'9999999901');assert.equal(f.calls.length,3);
 const ambiguous=phoneCatalog([{data:[appPhone(),appPhone('9999999902','+15550001002')]}]);await assert.rejects(ambiguous.value.inspect(appInspection));
});
test('malformed declaration and path assets are rejected before any customer provider request',async()=>{
 for(const patch of [
  ...['15550001001','+1 (555) 000-1001','+0123456789','+123',123,{value:'+15550001001'}].map(expectedPhoneE164=>({expectedPhoneE164})),
  ...[8888888801,'8888888801/phone_numbers','8888888801?token=foreign'].map(wabaId=>({wabaId})),
  ...[9999999901,'','9999999901/other'].map(phoneNumberId=>({phoneNumberId}))
 ]){const f=phoneCatalog([]);await assert.rejects(f.value.inspect({...appInspection,...patch}));assert.equal(f.calls.length,0);}
});
test('every customer phone item must have a unique exact string ID and sufficient classification fields',async()=>{
 for(const invalid of [null,[],42,appPhone(9999999901),appPhone('9007199254740993',{bad:'display'}),appPhone('9999999902','+15550001002',{is_on_biz_app:'true'}),appPhone('9999999902','+15550001002',{platform_type:null}),appPhone('9999999902','+15550001002',{status:1})]){
  const f=phoneCatalog([{data:[appPhone(),invalid]}]);await assert.rejects(f.value.inspect({...appInspection,phoneNumberId:'9999999901'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(f.calls.length,2);
 }
 for(const second of [appPhone(),appPhone('9999999901','+15550001002')]){const f=phoneCatalog([{data:[appPhone()],paging:nextPhones('page_2')},{data:[second]}]);await assert.rejects(f.value.inspect({...appInspection,phoneNumberId:'9999999901'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(f.calls.length,3);}
});
test('a malformed eligible phone display cannot be silently omitted while matching a declaration',async()=>{
 for(const display of [undefined,'5550001','+0123456789','+15550001002 ext 1']){const f=phoneCatalog([{data:[appPhone(),{...appPhone('9999999902'),display_phone_number:display}]}]);await assert.rejects(f.value.inspect({...appInspection,expectedPhoneE164:'+15550001001'}),{code:'META_CUSTOMER_COMPANY_PHONE_UNCONFIRMED'});}
});
test('customer phone pagination validates terminal pages before using an earlier matching number',async()=>{
 for(const last of [{data:null},{data:[appPhone('9999999902')],paging:[]},{data:[],paging:null},{data:[],paging:{cursors:null}},{data:[],paging:{cursors:{after:'bad cursor'}}},{data:[],paging:{next:null}}]){
  const f=phoneCatalog([{data:[appPhone()],paging:nextPhones('page_2')},last]);await assert.rejects(f.value.inspect({...appInspection,expectedPhoneE164:'+15550001001'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(f.calls.length,3);
 }
 const finalCursor=phoneCatalog([{data:[appPhone()],paging:nextPhones('page_2')},{data:[],paging:{cursors:{after:'page_2'}}}]);assert.equal((await finalCursor.value.inspect({...appInspection,expectedPhoneE164:'+15550001001'})).phoneNumberId,'9999999901');
});
test('customer phone continuation rejects repeated malformed or missing cursors and never follows an injected host or path',async()=>{
 for(const paging of [
  {next:'https://evil.example/phones',cursors:{after:'page_2'}},nextPhones('page_2',{next:'https://graph.facebook.com/v25.0/other/phone_numbers?after=page_2'}),
  nextPhones('page_2',{next:'https://graph.facebook.com.evil.example/v25.0/8888888801/phone_numbers?after=page_2'}),
  nextPhones('page_2',{next:'https://user@graph.facebook.com/v25.0/8888888801/phone_numbers?after=page_2'}),
  nextPhones('page_2',{next:'http://graph.facebook.com/v25.0/8888888801/phone_numbers?after=page_2'}),
  nextPhones('page_2',{next:'https://graph.facebook.com/v25.0/8888888801/phone_numbers?after=other'}),
  nextPhones('page_2',{next:'https://graph.facebook.com/v25.0/8888888801/phone_numbers?after=page_2&after=page_2'}),
  {next:'https://graph.facebook.com/v25.0/8888888801/phone_numbers?after=page_2'},
  ...['','bad cursor','%2F','x'.repeat(2049),12].map(cursor=>nextPhones(cursor))
 ]){const f=phoneCatalog([{data:[appPhone()],paging}]);await assert.rejects(f.value.inspect({...appInspection,expectedPhoneE164:'+15550001001'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(f.calls.length,2);}
 const repeated=phoneCatalog([{data:[appPhone()],paging:nextPhones('page_2')},{data:[],paging:nextPhones('page_2')}]);await assert.rejects(repeated.value.inspect({...appInspection,expectedPhoneE164:'+15550001001'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(repeated.calls.length,3);
});
test('continuation reconstructs fields limit and authorization instead of trusting a provider URL query',async()=>{
 const paging=nextPhones('page_2',{next:'https://graph.facebook.com/v25.0/8888888801/phone_numbers?after=page_2&access_token=foreign&appsecret_proof=foreign&fields=foreign&limit=1'}),f=phoneCatalog([{data:[appPhone()],paging},{data:[appPhone('9999999902','+15550001002')]}]);
 assert.equal((await f.value.inspect({...appInspection,expectedPhoneE164:'+15550001002'})).phoneNumberId,'9999999902');assert.equal(f.calls[2].url.searchParams.has('access_token'),false);assert.notEqual(f.calls[2].url.searchParams.get('appsecret_proof'),'foreign');assert.equal(f.calls[2].url.searchParams.size,4);
});
test('the complete ten-page thousand-item boundary is accepted and an eleventh page or oversized page cannot yield a selection',async()=>{
 const pages=Array.from({length:10},(_,page)=>({data:Array.from({length:100},(_,index)=>{const n=page*100+index;return appPhone(String(9990000000+n),'+1555'+String(n).padStart(7,'0'));}),...(page<9?{paging:nextPhones('page_'+(page+2))}:{})}));
 const complete=phoneCatalog(pages);assert.equal((await complete.value.inspect({...appInspection,expectedPhoneE164:'+15550000999'})).phoneNumberId,'9990000999');assert.equal(complete.calls.length,11);
 const truncatedPages=structuredClone(pages);truncatedPages[9].paging=nextPhones('page_11');const truncated=phoneCatalog(truncatedPages);await assert.rejects(truncated.value.inspect({...appInspection,expectedPhoneE164:'+15550000000'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(truncated.calls.length,11);
 const oversized=phoneCatalog([{data:Array.from({length:101},(_,index)=>appPhone(String(9990000000+index),'+1555'+String(index).padStart(7,'0')))}]);await assert.rejects(oversized.value.inspect({...appInspection,phoneNumberId:'9990000000'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(oversized.calls.length,2);
});
test('dedicated and custom demo inspection retain their prior single-page and single-eligible restrictions',async()=>{
 const dedicated=phoneCatalog([{data:[appPhone('9999999901','+15550001001',{is_on_biz_app:false})],paging:nextPhones('page_2')}]);await assert.rejects(dedicated.value.inspect({...appInspection,numberMode:'DEDICATED',phoneNumberId:'9999999901'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});assert.equal(dedicated.calls.length,2);
 const demoGates={fixedAssets:true,testMode:true,credential:true,vault:true,signature:true,version:true,recipients:true},demo=createMetaCustomerProvider({environment,readiness:()=>({canLaunchMeta:true,appId:OBRASAAS_META_CHANNEL.appId,version:'v25.0',gates:demoGates}),fetchImpl:async url=>Response.json(new URL(url).pathname.endsWith('/debug_token')?{data:debug}:{data:[appPhone(),appPhone('9999999902','+15550001002')]})});await assert.rejects(demo.inspect({...appInspection,phoneNumberId:'9999999901'}),{code:'META_CUSTOMER_PHONE_SELECTION_REQUIRED'});
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
