import { appendDataSubjectLegalAssessment } from '@/lib/data-subject-review';
import { createDataSubjectReviewMutationHandler } from '@/lib/data-subject-review-routes';

export const runtime = 'nodejs';

export function createDataSubjectLegalAssessmentHandlers({
  appendAssessment = appendDataSubjectLegalAssessment,
  ...dependencies
} = {}) {
  return {
    POST: createDataSubjectReviewMutationHandler({
      operationName: 'legal_assessment_append',
      execute: appendAssessment,
      ...dependencies,
    }),
  };
}

const handlers = createDataSubjectLegalAssessmentHandlers();

export async function POST(request, context) {
  return handlers.POST(request, context);
}
