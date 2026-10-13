import {randomUUID,createHash} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';
import {participantIdentityOperation} from './workspace-store.mjs';
import {participantManager,assertOwnParticipant} from './participant-policy.mjs';
import {participantKycImageSet} from './participant-kyc-image-set.mjs';
import {createBindxCivilDataClient,bindxCivilContextDigest,BINDX_CIVIL_CONSENT_VERSION} from './bindx-civil-data-client.mjs';
import {CIVIL_BOUNDARY,civilFail,civilInstant,civilReadContext,civilCommand,approvedCivilConfiguration,civilConfigurationDigest,civilAttemptId,civilAttemptDigest,civilSourceKey,civilObservation} from './participant-civil-policy.mjs';

const ATTEMPT='participant.civil.attempt',OBSERVATION='participant.civil.observation',CONSENT='participant.civil.consent';
const clone=value=>structuredClone(value);
const manages=member=>member.identityOnly!==true&&participantManager(member.role);
const columns=`id,name,active,metadata,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;

export async function readCivilDocumentSource(image,get,timeoutMs=15000){
 if(typeof get!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>15000)civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);
 let reader,timer,expired=false;const controller=new AbortController();
 const work=(async()=>{
  const url=new URL(image.url);if(url.protocol!=='https:'||! /^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.port||url.search||url.hash||url.username||url.password||! /^\/obrasaas\/legacy-images\/v1\/[a-f0-9]{64}\/image\.(png|jpg|webp)$/.test(url.pathname))civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);
  const result=await get(url.pathname.slice(1),{access:'private',useCache:false,abortSignal:controller.signal});
  if(expired){try{result?.stream?.cancel?.().catch(()=>{});}catch{}civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}
  if(result?.statusCode!==200||result.blob?.url!==image.url||result.blob.size!==image.bytes||result.blob.contentType?.split(';')[0]!==image.contentType||!result.stream?.getReader)civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);
  reader=result.stream.getReader();const chunks=[];let total=0;
  for(;;){const next=await reader.read();if(expired)civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);if(next.done)break;if(!(next.value instanceof Uint8Array))civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);total+=next.value.byteLength;if(total>image.bytes||total>2*1024*1024)civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);chunks.push(Buffer.from(next.value));}
  if(total!==image.bytes||createHash('sha256').update(Buffer.concat(chunks)).digest('hex')!==image.sha256)civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);
 })();
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;controller.abort();try{reader?.cancel().catch(()=>{});}catch{}reject(new WorkspaceError('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503));},timeoutMs);});
 try{await Promise.race([work,timeout]);}catch{civilFail('PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED',503);}finally{clearTimeout(timer);try{reader?.cancel().catch(()=>{});}catch{}}
}

// Actual Worker/AuditLog storage. The provider is closed by default; technical
// settlement has a narrow server-held claim and cannot approve a participant.
export function createParticipantCivilStore({workspace,connect,get,configuration=()=>null,clientFactory=createBindxCivilDataClient}={}){
 if(typeof workspace?.projectOperation!=='function'||typeof configuration!=='function'||typeof clientFactory!=='function')throw new TypeError('Explicit canonical civil composition required');
 const run=(session,input,writable,callback)=>participantIdentityOperation(workspace,session,{projectId:input.projectId,scope:input.scope},writable,callback);
 async function clock(client){const now=(await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now;if(!(now instanceof Date)||!Number.isFinite(now.getTime()))civilFail('PARTICIPANT_CIVIL_UNCONFIRMED',503);return now;}
 function config(now){try{return approvedCivilConfiguration(configuration(),now.getTime());}catch{return null;}}
 async function worker(client,input,lock=false){const rows=(await client.query(`SELECT ${columns} FROM public."Worker" WHERE id=$1 AND "projectId"=$2 ${lock?'FOR UPDATE':''}`,[input.workerId,input.projectId])).rows;if(rows.length!==1)civilFail('PARTICIPANT_UNAVAILABLE',404);return rows[0];}
 async function access(client,member,session,input,row,lock=false){
  const p=row.metadata?.participant;
  if(!row.active||p?.version!==1||p.status!=='ACTIVE')civilFail('PARTICIPANT_ACCESS_REQUIRED',403);
  if(p.clerkUserId===session.userId){await assertOwnParticipant(client,member,session,input.projectId,input.workerId,{lock});return true;}
  if(!manages(member))civilFail('PARTICIPANT_MANAGE_REQUIRED',403);
  return false;
 }
 async function evidence(client,member,input,row){
  const k=row.metadata?.participant?.kyc;
  if(!k||!workspaceId(k.submissionId)||input.submissionId!==undefined&&input.submissionId!==null&&input.submissionId!==k.submissionId||!['PENDING_REVIEW','APPROVED','REJECTED'].includes(k.status))civilFail('PARTICIPANT_CIVIL_PRESENTATION_REQUIRED',409);
  const submitted=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED' AND metadata->>'submissionId'=$3`,[member.organizationId,row.id,k.submissionId])).rows;
  if(submitted.length!==1||submitted[0].metadata.projectId!==input.projectId||submitted[0].metadata.contentHash!==k.contentHash||!participantKycImageSet(k,{strictLegacy:true,receipt:submitted[0].metadata,projectId:input.projectId}))civilFail('PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED',409);
  return {...k,holderClerkUserId:row.metadata.participant.clerkUserId};
 }
 async function insert(client,a,action,id,metadata){await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,'Worker',$5,$6::jsonb)`,[id,a.organizationId,a.actorId,action,a.workerId,JSON.stringify(metadata)]);}
 async function save(client,a){const result=await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1 AND "organizationId"=$3 AND action=$4`,[a.id,JSON.stringify(a),a.organizationId,ATTEMPT]);if(result.rowCount!==1)civilFail('PARTICIPANT_CIVIL_UNCONFIRMED',503);}
 function record(row,input,member){
  if(!row)return null;const a=row.metadata;
  if(!a||a.version!==1||a.id!==row.id||row.organizationId!==member.organizationId||row.entityType!=='Worker'||row.entityId!==input.workerId||a.organizationId!==member.organizationId||a.projectId!==input.projectId||a.workerId!==input.workerId||!workspaceId(a.actorId)||!workspaceId(a.membershipId)||!operationId(a.operationId)||!/^user_[A-Za-z0-9]+$/.test(a.subjectClerkUserId||'')||!civilInstant(a.createdAt)||a.noticeVersion!==BINDX_CIVIL_CONSENT_VERSION||![a.documentSha256,a.contentHash,a.configurationDigest,a.noticeSha256].every(value=>/^[a-f0-9]{64}$/.test(value||''))||a.id!==civilAttemptId(a.organizationId,a.projectId,a.workerId,a.operationId)||!['CONSENT_PENDING','CONSENT_RECORDED','DISPATCHING','UNKNOWN','OBSERVED'].includes(a.state)||a.attemptDigest!==civilAttemptDigest(a)||a.sourceKey!==civilSourceKey(a.organizationId,a.projectId,a.workerId,a.documentSha256))civilFail('PARTICIPANT_CIVIL_RECEIPT_INVALID',409);
  return a;
 }
 async function attempt(client,member,input,lock=false){const id=civilAttemptId(member.organizationId,input.projectId,input.workerId,input.operationId),rows=(await client.query(`SELECT id,"organizationId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3 ${lock?'FOR UPDATE':''}`,[id,member.organizationId,ATTEMPT])).rows;if(rows.length>1)civilFail('PARTICIPANT_CIVIL_RECEIPT_INVALID',409);return record(rows[0],input,member);}
 async function sourceAttempt(client,member,input,key){const rows=(await client.query(`SELECT id,"organizationId","entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action=$3 AND metadata->>'sourceKey'=$4 ORDER BY "createdAt" DESC LIMIT 2`,[member.organizationId,input.workerId,ATTEMPT,key])).rows;if(rows.length>1)civilFail('PARTICIPANT_CIVIL_RECEIPT_INVALID',409);return record(rows[0],input,member);}
 function current(a,k){return a.subjectClerkUserId===k.holderClerkUserId&&a.submissionId===k.submissionId&&a.contentHash===k.contentHash&&a.documentSha256===k.images.find(image=>image.id==='document-front')?.sha256;}
 function requireCurrent(a,k){if(!current(a,k))civilFail('PARTICIPANT_CIVIL_PRESENTATION_CHANGED',409);}
 function consentCurrent(a,k,cfg){const c=k.civilConsent;return Boolean(c&&c.version===1&&c.allowed===true&&c.attemptId===a.id&&c.operationId===a.operationId&&c.reference===a.consentReference&&c.attemptDigest===a.attemptDigest&&c.noticeVersion===a.noticeVersion&&c.noticeSha256===a.noticeSha256&&c.bindingDigest===a.bindingDigest&&c.clerkUserId===a.subjectClerkUserId&&civilInstant(c.recordedAt)&&/^\d{1,20}$/.test(c.dni||'')&&['F','M'].includes(c.gender)&&cfg&&civilConfigurationDigest(cfg)===a.configurationDigest);}
 async function consentProof(client,a,k,cfg){
  if(!consentCurrent(a,k,cfg)||bindxCivilContextDigest(context(a,k))!==a.bindingDigest)return false;
  const c=k.civilConsent,rows=(await client.query(`SELECT id,"organizationId","actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3`,[a.consentReference,a.organizationId,CONSENT])).rows;
  if(rows.length!==1)return false;const r=rows[0],m=r.metadata;
  if(!(r.id===c.reference&&r.organizationId===a.organizationId&&r.actorId===c.actorId&&r.entityType==='Worker'&&r.entityId===a.workerId&&m?.version===1&&m.attemptId===a.id&&m.attemptDigest===a.attemptDigest&&m.bindingDigest===a.bindingDigest&&m.noticeVersion===a.noticeVersion&&m.noticeSha256===a.noticeSha256&&m.recordedAt===c.recordedAt&&m.subjectClerkUserId===a.subjectClerkUserId&&m.membershipId===c.membershipId))return false;
  const holders=(await client.query(`SELECT m.id FROM public."TenantMembership" m JOIN public."PlatformUser" u ON u.id=m."userId" JOIN public."ProjectMembership" pm ON pm."tenantMembershipId"=m.id WHERE m.id=$1 AND m."organizationId"=$2 AND u.id=$3 AND u."clerkUserId"=$4 AND m.status='ACTIVE' AND pm."projectId"=$5 AND pm.status='ACTIVE'`,[c.membershipId,a.organizationId,c.actorId,a.subjectClerkUserId,a.projectId])).rows;
  return holders.length===1;
 }
 function context(a,k){return {organizationId:a.organizationId,actorId:a.actorId,subjectId:a.workerId,submissionId:a.submissionId,operationId:a.operationId,documentSha256:a.documentSha256,dni:k.civilConsent.dni,gender:k.civilConsent.gender};}
 async function snapshot(client,input,scope,cfg,a,k,member,own,code=null,observation=null){
  const valid=a&&k&&current(a,k),configurationCurrent=Boolean(a&&cfg&&civilConfigurationDigest(cfg)===a.configurationDigest&&cfg.notice.version===a.noticeVersion&&cfg.notice.sha256===a.noticeSha256),consented=valid&&await consentProof(client,a,k,cfg),operator=a?.actorId===member.actorId&&a?.membershipId===member.membershipId;
  const display=a?{operationId:a.operationId,state:a.state,attemptDigest:a.attemptDigest,operatorId:a.actorId,noticeVersion:a.noticeVersion,noticeSha256:a.noticeSha256,consentRecorded:Boolean(consented),observedAt:a.observedAt||null,queryAttempted:a.queryAttempted===true,code:a.code||null,data:consented&&a.state==='OBSERVED'?observation?.data||null:null}:null;
  return {detail:'civil-data',scope,projectId:input.projectId,workerId:input.workerId,submissionId:k?.submissionId||null,civil:{version:1,state:a?.state||(cfg?k?'NOT_OBSERVED':'PRESENTATION_REQUIRED':'CONTRACT_PENDING'),available:Boolean(cfg),code:code||(!cfg?'BINDX_CIVIL_CONTRACT_PENDING':a&&!valid?'PARTICIPANT_CIVIL_PRESENTATION_CHANGED':a&&!configurationCurrent?'PARTICIPANT_CIVIL_CONFIGURATION_CHANGED':null),notice:cfg?clone(cfg.notice):null,canPrepare:Boolean(cfg&&k?.status==='PENDING_REVIEW'&&!a),canConsent:Boolean(configurationCurrent&&valid&&own&&a.state==='CONSENT_PENDING'),canQuery:Boolean(cfg&&consented&&operator&&a.state==='CONSENT_RECORDED'),canRevokeConsent:Boolean(valid&&own&&k.civilConsent?.allowed===true),attempt:display,...CIVIL_BOUNDARY}};
 }
 async function observation(client,a){if(a.state!=='OBSERVED')return null;const rows=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3`,[a.observationId,a.organizationId,OBSERVATION])).rows;if(rows.length!==1||rows[0].metadata.attemptId!==a.id||rows[0].metadata.claimId!==a.claimId)civilFail('PARTICIPANT_CIVIL_RECEIPT_INVALID',409);return civilObservation(rows[0].metadata.observation,a.bindingDigest);}
 async function read(session,input){input=civilReadContext(input);return run(session,input,false,async(client,member,scope)=>{
  const row=await worker(client,input),own=await access(client,member,session,input,row),now=await clock(client),cfg=config(now);let k=null;
  if(workspaceId(row.metadata?.participant?.kyc?.submissionId))k=await evidence(client,member,input,row);else if(input.submissionId)civilFail('PARTICIPANT_CIVIL_PRESENTATION_CHANGED',409);
  const a=input.operationId?await attempt(client,member,input):k?await sourceAttempt(client,member,input,civilSourceKey(member.organizationId,input.projectId,row.id,k.images.find(image=>image.id==='document-front').sha256)):null;
  if(a&&input.operationId&&input.submissionId&&a.submissionId!==input.submissionId)civilFail('PARTICIPANT_CIVIL_PRESENTATION_CHANGED',409);
  const result=await observation(client,a||{});return snapshot(client,input,scope,cfg,a,k,member,own,null,result);
 });}
 async function prepare(session,input){input=civilCommand(input,'prepare');return run(session,input,true,async(client,member,scope)=>{
  const row=await worker(client,input,true),own=await access(client,member,session,input,row,true),k=await evidence(client,member,input,row),now=await clock(client),cfg=config(now);
  if(!cfg)return snapshot(client,input,scope,null,null,k,member,own);
  const existing=await sourceAttempt(client,member,input,civilSourceKey(member.organizationId,input.projectId,row.id,k.images.find(image=>image.id==='document-front').sha256));
  if(existing){if(existing.operationId!==input.operationId||existing.actorId!==member.actorId||existing.membershipId!==member.membershipId)civilFail('PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED',409);requireCurrent(existing,k);return snapshot(client,input,scope,cfg,existing,k,member,own,null,await observation(client,existing));}
  if(row.revision!==input.revision)civilFail('PARTICIPANT_REVISION_CHANGED',409);if(k.status!=='PENDING_REVIEW')civilFail('PARTICIPANT_KYC_NOT_PENDING',409);
  const a={version:1,id:civilAttemptId(member.organizationId,input.projectId,row.id,input.operationId),organizationId:member.organizationId,projectId:input.projectId,workerId:row.id,submissionId:k.submissionId,subjectClerkUserId:row.metadata.participant.clerkUserId,actorId:member.actorId,membershipId:member.membershipId,operationId:input.operationId,documentSha256:k.images.find(image=>image.id==='document-front').sha256,contentHash:k.contentHash,configurationDigest:civilConfigurationDigest(cfg),noticeVersion:cfg.notice.version,noticeSha256:cfg.notice.sha256,state:'CONSENT_PENDING',createdAt:now.toISOString(),bindingDigest:null,consentReference:null,claimId:null,code:null,queryAttempted:false,observedAt:null,observationId:null};
  a.sourceKey=civilSourceKey(a.organizationId,a.projectId,a.workerId,a.documentSha256);a.attemptDigest=civilAttemptDigest(a);await insert(client,a,ATTEMPT,a.id,a);return snapshot(client,input,scope,cfg,a,k,member,own);
 });}
 async function consent(session,input){input=civilCommand(input,'consent');return run(session,input,true,async(client,member,scope)=>{
  const row=await worker(client,input,true),own=await access(client,member,session,input,row,true);if(!own)civilFail('PARTICIPANT_CIVIL_HOLDER_CONSENT_REQUIRED',403);
  const k=await evidence(client,member,input,row),a=await attempt(client,member,input,true),now=await clock(client),cfg=config(now);if(!a)civilFail('PARTICIPANT_CIVIL_ATTEMPT_REQUIRED',409);requireCurrent(a,k);
  if(!cfg||civilConfigurationDigest(cfg)!==a.configurationDigest)civilFail('PARTICIPANT_CIVIL_CONFIGURATION_CHANGED',409);
  if(input.attemptDigest!==a.attemptDigest||input.noticeVersion!==a.noticeVersion||input.noticeSha256!==a.noticeSha256)civilFail('PARTICIPANT_CIVIL_CONSENT_BINDING_REJECTED',409);
  const binding=bindxCivilContextDigest({organizationId:a.organizationId,actorId:a.actorId,subjectId:a.workerId,submissionId:a.submissionId,operationId:a.operationId,documentSha256:a.documentSha256,dni:input.dni,gender:input.gender});
  if(a.state!=='CONSENT_PENDING'){if(a.state==='CONSENT_RECORDED'&&await consentProof(client,a,k,cfg)&&binding===a.bindingDigest)return snapshot(client,input,scope,cfg,a,k,member,own);civilFail('PARTICIPANT_CIVIL_STATE_CHANGED',409);}
  a.bindingDigest=binding;a.consentReference='civil_consent_'+digest([a.id,member.actorId,a.attemptDigest,binding]);a.state='CONSENT_RECORDED';
  const m=clone(row.metadata);m.participant.kyc.civilConsent={version:1,allowed:true,attemptId:a.id,operationId:a.operationId,reference:a.consentReference,actorId:member.actorId,membershipId:member.membershipId,clerkUserId:session.userId,recordedAt:now.toISOString(),attemptDigest:a.attemptDigest,noticeVersion:a.noticeVersion,noticeSha256:a.noticeSha256,bindingDigest:binding,dni:input.dni,gender:input.gender};
  await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,input.projectId,JSON.stringify(m)]);
  await insert(client,{...a,actorId:member.actorId},CONSENT,a.consentReference,{version:1,attemptId:a.id,attemptDigest:a.attemptDigest,bindingDigest:binding,noticeVersion:a.noticeVersion,noticeSha256:a.noticeSha256,recordedAt:now.toISOString(),subjectClerkUserId:session.userId,membershipId:member.membershipId});await save(client,a);return snapshot(client,input,scope,cfg,a,{...k,civilConsent:m.participant.kyc.civilConsent},member,own);
 });}
 async function revokeConsent(session,input){input=civilCommand(input,'revoke');return run(session,input,true,async(client,member,scope)=>{
  const row=await worker(client,input,true),own=await access(client,member,session,input,row,true);if(!own)civilFail('PARTICIPANT_CIVIL_HOLDER_CONSENT_REQUIRED',403);const k=await evidence(client,member,input,row),a=await attempt(client,member,input,true);if(!a)civilFail('PARTICIPANT_CIVIL_ATTEMPT_REQUIRED',409);requireCurrent(a,k);
  const m=clone(row.metadata),c=m.participant.kyc.civilConsent;if(!c||c.attemptId!==a.id)civilFail('PARTICIPANT_CIVIL_CONSENT_REQUIRED',409);c.allowed=false;c.withdrawnAt=(await clock(client)).toISOString();await client.query(`UPDATE public."Worker" SET metadata=$3::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1 AND "projectId"=$2`,[row.id,input.projectId,JSON.stringify(m)]);return snapshot(client,input,scope,config(await clock(client)),a,{...k,civilConsent:m.participant.kyc.civilConsent},member,own);
 });}
 async function fence(session,input,reserved){return run(session,input,false,async(client,member)=>{
  const row=await worker(client,input),k=await evidence(client,member,input,row);await access(client,member,session,input,row);const a=await attempt(client,member,input),cfg=config(await clock(client));
  if(!a||a.claimId!==reserved.claimId||a.actorId!==member.actorId||a.membershipId!==member.membershipId||!['DISPATCHING','OBSERVED','UNKNOWN'].includes(a.state)||a.bindingDigest!==reserved.bindingDigest)civilFail('PARTICIPANT_CIVIL_STATE_CHANGED',409);requireCurrent(a,k);if(!await consentProof(client,a,k,cfg))civilFail('PARTICIPANT_CIVIL_CONSENT_REQUIRED',409);return true;
 });}
 async function settle(reserved,value){
  if(typeof connect!=='function')civilFail('PARTICIPANT_CIVIL_UNCONFIRMED',503);const technical=civilObservation(value,reserved.bindingDigest);let client,broken=false;
  try{client=await connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout='6s'");await client.query("SET LOCAL lock_timeout='2500ms'");
   const rows=(await client.query(`SELECT id,"organizationId","entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3 FOR UPDATE`,[reserved.id,reserved.organizationId,ATTEMPT])).rows;if(rows.length!==1)civilFail('PARTICIPANT_CIVIL_RECEIPT_INVALID',409);
   const a=record(rows[0],reserved,{organizationId:reserved.organizationId});if(a.claimId!==reserved.claimId||a.bindingDigest!==reserved.bindingDigest||a.attemptDigest!==reserved.attemptDigest||!['DISPATCHING','UNKNOWN','OBSERVED'].includes(a.state))civilFail('PARTICIPANT_CIVIL_STATE_CHANGED',409);
   if(a.observationId){const existing=(await client.query(`SELECT metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action=$3`,[a.observationId,a.organizationId,OBSERVATION])).rows;if(existing.length!==1||digest(existing[0].metadata.observation)!==digest(technical))civilFail('PARTICIPANT_CIVIL_OBSERVATION_CONFLICT',409);}
   else{a.observationId='civil_observation_'+digest([a.id,a.claimId]);await insert(client,a,OBSERVATION,a.observationId,{version:1,attemptId:a.id,claimId:a.claimId,observation:technical});a.state=technical.state==='OBSERVED'?'OBSERVED':'UNKNOWN';a.code=technical.code;a.queryAttempted=technical.queryAttempted;a.observedAt=technical.observedAt;await save(client,a);}
   await client.query('COMMIT');return true;
  }catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;civilFail('PARTICIPANT_CIVIL_UNCONFIRMED',503);}finally{client?.release(broken);}
 }
 async function dispatch(session,input){input=civilCommand(input,'dispatch');const reserved=await run(session,input,true,async(client,member,scope)=>{
  const row=await worker(client,input,true),own=await access(client,member,session,input,row,true),k=await evidence(client,member,input,row),a=await attempt(client,member,input,true),cfg=config(await clock(client));
  if(!a)civilFail('PARTICIPANT_CIVIL_ATTEMPT_REQUIRED',409);requireCurrent(a,k);if(a.actorId!==member.actorId||a.membershipId!==member.membershipId)civilFail('PARTICIPANT_CIVIL_OPERATOR_REQUIRED',403);
  if(['DISPATCHING','UNKNOWN','OBSERVED'].includes(a.state))return {done:await snapshot(client,input,scope,cfg,a,k,member,own,null,await observation(client,a))};
  if(!cfg)return {done:await snapshot(client,input,scope,null,a,k,member,own)};if(a.state!=='CONSENT_RECORDED'||!await consentProof(client,a,k,cfg))civilFail('PARTICIPANT_CIVIL_CONSENT_REQUIRED',409);if(typeof connect!=='function'||typeof get!=='function')civilFail('PARTICIPANT_CIVIL_UNCONFIRMED',503);
  a.claimId=randomUUID();a.state='DISPATCHING';await save(client,a);const captured=context(a,k);return {a:clone(a),front:clone(k.images.find(image=>image.id==='document-front')),configuration:{version:cfg.version,state:cfg.state,product:cfg.product,origin:cfg.origin,authentication:cfg.authentication,credentials:cfg.credentials,providerEvidence:cfg.providerEvidence,renaperAgreement:cfg.renaperAgreement,context:captured,consent:{version:BINDX_CIVIL_CONSENT_VERSION,reference:a.consentReference,acceptedAt:k.civilConsent.recordedAt,confirmed:true,provider:'BINDX_APISTORE',purpose:'RENAPER_CIVIL_DATA',contextDigest:a.bindingDigest}}};
 });if(reserved.done)return reserved.done;
  let settled=false,observationStarted=false,lookupResult=null;
  try{
   await fence(session,input,reserved.a);
   await readCivilDocumentSource(reserved.front,get);
   await fence(session,input,reserved.a);
   const client=clientFactory({configuration:reserved.configuration,beforeExternal:()=>fence(session,input,reserved.a),onTechnicalObservation:async value=>{observationStarted=true;await settle(reserved.a,value);settled=true;}});lookupResult=await client.lookup();
  }catch{/* Source/authority failures never become invalid identity or a retry. */}
  if(!settled&&!observationStarted)await settle(reserved.a,{version:1,provider:'BINDX_APISTORE',state:'UNKNOWN',code:'PARTICIPANT_CIVIL_TECHNICAL_UNCONFIRMED',bindingDigest:reserved.a.bindingDigest,observedAt:null,queryAttempted:lookupResult?.queryAttempted===true,httpStatus:null,data:null,...CIVIL_BOUNDARY});
  await fence(session,input,reserved.a);const result=await read(session,input);
  // A durable observation can commit after the transport's own deadline or
  // while its COMMIT acknowledgment is still pending. Preserve that receipt,
  // but this POST cannot return facts the transport did not confirm in time.
  if(lookupResult?.state!=='OBSERVED'||lookupResult.bindingDigest!==reserved.a.bindingDigest){result.civil.code='PARTICIPANT_CIVIL_RESULT_UNCONFIRMED';if(result.civil.attempt)result.civil.attempt.data=null;}
  return result;
 }
 return {read,prepare,consent,dispatch,revokeConsent};
}
