import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';

const unavailable=()=>{throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);};
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|');
const cursor=row=>({id:row.id,createdAt:row.createdAt});
const timestamp=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;
export function consumptionEvidencePageShape(page){
 const point=value=>exact(value,['id','createdAt'])&&workspaceId(value.id)&&typeof value.createdAt==='string'&&timestamp.test(value.createdAt);
 return exact(page,['contextDigest','first','last','hasPrevious','hasNext'])&&/^[a-f0-9]{64}$/.test(page.contextDigest||'')&&typeof page.hasPrevious==='boolean'&&typeof page.hasNext==='boolean'&&(page.first===null)===(page.last===null)&&(page.first===null?!page.hasPrevious&&!page.hasNext:point(page.first)&&point(page.last));
}
function validCursor(value){
 if(!value||!workspaceId(value.id)||typeof value.createdAt!=='string'||!timestamp.test(value.createdAt)||value.createdAt.startsWith('0000-'))return false;
 const parsed=new Date(value.createdAt+'Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===value.createdAt.slice(0,19);
}
function entry(row,context,withProcessing=false){
 const bytes=Number(row.mediaBytes);
 if(row.workerId!==context.workerId||row.taskId!==context.taskId||row.sectorId!==context.sectorId||!workspaceId(row.id)||typeof row.title!=='string'||row.title.length>500||!['image','audio'].includes(row.mediaKind)||typeof row.contentType!=='string'||!row.contentType.startsWith(row.mediaKind+'/')||!Number.isSafeInteger(bytes)||bytes<1||bytes>3*1024*1024||!/^[a-f0-9]{64}$/.test(row.mediaSha256||'')||!timestamp.test(row.revision||'')||!['PENDING','APPROVED'].includes(row.status))unavailable();
 return {id:row.id,title:row.title,taskId:row.taskId,workerId:row.workerId,sectorId:row.sectorId,revision:row.revision,status:row.status,media:{kind:row.mediaKind,contentType:row.contentType,bytes,sha256:row.mediaSha256},...(withProcessing&&row.mediaKind==='audio'?{processing:row.processing}:{})};
}
// Internal SQL reader. Its caller must establish the current canonical principal,
// own participant, task and sector. Defaults preserve the verified Meta bridge:
// selected audio may use persisted processing and retained rows remain locked.
// The web caller explicitly selects a nonlocking, no-processing, complete mode.
export async function readConsumptionEvidenceCatalog(client,{organizationId,projectId,workerId,actorId,taskId,sectorId,page=null,direction='FIRST',retainedIds=[]},{lockRetained=true,includeRetainedProcessing=true,requireAllRetained=false}={}){
 if([organizationId,projectId,workerId,actorId,sectorId].some(value=>!workspaceId(value))||taskId!==null&&!workspaceId(taskId)||!['FIRST','REFRESH','NEXT','PREVIOUS'].includes(direction)||!Array.isArray(retainedIds)||retainedIds.length>13||retainedIds.some(value=>!workspaceId(value))||[lockRetained,includeRetainedProcessing,requireAllRetained].some(value=>typeof value!=='boolean'))unavailable();
 const contextDigest=digest(['consumption-evidence-catalog-v1',organizationId,projectId,workerId,actorId,taskId,sectorId]),size=6;
 if(direction==='FIRST'&&page!==null||direction!=='FIRST'&&page===null)unavailable();
 const field=`i.metadata->'fieldOperations'`,from=`public."Incident" i JOIN public."Project" p ON p.id=i."projectId"`;
 const visible=`i."projectId"=$1 AND p."organizationId"=$5 AND p.status='ACTIVE' AND ${field}->>'version'='1' AND ${field}->>'kind'='EVIDENCE' AND ${field}->>'taskId' IS NOT DISTINCT FROM $2::text AND ${field}->>'workerId'=$3 AND ${field}->>'recordedBy'=$4 AND ${field}->>'sectorId'=$6 AND ${field}->'review'->>'decision' IS DISTINCT FROM 'REJECT' AND ${field}->'media'->>'kind' IN ('image','audio')`;
 const values=[projectId,taskId,workerId,actorId,organizationId,sectorId];let anchor=null,order='FIRST';
 if(page){
  if(!consumptionEvidencePageShape(page)||page.contextDigest!==contextDigest||page.first!==null&&(!validCursor(page.first)||!validCursor(page.last)))unavailable();
  if(direction==='NEXT'&&!page.hasNext||direction==='PREVIOUS'&&!page.hasPrevious)unavailable();
  if(page.first){
   const anchors=(await client.query(`SELECT i.id,to_char(i."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt" FROM ${from} WHERE ${visible} AND i.id=ANY($7::text[])`,[...values,[page.first.id,page.last.id]])).rows;
   if(![page.first,page.last].every(value=>anchors.some(row=>row.id===value.id&&row.createdAt===value.createdAt)))unavailable();
   order=direction==='NEXT'?'AFTER':direction==='PREVIOUS'?'BEFORE':'INCLUSIVE';anchor=order==='AFTER'?page.last:page.first;
  }
 }
 const columns=`i.id,i.title,${field}->>'taskId' AS "taskId",${field}->>'workerId' AS "workerId",${field}->>'sectorId' AS "sectorId",${field}->'media'->>'kind' AS "mediaKind",${field}->'media'->>'contentType' AS "contentType",${field}->'media'->>'bytes' AS "mediaBytes",${field}->'media'->>'sha256' AS "mediaSha256",CASE WHEN ${field}->'review'->>'decision'='APPROVE' THEN 'APPROVED' ELSE 'PENDING' END AS status,to_char(i."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision,to_char(i."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt"`;
 const predicate=anchor?` AND (i."createdAt",i.id) ${order==='AFTER'?'<':order==='BEFORE'?'>':'<='} ($7::timestamp,$8::text)`:'';
 const found=(await client.query(`SELECT ${columns} FROM ${from} WHERE ${visible}${predicate} ORDER BY i."createdAt" ${order==='BEFORE'?'ASC':'DESC'},i.id ${order==='BEFORE'?'ASC':'DESC'} LIMIT ${size+1}`,anchor?[...values,anchor.createdAt,anchor.id]:values)).rows;
 if(!Array.isArray(found)||found.length>size+1||new Set(found.map(row=>row.id)).size!==found.length)unavailable();
 const rows=found.slice(0,size);if(order==='BEFORE')rows.reverse();let evidencePage={contextDigest,first:null,last:null,hasPrevious:false,hasNext:false};
 if(rows.length){const first=cursor(rows[0]),last=cursor(rows.at(-1));if(!validCursor(first)||!validCursor(last))unavailable();const bounds=(await client.query(`SELECT EXISTS(SELECT 1 FROM ${from} WHERE ${visible} AND (i."createdAt",i.id)>($7::timestamp,$8::text)) AS "hasPrevious",EXISTS(SELECT 1 FROM ${from} WHERE ${visible} AND (i."createdAt",i.id)<($9::timestamp,$10::text)) AS "hasNext"`,[...values,first.createdAt,first.id,last.createdAt,last.id])).rows[0];if(!bounds||typeof bounds.hasPrevious!=='boolean'||typeof bounds.hasNext!=='boolean')unavailable();evidencePage={contextDigest,first,last,...bounds};}
 const context={workerId,taskId,sectorId},entries=rows.map(row=>entry(row,context)),evidence=entries.slice(),retained=[...new Set(retainedIds)].sort();
 if(retained.length){
  const processing=includeRetainedProcessing?`,CASE WHEN ${field}->'media'->>'kind'='audio' THEN ${field}->'processing' ELSE NULL END AS processing`:'';
  const fresh=(await client.query(`SELECT ${columns}${processing} FROM ${from} WHERE ${visible} AND i.id=ANY($7::text[]) ORDER BY i.id${lockRetained?' FOR SHARE OF i':''}`,[...values,retained])).rows;
  if(!Array.isArray(fresh)||fresh.some(row=>!retained.includes(row.id))||new Set(fresh.map(row=>row.id)).size!==fresh.length||requireAllRetained&&fresh.length!==retained.length)unavailable();
  const byId=new Map(fresh.map(row=>[row.id,entry(row,context,includeRetainedProcessing)]));
  for(const id of retained){const index=evidence.findIndex(value=>value.id===id);if(index!==-1)evidence.splice(index,1);if(byId.has(id))evidence.push(byId.get(id));}
 }
 return {entries,evidence,page:evidencePage};
}
