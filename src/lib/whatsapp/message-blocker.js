import { createHash } from 'node:crypto';
import { readWhatsAppOperationalMessageSource } from './progress-report.js';
import { reportIdentifier } from './progress-report-policy.js';
import { normalizeMessageBlocker, WhatsAppMessageBlockerError } from './message-blocker-policy.js';
import { redactSensitiveText } from '../sensitive-text.js';
import { subscriptionAllowsWrites } from '../plans.js';
import { isOperationalProjectWriteStatus, runOperationalProjectMutation } from '../project-write-policy.js';
import { createProjectBlockerInTransaction } from '../project-execution.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ACTION = 'execution.blocker.created_from_whatsapp';
function contextOf(input) {
  return { scope: { organizationId: reportIdentifier(input.scope?.organizationId), projectId: reportIdentifier(input.scope?.projectId) }, actorId: reportIdentifier(input.actorId), conversationId: reportIdentifier(input.conversationId), messageId: reportIdentifier(input.messageId) };
}
const origin = context => ({ ...context.scope, conversationId: context.conversationId, messageId: context.messageId });
function ids(context) {
  const key = digest(['whatsapp-blocker-v1', origin(context)]);
  return { recordId: 'wa_blocker_' + key, receiptId: 'wa_blocker_source_' + key };
}
function publicBlocker(row) {
  return { id: row.id, projectId: row.projectId, taskId: row.taskId, title: row.title, status: row.status, severity: row.severity,
    ownerWorkerId: row.ownerWorkerId || null, ownerTeamId: row.ownerTeamId || null, revision: row.revision };
}
async function existingIn(tx, context) {
  const { recordId, receiptId } = ids(context);
  const [record, receipt] = await Promise.all([
    tx.projectBlocker.findFirst({ where: { id: recordId, projectId: context.scope.projectId } }),
    tx.auditLog.findFirst({ where: { id: receiptId, organizationId: context.scope.organizationId, entityId: recordId, entityType: 'ProjectBlocker', action: ACTION } }),
  ]);
  if (!record && !receipt) return null;
  if (record && !receipt || receipt?.metadata?.projectId !== context.scope.projectId || receipt?.metadata?.messageId !== context.messageId || receipt?.metadata?.conversationId !== context.conversationId) throw new WhatsAppMessageBlockerError('La referencia de origen necesita revisión de integridad.', 'WHATSAPP_BLOCKER_INTEGRITY', 409);
  if (!record) throw new WhatsAppMessageBlockerError('La restricción de este mensaje ya no está disponible. No se recreó.', 'WHATSAPP_BLOCKER_GONE', 410);
  return { record, receipt };
}
export async function prepareWhatsAppMessageBlocker(prisma, input) {
  const context = contextOf(input);
  return prisma.$transaction(async tx => {
    const current = await readWhatsAppOperationalMessageSource(tx, context);
    const existing = await existingIn(tx, context);
    const project = await tx.project.findFirst({ where: { id: context.scope.projectId, organizationId: context.scope.organizationId }, select: { id: true, status: true } });
    if (!project) throw new WhatsAppMessageBlockerError('La obra no está disponible.', 'WHATSAPP_BLOCKER_PROJECT_MISSING', 404);
    const [workers, teams] = await Promise.all([
      tx.worker.findMany({ where: { projectId: context.scope.projectId, active: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 101, select: { id: true, name: true } }),
      tx.workTeam.findMany({ where: { projectId: context.scope.projectId, status: 'ACTIVE' }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 101, select: { id: true, name: true } }),
    ]);
    return { canCreate: isOperationalProjectWriteStatus(project.status) && subscriptionAllowsWrites(current.organization, new Date()), source: { ...origin(context), kind: current.kind, text: redactSensitiveText(current.text), version: current.version, sentAt: new Date(current.message.sentAt).toISOString() },
      existing: existing ? publicBlocker(existing.record) : null, owners: { workers: workers.slice(0,100), teams: teams.slice(0,100), truncated: workers.length > 100 || teams.length > 100 } };
  }, { isolationLevel: 'RepeatableRead', timeout: 10000 });
}
export async function createWhatsAppMessageBlocker(prisma, options) {
  const context = contextOf(options), input = normalizeMessageBlocker(options.input);
  if (typeof options.operationKey !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(options.operationKey)) throw new WhatsAppMessageBlockerError('La solicitud requiere una clave de operación válida.');
  const { recordId, receiptId } = ids(context);
  return runOperationalProjectMutation(prisma, context.scope, async tx => {
    const current = await readWhatsAppOperationalMessageSource(tx, context);
    if (!subscriptionAllowsWrites(current.organization, new Date())) throw new WhatsAppMessageBlockerError('La empresa no admite escrituras nuevas.', 'WHATSAPP_BLOCKER_READ_ONLY', 402);
    if (current.version !== input.sourceVersion) throw new WhatsAppMessageBlockerError('El mensaje cambió. Volvé a revisar su contenido.', 'WHATSAPP_BLOCKER_SOURCE_CHANGED', 409);
    const existing = await existingIn(tx, context), fingerprint = digest(input);
    if (existing) {
      if (existing.receipt.metadata.requestFingerprint !== fingerprint) throw new WhatsAppMessageBlockerError('Este mensaje ya tiene una restricción con otro contenido. Abrí la existente.', 'WHATSAPP_BLOCKER_ALREADY_USED', 409);
      return { blocker: publicBlocker(existing.record), source: origin(context), replayed: true };
    }
    const task = await tx.task.findFirst({ where: { id: input.taskId, projectId: context.scope.projectId, type: 'TASK', metadata: { path: ['source'], equals: 'canonical-task-v1' } }, select: { id: true } });
    if (!task) throw new WhatsAppMessageBlockerError('La actividad no está disponible en esta obra.', 'WHATSAPP_BLOCKER_TASK_SCOPE', 404);
    const created = await createProjectBlockerInTransaction(tx, { scope: context.scope, actorId: context.actorId, recordId,
      input: { kind: 'BLOCKER', title: input.title, description: input.description, taskId: input.taskId, ownerWorkerId: input.ownerWorkerId, ownerTeamId: input.ownerTeamId, severity: input.severity, status: 'OPEN' } });
    await tx.auditLog.create({ data: { id: receiptId, organizationId: context.scope.organizationId, actorId: context.actorId,
      action: ACTION, entityType: 'ProjectBlocker', entityId: recordId, metadata: { ...origin(context), sourceKind: current.kind,
        sourceVersion: current.version, requestFingerprint: fingerprint, operationKeyHash: digest(options.operationKey) } } });
    return { blocker: publicBlocker(created.blocker), source: origin(context), replayed: false };
  });
}
