import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:clerk-nextjs-server', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:next-headers', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
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
    return nextLoad(url, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = 'postgresql://unit-test.invalid/obrasaas';

const [
  { AccessError },
  { ProjectWritePolicyError },
  { serializeProgressEvidence },
  {
    linkWhatsAppMessageToProgressEvidence,
    WhatsAppProgressEvidenceError,
  },
  { createWhatsAppProgressEvidenceHandlers },
] = await Promise.all([
  import('../src/lib/access.js'),
  import('../src/lib/project-write-policy.js'),
  import('../src/lib/progress-journal.js'),
  import('../src/lib/whatsapp/progress-evidence.js'),
  import('../src/app/api/whatsapp/inbox/[conversationId]/messages/[messageId]/progress-evidence/route.js'),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  delete globalThis.__obraSaasPrisma;
});

const NOW = new Date('2026-07-26T18:00:00.000Z');
const CAPTURED_AT = new Date('2026-07-26T17:45:00.000Z');
const SHA256 = 'a'.repeat(64);
const PHONE_NUMBER_ID = '1225843560610854';

function sourceMedia(overrides = {}) {
  const media = {
    id: 'meta-media-a',
    kind: 'image',
    mimeType: 'image/jpeg',
    filename: 'pared-norte.jpg',
    sha256: SHA256,
    size: 4_096,
    url: 'https://private.example.test/source-a',
    storage: {
      provider: 'cloudinary',
      status: 'stored',
      assetId: 'asset-secret-a',
      publicId: `obrasaas/whatsapp/${PHONE_NUMBER_ID}/source-a`,
      resourceType: 'image',
      format: 'jpg',
      bytes: 4_096,
    },
    ...overrides,
  };
  return media;
}

function sourceMessage(overrides = {}) {
  const media = overrides.metadata?.media || sourceMedia();
  return {
    id: 'message-a',
    externalId: 'wamid.source-a',
    conversationId: 'conversation-a',
    direction: 'INBOUND',
    kind: 'IMAGE',
    body: 'Pared norte a medio terminar',
    mediaUrl: media.url,
    metadata: {
      provider: 'meta',
      authorized: true,
      phoneNumberId: PHONE_NUMBER_ID,
      workerId: 'worker-a',
      workerRole: 'FIELD_WORKER',
      sourceContentRestricted: true,
      sensitivity: 'restricted',
      media,
      ...(overrides.metadata || {}),
    },
    sentAt: CAPTURED_AT,
    createdAt: CAPTURED_AT,
    conversation: {
      id: 'conversation-a',
      projectId: 'project-a',
      channel: 'whatsapp',
      externalId: 'meta:5491111111111',
    },
    ...overrides,
  };
}

function access(overrides = {}) {
  return {
    databaseUserId: 'actor-a',
    organization: { id: 'organization-a' },
    project: { id: 'project-a', organizationId: 'organization-a' },
    subscription: { canRead: true, canWrite: true },
    ...overrides,
  };
}

function fakePrisma({
  message = sourceMessage(),
  messageProjectId = 'project-a',
  messageOrganizationId = 'organization-a',
  projectStatus = 'ACTIVE',
  subscriptionStatus = 'ACTIVE',
  worker = { id: 'worker-a', active: true },
  tasks = [{ id: 'task-a', progress: 37 }, { id: 'task-b', progress: 12 }],
  auditFailure = null,
  p2002Once = false,
} = {}) {
  const calls = [];
  const evidence = [];
  const audits = [];
  let injectP2002 = p2002Once;
  let competingRow = null;

  const transaction = {
    async $executeRawUnsafe(statement, projectId) {
      calls.push(['project-lock', statement, projectId]);
      return 1;
    },
    project: {
      async findFirst(args) {
        calls.push(['project-read', args]);
        return args.where.id === 'project-a'
          && args.where.organizationId === 'organization-a'
          ? { id: 'project-a', organizationId: 'organization-a', status: projectStatus }
          : null;
      },
    },
    organization: {
      async findUnique(args) {
        calls.push(['organization-read', args]);
        return args.where.id === 'organization-a'
          ? {
              id: 'organization-a',
              subscriptionPlan: 'PRO',
              subscriptionStatus,
              trialEndsAt: null,
            }
          : null;
      },
    },
    whatsAppConnection: {
      async findFirst({ where }) {
        calls.push(['connection-find', where]);
        return where.projectId === 'project-a'
          ? { projectId: 'project-a', phoneNumberId: PHONE_NUMBER_ID, enabled: true }
          : null;
      },
    },
    message: {
      async findFirst(args) {
        calls.push(['message-read', args]);
        const where = args.where;
        if (
          where.id !== message.id
          || where.conversationId !== message.conversationId
          || where.conversation.projectId !== messageProjectId
          || where.conversation.project.organizationId !== messageOrganizationId
          || messageProjectId !== 'project-a'
          || messageOrganizationId !== 'organization-a'
        ) return null;
        return {
          ...message,
          metadata: structuredClone(message.metadata),
          conversation: { ...message.conversation },
        };
      },
    },
    task: {
      async findFirst(args) {
        calls.push(['task-read', args]);
        return tasks.find((task) => (
          task.id === args.where.id && args.where.projectId === 'project-a'
        )) || null;
      },
    },
    worker: {
      async findFirst(args) {
        calls.push(['worker-read', args]);
        return worker
          && worker.id === args.where.id
          && args.where.projectId === 'project-a'
          ? { ...worker }
          : null;
      },
    },
    progressEvidence: {
      async findFirst(args) {
        calls.push(['evidence-read-operation', args]);
        return evidence.find((item) => (
          item.projectId === args.where.projectId
          && item.sourceOperationKeyHash === args.where.sourceOperationKeyHash
        )) || null;
      },
      async findUnique(args) {
        calls.push(['evidence-read-source', args]);
        return evidence.find((item) => item.sourceMessageId === args.where.sourceMessageId) || null;
      },
      async create(args) {
        calls.push(['evidence-create', args]);
        const row = {
          id: `evidence-${evidence.length + 1}`,
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          reviewNote: null,
          revision: 0,
          reviewedAt: null,
          createdAt: NOW,
          updatedAt: NOW,
          ...structuredClone(args.data),
          capturedAt: new Date(args.data.capturedAt),
        };
        if (injectP2002) {
          injectP2002 = false;
          competingRow = row;
          throw Object.assign(new Error('unique constraint'), {
            code: 'P2002',
            meta: { target: ['sourceMessageId'] },
          });
        }
        evidence.push(row);
        return row;
      },
    },
    auditLog: {
      async create(args) {
        calls.push(['audit-create', args]);
        if (auditFailure) throw auditFailure;
        audits.push(structuredClone(args.data));
        return args.data;
      },
    },
  };

  const prisma = {
    ...transaction,
    async $transaction(callback) {
      calls.push(['transaction']);
      const evidenceBefore = evidence.slice();
      const auditsBefore = audits.slice();
      try {
        return await callback(transaction);
      } catch (error) {
        evidence.splice(0, evidence.length, ...evidenceBefore);
        audits.splice(0, audits.length, ...auditsBefore);
        if (error?.code === 'P2002' && competingRow) {
          evidence.push(competingRow);
          competingRow = null;
        }
        throw error;
      }
    },
  };
  return { prisma, calls, evidence, audits, tasks };
}

function linkInput(overrides = {}) {
  return {
    scope: { organizationId: 'organization-a', projectId: 'project-a' },
    actorId: 'actor-a',
    conversationId: 'conversation-a',
    messageId: 'message-a',
    taskId: 'task-a',
    idempotencyKey: 'progress-link-key-a',
    correlationId: 'request-a',
    clock: () => NOW,
    ...overrides,
  };
}

test('links one trusted Meta image with server-owned provenance and never mutates Gantt', async () => {
  const database = fakePrisma();

  const result = await linkWhatsAppMessageToProgressEvidence(
    database.prisma,
    linkInput(),
  );

  assert.equal(result.replayed, false);
  assert.equal(result.evidence.status, 'PENDING');
  assert.equal(result.evidence.caption, 'Pared norte a medio terminar');
  assert.equal(result.evidence.capturedAt, CAPTURED_AT.toISOString());
  assert.deepEqual(result.evidence.source, {
    channel: 'whatsapp',
    conversationId: 'conversation-a',
    messageId: 'message-a',
  });
  assert.equal(result.evidence.attachment.href, '/api/evidence/message-a');
  assert.equal(Object.hasOwn(result.evidence, 'media'), false);
  assert.equal(database.evidence.length, 1);
  assert.deepEqual(database.evidence[0].media, {
    schemaVersion: 1,
    source: 'whatsapp-message',
    kind: 'image',
    mimeType: 'image/jpeg',
    filename: 'pared-norte.jpg',
    size: 4_096,
    sha256: SHA256,
  });
  assert.equal(database.evidence[0].latitude, null);
  assert.equal(database.evidence[0].longitude, null);
  assert.equal(database.audits.length, 1);
  assert.equal(database.audits[0].action, 'progress.evidence.linked_from_whatsapp');
  assert.equal(database.audits[0].metadata.correlationId, 'request-a');
  assert.equal(database.tasks[0].progress, 37);
  assert.equal(database.calls.some(([name]) => name.includes('update')), false);
  const publicJson = JSON.stringify(result);
  assert.doesNotMatch(publicJson, /asset-secret|project-secret|private\.example|sourceOperationKeyHash|sourceRequestFingerprint|"sha256"/);
  const auditJson = JSON.stringify(database.audits);
  assert.doesNotMatch(auditJson, /asset-secret|project-secret|private\.example|pared-norte\.jpg|Pared norte/);
});

test('replays the exact link once and rejects key or source reuse with another payload', async () => {
  const database = fakePrisma();
  const first = await linkWhatsAppMessageToProgressEvidence(database.prisma, linkInput());
  const retry = await linkWhatsAppMessageToProgressEvidence(database.prisma, linkInput());
  const samePhotoNewKey = await linkWhatsAppMessageToProgressEvidence(
    database.prisma,
    linkInput({ idempotencyKey: 'progress-link-key-b' }),
  );

  assert.equal(first.replayed, false);
  assert.equal(retry.replayed, true);
  assert.equal(samePhotoNewKey.replayed, true);
  assert.equal(database.evidence.length, 1);
  assert.equal(database.audits.length, 1);
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(
      database.prisma,
      linkInput({ taskId: 'task-b', idempotencyKey: 'progress-link-key-c' }),
    ),
    (error) => error?.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH' && error?.status === 409,
  );
});

test('reconciles a P2002 race as an exact replay without a second audit', async () => {
  const database = fakePrisma({ p2002Once: true });

  const result = await linkWhatsAppMessageToProgressEvidence(database.prisma, linkInput());

  assert.equal(result.replayed, true);
  assert.equal(database.evidence.length, 1);
  assert.equal(database.audits.length, 0);
  assert.equal(database.calls.filter(([name]) => name === 'transaction').length, 2);
});

test('fails closed for tenant, task and worker scope mismatches', async () => {
  const foreignSource = fakePrisma({ messageProjectId: 'project-foreign' });
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(foreignSource.prisma, linkInput()),
    (error) => error?.code === 'WHATSAPP_PROGRESS_EVIDENCE_NOT_FOUND'
      && error?.status === 404,
  );
  const foreignTask = fakePrisma({ tasks: [] });
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(foreignTask.prisma, linkInput()),
    (error) => error?.code === 'WHATSAPP_PROGRESS_EVIDENCE_TASK_NOT_FOUND'
      && error?.status === 404,
  );
  const foreignWorker = fakePrisma({ worker: null });
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(foreignWorker.prisma, linkInput()),
    (error) => error?.code === 'WHATSAPP_PROGRESS_EVIDENCE_SOURCE_INVALID'
      && error?.status === 422,
  );
  assert.equal(foreignSource.evidence.length, 0);
  assert.equal(foreignTask.evidence.length, 0);
  assert.equal(foreignWorker.evidence.length, 0);
});

test('rejects outbound, non-image, unenriched, non-Meta and medical sources', async () => {
  const cases = [
    sourceMessage({ direction: 'OUTBOUND' }),
    sourceMessage({ kind: 'VIDEO' }),
    sourceMessage({ metadata: { media: sourceMedia({ sha256: 'not-a-sha' }) } }),
    sourceMessage({ metadata: { provider: 'simulator' } }),
    sourceMessage({
      body: 'Adjunto certificado médico por enfermedad',
      metadata: { sensitivity: 'medical' },
    }),
  ];
  for (const candidate of cases) {
    const database = fakePrisma({ message: candidate });
    await assert.rejects(
      linkWhatsAppMessageToProgressEvidence(database.prisma, linkInput()),
      (error) => error instanceof WhatsAppProgressEvidenceError
        && [409, 422].includes(error.status),
    );
    assert.equal(database.evidence.length, 0);
    assert.equal(database.audits.length, 0);
  }
});

test('accepts an inactive historical author but revalidates project and subscription writes', async () => {
  const historical = fakePrisma({ worker: { id: 'worker-a', active: false } });
  const linked = await linkWhatsAppMessageToProgressEvidence(historical.prisma, linkInput());
  assert.equal(linked.evidence.authorWorkerId, 'worker-a');

  const suspended = fakePrisma({ subscriptionStatus: 'SUSPENDED' });
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(suspended.prisma, linkInput()),
    (error) => error?.code === 'SUBSCRIPTION_READ_ONLY' && error?.status === 402,
  );
  const completed = fakePrisma({ projectStatus: 'COMPLETED' });
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(completed.prisma, linkInput()),
    (error) => error instanceof ProjectWritePolicyError
      && error.code === 'PROJECT_READ_ONLY',
  );
});

test('rolls back evidence when the audit write fails', async () => {
  const database = fakePrisma({ auditFailure: new Error('audit unavailable') });
  await assert.rejects(
    linkWhatsAppMessageToProgressEvidence(database.prisma, linkInput()),
    /audit unavailable/,
  );
  assert.equal(database.evidence.length, 0);
  assert.equal(database.audits.length, 0);
});

test('progress evidence serialization never exposes storage identities, URLs or hashes', () => {
  const item = {
    id: 'evidence-a',
    projectId: 'project-a',
    taskId: 'task-a',
    authorWorkerId: 'worker-a',
    sourceConversationId: 'conversation-a',
    sourceMessageId: 'message-a',
    sourceOperationKeyHash: 'b'.repeat(64),
    sourceRequestFingerprint: 'c'.repeat(64),
    capturedAt: CAPTURED_AT,
    caption: 'Foto de avance',
    media: {
      kind: 'image',
      mimeType: 'image/jpeg',
      filename: 'avance.jpg',
      size: 12,
      sha256: SHA256,
      url: 'https://must-not-leak.test',
      storage: { publicId: 'secret-public-id', assetId: 'secret-asset-id' },
    },
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    status: 'PENDING',
    reviewNote: null,
    revision: 0,
    reviewedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const restricted = serializeProgressEvidence(item);
  const authorized = serializeProgressEvidence(item, { includeSourceEvidence: true });

  assert.deepEqual(restricted.attachment, { available: true, restricted: true });
  assert.deepEqual(restricted.source, { channel: 'whatsapp' });
  assert.equal(authorized.attachment.href, '/api/evidence/message-a');
  assert.equal(authorized.attachment.filename, 'avance.jpg');
  for (const dto of [restricted, authorized]) {
    const encoded = JSON.stringify(dto);
    assert.doesNotMatch(encoded, /must-not-leak|secret-public-id|secret-asset-id|"sha256"|sourceOperationKeyHash|sourceRequestFingerprint/);
    assert.equal(Object.hasOwn(dto, 'media'), false);
  }
});

function routeRequest({
  projectId = 'project-a',
  body = { projectId: 'project-a', taskId: 'task-a' },
  idempotencyKey = 'route-link-key-a',
  contentType = 'application/json',
} = {}) {
  const headers = new Headers({
    'content-type': contentType,
    'x-request-id': 'route-request-a',
  });
  if (idempotencyKey !== null) headers.set('idempotency-key', idempotencyKey);
  return new Request(
    `http://localhost/api/whatsapp/inbox/conversation-a/messages/message-a/progress-evidence?projectId=${projectId}`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  );
}

function routeContext(overrides = {}) {
  return {
    params: Promise.resolve({
      conversationId: 'conversation-a',
      messageId: 'message-a',
      ...overrides,
    }),
  };
}

test('Route Handler awaits params, enforces both permissions and returns a private correlated response', async () => {
  const permissions = [];
  const calls = [];
  const handlers = createWhatsAppProgressEvidenceHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission, options) => permissions.push([permission, options]),
    prismaFactory: () => ({ marker: 'prisma' }),
    linkEvidence: async (prisma, input) => {
      calls.push([prisma, input]);
      return { evidence: { id: 'evidence-a', status: 'PENDING' }, replayed: false };
    },
    resolveCorrelationId: () => 'route-request-a',
    clock: () => NOW,
  });

  const response = await handlers.POST(routeRequest(), routeContext());
  const payload = await response.json();

  assert.equal(response.status, 201);
  assert.match(response.headers.get('cache-control') || '', /private.*no-store/i);
  assert.equal(response.headers.get('x-request-id'), 'route-request-a');
  assert.equal(payload.replayed, false);
  assert.deepEqual(permissions, [
    ['org:execution:manage', { subscriptionMode: 'write' }],
    ['org:field:evidence:read', undefined],
  ]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].conversationId, 'conversation-a');
  assert.equal(calls[0][1].messageId, 'message-a');
  assert.equal(calls[0][1].taskId, 'task-a');
  assert.equal(calls[0][1].idempotencyKey, 'route-link-key-a');
  assert.equal(calls[0][1].correlationId, 'route-request-a');
});

test('Route Handler returns 200 for replay and rejects forged fields, missing keys and scope mismatch before Prisma', async () => {
  let prismaCalls = 0;
  const handlers = createWhatsAppProgressEvidenceHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => {
      prismaCalls += 1;
      return {};
    },
    linkEvidence: async () => ({ evidence: { id: 'evidence-a' }, replayed: true }),
    resolveCorrelationId: () => 'route-request-b',
  });
  const replay = await handlers.POST(routeRequest(), routeContext());
  assert.equal(replay.status, 200);
  assert.equal(prismaCalls, 1);

  const invalidRequests = [
    routeRequest({ body: { projectId: 'project-a', taskId: 'task-a', media: { forged: true } } }),
    routeRequest({ idempotencyKey: null }),
    routeRequest({ projectId: 'project-foreign' }),
    routeRequest({ body: { projectId: 'project-foreign', taskId: 'task-a' } }),
  ];
  const expectedStatuses = [400, 400, 403, 403];
  for (const [index, request] of invalidRequests.entries()) {
    const response = await handlers.POST(request, routeContext());
    assert.equal(response.status, expectedStatuses[index]);
    assert.match(response.headers.get('cache-control') || '', /no-store/i);
  }
  assert.equal(prismaCalls, 1);
});

test('Route Handler rejects unsupported content and authorization before database access', async () => {
  let prismaCalls = 0;
  const denied = createWhatsAppProgressEvidenceHandlers({
    resolveAccess: async () => access(),
    authorize: (_access, permission) => {
      if (permission === 'org:field:evidence:read') {
        throw new AccessError('forbidden', { code: 'PERMISSION_REQUIRED', status: 403 });
      }
    },
    prismaFactory: () => {
      prismaCalls += 1;
      return {};
    },
    resolveCorrelationId: () => 'route-request-c',
  });
  const deniedResponse = await denied.POST(routeRequest(), routeContext());
  assert.equal(deniedResponse.status, 403);
  assert.equal(prismaCalls, 0);

  const contentType = createWhatsAppProgressEvidenceHandlers({
    resolveAccess: async () => access(),
    authorize: () => undefined,
    prismaFactory: () => {
      prismaCalls += 1;
      return {};
    },
    resolveCorrelationId: () => 'route-request-d',
  });
  const contentResponse = await contentType.POST(
    routeRequest({ contentType: 'text/plain' }),
    routeContext(),
  );
  assert.equal(contentResponse.status, 415);
  assert.equal(prismaCalls, 0);
});

test('migration is expand-safe and enforces tenant-scoped source provenance', async () => {
  const migrationNames = [
    '20260726120000_whatsapp_progress_evidence_bridge',
    '20260726120010_progress_evidence_conversation_scope_index',
    '20260726120020_progress_evidence_message_scope_index',
    '20260726120030_progress_evidence_source_message_index',
    '20260726120040_progress_evidence_source_scope_index',
    '20260726120050_progress_evidence_operation_index',
    '20260726120100_whatsapp_progress_evidence_constraints',
    '20260726120200_whatsapp_progress_evidence_validate',
  ];
  const migrations = await Promise.all(migrationNames.map((name) => readFile(
    new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url),
    'utf8',
  )));
  const [expand, ...laterMigrations] = migrations;
  const indexMigrations = laterMigrations.slice(0, 5);
  const constraints = laterMigrations[5];
  const validation = laterMigrations[6];

  assert.match(expand, /ADD COLUMN "sourceConversationId" TEXT/);
  assert.match(expand, /ADD COLUMN "sourceMessageId" TEXT/);
  assert.doesNotMatch(expand, /sourceMessageId" TEXT NOT NULL/);
  assert.match(expand, /ProgressEvidence_source_bundle_check/);
  assert.match(expand, /ProgressEvidence_source_operation_hash_check/);
  assert.match(expand, /ProgressEvidence_source_fingerprint_check/);
  assert.doesNotMatch(expand, /CREATE (?:UNIQUE )?INDEX/);
  assert.doesNotMatch(expand, /FOREIGN KEY/);
  assert.doesNotMatch(expand, /VALIDATE CONSTRAINT/);

  const expectedIndexes = [
    'Conversation_projectId_id_key',
    'Message_conversationId_id_key',
    'ProgressEvidence_sourceMessageId_key',
    'ProgressEvidence_source_conversation_message_key',
    'ProgressEvidence_project_operation_key',
  ];
  for (const [index, migration] of indexMigrations.entries()) {
    const statements = migration
      .replace(/^\s*--.*$/gm, '')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean);
    assert.equal(statements.length, 1);
    assert.match(statements[0], /^CREATE UNIQUE INDEX CONCURRENTLY /);
    assert.match(statements[0], new RegExp(`"${expectedIndexes[index]}"`));
  }

  assert.match(constraints, /FOREIGN KEY \("projectId", "sourceConversationId"\)[\s\S]*REFERENCES "Conversation"\("projectId", "id"\)/);
  assert.match(constraints, /FOREIGN KEY \("sourceConversationId", "sourceMessageId"\)[\s\S]*REFERENCES "Message"\("conversationId", "id"\)/);
  assert.match(constraints, /DEFERRABLE INITIALLY DEFERRED[\s\S]*NOT VALID/);
  assert.doesNotMatch(constraints, /VALIDATE CONSTRAINT/);
  assert.match(validation, /VALIDATE CONSTRAINT "ProgressEvidence_source_message_scope_fkey"/);
  assert.doesNotMatch(validation, /CREATE (?:UNIQUE )?INDEX/);
});
