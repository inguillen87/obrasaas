import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(root, name), 'utf8'));
const manifest = read('package.json');
const lock = read('package-lock.json');
const require = createRequire(import.meta.url);

function versions(name) {
  return Object.entries(lock.packages).filter(([key]) => key === 'node_modules/' + name
    || key.endsWith('/node_modules/' + name)).map(([, value]) => value.version);
}
function atLeast(actual, target) {
  const numbers = actual.split('.').map(Number), baseline = target.split('.').map(Number);
  if (numbers.length !== 3 || numbers.some(value => !Number.isInteger(value))) return false;
  for (let i = 0; i < 3; i += 1) { if (numbers[i] !== baseline[i]) return numbers[i] > baseline[i]; }
  return true;
}

test('Next and its lint configuration use the reviewed patched release', () => {
  assert.equal(manifest.dependencies.next, '16.3.5');
  assert.equal(manifest.devDependencies['eslint-config-next'], '16.3.5');
  assert.deepEqual(versions('next'), ['16.3.5']);
});
test('sharp image decoding cannot resolve the previously affected package version', () => {
  assert.equal(manifest.devDependencies.sharp, '0.35.4');
  assert.equal(manifest.overrides.sharp, '0.35.4');
  assert.ok(versions('sharp').length > 0);
  assert.ok(versions('sharp').every(version => atLeast(version, '0.35.4')));
});
for (const [name, minimum] of [['fast-uri', '3.1.6'], ['baseline-browser-mapping', '2.11.0'], ['mysql2', '3.23.1']]) {
  test('resolved security floor for ' + name, () => {
    const installed = versions(name); assert.ok(installed.length > 0);
    assert.ok(installed.every(version => atLeast(version, minimum)), name + ' resolved below the reviewed security floor');
  });
}
test('Prisma remains on version 7 without an automatic audit-force downgrade', () => {
  for (const name of ['prisma', '@prisma/client', '@prisma/config']) {
    assert.ok(versions(name).length > 0); assert.ok(versions(name).every(version => version.startsWith('7.')));
  }
  assert.deepEqual(manifest.overrides['@prisma/config'], { 'deepmerge-ts': '8.0.0' });
  assert.ok(versions('deepmerge-ts').every(version => atLeast(version, '8.0.0')));
});
test('Prisma config loader accepts the actual shape used by this application with the scoped merge override', async () => {
  const prismaRequire = createRequire(require.resolve('prisma/config'));
  const { loadConfigFromFile } = await import(pathToFileURL(prismaRequire.resolve('@prisma/config')).href);
  const folder = mkdtempSync(path.join(root, '.security-config-fixture-'));
  try {
    writeFileSync(path.join(folder, 'prisma.config.mjs'),
      "import { defineConfig } from 'prisma/config';\nexport default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: 'prisma/migrations' }, datasource: { url: 'postgresql://fixture:fixture@127.0.0.1:5432/fixture' } });\n");
    const result = await loadConfigFromFile({ configRoot: folder });
    assert.equal(result.error, undefined);
    assert.equal(result.config.schema, path.join(folder, 'prisma/schema.prisma'));
    assert.equal(result.config.migrations.path, path.join(folder, 'prisma/migrations'));
    assert.equal(result.config.datasource.url, 'postgresql://fixture:fixture@127.0.0.1:5432/fixture');
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
test('the scoped merge dependency loads with both supported import mechanisms and does not mutate ordinary config records', async () => {
  const prismaRequire = createRequire(require.resolve('prisma/config'));
  const configRequire = createRequire(prismaRequire.resolve('@prisma/config'));
  const loaded = configRequire('deepmerge-ts');
  const imported = await import(pathToFileURL(configRequire.resolve('deepmerge-ts')).href);
  assert.equal(typeof loaded.deepmerge, 'function'); assert.equal(typeof imported.deepmerge, 'function');
  const left = { schema: 'schema.prisma', migrations: { path: 'prisma/migrations' } };
  const right = { datasource: { url: 'postgresql://fixture:fixture@127.0.0.1:5432/fixture' } };
  const before = JSON.stringify([left, right]);
  const result = loaded.deepmerge(left, right);
  assert.deepEqual(result, { ...left, ...right }); assert.equal(JSON.stringify([left, right]), before);
});
