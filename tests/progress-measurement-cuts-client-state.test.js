import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProgressMeasurementCutPayload,
  cutCandidateCounts,
  cutCandidateRows,
  cutFreshness,
  inactiveProgressMeasurementCutLoadState,
  latestClosedFortnightDate,
  progressMeasurementCutAttempt,
  progressMeasurementCutSnapshotIsUsable,
  progressMeasurementCutSnapshotConfirmsAttempt,
  shouldApplyProgressMeasurementCutSnapshot,
  uncertainProgressMeasurementCutAttempt,
} from '../src/app/dashboard/measurements/progress-measurement-cuts-state.js';
import { civilFortnightForDate } from '../src/app/dashboard/measurements/progress-measurements-state.js';

function snapshot(overrides = {}) {
  return {
    requestedPeriod: {
      start: '2028-02-16',
      end: '2028-02-29',
      label: '2.ª quincena · 2028-02-16 a 2028-02-29',
    },
    readiness: { state: 'READY', canSeal: true, reviewPending: false, lineCount: 1 },
    candidate: {
      expectedHeadCutId: 'cut-previous',
      token: 'b'.repeat(64),
      lines: [{
        task: { id: 'task-1', code: 'A-01', title: 'Mampostería', revision: 4 },
        approvedMeasurement: {
          id: 'measurement-2',
          revision: 2,
          unit: 'M2',
          baselineQuantity: '100.0000',
          executedQuantity: '15.0000',
          cumulativeQuantity: '40.0000',
        },
      }, {
        task: { id: 'task-2', code: 'A-02', title: 'Cubierta', revision: 1 },
        approvedMeasurement: null,
      }],
    },
    latestCut: {
      id: 'cut-previous',
      version: 1,
      period: { start: '2028-02-16', end: '2028-02-29' },
      lineCount: 1,
      lines: [{
        task: { id: 'task-1', code: 'A-01', title: 'Mampostería', revision: 3 },
        approvedMeasurement: {
          id: 'measurement-1',
          revision: 1,
          unit: 'M2',
          baselineQuantity: '100.0000',
          executedQuantity: '10.0000',
          cumulativeQuantity: '25.0000',
        },
      }],
      integrity: { algorithm: 'SHA-256', digest: 'a'.repeat(64) },
    },
    ...overrides,
  };
}

test('candidate comparison preserves missing tasks as absence, never a zero quantity', () => {
  const rows = cutCandidateRows(snapshot());
  assert.equal(rows.length, 2);
  assert.equal(rows[0].change, 'CHANGED');
  assert.equal(rows[1].candidate.absent, true);
  assert.equal(rows[1].candidate.measurement, null);
  assert.deepEqual(cutCandidateCounts(snapshot()), {
    taskCount: 2,
    measured: 1,
    missing: 1,
  });
});

test('task snapshot changes are not hidden when the approved measurement is identical', () => {
  const measurement = {
    id: 'measurement-same',
    revision: 2,
    unit: 'M2',
    baselineQuantity: '100.0000',
    executedQuantity: '15.0000',
    cumulativeQuantity: '40.0000',
    method: 'DIRECT_COUNT',
    rationale: 'Conteo aprobado y verificado.',
    evidenceCount: 2,
    approvedAt: '2028-02-20T12:00:00.000Z',
  };
  const [row] = cutCandidateRows(snapshot({
    readiness: { state: 'STALE', canSeal: true },
    candidate: {
      expectedHeadCutId: 'cut-previous',
      token: 'b'.repeat(64),
      lines: [{
        snapshotToken: 'c'.repeat(64),
        task: { id: 'task-1', code: 'A-01', title: 'Mampostería exterior', revision: 5 },
        approvedMeasurement: measurement,
      }],
    },
    latestCut: {
      id: 'cut-previous',
      period: { start: '2028-02-16', end: '2028-02-29' },
      lines: [{
        snapshotToken: 'a'.repeat(64),
        task: { id: 'task-1', code: 'A-01', title: 'Mampostería', revision: 4 },
        approvedMeasurement: { ...measurement },
      }],
    },
  }));
  assert.equal(row.change, 'CHANGED');
});

test('missing lines compare their task snapshot instead of collapsing into an absence badge', () => {
  const rows = cutCandidateRows(snapshot({
    readiness: { state: 'STALE', canSeal: true },
    candidate: {
      expectedHeadCutId: 'cut-previous',
      token: 'b'.repeat(64),
      lines: [{
        state: 'MISSING',
        snapshotToken: 'b'.repeat(64),
        task: { id: 'task-1', code: 'A-01', title: 'Cubierta nueva', revision: 3 },
        approvedMeasurement: null,
      }, {
        state: 'MISSING',
        snapshotToken: 'c'.repeat(64),
        task: { id: 'task-2', code: 'A-02', title: 'Pintura', revision: 1 },
        approvedMeasurement: null,
      }],
    },
    latestCut: {
      id: 'cut-previous',
      period: { start: '2028-02-16', end: '2028-02-29' },
      lines: [{
        state: 'MISSING',
        snapshotToken: 'a'.repeat(64),
        task: { id: 'task-1', code: 'A-01', title: 'Cubierta', revision: 2 },
        approvedMeasurement: null,
      }, {
        state: 'MISSING',
        snapshotToken: 'd'.repeat(64),
        task: { id: 'task-3', code: 'A-03', title: 'Instalación', revision: 1 },
        approvedMeasurement: null,
      }],
    },
  }));
  assert.deepEqual(rows.map(({ task, change }) => [task.id, change]), [
    ['task-1', 'CHANGED'],
    ['task-2', 'ADDED'],
    ['task-3', 'REMOVED'],
  ]);
  assert.equal(rows[0].candidate.measurement, null);
  assert.equal(rows[0].latestCut.measurement, null);
});

test('a server-owned stale candidate never renders every line as unchanged', () => {
  const line = {
    snapshotToken: 'a'.repeat(64),
    task: { id: 'task-1', code: 'A-01', title: 'Mampostería', revision: 4 },
    approvedMeasurement: { id: 'measurement-2', revision: 2 },
  };
  const [row] = cutCandidateRows(snapshot({
    readiness: { state: 'STALE', canSeal: true },
    candidate: {
      expectedHeadCutId: 'cut-previous',
      token: 'b'.repeat(64),
      lines: [line],
    },
    latestCut: {
      id: 'cut-previous',
      period: { start: '2028-02-16', end: '2028-02-29' },
      lines: [{ ...line }],
    },
  }));
  assert.equal(row.change, 'REVIEW_REQUIRED');
});

test('missing or malformed line tokens never authorize an unchanged badge', () => {
  for (const snapshotToken of [undefined, 'not-a-sha256', 'A'.repeat(64)]) {
    const line = {
      ...(snapshotToken ? { snapshotToken } : {}),
      task: { id: 'task-1', code: 'A-01', title: 'Mampostería', revision: 4 },
      approvedMeasurement: { id: 'measurement-2', revision: 2 },
    };
    const [row] = cutCandidateRows(snapshot({
      readiness: { state: 'UP_TO_DATE', canSeal: false },
      candidate: {
        expectedHeadCutId: 'cut-previous',
        token: 'b'.repeat(64),
        lines: [line],
      },
      latestCut: {
        id: 'cut-previous',
        period: { start: '2028-02-16', end: '2028-02-29' },
        lines: [{ ...line }],
      },
    }));
    assert.equal(row.change, 'CHANGED');
  }
});

test('seal payload is civil-fortnight canonical and CASes the latest cut id', () => {
  assert.deepEqual(buildProgressMeasurementCutPayload(snapshot(), '2028-02-29'), {
    periodDate: '2028-02-16',
    expectedHeadCutId: 'cut-previous',
    expectedCandidateToken: 'b'.repeat(64),
  });
  assert.throws(
    () => buildProgressMeasurementCutPayload(snapshot(), '2028-02-15'),
    /quincena cambió/,
  );
  assert.throws(
    () => buildProgressMeasurementCutPayload(snapshot({
      readiness: { state: 'BLOCKED', canSeal: false },
    }), '2028-02-16'),
    /no habilita sellar/,
  );
});

test('the UI starts at the latest closed civil fortnight', () => {
  assert.equal(latestClosedFortnightDate('2028-03-01'), '2028-02-29');
  assert.equal(latestClosedFortnightDate('2028-03-15'), '2028-02-29');
  assert.equal(latestClosedFortnightDate('2028-03-16'), '2028-03-15');
  assert.equal(latestClosedFortnightDate('2028-01-01'), '2027-12-31');
  assert.equal(latestClosedFortnightDate('2026-08-11'), '2026-07-31');
  assert.equal(latestClosedFortnightDate('2026-08-16'), '2026-08-15');
  assert.equal(
    civilFortnightForDate(latestClosedFortnightDate('2026-08-11')).start,
    '2026-07-16',
  );
  assert.equal(
    civilFortnightForDate(latestClosedFortnightDate('2026-08-16')).start,
    '2026-08-01',
  );
});

test('an aborted hidden-tab refresh restores the prior authoritative snapshot state', () => {
  assert.equal(inactiveProgressMeasurementCutLoadState(snapshot()), 'ready');
  assert.equal(inactiveProgressMeasurementCutLoadState(null), 'idle');
});

test('an ambiguous POST preserves one immutable key and body', () => {
  const payload = buildProgressMeasurementCutPayload(snapshot(), '2028-02-16');
  let calls = 0;
  const createUuid = () => `uuid-${++calls}`;
  const first = progressMeasurementCutAttempt(null, payload, createUuid);
  const same = progressMeasurementCutAttempt(first, { ...payload }, createUuid);
  const uncertain = uncertainProgressMeasurementCutAttempt(same);
  const replay = progressMeasurementCutAttempt(uncertain, payload, createUuid);
  assert.equal(calls, 1);
  assert.equal(first, same);
  assert.equal(replay, uncertain);
  assert.equal(replay.operationKey, 'progress-measurement-cut-uuid-1');
  assert.equal(replay.body, first.body);
  assert.equal(replay.state, 'UNCERTAIN');
});

test('stale GET responses cannot replace another selected fortnight', () => {
  assert.equal(shouldApplyProgressMeasurementCutSnapshot({
    currentPeriodStart: '2028-02-16',
    currentSequence: 7,
    requestPeriodStart: '2028-02-16',
    requestSequence: 7,
    snapshot: snapshot(),
  }), true);
  assert.equal(shouldApplyProgressMeasurementCutSnapshot({
    currentPeriodStart: '2028-02-01',
    currentSequence: 8,
    requestPeriodStart: '2028-02-16',
    requestSequence: 7,
    snapshot: snapshot(),
  }), false);
});

test('GET reconciliation requires a new authoritative head for the same period', () => {
  const payload = buildProgressMeasurementCutPayload(snapshot(), '2028-02-16');
  const attempt = progressMeasurementCutAttempt(null, payload, () => 'uuid-1');
  assert.equal(progressMeasurementCutSnapshotConfirmsAttempt(snapshot(), attempt), false);
  assert.equal(progressMeasurementCutSnapshotConfirmsAttempt(snapshot({
    candidate: { expectedHeadCutId: 'cut-new', token: 'd'.repeat(64), lines: [] },
    head: { currentCutId: 'cut-new', revision: 2 },
    latestCut: {
      id: 'cut-new',
      previousCutId: 'cut-previous',
      candidateToken: 'b'.repeat(64),
      period: { start: '2028-02-16', end: '2028-02-29' },
      lines: [],
    },
  }), attempt), true);
  assert.equal(progressMeasurementCutSnapshotConfirmsAttempt(snapshot({
    head: { currentCutId: 'cut-other', revision: 2 },
    latestCut: {
      id: 'cut-other',
      previousCutId: 'cut-previous',
      candidateToken: 'e'.repeat(64),
      period: { start: '2028-02-16', end: '2028-02-29' },
      lines: [],
    },
  }), attempt), false);
});

test('freshness uses only the server readiness contract and never guesses from quantities', () => {
  assert.equal(cutFreshness(snapshot()), 'STALE');
  assert.equal(cutFreshness(snapshot({
    readiness: { state: 'UP_TO_DATE', canSeal: false },
  })), 'UP_TO_DATE');
  assert.equal(cutFreshness(snapshot({ latestCut: null })), 'NOT_SEALED');
  assert.equal(cutFreshness(snapshot({
    readiness: { state: 'UNRECOGNIZED', canSeal: false },
  })), 'UNKNOWN');
});

test('client accepts only the private non-executable frozen GET contract', () => {
  const valid = {
    project: {
      id: 'project-1',
      name: 'Edificio Centro',
      status: 'ACTIVE',
      timeZone: 'America/Argentina/Buenos_Aires',
    },
    requestedPeriod: {
      start: '2028-02-16',
      end: '2028-02-29',
      label: '2.ª quincena',
    },
    tenantToday: '2028-03-01',
    head: null,
    readiness: {
      state: 'EMPTY',
      candidateReady: false,
      canSeal: false,
      blockingReason: 'NO_APPROVED_MEASUREMENTS',
      reviewPending: false,
      periodClosed: true,
      taskCount: 0,
      measuredLineCount: 0,
      missingLineCount: 0,
    },
    candidate: {
      expectedHeadCutId: null,
      token: 'a'.repeat(64),
      taskCount: 0,
      measuredLineCount: 0,
      missingLineCount: 0,
      lines: [],
    },
    latestCut: null,
    executionAllowed: false,
  };
  const expected = {
    periodStart: '2028-02-16',
    timeZone: 'America/Argentina/Buenos_Aires',
  };
  assert.equal(progressMeasurementCutSnapshotIsUsable(valid, expected), true);
  assert.equal(progressMeasurementCutSnapshotIsUsable({
    ...valid,
    executionAllowed: true,
  }, expected), false);
  assert.equal(progressMeasurementCutSnapshotIsUsable({
    ...valid,
    candidate: { ...valid.candidate, token: 'A'.repeat(64) },
  }, expected), false);
  assert.equal(progressMeasurementCutSnapshotIsUsable({
    ...valid,
    project: { ...valid.project, timeZone: 'UTC' },
  }, expected), false);
});
