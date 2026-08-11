import {
  createDataSubjectDecision,
  DATA_SUBJECT_DECISION_MAX_BODY_BYTES,
} from '@/lib/data-subject-review';
import { createDataSubjectReviewMutationHandler } from '@/lib/data-subject-review-routes';

export const runtime = 'nodejs';

export function createDataSubjectDecisionHandlers({
  createDecision = createDataSubjectDecision,
  ...dependencies
} = {}) {
  return {
    POST: createDataSubjectReviewMutationHandler({
      operationName: 'decision_create',
      execute: createDecision,
      maxBodyBytes: DATA_SUBJECT_DECISION_MAX_BODY_BYTES,
      ...dependencies,
    }),
  };
}

const handlers = createDataSubjectDecisionHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
