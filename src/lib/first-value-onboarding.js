export {
  FIRST_VALUE_APPROVAL_SIMULATION_MESSAGE,
  FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
} from './field-simulator-scenarios.js';

export const FIRST_VALUE_REPORT_ACTION = 'report.weekly.generated';
export const FIRST_VALUE_APPROVAL_STATUSES = Object.freeze(['APPLIED', 'REJECTED']);
export const FIRST_VALUE_APPROVAL_SIMULATOR_HREF = '/dashboard?tab=sec-whatsapp&onboarding=approval';

const FIRST_VALUE_APPROVAL_STATUS_SET = new Set(FIRST_VALUE_APPROVAL_STATUSES);

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

function safeTimestamp(value) {
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function countPersistedTasks(state) {
  if (!state?.tasks || typeof state.tasks !== 'object' || Array.isArray(state.tasks)) {
    return 0;
  }
  return Object.keys(state.tasks).length;
}

export function countMeaningfulReportGenerations(events, { notBefore = null } = {}) {
  if (!Array.isArray(events)) return 0;
  const hasThreshold = notBefore !== null && notBefore !== undefined;
  const threshold = hasThreshold ? safeTimestamp(notBefore) : null;
  if (hasThreshold && threshold === null) return 0;
  return events.filter((event) => {
    if (event?.metadata?.emptyState !== false) return false;
    if (event?.metadata?.format !== 'pdf') return false;
    if (threshold === null) return true;
    const eventTimestamp = safeTimestamp(
      event.createdAt ?? event.metadata?.generatedAt,
    );
    return eventTimestamp !== null && eventTimestamp >= threshold;
  }).length;
}

export function countFirstValueApprovalDecisions(proposals) {
  if (!Array.isArray(proposals)) return 0;
  return proposals.filter((proposal) => (
    FIRST_VALUE_APPROVAL_STATUS_SET.has(String(proposal?.status || '').toUpperCase())
  )).length;
}

export function deriveFirstValueApprovalStep({
  canManageField = false,
  canManageProposals = false,
  pendingProposalCount = 0,
  terminalProposalCount = 0,
} = {}) {
  const pending = safeCount(pendingProposalCount);
  const terminal = safeCount(terminalProposalCount);
  const complete = terminal > 0;
  const hasPending = pending > 0;

  return {
    complete,
    hasPending,
    pending,
    terminal,
    href: complete || hasPending
      ? '/dashboard/approvals'
      : FIRST_VALUE_APPROVAL_SIMULATOR_HREF,
    label: complete
      ? 'Revisar decisiones'
      : hasPending
        ? canManageProposals ? 'Revisar y decidir' : 'Revisar propuestas'
        : 'Generar propuesta de prueba',
    blocked: !complete && (
      !canManageProposals
      || (!hasPending && !canManageField)
    ),
  };
}

export function pendingOperationalProposalCountFromPayload(payload, expectedProjectId) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const projectId = String(payload.project?.id || '').trim();
  if (!projectId || projectId !== String(expectedProjectId || '').trim()) return null;
  const pending = Number(payload.pendingCount ?? payload.metrics?.pending);
  return Number.isSafeInteger(pending) && pending >= 0 ? pending : null;
}

export function nextPendingOperationalProposalCount(
  currentCount,
  proposal,
  { alreadyKnown = false } = {},
) {
  const current = safeCount(currentCount);
  if (
    alreadyKnown
    || String(proposal?.status || '').toUpperCase() !== 'PENDING'
  ) {
    return current;
  }
  return current === Number.MAX_SAFE_INTEGER ? current : current + 1;
}

export function deriveFirstValueReadiness({
  activeFieldWorkerCount = 0,
  activeMembershipCount = 0,
  inboundMessageCount = 0,
  operationalDecisionCount = 0,
  projectConfigured = false,
  reportGenerationCount = 0,
  state,
  whatsappConnected = false,
} = {}) {
  const taskCount = countPersistedTasks(state);
  const counts = {
    activeFieldWorkers: safeCount(activeFieldWorkerCount),
    activeMemberships: safeCount(activeMembershipCount),
    inboundMessages: safeCount(inboundMessageCount),
    operationalDecisions: safeCount(operationalDecisionCount),
    reportsGenerated: safeCount(reportGenerationCount),
    tasks: taskCount,
  };
  const completion = {
    project: Boolean(projectConfigured),
    people: counts.activeFieldWorkers > 0 || counts.activeMemberships > 1,
    task: taskCount > 0,
    fieldFlow: Boolean(whatsappConnected) || counts.inboundMessages > 0,
    approval: counts.operationalDecisions > 0,
    report: counts.reportsGenerated > 0,
  };
  const keys = Object.keys(completion);
  const completed = keys.filter((key) => completion[key]).length;

  return {
    completion,
    counts,
    completed,
    total: keys.length,
    percentage: Math.round((completed / keys.length) * 100),
    nextKey: keys.find((key) => !completion[key]) || null,
  };
}
