import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const continuousIntegration = await readFile(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

test('CI isolates the complete migration suffix from the attendance cutover', () => {
  assert.match(
    continuousIntegration,
    /attendance_cutover="20260723150000_attendance_status_expired_enum"/,
  );
  assert.match(
    continuousIntegration,
    /for migration in prisma\/migrations\/\*\/; do/,
  );
  assert.match(
    continuousIntegration,
    /\[\[ "\$migration_name" < "\$attendance_cutover" \]\] && continue/,
  );
  assert.match(
    continuousIntegration,
    /attendance_migrations=\("\$RUNNER_TEMP"\/attendance-migrations\/\*\/\)/,
  );
  assert.match(
    continuousIntegration,
    /mv "\$\{attendance_migrations\[@\]\}" prisma\/migrations\//,
  );
  assert.doesNotMatch(continuousIntegration, /202607(?:2315|24)[^\n]*\*/);
});
