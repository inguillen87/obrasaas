import { appendDataSubjectRequesterVerificationEvent } from '@/lib/data-subject-review';
import { createDataSubjectReviewMutationHandler } from '@/lib/data-subject-review-routes';

export const runtime = 'nodejs';

export function createDataSubjectVerificationEventHandlers({
  appendVerification = appendDataSubjectRequesterVerificationEvent,
  ...dependencies
} = {}) {
  return {
    POST: createDataSubjectReviewMutationHandler({
      operationName: 'verification_event_append',
      execute: appendVerification,
      ...dependencies,
    }),
  };
}

const handlers = createDataSubjectVerificationEventHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
