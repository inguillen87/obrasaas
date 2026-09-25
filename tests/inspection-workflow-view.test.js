import assert from 'node:assert/strict';
import test from 'node:test';
import { INSPECTION_ACTION_LABELS, inspectionDraftChanged, inspectionReadiness, inspectionNextStep } from '../src/lib/inspection-workflow-view.js';
const draft = () => ({ templateKey: 'SEGURIDAD', title: 'Prueba', location: 'Sector demo', technicalReference: 'DEMO-01 v1', notes: '', checklist: [
  { key: 'item-1', label: 'Control', result: 'PASS', criterion: 'Criterio documentado', observation: '' },
] });
test('un control completo permite enviar sin afirmar aprobación', () => {
  const state = inspectionReadiness(draft());
  assert.deepEqual(state, { issues: [], completed: 1, total: 1, ready: true, failures: 0 });
});
test('el pendiente explica el control exacto que falta', () => {
  const value = draft(); value.checklist[0].result = 'PENDING';
  const state = inspectionReadiness(value);
  assert.equal(state.ready, false); assert.equal(state.completed, 0);
  assert.match(state.issues[0], /Control 1/);
});
test('resultado no reconocido no se presenta como completo', () => {
  const value = draft(); value.checklist[0].result = 'APPROVED';
  assert.equal(inspectionReadiness(value).ready, false);
});
test('el documento y criterio vacíos bloquean la preparación', () => {
  const value = draft(); value.technicalReference = '  '; value.checklist[0].criterion = ' ';
  assert.equal(inspectionReadiness(value).issues.length, 2);
});
for (const result of ['FAIL', 'NA']) test(result + ' requiere justificación explícita', () => {
  const value = draft(); value.checklist[0].result = result;
  assert.equal(inspectionReadiness(value).ready, false);
  value.checklist[0].observation = 'Motivo documentado';
  assert.equal(inspectionReadiness(value).ready, true);
});
test('una no conformidad puede revisarse pero no se oculta en el resumen', () => {
  const value = draft(); Object.assign(value.checklist[0], { result: 'FAIL', observation: 'Falta resolver' });
  assert.equal(inspectionReadiness(value).failures, 1);
});
test('una inspección sin controles no se presenta como lista', () => {
  assert.equal(inspectionReadiness({ ...draft(), checklist: [] }).ready, false);
});
test('título y ubicación se exigen antes de enviar', () => {
  assert.equal(inspectionReadiness({ ...draft(), title: '', location: '' }).issues.length, 2);
});
test('orden de propiedades y metadatos del servidor no generan cambios ficticios', () => {
  const base = draft();
  const reordered = { checklist: base.checklist, notes: '', location: base.location, technicalReference: base.technicalReference, title: base.title, templateKey: base.templateKey, version: 5 };
  assert.equal(inspectionDraftChanged(reordered, base), false);
});
test('editar una inspección nueva se detecta antes del primer guardado', () => {
  assert.equal(inspectionDraftChanged(draft(), { ...draft(), title: '' }), true);
});
test('la etiqueta del control no sustituye al contenido editable', () => {
  const value = draft(); value.checklist[0].label = 'Etiqueta del servidor';
  assert.equal(inspectionDraftChanged(value, draft()), false);
  value.checklist[0].observation = 'Una observación nueva';
  assert.equal(inspectionDraftChanged(value, draft()), true);
});
test('un borrador editado pide guardar antes de enviar', () => {
  assert.equal(inspectionNextStep({ record: { status: 'DRAFT' }, draft: draft(), dirty: true, canManage: true }).title, 'Guardá los cambios');
});
test('el lector no recibe instrucciones de crear o aprobar', () => {
  assert.equal(inspectionNextStep({ record: null, draft: draft(), canManage: false }).title, 'Seleccioná una inspección');
  assert.equal(inspectionNextStep({ record: { status: 'SUBMITTED' }, draft: draft(), canReview: false }).title, 'Pendiente de Dirección');
});
test('Dirección ve el dictamen y no una edición de controles enviados', () => {
  const state = inspectionNextStep({ record: { status: 'SUBMITTED' }, draft: draft(), canReview: true });
  assert.match(state.title, /dictamen/); assert.match(state.detail, /no se edita/);
});
test('observada explica el circuito de reapertura sin borrar historia', () => {
  const state = inspectionNextStep({ record: { status: 'OBSERVED' }, draft: draft(), canManage: true });
  assert.match(state.title, /Reabrí/); assert.match(state.detail, /historial/);
});
for (const status of ['APPROVED', 'REJECTED']) test(status + ' queda en solo lectura', () => {
  const state = inspectionNextStep({ record: { status }, draft: draft(), canManage: true, canReview: true });
  assert.match(state.title, /solo lectura/);
});
test('los eventos persistidos tienen una etiqueta comprensible en español', () => {
  for (const action of ['CREATE','SAVE_DRAFT','SUBMIT','APPROVE','OBSERVE','REJECT','REOPEN']) assert.ok(INSPECTION_ACTION_LABELS[action]);
});
