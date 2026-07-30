import { createHash, createPublicKey } from 'node:crypto';

import {
  createAppSecretProof,
  isValidMetaResourceId,
  MetaIntegrationError,
} from './embedded-signup.js';
import { getCurrentWorkerPaymentPrivacyNotice } from '../worker-payment-privacy-notices.js';

export const WHATSAPP_FLOW_JSON_VERSION = '7.3';
export const WHATSAPP_FLOW_DATA_API_VERSION = '4.0';
export const WHATSAPP_FLOW_SESSION_TTL_MS = Object.freeze({
  'incident-report': 4 * 60 * 60 * 1_000,
  'shift-check-in': 30 * 60 * 1_000,
  'worker-onboarding': 60 * 60 * 1_000,
  'worker-payment-destination': 30 * 60 * 1_000,
});

const FLOW_GRAPH_FIELDS = Object.freeze([
  'id',
  'name',
  'categories',
  'status',
  'validation_errors',
  'json_version',
  'data_api_version',
  'endpoint_uri',
  'data_channel_uri',
  'application',
  'health_status',
]);
const FLOW_GRAPH_FIELDS_QUERY = FLOW_GRAPH_FIELDS.join(',');
const FLOW_LIST_PAGE_SIZE = 100;
const FLOW_LIST_MAX_PAGES = 1_000;
const FLOW_PAGING_CURSOR_MAX_BYTES = 4_096;
const SCREEN_ID_PATTERN = /^[A-Z][A-Z0-9_]{0,29}$/;
const FLOW_SCOPE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PEM_PUBLIC_KEY_PATTERN = /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----$/;
const WORKER_PAYMENT_PRIVACY_NOTICE = getCurrentWorkerPaymentPrivacyNotice();

function buildOperationalContextData() {
  return {
    project_name: {
      type: 'string',
      __example__: 'Torre del Parque',
    },
    worker_name: {
      type: 'string',
      __example__: 'Alex Rojas',
    },
    work_areas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
        },
      },
      __example__: [
        { id: 'front-north', title: 'Frente norte' },
        { id: 'ground-floor', title: 'Planta baja' },
      ],
    },
  };
}

const BLUEPRINTS = [
  {
    key: 'incident-report',
    sessionTtlMs: WHATSAPP_FLOW_SESSION_TTL_MS['incident-report'],
    name: 'ObraSaaS | Incidencia de obra',
    title: 'Incidencia de obra',
    description: 'Clasifica el riesgo, identifica el sector y deja el detalle listo para la bitácora.',
    screenId: 'INCIDENT_REPORT',
    flowType: 'incident',
    categories: ['OTHER'],
    capabilities: ['Severidad', 'Sector', 'Detalle trazable'],
    message: {
      header: 'Incidencia de obra',
      body: 'Completá el reporte para que el riesgo, el sector y el detalle queden trazables en la bitácora.',
      footer: 'Si hay riesgo para personas, detené la tarea.',
      cta: 'Reportar',
    },
    definition: {
      version: WHATSAPP_FLOW_JSON_VERSION,
      data_api_version: WHATSAPP_FLOW_DATA_API_VERSION,
      routing_model: { INCIDENT_REPORT: [] },
      screens: [
        {
          id: 'INCIDENT_REPORT',
          title: 'Reportar incidencia',
          terminal: true,
          success: true,
          data: buildOperationalContextData(),
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'incident_form',
                children: [
                  { type: 'TextHeading', text: '¿Qué pasó en la obra?' },
                  {
                    type: 'TextBody',
                    text: '${data.project_name} · ${data.worker_name}',
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
                    type: 'Dropdown',
                    name: 'area',
                    label: 'Sector o frente de trabajo',
                    required: true,
                    'data-source': '${data.work_areas}',
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
                      name: 'data_exchange',
                      payload: {
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
    sessionTtlMs: WHATSAPP_FLOW_SESSION_TTL_MS['shift-check-in'],
    name: 'ObraSaaS | Fichaje y seguridad',
    title: 'Fichaje y seguridad',
    description: 'Confirma el frente de trabajo y el estado de los elementos de protección al iniciar el turno.',
    screenId: 'SHIFT_CHECK_IN',
    flowType: 'attendance',
    categories: ['OTHER'],
    capabilities: ['Presentismo', 'Control EPP', 'Observaciones'],
    message: {
      header: 'Inicio de turno',
      body: 'Confirmá tu frente de trabajo y el estado de los elementos de protección antes de comenzar.',
      footer: 'La ubicación se valida por separado.',
      cta: 'Confirmar ingreso',
    },
    definition: {
      version: WHATSAPP_FLOW_JSON_VERSION,
      data_api_version: WHATSAPP_FLOW_DATA_API_VERSION,
      routing_model: { SHIFT_CHECK_IN: [] },
      screens: [
        {
          id: 'SHIFT_CHECK_IN',
          title: 'Inicio de turno',
          terminal: true,
          success: true,
          data: buildOperationalContextData(),
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'attendance_form',
                children: [
                  { type: 'TextHeading', text: 'Control rápido de ingreso' },
                  {
                    type: 'TextBody',
                    text: '${data.project_name} · ${data.worker_name}',
                  },
                  {
                    type: 'Dropdown',
                    name: 'work_area',
                    label: 'Sector o frente asignado',
                    required: true,
                    'data-source': '${data.work_areas}',
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
                      name: 'data_exchange',
                      payload: {
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
  {
    key: 'worker-onboarding',
    sessionTtlMs: WHATSAPP_FLOW_SESSION_TTL_MS['worker-onboarding'],
    name: 'ObraSaaS | Alta segura de operario',
    title: 'Alta de operario',
    description: 'Declara la identidad laboral del contacto para que un responsable de la obra pueda revisarla.',
    screenId: 'WORKER_ONBOARDING',
    flowType: 'worker_onboarding',
    categories: ['SIGN_UP'],
    capabilities: ['Identidad declarada', 'Privacidad versionada', 'Revisión administrativa'],
    message: {
      header: 'Alta segura',
      body: 'Completá tus datos laborales. No podrás fichar ni registrar avances hasta que un responsable los revise.',
      footer: 'ObraSaaS protege tus datos personales.',
      cta: 'Completar alta',
    },
    definition: {
      version: WHATSAPP_FLOW_JSON_VERSION,
      data_api_version: WHATSAPP_FLOW_DATA_API_VERSION,
      routing_model: { WORKER_ONBOARDING: [] },
      screens: [
        {
          id: 'WORKER_ONBOARDING',
          title: 'Tus datos laborales',
          terminal: true,
          success: true,
          data: {
            project_name: {
              type: 'string',
              __example__: 'Torre del Parque',
            },
            privacy_notice_version: {
              type: 'string',
              __example__: 'worker-privacy-v2',
            },
            privacy_notice_text: {
              type: 'string',
              __example__: 'Usaremos estos datos para validar tu identidad y operar en esta obra.',
            },
            expires_label: {
              type: 'string',
              __example__: 'Esta invitación vence hoy a las 18:30.',
            },
          },
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'worker_onboarding_form',
                children: [
                  { type: 'TextHeading', text: 'Registrate para ${data.project_name}' },
                  { type: 'TextBody', text: '${data.privacy_notice_text}' },
                  { type: 'TextCaption', text: '${data.expires_label}' },
                  {
                    type: 'TextInput',
                    name: 'given_names',
                    label: 'Nombres',
                    required: true,
                  },
                  {
                    type: 'TextInput',
                    name: 'family_name',
                    label: 'Apellido',
                    required: true,
                  },
                  {
                    type: 'TextInput',
                    name: 'cuil',
                    label: 'CUIL',
                    'helper-text': 'Ingresá 11 dígitos. Se guarda cifrado.',
                    required: true,
                  },
                  {
                    type: 'OptIn',
                    name: 'privacy_accepted',
                    label: 'Acepto el aviso de privacidad indicado para esta alta.',
                    required: true,
                  },
                  {
                    type: 'Footer',
                    label: 'Enviar para revisión',
                    'on-click-action': {
                      name: 'data_exchange',
                      payload: {
                        given_names: '${form.given_names}',
                        family_name: '${form.family_name}',
                        cuil: '${form.cuil}',
                        privacy_accepted: '${form.privacy_accepted}',
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
    key: 'worker-payment-destination',
    sessionTtlMs: WHATSAPP_FLOW_SESSION_TTL_MS['worker-payment-destination'],
    name: 'ObraSaaS | Destino de cobro',
    title: 'Destino de cobro',
    description: 'Registra o confirma de forma protegida cómo quiere cobrar el operario; el estado vigente se conserva o pasa a revisión según corresponda.',
    screenId: 'WORKER_PAYMENT_DESTINATION',
    flowType: 'worker_payment_destination',
    categories: ['OTHER'],
    capabilities: ['CBU, CVU o alias cifrado', 'Aviso versionado', 'Revisión administrativa'],
    message: {
      header: 'Destino de cobro',
      body: 'Cargá o confirmá tu CBU, CVU o alias en el formulario protegido. El estado vigente se conserva o pasa a revisión según corresponda.',
      footer: 'Nunca envíes datos bancarios en el chat.',
      cta: 'Configurar cobro',
    },
    definition: {
      version: WHATSAPP_FLOW_JSON_VERSION,
      data_api_version: WHATSAPP_FLOW_DATA_API_VERSION,
      routing_model: { WORKER_PAYMENT_DESTINATION: [] },
      screens: [
        {
          id: 'WORKER_PAYMENT_DESTINATION',
          title: 'Tus datos de cobro',
          terminal: true,
          success: true,
          data: {
            project_name: {
              type: 'string',
              __example__: 'Torre del Parque',
            },
            worker_name: {
              type: 'string',
              __example__: 'Carlos Pérez',
            },
            capture_notice_version: {
              type: 'string',
              __example__: WORKER_PAYMENT_PRIVACY_NOTICE.version,
            },
            capture_notice_text: {
              type: 'string',
              __example__: WORKER_PAYMENT_PRIVACY_NOTICE.content,
            },
            expires_label: {
              type: 'string',
              __example__: 'Este formulario vence hoy a las 18:30.',
            },
          },
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'Form',
                name: 'worker_payment_destination_form',
                children: [
                  { type: 'TextHeading', text: 'Configurar cobro en ${data.project_name}' },
                  { type: 'TextBody', text: '${data.worker_name} · ${data.capture_notice_text}' },
                  { type: 'TextCaption', text: '${data.expires_label}' },
                  {
                    type: 'RadioButtonsGroup',
                    name: 'purpose',
                    label: 'Uso del destino',
                    required: true,
                    'data-source': [
                      { id: 'salary', title: 'Haberes' },
                      { id: 'reimbursement', title: 'Reintegros' },
                    ],
                  },
                  {
                    type: 'RadioButtonsGroup',
                    name: 'destination_type',
                    label: 'Tipo de cuenta',
                    required: true,
                    'data-source': [
                      { id: 'cbu', title: 'CBU' },
                      { id: 'cvu', title: 'CVU' },
                      { id: 'alias', title: 'Alias' },
                    ],
                  },
                  {
                    type: 'TextInput',
                    name: 'destination_value',
                    label: 'CBU, CVU o alias',
                    'helper-text': 'Se cifra antes de guardarse y nunca se copia al chat.',
                    required: true,
                  },
                  {
                    type: 'OptIn',
                    name: 'holder_declaration',
                    label: 'Declaro que el destino indicado está a mi nombre.',
                    required: true,
                  },
                  {
                    type: 'OptIn',
                    name: 'capture_notice_acknowledged',
                    label: 'Leí el aviso indicado y entiendo para qué se usará este dato.',
                    required: true,
                  },
                  {
                    type: 'OptIn',
                    name: 'receipt_delivery_requested',
                    label: 'Quiero recibir por WhatsApp una constancia privada, sin mostrar mis datos completos.',
                    required: false,
                  },
                  {
                    type: 'Footer',
                    label: 'Registrar o confirmar',
                    'on-click-action': {
                      name: 'data_exchange',
                      payload: {
                        purpose: '${form.purpose}',
                        destination_type: '${form.destination_type}',
                        destination_value: '${form.destination_value}',
                        holder_declaration: '${form.holder_declaration}',
                        capture_notice_acknowledged: '${form.capture_notice_acknowledged}',
                        receipt_delivery_requested: '${form.receipt_delivery_requested}',
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

// Contracts stay separate from the public blueprint DTO so every blueprint
// keeps the same outward shape. Each screen declares the
// values owned by the server, the fields the client may submit, and the fields
// that only the server may add to the terminal receipt.
const FLOW_DEFINITION_CONTRACTS = Object.freeze({
  'incident-report': Object.freeze({
    screens: Object.freeze({
      INCIDENT_REPORT: Object.freeze({
        serverOwnedFields: Object.freeze({
          project_name: Object.freeze({ type: 'string' }),
          worker_name: Object.freeze({ type: 'string' }),
          work_areas: Object.freeze({
            type: 'array',
            items: Object.freeze({
              type: 'object',
              properties: Object.freeze({
                id: Object.freeze({ type: 'string' }),
                title: Object.freeze({ type: 'string' }),
              }),
            }),
          }),
        }),
        formFields: Object.freeze({
          severity: Object.freeze({ componentTypes: Object.freeze(['RadioButtonsGroup']) }),
          area: Object.freeze({
            componentTypes: Object.freeze(['Dropdown']),
            dataSourceField: 'work_areas',
          }),
          description: Object.freeze({ componentTypes: Object.freeze(['TextArea']) }),
        }),
        terminalReceiptFields: Object.freeze({
          flow_type: Object.freeze({ type: 'string' }),
          task_ref: Object.freeze({ type: 'string', optional: true }),
        }),
        persistenceProjection: Object.freeze({
          flow_type: Object.freeze({ strategy: 'constant', value: 'incident' }),
          severity: Object.freeze({
            strategy: 'enum',
            values: Object.freeze(['low', 'medium', 'high', 'critical']),
          }),
          area: Object.freeze({ strategy: 'server-option-title' }),
          description: Object.freeze({ strategy: 'redacted-text' }),
          task_ref: Object.freeze({ strategy: 'opaque-reference' }),
        }),
      }),
    }),
  }),
  'shift-check-in': Object.freeze({
    screens: Object.freeze({
      SHIFT_CHECK_IN: Object.freeze({
        serverOwnedFields: Object.freeze({
          project_name: Object.freeze({ type: 'string' }),
          worker_name: Object.freeze({ type: 'string' }),
          work_areas: Object.freeze({
            type: 'array',
            items: Object.freeze({
              type: 'object',
              properties: Object.freeze({
                id: Object.freeze({ type: 'string' }),
                title: Object.freeze({ type: 'string' }),
              }),
            }),
          }),
        }),
        formFields: Object.freeze({
          work_area: Object.freeze({
            componentTypes: Object.freeze(['Dropdown']),
            dataSourceField: 'work_areas',
          }),
          ppe_status: Object.freeze({ componentTypes: Object.freeze(['RadioButtonsGroup']) }),
          observations: Object.freeze({ componentTypes: Object.freeze(['TextArea']) }),
        }),
        terminalReceiptFields: Object.freeze({
          flow_type: Object.freeze({ type: 'string' }),
          task_ref: Object.freeze({ type: 'string', optional: true }),
        }),
        persistenceProjection: Object.freeze({
          flow_type: Object.freeze({ strategy: 'constant', value: 'attendance' }),
          work_area: Object.freeze({ strategy: 'server-option-title' }),
          ppe_status: Object.freeze({
            strategy: 'enum',
            values: Object.freeze(['complete', 'incomplete']),
          }),
          observations: Object.freeze({ strategy: 'redacted-text' }),
          task_ref: Object.freeze({ strategy: 'opaque-reference' }),
        }),
      }),
    }),
  }),
  'worker-onboarding': Object.freeze({
    screens: Object.freeze({
      WORKER_ONBOARDING: Object.freeze({
        serverOwnedFields: Object.freeze({
          project_name: Object.freeze({ type: 'string' }),
          privacy_notice_version: Object.freeze({ type: 'string' }),
          privacy_notice_text: Object.freeze({ type: 'string' }),
          expires_label: Object.freeze({ type: 'string' }),
        }),
        formFields: Object.freeze({
          given_names: Object.freeze({ componentTypes: Object.freeze(['TextInput']) }),
          family_name: Object.freeze({ componentTypes: Object.freeze(['TextInput']) }),
          cuil: Object.freeze({ componentTypes: Object.freeze(['TextInput']) }),
          privacy_accepted: Object.freeze({ componentTypes: Object.freeze(['OptIn']) }),
        }),
        terminalReceiptFields: Object.freeze({
          flow_type: Object.freeze({ type: 'string' }),
          claim_ref: Object.freeze({ type: 'string' }),
          submission_status: Object.freeze({ type: 'string' }),
        }),
        persistenceProjection: Object.freeze({
          given_names: Object.freeze({ strategy: 'drop-sensitive' }),
          family_name: Object.freeze({ strategy: 'drop-sensitive' }),
          cuil: Object.freeze({ strategy: 'drop-sensitive' }),
          privacy_accepted: Object.freeze({ strategy: 'drop-sensitive' }),
          flow_type: Object.freeze({ strategy: 'constant', value: 'worker_onboarding' }),
          claim_ref: Object.freeze({ strategy: 'opaque-reference' }),
          submission_status: Object.freeze({ strategy: 'constant', value: 'submitted' }),
        }),
      }),
    }),
  }),
  'worker-payment-destination': Object.freeze({
    screens: Object.freeze({
      WORKER_PAYMENT_DESTINATION: Object.freeze({
        serverOwnedFields: Object.freeze({
          project_name: Object.freeze({ type: 'string' }),
          worker_name: Object.freeze({ type: 'string' }),
          capture_notice_version: Object.freeze({ type: 'string' }),
          capture_notice_text: Object.freeze({ type: 'string' }),
          expires_label: Object.freeze({ type: 'string' }),
        }),
        formFields: Object.freeze({
          purpose: Object.freeze({ componentTypes: Object.freeze(['RadioButtonsGroup']) }),
          destination_type: Object.freeze({ componentTypes: Object.freeze(['RadioButtonsGroup']) }),
          destination_value: Object.freeze({ componentTypes: Object.freeze(['TextInput']) }),
          holder_declaration: Object.freeze({ componentTypes: Object.freeze(['OptIn']) }),
          capture_notice_acknowledged: Object.freeze({ componentTypes: Object.freeze(['OptIn']) }),
          receipt_delivery_requested: Object.freeze({ componentTypes: Object.freeze(['OptIn']) }),
        }),
        terminalReceiptFields: Object.freeze({
          flow_type: Object.freeze({ type: 'string' }),
          destination_ref: Object.freeze({ type: 'string' }),
          submission_status: Object.freeze({ type: 'string' }),
        }),
        persistenceProjection: Object.freeze({
          purpose: Object.freeze({ strategy: 'drop-sensitive' }),
          destination_type: Object.freeze({ strategy: 'drop-sensitive' }),
          destination_value: Object.freeze({ strategy: 'drop-sensitive' }),
          holder_declaration: Object.freeze({ strategy: 'drop-sensitive' }),
          capture_notice_acknowledged: Object.freeze({ strategy: 'drop-sensitive' }),
          receipt_delivery_requested: Object.freeze({ strategy: 'drop-sensitive' }),
          flow_type: Object.freeze({ strategy: 'constant', value: 'worker_payment_destination' }),
          destination_ref: Object.freeze({ strategy: 'opaque-reference' }),
          submission_status: Object.freeze({ strategy: 'constant', value: 'received' }),
        }),
      }),
    }),
  }),
});

function clone(value) {
  return structuredClone(value);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectComponents(children, predicate, result = []) {
  for (const child of children || []) {
    if (predicate(child)) result.push(child);
    collectComponents(child?.children, predicate, result);
  }
  return result;
}

function validContractFieldName(value) {
  return /^[a-z][a-z0-9_]{0,63}$/.test(String(value || ''));
}

function sameFields(actual, expected) {
  const actualFields = [...actual].sort();
  const expectedFields = [...expected].sort();
  return actualFields.length === expectedFields.length
    && actualFields.every((field, index) => field === expectedFields[index]);
}

function hasOnlyKeys(value, keys) {
  return isPlainObject(value) && sameFields(Object.keys(value), keys);
}

function validPersistenceProjection(projection, formFields, terminalReceiptFields) {
  if (!isPlainObject(projection)) return false;
  const formFieldNames = Object.keys(formFields);
  const receiptFieldNames = Object.keys(terminalReceiptFields);
  if (!sameFields(Object.keys(projection), [...formFieldNames, ...receiptFieldNames])) return false;

  return Object.entries(projection).every(([field, policy]) => {
    if (!isPlainObject(policy)) return false;
    if (formFieldNames.includes(field)) {
      if (policy.strategy === 'enum') {
        return hasOnlyKeys(policy, ['strategy', 'values'])
          && Array.isArray(policy.values)
          && policy.values.length > 0
          && policy.values.length === new Set(policy.values).size
          && policy.values.every((value) => (
            typeof value === 'string' && value.length > 0 && value.length <= 100
          ));
      }
      if (policy.strategy === 'drop-sensitive') {
        return hasOnlyKeys(policy, ['strategy']);
      }
      return new Set(['server-option-title', 'redacted-text']).has(policy.strategy)
        && hasOnlyKeys(policy, ['strategy']);
    }
    if (policy.strategy === 'constant') {
      return hasOnlyKeys(policy, ['strategy', 'value'])
        && typeof policy.value === 'string'
        && policy.value.length > 0
        && policy.value.length <= 100;
    }
    return policy.strategy === 'opaque-reference'
      && hasOnlyKeys(policy, ['strategy']);
  });
}

function validFieldSchema(schema) {
  if (!isPlainObject(schema) || !['string', 'array', 'object'].includes(schema.type)) return false;
  if (schema.optional !== undefined && typeof schema.optional !== 'boolean') return false;
  if (schema.type === 'array') return validFieldSchema(schema.items);
  if (schema.type !== 'object') return true;
  return isPlainObject(schema.properties)
    && Object.entries(schema.properties).every(([field, value]) => (
      validContractFieldName(field) && validFieldSchema(value)
    ));
}

function fieldSchemaMatches(actual, expected) {
  if (!isPlainObject(actual) || !validFieldSchema(expected) || actual.type !== expected.type) {
    return false;
  }
  if (expected.type === 'array') return fieldSchemaMatches(actual.items, expected.items);
  if (expected.type !== 'object') return true;
  if (!isPlainObject(actual.properties)) return false;
  const actualFields = Object.keys(actual.properties).sort();
  const expectedFields = Object.keys(expected.properties).sort();
  return actualFields.length === expectedFields.length
    && actualFields.every((field, index) => field === expectedFields[index])
    && expectedFields.every((field) => (
      fieldSchemaMatches(actual.properties[field], expected.properties[field])
    ));
}

function definitionContractFor(definition) {
  const screenIds = Array.isArray(definition?.screens)
    ? new Set(definition.screens.map((screen) => String(screen?.id || '')))
    : new Set();
  const blueprint = BLUEPRINTS.find((candidate) => screenIds.has(candidate.screenId));
  return blueprint ? FLOW_DEFINITION_CONTRACTS[blueprint.key] || null : null;
}

function validDefinitionContract(contract) {
  if (!isPlainObject(contract) || !isPlainObject(contract.screens)) return false;
  if (Object.keys(contract.screens).length === 0) return false;
  return Object.entries(contract.screens).every(([screenId, screenContract]) => {
    if (!SCREEN_ID_PATTERN.test(screenId) || !isPlainObject(screenContract)) return false;
    const {
      serverOwnedFields,
      formFields,
      terminalReceiptFields,
      persistenceProjection,
    } = screenContract;
    if (
      !isPlainObject(serverOwnedFields)
      || !isPlainObject(formFields)
      || !isPlainObject(terminalReceiptFields)
    ) return false;
    const groups = [serverOwnedFields, formFields, terminalReceiptFields];
    if (groups.some((group) => Object.keys(group).some((field) => !validContractFieldName(field)))) {
      return false;
    }
    const allFields = groups.flatMap((group) => Object.keys(group));
    if (new Set(allFields).size !== allFields.length) return false;
    if (!Object.values(serverOwnedFields).every(validFieldSchema)) return false;
    if (!Object.values(terminalReceiptFields).every(validFieldSchema)) return false;
    if (!Object.values(formFields).every((field) => (
      isPlainObject(field)
      && Array.isArray(field.componentTypes)
      && field.componentTypes.length > 0
      && field.componentTypes.every((type) => typeof type === 'string' && type.length > 0)
      && (
        field.dataSourceField === undefined
        || (
          validContractFieldName(field.dataSourceField)
          && serverOwnedFields[field.dataSourceField]?.type === 'array'
        )
      )
    ))) return false;
    return validPersistenceProjection(
      persistenceProjection,
      formFields,
      terminalReceiptFields,
    );
  });
}

function trustedDataSchemaMatches(data, serverOwnedFields) {
  if (!isPlainObject(data)) return false;
  const actualFields = Object.keys(data).sort();
  const expectedFields = Object.keys(serverOwnedFields).sort();
  return actualFields.length === expectedFields.length
    && actualFields.every((field, index) => field === expectedFields[index])
    && expectedFields.every((field) => fieldSchemaMatches(data[field], serverOwnedFields[field]));
}

export function validateWhatsAppFlowDefinition(
  definition,
  contract = definitionContractFor(definition),
) {
  const errors = [];
  if (!isPlainObject(definition)) return ['La definición debe ser un objeto.'];
  const contractIsValid = validDefinitionContract(contract);
  if (!contractIsValid) {
    errors.push('El Flow debe declarar un contrato válido de contexto, formulario y recibo terminal.');
  }
  if (definition.version !== WHATSAPP_FLOW_JSON_VERSION) {
    errors.push(`Flow JSON debe usar la versión ${WHATSAPP_FLOW_JSON_VERSION}.`);
  }
  if (definition.data_api_version !== WHATSAPP_FLOW_DATA_API_VERSION) {
    errors.push(`Flow Data API debe usar la versión ${WHATSAPP_FLOW_DATA_API_VERSION}.`);
  }
  if (!isPlainObject(definition.routing_model)) {
    errors.push('El Flow debe declarar un routing_model válido.');
  }
  if (!Array.isArray(definition.screens) || definition.screens.length === 0) {
    errors.push('El Flow debe incluir al menos una pantalla.');
    return errors;
  }

  const ids = new Set();
  let terminalCount = 0;
  for (const screen of definition.screens) {
    const screenId = String(screen?.id || '');
    const screenContract = contractIsValid && isPlainObject(contract?.screens?.[screenId])
      ? contract.screens[screenId]
      : null;
    if (!SCREEN_ID_PATTERN.test(screenId)) {
      errors.push(`El identificador de pantalla ${screenId || '(vacío)'} no es válido.`);
    } else if (ids.has(screenId)) {
      errors.push(`La pantalla ${screenId} está duplicada.`);
    } else {
      ids.add(screenId);
    }

    const routes = definition.routing_model?.[screenId];
    if (!Array.isArray(routes) || routes.some((route) => !SCREEN_ID_PATTERN.test(String(route)))) {
      errors.push(`La pantalla ${screenId || '(sin id)'} debe tener una ruta válida en routing_model.`);
    }
    if (!screenContract) {
      errors.push(`La pantalla ${screenId || '(sin id)'} no está declarada en el contrato del Flow.`);
    } else if (!trustedDataSchemaMatches(screen?.data, screenContract.serverOwnedFields)) {
      errors.push(`La pantalla ${screenId || '(sin id)'} debe declarar el contexto confiable de obra.`);
    }
    if (screen?.layout?.type !== 'SingleColumnLayout' || !Array.isArray(screen.layout.children)) {
      errors.push(`La pantalla ${screenId || '(sin id)'} debe usar SingleColumnLayout.`);
      continue;
    }

    const inputComponents = collectComponents(
      screen.layout.children,
      (child) => typeof child?.name === 'string' && child.type !== 'Form',
    );
    const inputNames = inputComponents.map((component) => component.name);
    const duplicateNames = inputNames.filter((name, index) => inputNames.indexOf(name) !== index);
    if (duplicateNames.length > 0) {
      errors.push(`La pantalla ${screenId} repite campos: ${[...new Set(duplicateNames)].join(', ')}.`);
    }
    if (screenContract) {
      const declaredFormFields = Object.keys(screenContract.formFields);
      for (const component of inputComponents) {
        const fieldContract = screenContract.formFields[component.name];
        if (!fieldContract) {
          errors.push(`La pantalla ${screenId} contiene el campo de cliente no declarado ${component.name}.`);
          continue;
        }
        if (!fieldContract.componentTypes.includes(component.type)) {
          errors.push(`La pantalla ${screenId} usa un componente inválido para ${component.name}.`);
        }
        if (fieldContract.dataSourceField) {
          const expectedSource = `\${data.${fieldContract.dataSourceField}}`;
          if (component['data-source'] !== expectedSource) {
            errors.push(`La pantalla ${screenId} debe usar el selector dinámico declarado para ${component.name}.`);
          }
        } else if (
          typeof component['data-source'] === 'string'
          && component['data-source'].startsWith('${data.')
        ) {
          errors.push(`La pantalla ${screenId} usa contexto de servidor no declarado para ${component.name}.`);
        }
      }
      const missingFormFields = declaredFormFields.filter((field) => !inputNames.includes(field));
      if (missingFormFields.length > 0) {
        errors.push(`La pantalla ${screenId} omite campos declarados: ${missingFormFields.join(', ')}.`);
      }
    }

    if (screen?.terminal) {
      terminalCount += 1;
      const footers = collectComponents(screen.layout.children, (child) => child?.type === 'Footer');
      const action = footers[0]?.['on-click-action'];
      if (footers.length !== 1 || action?.name !== 'data_exchange') {
        errors.push(`La pantalla terminal ${screenId} debe finalizar con una acción data_exchange.`);
      } else if (!isPlainObject(action.payload)) {
        errors.push(`La pantalla terminal ${screenId} debe enviar un payload válido.`);
      } else {
        for (const field of Object.keys(screenContract?.terminalReceiptFields || {})) {
          if (Object.hasOwn(action.payload, field)) {
            errors.push(`La pantalla terminal ${screenId} no puede confiar ${field} al cliente.`);
          }
        }
        for (const [field, reference] of Object.entries(action.payload)) {
          if (!inputNames.includes(field) || reference !== `\${form.${field}}`) {
            errors.push(`La pantalla terminal ${screenId} contiene un campo de payload no confiable.`);
            break;
          }
        }
        const missingFields = inputNames.filter((field) => !Object.hasOwn(action.payload, field));
        if (missingFields.length > 0) {
          errors.push(`La pantalla terminal ${screenId} omite campos del formulario.`);
        }
      }
    }
  }

  const routingKeys = isPlainObject(definition.routing_model)
    ? Object.keys(definition.routing_model)
    : [];
  if (routingKeys.some((screenId) => !ids.has(screenId))) {
    errors.push('routing_model contiene pantallas inexistentes.');
  }
  for (const routes of Object.values(definition.routing_model || {})) {
    if (Array.isArray(routes) && routes.some((screenId) => !ids.has(String(screenId)))) {
      errors.push('routing_model referencia pantallas inexistentes.');
      break;
    }
  }
  const contractScreenIds = isPlainObject(contract?.screens) ? Object.keys(contract.screens) : [];
  if (contractScreenIds.some((screenId) => !ids.has(screenId))) {
    errors.push('El contrato del Flow declara pantallas inexistentes.');
  }
  if (terminalCount === 0) errors.push('El Flow necesita al menos una pantalla terminal.');
  return errors;
}

for (const blueprint of BLUEPRINTS) {
  const errors = validateWhatsAppFlowDefinition(
    blueprint.definition,
    FLOW_DEFINITION_CONTRACTS[blueprint.key],
  );
  if (errors.length > 0) throw new Error(`Invalid WhatsApp Flow blueprint ${blueprint.key}: ${errors.join(' ')}`);
}

export function getWhatsAppFlowDefinitionContract(key) {
  const contract = FLOW_DEFINITION_CONTRACTS[key];
  return contract ? clone(contract) : null;
}

export function getWhatsAppFlowBlueprint(key) {
  const blueprint = BLUEPRINTS.find((item) => item.key === key);
  return blueprint ? clone(blueprint) : null;
}

export function getWhatsAppFlowScopedName(blueprintKey, flowScope) {
  const blueprint = BLUEPRINTS.find((item) => item.key === blueprintKey);
  const normalizedScope = String(flowScope || '').trim().toLowerCase();
  if (!blueprint) {
    throw new MetaIntegrationError('El blueprint de WhatsApp Flow no existe.', {
      code: 'FLOW_BLUEPRINT_NOT_FOUND',
      status: 400,
    });
  }
  if (!FLOW_SCOPE_PATTERN.test(normalizedScope)) {
    throw new MetaIntegrationError('La identidad dedicada del WhatsApp Flow es inválida.', {
      code: 'FLOW_SCOPE_INVALID',
      status: 500,
    });
  }
  const suffix = createHash('sha256')
    .update(`obrasaas:whatsapp-flow:${normalizedScope}`)
    .digest('hex')
    .slice(0, 12);
  return `${blueprint.name} · ${suffix}`;
}

export function getWhatsAppFlowSessionTtlMs(key) {
  return BLUEPRINTS.find((item) => item.key === key)?.sessionTtlMs || null;
}

export class WhatsAppFlowReplyError extends Error {
  constructor(message, code = 'WHATSAPP_FLOW_REPLY_INVALID') {
    super(message);
    this.name = 'WhatsAppFlowReplyError';
    this.code = code;
  }
}

function replyText(value, { field, minLength = 0, maxLength }) {
  if (typeof value !== 'string') {
    throw new WhatsAppFlowReplyError(`WhatsApp Flow field ${field} must be text.`);
  }
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new WhatsAppFlowReplyError(`WhatsApp Flow field ${field} has an invalid length.`);
  }
  return normalized;
}

function assertReplyShape(response, allowedFields) {
  if (!isPlainObject(response)) {
    throw new WhatsAppFlowReplyError('WhatsApp Flow reply must be an object.');
  }
  if (Object.keys(response).some((field) => !allowedFields.has(field))) {
    throw new WhatsAppFlowReplyError('WhatsApp Flow reply contains unsupported fields.');
  }
}

export function validateWhatsAppFlowReply(blueprintKey, response) {
  const blueprint = getWhatsAppFlowBlueprint(blueprintKey);
  if (!blueprint) {
    throw new WhatsAppFlowReplyError('WhatsApp Flow reply references an unknown blueprint.');
  }

  if (blueprintKey === 'incident-report') {
    assertReplyShape(response, new Set([
      'flow_type',
      'severity',
      'area',
      'description',
      'task_ref',
    ]));
    if (response.flow_type !== blueprint.flowType) {
      throw new WhatsAppFlowReplyError('WhatsApp Flow reply type does not match its issued session.');
    }
    const severity = String(response.severity || '');
    if (!new Set(['low', 'medium', 'high', 'critical']).has(severity)) {
      throw new WhatsAppFlowReplyError('WhatsApp Flow incident severity is invalid.');
    }
    const taskRef = response.task_ref === undefined
      ? null
      : replyText(response.task_ref, { field: 'task_ref', minLength: 1, maxLength: 160 });
    return {
      flow_type: blueprint.flowType,
      severity,
      area: replyText(response.area, { field: 'area', minLength: 1, maxLength: 120 }),
      description: replyText(response.description, {
        field: 'description',
        minLength: 1,
        maxLength: 2_000,
      }),
      ...(taskRef ? { task_ref: taskRef } : {}),
    };
  }

  if (blueprintKey === 'shift-check-in') {
    assertReplyShape(response, new Set([
      'flow_type',
      'work_area',
      'ppe_status',
      'observations',
      'task_ref',
    ]));
    if (response.flow_type !== blueprint.flowType) {
      throw new WhatsAppFlowReplyError('WhatsApp Flow reply type does not match its issued session.');
    }
    const ppeStatus = String(response.ppe_status || '');
    if (!new Set(['complete', 'incomplete']).has(ppeStatus)) {
      throw new WhatsAppFlowReplyError('WhatsApp Flow PPE status is invalid.');
    }
    const taskRef = response.task_ref === undefined
      ? null
      : replyText(response.task_ref, { field: 'task_ref', minLength: 1, maxLength: 160 });
    return {
      flow_type: blueprint.flowType,
      work_area: replyText(response.work_area, { field: 'work_area', minLength: 1, maxLength: 120 }),
      ppe_status: ppeStatus,
      observations: replyText(response.observations ?? '', { field: 'observations', maxLength: 500 }),
      ...(taskRef ? { task_ref: taskRef } : {}),
    };
  }

  if (blueprintKey === 'worker-onboarding') {
    assertReplyShape(response, new Set([
      'flow_type',
      'claim_ref',
      'submission_status',
    ]));
    if (
      response.flow_type !== blueprint.flowType
      || response.submission_status !== 'submitted'
    ) {
      throw new WhatsAppFlowReplyError(
        'WhatsApp Flow onboarding receipt does not match its issued session.',
      );
    }
    return {
      flow_type: blueprint.flowType,
      claim_ref: replyText(response.claim_ref, {
        field: 'claim_ref',
        minLength: 1,
        maxLength: 190,
      }),
      submission_status: 'submitted',
    };
  }

  if (blueprintKey === 'worker-payment-destination') {
    assertReplyShape(response, new Set([
      'flow_type',
      'destination_ref',
      'submission_status',
    ]));
    if (
      response.flow_type !== blueprint.flowType
      || response.submission_status !== 'received'
    ) {
      throw new WhatsAppFlowReplyError(
        'WhatsApp Flow payment-destination receipt does not match its issued session.',
      );
    }
    return {
      flow_type: blueprint.flowType,
      destination_ref: replyText(response.destination_ref, {
        field: 'destination_ref',
        minLength: 1,
        maxLength: 190,
      }),
      submission_status: 'received',
    };
  }

  throw new WhatsAppFlowReplyError('WhatsApp Flow reply is not supported by this runtime.');
}

/**
 * Produce the only Flow response shape allowed in the generic webhook queue.
 * The session-bound consumer still performs the authoritative validation. This
 * early projection exists solely to keep client-controlled or future sensitive
 * fields out of generic WebhookEvent JSON, message metadata, logs and audits.
 */
export function projectWhatsAppFlowReplyForPersistence(response) {
  if (!isPlainObject(response)) return {};
  const blueprint = BLUEPRINTS.find((candidate) => candidate.flowType === response.flow_type);
  if (!blueprint) return {};

  let validated;
  try {
    validated = validateWhatsAppFlowReply(blueprint.key, response);
  } catch (error) {
    if (error instanceof WhatsAppFlowReplyError) return {};
    throw error;
  }

  const projection = FLOW_DEFINITION_CONTRACTS[blueprint.key]
    ?.screens?.[blueprint.screenId]
    ?.persistenceProjection;
  if (!isPlainObject(projection)) return {};

  const persisted = {};
  for (const [field, policy] of Object.entries(projection)) {
    if (!Object.hasOwn(validated, field)) continue;
    if (policy.strategy === 'drop-sensitive') continue;
    if (policy.strategy === 'redacted-text') {
      persisted[field] = '[contenido restringido]';
      continue;
    }
    if (policy.strategy === 'constant') {
      persisted[field] = policy.value;
      continue;
    }
    if (
      policy.strategy === 'enum'
      && !policy.values.includes(validated[field])
    ) return {};
    persisted[field] = validated[field];
  }
  return persisted;
}

export function getPublishedWhatsAppFlowReference(metadata, blueprintKey) {
  const blueprint = getWhatsAppFlowBlueprint(blueprintKey);
  if (!blueprint || !isPlainObject(metadata) || !isPlainObject(metadata.whatsappFlows)) return null;
  const stored = metadata.whatsappFlows[blueprintKey];
  const dynamic = stored?.dataExchange === true;
  let expectedName = blueprint.name;
  if (dynamic) {
    try {
      expectedName = getWhatsAppFlowScopedName(blueprintKey, stored.flowScope);
    } catch {
      return null;
    }
  }
  if (
    !isPlainObject(stored)
    || stored.status !== 'PUBLISHED'
    || !isValidMetaResourceId(stored.id)
    || stored.name !== expectedName
  ) return null;
  return {
    blueprintKey,
    id: String(stored.id),
    name: stored.name,
    screenId: blueprint.screenId,
    flowType: blueprint.flowType,
    flowAction: stored.dataExchange === true ? 'data_exchange' : 'navigate',
    message: clone(blueprint.message),
  };
}

function storedFlowMap(metadata, key) {
  return isPlainObject(metadata) && isPlainObject(metadata[key])
    ? metadata[key]
    : {};
}

function ownedStoredFlowReference(stored, blueprintKey, flowScope, whatsappBusinessId) {
  if (!isPlainObject(stored) || !isValidMetaResourceId(stored.id)) return null;
  const normalizedScope = String(flowScope || '').trim().toLowerCase();
  const normalizedBusinessId = String(whatsappBusinessId || '').trim();
  if (!isValidMetaResourceId(normalizedBusinessId)) return null;
  let expectedName;
  try {
    expectedName = getWhatsAppFlowScopedName(blueprintKey, normalizedScope);
  } catch {
    return null;
  }
  if (
    String(stored.flowScope || '').trim().toLowerCase() !== normalizedScope
    || String(stored.whatsappBusinessId || '').trim() !== normalizedBusinessId
    || stored.name !== expectedName
  ) return null;
  return stored;
}

export function getWhatsAppFlowProvisioningReference(
  metadata,
  blueprintKey,
  flowScope,
  whatsappBusinessId,
) {
  if (!getWhatsAppFlowBlueprint(blueprintKey)) return null;
  const pending = ownedStoredFlowReference(
    storedFlowMap(metadata, 'whatsappFlowDrafts')[blueprintKey],
    blueprintKey,
    flowScope,
    whatsappBusinessId,
  );
  if (pending) return { id: String(pending.id), source: 'pending' };

  // Backward compatibility: early Data Endpoint builds stored their owned DRAFT
  // in whatsappFlows. Reuse it, but never treat a legacy unscoped Flow as owned.
  const active = ownedStoredFlowReference(
    storedFlowMap(metadata, 'whatsappFlows')[blueprintKey],
    blueprintKey,
    flowScope,
    whatsappBusinessId,
  );
  return active ? { id: String(active.id), source: 'active' } : null;
}

export function reconcileWhatsAppFlowLifecycleMetadata(metadata, {
  blueprintKey,
  flow,
  flowScope,
  whatsappBusinessId,
  dataExchange,
  endpointReady,
  provisionedAt = new Date(),
}) {
  const blueprint = getWhatsAppFlowBlueprint(blueprintKey);
  if (!blueprint) {
    throw new MetaIntegrationError('El blueprint de WhatsApp Flow no existe.', {
      code: 'FLOW_BLUEPRINT_NOT_FOUND',
      status: 400,
    });
  }
  if (!isPlainObject(flow) || !isValidMetaResourceId(flow.id)) {
    throw new MetaIntegrationError('Meta devolvi\u00f3 un identificador de Flow inv\u00e1lido.', {
      code: 'INVALID_FLOW_ID',
      status: 502,
    });
  }
  const expectedName = getWhatsAppFlowScopedName(blueprintKey, flowScope);
  const normalizedBusinessId = assertMetaId(
    whatsappBusinessId,
    'La cuenta de WhatsApp conectada es inv\u00e1lida.',
    'INVALID_WABA_ID',
  );
  const timestamp = provisionedAt instanceof Date ? provisionedAt : new Date(provisionedAt);
  if (Number.isNaN(timestamp.getTime())) {
    throw new MetaIntegrationError('La fecha de provisi\u00f3n del Flow es inv\u00e1lida.', {
      code: 'FLOW_PROVISIONED_AT_INVALID',
      status: 500,
    });
  }

  const baseMetadata = isPlainObject(metadata) ? metadata : {};
  const previousFlows = storedFlowMap(baseMetadata, 'whatsappFlows');
  const previousDrafts = storedFlowMap(baseMetadata, 'whatsappFlowDrafts');
  const nextFlows = { ...previousFlows };
  const nextDrafts = { ...previousDrafts };
  const record = {
    id: String(flow.id),
    name: String(flow.name || ''),
    status: String(flow.status || 'UNKNOWN'),
    jsonVersion: flow.jsonVersion ? String(flow.jsonVersion) : null,
    dataApiVersion: flow.dataApiVersion ? String(flow.dataApiVersion) : null,
    endpointUri: flow.dataChannelUri || flow.endpointUri
      ? String(flow.dataChannelUri || flow.endpointUri)
      : null,
    applicationId: flow.applicationId ? String(flow.applicationId) : null,
    dataExchange: dataExchange === true,
    flowScope: String(flowScope || '').trim().toLowerCase(),
    whatsappBusinessId: normalizedBusinessId,
    provisionedAt: timestamp.toISOString(),
  };
  const promoted = Boolean(
    endpointReady === true
    && dataExchange === true
    && record.status === 'PUBLISHED'
    && record.name === expectedName
  );

  if (promoted) {
    nextFlows[blueprintKey] = record;
    delete nextDrafts[blueprintKey];
  } else {
    nextDrafts[blueprintKey] = record;
    const previousActive = previousFlows[blueprintKey];
    // Move the transitional pre-lifecycle DRAFT out of the active map. A real
    // published outbound reference is deliberately preserved until promotion.
    if (
      isPlainObject(previousActive)
      && String(previousActive.id || '') === record.id
      && previousActive.status !== 'PUBLISHED'
    ) delete nextFlows[blueprintKey];
  }

  return {
    metadata: {
      ...baseMetadata,
      whatsappFlows: nextFlows,
      whatsappFlowDrafts: nextDrafts,
    },
    record,
    promoted,
    activeFlow: nextFlows[blueprintKey] || null,
    pendingFlow: nextDrafts[blueprintKey] || null,
    activePreserved: Boolean(
      !promoted
      && isPlainObject(previousFlows[blueprintKey])
      && previousFlows[blueprintKey].status === 'PUBLISHED'
      && nextFlows[blueprintKey] === previousFlows[blueprintKey]
    ),
  };
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

function normalizeRemoteApplication(value) {
  if (!isPlainObject(value) || !isValidMetaResourceId(value.id)) return null;
  return {
    id: String(value.id),
    name: value.name ? String(value.name).slice(0, 200) : null,
    link: value.link ? String(value.link).slice(0, 2_048) : null,
  };
}

function safeRemoteFlow(flow) {
  if (!flow) return null;
  const application = normalizeRemoteApplication(flow.application);
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
    endpointUri: flow.endpointUri || flow.endpoint_uri
      ? String(flow.endpointUri || flow.endpoint_uri)
      : null,
    dataChannelUri: flow.dataChannelUri || flow.data_channel_uri
      ? String(flow.dataChannelUri || flow.data_channel_uri)
      : null,
    application,
    applicationId: application?.id || null,
    healthStatus: flow.healthStatus ?? flow.health_status ?? null,
  };
}

function emptyRemoteFlow(blueprint) {
  return {
    id: null,
    name: blueprint.name,
    status: 'NOT_CREATED',
    categories: [...blueprint.categories],
    validationErrors: [],
    jsonVersion: null,
    dataApiVersion: null,
    endpointUri: null,
    dataChannelUri: null,
    application: null,
    applicationId: null,
    healthStatus: null,
  };
}

export function getWhatsAppFlowCatalog(remoteFlows = [], {
  storedFlows = null,
  storedDrafts = null,
  flowScope = null,
} = {}) {
  const ownedCatalog = isPlainObject(storedFlows)
    || isPlainObject(storedDrafts)
    || flowScope !== null;
  return BLUEPRINTS.map((blueprint) => {
    const activeFlowId = isPlainObject(storedFlows?.[blueprint.key])
      && isValidMetaResourceId(storedFlows[blueprint.key].id)
      ? String(storedFlows[blueprint.key].id)
      : null;
    const pendingFlowId = isPlainObject(storedDrafts?.[blueprint.key])
      && isValidMetaResourceId(storedDrafts[blueprint.key].id)
      ? String(storedDrafts[blueprint.key].id)
      : null;
    const storedFlowId = pendingFlowId || activeFlowId;
    let scopedName = null;
    if (flowScope !== null) {
      try {
        scopedName = getWhatsAppFlowScopedName(blueprint.key, flowScope);
      } catch {
        scopedName = null;
      }
    }
    const remote = safeRemoteFlow(remoteFlows.find((flow) => (
      storedFlowId
        ? String(flow?.id || '') === storedFlowId
        : scopedName
          ? flow?.name === scopedName
          : !ownedCatalog && flow?.name === blueprint.name
    )));
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
      dataApiVersion: WHATSAPP_FLOW_DATA_API_VERSION,
      lifecycle: {
        state: pendingFlowId ? 'PENDING' : activeFlowId ? 'ACTIVE' : 'UNPROVISIONED',
        activeFlowId,
        pendingFlowId,
      },
      remote: remote || emptyRemoteFlow(blueprint),
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

async function flowGraphRequest({ path, accessToken, method = 'GET', body, fetchImpl = fetch }) {
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

function assertMetaId(value, message, code) {
  if (!isValidMetaResourceId(value)) {
    throw new MetaIntegrationError(message, { code, status: 400 });
  }
  return String(value);
}

function normalizeHttpsEndpointUri(value) {
  if (typeof value !== 'string' || value.length > 2_048) {
    throw new MetaIntegrationError('El Data Endpoint del Flow debe ser una URL HTTPS válida.', {
      code: 'FLOW_ENDPOINT_INVALID',
      status: 400,
    });
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || !url.hostname
      || url.username
      || url.password
      || url.hash
    ) throw new Error('unsafe endpoint');
    return url.toString();
  } catch {
    throw new MetaIntegrationError('El Data Endpoint del Flow debe ser una URL HTTPS válida.', {
      code: 'FLOW_ENDPOINT_INVALID',
      status: 400,
    });
  }
}

function flowListPath(businessId, after = null) {
  const search = new URLSearchParams({
    limit: String(FLOW_LIST_PAGE_SIZE),
    fields: FLOW_GRAPH_FIELDS_QUERY,
  });
  if (after) search.set('after', after);
  return `${businessId}/flows?${search.toString()}`;
}

function nextFlowPageCursor(payload, businessId) {
  const next = payload?.paging?.next;
  if (typeof next !== 'string' || !next.trim()) return null;

  let cursor = payload?.paging?.cursors?.after;
  if (typeof cursor !== 'string' || !cursor) {
    try {
      const nextUrl = new URL(next);
      if (
        nextUrl.protocol !== 'https:'
        || nextUrl.hostname !== 'graph.facebook.com'
        || nextUrl.username
        || nextUrl.password
        || !nextUrl.pathname.endsWith(`/${businessId}/flows`)
      ) throw new Error('untrusted Meta paging URL');
      cursor = nextUrl.searchParams.get('after');
    } catch {
      cursor = null;
    }
  }

  if (
    typeof cursor !== 'string'
    || !cursor
    || Buffer.byteLength(cursor, 'utf8') > FLOW_PAGING_CURSOR_MAX_BYTES
  ) {
    throw new MetaIntegrationError('Meta devolvi\u00f3 una paginaci\u00f3n de Flows inv\u00e1lida.', {
      code: 'FLOW_LIST_PAGINATION_INVALID',
      status: 502,
    });
  }
  return cursor;
}

export async function listWhatsAppFlows({
  whatsappBusinessId,
  accessToken,
  fetchImpl = fetch,
}) {
  const businessId = assertMetaId(
    whatsappBusinessId,
    'La cuenta de WhatsApp conectada es inválida.',
    'INVALID_WABA_ID',
  );
  const flows = [];
  const seenCursors = new Set();
  let after = null;

  for (let page = 0; page < FLOW_LIST_MAX_PAGES; page += 1) {
    const result = await flowGraphRequest({
      path: flowListPath(businessId, after),
      accessToken,
      fetchImpl,
    });
    if (Array.isArray(result.data)) flows.push(...result.data.map(safeRemoteFlow));

    const nextCursor = nextFlowPageCursor(result, businessId);
    if (!nextCursor) return flows;
    if (seenCursors.has(nextCursor)) {
      throw new MetaIntegrationError('Meta repiti\u00f3 un cursor al listar WhatsApp Flows.', {
        code: 'FLOW_LIST_PAGINATION_LOOP',
        status: 502,
      });
    }
    seenCursors.add(nextCursor);
    after = nextCursor;
  }

  throw new MetaIntegrationError('Meta excedi\u00f3 el l\u00edmite seguro de p\u00e1ginas de WhatsApp Flows.', {
    code: 'FLOW_LIST_PAGINATION_LIMIT',
    status: 502,
  });
}

export async function deleteOwnedWhatsAppFlowDraft({
  blueprintKey,
  whatsappBusinessId,
  accessToken,
  flowScope,
  flowId,
  fetchImpl = fetch,
}) {
  if (!getWhatsAppFlowBlueprint(blueprintKey)) {
    throw new MetaIntegrationError('El blueprint de WhatsApp Flow no existe.', {
      code: 'FLOW_BLUEPRINT_NOT_FOUND',
      status: 400,
    });
  }
  const businessId = assertMetaId(
    whatsappBusinessId,
    'La cuenta de WhatsApp conectada es inv\u00e1lida.',
    'INVALID_WABA_ID',
  );
  const id = assertMetaId(
    flowId,
    'El Flow remoto tiene un identificador inv\u00e1lido.',
    'INVALID_FLOW_ID',
  );
  const expectedName = getWhatsAppFlowScopedName(blueprintKey, flowScope);
  const flows = await listWhatsAppFlows({
    whatsappBusinessId: businessId,
    accessToken,
    fetchImpl,
  });
  const owned = flows.find((flow) => flow.id === id) || null;
  if (!owned || owned.name !== expectedName) {
    return { deleted: false, reason: 'OWNERSHIP_NOT_CONFIRMED', flowId: id };
  }
  if (owned.status !== 'DRAFT') {
    return { deleted: false, reason: 'FLOW_NOT_DRAFT', flowId: id };
  }

  const result = await flowGraphRequest({
    path: id,
    accessToken,
    method: 'DELETE',
    fetchImpl,
  });
  if (result?.success !== true) {
    throw new MetaIntegrationError('Meta no confirm\u00f3 la eliminaci\u00f3n del borrador hu\u00e9rfano.', {
      code: 'FLOW_DRAFT_DELETE_NOT_CONFIRMED',
      status: 502,
    });
  }
  return { deleted: true, reason: 'DELETED', flowId: id };
}

async function getWhatsAppFlow({ flowId, accessToken, fetchImpl }) {
  const id = assertMetaId(flowId, 'Meta devolvió un identificador de Flow inválido.', 'INVALID_FLOW_ID');
  return safeRemoteFlow(await flowGraphRequest({
    path: `${id}?fields=${encodeURIComponent(FLOW_GRAPH_FIELDS_QUERY)}`,
    accessToken,
    fetchImpl,
  }));
}

function canonicalEndpoint(value) {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

function assertProvisionedFlowContract(flow, { endpointUri, applicationId, expectedName }) {
  if (flow.validationErrors.length > 0) {
    throw new MetaIntegrationError(flow.validationErrors[0].message, {
      code: 'FLOW_JSON_REJECTED',
      status: 422,
    });
  }
  if (
    flow.jsonVersion !== WHATSAPP_FLOW_JSON_VERSION
    || flow.dataApiVersion !== WHATSAPP_FLOW_DATA_API_VERSION
    || flow.name !== expectedName
    || canonicalEndpoint(flow.dataChannelUri || flow.endpointUri) !== endpointUri
    || flow.applicationId !== applicationId
  ) {
    throw new MetaIntegrationError('Meta no confirmó el contrato dinámico completo del Flow.', {
      code: 'FLOW_DATA_ENDPOINT_NOT_CONFIRMED',
      status: 502,
    });
  }
}

export async function provisionWhatsAppFlowDraft({
  blueprintKey,
  whatsappBusinessId,
  accessToken,
  endpointUri,
  applicationId,
  flowScope,
  existingFlowId = null,
  fetchImpl = fetch,
}) {
  const blueprint = getWhatsAppFlowBlueprint(blueprintKey);
  if (!blueprint) {
    throw new MetaIntegrationError('El blueprint de WhatsApp Flow no existe.', {
      code: 'FLOW_BLUEPRINT_NOT_FOUND',
      status: 400,
    });
  }
  const normalizedEndpointUri = normalizeHttpsEndpointUri(endpointUri);
  const normalizedApplicationId = assertMetaId(
    applicationId,
    'La aplicación de Meta configurada para el Flow es inválida.',
    'INVALID_META_APP_ID',
  );
  const normalizedWhatsappBusinessId = assertMetaId(
    whatsappBusinessId,
    'La cuenta de WhatsApp conectada es inv\u00e1lida.',
    'INVALID_WABA_ID',
  );
  const scopedName = getWhatsAppFlowScopedName(blueprintKey, flowScope);
  const normalizedExistingFlowId = existingFlowId
    ? assertMetaId(
        existingFlowId,
        'El Flow almacenado tiene un identificador inválido.',
        'INVALID_FLOW_ID',
      )
    : null;

  // A stored ID is only a hint. Membership in the currently connected WABA
  // must be proven before the Flow can be configured or uploaded.
  const existingFlows = await listWhatsAppFlows({
    whatsappBusinessId: normalizedWhatsappBusinessId,
    accessToken,
    fetchImpl,
  });
  let flow = normalizedExistingFlowId
    ? existingFlows.find((candidate) => (
        candidate.id === normalizedExistingFlowId
        && candidate.name === scopedName
      )) || null
    : null;
  if (!flow) {
    flow = existingFlows.find((candidate) => candidate.name === scopedName) || null;
  }
  let created = false;

  if (flow && flow.status !== 'DRAFT') {
    if (flow.status === 'PUBLISHED') {
      return { blueprintKey, created: false, uploaded: false, configured: false, flow };
    }
    throw new MetaIntegrationError(`El Flow existe con estado ${flow.status} y no puede actualizarse como borrador.`, {
      code: 'FLOW_NOT_EDITABLE',
      status: 409,
    });
  }

  if (!flow) {
    const createBody = new FormData();
    createBody.set('name', scopedName);
    createBody.set('categories', JSON.stringify(blueprint.categories));
    const createdFlow = await flowGraphRequest({
      path: `${normalizedWhatsappBusinessId}/flows`,
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
    flow = { id: String(createdFlow.id), name: scopedName, status: 'DRAFT' };
    created = true;
  }

  const configurationBody = new FormData();
  configurationBody.set('endpoint_uri', normalizedEndpointUri);
  configurationBody.set('application_id', normalizedApplicationId);
  await flowGraphRequest({
    path: flow.id,
    accessToken,
    method: 'POST',
    body: configurationBody,
    fetchImpl,
  });

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
  assertProvisionedFlowContract(refreshed, {
    endpointUri: normalizedEndpointUri,
    applicationId: normalizedApplicationId,
    expectedName: scopedName,
  });
  return {
    blueprintKey,
    created,
    uploaded: true,
    configured: true,
    flow: refreshed,
  };
}

export function normalizeWhatsAppBusinessEncryption(payload) {
  const entry = Array.isArray(payload?.data)
    ? payload.data[0]
    : isPlainObject(payload?.data)
      ? payload.data
      : payload;
  const publicKey = typeof entry?.business_public_key === 'string'
    ? entry.business_public_key.trim().replace(/\r\n/g, '\n')
    : null;
  const signatureStatus = typeof entry?.business_public_key_signature_status === 'string'
    ? entry.business_public_key_signature_status.trim().toUpperCase()
    : null;
  return {
    publicKey,
    signatureStatus,
    signatureValid: signatureStatus === 'VALID',
  };
}

export function normalizeWhatsAppFlowPublicKey(publicKey) {
  if (typeof publicKey !== 'string' || publicKey.length > 16_384) {
    throw new MetaIntegrationError('La clave pública del Flow es inválida.', {
      code: 'FLOW_PUBLIC_KEY_INVALID',
      status: 400,
    });
  }
  try {
    const key = createPublicKey(publicKey);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength !== 2_048) {
      throw new Error('RSA-2048 required');
    }
    const normalized = key.export({ type: 'spki', format: 'pem' }).toString().trim();
    if (!PEM_PUBLIC_KEY_PATTERN.test(normalized)) throw new Error('PEM required');
    return `${normalized}\n`;
  } catch {
    throw new MetaIntegrationError('La clave pública del Flow debe ser PEM RSA de 2048 bits.', {
      code: 'FLOW_PUBLIC_KEY_INVALID',
      status: 400,
    });
  }
}

export async function getWhatsAppBusinessEncryption({
  phoneNumberId,
  accessToken,
  fetchImpl = fetch,
}) {
  const id = assertMetaId(
    phoneNumberId,
    'El número de WhatsApp conectado es inválido.',
    'INVALID_PHONE_NUMBER_ID',
  );
  const payload = await flowGraphRequest({
    path: `${id}/whatsapp_business_encryption`,
    accessToken,
    fetchImpl,
  });
  return normalizeWhatsAppBusinessEncryption(payload);
}

export async function setWhatsAppBusinessEncryption({
  phoneNumberId,
  accessToken,
  publicKey,
  fetchImpl = fetch,
}) {
  const id = assertMetaId(
    phoneNumberId,
    'El número de WhatsApp conectado es inválido.',
    'INVALID_PHONE_NUMBER_ID',
  );
  const normalizedPublicKey = normalizeWhatsAppFlowPublicKey(publicKey);
  const body = new FormData();
  body.set('business_public_key', normalizedPublicKey);
  const payload = await flowGraphRequest({
    path: `${id}/whatsapp_business_encryption`,
    accessToken,
    method: 'POST',
    body,
    fetchImpl,
  });
  return {
    success: payload?.success === true,
    publicKey: normalizedPublicKey,
  };
}

export const getWhatsAppBusinessEncryptionPublicKey = getWhatsAppBusinessEncryption;
export const setWhatsAppBusinessEncryptionPublicKey = setWhatsAppBusinessEncryption;
