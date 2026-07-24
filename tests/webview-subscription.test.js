import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalWebviewSecret = process.env.WEBVIEW_TOKEN_SECRET;
const originalPrivateMediaProvider = process.env.PRIVATE_MEDIA_PROVIDER;
const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';
process.env.WEBVIEW_TOKEN_SECRET = 'webview-subscription-test-secret';
process.env.PRIVATE_MEDIA_PROVIDER = 'vercel-blob';
process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test_only';

const [
  { ATTENDANCE_ACTIONS, generateWebviewToken },
  {
    ATTENDANCE_LOCATION_CAPTURE_MAX_AGE_MS,
    POST: postAttendance,
    assertFreshAttendanceLocationCapture,
  },
  { POST: postMedical },
] = await Promise.all([
  import('../src/lib/auth.js'),
  import('../src/app/api/webviews/attendance/route.js'),
  import('../src/app/api/webviews/medical/route.js'),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalWebviewSecret === undefined) delete process.env.WEBVIEW_TOKEN_SECRET;
  else process.env.WEBVIEW_TOKEN_SECRET = originalWebviewSecret;
  if (originalPrivateMediaProvider === undefined) delete process.env.PRIVATE_MEDIA_PROVIDER;
  else process.env.PRIVATE_MEDIA_PROVIDER = originalPrivateMediaProvider;
  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  delete globalThis.__obraSaasPrisma;
});

const workerId = 'worker-subscription-a';
const projectId = 'project-subscription-a';

function organization(subscriptionStatus, trialEndsAt = null) {
  return {
    subscriptionPlan: subscriptionStatus === 'TRIALING' ? 'TRIAL' : 'PRO',
    subscriptionStatus,
    trialEndsAt,
  };
}

function installPrisma(currentOrganization, {
  freshOrganization = currentOrganization,
} = {}) {
  const calls = [];
  globalThis.__obraSaasPrisma = {
    worker: {
      async findFirst(query) {
        calls.push(['worker', query]);
        return {
          id: workerId,
          projectId,
          phone: '+5491112345678',
          name: 'Persona autorizada',
          active: true,
          project: {
            organizationId: 'organization-subscription-a',
            organization: currentOrganization,
          },
        };
      },
    },
    organization: {
      async findUnique(query) {
        calls.push(['organization', query]);
        return freshOrganization;
      },
    },
    auditLog: {
      async findUnique(query) {
        calls.push(['audit', query]);
        return null;
      },
    },
  };
  return calls;
}

function attendanceRequest(currentOrganization) {
  installPrisma(currentOrganization);
  const token = generateWebviewToken(workerId, {
    purpose: 'attendance',
    scope: projectId,
    pendingEntryId: 'pending-subscription-a',
  });
  return new Request('http://localhost/api/webviews/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      worker: workerId,
      token,
      latitude: 'invalid-before-location-validation',
      longitude: -58.4,
      accuracy: 10,
      capturedAt: new Date().toISOString(),
    }),
  });
}

function medicalRequest(currentOrganization) {
  installPrisma(currentOrganization);
  const token = generateWebviewToken(workerId, {
    purpose: 'medical',
    scope: projectId,
  });
  const form = new FormData();
  form.set('worker', workerId);
  form.set('token', token);
  form.set('days', '0');
  return new Request('http://localhost/api/webviews/medical', {
    method: 'POST',
    body: form,
  });
}

function validMedicalRequest(currentOrganization, freshOrganization) {
  const calls = installPrisma(currentOrganization, { freshOrganization });
  const token = generateWebviewToken(workerId, {
    purpose: 'medical',
    scope: projectId,
  });
  const form = new FormData();
  form.set('worker', workerId);
  form.set('token', token);
  form.set('days', '2');
  form.set(
    'certificate',
    new File([Buffer.from('%PDF-1.7\n')], 'certificado.pdf', {
      type: 'application/pdf',
    }),
  );
  return {
    calls,
    request: new Request('http://localhost/api/webviews/medical', {
      method: 'POST',
      body: form,
    }),
  };
}

test('attendance and medical webviews block every read-only subscription before field validation', async () => {
  const blocked = [
    organization('TRIALING', new Date('2000-01-01T00:00:00.000Z')),
    organization('PAST_DUE'),
    organization('CANCELED'),
    organization('SUSPENDED'),
  ];

  for (const currentOrganization of blocked) {
    const attendanceResponse = await postAttendance(attendanceRequest(currentOrganization));
    assert.equal(attendanceResponse.status, 402);
    assert.deepEqual(await attendanceResponse.json(), {
      error: 'La organización está en modo lectura. El plan debe activarse para realizar cambios.',
      code: 'SUBSCRIPTION_READ_ONLY',
    });

    const medicalResponse = await postMedical(medicalRequest(currentOrganization));
    assert.equal(medicalResponse.status, 402);
    assert.deepEqual(await medicalResponse.json(), {
      error: 'La organización está en modo lectura. El plan debe activarse para realizar cambios.',
      code: 'SUBSCRIPTION_READ_ONLY',
    });
  }
});

test('ACTIVE and current trials pass subscription checks and reach normal webview validation', async () => {
  const allowed = [
    organization('ACTIVE'),
    organization('TRIALING', new Date('2099-01-01T00:00:00.000Z')),
  ];

  for (const currentOrganization of allowed) {
    const attendanceResponse = await postAttendance(attendanceRequest(currentOrganization));
    assert.equal(attendanceResponse.status, 400);
    assert.match((await attendanceResponse.json()).error, /ubicación recibida no es válida/i);

    const medicalResponse = await postMedical(medicalRequest(currentOrganization));
    assert.equal(medicalResponse.status, 400);
    assert.match((await medicalResponse.json()).error, /licencia debe tener entre 1 y 30 días/i);
  }
});

test('medical upload revalidates the current subscription immediately before storage', async () => {
  const active = organization('ACTIVE');
  const { calls, request } = validMedicalRequest(active, organization('PAST_DUE'));
  const response = await postMedical(request);

  assert.equal(response.status, 402);
  assert.deepEqual(await response.json(), {
    error: 'La organización está en modo lectura. El plan debe activarse para realizar cambios.',
    code: 'SUBSCRIPTION_READ_ONLY',
  });
  assert.equal(calls.filter(([name]) => name === 'organization').length, 1);
});

test('attendance webview rejects action tampering before any durable operation', async () => {
  installPrisma(organization('ACTIVE'));
  const token = generateWebviewToken(workerId, {
    purpose: 'attendance',
    scope: projectId,
    action: ATTENDANCE_ACTIONS.CHECK_OUT,
    shiftId: 'shift-subscription-a',
    shiftRevision: 0,
  });
  const response = await postAttendance(new Request('http://localhost/api/webviews/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      worker: workerId,
      token,
      action: ATTENDANCE_ACTIONS.CHECK_IN,
      idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
      location: {
        latitude: -34.6,
        longitude: -58.4,
        accuracy: 10,
        capturedAt: new Date().toISOString(),
      },
      locationNoticeAcknowledged: true,
      locationNoticeVersion: '2026-07-23',
    }),
  }));

  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, 'LINK_EXPIRED');
});

test('attendance webview requires the exact point-location notice and a bounded idempotency key', async () => {
  const token = generateWebviewToken(workerId, {
    purpose: 'attendance',
    scope: projectId,
    pendingEntryId: 'pending-subscription-a',
  });
  const request = (overrides) => {
    installPrisma(organization('ACTIVE'));
    return new Request('http://localhost/api/webviews/attendance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        worker: workerId,
        token,
        action: ATTENDANCE_ACTIONS.CHECK_IN,
        idempotencyKey: '123e4567-e89b-42d3-a456-426614174000',
        location: {
          latitude: -34.6,
          longitude: -58.4,
          accuracy: 10,
          capturedAt: new Date().toISOString(),
        },
        locationNoticeAcknowledged: true,
        locationNoticeVersion: '2026-07-23',
        ...overrides,
      }),
    });
  };

  const missingNotice = await postAttendance(request({ locationNoticeAcknowledged: false }));
  assert.equal(missingNotice.status, 400);
  assert.equal((await missingNotice.json()).code, 'LOCATION_NOTICE_REQUIRED');

  const invalidKey = await postAttendance(request({ idempotencyKey: 'short' }));
  assert.equal(invalidKey.status, 400);
  assert.equal((await invalidKey.json()).code, 'IDEMPOTENCY_KEY_INVALID');
});

test('attendance location freshness accepts a current capture and rejects stale or future evidence', () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const issuedAt = Math.floor(new Date('2026-07-23T11:57:00.000Z').getTime() / 1_000);
  assert.doesNotThrow(() => assertFreshAttendanceLocationCapture({
    capturedAt: new Date(now.getTime() - ATTENDANCE_LOCATION_CAPTURE_MAX_AGE_MS).toISOString(),
    issuedAt,
    now,
  }));
  assert.throws(
    () => assertFreshAttendanceLocationCapture({
      capturedAt: new Date(now.getTime() - ATTENDANCE_LOCATION_CAPTURE_MAX_AGE_MS - 1).toISOString(),
      issuedAt,
      now,
    }),
    (error) => error.code === 'LOCATION_CAPTURE_EXPIRED' && error.status === 422,
  );
  assert.throws(
    () => assertFreshAttendanceLocationCapture({
      capturedAt: new Date(now.getTime() + 30_001).toISOString(),
      issuedAt,
      now,
    }),
    (error) => error.code === 'LOCATION_CAPTURE_EXPIRED',
  );
  assert.throws(
    () => assertFreshAttendanceLocationCapture({
      capturedAt: new Date((issuedAt * 1_000) - 30_001).toISOString(),
      issuedAt,
      now,
    }),
    (error) => error.code === 'LOCATION_CAPTURE_EXPIRED',
  );
});
