import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';

const context={projectId:'project-a',scope:'a'.repeat(64)},at='2026-10-01T12:00:00.000000';
function fixture({current='b',role='AUDITOR',author='a'}={}){
 const session={userId:'user-'+current},member={actorId:'actor-'+current,organizationId:'organization-a',role},p={version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:true,report:true},kyc:{version:1,status:'APPROVED',submissionId:'submission-a',contentHash:'a'.repeat(64),images:[{},{}],review:{actorId:'reviewer',decision:'APPROVED',recordedAt:'2026-10-01T12:00:00.000Z'}}};
 const worker={id:'worker-shared',name:'Synthetic worker',active:true,metadata:{participant:p}},project={id:context.projectId,metadata:{}},queries=[];
 const event={id:'attendance-a',workerId:worker.id,metadata:{fieldOperations:{version:1,recordedBy:'actor-'+author,eventType:'CHECK_OUT',shiftId:'shift-a'}},recordedAt:at};
 const evidence={id:'evidence-a',title:'Private original evidence',description:'Private original caption',revision:at,metadata:{fieldOperations:{version:1,kind:'EVIDENCE',workerId:worker.id,recordedBy:'actor-'+author,capturedAt:'2026-10-01T12:00:00.000Z',media:{kind:'image',contentType:'image/png',bytes:20,sha256:'b'.repeat(64)},review:null}}};
 const proposal={id:'proposal-a',proposedByWorkerId:worker.id,summary:'Private original proposal',status:'PENDING',action:{fieldOperationsVersion:1,submittedBy:'actor-'+author,reason:'Private original reason',quantity:'2.5999',baseline:'10.0000',unit:'M2',evidenceIds:[evidence.id]},expiresAt:new Date('2099-01-01'),revision:at};
 const reports=['ISSUE','MATERIAL_REQUEST'].map(type=>({id:type.toLowerCase()+'-a',title:'Private '+type,description:'Private original report',metadata:{siteRegister:{version:1,type,state:'OPEN',workerId:worker.id,submittedBy:'actor-'+author}},revision:at,createdAt:at}));
 const visibility=(sql,args,row,kind)=>{
  const reviewer=kind==='ATTENDANCE'?args[2]===true:args[1]===true,ids=kind==='ATTENDANCE'?args[1]:args[2],id=kind==='ATTENDANCE'?row.workerId:kind==='PROGRESS'?row.proposedByWorkerId:kind==='REPORT'?row.metadata.siteRegister.workerId:row.metadata.fieldOperations.workerId;
  const original=kind==='PROGRESS'?row.action.submittedBy:kind==='REPORT'?row.metadata.siteRegister.submittedBy:row.metadata.fieldOperations.recordedBy;
  const predicate=sql.match(/(?:metadata->'(?:fieldOperations|siteRegister)'|action)->>'(?:recordedBy|submittedBy)'=\$(\d+)/);
  return reviewer||ids?.includes(id)&&(!predicate||original===args[Number(predicate[1])-1]);
 };
 const client={async query(sql,args=[]){queries.push({sql,args});assert.match(sql,/^SELECT /,'History reads cannot write');
  if(sql.includes('FROM public."Worker"'))return {rows:worker.active&&p.status==='ACTIVE'&&p.kyc.status==='APPROVED'&&(!sql.includes("->>'clerkUserId'=$2")||p.clerkUserId===args[1])?[worker]:[]};
  if(sql.includes('FROM public."AuditLog"'))return {rows:sql.includes("'REVIEW_KYC'")?[{metadata:{decision:'APPROVED'}}]:sql.includes("'KYC_SUBMITTED'")?[{metadata:{contentHash:p.kyc.contentHash}}]:[]};
  if(sql.includes('FROM public."Project"'))return {rows:[{revision:at}]};
  if(sql.includes('FROM public."AttendanceEntry" a JOIN'))return {rows:[]};
  if(sql.includes('FROM public."AttendanceEntry"'))return {rows:visibility(sql,args,event,'ATTENDANCE')?[event]:[]};
  if(sql.includes("'materialInventory'"))return {rows:[]};
  const kind=sql.includes('public."OperationalProposal"')?'PROGRESS':sql.includes("'siteRegister'")?'REPORT':'EVIDENCE',all=kind==='PROGRESS'?[proposal]:kind==='REPORT'?reports:[evidence],visible=all.filter(row=>visibility(sql,args,row,kind));
  if(sql.startsWith('SELECT count(*)'))return {rows:[{total:visible.length}]};
  if(sql.startsWith('SELECT id FROM'))return {rows:visible.filter(row=>row.id===args.at(-1)).map(row=>({id:row.id}))};
  return {rows:visible};
 }};
 const operations=createFieldOperations({workspace:{projectOperation:async(_session,input,writable,callback)=>{assert.equal(writable,false);assert.equal(input.projectId,context.projectId);return callback(client,member,context.scope,project);}}});
 return {operations,session,member,worker,event,evidence,proposal,reports,queries,read:()=>operations.read(session,context),page:(section,extra={})=>operations.reviewPage(session,{...context,reviewSection:section,reviewFilter:'ALL',...extra})};
}

test('same-worker reassignment hides original attendance, evidence, proposals, issues and material requests from all own feed projections',async()=>{
 const f=fixture(),page=await f.read();for(const key of ['attendance','evidence','proposals','incidents','materialRequests'])assert.deepEqual(page[key],[],key);assert.equal(page.selfWorkers[0].id,f.worker.id);
});
for(const section of ['EVIDENCE','PROGRESS']){
 test('same-worker '+section+' review page hides original rows and total',async()=>{const f=fixture(),page=await f.page(section);assert.deepEqual(page.records,[]);assert.equal(page.total,0);assert.equal(page.nextCursor,null);});
 for(const key of ['afterReview','reviewId'])test('same-worker '+section+' '+key+' cannot reference another original author',async()=>{const f=fixture(),page=await f.page(section),id=section==='EVIDENCE'?f.evidence.id:f.proposal.id;await assert.rejects(f.page(section,{[key]:id,reviewAccessStamp:page.reviewAccessStamp}),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});});
}
test('original author retains exact quantities and human outcomes, loses all own visibility when unbound and regains it when restored',async()=>{
 const f=fixture({current:'a'});assert.equal((await f.read()).attendance.length,1);assert.equal((await f.page('PROGRESS')).records[0].quantity,'2.5999');
 f.worker.metadata.participant.clerkUserId='user-b';const lost=await f.read();for(const key of ['attendance','evidence','proposals','incidents','materialRequests'])assert.deepEqual(lost[key],[]);
 f.worker.metadata.participant.clerkUserId='user-a';assert.equal((await f.page('EVIDENCE')).records[0].status,'PENDING');assert.equal((await f.read()).materialRequests.length,1);
});
for(const role of ['ADMIN','DIRECTOR','SITE_MANAGER'])test(role+' preserves canonical review visibility after worker reassignment',async()=>{const f=fixture({role}),page=await f.read();for(const key of ['attendance','evidence','proposals','incidents','materialRequests'])assert.equal(page[key].length,1,key);for(const section of ['EVIDENCE','PROGRESS'])assert.equal((await f.page(section)).total,1);});
test('unknown original authors fail closed for own reads',async()=>{const f=fixture({current:'a'});delete f.event.metadata.fieldOperations.recordedBy;delete f.evidence.metadata.fieldOperations.recordedBy;delete f.proposal.action.submittedBy;for(const row of f.reports)delete row.metadata.siteRegister.submittedBy;const page=await f.read();for(const key of ['attendance','evidence','proposals','incidents','materialRequests'])assert.deepEqual(page[key],[]);});
test('revoked current attendance/report permission hides corresponding own feed and review page',async()=>{const f=fixture({current:'a'});f.worker.metadata.participant.permissions={attendance:false,report:false};const page=await f.read();for(const key of ['attendance','evidence','proposals','incidents','materialRequests'])assert.deepEqual(page[key],[]);assert.equal((await f.page('EVIDENCE')).total,0);assert.equal((await f.page('PROGRESS')).total,0);});
