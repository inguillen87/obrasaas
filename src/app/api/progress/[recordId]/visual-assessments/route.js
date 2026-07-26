import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { SOURCE_EVIDENCE_PERMISSION } from '@/lib/medical-privacy';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';
import {
  listVisualProgressAssessments,
  requestVisualProgressAssessment,
  serializePublicVisualProgressAssessment,
  visualProgressAssessmentErrorResponse,
} from '@/lib/visual-progress-assessments';

export const runtime = 'nodejs';
export const maxDuration = 60;

function known(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  return visualProgressAssessmentErrorResponse(error)
    || projectWritePolicyErrorResponse(error);
}

function json(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store',
      ...init.headers,
    },
  });
}

export async function GET(_request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
    requireTenantPermission(access, SOURCE_EVIDENCE_PERMISSION, { subscriptionMode: 'read' });
    const { recordId } = await params;
    const result = await listVisualProgressAssessments(getPrisma(), {
      projectId: access.project.id,
      evidenceId: recordId,
    });
    return json({
      assessments: result.assessments.map(serializePublicVisualProgressAssessment),
    });
  } catch (error) {
    return known(error) || json({
      error: 'No se pudieron cargar las evaluaciones visuales.',
      code: 'VISUAL_PROGRESS_READ_FAILED',
    }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    requireTenantPermission(access, SOURCE_EVIDENCE_PERMISSION, { subscriptionMode: 'write' });
    const { recordId } = await params;
    const result = await requestVisualProgressAssessment(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      actorId: access.databaseUserId,
      evidenceId: recordId,
      idempotencyKey: request.headers.get('Idempotency-Key'),
    });
    return json({
      ...result,
      assessment: serializePublicVisualProgressAssessment(result.assessment),
    }, {
      status: result.pending ? 202 : result.replayed ? 200 : 201,
    });
  } catch (error) {
    if (!(error instanceof AccessError)) {
      console.error('Visual progress assessment request failed:', {
        name: error?.name,
        code: error?.code,
        status: error?.status,
      });
    }
    return known(error) || json({
      error: 'No se pudo iniciar la evaluación visual.',
      code: 'VISUAL_PROGRESS_REQUEST_FAILED',
    }, { status: 500 });
  }
}
