import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection, EXECUTION_CI_DATABASE } from './lib/execution-test-database.mjs';

const connectionString = executionTestConnection();
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const suffix = /\.(?:js|mjs|ts)$/.test(specifier) ? '' : specifier.startsWith('@/generated/') ? '.ts' : '.js';
    return nextResolve(new URL('../src/' + specifier.slice(2) + suffix, import.meta.url).href, context);
  }
  return nextResolve(specifier, context);
} });
const { createExecutionRecord, updateProjectBlocker, getProjectBlocker } = await import('../src/lib/project-execution.js');
const { addCrewMember, decideCrewMember, readCrewRoster, getCrewMember } = await import('../src/lib/crew-memberships.js');
const { reviewTaskAssignment, planReviewedTaskAssignment } = await import('../src/lib/assignment-overlap-review.js');
const { getTaskAssignment, decideTaskAssignment, prepareTaskAssignment } = await import('../src/lib/task-assignments.js');
const { readScheduleFieldStatus } = await import('../src/lib/schedule-field-status.js');
const clientNames = ['obrasaas-execution-ci-a', 'obrasaas-execution-ci-b'];
const clients = clientNames.map(application_name => new PrismaClient({ adapter: new PrismaPg({ connectionString, application_name, max: 3 }) }));
const [db, other] = clients;
const monitor = new pg.Pool({ connectionString, application_name: 'obrasaas-execution-ci-monitor', max: 3, statement_timeout: 10000 });
const report = { kind: 'real-postgresql-domain-release', status: 'RUNNING', cases: [], contendedRaces: [], providerVerified: false, authenticatedHttpVerified: false, productionDeployed: false };
const output = path.resolve(process.env.EXECUTION_RELEASE_PROOF_PATH || '.vercel/execution-postgres-release.json');
const namespace = 'exec_ci_' + randomUUID().replaceAll('-', '');
const id = name => namespace + '_' + name;
const orgA = id('org_a'), orgB = id('org_b');
const workA = id('work_a'), workA2 = id('work_a2'), workB = id('work_b');
const scope = { organizationId: orgA, projectId: workA };
const siblingScope = { organizationId: orgA, projectId: workA2 }, foreignScope = { organizationId: orgB, projectId: workB };
const actorId = id('actor_a'), actorB = id('actor_b'), absentActor = id('actor_absent');
const taskA = id('task_a'), taskOther = id('task_other'), workerA = id('worker_a'), workerOther = id('worker_other');
let teamId, memberId, assignmentId, originalTask;
const today = new Date();
const startsOn = today.toISOString().slice(0, 10), endsOn = new Date(today.getTime() + 4 * 86400000).toISOString().slice(0, 10);
const rawPlan = (extra = {}) => ({ taskId: taskA, expectedTaskRevision: 0, ownerKind: 'TEAM', ownerId: teamId, startsOn, endsOn, ...extra });
async function checked(name, action) {
  const started = performance.now();
  try { await action(); report.cases.push({ name, status: 'PASS', durationMs: Math.round(performance.now() - started) }); console.log('PASS ' + name); }
  catch (error) { report.cases.push({ name, status: 'FAIL', code: String(error.code || error.name) }); throw error; }
}
async function reviewed(raw, client = db) {
  const result = await reviewTaskAssignment(client, { scope, input: raw });
  return { ...raw, review: { version: result.version, acknowledged: true, reason: 'Coordinación explícita del ensayo aislado.' } };
}
async function race(label, functions) {
  const gate = await monitor.connect(); let settled, observed = 0;
  await gate.query('BEGIN');
  try {
    await gate.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [scope.projectId]);
    settled = Promise.allSettled(functions.map(run => run()));
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const result = await monitor.query("SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND application_name = ANY($1::text[]) AND wait_event_type = 'Lock' AND wait_event = 'advisory'", [clientNames]);
      observed = result.rows[0].waiting;
      if (observed >= functions.length) break;
      await pause(25);
    }
  } finally { await gate.query('ROLLBACK'); gate.release(); }
  const outcomes = await settled;
  assert.equal(observed, functions.length, 'The race must prove simultaneous PostgreSQL lock waiters.');
  report.contendedRaces.push({ name: label, observedWaiters: observed });
  return outcomes;
}
function oneWinner(results, code) {
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  const failed = results.find(row => row.status === 'rejected'); assert.equal(failed.reason.code, code);
  return results.find(row => row.status === 'fulfilled').value;
}
try {
  await checked('isolated database, complete migrations and independent sessions', async () => {
    const result = await monitor.query("SELECT current_database() AS name, current_schema() AS schema, current_setting('server_version_num')::int AS version");
    assert.equal(result.rows[0].name, EXECUTION_CI_DATABASE); assert.equal(result.rows[0].schema, 'public');
    assert.ok(result.rows[0].version >= 170000 && result.rows[0].version < 180000);
    assert.equal(await db.organization.count(), 0, 'Refuse a database containing organizations before fixture creation.');
    assert.equal(await db.project.count(), 0);
    const migrations = await monitor.query('SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS applied, count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unresolved FROM "_prisma_migrations"');
    assert.ok(migrations.rows[0].applied >= 127); assert.equal(migrations.rows[0].unresolved, 0); report.database = { major: 17, ...migrations.rows[0] };
    const sessions = await Promise.all(clients.map(client => client.$queryRawUnsafe('SELECT pg_backend_pid()::int AS pid')));
    assert.notEqual(sessions[0][0].pid, sessions[1][0].pid); report.independentPrismaSessions = true;
  });
  await checked('seed two tenants and three worksites with identical display labels', async () => {
    await db.platformUser.createMany({ data: [actorId, actorB].map((actor, n) => ({ id: actor, clerkUserId: id('clerk_' + n), primaryEmail: id('email_' + n) + '@invalid.example', fullName: 'Responsable de ensayo' })) });
    for (const organizationId of [orgA, orgB]) await db.organization.create({ data: { id: organizationId, name: 'Constructora de ensayo', slug: organizationId, subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' } });
    for (const s of [scope, siblingScope, foreignScope]) {
      await db.project.create({ data: { id: s.projectId, organizationId: s.organizationId, name: 'Obra Norte', slug: s.projectId, status: 'ACTIVE' } });
      await db.worker.create({ data: { id: s === scope ? workerA : id('worker_' + s.projectId), ...s, name: 'Persona de ensayo', active: true } });
      await db.task.create({ data: { id: s === scope ? taskA : id('task_' + s.projectId), projectId: s.projectId, title: 'Mampostería', type: 'TASK', metadata: { source: 'canonical-task-v1' }, progress: 10, startsAt: new Date(startsOn), endsAt: new Date(endsOn) } });
    }
    await db.worker.create({ data: { id: workerOther, ...scope, name: 'Otra persona de ensayo', active: true } });
    await db.task.create({ data: { id: taskOther, projectId: workA, title: 'Otra actividad', type: 'TASK', metadata: { source: 'canonical-task-v1' }, progress: 20 } });
    const created = await createExecutionRecord(db, { scope, actorId, input: { kind: 'TEAM', name: 'Cuadrilla de ensayo' } }); teamId = created.team.id;
    originalTask = await db.task.findUniqueOrThrow({ where: { id: taskA } });
    report.fixture = { tenants: 2, worksites: 3, realPeople: 0, providerMessages: 0 };
  });
  const addition = { scope, actorId, teamId, operationKey: 'integration-add-member-001', input: { workerId: workerA, role: 'MEMBER', expectedTeamRevision: 0 } };
  await checked('concurrent identical crew additions produce one membership and one receipt', async () => {
    const results = await race('crew-addition', [() => addCrewMember(db, addition), () => addCrewMember(other, addition)]);
    assert.ok(results.every(row => row.status === 'fulfilled'), JSON.stringify(results.map(row => row.reason?.code)));
    const records = results.map(row => row.value); memberId = records[0].member.id;
    assert.equal(records[1].member.id, memberId); assert.equal(records.filter(row => row.replayed).length, 1);
    assert.equal(await db.workTeamMember.count({ where: { teamId, workerId: workerA } }), 1);
    assert.equal(await db.auditLog.count({ where: { entityId: memberId, action: 'execution.team.member.added' } }), 1);
  });
  await checked('concurrent crew decisions admit only one revision winner', async () => {
    const request = { scope, actorId, teamId, memberId, input: { expectedRevision: 0, operation: 'CHANGE_ROLE', role: 'LEAD', note: 'Coordinación interna del ensayo.' } };
    const result = oneWinner(await race('crew-decision', [() => decideCrewMember(db, request), () => decideCrewMember(other, { ...request, actorId: actorB })]), 'CREW_MEMBER_STALE');
    assert.equal(result.member.revision, 1); assert.equal(result.member.role, 'LEAD');
    assert.equal(await db.auditLog.count({ where: { entityId: memberId, action: 'execution.team.member.updated' } }), 1);
  });
  await checked('concurrent reviewed assignment retries preserve one logical assignment', async () => {
    const input = await reviewed(rawPlan()); const request = { scope, actorId, operationKey: 'integration-plan-00000001', input };
    const results = await race('assignment-plan', [() => planReviewedTaskAssignment(db, request), () => planReviewedTaskAssignment(other, request)]);
    assert.ok(results.every(row => row.status === 'fulfilled'), JSON.stringify(results.map(row => row.reason?.code)));
    assignmentId = results[0].value.assignment.id;
    assert.equal(results[1].value.assignment.id, assignmentId); assert.equal(results.filter(row => row.value.replayed).length, 1);
    assert.equal(await db.auditLog.count({ where: { entityId: assignmentId, action: 'execution.task.assignment.created' } }), 1);
    assert.equal(await db.taskAssignment.count({ where: { projectId: workA } }), 1);
  });
  await checked('concurrent start decisions do not apply a revision twice', async () => {
    const request = { scope, actorId, assignmentId, input: { expectedRevision: 0, status: 'ACTIVE', note: 'Se inicia la asignación de ensayo.' } };
    const result = oneWinner(await race('assignment-start', [() => decideTaskAssignment(db, request), () => decideTaskAssignment(other, { ...request, actorId: actorB })]), 'ASSIGNMENT_REVISION_CONFLICT');
    assert.equal(result.assignment.revision, 1); assert.equal(result.assignment.status, 'ACTIVE');
    const persisted = await getTaskAssignment(other, { scope, assignmentId }); assert.equal(persisted.assignment.lastDecision.note, request.input.note);
  });
  await checked('overlap review becomes stale after a committed change on another connection', async () => {
    const raw = rawPlan({ taskId: taskOther, ownerKind: 'WORKER', ownerId: workerA });
    const input = await reviewed(raw); const before = await db.taskAssignment.count({ where: { projectId: workA } });
    await decideCrewMember(other, { scope, actorId, teamId, memberId, input: { expectedRevision: 1, operation: 'END', note: 'Final de participación; no se cancela la asignación.' } });
    await assert.rejects(planReviewedTaskAssignment(db, { scope, actorId, operationKey: 'integration-stale-plan-01', input }), { code: 'ASSIGNMENT_REVIEW_CHANGED' });
    assert.equal(await db.taskAssignment.count({ where: { projectId: workA } }), before);
    const updated = await reviewed(raw); const created = await planReviewedTaskAssignment(db, { scope, actorId, operationKey: 'integration-fresh-plan-01', input: updated });
    assert.equal(created.assignment.status, 'PLANNED');
    assert.equal((await db.worker.findUniqueOrThrow({ where: { id: workerA } })).active, true);
    assert.equal((await db.taskAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).status, 'ACTIVE');
  });
  await checked('foreign tenant and sibling worksite cannot recover existing private records', async () => {
    for (const alien of [foreignScope, siblingScope]) {
      await assert.rejects(getTaskAssignment(other, { scope: alien, assignmentId }), { code: 'ASSIGNMENT_NOT_FOUND' });
      await assert.rejects(getCrewMember(other, { scope: alien, teamId, memberId }), { code: 'CREW_TEAM_MISSING' });
      await assert.rejects(prepareTaskAssignment(other, { scope: alien, taskId: taskA }), { code: 'ASSIGNMENT_TASK_MISSING' });
    }
    const roster = await readCrewRoster(db, { scope, teamId, query: { view: 'past', after: null } });
    assert.equal(roster.members.length, 1); assert.equal(roster.members[0].id, memberId); assert.equal(roster.summary.current, 0);
  });
  await checked('PostgreSQL scoped foreign keys reject cross-worksite crew ownership', async () => {
    const alienWorker = id('worker_' + workB);
    await assert.rejects(monitor.query('INSERT INTO "WorkTeamMember" (id,"projectId","teamId","workerId","startsAt","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)', [id('bad_member'), workA, teamId, alienWorker]), error => error.code === '23503' && error.constraint === 'WorkTeamMember_worker_scope_fkey');
    assert.equal(await db.workTeamMember.count({ where: { id: id('bad_member') } }), 0);
  });
  await checked('audit foreign-key failure rolls back assignment creation and status changes', async () => {
    const raw = rawPlan({ taskId: taskOther, ownerKind: 'WORKER', ownerId: workerOther }); const input = await reviewed(raw);
    const before = await db.taskAssignment.count();
    await assert.rejects(planReviewedTaskAssignment(db, { scope, actorId: absentActor, operationKey: 'integration-no-actor-0001', input }), { code: 'P2003' });
    assert.equal(await db.taskAssignment.count(), before);
    await assert.rejects(decideTaskAssignment(db, { scope, actorId: absentActor, assignmentId, input: { expectedRevision: 1, status: 'ENDED', note: 'Debe revertirse por actor de auditoría inexistente.' } }), { code: 'P2003' });
    const row = await db.taskAssignment.findUniqueOrThrow({ where: { id: assignmentId } }); assert.equal(row.status, 'ACTIVE'); assert.equal(row.revision, 1);
  });
  await checked('restriction resolution is persisted while task progress and dates remain unchanged', async () => {
    const created = await createExecutionRecord(db, { scope, actorId, input: { kind: 'BLOCKER', title: 'Faltante sintético', severity: 'MEDIUM', taskId: taskA, ownerTeamId: teamId } });
    const before = await readScheduleFieldStatus(db, { scope, query: { taskId: taskA } });
    await updateProjectBlocker(other, { scope, actorId, blockerId: created.blocker.id, expectedRevision: 0, input: { status: 'RESOLVED', resolution: 'El faltante de ensayo quedó resuelto.' } });
    const row = await getProjectBlocker(db, { scope, blockerId: created.blocker.id }); assert.equal(row.status, 'RESOLVED'); assert.equal(row.revision, 1);
    const after = await readScheduleFieldStatus(other, { scope, query: { taskId: taskA } }); assert.notEqual(after.version, before.version);
    assert.equal(after.tasks[0].operationalProgress, 10); assert.equal(after.tasks[0].startsAt, originalTask.startsAt.toISOString());
    await assert.rejects(getProjectBlocker(db, { scope: foreignScope, blockerId: created.blocker.id }), { code: 'PROJECT_BLOCKER_NOT_FOUND' });
  });
  await checked('assignment completion, exact replay and ended crew history preserve their original records', async () => {
    const ended = await decideTaskAssignment(db, { scope, actorId, assignmentId, input: { expectedRevision: 1, status: 'ENDED', note: 'Finaliza la asignación, no certifica avance.' } });
    assert.equal(ended.assignment.status, 'ENDED');
    await assert.rejects(decideTaskAssignment(other, { scope, actorId, assignmentId, input: { expectedRevision: 2, status: 'ACTIVE', note: 'No se admite reapertura.' } }), { code: 'ASSIGNMENT_TRANSITION_INVALID' });
    const member = await addCrewMember(other, addition); assert.equal(member.replayed, true); assert.equal(member.member.id, memberId); assert.equal(member.member.state, 'ENDED');
    const currentTask = await db.task.findUniqueOrThrow({ where: { id: taskA } }); assert.deepEqual(currentTask, originalTask);
  });
  await checked('archived worksite refuses writes without leaving partial records', async () => {
    await db.project.update({ where: { id: workA }, data: { status: 'ARCHIVED' } });
    const before = await db.workTeam.count();
    await assert.rejects(createExecutionRecord(other, { scope, actorId, input: { kind: 'TEAM', name: 'No debe existir' } }), { code: 'PROJECT_READ_ONLY' });
    assert.equal(await db.workTeam.count(), before);
    assert.equal(await db.organization.count(), 2); assert.equal(await db.project.count(), 3);
  });
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = { code: String(error.code || error.name), message: String(error.message).slice(0, 1400) };
  console.error('Execution integration failed:', report.failure); process.exitCode = 1;
} finally {
  report.completedCases = report.cases.filter(item => item.status === 'PASS').length;
  report.checkedAt = new Date().toISOString();
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2));
  await Promise.allSettled(clients.map(client => client.$disconnect())); await monitor.end();
  console.log(JSON.stringify(report));
}
