import assert from 'node:assert/strict';
import test from 'node:test';
import { INSPECTION_TEMPLATES, normalizeInspectionDraft, assertInspectionSubmittable, resolveInspectionMutation, inspectionHash, inspectionSnapshot } from '../src/lib/site-inspections.js';
import { createInspection, mutateInspection, getInspection, listInspections } from '../src/lib/site-inspection-store.js';
import { roleHasPermission } from '../src/lib/tenant-roles.js';

const scope = { organizationId: 'org-a', projectId: 'project-a' };
function draft(overrides = {}) {
  return { templateKey: 'HORMIGONADO', title: 'Control previo', location: 'Nivel 2', technicalReference: 'Plano E04 revisión 3', notes: '', checklist: INSPECTION_TEMPLATES[1].items.map(item => ({ key: item.key, result: 'PASS', criterion: 'Según plano E04 revisión 3', observation: 'Control visual registrado' })), ...overrides };
}
function submitted(overrides = {}) { return { ...normalizeInspectionDraft(draft()), status: 'SUBMITTED', version: 2, ...overrides }; }
for (const template of INSPECTION_TEMPLATES) test('plantilla sin datos ficticios: ' + template.key, () => {
  const value = normalizeInspectionDraft({ templateKey: template.key, title: 'Nueva', location: 'Sector 1' });
  assert.equal(value.checklist.length, 4);
  assert.ok(value.checklist.every(item => item.result === 'PENDING' && !item.criterion));
});
test('rechaza plantilla desconocida', () => assert.throws(() => normalizeInspectionDraft(draft({ templateKey: '__proto__' }))));
test('rechaza controles duplicados', () => assert.throws(() => normalizeInspectionDraft(draft({ checklist: Array(4).fill(draft().checklist[0]) }))));
test('rechaza no aplicable sin justificación', () => {
  const input = draft(); input.checklist[0] = { ...input.checklist[0], result: 'NA', observation: '' };
  assert.throws(() => normalizeInspectionDraft(input));
});
test('envío requiere referencia y criterios', () => {
  assert.throws(() => assertInspectionSubmittable(normalizeInspectionDraft(draft({ technicalReference: '' }))));
  const input = draft(); input.checklist[1].criterion = '';
  assert.throws(() => assertInspectionSubmittable(normalizeInspectionDraft(input)));
});
test('dictamen requiere Dirección', () => assert.throws(() => resolveInspectionMutation(submitted(), { action: 'APPROVE', version: 2, reviewNotes: 'Conforme' }), { code: 'INSPECTION_REVIEW_FORBIDDEN' }));
test('aprobación sólo para Dirección y Administración', () => {
  assert.equal(roleHasPermission('DIRECTOR', 'org:inspections:approve'), true);
  assert.equal(roleHasPermission('ADMIN', 'org:inspections:approve'), true);
  assert.equal(roleHasPermission('SITE_MANAGER', 'org:inspections:approve'), false);
  assert.equal(roleHasPermission('AUDITOR', 'org:inspections:approve'), false);
});
test('rechaza aprobación con no conformidades', () => {
  const record = submitted(); record.checklist[0].result = 'FAIL';
  assert.throws(() => resolveInspectionMutation(record, { action: 'APPROVE', version: 2, reviewNotes: 'Conforme' }, { canReview: true }));
});
test('rechaza sobrescritura con versión antigua', () => assert.throws(() => resolveInspectionMutation(submitted(), { action: 'OBSERVE', version: 1 }, { canReview: true }), { code: 'INSPECTION_STALE' }));
test('impide modificar una inspección final', () => assert.throws(() => resolveInspectionMutation(submitted({ status: 'APPROVED' }), { action: 'SAVE_DRAFT', version: 2, draft: draft() }), { code: 'INSPECTION_LOCKED' }));
test('observada puede reabrirse y borra el dictamen activo', () => {
  const patch = resolveInspectionMutation(submitted({ status: 'OBSERVED' }), { action: 'REOPEN', version: 2 });
  assert.equal(patch.status, 'DRAFT'); assert.equal(patch.reviewedById, null);
});
test('huella determinista e independiente del orden de claves', () => {
  assert.equal(inspectionHash({ a: 1, b: [2] }), inspectionHash({ b: [2], a: 1 }));
  assert.notEqual(inspectionHash({ a: 1 }), inspectionHash({ a: 2 }));
});
function fakeDatabase() {
  const state = { records: [], revisions: [], audits: [], failAudit: false, projectStatus: 'ACTIVE' };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    $executeRawUnsafe: async () => 1,
    project: { findFirst: async ({ where }) => where.id === scope.projectId && where.organizationId === scope.organizationId ? { id: scope.projectId, organizationId: scope.organizationId, status: state.projectStatus } : null },
    inspectionRecord: {
      findFirst: async ({ where }) => structuredClone(state.records.find(row => matches(row, where)) || null),
      create: async ({ data }) => { const row = { ...structuredClone(data), createdAt: new Date(), updatedAt: new Date() }; state.records.push(row); return structuredClone(row); },
      updateMany: async ({ where, data }) => { const row = state.records.find(item => matches(item, where)); if (!row) return { count: 0 }; Object.assign(row, structuredClone(data)); return { count: 1 }; },
      findMany: async ({ where, take, skip }) => structuredClone(state.records.filter(row => matches(row, where)).slice(skip, skip + take)),
    },
    inspectionRevision: { create: async ({ data }) => { state.revisions.push(structuredClone(data)); return data; } },
    auditLog: { create: async ({ data }) => { if (state.failAudit) throw new Error('AUDIT_FAILURE'); state.audits.push(structuredClone(data)); return data; } },
  };
  return { state, prisma: { ...tx, $transaction: async operation => {
    const before = structuredClone(state);
    try { return await operation(tx); } catch (error) { Object.assign(state, before); throw error; }
  } } };
}
const createInput = () => ({ ...draft(), clientRequestId: 'inspection-test-request-0001' });
test('flujo crear, enviar y aprobar mantiene tres revisiones enlazadas', async () => {
  const { prisma, state } = fakeDatabase();
  const { record } = await createInspection(prisma, { scope, actorId: 'author', input: createInput() });
  await mutateInspection(prisma, { scope, actorId: 'author', id: record.id, input: { action: 'SUBMIT', version: 1 } });
  const approved = await mutateInspection(prisma, { scope, actorId: 'reviewer', id: record.id, input: { action: 'APPROVE', version: 2, reviewNotes: 'Control conforme al proyecto.' }, canReview: true });
  assert.equal(approved.status, 'APPROVED'); assert.equal(approved.reviewedById, 'reviewer');
  assert.equal(state.revisions.length, 3); assert.equal(state.audits.length, 3);
  assert.equal(state.revisions[1].previousHash, state.revisions[0].contentHash);
  assert.equal(state.revisions[2].previousHash, state.revisions[1].contentHash);
  assert.equal(approved.contentHash, inspectionHash({ snapshot: inspectionSnapshot(approved), previousHash: state.revisions[1].contentHash }));
});
test('idempotencia no duplica registros y detecta cambio de contenido', async () => {
  const { prisma, state } = fakeDatabase(); const options = { scope, actorId: 'author', input: createInput() };
  await createInspection(prisma, options); assert.equal((await createInspection(prisma, options)).replayed, true);
  assert.equal(state.records.length, 1); assert.equal(state.revisions.length, 1);
  await assert.rejects(createInspection(prisma, { ...options, input: { ...options.input, title: 'Otro control' } }), { code: 'INSPECTION_IDEMPOTENCY_CONFLICT' });
});
test('un tenant diferente no puede consultar ni modificar el registro', async () => {
  const { prisma } = fakeDatabase();
  const { record } = await createInspection(prisma, { scope, actorId: 'author', input: createInput() });
  const foreignScope = { ...scope, organizationId: 'org-b' };
  await assert.rejects(getInspection(prisma, { scope: foreignScope, id: record.id }), { code: 'INSPECTION_NOT_FOUND' });
  assert.equal((await listInspections(prisma, { scope: foreignScope })).records.length, 0);
  await assert.rejects(mutateInspection(prisma, { scope: foreignScope, actorId: 'foreign', id: record.id, input: { action: 'SUBMIT', version: 1 } }), { code: 'PROJECT_WRITE_SCOPE_INVALID' });
});
test('proyecto archivado queda sólo lectura', async () => {
  const { prisma, state } = fakeDatabase(); state.projectStatus = 'ARCHIVED';
  await assert.rejects(createInspection(prisma, { scope, actorId: 'author', input: createInput() }), { code: 'PROJECT_READ_ONLY' });
  assert.equal(state.records.length, 0);
});
test('fallo de auditoría revierte registro e historial', async () => {
  const { prisma, state } = fakeDatabase(); state.failAudit = true;
  await assert.rejects(createInspection(prisma, { scope, actorId: 'author', input: createInput() }), /AUDIT_FAILURE/);
  assert.equal(state.records.length, 0); assert.equal(state.revisions.length, 0);
});
test('paginación inválida rechazada', async () => {
  await assert.rejects(listInspections(fakeDatabase().prisma, { scope, page: -1 }));
});
