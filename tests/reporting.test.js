import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWeeklyReportModel } from '../src/lib/reporting.js';

test('weekly reports use tenant and project data without inventing a budget', () => {
  const report = buildWeeklyReportModel({
    organization: { name: 'Constructora Sur' },
    project: { id: 'project_1234567', name: 'Hospital Norte', address: 'Rosario' },
    state: {
      avancePercentage: 42,
      diasEstimados: 'Día 12/35',
      tasks: { a: { name: 'Fundaciones', progress: 100, duration: 4 } },
      attendance: { Ana: { role: 'Jefa de obra', status: 'Presente' } },
      incidents: [],
    },
    generatedAt: new Date('2026-07-15T12:00:00.000Z'),
    snapshot: { version: 1, updatedAt: new Date('2026-07-15T11:00:00.000Z') },
  });

  assert.equal(report.organizationName, 'Constructora Sur');
  assert.equal(report.projectName, 'Hospital Norte');
  assert.equal(report.timelinePercentage, 34);
  assert.equal(report.tasksDone, 1);
  assert.equal(report.presentWorkers, 1);
  assert.equal(report.budget, null);
  assert.equal(report.isEmptyState, false);
  assert.match(report.reportId, /^OS-1234567-20260715$/);
});

test('an empty tenant report states that there is no operational evidence', () => {
  const report = buildWeeklyReportModel({
    organization: { name: 'Tenant nuevo' },
    project: { name: 'Primera obra' },
    generatedAt: new Date('2026-07-15T12:00:00.000Z'),
  });

  assert.equal(report.isEmptyState, true);
  assert.equal(report.tasks.length, 0);
  assert.equal(report.evidenceCount, 0);
  assert.match(report.executiveSummary, /no hay actividad operativa persistida/i);
});

test('a missing persisted snapshot cannot count as a meaningful report', () => {
  const report = buildWeeklyReportModel({
    organization: { name: 'Tenant nuevo' },
    project: { name: 'Primera obra' },
    snapshot: { exists: false, state: {}, version: 0 },
  });

  assert.equal(report.isEmptyState, true);
  assert.equal(report.tasks.length, 0);
});

test('a persisted but operationally empty snapshot cannot complete first value', () => {
  const report = buildWeeklyReportModel({
    organization: { name: 'Tenant nuevo' },
    project: { name: 'Primera obra' },
    snapshot: { exists: true, state: {}, version: 1 },
    state: {
      avancePercentage: 0,
      attendance: {},
      incidents: [],
      stockpiles: {},
      tasks: {},
    },
    messages: [{
      sender: 'bot',
      kind: 'system',
      text: 'Hola. Soy el asistente de ObraSaaS.',
    }],
  });

  assert.equal(report.isEmptyState, true);
  assert.match(report.executiveSummary, /no hay actividad operativa persistida/i);
});

test('a real inbound field message makes a persisted report operational', () => {
  const report = buildWeeklyReportModel({
    snapshot: { exists: true, state: {}, version: 1 },
    messages: [{ sender: 'user', kind: 'text', text: 'Avance de estructura 35%' }],
  });

  assert.equal(report.isEmptyState, false);
});

test('weekly reports summarize risk, evidence and configured budget', () => {
  const report = buildWeeklyReportModel({
    state: {
      avancePercentage: 20,
      diasEstimados: 'Día 8/10',
      alertsCount: 1,
      budget: { total: 100_000, executed: 35_000, currency: 'USD' },
      incidents: [{ id: 'risk', title: 'Demora', type: 'critical' }],
    },
    messages: [
      { kind: 'audio', mediaUrl: '/evidence/audio', transcription: 'Demora informada' },
      { kind: 'image', mediaUrl: '/evidence/photo' },
    ],
    snapshot: { version: 3, updatedAt: new Date('2026-07-14T10:00:00.000Z') },
  });

  assert.equal(report.timelinePercentage, 80);
  assert.equal(report.criticalIncidents, 1);
  assert.equal(report.evidenceCount, 2);
  assert.equal(report.audioCount, 1);
  assert.equal(report.budget.remaining, 65_000);
  assert.equal(report.snapshotVersion, 3);
  assert.equal(report.isEmptyState, false);
  assert.match(report.executiveSummary, /60 puntos por debajo/);
});

test('weekly reports expose real schedule dependencies and sequence conflicts', () => {
  const report = buildWeeklyReportModel({
    organization: { name: 'Constructora Sur' },
    project: {
      id: 'project_schedule',
      name: 'Torre Centro',
      startsAt: new Date('2026-07-01T00:00:00.000Z'),
      endsAt: new Date('2026-08-31T00:00:00.000Z'),
    },
    state: {
      tasks: {
        foundations: { name: 'Fundaciones', progress: 80, duration: 10, startDay: 1 },
        structure: {
          name: 'Estructura', progress: 0, duration: 15, startDay: 8,
          dependencies: ['foundations'],
        },
      },
    },
    snapshot: { version: 2, updatedAt: new Date('2026-07-16T10:00:00.000Z') },
  });

  assert.equal(report.dependencyCount, 1);
  assert.equal(report.scheduleConflicts, 1);
  assert.equal(report.tasks[1].dependencyNames[0], 'Fundaciones');
  assert.equal(report.tasks[1].startDate.toISOString(), '2026-07-08T00:00:00.000Z');
  assert.match(report.executiveSummary, /conflicto de secuencia/i);
});
