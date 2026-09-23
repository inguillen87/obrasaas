import assert from 'node:assert/strict';
import test from 'node:test';
import { listAssignmentOwners } from '../src/lib/assignment-owner-directory.js';
import { normalizeOwnerSearch, normalizeOwnerQuery, ownerDirectoryPageMatches } from '../src/lib/assignment-owner-directory-policy.js';
import { ownerDirectoryFixture } from './helpers/owner-directory-fixture.js';
import { scope } from './helpers/assignment-overlap-fixture.js';
const input = { taskId: 'task-a', expectedTaskRevision: 3, ownerKind: 'WORKER', query: '', cursor: null };
const read = (fixture, changes = {}, nextScope = scope) => listAssignmentOwners(fixture.prisma, { scope: nextScope, input: { ...input, ...changes } });

for (const [ownerKind, total] of [['WORKER', 137], ['TEAM', 73]]) test('keyset reaches every scoped active ' + ownerKind + ' beyond 100', async () => {
  const f = ownerDirectoryFixture(), ids = []; let cursor = null, pages = 0;
  do {
    const page = await read(f, { ownerKind, cursor });
    assert.equal(ownerDirectoryPageMatches(page, { ...input, ownerKind, cursor }, scope), true);
    ids.push(...page.items.map(row => row.id)); cursor = page.nextCursor; pages++;
    assert.ok(pages < 10);
  } while (cursor);
  assert.equal(ids.length, total); assert.equal(new Set(ids).size, total);
  assert.equal(f.state.rows.length, 0); assert.equal(f.state.audits.length, 0);
  for (const call of f.calls) { assert.equal(call.options.take, 31); assert.deepEqual(call.options.select, { id: true, name: true }); }
});
test('search combines literal words without case sensitivity and returns only id/name', async () => {
  const f = ownerDirectoryFixture();
  const page = await read(f, { query: '  136  PERSONA ' });
  assert.equal(page.query, '136 PERSONA'); assert.equal(page.items[0].id, 'worker-136'); assert.equal(page.items.length, 1);
  assert.ok(!JSON.stringify(page).includes('NEVER_RETURN_THIS'));
  assert.equal(page.nextCursor, null);
});
test('inactive and foreign rows never enter a page', async () => {
  const f = ownerDirectoryFixture();
  f.state.directoryWorkers.push({ ...f.state.directoryWorkers[0], id: 'alien', projectId: 'other-work' }, { ...f.state.directoryWorkers[0], id: 'foreign', organizationId: 'other-org' }, { ...f.state.directoryWorkers[0], id: 'inactive', active: false });
  const page = await read(f, { query: '000' }); assert.deepEqual(page.items.map(row => row.id), ['worker-a']);
  await assert.rejects(read(f, {}, { ...scope, organizationId: 'other-org' }), { code: 'ASSIGNMENT_PROJECT_MISSING' });
});
for (const query of ['%', '_', '\\']) test('LIKE metacharacter is a literal: ' + query, async () => {
  const f = ownerDirectoryFixture(); f.state.directoryWorkers[136].name = 'Literal ' + query;
  const page = await read(f, { query }); assert.equal(page.items.length, 1); assert.equal(page.items[0].id, 'worker-136');
  assert.equal(f.calls[0].options.where.AND[0].name.contains, '\\' + query);
});
test('equal names paginate by stable id without duplicates', async () => {
  const f = ownerDirectoryFixture(); f.state.directoryWorkers.forEach(row => { row.name = 'Mismo nombre'; });
  const first = await read(f), second = await read(f, { cursor: first.nextCursor });
  assert.equal(new Set([...first.items, ...second.items].map(row => row.id)).size, 60);
});
test('deleting the prior boundary does not require a global cursor-row lookup', async () => {
  const f = ownerDirectoryFixture(), first = await read(f), boundary = first.items.at(-1).id;
  f.state.directoryWorkers = f.state.directoryWorkers.filter(row => row.id !== boundary);
  const next = await read(f, { cursor: first.nextCursor }); assert.equal(next.items[0].id, 'worker-30');
});
for (const change of [{ query: 'Persona' }, { ownerKind: 'TEAM' }, { expectedTaskRevision: 4 }, { taskId: 'other-task' }]) test('cursor cannot be reused for changed criteria ' + JSON.stringify(change), async () => {
  const f = ownerDirectoryFixture(), first = await read(f);
  await assert.rejects(read(f, { cursor: first.nextCursor, ...change }), { code: 'ASSIGNMENT_DIRECTORY_CURSOR_INVALID' });
});
test('cursor from another worksite is rejected before database reads', async () => {
  const f = ownerDirectoryFixture(), first = await read(f), count = f.calls.length;
  await assert.rejects(read(f, { cursor: first.nextCursor }, { ...scope, projectId: 'other' }), { code: 'ASSIGNMENT_DIRECTORY_CURSOR_INVALID' });
  assert.equal(f.calls.length, count);
});
test('task change requires refreshed sources, and a missing task is not enumerated', async () => {
  const f = ownerDirectoryFixture(); f.state.task.revision++;
  await assert.rejects(read(f), { code: 'ASSIGNMENT_TASK_CHANGED', status: 409 }); assert.equal(f.calls.length, 0);
  f.state.task = null; await assert.rejects(read(f), { code: 'ASSIGNMENT_TASK_MISSING', status: 404 });
});
for (const change of [{ ownerKind: 'ALL' }, { expectedTaskRevision: '3' }, { expectedTaskRevision: -1 }, { cursor: '' }, { cursor: 'a'.repeat(4097) }, { query: 'a'.repeat(81) }, { query: '\n' }, { projectId: 'other' }, { query: {} }]) test('malformed search fails closed ' + JSON.stringify(change), () => {
  assert.throws(() => normalizeOwnerSearch({ ...input, ...change }));
});
test('unknown, malformed or unrelated page cannot supply a selectable owner', async () => {
  const f = ownerDirectoryFixture(), good = await read(f);
  for (const bad of [null, { ...good, context: { ...scope, projectId: 'other' } }, { ...good, ownerKind: 'TEAM' }, { ...good, query: 'else' }, { ...good, cursor: 'other' }, { ...good, task: { id: 'task-a', revision: 4 } }, { ...good, items: [{ id: '../x', name: 'Invalid' }] }, { ...good, items: [{ id: 'valid', name: 'A', phone: 'private' }] }, { ...good, items: [good.items[0], good.items[0]] }, { ...good, nextCursor: '' }, { ...good, items: [], nextCursor: 'abc' }]) assert.equal(ownerDirectoryPageMatches(bad, input, scope), false);
  assert.equal(normalizeOwnerQuery('  José  Pérez  '), 'José Pérez');
});
