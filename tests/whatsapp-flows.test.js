import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  deleteOwnedWhatsAppFlowDraft,
  getPublishedWhatsAppFlowReference,
  getWhatsAppBusinessEncryption,
  getWhatsAppBusinessEncryptionPublicKey,
  getWhatsAppFlowBlueprint,
  getWhatsAppFlowCatalog,
  getWhatsAppFlowProvisioningReference,
  getWhatsAppFlowScopedName,
  getWhatsAppFlowSessionTtlMs,
  listWhatsAppFlows,
  normalizeWhatsAppBusinessEncryption,
  normalizeWhatsAppFlowPublicKey,
  provisionWhatsAppFlowDraft,
  reconcileWhatsAppFlowLifecycleMetadata,
  setWhatsAppBusinessEncryption,
  setWhatsAppBusinessEncryptionPublicKey,
  validateWhatsAppFlowDefinition,
  validateWhatsAppFlowReply,
  WHATSAPP_FLOW_DATA_API_VERSION,
  WHATSAPP_FLOW_JSON_VERSION,
  WHATSAPP_FLOW_SESSION_TTL_MS,
} from '../src/lib/whatsapp/flows.js';

const WABA_ID = '123456789012345';
const PHONE_NUMBER_ID = '223456789012345';
const APPLICATION_ID = '323456789012345';
const FLOW_ID = '987654321012345';
const FLOW_SCOPE = '987e4567-e89b-42d3-a456-426614174000';
const SECOND_FLOW_SCOPE = '123e4567-e89b-42d3-a456-426614174000';
const ENDPOINT_URI = `https://obrasaas.vercel.app/api/webhooks/whatsapp/flows/${FLOW_SCOPE}`;
const ACCESS_TOKEN = 'tenant-access-token';
const SCOPED_INCIDENT_NAME = getWhatsAppFlowScopedName('incident-report', FLOW_SCOPE);
const SCOPED_SHIFT_NAME = getWhatsAppFlowScopedName('shift-check-in', FLOW_SCOPE);

const { publicKey: RSA_2048_PUBLIC_KEY } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2_048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const { publicKey: RSA_1024_PUBLIC_KEY } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 1_024,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function withMetaSecret(callback) {
  const previousSecret = process.env.META_APP_SECRET;
  const previousVersion = process.env.META_GRAPH_API_VERSION;
  process.env.META_APP_SECRET = 'unit-test-meta-secret';
  process.env.META_GRAPH_API_VERSION = 'v25.0';
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previousSecret === undefined) delete process.env.META_APP_SECRET;
      else process.env.META_APP_SECRET = previousSecret;
      if (previousVersion === undefined) delete process.env.META_GRAPH_API_VERSION;
      else process.env.META_GRAPH_API_VERSION = previousVersion;
    });
}

function terminalForm(blueprint) {
  return blueprint.definition.screens[0].layout.children[0];
}

function terminalFooter(blueprint) {
  return terminalForm(blueprint).children.find((component) => component.type === 'Footer');
}

function remoteFlow(overrides = {}) {
  return {
    id: FLOW_ID,
    name: 'ObraSaaS | Incidencia de obra',
    status: 'DRAFT',
    categories: ['OTHER'],
    validation_errors: [],
    json_version: '7.3',
    data_api_version: '4.0',
    endpoint_uri: ENDPOINT_URI,
    data_channel_uri: ENDPOINT_URI,
    application: { id: APPLICATION_ID, name: 'ObraSaaS' },
    health_status: { can_send_message: 'AVAILABLE', entities: [] },
    ...overrides,
  };
}

test('ObraSaaS blueprints use Flow JSON 7.3 and the dynamic Data API 4.0 contract', () => {
  const catalog = getWhatsAppFlowCatalog();
  assert.equal(WHATSAPP_FLOW_JSON_VERSION, '7.3');
  assert.equal(WHATSAPP_FLOW_DATA_API_VERSION, '4.0');
  assert.deepEqual(catalog.map((item) => item.key), ['incident-report', 'shift-check-in']);

  for (const item of catalog) {
    const blueprint = getWhatsAppFlowBlueprint(item.key);
    const screen = blueprint.definition.screens[0];
    const form = terminalForm(blueprint);
    const footer = terminalFooter(blueprint);
    const areaField = item.key === 'incident-report' ? 'area' : 'work_area';
    const area = form.children.find((component) => component.name === areaField);

    assert.deepEqual(validateWhatsAppFlowDefinition(blueprint.definition), []);
    assert.equal(blueprint.definition.version, '7.3');
    assert.equal(blueprint.definition.data_api_version, '4.0');
    assert.deepEqual(blueprint.definition.routing_model, { [screen.id]: [] });
    assert.deepEqual(Object.keys(screen.data).sort(), ['project_name', 'work_areas', 'worker_name']);
    assert.equal(screen.data.work_areas.items.properties.id.type, 'string');
    assert.equal(screen.data.work_areas.items.properties.title.type, 'string');
    assert.equal(area.type, 'Dropdown');
    assert.equal(area['data-source'], '${data.work_areas}');
    assert.equal(footer['on-click-action'].name, 'data_exchange');
    assert.equal(Object.hasOwn(footer['on-click-action'].payload, 'flow_type'), false);
    assert.equal(item.dataApiVersion, '4.0');
    assert.equal(item.remote.status, 'NOT_CREATED');
  }
});

test('Flow session lifetime follows each blueprint operational risk', () => {
  assert.equal(getWhatsAppFlowSessionTtlMs('shift-check-in'), 30 * 60 * 1_000);
  assert.equal(getWhatsAppFlowSessionTtlMs('incident-report'), 4 * 60 * 60 * 1_000);
  assert.equal(
    getWhatsAppFlowBlueprint('incident-report').sessionTtlMs,
    WHATSAPP_FLOW_SESSION_TTL_MS['incident-report'],
  );
  assert.equal(getWhatsAppFlowSessionTtlMs('unknown-flow'), null);
});

test('local Flow validation fails closed on routing, data, dynamic options, and terminal payloads', () => {
  const cases = [
    {
      mutate(definition) {
        definition.screens.push(structuredClone(definition.screens[0]));
      },
      expected: 'duplicada',
    },
    {
      mutate(definition) {
        definition.data_api_version = '3.0';
      },
      expected: '4.0',
    },
    {
      mutate(definition) {
        definition.routing_model.INCIDENT_REPORT = ['MISSING'];
      },
      expected: 'inexistentes',
    },
    {
      mutate(definition) {
        delete definition.screens[0].data.worker_name;
      },
      expected: 'contexto confiable',
    },
    {
      mutate(definition) {
        terminalForm({ definition }).children.find((entry) => entry.name === 'area')['data-source'] = [];
      },
      expected: 'selector dinámico',
    },
    {
      mutate(definition) {
        terminalFooter({ definition })['on-click-action'].name = 'complete';
      },
      expected: 'data_exchange',
    },
    {
      mutate(definition) {
        terminalFooter({ definition })['on-click-action'].payload.flow_type = 'incident';
      },
      expected: 'flow_type',
    },
    {
      mutate(definition) {
        terminalFooter({ definition })['on-click-action'].payload.area = '${data.project_name}';
      },
      expected: 'payload no confiable',
    },
  ];

  for (const scenario of cases) {
    const definition = getWhatsAppFlowBlueprint('incident-report').definition;
    scenario.mutate(definition);
    const errors = validateWhatsAppFlowDefinition(definition);
    assert.equal(
      errors.some((error) => error.includes(scenario.expected)),
      true,
      `Expected ${scenario.expected} in ${errors.join(' | ')}`,
    );
  }
});

test('published references activate data_exchange only when tenant metadata confirms it', () => {
  const metadata = {
    whatsappFlows: {
      'incident-report': {
        id: FLOW_ID,
        name: 'ObraSaaS | Incidencia de obra',
        status: 'PUBLISHED',
      },
    },
  };
  const legacy = getPublishedWhatsAppFlowReference(metadata, 'incident-report');
  assert.equal(legacy.flowAction, 'navigate');
  assert.equal(legacy.id, FLOW_ID);
  assert.equal(legacy.screenId, 'INCIDENT_REPORT');

  metadata.whatsappFlows['incident-report'].dataExchange = true;
  assert.equal(getPublishedWhatsAppFlowReference(metadata, 'incident-report'), null);
  metadata.whatsappFlows['incident-report'].flowScope = FLOW_SCOPE;
  metadata.whatsappFlows['incident-report'].name = SCOPED_INCIDENT_NAME;
  assert.equal(
    getPublishedWhatsAppFlowReference(metadata, 'incident-report').flowAction,
    'data_exchange',
  );
  metadata.whatsappFlows['incident-report'].dataExchange = 'true';
  metadata.whatsappFlows['incident-report'].name = 'ObraSaaS | Incidencia de obra';
  assert.equal(
    getPublishedWhatsAppFlowReference(metadata, 'incident-report').flowAction,
    'navigate',
  );
  metadata.whatsappFlows['incident-report'].status = 'DRAFT';
  assert.equal(getPublishedWhatsAppFlowReference(metadata, 'incident-report'), null);
  assert.equal(getPublishedWhatsAppFlowReference(metadata, 'shift-check-in'), null);
});

test('a scoped pending Flow is reused without claiming the legacy published outbound Flow', () => {
  const metadata = {
    whatsappFlows: {
      'incident-report': {
        id: FLOW_ID,
        name: 'ObraSaaS | Incidencia de obra',
        status: 'PUBLISHED',
      },
    },
    whatsappFlowDrafts: {
      'incident-report': {
        id: '987654321012346',
        name: SCOPED_INCIDENT_NAME,
        status: 'DRAFT',
        flowScope: FLOW_SCOPE,
        whatsappBusinessId: WABA_ID,
      },
    },
  };

  assert.deepEqual(
    getWhatsAppFlowProvisioningReference(metadata, 'incident-report', FLOW_SCOPE, WABA_ID),
    { id: '987654321012346', source: 'pending' },
  );
  assert.equal(
    getWhatsAppFlowProvisioningReference(
      metadata,
      'incident-report',
      FLOW_SCOPE,
      PHONE_NUMBER_ID,
    ),
    null,
  );
  delete metadata.whatsappFlowDrafts['incident-report'];
  assert.equal(
    getWhatsAppFlowProvisioningReference(metadata, 'incident-report', FLOW_SCOPE, WABA_ID),
    null,
  );

  metadata.whatsappFlows['incident-report'] = {
    id: '987654321012346',
    name: SCOPED_INCIDENT_NAME,
    status: 'DRAFT',
    flowScope: FLOW_SCOPE,
    whatsappBusinessId: WABA_ID,
  };
  assert.deepEqual(
    getWhatsAppFlowProvisioningReference(metadata, 'incident-report', FLOW_SCOPE, WABA_ID),
    { id: '987654321012346', source: 'active' },
  );
});

test('a scoped DRAFT is pending and cannot replace a legacy published outbound Flow', () => {
  const legacyActive = {
    id: FLOW_ID,
    name: 'ObraSaaS | Incidencia de obra',
    status: 'PUBLISHED',
  };
  const lifecycle = reconcileWhatsAppFlowLifecycleMetadata({
    whatsappFlows: { 'incident-report': legacyActive },
    unrelated: { preserved: true },
  }, {
    blueprintKey: 'incident-report',
    flow: remoteFlow({
      id: '987654321012346',
      name: SCOPED_INCIDENT_NAME,
      status: 'DRAFT',
    }),
    flowScope: FLOW_SCOPE,
    whatsappBusinessId: WABA_ID,
    dataExchange: true,
    endpointReady: true,
    provisionedAt: new Date('2026-07-17T02:00:00.000Z'),
  });

  assert.equal(lifecycle.promoted, false);
  assert.equal(lifecycle.activePreserved, true);
  assert.deepEqual(lifecycle.metadata.whatsappFlows['incident-report'], legacyActive);
  assert.equal(lifecycle.metadata.whatsappFlowDrafts['incident-report'].id, '987654321012346');
  assert.equal(lifecycle.metadata.whatsappFlowDrafts['incident-report'].whatsappBusinessId, WABA_ID);
  assert.equal(lifecycle.metadata.unrelated.preserved, true);
  assert.equal(
    getPublishedWhatsAppFlowReference(lifecycle.metadata, 'incident-report').id,
    FLOW_ID,
  );

  const catalog = getWhatsAppFlowCatalog([
    remoteFlow({ id: FLOW_ID, status: 'PUBLISHED' }),
    remoteFlow({ id: '987654321012346', name: SCOPED_INCIDENT_NAME }),
  ], {
    storedFlows: lifecycle.metadata.whatsappFlows,
    storedDrafts: lifecycle.metadata.whatsappFlowDrafts,
    flowScope: FLOW_SCOPE,
  });
  assert.equal(catalog[0].remote.id, '987654321012346');
  assert.deepEqual(catalog[0].lifecycle, {
    state: 'PENDING',
    activeFlowId: FLOW_ID,
    pendingFlowId: '987654321012346',
  });
});

test('a pending Flow is promoted only after Meta returns a verified dynamic PUBLISHED contract', () => {
  const pendingId = '987654321012346';
  const baseMetadata = {
    whatsappFlows: {
      'incident-report': {
        id: FLOW_ID,
        name: 'ObraSaaS | Incidencia de obra',
        status: 'PUBLISHED',
      },
    },
    whatsappFlowDrafts: {
      'incident-report': {
        id: pendingId,
        name: SCOPED_INCIDENT_NAME,
        status: 'DRAFT',
        flowScope: FLOW_SCOPE,
        whatsappBusinessId: WABA_ID,
      },
    },
  };
  const published = remoteFlow({
    id: pendingId,
    name: SCOPED_INCIDENT_NAME,
    status: 'PUBLISHED',
  });

  const unverified = reconcileWhatsAppFlowLifecycleMetadata(baseMetadata, {
    blueprintKey: 'incident-report',
    flow: published,
    flowScope: FLOW_SCOPE,
    whatsappBusinessId: WABA_ID,
    dataExchange: false,
    endpointReady: true,
  });
  assert.equal(unverified.promoted, false);
  assert.equal(unverified.metadata.whatsappFlows['incident-report'].id, FLOW_ID);
  assert.equal(unverified.metadata.whatsappFlowDrafts['incident-report'].id, pendingId);

  const promoted = reconcileWhatsAppFlowLifecycleMetadata(unverified.metadata, {
    blueprintKey: 'incident-report',
    flow: published,
    flowScope: FLOW_SCOPE,
    whatsappBusinessId: WABA_ID,
    dataExchange: true,
    endpointReady: true,
  });
  assert.equal(promoted.promoted, true);
  assert.equal(promoted.metadata.whatsappFlows['incident-report'].id, pendingId);
  assert.equal(promoted.metadata.whatsappFlows['incident-report'].dataExchange, true);
  assert.equal(promoted.metadata.whatsappFlows['incident-report'].whatsappBusinessId, WABA_ID);
  assert.equal(Object.hasOwn(promoted.metadata.whatsappFlowDrafts, 'incident-report'), false);
  assert.equal(
    getPublishedWhatsAppFlowReference(promoted.metadata, 'incident-report').flowAction,
    'data_exchange',
  );
});

test('Flow replies accept only the server-owned blueprint contract', () => {
  assert.deepEqual(validateWhatsAppFlowReply('incident-report', {
    flow_type: 'incident',
    severity: 'high',
    area: '  Planta   baja ',
    description: '  Fisura visible en el apoyo. ',
  }), {
    flow_type: 'incident',
    severity: 'high',
    area: 'Planta baja',
    description: 'Fisura visible en el apoyo.',
  });
  assert.deepEqual(validateWhatsAppFlowReply('shift-check-in', {
    flow_type: 'attendance',
    work_area: 'Frente norte',
    ppe_status: 'complete',
    observations: '',
  }), {
    flow_type: 'attendance',
    work_area: 'Frente norte',
    ppe_status: 'complete',
    observations: '',
  });

  const validIncident = {
    flow_type: 'incident',
    severity: 'medium',
    area: 'PB',
    description: 'Descripción acotada',
  };
  for (const invalid of [
    { ...validIncident, flow_type: 'attendance' },
    { ...validIncident, delete_project: true },
    { ...validIncident, severity: 'approved-by-client' },
    { ...validIncident, description: 'x'.repeat(2_001) },
  ]) {
    assert.throws(
      () => validateWhatsAppFlowReply('incident-report', invalid),
      (error) => error.code === 'WHATSAPP_FLOW_REPLY_INVALID',
    );
  }
});

test('Flow catalog reads endpoint, application, Data API and health fields with appsecret proof', async () => withMetaSecret(async () => {
  let request;
  const flows = await listWhatsAppFlows({
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return Response.json({ data: [remoteFlow({
        validation_errors: [{ error: 'INVALID_PROPERTY', message: 'Campo inválido', line_start: 8 }],
      })] });
    },
  });
  assert.equal(flows[0].dataApiVersion, '4.0');
  assert.equal(flows[0].endpointUri, ENDPOINT_URI);
  assert.equal(flows[0].dataChannelUri, ENDPOINT_URI);
  assert.equal(flows[0].applicationId, APPLICATION_ID);
  assert.equal(flows[0].healthStatus.can_send_message, 'AVAILABLE');
  assert.equal(flows[0].validationErrors[0].line, 8);

  const catalogItem = getWhatsAppFlowCatalog(flows)[0];
  assert.equal(catalogItem.remote.application.name, 'ObraSaaS');
  assert.equal(request.options.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
  assert.match(request.url.searchParams.get('appsecret_proof'), /^[a-f0-9]{64}$/);
  assert.equal(request.url.pathname, `/v25.0/${WABA_ID}/flows`);
  assert.equal(request.url.searchParams.get('limit'), '100');
  for (const field of ['endpoint_uri', 'data_channel_uri', 'application', 'health_status']) {
    assert.equal(request.url.searchParams.get('fields').split(',').includes(field), true);
  }
}));

test('Flow listing follows every Meta cursor without following provider-supplied URLs', async () => withMetaSecret(async () => {
  const requests = [];
  const flows = await listWhatsAppFlows({
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      requests.push(parsed);
      if (!parsed.searchParams.has('after')) {
        return Response.json({
          data: [remoteFlow({ id: '987654321012301', name: 'First page' })],
          paging: {
            cursors: { after: 'cursor-page-two' },
            // The implementation uses the cursor but reconstructs the request
            // against Graph instead of following this untrusted URL.
            next: 'https://attacker.example/steal?after=cursor-page-two',
          },
        });
      }
      assert.equal(parsed.hostname, 'graph.facebook.com');
      assert.equal(parsed.searchParams.get('after'), 'cursor-page-two');
      return Response.json({
        data: [remoteFlow({ id: FLOW_ID, name: SCOPED_INCIDENT_NAME })],
        paging: { cursors: { after: 'last-page-cursor' } },
      });
    },
  });

  assert.deepEqual(flows.map((flow) => flow.id), ['987654321012301', FLOW_ID]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].searchParams.get('limit'), '100');
  assert.equal(requests[1].searchParams.get('fields').includes('data_channel_uri'), true);
  assert.match(requests[1].searchParams.get('appsecret_proof'), /^[a-f0-9]{64}$/);
}));

test('draft provisioning reuses an owned Flow found after the first WABA page', async () => withMetaSecret(async () => {
  let listPage = 0;
  let createCalls = 0;
  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'incident-report',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    endpointUri: ENDPOINT_URI,
    applicationId: APPLICATION_ID,
    flowScope: FLOW_SCOPE,
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const method = options.method || 'GET';
      if (method === 'GET' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
        listPage += 1;
        if (!parsed.searchParams.has('after')) {
          return Response.json({
            data: [remoteFlow({ id: '987654321012301', name: 'Another Flow' })],
            paging: {
              cursors: { after: 'owned-page' },
              next: `https://graph.facebook.com/v25.0/${WABA_ID}/flows?after=owned-page`,
            },
          });
        }
        return Response.json({
          data: [remoteFlow({ id: FLOW_ID, name: SCOPED_INCIDENT_NAME })],
        });
      }
      if (method === 'POST' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
        createCalls += 1;
      }
      if (method === 'GET' && parsed.pathname === `/v25.0/${FLOW_ID}`) {
        return Response.json(remoteFlow({ name: SCOPED_INCIDENT_NAME }));
      }
      return Response.json({ success: true, validation_errors: [] });
    },
  });

  assert.equal(listPage, 2);
  assert.equal(createCalls, 0);
  assert.equal(result.created, false);
  assert.equal(result.flow.id, FLOW_ID);
}));

test('orphan compensation deletes only the exact owned DRAFT in the current WABA', async () => withMetaSecret(async () => {
  const calls = [];
  const deleted = await deleteOwnedWhatsAppFlowDraft({
    blueprintKey: 'incident-report',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    flowScope: FLOW_SCOPE,
    flowId: FLOW_ID,
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const method = options.method || 'GET';
      calls.push([parsed.pathname, method]);
      if (method === 'GET') {
        return Response.json({
          data: [remoteFlow({ id: FLOW_ID, name: SCOPED_INCIDENT_NAME, status: 'DRAFT' })],
        });
      }
      return Response.json({ success: true });
    },
  });
  assert.equal(deleted.deleted, true);
  assert.deepEqual(calls, [
    [`/v25.0/${WABA_ID}/flows`, 'GET'],
    [`/v25.0/${FLOW_ID}`, 'DELETE'],
  ]);

  for (const remote of [
    remoteFlow({ id: FLOW_ID, name: 'Foreign scoped name', status: 'DRAFT' }),
    remoteFlow({ id: FLOW_ID, name: SCOPED_INCIDENT_NAME, status: 'PUBLISHED' }),
  ]) {
    let deleteCalls = 0;
    const retained = await deleteOwnedWhatsAppFlowDraft({
      blueprintKey: 'incident-report',
      whatsappBusinessId: WABA_ID,
      accessToken: ACCESS_TOKEN,
      flowScope: FLOW_SCOPE,
      flowId: FLOW_ID,
      fetchImpl: async (_url, options = {}) => {
        if ((options.method || 'GET') === 'DELETE') deleteCalls += 1;
        return Response.json({ data: [remote] });
      },
    });
    assert.equal(retained.deleted, false);
    assert.equal(deleteCalls, 0);
  }
}));

test('draft provisioning configures endpoint and application, uploads JSON, then verifies Meta state', async () => withMetaSecret(async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method || 'GET';
    calls.push({ path: parsed.pathname, method, body: options.body, search: parsed.searchParams });

    if (method === 'GET' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
      return Response.json({ data: [] });
    }
    if (method === 'POST' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
      assert.equal(options.body.get('name'), SCOPED_INCIDENT_NAME);
      assert.equal(options.body.get('categories'), '["OTHER"]');
      return Response.json({ id: FLOW_ID });
    }
    if (method === 'POST' && parsed.pathname === `/v25.0/${FLOW_ID}`) {
      assert.equal(options.body.get('endpoint_uri'), ENDPOINT_URI);
      assert.equal(options.body.get('application_id'), APPLICATION_ID);
      return Response.json({ success: true });
    }
    if (method === 'POST' && parsed.pathname === `/v25.0/${FLOW_ID}/assets`) {
      assert.equal(options.body.get('name'), 'flow.json');
      assert.equal(options.body.get('asset_type'), 'FLOW_JSON');
      const file = options.body.get('file');
      assert.equal(file.name, 'flow.json');
      const definition = JSON.parse(await file.text());
      assert.equal(definition.version, '7.3');
      assert.equal(definition.data_api_version, '4.0');
      assert.equal(
        definition.screens[0].layout.children[0].children.at(-1)['on-click-action'].name,
        'data_exchange',
      );
      return Response.json({ success: true, validation_errors: [] });
    }
    assert.equal(method, 'GET');
    assert.equal(parsed.pathname, `/v25.0/${FLOW_ID}`);
    assert.equal(parsed.searchParams.get('fields').includes('data_channel_uri'), true);
    return Response.json(remoteFlow({ name: SCOPED_INCIDENT_NAME }));
  };

  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'incident-report',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    endpointUri: ENDPOINT_URI,
    applicationId: APPLICATION_ID,
    flowScope: FLOW_SCOPE,
    fetchImpl,
  });
  assert.equal(result.created, true);
  assert.equal(result.configured, true);
  assert.equal(result.uploaded, true);
  assert.equal(result.flow.dataApiVersion, '4.0');
  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
    [`/v25.0/${WABA_ID}/flows`, 'GET'],
    [`/v25.0/${WABA_ID}/flows`, 'POST'],
    [`/v25.0/${FLOW_ID}`, 'POST'],
    [`/v25.0/${FLOW_ID}/assets`, 'POST'],
    [`/v25.0/${FLOW_ID}`, 'GET'],
  ]);
  assert.equal(calls.some(({ path }) => path.endsWith('/publish')), false);
}));

test('two connections under one WABA provision distinct owned Flow names', async () => withMetaSecret(async () => {
  async function provisionForScope(scope, flowId) {
    const scopedName = getWhatsAppFlowScopedName('incident-report', scope);
    const endpointUri = `https://obrasaas.vercel.app/api/webhooks/whatsapp/flows/${scope}`;
    let createdName = null;
    const result = await provisionWhatsAppFlowDraft({
      blueprintKey: 'incident-report',
      whatsappBusinessId: WABA_ID,
      accessToken: ACCESS_TOKEN,
      endpointUri,
      applicationId: APPLICATION_ID,
      flowScope: scope,
      fetchImpl: async (url, options = {}) => {
        const parsed = new URL(url);
        const method = options.method || 'GET';
        if (method === 'GET' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
          return Response.json({ data: [] });
        }
        if (method === 'POST' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
          createdName = options.body.get('name');
          return Response.json({ id: flowId });
        }
        if (method === 'GET' && parsed.pathname === `/v25.0/${flowId}`) {
          return Response.json(remoteFlow({
            id: flowId,
            name: scopedName,
            endpoint_uri: endpointUri,
            data_channel_uri: endpointUri,
          }));
        }
        return Response.json({ success: true, validation_errors: [] });
      },
    });
    return { result, createdName };
  }

  const first = await provisionForScope(FLOW_SCOPE, FLOW_ID);
  const second = await provisionForScope(SECOND_FLOW_SCOPE, '987654321012346');
  assert.equal(first.createdName, SCOPED_INCIDENT_NAME);
  assert.notEqual(first.createdName, second.createdName);
  assert.notEqual(first.result.flow.id, second.result.flow.id);
}));

test('stored Flow ownership is confirmed by exact ID and scoped name inside the current WABA', async () => withMetaSecret(async () => {
  const calls = [];
  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'incident-report',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    endpointUri: ENDPOINT_URI,
    applicationId: APPLICATION_ID,
    flowScope: FLOW_SCOPE,
    existingFlowId: FLOW_ID,
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const method = options.method || 'GET';
      calls.push([parsed.pathname, method]);
      if (method === 'GET' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
        return Response.json({ data: [remoteFlow({ name: SCOPED_INCIDENT_NAME })] });
      }
      if (method === 'GET') {
        assert.equal(parsed.pathname, `/v25.0/${FLOW_ID}`);
        return Response.json(remoteFlow({ name: SCOPED_INCIDENT_NAME }));
      }
      return Response.json({ success: true, validation_errors: [] });
    },
  });
  assert.equal(result.created, false);
  assert.deepEqual(calls, [
    [`/v25.0/${WABA_ID}/flows`, 'GET'],
    [`/v25.0/${FLOW_ID}`, 'POST'],
    [`/v25.0/${FLOW_ID}/assets`, 'POST'],
    [`/v25.0/${FLOW_ID}`, 'GET'],
  ]);
}));

test('an existing Flow ID outside the current WABA is never fetched or mutated', async () => withMetaSecret(async () => {
  const foreignFlowId = '987654321012399';
  const currentFlowId = '987654321012346';
  const calls = [];
  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'incident-report',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    endpointUri: ENDPOINT_URI,
    applicationId: APPLICATION_ID,
    flowScope: FLOW_SCOPE,
    existingFlowId: foreignFlowId,
    fetchImpl: async (url, options = {}) => {
      const parsed = new URL(url);
      const method = options.method || 'GET';
      calls.push([parsed.pathname, method]);
      if (method === 'GET' && parsed.pathname === `/v25.0/${WABA_ID}/flows`) {
        return Response.json({
          data: [remoteFlow({
            id: currentFlowId,
            name: SCOPED_INCIDENT_NAME,
          })],
        });
      }
      if (method === 'GET' && parsed.pathname === `/v25.0/${currentFlowId}`) {
        return Response.json(remoteFlow({
          id: currentFlowId,
          name: SCOPED_INCIDENT_NAME,
        }));
      }
      assert.equal(parsed.pathname.startsWith(`/v25.0/${currentFlowId}`), true);
      return Response.json({ success: true, validation_errors: [] });
    },
  });

  assert.equal(result.flow.id, currentFlowId);
  assert.equal(calls.some(([path]) => path.startsWith(`/v25.0/${foreignFlowId}`)), false);
  assert.deepEqual(calls.map(([path, method]) => [path, method]), [
    [`/v25.0/${WABA_ID}/flows`, 'GET'],
    [`/v25.0/${currentFlowId}`, 'POST'],
    [`/v25.0/${currentFlowId}/assets`, 'POST'],
    [`/v25.0/${currentFlowId}`, 'GET'],
  ]);
}));

test('draft provisioning rejects unconfirmed dynamic configuration', async () => withMetaSecret(async () => {
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith(`/${WABA_ID}/flows`)) {
      return Response.json({ data: [remoteFlow({ name: SCOPED_INCIDENT_NAME })] });
    }
    if ((options.method || 'GET') === 'POST') {
      return Response.json({ success: true, validation_errors: [] });
    }
    return Response.json(remoteFlow({
      name: SCOPED_INCIDENT_NAME,
      data_api_version: '3.0',
      data_channel_uri: 'https://attacker.example/flow',
    }));
  };
  await assert.rejects(
    provisionWhatsAppFlowDraft({
      blueprintKey: 'incident-report',
      whatsappBusinessId: WABA_ID,
      accessToken: ACCESS_TOKEN,
      endpointUri: ENDPOINT_URI,
      applicationId: APPLICATION_ID,
      flowScope: FLOW_SCOPE,
      fetchImpl,
    }),
    (error) => error.code === 'FLOW_DATA_ENDPOINT_NOT_CONFIRMED' && error.status === 502,
  );
}));

test('published Flows are never configured, uploaded, or overwritten', async () => withMetaSecret(async () => {
  let callCount = 0;
  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'shift-check-in',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    endpointUri: ENDPOINT_URI,
    applicationId: APPLICATION_ID,
    flowScope: FLOW_SCOPE,
    fetchImpl: async () => {
      callCount += 1;
      return Response.json({ data: [remoteFlow({
        id: '987654321012346',
        name: SCOPED_SHIFT_NAME,
        status: 'PUBLISHED',
      })] });
    },
  });
  assert.equal(callCount, 1);
  assert.equal(result.configured, false);
  assert.equal(result.uploaded, false);
  assert.equal(result.flow.status, 'PUBLISHED');
}));

test('provisioning rejects non-HTTPS endpoints and invalid application IDs before Graph calls', async () => {
  let calls = 0;
  const base = {
    blueprintKey: 'incident-report',
    whatsappBusinessId: WABA_ID,
    accessToken: ACCESS_TOKEN,
    applicationId: APPLICATION_ID,
    flowScope: FLOW_SCOPE,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ data: [] });
    },
  };
  await assert.rejects(
    provisionWhatsAppFlowDraft({ ...base, endpointUri: 'http://obrasaas.local/flow' }),
    (error) => error.code === 'FLOW_ENDPOINT_INVALID',
  );
  await assert.rejects(
    provisionWhatsAppFlowDraft({ ...base, endpointUri: ENDPOINT_URI, applicationId: 'not-meta' }),
    (error) => error.code === 'INVALID_META_APP_ID',
  );
  assert.equal(calls, 0);
});

test('WhatsApp encryption GET normalizes signature validity and POST sends canonical RSA-2048 PEM', async () => withMetaSecret(async () => {
  assert.equal(getWhatsAppBusinessEncryptionPublicKey, getWhatsAppBusinessEncryption);
  assert.equal(setWhatsAppBusinessEncryptionPublicKey, setWhatsAppBusinessEncryption);
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, method: options.method || 'GET', body: options.body });
    if ((options.method || 'GET') === 'POST') {
      assert.equal(options.body.get('business_public_key'), normalizeWhatsAppFlowPublicKey(RSA_2048_PUBLIC_KEY));
      return Response.json({ success: true });
    }
    return Response.json({
      data: [{
        business_public_key: RSA_2048_PUBLIC_KEY,
        business_public_key_signature_status: 'valid',
      }],
    });
  };

  const current = await getWhatsAppBusinessEncryption({
    phoneNumberId: PHONE_NUMBER_ID,
    accessToken: ACCESS_TOKEN,
    fetchImpl,
  });
  assert.equal(current.signatureStatus, 'VALID');
  assert.equal(current.signatureValid, true);
  assert.equal(current.publicKey.includes('BEGIN PUBLIC KEY'), true);

  const updated = await setWhatsAppBusinessEncryption({
    phoneNumberId: PHONE_NUMBER_ID,
    accessToken: ACCESS_TOKEN,
    publicKey: RSA_2048_PUBLIC_KEY,
    fetchImpl,
  });
  assert.equal(updated.success, true);
  assert.equal(updated.publicKey, normalizeWhatsAppFlowPublicKey(RSA_2048_PUBLIC_KEY));
  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
    [`/v25.0/${PHONE_NUMBER_ID}/whatsapp_business_encryption`, 'GET'],
    [`/v25.0/${PHONE_NUMBER_ID}/whatsapp_business_encryption`, 'POST'],
  ]);
}));

test('WhatsApp encryption helpers fail closed on invalid key material and signature states', async () => {
  assert.deepEqual(normalizeWhatsAppBusinessEncryption({
    business_public_key: RSA_2048_PUBLIC_KEY,
    business_public_key_signature_status: 'pending',
  }), {
    publicKey: RSA_2048_PUBLIC_KEY.trim(),
    signatureStatus: 'PENDING',
    signatureValid: false,
  });
  assert.throws(
    () => normalizeWhatsAppFlowPublicKey(RSA_1024_PUBLIC_KEY),
    (error) => error.code === 'FLOW_PUBLIC_KEY_INVALID',
  );
  assert.throws(
    () => normalizeWhatsAppFlowPublicKey('not a PEM key'),
    (error) => error.code === 'FLOW_PUBLIC_KEY_INVALID',
  );
  await assert.rejects(
    getWhatsAppBusinessEncryption({
      phoneNumberId: 'bad-id',
      accessToken: ACCESS_TOKEN,
      fetchImpl: async () => {
        throw new Error('must not fetch');
      },
    }),
    (error) => error.code === 'INVALID_PHONE_NUMBER_ID',
  );
});
