import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import ffmpegPath from 'ffmpeg-static';
import {createFieldMedia} from '../src/lib/field-media.mjs';
import {createVideoFrameExtractor} from '../src/lib/video-frame-extractor.mjs';
import {createVideoAudioExtractor} from '../src/lib/video-audio-extractor.mjs';
import {createPilotMediaAnalyzer} from '../src/lib/pilot-media.mjs';
import {fieldVideoAnalysisConsent,fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';
import {prepareVoiceProgressDraft,voiceProgressDraftReady} from '../src/lib/voice-progress-draft.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex'),scope='a'.repeat(64),revision='2026-10-07T12:00:00.000001';
const input={operationId:'abcdefab-1234-4abc-9abc-abcdef123456',projectId:'project-a',scope,evidenceId:'evidence-a',revision,analysisConsent:fieldVideoAnalysisConsent(true,true)};
const text='Ejecutamos en total 12,5 metros cuadrados de revoque.';
const task={id:'task-a',title:'Revoque sintético',revision},visualRaw={isWorksitePhoto:true,phase:'Revoque',aiAnalysis:'Cuatro cuadros sintéticos; el metrado requiere revisión.',isIncident:false,incidentSeverity:null,actionRecommendation:null};
const transcript={success:true,status:'TRANSCRIBED_UNREVIEWED',text,provider:'openai',providerModel:'gpt-transcribe'};
const visual={success:true,status:'ANALYZED_UNREVIEWED',...visualRaw,provider:'openai',providerModel:'gpt-4o'};
let directory;const clips={},prepared={};
before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'obrasaas-contextual-video-test-'));
 const cases=[['signal','mp4','sine=frequency=440:sample_rate=48000','aac'],['absent','mp4',null,null],['silence','mp4','anullsrc=sample_rate=48000:channel_layout=stereo','aac'],['low','webm','aevalsrc=0.0001*sin(2*PI*440*t):s=48000','libopus'],['cancel','webm','aevalsrc=0.2*sin(2*PI*440*t)|-0.2*sin(2*PI*440*t):s=48000','pcm_s16le']];
 for(const [name,extension,audio,codec] of cases){
  const path=join(directory,name+'.'+extension),args=['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=160x90:rate=10'];
  if(audio)args.push('-f','lavfi','-i',audio);args.push('-t','1','-c:v',extension==='mp4'?'libx264':'libvpx-vp9','-threads','1');if(audio)args.push('-c:a',codec);if(name==='cancel')args.push('-f','matroska');args.push(path);
  const r=spawnSync(ffmpegPath,args,{windowsHide:true,timeout:15000,maxBuffer:1024*1024});assert.equal(r.status,0,r.stderr?.toString());const bytes=await readFile(path),mimeType='video/'+extension;clips[name]={bytes,mimeType};
  const [frames,audioResult]=await Promise.all([createVideoFrameExtractor()({buffer:bytes,mimeType}),createVideoAudioExtractor()({buffer:bytes,mimeType})]);prepared[name]={frames,audio:audioResult};
 }
 assert.equal(prepared.signal.audio.status,'SIGNAL_UNREVIEWED');assert.equal(prepared.absent.audio.status,'NO_AUDIO_TRACK');assert.equal(prepared.silence.audio.status,'DIGITAL_SILENCE');assert.equal(prepared.low.audio.status,'SIGNAL_UNREVIEWED');assert.equal(prepared.cancel.audio.status,'UNCONFIRMED_DOWNMIX');
});
after(async()=>{if(directory)await rm(directory,{recursive:true,force:true});});
function fixture({name='signal',onGet,onTransaction,onAudio,onVision,extractFrames,extractAudio,real=false,conditionalMiss=false,processTimeoutMs,kind='video',pilot=false}={}){
 const {bytes,mimeType}=clips[name],pathname='obrasaas/field/v1/'+'b'.repeat(64)+'/evidence.'+mimeType.split('/')[1];
 const media={kind,contentType:mimeType,pathname,bytes:bytes.length,sha256:hash(bytes),url:'https://fixture.private.blob.vercel-storage.com/'+pathname};
 const row={id:'evidence-a',title:'Video sintético',description:'Sólo datos generados para pruebas.',revision,metadata:{fieldOperations:{version:1,kind:'EVIDENCE',workerId:'worker-a',taskId:task.id,sectorId:'sector-a',recordedBy:'uploader-a',capturedAt:'2026-10-07T12:00:00Z',media,processing:{status:'QUEUED'},review:null}}};
 const receipts=new Map(),queries=[],calls=[],counts={get:0,frames:0,audioDecode:0,transcribe:0,vision:0,put:0,transactions:0};let revoked=false,now=new Date('2026-10-07T12:00:00.000Z'),taskCurrent=structuredClone(task);
 const context={row,counts,calls,receipts,queries,expire:()=>{row.metadata.fieldOperations.processing.expiresAt=new Date(now.getTime()-1).toISOString();},revoke:()=>{revoked=true;},changeTask:()=>{taskCurrent.revision='2026-10-07T12:00:00.000002';},setNow:value=>{now=new Date(value);}};
 const client={query:async(sql,args)=>{
  queries.push(sql);if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(now)}]};
  if(sql.startsWith('SELECT id,metadata FROM public."AuditLog"'))return {rows:receipts.has(args[0])?[{id:args[0],metadata:structuredClone(receipts.get(args[0]))}]:[]};
  if(sql.startsWith('UPDATE public."Incident"')){
   if(sql.includes('RETURNING id')){
    const p=row.metadata.fieldOperations.processing,e=row.metadata.fieldOperations,match=!conditionalMiss&&sql.includes("expiresAt')::timestamptz>clock_timestamp()")&&sql.includes("->'review' IS NULL")&&p.status==='RUNNING'&&p.actorId===args[3]&&p.operationId===args[4]&&p.requestDigest===args[5]&&p.leaseId===args[6]&&Date.parse(p.expiresAt)>now.getTime()&&!e.review;
    if(!match)return {rows:[]};
   }
   row.metadata=JSON.parse(args[2]);row.revision='2026-10-07T12:00:00.'+String(counts.transactions+1).padStart(6,'0');return {rows:sql.includes('RETURNING id')?[{id:row.id}]:[]};
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){receipts.set(args[0],JSON.parse(args[4]));return {rows:[]};}
  assert.fail('Unexpected SQL: '+sql);
 }};
 const operations={mediaTransaction:async(_session,_input,_writable,callback)=>{
  counts.transactions++;onTransaction?.(counts.transactions,context);const before=structuredClone(row),beforeReceipts=new Map(receipts);
  try{return await callback(client,{role:'AUDITOR',actorId:'uploader-a',organizationId:'company-a'},scope,{});}catch(error){Object.assign(row,before);receipts.clear();for(const entry of beforeReceipts)receipts.set(...entry);throw error;}
 },readEvidence:async()=>structuredClone(row),readTask:async()=>structuredClone(taskCurrent),assertWorker:async()=>{if(revoked)throw new WorkspaceError('FIELD_KYC_REVIEW_REQUIRED',403);}};
 const get=async()=>{counts.get++;onGet?.(context);return {statusCode:200,blob:{url:media.url,pathname,size:bytes.length,contentType:mimeType},stream:new Response(bytes).body};};
 const fakePilot=pilot?createPilotMediaAnalyzer({environment:()=>({OPENAI_API_KEY:'fake-test-only'}),fetchImpl:async(url,options)=>{
  if(url.endsWith('/audio/transcriptions')){assert.equal(options.body.get('file').type,'audio/wav');assert.equal(options.body.get('languages[]'),'es');assert.equal(options.body.get('model'),'gpt-transcribe');return Response.json({text,languages:[{code:'es'}]});}
  assert.ok(url.endsWith('/chat/completions'));const body=JSON.parse(options.body);assert.equal(body.response_format.type,'json_schema');assert.equal(body.messages[1].content.filter(p=>p.type==='image_url').length,4);return Response.json({model:'gpt-4o-2024-08-06',choices:[{finish_reason:'stop',message:{content:JSON.stringify({visual:visualRaw,reportedSummary:'El hablante refiere un metrado que debe revisar la persona.',uncertainties:['Cuatro cuadros no verifican la totalidad del trabajo.']})}}]});
 }}):null;
 const analyzer={transcribeAudio:async request=>{counts.transcribe++;calls.push({kind:'audio',request});return onAudio?onAudio(request,context):fakePilot?fakePilot.transcribeAudio(request):transcript;},analyzeVideo:async request=>{counts.vision++;calls.push({kind:'visual',request});return onVision?onVision(request,context):fakePilot?fakePilot.analyzeVideo(request):visual;},analyzePhoto:async()=>assert.fail('Video fixture cannot analyze photo')};
 const frames=async request=>{counts.frames++;return extractFrames?extractFrames(request,context):real?createVideoFrameExtractor()(request):structuredClone(prepared[name].frames);};
 const audio=async request=>{counts.audioDecode++;return extractAudio?extractAudio(request,context):real?createVideoAudioExtractor()(request):structuredClone(prepared[name].audio);};
 return {...context,getTask:()=>structuredClone(taskCurrent),media:createFieldMedia({operations,get,put:async()=>{counts.put++;assert.fail('PROCESS must not upload a derivative');},analyzer,extractVideoFrames:frames,extractVideoAudio:audio,...(processTimeoutMs?{processTimeoutMs}:{})})};
}
const process=async(f,command=input)=>(await f.media.process({},command)).evidence;
const noWrites=f=>{assert.equal(f.receipts.size,0);assert.ok(!f.queries.some(sql=>sql.startsWith('INSERT INTO public."AuditLog"')));assert.equal(f.row.metadata.fieldOperations.processing.status,'RUNNING');};
test('real MP4 decode, canonical WAV and two fake provider calls produce bounded private audiovisual context, never task writes',async()=>{
 const f=fixture({real:true,pilot:true}),e=await process(f),r=e.processing.result;assert.equal(e.status,'PENDING');assert.equal(e.media.kind,'video');assert.equal(e.processing.status,'ANALYZED_UNREVIEWED');assert.equal(r.visual.status,'ANALYZED_UNREVIEWED');assert.equal(r.videoAudio.status,'TRANSCRIBED_UNREVIEWED');assert.equal(r.videoAudio.transcription.text,text);assert.equal(r.videoAudio.transcription.transcriptSha256,hash(text));assert.equal(r.videoAudio.extraction.sourceSha256,e.media.sha256);assert.equal(r.videoAudio.extraction.pcm.sampleRate,16000);assert.equal(r.sampling.frameCount,4);assert.equal(r.sampling.audioAnalyzed,false);assert.equal(r.contextualReport.visibleSummary,visual.aiAnalysis);assert.match(r.contextualReport.reportedSummary,/hablante/);assert.equal(r.progressDraft.quantity,'12.5000');assert.equal(r.progressDraft.progress,null);assert.equal(r.progressDraft.baseline,null);assert.equal(f.counts.transcribe,1);assert.equal(f.counts.vision,1);assert.equal(f.counts.put,0);assert.equal(f.receipts.size,1);assert.deepEqual(f.getTask(),task);assert.ok(f.queries.every(sql=>!sql.includes('public."Task"')&&!sql.includes('public."OperationalProposal"')));assert.doesNotMatch(JSON.stringify(e.processing),/base64|data:image|source\.mp4|audio\.wav|stderr|Bearer|fake-test-only/);
 assert.throws(()=>prepareVoiceProgressDraft(e,task,'worker-a'));const approved={...e,status:'APPROVED',revision:'2026-10-07T12:00:00.000099'},p=prepareVoiceProgressDraft(approved,task,'worker-a');assert.equal(p.payload.progress,'');assert.equal(p.payload.baseline,'');assert.equal(voiceProgressDraftReady(p.sourceVoice,approved,task),false);p.sourceVoice.confirmed=true;assert.equal(voiceProgressDraftReady(p.sourceVoice,approved,task),true);
 const replay=await f.media.process({},input);assert.equal(replay.replayed,true);assert.equal(f.counts.get,1);assert.equal(f.counts.transcribe,1);assert.equal(f.counts.vision,1);
});
test('real WebM Opus low digital signal is transcribed without claiming audibility or identity',async()=>{
 const f=fixture({name:'low',real:true}),e=await process(f);assert.equal(e.processing.result.videoAudio.status,'TRANSCRIBED_UNREVIEWED');assert.equal(e.processing.result.videoAudio.extraction.sourceStream.codec,'opus');assert.equal(e.processing.result.videoAudio.extraction.nativeEnergy.allChannelsDigitalZero,false);assert.equal(f.counts.transcribe,1);assert.equal(e.processing.result.videoAudio.transcription.identityVerified,false);assert.equal(e.processing.result.videoAudio.transcription.speakerVerified,false);assert.equal(e.processing.result.videoAudio.transcription.attendanceRegistered,false);assert.equal(e.processing.result.videoAudio.extraction.wordTimestampsAvailable,false);assert.equal(e.processing.result.videoAudio.extraction.priming.authority,'NOT_VERIFIED');
});
for(const [name,status]of [['absent','NO_AUDIO_TRACK'],['silence','DIGITAL_SILENCE'],['cancel','UNCONFIRMED']])test('verified '+name+' source keeps visual review and makes zero audio provider calls',async()=>{
 const f=fixture({name}),e=await process(f);assert.equal(e.processing.status,'ANALYZED_UNREVIEWED');assert.equal(e.processing.result.videoAudio.status,status);assert.equal(e.processing.result.videoAudio.transcription,null);assert.equal(e.processing.result.progressDraft,undefined);assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,1);assert.equal(f.calls[0].request.transcriptContext,undefined);if(name==='cancel'){assert.equal(e.processing.result.videoAudio.code,'FIELD_VIDEO_AUDIO_DOWNMIX_UNCONFIRMED');assert.equal(e.processing.result.videoAudio.extraction.nativeEnergy.allChannelsDigitalZero,false);assert.equal(e.processing.result.videoAudio.extraction.pcm.nonzeroSamples,0);}
});
test('visual-only v2 never decodes or transcribes audio; v1 has no composite upgrade',async()=>{
 const f=fixture(),e=await process(f,{...input,analysisConsent:fieldVideoAnalysisConsent(true)});assert.equal(f.counts.audioDecode,0);assert.equal(f.counts.transcribe,0);assert.equal(e.processing.result.videoAudio.status,'NOT_AUTHORIZED');assert.equal(e.processing.result.progressDraft,undefined);assert.equal(f.calls[0].request.transcriptContext,undefined);
 const v1=fixture(),old=await process(v1,{...input,analysisConsent:fieldMediaAnalysisConsent(true)});assert.equal(v1.counts.audioDecode,0);assert.equal(v1.counts.transcribe,0);assert.equal(old.processing.result.videoAudio,undefined);assert.equal(old.processing.result.contextualReport,undefined);assert.deepEqual(old.processing.analysisConsent,fieldMediaAnalysisConsent(true));
 await assert.rejects(v1.media.process({},{...input,operationId:'abcdefab-1234-4abc-9abc-abcdef123457',revision:old.revision}),{code:'FIELD_MEDIA_ALREADY_PROCESSED'});await assert.rejects(v1.media.process({},input),{code:'FIELD_OPERATION_CONFLICT'});assert.equal(v1.counts.vision,1);
});
test('video v2 cannot reserve an image or standalone audio, including forged optional consent keys',async()=>{
 for(const kind of ['image','audio']){const f=fixture({kind});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED'});assert.equal(f.counts.get,0);assert.equal(f.receipts.size,0);assert.equal(f.row.metadata.fieldOperations.processing.status,'QUEUED');}
 const f=fixture();await assert.rejects(f.media.process({},{...input,analysisConsent:{...input.analysisConsent,approved:true}}),{code:'FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED'});assert.equal(f.counts.get,0);
});
for(const mode of ['returned-failure','throws','malformed','empty-languages'])test('ordinary audio provider '+mode+' preserves visual and no draft without retrying transcription',async()=>{
 const f=fixture({onAudio:()=>{if(mode==='throws')throw new Error('Private provider body must not be retained');if(mode==='malformed')return {...transcript,providerModel:'foreign',approved:true};if(mode==='empty-languages')return {success:false,status:'UNCONFIRMED',code:'AUDIO_TRANSCRIPTION_UNCONFIRMED'};return {success:false,status:'UNCONFIRMED',code:'AUDIO_PROVIDER_REQUEST_REJECTED'};}}),e=await process(f);assert.equal(e.processing.status,'ANALYZED_UNREVIEWED');assert.equal(e.processing.result.videoAudio.status,'UNCONFIRMED');assert.equal(e.processing.result.videoAudio.transcription,null);assert.equal(e.processing.result.progressDraft,undefined);assert.equal(f.counts.transcribe,1);assert.equal(f.counts.vision,1);assert.equal(f.calls[1].request.transcriptContext,undefined);assert.doesNotMatch(JSON.stringify(e.processing),/Private provider body|approved/);await f.media.process({},input);assert.equal(f.counts.transcribe,1);
});
test('ordinary audio decoder failure preserves visual with unconfirmed component and no transcription',async()=>{
 const f=fixture({extractAudio:()=>{throw new Error('Missing optional decoder');}}),e=await process(f);assert.equal(e.processing.result.videoAudio.code,'FIELD_VIDEO_AUDIO_EXTRACTION_UNCONFIRMED');assert.equal(e.processing.result.videoAudio.status,'UNCONFIRMED');assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,1);assert.equal(e.processing.result.progressDraft,undefined);
});
test('vision failure retains only confirmed speech and a grounded draft with honest unconfirmed visual result',async()=>{
 const f=fixture({onVision:()=>({success:false,code:'AI_PROVIDER_REQUEST_REJECTED'})}),e=await process(f);assert.equal(e.processing.status,'TRANSCRIBED_UNREVIEWED');assert.equal(e.processing.result.visual.status,'UNCONFIRMED');assert.equal(e.processing.result.aiAnalysis,undefined);assert.equal(e.processing.result.contextualReport,undefined);assert.equal(e.processing.result.progressDraft.quantity,'12.5000');assert.equal(e.processing.result.sampling.frameCount,4);assert.equal(f.counts.transcribe,1);assert.equal(f.counts.vision,1);
});
test('both ordinary provider failures persist bounded retryable review data with no draft or automatic retry',async()=>{
 const f=fixture({onAudio:()=>({success:false}),onVision:()=>({success:false})}),e=await process(f);assert.equal(e.processing.status,'FAILED_RETRYABLE');assert.equal(e.processing.result.visual.status,'UNCONFIRMED');assert.equal(e.processing.result.videoAudio.status,'UNCONFIRMED');assert.equal(e.processing.result.progressDraft,undefined);assert.equal(f.receipts.size,1);await f.media.process({},input);assert.equal(f.counts.transcribe,1);assert.equal(f.counts.vision,1);
});
for(const corruption of ['frame-source','three-frames','audio-source','wav-hash','native-zero','unsafe-pcm'])test('integrity violation '+corruption+' aborts before provider copies and creates no receipt',async()=>{
 const f=fixture({extractFrames:()=>{const p=structuredClone(prepared.signal.frames);if(corruption==='frame-source')p.sampling.sourceSha256='a'.repeat(64);if(corruption==='three-frames'){p.frames.pop();p.sampling.frameCount=3;}return p;},extractAudio:()=>{const a=structuredClone(prepared.signal.audio);if(corruption==='audio-source')a.extraction.sourceSha256='a'.repeat(64);if(corruption==='wav-hash')a.audio.sha256='a'.repeat(64);if(corruption==='native-zero')a.extraction.nativeEnergy.allChannelsDigitalZero=true;if(corruption==='unsafe-pcm')a.audio.buffer=Buffer.from('not a canonical wav');return a;}});
 await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_INTEGRITY'});assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,0);noWrites(f);
});
test('extra adapter fields cannot escape component whitelists or authorize worker/task/attendance',async()=>{
 const f=fixture({extractAudio:()=>{const a=structuredClone(prepared.signal.audio);a.extraction.tempPath='secret/path';a.extraction.nativeEnergy.stdout='secret-native-pcm';a.extraction.timing.stderr='secret-log';a.extraction.priming.verified=true;return a;},onAudio:()=>({...transcript,workerId:'foreign',verified:true,identityVerified:true,attendanceRegistered:true,buffer:'secret-payload'}),onVision:()=>({...visual,quantity:90,estimatedProgressPercentage:99,taskId:'foreign',approve:true,stderr:'secret-provider'})}),e=await process(f);assert.doesNotMatch(JSON.stringify(e.processing),/secret-|tempPath|stdout|stderr|foreign|approve/);assert.equal(e.processing.result.verified,false);assert.equal(e.processing.result.estimatedProgressPercentage,null);assert.equal(e.processing.result.videoAudio.transcription.identityVerified,false);assert.equal(e.processing.result.videoAudio.transcription.attendanceRegistered,false);assert.equal(e.processing.result.progressDraft.task.id,task.id);assert.equal(e.processing.result.videoAudio.extraction.priming.authority,'NOT_VERIFIED');
});
for(const edge of ['kyc-before-audio','kyc-between-providers','expiry-between-providers','lease-between-providers','media-between-providers','review-between-providers'])test('current '+edge+' guard stops external copies and persists no failure receipt',async()=>{
 const f=fixture({onGet:c=>{if(edge==='kyc-before-audio')c.revoke();},onAudio:(_request,c)=>{if(edge==='kyc-between-providers')c.revoke();if(edge==='expiry-between-providers')c.expire();if(edge==='lease-between-providers')c.row.metadata.fieldOperations.processing.leaseId='replaced';if(edge==='media-between-providers')c.row.metadata.fieldOperations.media.sha256='a'.repeat(64);if(edge==='review-between-providers')c.row.metadata.fieldOperations.review={decision:'APPROVE'};return transcript;}});
 const code=edge.startsWith('kyc')?'FIELD_KYC_REVIEW_REQUIRED':edge.startsWith('expiry')?'FIELD_MEDIA_PROCESSING_EXPIRED':edge.startsWith('media')?'FIELD_MEDIA_INTEGRITY':'FIELD_MEDIA_PROCESSING_CHANGED';await assert.rejects(f.media.process({},input),{code});assert.equal(f.counts.transcribe,edge==='kyc-before-audio'?0:1);assert.equal(f.counts.vision,0);noWrites(f);
});
test('late audiovisual result cannot overwrite a replaced lease and exact reclaim/replay remains canonical',async()=>{
 let firstReady,firstFinish,count=0;const ready=new Promise(resolve=>{firstReady=resolve;}),response=new Promise(resolve=>{firstFinish=resolve;});const f=fixture({onVision:()=>{if(++count===1){firstReady();return response;}return {...visual,aiAnalysis:'Current lease visual.'};}});
 const first=f.media.process({},input);await ready;const old=f.row.metadata.fieldOperations.processing.leaseId;f.expire();const second=await process(f);assert.equal(second.processing.result.aiAnalysis,'Current lease visual.');firstFinish({...visual,aiAnalysis:'Superseded visual.'});const oldOutcome=await first;assert.equal(oldOutcome.replayed,true);assert.equal(oldOutcome.evidence.processing.result.aiAnalysis,'Current lease visual.');assert.equal(f.receipts.size,1);assert.doesNotMatch(JSON.stringify(oldOutcome),new RegExp(old));await f.media.process({},input);assert.equal(f.counts.vision,2);assert.equal(f.counts.transcribe,2);
});
test('guarded final UPDATE miss creates neither receipt nor completed processing metadata',async()=>{
 const f=fixture({conditionalMiss:true});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_CHANGED'});assert.equal(f.counts.transcribe,1);assert.equal(f.counts.vision,1);noWrites(f);
});
for(const boundary of ['GET','visual-decode','audio-decode','audio-cancel','audio-provider','visual-provider'])test('bounded '+boundary+' timeout or cancellation remains fatal without a partial failure receipt',async()=>{
 const timeout=()=>{throw new DOMException('Private timeout detail','TimeoutError');},coded=code=>()=>{throw Object.assign(new Error('Decoder deadline'),{code});};
 const options=boundary==='GET'?{onGet:timeout}:boundary==='visual-decode'?{extractFrames:coded('FIELD_VIDEO_DECODE_TIMEOUT')}:boundary==='audio-decode'?{extractAudio:coded('FIELD_VIDEO_AUDIO_DECODE_TIMEOUT')}:boundary==='audio-cancel'?{extractAudio:coded('FIELD_VIDEO_AUDIO_CANCELLED')}:boundary==='audio-provider'?{onAudio:timeout}:{onVision:timeout};
 const f=fixture(options);await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.equal(f.counts.vision,boundary==='visual-provider'?1:0);noWrites(f);
});
test('shared deadline aborts and awaits both decoding branches before returning with no provider or receipt',async()=>{
 const closed={frames:false,audio:false},pending=key=>request=>new Promise((resolve,reject)=>{request.signal.addEventListener('abort',()=>{setTimeout(()=>{closed[key]=true;reject(request.signal.reason);},5);},{once:true});});
 const keepAlive=setTimeout(()=>{},1000);try{const f=fixture({processTimeoutMs:30,extractFrames:pending('frames'),extractAudio:pending('audio')});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.deepEqual(closed,{frames:true,audio:true});assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,0);noWrites(f);}finally{clearTimeout(keepAlive);}
});
test('twenty-second decode stage deadline is fatal even while the shared eighty-second budget remains live',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let started,closed=0;const ready=new Promise(resolve=>{started=resolve;});
 const pending=request=>new Promise((resolve,reject)=>{if(++closed===2)started();request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true});});
 const f=fixture({extractFrames:pending,extractAudio:pending}),outcome=f.media.process({},input);await ready;t.mock.timers.tick(20000);await assert.rejects(outcome,{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,0);noWrites(f);
});
for(const component of ['audio','visual'])test('fifteen-second '+component+' stage deadline cannot silently become a partial result',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let started;const ready=new Promise(resolve=>{started=resolve;}),pending=request=>new Promise((resolve,reject)=>{started();request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true});});
 const f=fixture(component==='audio'?{onAudio:pending}:{onVision:pending}),outcome=f.media.process({},input);await ready;t.mock.timers.tick(15000);await assert.rejects(outcome,{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.equal(f.counts.vision,component==='audio'?0:1);noWrites(f);
});
test('visual decoder rejection cancels and awaits its audio sibling rather than leaving a temporary process',async()=>{
 let closed=false;const f=fixture({extractFrames:async()=>{await new Promise(resolve=>setTimeout(resolve,5));throw new Error('Visual decode failed');},extractAudio:request=>new Promise((resolve,reject)=>{request.signal.addEventListener('abort',()=>{setTimeout(()=>{closed=true;reject(request.signal.reason);},5);},{once:true});})});const e=await process(f);assert.equal(closed,true);assert.equal(e.processing.status,'FAILED_RETRYABLE');assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,0);
});
test('audio integrity rejection cancels and awaits its visual sibling without saving even a failed receipt',async()=>{
 let closed=false;const f=fixture({extractAudio:async()=>{await new Promise(resolve=>setTimeout(resolve,5));throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);},extractFrames:request=>new Promise((resolve,reject)=>{request.signal.addEventListener('abort',()=>{setTimeout(()=>{closed=true;reject(request.signal.reason);},5);},{once:true});})});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_INTEGRITY'});assert.equal(closed,true);assert.equal(f.counts.transcribe,0);assert.equal(f.counts.vision,0);noWrites(f);
});
for(const component of ['audio','visual'])test('shared deadline during '+component+' provider cannot be degraded into a partial receipt',async()=>{
 const pending=request=>new Promise((resolve,reject)=>{request.signal.addEventListener('abort',()=>reject(request.signal.reason),{once:true});});const keepAlive=setTimeout(()=>{},1000);
 try{const f=fixture({processTimeoutMs:25,...(component==='audio'?{onAudio:pending}:{onVision:pending})});await assert.rejects(f.media.process({},input),{code:'FIELD_MEDIA_PROCESSING_DEADLINE'});assert.equal(f.counts.vision,component==='audio'?0:1);noWrites(f);}finally{clearTimeout(keepAlive);}
});
test('task changed during providers stays untouched and invalidates later progress preparation',async()=>{
 const f=fixture({onAudio:(_request,c)=>{c.changeTask();return transcript;}}),e=await process(f);assert.equal(e.processing.result.progressDraft.task.revision,task.revision);assert.notEqual(f.getTask().revision,task.revision);assert.throws(()=>prepareVoiceProgressDraft({...e,status:'APPROVED'},f.getTask(),'worker-a'),/tarea cambió/);assert.equal(f.receipts.size,1);assert.ok(f.queries.every(sql=>!sql.includes('public."Task"')));
});
