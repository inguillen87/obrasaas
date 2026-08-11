import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProgressMeasurementPayload,
  canonicalDecimal,
  civilFortnightForDate,
  exactMeasurementSummary,
  measurementBaselineIsRequired,
  mergeMeasurementHistoryPage,
  progressMeasurementAttempt,
  shouldApplyMeasurementSnapshot,
  snapshotConfirmsAttempt,
  uncertainProgressMeasurementAttempt,
} from '../src/app/dashboard/measurements/progress-measurements-state.js';

function baseSnapshot(overrides = {}) {
  return {
    task: { id: 'task-1', code: 'A-01', title: 'Mampostería' },
    requestedPeriod: {
      start: '2028-02-16',
      end: '2028-02-29',
      label: '16-29/02/2028',
    },
    head: null,
    approved: { quantity: '0.0000', baselineQuantity: null, percent: null },
    measurements: [],
    nextCursor: null,
    ...overrides,
  };
}

function baseForm(overrides = {}) {
  return {
    taskId: 'task-1',
    periodDate: '2028-02-29',
    unit: 'M2',
    baselineQuantity: '125.5',
    executedQuantity: '12.7500',
    method: 'DIMENSIONAL_CALCULATION',
    rationale: 'Medición dimensional contrastada en obra.',
    evidenceIds: ['evidence-2', 'evidence-1'],
    ...overrides,
  };
}

test('civil fortnights use calendar boundaries, including leap years', () => {
  assert.deepEqual(civilFortnightForDate('2028-02-15'), {
    start: '2028-02-01',
    end: '2028-02-15',
    label: '1.ª quincena · 2028-02-01 a 2028-02-15',
  });
  assert.deepEqual(civilFortnightForDate('2028-02-29'), {
    start: '2028-02-16',
    end: '2028-02-29',
    label: '2.ª quincena · 2028-02-16 a 2028-02-29',
  });
  assert.throws(() => civilFortnightForDate('2027-02-29'), /fecha civil válida/);
});

test('the first proposal canonically carries base, unit, evidence, and head CAS', () => {
  const payload = buildProgressMeasurementPayload(baseForm(), baseSnapshot());
  assert.deepEqual(payload, {
    taskId: 'task-1',
    periodDate: '2028-02-16',
    unit: 'M2',
    baselineQuantity: '125.5000',
    executedQuantity: '12.7500',
    method: 'DIMENSIONAL_CALCULATION',
    rationale: 'Medición dimensional contrastada en obra.',
    evidenceIds: ['evidence-2', 'evidence-1'],
    expectedHeadId: null,
  });
});

test('later proposals use the fixed basis and CAS the latest measurement, not the head row', () => {
  const snapshot = baseSnapshot({
    head: {
      id: 'head-row-stable',
      latestMeasurementId: 'measurement-current',
      unit: 'M3',
      baselineQuantity: '900.0000',
    },
    approved: {
      unit: 'M3',
      quantity: '100.0000',
      baselineQuantity: '900.0000',
      percent: '11.1111',
    },
  });
  assert.equal(measurementBaselineIsRequired(snapshot), false);
  const payload = buildProgressMeasurementPayload(baseForm({
    unit: 'KG',
    baselineQuantity: '1.0000',
  }), snapshot);
  assert.equal(payload.unit, 'M3');
  assert.equal(payload.baselineQuantity, '900.0000');
  assert.equal(payload.expectedHeadId, 'measurement-current');
  assert.notEqual(payload.expectedHeadId, snapshot.head.id);
});

test('a rejected proposal does not freeze the technical basis before first approval', () => {
  const snapshot = baseSnapshot({
    head: {
      id: 'rejected-head',
      latestMeasurementId: 'rejected-measurement',
      unit: 'M2',
      baselineQuantity: '10.0000',
    },
    approved: {
      unit: null,
      quantity: '0.0000',
      baselineQuantity: null,
      percent: null,
    },
  });
  assert.equal(measurementBaselineIsRequired(snapshot), true);
  const payload = buildProgressMeasurementPayload(baseForm({
    unit: 'KG',
    baselineQuantity: '25.0000',
  }), snapshot);
  assert.equal(payload.unit, 'KG');
  assert.equal(payload.baselineQuantity, '25.0000');
});

test('a form cannot submit against a snapshot from another civil fortnight', () => {
  assert.throws(
    () => buildProgressMeasurementPayload(baseForm({
      periodDate: '2028-02-15',
    }), baseSnapshot()),
    /quincena cambió/,
  );
});

test('contractual quantities remain exact strings and reject lossy formats', () => {
  assert.equal(canonicalDecimal('99999999999999.9999'), '99999999999999.9999');
  assert.equal(canonicalDecimal('0.1'), '0.1000');
  for (const value of ['1,5', '1e2', '+1', '-1', '01', '1.00000', 1.5]) {
    assert.throws(() => canonicalDecimal(value), /decimal exacto/);
  }
  assert.throws(
    () => buildProgressMeasurementPayload(baseForm({ executedQuantity: '0' }), baseSnapshot()),
    /mayor que cero/,
  );
  assert.throws(
    () => buildProgressMeasurementPayload(baseForm({ rationale: 'corto' }), baseSnapshot()),
    /al menos 10/,
  );
});

test('evidence selection is unique and bounded to one through ten', () => {
  const duplicate = buildProgressMeasurementPayload(baseForm({
    evidenceIds: ['evidence-1', 'evidence-1'],
  }), baseSnapshot());
  assert.deepEqual(duplicate.evidenceIds, ['evidence-1']);
  assert.throws(
    () => buildProgressMeasurementPayload(baseForm({ evidenceIds: [] }), baseSnapshot()),
    /entre 1 y 10/,
  );
  assert.throws(
    () => buildProgressMeasurementPayload(baseForm({
      evidenceIds: Array.from({ length: 11 }, (_, index) => `evidence-${index}`),
    }), baseSnapshot()),
    /entre 1 y 10/,
  );
});

test('an idempotent attempt keeps the same key and body until a known success', () => {
  const payload = buildProgressMeasurementPayload(baseForm(), baseSnapshot());
  let calls = 0;
  const uuid = () => `uuid-${++calls}`;
  const first = progressMeasurementAttempt(null, payload, uuid);
  const replay = progressMeasurementAttempt(first, { ...payload }, uuid);
  const uncertain = uncertainProgressMeasurementAttempt(replay);
  const retry = progressMeasurementAttempt(uncertain, payload, uuid);

  assert.equal(calls, 1);
  assert.equal(replay, first);
  assert.equal(retry, uncertain);
  assert.equal(retry.operationKey, first.operationKey);
  assert.equal(retry.body, first.body);
  assert.equal(retry.state, 'UNCERTAIN');

  const changed = progressMeasurementAttempt(retry, {
    ...payload,
    executedQuantity: '13.0000',
  }, uuid);
  assert.equal(calls, 2);
  assert.notEqual(changed.operationKey, first.operationKey);
});

test('stale task and request responses cannot cross into current state', () => {
  const snapshot = baseSnapshot();
  assert.equal(shouldApplyMeasurementSnapshot({
    currentSequence: 4,
    currentTaskId: 'task-1',
    requestSequence: 4,
    requestTaskId: 'task-1',
    snapshot,
  }), true);
  assert.equal(shouldApplyMeasurementSnapshot({
    currentSequence: 5,
    currentTaskId: 'task-1',
    requestSequence: 4,
    requestTaskId: 'task-1',
    snapshot,
  }), false);
  assert.equal(shouldApplyMeasurementSnapshot({
    currentSequence: 4,
    currentTaskId: 'task-2',
    requestSequence: 4,
    requestTaskId: 'task-1',
    snapshot,
  }), false);
  assert.equal(shouldApplyMeasurementSnapshot({
    currentPeriodStart: '2028-02-16',
    currentSequence: 4,
    currentTaskId: 'task-1',
    requestPeriodStart: '2028-02-01',
    requestSequence: 4,
    requestTaskId: 'task-1',
    snapshot,
  }), false);
});

test('history pagination is task/head scoped and idempotently de-duplicates rows', () => {
  const current = baseSnapshot({
    head: { id: 'head-1' },
    measurements: [{ id: 'measurement-2' }],
    nextCursor: 'cursor-1',
  });
  const incoming = baseSnapshot({
    head: { id: 'head-1' },
    measurements: [{ id: 'measurement-2' }, { id: 'measurement-1' }],
    nextCursor: null,
  });
  assert.deepEqual(
    mergeMeasurementHistoryPage(current, incoming, { taskId: 'task-1', headId: 'head-1' })
      .measurements.map(({ id }) => id),
    ['measurement-2', 'measurement-1'],
  );
  assert.equal(
    mergeMeasurementHistoryPage(current, {
      ...incoming,
      task: { id: 'task-2' },
    }, { taskId: 'task-1', headId: 'head-1' }),
    current,
  );
});

test('GET reconciliation requires a changed latest measurement and an exact proposal match', () => {
  const payload = buildProgressMeasurementPayload(baseForm(), baseSnapshot());
  const attempt = progressMeasurementAttempt(null, payload, () => 'uuid-1');
  const measurement = {
    id: 'measurement-new',
    taskId: payload.taskId,
    period: { start: payload.periodDate },
    unit: payload.unit,
    baselineQuantity: payload.baselineQuantity,
    executedQuantity: payload.executedQuantity,
    method: payload.method,
    rationale: payload.rationale,
    evidence: payload.evidenceIds.map((id) => ({ id })),
  };
  assert.equal(snapshotConfirmsAttempt(baseSnapshot({
    head: { latestMeasurementId: 'measurement-new' },
    measurements: [measurement],
  }), attempt), true);
  assert.equal(snapshotConfirmsAttempt(baseSnapshot({
    head: { latestMeasurementId: null },
    measurements: [measurement],
  }), attempt), false);
});

test('base, approved, remaining and percent are derived without binary floating point', () => {
  assert.deepEqual(exactMeasurementSummary(baseSnapshot({
    head: {
      id: 'head-1',
      latestMeasurementId: 'measurement-1',
      baselineQuantity: '99999999999999.9999',
    },
    approved: {
      quantity: '0.0001',
      baselineQuantity: '99999999999999.9999',
    },
  })), {
    baseline: '99999999999999.9999',
    approved: '0.0001',
    remaining: '99999999999999.9998',
    percent: '0.0000',
    inconsistent: false,
  });
});
