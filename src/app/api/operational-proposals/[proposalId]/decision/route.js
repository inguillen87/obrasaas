import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import {
  MEDICAL_EVIDENCE_PERMISSION,
  SOURCE_EVIDENCE_PERMISSION,
} from '@/lib/medical-privacy';
import {
  OPERATIONAL_PROPOSAL_MANAGE_PERMISSION,
  OperationalProposalInboxError,
  operationalProposalInboxErrorResponse,
  resolveDashboardOperationalProposal,
} from '@/lib/operational-proposal-inbox';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';

export const runtime = 'nodejs';
const MAX_DECISION_BODY_BYTES = 8 * 1024;

export async function POST(request, { params }) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, OPERATIONAL_PROPOSAL_MANAGE_PERMISSION);
    const { proposalId } = await params;
    const input = await readJsonRequest(request, {
      maxBytes: MAX_DECISION_BODY_BYTES,
    });
    const result = await resolveDashboardOperationalProposal(getPrisma(), {
      scope: {
        organizationId: access.organization.id,
        projectId: access.project.id,
      },
      proposalId,
      actorId: access.databaseUserId,
      actorName: access.email,
      idempotencyKey: request.headers.get('idempotency-key'),
      input,
      includeSensitiveDetails: (
        hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION)
        && hasTenantPermission(access, MEDICAL_EVIDENCE_PERMISSION)
      ),
      timezone: access.organization.timezone,
    });
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
    if (error instanceof OperationalProposalInboxError) {
      return operationalProposalInboxErrorResponse(error);
    }
    const policyError = projectWritePolicyErrorResponse(error);
    if (policyError) return policyError;
    console.error('Operational proposal decision failed:', error);
    return Response.json({
      error: 'No se pudo resolver la propuesta.',
      code: 'OPERATIONAL_PROPOSAL_DECISION_FAILED',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
