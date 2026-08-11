import {
  AccessError,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  normalizeProgressMeasurementListQuery,
  readTaskProgressMeasurementSnapshot,
} from '@/lib/progress-measurements';
import {
  normalizeProgressMeasurementCutQuery,
  readProgressMeasurementCutSnapshot,
} from '@/lib/progress-measurement-cuts';
import { localDateKey } from '@/lib/zoned-time';

import MeasurementsClient from './measurements-client';
import { latestClosedFortnightDate } from './progress-measurement-cuts-state';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Mediciones de avance',
  description: 'Medición técnica quincenal, trazable y revisable por tarea.',
  robots: { index: false, follow: false, nocache: true },
};

const CATALOG_LIMIT = 5_000;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;

function requestedTaskId(searchParams) {
  const value = typeof searchParams?.taskId === 'string' ? searchParams.taskId : '';
  return SAFE_IDENTIFIER.test(value) ? value : null;
}

function requestedView(searchParams) {
  return searchParams?.view === 'cut' ? 'cut' : 'tasks';
}

export default async function MeasurementsPage({ searchParams }) {
  const access = await getPlatformAccess();
  const params = await searchParams;
  const initialView = requestedView(params);
  requireTenantPermission(access, 'org:measurements:read', { subscriptionMode: 'read' });
  if (initialView === 'cut') {
    requireTenantPermission(access, 'org:measurement-cuts:read', { subscriptionMode: 'read' });
  }
  if (!access.tenantMembershipId) {
    throw new AccessError('Una membresía activa en la organización es obligatoria.', {
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  }

  const prisma = getPrisma();
  const tenantToday = localDateKey(new Date(), access.organization.timezone);
  const initialCutDate = latestClosedFortnightDate(tenantToday);
  const requestedId = requestedTaskId(params);
  const taskWhere = {
    projectId: access.project.id,
    type: 'TASK',
    metadata: { path: ['source'], equals: 'canonical-task-v1' },
  };
  const initialTask = await prisma.task.findFirst({
    where: { ...taskWhere, ...(requestedId ? { id: requestedId } : {}) },
    orderBy: [{ code: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    select: { id: true, code: true, title: true, status: true },
  }) || (requestedId ? await prisma.task.findFirst({
    where: taskWhere,
    orderBy: [{ code: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    select: { id: true, code: true, title: true, status: true },
  }) : null);
  const initialTaskId = initialTask?.id || null;
  const initialMeasurementQuery = initialTaskId
    ? normalizeProgressMeasurementListQuery(new URLSearchParams({
        taskId: initialTaskId,
        periodDate: tenantToday,
        limit: '25',
      }))
    : null;
  const initialCutQuery = initialView === 'cut'
    ? normalizeProgressMeasurementCutQuery(new URLSearchParams({ periodDate: initialCutDate }))
    : null;
  const actorMembershipId = access.tenantMembershipId;
  const canPrepare = Boolean(actorMembershipId)
    && hasTenantPermission(access, 'org:measurements:prepare');
  const canApprove = Boolean(actorMembershipId)
    && hasTenantPermission(access, 'org:measurements:approve');
  const canSeal = Boolean(actorMembershipId)
    && hasTenantPermission(access, 'org:measurement-cuts:seal');
  const canReadCuts = Boolean(actorMembershipId)
    && hasTenantPermission(access, 'org:measurement-cuts:read');

  const [taskRows, evidenceRows, initialSnapshot, initialCutSnapshot] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      orderBy: [{ code: 'asc' }, { title: 'asc' }, { id: 'asc' }],
      take: CATALOG_LIMIT + 1,
      select: { id: true, code: true, title: true, status: true },
    }),
    canPrepare
      ? prisma.progressEvidence.findMany({
          where: { projectId: access.project.id, status: 'APPROVED' },
          orderBy: [{ capturedAt: 'desc' }, { id: 'desc' }],
          take: CATALOG_LIMIT + 1,
          select: { id: true, taskId: true, capturedAt: true },
        })
      : Promise.resolve([]),
    initialTaskId
      ? readTaskProgressMeasurementSnapshot(prisma, {
          scope: {
            organizationId: access.organization.id,
            projectId: access.project.id,
          },
          query: initialMeasurementQuery,
          actorMembershipId,
        })
      : Promise.resolve(null),
    initialView === 'cut'
      ? readProgressMeasurementCutSnapshot(prisma, {
          scope: {
            organizationId: access.organization.id,
            projectId: access.project.id,
          },
          query: initialCutQuery,
          actorMembershipId,
        })
      : Promise.resolve(null),
  ]);
  const visibleTaskRows = taskRows.slice(0, CATALOG_LIMIT);
  if (initialTask && !visibleTaskRows.some((task) => task.id === initialTask.id)) {
    if (visibleTaskRows.length >= CATALOG_LIMIT) visibleTaskRows.pop();
    visibleTaskRows.unshift(initialTask);
  }

  return (
    <MeasurementsClient
      approvedEvidence={evidenceRows.slice(0, CATALOG_LIMIT).map((evidence) => ({
        id: evidence.id,
        taskId: evidence.taskId,
        capturedAt: evidence.capturedAt.toISOString(),
      }))}
      approvedEvidenceTruncated={evidenceRows.length > CATALOG_LIMIT}
      initialCutSnapshot={initialCutSnapshot}
      initialSnapshot={initialSnapshot}
      initialTaskId={initialTaskId}
      initialView={initialView}
      organizationTimeZone={access.organization.timezone}
      permissions={{ canPrepare, canApprove, canReadCuts, canSeal }}
      projectName={access.project.name}
      tasks={visibleTaskRows}
      tasksTruncated={taskRows.length > CATALOG_LIMIT}
      tenantToday={tenantToday}
    />
  );
}
