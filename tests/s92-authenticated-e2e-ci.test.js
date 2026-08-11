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

test('S9.2 authenticated E2E is a trusted-branch disposable PostgreSQL gate', () => {
  const job = jobSource('authenticated-s92-e2e');

  assert.match(job, /github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'/);
  assert.match(job, /github\.ref == 'refs\/heads\/master'/);
  assert.match(job, /github\.ref == 'refs\/heads\/codex\/platform-ux-foundation'/);
  assert.doesNotMatch(job, /pull_request_target/);
  assert.match(job, /environment: clerk-development-e2e/);
  assert.match(job, /POSTGRES_DB: obrasaas_e2e/);
  assert.match(job, /127\.0\.0\.1:5432\/obrasaas_e2e\?schema=public/);
  assert.match(job, /S92_E2E_DISPOSABLE: '1'/);
  assert.match(job, /scripts\/provision-s92-e2e-clerk-fixtures\.mjs --verify/);
  assert.match(job, /scripts\/seed-s92-e2e-db\.mjs --descriptor/);
  assert.match(job, /npm run test:e2e:authenticated:s92/);
});

test('authenticated diagnostics and secret values are not published by CI', () => {
  const job = jobSource('authenticated-s92-e2e');
  const preSteps = job.slice(0, job.indexOf('\n    steps:'));

  assert.match(job, /secrets\.CLERK_E2E_PUBLISHABLE_KEY/);
  assert.match(job, /secrets\.CLERK_E2E_SECRET_KEY/);
  assert.doesNotMatch(preSteps, /CLERK_E2E_(?:PUBLISHABLE|SECRET)_KEY/);
  assert.doesNotMatch(
    job.slice(job.indexOf('- name: Install exact dependencies'), job.indexOf('- name: Require Clerk development credentials')),
    /CLERK_E2E_(?:PUBLISHABLE|SECRET)_KEY/,
  );
  assert.doesNotMatch(
    job.slice(job.indexOf('- name: Deploy all migrations'), job.indexOf('- name: Verify deterministic Clerk actors')),
    /CLERK_E2E_(?:PUBLISHABLE|SECRET)_KEY/,
  );
  assert.doesNotMatch(
    job.slice(job.indexOf('- name: Install Playwright Chromium'), job.indexOf('- name: Run authenticated S9.2 journey')),
    /CLERK_E2E_(?:PUBLISHABLE|SECRET)_KEY/,
  );
  assert.doesNotMatch(job, /pk_test_[A-Za-z0-9]/);
  assert.doesNotMatch(job, /sk_test_[A-Za-z0-9]/);
  assert.doesNotMatch(job, /upload-artifact/);
  assert.doesNotMatch(job, /playwright-report|test-results|trace|video/i);
});
