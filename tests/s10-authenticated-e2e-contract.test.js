import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

const [config, spec, packageSource] = await Promise.all([
  readFile(new URL('playwright.config.js', root), 'utf8'),
  readFile(new URL('e2e/s10-authenticated.spec.js', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
]);

test('authenticated S10 is an isolated no-retry Playwright project', () => {
  assert.match(config, /name: 'authenticated-s10'/);
  assert.match(config, /authenticated-s10[\s\S]{0,100}dependencies: \['setup'\]/);
  assert.match(config, /authenticated-s10[\s\S]{0,180}retries: 0/);
  assert.match(config, /authenticated-s10[\s\S]{0,220}workers: 1/);
  assert.match(config, /testMatch: \/s10-authenticated\\\.spec\\\.js\//);
  const project = config.slice(config.indexOf("name: 'authenticated-s10'"));
  assert.match(project, /screenshot: 'off'/);
  assert.match(project, /trace: 'off'/);
  assert.match(project, /video: 'off'/);
});

test('S10 journey is disposable, actor-bound, idempotent and tenant-isolated', () => {
  for (const marker of [
    "environment.S10_E2E_DISPOSABLE !== '1'",
    'requireS92DisposableTarget(baseURL, environment)',
    'loadS92FixtureDescriptor()',
    "page: sessions.siteManager.page",
    "page: sessions.director.page",
    "page: sessions.finance.page",
    "page: sessions.auditor.page",
    "operationKind: 'PREPARE'",
    "operationKind: 'REJECT'",
    "operationKind: 'APPROVE'",
    "decision: 'REJECTED'",
    "decision: 'APPROVED'",
    "payload: { code: 'PROJECT_CERTIFICATE_FORBIDDEN' }",
    "payload: { code: 'PROJECT_CERTIFICATE_NOT_FOUND' }",
    "payload: { code: 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT' }",
    "headers['idempotency-replayed']",
    "Object.hasOwn(response.payload, 'replayed')",
    "Object.keys(response.payload.receipt).sort()",
    'actorMembershipId',
    'operationReceiptId',
    'bookRevisionAfter',
    'periodHeadRevisionAfter',
    'firstPrepareReplay',
    'firstPrepareMutation',
    'rejectionReplay',
    'rejectionMutation',
    'approvalReplay',
    'approvalMutation',
    "['admin', 'director', 'siteManager', 'finance', 'auditor']",
    'crossTenantSelection',
    "payload: { code: 'PROJECT_NOT_SELECTABLE' }",
  ]) {
    assert.ok(spec.includes(marker), `Missing S10 E2E marker: ${marker}`);
  }
  assert.match(spec, /expectedBookRevision: snapshot\.candidate\.expectedBookRevision/);
  assert.match(spec, /expectedPeriodHeadRevision: snapshot\.candidate\.expectedPeriodHeadRevision/);
  assert.match(spec, /expectedCurrentApprovedVersionId: snapshot\.candidate\.expectedCurrentApprovedVersionId/);
  assert.match(spec, /expectedCertificateDigest: snapshot\.pendingCertificate\.integrityDigest/);
  assert.match(spec, /Object\.values\(sessions\)\.map\(\(\{ context \}\) => context\.close\(\)\)/);
  assert.doesNotMatch(spec, /page\.waitForTimeout|await new Promise[\s\S]{0,40}setTimeout/);
  assert.doesNotMatch(spec, /password|secret|private[_-]?key|testing[_-]?token/i);
  assert.doesNotMatch(spec, /goto\('\/dashboard/);
});

test('package exposes the dedicated authenticated S10 project', () => {
  const parsed = JSON.parse(packageSource);
  assert.equal(
    parsed.scripts['test:e2e:authenticated:s10'],
    'playwright test --project=authenticated-s10',
  );
});
