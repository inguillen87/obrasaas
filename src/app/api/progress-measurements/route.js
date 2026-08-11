import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  normalizeProgressMeasurementListQuery,
  PROGRESS_MEASUREMENT_MAX_BODY_BYTES,
  ProgressMeasurementError,
  progressMeasurementErrorResponse,
  readTaskProgressMeasurementSnapshot,
  requireProgressMeasurementIdempotencyKey,
  submitProgressMeasurement,
} from '@/lib/progress-measurements';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import {
  resolveRequestCorrelationId,
  withCorrelationId,
} from '@/lib/request-correlation';

export const runtime = 'nodejs';

function finalized(request, response, replayed = null) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Vary', 'Cookie, Authorization');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (replayed !== null) headers.set('Idempotency-Replayed', String(replayed));
  return withCorrelationId(new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  }), resolveRequestCorrelationId(request));
}

function known(request, error) {
  let response = null;
  if (error instanceof AccessError) response = accessErrorResponse(error);
  else if (error instanceof RequestBodyError) response = requestBodyErrorResponse(error);
  else response = progressMeasurementErrorResponse(error);
  return response ? finalized(request, response) : null;
}

function unexpected(request, error, operation, logError) {
  const correlationId = resolveRequestCorrelationId(request);
  logError('progress_measurements.unexpected', {
    correlationId,
    operation,
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : null,
  });
  return finalized(request, Response.json({
    error: operation === 'read'
      ? 'No se pudieron cargar las mediciones.'
      : 'No se pudo registrar la medición.',
    code: operation === 'read'
      ? 'PROGRESS_MEASUREMENT_READ_FAILED'
      : 'PROGRESS_MEASUREMENT_WRITE_FAILED',
  }, { status: 500 }));
}

function scopeFrom(access) {
  return {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
}

function requireActorMembership(access) {
  if (!access.tenantMembershipId) {
    throw new AccessError('Una membresía activa en la organización es obligatoria.', {
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  }
  return access.tenantMembershipId;
}

export function createProgressMeasurementHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  normalizeQuery = normalizeProgressMeasurementListQuery,
  readSnapshot = readTaskProgressMeasurementSnapshot,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: PROGRESS_MEASUREMENT_MAX_BODY_BYTES,
  }),
  submit = submitProgressMeasurement,
  logError = console.error,
} = {}) {
  return {
    async GET(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:measurements:read', { subscriptionMode: 'read' });
        const actorMembershipId = requireActorMembership(access);
        const query = normalizeQuery(request);
        const result = await readSnapshot(prismaFactory(), {
          scope: scopeFrom(access),
          query,
          actorMembershipId,
        });
        return finalized(request, Response.json(result));
      } catch (error) {
        return known(request, error) || unexpected(request, error, 'read', logError);
      }
    },

    async POST(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:measurements:prepare', { subscriptionMode: 'write' });
        const actorMembershipId = requireActorMembership(access);
        if (new URL(request.url).searchParams.size !== 0) {
          throw new ProgressMeasurementError(
            'La ruta no admite parámetros de consulta.',
            'PROGRESS_MEASUREMENT_QUERY_INVALID',
          );
        }
        const operationKey = requireProgressMeasurementIdempotencyKey(request);
        const input = await parseBody(request);
        const result = await submit(prismaFactory(), {
          scope: scopeFrom(access),
          actorMembershipId,
          operationKey,
          input,
        });
        return finalized(request, Response.json(result, {
          status: result.replayed ? 200 : 201,
        }), result.replayed);
      } catch (error) {
        return known(request, error) || unexpected(request, error, 'submit', logError);
      }
    },
  };
}

const handlers = createProgressMeasurementHandlers();

export async function GET(request) {
  return handlers.GET(request);
}

export async function POST(request) {
  return handlers.POST(request);
}
