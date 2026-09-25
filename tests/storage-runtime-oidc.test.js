import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProtectedStorageProvider } from '../src/lib/storage.js';
const keys = ['VERCEL','BLOB_STORE_ID','BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN','PRIVATE_MEDIA_PROVIDER','CLOUDINARY_URL','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'];
function environment(values, action) {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    for (const [key,value] of Object.entries(values)) process.env[key] = value;
    return action();
  } finally {
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
}
test('Vercel runtime connected-store config allows SDK-managed OIDC without an exported token', () => {
  environment({ VERCEL:'1', BLOB_STORE_ID:'store_synthetic_preview' }, () => {
    assert.equal(resolveProtectedStorageProvider(), 'vercel-blob');
    assert.equal(process.env.VERCEL_OIDC_TOKEN, undefined);
    assert.equal(process.env.BLOB_READ_WRITE_TOKEN, undefined);
  });
});
test('a store ID alone does not imply local authentication', () => {
  environment({ BLOB_STORE_ID:'store_synthetic_preview' }, () => assert.throws(() => resolveProtectedStorageProvider()));
});
test('an empty connected-store variable does not enable storage', () => {
  environment({ VERCEL:'1', BLOB_STORE_ID:'   ' }, () => assert.throws(() => resolveProtectedStorageProvider()));
});
test('explicit Blob selection works with its connected runtime store', () => {
  environment({ VERCEL:'1', BLOB_STORE_ID:'store_synthetic_preview', PRIVATE_MEDIA_PROVIDER:'vercel-blob' }, () => assert.equal(resolveProtectedStorageProvider(), 'vercel-blob'));
});
for (const key of ['BLOB_READ_WRITE_TOKEN','VERCEL_OIDC_TOKEN']) test('existing explicit credential path remains available: ' + key, () => {
  environment({ [key]:'synthetic-not-a-real-credential' }, () => assert.equal(resolveProtectedStorageProvider(), 'vercel-blob'));
});
test('explicit unconfigured alternative never falls through to Blob', () => {
  environment({ VERCEL:'1', BLOB_STORE_ID:'store_synthetic_preview', PRIVATE_MEDIA_PROVIDER:'cloudinary' }, () => assert.throws(() => resolveProtectedStorageProvider()));
});
test('unsupported provider is still rejected', () => {
  environment({ VERCEL:'1', BLOB_STORE_ID:'store_synthetic_preview', PRIVATE_MEDIA_PROVIDER:'unknown' }, () => assert.throws(() => resolveProtectedStorageProvider()));
});
