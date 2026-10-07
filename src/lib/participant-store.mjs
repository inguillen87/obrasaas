import {EMPLOYEE_INTAKE_ACTIONS,readEmployeeIntake,saveEmployeeIntake,employeeIntakeOutcome,employeeIntakeAcceptedPermissions} from './meta-employee-intake.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {WorkspaceError,workspaceId,operationId,digest,requireWorkspaceIdentity,WORKSPACE_ROLES} from './workspace-policy.mjs';
import {participantManager,participantCommand,participantContext,participantKycInput,participantReceiptId,PARTICIPANT_NOTICE,PARTICIPANT_NOTICE_VERSION,PARTICIPANT_OCR_NOTICE,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE,PARTICIPANT_BIOMETRIC_NOTICE_VERSION,assertOwnParticipant,participantKeys,OFFICE_ROLES} from './participant-policy.mjs';
import {invalidateWorkerChannelIdentity} from './worker-channel-identity.mjs';
import {PRIVATE_BANK_ACTIONS} from './participant-bank-format.mjs';
import {PRIVATE_BANK_RECEIPT_KIND,readPrivateBankAccount,privateBankStatus,savePrivateBankAccount} from './participant-bank-account.mjs';
import {normalizeDniExtraction} from './pilot-media.mjs';
import {adoptParticipantChannelKyc} from './participant-channel-kyc.mjs';
const columns=`id,name,active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
const id=prefix=>prefix+'_'+randomUUID().replaceAll('-','');
const metadata=row=>row.metadata&&typeof row.metadata==='object'&&!Array.isArray(row.metadata)?structuredClone(row.metadata):{};
function publicParticipant(row,own=false,reviewer=false){const p=row.metadata?.participant,k=p?.kyc,processing=k?.processing;return {id:row.id,name:row.name,active:row.active,revision:row.revision,status:p?.status||'NOT_INVITED',self:own,accountLinked:Boolean(p?.clerkUserId),invitation:p?.invitation?{id:p.invitation.id,state:p.invitation.state,email:own?undefined:p.invitation.email,expiresAt:p.invitation.expiresAt,expired:Date.parse(p.invitation.expiresAt)<Date.now()}:null,kyc:{status:k?.status||'NOT_SUBMITTED',submissionId:k?.submissionId||null,submittedAt:k?.submittedAt||null,review:k?.review?{decision:k.review.decision,reason:k.review.reason,recordedAt:k.review.recordedAt}:null,ocrConsent:{allowed:k?.ocrConsent?.allowed===true,noticeVersion:k?.ocrConsent?.noticeVersion||null},biometricConsent:{allowed:k?.biometricConsent?.allowed===true,noticeVersion:k?.biometricConsent?.noticeVersion||null},processing:processing?{status:processing.status,code:processing.code||null,expiresAt:processing.status==='RUNNING'?processing.expiresAt:null,requiresHumanReview:true,...(reviewer&&processing.status==='EXTRACTED_UNVERIFIED'?{fields:processing.fields}:{}),...(reviewer&&processing.biometrics?{biometrics:processing.biometrics}:{})}:null,images:Array.isArray(k?.images)?k.images.map(image=>({id:image.id,kind:image.kind,contentType:image.contentType,bytes:image.bytes})):[]},permissions:p?.status==='ACTIVE'?p.permissions:{attendance:false,report:false},identityCertified:false,whatsAppAccessGranted:false};}
async function worker(client,projectId,workerId,lock=false){const row=(await client.query(`SELECT ${columns} FROM public."Worker" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[workerId,projectId])).rows[0];if(!row)throw new WorkspaceError('PARTICIPANT_UNAVAILABLE',404);return row;}
async function writeWorker(client,projectId,row,value){await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,projectId,JSON.stringify(value)]);return worker(client,projectId,row.id);}
const accountColumns=`tm.id AS "membershipId",tm."userId",u."clerkUserId",u."primaryEmail" AS email,COALESCE(u."fullName",u."primaryEmail") AS name,tm."tenantRole"::text AS role,tm."clerkRole",tm.status::text AS status,to_char(tm."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
function publicAccount(row,actorId){return {membershipId:row.membershipId,name:row.name||'Cuenta de la empresa',email:row.email,role:row.role,roleLabel:OFFICE_ROLES[row.role]?.label||WORKSPACE_ROLES[row.role],roleScope:OFFICE_ROLES[row.role]?.scope||'Administra la empresa. Este acceso protegido no se modifica desde esta sección.',revision:row.revision,status:row.status,self:row.userId===actorId,canChangeRole:row.status==='ACTIVE'&&row.role!=='ADMIN'&&row.clerkRole!=='org:admin'&&row.userId!==actorId};}
async function account(client,organizationId,membershipId,lock=false){const row=(await client.query(`SELECT ${accountColumns} FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm.id=$1 AND tm."organizationId"=$2 ${lock?'FOR UPDATE OF tm':''}`,[membershipId,organizationId])).rows[0];if(!row)throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);return row;}
async function receipt(client,member,key){return (await client.query(`SELECT id,"organizationId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='participant.operation.recorded'`,[key,member.organizationId,member.actorId])).rows[0];}
async function record(client,member,key,projectId,entityId,requestDigest,details,entityType='Worker'){await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded',$4,$5,$6::jsonb)`,[key,member.organizationId,member.actorId,entityType,entityId,JSON.stringify({version:1,projectId,requestDigest,...details})]);}
async function currentOutcome(client,projectId,found,replayed,actorId){if(found?.metadata?.projectId!==projectId)throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);const value={saved:true,replayed,receiptId:found.id};if(found.entityType==='TenantMembership'&&found.metadata.kind==='OFFICE_ROLE_CHANGED')return {...value,account:publicAccount(await account(client,found.organizationId,found.entityId),actorId)};return {...value,participant:publicParticipant(await worker(client,projectId,found.entityId))};}
async function ownKycReplayOutcome(client,member,session,input,found,fingerprint,{lock=false}={}){
 if(found.metadata?.requestDigest!==fingerprint)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);
 if(found.entityType!=='Worker'||found.entityId!==input.workerId||found.metadata?.kind!=='KYC_SUBMITTED'||found.metadata.projectId!==input.projectId)throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);
 // A receipt proves an earlier write, not current permission to private KYC.
 // Recheck ownership even when office access to the project remains active.
 await assertOwnParticipant(client,member,session,input.projectId,input.workerId,{lock});
 return currentOutcome(client,input.projectId,found,true);
}
function requireManager(member){if(!participantManager(member.role))throw new WorkspaceError('PARTICIPANT_MANAGE_REQUIRED',403);}
function matchProvider(invitation,result){if(!result||result.invitationId!==invitation.id||result.email!==invitation.email||result.role!=='org:member'||!/^orginv_[A-Za-z0-9]+$/.test(result.id||'')||!['pending','accepted'].includes(result.state)||!Number.isFinite(Date.parse(result.expiresAt)))throw new WorkspaceError('PARTICIPANT_INVITATION_UNCONFIRMED',503);}
export function createParticipantStore({workspace,connect,identity,upload,get,analyzer,prepareKycChat,assessBiometrics,environment=process.env}){
 const run=(session,input,writable,callback)=>workspace.projectOperation(session,input,writable,callback);
 const organizationRun=(session,input,writable,callback)=>workspace.organizationOperation(session,input,writable,callback);
 async function privateKycBytes(image){
  let result;try{const url=new URL(image.url);if(url.protocol!=='https:'||! /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.port||url.search||url.hash||url.username||url.password||! /^\/obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.(png|jpg|webp)$/.test(url.pathname)||!Number.isInteger(image.bytes)||image.bytes<1||image.bytes>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(image.contentType)||!/^[a-f0-9]{64}$/.test(image.sha256||''))throw new Error();result=await get(url.pathname.slice(1),{access:'private',useCache:false,abortSignal:AbortSignal.timeout(15000)});if(result?.statusCode!==200||result.blob?.url!==image.url||result.blob.size!==image.bytes||result.blob.contentType?.split(';')[0]!==image.contentType)throw new Error();}catch{await result?.stream?.cancel?.().catch(()=>{});throw new WorkspaceError('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}
  const reader=result.stream.getReader(),chunks=[];let bytes=0;
  try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>image.bytes||bytes>2*1024*1024)throw new Error();chunks.push(Buffer.from(next.value));}const buffer=Buffer.concat(chunks);if(bytes!==image.bytes||createHash('sha256').update(buffer).digest('hex')!==image.sha256)throw new Error();return {bytes:buffer,contentType:image.contentType};}
  catch{throw new WorkspaceError('PARTICIPANT_KYC_INTEGRITY',409);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 function ocrParticipant(row,session,submissionId,{pending=false}={}){
  const part=row.metadata?.participant,k=part?.kyc;
  if(!row.active||part?.version!==1||part.status!=='ACTIVE')throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
  if(part.clerkUserId===session.userId)throw new WorkspaceError('PARTICIPANT_SELF_REVIEW_REJECTED',403);
  if(k?.submissionId!==submissionId||!['PENDING_REVIEW','APPROVED','REJECTED'].includes(k.status)||(pending&&k.status!=='PENDING_REVIEW'))throw new WorkspaceError('PARTICIPANT_KYC_NOT_PENDING',409);
  return k;
 }
 async function ocrOutcome(client,member,session,input,found,requestDigest){
  requireManager(member);const p=input.payload||input;
  if(found.entityType!=='Worker'||found.entityId!==p.workerId||found.metadata?.kind!=='PROCESS_KYC'||found.metadata.projectId!==input.projectId)throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);
  if(requestDigest&&found.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);
  const row=await worker(client,input.projectId,p.workerId),k=ocrParticipant(row,session,p.submissionId);
  if(k.contentHash!==found.metadata.contentHash)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);
  return {saved:true,replayed:true,receiptId:found.id,participant:publicParticipant(row,false,true)};
 }
 async function processKyc(session,input){
  const p=input.payload,requestDigest=digest(input);
  const claim=await run(session,input,true,async(client,member,scope)=>{
   requireManager(member);const key=participantReceiptId(member.actorId,input.projectId,input.operationId);
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
   const prior=await receipt(client,member,key);if(prior)return {done:{scope,...await ocrOutcome(client,member,session,input,prior,requestDigest)}};
   const row=await worker(client,input.projectId,p.workerId,true),k=ocrParticipant(row,session,p.submissionId,{pending:true});
   const ocrAllowed=k.ocrConsent?.allowed===true&&k.ocrConsent.noticeVersion===PARTICIPANT_OCR_NOTICE_VERSION&&k.ocrConsent.noticeSha256===digest(PARTICIPANT_OCR_NOTICE),biometricAllowed=k.biometricConsent?.allowed===true&&k.biometricConsent.noticeVersion===PARTICIPANT_BIOMETRIC_NOTICE_VERSION&&k.biometricConsent.noticeSha256===digest(PARTICIPANT_BIOMETRIC_NOTICE);
   if(!ocrAllowed&&!biometricAllowed)throw new WorkspaceError('PARTICIPANT_OCR_CONSENT_REQUIRED',409);
   const submitted=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND metadata->>'submissionId'=$3`,[member.organizationId,row.id,p.submissionId])).rows;
   if(submitted.length!==1||submitted[0].metadata.contentHash!==k.contentHash||!Array.isArray(k.images)||k.images.length!==2||k.images.filter(image=>image.id==='document-front'&&image.kind==='DOCUMENT_FRONT').length!==1||k.images.filter(image=>image.id==='selfie'&&image.kind==='SELFIE').length!==1||digest(k.images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType]))!==k.contentHash)throw new WorkspaceError('PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED',409);
   const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now,previous=k.processing;
   if(previous?.status==='RUNNING'&&Date.parse(previous.expiresAt)>now.getTime()){
    if(previous.operationId!==input.operationId||previous.actorId!==member.actorId||previous.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OCR_PROCESSING',409);
    return {done:{scope,state:'PROCESSING',definitive:false,workerId:row.id,submissionId:k.submissionId,expiresAt:previous.expiresAt,retryAfterExpiration:false}};
   }
   const sameClaim=previous?.status==='RUNNING'&&previous.operationId===input.operationId&&previous.actorId===member.actorId&&previous.requestDigest===requestDigest;
   if(row.revision!==p.revision&&!sameClaim)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);
   if(['EXTRACTED_UNVERIFIED','ADVISORY_UNREVIEWED'].includes(previous?.status))throw new WorkspaceError('PARTICIPANT_OCR_ALREADY_PROCESSED',409);
   const claimId=id('ocrclaim'),m=metadata(row);m.participant.kyc.processing={status:'RUNNING',claimId,operationId:input.operationId,requestDigest,actorId:member.actorId,startedAt:now.toISOString(),expiresAt:new Date(now.getTime()+(biometricAllowed?150000:90000)).toISOString()};
   const updated=await writeWorker(client,input.projectId,row,m);
   return {key,claimId,actorId:member.actorId,revision:updated.revision,contentHash:k.contentHash,front:k.images.find(image=>image.id==='document-front'),selfie:biometricAllowed?k.images.find(image=>image.id==='selfie'):null,biometricAllowed,ocrAllowed};
  });
  if(claim.done)return claim.done;
  let extraction,code,provenance,biometrics,frontImage;
  const checkClaim=()=>run(session,input,false,async(client,member)=>{requireManager(member);const row=await worker(client,input.projectId,p.workerId),k=ocrParticipant(row,session,p.submissionId,{pending:true}),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;if(member.actorId!==claim.actorId||row.revision!==claim.revision||k.contentHash!==claim.contentHash||k.processing?.claimId!==claim.claimId||k.processing.status!=='RUNNING'||Date.parse(k.processing.expiresAt)<=now.getTime())throw new WorkspaceError('PARTICIPANT_OCR_PROCESSING_CHANGED',409);});
  const safeCodes=new Set(['AI_PROVIDER_NOT_CONFIGURED','AI_PROVIDER_REQUEST_REJECTED','MEDIA_IMAGE_INVALID','DNI_DOCUMENT_NOT_CONFIRMED','DNI_EXTRACTION_INCOMPLETE','AI_RESPONSE_UNCONFIRMED','AI_RESPONSE_INVALID','AI_REQUEST_UNCONFIRMED','PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED','PARTICIPANT_KYC_INTEGRITY']);
  try{
   const image=await privateKycBytes(claim.front);
   frontImage=image;
   // Recheck before the external transfer, as well as before persisting output.
   await checkClaim();
   if(claim.ocrAllowed){
    const result=analyzer?.analyzeDni?await analyzer.analyzeDni({base64:image.bytes.toString('base64'),mimeType:image.contentType}):{success:false,code:'AI_PROVIDER_NOT_CONFIGURED'};
    const normalized=result?.success===true?normalizeDniExtraction(result):null;
    if(normalized?.success){extraction={nombreCompleto:normalized.nombreCompleto,dni:normalized.dni,cuil:normalized.cuil};if(result.provider==='openai'&&/^(?:gpt-4o(?:-mini)?|gpt-4\.1(?:-mini|-nano)?|gpt-5(?:\.\d)?(?:-mini|-nano)?)(?:-\d{4}-\d{2}-\d{2})?$/.test(result.providerModel||''))provenance={provider:'openai',providerModel:result.providerModel};}
    else code=safeCodes.has(result?.code)?result.code:normalized?.code||'PARTICIPANT_OCR_UNCONFIRMED';
   }
  }catch(error){if(error instanceof WorkspaceError&&['PARTICIPANT_MANAGE_REQUIRED','PARTICIPANT_ACCESS_REQUIRED','PARTICIPANT_SELF_REVIEW_REJECTED','PARTICIPANT_KYC_NOT_PENDING','PARTICIPANT_OCR_PROCESSING_CHANGED','WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error.code))throw error;code=safeCodes.has(error?.code)?error.code:'PARTICIPANT_OCR_UNCONFIRMED';}
  if(claim.biometricAllowed){
   biometrics={status:'UNAVAILABLE',code:'BIOMETRIC_SERVICE_NOT_CONFIGURED',identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true};
   if(typeof assessBiometrics==='function'&&frontImage)try{
    const selfie=await privateKycBytes(claim.selfie);await checkClaim();
    const result=await assessBiometrics({front:{buffer:frontImage.bytes,mimeType:frontImage.contentType},selfie:{buffer:selfie.bytes,mimeType:selfie.contentType},consentVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION});
    if(result?.success===true&&result.status==='ADVISORY_UNREVIEWED'&&result.identityCertified===false&&result.livenessVerified===false&&result.documentAuthenticityVerified===false&&result.measurementCalibrated===false&&result.requiresHumanReview===true&&result.provider==='private-opencv-onnx'&&result.modelManifestSha256==='c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860'&&result.frontSha256===claim.front.sha256&&result.selfieSha256===claim.selfie.sha256&&Number.isFinite(result.faceSimilarity)&&result.faceSimilarity>=-1&&result.faceSimilarity<=1&&Number.isFinite(result.captureRiskSignal)&&result.captureRiskSignal>=0&&result.captureRiskSignal<=1)biometrics={status:'ADVISORY_UNREVIEWED',provider:result.provider,modelManifestSha256:result.modelManifestSha256,frontSha256:result.frontSha256,selfieSha256:result.selfieSha256,faceSimilarity:result.faceSimilarity,captureRiskSignal:result.captureRiskSignal,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true};
    else biometrics.code=['BIOMETRIC_SERVICE_NOT_CONFIGURED','BIOMETRIC_SERVICE_UNCONFIRMED','BIOMETRIC_RESULT_UNCONFIRMED','BIOMETRIC_IMAGE_INVALID','BIOMETRIC_INPUT_TOO_LARGE','BIOMETRIC_DISTINCT_CAPTURES_REQUIRED'].includes(result?.code)?result.code:'BIOMETRIC_RESULT_UNCONFIRMED';
   }catch(error){if(error instanceof WorkspaceError&&!['PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED','PARTICIPANT_KYC_INTEGRITY'].includes(error.code))throw error;biometrics.code='BIOMETRIC_RESULT_UNCONFIRMED';}
  }
  return run(session,input,true,async(client,member,scope)=>{
   requireManager(member);const prior=await receipt(client,member,claim.key);if(prior)return {scope,...await ocrOutcome(client,member,session,input,prior,requestDigest)};
   const row=await worker(client,input.projectId,p.workerId,true),k=ocrParticipant(row,session,p.submissionId,{pending:true});
   if(member.actorId!==claim.actorId||row.revision!==claim.revision||k.contentHash!==claim.contentHash||k.processing?.claimId!==claim.claimId||k.processing.status!=='RUNNING')throw new WorkspaceError('PARTICIPANT_OCR_PROCESSING_CHANGED',409);
   const completed=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
   if(Date.parse(k.processing.expiresAt)<=completed.getTime())throw new WorkspaceError('PARTICIPANT_OCR_PROCESSING_CHANGED',409);
   if(!extraction&&!code&&biometrics?.status==='UNAVAILABLE')code=biometrics.code;
   const completedAt=completed.toISOString(),status=extraction?'EXTRACTED_UNVERIFIED':biometrics?.status==='ADVISORY_UNREVIEWED'?'ADVISORY_UNREVIEWED':'FAILED_RETRYABLE',m=metadata(row);
   m.participant.kyc.processing={status,completedAt,adapter:'pilot-media-v1',...provenance,requiresHumanReview:true,identityVerified:false,...(extraction?{fields:extraction}:{code}),...(biometrics?{biometrics}:{})};
   await writeWorker(client,input.projectId,row,m);
   await record(client,member,claim.key,input.projectId,row.id,requestDigest,{kind:'PROCESS_KYC',submissionId:p.submissionId,contentHash:claim.contentHash,status,code:code||null,adapter:'pilot-media-v1',...provenance,biometricStatus:biometrics?.status||null,identityCertified:false,livenessVerified:false});
   return {scope,saved:true,replayed:false,receiptId:claim.key,participant:publicParticipant(await worker(client,input.projectId,row.id),false,true)};
  });
 }
 async function setOfficeRole(session,input,requestDigest){const context={projectId:input.projectId,scope:input.scope},p=input.payload;
  const target=await organizationRun(session,context,false,async(client,member,scope)=>{const prior=await receipt(client,member,participantReceiptId(member.actorId,input.projectId,input.operationId));if(prior){if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);return {done:{scope,...await currentOutcome(client,input.projectId,prior,true,member.actorId)}};}const current=await account(client,member.organizationId,p.membershipId);if(!publicAccount(current,member.actorId).canChangeRole)throw new WorkspaceError('PARTICIPANT_OFFICE_ROLE_PROTECTED',403);if(current.revision!==p.revision)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);return current;});
  if(target.done)return target.done;
  const proof=await identity.verifyMembership({userId:target.clerkUserId,organizationId:session.organizationId}),email=await identity.verifiedEmail(target.clerkUserId);if(proof.userId!==target.clerkUserId||proof.organizationId!==session.organizationId||proof.role!==target.clerkRole||email!==target.email.toLowerCase())throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
  return organizationRun(session,context,true,async(client,member,scope)=>{
   const key=participantReceiptId(member.actorId,input.projectId,input.operationId);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);const prior=await receipt(client,member,key);if(prior){if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);return {scope,...await currentOutcome(client,input.projectId,prior,true,member.actorId)};}
   // Exclude protected memberships before acquiring the target lock; two admins
   // cannot deadlock by trying to update each other's protected memberships.
   const current=(await client.query(`SELECT ${accountColumns} FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm.id=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' AND tm."tenantRole"<>'ADMIN' AND tm."clerkRole"<>'org:admin' AND tm."userId"<>$3 FOR UPDATE OF tm`,[p.membershipId,member.organizationId,member.actorId])).rows[0];
   if(!current)throw new WorkspaceError('PARTICIPANT_OFFICE_ROLE_PROTECTED',403);if(current.revision!==p.revision)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);if(current.clerkUserId!==proof.userId||current.clerkRole!==proof.role||current.email.toLowerCase()!==email)throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
   await client.query(`UPDATE public."TenantMembership" SET "tenantRole"=$3::"TenantRole","updatedAt"=clock_timestamp() WHERE id=$1 AND "organizationId"=$2`,[current.membershipId,member.organizationId,p.role]);await record(client,member,key,input.projectId,current.membershipId,requestDigest,{kind:'OFFICE_ROLE_CHANGED',before:{role:current.role,revision:current.revision},after:{role:p.role},reason:p.reason},'TenantMembership');return {scope,...await currentOutcome(client,input.projectId,await receipt(client,member,key),false,member.actorId)};
  });
 }
 async function finalizeInvitation(session,context,workerId,invitationId,result){return run(session,context,true,async(client,member,scope)=>{
  requireManager(member);const row=await worker(client,context.projectId,workerId,true),m=metadata(row),invite=m.participant?.invitation;
  if(!row.active||!invite||invite.id!==invitationId||m.participant.status==='REVOKED')throw new WorkspaceError('PARTICIPANT_INVITATION_REVOKED',409);
  const key=participantReceiptId(invite.createdBy,context.projectId,invite.operationId),prior=await receipt(client,{...member,actorId:invite.createdBy},key);
  if(prior)return {scope,...await currentOutcome(client,context.projectId,prior,true)};
  if(!['ATTEMPTED','UNCERTAIN','SENT'].includes(invite.state))throw new WorkspaceError('PARTICIPANT_INVITATION_UNCONFIRMED',503);matchProvider(invite,result);
  m.participant.invitation={...invite,state:'SENT',providerId:result.id,expiresAt:result.expiresAt};await writeWorker(client,context.projectId,row,m);
  await record(client,{...member,actorId:invite.createdBy},key,context.projectId,row.id,invite.requestDigest,{kind:'INVITATION_SENT',invitationId,providerId:result.id,deliveryConfirmed:false});
  return {scope,...await currentOutcome(client,context.projectId,await receipt(client,{...member,actorId:invite.createdBy},key),false)};
 });}
 async function joinTransaction(session,writable,callback){requireWorkspaceIdentity(session);if(session.organizationRole!=='org:member')throw new WorkspaceError('PARTICIPANT_MEMBER_SESSION_REQUIRED',403);let client,broken=false;
  try{client=await connect();await client.query(writable?'BEGIN ISOLATION LEVEL READ COMMITTED':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query("SET LOCAL statement_timeout='6s'");await client.query("SET LOCAL lock_timeout='2500ms'");const value=await callback(client);await client.query(writable?'COMMIT':'ROLLBACK');return value;}
  catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('PARTICIPANT_OPERATION_UNCONFIRMED',503);}finally{client?.release(broken);}}
 async function invitedWorker(client,session,invitationId,lock=false){
  const query=`SELECT w.id,w.name,w.active,w.metadata,w."projectId",o.id AS "organizationId",p.name AS "projectName",o.name AS "organizationName",o."clerkOrganizationId",to_char(w."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Worker" w JOIN public."Project" p ON p.id=w."projectId" JOIN public."Organization" o ON o.id=p."organizationId" WHERE o."clerkOrganizationId"=$1 AND p.status='ACTIVE' AND COALESCE(o.metadata->'internal','false'::jsonb)<>'true'::jsonb AND w.metadata->'participant'->'invitation'->>'id'=$2`;
  let rows=(await client.query(query,[session.organizationId,invitationId])).rows;
  if(lock){
   if(rows.length!==1||!rows[0].active)throw new WorkspaceError('PARTICIPANT_INVITATION_UNAVAILABLE',404);const candidate=rows[0];
   // The caller already holds canonical user/membership locks. Acquire project
   // and then worker explicitly; a joined lock does not guarantee this order.
   const project=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR UPDATE`,[candidate.projectId,candidate.organizationId])).rows[0];if(!project)throw new WorkspaceError('PARTICIPANT_INVITATION_UNAVAILABLE',404);
   const locked=(await client.query(`SELECT id FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[candidate.id,candidate.projectId])).rows[0];if(!locked)throw new WorkspaceError('PARTICIPANT_INVITATION_UNAVAILABLE',404);
   // Re-read the complete invitation/organization predicate after both locks,
   // including the uniqueness check and any revocation while waiting.
   rows=(await client.query(query,[session.organizationId,invitationId])).rows;if(rows.length!==1||rows[0].id!==candidate.id||rows[0].projectId!==candidate.projectId||rows[0].organizationId!==candidate.organizationId)throw new WorkspaceError('PARTICIPANT_INVITATION_UNAVAILABLE',404);
  }
  if(rows.length!==1||!rows[0].active)throw new WorkspaceError('PARTICIPANT_INVITATION_UNAVAILABLE',404);const row=rows[0],invite=row.metadata?.participant?.invitation;
  if(row.metadata.participant.status==='REVOKED'||invite.state==='REVOKED')throw new WorkspaceError('PARTICIPANT_INVITATION_REVOKED',403);
  return row;
 }
 async function acceptedInvitation(client,session,row){
  const part=row.metadata?.participant,invite=part?.invitation;
  if(part?.clerkUserId!==session.userId)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
  const members=(await client.query(`SELECT tm.id AS "membershipId",u.id AS "actorId" FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm."organizationId"=$1 AND u."clerkUserId"=$2 AND tm.status='ACTIVE' AND tm."clerkRole"=$3`,[row.organizationId,session.userId,session.organizationRole])).rows;
  if(members.length!==1)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
  const member={...members[0],organizationId:row.organizationId};await assertOwnParticipant(client,member,session,row.projectId,row.id);
  const found=typeof part.acceptanceReceiptId==='string'?await receipt(client,member,part.acceptanceReceiptId):null;
  if(!found||found.entityType!=='Worker'||found.entityId!==row.id||found.metadata?.version!==1||found.metadata.projectId!==row.projectId||found.metadata.kind!=='INVITATION_ACCEPTED'||found.metadata.invitationId!==invite?.id||invite.state!=='ACCEPTED')throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);
  return {invitationId:invite.id,projectId:row.projectId,projectName:row.projectName,organizationName:row.organizationName,participantName:row.name,state:'ACTIVE',canAccept:false,saved:true,joined:true,replayed:true,receiptId:found.id,identityCertified:false,whatsAppAccessGranted:false};
 }
 return {
  read(session,context){participantContext(context);if(context.after!==undefined&&context.after!==null&&!workspaceId(context.after)||context.intakeAfter&&!/^customer_webhook_[a-f0-9]{64}$/.test(context.intakeAfter))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');return run(session,context,false,async(client,member,scope)=>{
   const manage=participantManager(member.role);const records=(await client.query(`SELECT ${columns} FROM public."Worker" WHERE "projectId"=$1 AND ($2::boolean OR (metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE' AND active=true)) AND ($4::text IS NULL OR id>$4) ORDER BY id LIMIT 101`,[context.projectId,manage,session.userId,context.after||null])).rows;
   const accounts=member.role==='ADMIN'?(await client.query(`SELECT ${accountColumns} FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm."organizationId"=$1 AND tm.status='ACTIVE' ORDER BY tm.id LIMIT 101`,[member.organizationId])).rows:[];
    return {scope,projectId:context.projectId,canManage:manage,canInvite:member.role==='ADMIN'&&session.organizationRole==='org:admin',canManageOfficeRoles:member.role==='ADMIN',officeRoles:OFFICE_ROLES,existingAccounts:accounts.slice(0,100).map(row=>publicAccount(row,member.actorId)),existingAccountsTruncated:accounts.length>100,records:records.slice(0,100).map(row=>publicParticipant(row,row.metadata?.participant?.clerkUserId===session.userId,manage)),nextCursor:records.length>100?records[99].id:null,privacyNotice:{version:PARTICIPANT_NOTICE_VERSION,text:PARTICIPANT_NOTICE,sha256:digest(PARTICIPANT_NOTICE)},externalOcrNotice:{version:PARTICIPANT_OCR_NOTICE_VERSION,text:PARTICIPANT_OCR_NOTICE},privateBiometricNotice:{version:PARTICIPANT_BIOMETRIC_NOTICE_VERSION,text:PARTICIPANT_BIOMETRIC_NOTICE},employeeIntake:await readEmployeeIntake(client,member,context.projectId,environment,context.intakeAfter||null),noAutomaticKycApproval:true};
  });},
  privateBankRead(session,input){participantContext(input);return run(session,input,false,(client,member,scope)=>readPrivateBankAccount(client,member,session,input,scope,{environment}));},
  privateBankStatus(session,input){participantContext(input);return run(session,input,false,(client,member,scope)=>privateBankStatus(client,member,session,input,scope));},
  async save(session,body){const input=participantCommand(body),context={projectId:input.projectId,scope:input.scope},p=input.payload;
   if(PRIVATE_BANK_ACTIONS.includes(input.action)||input.action==='CANCEL_PENDING_PRIVATE_BANK_ACCOUNT')return run(session,context,true,(client,member,scope)=>savePrivateBankAccount(client,member,session,input,scope,{environment}));
   if(EMPLOYEE_INTAKE_ACTIONS.includes(input.action))return run(session,context,true,(client,member,scope,project)=>saveEmployeeIntake(client,member,scope,project,session,input,environment));
   const requestDigest=digest(input);
   if(input.action==='SET_OFFICE_ROLE')return setOfficeRole(session,input,requestDigest);
   if(input.action==='PROCESS_KYC')return processKyc(session,input);
   if(input.action==='PREPARE_KYC_CHAT')return run(session,input,true,async(client,member,scope,project)=>{
    requireManager(member);if(typeof prepareKycChat!=='function')throw new WorkspaceError('PARTICIPANT_CHANNEL_ADAPTER_UNAVAILABLE',503);
    const key=participantReceiptId(member.actorId,input.projectId,input.operationId);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
    const row=await worker(client,input.projectId,p.workerId,true);if(!row.active||!['INVITED','ACTIVE'].includes(row.metadata?.participant?.status))throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);
    const prior=await receipt(client,member,key);if(prior){if(prior.metadata.requestDigest!==requestDigest||prior.entityId!==row.id||prior.metadata.kind!=='PREPARE_KYC_CHAT')throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);return {scope,...await currentOutcome(client,input.projectId,prior,true),kind:'PREPARE_KYC_CHAT',codeUnavailable:true,expiresAt:prior.metadata.expiresAt};}
    const value=await prepareKycChat(client,member,project,{operationId:input.operationId,...p});
    await record(client,member,key,input.projectId,row.id,requestDigest,{kind:'PREPARE_KYC_CHAT',challengeReceiptId:value.receiptId,expiresAt:value.expiresAt,identityCertified:false,permissionsGranted:false});
    return {scope,...value,receiptId:key,participant:publicParticipant(await worker(client,input.projectId,row.id))};
   });
   const recorded=await run(session,context,false,async(client,member,scope)=>{requireManager(member);const prior=await receipt(client,member,participantReceiptId(member.actorId,input.projectId,input.operationId));if(!prior)return null;if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);return {scope,...await currentOutcome(client,input.projectId,prior,true)};});if(recorded)return recorded;
   let restoration=null;
   if(input.action==='RESTORE_ACCESS'){
    const target=await run(session,context,false,async(client,member)=>{requireManager(member);const row=await worker(client,input.projectId,p.workerId),part=row.metadata?.participant;if(!row.active||part?.status!=='REVOKED'||!part.clerkUserId)throw new WorkspaceError('PARTICIPANT_REACTIVATION_REVIEW_REQUIRED',409);const current=(await client.query(`SELECT tm."clerkRole",u."clerkUserId" FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=tm.id WHERE pm."projectId"=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' AND u."clerkUserId"=$3`,[input.projectId,member.organizationId,part.clerkUserId])).rows;if(current.length!==1)throw new WorkspaceError('PARTICIPANT_REACTIVATION_REVIEW_REQUIRED',409);return current[0];});
    restoration=await identity.verifyMembership({userId:target.clerkUserId,organizationId:session.organizationId});if(restoration.role!==target.clerkRole)throw new WorkspaceError('PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',403);
   }
   if(input.action==='ASSIGN_EXISTING'){
    const target=await run(session,context,false,async(client,member)=>{if(member.role!=='ADMIN')throw new WorkspaceError('PARTICIPANT_INVITE_REQUIRED',403);const rows=(await client.query(`SELECT tm.id,u."clerkUserId",u."primaryEmail",tm."clerkRole" FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm.id=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE'`,[p.membershipId,member.organizationId])).rows;if(rows.length!==1)throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);return rows[0];});
    const proof=await identity.verifyMembership({userId:target.clerkUserId,organizationId:session.organizationId});const email=await identity.verifiedEmail(target.clerkUserId);if(proof.role!==target.clerkRole||typeof email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||target.primaryEmail!==null&&(typeof target.primaryEmail!=='string'||email!==target.primaryEmail.toLowerCase()))throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
    return run(session,context,true,async(client,member,scope)=>{if(member.role!=='ADMIN')throw new WorkspaceError('PARTICIPANT_INVITE_REQUIRED',403);const key=participantReceiptId(member.actorId,input.projectId,input.operationId),prior=await receipt(client,member,key);if(prior){if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);return {scope,...await currentOutcome(client,input.projectId,prior,true)};}
     const current=(await client.query(`SELECT tm.id,u."clerkUserId",u."primaryEmail",tm."clerkRole" FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm.id=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' FOR SHARE OF tm,u`,[p.membershipId,member.organizationId])).rows;if(current.length!==1||current[0].clerkUserId!==target.clerkUserId||current[0].clerkRole!==proof.role||current[0].primaryEmail!==target.primaryEmail||current[0].primaryEmail!==null&&current[0].primaryEmail.toLowerCase()!==email)throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
     const row=await worker(client,input.projectId,p.workerId,true),m=metadata(row);if(row.revision!==p.revision)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);if(!row.active||m.siteRegister?.version!==1)throw new WorkspaceError('PARTICIPANT_ROSTER_REVIEW_REQUIRED',409);if(m.participant?.clerkUserId||['INVITED','ACTIVE'].includes(m.participant?.status))throw new WorkspaceError('PARTICIPANT_ALREADY_INVITED',409);
     const duplicates=(await client.query(`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND id<>$2 AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE'`,[input.projectId,row.id,target.clerkUserId])).rows;if(duplicates.length)throw new WorkspaceError('PARTICIPANT_IDENTITY_CONFLICT',409);
     const acceptedPermissions=await employeeIntakeAcceptedPermissions(client,row,{organizationId:member.organizationId,projectId:input.projectId});const pm=(await client.query(`SELECT id FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 FOR UPDATE`,[input.projectId,target.id])).rows[0];if(pm)await client.query(`UPDATE public."ProjectMembership" SET status='ACTIVE',"updatedAt"=clock_timestamp() WHERE id=$1`,[pm.id]);else await client.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',clock_timestamp())`,[id('projectmember'),input.projectId,target.id]);
     m.participant={version:1,status:'ACTIVE',clerkUserId:target.clerkUserId,permissions:acceptedPermissions,invitation:null,acceptanceReceiptId:key,kyc:{version:1,status:'NOT_SUBMITTED'}};await writeWorker(client,input.projectId,row,m);await record(client,member,key,input.projectId,row.id,requestDigest,{kind:'EXISTING_ACCOUNT_ASSIGNED',membershipId:target.id,reason:p.reason,identityCertified:false,whatsAppAccessGranted:false});return {scope,...await currentOutcome(client,input.projectId,await receipt(client,member,key),false)};
    });
   }
   if(input.action==='RECOVER_INVITATION'){
    const invite=await run(session,context,false,async(client,member)=>{requireManager(member);const row=await worker(client,input.projectId,p.workerId);const invite=row.metadata?.participant?.invitation;if(!invite||invite.id!==p.invitationId||row.metadata.participant.status==='REVOKED')throw new WorkspaceError('PARTICIPANT_INVITATION_UNAVAILABLE',404);return {...invite,organizationId:session.organizationId};});
    const found=await identity.findInvitation({organizationId:session.organizationId,invitationId:invite.id});if(!found)throw new WorkspaceError('PARTICIPANT_INVITATION_UNCONFIRMED',503);return finalizeInvitation(session,context,p.workerId,invite.id,found);
   }
   const prepared=await run(session,context,true,async(client,member,scope)=>{
    requireManager(member);const key=participantReceiptId(member.actorId,input.projectId,input.operationId),prior=await receipt(client,member,key);
    if(prior){if(prior.metadata.requestDigest!==requestDigest)throw new WorkspaceError('PARTICIPANT_OPERATION_CONFLICT',409);return {done:{scope,...await currentOutcome(client,input.projectId,prior,true)}};}
    const row=await worker(client,input.projectId,p.workerId,true),m=metadata(row);if(row.revision!==p.revision)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);
    if(input.action==='INVITE'){
     if(member.role!=='ADMIN'||session.organizationRole!=='org:admin')throw new WorkspaceError('PARTICIPANT_INVITE_REQUIRED',403);
     if(!row.active||m.siteRegister?.version!==1)throw new WorkspaceError('PARTICIPANT_ROSTER_REVIEW_REQUIRED',409);
     const existing=m.participant?.invitation;if(existing){if(existing.operationId===input.operationId&&existing.requestDigest===requestDigest)throw new WorkspaceError('PARTICIPANT_INVITATION_UNCONFIRMED',503);const retired=m.participant.status==='REVOKED'&&!m.participant.clerkUserId;const expired=m.participant.status==='INVITED'&&existing.state==='SENT'&&Date.parse(existing.expiresAt)<Date.now();if(!retired&&!expired)throw new WorkspaceError('PARTICIPANT_ALREADY_INVITED',409);}
     const duplicate=(await client.query(`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND id<>$3 AND metadata->'participant'->'invitation'->>'email'=$2 AND metadata->'participant'->>'status'<>'REVOKED' LIMIT 1`,[input.projectId,p.email,row.id])).rows;if(duplicate.length)throw new WorkspaceError('PARTICIPANT_EMAIL_ALREADY_INVITED',409);
     const invitation={id:id('invite'),email:p.email,state:'ATTEMPTED',providerId:null,expiresAt:new Date(Date.now()+7*86400000).toISOString(),operationId:input.operationId,createdBy:member.actorId,requestDigest};
     m.participant={version:1,status:'INVITED',clerkUserId:null,permissions:{attendance:false,report:false},invitation,kyc:{version:1,status:'NOT_SUBMITTED'}};await writeWorker(client,input.projectId,row,m);
     await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.invitation.attempted','Worker',$4,$5::jsonb)`,[key+'_attempt',member.organizationId,member.actorId,row.id,JSON.stringify({version:1,projectId:input.projectId,invitationId:invitation.id,requestDigest,deliveryConfirmed:false})]);
     return {invite:invitation,workerId:row.id};
    }
    const part=m.participant;if(part?.version!==1)throw new WorkspaceError('PARTICIPANT_UNAVAILABLE',404);
    if(input.action==='REVOKE'){
     if(part.status==='REVOKED')throw new WorkspaceError('PARTICIPANT_ALREADY_REVOKED',409);
     if(part.channelIdentity)part.channelIdentity=invalidateWorkerChannelIdentity(m,{reasonCode:'PARTICIPATION_REVOKED'}).participant.channelIdentity;
     part.status='REVOKED';part.permissions={attendance:false,report:false};if(part.invitation)part.invitation={...part.invitation,state:'REVOKED'};
     // Revoke the exact assigned project, never another project or tenant.
     if(part.clerkUserId)await client.query(`UPDATE public."ProjectMembership" pm SET status='DISABLED',"updatedAt"=clock_timestamp() FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE pm."tenantMembershipId"=tm.id AND pm."projectId"=$1 AND tm."organizationId"=$2 AND tm."tenantRole"='AUDITOR' AND u."clerkUserId"=$3`,[input.projectId,member.organizationId,part.clerkUserId]);
    }else if(input.action==='RESTORE_ACCESS'){
     if(!row.active||part.status!=='REVOKED'||!/^user_[A-Za-z0-9]+$/.test(part.clerkUserId||''))throw new WorkspaceError('PARTICIPANT_REACTIVATION_REVIEW_REQUIRED',409);
     const authorized=(await client.query(`SELECT tm.id,tm."clerkRole" FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=tm.id WHERE pm."projectId"=$1 AND tm."organizationId"=$2 AND tm.status='ACTIVE' AND u."clerkUserId"=$3 FOR SHARE OF tm,u`,[input.projectId,member.organizationId,part.clerkUserId])).rows;
     if(authorized.length!==1||part.clerkUserId!==restoration?.userId||authorized[0].clerkRole!==restoration.role)throw new WorkspaceError('PARTICIPANT_REACTIVATION_REVIEW_REQUIRED',409);
     const acceptedPermissions=await employeeIntakeAcceptedPermissions(client,row,{organizationId:member.organizationId,projectId:input.projectId});await client.query(`UPDATE public."ProjectMembership" SET status='ACTIVE',"updatedAt"=clock_timestamp() WHERE "projectId"=$1 AND "tenantMembershipId"=$2`,[input.projectId,authorized[0].id]);part.status='ACTIVE';part.permissions=acceptedPermissions;if(part.invitation)part.invitation={...part.invitation,state:'ACCEPTED'};
    }else{
     if(part.status!=='ACTIVE'||!row.active||part.kyc?.status!=='PENDING_REVIEW'||part.kyc.submissionId!==p.submissionId)throw new WorkspaceError('PARTICIPANT_KYC_NOT_PENDING',409);
     if(part.clerkUserId===session.userId)throw new WorkspaceError('PARTICIPANT_SELF_REVIEW_REJECTED',403);
     const submitted=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND metadata->>'submissionId'=$3`,[member.organizationId,row.id,p.submissionId])).rows;
     if(submitted.length!==1||submitted[0].metadata.contentHash!==part.kyc.contentHash||!Array.isArray(part.kyc.images)||part.kyc.images.length!==2)throw new WorkspaceError('PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED',409);
     const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();part.kyc={...part.kyc,status:p.decision,review:{decision:p.decision,reason:p.reason,actorId:member.actorId,recordedAt:now}};
    }
    await writeWorker(client,input.projectId,row,m);await record(client,member,key,input.projectId,row.id,requestDigest,{kind:input.action,reason:p.reason,decision:p.decision||null,submissionId:p.submissionId||null,channelBindingId:part.channelIdentity?.binding?.id||null,channelBindingRevoked:part.channelIdentity?.binding?.status==='REVOKED',identityCertified:false});
    return {done:{scope,...await currentOutcome(client,input.projectId,await receipt(client,member,key),false)}};
   });
   if(prepared.done)return prepared.done;
   try{const result=await identity.createInvitation({organizationId:session.organizationId,inviterUserId:session.userId,email:prepared.invite.email,invitationId:prepared.invite.id});return await finalizeInvitation(session,context,prepared.workerId,prepared.invite.id,result);}
   catch(error){throw error instanceof WorkspaceError?error:new WorkspaceError('PARTICIPANT_INVITATION_UNCONFIRMED',503);}
  },
  status(session,context){participantContext(context);if(!operationId(context.operationId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');return run(session,context,false,async(client,member,scope)=>{
   const found=await receipt(client,member,participantReceiptId(member.actorId,context.projectId,context.operationId));if(found){
    if(found.metadata?.projectId!==context.projectId)throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);
    if(found.metadata.kind===PRIVATE_BANK_RECEIPT_KIND)return privateBankStatus(client,member,session,{...context,operationId:context.operationId.toLowerCase(),workerId:found.entityId,action:found.metadata.bankAction},scope);
    if(EMPLOYEE_INTAKE_ACTIONS.includes(found.metadata.kind)){if(member.role!=='ADMIN')throw new WorkspaceError('WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',403);return employeeIntakeOutcome(found,scope,context.operationId);}
     if(found.metadata.kind==='PROCESS_KYC')return {scope,state:'RECORDED',...await ocrOutcome(client,member,session,{...context,workerId:found.entityId,submissionId:found.metadata.submissionId},found)};
     if(found.metadata.kind==='PREPARE_KYC_CHAT'){requireManager(member);const row=await worker(client,context.projectId,found.entityId);if(!row.active||!['INVITED','ACTIVE'].includes(row.metadata?.participant?.status))throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);return {scope,state:'RECORDED',...await currentOutcome(client,context.projectId,found,true),kind:'PREPARE_KYC_CHAT',codeUnavailable:true,expiresAt:found.metadata.expiresAt};}
    if(found.entityType==='TenantMembership'&&found.metadata.kind==='OFFICE_ROLE_CHANGED'){if(member.role!=='ADMIN')throw new WorkspaceError('WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED',403);}
    else if(found.entityType==='Worker'){if(!participantManager(member.role))await assertOwnParticipant(client,member,session,context.projectId,found.entityId);}
    else throw new WorkspaceError('PARTICIPANT_RECEIPT_INVALID',409);
    return {scope,state:'RECORDED',...await currentOutcome(client,context.projectId,found,true,member.actorId)};
   }
    const processing=(await client.query(`SELECT ${columns} FROM public."Worker" WHERE "projectId"=$1 AND metadata->'participant'->'kyc'->'processing'->>'operationId'=$2 AND metadata->'participant'->'kyc'->'processing'->>'actorId'=$3`,[context.projectId,context.operationId.toLowerCase(),member.actorId])).rows.filter(row=>row.metadata?.participant?.kyc?.processing?.status==='RUNNING');
    if(processing.length===1){requireManager(member);const row=processing[0],k=ocrParticipant(row,session,row.metadata.participant.kyc.submissionId,{pending:true}),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now;
     return {scope,state:'PROCESSING',definitive:false,workerId:row.id,submissionId:k.submissionId,expiresAt:k.processing.expiresAt,retryAfterExpiration:Date.parse(k.processing.expiresAt)<=now.getTime()};}
    const pending=(await client.query(`SELECT ${columns} FROM public."Worker" WHERE "projectId"=$1 AND metadata->'participant'->'invitation'->>'operationId'=$2 AND metadata->'participant'->'invitation'->>'createdBy'=$3`,[context.projectId,context.operationId.toLowerCase(),member.actorId])).rows;
   if(pending.length===1&&!participantManager(member.role))await assertOwnParticipant(client,member,session,context.projectId,pending[0].id);
   return {scope,state:pending.length===1?'INVITATION_UNCONFIRMED':'NOT_OBSERVED',definitive:false,...(pending.length===1?{participant:publicParticipant(pending[0])}:{})};
  });},
  async join(session,input,{accept=false}={}){
   participantKeys(input,accept?['invitationId','operationId']:['invitationId']);if(!/^invite_[a-f0-9]{32}$/.test(input.invitationId||'')||(accept&&!operationId(input.operationId)))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');requireWorkspaceIdentity(session);
   if(!accept){const restored=await joinTransaction(session,false,async client=>{const row=await invitedWorker(client,session,input.invitationId);return row.metadata.participant.status==='ACTIVE'?acceptedInvitation(client,session,row):null;});if(restored)return restored;}
   const preliminary=await joinTransaction(session,false,client=>invitedWorker(client,session,input.invitationId));
   const invite=preliminary.metadata.participant.invitation,primaryEmail=await identity.verifiedEmail(session.userId);
   // The selector comes exclusively from the server's canonical invitation.
   // A verified secondary can accept it without replacing the account primary.
   const email=primaryEmail===invite.email?primaryEmail:await identity.verifiedEmail(session.userId,invite.email);
   if(email!==invite.email)throw new WorkspaceError('PARTICIPANT_EMAIL_MISMATCH',403);
   const provider=await identity.findInvitation({organizationId:session.organizationId,invitationId:invite.id});matchProvider(invite,provider);
   if(provider.state!=='accepted'||provider.id!==invite.providerId)throw new WorkspaceError('PARTICIPANT_PROVIDER_ACCEPTANCE_REQUIRED',403);
   const providerMember=await identity.verifyMembership({userId:session.userId,organizationId:session.organizationId,invitationId:invite.id});if(providerMember.role!=='org:member')throw new WorkspaceError('PARTICIPANT_MEMBER_SESSION_REQUIRED',403);
   if(!accept)return joinTransaction(session,false,async client=>{const row=await invitedWorker(client,session,input.invitationId),current=row.metadata.participant.invitation;if(current.email!==email||current.providerId!==provider.id)throw new WorkspaceError('PARTICIPANT_EMAIL_MISMATCH',403);if(row.metadata.participant.status==='ACTIVE')return acceptedInvitation(client,session,row);if(row.metadata.participant.status!=='INVITED'||current.state!=='SENT'||!Number.isFinite(Date.parse(current.expiresAt))||Date.parse(current.expiresAt)<Date.now())throw new WorkspaceError('PARTICIPANT_INVITATION_EXPIRED',410);return {invitationId:invite.id,projectName:row.projectName,organizationName:row.organizationName,participantName:row.name,state:row.metadata.participant.status,canAccept:true};});
   return joinTransaction(session,true,async client=>{
    for(const lock of [...new Set(['participant-user:'+session.userId,'participant-email:'+primaryEmail,'participant-email:'+email])].sort())await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[lock]);
    // Match the workspace lock order: canonical identity and membership before
    // the project/worker. Joining another worksite cannot deadlock a field write.
    await client.query(`SELECT id FROM public."PlatformUser" WHERE "clerkUserId"=$1 FOR UPDATE`,[session.userId]);
    await client.query(`SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."Organization" o ON o.id=m."organizationId" WHERE u."clerkUserId"=$1 AND o."clerkOrganizationId"=$2 FOR UPDATE OF m`,[session.userId,session.organizationId]);
    const row=await invitedWorker(client,session,input.invitationId,true),m=metadata(row),part=m.participant;
    if(part.invitation.email!==email||part.invitation.providerId!==provider.id)throw new WorkspaceError('PARTICIPANT_EMAIL_MISMATCH',403);
    if(part.status==='ACTIVE'){if(part.clerkUserId!==session.userId)throw new WorkspaceError('PARTICIPANT_IDENTITY_CONFLICT',409);return acceptedInvitation(client,session,row);}
    if(part.status!=='INVITED'||part.invitation.state!=='SENT'||Date.parse(part.invitation.expiresAt)<Date.now())throw new WorkspaceError('PARTICIPANT_INVITATION_EXPIRED',410);
    let user=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE "clerkUserId"=$1 FOR UPDATE`,[session.userId])).rows[0];
    const clash=(await client.query(`SELECT id,"clerkUserId" FROM public."PlatformUser" WHERE lower("primaryEmail")=lower($1) OR lower("primaryEmail")=lower($2)`,[primaryEmail,email])).rows;if(!user&&clash.some(item=>item.clerkUserId!==session.userId))throw new WorkspaceError('PARTICIPANT_IDENTITY_CONFLICT',409);
    if(!user){user={id:id('user')};await client.query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail","systemRole","updatedAt") VALUES($1,$2,$3,'TENANT_USER',clock_timestamp())`,[user.id,session.userId,primaryEmail]);}
    let member=(await client.query(`SELECT id,status,"tenantRole"::text AS role FROM public."TenantMembership" WHERE "organizationId"=$1 AND "userId"=$2 FOR UPDATE`,[row.organizationId,user.id])).rows[0];
    if(member&&(member.status!=='ACTIVE'||member.role!=='AUDITOR'))throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
    if(!member){member={id:id('member')};await client.query(`INSERT INTO public."TenantMembership"(id,"organizationId","userId","clerkRole","tenantRole",status,"updatedAt") VALUES($1,$2,$3,'org:member','AUDITOR','ACTIVE',clock_timestamp())`,[member.id,row.organizationId,user.id]);}
    const projectMember=(await client.query(`SELECT id,status FROM public."ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"=$2 FOR UPDATE`,[row.projectId,member.id])).rows[0];if(projectMember?.status==='DISABLED')throw new WorkspaceError('PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED',409);
    if(!projectMember)await client.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status,"updatedAt") VALUES($1,$2,$3,'ACTIVE',clock_timestamp())`,[id('projectmember'),row.projectId,member.id]);
    const duplicate=(await client.query(`SELECT id FROM public."Worker" WHERE "projectId"=$1 AND id<>$2 AND metadata->'participant'->>'clerkUserId'=$3 AND metadata->'participant'->>'status'='ACTIVE'`,[row.projectId,row.id,session.userId])).rows;if(duplicate.length)throw new WorkspaceError('PARTICIPANT_IDENTITY_CONFLICT',409);
    const key=participantReceiptId(user.id,row.projectId,input.operationId),memberContext={organizationId:row.organizationId,actorId:user.id};part.status='ACTIVE';part.clerkUserId=session.userId;part.permissions=await employeeIntakeAcceptedPermissions(client,row,{organizationId:memberContext.organizationId,projectId:row.projectId});part.invitation.state='ACCEPTED';part.acceptanceReceiptId=key;
    await adoptParticipantChannelKyc(client,{row,participant:part,invitationId:input.invitationId,actorId:user.id,clerkUserId:session.userId,acceptanceReceiptId:key});
    await writeWorker(client,row.projectId,row,m);await record(client,memberContext,key,row.projectId,row.id,digest([row.id,input.invitationId,session.userId,email]),{kind:'INVITATION_ACCEPTED',invitationId:input.invitationId,identityCertified:false,whatsAppAccessGranted:false});return {saved:true,replayed:false,joined:true,projectId:row.projectId,receiptId:key};
   });
  },
   async submitKyc(session,body){const input=participantKycInput(body),fingerprint=digest([input.projectId,input.scope,input.workerId,input.revision,input.noticeVersion,input.front.digest,input.selfie.digest,...(input.ocrNoticeVersion?[input.ocrNoticeVersion,input.ocrConsent]:[]),...(input.biometricNoticeVersion?[input.biometricNoticeVersion,input.biometricConsent]:[])]);
   const preflight=await run(session,input,false,async(client,member,scope)=>{const key=participantReceiptId(member.actorId,input.projectId,input.operationId),prior=await receipt(client,member,key);if(prior)return {done:{scope,...await ownKycReplayOutcome(client,member,session,input,prior,fingerprint)}};
    const row=await assertOwnParticipant(client,member,session,input.projectId,input.workerId);if(row.revision!==input.revision)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);if(['APPROVED','PENDING_REVIEW'].includes(row.metadata.participant.kyc?.status))throw new WorkspaceError('PARTICIPANT_KYC_ALREADY_SUBMITTED',409);return {key,actorId:member.actorId,organizationId:member.organizationId};});
   if(preflight.done)return preflight.done;const images=[];
   for(const [kind,image] of [['DOCUMENT_FRONT',input.front],['SELFIE',input.selfie]]){let url;try{url=await upload(image.bytes.toString('base64'),'participant-kyc-'+digest([preflight.organizationId,input.projectId,input.workerId,input.operationId,kind]),image.contentType);}catch{throw new WorkspaceError('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}images.push({id:kind==='SELFIE'?'selfie':'document-front',kind,url,contentType:image.contentType,bytes:image.bytes.length,sha256:image.digest});}
   return run(session,input,true,async(client,member,scope)=>{const prior=await receipt(client,member,preflight.key);if(prior)return {scope,...await ownKycReplayOutcome(client,member,session,input,prior,fingerprint,{lock:true})};
    const row=await assertOwnParticipant(client,member,session,input.projectId,input.workerId,{lock:true});if(row.revision!==input.revision)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);if(['APPROVED','PENDING_REVIEW'].includes(row.metadata.participant.kyc?.status))throw new WorkspaceError('PARTICIPANT_KYC_ALREADY_SUBMITTED',409);
    const m=metadata(row),submissionId=id('kyc'),contentHash=digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),now=(await client.query('SELECT clock_timestamp() AS now')).rows[0].now.toISOString();
    if(m.participant.channelIdentity)m.participant.channelIdentity=invalidateWorkerChannelIdentity(m,{at:now,reasonCode:'KYC_RESUBMITTED'}).participant.channelIdentity;
    m.participant.kyc={version:1,status:'PENDING_REVIEW',submissionId,noticeVersion:PARTICIPANT_NOTICE_VERSION,noticeSha256:digest(PARTICIPANT_NOTICE),consentRecorded:true,submittedAt:now,contentHash,images,ocrConsent:{allowed:input.ocrConsent===true,noticeVersion:input.ocrNoticeVersion,noticeSha256:input.ocrNoticeVersion?digest(PARTICIPANT_OCR_NOTICE):null,recordedAt:now},biometricConsent:{allowed:input.biometricConsent===true,noticeVersion:input.biometricNoticeVersion,noticeSha256:input.biometricNoticeVersion?digest(PARTICIPANT_BIOMETRIC_NOTICE):null,recordedAt:now}};await writeWorker(client,input.projectId,row,m);
    await record(client,member,preflight.key,input.projectId,row.id,fingerprint,{kind:'KYC_SUBMITTED',submissionId,contentHash,noticeVersion:PARTICIPANT_NOTICE_VERSION,ocrConsentRecorded:input.ocrConsent===true,ocrNoticeVersion:input.ocrNoticeVersion,ocrNoticeSha256:input.ocrNoticeVersion?digest(PARTICIPANT_OCR_NOTICE):null,biometricConsentRecorded:input.biometricConsent===true,biometricNoticeVersion:input.biometricNoticeVersion,biometricNoticeSha256:input.biometricNoticeVersion?digest(PARTICIPANT_BIOMETRIC_NOTICE):null,identityCertified:false});return {scope,...await currentOutcome(client,input.projectId,await receipt(client,member,preflight.key),false)};
   });
  },
  async downloadKyc(session,context){participantContext(context);if(!workspaceId(context.workerId)||!['document-front','selfie'].includes(context.imageId))throw new WorkspaceError('PARTICIPANT_INPUT_INVALID');
    const image=await run(session,context,false,async(client,member)=>{const row=await worker(client,context.projectId,context.workerId);if(!participantManager(member.role))await assertOwnParticipant(client,member,session,context.projectId,row.id);const image=row.metadata?.participant?.kyc?.images?.find(value=>value.id===context.imageId);if(!image)throw new WorkspaceError('PARTICIPANT_KYC_IMAGE_UNAVAILABLE',404);return image;});
   let result;try{const url=new URL(image.url);if(url.protocol!=='https:'||! /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.search||url.hash||url.username||url.password||! /^\/obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.(png|jpg|webp)$/.test(url.pathname))throw new Error();result=await get(url.pathname.slice(1),{access:'private',useCache:false,abortSignal:AbortSignal.timeout(15000)});if(result?.statusCode!==200||result.blob?.url!==image.url||result.blob.size!==image.bytes||result.blob.contentType?.split(';')[0]!==image.contentType)throw new Error();}catch{await result?.stream?.cancel?.().catch(()=>{});throw new WorkspaceError('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}
   const reader=result.stream.getReader(),chunks=[];let bytes=0;try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>image.bytes||bytes>2*1024*1024)throw new Error();chunks.push(Buffer.from(next.value));}const buffer=Buffer.concat(chunks);if(bytes!==image.bytes||createHash('sha256').update(buffer).digest('hex')!==image.sha256)throw new Error();
    // Recheck permissions after storage I/O so revoked access cannot release bytes.
    await run(session,context,false,async(client,member)=>{const row=await worker(client,context.projectId,context.workerId);if(!participantManager(member.role))await assertOwnParticipant(client,member,session,context.projectId,row.id);if(row.metadata?.participant?.kyc?.images?.find(value=>value.id===context.imageId)?.sha256!==image.sha256)throw new WorkspaceError('PARTICIPANT_REVISION_CHANGED',409);});return {bytes:buffer,contentType:image.contentType};
   }catch(error){if(error instanceof WorkspaceError)throw error;throw new WorkspaceError('PARTICIPANT_KYC_INTEGRITY',409);}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  },
 };
}
