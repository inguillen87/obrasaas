import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import {
  attendanceCorrectionErrorResponse,
  decideAttendanceCorrection,
} from '@/lib/attendance-corrections';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';

import {
  attendanceApiErrorResponse,
  attendanceJson,
  attendanceScope,
  MAX_ATTENDANCE_JSON_BYTES,
  requireAttendanceIdempotencyKey,
  requireAttendanceRouteId,
} from '../../../_shared';

export const runtime = 'nodejs';

export async function POST(request, context) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:corrections:approve', {
      subscriptionMode: 'write',
    });
    const { correctionId: rawCorrectionId } = await context.params;
    const correctionId = requireAttendanceRouteId(rawCorrectionId, 'correctionId');
    const idempotencyKey = requireAttendanceIdempotencyKey(request);
    const input = await readJsonRequest(request, {
      maxBytes: MAX_ATTENDANCE_JSON_BYTES,
    });
    const correction = await decideAttendanceCorrection(getPrisma(), {
      scope: attendanceScope(access),
      requestId: correctionId,
      decidedById: access.databaseUserId,
      decidedByIsSuperadmin: access.isSuperadmin,
      decision: input?.decision,
      reasonCode: input?.reasonCode,
      note: input?.note ?? null,
      idempotencyKey,
    });
    return attendanceJson({ correction });
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'correction.decision',
      fallbackMessage: 'No se pudo resolver la corrección de asistencia.',
      fallbackCode: 'ATTENDANCE_CORRECTION_DECISION_FAILED',
      domainErrorResponses: [attendanceCorrectionErrorResponse],
    });
  }
}
