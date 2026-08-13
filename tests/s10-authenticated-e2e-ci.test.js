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

test('S10 authenticated E2E follows S9.3 on the same trusted disposable database', () => {
  const job = jobSource('authenticated-s92-e2e');
  assert.match(job, /name: S9\.2 \+ S9\.3 \+ S10-CERT authenticated disposable journeys/);
  assert.match(job, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /environment: clerk-development-e2e/);
  assert.match(job, /postgres:17-alpine@sha256:/);
  assert.match(job, /POSTGRES_DB: obrasaas_e2e/);
  assert.match(job, /127\.0\.0\.1:5432\/obrasaas_e2e\?schema=public/);
  assert.match(job, /S92_E2E_DISPOSABLE: '1'/);
  assert.match(job, /S93_E2E_DISPOSABLE: '1'/);
  assert.match(job, /S10_E2E_DISPOSABLE: '1'/);
  assert.match(job, /scripts\/seed-s92-e2e-db\.mjs --descriptor/);
  const s92Run = job.indexOf('npm run test:e2e:authenticated:s92');
  const s93Run = job.indexOf('npm run test:e2e:authenticated:s93');
  const s10Run = job.indexOf('npm run test:e2e:authenticated:s10');
  assert.ok(
    s92Run >= 0 && s93Run > s92Run && s10Run > s93Run,
    'S10 must run after S9.3 on the established S9 disposable fixture.',
  );
  assert.doesNotMatch(job, /pull_request_target/);
});

test('S10 CI step receives only Clerk Development keys and publishes no browser artifacts', () => {
  const job = jobSource('authenticated-s92-e2e');
  const stepStart = job.indexOf('- name: Run authenticated S10-CERT journey');
  assert.notEqual(stepStart, -1);
  const step = job.slice(stepStart);
  assert.match(step, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: \$\{\{ secrets\.CLERK_E2E_PUBLISHABLE_KEY \}\}/);
  assert.match(step, /CLERK_SECRET_KEY: \$\{\{ secrets\.CLERK_E2E_SECRET_KEY \}\}/);
  assert.match(step, /S92_E2E_FIXTURE_FILE: \$\{\{ runner\.temp \}\}\/s92-e2e-fixture\.json/);
  assert.match(step, /npm run test:e2e:authenticated:s10/);
  assert.doesNotMatch(step, /DEBUG:/);
  assert.doesNotMatch(step, /upload-artifact|playwright-report|test-results|trace|video/i);
  assert.doesNotMatch(job, /pk_test_[A-Za-z0-9]/);
  assert.doesNotMatch(job, /sk_test_[A-Za-z0-9]/);
});
