import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from '../../src/lib/workspace-policy.mjs';
import {createFieldOperations} from '../../src/lib/field-operations-store.mjs';
import {inventoryCatalogHash} from '../../src/lib/material-inventory.mjs';
import {TASK_MEASUREMENT_VERSION} from '../../src/lib/task-progress-measurement.js';

// Transactional model for fast store tests. It exercises the actual field
// command/store, but models Project serialization; PostgreSQL locking is tested
// separately by verify-field-execution-postgres.mjs.
export function fieldExecutionFixture({measured=false,balance='10.000'}={}){
 const clone=structuredClone,scope='a'.repeat(64),revision='2026-10-24T12:00:00.123456',now='2026-10-24T12:00:00.000Z';
 const members={owner:{actorId:'owner',membershipId:'owner-m',organizationId:'company-a',clerkUserId:'user_Owner',clerkRole:'org:admin',role:'ADMIN'},director:{actorId:'director',membershipId:'director-m',organizationId:'company-a',clerkUserId:'user_Director',clerkRole:'org:member',role:'DIRECTOR'},worker:{actorId:'worker',membershipId:'worker-m',organizationId:'company-a',clerkUserId:'user_Worker',clerkRole:'org:member',role:'AUDITOR'}};
 const images=[{id:'document-front',kind:'DOCUMENT_FRONT'},{id:'selfie',kind:'SELFIE'}],contentHash=digest(images);
 const state={now,project:{id:'p-a',metadata:{preserve:{nested:true},fieldOperations:{version:1,sectors:[{id:'sector-a',name:'Sector sintético'}]},materialInventory:{version:1,catalogVersion:1,materials:[{id:'material-a',name:'Cemento sintético',unit:'bolsa',active:true,balance},{id:'material-b',name:'Árido sintético',unit:'kg',active:true,balance:'5.000'}]}}},task:{id:'task-a',title:'Tarea sintética',progress:0,status:'BLOCKED',startsOn:'2026-10-20',endsOn:'2026-11-20',revision,metadata:{preserve:{nested:true},...(measured?{fieldOperations:{version:1,measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'measurement-a',baseline:'10.0000',unit:'M2',sourceReference:'Plano aprobado sintético',configuredBy:'owner',configuredAt:now}}}:{})}},worker:{id:'w-worker',projectId:'p-a',name:'Persona sintética',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:'user_Worker',permissions:{report:true,attendance:true},kyc:{version:1,status:'APPROVED',submissionId:'kyc-a',contentHash,images,review:{actorId:'owner',decision:'APPROVED',recordedAt:now}}}}},evidence:{id:'e-a',projectId:'p-a',metadata:{fieldOperations:{version:1,kind:'EVIDENCE',workerId:'w-worker',taskId:'task-a',sectorId:'sector-a',recordedBy:'worker',review:{decision:'APPROVE',actorId:'owner'}}}},audits:[],proposals:[],issuerActive:true,issuerBound:false,issuerAssigned:true,issuerWorker:false,reviewPresent:true,submissionPresent:true};
 const controls={fail:null,afterWrite:null,loseCommit:false,zeroTaskUpdate:false,omitBeforeProject:false},queries=[];let readOnly=false;
 const result=rows=>({rows:clone(rows),rowCount:rows.length});
 const client={async query(sql,args=[]){
  queries.push({sql,args:clone(args)});
  if(readOnly)assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE)\b|FOR (?:SHARE|UPDATE)/,'Read-only fixture cannot lock or write rows');
  if(controls.fail&&sql.includes(controls.fail))throw new Error('SYNTHETIC_WRITE_FAILURE');
  if(sql==='SELECT clock_timestamp() AS now')return result([{now:new Date(state.now)}]);
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')){const member=Object.values(members).find(m=>m.actorId===args[0]&&m.membershipId===args[1]);return result(state.issuerActive&&member?[{...member,officeReviewOnly:false}]:[]);}
  if(sql.includes('SELECT w.id,w.active,w.metadata')){const principal=Object.values(members).find(row=>row.clerkUserId===state.worker.metadata.participant.clerkUserId);return result(state.worker.active&&principal&&state.worker.metadata.participant.status==='ACTIVE'&&state.worker.metadata.participant.permissions.report&&args[0]===state.worker.id?[{...state.worker,...principal,id:state.worker.id}]:[]);}
  if(sql.includes('FROM public."Worker" w')&&sql.includes('JOIN public."Project"'))return result(state.issuerBound?[{id:'bound-origin'}]:[]);
  if(sql.includes('FROM public."ProjectMembership"'))return result(state.issuerAssigned?[{id:'assignment'}]:[]);
  if(sql.startsWith('SELECT id,name,active,metadata FROM public."Worker"')&&sql.includes('ORDER BY id LIMIT 101'))return result(state.worker.active&&state.worker.metadata.participant.permissions.report&&state.worker.metadata.participant.kyc.status==='APPROVED'?[state.worker]:[]);
  if(sql.includes('FROM public."Worker"')&&sql.includes("metadata->'participant'->>'clerkUserId'")){
   if(sql.includes('permissions'))return result(state.worker.active&&state.worker.metadata.participant.status==='ACTIVE'&&state.worker.metadata.participant.permissions[args[3]||'report']&&state.worker.metadata.participant.clerkUserId===args[2]?[state.worker]:[]);
   return result(state.issuerWorker?[{...state.worker,id:'issuer-worker'}]:[]);
  }
  if(sql.includes('FROM public."Worker"'))return result(args[0]===state.worker.id?[state.worker]:[]);
  if(sql.includes('FROM public."Task"'))return result(args[0]===state.task.id?[state.task]:[]);
  if(sql.includes('FROM public."Incident"'))return result(args[0]===state.evidence.id?[state.evidence]:[]);
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("'INVITATION_ACCEPTED'"))return result(state.issuerBound?[{id:'origin'}]:[]);
   if(sql.includes("'REVIEW_KYC'"))return result(state.reviewPresent?[{id:'review'}]:[]);
   if(sql.includes("'KYC_SUBMITTED'"))return result(state.submissionPresent?[{id:'submission',metadata:{contentHash}}]:[]);
   const action=['field.operation.recorded','field.execution.mandate','field.execution.applied'].find(action=>sql.includes("action='"+action+"'"));
   assert.ok(action,'Unexpected audit SELECT: '+sql);
   if(sql.includes('ORDER BY "createdAt" DESC,id DESC LIMIT 101'))return result(state.audits.filter(row=>row.organizationId===args[0]&&row.entityId===args[1]&&row.action===action&&(action==='field.execution.mandate'?row.metadata.state==='ACTIVE'&&(args[2]||row.metadata.reporterActorId===args[3]):args[3]||row.actorId===args[4]&&row.metadata.command==='REPORT_EXECUTION')).slice().reverse().slice(0,101));
   return result(state.audits.filter(row=>row.id===args[0]&&row.organizationId===args[1]&&row.action===action&&(action==='field.operation.recorded'?row.actorId===args[2]:row.entityId===args[2])));
  }
  let changed=false;
  if(sql.startsWith('INSERT INTO public."AuditLog"')){
   const action=['field.operation.recorded','field.execution.mandate','field.execution.applied','material.inventory.moved'].find(action=>sql.includes("'"+action+"'"));assert.ok(action);
   assert.ok(!state.audits.some(row=>row.id===args[0]),'Unique audit ID');state.audits.push({id:args[0],organizationId:args[1],actorId:args[2],action,entityType:'Project',entityId:args[3],metadata:JSON.parse(args[4])});changed=true;
  }else if(sql.startsWith('UPDATE public."AuditLog"')){
   const row=state.audits.find(row=>row.id===args[0]&&row.organizationId===args[1]&&row.entityId===args[2]);if(!row)return {rows:[],rowCount:0};row.metadata=JSON.parse(args[3]);changed=true;
  }else if(sql.startsWith('UPDATE public."Project"')){state.project.metadata.materialInventory=JSON.parse(args[2]);changed=true;
  }else if(sql.startsWith('INSERT INTO public."OperationalProposal"')){state.proposals.push({id:args[0],action:JSON.parse(args[6]),status:'APPLIED'});changed=true;
  }else if(sql.startsWith('UPDATE public."Task"')){if(controls.zeroTaskUpdate)return {rows:[],rowCount:0};state.task.progress=args[2];state.task.status=args[3];state.task.metadata=JSON.parse(args[4]);state.task.revision='2026-10-24T12:00:01.123456';changed=true;}
  assert.ok(changed,'Unexpected SQL: '+sql);if(controls.afterWrite)controls.afterWrite(sql,state);return {rows:[],rowCount:1};
 }};
 let tail=Promise.resolve();
 const workspace={async projectOperation(session,context,writable,callback,beforeProject){
  const previous=tail;let unlock;tail=new Promise(resolve=>unlock=resolve);await previous;
  const before=clone(state),base=Object.values(members).find(m=>m.clerkUserId===session.userId),member={...base,...(session.channel?{channelProof:{provider:'synthetic-signed-channel'}}:{})};
  try{
   readOnly=!writable;
   if(!base||context.projectId!=='p-a'||context.scope!==scope)throw new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404);
   if(beforeProject&&!controls.omitBeforeProject)await beforeProject(client,member,scope);
   const outcome=await callback(client,member,scope,clone(state.project));
   if(controls.loseCommit){controls.loseCommit=false;throw Object.assign(new Error('SYNTHETIC_COMMIT_ACK_LOST'),{committed:true});}return outcome;
  }catch(error){if(!error.committed){for(const key of Object.keys(state))delete state[key];Object.assign(state,before);}throw error;}finally{readOnly=false;unlock();}
 }};
 const operations=createFieldOperations({workspace}),session=name=>({authenticated:true,verification:'clerk-production-jwt',userId:members[name].clerkUserId,organizationId:'org_A',organizationRole:members[name].clerkRole}),command=(action,payload)=>({projectId:'p-a',scope,operationId:randomUUID(),action,payload});
 const catalogHash=()=>inventoryCatalogHash(state.project.metadata.materialInventory);
 const issuePayload=()=>({workerId:'w-worker',taskId:'task-a',taskRevision:state.task.revision,sectorId:'sector-a',catalogHash:catalogHash(),validUntil:'2026-10-25T12:00:00.000Z',materials:[{materialId:'material-a',unit:'bolsa',limit:'8.000',maxPerReport:'4.000'},{materialId:'material-b',unit:'kg',limit:'5.000',maxPerReport:'5.000'}],progress:measured?{definitionId:'measurement-a',baseline:'10.0000',unit:'M2',limit:'8.0000',maxPerReport:'4.0000'}:null,reason:'Mandato acotado autorizado para trabajo sintético.'});
 const reportPayload=mandateId=>({reportId:randomUUID(),mandateId,mandateRevision:1,workerId:'w-worker',taskId:'task-a',taskRevision:state.task.revision,sectorId:'sector-a',catalogHash:catalogHash(),lines:[{lineId:'line-a',materialId:'material-a',unit:'bolsa',quantity:'1.001'},{lineId:'line-b',materialId:'material-a',unit:'bolsa',quantity:'0.999'}],progress:null,evidenceIds:[],reason:'Cantidades exactas aplicadas a la tarea sintética.'});
 return {state,controls,queries,operations,session,command,issuePayload,reportPayload,scope,async issue(name='owner',patch={}){return operations.save(session(name),command('ISSUE_EXECUTION_MANDATE',{...issuePayload(),...patch}));},async report(mandateId,patch={},operation){return operations.save(session('worker'),operation||command('REPORT_EXECUTION',{...reportPayload(mandateId),...patch}));},snapshot:()=>clone(state),movements:()=>state.audits.filter(row=>row.action==='material.inventory.moved'),receipts:()=>state.audits.filter(row=>row.action==='field.operation.recorded')};
}
