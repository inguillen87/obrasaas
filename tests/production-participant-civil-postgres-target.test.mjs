import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createPrivateImageUploader,PrivateImageError} from '../src/lib/private-image-upload.mjs';
import {participantCivilDisposableUrl,participantCivilOwnedDatabase,participantCivilSourceFiles,participantCivilPostgresFailure,createParticipantCivilDispatchObserver,createParticipantCivilBlobAdapter,verifyParticipantCivilPostgres,PARTICIPANT_CIVIL_POSTGRES_PROOF_VERSION,PARTICIPANT_CIVIL_POSTGRES_CHECKS} from '../scripts/verify-participant-civil-postgres.mjs';

// Guards/source closure only. These tests never execute native SQL or connect.
const target={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'};
const rejected=value=>assert.throws(()=>participantCivilDisposableUrl(value),{code:'PARTICIPANT_CIVIL_DISPOSABLE_TARGET_REJECTED'});
const picture='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
const blobEnvironment=()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-guard-only'});

test('the actual native Blob adapter permits missing probe, real uploader confirmation and exact replay without overwrite',async()=>{
 const objects=new Map(),trace=[];let writes=0;const adapter=createParticipantCivilBlobAdapter({objects,onPut:()=>{writes++;}});
 const get=async(...args)=>{const value=await adapter.get(...args);trace.push(value===null?'GET_MISSING':'GET_FOUND');return value;},put=async(...args)=>{trace.push('PUT');return adapter.put(...args);};
 const uploader=createPrivateImageUploader({get,put,environment:blobEnvironment}),url=await uploader.uploadImageToBlob(picture,'civil-native-front','image/png');
 assert.deepEqual(trace,['GET_MISSING','PUT','GET_FOUND']);assert.equal(writes,1);assert.equal(objects.size,1);
 const pathname=[...objects.keys()][0],receipt=await adapter.get(pathname,{access:'private',useCache:false});assert.equal(receipt.blob.pathname,pathname);assert.equal(receipt.blob.url,url);assert.equal(receipt.blob.contentType,'image/png');assert.equal(receipt.blob.size,Buffer.from(picture,'base64').length);assert.deepEqual(Buffer.from(await new Response(receipt.stream).arrayBuffer()),Buffer.from(picture,'base64'));
 assert.equal(await uploader.uploadImageToBlob(picture,'civil-native-front','image/png'),url);assert.equal(trace.at(-1),'GET_FOUND');assert.equal(writes,1);assert.equal(objects.size,1);
});

test('real uploader recovers a synthetic lost PUT ACK by reading the same committed private object once',async()=>{
 const objects=new Map(),trace=[];let writes=0;const adapter=createParticipantCivilBlobAdapter({objects,onPut:()=>{writes++;}}),uploader=createPrivateImageUploader({get:async(...args)=>{trace.push('GET');return adapter.get(...args);},put:async(...args)=>{trace.push('PUT');await adapter.put(...args);throw Error('Synthetic lost write ACK');},environment:blobEnvironment});
 const url=await uploader.uploadImageToBlob(picture,'civil-native-front','image/png');assert.deepEqual(trace,['GET','PUT','GET']);assert.equal(writes,1);assert.equal(objects.size,1);assert.equal(await uploader.uploadImageToBlob(picture,'civil-native-front','image/png'),url);assert.equal(writes,1);
});

test('real uploader rejects the former missing-pathname receipt instead of weakening private Blob identity',async()=>{
 const adapter=createParticipantCivilBlobAdapter(),uploader=createPrivateImageUploader({...adapter,environment:blobEnvironment});await uploader.uploadImageToBlob(picture,'civil-native-front','image/png');
 const mutant=createPrivateImageUploader({...adapter,get:async(...args)=>{const result=await adapter.get(...args);if(result)delete result.blob.pathname;return result;},environment:blobEnvironment});
 await assert.rejects(mutant.uploadImageToBlob(picture,'civil-native-front','image/png'),error=>error instanceof PrivateImageError&&error.code==='PRIVATE_IMAGE_RECEIPT_MISMATCH');
});

test('native civil verification requires the explicitly marked disposable URL before creating any connection',async()=>{
 for(const value of [{},{CUTOVER_TEST_DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL},{...target,CUTOVER_TEST_DISPOSABLE:'0'},{...target,CUTOVER_TEST_DISPOSABLE:'true'},{CUTOVER_TEST_DISPOSABLE:'1',DATABASE_URL:target.CUTOVER_TEST_DATABASE_URL}])rejected(value);
 await assert.rejects(verifyParticipantCivilPostgres({}),{code:'PARTICIPANT_CIVIL_DISPOSABLE_TARGET_REJECTED'});
});

test('native civil target permits only exact localhost ports, database, role and local bootstrap passwords',()=>{
 assert.equal(participantCivilDisposableUrl(target).href,target.CUTOVER_TEST_DATABASE_URL);
 for(const host of ['127.0.0.1','localhost'])for(const port of ['5432','6549'])assert.equal(participantCivilDisposableUrl({...target,CUTOVER_TEST_DATABASE_URL:`postgresql://cutover_test@${host}:${port}/obrasaas_cutover_ci`}).hostname,host);
 for(const value of ['postgresql://cutover_test@example.invalid:5432/obrasaas_cutover_ci','postgresql://cutover_test@ep-fixture.neon.tech:5432/neondb','postgresql://postgres@localhost:5432/obrasaas_cutover_ci','postgresql://cutover_test@localhost:5432/production','postgresql://cutover_test:other@localhost:5432/obrasaas_cutover_ci','postgresql://cutover_test:cutover_test@localhost:6549/obrasaas_cutover_ci','postgresql://cutover_test@localhost:6548/obrasaas_cutover_ci',target.CUTOVER_TEST_DATABASE_URL+'?sslmode=require',target.CUTOVER_TEST_DATABASE_URL+'#ignored','https://localhost:5432/obrasaas_cutover_ci'])rejected({...target,CUTOVER_TEST_DATABASE_URL:value});
 for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET','VERCEL_TARGET_ENV'])rejected({...target,[key]:'production'});
});

test('owned civil database grammar cannot drop the bootstrap, other harness databases or a shell/SQL expression',()=>{
 const database='obrasaas_civil_'+'a'.repeat(32);assert.equal(participantCivilOwnedDatabase(database),database);
 for(const value of [undefined,null,'postgres','obrasaas_cutover_ci','obrasaas_subscription_'+'a'.repeat(32),'obrasaas_civil_'+'A'.repeat(32),database+'x',database+';DROP DATABASE postgres','"'+database+'"','obrasaas_civil_'+'a'.repeat(31)])assert.throws(()=>participantCivilOwnedDatabase(value),{code:'PARTICIPANT_CIVIL_OWNED_DATABASE_REJECTED'});
});

test('native civil checks contain real Project/Worker ordering, concurrent GET, unknown holds, revocation and late receipt cases',()=>{
 assert.equal(PARTICIPANT_CIVIL_POSTGRES_PROOF_VERSION,'participant-civil-postgres-v1');assert.equal(PARTICIPANT_CIVIL_POSTGRES_CHECKS.length,16);assert.ok(Object.isFrozen(PARTICIPANT_CIVIL_POSTGRES_CHECKS));assert.equal(new Set(PARTICIPANT_CIVIL_POSTGRES_CHECKS).size,16);
 for(const fragment of ['manager-held-Project','holder-held-Project','concurrent-instance','new-UUID','post-GET-operator','post-GET-holder','late-observer','read-only','do-not-approve'])assert.ok(PARTICIPANT_CIVIL_POSTGRES_CHECKS.some(check=>check.includes(fragment)),fragment);
});

test('native civil source closure covers actual canonical stores, transport, upload evidence, cleanup and guard source',()=>{
 const files=participantCivilSourceFiles();assert.deepEqual(files,[...files].sort());assert.equal(new Set(files).size,files.length);assert.ok(files.every(file=>!file.includes('..')&&!path.isAbsolute(file)));
 for(const file of ['scripts/verify-participant-civil-postgres.mjs','tests/production-participant-civil-postgres-target.test.mjs','scripts/lib/disposable-postgres-cleanup.mjs','src/lib/participant-civil-store.mjs','src/lib/participant-civil-policy.mjs','src/lib/participant-store.mjs','src/lib/participant-policy.mjs','src/lib/participant-kyc-image-set.mjs','src/lib/bindx-civil-data-client.mjs','src/lib/private-image-upload.mjs','src/lib/workspace-store.mjs','src/lib/workspace-policy.mjs','package.json','package-lock.json'])assert.ok(files.includes(file),file);
});

test('transport observes only its caller committed reservation and released pool checkouts despite a concurrent open transaction',async()=>{
 const observer=createParticipantCivilDispatchObserver();let release,entered;const held=new Promise(resolve=>{release=resolve;}),reached=new Promise(resolve=>{entered=resolve;});
 assert.throws(()=>observer.beforeExternal());
 const first=observer.run(async()=>{
  const client=observer.trackClient(101);client.acquired('BEGIN',false);entered();await held;
  assert.throws(()=>observer.beforeExternal());client.acquired('COMMIT');assert.throws(()=>observer.beforeExternal());client.released();
  const proof=observer.beforeExternal();assert.equal(proof.dispatchId,'civil-dispatch-1');assert.equal(proof.callerCheckoutCount,1);
 });
 try{
  await reached;await observer.run(async()=>{
   const reservation=observer.trackClient(202);reservation.acquired('BEGIN',false);reservation.acquired('COMMIT');reservation.released();
   const fence=observer.trackClient(202);fence.acquired('BEGIN',true);fence.acquired('COMMIT');fence.released();
   const proof=observer.beforeExternal();assert.deepEqual(proof,{dispatchId:'civil-dispatch-2',reservationCommitted:true,callerClientsReleased:true,callerCheckoutCount:2});
  });
 }finally{release();await first;}
});

test('transport rejects no reservation, readonly or rolled-back reservation and a released connection with an open transaction',()=>{
 for(const mode of ['NONE','READ_ONLY','ROLLBACK','EARLY_RELEASE']){
  const observer=createParticipantCivilDispatchObserver();observer.run(()=>{
   if(mode!=='NONE'){
    const client=observer.trackClient(101);client.acquired('BEGIN',mode==='READ_ONLY');
    if(mode!=='EARLY_RELEASE')client.acquired(mode==='ROLLBACK'?'ROLLBACK':'COMMIT');client.released();
   }
   assert.throws(()=>observer.beforeExternal());
  });
 }
});

test('native failure evidence retains only bounded source location, safe codes, check stage and measured cleanup facts',()=>{
 const sensitive='synthetic-private-secret',context={stage:'NATIVE_CHECK',check:PARTICIPANT_CIVIL_POSTGRES_CHECKS[13],completedCheckCount:13,poolClosed:true,databaseRemoved:true,adminClosed:true},root=process.cwd(),source=path.join(root,'src/lib/participant-civil-store.mjs');
 const error=Object.assign(new TypeError(sensitive),{stack:`TypeError: ${sensitive}\n    at settle (${source}:100:10)\n    at provider (/private/${sensitive}.js:1:1)`,actual:{dni:sensitive},expected:sensitive}),proof=participantCivilPostgresFailure(error,{root,context});assert.equal(proof.check,context.check);assert.equal(proof.completedCheckCount,13);assert.equal(proof.poolClosed,true);assert.equal(proof.databaseRemoved,true);assert.equal(proof.adminClosed,true);assert.deepEqual(proof.locations,['src/lib/participant-civil-store.mjs:100:10']);assert.doesNotMatch(JSON.stringify(proof),new RegExp(sensitive));
 const sql=participantCivilPostgresFailure({name:'error',code:'42703',query:sensitive,message:sensitive,detail:sensitive},{context});assert.equal(sql.sqlCode,'42703');assert.doesNotMatch(JSON.stringify(sql),new RegExp(sensitive));const forged=participantCivilPostgresFailure({message:sensitive},{context:{...context,stage:sensitive,check:sensitive,completedCheckCount:999}});assert.equal(forged.check,null);assert.equal(forged.completedCheckCount,0);assert.equal(forged.stage,'TARGET_GUARD');assert.doesNotMatch(JSON.stringify(forged),new RegExp(sensitive));
});

test('native diagnostics preserve known wrapped storage codes, native SQLSTATE and POSIX file URL locations without private messages',()=>{
 const sensitive='private-nominal-secret',root='/home/runner/work/obrasaas/obrasaas',context={stage:'NATIVE_CHECK',check:PARTICIPANT_CIVIL_POSTGRES_CHECKS[1],completedCheckCount:1,sqlCode:'42703'},stack=`WorkspaceError: ${sensitive}\n    at upload (file://${root}/src/lib/participant-store.mjs:300:10)\n    at seed (file://${root}/scripts/verify-participant-civil-postgres.mjs:150:4)\n    at foreign (file:///private/${sensitive}.mjs:1:1)`;
 for(const code of ['PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED','WORKSPACE_OPERATION_UNCONFIRMED','PRIVATE_IMAGE_RECEIPT_MISMATCH']){
  const proof=participantCivilPostgresFailure({name:'WorkspaceError',code,message:sensitive,stack,detail:sensitive},{root,context});assert.equal(proof.code,code);assert.equal(proof.sqlCode,'42703');assert.deepEqual(proof.locations,['src/lib/participant-store.mjs:300:10','scripts/verify-participant-civil-postgres.mjs:150:4']);assert.doesNotMatch(JSON.stringify(proof),new RegExp(sensitive));
 }
 for(const code of ['PARTICIPANT_CIVIL_'+sensitive.toUpperCase(),'WORKSPACE_UNKNOWN_PRIVATE','TOKEN']){const proof=participantCivilPostgresFailure({code,message:sensitive,stack},{root,context:{...context,sqlCode:sensitive}});assert.equal(proof.code,'PARTICIPANT_CIVIL_NATIVE_UNCONFIRMED');assert.equal(proof.sqlCode,null);assert.doesNotMatch(JSON.stringify(proof),new RegExp(sensitive));}
 const caused=participantCivilPostgresFailure({code:'WORKSPACE_OPERATION_UNCONFIRMED',cause:{code:'40P01',message:sensitive}},{context});assert.equal(caused.sqlCode,'40P01');assert.doesNotMatch(JSON.stringify(caused),new RegExp(sensitive));
});
