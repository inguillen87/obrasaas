import assert from 'node:assert/strict';
import test from 'node:test';
import { FIELD_REPORT_CATEGORIES, normalizeFieldReport, fieldReportAsDailyLog } from '../src/lib/field-report.js';
import { createFieldReport } from '../src/lib/field-report-store.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const input = (overrides = {}) => ({ projectId: scope.projectId, category: 'SHORTAGE', title: 'Falta cemento', location: 'Sector norte', details: 'Diez bolsas para el lunes.', workDate: '2026-09-17', ...overrides });
const options = overrides => ({ scope, actorId: 'author-a', operationKey: 'test-request-00000001', input: input(), ...overrides });
for (const category of FIELD_REPORT_CATEGORIES) test('categoría admitida: ' + category.label, () => {
  const data = fieldReportAsDailyLog(input({ category: category.key }));
  assert.ok(data.title.startsWith(category.label)); assert.match(data.summary, /Sector norte/);
});
test('normaliza espacios y saltos sin alterar la fecha civil', () => {
  const normalized = normalizeFieldReport(input({ title: '  Texto  ', details: 'Uno\r\nDos' }));
  assert.equal(normalized.title, 'Texto'); assert.equal(normalized.details, 'Uno\nDos');
  assert.equal(fieldReportAsDailyLog(normalized).workDate.toISOString(), '2026-09-17T00:00:00.000Z');
});
for (const workDate of ['2026-02-30', '2026-13-01', '17/09/2026', '2026-09-17T12:00']) test('rechaza fecha inválida: ' + workDate, () => assert.throws(() => normalizeFieldReport(input({ workDate }))));
for (const override of [{ category: '__proto__' }, { title: '' }, { details: 'a'.repeat(2001) }, { actorId: 'admin' }, { tenantId: 'org-b' }, { title: 'one\ntwo' }]) test('rechaza contenido o autoridad suministrada por cliente: ' + Object.keys(override)[0], () => assert.throws(() => normalizeFieldReport(input(override))));
function fakeDatabase() {
  const state = { logs: [], receipts: [], failAudit: false, projectStatus: 'ACTIVE' };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    $executeRawUnsafe: async () => 1,
    project: { findFirst: async ({ where }) => where.id === scope.projectId && where.organizationId === scope.organizationId ? { ...scope, id: scope.projectId, status: state.projectStatus } : null },
    dailyLog: {
      findFirst: async ({ where }) => structuredClone(state.logs.find(row => matches(row, where)) || null),
      create: async ({ data }) => { const row = { ...structuredClone(data), revision: 0 }; state.logs.push(row); return row; },
    },
    auditLog: {
      findFirst: async ({ where }) => structuredClone(state.receipts.find(row => matches(row, where)) || null),
      create: async ({ data }) => { if (state.failAudit) throw new Error('AUDIT_FAILED'); state.receipts.push(structuredClone(data)); return data; },
    },
  };
  return { state, prisma: { $transaction: async operation => {
    const before = structuredClone(state);
    try { return await operation(tx); } catch (error) { Object.assign(state, before); throw error; }
  } } };
}
test('parte y auditoría son atómicos y el estado inicial es borrador', async () => {
  const { prisma, state } = fakeDatabase(); const result = await createFieldReport(prisma, options());
  assert.equal(result.report.status, 'DRAFT'); assert.equal(result.replayed, false);
  assert.equal(state.logs.length, 1); assert.equal(state.receipts.length, 1);
  assert.equal(state.receipts[0].metadata.category, 'SHORTAGE');
  assert.ok(!JSON.stringify(state.receipts).includes('Diez bolsas'));
});
test('reintentar una solicitud no duplica parte ni auditoría', async () => {
  const { prisma, state } = fakeDatabase(); const first = await createFieldReport(prisma, options());
  const replay = await createFieldReport(prisma, options());
  assert.equal(replay.report.id, first.report.id); assert.equal(replay.replayed, true);
  assert.equal(state.logs.length, 1); assert.equal(state.receipts.length, 1);
});
test('una respuesta perdida no revierte un estado revisado al reintentar', async () => {
  const { prisma, state } = fakeDatabase(); await createFieldReport(prisma, options());
  state.logs[0].status = 'APPROVED'; state.logs[0].revision = 2;
  const replay = await createFieldReport(prisma, options());
  assert.equal(replay.report.status, 'APPROVED'); assert.equal(state.logs.length, 1);
});
test('misma clave y contenido diferente se rechazan', async () => {
  const { prisma } = fakeDatabase(); await createFieldReport(prisma, options());
  await assert.rejects(createFieldReport(prisma, options({ input: input({ details: 'Contenido distinto' }) })), { code: 'FIELD_REPLAY_CONFLICT' });
});
test('cambio de obra en otra pestaña impide guardar en el destino equivocado', async () => {
  const { prisma, state } = fakeDatabase();
  await assert.rejects(createFieldReport(prisma, options({ input: input({ projectId: 'other-project' }) })), { code: 'FIELD_PROJECT_CHANGED' });
  assert.equal(state.logs.length, 0);
});
test('otra empresa no accede aunque conserve el ID de obra', async () => {
  const { prisma } = fakeDatabase();
  await assert.rejects(createFieldReport(prisma, options({ scope: { ...scope, organizationId: 'other-org' } })), { code: 'PROJECT_WRITE_SCOPE_INVALID' });
});
test('actor diferente no reutiliza recibos de otra identidad', async () => {
  const { prisma } = fakeDatabase(); const a = await createFieldReport(prisma, options());
  const b = await createFieldReport(prisma, options({ actorId: 'author-b' }));
  assert.notEqual(a.report.id, b.report.id); assert.equal(b.replayed, false);
});
test('obra archivada bloquea la escritura', async () => {
  const { prisma, state } = fakeDatabase(); state.projectStatus = 'ARCHIVED';
  await assert.rejects(createFieldReport(prisma, options()), { code: 'PROJECT_READ_ONLY' });
});
test('fallo de auditoría revierte el parte', async () => {
  const { prisma, state } = fakeDatabase(); state.failAudit = true;
  await assert.rejects(createFieldReport(prisma, options()), /AUDIT_FAILED/);
  assert.equal(state.logs.length, 0); assert.equal(state.receipts.length, 0);
});
test('un parte eliminado no se recrea silenciosamente en un replay', async () => {
  const { prisma, state } = fakeDatabase(); await createFieldReport(prisma, options()); state.logs = [];
  await assert.rejects(createFieldReport(prisma, options()), { code: 'FIELD_REPORT_GONE' });
  assert.equal(state.logs.length, 0);
});
test('operación sin clave o actor no toca datos', async () => {
  const { prisma } = fakeDatabase();
  await assert.rejects(createFieldReport(prisma, options({ operationKey: 'short' })));
  await assert.rejects(createFieldReport(prisma, options({ actorId: '' })), { code: 'FIELD_SCOPE_REQUIRED' });
});
