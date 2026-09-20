import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAssignmentOverlap, calendarWindow, assignmentReviewMatches } from '../src/lib/assignment-overlap-policy.js';
import { normalizeAssignmentPlan } from '../src/lib/task-assignment-policy.js';
import { reviewTaskAssignment, planReviewedTaskAssignment } from '../src/lib/assignment-overlap-review.js';
import { database, scope, input } from './helpers/assignment-overlap-fixture.js';
const normalized = normalizeAssignmentPlan(input);
const peer = (extra={}) => ({ id:'peer-a',projectId:scope.projectId,taskId:'task-b',workerId:'worker-a',teamId:null,status:'PLANNED',revision:0,startsAt:new Date('2026-09-23'),endsAt:new Date('2026-09-28'),taskTitle:'Revoque',ownerLabel:'Persona de ensayo',...extra });
const membership = (teamId,workerId='worker-a',extra={}) => ({id:'member-'+teamId,projectId:scope.projectId,teamId,workerId,startsAt:new Date('2026-09-01'),endsAt:null,revision:0,...extra});
const inspect = (db,raw=input) => reviewTaskAssignment(db.prisma,{scope,input:raw});
const request = (snapshot,extra={}) => ({scope,actorId:'manager-a',operationKey:'overlap-request-0001',input:{...input,review:{version:snapshot.version,acknowledged:true,reason:snapshot.warnings?'Se coordinan los frentes y se verifican las horas.':''}},...extra});
test('review reads real-domain rows and keeps database unchanged',async()=>{
  const db=database(),before=structuredClone(db.state);const result=await inspect(db);
  assert.equal(result.warnings,false);assert.equal(result.totalFindings,0);assert.deepEqual(db.state,before);assert.match(result.version,/^[a-f0-9]{64}$/);
  assert.equal(assignmentReviewMatches(result,normalized,scope),true);
});
test('same worker on another activity produces a direct calendar overlap',()=>{
  const data=analyzeAssignmentOverlap(normalized,[peer()],[]);assert.equal(data.summary.overlaps,1);assert.equal(data.findings[0].kind,'DIRECT');
  assert.equal(data.findings[0].overlapFrom,'2026-09-23');assert.equal(data.findings[0].overlapTo,'2026-09-25');
});
for(const [start,end,count] of [['2026-09-25','2026-09-25',1],['2026-09-26','2026-09-26',0],['2026-09-20','2026-09-21',1],['2026-09-19','2026-09-20',0]])test('inclusive day intersection '+start+' / '+end,()=>{
  assert.equal(analyzeAssignmentOverlap(normalized,[peer({startsAt:new Date(start),endsAt:new Date(end)})],[]).summary.overlaps,count);
});
test('other people and terminal records do not become scheduling conflicts',()=>{
  const result=analyzeAssignmentOverlap(normalized,[peer({workerId:'worker-b'}),peer({id:'ended',status:'ENDED'}),peer({id:'cancelled',status:'CANCELLED'})],[]);
  assert.equal(result.findings.length,0);
});
test('a worker assigned through a crew is detected by its time-bound membership',()=>{
  const crewPeer=peer({workerId:null,teamId:'team-b'}),members=[membership('team-b')];
  assert.equal(analyzeAssignmentOverlap(normalized,[crewPeer],members).findings[0].kind,'SHARED_MEMBER');
  members[0].endsAt=new Date('2026-09-21');assert.equal(analyzeAssignmentOverlap(normalized,[crewPeer],members).findings.length,0);
});
test('two crews share a person only when both memberships overlap the assignment days',()=>{
  const plan={...normalized,workerId:null,teamId:'team-a'},other=peer({workerId:null,teamId:'team-b'});
  const members=[membership('team-a'),membership('team-b')];let result=analyzeAssignmentOverlap(plan,[other],members);
  assert.equal(result.findings[0].sharedPeople,1);assert.equal(result.findings[0].kind,'SHARED_MEMBER');
  members[0].endsAt=new Date('2026-09-23');members[1].startsAt=new Date('2026-09-23');result=analyzeAssignmentOverlap(plan,[other],members);assert.equal(result.findings.length,0);
});
test('repeated overlapping membership episodes do not multiply the same conflict or person',()=>{
  const plan={...normalized,workerId:null,teamId:'team-a'},other=peer({workerId:null,teamId:'team-b'});
  const members=[membership('team-a'),membership('team-a','worker-a',{id:'second'}),membership('team-b')];
  const result=analyzeAssignmentOverlap(plan,[other],members);assert.equal(result.findings.length,1);assert.equal(result.findings[0].sharedPeople,1);
});
test('incomplete proposal and peer dates remain uncertainty, not zero availability',()=>{
  assert.equal(analyzeAssignmentOverlap({...normalized,startsAt:null,endsAt:null},[],[]).warnings,true);
  const result=analyzeAssignmentOverlap(normalized,[peer({endsAt:null})],[]);assert.equal(result.summary.incomplete,1);assert.equal(result.summary.overlaps,0);
});
test('a crew without members in the reviewed period is explicitly unverified',()=>{
  const plan={...normalized,workerId:null,teamId:'team-a'};
  assert.equal(analyzeAssignmentOverlap(plan,[],[]).summary.rosterUnverified,true);
  assert.equal(analyzeAssignmentOverlap(plan,[],[membership('team-a')]).warnings,false);
});
test('invalid dates and excessive source data cannot turn into a successful empty review',()=>{
  assert.throws(()=>calendarWindow({startsAt:'bad',endsAt:null}));assert.throws(()=>calendarWindow({startsAt:'2026-09-25',endsAt:'2026-09-24'}));
  assert.throws(()=>analyzeAssignmentOverlap(normalized,Array.from({length:1001},()=>peer()),[]),{code:'ASSIGNMENT_REVIEW_TOO_LARGE'});
  assert.throws(()=>analyzeAssignmentOverlap(normalized,[],Array(3001)),{code:'ASSIGNMENT_REVIEW_TOO_LARGE'});
});
test('confirmed review and coordination reason are stored atomically with the assignment',async()=>{
  const db=database();db.state.rows=[peer()];const reviewed=await inspect(db);const before=structuredClone(db.state.task);
  const result=await planReviewedTaskAssignment(db.prisma,request(reviewed));assert.equal(result.assignment.status,'PLANNED');assert.equal(db.state.rows.length,2);
  assert.equal(db.state.audits[0].metadata.reviewSummary.overlaps,1);assert.equal(db.state.audits[0].metadata.reviewVersion,reviewed.version);
  assert.equal(db.state.audits[0].metadata.coordinationReason,'Se coordinan los frentes y se verifican las horas.');assert.deepEqual(db.state.task,before);
});
test('a new assignment after review blocks creation until rereview',async()=>{
  const db=database(),reviewed=await inspect(db);db.state.rows.push(peer());
  await assert.rejects(planReviewedTaskAssignment(db.prisma,request(reviewed)),{code:'ASSIGNMENT_REVIEW_CHANGED'});assert.equal(db.state.audits.length,0);assert.equal(db.state.rows.length,1);
});
test('a changed crew membership invalidates the reviewed version',async()=>{
  const db=database();db.state.rows=[peer({workerId:null,teamId:'team-b'})];db.state.members=[membership('team-b')];
  const reviewed=await inspect(db);db.state.members[0].endsAt=new Date('2026-09-24');db.state.members[0].revision++;
  await assert.rejects(planReviewedTaskAssignment(db.prisma,request(reviewed)),{code:'ASSIGNMENT_REVIEW_CHANGED'});assert.equal(db.state.audits.length,0);
});
test('same committed attempt remains idempotent even when the later schedule changes',async()=>{
  const db=database(),reviewed=await inspect(db),command=request(reviewed);const first=await planReviewedTaskAssignment(db.prisma,command);
  db.state.rows[0].status='ENDED';db.state.rows[0].revision=2;db.state.rows.push(peer());
  const replay=await planReviewedTaskAssignment(db.prisma,command);assert.equal(replay.replayed,true);assert.equal(replay.assignment.id,first.assignment.id);assert.equal(replay.assignment.status,'ENDED');assert.equal(db.state.audits.length,1);
});
test('warnings require a meaningful coordination explanation, but not another permission role',async()=>{
  const db=database();db.state.rows=[peer()];const reviewed=await inspect(db),command=request(reviewed);command.input.review.reason='';
  await assert.rejects(planReviewedTaskAssignment(db.prisma,command),{code:'ASSIGNMENT_REVIEW_REASON_REQUIRED'});assert.equal(db.state.audits.length,0);
});
test('old or forged payloads do not skip server review',async()=>{
  const db=database();await assert.rejects(planReviewedTaskAssignment(db.prisma,{...request({version:'a'.repeat(64),warnings:false}),input}),{code:'ASSIGNMENT_REVIEW_REQUIRED'});
  const fake=request({version:'a'.repeat(64),warnings:false});await assert.rejects(planReviewedTaskAssignment(db.prisma,fake),{code:'ASSIGNMENT_REVIEW_CHANGED'});assert.equal(db.state.rows.length,0);
});
test('review never reads another tenant or substitutes a project from request data',async()=>{
  const db=database();await assert.rejects(reviewTaskAssignment(db.prisma,{scope:{...scope,organizationId:'other'},input}),{status:404});
  await assert.rejects(reviewTaskAssignment(db.prisma,{scope,input:{...input,projectId:'other'}}));assert.equal(db.state.rows.length,0);
});
test('write-time role activity, task revision and archive guards remain effective',async()=>{
  const db=database(),reviewed=await inspect(db);db.state.owner=false;await assert.rejects(planReviewedTaskAssignment(db.prisma,request(reviewed)),{code:'ASSIGNMENT_OWNER_UNAVAILABLE'});
  db.state.owner=true;db.state.task.revision++;await assert.rejects(planReviewedTaskAssignment(db.prisma,request(reviewed)),{code:'ASSIGNMENT_TASK_CHANGED'});
  db.state.projectStatus='ARCHIVED';await assert.rejects(planReviewedTaskAssignment(db.prisma,request(reviewed)),{code:'PROJECT_READ_ONLY'});
});
test('audit failure rolls back the reviewed plan as well as its metadata',async()=>{
  const db=database(),reviewed=await inspect(db);db.state.failAudit=true;await assert.rejects(planReviewedTaskAssignment(db.prisma,request(reviewed)),/AUDIT_FAILURE/);assert.equal(db.state.rows.length,0);
});
test('same operation cannot change the accepted coordination reason',async()=>{
  const db=database();db.state.rows=[peer()];const reviewed=await inspect(db),command=request(reviewed);await planReviewedTaskAssignment(db.prisma,command);
  command.input.review.reason='Otro criterio de coordinación.';await assert.rejects(planReviewedTaskAssignment(db.prisma,command),{code:'ASSIGNMENT_ATTEMPT_CONFLICT'});
});
test('response exposes only a bounded sample while retaining the true conflict count',async()=>{
  const db=database();db.state.rows=Array.from({length:12},(_,i)=>peer({id:'peer-'+String(i).padStart(2,'0')}));
  const result=await inspect(db);assert.equal(result.totalFindings,12);assert.equal(result.findings.length,8);assert.equal(result.summary.overlaps,12);
});
test('client rejects incomplete, cross-scope, unbounded or mismatched review responses',async()=>{
  const result=await inspect(database());for(const value of [{},{...result,context:{...scope,projectId:'other'}},{...result,plan:{...normalized,taskId:'other'}},{...result,version:'wrong'},{...result,summary:{...result.summary,overlaps:-1}},{...result,warnings:true}])assert.equal(assignmentReviewMatches(value,normalized,scope),false);
});
test('many overlapping episodes are merged without multiplying conflicts',()=>{
  const plan={...normalized,workerId:null,teamId:'team-a'},members=Array.from({length:200},(_,i)=>membership(i%2?'team-a':'team-b','worker-a',{id:'m-'+i}));
  const result=analyzeAssignmentOverlap(plan,Array.from({length:100},(_,i)=>peer({id:'p-'+i,workerId:null,teamId:'team-b'})),members);assert.equal(result.summary.overlaps,100);assert.equal(result.findings[0].sharedPeople,1);
});
test('unrelated resources do not invalidate a reviewed plan or consume its sample count',async()=>{
  const db=database(),before=await inspect(db);db.state.rows.push(peer({workerId:'other-worker'}));
  const after=await inspect(db);assert.equal(after.version,before.version);assert.equal(after.totalFindings,0);
});
test('client validates all conflict dates before rendering them',async()=>{
  const db=database();db.state.rows=[peer()];const result=await inspect(db);
  for(const row of [{...result.findings[0],startsOn:123},{...result.findings[0],endsOn:'2026-02-30'},{...result.findings[0],sharedPeople:-1}])assert.equal(assignmentReviewMatches({...result,findings:[row]},normalized,scope),false);
});
