import {
  readDataSubjectRequestReview,
  resolveDataSubjectReviewKeyConfig,
} from '@/lib/data-subject-review';
import {
  assertDataSubjectReviewQueryEmpty,
  authorizeDataSubjectReviewAccess,
  dataSubjectReviewKnownErrorResponse,
  dataSubjectReviewScope,
  dataSubjectReviewUnexpectedErrorMetadata,
  finalizeDataSubjectReviewResponse,
} from '@/lib/data-subject-review-routes';
import { getPlatformAccess } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';

export const runtime = 'nodejs';

export function createDataSubjectReviewHandlers({
  resolveAccess = (options) => getPlatformAccess(options),
  authorize = authorizeDataSubjectReviewAccess,
  prismaFactory = getPrisma,
  resolveKeyConfig = resolveDataSubjectReviewKeyConfig,
  readReview = readDataSubjectRequestReview,
  resolveCorrelationId = resolveRequestCorrelationId,
  logError = console.error,
} = {}) {
  return {
    async GET(request, { params }) {
      const correlationId = resolveCorrelationId(request);
      try {
        const access = await resolveAccess({
          requireProject: false,
          resolveProject: false,
        });
        authorize(access);
        assertDataSubjectReviewQueryEmpty(request);
        const { requestId } = await params;
        const { key } = resolveKeyConfig();
        const result = await readReview(prismaFactory(), {
          scope: dataSubjectReviewScope(access),
          requestId,
          fingerprintKey: key,
        });
        return finalizeDataSubjectReviewResponse(
          Response.json(result),
          correlationId,
        );
      } catch (error) {
        const known = dataSubjectReviewKnownErrorResponse(error);
        if (known) return finalizeDataSubjectReviewResponse(known, correlationId);
        logError('privacy_review.unexpected', {
          correlationId,
          operation: 'review_read',
          ...dataSubjectReviewUnexpectedErrorMetadata(error),
        });
        return finalizeDataSubjectReviewResponse(Response.json({
          error: 'No se pudo cargar la revisión de privacidad.',
          code: 'PRIVACY_REVIEW_FAILED',
        }, { status: 500 }), correlationId);
      }
    },
  };
}

const handlers = createDataSubjectReviewHandlers();

export async function GET(request, context) {
  return handlers.GET(request, context);
}
