import { createHash } from 'node:crypto';
import { runOperationalProjectMutation } from './project-write-policy.js';
import { FieldReportError, normalizeFieldReport, fieldReportAsDailyLog } from './field-report.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const present = value => typeof value === 'string' && value.trim() && value.length <= 190;
const publicReport = item => ({ id: item.id, title: item.title, status: item.status, revision: item.revision });
export async function createFieldReport(prisma, { scope, actorId, operationKey, input }) {
  const report = normalizeFieldReport(input);
  if (!present(actorId) || !present(scope?.organizationId) || !present(scope?.projectId)) {
    throw new FieldReportError('La identidad y la obra deben estar verificadas.', 'FIELD_SCOPE_REQUIRED', 403);
  }
  if (report.projectId !== scope.projectId) {
    throw new FieldReportError('Cambiaste de obra. Volvé a abrir Campo móvil antes de guardar.', 'FIELD_PROJECT_CHANGED', 409);
  }
  if (typeof operationKey !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(operationKey)) {
    throw new FieldReportError('La solicitud necesita una clave de operación válida.');
  }
  const operationHash = hash(['field-report-v1', scope.organizationId, scope.projectId, actorId, operationKey]);
  const id = 'field_' + operationHash, receiptId = 'fieldop_' + operationHash;
  const fingerprint = hash(report);
  return runOperationalProjectMutation(prisma, scope, async tx => {
    const receipt = await tx.auditLog.findFirst({ where: { id: receiptId, organizationId: scope.organizationId, actorId, entityId: id, entityType: 'DailyLog' } });
    const existing = await tx.dailyLog.findFirst({ where: { id, projectId: scope.projectId } });
    if (receipt) {
      if (receipt.metadata?.fingerprint !== fingerprint) throw new FieldReportError('La operación ya se usó para otro contenido.', 'FIELD_REPLAY_CONFLICT', 409);
      if (!existing) throw new FieldReportError('El parte ya no está disponible. No se recreó.', 'FIELD_REPORT_GONE', 410);
      return { report: publicReport(existing), replayed: true };
    }
    if (existing) throw new FieldReportError('La operación requiere revisión de integridad.', 'FIELD_RECEIPT_MISSING', 409);
    const created = await tx.dailyLog.create({ data: {
      id, projectId: scope.projectId, ...fieldReportAsDailyLog(report), status: 'DRAFT',
    } });
    await tx.auditLog.create({ data: {
      id: receiptId, organizationId: scope.organizationId, actorId,
      action: 'progress.daily_log.created', entityType: 'DailyLog', entityId: id,
      metadata: { projectId: scope.projectId, source: 'field-mobile-v1', category: report.category, fingerprint },
    } });
    return { report: publicReport(created), replayed: false };
  });
}
