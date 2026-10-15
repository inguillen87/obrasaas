import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {NextRequest,NextResponse} from 'next/server.js';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {authorizeLegacyService,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse} from '../src/lib/legacy-access-boundary.js';
import {identityRoute,IDENTITY_ORIGIN,IDENTITY_ISSUER,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';
import {companySubscriptionRoute} from '../src/lib/company-subscription-routing.mjs';
import {createSessionVerifier} from '../src/lib/verified-session.mjs';
import {createPlanMeasurementHandlers} from '../src/lib/plan-measurement-http.mjs';
import {PLAN_MEASUREMENT_CONSENT} from '../src/lib/plan-measurement-source.mjs';
import {measurementStoreHarness,measurementContext,measurementSession} from './fixtures/plan-measurement-store-synthetic.mjs';
import {measurementCypFixtureParts,zipOoxmlFixture} from './fixtures/plan-measurement-source-synthetic.mjs';

// Current Next proxy, route, verifier, HTTP handler and store run together.
// Only the RSA resolver, canonical membership/SQL and Blob transport are synthetic.
// No real session, credential, provider or production database is contacted.
const root=new URL('../',import.meta.url),endpoint='/api/identity/plan-measurement';
const proxySource=readFileSync(new URL('src/proxy.js',root),'utf8'),routeSource=readFileSync(new URL('src/app/api/identity/plan-measurement/route.js',root),'utf8');
const executable=source=>source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'');
const now=new Date('2026-10-14T01:00:00Z'),epoch=now.getTime()/1000,keys=await generateKeyPair('RS256');
const jwk={...await exportJWK(keys.publicKey),kid:'synthetic-measurement-proxy',alg:'RS256',use:'sig'};
const verify=createSessionVerifier(createLocalJWKSet({keys:[jwk]}),{now:()=>now,includeOrganization:true});
const environment={NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN};
function proxyRuntime(calls,source){const context={URL,NextResponse,identityRoute,IDENTITY_ORIGIN,companySubscriptionRoute,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse,process:{env:{VERCEL_ENV:'production'}},authorizeLegacyService:request=>{calls.legacy++;return authorizeLegacyService(request,{});}};vm.runInNewContext(executable(source)+'\nglobalThis.entrypoint=proxy;',context,{filename:'src/proxy.js'});return context.entrypoint;}
async function fixture({authenticated=true,role='ADMIN',cookie=false,source=proxySource}={}){
 const h=measurementStoreHarness();h.setRole(role);const calls={legacy:0,handler:0,verify:0};
 const context={createPlanMeasurementHandlers,productionPlanMeasurement:h.measurements,verifyWorkspaceSession:headers=>{calls.verify++;return verify(headers,environment);}};
 vm.runInNewContext(executable(routeSource)+'\nglobalThis.entrypoints={GET,POST};',context,{filename:'src/app/api/identity/plan-measurement/route.js'});
 const token=authenticated?await new SignJWT({sub:measurementSession.userId,sid:'sess_MeasurementSynthetic',iss:IDENTITY_ISSUER,azp:IDENTITY_ORIGIN,iat:epoch,nbf:epoch-1,exp:epoch+60,v:2,o:{id:measurementSession.organizationId,rol:'admin'}}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(keys.privateKey):null;
 const proxy=proxyRuntime(calls,source);
 function upload(){const form=new FormData();for(const[key,value]of Object.entries({...measurementContext,operationId:'01234567-89ab-4cde-8fab-0123456789ab',consent:PLAN_MEASUREMENT_CONSENT}))form.set(key,value);form.set('file',new Blob([zipOoxmlFixture(measurementCypFixtureParts().parts)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'synthetic.xlsx');return form;}
 async function request({pathname=endpoint,method='GET',query=method==='GET'?new URLSearchParams(measurementContext).toString():'',origin=IDENTITY_ORIGIN,headers={},body=method==='POST'?upload():undefined}={}){
  const incoming=new NextRequest(origin+pathname+(query?'?'+query:''),{method,headers:{...(token?(cookie?{cookie:'__session='+token}:{authorization:'Bearer '+token}):{}),...(method==='POST'?{origin}:{}),...headers},...(body!==undefined?{body}:{})});
  const gateway=await proxy(incoming);if(gateway.headers.get('x-middleware-next')!=='1')return{gateway,response:gateway};
  assert.equal(pathname,endpoint);assert.ok(['GET','POST'].includes(method));calls.handler++;return{gateway,response:await context.entrypoints[method](incoming)};
 }
 return{h,calls,request,token,proxy};
}
for(const method of ['GET','POST'])test('measurement anonymous '+method+' reaches signed-session handler without legacy service authority',async()=>{
 const f=await fixture({authenticated:false}),before=f.h.state(),{gateway,response}=await f.request({method});assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,401);assert.deepEqual(await response.json(),{saved:false,code:'SESSION_REQUIRED'});assert.deepEqual(f.calls,{legacy:0,handler:1,verify:1});assert.deepEqual(f.h.state(),before);assert.equal(f.h.calls.put,0);assert.equal(f.h.calls.provider,0);assert.match(response.headers.get('cache-control'),/private, no-store/);
});
for(const role of ['ADMIN','DIRECTOR'])test('measurement signed '+role+' can read then attach exact local physical source through proxy and real store',async()=>{
 const f=await fixture({role}),listing=await f.request();assert.equal(listing.response.status,200);assert.deepEqual((await listing.response.json()).drafts,[]);assert.equal(f.h.calls.put,0);
 const saved=await f.request({method:'POST'}),body=await saved.response.json();assert.equal(saved.response.status,200);assert.equal(body.draft.measurementImport,true);assert.equal(body.draft.status,'READY');assert.equal(f.h.state().tasks.size,0);assert.equal(f.h.calls.provider,0);assert.equal(f.h.calls.put,1);
 const read=await f.request({query:new URLSearchParams({...measurementContext,draftId:body.draft.id}).toString()});assert.equal(read.response.status,200);assert.equal((await read.response.json()).draft.id,body.draft.id);assert.deepEqual(f.calls,{legacy:0,handler:3,verify:3});assert.equal(saved.response.headers.get('vary'),'Cookie, Authorization');
});
test('measurement signed session cookie follows the same exact delegation',async()=>{const f=await fixture({cookie:true}),{response}=await f.request();assert.equal(response.status,200);assert.deepEqual(f.calls,{legacy:0,handler:1,verify:1});});
for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])test('measurement forwarded signed '+role+' cannot read or attach private source',async()=>{
 const f=await fixture({role}),before=f.h.state();for(const method of ['GET','POST']){const{gateway,response}=await f.request({method});assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,403);assert.equal((await response.json()).code,method==='POST'?'PLAN_IMPORT_PERMISSION_REQUIRED':'PLAN_MEASUREMENT_PERMISSION_REQUIRED');}assert.deepEqual(f.calls,{legacy:0,handler:2,verify:2});assert.deepEqual(f.h.state(),before);assert.equal(f.h.calls.put,0);
});
test('measurement stale project and scope are rejected by canonical authority after proxy delegation',async()=>{
 const f=await fixture(),before=f.h.state();for(const patch of [{scope:'0'.repeat(64)},{projectId:'foreign-project'}]){const{response}=await f.request({query:new URLSearchParams({...measurementContext,...patch}).toString()});assert.equal(response.status,403);assert.equal((await response.json()).code,'WORKSPACE_CONTEXT_CHANGED');}assert.equal(f.calls.legacy,0);assert.deepEqual(f.h.state(),before);assert.equal(f.h.calls.put,0);
});
test('measurement tampered signed token and a legacy key cannot supply session authority',async()=>{
 const f=await fixture(),parts=f.token.split('.'),signature=Buffer.from(parts[2],'base64url');signature[0]^=1;parts[2]=signature.toString('base64url');for(const method of ['GET','POST']){const{response}=await f.request({method,headers:{authorization:'Bearer '+parts.join('.'),'x-api-key':'synthetic-legacy-key'}});assert.equal(response.status,401);assert.equal((await response.json()).code,'SESSION_REQUIRED');}assert.equal(f.calls.legacy,0);assert.equal(f.h.calls.put,0);assert.equal(f.h.state().logs.size,0);
});
test('measurement origin and query guards still execute before private source access',async()=>{
 const f=await fixture();for(const request of [{headers:{'sec-fetch-site':'cross-site'},code:'WORKSPACE_ORIGIN_REJECTED',status:403},{method:'POST',headers:{origin:'https://hostile.invalid'},code:'WORKSPACE_ORIGIN_REJECTED',status:403},{query:new URLSearchParams(measurementContext)+'&scope='+measurementContext.scope,code:'PLAN_MEASUREMENT_INPUT_INVALID',status:400}]){const{code,status,...options}=request,{response}=await f.request(options);assert.equal(response.status,status);assert.equal((await response.json()).code,code);}assert.equal(f.h.calls.put,0);assert.equal(f.h.calls.get,0);assert.equal(f.h.calls.provider,0);assert.equal(f.h.state().logs.size,0);
});
test('measurement production redirect preserves exact query and occurs before session or store',async()=>{
 const f=await fixture(),query=new URLSearchParams(measurementContext).toString();for(const method of ['GET','POST']){const{response}=await f.request({method,origin:'https://deployment.example.invalid',query});assert.equal(response.status,307);assert.equal(response.headers.get('location'),IDENTITY_ORIGIN+endpoint+'?'+query);}assert.deepEqual(f.calls,{legacy:0,handler:0,verify:0});assert.equal(f.h.calls.put,0);
});
test('measurement neighboring paths and unsupported methods retain legacy denial for a signed administrator',async()=>{
 const f=await fixture(),paths=[endpoint+'/',endpoint+'/other',endpoint+'s',endpoint+'-other',endpoint+'%2Fother','/api/identity/plan-Measurement'];for(const pathname of paths){const{gateway,response}=await f.request({pathname});assert.equal(gateway.headers.get('x-middleware-next'),null);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');}for(const method of ['HEAD','PUT','PATCH','DELETE','OPTIONS']){const{response}=await f.request({method});assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');}assert.deepEqual(f.calls,{legacy:paths.length+5,handler:0,verify:0});assert.equal(f.h.calls.put,0);
});
test('measurement exact delegation does not admit unrelated legacy APIs',async()=>{
 const f=await fixture();for(const pathname of ['/api/projects','/api/identity/plan-measurement-legacy','/api/internal/private']){const response=await f.proxy(new NextRequest(IDENTITY_ORIGIN+pathname,{headers:{authorization:'Bearer '+f.token}}));assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');}assert.deepEqual(f.calls,{legacy:3,handler:0,verify:0});
});
test('removing only measurement delegation reproduces the published denial with the same valid signed session',async()=>{
 const definition="const planMeasurementRoute=(path,method)=>path==='/api/identity/plan-measurement'&&['GET','POST'].includes(method);",call='||planMeasurementRoute(path,request.method)';assert.equal(proxySource.split(definition).length,2);assert.equal(proxySource.split(call).length,2);const priorSource=proxySource.replace(definition+'\r\n','').replace(definition+'\n','').replace(call,''),prior=await fixture({source:priorSource}),fixed=await fixture();
 for(const method of ['GET','POST']){const denied=await prior.request({method});assert.equal(denied.response.status,401);assert.equal((await denied.response.json()).code,'AUTHENTICATION_REQUIRED');const accepted=await fixed.request({method});assert.equal(accepted.response.status,200);}assert.deepEqual(prior.calls,{legacy:2,handler:0,verify:0});assert.equal(prior.h.calls.put,0);assert.equal(prior.h.state().logs.size,0);assert.equal(fixed.h.state().tasks.size,0);assert.equal(fixed.h.calls.provider,0);
});

test('every implemented workspace-session route reaches its own verifier instead of the legacy service boundary',async()=>{
 const calls={legacy:0},proxy=proxyRuntime(calls,proxySource),base=new URL('src/app/api/identity/',root),checked=[];
 function routes(directory,prefix=''){return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?routes(new URL(entry.name+'/',directory),prefix+entry.name+'/'):entry.name==='route.js'?[{url:new URL(entry.name,directory),pathname:'/api/identity/'+prefix.replace(/\/$/,'')}]:[]);}
 for(const route of routes(base)){
  const source=readFileSync(route.url,'utf8');if(!/^import[^\n]*\bverifyWorkspaceSession\b[^\n]*verified-session\.mjs/m.test(source))continue;
  const methods=[...source.matchAll(/export\s+(?:const\s+|(?:async\s+)?function\s+)(GET|POST)\b/g)].map(match=>match[1]);assert.ok(methods.length,route.pathname);
  for(const method of methods){const response=await proxy(new NextRequest(IDENTITY_ORIGIN+route.pathname,{method}));assert.equal(response.headers.get('x-middleware-next'),'1',method+' '+route.pathname+' must delegate to its signed-session verifier');checked.push(method+' '+route.pathname);}
 }
 assert.ok(checked.includes('GET '+endpoint)&&checked.includes('POST '+endpoint));assert.ok(checked.length>=20,'All current workspace handlers were inspected');assert.equal(calls.legacy,0);
});
