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
import {createPlanBaselineHandlers} from '../src/lib/plan-baseline-http.mjs';
import {planBaselineHarness,session} from './fixtures/plan-baseline-synthetic.mjs';

// Execute the current proxy, route, HTTP handler and canonical baseline store.
// The local RSA resolver and in-memory SQL adapter are synthetic; no provider,
// database or network connection is opened and no incoming role is trusted.
const root=new URL('../',import.meta.url),path='/api/identity/plan-baseline';
const proxySource=readFileSync(new URL('src/proxy.js',root),'utf8');
const routeSource=readFileSync(new URL('src/app/api/identity/plan-baseline/route.js',root),'utf8');
const executable=source=>source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'');
const now=new Date('2026-10-14T01:00:00.000Z'),epoch=now.getTime()/1000;
const keys=await generateKeyPair('RS256');
const jwk={...await exportJWK(keys.publicKey),kid:'synthetic-plan-baseline-proxy',alg:'RS256',use:'sig'};
const verify=createSessionVerifier(createLocalJWKSet({keys:[jwk]}),{now:()=>now,includeOrganization:true});
const environment=Object.freeze({NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN});

function proxyRuntime(calls,source=proxySource){
 const context={URL,NextResponse,identityRoute,IDENTITY_ORIGIN,companySubscriptionRoute,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse,
  process:{env:{VERCEL_ENV:'production'}},authorizeLegacyService:request=>{calls.legacy++;return authorizeLegacyService(request,{});}};
 vm.runInNewContext(executable(source)+'\nglobalThis.entrypoint=proxy;',context,{filename:'src/proxy.js'});
 return context.entrypoint;
}

async function fixture({authenticated=true,role='ADMIN',source=proxySource,cookie=false}={}){
 const h=await planBaselineHarness();h.setRole(role);
 const calls={legacy:0,handler:0,verify:0};
 const context={createPlanBaselineHandlers,productionPlanBaseline:h.baselines,verifyWorkspaceSession:headers=>{calls.verify++;return verify(headers,environment);}};
 vm.runInNewContext(executable(routeSource)+'\nglobalThis.entrypoints={GET,POST};',context,{filename:'src/app/api/identity/plan-baseline/route.js'});
 const token=authenticated?await new SignJWT({sub:session.userId,sid:'sess_BaselineSynthetic',iss:IDENTITY_ISSUER,azp:IDENTITY_ORIGIN,iat:epoch,nbf:epoch-1,exp:epoch+60,v:2,o:{id:session.organizationId,rol:'admin'}}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(keys.privateKey):null;
 const proxy=proxyRuntime(calls,source);
 async function request({pathname=path,method='GET',query=method==='GET'?new URLSearchParams(h.context()).toString():'',origin=IDENTITY_ORIGIN,headers={},body=method==='POST'?h.input():undefined}={}){
  const incoming=new NextRequest(origin+pathname+(query?'?'+query:''),{method,headers:{...(token?(cookie?{cookie:'__session='+token}:{authorization:'Bearer '+token}):{}),...(method==='POST'?{'content-type':'application/json',origin}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const gateway=await proxy(incoming);
  if(gateway.headers.get('x-middleware-next')!=='1')return {gateway,response:gateway};
  assert.equal(pathname,path,'Only the exact delegated route dispatches the baseline handler');
  assert.ok(['GET','POST'].includes(method),'Only supported methods dispatch the baseline handler');
  calls.handler++;return {gateway,response:await context.entrypoints[method](incoming)};
 }
 return {h,calls,request,token};
}

for(const method of ['GET','POST'])test('anonymous '+method+' reaches the actual signed-session boundary without the legacy secret',async()=>{
 const f=await fixture({authenticated:false}),{gateway,response}=await f.request({method});
 assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,401);assert.deepEqual(await response.json(),{saved:false,code:'SESSION_REQUIRED'});
 assert.deepEqual(f.calls,{legacy:0,handler:1,verify:1});assert.equal(f.h.calls.sql.length,0);assert.equal(f.h.calls.mutations,0);
 assert.match(response.headers.get('cache-control'),/private, no-store/);assert.equal(response.headers.get('vary'),'Cookie, Authorization');
});

for(const role of ['ADMIN','DIRECTOR'])test('locally signed '+role+' delegates GET and SELECT to real handlers/store, then reads the same receipt',async()=>{
 const f=await fixture({role}),before=f.h.logs(),input=f.h.input();
 const listing=await f.request(),list=await listing.response.json();
 assert.equal(listing.gateway.headers.get('x-middleware-next'),'1');assert.equal(listing.response.status,200);assert.equal(list.canSelect,true);assert.equal(list.candidates.length,1);assert.equal(list.active,null);
 assert.equal(f.h.calls.mutations,0,'Explicit GET never selects a baseline');
 const selection=await f.request({method:'POST',body:input}),selected=await selection.response.json();
 assert.equal(selection.response.status,200);assert.equal(selected.state,'RECORDED');assert.equal(selected.saved,true);assert.equal(selected.operationId,input.operationId);assert.equal(selected.baselineEffects,true);assert.deepEqual(selected.active,selected.baselineSnapshot);
 assert.equal(selected.baselineSnapshot.reason,input.reason);assert.deepEqual(selected.baselineSnapshot.curve,f.h.seeded[0].curve);
 const recovered=await f.request({query:new URLSearchParams({...f.h.context(),operationId:input.operationId}).toString()}),receipt=await recovered.response.json();
 assert.equal(recovered.response.status,200);assert.equal(receipt.receiptId,selected.receiptId);assert.equal(receipt.replayed,true);
 assert.deepEqual(f.calls,{legacy:0,handler:3,verify:3});assert.equal(f.h.calls.released,3);
 assert.equal(f.h.logs().filter(row=>row.action==='plan.baseline.selected').length,1);assert.equal(f.h.logs().filter(row=>row.action==='plan.baseline.active').length,1);
 assert.deepEqual(f.h.logs().filter(row=>!row.action.startsWith('plan.baseline.')),before,'Delegation cannot rewrite the approved import');
 assert.ok(f.h.calls.sql.some(sql=>/FROM public\."Project".*FOR UPDATE/.test(sql)),'Selection retains the canonical project lock');
 assert.ok(f.h.calls.sql.includes('COMMIT'));assert.equal(selection.response.headers.get('vary'),'Cookie, Authorization');
});

test('a locally signed session cookie uses the same exact GET delegation',async()=>{
 const f=await fixture({cookie:true}),{response}=await f.request();assert.equal(response.status,200);assert.equal((await response.json()).candidates.length,1);assert.deepEqual(f.calls,{legacy:0,handler:1,verify:1});
});

for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])test('forwarded signed '+role+' cannot read or select private baseline data',async()=>{
 const f=await fixture({role}),before=f.h.logs();
 for(const method of ['GET','POST']){
  const {gateway,response}=await f.request({method});assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,403);assert.deepEqual(await response.json(),{saved:false,code:'PLAN_BASELINE_PERMISSION_REQUIRED'});
 }
 assert.deepEqual(f.calls,{legacy:0,handler:2,verify:2});assert.equal(f.h.calls.mutations,0);assert.deepEqual(f.h.logs(),before);
});

test('current membership, tenant/project and stale scope remain authoritative after delegation',async()=>{
 for(const [change,code,scope] of [
  [h=>h.setMembershipActive(false),'WORKSPACE_MEMBERSHIP_REQUIRED',null],
  [h=>h.setProjectActive(false),'WORKSPACE_PROJECT_UNAVAILABLE',null],
  [h=>h.setProjectOrganization('other-company'),'WORKSPACE_PROJECT_UNAVAILABLE',null],
  [()=>{},'WORKSPACE_CONTEXT_CHANGED','0'.repeat(64)],
 ]){
  const f=await fixture(),input=f.h.input(),before=f.h.logs();change(f.h);
  for(const method of ['GET','POST']){
   const {response}=await f.request({method,...(method==='GET'?{query:new URLSearchParams({...f.h.context(),...(scope?{scope}:{})}).toString()}:{body:{...input,...(scope?{scope}:{})}})});
   assert.equal(response.status,code==='WORKSPACE_CONTEXT_CHANGED'?409:code==='WORKSPACE_PROJECT_UNAVAILABLE'?404:403);assert.deepEqual(await response.json(),{saved:false,code});
  }
  assert.equal(f.calls.legacy,0);assert.equal(f.h.calls.mutations,0);assert.deepEqual(f.h.logs(),before);
 }
});

test('tampered signed tokens and a legacy key never supply baseline session authority',async()=>{
 const f=await fixture();assert.equal((await verify(new Headers({authorization:'Bearer '+f.token}),environment)).authenticated,true);
 const [header,payload,encoded]=f.token.split('.'),signature=Buffer.from(encoded,'base64url');signature[0]^=1;
 for(const method of ['GET','POST']){
  const {gateway,response}=await f.request({method,headers:{authorization:'Bearer '+[header,payload,signature.toString('base64url')].join('.'),'x-api-key':'synthetic-legacy-key'}});
  assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,401);assert.deepEqual(await response.json(),{saved:false,code:'SESSION_REQUIRED'});
 }
 const anonymous=await fixture({authenticated:false}),denied=await anonymous.request({method:'POST',headers:{'x-api-key':'synthetic-legacy-key'}});
 assert.equal(denied.response.status,401);assert.deepEqual(await denied.response.json(),{saved:false,code:'SESSION_REQUIRED'});
 assert.equal(f.h.calls.sql.length,0);assert.equal(anonymous.h.calls.sql.length,0);assert.equal(f.calls.legacy,0);assert.equal(anonymous.calls.legacy,0);
});

test('handler origin and input checks still run before canonical reads and writes',async()=>{
 const f=await fixture();
 for(const options of [
  {method:'GET',headers:{'sec-fetch-site':'cross-site'},code:'WORKSPACE_ORIGIN_REJECTED',status:403},
  {method:'POST',headers:{origin:'https://hostile.invalid'},code:'WORKSPACE_ORIGIN_REJECTED',status:403},
  {method:'GET',query:new URLSearchParams(f.h.context()).toString()+'&scope='+f.h.context().scope,code:'PLAN_BASELINE_INPUT_INVALID',status:400},
  {method:'POST',body:{...f.h.input(),curve:{}},code:'PLAN_BASELINE_INPUT_INVALID',status:400},
  {method:'POST',body:{...f.h.input(),curve:f.h.seeded[0].curve},code:'PLAN_BASELINE_INPUT_INVALID',status:413},
 ]){
  const {code,status,...request}=options,{response}=await f.request(request);assert.equal(response.status,status);assert.deepEqual(await response.json(),{saved:false,code});
 }
 assert.equal(f.calls.legacy,0);assert.equal(f.calls.verify,5);assert.equal(f.h.calls.sql.length,0);assert.equal(f.h.calls.mutations,0);
});

test('production origin redirect for GET and POST preserves query and precedes all adapters',async()=>{
 const f=await fixture(),query=new URLSearchParams(f.h.context()).toString();
 for(const method of ['GET','POST']){
  const {gateway,response}=await f.request({method,origin:'https://deployment.example.invalid',query});assert.equal(response.status,307);assert.equal(gateway.headers.get('x-middleware-next'),null);assert.equal(response.headers.get('location'),IDENTITY_ORIGIN+path+'?'+query);
 }
 assert.deepEqual(f.calls,{legacy:0,handler:0,verify:0});assert.equal(f.h.calls.sql.length,0);
});

test('neighbor paths and unsupported methods keep the legacy denial, including a signed ADMIN',async()=>{
 const f=await fixture(),neighbors=[path+'/',path+'/other',path+'s',path+'-other',path+'%2Fother',path+'%2F','/api/identity/plan-Baseline','/api/identity/unknown'];
 for(const pathname of neighbors){const {gateway,response}=await f.request({pathname});assert.equal(gateway.headers.get('x-middleware-next'),null,pathname);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');}
 for(const method of ['HEAD','PUT','PATCH','DELETE','OPTIONS']){const {gateway,response}=await f.request({method});assert.equal(gateway.headers.get('x-middleware-next'),null,method);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');}
 assert.deepEqual(f.calls,{legacy:neighbors.length+5,handler:0,verify:0});assert.equal(f.h.calls.sql.length,0);
});

test('unchanged legacy private APIs still reject a signed Clerk session and public assets still pass',async()=>{
 const f=await fixture(),proxy=proxyRuntime(f.calls);
 for(const [pathname,method] of [['/api/projects','GET'],['/api/identity/plan-baseline-legacy','POST'],['/api/internal/private','POST']]){
  const response=await proxy(new NextRequest(IDENTITY_ORIGIN+pathname,{method,headers:{authorization:'Bearer '+f.token}}));assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');assert.equal(response.headers.get('x-middleware-next'),null);
 }
 for(const pathname of ['/','/privacidad','/favicon.ico'])assert.equal((await proxy(new NextRequest(IDENTITY_ORIGIN+pathname))).headers.get('x-middleware-next'),'1');
 assert.deepEqual(f.calls,{legacy:3,handler:0,verify:0});assert.equal(f.h.calls.sql.length,0);
});

test('removing only the exact baseline delegation reproduces the published GET/POST dispatch failure with the same valid session',async()=>{
 const definition="const planBaselineRoute=(path,method)=>path==='/api/identity/plan-baseline'&&['GET','POST'].includes(method);",call='||planBaselineRoute(path,request.method)';
 assert.equal(proxySource.split(definition).length,2);assert.equal(proxySource.split(call).length,2);
 const priorSource=proxySource.replace(definition+'\r\n','').replace(definition+'\n','').replace(call,'');
 const repaired=await fixture(),prior=await fixture({source:priorSource});
 for(const method of ['GET','POST']){
  const denied=await prior.request({method});assert.equal(denied.gateway.headers.get('x-middleware-next'),null);assert.equal(denied.response.status,401);assert.equal((await denied.response.json()).code,'AUTHENTICATION_REQUIRED');
  const accepted=await repaired.request({method});assert.equal(accepted.gateway.headers.get('x-middleware-next'),'1');assert.equal(accepted.response.status,200);
 }
 assert.deepEqual(prior.calls,{legacy:2,handler:0,verify:0});assert.equal(prior.h.calls.sql.length,0);assert.equal(prior.h.calls.mutations,0);
 assert.deepEqual(repaired.calls,{legacy:0,handler:2,verify:2});assert.equal(repaired.h.logs().filter(row=>row.action==='plan.baseline.selected').length,1);
});
