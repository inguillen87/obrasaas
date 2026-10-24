import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {usageExact,usageDigest,usageHash,usageInstant} from './organization-usage-policy.mjs';
import {resourceUsageBinding,resourceUsageId,resourceUsagePendingKey} from './organization-resource-usage-policy.mjs';
import {assertParticipantPreanalysisSource} from './participant-kyc-preanalysis-policy.mjs';
import {productionPlatformOperatorAuthority} from './platform-operator-authority.mjs';

export const PILOT_KYC_PRESET='PILOT_KYC_ONCE_V1';
const action='organization.usage.pilot-granted';
const revokedAction='organization.usage.pilot-revoked';
const fail=(code='PILOT_COVERAGE_UNCONFIRMED',status=503)=>{throw new WorkspaceError(code,status);};
const grantId=request=>'organization_pilot_'+usageDigest([request.organizationId,request.operationId]);
const revokeId=id=>'organization_pilot_revoked_'+usageDigest(id);
const issuerValid=value=>usageExact(value,['actorId','clerkUserId'])&&workspaceId(value.actorId)&&/^user_[A-Za-z0-9]+$/.test(value.clerkUserId||'');
const bindingValid=value=>usageExact(value,['version','grantId','grantDigest'])&&value.version===1&&/^organization_pilot_[a-f0-9]{64}$/.test(value.grantId||'')&&usageHash(value.grantDigest);
export const lockPilotUsage=(client,organizationId)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['organization-usage-v1:'+organizationId]);

export function pilotCoverageRequest(value){
  if(!usageExact(value,['preset','operationId','organizationId','projectId','workerId','expectedSubmissionId','expectedContentHash'])||value.preset!==PILOT_KYC_PRESET||!operationId(value.operationId)||![value.organizationId,value.projectId,value.workerId].every(workspaceId)||!(value.expectedSubmissionId===null&&value.expectedContentHash===null||workspaceId(value.expectedSubmissionId)&&usageHash(value.expectedContentHash)))fail('PILOT_COVERAGE_INPUT_INVALID',400);
  return {...value,operationId:value.operationId.toLowerCase()};
}
function validateGrant(row){
  const m=row?.metadata,r=pilotCoverageRequest(m?.request);
  if(!usageExact(m,['version','request','requestDigest','issuer','issuedAt','expiresAt'])||m.version!==1||row.id!==grantId(r)||row.action!==action||row.organizationId!==r.organizationId||row.actorId!==m.issuer?.actorId||row.entityType!=='Worker'||row.entityId!==r.workerId||!issuerValid(m.issuer)||m.requestDigest!==usageDigest(r)||!usageInstant(m.issuedAt)||!usageInstant(m.expiresAt)||Date.parse(m.expiresAt)-Date.parse(m.issuedAt)!==86400000)fail();
  return row;
}
async function grantRows(client,organizationId){
  return (await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action='${action}' ORDER BY id LIMIT 2`,[organizationId])).rows;
}
async function clock(client){const at=usageInstant((await client.query('SELECT clock_timestamp() AS now')).rows[0]?.now);if(!at)fail();return at;}
async function revocation(client,row){
  const rows=(await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='${revokedAction}'`,[revokeId(row.id),row.organizationId])).rows;
  if(rows.length>1)fail();
  if(rows.length){const v=rows[0],m=v.metadata;if(!usageExact(m,['version','grantId','grantDigest','operationId','issuer','revokedAt'])||m.version!==1||m.grantId!==row.id||m.grantDigest!==usageDigest(row.metadata)||!operationId(m.operationId)||!issuerValid(m.issuer)||!usageInstant(m.revokedAt)||v.actorId!==m.issuer.actorId||v.entityType!=='Worker'||v.entityId!==row.entityId)fail();}
  return rows[0]||null;
}
async function reservations(client,row){
  const rows=(await client.query(`SELECT id,"organizationId","actorId","entityType","entityId",metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND action='organization.usage.resource' AND metadata->'pilotCoverage'->>'grantId'=$2 ORDER BY id LIMIT 2`,[row.organizationId,row.id])).rows;
  if(rows.length>1)fail();
  for(const item of rows){const m=item.metadata,b=resourceUsageBinding(m?.binding);if(item.id!==resourceUsageId(b)||item.organizationId!==b.organizationId||item.actorId!==b.actorId||item.entityType!==b.resourceType||item.entityId!==b.resourceId||m.version!==2||m.bindingDigest!==usageDigest(b)||m.pendingKey!==resourceUsagePendingKey(b)||!['RESERVED','DISPATCHED','UNKNOWN','OBSERVED','UNMEASURED'].includes(m.state)||!bindingValid(m.pilotCoverage)||m.pilotCoverage.grantDigest!==usageDigest(row.metadata))fail();}
  return rows;
}
async function target(client,request){
  const organizations=(await client.query(`SELECT id FROM public."Organization" WHERE id=$1 AND COALESCE(metadata->'internal','false'::jsonb)<>'true'::jsonb FOR SHARE`,[request.organizationId])).rows;
  if(organizations.length!==1)fail('PILOT_COVERAGE_TARGET_UNAVAILABLE',409);
  const projects=(await client.query(`SELECT id FROM public."Project" WHERE id=$1 AND "organizationId"=$2 AND status='ACTIVE' FOR SHARE`,[request.projectId,request.organizationId])).rows;
  if(projects.length!==1)fail('PILOT_COVERAGE_TARGET_UNAVAILABLE',409);
  const workers=(await client.query(`SELECT id,"projectId",active,metadata FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR SHARE`,[request.workerId,request.projectId])).rows;
  const worker=workers[0],p=worker?.metadata?.participant;
  if(workers.length!==1||worker.active!==true||p?.version!==1||!['INVITED','ACTIVE'].includes(p.status))fail('PILOT_COVERAGE_TARGET_UNAVAILABLE',409);
  return worker;
}
async function currentSource(client,request,binding){
  const worker=await target(client,request),k=worker.metadata.participant.kyc,a=k?.processing?.auto;
  if(!['PENDING_REVIEW','PENDING_ACCOUNT_CLAIM'].includes(k?.status)||k.processing.automatic!==true||a?.organizationId!==request.organizationId||a.projectId!==request.projectId||a.workerId!==request.workerId||!workspaceId(a.submissionId)||!usageHash(a.contentHash)||request.expectedSubmissionId!==null&&(a.submissionId!==request.expectedSubmissionId||a.contentHash!==request.expectedContentHash))return false;
  const stage=k.processing.stages?.ocr;if(!['PENDING','WAITING_CONFIGURATION'].includes(stage?.state)&&!(stage?.state==='HELD'&&stage.code==='ORGANIZATION_USAGE_COVERAGE_EXPIRED'))return false;
  const receipts=(await client.query(`SELECT id,"organizationId","actorId",action,"entityType","entityId",metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND action='participant.operation.recorded' FOR SHARE`,[a.sourceReceiptId,request.organizationId])).rows;
  if(receipts.length!==1)return false;
  let consent;try{consent=assertParticipantPreanalysisSource(k,a,receipts[0],{organizationId:request.organizationId,projectId:request.projectId,workerId:request.workerId});}catch(error){if(error instanceof WorkspaceError)return false;throw error;}
  if(!consent.ocr||k.ocrConsent?.noticeVersion!=='participant-external-ocr-v2')return false;
  const front=k.images.find(image=>image.id==='document-front');
  if(binding&&(binding.actorId!==a.sourceActorId||binding.projectId!==request.projectId||binding.resourceType!=='Worker'||binding.resourceId!==request.workerId||binding.stage!=='IDENTITY_OPENAI_OCR'||binding.requestedModel!=='gpt-4o'||binding.consentVersion!=='participant-external-ocr-v2'||binding.operationId!==a.operationId||binding.requestDigest!==usageDigest(a)||binding.resourceRevision!==digest(['participant-ocr-resource-v1',a.submissionId,a.contentHash])||binding.sourceSha256!==front?.sha256))return false;
  return true;
}
const publicGrant=(row,at,revoked,used,issuerCurrent)=>({version:1,preset:PILOT_KYC_PRESET,grantId:row.id,organizationId:row.organizationId,projectId:row.metadata.request.projectId,workerId:row.entityId,observedAt:at,issuedAt:row.metadata.issuedAt,expiresAt:row.metadata.expiresAt,limit:1,remaining:used?0:1,state:revoked?'REVOKED':!issuerCurrent?'ISSUER_UNAVAILABLE':Date.parse(at)>=Date.parse(row.metadata.expiresAt)?'EXPIRED':used?'CONSUMED':'AVAILABLE',commercialSubscriptionChanged:false});

export function createPilotKycCoverage({connect,authority=productionPlatformOperatorAuthority}={}){
  if(!authority||['requireCurrent','requireIssuerCurrent','readIssuerCurrent'].some(key=>typeof authority[key]!=='function'))throw new TypeError('Canonical platform authority required');
  async function issuerCurrent(client,row,readOnly=false){try{await authority[readOnly?'readIssuerCurrent':'requireIssuerCurrent'](client,row.metadata.issuer);return true;}catch(error){if(error instanceof WorkspaceError&&error.status===403)return false;throw error;}}
  async function within(cap,organizationId,fn){
    if(typeof connect!=='function')throw new TypeError('Canonical connector required');
    let client,broken=false;
    try{client=await connect();await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');await client.query("SET LOCAL statement_timeout='6000ms'");await client.query("SET LOCAL lock_timeout='2500ms'");await lockPilotUsage(client,organizationId);const operator=await authority.requireCurrent(client,cap);const result=await fn(client,operator);await client.query('COMMIT');return result;}
    catch(error){if(client)try{await client.query('ROLLBACK');}catch{broken=true;}if(error instanceof WorkspaceError)throw error;fail();}finally{client?.release(broken);}
  }
  async function status(client,row,readOnly=false){const at=await clock(client),revoked=await revocation(client,row),used=await reservations(client,row),current=await issuerCurrent(client,row,readOnly);return publicGrant(row,at,revoked,used.length,current);}
  async function eligible(client,binding,pilot=null,receiptId=null){
    const rows=await grantRows(client,binding.organizationId);if(rows.length===0)return null;if(rows.length!==1)fail();const row=validateGrant(rows[0]);
    if(pilot&&(!bindingValid(pilot)||pilot.grantId!==row.id||pilot.grantDigest!==usageDigest(row.metadata)))fail('PILOT_COVERAGE_BINDING_REJECTED',409);
    const r=row.metadata.request;
    if(r.projectId!==binding.projectId||r.workerId!==binding.resourceId||binding.resourceType!=='Worker'||binding.stage!=='IDENTITY_OPENAI_OCR'||binding.consentVersion!=='participant-external-ocr-v2'||binding.requestedModel!=='gpt-4o')return null;
    const now=await clock(client);
    if(Date.parse(now)<Date.parse(row.metadata.issuedAt)||Date.parse(now)>=Date.parse(row.metadata.expiresAt)||await revocation(client,row)||!await issuerCurrent(client,row))return null;
    const used=await reservations(client,row);
    if(receiptId?used.length!==1||used[0].id!==receiptId:used.length!==0)return null;
    if(!await currentSource(client,r,binding))return null;
    const finalNow=await clock(client);if(Date.parse(finalNow)<Date.parse(row.metadata.issuedAt)||Date.parse(finalNow)>=Date.parse(row.metadata.expiresAt))return null;
    return {binding:{version:1,grantId:row.id,grantDigest:usageDigest(row.metadata)},expiresAt:row.metadata.expiresAt};
  }
  return {
    async companyProjection(client,organizationId){
      if(!workspaceId(organizationId))fail('PILOT_COVERAGE_INPUT_INVALID',400);
      const rows=await grantRows(client,organizationId);if(rows.length>1)fail();if(!rows.length)return null;
      const value=await status(client,validateGrant(rows[0]),true);
      return Object.fromEntries(['version','preset','observedAt','issuedAt','expiresAt','limit','remaining','state'].map(key=>[key,value[key]]));
    },
    async create(cap,value){const request=pilotCoverageRequest(value);return within(cap,request.organizationId,async(client,operator)=>{
      const rows=await grantRows(client,request.organizationId);if(rows.length>1)fail();
      if(rows.length){const old=validateGrant(rows[0]);if(old.id!==grantId(request)||old.metadata.requestDigest!==usageDigest(request)||old.actorId!==operator.actorId||old.metadata.issuer.clerkUserId!==operator.clerkUserId)fail('PILOT_COVERAGE_ALREADY_ISSUED',409);return {...await status(client,old),recovered:true};}
      const worker=await target(client,request),k=worker.metadata.participant.kyc;
      if(request.expectedSubmissionId===null){if(k!==undefined&&(k?.version!==1||k.status!=='NOT_SUBMITTED'||k.submissionId))fail('PILOT_COVERAGE_SOURCE_CHANGED',409);}
      else if(k?.submissionId!==request.expectedSubmissionId||k.contentHash!==request.expectedContentHash||!await currentSource(client,request))fail('PILOT_COVERAGE_SOURCE_CHANGED',409);
      const at=await clock(client),metadata={version:1,request,requestDigest:usageDigest(request),issuer:{actorId:operator.actorId,clerkUserId:operator.clerkUserId},issuedAt:at,expiresAt:new Date(Date.parse(at)+86400000).toISOString()},row={id:grantId(request),organizationId:request.organizationId,actorId:operator.actorId,action,entityType:'Worker',entityId:request.workerId,metadata};
      await authority.requireCurrent(client,cap);
      await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'${action}','Worker',$4,$5::jsonb)`,[row.id,row.organizationId,row.actorId,row.entityId,JSON.stringify(metadata)]);
      return publicGrant(row,at,null,0,true);
    });},
    async read(cap,value){if(!usageExact(value,['organizationId'])||!workspaceId(value.organizationId))fail('PILOT_COVERAGE_INPUT_INVALID',400);return within(cap,value.organizationId,async client=>{const rows=await grantRows(client,value.organizationId);if(rows.length>1)fail();return rows.length?status(client,validateGrant(rows[0])):null;});},
    async revoke(cap,value){if(!usageExact(value,['organizationId','grantId','operationId'])||!workspaceId(value.organizationId)||!/^organization_pilot_[a-f0-9]{64}$/.test(value.grantId||'')||!operationId(value.operationId))fail('PILOT_COVERAGE_INPUT_INVALID',400);const input={...value,operationId:value.operationId.toLowerCase()};return within(cap,input.organizationId,async(client,operator)=>{
      const rows=await grantRows(client,input.organizationId);if(rows.length!==1)fail('PILOT_COVERAGE_NOT_FOUND',404);const row=validateGrant(rows[0]);if(row.id!==input.grantId)fail('PILOT_COVERAGE_NOT_FOUND',404);const old=await revocation(client,row);
      if(old){if(old.metadata.operationId!==input.operationId||old.actorId!==operator.actorId)fail('PILOT_COVERAGE_REVOCATION_CONFLICT',409);return {...await status(client,row),recovered:true};}
      const at=await clock(client),metadata={version:1,grantId:row.id,grantDigest:usageDigest(row.metadata),operationId:input.operationId,issuer:{actorId:operator.actorId,clerkUserId:operator.clerkUserId},revokedAt:at};
      await authority.requireCurrent(client,cap);
      await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'${revokedAction}','Worker',$4,$5::jsonb)`,[revokeId(row.id),row.organizationId,operator.actorId,row.entityId,JSON.stringify(metadata)]);
      return {...await status(client,row),state:'REVOKED'};
    });},
    async reserve(client,binding){return (await eligible(client,resourceUsageBinding(binding)))?.binding||null;},
    async fence(client,binding,pilot,receiptId){if(!bindingValid(pilot))fail('PILOT_COVERAGE_BINDING_REJECTED',409);const result=await eligible(client,resourceUsageBinding(binding),pilot,receiptId);return result?{expiresAt:result.expiresAt}:null;},
  };
}
export const productionPilotResourceCoverage=createPilotKycCoverage();
