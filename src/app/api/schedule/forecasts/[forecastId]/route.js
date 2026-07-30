import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';
import {
  assertScheduleSearchParams,
  finalizeScheduleApiResponse,
  scheduleApiErrorResponse,
  scheduleApiJson,
  scheduleScope,
} from '@/lib/schedule-api';
import { getScheduleForecastRun } from '@/lib/schedule-snapshots';

export const runtime = 'nodejs';

export function createScheduleForecastDetailHandler({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  getForecast = getScheduleForecastRun,
  resolveCorrelationId = resolveRequestCorrelationId,
  logError = console.error,
} = {}) {
  return async function GET(request, { params }) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:tasks:read', { subscriptionMode: 'read' });
      assertScheduleSearchParams(new URL(request.url).searchParams, new Set());
      const { forecastId } = await params;
      const result = await getForecast(prismaFactory(), {
        scope: scheduleScope(access),
        forecastId,
      });
      return finalizeScheduleApiResponse(scheduleApiJson(result), correlationId);
    } catch (error) {
      const known = scheduleApiErrorResponse(error);
      if (known) return finalizeScheduleApiResponse(known, correlationId);
      logError('Schedule forecast detail failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeScheduleApiResponse(scheduleApiJson({
        error: 'No se pudo cargar el detalle del pronóstico.',
        code: 'SCHEDULE_FORECAST_DETAIL_FAILED',
      }, { status: 500 }), correlationId);
    }
  };
}

export const GET = createScheduleForecastDetailHandler();
