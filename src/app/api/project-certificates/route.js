import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  normalizeProjectCertificateReadQuery,
  prepareProjectCertificate,
  PROJECT_CERTIFICATE_MAX_BODY_BYTES,
  readProjectCertificateSnapshot,
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
} from './_shared.js';

export const runtime = 'nodejs';

export function createProjectCertificateHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  normalizeQuery = normalizeProjectCertificateReadQuery,
  parseBody = (request) => readJsonRequest(request, { maxBytes: PROJECT_CERTIFICATE_MAX_BODY_BYTES }),
  readSnapshot = readProjectCertificateSnapshot,
  prepare = prepareProjectCertificate,
  verifyMembership = requireProjectCertificateRouteMembership,
  logError = console.error,
} = {}) {
  return {
    async GET(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:certificates:read', { subscriptionMode: 'read' });
        const actorMembershipId = requireProjectCertificateActor(access);
        const prisma = prismaFactory();
        await verifyMembership(prisma, {
          scope: projectCertificateScope(access), actorMembershipId,
        });
        const query = normalizeQuery(request);
        const result = await readSnapshot(prisma, {
          scope: projectCertificateScope(access), actorMembershipId, query,
        });
        return finalizeProjectCertificateResponse(request, Response.json(result));
      } catch (error) {
        return knownProjectCertificateError(request, error)
          || unexpectedProjectCertificateError(request, error, 'read', logError);
      }
    },
    async POST(request) {
      try {
        const access = await resolveAccess();
        // This is deliberately a coarse authenticated mutation gate. PostgreSQL resolves
        // exact actor-bound replay before checking the mutable SITE_MANAGER role on a miss.
        authorize(access, 'org:certificates:read', { subscriptionMode: 'write' });
        const actorMembershipId = requireProjectCertificateActor(access);
        const prisma = prismaFactory();
        await verifyMembership(prisma, {
          scope: projectCertificateScope(access), actorMembershipId,
        });
        rejectProjectCertificateQuery(request);
        const operationKey = requireProjectCertificateIdempotencyKey(request);
        const input = await parseBody(request);
        const result = await prepare(prisma, {
          scope: projectCertificateScope(access), actorMembershipId, operationKey, input,
        });
        return finalizeProjectCertificateResponse(request, Response.json(result, {
          status: result.receipt.replayed ? 200 : 201,
        }), result.receipt.replayed);
      } catch (error) {
        return knownProjectCertificateError(request, error)
          || unexpectedProjectCertificateError(request, error, 'prepare', logError);
      }
    },
  };
}

const handlers = createProjectCertificateHandlers();
export async function GET(request) { return handlers.GET(request); }
export async function POST(request) { return handlers.POST(request); }
