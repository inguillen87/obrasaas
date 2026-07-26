import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloudinaryPrivateDownloadUrl,
  downloadProtectedFile,
  protectedCloudinaryUploadIdentity,
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

test('Cloudinary deterministic identities derive a bounded format from verified MIME', () => {
  const identity = protectedCloudinaryUploadIdentity(
    new File(['image'], 'avance.extension-demasiado-larga-y-no-confiable', {
      type: 'image/jpeg',
    }),
    {
      folder: 'obrasaas/projects/project-1/progress',
      idempotencyKey: 'protected-upload:v1:stable-format',
      resourceType: 'image',
    },
  );

  assert.equal(identity.format, 'jpg');
  assert.match(identity.publicId, /^obrasaas\/projects\/project-1\/progress\/[a-f0-9]{40}$/);
});

test('Cloudinary reconciles a deterministic asset after an upload response is lost', () => withCloudinaryEnvironment(async () => {
  const file = new File(['%PDF-1.7 certificate'], 'certificado.pdf', {
    type: 'application/pdf',
  });
  let requestedPublicId;
  const calls = [];
  const stored = await uploadProtectedFile(file, {
    folder: 'obrasaas/medical-certificates',
    idempotencyKey: 'medical-certificate:v1:response-loss',
    resourceType: 'raw',
    fetchImpl: async (url, init = {}) => {
      calls.push({ url, init });
      if (/\/raw\/upload$/.test(url)) {
        requestedPublicId = init.body.get('public_id');
        assert.equal(init.body.get('overwrite'), 'false');
        throw new TypeError('response lost after provider commit');
      }
      assert.match(url, /\/resources\/raw\/authenticated\//);
      assert.ok(url.includes(encodeURIComponent(requestedPublicId)));
      return Response.json({
        asset_id: 'asset-existing',
        public_id: requestedPublicId,
        resource_type: 'raw',
        format: 'pdf',
        bytes: file.size,
        existing: true,
      });
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(stored.publicId, requestedPublicId);
  assert.equal(stored.bytes, file.size);
  assert.equal(stored.reused, true);
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
