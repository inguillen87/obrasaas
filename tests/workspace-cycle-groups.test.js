import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { groupWorkspaceByCycle, workspaceCycleForDestination } from '../src/lib/workspace-cycle-groups.js';
import { buildNavigationCatalog, searchWorkspaceNavigation } from '../src/lib/workspace-navigation-search.js';
import { dashboardDestinationIsActive } from '../src/lib/dashboard-navigation.js';
const source = readFileSync(new URL('../src/app/dashboard/dashboard-shell.js', import.meta.url), 'utf8');
const start = source.indexOf('const WORKSPACE_DESTINATIONS'); const end = source.indexOf('function visibleDestinations', start);
const all = new Function(source.slice(start, end) + '\nreturn [...WORKSPACE_DESTINATIONS,...CONTROL_DESTINATIONS,...EXPLORE_DESTINATIONS];')();
test('every existing menu destination survives exactly once across the six cycles', () => {
  const grouped = groupWorkspaceByCycle(all); const flattened = grouped.flatMap(group => group.destinations);
  assert.equal(grouped.length, 6); assert.equal(flattened.length, all.length); assert.equal(new Set(flattened.map(d => d.key)).size, all.length);
  for (const old of all) { const next = flattened.find(d => d.key === old.key); assert.equal(next.href, old.href); assert.equal(next.permission, old.permission); assert.equal(next.hardNavigation, old.hardNavigation); }
});
test('grouping does not introduce destinations missing from authorized inputs', () => {
  const allowed = all.filter(d => !d.permission || d.permission === 'canReadExecution');
  const result = groupWorkspaceByCycle(allowed).flatMap(g => g.destinations);
  assert.equal(result.length, allowed.length); assert.ok(!result.some(d => d.key === 'integrations')); assert.ok(!result.some(d => d.key === 'privacy'));
});
test('empty cycles disappear and future routes stay discoverable', () => {
  assert.deepEqual(groupWorkspaceByCycle([]), []);
  const groups = groupWorkspaceByCycle([{ key: 'future', label: 'Futuro', href: '/dashboard/future' }]);
  assert.equal(groups[0].key, 'other'); assert.equal(groups[0].destinations[0].key, 'future');
});
test('ambiguous menu labels are clarified without breaking their route', () => {
  const destinations = groupWorkspaceByCycle(all).flatMap(g => g.destinations);
  assert.equal(destinations.find(d => d.key === 'activity').label, 'Historial y auditoría');
  assert.equal(destinations.find(d => d.key === 'execution').label, 'Cuadrillas y restricciones');
  assert.equal(destinations.find(d => d.key === 'contracts').label, 'Contratos y partidas');
});
test('command palette receives the same cycle labels and retains role filtering', () => {
  const groups = groupWorkspaceByCycle(all); const catalog = buildNavigationCatalog(groups, { canReadExecution: true });
  assert.ok(!catalog.some(item => item.key === 'integrations')); assert.ok(catalog.some(item => item.key === 'progress' && item.group === 'Calidad y avance'));
  assert.ok(searchWorkspaceNavigation(catalog, 'fotos').some(item => item.key === 'progress'));
  assert.ok(searchWorkspaceNavigation(catalog, 'centro operaciones').some(item => item.key === 'summary'));
});
test('active route identification is preserved with query and nested module paths', () => {
  const destinations = groupWorkspaceByCycle(all).flatMap(g => g.destinations);
  assert.equal(dashboardDestinationIsActive(destinations.find(d => d.key === 'gantt'), { pathname: '/dashboard', tab: 'sec-gantt' }), true);
  assert.equal(dashboardDestinationIsActive(destinations.find(d => d.key === 'progress'), { pathname: '/dashboard/progress', tab: null }), true);
  assert.equal(workspaceCycleForDestination('purchases'), 'supply'); assert.equal(workspaceCycleForDestination('new'), 'other');
});
test('shell and home use a shared catalog and mount the operations reader only on Hoy', () => {
  const client = readFileSync(new URL('../src/app/dashboard/dashboard-client.js', import.meta.url), 'utf8');
  assert.match(source, /buildNavigationCatalog\(cycleGroups, model.permissions\)/);
  assert.match(source, /cycleGroups.map\(group => <NavigationGroup/);
  assert.match(client, /activeTab === 'sec-dashboard' && <OperationsCenter/);
  assert.match(source, /requestWorkspaceNavigation\('route'\)/);
});
