import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isDashboardProgressMediaForProject,
  isPrivateReceiptForProject,
  isWhatsAppProgressMediaForProject,
  privateReceiptFileResponse,
  privateReceiptIsReferenced,
  privateReceiptStorageBelongsToProject,
  privateReceiptStorageReference,
  progressBytesMatchMime,
  progressEvidenceFileResponse,
  receiptBytesMatchMime,
} from '../src/lib/private-receipts.js';

const digest = 'a'.repeat(64);

function receipt(storage, overrides = {}) {
  return {
    provider: storage.provider,
    storage,
    mimeType: 'application/pdf',
    filename: 'factura.pdf',
    size: 128,
    sha256: digest,
    visibility: 'private',
    ...overrides,
  };
}

test('private receipt validation accepts scoped legacy Cloudinary identities', () => {
  const storage = {
    provider: 'cloudinary',
    assetId: 'cloudinary-asset',
    publicId: 'obrasaas/projects/project-1/supplier-invoices/opaque-id.pdf',
    pathname: null,
    resourceType: 'raw',
    format: 'pdf',
    bytes: 128,
    reused: false,
  };

  assert.equal(isPrivateReceiptForProject(receipt(storage), 'project-1', 'supplier'), true);
  assert.equal(isPrivateReceiptForProject(receipt(storage), 'project-2', 'supplier'), false);
  assert.equal(isPrivateReceiptForProject(receipt(storage), 'project-1', 'goods'), false);
});

test('private receipt validation accepts scoped Vercel Blob identities', () => {
  const pathname = 'obrasaas/projects/project-1/goods-receipts/opaque-id-factura.pdf';
  const storage = {
    provider: 'vercel-blob',
    assetId: `https://private.blob.vercel-storage.com/${pathname}`,
    publicId: pathname,
    pathname,
    resourceType: 'application',
    format: 'pdf',
    bytes: 128,
    reused: false,
  };

  assert.equal(isPrivateReceiptForProject(receipt(storage), 'project-1', 'goods'), true);
  assert.equal(privateReceiptStorageBelongsToProject({ ...storage, assetId: 'https://evil.example/file' }, 'project-1', 'goods'), false);
  assert.equal(privateReceiptStorageBelongsToProject({ ...storage, assetId: 'https://private.blob.vercel-storage.com/other/file' }, 'project-1', 'goods'), false);
  assert.equal(privateReceiptStorageBelongsToProject({ ...storage, pathname: `${pathname}/../other` }, 'project-1', 'goods'), false);
});

test('dashboard progress media requires a complete identity under the exact project prefix', () => {
  const pathname = 'obrasaas/projects/project-1/progress/evidence.jpg';
  const media = {
    provider: 'vercel-blob',
    visibility: 'private',
    mimeType: 'image/jpeg',
    filename: 'evidence.jpg',
    size: 128,
    sha256: digest,
    storage: {
      provider: 'vercel-blob',
      assetId: `https://private.blob.vercel-storage.com/${pathname}`,
      pathname,
      publicId: pathname,
      resourceType: 'image',
      format: 'jpg',
      bytes: 128,
    },
  };

  assert.equal(isDashboardProgressMediaForProject(media, 'project-1'), true);
  assert.equal(isDashboardProgressMediaForProject(media, 'project-2'), false);
  assert.equal(isDashboardProgressMediaForProject({
    ...media,
    storage: { ...media.storage, assetId: 'https://private.blob.vercel-storage.com/foreign/path.jpg' },
  }, 'project-1'), false);

  const cloudinary = {
    ...media,
    provider: 'cloudinary',
    storage: {
      provider: 'cloudinary',
      publicId: 'obrasaas/projects/project-1/progress/legacy-evidence',
      resourceType: 'image',
      format: 'jpg',
      bytes: 128,
    },
  };
  assert.equal(isDashboardProgressMediaForProject(cloudinary, 'project-1'), true);
});

test('WhatsApp progress media binds the authorized Meta message to its project connection prefix', () => {
  const phoneNumberId = '1225843560610854';
  const sourceMedia = {
    mimeType: 'image/jpeg',
    filename: 'pared.jpg',
    size: 128,
    sha256: digest,
    url: 'https://private.example.test/opaque',
    storage: {
      provider: 'cloudinary',
      status: 'stored',
      publicId: `obrasaas/whatsapp/${phoneNumberId}/legacy-evidence`,
      resourceType: 'image',
      format: 'jpg',
      bytes: 128,
    },
  };
  const media = {
    schemaVersion: 1,
    source: 'whatsapp-message',
    kind: 'image',
    mimeType: sourceMedia.mimeType,
    filename: sourceMedia.filename,
    size: sourceMedia.size,
    sha256: sourceMedia.sha256,
  };
  const connection = { projectId: 'project-1', phoneNumberId, enabled: true };
  const sourceMessage = {
    direction: 'INBOUND',
    kind: 'IMAGE',
    mediaUrl: sourceMedia.url,
    metadata: { provider: 'meta', authorized: true, phoneNumberId, media: sourceMedia },
    conversation: { projectId: 'project-1', channel: 'whatsapp', externalId: 'meta:worker' },
  };

  assert.equal(isWhatsAppProgressMediaForProject({ media, sourceMessage, connection, projectId: 'project-1' }), true);
  assert.equal(isWhatsAppProgressMediaForProject({ media, sourceMessage, connection, projectId: 'project-2' }), false);
  assert.equal(isWhatsAppProgressMediaForProject({
    media,
    connection,
    projectId: 'project-1',
    sourceMessage: { ...sourceMessage, metadata: { ...sourceMessage.metadata, phoneNumberId: '999999' } },
  }), false);
});

test('private receipt validation rejects provider, hash and immutable size mismatches', () => {
  const storage = {
    provider: 'cloudinary',
    publicId: 'obrasaas/projects/project-1/cash-receipts/opaque-id',
    resourceType: 'image',
    format: 'jpg',
    bytes: 128,
  };

  assert.equal(isPrivateReceiptForProject(receipt(storage), 'project-1', 'cash'), true);
  assert.equal(isPrivateReceiptForProject(receipt(storage, { provider: 'vercel-blob' }), 'project-1', 'cash'), false);
  assert.equal(isPrivateReceiptForProject(receipt(storage, { sha256: 'not-a-digest' }), 'project-1', 'cash'), false);
  assert.equal(isPrivateReceiptForProject(receipt({ ...storage, bytes: 127 }), 'project-1', 'cash'), false);
});

test('receipt uploads validate JPEG, PNG, WebP and PDF magic bytes against MIME', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0xff, 0xd9]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Buffer.alloc(12);
  webp.write('RIFF', 0, 'ascii');
  webp.writeUInt32LE(4, 4);
  webp.write('WEBP', 8, 'ascii');
  const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n%%EOF\n', 'ascii');

  assert.equal(receiptBytesMatchMime(jpeg, 'image/jpeg'), true);
  assert.equal(receiptBytesMatchMime(png, 'image/png'), true);
  assert.equal(receiptBytesMatchMime(webp, 'image/webp'), true);
  assert.equal(receiptBytesMatchMime(pdf, 'application/pdf'), true);
  assert.equal(receiptBytesMatchMime(jpeg, 'image/png'), false);
  assert.equal(receiptBytesMatchMime(Buffer.from('<html>not an image</html>'), 'image/jpeg'), false);
  assert.equal(receiptBytesMatchMime(Buffer.from('<html>not a pdf</html>'), 'application/pdf'), false);
  assert.equal(receiptBytesMatchMime(Buffer.from('%PDF-invalid\n%%EOF'), 'application/pdf'), false);
  assert.equal(receiptBytesMatchMime(Buffer.from('%PDF-1.7\nmissing eof'), 'application/pdf'), false);
});

test('progress uploads also validate MP4 structure and reject renamed active content', () => {
  const mp4 = Buffer.alloc(24);
  mp4.writeUInt32BE(24, 0);
  mp4.write('ftyp', 4, 'ascii');
  mp4.write('isom', 8, 'ascii');

  assert.equal(progressBytesMatchMime(mp4, 'video/mp4'), true);
  assert.equal(progressBytesMatchMime(Buffer.from('<script>alert(1)</script>'), 'video/mp4'), false);
  assert.equal(progressBytesMatchMime(Buffer.from('<svg onload=alert(1)>'), 'image/png'), false);
  assert.equal(progressBytesMatchMime(mp4, 'application/pdf'), false);
});

test('storage reference strips provider delivery URLs and retains only private identity', () => {
  assert.deepEqual(privateReceiptStorageReference({
    provider: 'vercel-blob',
    assetId: 'https://private.blob.vercel-storage.com/path',
    pathname: 'path',
    publicId: 'path',
    resourceType: 'application',
    format: 'pdf',
    bytes: 12,
    secureUrl: 'must-not-be-persisted',
    downloadUrl: 'must-not-be-persisted',
  }, 10), {
    provider: 'vercel-blob',
    assetId: 'https://private.blob.vercel-storage.com/path',
    publicId: 'path',
    pathname: 'path',
    resourceType: 'application',
    format: 'pdf',
    bytes: 12,
    reused: false,
  });
});

test('orphan cleanup refuses an identity or digest referenced by any project receipt model', async () => {
  const storage = {
    provider: 'cloudinary',
    publicId: 'obrasaas/projects/project-1/goods-receipts/opaque-id',
    resourceType: 'image',
    format: 'jpg',
    bytes: 128,
  };
  const calls = [];
  const prisma = {
    goodsReceipt: { findFirst: async (query) => { calls.push(query); return null; } },
    cashMovement: { findFirst: async (query) => { calls.push(query); return { id: 'cash-1' }; } },
    supplierInvoice: { findFirst: async (query) => { calls.push(query); return null; } },
  };

  assert.equal(await privateReceiptIsReferenced(prisma, 'project-1', receipt(storage)), true);
  assert.equal(calls.length, 3);
  for (const query of calls) {
    assert.equal(query.where.projectId, 'project-1');
    assert.deepEqual(query.where.OR, [
      { receipt: { path: ['storage', 'publicId'], equals: storage.publicId } },
      { receipt: { path: ['sha256'], equals: digest } },
    ]);
  }

  const unlinked = {
    goodsReceipt: { findFirst: async () => null },
    cashMovement: { findFirst: async () => null },
    supplierInvoice: { findFirst: async () => null },
  };
  assert.equal(await privateReceiptIsReferenced(unlinked, 'project-1', receipt(storage)), false);
});

test('server-side receipt response is private, nosniff, sandboxed and size-bound', async () => {
  const storage = {
    provider: 'cloudinary',
    publicId: 'obrasaas/projects/project-1/cash-receipts/opaque-id',
    resourceType: 'raw',
    format: 'pdf',
    bytes: 3,
  };
  const media = receipt(storage, { filename: 'factura ñ.pdf', size: 3 });
  const response = privateReceiptFileResponse(media, {
    stream: new Blob(['abc']).stream(),
    size: 3,
    contentType: 'text/html',
  });

  assert.equal(await response.text(), 'abc');
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /filename\*=UTF-8''/);
  assert.throws(() => privateReceiptFileResponse(media, {
    stream: new Blob(['abcd']).stream(),
    size: 4,
  }), /size does not match/);
});

test('server-side progress response is private, type-bound and never returns a descriptor', async () => {
  const media = {
    mimeType: 'image/jpeg',
    filename: 'avance.jpg',
    size: 3,
  };
  const response = progressEvidenceFileResponse(media, {
    stream: new Blob(['abc']).stream(),
    size: 3,
    contentType: 'image/jpeg',
  });
  assert.equal(await response.text(), 'abc');
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.throws(() => progressEvidenceFileResponse(media, {
    stream: new Blob(['abc']).stream(),
    size: 3,
    contentType: 'text/html',
  }), /type does not match/);
});

test('receipt endpoints use the configurable adapter and never emit provider URLs', async () => {
  const uploadRoutes = [
    '../src/app/api/goods-receipts/evidence/route.js',
    '../src/app/api/cash-movements/receipt/route.js',
    '../src/app/api/supplier-invoices/evidence/route.js',
  ];
  const deliveryRoutes = [
    '../src/app/api/goods-receipts/[receiptId]/receipt/route.js',
    '../src/app/api/cash-movements/[movementId]/receipt/route.js',
    '../src/app/api/supplier-invoices/[invoiceId]/receipt/route.js',
  ];

  for (const path of uploadRoutes) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /from '@\/lib\/protected-uploads'/);
    assert.doesNotMatch(source, /from '@\/lib\/cloudinary'/);
    assert.match(source, /export async function DELETE/);
    assert.match(source, /stageProtectedUpload/);
    assert.match(source, /deleteProtectedUpload/);
    assert.match(source, /normalizeProtectedUploadIdempotencyKey/);
    assert.match(source, /receiptBytesMatchMime\(bytes, file\.type\)/);
    assert.match(source, /_CONTENT_INVALID["']/);
    assert.match(source, /\{ uploadId: result\.uploadId \}/);
    assert.doesNotMatch(source, /\{ receipt \}/);
    assert.doesNotMatch(source, /error\.message/);
  }
  for (const path of deliveryRoutes) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /readProtectedFile/);
    assert.match(source, /privateReceiptFileResponse/);
    assert.doesNotMatch(source, /cloudinaryPrivateDownloadUrl|expiresInSeconds/);
  }

  const clients = [
    '../src/app/dashboard/purchases/receipt-client.js',
    '../src/app/dashboard/cash/cash-client.js',
    '../src/app/dashboard/payables/payables-client.js',
  ];
  for (const path of clients) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /discardProtectedUploadAttempt/);
    assert.match(source, /protectedUploadAttemptForPayload/);
    assert.match(source, /rememberProtectedUploadId/);
    assert.match(source, /isTerminalProtectedUploadClientError\(error\)/);
  }

  const domains = [
    '../src/lib/goods-receipts.js',
    '../src/lib/cash-movements.js',
    '../src/lib/supplier-invoices.js',
  ];
  for (const path of domains) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /claimProtectedUpload/);
    assert.match(source, /assertProtectedUploadReplay/);
    assert.match(source, /_DESCRIPTOR_FORBIDDEN/);
    assert.match(source, /publicProtectedAttachment/);
    assert.doesNotMatch(source, /receipt\(input\.receipt, current\.projectId\)/);
    assert.doesNotMatch(source, /value\.provider !== ["']cloudinary["']/);
  }
});
