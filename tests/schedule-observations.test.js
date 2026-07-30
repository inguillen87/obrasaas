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

test('reviewed evidence keeps the human-selected point and explicit provenance without inventing a midpoint', () => {
  const reviewedEvidence = {
    taskId: 'in-progress',
    assessmentId: 'assessment-reviewed-a',
    expectedAssessmentRevision: 7,
    progressPercent: 43,
    rationale: 'Medición visual contrastada con el paño ejecutado en obra.',
  };
  const requirements = scheduleObservationRequirements(tasks, { reviewedEvidence });
  const reviewedRequirement = requirements.find((row) => row.sourceTaskId === 'in-progress');
  assert.equal(reviewedRequirement.progressPercent, 43);

  const observations = buildScheduleObservations(tasks, {
    'in-progress': { actualStartDate: '2026-07-25', remainingDurationDays: '6' },
    complete: { actualStartDate: '2026-07-20', actualFinishDate: '2026-07-20' },
  }, {
    asOfDate: '2026-07-28',
    reviewedEvidence,
  });
  const reviewed = observations.find((row) => row.sourceTaskId === 'in-progress');
  assert.deepEqual(reviewed, {
    sourceTaskId: 'in-progress',
    expectedTaskRevision: 3,
    progressPercent: 43,
    progressSource: 'REVIEWED_EVIDENCE',
    reviewedEvidence: {
      assessmentId: 'assessment-reviewed-a',
      expectedAssessmentRevision: 7,
      rationale: 'Medición visual contrastada con el paño ejecutado en obra.',
    },
    actualStartDate: '2026-07-25',
    actualFinishDate: null,
    remainingDurationDays: 6,
  });
  assert.notEqual(reviewed.progressPercent, 50, 'the helper must not substitute a midpoint or canonical value');
});

test('reviewed evidence selection rejects missing human point, rationale, foreign tasks, and unknown fields', () => {
  const base = {
    taskId: 'in-progress',
    assessmentId: 'assessment-reviewed-a',
    expectedAssessmentRevision: 7,
    progressPercent: 43,
    rationale: 'Punto elegido por el director de obra.',
  };
  const invalid = [
    { value: { ...base, progressPercent: undefined }, message: /avance revisado/ },
    { value: { ...base, rationale: '   ' }, message: /fundamento humano/ },
    { value: { ...base, taskId: 'foreign-task' }, message: /tarea visible/ },
    { value: { ...base, progressMin: 40 }, message: /campos no permitidos/ },
  ];
  for (const candidate of invalid) {
    assert.throws(
      () => buildScheduleObservations(tasks, {}, {
        asOfDate: '2026-07-28',
        reviewedEvidence: candidate.value,
      }),
      (error) => error instanceof ScheduleObservationError
        && candidate.message.test(error.message),
    );
  }
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
