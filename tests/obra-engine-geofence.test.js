import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const { processIncomingObraMessage } = await tsImport(
  '../src/lib/whatsapp/obra-engine.js',
  { parentURL: import.meta.url, tsconfig: './jsconfig.json' },
);

test('location check-ins fail closed when a tenant project has no real geofence', async () => {
  const state = {
    attendance: {},
    incidents: [],
    tasks: {},
    alertsCount: 0,
    operariosCount: 0,
  };
  const worker = {
    id: 'worker-no-geofence',
    projectId: 'project-no-geofence',
    phone: '+5491112345678',
    name: 'Persona autorizada',
    role: 'Operaria',
    active: true,
    metadata: { whatsappRole: 'WORKER' },
  };

  const result = await processIncomingObraMessage({
    externalId: 'location-no-geofence',
    provider: 'webview',
    from: worker.phone,
    kind: 'location',
    location: { latitude: -34.6, longitude: -58.4, accuracy: 20 },
    timestamp: new Date('2026-07-16T12:00:00.000Z'),
  }, { projectId: worker.projectId }, {
    state,
    projectSettings: {
      id: worker.projectId,
      latitude: null,
      longitude: null,
      geofenceMeters: 100,
    },
    worker,
    prisma: {},
    persist: false,
  });

  assert.match(result.reply, /no tiene una geocerca configurada/i);
  assert.equal(result.stateChanged, false);
  assert.deepEqual(state.attendance, {});
  assert.deepEqual(state.incidents, []);
});
