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

test('same-origin JSON transport preserves input and adds an API-shaped Accept by default', async () => {
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
      headers: {
        ...headers,
        Accept: 'application/json',
      },
      maxRedirects: 0,
      method: 'POST',
    },
    url: 'http://localhost:3100/api/progress-measurement-cuts?probe=1',
  }]);
  assert.equal(headers.Accept, undefined, 'default Accept must not mutate caller-owned headers');
  assert.equal(result.status, 409);
  assert.deepEqual(result.payload, { code: 'IDEMPOTENCY_CONFLICT' });
  assert.equal(result.headers['idempotency-replayed'], 'true');
  assert.equal(result.headers['set-cookie'], undefined);
  assert.deepEqual(result.diagnostic, {
    hasLocation: false,
    status: 409,
    textLength: 31,
    textPreview: '{"code":"IDEMPOTENCY_CONFLICT"}',
  });
});

test('same-origin JSON transport preserves an explicit Accept with case-insensitive detection', async () => {
  const calls = [];
  const page = {
    context: () => ({
      request: {
        fetch: async (url, options) => {
          calls.push({ options, url });
          return {
            headers: () => ({ 'content-type': 'application/json' }),
            status: () => 200,
            text: async () => '{}',
          };
        },
      },
    }),
    url: () => 'http://localhost:3100/',
  };

  await sameOriginJson(page, '/api/probe', {
    headers: { aCcEpT: 'application/vnd.obrasaas+json' },
  });

  assert.deepEqual(calls[0].options.headers, {
    aCcEpT: 'application/vnd.obrasaas+json',
  });
  assert.equal(
    Object.keys(calls[0].options.headers).filter((name) => name.toLowerCase() === 'accept').length,
    1,
  );
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
            Location: 'https://clerk.example.test/handshake?__clerk_db_jwt=hidden-location-token',
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
  assert.equal(result.diagnostic.hasLocation, true);
  assert.equal(result.diagnostic.status, 502);
  assert.equal(result.headers.location, undefined);
  assert.equal(result.headers['x-session-token'], undefined);
  assert.doesNotMatch(JSON.stringify(result), /hidden-location-token/);
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
    "authStatus: anonymousRead.headers['x-clerk-auth-status'] ?? null",
    "anonymousAuthReasons.includes('protect-rewrite')",
    'hasLocation: anonymousRead.diagnostic.hasLocation',
    "redirectTo: anonymousRead.headers['x-clerk-redirect-to'] ?? null",
    'status: anonymousRead.status',
    "locator('#measurement-cut-period')",
    'clerk.loaded({ page: sessions.auditor.page })',
    "key.startsWith('__reactProps$') && typeof input[key]?.onChange === 'function'",
    'fixturePeriodInput.inputValue() !== fixture.period.date',
    'expect(fixturePeriodInput).toHaveValue(fixture.period.date)',
    'Lectura autorizada · sellado restringido',
  ]) {
    assert.ok(spec.includes(marker), `Missing S9.2 E2E marker: ${marker}`);
  }
  assert.match(spec, /idempotency-replayed'\]\)\.toBe\('true'\)/);
  assert.match(spec, /validCutV1Body/);
  assert.match(spec, /payload: \{ code: 'PERMISSION_REQUIRED' \}/);
  assert.match(spec, /status: 403/);

  const auditorUiStart = spec.indexOf("sessions.auditor.page.goto('/dashboard/measurements?view=cut')");
  const journeyCleanup = spec.indexOf('} finally {', auditorUiStart);
  const auditorUi = spec.slice(auditorUiStart, journeyCleanup);
  assert.ok(auditorUiStart >= 0 && journeyCleanup > auditorUiStart);
  assert.equal(
    auditorUi.match(/waitForResponse/g)?.length,
    1,
    'only the post-hydration period change may wait for a cut response',
  );
  const clerkReady = auditorUi.indexOf('clerk.loaded({ page: sessions.auditor.page })');
  const periodControlHydrated = auditorUi.indexOf("key.startsWith('__reactProps$')");
  const periodMismatch = auditorUi.indexOf('fixturePeriodInput.inputValue() !== fixture.period.date');
  const fixtureResponse = auditorUi.indexOf('waitForResponse', periodMismatch);
  const periodFill = auditorUi.indexOf('fixturePeriodInput.fill(fixture.period.date)', fixtureResponse);
  const responseAwait = auditorUi.indexOf('await fixtureCutResponse', periodFill);
  const periodSettled = auditorUi.indexOf('toHaveValue(fixture.period.date)', responseAwait);
  assert.ok(
    clerkReady >= 0
      && clerkReady < periodControlHydrated
      && periodControlHydrated < periodMismatch
      && periodMismatch < fixtureResponse
      && fixtureResponse < periodFill
      && periodFill < responseAwait
      && responseAwait < periodSettled,
    'Clerk hydration must settle before reading the input, and the exact response wait must exist before a period-changing fill',
  );
  assert.match(auditorUi, /request\(\)\.method\(\) === 'GET'/);
  assert.match(auditorUi, /url\.pathname === '\/api\/progress-measurement-cuts'/);
  assert.match(auditorUi, /url\.searchParams\.get\('periodDate'\) === fixture\.period\.date/);
  assert.match(auditorUi, /response\.status\(\) === 200/);
  assert.ok(
    periodSettled
      < auditorUi.indexOf("getByText('Corte vigente'"),
    'the fixture period must be settled before asserting version 2 UI state',
  );
});

test('anonymous JSON boundary establishes an explicit Clerk signed-out client before API access', () => {
  const anonymousStart = spec.indexOf('const anonymousContext = await browser.newContext');
  const actorStart = spec.indexOf('for (const [key, actor]');
  const anonymousBlock = spec.slice(anonymousStart, actorStart);

  assert.ok(anonymousStart >= 0 && actorStart > anonymousStart);
  assert.match(anonymousBlock, /storageState: \{ cookies: \[\], origins: \[\] \}/);
  assert.match(anonymousBlock, /setupClerkTestingToken\(\{ context: anonymousContext \}\)/);
  assert.match(anonymousBlock, /anonymousPage\.goto\('\/sign-in'\)/);
  assert.match(anonymousBlock, /clerk\.loaded\(\{ page: anonymousPage \}\)/);
  assert.match(anonymousBlock, /window\.Clerk\.session === null/);
  assert.match(anonymousBlock, /window\.Clerk\.user === null/);
  assert.ok(
    anonymousBlock.indexOf('setupClerkTestingToken') < anonymousBlock.indexOf("goto('/sign-in')"),
    'testing token interception must exist before the first Clerk navigation',
  );
  assert.ok(
    anonymousBlock.indexOf('window.Clerk.session === null') < anonymousBlock.indexOf('readCut('),
    'the anonymous Clerk client must be settled signed-out before protected API access',
  );
  assert.match(anonymousBlock, /\.split\(','\)/);
  assert.match(anonymousBlock, /anonymousAuthReasons\.includes\('protect-rewrite'\)/);
  assert.match(anonymousBlock, /authStatus: 'signed-out'/);
  assert.match(anonymousBlock, /hasLocation: false/);
  assert.match(anonymousBlock, /location: null/);
  assert.match(anonymousBlock, /redirectTo: null/);
  assert.match(anonymousBlock, /status: 404/);
  assert.doesNotMatch(anonymousBlock, /status:\s*307|\[404,\s*307\]/);
});

test('package exposes only the dedicated authenticated S9.2 project', () => {
  const parsed = JSON.parse(packageSource);
  assert.equal(
    parsed.scripts['test:e2e:authenticated:s92'],
    'playwright test --project=authenticated-s92',
  );
});
