import { createHash } from 'node:crypto';

import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';
import {
  WorkerOnboardingError,
  listWorkerOnboardingClaims,
  workerOnboardingErrorResponse,
} from '@/lib/worker-onboarding';

export const runtime = 'nodejs';

const LIST_QUERY_FIELDS = new Set(['status', 'cursor', 'limit']);
const SAFE_IDENTIFIER = /^[^\u0000-\u001f\u007f]{1,190}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const MAX_PRISMA_INT = 2_147_483_647;

export class WorkerSensitiveApiError extends Error {
  constructor(message, { code = 'WORKER_SENSITIVE_REQUEST_INVALID', status = 400 } = {}) {
    super(message);
    this.name = 'WorkerSensitiveApiError';
    this.code = code;
    this.status = status;
  }
}

export function workerSensitiveJson(payload, init = {}) {
  return Response.json(payload, {
    ...init,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      ...init.headers,
    },
  });
}

export function finalizeWorkerSensitiveResponse(response, correlationId) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return withCorrelationId(response, correlationId);
}

export function workerSensitiveScope(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

export function requireTenantMembershipActor(access) {
  const membershipId = typeof access?.tenantMembershipId === 'string'
    ? access.tenantMembershipId.trim()
    : '';
  if (!SAFE_IDENTIFIER.test(membershipId)) {
    throw new WorkerSensitiveApiError(
      'Una membresia tenant activa es obligatoria para operar datos sensibles.',
      { code: 'TENANT_MEMBERSHIP_REQUIRED', status: 403 },
    );
  }
  return membershipId;
}

export function requireWorkerSensitiveRouteId(value, field) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER.test(id)) {
    throw new WorkerSensitiveApiError(`${field} no existe.`, {
      code: 'WORKER_SENSITIVE_RESOURCE_NOT_FOUND',
      status: 404,
    });
  }
  return id;
}

export function requireWorkerSensitiveIdempotencyKey(request) {
  const key = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new WorkerSensitiveApiError(
      'Envia un encabezado Idempotency-Key valido de entre 8 y 128 caracteres.',
      { code: 'IDEMPOTENCY_KEY_INVALID', status: 400 },
    );
  }
  return key;
}

export function assertWorkerSensitiveObject(input, allowedFields) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WorkerSensitiveApiError('El cuerpo debe ser un objeto JSON.', {
      code: 'WORKER_SENSITIVE_REQUEST_INVALID',
      status: 400,
    });
  }
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new WorkerSensitiveApiError('La solicitud contiene campos no permitidos.', {
      code: 'WORKER_SENSITIVE_UNKNOWN_FIELDS',
      status: 400,
    });
  }
  return input;
}

export function assertWorkerSensitiveSearchParams(searchParams, allowedFields) {
  for (const key of searchParams.keys()) {
    if (!allowedFields.has(key) || searchParams.getAll(key).length !== 1) {
      throw new WorkerSensitiveApiError('La consulta contiene filtros no permitidos.', {
        code: 'WORKER_SENSITIVE_QUERY_INVALID',
        status: 400,
      });
    }
  }
}

export function assertNoWorkerSensitiveSearchParams(request) {
  assertWorkerSensitiveSearchParams(new URL(request.url).searchParams, new Set());
}

export function requireWorkerSensitiveRevision(value) {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
    || value > MAX_PRISMA_INT
  ) {
    throw new WorkerSensitiveApiError('expectedRevision debe ser un entero entre 0 y 2147483647.', {
      code: 'WORKER_SENSITIVE_REQUEST_INVALID',
      status: 400,
    });
  }
  return value;
}

function canonicalValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]),
  );
}

export function buildServerOnboardingDecisionEvidence({
  action,
  scope,
  claimId,
  actorMembershipId,
  expectedRevision,
  rejectionReason = null,
}) {
  const policyVersion = 'worker-onboarding-dashboard-v1';
  const evidenceHash = createHash('sha256')
    .update(`obrasaas:worker-onboarding:route-decision:v1\0${JSON.stringify(canonicalValue({
      source: 'authenticated_tenant_route',
      policyVersion,
      action,
      scope,
      claimId,
      actorMembershipId,
      expectedRevision,
      rejectionReason,
    }))}`)
    .digest('hex');
  return { evidenceHash, policyVersion };
}

export function workerSensitiveErrorResponse(error) {
  if (error instanceof WorkerSensitiveApiError) {
    return workerSensitiveJson({ error: error.message, code: error.code }, {
      status: error.status,
      headers: error.retryAfterSeconds
        ? { 'Retry-After': String(error.retryAfterSeconds) }
        : undefined,
    });
  }
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof WorkerOnboardingError) return workerOnboardingErrorResponse(error);
  return null;
}

function queryValue(searchParams, key) {
  const value = searchParams.get(key);
  return value === null || value === '' ? undefined : value;
}

export function createWorkerOnboardingClaimHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  listClaims = listWorkerOnboardingClaims,
  resolveCorrelationId = resolveRequestCorrelationId,
  clock = () => new Date(),
  logError = console.error,
} = {}) {
  async function GET(request) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess();
      authorize(access, 'org:workers:onboarding:read', { subscriptionMode: 'read' });
      const membershipId = requireTenantMembershipActor(access);
      const searchParams = new URL(request.url).searchParams;
      assertWorkerSensitiveSearchParams(searchParams, LIST_QUERY_FIELDS);
      const claims = await listClaims(prismaFactory(), {
        scope: workerSensitiveScope(access),
        requestedByMembershipId: membershipId,
        status: queryValue(searchParams, 'status'),
        cursor: queryValue(searchParams, 'cursor'),
        limit: queryValue(searchParams, 'limit'),
        now: clock(),
      });
      return finalizeWorkerSensitiveResponse(workerSensitiveJson(claims), correlationId);
    } catch (error) {
      const known = workerSensitiveErrorResponse(error);
      if (known) return finalizeWorkerSensitiveResponse(known, correlationId);
      logError('Worker onboarding claim list failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
      });
      return finalizeWorkerSensitiveResponse(workerSensitiveJson({
        error: 'No se pudieron cargar las altas de operarios.',
        code: 'WORKER_ONBOARDING_LIST_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { GET };
}

export const { GET } = createWorkerOnboardingClaimHandlers();
