import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import {createFieldMedia} from '../src/lib/field-media.mjs';
import {createPilotMediaAnalyzer} from '../src/lib/pilot-media.mjs';
import {createVideoFrameExtractor} from '../src/lib/video-frame-extractor.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),scope='a'.repeat(64);
const command={operationId:'abcdefab-1234-4abc-9abc-abcdef123456',projectId:'project-a',scope,evidenceId:'evidence-a',revision:'2026-10-05T12:00:00.000001',analysisConsent:fieldMediaAnalysisConsent(true)};
let directory,video;
before(async()=>{directory=await mkdtemp(join(tmpdir(),'obrasaas-field-video-test-'));const file=join(directory,'generated.mp4'),generated=spawnSync(ffmpegPath,['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=160x90:rate=10','-t','1','-c:v','libx264','-threads','1',file],{windowsHide:true,timeout:15000});assert.equal(generated.status,0,generated.stderr?.toString());video=await readFile(file);});
after(async()=>{if(directory)await rm(directory,{recursive:true,force:true});});
const site={isWorksitePhoto:true,phase:'Synthetic',aiAnalysis:'Synthetic provider response; never a real field acceptance.',isIncident:false};
function fixture({bytes=video,fetchImpl,extractVideoFrames,onGet,manual=false}={}){
 const receipts=new Map(),queries=[],calls=[];let revision=1,revoked=false;
 const pathname='obrasaas/field/v1/'+'b'.repeat(64)+'/evidence.mp4',media={kind:'video',contentType:'video/mp4',pathname,bytes:bytes.length,sha256:hash(bytes),url:'https://fixture.private.blob.vercel-storage.com/'+pathname};
 const row={id:'evidence-a',title:'Synthetic video',description:'Generated non-person video fixture.',revision:command.revision,metadata:{fieldOperations:{version:1,kind:'EVIDENCE',taskId:'task-a',workerId:'worker-a',sectorId:'sector-a',capturedAt:'2026-10-05T12:00:00Z',recordedBy:'uploader-a',media,processing:{status:manual?'MANUAL_REVIEW_REQUIRED':'QUEUED'},review:null}}};
 const client={query:async(sql,args)=>{queries.push(sql);
  if(sql.includes('SELECT clock_timestamp() AS now'))return {rows:[{now:new Date()}]};
  if(sql.startsWith('SELECT id,metadata FROM public."AuditLog"'))return {rows:receipts.has(args[0])?[{id:args[0],metadata:receipts.get(args[0])}]:[]};
  if(sql.startsWith('UPDATE public."Incident"')){row.metadata=JSON.parse(args[2]);row.revision='2026-10-05T12:00:00.'+String(++revision).padStart(6,'0');return {rows:sql.includes('RETURNING id')?[{id:row.id}]:[]};}
  if(sql.startsWith('INSERT INTO public."AuditLog"')){receipts.set(args[0],JSON.parse(args[4]));return {rows:[]};}
  if(sql.startsWith('SELECT id FROM public."Worker"'))return {rows:revoked?[]:[{id:'worker-a'}]};
  throw new Error('Unexpected SQL: '+sql);
 }};
 const operations={mediaTransaction:async(session,input,writable,callback)=>callback(client,{role:'AUDITOR',actorId:'uploader-a',organizationId:'company-a'},scope,{}),readEvidence:async()=>row,
  assertWorker:async()=>{if(revoked)throw new WorkspaceError('FIELD_PARTICIPANT_REQUIRED',403);}};
 const analyzer=createPilotMediaAnalyzer({environment:()=>({OPENAI_API_KEY:'unit-not-a-real-key'}),fetchImpl:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return fetchImpl?fetchImpl(url,options):Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(site)}}]});}});
 const get=async()=>{onGet?.(()=>{revoked=true;});return {statusCode:200,blob:{url:media.url,pathname,size:bytes.length,contentType:'video/mp4'},stream:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};};
 return {row,calls,queries,receipts,revoke:()=>{revoked=true;},media:createFieldMedia({operations,get,put:async()=>{throw new Error('Processing must not upload another original');},analyzer,...(extractVideoFrames?{extractVideoFrames}:{})})};
}
test('stored original is actually decoded then sampled in one analysis request, with no task/proposal writes and receipt replay',async()=>{
 const f=fixture({manual:true}),result=await f.media.process({},command);
 assert.equal(result.saved,true);assert.equal(result.evidence.processing.status,'ANALYZED_UNREVIEWED',result.evidence.processing.code);assert.equal(result.evidence.processing.result.sampling.sourceSha256,hash(video));assert.equal(result.evidence.processing.result.sampling.audioAnalyzed,false);assert.equal(result.evidence.status,'PENDING');assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.messages[1].content.filter(part=>part.type==='image_url').length,4);
 assert.equal(f.receipts.size,1);assert.ok(f.queries.every(sql=>!sql.includes('public."Task"')&&!sql.includes('public."OperationalProposal"')));
 const again=await f.media.process({},{...command,operationId:command.operationId.toUpperCase()});assert.equal(again.replayed,true);assert.equal(again.receiptId,result.receiptId);assert.equal(f.calls.length,1);
 assert.deepEqual((await f.media.download({},{projectId:'project-a',scope,evidenceId:'evidence-a'})).bytes,video);
 f.revoke();await assert.rejects(f.media.process({},command),{code:'FIELD_PARTICIPANT_REQUIRED'});assert.equal(f.calls.length,1);
});
test('invalid original never reaches provider, remains private and has a recoverable failed-processing receipt',async()=>{
 const bytes=Buffer.from('0000ftypisom000000000000'),f=fixture({bytes}),result=await f.media.process({},command);
 assert.equal(result.saved,true);assert.equal(result.evidence.processing.status,'FAILED_RETRYABLE');assert.equal(result.evidence.processing.code,'FIELD_VIDEO_DECODE_INVALID');assert.equal(f.calls.length,0);assert.equal(f.receipts.size,1);assert.deepEqual((await f.media.download({},{projectId:'project-a',scope,evidenceId:'evidence-a'})).bytes,bytes);
});
test('saved video without current explicit analysis consent cannot start a reservation or provider disclosure',async()=>{
 for(const analysisConsent of [undefined,fieldMediaAnalysisConsent(false),{...fieldMediaAnalysisConsent(true),noticeVersion:'past-photo-only'},{...fieldMediaAnalysisConsent(true),noticeSha256:'f'.repeat(64)}]){
  const f=fixture(),input={...command};if(analysisConsent===undefined)delete input.analysisConsent;else input.analysisConsent=analysisConsent;
  await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED'});assert.equal(f.calls.length,0);assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'QUEUED');assert.ok(f.queries.every(sql=>!sql.startsWith('UPDATE')));
 }
});
test('revoked ownership after private read is checked before any provider disclosure',async()=>{
 const f=fixture({onGet:revoke=>revoke()});await assert.rejects(f.media.process({},command),{code:'FIELD_PARTICIPANT_REQUIRED'});assert.equal(f.calls.length,0);assert.equal(f.receipts.size,0);
});
function syntheticFrames({buffer,mimeType}){
 const frames=Array.from({length:4},(_,index)=>{const bytes=Buffer.from([255,216,255,224,index]);return {base64:bytes.toString('base64'),mimeType:'image/jpeg',bytes:bytes.length,sha256:hash(bytes),capturedAtSeconds:index/4};});
 return {frames,sampling:{version:'server-video-frames-v1',sourceSha256:hash(buffer),sourceContentType:mimeType,sourceBytes:buffer.length,durationSeconds:1,frameCount:4,audioAnalyzed:false}};
}
test('an expired same-operation retry gets a new lease and an old provider response cannot overwrite it',async()=>{
 let startedFirst,startedSecond,finishFirst,finishSecond;
 const firstStarted=new Promise(resolve=>{startedFirst=resolve;}),secondStarted=new Promise(resolve=>{startedSecond=resolve;});
 const firstResponse=new Promise(resolve=>{finishFirst=resolve;}),secondResponse=new Promise(resolve=>{finishSecond=resolve;});let count=0;
 const f=fixture({extractVideoFrames:syntheticFrames,fetchImpl:async()=>{count++;if(count===1){startedFirst();return firstResponse;}startedSecond();return secondResponse;}});
 const first=f.media.process({},command);await firstStarted;const oldLease=f.row.metadata.fieldOperations.processing.leaseId;f.row.metadata.fieldOperations.processing.expiresAt='2000-01-01T00:00:00.000Z';
 const second=f.media.process({},command);await secondStarted;assert.notEqual(f.row.metadata.fieldOperations.processing.leaseId,oldLease);
 finishFirst(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...site,aiAnalysis:'Old superseded analysis.'})}}]}));await assert.rejects(first,{code:'FIELD_MEDIA_PROCESSING_CHANGED'});assert.equal(f.receipts.size,0);
 finishSecond(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({...site,aiAnalysis:'Current reserved analysis.'})}}]}));const result=await second;assert.equal(result.evidence.processing.result.aiAnalysis,'Current reserved analysis.');assert.equal(f.receipts.size,1);
});
test('shared cancellation interrupts actual video decoding before provider disclosure',async()=>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10);
 try{await assert.rejects(createVideoFrameExtractor()({buffer:video,mimeType:'video/mp4',signal:controller.signal}),{code:'FIELD_VIDEO_DECODE_TIMEOUT'});}finally{clearTimeout(timer);}
});
