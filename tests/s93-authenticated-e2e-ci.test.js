import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

function jobSource(name) {
  const marker = `  ${name}:`;
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, `Missing workflow job ${name}.`);
  const remainder = workflow.slice(start + marker.length);
  const nextJob = remainder.match(/\n  [A-Za-z0-9_-]+:\r?\n/);
  const end = nextJob ? start + marker.length + nextJob.index : workflow.length;
  return workflow.slice(start, end);
}

test('S9.3 authenticated E2E reuses only the trusted disposable S9 fixture', () => {
  const job = jobSource('authenticated-s92-e2e');
  assert.match(job, /name: S9\.2 \+ S9\.3 authenticated disposable journeys/);
  assert.match(job, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /environment: clerk-development-e2e/);
  assert.match(job, /POSTGRES_DB: obrasaas_e2e/);
  assert.match(job, /127\.0\.0\.1:5432\/obrasaas_e2e\?schema=public/);
  assert.match(job, /S92_E2E_DISPOSABLE: '1'/);
  assert.match(job, /S93_E2E_DISPOSABLE: '1'/);
  assert.match(job, /scripts\/seed-s92-e2e-db\.mjs --descriptor/);
  const s92Run = job.indexOf('npm run test:e2e:authenticated:s92');
  const s93Run = job.indexOf('npm run test:e2e:authenticated:s93');
  assert.ok(s92Run >= 0 && s93Run > s92Run, 'S9.3 must run after the established S9.2 journey.');
  assert.doesNotMatch(job, /pull_request_target/);
});

test('S9.3 CI step receives only development Clerk keys and publishes no browser artifacts', () => {
  const job = jobSource('authenticated-s92-e2e');
  const stepStart = job.indexOf('- name: Run authenticated S9.3 journey');
  assert.notEqual(stepStart, -1);
  const step = job.slice(stepStart);
  assert.match(step, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: \$\{\{ secrets\.CLERK_E2E_PUBLISHABLE_KEY \}\}/);
  assert.match(step, /CLERK_SECRET_KEY: \$\{\{ secrets\.CLERK_E2E_SECRET_KEY \}\}/);
  assert.match(step, /S92_E2E_FIXTURE_FILE: \$\{\{ runner\.temp \}\}\/s92-e2e-fixture\.json/);
  assert.match(step, /npm run test:e2e:authenticated:s93/);
  assert.doesNotMatch(step, /DEBUG:/);
  assert.doesNotMatch(step, /upload-artifact|playwright-report|test-results|trace|video/i);
  assert.doesNotMatch(job, /pk_test_[A-Za-z0-9]/);
  assert.doesNotMatch(job, /sk_test_[A-Za-z0-9]/);
});
