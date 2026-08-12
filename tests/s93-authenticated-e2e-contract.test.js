import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

const [config, spec, packageSource] = await Promise.all([
  readFile(new URL('playwright.config.js', root), 'utf8'),
  readFile(new URL('e2e/s93-authenticated.spec.js', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
]);

test('authenticated S9.3 is an isolated no-retry Playwright project', () => {
  assert.match(config, /name: 'authenticated-s93'/);
  assert.match(config, /authenticated-s93[\s\S]{0,100}dependencies: \['setup'\]/);
  assert.match(config, /authenticated-s93[\s\S]{0,180}retries: 0/);
  assert.match(config, /authenticated-s93[\s\S]{0,220}workers: 1/);
  assert.match(config, /testMatch: \/s93-authenticated\\\.spec\\\.js\//);
  const project = config.slice(config.indexOf("name: 'authenticated-s93'"));
  assert.match(project, /screenshot: 'off'/);
  assert.match(project, /trace: 'off'/);
  assert.match(project, /video: 'off'/);
  assert.doesNotMatch(project.slice(0, project.indexOf('],')), /s92-authenticated/);
});

test('S9.3 journey is disposable, full-scope and fail-closed', () => {
  for (const marker of [
    "environment.S93_E2E_DISPOSABLE !== '1'",
    'requireS92DisposableTarget(baseURL, environment)',
    'loadS92FixtureDescriptor()',
    "sessions.siteManager.page",
    "payload: { code: 'PERMISSION_REQUIRED' }",
    'fixture.primary.actors.admin.membershipId',
    'fixture.primary.actors.director.membershipId',
    'fixture.primary.actors.finance.membershipId',
    "readiness: 'AUTHORITY_REVIEW_PENDING'",
    "readiness: 'CONTRACT_REVIEW_PENDING'",
    "state: 'VALUED'",
    "state: 'NO_CLAIM'",
    "roundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1'",
    "adjustmentPolicyVersion: 'NONE'",
    "payload: { code: 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT' }",
    "headers['idempotency-replayed']",
    'lateAuthorityReplay',
    'lateContractReplay',
    'crossTenantSelection',
    "payload: { code: 'PROJECT_NOT_SELECTABLE' }",
    "goto('/dashboard/contracts')",
    "getByRole('region', { name: 'Contrato vigente' })",
  ]) {
    assert.ok(spec.includes(marker), `Missing S9.3 E2E marker: ${marker}`);
  }
  assert.match(spec, /expectedCurrentAuthorityVersionId: snapshot\.currentAuthority\?\.id \|\| null/);
  assert.match(spec, /expectedCurrentVersionId: snapshot\.currentContract\?\.id \|\| null/);
  assert.match(spec, /expect\(\[\.\.\.tasks\.keys\(\)\]\.sort\(\)\)\.toEqual/);
  assert.match(spec, /Object\.values\(sessions\)\.map\(\(\{ context \}\) => context\.close\(\)\)/);
  assert.doesNotMatch(spec, /page\.waitForTimeout|await new Promise[\s\S]{0,40}setTimeout/);
  assert.doesNotMatch(spec, /password|secret|private[_-]?key|testing[_-]?token/i);
});

test('package exposes the dedicated authenticated S9.3 project', () => {
  const parsed = JSON.parse(packageSource);
  assert.equal(
    parsed.scripts['test:e2e:authenticated:s93'],
    'playwright test --project=authenticated-s93',
  );
});
