import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {createSessionVerifier,sessionCheckResponse} from '../src/lib/verified-session.mjs';
import {IDENTITY_ORIGIN,IDENTITY_ISSUER,IDENTITY_PUBLIC_KEY,IDENTITY_INSTANCE} from '../src/lib/production-identity-config.mjs';
import {createWorkspaceHandlers} from '../src/lib/workspace-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
const now=new Date('2026-10-01T12:00:00Z'),epoch=now.getTime()/1000;
const pair=await generateKeyPair('RS256');
const jwk={...await exportJWK(pair.publicKey),kid:'workspace-unit-key',alg:'RS256',use:'sig'};
const keys=createLocalJWKSet({keys:[jwk]});
const environment={NEXT_PUBLIC_APP_URL:IDENTITY_ORIGIN,NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:IDENTITY_PUBLIC_KEY,CLERK_EXPECTED_INSTANCE_ID:IDENTITY_INSTANCE,CLERK_AUTHORIZED_PARTIES:IDENTITY_ORIGIN};
const token=claims=>new SignJWT({sub:'user_WorkspaceA',sid:'sess_WorkspaceA',iss:IDENTITY_ISSUER,azp:IDENTITY_ORIGIN,iat:epoch,nbf:epoch-1,exp:epoch+60,v:2,...claims}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:jwk.kid}).sign(pair.privateKey);
const verify=createSessionVerifier(keys,{now:()=>now,includeOrganization:true});
const headers=value=>new Headers({authorization:'Bearer '+value});
for(const claims of [{o:{id:'org_WorkspaceA',rol:'member'}},{org_id:'org_WorkspaceA',org_role:'org:member',v:1}])test('signed organization format reaches server context only '+JSON.stringify(claims),async()=>{
 const signed=await token(claims),result=await verify(headers(signed),environment);
 assert.equal(result.authenticated,true);assert.equal(result.organizationId,'org_WorkspaceA');assert.equal(result.organizationRole,'org:member');assert.equal(result.businessAccessEnabled,false);
 const response=await sessionCheckResponse(new Request(IDENTITY_ORIGIN+'/api/identity/session',{headers:headers(signed)}),value=>verify(value,environment));
 const body=await response.text();assert.doesNotMatch(body,/org_WorkspaceA|org:member|user_WorkspaceA|sess_WorkspaceA/);
});
test('personal-session verifier keeps its existing public contract',async()=>{
 const personal=createSessionVerifier(keys,{now:()=>now});
 const result=await personal(headers(await token({o:{id:'org_WorkspaceA',rol:'admin'}})),environment);
 assert.equal(result.authenticated,true);assert.equal(result.organizationId,undefined);assert.equal(result.organizationRole,undefined);assert.equal(result.businessAccessEnabled,false);
});
for(const claims of [{o:{id:'org_WorkspaceA',rol:'admin'},act:{sub:'user_Operator'}},{o:{id:'org_WorkspaceA',rol:'member'},org_id:'org_Foreign',org_role:'org:admin'},{}])test('no ambiguous or impersonated claims grant workspace context '+JSON.stringify(claims),async()=>{
 const result=await verify(headers(await token(claims)),environment);assert.equal(result.organizationId,undefined);assert.equal(result.businessAccessEnabled,false);
});
test('changing the organization without a valid signature cannot authenticate',async()=>{
 const signed=await token({o:{id:'org_WorkspaceA',rol:'member'}}),parts=signed.split('.');
 const forged=JSON.parse(Buffer.from(parts[1],'base64url'));forged.o={id:'org_Foreign',rol:'admin'};parts[1]=Buffer.from(JSON.stringify(forged)).toString('base64url');
 const result=await verify(headers(parts.join('.')),environment);assert.equal(result.authenticated,false);assert.equal(result.organizationId,undefined);
});
test('a signed Clerk admin claim without a canonical membership does not expose projects',async()=>{
 const calls=[];const store=createWorkspaceStore({connect:async()=>({query:async sql=>{calls.push(sql);return {rows:[]};},release:()=>{}})});
 const handlers=createWorkspaceHandlers({verify:value=>verify(value,environment),store});
 const response=await handlers.GET(new Request(IDENTITY_ORIGIN+'/api/identity/workspace',{headers:headers(await token({o:{id:'org_WorkspaceA',rol:'admin'}}))}));
 assert.equal(response.status,403);assert.equal((await response.json()).code,'WORKSPACE_MEMBERSHIP_REQUIRED');assert.ok(!calls.some(sql=>sql.includes('FROM public."Task"')));
});
test('forged organization headers cannot add scope to a personal token',async()=>{
 let accesses=0;const handlers=createWorkspaceHandlers({verify:value=>verify(value,environment),store:{list:()=>{accesses++;return {};}}});
 const requestHeaders=headers(await token({}));requestHeaders.set('x-clerk-org-id','org_WorkspaceA');requestHeaders.set('x-clerk-org-role','org:admin');
 const response=await handlers.GET(new Request(IDENTITY_ORIGIN+'/api/identity/workspace',{headers:requestHeaders}));
 assert.equal(response.status,403);assert.equal(accesses,0);
});
test('workspace route uses the reviewed verifier and store rather than a client identity',()=>{
 const file=readFileSync(new URL('../src/app/api/identity/workspace/route.js',import.meta.url),'utf8');
 assert.match(file,/verifyWorkspaceSession/);assert.match(file,/productionWorkspace/);assert.match(file,/createWorkspaceHandlers/);assert.doesNotMatch(file,/getAppState|saveAppState|defaultAppState/);
 const proxy=readFileSync(new URL('../src/proxy.js',import.meta.url),'utf8');assert.match(proxy,/path === '\/api\/identity\/workspace'/);assert.doesNotMatch(proxy,/path\.startsWith\('\/api\/identity/);
 const ui=readFileSync(new URL('../src/app/(identity)/cuenta/workspace-identity.js',import.meta.url),'utf8');assert.match(ui,/key=\{`\$\{userId\}:\$\{orgId/);assert.doesNotMatch(ui,/localStorage|sessionStorage/);
});
