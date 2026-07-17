export const WEEKLY_REPORT_RATE_LIMITS = Object.freeze({
  actorPerMinute: 6,
  organizationPerDay: 300,
});
export const WEEKLY_REPORT_REQUEST_ACTION = 'report.weekly.requested';

export class WeeklyReportRateLimitError extends Error {
  constructor(message, { code, retryAfterSeconds }) {
    super(message);
    this.name = 'WeeklyReportRateLimitError';
    this.code = code;
    this.status = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function assertWeeklyReportRateLimits({
  actorMinuteCount,
  organizationDayCount,
  organizationRetryAfterSeconds = 86_400,
}) {
  if (Number(actorMinuteCount) >= WEEKLY_REPORT_RATE_LIMITS.actorPerMinute) {
    throw new WeeklyReportRateLimitError(
      'Generaste varios reportes en poco tiempo. Esperá un minuto antes de emitir otro PDF.',
      { code: 'REPORT_ACTOR_RATE_LIMIT', retryAfterSeconds: 60 },
    );
  }
  if (Number(organizationDayCount) >= WEEKLY_REPORT_RATE_LIMITS.organizationPerDay) {
    throw new WeeklyReportRateLimitError(
      'La organización alcanzó el límite diario de reportes. Intentá nuevamente más tarde.',
      {
        code: 'REPORT_ORGANIZATION_RATE_LIMIT',
        retryAfterSeconds: Math.max(1, Math.ceil(Number(organizationRetryAfterSeconds) || 86_400)),
      },
    );
  }
}

export async function reserveWeeklyReportRateLimit(transaction, {
  organizationId,
  actorId = null,
  projectId,
  now = new Date(),
}) {
  if (!organizationId || !projectId) {
    throw new TypeError('A trusted organization and project are required to reserve a report.');
  }
  const parsedNow = new Date(now);
  const safeNow = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;

  await transaction.$executeRawUnsafe("SET LOCAL lock_timeout = '3000ms'");
  await transaction.$executeRawUnsafe(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    `obrasaas:weekly-report-rate:${organizationId}`,
  );

  const [actorMinuteCount, organizationDayCount] = await Promise.all([
    transaction.auditLog.count({
      where: {
        organizationId,
        ...(actorId ? { actorId } : {}),
        action: WEEKLY_REPORT_REQUEST_ACTION,
        createdAt: { gte: new Date(safeNow.getTime() - 60_000) },
      },
    }),
    transaction.auditLog.count({
      where: {
        organizationId,
        action: WEEKLY_REPORT_REQUEST_ACTION,
        createdAt: { gte: new Date(safeNow.getTime() - (24 * 60 * 60 * 1_000)) },
      },
    }),
  ]);
  let organizationRetryAfterSeconds = 86_400;
  if (organizationDayCount >= WEEKLY_REPORT_RATE_LIMITS.organizationPerDay) {
    const oldestRequest = await transaction.auditLog.findFirst({
      where: {
        organizationId,
        action: WEEKLY_REPORT_REQUEST_ACTION,
        createdAt: { gte: new Date(safeNow.getTime() - (24 * 60 * 60 * 1_000)) },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (oldestRequest?.createdAt) {
      const retryAt = new Date(oldestRequest.createdAt).getTime() + (24 * 60 * 60 * 1_000);
      organizationRetryAfterSeconds = Math.min(
        86_400,
        Math.max(1, Math.ceil((retryAt - safeNow.getTime()) / 1_000)),
      );
    }
  }
  assertWeeklyReportRateLimits({
    actorMinuteCount,
    organizationDayCount,
    organizationRetryAfterSeconds,
  });

  await transaction.auditLog.create({
    data: {
      organizationId,
      actorId,
      action: WEEKLY_REPORT_REQUEST_ACTION,
      entityType: 'WeeklyReport',
      entityId: projectId,
      metadata: {
        projectId,
        requestedAt: safeNow.toISOString(),
        format: 'pdf',
      },
    },
  });
}

export function weeklyReportRateLimitResponse(error) {
  if (!(error instanceof WeeklyReportRateLimitError)) return null;
  return Response.json({
    error: error.message,
    code: error.code,
  }, {
    status: error.status,
    headers: { 'Retry-After': String(error.retryAfterSeconds) },
  });
}
