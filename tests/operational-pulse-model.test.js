import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOperationalPulseModel } from '../src/app/dashboard/operational-pulse-model.js';

test('operational pulse reports an honest empty state without fabricated metrics', () => {
  const model = buildOperationalPulseModel({
    project: { name: 'Hospital Norte', status: 'ACTIVE' },
    state: { tasks: {}, incidents: [], attendance: {} },
    setup: { isEmptyState: true },
    syncState: 'live',
    lastSyncedAt: '2026-07-17T13:30:00.000Z',
  });

  assert.equal(model.project.name, 'Hospital Norte');
  assert.equal(model.project.statusTone, 'active');
  assert.equal(model.attention.count, 0);
  assert.match(model.attention.headline, /no hay actividad operativa/i);
  assert.equal(model.progress.average, null);
  assert.equal(model.progress.taskCount, 0);
  assert.equal(model.presence.presentCount, 0);
  assert.equal(model.presence.recordCount, 0);
  assert.equal(model.latestSignal, null);
  assert.equal(model.sync.label, 'Datos sincronizados');
  assert.equal(model.sync.dateTime, '2026-07-17T13:30:00.000Z');
  assert.match(model.sync.timeLabel, /^\d{2}:\d{2}$/);
});

test('operational pulse prioritizes open critical risks and explicit task delays', () => {
  const state = {
    tasks: {
      structure: { name: 'Estructura', progress: 40, isDelayed: true },
      foundations: { name: 'Fundaciones', progress: 100, isDelayed: false },
    },
    incidents: [
      { id: 'resolved', title: 'Stock normalizado', type: 'warning', status: 'resolved' },
      { id: 'warning', title: 'Entrega pendiente', type: 'warning', status: 'open' },
      { id: 'critical', title: 'Falta baranda', type: 'critical', status: 'active', timestamp: 'Hoy, 09:15' },
    ],
    attendance: {
      ana: { name: 'Ana', status: 'Presente' },
      luis: { name: 'Luis', status: 'Ausente' },
      mia: { name: 'Mía', status: 'Presente (ubicación informada)' },
    },
  };

  const model = buildOperationalPulseModel({ state, setup: { canManageProjects: true } });

  assert.equal(model.attention.count, 3);
  assert.deepEqual(
    model.attention.signals.map((signal) => signal.title),
    ['Falta baranda', 'Estructura', 'Entrega pendiente'],
  );
  assert.equal(model.progress.average, 70);
  assert.equal(model.progress.completedTaskCount, 1);
  assert.equal(model.presence.presentCount, 2);
  assert.equal(model.presence.recordCount, 3);
  assert.equal(model.latestSignal.title, 'Stock normalizado');
  assert.equal(model.actions[1].label, 'Gestionar cronograma');
  assert.match(model.attention.headline, /3 señales requieren revisión/);
});

test('current operational records take precedence over an initially empty setup flag', () => {
  const model = buildOperationalPulseModel({
    state: {
      tasks: { planning: { name: 'Planificación', progress: 25 } },
      incidents: [],
      attendance: {},
    },
    setup: { isEmptyState: true },
  });

  assert.equal(model.hasOperationalData, true);
  assert.match(model.attention.headline, /sin riesgos abiertos/i);
  assert.equal(model.progress.average, 25);
});

test('operational pulse exposes sync failures and only offers permitted setup actions', () => {
  const model = buildOperationalPulseModel({
    project: { status: 'PAUSED' },
    state: {},
    setup: {
      canManageProjects: false,
      canManageIntegrations: true,
      whatsappConnected: false,
    },
    syncState: 'error',
    lastSyncedAt: 'not-a-date',
  });

  assert.equal(model.sync.tone, 'error');
  assert.equal(model.project.statusTone, 'paused');
  assert.equal(model.sync.label, 'Revisar sincronización');
  assert.equal(model.sync.dateTime, null);
  assert.equal(model.actions[1].label, 'Ver cronograma');
  assert.equal(model.actions.at(-1).label, 'Conectar WhatsApp');
});
