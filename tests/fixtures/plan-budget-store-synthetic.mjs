import {randomUUID} from 'node:crypto';
import {createPlanImport} from '../../src/lib/plan-import-store.mjs';
import {createPlanImportAnalyzer} from '../../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_CYP_INVESTMENT_CONSENT,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT} from '../../src/lib/plan-import-policy.mjs';
import {WorkspaceError} from '../../src/lib/workspace-policy.mjs';
import {PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_SOURCE_PURPOSE} from '../../src/lib/plan-budget-source.mjs';
import {PLAN_BUDGET_CSV_CONSENT} from '../../src/lib/plan-budget-csv-source.mjs';
import {PLAN_MEASUREMENT_PURPOSE,PLAN_MEASUREMENT_CONSENT,PLAN_MEASUREMENT_DOCUMENT_CONSENT} from '../../src/lib/plan-measurement-source.mjs';
import {DOCUMENT_CURVE_PURPOSE} from '../../src/lib/plan-import-document-curve.mjs';
import {PLAN_CYP_INVESTMENT_PURPOSE} from '../../src/lib/plan-import-cyp-curve.mjs';
import {budgetSourceFixtureParts,zipOoxmlFixture} from './plan-budget-source-synthetic.mjs';

export const budgetContext=Object.freeze({projectId:'budget-project',scope:'d'.repeat(64)});
export const budgetSession=Object.freeze({authenticated:true,verification:'clerk-production-jwt',userId:'user_Budget',organizationId:'org_Budget',organizationRole:'org:admin'});
export const budgetMime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const budgetMacroMime='application/vnd.ms-excel.sheet.macroenabled.12';

export function budgetSourceFile({type='xlsx',...options}={}){
 const {parts}=budgetSourceFixtureParts(options);
 if(type==='xlsm'){
  parts['[Content_Types].xml']=parts['[Content_Types].xml'].replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','application/vnd.ms-excel.sheet.macroEnabled.main+xml');
  parts['xl/vbaProject.bin']=Buffer.from('Synthetic inert budget macro bytes; never executed');
 }
 return decodePlanSource(zipOoxmlFixture(parts),type==='xlsm'?budgetMacroMime:budgetMime);
}
export const budgetUploadInput=(source=budgetSourceFile(),changes={})=>({...budgetContext,operationId:randomUUID(),consent:PLAN_BUDGET_SOURCE_CONSENT,source,...changes});

// Deliberately passes the cheap file signature check, but is not a valid ZIP.
// A denied actor must fail authorization before the OOXML parser examines it.
export function invalidBudgetZipSource(){
 const bytes=Buffer.alloc(40);bytes.writeUInt32LE(0x04034b50,0);bytes.writeUInt32LE(0x06054b50,18);
 return decodePlanSource(bytes,budgetMime);
}

export function budgetStoreHarness({usage=null}={}){
 let logs=new Map(),tasks=new Map(),role='ADMIN',channelProof=null,afterGet=null,afterPut=null;
 const blobs=new Map(),clone=value=>structuredClone(value),result=rows=>({rows:clone(rows)});
 const calls={sql:[],operations:[],budgetProjections:[],sensitivityReads:[],get:0,put:0,analyzer:0,provider:0,providerConfiguration:0,storageConfiguration:0,taskReads:0,taskWrites:0};
 const isBudget=row=>{const m=row.metadata||{};return m.sourcePurpose===PLAN_BUDGET_SOURCE_PURPOSE||[PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_CSV_CONSENT].includes(m.consent?.version)||[PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_CSV_CONSENT].includes(m.sourceConsent)||Boolean(m.analysis?.budgetSource)||m.outcome?.draft?.budgetImport===true;};
 const isRestricted=row=>{
  const m=row.metadata||{},purposes=[PLAN_BUDGET_SOURCE_PURPOSE,PLAN_MEASUREMENT_PURPOSE,DOCUMENT_CURVE_PURPOSE,PLAN_CYP_INVESTMENT_PURPOSE];
  const consents=[PLAN_BUDGET_SOURCE_CONSENT,PLAN_BUDGET_CSV_CONSENT,PLAN_MEASUREMENT_CONSENT,PLAN_MEASUREMENT_DOCUMENT_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_CYP_INVESTMENT_CONSENT,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT];
  return purposes.includes(m.sourcePurpose)||purposes.includes(m.purpose)||consents.includes(m.consent?.version)||consents.includes(m.sourceConsent)||[3,4,5].includes(m.analysis?.spreadsheet?.version)||Boolean(m.analysis?.budgetSource);
 };
 function selectLogs(sql,values){
  const outer=sql.split('AND NOT EXISTS')[0];let rows=[...logs.values()];
  for(const [column,field]of [['organizationId','organizationId'],['actorId','actorId'],['entityId','projectId']]){
   const match=outer.match(new RegExp('(?:\\w+\\.)?"'+column+'"\\s*=\\s*\\$(\\d+)'));
   if(match)rows=rows.filter(row=>row[field]===values[Number(match[1])-1]);
  }
  const action=outer.match(/(?:\w+\.)?action='([^']+)'/);if(action)rows=rows.filter(row=>row.action===action[1]);
  const id=outer.match(/(?:WHERE|AND) (?:\w+\.)?id=\$(\d+)/);if(id)rows=rows.filter(row=>row.id===values[Number(id[1])-1]);
  const purpose=outer.match(/metadata->>'sourcePurpose'=\$(\d+)/);if(purpose)rows=rows.filter(row=>row.metadata.sourcePurpose===values[Number(purpose[1])-1]);
  const sha=outer.match(/metadata->'source'->>'sha256'=\$(\d+)/);if(sha)rows=rows.filter(row=>row.metadata.source?.sha256===values[Number(sha[1])-1]);
  if(outer.includes("metadata->>'status'='APPLIED'"))rows=rows.filter(row=>row.metadata.status==='APPLIED');
  for(const match of outer.matchAll(/COALESCE\((?:\w+\.)?metadata->>'sourcePurpose',''\)\s*<>\s*'([^']+)'/g))rows=rows.filter(row=>row.metadata.sourcePurpose!==match[1]);
  for(const match of outer.matchAll(/COALESCE\((?:\w+\.)?metadata->'consent'->>'version',''\)\s*<>\s*'([^']+)'/g))rows=rows.filter(row=>row.metadata.consent?.version!==match[1]);
  for(const match of outer.matchAll(/COALESCE\((?:\w+\.)?metadata->'consent'->>'version',''\)\s+NOT IN\s*\(([^)]+)\)/g)){
   const excluded=[...match[1].matchAll(/'([^']+)'/g)].map(item=>item[1]);rows=rows.filter(row=>!excluded.includes(row.metadata.consent?.version));
  }
  const sensitivity=outer.startsWith('SELECT f.id,f.metadata FROM public."AuditLog" f ');let budgetOnly=false;
  if(sensitivity){
   const prefix='SELECT f.id,f.metadata FROM public."AuditLog" f WHERE f."organizationId"=$1 AND f."entityId"=$2 AND f.action=\'plan.import.draft\' AND f.metadata->\'source\'->>\'sha256\'=$3 AND ';
   const budgetPredicate=`(COALESCE(f.metadata->>'sourcePurpose','')='${PLAN_BUDGET_SOURCE_PURPOSE}' OR COALESCE(f.metadata->'consent'->>'version','') IN ('${PLAN_BUDGET_SOURCE_CONSENT}','${PLAN_BUDGET_CSV_CONSENT}') OR COALESCE(f.metadata->>'sourceConsent','') IN ('${PLAN_BUDGET_SOURCE_CONSENT}','${PLAN_BUDGET_CSV_CONSENT}') OR f.metadata->'analysis'->'budgetSource' IS NOT NULL OR COALESCE(f.metadata->'outcome'->'draft'->>'budgetImport','')='true')`;
   if(!outer.startsWith(prefix)||!outer.endsWith(' LIMIT 1'))throw Error('Unexpected synthetic source-sensitivity query');
   const predicate=outer.slice(prefix.length,-' LIMIT 1'.length);budgetOnly=predicate===budgetPredicate;
   if(!budgetOnly&&(!predicate.includes(budgetPredicate)||!predicate.includes(PLAN_MEASUREMENT_PURPOSE)||!predicate.includes(PLAN_IMPORT_MONTHLY_CURVE_CONSENT)))throw Error('Unexpected synthetic source-sensitivity predicate');
   rows=rows.filter(budgetOnly?isBudget:isRestricted);
  }
  if(sql.includes('AND NOT EXISTS'))rows=rows.filter(row=>![...logs.values()].some(other=>other.organizationId===row.organizationId&&other.projectId===row.projectId&&other.metadata.source?.sha256===row.metadata.source?.sha256&&isRestricted(other)));
  if(sql.includes('ORDER BY "createdAt" DESC,id DESC'))rows.sort((a,b)=>String(b.metadata.createdAt).localeCompare(String(a.metadata.createdAt))||b.id.localeCompare(a.id));
  const limit=sql.match(/LIMIT (\d+)/);if(limit)rows=rows.slice(0,Number(limit[1]));
  if(sensitivity)calls.sensitivityReads.push({budgetOnly,organizationId:values[0],projectId:values[1],sourceSha256:values[2],rowIds:rows.map(row=>row.id)});
  return rows.map(row=>{
   const projected={...row,entityId:row.projectId};
   if(sql.includes("#- '{analysis,budgetSource}'")){
    projected.metadata=clone(row.metadata);const budget=isBudget(row),removed=budget&&Object.hasOwn(projected.metadata.analysis||{},'budgetSource');
    if(budget&&projected.metadata.analysis)delete projected.metadata.analysis.budgetSource;
    calls.budgetProjections.push({id:row.id,budget,removed,sourceReturned:Object.hasOwn(projected.metadata.analysis||{},'budgetSource')});
   }
   return projected;
  });
 }
 const client={async query(raw,values=[]){
  const sql=raw.replace(/\s+/g,' ').trim();calls.sql.push(sql);
  if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"'))return result(selectLogs(sql,values));
  if(sql.startsWith('INSERT INTO public."AuditLog"')){
   const [id,organizationId,actorId,projectId,metadata]=values,action=sql.match(/'(plan\.[a-z]+\.[a-z]+)'/)?.[1];
   if(!action||logs.has(id))throw Error('Unexpected or duplicate synthetic audit write');
   logs.set(id,{id,organizationId,actorId,projectId,action,metadata:JSON.parse(metadata)});return result([]);
  }
  if(sql.startsWith('UPDATE public."AuditLog"')){
   const [id,json,lease,expires]=values,row=logs.get(id);if(!row)throw Error('Missing synthetic audit row');
   if(lease&&(row.metadata.lease?.token!==lease||row.metadata.lease.expiresAt!==expires||Date.parse(expires)<=Date.now()))return result([]);
   row.metadata=JSON.parse(json);return result([{id}]);
  }
  if(sql.startsWith('SELECT')&&sql.includes('public."Task"')){calls.taskReads++;return result([...tasks.values()].filter(row=>!sql.includes('WHERE id=$1')||row.id===values[0]));}
  if(/^(INSERT|UPDATE|DELETE)/.test(sql)&&sql.includes('public."Task"'))calls.taskWrites++;
  throw Error('Unexpected synthetic SQL '+sql);
 }};
 const workspace={async projectOperation(session,context,writable,callback){
  calls.operations.push({projectId:context.projectId,scope:context.scope,writable});
  if(context.projectId!==budgetContext.projectId||context.scope!==budgetContext.scope||session.userId!==budgetSession.userId||session.organizationId!==budgetSession.organizationId)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',403);
  const before=clone({logs,tasks});try{return await callback(client,{role,channelProof,actorId:'budget-actor',organizationId:'budget-org'},context.scope);}catch(error){if(writable){logs=before.logs;tasks=before.tasks;}throw error;}
 }};
 const put=async(path,bytes,options)=>{calls.put++;blobs.set(path,{bytes:Buffer.from(bytes),contentType:options.contentType});if(afterPut)await afterPut();};
 const get=async path=>{
  calls.get++;const item=blobs.get(path);if(!item)return {statusCode:404};if(afterGet)await afterGet();
  return {statusCode:200,blob:{url:'https://budget.private.blob.vercel-storage.com/'+path,pathname:path,size:item.bytes.length,contentType:item.contentType},stream:new Response(item.bytes).body};
 };
 const localAnalyzer=createPlanImportAnalyzer({environment:()=>{calls.providerConfiguration++;throw Error('Local budget must not inspect AI configuration');},fetchImpl:async()=>{calls.provider++;throw Error('Forbidden provider');}});
 const analyzer={async analyze(...args){calls.analyzer++;return localAnalyzer.analyze(...args);}};
 const imports=createPlanImport({workspace,put,get,analyzer,usage,environment:()=>{calls.storageConfiguration++;return {PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-unused-token'};}});
 return {imports,calls,workspace,state:()=>clone({logs,tasks}),setRole:value=>{role=value;},setChannelProof:value=>{channelProof=value;},setAfterGet:value=>{afterGet=value;},setAfterPut:value=>{afterPut=value;},mutateDraft:(id,mutate)=>mutate(logs.get(id).metadata),addLog:row=>logs.set(row.id,clone(row)),addTask:row=>tasks.set(row.id,clone(row)),mutateBlob:(path,mutate)=>mutate(blobs.get(path))};
}
