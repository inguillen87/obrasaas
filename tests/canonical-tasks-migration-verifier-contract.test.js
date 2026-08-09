import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const verifier = await readFile(
  new URL('../scripts/verify-canonical-tasks-migration.mjs', import.meta.url),
  'utf8',
);

test('canonical task verifier checks table-qualified columns without rejecting later additions', () => {
  for (const column of [
    "['Task', 'projectId']",
    "['Task', 'code']",
    "['Task', 'type']",
    "['Task', 'revision']",
    "['Task', 'parentId']",
    "['TaskDependency', 'projectId']",
    "['TaskDependency', 'predecessorId']",
    "['TaskDependency', 'successorId']",
    "['TaskDependency', 'type']",
    "['TaskDependency', 'lagDays']",
  ]) {
    assert.ok(verifier.includes(column), `Missing verifier contract for ${column}.`);
  }

  assert.match(verifier, /information_schema\.columns/);
  assert.match(verifier, /actual\.table_schema = current_schema\(\)/);
  assert.match(verifier, /unnest\(\$1::text\[\], \$2::text\[\]\)/);
  assert.match(verifier, /Missing canonical task columns/);
  assert.doesNotMatch(verifier, /assert\.equal\(catalog\.rowCount/);
});
