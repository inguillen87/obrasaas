import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGanttModel,
  canonicalTasksToGanttCatalog,
  dependencyCycle,
  earliestGanttStartDay,
  ganttDateForDay,
  ganttDayForDate,
  ganttTaskStartDay,
  ganttTaskStatusForProgress,
} from '../src/lib/gantt.js';

test('gantt keeps legacy offsets compatible and promotes explicit start days', () => {
  assert.equal(ganttTaskStartDay({ startOffset: 50 }), 8);
  assert.equal(ganttTaskStartDay({ startOffset: 100 }), 14);
  assert.equal(ganttTaskStartDay({ startOffset: 50, startDay: 23 }), 23);
});

test('gantt dates are stable across timezones and reversible', () => {
  assert.equal(ganttDateForDay('2026-07-01T00:00:00.000Z', 15).toISOString(), '2026-07-15T00:00:00.000Z');
  assert.equal(ganttDayForDate('2026-07-01', '2026-07-15'), 15);
});

test('gantt builds only configured dependency edges and flags sequence conflicts', () => {
  const model = buildGanttModel({
    foundations: { name: 'Fundaciones', startDay: 1, startOffset: 0, duration: 5, progress: 100 },
    structure: {
      name: 'Estructura',
      startDay: 4,
      startOffset: 20,
      duration: 8,
      progress: 10,
      dependencies: ['foundations'],
    },
    masonry: { name: 'Mampostería', startDay: 18, startOffset: 70, duration: 4, progress: 0 },
  }, {
    projectStartsAt: '2026-07-01',
    projectEndsAt: '2026-08-15',
  });

  assert.deepEqual(model.dependencyEdges, [{
    fromId: 'foundations',
    toId: 'structure',
    type: 'FINISH_TO_START',
    lagDays: 0,
  }]);
  assert.equal(model.dependencyConflicts, 1);
  assert.equal(model.taskById.get('structure').earliestStartDay, 6);
  assert.equal(model.taskById.get('masonry').dependencyConflict, false);
  assert.equal(model.totalDays, 49);
  assert.equal(model.unitDays, 7);
});

test('gantt progress preserves only deliberate zero-progress workflow states', () => {
  assert.equal(ganttTaskStatusForProgress(100, 'BLOCKED'), 'DONE');
  assert.equal(ganttTaskStatusForProgress(35, 'BACKLOG'), 'IN_PROGRESS');
  assert.equal(ganttTaskStatusForProgress(0, 'BLOCKED'), 'BLOCKED');
  assert.equal(ganttTaskStatusForProgress(0, 'BACKLOG'), 'BACKLOG');
  assert.equal(ganttTaskStatusForProgress(0, 'DONE'), 'READY');
  assert.equal(ganttTaskStatusForProgress(0, 'IN_PROGRESS'), 'READY');
});

test('gantt exposes an honest fixed 14-day scale', () => {
  const model = buildGanttModel({
    task: { name: 'Tarea', startDay: 1, duration: 28, progress: 0 },
  }, { projectStartsAt: '2026-08-01', projectEndsAt: '2026-08-28', unitDays: 14 });
  assert.equal(model.unitDays, 14);
  assert.equal(model.columns.length, 2);
  assert.equal(model.columns[0].span, 14);
});

test('canonical task adapter keeps incoming typed dependencies visible in the Gantt', () => {
  const catalog = canonicalTasksToGanttCatalog([{
    id: 'task-b',
    title: 'Tarea B',
    startsAt: '2026-08-05T00:00:00.000Z',
    endsAt: '2026-08-07T00:00:00.000Z',
    progress: 0,
    status: 'READY',
    type: 'TASK',
    revision: 3,
    dependencies: [{
      id: 'edge-a-b',
      predecessorId: 'task-a',
      successorId: 'task-b',
      type: 'START_TO_START',
      lagDays: 3,
    }],
  }], '2026-08-01T00:00:00.000Z');
  assert.deepEqual(catalog['task-b'].dependencies, ['task-a']);
  assert.deepEqual(catalog['task-b'].dependencySpecs, [{
    predecessorId: 'task-a',
    type: 'START_TO_START',
    lagDays: 3,
  }]);
});

test('gantt suggests the first day after every selected predecessor', () => {
  assert.equal(earliestGanttStartDay({
    a: { name: 'A', startDay: 1, duration: 5 },
    b: { name: 'B', startDay: 4, duration: 9 },
  }, ['a', 'b'], 2), 13);
});

test('gantt applies FS, SS, FF and SF constraints with positive or negative lag', () => {
  const tasks = {
    predecessor: { name: 'A', startDay: 10, duration: 5 },
  };
  assert.equal(earliestGanttStartDay(tasks, [{
    predecessorId: 'predecessor', type: 'FINISH_TO_START', lagDays: 2,
  }], 1, 4), 17);
  assert.equal(earliestGanttStartDay(tasks, [{
    predecessorId: 'predecessor', type: 'START_TO_START', lagDays: 3,
  }], 1, 4), 13);
  assert.equal(earliestGanttStartDay(tasks, [{
    predecessorId: 'predecessor', type: 'FINISH_TO_FINISH', lagDays: 1,
  }], 1, 4), 12);
  assert.equal(earliestGanttStartDay(tasks, [{
    predecessorId: 'predecessor', type: 'START_TO_FINISH', lagDays: -2,
  }], 1, 4), 5);
});

test('typed dependency conflicts use the same relationship semantics as alignment', () => {
  const model = buildGanttModel({
    a: { name: 'A', startDay: 10, duration: 5 },
    b: {
      name: 'B',
      startDay: 11,
      duration: 4,
      dependencySpecs: [{ predecessorId: 'a', type: 'START_TO_START', lagDays: 3 }],
    },
  });
  assert.equal(model.taskById.get('b').earliestStartDay, 13);
  assert.equal(model.taskById.get('b').dependencyConflict, true);
  assert.deepEqual(model.dependencyEdges[0], {
    fromId: 'a', toId: 'b', type: 'START_TO_START', lagDays: 3,
  });
});

test('gantt detects circular dependencies', () => {
  const tasks = {
    a: { name: 'A', dependencies: ['c'] },
    b: { name: 'B', dependencies: ['a'] },
    c: { name: 'C', dependencies: ['b'] },
  };
  assert.deepEqual(dependencyCycle(tasks), ['a', 'c', 'b', 'a']);
  assert.equal(dependencyCycle({ a: { name: 'A' }, b: { name: 'B', dependencies: ['a'] } }), null);
});
