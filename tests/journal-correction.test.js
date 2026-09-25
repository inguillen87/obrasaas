import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeJournalCorrection } from '../src/lib/journal-correction-policy.js';
import { prepareJournalCorrection, createJournalCorrection, withJournalCorrectionLinks } from '../src/lib/journal-correction.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const source = () => ({ id: 'source-a', projectId: scope.projectId, taskId: 'task-a', authorWorkerId: 'worker-a', workDate: new Date('2026-09-18T00:00:00Z'),
  title: 'Mampostería', summary: 'Se completó el muro.', status: 'REJECTED', revision: 2, rejectionReason: 'Faltan cantidades y ubicación.',
  createdAt: new Date('2026-09-18T12:00:00Z'), updatedAt: new Date('2026-09-18T13:00:00Z'), submittedAt: new Date('2026-09-18T12:30:00Z'), approvedAt: null });
function database() {
  const state = { rows: [source()], receipts: [], failAudit: false, projectStatus: 'ACTIVE', taskPresent: true };
  const match = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    $executeRawUnsafe: async () => 1,
    project: { findFirst: async ({ where }) => where.id === scope.projectId && where.organizationId === scope.organizationId ? { ...scope, id: scope.projectId, status: state.projectStatus } : null },
    task: { findFirst: async ({ where }) => state.taskPresent && where.projectId === scope.projectId && where.id === 'task-a' && where.type === 'TASK' && where.metadata.equals === 'canonical-task-v1' ? { id: 'task-a' } : null },
    dailyLog: {
      findFirst: async ({ where }) => structuredClone(state.rows.find(row => match(row, where)) || null),
      create: async ({ data }) => { if (state.rows.some(row => row.id === data.id)) throw new Error('DUPLICATE'); const row = { ...structuredClone(data), revision: 0, rejectionReason: null, createdAt: new Date(), updatedAt: new Date() }; state.rows.push(row); return structuredClone(row); },
      findMany: async ({ where }) => structuredClone(state.rows.filter(row => row.projectId === where.projectId && where.id.in.includes(row.id))),
    },
    auditLog: {
      findFirst: async ({ where }) => structuredClone(state.receipts.find(row => match(row, where)) || null),
      create: async ({ data }) => { if (state.failAudit) throw new Error('AUDIT_FAILURE'); state.receipts.push(structuredClone(data)); return data; },
      findMany: async ({ where }) => structuredClone(state.receipts.filter(row => row.organizationId === where.organizationId && row.action === where.action && row.metadata.projectId === where.metadata.equals && (where.OR[0].id.in.includes(row.id) || where.OR[1].entityId.in.includes(row.entityId)))),
    },
  };
  return { state, prisma: { ...tx, $transaction: async operation => { const before = structuredClone(state); try { return await operation(tx); } catch (error) { Object.assign(state, before); throw error; } } } };
}
async function command(prisma, overrides = {}) {
  const prepared = await prepareJournalCorrection(prisma, { scope, sourceId: 'source-a' });
  return { sourceVersion: prepared.source.version, expectedRevision: prepared.source.revision, title: 'Mampostería corregida', summary: 'Se registran 12 m2 en el sector norte para revisión.', taskId: 'task-a', ...overrides };
}
const options = input => ({ scope, sourceId: 'source-a', actorId: 'actor-a', operationKey: 'correction-request-0001', input });
test('preview never creates or updates a record', async () => {
  const { prisma, state } = database(); const before = structuredClone(state.rows); const result = await prepareJournalCorrection(prisma, { scope, sourceId: 'source-a' });
  assert.equal(result.existing, null); assert.match(result.source.version, /^[a-f0-9]{64}$/); assert.deepEqual(state.rows, before); assert.equal(state.receipts.length, 0);
});
test('correction preserves original, date, author and rejection while creating a distinct draft', async () => {
  const { prisma, state } = database(); const before = structuredClone(state.rows[0]); const result = await createJournalCorrection(prisma, options(await command(prisma)));
  assert.deepEqual(state.rows[0], before); assert.notEqual(result.dailyLog.id, before.id); assert.equal(result.dailyLog.status, 'DRAFT'); assert.equal(result.dailyLog.revision, 0);
  assert.equal(result.dailyLog.workDate, '2026-09-18'); assert.equal(result.dailyLog.authorWorkerId, before.authorWorkerId); assert.equal(result.dailyLog.correctionOf.id, before.id);
  assert.equal(state.receipts.length, 1); assert.equal(state.receipts[0].actorId, 'actor-a'); assert.ok(!JSON.stringify(state.receipts).includes(before.summary));
});
test('same request verifies the existing correction without duplication', async () => {
  const { prisma, state } = database(); const request = options(await command(prisma)); const first = await createJournalCorrection(prisma, request);
  const second = await createJournalCorrection(prisma, request); assert.equal(second.dailyLog.id, first.dailyLog.id); assert.equal(second.replayed, true); assert.equal(state.rows.length, 2); assert.equal(state.receipts.length, 1);
});
test('another authorized session cannot create a second correction from the same source', async () => {
  const { prisma, state } = database(); const input = await command(prisma); const first = await createJournalCorrection(prisma, options(input));
  const second = await createJournalCorrection(prisma, { ...options(input), actorId: 'actor-b', operationKey: 'another-request-0002' });
  assert.equal(second.dailyLog.id, first.dailyLog.id); assert.equal(second.replayed, true); assert.equal(state.rows.length, 2);
});
test('different content for an already corrected source is rejected', async () => {
  const { prisma } = database(); const input = await command(prisma); await createJournalCorrection(prisma, options(input));
  await assert.rejects(createJournalCorrection(prisma, options({ ...input, title: 'Otra corrección' })), { code: 'JOURNAL_CORRECTION_ALREADY_EXISTS' });
});
test('replay never reopens a reviewed correction or reverts its task', async () => {
  const { prisma, state } = database(); const input = await command(prisma); await createJournalCorrection(prisma, options(input));
  state.rows[1].status = 'APPROVED'; state.rows[1].revision = 4; state.rows[1].taskId = null;
  const result = await createJournalCorrection(prisma, options(input)); assert.equal(result.dailyLog.status, 'APPROVED'); assert.equal(result.dailyLog.revision, 4); assert.equal(result.dailyLog.taskId, null);
});
test('existing correction is discoverable independently of the creating session', async () => {
  const { prisma } = database(); const result = await createJournalCorrection(prisma, options(await command(prisma)));
  const preview = await prepareJournalCorrection(prisma, { scope, sourceId: 'source-a' }); assert.equal(preview.existing.id, result.dailyLog.id);
});
for (const status of ['DRAFT', 'SUBMITTED', 'APPROVED']) test('source status is not implicitly reopened: ' + status, async () => {
  const { prisma, state } = database(); const input = await command(prisma); state.rows[0].status = status;
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'JOURNAL_CORRECTION_SOURCE_LOCKED' }); assert.equal(state.rows.length, 1);
});
for (const changed of ['revision', 'summary', 'rejectionReason', 'taskId']) test('stale source fingerprint rejected: ' + changed, async () => {
  const { prisma, state } = database(); const input = await command(prisma); state.rows[0][changed] = changed === 'revision' ? 3 : 'changed';
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'JOURNAL_CORRECTION_SOURCE_CHANGED' }); assert.equal(state.rows.length, 1);
});
test('unchanged content is not a correction', async () => {
  const { prisma, state } = database(); const row = state.rows[0]; const input = await command(prisma, { title: row.title, summary: row.summary });
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'JOURNAL_CORRECTION_UNCHANGED' });
});
test('task must be canonical and in this project', async () => {
  const { prisma, state } = database(); const input = await command(prisma, { taskId: 'foreign-task' });
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'JOURNAL_CORRECTION_TASK_NOT_FOUND' }); assert.equal(state.rows.length, 1);
});
test('an explicit unassigned correction remains a draft, not an invented task', async () => {
  const { prisma } = database(); const result = await createJournalCorrection(prisma, options(await command(prisma, { taskId: null })));
  assert.equal(result.dailyLog.taskId, null); assert.equal(result.dailyLog.status, 'DRAFT');
});
test('scope mismatch cannot read or write source', async () => {
  const { prisma, state } = database(); const input = await command(prisma); const foreign = { ...scope, organizationId: 'other' };
  await assert.rejects(prepareJournalCorrection(prisma, { scope: foreign, sourceId: 'source-a' }), { status: 404 });
  await assert.rejects(createJournalCorrection(prisma, { ...options(input), scope: foreign }), { code: 'PROJECT_WRITE_SCOPE_INVALID' }); assert.equal(state.rows.length, 1);
});
test('archived project is read-only', async () => {
  const { prisma, state } = database(); const input = await command(prisma); state.projectStatus = 'ARCHIVED';
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'PROJECT_READ_ONLY' });
});
test('audit failure rolls back the newly created correction', async () => {
  const { prisma, state } = database(); const input = await command(prisma); state.failAudit = true;
  await assert.rejects(createJournalCorrection(prisma, options(input)), /AUDIT_FAILURE/); assert.equal(state.rows.length, 1); assert.equal(state.receipts.length, 0);
});
test('deleted correction cannot be silently recreated from the same source', async () => {
  const { prisma, state } = database(); const input = await command(prisma); await createJournalCorrection(prisma, options(input)); state.rows.pop();
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'JOURNAL_CORRECTION_GONE' }); assert.equal(state.rows.length, 1);
});
test('missing receipt never legitimizes an existing child', async () => {
  const { prisma, state } = database(); const input = await command(prisma); await createJournalCorrection(prisma, options(input)); state.receipts = [];
  await assert.rejects(createJournalCorrection(prisma, options(input)), { code: 'JOURNAL_CORRECTION_INTEGRITY' });
});
test('original and correction links are hydrated only from same-project records', async () => {
  const { prisma, state } = database(); await createJournalCorrection(prisma, options(await command(prisma)));
  const result = await withJournalCorrectionLinks(prisma, { ...scope, journal: { dailyLogs: state.rows } });
  assert.equal(result.dailyLogs[0].correction.id, state.rows[1].id); assert.equal(result.dailyLogs[1].correctionOf.id, state.rows[0].id);
  state.rows[1].projectId = 'other-project';
  const isolated = await withJournalCorrectionLinks(prisma, { ...scope, journal: { dailyLogs: [state.rows[0]] } });
  assert.equal(isolated.dailyLogs[0].correction, undefined);
});
test('a later rejected correction can have its own successor without changing ancestors', async () => {
  const { prisma, state } = database(); const child = (await createJournalCorrection(prisma, options(await command(prisma)))).dailyLog;
  state.rows[1].status = 'REJECTED'; state.rows[1].revision = 2; state.rows[1].rejectionReason = 'Aclarar unidad.';
  const original = structuredClone(state.rows[0]), second = structuredClone(state.rows[1]);
  const preview = await prepareJournalCorrection(prisma, { scope, sourceId: child.id });
  const next = await createJournalCorrection(prisma, { ...options(await command(prisma)), sourceId: child.id,
    input: { title: child.title, summary: 'Corrección de unidad: 12 metros cuadrados.', taskId: child.taskId, expectedRevision: 2, sourceVersion: preview.source.version } });
  assert.notEqual(next.dailyLog.id, child.id); assert.equal(next.dailyLog.correctionOf.id, child.id); assert.deepEqual(state.rows[0], original); assert.deepEqual(state.rows[1], second); assert.equal(state.rows.length, 3);
});
const valid = { title: 'Corregido', summary: 'Contenido corregido', taskId: null, expectedRevision: 2, sourceVersion: 'a'.repeat(64) };
for (const override of [{ actorId: 'admin' }, { authorWorkerId: 'other' }, { projectId: 'other' }, { workDate: '2026-01-01' }, { title: '' }, { title: 'a'.repeat(221) }, { summary: 'a'.repeat(10001) }, { summary: 'x\u0000' }, { expectedRevision: '2' }, { sourceVersion: 'invalid' }, { taskId: '../x' }]) test('client authority or invalid input denied: ' + Object.keys(override)[0], () => assert.throws(() => normalizeJournalCorrection({ ...valid, ...override })));
test('normalization preserves multiline correction and optional task', () => {
  const result = normalizeJournalCorrection({ ...valid, summary: '  Corrección\r\nSegunda línea  ', taskId: '' });
  assert.equal(result.summary, 'Corrección\nSegunda línea'); assert.equal(result.taskId, null);
});
