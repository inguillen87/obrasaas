import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// Exercise the verifier entry point without authorizing database access.
// Imports must not outrun the hook that resolves the application aliases.
test('history SQL verifier loads before refusing an unacknowledged database', () => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/verify-proactive-flow-history-postgres.mjs'], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 15000, maxBuffer: 1048576,
    env: { ...process.env, EXECUTION_RELEASE_DISPOSABLE: 'false', EXECUTION_RELEASE_DATABASE_URL: '',
      DATABASE_URL: '', DATABASE_URL_UNPOOLED: '', DIRECT_URL: '' },
  });
  assert.equal(result.error, undefined); assert.equal(result.status, 1);
  const output = result.stdout + result.stderr;
  assert.match(output, /Execution verification requires an explicitly acknowledged, isolated loopback PostgreSQL database/);
  assert.doesNotMatch(output, /ERR_MODULE_NOT_FOUND|Cannot find package/);
});
