import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {STORAGE_PROJECT,STORAGE_CHECK_FLAG,storageCheckEnabled,verifyProductionStorage} from '../scripts/lib/production-storage-check.mjs';
const env={OBRASAAS_RUN_STORAGE_CHECK:STORAGE_CHECK_FLAG,VERCEL_ENV:'production',VERCEL_PROJECT_ID:STORAGE_PROJECT,
  NEXT_PUBLIC_APP_URL:'https://obrasaas.com',PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-test-only'};
const nonce='12345678-1234-1234-1234-123456789012';
function fake({anonymous=403,failPut=0,corrupt=false,deleteFail=false,preexists=false,lostReply=false,secondGetNull=false}={}){
  const rows=new Map(),calls={put:0,get:0,delete:[],anonymous:0},other='historical/object.png';rows.set(other,{bytes:Buffer.from('unrelated'),type:'image/png'});
  const get=async(path,options)=>{
    calls.get++;assert.equal(options.access,'private');assert.equal(options.useCache,false);
    const row=rows.get(path);
    if(!row)return preexists?{stream:{cancel:async()=>{}}}:null;
    if(secondGetNull&&calls.put>0)return null;
    return {statusCode:200,blob:{url:'https://unit.private.blob.vercel-storage.com/'+path,pathname:path,size:row.bytes.length,contentType:row.type},
      stream:new ReadableStream({start(controller){controller.enqueue(corrupt?Buffer.from('changed'):row.bytes);controller.close();}})};
  };
  const put=async(path,bytes,options)=>{
    calls.put++;assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);
    if(calls.put===failPut)throw new Error('unit-secret-do-not-print');
    rows.set(path,{bytes:Buffer.from(bytes),type:options.contentType});
    if(lostReply)throw new Error('lost reply');
    return {url:'https://unit.private.blob.vercel-storage.com/'+path,pathname:path};
  };
  const del=async paths=>{calls.delete.push(...paths);if(deleteFail)throw new Error('unit-secret-do-not-print');for(const path of paths)rows.delete(path);};
  const fetchImpl=async(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');assert.equal(new URL(url).hostname,'unit.private.blob.vercel-storage.com');calls.anonymous++;return new Response(null,{status:anonymous});};
  return {rows,calls,other,args:{get,put,del,fetchImpl,environment:env,nonce,sleep:async()=>{}}};
}
test('default never runs provider calls or requires credentials',async()=>{
  assert.equal(storageCheckEnabled({}),false);const result=await verifyProductionStorage({environment:{}});assert.equal(result.providerRequests,0);
});
for(const patch of [{OBRASAAS_RUN_STORAGE_CHECK:'yes'},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{VERCEL_PROJECT_ID:'other-project'},
  {NEXT_PUBLIC_APP_URL:'https://chatboc.ar'},{PRIVATE_MEDIA_PROVIDER:'public'}])test('rejects mismatched operational context '+JSON.stringify(patch),()=>{
    assert.throws(()=>storageCheckEnabled({...env,...patch}),{code:'STORAGE_CHECK_CONTEXT_REJECTED'});
  });
test('two new private images read back exactly and exact retry uploads nothing',async()=>{
  const value=fake(),result=await verifyProductionStorage(value.args);
  assert.equal(result.status,'PASS');assert.equal(result.putCalls,2);assert.equal(result.exactRetryVerified,true);
  assert.equal(result.anonymousReadDenied,true);assert.equal(result.cleanupVerified,true);assert.equal(value.rows.size,1);assert.ok(value.rows.has(value.other));
  assert.equal(new Set(value.calls.delete).size,2);assert.ok(value.calls.delete.every(path=>path.startsWith('obrasaas/legacy-kyc/v1/')));
});
for(const status of [401,403,404])test('anonymous denial '+status+' accepted',async()=>{
  const result=await verifyProductionStorage(fake({anonymous:status}).args);assert.deepEqual(result.anonymousStatuses,[status,status]);
});
for(const status of [200,204,302,500])test('anonymous result '+status+' cannot pass and still cleans up',async()=>{
  const value=fake({anonymous:status});await assert.rejects(verifyProductionStorage(value.args),error=>error.code==='STORAGE_CHECK_ANONYMOUS_ACCESS'&&error.proof.cleanupVerified===true);assert.equal(value.rows.size,1);
});
for(const failPut of [1,2])test('partial upload '+failPut+' cleans only this run',async()=>{
  const value=fake({failPut});await assert.rejects(verifyProductionStorage(value.args),error=>error.code==='STORAGE_CHECK_PROVIDER_UNCONFIRMED'&&!error.message.includes('unit-secret')&&error.proof.cleanupVerified);assert.deepEqual([...value.rows.keys()],[value.other]);
});
test('lost acknowledgement recovers provider bytes and does not duplicate',async()=>{
  const value=fake({lostReply:true});const result=await verifyProductionStorage(value.args);assert.equal(result.status,'PASS');assert.equal(result.putCalls,2);
});
test('preexisting path is neither overwritten nor deleted',async()=>{
  const value=fake({preexists:true});await assert.rejects(verifyProductionStorage(value.args),{code:'STORAGE_CHECK_PATH_PREEXISTS'});assert.equal(value.calls.put,0);assert.deepEqual(value.calls.delete,[]);
});
test('corrupt read fails without exposing provider output',async()=>{
  const value=fake({corrupt:true});await assert.rejects(verifyProductionStorage(value.args),error=>error.code==='STORAGE_CHECK_PROVIDER_UNCONFIRMED'&&error.proof.pairReadBackVerified===false&&error.proof.cleanupVerified);assert.equal(value.rows.size,1);
});
test('cleanup failure is explicit even after a successful pair read',async()=>{
  await assert.rejects(verifyProductionStorage(fake({deleteFail:true}).args),error=>error.code==='STORAGE_CHECK_CLEANUP_UNCONFIRMED'&&error.proof.cleanupVerified===false&&error.proof.status==='FAILED');
});
test('missing committed upload is never counted as confirmation',async()=>{
  await assert.rejects(verifyProductionStorage(fake({secondGetNull:true}).args),error=>error.proof.pairReadBackVerified===false);
});
test('report contains no URL, image content or credentials',async()=>{
  const report=JSON.stringify(await verifyProductionStorage(fake().args));assert.doesNotMatch(report,/https:|base64|synthetic-test-only|dni-front|selfie/);
});
test('entrypoint does not dump environments or modify business data',()=>{
  const code=readFileSync(new URL('../scripts/verify-private-storage-live.mjs',import.meta.url),'utf8');assert.doesNotMatch(code,/JSON.stringify\(process.env|DATABASE_URL|saveAppState|process.env.CLERK/);
});
