import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ScheduleObservationError,
  buildScheduleObservations,
  scheduleObservationRequirements,
} from '../src/lib/schedule-observations.js';

const tasks = [
  { id: 'not-started', title: 'Excavación', type: 'TASK', revision: 1, progress: 0 },
  { id: 'in-progress', title: 'Muro norte', type: 'TASK', revision: 3, progress: 50 },
  { id: 'complete', title: 'Replanteo', type: 'MILESTONE', revision: 2, progress: 100 },
];

test('forecast requirements expose only real-data fields and never invent actual dates', () => {
  assert.deepEqual(scheduleObservationRequirements(tasks), [
    {
      sourceTaskId: 'complete',
      title: 'Replanteo',
      type: 'MILESTONE',
      progressPercent: 100,
      requiresActualStart: true,
      requiresActualFinish: true,
      requiresRemainingDuration: false,
    },
    {
      sourceTaskId: 'in-progress',
      title: 'Muro norte',
      type: 'TASK',
      progressPercent: 50,
      requiresActualStart: true,
      requiresActualFinish: false,
      requiresRemainingDuration: true,
    },
  ]);
  assert.throws(
    () => buildScheduleObservations(tasks, {}, { asOfDate: '2026-07-28' }),
    (error) => error instanceof ScheduleObservationError
      && /inicio real/.test(error.message),
  );
});

test('forecast observations are complete, stable, and preserve canonical task revisions', () => {
  const observations = buildScheduleObservations(tasks, {
    'in-progress': { actualStartDate: '2026-07-25', remainingDurationDays: '4' },
    complete: { actualStartDate: '2026-07-20', actualFinishDate: '2026-07-20' },
  }, { asOfDate: '2026-07-28' });
  assert.deepEqual(observations.map((observation) => observation.sourceTaskId), [
    'complete', 'in-progress', 'not-started',
  ]);
  assert.deepEqual(observations[0], {
    sourceTaskId: 'complete',
    expectedTaskRevision: 2,
    progressPercent: 100,
    progressSource: 'CANONICAL_TASK',
    actualStartDate: '2026-07-20',
    actualFinishDate: '2026-07-20',
    remainingDurationDays: 0,
  });
  assert.deepEqual(observations[1], {
    sourceTaskId: 'in-progress',
    expectedTaskRevision: 3,
    progressPercent: 50,
    progressSource: 'CANONICAL_TASK',
    actualStartDate: '2026-07-25',
    actualFinishDate: null,
    remainingDurationDays: 4,
  });
  assert.equal(observations[2].actualStartDate, null);
  assert.equal(observations[2].remainingDurationDays, null);
});

test('observation builder rejects future actuals, inconsistent finishes, partial milestones and stale shapes', () => {
  const cases = [
    {
      tasks: [tasks[1]],
      entries: { 'in-progress': { actualStartDate: '2026-07-29', remainingDurationDays: 2 } },
      message: /posterior a la fecha de corte/,
    },
    {
      tasks: [tasks[2]],
      entries: { complete: { actualStartDate: '2026-07-20', actualFinishDate: '2026-07-21' } },
      message: /hito completado/,
    },
    {
      tasks: [{ id: 'milestone', title: 'Hito', type: 'MILESTONE', revision: 1, progress: 50 }],
      entries: { milestone: { actualStartDate: '2026-07-20', remainingDurationDays: 1 } },
      message: /no admite avance parcial/,
    },
    {
      tasks: [{ id: 'bad', title: 'Sin revisión', type: 'TASK', progress: 0 }],
      entries: {},
      message: /revision/,
    },
  ];
  for (const candidate of cases) {
    assert.throws(
      () => buildScheduleObservations(candidate.tasks, candidate.entries, {
        asOfDate: '2026-07-28',
      }),
      candidate.message,
    );
  }
});
