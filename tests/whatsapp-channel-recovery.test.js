import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveWhatsAppTextChannelState, publicWhatsAppCredentialExpiry } from '../src/lib/whatsapp/channel-recovery.js';
import { buildWhatsAppChannelHealthMetadata } from '../src/lib/whatsapp/channel-health.js';
import { validPilotProofRecovery, pilotProofCanSend } from '../src/app/dashboard/integrations/pilot-proof-recovery.js';
import { readPilotChannelProof } from '../src/lib/whatsapp/pilot-channel-proof.js';
const now = new Date('2026-09-19T12:00:00Z');
const env = { NEXT_PUBLIC_APP_URL: 'https://preview.example.test', NEXT_PUBLIC_META_APP_ID: 'app-fixture', META_APP_SECRET: 'never-a-real-secret', NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: 'config-fixture', META_VERIFY_TOKEN: 'verify-fixture', WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'encryption-fixture' };
function connection(expiresAt = now.getTime()/1000 + 3600) {
  return { id: 'connection-a', projectId: 'project-a', enabled: true, connectionStatus: 'CONNECTED', phoneNumberId: 'phone-a', whatsappBusinessId: 'waba-a',
    metadata: buildWhatsAppChannelHealthMetadata({}, { expiresAt, scopes: ['whatsapp_business_management','whatsapp_business_messaging'], subscribed: true, phoneStatus: 'CONNECTED', qualityRating: 'GREEN' }, { now }) };
}
test('valid stored channel state is not declared a provider call or proof of delivery', () => {
  const state = deriveWhatsAppTextChannelState(connection(), { env, now });
  assert.equal(state.operational, true); assert.equal(state.recovery.sendAllowed, true); assert.equal(state.recovery.blocker, null);
  assert.equal(state.recovery.providerVerifiedByThisRead, false); assert.equal(state.recovery.basis, 'STORED_PROVIDER_STATE');
  assert.equal(validPilotProofRecovery(state.recovery), true);
});
for (const seconds of [0,-1,-86400]) test('known expiry blocks at and after its exact boundary: ' + seconds, () => {
  const candidate = connection(now.getTime()/1000 + seconds), before = structuredClone(candidate);
  const state = deriveWhatsAppTextChannelState(candidate, { env, now });
  assert.equal(state.recovery.blocker.code, 'WHATSAPP_TOKEN_EXPIRED'); assert.equal(state.operational, false);
  assert.equal(state.recovery.blocker.action, 'RECONNECT'); assert.deepEqual(candidate, before); assert.equal(candidate.connectionStatus, 'CONNECTED');
});
test('invalid credential is distinguishable from expiry and does not expose upstream details', () => {
  const candidate=connection();candidate.metadata.channelHealth.tokenStatus='INVALID';candidate.lastError='sensitive-provider-raw-text';
  const {recovery}=deriveWhatsAppTextChannelState(candidate,{env,now});assert.equal(recovery.blocker.code,'WHATSAPP_TOKEN_INVALID');assert.ok(!JSON.stringify(recovery).includes(candidate.lastError));
});
test('missing provider verification remains unknown rather than re-enabling sends', () => {
  const candidate=connection();candidate.metadata={};const {recovery}=deriveWhatsAppTextChannelState(candidate,{env,now});
  assert.equal(recovery.sendAllowed,false);assert.equal(recovery.blocker.action,'VERIFY_CHANNEL');
});
test('missing platform configuration directs operator to the platform, not to create another tenant', () => {
  const {recovery}=deriveWhatsAppTextChannelState(connection(),{env:{},now});assert.equal(recovery.blocker.code,'WHATSAPP_PLATFORM_NOT_READY');
});
for (const value of [null, false, -1, 'not-a-number', {}, 9007199254740991, Infinity]) test('invalid or absent expiry is never rendered as a trustworthy date: '+String(value),()=>{
  assert.equal(publicWhatsAppCredentialExpiry({metadata:{channelHealth:{expiresAt:value}}}),null);
});
test('an explicit zero expiry does not inherit an old legacy expiry or promise permanence',()=>{
  const candidate=connection(0);candidate.metadata.expiresAt=1;candidate.metadata.channelHealth.expiresAt=0;
  assert.equal(publicWhatsAppCredentialExpiry(candidate),null);
});
test('recovery response contains no token, app secret, WABA or connection identifier',()=>{
  const candidate=connection();candidate.encryptedAccessToken='not-a-real-encrypted-token';
  const json=JSON.stringify(deriveWhatsAppTextChannelState(candidate,{env,now}).recovery);
  for(const value of [candidate.id,candidate.whatsappBusinessId,candidate.phoneNumberId,candidate.encryptedAccessToken,env.META_APP_SECRET]) assert.ok(!json.includes(value));
});
test('a short-lived permission disables the button as time passes, but cannot enable a server denial',()=>{
  const recovery=deriveWhatsAppTextChannelState(connection(now.getTime()/1000+10),{env,now}).recovery;
  const snapshot={inbound:{canReply:true},recovery};assert.equal(pilotProofCanSend(snapshot,9999),true);assert.equal(pilotProofCanSend(snapshot,10000),false);
  assert.equal(pilotProofCanSend({...snapshot,inbound:{canReply:false}},0),false);
});
for(const candidate of [null,{}, {version:1,sendAllowed:true}, {version:1,sendAllowed:false,blocker:{code:'unknown'}}]) test('incomplete or unknown recovery does not authorize a UI send: '+JSON.stringify(candidate),()=>{
  assert.equal(validPilotProofRecovery(candidate),false);assert.equal(pilotProofCanSend({recovery:candidate,inbound:{canReply:true}}),false);
});
async function proof(expiresAt, inboundDate=now) {
  const conn=connection(expiresAt), calls=[];
  const inbound={id:'inbound-a',conversationId:'conversation-a',sentAt:inboundDate,createdAt:inboundDate,conversation:{externalId:'meta:10000001234'}};
  const prisma={message:{findFirst:async({where})=>{calls.push(where);return where.direction==='INBOUND'?inbound:null;}}};
  const result=await readPilotChannelProof({prisma,context:{project:{id:'project-a',organizationId:'org-a',name:'Obra ficticia'},connection:conn},now,env});
  return {result,calls};
}
test('pilot shows received message but does not offer sending with expired authorization',async()=>{
  const {result,calls}=await proof(now.getTime()/1000-1);assert.equal(result.inbound.windowOpen,true);assert.equal(result.inbound.canReply,false);
  assert.equal(result.recovery.blocker.code,'WHATSAPP_TOKEN_EXPIRED');assert.equal(result.reply,null);assert.equal(result.workersAuthorizedByThisAction,false);assert.equal(calls.length,2);
});
test('valid credential and open customer window can offer explicit consent',async()=>{
  const {result}=await proof(now.getTime()/1000+3600);assert.equal(result.inbound.windowOpen,true);assert.equal(result.inbound.canReply,true);
});
test('closing the care window and expiring the credential remain different causes',async()=>{
  const {result}=await proof(now.getTime()/1000+3600,new Date(now.getTime()-24*3600000));
  assert.equal(result.recovery.sendAllowed,true);assert.equal(result.inbound.windowOpen,false);assert.equal(result.inbound.canReply,false);
});
test('unknown eligibility values cannot enable a consented send',()=>{
  const recovery=deriveWhatsAppTextChannelState(connection(),{env,now}).recovery;
  for(const canReply of ['true',1,{},null,undefined]) assert.equal(pilotProofCanSend({recovery,inbound:{canReply}},0),false);
});
