import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { sameOriginJson } from '../e2e/s92-fixture.js';

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
  assert.match(helper, /page\.context\(\)\?\.request/);
  assert.match(helper, /failOnStatusCode: false/);
  assert.match(helper, /maxRedirects: 0/);
  const transport = helper.slice(
    helper.indexOf('function sameOriginTarget'),
    helper.indexOf('export async function openS92ActorSession'),
  );
  assert.doesNotMatch(transport, /page\.evaluate|credentials:\s*'same-origin'/);
  assert.doesNotMatch(helper, /while\s*\([^)]*AMBIGUOUS|for\s*\([^)]*AMBIGUOUS/);
});

test('same-origin transport shares the BrowserContext request and preserves serialized input', async () => {
  const calls = [];
  const response = {
    headers: () => ({
      'content-type': 'application/json',
      'idempotency-replayed': 'true',
      'set-cookie': '__session=must-not-leak',
    }),
    status: () => 409,
    text: async () => '{"code":"IDEMPOTENCY_CONFLICT"}',
  };
  const page = {
    context: () => ({
      request: {
        fetch: async (url, options) => {
          calls.push({ options, url });
          return response;
        },
      },
    }),
    url: () => 'http://localhost:3100/dashboard/progress',
  };
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'fixture:cut-v1',
  };
  const body = '{"periodDate":"2020-01-01","exact":"body"}';

  const result = await sameOriginJson(page, '/api/progress-measurement-cuts?probe=1', {
    body,
    headers,
    method: 'POST',
  });

  assert.deepEqual(calls, [{
    options: {
      data: body,
      failOnStatusCode: false,
      headers,
      maxRedirects: 0,
      method: 'POST',
    },
    url: 'http://localhost:3100/api/progress-measurement-cuts?probe=1',
  }]);
  assert.equal(result.status, 409);
  assert.deepEqual(result.payload, { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(result.headers['idempotency-replayed'], 'true');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.deepEqual(result.diagnostic, {
    status: 409,
    textLength: 31,
    textPreview: '{"code":"IDEMPOTENCY_CONFLICT"}',
  });
});

test('same-origin transport rejects cross-origin URLs before sharing cookies', async () => {
  let requests = 0;
  const page = {
    context: () => ({
      request: {
        fetch: async () => {
          requests += 1;
          throw new Error('must not run');
        },
      },
    }),
    url: () => 'http://localhost:3100/',
  };

  await assert.rejects(
    sameOriginJson(page, 'https://example.com/api/cuts'),
    /ruta relativa al mismo origen/,
  );
  await assert.rejects(
    sameOriginJson(page, '//example.com/api/cuts'),
    /ruta relativa al mismo origen/,
  );
  assert.equal(requests, 0);
});

test('same-origin response diagnostics redact credentials and sensitive headers', async () => {
  const secretText = [
    'authorization: Bearer hidden-bearer-token',
    'set-cookie: __session=hidden-session-cookie',
    'postgresql://operator:hidden-password@db.example.test/app',
    'sk_test_hiddenclerksecret',
    '{"password":"hidden-json-password"}',
  ].join('\n');
  const page = {
    context: () => ({
      request: {
        fetch: async () => ({
          headers: () => ({
            'content-type': 'text/plain',
            'x-session-token': 'hidden-response-token',
          }),
          status: () => 502,
          text: async () => secretText,
        }),
      },
    }),
    url: () => 'http://127.0.0.1:3100/',
  };

  const result = await sameOriginJson(page, '/api/probe');
  const serialized = JSON.stringify(result.diagnostic);
  for (const secret of [
    'hidden-bearer-token',
    'hidden-session-cookie',
    'hidden-password',
    'hiddenclerksecret',
    'hidden-json-password',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
  assert.match(result.diagnostic.textPreview, /REDACTED/);
  assert.equal(result.diagnostic.status, 502);
  assert.equal(result.headers['x-session-token'], undefined);
});

test('same-origin transport errors never echo Playwright request logs', async () => {
  const page = {
    context: () => ({
      request: {
        fetch: async () => {
          throw new Error('cookie: __session=hidden-cookie; authorization: Bearer hidden-token');
        },
      },
    }),
    url: () => 'http://localhost:3100/',
  };

  await assert.rejects(
    sameOriginJson(page, '/api/probe'),
    (error) => {
      assert.match(error.message, /antes de recibir status \(GET \/api\/probe; Error\)/);
      assert.doesNotMatch(error.message, /hidden-cookie|hidden-token|authorization|cookie/i);
      return true;
    },
  );
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
