import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTENDANCE_ACTIONS,
  generateWebviewToken,
  readWebviewToken,
} from '../src/lib/auth.js';
import {
  SECURE_WEBVIEW_DELIVERY_MARKER,
  extractSecureWebviewDelivery,
  materializeSecureWebviewDelivery,
} from '../src/lib/whatsapp/secure-webview-delivery.js';

const SECRET = 'secure-webview-delivery-unit-test-secret-123456789';
const ISSUED_AT = new Date('2026-08-10T12:00:00.000Z');
const SCOPE = Object.freeze({
  organizationId: 'organization-secure-a',
  projectId: 'project-secure-a',
  phoneNumberId: '1225843560610854',
});
const WORKER_ID = 'worker-secure-a';

function signedLink({ purpose = 'attendance', action = ATTENDANCE_ACTIONS.CHECK_IN } = {}) {
  const options = {
    purpose,
    scope: SCOPE.projectId,
    now: ISSUED_AT.getTime(),
    secret: SECRET,
    ...(purpose === 'attendance'
      ? {
          action,
          ...(action === ATTENDANCE_ACTIONS.CHECK_IN
            ? { pendingEntryId: 'pending-secure-a' }
            : { shiftId: 'shift-secure-a', shiftRevision: 7 }),
        }
      : {}),
  };
  const token = generateWebviewToken(WORKER_ID, options);
  const path = purpose === 'medical' ? 'medical' : 'attendance';
  const query = new URLSearchParams({ worker: WORKER_ID, token }).toString();
  return { token, url: `https://pilot.obrasaas.test/webview/${path}?${query}` };
}

function deliveryStore({ attendanceEntry = { id: 'pending-secure-a' } } = {}) {
  const calls = [];
  const audits = [];
  const transaction = {
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return { id: SCOPE.projectId };
      },
    },
    whatsAppConnection: {
      async findFirst(args) {
        calls.push(['connection', args]);
        return { id: 'connection-secure-a' };
      },
    },
    attendanceEntry: {
      async findFirst(args) {
        calls.push(['attendance-entry', args]);
        return attendanceEntry;
      },
    },
    attendanceShift: {
      async findFirst(args) {
        calls.push(['attendance-shift', args]);
        return { id: 'shift-secure-a' };
      },
    },
  };
  const prisma = {
    ...transaction,
    async $transaction(operation, options) {
      calls.push(['transaction', options]);
      return operation(transaction);
    },
  };
  const deps = {
    clock: () => new Date(ISSUED_AT.getTime() + 30_000),
    webviewSecret: SECRET,
    async assertSubscription(_transaction, organizationId, { now }) {
      calls.push(['subscription', { organizationId, now }]);
    },
    async resolveWorker(_transaction, scope, phone) {
      calls.push(['worker', { scope, phone }]);
      return { status: 'RESOLVED', worker: { id: WORKER_ID } };
    },
    async createAuditLog(_transaction, audit) {
      calls.push(['audit', audit]);
      audits.push(audit);
      return audit;
    },
  };
  return { audits, calls, deps, prisma };
}

function deliveryInput(descriptor) {
  return {
    descriptor,
    scope: SCOPE,
    recipientPhone: '5491112345678',
    eventId: 'webhook-secure-a',
    reply: `Registré tu ingreso. ${SECURE_WEBVIEW_DELIVERY_MARKER}`,
  };
}

test('signed attendance and medical links become strict non-secret descriptors', () => {
  const attendance = signedLink();
  const attendanceDescriptor = extractSecureWebviewDelivery(
    `Registré tu ingreso. ${attendance.url}`,
    { projectId: SCOPE.projectId, secret: SECRET, now: ISSUED_AT.getTime() },
  );

  assert.deepEqual(attendanceDescriptor, {
    version: 1,
    kind: 'ATTENDANCE_CHECK_IN',
    projectId: SCOPE.projectId,
    workerId: WORKER_ID,
    resourceId: 'pending-secure-a',
    resourceRevision: null,
    issuedAt: Math.floor(ISSUED_AT.getTime() / 1_000),
    expiresAt: Math.floor(ISSUED_AT.getTime() / 1_000) + (2 * 60 * 60),
  });
  assert.doesNotMatch(JSON.stringify(attendanceDescriptor), new RegExp(attendance.token.replaceAll('.', '\\.')));

  const medical = signedLink({ purpose: 'medical' });
  const medicalDescriptor = extractSecureWebviewDelivery(
    `Completá tus datos protegidos. ${medical.url}`,
    { projectId: SCOPE.projectId, secret: SECRET, now: ISSUED_AT.getTime() },
  );
  assert.deepEqual(medicalDescriptor, {
    version: 1,
    kind: 'MEDICAL',
    projectId: SCOPE.projectId,
    workerId: WORKER_ID,
    resourceId: null,
    resourceRevision: null,
    issuedAt: Math.floor(ISSUED_AT.getTime() / 1_000),
    expiresAt: Math.floor(ISSUED_AT.getTime() / 1_000) + (2 * 60 * 60),
  });
  assert.doesNotMatch(JSON.stringify(medicalDescriptor), /token|signature|secret/i);
});

test('the bearer is reconstructed only after context validation and never enters the audit', async () => {
  const original = signedLink();
  const descriptor = extractSecureWebviewDelivery(
    `Registré tu ingreso. ${original.url}`,
    { projectId: SCOPE.projectId, secret: SECRET, now: ISSUED_AT.getTime() },
  );
  const store = deliveryStore();
  let reconstructedToken = null;
  const result = await materializeSecureWebviewDelivery(
    store.prisma,
    deliveryInput(descriptor),
    {
      ...store.deps,
      buildLink(boundDescriptor, token) {
        assert.deepEqual(boundDescriptor, descriptor);
        reconstructedToken = token;
        return `https://pilot.obrasaas.test/webview/attendance?worker=${WORKER_ID}&token=${token}`;
      },
    },
  );

  assert.equal(result.mode, 'LINK');
  assert.ok(reconstructedToken);
  assert.equal(reconstructedToken, original.token);
  assert.match(result.text, /\/webview\/attendance\?/);
  assert.deepEqual(readWebviewToken(WORKER_ID, reconstructedToken, {
    purpose: 'attendance',
    scope: SCOPE.projectId,
    action: ATTENDANCE_ACTIONS.CHECK_IN,
    secret: SECRET,
    now: ISSUED_AT.getTime() + 30_000,
  })?.pid, 'pending-secure-a');
  assert.equal(store.audits.length, 1);
  assert.equal(store.audits[0].action, 'webview.secure_link.materialized');
  assert.equal(store.audits[0].metadata.secretPersisted, false);
  assert.doesNotMatch(JSON.stringify(store.audits), new RegExp(reconstructedToken.replaceAll('.', '\\.')));
  assert.ok(
    store.calls.findIndex(([name]) => name === 'attendance-entry')
      < store.calls.findIndex(([name]) => name === 'audit'),
  );
});

test('a nearly expired descriptor produces a safe fallback without reconstructing a bearer', async () => {
  const original = signedLink();
  const descriptor = extractSecureWebviewDelivery(
    `Registré tu ingreso. ${original.url}`,
    { projectId: SCOPE.projectId, secret: SECRET, now: ISSUED_AT.getTime() },
  );
  const store = deliveryStore();
  let generated = false;
  const result = await materializeSecureWebviewDelivery(
    store.prisma,
    deliveryInput(descriptor),
    {
      ...store.deps,
      clock: () => new Date((descriptor.expiresAt * 1_000) - 30_000),
      generateWebviewToken() {
        generated = true;
        throw new Error('must not run');
      },
    },
  );

  assert.equal(result.mode, 'FALLBACK');
  assert.equal(result.reason, 'INSUFFICIENT_VALIDITY');
  assert.equal(generated, false);
  assert.match(result.text, /enlace seguro venció/i);
  assert.doesNotMatch(result.text, /token=|https?:\/\//i);
  assert.equal(store.audits[0].action, 'webview.secure_link.unavailable');
});
