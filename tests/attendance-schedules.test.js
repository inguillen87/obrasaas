import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTENDANCE_CLASSIFICATIONS,
  ATTENDANCE_LIFECYCLE,
  ATTENDANCE_PRESENCE,
  ATTENDANCE_PUNCTUALITY,
  AttendanceScheduleDomainError,
  attendanceScheduleConfigHash,
  attendanceScheduleIdempotencyKey,
  attendanceScheduleRequestFingerprint,
  buildAttendanceExpectationRevision,
  canonicalAttendanceHash,
  evaluateAttendanceDay,
  normalizePublishedAttendanceSchedule,
  serializeAttendanceEvaluation,
} from '../src/lib/attendance-schedules.js';

const MONDAY = '2026-07-20';
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function weeklyDays({
  startMinute = 8 * 60,
  endMinute = 17 * 60,
  endDayOffset = 0,
  expectedBreakMinutes = 60,
  workingDays = [1, 2, 3, 4, 5],
} = {}) {
  return [7, 5, 3, 1, 6, 4, 2].map((isoWeekday) => ({
    id: `schedule-day-${isoWeekday}`,
    isoWeekday,
    isWorkingDay: workingDays.includes(isoWeekday),
    ...(workingDays.includes(isoWeekday)
      ? { startMinute, endMinute, endDayOffset, expectedBreakMinutes }
      : {}),
  }));
}

function publishedSchedule(overrides = {}) {
  return {
    id: 'schedule-version-1',
    projectId: 'project-1',
    scheduleId: 'schedule-1',
    version: 1,
    effectiveFrom: '2026-07-01',
    timezone: TIME_ZONE,
    earlyCheckInMinutes: 120,
    lateToleranceMinutes: 10,
    latePolicy: 'FULL_FROM_SCHEDULE',
    noShowAfterMinutes: 30,
    pendingCloseAfterMinutes: 60,
    absenceFinalizeAfterMinutes: 120,
    status: 'PUBLISHED',
    publishedAt: new Date('2026-06-30T15:00:00.000Z'),
    days: weeklyDays(),
    ...overrides,
  };
}

function expectation(overrides = {}) {
  return buildAttendanceExpectationRevision({
    expectationId: 'expectation-1',
    revision: 1,
    workDate: MONDAY,
    schedule: publishedSchedule(),
    ...overrides,
  });
}

function event(eventType, occurredAt, verificationStatus = 'NOT_REQUIRED', overrides = {}) {
  return {
    id: overrides.id || `${eventType}-${occurredAt}`,
    eventType,
    occurredAt,
    verificationStatus,
    ...overrides,
  };
}

test('published weekly schedules normalize all seven weekdays and hash canonically', () => {
  const input = publishedSchedule();
  const normalized = normalizePublishedAttendanceSchedule(input);

  assert.deepEqual(normalized.days.map((day) => day.isoWeekday), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(normalized.days[0].startMinute, 480);
  assert.equal(normalized.days[5].isWorkingDay, false);
  assert.equal(normalized.days[5].startMinute, null);
  assert.match(normalized.configHash, /^[0-9a-f]{64}$/);
  assert.equal(attendanceScheduleConfigHash(input), normalized.configHash);
  assert.equal(
    canonicalAttendanceHash({ b: 2, a: 1 }),
    canonicalAttendanceHash({ a: 1, b: 2 }),
  );
  assert.equal(
    attendanceScheduleRequestFingerprint(input),
    attendanceScheduleRequestFingerprint({ ...input, days: [...input.days] }),
  );
});

test('schedule idempotency keys are scoped and deterministic', () => {
  const base = {
    projectId: 'project-1',
    scheduleId: 'schedule-1',
    operation: 'publish',
    idempotencyKey: 'request-123',
  };
  const key = attendanceScheduleIdempotencyKey(base);
  assert.match(key, /^attendance:schedule:v1:[0-9a-f]{64}$/);
  assert.equal(attendanceScheduleIdempotencyKey(base), key);
  assert.notEqual(
    attendanceScheduleIdempotencyKey({ ...base, projectId: 'project-2' }),
    key,
  );
  assert.notEqual(
    attendanceScheduleIdempotencyKey({ ...base, idempotencyKey: 'request-124' }),
    key,
  );
});

test('published schedules reject incomplete, duplicate and invalid day windows', () => {
  assert.throws(
    () => normalizePublishedAttendanceSchedule(publishedSchedule({
      days: weeklyDays().slice(0, 6),
    })),
    (error) => (
      error instanceof AttendanceScheduleDomainError
      && error.code === 'ATTENDANCE_SCHEDULE_WEEK_INCOMPLETE'
    ),
  );

  const duplicateDays = weeklyDays();
  duplicateDays[1] = { ...duplicateDays[1], isoWeekday: duplicateDays[0].isoWeekday };
  assert.throws(
    () => normalizePublishedAttendanceSchedule(publishedSchedule({ days: duplicateDays })),
    (error) => error.code === 'ATTENDANCE_SCHEDULE_WEEK_INVALID',
  );

  assert.throws(
    () => normalizePublishedAttendanceSchedule(publishedSchedule({
      days: weeklyDays({ startMinute: 22 * 60, endMinute: 6 * 60, endDayOffset: 0 }),
    })),
    (error) => error.code === 'ATTENDANCE_SCHEDULE_DAY_INVALID',
  );
  assert.throws(
    () => normalizePublishedAttendanceSchedule(publishedSchedule({
      noShowAfterMinutes: 5,
      lateToleranceMinutes: 10,
    })),
    (error) => error.code === 'ATTENDANCE_SCHEDULE_POLICY_INVALID',
  );
});

test('a working expectation snapshots exact UTC thresholds and policy', () => {
  const result = expectation();

  assert.equal(result.kind, 'WORKING');
  assert.equal(result.expectedStartAt.toISOString(), '2026-07-20T11:00:00.000Z');
  assert.equal(result.expectedEndAt.toISOString(), '2026-07-20T20:00:00.000Z');
  assert.equal(result.graceEndsAt.toISOString(), '2026-07-20T11:10:00.000Z');
  assert.equal(result.noShowAt.toISOString(), '2026-07-20T11:30:00.000Z');
  assert.equal(result.pendingCloseAt.toISOString(), '2026-07-20T21:00:00.000Z');
  assert.equal(result.absenceAt.toISOString(), '2026-07-20T22:00:00.000Z');
  assert.equal(result.expectedBreakMinutes, 60);
  assert.equal(result.scheduleDayId, 'schedule-day-1');
  assert.match(result.policyHash, /^[0-9a-f]{64}$/);
});

test('overnight expectations keep the starting work date and end on the next local day', () => {
  const schedule = publishedSchedule({
    days: weeklyDays({
      startMinute: 22 * 60,
      endMinute: 6 * 60,
      endDayOffset: 1,
      expectedBreakMinutes: 30,
      workingDays: [1, 2, 3, 4, 5, 6, 7],
    }),
  });
  const result = buildAttendanceExpectationRevision({
    expectationId: 'overnight-expectation',
    revision: 1,
    workDate: MONDAY,
    schedule,
  });

  assert.equal(result.expectedStartAt.toISOString(), '2026-07-21T01:00:00.000Z');
  assert.equal(result.expectedEndAt.toISOString(), '2026-07-21T09:00:00.000Z');
  assert.equal(result.expectedEndAt - result.expectedStartAt, 8 * 60 * 60 * 1_000);
});

test('DST gaps fail closed and an overlap uses the deterministic earlier start instant', () => {
  const springSchedule = publishedSchedule({
    timezone: 'America/New_York',
    effectiveFrom: '2026-01-01',
    days: weeklyDays({
      startMinute: 150,
      endMinute: 240,
      workingDays: [7],
      expectedBreakMinutes: 0,
    }),
  });
  assert.throws(
    () => buildAttendanceExpectationRevision({
      expectationId: 'spring-gap',
      revision: 1,
      workDate: '2026-03-08',
      schedule: springSchedule,
    }),
    (error) => (
      error instanceof AttendanceScheduleDomainError
      && error.code === 'ATTENDANCE_SCHEDULE_CIVIL_TIME_INVALID'
    ),
  );

  const overlapSchedule = publishedSchedule({
    timezone: 'America/New_York',
    effectiveFrom: '2026-01-01',
    days: weeklyDays({
      startMinute: 90,
      endMinute: 210,
      workingDays: [7],
      expectedBreakMinutes: 0,
    }),
  });
  const overlap = buildAttendanceExpectationRevision({
    expectationId: 'fall-overlap',
    revision: 1,
    workDate: '2026-11-01',
    schedule: overlapSchedule,
  });
  assert.equal(overlap.expectedStartAt.toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(overlap.expectedEndAt.toISOString(), '2026-11-01T08:30:00.000Z');
});

test('non-working days and approved leave create timestamp-free snapshots', () => {
  const saturday = buildAttendanceExpectationRevision({
    expectationId: 'saturday',
    revision: 1,
    workDate: '2026-07-25',
    schedule: publishedSchedule(),
  });
  assert.equal(saturday.kind, 'NON_WORKING');
  assert.equal(saturday.expectedStartAt, null);
  assert.equal(saturday.scheduleDayId, 'schedule-day-6');

  const excused = expectation({
    expectationId: 'excused',
    exceptionRevision: {
      id: 'exception-revision-1',
      revision: 1,
      action: 'SET',
      type: 'APPROVED_LEAVE',
    },
  });
  assert.equal(excused.kind, 'EXCUSED');
  assert.equal(excused.exceptionRevisionId, 'exception-revision-1');
  assert.equal(excused.expectedStartAt, null);
  assert.equal(excused.latePolicy, null);
});

test('approved offsite work suppresses on-site no-show and absence', () => {
  const expectation = buildAttendanceExpectationRevision({
    expectationId: 'expectation-offsite',
    revision: 1,
    workDate: '2026-07-20',
    schedule: publishedSchedule(),
    scheduleVersionId: 'version-1',
    scheduleDayId: 'day-1',
    exceptionRevision: {
      id: 'exception-offsite-1',
      revision: 1,
      action: 'SET',
      type: 'OFFSITE_WORK',
    },
  });
  assert.equal(expectation.kind, 'EXCUSED');
  const evaluation = evaluateAttendanceDay({
    expectationRevision: expectation,
    events: [],
    workDate: '2026-07-20',
    asOf: '2026-07-21T23:00:00.000Z',
  });
  assert.equal(evaluation.classification, 'EXCUSED');
  assert.equal(evaluation.presence, 'EXCUSED');
  assert.equal(evaluation.lifecycle, 'EXCUSED');
});

test('no schedule is UNSCHEDULED and never becomes an automatic absence', () => {
  const result = evaluateAttendanceDay({
    expectationRevision: null,
    asOf: '2026-07-20T23:59:59.999Z',
    events: [],
    workDate: MONDAY,
  });

  assert.equal(result.classification, ATTENDANCE_CLASSIFICATIONS.UNSCHEDULED);
  assert.equal(result.presence, ATTENDANCE_PRESENCE.UNSCHEDULED);
  assert.equal(result.lifecycle, ATTENDANCE_LIFECYCLE.UNSCHEDULED);
});

test('no-show and absence thresholds are inclusive while pre-threshold values remain expected', () => {
  const expected = expectation();
  const beforeNoShow = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: new Date(expected.noShowAt.getTime() - 1),
  });
  const noShow = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.noShowAt,
  });
  const beforeAbsent = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: new Date(expected.absenceAt.getTime() - 1),
  });
  const absent = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.absenceAt,
  });

  assert.equal(beforeNoShow.classification, ATTENDANCE_CLASSIFICATIONS.EXPECTED);
  assert.equal(noShow.classification, ATTENDANCE_CLASSIFICATIONS.NO_SHOW);
  assert.equal(noShow.lifecycle, ATTENDANCE_LIFECYCLE.NO_SHOW);
  assert.equal(beforeAbsent.classification, ATTENDANCE_CLASSIFICATIONS.NO_SHOW);
  assert.equal(absent.classification, ATTENDANCE_CLASSIFICATIONS.ABSENT);
  assert.equal(absent.presence, ATTENDANCE_PRESENCE.ABSENT);
});

test('check-in at grace is on time and one millisecond later is late', () => {
  const expected = expectation();
  const atGrace = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: '2026-07-20T12:00:00.000Z',
    events: [event('CHECK_IN', expected.graceEndsAt, 'VERIFIED')],
  });
  const afterGraceAt = new Date(expected.graceEndsAt.getTime() + 1);
  const afterGrace = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: '2026-07-20T12:00:00.000Z',
    events: [event('CHECK_IN', afterGraceAt, 'VERIFIED')],
  });

  assert.equal(atGrace.classification, ATTENDANCE_CLASSIFICATIONS.PRESENT);
  assert.equal(atGrace.punctuality, ATTENDANCE_PUNCTUALITY.ON_TIME);
  assert.equal(afterGrace.classification, ATTENDANCE_CLASSIFICATIONS.LATE);
  assert.equal(afterGrace.punctuality, ATTENDANCE_PUNCTUALITY.LATE);
  assert.equal(afterGrace.delayMinutes, 11);
});

test('pending GPS remains pending even after no-show and geofence review never claims verified presence', () => {
  const expected = expectation();
  const pending = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.absenceAt,
    events: [event('CHECK_IN', expected.expectedStartAt, 'PENDING')],
  });
  assert.equal(pending.classification, ATTENDANCE_CLASSIFICATIONS.PENDING_GPS);
  assert.equal(pending.lifecycle, ATTENDANCE_LIFECYCLE.PENDING_GPS);
  assert.equal(pending.pendingGps, true);
  assert.equal(pending.presence, ATTENDANCE_PRESENCE.EXPECTED);

  const reviewed = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: '2026-07-20T12:00:00.000Z',
    events: [event('CHECK_IN', '2026-07-20T11:11:00.000Z', 'REVIEW_REQUIRED')],
  });
  assert.equal(reviewed.classification, ATTENDANCE_CLASSIFICATIONS.REVIEW_REQUIRED);
  assert.equal(reviewed.presence, ATTENDANCE_PRESENCE.REVIEW_REQUIRED);
  assert.equal(reviewed.punctuality, ATTENDANCE_PUNCTUALITY.LATE);
  assert.equal(reviewed.reviewRequired, true);
});

test('an excused day with an actual check-in preserves the fact and exposes the conflict', () => {
  const excused = expectation({
    exceptionRevision: {
      id: 'exception-revision-1',
      action: 'SET',
      type: 'EXCUSED_ABSENCE',
    },
  });
  const withoutEntry = evaluateAttendanceDay({
    expectationRevision: excused,
    asOf: '2026-07-20T20:00:00.000Z',
  });
  assert.equal(withoutEntry.classification, ATTENDANCE_CLASSIFICATIONS.EXCUSED);
  assert.equal(withoutEntry.presence, ATTENDANCE_PRESENCE.EXCUSED);

  const withEntry = evaluateAttendanceDay({
    expectationRevision: excused,
    asOf: '2026-07-20T20:00:00.000Z',
    events: [event('CHECK_IN', '2026-07-20T11:00:00.000Z', 'VERIFIED')],
  });
  assert.equal(withEntry.classification, ATTENDANCE_CLASSIFICATIONS.PRESENT);
  assert.equal(withEntry.presence, ATTENDANCE_PRESENCE.PRESENT);
  assert.equal(withEntry.punctuality, ATTENDANCE_PUNCTUALITY.NOT_APPLICABLE);
  assert.equal(withEntry.exceptionConflict, true);
});

test('missing checkout becomes pending-close at the exact threshold without inventing an exit', () => {
  const expected = expectation();
  const atThreshold = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.pendingCloseAt,
    shift: { status: 'OPEN' },
    events: [event('CHECK_IN', expected.expectedStartAt, 'VERIFIED')],
  });

  assert.equal(atThreshold.classification, ATTENDANCE_CLASSIFICATIONS.PENDING_CLOSE);
  assert.equal(atThreshold.lifecycle, ATTENDANCE_LIFECYCLE.PENDING_CLOSE);
  assert.equal(atThreshold.actualCheckOutAt, null);
  assert.equal(atThreshold.missingCheckout, true);
  assert.equal(atThreshold.workedDurationMinutes, 10 * 60);
  assert.equal(atThreshold.expectedBreakMinutes, 60);
});

test('worked time subtracts only recorded breaks, never the fixed expected break', () => {
  const expected = expectation();
  const noBreak = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.expectedEndAt,
    events: [
      event('CHECK_IN', expected.expectedStartAt, 'VERIFIED', { sequence: 1 }),
      event('CHECK_OUT', expected.expectedEndAt, 'VERIFIED', { sequence: 2 }),
    ],
  });
  assert.equal(noBreak.workedDurationMinutes, 9 * 60);
  assert.equal(noBreak.recordedBreakMinutes, 0);

  const withBreak = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.expectedEndAt,
    events: [
      event('CHECK_IN', expected.expectedStartAt, 'VERIFIED', { sequence: 1 }),
      event('BREAK_START', '2026-07-20T15:00:00.000Z', 'NOT_REQUIRED', { sequence: 2 }),
      event('BREAK_END', '2026-07-20T15:30:00.000Z', 'NOT_REQUIRED', { sequence: 3 }),
      event('CHECK_OUT', expected.expectedEndAt, 'VERIFIED', { sequence: 4 }),
    ],
  });
  assert.equal(withBreak.recordedBreakMinutes, 30);
  assert.equal(withBreak.workedDurationMinutes, (9 * 60) - 30);
  assert.equal(withBreak.lifecycle, ATTENDANCE_LIFECYCLE.CLOSED);
});

test('a closed projection without CHECK_OUT remains visibly anomalous and does not invent a timestamp', () => {
  const expected = expectation();
  const result = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: expected.pendingCloseAt,
    shift: { status: 'CLOSED' },
    events: [event('CHECK_IN', expected.expectedStartAt, 'VERIFIED')],
  });

  assert.equal(result.actualCheckOutAt, null);
  assert.equal(result.lifecycle, ATTENDANCE_LIFECYCLE.PENDING_CLOSE);
  assert.ok(result.anomalies.includes('SHIFT_CLOSED_WITHOUT_CHECK_OUT'));
});

test('an unscheduled check-in remains a real presence but is flagged as unscheduled work', () => {
  const result = evaluateAttendanceDay({
    expectationRevision: null,
    asOf: '2026-07-20T12:00:00.000Z',
    events: [event('CHECK_IN', '2026-07-20T11:00:00.000Z', 'VERIFIED')],
  });

  assert.equal(result.classification, ATTENDANCE_CLASSIFICATIONS.UNSCHEDULED);
  assert.equal(result.presence, ATTENDANCE_PRESENCE.PRESENT);
  assert.equal(result.lifecycle, ATTENDANCE_LIFECYCLE.IN_PROGRESS);
  assert.equal(result.unscheduledWork, true);
});

test('minimal serialization excludes GPS, evidence, events and internal hashes', () => {
  const expected = expectation();
  const evaluated = evaluateAttendanceDay({
    expectationRevision: expected,
    asOf: '2026-07-20T12:00:00.000Z',
    events: [{
      ...event('CHECK_IN', expected.expectedStartAt, 'VERIFIED'),
      latitude: -34.6,
      longitude: -58.4,
      evidence: { private: true },
    }],
  });
  const serialized = serializeAttendanceEvaluation({
    ...evaluated,
    latitude: -34.6,
    evidence: { private: true },
    events: [{ latitude: -34.6 }],
  });
  const json = JSON.stringify(serialized);

  assert.equal(serialized.actualCheckInAt, expected.expectedStartAt.toISOString());
  assert.equal(Object.hasOwn(serialized, 'policyHash'), false);
  assert.doesNotMatch(json, /latitude|longitude|evidence|events|private/);
});
