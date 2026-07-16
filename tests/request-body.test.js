import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  MAX_MEDICAL_CERTIFICATE_BYTES,
  MAX_MEDICAL_CERTIFICATE_MEGABYTES,
  MAX_MEDICAL_MULTIPART_BYTES,
} from '../src/lib/medical-upload.js';
import {
  RequestBodyError,
  readLimitedRequestBytes,
  readJsonRequest,
  readMultipartFormDataRequest,
} from '../src/lib/request-body.js';
import { verifyMetaSignature } from '../src/lib/whatsapp/meta.js';

function requestBodyError(code, status) {
  return (error) => (
    error instanceof RequestBodyError
    && error.code === code
    && error.status === status
  );
}

test('medical upload file and multipart limits stay coherent and deployable', () => {
  assert.equal(MAX_MEDICAL_CERTIFICATE_MEGABYTES, 4);
  assert.equal(MAX_MEDICAL_CERTIFICATE_BYTES, 4 * 1024 * 1024);
  assert.equal(MAX_MEDICAL_MULTIPART_BYTES, MAX_MEDICAL_CERTIFICATE_BYTES + (128 * 1024));
  assert.ok(MAX_MEDICAL_MULTIPART_BYTES < 4_500_000);
});

test('bounded JSON reader accepts JSON media types and valid UTF-8 bodies', async () => {
  const request = new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
    body: JSON.stringify({ worker: 'worker-a', latitude: -34.6 }),
  });

  assert.deepEqual(await readJsonRequest(request, { maxBytes: 1_024 }), {
    worker: 'worker-a',
    latitude: -34.6,
  });
});

test('bounded JSON reader rejects unsupported media types and malformed JSON', async () => {
  const wrongType = new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: '{}',
  });
  await assert.rejects(
    readJsonRequest(wrongType, { maxBytes: 1_024 }),
    requestBodyError('UNSUPPORTED_MEDIA_TYPE', 415),
  );

  const malformed = new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{not-json',
  });
  await assert.rejects(
    readJsonRequest(malformed, { maxBytes: 1_024 }),
    requestBodyError('INVALID_JSON', 400),
  );
});

test('declared oversized bodies are rejected before their stream is read', async () => {
  let bodyWasRead = false;
  const request = {
    headers: new Headers({
      'Content-Type': 'application/json',
      'Content-Length': '4096',
    }),
    get body() {
      bodyWasRead = true;
      throw new Error('body should not be accessed');
    },
  };

  await assert.rejects(
    readJsonRequest(request, { maxBytes: 128 }),
    requestBodyError('REQUEST_BODY_TOO_LARGE', 413),
  );
  assert.equal(bodyWasRead, false);
});

test('streamed bodies are rejected when their actual byte count exceeds the limit', async () => {
  const request = new Request('http://localhost/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': '1',
    },
    body: JSON.stringify({ value: 'a'.repeat(256) }),
  });

  await assert.rejects(
    readJsonRequest(request, { maxBytes: 64 }),
    requestBodyError('REQUEST_BODY_TOO_LARGE', 413),
  );
});

test('bounded byte reader preserves the exact signed webhook bytes across stream chunks', async () => {
  const rawText = '{\r\n  "object": "whatsapp_business_account", "note": "grúa"\r\n}\r\n';
  const rawBytes = new TextEncoder().encode(rawText);
  let offset = 0;
  const request = {
    headers: new Headers({ 'Content-Type': 'application/json; charset=utf-8' }),
    body: new ReadableStream({
      pull(controller) {
        if (offset >= rawBytes.byteLength) {
          controller.close();
          return;
        }
        const nextOffset = Math.min(rawBytes.byteLength, offset + 7);
        controller.enqueue(rawBytes.slice(offset, nextOffset));
        offset = nextOffset;
      },
    }),
  };

  const received = await readLimitedRequestBytes(request, {
    maxBytes: 1_000_000,
    requireJson: true,
  });
  assert.deepEqual(received, rawBytes);

  const secret = 'webhook-app-secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBytes).digest('hex');
  assert.equal(verifyMetaSignature(received, `sha256=${signature}`, secret), true);
  const normalized = new TextEncoder().encode(JSON.stringify(JSON.parse(rawText)));
  assert.equal(verifyMetaSignature(normalized, `sha256=${signature}`, secret), false);
});

test('invalid Content-Length is rejected deterministically', async () => {
  const request = new Request('http://localhost/api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': 'unknown',
    },
    body: '{}',
  });

  await assert.rejects(
    readJsonRequest(request, { maxBytes: 64 }),
    requestBodyError('INVALID_CONTENT_LENGTH', 400),
  );
});

test('bounded multipart reader parses browser FormData below the envelope limit', async () => {
  const formData = new FormData();
  formData.set('worker', 'worker-a');
  formData.set('days', '3');
  formData.set('certificate', new File(['certificate'], 'cert.pdf', {
    type: 'application/pdf',
  }));
  const request = new Request('http://localhost/api', {
    method: 'POST',
    body: formData,
  });

  const parsed = await readMultipartFormDataRequest(request, { maxBytes: 4_096 });
  assert.equal(parsed.get('worker'), 'worker-a');
  assert.equal(parsed.get('days'), '3');
  assert.equal(parsed.get('certificate').name, 'cert.pdf');
  assert.equal(parsed.get('certificate').type, 'application/pdf');
});

test('multipart reader requires a boundary and enforces actual envelope bytes', async () => {
  const missingBoundary = new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: 'not-a-form',
  });
  await assert.rejects(
    readMultipartFormDataRequest(missingBoundary, { maxBytes: 1_024 }),
    requestBodyError('UNSUPPORTED_MEDIA_TYPE', 415),
  );

  const formData = new FormData();
  formData.set('certificate', new File(['a'.repeat(512)], 'large.pdf', {
    type: 'application/pdf',
  }));
  const oversized = new Request('http://localhost/api', {
    method: 'POST',
    body: formData,
  });
  await assert.rejects(
    readMultipartFormDataRequest(oversized, { maxBytes: 128 }),
    requestBodyError('REQUEST_BODY_TOO_LARGE', 413),
  );
});
