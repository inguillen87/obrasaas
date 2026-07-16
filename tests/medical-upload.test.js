import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProtectedMedicalMedia,
  detectMedicalCertificateFileType,
  inspectMedicalCertificateFile,
  isProtectedMedicalMedia,
  medicalCertificateUploadIdempotencyKey,
  medicalFlowRecord,
  normalizedMedicalCertificateFile,
  shouldDeleteUncommittedMedicalUpload,
} from '../src/lib/medical-upload.js';

const signatures = {
  pdf: Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
  jpeg: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  png: Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]),
  webp: Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c,
  ]),
};

test('medical certificate detection recognizes only supported binary signatures', () => {
  assert.deepEqual(detectMedicalCertificateFileType(signatures.pdf), {
    mimeType: 'application/pdf',
    extension: 'pdf',
  });
  assert.deepEqual(detectMedicalCertificateFileType(signatures.jpeg), {
    mimeType: 'image/jpeg',
    extension: 'jpg',
  });
  assert.deepEqual(detectMedicalCertificateFileType(signatures.png), {
    mimeType: 'image/png',
    extension: 'png',
  });
  assert.deepEqual(detectMedicalCertificateFileType(signatures.webp), {
    mimeType: 'image/webp',
    extension: 'webp',
  });
  assert.equal(detectMedicalCertificateFileType(new TextEncoder().encode('not a certificate')), null);
  assert.equal(detectMedicalCertificateFileType(Uint8Array.from([0xff, 0xd8, 0xff])), null);
});

test('declared MIME and filename cannot make invalid content pass validation', async () => {
  const spoofedPdf = new File(['plain text'], 'certificado.pdf', { type: 'application/pdf' });
  assert.equal(await inspectMedicalCertificateFile(spoofedPdf), null);

  const mislabeledPng = new File([signatures.png], 'certificado.pdf', { type: 'application/pdf' });
  const detectedType = await inspectMedicalCertificateFile(mislabeledPng);
  assert.equal(detectedType.mimeType, 'image/png');

  const normalized = normalizedMedicalCertificateFile(mislabeledPng, detectedType);
  assert.equal(normalized.name, 'certificado.png');
  assert.equal(normalized.type, 'image/png');
  assert.equal(normalized.size, mislabeledPng.size);
});

test('protected upload metadata is preserved as message-ready medical media', () => {
  const file = new File([signatures.pdf], 'certificado.pdf', { type: 'application/pdf' });
  const media = buildProtectedMedicalMedia({
    file,
    detectedType: { mimeType: 'application/pdf', extension: 'pdf' },
    upload: {
      provider: 'vercel-blob',
      assetId: 'https://blob.example/private/certificado.pdf',
      publicId: 'obrasaas/medical-certificates/certificado.pdf',
      pathname: 'obrasaas/medical-certificates/certificado.pdf',
      secureUrl: 'https://blob.example/private/certificado.pdf',
      resourceType: 'application',
      format: 'pdf',
      bytes: file.size,
    },
  });

  assert.equal(media.url, 'https://blob.example/private/certificado.pdf');
  assert.equal(media.mimeType, 'application/pdf');
  assert.equal(media.storage.status, 'stored');
  assert.equal(media.storage.provider, 'vercel-blob');
  assert.equal(media.storage.pathname, 'obrasaas/medical-certificates/certificado.pdf');
  assert.equal(isProtectedMedicalMedia(media), true);
  assert.equal(isProtectedMedicalMedia({ ...media, storage: { ...media.storage, status: 'simulated' } }), false);
});

test('medical upload identity is stable without exposing the claimed token fingerprint', async () => {
  const file = new File([signatures.pdf], 'certificado.pdf', { type: 'application/pdf' });
  const input = {
    file,
    projectId: 'project-1',
    workerId: 'worker-1',
    tokenFingerprint: 'private-token-fingerprint',
  };
  const first = await medicalCertificateUploadIdempotencyKey(input);
  assert.equal(first, await medicalCertificateUploadIdempotencyKey(input));
  assert.match(first, /^medical-certificate:v1:[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /private-token-fingerprint/);
  assert.notEqual(
    first,
    await medicalCertificateUploadIdempotencyKey({ ...input, workerId: 'worker-2' }),
  );
});

test('uncommitted medical upload cleanup preserves the winner and removes only real losers', () => {
  const createdUpload = { provider: 'vercel-blob', reused: false };
  assert.equal(shouldDeleteUncommittedMedicalUpload({
    upload: createdUpload,
    uploadedMediaUrl: 'https://blob.example/loser.pdf',
    committedMediaUrl: 'https://blob.example/winner.pdf',
  }), true);
  assert.equal(shouldDeleteUncommittedMedicalUpload({
    upload: createdUpload,
    uploadedMediaUrl: 'https://blob.example/shared.pdf',
    committedMediaUrl: 'https://blob.example/shared.pdf',
  }), false);
  assert.equal(shouldDeleteUncommittedMedicalUpload({
    upload: { ...createdUpload, reused: true },
    uploadedMediaUrl: 'https://blob.example/shared.pdf',
    committedMediaUrl: null,
  }), false);
  assert.equal(shouldDeleteUncommittedMedicalUpload({
    upload: createdUpload,
    uploadedMediaUrl: 'https://blob.example/orphan.pdf',
    committedMediaUrl: null,
  }), true);
});

test('medical flow claims association only for completed protected evidence', () => {
  const media = {
    url: 'https://blob.example/private/certificado.pdf',
    storage: {
      provider: 'vercel-blob',
      status: 'stored',
      assetId: 'https://blob.example/private/certificado.pdf',
    },
  };
  const documented = medicalFlowRecord({
    days: 5,
    workerName: 'Persona autorizada',
    media,
    uploadLink: 'https://app.example/webview/medical',
  });
  assert.equal(documented.hasEvidence, true);
  assert.match(documented.reply, /asociado al registro/);
  assert.match(documented.attendanceStatus, /con certificado/);

  const pending = medicalFlowRecord({
    days: 5,
    workerName: 'Persona autorizada',
    media: null,
    uploadLink: 'https://app.example/webview/medical',
  });
  assert.equal(pending.hasEvidence, false);
  assert.doesNotMatch(pending.reply, /asociad/i);
  assert.match(pending.reply, /falta adjuntar/);
  assert.match(pending.reply, /enlace seguro/);
  assert.match(pending.attendanceStatus, /certificado pendiente/);
});
