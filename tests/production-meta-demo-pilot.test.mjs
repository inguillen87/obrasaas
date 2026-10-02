import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {META_CUSTOMER_PROTOCOL,META_DEMO_PILOT_PROTOCOL,resolveMetaCloudProtocol,metaCloudEventId} from '../src/lib/meta-cloud-protocol.mjs';
import {metaDemoTransportReadiness,demoPilotCommand,META_DEMO_NOTICE_VERSION,META_DEMO_NOTICE_SHA256,labelDemoPilotReply,decodeDemoPilotGrant,assertDemoPilotConnection} from '../src/lib/meta-demo-pilot-policy.mjs';
import {splitMetaAppEvents,splitMetaDemoPilotEvents,splitMetaCustomerEvents,createMetaCustomerCallbackHandlers} from '../src/lib/meta-customer-callback.mjs';
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
