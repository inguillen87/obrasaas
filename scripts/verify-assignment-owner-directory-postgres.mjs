import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { executionTestConnection } from './lib/execution-test-database.mjs';
import { listAssignmentOwners } from '../src/lib/assignment-owner-directory.js';
import { ownerDirectoryPageMatches } from '../src/lib/assignment-owner-directory-policy.js';

const connectionString = executionTestConnection();
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const prefix = 'directory_' + randomUUID().replaceAll('-', ''), id = name => prefix + '_' + name;
const scope = { organizationId: id('org'), projectId: id('project') };
const input = { taskId: id('task'), expectedTaskRevision: 0, ownerKind: 'WORKER', query: '', cursor: null };
const report = { status: 'RUNNING', environment: 'disposable-postgresql', cases: [], productionAccessed: false };
const read = changes => listAssignmentOwners(db, { scope, input: { ...input, ...changes } });
async function check(name, operation) { await operation(); report.cases.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
try {
  await check('empty disposable database and explicit synthetic worksite', async () => {
    assert.equal(await db.organization.count(), 0);
    for (const suffix of ['', '_foreign']) {
      await db.organization.create({ data: { id: scope.organizationId + suffix, name: 'Empresa de ensayo', slug: id('slug') + suffix, subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' } });
      await db.project.create({ data: { id: scope.projectId + suffix, organizationId: scope.organizationId + suffix, name: 'Obra de ensayo', slug: id('work') + suffix, status: 'ACTIVE' } });
    }
    await db.task.create({ data: { id: input.taskId, projectId: scope.projectId, title: 'Actividad de ensayo', type: 'TASK', metadata: { source: 'canonical-task-v1' } } });
    await db.worker.createMany({ data: Array.from({ length: 137 }, (_, i) => ({ id: id('worker' + i), ...scope, name: 'Persona ' + String(i).padStart(3, '0'), active: true })) });
    await db.workTeam.createMany({ data: Array.from({ length: 73 }, (_, i) => ({ id: id('team' + i), projectId: scope.projectId, name: 'Cuadrilla ' + String(i).padStart(3, '0'), status: 'ACTIVE' })) });
  });
  for (const [ownerKind, total] of [['WORKER', 137], ['TEAM', 73]]) await check('paginate every ' + ownerKind + ' with real Prisma and PostgreSQL ordering', async () => {
    let cursor = null; const seen = new Set(); let pages = 0;
    do { const page = await read({ ownerKind, cursor }); assert.equal(ownerDirectoryPageMatches(page, { ...input, ownerKind, cursor }, scope), true); for (const item of page.items) { assert.ok(!seen.has(item.id)); seen.add(item.id); } cursor = page.nextCursor; assert.ok(++pages < 10); } while (cursor);
    assert.equal(seen.size, total);
  });
  await check('word search finds responsible beyond initial 100', async () => {
    const page = await read({ query: ' 136 PERSONA ' }); assert.deepEqual(page.items, [{ id: id('worker136'), name: 'Persona 136' }]);
  });
  await check('literal PostgreSQL ILIKE metacharacters are not wildcards', async () => {
    for (const [index, query] of ['%', '_', '\\'].entries()) {
      await db.worker.create({ data: { id: id('literal' + index), ...scope, name: 'Literal ' + query, active: true } });
      const page = await read({ query }); assert.deepEqual(page.items.map(row => row.id), [id('literal' + index)]);
    }
  });
  await check('identical names have a deterministic id tie-breaker', async () => {
    await db.worker.createMany({ data: Array.from({ length: 35 }, (_, i) => ({ id: id('same' + String(i).padStart(3, '0')), ...scope, name: 'Duplicado nominal', active: true })) });
    const a = await read({ query: 'Duplicado nominal' }), b = await read({ query: 'Duplicado nominal', cursor: a.nextCursor });
    assert.equal(a.items.length, 30); assert.equal(b.items.length, 5); assert.equal(new Set([...a.items, ...b.items].map(row => row.id)).size, 35);
  });
  await check('inactive workers and same-name records of other tenant are excluded', async () => {
    await db.worker.create({ data: { id: id('inactive'), ...scope, name: 'Persona 136', active: false } });
    await db.worker.create({ data: { id: id('outsider'), organizationId: scope.organizationId + '_foreign', projectId: scope.projectId + '_foreign', name: 'Persona 136', active: true } });
    assert.deepEqual((await read({ query: 'Persona 136' })).items.map(row => row.id), [id('worker136')]);
    await assert.rejects(listAssignmentOwners(db, { scope: { ...scope, organizationId: scope.organizationId + '_foreign' }, input }), { code: 'ASSIGNMENT_PROJECT_MISSING' });
  });
  await check('changed query rejects the cursor; changed task rejects the stale form', async () => {
    const first = await read({}); await assert.rejects(read({ query: 'Persona', cursor: first.nextCursor }), { code: 'ASSIGNMENT_DIRECTORY_CURSOR_INVALID' });
    await assert.rejects(read({ expectedTaskRevision: 1 }), { code: 'ASSIGNMENT_TASK_CHANGED' });
  });
  await check('directory lookups create no assignments, audits or task revisions', async () => {
    assert.equal(await db.taskAssignment.count(), 0); assert.equal(await db.auditLog.count(), 0);
    assert.equal((await db.task.findUniqueOrThrow({ where: { id: input.taskId } })).revision, 0);
  });
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.failure = { code: error.code || error.name, message: String(error.message).slice(0, 800) }; process.exitCode = 1; }
finally { mkdirSync('evidence', { recursive: true }); writeFileSync('evidence/owner-directory-postgres.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); await db.$disconnect(); }
