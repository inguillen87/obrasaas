import {WorkspaceError,workspaceId,operationId} from './workspace-policy.mjs';
import {canApprovePlan} from './plan-import-policy.mjs';
import {PLAN_BASELINE_VERSION,PLAN_BASELINE_PAGE_SIZE,PLAN_BASELINE_REJECTIONS,planBaselineExact,planBaselineTimestamp,planBaselineSame,planBaselineId,planBaselineReceiptId,planBaselineContext,normalizePlanBaselineSelection,planBaselineSelectionDigest,planBaselineCursor,parsePlanBaselineCursor,appliedPlanBaselineCandidate} from './plan-baseline-policy.mjs';
import {DOCUMENT_CURVE_CONSENT,DOCUMENT_CURVE_PROFILE} from './plan-import-document-curve.mjs';

const fail=(code='PLAN_BASELINE_INTEGRITY',status=503)=>{throw new WorkspaceError(code,status);};
const candidateKeys=['draftId','draftRevision','decisionReceiptId','sourceSha256','profile','sourceRowCount','selectedRowCount','appliedAt','curve'];
const baselineKeys=['version','id','revision','selectionReceiptId',...candidateKeys,'selectedBy','selectedAt','reason'];
const documentKeys=value=>value?.profile===DOCUMENT_CURVE_PROFILE?['sourceKind','presentation']:[];
const candidateColumns=`d.id,d.metadata,d."organizationId" AS "organizationId",d."entityId" AS "entityId",r.id AS "decisionId",r.metadata AS "decisionMetadata",r."organizationId" AS "decisionOrganizationId",r."entityId" AS "decisionEntityId",r."actorId" AS "decisionActorId"`;
const candidateJoin=`FROM public."AuditLog" d LEFT JOIN public."AuditLog" r ON r.id=d.metadata->'decision'->>'receiptId' AND r.action='plan.import.decision' WHERE d."organizationId"=$1 AND d."entityId"=$2 AND d.action='plan.import.draft'`;

export function createPlanBaseline({workspace}){
 if(typeof workspace?.projectOperation!=='function')throw new TypeError('Explicit workspace transaction required');
 const permission=member=>{if(!canApprovePlan(member.role))fail('PLAN_BASELINE_PERMISSION_REQUIRED',403);};
 const candidate=async(client,member,projectId,draftId)=>{
  const row=(await client.query(`SELECT ${candidateColumns} ${candidateJoin} AND d.id=$3`,[member.organizationId,projectId,draftId])).rows[0];
  return decodedCandidate(client,member,projectId,row);
 };
 async function decodedCandidate(client,member,projectId,row){
  if(row?.metadata?.consent?.version===DOCUMENT_CURVE_CONSENT||row?.metadata?.analysis?.documentCurve?.profile===DOCUMENT_CURVE_PROFILE){
   const reviewId=row.metadata.documentReview?.receiptId;
   row.reviewReceipt=(await client.query(`SELECT id,"organizationId","actorId","entityId",action,metadata FROM public."AuditLog" WHERE id=$1 AND "organizationId"=$2 AND "entityId"=$3 AND action='plan.import.decision'`,[reviewId,member.organizationId,projectId])).rows[0]||null;
  }
  return appliedPlanBaselineCandidate(row,projectId,member.organizationId);
 }
 const receipt=async(client,id)=>(await client.query(`SELECT id,"organizationId","actorId","entityId",action,metadata FROM public."AuditLog" WHERE id=$1`,[id])).rows[0]||null;
 async function validateReceipt(client,member,projectId,row){
  const m=row?.metadata;
  if(!m||row.action!=='plan.baseline.selected'||!planBaselineExact(m,['version','organizationId','projectId','actorId','operationId','inputDigest','request','outcome'])||m.version!==PLAN_BASELINE_VERSION||!workspaceId(m.actorId)||m.organizationId!==member.organizationId||m.projectId!==projectId||row.organizationId!==member.organizationId||row.entityId!==projectId||row.actorId!==m.actorId)fail();
  let request;try{request=normalizePlanBaselineSelection(m.request);if(request.projectId!==projectId||request.operationId!==m.operationId||planBaselineSelectionDigest(request)!==m.inputDigest||row.id!==planBaselineReceiptId(m.actorId,projectId,m.operationId))fail();}catch{fail();}
  const o=m.outcome;
  if(o?.state==='REJECTED'){
   if(!planBaselineExact(o,['state','code','recordedAt'])||!PLAN_BASELINE_REJECTIONS.includes(o.code)||!planBaselineTimestamp(o.recordedAt))fail();
   return {row,request,baseline:null,code:o.code};
  }
  const b=o?.baseline;
  if(!planBaselineExact(o,['state','baseline'])||o.state!=='RECORDED'||!planBaselineExact(b,[...baselineKeys,...documentKeys(b)])||b.version!==PLAN_BASELINE_VERSION||b.id!==planBaselineId(member.organizationId,projectId)||b.revision!==request.expectedBaselineRevision+1||b.selectionReceiptId!==row.id||b.selectedBy!==m.actorId||!planBaselineTimestamp(b.selectedAt)||b.reason!==request.reason||b.draftId!==request.draftId||b.draftRevision!==request.draftRevision||b.decisionReceiptId!==request.decisionReceiptId||b.sourceSha256!==request.sourceSha256)fail();
  let origin;try{origin=await candidate(client,member,projectId,b.draftId);}catch{fail();}
  if(!planBaselineSame(Object.fromEntries([...candidateKeys,...documentKeys(b)].map(k=>[k,b[k]])),origin))fail();
  return {row,request,baseline:structuredClone(b),code:null};
 }
 async function active(client,member,projectId){
  const id=planBaselineId(member.organizationId,projectId),row=(await client.query(`SELECT id,"organizationId","actorId","entityId",action,metadata FROM public."AuditLog" WHERE id=$1`,[id])).rows[0];
  if(!row)return null;
  const m=row.metadata;
  if(row.action!=='plan.baseline.active'||row.organizationId!==member.organizationId||row.entityId!==projectId||!planBaselineExact(m,['version','organizationId','projectId','revision','selectionReceiptId'])||m.version!==PLAN_BASELINE_VERSION||m.organizationId!==member.organizationId||m.projectId!==projectId||!Number.isSafeInteger(m.revision)||m.revision<1)fail();
  const selected=await validateReceipt(client,member,projectId,await receipt(client,m.selectionReceiptId));
  if(!selected.baseline||selected.baseline.id!==id||selected.baseline.revision!==m.revision||selected.baseline.selectedBy!==row.actorId)fail();
  return selected.baseline;
 }
 const result=(scope,projectId,key,found,current,replayed)=>({version:PLAN_BASELINE_VERSION,scope,projectId,action:'SELECT',operationId:key,inputDigest:found?.row.metadata.inputDigest||null,state:found?(found.baseline?'RECORDED':'REJECTED'):'NOT_OBSERVED',saved:Boolean(found?.baseline),definitive:Boolean(found),replayed,receiptId:found?.row.id||null,phase:found?(found.baseline?'COMMITTED':'PRE_SELECTION'):'UNCONFIRMED',baselineEffects:found?Boolean(found.baseline):null,code:found?.code||null,baselineSnapshot:found?.baseline||null,active:current});
 async function insertReceipt(client,member,input,outcome){
  const id=planBaselineReceiptId(member.actorId,input.projectId,input.operationId),metadata={version:PLAN_BASELINE_VERSION,organizationId:member.organizationId,projectId:input.projectId,actorId:member.actorId,operationId:input.operationId,inputDigest:planBaselineSelectionDigest(input),request:input,outcome};
  const inserted=(await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.baseline.selected','Project',$4,$5::jsonb) RETURNING id`,[id,member.organizationId,member.actorId,input.projectId,JSON.stringify(metadata)])).rows;
  if(inserted.length!==1||inserted[0].id!==id)fail();
  return {id,organizationId:member.organizationId,actorId:member.actorId,entityId:input.projectId,action:'plan.baseline.selected',metadata};
 }
 return {
  async read(session,context){
   planBaselineContext(context);
   if(!planBaselineExact(context,['scope','projectId',...(context.operationId!==undefined?['operationId']:context.cursor!==undefined?['cursor']:[])])||context.operationId!==undefined&&context.cursor!==undefined)fail('PLAN_BASELINE_INPUT_INVALID',400);
   if(context.operationId!==undefined&&!operationId(context.operationId))fail('PLAN_BASELINE_INPUT_INVALID',400);
   return workspace.projectOperation(session,context,context.operationId!==undefined,async(client,member,scope)=>{
    permission(member);const current=await active(client,member,context.projectId);
    if(context.operationId!==undefined){const key=context.operationId.toLowerCase(),row=await receipt(client,planBaselineReceiptId(member.actorId,context.projectId,key)),found=row?await validateReceipt(client,member,context.projectId,row):null;return result(scope,context.projectId,key,found,current,Boolean(found));}
    let after='';
    if(context.cursor!==undefined){after=parsePlanBaselineCursor(context.cursor,context);try{await candidate(client,member,context.projectId,after);}catch{fail('PLAN_BASELINE_CURSOR_INVALID',400);}}
    const rows=(await client.query(`SELECT ${candidateColumns} ${candidateJoin} AND d.metadata->>'status'='APPLIED' AND (d.metadata->'analysis'->'spreadsheet'->>'version' IN ('3','4') OR d.metadata->'consent'->>'version' IN ('plan-spreadsheet-monthly-curve-v3','plan-spreadsheet-cyp-curve-v4','${DOCUMENT_CURVE_CONSENT}') OR d.metadata->'analysis'->'documentCurve'->>'profile'='${DOCUMENT_CURVE_PROFILE}') AND d.id>$3 ORDER BY d.id LIMIT ${PLAN_BASELINE_PAGE_SIZE+1}`,[member.organizationId,context.projectId,after])).rows;
    const allCandidates=[];for(const row of rows){try{allCandidates.push(await decodedCandidate(client,member,context.projectId,row));}catch{fail();}}const candidates=allCandidates.slice(0,PLAN_BASELINE_PAGE_SIZE);
    return {version:PLAN_BASELINE_VERSION,scope,projectId:context.projectId,canSelect:true,active:current,candidates,nextCursor:rows.length>PLAN_BASELINE_PAGE_SIZE?planBaselineCursor(context,candidates.at(-1).draftId):null};
   });
  },
  async select(session,value){
   const input=normalizePlanBaselineSelection(value),inputDigest=planBaselineSelectionDigest(input);
   return workspace.projectOperation(session,input,true,async(client,member,scope)=>{
    permission(member);const id=planBaselineReceiptId(member.actorId,input.projectId,input.operationId),prior=await receipt(client,id),current=await active(client,member,input.projectId);
    if(prior){const found=await validateReceipt(client,member,input.projectId,prior);if(prior.metadata.inputDigest!==inputDigest)fail('PLAN_BASELINE_OPERATION_CONFLICT',409);return result(scope,input.projectId,input.operationId,found,current,true);}
    let chosen,code=null;
    if((current?.id||null)!==input.expectedBaselineId||(current?.revision||0)!==input.expectedBaselineRevision)code='PLAN_BASELINE_REVISION_CHANGED';
    else try{chosen=await candidate(client,member,input.projectId,input.draftId);if(chosen.draftRevision!==input.draftRevision||chosen.decisionReceiptId!==input.decisionReceiptId||chosen.sourceSha256!==input.sourceSha256)code='PLAN_BASELINE_SOURCE_CHANGED';}catch(error){if(error instanceof WorkspaceError&&PLAN_BASELINE_REJECTIONS.includes(error.code))code=error.code;else throw error;}
    if(code){const row=await insertReceipt(client,member,input,{state:'REJECTED',code,recordedAt:new Date().toISOString()});return result(scope,input.projectId,input.operationId,await validateReceipt(client,member,input.projectId,row),current,false);}
    const baseline={version:PLAN_BASELINE_VERSION,id:planBaselineId(member.organizationId,input.projectId),revision:input.expectedBaselineRevision+1,selectionReceiptId:id,...chosen,selectedBy:member.actorId,selectedAt:new Date().toISOString(),reason:input.reason};
    const row=await insertReceipt(client,member,input,{state:'RECORDED',baseline}),metadata={version:PLAN_BASELINE_VERSION,organizationId:member.organizationId,projectId:input.projectId,revision:baseline.revision,selectionReceiptId:id};
    const updated=(await client.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'plan.baseline.active','Project',$4,$5::jsonb) ON CONFLICT(id) DO UPDATE SET "actorId"=EXCLUDED."actorId",metadata=EXCLUDED.metadata WHERE public."AuditLog".action='plan.baseline.active' AND public."AuditLog"."organizationId"=EXCLUDED."organizationId" AND public."AuditLog"."entityId"=EXCLUDED."entityId" AND (public."AuditLog".metadata->>'revision')::bigint=$6 RETURNING id`,[baseline.id,member.organizationId,member.actorId,input.projectId,JSON.stringify(metadata),input.expectedBaselineRevision])).rows;
    if(updated.length!==1||updated[0].id!==baseline.id)fail();
    return result(scope,input.projectId,input.operationId,await validateReceipt(client,member,input.projectId,row),await active(client,member,input.projectId),false);
   });
  }
 };
}
