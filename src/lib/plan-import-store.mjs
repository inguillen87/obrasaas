import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,operationId,workspaceId} from './workspace-policy.mjs';
import {canImportPlan,canApprovePlan,planContext,decodePlanSource,normalizePlanRows,normalizePlanDecision,planDecisionDigest,PLAN_IMPORT_CONSENT} from './plan-import-policy.mjs';
import {assertPrivateImageConfigured} from './private-image-upload.mjs';

const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const draftKey=(actor,project,operation)=>'plan_draft_'+digest([actor,project,operation.toLowerCase()]);
const receiptKey=(actor,project,operation)=>'plan_receipt_'+digest([actor,project,operation.toLowerCase()]);
const pending=status=>['UPLOADING','PROCESSING'].includes(status);
const leaseExpiry=m=>{const value=m.lease?.expiresAt;return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value?value:null;};
const publicDraft=row=>{const m=row.metadata,expiry=leaseExpiry(m);return {id:row.id,revision:m.revision,status:m.status,existingTaskCount:m.existingTaskCount,source:{contentType:m.source.contentType,bytes:m.source.bytes,sha256:m.source.sha256},rows:m.rows||[],warnings:m.warnings||[],failure:m.failure||null,createdAt:m.createdAt,updatedAt:m.updatedAt,processingExpired:Boolean(pending(m.status)&&expiry&&Date.parse(expiry)<=Date.now()),...(pending(m.status)?{processingExpiresAt:expiry}:{}),decision:m.decision||null,sourceAvailable:m.sourceConfirmed===true};};
const taskColumns=`id,title,status::text AS status,progress,to_char("startsAt",'YYYY-MM-DD') AS "startsOn",to_char("endsAt",'YYYY-MM-DD') AS "endsOn",to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision`;
export function createPlanImport({workspace,put,get,analyzer,environment=()=>process.env}) {
 if(typeof workspace?.projectOperation!=='function'||typeof put!=='function'||typeof get!=='function'||typeof analyzer?.analyze!=='function')throw new TypeError('Explicit plan import adapters required');
 const run=(s,c,w,f)=>workspace.projectOperation(s,c,w,f);
 const permission=(member,approval=false)=>{if(!(approval?canApprovePlan(member.role):canImportPlan(member.role)))fail('PLAN_IMPORT_PERMISSION_REQUIRED',403);};
 const baseline=async(client,projectId)=>{
  const rows=(await client.query(`SELECT ${taskColumns} FROM public."Task" WHERE "projectId"=$1 ORDER BY id LIMIT 5001`,[projectId])).rows;
  if(rows.length>5000)fail('PLAN_IMPORT_SCHEDULE_TOO_LARGE',413);return {hash:digest(rows),count:rows.length};
 };
 const assertSourceUnused=async(client,member,projectId,sha256)=>{
  const applied=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='plan.import.draft' AND metadata->>'status'='APPLIED' AND metadata->'source'->>'sha256'=$3 LIMIT 1`,[member.organizationId,projectId,sha256])).rows;
  if(applied.length)fail('PLAN_IMPORT_SOURCE_ALREADY_APPLIED');
 };
 const draft=async(client,member,projectId,id,lock=false)=>{
  if(!workspaceId(id))fail('PLAN_IMPORT_DRAFT_UNAVAILABLE',404);
  const row=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='plan.import.draft' ${lock?'FOR UPDATE':''}`,[id,member.organizationId,projectId])).rows[0];
  if(row?.metadata?.version!==1||row.metadata.projectId!==projectId)fail('PLAN_IMPORT_DRAFT_UNAVAILABLE',404);return row;
 };
 async function update(client,row,patch,lease) {
  const metadata={...row.metadata,...patch,revision:row.metadata.revision+1,updatedAt:new Date().toISOString()};
  const result=await client.query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1 AND action='plan.import.draft' ${lease?"AND metadata->'lease'->>'token'=$3 AND metadata->'lease'->>'expiresAt'=$4 AND $4::timestamptz>clock_timestamp()":''} RETURNING id`,[row.id,JSON.stringify(metadata),...(lease?[lease,leaseExpiry(row.metadata)]:[])]);
  if(lease&&result.rows.length!==1)fail('PLAN_IMPORT_PROCESSING_EXPIRED');return {id:row.id,metadata};
 }
 async function storedSource(source) {
  const value=await get(source.pathname,{access:'private',useCache:false,abortSignal:AbortSignal.timeout(20000)});
  let url;try{url=new URL(value?.blob?.url||'');}catch{await value?.stream?.cancel?.().catch(()=>{});fail('PLAN_IMPORT_STORAGE_UNCONFIRMED',503);}
  if(value.statusCode!==200||value.blob.pathname!==source.pathname||value.blob.size!==source.bytes||value.blob.contentType?.split(';')[0]!==source.contentType||url.protocol!=='https:'||!/^[-a-z0-9]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname)||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'+source.pathname){await value?.stream?.cancel?.().catch(()=>{});fail('PLAN_IMPORT_STORAGE_UNCONFIRMED',503);}
   const reader=value.stream?.getReader();if(!reader)fail('PLAN_IMPORT_STORAGE_UNCONFIRMED',503);let size=0;const parts=[];
  try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>source.bytes)fail('PLAN_IMPORT_SOURCE_INTEGRITY',503);parts.push(Buffer.from(item.value));}
   let sourceFile;try{sourceFile=decodePlanSource(Buffer.concat(parts),source.contentType);}catch{fail('PLAN_IMPORT_SOURCE_INTEGRITY',503);}if(sourceFile.bytes.length!==source.bytes||sourceFile.sha256!==source.sha256)fail('PLAN_IMPORT_SOURCE_INTEGRITY',503);return sourceFile;
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 }
 const ownedLease=(row,lease)=>{if(row.metadata.lease?.token!==lease||!pending(row.metadata.status))fail('PLAN_IMPORT_REVISION_CHANGED');const expiry=leaseExpiry(row.metadata);if(!expiry)fail('PLAN_IMPORT_LEASE_INVALID');if(Date.parse(expiry)<=Date.now())fail('PLAN_IMPORT_PROCESSING_EXPIRED');};
 const receipt=async(client,member,projectId,key)=>(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='plan.import.decision'`,[receiptKey(member.actorId,projectId,key),member.organizationId,member.actorId,projectId])).rows[0];
 const receiptOutcome=async(client,projectId,row)=>{
  const outcome=row.metadata.outcome,ids=outcome.taskSnapshots?.map(t=>t.id)||[];
  const tasks=ids.length?(await client.query(`SELECT ${taskColumns} FROM public."Task" WHERE "projectId"=$1 AND id=ANY($2::text[]) ORDER BY id`,[projectId,ids])).rows:[];
  if(tasks.length!==ids.length)fail('PLAN_IMPORT_RECEIPT_INTEGRITY');return {saved:true,receiptId:row.id,...outcome,tasks};
 };
 return {
  async read(session,context) {
   // Exact receipt reads take the canonical Project lock without writing data,
   // so an in-flight finalization commits before lease expiry is classified.
   planContext(context);return run(session,context,Boolean(context.operationId),async(client,member,scope)=>{
    permission(member);
    if(context.operationId){if(!operationId(context.operationId))fail('PLAN_IMPORT_INPUT_INVALID',400);const recorded=await receipt(client,member,context.projectId,context.operationId);if(recorded)return {scope,projectId:context.projectId,state:'RECORDED',...await receiptOutcome(client,context.projectId,recorded)};
     const prior=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='plan.import.draft'`,[draftKey(member.actorId,context.projectId,context.operationId),member.organizationId,member.actorId,context.projectId])).rows[0];
     if(!prior)return {scope,projectId:context.projectId,state:'NOT_OBSERVED',definitive:false};
     const found=publicDraft(prior);return found.processingExpired?{scope,projectId:context.projectId,operationId:context.operationId.toLowerCase(),state:'EXPIRED',saved:false,definitive:true,draft:found}:{scope,projectId:context.projectId,state:'RECORDED',draft:found};
    }
    if(context.draftId)return {scope,projectId:context.projectId,draft:publicDraft(await draft(client,member,context.projectId,context.draftId))};
    const records=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityId"=$2 AND action='plan.import.draft' ORDER BY "createdAt" DESC,id DESC LIMIT 21`,[member.organizationId,context.projectId])).rows;
    return {scope,projectId:context.projectId,canApprove:canApprovePlan(member.role),drafts:records.slice(0,20).map(publicDraft),truncated:records.length>20};
   });
  },
  async source(session,context) {
   planContext(context);const source=await run(session,context,false,async(client,member)=>{permission(member);const row=await draft(client,member,context.projectId,context.draftId);if(!row.metadata.sourceConfirmed)fail('PLAN_IMPORT_STORAGE_UNCONFIRMED',503);return row.metadata.source;});
   const file=await storedSource(source);
   // Verify access again after remote storage; revoked membership cannot receive bytes.
   await run(session,context,false,async(client,member)=>{permission(member);await draft(client,member,context.projectId,context.draftId);});return file;
  },
  async attach(session,input) {
   planContext(input);if(!operationId(input.operationId)||input.consent!==PLAN_IMPORT_CONSENT)fail('PLAN_IMPORT_CONSENT_REQUIRED',400);
   const sourceFile=decodePlanSource(input.source?.bytes,input.source?.contentType),requestDigest=digest([input.projectId,input.scope,input.consent,sourceFile.sha256]),lease=randomUUID();
   const reservation=await run(session,input,true,async(client,member,scope)=>{
    permission(member);const id=draftKey(member.actorId,input.projectId,input.operationId);
    const previous=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='plan.import.draft'`,[id,member.organizationId,member.actorId])).rows[0];
    if(previous){if(previous.metadata.requestDigest!==requestDigest)fail('PLAN_IMPORT_OPERATION_CONFLICT');return {done:{scope,projectId:input.projectId,saved:true,replayed:true,draft:publicDraft(previous)}};}
    await assertSourceUnused(client,member,input.projectId,sourceFile.sha256);
    const schedule=await baseline(client,input.projectId),now=new Date().toISOString(),source={contentType:sourceFile.contentType,bytes:sourceFile.bytes.length,sha256:sourceFile.sha256,pathname:`obrasaas/plan-import/v1/${digest([member.organizationId,input.projectId,member.actorId,input.operationId.toLowerCase(),sourceFile.sha256])}/cronograma.${sourceFile.extension}`};
    const metadata={version:1,projectId:input.projectId,requestDigest,baseline:schedule.hash,existingTaskCount:schedule.count,revision:1,status:'UPLOADING',source,sourceConfirmed:false,consent:{version:input.consent,actorId:member.actorId,recordedAt:now},lease:{token:lease,expiresAt:new Date(Date.now()+10*60000).toISOString()},createdAt:now,updatedAt:now};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.import.draft','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,input.projectId,JSON.stringify(metadata)]);return {id,source};
   });
   if(reservation.done)return reservation.done;
   let extraction,confirmed=false;
   try {
    assertPrivateImageConfigured(environment());
    try{await storedSource(reservation.source);}catch(error){if(error.code==='PLAN_IMPORT_SOURCE_INTEGRITY')throw error;
     try{await put(reservation.source.pathname,sourceFile.bytes,{access:'private',contentType:sourceFile.contentType,addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60,abortSignal:AbortSignal.timeout(20000)});}catch{/* Confirm the deterministic object after uncertain delivery; never overwrite. */}
     await storedSource(reservation.source);
    }confirmed=true;
    await run(session,input,true,async(client,member)=>{permission(member);const row=await draft(client,member,input.projectId,reservation.id,true);ownedLease(row,lease);await update(client,row,{status:'PROCESSING',sourceConfirmed:true},lease);});
    // Provider and private storage IO run outside the canonical transaction.
    extraction=await analyzer.analyze(sourceFile);
    if(extraction?.success===true)extraction={success:true,rows:normalizePlanRows(extraction.rows),warnings:Array.isArray(extraction.warnings)?extraction.warnings.slice(0,20):[],provider:extraction.provider,model:extraction.model,requestedModel:extraction.requestedModel};
   }catch(error){if(error instanceof WorkspaceError&&['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_MEMBERSHIP_REQUIRED','WORKSPACE_PROJECT_UNAVAILABLE','PLAN_IMPORT_PERMISSION_REQUIRED'].includes(error.code))throw error;extraction={success:false,code:confirmed?'AI_REQUEST_UNCONFIRMED':'PLAN_IMPORT_STORAGE_UNCONFIRMED'};}
   return run(session,input,true,async(client,member,scope)=>{
    permission(member);const row=await draft(client,member,input.projectId,reservation.id,true);ownedLease(row,lease);
    const saved=await update(client,row,extraction?.success===true?{status:'READY',sourceConfirmed:true,rows:extraction.rows,extractedRows:extraction.rows,warnings:extraction.warnings,analysis:{provider:extraction.provider,model:extraction.model,requestedModel:extraction.requestedModel,reviewed:false},lease:null}:{status:'FAILED',sourceConfirmed:confirmed,failure:/^[A-Z_]{1,80}$/.test(extraction?.code||'')?extraction.code:'AI_RESPONSE_UNCONFIRMED',lease:null},lease);
    return {scope,projectId:input.projectId,saved:true,replayed:false,draft:publicDraft(saved)};
   });
  },
  async decide(session,body) {
   const input=normalizePlanDecision(body),requestDigest=planDecisionDigest(input);
   return run(session,input,true,async(client,member,scope)=>{
    permission(member,input.action!=='EDIT');const previous=await receipt(client,member,input.projectId,input.operationId);
    if(previous){if(previous.metadata.requestDigest!==requestDigest)fail('PLAN_IMPORT_OPERATION_CONFLICT');return {scope,projectId:input.projectId,replayed:true,...await receiptOutcome(client,input.projectId,previous)};}
    const row=await draft(client,member,input.projectId,input.draftId,true),m=row.metadata;
    if(m.revision!==input.expectedRevision||m.status!=='READY')fail('PLAN_IMPORT_REVISION_CHANGED');
    const id=receiptKey(member.actorId,input.projectId,input.operationId),taskSnapshots=[];
    if(input.action==='APPLY') {
     await assertSourceUnused(client,member,input.projectId,m.source.sha256);
     if((await baseline(client,input.projectId)).hash!==m.baseline)fail('PLAN_IMPORT_SCHEDULE_CHANGED');
     for(const [index,item] of input.rows.entries()) {
      const taskId='task_'+randomUUID().replaceAll('-','');
      await client.query(`INSERT INTO public."Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata,"updatedAt") VALUES($1,$2,$3,'BACKLOG',0,$4::date,$5::date,$6::jsonb,clock_timestamp())`,[taskId,input.projectId,item.title,item.startsOn,item.endsOn,JSON.stringify({source:'authorized-plan-import',planImport:{version:1,draftId:row.id,receiptId:id,sourceSha256:m.source.sha256,row:index+1,evidence:item.evidence}})]);
      taskSnapshots.push((await client.query(`SELECT ${taskColumns} FROM public."Task" WHERE id=$1 AND "projectId"=$2`,[taskId,input.projectId])).rows[0]);
     }
    }
    const recordedAt=new Date().toISOString(),decision={action:input.action,actorId:member.actorId,reason:input.reason,recordedAt,receiptId:id};
    const saved=await update(client,row,{status:input.action==='APPLY'?'APPLIED':input.action==='REJECT'?'REJECTED':'READY',...(input.rows?{rows:input.rows}:{}),...(input.action==='EDIT'?{}:{decision})});
    const outcome={action:input.action,draft:publicDraft(saved),taskSnapshots,recordedAt};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.import.decision','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,input.projectId,JSON.stringify({version:1,projectId:input.projectId,requestDigest,sourceSha256:m.source.sha256,beforeRevision:m.revision,beforeRows:m.rows,reviewedRows:input.rows,reason:input.reason,outcome})]);
    return {scope,projectId:input.projectId,saved:true,replayed:false,receiptId:id,...outcome,tasks:taskSnapshots};
   });
  }
 };
}
