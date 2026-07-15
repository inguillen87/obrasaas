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
  });

  assert.equal(report.organizationName, 'Constructora Sur');
  assert.equal(report.projectName, 'Hospital Norte');
  assert.equal(report.timelinePercentage, 34);
  assert.equal(report.tasksDone, 1);
  assert.equal(report.presentWorkers, 1);
  assert.equal(report.budget, null);
  assert.equal(report.isDemoData, true);
  assert.match(report.reportId, /^OS-1234567-20260715$/);
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
  assert.equal(report.isDemoData, false);
  assert.match(report.executiveSummary, /60 puntos por debajo/);
});
