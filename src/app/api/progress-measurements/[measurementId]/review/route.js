import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import {
  PROGRESS_MEASUREMENT_REVIEW_MAX_BODY_BYTES,
  ProgressMeasurementError,
  progressMeasurementErrorResponse,
  requireProgressMeasurementIdempotencyKey,
  reviewProgressMeasurement,
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

function scopeFrom(access) {
  return { organizationId: access.organization.id, projectId: access.project.id };
}

export function createProgressMeasurementReviewHandlers({
  resolveAccess = getPlatformAccess,
  authorize = requireTenantPermission,
  prismaFactory = getPrisma,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: PROGRESS_MEASUREMENT_REVIEW_MAX_BODY_BYTES,
  }),
  review = reviewProgressMeasurement,
  logError = console.error,
} = {}) {
  return {
    async POST(request, { params }) {
      try {
        const access = await resolveAccess();
        authorize(access, 'org:measurements:approve', { subscriptionMode: 'write' });
        if (!access.tenantMembershipId) {
          throw new AccessError('Una membresía activa en la organización es obligatoria.', {
            code: 'TENANT_MEMBERSHIP_REQUIRED',
            status: 403,
          });
        }
        if (new URL(request.url).searchParams.size !== 0) {
          throw new ProgressMeasurementError(
            'La ruta no admite parámetros de consulta.',
            'PROGRESS_MEASUREMENT_QUERY_INVALID',
          );
        }
        const { measurementId } = await params;
        const operationKey = requireProgressMeasurementIdempotencyKey(request);
        const input = await parseBody(request);
        const result = await review(prismaFactory(), {
          scope: scopeFrom(access),
          actorMembershipId: access.tenantMembershipId,
          measurementId,
          operationKey,
          input,
        });
        return finalized(request, Response.json(result, {
          status: result.replayed ? 200 : 201,
        }), result.replayed);
      } catch (error) {
        const knownResponse = known(request, error);
        if (knownResponse) return knownResponse;
        const correlationId = resolveRequestCorrelationId(request);
        logError('progress_measurements.unexpected', {
          correlationId,
          operation: 'review',
          name: typeof error?.name === 'string' ? error.name : 'Error',
          code: typeof error?.code === 'string' ? error.code : null,
        });
        return finalized(request, Response.json({
          error: 'No se pudo decidir la medición.',
          code: 'PROGRESS_MEASUREMENT_REVIEW_FAILED',
        }, { status: 500 }));
      }
    },
  };
}

const handlers = createProgressMeasurementReviewHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
