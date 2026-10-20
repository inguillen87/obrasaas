import {WorkspaceError,workspaceId,digest} from './workspace-policy.mjs';

const unavailable=()=>{throw new WorkspaceError('FIELD_EVIDENCE_UNAVAILABLE',404);};
const cursor=row=>({id:row.id,createdAt:row.createdAt});
function validCursor(value){
 if(!value||Object.keys(value).sort().join('|')!=='createdAt|id'||!workspaceId(value.id)||typeof value.createdAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.createdAt)||value.createdAt.startsWith('0000-'))return false;
 const parsed=new Date(value.createdAt+'Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19)===value.createdAt.slice(0,19);
}
function selectedChoice(state,message){
 const raw=message?.type==='interactive'?(message.interactive?.list_reply?.id||message.interactive?.button_reply?.id):null,match=/^obra:([a-f0-9]{20}):(\d{1,2})$/.exec(raw||'');
 return match&&match[1]===state?.nonce?state.choices?.[Number(match[2])]?.value:null;
}
function entry(row,context,withProcessing=false){
 const bytes=Number(row.mediaBytes);
 if(row.workerId!==context.workerId||row.taskId!==context.taskId||row.sectorId!==context.sectorId||!workspaceId(row.id)||typeof row.title!=='string'||row.title.length>500||!['image','audio'].includes(row.mediaKind)||typeof row.contentType!=='string'||!row.contentType.startsWith(row.mediaKind+'/')||!Number.isSafeInteger(bytes)||bytes<1||bytes>3*1024*1024||!/^[a-f0-9]{64}$/.test(row.mediaSha256||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(row.revision||'')||!['PENDING','APPROVED'].includes(row.status))unavailable();
 return {id:row.id,title:row.title,taskId:row.taskId,workerId:row.workerId,sectorId:row.sectorId,revision:row.revision,status:row.status,media:{kind:row.mediaKind,contentType:row.contentType,bytes,sha256:row.mediaSha256},...(withProcessing&&row.mediaKind==='audio'?{processing:row.processing}:{} )};
}

// Called only by the verified bridge after live principal/lease/permission and
// task/sector reads. Pagination and retained selections never widen ownership.
export async function readMetaConsumptionEvidenceCatalog(client,{organizationId,projectId,workerId,actorId,state,message,tasks,sectors}){
 if([organizationId,projectId,workerId,actorId,state?.sectorId].some(value=>!workspaceId(value))||state.taskId!==null&&(!workspaceId(state.taskId)||!tasks?.some(task=>task.id===state.taskId))||!sectors?.some(sector=>sector.id===state.sectorId))unavailable();
 const ids=state.evidenceIds||[];if(!Array.isArray(ids)||ids.length>10||new Set(ids).size!==ids.length||ids.some(value=>!workspaceId(value)))unavailable();
 const contextDigest=digest(['consumption-evidence-catalog-v1',organizationId,projectId,workerId,actorId,state.taskId,state.sectorId]),choice=selectedChoice(state,message),page=state.step==='CONSUMPTION_EVIDENCE'?state.consumptionEvidencePage:null,size=6;
 const field=`i.metadata->'fieldOperations'`,from=`public."Incident" i JOIN public."Project" p ON p.id=i."projectId"`;
 const visible=`i."projectId"=$1 AND p."organizationId"=$5 AND p.status='ACTIVE' AND ${field}->>'version'='1' AND ${field}->>'kind'='EVIDENCE' AND ${field}->>'taskId' IS NOT DISTINCT FROM $2::text AND ${field}->>'workerId'=$3 AND ${field}->>'recordedBy'=$4 AND ${field}->>'sectorId'=$6 AND ${field}->'review'->>'decision' IS DISTINCT FROM 'REJECT' AND ${field}->'media'->>'kind' IN ('image','audio')`;
 const values=[projectId,state.taskId,workerId,actorId,organizationId,state.sectorId];let anchor=null,direction='FIRST';
 if(page){
  if(page.contextDigest!==contextDigest||typeof page.hasPrevious!=='boolean'||typeof page.hasNext!=='boolean'||(page.first===null)!==(page.last===null)||page.first===null&&(page.hasPrevious||page.hasNext)||page.first!==null&&(!validCursor(page.first)||!validCursor(page.last)))unavailable();
  if(page.first){
   const anchors=(await client.query(`SELECT i.id,to_char(i."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt" FROM ${from} WHERE ${visible} AND i.id=ANY($7::text[])`,[...values,[page.first.id,page.last.id]])).rows;
   if(![page.first,page.last].every(value=>anchors.some(row=>row.id===value.id&&row.createdAt===value.createdAt)))unavailable();
   direction=choice==='NEXT_CONSUMPTION_EVIDENCE'?'AFTER':choice==='PREVIOUS_CONSUMPTION_EVIDENCE'?'BEFORE':'INCLUSIVE';anchor=direction==='AFTER'?page.last:page.first;
  }
 }
 const columns=`i.id,i.title,${field}->>'taskId' AS "taskId",${field}->>'workerId' AS "workerId",${field}->>'sectorId' AS "sectorId",${field}->'media'->>'kind' AS "mediaKind",${field}->'media'->>'contentType' AS "contentType",${field}->'media'->>'bytes' AS "mediaBytes",${field}->'media'->>'sha256' AS "mediaSha256",CASE WHEN ${field}->'review'->>'decision'='APPROVE' THEN 'APPROVED' ELSE 'PENDING' END AS status,to_char(i."updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision,to_char(i."createdAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS "createdAt"`;
 const predicate=anchor?` AND (i."createdAt",i.id) ${direction==='AFTER'?'<':direction==='BEFORE'?'>':'<='} ($7::timestamp,$8::text)`:'';
 const found=(await client.query(`SELECT ${columns} FROM ${from} WHERE ${visible}${predicate} ORDER BY i."createdAt" ${direction==='BEFORE'?'ASC':'DESC'},i.id ${direction==='BEFORE'?'ASC':'DESC'} LIMIT ${size+1}`,anchor?[...values,anchor.createdAt,anchor.id]:values)).rows;
 const rows=found.slice(0,size);if(direction==='BEFORE')rows.reverse();let evidencePage={contextDigest,first:null,last:null,hasPrevious:false,hasNext:false};
 if(rows.length){const first=cursor(rows[0]),last=cursor(rows.at(-1)),bounds=(await client.query(`SELECT EXISTS(SELECT 1 FROM ${from} WHERE ${visible} AND (i."createdAt",i.id)>($7::timestamp,$8::text)) AS "hasPrevious",EXISTS(SELECT 1 FROM ${from} WHERE ${visible} AND (i."createdAt",i.id)<($9::timestamp,$10::text)) AS "hasNext"`,[...values,first.createdAt,first.id,last.createdAt,last.id])).rows[0];if(!bounds||typeof bounds.hasPrevious!=='boolean'||typeof bounds.hasNext!=='boolean')unavailable();evidencePage={contextDigest,first,last,...bounds};}
 const context={workerId,taskId:state.taskId,sectorId:state.sectorId},entries=rows.map(row=>entry(row,context)),evidence=entries.slice();
 const selected=state.step==='CONSUMPTION_EVIDENCE'&&choice&&!['NEXT_CONSUMPTION_EVIDENCE','PREVIOUS_CONSUMPTION_EVIDENCE','CONTINUE_CONSUMPTION','CLEAR_CONSUMPTION_EVIDENCE'].includes(choice)?[choice]:[];
 const retained=[...ids,...selected,state.consumptionVoiceCandidate?.source?.evidenceId,state.consumptionVoice?.source?.evidenceId].filter(value=>value!==undefined&&value!==null);if(retained.length>13||retained.some(value=>!workspaceId(value)))unavailable();
 const retainedIds=[...new Set(retained)].sort();
 if(retainedIds.length){
  const fresh=(await client.query(`SELECT ${columns},CASE WHEN ${field}->'media'->>'kind'='audio' THEN ${field}->'processing' ELSE NULL END AS processing FROM ${from} WHERE ${visible} AND i.id=ANY($7::text[]) ORDER BY i.id FOR SHARE OF i`,[...values,retainedIds])).rows;
  if(fresh.some(row=>!retainedIds.includes(row.id))||new Set(fresh.map(row=>row.id)).size!==fresh.length)unavailable();
  const byId=new Map(fresh.map(row=>[row.id,entry(row,context,true)]));
  for(const id of retainedIds){const index=evidence.findIndex(value=>value.id===id);if(index!==-1)evidence.splice(index,1);if(byId.has(id))evidence.push(byId.get(id));}
 }
 return {entries,evidence,page:evidencePage};
}
