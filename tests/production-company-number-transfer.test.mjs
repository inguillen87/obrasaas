import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {transferInput,assertSinglePhoneGrant,assertTransferSnapshot,transferEnabled} from '../src/lib/company-number-transfer-policy.mjs';
import {companyTransferSnapshot,companyTransferCanLaunchMeta} from '../src/app/(identity)/cuenta/company-number-transfer-view.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {ownCompanyTemplateTransferPending} from '../src/lib/meta-own-company-templates.mjs';
import {historicalAssetRoute,transferObservationInterval} from '../src/lib/company-number-transfer-history.mjs';
test('cached SDK cannot authorize after a fresh PREPARED response disables Meta launch',()=>{
 const now=Date.parse('2026-11-03T12:00:00.000Z'),cachedSdk='14000679001:v25.0';
 const prepared={state:'PREPARED',transferId:'asset_transfer_'+'b'.repeat(64),stateToken:'d'.repeat(64),expiresAt:new Date(now+60000).toISOString(),readiness:{canLaunchMeta:true,appId:'14000679001',version:'v25.0',configId:'14000679002'}};
 const refreshed={...prepared,readiness:{...prepared.readiness,canLaunchMeta:false}};
 assert.equal(companyTransferCanLaunchMeta(prepared,cachedSdk,now),true);
 assert.equal(refreshed.readiness.appId+':'+refreshed.readiness.version,cachedSdk);
 assert.equal(companyTransferCanLaunchMeta(refreshed,cachedSdk,now),false);
 // Execute the real click handler with a synthetic SDK. Do not mount React or call Meta.
 const panel=readFileSync(new URL('../src/app/(identity)/cuenta/company-number-transfer-panel.js',import.meta.url),'utf8');
 const marker=' function authorize(){',start=panel.indexOf(marker),end=panel.indexOf('\n return <section',start);
 assert.ok(start>=0&&end>start&&panel.indexOf(marker,start+marker.length)===-1,'One bounded actual authorize handler');
 const handler=panel.slice(start,end).trim();
 assert.ok(handler.length<3000,'Only the click handler is evaluated');
 const invoke=(value,{sdk=cachedSdk,disabled=false,attempt=null}={})=>{
  const logins=[],effects=[],auth={current:null};
  runInNewContext('('+handler+')()',{value,sdk,disabled,attempt,companyTransferCanLaunchMeta,Date:{now:()=>now},auth,
   setAuthorizing:value=>effects.push(['authorizing',value]),setNotice:value=>effects.push(['notice',value]),
   window:{FB:{login:(callback,options)=>logins.push({callback,options})}}},{timeout:1000});
  return {logins,effects,auth};
 };
 // A fresh backend response retains exactly the same SDK cache key but revokes readiness.
 const revoked=invoke(refreshed);assert.equal(revoked.logins.length,0);assert.deepEqual(revoked.effects,[]);assert.equal(revoked.auth.current,null);
 for(const invalid of [
  {...prepared,readiness:{...prepared.readiness,canLaunchMeta:undefined}},
  {...prepared,readiness:{...prepared.readiness,canLaunchMeta:'true'}},
  {...prepared,readiness:{...prepared.readiness,configId:null}},
  {...prepared,expiresAt:new Date(now).toISOString()},
  {...prepared,expiresAt:'not-a-date'},
  {...prepared,state:'CLOSED'},
 ]){const result=invoke(invalid);assert.equal(result.logins.length,0);assert.deepEqual(result.effects,[]);}
 for(const options of [{sdk:''},{sdk:'another-app:v25.0'},{disabled:true},{attempt:{action:'AUTHORIZE'}}]){
  const result=invoke(prepared,options);assert.equal(result.logins.length,0);assert.deepEqual(result.effects,[]);
 }
 const enabled=invoke(prepared);assert.equal(enabled.logins.length,1);assert.equal(enabled.logins[0].options.config_id,prepared.readiness.configId);
 assert.equal(enabled.auth.current.transferId,prepared.transferId);assert.equal(enabled.effects[0][0],'authorizing');assert.equal(enabled.effects[0][1],true);
 // The rendered button uses the same predicate; the handler separately rechecks it at click time.
 assert.ok(panel.includes('disabled={disabled||Boolean(attempt)||!companyTransferCanLaunchMeta(value,sdk,clock)} onClick={authorize}>Autorizar en Meta'));
 assert.ok(handler.startsWith('function authorize(){if(disabled||attempt||!companyTransferCanLaunchMeta(value,sdk,Date.now()))return;'));
 assert.equal((handler.match(/window\.FB\.login\(/g)||[]).length,1);
});
const scope='a'.repeat(64),phoneNumberId='12000679001',wabaId='13000679001',displayPhoneNumber='+5491100067901';
const environment={VERCEL_ENV:'production',OBRASAAS_COMPANY_NUMBER_TRANSFER_RELEASE:'single-phone-waba-v1',META_COMPANY_TRANSFER_CONFIG_ID:'14000679002',NEXT_PUBLIC_META_APP_ID:OBRASAAS_META_CHANNEL.appId,META_APP_SECRET:'synthetic-only-app-secret-679',META_CONFIG_ID:'14000679001',META_GRAPH_API_VERSION:'v25.0',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,67).toString('base64'),META_CUSTOMER_VERIFY_TOKEN:'synthetic-callback-token-679-'.repeat(2),OBRASAAS_META_SIGNUP_RELEASE:'customer-self-service-v1',META_EMBEDDED_SIGNUP_VERSION:'4'};
const prepare=()=>({action:'PREPARE',operationId:randomUUID(),projectId:'destination-project',scope,sourceConnectionId:'source-channel',sourceRevision:2,companyPhoneRevision:1});
const grant=()=>({origin:'fresh-customer-oauth',token:'fresh-synthetic-oauth-token-679',wabaId,phoneNumberId,inventory:[phoneNumberId],subscribed:true,checkedAt:new Date().toISOString(),verification:{phoneNumberId,displayPhoneNumber,registered:true,platformType:'CLOUD_API',isOnBizApp:false,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:new Date(Date.now()+3600000).toISOString()}});
test('transfer accepts explicit reuse of a reviewed signup config without an implicit fallback',()=>{
 const selected='14000679002',configured={...environment,META_CONFIG_ID:selected,META_COMPANY_TRANSFER_CONFIG_ID:selected};
 assert.equal(transferEnabled(configured),true);
 assert.equal(transferEnabled({...configured,META_CONFIG_ID:undefined,NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID:selected}),true);
 for(const missing of [undefined,null,'','not-a-config'])assert.equal(transferEnabled({...configured,META_COMPANY_TRANSFER_CONFIG_ID:missing}),false);
 assert.equal(transferEnabled({...configured,OBRASAAS_COMPANY_NUMBER_TRANSFER_RELEASE:''}),false);
 assert.equal(transferEnabled({...configured,VERCEL_ENV:'preview'}),false);
});
test('transfer command rejects caller credential/identity fields and requires explicit cutover confirmation',()=>{const good=prepare();assert.equal(transferInput(good).action,'PREPARE');for(const extra of [{token:'old-token'},{organizationId:'other'},{actorId:'other'},{grant:grant()}])assert.throws(()=>transferInput({...good,...extra}),{code:'COMPANY_TRANSFER_INPUT_INVALID'});assert.throws(()=>transferInput({action:'COMMIT',operationId:randomUUID(),projectId:good.projectId,scope,transferId:'asset_transfer_'+'b'.repeat(64),revision:1,confirmTransfer:false}),{code:'COMPANY_TRANSFER_INPUT_INVALID'});});
test('transfer is off without the separate production release flag',()=>{assert.equal(transferEnabled(environment),true);for(const changed of [{VERCEL_ENV:'preview'},{OBRASAAS_COMPANY_NUMBER_TRANSFER_RELEASE:''},{OBRASAAS_COMPANY_NUMBER_TRANSFER_RELEASE:'customer-self-service-v1'}])assert.equal(transferEnabled({...environment,...changed}),false);});
test('complete one-phone WABA grant rejects partial, ambiguous, stale, expired and Business App proofs',()=>{const p={phoneNumberId,wabaId,displayPhoneNumber},good=grant(),now=Date.parse(good.checkedAt);assertSinglePhoneGrant(good,p,now+1);for(const changed of [{inventory:[]},{inventory:[phoneNumberId,'12000679002']},{inventory:[phoneNumberId,phoneNumberId]},{subscribed:false},{origin:'stored-source-token'},{checkedAt:new Date(now-60001).toISOString()},{verification:{...good.verification,isOnBizApp:true}},{verification:{...good.verification,registered:false}},{verification:{...good.verification,expiresAt:new Date(now+299000).toISOString()}}])assert.throws(()=>assertSinglePhoneGrant({...good,...changed},p,now+1),{code:'COMPANY_TRANSFER_PROVIDER_GRANT_REJECTED'});});
test('source revisions and provider membership ABA are part of the immutable prepared authority',()=>{const before={membership:{providerMembershipId:'orgmem_Original',revision:3},channelRevision:2,companyPhoneRevision:1};assertTransferSnapshot(structuredClone(before),before);for(const changed of [{...before,channelRevision:4},{...before,membership:{providerMembershipId:'orgmem_Recreated',revision:3}},{...before,membership:{providerMembershipId:'orgmem_Original',revision:5}},{...before,companyPhoneRevision:2}])assert.throws(()=>assertTransferSnapshot(changed,before),{code:'COMPANY_TRANSFER_CONTEXT_CHANGED'});});
test('UI rejects a receipt for a different organization scope, project or transfer',()=>{const result={available:true,projectId:'destination-project',scope,transferId:'asset_transfer_'+'b'.repeat(64),state:'COMMITTED',revision:4,dataMoved:false,identitiesCopied:false,providerMigrated:false,connected:true,roundTrip:'NOT_VERIFIED'};assert.equal(companyTransferSnapshot(result,{scope,projectId:result.projectId}).state,'COMMITTED');for(const changed of [{scope:'c'.repeat(64)},{projectId:'foreign-project'},{dataMoved:true},{identitiesCopied:true},{providerMigrated:true},{connected:false}])assert.throws(()=>companyTransferSnapshot({...result,...changed},{scope,projectId:result.projectId}));});
function graph({phones=1,more=false,subscription=true,wrongScope=false}={}){const calls=[];const fetchImpl=async(url,options={})=>{assert.equal(options.method||'GET','GET','Transfer grant port must not mutate provider');const u=new URL(url);calls.push(u.pathname);let result;if(u.pathname.endsWith('/oauth/access_token'))result={access_token:'fresh-synthetic-oauth-token-679'};else if(u.pathname.endsWith('/debug_token'))result={data:{is_valid:true,app_id:OBRASAAS_META_CHANNEL.appId,expires_at:Math.floor(Date.now()/1000)+3600,scopes:['whatsapp_business_management','whatsapp_business_messaging'],granular_scopes:[{scope:'whatsapp_business_management',target_ids:[wrongScope?'13000679999':wabaId]}]}};else if(u.pathname.endsWith('/phone_numbers'))result={data:Array.from({length:phones},(_,i)=>({id:i===0?phoneNumberId:'12000679002',display_phone_number:displayPhoneNumber,verified_name:'Synthetic transfer',code_verification_status:'VERIFIED',status:'CONNECTED',is_on_biz_app:false,platform_type:'CLOUD_API'})),...(more?{paging:{next:'https://graph.facebook.com/unfollowed-next'}}:{})};else if(u.pathname.endsWith('/subscribed_apps'))result={data:subscription?[{id:OBRASAAS_META_CHANNEL.appId}]:[]};else assert.fail('Unexpected Graph path');return Response.json(result);};return {calls,provider:createMetaCustomerProvider({environment,fetchImpl})};}
test('actual provider port exchanges a fresh code then verifies complete inventory and existing subscription using GETs only',async()=>{const {provider,calls}=graph();const result=await provider.exchangeTransferGrant({code:'synthetic-code-679',wabaId,phoneNumberId});assertSinglePhoneGrant(result,{wabaId,phoneNumberId,displayPhoneNumber},Date.now());assert.equal(calls.filter(path=>path.endsWith('/oauth/access_token')).length,1);assert.equal(calls.length,4);});
for(const [name,options] of [['multiple phones',{phones:2}],['partial inventory',{more:true}],['foreign WABA scope',{wrongScope:true}],['missing subscription',{subscription:false}]])test('actual provider rejects '+name,async()=>{const {provider}=graph(options);await assert.rejects(provider.exchangeTransferGrant({code:'synthetic-code-679',wabaId,phoneNumberId}));});
test('copied public inspection cannot manufacture the module-private whole-inventory witness',async()=>{const {provider}=graph();provider.inspect=async()=>grant().verification;await assert.rejects(provider.verifyTransferGrant({token:'fresh-synthetic-oauth-token-679',wabaId,phoneNumberId}),{code:'COMPANY_TRANSFER_WABA_SCOPE_REJECTED'});});
function recoveredOwnSubmission(){
 const key='open_attendance_reminder',submitted='11111111-1111-4111-8111-111111111111',recovered='22222222-2222-4222-8222-222222222222',grantDigest='b'.repeat(64),contentSha256='c'.repeat(64),time='2026-11-03T10:00:00.000Z';
 const base={connectionId:'source-channel',blueprintKey:key,grantDigest,contentSha256};
 const original={metadata:{...base,operationId:submitted,action:'SUBMIT_OWN_TEMPLATE',state:'RECORDED',submissionState:'SUBMISSION_UNKNOWN',providerConfirmed:false,lastObservation:{observationRevision:1,providerConfirmed:false,submissionState:'SUBMISSION_UNKNOWN'}}};
 const observed={metadata:{...base,operationId:recovered,action:'RECOVER_OWN_TEMPLATE',state:'RECORDED',submissionState:'SUBMITTED',providerConfirmed:true,lastObservation:{operationId:recovered,observationRevision:2,providerConfirmed:true,submissionState:'SUBMITTED',providerStatus:'APPROVED',observedAt:time}}};
 const draft={definition:{blueprintKey:key,contentSha256},grantDigest,state:'SUBMITTED',submissionOperationId:submitted,observationOperationId:recovered,observationRevision:2,providerId:'280000001',lastConfirmedObservation:{providerId:'280000001',status:'APPROVED',recordedAt:time,source:'PROVIDER_READBACK'}};
 return {key,draft,original,observed,connection:{id:'source-channel',metadata:{ownCompanyTemplateDrafts:{[key]:draft}}}};
}
test('OWN UNKNOWN/started reservations block transfer; RECORDED alone never settles them',()=>{
 const f=recoveredOwnSubmission();
 for(const state of ['SUBMISSION_STARTED','SUBMISSION_UNKNOWN']){const c=structuredClone(f.connection);c.metadata.ownCompanyTemplateDrafts[f.key].state=state;assert.equal(ownCompanyTemplateTransferPending(c,[f.original,f.observed]),true);}
 assert.equal(ownCompanyTemplateTransferPending({...f.connection,metadata:{}},[f.original]),true);
 assert.equal(ownCompanyTemplateTransferPending(f.connection,[f.original]),true,'An old successful draft without its exact current receipt is not readback proof');
 const orphan={metadata:{...f.original.metadata,action:'RECOVER_OWN_TEMPLATE',operationId:randomUUID(),state:'PROVIDER_STARTED',lastObservation:undefined}};
 assert.equal(ownCompanyTemplateTransferPending(f.connection,[f.original,f.observed,orphan]),true,'An orphan recovery reservation must be recovered by its own UUID');
});
test('only the exact later canonical readback releases old OWN uncertainty; old receipt remains unchanged',()=>{
 const f=recoveredOwnSubmission(),before=structuredClone(f.original);assert.equal(ownCompanyTemplateTransferPending(f.connection,[f.original,f.observed]),false);assert.deepEqual(f.original,before);
 const localPrepare={metadata:{...f.original.metadata,operationId:randomUUID(),action:'PREPARE_OWN_TEMPLATE',lastObservation:undefined}};assert.equal(ownCompanyTemplateTransferPending(f.connection,[f.original,localPrepare,f.observed]),false,'A read-only local prepare receipt does not create unresolved provider work');
 for(const changed of [{providerConfirmed:false},{grantDigest:'d'.repeat(64)},{contentSha256:'e'.repeat(64)},{operationId:randomUUID()},{lastObservation:{...f.observed.metadata.lastObservation,observationRevision:1}},{lastObservation:{...f.observed.metadata.lastObservation,observedAt:'2026-11-03T09:00:00.000Z'}}])assert.equal(ownCompanyTemplateTransferPending(f.connection,[f.original,{metadata:{...f.observed.metadata,...changed}}]),true);
 const crashed={metadata:{...f.original.metadata,state:'PROVIDER_STARTED',lastObservation:undefined}};assert.equal(ownCompanyTemplateTransferPending(f.connection,[crashed,f.observed]),false,'The exact original submission is superseded only after canonical recovery fenced its draft');
});
test('ownership intervals retain A then B; same-second/missing timestamps quarantine, current time stays current',()=>{
 const a={generation:1,retiredAt:'2026-11-03T10:00:00.900Z'},b={generation:2,retiredAt:'2026-11-03T10:01:00.200Z'},seconds=s=>String(Date.parse(s)/1000);
 assert.equal(transferObservationInterval([a,b],seconds('2026-11-03T09:59:59Z')).history,a);assert.equal(transferObservationInterval([a,b],seconds('2026-11-03T10:00:59Z')).history,b);assert.equal(transferObservationInterval([a,b],seconds('2026-11-03T10:01:01Z')),null);
 for(const value of [undefined,null,'',0,'0','NaN','1.2',seconds('2026-11-03T10:00:00Z'),seconds('2026-11-03T10:01:00Z')])assert.equal(transferObservationInterval([a,b],value).quarantine,true);
});
test('first-seen account_update is attributed before current routing; unscoped nonmessage fragments never fall through',async()=>{
 const history={generation:1,retiredAt:'2026-11-03T10:00:00.000Z',sourceConnectionId:'old',sourceProjectId:'old-project',sourceOrganizationId:'old-org'};
 const client={async query(sql,args){if(sql.includes('to_regclass'))return {rows:[{ready:true}]};if(sql.includes('pg_advisory_xact_lock')){assert.deepEqual(args,['company-number-transfer:'+wabaId]);return {rows:[]};}if(sql.includes('FROM public."WhatsAppAssetRetirement"'))return {rows:[history]};if(sql.includes("provider='meta-customer-v1'"))return {rows:[]};assert.fail('Historical lifecycle routing must not consult or mutate the current channel');}};
 const event={wabaId,phoneNumberId:null,externalId:'unseen',payload:{field:'account_update',type:'account_update',providerTimestamp:String(Date.parse('2026-11-03T09:59:59Z')/1000),value:{event:'partner_removed'}}};
 assert.equal((await historicalAssetRoute(client,event)).history,history);assert.equal((await historicalAssetRoute(client,{...event,payload:{...event.payload,providerTimestamp:undefined}})).quarantine,true);assert.equal(await historicalAssetRoute(client,{...event,payload:{...event.payload,providerTimestamp:String(Date.parse('2026-11-03T10:00:01Z')/1000)}}),null);
 assert.equal((await historicalAssetRoute(client,{...event,payload:{field:'smb_message_echoes',type:'smb_message_echoes',value:{}}})).quarantine,true);
});
function actualTransferPanelPart(marker,endMarker){
 const source=readFileSync(new URL('../src/app/(identity)/cuenta/company-number-transfer-panel.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
 const start=source.indexOf(marker),end=source.indexOf(endMarker,start+marker.length);
 assert.ok(start>=0&&end>start&&source.indexOf(marker,start+marker.length)===-1,'One bounded actual panel fragment');
 const part=source.slice(start,end);assert.ok(part.length<8000);return part;
}
function actualExpiryEffect(value,initialNow,{opened=true}={}){
 let now=initialNow,cleanup,clock;const timers=[],writes=[],cleared=[];
 runInNewContext(actualTransferPanelPart(' useEffect(()=>{\n  const expiresAt=Date.parse(value?.expiresAt);','\n function authorize(){'),{
  value,opened,Date:{parse:Date.parse,now:()=>now},useEffect:setup=>{cleanup=setup();},
  setClock:next=>{clock=next;writes.push(next);},setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clearTimeout:id=>cleared.push(id),
 },{timeout:1000});
 return {timers,writes,cleared,get clock(){return clock;},setNow:next=>{now=next;},fire:id=>timers[id-1].callback(),cleanup:()=>cleanup?.()};
}
test('accepted transfer time is sampled outside render and actual expiry callback disables the launch at its boundary',()=>{
 const now=Date.parse('2026-11-03T12:00:00Z'),expires=now+60000,sdk='14000679001:v25.0';
 const value={state:'PREPARED',expiresAt:new Date(expires).toISOString(),readiness:{canLaunchMeta:true,appId:'14000679001',version:'v25.0',configId:'14000679002'}};
 const accepted=[],pending={current:{action:'PREPARE'}};let clock;
 const accept=actualTransferPanelPart(' function accept(result){','\n async function load(').trim();
 runInNewContext('('+accept+')(value)',{value,Date:{now:()=>now},setClock:next=>{clock=next;},setValue:next=>accepted.push(next),setAttempt:()=>{},pending,setConfirmed:()=>{},setNotice:()=>{}},{timeout:1000});
 assert.equal(clock,now);assert.equal(accepted[0],value);assert.equal(pending.current,null);
 assert.equal(companyTransferCanLaunchMeta(value,sdk,clock),true);
 const effect=actualExpiryEffect(value,now);assert.deepEqual(effect.writes,[],'No synchronous setState in effect setup');assert.equal(effect.timers[0].delay,60000);
 effect.setNow(expires-1000);effect.fire(1);assert.deepEqual(effect.writes,[],'An early callback must rearm instead of expiring early');assert.equal(effect.timers[1].delay,1000);
 effect.setNow(expires);effect.fire(2);assert.deepEqual(effect.writes,[expires]);assert.equal(companyTransferCanLaunchMeta(value,sdk,effect.clock),false);
 const render=readFileSync(new URL('../src/app/(identity)/cuenta/company-number-transfer-panel.js',import.meta.url),'utf8').split(' return <section')[1];assert.ok(render&&!render.includes('Date.now'));
});
test('actual expiry effect caps long delays and ignores callbacks after replacement or unmount',()=>{
 const now=Date.parse('2026-11-03T12:00:00Z'),expires=now+2147483647+60000,value={state:'PREPARED',expiresAt:new Date(expires).toISOString()};
 const effect=actualExpiryEffect(value,now);assert.equal(effect.timers[0].delay,2147483647);
 effect.setNow(now+2147483647);effect.fire(1);assert.equal(effect.timers[1].delay,60000);assert.deepEqual(effect.writes,[]);
 effect.cleanup();assert.deepEqual(effect.cleared,[2]);effect.setNow(expires+1);effect.fire(2);assert.deepEqual(effect.writes,[],'A stale timer cannot update the replacement or unmounted panel');
 for(const invalid of [{...value,state:'CLOSED'},{...value,expiresAt:'invalid'}])assert.equal(actualExpiryEffect(invalid,now).timers.length,0);
 assert.equal(actualExpiryEffect(value,now,{opened:false}).timers.length,0);
});
test('actual authorization rechecks wall time and cleanup invalidates the live epoch and already-open SDK callback',()=>{
 const now=Date.parse('2026-11-03T12:00:00Z'),expires=now+60000,sdk='14000679001:v25.0';
 const value={state:'PREPARED',transferId:'asset_transfer_'+'b'.repeat(64),stateToken:'d'.repeat(64),expiresAt:new Date(expires).toISOString(),readiness:{canLaunchMeta:true,appId:'14000679001',version:'v25.0',configId:'14000679002'}};
 const handler=actualTransferPanelPart(' function authorize(){','\n return <section').trim();
 const logins=[],effects=[],sent=[],mounted={current:true},auth={current:null},epoch={current:0};let wall=now,cleanup;
 const context={value,sdk,disabled:false,attempt:null,companyTransferCanLaunchMeta,Date:{now:()=>wall},mounted,auth,epoch,
  setAuthorizing:next=>effects.push(next),setNotice:next=>effects.push(next),send:(...args)=>sent.push(args),window:{FB:{login:callback=>logins.push(callback)}},useEffect:setup=>{cleanup=setup();}};
 assert.equal(companyTransferCanLaunchMeta(value,sdk,now),true,'A captured render time can still be unexpired');
 wall=expires;runInNewContext('('+handler+')()',context,{timeout:1000});assert.equal(logins.length,0,'The actual click handler rejects expiry independently of captured render time');
 wall=now;runInNewContext('('+handler+')()',context,{timeout:1000});assert.equal(logins.length,1);
 runInNewContext(actualTransferPanelPart(' useEffect(()=>{mounted.current=true;','\n async function api('),context,{timeout:1000});
 epoch.current=41;const count=effects.length;cleanup();assert.equal(epoch.current,42,'Increment the live counter, never the value captured at effect setup');assert.equal(mounted.current,false);assert.equal(auth.current,null);
 logins[0]({authResponse:{code:'synthetic-unused-code'}});assert.equal(effects.length,count);assert.deepEqual(sent,[]);
});
