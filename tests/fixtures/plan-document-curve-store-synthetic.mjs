import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceStore} from '../../src/lib/workspace-store.mjs';
import {scopeStamp} from '../../src/lib/workspace-policy.mjs';
import {createPlanImport} from '../../src/lib/plan-import-store.mjs';
import {createPlanImportAnalyzer} from '../../src/lib/plan-import-analyzer.mjs';
import {createPlanBaseline} from '../../src/lib/plan-baseline-store.mjs';
import {createPlanImportHandlers} from '../../src/lib/plan-import-http.mjs';
import {createPlanBaselineHandlers} from '../../src/lib/plan-baseline-http.mjs';
import {decodePlanSource,PLAN_IMPORT_DOCUMENT_CURVE_CONSENT} from '../../src/lib/plan-import-policy.mjs';
import {documentCurveProviderFixture} from './plan-import-document-curve-synthetic.mjs';
import {createOrganizationUsage} from '../../src/lib/organization-usage-store.mjs';

// Actual canonical store/HTTP/analyzer, synthetic transactional SQL and Blob.
// This fixture makes no native-lock, real Clerk, customer PDF or provider claim.
export const projectId='project-document-synthetic',organizationId='org-document-synthetic';
export const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_DocumentSynthetic',organizationId:'org_DocumentSynthetic',organizationRole:'org:admin'};
const clone=value=>structuredClone(value),data=rows=>({rows:clone(rows)});
export function documentStoreHarness({role='ADMIN',taskCount=5001,withUsage=false}={}){
 const member={actorId:'actor-document-synthetic',membershipId:'membership-document-synthetic',organizationId,organizationName:'Synthetic company',role,officeReviewOnly:false};
 const records=new Map(),blobs=new Map(),tasks=new Map(Array.from({length:taskCount},(_,i)=>['old-'+i,{id:'old-'+i,title:'Synthetic existing '+i,status:'IN_PROGRESS',progress:73,startsOn:'2026-01-01',endsOn:'2026-02-01',revision:'2026-01-01T00:00:00.000Z'}]));
 const controls={membership:true,project:true,projectOrganization:organizationId,commitMode:null,forbidTasks:true,afterQuery:null,afterBlob:null,afterProvider:null,afterReservation:null,curve:null};
 const calls={sql:[],released:0,mutations:0,put:0,get:0,provider:0,taskWrites:0};
 const matches=(row,sql,args)=>{
  for(const key of ['organizationId','actorId','entityId']){const at=sql.match(new RegExp('"'+key+'"=\\$(\\d+)'));if(at&&row[key]!==args[Number(at[1])-1])return false;}
  const action=sql.match(/action='([^']+)'/)?.[1];return !action||row.action===action;
 };
 const connect=async()=>{let tx=null;return {release(){calls.released++;},async query(raw,args=[]){
  const sql=raw.replace(/\s+/g,' ').trim();calls.sql.push(sql);
  if(sql.startsWith('BEGIN')){tx=clone(records);return data([]);}
  if(sql.startsWith('SET LOCAL'))return data([]);
  if(sql==='COMMIT'){const mode=controls.commitMode;controls.commitMode=null;if(mode==='ROLLBACK')throw Error('Synthetic pre-durability failure');records.clear();for(const [k,v] of tx)records.set(k,v);tx=null;if(mode==='ACK_LOST')throw Error('Synthetic durable ACK loss');return data([]);}
  if(sql==='ROLLBACK'){tx=null;return data([]);}
  let result;
  if(sql.includes('pg_advisory_xact_lock'))result=data([]);
  else if(sql==='SELECT clock_timestamp() AS now')result=data([{now:new Date()}]);
  else if(sql.includes('FROM public."Organization"'))result=data(args[0]===organizationId?[{id:organizationId,name:'Synthetic company',metadata:{},subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date(Date.now()+86400000),observedAt:new Date()}]:[]);
  else if(sql.includes('FROM public."PlatformUser"'))result=data(controls.membership&&args[0]===session.userId&&args[1]===session.organizationId&&args[2]===session.organizationRole?[member]:[]);
  else if(sql.includes('public."Worker"')||sql.includes("action='participant.operation.recorded'"))result=data([]);
  else if(sql.includes('FROM public."ProjectMembership"'))result=data([{id:'assignment-document-synthetic'}]);
  else if(sql.includes('FROM public."Project"'))result=data(controls.project&&args[0]===projectId&&args[1]===controls.projectOrganization?[{id:projectId,name:'Synthetic project',status:'ACTIVE'}]:[]);
  else if(sql.includes('public."Task"')){
   assert.equal(controls.forbidTasks,false,'Financial document path must never query or write Task');
   if(sql.startsWith('SELECT'))result=data([...tasks.values()].sort((a,b)=>a.id.localeCompare(b.id)));
   else if(sql.startsWith('INSERT')){calls.taskWrites++;const created=[];for(let i=0;i<args.length;i+=6){const [id,,title,startsOn,endsOn,metadata]=args.slice(i,i+6),row={id,title,startsOn,endsOn,status:'BACKLOG',progress:0,revision:'2026-01-01T00:00:00.000Z',metadata:JSON.parse(metadata)};tasks.set(id,row);created.push(row);}result=data(created);}
   else assert.fail('Unexpected Task mutation');
  }else if(sql.includes('FROM public."AuditLog" d')){
   let rows=[...tx.values()].filter(row=>row.action==='plan.import.draft'&&row.organizationId===args[0]&&row.entityId===args[1]);
   if(sql.includes('d.id=$3'))rows=rows.filter(row=>row.id===args[2]);else rows=rows.filter(row=>row.metadata.status==='APPLIED'&&row.metadata.consent.version===PLAN_IMPORT_DOCUMENT_CURVE_CONSENT&&row.id>args[2]).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,11);
   result=data(rows.map(row=>{const found=tx.get(row.metadata.decision?.receiptId),r=found?.action==='plan.import.decision'?found:null;return {...row,decisionId:r?.id,decisionMetadata:r?.metadata,decisionOrganizationId:r?.organizationId,decisionEntityId:r?.entityId,decisionActorId:r?.actorId};}));
  }else if(sql.startsWith('SELECT')&&sql.includes('public."AuditLog"')){
   let rows=[...tx.values()].filter(row=>matches(row,sql,args));if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===args[0]);
   if(sql.includes("metadata->>'status'='APPLIED'")){rows=rows.filter(row=>row.metadata.status==='APPLIED'&&row.metadata.source.sha256===args[2]);const same=sql.includes("= '"+PLAN_IMPORT_DOCUMENT_CURVE_CONSENT+"'");rows=rows.filter(row=>(row.metadata.consent.version===PLAN_IMPORT_DOCUMENT_CURVE_CONSENT)===same);}
   if(sql.includes('ORDER BY')&&sql.includes("<> '"+PLAN_IMPORT_DOCUMENT_CURVE_CONSENT+"'"))rows=rows.filter(row=>row.metadata.consent?.version!==PLAN_IMPORT_DOCUMENT_CURVE_CONSENT&&row.metadata.analysis?.documentCurve?.profile!=='DOCUMENT_MONTHLY_CURVE_V1');
   if(sql.includes('NOT EXISTS (SELECT 1 FROM public."AuditLog" f')){const privateHashes=new Set([...tx.values()].filter(row=>row.action==='plan.import.draft'&&row.organizationId===args[0]&&row.entityId===args[1]&&(row.metadata.consent?.version===PLAN_IMPORT_DOCUMENT_CURVE_CONSENT||row.metadata.sourcePurpose==='FINANCIAL_MONTHLY_CURVE')).map(row=>row.metadata.source.sha256));rows=rows.filter(row=>!privateHashes.has(row.metadata.source.sha256));}
   if(sql.includes('ORDER BY'))rows.sort((a,b)=>b.metadata.createdAt.localeCompare(a.metadata.createdAt)||b.id.localeCompare(a.id));const limit=sql.match(/LIMIT (\d+)/);if(limit)rows=rows.slice(0,Number(limit[1]));result=data(rows);
  }else if(sql.startsWith('INSERT INTO public."AuditLog"')){
   const [id,org,actor,entity,metadata,expectedRevision]=args,action=sql.match(/'((?:plan\.import|plan\.baseline)\.[a-z]+|organization\.usage\.plan-import)'/)?.[1],prior=tx.get(id);assert.ok(action);
   if(prior&&(action!=='plan.baseline.active'||prior.action!==action||prior.organizationId!==org||prior.entityId!==entity||prior.metadata.revision!==expectedRevision))return data([]);
   calls.mutations++;tx.set(id,{id,organizationId:org,actorId:actor,entityId:entity,action,metadata:JSON.parse(metadata)});result=data([{id}]);
  }else if(sql.startsWith('UPDATE public."AuditLog"')){
   const [id,metadata,lease,expiry]=args,row=tx.get(id);assert.ok(row);if(lease&&(row.metadata.lease?.token!==lease||row.metadata.lease.expiresAt!==expiry||Date.parse(expiry)<=Date.now()))return data([]);calls.mutations++;row.metadata=JSON.parse(metadata);result=data([{id}]);
  }else assert.fail('Unexpected synthetic SQL: '+sql);
  await controls.afterQuery?.(sql,args,tx);return result;
 }};};
 const workspace=createWorkspaceStore({connect}),analyzer=createPlanImportAnalyzer({environment:()=>({OPENAI_API_KEY:'synthetic-openai-key-not-a-service-secret'}),fetchImpl:async(_url,options)=>{
  calls.provider++;if(withUsage){assert.match(options.headers['X-Client-Request-Id'],/^organization_usage_[a-f0-9]{64}$/);assert.equal([...records.values()].find(row=>row.action==='organization.usage.plan-import').metadata.state,'DISPATCHED','Usage dispatch must be durable before controlled HTTP');}await controls.afterProvider?.();const name=JSON.parse(options.body).text.format.name,output=name==='plan_document_monthly_curve'?{isMonthlyFinancialCurve:true,truncated:false,warnings:[],curve:clone(controls.curve||documentCurveProviderFixture())}:{isSchedule:true,truncated:false,warnings:[],rows:[{title:'Curated synthetic task',startsOn:'2026-01-01',endsOn:'2026-02-01',evidence:'Source page one',uncertainty:''}]};return Response.json({status:'completed',model:'gpt-4o',usage:{input_tokens:123,output_tokens:17,total_tokens:140},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(output)}]}]});
 }});
 const usage=withUsage?createOrganizationUsage({workspace,connect}):null;if(usage){const reserve=usage.reserve;usage.reserve=async(...args)=>{const value=await reserve(...args);await controls.afterReservation?.();return value;};}
 const imports=createPlanImport({workspace,analyzer,usage,environment:()=>({BLOB_READ_WRITE_TOKEN:'synthetic-blob-key-not-a-service-secret',PRIVATE_MEDIA_PROVIDER:'vercel-blob'}),async put(path,bytes,options){assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);calls.put++;blobs.set(path,{bytes:Buffer.from(bytes),contentType:options.contentType});},async get(path,options){assert.equal(options.access,'private');calls.get++;await controls.afterBlob?.();const b=blobs.get(path);assert.ok(b);return {statusCode:200,blob:{url:'https://synthetic.private.blob.vercel-storage.com/'+path,pathname:path,size:b.bytes.length,contentType:b.contentType},stream:new Response(b.bytes).body};}});
 const baselines=createPlanBaseline({workspace}),context=()=>({projectId,scope:scopeStamp(session,member)}),http=createPlanImportHandlers({verify:async()=>session,imports}),baselineHttp=createPlanBaselineHandlers({verify:async()=>session,baselines});
 const source=(label='one')=>decodePlanSource(Buffer.from('%PDF-1.7\nSynthetic monthly document '+label+'\n%%EOF'),'application/pdf');
 const attach=(input={})=>imports.attach(session,{...context(),operationId:randomUUID(),consent:PLAN_IMPORT_DOCUMENT_CURVE_CONSENT,source:source(),...input});
 const decision=(draft,action='REVIEW_CURVE',curve=draft.documentCurve)=>({...context(),action,operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,reason:'Explicit synthetic human source review',rows:null,curve:action==='REVIEW_CURVE'?curve:null});
 const baselineInput=draft=>({action:'SELECT',...context(),operationId:randomUUID(),draftId:draft.id,draftRevision:draft.revision,decisionReceiptId:draft.decision.receiptId,sourceSha256:draft.source.sha256,expectedBaselineId:null,expectedBaselineRevision:0,reason:'Explicit synthetic baseline selection',confirmed:true});
 return {imports,baselines,http,baselineHttp,workspace,connect,context,source,attach,decision,baselineInput,calls,controls,member,logs:()=>clone([...records.values()]),tasks:()=>clone([...tasks.values()]),changeLog:(id,fn)=>fn(records.get(id)),addLog:row=>records.set(row.id,clone(row))};
}
