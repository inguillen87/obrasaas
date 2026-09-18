import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNavigationCatalog, searchWorkspaceNavigation, navigationSearchText } from '../src/lib/workspace-navigation-search.js';
import { evaluateWorkspaceLeave } from '../src/lib/workspace-leave-policy.js';
const groups = [{ label: 'Obra', destinations: [
  { key: 'field-mobile', label: 'Campo móvil', href: '/dashboard/campo', permission: 'canReadExecution' },
  { key: 'progress', label: 'Bitácora de avance', href: '/dashboard/progress', permission: 'canReadExecution' },
  { key: 'inspections', label: 'Inspecciones QA/QC', href: '/dashboard/inspections', permission: 'canReadExecution' },
]}, { label: 'Gestión', destinations: [
  { key: 'integrations', label: 'Integraciones', href: '/dashboard/integrations', permission: 'canManageIntegrations' },
  { key: 'team', label: 'Equipo y roles', href: '/dashboard/team', permission: 'canReadTeam' },
  { key: 'privacy', label: 'Privacidad', href: '/dashboard/privacy', permission: 'canManagePrivacy', hardNavigation: true },
]}];
const reader = buildNavigationCatalog(groups, { canReadExecution: true });
test('catalog contains only explicitly permitted destinations', () => {
  assert.deepEqual(reader.map(item => item.key), ['field-mobile', 'progress', 'inspections']);
  assert.deepEqual(buildNavigationCatalog(groups), []);
  assert.deepEqual(buildNavigationCatalog(groups, { canReadExecution: 'true' }), []);
});
test('search strips accents, whitespace and case', () => {
  assert.equal(navigationSearchText('  BITÁCORA   MÓVIL  '), 'bitacora movil');
  assert.equal(searchWorkspaceNavigation(reader, 'BITACORA')[0].key, 'progress');
});
test('activity synonyms resolve existing destinations', () => {
  assert.equal(searchWorkspaceNavigation(reader, 'fotos')[0].key, 'progress');
  assert.equal(searchWorkspaceNavigation(reader, 'faltante')[0].key, 'field-mobile');
  assert.equal(searchWorkspaceNavigation(reader, 'calidad')[0].key, 'inspections');
});
test('search never reveals a denied section even with its exact name', () => {
  for (const word of ['Integraciones', 'permisos', 'privacidad', 'meta', 'superadmin']) assert.equal(searchWorkspaceNavigation(reader, word).length, 0);
});
test('multiple words must all match', () => {
  assert.equal(searchWorkspaceNavigation(reader, 'bitacora fotos').length, 1);
  assert.equal(searchWorkspaceNavigation(reader, 'bitacora submarino').length, 0);
});
test('blank search shows the allowed catalog without changing it', () => {
  const before = JSON.stringify(reader);
  assert.equal(searchWorkspaceNavigation(reader, '  ').length, 3);
  searchWorkspaceNavigation(reader, 'foto'); assert.equal(JSON.stringify(reader), before);
});
test('duplicate destination keys appear only once', () => {
  assert.equal(buildNavigationCatalog([...groups, ...groups], { canReadExecution: true }).length, 3);
});
test('unknown keys and external or malformed URLs are rejected', () => {
  for (const href of ['javascript:alert(1)', '//example.test', 'https://example.test', '/dashboardish', '/dashboard\\evil', '/dashboard\nevil']) {
    assert.equal(buildNavigationCatalog([{ destinations: [{ key: 'progress', href }] }]).length, 0);
  }
  assert.equal(buildNavigationCatalog([{ destinations: [{ key: '__proto__', href: '/dashboard' }] }]).length, 0);
});
test('private surface keeps hard navigation semantics', () => {
  const result = buildNavigationCatalog(groups, { canManagePrivacy: true });
  assert.equal(result[0].hardNavigation, true); assert.equal(result[0].href, '/dashboard/privacy');
});
for (const [name, values, expected] of [
  ['clean', {}, 'ALLOW'], ['dirty', { dirty: true }, 'CONFIRM'],
  ['accepted', { dirty: true, confirmed: true }, 'ALLOW'], ['busy', { busy: true }, 'WAIT'],
  ['busy cannot be discarded', { dirty: true, busy: true, confirmed: true }, 'WAIT'],
]) test('navigation decision: ' + name, () => assert.equal(evaluateWorkspaceLeave(values), expected));
