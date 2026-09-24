import assert from 'node:assert/strict';
import { buildOwnedWhatsAppFlowTemplate } from '../../src/lib/whatsapp/templates.js';
import { getWhatsAppFlowScopedName } from '../../src/lib/whatsapp/flows.js';

const NOW = new Date('2026-07-23T12:00:00.000Z');
const FLOW_SECRET = 'whatsapp-flow-test-secret-with-at-least-32-bytes';
const CONFIGURED_META_ENV = Object.freeze({
  NEXT_PUBLIC_APP_URL: 'https://preview.obrasaas.test',
  NEXT_PUBLIC_META_APP_ID: 'app-a',
  META_APP_SECRET: 'secret-a',
  NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID: 'config-a',
  META_VERIFY_TOKEN: 'verify-a',
  WHATSAPP_CREDENTIALS_ENCRYPTION_KEY: 'encryption-a',
  WHATSAPP_FLOW_TOKEN_SECRET: FLOW_SECRET,
});

function access(overrides = {}) {
  return {
    databaseUserId: 'actor-a',
    isSuperadmin: false,
    orgId: 'org-a',
    tenantRole: 'ADMIN',
    subscription: { canRead: true, canWrite: true },
    organization: { id: 'organization-a', name: 'Constructora A' },
    project: { id: 'project-a', organizationId: 'organization-a', name: 'Obra A' },
    ...overrides,
  };
}

function matchesWhere(record, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    const actual = record[field];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if (Object.hasOwn(expected, 'not')) return actual !== expected.not;
      if (Object.hasOwn(expected, 'gt')) {
        return new Date(actual).getTime() > new Date(expected.gt).getTime();
      }
      if (Object.hasOwn(expected, 'lte')) {
        return new Date(actual).getTime() <= new Date(expected.lte).getTime();
      }
      if (Object.hasOwn(expected, 'in')) return expected.in.includes(actual);
    }
    return actual === expected;
  });
}

function flowSessionDelegate(records) {
  function find(where) {
    if (where.id) return records.find((record) => record.id === where.id) || null;
    const composite = where.projectId_sourceExternalId_blueprintKey;
    return composite
      ? records.find((record) => (
          record.projectId === composite.projectId
          && record.sourceExternalId === composite.sourceExternalId
          && record.blueprintKey === composite.blueprintKey
        )) || null
      : null;
  }
  return {
    async findUnique({ where }) {
      const record = find(where);
      return record ? { ...record } : null;
    },
    async create({ data }) {
      const duplicate = find({
        projectId_sourceExternalId_blueprintKey: {
          projectId: data.projectId,
          sourceExternalId: data.sourceExternalId,
          blueprintKey: data.blueprintKey,
        },
      });
      if (duplicate) throw Object.assign(new Error('unique'), { code: 'P2002' });
      const record = {
        ...data,
        deliveryAttemptedAt: null,
        deliveryRejectedAt: null,
        sentAt: null,
        providerMessageId: null,
        consumedAt: null,
        consumedExternalId: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
      records.push(record);
      return { ...record };
    },
    async updateMany({ where, data }) {
      const matching = records.filter((record) => matchesWhere(record, where));
      for (const record of matching) Object.assign(record, data, { updatedAt: NOW });
      return { count: matching.length };
    },
  };
}

function createDatabase({
  inbound = true,
  worker = true,
  templateStatus = 'APPROVED',
  inboundAt = new Date('2026-07-22T18:00:00.000Z'),
  flowEndpoint = true,
  endpointEnabled = true,
  endpointFingerprintMatches = true,
} = {}) {
  const calls = [];
  const messages = [];
  const sessions = [];
  const audits = [];
  const project = {
    id: 'project-a',
    organizationId: 'organization-a',
    name: 'Obra A',
    status: 'ACTIVE',
    organization: {
      subscriptionPlan: 'PRO',
      subscriptionStatus: 'ACTIVE',
      trialEndsAt: null,
    },
  };
  const conversation = {
    id: 'conversation-a',
    projectId: 'project-a',
    externalId: 'meta:5491111111111',
    displayName: 'Ana',
    updatedAt: inboundAt,
  };
  const connection = {
    id: 'connection-a',
    projectId: 'project-a',
    phoneNumberId: '123456789012345',
    whatsappBusinessId: '987654321098765',
    enabled: true,
    connectionStatus: 'CONNECTED',
    encryptedAccessToken: 'encrypted-token-value',
    lastError: null,
    metadata: {
      channelHealth: {
        tokenStatus: 'VALID',
        scopes: [
          'whatsapp_business_management',
          'whatsapp_business_messaging',
        ],
        phoneStatus: 'REGISTERED',
        subscriptionStatus: 'SUBSCRIBED',
        qualityStatus: 'HEALTHY',
        providerStatus: 'HEALTHY',
      },
      whatsappFlows: {
        'incident-report': {
          id: '111111111111111',
          name: getWhatsAppFlowScopedName(
            'incident-report',
            '11111111-1111-4111-8111-111111111111',
          ),
          status: 'PUBLISHED',
          dataExchange: true,
          flowScope: '11111111-1111-4111-8111-111111111111',
        },
      },
      whatsappFlowEndpoint: {
        id: 'endpoint-a',
        keyFingerprint: endpointFingerprintMatches ? 'endpoint-key-a' : 'stale-key',
        keyVersion: 1,
        signatureStatus: 'VALID',
        whatsappBusinessId: '987654321098765',
        phoneNumberId: '123456789012345',
      },
    },
    flowEndpoint: flowEndpoint
      ? {
          id: 'endpoint-a',
          enabled: endpointEnabled,
          updatedAt: NOW,
          keys: [{
            status: 'ACTIVE',
            version: 1,
            publicKeySha256: 'endpoint-key-a',
            verifiedAt: NOW,
          }],
        }
      : null,
  };
  const definition = buildOwnedWhatsAppFlowTemplate({
    connection,
    blueprintKey: 'incident-report',
  });
  const template = {
    id: 'template-local-a',
    connectionId: connection.id,
    whatsappBusinessId: connection.whatsappBusinessId,
    blueprintKey: definition.blueprintKey,
    providerTemplateId: '222222222222222',
    name: definition.name,
    language: definition.language,
    category: definition.category,
    status: templateStatus,
    contentSha256: definition.contentSha256,
    flowId: definition.flowId,
    screenId: definition.screenId,
    bodyText: definition.bodyText,
    buttonText: definition.buttonText,
    rejectionReason: null,
    submittedAt: NOW,
    lastSyncedAt: NOW,
    statusChangedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const workerRow = {
    id: 'worker-a',
    projectId: 'project-a',
    phone: '+5491111111111',
    name: 'Ana Rojas',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    createdAt: NOW,
    updatedAt: NOW,
    project: { organizationId: 'organization-a' },
  };
  const inboundMessage = inbound
    ? {
        id: 'inbound-a',
        conversationId: conversation.id,
        externalId: 'wamid.inbound-a',
        direction: 'INBOUND',
        sentAt: inboundAt,
        createdAt: inboundAt,
      }
    : null;

  const database = {
    project: {
      async findFirst(args) {
        calls.push(['project', args]);
        return args.where.id === project.id
          && args.where.organizationId === project.organizationId
          ? { ...project }
          : null;
      },
    },
    conversation: {
      async findFirst(args) {
        calls.push(['conversation', args]);
        return args.where.id === conversation.id
          && args.where.projectId === conversation.projectId
          && args.where.project?.organizationId === project.organizationId
          ? { ...conversation }
          : null;
      },
      async update({ where, data }) {
        assert.equal(where.id, conversation.id);
        Object.assign(conversation, data);
        return { ...conversation };
      },
    },
    whatsAppConnection: {
      async findUnique(args) {
        calls.push(['connection', args]);
        return args.where.projectId === project.id ? structuredClone(connection) : null;
      },
    },
    worker: {
      async findMany(args) {
        calls.push(['workers', args]);
        return worker ? [{ ...workerRow }] : [];
      },
    },
    whatsAppFlowTemplate: {
      async findMany() {
        return [{ ...template }];
      },
      async findFirst({ where }) {
        return matchesWhere(template, where) ? { ...template } : null;
      },
    },
    whatsAppFlowSession: flowSessionDelegate(sessions),
    message: {
      async findFirst(args) {
        calls.push(['message-first', args]);
        if (args.where.direction === 'INBOUND') return inboundMessage;
        if (args.where.status?.in) {
          const filters = Array.isArray(args.where.AND) ? args.where.AND : [];
          const jsonExpected = Object.fromEntries(filters.map((filter) => {
            const path = filter?.metadata?.path?.[0];
            return path ? [path, filter.metadata.equals] : [null, null];
          }).filter(([path]) => path));
          return messages
            .filter((message) => (
              message.conversationId === args.where.conversationId
              && message.direction === args.where.direction
              && args.where.status.in.includes(message.status)
              && Object.entries(jsonExpected).every(
                ([field, expected]) => message.metadata?.[field] === expected,
              )
            ))
            .sort((left, right) => (
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            ))[0] || null;
        }
        if (args.where.id) {
          return messages.find((message) => (
            message.id === args.where.id
            && message.conversationId === args.where.conversationId
            && message.direction === args.where.direction
          )) || null;
        }
        return null;
      },
      async findMany({ where, take }) {
        return messages
          .filter((message) => matchesWhere(message, where))
          .sort((left, right) => (
            new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
          ))
          .slice(0, take || messages.length)
          .map((message) => ({ ...message }));
      },
      async findUnique({ where }) {
        if (where.externalId) {
          return messages.find((message) => message.externalId === where.externalId) || null;
        }
        return null;
      },
      async create({ data }) {
        if (messages.some((message) => message.externalId === data.externalId)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const created = {
          id: `outbound-${messages.length + 1}`,
          createdAt: NOW,
          ...data,
        };
        messages.push(created);
        return { ...created };
      },
      async update({ where, data }) {
        const target = messages.find((message) => message.id === where.id);
        assert.ok(target);
        Object.assign(target, data);
        return { ...target };
      },
      async updateMany({ where, data }) {
        const matching = messages.filter((message) => matchesWhere(message, where));
        for (const message of matching) Object.assign(message, data);
        return { count: matching.length };
      },
    },
    auditLog: {
      async count() {
        return 0;
      },
      async create({ data }) {
        audits.push(data);
        return data;
      },
    },
    async $executeRawUnsafe(...args) {
      calls.push(['execute', args]);
      return 1;
    },
    async $queryRawUnsafe(...args) {
      calls.push(['query', args]);
      return [{ id: project.organizationId }];
    },
    async $transaction(callback) {
      return callback(database);
    },
  };
  return {
    prisma: database,
    calls,
    messages,
    sessions,
    audits,
    template,
    connection,
    project,
    worker: workerRow,
  };
}


export { NOW, FLOW_SECRET, CONFIGURED_META_ENV, access, createDatabase };
