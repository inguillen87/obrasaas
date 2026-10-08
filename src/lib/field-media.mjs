import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WorkspaceError, workspaceId, operationId, digest } from './workspace-policy.mjs';
import { siteText, siteRevision, recordKeys, cleanMetadata } from './site-register-policy.mjs';
import { assertPrivateImageConfigured, decodePrivateImage } from './private-image-upload.mjs';
import { canReviewField } from './field-operations-policy.mjs';
import { publicFieldEvidence } from './field-operations-store.mjs';
import { createVideoFrameExtractor } from './video-frame-extractor.mjs';
import { createVideoAudioExtractor, VIDEO_AUDIO_EXTRACTION_VERSION, VIDEO_AUDIO_LIMITS, readCanonicalVideoAudioWav } from './video-audio-extractor.mjs';
import { validFieldMediaAnalysisConsent, FIELD_VIDEO_PRIVACY_NOTICE_VERSION, fieldVideoAudioAnalysisAllowed } from './field-media-privacy.mjs';
import { createVoiceProgressDraft, VIDEO_AUDIO_RESULT_VERSION } from './voice-progress-draft.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fieldReceiptId=(actorId,projectId,key)=>'fieldmedia_'+digest([actorId,projectId,key.toLowerCase()]);
// Keep uploads below the Production function request-body limit, including
// multipart overhead. Larger/direct uploads need a separately verified adapter.
export const FIELD_MEDIA_LIMIT = 3*1024*1024;
export const FIELD_MEDIA_PROCESS_TIMEOUT_MS=80000;
function processBudget(timeoutMs){
  const controller=new AbortController(),deadline=performance.now()+timeoutMs;
  const expire=()=>controller.abort(new WorkspaceError('FIELD_MEDIA_PROCESSING_DEADLINE',503));
  const timer=setTimeout(expire,timeoutMs);timer.unref?.();
  return {signal:controller.signal,check(){if(performance.now()>=deadline&&!controller.signal.aborted)expire();if(controller.signal.aborted)throw controller.signal.reason;},close(){clearTimeout(timer);}};
}
export function decodeFieldMedia(bytes,contentType) {
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>FIELD_MEDIA_LIMIT)throw new WorkspaceError('FIELD_MEDIA_TOO_LARGE',413);
  const b=Buffer.from(bytes),mime=String(contentType||'').toLowerCase().split(';')[0];
  if(mime.startsWith('image/')){let image;try{image=decodePrivateImage(b.toString('base64'),mime);}catch{throw new WorkspaceError('FIELD_MEDIA_INVALID');}return {...image,kind:'image'};}
  const mp4=b.length>12&&b.subarray(4,8).toString()==='ftyp',webm=b.length>8&&b.subarray(0,4).equals(Buffer.from('1a45dfa3','hex'));
  const formats={
    'audio/ogg':b.subarray(0,4).toString()==='OggS'?'ogg':null,
    'audio/wav':b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WAVE'?'wav':null,
    'audio/mpeg':b.subarray(0,3).toString()==='ID3'||(b[0]===255&&(b[1]&224)===224)?'mp3':null,
    'audio/mp4':mp4?'m4a':null,'audio/webm':webm?'webm':null,
    'video/mp4':mp4?'mp4':null,'video/webm':webm?'webm':null,
  },extension=formats[mime];
  if(!extension)throw new WorkspaceError('FIELD_MEDIA_INVALID');
  // A container signature is not a codec decode, malware scan, identity proof,
  // or complete audiovisual analysis. Server decoding is a separate explicit
  // processing step; all evidence still requires independent human review.
  return {bytes:b,contentType:mime,kind:mime.startsWith('audio/')?'audio':'video',extension,digest:sha(b)};
}
export async function boundedFieldMultipart(request) {
  if(!request.headers.get('content-type')?.startsWith('multipart/form-data;')||request.headers.has('content-encoding'))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
  const limit=FIELD_MEDIA_LIMIT+65536,length=request.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>limit))throw new WorkspaceError('FIELD_MEDIA_TOO_LARGE',413);
  const reader=request.body?.getReader();if(!reader)throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
  let size=0;const parts=[];
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>limit)throw new WorkspaceError('FIELD_MEDIA_TOO_LARGE',413);parts.push(Buffer.from(chunk.value));}
    const form=await new Response(Buffer.concat(parts),{headers:{'Content-Type':request.headers.get('content-type')}}).formData(),keys=['operationId','projectId','scope','workerId','taskId','sectorId','caption','file'];
    if([...form.keys()].sort().join('|')!==keys.sort().join('|'))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
    const file=form.get('file');if(!file||typeof file==='string')throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
    const input=Object.fromEntries(keys.filter(k=>k!=='file').map(k=>[k,form.get(k)]));
    return {...input,media:decodeFieldMedia(new Uint8Array(await file.arrayBuffer()),file.type)};
  }catch(error){if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
function validMediaReceipt(stored,media) {
  let url;try{url=new URL(stored?.blob?.url||stored?.url);}catch{throw new WorkspaceError('FIELD_MEDIA_STORAGE_UNCONFIRMED',503);}
  const blob=stored.blob||stored;
  if(url.protocol!=='https:'||!/^[-a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'+media.pathname||blob.pathname!==media.pathname||(stored.blob&&blob.size!==media.bytes))throw new WorkspaceError('FIELD_MEDIA_STORAGE_UNCONFIRMED',503);
  return url.toString();
}
const boundedText=(value,max)=>typeof value==='string'&&value.trim()&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)?value.trim():null;
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const integrity=()=>{throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);};
const deadlineFailure=error=>['TimeoutError','AbortError'].includes(error?.name)||/^FIELD_VIDEO_(?:AUDIO_)?(?:DECODE_TIMEOUT|CANCELLED)$/.test(error?.code||'');
async function stage(ms,sharedSignal,callback){
 const controller=new AbortController(),signal=AbortSignal.any([sharedSignal,controller.signal]),timer=setTimeout(()=>controller.abort(new WorkspaceError('FIELD_MEDIA_PROCESSING_DEADLINE',503)),ms);
 try{signal.throwIfAborted();const result=await callback(signal);signal.throwIfAborted();return result;}finally{clearTimeout(timer);}
}
function canonicalVideoSampling(prepared,media){
 const s=prepared?.sampling,frames=prepared?.frames;
 if(s?.version!=='server-video-frames-v1'||s.sourceSha256!==media.sha256||s.sourceBytes!==media.bytes||s.sourceContentType!==media.contentType||s.audioAnalyzed!==false||s.frameCount!==4||!Array.isArray(frames)||frames.length!==4||!Number.isFinite(s.durationSeconds)||s.durationSeconds<=0||s.durationSeconds>40)integrity();
 let total=0;
 const rows=frames.map((frame,index)=>{
  let image;try{image=decodePrivateImage(frame.base64,'image/jpeg');}catch{integrity();}
  total+=image.bytes.length;
  if(frame.sha256!==image.digest||frame.bytes!==image.bytes.length||image.bytes.length>256*1024||total>1024*1024||!Number.isFinite(frame.capturedAtSeconds)||frame.capturedAtSeconds<0||frame.capturedAtSeconds>=s.durationSeconds||index>0&&frame.capturedAtSeconds<=frames[index-1].capturedAtSeconds)integrity();
  return {capturedAtSeconds:frame.capturedAtSeconds,sha256:image.digest,bytes:image.bytes.length,contentType:'image/jpeg'};
 });
 return {version:s.version,sourceSha256:s.sourceSha256,sourceBytes:s.sourceBytes,sourceContentType:s.sourceContentType,durationSeconds:s.durationSeconds,frameCount:4,maxDimension:768,timestampAuthority:'REQUESTED_SEEK_POSITION',audioAnalyzed:false,frames:rows};
}
function privateAudioExtraction(result,media){
 const e=result?.extraction,status=result?.status;
 if(!['NO_AUDIO_TRACK','DIGITAL_SILENCE','UNCONFIRMED_DOWNMIX','SIGNAL_UNREVIEWED'].includes(status)||e?.version!==VIDEO_AUDIO_EXTRACTION_VERSION||e.sourceSha256!==media.sha256||e.sourceBytes!==media.bytes||e.sourceContentType!==media.contentType||e.inputOrigin?.authority!=='FFMPEG_DEFAULT_INPUT_START_NORMALIZATION'||e.inputOrigin.audioOnlyRebaseApplied!==false)integrity();
 const start=e.inputOrigin.containerDeclaredStartSeconds;if(start!==null&&!Number.isFinite(start))integrity();
 const output={version:e.version,sourceSha256:e.sourceSha256,sourceBytes:e.sourceBytes,sourceContentType:e.sourceContentType,sourceStream:null,inputOrigin:{authority:e.inputOrigin.authority,containerDeclaredStartSeconds:start,audioOnlyRebaseApplied:false},priming:{authority:'NOT_VERIFIED',codecDelaySamples:null,preSkipSamples:null,editListVerified:false},sourceVideoFullDecodeVerified:false,wordTimestampsAvailable:false,requiresHumanReview:true,nativeEnergy:null,timing:null,pcm:null};
 if(status==='NO_AUDIO_TRACK'){if(e.sourceStream!==null||result.audio!==null)integrity();return output;}
 const s=e.sourceStream,n=e.nativeEnergy,t=e.timing;
 if(s?.ordinal!==0||!integer(s.index,0,65535)||!boundedText(s.codec,32)||!integer(s.sampleRate,8000,VIDEO_AUDIO_LIMITS.sourceRate)||!integer(s.channels,1,8)||n?.authority!=='DECODED_NATIVE_CHANNELS_FLOAT32_STREAM'||!integer(n.samplesPerChannel,1,s.sampleRate*41)||typeof n.allChannelsDigitalZero!=='boolean'||!Array.isArray(n.channels)||n.channels.length!==s.channels||t?.timestampAuthority!=='DECODED_AUDIO_FRAME_PTS_AFTER_FFMPEG_INPUT_NORMALIZATION'||t.timeBase?.numerator!==1||t.timeBase.denominator!==s.sampleRate||!integer(t.firstPts,-s.sampleRate,s.sampleRate*40)||!integer(t.lastEndPts,1,s.sampleRate*40)||!integer(t.maxEndPts,t.lastEndPts,s.sampleRate*40)||!integer(t.decodedFrames,1,16384)||t.decodedSamplesPerChannel!==n.samplesPerChannel||!Array.isArray(t.gaps)||t.gaps.length>256)integrity();
 const channels=n.channels.map(channel=>{if(!integer(channel.nonzeroSamples,0,n.samplesPerChannel)||!Number.isFinite(channel.peak)||channel.peak<0||!Number.isFinite(channel.rms)||channel.rms<0||channel.rms>channel.peak*(1+1e-10))integrity();return {nonzeroSamples:channel.nonzeroSamples,peak:channel.peak,rms:channel.rms};});
 if(n.allChannelsDigitalZero!==channels.every(channel=>channel.nonzeroSamples===0))integrity();
 const gaps=t.gaps.map(gap=>{if(!integer(gap.afterFrame,0,t.decodedFrames-1)||!integer(gap.startPts,-s.sampleRate,s.sampleRate*40)||!integer(gap.endPts,-s.sampleRate,s.sampleRate*40)||gap.deltaNativeSamples!==gap.endPts-gap.startPts||gap.roundedOutputSamples!==Math.round(gap.deltaNativeSamples*16000/s.sampleRate))integrity();return {afterFrame:gap.afterFrame,startPts:gap.startPts,endPts:gap.endPts,deltaNativeSamples:gap.deltaNativeSamples,roundedOutputSamples:gap.roundedOutputSamples};});
 output.sourceStream={ordinal:0,index:s.index,codec:s.codec,sampleRate:s.sampleRate,channels:s.channels};output.nativeEnergy={authority:n.authority,samplesPerChannel:n.samplesPerChannel,allChannelsDigitalZero:n.allChannelsDigitalZero,channels};output.timing={timestampAuthority:t.timestampAuthority,timeBase:{numerator:1,denominator:s.sampleRate},firstPts:t.firstPts,lastEndPts:t.lastEndPts,maxEndPts:t.maxEndPts,decodedFrames:t.decodedFrames,decodedSamplesPerChannel:t.decodedSamplesPerChannel,gaps};
 if(status==='DIGITAL_SILENCE'){if(!n.allChannelsDigitalZero||result.audio!==null)integrity();return output;}
 if(n.allChannelsDigitalZero)integrity();
 if(status==='SIGNAL_UNREVIEWED'){
  const a=result.audio;let pcm;try{pcm=readCanonicalVideoAudioWav(a?.buffer);}catch{integrity();}
  if(a.mimeType!=='audio/wav'||a.bytes!==a.buffer.length||a.sha256!==sha(a.buffer)||!pcm.nonzeroSamples)integrity();
  output.pcm={encoding:pcm.encoding,channels:pcm.channels,sampleRate:pcm.sampleRate,bitsPerSample:pcm.bitsPerSample,dataBytes:pcm.dataBytes,sampleCount:pcm.sampleCount,durationSeconds:pcm.durationSeconds,nonzeroSamples:pcm.nonzeroSamples,peak:pcm.peak,sha256:a.sha256,bytes:a.bytes};
 }else {
  const p=e.pcm;if(result.audio!==null||p?.encoding!==1||p.channels!==1||p.sampleRate!==16000||p.bitsPerSample!==16||!integer(p.sampleCount,1,640000)||p.dataBytes!==p.sampleCount*2||p.durationSeconds!==p.sampleCount/16000||p.nonzeroSamples!==0||p.peak!==0)integrity();
  output.pcm={encoding:1,channels:1,sampleRate:16000,bitsPerSample:16,dataBytes:p.dataBytes,sampleCount:p.sampleCount,durationSeconds:p.durationSeconds,nonzeroSamples:0,peak:0};
 }
 return output;
}
function privateTranscription(value,inputAudioSha256){
 const text=boundedText(value?.text,32000),model=boundedText(value?.providerModel,100);
 if(value?.success!==true||value.status!=='TRANSCRIBED_UNREVIEWED'||!text||value.provider!=='openai'||!model||!/^gpt-transcribe(?:-[A-Za-z0-9.-]+)?$|^whisper-1$|^gpt-4o(?:-mini)?-transcribe(?:-[A-Za-z0-9.-]+)?$/.test(model))return null;
 return {status:'TRANSCRIBED_UNREVIEWED',text,transcriptSha256:sha(Buffer.from(text,'utf8')),inputAudioSha256,provider:'openai',providerModel:model,speakerVerified:false,identityVerified:false,attendanceRegistered:false,requiresHumanReview:true};
}
function privateVideoVisual(value){
 const aiAnalysis=boundedText(value?.aiAnalysis,4000),phase=boundedText(value?.phase,100);
 if(value?.success!==true||value.status!=='ANALYZED_UNREVIEWED'||!aiAnalysis||!phase||typeof value.isIncident!=='boolean'||value.provider!=='openai'||value.providerModel!=='gpt-4o')return {status:'UNCONFIRMED',code:'FIELD_VIDEO_VISUAL_UNCONFIRMED',requiresHumanReview:true};
 const visual={status:'ANALYZED_UNREVIEWED',phase,aiAnalysis,isIncident:value.isIncident,incidentSeverity:['Ninguna','Baja','Media','Crítica'].includes(value.incidentSeverity)?value.incidentSeverity:null,actionRecommendation:boundedText(value.actionRecommendation,2000),provider:'openai',providerModel:'gpt-4o',verified:false,requiresHumanReview:true,estimatedProgressPercentage:null};
 if(typeof value.observedProviderModel==='string'&&/^gpt-4o(?:-\d{4}-\d{2}-\d{2})?$/.test(value.observedProviderModel))visual.observedProviderModel=value.observedProviderModel;
 return visual;
}
export function createFieldMedia({operations,put,get,analyzer,extractVideoFrames=createVideoFrameExtractor(),extractVideoAudio=createVideoAudioExtractor(),environment=()=>process.env,processTimeoutMs=FIELD_MEDIA_PROCESS_TIMEOUT_MS}) {
  if(!Number.isInteger(processTimeoutMs)||processTimeoutMs<1||processTimeoutMs>FIELD_MEDIA_PROCESS_TIMEOUT_MS)throw new TypeError('Invalid field media processing budget');
  const run=operations.mediaTransaction;
  const prior=async(client,member,id)=>(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='field.media.recorded'`,[id,member.organizationId,member.actorId])).rows[0];
  const saveReceipt=async(client,member,input,id,requestDigest,outcome)=>{
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.media.recorded','Incident',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,outcome.evidence.id,JSON.stringify({version:1,projectId:input.projectId,requestDigest,...(member.channelProof?{channelProof:member.channelProof}:{}),outcome})]);
    return {saved:true,replayed:false,receiptId:id,...outcome};
  };
  async function storedBytes(media,{signal}={}) {
    const abortSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000);abortSignal.throwIfAborted();
    const stored=await get(media.pathname,{access:'private',useCache:false,abortSignal});
    try{
      if(!stored||stored.statusCode!==200||stored.blob?.contentType?.split(';')[0]!==media.contentType)throw new WorkspaceError('FIELD_MEDIA_STORAGE_UNCONFIRMED',503);
      validMediaReceipt(stored,media);const reader=stored.stream.getReader(),chunks=[],cancel=()=>{void reader.cancel().catch(()=>{});};let count=0;
      abortSignal.addEventListener('abort',cancel,{once:true});
      try{while(true){abortSignal.throwIfAborted();const item=await reader.read();abortSignal.throwIfAborted();if(item.done)break;count+=item.value.byteLength;if(count>media.bytes)throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);chunks.push(Buffer.from(item.value));}
        const bytes=Buffer.concat(chunks);if(bytes.length!==media.bytes||sha(bytes)!==media.sha256)throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);return {bytes,url:stored.blob.url};
      }finally{abortSignal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock();}
    }catch(error){await stored?.stream?.cancel?.().catch(()=>{});throw error;}
  }
  function scopeInput(input){if(!workspaceId(input.projectId)||!operationId(input.operationId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');}
  async function ownsEvidence(client,member,session,input,row) {
    if(!canReviewField(member.role))await operations.assertWorker(client,member,session,input.projectId,row.metadata.fieldOperations.workerId);
  }
  async function currentClaim(client,member,input,row,claim,requestDigest){
    const processing=row.metadata.fieldOperations.processing;
    if(member.actorId!==claim.actorId||processing?.actorId!==claim.actorId||processing.operationId!==input.operationId||processing.requestDigest!==requestDigest||processing.leaseId!==claim.leaseId||processing.status!=='RUNNING'||row.metadata.fieldOperations.review)throw new WorkspaceError('FIELD_MEDIA_PROCESSING_CHANGED',409);
    if(input.analysisConsent.noticeVersion===FIELD_VIDEO_PRIVACY_NOTICE_VERSION){
      const current=row.metadata.fieldOperations.media;
      if(['kind','sha256','bytes','contentType','pathname'].some(key=>current?.[key]!==claim.media[key]))throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);
    }
    const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,expiresAt=Date.parse(processing.expiresAt);
    if(!Number.isFinite(expiresAt)||expiresAt<=now.getTime())throw new WorkspaceError('FIELD_MEDIA_PROCESSING_EXPIRED',409);
    return now;
  }
  async function videoComponents(bytes,claim,audioAllowed,budget){
    return stage(20000,budget.signal,async stageSignal=>{
      const cancel=new AbortController(),signal=AbortSignal.any([stageSignal,cancel.signal]);
      const visual=Promise.resolve().then(()=>extractVideoFrames({buffer:bytes,mimeType:claim.media.contentType,signal})).catch(error=>{cancel.abort(error);throw error;});
      const audio=audioAllowed?Promise.resolve().then(()=>extractVideoAudio({buffer:bytes,mimeType:claim.media.contentType,signal})).catch(error=>{
        if(error instanceof WorkspaceError||deadlineFailure(error)||['FIELD_VIDEO_AUDIO_INPUT_INVALID','FIELD_VIDEO_AUDIO_OUTPUT_INVALID'].includes(error?.code)){const fatal=error instanceof WorkspaceError?error:new WorkspaceError(deadlineFailure(error)?'FIELD_MEDIA_PROCESSING_DEADLINE':'FIELD_MEDIA_INTEGRITY',503);cancel.abort(fatal);throw fatal;}
        if(stageSignal.aborted)throw error;
        return {status:'UNCONFIRMED',code:'FIELD_VIDEO_AUDIO_EXTRACTION_UNCONFIRMED'};
      }):Promise.resolve(null);
      // A rejected decoder must never leave its sibling running in a temp directory.
      const results=await Promise.allSettled([visual,audio]);budget.check();
      const fatal=results.find(item=>item.status==='rejected'&&item.reason instanceof WorkspaceError);
      if(fatal)throw fatal.reason;
      if(results[0].status==='rejected')throw results[0].reason;
      if(results[1].status==='rejected')throw results[1].reason;
      return {prepared:results[0].value,audio:results[1].value};
    });
  }
  async function contextualVideo(bytes,claim,input,budget,fence){
    const audioAllowed=fieldVideoAudioAnalysisAllowed(input.analysisConsent),parts=await videoComponents(bytes,claim,audioAllowed,budget),sampling=canonicalVideoSampling(parts.prepared,claim.media);
    let videoAudio={version:VIDEO_AUDIO_RESULT_VERSION,status:audioAllowed?'UNCONFIRMED':'NOT_AUTHORIZED',code:null,extraction:null,transcription:null,visualSource:{version:sampling.version,sourceSha256:sampling.sourceSha256,sourceBytes:sampling.sourceBytes,sourceContentType:sampling.sourceContentType,frameCount:4,decoded:true}};
    if(parts.audio?.status==='UNCONFIRMED')videoAudio.code='FIELD_VIDEO_AUDIO_EXTRACTION_UNCONFIRMED';
    else if(parts.audio){
      videoAudio.extraction=privateAudioExtraction(parts.audio,claim.media);
      videoAudio.status=parts.audio.status==='UNCONFIRMED_DOWNMIX'?'UNCONFIRMED':parts.audio.status;
      if(parts.audio.status==='UNCONFIRMED_DOWNMIX')videoAudio.code='FIELD_VIDEO_AUDIO_DOWNMIX_UNCONFIRMED';
      if(parts.audio.status==='SIGNAL_UNREVIEWED'){
        await fence();
        let response;
        try{response=await stage(15000,budget.signal,signal=>analyzer.transcribeAudio({buffer:parts.audio.audio.buffer,mimeType:'audio/wav',language:'es',signal}));}
        catch(error){budget.check();if(error instanceof WorkspaceError)throw error;if(deadlineFailure(error))throw new WorkspaceError('FIELD_MEDIA_PROCESSING_DEADLINE',503);}
        budget.check();
        videoAudio.transcription=privateTranscription(response,videoAudio.extraction.pcm.sha256);
        videoAudio.status=videoAudio.transcription?'TRANSCRIBED_UNREVIEWED':'UNCONFIRMED';
        videoAudio.code=videoAudio.transcription?null:'FIELD_VIDEO_AUDIO_TRANSCRIPTION_UNCONFIRMED';
      }
    }
    // Each provider copy has its own current DB/identity/lease fence.
    await fence();
    const transcript=videoAudio.transcription;
    let analyzed;
    try{analyzed=await stage(15000,budget.signal,signal=>analyzer.analyzeVideo({...parts.prepared,context:claim.caption,signal,...(transcript?{transcriptContext:{text:transcript.text,transcriptSha256:transcript.transcriptSha256,sourceSha256:claim.media.sha256,authority:'PROVIDER_TRANSCRIPTION_UNREVIEWED'}}:{})}));}
    catch(error){budget.check();if(error instanceof WorkspaceError)throw error;if(deadlineFailure(error))throw new WorkspaceError('FIELD_MEDIA_PROCESSING_DEADLINE',503);}
    budget.check();
    const visual=privateVideoVisual(analyzed),visualConfirmed=visual.status==='ANALYZED_UNREVIEWED';
    const combined={success:visualConfirmed||Boolean(transcript),status:visualConfirmed?'ANALYZED_UNREVIEWED':transcript?'TRANSCRIBED_UNREVIEWED':'UNCONFIRMED',verified:false,requiresHumanReview:true,estimatedProgressPercentage:null,analysisScope:'SAMPLED_VIDEO_FRAMES',sampling,visual,videoAudio};
    if(visualConfirmed)for(const key of ['phase','aiAnalysis','isIncident','incidentSeverity','actionRecommendation','provider','providerModel','observedProviderModel'])if(Object.hasOwn(visual,key))combined[key]=visual[key];
    const report=analyzed?.contextualReport;
    if(visualConfirmed&&transcript&&report?.authority==='SAMPLED_FRAMES_AND_UNREVIEWED_TRANSCRIPT'&&report.transcriptSha256===transcript.transcriptSha256&&report.visibleSummary===visual.aiAnalysis&&boundedText(report.reportedSummary,2000)&&Array.isArray(report.uncertainties)&&report.uncertainties.length<=12&&report.uncertainties.every(value=>boundedText(value,300)))combined.contextualReport={visibleSummary:visual.aiAnalysis,reportedSummary:report.reportedSummary.trim(),uncertainties:report.uncertainties.map(value=>value.trim()),authority:report.authority,transcriptSha256:transcript.transcriptSha256,requiresHumanReview:true};
    if(transcript)combined.progressDraft=createVoiceProgressDraft({transcript:transcript.text,evidenceId:input.evidenceId,evidenceRevision:claim.evidenceRevision,mediaSha256:claim.media.sha256,transcriptSha256:transcript.transcriptSha256,task:claim.voiceTask});
    return combined;
  }
  return {
    async attach(session,body) {
      recordKeys(body,['operationId','projectId','scope','workerId','taskId','sectorId','caption','media']);scopeInput(body);
      const input={...body,operationId:body.operationId.toLowerCase(),caption:siteText(body.caption,2000,1,true)};
      if(!workspaceId(input.workerId)||!workspaceId(input.taskId)||!workspaceId(input.sectorId))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
      const validated=decodeFieldMedia(input.media.bytes,input.media.contentType),requestDigest=digest([input.projectId,input.scope,input.workerId,input.taskId,input.sectorId,input.caption,validated.digest]);
      const first=await run(session,input,true,async(client,member,scope,project)=>{
        await operations.assertWorker(client,member,session,input.projectId,input.workerId);await operations.readTask(client,input.projectId,input.taskId);
        if(!project.metadata?.fieldOperations?.sectors?.some(s=>s.id===input.sectorId))throw new WorkspaceError('FIELD_SECTOR_UNAVAILABLE',404);
        const id=fieldReceiptId(member.actorId,input.projectId,input.operationId),previous=await prior(client,member,id);
        if(previous){if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);return {done:{scope,saved:true,replayed:true,receiptId:id,...previous.metadata.outcome}};}
        return {id,actorId:member.actorId,organizationId:member.organizationId};
      });
      if(first.done)return first.done;
      try{assertPrivateImageConfigured(environment());}catch{throw new WorkspaceError('FIELD_MEDIA_STORAGE_UNAVAILABLE',503);}
      const media={kind:validated.kind,contentType:validated.contentType,bytes:validated.bytes.length,sha256:validated.digest,
        pathname:`obrasaas/field/v1/${digest([first.organizationId,input.projectId,first.actorId,input.operationId,validated.digest])}/evidence.${validated.extension}`};
      let confirmed;
      try{confirmed=await storedBytes(media);}catch(error){if(error.code==='FIELD_MEDIA_INTEGRITY')throw error;
        try{const blob=await put(media.pathname,validated.bytes,{access:'private',contentType:media.contentType,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60,abortSignal:AbortSignal.timeout(20000)});validMediaReceipt(blob,media);}catch{/* Confirm deterministic object after uncertain upload; never overwrite. */}
        confirmed=await storedBytes(media);
      }
      media.url=confirmed.url;
      return run(session,input,true,async(client,member,scope,project)=>{
        await operations.assertWorker(client,member,session,input.projectId,input.workerId);await operations.readTask(client,input.projectId,input.taskId);
        if(!project.metadata?.fieldOperations?.sectors?.some(s=>s.id===input.sectorId))throw new WorkspaceError('FIELD_SECTOR_UNAVAILABLE',404);
        if(member.actorId!==first.actorId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);
        const previous=await prior(client,member,first.id);
        if(previous){if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);return {scope,saved:true,replayed:true,receiptId:first.id,...previous.metadata.outcome};}
        const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString(),evidenceId='evidence_'+digest([first.id,validated.digest]).slice(0,40);
        const details={version:1,kind:'EVIDENCE',workerId:input.workerId,taskId:input.taskId,sectorId:input.sectorId,capturedAt:now,captureTimeAuthority:'SERVER_RECEIVED',recordedBy:member.actorId,media,processing:{status:'QUEUED',code:null},review:null};
        await client.query(`INSERT INTO public."Incident"(id,"projectId",title,description,severity,status,reporter,metadata,"updatedAt") VALUES($1,$2,$3,$4,'INFO','open',$5,$6::jsonb,clock_timestamp())`,[evidenceId,input.projectId,media.kind==='audio'?'Nota de audio':media.kind==='video'?'Video de obra':'Fotografía de obra',input.caption,member.actorId,JSON.stringify({fieldOperations:details})]);
        const row=await operations.readEvidence(client,input.projectId,evidenceId);
        return {scope,...await saveReceipt(client,member,input,first.id,requestDigest,{kind:'EVIDENCE',evidence:publicFieldEvidence(row)})};
      });
    },
    async process(session,body) {
      recordKeys(body,['operationId','projectId','scope','evidenceId','revision',...(Object.hasOwn(body||{},'analysisConsent')?['analysisConsent']:[])]);scopeInput(body);siteRevision(body.revision);
      if(!validFieldMediaAnalysisConsent(body.analysisConsent)||!body.analysisConsent.allowed)throw new WorkspaceError('FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED',400);
      const input={...body,operationId:body.operationId.toLowerCase()};
      if(!workspaceId(input.evidenceId))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
      const requestDigest=digest(['PROCESS',input]),budget=processBudget(processTimeoutMs);
      try{
      const claim=await run(session,input,true,async(client,member,scope)=>{
        const id=fieldReceiptId(member.actorId,input.projectId,input.operationId),previous=await prior(client,member,id);
        if(previous){if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);const current=await operations.readEvidence(client,input.projectId,input.evidenceId);await ownsEvidence(client,member,session,input,current);return {done:{scope,saved:true,replayed:true,receiptId:id,...previous.metadata.outcome}};}
        const row=await operations.readEvidence(client,input.projectId,input.evidenceId,true);await ownsEvidence(client,member,session,input,row);
        const e=row.metadata.fieldOperations,processing=e.processing;
        if(input.analysisConsent.noticeVersion===FIELD_VIDEO_PRIVACY_NOTICE_VERSION&&e.media.kind!=='video')throw new WorkspaceError('FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED',400);
        if(e.review)throw new WorkspaceError('FIELD_ALREADY_REVIEWED',409);
        const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
        const sameClaim=processing?.status==='RUNNING'&&processing.operationId===input.operationId&&processing.requestDigest===requestDigest&&processing.actorId===member.actorId;
        if(processing?.status==='RUNNING'){
          const expiresAt=Date.parse(processing.expiresAt);if(!Number.isFinite(expiresAt))throw new WorkspaceError('FIELD_MEDIA_PROCESSING_CHANGED',409);
          if(expiresAt>now.getTime())throw new WorkspaceError('FIELD_MEDIA_PROCESSING',409);
        }
        if(row.revision!==input.revision&&!sameClaim)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
        if(['ANALYZED_UNREVIEWED','TRANSCRIBED_UNREVIEWED'].includes(processing?.status))throw new WorkspaceError('FIELD_MEDIA_ALREADY_PROCESSED',409);
        const voiceTask=e.media.kind==='audio'||fieldVideoAudioAnalysisAllowed(input.analysisConsent)?await operations.readTask(client,input.projectId,e.taskId):null;
        budget.check();
        const leaseId=randomUUID(),next={...e,processing:{status:'RUNNING',operationId:input.operationId,requestDigest,actorId:member.actorId,leaseId,...(input.analysisConsent?{analysisConsent:input.analysisConsent}:{}),startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+90000).toISOString()}};
        await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,input.projectId,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:next})]);
        return {id,actorId:member.actorId,leaseId,media:e.media,caption:row.description,voiceTask,evidenceRevision:row.revision};
      });
      if(claim.done)return claim.done;
      const contextual=claim.media.kind==='video'&&input.analysisConsent.noticeVersion===FIELD_VIDEO_PRIVACY_NOTICE_VERSION;
      let fenceError;
      const fence=async()=>{budget.check();try{await run(session,input,true,async(client,member)=>{
        const row=await operations.readEvidence(client,input.projectId,input.evidenceId,true);await ownsEvidence(client,member,session,input,row);
        await currentClaim(client,member,input,row,claim,requestDigest);budget.check();
      });}catch(error){fenceError=error;throw error;}};
      await fence();
      let analysis;
      try{
        const {bytes}=await storedBytes(claim.media,{signal:budget.signal});budget.check();
        if(contextual)analysis=await contextualVideo(bytes,claim,input,budget,fence);
        else {
        const prepared=claim.media.kind==='video'?await extractVideoFrames({buffer:bytes,mimeType:claim.media.contentType,signal:budget.signal}):null;budget.check();
        if(prepared&&prepared.sampling.sourceSha256!==claim.media.sha256)throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);
        // Decoding/storage may take time. Recheck current access and reservation
        // before sending a copy outside this workspace.
        // The canonical worker guard takes FOR SHARE, so its short permission
        // transaction must permit row locks even though it writes no records.
        await fence();
        analysis=claim.media.kind==='video'?await analyzer.analyzeVideo({...prepared,context:claim.caption,signal:budget.signal}):claim.media.kind==='audio'?await analyzer.transcribeAudio({buffer:bytes,mimeType:claim.media.contentType,language:'es',signal:budget.signal}):await analyzer.analyzePhoto({base64:bytes.toString('base64'),mimeType:claim.media.contentType,context:claim.caption,signal:budget.signal});budget.check();
        if(claim.media.kind==='audio'&&analysis?.success&&analysis.status==='TRANSCRIBED_UNREVIEWED')analysis={...analysis,progressDraft:createVoiceProgressDraft({transcript:analysis.text,evidenceId:input.evidenceId,evidenceRevision:claim.evidenceRevision,mediaSha256:claim.media.sha256,transcriptSha256:sha(Buffer.from(analysis.text.trim(),'utf8')),task:claim.voiceTask})};
        }
      }catch(error){budget.check();if(error===fenceError||contextual&&error instanceof WorkspaceError)throw error;if(contextual&&deadlineFailure(error))throw new WorkspaceError('FIELD_MEDIA_PROCESSING_DEADLINE',503);analysis={success:false,status:'FAILED_RETRYABLE',code:/^FIELD_VIDEO_[A-Z_]+$/.test(error?.code||'')?error.code:'FIELD_MEDIA_PROVIDER_UNCONFIRMED'};}
      const processing={...(analysis?.success?{status:analysis.status,result:analysis,humanReviewRequired:true}:{status:'FAILED_RETRYABLE',code:analysis?.code||'FIELD_MEDIA_PROVIDER_UNCONFIRMED',...(contextual&&analysis?.videoAudio?{result:analysis}:{}),humanReviewRequired:true}),...(input.analysisConsent?{analysisConsent:input.analysisConsent}:{})};
      return await run(session,input,true,async(client,member,scope)=>{
        const row=await operations.readEvidence(client,input.projectId,input.evidenceId,true);await ownsEvidence(client,member,session,input,row);
        const previous=await prior(client,member,claim.id);if(previous)return {scope,saved:true,replayed:true,receiptId:claim.id,...previous.metadata.outcome};
        const now=(await currentClaim(client,member,input,row,claim,requestDigest)).toISOString();budget.check();
        const metadata={...cleanMetadata(row.metadata),fieldOperations:{...row.metadata.fieldOperations,processing:{...processing,completedAt:now}}};
        const updated=await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2 AND metadata->'fieldOperations'->'processing'->>'status'='RUNNING' AND metadata->'fieldOperations'->'processing'->>'actorId'=$4 AND metadata->'fieldOperations'->'processing'->>'operationId'=$5 AND metadata->'fieldOperations'->'processing'->>'requestDigest'=$6 AND metadata->'fieldOperations'->'processing'->>'leaseId'=$7 AND (metadata->'fieldOperations'->'processing'->>'expiresAt')::timestamptz>clock_timestamp() AND (metadata->'fieldOperations'->'review' IS NULL OR metadata->'fieldOperations'->'review'='null'::jsonb) RETURNING id`,[row.id,input.projectId,JSON.stringify(metadata),claim.actorId,input.operationId,requestDigest,claim.leaseId]);
        if(updated.rows.length!==1||updated.rows[0].id!==row.id)throw new WorkspaceError('FIELD_MEDIA_PROCESSING_CHANGED',409);
        budget.check();
        const result={scope,...await saveReceipt(client,member,input,claim.id,requestDigest,{kind:'EVIDENCE_PROCESSING',evidence:publicFieldEvidence(await operations.readEvidence(client,input.projectId,row.id))})};
        budget.check();return result;
      });
      }finally{budget.close();}
    },
    status(session,input) {
      scopeInput(input);return run(session,input,false,async(client,member,scope)=>{
        const id=fieldReceiptId(member.actorId,input.projectId,input.operationId),row=await prior(client,member,id);
        if(row&&!canReviewField(member.role)){
          const owned=(await client.query(`SELECT id FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'permissions'->>'report'='true' AND metadata->'participant'->'kyc'->>'status'='APPROVED'`,[row.metadata.outcome.evidence.workerId,input.projectId,session.userId])).rows;
          if(owned.length!==1)throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);
        }
        if(!row){
          const pending=(await client.query(`SELECT id,metadata->'fieldOperations'->'processing' AS processing FROM public."Incident" WHERE "projectId"=$1 AND metadata->'fieldOperations'->'processing'->>'operationId'=$2 AND metadata->'fieldOperations'->'processing'->>'actorId'=$3 LIMIT 1`,[input.projectId,input.operationId,member.actorId])).rows[0];
          if(pending?.processing?.status==='RUNNING'){
            const current=await operations.readEvidence(client,input.projectId,pending.id);
            if(!canReviewField(member.role)){
              const owned=(await client.query(`SELECT id FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'version'='1' AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'permissions'->>'report'='true' AND metadata->'participant'->'kyc'->>'status'='APPROVED'`,[current.metadata.fieldOperations.workerId,input.projectId,session.userId])).rows;
              if(owned.length!==1)throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);
            }
            const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,expiresAt=Date.parse(pending.processing.expiresAt);
            return {scope,state:'PROCESSING',definitive:false,expiresAt:pending.processing.expiresAt,leaseExpired:Number.isFinite(expiresAt)&&expiresAt<=now.getTime(),retryAfterExpiration:true};
          }
        }
        return row?{scope,state:'RECORDED',saved:true,replayed:true,receiptId:id,...row.metadata.outcome}:{scope,state:'NOT_OBSERVED',definitive:false};
      });
    },
    async download(session,input) {
      if(!workspaceId(input.evidenceId))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');
      const authorizedMedia=()=>run(session,input,false,async(client,member)=>{
        const row=await operations.readEvidence(client,input.projectId,input.evidenceId),e=row.metadata.fieldOperations;
        if(!canReviewField(member.role)){
          const owned=(await client.query(`SELECT id FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'permissions'->>'report'='true' AND metadata->'participant'->'kyc'->>'status'='APPROVED'`,[e.workerId,input.projectId,session.userId])).rows;
          if(owned.length!==1)throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);
        }return e.media;
      });
      const media=await authorizedMedia();
      if(!/^obrasaas\/field\/v1\/[a-f0-9]{64}\/evidence\.(jpg|png|webp|ogg|wav|mp3|m4a|mp4|webm)$/.test(media.pathname)||!Number.isInteger(media.bytes)||media.bytes<1||media.bytes>FIELD_MEDIA_LIMIT||!/^([a-f0-9]{64})$/.test(media.sha256))throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);
      const {bytes}=await storedBytes(media),current=await authorizedMedia();
      if(current.sha256!==media.sha256||current.pathname!==media.pathname)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
      return {bytes,contentType:media.contentType,extension:media.pathname.split('.').at(-1)};
    },
  };
}
