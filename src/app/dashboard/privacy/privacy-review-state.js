const FORBIDDEN_DTO_SEGMENTS = new Set([
  'address',
  'actor',
  'alias',
  'cipher',
  'ciphertext',
  'cbu',
  'cuit',
  'email',
  'fingerprint',
  'fullname',
  'hash',
  'hmac',
  'name',
  'owner',
  'phone',
  'secret',
  'sha',
  'sha256',
  'source',
]);

const PRIVACY_MUTATION_RESOURCE_KEYS = Object.freeze([
  'verification',
  'legalAssessment',
  'hold',
  'decision',
]);

export class PrivacyCommittedResponseError extends Error {
  constructor() {
    super('El servidor respondió 2xx, pero su confirmación no pudo validarse.');
    this.name = 'PrivacyCommittedResponseError';
  }
}

function keySegments(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function assertPrivacyReviewDtoSafe(value, path = 'response') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => (
      assertPrivacyReviewDtoSafe(entry, `${path}[${index}]`)
    ));
    return value;
  }
  if (!value || typeof value !== 'object') return value;
  for (const [key, entry] of Object.entries(value)) {
    if (keySegments(key).some((segment) => FORBIDDEN_DTO_SEGMENTS.has(segment))) {
      throw new Error(`Contrato de privacidad inválido en ${path}.${key}.`);
    }
    assertPrivacyReviewDtoSafe(entry, `${path}.${key}`);
  }
  return value;
}

function assertPrivacyMutationEnvelope(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('La confirmación de privacidad no es un objeto.');
  }
  const resourceKeys = PRIVACY_MUTATION_RESOURCE_KEYS.filter((key) => (
    Object.hasOwn(value, key)
  ));
  if (
    resourceKeys.length !== 1
    || Object.keys(value).length !== 3
    || typeof value.replayed !== 'boolean'
    || value.executionAllowed !== false
  ) {
    throw new Error('La confirmación de privacidad no cumple el contrato.');
  }
  const resource = value[resourceKeys[0]];
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    throw new Error('El recurso confirmado no cumple el contrato.');
  }
  return value;
}

export function assertPrivacySuccessfulResponseDtoSafe(value, { mutation = false } = {}) {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('La respuesta de privacidad no es un objeto.');
    }
    if (mutation) assertPrivacyMutationEnvelope(value);
    return assertPrivacyReviewDtoSafe(value);
  } catch (error) {
    if (mutation) throw new PrivacyCommittedResponseError();
    throw error;
  }
}

export const INITIAL_PRIVACY_REVIEW_STATE = Object.freeze({
  queue: {
    status: 'idle',
    sequence: 0,
    requests: [],
    nextCursor: null,
    error: null,
  },
  selectedRequestId: null,
  review: {
    status: 'idle',
    sequence: 0,
    data: null,
    error: null,
  },
  mutation: {
    status: 'idle',
    label: null,
    error: null,
    uncertainOperation: null,
    reconciliationRequestId: null,
    reconciliation: 'idle',
    notice: null,
  },
  forms: null,
});

export function privacyReviewInteractionIsLocked(mutation) {
  return mutation?.status === 'submitting'
    || mutation?.status === 'uncertain'
    || mutation?.status === 'reconciliation_required';
}

export function privacyReviewSilentFailureAllowed(error) {
  if (error instanceof TypeError) return true;
  const status = error?.status;
  return Number.isSafeInteger(status) && (status === 429 || status >= 500);
}

export const PRIVACY_APPROVAL_POLL_INTERVAL_MS = 4_000;

export function privacyApprovalPollRequestId({
  mounted,
  visibilityState,
  reviewStatus,
  selectedRequestId,
  reviewRequestId,
  reviewState,
  interactionLocked,
  reviewInFlight,
  mutationInFlight,
  pollInFlight,
}) {
  if (
    mounted !== true
    || visibilityState !== 'visible'
    || reviewStatus !== 'ready'
    || typeof selectedRequestId !== 'string'
    || selectedRequestId.length === 0
    || reviewRequestId !== selectedRequestId
    || reviewState !== 'APPROVAL_PENDING'
    || interactionLocked !== false
    || reviewInFlight !== false
    || mutationInFlight !== false
    || pollInFlight !== false
  ) {
    return null;
  }
  return selectedRequestId;
}

function decisionItemDraft(item) {
  const blocker = item.kind === 'COVERAGE_BLOCKER';
  return {
    action: blocker ? 'UNRESOLVED' : '',
    legalBasisCode: '',
    retentionPolicyVersion: '',
    retentionRuleCode: '',
    retentionUntil: '',
  };
}

export function formsFromReview(review) {
  if (!review) return null;
  const verification = review.requesterVerification;
  const assessment = review.legalAssessment;
  return {
    verification: {
      eventKind: '',
      requesterKind: '',
      expectedHeadEventId: verification?.id || '',
      expectedSubjectIdentityRevision: review.request.subjectIdentityRevision
        ? String(review.request.subjectIdentityRevision)
        : '',
      verificationMethodCode: '',
      verificationPolicyVersion: '',
      requesterEvidenceSha256: '',
      challengeEvidenceSha256: '',
      identityEvidenceSha256: '',
      validUntil: '',
      representationMethodCode: '',
      representationEvidenceSha256: '',
      representationValidUntil: '',
      revocationReasonCode: '',
    },
    assessment: {
      expectedHeadAssessmentId: assessment?.id || '',
      jurisdictionCode: '',
      dueAt: '',
      deadlinePolicyVersion: '',
      deadlinePolicySha256: '',
      retentionMatrixVersion: '',
      retentionMatrixSha256: '',
      legalReviewEvidenceSha256: '',
    },
    hold: {
      scopeKind: '',
      scopeValue: '',
      basisCode: '',
      policyVersion: '',
      evidenceSha256: '',
      reviewDueAt: '',
    },
    holdEvent: {
      holdId: '',
      eventKind: '',
      basisCode: '',
      policyVersion: '',
      evidenceSha256: '',
      reviewDueAt: '',
      releaseReasonCode: '',
      releaseEvidenceSha256: '',
    },
    decisionItems: Object.fromEntries(
      (review.reviewItems || []).map((item) => [
        item.reviewItemId,
        decisionItemDraft(item),
      ]),
    ),
    approval: {
      decision: '',
      reasonCode: '',
    },
  };
}

function mergeQueueRequests(current, incoming) {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()];
}

export function privacyReviewReducer(state, action) {
  switch (action.type) {
    case 'QUEUE_LOADING':
      return {
        ...state,
        queue: {
          ...state.queue,
          status: 'loading',
          sequence: action.sequence,
          error: null,
          ...(action.append ? {} : { requests: [], nextCursor: null }),
        },
      };
    case 'QUEUE_SUCCESS':
      if (action.sequence !== state.queue.sequence) return state;
      return {
        ...state,
        queue: {
          status: 'ready',
          sequence: action.sequence,
          requests: action.append
            ? mergeQueueRequests(state.queue.requests, action.payload.requests)
            : action.payload.requests,
          nextCursor: action.payload.nextCursor,
          error: null,
        },
      };
    case 'QUEUE_FAILURE':
      if (action.sequence !== state.queue.sequence) return state;
      return {
        ...state,
        queue: {
          ...state.queue,
          status: 'error',
          error: action.error,
        },
      };
    case 'REVIEW_LOADING':
      {
        const silent = action.silent === true
          && action.requestId === state.selectedRequestId
          && state.review.status === 'ready'
          && state.review.data?.request?.id === action.requestId;
      return {
        ...state,
        selectedRequestId: action.requestId,
        review: {
          status: silent ? 'ready' : 'loading',
          sequence: action.sequence,
          data: action.preserveCurrent ? state.review.data : null,
          error: null,
        },
      };
      }
    case 'REVIEW_SUCCESS':
      if (
        action.sequence !== state.review.sequence
        || action.requestId !== state.selectedRequestId
      ) return state;
      return {
        ...state,
        review: {
          status: 'ready',
          sequence: action.sequence,
          data: action.payload,
          error: null,
        },
        forms: action.preserveForms && state.forms
          ? state.forms
          : formsFromReview(action.payload),
      };
    case 'REVIEW_FAILURE':
      if (
        action.sequence !== state.review.sequence
        || action.requestId !== state.selectedRequestId
      ) return state;
      if (action.silent === true && state.review.data?.request?.id === action.requestId) {
        return {
          ...state,
          review: {
            ...state.review,
            status: 'ready',
            error: null,
          },
        };
      }
      return {
        ...state,
        review: {
          ...state.review,
          status: 'error',
          error: action.error,
        },
      };
    case 'FORM_PATCH':
      if (!state.forms?.[action.form]) return state;
      return {
        ...state,
        forms: {
          ...state.forms,
          [action.form]: {
            ...state.forms[action.form],
            ...action.patch,
          },
        },
      };
    case 'DECISION_ITEM_PATCH':
      if (!state.forms?.decisionItems?.[action.reviewItemId]) return state;
      return {
        ...state,
        forms: {
          ...state.forms,
          decisionItems: {
            ...state.forms.decisionItems,
            [action.reviewItemId]: {
              ...state.forms.decisionItems[action.reviewItemId],
              ...action.patch,
            },
          },
        },
      };
    case 'MUTATION_START':
      return {
        ...state,
        mutation: {
          status: 'submitting',
          label: action.operation.label,
          error: null,
          uncertainOperation: null,
          reconciliationRequestId: null,
          reconciliation: 'idle',
          notice: null,
        },
      };
    case 'MUTATION_SUCCESS':
      return {
        ...state,
        mutation: {
          status: 'success',
          label: action.label,
          error: null,
          uncertainOperation: null,
          reconciliationRequestId: null,
          reconciliation: 'complete',
          notice: action.notice,
        },
      };
    case 'MUTATION_FAILURE':
      return {
        ...state,
        mutation: {
          status: 'error',
          label: action.label,
          error: action.error,
          uncertainOperation: null,
          reconciliationRequestId: null,
          reconciliation: action.reconciliation || 'idle',
          notice: null,
        },
      };
    case 'MUTATION_UNCERTAIN':
      return {
        ...state,
        mutation: {
          status: 'uncertain',
          label: action.operation.label,
          error: action.error,
          uncertainOperation: action.operation,
          reconciliationRequestId: action.operation.requestId,
          reconciliation: 'loading',
          notice: null,
        },
      };
    case 'MUTATION_RECONCILIATION_REQUIRED':
      return {
        ...state,
        mutation: {
          status: 'reconciliation_required',
          label: action.operation.label,
          error: action.error,
          uncertainOperation: action.operation,
          reconciliationRequestId: action.operation.requestId,
          reconciliation: 'error',
          notice: action.notice,
        },
      };
    case 'MUTATION_RECONCILED':
      if (state.mutation.status === 'uncertain') {
        return {
          ...state,
          mutation: {
            ...state.mutation,
            reconciliation: action.ok ? 'complete' : 'error',
          },
        };
      }
      if (state.mutation.status === 'reconciliation_required') {
        if (!action.ok) {
          return {
            ...state,
            mutation: {
              ...state.mutation,
              reconciliation: 'error',
            },
          };
        }
        return {
          ...state,
          mutation: {
            status: 'success',
            label: state.mutation.label,
            error: null,
            uncertainOperation: null,
            reconciliationRequestId: null,
            reconciliation: 'complete',
            notice: state.mutation.notice,
          },
        };
      }
      return state;
    case 'MUTATION_CLEAR':
      return {
        ...state,
        mutation: INITIAL_PRIVACY_REVIEW_STATE.mutation,
      };
    default:
      return state;
  }
}
