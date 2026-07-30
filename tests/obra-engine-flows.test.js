import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';
import {
  deserializeWebhookPayload,
  serializeWebhookPayload,
} from '../src/lib/webhook-queue.js';

const { processIncomingObraMessage } = await tsImport(
  '../src/lib/whatsapp/obra-engine.js',
  { parentURL: import.meta.url, tsconfig: './jsconfig.json' },
);

const projectId = 'project-meta-flow';
const phoneNumberId = '123456789012345';
const worker = {
  id: 'worker-meta-flow',
  projectId,
  phone: '+5491112345678',
  name: 'Jefa de obra',
  role: 'Jefa de obra',
  active: true,
  metadata: { whatsappRole: 'SITE_MANAGER' },
};

function emptyState() {
  return {
    attendance: {},
    incidents: [],
    tasks: {},
    alertsCount: 0,
    operariosCount: 0,
  };
}

function incidentEvent(response = {}) {
  return {
    externalId: 'wamid.meta-flow-incident',
    provider: 'meta',
    phoneNumberId,
    from: worker.phone,
    kind: 'interactive',
    interactive: {
      type: 'flow',
      response: {
        flow_type: 'incident',
        severity: 'high',
        area: 'Planta baja',
        description: 'Pérdida de agua junto al tablero.',
        task_ref: 'task-structure-02',
        ...response,
      },
    },
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  };
}

function incidentSession(overrides = {}) {
  return {
    id: '1f967f35-9f99-4db0-bd42-2d88f734cc72',
    projectId,
    workerId: worker.id,
    phoneNumberId,
    blueprintKey: 'incident-report',
    flowType: 'incident',
    ...overrides,
  };
}

function attendanceEvent(response = {}) {
  return {
    externalId: 'wamid.meta-flow-attendance',
    provider: 'meta',
    phoneNumberId,
    from: worker.phone,
    kind: 'interactive',
    interactive: {
      type: 'flow',
      response: {
        flow_type: 'attendance',
        work_area: 'Estructura nivel 2',
        ppe_status: 'complete',
        observations: 'Sin novedades',
        task_ref: 'task-structure-02',
        ...response,
      },
    },
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  };
}

function attendanceSession(overrides = {}) {
  return {
    id: '0b6574a4-2c4e-49a4-a05e-e8747f1bd035',
    projectId,
    workerId: worker.id,
    phoneNumberId,
    blueprintKey: 'shift-check-in',
    flowType: 'attendance',
    ...overrides,
  };
}

function paymentEvent(response = {}) {
  return {
    externalId: 'wamid.meta-flow-payment',
    provider: 'meta',
    phoneNumberId,
    from: worker.phone,
    kind: 'interactive',
    interactive: {
      type: 'flow',
      response: {
        flow_type: 'worker_payment_destination',
        destination_ref: 'destination-opaque-a',
        submission_status: 'received',
        ...response,
      },
    },
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  };
}

function paymentSession(overrides = {}) {
  return {
    id: '2f967f35-9f99-4db0-bd42-2d88f734cc72',
    projectId,
    workerId: worker.id,
    phoneNumberId,
    blueprintKey: 'worker-payment-destination',
    flowType: 'worker_payment_destination',
    ...overrides,
  };
}

function engineOptions(state, flowSession, overrides = {}) {
  return {
    state,
    projectSettings: {
      id: projectId,
      organizationId: 'organization-meta-flow',
      latitude: -34.6,
      longitude: -58.4,
      geofenceMeters: 150,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    worker,
    flowSession,
    prisma: {},
    persist: false,
    ...overrides,
  };
}

test('a valid Meta Flow uses the trusted session and persists only non-secret references', async () => {
  const state = emptyState();
  const session = incidentSession();
  const sensitiveDescription = 'CUIT 20-12345678-9 y CBU 0000000000000000000000';
  const persistedEvent = deserializeWebhookPayload(serializeWebhookPayload(
    incidentEvent({ description: sensitiveDescription }),
    {
      projectId,
      organizationId: 'organization-meta-flow',
      phoneNumberId,
    },
  )).event;
  assert.equal(
    persistedEvent.interactive.response.description,
    '[contenido restringido]',
  );
  const result = await processIncomingObraMessage(
    persistedEvent,
    {
      projectId,
      organizationId: 'organization-meta-flow',
      phoneNumberId,
    },
    engineOptions(state, session),
  );

  assert.equal(result.intent, 'INCIDENT');
  assert.equal(result.stateChanged, true);
  assert.equal(state.incidents.length, 1);
  assert.equal(state.incidents[0].type, 'critical');
  assert.equal(state.incidents[0].metadata.taskRef, 'task-structure-02');
  assert.equal(state.incidents[0].metadata.workArea, 'Planta baja');
  assert.equal(state.alertsCount, 1);
  assert.equal(result.newMessages[0].metadata.whatsappFlowSessionId, session.id);
  assert.equal(
    result.newMessages[0].metadata.whatsappFlowBlueprintKey,
    'incident-report',
  );
  assert.equal(JSON.stringify(result.newMessages).includes('flow_token'), false);
  assert.equal(JSON.stringify(result.newMessages).includes('tokenSha256'), false);
  assert.equal(JSON.stringify({ result, state }).includes(sensitiveDescription), false);
  assert.equal(JSON.stringify(result.newMessages).includes('20-12345678-9'), false);
  assert.equal(JSON.stringify(result.newMessages).includes('0000000000000000000000'), false);
});

test('a payment receipt is acknowledged without creating incidents or mutating obra state', async () => {
  const state = emptyState();
  const before = structuredClone(state);
  const persistedEvent = deserializeWebhookPayload(serializeWebhookPayload(
    paymentEvent(),
    {
      projectId,
      organizationId: 'organization-meta-flow',
      phoneNumberId,
    },
  )).event;
  const result = await processIncomingObraMessage(
    persistedEvent,
    { projectId, organizationId: 'organization-meta-flow', phoneNumberId },
    engineOptions(state, paymentSession()),
  );

  assert.equal(result.intent, 'PAYMENT_DESTINATION');
  assert.equal(result.stateChanged, false);
  assert.deepEqual(state, before);
  assert.match(result.reply, /Destino de cobro recibido/u);
  assert.equal(result.newMessages.length, 2);
  assert.equal(result.newMessages[0].metadata.whatsappFlowSessionId, paymentSession().id);
  assert.equal(JSON.stringify(result.newMessages).includes('destination-opaque-a'), false);
  assert.equal(JSON.stringify(result.newMessages).includes('destination_ref'), false);
});

test('a verified worker can request the protected payment Flow from natural text', async () => {
  const state = emptyState();
  const before = structuredClone(state);
  const result = await processIncomingObraMessage({
    externalId: 'wamid.payment-request',
    provider: 'meta',
    phoneNumberId,
    from: worker.phone,
    kind: 'text',
    text: 'Quiero configurar como cobro el sueldo',
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  }, {
    projectId,
    organizationId: 'organization-meta-flow',
    phoneNumberId,
  }, engineOptions(state, null, { workerPaymentFlowEligible: true }));

  assert.equal(result.intent, 'PAYMENT_DESTINATION');
  assert.equal(result.flowPrompt, 'worker-payment-destination');
  assert.equal(result.stateChanged, false);
  assert.deepEqual(state, before);
  assert.match(result.reply, /formulario protegido/u);
  assert.match(result.reply, /No envíes datos bancarios/u);
});

test('payment self-service fails closed until identity and channel are verified', async () => {
  const state = emptyState();
  const result = await processIncomingObraMessage({
    externalId: 'wamid.payment-request-unverified',
    provider: 'meta',
    phoneNumberId,
    from: worker.phone,
    kind: 'text',
    text: 'datos de cobro',
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  }, {
    projectId,
    organizationId: 'organization-meta-flow',
    phoneNumberId,
  }, engineOptions(state, null, { workerPaymentFlowEligible: false }));

  assert.equal(result.intent, 'PAYMENT_DESTINATION');
  assert.equal(result.flowPrompt, null);
  assert.equal(result.stateChanged, false);
  assert.match(result.reply, /verificar tu identidad laboral/u);
  assert.match(result.reply, /no envíes CBU, CVU ni alias/u);
});

test('attendance Flow persists its server-owned task and work-area references', async () => {
  const state = emptyState();
  state.attendance[worker.id] = {
    workerId: worker.id,
    name: worker.name,
    role: worker.role,
    checkin: '08:00',
    checkout: '17:00',
    breakStartedAt: '12:00',
    breakEndedAt: '12:30',
    status: 'Jornada cerrada · revisar ubicación',
    shiftId: 'previous-closed-shift',
    shiftState: 'CLOSED',
    lastEventType: 'CHECK_OUT',
    reviewRequired: true,
  };
  const createdEntries = [];
  const prisma = {
    attendanceEntry: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: async ({ data }) => {
        createdEntries.push(data);
        return { id: 'attendance-meta-flow', ...data };
      },
    },
  };
  const sensitiveObservations = 'Alias sueldo.carlos y CBU 0000000000000000000000';
  const persistedEvent = deserializeWebhookPayload(serializeWebhookPayload(
    attendanceEvent({ observations: sensitiveObservations }),
    {
      projectId,
      organizationId: 'organization-meta-flow',
      phoneNumberId,
    },
  )).event;
  assert.equal(
    persistedEvent.interactive.response.observations,
    '[contenido restringido]',
  );
  const result = await processIncomingObraMessage(
    persistedEvent,
    { projectId, organizationId: 'organization-meta-flow', phoneNumberId },
    engineOptions(state, attendanceSession(), { prisma }),
  );

  assert.equal(result.intent, 'ATTENDANCE_START');
  assert.equal(result.stateChanged, true);
  assert.equal(createdEntries.length, 1);
  assert.deepEqual(createdEntries[0].metadata, {
    attendanceTimezone: 'America/Argentina/Buenos_Aires',
    ppeStatus: 'complete',
    source: 'whatsapp-flow',
    workArea: 'Estructura nivel 2',
    taskRef: 'task-structure-02',
  });
  assert.equal(state.incidents[0].metadata.taskRef, 'task-structure-02');
  assert.equal(state.incidents[0].metadata.workArea, 'Estructura nivel 2');
  assert.equal(state.attendance[worker.id].lastEventType, 'CHECK_IN');
  assert.equal(state.attendance[worker.id].reviewRequired, false);
  assert.equal(state.attendance[worker.id].shiftId, undefined);
  assert.equal(state.attendance[worker.id].shiftState, undefined);
  assert.equal(state.attendance[worker.id].checkout, undefined);
  assert.equal(state.attendance[worker.id].breakStartedAt, undefined);
  assert.equal(state.attendance[worker.id].breakEndedAt, undefined);
  assert.equal(JSON.stringify({ result, state, createdEntries }).includes(sensitiveObservations), false);
});

test('an expired trusted Flow ignores its payload and requests one safe replacement', async () => {
  const state = emptyState();
  const expiredSession = incidentSession();
  const result = await processIncomingObraMessage(
    incidentEvent({
      flow_type: 'attendance',
      severity: 'critical',
      area: 'payload no confiable',
      description: 'este contenido no debe aplicarse',
    }),
    {
      projectId,
      organizationId: 'organization-meta-flow',
      phoneNumberId,
    },
    engineOptions(state, null, {
      expiredFlowSession: expiredSession,
      expiredFlowCanReissue: true,
    }),
  );

  assert.equal(result.intent, 'INCIDENT');
  assert.equal(result.flowPrompt, 'incident-report');
  assert.equal(result.stateChanged, false);
  assert.equal(state.incidents.length, 0);
  assert.equal(state.alertsCount, 0);
  assert.match(result.reply, /venciÃ³|venció/u);
  assert.equal(
    result.newMessages[0].metadata.whatsappFlowSessionId,
    expiredSession.id,
  );
  assert.equal(
    result.newMessages[0].metadata.whatsappFlowSessionExpired,
    true,
  );
});

test('an expired Flow does not promise a replacement when Meta has no published blueprint', async () => {
  const state = emptyState();
  const result = await processIncomingObraMessage(
    incidentEvent(),
    {
      projectId,
      organizationId: 'organization-meta-flow',
      phoneNumberId,
    },
    engineOptions(state, null, {
      expiredFlowSession: incidentSession(),
      expiredFlowCanReissue: false,
    }),
  );

  assert.equal(result.flowPrompt, null);
  assert.match(result.reply, /administrador/u);
  assert.equal(state.incidents.length, 0);
});

test('a Meta Flow without its trusted persisted session fails before effects', async () => {
  const state = emptyState();
  await assert.rejects(
    processIncomingObraMessage(
      incidentEvent(),
      { projectId, organizationId: 'organization-meta-flow', phoneNumberId },
      engineOptions(state, null),
    ),
    (error) => error.code === 'WHATSAPP_FLOW_SESSION_INVALID',
  );
  assert.equal(state.incidents.length, 0);
});

test('client fields cannot override the server-owned Flow route', async () => {
  const state = emptyState();
  await assert.rejects(
    processIncomingObraMessage(
      incidentEvent({ flow_type: 'attendance' }),
      { projectId, organizationId: 'organization-meta-flow', phoneNumberId },
      engineOptions(state, incidentSession()),
    ),
    (error) => error.code === 'WHATSAPP_FLOW_REPLY_INVALID',
  );
  assert.equal(state.incidents.length, 0);
  assert.equal(state.operariosCount, 0);
});

test('an internally inconsistent session cannot cross-route a valid blueprint reply', async () => {
  const state = emptyState();
  await assert.rejects(
    processIncomingObraMessage(
      incidentEvent(),
      { projectId, organizationId: 'organization-meta-flow', phoneNumberId },
      engineOptions(state, incidentSession({ flowType: 'attendance' })),
    ),
    (error) => error.code === 'WHATSAPP_FLOW_SESSION_INVALID',
  );
  assert.equal(state.incidents.length, 0);
  assert.equal(state.operariosCount, 0);
});
