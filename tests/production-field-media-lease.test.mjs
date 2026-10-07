import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createFieldMedia,FIELD_MEDIA_PROCESS_TIMEOUT_MS} from '../src/lib/field-media.mjs';
import {createPilotMediaAnalyzer} from '../src/lib/pilot-media.mjs';
import {createVideoFrameExtractor} from '../src/lib/video-frame-extractor.mjs';
import {fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),revision='2026-10-05T12:00:00.000001';
const input={operationId:'abcdefab-1234-4abc-9abc-abcdef123456',projectId:'project-a',scope,evidenceId:'evidence-a',revision,analysisConsent:fieldMediaAnalysisConsent(true)};
const result={success:true,status:'TRANSCRIBED_UNREVIEWED',text:'Ejecutamos en total 12 metros cuadrados de revoque.'};
function fixture({onTransaction,onGet,onAnalyze,conditionalMiss=false,processTimeoutMs,stallBody=false}={}){
 const bytes=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(40)]),pathname='obrasaas/field/v1/'+'b'.repeat(64)+'/evidence.wav';
 const media={kind:'audio',contentType:'audio/wav',pathname,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:'https://fixture.private.blob.vercel-storage.com/'+pathname};
 const row={id:input.evidenceId,title:'Synthetic audio',description:'Synthetic private audio only.',revision,metadata:{fieldOperations:{version:1,kind:'EVIDENCE',workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',media,processing:{status:'QUEUED'},review:null}}};
 const counts={get:0,provider:0,put:0,transactions:0,bodyCancelled:0},receipts=new Map(),queries=[];
 let now=new Date('2026-10-07T12:00:00.000Z'),revoked=false;
 const expire=()=>{row.metadata.fieldOperations.processing.expiresAt=new Date(now.getTime()-1).toISOString();};
 const client={query:async(sql,args)=>{
  queries.push(sql);
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
  if(sql.startsWith('SELECT id,metadata FROM public."AuditLog"'))return {rows:receipts.has(args[0])?[{id:args[0],metadata:structuredClone(receipts.get(args[0]))}]:[]};
  if(sql.startsWith("SELECT id,metadata->'fieldOperations'->'processing'"))return {rows:row.metadata.fieldOperations.processing.operationId===args[1]&&row.metadata.fieldOperations.processing.actorId===args[2]?[{id:row.id,processing:structuredClone(row.metadata.fieldOperations.processing)}]:[]};
  if(sql.startsWith('SELECT id FROM public."Worker"'))return {rows:revoked?[]:[{id:'worker-a'}]};
  if(sql.startsWith('UPDATE public."Incident"')){
   if(sql.includes('RETURNING id')&&conditionalMiss)return {rows:[]};
   row.metadata=JSON.parse(args[2]);row.revision='2026-10-07T12:00:00.'+String(counts.transactions).padStart(6,'0');
   return {rows:sql.includes('RETURNING id')?[{id:row.id}]:[]};
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){receipts.set(args[0],JSON.parse(args[4]));return {rows:[]};}
  assert.fail('Unexpected fixture SQL: '+sql);
 }};
 const operations={mediaTransaction:async(_session,_input,_writable,callback)=>{
  counts.transactions++;onTransaction?.(counts.transactions,{row,expire,revoke:()=>{revoked=true;}});
  const before=structuredClone(row),beforeReceipts=new Map(receipts);
  try{return await callback(client,{role:'AUDITOR',actorId:'uploader-a',organizationId:'company-a'},scope,{});}catch(error){Object.assign(row,before);receipts.clear();for(const [key,value]of beforeReceipts)receipts.set(key,value);throw error;}
 },readEvidence:async()=>structuredClone(row),readTask:async()=>({id:'task-a',title:'Synthetic revoque',revision}),assertWorker:async()=>{if(revoked)throw new WorkspaceError('FIELD_KYC_REVIEW_REQUIRED',403);}};
 const get=async(_pathname,options)=>{
  counts.get++;onGet?.({row,expire,signal:options.abortSignal,revoke:()=>{revoked=true;}});
  return {statusCode:200,blob:{url:media.url,pathname,size:bytes.length,contentType:media.contentType},stream:stallBody?new ReadableStream({cancel(){counts.bodyCancelled++;}}):new Response(bytes).body};
 };
 const analyzer={transcribeAudio:async request=>{counts.provider++;return onAnalyze?onAnalyze({request,row,expire}):result;},analyzePhoto:async()=>assert.fail('Audio fixture cannot analyze photo'),analyzeVideo:async()=>assert.fail('Audio fixture cannot analyze video')};
 return {row,counts,receipts,queries,expire,revoke:()=>{revoked=true;},setNow:value=>{now=new Date(value);},media:createFieldMedia({operations,get,put:async()=>{counts.put++;assert.fail('PROCESS cannot upload another original');},analyzer,...(processTimeoutMs?{processTimeoutMs}:{})})};
}

for(const delta of [-86400000,86400000])test('live DB lease remains exclusive despite application clock skew '+delta,async t=>{
 const f=fixture();f.row.metadata.fieldOperations.processing={status:'RUNNING',operationId:input.operationId,requestDigest:digest(['PROCESS',input]),actorId:'uploader-a',leaseId:'original-lease',expiresAt:'2026-10-07T12:01:30.000Z'};
 t.mock.method(Date,'now',()=>Date.parse('2026-10-07T12:00:00.000Z')+delta);
 await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING'});assert.equal(f.row.metadata.fieldOperations.processing.leaseId,'original-lease');assert.equal(f.counts.get,0);assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);
});
test('expired DB lease is reclaimable even when application clock is behind',async t=>{
 const f=fixture();f.row.metadata.fieldOperations.processing={status:'RUNNING',operationId:input.operationId,requestDigest:digest(['PROCESS',input]),actorId:'uploader-a',leaseId:'expired-lease',expiresAt:'2026-10-07T11:59:59.999Z'};
 t.mock.method(Date,'now',()=>Date.parse('2026-10-06T12:00:00.000Z'));
 const saved=await f.media.process({},input);assert.equal(saved.saved,true);assert.equal(saved.evidence.processing.status,'TRANSCRIBED_UNREVIEWED');assert.equal(f.counts.provider,1);assert.equal(f.receipts.size,1);
});
test('lease expiry after claim acknowledgement stops the original Blob GET',async()=>{
 const f=fixture({onTransaction:(n,{expire})=>{if(n===2)expire();}});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_EXPIRED'});assert.equal(f.counts.get,0);assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);
});
test('lease expiry during Blob read prevents provider disclosure and failure receipt',async()=>{
 const f=fixture({onGet:({expire})=>expire()});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_EXPIRED'});assert.equal(f.counts.get,1);assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'RUNNING');
});
for(const field of ['actorId','operationId','requestDigest','leaseId','status'])test('current '+field+' fence prevents disclosure after private read',async()=>{
 const f=fixture({onGet:({row})=>{row.metadata.fieldOperations.processing[field]=field==='status'?'FAILED_RETRYABLE':'other';}});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_CHANGED'});assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);
});
test('current KYC denial after Blob read is never converted into a provider-failure receipt',async()=>{
 const f=fixture({onGet:({revoke})=>revoke()});await assert.rejects(f.media.process({},input),{code:'FIELD_KYC_REVIEW_REQUIRED'});assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);
});
test('late response with unchanged expired lease is rejected and exact retry remains canonical',async()=>{
 let first=true;const f=fixture({onAnalyze:({expire})=>{if(first){first=false;expire();}return result;}});
 await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_EXPIRED'});assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'RUNNING');const expiredLease=f.row.metadata.fieldOperations.processing.leaseId;
 const saved=await f.media.process({},input);assert.equal(saved.saved,true);assert.equal(f.counts.provider,2);assert.equal(f.receipts.size,1);assert.ok(!JSON.stringify(saved).includes(expiredLease));
 const replay=await f.media.process({},input);assert.equal(replay.replayed,true);assert.equal(replay.receiptId,saved.receiptId);assert.equal(f.counts.get,2);assert.equal(f.counts.provider,2);
});
test('conditional final SQL miss rolls back without AuditLog or successful outcome',async()=>{
 const f=fixture({conditionalMiss:true});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_CHANGED'});assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'RUNNING');assert.equal(f.queries.some(sql=>sql.startsWith('INSERT INTO public."AuditLog"')),false);
});
test('one shared budget aborts a pending Blob body and leaves no provider or failed receipt',async()=>{
 const keepAlive=setTimeout(()=>{},1000);try{const f=fixture({processTimeoutMs:20,stallBody:true});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.equal(f.counts.bodyCancelled,1);assert.equal(f.counts.provider,0);assert.equal(f.receipts.size,0);}finally{clearTimeout(keepAlive);}
});
test('one shared budget reaches analyzer and aborts its pending operation',async()=>{
 const keepAlive=setTimeout(()=>{},1000);try{let cancelled=false;const f=fixture({processTimeoutMs:20,onAnalyze:({request})=>new Promise((resolve,reject)=>{assert.ok(request.signal instanceof AbortSignal);request.signal.addEventListener('abort',()=>{cancelled=true;reject(request.signal.reason);},{once:true});})});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.equal(cancelled,true);assert.equal(f.receipts.size,0);}finally{clearTimeout(keepAlive);}
});
test('processing budget cannot exceed the eighty-second default',()=>{
 assert.equal(FIELD_MEDIA_PROCESS_TIMEOUT_MS,80000);for(const processTimeoutMs of [0,80001,Infinity,1.5])assert.throws(()=>createFieldMedia({operations:{},processTimeoutMs}),TypeError);
});
test('pre-aborted analysis signal cannot send photo or audio data',async()=>{
 let calls=0;const analyzer=createPilotMediaAnalyzer({environment:()=>({OPENAI_API_KEY:'fixture-not-a-key'}),fetchImpl:async()=>{calls++;assert.fail('Aborted analysis cannot disclose data');}}),signal=AbortSignal.abort();
 const photo=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
 assert.equal((await analyzer.analyzePhoto({base64:photo.toString('base64'),mimeType:'image/png',signal})).success,false);assert.equal((await analyzer.transcribeAudio({buffer:Buffer.from('fixture'),mimeType:'audio/wav',signal})).success,false);assert.equal(calls,0);
});
test('analysis response-body reading observes shared cancellation and closes its stream',async()=>{
 const controller=new AbortController();let cancelled=0,started;
 const ready=new Promise(resolve=>{started=resolve;}),analyzer=createPilotMediaAnalyzer({environment:()=>({OPENAI_API_KEY:'fixture-not-a-key'}),fetchImpl:async(_url,{signal})=>{assert.equal(signal.aborted,false);started();return new Response(new ReadableStream({cancel(){cancelled++;}}));}});
 const pending=analyzer.transcribeAudio({buffer:Buffer.from('fixture'),mimeType:'audio/wav',signal:controller.signal});await ready;controller.abort();assert.equal((await pending).success,false);assert.equal(cancelled,1);
});
test('pre-aborted frame extraction cannot launch an unavailable decoder',async()=>{
 const buffer=Buffer.from('0000ftypisom000000000000');await assert.rejects(createVideoFrameExtractor({binaryPath:'must-not-launch-fixture-decoder'})({buffer,mimeType:'video/mp4',signal:AbortSignal.abort()}),{code:'FIELD_VIDEO_DECODE_TIMEOUT'});
});
test('pending receipt reports expiry from DB clock without leaking processing metadata',async t=>{
 const f=fixture();f.row.metadata.fieldOperations.processing={status:'RUNNING',operationId:input.operationId,requestDigest:digest(['PROCESS',input]),actorId:'uploader-a',leaseId:'private-lease',expiresAt:'2026-10-07T12:01:30.000Z'};
 t.mock.method(Date,'now',()=>Date.parse('2099-01-01T00:00:00.000Z'));
 const context={projectId:input.projectId,scope,operationId:input.operationId},live=await f.media.status({userId:'user_A'},context);assert.equal(live.state,'PROCESSING');assert.equal(live.leaseExpired,false);assert.deepEqual(Object.keys(live).sort(),['definitive','expiresAt','leaseExpired','retryAfterExpiration','scope','state'].sort());
 f.setNow('2026-10-07T12:01:30.000Z');const expired=await f.media.status({userId:'user_A'},context);assert.equal(expired.leaseExpired,true);assert.equal(expired.definitive,false);assert.equal(expired.saved,undefined);assert.equal(f.receipts.size,0);assert.equal(f.counts.get,0);assert.equal(f.counts.provider,0);
});
test('revoked current ownership cannot read pending lease recovery state',async()=>{
 const f=fixture();f.row.metadata.fieldOperations.processing={status:'RUNNING',operationId:input.operationId,actorId:'uploader-a',leaseId:'private-lease',expiresAt:'2026-10-07T12:01:30.000Z'};f.revoke();await assert.rejects(f.media.status({userId:'user_A'},{projectId:input.projectId,scope,operationId:input.operationId}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});assert.equal(f.counts.get,0);assert.equal(f.counts.provider,0);
});
