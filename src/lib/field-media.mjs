import { createHash, randomUUID } from 'node:crypto';
import { WorkspaceError, workspaceId, operationId, digest } from './workspace-policy.mjs';
import { siteText, siteRevision, recordKeys, cleanMetadata } from './site-register-policy.mjs';
import { assertPrivateImageConfigured, decodePrivateImage } from './private-image-upload.mjs';
import { canReviewField } from './field-operations-policy.mjs';
import { publicFieldEvidence } from './field-operations-store.mjs';
import { createVideoFrameExtractor } from './video-frame-extractor.mjs';
import { validFieldMediaAnalysisConsent } from './field-media-privacy.mjs';
import { createVoiceProgressDraft } from './voice-progress-draft.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fieldReceiptId=(actorId,projectId,key)=>'fieldmedia_'+digest([actorId,projectId,key.toLowerCase()]);
// Keep uploads below the Production function request-body limit, including
// multipart overhead. Larger/direct uploads need a separately verified adapter.
export const FIELD_MEDIA_LIMIT = 3*1024*1024;
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
export function createFieldMedia({operations,put,get,analyzer,extractVideoFrames=createVideoFrameExtractor(),environment=()=>process.env}) {
  const run=operations.mediaTransaction;
  const prior=async(client,member,id)=>(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='field.media.recorded'`,[id,member.organizationId,member.actorId])).rows[0];
  const saveReceipt=async(client,member,input,id,requestDigest,outcome)=>{
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.media.recorded','Incident',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,outcome.evidence.id,JSON.stringify({version:1,projectId:input.projectId,requestDigest,...(member.channelProof?{channelProof:member.channelProof}:{}),outcome})]);
    return {saved:true,replayed:false,receiptId:id,...outcome};
  };
  async function storedBytes(media) {
    const stored=await get(media.pathname,{access:'private',useCache:false,abortSignal:AbortSignal.timeout(20000)});
    try{
      if(!stored||stored.statusCode!==200||stored.blob?.contentType?.split(';')[0]!==media.contentType)throw new WorkspaceError('FIELD_MEDIA_STORAGE_UNCONFIRMED',503);
      validMediaReceipt(stored,media);const reader=stored.stream.getReader(),chunks=[];let count=0;
      try{while(true){const item=await reader.read();if(item.done)break;count+=item.value.byteLength;if(count>media.bytes)throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);chunks.push(Buffer.from(item.value));}
        const bytes=Buffer.concat(chunks);if(bytes.length!==media.bytes||sha(bytes)!==media.sha256)throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);return {bytes,url:stored.blob.url};
      }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    }catch(error){await stored?.stream?.cancel?.().catch(()=>{});throw error;}
  }
  function scopeInput(input){if(!workspaceId(input.projectId)||!operationId(input.operationId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('FIELD_MEDIA_INPUT_INVALID');}
  async function ownsEvidence(client,member,session,input,row) {
    if(!canReviewField(member.role))await operations.assertWorker(client,member,session,input.projectId,row.metadata.fieldOperations.workerId);
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
      const requestDigest=digest(['PROCESS',input]),claim=await run(session,input,true,async(client,member,scope)=>{
        const id=fieldReceiptId(member.actorId,input.projectId,input.operationId),previous=await prior(client,member,id);
        if(previous){if(previous.metadata.requestDigest!==requestDigest)throw new WorkspaceError('FIELD_OPERATION_CONFLICT',409);const current=await operations.readEvidence(client,input.projectId,input.evidenceId);await ownsEvidence(client,member,session,input,current);return {done:{scope,saved:true,replayed:true,receiptId:id,...previous.metadata.outcome}};}
        const row=await operations.readEvidence(client,input.projectId,input.evidenceId,true);await ownsEvidence(client,member,session,input,row);
        const e=row.metadata.fieldOperations,processing=e.processing;
        if(e.review)throw new WorkspaceError('FIELD_ALREADY_REVIEWED',409);
        const sameClaim=processing?.status==='RUNNING'&&processing.operationId===input.operationId&&processing.requestDigest===requestDigest&&processing.actorId===member.actorId;
        if(processing?.status==='RUNNING'&&new Date(processing.expiresAt).getTime()>Date.now())throw new WorkspaceError('FIELD_MEDIA_PROCESSING',409);
        if(row.revision!==input.revision&&!sameClaim)throw new WorkspaceError('FIELD_REVISION_CHANGED',409);
        if(['ANALYZED_UNREVIEWED','TRANSCRIBED_UNREVIEWED'].includes(processing?.status))throw new WorkspaceError('FIELD_MEDIA_ALREADY_PROCESSED',409);
        const voiceTask=e.media.kind==='audio'?await operations.readTask(client,input.projectId,e.taskId):null;
        const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
        const leaseId=randomUUID(),next={...e,processing:{status:'RUNNING',operationId:input.operationId,requestDigest,actorId:member.actorId,leaseId,...(input.analysisConsent?{analysisConsent:input.analysisConsent}:{}),startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+90000).toISOString()}};
        await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,input.projectId,JSON.stringify({...cleanMetadata(row.metadata),fieldOperations:next})]);
        return {id,actorId:member.actorId,leaseId,media:e.media,caption:row.description,voiceTask,evidenceRevision:row.revision};
      });
      if(claim.done)return claim.done;
      let analysis;
      try{
        const {bytes}=await storedBytes(claim.media);
        const prepared=claim.media.kind==='video'?await extractVideoFrames({buffer:bytes,mimeType:claim.media.contentType}):null;
        if(prepared&&prepared.sampling.sourceSha256!==claim.media.sha256)throw new WorkspaceError('FIELD_MEDIA_INTEGRITY',503);
        // Decoding/storage may take time. Recheck current access and reservation
        // before sending a copy outside this workspace.
        // The canonical worker guard takes FOR SHARE, so its short permission
        // transaction must permit row locks even though it writes no records.
        await run(session,input,true,async(client,member)=>{const row=await operations.readEvidence(client,input.projectId,input.evidenceId);await ownsEvidence(client,member,session,input,row);
          if(member.actorId!==claim.actorId||row.metadata.fieldOperations.processing?.leaseId!==claim.leaseId||row.metadata.fieldOperations.review)throw new WorkspaceError('FIELD_MEDIA_PROCESSING_CHANGED',409);
        });
        analysis=claim.media.kind==='video'?await analyzer.analyzeVideo({...prepared,context:claim.caption}):claim.media.kind==='audio'?await analyzer.transcribeAudio({buffer:bytes,mimeType:claim.media.contentType,language:'es'}):await analyzer.analyzePhoto({base64:bytes.toString('base64'),mimeType:claim.media.contentType,context:claim.caption});
        if(claim.media.kind==='audio'&&analysis?.success&&analysis.status==='TRANSCRIBED_UNREVIEWED')analysis={...analysis,progressDraft:createVoiceProgressDraft({transcript:analysis.text,evidenceId:input.evidenceId,evidenceRevision:claim.evidenceRevision,mediaSha256:claim.media.sha256,transcriptSha256:sha(Buffer.from(analysis.text.trim(),'utf8')),task:claim.voiceTask})};
      }catch(error){analysis={success:false,status:'FAILED_RETRYABLE',code:/^FIELD_VIDEO_[A-Z_]+$/.test(error?.code||'')?error.code:'FIELD_MEDIA_PROVIDER_UNCONFIRMED'};}
      const processing={...(analysis?.success?{status:analysis.status,result:analysis,humanReviewRequired:true}:{status:'FAILED_RETRYABLE',code:analysis?.code||'FIELD_MEDIA_PROVIDER_UNCONFIRMED',humanReviewRequired:true}),...(input.analysisConsent?{analysisConsent:input.analysisConsent}:{})};
      return run(session,input,true,async(client,member,scope)=>{
        const row=await operations.readEvidence(client,input.projectId,input.evidenceId,true);await ownsEvidence(client,member,session,input,row);
        const previous=await prior(client,member,claim.id);if(previous)return {scope,saved:true,replayed:true,receiptId:claim.id,...previous.metadata.outcome};
        if(member.actorId!==claim.actorId||row.metadata.fieldOperations.processing?.operationId!==input.operationId||row.metadata.fieldOperations.processing.leaseId!==claim.leaseId||row.metadata.fieldOperations.processing.status!=='RUNNING'||row.metadata.fieldOperations.review)throw new WorkspaceError('FIELD_MEDIA_PROCESSING_CHANGED',409);
        const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString(),metadata={...cleanMetadata(row.metadata),fieldOperations:{...row.metadata.fieldOperations,processing:{...processing,completedAt:now}}};
        await client.query(`UPDATE public."Incident" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,input.projectId,JSON.stringify(metadata)]);
        return {scope,...await saveReceipt(client,member,input,claim.id,requestDigest,{kind:'EVIDENCE_PROCESSING',evidence:publicFieldEvidence(await operations.readEvidence(client,input.projectId,row.id))})};
      });
    },
    status(session,input) {
      scopeInput(input);return run(session,input,false,async(client,member,scope)=>{
        const id=fieldReceiptId(member.actorId,input.projectId,input.operationId),row=await prior(client,member,id);
        if(row&&!canReviewField(member.role)){
          const owned=(await client.query(`SELECT id FROM public."Worker" WHERE id=$1 AND "projectId"=$2 AND active=true AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND metadata->'participant'->'permissions'->>'report'='true' AND metadata->'participant'->'kyc'->>'status'='APPROVED'`,[row.metadata.outcome.evidence.workerId,input.projectId,session.userId])).rows;
          if(owned.length!==1)throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);
        }
        if(!row){
          const processing=(await client.query(`SELECT metadata->'fieldOperations'->'processing' AS processing FROM public."Incident" WHERE "projectId"=$1 AND metadata->'fieldOperations'->'processing'->>'operationId'=$2 AND metadata->'fieldOperations'->'processing'->>'actorId'=$3 LIMIT 1`,[input.projectId,input.operationId,member.actorId])).rows[0]?.processing;
          if(processing?.status==='RUNNING')return {scope,state:'PROCESSING',definitive:false,expiresAt:processing.expiresAt,retryAfterExpiration:true};
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
