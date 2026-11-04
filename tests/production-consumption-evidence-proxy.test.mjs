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
import {createConsumptionEvidenceHandler} from '../src/lib/consumption-evidence-http.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const root=new URL('../',import.meta.url),proxySource=readFileSync(new URL('src/proxy.js',root),'utf8'),routeSource=readFileSync(new URL('src/app/api/identity/consumption-evidence/route.js',root),'utf8');
const script=source=>source.replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'');
const now=new Date('2026-10-28T12:00:00Z'),epoch=now.getTime()/1000,keyPair=await generateKeyPair('RS256'),jwk={...await exportJWK(keyPair.publicKey),kid:'synthetic-evidence',alg:'RS256',use:'sig'};
const verify=createSessionVerifier(createLocalJWKSet({keys:[jwk]}),{now:()=>now,includeOrganization:true});
const environment={NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN};
const exact='/api/identity/consumption-evidence',query=new URLSearchParams({projectId:'project-a',scope:'a'.repeat(64),workerId:'worker-a',sectorId:'sector-a',taskId:''}).toString();
async function fixture({authenticated=true,denied=false}={}){
 const calls={legacy:0,verify:0,read:0},productionWorkspace={synthetic:true};
 const context={URL,NextResponse,identityRoute,IDENTITY_ORIGIN,companySubscriptionRoute,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse,process:{env:{VERCEL_ENV:'production'}},authorizeLegacyService:request=>{calls.legacy++;return authorizeLegacyService(request,{});}};
 vm.runInNewContext(script(proxySource)+'\nglobalThis.entrypoint=proxy;',context);const proxy=context.entrypoint;
 const route={createConsumptionEvidenceHandler,productionWorkspace,verifyWorkspaceSession:headers=>{calls.verify++;return verify(headers,environment);},createConsumptionEvidenceCatalog:options=>{assert.equal(options.workspace,productionWorkspace);return {read:async(session,input)=>{calls.read++;assert.equal(session.userId,'user_Evidence');assert.equal(input.projectId,'project-a');if(denied)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',403);return {scope:input.scope,entries:[],evidence:[]};}};}};
 vm.runInNewContext(script(routeSource)+'\nglobalThis.entrypoint=GET;',route);
 const token=authenticated?await new SignJWT({sub:'user_Evidence',sid:'sess_Evidence',iss:IDENTITY_ISSUER,azp:IDENTITY_ORIGIN,iat:epoch,nbf:epoch-1,exp:epoch+60,v:2,o:{id:'org_Evidence',rol:'member'}}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(keyPair.privateKey):null;
 return {calls,async request({pathname=exact,method='GET',origin=IDENTITY_ORIGIN}={}){const incoming=new NextRequest(origin+pathname+'?'+query,{method,headers:token?{authorization:'Bearer '+token}:{}}),gateway=await proxy(incoming);return {gateway,response:gateway.headers.get('x-middleware-next')==='1'?await route.entrypoint(incoming):gateway};}};
}
test('exact GET reaches actual signed route and evidence reader without the legacy service secret',async()=>{const f=await fixture(),{gateway,response}=await f.request();assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,200);assert.deepEqual(await response.json(),{scope:'a'.repeat(64),entries:[],evidence:[]});assert.deepEqual(f.calls,{legacy:0,verify:1,read:1});assert.match(response.headers.get('cache-control'),/private.*no-store/);});
test('anonymous GET still reaches real session rejection and never reads evidence',async()=>{const f=await fixture({authenticated:false}),{gateway,response}=await f.request();assert.equal(gateway.headers.get('x-middleware-next'),'1');assert.equal(response.status,401);assert.equal((await response.json()).code,'SESSION_REQUIRED');assert.deepEqual(f.calls,{legacy:0,verify:1,read:0});});
test('forwarded GET retains downstream canonical access denial',async()=>{const f=await fixture({denied:true}),{response}=await f.request();assert.equal(response.status,403);assert.equal((await response.json()).code,'WORKSPACE_PROJECT_UNAVAILABLE');assert.deepEqual(f.calls,{legacy:0,verify:1,read:1});});
test('unlisted methods and neighboring paths never gain this forwarding exception',async()=>{for(const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS']){const f=await fixture(),{gateway}=await f.request({method});assert.equal(gateway.status,401);assert.deepEqual(f.calls,{legacy:1,verify:0,read:0});}for(const pathname of [exact+'/',exact+'-other',exact+'/other','/api/identity/other']){const f=await fixture(),{gateway}=await f.request({pathname});assert.equal(gateway.status,401);assert.deepEqual(f.calls,{legacy:1,verify:0,read:0});}});
test('production alias redirect preserves the exact query before any identity or evidence access',async()=>{const f=await fixture(),{gateway}=await f.request({origin:'https://preview.example.invalid'});assert.equal(gateway.status,307);assert.equal(gateway.headers.get('location'),IDENTITY_ORIGIN+exact+'?'+query);assert.deepEqual(f.calls,{legacy:0,verify:0,read:0});});
