import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  attendanceExpectationErrorResponse,
  publishAttendanceSchedule,
} from '@/lib/attendance-expectations';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';

import {
  attendanceApiErrorResponse,
  attendanceJson,
  attendanceScope,
  MAX_ATTENDANCE_JSON_BYTES,
  requireAttendanceIdempotencyKey,
} from '../_shared';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:schedules:manage', {
      subscriptionMode: 'write',
    });
    const idempotencyKey = requireAttendanceIdempotencyKey(request);
    const input = await readJsonRequest(request, {
      maxBytes: MAX_ATTENDANCE_JSON_BYTES,
    });
    const result = await publishAttendanceSchedule(getPrisma(), {
      scope: attendanceScope(access),
      scheduleId: input?.scheduleId ?? null,
      expectedRevision: input?.expectedRevision ?? 0,
      idempotencyKey,
      actorId: access.databaseUserId,
      input,
    });
    return attendanceJson(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'schedule.publish',
      fallbackMessage: 'No se pudo publicar el horario.',
      fallbackCode: 'ATTENDANCE_SCHEDULE_PUBLISH_FAILED',
      domainErrorResponses: [attendanceExpectationErrorResponse],
    });
  }
}
