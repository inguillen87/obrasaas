import assert from 'node:assert/strict';
import {createPlanImport} from '../../src/lib/plan-import-store.mjs';
import {createPlanImportAnalyzer} from '../../src/lib/plan-import-analyzer.mjs';
import {PLAN_IMPORT_MONTHLY_CURVE_CONSENT} from '../../src/lib/plan-import-policy.mjs';
import {WorkspaceError,digest} from '../../src/lib/workspace-policy.mjs';
// The real store runs against explicitly synthetic in-memory adapters. These
// checks prove store contracts and returned data, not PostgreSQL concurrency,
// Clerk acceptance, private Blob delivery or a customer's financial workbook.
export const projectId='project-monthly-synthetic',scope='a'.repeat(64),organizationId='org-synthetic';
export const context={projectId,scope},session={userId:'user_Synthetic',organizationId:'org_Synthetic'};
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const clone=value=>structuredClone(value);
const fixedTime='2026-10-10T06:00:00.000Z';
export const oldTask={id:'task-existing',title:'Existing synthetic task',status:'IN_PROGRESS',progress:73,startsOn:'2026-09-01',endsOn:'2026-09-30',revision:fixedTime};

export function storeHarness({role='ADMIN',actorId='actor-synthetic',tasks=[oldTask]}={}) {
 let currentRole=role,logs=new Map(),taskRows=new Map(tasks.map(row=>[row.id,clone(row)]));
 const blobs=new Map(),calls={put:0,get:0,analyze:0,mutations:0,taskBatches:0,operations:0,sql:[]};
 let onGet=null,failReceipt=false;
 const result=rows=>({rows:clone(rows)});
 const matches=(row,sql,values)=>{
  for(const [column,field] of [['organizationId','organizationId'],['actorId','actorId'],['entityId','projectId']]){
   const match=sql.match(new RegExp('"'+column+'"=\\$(\\d+)'));
   if(match&&row[field]!==values[Number(match[1])-1])return false;
  }
  const action=sql.match(/action='([^']+)'/);return !action||row.action===action[1];
 };
 const taskPublic=row=>Object.fromEntries(['id','title','status','progress','startsOn','endsOn','revision'].map(key=>[key,row[key]]));
 const client={async query(raw,values=[]){
  const sql=raw.replace(/\s+/g,' ').trim();calls.sql.push(sql);
  if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"')){
   let rows=[...logs.values()].filter(row=>matches(row,sql,values));
   if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===values[0]);
   if(sql.includes("metadata->>'status'='APPLIED'"))rows=rows.filter(row=>row.metadata.status==='APPLIED'&&row.metadata.source.sha256===values[2]);
   if(sql.includes("<> 'plan-spreadsheet-monthly-curve-v3'"))rows=rows.filter(row=>row.metadata.consent?.version!=='plan-spreadsheet-monthly-curve-v3');
   if(sql.includes("<> '3'"))rows=rows.filter(row=>String(row.metadata.analysis?.spreadsheet?.version||'')!=='3');
   if(sql.includes("<> 'plan-spreadsheet-cyp-curve-v4'"))rows=rows.filter(row=>row.metadata.consent?.version!=='plan-spreadsheet-cyp-curve-v4');
   if(sql.includes("<> '4'"))rows=rows.filter(row=>String(row.metadata.analysis?.spreadsheet?.version||'')!=='4');
   if(sql.includes("metadata->>'sourceConsent','') NOT IN"))rows=rows.filter(row=>!['plan-spreadsheet-monthly-curve-v3','plan-spreadsheet-cyp-curve-v4'].includes(row.metadata.sourceConsent));
   if(sql.includes("metadata->'outcome'->'draft'->'spreadsheet'->>'version','') NOT IN"))rows=rows.filter(row=>![3,4].includes(row.metadata.outcome?.draft?.spreadsheet?.version));
   if(sql.includes('ORDER BY'))rows.sort((a,b)=>b.metadata.createdAt.localeCompare(a.metadata.createdAt)||b.id.localeCompare(a.id));
   const limit=sql.match(/LIMIT (\d+)/);if(limit)rows=rows.slice(0,Number(limit[1]));
   return result(rows.map(row=>({id:row.id,metadata:row.metadata})));
  }
  if(sql.startsWith('SELECT')&&sql.includes('public."Task"')){
   let rows=[...taskRows.values()];
   if(sql.includes('id=ANY'))rows=rows.filter(row=>values[1].includes(row.id));
   else if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===values[0]);
   rows.sort((a,b)=>a.id.localeCompare(b.id));return result(rows.map(taskPublic));
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){
   calls.mutations++;const action=sql.match(/'plan\.import\.[a-z]+'/)?.[0].slice(1,-1);
   if(failReceipt&&action==='plan.import.decision')throw new Error('Synthetic receipt failure');
   const [id,org,actor,project,metadata]=values;
   if(logs.has(id))throw new Error('Synthetic duplicate AuditLog');
   logs.set(id,{id,organizationId:org,actorId:actor,projectId:project,action,metadata:JSON.parse(metadata)});return result([]);
  }
  if(sql.startsWith('UPDATE public."AuditLog"')){
   const [id,metadata,lease,expiresAt]=values,row=logs.get(id);
   if(!row)throw new Error('Synthetic missing draft');
   if(lease&&(row.metadata.lease?.token!==lease||row.metadata.lease.expiresAt!==expiresAt||Date.parse(expiresAt)<=Date.now()))return result([]);
   calls.mutations++;row.metadata=JSON.parse(metadata);return result([{id}]);
  }
  if(sql.startsWith('INSERT INTO public."Task"')){
   calls.mutations++;calls.taskBatches++;assert.match(sql,/'BACKLOG',0/);
   assert.equal(values.length%6,0);const created=[];
   for(let i=0;i<values.length;i+=6){const [id,project,title,startsOn,endsOn,metadata]=values.slice(i,i+6);assert.equal(project,projectId);
    const row={id,title,startsOn,endsOn,status:'BACKLOG',progress:0,revision:fixedTime,metadata:JSON.parse(metadata)};taskRows.set(id,row);created.push(taskPublic(row));
   }
   return result(sql.includes('RETURNING')?created:[]);
  }
  throw new Error('Unexpected synthetic SQL: '+sql);
 }};
 const workspace={async projectOperation(s,c,w,callback){
  calls.operations++;if(c.projectId!==projectId||c.scope!==scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',403);
  const beforeLogs=clone(logs),beforeTasks=clone(taskRows);
  try{return await callback(client,{role:currentRole,actorId,organizationId},scope);}
  catch(error){if(w){logs=beforeLogs;taskRows=beforeTasks;}throw error;}
 }};
 const analyzer=createPlanImportAnalyzer({environment:()=>{throw new Error('Financial Excel must not read AI credentials');},fetchImpl:()=>{throw new Error('Financial Excel must not call AI');}});
 const imports=createPlanImport({workspace,
  environment:()=>({BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_synthetic',PRIVATE_MEDIA_PROVIDER:'vercel-blob'}),
  async put(path,bytes,options){calls.put++;assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);blobs.set(path,{bytes:Buffer.from(bytes),contentType:options.contentType});},
  async get(path,options){calls.get++;assert.equal(options.access,'private');const value=blobs.get(path);if(!value)throw new Error('Synthetic Blob not found');if(onGet)await onGet();return {statusCode:200,blob:{url:'https://synthetic.private.blob.vercel-storage.com/'+path,pathname:path,size:value.bytes.length,contentType:value.contentType},stream:new Response(value.bytes).body};},
  analyzer:{async analyze(...args){calls.analyze++;return analyzer.analyze(...args);}}
 });
 return {imports,calls,changeDraft:(id,change)=>change(logs.get(id).metadata),setRole:value=>{currentRole=value;},setOnGet:value=>{onGet=value;},setFailReceipt:value=>{failReceipt=value;},
  logs:()=>clone([...logs.values()]),tasks:()=>clone([...taskRows.values()]),setTaskProgress:(id,progress)=>{taskRows.get(id).progress=progress;},
  addDraft(extraction,source,{id='draft-monthly-synthetic',consent=PLAN_IMPORT_MONTHLY_CURVE_CONSENT,status='READY',revision=3}={}){
   const pathname='obrasaas/plan-import/v1/'+source.sha256+'/cronograma.xlsx';blobs.set(pathname,{bytes:Buffer.from(source.bytes),contentType:source.contentType});
   const metadata={version:1,projectId,status,revision,createdAt:fixedTime,updatedAt:fixedTime,existingTaskCount:taskRows.size,baseline:digest([...taskRows.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(taskPublic)),source:{contentType:source.contentType,bytes:source.bytes.length,sha256:source.sha256,pathname},sourceConfirmed:true,consent:{version:consent,actorId,recordedAt:fixedTime},rows:clone(extraction.rows),extractedRows:clone(extraction.rows),warnings:clone(extraction.warnings||[]),analysis:{provider:'local-ooxml',reviewed:false,spreadsheet:clone(extraction.spreadsheet)}};
   logs.set(id,{id,organizationId,actorId,projectId,action:'plan.import.draft',metadata});return id;
  }
 };
}
