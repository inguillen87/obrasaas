import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const verifier = await readFile(
  new URL('../scripts/verify-s6-migrations.mjs', import.meta.url),
  'utf8',
);

test('S6 verifier resolves mixed-case relations in the current schema', () => {
  assert.doesNotMatch(verifier, /::regclass/);
  assert.match(verifier, /JOIN pg_catalog\.pg_class AS constrained_relation/);
  assert.match(verifier, /JOIN pg_catalog\.pg_namespace AS relation_namespace/);
  assert.match(verifier, /relation_namespace\.nspname = current_schema\(\)/);
  assert.match(verifier, /constrained_relation\.relname = ANY\(\$1::text\[\]\)/);
});

test('S6 verifier checks the named constraints for all three tables', () => {
  for (const contract of [
    "['ExtraWorkRequest', 'ExtraWorkRequest_invariants_check']",
    "['ReplanScenario', 'ReplanScenario_revision_check']",
    "['ExtraWorkSession', 'ExtraWorkSession_time_check']",
    "['ExtraWorkSession', 'ExtraWorkSession_accuracy_check']",
  ]) {
    assert.ok(verifier.includes(contract), `Missing S6 verifier contract ${contract}.`);
  }

  assert.match(verifier, /Missing table \$\{table\}/);
  assert.match(verifier, /S6 constraints are incomplete: \$\{missingConstraints\.join\(', '\)\}/);
});
