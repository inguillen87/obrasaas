import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {photoInput,createSitePhotos} from '../src/lib/site-photo-service.mjs';
import {createSitePhotoHandlers} from '../src/lib/site-photo-http.mjs';
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
const scope='a'.repeat(64),projectId='project-a',reportId='report-a',op='12345678-1234-4234-8234-123456789012';
const identity={authenticated:true,verification:'clerk-production-jwt',userId:'user_TestA',organizationId:'org_TestA',organizationRole:'org:admin'};
const input=()=>({operationId:op,projectId,scope,reportId,revision:'2026-10-01T10:00:00.123456',image});
test('private report photos are validated before provider work',()=>{const value=photoInput(input());assert.equal(value.image.contentType,'image/png');assert.match(value.image.digest,/^[a-f0-9]{64}$/);});
for(const patch of [{image:'<svg/>'},{image:'http://external.test/photo'},{image:Buffer.alloc(3*1024*1024).toString('base64')},{image:null},{reportId:'../other'},{revision:'bad'},{operationId:'invalid'},{scope:'client-role'}])test('invalid photograph input blocked '+Object.keys(patch)[0]+':'+String(patch.image).slice(0,12),()=>assert.throws(()=>photoInput({...input(),...patch})));
test('upload cannot be invoked when existing project authorization rejects access',async()=>{
 let uploads=0;const service=createSitePhotos({workspace:{integrationProject:async()=>{throw Object.assign(new Error('Denied'),{code:'EXPECTED_ACCESS_DENIAL'});}},upload:async()=>{uploads++;},get:async()=>{}});
 await assert.rejects(service.attach(identity,input()),{code:'EXPECTED_ACCESS_DENIAL'});assert.equal(uploads,0);
});
const request=(method='GET',body=null,headers={},query='?'+new URLSearchParams({projectId,scope,reportId,operationId:op}))=>new Request('https://obrasaas.com/api/identity/site-photo'+query,{method,headers:{...(method==='POST'?{origin:'https://obrasaas.com','Content-Type':'application/json'}:{}),...headers},...(body===null?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
function handlers(user=identity){const calls=[];const method=name=>async(...args)=>{calls.push([name,...args]);return name==='download'?{bytes:Buffer.from('file'),contentType:'image/png',extension:'png'}:{scope,saved:true};};return {calls,api:createSitePhotoHandlers({verify:async()=>user,service:{attach:method('attach'),status:method('status'),download:method('download')}})};}
test('unauthorized photo body is not parsed and provider is not called',async()=>{const h=handlers({authenticated:false});assert.equal((await h.api.POST(request('POST','{',{},''))).status,401);assert.equal(h.calls.length,0);});
for(const origin of ['https://foreign.example','null','','http://obrasaas.com'])test('origin rejected before upload '+origin,async()=>{const h=handlers();assert.equal((await h.api.POST(request('POST',input(),{origin},''))).status,403);assert.equal(h.calls.length,0);});
test('compressed request rejected instead of accepting unbounded content',async()=>{const h=handlers();assert.equal((await h.api.POST(request('POST',input(),{'content-encoding':'gzip'},''))).status,403);assert.equal(h.calls.length,0);});
test('download always returns a private attachment with content sniffing disabled',async()=>{const h=handlers();const result=await h.api.GET(request('GET',null,{},'?'+new URLSearchParams({projectId,scope,reportId,photoId:'sitephoto_'+'b'.repeat(64)})));assert.equal(result.status,200);assert.equal(result.headers.get('content-type'),'image/png');assert.match(result.headers.get('content-disposition'),/^attachment/);assert.equal(result.headers.get('x-content-type-options'),'nosniff');assert.match(result.headers.get('content-security-policy'),/sandbox/);assert.match(result.headers.get('cache-control'),/private, no-store/);assert.equal(h.calls[0][0],'download');});
for(const query of ['?url=https://other.example','?projectId=p&scope='+scope+'&reportId=r&photoId=p&operationId='+op,'?projectId=p&scope='+scope+'&reportId=r','?projectId=p&scope='+scope+'&reportId=r&operationId='+op+'&token=bad'])test('arbitrary paths and ambiguous photo queries rejected '+query,async()=>{const h=handlers();assert.equal((await h.api.GET(request('GET',null,{},query))).status,400);assert.equal(h.calls.length,0);});
test('application never accepts a storage URL supplied by the client',()=>{for(const fields of [{url:'https://public.invalid'},{pathname:'private/other-object'},{workerId:'someone'},{identityVerified:true}])assert.throws(()=>photoInput({...input(),...fields}));});
test('confirmation failure does not erase objects or weaken access',()=>{
 const code=readFileSync(new URL('../src/lib/site-photo-service.mjs',import.meta.url),'utf8');assert.doesNotMatch(code,/access:'public'|allowOverwrite:true|deleteBlob|\bdel\(|fetch\(/);assert.match(code,/SITE_PHOTO_STORAGE_UNCONFIRMED/);
 assert.match(code,/No database locks are held during provider I\/O/);assert.match(code,/identityVerified:false/);
 const route=readFileSync(new URL('../src/app/api/identity/site-photo/route.js',import.meta.url),'utf8');assert.match(route,/createPrivateImageUploader/);assert.match(route,/verifyWorkspaceSession/);
});
test('UI does not expose Blob URLs and labels photos as distinct from KYC and progress approval',()=>{
 const source=readFileSync(new URL('../src/app/(identity)/cuenta/site-register-panel.js',import.meta.url),'utf8');assert.doesNotMatch(source,/blob\.vercel-storage\.com|createObjectURL/);assert.match(source,/no un trámite de KYC/);assert.match(source,/Descargar foto/);assert.match(source,/2 MB/);
});
