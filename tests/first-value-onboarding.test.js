import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countMeaningfulReportGenerations,
  countPersistedTasks,
  deriveFirstValueReadiness,
} from '../src/lib/first-value-onboarding.js';

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
      report: false,
    },
    counts: {
      activeFieldWorkers: 0,
      activeMemberships: 0,
      inboundMessages: 0,
      reportsGenerated: 0,
      tasks: 0,
    },
    completed: 0,
    total: 5,
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
  assert.equal(readiness.completion.report, false);
  assert.equal(readiness.completed, 4);
  assert.equal(readiness.percentage, 80);
  assert.equal(readiness.nextKey, 'report');
});

test('report completion requires a durable generation record', () => {
  const readiness = deriveFirstValueReadiness({
    activeFieldWorkerCount: 1,
    projectConfigured: true,
    reportGenerationCount: 1,
    state: { tasks: { structure: { name: 'Estructura' } } },
    whatsappConnected: true,
  });

  assert.equal(readiness.completion.report, true);
  assert.equal(readiness.completed, 5);
  assert.equal(readiness.percentage, 100);
  assert.equal(readiness.nextKey, null);
});

test('an empty report attempt is recorded but does not complete first value', () => {
  const reportGenerationCount = countMeaningfulReportGenerations([
    { metadata: { emptyState: true, reportId: 'OS-EMPTY' } },
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
