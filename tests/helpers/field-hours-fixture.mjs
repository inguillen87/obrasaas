import './field-hours-network-guard.mjs';
import assert from 'node:assert/strict';
import {after} from 'node:test';
assert.equal(globalThis.__hoursExportNetworkGuard?.active,true,'The test-local network guard must be active before any fixture runs.');
after(()=>assert.deepEqual(globalThis.__hoursExportNetworkGuard.attempts,[],'No test may attempt real network/provider/DB access.'));
import {digest,scopeStamp} from '../../src/lib/workspace-policy.mjs';
import {readFieldHoursReport} from '../../src/lib/field-hours-report.mjs';
import {createWorkspaceStore} from '../../src/lib/workspace-store.mjs';
import {createFieldOperations} from '../../src/lib/field-operations-store.mjs';

export const period={fromDate:'2026-10-01',untilDate:'2026-11-01',timeZone:'America/Argentina/Buenos_Aires'};
export const clone=value=>structuredClone(value);
const result=rows=>({rows:clone(rows),rowCount:rows.length});
export function shift({id='shift-a',workerId='worker-a',actorId='actor-worker',projectId='project-a',types=['CHECK_IN','CHECK_OUT'],times=['2026-10-05T11:00:00.000Z','2026-10-05T19:00:00.000Z'],initialSequence=1,previousEventId=null,verificationStatus='VERIFIED'}={}){
 assert.equal(types.length,times.length);
 return types.map((eventType,index)=>{
  const idEvent='attendance-'+id+'-'+(initialSequence+index),located=['CHECK_IN','CHECK_OUT'].includes(eventType);
  return {id:idEvent,projectId,workerId,metadata:{preserve:'PRIVATE_METADATA_NOT_IN_PROJECTION',fieldOperations:{version:1,eventType,phase:eventType==='BREAK_START'?'ON_BREAK':'WORKING',shiftId:id,sequence:initialSequence+index,previousEventId:index?'attendance-'+id+'-'+(initialSequence+index-1):previousEventId,sectorId:'sector-fixture',sectorName:'Sector sintético',configRevision:'config-fixture',qrStatus:located?'MATCHED':'NOT_PROVIDED',verificationStatus:located?verificationStatus:'NOT_REQUIRED',location:located?{latitude:12.345678,longitude:23.456789,accuracyMeters:3,distanceMeters:0,geofenceRadiusMeters:30,locationCapturedAt:times[index],noticeVersion:'field-location-v1'}:null,recordedBy:actorId,recordedAt:times[index],source:'account',review:null}}};
 });
}
export function receipt(row,{command='ATTENDANCE',event,actorId,idSalt=''}={}){
 const e=row.metadata.fieldOperations,value=event||{id:row.id,workerId:row.workerId,...clone(e)};
 return {id:'field_'+digest(['synthetic-hours-receipt',row.id,command,idSalt]),organizationId:'company-a',actorId:actorId||(command==='REVIEW_ATTENDANCE'?e.review.actorId:e.recordedBy),action:'field.operation.recorded',entityType:'Project',entityId:row.projectId,metadata:{version:1,projectId:row.projectId,command,requestDigest:digest(['synthetic-request',row.id,command,idSalt]),outcome:{kind:command==='ATTENDANCE'?'ATTENDANCE':'ATTENDANCE_REVIEW',event:value}}};
}
export function addReview(f,row,decision='APPROVE',{actorId='actor-reviewer',at='2026-10-06T11:00:00.000Z',reason='Revisión sintética fundada'}={}){
 row.metadata.fieldOperations.verificationStatus='REVIEW_REQUIRED';
 const original=f.state.receipts.find(item=>item.metadata.command==='ATTENDANCE'&&item.metadata.outcome.event.id===row.id);
 if(original)original.metadata.outcome.event.verificationStatus='REVIEW_REQUIRED';
 row.metadata.fieldOperations.review={decision,actorId,recordedAt:at,reason};f.state.receipts.push(receipt(row,{command:'REVIEW_ATTENDANCE'}));return row;
}
function makeState(){return {project:{id:'project-a',name:'Obra sintética',metadata:{},organizationMetadata:{}},scope:'a'.repeat(64),ledger:[],workers:[],receipts:[],generatedAt:'2026-10-18T12:00:00.000Z',afterLedger:null,memberActive:true,projectActive:true,assignmentActive:true,officeReviewOnly:false,ownWorkers:[],origin:false,kycReview:true,kycSubmission:true};}
function memorySelect(view,sql,args){
 if(sql.includes('AS "generatedAt"'))return result([{generatedAt:view.generatedAt}]);
 if(sql.includes('FROM public."AttendanceEntry"')){
  assert.ok(sql.startsWith('SELECT id,"projectId","workerId",metadata '),'Only bounded source read supported');
  assert.equal(args[0],view.project.id);assert.equal(args[1],10001);return result(view.ledger.filter(row=>row.projectId===args[0]).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,args[1]));
 }
 if(sql.startsWith('SELECT id,name,active FROM public."Worker"'))return result(view.workers.filter(worker=>worker.projectId===args[0]&&args[1].includes(worker.id)));
 if(sql.includes("action='field.operation.recorded'"))return result(view.receipts.filter(audit=>audit.organizationId==='company-a'&&audit.entityType==='Project'&&audit.entityId===args[0]&&args[1].includes(audit.metadata.outcome.event.id)&&['ATTENDANCE','REVIEW_ATTENDANCE'].includes(audit.metadata.command)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,args[2]));
 return null;
}
export function reportFixture(){
 const state=makeState(),queries=[];
 const client={release(){},async query(sql,args=[]){
  queries.push({sql,args:clone(args)});assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY|TRUNCATE)\b/i,'Report must never mutate business state');
  const value=memorySelect(state,sql,args);assert.ok(value,'Unexpected in-memory SQL: '+sql);if(sql.includes('FROM public."AttendanceEntry"')&&state.afterLedger){const callback=state.afterLedger;state.afterLedger=null;callback();}return value;
 }};
 const fixture={state,queries,client,add(rows,{name='Persona sintética',active=true,audited=true}={}){state.ledger.push(...rows);for(const row of rows)if(!state.workers.some(worker=>worker.id===row.workerId&&worker.projectId===row.projectId))state.workers.push({id:row.workerId,projectId:row.projectId,name,active});if(audited)state.receipts.push(...rows.map(row=>receipt(row)));return rows;},read(selected=period){return readFieldHoursReport(client,{project:state.project,scope:state.scope,period:clone(selected)});}};
 return fixture;
}
export function canonicalFixture({role='ADMIN',linked=false,kyc='APPROVED',channel=false,organizationRole=role==='ADMIN'?'org:admin':'org:member'}={}){
 const f=reportFixture(),session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Hours',organizationId:'org_Hours',organizationRole},member={actorId:'actor-hours',membershipId:'member-hours',organizationId:'company-a',organizationName:'Empresa sintética',clerkUserId:session.userId,clerkRole:organizationRole,role};
 const images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'b'.repeat(64),bytes:32,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'c'.repeat(64),bytes:32,contentType:'image/png'}];
 const own={id:'worker-own',projectId:f.state.project.id,name:'Responsable sintético',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:true,report:true},kyc:{version:1,status:kyc,submissionId:'kyc-own',contentHash:digest(images.map(image=>[image.kind,image.sha256,image.bytes,image.contentType])),images,review:{actorId:'other-reviewer',decision:'APPROVED',recordedAt:'2026-10-01T00:00:00.000Z'}}}}};
 if(linked)f.state.ownWorkers.push(own);
 let snapshot=null,released=0,connections=0;
 const client={release(){released++;},async query(sql,args=[]){
  f.queries.push({sql,args:clone(args)});assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|COPY|TRUNCATE)\b/i,'Canonical report must remain read-only');
  if(sql.startsWith('BEGIN ')){assert.equal(sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');snapshot=clone({...f.state,afterLedger:null});return result([]);}
  if(sql.startsWith('SET LOCAL ')||sql==='ROLLBACK'){if(sql==='ROLLBACK')snapshot=null;return result([]);}
  assert.notEqual(sql,'COMMIT','Read-only operation must roll back its snapshot');
  const view=snapshot||f.state;
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"'))return result(view.memberActive&&args[0]==='user_Hours'&&args[1]==='org_Hours'&&args[2]===member.clerkRole?[{...member,officeReviewOnly:view.officeReviewOnly}]:[]);
  if(sql.includes('FROM public."Worker" w')&&sql.includes('JOIN public."Project"'))return result(view.ownWorkers.filter(worker=>worker.metadata.participant.clerkUserId===args[1]).slice(0,1));
  if(sql.includes('FROM public."Worker"')&&sql.includes("metadata->'participant'->>'clerkUserId'"))return result(view.ownWorkers.filter(worker=>worker.projectId===args[0]&&worker.metadata.participant.clerkUserId===args[1]));
  if(sql.includes('FROM public."ProjectMembership"'))return result(view.assignmentActive&&args[0]===view.project.id&&args[1]===member.membershipId?[{id:'assignment-hours'}]:[]);
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'INVITATION_ACCEPTED'"))return result(view.origin?[{id:'participant-origin'}]:[]);
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'REVIEW_KYC'"))return result(view.kycReview?[{id:'independent-review'}]:[]);
  if(sql.includes('FROM public."AuditLog"')&&sql.includes("'KYC_SUBMITTED'"))return result(view.kycSubmission?[{id:'own-submission',metadata:{contentHash:own.metadata.participant.kyc.contentHash}}]:[]);
  if(sql.includes('FROM public."Project"')&&!sql.includes('FROM public."AuditLog"'))return result(view.projectActive&&args[0]===view.project.id&&args[1]===member.organizationId?[view.project]:[]);
  const value=memorySelect(view,sql,args);assert.ok(value,'Unexpected canonical fixture SQL: '+sql);
  if(sql.includes('FROM public."AttendanceEntry"')&&f.state.afterLedger){const callback=f.state.afterLedger;f.state.afterLedger=null;callback();}return value;
 }};
 const realWorkspace=createWorkspaceStore({connect:async()=>{connections++;return client;}}),workspace=channel?{projectOperation:(s,c,w,callback,...rest)=>realWorkspace.projectOperation(s,c,w,(sqlClient,current,...args)=>callback(sqlClient,{...current,channelProof:{provider:'synthetic-signed-channel'}},...args),...rest)}:realWorkspace;
 const operations=createFieldOperations({workspace}),context={projectId:f.state.project.id,scope:scopeStamp(session,member),period:clone(period)};
 return {...f,client,session,member,own,workspace:realWorkspace,operations,context,read(){return operations.hoursReport(session,context);},connections:()=>connections,released:()=>released};
}
export function csvRows(csv){
 // Independent RFC4180 reader used for business assertions, not encoder calls.
 const text=csv.replace(/^\uFEFF/,''),records=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field='';}
  else if(c==='\n'&&!quoted){row.push(field.endsWith('\r')?field.slice(0,-1):field);records.push(row);row=[];field='';}
  else field+=c;
 }
 assert.equal(quoted,false);assert.equal(field,'');assert.deepEqual(row,[]);
 const [header,...values]=records;for(const record of values)assert.equal(record.length,header.length);
 return values.map(record=>Object.fromEntries(header.map((key,index)=>[key,record[index]])));
}
export const ledgerReads=f=>f.queries.filter(query=>query.sql.includes('FROM public."AttendanceEntry"')).length;
export function queryFor(f,options={}){return new URLSearchParams({projectId:f.state.project.id,scope:f.context?.scope||f.state.scope,hoursFrom:period.fromDate,hoursUntil:period.untilDate,hoursTimeZone:period.timeZone,hoursFormat:'json',...options});}