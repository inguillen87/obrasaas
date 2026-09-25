import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareWhatsAppProgressReport, createWhatsAppProgressReport } from '../src/lib/whatsapp/progress-report.js';
import { normalizeMessageReport, reportSourceKind, confirmedMessageReport, messageReportSourceId, messageReportFingerprint } from '../src/lib/whatsapp/progress-report-policy.js';
const scope = { organizationId: 'org-a', projectId: 'project-a' };
const context = { scope, actorId: 'director-a', conversationId: 'conversation-a', messageId: 'message-a' };
const makeMessage = () => ({ id: 'message-a', conversationId: 'conversation-a', externalId: 'wamid.test', direction: 'INBOUND', kind: 'TEXT', body: 'Faltan diez bolsas de cemento en el sector norte.', sentAt: new Date('2026-09-18T02:30:00Z'),
  metadata: { provider: 'meta', authorized: true, workerId: 'worker-a' }, conversation: { projectId: scope.projectId, channel: 'whatsapp', externalId: 'meta:demo-contact' } });
const org = () => ({ id: scope.organizationId, timezone: 'America/Argentina/Buenos_Aires', subscriptionPlan: 'ENTERPRISE', subscriptionStatus: 'ACTIVE' });
function database() {
  const state = { message: makeMessage(), worker: true, task: true, org: org(), projectStatus: 'ACTIVE', logs: [], audits: [], failAudit: false };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const tx = {
    $executeRawUnsafe: async () => 1,
    project: { findFirst: async ({ where }) => where.id === scope.projectId && where.organizationId === scope.organizationId ? { ...scope, status: state.projectStatus } : null },
    message: { findFirst: async ({ where }) => where.id === context.messageId && where.conversationId === context.conversationId && where.conversation.projectId === scope.projectId && where.conversation.project.organizationId === scope.organizationId ? structuredClone(state.message) : null },
    worker: { findFirst: async ({ where }) => state.worker && where.id === 'worker-a' && where.projectId === scope.projectId ? { id: 'worker-a' } : null },
    organization: { findUnique: async ({ where }) => where.id === scope.organizationId ? structuredClone(state.org) : null },
    task: { findFirst: async ({ where }) => state.task && where.id === 'task-a' && where.projectId === scope.projectId && where.type === 'TASK' && where.metadata.equals === 'canonical-task-v1' ? { id: 'task-a' } : null },
    dailyLog: {
      findFirst: async ({ where }) => structuredClone(state.logs.find(row => matches(row, where)) || null),
      create: async ({ data }) => { const row = { ...structuredClone(data), revision: 0 }; state.logs.push(row); return structuredClone(row); },
    },
    auditLog: { findFirst: async ({ where }) => structuredClone(state.audits.find(row => matches(row, where)) || null), create: async ({ data }) => { if (state.failAudit) throw new Error('audit-failure'); state.audits.push(structuredClone(data)); return data; } },
  };
  return { state, prisma: { $transaction: async operation => { const before = structuredClone(state); try { return await operation(tx); } catch (error) { Object.assign(state, before); throw error; } } } };
}
async function prepared(prisma) {
  const result = await prepareWhatsAppProgressReport(prisma, context);
  return { ...context, operationKey: 'operation-0000000001', input: { taskId: 'task-a', title: 'Material pendiente', summary: 'Revisar diez bolsas para el sector norte.', sourceVersion: result.source.version } };
}
test('preparar no escribe y conserva fecha civil y texto de origen', async () => {
  const { prisma, state } = database(); const result = await prepareWhatsAppProgressReport(prisma, context);
  assert.equal(result.source.workDate, '2026-09-17'); assert.equal(result.source.kind, 'TEXT'); assert.equal(result.source.text, state.message.body);
  assert.equal(state.logs.length, 0); assert.equal(state.audits.length, 0); assert.equal(result.existing, null);
});
test('crear produce un único borrador ligado a tarea, autor y origen', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); const result = await createWhatsAppProgressReport(prisma, request);
  assert.equal(result.report.status, 'DRAFT'); assert.equal(result.report.taskId, 'task-a'); assert.equal(state.logs[0].authorWorkerId, 'worker-a');
  assert.equal(state.logs[0].workDate.toISOString(), '2026-09-17T00:00:00.000Z'); assert.equal(state.audits[0].actorId, 'director-a');
  assert.equal(state.audits[0].metadata.messageId, context.messageId); assert.ok(!JSON.stringify(state.audits).includes(state.message.body));
});
test('respuesta perdida y otro operador no duplican el parte del mismo mensaje', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); const first = await createWhatsAppProgressReport(prisma, request);
  const replay = await createWhatsAppProgressReport(prisma, request); const another = await createWhatsAppProgressReport(prisma, { ...request, actorId: 'director-b', operationKey: 'different-operation-0001' });
  assert.equal(replay.report.id, first.report.id); assert.equal(another.report.id, first.report.id); assert.equal(another.replayed, true);
  assert.equal(state.logs.length, 1); assert.equal(state.audits.length, 1);
});
test('misma fuente con otro contenido no se duplica ni se sobreescribe', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); await createWhatsAppProgressReport(prisma, request);
  await assert.rejects(createWhatsAppProgressReport(prisma, { ...request, input: { ...request.input, summary: 'Otro resumen' } }), { code: 'WHATSAPP_REPORT_ALREADY_USED' });
  assert.equal(state.logs.length, 1);
});
test('audio sólo utiliza transcripción previamente completada', async () => {
  const { prisma, state } = database(); state.message.kind = 'AUDIO'; state.message.body = '[audio]'; state.message.metadata.transcription = { status: 'completed', text: 'Terminamos el muro norte. Falta verificar su medición.' };
  const result = await prepareWhatsAppProgressReport(prisma, context); assert.equal(result.source.kind, 'AUDIO_TRANSCRIPT'); assert.equal(result.source.text, state.message.metadata.transcription.text);
  const request = await prepared(prisma); await createWhatsAppProgressReport(prisma, request); assert.equal(state.audits[0].metadata.sourceKind, 'AUDIO_TRANSCRIPT');
});
for (const mutate of [
  message => { message.direction = 'OUTBOUND'; }, message => { message.metadata.provider = 'other'; },
  message => { message.metadata.authorized = false; }, message => { message.metadata.quarantined = true; },
  message => { message.metadata.simulated = true; }, message => { message.metadata.sensitivity = 'medical'; },
  message => { message.body = 'Tengo un diagnóstico de hepatitis'; },
  message => { message.kind = 'AUDIO'; message.metadata.transcription = { status: 'failed', text: 'No utilizar' }; },
  message => { message.kind = 'VIDEO'; }, message => { delete message.metadata.workerId; },
]) test('no permite convertir una fuente no elegible: ' + mutate.toString(), async () => {
  const { prisma, state } = database(); mutate(state.message); await assert.rejects(prepareWhatsAppProgressReport(prisma, context), { code: 'WHATSAPP_REPORT_SOURCE_UNAVAILABLE' }); assert.equal(state.logs.length, 0);
});
test('origen actualizado invalida un formulario abierto', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); state.message.body += ' Corrección posterior.';
  await assert.rejects(createWhatsAppProgressReport(prisma, request), { code: 'WHATSAPP_REPORT_SOURCE_CHANGED' }); assert.equal(state.logs.length, 0);
});
for (const override of [{ scope: { ...scope, organizationId: 'org-b' } }, { scope: { ...scope, projectId: 'project-b' } }, { messageId: 'other' }, { conversationId: 'other' }]) test('consulta fuera de alcance no revela la fuente: ' + JSON.stringify(override), async () => {
  await assert.rejects(prepareWhatsAppProgressReport(database().prisma, { ...context, ...override }), { code: 'WHATSAPP_REPORT_NOT_FOUND' });
});
test('tarea ajena o no canónica no produce un parte', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); state.task = false;
  await assert.rejects(createWhatsAppProgressReport(prisma, request), { code: 'WHATSAPP_REPORT_TASK_NOT_FOUND' }); assert.equal(state.logs.length, 0);
});
test('fallo de auditoría revierte la creación', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); state.failAudit = true;
  await assert.rejects(createWhatsAppProgressReport(prisma, request), /audit-failure/); assert.equal(state.logs.length, 0); assert.equal(state.audits.length, 0);
});
test('replay no revierte una decisión ni recrea un registro eliminado', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); await createWhatsAppProgressReport(prisma, request);
  state.logs[0].status = 'APPROVED'; state.logs[0].revision = 2;
  assert.equal((await createWhatsAppProgressReport(prisma, request)).report.status, 'APPROVED');
  state.logs = []; await assert.rejects(createWhatsAppProgressReport(prisma, request), { code: 'WHATSAPP_REPORT_GONE' }); assert.equal(state.logs.length, 0);
});
test('obra archivada y suscripción suspendida no reciben escrituras', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); state.projectStatus = 'ARCHIVED';
  await assert.rejects(createWhatsAppProgressReport(prisma, request), { code: 'PROJECT_READ_ONLY' }); state.projectStatus = 'ACTIVE'; state.org.subscriptionStatus = 'SUSPENDED';
  await assert.rejects(createWhatsAppProgressReport(prisma, request), { code: 'WHATSAPP_REPORT_READ_ONLY' }); assert.equal(state.logs.length, 0);
});
for (const override of [{ actorId: 'forged' }, { title: '' }, { sourceVersion: '' }, { summary: 'a'.repeat(3001) }, { summary: 'El operario tiene un diagnóstico de cáncer' }, { taskId: '../other' }]) test('contrato de entrada rechaza autoridad o texto inválido: ' + Object.keys(override)[0], () => {
  assert.throws(() => normalizeMessageReport({ taskId: 'task-a', title: 'Título', summary: 'Resumen', sourceVersion: 'a'.repeat(64), ...override }));
});
test('la confirmación del cliente exige obra, tarea, versión y estado válidos', async () => {
  const sourceContext = { ...scope, conversationId: context.conversationId, messageId: context.messageId };
  const input = { taskId: 'task-a', title: 'Parte', summary: 'Resumen operativo', sourceVersion: 'a'.repeat(64) };
  const expected = { ...sourceContext, reportId: await messageReportSourceId(sourceContext), taskId: input.taskId, sourceVersion: input.sourceVersion, requestFingerprint: await messageReportFingerprint(input) };
  const report = { id: expected.reportId, projectId: scope.projectId, taskId: 'task-a', status: 'DRAFT', revision: 0 };
  const payload = { context: sourceContext, sourceVersion: expected.sourceVersion, requestFingerprint: expected.requestFingerprint, report, replayed: false };
  assert.equal(confirmedMessageReport(payload, expected), report);
  for (const bad of [{}, { report: { ...report, projectId: 'other' } }, { report: { ...report, revision: -1 } }, { report: { ...report, taskId: 'other' } }]) assert.throws(() => confirmedMessageReport(bad, expected), { code: 'WHATSAPP_REPORT_UNCONFIRMED' });
  assert.equal(reportSourceKind(makeMessage()), 'TEXT');
});
test('la vista previa aplica la redacción de enlaces privados de la bandeja', async () => {
  const { prisma, state } = database(); state.message.body = 'Revisar /webview/attendance?token=synthetic-not-a-real-token';
  const result = await prepareWhatsAppProgressReport(prisma, context);
  assert.ok(!result.source.text.includes('synthetic-not-a-real-token')); assert.match(result.source.text, /omitido/); assert.equal(state.logs.length, 0);
});
test('no publica un enlace privado aportado como resumen revisado', () => {
  assert.throws(() => normalizeMessageReport({ taskId: 'task-a', title: 'Título', summary: 'Abrir /webview/attendance?token=synthetic-only', sourceVersion: 'a'.repeat(64) }), { code: 'WHATSAPP_REPORT_PRIVATE_CONTENT' });
});
test('un audio médico no se convierte aunque la transcripción esté completada', () => {
  const message = makeMessage(); message.kind = 'AUDIO'; message.body = '[audio]'; message.metadata.transcription = { status: 'completed', text: 'El certificado médico indica reposo.' };
  assert.equal(reportSourceKind(message), null);
});
test('un cambio de zona horaria invalida la fecha presentada antes de crear', async () => {
  const { prisma, state } = database(); const request = await prepared(prisma); state.org.timezone = 'UTC';
  await assert.rejects(createWhatsAppProgressReport(prisma, request), { code: 'WHATSAPP_REPORT_SOURCE_CHANGED' });
  assert.equal(state.logs.length, 0); assert.equal(state.audits.length, 0);
});
