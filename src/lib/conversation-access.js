export const CONVERSATION_READ_PERMISSION = 'org:conversations:read';
const EMPTY_CONVERSATION_MESSAGES = Object.freeze([]);

export function conversationScopeKey({ allowed, organizationId, projectId } = {}) {
  if (allowed !== true) return null;
  const organization = typeof organizationId === 'string' ? organizationId.trim() : '';
  const project = typeof projectId === 'string' ? projectId.trim() : '';
  return organization && project ? `${organization}:${project}` : null;
}

export function scopedConversationState(scopeKey, messages) {
  return {
    scopeKey: typeof scopeKey === 'string' && scopeKey ? scopeKey : null,
    messages: typeof scopeKey === 'string' && scopeKey && Array.isArray(messages)
      ? messages
      : EMPTY_CONVERSATION_MESSAGES,
  };
}

export function visibleConversationMessages(state, scopeKey) {
  return scopeKey
    && state?.scopeKey === scopeKey
    && Array.isArray(state?.messages)
    ? state.messages
    : EMPTY_CONVERSATION_MESSAGES;
}

export async function loadDashboardConversationMessages({
  access,
  allowed,
  loadMessages,
  includeMedicalEvidence = false,
  includeSourceEvidence = false,
}) {
  if (allowed !== true) return [];

  return loadMessages(access, {
    includeMedicalEvidence,
    includeSourceEvidence,
  });
}
