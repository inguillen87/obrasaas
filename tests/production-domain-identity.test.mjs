import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { identityConfig, identityRoute, accountAccess, IDENTITY_ORIGIN, IDENTITY_PUBLIC_KEY, IDENTITY_INSTANCE } from '../src/lib/production-identity-config.mjs';
import { authorizeLegacyService } from '../src/lib/legacy-access-boundary.js';
const configured=()=>({NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,
  CLERK_SECRET_KEY:'sk_live_unit_only_synthetic_value_12345',CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,
  CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN});
test('identity config is pinned to the owned ObraSaaS domain and instance',()=>{
  const config=identityConfig(configured());assert.equal(config.configured,true);assert.equal(config.businessAccessEnabled,false);
  assert.deepEqual(config.authorizedParties,['https://obrasaas.com']);assert.ok(!JSON.stringify(config).includes('synthetic_value'));
});
for(const key of Object.keys(configured()))test('missing config keeps identity unavailable: '+key,()=>{
  const input=configured();delete input[key];const result=identityConfig(input);assert.equal(result.configured,false);assert.equal(result.businessAccessEnabled,false);
});
for(const value of ['', 'sk_test_unit_only_example_12345','[SENSITIVE]','sk_live_short','wrong'])
  test('invalid secret format cannot enable auth: '+value,()=>assert.equal(identityConfig({...configured(),CLERK_SECRET_KEY:value}).configured,false));
for(const value of ['https://obrasaas.vercel.app','http://obrasaas.com','https://obrasaas.com/','https://other.example'])
  test('canonical origin mismatch fails: '+value,()=>assert.equal(identityConfig({...configured(),NEXT_PUBLIC_APP_URL:value}).configured,false));
for(const value of ['*','https://obrasaas.com,https://other.example','https://obrasaas.com/path','https://www.obrasaas.com',''])
  test('authorized parties cannot expand: '+value,()=>assert.equal(identityConfig({...configured(),CLERK_AUTHORIZED_PARTIES:value}).configured,false));
for(const value of ['/sign-in','/sign-in/factor-one','/sign-up','/sign-up/verify-email-address','/cuenta','/cuenta/'])
  test('auth route recognized: '+value,()=>assert.equal(identityRoute(value),true));
for(const value of ['/api/state','/dashboard','/sign-in-admin','/sign-upgrade','/cuenta/other','/api/webhooks/clerk','/'])
  test('auth route does not inherit legacy APIs: '+value,()=>assert.equal(identityRoute(value),false));

for(const value of [null,{}, {userId:'user_123'}, {isAuthenticated:false,userId:'user_123'},
  {isAuthenticated:true,userId:null},{isAuthenticated:true,userId:'admin'}, {isAuthenticated:true,userId:'user_../../admin'}])
  test('account server check rejects invalid session: '+JSON.stringify(value),()=>assert.equal(accountAccess(value),false));
test('verified user identity does not confer legacy API access',()=>{
  assert.equal(accountAccess({isAuthenticated:true,userId:'user_unit123'}),true);
  const request=new Request('https://obrasaas.com/api/state',{headers:{cookie:'__session=unit_only; obrasaas_logged_in=true'}});
  assert.equal(authorizeLegacyService(request,{INTERNAL_API_SECRET:'unit_only_internal_server_secret'}),false);
});
test('account separates official invitation and recovery UI from verified workspace rendering',()=>{
  const page=readFileSync(new URL('../src/app/(identity)/cuenta/page.js',import.meta.url),'utf8');
  const verify=page.indexOf('await verifyProductionSession(await headers())');
  const recovery=page.indexOf('<SessionRecovery '), workspace=page.indexOf('<WorkspaceIdentityPanel />');
  assert.ok(verify>=0&&verify<recovery&&recovery<workspace);
  assert.match(page,/if \(identityHasPendingInvitation\(query\)\) return <InvitationEntry returnPath=\{identityAccountReturnPath\(query\)\}/);
  assert.ok(page.indexOf('if (identityHasPendingInvitation(query))')<verify);
  assert.match(page,/if \(!session\.authenticated\)\s*\{\s*return <section[\s\S]*?<SessionRecovery[\s\S]*?<\/section>;\s*\}/);
  assert.match(page,/signInPath=\{identitySignInPath\(query\)\}/);
  assert.doesNotMatch(page,/redirect\(|__clerk_ticket|localStorage|document\.cookie/);
  assert.doesNotMatch(page,/getAppState|saveAppState|prisma|sessionClaims.*role|organizationList/);
});
test('auth routes do not collect passwords locally or assert business approval',()=>{
  for(const route of ['sign-in/[[...sign-in]]','sign-up/[[...sign-up]]']){
    const page=readFileSync(new URL('../src/app/(identity)/'+route+'/page.js',import.meta.url),'utf8');
    assert.doesNotMatch(page,/localStorage|<input|<form|INTERNAL_API_SECRET/);
    assert.match(page,/await searchParams/);assert.match(page,/identityAccountReturnPath\(query\)/);
    assert.match(page,/forceRedirectUrl=\{returnPath\}/);
  }
});
test('owned-domain metadata and SDK provider stay scoped',()=>{
  const layout=readFileSync(new URL('../src/app/layout.js',import.meta.url),'utf8');
  assert.ok(layout.includes('https://obrasaas.com'));assert.ok(!layout.includes('https://obrasaas.vercel.app'));
  assert.ok(!layout.includes('ClerkProvider'));
  const provider=readFileSync(new URL('../src/app/(identity)/layout.js',import.meta.url),'utf8');
  assert.ok(provider.includes('if (!setup.configured) return <AccessNotice />'));
  assert.doesNotMatch(provider,/secretKey=|CLERK_SECRET_KEY/);
});
