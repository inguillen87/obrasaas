import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const manifest = read('package.json'), lock = read('package-lock.json');
const version = value => {
  assert.match(value, /^\d+\.\d+\.\d+$/, 'Use a reviewed exact stable version');
  return value.split('.').map(Number);
};
function atLeast(value, minimum) {
  const current = version(value), required = version(minimum);
  for (let index = 0; index < 3; index++) {
    if (current[index] !== required[index]) return current[index] > required[index];
  }
  return true;
}
test('production Next uses the reviewed patched release and an identical lockfile', () => {
  const next = manifest.dependencies.next;
  assert.equal(version(next)[0], 16);
  assert.ok(atLeast(next, '16.3.6'));
  assert.equal(lock.packages[''].dependencies.next, next);
  assert.equal(lock.packages['node_modules/next'].version, next);
  assert.match(lock.packages['node_modules/next'].integrity, /^sha512-/);
});
test('Next tooling is aligned without moving development lint into runtime dependencies', () => {
  assert.equal(manifest.devDependencies['eslint-config-next'], manifest.dependencies.next);
  assert.equal(lock.packages['node_modules/eslint-config-next'].version, manifest.dependencies.next);
  assert.equal(manifest.dependencies['eslint-config-next'], undefined);
});
for (const [name, minimum] of Object.entries({ 'fast-uri': '3.1.7', 'undici': '6.28.1', 'mysql2': '3.23.1', 'baseline-browser-mapping': '2.11.0', 'deepmerge-ts': '8.0.0' })) {
  test(`all resolved ${name} nodes satisfy the reviewed security floor`, () => {
    const installed = Object.entries(lock.packages).filter(([path]) => path.endsWith('node_modules/' + name));
    assert.ok(installed.length > 0);
    for (const [path, metadata] of installed) assert.ok(atLeast(metadata.version, minimum), path);
  });
}
test('Prisma runtime major and schema are not silently downgraded to satisfy audit', () => {
  assert.equal(version(lock.packages['node_modules/prisma'].version)[0], 7);
  assert.equal(version(lock.packages['node_modules/@prisma/client'].version)[0], 7);
  assert.equal(version(lock.packages['node_modules/@prisma/adapter-pg'].version)[0], 7);
});
