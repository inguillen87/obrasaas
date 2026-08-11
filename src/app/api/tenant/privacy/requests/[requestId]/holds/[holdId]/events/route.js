import { appendDataSubjectLegalHoldEvent } from '@/lib/data-subject-review';
import { createDataSubjectReviewMutationHandler } from '@/lib/data-subject-review-routes';

export const runtime = 'nodejs';

export function createDataSubjectLegalHoldEventHandlers({
  appendHoldEvent = appendDataSubjectLegalHoldEvent,
  ...dependencies
} = {}) {
  return {
    POST: createDataSubjectReviewMutationHandler({
      operationName: 'legal_hold_event_append',
      execute: appendHoldEvent,
      ...dependencies,
    }),
  };
}

const handlers = createDataSubjectLegalHoldEventHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
