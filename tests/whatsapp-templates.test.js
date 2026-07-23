import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOwnedWhatsAppFlowTemplate,
  listWhatsAppMessageTemplates,
  provisionOwnedWhatsAppFlowTemplate,
  remoteTemplateMatchesDefinition,
  synchronizeWhatsAppTemplateStatus,
} from '../src/lib/whatsapp/templates.js';

const CONNECTION = {
  id: 'connection-template-a',
  projectId: 'project-a',
  whatsappBusinessId: '123456789012345',
  metadata: {
    whatsappFlows: {
      'incident-report': {
        id: '987654321012345',
        name: 'ObraSaaS | Incidencia de obra',
        status: 'PUBLISHED',
        dataExchange: false,
      },
    },
  },
};
const ACCESS_TOKEN = 'tenant-template-access-token';
const APP_SECRET = 'tenant-template-app-secret';

function remoteFromDefinition(definition, overrides = {}) {
  return {
    id: '555555555555555',
    name: definition.name,
    status: 'APPROVED',
    category: definition.category,
    language: definition.language,
    components: definition.components,
    ...overrides,
  };
}

function createTemplateStore() {
  const records = [];
  return {
    records,
    prisma: {
      whatsAppFlowTemplate: {
        async findUnique({ where }) {
          const key = where.connectionId_name_language;
          return records.find((item) => (
            item.connectionId === key.connectionId
            && item.name === key.name
            && item.language === key.language
          )) || null;
        },
        async upsert({ where, create, update }) {
          const key = where.connectionId_name_language;
          const index = records.findIndex((item) => (
            item.connectionId === key.connectionId
            && item.name === key.name
            && item.language === key.language
          ));
          if (index === -1) {
            const record = { id: `local-${records.length + 1}`, ...create };
            records.push(record);
            return record;
          }
          records[index] = { ...records[index], ...update };
          return records[index];
        },
        async updateMany({ where, data }) {
          const matches = records.filter((item) => Object.entries(where).every(([key, value]) => (
            item[key] === value
          )));
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
        },
      },
    },
  };
}

test('owned Flow templates have a deterministic tenant-scoped identity and official button', () => {
  const first = buildOwnedWhatsAppFlowTemplate({
    connection: CONNECTION,
    blueprintKey: 'incident-report',
  });
  const second = buildOwnedWhatsAppFlowTemplate({
    connection: CONNECTION,
    blueprintKey: 'incident-report',
  });

  assert.equal(first.name, second.name);
  assert.match(first.name, /^obrasaas_incident_report_[a-f0-9]{10}_[a-f0-9]{10}$/);
  assert.match(first.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(first.language, 'es_AR');
  assert.equal(first.category, 'UTILITY');
  assert.deepEqual(first.components[1].buttons[0], {
    type: 'FLOW',
    text: 'Reportar',
    flow_id: '987654321012345',
    flow_action: 'navigate',
    navigate_screen: 'INCIDENT_REPORT',
  });
  assert.equal(remoteTemplateMatchesDefinition(remoteFromDefinition(first), first), true);
});

test('template listing follows Meta cursors with appsecret proof and stops without next', async () => {
  const definition = buildOwnedWhatsAppFlowTemplate({
    connection: CONNECTION,
    blueprintKey: 'incident-report',
  });
  const calls = [];
  const pages = [
    {
      data: [remoteFromDefinition(definition)],
      paging: {
        cursors: { after: 'cursor-page-two' },
        next: 'https://graph.facebook.com/v25.0/123456789012345/message_templates?after=cursor-page-two',
      },
    },
    {
      data: [remoteFromDefinition(definition, {
        id: '666666666666666',
        name: 'foreign_template',
      })],
      paging: { cursors: { after: 'unused-final-cursor' } },
    },
  ];
  const result = await listWhatsAppMessageTemplates({
    whatsappBusinessId: CONNECTION.whatsappBusinessId,
    accessToken: ACCESS_TOKEN,
    appSecret: APP_SECRET,
    version: 'v25.0',
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      return Response.json(pages.shift());
    },
  });

  assert.equal(result.length, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url.searchParams.get('appsecret_proof'), /^[a-f0-9]{64}$/);
  assert.equal(calls[1].url.searchParams.get('after'), 'cursor-page-two');
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
});

test('provisioning adopts only an exact owned template and fails closed on content drift', async () => {
  const definition = buildOwnedWhatsAppFlowTemplate({
    connection: CONNECTION,
    blueprintKey: 'incident-report',
  });
  const store = createTemplateStore();
  const exact = remoteFromDefinition(definition);
  let calls = 0;
  const result = await provisionOwnedWhatsAppFlowTemplate({
    prisma: store.prisma,
    connection: CONNECTION,
    blueprintKey: 'incident-report',
    accessToken: ACCESS_TOKEN,
    appSecret: APP_SECRET,
    version: 'v25.0',
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ data: [exact] });
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.created, false);
  assert.equal(result.template.canSend, true);
  assert.equal(store.records.length, 1);
  assert.equal(store.records[0].whatsappBusinessId, CONNECTION.whatsappBusinessId);

  const drifted = remoteFromDefinition(definition, {
    components: [
      { type: 'BODY', text: 'Contenido ajeno' },
      definition.components[1],
    ],
  });
  await assert.rejects(
    provisionOwnedWhatsAppFlowTemplate({
      prisma: store.prisma,
      connection: CONNECTION,
      blueprintKey: 'incident-report',
      accessToken: ACCESS_TOKEN,
      appSecret: APP_SECRET,
      version: 'v25.0',
      fetchImpl: async () => Response.json({ data: [drifted] }),
    }),
    (error) => error.code === 'WHATSAPP_TEMPLATE_OWNERSHIP_CONFLICT',
  );
});

test('provisioning creates the deterministic template while ignoring foreign records', async () => {
  const definition = buildOwnedWhatsAppFlowTemplate({
    connection: CONNECTION,
    blueprintKey: 'incident-report',
  });
  const store = createTemplateStore();
  const calls = [];
  const result = await provisionOwnedWhatsAppFlowTemplate({
    prisma: store.prisma,
    connection: CONNECTION,
    blueprintKey: 'incident-report',
    accessToken: ACCESS_TOKEN,
    appSecret: APP_SECRET,
    version: 'v25.0',
    fetchImpl: async (url, init) => {
      calls.push({ url: new URL(url), init });
      if (init.method === 'GET') {
        return Response.json({
          data: [{
            id: '777777777777777',
            name: 'customer_owned_template',
            status: 'APPROVED',
            category: 'UTILITY',
            language: 'es_AR',
            components: [],
          }],
        });
      }
      const body = JSON.parse(init.body);
      assert.equal(body.name, definition.name);
      assert.deepEqual(body.components, definition.components);
      return Response.json({ id: '888888888888888', status: 'PENDING', category: 'UTILITY' });
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(result.created, true);
  assert.equal(result.template.status, 'PENDING');
  assert.equal(result.template.canSend, false);
  assert.equal(store.records[0].name, definition.name);
});

test('template status webhooks update only the exact owned row in the same WABA', async () => {
  const writes = [];
  const prisma = {
    whatsAppConnection: {
      async findFirst() {
        return { id: CONNECTION.id, whatsappBusinessId: CONNECTION.whatsappBusinessId };
      },
    },
    whatsAppFlowTemplate: {
      async updateMany(query) {
        writes.push(query);
        return { count: 1 };
      },
    },
  };
  const event = {
    field: 'message_template_status_update',
    event: 'APPROVED',
    whatsappBusinessId: CONNECTION.whatsappBusinessId,
    value: { message_template_id: '555555555555555', reason: null },
  };
  const scope = {
    projectId: CONNECTION.projectId,
    whatsappBusinessId: CONNECTION.whatsappBusinessId,
  };
  const result = await synchronizeWhatsAppTemplateStatus(event, scope, { prisma });

  assert.deepEqual(result, { updated: true, status: 'APPROVED' });
  assert.deepEqual(writes[0].where, {
    connectionId: CONNECTION.id,
    whatsappBusinessId: CONNECTION.whatsappBusinessId,
    providerTemplateId: '555555555555555',
  });

  const stale = await synchronizeWhatsAppTemplateStatus(
    { ...event, whatsappBusinessId: '999999999999999' },
    scope,
    { prisma },
  );
  assert.deepEqual(stale, { updated: false, reason: 'scope_mismatch' });
  assert.equal(writes.length, 1);
});
