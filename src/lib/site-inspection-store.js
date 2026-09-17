import { randomUUID } from 'node:crypto';
import { runOperationalProjectMutation } from './project-write-policy.js';
import { InspectionError, trustedInspectionScope, normalizeInspectionDraft, resolveInspectionMutation, inspectionHash, inspectionSnapshot } from './site-inspections.js';

export async function listInspections(prisma, { scope, page = 0 }) {
  const trusted = trustedInspectionScope(scope);
  if (!Number.isSafeInteger(page) || page < 0 || page > 200) throw new InspectionError('Página inválida.');
  const rows = await prisma.inspectionRecord.findMany({ where: trusted, select: { id: true, title: true, location: true, status: true, version: true, templateKey: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: page * 50, take: 51 });
  return { records: rows.slice(0, 50), hasMore: rows.length > 50, page };
}
export async function getInspection(prisma, { scope, id }) {
  const trusted = trustedInspectionScope(scope);
  if (typeof id !== 'string' || !id || id.length > 190) throw new InspectionError('Identificador inválido.');
  const record = await prisma.inspectionRecord.findFirst({ where: { ...trusted, id }, include: { revisions: { orderBy: { version: 'desc' }, take: 20 } } });
  if (!record) throw new InspectionError('Inspección no disponible en esta obra.', 'INSPECTION_NOT_FOUND', 404);
  return record;
}
function requireActor(actorId) {
  if (typeof actorId !== 'string' || !actorId || actorId.length > 190) throw new InspectionError('Identidad no disponible.', 'INSPECTION_ACTOR_REQUIRED', 403);
  return actorId;
}
async function appendRevision(tx, record, action, actorId, previousHash = null) {
  const snapshot = inspectionSnapshot(record);
  const contentHash = inspectionHash({ snapshot, previousHash });
  await tx.inspectionRevision.create({ data: { organizationId: record.organizationId, projectId: record.projectId, inspectionId: record.id, version: record.version, action, actorId, snapshot, contentHash, previousHash } });
  await tx.auditLog.create({ data: { organizationId: record.organizationId, actorId, action: 'INSPECTION_' + action, entityType: 'InspectionRecord', entityId: record.id, metadata: { projectId: record.projectId, version: record.version, contentHash } } });
  return contentHash;
}
export async function createInspection(prisma, { scope, actorId, input }) {
  const trusted = trustedInspectionScope(scope);
  requireActor(actorId);
  const draft = normalizeInspectionDraft(input);
  const clientRequestId = input.clientRequestId;
  if (typeof clientRequestId !== 'string' || !/^[a-zA-Z0-9_-]{16,96}$/.test(clientRequestId)) throw new InspectionError('La solicitud requiere una clave de idempotencia válida.');
  const requestHash = inspectionHash(draft);
  return runOperationalProjectMutation(prisma, trusted, async tx => {
    const existing = await tx.inspectionRecord.findFirst({ where: { ...trusted, clientRequestId } });
    if (existing) {
      if (existing.requestHash !== requestHash || existing.createdById !== actorId) throw new InspectionError('La clave ya se usó para otra solicitud.', 'INSPECTION_IDEMPOTENCY_CONFLICT', 409);
      return { record: existing, replayed: true };
    }
    const data = { ...trusted, ...draft, id: randomUUID(), clientRequestId, requestHash, createdById: actorId, status: 'DRAFT', version: 1 };
    data.contentHash = inspectionHash({ snapshot: inspectionSnapshot(data), previousHash: null });
    const record = await tx.inspectionRecord.create({ data });
    await appendRevision(tx, record, 'CREATE', actorId);
    return { record, replayed: false };
  });
}
export async function mutateInspection(prisma, { scope, actorId, id, input, canReview = false }) {
  const trusted = trustedInspectionScope(scope);
  requireActor(actorId);
  if (typeof id !== 'string' || !id || id.length > 190) throw new InspectionError('Identificador inválido.');
  return runOperationalProjectMutation(prisma, trusted, async tx => {
    const current = await tx.inspectionRecord.findFirst({ where: { ...trusted, id } });
    if (!current) throw new InspectionError('Inspección no disponible en esta obra.', 'INSPECTION_NOT_FOUND', 404);
    const patch = resolveInspectionMutation(current, input, { canReview });
    if (['APPROVE', 'OBSERVE', 'REJECT'].includes(input.action)) {
      patch.reviewedById = actorId;
      patch.reviewedAt = new Date();
    }
    patch.version = current.version + 1;
    patch.contentHash = inspectionHash({ snapshot: inspectionSnapshot({ ...current, ...patch }), previousHash: current.contentHash });
    const result = await tx.inspectionRecord.updateMany({ where: { ...trusted, id, version: input.version }, data: patch });
    if (result.count !== 1) throw new InspectionError('La inspección cambió. Actualizá antes de guardar.', 'INSPECTION_STALE', 409);
    const record = await tx.inspectionRecord.findFirst({ where: { ...trusted, id } });
    await appendRevision(tx, record, input.action, actorId, current.contentHash);
    return record;
  });
}
