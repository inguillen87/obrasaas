import { decideDataSubjectDecision } from '@/lib/data-subject-review';
import { createDataSubjectReviewMutationHandler } from '@/lib/data-subject-review-routes';

export const runtime = 'nodejs';

export function createDataSubjectDecisionApprovalHandlers({
  decide = decideDataSubjectDecision,
  ...dependencies
} = {}) {
  return {
    POST: createDataSubjectReviewMutationHandler({
      operationName: 'decision_decide',
      execute: decide,
      ...dependencies,
    }),
  };
}

const handlers = createDataSubjectDecisionApprovalHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
