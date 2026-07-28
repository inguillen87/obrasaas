import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';
import {
  assertScheduleObject,
  assertScheduleSearchParams,
  finalizeScheduleApiResponse,
  requireScheduleIdempotencyKey,
  scheduleApiErrorResponse,
  scheduleApiJson,
  scheduleQueryValue,
  scheduleScope,
} from '@/lib/schedule-api';
import { calculateScheduleForecast, listScheduleForecastRuns } from '@/lib/schedule-snapshots';

export const runtime = 'nodejs';

// A worst-case 5,000-task request with bounded 190-character source IDs can
// exceed 2 MiB after JSON escaping. Keep the application cap below common
// serverless ingress limits while honoring the domain maximum.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const LIST_FIELDS = new Set(['baselineId', 'cursor', 'limit']);
const CALCULATE_FIELDS = new Set([
  'asOfDate',
  'baselineId',
  'expectedProjectStateVersion',
  'observations',
]);

export function createScheduleForecastHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  listForecasts = listScheduleForecastRuns,
  calculateForecast = calculateScheduleForecast,
  parseBody = (request) => readJsonRequest(request, { maxBytes: MAX_BODY_BYTES }),
  resolveCorrelationId = resolveRequestCorrelationId,
  logError = console.error,
} = {}) {
  async function GET(request) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:tasks:read', { subscriptionMode: 'read' });
      const searchParams = new URL(request.url).searchParams;
      assertScheduleSearchParams(searchParams, LIST_FIELDS);
      const result = await listForecasts(prismaFactory(), {
        scope: scheduleScope(access),
        baselineId: scheduleQueryValue(searchParams, 'baselineId'),
        cursor: scheduleQueryValue(searchParams, 'cursor'),
        limit: scheduleQueryValue(searchParams, 'limit'),
      });
      return finalizeScheduleApiResponse(scheduleApiJson(result), correlationId);
    } catch (error) {
      const known = scheduleApiErrorResponse(error);
      if (known) return finalizeScheduleApiResponse(known, correlationId);
      logError('Schedule forecast list failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeScheduleApiResponse(scheduleApiJson({
        error: 'No se pudieron cargar los pronósticos del cronograma.',
        code: 'SCHEDULE_FORECAST_LIST_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  async function POST(request) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:tasks:manage', { subscriptionMode: 'write' });
      const searchParams = new URL(request.url).searchParams;
      assertScheduleSearchParams(searchParams, new Set());
      const idempotencyKey = requireScheduleIdempotencyKey(request);
      const input = assertScheduleObject(await parseBody(request), CALCULATE_FIELDS);
      const result = await calculateForecast(prismaFactory(), {
        scope: scheduleScope(access),
        actorId: access.databaseUserId,
        idempotencyKey,
        input,
      });
      return finalizeScheduleApiResponse(scheduleApiJson(result, {
        status: result.replayed ? 200 : 201,
        headers: { 'Idempotency-Replayed': String(result.replayed) },
      }), correlationId);
    } catch (error) {
      const known = scheduleApiErrorResponse(error);
      if (known) return finalizeScheduleApiResponse(known, correlationId);
      logError('Schedule forecast calculation failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeScheduleApiResponse(scheduleApiJson({
        error: 'No se pudo calcular el pronóstico del cronograma.',
        code: 'SCHEDULE_FORECAST_CALCULATE_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createScheduleForecastHandlers();
