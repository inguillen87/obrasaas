export const FIRST_VALUE_REPORT_ACTION = 'report.weekly.generated';

function safeCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export function countPersistedTasks(state) {
  if (!state?.tasks || typeof state.tasks !== 'object' || Array.isArray(state.tasks)) {
    return 0;
  }
  return Object.keys(state.tasks).length;
}

export function countMeaningfulReportGenerations(events) {
  if (!Array.isArray(events)) return 0;
  return events.filter((event) => event?.metadata?.emptyState === false).length;
}

export function deriveFirstValueReadiness({
  activeFieldWorkerCount = 0,
  activeMembershipCount = 0,
  inboundMessageCount = 0,
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
    reportsGenerated: safeCount(reportGenerationCount),
    tasks: taskCount,
  };
  const completion = {
    project: Boolean(projectConfigured),
    people: counts.activeFieldWorkers > 0 || counts.activeMemberships > 1,
    task: taskCount > 0,
    fieldFlow: Boolean(whatsappConnected) || counts.inboundMessages > 0,
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
