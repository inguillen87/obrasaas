import { isPrivateVercelBlobUrl } from './storage.js';
import { MAX_PROTECTED_UPLOAD_BYTES } from './protected-upload-policy.js';

const STORAGE_PROVIDERS = new Set(['cloudinary', 'vercel-blob']);
const CLOUDINARY_RESOURCE_TYPES = new Set(['image', 'raw']);
const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const RECEIPT_FOLDERS = Object.freeze({
  cash: 'cash-receipts',
  goods: 'goods-receipts',
  supplier: 'supplier-invoices',
});
const PROGRESS_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'application/pdf',
]);
const VISUAL_PROGRESS_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function startsWithBytes(buffer, signature) {
  return buffer.length >= signature.length
    && signature.every((byte, index) => buffer[index] === byte);
}

export function receiptBytesMatchMime(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  if (mimeType === 'image/jpeg') {
    return startsWithBytes(buffer, [0xff, 0xd8, 0xff])
      && buffer.length >= 4
      && buffer.at(-2) === 0xff
      && buffer.at(-1) === 0xd9;
  }
  if (mimeType === 'image/png') {
    return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === 'image/webp') {
    if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return false;
    return buffer.readUInt32LE(4) + 8 === buffer.length;
  }
  if (mimeType === 'application/pdf') {
    const header = buffer.subarray(0, 8).toString('ascii');
    if (!/^%PDF-[12]\.[0-9]/.test(header)) return false;
    return buffer.subarray(Math.max(0, buffer.length - 1_024)).includes(Buffer.from('%%EOF'));
  }
  return false;
}

export function progressBytesMatchMime(buffer, mimeType) {
  if (receiptBytesMatchMime(buffer, mimeType)) return true;
  if (!Buffer.isBuffer(buffer) || mimeType !== 'video/mp4' || buffer.length < 12) return false;
  const firstBoxSize = buffer.readUInt32BE(0);
  return buffer.toString('ascii', 4, 8) === 'ftyp'
    && firstBoxSize >= 12
    && firstBoxSize <= buffer.length;
}

function projectPrefix(projectId, kind) {
  const folder = RECEIPT_FOLDERS[kind];
  if (!folder || typeof projectId !== 'string' || !projectId.trim()) return null;
  return `obrasaas/projects/${projectId}/${folder}/`;
}

function isSafePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 1_024
    && !value.includes('\\')
    && !value.includes('\0')
    && !value.split('/').includes('..');
}

function vercelIdentityMatches(storage) {
  if (!isSafePath(storage.pathname)) return false;
  if (!storage.assetId) return true;
  if (!isPrivateVercelBlobUrl(storage.assetId)) return false;
  try {
    const pathname = decodeURIComponent(new URL(storage.assetId).pathname.replace(/^\/+/, ''));
    return pathname === storage.pathname;
  } catch {
    return false;
  }
}

function cloudinaryIdentityMatches(storage, { allowVideo = false } = {}) {
  return isSafePath(storage.publicId)
    && (CLOUDINARY_RESOURCE_TYPES.has(storage.resourceType) || (allowVideo && storage.resourceType === 'video'))
    && typeof storage.format === 'string'
    && /^[a-z0-9]{1,16}$/.test(storage.format);
}

export function protectedStorageBelongsToPrefix(storage, prefix, options = {}) {
  if (!isSafePath(prefix) || !prefix.endsWith('/') || !storage || !STORAGE_PROVIDERS.has(storage.provider)) return false;
  if (storage.provider === 'vercel-blob') {
    return vercelIdentityMatches(storage) && storage.pathname.startsWith(prefix);
  }
  return cloudinaryIdentityMatches(storage, options) && storage.publicId.startsWith(prefix);
}

export function privateReceiptStorageReference(upload, fallbackBytes) {
  if (!upload || !STORAGE_PROVIDERS.has(upload.provider)) {
    throw new Error('Protected receipt storage returned an unsupported provider.');
  }
  return {
    provider: upload.provider,
    assetId: upload.assetId || null,
    publicId: upload.publicId || null,
    pathname: upload.pathname || null,
    resourceType: upload.resourceType || null,
    format: upload.format || null,
    bytes: Number.isSafeInteger(upload.bytes) ? upload.bytes : fallbackBytes,
    reused: upload.reused === true,
  };
}

export function privateReceiptStorageBelongsToProject(storage, projectId, kind) {
  const prefix = projectPrefix(projectId, kind);
  return Boolean(prefix) && protectedStorageBelongsToPrefix(storage, prefix);
}

export function protectedStorageLookup(storage) {
  if (storage?.provider === 'vercel-blob' && isSafePath(storage.pathname)) {
    return { path: ['storage', 'pathname'], value: storage.pathname };
  }
  if (storage?.provider === 'cloudinary' && isSafePath(storage.publicId)) {
    return { path: ['storage', 'publicId'], value: storage.publicId };
  }
  return null;
}

export const privateReceiptStorageLookup = protectedStorageLookup;

function progressMediaShape(media, { visualOnly = false } = {}) {
  if (!media || typeof media !== 'object' || Array.isArray(media)) return false;
  const allowedMimeTypes = visualOnly ? VISUAL_PROGRESS_MIME_TYPES : PROGRESS_MIME_TYPES;
  return media.visibility === 'private'
    && allowedMimeTypes.has(media.mimeType)
    && typeof media.filename === 'string'
    && Boolean(media.filename.trim())
    && media.filename.length <= 255
    && Number.isSafeInteger(media.size)
    && media.size > 0
    && media.size <= MAX_PROTECTED_UPLOAD_BYTES
    && SHA256_PATTERN.test(String(media.sha256 || '').toLowerCase())
    && media.provider === media.storage?.provider
    && media.storage?.bytes === media.size;
}

export function isDashboardProgressMediaForProject(media, projectId, options = {}) {
  if (!progressMediaShape(media, options)) return false;
  return protectedStorageBelongsToPrefix(
    media.storage,
    `obrasaas/projects/${projectId}/progress/`,
    { allowVideo: true },
  );
}

export function isWhatsAppProgressMediaForProject({
  media,
  sourceMessage,
  connection,
  projectId,
}) {
  const metadata = sourceMessage?.metadata;
  const sourceMedia = metadata?.media;
  const phoneNumberId = String(connection?.phoneNumberId || '').trim();
  if (
    !media
    || media.source !== 'whatsapp-message'
    || media.kind !== 'image'
    || !VISUAL_PROGRESS_MIME_TYPES.has(media.mimeType)
    || typeof media.filename !== 'string'
    || !media.filename.trim()
    || media.filename.length > 255
    || !Number.isSafeInteger(media.size)
    || media.size < 1
    || media.size > 20 * 1024 * 1024
    || !SHA256_PATTERN.test(String(media.sha256 || '').toLowerCase())
    || connection?.projectId !== projectId
    || connection?.enabled !== true
    || !/^\d{5,40}$/.test(phoneNumberId)
    || sourceMessage?.direction !== 'INBOUND'
    || sourceMessage?.kind !== 'IMAGE'
    || sourceMessage?.conversation?.projectId !== projectId
    || sourceMessage?.conversation?.channel !== 'whatsapp'
    || !String(sourceMessage?.conversation?.externalId || '').startsWith('meta:')
    || !metadata
    || metadata.provider !== 'meta'
    || metadata.authorized !== true
    || metadata.quarantined === true
    || String(metadata.phoneNumberId || '') !== phoneNumberId
    || !sourceMedia
    || sourceMedia.storage?.status !== 'stored'
    || sourceMessage.mediaUrl !== sourceMedia.url
    || sourceMedia.mimeType !== media.mimeType
    || sourceMedia.filename !== media.filename
    || sourceMedia.size !== media.size
    || String(sourceMedia.sha256 || '').toLowerCase() !== String(media.sha256).toLowerCase()
    || sourceMedia.storage?.bytes !== media.size
  ) return false;
  return protectedStorageBelongsToPrefix(
    sourceMedia.storage,
    `obrasaas/whatsapp/${phoneNumberId}/`,
  );
}

export async function privateReceiptIsReferenced(prisma, projectId, receipt) {
  const identity = protectedStorageLookup(receipt?.storage);
  if (!identity || typeof receipt?.sha256 !== 'string') return false;
  const where = {
    projectId,
    OR: [
      { receipt: { path: identity.path, equals: identity.value } },
      { receipt: { path: ['sha256'], equals: receipt.sha256 } },
    ],
  };
  const [goods, cash, supplier] = await Promise.all([
    prisma.goodsReceipt.findFirst({ where, select: { id: true } }),
    prisma.cashMovement.findFirst({ where, select: { id: true } }),
    prisma.supplierInvoice.findFirst({ where, select: { id: true } }),
  ]);
  return Boolean(goods || cash || supplier);
}

export function isPrivateReceiptForProject(receipt, projectId, kind) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  if (receipt.visibility !== 'private' || !STORAGE_PROVIDERS.has(receipt.provider)) return false;
  if (!RECEIPT_MIME_TYPES.has(receipt.mimeType)) return false;
  if (typeof receipt.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.sha256)) return false;
  if (!Number.isSafeInteger(receipt.size) || receipt.size < 1 || receipt.size > MAX_PROTECTED_UPLOAD_BYTES) return false;
  if (!Number.isSafeInteger(receipt.storage?.bytes) || receipt.storage.bytes !== receipt.size) return false;
  if (typeof receipt.filename !== 'string' || !receipt.filename.trim() || receipt.filename.length > 255) return false;
  if (receipt.provider !== receipt.storage?.provider) return false;
  return privateReceiptStorageBelongsToProject(receipt.storage, projectId, kind);
}

function safeContentDisposition(filename) {
  const fallback = String(filename || 'comprobante')
    .replace(/[^\x20-\x7e]+/g, '_')
    .replace(/["\\;\r\n]/g, '_')
    .slice(0, 120) || 'comprobante';
  const encoded = encodeURIComponent(filename || 'comprobante')
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function privateReceiptFileResponse(receipt, downloaded) {
  if (!downloaded?.stream) throw new Error('Protected receipt file is unavailable.');
  if (Number.isSafeInteger(downloaded.size) && downloaded.size !== receipt.size) {
    throw new Error('Protected receipt size does not match its stored metadata.');
  }
  const contentType = RECEIPT_MIME_TYPES.has(receipt?.mimeType)
    ? receipt.mimeType
    : 'application/octet-stream';
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': safeContentDisposition(receipt?.filename),
    'Content-Security-Policy': "sandbox; default-src 'none';",
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (Number.isSafeInteger(downloaded.size) && downloaded.size >= 0) {
    headers.set('Content-Length', String(downloaded.size));
  }
  return new Response(downloaded.stream, { status: 200, headers });
}

export function progressEvidenceFileResponse(media, downloaded) {
  if (!downloaded?.stream) throw new Error('Protected progress evidence is unavailable.');
  if (Number.isSafeInteger(downloaded.size) && downloaded.size !== media.size) {
    throw new Error('Protected progress evidence size does not match its stored metadata.');
  }
  const downloadedType = String(downloaded.contentType || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (downloadedType && downloadedType !== media.mimeType) {
    throw new Error('Protected progress evidence type does not match its stored metadata.');
  }
  const contentType = PROGRESS_MIME_TYPES.has(media?.mimeType)
    ? media.mimeType
    : 'application/octet-stream';
  const headers = new Headers({
    'Cache-Control': 'private, no-store, max-age=0',
    'Content-Disposition': safeContentDisposition(media?.filename || 'evidencia'),
    'Content-Security-Policy': "sandbox; default-src 'none';",
    'Content-Type': contentType,
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff',
  });
  if (Number.isSafeInteger(downloaded.size) && downloaded.size >= 0) {
    headers.set('Content-Length', String(downloaded.size));
  }
  return new Response(downloaded.stream, { status: 200, headers });
}
