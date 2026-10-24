import {assertParticipantFacialPrecommitSource} from './participant-facial-policy.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';
import {participantKycInitialChannelCapture} from './participant-kyc-image-set.mjs';
import {participantOcrNotice,participantBiometricNotice} from './participant-analysis-consent.mjs';
import {assertParticipantPreanalysisSource,KYC_PREANALYSIS_TERMINAL,KYC_PREANALYSIS_MODE,participantPreanalysisIssueCodes,participantPreanalysisHasPendingStage} from './participant-kyc-preanalysis-policy.mjs';
import {normalizeDniExtraction} from './pilot-media.mjs';
import {decodePrivateImage} from './private-image-upload.mjs';
import {usageDigest as stableDigest} from './organization-usage-policy.mjs';

const fail=(code='PARTICIPANT_ANALYSIS_SOURCE_CHANGED',status=409)=>{throw new WorkspaceError(code,status);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
// DISPATCHED is an irreversible stage fence, even when another stage can run.
const done=stage=>['NOT_AUTHORIZED','COMPLETE','FAILED','DISPATCHED'].includes(stage?.state)||stage?.state==='HELD'&&stage.code!=='ORGANIZATION_USAGE_COVERAGE_EXPIRED';
const safeCode=value=>typeof value==='string'&&/^(?:AI_|DNI_|MEDIA_IMAGE_|BIOMETRIC_|PARTICIPANT_KYC_|PARTICIPANT_PRIVATE_|ORGANIZATION_USAGE_)[A-Z_]{1,80}$/.test(value)?value:'PARTICIPANT_ANALYSIS_UNCONFIRMED';
const referenceValid=r=>r&&Object.keys(r).every(key=>['projectId','workerId','submissionId'].includes(key))&&[r.projectId,r.workerId,r.submissionId].every(workspaceId);
const resource=(a,k)=>({projectId:a.projectId,resourceType:'Worker',resourceId:a.workerId,resourceRevision:digest(['participant-ocr-resource-v1',a.submissionId,a.contentHash]),stage:'IDENTITY_OPENAI_OCR',sourceSha256:k.images.find(image=>image.id==='document-front').sha256});
const projection=p=>({automatic:true,state:p.status,code:p.code||null,processed:KYC_PREANALYSIS_TERMINAL.includes(p.status)&&!participantPreanalysisHasPendingStage(p)});

// A service principal is minted only from a current, exact canonical submission.
// sourceActorId is attribution to its real author, never a fabricated ADMIN session.
// This module can update only kyc.processing and append its own technical receipt.
export function createParticipantKycPreanalysis({connect,get,analyzer,assessBiometrics,usage,readiness=()=>({ocr:true,biometric:true}),leaseMs=150000}={}){
 if(typeof connect!=='function'||typeof get!=='function'||typeof readiness!=='function'||!Number.isInteger(leaseMs)||leaseMs<1000||leaseMs>180000||!usage||['reserveResource','resourcePending','fence','observe','unknown','lockBeforeProject'].some(key=>typeof usage[key]!=='function'))throw new TypeError('Canonical preanalysis ports required');
 async function within(fn){let client,broken=false;try{client=await connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout='6000ms'");await client.query("SET LOCAL lock_timeout='2500ms'");const result=await fn(client);await client.query('COMMIT');return result;}catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('PARTICIPANT_ANALYSIS_UNCONFIRMED',503);}finally{client?.release(broken);}}
 const now=async client=>{const value=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;if(!(value instanceof Date)||!Number.isFinite(value.getTime()))fail();return value;};
 async function resolve(client,ref){
  const initial=(await client.query(`SELECT w.id,w."projectId",w.active,w.metadata,p."organizationId" FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" JOIN public."Organization" o ON o.id=p."organizationId" WHERE w.id=$1 AND w."projectId"=$2 AND p.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb`,[ref.workerId,ref.projectId])).rows;
  if(initial.length!==1)fail();const original=initial[0],a=original.metadata?.participant?.kyc?.processing?.auto;
  if(!a||a.submissionId!==ref.submissionId||a.organizationId!==original.organizationId||a.projectId!==ref.projectId||a.workerId!==ref.workerId)fail();
  const principals=(await client.query(`SELECT u.id AS "actorId",u."clerkUserId",tm.id AS "membershipId",tm."tenantRole"::text AS role FROM public."PlatformUser" u JOIN public."TenantMembership" tm ON tm."userId"=u.id WHERE u.id=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' FOR SHARE OF u,tm`,[a.sourceActorId,a.organizationId])).rows;
  if(principals.length!==1)fail();const principal=principals[0],member={actorId:principal.actorId,organizationId:a.organizationId};
  await usage.lockBeforeProject(client,member);
  const projects=(await client.query(`SELECT p.id FROM public."Project" p JOIN public."Organization" o ON o.id=p."organizationId" WHERE p.id=$1 AND p."organizationId"=$2 AND p.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb FOR SHARE OF p,o`,[ref.projectId,a.organizationId])).rows;if(projects.length!==1)fail();
  const rows=(await client.query(`SELECT id,"projectId",active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[ref.workerId,ref.projectId])).rows;if(rows.length!==1)fail();
  const row=rows[0],p=row.metadata?.participant,k=p?.kyc,processing=k?.processing,at=await now(client);
  if(!row.active||p?.version!==1||!['ACTIVE','INVITED'].includes(p.status)||!['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM'].includes(k?.status)||k.submissionId!==ref.submissionId||processing?.automatic!==true||stableDigest(processing.auto)!==stableDigest(a))fail();
  if(!processing.stages||Object.keys(processing.stages).sort().join('|')!=='biometric|ocr'||Object.values(processing.stages).some(stage=>!['PENDING','NOT_AUTHORIZED','COMPLETE','FAILED','WAITING_CONFIGURATION','HELD','DISPATCHED'].includes(stage?.state))||processing.nextCheckAt!==undefined&&processing.nextCheckAt!==null&&!instant(processing.nextCheckAt)||processing.status==='RUNNING'&&!instant(processing.expiresAt))fail();
  const proofs=(await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='Worker' AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND metadata->>'submissionId'=$3 FOR SHARE`,[a.organizationId,row.id,k.submissionId])).rows;
  if(proofs.length!==1)fail();const consent=assertParticipantPreanalysisSource(k,a,proofs[0],{organizationId:a.organizationId,projectId:ref.projectId,workerId:row.id});await assertParticipantFacialPrecommitSource(client,k,proofs[0],{organizationId:a.organizationId,projectId:ref.projectId,workerId:row.id});
  const capture=k.channelCapture===undefined?null:participantKycInitialChannelCapture(k.channelCapture);
  if(k.channelCapture!==undefined&&(!capture||capture.receiptId!==proofs[0].id||digest(proofs[0].metadata.channelCapture)!==digest(capture)))fail();
  if(capture?.accountClaimRequired){
   if(row.metadata.participant.kycChatChallenge?.issuerActorId!==principal.actorId||!['ADMIN','DIRECTOR'].includes(principal.role))fail();
   if(p.status==='INVITED'){
    if(p.clerkUserId||k.status!=='PENDING_ACCOUNT_CLAIM'||p.invitation?.id!==capture.invitationId||p.invitation.state!=='SENT'||!Number.isFinite(Date.parse(p.invitation.expiresAt))||Date.parse(p.invitation.expiresAt)<=at.getTime()||digest(k.channelCapture)!==digest(capture))fail();
   }else{
    const c=k.channelCapture;if(c.accountClaimRequired!==false||c.acceptanceReceiptId!==p.acceptanceReceiptId||c.claimedClerkUserId!==p.clerkUserId)fail();
    const adopted=(await client.query(`SELECT id,"actorId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityType"='Worker' AND "entityId"=$3 AND action='participant.kyc_chat.adopted' FOR SHARE`,[p.acceptanceReceiptId+'_kyc',a.organizationId,row.id])).rows;
    if(adopted.length!==1||adopted[0].actorId!==c.claimedActorId||adopted[0].metadata?.submissionId!==k.submissionId||adopted[0].metadata.contentHash!==k.contentHash||adopted[0].metadata.captureReceiptId!==proofs[0].id||adopted[0].metadata.acceptanceReceiptId!==p.acceptanceReceiptId)fail();
   }
  }else if(p.status!=='ACTIVE'||k.status!=='PENDING_REVIEW'||p.clerkUserId!==principal.clerkUserId||capture&&capture.capturedParticipantClerkUserId!==p.clerkUserId)fail();
  if(p.status==='ACTIVE'){
   const assigned=(await client.query(`SELECT pm.id FROM public."ProjectMembership" pm JOIN public."TenantMembership" tm ON tm.id=pm."tenantMembershipId" JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE pm."projectId"=$1 AND tm."organizationId"=$2 AND u."clerkUserId"=$3 AND tm.status='ACTIVE' AND pm.status='ACTIVE' FOR SHARE OF pm,tm,u`,[ref.projectId,a.organizationId,p.clerkUserId])).rows;if(assigned.length!==1)fail();
  }
  return {row,k,processing,a,member,consent,now:at};
 }
 async function write(client,r,processing){const metadata=structuredClone(r.row.metadata);metadata.participant.kyc.processing=processing;await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[r.row.id,r.a.projectId,JSON.stringify(metadata)]);return projection(processing);}
 async function update(ref,claimId,fn){return within(async client=>{const r=await resolve(client,ref),p=r.processing;if(p.claimId!==claimId||p.status!=='RUNNING'||Date.parse(p.expiresAt)<=r.now.getTime())fail('PARTICIPANT_ANALYSIS_LEASE_CHANGED');return fn(client,r);});}
 async function bytes(image){
  let result;try{const url=new URL(image.url);if(url.protocol!=='https:'||! /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.port||url.username||url.password||url.search||url.hash||! /^\/obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.(png|jpg|webp)$/.test(url.pathname)||!Number.isSafeInteger(image.bytes)||image.bytes<1||image.bytes>2*1024*1024||!['image/jpeg','image/png','image/webp'].includes(image.contentType)||!/^[a-f0-9]{64}$/.test(image.sha256||''))throw Error();result=await get(url.pathname.slice(1),{access:'private',useCache:false,abortSignal:AbortSignal.timeout(15000)});if(result?.statusCode!==200||result.blob?.url!==image.url||result.blob.size!==image.bytes||result.blob.contentType?.split(';')[0]!==image.contentType)throw Error();const reader=result.stream.getReader(),parts=[];let size=0;try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>image.bytes||size>2*1024*1024)throw Error();parts.push(Buffer.from(next.value));}const buffer=Buffer.concat(parts);if(size!==image.bytes||sha(buffer)!==image.sha256)throw Error();decodePrivateImage(buffer.toString('base64'),image.contentType);return {buffer,mimeType:image.contentType};}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}}
  catch{await result?.stream?.cancel?.().catch(()=>{});fail('PARTICIPANT_KYC_INTEGRITY');}
 }
 function biometricResult(result,k){
  const front=k.images.find(i=>i.id==='document-front'),selfie=k.images.find(i=>i.id==='selfie');
  if(result?.success!==true||result.status!=='ADVISORY_UNREVIEWED'||result.provider!=='private-opencv-onnx'||result.modelManifestSha256!=='c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860'||result.frontSha256!==front.sha256||result.selfieSha256!==selfie.sha256||['identityCertified','livenessVerified','documentAuthenticityVerified','measurementCalibrated'].some(key=>result[key]!==false)||result.requiresHumanReview!==true||!Number.isFinite(result.faceSimilarity)||result.faceSimilarity< -1||result.faceSimilarity>1||!Number.isFinite(result.captureRiskSignal)||result.captureRiskSignal<0||result.captureRiskSignal>1)return null;
  return {status:'ADVISORY_UNREVIEWED',provider:result.provider,modelManifestSha256:result.modelManifestSha256,frontSha256:result.frontSha256,selfieSha256:result.selfieSha256,faceSimilarity:result.faceSimilarity,captureRiskSignal:result.captureRiskSignal,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true};
 }
 const unavailableBiometric=code=>({status:'UNAVAILABLE',code,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true});
 async function technicalReceipt(client,r,p){
  if(!KYC_PREANALYSIS_TERMINAL.includes(p.status))return;
  await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.kyc.preanalysis','Worker',$4,$5::jsonb) ON CONFLICT(id) DO NOTHING`,['participant_analysis_'+digest([r.a.sourceReceiptId,r.a.operationId]),r.a.organizationId,r.a.sourceActorId,r.row.id,JSON.stringify({version:1,executor:KYC_PREANALYSIS_MODE,projectId:r.a.projectId,sourceReceiptId:r.a.sourceReceiptId,submissionId:r.a.submissionId,contentHash:r.a.contentHash,consentDigest:r.a.consentDigest,status:p.status,code:p.code||null,identityCertified:false,permissionsGranted:false,livenessVerified:false,whatsAppAccessGranted:false})]);
 }
 async function finalize(ref,claimId){return update(ref,claimId,async(client,r)=>{
  const p=r.processing,states=Object.values(p.stages),waiting=states.find(s=>s.state==='WAITING_CONFIGURATION'),held=states.find(s=>s.state==='HELD'),uncertain=states.some(s=>s.state==='DISPATCHED');
  const status=uncertain?'UNCERTAIN':held?'USAGE_HELD':waiting?'WAITING_CONFIGURATION':p.fields?'EXTRACTED_UNVERIFIED':p.biometrics?.status==='ADVISORY_UNREVIEWED'?'ADVISORY_UNREVIEWED':'FAILED_RETRYABLE';
  const finished={...p,status,issueCodes:participantPreanalysisIssueCodes(p),code:uncertain?'PARTICIPANT_ANALYSIS_DISPATCH_UNCERTAIN':held?.code||waiting?.code||states.find(s=>s.code)?.code||null,completedAt:r.now.toISOString(),expiresAt:null,nextCheckAt:waiting||held?.code==='ORGANIZATION_USAGE_COVERAGE_EXPIRED'?new Date(r.now.getTime()+300000).toISOString():null};
  await write(client,r,finished);
  await technicalReceipt(client,r,finished);
  return projection(finished);
 });}
 return {
  async process(ref){
   if(!referenceValid(ref))fail('PARTICIPANT_ANALYSIS_REFERENCE_INVALID',400);
   const claim=await within(async client=>{
    const r=await resolve(client,ref),p=r.processing,pending=participantPreanalysisHasPendingStage(p);if(KYC_PREANALYSIS_TERMINAL.includes(p.status)&&!pending)return {done:projection(p)};
    if(p.status==='RUNNING'&&Date.parse(p.expiresAt)>r.now.getTime())return {done:{automatic:true,state:'RUNNING',processed:false}};
    if(!pending&&Object.values(p.stages).some(s=>s.state==='DISPATCHED')){const stopped={...p,status:'UNCERTAIN',issueCodes:participantPreanalysisIssueCodes(p),code:'PARTICIPANT_ANALYSIS_DISPATCH_UNCERTAIN',completedAt:r.now.toISOString(),expiresAt:null,nextCheckAt:null};await technicalReceipt(client,r,stopped);return {done:await write(client,r,stopped)};}
    if(p.nextCheckAt&&Date.parse(p.nextCheckAt)>r.now.getTime())return {done:projection(p)};
    if(p.status==='USAGE_HELD'&&!pending)return {done:projection(p)};
    const claimId=randomUUID(),processing={...p,status:'RUNNING',claimId,startedAt:r.now.toISOString(),expiresAt:new Date(r.now.getTime()+leaseMs).toISOString(),nextCheckAt:null};await write(client,r,processing);return {claimId,k:r.k,a:r.a,stages:processing.stages,consent:r.consent};
   });if(claim.done)return claim.done;
   const {claimId}=claim,available=readiness();let front=null;
   for(const kind of ['ocr','biometric']){
    if(done(claim.stages[kind]))continue;
    if(!claim.consent[kind]){await update(ref,claimId,(client,r)=>write(client,r,{...r.processing,stages:{...r.processing.stages,[kind]:{state:'NOT_AUTHORIZED'}}}));continue;}
    if(available[kind]!==true){const code=kind==='ocr'?'AI_PROVIDER_NOT_CONFIGURED':'BIOMETRIC_SERVICE_NOT_CONFIGURED';await update(ref,claimId,(client,r)=>write(client,r,{...r.processing,stages:{...r.processing.stages,[kind]:{state:'WAITING_CONFIGURATION',code}},...(kind==='biometric'?{biometrics:unavailableBiometric(code)}:{})}));continue;}
    let reservation=null,dispatched=false,observed=false,latestUsage=null;
    try{
     // An unresolved previous paid attempt wins before any private source read.
     if(kind==='ocr'){
      const held=await update(ref,claimId,async(client,r)=>{const pending=await usage.resourcePending(client,r.member,resource(r.a,r.k));if(pending){await write(client,r,{...r.processing,stages:{...r.processing.stages,ocr:{state:'HELD',code:'ORGANIZATION_USAGE_RESULT_PENDING'}},usage:pending});return true;}return false;});if(held)continue;
     }
     if(!front)front=await bytes(claim.k.images.find(i=>i.id==='document-front'));
     // A reclaimed independent stage must still own the current source after
     // storage I/O, before reading its next image or dispatching either engine.
     await update(ref,claimId,async()=>{});
     let result;
     if(kind==='ocr'){
      result=await analyzer.analyzeDni({base64:front.buffer.toString('base64'),mimeType:front.mimeType,
       beforeDispatch:async({requestedModel,endpoint})=>{if(requestedModel!=='gpt-4o'||endpoint!=='chat.completions')fail('ORGANIZATION_USAGE_BINDING_REJECTED');await update(ref,claimId,async(client,r)=>{
        reservation=await usage.reserveResource(client,r.member,{version:2,...resource(r.a,r.k),operationId:r.a.operationId,requestDigest:stableDigest(r.a),consentVersion:r.k.ocrConsent.noticeVersion,requestedModel});latestUsage=reservation.usage||null;
        if(reservation.done||reservation.deferred)fail(reservation.code||'ORGANIZATION_USAGE_ALREADY_DISPATCHED');
        const fenced=await usage.fence(client,r.member,reservation.capability);if(fenced.deferred)fail(fenced.code);
        await write(client,r,{...r.processing,stages:{...r.processing.stages,ocr:{state:'DISPATCHED'}},usage:{...latestUsage,state:'DISPATCHED'}});
       });dispatched=true;},
       observeUsage:async fact=>{latestUsage=await usage.observe(reservation.capability,fact);observed=true;},
       dispatchUnknown:async()=>{if(dispatched)latestUsage=await usage.unknown(reservation.capability);}
      });
      if(result?.success===true&&(!dispatched||!observed))fail('ORGANIZATION_USAGE_UNCONFIRMED');
      const normalized=result?.success===true?normalizeDniExtraction(result):null,fields=normalized?.success?{nombreCompleto:normalized.nombreCompleto,dni:normalized.dni,cuil:normalized.cuil}:null;
      await update(ref,claimId,(client,r)=>write(client,r,{...r.processing,stages:{...r.processing.stages,ocr:{state:!dispatched&&result?.code==='AI_PROVIDER_NOT_CONFIGURED'?'WAITING_CONFIGURATION':dispatched&&!observed?'DISPATCHED':fields?'COMPLETE':'FAILED',...(fields?{}:{code:safeCode(result?.code||normalized?.code)})}},...(fields?{fields,provider:'openai',providerModel:'gpt-4o'}:{}),...(latestUsage?{usage:latestUsage}:{})}));
     }else{
      const selfie=await bytes(claim.k.images.find(i=>i.id==='selfie'));
      // The durable one-way fence precedes the private endpoint call as well.
      await update(ref,claimId,(client,r)=>write(client,r,{...r.processing,stages:{...r.processing.stages,biometric:{state:'DISPATCHED'}}}));dispatched=true;
      result=await assessBiometrics({front,selfie,consentVersion:claim.k.biometricConsent.noticeVersion});
      const advisory=biometricResult(result,claim.k),unconfirmed=!advisory&&['BIOMETRIC_SERVICE_UNCONFIRMED','BIOMETRIC_RESULT_UNCONFIRMED'].includes(result?.code);
      await update(ref,claimId,(client,r)=>write(client,r,{...r.processing,stages:{...r.processing.stages,biometric:{state:unconfirmed?'DISPATCHED':advisory?'COMPLETE':'FAILED',...(advisory?{}:{code:safeCode(result?.code)})}},biometrics:advisory||unavailableBiometric(safeCode(result?.code))}));
     }
    }catch(error){
     if(error instanceof WorkspaceError&&['PARTICIPANT_ANALYSIS_SOURCE_CHANGED','PARTICIPANT_ANALYSIS_LEASE_CHANGED'].includes(error.code))throw error;
     const code=safeCode(error?.code),held=code.startsWith('ORGANIZATION_USAGE_')&&!dispatched,uncertain=dispatched;
     await update(ref,claimId,(client,r)=>write(client,r,{...r.processing,stages:{...r.processing.stages,[kind]:{state:uncertain?'DISPATCHED':held?'HELD':'FAILED',code}},...(latestUsage?{usage:latestUsage}:{})}));
    }
   }
   return finalize(ref,claimId);
  },
  async recover({limit=1,budgetMs=160000}={}){
   if(!Number.isInteger(limit)||limit<1||limit>5||!Number.isInteger(budgetMs)||budgetMs<0||budgetMs>240000)fail('PARTICIPANT_ANALYSIS_REFERENCE_INVALID',400);
   if(budgetMs<leaseMs+5000)return {durable:true,checked:0,results:[],deferred:true};
   const refs=await within(async client=>(await client.query(`SELECT id AS "workerId","projectId",metadata->'participant'->'kyc'->>'submissionId' AS "submissionId" FROM public."Worker" WHERE active=true AND metadata->'participant'->>'status' IN ('INVITED','ACTIVE') AND metadata->'participant'->'kyc'->>'status' IN ('PENDING_REVIEW','PENDING_ACCOUNT_CLAIM') AND metadata->'participant'->'kyc'->'processing'->>'automatic'='true' AND (metadata->'participant'->'kyc'->'processing'->>'status' IN ('QUEUED','WAITING_CONFIGURATION') OR metadata->'participant'->'kyc'->'processing'->>'status'='RUNNING' AND COALESCE(metadata->'participant'->'kyc'->'processing'->>'expiresAt','')<=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') OR metadata->'participant'->'kyc'->'processing'->>'status'='USAGE_HELD' AND metadata->'participant'->'kyc'->'processing'->>'code'='ORGANIZATION_USAGE_COVERAGE_EXPIRED' OR metadata->'participant'->'kyc'->'processing'->>'status'='UNCERTAIN' AND (metadata->'participant'->'kyc'->'processing'->'stages'->'ocr'->>'state' IN ('PENDING','WAITING_CONFIGURATION') OR metadata->'participant'->'kyc'->'processing'->'stages'->'biometric'->>'state' IN ('PENDING','WAITING_CONFIGURATION') OR metadata->'participant'->'kyc'->'processing'->'stages'->'ocr'->>'state'='HELD' AND metadata->'participant'->'kyc'->'processing'->'stages'->'ocr'->>'code'='ORGANIZATION_USAGE_COVERAGE_EXPIRED')) AND (metadata->'participant'->'kyc'->'processing'->>'nextCheckAt' IS NULL OR metadata->'participant'->'kyc'->'processing'->>'nextCheckAt'<=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY "updatedAt",id LIMIT $1`,[limit*5])).rows);
   const started=Date.now(),results=[];let completed=0;
   for(const ref of refs){if(completed>=limit||Date.now()-started>budgetMs-leaseMs-5000)break;try{const result=await this.process(ref);results.push(result);if(result.state!=='RUNNING')completed++;}catch(error){
    const code=error instanceof WorkspaceError?error.code:'PARTICIPANT_ANALYSIS_UNCONFIRMED';results.push({automatic:true,processed:false,code});
    // A failed authority proof grants no processing authority. Back off only
    // this exact queued reference; never alter its identity, source or decision.
    await within(async client=>{const rows=(await client.query(`SELECT id,"projectId",active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[ref.workerId,ref.projectId])).rows,row=rows[0],p=row?.metadata?.participant?.kyc?.processing;if(rows.length!==1||row.metadata?.participant?.kyc?.submissionId!==ref.submissionId||p?.automatic!==true||p.auto?.mode!==KYC_PREANALYSIS_MODE||p.auto.submissionId!==ref.submissionId||!['QUEUED','RUNNING','WAITING_CONFIGURATION','USAGE_HELD','UNCERTAIN'].includes(p.status))return;const at=await now(client),metadata=structuredClone(row.metadata);metadata.participant.kyc.processing={...p,nextCheckAt:new Date(at.getTime()+300000).toISOString(),recoveryCode:code};await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,ref.projectId,JSON.stringify(metadata)]);}).catch(()=>{});
   }}
   return {durable:true,checked:results.length,results};
  }
 };
}
