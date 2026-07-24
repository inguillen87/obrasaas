import { createHash } from 'node:crypto';

import {
  assertTimeZone,
  isoWeekday,
  parseDateKey,
  zonedMinuteToUtc,
} from './zoned-time.js';

export const ATTENDANCE_SCHEDULE_CONTRACT_VERSION = 'attendance-schedule:v1';
export const ATTENDANCE_CLASSIFIER_VERSION = 'attendance-day:v1';

export const ATTENDANCE_SCHEDULE_DEFAULTS = Object.freeze({
  earlyCheckInMinutes: 120,
  lateToleranceMinutes: 10,
  latePolicy: 'FULL_FROM_SCHEDULE',
  noShowAfterMinutes: 30,
  pendingCloseAfterMinutes: 60,
  absenceFinalizeAfterMinutes: 120,
});

export const ATTENDANCE_LATE_POLICIES = Object.freeze([
  'FULL_FROM_SCHEDULE',
  'EXCLUDE_GRACE',
]);

export const ATTENDANCE_PRESENCE = Object.freeze({
  UNSCHEDULED: 'UNSCHEDULED',
  EXPECTED: 'EXPECTED',
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

export const ATTENDANCE_PUNCTUALITY = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
  ON_TIME: 'ON_TIME',
  LATE: 'LATE',
});

export const ATTENDANCE_LIFECYCLE = Object.freeze({
  UNSCHEDULED: 'UNSCHEDULED',
  UPCOMING: 'UPCOMING',
  EXPECTED: 'EXPECTED',
  PENDING_GPS: 'PENDING_GPS',
  NO_SHOW: 'NO_SHOW',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_CLOSE: 'PENDING_CLOSE',
  CLOSED: 'CLOSED',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
});

export const ATTENDANCE_CLASSIFICATIONS = Object.freeze({
  UNSCHEDULED: 'UNSCHEDULED',
  EXPECTED: 'EXPECTED',
  PRESENT: 'PRESENT',
  LATE: 'LATE',
  PENDING_GPS: 'PENDING_GPS',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  NO_SHOW: 'NO_SHOW',
  ABSENT: 'ABSENT',
  EXCUSED: 'EXCUSED',
  PENDING_CLOSE: 'PENDING_CLOSE',
});

const SCHEDULE_STATUS = 'PUBLISHED';
const WORKING_KIND = 'WORKING';
const NON_WORKING_KIND = 'NON_WORKING';
const EXCUSED_KIND = 'EXCUSED';
// OFFSITE_WORK suppresses the on-site attendance obligation. It remains an
// explicit exception type for reporting, but it must never produce an on-site
// no-show/absence or pretend that a geofence check occurred elsewhere.
const EXCUSED_EXCEPTION_TYPES = new Set([
  'EXCUSED_ABSENCE',
  'APPROVED_LEAVE',
  'OFFSITE_WORK',
]);
const FINAL_EVENT_VERIFICATIONS = new Set([
  'VERIFIED',
  'REVIEW_REQUIRED',
  'NOT_REQUIRED',
  'MANUAL_APPROVED',
]);
const EVENT_TYPES = new Set(['CHECK_IN', 'BREAK_START', 'BREAK_END', 'CHECK_OUT']);
const MINUTE_MS = 60_000;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class AttendanceScheduleDomainError extends Error {
  constructor(message, code = 'ATTENDANCE_SCHEDULE_INVALID', status = 400, details = null) {
    super(message);
    this.name = 'AttendanceScheduleDomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const AttendanceScheduleError = AttendanceScheduleDomainError;

function domainError(message, code = 'ATTENDANCE_SCHEDULE_INVALID', details = null) {
  return new AttendanceScheduleDomainError(message, code, 400, details);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requiredObject(value, field) {
  if (!isPlainObject(value)) {
    throw domainError(`${field} must be an object.`, 'ATTENDANCE_SCHEDULE_INPUT_INVALID');
  }
  return value;
}

function optionalId(value, field) {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field, 190);
}

function requiredText(value, field, max = 190) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !normalized
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw domainError(
      `${field} is required and must contain at most ${max} safe characters.`,
      'ATTENDANCE_SCHEDULE_INPUT_INVALID',
    );
  }
  return normalized;
}

function boundedInteger(value, field, minimum, maximum, fallback = undefined) {
  const candidate = value === null || value === undefined ? fallback : value;
  if (!Number.isSafeInteger(candidate) || candidate < minimum || candidate > maximum) {
    throw domainError(
      `${field} must be an integer between ${minimum} and ${maximum}.`,
      'ATTENDANCE_SCHEDULE_POLICY_INVALID',
    );
  }
  return candidate;
}

function positiveInteger(value, field) {
  return boundedInteger(value, field, 1, Number.MAX_SAFE_INTEGER);
}

function dateKey(value, field) {
  let candidate = value;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw domainError(`${field} must be a valid date.`, 'ATTENDANCE_SCHEDULE_DATE_INVALID');
    }
    candidate = value.toISOString().slice(0, 10);
  }
  if (typeof candidate !== 'string' || !DATE_KEY_PATTERN.test(candidate)) {
    throw domainError(`${field} must be a YYYY-MM-DD date.`, 'ATTENDANCE_SCHEDULE_DATE_INVALID');
  }
  try {
    parseDateKey(candidate);
  } catch (error) {
    throw domainError(
      `${field} must be a real calendar date.`,
      'ATTENDANCE_SCHEDULE_DATE_INVALID',
      { cause: error.message },
    );
  }
  return candidate;
}

function instant(value, field, { optional = false } = {}) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    throw domainError(`${field} must be a timestamp.`, 'ATTENDANCE_TIME_INVALID');
  }
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw domainError(`${field} must be a valid timestamp.`, 'ATTENDANCE_TIME_INVALID');
  }
  return parsed;
}

function normalizedTimeZone(value) {
  const timeZone = requiredText(value, 'timezone', 64);
  try {
    return assertTimeZone(timeZone);
  } catch (error) {
    throw domainError(
      'timezone must be a supported named IANA timezone.',
      'ATTENDANCE_TIMEZONE_INVALID',
      { cause: error.message },
    );
  }
}

function normalizedLatePolicy(value) {
  const candidate = value ?? ATTENDANCE_SCHEDULE_DEFAULTS.latePolicy;
  if (!ATTENDANCE_LATE_POLICIES.includes(candidate)) {
    throw domainError(
      'latePolicy is not supported.',
      'ATTENDANCE_SCHEDULE_POLICY_INVALID',
      { allowed: ATTENDANCE_LATE_POLICIES },
    );
  }
  return candidate;
}

function normalizedDay(value, index) {
  const day = requiredObject(value, `days[${index}]`);
  const isoDay = boundedInteger(day.isoWeekday, `days[${index}].isoWeekday`, 1, 7);
  if (typeof day.isWorkingDay !== 'boolean') {
    throw domainError(
      `days[${index}].isWorkingDay must be a boolean.`,
      'ATTENDANCE_SCHEDULE_DAY_INVALID',
    );
  }

  const id = optionalId(day.id, `days[${index}].id`);
  if (!day.isWorkingDay) {
    if (
      ![null, undefined].includes(day.startMinute)
      || ![null, undefined].includes(day.endMinute)
      || ![null, undefined, 0].includes(day.endDayOffset)
      || ![null, undefined, 0].includes(day.expectedBreakMinutes)
    ) {
      throw domainError(
        `days[${index}] is non-working and cannot define hours or a break.`,
        'ATTENDANCE_SCHEDULE_DAY_INVALID',
      );
    }
    return {
      ...(id ? { id } : {}),
      isoWeekday: isoDay,
      isWorkingDay: false,
      startMinute: null,
      endMinute: null,
      endDayOffset: 0,
      expectedBreakMinutes: 0,
    };
  }

  const startMinute = boundedInteger(
    day.startMinute,
    `days[${index}].startMinute`,
    0,
    1_439,
  );
  const endMinute = boundedInteger(
    day.endMinute,
    `days[${index}].endMinute`,
    0,
    1_439,
  );
  const endDayOffset = boundedInteger(
    day.endDayOffset,
    `days[${index}].endDayOffset`,
    0,
    1,
    0,
  );
  const durationMinutes = endMinute + (endDayOffset * 1_440) - startMinute;
  if (durationMinutes < 1 || durationMinutes > 1_440) {
    throw domainError(
      `days[${index}] must have a positive duration no longer than 24 hours.`,
      'ATTENDANCE_SCHEDULE_DAY_INVALID',
    );
  }
  const expectedBreakMinutes = boundedInteger(
    day.expectedBreakMinutes,
    `days[${index}].expectedBreakMinutes`,
    0,
    720,
    0,
  );
  if (expectedBreakMinutes >= durationMinutes) {
    throw domainError(
      `days[${index}].expectedBreakMinutes must be shorter than the work window.`,
      'ATTENDANCE_SCHEDULE_DAY_INVALID',
    );
  }
  return {
    ...(id ? { id } : {}),
    isoWeekday: isoDay,
    isWorkingDay: true,
    startMinute,
    endMinute,
    endDayOffset,
    expectedBreakMinutes,
  };
}

function canonicalValue(value, path = 'value') {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw domainError(`${path} contains a non-finite number.`, 'ATTENDANCE_CANONICAL_VALUE_INVALID');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw domainError(`${path} contains an invalid date.`, 'ATTENDANCE_CANONICAL_VALUE_INVALID');
    }
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalValue(item, `${path}[${index}]`));
  }
  if (!isPlainObject(value)) {
    throw domainError(`${path} is not canonical JSON.`, 'ATTENDANCE_CANONICAL_VALUE_INVALID');
  }
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => [key, canonicalValue(value[key], `${path}.${key}`)]),
  );
}

export function canonicalAttendanceJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalAttendanceHash(value, namespace = ATTENDANCE_SCHEDULE_CONTRACT_VERSION) {
  const normalizedNamespace = requiredText(namespace, 'namespace', 120);
  return createHash('sha256')
    .update(`${normalizedNamespace}\0${canonicalAttendanceJson(value)}`)
    .digest('hex');
}

function scheduleConfigPayload(schedule) {
  return {
    contractVersion: ATTENDANCE_SCHEDULE_CONTRACT_VERSION,
    version: schedule.version,
    effectiveFrom: schedule.effectiveFrom,
    timezone: schedule.timezone,
    earlyCheckInMinutes: schedule.earlyCheckInMinutes,
    lateToleranceMinutes: schedule.lateToleranceMinutes,
    latePolicy: schedule.latePolicy,
    noShowAfterMinutes: schedule.noShowAfterMinutes,
    pendingCloseAfterMinutes: schedule.pendingCloseAfterMinutes,
    absenceFinalizeAfterMinutes: schedule.absenceFinalizeAfterMinutes,
    days: schedule.days.map((day) => ({
      isoWeekday: day.isoWeekday,
      isWorkingDay: day.isWorkingDay,
      startMinute: day.startMinute,
      endMinute: day.endMinute,
      endDayOffset: day.endDayOffset,
      expectedBreakMinutes: day.expectedBreakMinutes,
    })),
  };
}

export function normalizePublishedAttendanceSchedule(value) {
  const input = requiredObject(value, 'schedule');
  const status = input.status ?? SCHEDULE_STATUS;
  if (status !== SCHEDULE_STATUS) {
    throw domainError(
      'Only a PUBLISHED attendance schedule can create expectations.',
      'ATTENDANCE_SCHEDULE_NOT_PUBLISHED',
    );
  }
  if (!Array.isArray(input.days) || input.days.length !== 7) {
    throw domainError(
      'A published attendance schedule must define exactly seven weekdays.',
      'ATTENDANCE_SCHEDULE_WEEK_INCOMPLETE',
    );
  }
  const days = input.days.map(normalizedDay).sort((left, right) => (
    left.isoWeekday - right.isoWeekday
  ));
  if (new Set(days.map((day) => day.isoWeekday)).size !== 7) {
    throw domainError(
      'A published attendance schedule must define each ISO weekday exactly once.',
      'ATTENDANCE_SCHEDULE_WEEK_INVALID',
    );
  }

  const lateToleranceMinutes = boundedInteger(
    input.lateToleranceMinutes,
    'lateToleranceMinutes',
    0,
    240,
    ATTENDANCE_SCHEDULE_DEFAULTS.lateToleranceMinutes,
  );
  const pendingCloseAfterMinutes = boundedInteger(
    input.pendingCloseAfterMinutes,
    'pendingCloseAfterMinutes',
    0,
    1_440,
    ATTENDANCE_SCHEDULE_DEFAULTS.pendingCloseAfterMinutes,
  );
  const noShowAfterMinutes = boundedInteger(
    input.noShowAfterMinutes,
    'noShowAfterMinutes',
    lateToleranceMinutes,
    1_440,
    ATTENDANCE_SCHEDULE_DEFAULTS.noShowAfterMinutes,
  );
  const absenceFinalizeAfterMinutes = boundedInteger(
    input.absenceFinalizeAfterMinutes,
    'absenceFinalizeAfterMinutes',
    pendingCloseAfterMinutes,
    2_880,
    ATTENDANCE_SCHEDULE_DEFAULTS.absenceFinalizeAfterMinutes,
  );

  const normalized = {
    ...(optionalId(input.id, 'id') ? { id: optionalId(input.id, 'id') } : {}),
    ...(optionalId(input.projectId, 'projectId')
      ? { projectId: optionalId(input.projectId, 'projectId') }
      : {}),
    ...(optionalId(input.scheduleId, 'scheduleId')
      ? { scheduleId: optionalId(input.scheduleId, 'scheduleId') }
      : {}),
    version: positiveInteger(input.version, 'version'),
    effectiveFrom: dateKey(input.effectiveFrom, 'effectiveFrom'),
    timezone: normalizedTimeZone(input.timezone),
    earlyCheckInMinutes: boundedInteger(
      input.earlyCheckInMinutes,
      'earlyCheckInMinutes',
      0,
      720,
      ATTENDANCE_SCHEDULE_DEFAULTS.earlyCheckInMinutes,
    ),
    lateToleranceMinutes,
    latePolicy: normalizedLatePolicy(input.latePolicy),
    noShowAfterMinutes,
    pendingCloseAfterMinutes,
    absenceFinalizeAfterMinutes,
    status,
    days,
  };
  const publishedAt = instant(input.publishedAt, 'publishedAt', { optional: true });
  if (!publishedAt) {
    throw domainError(
      'A PUBLISHED attendance schedule requires publishedAt.',
      'ATTENDANCE_SCHEDULE_NOT_PUBLISHED',
    );
  }
  normalized.publishedAt = publishedAt;
  normalized.configHash = canonicalAttendanceHash(
    scheduleConfigPayload(normalized),
    `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:config`,
  );
  return normalized;
}

export function attendanceScheduleConfigHash(value) {
  return normalizePublishedAttendanceSchedule(value).configHash;
}

export function attendanceScheduleRequestFingerprint(value) {
  const schedule = normalizePublishedAttendanceSchedule(value);
  return canonicalAttendanceHash({
    ...scheduleConfigPayload(schedule),
    id: schedule.id || null,
    projectId: schedule.projectId || null,
    scheduleId: schedule.scheduleId || null,
    publishedAt: schedule.publishedAt,
  }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:request`);
}

export function attendanceScheduleIdempotencyKey({
  projectId,
  scheduleId,
  operation = 'publish',
  idempotencyKey,
} = {}) {
  const scope = {
    projectId: requiredText(projectId, 'projectId', 180),
    scheduleId: requiredText(scheduleId, 'scheduleId', 180),
    operation: requiredText(operation, 'operation', 64).toLowerCase(),
    idempotencyKey: requiredText(idempotencyKey, 'idempotencyKey', 512),
  };
  const digest = canonicalAttendanceHash(
    scope,
    `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:idempotency`,
  );
  return `attendance:schedule:v1:${digest}`;
}

export const scopedAttendanceScheduleIdempotencyKey = attendanceScheduleIdempotencyKey;

function normalizedException(value) {
  if (value === null || value === undefined) return null;
  const exception = requiredObject(value, 'exceptionRevision');
  const action = exception.action ?? 'SET';
  if (action === 'CANCEL' || exception.active === false) return null;
  if (action !== 'SET') {
    throw domainError('exceptionRevision.action is invalid.', 'ATTENDANCE_EXCEPTION_INVALID');
  }
  const type = requiredText(exception.type, 'exceptionRevision.type', 64);
  if (![
    'EXCUSED_ABSENCE',
    'APPROVED_LEAVE',
    'NON_WORKING_DAY',
    'OFFSITE_WORK',
  ].includes(type)) {
    throw domainError('exceptionRevision.type is invalid.', 'ATTENDANCE_EXCEPTION_INVALID');
  }
  return {
    id: requiredText(exception.id, 'exceptionRevision.id', 190),
    type,
    action,
    revision: exception.revision == null
      ? null
      : positiveInteger(exception.revision, 'exceptionRevision.revision'),
  };
}

function addMinutes(value, minutes) {
  return new Date(value.getTime() + (minutes * MINUTE_MS));
}

export function buildAttendanceExpectationRevision({
  expectationId,
  revision,
  workDate,
  schedule: scheduleInput,
  scheduleVersionId: scheduleVersionIdInput = null,
  scheduleDayId: scheduleDayIdInput = null,
  exceptionRevision: exceptionInput = null,
  classifierVersion = ATTENDANCE_CLASSIFIER_VERSION,
} = {}) {
  if (scheduleInput === null || scheduleInput === undefined) return null;
  const schedule = normalizePublishedAttendanceSchedule(scheduleInput);
  const normalizedWorkDate = dateKey(workDate, 'workDate');
  if (normalizedWorkDate < schedule.effectiveFrom) {
    throw domainError(
      'The schedule version is not effective on workDate.',
      'ATTENDANCE_SCHEDULE_NOT_EFFECTIVE',
    );
  }
  const day = schedule.days.find((candidate) => (
    candidate.isoWeekday === isoWeekday(normalizedWorkDate)
  ));
  const exception = normalizedException(exceptionInput);
  const scheduleVersionId = requiredText(
    scheduleVersionIdInput || schedule.id,
    'scheduleVersionId',
    190,
  );
  const scheduleDayId = requiredText(scheduleDayIdInput || day?.id, 'scheduleDayId', 190);
  const normalizedClassifierVersion = requiredText(
    classifierVersion,
    'classifierVersion',
    64,
  );

  let kind = day.isWorkingDay ? WORKING_KIND : NON_WORKING_KIND;
  if (exception && EXCUSED_EXCEPTION_TYPES.has(exception.type)) kind = EXCUSED_KIND;
  else if (exception?.type === 'NON_WORKING_DAY') kind = NON_WORKING_KIND;

  const base = {
    expectationId: requiredText(expectationId, 'expectationId', 190),
    revision: positiveInteger(revision, 'revision'),
    kind,
    scheduleVersionId,
    scheduleDayId,
    exceptionRevisionId: exception?.id || null,
    timezone: schedule.timezone,
    classifierVersion: normalizedClassifierVersion,
  };

  if (kind !== WORKING_KIND) {
    const policyHash = canonicalAttendanceHash({
      classifierVersion: normalizedClassifierVersion,
      workDate: normalizedWorkDate,
      kind,
      scheduleConfigHash: schedule.configHash,
      scheduleDay: day,
      exception,
    }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:expectation`);
    return {
      ...base,
      expectedStartAt: null,
      expectedEndAt: null,
      graceEndsAt: null,
      noShowAt: null,
      pendingCloseAt: null,
      absenceAt: null,
      latePolicy: null,
      expectedBreakMinutes: null,
      policyHash,
    };
  }

  let expectedStartAt;
  let expectedEndAt;
  try {
    expectedStartAt = zonedMinuteToUtc(
      normalizedWorkDate,
      day.startMinute,
      schedule.timezone,
      false,
    );
    expectedEndAt = zonedMinuteToUtc(
      normalizedWorkDate,
      day.endMinute,
      schedule.timezone,
      day.endDayOffset === 1,
    );
  } catch (error) {
    throw domainError(
      'The scheduled civil time cannot be represented in its timezone.',
      'ATTENDANCE_SCHEDULE_CIVIL_TIME_INVALID',
      { cause: error.message, workDate: normalizedWorkDate, isoWeekday: day.isoWeekday },
    );
  }
  if (expectedEndAt <= expectedStartAt) {
    throw domainError(
      'The resolved schedule window must end after it starts.',
      'ATTENDANCE_SCHEDULE_CIVIL_TIME_INVALID',
    );
  }

  const revisionValue = {
    ...base,
    expectedStartAt,
    expectedEndAt,
    graceEndsAt: addMinutes(expectedStartAt, schedule.lateToleranceMinutes),
    noShowAt: addMinutes(expectedStartAt, schedule.noShowAfterMinutes),
    pendingCloseAt: addMinutes(expectedEndAt, schedule.pendingCloseAfterMinutes),
    absenceAt: addMinutes(expectedEndAt, schedule.absenceFinalizeAfterMinutes),
    latePolicy: schedule.latePolicy,
    expectedBreakMinutes: day.expectedBreakMinutes,
  };
  revisionValue.policyHash = canonicalAttendanceHash({
    classifierVersion: normalizedClassifierVersion,
    workDate: normalizedWorkDate,
    kind,
    scheduleConfigHash: schedule.configHash,
    scheduleDay: day,
    exception,
    expectedStartAt,
    expectedEndAt,
    graceEndsAt: revisionValue.graceEndsAt,
    noShowAt: revisionValue.noShowAt,
    pendingCloseAt: revisionValue.pendingCloseAt,
    absenceAt: revisionValue.absenceAt,
  }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:expectation`);
  return revisionValue;
}

function normalizedExpectation(value) {
  if (value === null || value === undefined) return null;
  const input = requiredObject(value, 'expectationRevision');
  if (![WORKING_KIND, NON_WORKING_KIND, EXCUSED_KIND].includes(input.kind)) {
    throw domainError('expectationRevision.kind is invalid.', 'ATTENDANCE_EXPECTATION_INVALID');
  }
  const normalized = {
    kind: input.kind,
    timezone: normalizedTimeZone(input.timezone),
    classifierVersion: requiredText(
      input.classifierVersion || ATTENDANCE_CLASSIFIER_VERSION,
      'expectationRevision.classifierVersion',
      64,
    ),
    policyHash: input.policyHash == null
      ? null
      : requiredText(input.policyHash, 'expectationRevision.policyHash', 64),
    expectedBreakMinutes: input.expectedBreakMinutes == null
      ? null
      : boundedInteger(input.expectedBreakMinutes, 'expectedBreakMinutes', 0, 720),
    latePolicy: input.latePolicy ?? null,
  };
  if (normalized.policyHash && !SHA256_PATTERN.test(normalized.policyHash)) {
    throw domainError('expectationRevision.policyHash is invalid.', 'ATTENDANCE_EXPECTATION_INVALID');
  }
  for (const field of [
    'expectedStartAt',
    'expectedEndAt',
    'graceEndsAt',
    'noShowAt',
    'pendingCloseAt',
    'absenceAt',
  ]) {
    normalized[field] = instant(input[field], `expectationRevision.${field}`, {
      optional: input.kind !== WORKING_KIND,
    });
  }
  if (input.kind === WORKING_KIND) {
    normalized.latePolicy = normalizedLatePolicy(input.latePolicy);
    if (
      normalized.expectedStartAt >= normalized.expectedEndAt
      || normalized.expectedStartAt > normalized.graceEndsAt
      || normalized.graceEndsAt > normalized.noShowAt
      || normalized.expectedEndAt > normalized.pendingCloseAt
      || normalized.pendingCloseAt > normalized.absenceAt
    ) {
      throw domainError(
        'expectationRevision timestamps are inconsistent.',
        'ATTENDANCE_EXPECTATION_INVALID',
      );
    }
  } else if ([
    normalized.expectedStartAt,
    normalized.expectedEndAt,
    normalized.graceEndsAt,
    normalized.noShowAt,
    normalized.pendingCloseAt,
    normalized.absenceAt,
  ].some(Boolean)) {
    throw domainError(
      'A non-working expectation cannot contain schedule timestamps.',
      'ATTENDANCE_EXPECTATION_INVALID',
    );
  }
  return normalized;
}

function normalizedEvent(value, index) {
  const input = requiredObject(value, `events[${index}]`);
  const eventType = requiredText(input.eventType, `events[${index}].eventType`, 32);
  if (!EVENT_TYPES.has(eventType)) {
    throw domainError(`events[${index}].eventType is invalid.`, 'ATTENDANCE_EVENT_INVALID');
  }
  const verificationStatus = input.verificationStatus
    || (input.origin === 'MANUAL_APPROVED' ? 'MANUAL_APPROVED' : null);
  return {
    id: optionalId(input.id, `events[${index}].id`) || `event:${index}`,
    eventType,
    verificationStatus,
    occurredAt: instant(input.occurredAt ?? input.checkedInAt, `events[${index}].occurredAt`),
    sequence: input.sequence == null
      ? null
      : positiveInteger(input.sequence, `events[${index}].sequence`),
    manual: verificationStatus === 'MANUAL_APPROVED' || input.origin === 'MANUAL_APPROVED',
  };
}

function eventOrder(left, right) {
  const timeDifference = left.occurredAt.getTime() - right.occurredAt.getTime();
  if (timeDifference !== 0) return timeDifference;
  const leftSequence = left.sequence ?? Number.MAX_SAFE_INTEGER;
  const rightSequence = right.sequence ?? Number.MAX_SAFE_INTEGER;
  if (leftSequence !== rightSequence) return leftSequence - rightSequence;
  return left.id.localeCompare(right.id);
}

function journeyMetrics(events, asOf, anomalies) {
  const checkIn = events.find((event) => event.eventType === 'CHECK_IN') || null;
  const checkOut = events.findLast((event) => event.eventType === 'CHECK_OUT') || null;
  if (!checkIn) {
    return {
      checkIn: null,
      checkOut: null,
      recordedBreakDurationMs: 0,
      workedDurationMs: 0,
      elapsedDurationMs: 0,
    };
  }
  const end = checkOut?.occurredAt || asOf;
  if (end < checkIn.occurredAt) {
    anomalies.push('CHECK_OUT_BEFORE_CHECK_IN');
    return {
      checkIn,
      checkOut,
      recordedBreakDurationMs: 0,
      workedDurationMs: 0,
      elapsedDurationMs: 0,
    };
  }

  let breakStartedAt = null;
  let recordedBreakDurationMs = 0;
  let checkoutSeen = false;
  for (const event of events) {
    if (event.occurredAt < checkIn.occurredAt) continue;
    if (checkoutSeen) {
      anomalies.push('EVENT_AFTER_CHECK_OUT');
      continue;
    }
    if (event.eventType === 'BREAK_START') {
      if (breakStartedAt) anomalies.push('OVERLAPPING_BREAK_START');
      else breakStartedAt = event.occurredAt;
    } else if (event.eventType === 'BREAK_END') {
      if (!breakStartedAt) anomalies.push('BREAK_END_WITHOUT_START');
      else {
        recordedBreakDurationMs += Math.max(0, event.occurredAt - breakStartedAt);
        breakStartedAt = null;
      }
    } else if (event.eventType === 'CHECK_OUT') {
      checkoutSeen = true;
      if (breakStartedAt) {
        anomalies.push('CHECK_OUT_DURING_BREAK');
        recordedBreakDurationMs += Math.max(0, event.occurredAt - breakStartedAt);
        breakStartedAt = null;
      }
    }
  }
  if (breakStartedAt) {
    recordedBreakDurationMs += Math.max(0, end - breakStartedAt);
  }
  const elapsedDurationMs = Math.max(0, end - checkIn.occurredAt);
  return {
    checkIn,
    checkOut,
    recordedBreakDurationMs: Math.min(recordedBreakDurationMs, elapsedDurationMs),
    workedDurationMs: Math.max(0, elapsedDurationMs - recordedBreakDurationMs),
    elapsedDurationMs,
  };
}

function minuteCount(milliseconds) {
  return Math.floor(Math.max(0, milliseconds) / MINUTE_MS);
}

function lateDelay(expectation, checkIn) {
  if (!expectation || !checkIn || checkIn.occurredAt <= expectation.graceEndsAt) {
    return { delayMs: 0, delayMinutes: 0 };
  }
  const baseline = expectation.latePolicy === 'EXCLUDE_GRACE'
    ? expectation.graceEndsAt
    : expectation.expectedStartAt;
  const delayMs = Math.max(0, checkIn.occurredAt - baseline);
  return { delayMs, delayMinutes: Math.ceil(delayMs / MINUTE_MS) };
}

export function evaluateAttendanceDay({
  expectationRevision: expectationInput = null,
  expectation = null,
  events: eventInputs = [],
  shift = null,
  asOf: asOfInput = new Date(),
  workDate = null,
} = {}) {
  const expected = normalizedExpectation(expectationInput || expectation);
  const asOf = instant(asOfInput, 'asOf');
  if (!Array.isArray(eventInputs)) {
    throw domainError('events must be an array.', 'ATTENDANCE_EVENT_INVALID');
  }
  const allEvents = eventInputs
    .map(normalizedEvent)
    .filter((event) => event.occurredAt <= asOf)
    .sort(eventOrder);
  const pendingGps = allEvents.some((event) => (
    event.eventType === 'CHECK_IN' && event.verificationStatus === 'PENDING'
  ));
  const effectiveEvents = allEvents.filter((event) => (
    FINAL_EVENT_VERIFICATIONS.has(event.verificationStatus)
  ));
  const anomalies = [];
  const journey = journeyMetrics(effectiveEvents, asOf, anomalies);
  const reviewRequired = effectiveEvents.some((event) => (
    event.verificationStatus === 'REVIEW_REQUIRED'
  ));
  const manualCorrection = effectiveEvents.some((event) => event.manual);
  const hasCheckIn = Boolean(journey.checkIn);
  const hasCheckOut = Boolean(journey.checkOut);
  const exceptionConflict = Boolean(
    hasCheckIn && expected && expected.kind !== WORKING_KIND,
  );
  const unscheduledWork = Boolean(hasCheckIn && !expected);
  const missingCheckout = Boolean(hasCheckIn && !hasCheckOut);

  let presence = ATTENDANCE_PRESENCE.EXPECTED;
  let punctuality = ATTENDANCE_PUNCTUALITY.NOT_APPLICABLE;
  let lifecycle = ATTENDANCE_LIFECYCLE.EXPECTED;
  let classification = ATTENDANCE_CLASSIFICATIONS.EXPECTED;

  if (!expected) {
    presence = hasCheckIn ? ATTENDANCE_PRESENCE.PRESENT : ATTENDANCE_PRESENCE.UNSCHEDULED;
    lifecycle = hasCheckIn
      ? (hasCheckOut ? ATTENDANCE_LIFECYCLE.CLOSED : ATTENDANCE_LIFECYCLE.IN_PROGRESS)
      : ATTENDANCE_LIFECYCLE.UNSCHEDULED;
    classification = reviewRequired
      ? ATTENDANCE_CLASSIFICATIONS.REVIEW_REQUIRED
      : ATTENDANCE_CLASSIFICATIONS.UNSCHEDULED;
  } else if (expected.kind !== WORKING_KIND && !hasCheckIn) {
    if (pendingGps) {
      presence = ATTENDANCE_PRESENCE.EXPECTED;
      punctuality = ATTENDANCE_PUNCTUALITY.PENDING;
      lifecycle = ATTENDANCE_LIFECYCLE.PENDING_GPS;
      classification = ATTENDANCE_CLASSIFICATIONS.PENDING_GPS;
    } else if (expected.kind === EXCUSED_KIND) {
      presence = ATTENDANCE_PRESENCE.EXCUSED;
      lifecycle = ATTENDANCE_LIFECYCLE.EXCUSED;
      classification = ATTENDANCE_CLASSIFICATIONS.EXCUSED;
    } else {
      presence = ATTENDANCE_PRESENCE.UNSCHEDULED;
      lifecycle = ATTENDANCE_LIFECYCLE.UNSCHEDULED;
      classification = ATTENDANCE_CLASSIFICATIONS.UNSCHEDULED;
    }
  } else if (!hasCheckIn) {
    punctuality = pendingGps
      ? ATTENDANCE_PUNCTUALITY.PENDING
      : ATTENDANCE_PUNCTUALITY.NOT_APPLICABLE;
    if (pendingGps) {
      lifecycle = ATTENDANCE_LIFECYCLE.PENDING_GPS;
      classification = ATTENDANCE_CLASSIFICATIONS.PENDING_GPS;
    } else if (asOf < expected.expectedStartAt) {
      lifecycle = ATTENDANCE_LIFECYCLE.UPCOMING;
    } else if (asOf >= expected.absenceAt) {
      presence = ATTENDANCE_PRESENCE.ABSENT;
      lifecycle = ATTENDANCE_LIFECYCLE.ABSENT;
      classification = ATTENDANCE_CLASSIFICATIONS.ABSENT;
    } else if (asOf >= expected.noShowAt) {
      lifecycle = ATTENDANCE_LIFECYCLE.NO_SHOW;
      classification = ATTENDANCE_CLASSIFICATIONS.NO_SHOW;
    }
  } else {
    const isLate = expected?.kind === WORKING_KIND
      && journey.checkIn.occurredAt > expected.graceEndsAt;
    presence = reviewRequired
      ? ATTENDANCE_PRESENCE.REVIEW_REQUIRED
      : ATTENDANCE_PRESENCE.PRESENT;
    punctuality = expected?.kind === WORKING_KIND
      ? (isLate ? ATTENDANCE_PUNCTUALITY.LATE : ATTENDANCE_PUNCTUALITY.ON_TIME)
      : ATTENDANCE_PUNCTUALITY.NOT_APPLICABLE;
    if (hasCheckOut) lifecycle = ATTENDANCE_LIFECYCLE.CLOSED;
    else if (
      shift?.status === 'PENDING_CLOSE'
      || (expected?.kind === WORKING_KIND && asOf >= expected.pendingCloseAt)
    ) lifecycle = ATTENDANCE_LIFECYCLE.PENDING_CLOSE;
    else lifecycle = ATTENDANCE_LIFECYCLE.IN_PROGRESS;

    if (reviewRequired) classification = ATTENDANCE_CLASSIFICATIONS.REVIEW_REQUIRED;
    else if (lifecycle === ATTENDANCE_LIFECYCLE.PENDING_CLOSE) {
      classification = ATTENDANCE_CLASSIFICATIONS.PENDING_CLOSE;
    } else if (isLate) classification = ATTENDANCE_CLASSIFICATIONS.LATE;
    else classification = expected ? ATTENDANCE_CLASSIFICATIONS.PRESENT : ATTENDANCE_CLASSIFICATIONS.UNSCHEDULED;
  }

  if (shift?.status === 'CLOSED' && !hasCheckOut) {
    anomalies.push('SHIFT_CLOSED_WITHOUT_CHECK_OUT');
  }
  const delay = expected?.kind === WORKING_KIND
    ? lateDelay(expected, journey.checkIn)
    : { delayMs: 0, delayMinutes: 0 };
  const scheduledDurationMs = expected?.kind === WORKING_KIND
    ? Math.max(0, expected.expectedEndAt - expected.expectedStartAt)
    : 0;

  return {
    classification,
    presence,
    punctuality,
    lifecycle,
    workDate: workDate == null ? null : dateKey(workDate, 'workDate'),
    timezone: expected?.timezone || null,
    expectedStartAt: expected?.expectedStartAt || null,
    expectedEndAt: expected?.expectedEndAt || null,
    graceEndsAt: expected?.graceEndsAt || null,
    noShowAt: expected?.noShowAt || null,
    pendingCloseAt: expected?.pendingCloseAt || null,
    absenceAt: expected?.absenceAt || null,
    actualCheckInAt: journey.checkIn?.occurredAt || null,
    actualCheckOutAt: journey.checkOut?.occurredAt || null,
    scheduledDurationMs,
    elapsedDurationMs: journey.elapsedDurationMs,
    recordedBreakDurationMs: journey.recordedBreakDurationMs,
    workedDurationMs: journey.workedDurationMs,
    scheduledDurationMinutes: minuteCount(scheduledDurationMs),
    elapsedDurationMinutes: minuteCount(journey.elapsedDurationMs),
    recordedBreakMinutes: minuteCount(journey.recordedBreakDurationMs),
    workedDurationMinutes: minuteCount(journey.workedDurationMs),
    ...delay,
    pendingGps,
    reviewRequired,
    manualCorrection,
    exceptionConflict,
    unscheduledWork,
    missingCheckout,
    expectedBreakMinutes: expected?.expectedBreakMinutes ?? null,
    classifierVersion: expected?.classifierVersion || ATTENDANCE_CLASSIFIER_VERSION,
    policyHash: expected?.policyHash || null,
    anomalies: [...new Set(anomalies)],
  };
}

function isoOrNull(value) {
  return value instanceof Date ? value.toISOString() : null;
}

export function serializeAttendanceEvaluation(value) {
  const evaluation = requiredObject(value, 'evaluation');
  return {
    classification: evaluation.classification,
    presence: evaluation.presence,
    punctuality: evaluation.punctuality,
    lifecycle: evaluation.lifecycle,
    workDate: evaluation.workDate || null,
    timezone: evaluation.timezone || null,
    expectedStartAt: isoOrNull(evaluation.expectedStartAt),
    expectedEndAt: isoOrNull(evaluation.expectedEndAt),
    actualCheckInAt: isoOrNull(evaluation.actualCheckInAt),
    actualCheckOutAt: isoOrNull(evaluation.actualCheckOutAt),
    delayMinutes: Number(evaluation.delayMinutes) || 0,
    scheduledDurationMinutes: Number(evaluation.scheduledDurationMinutes) || 0,
    workedDurationMinutes: Number(evaluation.workedDurationMinutes) || 0,
    recordedBreakMinutes: Number(evaluation.recordedBreakMinutes) || 0,
    pendingGps: Boolean(evaluation.pendingGps),
    reviewRequired: Boolean(evaluation.reviewRequired),
    manualCorrection: Boolean(evaluation.manualCorrection),
    exceptionConflict: Boolean(evaluation.exceptionConflict),
    unscheduledWork: Boolean(evaluation.unscheduledWork),
    missingCheckout: Boolean(evaluation.missingCheckout),
    classifierVersion: evaluation.classifierVersion || ATTENDANCE_CLASSIFIER_VERSION,
    anomalies: Array.isArray(evaluation.anomalies) ? [...evaluation.anomalies] : [],
  };
}
