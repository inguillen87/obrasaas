import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWeeklyReportModel,
  weeklyReportPeriodStart,
  weeklyReportWorkDateRange,
} from '../src/lib/reporting.js';

test('weekly reports use tenant and project data without inventing a budget', () => {
  const report = buildWeeklyReportModel({
    organization: { name: 'Constructora Sur' },
    project: { id: 'project_1234567', name: 'Hospital Norte', address: 'Rosario' },
    state: {
      avancePercentage: 42,
      diasEstimados: 'Día 12/35',
      tasks: { a: { name: 'Fundaciones', progress: 100, duration: 4 } },
      attendance: {
        'worker-a': { name: 'Ana', role: 'Jefa de obra', status: 'Presente' },
      },
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
  assert.equal(report.attendance[0].name, 'Ana');
  assert.equal(report.budget, null);
  assert.equal(report.isEmptyState, false);
  assert.match(report.reportId, /^OS-1234567-20260715-090000000$/);
});

test('weekly reports count only explicitly verified attendance and preserve the ledger journey', () => {
  const report = buildWeeklyReportModel({
    state: {
      attendance: {
        verified: {
          name: 'Ana',
          status: 'Jornada cerrada',
          present: true,
          daysPresent: 2,
          daysRegistered: 2,
          workDateLabel: '22 jul',
          checkin: '08:05',
          breakStartedAt: '12:00',
          breakEndedAt: '12:30',
          checkout: '17:10',
        },
        review: {
          name: 'Bruno',
          status: 'Ingreso pendiente de revisión',
          present: false,
          reviewRequired: true,
          workDateLabel: '22 jul',
          checkin: '08:20',
        },
      },
    },
    snapshot: { exists: true, version: 3 },
  });

  assert.equal(report.presentWorkers, 1);
  assert.equal(report.attendance[0].daysPresent, 2);
  assert.equal(report.attendance[0].journeyLabel, '22 jul · 08:05 → 17:10 · pausa 12:00–12:30');
  assert.equal(report.attendance[1].tone, 'warning');
  assert.equal(report.attendance[1].present, false);
});

test('weekly report boundaries use Buenos Aires calendar days around UTC midnight', () => {
  const generatedAt = new Date('2026-07-16T01:30:00.000Z');
  const report = buildWeeklyReportModel({
    generatedAt,
    project: { id: 'project_timezone' },
  });

  assert.equal(weeklyReportPeriodStart(generatedAt).toISOString(), '2026-07-09T03:00:00.000Z');
  assert.match(report.reportId, /^OS-IMEZONE-20260715-223000000$/);
});

test('weekly report boundaries and IDs follow the tenant timezone', () => {
  const generatedAt = new Date('2026-07-16T03:30:00.000Z');
  const timeZone = 'America/Santiago';
  const range = weeklyReportWorkDateRange(generatedAt, timeZone);
  const report = buildWeeklyReportModel({
    generatedAt,
    timeZone,
    project: { id: 'project_timezone' },
  });

  assert.equal(weeklyReportPeriodStart(generatedAt, timeZone).toISOString(), '2026-07-09T04:00:00.000Z');
  assert.equal(range.start.toISOString(), '2026-07-09T00:00:00.000Z');
  assert.equal(range.end.toISOString(), '2026-07-15T00:00:00.000Z');
  assert.equal(report.timeZone, timeZone);
  assert.match(report.reportId, /^OS-IMEZONE-20260715-233000000$/);
});

test('weekly report starts at the first valid instant when DST skips local midnight', () => {
  const start = weeklyReportPeriodStart(
    new Date('2026-09-12T12:00:00.000Z'),
    'America/Santiago',
  );
  const localParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Santiago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(start)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  assert.deepEqual(localParts, {
    month: '09',
    day: '06',
    year: '2026',
    hour: '01',
    minute: '00',
  });
});

test('an explicit evidence summary keeps report generation data-minimal', () => {
  const report = buildWeeklyReportModel({
    snapshot: { exists: true, version: 2 },
    evidenceSummary: {
      evidenceCount: 8,
      audioCount: 3,
      operationalMessageCount: 11,
      truncated: true,
      messageLimit: 500,
    },
    messages: [{
      sender: 'user',
      kind: 'audio',
      mediaUrl: '/must-not-be-counted',
      transcription: 'must not be counted',
    }],
  });

  assert.equal(report.evidenceCount, 8);
  assert.equal(report.audioCount, 3);
  assert.equal(report.evidenceTruncated, true);
  assert.equal(report.evidenceMessageLimit, 500);
  assert.equal(report.isEmptyState, false);
});

test('weekly reports prioritize severe incidents and disclose the bounded remainder', () => {
  const incidents = Array.from({ length: 45 }, (_, index) => ({
    id: `incident-${index}`,
    title: `Incidente ${index}`,
    severity: index === 44 ? 'critical' : 'low',
  }));
  const report = buildWeeklyReportModel({
    state: { incidents },
    snapshot: { exists: true, version: 1 },
  });

  assert.equal(report.incidentTotal, 45);
  assert.equal(report.incidents.length, 40);
  assert.equal(report.incidents[0].id, 'incident-44');
  assert.equal(report.criticalIncidents, 1);
});

test('resolved incidents stay visible without inflating active alert metrics', () => {
  const report = buildWeeklyReportModel({
    state: {
      incidents: [
        { id: 'active', severity: 'critical', status: 'open' },
        { id: 'resolved', severity: 'critical', status: 'resolved', badge: 'Crítica' },
      ],
    },
    snapshot: { exists: true, version: 2 },
  });

  assert.equal(report.alertsCount, 1);
  assert.equal(report.criticalIncidents, 1);
  assert.equal(report.incidents.find((incident) => incident.id === 'resolved').label, 'Resuelta');
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
  assert.equal(report.snapshotVersion, null);
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
