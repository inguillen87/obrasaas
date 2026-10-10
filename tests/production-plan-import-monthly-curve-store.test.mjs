import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createPlanImport} from '../src/lib/plan-import-store.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,planDecisionDigest} from '../src/lib/plan-import-policy.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {extractMonthlyCurveOoxml} from '../src/lib/plan-import-ooxml.mjs';
import {monthlyCurveFixture} from './fixtures/plan-import-monthly-curve-synthetic.mjs';

// The real store runs against explicitly synthetic in-memory adapters. These
// checks prove store contracts and returned data, not PostgreSQL concurrency,
// Clerk acceptance, private Blob delivery or a customer's financial workbook.
const projectId='project-monthly-synthetic',scope='a'.repeat(64),organizationId='org-synthetic';
const context={projectId,scope},session={userId:'user_Synthetic',organizationId:'org_Synthetic'};
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const clone=value=>structuredClone(value);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fixedTime='2026-10-10T06:00:00.000Z';
const oldTask={id:'task-existing',title:'Existing synthetic task',status:'IN_PROGRESS',progress:73,startsOn:'2026-09-01',endsOn:'2026-09-30',revision:fixedTime};

function storeHarness({role='ADMIN',actorId='actor-synthetic',tasks=[oldTask]}={}) {
 let currentRole=role,logs=new Map(),taskRows=new Map(tasks.map(row=>[row.id,clone(row)]));
 const blobs=new Map(),calls={put:0,get:0,analyze:0,mutations:0,taskBatches:0,operations:0};
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
  const sql=raw.replace(/\s+/g,' ').trim();
  if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"')){
   let rows=[...logs.values()].filter(row=>matches(row,sql,values));
   if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===values[0]);
   if(sql.includes("metadata->>'status'='APPLIED'"))rows=rows.filter(row=>row.metadata.status==='APPLIED'&&row.metadata.source.sha256===values[2]);
   if(sql.includes("<> 'plan-spreadsheet-monthly-curve-v3'"))rows=rows.filter(row=>row.metadata.consent?.version!=='plan-spreadsheet-monthly-curve-v3');
   if(sql.includes("<> '3'"))rows=rows.filter(row=>String(row.metadata.analysis?.spreadsheet?.version||'')!=='3');
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
 return {imports,calls,setRole:value=>{currentRole=value;},setOnGet:value=>{onGet=value;},setFailReceipt:value=>{failReceipt=value;},
  logs:()=>clone([...logs.values()]),tasks:()=>clone([...taskRows.values()]),setTaskProgress:(id,progress)=>{taskRows.get(id).progress=progress;},
  addDraft(extraction,source,{id='draft-monthly-synthetic',consent=PLAN_IMPORT_MONTHLY_CURVE_CONSENT,status='READY',revision=3}={}){
   const pathname='obrasaas/plan-import/v1/'+source.sha256+'/cronograma.xlsx';blobs.set(pathname,{bytes:Buffer.from(source.bytes),contentType:source.contentType});
   const metadata={version:1,projectId,status,revision,createdAt:fixedTime,updatedAt:fixedTime,existingTaskCount:taskRows.size,baseline:digest([...taskRows.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(taskPublic)),source:{contentType:source.contentType,bytes:source.bytes.length,sha256:source.sha256,pathname},sourceConfirmed:true,consent:{version:consent,actorId,recordedAt:fixedTime},rows:clone(extraction.rows),extractedRows:clone(extraction.rows),warnings:clone(extraction.warnings||[]),analysis:{provider:'local-ooxml',reviewed:false,spreadsheet:clone(extraction.spreadsheet)}};
   logs.set(id,{id,organizationId,actorId,projectId,action:'plan.import.draft',metadata});return id;
  }
 };
}

function reviewed(rows){return rows.map(row=>({...row,startsOn:'2026-11-01',endsOn:'2026-11-30',uncertainty:''}));}
function decision(draftId,rows,{action='EDIT',revision=3,operationId=randomUUID(),reason='Reviewed synthetic source and dates'}={}){return {...context,draftId,expectedRevision:revision,action,operationId,reason,rows:action==='REJECT'?null:rows};}
let samplePromise;
async function sample(){
 samplePromise??=(async()=>{const bytes=monthlyCurveFixture({rubros:3,type:'xlsx'}),source=decodePlanSource(bytes,mime),extraction=await extractMonthlyCurveOoxml(bytes,mime);return {source,extraction};})();
 return clone(await samplePromise);
}
async function seeded(options){const h=storeHarness(options),s=await sample(),draftId=h.addDraft(s.extraction,s.source);return {...h,...s,draftId};}
const permissionError={code:'PLAN_IMPORT_PERMISSION_REQUIRED',status:403};

test('legacy v1 and v2 decision fingerprints stay byte-for-byte compatible',()=>{
 const plain={title:'Synthetic source',startsOn:'2026-11-01',endsOn:'2026-11-30',evidence:'Synthetic row 1',uncertainty:''};
 for(const row of [plain,{...plain,code:'A.1.1.1',parentCode:'A.1.1',sourceIssueReviewed:true}]){
  const body=decision('draft-legacy-synthetic',[row]);
  const expected=hash(['plan-import-decision-v1',projectId,scope,body.operationId,body.draftId,body.expectedRevision,body.action,body.reason,[[row.title,row.startsOn,row.endsOn,row.evidence,row.uncertainty,...(row.code?[row.code,row.parentCode,row.sourceIssueReviewed]:[])]]]);
  assert.equal(planDecisionDigest(body),expected);
 }
});

for(const role of ['ADMIN','DIRECTOR'])test('financial v3 attach is local, private and never auto-applies for '+role,async()=>{
 const h=storeHarness({role}),{source,extraction}=await sample(),operationId=randomUUID();
 const result=await h.imports.attach(session,{...context,source,consent:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,operationId});
 assert.equal(result.saved,true);assert.equal(result.draft.status,'READY');assert.equal(result.draft.spreadsheet.version,3);
 assert.deepEqual(result.draft.spreadsheet.curve,extraction.spreadsheet.curve);assert.ok(result.draft.rows.every(row=>row.startsOn===null&&row.endsOn===null));
 assert.deepEqual(h.tasks(),[oldTask]);assert.equal(h.calls.analyze,1);assert.equal(h.calls.put,1);assert.equal(h.calls.taskBatches,0);
 assert.doesNotMatch(JSON.stringify(result),/pathname|lease|private\.blob|sourceConsent/);
 const reads=h.calls.get;const replay=await h.imports.attach(session,{...context,source,consent:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,operationId});
 assert.equal(replay.replayed,true);assert.equal(h.calls.get,reads);assert.equal(h.calls.analyze,1);
 h.setRole('SITE_MANAGER');await assert.rejects(h.imports.read(session,{...context,operationId}),permissionError);
 await assert.rejects(h.imports.attach(session,{...context,source,consent:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,operationId}),permissionError);
});

for(const role of ['SITE_MANAGER','FINANCE','AUDITOR'])test('financial v3 attach denies '+role+' before private storage, extraction or writes',async()=>{
 const h=storeHarness({role}),{source}=await sample();
 await assert.rejects(h.imports.attach(session,{...context,source,consent:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,operationId:randomUUID()}),permissionError);
 assert.equal(h.calls.mutations,0);assert.equal(h.calls.get,0);assert.equal(h.calls.put,0);assert.equal(h.calls.analyze,0);
});

test('SITE_MANAGER list retains legacy drafts but omits financial drafts and denies exact read/source',async()=>{
 const h=await seeded({role:'SITE_MANAGER'}),pdf=decodePlanSource(Buffer.from('%PDF-1.7\nSynthetic\n%%EOF'),'application/pdf');
 h.addDraft({rows:[{title:'Legacy synthetic task',startsOn:null,endsOn:null,evidence:'Legacy row',uncertainty:'Dates pending'}],spreadsheet:null},pdf,{id:'draft-legacy-synthetic',consent:'plan-document-openai-v1'});
 const result=await h.imports.read(session,context);assert.deepEqual(result.drafts.map(draft=>draft.id),['draft-legacy-synthetic']);
 assert.doesNotMatch(JSON.stringify(result),/PLANNED_MONETARY_INVESTMENT|MONTHLY_RUBROS_CURVE|cachedValue|budget/);
 await assert.rejects(h.imports.read(session,{...context,draftId:h.draftId}),permissionError);
 await assert.rejects(h.imports.source(session,{...context,draftId:h.draftId}),permissionError);assert.equal(h.calls.get,0);
});

test('financial drafts are filtered before pagination so they cannot crowd out authorized legacy drafts',async()=>{
 const h=await seeded({role:'SITE_MANAGER'}),pdf=decodePlanSource(Buffer.from('%PDF-1.7\nSynthetic\n%%EOF'),'application/pdf');
 for(let i=0;i<24;i++)h.addDraft(h.extraction,h.source,{id:'draft-z-private-'+String(i).padStart(2,'0')});
 h.addDraft({rows:[{title:'Legacy synthetic task',startsOn:null,endsOn:null,evidence:'Legacy row',uncertainty:'Dates pending'}],spreadsheet:null},pdf,{id:'draft-a-legacy',consent:'plan-document-openai-v1'});
 const result=await h.imports.read(session,context);assert.deepEqual(result.drafts.map(draft=>draft.id),['draft-a-legacy']);assert.equal(result.truncated,false);
});

test('financial source download revalidates the role after private Blob I/O',async()=>{
 const h=await seeded();h.setOnGet(()=>h.setRole('SITE_MANAGER'));
 await assert.rejects(h.imports.source(session,{...context,draftId:h.draftId}),permissionError);
 assert.equal(h.calls.get,1);assert.equal(h.calls.mutations,0);
});

for(const action of ['EDIT','APPLY','REJECT'])test('SITE_MANAGER cannot '+action+' a financial v3 draft or recover a typed rejection',async()=>{
 const h=await seeded({role:'SITE_MANAGER'});
 for(const rows of [reviewed(h.extraction.rows),h.extraction.rows.map((row,i)=>i?row:{...row,budget:'forged financial value'})]){
  await assert.rejects(h.imports.decide(session,decision(h.draftId,rows,{action})),permissionError);
 }
 assert.equal(h.calls.mutations,0);assert.deepEqual(h.tasks(),[oldTask]);
});

test('successful v3 EDIT receipt and exact replay remain private after role downgrade',async()=>{
 const h=await seeded(),body=decision(h.draftId,reviewed(h.extraction.rows)),edited=await h.imports.decide(session,body);
 assert.equal(edited.saved,true);assert.equal(edited.draft.spreadsheet.reviewed,true);
 const before=h.calls.mutations;h.setRole('SITE_MANAGER');
 await assert.rejects(h.imports.read(session,{...context,operationId:body.operationId}),permissionError);
 await assert.rejects(h.imports.decide(session,body),permissionError);assert.equal(h.calls.mutations,before);
});

test('terminal v3 decision rejection receipt also requires current financial permission',async()=>{
 const h=await seeded(),body=decision(h.draftId,h.extraction.rows,{action:'APPLY'}),rejected=await h.imports.decide(session,body);
 assert.equal(rejected.state,'REJECTED');assert.equal(rejected.taskEffects,false);assert.equal(h.calls.taskBatches,0);
 h.setRole('SITE_MANAGER');await assert.rejects(h.imports.read(session,{...context,operationId:body.operationId}),permissionError);
});

test('sourceRowId and source evidence cannot be forged and financial fields cannot enter decision rows',async()=>{
 for(const patch of [{sourceRowId:'Plan y curva Meses!A9999'},{evidence:'Forged source evidence'},{sourceRowId:'Plan y curva Meses!A12'},{budget:'123.45'},{actualProgress:100}]){
  const h=await seeded(),rows=reviewed(h.extraction.rows);rows[0]={...rows[0],...patch};
  const result=await h.imports.decide(session,decision(h.draftId,rows));assert.equal(result.state,'REJECTED');
  assert.ok(['PLAN_IMPORT_ROWS_INVALID','PLAN_IMPORT_DUPLICATE_ROWS'].includes(result.code));assert.equal(result.taskEffects,false);
  assert.equal(h.calls.taskBatches,0);assert.deepEqual(h.tasks(),[oldTask]);assert.deepEqual(h.logs().find(row=>row.id===h.draftId).metadata.extractedRows,h.extraction.rows);
 }
});

test('calendar dates and a persisted exact EDIT are required before v3 APPLY',async()=>{
 const h=await seeded();for(const rows of [h.extraction.rows,reviewed(h.extraction.rows)]){
  const result=await h.imports.decide(session,decision(h.draftId,rows,{action:'APPLY'}));assert.equal(result.state,'REJECTED');assert.equal(result.code,'PLAN_IMPORT_REVIEW_REQUIRED');
 }
 assert.equal(h.calls.taskBatches,0);assert.deepEqual(h.tasks(),[oldTask]);
});

test('excluding and reordering rubros preserves the complete original monetary curve and stable source identity',async()=>{
 const h=await seeded(),original=clone(h.extraction.spreadsheet),rows=reviewed(h.extraction.rows).slice(1).reverse();
 const edited=await h.imports.decide(session,decision(h.draftId,rows));assert.equal(edited.draft.rows.length,2);
 assert.deepEqual(edited.draft.spreadsheet.items,original.items);assert.deepEqual(edited.draft.spreadsheet.curve,original.curve);
 assert.equal(edited.draft.spreadsheet.rowCount,3);
 const body=decision(h.draftId,rows,{action:'APPLY',revision:edited.draft.revision}),applied=await h.imports.decide(session,body);
 assert.equal(applied.saved,true);assert.equal(applied.taskSnapshots.length,2);assert.equal(applied.draft.status,'APPLIED');
 assert.deepEqual(applied.draft.spreadsheet.curve,original.curve);assert.deepEqual(applied.draft.spreadsheet.items,original.items);
 const created=h.tasks().filter(row=>row.id!==oldTask.id);assert.deepEqual(created.map(row=>row.metadata.planImport.sourceRowId),rows.map(row=>row.sourceRowId));
 for(const row of created){assert.equal(row.status,'BACKLOG');assert.equal(row.progress,0);assert.equal(row.metadata.planImport.version,3);assert.equal(row.metadata.planImport.sourceSha256,h.source.sha256);assert.doesNotMatch(JSON.stringify(row.metadata),/cachedValue|monthlyAmount|cumulativeAmount|budget|actualProgress/);}
 assert.deepEqual(h.tasks().find(row=>row.id===oldTask.id),oldTask);
 h.setTaskProgress(created[0].id,88);const before=h.calls.mutations,recovered=await h.imports.read(session,{...context,operationId:body.operationId});
 assert.equal(recovered.tasks.find(row=>row.id===created[0].id).progress,88);assert.equal(recovered.taskSnapshots.find(row=>row.id===created[0].id).progress,0);
 assert.deepEqual(recovered.draft.spreadsheet.curve,original.curve);assert.equal(h.calls.mutations,before);
 const replay=await h.imports.decide(session,body);assert.equal(replay.replayed,true);assert.equal(h.tasks().length,3);assert.equal(h.calls.mutations,before);
 await assert.rejects(h.imports.decide(session,{...body,reason:'Changed source decision with same UUID'}),{code:'PLAN_IMPORT_OPERATION_CONFLICT'});
});

test('receipt failure rolls back the retained v3 Task batch and preserves the original draft in the transaction adapter',async()=>{
 const h=await seeded(),rows=reviewed(h.extraction.rows),edited=await h.imports.decide(session,decision(h.draftId,rows));
 const before=h.logs();h.setFailReceipt(true);
 await assert.rejects(h.imports.decide(session,decision(h.draftId,rows,{action:'APPLY',revision:edited.draft.revision})),/Synthetic receipt failure/);
 assert.deepEqual(h.tasks(),[oldTask]);assert.deepEqual(h.logs(),before);
});

test('a changed reviewed row or already-applied source never creates another financial-source batch',async()=>{
 const h=await seeded(),rows=reviewed(h.extraction.rows),edited=await h.imports.decide(session,decision(h.draftId,rows));
 const changed=rows.map((row,i)=>i?row:{...row,title:'Changed without persisted EDIT'});
 const denied=await h.imports.decide(session,decision(h.draftId,changed,{action:'APPLY',revision:edited.draft.revision}));assert.equal(denied.code,'PLAN_IMPORT_REVIEW_REQUIRED');assert.equal(h.calls.taskBatches,0);
 await h.imports.decide(session,decision(h.draftId,rows,{action:'APPLY',revision:edited.draft.revision}));
 const count=h.tasks().length,batches=h.calls.taskBatches,operationId=randomUUID();
 const rejected=await h.imports.attach(session,{...context,source:h.source,consent:PLAN_IMPORT_MONTHLY_CURVE_CONSENT,operationId});assert.equal(rejected.code,'PLAN_IMPORT_SOURCE_ALREADY_APPLIED');
 assert.equal(h.tasks().length,count);assert.equal(h.calls.taskBatches,batches);
 h.setRole('SITE_MANAGER');await assert.rejects(h.imports.read(session,{...context,operationId}),permissionError);
});

test('wrong company/project scope cannot disclose the financial draft or source',async()=>{
 const h=await seeded();for(const c of [{...context,projectId:'project-other-synthetic'},{...context,scope:'b'.repeat(64)}]){
  await assert.rejects(h.imports.read(session,{...c,draftId:h.draftId}),{code:'WORKSPACE_CONTEXT_CHANGED'});
  await assert.rejects(h.imports.source(session,{...c,draftId:h.draftId}),{code:'WORKSPACE_CONTEXT_CHANGED'});
 }
 assert.equal(h.calls.get,0);assert.equal(h.calls.mutations,0);
});
