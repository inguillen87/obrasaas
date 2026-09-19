import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { tenantAiSettingsFromMetadata } from '@/lib/ai/tenant-settings';
import { notFound } from 'next/navigation';
import { listCanonicalTasks, serializeCanonicalTask } from '@/lib/canonical-tasks';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import { withJournalCorrectionLinks } from '@/lib/journal-correction';
import { listProgressJournal } from '@/lib/progress-journal';
import { listVisualProgressAssessments } from '@/lib/visual-progress-assessments';
import { localDateKey } from '@/lib/zoned-time';
import ProgressClient from './progress-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bitácora de avance', description: 'Registro diario y evidencia revisable por tarea.' };

function visualAssessmentForClient(assessment) {
  return {
    id: assessment.id,
    evidenceId: assessment.evidenceId,
    taskId: assessment.taskId,
    status: assessment.status,
    summary: assessment.summary,
    elementType: assessment.elementType,
    progressMin: assessment.progressMin,
    progressMax: assessment.progressMax,
    confidence: assessment.confidence,
    quality: {
      overall: assessment.quality?.overall || null,
      angle: assessment.quality?.angle || null,
      lighting: assessment.quality?.lighting || null,
      occlusion: assessment.quality?.occlusion || null,
    },
    observations: assessment.observations,
    limitations: assessment.limitations,
    reviewStatus: assessment.reviewStatus,
    reviewNote: assessment.reviewNote,
    correctedProgressMin: assessment.correctedProgressMin,
    correctedProgressMax: assessment.correctedProgressMax,
    revision: assessment.revision,
    completedAt: assessment.completedAt,
    reviewedAt: assessment.reviewedAt,
    createdAt: assessment.createdAt,
  };
}

export default async function ProgressPage({ searchParams }) {
  const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  const prisma = getPrisma();
  const params = await searchParams;
  const requestedTaskId = params?.taskId ?? null;
  const focusedRecordId = params?.recordId ?? null;
  if (focusedRecordId !== null && (typeof focusedRecordId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(focusedRecordId) || requestedTaskId || params?.unassigned != null)) notFound();
  if (params?.unassigned != null && params.unassigned !== '1') notFound();
  const unassignedOnly = params?.unassigned === '1';
  if (unassignedOnly && requestedTaskId) notFound();
  if (requestedTaskId !== null && (typeof requestedTaskId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(requestedTaskId))) notFound();
  const selectedTask = requestedTaskId ? await prisma.task.findFirst({ where: { id: requestedTaskId, projectId: access.project.id, metadata: { path: ['source'], equals: 'canonical-task-v1' } }, include: { predecessors: true } }) : null;
  if (requestedTaskId && !selectedTask) notFound();
  const canManage = hasTenantPermission(access, 'org:execution:manage');
  const canReadSourceEvidence = hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION);
  const aiSettings = tenantAiSettingsFromMetadata(access.organization.metadata);
  const canUseVisualProgress = (
    canManage
    && canReadSourceEvidence
    && aiSettings.visualProgressEnabled
  );
  const canUseReviewedEvidence = (
    canUseVisualProgress
    && hasTenantPermission(access, 'org:tasks:manage')
  );
  const baseJournal = await listProgressJournal(prisma, {
    recordId: focusedRecordId,
    taskId: requestedTaskId, unassigned: unassignedOnly,
    projectId: access.project.id,
    includeSourceEvidence: canReadSourceEvidence,
  });
  if (focusedRecordId && baseJournal.dailyLogs.length !== 1) notFound();
  const journal = await withJournalCorrectionLinks(prisma, { organizationId: access.organization.id, projectId: access.project.id, journal: baseJournal });
  const visibleEvidenceIds = journal.evidence.map((evidence) => evidence.id);
  const [tasks, workers, visualAssessments] = await Promise.all([
    selectedTask ? Promise.resolve({ tasks: [serializeCanonicalTask(selectedTask)] }) : listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }),
    prisma.worker.findMany({ where: { projectId: access.project.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    canReadSourceEvidence
      ? listVisualProgressAssessments(prisma, {
          projectId: access.project.id,
          evidenceIds: visibleEvidenceIds,
          latestPerEvidence: true,
        })
      : Promise.resolve({ assessments: [] }),
  ]);
  return (
    <ProgressClient key={access.organization.id + ":" + access.project.id + ":" + access.databaseUserId + ":" + (focusedRecordId || requestedTaskId || (unassignedOnly ? "unassigned" : "all"))}
      filteredTaskId={requestedTaskId} unassignedOnly={unassignedOnly} focusedRecordId={focusedRecordId}
      organizationId={access.organization.id} projectId={access.project.id}
      initialData={journal}
      initialVisualAssessments={visualAssessments.assessments.map(visualAssessmentForClient)}
      tasks={tasks.tasks}
      workers={workers}
      initialWorkDate={localDateKey(new Date(), access.organization.timezone)}
      permissions={{
        canManage,
        canReadSchedule: hasTenantPermission(access, 'org:tasks:read'),
        canReadMeasurements: hasTenantPermission(access, 'org:measurements:read'),
        canReviewJournal: canManage && hasTenantPermission(access, 'org:progress:review'),
        canReadSourceEvidence,
        canUseReviewedEvidence,
        canUseVisualProgress,
        visualProgressEnabled: aiSettings.visualProgressEnabled,
      }}
      projectName={access.project.name}
    />
  );
}
