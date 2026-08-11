import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

const [config, helper, spec, packageSource] = await Promise.all([
  readFile(new URL('playwright.config.js', root), 'utf8'),
  readFile(new URL('e2e/s92-fixture.js', root), 'utf8'),
  readFile(new URL('e2e/s92-authenticated.spec.js', root), 'utf8'),
  readFile(new URL('package.json', root), 'utf8'),
]);

test('authenticated S9.2 is an isolated no-retry Playwright project', () => {
  assert.match(config, /name: 'authenticated-s92'/);
  assert.match(config, /dependencies: \['setup'\]/);
  assert.match(config, /testMatch: \/s92-authenticated\\\.spec\\\.js\//);
  assert.match(config, /retries: 0/);
  assert.match(config, /workers: 1/);
  assert.match(config, /screenshot: 'off'/);
  assert.match(config, /trace: 'off'/);
  assert.match(config, /video: 'off'/);
  assert.doesNotMatch(config, /authenticated-s92[\s\S]{0,300}auth\\\.spec/);
});

test('S9.2 descriptor and mutation helpers fail closed', () => {
  assert.match(helper, /S92_E2E_FIXTURE_FILE es obligatorio/);
  assert.match(helper, /schemaVersion debe ser 1/);
  assert.match(helper, /S92_E2E_DISPOSABLE=1/);
  assert.match(helper, /sólo admite http loopback en el puerto 3100/);
  assert.match(helper, /los seis actores deben tener identidades distintas/);
  assert.match(helper, /tenant A y tenant B deben ser distintos/);
  assert.match(helper, /setupClerkTestingToken\(\{ page \}\)/);
  assert.match(helper, /storageState: \{ cookies: \[\], origins: \[\] \}/);
  assert.match(helper, /export async function postJsonOnce/);
  assert.match(helper, /'Idempotency-Key': operationKey/);
  assert.match(helper, /const confirmation = await reconcile\(\)/);
  assert.doesNotMatch(helper, /while\s*\([^)]*AMBIGUOUS|for\s*\([^)]*AMBIGUOUS/);
});

test('S9.2 journey covers role, replay, stale correction, tenancy and read-only UI', () => {
  assert.doesNotMatch(`${helper}\n${spec}`, /Ã|Â|â/);
  for (const marker of [
    'sessions.director.page',
    'sessions.admin.page',
    "['siteManager', 'finance', 'auditor']",
    "state: 'STALE'",
    'sessions.siteManager.page',
    'lateV1Replay',
    'mutatedReplay',
    'sessions.outsider.page',
    'requireS92DisposableTarget(baseURL)',
    "anonymousRead.status).toBe(404)",
    "anonymousRead.headers['x-clerk-auth-status']).toBe('signed-out')",
    "anonymousRead.headers['x-clerk-auth-reason']).toBe('protect-rewrite')",
    "locator('#measurement-cut-period').fill(fixture.period.date)",
    'Lectura autorizada · sellado restringido',
  ]) {
    assert.ok(spec.includes(marker), `Missing S9.2 E2E marker: ${marker}`);
  }
  assert.match(spec, /idempotency-replayed'\]\)\.toBe\('true'\)/);
  assert.match(spec, /validCutV1Body/);
  assert.match(spec, /payload: \{ code: 'PERMISSION_REQUIRED' \}/);
  assert.match(spec, /status: 403/);
});

test('package exposes only the dedicated authenticated S9.2 project', () => {
  const parsed = JSON.parse(packageSource);
  assert.equal(
    parsed.scripts['test:e2e:authenticated:s92'],
    'playwright test --project=authenticated-s92',
  );
});
