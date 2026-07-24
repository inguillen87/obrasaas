import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import {
  attendanceCorrectionErrorResponse,
  requestAttendanceCorrection,
  serializeAttendanceCorrection,
} from '@/lib/attendance-corrections';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';

import {
  assertOnlySearchParams,
  AttendanceApiError,
  attendanceApiErrorResponse,
  attendanceJson,
  attendanceScope,
  MAX_ATTENDANCE_JSON_BYTES,
  requireAttendanceIdempotencyKey,
} from '../_shared';

export const runtime = 'nodejs';

const CORRECTION_QUERY_FIELDS = new Set(['status', 'workerId', 'cursor', 'limit']);
const CORRECTION_STATUSES = new Set([
  'ALL',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);

function correctionListInput(request) {
  const searchParams = new URL(request.url).searchParams;
  assertOnlySearchParams(searchParams, CORRECTION_QUERY_FIELDS);
  const status = String(searchParams.get('status') || 'PENDING').trim().toUpperCase();
  if (!CORRECTION_STATUSES.has(status)) {
    throw new AttendanceApiError('El estado de corrección solicitado no es válido.', {
      code: 'ATTENDANCE_CORRECTION_STATUS_INVALID',
      status: 400,
    });
  }
  const rawLimit = searchParams.get('limit');
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new AttendanceApiError('limit debe ser un entero entre 1 y 100.', {
      code: 'ATTENDANCE_CORRECTION_LIMIT_INVALID',
      status: 400,
    });
  }
  const workerId = String(searchParams.get('workerId') || '').trim() || null;
  const cursor = String(searchParams.get('cursor') || '').trim() || null;
  if (workerId && workerId.length > 180) {
    throw new AttendanceApiError('workerId no es válido.', {
      code: 'ATTENDANCE_CORRECTION_WORKER_INVALID',
      status: 400,
    });
  }
  if (cursor && cursor.length > 180) {
    throw new AttendanceApiError('cursor no es válido.', {
      code: 'ATTENDANCE_CORRECTION_CURSOR_INVALID',
      status: 400,
    });
  }
  return { status, workerId, cursor, limit };
}

function statusWhere(status, now) {
  if (status === 'PENDING') {
    return { decision: { is: null }, expiresAt: { gt: now } };
  }
  if (status === 'EXPIRED') {
    return { decision: { is: null }, expiresAt: { lte: now } };
  }
  if (status === 'APPROVED' || status === 'REJECTED') {
    return { decision: { is: { decision: status } } };
  }
  return {};
}

function correctionDto(request, now) {
  return {
    ...serializeAttendanceCorrection(request, { now }),
    worker: request.worker,
    shift: {
      id: request.shift.id,
      status: request.shift.status,
      revision: request.shift.revision,
      workDate: request.shift.workDate?.toISOString?.().slice(0, 10) || null,
    },
  };
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:read', {
      subscriptionMode: 'read',
    });
    const input = correctionListInput(request);
    const now = new Date();
    const prisma = getPrisma();
    const baseWhere = {
      projectId: access.project.id,
      project: { organizationId: access.organization.id },
      ...(input.workerId ? { workerId: input.workerId } : {}),
      ...statusWhere(input.status, now),
    };
    if (input.cursor) {
      const cursor = await prisma.attendanceCorrectionRequest.findFirst({
        where: { ...baseWhere, id: input.cursor },
        select: { id: true },
      });
      if (!cursor) {
        throw new AttendanceApiError('El cursor no pertenece a esta consulta.', {
          code: 'ATTENDANCE_CORRECTION_CURSOR_INVALID',
          status: 400,
        });
      }
    }
    const requests = await prisma.attendanceCorrectionRequest.findMany({
      where: baseWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        decision: true,
        adjustment: true,
        worker: { select: { id: true, name: true, role: true } },
        shift: {
          select: {
            id: true,
            status: true,
            revision: true,
            workDate: true,
          },
        },
      },
    });
    const hasMore = requests.length > input.limit;
    const page = hasMore ? requests.slice(0, input.limit) : requests;
    return attendanceJson({
      project: { id: access.project.id, name: access.project.name },
      permissions: {
        canRequest: hasTenantPermission(
          access,
          'org:attendance:corrections:request',
        ),
        canApprove: hasTenantPermission(
          access,
          'org:attendance:corrections:approve',
        ),
      },
      filters: {
        status: input.status,
        workerId: input.workerId,
      },
      corrections: page.map((item) => correctionDto(item, now)),
      pagination: {
        limit: input.limit,
        nextCursor: hasMore ? page.at(-1).id : null,
      },
      synchronizedAt: now.toISOString(),
    });
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'correction.list',
      fallbackMessage: 'No se pudieron cargar las correcciones de asistencia.',
      fallbackCode: 'ATTENDANCE_CORRECTION_LIST_FAILED',
      domainErrorResponses: [attendanceCorrectionErrorResponse],
    });
  }
}

export async function POST(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:corrections:request', {
      subscriptionMode: 'write',
    });
    const idempotencyKey = requireAttendanceIdempotencyKey(request);
    const input = await readJsonRequest(request, {
      maxBytes: MAX_ATTENDANCE_JSON_BYTES,
    });
    const correction = await requestAttendanceCorrection(getPrisma(), {
      scope: attendanceScope(access),
      workerId: input?.workerId,
      shiftId: input?.shiftId,
      expectationId: input?.expectationId ?? null,
      targetEntryId: input?.targetEntryId ?? null,
      baseShiftRevision: input?.baseShiftRevision,
      baseEffectiveHash: input?.baseEffectiveHash,
      proposedEvents: input?.proposedEvents,
      reasonCode: input?.reasonCode,
      note: input?.note ?? null,
      requestedByPlatformUserId: access.databaseUserId,
      requestedByIsSuperadmin: access.isSuperadmin,
      idempotencyKey,
      expiresAt: input?.expiresAt ?? null,
    });
    return attendanceJson({ correction }, {
      status: correction.replayed ? 200 : 201,
    });
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'correction.request',
      fallbackMessage: 'No se pudo solicitar la corrección de asistencia.',
      fallbackCode: 'ATTENDANCE_CORRECTION_REQUEST_FAILED',
      domainErrorResponses: [attendanceCorrectionErrorResponse],
    });
  }
}
