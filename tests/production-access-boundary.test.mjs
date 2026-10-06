import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { authorizeLegacyService, exactSecretMatch, legacyBoundaryKind, unauthorizedLegacyResponse, LAUNCH_PUBLIC_ASSETS } from '../src/lib/legacy-access-boundary.js';
import { verifyApiAuth, verifyMetaWebhookSignature, verifyWebviewToken, generateWebviewToken } from '../src/lib/auth.js';
const SECRET = 'unit-only-credential-'.repeat(4);
const env = { INTERNAL_API_SECRET: SECRET };
const req = headers => new Request('https://app.example.test/api/state', { headers });
for (const [name, headers] of [
  ['absent', {}], ['local role cookie', { cookie: 'obrasaas_logged_in=true; obrasaas_user_role=admin' }],
  ['same origin', { origin: 'https://app.example.test', referer: 'https://app.example.test/dashboard' }],
  ['forged local origin', { origin: 'http://localhost:3000' }],
  ['public key', { 'x-api-key': 'obrasaas_admin_key' }], ['internal key', { 'x-api-key': 'internal' }],
  ['internal bearer', { authorization: 'Bearer internal' }], ['wrong key', { 'x-api-key': SECRET + 'x' }],
  ['other scheme', { authorization: 'Basic ' + SECRET }], ['conflicting headers', { authorization: 'Bearer ' + SECRET, 'x-api-key': 'wrong' }],
]) test(`rejects ${name}`, () => assert.equal(authorizeLegacyService(req(headers), env), false));
test('only the configured service credential passes', () => {
  assert.equal(authorizeLegacyService(req({ authorization: 'Bearer ' + SECRET }), env), true);
  assert.equal(authorizeLegacyService(req({ 'x-api-key': SECRET }), env), true);
});
test('missing or known-default server secrets never enable anonymous access', () => {
  for (const secret of [undefined, '', ' ', 'internal', 'obrasaas_admin_key']) assert.equal(authorizeLegacyService(req({ 'x-api-key': String(secret) }), { INTERNAL_API_SECRET: secret }), false);
});
test('secret comparison rejects type and length ambiguity', () => {
  for (const value of [null, undefined, 1, '', 'x'.repeat(10000)]) assert.equal(exactSecretMatch(value, SECRET), false);
  assert.equal(exactSecretMatch(SECRET, SECRET), true);
});
for (const path of ['/api/state','/api/v1/calendario','/api/v1/workers','/api/v1/system/db-status','/api/realtime','/api/webview/kyc','/api/billing/webhook','/api/v1/whatsapp/dispatch']) {
  for (const method of ['GET','POST','DELETE','PATCH','HEAD','OPTIONS']) test(`${method} ${path} is never public`, () => assert.equal(legacyBoundaryKind(path,method), 'private-api'));
}
for (const path of ['/dashboard','/dashboard/certificates','/superadmin','/marketplace','/calendario','/webview/kyc','/webview/attendance','/portal','/documentos','/bim','/coordinacion','/planos','/costos','/presupuesto','/inspecciones','/licitaciones']) {
  test(`restricts ${path}`, () => assert.equal(legacyBoundaryKind(path), 'private-page'));
}
test('only reviewed signed protocols bypass the service credential boundary', () => {
  assert.equal(legacyBoundaryKind('/api/whatsapp','POST'), 'signed-protocol');
  assert.equal(legacyBoundaryKind('/api/whatsapp/fake','POST'), 'private-api');
  assert.equal(legacyBoundaryKind('/api/auth/verify'), 'signed-protocol');
  assert.equal(legacyBoundaryKind('/api/auth/verify','POST'), 'private-api');
});
test('customer callback bypass is limited to its signed handshake and receiver', () => {
  for (const method of ['GET','POST']) assert.equal(legacyBoundaryKind('/api/meta/customer-callback',method), 'signed-protocol');
  for (const method of ['HEAD','OPTIONS','PUT','PATCH','DELETE']) assert.equal(legacyBoundaryKind('/api/meta/customer-callback',method), 'private-api');
  for (const path of ['/api/meta/customer-callback/fake','/api/meta/customer-callback-extra','/api/meta/fake']) {
    for (const method of ['GET','POST']) assert.equal(legacyBoundaryKind(path,method), 'private-api');
  }
});
test('customer recovery bypass requires the exact route and reviewed signed job methods',()=>{
 for(const method of ['GET','POST'])assert.equal(legacyBoundaryKind('/api/meta/customer-process',method),'signed-protocol');
 for(const method of ['HEAD','OPTIONS','PUT','PATCH','DELETE'])assert.equal(legacyBoundaryKind('/api/meta/customer-process',method),'private-api');
 for(const path of ['/api/meta/customer-process/fake','/api/meta/customer-process-extra'])for(const method of ['GET','POST'])assert.equal(legacyBoundaryKind(path,method),'private-api');
});
test('public marketing and explicit assets remain accessible', () => {
  for (const path of ['/','/sign-in','/sign-up','/pricing','/bim_render.png','/icon-192.svg','/sw.js']) assert.equal(legacyBoundaryKind(path),'public');
  assert.equal(legacyBoundaryKind('/api/health'), 'public-api');
  assert.equal(legacyBoundaryKind('/api/health','POST'), 'private-api');
});

test('launch presentation assets are readable without exposing media directories or writes', () => {
  assert.equal(LAUNCH_PUBLIC_ASSETS.length,6);
  for (const route of LAUNCH_PUBLIC_ASSETS) {
    assert.equal(legacyBoundaryKind(route,'GET'),'public',route);
    assert.equal(legacyBoundaryKind(route,'HEAD'),'public',route);
    for (const method of ['POST','PUT','PATCH','DELETE','OPTIONS']) assert.equal(legacyBoundaryKind(route,method),'private-api',method+' '+route);
  }
  for (const route of ['/media','/media/launch','/media/launch/private.pdf','/media/launch/provenance.json','/media/launch/obrasaas-15s.mp4/extra','/media/launch/obrasaas-15s.mp4.bak']) assert.equal(legacyBoundaryKind(route),'private-page',route);
});
test('all existing API routes have a classified nonpublic boundary', () => {
  function visit(folder) { return readdirSync(folder,{withFileTypes:true}).flatMap(item => item.isDirectory()?visit(new URL(item.name+'/',folder)):item.name==='route.js'?[new URL(item.name,folder)]:[]); }
  const root = new URL('../src/app/', import.meta.url);
  const routes = visit(new URL('api/',root));
  assert.ok(routes.length >= 45);
  for(const file of routes){const path='/'+file.pathname.slice(root.pathname.length).replace(/\/route.js$/,'');
    assert.notEqual(legacyBoundaryKind(path), 'public');}
});
test('denials are opaque and not cacheable', async () => {
  const response=unauthorizedLegacyResponse(); assert.equal(response.status,401);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  assert.deepEqual(Object.keys(await response.json()).sort(),['code','error']);
});
test('auth helper ignores old origin and hardcoded credentials', () => {
  process.env.INTERNAL_API_SECRET=SECRET;
  assert.equal(verifyApiAuth(req({origin:'http://localhost', 'x-api-key':'internal'})).authorized,false);
  assert.equal(verifyApiAuth(req({'x-api-key':SECRET})).authorized,true);
  delete process.env.INTERNAL_API_SECRET;
});
test('Meta requires its configured secret and exact signed body', () => {
  const body='{"object":"whatsapp_business_account"}'; delete process.env.META_APP_SECRET;
  assert.equal(verifyMetaWebhookSignature(req({}),body),false);
  process.env.META_APP_SECRET=SECRET;
  const signature='sha256='+createHmac('sha256',SECRET).update(body).digest('hex');
  assert.equal(verifyMetaWebhookSignature(req({'x-hub-signature-256':signature}),body),true);
  assert.equal(verifyMetaWebhookSignature(req({'x-hub-signature-256':signature}),body+' '),false);
  delete process.env.META_APP_SECRET;
});
test('signed webview validation has no built-in fallback secret', () => {
  delete process.env.WEBVIEW_TOKEN_SECRET; assert.equal(verifyWebviewToken('worker','a'.repeat(16)),false);
  assert.throws(()=>generateWebviewToken('worker'));
  process.env.WEBVIEW_TOKEN_SECRET=SECRET;
  assert.equal(verifyWebviewToken('worker',generateWebviewToken('worker')),true);
  assert.equal(verifyWebviewToken('another',generateWebviewToken('worker')),false);
  delete process.env.WEBVIEW_TOKEN_SECRET;
});
const workerSource=readFileSync(new URL('../public/sw.js',import.meta.url),'utf8');
function workerRuntime(networkFails=false) {
  const handlers={},deleted=[],calls=[];
  const context={URL,Response,Promise,self:{location:{origin:'https://app.example.test'},addEventListener:(name,fn)=>{handlers[name]=fn;},clients:{claim:async()=>{},openWindow:async()=>{}},skipWaiting:async()=>{},registration:{showNotification:async()=>{}}},
    caches:{keys:async()=>['obrasaas-v3','obrasaas-public-v4','obrasaas-public-v5','another-app'],delete:async key=>{deleted.push(key);},open:async()=>({addAll:async()=>{}}),match:async()=>{throw new Error('Private cache must never be read');}},
    fetch:async(request)=>{calls.push(request.url);if(networkFails)throw new Error('offline');return new Response('network-only');}};
  vm.runInNewContext(workerSource,context);return {handlers,deleted,calls};
}
test('service worker activation purges only obsolete ObraSaaS caches',async()=>{
  const runtime=workerRuntime();let done;runtime.handlers.activate({waitUntil:promise=>{done=promise;}});await done;
  assert.deepEqual(runtime.deleted,['obrasaas-v3','obrasaas-public-v4']);assert.equal(runtime.handlers.sync,undefined);
});
for(const path of ['/api/state','/dashboard','/api/v1/workers'])test(`offline never returns private cache for ${path}`,async()=>{
  const runtime=workerRuntime(true);let result;runtime.handlers.fetch({request:new Request('https://app.example.test'+path),respondWith:promise=>{result=promise;}});
  const response=await result;assert.equal(response.status,503);assert.match(response.headers.get('cache-control'),/no-store/);
});
test('the worker neither replays nor deletes pending IndexedDB operations',()=>{
  assert.doesNotMatch(workerSource,/indexedDB\.open|indexedDB\.deleteDatabase|replayOfflineQueue|addEventListener\(['"]sync/);
});
test('sign-in and sign-up cannot create a local authenticated flag',()=>{
  for(const file of ['(identity)/sign-in/[[...sign-in]]/page.js','(identity)/sign-up/[[...sign-up]]/page.js','access-notice.js']){
    const text=readFileSync(new URL('../src/app/'+file,import.meta.url),'utf8');assert.doesNotMatch(text,/setItem|type=["']password|handleDemoLogin/);
  }
});
