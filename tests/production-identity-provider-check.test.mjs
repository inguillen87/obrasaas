import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectIdentityProvider} from '../scripts/lib/production-identity-check.mjs';
import {IDENTITY_ORIGIN,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';
const environment={NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,
  CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN,CLERK_SECRET_KEY:'sk_live_'+'synthetic_only'.repeat(4)};
test('unconfigured identity does not make provider requests',async()=>{
 const proof=await inspectIdentityProvider({environment:{},fetchImpl:()=>{throw new Error('must not call');}});assert.equal(proof.status,'CONFIGURATION_PENDING');assert.equal(proof.providerRequests,0);assert.equal(proof.customerLoginVerified,false);
});
test('bound backend instance does not claim business login',async()=>{
 const proof=await inspectIdentityProvider({environment,fetchImpl:async(url,options)=>{
  assert.equal(url,'https://api.clerk.com/v1/instance');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+environment.CLERK_SECRET_KEY);
  return Response.json({id:IDENTITY_INSTANCE});}});
 assert.equal(proof.status,'INSTANCE_VERIFIED');assert.equal(proof.businessAccessEnabled,false);assert.equal(proof.customerLoginVerified,false);assert.ok(!JSON.stringify(proof).includes(environment.CLERK_SECRET_KEY));
});
for(const status of [400,401,403,429,500])test('provider HTTP '+status+' stays unverified',async()=>{
 const proof=await inspectIdentityProvider({environment,fetchImpl:async()=>new Response('SECRET_INTERNAL',{status})});assert.equal(proof.status,[401,403].includes(status)?'PROVIDER_CREDENTIAL_REJECTED':'PROVIDER_UNCONFIRMED');assert.ok(!JSON.stringify(proof).includes('SECRET_INTERNAL'));
});
for(const body of [{id:'another-instance'},{},null])test('wrong/missing instance '+JSON.stringify(body)+' rejected',async()=>{
 const proof=await inspectIdentityProvider({environment,fetchImpl:async()=>Response.json(body)});assert.equal(proof.status,'PROVIDER_INSTANCE_MISMATCH');
});
test('network error never prints provider credentials',async()=>{
 const proof=await inspectIdentityProvider({environment,fetchImpl:async()=>{throw new Error(environment.CLERK_SECRET_KEY);}});assert.equal(proof.status,'PROVIDER_UNCONFIRMED');assert.ok(!JSON.stringify(proof).includes('sk_live'));
});
