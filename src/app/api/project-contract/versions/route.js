import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  PROJECT_CONTRACT_MAX_BODY_BYTES,
  proposeProjectContractVersion,
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
} from '../_shared.js';

export const runtime = 'nodejs';

export function createProjectContractVersionHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  parseBody = (request) => readJsonRequest(request, { maxBytes: PROJECT_CONTRACT_MAX_BODY_BYTES }),
  propose = proposeProjectContractVersion,
  verifyMembership = requireProjectContractRouteMembership,
  logError = console.error,
} = {}) {
  return {
    async POST(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:contracts:prepare', { subscriptionMode: 'write' });
        const actorMembershipId = requireProjectContractActor(access);
        const prisma = prismaFactory();
        await verifyMembership(prisma, {
          scope: projectContractScope(access), actorMembershipId,
        });
        rejectProjectContractQuery(request);
        const operationKey = requireProjectContractIdempotencyKey(request);
        const input = await parseBody(request);
        const result = await propose(prisma, {
          scope: projectContractScope(access), actorMembershipId, operationKey, input,
        });
        return finalizeProjectContractResponse(request, Response.json(result, {
          status: result.replayed ? 200 : 201,
        }), result.replayed);
      } catch (error) {
        return knownProjectContractError(request, error)
          || unexpectedProjectContractError(request, error, 'contract.propose', logError);
      }
    },
  };
}

const handlers = createProjectContractVersionHandlers();
export async function POST(request) { return handlers.POST(request); }
