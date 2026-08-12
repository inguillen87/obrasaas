import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  normalizeProjectContractReadQuery,
  readProjectContractSnapshot,
  requireProjectContractRouteMembership,
} from '@/lib/project-contracts';
import {
  finalizeProjectContractResponse,
  knownProjectContractError,
  projectContractScope,
  requireProjectContractActor,
  unexpectedProjectContractError,
} from './_shared.js';

export const runtime = 'nodejs';

export function createProjectContractReadHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  normalizeQuery = normalizeProjectContractReadQuery,
  readSnapshot = readProjectContractSnapshot,
  verifyMembership = requireProjectContractRouteMembership,
  logError = console.error,
} = {}) {
  return {
    async GET(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:contracts:read', { subscriptionMode: 'read' });
        const actorMembershipId = requireProjectContractActor(access);
        const prisma = prismaFactory();
        await verifyMembership(prisma, {
          scope: projectContractScope(access), actorMembershipId,
        });
        normalizeQuery(request);
        const result = await readSnapshot(prisma, {
          scope: projectContractScope(access),
          actorMembershipId,
        });
        return finalizeProjectContractResponse(request, Response.json(result));
      } catch (error) {
        return knownProjectContractError(request, error)
          || unexpectedProjectContractError(request, error, 'read', logError);
      }
    },
  };
}

const handlers = createProjectContractReadHandlers();

export async function GET(request) {
  return handlers.GET(request);
}
