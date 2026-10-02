import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {META_CUSTOMER_PROTOCOL,META_DEMO_PILOT_PROTOCOL,resolveMetaCloudProtocol,metaCloudEventId} from '../src/lib/meta-cloud-protocol.mjs';
import {metaDemoTransportReadiness,demoPilotCommand,META_DEMO_NOTICE_VERSION,META_DEMO_NOTICE_SHA256,labelDemoPilotReply,decodeDemoPilotGrant,assertDemoPilotConnection} from '../src/lib/meta-demo-pilot-policy.mjs';
import {splitMetaAppEvents,splitMetaDemoPilotEvents,splitMetaCustomerEvents,createMetaCustomerCallbackHandlers} from '../src/lib/meta-customer-callback.mjs';
import {createMetaAppCallback,metaAppHandshakeDiagnostics,createMetaAppHandshakeGet} from '../src/lib/meta-app-callback.mjs';
import {decodeSignedCloudEvent,decodeSignedCustomerEvent} from '../src/lib/meta-customer-processing.mjs';
import {encryptCustomerSecret,customerSecretDigest} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaDemoPilotHandlers} from '../src/lib/meta-demo-pilot-http.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';
import {demoEnvironment,demoToken,demoSender,demoSession,demoEnvelope,signedDemoRequest} from '../scripts/fixtures/meta-demo-pilot-fixture.mjs';

const context={projectId:'demo-project',scope:'a'.repeat(64)},grantId='demo_grant_'+'b'.repeat(64);
function connection(){
 const c={id:'demo-channel',organizationId:'demo-org',projectId:context.projectId,phoneNumberId:OBRASAAS_META_CHANNEL.phoneNumberId,whatsappBusinessId:OBRASAAS_META_CHANNEL.wabaId,enabled:true,connectionStatus:'CONNECTED',metadata:{credentialFormat:META_DEMO_PILOT_PROTOCOL.credentialFormat,credentialOrganizationId:'demo-org',demoPilot:{version:1,purpose:'DEMO_PILOT',grantId,state:'ACTIVE'}}};
 const grant={version:1,purpose:'DEMO_PILOT',grantId,organizationId:c.organizationId,projectId:c.projectId,channelId:c.id,workerId:'demo-worker',actorId:'demo-owner',membershipId:'demo-member',clerkUserId:demoSession.userId,senderE164:'+'+demoSender,appId:OBRASAAS_META_CHANNEL.appId,wabaId:c.whatsappBusinessId,phoneNumberId:c.phoneNumberId,noticeVersion:META_DEMO_NOTICE_VERSION,noticeSha256:META_DEMO_NOTICE_SHA256,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+1800000).toISOString(),credentialDigest:customerSecretDigest(demoToken)};
 const aad={organizationId:c.organizationId,projectId:c.projectId};
 c.metadata.demoPilot.encryptedGrant=encryptCustomerSecret(JSON.stringify(grant),{...aad,purpose:'demo-pilot-grant',resourceId:grantId},demoEnvironment);
 c.encryptedAccessToken=encryptCustomerSecret(demoToken,{...aad,purpose:META_DEMO_PILOT_PROTOCOL.credentialPurpose,resourceId:c.phoneNumberId},demoEnvironment);return c;
}
test('Demo readiness is configuration only and each missing prerequisite fails closed',()=>{
 assert.equal(metaDemoTransportReadiness(demoEnvironment).canLaunchMeta,true);
 for(const key of ['META_APP_ID','META_PHONE_NUMBER_ID','META_WABA_ID','META_WHATSAPP_ACCESS_TOKEN','META_CHANNEL_MODE','META_TEST_ALLOWED_RECIPIENTS','META_APP_SECRET','META_GRAPH_API_VERSION','META_CUSTOMER_CREDENTIALS_KEY']){
  const env={...demoEnvironment,[key]:''};if(key==='META_APP_ID')env.NEXT_PUBLIC_META_APP_ID='';assert.equal(metaDemoTransportReadiness(env).canLaunchMeta,false,key);
 }
 assert.equal(metaDemoTransportReadiness(demoEnvironment).productionVerified,false);
 assert.equal(metaDemoTransportReadiness(demoEnvironment).customerActivation,false);
});
test('protocols are internal capabilities and copied/browser configuration cannot choose a lane',()=>{
 assert.equal(resolveMetaCloudProtocol(META_CUSTOMER_PROTOCOL),META_CUSTOMER_PROTOCOL);
 assert.equal(resolveMetaCloudProtocol(META_DEMO_PILOT_PROTOCOL),META_DEMO_PILOT_PROTOCOL);
 assert.throws(()=>resolveMetaCloudProtocol({...META_DEMO_PILOT_PROTOCOL}),{code:'META_CLOUD_PROTOCOL_REJECTED'});
});
test('app dispatcher supports both asset namespaces while customer refuses TestNumber',()=>{
 const demo=demoEnvelope('MENU'),customer=structuredClone(demo);customer.entry[0].id='130000011';customer.entry[0].changes[0].value.metadata.phone_number_id='120000011';
 assert.equal(splitMetaAppEvents({...demo,entry:[...demo.entry,...customer.entry]}).length,2);
 assert.throws(()=>splitMetaCustomerEvents(demo),{code:'META_CUSTOMER_DEMO_ASSET_REJECTED'});
 assert.throws(()=>splitMetaDemoPilotEvents(customer),{code:'META_DEMO_ASSET_REJECTED'});
});
test('both notices are mandatory and arbitrary recipient/assets or proactive actions are rejected',()=>{
 const command={...context,operationId:randomUUID(),action:'PREPARE',payload:{workerId:'demo-worker',revision:'2026-10-02T01:00:00.000001',noticeVersion:META_DEMO_NOTICE_VERSION,noticeSha256:META_DEMO_NOTICE_SHA256,confirmed:true,confirmedSandbox:true}};
 assert.equal(demoPilotCommand(command).action,'PREPARE');
 for(const field of ['confirmed','confirmedSandbox'])assert.throws(()=>demoPilotCommand({...command,payload:{...command.payload,[field]:false}}),{code:'META_DEMO_PILOT_CONSENT_REQUIRED'});
 for(const field of ['to','phone','wabaId','token'])assert.throws(()=>demoPilotCommand({...command,payload:{...command.payload,[field]:'untrusted'}}),{code:'META_DEMO_INPUT_INVALID'});
 assert.throws(()=>demoPilotCommand({...command,action:'SEND_TEMPLATE'}),{code:'META_DEMO_INPUT_INVALID'});
});
test('grant is tenant-bound, expiring, revocable and tied to unchanged server credential',()=>{
 const c=connection();assert.equal(assertDemoPilotConnection(c,c.organizationId,c.projectId,Date.now(),{},demoEnvironment),c);
 assert.throws(()=>decodeDemoPilotGrant({...c,organizationId:'foreign'},demoEnvironment),{code:'META_DEMO_PILOT_PROOF_REQUIRED'});
 assert.throws(()=>assertDemoPilotConnection(c,c.organizationId,c.projectId,Date.now()+3600000,{},demoEnvironment),{code:'META_DEMO_PILOT_INACTIVE'});
 assert.throws(()=>assertDemoPilotConnection(c,c.organizationId,c.projectId,Date.now(),{},{...demoEnvironment,META_WHATSAPP_ACCESS_TOKEN:'synthetic-rotated-token-not-real'}),{code:'META_DEMO_PILOT_INACTIVE'});
 assert.throws(()=>assertDemoPilotConnection({...c,enabled:false},c.organizationId,c.projectId,Date.now(),{},demoEnvironment),{code:'META_DEMO_PILOT_INACTIVE'});
});
test('HMAC proof cannot be promoted to customer, another grant or another payload',()=>{
 const c=connection(),value=splitMetaDemoPilotEvents(demoEnvelope('MENU'))[0],id=metaCloudEventId(META_DEMO_PILOT_PROTOCOL,value.externalId),aad={organizationId:c.organizationId,projectId:c.projectId,resourceId:id};
 const proof={scheme:META_DEMO_PILOT_PROTOCOL.scheme,purpose:'DEMO_PILOT',grantId,appId:OBRASAAS_META_CHANNEL.appId,payloadDigest:value.payloadDigest,channelId:c.id,organizationId:c.organizationId};
 const event={id,provider:META_DEMO_PILOT_PROTOCOL.provider,projectId:c.projectId,payload:{signatureVerified:true,signatureScheme:META_DEMO_PILOT_PROTOCOL.scheme,channelPurpose:'DEMO_PILOT',grantId,organizationId:c.organizationId,channelId:c.id,payloadDigest:value.payloadDigest,encryptedPayload:encryptCustomerSecret(JSON.stringify(value.payload),{...aad,purpose:META_DEMO_PILOT_PROTOCOL.payloadPurpose},demoEnvironment),encryptedProof:encryptCustomerSecret(JSON.stringify(proof),{...aad,purpose:META_DEMO_PILOT_PROTOCOL.proofPurpose},demoEnvironment)}};
 assert.equal(decodeSignedCloudEvent(event,c,demoEnvironment,META_DEMO_PILOT_PROTOCOL).value.text.body,'MENU');
 assert.throws(()=>decodeSignedCustomerEvent(event,c,demoEnvironment),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});
 assert.throws(()=>decodeSignedCloudEvent(event,{...c,metadata:{...c.metadata,demoPilot:{...c.metadata.demoPilot,grantId:'demo_grant_'+'c'.repeat(64)}}},demoEnvironment,META_DEMO_PILOT_PROTOCOL),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});
 assert.throws(()=>decodeSignedCloudEvent({...event,payload:{...event.payload,payloadDigest:'f'.repeat(64)}},c,demoEnvironment,META_DEMO_PILOT_PROTOCOL),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});
});
test('HMAC precedes inbox and scheduling follows durable recording',async()=>{
 let records=0,wakes=0;const handlers=createMetaCustomerCallbackHandlers({protocol:META_DEMO_PILOT_PROTOCOL,environment:demoEnvironment,verifyTokenName:'META_VERIFY_TOKEN',inbox:{record:async()=>{records++;return {durable:true,eventIds:['demo_webhook_'+'a'.repeat(64)]};}},schedule:()=>{assert.equal(records,1);wakes++;}});
 assert.equal((await handlers.POST(new Request('https://obrasaas.com/api/whatsapp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(demoEnvelope('MENU'))}))).status,403);assert.equal(records,0);
 assert.equal((await handlers.POST(signedDemoRequest(demoEnvelope('MENU')))).status,200);assert.equal(wakes,1);
});
test('unconfirmed inbox is not acknowledged and handshake rejects ambiguous query',async()=>{
 let wakes=0;const handlers=createMetaCustomerCallbackHandlers({protocol:META_DEMO_PILOT_PROTOCOL,environment:demoEnvironment,verifyTokenName:'META_VERIFY_TOKEN',inbox:{record:async()=>({durable:false})},schedule:()=>{wakes++;}});
 assert.equal((await handlers.POST(signedDemoRequest(demoEnvelope('MENU')))).status,503);assert.equal(wakes,0);
 const u=new URL('https://obrasaas.com/api/whatsapp');u.search=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':demoEnvironment.META_VERIFY_TOKEN,'hub.challenge':'123456'});
 assert.equal(await(await handlers.GET(new Request(u))).text(),'123456');u.searchParams.append('hub.challenge','7');assert.equal((await handlers.GET(new Request(u))).status,400);
});
test('canonical app handshake echoes bounded opaque challenges exactly without database or scheduler access',async()=>{
 let connects=0,wakes=0;const handlers=createMetaAppCallback({environment:demoEnvironment,connect:async()=>{connects++;throw new Error('GET must not connect');},schedule:()=>{wakes++;}});
 for(const challenge of ['1158201444','000123','opaque_Ab9-+=/%','a443de34-bf19-4904-9055-8496f0ac0012','a'.repeat(128)]){
  const url=new URL('https://obrasaas.com/api/webhooks/whatsapp');url.search=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':demoEnvironment.META_VERIFY_TOKEN,'hub.challenge':challenge});
  const response=await handlers.GET(new Request(url));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'text/plain');assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(await response.text(),challenge);
 }
 assert.equal(connects,0);assert.equal(wakes,0);
});
test('canonical app handshake ignores opaque extras without granting access and requires the exact token',async()=>{
 let connects=0,wakes=0;const logs=[],handlers=createMetaAppCallback({environment:demoEnvironment,connect:async()=>{connects++;throw new Error('GET must not connect');},schedule:()=>{wakes++;}}),get=createMetaAppHandshakeGet(handlers.GET,{log:(...entry)=>logs.push(entry)}),challenge='1158201444';
 const url=new URL('https://obrasaas.com/api/webhooks/whatsapp');url.search=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':demoEnvironment.META_VERIFY_TOKEN,'hub.challenge':challenge,'fixture-extra-one':'opaque','fixture-extra-two':'opaque+=/%','fixture-extra-three':'opaque-other'});
 assert.deepEqual(metaAppHandshakeDiagnostics(new Request(url)),{parameterCount:6,modeIsSubscribe:true,missingKnownParameters:false,duplicateKnownParameters:false,unknownParameterCount:3,challengeLength:10,challengeHasAsciiControl:false});
 const response=await get(new Request(url));assert.equal(response.status,200);assert.equal(await response.text(),challenge);assert.deepEqual(logs,[]);
 url.searchParams.set('hub.verify_token','synthetic-wrong-token');const wrong=await get(new Request(url));assert.equal(wrong.status,403);assert.deepEqual(await wrong.json(),{code:'META_CUSTOMER_SIGNATURE_REJECTED'});assert.deepEqual(logs,[]);
 url.searchParams.set('hub.verify_token',demoEnvironment.META_VERIFY_TOKEN);url.searchParams.append('role','ADMIN');assert.equal((await get(new Request(url))).status,200);assert.equal(connects,0);assert.equal(wakes,0);
 const unavailable=createMetaAppCallback({environment:{},connect:()=>{throw new Error('GET must not connect');}});assert.equal((await unavailable.GET(new Request(url))).status,503);
});
test('canonical app handshake requires each known key exactly once and rejects unbounded or control challenges despite extras',async()=>{
 const handlers=createMetaAppCallback({environment:demoEnvironment,connect:()=>{throw new Error('Invalid GET must not connect');}});
 const url=()=>{const value=new URL('https://obrasaas.com/api/webhooks/whatsapp');value.search=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':demoEnvironment.META_VERIFY_TOKEN,'hub.challenge':'opaque-challenge','fixture-extra-one':'opaque','fixture-extra-two':'opaque+=/%','fixture-extra-three':'opaque-other'});return value;};
 const cases=[value=>{value.search='';},...['hub.mode','hub.verify_token','hub.challenge'].map(key=>value=>value.searchParams.delete(key)),...['hub.mode','hub.verify_token','hub.challenge'].map(key=>value=>value.searchParams.append(key,value.searchParams.get(key))),value=>{value.searchParams.delete('hub.verify_token');value.searchParams.append('hub.challenge','second-challenge');},value=>{value.searchParams.delete('hub.verify_token');value.searchParams.append('role','ADMIN');},value=>value.searchParams.set('hub.mode','unsubscribe'),...['','a'.repeat(129),'line\r\nbreak','nul\u0000value','del\u007fvalue'].map(challenge=>value=>value.searchParams.set('hub.challenge',challenge))];
 for(const mutate of cases){const value=url();mutate(value);const response=await handlers.GET(new Request(value));assert.equal(response.status,400);assert.deepEqual(await response.json(),{code:'META_CUSTOMER_CALLBACK_INVALID'});}
});
test('canonical app handshake preserves exact app-token matching and fails closed when configuration is absent',async()=>{
 const environment={...demoEnvironment,META_CUSTOMER_VERIFY_TOKEN:'synthetic-distinct-customer-token-not-app-token'},handlers=createMetaAppCallback({environment,connect:()=>{throw new Error('GET must not connect');}});
 for(const candidate of ['synthetic-wrong-app-token',environment.META_CUSTOMER_VERIFY_TOKEN,environment.META_VERIFY_TOKEN+' ',environment.META_VERIFY_TOKEN.toUpperCase()]){
  const value=new URL('https://obrasaas.com/api/webhooks/whatsapp');value.search=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':candidate,'hub.challenge':'opaque-challenge'});const response=await handlers.GET(new Request(value));assert.equal(response.status,403);assert.deepEqual(await response.json(),{code:'META_CUSTOMER_SIGNATURE_REJECTED'});
 }
 const value=new URL('https://obrasaas.com/api/webhooks/whatsapp');value.search=new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':environment.META_VERIFY_TOKEN,'hub.challenge':'opaque-challenge'});const unavailable=createMetaAppCallback({environment:{},connect:()=>{throw new Error('GET must not connect');}});assert.equal((await unavailable.GET(new Request(value))).status,503);
});
test('canonical handshake diagnostics expose only fixed scalar query shape fields',()=>{
 const token='synthetic-private-token-value',challenge='synthetic-private-challenge',unknown='synthetic-private-unknown-parameter';
 const request=params=>{const value=new URL('https://synthetic-private-host.invalid/synthetic-private-path');value.search=params;return new Request(value,{headers:{'x-synthetic-private-header':'synthetic-private-header-value'}});};
 const keys=['parameterCount','modeIsSubscribe','missingKnownParameters','duplicateKnownParameters','unknownParameterCount','challengeLength','challengeHasAsciiControl'];
 const cases=[
  [new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':token,'hub.challenge':challenge}),{parameterCount:3,modeIsSubscribe:true,missingKnownParameters:false,duplicateKnownParameters:false,unknownParameterCount:0,challengeLength:challenge.length,challengeHasAsciiControl:false}],
  [new URLSearchParams(),{parameterCount:0,modeIsSubscribe:false,missingKnownParameters:true,duplicateKnownParameters:false,unknownParameterCount:0,challengeLength:0,challengeHasAsciiControl:false}],
  [new URLSearchParams([['hub.mode','invalid-private-mode'],['hub.challenge','private\r\nchallenge'],['hub.challenge',challenge],[unknown,token],[unknown+'-second',challenge]]),{parameterCount:5,modeIsSubscribe:false,missingKnownParameters:true,duplicateKnownParameters:true,unknownParameterCount:2,challengeLength:'private\r\nchallenge'.length,challengeHasAsciiControl:true}],
 ];
 for(const [params,expected] of cases){const result=metaAppHandshakeDiagnostics(request(params));assert.deepEqual(Object.keys(result),keys);assert.deepEqual(result,expected);assert.ok(Object.values(result).every(value=>typeof value==='boolean'||typeof value==='number'));const serialized=JSON.stringify(result);for(const secret of [token,challenge,unknown,'invalid-private-mode','synthetic-private-host','synthetic-private-path','synthetic-private-header'])assert.equal(serialized.includes(secret),false);}
});
test('canonical GET diagnostics log only 400 shape and preserve exact response, headers and unconsumed body',async()=>{
 const request=new Request('https://obrasaas.com/api/webhooks/whatsapp?'+new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':'synthetic-private-token','hub.challenge':'synthetic-private-challenge','synthetic-private-name':'synthetic-private-value'}));
 for(const status of [200,400,403,503]){const entries=[],response=new Response('synthetic-response-body',{status,headers:{'Cache-Control':'no-store','X-Synthetic-Header':'unchanged'}});let calls=0;const wrapped=createMetaAppHandshakeGet(async received=>{calls++;assert.equal(received,request);return response;},{log:(...entry)=>entries.push(entry)});assert.equal(await wrapped(request),response);assert.equal(calls,1);assert.equal(response.bodyUsed,false);assert.equal(response.headers.get('X-Synthetic-Header'),'unchanged');assert.equal(await response.text(),'synthetic-response-body');assert.deepEqual(entries,status===400?[['META_APP_HANDSHAKE_INVALID',metaAppHandshakeDiagnostics(request)]]:[]);assert.doesNotMatch(JSON.stringify(entries),/synthetic-private/);}
});
test('canonical GET response remains unchanged if shape logging fails',async()=>{
 const response=new Response('invalid-handshake',{status:400}),request=new Request('https://obrasaas.com/api/webhooks/whatsapp');const wrapped=createMetaAppHandshakeGet(async()=>response,{log:()=>{throw new Error('synthetic-private-logger-failure');}});assert.equal(await wrapped(request),response);assert.equal(response.bodyUsed,false);assert.equal(await response.text(),'invalid-handshake');
});
test('only canonical GET is wrapped for shape diagnostics while POST uses the unchanged handler',()=>{
 const source=readFileSync(new URL('../src/app/api/webhooks/whatsapp/route.js',import.meta.url),'utf8');assert.match(source,/export const GET=createMetaAppHandshakeGet\(handlers\.GET\);/);assert.match(source,/export const POST=handlers\.POST;/);
});
test('label visibly marks both reply kinds without altering interactive capabilities',()=>{
 const r={type:'interactive',body:'MENU',sections:[{title:'Opciones',rows:[{id:'obra:abc:0',title:'Entrada'}]}],button:'Elegir'};
 assert.equal(labelDemoPilotReply(r).sections,r.sections);assert.match(labelDemoPilotReply(r).body,/DEMO/);assert.match(labelDemoPilotReply({type:'text',body:'Confirmado'}).body,/obra de prueba/);
});
test('HTTP verifies before access and rejects cross-site or unbounded compressed body',async()=>{
 let calls=0;const service={command:async()=>{calls++;return {};},read:async()=>{calls++;return {};}};
 const unauth=createMetaDemoPilotHandlers({verify:async()=>({authenticated:false}),service});assert.equal((await unauth.POST(new Request('https://obrasaas.com/api/identity/demo-pilot',{method:'POST',body:'private'}))).status,401);
 const auth=createMetaDemoPilotHandlers({verify:async()=>demoSession,service});
 for(const headers of [{'Origin':'https://evil.invalid','Content-Type':'application/json'},{'Origin':'https://obrasaas.com','Content-Type':'application/json','Content-Encoding':'gzip'},{'Origin':'https://obrasaas.com','Content-Type':'application/json','Content-Length':'99999999'}])assert.ok((await auth.POST(new Request('https://obrasaas.com/api/identity/demo-pilot',{method:'POST',headers,body:'{}'}))).status>=400);
 assert.equal(calls,0);
});
