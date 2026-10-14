import {WorkspaceError,workspaceId} from './workspace-policy.mjs';
import {siteText} from './site-register-policy.mjs';

export const OWN_FIELD_REPORT_PAGE_SIZE=5;
const fail=(code='FIELD_REPORT_UNAVAILABLE',status=404)=>{throw new WorkspaceError(code,status);};
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const receiptKeys={EVIDENCE:['field.media.recorded','EVIDENCE','evidence'],PROGRESS:['field.operation.recorded','PROPOSE_PROGRESS','proposal']};

// Receipt lookup is bounded and correlated to the original author and exact
// recorded resource. Missing/ambiguous historical proof is displayed as such.
async function reportReceipt(client,member,project,row,section,review=null){
 const [action,command,key]=receiptKeys[section],decision=review?section==='EVIDENCE'?'REVIEW_EVIDENCE':review.decision==='EXPIRED'?'EXPIRED':'DECIDE_PROGRESS':null;
 if(decision==='EXPIRED'){
  const found=(await client.query(`SELECT id FROM public."AuditLog" WHERE "organizationId"=$1 AND "entityType"='OperationalProposal' AND "entityId"=$2 AND action='field.progress.expired' AND metadata->>'projectId'=$3 AND metadata->>'proposalId'=$2 AND metadata->>'recordedAt'=$4 LIMIT 2`,[member.organizationId,row.id,project.id,review.recordedAt])).rows;
  return found.length===1&&workspaceId(found[0].id)?found[0].id:null;
 }
 const found=(await client.query(`SELECT id,metadata FROM public."AuditLog" WHERE "organizationId"=$1 AND "actorId"=$2 AND action=$3 AND metadata->>'version'='1' AND metadata->>'projectId'=$4 AND metadata->'outcome'->$5->>'id'=$6 AND ${review?`"entityType"='Project' AND "entityId"=$4 AND metadata->>'command'=$7` : section==='EVIDENCE'?`"entityType"='Incident' AND "entityId"=$6 AND metadata->'outcome'->>'kind'=$7`:`"entityType"='Project' AND "entityId"=$4 AND metadata->>'command'=$7`} LIMIT 2`,[member.organizationId,review?.actorId||member.actorId,review?'field.operation.recorded':action,project.id,key,row.id,decision||command])).rows;
 if(found.length!==1||!workspaceId(found[0].id))return null;
 const snapshot=found[0].metadata?.outcome?.[key];
 if(snapshot?.id!==row.id||snapshot.workerId!==(section==='EVIDENCE'?row.metadata.fieldOperations.workerId:row.proposedByWorkerId))return null;
 if(review){const proof=section==='EVIDENCE'?snapshot.review:snapshot.result;if(proof?.decision!==review.decision||proof.reason!==review.reason||proof.recordedAt!==review.recordedAt)return null;}
 else if(section==='EVIDENCE'?snapshot.capturedAt!==row.metadata.fieldOperations.capturedAt:snapshot.taskId!==row.action.taskId||snapshot.reason!==row.action.reason)return null;
 return found[0].id;
}

async function feedback(client,member,project,row,section,workerId){
 if(!workspaceId(row?.id))fail();
 const evidence=section==='EVIDENCE',source=evidence?row.metadata?.fieldOperations:row.action;
 if(!source||source[evidence?'version':'fieldOperationsVersion']!==1||evidence&&source.kind!=='EVIDENCE'||(evidence?source.workerId:row.proposedByWorkerId)!==workerId||source[evidence?'recordedBy':'submittedBy']!==member.actorId||!workspaceId(source.taskId)||!instant(source[evidence?'capturedAt':'submittedAt']))fail();
 const title=siteText(evidence?row.title:row.summary,500,1,true),reason=siteText(evidence?row.description||'Sin descripción registrada.':source.reason,1000,1,true),raw=evidence?source.review:row.result?.fieldOperations;
 let review=null;
 if(raw){if(!['APPROVE','REJECT',...(evidence?[]:['EXPIRED'])].includes(raw.decision)||!workspaceId(raw.actorId)||raw.decision!=='EXPIRED'&&raw.actorId===member.actorId||!instant(raw.recordedAt)||siteText(raw.reason,1000,8,true)!==raw.reason)fail('FIELD_REPORT_INTEGRITY',409);review={decision:raw.decision,reason:raw.reason,recordedAt:raw.recordedAt,receiptId:await reportReceipt(client,member,project,row,section,raw)};}
 const state=evidence?review?.decision==='APPROVE'?'APPROVED':review?.decision==='REJECT'?'REJECTED':'PENDING':row.status==='PENDING'&&row.expired===true?'EXPIRED':row.status;
 if(!['PENDING','APPROVED','REJECTED','APPLIED','EXPIRED'].includes(state)||!evidence&&(state==='APPLIED'&&review?.decision!=='APPROVE'||state==='REJECTED'&&review?.decision!=='REJECT'||state==='PENDING'&&review||state==='EXPIRED'&&review&&review.decision!=='EXPIRED'))fail('FIELD_REPORT_INTEGRITY',409);
 const receiptId=await reportReceipt(client,member,project,row,section);
 return {id:row.id,section,state,title,taskId:source.taskId,reason,submittedAt:source[evidence?'capturedAt':'submittedAt'],receiptId,review,...(evidence?{mediaKind:['image','audio','video'].includes(source.media?.kind)?source.media.kind:'UNCONFIRMED'}:{progress:typeof source.progress==='number'&&Number.isFinite(source.progress)&&source.progress>=0&&source.progress<=100?source.progress:null,expiresAt:row.expiresAt instanceof Date?row.expiresAt.toISOString():null})};
}

// The service proves/locks current membership, assignment, worker/report/KYC
// first. Both the mutable Worker and immutable author constrain every page/ID.
export async function readOwnFieldReports(client,member,project,{workerId,section,afterReport=null,reportId=null}={}){
 if(!workspaceId(workerId)||!['EVIDENCE','PROGRESS'].includes(section)||[afterReport,reportId].some(v=>v!==null&&!workspaceId(v))||afterReport&&reportId)fail('FIELD_REPORT_QUERY_INVALID',400);
 const evidence=section==='EVIDENCE',table=evidence?'public."Incident"':'public."OperationalProposal"',source=evidence?`r.metadata->'fieldOperations'`:'r.action';
 const visible=`r."projectId"=$1 AND p."organizationId"=$2 AND ${source}->>'${evidence?'version':'fieldOperationsVersion'}'='1' AND ${evidence?`${source}->>'kind'='EVIDENCE' AND ${source}->>'workerId'=$3`:`r.type='TASK_PROGRESS' AND r."sourceProvider"='account-field' AND r."proposedByWorkerId"=$3`} AND ${source}->>'${evidence?'recordedBy':'submittedBy'}'=$4`,values=[project.id,member.organizationId,workerId,member.actorId];
 if(afterReport||reportId){const found=(await client.query(`SELECT r.id FROM ${table} r JOIN public."Project" p ON p.id=r."projectId" WHERE ${visible} AND r.id=$5`,[...values,afterReport||reportId])).rows;if(found.length!==1)fail('FIELD_REPORT_CURSOR_UNAVAILABLE');}
 const selection=evidence?'r.id,r.title,r.description,r.metadata':`r.id,r.summary,r.status::text AS status,r.action,r.result,r."proposedByWorkerId",r."expiresAt",(r."expiresAt"<=transaction_timestamp()) AS expired`;
 const rows=(await client.query(`SELECT ${selection} FROM ${table} r JOIN public."Project" p ON p.id=r."projectId" WHERE ${visible} AND ($5::text IS NULL OR (r."createdAt",r.id)<(SELECT "createdAt",id FROM ${table} WHERE id=$5 AND "projectId"=$1)) AND ($6::text IS NULL OR r.id=$6) ORDER BY r."createdAt" DESC,r.id DESC LIMIT 6`,[...values,afterReport,reportId])).rows;
 if(reportId&&rows.length!==1)fail('FIELD_REPORT_CURSOR_UNAVAILABLE');
 const records=[];for(const row of rows.slice(0,OWN_FIELD_REPORT_PAGE_SIZE))records.push(await feedback(client,member,project,row,section,workerId));
 return {section,records,afterReport,reportId,nextCursor:rows.length>OWN_FIELD_REPORT_PAGE_SIZE?rows[OWN_FIELD_REPORT_PAGE_SIZE-1].id:null};
}
