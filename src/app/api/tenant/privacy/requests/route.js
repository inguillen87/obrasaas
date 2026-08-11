import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
} from '@/lib/access';
import {
  createAndDiscoverWorkerPersonRequest,
  DATA_SUBJECT_REQUEST_MAX_BODY_BYTES,
  dataSubjectRequestErrorResponse,
  requireDataSubjectIdempotencyKey,
} from '@/lib/data-subject-requests';
import {
  dataSubjectReviewErrorResponse,
  listDataSubjectRequestsForReview,
  normalizeDataSubjectReviewListQuery,
  resolveDataSubjectReviewKeyConfig,
} from '@/lib/data-subject-review';
import {
  authorizeDataSubjectReviewAccess,
  dataSubjectReviewScope,
  dataSubjectReviewUnexpectedErrorMetadata,
} from '@/lib/data-subject-review-routes';
import { getPrisma } from '@/lib/prisma';
import {
  PrivacyDiscoveryError,
  resolvePrivacyDiscoveryKeyConfig,
} from '@/lib/privacy-discovery';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';

export const runtime = 'nodejs';

const PRIVACY_PERMISSION = 'org:privacy:requests:manage';

function authorizePrivacyAccess(access) {
  if (!hasTenantPermission(access, PRIVACY_PERMISSION)) {
    throw new AccessError(`Permission ${PRIVACY_PERMISSION} is required.`, {
      code: 'PERMISSION_REQUIRED',
      status: 403,
    });
  }
  return access;
}

function finalized(response, correlationId, replayed = null) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0');
  headers.set('Vary', 'Cookie, Authorization');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('x-request-id', correlationId);
  if (replayed !== null) headers.set('Idempotency-Replayed', String(replayed));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function privacyDiscoveryErrorResponse(error) {
  if (!(error instanceof PrivacyDiscoveryError)) return null;
  return Response.json(
    { error: error.message, code: error.code },
    { status: error.status },
  );
}

export function createDataSubjectRequestHandlers({
  resolveAccess = (options) => getPlatformAccess(options),
  authorize = authorizePrivacyAccess,
  prismaFactory = getPrisma,
  parseBody = (request) => readJsonRequest(request, {
    maxBytes: DATA_SUBJECT_REQUEST_MAX_BODY_BYTES,
  }),
  resolveKeyConfig = resolvePrivacyDiscoveryKeyConfig,
  resolveReviewKeyConfig = resolveDataSubjectReviewKeyConfig,
  createRequest = createAndDiscoverWorkerPersonRequest,
  listRequests = listDataSubjectRequestsForReview,
  normalizeListQuery = normalizeDataSubjectReviewListQuery,
  authorizeReview = authorizeDataSubjectReviewAccess,
  resolveCorrelationId = resolveRequestCorrelationId,
  logError = console.error,
} = {}) {
  async function GET(request) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess({
        requireProject: false,
        resolveProject: false,
      });
      authorizeReview(access);
      const { key } = resolveReviewKeyConfig();
      const query = normalizeListQuery(request, {
        organizationId: access.organization.id,
        fingerprintKey: key,
      });
      const result = await listRequests(prismaFactory(), {
        scope: dataSubjectReviewScope(access),
        query,
        fingerprintKey: key,
      });
      return finalized(Response.json(result), correlationId);
    } catch (error) {
      let known = null;
      if (error instanceof AccessError) known = accessErrorResponse(error);
      else known = dataSubjectReviewErrorResponse(error);
      if (known) return finalized(known, correlationId);
      logError('Privacy review list failed', {
        correlationId,
        ...dataSubjectReviewUnexpectedErrorMetadata(error),
      });
      return finalized(Response.json({
        error: 'No se pudo cargar la cola de privacidad.',
        code: 'PRIVACY_REVIEW_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  async function POST(request) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess({
        requireProject: false,
        resolveProject: false,
      });
      authorize(access);
      if (new URL(request.url).searchParams.size !== 0) {
        return finalized(Response.json({
          error: 'La ruta no admite parámetros de consulta.',
          code: 'PRIVACY_QUERY_INVALID',
        }, { status: 400 }), correlationId);
      }
      const idempotencyKey = requireDataSubjectIdempotencyKey(request);
      const input = await parseBody(request);
      const { key, keyId } = resolveKeyConfig();
      const result = await createRequest(prismaFactory(), {
        scope: {
          organizationId: access.organization.id,
          actorMembershipId: access.tenantMembershipId,
        },
        input,
        idempotencyKey,
        fingerprintKey: key,
        fingerprintKeyId: keyId,
      });
      return finalized(Response.json(result, {
        status: result.replayed ? 200 : 201,
      }), correlationId, result.replayed);
    } catch (error) {
      let known = null;
      if (error instanceof AccessError) known = accessErrorResponse(error);
      else if (error instanceof RequestBodyError) known = requestBodyErrorResponse(error);
      else known = dataSubjectRequestErrorResponse(error)
        || privacyDiscoveryErrorResponse(error);
      if (known) return finalized(known, correlationId);
      logError('Privacy request discovery failed', {
        name: error?.name,
        code: error?.code,
        correlationId,
        requestId: error?.requestId || null,
      });
      return finalized(Response.json({
        error: 'No se pudo procesar la solicitud de privacidad.',
        code: 'PRIVACY_REQUEST_FAILED',
      }, { status: 500 }), correlationId);
    }
  }

  return { GET, POST };
}

export const { GET, POST } = createDataSubjectRequestHandlers();
