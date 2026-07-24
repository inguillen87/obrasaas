import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attendanceEventsFromShifts,
  buildAttendancePeriodProjection,
  buildLegacyAttendanceExceptionProjection,
  mergeAttendanceReportProjection,
} from '../src/lib/attendance-reporting.js';
import { loadWeeklyAttendanceShifts } from '../src/lib/attendance-report-query.js';

function event({
  id,
  workerId = 'worker-1',
  shiftId = 'shift-1',
  eventType,
  verificationStatus = eventType === 'CHECK_IN' ? 'VERIFIED' : 'NOT_REQUIRED',
  occurredAt,
  sequence,
  workDate = '2026-07-22T00:00:00.000Z',
  name = 'Ana Torres',
  role = 'Jefa de obra',
  timezone = 'America/Argentina/Buenos_Aires',
} = {}) {
  return {
    id: id || `${shiftId}-${sequence}`,
    workerId,
    shiftId,
    eventType,
    verificationStatus,
    occurredAt: new Date(occurredAt),
    sequence,
    worker: { name, role },
    shift: { workDate: new Date(workDate), timezone },
    latitude: -34.6,
    longitude: -58.4,
    evidence: { private: true },
  };
}

test('weekly attendance projection summarizes canonical shifts per worker', () => {
  const projection = buildAttendancePeriodProjection([
    event({ shiftId: 'shift-1', eventType: 'CHECK_IN', occurredAt: '2026-07-21T11:00:00.000Z', sequence: 1, workDate: '2026-07-21T00:00:00.000Z' }),
    event({ shiftId: 'shift-1', eventType: 'CHECK_OUT', verificationStatus: 'VERIFIED', occurredAt: '2026-07-21T20:00:00.000Z', sequence: 2, workDate: '2026-07-21T00:00:00.000Z' }),
    event({ shiftId: 'shift-2', eventType: 'CHECK_IN', occurredAt: '2026-07-22T11:05:00.000Z', sequence: 1 }),
    event({ shiftId: 'shift-2', eventType: 'BREAK_START', occurredAt: '2026-07-22T15:00:00.000Z', sequence: 2 }),
    event({ shiftId: 'shift-2', eventType: 'BREAK_END', occurredAt: '2026-07-22T15:30:00.000Z', sequence: 3 }),
    event({ shiftId: 'shift-2', eventType: 'CHECK_OUT', verificationStatus: 'VERIFIED', occurredAt: '2026-07-22T20:10:00.000Z', sequence: 4 }),
  ]);

  assert.equal(projection.length, 1);
  assert.deepEqual(projection[0], {
    workerId: 'worker-1',
    name: 'Ana Torres',
    role: 'Jefa de obra',
    status: 'Jornada cerrada',
    present: true,
    daysPresent: 2,
    daysRegistered: 2,
    workDate: '2026-07-22',
    workDateLabel: '22 jul',
    checkin: '08:05',
    breakStartedAt: '12:00',
    breakEndedAt: '12:30',
    checkout: '17:10',
    reviewRequired: false,
  });
  assert.equal(Object.hasOwn(projection[0], 'latitude'), false);
  assert.equal(Object.hasOwn(projection[0], 'evidence'), false);
});

test('pending, expired, voided and legacy entries never become verified attendance', () => {
  const projection = buildAttendancePeriodProjection([
    event({ shiftId: 'pending', eventType: 'CHECK_IN', verificationStatus: 'PENDING', occurredAt: '2026-07-22T10:00:00.000Z', sequence: 1 }),
    event({ shiftId: 'expired', eventType: 'CHECK_IN', verificationStatus: 'EXPIRED', occurredAt: '2026-07-22T10:01:00.000Z', sequence: 1 }),
    event({ shiftId: 'voided', eventType: 'CHECK_IN', verificationStatus: 'VOIDED', occurredAt: '2026-07-22T10:02:00.000Z', sequence: 1 }),
    event({ shiftId: 'legacy', eventType: 'CHECK_IN', verificationStatus: 'LEGACY', occurredAt: '2026-07-22T10:03:00.000Z', sequence: 1 }),
  ]);

  assert.deepEqual(projection, []);
});

test('a geofence deviation remains review-required and does not inflate verified presence', () => {
  const projection = buildAttendancePeriodProjection([
    event({ eventType: 'CHECK_IN', verificationStatus: 'REVIEW_REQUIRED', occurredAt: '2026-07-22T11:00:00.000Z', sequence: 1 }),
    event({ eventType: 'BREAK_START', occurredAt: '2026-07-22T15:00:00.000Z', sequence: 2 }),
  ]);

  assert.equal(projection[0].present, false);
  assert.equal(projection[0].daysPresent, 0);
  assert.equal(projection[0].daysRegistered, 1);
  assert.equal(projection[0].reviewRequired, true);
  assert.equal(projection[0].status, 'En pausa · ingreso pendiente de revisión');
});

test('historical journey times use the timezone stored on each shift', () => {
  const [entry] = buildAttendancePeriodProjection([
    event({
      eventType: 'CHECK_IN',
      occurredAt: '2026-07-22T11:05:00.000Z',
      sequence: 1,
      timezone: 'America/Santiago',
    }),
  ], { timeZone: 'America/Argentina/Buenos_Aires' });

  assert.equal(entry.checkin, '07:05');
});

test('legacy justified absences remain visible without inventing a period date', () => {
  const projection = buildLegacyAttendanceExceptionProjection({
    'worker-licensed': {
      workerId: 'worker-licensed',
      name: 'Bruno Díaz',
      role: 'Operario',
      status: 'Registro operativo restringido',
    },
    'worker-present': {
      workerId: 'worker-present',
      name: 'Carla Ruiz',
      status: 'Presente',
    },
  });

  assert.equal(projection.length, 1);
  assert.equal(projection[0].workerId, 'worker-licensed');
  assert.equal(projection[0].status, 'Ausencia o licencia informada · detalle restringido');
  assert.equal(projection[0].present, false);
  assert.equal(projection[0].legacyException, true);
  assert.equal(projection[0].workDate, null);
});

test('weekly projection loads complete shift journeys and gives canonical events precedence', () => {
  const shifts = [{
    id: 'shift-night',
    workerId: 'worker-1',
    workDate: new Date('2026-07-15T00:00:00.000Z'),
    timezone: 'America/Santiago',
    worker: { name: 'Ana Torres', role: 'Jefa de obra' },
    events: [
      { id: 'in', workerId: 'worker-1', shiftId: 'shift-night', eventType: 'CHECK_IN', verificationStatus: 'VERIFIED', occurredAt: new Date('2026-07-16T02:30:00.000Z'), sequence: 1 },
      { id: 'out', workerId: 'worker-1', shiftId: 'shift-night', eventType: 'CHECK_OUT', verificationStatus: 'VERIFIED', occurredAt: new Date('2026-07-16T10:30:00.000Z'), sequence: 2 },
    ],
  }];
  const canonical = buildAttendancePeriodProjection(attendanceEventsFromShifts(shifts));
  const merged = mergeAttendanceReportProjection({
    canonical,
    hrAttendance: {
      'Ana Torres': { name: 'Ana Torres', status: 'Ausente Justificado' },
      'worker-2': { workerId: 'worker-2', name: 'Bruno Díaz', status: 'Ausente Justificado' },
    },
  });

  assert.equal(canonical[0].checkin, '22:30');
  assert.equal(canonical[0].checkout, '06:30');
  assert.equal(merged['worker-1'].legacyException, undefined);
  assert.equal(merged['worker-1'].present, true);
  assert.equal(merged['worker-2'].legacyException, true);
  assert.equal(Object.keys(merged).length, 2);
});

test('an ambiguous legacy display name is never assigned to the wrong worker', () => {
  const canonical = [
    { workerId: 'worker-a', name: 'Juan Gómez', present: true },
    { workerId: 'worker-b', name: 'Juan Gómez', present: false },
  ];
  const merged = mergeAttendanceReportProjection({
    canonical,
    hrAttendance: {
      'Juan Gómez': { status: 'Ausente Justificado' },
    },
  });

  assert.equal(merged['worker-a'].legacyException, undefined);
  assert.equal(merged['worker-b'].legacyException, undefined);
  assert.equal(merged['Juan Gómez'].legacyException, true);
});

test('an active second break never reuses the end time from the first break', () => {
  const [entry] = buildAttendancePeriodProjection([
    event({ eventType: 'CHECK_IN', occurredAt: '2026-07-22T11:00:00.000Z', sequence: 1 }),
    event({ eventType: 'BREAK_START', occurredAt: '2026-07-22T15:00:00.000Z', sequence: 2 }),
    event({ eventType: 'BREAK_END', occurredAt: '2026-07-22T15:30:00.000Z', sequence: 3 }),
    event({ eventType: 'BREAK_START', occurredAt: '2026-07-22T18:00:00.000Z', sequence: 4 }),
  ]);

  assert.equal(entry.breakStartedAt, '15:00');
  assert.equal(entry.breakEndedAt, null);
  assert.equal(entry.status, 'Presente · en pausa');
});

test('weekly attendance shifts are paginated without dropping enterprise-sized periods', async () => {
  const rows = Array.from({ length: 2_005 }, (_, index) => ({
    id: `shift-${String(index).padStart(4, '0')}`,
    events: [],
  }));
  const calls = [];
  const prisma = {
    attendanceShift: {
      async findMany(query) {
        calls.push(query);
        const cursorIndex = query.cursor
          ? rows.findIndex((row) => row.id === query.cursor.id) + query.skip
          : 0;
        return rows.slice(cursorIndex, cursorIndex + query.take);
      },
    },
  };

  const loaded = await loadWeeklyAttendanceShifts(prisma, {
    projectId: 'project-enterprise',
    workDateRange: {
      start: new Date('2026-07-13T00:00:00.000Z'),
      end: new Date('2026-07-19T00:00:00.000Z'),
    },
    generatedAt: new Date('2026-07-19T23:59:59.000Z'),
    pageSize: 500,
  });

  assert.equal(loaded.length, 2_005);
  assert.equal(calls.length, 5);
  assert.deepEqual(calls[1].cursor, { id: 'shift-0499' });
  assert.equal(calls[0].where.projectId, 'project-enterprise');
  assert.equal(calls[0].events, undefined);
  assert.deepEqual(calls[0].select.events.where, {
    occurredAt: { lte: new Date('2026-07-19T23:59:59.000Z') },
  });
});
