import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';
import { decideWorkerOnboardingClaim } from '@/lib/worker-onboarding';
import {
  WorkerSensitiveApiError,
  assertNoWorkerSensitiveSearchParams,
  assertWorkerSensitiveObject,
  buildServerOnboardingDecisionEvidence,
  finalizeWorkerSensitiveResponse,
  requireTenantMembershipActor,
  requireWorkerSensitiveIdempotencyKey,
  requireWorkerSensitiveRevision,
  requireWorkerSensitiveRouteId,
  workerSensitiveErrorResponse,
  workerSensitiveJson,
  workerSensitiveScope,
} from '../../route.js';

export const runtime = 'nodejs';

const MAX_DECISION_BODY_BYTES = 4 * 1024;
const DECISION_FIELDS = new Set(['action', 'expectedRevision', 'rejectionReason']);

function normalizedAction(value) {
  const action = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (action !== 'APPROVE' && action !== 'REJECT') {
    throw new WorkerSensitiveApiError('action debe ser APPROVE o REJECT.');
  }
  return action;
}

export function createWorkerOnboardingDecisionHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  decideClaim = decideWorkerOnboardingClaim,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: MAX_DECISION_BODY_BYTES,
  }),
  buildDecisionEvidence = buildServerOnboardingDecisionEvidence,
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
  logError = console.error,
} = {}) {
  async function POST(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:workers:onboarding:manage', { subscriptionMode: 'write' });
      const actorMembershipId = requireTenantMembershipActor(access);
      assertNoWorkerSensitiveSearchParams(request);
      const params = await context?.params;
      const claimId = requireWorkerSensitiveRouteId(params?.claimId, 'claimId');
      const input = assertWorkerSensitiveObject(await parseBody(request), DECISION_FIELDS);
      const action = normalizedAction(input.action);
      const expectedRevision = requireWorkerSensitiveRevision(input.expectedRevision);
      if (action === 'APPROVE' && input.rejectionReason != null && input.rejectionReason !== '') {
        throw new WorkerSensitiveApiError('Una aprobacion no admite motivo de rechazo.');
      }
      const idempotencyKey = requireWorkerSensitiveIdempotencyKey(request);
      const scope = workerSensitiveScope(access);
      const evidence = await buildDecisionEvidence({
        action,
        scope,
        claimId,
        actorMembershipId,
        expectedRevision,
        rejectionReason: input.rejectionReason ?? null,
      });
      const result = await decideClaim(prismaFactory(), {
        scope,
        claimId,
        decidedByMembershipId: actorMembershipId,
        decision: action,
        expectedRevision,
        evidenceHash: evidence.evidenceHash,
        policyVersion: evidence.policyVersion,
        rejectionReason: input.rejectionReason ?? null,
        idempotencyKey,
        now: clock(),
      });
      return finalizeWorkerSensitiveResponse(workerSensitiveJson(result), correlationId);
    } catch (error) {
      let known = null;
      if (error instanceof RequestBodyError) known = requestBodyErrorResponse(error);
      known ||= workerSensitiveErrorResponse(error);
      if (known) return finalizeWorkerSensitiveResponse(known, correlationId);
      logError('Worker onboarding decision failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeWorkerSensitiveResponse(workerSensitiveJson({
        error: 'No se pudo decidir el alta del operario.',
        code: 'WORKER_ONBOARDING_DECISION_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { POST };
}

export const { POST } = createWorkerOnboardingDecisionHandlers();
