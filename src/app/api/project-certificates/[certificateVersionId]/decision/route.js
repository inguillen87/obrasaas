import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  decideProjectCertificate,
  PROJECT_CERTIFICATE_DECISION_MAX_BODY_BYTES,
  requireProjectCertificateIdempotencyKey,
  requireProjectCertificateRouteMembership,
} from '@/lib/project-certificates';
import { readJsonRequest } from '@/lib/request-body';
import {
  finalizeProjectCertificateResponse,
  knownProjectCertificateError,
  projectCertificateScope,
  rejectProjectCertificateQuery,
  requireProjectCertificateActor,
  unexpectedProjectCertificateError,
} from '../../_shared.js';

export const runtime = 'nodejs';

export function createProjectCertificateDecisionHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: PROJECT_CERTIFICATE_DECISION_MAX_BODY_BYTES,
  }),
  decide = decideProjectCertificate,
  verifyMembership = requireProjectCertificateRouteMembership,
  logError = console.error,
} = {}) {
  return {
    async POST(request, { params }) {
      try {
        const access = await resolveAccess();
        // PostgreSQL owns exact certifier/canceller authority and performs actor-bound
        // replay before mutable role checks. The route only establishes a write-capable
        // authenticated certificate reader in the exact tenant/project scope.
        authorize(access, 'org:certificates:read', { subscriptionMode: 'write' });
        const actorMembershipId = requireProjectCertificateActor(access);
        const prisma = prismaFactory();
        await verifyMembership(prisma, {
          scope: projectCertificateScope(access), actorMembershipId,
        });
        rejectProjectCertificateQuery(request);
        const operationKey = requireProjectCertificateIdempotencyKey(request);
        const { certificateVersionId } = await params;
        const input = await parseBody(request);
        const result = await decide(prisma, {
          scope: projectCertificateScope(access), actorMembershipId,
          certificateVersionId, operationKey, input,
        });
        return finalizeProjectCertificateResponse(request, Response.json(result, {
          status: result.receipt.replayed ? 200 : 201,
        }), result.receipt.replayed);
      } catch (error) {
        return knownProjectCertificateError(request, error)
          || unexpectedProjectCertificateError(request, error, 'decide', logError);
      }
    },
  };
}

const handlers = createProjectCertificateDecisionHandlers();
export async function POST(request, context) { return handlers.POST(request, context); }
