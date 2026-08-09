import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const continuousIntegration = await readFile(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

test('CI isolates attendance migrations with disjoint source globs', () => {
  assert.doesNotMatch(continuousIntegration, /20260724\*_attendance_s2_\*/);
  assert.equal(
    continuousIntegration.match(/prisma\/migrations\/20260724\*/g)?.length,
    1,
  );
  assert.equal(
    continuousIntegration.match(/attendance-migrations\/20260724\*/g)?.length,
    1,
  );
});
