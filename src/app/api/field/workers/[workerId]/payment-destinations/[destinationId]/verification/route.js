import {
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readJsonRequest } from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';
import {
  rejectWorkerPaymentDestination,
  verifyWorkerPaymentDestination,
} from '@/lib/worker-payment-destinations';
import {
  WorkerPaymentApiError,
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

const MAX_VERIFICATION_BODY_BYTES = 4 * 1024;
const VERIFICATION_FIELDS = new Set(['decision', 'expectedRevision', 'rejectionReason']);
const TRUSTED_RESULT_FIELDS = new Set([
  'policyVersion',
  'evidence',
  'verificationProvider',
  'providerReference',
  'verifiedHolderCuil',
  'serverResolution',
]);

function normalizedDecision(value) {
  const decision = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (decision !== 'VERIFY' && decision !== 'REJECT') {
    throw new WorkerPaymentApiError('decision debe ser VERIFY o REJECT.');
  }
  return decision;
}

function assertTrustedVerification(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkerPaymentApiError('El verificador confiable devolvio una respuesta invalida.', {
      code: 'WORKER_PAYMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
      retryAfterSeconds: 300,
    });
  }
  if (
    Object.keys(value).some((field) => !TRUSTED_RESULT_FIELDS.has(field))
    || typeof value.policyVersion !== 'string'
    || !value.evidence
    || typeof value.verificationProvider !== 'string'
    || typeof value.providerReference !== 'string'
    || typeof value.verifiedHolderCuil !== 'string'
  ) {
    throw new WorkerPaymentApiError('El verificador confiable devolvio una respuesta invalida.', {
      code: 'WORKER_PAYMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
      retryAfterSeconds: 300,
    });
  }
  return value;
}

export async function unavailableTrustedPaymentVerification() {
  throw new WorkerPaymentApiError(
    'La verificacion de titularidad todavia no tiene un proveedor confiable configurado.',
    {
      code: 'WORKER_PAYMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
      retryAfterSeconds: 300,
    },
  );
}

export function createWorkerPaymentVerificationHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  resolveWorkerBridge = resolveScopedWorkerPaymentBridge,
  resolvePaymentDestination = resolveScopedWorkerPaymentDestination,
  verifyPaymentDestination = verifyWorkerPaymentDestination,
  rejectPaymentDestination = rejectWorkerPaymentDestination,
  resolveTrustedVerification = unavailableTrustedPaymentVerification,
  buildDecisionEvidence = buildServerPaymentDecisionEvidence,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: MAX_VERIFICATION_BODY_BYTES,
  }),
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
  logError = console.error,
} = {}) {
  async function POST(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:payroll:destinations:manage', { subscriptionMode: 'write' });
      const actorMembershipId = requireWorkerPaymentActor(access);
      assertNoWorkerPaymentSearchParams(request);
      const params = await context?.params;
      const workerId = requireWorkerPaymentRouteId(params?.workerId, 'workerId');
      const destinationId = requireWorkerPaymentRouteId(
        params?.destinationId,
        'destinationId',
      );
      const input = assertWorkerPaymentObject(await parseBody(request), VERIFICATION_FIELDS);
      const decision = normalizedDecision(input.decision);
      const expectedRevision = requireWorkerPaymentRevision(input.expectedRevision);
      if (decision === 'VERIFY' && input.rejectionReason != null && input.rejectionReason !== '') {
        throw new WorkerPaymentApiError('Una verificacion no admite motivo de rechazo.');
      }
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
      let result;
      if (decision === 'VERIFY') {
        const trusted = assertTrustedVerification(await resolveTrustedVerification({
          prisma,
          access,
          scope,
          workerId,
          personId: worker.personId,
          destinationId,
          purpose: destination.purpose,
          actorMembershipId,
          expectedRevision,
          correlationId,
        }));
        result = await verifyPaymentDestination(prisma, {
          scope,
          personId: worker.personId,
          purpose: destination.purpose,
          destinationId,
          actorMembershipId,
          input: {
            expectedRevision,
            operationKey,
            policyVersion: trusted.policyVersion,
          },
          trustedVerification: {
            evidence: trusted.evidence,
            verificationProvider: trusted.verificationProvider,
            providerReference: trusted.providerReference,
            verifiedHolderCuil: trusted.verifiedHolderCuil,
            ...(trusted.serverResolution === undefined
              ? {}
              : { serverResolution: trusted.serverResolution }),
          },
          now: clock(),
          correlationId,
        });
      } else {
        const evidence = await buildDecisionEvidence({
          action: 'PAYMENT_REJECTED',
          access,
          workerId,
          personId: worker.personId,
          destinationId,
          purpose: destination.purpose,
          actorMembershipId,
          expectedRevision,
          reason: input.rejectionReason ?? null,
        });
        result = await rejectPaymentDestination(prisma, {
          scope,
          personId: worker.personId,
          purpose: destination.purpose,
          destinationId,
          actorMembershipId,
          input: {
            expectedRevision,
            operationKey,
            policyVersion: evidence.policyVersion,
            reason: input.rejectionReason,
          },
          trustedEvidence: evidence.evidence,
          now: clock(),
          correlationId,
        });
      }
      return finalizeWorkerPaymentResponse(workerPaymentJson(result), correlationId);
    } catch (error) {
      const known = workerPaymentErrorResponse(error);
      if (known) return finalizeWorkerPaymentResponse(known, correlationId);
      logError('Worker payment verification failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson({
        error: 'No se pudo verificar el destino de cobro.',
        code: 'WORKER_PAYMENT_VERIFICATION_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { POST };
}

export const { POST } = createWorkerPaymentVerificationHandlers();
