import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createReplanComparisonResponse,
  parseReplanComparisonResponse,
  ReplanComparisonContractError,
} from '../src/lib/replan-comparison-contract.js';

function validComparison() {
  return {
    scenario: {
      id: 'scenario-a',
      name: 'Recuperación frente norte',
      status: 'PROPOSED',
      revision: 0,
      impact: { days: 3 },
    },
    baselineTasks: [
      {
        id: 'task-a',
        code: '1.2',
        title: 'Mampostería planta baja',
        status: 'IN_PROGRESS',
        progress: 45,
      },
    ],
  };
}

test('replan response builder and client parser share one exact task-list contract', () => {
  const response = createReplanComparisonResponse(validComparison());
  const parsed = parseReplanComparisonResponse(response, { expectedScenarioId: 'scenario-a' });

  assert.deepEqual(parsed, validComparison());
  assert.deepEqual(Object.keys(parsed).sort(), ['baselineTasks', 'scenario']);
  assert.equal(parsed.baselineTasks[0].title, 'Mampostería planta baja');
  assert.equal('baselineVersion' in parsed, false);
});

test('replan parser rejects the former mismatched baseline envelope and malformed tasks', () => {
  const comparison = validComparison();
  assert.throws(
    () => parseReplanComparisonResponse({
      scenario: comparison.scenario,
      baseline: comparison.baselineTasks,
      baselineVersion: null,
    }),
    ReplanComparisonContractError,
  );
  assert.throws(
    () => parseReplanComparisonResponse({
      ...comparison,
      baselineTasks: [{ id: 'task-a', name: 'Campo legado', status: 'READY' }],
    }),
    ReplanComparisonContractError,
  );
});

test('replan parser fails closed when the API returns a different scenario', () => {
  assert.throws(
    () => parseReplanComparisonResponse(validComparison(), { expectedScenarioId: 'scenario-b' }),
    (error) => (
      error instanceof ReplanComparisonContractError
      && error.code === 'REPLAN_COMPARISON_CONTRACT_INVALID'
      && /escenario solicitado/.test(error.message)
    ),
  );
});

test('route and client are wired through the shared contract without a fabricated version', () => {
  const routeSource = readFileSync(
    new URL('../src/app/api/replan-scenarios/[scenarioId]/route.js', import.meta.url),
    'utf8',
  );
  const clientSource = readFileSync(
    new URL('../src/app/dashboard/replan/replan-client.js', import.meta.url),
    'utf8',
  );

  assert.match(routeSource, /createReplanComparisonResponse\(\{[\s\S]*baselineTasks:\s*tasks\.tasks/);
  assert.match(clientSource, /parseReplanComparisonResponse\([\s\S]*expectedScenarioId:\s*row\.id/);
  assert.match(clientSource, /task\.title/);
  assert.doesNotMatch(routeSource, /baselineVersion|tasks\.version/);
  assert.doesNotMatch(clientSource, /baselineVersion|task\.name/);
});
