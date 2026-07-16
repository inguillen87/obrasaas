import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloudinaryPrivateDownloadUrl,
  downloadProtectedFile,
  uploadProtectedFile,
} from '../src/lib/cloudinary.js';

function withCloudinaryEnvironment(run) {
  const previous = {
    url: process.env.CLOUDINARY_URL,
    cloud: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY,
    secret: process.env.CLOUDINARY_API_SECRET,
  };
  delete process.env.CLOUDINARY_URL;
  process.env.CLOUDINARY_CLOUD_NAME = 'obrasaas-test';
  process.env.CLOUDINARY_API_KEY = 'public-api-key';
  process.env.CLOUDINARY_API_SECRET = 'server-only-secret';
  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previous.url === undefined) delete process.env.CLOUDINARY_URL;
      else process.env.CLOUDINARY_URL = previous.url;
      if (previous.cloud === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
      else process.env.CLOUDINARY_CLOUD_NAME = previous.cloud;
      if (previous.key === undefined) delete process.env.CLOUDINARY_API_KEY;
      else process.env.CLOUDINARY_API_KEY = previous.key;
      if (previous.secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
      else process.env.CLOUDINARY_API_SECRET = previous.secret;
    });
}

test('Cloudinary authenticated uploads use deterministic non-overwriting identities', () => withCloudinaryEnvironment(async () => {
  let request;
  const file = new File(['%PDF-1.7 certificate'], 'certificado.pdf', {
    type: 'application/pdf',
  });
  const stored = await uploadProtectedFile(file, {
    folder: 'obrasaas/medical-certificates',
    idempotencyKey: 'medical-certificate:v1:stable',
    resourceType: 'raw',
    now: 1_750_000_000_000,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return Response.json({
        asset_id: 'asset-1',
        public_id: 'obrasaas/medical-certificates/opaque.pdf',
        resource_type: 'raw',
        format: 'pdf',
        bytes: file.size,
        secure_url: 'https://res.cloudinary.com/obrasaas-test/raw/authenticated/opaque.pdf',
        existing: false,
      });
    },
  });

  assert.match(request.url, /\/raw\/upload$/);
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.body.get('type'), 'authenticated');
  assert.equal(request.init.body.get('overwrite'), 'false');
  assert.equal(request.init.body.get('unique_filename'), 'false');
  assert.match(
    request.init.body.get('public_id'),
    /^obrasaas\/medical-certificates\/[a-f0-9]{40}\.pdf$/,
  );
  assert.equal(request.init.body.get('api_key'), 'public-api-key');
  assert.match(request.init.body.get('signature'), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(request.init.body.get('signature'), /server-only-secret/);
  assert.equal(stored.resourceType, 'raw');
  assert.equal(stored.reused, false);
}));

test('Cloudinary protected delivery is server-signed, short-lived and proxyable', () => withCloudinaryEnvironment(async () => {
  const storage = {
    publicId: 'obrasaas/medical-certificates/opaque.pdf',
    resourceType: 'raw',
    format: 'pdf',
  };
  const signedUrl = cloudinaryPrivateDownloadUrl(storage, { now: 1_750_000_000_000 });
  const parsed = new URL(signedUrl);
  assert.match(parsed.pathname, /\/raw\/download$/);
  assert.equal(parsed.searchParams.get('type'), 'authenticated');
  assert.equal(
    Number(parsed.searchParams.get('expires_at')) - Number(parsed.searchParams.get('timestamp')),
    60,
  );
  assert.match(parsed.searchParams.get('signature'), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(signedUrl, /server-only-secret/);

  let fetchedUrl;
  const downloaded = await downloadProtectedFile(storage, {
    now: 1_750_000_000_000,
    fetchImpl: async (url) => {
      fetchedUrl = url;
      return new Response('private certificate', {
        headers: {
          'content-length': '19',
          'content-type': 'application/pdf',
        },
      });
    },
  });
  assert.equal(fetchedUrl, signedUrl);
  assert.equal(downloaded.size, 19);
  assert.equal(downloaded.contentType, 'application/pdf');
  assert.ok(downloaded.stream);
}));

test('Cloudinary delivery fails closed when the stored protected identity is incomplete', () => withCloudinaryEnvironment(() => {
  assert.throws(
    () => cloudinaryPrivateDownloadUrl({ publicId: 'asset-without-resource-type', format: 'pdf' }),
    /unsupported resource type/,
  );
}));
