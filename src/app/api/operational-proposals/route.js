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
  OPERATIONAL_PROPOSAL_READ_PERMISSION,
  OperationalProposalInboxError,
  listOperationalProposalInbox,
  operationalProposalInboxErrorResponse,
  parseOperationalProposalFilters,
  sweepExpiredOperationalProposals,
} from '@/lib/operational-proposal-inbox';
import { getPrisma } from '@/lib/prisma';
import { projectWritePolicyErrorResponse } from '@/lib/project-write-policy';

export const runtime = 'nodejs';

function scopeFromAccess(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

export async function GET(request) {
  try {
    const access = await getPlatformAccess();
    requireTenantPermission(access, OPERATIONAL_PROPOSAL_READ_PERMISSION);
    const filters = parseOperationalProposalFilters(
      new URL(request.url).searchParams,
    );
    const prisma = getPrisma();
    const scope = scopeFromAccess(access);
    const now = new Date();
    await sweepExpiredOperationalProposals(prisma, scope, { now });
    const inbox = await listOperationalProposalInbox(prisma, scope, {
      filters,
      includeSensitiveDetails: (
        hasTenantPermission(access, SOURCE_EVIDENCE_PERMISSION)
        && hasTenantPermission(access, MEDICAL_EVIDENCE_PERMISSION)
      ),
      now,
    });
    const canManage = hasTenantPermission(
      access,
      OPERATIONAL_PROPOSAL_MANAGE_PERMISSION,
    );
    return Response.json({
      project: {
        id: access.project.id,
        name: access.project.name,
        timezone: access.organization.timezone,
      },
      permissions: { canManage },
      metrics: inbox.metrics,
      counts: inbox.metrics,
      proposals: inbox.proposals,
      tasks: inbox.tasks,
      pagination: inbox.pagination,
      stateVersion: inbox.stateVersion,
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof AccessError) return accessErrorResponse(error);
    if (error instanceof OperationalProposalInboxError) {
      return operationalProposalInboxErrorResponse(error);
    }
    const policyError = projectWritePolicyErrorResponse(error);
    if (policyError) return policyError;
    console.error('Operational proposal inbox failed:', error);
    return Response.json({
      error: 'No se pudo cargar la bandeja de aprobaciones.',
      code: 'OPERATIONAL_PROPOSAL_INBOX_FAILED',
    }, {
      status: 500,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}
