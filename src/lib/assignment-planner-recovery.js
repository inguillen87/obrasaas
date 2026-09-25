// Only confirmed, pre-write domain rejections may discard the current request key.
// Unknown transport/server failures must retain the exact attempt for reconciliation.
export function assignmentPlanRecovery(failure = {}) {
  if (failure.status === 409) {
    if (['ASSIGNMENT_DUPLICATE', 'ASSIGNMENT_REVIEW_CHANGED'].includes(failure.code)) return 'revise';
    if (['ASSIGNMENT_TASK_CHANGED', 'ASSIGNMENT_OWNER_UNAVAILABLE'].includes(failure.code)) return 'refresh';
  }
  if ([400, 422].includes(failure.status)) return 'revise';
  if ([401, 402, 403, 404, 409, 410].includes(failure.status)) return 'blocked';
  return 'uncertain';
}

// Retrying a failed GET never retries a mutation. Scope/auth failures stay closed.
export function assignmentSourceRecovery(failure = {}) {
  if (failure.code === 'ASSIGNMENT_SOURCE_UNCONFIRMED'
    || [400, 401, 402, 403, 404, 409, 410, 422].includes(failure.status)) return 'blocked';
  return 'retry';
}
