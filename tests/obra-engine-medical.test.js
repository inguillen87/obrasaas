import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const { processIncomingObraMessage } = await tsImport(
  '../src/lib/whatsapp/obra-engine.js',
  { parentURL: import.meta.url, tsconfig: './jsconfig.json' },
);

const worker = {
  id: 'worker-medical-a',
  projectId: 'project-medical-a',
  phone: '+5491112345678',
  name: 'Persona autorizada',
  role: 'Operaria',
  active: true,
  metadata: { whatsappRole: 'WORKER' },
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

function medicalEvent(media = null) {
  return {
    externalId: 'medical-webview-event-a',
    provider: 'webview',
    from: worker.phone,
    kind: 'interactive',
    media,
    interactive: {
      type: 'flow',
      name: 'medical_leave',
      response: { days: 3 },
    },
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  };
}

function engineOptions(state) {
  return {
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
  };
}

test('medical flow keeps the protected asset in the message and incident evidence', async () => {
  const state = emptyState();
  const media = {
    kind: 'document',
    url: 'https://blob.example/private/certificado.pdf',
    filename: 'certificado.pdf',
    mimeType: 'application/pdf',
    size: 1_024,
    storage: {
      provider: 'vercel-blob',
      status: 'stored',
      assetId: 'https://blob.example/private/certificado.pdf',
      publicId: 'obrasaas/medical-certificates/certificado.pdf',
      pathname: 'obrasaas/medical-certificates/certificado.pdf',
    },
  };
  const result = await processIncomingObraMessage(
    medicalEvent(media),
    { projectId: worker.projectId },
    engineOptions(state),
  );

  assert.match(result.reply, /asociado al registro/);
  assert.equal(result.newMessages[0].mediaUrl, media.url);
  assert.deepEqual(result.newMessages[0].media, media);
  assert.equal(state.attendance[worker.id].status, 'Licencia informada con certificado (3 días)');
  assert.equal(state.incidents.length, 1);
  assert.equal(state.incidents[0].evidence.assetId, media.storage.assetId);
  assert.equal(state.incidents[0].evidence.provider, 'vercel-blob');
  assert.equal(state.incidents[0].evidence.storageStatus, 'stored');
});

test('medical flow without protected evidence remains explicitly pending', async () => {
  const state = emptyState();
  const result = await processIncomingObraMessage(
    medicalEvent(null),
    { projectId: worker.projectId },
    engineOptions(state),
  );

  assert.doesNotMatch(result.reply, /asociad/i);
  assert.match(result.reply, /falta adjuntar/);
  assert.match(state.attendance[worker.id].status, /certificado pendiente/);
  assert.equal(Object.hasOwn(state.incidents[0], 'evidence'), false);
  assert.equal(result.newMessages[0].mediaUrl, null);
});
