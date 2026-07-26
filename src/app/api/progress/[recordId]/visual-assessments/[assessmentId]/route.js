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
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  reviewVisualProgressAssessment,
  serializePublicVisualProgressAssessment,
  visualProgressAssessmentErrorResponse,
} from '@/lib/visual-progress-assessments';

const MAX_REVIEW_BODY_BYTES = 16 * 1024;

function known(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
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

export async function PATCH(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, 'org:execution:manage', { subscriptionMode: 'write' });
    requireTenantPermission(access, SOURCE_EVIDENCE_PERMISSION, { subscriptionMode: 'write' });
    const input = await readJsonRequest(request, { maxBytes: MAX_REVIEW_BODY_BYTES });
    const { recordId, assessmentId } = await params;
    const result = await reviewVisualProgressAssessment(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      actorId: access.databaseUserId,
      evidenceId: recordId,
      assessmentId,
      expectedRevision: input.expectedRevision,
      status: input.status,
      reviewNote: input.reviewNote,
      correctedProgressMin: input.correctedProgressMin,
      correctedProgressMax: input.correctedProgressMax,
    });
    return json({
      assessment: serializePublicVisualProgressAssessment(result.assessment),
    });
  } catch (error) {
    if (!(error instanceof AccessError)) {
      console.error('Visual progress assessment review failed:', {
        name: error?.name,
        code: error?.code,
        status: error?.status,
      });
    }
    return known(error) || json({
      error: 'No se pudo revisar la evaluación visual.',
      code: 'VISUAL_PROGRESS_REVIEW_FAILED',
    }, { status: 500 });
  }
}
