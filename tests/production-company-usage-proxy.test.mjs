import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {NextRequest,NextResponse} from 'next/server.js';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {authorizeLegacyService,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse} from '../src/lib/legacy-access-boundary.js';
import {identityRoute,IDENTITY_ORIGIN,IDENTITY_ISSUER,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';
import {companySubscriptionRoute} from '../src/lib/company-subscription-routing.mjs';
import {createSessionVerifier} from '../src/lib/verified-session.mjs';
import {scopeStamp} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createOrganizationUsage} from '../src/lib/organization-usage-store.mjs';
import {createOrganizationUsageHandlers} from '../src/lib/organization-usage-http.mjs';

// Execute the current production entrypoints. Only the RSA key resolver,
// canonical SQL adapter and environment are synthetic; no HTTP/DB is opened.
const projectRoot=new URL('../',import.meta.url);
const proxySource=readFileSync(new URL('src/proxy.js',projectRoot),'utf8');
const routeSource=readFileSync(new URL('src/app/api/identity/company-usage/route.js',projectRoot),'utf8');
const script=source=>source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'');
const now=new Date('2026-10-12T12:00:00.000Z'),epoch=now.getTime()/1000;
const keyPair=await generateKeyPair('RS256');
const jwk={...await exportJWK(keyPair.publicKey),kid:'synthetic-company-usage-proxy',alg:'RS256',use:'sig'};
const verify=createSessionVerifier(createLocalJWKSet({keys:[jwk]}),{now:()=>now,includeOrganization:true});
const identityEnvironment=Object.freeze({NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN});
const path='/api/identity/company-usage';

function proxyRuntime(calls,{production=true}={}){
 const context={URL,NextResponse,identityRoute,IDENTITY_ORIGIN,companySubscriptionRoute,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse,
  process:{env:{VERCEL_ENV:production?'production':'development'}},
  authorizeLegacyService:request=>{calls.legacy++;return authorizeLegacyService(request,{});}};
 vm.runInNewContext(script(proxySource)+'\nglobalThis.entrypoint=proxy;',context,{filename:'src/proxy.js'});
 return context.entrypoint;
}

async function fixture({role='ADMIN',clerkRole='org:admin',membershipId='membership-synthetic',membershipPresent=true,officeReviewOnly=false,authenticated=true}={}){
 const calls={legacy:0,handler:0,verify:0,connect:0,release:0,membership:0,usage:0},queries=[];
 const session={userId:'user_UsageSynthetic',organizationId:'org_UsageSynthetic',organizationRole:clerkRole};
 const member={actorId:'actor-synthetic',membershipId,organizationId:'company-synthetic',organizationName:'Synthetic usage company',clerkUserId:session.userId,clerkRole,role,officeReviewOnly};
 const client={release(){calls.release++;},async query(sql,values=[]){
  queries.push(sql);
  if(/^(BEGIN|ROLLBACK|COMMIT|SET LOCAL)/.test(sql))return {rows:[]};
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')){
   calls.membership++;assert.deepEqual(values,[session.userId,session.organizationId,session.organizationRole]);
   assert.match(sql,/m\.status='ACTIVE'/);assert.match(sql,/m\."clerkRole"=\$3/);
   return {rows:membershipPresent?[{...member}]:[]};
  }
  calls.usage++;
  assert.deepEqual(values,[member.organizationId],'Usage queries remain bound to the canonical company');
  if(sql.includes('FROM public."Organization"'))return {rows:[{id:member.organizationId,name:member.organizationName,metadata:{},subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date('2026-10-27T12:00:00.000Z'),observedAt:now}]};
  assert.ok(sql.includes("action='organization.usage.plan-import'")||sql.includes("action='organization.usage.resource'"),'Only the canonical usage ledgers are queried');
  if(sql.includes('count(*)::text'))return {rows:[{total:'0',reserved:'0',pending:'0',observed:'0',unmeasured:'0',inputTokens:'0',outputTokens:'0',totalTokens:'0',audioSeconds:'0'}]};
  if(sql.startsWith('SELECT id,metadata FROM public."AuditLog"'))return {rows:[]};
  assert.fail('Unexpected synthetic SQL');
 }};
 const connect=async()=>{calls.connect++;return client;};
 const store=createOrganizationUsage({workspace:createWorkspaceStore({connect}),connect});
 const context={createOrganizationUsageHandlers,productionOrganizationUsage:store,verifyWorkspaceSession:headers=>{calls.verify++;return verify(headers,identityEnvironment);}};
 vm.runInNewContext(script(routeSource)+'\nglobalThis.entrypoint=GET;',context,{filename:'src/app/api/identity/company-usage/route.js'});
 const signed=authenticated?await new SignJWT({sub:session.userId,sid:'sess_UsageSynthetic',iss:IDENTITY_ISSUER,azp:IDENTITY_ORIGIN,iat:epoch,nbf:epoch-1,exp:epoch+60,v:2,o:{id:session.organizationId,rol:clerkRole.slice(4)}}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(keyPair.privateKey):null;
 const scope=scopeStamp(session,member),proxy=proxyRuntime(calls);
 async function request({pathname=path,method='GET',query='scope='+scope,origin=IDENTITY_ORIGIN,headers={}}={}){
  const incoming=new NextRequest(origin+pathname+(query?'?'+query:''),{method,headers:{...(signed?{authorization:'Bearer '+signed}:{}),...headers}});
  const gateway=await proxy(incoming);
  if(gateway.headers.get('x-middleware-next')!=='1')return {gateway,response:gateway};
  calls.handler++;
  return {gateway,response:await context.entrypoint(incoming)};
 }
 return {request,calls,queries,scope,signedToken:signed};
}

test('anonymous exact GET reaches signed-session rejection instead of the legacy secret boundary',async()=>{
 const f=await fixture({authenticated:false}),{gateway,response}=await f.request();
 assert.equal(response.status,401);assert.deepEqual(await response.json(),{code:'SESSION_REQUIRED'});
 assert.equal(gateway.headers.get('x-middleware-next'),'1');
 assert.equal(f.calls.legacy,0);assert.equal(f.calls.handler,1);assert.equal(f.calls.verify,1);assert.equal(f.calls.connect,0);
 assert.match(response.headers.get('cache-control'),/private, no-store/);
});

test('locally signed current ADMIN reaches proxy, actual route and canonical usage reader',async()=>{
 const f=await fixture(),{gateway,response}=await f.request(),body=await response.json();
 assert.equal(response.status,200);assert.equal(gateway.headers.get('x-middleware-next'),'1');
 assert.equal(f.calls.legacy,0);assert.equal(f.calls.handler,1);assert.equal(f.calls.verify,1);
 assert.equal(f.calls.connect,1);assert.equal(f.calls.release,1);assert.equal(f.calls.membership,1);assert.equal(f.calls.usage,5);
 assert.equal(body.scope,f.scope);assert.deepEqual(body.organization,{id:'company-synthetic',name:'Synthetic usage company'});
 assert.deepEqual(body.coverage,{state:'TRIAL_CURRENT',startsAt:null,endsAt:'2026-10-27T12:00:00.000Z'});
 assert.deepEqual(body.capacity,{state:'CONTRACT_PENDING',cost:null});assert.deepEqual(body.funding,{state:'UNCONFIRMED'});
 assert.equal(body.version,2);assert.deepEqual(body.summary,{total:0,reserved:0,pending:0,observed:0,unmeasured:0,inputTokens:'0',outputTokens:'0',totalTokens:'0',audioSeconds:'0'});
 assert.deepEqual(body.recent,[]);assert.equal(body.truncated,false);
 assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('vary'),'Cookie, Authorization');
 assert.ok(f.queries.every(sql=>!/^(INSERT|UPDATE|DELETE)/.test(sql)));assert.ok(f.queries.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
});

for(const [name,options,code] of [
 ['signed admin without canonical membership',{membershipPresent:false},'WORKSPACE_MEMBERSHIP_REQUIRED'],
 ['canonical director with a signed admin claim',{role:'DIRECTOR'},'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'],
 ['canonical admin with a signed member claim',{clerkRole:'org:member'},'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'],
 ['office reviewer',{officeReviewOnly:true},'OFFICE_REVIEW_ONLY'],
])test('forwarding preserves current authorization: '+name,async()=>{
 const f=await fixture(options),{gateway,response}=await f.request();
 assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,403);assert.deepEqual(await response.json(),{code});
 assert.equal(f.calls.legacy,0);assert.equal(f.calls.verify,1);assert.equal(f.calls.membership,1);assert.equal(f.calls.usage,0);assert.equal(f.calls.release,1);
});

test('a stale scope cannot read usage under a changed canonical membership',async()=>{
 const prior=await fixture(),current=await fixture({membershipId:'membership-changed'});
 assert.notEqual(current.scope,prior.scope);const {response}=await current.request({query:'scope='+prior.scope});
 assert.equal(response.status,409);assert.deepEqual(await response.json(),{code:'WORKSPACE_CONTEXT_CHANGED'});
 assert.equal(current.calls.verify,1);assert.equal(current.calls.membership,1);assert.equal(current.calls.usage,0);assert.equal(current.calls.legacy,0);
});

test('a forged JWT reaches signature rejection without a canonical connection',async()=>{
 const f=await fixture();
 assert.equal((await verify(new Headers({authorization:'Bearer '+f.signedToken}),identityEnvironment)).authenticated,true,'The original local RSA token is valid');
 const [header,payload,encodedSignature]=f.signedToken.split('.'),signature=Buffer.from(encodedSignature,'base64url');
 assert.ok(signature.length>0);signature[0]^=1;
 const forged=[header,payload,signature.toString('base64url')].join('.');assert.notEqual(forged,f.signedToken);
 const {gateway,response}=await f.request({headers:{authorization:'Bearer '+forged}});
 assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,401);assert.deepEqual(await response.json(),{code:'SESSION_REQUIRED'});
 assert.equal(f.calls.verify,1);assert.equal(f.calls.connect,0);assert.equal(f.calls.legacy,0);
});

test('the forwarded handler retains strict scope query validation before company reads',async()=>{
 const f=await fixture();
 for(const query of ['scope='+f.scope+'&scope='+f.scope,'scope='+f.scope+'&organizationId=foreign','scope=invalid','']){
  const {gateway,response}=await f.request({query});assert.equal(gateway.headers.get('x-middleware-next'),'1');
  assert.equal(response.status,400);assert.deepEqual(await response.json(),{code:'ORGANIZATION_USAGE_INPUT_INVALID'});
 }
 assert.equal(f.calls.verify,4);assert.equal(f.calls.connect,0);assert.equal(f.calls.legacy,0);
});

test('the forwarded handler retains the cross-site rejection before canonical reads',async()=>{
 const f=await fixture(),{response}=await f.request({headers:{'sec-fetch-site':'cross-site'}});
 assert.equal(response.status,403);assert.deepEqual(await response.json(),{code:'WORKSPACE_ORIGIN_REJECTED'});
 assert.equal(f.calls.verify,1);assert.equal(f.calls.connect,0);assert.equal(f.calls.legacy,0);
});

test('prefixes, suffixes and encoded path variants never reach the company usage handler',async()=>{
 const f=await fixture();
 for(const pathname of [path+'/',path+'/other',path+'-other',path+'s',path+'%2Fother','/api/identity/company-usage%2F','/api/identity/unknown','/api/identity/company-Usage']){
  const {gateway,response}=await f.request({pathname});assert.equal(gateway.headers.get('x-middleware-next'),null,pathname);
  assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');
 }
 assert.equal(f.calls.legacy,8);assert.equal(f.calls.handler,0);assert.equal(f.calls.verify,0);assert.equal(f.calls.connect,0);
});

test('only GET forwards the exact usage path, even with a signed ADMIN session',async()=>{
 const f=await fixture();
 for(const method of ['HEAD','POST','PUT','PATCH','DELETE','OPTIONS']){
  const {gateway,response}=await f.request({method});assert.equal(gateway.headers.get('x-middleware-next'),null,method);
  assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');
 }
 assert.equal(f.calls.legacy,6);assert.equal(f.calls.handler,0);assert.equal(f.calls.verify,0);assert.equal(f.calls.connect,0);
});

test('production canonical-origin redirect preserves scope and precedes all authentication/read adapters',async()=>{
 const f=await fixture(),{gateway,response}=await f.request({origin:'https://deployment.example.invalid'});
 assert.equal(response.status,307);assert.equal(gateway.headers.get('x-middleware-next'),null);
 assert.equal(response.headers.get('location'),IDENTITY_ORIGIN+path+'?scope='+f.scope);
 assert.equal(f.calls.legacy,0);assert.equal(f.calls.handler,0);assert.equal(f.calls.verify,0);assert.equal(f.calls.connect,0);
});
