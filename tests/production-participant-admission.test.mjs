import test from 'node:test';
import assert from 'node:assert/strict';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createWorkspaceStore,participantIdentityOperation} from '../src/lib/workspace-store.mjs';
import {scopeStamp,digest} from '../src/lib/workspace-policy.mjs';

function fixture({role='AUDITOR',state='NOT_SUBMITTED',linked=true,review=true,origin=false,assigned=null,projectCount=2}={}){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Admission',organizationId:'org_Admission',organizationRole:role==='ADMIN'?'org:admin':'org:member'};
 const member={actorId:'admission-actor',membershipId:'admission-member',organizationId:'admission-company',organizationName:'Synthetic company',role,clerkUserId:session.userId,clerkRole:session.organizationRole};
 const projectIds=projectCount===2?['project-a','project-b']:Array.from({length:projectCount},(_,i)=>'project-'+String(i+1).padStart(3,'0'));assigned??=projectIds;
 const projects=projectIds.map(id=>({id,name:'Synthetic '+id,status:'ACTIVE'}));
 const images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:32,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:32,contentType:'image/png'}];
 const workers=linked?projects.map(project=>({id:'worker-'+project.id,name:'Synthetic own person',revision:'2026-10-01T12:00:00.000000',projectId:project.id,active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,kyc:{version:1,status:state,submissionId:'submission-'+project.id,contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images,review:{actorId:'independent-reviewer',decision:'APPROVED',recordedAt:'2026-10-07T12:00:00.000Z'}}}}})):[];
 const queries=[],taskReads=[],controls={beforeProjectLock:null};
 const aggregate=id=>({...projects.find(p=>p.id===id),totalTasks:1,completedTasks:0,inProgressTasks:0,blockedTasks:0,unscheduledTasks:1,nextEndsOn:null});
 const workspace=createWorkspaceStore({connect:async()=>({release(){},async query(sql,params=[]){queries.push({sql,params});if(sql.includes('FOR UPDATE OF p')&&controls.beforeProjectLock){const hook=controls.beforeProjectLock;controls.beforeProjectLock=null;hook();}
  if(sql.includes('FROM public."PlatformUser"'))return {rows:[member]};
  if(sql.includes('FROM public."Worker"')){
   if(sql.includes('JOIN public."Project"'))return {rows:workers.filter(w=>w.metadata.participant.clerkUserId===member.clerkUserId).slice(0,1)};
   if(sql.includes('WHERE id=$1'))return {rows:workers.filter(w=>w.id===params[0]&&w.projectId===params[1])};
   if(sql.includes("'processing'->>"))return {rows:[]};
   return {rows:workers.filter(w=>w.projectId===params[0] && (typeof params[1]==='boolean'?params[1]||w.metadata.participant.clerkUserId===params[2]:w.metadata.participant.clerkUserId===params[1]))};
  }
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("'INVITATION_ACCEPTED'"))return {rows:origin?[{id:'origin-proof'}]:[]};
   if(sql.includes("'REVIEW_KYC'"))return {rows:review?[{id:'review-proof',metadata:{}}]:[]};
   if(sql.includes("'KYC_SUBMITTED'")){const row=workers.find(w=>w.id===params[2]);return {rows:row?[{id:'submission-proof',metadata:{version:1,kind:'KYC_SUBMITTED',projectId:row.projectId,submissionId:row.metadata.participant.kyc.submissionId,contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType]))}}]:[]};}
   return {rows:[]};
  }
  if(sql.includes('WITH authorized AS')){taskReads.push(...projects.map(p=>p.id));return {rows:projects.map(p=>aggregate(p.id))};}
  if(sql.includes('CROSS JOIN LATERAL')){const ids=params.find(Array.isArray);assert.ok(ids,'Aggregate must bind only admitted project ids');taskReads.push(...ids);return {rows:ids.map(aggregate)};}
  if(sql.includes('public."ProjectMembership"')&&!sql.includes('FROM public."Project"'))return {rows:assigned.includes(sql.includes('FROM public."TenantMembership"')?params[3]:params[0])?[{id:'assignment'}]:[]};
  if(sql.includes('FROM public."Task"')){taskReads.push(params[0]);return sql.includes('count(*)')?{rows:[{total:1}]}:{rows:[{id:'task-'+params[0],title:'Synthetic private task',status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision:'2026-10-01T12:00:00.000000'}]};}
  if(sql.includes('FROM public."Project"'))return {rows:sql.includes('WHERE id=$1')||sql.includes('WHERE p.id=$1')?projects.filter(p=>p.id===params[0]):projects.filter(p=>(params[1]||assigned.includes(p.id))&&(!params[3]||p.id>params[3])).slice(0,51)};
  return {rows:[]};
 }})});
 const participants=createParticipantStore({workspace,upload:async()=>{throw Error('Unexpected private upload');},get:async()=>{throw Error('Unexpected private download');},environment:{}});
 return {session,member,workspace,participants,workers,queries,taskReads,controls,context:{projectId:projectIds[0],scope:scopeStamp(session,member)}};
}
for(const state of ['NOT_SUBMITTED','PENDING_REVIEW','REJECTED'])test(state+' cannot read tasks or enter an operational callback',async()=>{
 const f=fixture({state});await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 let callback=false;await assert.rejects(f.workspace.projectOperation(f.session,f.context,false,()=>{callback=true;}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(callback,false);assert.deepEqual(f.taskReads,[]);
});
for(const mutate of [w=>w.active=false,w=>w.metadata.participant.status='REVOKED',w=>w.metadata.participant.version=2,w=>w.metadata.participant.kyc.review.actorId='admission-actor',w=>w.metadata.participant.kyc.contentHash='0'.repeat(64)])test('invalid or revoked own participation cannot become an office bypass '+String(mutate),async()=>{
 const f=fixture({state:'APPROVED'});mutate(f.workers[0]);await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.taskReads,[]);
});
test('metadata approval without the independent review receipt remains blocked',async()=>{const f=fixture({state:'APPROVED',review:false});await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.taskReads,[]);});
test('independent approval and complete submission receipt admit the existing assignment',async()=>{const f=fixture({state:'APPROVED'});assert.equal((await f.workspace.read(f.session,f.context)).tasks.length,1);assert.equal(f.member.role,'AUDITOR');});
test('a linked pending DIRECTOR cannot use office role to bypass admission',async()=>{const f=fixture({role:'DIRECTOR'});await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.taskReads,[]);});
for(const role of ['DIRECTOR','AUDITOR','SITE_MANAGER'])test('legitimate office '+role+' without participant binding retains access',async()=>{const f=fixture({role,linked:false});assert.equal((await f.workspace.read(f.session,f.context)).tasks.length,1);});
test('canonical ADMIN org:admin preserves bootstrap and review even with pending own KYC',async()=>{const f=fixture({role:'ADMIN'});assert.equal((await f.workspace.read(f.session,f.context)).tasks.length,1);});
test('one approved work cannot admit another and portfolio never reads its tasks',async()=>{
 const f=fixture({state:'APPROVED'});f.workers[1].metadata.participant.kyc.status='PENDING_REVIEW';
 await assert.rejects(f.workspace.read(f.session,{...f.context,projectId:'project-b'}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 const result=await f.workspace.overview(f.session,{scope:f.context.scope});assert.deepEqual(result.projects.map(p=>p.id),['project-a']);assert.deepEqual(f.taskReads,['project-a']);
});
test('all pending works yield no portfolio aggregate query',async()=>{const f=fixture();assert.deepEqual((await f.workspace.overview(f.session,{scope:f.context.scope})).projects,[]);assert.deepEqual(f.taskReads,[]);});

test('a participant DIRECTOR cannot navigate an unassigned work using portfolio privilege',async()=>{
 const f=fixture({role:'DIRECTOR',state:'APPROVED',assigned:['project-a']});
 assert.deepEqual((await f.workspace.list(f.session)).projects.map(p=>p.id),['project-a']);
 await assert.rejects(f.workspace.read(f.session,{...f.context,projectId:'project-b'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 assert.deepEqual((await f.workspace.overview(f.session,{scope:f.context.scope})).projects.map(p=>p.id),['project-a']);
 assert.ok(!f.taskReads.includes('project-b'));
});
test('a linked DIRECTOR cannot operate an assigned work lacking their own participant',async()=>{
 const f=fixture({role:'DIRECTOR',state:'APPROVED'});f.workers.splice(1,1);
 await assert.rejects(f.workspace.read(f.session,{...f.context,projectId:'project-b'}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.taskReads,[]);
});
test('durable participant origin cannot become office access after its Worker disappears',async()=>{
 const f=fixture({role:'DIRECTOR',linked:false,origin:true});await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.taskReads,[]);
});
test('the identity exception cannot be constructed by a serialized client flag or another Symbol',async()=>{
 const f=fixture();for(const flag of [true,{identityOnly:true},Symbol('participant-own-identity')])await assert.rejects(f.workspace.projectOperation(f.session,f.context,false,()=>{},undefined,flag),TypeError);assert.deepEqual(f.taskReads,[]);
});
test('pending DIRECTOR identity read is own-only with no management or intake projection',async()=>{
 const f=fixture({role:'DIRECTOR'});f.workers.push({...structuredClone(f.workers[0]),id:'foreign-person',metadata:{participant:{...f.workers[0].metadata.participant,clerkUserId:'user_Foreign'}}});
 const own=await f.participants.read(f.session,f.context);assert.deepEqual(own.records.map(p=>p.id),['worker-project-a']);assert.equal(own.canManage,false);assert.equal(own.canInvite,false);assert.equal(own.canManageOfficeRoles,false);assert.deepEqual(own.existingAccounts,[]);assert.equal(own.employeeIntake,null);assert.equal(own.records[0].canSendOnboardingWhatsapp,false);assert.deepEqual(f.taskReads,[]);
 await assert.rejects(f.participants.downloadKyc(f.session,{...f.context,workerId:'foreign-person',imageId:'document-front'}),{code:'PARTICIPANT_ACCESS_REQUIRED'});
});
test('the private composition keeps canonical assignment and cannot run a public operational callback',async()=>{
 const f=fixture({assigned:[]});await assert.rejects(participantIdentityOperation(f.workspace,f.session,f.context,false,()=>assert.fail('No assignment callback')),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
});

test('portfolio skips an entire pending page before aggregating 51 admitted works and preserves its public cursor',async()=>{
 const f=fixture({state:'APPROVED',projectCount:103});for(const worker of f.workers.slice(0,52))worker.metadata.participant.kyc.status='PENDING_REVIEW';
 const first=await f.workspace.overview(f.session,{scope:f.context.scope});assert.equal(first.projects.length,50);assert.equal(first.projects[0].id,'project-053');assert.equal(first.nextCursor,'project-102');assert.deepEqual(f.taskReads,f.workers.slice(52).map(w=>w.projectId));
 const second=await f.workspace.overview(f.session,{scope:f.context.scope,afterProject:first.nextCursor});assert.deepEqual(second.projects.map(p=>p.id),['project-103']);assert.equal(second.nextCursor,null);
});
test('all pending candidates over multiple pages still produce zero Task reads',async()=>{
 const f=fixture({projectCount:103});assert.deepEqual((await f.workspace.overview(f.session,{scope:f.context.scope})).projects,[]);assert.deepEqual(f.taskReads,[]);
});
test('a cursor whose participant approval was revoked is refused before aggregates',async()=>{
 const f=fixture();await assert.rejects(f.workspace.overview(f.session,{scope:f.context.scope,afterProject:'project-a'}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.deepEqual(f.taskReads,[]);
});
test('writable operational callbacks retain canonical admission after the project lock',async()=>{
 const f=fixture({role:'DIRECTOR',state:'APPROVED'});let ran=false;
 await f.workspace.projectOperation(f.session,f.context,true,()=>{ran=true;});assert.equal(ran,true);
 const workerLock=f.queries.findIndex(q=>q.sql.includes('FROM public."Worker"')&&q.sql.includes('FOR SHARE'));
 const projectLock=f.queries.findIndex(q=>q.sql.includes('FOR UPDATE OF p'));assert.ok(projectLock>=0&&workerLock>projectLock);
});

for(const method of ['projectOperation','integrationProject'])test(method+' rechecks a new cross-work participant binding after Project lock',async()=>{
 const f=fixture({role:'DIRECTOR',linked:false,assigned:[]});
 f.controls.beforeProjectLock=()=>f.workers.push({id:'new-worker-b',projectId:'project-b',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:f.session.userId,kyc:{status:'NOT_SUBMITTED'}}}});
 let called=false;await assert.rejects(f.workspace[method](f.session,f.context,true,()=>{called=true;}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(called,false);assert.deepEqual(f.taskReads,[]);
});
test('ADMIN role with canonical org:member is not the protected administrator exemption',async()=>{
 const f=fixture({role:'ADMIN'});f.session.organizationRole='org:member';f.member.clerkRole='org:member';f.context.scope=scopeStamp(f.session,f.member);
 await assert.rejects(f.workspace.read(f.session,f.context),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 const own=await f.participants.read(f.session,f.context);assert.equal(own.canManage,false);assert.equal(own.canInvite,false);assert.equal(own.canManageOfficeRoles,false);assert.deepEqual(own.existingAccounts,[]);assert.equal(own.employeeIntake,null);
});
test('pending participant gate runs before an internal recipient prelock callback',async()=>{
 const f=fixture({role:'DIRECTOR'});let prelocked=false;await assert.rejects(f.workspace.integrationProject(f.session,f.context,true,()=>assert.fail('No operation'),()=>{prelocked=true;}),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(prelocked,false);
});
