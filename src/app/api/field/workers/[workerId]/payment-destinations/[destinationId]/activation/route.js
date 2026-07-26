import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';
import { activateWorkerPaymentDestination } from '@/lib/worker-payment-destinations';
import {
  assertNoWorkerPaymentSearchParams,
  assertWorkerPaymentObject,
  buildServerPaymentDecisionEvidence,
  finalizeWorkerPaymentResponse,
  requireWorkerPaymentActor,
  requireWorkerPaymentIdempotencyKey,
  requireWorkerPaymentRevision,
  requireWorkerPaymentRouteId,
  resolveScopedWorkerPaymentBridge,
  resolveScopedWorkerPaymentDestination,
  workerPaymentErrorResponse,
  workerPaymentJson,
  workerPaymentScope,
} from '../../route.js';

export const runtime = 'nodejs';

const MAX_ACTIVATION_BODY_BYTES = 2 * 1024;
const ACTIVATION_FIELDS = new Set(['expectedRevision']);

export function createWorkerPaymentActivationHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  resolveWorkerBridge = resolveScopedWorkerPaymentBridge,
  resolvePaymentDestination = resolveScopedWorkerPaymentDestination,
  activatePaymentDestination = activateWorkerPaymentDestination,
  buildDecisionEvidence = buildServerPaymentDecisionEvidence,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: MAX_ACTIVATION_BODY_BYTES,
  }),
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
  logError = console.error,
} = {}) {
  async function POST(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:payroll:destinations:activate', { subscriptionMode: 'write' });
      const actorMembershipId = requireWorkerPaymentActor(access);
      assertNoWorkerPaymentSearchParams(request);
      const params = await context?.params;
      const workerId = requireWorkerPaymentRouteId(params?.workerId, 'workerId');
      const destinationId = requireWorkerPaymentRouteId(
        params?.destinationId,
        'destinationId',
      );
      const input = assertWorkerPaymentObject(await parseBody(request), ACTIVATION_FIELDS);
      const expectedRevision = requireWorkerPaymentRevision(input.expectedRevision);
      const operationKey = requireWorkerPaymentIdempotencyKey(request);
      const prisma = prismaFactory();
      const scope = workerPaymentScope(access);
      const worker = await resolveWorkerBridge(prisma, access, workerId, {
        requireActive: true,
      });
      const destination = await resolvePaymentDestination(
        prisma,
        scope,
        worker.personId,
        destinationId,
      );
      const evidence = await buildDecisionEvidence({
        action: 'PAYMENT_ACTIVATED',
        access,
        workerId,
        personId: worker.personId,
        destinationId,
        purpose: destination.purpose,
        actorMembershipId,
        expectedRevision,
      });
      const result = await activatePaymentDestination(prisma, {
        scope,
        personId: worker.personId,
        purpose: destination.purpose,
        destinationId,
        actorMembershipId,
        input: {
          expectedRevision,
          operationKey,
          policyVersion: evidence.policyVersion,
        },
        trustedEvidence: evidence.evidence,
        now: clock(),
        correlationId,
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson(result), correlationId);
    } catch (error) {
      const known = workerPaymentErrorResponse(error);
      if (known) return finalizeWorkerPaymentResponse(known, correlationId);
      logError('Worker payment activation failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson({
        error: 'No se pudo activar el destino de cobro.',
        code: 'WORKER_PAYMENT_ACTIVATION_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { POST };
}

export const { POST } = createWorkerPaymentActivationHandlers();
