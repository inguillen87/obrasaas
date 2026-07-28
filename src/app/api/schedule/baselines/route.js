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
import { listScheduleBaselines, publishScheduleBaseline } from '@/lib/schedule-snapshots';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 16 * 1024;
const LIST_FIELDS = new Set(['cursor', 'limit', 'status']);
const PUBLISH_FIELDS = new Set([
  'expectedProjectStateVersion',
  'name',
  'replaceActiveBaseline',
  'timeZone',
]);

export function createScheduleBaselineHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  listBaselines = listScheduleBaselines,
  publishBaseline = publishScheduleBaseline,
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
      const result = await listBaselines(prismaFactory(), {
        scope: scheduleScope(access),
        status: scheduleQueryValue(searchParams, 'status'),
        cursor: scheduleQueryValue(searchParams, 'cursor'),
        limit: scheduleQueryValue(searchParams, 'limit'),
      });
      return finalizeScheduleApiResponse(scheduleApiJson(result), correlationId);
    } catch (error) {
      const known = scheduleApiErrorResponse(error);
      if (known) return finalizeScheduleApiResponse(known, correlationId);
      logError('Schedule baseline list failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeScheduleApiResponse(scheduleApiJson({
        error: 'No se pudieron cargar las líneas base del cronograma.',
        code: 'SCHEDULE_BASELINE_LIST_FAILED',
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
      const input = assertScheduleObject(await parseBody(request), PUBLISH_FIELDS);
      const result = await publishBaseline(prismaFactory(), {
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
      logError('Schedule baseline publication failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeScheduleApiResponse(scheduleApiJson({
        error: 'No se pudo publicar la línea base del cronograma.',
        code: 'SCHEDULE_BASELINE_PUBLISH_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createScheduleBaselineHandlers();
