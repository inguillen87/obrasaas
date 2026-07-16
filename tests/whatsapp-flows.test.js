import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getWhatsAppFlowBlueprint,
  getWhatsAppFlowCatalog,
  getWhatsAppFlowSessionTtlMs,
  getPublishedWhatsAppFlowReference,
  listWhatsAppFlows,
  provisionWhatsAppFlowDraft,
  validateWhatsAppFlowDefinition,
  validateWhatsAppFlowReply,
  WHATSAPP_FLOW_JSON_VERSION,
  WHATSAPP_FLOW_SESSION_TTL_MS,
} from '../src/lib/whatsapp/flows.js';

function withMetaSecret(callback) {
  const previous = process.env.META_APP_SECRET;
  process.env.META_APP_SECRET = 'unit-test-meta-secret';
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      if (previous === undefined) delete process.env.META_APP_SECRET;
      else process.env.META_APP_SECRET = previous;
    });
}

test('ObraSaaS blueprints use the current Flow JSON contract', () => {
  const catalog = getWhatsAppFlowCatalog();
  assert.equal(WHATSAPP_FLOW_JSON_VERSION, '7.3');
  assert.deepEqual(catalog.map((item) => item.key), ['incident-report', 'shift-check-in']);
  for (const item of catalog) {
    const blueprint = getWhatsAppFlowBlueprint(item.key);
    assert.deepEqual(validateWhatsAppFlowDefinition(blueprint.definition), []);
    assert.equal(blueprint.definition.version, '7.3');
    assert.equal(item.remote.status, 'NOT_CREATED');
  }
});

test('Flow session lifetime follows the operational risk of each blueprint', () => {
  assert.equal(
    getWhatsAppFlowSessionTtlMs('shift-check-in'),
    30 * 60 * 1_000,
  );
  assert.equal(
    getWhatsAppFlowSessionTtlMs('incident-report'),
    4 * 60 * 60 * 1_000,
  );
  assert.equal(
    getWhatsAppFlowBlueprint('incident-report').sessionTtlMs,
    WHATSAPP_FLOW_SESSION_TTL_MS['incident-report'],
  );
  assert.equal(getWhatsAppFlowSessionTtlMs('unknown-flow'), null);
});

test('local Flow validation rejects duplicate screens and incomplete terminal actions', () => {
  const definition = getWhatsAppFlowBlueprint('incident-report').definition;
  definition.screens.push(structuredClone(definition.screens[0]));
  definition.screens[0].layout.children[0].children.at(-1)['on-click-action'].name = 'navigate';
  const errors = validateWhatsAppFlowDefinition(definition);
  assert.equal(errors.some((error) => error.includes('duplicada')), true);
  assert.equal(errors.some((error) => error.includes('complete')), true);
});

test('runtime references require an exact published Flow cached for the tenant', () => {
  const metadata = {
    whatsappFlows: {
      'incident-report': {
        id: '987654321012345',
        name: 'ObraSaaS | Incidencia de obra',
        status: 'PUBLISHED',
      },
    },
  };
  const reference = getPublishedWhatsAppFlowReference(metadata, 'incident-report');
  assert.equal(reference.id, '987654321012345');
  assert.equal(reference.screenId, 'INCIDENT_REPORT');
  assert.equal(reference.message.cta, 'Reportar');
  assert.equal(getPublishedWhatsAppFlowReference(metadata, 'shift-check-in'), null);
  metadata.whatsappFlows['incident-report'].status = 'DRAFT';
  assert.equal(getPublishedWhatsAppFlowReference(metadata, 'incident-report'), null);
});

test('Flow replies are validated against the server-owned issued blueprint', () => {
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
});

test('Flow replies reject client routing overrides and malformed fields', () => {
  const validIncident = {
    flow_type: 'incident',
    severity: 'medium',
    area: 'PB',
    description: 'DescripciÃ³n acotada',
  };
  assert.throws(
    () => validateWhatsAppFlowReply('incident-report', {
      ...validIncident,
      flow_type: 'attendance',
    }),
    (error) => error.code === 'WHATSAPP_FLOW_REPLY_INVALID',
  );
  assert.throws(
    () => validateWhatsAppFlowReply('incident-report', {
      ...validIncident,
      delete_project: true,
    }),
    (error) => error.code === 'WHATSAPP_FLOW_REPLY_INVALID',
  );
  assert.throws(
    () => validateWhatsAppFlowReply('shift-check-in', {
      flow_type: 'attendance',
      work_area: 'PB',
      ppe_status: 'approved-by-client',
      observations: '',
    }),
    (error) => error.code === 'WHATSAPP_FLOW_REPLY_INVALID',
  );
  assert.throws(
    () => validateWhatsAppFlowReply('incident-report', {
      ...validIncident,
      description: 'x'.repeat(2_001),
    }),
    (error) => error.code === 'WHATSAPP_FLOW_REPLY_INVALID',
  );
});

test('Flow catalog reads Meta with token-bound appsecret proof', async () => withMetaSecret(async () => {
  let request;
  const flows = await listWhatsAppFlows({
    whatsappBusinessId: '123456789012345',
    accessToken: 'tenant-access-token',
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return Response.json({
        data: [{
          id: '987654321012345',
          name: 'ObraSaaS | Incidencia de obra',
          status: 'DRAFT',
          categories: ['OTHER'],
          validation_errors: [{ error: 'INVALID_PROPERTY', message: 'Campo inválido', line_start: 8 }],
          json_version: '7.3',
        }],
      });
    },
  });
  assert.equal(flows[0].status, 'DRAFT');
  const catalogItem = getWhatsAppFlowCatalog(flows)[0];
  assert.equal(catalogItem.remote.jsonVersion, '7.3');
  assert.equal(catalogItem.remote.validationErrors[0].line, 8);
  assert.equal(request.options.headers.Authorization, 'Bearer tenant-access-token');
  assert.match(request.url.searchParams.get('appsecret_proof'), /^[a-f0-9]{64}$/);
  assert.equal(request.url.pathname, '/v25.0/123456789012345/flows');
}));

test('draft provisioning creates, uploads and re-reads a Flow without publishing it', async () => withMetaSecret(async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method || 'GET';
    calls.push({ path: parsed.pathname, method, body: options.body });
    if (method === 'GET' && parsed.pathname.endsWith('/123456789012345/flows')) {
      return Response.json({ data: [] });
    }
    if (method === 'POST' && parsed.pathname.endsWith('/123456789012345/flows')) {
      assert.equal(options.body.get('name'), 'ObraSaaS | Incidencia de obra');
      assert.equal(options.body.get('categories'), '["OTHER"]');
      return Response.json({ id: '987654321012345' });
    }
    if (parsed.pathname.endsWith('/987654321012345/assets')) {
      assert.equal(options.body.get('name'), 'flow.json');
      assert.equal(options.body.get('asset_type'), 'FLOW_JSON');
      assert.equal(options.body.get('file').name, 'flow.json');
      return Response.json({ success: true, validation_errors: [] });
    }
    return Response.json({
      id: '987654321012345',
      name: 'ObraSaaS | Incidencia de obra',
      status: 'DRAFT',
      categories: ['OTHER'],
      validation_errors: [],
      json_version: '7.3',
    });
  };

  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'incident-report',
    whatsappBusinessId: '123456789012345',
    accessToken: 'tenant-access-token',
    fetchImpl,
  });
  assert.equal(result.created, true);
  assert.equal(result.uploaded, true);
  assert.equal(result.flow.jsonVersion, '7.3');
  assert.deepEqual(calls.map(({ path, method }) => [path, method]), [
    ['/v25.0/123456789012345/flows', 'GET'],
    ['/v25.0/123456789012345/flows', 'POST'],
    ['/v25.0/987654321012345/assets', 'POST'],
    ['/v25.0/987654321012345', 'GET'],
  ]);
  assert.equal(calls.some(({ path }) => path.endsWith('/publish')), false);
}));

test('published Flows are never overwritten by the provisioner', async () => withMetaSecret(async () => {
  let callCount = 0;
  const result = await provisionWhatsAppFlowDraft({
    blueprintKey: 'shift-check-in',
    whatsappBusinessId: '123456789012345',
    accessToken: 'tenant-access-token',
    fetchImpl: async () => {
      callCount += 1;
      return Response.json({
        data: [{
          id: '987654321012346',
          name: 'ObraSaaS | Fichaje y seguridad',
          status: 'PUBLISHED',
          categories: ['OTHER'],
          validation_errors: [],
          json_version: '7.3',
        }],
      });
    },
  });
  assert.equal(callCount, 1);
  assert.equal(result.uploaded, false);
  assert.equal(result.flow.status, 'PUBLISHED');
}));
