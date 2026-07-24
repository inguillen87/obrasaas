import { hashEffectiveAttendanceEvents } from './attendance-corrections.js';
import { evaluateAttendanceDay } from './attendance-schedules.js';

const REPORTABLE_VERIFICATION_STATUSES = new Set([
  'VERIFIED',
  'REVIEW_REQUIRED',
  'NOT_REQUIRED',
  'MANUAL_APPROVED',
]);

const EVENT_TYPES = new Set([
  'CHECK_IN',
  'BREAK_START',
  'BREAK_END',
  'CHECK_OUT',
]);

const LEGACY_EXCEPTION_STATUS = /ausente\s+justificad|licencia\s+informada|registro\s+operativo\s+restringido/i;

function safeDate(value) {
  const parsed = value instanceof Date ? new Date(value) : new Date(value || Number.NaN);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function text(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizedIdentity(value) {
  return text(value)
    .normalize('NFKC')
    .toLocaleLowerCase('es-AR')
    .replace(/\s+/g, ' ');
}

function eventTime(event) {
  return safeDate(event?.occurredAt)?.getTime() ?? 0;
}

function eventOrder(left, right) {
  const timeDifference = eventTime(left) - eventTime(right);
  if (timeDifference !== 0) return timeDifference;
  const leftSequence = Number.isSafeInteger(left?.sequence) ? left.sequence : Number.MAX_SAFE_INTEGER;
  const rightSequence = Number.isSafeInteger(right?.sequence) ? right.sequence : Number.MAX_SAFE_INTEGER;
  if (leftSequence !== rightSequence) return leftSequence - rightSequence;
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function eventLabel(value, timeZone) {
  const date = safeDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat('es-AR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function supportedTimeZone(value, fallback) {
  const candidate = text(value, fallback);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return fallback;
  }
}

function workDateLabel(value) {
  const date = safeDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  }).formatToParts(date);
  const day = parts.find((part) => part.type === 'day')?.value;
  const month = parts.find((part) => part.type === 'month')?.value.replace('.', '');
  return day && month ? `${day} ${month}` : null;
}

function latestEvent(events, eventType) {
  return events.findLast((event) => event.eventType === eventType) || null;
}

function firstEvent(events, eventType) {
  return events.find((event) => event.eventType === eventType) || null;
}

function shiftStatus(events, reviewRequired, verifiedCheckIn) {
  const lastEvent = events.at(-1);
  const suffix = reviewRequired ? ' · revisar ubicación' : '';
  if (!lastEvent) return `Jornada sin eventos${suffix}`;
  if (lastEvent.eventType === 'CHECK_OUT') return `Jornada cerrada${suffix}`;
  if (lastEvent.eventType === 'BREAK_START') {
    return verifiedCheckIn ? `Presente · en pausa${suffix}` : 'En pausa · ingreso pendiente de revisión';
  }
  if (lastEvent.eventType === 'BREAK_END') {
    return verifiedCheckIn ? `Presente · actividad retomada${suffix}` : 'Actividad retomada · ingreso pendiente de revisión';
  }
  return reviewRequired ? 'Ingreso pendiente de revisión' : 'Presente';
}

function summarizeShift(events, timeZone) {
  const ordered = [...events].sort(eventOrder);
  const checkIn = firstEvent(ordered, 'CHECK_IN');
  const breakStart = latestEvent(ordered, 'BREAK_START');
  const latestBreakEnd = latestEvent(ordered, 'BREAK_END');
  const breakEnd = breakStart && latestBreakEnd && eventOrder(latestBreakEnd, breakStart) > 0
    ? latestBreakEnd
    : null;
  const checkOut = latestEvent(ordered, 'CHECK_OUT');
  const representative = ordered.at(-1);
  const shift = representative?.shift || {};
  const shiftTimeZone = supportedTimeZone(shift.timezone, timeZone);
  const reviewRequired = ordered.some((event) => (
    event.verificationStatus === 'REVIEW_REQUIRED'
  ));
  const verifiedCheckIn = checkIn?.verificationStatus === 'VERIFIED'
    || checkIn?.verificationStatus === 'MANUAL_APPROVED';

  return {
    shiftId: representative.shiftId,
    workerId: representative.workerId,
    name: text(representative.worker?.name, 'Persona sin nombre'),
    role: text(representative.worker?.role, 'Sin función'),
    workDate: safeDate(shift.workDate)?.toISOString().slice(0, 10) || null,
    workDateLabel: workDateLabel(shift.workDate),
    checkin: eventLabel(checkIn?.occurredAt, shiftTimeZone),
    breakStartedAt: eventLabel(breakStart?.occurredAt, shiftTimeZone),
    breakEndedAt: eventLabel(breakEnd?.occurredAt, shiftTimeZone),
    checkout: eventLabel(checkOut?.occurredAt, shiftTimeZone),
    status: shiftStatus(ordered, reviewRequired, verifiedCheckIn),
    reviewRequired,
    verifiedCheckIn,
    lastOccurredAt: safeDate(representative.occurredAt)?.toISOString() || null,
  };
}

function latestShiftOrder(left, right) {
  const leftTime = safeDate(left.lastOccurredAt)?.getTime() ?? 0;
  const rightTime = safeDate(right.lastOccurredAt)?.getTime() ?? 0;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return String(right.shiftId).localeCompare(String(left.shiftId));
}

/**
 * Builds a data-minimal weekly projection from canonical attendance events.
 * Exact coordinates, evidence and request metadata are intentionally omitted.
 */
export function buildAttendancePeriodProjection(rows, {
  timeZone = 'America/Argentina/Buenos_Aires',
} = {}) {
  const fallbackTimeZone = supportedTimeZone(
    timeZone,
    'America/Argentina/Buenos_Aires',
  );
  const byShift = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.shiftId || !row?.workerId) continue;
    if (!EVENT_TYPES.has(row.eventType)) continue;
    if (!REPORTABLE_VERIFICATION_STATUSES.has(row.verificationStatus)) continue;
    if (!safeDate(row.occurredAt)) continue;
    const events = byShift.get(row.shiftId) || [];
    events.push(row);
    byShift.set(row.shiftId, events);
  }

  const byWorker = new Map();
  for (const events of byShift.values()) {
    const summary = summarizeShift(events, fallbackTimeZone);
    const shifts = byWorker.get(summary.workerId) || [];
    shifts.push(summary);
    byWorker.set(summary.workerId, shifts);
  }

  return [...byWorker.values()]
    .map((shifts) => {
      const ordered = [...shifts].sort(latestShiftOrder);
      const latest = ordered[0];
      const daysPresent = new Set(
        ordered
          .filter((shift) => shift.verifiedCheckIn)
          .map((shift) => shift.workDate || shift.shiftId),
      ).size;
      const daysRegistered = new Set(
        ordered.map((shift) => shift.workDate || shift.shiftId),
      ).size;
      return {
        workerId: latest.workerId,
        name: latest.name,
        role: latest.role,
        status: latest.status,
        present: daysPresent > 0,
        daysPresent,
        daysRegistered,
        workDate: latest.workDate,
        workDateLabel: latest.workDateLabel,
        checkin: latest.checkin,
        breakStartedAt: latest.breakStartedAt,
        breakEndedAt: latest.breakEndedAt,
        checkout: latest.checkout,
        reviewRequired: ordered.some((shift) => shift.reviewRequired),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

/**
 * Temporary bridge until S2 stores leave/absence exceptions in a dated ledger.
 * It preserves a visible exception without claiming that it occurred in this
 * report period or exposing protected medical detail.
 */
export function buildLegacyAttendanceExceptionProjection(collection) {
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) return [];
  return Object.entries(collection)
    .filter(([, value]) => (
      value && typeof value === 'object' && !Array.isArray(value)
      && LEGACY_EXCEPTION_STATUS.test(String(value.status || ''))
    ))
    .map(([recordKey, value]) => {
      const restricted = /registro\s+operativo\s+restringido|licencia\s+informada/i
        .test(String(value.status || ''));
      return {
        workerId: text(value.workerId, recordKey),
        name: text(value.name, recordKey),
        role: text(value.role, 'Sin función'),
        status: restricted
          ? 'Ausencia o licencia informada · detalle restringido'
          : 'Ausente justificado',
        present: false,
        daysPresent: 0,
        daysRegistered: 0,
        workDate: null,
        workDateLabel: 'Sin fecha canónica',
        checkin: null,
        breakStartedAt: null,
        breakEndedAt: null,
        checkout: null,
        reviewRequired: false,
        legacyException: true,
      };
    });
}

export function attendanceEventsFromShifts(shifts) {
  return (Array.isArray(shifts) ? shifts : []).flatMap((shift) => (
    effectiveReportEvents(shift).map((event) => ({
      ...event,
      worker: shift.worker,
      shift: {
        workDate: shift.workDate,
        timezone: shift.timezone,
      },
    }))
  ));
}

function latestApprovedAdjustment(shift) {
  const request = [...(shift?.correctionRequests || [])]
    .filter((candidate) => (
      candidate.decision?.decision === 'APPROVED'
      && Array.isArray(candidate.adjustment?.effectiveEvents)
    ))
    .sort((left, right) => (
      Number(right.adjustment.appliedShiftRevision)
      - Number(left.adjustment.appliedShiftRevision)
      || new Date(right.adjustment.createdAt) - new Date(left.adjustment.createdAt)
      || String(right.adjustment.id).localeCompare(String(left.adjustment.id))
    ))[0];
  if (!request) return null;
  if (
    hashEffectiveAttendanceEvents(request.adjustment.effectiveEvents)
    !== request.adjustment.effectiveHash
  ) {
    throw new Error('An approved attendance adjustment failed its integrity check.');
  }
  return request.adjustment;
}

function effectiveReportEvents(shift) {
  const adjustment = latestApprovedAdjustment(shift);
  if (!adjustment) return Array.isArray(shift?.events) ? shift.events : [];
  const manual = adjustment.effectiveEvents.map((event, index) => ({
    id: event.logicalId,
    workerId: shift.workerId,
    shiftId: shift.id,
    eventType: event.eventType,
    verificationStatus: 'MANUAL_APPROVED',
    occurredAt: new Date(event.occurredAt),
    sequence: index + 1,
  }));
  const baseLedgerSequence = Number(adjustment.baseLedgerSequence) || 0;
  const laterLedger = (shift.events || []).filter((event) => (
    Number(event.sequence) > baseLedgerSequence
  ));
  return [...manual, ...laterLedger];
}

function expectationStatus(evaluation) {
  if (evaluation.classification === 'ABSENT') return 'Ausente';
  if (evaluation.classification === 'NO_SHOW') return 'Sin ingreso registrado';
  if (evaluation.classification === 'EXCUSED') return 'Ausencia justificada';
  if (evaluation.classification === 'LATE') return `Presente · ${evaluation.delayMinutes} min tarde`;
  if (evaluation.classification === 'PENDING_CLOSE') return 'Presente · salida pendiente';
  if (evaluation.classification === 'REVIEW_REQUIRED') return 'Presente · revisar ubicación';
  if (evaluation.classification === 'PRESENT') return 'Presente';
  if (evaluation.classification === 'EXPECTED') return 'Jornada esperada';
  return 'Sin jornada programada';
}

function reportEventLabel(value, timeZone) {
  return eventLabel(value, supportedTimeZone(timeZone, 'America/Argentina/Buenos_Aires'));
}

/**
 * Produces weekly attendance from versioned expectations, so workers without
 * a physical shift remain visible as absent/excused instead of disappearing.
 */
export function buildAttendanceExpectationPeriodProjection(expectations, {
  generatedAt = new Date(),
  timeZone = 'America/Argentina/Buenos_Aires',
} = {}) {
  const cutoff = safeDate(generatedAt) || new Date();
  const byWorker = new Map();
  for (const expectation of Array.isArray(expectations) ? expectations : []) {
    const revision = expectation?.revisions?.[0];
    if (!revision) continue;
    const shift = expectation.shift || null;
    const evaluation = evaluateAttendanceDay({
      expectationRevision: revision,
      events: shift ? effectiveReportEvents(shift) : [],
      shift,
      asOf: cutoff,
      workDate: safeDate(expectation.workDate)?.toISOString().slice(0, 10),
    });
    const rows = byWorker.get(expectation.workerId) || [];
    rows.push({ expectation, evaluation });
    byWorker.set(expectation.workerId, rows);
  }

  return [...byWorker.entries()].map(([workerId, rows]) => {
    const ordered = [...rows].sort((left, right) => (
      safeDate(right.expectation.workDate) - safeDate(left.expectation.workDate)
    ));
    const latest = ordered[0];
    const worker = latest.expectation.worker || {};
    const daysPresent = ordered.filter(({ evaluation }) => (
      ['PRESENT', 'REVIEW_REQUIRED'].includes(evaluation.presence)
    )).length;
    const daysAbsent = ordered.filter(({ evaluation }) => evaluation.presence === 'ABSENT').length;
    const daysExcused = ordered.filter(({ evaluation }) => evaluation.presence === 'EXCUSED').length;
    const lateDays = ordered.filter(({ evaluation }) => evaluation.punctuality === 'LATE').length;
    const statusParts = [];
    if (daysAbsent > 0) statusParts.push(`${daysAbsent} ausente${daysAbsent === 1 ? '' : 's'}`);
    if (lateDays > 0) statusParts.push(`${lateDays} tardanza${lateDays === 1 ? '' : 's'}`);
    if (daysExcused > 0) statusParts.push(`${daysExcused} justificad${daysExcused === 1 ? 'a' : 'as'}`);
    const latestEvaluation = latest.evaluation;
    const rowTimeZone = latestEvaluation.timezone || timeZone;
    return {
      workerId,
      name: text(worker.name, 'Persona sin nombre'),
      role: text(worker.role, 'Sin función'),
      status: statusParts.length > 0 ? statusParts.join(' · ') : expectationStatus(latestEvaluation),
      present: daysPresent > 0,
      daysPresent,
      daysRegistered: ordered.length,
      daysAbsent,
      daysExcused,
      lateDays,
      workDate: latestEvaluation.workDate,
      workDateLabel: workDateLabel(latest.expectation.workDate),
      checkin: reportEventLabel(latestEvaluation.actualCheckInAt, rowTimeZone),
      breakStartedAt: null,
      breakEndedAt: null,
      checkout: reportEventLabel(latestEvaluation.actualCheckOutAt, rowTimeZone),
      reviewRequired: ordered.some(({ evaluation }) => evaluation.reviewRequired),
      scheduled: true,
    };
  }).sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

export function mergeAttendanceExpectationProjection(canonical, expected) {
  const byWorker = new Map(
    (Array.isArray(canonical) ? canonical : [])
      .filter((entry) => entry?.workerId)
      .map((entry) => [entry.workerId, entry]),
  );
  for (const entry of Array.isArray(expected) ? expected : []) {
    const unscheduled = byWorker.get(entry.workerId);
    byWorker.set(entry.workerId, unscheduled
      ? {
          ...entry,
          reviewRequired: entry.reviewRequired || unscheduled.reviewRequired,
        }
      : entry);
  }
  return [...byWorker.values()].sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

export function mergeAttendanceReportProjection({
  canonical = [],
  attendance = null,
  hrAttendance = null,
} = {}) {
  const canonicalEntries = (Array.isArray(canonical) ? canonical : [])
    .filter((entry) => entry?.workerId);
  const canonicalById = new Map(
    canonicalEntries.map((entry) => [entry.workerId, entry]),
  );
  const canonicalIdsByName = new Map();
  for (const entry of canonicalEntries) {
    const name = normalizedIdentity(entry.name);
    if (!name) continue;
    const ids = canonicalIdsByName.get(name) || new Set();
    ids.add(entry.workerId);
    canonicalIdsByName.set(name, ids);
  }

  const byWorker = new Map();
  for (const collection of [attendance, hrAttendance]) {
    for (const entry of buildLegacyAttendanceExceptionProjection(collection)) {
      let workerId = entry.workerId;
      if (!canonicalById.has(workerId)) {
        const candidates = new Set();
        for (const identity of [entry.name, entry.workerId]) {
          const matches = canonicalIdsByName.get(normalizedIdentity(identity));
          for (const candidate of matches || []) candidates.add(candidate);
        }
        if (candidates.size === 1) [workerId] = candidates;
      }
      if (!byWorker.has(workerId)) {
        byWorker.set(workerId, { ...entry, workerId });
      }
    }
  }
  for (const entry of canonicalEntries) {
    byWorker.set(entry.workerId, entry);
  }
  return Object.fromEntries(byWorker);
}
