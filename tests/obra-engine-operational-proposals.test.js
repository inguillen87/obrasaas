import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const {
  OPERATIONAL_PROPOSAL_STATUSES,
} = await import('../src/lib/whatsapp/operational-proposals.js');
const { processIncomingObraMessage } = await tsImport(
  '../src/lib/whatsapp/obra-engine.js',
  { parentURL: import.meta.url, tsconfig: './jsconfig.json' },
);

function memoryPrisma() {
  const proposals = [];
  const audits = [];
  const prisma = {
    operationalProposal: {
      async findUnique({ where }) {
        if (where.projectId_sourceProvider_sourceExternalId) {
          const key = where.projectId_sourceProvider_sourceExternalId;
          return proposals.find((record) => (
            record.projectId === key.projectId
            && record.sourceProvider === key.sourceProvider
            && record.sourceExternalId === key.sourceExternalId
          )) || null;
        }
        if (where.projectId_confirmationCode) {
          const key = where.projectId_confirmationCode;
          return proposals.find((record) => (
            record.projectId === key.projectId
            && record.confirmationCode === key.confirmationCode
          )) || null;
        }
        return null;
      },
      async create({ data }) {
        const record = {
          id: `proposal-${proposals.length + 1}`,
          status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
          resolvedByWorkerId: null,
          resolverProvider: null,
          resolverExternalId: null,
          resolvedAt: null,
          result: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...structuredClone(data),
        };
        proposals.push(record);
        return record;
      },
      async updateMany({ where, data }) {
        const record = proposals.find((candidate) => (
          candidate.id === where.id
          && candidate.projectId === where.projectId
          && candidate.status === where.status
        ));
        if (!record) return { count: 0 };
        const expiry = new Date(record.expiresAt).getTime();
        if (where.expiresAt?.gt && expiry <= where.expiresAt.gt.getTime()) return { count: 0 };
        if (where.expiresAt?.lte && expiry > where.expiresAt.lte.getTime()) return { count: 0 };
        Object.assign(record, structuredClone(data));
        return { count: 1 };
      },
    },
    auditLog: {
      async create({ data }) {
        audits.push(structuredClone(data));
        return data;
      },
    },
  };
  return { prisma, proposals, audits };
}

function state() {
  return {
    attendance: {},
    incidents: [],
    tasks: {
      3: {
        name: 'Estructura de hormigón',
        progress: 20,
        duration: 8,
      },
    },
    alertsCount: 0,
    avancePercentage: 20,
    operariosCount: 0,
  };
}

function worker(overrides = {}) {
  return {
    id: 'worker-a',
    projectId: 'project-a',
    phone: '+5491112345678',
    name: 'Ana Capataz',
    role: 'Capataz',
    active: true,
    metadata: { whatsappRole: 'FOREMAN' },
    ...overrides,
  };
}

const scope = {
  organizationId: 'organization-a',
  projectId: 'project-a',
};
const projectSettings = {
  id: 'project-a',
  organizationId: 'organization-a',
  latitude: -34.6,
  longitude: -58.4,
  geofenceMeters: 100,
};
const audioTime = new Date('2026-07-16T12:00:00.000Z');

async function createProgressProposal({ prisma, currentState, author = worker() }) {
  return processIncomingObraMessage({
    externalId: 'wamid.audio-progress-a',
    provider: 'meta',
    from: author.phone,
    kind: 'audio',
    text: 'La tarea 3 está al 75 por ciento.',
    transcription: {
      status: 'completed',
      provider: 'openai',
      text: 'La tarea 3 está al 75 por ciento.',
    },
    timestamp: audioTime,
  }, scope, {
    state: currentState,
    projectSettings,
    worker: author,
    prisma,
    persist: false,
    processingTime: audioTime,
  });
}

test('audio creates a pending proposal and an exact confirmation applies it once', async () => {
  const { prisma, proposals, audits } = memoryPrisma();
  const currentState = state();
  const audio = await createProgressProposal({ prisma, currentState });
  const code = audio.operationalProposal.confirmationCode;

  assert.match(audio.reply, new RegExp(`CONFIRMAR ${code}`));
  assert.match(audio.reply, /es válida hasta/i);
  assert.equal(currentState.tasks[3].progress, 20);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(audits[0].action, 'voice.proposal.created');

  const confirmation = await processIncomingObraMessage({
    externalId: 'wamid.confirm-progress-a',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });

  assert.equal(confirmation.intent, 'COMMAND_CONFIRMATION');
  assert.equal(confirmation.stateChanged, true);
  assert.equal(currentState.tasks[3].progress, 75);
  assert.equal(currentState.avancePercentage, 75);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.APPLIED);
  assert.equal(audits.filter((audit) => audit.action === 'voice.proposal.applied').length, 1);

  const repeated = await processIncomingObraMessage({
    externalId: 'wamid.confirm-progress-b',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:06:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:06:00.000Z'),
  });

  assert.match(repeated.reply, /ya fue aplicada/i);
  assert.equal(repeated.stateChanged, false);
  assert.equal(audits.filter((audit) => audit.action === 'voice.proposal.applied').length, 1);
});

test('a worker can propose progress but only an authorized supervisor can apply it', async () => {
  const { prisma, proposals } = memoryPrisma();
  const currentState = state();
  const author = worker({
    id: 'worker-operative',
    name: 'Operario',
    role: 'Operario',
    metadata: { whatsappRole: 'WORKER' },
  });
  const audio = await createProgressProposal({ prisma, currentState, author });
  const code = audio.operationalProposal.confirmationCode;
  assert.match(audio.reply, /capataz o jefe de obra autorizado/i);

  const denied = await processIncomingObraMessage({
    externalId: 'wamid.confirm-denied',
    provider: 'meta',
    from: author.phone,
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: author,
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });

  assert.equal(denied.newMessages[0].metadata.authorized, false);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(currentState.tasks[3].progress, 20);

  const approved = await processIncomingObraMessage({
    externalId: 'wamid.confirm-supervisor',
    provider: 'meta',
    from: '+5491199999999',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:06:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker({ id: 'worker-foreman', phone: '+5491199999999' }),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:06:00.000Z'),
  });

  assert.equal(approved.newMessages[0].metadata.authorized, true);
  assert.equal(proposals[0].resolvedByWorkerId, 'worker-foreman');
  assert.equal(currentState.tasks[3].progress, 75);
});

test('a changed task invalidates the pending proposal instead of overwriting newer work', async () => {
  const { prisma, proposals, audits } = memoryPrisma();
  const currentState = state();
  const audio = await createProgressProposal({ prisma, currentState });
  const code = audio.operationalProposal.confirmationCode;
  currentState.tasks[3].progress = 45;
  currentState.avancePercentage = 45;

  const confirmation = await processIncomingObraMessage({
    externalId: 'wamid.confirm-stale',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });

  assert.match(confirmation.reply, /no pisar un avance más nuevo/i);
  assert.equal(confirmation.stateChanged, false);
  assert.equal(currentState.tasks[3].progress, 45);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.INVALIDATED);
  assert.equal(audits.at(-1).action, 'voice.proposal.invalidated');
});

test('expired proposals become terminal no-ops and preserve the project state', async () => {
  const { prisma, proposals, audits } = memoryPrisma();
  const currentState = state();
  const audio = await createProgressProposal({ prisma, currentState });
  const code = audio.operationalProposal.confirmationCode;

  const confirmation = await processIncomingObraMessage({
    externalId: 'wamid.confirm-expired',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:31:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:31:00.000Z'),
  });

  assert.match(confirmation.reply, /venció/i);
  assert.equal(confirmation.stateChanged, false);
  assert.equal(currentState.tasks[3].progress, 20);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.EXPIRED);
  assert.equal(audits.at(-1).action, 'voice.proposal.expired');
});

test('audio and media captions remain evidence even when they contain a valid confirmation code', async () => {
  const { prisma, proposals, audits } = memoryPrisma();
  const currentState = state();
  const proposal = await createProgressProposal({ prisma, currentState });
  const code = proposal.operationalProposal.confirmationCode;

  const audio = await processIncomingObraMessage({
    externalId: 'wamid.audio-confirmation-attempt',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'audio',
    text: `CONFIRMAR ${code}`,
    transcription: {
      status: 'completed',
      provider: 'openai',
      text: `CONFIRMAR ${code}`,
    },
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });
  const image = await processIncomingObraMessage({
    externalId: 'wamid.image-confirmation-attempt',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'image',
    text: `CONFIRMAR ${code}`,
    media: {
      kind: 'image',
      url: 'https://blob.example/evidence.jpg',
      storage: { status: 'stored', provider: 'vercel-blob' },
    },
    timestamp: new Date('2026-07-16T12:06:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:06:00.000Z'),
  });

  assert.equal(audio.intent, 'EVIDENCE');
  assert.equal(image.intent, 'EVIDENCE');
  assert.equal(currentState.tasks[3].progress, 20);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);
  assert.equal(audits.some((audit) => audit.action === 'voice.proposal.applied'), false);
});

test('ambiguous task names stay unbound until an exact task ID is confirmed', async () => {
  const { prisma, proposals } = memoryPrisma();
  const currentState = state();
  currentState.tasks = {
    3: { name: 'Estructura planta baja', progress: 20, duration: 8 },
    4: { name: 'Estructura planta alta', progress: 30, duration: 8 },
  };
  currentState.avancePercentage = 25;
  const audio = await processIncomingObraMessage({
    externalId: 'wamid.audio-ambiguous-task',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'audio',
    text: 'La estructura está al 75 por ciento.',
    transcription: {
      status: 'completed',
      provider: 'openai',
      text: 'La estructura está al 75 por ciento.',
    },
    timestamp: audioTime,
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: audioTime,
  });
  const code = audio.operationalProposal.confirmationCode;

  assert.equal(proposals[0].action.taskKey, null);
  assert.match(audio.reply, new RegExp(`CONFIRMAR ${code} TAREA`));

  const incomplete = await processIncomingObraMessage({
    externalId: 'wamid.confirm-ambiguous-without-task',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });
  assert.match(incomplete.reply, /sigue pendiente/i);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.PENDING);

  const exact = await processIncomingObraMessage({
    externalId: 'wamid.confirm-ambiguous-task-4',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `CONFIRMAR ${code} TAREA 4`,
    timestamp: new Date('2026-07-16T12:06:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:06:00.000Z'),
  });

  assert.equal(exact.stateChanged, true);
  assert.equal(currentState.tasks[3].progress, 20);
  assert.equal(currentState.tasks[4].progress, 75);
  assert.equal(currentState.avancePercentage, 48);
});

test('rejection closes the proposal without applying its stored operation', async () => {
  const { prisma, proposals, audits } = memoryPrisma();
  const currentState = state();
  const audio = await createProgressProposal({ prisma, currentState });
  const code = audio.operationalProposal.confirmationCode;

  const rejected = await processIncomingObraMessage({
    externalId: 'wamid.reject-progress',
    provider: 'meta',
    from: '+5491112345678',
    kind: 'text',
    text: `RECHAZAR ${code}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });

  assert.match(rejected.reply, /rechacé la propuesta/i);
  assert.equal(rejected.stateChanged, false);
  assert.equal(currentState.tasks[3].progress, 20);
  assert.equal(proposals[0].status, OPERATIONAL_PROPOSAL_STATUSES.REJECTED);
  assert.equal(audits.at(-1).action, 'voice.proposal.rejected');
});

test('confirmed safety incidents retain the original reporter when a supervisor approves', async () => {
  const { prisma, proposals } = memoryPrisma();
  const currentState = state();
  const author = worker({
    id: 'worker-reporter',
    name: 'Lucía Operaria',
    role: 'Operaria',
    metadata: { whatsappRole: 'WORKER' },
  });
  const audio = await processIncomingObraMessage({
    externalId: 'wamid.audio-critical',
    provider: 'meta',
    from: author.phone,
    kind: 'audio',
    text: 'Hubo un accidente urgente con una persona herida en el frente norte.',
    transcription: {
      status: 'completed',
      provider: 'openai',
      text: 'Hubo un accidente urgente con una persona herida en el frente norte.',
    },
    timestamp: audioTime,
  }, scope, {
    state: currentState,
    projectSettings,
    worker: author,
    prisma,
    persist: false,
    processingTime: audioTime,
  });
  const code = audio.operationalProposal.confirmationCode;
  proposals[0].proposedByWorker = { name: author.name };

  const approved = await processIncomingObraMessage({
    externalId: 'wamid.confirm-critical',
    provider: 'meta',
    from: '+5491199999999',
    kind: 'text',
    text: `CONFIRMAR ${code}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings,
    worker: worker({
      id: 'worker-safety',
      phone: '+5491199999999',
      name: 'Mario Seguridad',
      role: 'Seguridad',
      metadata: { whatsappRole: 'SAFETY' },
    }),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
  });

  assert.equal(approved.stateChanged, true);
  assert.equal(currentState.incidents[0].reporter, 'Lucía Operaria');
  assert.equal(currentState.incidents[0].type, 'critical');
  assert.equal(currentState.alertsCount, 1);
});

test('dashboard simulations audit the real platform actor separately from the represented worker', async () => {
  const { prisma, audits } = memoryPrisma();
  const currentState = state();
  const simulatedSettings = {
    ...projectSettings,
    timezone: 'America/New_York',
  };
  const audio = await processIncomingObraMessage({
    externalId: 'internal:simulator:audio-a',
    provider: 'internal',
    from: worker().phone,
    kind: 'audio',
    text: 'La tarea 3 está al 75 por ciento.',
    transcription: {
      status: 'completed',
      provider: 'dashboard-simulator',
      text: 'La tarea 3 está al 75 por ciento.',
    },
    timestamp: audioTime,
  }, scope, {
    state: currentState,
    projectSettings: simulatedSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: audioTime,
    auditActorId: 'platform-user-a',
    auditSource: 'dashboard-simulator',
  });

  assert.match(audio.reply, /zona America\/New_York/);
  assert.doesNotMatch(audio.reply, /hora argentina/i);
  assert.equal(audits[0].actorId, 'platform-user-a');
  assert.equal(audits[0].metadata.initiatedByPlatformUserId, 'platform-user-a');
  assert.equal(audits[0].metadata.simulated, true);

  await processIncomingObraMessage({
    externalId: 'internal:simulator:confirmation-a',
    provider: 'internal',
    from: worker().phone,
    kind: 'text',
    text: `CONFIRMAR ${audio.operationalProposal.confirmationCode}`,
    timestamp: new Date('2026-07-16T12:05:00.000Z'),
  }, scope, {
    state: currentState,
    projectSettings: simulatedSettings,
    worker: worker(),
    prisma,
    persist: false,
    processingTime: new Date('2026-07-16T12:05:00.000Z'),
    auditActorId: 'platform-user-a',
    auditSource: 'dashboard-simulator',
  });

  assert.equal(audits.at(-1).actorId, 'platform-user-a');
  assert.equal(audits.at(-1).metadata.resolvedByWorkerId, 'worker-a');
  assert.equal(audits.at(-1).metadata.auditSource, 'dashboard-simulator');
});

test('actionable voice proposals fail closed outside the project-locked atomic pipeline', async () => {
  const { prisma } = memoryPrisma();

  await assert.rejects(
    processIncomingObraMessage({
      externalId: 'unsafe-standalone-audio',
      provider: 'internal',
      from: worker().phone,
      kind: 'audio',
      text: 'La tarea 3 está al 75 por ciento.',
      transcription: {
        status: 'completed',
        provider: 'dashboard-simulator',
        text: 'La tarea 3 está al 75 por ciento.',
      },
      timestamp: audioTime,
    }, scope, {
      state: state(),
      projectSettings,
      worker: worker(),
      prisma,
      processingTime: audioTime,
    }),
    (error) => error.code === 'OPERATIONAL_ATOMIC_CONTEXT_REQUIRED',
  );
});
