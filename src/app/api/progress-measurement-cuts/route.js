import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  normalizeProgressMeasurementCutQuery,
  PROGRESS_MEASUREMENT_CUT_MAX_BODY_BYTES,
  ProgressMeasurementCutError,
  progressMeasurementCutErrorResponse,
  readProgressMeasurementCutSnapshot,
  requireProgressMeasurementCutIdempotencyKey,
  sealProgressMeasurementCut,
} from '@/lib/progress-measurement-cuts';
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
  else response = progressMeasurementCutErrorResponse(error);
  return response ? finalized(request, response) : null;
}

function unexpected(request, error, operation, logError) {
  const correlationId = resolveRequestCorrelationId(request);
  logError('progress_measurement_cuts.unexpected', {
    correlationId,
    operation,
    name: typeof error?.name === 'string' ? error.name : 'Error',
    code: typeof error?.code === 'string' ? error.code : null,
  });
  return finalized(request, Response.json({
    error: operation === 'read'
      ? 'No se pudo cargar el corte técnico.'
      : 'No se pudo sellar el corte técnico.',
    code: operation === 'read'
      ? 'PROGRESS_MEASUREMENT_CUT_READ_FAILED'
      : 'PROGRESS_MEASUREMENT_CUT_WRITE_FAILED',
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

export function createProgressMeasurementCutHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  normalizeQuery = normalizeProgressMeasurementCutQuery,
  readSnapshot = readProgressMeasurementCutSnapshot,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: PROGRESS_MEASUREMENT_CUT_MAX_BODY_BYTES,
  }),
  seal = sealProgressMeasurementCut,
  logError = console.error,
} = {}) {
  return {
    async GET(request) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:measurement-cuts:read', { subscriptionMode: 'read' });
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
        authorize(access, 'org:measurement-cuts:seal', { subscriptionMode: 'write' });
        const actorMembershipId = requireActorMembership(access);
        if (new URL(request.url).searchParams.size !== 0) {
          throw new ProgressMeasurementCutError(
            'La ruta no admite parámetros de consulta.',
            'PROGRESS_MEASUREMENT_CUT_QUERY_INVALID',
          );
        }
        const operationKey = requireProgressMeasurementCutIdempotencyKey(request);
        const input = await parseBody(request);
        const result = await seal(prismaFactory(), {
          scope: scopeFrom(access),
          actorMembershipId,
          operationKey,
          input,
        });
        return finalized(request, Response.json(result, {
          status: result.replayed ? 200 : 201,
        }), result.replayed);
      } catch (error) {
        return known(request, error) || unexpected(request, error, 'seal', logError);
      }
    },
  };
}

const handlers = createProgressMeasurementCutHandlers();

export async function GET(request) {
  return handlers.GET(request);
}

export async function POST(request) {
  return handlers.POST(request);
}
