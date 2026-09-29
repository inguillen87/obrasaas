import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createPrivateImageUploader,assertPrivateImageConfigured,decodePrivateImage,preparePrivateKycImages,
  readPrivateKycBody,privateImageErrorResponse,PrivateImageError,MAX_PRIVATE_IMAGE_BYTES,MAX_PRIVATE_KYC_BODY_BYTES} from '../src/lib/private-image-upload.mjs';
const PNG=Buffer.from('89504e470d0a1a0a0000000a','hex');
const JPEG=Buffer.from('ffd8ffe0010203040506','hex');
const WEBP=Buffer.concat([Buffer.from('RIFF'),Buffer.alloc(4),Buffer.from('WEBP'),Buffer.alloc(5)]);
const env={PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'unit-only-synthetic-token'};
const encoded=value=>value.toString('base64');
function adapter({putFailure=null,getFailure=null,mutate=null}={}) {
  const rows=new Map(),calls=[],counts={get:0,put:0};
  const get=async(path,options)=>{
    counts.get++;calls.push({kind:'get',path,options});if(getFailure)await getFailure(path,counts,rows);
    const item=rows.get(path);if(!item)return null;
    const result={statusCode:200,blob:{url:`https://unit.private.blob.vercel-storage.com/${path}`,pathname:path,size:item.bytes.length,contentType:item.contentType},
      stream:new ReadableStream({start(controller){controller.enqueue(item.bytes);controller.close();}})};
    return mutate?mutate(result,path,counts,rows):result;
  };
  const put=async(path,bytes,options)=>{
    counts.put++;calls.push({kind:'put',path,options});
    if(putFailure)await putFailure(path,bytes,options,counts,rows);
    if(rows.has(path))throw new Error('already exists');
    rows.set(path,{bytes:Buffer.from(bytes),contentType:options.contentType});
    return {url:`https://unit.private.blob.vercel-storage.com/${path}`,pathname:path};
  };
  return {rows,calls,counts,put,get,uploader:createPrivateImageUploader({put,get,environment:()=>env})};
}
for(const environment of [{},{...env,PRIVATE_MEDIA_PROVIDER:'public'}, {...env,PRIVATE_MEDIA_PROVIDER:'cloudinary'},
  {...env,BLOB_READ_WRITE_TOKEN:''},{...env,BLOB_READ_WRITE_TOKEN:'[SENSITIVE]'}, {PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_STORE_ID:'store-only'}])
  test('missing/wrong configuration refuses access '+JSON.stringify(environment),()=>assert.throws(()=>assertPrivateImageConfigured(environment),PrivateImageError));
test('static and OIDC modes require an explicitly private provider',()=>{
  assert.doesNotThrow(()=>assertPrivateImageConfigured(env));
  assert.doesNotThrow(()=>assertPrivateImageConfigured({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_STORE_ID:'store-test',VERCEL:'1'}));
  assert.doesNotThrow(()=>assertPrivateImageConfigured({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_STORE_ID:'store-test',VERCEL_OIDC_TOKEN:'unit-oidc'}));
});
for(const [bytes,mime,extension] of [[PNG,'image/png','png'],[JPEG,'image/jpeg','jpg'],[WEBP,'image/webp','webp']])
  test('detects supported header '+mime,()=>{
    const result=decodePrivateImage(encoded(bytes));assert.equal(result.contentType,mime);assert.equal(result.extension,extension);
    assert.deepEqual(decodePrivateImage(`data:${mime};base64,${encoded(bytes)}`).bytes,bytes);
  });
for(const value of ['',null,123,'!!!!','abcd?','a===','abc','Zg==\n','Zh==','data:image/svg+xml;base64,PHN2Zz4=',
  'data:image/jpeg;base64,'+encoded(PNG),encoded(Buffer.from('<svg>'))])
  test('rejects malformed or spoofed image '+String(value),()=>assert.throws(()=>decodePrivateImage(value),PrivateImageError));
test('large encoded input is rejected before buffering',()=>assert.throws(()=>decodePrivateImage('A'.repeat(Math.ceil(MAX_PRIVATE_IMAGE_BYTES/3)*4+70)),{code:'PRIVATE_IMAGE_TOO_LARGE'}));
test('caller MIME must agree with bytes',()=>assert.throws(()=>decodePrivateImage(encoded(PNG),'image/jpeg'),{code:'PRIVATE_IMAGE_TYPE_MISMATCH'}));
for(const worker of ['',null,'unknown','../other','a/b','private name','a'.repeat(129)])
  test('requires a bounded explicit worker reference '+String(worker),()=>assert.throws(()=>preparePrivateKycImages(worker,encoded(PNG),encoded(JPEG)),{code:'PRIVATE_IMAGE_IDENTITY_REQUIRED'}));
test('deterministic batch changes with image content or worker, no raw name in paths',()=>{
  const first=preparePrivateKycImages('worker-private',encoded(PNG),encoded(JPEG));
  assert.equal(first[0].pathname,preparePrivateKycImages('worker-private',encoded(PNG),encoded(JPEG))[0].pathname);
  assert.notEqual(first[0].pathname,preparePrivateKycImages('other-worker',encoded(PNG),encoded(JPEG))[0].pathname);
  assert.notEqual(first[0].pathname,preparePrivateKycImages('worker-private',encoded(PNG),encoded(WEBP))[0].pathname);
  assert.ok(first.every(image=>!image.pathname.includes('worker-private')));
});
test('validates both images before any provider request',async()=>{
  const {uploader,calls}=adapter();await assert.rejects(uploader.uploadKycImages('worker',encoded(PNG),'invalid!'),PrivateImageError);assert.equal(calls.length,0);
});
test('successful pair is private, non-overwriting and confirmed byte-for-byte',async()=>{
  const {uploader,calls,rows}=adapter();const result=await uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG));
  assert.ok(result.dniFrontUrl.includes('.private.blob.'));assert.ok(result.selfieUrl.endsWith('.jpg'));assert.equal(rows.size,2);
  assert.ok(calls.every(call=>call.options.access==='private'));
  assert.ok(calls.filter(call=>call.kind==='put').every(call=>call.options.allowOverwrite===false&&call.options.addRandomSuffix===false));
  assert.ok(calls.filter(call=>call.kind==='get').every(call=>call.options.useCache===false));
});
test('identical retry does not upload either object again',async()=>{
  const fake=adapter();const first=await fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG));
  const second=await fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG));assert.deepEqual(first,second);assert.equal(fake.counts.put,2);
});
test('concurrent callers converge on the same two private objects',async()=>{
  const fake=adapter();const results=await Promise.all([fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG)),fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG))]);
  assert.deepEqual(results[0],results[1]);assert.equal(fake.rows.size,2);assert.ok(fake.calls.every(call=>call.options.access==='private'));
});
test('public-access provider failure is never downgraded or exposed',async()=>{
  const fake=adapter({putFailure:()=>{throw new Error('requires public access SECRET_PROVIDER_MATERIAL');}});
  await assert.rejects(fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG)),error=>error.code==='PRIVATE_IMAGE_CONFIRMATION_PENDING'&&!error.message.includes('SECRET'));
  assert.equal(fake.counts.put,1);assert.ok(fake.calls.every(call=>call.options.access==='private'));assert.equal(fake.rows.size,0);
});
test('successful write with lost acknowledgement is recovered only by private read',async()=>{
  const fake=adapter({putFailure:(path,bytes,options,counts,rows)=>{rows.set(path,{bytes:Buffer.from(bytes),contentType:options.contentType});throw new Error('lost reply');}});
  const result=await fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG));assert.ok(result.dniFrontUrl);assert.equal(fake.counts.put,2);assert.equal(fake.rows.size,2);
});
test('second-image failure cannot return a complete pair; retry reuses first',async()=>{
  let failSecond=true;
  const fake=adapter({putFailure:path=>{if(path.includes('selfie')&&failSecond)throw new Error('provider failure');}});
  await assert.rejects(fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG)),{code:'PRIVATE_IMAGE_CONFIRMATION_PENDING'});assert.equal(fake.rows.size,1);
  failSecond=false;const result=await fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG));assert.ok(result.selfieUrl);assert.equal(fake.rows.size,2);assert.equal(fake.counts.put,3);
});
test('unavailable initial read never guesses absence and writes',async()=>{
  const fake=adapter({getFailure:()=>{throw new Error('private connection URL');}});
  await assert.rejects(fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG)),{code:'PRIVATE_IMAGE_STORAGE_UNAVAILABLE'});assert.equal(fake.counts.put,0);
});
for(const change of [r=>{r.blob.url=r.blob.url.replace('.private.','.public.');},r=>{r.blob.url='https://evil.example/'+r.blob.pathname;},
  r=>{r.blob.url+='?token=secret';},r=>{r.blob.pathname+='-different';},r=>{r.blob.size++;},r=>{r.blob.contentType='text/html';},r=>{r.statusCode=304;},
  r=>{r.stream=new ReadableStream({start(c){c.enqueue(Buffer.alloc(r.blob.size));c.close();}});},
  r=>{r.stream=new ReadableStream({start(c){c.enqueue(Buffer.alloc(r.blob.size+1));c.close();}});}])
  test('rejects changed provider receipt '+String(change),async()=>{
    const fake=adapter({mutate:result=>{change(result);return result;}});
    await assert.rejects(fake.uploader.uploadKycImages('worker',encoded(PNG),encoded(JPEG)),{code:'PRIVATE_IMAGE_RECEIPT_MISMATCH'});
  });
test('generic upload masks logical filename and retains private guarantee',async()=>{
  const fake=adapter();const result=await fake.uploader.uploadImageToBlob(encoded(PNG),'private-worker/scan.png','image/png');assert.ok(!result.includes('private-worker'));assert.equal(fake.rows.size,1);
  await assert.rejects(fake.uploader.uploadImageToBlob(encoded(PNG),'../scan.png'),{code:'PRIVATE_IMAGE_FILENAME_INVALID'});
});
const request=(body,headers={})=>new Request('https://app.example/api/webview/kyc',{method:'POST',headers:{'content-type':'application/json',...headers},body});
test('bounded reader returns a plain JSON object',async()=>assert.deepEqual(await readPrivateKycBody(request('{"workerId":"unit"}')),{workerId:'unit'}));
for(const body of ['null','[]','"value"','{','false'])test('JSON body rejects '+body,async()=>await assert.rejects(readPrivateKycBody(request(body)),{code:'PRIVATE_IMAGE_REQUEST_INVALID'}));
test('body rejects oversized claimed size without reading it',async()=>await assert.rejects(readPrivateKycBody(request('{}',{'content-length':String(MAX_PRIVATE_KYC_BODY_BYTES+1)})),{code:'PRIVATE_IMAGE_TOO_LARGE'}));
test('body rejects chunked overflow even with a smaller declared length',async()=>{
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_PRIVATE_KYC_BODY_BYTES+1));c.close();}});
  const req=new Request('https://app.example',{method:'POST',duplex:'half',headers:{'content-type':'application/json','content-length':'1'},body:stream});
  await assert.rejects(readPrivateKycBody(req),{code:'PRIVATE_IMAGE_TOO_LARGE'});
});
test('response never exposes URLs, base64 or provider error messages',async()=>{
  const response=privateImageErrorResponse(new PrivateImageError('PRIVATE_IMAGE_CONFIRMATION_PENDING'));assert.equal(response.status,503);
  const body=await response.json();assert.equal(body.success,false);assert.equal(body.verified,false);assert.ok(!JSON.stringify(body).includes('https://'));assert.match(response.headers.get('cache-control'),/no-store/);
  assert.equal(privateImageErrorResponse(new Error('SECRET')),null);
});
test('the pilot KYC boundary keeps private-image validation but cannot write or auto-approve',()=>{
 const route=readFileSync(new URL('../src/app/api/webview/kyc/route.js',import.meta.url),'utf8');
 const boundary=readFileSync(new URL('../src/lib/kyc-pilot-boundary.mjs',import.meta.url),'utf8');
 assert.ok(route.includes('createKycPilotBoundary'));
 assert.ok(boundary.indexOf('authorize(request)')<boundary.indexOf('const body=await readPrivateKycBody(request)'));
 assert.ok(boundary.indexOf('assertPrivateImageConfigured(environment());')<boundary.indexOf('const body=await readPrivateKycBody(request)'));
 assert.ok(boundary.includes('preparePrivateKycImages(body.workerId,body.dniFrontBase64,body.selfieBase64)'));
 assert.doesNotMatch(route+boundary,/saveAppState|getAppState|uploadKycImages|verified:\s*true/);
});
