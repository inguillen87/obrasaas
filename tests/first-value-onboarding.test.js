import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIRST_VALUE_APPROVAL_SIMULATION_MESSAGE,
  FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
  countFirstValueApprovalDecisions,
  countMeaningfulReportGenerations,
  countPersistedTasks,
  deriveFirstValueApprovalStep,
  deriveFirstValueReadiness,
  nextPendingOperationalProposalCount,
  pendingOperationalProposalCountFromPayload,
} from '../src/lib/first-value-onboarding.js';
import {
  parseFieldSimulatorScenarioRequest,
  resolveFieldSimulatorScenario,
} from '../src/lib/field-simulator-scenarios.js';
import {
  REPORT_PROPOSAL_TYPES,
  classifyReportProposal,
} from '../src/lib/whatsapp/report-proposal.js';

test('first-value readiness starts empty and never trusts malformed counters', () => {
  assert.equal(countPersistedTasks({ tasks: [] }), 0);
  assert.deepEqual(deriveFirstValueReadiness({
    activeFieldWorkerCount: -1,
    inboundMessageCount: 'not-a-number',
    state: { tasks: null },
  }), {
    completion: {
      project: false,
      people: false,
      task: false,
      fieldFlow: false,
      approval: false,
      report: false,
    },
    counts: {
      activeFieldWorkers: 0,
      activeMemberships: 0,
      inboundMessages: 0,
      operationalDecisions: 0,
      reportsGenerated: 0,
      tasks: 0,
    },
    completed: 0,
    total: 6,
    percentage: 0,
    nextKey: 'project',
  });
});

test('a real local inbound flow advances onboarding without claiming Meta is connected', () => {
  const readiness = deriveFirstValueReadiness({
    activeMembershipCount: 2,
    inboundMessageCount: 1,
    projectConfigured: true,
    state: { tasks: { foundations: { name: 'Fundaciones' } } },
  });

  assert.equal(readiness.completion.people, true);
  assert.equal(readiness.completion.fieldFlow, true);
  assert.equal(readiness.completion.approval, false);
  assert.equal(readiness.completion.report, false);
  assert.equal(readiness.completed, 4);
  assert.equal(readiness.percentage, 67);
  assert.equal(readiness.nextKey, 'approval');
});

test('first value completes only after a durable decision and report generation', () => {
  const readiness = deriveFirstValueReadiness({
    activeFieldWorkerCount: 1,
    operationalDecisionCount: 1,
    projectConfigured: true,
    reportGenerationCount: 1,
    state: { tasks: { structure: { name: 'Estructura' } } },
    whatsappConnected: true,
  });

  assert.equal(readiness.completion.report, true);
  assert.equal(readiness.completion.approval, true);
  assert.equal(readiness.completed, 6);
  assert.equal(readiness.percentage, 100);
  assert.equal(readiness.nextKey, null);
});

test('an empty report attempt is recorded but does not complete first value', () => {
  const reportGenerationCount = countMeaningfulReportGenerations([
    { metadata: { emptyState: true, format: 'pdf', reportId: 'OS-EMPTY' } },
    { metadata: null },
  ]);
  const readiness = deriveFirstValueReadiness({
    projectConfigured: true,
    reportGenerationCount,
    state: { tasks: {} },
  });

  assert.equal(reportGenerationCount, 0);
  assert.equal(readiness.completion.report, false);
});

test('a meaningful report only counts at or after the latest human decision', () => {
  const decisionAt = new Date('2026-07-16T12:05:00.000Z');
  const events = [
    {
      createdAt: new Date('2026-07-16T12:04:59.999Z'),
      metadata: { emptyState: false, format: 'pdf' },
    },
    {
      createdAt: new Date('2026-07-16T12:05:00.000Z'),
      metadata: { emptyState: false, format: 'pdf' },
    },
  ];

  assert.equal(countMeaningfulReportGenerations(events, { notBefore: decisionAt }), 1);
  assert.equal(countMeaningfulReportGenerations([events[0]], { notBefore: decisionAt }), 0);
  assert.equal(
    countMeaningfulReportGenerations(events, { notBefore: 'invalid-date' }),
    0,
  );

  const readiness = deriveFirstValueReadiness({
    activeFieldWorkerCount: 1,
    operationalDecisionCount: 1,
    projectConfigured: true,
    reportGenerationCount: countMeaningfulReportGenerations(
      [events[0]],
      { notBefore: decisionAt },
    ),
    state: { tasks: { structure: { name: 'Estructura' } } },
    whatsappConnected: true,
  });
  assert.equal(readiness.completion.approval, true);
  assert.equal(readiness.completion.report, false);
  assert.equal(readiness.percentage, 83);
  assert.equal(readiness.nextKey, 'report');
});

test('only an emitted PDF completes the report milestone', () => {
  const events = [
    { metadata: { emptyState: false, format: 'web' } },
    { metadata: { emptyState: false } },
    { metadata: { emptyState: false, format: 'pdf' } },
  ];

  assert.equal(countMeaningfulReportGenerations(events), 1);
});

test('a generated report never skips the human-decision milestone', () => {
  const readiness = deriveFirstValueReadiness({
    activeFieldWorkerCount: 1,
    projectConfigured: true,
    reportGenerationCount: 1,
    state: { tasks: { structure: { name: 'Estructura' } } },
    whatsappConnected: true,
  });

  assert.equal(readiness.completion.report, true);
  assert.equal(readiness.completion.approval, false);
  assert.equal(readiness.nextKey, 'approval');
});

test('only applied or rejected proposals complete the approval milestone', () => {
  const terminalProposalCount = countFirstValueApprovalDecisions([
    { status: 'PENDING' },
    { status: 'EXPIRED' },
    { status: 'INVALIDATED' },
    { status: 'applied' },
    { status: 'REJECTED' },
  ]);
  const readiness = deriveFirstValueReadiness({ operationalDecisionCount: terminalProposalCount });

  assert.equal(terminalProposalCount, 2);
  assert.equal(readiness.completion.approval, true);
});

test('approval step routes pending work to the inbox and an empty state to the simulator', () => {
  assert.deepEqual(deriveFirstValueApprovalStep({
    canManageField: true,
    canManageProposals: true,
    pendingProposalCount: 1,
  }), {
    complete: false,
    hasPending: true,
    pending: 1,
    terminal: 0,
    href: '/dashboard/approvals',
    label: 'Revisar y decidir',
    blocked: false,
  });

  const empty = deriveFirstValueApprovalStep({
    canManageField: true,
    canManageProposals: true,
  });
  assert.equal(empty.href, '/dashboard?tab=sec-whatsapp&onboarding=approval');
  assert.equal(empty.label, 'Generar propuesta de prueba');
  assert.equal(empty.blocked, false);

  assert.equal(deriveFirstValueApprovalStep({
    canManageField: true,
    canManageProposals: false,
    pendingProposalCount: 1,
  }).label, 'Revisar propuestas');
  assert.equal(deriveFirstValueApprovalStep({
    canManageField: true,
    canManageProposals: false,
    pendingProposalCount: 1,
  }).blocked, true);
  assert.equal(deriveFirstValueApprovalStep({
    canManageField: false,
    canManageProposals: true,
  }).blocked, true);
});

test('the first-value simulator scenario produces an actionable delay proposal', () => {
  const proposal = classifyReportProposal(FIRST_VALUE_APPROVAL_SIMULATION_MESSAGE);

  assert.equal(proposal.type, REPORT_PROPOSAL_TYPES.DELAY_REPORT);
  assert.equal(proposal.requiresTextConfirmation, true);
});

test('the first-value scenario is server-owned and rejects arbitrary overrides', () => {
  assert.deepEqual(resolveFieldSimulatorScenario(
    FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
  ), {
    id: FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
    kind: 'audio',
    text: FIRST_VALUE_APPROVAL_SIMULATION_MESSAGE,
  });
  assert.equal(resolveFieldSimulatorScenario('unknown'), null);
  assert.equal(parseFieldSimulatorScenarioRequest({
    scenario: FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
    workerId: 'worker-a',
  }).error, null);
  assert.match(parseFieldSimulatorScenarioRequest({
    scenario: FIRST_VALUE_APPROVAL_SIMULATOR_SCENARIO,
    workerId: 'worker-a',
    text: 'Demora arbitraria',
  }).error, /no admite contenido libre/i);
});

test('local proposal badges increment once and only for pending proposals', () => {
  const pending = { id: 'proposal-1', status: 'PENDING' };

  assert.equal(nextPendingOperationalProposalCount(2, pending), 3);
  assert.equal(nextPendingOperationalProposalCount(2, pending, { alreadyKnown: true }), 2);
  assert.equal(nextPendingOperationalProposalCount(2, { status: 'APPLIED' }), 2);
  assert.equal(nextPendingOperationalProposalCount('invalid', pending), 1);
});

test('live pending counts accept only the active project and include authoritative zero', () => {
  assert.equal(pendingOperationalProposalCountFromPayload({
    project: { id: 'project-a' },
    pendingCount: 0,
  }, 'project-a'), 0);
  assert.equal(pendingOperationalProposalCountFromPayload({
    project: { id: 'project-b' },
    pendingCount: 4,
  }, 'project-a'), null);
  assert.equal(pendingOperationalProposalCountFromPayload({
    project: { id: 'project-a' },
    pendingCount: -1,
  }, 'project-a'), null);
});
