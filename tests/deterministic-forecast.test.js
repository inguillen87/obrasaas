import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateDeterministicForecast,
  DeterministicForecastError,
  FORECAST_CALENDAR,
  FORECAST_ENGINE_VERSION,
} from '../src/lib/deterministic-forecast.js';

function task(id, overrides = {}) {
  return {
    id,
    type: 'TASK',
    progress: 0,
    baselineStartDate: '2026-01-01',
    baselineFinishDate: '2026-01-03',
    ...overrides,
  };
}

function forecast(tasks, dependencies = [], asOfDate = '2026-01-01') {
  return calculateDeterministicForecast({ asOfDate, tasks, dependencies });
}

function byId(result, id) {
  return result.tasks.find((item) => item.id === id);
}

function assertForecastError(action, code) {
  assert.throws(action, (error) => (
    error instanceof DeterministicForecastError
    && error.code === code
  ));
}

test('forecast is input-order independent, topologically stable, pure and hash reproducible', () => {
  const tasks = [
    task('z-independent'),
    task('b-successor'),
    task('c-predecessor'),
    task('a-predecessor'),
  ];
  const dependencies = [
    {
      predecessorId: 'a-predecessor',
      successorId: 'b-successor',
      type: 'FS',
      lagDays: 0,
    },
    {
      predecessorId: 'c-predecessor',
      successorId: 'b-successor',
      type: 'FINISH_TO_START',
      lagDays: 0,
    },
  ];
  const before = structuredClone({ tasks, dependencies });

  const first = forecast(tasks, dependencies);
  const second = forecast([...tasks].reverse(), [...dependencies].reverse());

  assert.deepEqual(first, second);
  assert.deepEqual({ tasks, dependencies }, before);
  assert.deepEqual(first.topologicalOrder, [
    'a-predecessor',
    'c-predecessor',
    'b-successor',
    'z-independent',
  ]);
  assert.equal(byId(first, 'b-successor').driver.predecessorId, 'a-predecessor');
  assert.equal(first.engineVersion, FORECAST_ENGINE_VERSION);
  assert.equal(first.calendar, FORECAST_CALENDAR);
  assert.match(first.inputHash, /^[a-f0-9]{64}$/);
  assert.match(first.resultHash, /^[a-f0-9]{64}$/);
  const changed = forecast(tasks, dependencies.map((dependency, index) => (
    index === 0 ? { ...dependency, lagDays: 1 } : dependency
  )));
  assert.notEqual(changed.inputHash, first.inputHash);
  assert.notEqual(changed.resultHash, first.resultHash);
});

test('forecast evaluates FS, SS, FF and SF using inclusive civil dates', () => {
  const result = forecast([
    task('a', { baselineFinishDate: '2026-01-03' }),
    task('fs', { baselineFinishDate: '2026-01-02' }),
    task('ss', { baselineFinishDate: '2026-01-02' }),
    task('ff', { baselineFinishDate: '2026-01-02' }),
    task('sf', { baselineFinishDate: '2026-01-02' }),
  ], [
    { predecessorId: 'a', successorId: 'fs', type: 'FINISH_TO_START', lagDays: 2 },
    { predecessorId: 'a', successorId: 'ss', type: 'SS', lagDays: 2 },
    { predecessorId: 'a', successorId: 'ff', type: 'FF', lagDays: 2 },
    { predecessorId: 'a', successorId: 'sf', type: 'START_TO_FINISH', lagDays: 2 },
  ]);

  assert.deepEqual(byId(result, 'fs').forecast, {
    startDate: '2026-01-06',
    finishDate: '2026-01-07',
    durationDays: 2,
    remainingDurationDays: 2,
  });
  assert.equal(byId(result, 'ss').forecast.startDate, '2026-01-03');
  assert.equal(byId(result, 'ff').forecast.startDate, '2026-01-04');
  assert.equal(byId(result, 'ff').forecast.finishDate, '2026-01-05');
  assert.equal(byId(result, 'sf').forecast.startDate, '2026-01-02');
  assert.equal(byId(result, 'sf').forecast.finishDate, '2026-01-03');
  assert.deepEqual(byId(result, 'fs').driver, {
    kind: 'DEPENDENCY',
    predecessorId: 'a',
    type: 'FINISH_TO_START',
    code: 'FS',
    lagDays: 2,
    constraintDate: '2026-01-06',
  });
});

test('negative lag is an explicit lead and never bypasses baseline or data-date constraints', () => {
  const result = forecast([
    task('a', { baselineFinishDate: '2026-01-05' }),
    task('b', { baselineStartDate: '2026-01-03', baselineFinishDate: '2026-01-04' }),
  ], [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: -2 }]);
  assert.equal(byId(result, 'b').forecast.startDate, '2026-01-04');

  const dataDateWins = forecast([
    task('a', { baselineStartDate: '2026-01-01', baselineFinishDate: '2026-01-02' }),
    task('b', { baselineStartDate: '2026-01-01', baselineFinishDate: '2026-01-02' }),
  ], [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: -10 }], '2026-01-10');
  assert.equal(byId(dataDateWins, 'b').forecast.startDate, '2026-01-10');
  assert.equal(byId(dataDateWins, 'b').driver.kind, 'DATA_DATE');
});

test('partially complete work requires explicit remaining duration instead of deriving it from progress', () => {
  const partial = task('partial', {
    progress: 65,
    actualStartDate: '2026-01-02',
    baselineFinishDate: '2026-01-10',
  });
  assertForecastError(
    () => forecast([partial], [], '2026-01-08'),
    'FORECAST_REMAINING_DURATION_REQUIRED',
  );

  const result = forecast([{ ...partial, remainingDurationDays: 4 }], [], '2026-01-08');
  assert.deepEqual(byId(result, 'partial').forecast, {
    startDate: '2026-01-02',
    finishDate: '2026-01-11',
    durationDays: 10,
    remainingDurationDays: 4,
  });
  assert.equal(byId(result, 'partial').driver.kind, 'DATA_DATE_AND_REMAINING_DURATION');
  assert.equal(byId(result, 'partial').deltas.finishDays, 1);
});

test('not-started work always uses baseline duration and rejects a remaining-duration override', () => {
  assertForecastError(
    () => forecast([task('pending', { remainingDurationDays: 7 })]),
    'FORECAST_REMAINING_DURATION_UNEXPECTED',
  );
  assertForecastError(
    () => forecast([task('pending-milestone', {
      type: 'MILESTONE',
      baselineFinishDate: '2026-01-01',
      remainingDurationDays: 0,
    })]),
    'FORECAST_REMAINING_DURATION_UNEXPECTED',
  );

  const result = forecast([task('pending')]);
  assert.equal(byId(result, 'pending').baseline.durationDays, 3);
  assert.equal(byId(result, 'pending').forecast.durationDays, 3);
});

test('actual dates override planned dependencies but relationship violations remain explicit', () => {
  const result = forecast([
    task('predecessor', {
      progress: 40,
      actualStartDate: '2026-01-01',
      remainingDurationDays: 10,
    }),
    task('successor', {
      progress: 50,
      actualStartDate: '2026-01-02',
      remainingDurationDays: 2,
    }),
  ], [{ predecessorId: 'predecessor', successorId: 'successor', type: 'FS', lagDays: 0 }], '2026-01-03');

  assert.equal(byId(result, 'successor').forecast.startDate, '2026-01-02');
  assert.equal(byId(result, 'successor').relationshipConstraints[0].requiredDate, '2026-01-13');
  assert.equal(byId(result, 'successor').relationshipConstraints[0].violated, true);
});

test('milestones have zero duration and preserve FS, FF and completed actual semantics', () => {
  const result = forecast([
    task('work', {
      progress: 50,
      actualStartDate: '2026-01-01',
      remainingDurationDays: 1,
    }),
    task('finish-gate', {
      type: 'MILESTONE',
      baselineStartDate: '2026-01-01',
      baselineFinishDate: '2026-01-01',
    }),
    task('after-gate', { baselineFinishDate: '2026-01-02' }),
    task('actual-gate', {
      type: 'MILESTONE',
      progress: 100,
      baselineStartDate: '2026-01-02',
      baselineFinishDate: '2026-01-02',
      actualStartDate: '2026-01-04',
      actualFinishDate: '2026-01-04',
      remainingDurationDays: 0,
    }),
  ], [
    { predecessorId: 'work', successorId: 'finish-gate', type: 'FF', lagDays: 0 },
    { predecessorId: 'finish-gate', successorId: 'after-gate', type: 'FS', lagDays: 0 },
  ], '2026-01-05');

  assert.deepEqual(byId(result, 'finish-gate').forecast, {
    startDate: '2026-01-05',
    finishDate: '2026-01-05',
    durationDays: 0,
    remainingDurationDays: 0,
  });
  assert.equal(byId(result, 'after-gate').forecast.startDate, '2026-01-06');
  assert.equal(byId(result, 'actual-gate').forecast.durationDays, 0);
  assert.equal(byId(result, 'actual-gate').driver.kind, 'ACTUAL');
});

test('civil-day arithmetic remains stable across DST boundaries and leap days', () => {
  const spring = forecast([
    task('a', { baselineStartDate: '2026-03-07', baselineFinishDate: '2026-03-08' }),
    task('b', { baselineStartDate: '2026-03-07', baselineFinishDate: '2026-03-07' }),
  ], [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 }], '2026-03-07');
  assert.equal(byId(spring, 'b').forecast.startDate, '2026-03-09');

  const fall = forecast([
    task('a', { baselineStartDate: '2026-10-31', baselineFinishDate: '2026-11-01' }),
    task('b', { baselineStartDate: '2026-10-31', baselineFinishDate: '2026-10-31' }),
  ], [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 0 }], '2026-10-31');
  assert.equal(byId(fall, 'b').forecast.startDate, '2026-11-02');

  const leap = forecast([task('leap', {
    baselineStartDate: '2028-02-28',
    baselineFinishDate: '2028-03-01',
  })], [], '2028-02-28');
  assert.equal(byId(leap, 'leap').baseline.durationDays, 3);
});

test('cycles are rejected with a deterministic explicit path', () => {
  const tasks = [task('c'), task('a'), task('b')];
  const dependencies = [
    { predecessorId: 'b', successorId: 'c', type: 'FS' },
    { predecessorId: 'c', successorId: 'a', type: 'FS' },
    { predecessorId: 'a', successorId: 'b', type: 'FS' },
  ];
  assert.throws(() => forecast(tasks, dependencies), (error) => {
    assert.equal(error.code, 'FORECAST_DEPENDENCY_CYCLE');
    assert.deepEqual(error.details.cycle, ['a', 'b', 'c', 'a']);
    return true;
  });
});

test('a 5,000-task chain forecasts deterministically and large-cycle reporting does not recurse', () => {
  const taskCount = 5_000;
  const tasks = Array.from({ length: taskCount }, (_, index) => task(`task-${String(index).padStart(5, '0')}`, {
    baselineFinishDate: '2026-01-01',
  }));
  const dependencies = Array.from({ length: taskCount - 1 }, (_, index) => ({
    predecessorId: tasks[index].id,
    successorId: tasks[index + 1].id,
    type: 'FS',
    lagDays: 0,
  }));

  const result = forecast(tasks, dependencies);
  assert.equal(result.tasks.length, taskCount);
  assert.equal(result.topologicalOrder[0], 'task-00000');
  assert.equal(result.topologicalOrder.at(-1), 'task-04999');
  assert.equal(result.tasks.at(-1).deltas.startDays, taskCount - 1);

  const cycle = [
    ...dependencies,
    { predecessorId: 'task-04999', successorId: 'task-00000', type: 'FS', lagDays: 0 },
  ];
  assert.throws(() => forecast([...tasks].reverse(), [...cycle].reverse()), (error) => {
    assert.equal(error.code, 'FORECAST_DEPENDENCY_CYCLE');
    assert.equal(error.details.cycle.length, taskCount + 1);
    assert.equal(error.details.cycle[0], 'task-00000');
    assert.equal(error.details.cycle.at(-1), 'task-00000');
    return true;
  });
});

test('invalid dates, relationship types, references, self-links and duplicate pairs fail explicitly', () => {
  assertForecastError(
    () => forecast([task('bad-date', { baselineStartDate: '2026-02-30' })]),
    'FORECAST_DATE_INVALID',
  );
  assertForecastError(
    () => forecast([task('timestamp', { baselineStartDate: '2026-01-01T00:00:00Z' })]),
    'FORECAST_DATE_INVALID',
  );
  assertForecastError(
    () => forecast([task('a'), task('b')], [{ predecessorId: 'a', successorId: 'b', type: 'XX' }]),
    'FORECAST_DEPENDENCY_TYPE_INVALID',
  );
  assertForecastError(
    () => forecast([task('a')], [{ predecessorId: 'missing', successorId: 'a', type: 'FS' }]),
    'FORECAST_DEPENDENCY_UNKNOWN_TASK',
  );
  assertForecastError(
    () => forecast([task('a')], [{ predecessorId: 'a', successorId: 'a', type: 'FS' }]),
    'FORECAST_DEPENDENCY_SELF_REFERENCE',
  );
  assertForecastError(
    () => forecast([task('a'), task('b')], [
      { predecessorId: 'a', successorId: 'b', type: 'FS' },
      { predecessorId: 'a', successorId: 'b', type: 'SS' },
    ]),
    'FORECAST_DEPENDENCY_DUPLICATE',
  );
});

test('project and task deltas expose baseline versus forecast without mutating baseline', () => {
  const result = forecast([
    task('a', { baselineStartDate: '2026-01-01', baselineFinishDate: '2026-01-03' }),
    task('b', { baselineStartDate: '2026-01-04', baselineFinishDate: '2026-01-05' }),
  ], [{ predecessorId: 'a', successorId: 'b', type: 'FS', lagDays: 3 }]);

  assert.deepEqual(byId(result, 'b').baseline, {
    startDate: '2026-01-04',
    finishDate: '2026-01-05',
    durationDays: 2,
  });
  assert.deepEqual(byId(result, 'b').deltas, {
    startDays: 3,
    finishDays: 3,
    durationDays: 0,
  });
  assert.deepEqual(result.project, {
    baseline: { startDate: '2026-01-01', finishDate: '2026-01-05' },
    forecast: { startDate: '2026-01-01', finishDate: '2026-01-08' },
    deltas: { startDays: 0, finishDays: 3 },
  });
});
