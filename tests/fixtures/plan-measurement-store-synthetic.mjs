import {createPlanImport} from '../../src/lib/plan-import-store.mjs';
import {createPlanImportAnalyzer} from '../../src/lib/plan-import-analyzer.mjs';
import {createPlanMeasurement} from '../../src/lib/plan-measurement-store.mjs';
import {WorkspaceError} from '../../src/lib/workspace-policy.mjs';
export const measurementContext={projectId:'measurement-project',scope:'a'.repeat(64)};
export const measurementSession={authenticated:true,verification:'clerk-production-jwt',userId:'user_Measurement',organizationId:'org_Measurement',organizationRole:'org:admin'};
export function measurementStoreHarness(){
 let logs=new Map(),tasks=new Map(),role='ADMIN',tick=0,failReceipt=false,pending=false,afterBlob=null;const blobs=new Map(),calls={get:0,put:0,provider:0};
 const clone=value=>structuredClone(value),result=rows=>({rows:clone(rows)}),nextRevision=()=>`2026-10-14T12:00:00.${String(++tick).padStart(6,'0')}`;
 const client={async query(raw,values=[]){const sql=raw.replace(/\s+/g,' ').trim();
  if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"')){
   let rows=[...logs.values()];for(const [column,field]of [['organizationId','organizationId'],['actorId','actorId'],['entityId','projectId']]){const match=sql.match(new RegExp('"'+column+'"=\\$(\\d+)'));if(match)rows=rows.filter(row=>row[field]===values[Number(match[1])-1]);}
   const action=sql.match(/(?:\w\.)?action='([^']+)'/);if(action)rows=rows.filter(row=>row.action===action[1]);if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===values[0]);
   const purpose=sql.match(/metadata->>'sourcePurpose'=\$(\d+)/);if(purpose)rows=rows.filter(row=>row.metadata.sourcePurpose===values[Number(purpose[1])-1]);
   if(sql.includes("metadata->>'status'='APPLIED'"))rows=rows.filter(row=>row.metadata.status==='APPLIED');const sha=sql.match(/metadata->'source'->>'sha256'=\$(\d+)/);if(sha)rows=rows.filter(row=>row.metadata.source?.sha256===values[Number(sha[1])-1]);if(sql.includes('AND id<>$5'))rows=rows.filter(row=>row.id!==values[4]);
   if(sql.includes("COALESCE(metadata->>'sourcePurpose','') <> 'PHYSICAL_TASK_MEASUREMENT'"))rows=rows.filter(row=>row.metadata.sourcePurpose!=='PHYSICAL_TASK_MEASUREMENT');
   return result(rows.map(row=>({...row,entityId:row.projectId})));
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){const [id,organizationId,actorId,projectId,metadata]=values,action=sql.match(/'(plan\.[a-z]+\.[a-z]+)'/)[1];if(failReceipt&&action==='plan.measurement.recorded')throw Error('Synthetic receipt failure');if(logs.has(id))throw Error('Duplicate receipt');logs.set(id,{id,organizationId,actorId,projectId,action,metadata:JSON.parse(metadata)});return result([]);}
  if(sql.startsWith('UPDATE public."AuditLog"')){const [id,json,guard,expires]=values,row=logs.get(id);if(typeof guard==='number'&&row.metadata.revision!==guard||typeof guard==='string'&&(row.metadata.lease?.token!==guard||row.metadata.lease.expiresAt!==expires||Date.parse(expires)<=Date.now()))return result([]);row.metadata=JSON.parse(json);return result([{id}]);}
  if(sql.startsWith('SELECT')&&sql.includes('public."Task"')){const rows=sql.includes('WHERE id=$1')?[tasks.get(values[0])].filter(Boolean):[...tasks.values()];return result(rows);}
  if(sql.startsWith('INSERT INTO public."Task"')){const [id,projectId,title,startsOn,endsOn,metadata]=values;tasks.set(id,{id,projectId,title,status:'BACKLOG',progress:0,startsOn,endsOn,metadata:JSON.parse(metadata),revision:nextRevision()});return result([]);}
  if(sql.startsWith('UPDATE public."Task"')){const [id,,metadata,revision]=values,row=tasks.get(id);if(row.revision!==revision)return result([]);row.metadata=JSON.parse(metadata);row.revision=nextRevision();return result([{id}]);}
  if(sql.startsWith('SELECT')&&sql.includes('public."OperationalProposal"'))return result(pending?[{id:'pending-synthetic'}]:[]);
  throw Error('Unexpected synthetic SQL '+sql);
 }};
 const workspace={async projectOperation(session,context,writable,callback){if(context.projectId!==measurementContext.projectId||context.scope!==measurementContext.scope||session.userId!==measurementSession.userId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',403);const before=clone({logs,tasks});try{return await callback(client,{role,actorId:'measurement-actor',organizationId:'measurement-org'},context.scope);}catch(error){if(writable){logs=before.logs;tasks=before.tasks;}throw error;}}};
 const put=async(path,bytes,options)=>{calls.put++;blobs.set(path,{bytes:Buffer.from(bytes),contentType:options.contentType});},get=async path=>{calls.get++;if(afterBlob)await afterBlob();const item=blobs.get(path);if(!item)return {statusCode:404};return {statusCode:200,blob:{url:'https://measurement.private.blob.vercel-storage.com/'+path,pathname:path,size:item.bytes.length,contentType:item.contentType},stream:new ReadableStream({start(controller){controller.enqueue(item.bytes);controller.close();}})};};
 const imports=createPlanImport({workspace,put,get,analyzer:createPlanImportAnalyzer({environment:()=>{throw Error('Excel must remain local');},fetchImpl:async()=>{calls.provider++;throw Error('Forbidden provider');}}),environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-unused-token'})});
 const measurements=createPlanMeasurement({workspace,imports});
 return {measurements,imports,calls,setRole:value=>{role=value;},setPending:value=>{pending=value;},setFailReceipt:value=>{failReceipt=value;},setAfterBlob:value=>{afterBlob=value;},state:()=>clone({logs,tasks}),mutateTask:(id,mutate)=>mutate(tasks.get(id)),mutateDraft:(id,mutate)=>mutate(logs.get(id).metadata),addTask:value=>tasks.set(value.id,{status:'BACKLOG',progress:0,startsOn:'2026-11-01',endsOn:'2026-11-02',metadata:{preserve:true},revision:nextRevision(),...clone(value)})};
}
