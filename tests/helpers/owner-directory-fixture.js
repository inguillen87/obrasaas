import assert from 'node:assert/strict';
import { database, scope } from './assignment-overlap-fixture.js';
export function ownerDirectoryFixture() {
  const fixture = database(), { state, prisma } = fixture;
  const row = (kind, index) => ({ id: kind === 'WORKER' ? index ? 'worker-' + index : 'worker-a' : index ? 'team-' + index : 'team-a', name: (kind === 'WORKER' ? 'Persona ' : 'Cuadrilla ') + String(index).padStart(3, '0'), projectId: scope.projectId, organizationId: scope.organizationId, active: true, status: 'ACTIVE', privatePhone: 'NEVER_RETURN_THIS' });
  state.directoryWorkers = Array.from({ length: 137 }, (_, index) => row('WORKER', index));
  state.directoryTeams = Array.from({ length: 73 }, (_, index) => row('TEAM', index));
  const calls = [];
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'AND') return value.every(part => matches(row, part));
      if (key === 'OR') return value.some(part => matches(row, part));
      if (key === 'project') return value.organizationId === row.organizationId;
      if (value && typeof value === 'object') return Object.entries(value).every(([op, expected]) => {
        if (op === 'mode') return true;
        if (op === 'in') return expected.includes(row[key]);
        if (op === 'gt') return row[key] > expected;
        if (op === 'contains') return row[key].toLowerCase().includes(expected.replace(/\\([\\%_])/g, '$1').toLowerCase());
        throw new Error('Unsupported fixture operator ' + op);
      });
      return row[key] === value;
    });
  }
  for (const [key, stateKey] of [['worker', 'directoryWorkers'], ['workTeam', 'directoryTeams']]) {
    prisma[key].findMany = async options => {
      calls.push({ key, options: structuredClone(options) });
      assert.equal(options.where.projectId, scope.projectId);
      assert.ok(options.take <= 101);
      const rows = state[stateKey].filter(item => matches(item, options.where));
      rows.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      return rows.slice(0, options.take).map(item => Object.fromEntries(Object.entries(options.select).filter(([, enabled]) => enabled).map(([name]) => [name, item[name]])));
    };
    prisma[key].findFirst = async ({ where }) => structuredClone(state[stateKey].find(item => matches(item, where)) || null);
  }
  return { ...fixture, calls };
}
