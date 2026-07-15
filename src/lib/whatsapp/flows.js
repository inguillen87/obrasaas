import {
  createAppSecretProof,
  isValidMetaResourceId,
  MetaIntegrationError,
} from './embedded-signup.js';

export const WHATSAPP_FLOW_JSON_VERSION = '7.3';

const BLUEPRINTS = [
  {
    key: 'incident-report',
    name: 'ObraSaaS | Incidencia de obra',
    title: 'Incidencia de obra',
    description: 'Clasifica el riesgo, identifica el sector y deja el detalle listo para la bitácora.',
    screenId: 'INCIDENT_REPORT',
    flowType: 'incident',
    categories: ['OTHER'],
    capabilities: ['Severidad', 'Sector', 'Detalle trazable'],
    definition: {
      version: WHATSAPP_FLOW_JSON_VERSION,
      screens: [
        {
          id: 'INCIDENT_REPORT',
          title: 'Reportar incidencia',
          terminal: true,
          success: true,
          data: {},
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'incident_form',
                children: [
                  {
                    type: 'TextHeading',
                    text: '¿Qué pasó en la obra?',
                  },
                  {
                    type: 'TextBody',
                    text: 'Registrá la situación con datos concretos. Si existe riesgo para personas, detené la tarea y seguí el protocolo de seguridad.',
                  },
                  {
                    type: 'RadioButtonsGroup',
                    name: 'severity',
                    label: 'Nivel de severidad',
                    required: true,
                    'data-source': [
                      { id: 'low', title: 'Baja · seguimiento' },
                      { id: 'medium', title: 'Media · requiere acción' },
                      { id: 'high', title: 'Alta · detener y revisar' },
                      { id: 'critical', title: 'Crítica · emergencia' },
                    ],
                  },
                  {
                    type: 'TextInput',
                    name: 'area',
                    label: 'Sector o frente de trabajo',
                    required: true,
                  },
                  {
                    type: 'TextArea',
                    name: 'description',
                    label: 'Descripción de la incidencia',
                    required: true,
                  },
                  {
                    type: 'Footer',
                    label: 'Enviar incidencia',
                    'on-click-action': {
                      name: 'complete',
                      payload: {
                        flow_type: 'incident',
                        severity: '${form.severity}',
                        area: '${form.area}',
                        description: '${form.description}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
  {
    key: 'shift-check-in',
    name: 'ObraSaaS | Fichaje y seguridad',
    title: 'Fichaje y seguridad',
    description: 'Confirma el frente de trabajo y el estado de los elementos de protección al iniciar el turno.',
    screenId: 'SHIFT_CHECK_IN',
    flowType: 'attendance',
    categories: ['OTHER'],
    capabilities: ['Presentismo', 'Control EPP', 'Observaciones'],
    definition: {
      version: WHATSAPP_FLOW_JSON_VERSION,
      screens: [
        {
          id: 'SHIFT_CHECK_IN',
          title: 'Inicio de turno',
          terminal: true,
          success: true,
          data: {},
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'attendance_form',
                children: [
                  {
                    type: 'TextHeading',
                    text: 'Control rápido de ingreso',
                  },
                  {
                    type: 'TextBody',
                    text: 'Completá el control antes de comenzar. La ubicación se valida por separado para no mezclar permisos ni evidencias.',
                  },
                  {
                    type: 'TextInput',
                    name: 'work_area',
                    label: 'Sector o frente asignado',
                    required: true,
                  },
                  {
                    type: 'RadioButtonsGroup',
                    name: 'ppe_status',
                    label: 'Elementos de protección personal',
                    required: true,
                    'data-source': [
                      { id: 'complete', title: 'Completos y en condiciones' },
                      { id: 'incomplete', title: 'Falta o falla un elemento' },
                    ],
                  },
                  {
                    type: 'TextArea',
                    name: 'observations',
                    label: 'Observaciones (opcional)',
                    required: false,
                  },
                  {
                    type: 'Footer',
                    label: 'Confirmar ingreso',
                    'on-click-action': {
                      name: 'complete',
                      payload: {
                        flow_type: 'attendance',
                        work_area: '${form.work_area}',
                        ppe_status: '${form.ppe_status}',
                        observations: '${form.observations}',
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  },
];

function clone(value) {
  return structuredClone(value);
}

function findFooter(children) {
  for (const child of children || []) {
    if (child?.type === 'Footer') return child;
    const nested = findFooter(child?.children);
    if (nested) return nested;
  }
  return null;
}

function collectInputNames(children, names = []) {
  for (const child of children || []) {
    if (child?.name && child.type !== 'Form') names.push(child.name);
    collectInputNames(child?.children, names);
  }
  return names;
}

export function validateWhatsAppFlowDefinition(definition) {
  const errors = [];
  if (!definition || typeof definition !== 'object') return ['La definición debe ser un objeto.'];
  if (definition.version !== WHATSAPP_FLOW_JSON_VERSION) {
    errors.push(`Flow JSON debe usar la versión ${WHATSAPP_FLOW_JSON_VERSION}.`);
  }
  if (!Array.isArray(definition.screens) || definition.screens.length === 0) {
    errors.push('El Flow debe incluir al menos una pantalla.');
    return errors;
  }

  const ids = new Set();
  let terminalCount = 0;
  for (const screen of definition.screens) {
    if (!/^[A-Z][A-Z0-9_]{0,29}$/.test(String(screen?.id || ''))) {
      errors.push(`El identificador de pantalla ${screen?.id || '(vacío)'} no es válido.`);
    } else if (ids.has(screen.id)) {
      errors.push(`La pantalla ${screen.id} está duplicada.`);
    } else {
      ids.add(screen.id);
    }
    if (screen?.layout?.type !== 'SingleColumnLayout' || !Array.isArray(screen.layout.children)) {
      errors.push(`La pantalla ${screen?.id || '(sin id)'} debe usar SingleColumnLayout.`);
      continue;
    }
    if (screen.terminal) {
      terminalCount += 1;
      const footer = findFooter(screen.layout.children);
      if (!footer || footer['on-click-action']?.name !== 'complete') {
        errors.push(`La pantalla terminal ${screen.id} debe finalizar con una acción complete.`);
      } else if (!footer['on-click-action']?.payload?.flow_type) {
        errors.push(`La pantalla terminal ${screen.id} debe informar flow_type.`);
      }
    }
    const inputNames = collectInputNames(screen.layout.children);
    const duplicateNames = inputNames.filter((name, index) => inputNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push(`La pantalla ${screen.id} repite campos: ${[...new Set(duplicateNames)].join(', ')}.`);
    }
  }
  if (terminalCount === 0) errors.push('El Flow necesita al menos una pantalla terminal.');
  return errors;
}

for (const blueprint of BLUEPRINTS) {
  const errors = validateWhatsAppFlowDefinition(blueprint.definition);
  if (errors.length > 0) throw new Error(`Invalid WhatsApp Flow blueprint ${blueprint.key}: ${errors.join(' ')}`);
}

export function getWhatsAppFlowBlueprint(key) {
  const blueprint = BLUEPRINTS.find((item) => item.key === key);
  return blueprint ? clone(blueprint) : null;
}

function normalizeValidationErrors(value) {
  return Array.isArray(value)
    ? value.slice(0, 20).map((entry) => ({
        code: String(entry?.code || entry?.error || entry?.error_type || 'FLOW_VALIDATION_ERROR'),
        message: String(entry?.message || 'Meta rechazó una parte del Flow.').slice(0, 500),
        line: Number(entry?.line || entry?.line_start || 0) || null,
      }))
    : [];
}

function safeRemoteFlow(flow) {
  if (!flow) return null;
  return {
    id: String(flow.id || ''),
    name: String(flow.name || ''),
    status: String(flow.status || 'UNKNOWN'),
    categories: Array.isArray(flow.categories) ? flow.categories.map(String) : [],
    validationErrors: normalizeValidationErrors(flow.validationErrors || flow.validation_errors),
    jsonVersion: flow.jsonVersion || flow.json_version
      ? String(flow.jsonVersion || flow.json_version)
      : null,
    dataApiVersion: flow.dataApiVersion || flow.data_api_version
      ? String(flow.dataApiVersion || flow.data_api_version)
      : null,
  };
}

export function getWhatsAppFlowCatalog(remoteFlows = []) {
  return BLUEPRINTS.map((blueprint) => {
    const remote = safeRemoteFlow(remoteFlows.find((flow) => flow?.name === blueprint.name));
    return {
      key: blueprint.key,
      name: blueprint.name,
      title: blueprint.title,
      description: blueprint.description,
      screenId: blueprint.screenId,
      flowType: blueprint.flowType,
      categories: [...blueprint.categories],
      capabilities: [...blueprint.capabilities],
      version: WHATSAPP_FLOW_JSON_VERSION,
      remote: remote || {
        id: null,
        name: blueprint.name,
        status: 'NOT_CREATED',
        categories: [...blueprint.categories],
        validationErrors: [],
        jsonVersion: null,
        dataApiVersion: null,
      },
    };
  });
}

function flowConfig() {
  const appSecret = process.env.META_APP_SECRET;
  const version = process.env.META_GRAPH_API_VERSION || 'v25.0';
  if (!appSecret) {
    throw new MetaIntegrationError('La firma privada de Meta todavía no está habilitada.', {
      code: 'META_NOT_CONFIGURED',
      status: 503,
    });
  }
  return { appSecret, version };
}

async function parseMetaResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  throw new MetaIntegrationError(payload?.error?.message || fallbackMessage, {
    code: payload?.error?.code ? `META_${payload.error.code}` : 'META_GRAPH_ERROR',
    status: response.status >= 400 && response.status < 500 ? 400 : 502,
  });
}

async function flowGraphRequest({
  path,
  accessToken,
  method = 'GET',
  body,
  fetchImpl = fetch,
}) {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new MetaIntegrationError('La conexión de WhatsApp no tiene un token activo.', {
      code: 'WHATSAPP_TOKEN_MISSING',
      status: 409,
    });
  }
  const { appSecret, version } = flowConfig();
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  url.searchParams.set('appsecret_proof', createAppSecretProof(accessToken, appSecret));
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    ...(body ? { body } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  });
  return parseMetaResponse(response, 'Meta no pudo administrar el WhatsApp Flow.');
}

export async function listWhatsAppFlows({
  whatsappBusinessId,
  accessToken,
  fetchImpl = fetch,
}) {
  if (!isValidMetaResourceId(whatsappBusinessId)) {
    throw new MetaIntegrationError('La cuenta de WhatsApp conectada es inválida.', {
      code: 'INVALID_WABA_ID',
      status: 400,
    });
  }
  const result = await flowGraphRequest({
    path: `${whatsappBusinessId}/flows?limit=100`,
    accessToken,
    fetchImpl,
  });
  return Array.isArray(result.data) ? result.data.map(safeRemoteFlow) : [];
}

async function getWhatsAppFlow({ flowId, accessToken, fetchImpl }) {
  if (!isValidMetaResourceId(flowId)) {
    throw new MetaIntegrationError('Meta devolvió un identificador de Flow inválido.', {
      code: 'INVALID_FLOW_ID',
    });
  }
  return safeRemoteFlow(await flowGraphRequest({
    path: `${flowId}?fields=id,name,categories,status,validation_errors,json_version,data_api_version`,
    accessToken,
    fetchImpl,
  }));
}

export async function provisionWhatsAppFlowDraft({
  blueprintKey,
  whatsappBusinessId,
  accessToken,
  fetchImpl = fetch,
}) {
  const blueprint = getWhatsAppFlowBlueprint(blueprintKey);
  if (!blueprint) {
    throw new MetaIntegrationError('El blueprint de WhatsApp Flow no existe.', {
      code: 'FLOW_BLUEPRINT_NOT_FOUND',
      status: 400,
    });
  }

  const existingFlows = await listWhatsAppFlows({ whatsappBusinessId, accessToken, fetchImpl });
  let flow = existingFlows.find((candidate) => candidate.name === blueprint.name) || null;
  let created = false;

  if (flow && flow.status !== 'DRAFT') {
    if (flow.status === 'PUBLISHED') {
      return { blueprintKey, created: false, uploaded: false, flow };
    }
    throw new MetaIntegrationError(`El Flow existe con estado ${flow.status} y no puede actualizarse como borrador.`, {
      code: 'FLOW_NOT_EDITABLE',
      status: 409,
    });
  }

  if (!flow) {
    const createBody = new FormData();
    createBody.set('name', blueprint.name);
    createBody.set('categories', JSON.stringify(blueprint.categories));
    const createdFlow = await flowGraphRequest({
      path: `${whatsappBusinessId}/flows`,
      accessToken,
      method: 'POST',
      body: createBody,
      fetchImpl,
    });
    if (!isValidMetaResourceId(createdFlow.id)) {
      throw new MetaIntegrationError('Meta creó el borrador sin devolver un identificador válido.', {
        code: 'FLOW_ID_MISSING',
      });
    }
    flow = { id: String(createdFlow.id), name: blueprint.name, status: 'DRAFT' };
    created = true;
  }

  const uploadBody = new FormData();
  uploadBody.set(
    'file',
    new Blob([`${JSON.stringify(blueprint.definition, null, 2)}\n`], { type: 'application/json' }),
    'flow.json',
  );
  uploadBody.set('name', 'flow.json');
  uploadBody.set('asset_type', 'FLOW_JSON');
  const upload = await flowGraphRequest({
    path: `${flow.id}/assets`,
    accessToken,
    method: 'POST',
    body: uploadBody,
    fetchImpl,
  });
  const validationErrors = normalizeValidationErrors(upload.validation_errors);
  if (validationErrors.length > 0) {
    throw new MetaIntegrationError(validationErrors[0].message, {
      code: 'FLOW_JSON_REJECTED',
      status: 422,
    });
  }

  const refreshed = await getWhatsAppFlow({ flowId: flow.id, accessToken, fetchImpl });
  if (refreshed.validationErrors.length > 0) {
    throw new MetaIntegrationError(refreshed.validationErrors[0].message, {
      code: 'FLOW_JSON_REJECTED',
      status: 422,
    });
  }
  return { blueprintKey, created, uploaded: true, flow: refreshed };
}
