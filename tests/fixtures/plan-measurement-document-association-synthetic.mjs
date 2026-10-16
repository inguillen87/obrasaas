import {createHash,randomUUID} from 'node:crypto';
import {createPlanMeasurement} from '../../src/lib/plan-measurement-store.mjs';
import {normalizePlanMeasurementDocument,planMeasurementSourceDigest} from '../../src/lib/plan-measurement-source.mjs';
import {WorkspaceError} from '../../src/lib/workspace-policy.mjs';

export const documentMeasurementContext={projectId:'document-association-project',scope:'a'.repeat(64)};
export const documentMeasurementSession={authenticated:true,verification:'clerk-production-jwt',userId:'user_DocumentAssociation'};
export const documentMeasurementReason='Comparé la fila y la tarea elegida con el documento original.';
const sha=value=>createHash('sha256').update(value).digest('hex'),clone=value=>structuredClone(value);

// The fixture starts after private document extraction. It uses the real
// document normalizer and measurement service; no OCR, Blob or SQL server is
// represented as having run. Every recognized SQL branch is bounded below.
export function documentMeasurementHarness(){
 let logs=new Map(),tasks=new Map(),role='ADMIN',pending=false,failReceipt=false,tick=0;
 const calls={sql:[],provider:0,blob:0},revision=()=>`2026-10-14T12:00:00.${String(++tick).padStart(6,'0')}`;
 const member=()=>({actorId:'document-association-actor',organizationId:'document-association-org',role});
 const result=rows=>({rows:clone(rows)});
 const client={async query(raw,values=[]){const sql=raw.replace(/\s+/g,' ').trim();calls.sql.push(sql);
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."AuditLog"')){
   let rows=[...logs.values()];
   for(const field of ['organizationId','actorId','entityId']){const match=sql.match(new RegExp('"'+field+'"=\\$(\\d+)'));if(match)rows=rows.filter(row=>row[field]===values[Number(match[1])-1]);}
   const action=sql.match(/action='([^']+)'/);if(action)rows=rows.filter(row=>row.action===action[1]);
   if(sql.includes('WHERE id=$1'))rows=rows.filter(row=>row.id===values[0]);
   const purpose=sql.match(/metadata->>'sourcePurpose'=\$(\d+)/);if(purpose)rows=rows.filter(row=>row.metadata.sourcePurpose===values[Number(purpose[1])-1]);
   const source=sql.match(/metadata->'source'->>'sha256'=\$(\d+)/);if(source)rows=rows.filter(row=>row.metadata.source.sha256===values[Number(source[1])-1]);
   if(sql.includes("metadata->>'status'='APPLIED'"))rows=rows.filter(row=>row.metadata.status==='APPLIED');
   if(sql.includes('AND id<>$5'))rows=rows.filter(row=>row.id!==values[4]);return result(rows);
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){const[id,organizationId,actorId,entityId,json]=values;if(failReceipt)throw Error('Synthetic durable receipt failure');if(logs.has(id))throw Error('Duplicate synthetic receipt');logs.set(id,{id,organizationId,actorId,entityId,action:'plan.measurement.recorded',metadata:JSON.parse(json)});return result([]);}
  if(sql.startsWith('UPDATE public."AuditLog"')){const[id,json,expected]=values,row=logs.get(id);if(!row||row.metadata.revision!==expected)return result([]);row.metadata=JSON.parse(json);return result([{id}]);}
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."Task"')){const rows=sql.includes('WHERE id=$1')?[tasks.get(values[0])].filter(row=>row?.projectId===values[1]):[...tasks.values()].filter(row=>row.projectId===values[0]);return result(rows);}
  if(sql.startsWith('UPDATE public."Task"')){const[id,projectId,json,expected]=values,row=tasks.get(id);if(!row||row.projectId!==projectId||row.revision!==expected)return result([]);row.metadata=JSON.parse(json);row.revision=revision();return result([{id}]);}
  if(sql.startsWith('INSERT INTO public."Task"')){const[id,projectId,title,startsOn,endsOn,json]=values;if(tasks.has(id))throw Error('Duplicate synthetic Task');tasks.set(id,{id,projectId,title,startsOn,endsOn,status:'BACKLOG',progress:0,metadata:JSON.parse(json),revision:revision()});return result([]);}
  if(sql.startsWith('SELECT id FROM public."OperationalProposal"'))return result(pending?[{id:'pending-synthetic'}]:[]);
  throw Error('Unexpected document-association SQL: '+sql);
 }};
 const workspace={async projectOperation(session,context,writable,callback){
  if(session.userId!==documentMeasurementSession.userId||context.projectId!==documentMeasurementContext.projectId||context.scope!==documentMeasurementContext.scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',403);
  const before=clone({logs,tasks});try{return await callback(client,member(),context.scope);}catch(error){if(writable){logs=before.logs;tasks=before.tasks;}throw error;}
 }};
 const imports={attach(){throw Error('Document upload is outside this fixture');},source(){calls.blob++;throw Error('No private download in association decisions');},read(){throw Error('Unexpected upload-receipt fallback');}};
 const measurements=createPlanMeasurement({workspace,imports});
 function addDocument({label='source-one',contentType='application/pdf',rows}={}){
  const sourceSha256=sha(Buffer.from('SYNTHETIC DOCUMENT '+label)),source=normalizePlanMeasurementDocument({isMeasurement:true,truncated:false,warnings:[],rows:rows||[{code:null,title:'Partida documental sin código',rawQuantity:'12.5',rawUnit:'m2',evidence:[{page:1,quote:'Partida documental sin código: 12.5 m2',location:'Fila de prueba'}],uncertainty:'Lectura documental pendiente de comparación humana.'}]},{sourceSha256,contentType});
  const id='plan_draft_'+sha(randomUUID()),at='2026-10-14T12:00:00.000Z',metadata={version:1,projectId:documentMeasurementContext.projectId,sourcePurpose:'PHYSICAL_TASK_MEASUREMENT',revision:1,status:'READY',source:{contentType,bytes:100,sha256:sourceSha256},sourceConfirmed:true,consent:{version:'plan-source-quantities-openai-v1',actorId:member().actorId,recordedAt:at},analysis:{measurementSource:source},measurementReview:null,createdAt:at,updatedAt:at,warnings:[]};
  logs.set(id,{id,organizationId:member().organizationId,actorId:member().actorId,entityId:documentMeasurementContext.projectId,action:'plan.import.draft',metadata});
  return {id,revision:1,status:'READY',source:clone(metadata.source),measurementSource:clone(source),sourceDigest:planMeasurementSourceDigest(source),review:null};
 }
 function addTask(value={}){const row={id:'existing-document-task',projectId:documentMeasurementContext.projectId,title:'Título elegido expresamente, diferente del documento',startsOn:'2026-11-01',endsOn:'2026-11-02',status:'BACKLOG',progress:0,metadata:{preserved:true},revision:revision(),...clone(value)};tasks.set(row.id,row);return clone(row);}
 return {measurements,addDocument,addTask,calls,state:()=>clone({logs,tasks}),setRole:value=>{role=value;},setPending:value=>{pending=value;},setFailReceipt:value=>{failReceipt=value;},mutateTask:(id,edit)=>edit(tasks.get(id)),mutateDraft:(id,edit)=>edit(logs.get(id).metadata)};
}

export function documentMeasurementCommand(draft,action='REVIEW_MEASUREMENT',overrides={}){return {...documentMeasurementContext,operationId:randomUUID(),action,draftId:draft.id,expectedRevision:draft.revision,sourceSha256:draft.source.sha256,sourceDigest:draft.sourceDigest,reviewDigest:action==='APPLY_MEASUREMENT'?draft.review?.digest:null,reason:documentMeasurementReason,rows:null,destinations:null,excludedRows:null,...overrides};}
export function documentMeasurementReview(draft,task,overrides={}){const row=draft.measurementSource.rows[0];return documentMeasurementCommand(draft,'REVIEW_MEASUREMENT',{rows:[{sourceRowId:row.sourceRowId,baseline:'12.5000',unit:'M2',reason:documentMeasurementReason,confirmed:true,issuesAcknowledged:true,identityConfirmed:true}],destinations:[{sourceRowId:row.sourceRowId,mode:'EXISTING',taskId:task.id,revision:task.revision,sourceCode:null,confirmIdentity:true,replacement:'CONFIGURE',expectedDefinitionId:null,confirmReplacement:false,documentAssociation:{version:1,mode:'DOCUMENT_ROW',sourceSha256:draft.source.sha256,sourceDigest:draft.sourceDigest,sourceRowId:row.sourceRowId,taskId:task.id,taskRevision:task.revision,confirmed:true}}],excludedRows:draft.measurementSource.rows.slice(1).map(row=>({sourceRowId:row.sourceRowId,reason:documentMeasurementReason})),...overrides});}
