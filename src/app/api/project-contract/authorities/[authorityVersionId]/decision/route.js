import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  decideProjectContractAuthority,
  PROJECT_CONTRACT_DECISION_MAX_BODY_BYTES,
  requireProjectContractIdempotencyKey,
  requireProjectContractRouteMembership,
} from '@/lib/project-contracts';
import { readJsonRequest } from '@/lib/request-body';
import {
  finalizeProjectContractResponse,
  knownProjectContractError,
  projectContractScope,
  rejectProjectContractQuery,
  requireProjectContractActor,
  unexpectedProjectContractError,
} from '../../../_shared.js';

export const runtime = 'nodejs';

export function createProjectContractAuthorityDecisionHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: PROJECT_CONTRACT_DECISION_MAX_BODY_BYTES,
  }),
  decide = decideProjectContractAuthority,
  verifyMembership = requireProjectContractRouteMembership,
  logError = console.error,
} = {}) {
  return {
    async POST(request, { params }) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:contracts:authorities:manage', { subscriptionMode: 'write' });
        const actorMembershipId = requireProjectContractActor(access);
        const prisma = prismaFactory();
        await verifyMembership(prisma, {
          scope: projectContractScope(access), actorMembershipId,
        });
        rejectProjectContractQuery(request);
        const operationKey = requireProjectContractIdempotencyKey(request);
        const { authorityVersionId } = await params;
        const input = await parseBody(request);
        const result = await decide(prisma, {
          scope: projectContractScope(access), actorMembershipId,
          authorityVersionId, operationKey, input,
        });
        return finalizeProjectContractResponse(request, Response.json(result, {
          status: result.replayed ? 200 : 201,
        }), result.replayed);
      } catch (error) {
        return knownProjectContractError(request, error)
          || unexpectedProjectContractError(request, error, 'authority.decide', logError);
      }
    },
  };
}

const handlers = createProjectContractAuthorityDecisionHandlers();
export async function POST(request, context) { return handlers.POST(request, context); }
