import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const sourcePath = new URL(`../src/${specifier.slice(2)}.js`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { createEmptyAppState, emptyAppState } = await import('../src/lib/db.js');

const EXPECTED_EMPTY_STATE = {
  operariosCount: 0,
  avancePercentage: 0,
  alertsCount: 0,
  diasEstimados: '',
  tasks: {},
  incidents: [],
  attendance: {},
  stockpiles: {},
  hrAttendance: {},
  hrBonuses: [],
};

test('production empty state keeps the complete dashboard shape without seeded records', () => {
  assert.deepEqual(createEmptyAppState(), EXPECTED_EMPTY_STATE);
  assert.deepEqual(Object.keys(createEmptyAppState()).sort(), Object.keys(EXPECTED_EMPTY_STATE).sort());
});

test('production empty state does not contain demo identities', () => {
  const serialized = JSON.stringify(createEmptyAppState()).toLowerCase();
  for (const identity of ['juan', 'carlos', 'luis']) {
    assert.equal(serialized.includes(identity), false);
  }
});

test('each production empty state is a fresh mutable snapshot', () => {
  const first = createEmptyAppState();
  first.tasks.task = { name: 'Fundaciones' };
  first.incidents.push({ id: 'incident-1' });
  first.attendance.worker = { status: 'Presente' };

  const second = createEmptyAppState();
  assert.deepEqual(second, EXPECTED_EMPTY_STATE);
  assert.notEqual(first.tasks, second.tasks);
  assert.notEqual(first.incidents, second.incidents);
  assert.notEqual(first.attendance, second.attendance);
});

test('the exported canonical empty state cannot be mutated accidentally', () => {
  assert.equal(Object.isFrozen(emptyAppState), true);
  assert.equal(Object.isFrozen(emptyAppState.tasks), true);
  assert.equal(Object.isFrozen(emptyAppState.incidents), true);
  assert.throws(() => {
    emptyAppState.tasks.task = {};
  }, TypeError);
});
