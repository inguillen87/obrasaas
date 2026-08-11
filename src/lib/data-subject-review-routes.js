import 'server-only';

import {
  AccessError,
  accessErrorResponse,
  getPlatformAccess,
  hasTenantPermission,
} from '@/lib/access';
import {
  DATA_SUBJECT_REVIEW_MAX_BODY_BYTES,
  dataSubjectReviewErrorResponse,
  requireDataSubjectReviewIdempotencyKey,
  resolveDataSubjectReviewKeyConfig,
} from '@/lib/data-subject-review';
import { getPrisma } from '@/lib/prisma';
import {
  RequestBodyError,
  readJsonRequest,
  requestBodyErrorResponse,
} from '@/lib/request-body';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';

const PRIVACY_PERMISSION = 'org:privacy:requests:manage';

export function authorizeDataSubjectReviewAccess(access) {
  if (
    !access?.organization?.id
    || !access?.tenantMembershipId
    || !hasTenantPermission(access, PRIVACY_PERMISSION)
  ) {
    throw new AccessError(`Permission ${PRIVACY_PERMISSION} is required.`, {
      code: access?.tenantMembershipId
        ? 'PERMISSION_REQUIRED'
        : 'TENANT_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  }
  return access;
}

export function dataSubjectReviewScope(access) {
  return {
    organizationId: access.organization.id,
    actorMembershipId: access.tenantMembershipId,
  };
}

export function assertDataSubjectReviewQueryEmpty(request) {
  if (new URL(request.url).searchParams.size !== 0) {
    throw new AccessError('La ruta no admite parámetros de consulta.', {
      code: 'PRIVACY_REVIEW_QUERY_INVALID',
      status: 400,
    });
  }
}

export function finalizeDataSubjectReviewResponse(
  response,
  correlationId,
  replayed = null,
) {
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

export function dataSubjectReviewKnownErrorResponse(error) {
  if (error instanceof AccessError) return accessErrorResponse(error);
  if (error instanceof RequestBodyError) return requestBodyErrorResponse(error);
  return dataSubjectReviewErrorResponse(error);
}

export function dataSubjectReviewUnexpectedErrorMetadata(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  return {
    errorKind: 'UNEXPECTED',
    databaseCode: /^(?:P\d{4}|[0-9A-Z]{5})$/.test(code) ? code : null,
  };
}

export function createDataSubjectReviewMutationHandler({
  operationName,
  execute,
  maxBodyBytes = DATA_SUBJECT_REVIEW_MAX_BODY_BYTES,
  resolveAccess = (options) => getPlatformAccess(options),
  authorize = authorizeDataSubjectReviewAccess,
  prismaFactory = getPrisma,
  readBody = (request) => readJsonRequest(request, { maxBytes: maxBodyBytes }),
  resolveKeyConfig = resolveDataSubjectReviewKeyConfig,
  resolveCorrelationId = resolveRequestCorrelationId,
  logError = console.error,
} = {}) {
  if (typeof execute !== 'function' || typeof operationName !== 'string') {
    throw new TypeError('A data-subject review operation is required.');
  }
  return async function POST(request, context = { params: Promise.resolve({}) }) {
    const correlationId = resolveCorrelationId(request);
    try {
      const access = await resolveAccess({
        requireProject: false,
        resolveProject: false,
      });
      authorize(access);
      assertDataSubjectReviewQueryEmpty(request);
      const idempotencyKey = requireDataSubjectReviewIdempotencyKey(request);
      const input = await readBody(request);
      const params = await context.params;
      const { key, keyId } = resolveKeyConfig();
      const result = await execute(prismaFactory(), {
        scope: dataSubjectReviewScope(access),
        ...params,
        input,
        idempotencyKey,
        fingerprintKey: key,
        fingerprintKeyId: keyId,
      });
      return finalizeDataSubjectReviewResponse(Response.json(result, {
        status: result.replayed ? 200 : 201,
      }), correlationId, result.replayed);
    } catch (error) {
      const known = dataSubjectReviewKnownErrorResponse(error);
      if (known) return finalizeDataSubjectReviewResponse(known, correlationId);
      logError('privacy_review.unexpected', {
        correlationId,
        operation: operationName,
        ...dataSubjectReviewUnexpectedErrorMetadata(error),
      });
      return finalizeDataSubjectReviewResponse(Response.json({
        error: 'No se pudo procesar la revisión de privacidad.',
        code: 'PRIVACY_REVIEW_FAILED',
      }, { status: 500 }), correlationId);
    }
  };
}
