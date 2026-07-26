import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';
import {
  WorkerPaymentDestinationError,
  listWorkerPaymentDestinations,
  submitWorkerPaymentDestination,
} from '@/lib/worker-payment-destinations';

export const runtime = 'nodejs';

const MAX_SUBMISSION_BODY_BYTES = 8 * 1024;
const LIST_QUERY_FIELDS = new Set(['purpose']);
const SUBMISSION_FIELDS = new Set(['purpose', 'type', 'value', 'holderName', 'holderCuil']);
const SAFE_IDENTIFIER = /^[^\u0000-\u001f\u007f]{1,190}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const MAX_PRISMA_INT = 2_147_483_647;

export class WorkerPaymentApiError extends Error {
  constructor(message, {
    code = 'WORKER_PAYMENT_API_INVALID',
    status = 400,
    retryAfterSeconds = null,
  } = {}) {
    super(message);
    this.name = 'WorkerPaymentApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function workerPaymentJson(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

export function finalizeWorkerPaymentResponse(response, correlationId) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, correlationId);
}

export function workerPaymentScope(access) {
  return { organizationId: access.organization.id };
}

export function requireWorkerPaymentActor(access) {
  const membershipId = typeof access?.tenantMembershipId === 'string'
    ? access.tenantMembershipId.trim()
    : '';
  if (!SAFE_IDENTIFIER.test(membershipId)) {
    throw new WorkerPaymentApiError(
      'Una membresia tenant activa es obligatoria para operar datos de cobro.',
      { code: 'TENANT_MEMBERSHIP_REQUIRED', status: 403 },
    );
  }
  return membershipId;
}

export function requireWorkerPaymentRouteId(value, field) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER.test(id)) {
    throw new WorkerPaymentApiError(`${field} no existe.`, {
      code: 'WORKER_PAYMENT_NOT_FOUND',
      status: 404,
    });
  }
  return id;
}

export function requireWorkerPaymentIdempotencyKey(request) {
  const key = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WorkerPaymentApiError(
      'Envia un encabezado Idempotency-Key valido de entre 8 y 128 caracteres.',
      { code: 'IDEMPOTENCY_KEY_INVALID', status: 400 },
    );
  }
  return key;
}

export function assertWorkerPaymentObject(input, allowedFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WorkerPaymentApiError('El cuerpo debe ser un objeto JSON.');
  }
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new WorkerPaymentApiError('La solicitud contiene campos no permitidos.', {
      code: 'WORKER_PAYMENT_UNKNOWN_FIELDS',
      status: 400,
    });
  }
  return input;
}

export function assertWorkerPaymentSearchParams(searchParams, allowedFields) {
  for (const key of searchParams.keys()) {
    if (!allowedFields.has(key) || searchParams.getAll(key).length !== 1) {
      throw new WorkerPaymentApiError('La consulta contiene filtros no permitidos.', {
        code: 'WORKER_PAYMENT_QUERY_INVALID',
        status: 400,
      });
    }
  }
}

export function assertNoWorkerPaymentSearchParams(request) {
  assertWorkerPaymentSearchParams(new URL(request.url).searchParams, new Set());
}

export function requireWorkerPaymentRevision(value) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_PRISMA_INT
  ) {
    throw new WorkerPaymentApiError('expectedRevision debe ser un entero entre 0 y 2147483647.');
  }
  return value;
}

export async function resolveScopedWorkerPaymentBridge(
  prisma,
  access,
  workerId,
  { requireActive = false } = {},
) {
  const worker = await prisma.worker.findFirst({
    where: {
      id: workerId,
      projectId: access.project.id,
      project: { organizationId: access.organization.id },
      ...(requireActive ? { active: true } : {}),
    },
    select: { id: true, personId: true, active: true },
  });
  if (!worker || !worker.personId) {
    throw new WorkerPaymentApiError('El operario no existe dentro del alcance activo.', {
      code: 'WORKER_PAYMENT_NOT_FOUND',
      status: 404,
    });
  }
  return worker;
}

export async function resolveScopedWorkerPaymentDestination(
  prisma,
  scope,
  personId,
  destinationId,
) {
  const destination = await prisma.workerPaymentDestination.findFirst({
    where: {
      id: destinationId,
      organizationId: scope.organizationId,
      personId,
    },
    select: { id: true, purpose: true },
  });
  if (!destination) {
    throw new WorkerPaymentApiError('El destino de cobro no existe.', {
      code: 'WORKER_PAYMENT_NOT_FOUND',
      status: 404,
    });
  }
  return destination;
}

export function buildServerPaymentDecisionEvidence({
  action,
  access,
  workerId,
  personId,
  destinationId,
  purpose,
  actorMembershipId,
  expectedRevision,
  reason = null,
}) {
  const policyVersion = 'worker-payment-dashboard-v1';
  return {
    policyVersion,
    evidence: {
      source: 'authenticated_tenant_route',
      policyVersion,
      action,
      organizationId: access.organization.id,
      projectId: access.project.id,
      workerId,
      personId,
      destinationId,
      purpose,
      actorMembershipId,
      expectedRevision,
      reason,
    },
  };
}

export function workerPaymentErrorResponse(error) {
  if (error instanceof WorkerPaymentApiError) {
    return workerPaymentJson({ error: error.message, code: error.code }, {
      status: error.status,
      headers: error.retryAfterSeconds
        ? { 'Retry-After': String(error.retryAfterSeconds) }
        : undefined,
    });
  }
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  if (error instanceof WorkerPaymentDestinationError) {
    const errorMessage = error.status >= 500
      ? 'No se pudo procesar el destino de cobro.'
      : error.message;
    return workerPaymentJson({ error: errorMessage, code: error.code }, {
      status: error.status,
    });
  }
  return null;
}

function queryValue(searchParams, key) {
  const value = searchParams.get(key);
  return value === null || value === '' ? undefined : value;
}

export function createWorkerPaymentDestinationHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  resolveWorkerBridge = resolveScopedWorkerPaymentBridge,
  listPaymentDestinations = listWorkerPaymentDestinations,
  submitPaymentDestination = submitWorkerPaymentDestination,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: MAX_SUBMISSION_BODY_BYTES,
  }),
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
  logError = console.error,
} = {}) {
  async function GET(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:payroll:destinations:read', { subscriptionMode: 'read' });
      const actorMembershipId = requireWorkerPaymentActor(access);
      const params = await context?.params;
      const workerId = requireWorkerPaymentRouteId(params?.workerId, 'workerId');
      const searchParams = new URL(request.url).searchParams;
      assertWorkerPaymentSearchParams(searchParams, LIST_QUERY_FIELDS);
      const prisma = prismaFactory();
      const worker = await resolveWorkerBridge(prisma, access, workerId, {
        requireActive: false,
      });
      const result = await listPaymentDestinations(prisma, {
        scope: workerPaymentScope(access),
        personId: worker.personId,
        actorMembershipId,
        purpose: queryValue(searchParams, 'purpose'),
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson(result), correlationId);
    } catch (error) {
      const known = workerPaymentErrorResponse(error);
      if (known) return finalizeWorkerPaymentResponse(known, correlationId);
      logError('Worker payment destination list failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson({
        error: 'No se pudieron cargar los destinos de cobro.',
        code: 'WORKER_PAYMENT_LIST_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  async function POST(request, context) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:payroll:destinations:manage', { subscriptionMode: 'write' });
      const actorMembershipId = requireWorkerPaymentActor(access);
      assertNoWorkerPaymentSearchParams(request);
      const params = await context?.params;
      const workerId = requireWorkerPaymentRouteId(params?.workerId, 'workerId');
      const input = assertWorkerPaymentObject(await parseBody(request), SUBMISSION_FIELDS);
      const operationKey = requireWorkerPaymentIdempotencyKey(request);
      const prisma = prismaFactory();
      const worker = await resolveWorkerBridge(prisma, access, workerId, {
        requireActive: true,
      });
      const result = await submitPaymentDestination(prisma, {
        scope: workerPaymentScope(access),
        personId: worker.personId,
        submittedBy: { type: 'TENANT_MEMBERSHIP', membershipId: actorMembershipId },
        input: { ...input, operationKey },
        now: clock(),
        correlationId,
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson(result, {
        status: result?.replayed ? 200 : 201,
      }), correlationId);
    } catch (error) {
      const known = workerPaymentErrorResponse(error);
      if (known) return finalizeWorkerPaymentResponse(known, correlationId);
      logError('Worker payment destination submission failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeWorkerPaymentResponse(workerPaymentJson({
        error: 'No se pudo registrar el destino de cobro.',
        code: 'WORKER_PAYMENT_SUBMISSION_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createWorkerPaymentDestinationHandlers();
