import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest,operationId,workspaceId} from './workspace-policy.mjs';
import {canImportPlan,canApprovePlan,planContext,decodePlanSource,normalizePlanRows,normalizePlanDecision,planDecisionDigest,planImportRowRejection,PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT,isPlanSourceConsent,validatePlanSourceRows} from './plan-import-policy.mjs';
import {PLAN_OOXML_TYPES,validatePlanOoxml,safePlanOoxmlAnalysis} from './plan-import-ooxml.mjs';
import {assertPrivateImageConfigured} from './private-image-upload.mjs';

const fail=(code,status=409)=>{throw new WorkspaceError(code,status);};
const draftKey=(actor,project,operation)=>'plan_draft_'+digest([actor,project,operation.toLowerCase()]);
const receiptKey=(actor,project,operation)=>'plan_receipt_'+digest([actor,project,operation.toLowerCase()]);
const pending=status=>['UPLOADING','PROCESSING'].includes(status);
const decisionRejections=new Set(['PLAN_IMPORT_ROWS_LIMIT','PLAN_IMPORT_ROWS_INVALID','PLAN_IMPORT_DATES_INVALID','PLAN_IMPORT_DUPLICATE_ROWS','PLAN_IMPORT_REVIEW_REQUIRED','PLAN_IMPORT_REVISION_CHANGED','PLAN_IMPORT_SCHEDULE_CHANGED','PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE']);
const uploadRejections=new Set(['PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE']);
const uploadInputDigest=(input,source)=>digest(['plan-import-upload-command-v1',{action:'UPLOAD',consent:input.consent,operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,source:{bytes:source.bytes.length,contentType:source.contentType,sha256:source.sha256}}]);
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const commandDigest=body=>digest(['plan-import-command-v1',canonical({...body,operationId:body.operationId.toLowerCase()})]);
// A rejected row set still needs a valid, bounded command envelope. Only the
// policy's typed row diagnostics can take this path; malformed commands cannot.
function decisionInput(body) {
 try{return {input:normalizePlanDecision(body),inputDigest:commandDigest(body)};}catch(error){
  if(!(error instanceof WorkspaceError)||!planImportRowRejection(error)||!decisionRejections.has(error.code))throw error;
  const keys=['action','draftId','expectedRevision','operationId','projectId','reason','rows','scope'];
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join('|')!==keys.sort().join('|')||!operationId(body.operationId)||!workspaceId(body.draftId)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1||!['EDIT','APPLY','REJECT'].includes(body.action))fail('PLAN_IMPORT_INPUT_INVALID',400);
  planContext(body);
  return {input:{...body,operationId:body.operationId.toLowerCase()},inputDigest:commandDigest(body),rejection:error};
 }
}
const leaseExpiry=m=>{const value=m.lease?.expiresAt;return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value?value:null;};
const publicDraft=row=>{const m=row.metadata,expiry=leaseExpiry(m),spreadsheet=m.analysis?.provider==='local-ooxml'?safePlanOoxmlAnalysis(m.analysis.spreadsheet):null;return {id:row.id,revision:m.revision,status:m.status,existingTaskCount:m.existingTaskCount,source:{contentType:m.source.contentType,bytes:m.source.bytes,sha256:m.source.sha256},rows:m.rows||[],warnings:m.warnings||[],...(spreadsheet?{spreadsheet:{...spreadsheet,reviewed:m.analysis.reviewed===true}}:{}),failure:m.failure||null,createdAt:m.createdAt,updatedAt:m.updatedAt,processingExpired:Boolean(pending(m.status)&&expiry&&Date.parse(expiry)<=Date.now()),...(pending(m.status)?{processingExpiresAt:expiry}:{}),decision:m.decision||null,sourceAvailable:m.sourceConfirmed===true};};
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
 const uploadReceipt=async(client,member,projectId,key)=>(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND "entityId"=$4 AND action='plan.import.upload'`,[receiptKey(member.actorId,projectId,key),member.organizationId,member.actorId,projectId])).rows[0];
 const uploadOutcome=(member,projectId,row,operation)=>{
  const m=row.metadata,o=m?.outcome;
  if(row.id!==receiptKey(member.actorId,projectId,operation)||m?.version!==1||m.projectId!==projectId||!o||Object.keys(o).sort().join('|')!=='action|code|definitive|inputDigest|operationId|phase|proof|recordedAt|reservationStarted|saved|state|taskEffects|taskSnapshots'||o.state!=='REJECTED'||o.saved!==false||o.definitive!==true||o.phase!=='PRE_RESERVATION'||o.proof!=='AUDITED_UPLOAD'||o.reservationStarted!==false||o.taskEffects!==false||o.action!=='UPLOAD'||!uploadRejections.has(o.code)||!operationId(o.operationId)||o.operationId!==operation.toLowerCase()||o.inputDigest!==m.inputDigest||m.requestDigest!==m.inputDigest||!/^[a-f0-9]{64}$/.test(o.inputDigest)||typeof o.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(o.recordedAt)||!Number.isFinite(Date.parse(o.recordedAt))||new Date(o.recordedAt).toISOString()!==o.recordedAt||!Array.isArray(o.taskSnapshots)||o.taskSnapshots.length)fail('PLAN_IMPORT_RECEIPT_INTEGRITY',503);
  return {replayed:true,receiptId:row.id,...o,tasks:[]};
 };
 const receiptOutcome=async(client,projectId,row)=>{
  if(row.metadata.outcome?.state==='REJECTED'){
   const m=row.metadata,o=m.outcome;
   if(m.version!==1||m.projectId!==projectId||!decisionRejections.has(o.code)||o.phase!=='PRE_DECISION'||o.saved!==false||o.definitive!==true||o.taskEffects!==false||!operationId(o.operationId)||!['EDIT','APPLY','REJECT'].includes(o.action)||!workspaceId(o.draftId)||!Number.isSafeInteger(o.expectedRevision)||o.expectedRevision<1||o.inputDigest!==m.inputDigest||!/^[a-f0-9]{64}$/.test(o.inputDigest)||!Array.isArray(o.taskSnapshots)||o.taskSnapshots.length)fail('PLAN_IMPORT_RECEIPT_INTEGRITY',503);
   return {replayed:true,receiptId:row.id,...o,tasks:[]};
  }
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
     if(!prior){const rejected=await uploadReceipt(client,member,context.projectId,context.operationId);if(rejected)return {scope,projectId:context.projectId,...uploadOutcome(member,context.projectId,rejected,context.operationId)};return {scope,projectId:context.projectId,state:'NOT_OBSERVED',definitive:false};}
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
   planContext(input);if(!operationId(input.operationId)||![PLAN_IMPORT_CONSENT,PLAN_IMPORT_SPREADSHEET_CONSENT,PLAN_IMPORT_CYP_CONSENT].includes(input.consent))fail('PLAN_IMPORT_CONSENT_REQUIRED',400);
   const sourceFile=decodePlanSource(input.source?.bytes,input.source?.contentType);if(!isPlanSourceConsent(sourceFile.contentType,input.consent))fail('PLAN_IMPORT_CONSENT_REQUIRED',400);
   if(PLAN_OOXML_TYPES[sourceFile.contentType])await validatePlanOoxml(sourceFile.bytes,sourceFile.contentType);
   const requestDigest=digest([input.projectId,input.scope,input.consent,sourceFile.sha256]),inputDigest=uploadInputDigest(input,sourceFile),lease=randomUUID();
   const reservation=await run(session,input,true,async(client,member,scope)=>{
    permission(member);const id=draftKey(member.actorId,input.projectId,input.operationId);
    const previous=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "actorId"=$3 AND action='plan.import.draft'`,[id,member.organizationId,member.actorId])).rows[0];
    if(previous){if(previous.metadata.requestDigest!==requestDigest)fail('PLAN_IMPORT_OPERATION_CONFLICT');return {done:{scope,projectId:input.projectId,saved:true,replayed:true,draft:publicDraft(previous)}};}
    const rejected=await uploadReceipt(client,member,input.projectId,input.operationId);if(rejected){if(rejected.metadata.inputDigest!==inputDigest)fail('PLAN_IMPORT_OPERATION_CONFLICT');return {done:{scope,projectId:input.projectId,...uploadOutcome(member,input.projectId,rejected,input.operationId)}};}
    if(await receipt(client,member,input.projectId,input.operationId))fail('PLAN_IMPORT_OPERATION_CONFLICT');
    let schedule;try{await assertSourceUnused(client,member,input.projectId,sourceFile.sha256);schedule=await baseline(client,input.projectId);}catch(error){
     if(!(error instanceof WorkspaceError)||!uploadRejections.has(error.code))throw error;
     const id=receiptKey(member.actorId,input.projectId,input.operationId),outcome={state:'REJECTED',saved:false,definitive:true,reservationStarted:false,phase:'PRE_RESERVATION',proof:'AUDITED_UPLOAD',taskEffects:false,code:error.code,operationId:input.operationId.toLowerCase(),action:'UPLOAD',inputDigest,taskSnapshots:[],recordedAt:new Date().toISOString()};
     await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.import.upload','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,input.projectId,JSON.stringify({version:1,projectId:input.projectId,requestDigest:inputDigest,inputDigest,outcome})]);return {done:{scope,projectId:input.projectId,replayed:false,receiptId:id,...outcome,tasks:[]}};
    }
    const now=new Date().toISOString(),source={contentType:sourceFile.contentType,bytes:sourceFile.bytes.length,sha256:sourceFile.sha256,pathname:`obrasaas/plan-import/v1/${digest([member.organizationId,input.projectId,member.actorId,input.operationId.toLowerCase(),sourceFile.sha256])}/cronograma.${sourceFile.extension}`};
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
    extraction=await analyzer.analyze(sourceFile,{profile:input.consent===PLAN_IMPORT_CYP_CONSENT?'CYP_PARTIDAS':'MONTHLY_RUBROS'});
    if(extraction?.success===true){const spreadsheet=PLAN_OOXML_TYPES[sourceFile.contentType]?safePlanOoxmlAnalysis(extraction.spreadsheet):null;if(PLAN_OOXML_TYPES[sourceFile.contentType]&&(extraction.provider!=='local-ooxml'||!spreadsheet||(spreadsheet.version===2)!==(input.consent===PLAN_IMPORT_CYP_CONSENT)))fail('PLAN_IMPORT_FILE_INVALID',400);const extractedRows=normalizePlanRows(extraction.rows);validatePlanSourceRows(extractedRows,spreadsheet,extractedRows);if(spreadsheet&&spreadsheet.rowCount!==extractedRows.length)fail('PLAN_IMPORT_FILE_INVALID',400);extraction={success:true,rows:extractedRows,warnings:Array.isArray(extraction.warnings)?extraction.warnings.slice(0,20):[],provider:extraction.provider,model:extraction.model,requestedModel:extraction.requestedModel,...(spreadsheet?{spreadsheet}:{})};}
   }catch(error){if(error instanceof WorkspaceError&&['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_MEMBERSHIP_REQUIRED','WORKSPACE_PROJECT_UNAVAILABLE','PLAN_IMPORT_PERMISSION_REQUIRED'].includes(error.code))throw error;extraction={success:false,code:confirmed?'AI_REQUEST_UNCONFIRMED':'PLAN_IMPORT_STORAGE_UNCONFIRMED'};}
   return run(session,input,true,async(client,member,scope)=>{
    permission(member);const row=await draft(client,member,input.projectId,reservation.id,true);ownedLease(row,lease);
    const saved=await update(client,row,extraction?.success===true?{status:'READY',sourceConfirmed:true,rows:extraction.rows,extractedRows:extraction.rows,warnings:extraction.warnings,analysis:{provider:extraction.provider,model:extraction.model,requestedModel:extraction.requestedModel,reviewed:false,...(extraction.spreadsheet?{spreadsheet:extraction.spreadsheet}:{})},lease:null}:{status:'FAILED',sourceConfirmed:confirmed,failure:/^[A-Z_]{1,80}$/.test(extraction?.code||'')?extraction.code:'AI_RESPONSE_UNCONFIRMED',lease:null},lease);
    return {scope,projectId:input.projectId,saved:true,replayed:false,draft:publicDraft(saved)};
   });
  },
  async decide(session,body,{requestBytes=0}={}) {
   const normalized=decisionInput(body),{input,inputDigest}=normalized;
   // Preserve normalized v1 fingerprints for all existing successful receipts.
   const requestDigest=normalized.rejection?digest(['plan-import-rejected-decision-v1',inputDigest]):planDecisionDigest(input);
   return run(session,input,true,async(client,member,scope)=>{
    permission(member,input.action!=='EDIT');
    if(requestBytes>256*1024){const largeDraft=await draft(client,member,input.projectId,input.draftId);if(largeDraft.metadata.consent?.version!==PLAN_IMPORT_CYP_CONSENT||largeDraft.metadata.analysis?.spreadsheet?.version!==2||!safePlanOoxmlAnalysis(largeDraft.metadata.analysis.spreadsheet))fail('PLAN_IMPORT_INPUT_INVALID',413);}
    const previous=await receipt(client,member,input.projectId,input.operationId);
    if(await uploadReceipt(client,member,input.projectId,input.operationId))fail('PLAN_IMPORT_OPERATION_CONFLICT');
    if(previous){if(previous.metadata.requestDigest!==requestDigest||previous.metadata.outcome?.state==='REJECTED'&&previous.metadata.inputDigest!==inputDigest)fail('PLAN_IMPORT_OPERATION_CONFLICT');return {scope,projectId:input.projectId,replayed:true,...await receiptOutcome(client,input.projectId,previous)};}
    const id=receiptKey(member.actorId,input.projectId,input.operationId),taskSnapshots=[];
    let row,rejection=normalized.rejection;
    // No Task or draft writes are permitted before this preflight finishes.
    if(!rejection)try{
     row=await draft(client,member,input.projectId,input.draftId,true);
     if(row.metadata.revision!==input.expectedRevision||row.metadata.status!=='READY')fail('PLAN_IMPORT_REVISION_CHANGED');
     if((row.metadata.analysis?.spreadsheet?.version===2)!==(row.metadata.consent?.version===PLAN_IMPORT_CYP_CONSENT)||row.metadata.analysis?.spreadsheet?.version===2&&!PLAN_OOXML_TYPES[row.metadata.source.contentType])fail('PLAN_IMPORT_REVIEW_REQUIRED');
     if(input.rows)validatePlanSourceRows(input.rows,row.metadata.analysis?.spreadsheet,row.metadata.extractedRows,{complete:input.action==='APPLY'});
     if(input.action==='APPLY'){
      // jsonb may reorder object keys; compare reviewed values canonically.
      // Keep command/receipt fingerprints unchanged for existing operations.
      if(PLAN_OOXML_TYPES[row.metadata.source.contentType]&&(row.metadata.analysis?.provider!=='local-ooxml'||row.metadata.analysis.reviewed!==true||!safePlanOoxmlAnalysis(row.metadata.analysis.spreadsheet)||digest(canonical(input.rows))!==digest(canonical(row.metadata.rows))))fail('PLAN_IMPORT_REVIEW_REQUIRED');
      await assertSourceUnused(client,member,input.projectId,row.metadata.source.sha256);
      if((await baseline(client,input.projectId)).hash!==row.metadata.baseline)fail('PLAN_IMPORT_SCHEDULE_CHANGED');
     }
    }catch(error){if(!(error instanceof WorkspaceError)||!decisionRejections.has(error.code))throw error;rejection=error;}
    if(rejection){
     const outcome={state:'REJECTED',saved:false,definitive:true,phase:'PRE_DECISION',taskEffects:false,code:rejection.code,operationId:input.operationId,action:input.action,draftId:input.draftId,expectedRevision:input.expectedRevision,inputDigest,taskSnapshots:[],recordedAt:new Date().toISOString()};
     await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.import.decision','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,input.projectId,JSON.stringify({version:1,projectId:input.projectId,requestDigest,inputDigest,outcome})]);
     return {scope,projectId:input.projectId,replayed:false,receiptId:id,...outcome,tasks:[]};
    }
    const m=row.metadata;
    if(input.action==='APPLY') {
     if(m.analysis?.spreadsheet?.version===2){
      const records=input.rows.map((item,index)=>({id:'task_'+randomUUID().replaceAll('-',''),title:item.title,startsOn:item.startsOn,endsOn:item.endsOn,metadata:{source:'authorized-plan-import',planImport:{version:1,draftId:row.id,receiptId:id,sourceSha256:m.source.sha256,row:index+1,evidence:item.evidence,profile:'CYP_PARTIDAS',code:item.code,parentCode:item.parentCode,groups:m.analysis.spreadsheet.groups.filter(group=>item.code.startsWith(group.code+'.')).map(group=>({code:group.code,parentCode:group.parentCode,title:group.title}))}}}));
      const parameters=[],values=records.map(record=>{const offset=parameters.length;parameters.push(record.id,input.projectId,record.title,record.startsOn,record.endsOn,JSON.stringify(record.metadata));return `($${offset+1},$${offset+2},$${offset+3},'BACKLOG',0,$${offset+4}::date,$${offset+5}::date,$${offset+6}::jsonb,clock_timestamp())`;});
      const created=(await client.query(`INSERT INTO public."Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata,"updatedAt") VALUES ${values.join(',')} RETURNING ${taskColumns}`,parameters)).rows;
      const byId=new Map(created.map(task=>[task.id,task]));if(created.length!==records.length||byId.size!==records.length)fail('PLAN_IMPORT_RECEIPT_INTEGRITY',503);
      for(const record of records){if(!byId.has(record.id))fail('PLAN_IMPORT_RECEIPT_INTEGRITY',503);taskSnapshots.push(byId.get(record.id));}
     }else for(const [index,item] of input.rows.entries()) {
      const taskId='task_'+randomUUID().replaceAll('-','');
      await client.query(`INSERT INTO public."Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata,"updatedAt") VALUES($1,$2,$3,'BACKLOG',0,$4::date,$5::date,$6::jsonb,clock_timestamp())`,[taskId,input.projectId,item.title,item.startsOn,item.endsOn,JSON.stringify({source:'authorized-plan-import',planImport:{version:1,draftId:row.id,receiptId:id,sourceSha256:m.source.sha256,row:index+1,evidence:item.evidence}})]);
      taskSnapshots.push((await client.query(`SELECT ${taskColumns} FROM public."Task" WHERE id=$1 AND "projectId"=$2`,[taskId,input.projectId])).rows[0]);
     }
    }
    const recordedAt=new Date().toISOString(),decision={action:input.action,actorId:member.actorId,reason:input.reason,recordedAt,receiptId:id};
    const saved=await update(client,row,{status:input.action==='APPLY'?'APPLIED':input.action==='REJECT'?'REJECTED':'READY',...(input.rows?{rows:input.rows}:{}),...(input.action==='EDIT'&&m.analysis?.provider==='local-ooxml'?{analysis:{...m.analysis,reviewed:true}}:{}),...(input.action==='EDIT'?{}:{decision})});
    const outcome={action:input.action,draft:publicDraft(saved),taskSnapshots,recordedAt};
    await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.import.decision','Project',$4,$5::jsonb)`,[id,member.organizationId,member.actorId,input.projectId,JSON.stringify({version:1,projectId:input.projectId,requestDigest,inputDigest,sourceSha256:m.source.sha256,beforeRevision:m.revision,beforeRows:m.rows,reviewedRows:input.rows,reason:input.reason,outcome})]);
    return {scope,projectId:input.projectId,saved:true,replayed:false,receiptId:id,...outcome,tasks:taskSnapshots};
   });
  }
 };
}
