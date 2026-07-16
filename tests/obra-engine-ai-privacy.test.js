import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const { processIncomingObraMessage } = await tsImport(
  '../src/lib/whatsapp/obra-engine.js',
  { parentURL: import.meta.url, tsconfig: './jsconfig.json' },
);

test('an audio disabled by the tenant stays evidence and reports that no AI provider received it', async () => {
  const state = {
    attendance: {},
    incidents: [],
    tasks: {},
    alertsCount: 0,
    operariosCount: 0,
  };
  const worker = {
    id: 'worker-audio-private',
    projectId: 'project-audio-private',
    phone: '+5491112345678',
    name: 'Persona autorizada',
    role: 'Operaria',
    active: true,
    metadata: { whatsappRole: 'WORKER' },
  };
  const result = await processIncomingObraMessage({
    externalId: 'wamid.audio-private',
    provider: 'meta',
    from: worker.phone,
    kind: 'audio',
    text: '',
    transcription: {
      status: 'disabled_by_tenant',
      provider: 'openai',
      text: null,
    },
    media: {
      kind: 'audio',
      url: 'https://blob.example/private/audio.ogg',
      storage: { status: 'stored', provider: 'vercel-blob' },
    },
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  }, {
    organizationId: 'organization-audio-private',
    projectId: worker.projectId,
  }, {
    state,
    projectSettings: {
      id: worker.projectId,
      latitude: -34.6,
      longitude: -58.4,
      geofenceMeters: 150,
    },
    worker,
    prisma: {},
    persist: false,
  });

  assert.match(result.reply, /desactivada por la organización/i);
  assert.match(result.reply, /no se envió el contenido a un proveedor de IA/i);
  assert.equal(state.incidents.length, 1);
  assert.match(state.incidents[0].description, /desactivada por la organización/i);
  assert.equal(result.newMessages[0].transcription.status, 'disabled_by_tenant');
});
