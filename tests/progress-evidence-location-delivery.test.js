import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { generateWebviewToken } from '../src/lib/auth.js';
import {
  PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
  PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
  PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
} from '../src/lib/progress-evidence-capture-sessions.js';
import {
  materializeProgressEvidenceLocationDelivery,
  PROGRESS_EVIDENCE_LOCATION_STALE_FALLBACK_REPLY,
} from '../src/lib/whatsapp/progress-evidence-location-delivery.js';

const NOW = new Date('2026-07-29T15:00:00.000Z');
const SESSION_ID = '123e4567-e89b-42d3-a456-426614174123';
const SECRET = 'progress-evidence-location-delivery-test-secret';
const SCOPE = Object.freeze({
  organizationId: 'organization-delivery-a',
  projectId: 'project-delivery-a',
  phoneNumberId: '1225843560610854',
});

function tokenFor(session) {
  return generateWebviewToken(session.workerId, {
    now: session.issuedAt.getTime(),
    ttlSeconds: (session.expiresAt.getTime() - session.issuedAt.getTime()) / 1_000,
    purpose: PROGRESS_EVIDENCE_CAPTURE_TOKEN_PURPOSE,
    scope: session.id,
    secret: SECRET,
  });
}

function deliveryStore({
  expiresAt = new Date(NOW.getTime() + (15 * 60 * 1_000)),
  issuedAt = new Date(expiresAt.getTime() - (15 * 60 * 1_000)),
  status = 'AWAITING_LOCATION',
  resolvedWorkerId = 'worker-delivery-a',
  assetWebhookEventId = 'webhook-progress-evidence-delivery',
} = {}) {
  const calls = [];
  const audits = [];
  const session = {
    id: SESSION_ID,
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    workerId: 'worker-delivery-a',
    connectionId: 'connection-delivery-a',
    mediaAssetId: 'asset-delivery-a',
    status,
    revision: 0,
    tokenHash: '',
    privacyNoticeVersion: PROGRESS_EVIDENCE_LOCATION_NOTICE_VERSION,
    privacyNoticeContentSha256: PROGRESS_EVIDENCE_LOCATION_NOTICE_CONTENT_SHA256,
    issuedAt,
    expiresAt,
    expiredAt: null,
    cancelledAt: null,
  };
  session.tokenHash = crypto.createHash('sha256').update(tokenFor(session)).digest('hex');

  function matchesExpiration(where) {
    const expires = session.expiresAt.getTime();
    const predicate = where.expiresAt;
    if (predicate?.lte && expires > predicate.lte.getTime()) return false;
    if (predicate?.gt && expires <= predicate.gt.getTime()) return false;
    return true;
  }

  const transaction = {
    progressEvidenceCaptureSession: {
      async findFirst({ where }) {
        calls.push(['session-read', where]);
        return session.id === where.id
          && session.organizationId === where.organizationId
          && session.projectId === where.projectId
          ? { ...session }
          : null;
      },
      async updateMany({ where, data }) {
        calls.push(['session-transition', { where, data }]);
        if (
          session.id !== where.id
          || session.organizationId !== where.organizationId
          || session.projectId !== where.projectId
          || session.workerId !== where.workerId
          || session.status !== where.status
          || !matchesExpiration(where)
        ) return { count: 0 };
        session.status = data.status;
        session.revision += data.revision.increment;
        if (data.expiredAt) session.expiredAt = data.expiredAt;
        if (data.cancelledAt) session.cancelledAt = data.cancelledAt;
        return { count: 1 };
      },
    },
    project: {
      async findFirst({ where }) {
        calls.push(['project-read', where]);
        return where.id === SCOPE.projectId
          && where.organizationId === SCOPE.organizationId
          ? { id: SCOPE.projectId, organizationId: SCOPE.organizationId, status: 'ACTIVE' }
          : null;
      },
    },
    whatsAppConnection: {
      async findFirst({ where }) {
        calls.push(['connection-read', where]);
        return where.id === session.connectionId
          && where.projectId === SCOPE.projectId
          && where.phoneNumberId === SCOPE.phoneNumberId
          ? {
              id: session.connectionId,
              projectId: SCOPE.projectId,
              phoneNumberId: SCOPE.phoneNumberId,
              enabled: true,
              connectionStatus: 'CONNECTED',
            }
          : null;
      },
    },
    whatsAppMediaAsset: {
      async findFirst({ where }) {
        calls.push(['asset-read', where]);
        return where.id === session.mediaAssetId
          && where.organizationId === SCOPE.organizationId
          && where.projectId === SCOPE.projectId
          && where.webhookEventId === assetWebhookEventId
          && where.mediaKind === 'IMAGE'
          && where.status === 'CLAIMED'
          ? {
              id: session.mediaAssetId,
              organizationId: SCOPE.organizationId,
              projectId: SCOPE.projectId,
              webhookEventId: assetWebhookEventId,
              mediaKind: 'IMAGE',
              status: 'CLAIMED',
            }
          : null;
      },
    },
    auditLog: {
      async create({ data }) {
        calls.push(['audit-create', data]);
        audits.push(data);
        return data;
      },
    },
  };
  const prisma = {
    ...transaction,
    async $transaction(operation, options) {
      calls.push(['transaction-start', options]);
      const result = await operation(transaction);
      calls.push(['transaction-commit']);
      return result;
    },
  };
  const deps = {
    clock: () => NOW,
    webviewSecret: SECRET,
    environment: { NEXT_PUBLIC_APP_URL: 'https://pilot.obrasaas.example' },
    async assertSubscription(_transaction, organizationId, { now }) {
      calls.push(['subscription-fence', { organizationId, now }]);
      assert.equal(organizationId, SCOPE.organizationId);
    },
    async resolveWorker(_transaction, scope, recipientPhone) {
      calls.push(['worker-resolve', { scope, recipientPhone }]);
      return {
        status: 'RESOLVED',
        worker: { id: resolvedWorkerId },
      };
    },
  };
  return { prisma, deps, session, calls, audits };
}

function deliveryInput() {
  return {
    descriptor: { version: 1, sessionId: SESSION_ID },
    scope: SCOPE,
    recipientPhone: '15551234567',
    eventId: 'webhook-progress-evidence-delivery',
  };
}

test('a live H2 link is reconstructed only in memory with enough remaining validity', async () => {
  const store = deliveryStore();
  const result = await materializeProgressEvidenceLocationDelivery(
    store.prisma,
    deliveryInput(),
    store.deps,
  );

  assert.equal(result.mode, 'LINK');
  assert.equal(result.sessionId, SESSION_ID);
  const link = result.text.match(
    /https:\/\/pilot\.obrasaas\.example\/webview\/progress-evidence-location\?[^\s#]+#[^\s]+/,
  )?.[0];
  assert.ok(link);
  const url = new URL(link);
  assert.deepEqual([...url.searchParams.keys()].sort(), ['session', 'worker']);
  assert.equal(url.searchParams.get('worker'), 'worker-delivery-a');
  assert.equal(url.searchParams.get('session'), SESSION_ID);
  assert.equal(url.searchParams.has('token'), false);
  assert.match(url.hash, /^#token=.+/);
  assert.equal(store.session.status, 'AWAITING_LOCATION');
  assert.equal(store.calls.some(([name]) => name === 'session-transition'), false);
  assert.equal(JSON.stringify(store.session).includes(tokenFor(store.session)), false);
});

test('an expired H2 session transitions atomically and sends a location-free fallback', async () => {
  const store = deliveryStore({
    issuedAt: new Date(NOW.getTime() - (16 * 60 * 1_000)),
    expiresAt: new Date(NOW.getTime() - (60 * 1_000)),
  });
  const result = await materializeProgressEvidenceLocationDelivery(
    store.prisma,
    deliveryInput(),
    store.deps,
  );

  assert.deepEqual(result, {
    mode: 'FALLBACK',
    reason: 'EXPIRED',
    sessionId: SESSION_ID,
    text: PROGRESS_EVIDENCE_LOCATION_STALE_FALLBACK_REPLY,
  });
  assert.equal(store.session.status, 'EXPIRED');
  assert.equal(store.session.expiredAt.toISOString(), NOW.toISOString());
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].action, 'progress_evidence.location_delivery.expired_before_send');
  assert.doesNotMatch(result.text, /token=|https?:\/\//i);
  const transitionIndex = store.calls.findIndex(([name]) => name === 'session-transition');
  const auditIndex = store.calls.findIndex(([name]) => name === 'audit-create');
  const commitIndex = store.calls.findIndex(([name]) => name === 'transaction-commit');
  assert.ok(transitionIndex >= 0 && transitionIndex < auditIndex && auditIndex < commitIndex);
});

test('an H2 session below the minimum send window is cancelled before fallback', async () => {
  const store = deliveryStore({
    issuedAt: new Date(NOW.getTime() - (11 * 60 * 1_000)),
    expiresAt: new Date(NOW.getTime() + (4 * 60 * 1_000)),
  });
  const result = await materializeProgressEvidenceLocationDelivery(
    store.prisma,
    deliveryInput(),
    store.deps,
  );

  assert.equal(result.mode, 'FALLBACK');
  assert.equal(result.reason, 'INSUFFICIENT_VALIDITY');
  assert.equal(store.session.status, 'CANCELLED');
  assert.equal(store.session.cancelledAt.toISOString(), NOW.toISOString());
  assert.equal(store.audits[0].action, 'progress_evidence.location_delivery.cancelled_insufficient_validity');
  assert.doesNotMatch(result.text, /token=|https?:\/\//i);
});

test('H2 delivery fails closed when the WhatsApp recipient no longer resolves to the bound worker', async () => {
  const store = deliveryStore({ resolvedWorkerId: 'worker-other' });
  await assert.rejects(
    materializeProgressEvidenceLocationDelivery(
      store.prisma,
      deliveryInput(),
      store.deps,
    ),
    (error) => error.code === 'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONTEXT_INVALID',
  );
  assert.equal(store.session.status, 'AWAITING_LOCATION');
  assert.equal(store.calls.some(([name]) => name === 'session-transition'), false);
});

test('H2 delivery binds the descriptor to the exact webhook event that created the photo asset', async () => {
  const store = deliveryStore({ assetWebhookEventId: 'webhook-other-photo' });
  await assert.rejects(
    materializeProgressEvidenceLocationDelivery(
      store.prisma,
      deliveryInput(),
      store.deps,
    ),
    (error) => error.code === 'PROGRESS_EVIDENCE_LOCATION_DELIVERY_CONTEXT_INVALID',
  );
  assert.equal(store.session.status, 'AWAITING_LOCATION');
  assert.equal(store.calls.some(([name]) => name === 'session-transition'), false);
});
