import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createSessionVerifier,sessionTokenFromHeaders,sessionCheckResponse} from '../src/lib/verified-session.mjs';
import {sessionIdentityConfig,IDENTITY_ORIGIN,IDENTITY_ISSUER,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';
import {authorizeLegacyService} from '../src/lib/legacy-access-boundary.js';
const config={NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,
  CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN};
const NOW=1900000000;
const pair=await generateKeyPair('RS256',{modulusLength:2048});
const jwk={...await exportJWK(pair.publicKey),kid:'test_signing_key',alg:'RS256',use:'sig'};
const localKeys=createLocalJWKSet({keys:[jwk]});
const verify=createSessionVerifier(localKeys,{now:()=>new Date(NOW*1000)});
const claims=()=>({iss:IDENTITY_ISSUER,sub:'user_test123',sid:'sess_test123',azp:IDENTITY_ORIGIN,iat:NOW-5,nbf:NOW-5,exp:NOW+55,v:2});
const sign=async(payload=claims(),header={alg:'RS256',typ:'JWT',kid:jwk.kid},key=pair.privateKey)=>new SignJWT(payload).setProtectedHeader(header).sign(key);
const req=token=>new Headers({cookie:'__session='+token});

test('personal-session config uses fixed public identity, not an administrative key',()=>{
  for(const secret of [undefined,'sk_test_ignored_for_verification','sk_live_not_needed_here']){
    const result=sessionIdentityConfig({...config,CLERK_SECRET_KEY:secret});
    assert.equal(result.configured,true);assert.equal(result.businessAccessEnabled,false);assert.equal(result.issuer,IDENTITY_ISSUER);
    assert.ok(!JSON.stringify(result).includes(String(secret)));
  }
});
for(const key of Object.keys(config))test('public configuration mismatch still blocks '+key,async()=>{
  const altered={...config,[key]:'wrong'};let fetched=0;
  const blocked=createSessionVerifier(()=>{fetched++;throw new Error('must not resolve');});
  const result=await blocked(req(await sign()),altered);assert.equal(result.authenticated,false);assert.equal(result.code,'IDENTITY_CONFIGURATION_PENDING');assert.equal(fetched,0);
});
test('valid RSA-signed session from correct issuer authenticates without granting business access',async()=>{
  const result=await verify(req(await sign()),config);assert.equal(result.authenticated,true);assert.equal(result.userId,'user_test123');assert.equal(result.expiresAt,NOW+55);assert.equal(result.businessAccessEnabled,false);
});
for(const [name,patch] of [
  ['wrong issuer',{iss:'https://other.clerk.accounts.dev'}],['wrong party',{azp:'https://evil.example'}],
  ['missing party',{azp:undefined}],['third-party audience',{aud:'another-application'}],['future not-before',{nbf:NOW+20}],
  ['expired',{exp:NOW-10}],['future issued-at',{iat:NOW+30}],['long-lived token',{iat:NOW-1,exp:NOW+1000}],
  ['no expiration',{exp:undefined}],['no session ID',{sid:undefined}],['machine subject',{sub:'client_test123'}],
  ['bad session ID',{sid:'admin'}],['pending organization task',{sts:'pending'}],['unknown status',{sts:'revoked'}],
  ['unknown token format',{v:55}],['fractional timestamp',{iat:NOW-0.5}],['reversed window',{nbf:NOW+55,exp:NOW+54}],
])test('rejects '+name,async()=>{
  const value={...claims(),...patch};Object.keys(value).forEach(key=>value[key]===undefined&&delete value[key]);
  const result=await verify(req(await sign(value)),config);assert.equal(result.authenticated,false);assert.equal(result.code,'SESSION_INVALID');
});
test('untrusted key cannot authenticate even if all claims match',async()=>{
  const attacker=await generateKeyPair('RS256');const token=await sign(claims(),undefined,attacker.privateKey);
  assert.equal((await verify(req(token),config)).authenticated,false);
});
test('tampered payload is rejected by cryptographic verification',async()=>{
  const token=await sign();const parts=token.split('.');parts[1]=Buffer.from(JSON.stringify({...claims(),sub:'user_admin'})).toString('base64url');
  assert.equal((await verify(req(parts.join('.')),config)).authenticated,false);
});
test('unknown key IDs do not select a token-supplied key',async()=>{
  const token=await sign(claims(),{alg:'RS256',typ:'JWT',kid:'unknown_key'});
  assert.equal((await verify(req(token),config)).authenticated,false);
});
for(const unsafe of [{jku:'https://evil.example/jwks'},{jwk},{x5u:'https://evil.example/cert'},{x5c:['fake']},{typ:'OTHER'},{kid:'../other'}])
 test('untrusted JOSE header rejected before key resolution '+Object.keys(unsafe)[0],async()=>{
  let keyLookups=0;const guarded=createSessionVerifier(()=>{keyLookups++;return pair.publicKey;},{now:()=>new Date(NOW*1000)});
  const result=await guarded(req(await sign(claims(),{alg:'RS256',typ:'JWT',kid:jwk.kid,...unsafe})),config);
  assert.equal(result.authenticated,false);assert.equal(keyLookups,0);
 });
test('HS256 and none cannot be confused with RSA signatures',async()=>{
  const token=await new SignJWT(claims()).setProtectedHeader({alg:'HS256',typ:'JWT',kid:jwk.kid}).sign(new TextEncoder().encode('a'.repeat(64)));
  assert.equal((await verify(req(token),config)).authenticated,false);
  assert.equal((await verify(req('eyJhbGciOiJub25lIn0.e30.'),config)).authenticated,false);
});
test('header selection is strict and malformed Bearer never falls back to cookie',async()=>{
  const token=await sign();assert.equal(sessionTokenFromHeaders(new Headers({cookie:'other=x; __session='+token})),token);
  assert.equal(sessionTokenFromHeaders(new Headers({authorization:'Bearer '+token})),token);
  for(const headers of [{cookie:'__session='+token+'; __session='+token},{cookie:'__session='+token,authorization:'Basic fake'},
    {cookie:'__session='+token,authorization:'Bearer invalid'}, {cookie:'__session='+token+'%00'}, {cookie:'x'.repeat(70000)},
    {authorization:'Bearer '+'x'.repeat(9000)+'.y.z'},{'x-clerk-auth-status':'signed-in','x-clerk-auth-user-id':'user_test123',cookie:'obrasaas_logged_in=true'}])
    assert.equal(sessionTokenFromHeaders(new Headers(headers)),null);
});
test('provider outage is unavailable, never signed in',async()=>{
  const result=await createSessionVerifier(()=>{throw Object.assign(new Error('private diagnostics'),{code:'ERR_JWKS_TIMEOUT'});},{now:()=>new Date(NOW*1000)})(req(await sign()),config);
  assert.equal(result.authenticated,false);assert.equal(result.code,'IDENTITY_PROVIDER_UNAVAILABLE');assert.ok(!JSON.stringify(result).includes('diagnostics'));
});
test('session API response contains no raw token, identity IDs or roles',async()=>{
  const token=await sign(),request=new Request(IDENTITY_ORIGIN+'/api/identity/session',{headers:req(token)});
  const response=await sessionCheckResponse(request,headers=>verify(headers,config));assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.authenticated,true);assert.equal(body.businessAccessEnabled,false);
  assert.ok(!JSON.stringify(body).includes('test123'));assert.ok(!JSON.stringify(body).includes(token));assert.match(response.headers.get('cache-control'),/private, no-store/);
});
test('session API failures distinguish authentication from provider availability',async()=>{
  for(const [code,status] of [['SESSION_INVALID',401],['SESSION_REQUIRED',401],['IDENTITY_PROVIDER_UNAVAILABLE',503],['IDENTITY_CONFIGURATION_PENDING',503]]){
    const response=await sessionCheckResponse(new Request(IDENTITY_ORIGIN),async()=>({authenticated:false,code}));assert.equal(response.status,status);assert.equal((await response.json()).authenticated,false);
  }
});
test('even a valid Clerk token does not authorize the global legacy API',async()=>{
  const token=await sign();assert.equal((await verify(req(token),config)).authenticated,true);
  assert.equal(authorizeLegacyService(new Request(IDENTITY_ORIGIN+'/api/state',{headers:req(token)}),{INTERNAL_API_SECRET:'unrelated-service-secret'}),false);
});
