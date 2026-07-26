import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { tenantAiSettingsFromMetadata } from '@/lib/ai/tenant-settings';
import { listCanonicalTasks } from '@/lib/canonical-tasks';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
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

export default async function ProgressPage() {
  const access = await getPlatformAccess(); requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  const prisma = getPrisma();
  const canManage = hasTenantPermission(access, 'org:execution:manage');
  const canReadSourceEvidence = hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION);
  const aiSettings = tenantAiSettingsFromMetadata(access.organization.metadata);
  const canUseVisualProgress = (
    canManage
    && canReadSourceEvidence
    && aiSettings.visualProgressEnabled
  );
  const journal = await listProgressJournal(prisma, {
    projectId: access.project.id,
    includeSourceEvidence: canReadSourceEvidence,
  });
  const visibleEvidenceIds = journal.evidence.map((evidence) => evidence.id);
  const [tasks, workers, visualAssessments] = await Promise.all([
    listCanonicalTasks(prisma, { projectId: access.project.id, limit: 500 }),
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
    <ProgressClient
      initialData={journal}
      initialVisualAssessments={visualAssessments.assessments.map(visualAssessmentForClient)}
      tasks={tasks.tasks}
      workers={workers}
      initialWorkDate={localDateKey(new Date(), access.organization.timezone)}
      permissions={{
        canManage,
        canReadSourceEvidence,
        canUseVisualProgress,
        visualProgressEnabled: aiSettings.visualProgressEnabled,
      }}
      projectName={access.project.name}
    />
  );
}
