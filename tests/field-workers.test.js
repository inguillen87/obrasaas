import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIELD_WORKER_INTENTS,
  FIELD_WORKER_RESOLUTION,
  FieldWorkerInputError,
  canFieldWorkerHandleIntent,
  fieldWorkerWhatsAppRole,
  findFieldWorkerPhoneConflict,
  metadataWithWhatsAppRole,
  normalizeFieldWorkerCreateInput,
  normalizeFieldWorkerPatchInput,
  normalizeWorkerPhone,
  resolveActiveFieldWorkerById,
  resolveActiveFieldWorkerByPhone,
  serializeFieldWorker,
} from '../src/lib/field-workers.js';
import {
  WORKER_FINANCIAL_FIELDS,
  WORKER_FINANCIAL_PURPOSES,
  encryptWorkerFinancialPayload,
  maskWorkerFinancialValue,
  workerFinancialFingerprint,
  workerFinancialLastFour,
} from '../src/lib/worker-financial-data.js';

const scope = { organizationId: 'org-a', projectId: 'project-a' };
const now = new Date('2026-07-16T12:00:00.000Z');

function worker(overrides = {}) {
  return {
    id: 'worker-a',
    organizationId: 'org-a',
    projectId: 'project-a',
    personId: null,
    externalId: null,
    phone: '+5491112345678',
    name: 'Juan Gómez',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN', preserved: true },
    createdAt: now,
    updatedAt: now,
    project: { organizationId: 'org-a' },
    ...overrides,
  };
}

function workerFinancialKeyConfiguration() {
  let entropy = 0;
  return {
    kekRegistry: {
      currentKeyId: 'worker-channel-kek-current',
      keys: new Map([
        ['worker-channel-kek-current', Buffer.alloc(32, 11)],
      ]),
    },
    fingerprintRegistry: {
      currentKeyId: 'worker-channel-fingerprint-current',
      keys: new Map([
        ['worker-channel-fingerprint-old', Buffer.alloc(32, 21)],
        ['worker-channel-fingerprint-current', Buffer.alloc(32, 22)],
      ]),
    },
    randomBytes(length) {
      entropy += 1;
      return Buffer.alloc(length, entropy);
    },
  };
}

function channelBinding(channel, destinationType, field) {
  return {
    organizationId: channel.organizationId,
    subjectId: channel.personId,
    recordId: channel.id,
    recordVersion: channel.recordVersion,
    purpose: WORKER_FINANCIAL_PURPOSES.CHANNEL_ADDRESS,
    destinationType,
    field,
  };
}

function canonicalChannel({
  keyConfiguration,
  id = 'channel-a',
  organizationId = 'org-a',
  personId = 'person-a',
  personStatus = 'ACTIVE',
  personIdentityStatus = 'PENDING_REVIEW',
  address = '+5491112345678',
  providerSubject = '5491112345678',
  status = 'VERIFIED',
  fingerprintKeyId = keyConfiguration.fingerprintRegistry.currentKeyId,
  verifiedAt = now,
} = {}) {
  const channel = {
    id,
    organizationId,
    personId,
    provider: 'WHATSAPP',
    status,
    recordVersion: 1,
    verifiedAt: status === 'VERIFIED' ? verifiedAt : null,
    revokedAt: status === 'REVOKED' ? now : null,
    person: {
      id: personId,
      organizationId,
      status: personStatus,
      identityStatus: personIdentityStatus,
    },
  };
  const addressFingerprint = workerFinancialFingerprint(address, {
    organizationId,
    valueType: 'WHATSAPP_E164',
  }, {
    registry: keyConfiguration.fingerprintRegistry,
    keyId: fingerprintKeyId,
  });
  const providerSubjectFingerprint = workerFinancialFingerprint(providerSubject, {
    organizationId,
    valueType: 'WHATSAPP_PROVIDER_SUBJECT',
  }, {
    registry: keyConfiguration.fingerprintRegistry,
    keyId: fingerprintKeyId,
  });
  const encryptedAddress = encryptWorkerFinancialPayload(
    { address },
    channelBinding(
      channel,
      'WHATSAPP_E164',
      WORKER_FINANCIAL_FIELDS.CHANNEL_ADDRESS,
    ),
    {
      registry: keyConfiguration.kekRegistry,
      randomBytes: keyConfiguration.randomBytes,
    },
  );
  const encryptedProviderSubject = encryptWorkerFinancialPayload(
    { providerSubject },
    channelBinding(
      channel,
      'WHATSAPP_PROVIDER_SUBJECT',
      WORKER_FINANCIAL_FIELDS.CHANNEL_PROVIDER_SUBJECT,
    ),
    {
      registry: keyConfiguration.kekRegistry,
      randomBytes: keyConfiguration.randomBytes,
    },
  );
  return {
    ...channel,
    encryptedAddressPayload: encryptedAddress.encryptedPayload,
    addressFingerprint: addressFingerprint.fingerprint,
    addressFingerprintKeyId: addressFingerprint.fingerprintKeyId,
    addressLastFour: workerFinancialLastFour(address, 'WHATSAPP_E164'),
    wrappingKeyId: encryptedAddress.wrappingKeyId,
    encryptedProviderSubjectPayload: encryptedProviderSubject.encryptedPayload,
    providerSubjectFingerprint: providerSubjectFingerprint.fingerprint,
    providerSubjectFingerprintKeyId: providerSubjectFingerprint.fingerprintKeyId,
  };
}

function scalarMatches(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (Object.hasOwn(expected, 'equals') && actual !== expected.equals) return false;
    if (Object.hasOwn(expected, 'in')) return expected.in.includes(actual);
    if (Object.hasOwn(expected, 'notIn')) return !expected.notIn.includes(actual);
    if (Object.hasOwn(expected, 'not')) {
      return expected.not !== null && typeof expected.not === 'object'
        ? !whereMatches(actual, expected.not)
        : actual !== expected.not;
    }
    if (Object.hasOwn(expected, 'some')) {
      return Array.isArray(actual) && actual.some((row) => whereMatches(row, expected.some));
    }
    return whereMatches(actual, expected);
  }
  return actual === expected;
}

function whereMatches(row, where = {}) {
  if (!row || typeof row !== 'object') return false;
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'AND') return expected.every((candidate) => whereMatches(row, candidate));
    if (field === 'OR') return expected.some((candidate) => whereMatches(row, candidate));
    if (field === 'NOT') return !whereMatches(row, expected);
    return scalarMatches(row[field], expected);
  });
}

function canonicalPrisma({ workers = [], channels = [] } = {}) {
  const projects = new Map(workers.map((row) => [
    row.projectId,
    row.project || { organizationId: row.organizationId },
  ]));
  const people = new Map(channels.map((channel) => [
    channel.personId,
    {
      ...channel.person,
      channelIdentities: channels
        .filter((candidate) => candidate.personId === channel.personId)
        .map((candidate) => ({
          id: candidate.id,
          status: candidate.status,
          verifiedAt: candidate.verifiedAt,
          revokedAt: candidate.revokedAt,
        })),
    },
  ]));
  const hydratedWorkers = workers.map((row) => ({
    ...row,
    project: row.project || projects.get(row.projectId),
    person: row.person || (row.personId ? people.get(row.personId) : null),
  }));
  const hydratedChannels = channels.map((channel) => ({
    ...channel,
    person: {
      ...channel.person,
      workers: hydratedWorkers.filter((row) => (
        row.organizationId === channel.organizationId
        && row.personId === channel.personId
      )),
    },
  }));

  const prisma = {
    worker: {
      findMany: async ({ where = {} } = {}) => hydratedWorkers.filter((row) => (
        whereMatches(row, where)
      )),
      findFirst: async ({ where = {} } = {}) => hydratedWorkers.find((row) => (
        whereMatches(row, where)
      )) || null,
    },
    workerPerson: {
      findMany: async ({ where = {} } = {}) => [...people.values()].filter((row) => (
        whereMatches(row, where)
      )),
      findFirst: async ({ where = {} } = {}) => [...people.values()].find((row) => (
        whereMatches(row, where)
      )) || null,
    },
    workerChannelIdentity: {
      findMany: async ({ where = {} } = {}) => hydratedChannels.filter((row) => (
        whereMatches(row, where)
      )),
      findFirst: async ({ where = {} } = {}) => hydratedChannels.find((row) => (
        whereMatches(row, where)
      )) || null,
    },
  };
  prisma.$transaction = async (operation) => (
    typeof operation === 'function' ? operation(prisma) : Promise.all(operation)
  );
  return prisma;
}

test('phone normalization produces one canonical international representation', () => {
  assert.equal(normalizeWorkerPhone('+54 9 11 1234-5678'), '+5491112345678');
  assert.equal(normalizeWorkerPhone('0054 (9) 11 1234 5678'), '+5491112345678');
  assert.throws(() => normalizeWorkerPhone('54911-call-me'), FieldWorkerInputError);
  assert.throws(() => normalizeWorkerPhone('1234'), /entre 8 y 15/);
});

test('create and patch DTO validation is strict and bounded', () => {
  assert.deepEqual(normalizeFieldWorkerCreateInput({
    name: '  Ana   Pérez ',
    phone: '5491112345678',
    role: ' Seguridad ',
    whatsappRole: 'safety',
  }), {
    name: 'Ana Pérez',
    phone: '+5491112345678',
    role: 'Seguridad',
    whatsappRole: 'SAFETY',
  });
  assert.deepEqual(normalizeFieldWorkerPatchInput({
    workerId: 'worker-a',
    role: null,
    active: false,
  }), { workerId: 'worker-a', data: { role: null, active: false } });
  assert.throws(
    () => normalizeFieldWorkerCreateInput({ name: 'Ana', phone: '5491112345678', admin: true }),
    (error) => error.code === 'UNKNOWN_FIELDS',
  );
  assert.throws(
    () => normalizeFieldWorkerPatchInput({ workerId: 'worker-a' }),
    (error) => error.code === 'EMPTY_UPDATE',
  );
});

test('WhatsApp role metadata defaults safely and preserves unrelated metadata', () => {
  assert.equal(fieldWorkerWhatsAppRole({ metadata: { whatsappRole: 'ROOT' } }), 'WORKER');
  assert.deepEqual(metadataWithWhatsAppRole({ preserved: true }, 'SITE_MANAGER'), {
    preserved: true,
    whatsappRole: 'SITE_MANAGER',
  });
});

test('intent matrix lets workers report progress but keeps approval authority with supervisors', () => {
  for (const role of ['WORKER', 'FOREMAN', 'SITE_MANAGER', 'SAFETY']) {
    assert.equal(canFieldWorkerHandleIntent(role, FIELD_WORKER_INTENTS.INCIDENT), true);
    assert.equal(canFieldWorkerHandleIntent(role, FIELD_WORKER_INTENTS.ATTENDANCE_START), true);
    assert.equal(canFieldWorkerHandleIntent(role, FIELD_WORKER_INTENTS.PAYMENT_DESTINATION), true);
  }
  assert.equal(canFieldWorkerHandleIntent('WORKER', FIELD_WORKER_INTENTS.TASK_PROGRESS), true);
  assert.equal(canFieldWorkerHandleIntent('SAFETY', FIELD_WORKER_INTENTS.TASK_PROGRESS), false);
  assert.equal(canFieldWorkerHandleIntent('FOREMAN', FIELD_WORKER_INTENTS.TASK_PROGRESS), true);
  assert.equal(canFieldWorkerHandleIntent('SITE_MANAGER', FIELD_WORKER_INTENTS.TASK_PROGRESS), true);
  assert.equal(canFieldWorkerHandleIntent('UNTRUSTED', FIELD_WORKER_INTENTS.TASK_PROGRESS), false);
  assert.equal(canFieldWorkerHandleIntent('WORKER', FIELD_WORKER_INTENTS.DELAY_REPORT), false);
  assert.equal(canFieldWorkerHandleIntent('SAFETY', FIELD_WORKER_INTENTS.DELAY_REPORT), false);
  assert.equal(canFieldWorkerHandleIntent('FOREMAN', FIELD_WORKER_INTENTS.DELAY_REPORT), true);
  assert.equal(canFieldWorkerHandleIntent('SITE_MANAGER', FIELD_WORKER_INTENTS.DELAY_REPORT), true);
  assert.equal(canFieldWorkerHandleIntent('UNTRUSTED', FIELD_WORKER_INTENTS.DELAY_REPORT), false);
});

test('serializer exposes the exact public DTO and no metadata', () => {
  assert.deepEqual(serializeFieldWorker(worker()), {
    id: 'worker-a',
    name: 'Juan Gómez',
    phone: '+5491112345678',
    role: 'Capataz',
    whatsappRole: 'FOREMAN',
    active: true,
    channels: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
});

test('serializer keeps a canonical worker phone nullable and exposes only masked channels', () => {
  const serialized = serializeFieldWorker(worker({
    phone: null,
    personId: 'person-a',
    person: {
      channelIdentities: [{
        id: 'channel-secret-a',
        provider: 'WHATSAPP',
        status: 'VERIFIED',
        addressLastFour: '5678',
        addressFingerprint: 'must-not-leak-address-fingerprint',
        encryptedAddressPayload: 'must-not-leak-ciphertext',
        encryptedProviderSubjectPayload: 'must-not-leak-provider-subject',
        verifiedAt: now,
      }],
    },
  }));

  assert.equal(serialized.phone, null);
  assert.deepEqual(serialized.channels, [{
    provider: 'WHATSAPP',
    status: 'VERIFIED',
    addressMasked: maskWorkerFinancialValue('WHATSAPP_E164', '5678'),
    verifiedAt: now.toISOString(),
  }]);
  const serializedText = JSON.stringify(serialized);
  for (const secret of [
    '+5491112345678',
    'channel-secret-a',
    'must-not-leak-address-fingerprint',
    'must-not-leak-ciphertext',
    'must-not-leak-provider-subject',
    'person-a',
  ]) {
    assert.equal(serializedText.includes(secret), false);
  }
});

test('phone resolver requires one active match inside both project and tenant scope', async () => {
  let query;
  const prisma = {
    worker: {
      findMany: async (args) => {
        query = args;
        return [
          worker({ id: 'inactive', active: false }),
          worker(),
          worker({ id: 'tenant-b', project: { organizationId: 'org-b' } }),
        ];
      },
    },
  };
  const result = await resolveActiveFieldWorkerByPhone(prisma, scope, '5491112345678');
  assert.equal(query.where.projectId, 'project-a');
  assert.equal(query.where.project.organizationId, 'org-a');
  assert.equal(query.where.active, true);
  assert.equal(result.status, FIELD_WORKER_RESOLUTION.RESOLVED);
  assert.equal(result.worker.id, 'worker-a');
});

test('phone resolver rejects invalid, unknown and ambiguous identities', async () => {
  const unknownPrisma = { worker: { findMany: async () => [] } };
  assert.equal(
    (await resolveActiveFieldWorkerByPhone(unknownPrisma, scope, 'not-a-phone')).status,
    FIELD_WORKER_RESOLUTION.INVALID_PHONE,
  );
  assert.equal(
    (await resolveActiveFieldWorkerByPhone(unknownPrisma, scope, '5491112345678')).status,
    FIELD_WORKER_RESOLUTION.UNKNOWN,
  );
  const ambiguousPrisma = {
    worker: { findMany: async () => [worker(), worker({ id: 'worker-b', phone: '54 9 11 1234 5678' })] },
  };
  assert.equal(
    (await resolveActiveFieldWorkerByPhone(ambiguousPrisma, scope, '5491112345678')).status,
    FIELD_WORKER_RESOLUTION.AMBIGUOUS,
  );
});

test('canonical resolver recognizes a VERIFIED channel whose project bridge has phone null', async () => {
  const keyConfiguration = workerFinancialKeyConfiguration();
  const canonicalWorker = worker({
    phone: null,
    personId: 'person-a',
  });
  const prisma = canonicalPrisma({
    workers: [canonicalWorker],
    channels: [canonicalChannel({ keyConfiguration })],
  });

  const result = await resolveActiveFieldWorkerByPhone(
    prisma,
    scope,
    '+54 9 11 1234-5678',
    { keyConfiguration },
  );

  assert.equal(result.status, FIELD_WORKER_RESOLUTION.RESOLVED);
  assert.equal(result.worker.id, canonicalWorker.id);
  assert.equal(result.worker.personId, 'person-a');
  assert.equal(canonicalWorker.phone, null);
  assert.equal(result.worker.phone, '+5491112345678');
  assert.equal(result.normalizedPhone, '+5491112345678');
  assert.equal(result.source, 'CANONICAL');
});

test('canonical resolver preserves tenant, project, and active-person boundaries', async (t) => {
  const cases = [
    {
      name: 'tenant',
      worker: worker({
        organizationId: 'org-b',
        project: { organizationId: 'org-b' },
        phone: null,
        personId: 'person-b',
      }),
      channel: (keyConfiguration) => canonicalChannel({
        keyConfiguration,
        organizationId: 'org-b',
        personId: 'person-b',
      }),
      expectedStatus: FIELD_WORKER_RESOLUTION.UNKNOWN,
    },
    {
      name: 'project',
      worker: worker({
        projectId: 'project-b',
        phone: null,
        personId: 'person-a',
      }),
      channel: (keyConfiguration) => canonicalChannel({ keyConfiguration }),
      expectedStatus: FIELD_WORKER_RESOLUTION.UNKNOWN,
    },
    {
      name: 'person status',
      worker: worker({
        phone: null,
        personId: 'person-a',
      }),
      channel: (keyConfiguration) => canonicalChannel({
        keyConfiguration,
        personStatus: 'SUSPENDED',
      }),
      expectedStatus: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
    },
  ];

  for (const candidate of cases) {
    await t.test(candidate.name, async () => {
      const keyConfiguration = workerFinancialKeyConfiguration();
      const prisma = canonicalPrisma({
        workers: [candidate.worker],
        channels: [candidate.channel(keyConfiguration)],
      });
      const result = await resolveActiveFieldWorkerByPhone(
        prisma,
        scope,
        '+5491112345678',
        { keyConfiguration },
      );
      assert.equal(result.status, candidate.expectedStatus);
      assert.equal(result.worker, null);
    });
  }
});

test('canonical channel revocation states block legacy phone downgrade', async (t) => {
  const expectedResolution = new Map([
    ['PENDING', FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED],
    ['CONFLICT', FIELD_WORKER_RESOLUTION.AMBIGUOUS],
    ['REVOKED', FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED],
  ]);
  for (const [status, expectedStatus] of expectedResolution) {
    await t.test(status, async () => {
      const keyConfiguration = workerFinancialKeyConfiguration();
      const legacyBridge = worker({ personId: 'person-a' });
      const prisma = canonicalPrisma({
        workers: [legacyBridge],
        channels: [canonicalChannel({ keyConfiguration, status })],
      });
      const result = await resolveActiveFieldWorkerByPhone(
        prisma,
        scope,
        legacyBridge.phone,
        { keyConfiguration },
      );
      assert.equal(result.status, expectedStatus);
      assert.equal(result.worker, null);
    });
  }
});

test('canonical and legacy records for the same worker deduplicate during cutover', async () => {
  const keyConfiguration = workerFinancialKeyConfiguration();
  const dualReadWorker = worker({ personId: 'person-a' });
  const prisma = canonicalPrisma({
    workers: [dualReadWorker],
    channels: [canonicalChannel({ keyConfiguration })],
  });

  const result = await resolveActiveFieldWorkerByPhone(
    prisma,
    scope,
    dualReadWorker.phone,
    { keyConfiguration },
  );

  assert.equal(result.status, FIELD_WORKER_RESOLUTION.RESOLVED);
  assert.equal(result.worker.id, dualReadWorker.id);
  assert.equal(result.source, 'CANONICAL');
});

test('canonical and legacy identities that point to different workers fail as AMBIGUOUS', async () => {
  const keyConfiguration = workerFinancialKeyConfiguration();
  const canonicalWorker = worker({
    id: 'worker-canonical',
    phone: null,
    personId: 'person-a',
  });
  const legacyWorker = worker({
    id: 'worker-legacy',
    personId: null,
  });
  const prisma = canonicalPrisma({
    workers: [canonicalWorker, legacyWorker],
    channels: [canonicalChannel({ keyConfiguration })],
  });

  const result = await resolveActiveFieldWorkerByPhone(
    prisma,
    scope,
    legacyWorker.phone,
    { keyConfiguration },
  );

  assert.equal(result.status, FIELD_WORKER_RESOLUTION.AMBIGUOUS);
  assert.equal(result.worker, null);
});

test('duplicate canonical identities across retained fingerprint epochs fail as AMBIGUOUS', async () => {
  const keyConfiguration = workerFinancialKeyConfiguration();
  const workers = [
    worker({ id: 'worker-current', phone: null, personId: 'person-current' }),
    worker({ id: 'worker-old', phone: null, personId: 'person-old' }),
  ];
  const channels = [
    canonicalChannel({
      keyConfiguration,
      id: 'channel-current',
      personId: 'person-current',
      fingerprintKeyId: 'worker-channel-fingerprint-current',
    }),
    canonicalChannel({
      keyConfiguration,
      id: 'channel-old',
      personId: 'person-old',
      fingerprintKeyId: 'worker-channel-fingerprint-old',
    }),
  ];
  const prisma = canonicalPrisma({ workers, channels });

  const result = await resolveActiveFieldWorkerByPhone(
    prisma,
    scope,
    '+5491112345678',
    { keyConfiguration },
  );

  assert.equal(result.status, FIELD_WORKER_RESOLUTION.AMBIGUOUS);
  assert.equal(result.worker, null);
});

test('a same-person canonical authority with invisible fingerprints blocks legacy fallback', async () => {
  const keyConfiguration = workerFinancialKeyConfiguration();
  const legacyBridge = worker({ personId: 'person-a' });
  const invisibleChannel = {
    ...canonicalChannel({ keyConfiguration }),
    addressFingerprint: 'not-the-address-fingerprint',
    providerSubjectFingerprint: 'not-the-provider-subject-fingerprint',
  };
  const prisma = canonicalPrisma({
    workers: [legacyBridge],
    channels: [invisibleChannel],
  });

  const result = await resolveActiveFieldWorkerByPhone(
    prisma,
    scope,
    legacyBridge.phone,
    { keyConfiguration },
  );

  assert.equal(result.status, FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED);
  assert.equal(result.worker, null);
});

test('an unretained canonical fingerprint epoch blocks every legacy downgrade', async () => {
  const fullKeyConfiguration = workerFinancialKeyConfiguration();
  const staleChannel = canonicalChannel({
    keyConfiguration: fullKeyConfiguration,
    fingerprintKeyId: 'worker-channel-fingerprint-old',
  });
  const currentOnlyConfiguration = {
    ...fullKeyConfiguration,
    fingerprintRegistry: {
      currentKeyId: 'worker-channel-fingerprint-current',
      keys: new Map([[
        'worker-channel-fingerprint-current',
        fullKeyConfiguration.fingerprintRegistry.keys.get('worker-channel-fingerprint-current'),
      ]]),
    },
  };
  const legacyBridge = worker({ personId: 'person-a' });
  const prisma = canonicalPrisma({
    workers: [legacyBridge],
    channels: [staleChannel],
  });

  for (const operation of [
    () => resolveActiveFieldWorkerByPhone(
      prisma,
      scope,
      legacyBridge.phone,
      { keyConfiguration: currentOnlyConfiguration },
    ),
    () => findFieldWorkerPhoneConflict(
      prisma,
      scope,
      legacyBridge.phone,
      null,
      { keyConfiguration: currentOnlyConfiguration },
    ),
  ]) {
    await assert.rejects(
      operation(),
      (error) => error.code === 'FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID',
    );
  }
});

test('a deployed runtime never authorizes a legacy phone without the canonical model', async () => {
  const prisma = {
    worker: { findMany: async () => [worker()] },
  };
  const dependencies = { environment: { VERCEL: '1', VERCEL_ENV: 'preview' } };

  for (const operation of [
    () => resolveActiveFieldWorkerByPhone(
      prisma,
      scope,
      '+5491112345678',
      dependencies,
    ),
    () => findFieldWorkerPhoneConflict(
      prisma,
      scope,
      '+5491112345678',
      null,
      dependencies,
    ),
  ]) {
    await assert.rejects(
      operation(),
      (error) => error.code === 'FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID',
    );
  }
});

test('canonical decryption failure is fail-closed and never falls back to legacy phone', async () => {
  const keyConfiguration = workerFinancialKeyConfiguration();
  const legacyBridge = worker({ personId: 'person-a' });
  const prisma = canonicalPrisma({
    workers: [legacyBridge],
    channels: [canonicalChannel({ keyConfiguration })],
  });
  const integrityFailure = new Error('test-only channel integrity failure');
  integrityFailure.code = 'WORKER_FINANCIAL_DECRYPTION_FAILED';

  await assert.rejects(
    resolveActiveFieldWorkerByPhone(
      prisma,
      scope,
      legacyBridge.phone,
      {
        keyConfiguration,
        decryptFinancialPayload: () => {
          throw integrityFailure;
        },
      },
    ),
    (error) => (
      error.code === 'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT'
      && error.cause === integrityFailure
    ),
  );
});

test('id resolver invalidates canonical bridges after person or channel revocation', async (t) => {
  const cases = [
    {
      name: 'valid',
      channel: {},
      expectedStatus: FIELD_WORKER_RESOLUTION.RESOLVED,
    },
    {
      name: 'suspended person',
      channel: { personStatus: 'SUSPENDED' },
      expectedStatus: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
    },
    {
      name: 'unverified civil identity',
      channel: { personIdentityStatus: 'UNVERIFIED' },
      expectedStatus: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
    },
    {
      name: 'revoked WhatsApp channel',
      channel: { status: 'REVOKED' },
      expectedStatus: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
    },
  ];

  for (const candidate of cases) {
    await t.test(candidate.name, async () => {
      const keyConfiguration = workerFinancialKeyConfiguration();
      const prisma = canonicalPrisma({
        workers: [worker({ phone: null, personId: 'person-a' })],
        channels: [canonicalChannel({ keyConfiguration, ...candidate.channel })],
      });
      const result = await resolveActiveFieldWorkerById(prisma, scope, 'worker-a');
      assert.equal(result.status, candidate.expectedStatus);
      assert.equal(
        result.worker?.id || null,
        candidate.expectedStatus === FIELD_WORKER_RESOLUTION.RESOLVED ? 'worker-a' : null,
      );
    });
  }
});

test('id resolver and phone conflict lookup retain project and tenant boundaries', async () => {
  let idQuery;
  const prisma = {
    worker: {
      findFirst: async (args) => {
        idQuery = args;
        return worker();
      },
      findMany: async () => [
        worker({ id: 'worker-a' }),
        worker({ id: 'tenant-b', project: { organizationId: 'org-b' } }),
      ],
    },
  };
  const byId = await resolveActiveFieldWorkerById(prisma, scope, 'worker-a');
  assert.equal(idQuery.where.id, 'worker-a');
  assert.equal(idQuery.where.projectId, 'project-a');
  assert.equal(idQuery.where.project.organizationId, 'org-a');
  assert.equal(byId.status, FIELD_WORKER_RESOLUTION.RESOLVED);

  const conflict = await findFieldWorkerPhoneConflict(
    prisma,
    scope,
    '+5491112345678',
    'different-worker',
  );
  assert.equal(conflict.id, 'worker-a');
});
