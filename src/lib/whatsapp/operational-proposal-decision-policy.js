// Decision parser and helpers reused from enterprise 1677ff7; no mutation functions.
const MAX_TASK_REFERENCE_LENGTH = 128;
export const OPERATIONAL_PROPOSAL_DECISIONS = Object.freeze({
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
});

function cleanText(value, limit) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalize(value) {
  return cleanText(value, 512)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function decisionTaskReference(value) {
  const reference = cleanText(value, MAX_TASK_REFERENCE_LENGTH);
  if (!reference) return null;
  const normalized = normalize(reference);
  return /^(TAREA|TASK|ACTIVIDAD|ITEM|HITO|FRENTE)\b/.test(normalized)
    ? reference
    : null;
}

function decisionTaskSelection(value) {
  const selection = cleanText(value, MAX_TASK_REFERENCE_LENGTH);
  if (!selection) {
    return { taskReference: null, taskExpectedProgress: null };
  }
  const match = /^(.*?)(?:\s+DESDE\s+(\d{1,3})(?:\s*%|\s+POR\s+CIENTO)?)?$/i.exec(selection);
  if (!match) return null;
  const taskReference = decisionTaskReference(match[1]);
  if (!taskReference) return null;
  const taskExpectedProgress = match[2] == null ? null : Number(match[2]);
  if (
    taskExpectedProgress !== null
    && (
      !Number.isSafeInteger(taskExpectedProgress)
      || taskExpectedProgress < 0
      || taskExpectedProgress > 100
    )
  ) {
    return null;
  }
  return { taskReference, taskExpectedProgress };
}

export function parseOperationalProposalDecision(input) {
  // Flow decisions stay disabled until a signed, expiring flow_token is bound
  // to the exact proposal and worker. A client-supplied flow_type/code alone is
  // not an authorization mechanism.
  if (input && typeof input === 'object' && input.interactive?.type === 'flow') return null;
  if (
    input
    && typeof input === 'object'
    && input.kind
    && input.kind !== 'text'
  ) {
    return null;
  }

  const source = typeof input === 'string'
    ? input
    : String(input?.text || '');
  const normalized = normalize(source);
  const match = /^(CONFIRMAR|APROBAR|RECHAZAR)\s+(VP-[A-F0-9]{12})(?:\s+(.+))?$/.exec(normalized);
  if (!match) return null;
  const taskSelection = decisionTaskSelection(match[3]);
  if (!taskSelection || (match[3] && match[1] === 'RECHAZAR')) return null;
  return {
    decision: match[1] === 'RECHAZAR'
      ? OPERATIONAL_PROPOSAL_DECISIONS.REJECT
      : OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
    confirmationCode: match[2],
    ...taskSelection,
    channel: 'whatsapp-text',
  };
}
