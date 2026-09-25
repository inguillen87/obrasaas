import assert from 'node:assert/strict';
import test from 'node:test';
import { database, scope, actorId, input } from './helpers/assignment-overlap-fixture.js';
import { planTaskAssignment, decideTaskAssignment } from '../src/lib/task-assignments.js';
import { getAssignmentReschedule, reviewAssignmentReschedule, commitAssignmentReschedule } from '../src/lib/assignment-reschedule.js';
import { normalizeAssignmentPlan, confirmAssignmentPlan, assignmentPlanFeedback } from '../src/lib/task-assignment-policy.js';
const command = (extra = {}) => ({ scope, actorId, operationKey: 'continuity-request-001', input, ...extra });
const proposed = { startsOn: '2026-09-26', endsOn: '2026-09-30' };
async function reviewFor(prisma, assignmentId, dates = proposed) {
  const base = { scope, assignmentId, actorId };
  const snapshot = await getAssignmentReschedule(prisma, base);
  const raw = { expectedRevision: snapshot.assignment.revision, ...dates };
  const review = await reviewAssignmentReschedule(prisma, { ...base, input: raw });
  return { ...base, input: { ...raw, reviewVersion: review.version, confirmed: true, note: 'Se coordina el siguiente frente de trabajo.' } };
}

test('lost creation response remains recoverable after the assignment is rescheduled', async () => {
  const { prisma, state } = database();
  const first = await planTaskAssignment(prisma, command());
  await commitAssignmentReschedule(prisma, await reviewFor(prisma, first.assignment.id));
  const replay = await planTaskAssignment(prisma, command());
  const confirmed = confirmAssignmentPlan(replay, normalizeAssignmentPlan(input), scope);
  assert.equal(confirmed.id, first.assignment.id);
  assert.equal(confirmed.startsAt, '2026-09-26T00:00:00.000Z');
  assert.equal(confirmed.revision, 1);
  assert.equal(state.rows.length, 1);
  assert.equal(state.audits.length, 2);
});

test('rescheduling cannot create an exact duplicate of another unfinished assignment', async () => {
  const { prisma, state } = database();
  const first = await planTaskAssignment(prisma, command());
  await planTaskAssignment(prisma, command({ operationKey: 'continuity-request-002', input: { ...input, ...proposed } }));
  await assert.rejects(reviewFor(prisma, first.assignment.id), { code: 'ASSIGNMENT_DUPLICATE' });
  assert.equal(state.rows[0].revision, 0);
  assert.equal(state.audits.length, 2);
});

for (const finalStatus of ['ACTIVE','ENDED','CANCELLED']) test('creation replay keeps the current state after reprogramming: '+finalStatus, async () => {
  const { prisma, state } = database();
  const first = await planTaskAssignment(prisma, command());
  await commitAssignmentReschedule(prisma, await reviewFor(prisma, first.assignment.id));
  await decideTaskAssignment(prisma, { scope, actorId, assignmentId:first.assignment.id, input:{expectedRevision:1,status:finalStatus==='ENDED'?'ACTIVE':finalStatus,note:'Decisión posterior confirmada.'} });
  if(finalStatus==='ENDED') await decideTaskAssignment(prisma, {scope,actorId,assignmentId:first.assignment.id,input:{expectedRevision:2,status:'ENDED',note:'Cierre posterior confirmado.'}});
  const before=structuredClone(state), replay=await planTaskAssignment(prisma,command());
  assert.equal(confirmAssignmentPlan(replay,normalizeAssignmentPlan(input),scope).status,finalStatus);
  assert.deepEqual(state,before);
});

for (const receiptChange of [{schemaVersion:2},{assignmentId:'other'},{taskId:'other'},{workerId:'other'},{teamId:'other'},{startsAt:null},{endsAt:null},{expectedTaskRevision:9}]) test('recovery rejects a mismatched creation receipt '+JSON.stringify(receiptChange),async()=>{
  const {prisma}=database();const first=await planTaskAssignment(prisma,command());
  await commitAssignmentReschedule(prisma,await reviewFor(prisma,first.assignment.id));
  const replay=await planTaskAssignment(prisma,command());
  replay.creationReceipt={...replay.creationReceipt,...receiptChange};
  assert.throws(()=>confirmAssignmentPlan(replay,normalizeAssignmentPlan(input),scope),{code:'ASSIGNMENT_UNCONFIRMED'});
});

test('changed dates without a receipt or without a later revision never clear the request',async()=>{
  const {prisma}=database();const first=await planTaskAssignment(prisma,command());
  await commitAssignmentReschedule(prisma,await reviewFor(prisma,first.assignment.id));
  const replay=await planTaskAssignment(prisma,command()),missing={...replay};delete missing.creationReceipt;
  for(const bad of [missing,{...replay,creationReceipt:null},{...replay,replayed:false},{...replay,assignment:{...replay.assignment,revision:0}},{...replay,assignment:{...replay.assignment,startsAt:'2026-09-26T10:00:00.000Z'}}])
    assert.throws(()=>confirmAssignmentPlan(bad,normalizeAssignmentPlan(input),scope),{code:'ASSIGNMENT_UNCONFIRMED'});
});

test('old exact-period responses remain compatible but malformed supplied receipts are rejected',async()=>{
  const {prisma,state}=database();const first=await planTaskAssignment(prisma,command());
  delete first.creationReceipt;assert.equal(confirmAssignmentPlan(first,normalizeAssignmentPlan(input),scope).revision,0);
  state.rows[0].revision=1;state.rows[0].status='CANCELLED';
  const replay=await planTaskAssignment(prisma,command());delete replay.creationReceipt;
  assert.equal(confirmAssignmentPlan(replay,normalizeAssignmentPlan(input),scope).status,'CANCELLED');
  assert.throws(()=>confirmAssignmentPlan({...replay,creationReceipt:{}},normalizeAssignmentPlan(input),scope),{code:'ASSIGNMENT_UNCONFIRMED'});
});

for(const corruption of [{source:'another-system'},{taskId:'other'},{workerId:'other'},{teamId:'other'},{taskRevision:4},{status:'ACTIVE'}])test('stored receipt inconsistency fails closed '+JSON.stringify(corruption),async()=>{
  const {prisma,state}=database();await planTaskAssignment(prisma,command());
  Object.assign(state.audits[0].metadata,corruption);const before=structuredClone(state);
  await assert.rejects(planTaskAssignment(prisma,command()),{code:'ASSIGNMENT_ATTEMPT_CONFLICT'});assert.deepEqual(state,before);
});

for(const corruption of [{taskId:'other'},{workerId:'other'},{teamId:'other'},{startsAt:new Date('2026-09-26')},{revision:-1}])test('changed immutable identity or unversioned dates cannot be accepted '+JSON.stringify(corruption),async()=>{
  const {prisma,state}=database();await planTaskAssignment(prisma,command());Object.assign(state.rows[0],corruption);
  await assert.rejects(planTaskAssignment(prisma,command()),{code:'ASSIGNMENT_ATTEMPT_CONFLICT'});
});

for(const status of ['PLANNED','ACTIVE','ENDED','CANCELLED'])test('exact duplicate policy respects pending versus historical state '+status,async()=>{
  const {prisma,state}=database();const first=await planTaskAssignment(prisma,command());
  await planTaskAssignment(prisma,command({operationKey:'continuity-request-002',input:{...input,...proposed}}));
  state.rows[1].status=status;
  if(['PLANNED','ACTIVE'].includes(status))await assert.rejects(reviewFor(prisma,first.assignment.id),{code:'ASSIGNMENT_DUPLICATE'});
  else {const saved=await commitAssignmentReschedule(prisma,await reviewFor(prisma,first.assignment.id));assert.equal(saved.assignment.revision,1);}
});

test('an exact duplicate created after review is rejected at commit with no side effect',async()=>{
  const {prisma,state}=database();const first=await planTaskAssignment(prisma,command());const reviewed=await reviewFor(prisma,first.assignment.id);
  await planTaskAssignment(prisma,command({operationKey:'continuity-request-002',input:{...input,...proposed}}));
  const before=structuredClone(state);await assert.rejects(commitAssignmentReschedule(prisma,reviewed),{code:'ASSIGNMENT_DUPLICATE'});assert.deepEqual(state,before);
});

test('overlap on another task remains a coordination warning, not an exact duplicate',async()=>{
  const {prisma,state}=database();const first=await planTaskAssignment(prisma,command());
  state.rows.push({...state.rows[0],id:'peer-a',taskId:'task-b',startsAt:new Date('2026-09-26'),endsAt:new Date('2026-09-30')});
  const saved=await commitAssignmentReschedule(prisma,await reviewFor(prisma,first.assignment.id));
  assert.equal(saved.assignment.revision,1);assert.equal(state.rows.length,2);assert.equal(state.task.revision,3);
});

test('matching dates in another worksite do not block or enter this scope',async()=>{
  const {prisma,state}=database();const first=await planTaskAssignment(prisma,command());
  state.rows.push({...state.rows[0],id:'peer-b',projectId:'project-b',startsAt:new Date('2026-09-26'),endsAt:new Date('2026-09-30')});
  const saved=await commitAssignmentReschedule(prisma,await reviewFor(prisma,first.assignment.id));assert.equal(saved.assignment.revision,1);
  assert.equal(state.rows[1].revision,0);
});

test('nullable periods and team responsibilities use the same duplicate rule',async()=>{
  for(const kind of ['WORKER','TEAM']){
    const {prisma,state}=database(),request={...input,ownerKind:kind,ownerId:kind==='TEAM'?'team-a':'worker-a'};
    const first=await planTaskAssignment(prisma,command({input:request}));
    await planTaskAssignment(prisma,command({operationKey:'continuity-request-002',input:{...request,startsOn:'',endsOn:''}}));
    await assert.rejects(reviewFor(prisma,first.assignment.id,{startsOn:'',endsOn:''}),{code:'ASSIGNMENT_DUPLICATE'});
    assert.equal(state.audits.length,2);
  }
});

test('feedback distinguishes a new plan from recovery and from later date changes',()=>{
  assert.match(assignmentPlanFeedback(),/Asignación confirmada/);
  assert.match(assignmentPlanFeedback({replayed:true}),/No se creó otra ni se reinició/);
  assert.match(assignmentPlanFeedback({replayed:true,periodChanged:true}),/período vigente, sin restaurar el anterior/);
});
