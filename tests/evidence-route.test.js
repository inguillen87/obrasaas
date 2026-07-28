import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:clerk-nextjs-server') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const { createEvidenceHandlers } = await import(
  '../src/app/api/evidence/[messageId]/route.js'
);
const {
  WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT,
  whatsAppMediaAssetHash,
} = await import('../src/lib/whatsapp/media-assets.js');

const ACCESS = Object.freeze({
  organization: { id: 'org-a' },
  project: { id: 'project-a' },
});
const MANAGED_PATH = 'obrasaas/projects/project-a/whatsapp/1225843560610854/asset.jpg';
const MANAGED_URL = `https://tenant.private.blob.vercel-storage.com/${MANAGED_PATH}`;
const PROVIDER_MESSAGE_ID = 'wamid.message-secret-1';
const FILE_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

function locatorHash(pathname = MANAGED_PATH) {
  return whatsAppMediaAssetHash(JSON.stringify({
    path: ['storage', 'pathname'],
    provider: 'vercel-blob',
    value: pathname,
  }));
}

function managedAsset(overrides = {}) {
  return {
    id: 'media-asset-1',
    organizationId: ACCESS.organization.id,
    projectId: ACCESS.project.id,
    webhookEventId: 'webhook-event-1',
    status: 'CLAIMED',
    mediaKind: 'IMAGE',
    declaredMimeType: 'image/jpeg',
    storageProvider: 'vercel-blob',
    storage: {
      provider: 'vercel-blob',
      assetId: MANAGED_URL,
      publicId: MANAGED_PATH,
      pathname: MANAGED_PATH,
      resourceType: 'image',
      format: 'jpg',
      bytes: FILE_BYTES.byteLength,
      reused: false,
    },
    storageLocatorHash: locatorHash(),
    fileName: 'pared.jpg',
    mimeType: 'image/jpeg',
    contentSha256: 'a'.repeat(64),
    sizeBytes: FILE_BYTES.byteLength,
    messageConversationId: 'conversation-1',
    messageId: 'message-1',
    claimFingerprint: 'b'.repeat(64),
    providerMessageIdHash: whatsAppMediaAssetHash(PROVIDER_MESSAGE_ID),
    providerMediaIdHash: 'c'.repeat(64),
    ...overrides,
  };
}

function messageFixture(overrides = {}) {
  return {
    id: 'message-1',
    conversationId: 'conversation-1',
    direction: 'INBOUND',
    externalId: PROVIDER_MESSAGE_ID,
    kind: 'IMAGE',
    body: 'Avance de pared',
    mediaUrl: null,
    metadata: {
      media: {
        assetId: 'media-asset-1',
        filename: 'legacy-secret-name.pdf',
        mimeType: 'application/pdf',
        storage: {
          provider: 'cloudinary',
          publicId: 'legacy/provider/secret-path',
          resourceType: 'raw',
          format: 'pdf',
        },
      },
    },
    whatsappMediaAsset: managedAsset(),
    ...overrides,
  };
}

function byteStream(bytes = FILE_BYTES) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

function request(search = '?preview=1') {
  return new Request(`https://app.obrasaas.test/api/evidence/message-1${search}`);
}

function routeContext() {
  return { params: Promise.resolve({ messageId: 'message-1' }) };
}

function harness({
  message = messageFixture(),
  readResult = {
    stream: byteStream(),
    size: FILE_BYTES.byteLength,
    contentType: 'image/jpeg; charset=binary',
  },
  readFile,
  reportFailure,
} = {}) {
  const effects = {
    authorizations: [],
    queries: [],
    reads: [],
    reports: [],
  };
  const handlers = createEvidenceHandlers({
    async resolveAccess() {
      return ACCESS;
    },
    authorize(_access, permission) {
      effects.authorizations.push(permission);
    },
    prismaFactory() {
      return {
        message: {
          async findFirst(query) {
            effects.queries.push(query);
            return message;
          },
        },
      };
    },
    async readFile(storage) {
      effects.reads.push(storage);
      if (readFile) return readFile(storage);
      return readResult;
    },
    reportFailure(...args) {
      effects.reports.push(args);
      if (reportFailure) return reportFailure(...args);
      return undefined;
    },
  });
  return { effects, handlers };
}

async function responseSurface(response) {
  const headers = [...response.headers.entries()]
    .map(([name, value]) => `${name}:${value}`)
    .join('\n');
  const body = Buffer.from(await response.arrayBuffer()).toString('latin1');
  return `${headers}\n${body}`;
}

test('managed evidence reads only the CLAIMED descriptor and exposes no provider locator', async () => {
  const message = messageFixture();
  const { effects, handlers } = harness({ message });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('content-length'), String(FILE_BYTES.byteLength));
  assert.equal(response.headers.get('content-disposition'), 'inline; filename="pared.jpg"');
  assert.equal(response.headers.get('content-security-policy'), 'sandbox');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(effects.authorizations, [
    'org:projects:read',
    'org:field:evidence:read',
  ]);
  assert.equal(effects.reads.length, 1);
  assert.equal(effects.reads[0].provider, 'vercel-blob');
  assert.equal(effects.reads[0].pathname, MANAGED_PATH);
  assert.notEqual(effects.reads[0], message.metadata.media.storage);
  assert.deepEqual(
    effects.queries[0].select.whatsappMediaAsset,
    { select: WHATSAPP_MEDIA_ASSET_DESCRIPTOR_SELECT },
  );
  assert.equal(effects.queries[0].select.conversationId, true);

  const surface = await responseSurface(response);
  assert.doesNotMatch(surface, /tenant\.private\.blob/i);
  assert.doesNotMatch(surface, /obrasaas\/projects\/project-a\/whatsapp/i);
  assert.doesNotMatch(surface, /vercel-blob|cloudinary|legacy-secret|secret-path/i);
});

test('a linked asset outside the exact CLAIMED state never falls back to legacy media', async () => {
  const message = messageFixture({
    mediaUrl: 'https://private.blob.vercel-storage.com/legacy-secret.jpg',
    whatsappMediaAsset: managedAsset({ status: 'AVAILABLE' }),
  });
  const { effects, handlers } = harness({ message });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Evidence not found' });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(effects.reads, []);
});

test('an assetId marker without a durable relation fails closed instead of using legacy storage', async () => {
  const message = messageFixture({
    mediaUrl: 'https://private.blob.vercel-storage.com/legacy-secret.jpg',
    whatsappMediaAsset: null,
  });
  const { effects, handlers } = harness({ message });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Evidence not found' });
  assert.deepEqual(effects.reads, []);
});

test('legacy storage remains readable only when both relation and assetId marker are absent', async () => {
  const legacyStorage = {
    provider: 'cloudinary',
    publicId: 'legacy/project-a/evidence-1',
    resourceType: 'image',
    format: 'jpg',
  };
  const message = messageFixture({
    mediaUrl: 'legacy-private-reference',
    metadata: {
      media: {
        filename: 'legacy-pared.jpg',
        mimeType: 'image/jpeg',
        storage: legacyStorage,
      },
    },
    whatsappMediaAsset: null,
  });
  const { effects, handlers } = harness({ message });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-disposition'), 'inline; filename="legacy-pared.jpg"');
  assert.equal(effects.reads.length, 1);
  assert.equal(effects.reads[0], legacyStorage);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(FILE_BYTES));
});

test('a linked durable asset rejects an inconsistent metadata assetId marker', async () => {
  const message = messageFixture({
    metadata: {
      media: {
        assetId: 'another-media-asset',
        storage: {
          provider: 'cloudinary',
          publicId: 'legacy/secret',
        },
      },
    },
  });
  const { effects, handlers } = harness({ message });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Evidence not found' });
  assert.deepEqual(effects.reads, []);
});

test('managed evidence verifies provider MIME and size after reading and cancels mismatches', async () => {
  const cases = [
    { size: FILE_BYTES.byteLength + 1, contentType: 'image/jpeg' },
    { size: FILE_BYTES.byteLength, contentType: 'image/png' },
    { size: null, contentType: 'image/jpeg' },
  ];

  for (const observed of cases) {
    const cancellations = [];
    const stream = {
      cancel(reason) {
        cancellations.push(reason);
      },
    };
    const { effects, handlers } = harness({
      readResult: { stream, ...observed },
    });
    const response = await handlers.GET(request(), routeContext());

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Evidence not found' });
    assert.equal(effects.reads.length, 1);
    assert.equal(cancellations.length, 1);
  }
});

test('unexpected delivery failures are reported without secret-bearing error arguments', async () => {
  const secret = 'https://tenant.private.blob.vercel-storage.com/secret/provider/path.jpg';
  const { effects, handlers } = harness({
    async readFile() {
      throw new Error(secret);
    },
  });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(effects.reports, [[]]);
  const surface = await responseSurface(response);
  assert.doesNotMatch(surface, /tenant\.private\.blob|secret\/provider\/path/i);
});

test('a query result that omits the durable relation fails closed', async () => {
  const message = messageFixture();
  delete message.whatsappMediaAsset;
  const { effects, handlers } = harness({ message });
  const response = await handlers.GET(request(), routeContext());

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Evidence not found' });
  assert.deepEqual(effects.reads, []);
});
