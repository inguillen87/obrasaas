import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = name => fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');
for (const file of ['vercel.json', 'vercel.recovery.json']) {
  test(file + ' executes diagnostics before the guarded build', () => {
    const config = JSON.parse(read(file));
    assert.equal(config.buildCommand, 'node scripts/inspect-release-configuration.mjs && npm run build:vercel');
  });
}
test('release diagnostics do not replace the migration guard', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['build:vercel'], 'node scripts/vercel-build.mjs');
  assert.match(read('scripts/vercel-build.mjs'), /const plan = evaluateMigrationGate\(environment\)/);
});
