import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  acknowledgeAttendanceAlert,
  attendanceControlErrorResponse,
} from '@/lib/attendance-control';
import { attendanceExpectationErrorResponse } from '@/lib/attendance-expectations';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';

import {
  AttendanceApiError,
  attendanceApiErrorResponse,
  attendanceJson,
  attendanceScope,
  MAX_ATTENDANCE_JSON_BYTES,
  requireAttendanceRouteId,
} from '../../../_shared';

export const runtime = 'nodejs';

async function assertEmptyOptionalBody(request) {
  if (!request.body) return;
  const input = await readJsonRequest(request, {
    maxBytes: MAX_ATTENDANCE_JSON_BYTES,
  });
  if (
    !input
    || typeof input !== 'object'
    || Array.isArray(input)
    || Object.keys(input).length > 0
  ) {
    throw new AttendanceApiError('Esta operación no admite campos en el cuerpo.', {
      code: 'ATTENDANCE_ALERT_BODY_INVALID',
      status: 400,
    });
  }
}

export async function POST(request, context) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:alerts:acknowledge', {
      subscriptionMode: 'write',
    });
    const { alertId: rawAlertId } = await context.params;
    const alertId = requireAttendanceRouteId(rawAlertId, 'alertId');
    await assertEmptyOptionalBody(request);
    const result = await acknowledgeAttendanceAlert(getPrisma(), {
      scope: attendanceScope(access),
      alertEventId: alertId,
      actorId: access.databaseUserId,
    });
    return attendanceJson(result);
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'alert.acknowledge',
      fallbackMessage: 'No se pudo confirmar la alerta de asistencia.',
      fallbackCode: 'ATTENDANCE_ALERT_ACKNOWLEDGE_FAILED',
      domainErrorResponses: [
        attendanceControlErrorResponse,
        attendanceExpectationErrorResponse,
      ],
    });
  }
}
