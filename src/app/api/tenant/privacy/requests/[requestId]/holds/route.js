import { createDataSubjectLegalHold } from '@/lib/data-subject-review';
import { createDataSubjectReviewMutationHandler } from '@/lib/data-subject-review-routes';

export const runtime = 'nodejs';

export function createDataSubjectLegalHoldHandlers({
  createHold = createDataSubjectLegalHold,
  ...dependencies
} = {}) {
  return {
    POST: createDataSubjectReviewMutationHandler({
      operationName: 'legal_hold_create',
      execute: createHold,
      ...dependencies,
    }),
  };
}

const handlers = createDataSubjectLegalHoldHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
