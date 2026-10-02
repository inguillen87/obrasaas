import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createMetaSender,prepareMetaPayload,resolveMetaTransport,normalizeWhatsAppRecipient,metaFailure,classifyMetaSubmission} from '../src/lib/meta-whatsapp-transport.mjs';
import {inspectMetaTestNumber,metaTestCheckEnabled,META_TEST_NUMBER,META_TEST_CHECK_PROJECT} from '../scripts/lib/meta-test-number-check.mjs';
import {createMetaTestDispatch,testRecipients} from '../src/lib/meta-test-dispatch.mjs';
// Production-mode fixtures use the fixed PUBLIC asset IDs, never real credentials.
// Every provider request below is intercepted by an explicit fetchImpl fixture.
const phone='1225843560610854',waba='2046153882937995',app='1665088767899217',to='5491112345678',wamid='wamid.'+'A'.repeat(48);
const env={META_WHATSAPP_ACCESS_TOKEN:'synthetic_only_'+'X'.repeat(40),META_PHONE_NUMBER_ID:phone,META_WABA_ID:waba,NEXT_PUBLIC_META_APP_ID:app,META_GRAPH_API_VERSION:'v21.0'};
const acceptance={messaging_product:'whatsapp',messages:[{id:wamid}]};
function sender(response,environment=env){const calls=[];const send=createMetaSender({environment:()=>environment,fetchImpl:async(url,options)=>{calls.push({url,options});if(response instanceof Error)throw response;return typeof response==='function'?response():response;}});return {calls,send};}
for(const value of ['+54 9 11 1234-5678','5491112345678'])test('normalizes formatting, not national dialing guesses '+value,()=>assert.equal(normalizeWhatsAppRecipient(value),to));
for(const value of ['00115551234','+549abc1111','+5491111;123','../1234567','123','9'.repeat(16),null,123456789])test('rejects ambiguous recipient '+String(value),()=>assert.equal(normalizeWhatsAppRecipient(value),null));
test('existing identifier is not replaced with a suffix-matched director number',async()=>{
 const value=sender(Response.json(acceptance));await value.send(to,'Hola\nPrueba real');assert.equal(JSON.parse(value.calls[0].options.body).to,to);
});
test('configuration conflicts fail before making provider calls',async()=>{
 const value=sender(null,{...env,WHATSAPP_TOKEN:'another-token'});const result=await value.send(to,'test');assert.equal(result.code,'META_CONFIG_CONFLICT');assert.equal(value.calls.length,0);
});
for(const change of [{META_WHATSAPP_ACCESS_TOKEN:''},{META_WHATSAPP_ACCESS_TOKEN:'[SENSITIVE]'},{META_PHONE_NUMBER_ID:''},{META_PHONE_NUMBER_ID:'../other'},{META_GRAPH_API_VERSION:'v21.0/x'}])test('no configured provider never creates a simulated receipt '+JSON.stringify(change),async()=>{
 const value=sender(null,{...env,...change});const result=await value.send(to,'test');assert.equal(result.success,false);assert.equal(result.simulated,false);assert.equal(result.messageId,undefined);assert.equal(value.calls.length,0);
});
test('caller cannot override a configured sender',async()=>{const value=sender(null);assert.equal((await value.send(to,'test','555555')).code,'META_SENDER_MISMATCH');assert.equal(value.calls.length,0);});
test('Meta acceptance requires a real-format wamid and never implies delivery',async()=>{
 const value=sender(Response.json(acceptance));const result=await value.send(to,'Hola');assert.equal(result.accepted,true);assert.equal(result.messageId,wamid);assert.equal(result.delivered,false);assert.equal(result.read,false);assert.equal(result.simulated,false);
 assert.equal(value.calls.length,1);assert.equal(value.calls[0].options.redirect,'error');assert.equal(value.calls[0].options.cache,'no-store');
});
for(const data of [{},null,{success:true}, {...acceptance,messages:[]},{...acceptance,messages:[{id:'sandbox_wamid_123'}]},{...acceptance,messages:[{id:'sim_wamid_1'}]}, {...acceptance,messages:[{id:wamid},{id:wamid}]},{...acceptance,error:{code:190}}])
 test('HTTP 200 cannot invent a confirmed message '+JSON.stringify(data),async()=>{
  const value=sender(Response.json(data));const result=await value.send(to,'test');assert.equal(result.state,'UNCONFIRMED');assert.equal(result.success,false);assert.equal(value.calls.length,1);
 });
for(const [code,expected]of [[131030,'META_TEST_RECIPIENT_NOT_ALLOWED'],[190,'META_ACCESS_TOKEN_INVALID'],[131047,'META_SESSION_WINDOW_CLOSED'],[132001,'META_TEMPLATE_NOT_AVAILABLE'],[130429,'META_RATE_LIMITED'],[10,'META_PERMISSION_REQUIRED']])
 test('provider rejection '+code+' has a specific opaque state',async()=>{
  const value=sender(Response.json({error:{code,message:'TOKEN_TO_KEEP_PRIVATE'}},{status:400}));const result=await value.send(to,'test');assert.equal(result.code,expected);assert.equal(result.state,'REJECTED_BY_META');assert.equal(result.providerCode,code);assert.equal(result.success,false);assert.ok(!JSON.stringify(result).includes('TOKEN_TO_KEEP_PRIVATE'));assert.equal(value.calls.length,1);
 });
for(const response of [()=>new Response('{', {status:200}),()=>new Response('X'.repeat(65537)),()=>new Response(null,{status:204}),()=>Response.json({},{status:503})])
 test('truncated oversized or ambiguous reply does not resend '+String(response),async()=>{const value=sender(response);assert.equal((await value.send(to,'test')).state,'UNCONFIRMED');assert.equal(value.calls.length,1);});
test('lost network acknowledgement is unconfirmed, never retried automatically',async()=>{const value=sender(new Error('SECRET'));const result=await value.send(to,'test');assert.equal(result.state,'UNCONFIRMED');assert.equal(value.calls.length,1);assert.ok(!JSON.stringify(result).includes('SECRET'));});
test('interactive object overload does not turn object into text or mutate caller',async()=>{
 const payload={messaging_product:'whatsapp',to,type:'interactive',interactive:{type:'button',body:{text:'Elegí una opción'},action:{buttons:[{type:'reply',reply:{id:'test',title:'Ver opciones'}}]}}};
 const original=structuredClone(payload),value=sender(()=>Response.json(acceptance));await value.send(to,payload);await value.send(payload);assert.deepEqual(payload,original);assert.equal(JSON.parse(value.calls[0].options.body).type,'interactive');
});
for(const payload of [{type:'interactive',interactive:{}},{type:'text',text:{body:'x'.repeat(4097)}},{type:'text',to:'55555555',text:{body:'ok'}},{type:'template',template:{name:'bad name',language:{code:'en_US'}}},{type:'document',document:{link:'https://unit.private.blob.vercel-storage.com/private-document.pdf'}},{type:'document',document:{link:'http://host/file'}},{type:'document',document:{link:'https://user:password@host/file'}}])
 test('invalid or private linked payload is rejected '+payload.type,()=>assert.equal(prepareMetaPayload(to,payload),null));
test('hello_world en_US remains a real template payload',()=>assert.equal(prepareMetaPayload(to,{type:'template',template:{name:'hello_world',language:{code:'en_US'}}}).template.name,'hello_world'));
const inspectResponses=()=>[{id:phone,display_phone_number:'+1 555-153-3706',verified_name:'Test Number'},{data:[{id:phone,display_phone_number:'+1 555-153-3706'}]},{data:[{whatsapp_business_api_data:{id:app,name:'ObraSaaS'}}]},{data:[{name:'hello_world',language:'en_US',status:'APPROVED'}]}];
async function inspect(data=inspectResponses(),environment=env){let i=0;const calls=[];const result=await inspectMetaTestNumber({environment,fetchImpl:async(url,options)=>{calls.push({url,method:options.method||'GET'});return Response.json(data[i++]);}});return {result,calls};}
test('official test assets can be verified without buying or registering a number',async()=>{
 const {result,calls}=await inspect();assert.equal(result.status,'TEST_ASSETS_VERIFIED');assert.equal(result.testNumberMatched,true);assert.equal(result.numberPurchaseRequired,false);assert.equal(result.sentMessages,0);assert.equal(result.actualWebhookVerified,false);assert.equal(result.recipientVerificationChecked,false);assert.equal(result.physicalDeliveryTested,false);assert.ok(calls.every(row=>row.method==='GET'));assert.ok(!JSON.stringify(result).includes(env.META_WHATSAPP_ACCESS_TOKEN));
});
test('wrong test number stops before querying another account',async()=>{const data=inspectResponses();data[0].display_phone_number='+1 555-000-0000';const value=await inspect(data);assert.equal(value.result.status,'SENDER_MISMATCH');assert.equal(value.calls.length,1);});
test('configured phone must belong to the configured WABA',async()=>{const data=inspectResponses();data[1].data=[];const value=await inspect(data);assert.equal(value.result.status,'WABA_MISMATCH');assert.equal(value.calls.length,2);});
for(const index of [2,3])test('absent subscription or approved template remains incomplete '+index,async()=>{const data=inspectResponses();data[index].data=[];assert.equal((await inspect(data)).result.status,'TEST_SETUP_INCOMPLETE');});
test('expired Meta credentials are reported, not connected',async()=>{
 const result=await inspectMetaTestNumber({environment:env,fetchImpl:async()=>Response.json({error:{code:190,message:'SECRET'}},{status:400})});assert.equal(result.code,'META_ACCESS_TOKEN_INVALID');assert.equal(result.sentMessages,0);assert.equal(result.requests,1);
});
test('read-only inspection has no direct fallback credentials',async()=>{const {result,calls}=await inspect([],{});assert.equal(result.status,'CONFIGURATION_INCOMPLETE');assert.equal(calls.length,0);assert.equal(META_TEST_NUMBER,'15551533706');});
const build={OBRASAAS_RUN_META_TEST_CHECK:'read-only-v1',VERCEL_PROJECT_ID:META_TEST_CHECK_PROJECT,VERCEL_ENV:'production',NEXT_PUBLIC_APP_URL:'https://obrasaas.com'};
test('probe is opt-in on the exact product only',()=>{assert.equal(metaTestCheckEnabled({}),false);assert.equal(metaTestCheckEnabled(build),true);});
for(const patch of [{VERCEL_ENV:'preview'},{VERCEL_PROJECT_ID:'another-product'},{OBRASAAS_RUN_META_TEST_CHECK:'send-all'},{NEXT_PUBLIC_APP_URL:'https://chatboc.ar'}])test('probe rejects wrong runtime '+JSON.stringify(patch),()=>assert.throws(()=>metaTestCheckEnabled({...build,...patch})));
const dispatchEnv={...env,META_CHANNEL_MODE:'test',META_TEST_ALLOWED_RECIPIENTS:to};
const req=(body,auth=true)=>new Request('https://obrasaas.com/api/v1/whatsapp/dispatch',{method:'POST',headers:{'content-type':'application/json',...(auth?{authorization:'Bearer unit'}:{})},body:JSON.stringify(body)});
function dispatcher(environment=dispatchEnv,result=classifyMetaSubmission(200,acceptance)){const calls=[];return {calls,handlers:createMetaTestDispatch({environment:()=>environment,authorize:r=>({authorized:r.headers.has('authorization')}),send:async(...args)=>{calls.push(args);return result;}})};}
test('test sender refuses anonymous requests before body or provider',async()=>{const d=dispatcher();assert.equal((await d.handlers.POST(req({},false))).status,401);assert.equal(d.calls.length,0);});
test('no local allowlist never means everyone is permitted',async()=>{const d=dispatcher({...dispatchEnv,META_TEST_ALLOWED_RECIPIENTS:''});assert.equal((await d.handlers.POST(req({recipientPhone:to,messageType:'hello_world'}))).status,403);assert.equal(d.calls.length,0);});
test('explicit allowed test recipient gets only requested hello_world',async()=>{const d=dispatcher();const response=await d.handlers.POST(req({recipientPhone:to,messageType:'hello_world'}));assert.equal(response.status,200);assert.equal(d.calls[0][1].template.name,'hello_world');assert.equal((await response.json()).delivered,false);});
test('invalid allowlist rejects the entire configuration',()=>assert.deepEqual(testRecipients({META_TEST_ALLOWED_RECIPIENTS:to+',not-a-number'}),[]));
test('business template with invented details cannot be dispatched by the test endpoint',async()=>{const d=dispatcher();assert.equal((await d.handlers.POST(req({recipientPhone:to,messageType:'art_alert'}))).status,409);assert.equal(d.calls.length,0);});
test('provider test-recipient rejection reaches the service caller unchanged',async()=>{const d=dispatcher(dispatchEnv,metaFailure('META_TEST_RECIPIENT_NOT_ALLOWED','REJECTED_BY_META',{providerCode:131030}));const response=await d.handlers.POST(req({recipientPhone:to,messageType:'hello_world'}));assert.equal(response.status,422);assert.equal((await response.json()).code,'META_TEST_RECIPIENT_NOT_ALLOWED');assert.equal(d.calls.length,1);});
test('status distinguishes configuration from connection and delivery',async()=>{const d=dispatcher();const response=await d.handlers.GET(req({}));const body=await response.json();assert.equal(body.providerVerified,false);assert.equal(body.deliveryVerified,false);assert.equal(body.state,'CONFIGURATION_PRESENT');});
test('transport integration has no synthetic message ids or raw Meta logs',()=>{
 const file=readFileSync(new URL('../src/lib/whatsappNotifications.js',import.meta.url),'utf8');assert.doesNotMatch(file,/sim_wamid|sandbox_wamid|sim_tpl|sandbox_tpl|sim_doc|sandbox_doc|res\.text\(/);
 const route=readFileSync(new URL('../src/app/api/v1/whatsapp/dispatch/route.js',import.meta.url),'utf8');assert.doesNotMatch(route,/getAppState|saveAppState|fetch\(|La Segunda|Juan Zapata/);
});

test('webhook scope rejects other WABA/number before operational state access',async()=>{
 const {validateMetaEnvelope}=await import('../src/lib/meta-webhook-scope.mjs');
 const payload={object:'whatsapp_business_account',entry:[{id:waba,changes:[{field:'messages',value:{metadata:{phone_number_id:phone},messages:[{from:to,id:wamid,type:'text',text:{body:'test'}}]}}]}]};
 assert.equal(validateMetaEnvelope(payload,dispatchEnv).ok,true);
 const crossed=structuredClone(payload);crossed.entry[0].id='9999999';assert.equal(validateMetaEnvelope(crossed,dispatchEnv).code,'META_WEBHOOK_WABA_MISMATCH');
 crossed.entry[0].id=waba;crossed.entry[0].changes[0].value.metadata.phone_number_id='9999999';assert.equal(validateMetaEnvelope(crossed,dispatchEnv).code,'META_WEBHOOK_PHONE_MISMATCH');
 assert.equal(validateMetaEnvelope(payload,{...dispatchEnv,META_TEST_ALLOWED_RECIPIENTS:''}).code,'META_TEST_RECIPIENTS_REQUIRED');
 assert.equal(validateMetaEnvelope(payload,{...dispatchEnv,META_TEST_ALLOWED_RECIPIENTS:'5491199999999'}).code,'META_LOCAL_TEST_RECIPIENT_NOT_ALLOWED');
 const batch=structuredClone(payload);batch.entry.push(payload.entry[0]);assert.equal(validateMetaEnvelope(batch,dispatchEnv).code,'META_BATCH_REQUIRES_DURABLE_INGRESS');
 const route=readFileSync(new URL('../src/app/api/whatsapp/route.js',import.meta.url),'utf8');assert.doesNotMatch(route,/getAppState|saveAppState|processLegacy|resolveRole|analyzeDni|verifyFacial|registerAttendance/);
 assert.doesNotMatch(route,/targetNumber = '542|state: state|fallback to rich text/i);
});

test('send probe requires an explicit recipient and verified test assets',async()=>{
 const {runMetaTestCheck}=await import('../scripts/lib/meta-test-number-check.mjs');let writes=0,index=0;const data=inspectResponses();
 const fetchImpl=async(_url,options)=>{if(options.method==='POST')writes++;return Response.json(data[index++]);};
 const result=await runMetaTestCheck({environment:{...env,...build,OBRASAAS_RUN_META_TEST_CHECK:'send-hello-world-once-v1'},fetchImpl});
 assert.equal(result.probeSend.attempted,false);assert.equal(writes,0);
});
test('send probe transmits exactly one approved template and does not equate acceptance with delivery',async()=>{
 const {runMetaTestCheck}=await import('../scripts/lib/meta-test-number-check.mjs');let index=0,writes=0;const data=inspectResponses();
 const result=await runMetaTestCheck({environment:{...env,...build,OBRASAAS_RUN_META_TEST_CHECK:'send-hello-world-once-v1',OBRASAAS_META_TEST_RECIPIENT:to},fetchImpl:async(_url,options)=>{
  if(options.method==='POST'){writes++;assert.equal(JSON.parse(options.body).to,to);assert.equal(JSON.parse(options.body).template.name,'hello_world');return Response.json(acceptance);}return Response.json(data[index++]);
 }});assert.equal(result.acceptedMessages,1);assert.equal(result.sentMessages,0);assert.equal(writes,1);assert.equal(result.probeSend.delivered,false);assert.equal(result.physicalDeliveryTested,false);
});
test('send probe returns 131030 without a second request or a simulated id',async()=>{
 const {runMetaTestCheck}=await import('../scripts/lib/meta-test-number-check.mjs');let index=0,writes=0;const data=inspectResponses();
 const result=await runMetaTestCheck({environment:{...env,...build,OBRASAAS_RUN_META_TEST_CHECK:'send-hello-world-once-v1',OBRASAAS_META_TEST_RECIPIENT:to},fetchImpl:async(_url,options)=>{
  if(options.method==='POST'){writes++;return Response.json({error:{code:131030,message:'private'}},{status:400});}return Response.json(data[index++]);
 }});assert.equal(result.sentMessages,0);assert.equal(writes,1);assert.equal(result.probeSend.code,'META_TEST_RECIPIENT_NOT_ALLOWED');assert.equal(result.probeSend.messageId,undefined);
});
