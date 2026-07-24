import {
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { loadAttendanceControlDay } from '@/lib/attendance-control';
import { serializeAttendanceCorrection } from '@/lib/attendance-corrections';
import { getPrisma } from '@/lib/prisma';

import AttendanceClient from './attendance-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Control de asistencia',
  description: 'Horarios, excepciones y correcciones auditables por obra.',
  robots: { index: false, follow: false },
};

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

async function loadPendingCorrections(prisma, access, now, limit = 50) {
  const requests = await prisma.attendanceCorrectionRequest.findMany({
    where: {
      projectId: access.project.id,
      project: { organizationId: access.organization.id },
      decision: { is: null },
      expiresAt: { gt: now },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
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
  const hasMore = requests.length > limit;
  const page = hasMore ? requests.slice(0, limit) : requests;
  return {
    corrections: page.map((item) => correctionDto(item, now)),
    pagination: {
      limit,
      nextCursor: hasMore ? page.at(-1).id : null,
    },
    synchronizedAt: now.toISOString(),
  };
}

async function loadScheduleAssignments(prisma, projectId, control) {
  const scheduleByVersionId = new Map();
  for (const schedule of control.schedules) {
    const versionId = schedule.versions?.[0]?.id;
    if (versionId) scheduleByVersionId.set(versionId, schedule.id);
  }
  const versionIds = [...scheduleByVersionId.keys()];
  if (versionIds.length === 0) return {};

  const assignments = await prisma.attendanceScheduleAssignment.findMany({
    where: {
      projectId,
      scheduleVersionId: { in: versionIds },
      OR: [
        { effectiveThrough: null },
        { effectiveThrough: { gte: new Date(`${control.workDate}T00:00:00.000Z`) } },
      ],
    },
    select: { scheduleVersionId: true, workerId: true },
    orderBy: [{ workerId: 'asc' }],
  });

  const result = Object.fromEntries(control.schedules.map((schedule) => [schedule.id, []]));
  for (const assignment of assignments) {
    const scheduleId = scheduleByVersionId.get(assignment.scheduleVersionId);
    if (scheduleId) result[scheduleId].push(assignment.workerId);
  }
  return result;
}

export default async function AttendancePage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:attendance:read', {
    subscriptionMode: 'read',
  });

  const prisma = getPrisma();
  const now = new Date();
  const [control, correctionPage] = await Promise.all([
    loadAttendanceControlDay(prisma, {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      now,
    }),
    loadPendingCorrections(prisma, access, now),
  ]);
  const scheduleAssignments = await loadScheduleAssignments(
    prisma,
    access.project.id,
    control,
  );
  const permissions = {
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
  };
  const project = { id: access.project.id, name: access.project.name };

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Personas · jornada · trazabilidad</p>
          <h1>Asistencia bajo control, sin inventar presencia.</h1>
          <p className="lead">
            Configurá la obligación horaria, atendé desvíos y resolvé correcciones con
            historial. Las coordenadas y la evidencia de campo no se exponen en esta vista.
          </p>
        </div>
        <aside className="contextCard" aria-label="Contexto activo">
          <span><i aria-hidden="true" /> Obra activa</span>
          <strong>{project.name}</strong>
          <small>{control.timezone} · datos aislados por organización y proyecto</small>
        </aside>
      </header>

      <AttendanceClient
        currentUserId={access.databaseUserId}
        initialControl={{ project, permissions, ...control }}
        initialCorrections={{
          project,
          permissions: {
            canRequest: permissions.canRequestCorrections,
            canApprove: permissions.canApproveCorrections,
          },
          filters: { status: 'PENDING', workerId: null },
          ...correctionPage,
        }}
        initialScheduleAssignments={scheduleAssignments}
      />
    </main>
  );
}
