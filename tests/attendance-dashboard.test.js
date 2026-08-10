import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  attendanceRows,
  attendanceSummary,
  buildSchedulePublishPayload,
  createAttendanceUiIdempotencyKey,
  createScheduleDraft,
  openAttendanceAlerts,
} from '../src/lib/attendance-dashboard.js';

const root = new URL('../', import.meta.url);

test('attendance dashboard consumes the canonical S2 control DTO', () => {
  const control = {
    summary: { present: 2, late: 1, noShow: 1, pendingClose: 1, openAlerts: 2 },
    rows: [{
      worker: { id: 'worker-1', name: 'Carla Albañil', role: 'Albañil' },
      evaluation: {
        classification: 'LATE',
        actualCheckInAt: '2026-07-28T11:15:00.000Z',
        actualCheckOutAt: null,
        delayMinutes: 15,
        workedDurationMinutes: 180,
        missingCheckout: true,
      },
      alerts: [{
        type: 'PENDING_CLOSE',
        open: true,
        acknowledged: false,
        openedEventId: 'alert-1',
      }],
    }],
  };

  assert.deepEqual(attendanceSummary(control), {
    present: 2,
    late: 1,
    noShow: 1,
    absent: 0,
    pendingClose: 1,
    reviewRequired: 0,
    openAlerts: 2,
    totalWorkers: 0,
  });
  const [row] = attendanceRows(control);
  assert.equal(row.workerId, 'worker-1');
  assert.equal(row.classificationLabel, 'Tarde');
  assert.equal(row.checkInAt, '2026-07-28T11:15:00.000Z');
  assert.equal(row.missingCheckout, true);
  assert.deepEqual(openAttendanceAlerts([row]), [{
    type: 'PENDING_CLOSE',
    open: true,
    acknowledged: false,
    openedEventId: 'alert-1',
    id: 'alert-1',
    workerId: 'worker-1',
    workerName: 'Carla Albañil',
    title: 'Jornada sin cerrar',
  }]);
});

test('schedule draft preserves the published version but advances civil effective date', () => {
  const draft = createScheduleDraft({
    workDate: '2026-07-28',
    timezone: 'America/Argentina/Buenos_Aires',
    assignedWorkerIds: ['worker-2', 'worker-1'],
    schedule: {
      id: 'schedule-1',
      name: 'Cuadrilla mañana',
      revision: 3,
      versions: [{
        effectiveFrom: '2026-07-01',
        timezone: 'America/Argentina/Buenos_Aires',
        earlyCheckInMinutes: 90,
        lateToleranceMinutes: 15,
        latePolicy: 'EXCLUDE_GRACE',
        noShowAfterMinutes: 45,
        pendingCloseAfterMinutes: 60,
        absenceFinalizeAfterMinutes: 180,
        days: Array.from({ length: 7 }, (_, index) => ({
          isoWeekday: index + 1,
          isWorkingDay: index < 5,
          startMinute: index < 5 ? 450 : null,
          endMinute: index < 5 ? 990 : null,
          endDayOffset: 0,
          expectedBreakMinutes: index < 5 ? 45 : 0,
        })),
      }],
    },
  });

  assert.equal(draft.scheduleId, 'schedule-1');
  assert.equal(draft.expectedRevision, 3);
  assert.equal(draft.effectiveFrom, '2026-07-29');
  assert.equal(draft.days[0].startTime, '07:30');
  assert.deepEqual(draft.workerIds, ['worker-1', 'worker-2']);
});

test('schedule publisher emits the exact seven-day API contract', () => {
  const draft = createScheduleDraft({
    workDate: '2026-07-28',
    timezone: 'America/Argentina/Buenos_Aires',
    assignedWorkerIds: ['worker-1'],
  });
  const payload = buildSchedulePublishPayload(draft);

  assert.equal(payload.expectedRevision, 0);
  assert.equal(payload.days.length, 7);
  assert.deepEqual(payload.days[0], {
    isoWeekday: 1,
    isWorkingDay: true,
    startMinute: 480,
    endMinute: 1020,
    endDayOffset: 0,
    expectedBreakMinutes: 60,
  });
  assert.deepEqual(payload.days[6], {
    isoWeekday: 7,
    isWorkingDay: false,
    startMinute: null,
    endMinute: null,
    endDayOffset: 0,
    expectedBreakMinutes: 0,
  });
});

test('attendance UI idempotency keys satisfy the strict API header contract', () => {
  const key = createAttendanceUiIdempotencyKey();

  assert.match(key, /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  assert.equal(key.startsWith('attendance-ui:'), true);
  assert.equal(key.length <= 128, true);
});

test('editing never schedules a new revision before an already-published future version', () => {
  const draft = createScheduleDraft({
    workDate: '2026-07-28',
    schedule: {
      id: 'schedule-future',
      revision: 1,
      versions: [{ effectiveFrom: '2026-08-10', days: [] }],
    },
  });
  assert.equal(draft.effectiveFrom, '2026-08-11');
});

test('schedule publisher rejects incoherent operational thresholds', () => {
  const draft = createScheduleDraft({ workDate: '2026-07-28' });
  draft.lateToleranceMinutes = 40;
  draft.noShowAfterMinutes = 30;
  assert.throws(
    () => buildSchedulePublishPayload(draft),
    /umbral sin ingreso debe ser un entero entre 40 y 1440/,
  );
});

test('attendance console keeps every write on the authenticated idempotent API contract', async () => {
  const [client, page] = await Promise.all([
    readFile(new URL('src/app/dashboard/attendance/attendance-client.js', root), 'utf8'),
    readFile(new URL('src/app/dashboard/attendance/page.js', root), 'utf8'),
  ]);

  assert.match(client, /attendanceSummary\(control\)/);
  assert.match(client, /attendanceRows\(control\)/);
  assert.match(client, /openAttendanceAlerts\(rows\)/);
  assert.match(
    client,
    /\/api\/attendance\/alerts\/\$\{encodeURIComponent\(alert\.id\)\}\/acknowledge[\s\S]{0,100}method: 'POST',[\s\S]{0,40}\}\);/,
  );
  assert.doesNotMatch(client, /body: JSON\.stringify\(\{ eventId:/);
  assert.match(
    client,
    /\/api\/attendance\/corrections\/\$\{encodeURIComponent\(correction\.id\)\}\/decision[\s\S]{0,220}'Idempotency-Key': replaySafeKey\(scope, payload\)/,
  );
  assert.match(client, /reasonCode: decision === 'APPROVED' \? 'ADMIN_APPROVED' : 'ADMIN_REJECTED'/);
  assert.match(
    client,
    /requestJson\('\/api\/attendance\/schedules',[\s\S]{0,180}'Idempotency-Key': replaySafeKey\(scope, payload\)/,
  );
  assert.match(client, /key: createAttendanceUiIdempotencyKey\(\)/);
  assert.doesNotMatch(client, /createAttendanceUiIdempotencyKey\(scope\)/);
  assert.doesNotMatch(client, /attendance-ui:\$\{kind\}/);
  assert.match(
    client,
    /requestJson\('\/api\/attendance\/exceptions',[\s\S]{0,180}'Idempotency-Key': replaySafeKey\(scope, payload\)/,
  );
  assert.match(page, /import styles from '\.\/attendance\.module\.css'/);
  assert.match(page, /effectiveFrom: \{ lte: workDate \}/);
});
