const REQUESTED = 'integration.whatsapp.platform_preflight.requested';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export class MetaPreflightRateError extends Error {
  constructor() { super('Esperá un minuto antes de volver a comprobar Meta.'); this.status = 429; this.code = 'META_PREFLIGHT_RATE_LIMIT'; }
}
export async function reserveMetaPreflight(prisma, { organizationId, projectId, actorId, now = new Date() }) {
  if (![organizationId, projectId, actorId].every(value => typeof value === 'string' && ID.test(value))) throw new TypeError('Trusted preflight scope required');
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', 'obrasaas:meta-preflight:' + actorId);
    const count = await tx.auditLog.count({ where: { actorId, action: REQUESTED, createdAt: { gte: new Date(now.getTime() - 60000) } } });
    if (count >= 3) throw new MetaPreflightRateError();
    const project = await tx.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
    if (!project) throw new TypeError('Authorized project required');
    const request = await tx.auditLog.create({ data: { organizationId, actorId, action: REQUESTED, entityType: 'Project', entityId: projectId,
      metadata: { projectId, kind: 'READ_ONLY_META_CONFIGURATION', requestedAt: now.toISOString() } }, select: { id: true } });
    return { id: request.id };
  }, { timeout: 10000 });
}
export async function recordMetaPreflight(prisma, { organizationId, projectId, actorId, requestId, report }) {
  const auth = report.authentication, webhook = report.webhook;
  if (!/^[A-Z_]{3,80}$/.test(auth?.code || '') || !/^[A-Z_]{3,80}$/.test(webhook?.code || '')) throw new TypeError('Public result codes required');
  await prisma.auditLog.create({ data: { organizationId, actorId, action: 'integration.whatsapp.platform_preflight.checked', entityType: 'Project', entityId: projectId,
    metadata: { projectId, requestId, authenticationCode: auth.code, webhookCode: webhook.code, checkedAt: report.checkedAt, provesOperationalTraffic: false } } });
}
