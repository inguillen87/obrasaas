import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {NextRequest,NextResponse} from 'next/server.js';
import {authorizeLegacyService,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse} from '../src/lib/legacy-access-boundary.js';
import {identityRoute,IDENTITY_ORIGIN} from '../src/lib/production-identity-config.mjs';
import {companySubscriptionRoute} from '../src/lib/company-subscription-routing.mjs';

const source=readFileSync(new URL('../src/proxy.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function|const)/g,'');
function runtime(){const calls={legacy:0},context={URL,NextResponse,identityRoute,IDENTITY_ORIGIN,companySubscriptionRoute,legacyBoundaryKind,privateLegacyHeaders,unauthorizedLegacyResponse,process:{env:{VERCEL_ENV:'production'}},authorizeLegacyService:request=>{calls.legacy++;return authorizeLegacyService(request,{});}};vm.runInNewContext(source+'\nglobalThis.entrypoint=proxy;',context,{filename:'src/proxy.js'});return {proxy:context.entrypoint,calls};}
test('only the exact pilot GET and POST reach their strict signed-session boundary',async()=>{
 const f=runtime();for(const method of ['GET','POST']){const result=await f.proxy(new NextRequest(IDENTITY_ORIGIN+'/api/platform/usage-pilot-grants',{method}));assert.equal(result.headers.get('x-middleware-next'),'1');assert.match(result.headers.get('cache-control'),/no-store/);}assert.equal(f.calls.legacy,0);
});
test('other platform paths and unsupported methods keep their legacy protection',async()=>{
 const f=runtime();for(const [path,method]of [['/api/platform/usage-pilot-grants/other','GET'],['/api/platform/other','POST'],['/api/platform/usage-pilot-grants','DELETE']]){const result=await f.proxy(new NextRequest(IDENTITY_ORIGIN+path,{method}));assert.equal(result.status,401);}assert.equal(f.calls.legacy,3);
});
test('production aliases redirect the exact operator route to the canonical authenticated origin',async()=>{
 const f=runtime(),result=await f.proxy(new NextRequest('https://alias.invalid/api/platform/usage-pilot-grants?organizationId=synthetic'));assert.equal(result.status,307);assert.equal(result.headers.get('location'),IDENTITY_ORIGIN+'/api/platform/usage-pilot-grants?organizationId=synthetic');
});
