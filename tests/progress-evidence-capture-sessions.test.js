import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { generateWebviewToken } from '../src/lib/auth.js';
import {
  assertProgressEvidenceCaptureTokenSignature,
  buildProgressEvidenceLocationLink,
  cancelProgressEvidenceLocation,
  captureProgressEvidenceLocation,
  getProgressEvidenceCaptureContext,
  issueProgressEvidenceCaptureSession,
  PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS,
  PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
  PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
  PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
  ProgressEvidenceCaptureSessionError,
} from '../src/lib/progress-evidence-capture-sessions.js';

const NOW = new Date('2026-07-29T15:00:00.000Z');
const WEBVIEW_SECRET = 'progress-evidence-test-webview-secret';
const SESSION_ID = 'capture-session-0001';

function clone(value) {
  return structuredClone(value);
}

function comparable(value) {
  return value instanceof Date ? value.getTime() : value;
}

function matchesWhere(row, where = {}) {
  if (Array.isArray(where.OR) && !where.OR.some((candidate) => matchesWhere(row, candidate))) {
    return false;
  }
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'OR') return true;
    const actual = row[field];
    if (
      expected
      && typeof expected === 'object'
      && !Array.isArray(expected)
      && !(expected instanceof Date)
    ) {
      if (Object.hasOwn(expected, 'in')) return expected.in.includes(actual);
      if (Object.hasOwn(expected, 'gt') && !(comparable(actual) > comparable(expected.gt))) {
        return false;
      }
      if (Object.hasOwn(expected, 'gte') && !(comparable(actual) >= comparable(expected.gte))) {
        return false;
      }
      if (Object.hasOwn(expected, 'lt') && !(comparable(actual) < comparable(expected.lt))) {
        return false;
      }
      if (Object.hasOwn(expected, 'lte') && !(comparable(actual) <= comparable(expected.lte))) {
        return false;
      }
      return true;
    }
    return comparable(actual) === comparable(expected);
  });
}

function applyData(row, data) {
  for (const [field, value] of Object.entries(data)) {
    if (
      value
      && typeof value === 'object'
      && !(value instanceof Date)
      && Object.hasOwn(value, 'increment')
    ) {
      row[field] = Number(row[field] || 0) + Number(value.increment);
    } else {
      row[field] = clone(value);
    }
  }
  row.updatedAt = new Date(NOW);
}

function fakePrisma({
  organization = {},
  project = {},
  worker = {},
  connection = {},
  mediaAsset = {},
  forceCaptureCasMiss = false,
  forceCancelCasMiss = false,
} = {}) {
  let store = {
    organizations: [{
      id: 'org-1',
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
      ...organization,
    }],
    projects: [{
      id: 'project-1',
      organizationId: 'org-1',
      name: 'Torre Norte',
      status: 'ACTIVE',
      latitude: -32.8895,
      longitude: -68.8458,
      geofenceMeters: 100,
      ...project,
    }],
    workers: [{
      id: 'worker-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      name: 'Carlos Albañil',
      active: true,
      ...worker,
    }],
    connections: [{
      id: 'connection-1',
      projectId: 'project-1',
      enabled: true,
      connectionStatus: 'CONNECTED',
      ...connection,
    }],
    mediaAssets: [{
      id: 'asset-1',
      organizationId: 'org-1',
      projectId: 'project-1',
      mediaKind: 'IMAGE',
      status: 'AVAILABLE',
      ...mediaAsset,
    }],
    sessions: [],
    audits: [],
  };
  const metrics = {
    commits: 0,
    rollbacks: 0,
    transactionCalls: 0,
    sessionFindWheres: [],
  };

  function clientFor(readStore, { root = false } = {}) {
    const client = {
      organization: {
        async findUnique({ where }) {
          const row = readStore().organizations.find((item) => matchesWhere(item, where));
          return row ? clone(row) : null;
        },
      },
      project: {
        async findFirst({ where }) {
          const row = readStore().projects.find((item) => matchesWhere(item, where));
          return row ? clone(row) : null;
        },
      },
      worker: {
        async findFirst({ where }) {
          const row = readStore().workers.find((item) => matchesWhere(item, where));
          return row ? clone(row) : null;
        },
      },
      whatsAppConnection: {
        async findFirst({ where }) {
          const row = readStore().connections.find((item) => matchesWhere(item, where));
          return row ? clone(row) : null;
        },
      },
      whatsAppMediaAsset: {
        async findFirst({ where }) {
          const row = readStore().mediaAssets.find((item) => matchesWhere(item, where));
          return row ? clone(row) : null;
        },
      },
      progressEvidenceCaptureSession: {
        async findFirst({ where }) {
          metrics.sessionFindWheres.push(clone(where));
          const row = readStore().sessions.find((item) => matchesWhere(item, where));
          return row ? clone(row) : null;
        },
        async create({ data }) {
          if (readStore().sessions.some((item) => (
            item.projectId === data.projectId && item.mediaAssetId === data.mediaAssetId
          ))) {
            const error = new Error('unique constraint');
            error.code = 'P2002';
            throw error;
          }
          const row = {
            ...clone(data),
            createdAt: new Date(NOW),
            updatedAt: new Date(NOW),
          };
          readStore().sessions.push(row);
          return clone(row);
        },
        async updateMany({ where, data }) {
          const captureUpdate = data.locationSource === 'WEBVIEW_GEOLOCATION';
          if (captureUpdate && forceCaptureCasMiss) return { count: 0 };
          if (data.status === 'CANCELLED' && forceCancelCasMiss) return { count: 0 };
          let count = 0;
          for (const row of readStore().sessions) {
            if (!matchesWhere(row, where)) continue;
            applyData(row, data);
            count += 1;
          }
          return { count };
        },
      },
      auditLog: {
        async create({ data }) {
          const row = { id: `audit-${readStore().audits.length + 1}`, ...clone(data) };
          readStore().audits.push(row);
          return clone(row);
        },
      },
    };

    if (root) {
      client.$transaction = async (operation) => {
        metrics.transactionCalls += 1;
        const draft = clone(store);
        const transactionClient = clientFor(() => draft);
        try {
          const result = await operation(transactionClient);
          store = draft;
          metrics.commits += 1;
          return result;
        } catch (error) {
          metrics.rollbacks += 1;
          throw error;
        }
      };
    }
    return client;
  }

  const prisma = clientFor(() => store, { root: true });
  Object.defineProperties(prisma, {
    state: { get: () => store },
    metrics: { get: () => metrics },
    transactionClient: {
      value: () => clientFor(() => store),
    },
  });
  return prisma;
}

function deps(overrides = {}) {
  return {
    now: NOW,
    webviewSecret: WEBVIEW_SECRET,
    idFactory: () => SESSION_ID,
    ...overrides,
  };
}

function issueInput(overrides = {}) {
  return {
    scope: { organizationId: 'org-1', projectId: 'project-1' },
    workerId: 'worker-1',
    mediaAssetId: 'asset-1',
    connectionId: 'connection-1',
    ...overrides,
  };
}

async function issuedFixture(options = {}, dependencyOverrides = {}) {
  const prisma = fakePrisma(options);
  const issued = await issueProgressEvidenceCaptureSession(
    prisma,
    issueInput(),
    deps(dependencyOverrides),
  );
  return { prisma, issued };
}

function captureInput(issued, overrides = {}) {
  return {
    workerId: 'worker-1',
    sessionId: issued.session.id,
    token: issued.token,
    idempotencyKey: 'capture-operation-0001',
    privacyAccepted: true,
    noticeVersion: PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
    noticeContentSha256: PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
    latitude: -32.8895,
    longitude: -68.8458,
    accuracyMeters: 10,
    capturedAt: NOW.toISOString(),
    ...overrides,
  };
}

function cancelInput(issued, overrides = {}) {
  return {
    workerId: 'worker-1',
    sessionId: issued.session.id,
    token: issued.token,
    ...overrides,
  };
}

function rejectsCode(code, status) {
  return (error) => {
    assert.ok(error instanceof ProgressEvidenceCaptureSessionError);
    assert.equal(error.code, code);
    if (status !== undefined) assert.equal(error.status, status);
    return true;
  };
}

test('issue is idempotent by media asset and never persists the raw token', async () => {
  const prisma = fakePrisma();
  let sequence = 0;
  const dependencyOverrides = deps({ idFactory: () => `capture-session-000${++sequence}` });

  const first = await issueProgressEvidenceCaptureSession(
    prisma,
    issueInput(),
    dependencyOverrides,
  );
  const replay = await issueProgressEvidenceCaptureSession(
    prisma,
    issueInput(),
    dependencyOverrides,
  );

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.session.id, first.session.id);
  assert.equal(replay.token, first.token);
  assert.equal(prisma.state.sessions.length, 1);
  assert.equal(
    prisma.state.sessions[0].tokenHash,
    crypto.createHash('sha256').update(first.token).digest('hex'),
  );
  assert.equal(JSON.stringify(prisma.state.sessions).includes(first.token), false);
  assert.equal(first.session.worker.name, 'Carlos Albañil');
  assert.equal(first.session.project.name, 'Torre Norte');
  assert.deepEqual(prisma.metrics.sessionFindWheres.slice(0, 2), [
    { organizationId: 'org-1', projectId: 'project-1', mediaAssetId: 'asset-1' },
    { organizationId: 'org-1', projectId: 'project-1', mediaAssetId: 'asset-1' },
  ]);
});

test('issue accepts the project-scoped legacy worker bridge while new rows backfill organization scope', async () => {
  const prisma = fakePrisma({ worker: { organizationId: null } });

  const result = await issueProgressEvidenceCaptureSession(prisma, issueInput(), deps());

  assert.equal(result.session.workerId, 'worker-1');
  assert.equal(prisma.state.sessions[0].organizationId, 'org-1');
  assert.equal(prisma.state.sessions[0].workerId, 'worker-1');
});

test('issue accepts the TransactionClient used by the WhatsApp webhook', async () => {
  const prisma = fakePrisma();
  const result = await issueProgressEvidenceCaptureSession(
    prisma.transactionClient(),
    issueInput(),
    deps(),
  );

  assert.equal(result.replayed, false);
  assert.equal(result.session.id, SESSION_ID);
  assert.equal(prisma.state.sessions.length, 1);
  assert.equal(prisma.metrics.transactionCalls, 0);
});

test('issue rejects an image outside the trusted scope or allowed asset states', async () => {
  const wrongKind = fakePrisma({ mediaAsset: { mediaKind: 'DOCUMENT' } });
  await assert.rejects(
    issueProgressEvidenceCaptureSession(wrongKind, issueInput(), deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_CONTEXT_UNAVAILABLE', 409),
  );

  const uploading = fakePrisma({ mediaAsset: { status: 'UPLOADING' } });
  await assert.rejects(
    issueProgressEvidenceCaptureSession(uploading, issueInput(), deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_CONTEXT_UNAVAILABLE', 409),
  );

  const wrongWorkerScope = fakePrisma({ worker: { organizationId: 'org-other' } });
  await assert.rejects(
    issueProgressEvidenceCaptureSession(wrongWorkerScope, issueInput(), deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_CONTEXT_UNAVAILABLE', 409),
  );
});

test('location link keeps the bearer only in an exact fragment and rejects arbitrary HTTP', async () => {
  const { issued } = await issuedFixture();
  const link = buildProgressEvidenceLocationLink(
    { session: issued.session, token: issued.token },
    { NEXT_PUBLIC_APP_URL: 'https://preview.obrasaas.example' },
  );
  const parsed = new URL(link);
  assert.equal(parsed.pathname, '/webview/progress-evidence-location');
  assert.equal(parsed.searchParams.get('worker'), 'worker-1');
  assert.equal(parsed.searchParams.get('session'), SESSION_ID);
  assert.equal(parsed.searchParams.get('token'), null);
  assert.equal(parsed.hash, `#token=${encodeURIComponent(issued.token)}`);
  assert.equal(link.slice(0, link.indexOf('#')).includes(issued.token), false);

  assert.throws(
    () => buildProgressEvidenceLocationLink({
      session: issued.session,
      token: issued.token,
      publicAppUrl: 'http://example.com',
    }, { NODE_ENV: 'development' }),
    rejectsCode('PROGRESS_EVIDENCE_LINK_CONFIGURATION_INVALID', 503),
  );
  assert.match(buildProgressEvidenceLocationLink({
    session: issued.session,
    token: issued.token,
    publicAppUrl: 'http://localhost:3000',
  }, { NODE_ENV: 'development' }), /^http:\/\/localhost:3000\//);
});

test('CPU-only token preflight validates signature, subject, purpose and session scope', async () => {
  const { issued } = await issuedFixture();
  const input = {
    workerId: 'worker-1',
    sessionId: issued.session.id,
    token: issued.token,
  };

  assert.equal(
    assertProgressEvidenceCaptureTokenSignature(input, deps()),
    true,
  );
  assert.throws(
    () => assertProgressEvidenceCaptureTokenSignature({
      ...input,
      token: 'not-a-signed-token',
    }, deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID', 401),
  );
  assert.throws(
    () => assertProgressEvidenceCaptureTokenSignature({
      ...input,
      sessionId: 'different-session',
    }, deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID', 401),
  );
});

test('context rejects tampered tokens, worker mismatch, and a valid token with wrong scope', async () => {
  const { prisma, issued } = await issuedFixture();
  await assert.rejects(
    getProgressEvidenceCaptureContext(prisma, {
      workerId: 'worker-1',
      sessionId: issued.session.id,
      token: `${issued.token}x`,
    }, deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID', 401),
  );
  await assert.rejects(
    getProgressEvidenceCaptureContext(prisma, {
      workerId: 'worker-other',
      sessionId: issued.session.id,
      token: issued.token,
    }, deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_SESSION_NOT_FOUND', 404),
  );

  const wrongScopeToken = generateWebviewToken('worker-1', {
    now: NOW.getTime(),
    ttlSeconds: PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS / 1_000,
    purpose: PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
    scope: 'different-session',
    secret: WEBVIEW_SECRET,
  });
  prisma.state.sessions[0].tokenHash = crypto
    .createHash('sha256')
    .update(wrongScopeToken)
    .digest('hex');
  await assert.rejects(
    getProgressEvidenceCaptureContext(prisma, {
      workerId: 'worker-1',
      sessionId: issued.session.id,
      token: wrongScopeToken,
    }, deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_TOKEN_INVALID', 401),
  );
});

test('context returns only a pinned minimum DTO and rechecks subscription/connection', async () => {
  const { prisma, issued } = await issuedFixture();
  const context = await getProgressEvidenceCaptureContext(prisma, {
    workerId: 'worker-1',
    sessionId: issued.session.id,
    token: issued.token,
  }, deps());
  assert.equal(context.session.notice.contentSha256, PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256);
  assert.equal(context.session.canCapture, true);
  assert.equal(Object.hasOwn(context.session, 'latitude'), false);
  assert.equal(Object.hasOwn(context.session, 'longitude'), false);

  prisma.state.connections[0].enabled = false;
  await assert.rejects(
    getProgressEvidenceCaptureContext(prisma, {
      workerId: 'worker-1',
      sessionId: issued.session.id,
      token: issued.token,
    }, deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_CONTEXT_UNAVAILABLE', 409),
  );

  const blocked = await issuedFixture();
  blocked.prisma.state.organizations[0].subscriptionStatus = 'SUSPENDED';
  await assert.rejects(
    getProgressEvidenceCaptureContext(blocked.prisma, {
      workerId: 'worker-1',
      sessionId: blocked.issued.session.id,
      token: blocked.issued.token,
    }, deps()),
    rejectsCode('SUBSCRIPTION_READ_ONLY', 402),
  );
});

test('expiry transition commits before the service returns HTTP 410 semantics', async () => {
  const { prisma, issued } = await issuedFixture();
  const afterExpiry = new Date(
    NOW.getTime() + PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS + 1,
  );
  const commitsBefore = prisma.metrics.commits;

  await assert.rejects(
    getProgressEvidenceCaptureContext(prisma, {
      workerId: 'worker-1',
      sessionId: issued.session.id,
      token: issued.token,
    }, deps({ now: afterExpiry })),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_SESSION_EXPIRED', 410),
  );
  assert.equal(prisma.state.sessions[0].status, 'EXPIRED');
  assert.equal(prisma.state.sessions[0].expiredAt.toISOString(), afterExpiry.toISOString());
  assert.equal(prisma.metrics.commits, commitsBefore + 1);
  assert.equal(prisma.metrics.rollbacks, 0);
});

test('explicit opt-out cancels once, replays after token TTL, and audits without coordinates', async () => {
  const { prisma, issued } = await issuedFixture();
  const input = cancelInput(issued, { correlationId: 'location-cancel-http-0001' });
  const first = await cancelProgressEvidenceLocation(prisma, input, deps());
  const context = await getProgressEvidenceCaptureContext(prisma, {
    workerId: 'worker-1',
    sessionId: issued.session.id,
    token: issued.token,
  }, deps());
  const replay = await cancelProgressEvidenceLocation(
    prisma,
    input,
    deps({ now: new Date(NOW.getTime() + PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS + 60_000) }),
  );

  assert.equal(first.replayed, false);
  assert.equal(first.session.status, 'CANCELLED');
  assert.equal(first.session.canCapture, false);
  assert.equal(first.session.canCancel, false);
  assert.equal(context.session.status, 'CANCELLED');
  assert.equal(replay.replayed, true);
  assert.equal(prisma.state.sessions[0].cancelledAt.toISOString(), NOW.toISOString());
  assert.equal(prisma.state.sessions[0].privacyAcceptedAt, null);
  assert.equal(prisma.state.sessions[0].latitude, null);
  assert.equal(prisma.state.sessions[0].longitude, null);
  assert.equal(prisma.state.audits.length, 1);
  assert.equal(prisma.state.audits[0].action, 'progress_evidence.capture_location.cancelled');
  assert.equal(prisma.state.audits[0].metadata.correlationId, input.correlationId);
  const auditJson = JSON.stringify(prisma.state.audits[0]);
  assert.equal(auditJson.includes('latitude'), false);
  assert.equal(auditJson.includes('longitude'), false);
  assert.equal(auditJson.includes('accuracyMeters'), false);
});

test('opt-out cannot erase an accepted location and a cancellation CAS miss rolls back', async () => {
  const captured = await issuedFixture();
  await captureProgressEvidenceLocation(
    captured.prisma,
    captureInput(captured.issued),
    deps({ getDistanceMeters: () => 20 }),
  );
  await assert.rejects(
    cancelProgressEvidenceLocation(captured.prisma, cancelInput(captured.issued), deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT', 409),
  );
  assert.equal(captured.prisma.state.sessions[0].status, 'LOCATION_CAPTURED');
  assert.equal(captured.prisma.state.sessions[0].latitude, -32.8895);

  const raced = await issuedFixture({ forceCancelCasMiss: true });
  await assert.rejects(
    cancelProgressEvidenceLocation(raced.prisma, cancelInput(raced.issued), deps()),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_CAS_CONFLICT', 409),
  );
  assert.equal(raced.prisma.state.sessions[0].status, 'AWAITING_LOCATION');
  assert.equal(raced.prisma.state.sessions[0].cancelledAt, undefined);
  assert.equal(raced.prisma.state.audits.length, 0);
});

test('capture requires affirmative consent and the exact pinned notice', async () => {
  const { prisma, issued } = await issuedFixture();
  await assert.rejects(
    captureProgressEvidenceLocation(
      prisma,
      captureInput(issued, { privacyAccepted: false }),
      deps(),
    ),
    rejectsCode('PROGRESS_EVIDENCE_LOCATION_NOTICE_REQUIRED', 400),
  );
  await assert.rejects(
    captureProgressEvidenceLocation(
      prisma,
      captureInput(issued, { noticeVersion: 'different-v1' }),
      deps(),
    ),
    rejectsCode('PROGRESS_EVIDENCE_LOCATION_NOTICE_MISMATCH', 409),
  );
  await assert.rejects(
    captureProgressEvidenceLocation(
      prisma,
      captureInput(issued, { noticeContentSha256: 'a'.repeat(64) }),
      deps(),
    ),
    rejectsCode('PROGRESS_EVIDENCE_LOCATION_NOTICE_MISMATCH', 409),
  );
});

test('capture rejects stale/future timestamps and invalid accuracy bounds', async () => {
  const cases = [
    {
      overrides: { capturedAt: new Date(NOW.getTime() - 120_001).toISOString() },
      code: 'PROGRESS_EVIDENCE_LOCATION_STALE',
    },
    {
      overrides: { capturedAt: new Date(NOW.getTime() + 60_001).toISOString() },
      code: 'PROGRESS_EVIDENCE_LOCATION_STALE',
    },
    {
      overrides: { accuracyMeters: 0.009 },
      code: 'PROGRESS_EVIDENCE_LOCATION_INVALID',
    },
    {
      overrides: { accuracyMeters: 10_000.01 },
      code: 'PROGRESS_EVIDENCE_LOCATION_INVALID',
    },
  ];
  for (const entry of cases) {
    const { prisma, issued } = await issuedFixture();
    await assert.rejects(
      captureProgressEvidenceLocation(
        prisma,
        captureInput(issued, entry.overrides),
        deps(),
      ),
      rejectsCode(entry.code, 422),
    );
  }
});

test('geofence verdict is conservative for inside, exact boundary, outside and poor accuracy', async () => {
  const cases = [
    { distance: 50, accuracyMeters: 10, expected: 'IN_GEOFENCE' },
    { distance: 90, accuracyMeters: 10, expected: 'IN_GEOFENCE' },
    { distance: 90.01, accuracyMeters: 10, expected: 'REVIEW_REQUIRED' },
    { distance: 0, accuracyMeters: 100.01, expected: 'REVIEW_REQUIRED' },
    { distance: 0, accuracyMeters: 10_000, expected: 'REVIEW_REQUIRED' },
  ];
  for (const entry of cases) {
    const { prisma, issued } = await issuedFixture();
    const result = await captureProgressEvidenceLocation(
      prisma,
      captureInput(issued, { accuracyMeters: entry.accuracyMeters }),
      deps({ getDistanceMeters: () => entry.distance }),
    );
    assert.equal(result.session.locationVerification, entry.expected);
    assert.equal(result.session.locationSource, 'WEBVIEW_GEOLOCATION');
    assert.equal(result.session.distanceMeters, entry.distance);
    assert.equal(result.session.geofenceRadiusMeters, 100);
    assert.ok(result.session.privacyAcceptedAt instanceof Date);
    assert.equal(Object.hasOwn(result.session, 'latitude'), false);
    assert.equal(Object.hasOwn(result.session, 'longitude'), false);
  }
});

test('missing or failed server geofence stores review-required with a null distance/radius pair', async () => {
  const missing = await issuedFixture({ project: { latitude: null, longitude: null } });
  const missingResult = await captureProgressEvidenceLocation(
    missing.prisma,
    captureInput(missing.issued),
    deps(),
  );
  assert.equal(missingResult.session.locationVerification, 'REVIEW_REQUIRED');
  assert.equal(missingResult.session.distanceMeters, null);
  assert.equal(missingResult.session.geofenceRadiusMeters, null);

  const failed = await issuedFixture();
  const failedResult = await captureProgressEvidenceLocation(
    failed.prisma,
    captureInput(failed.issued),
    deps({ getDistanceMeters: () => Number.NaN }),
  );
  assert.equal(failedResult.session.locationVerification, 'REVIEW_REQUIRED');
  assert.equal(failedResult.session.distanceMeters, null);
  assert.equal(failedResult.session.geofenceRadiusMeters, null);
});

test('capture replays exactly, rejects idempotency drift, and audits without coordinates', async () => {
  const { prisma, issued } = await issuedFixture();
  const input = captureInput(issued, { correlationId: 'location-capture-http-0001' });
  const first = await captureProgressEvidenceLocation(
    prisma,
    input,
    deps({ getDistanceMeters: () => 20 }),
  );
  const replay = await captureProgressEvidenceLocation(
    prisma,
    input,
    deps({ getDistanceMeters: () => 20 }),
  );
  const delayedReplay = await captureProgressEvidenceLocation(
    prisma,
    input,
    deps({
      now: new Date(
        NOW.getTime() + PROGRESS_EVIDENCE_CAPTURE_SESSION_TTL_MS + 60_000,
      ),
      getDistanceMeters: () => 20,
    }),
  );

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(delayedReplay.replayed, true);
  assert.equal(replay.session.status, 'LOCATION_CAPTURED');
  assert.equal(prisma.state.audits.length, 1);
  assert.equal(prisma.state.audits[0].metadata.correlationId, input.correlationId);
  const auditJson = JSON.stringify(prisma.state.audits[0]);
  assert.equal(auditJson.includes('latitude'), false);
  assert.equal(auditJson.includes('longitude'), false);
  assert.equal(auditJson.includes(String(input.latitude)), false);

  await assert.rejects(
    captureProgressEvidenceLocation(
      prisma,
      { ...input, latitude: input.latitude + 0.001 },
      deps({ getDistanceMeters: () => 20 }),
    ),
    rejectsCode('IDEMPOTENCY_KEY_CONFLICT', 409),
  );
  await assert.rejects(
    captureProgressEvidenceLocation(
      prisma,
      { ...input, idempotencyKey: 'capture-operation-0002' },
      deps({ getDistanceMeters: () => 20 }),
    ),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_STATE_CONFLICT', 409),
  );
});

test('capture CAS fails closed without audit or partial location mutation', async () => {
  const { prisma, issued } = await issuedFixture({ forceCaptureCasMiss: true });
  await assert.rejects(
    captureProgressEvidenceLocation(
      prisma,
      captureInput(issued),
      deps({ getDistanceMeters: () => 20 }),
    ),
    rejectsCode('PROGRESS_EVIDENCE_CAPTURE_CAS_CONFLICT', 409),
  );
  assert.equal(prisma.state.sessions[0].status, 'AWAITING_LOCATION');
  assert.equal(prisma.state.sessions[0].latitude, null);
  assert.equal(prisma.state.sessions[0].privacyAcceptedAt, null);
  assert.equal(prisma.state.audits.length, 0);
});
