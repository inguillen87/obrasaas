import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTerminalProtectedUploadClientError,
  isProtectedUploadFileSizeAllowed,
  MAX_PROTECTED_UPLOAD_BYTES,
  protectedUploadAttemptForPayload,
  protectedUploadPayloadKey,
  rememberProtectedUploadId,
} from '../src/lib/protected-upload-policy.js';

const FIXED_NOW = new Date('2026-07-26T18:00:00.000Z');

test('one payload keeps the same operation key and capturedAt across response-loss retries', async () => {
  let generated = 0;
  const options = {
    deleteEndpoint: '/api/progress/upload',
    randomUUID: () => `operation-${++generated}-stable`,
    now: () => FIXED_NOW,
  };
  const payloadKey = protectedUploadPayloadKey({ taskId: 'task-1', caption: 'muro' });
  const first = await protectedUploadAttemptForPayload(null, payloadKey, options);
  rememberProtectedUploadId(first, 'upload-1');

  // This models a business commit followed by a lost HTTP response: the UI
  // still has the staged upload and must retry the exact operation payload.
  const replay = await protectedUploadAttemptForPayload(first, payloadKey, options);
  assert.strictEqual(replay, first);
  assert.equal(replay.operationKey, 'operation-1-stable');
  assert.equal(replay.capturedAt, FIXED_NOW.toISOString());
  assert.equal(replay.uploadId, 'upload-1');
  assert.equal(generated, 1);
});

test('a real payload change deletes the previous upload before rotating the key', async () => {
  let generated = 0;
  const calls = [];
  const common = {
    deleteEndpoint: '/api/progress/upload',
    randomUUID: () => `operation-${++generated}-stable`,
    now: () => FIXED_NOW,
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return new Response(null, { status: 204 });
    },
  };
  const first = await protectedUploadAttemptForPayload(null, 'payload-a', common);
  rememberProtectedUploadId(first, 'upload-1');
  const changed = await protectedUploadAttemptForPayload(first, 'payload-b', common);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/progress/upload');
  assert.equal(calls[0].options.headers['Idempotency-Key'], first.deleteKey);
  assert.equal(calls[0].options.body, JSON.stringify({ uploadId: 'upload-1' }));
  assert.equal(changed.operationKey, 'operation-2-stable');
  assert.equal(generated, 2);
});

test('failed cleanup keeps the old attempt and never allocates a second operation key', async () => {
  let generated = 0;
  const common = {
    deleteEndpoint: '/api/progress/upload',
    randomUUID: () => `operation-${++generated}-stable`,
    now: () => FIXED_NOW,
  };
  const first = await protectedUploadAttemptForPayload(null, 'payload-a', common);
  rememberProtectedUploadId(first, 'upload-1');
  await assert.rejects(
    protectedUploadAttemptForPayload(first, 'payload-b', {
      ...common,
      fetchImpl: async () => Response.json(
        { error: 'pendiente', code: 'DELETE_PENDING' },
        { status: 502 },
      ),
    }),
    (error) => error.code === 'DELETE_PENDING' && error.status === 502,
  );
  assert.equal(first.uploadId, 'upload-1');
  assert.equal(generated, 1);
});

test('serverless-safe file policy accepts at most four mebibytes', () => {
  assert.equal(isProtectedUploadFileSizeAllowed({ size: MAX_PROTECTED_UPLOAD_BYTES }), true);
  assert.equal(isProtectedUploadFileSizeAllowed({ size: MAX_PROTECTED_UPLOAD_BYTES + 1 }), false);
  assert.equal(isProtectedUploadFileSizeAllowed({ size: 0 }), false);
});

test('retryable transport and quota responses keep the same staged attempt', () => {
  assert.equal(isTerminalProtectedUploadClientError({ status: 400 }), true);
  assert.equal(isTerminalProtectedUploadClientError({ status: 409 }), true);
  assert.equal(isTerminalProtectedUploadClientError({ status: 425 }), false);
  assert.equal(isTerminalProtectedUploadClientError({ status: 429 }), false);
  assert.equal(isTerminalProtectedUploadClientError({ status: 503 }), false);
});

test('a live upload lease conflict is retryable and never discards the shared reservation', () => {
  assert.equal(isTerminalProtectedUploadClientError({
    status: 409,
    code: 'PROTECTED_UPLOAD_IN_PROGRESS',
  }), false);
  assert.equal(isTerminalProtectedUploadClientError({
    status: 409,
    code: 'IDEMPOTENCY_KEY_REUSED',
  }), true);
});
