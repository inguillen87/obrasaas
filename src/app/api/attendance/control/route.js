import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import {
  attendanceControlErrorResponse,
  loadAttendanceControlDay,
} from '@/lib/attendance-control';
import { attendanceExpectationErrorResponse } from '@/lib/attendance-expectations';
import { getPrisma } from '@/lib/prisma';

import {
  assertOnlySearchParams,
  attendanceApiErrorResponse,
  attendanceJson,
  attendanceScope,
} from '../_shared';

export const runtime = 'nodejs';

const CONTROL_QUERY_FIELDS = new Set(['workDate']);

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:attendance:read', {
      subscriptionMode: 'read',
    });
    const searchParams = new URL(request.url).searchParams;
    assertOnlySearchParams(searchParams, CONTROL_QUERY_FIELDS);
    const control = await loadAttendanceControlDay(getPrisma(), {
      scope: attendanceScope(access),
      workDate: searchParams.get('workDate') || null,
    });
    return attendanceJson({
      project: {
        id: access.project.id,
        name: access.project.name,
      },
      permissions: {
        canManageSchedules: hasTenantPermission(
          access,
          'org:attendance:schedules:manage',
        ),
        canManageExceptions: hasTenantPermission(
          access,
          'org:attendance:exceptions:manage',
        ),
        canRequestCorrections: hasTenantPermission(
          access,
          'org:attendance:corrections:request',
        ),
        canApproveCorrections: hasTenantPermission(
          access,
          'org:attendance:corrections:approve',
        ),
        canAcknowledgeAlerts: hasTenantPermission(
          access,
          'org:attendance:alerts:acknowledge',
        ),
      },
      ...control,
    });
  } catch (error) {
    return attendanceApiErrorResponse(error, {
      operation: 'control.read',
      fallbackMessage: 'No se pudo cargar el control de asistencia.',
      fallbackCode: 'ATTENDANCE_CONTROL_READ_FAILED',
      domainErrorResponses: [
        attendanceControlErrorResponse,
        attendanceExpectationErrorResponse,
      ],
    });
  }
}
