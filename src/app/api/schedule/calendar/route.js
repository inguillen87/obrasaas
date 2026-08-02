import { AccessError, accessErrorResponse, getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { resolveRequestCorrelationId, withCorrelationId } from '@/lib/request-correlation';
import {
  ScheduleApiError,
  assertScheduleSearchParams,
  scheduleApiErrorResponse,
  scheduleQueryValue,
} from '@/lib/schedule-api';
import {
  buildScheduleCalendarIcs,
  loadScheduleCalendar,
  scheduleCalendarErrorResponse,
} from '@/lib/schedule-calendar';

const QUERY_FIELDS = new Set(['from', 'to', 'format']);

function respond(request, response) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, resolveRequestCorrelationId(request));
}

function known(request, error) {
  if (error instanceof AccessError) return respond(request, accessErrorResponse(error));
  if (error instanceof ScheduleApiError) return respond(request, scheduleApiErrorResponse(error));
  const domain = scheduleCalendarErrorResponse(error);
  return domain ? respond(request, domain) : null;
}

function safeFilename(value) {
  return String(value || 'obra').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'obra';
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    const searchParams = new URL(request.url).searchParams;
    assertScheduleSearchParams(searchParams, QUERY_FIELDS);
    const format = String(scheduleQueryValue(searchParams, 'format') || 'json').toLowerCase();
    if (!['json', 'ics'].includes(format)) throw new ScheduleApiError('Formato de calendario invalido.');
    const calendar = await loadScheduleCalendar(getPrisma(), {
      organizationId: access.organization.id,
      projectId: access.project.id,
      from: scheduleQueryValue(searchParams, 'from'),
      to: scheduleQueryValue(searchParams, 'to'),
    });
    if (format === 'ics') {
      return respond(request, new Response(buildScheduleCalendarIcs(calendar), {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeFilename(calendar.project.slug)}-plan-quincenal.ics"`,
        },
      }));
    }
    return respond(request, Response.json(calendar));
  } catch (error) {
    return known(request, error) || respond(request, Response.json({
      error: 'No se pudo generar el calendario de obra.',
      code: 'SCHEDULE_CALENDAR_READ_FAILED',
    }, { status: 500 }));
  }
}
