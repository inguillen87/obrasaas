import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  attendanceExpectationErrorResponse,
  setAttendanceException,
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

function sanitizedException(result) {
  const { note, ...exception } = result.exception;
  return {
    ...result,
    exception: {
      ...exception,
      hasNote: Boolean(note),
    },
  };
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:exceptions:manage', {
      subscriptionMode: 'write',
    });
    const idempotencyKey = requireAttendanceIdempotencyKey(request);
    const input = await readJsonRequest(request, {
      maxBytes: MAX_ATTENDANCE_JSON_BYTES,
    });
    const result = await setAttendanceException(getPrisma(), {
      scope: attendanceScope(access),
      workerId: input?.workerId,
      workDate: input?.workDate,
      expectedRevision: input?.expectedRevision ?? 0,
      idempotencyKey,
      actorId: access.databaseUserId,
      input,
    });
    return attendanceJson(sanitizedException(result), {
      status: result.replayed ? 200 : 201,
    });
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'exception.set',
      fallbackMessage: 'No se pudo actualizar la excepción de asistencia.',
      fallbackCode: 'ATTENDANCE_EXCEPTION_UPDATE_FAILED',
      domainErrorResponses: [attendanceExpectationErrorResponse],
    });
  }
}
