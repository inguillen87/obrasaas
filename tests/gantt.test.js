import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGanttModel,
  dependencyCycle,
  earliestGanttStartDay,
  ganttDateForDay,
  ganttDayForDate,
  ganttTaskStartDay,
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

  assert.deepEqual(model.dependencyEdges, [{ fromId: 'foundations', toId: 'structure' }]);
  assert.equal(model.dependencyConflicts, 1);
  assert.equal(model.taskById.get('structure').earliestStartDay, 6);
  assert.equal(model.taskById.get('masonry').dependencyConflict, false);
  assert.equal(model.totalDays, 49);
  assert.equal(model.unitDays, 7);
});

test('gantt suggests the first day after every selected predecessor', () => {
  assert.equal(earliestGanttStartDay({
    a: { name: 'A', startDay: 1, duration: 5 },
    b: { name: 'B', startDay: 4, duration: 9 },
  }, ['a', 'b'], 2), 13);
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
