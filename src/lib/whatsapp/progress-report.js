import { redactSensitiveText } from '../sensitive-text.js';
import { createHash } from 'node:crypto';
import { localDateKey } from '../zoned-time.js';
import { subscriptionAllowsWrites } from '../plans.js';
import { runOperationalProjectMutation } from '../project-write-policy.js';
import { normalizeMessageReport, reportSourceKind, reportIdentifier, messageReportRecordMatches, WhatsAppProgressReportError } from './progress-report-policy.js';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const publicLog = row => ({ id: row.id, projectId: row.projectId, taskId: row.taskId, status: row.status, revision: row.revision });
const publicContext = context => ({ ...context.scope, conversationId: context.conversationId, messageId: context.messageId });
const missing = () => new WhatsAppProgressReportError('Mensaje no disponible para crear un parte en esta obra.', 'WHATSAPP_REPORT_NOT_FOUND', 404);
function identity({ scope, actorId, conversationId, messageId }) {
  return { scope: { organizationId: reportIdentifier(scope?.organizationId), projectId: reportIdentifier(scope?.projectId) }, actorId: reportIdentifier(actorId), conversationId: reportIdentifier(conversationId), messageId: reportIdentifier(messageId) };
}
function ids(context) {
  const digest = hash(['whatsapp-report-source-v1', context.scope.organizationId, context.scope.projectId, context.conversationId, context.messageId]);
  return { reportId: 'wa_report_' + digest, receiptId: 'wa_report_source_' + digest };
}
async function source(tx, context) {
  const { scope, conversationId, messageId } = context;
  const message = await tx.message.findFirst({ where: { id: messageId, conversationId, conversation: { projectId: scope.projectId, channel: 'whatsapp', project: { organizationId: scope.organizationId } } }, select: {
    id: true, conversationId: true, externalId: true, direction: true, kind: true, body: true, metadata: true, sentAt: true,
    conversation: { select: { externalId: true, projectId: true, channel: true } },
  } });
  if (!message || !String(message.conversation?.externalId || '').startsWith('meta:')) throw missing();
  const kind = reportSourceKind(message);
  if (!kind) throw new WhatsAppProgressReportError('Se requiere un texto operativo autorizado o un audio con transcripción completa. Los contenidos sensibles no se convierten en partes.', 'WHATSAPP_REPORT_SOURCE_UNAVAILABLE', 409);
  const text = (kind === 'TEXT' ? message.body : message.metadata.transcription.text).trim().replace(/\r\n/g, '\n');
  const sentAt = new Date(message.sentAt);
  if (!message.sentAt || !text || text.length > 16000 || !Number.isFinite(sentAt.getTime())) throw new WhatsAppProgressReportError('El origen no tiene texto o fecha utilizables.', 'WHATSAPP_REPORT_SOURCE_UNAVAILABLE', 409);
  const [worker, organization] = await Promise.all([
    tx.worker.findFirst({ where: { id: message.metadata.workerId, projectId: scope.projectId }, select: { id: true } }),
    tx.organization.findUnique({ where: { id: scope.organizationId }, select: { id: true, timezone: true, subscriptionPlan: true, subscriptionStatus: true, trialEndsAt: true } }),
  ]);
  if (!worker || !organization) throw missing();
  const workDate = localDateKey(sentAt, organization.timezone);
  const version = hash(['whatsapp-report-content-v1', scope, message.id, message.externalId, kind, worker.id, sentAt.toISOString(), organization.timezone, workDate, text]);
  return { message, organization, worker, kind, text, workDate, version };
}
function checkedReceipt(context, current, existing, receipt) {
  const { reportId, receiptId } = ids(context), meta = receipt?.metadata;
  if (!existing && !receipt) return null;
  if (!existing) throw new WhatsAppProgressReportError('El parte original ya no está disponible; no se recreó.', 'WHATSAPP_REPORT_GONE', 410);
  if (!receipt || receipt.id !== receiptId || receipt.organizationId !== context.scope.organizationId
    || receipt.entityId !== reportId || receipt.entityType !== 'DailyLog' || receipt.action !== 'progress.daily_log.created_from_whatsapp'
    || meta?.source !== 'whatsapp-report-v1' || meta.projectId !== context.scope.projectId
    || meta.conversationId !== context.conversationId || meta.messageId !== context.messageId
    || meta.workerId !== current.worker.id || typeof meta.taskId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(meta.taskId) || !['TEXT','AUDIO_TRANSCRIPT'].includes(meta.sourceKind)
    || typeof meta.sourceVersion !== 'string' || !/^[a-f0-9]{64}$/.test(meta.sourceVersion)
    || typeof meta.requestFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(meta.requestFingerprint)
    || !messageReportRecordMatches(publicLog(existing), { projectId: context.scope.projectId, reportId, taskId: meta.taskId })
    || existing.authorWorkerId !== current.worker.id) {
    throw new WhatsAppProgressReportError('El vínculo entre mensaje, recibo y parte requiere revisión de integridad.', 'WHATSAPP_REPORT_INTEGRITY', 409);
  }
  return { sourceVersion: meta.sourceVersion, requestFingerprint: meta.requestFingerprint };
}
const receiptWhere = context => ({ id: ids(context).receiptId, organizationId: context.scope.organizationId, entityId: ids(context).reportId, entityType: 'DailyLog' });
export async function prepareWhatsAppProgressReport(prisma, input) {
  const context = identity(input);
  return prisma.$transaction(async tx => {
    const current = await source(tx, context);
    const existing = await tx.dailyLog.findFirst({ where: { id: ids(context).reportId, projectId: context.scope.projectId } });
    const receipt = await tx.auditLog.findFirst({ where: receiptWhere(context) });
    const existingReceipt = checkedReceipt(context, current, existing, receipt);
    return { context: publicContext(context), reportId: ids(context).reportId, source: { id: context.messageId, conversationId: context.conversationId, projectId: context.scope.projectId,
      kind: current.kind, text: redactSensitiveText(current.text), sentAt: current.message.sentAt.toISOString(), workDate: current.workDate, version: current.version },
      existing: existing ? publicLog(existing) : null, existingReceipt };
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
export async function createWhatsAppProgressReport(prisma, options) {
  const context = identity(options), input = normalizeMessageReport(options.input);
  if (typeof options.operationKey !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(options.operationKey)) throw new WhatsAppProgressReportError('La solicitud necesita una clave de operación válida.');
  const { reportId, receiptId } = ids(context);
  return runOperationalProjectMutation(prisma, context.scope, async tx => {
    const current = await source(tx, context);
    if (!subscriptionAllowsWrites(current.organization, new Date())) throw new WhatsAppProgressReportError('La empresa no admite nuevas escrituras.', 'WHATSAPP_REPORT_READ_ONLY', 402);
    if (current.version !== input.sourceVersion) throw new WhatsAppProgressReportError('El mensaje de origen cambió. Revisalo nuevamente antes de registrar el parte.', 'WHATSAPP_REPORT_SOURCE_CHANGED', 409);
    const fingerprint = hash(input);
    const existing = await tx.dailyLog.findFirst({ where: { id: reportId, projectId: context.scope.projectId } });
    const receipt = await tx.auditLog.findFirst({ where: { id: receiptId, organizationId: context.scope.organizationId, entityId: reportId, entityType: 'DailyLog' } });
    if (receipt) {
      checkedReceipt(context, current, existing, receipt);
      if (receipt.metadata?.requestFingerprint !== fingerprint || receipt.metadata?.sourceVersion !== input.sourceVersion) throw new WhatsAppProgressReportError('Este mensaje ya originó un parte con otro contenido. Consultá el registro existente.', 'WHATSAPP_REPORT_ALREADY_USED', 409);
      if (!existing) throw new WhatsAppProgressReportError('El parte original ya no está disponible; no se recreó.', 'WHATSAPP_REPORT_GONE', 410);
      return { context: publicContext(context), sourceVersion: input.sourceVersion, requestFingerprint: fingerprint, report: publicLog(existing), replayed: true };
    }
    if (existing) throw new WhatsAppProgressReportError('El registro requiere revisión de integridad.', 'WHATSAPP_REPORT_INTEGRITY', 409);
    const task = await tx.task.findFirst({ where: { id: input.taskId, projectId: context.scope.projectId, type: 'TASK', metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } });
    if (!task) throw new WhatsAppProgressReportError('La tarea no está disponible en esta obra.', 'WHATSAPP_REPORT_TASK_NOT_FOUND', 404);
    const report = await tx.dailyLog.create({ data: { id: reportId, projectId: context.scope.projectId, taskId: task.id,
      authorWorkerId: current.worker.id, workDate: new Date(current.workDate + 'T00:00:00.000Z'), title: input.title, summary: input.summary, status: 'DRAFT' } });
    await tx.auditLog.create({ data: { id: receiptId, organizationId: context.scope.organizationId, actorId: context.actorId,
      action: 'progress.daily_log.created_from_whatsapp', entityType: 'DailyLog', entityId: report.id,
      metadata: { projectId: context.scope.projectId, taskId: task.id, source: 'whatsapp-report-v1', sourceKind: current.kind,
        conversationId: context.conversationId, messageId: context.messageId, workerId: current.worker.id,
        sourceVersion: current.version, requestFingerprint: fingerprint, operationKeyHash: hash(options.operationKey) } } });
    return { context: publicContext(context), sourceVersion: input.sourceVersion, requestFingerprint: fingerprint, report: publicLog(report), replayed: false };
  });
}

// Reused operational source validation; mutations stay in their own domain.
export { source as readWhatsAppOperationalMessageSource };
