import { createHash } from 'node:crypto';

import { validateReportedLocation } from './geo.js';

export const ATTENDANCE_GEO_WINDOW_MS = 2 * 60 * 60 * 1_000;

const DEFAULT_ATTENDANCE_TIMEZONE = 'America/Argentina/Buenos_Aires';
const ATTENDANCE_ACTIONS = new Set([
  'CHECK_IN',
  'BREAK_START',
  'BREAK_END',
  'CHECK_OUT',
]);
const FINAL_GPS_ACTIONS = new Set(['CHECK_IN', 'CHECK_OUT']);

export class AttendanceDomainError extends Error {
  constructor(message, code, status = 409, details = null) {
    super(message);
    this.name = 'AttendanceDomainError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function domainError(message, code, status = 400, details = null) {
  return new AttendanceDomainError(message, code, status, details);
}

function trustedDate(value, field, { optional = false } = {}) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw domainError(`${field} must be a valid timestamp.`, 'ATTENDANCE_TIME_INVALID');
  }
  return date;
}

function trustedNow(value) {
  return trustedDate(value ?? new Date(), 'now');
}

function requiredText(value, field, max = 190) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw domainError(`${field} is required and must be at most ${max} characters.`, 'ATTENDANCE_INPUT_INVALID');
  }
  return text;
}

function attendanceScope({ projectId, workerId }) {
  return {
    projectId: requiredText(projectId, 'projectId', 180),
    workerId: requiredText(workerId, 'workerId', 180),
  };
}

function normalizedSource(value, fallback = null) {
  const source = value == null || value === '' ? fallback : value;
  return requiredText(source, 'source', 64).toLowerCase();
}

function validTimezone(value, fallback = DEFAULT_ATTENDANCE_TIMEZONE) {
  const timezone = requiredText(value || fallback, 'timezone', 64);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0));
  } catch {
    throw domainError('timezone is not a supported IANA timezone.', 'ATTENDANCE_TIMEZONE_INVALID');
  }
  return timezone;
}

function localWorkDate(now, timezone) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00.000Z`);
}

function plainJson(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') {
    throw domainError(`${field} must be a JSON object or array.`, 'ATTENDANCE_INPUT_INVALID');
  }
  try {
    return structuredClone(value);
  } catch {
    throw domainError(`${field} must be serializable JSON.`, 'ATTENDANCE_INPUT_INVALID');
  }
}

function canonicalValue(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalValue);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function requestFingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex');
}

function scopedIdempotencyKey(scope, source, eventType, idempotencyKey) {
  const rawKey = requiredText(idempotencyKey, 'idempotencyKey', 512);
  const digest = createHash('sha256')
    .update(`attendance-v1\0${scope.projectId}\0${scope.workerId}\0${source}\0${eventType}\0${rawKey}`)
    .digest('hex');
  return `attendance:v1:${digest}`;
}

function normalizedAction(value) {
  const action = String(value || '').trim().toUpperCase();
  if (!ATTENDANCE_ACTIONS.has(action)) {
    throw domainError('eventType is not a supported attendance action.', 'ATTENDANCE_ACTION_INVALID');
  }
  return action;
}

function normalizedPrivacyNoticeVersion(value) {
  try {
    return requiredText(value, 'privacyNoticeVersion', 64);
  } catch {
    throw domainError(
      'A privacy notice version is required for point-location attendance evidence.',
      'ATTENDANCE_PRIVACY_NOTICE_REQUIRED',
      422,
    );
  }
}

function normalizedGps(input, eventType) {
  if (!FINAL_GPS_ACTIONS.has(eventType)) return null;
  const location = validateReportedLocation({
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracyMeters ?? input.accuracy,
  });
  if (!location.valid) {
    throw domainError(
      location.reason === 'INVALID_COORDINATES'
        ? 'A valid point location is required for this attendance action.'
        : 'A sufficiently accurate point location is required for this attendance action.',
      location.reason === 'INVALID_COORDINATES'
        ? 'ATTENDANCE_LOCATION_INVALID'
        : 'ATTENDANCE_LOCATION_ACCURACY_INVALID',
      422,
    );
  }

  const distance = Number(input.distanceMeters);
  const radius = Number(input.geofenceRadiusMeters);
  if (!Number.isFinite(distance) || distance < 0 || !Number.isSafeInteger(Math.round(distance))) {
    throw domainError('distanceMeters must be a non-negative finite value.', 'ATTENDANCE_GEOFENCE_INVALID', 422);
  }
  if (!Number.isFinite(radius) || radius <= 0 || !Number.isSafeInteger(Math.round(radius))) {
    throw domainError('geofenceRadiusMeters must be a positive finite value.', 'ATTENDANCE_GEOFENCE_INVALID', 422);
  }

  const roundedDistance = Math.round(distance);
  const roundedRadius = Math.round(radius);
  const conservativeDistance = distance + location.accuracy;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracyMeters: location.accuracy,
    distanceMeters: roundedDistance,
    geofenceRadiusMeters: roundedRadius,
    privacyNoticeVersion: normalizedPrivacyNoticeVersion(input.privacyNoticeVersion),
    verificationStatus: conservativeDistance <= radius
      ? 'VERIFIED'
      : 'REVIEW_REQUIRED',
  };
}

function dateIso(value) {
  if (value === null || value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function decimalNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function publicShift(shift) {
  if (!shift) return null;
  return {
    id: shift.id,
    projectId: shift.projectId,
    workerId: shift.workerId,
    workDate: dateIso(shift.workDate)?.slice(0, 10) || null,
    timezone: shift.timezone,
    status: shift.status,
    phase: shift.phase,
    openedAt: dateIso(shift.openedAt),
    closedAt: dateIso(shift.closedAt),
    revision: Number(shift.revision) || 0,
  };
}

function publicEvent(entry, shiftOverride = null) {
  if (!entry) return null;
  const shift = entry.shift || shiftOverride || null;
  return {
    id: entry.id,
    projectId: entry.projectId,
    workerId: entry.workerId,
    shiftId: entry.shiftId || null,
    eventType: entry.eventType,
    verificationStatus: entry.verificationStatus,
    status: entry.status,
    occurredAt: dateIso(entry.occurredAt || entry.checkedInAt),
    sourceOccurredAt: dateIso(entry.sourceOccurredAt),
    sequence: entry.sequence == null ? null : Number(entry.sequence),
    source: entry.source,
    latitude: decimalNumber(entry.latitude),
    longitude: decimalNumber(entry.longitude),
    accuracyMeters: decimalNumber(entry.accuracyMeters),
    distanceMeters: entry.distanceMeters == null ? null : Number(entry.distanceMeters),
    geofenceRadiusMeters: entry.geofenceRadiusMeters == null
      ? null
      : Number(entry.geofenceRadiusMeters),
    privacyNoticeVersion: entry.privacyNoticeVersion || null,
    evidence: entry.evidence ?? null,
    shift: publicShift(shift),
  };
}

async function findEntryByIdempotency(prisma, idempotencyKey) {
  if (typeof prisma.attendanceEntry.findUnique === 'function') {
    return prisma.attendanceEntry.findUnique({
      where: { idempotencyKey },
      include: { shift: true },
    });
  }
  return prisma.attendanceEntry.findFirst({
    where: { idempotencyKey },
    include: { shift: true },
  });
}

async function findEntryById(prisma, id) {
  if (typeof prisma.attendanceEntry.findUnique === 'function') {
    return prisma.attendanceEntry.findUnique({ where: { id }, include: { shift: true } });
  }
  return prisma.attendanceEntry.findFirst({ where: { id }, include: { shift: true } });
}

function replayResult(entry, { scope, source, eventType, fingerprint }) {
  if (!entry) return null;
  if (
    entry.projectId !== scope.projectId
    || entry.workerId !== scope.workerId
    || entry.source !== source
    || entry.eventType !== eventType
    || entry.requestFingerprint !== fingerprint
  ) {
    throw domainError(
      'The idempotency key was already used with a different attendance request.',
      'ATTENDANCE_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
  return publicEvent(entry);
}

async function replayFor(prisma, identity) {
  const entry = await findEntryByIdempotency(prisma, identity.idempotencyKey);
  return replayResult(entry, identity);
}

async function runAtomically(prisma, callback) {
  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(callback, { maxWait: 5_000, timeout: 15_000 });
  }
  return callback(prisma);
}

async function expirePendingEntries(prisma, scope, expiresBefore) {
  return prisma.attendanceEntry.updateMany({
    where: {
      ...scope,
      shiftId: null,
      eventType: 'CHECK_IN',
      verificationStatus: 'PENDING',
      occurredAt: { lt: expiresBefore },
    },
    data: { verificationStatus: 'EXPIRED', status: 'EXPIRED' },
  });
}

async function findOpenShift(prisma, scope) {
  if (!prisma.attendanceShift || typeof prisma.attendanceShift.findFirst !== 'function') return null;
  return prisma.attendanceShift.findFirst({
    where: { ...scope, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

function normalizedShiftBinding(shiftIdInput, expectedRevisionInput) {
  const hasShiftId = shiftIdInput !== null && shiftIdInput !== undefined && shiftIdInput !== '';
  const hasRevision = expectedRevisionInput !== null && expectedRevisionInput !== undefined;
  if (!hasShiftId && !hasRevision) return null;
  if (!hasShiftId || !hasRevision) {
    throw domainError(
      'shiftId and expectedRevision must be supplied together.',
      'ATTENDANCE_INPUT_INVALID',
    );
  }
  const expectedRevision = Number(expectedRevisionInput);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw domainError(
      'expectedRevision must be a non-negative safe integer.',
      'ATTENDANCE_INPUT_INVALID',
    );
  }
  return {
    shiftId: requiredText(shiftIdInput, 'shiftId', 190),
    expectedRevision,
  };
}

async function findBoundOpenShift(prisma, scope, binding) {
  if (!binding) return findOpenShift(prisma, scope);
  const shift = await prisma.attendanceShift.findFirst({
    where: { id: binding.shiftId, ...scope },
  });
  if (
    !shift
    || shift.status !== 'OPEN'
    || Number(shift.revision) !== binding.expectedRevision
  ) {
    throw domainError(
      'The attendance link no longer targets the current shift revision.',
      'ATTENDANCE_LINK_STALE',
      409,
    );
  }
  return shift;
}

function uniqueConstraint(error) {
  return error?.code === 'P2002';
}

export async function ensurePendingGeoAttendance(prisma, {
  projectId,
  workerId,
  now: nowInput,
  source: sourceInput = null,
  idempotencyKey: rawIdempotencyKey = null,
  sourceOccurredAt: sourceOccurredAtInput = null,
  timezone: timezoneInput = null,
  metadata = {},
}) {
  const scope = attendanceScope({ projectId, workerId });
  const now = trustedNow(nowInput);
  const sourceOccurredAt = trustedDate(sourceOccurredAtInput, 'sourceOccurredAt', { optional: true });
  const safeMetadata = plainJson(metadata, 'metadata') || {};
  const source = normalizedSource(sourceInput, safeMetadata.source || 'whatsapp');
  const timezone = timezoneInput ? validTimezone(timezoneInput) : null;
  const pendingMetadata = timezone
    ? { ...safeMetadata, attendanceTimezone: timezone }
    : safeMetadata;
  const rawKey = rawIdempotencyKey
    || safeMetadata.externalId
    || `pending:${now.toISOString()}`;
  const idempotencyKey = scopedIdempotencyKey(scope, source, 'CHECK_IN_PENDING', rawKey);
  const fingerprint = requestFingerprint({
    scope,
    source,
    eventType: 'CHECK_IN',
    sourceOccurredAt,
    timezone,
    metadata: pendingMetadata,
  });
  const expiresBefore = new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS);

  await expirePendingEntries(prisma, scope, expiresBefore);
  const replay = await replayFor(prisma, {
    scope,
    source,
    eventType: 'CHECK_IN',
    fingerprint,
    idempotencyKey,
  });
  if (replay) return replay;

  const openShift = await findOpenShift(prisma, scope);
  if (openShift) {
    throw domainError(
      'The worker already has an open attendance shift in this project.',
      'ATTENDANCE_SHIFT_ALREADY_OPEN',
      409,
      { shiftId: openShift.id },
    );
  }

  const current = await prisma.attendanceEntry.findFirst({
    where: {
      ...scope,
      shiftId: null,
      eventType: 'CHECK_IN',
      verificationStatus: 'PENDING',
      occurredAt: { gte: expiresBefore },
    },
    orderBy: { occurredAt: 'desc' },
  });
  if (current) return publicEvent(current);

  try {
    const created = await prisma.attendanceEntry.create({
      data: {
        ...scope,
        shiftId: null,
        eventType: 'CHECK_IN',
        verificationStatus: 'PENDING',
        occurredAt: now,
        ...(sourceOccurredAt ? { sourceOccurredAt } : {}),
        sequence: null,
        idempotencyKey,
        requestFingerprint: fingerprint,
        status: 'PENDING_GEO',
        source,
        checkedInAt: now,
        metadata: pendingMetadata,
      },
    });
    return publicEvent(created);
  } catch (error) {
    if (!uniqueConstraint(error)) throw error;
    const winnerReplay = await replayFor(prisma, {
      scope,
      source,
      eventType: 'CHECK_IN',
      fingerprint,
      idempotencyKey,
    });
    if (winnerReplay) return winnerReplay;
    const winner = await prisma.attendanceEntry.findFirst({
      where: {
        ...scope,
        shiftId: null,
        eventType: 'CHECK_IN',
        verificationStatus: 'PENDING',
      },
      orderBy: { occurredAt: 'desc' },
    });
    if (winner) return publicEvent(winner);
    throw error;
  }
}

export async function completePendingGeoAttendance(prisma, {
  projectId,
  workerId,
  now: nowInput,
  source: sourceInput,
  idempotencyKey: rawIdempotencyKey,
  sourceOccurredAt: sourceOccurredAtInput = null,
  pendingEntryId: pendingEntryIdInput = null,
  timezone: timezoneInput = null,
  evidence: evidenceInput = null,
  ...locationInput
}) {
  const scope = attendanceScope({ projectId, workerId });
  const now = trustedNow(nowInput);
  const source = normalizedSource(sourceInput, 'webview');
  const sourceOccurredAt = trustedDate(sourceOccurredAtInput, 'sourceOccurredAt', { optional: true });
  const pendingEntryId = pendingEntryIdInput == null || pendingEntryIdInput === ''
    ? null
    : requiredText(pendingEntryIdInput, 'pendingEntryId', 190);
  const evidence = plainJson(evidenceInput, 'evidence');
  const gps = normalizedGps(locationInput, 'CHECK_IN');
  const idempotencyKey = scopedIdempotencyKey(
    scope,
    source,
    'CHECK_IN',
    rawIdempotencyKey || `complete:${now.toISOString()}`,
  );
  const fingerprint = requestFingerprint({
    scope,
    source,
    eventType: 'CHECK_IN',
    pendingEntryId,
    sourceOccurredAt,
    gps,
    evidence,
  });
  const identity = { scope, source, eventType: 'CHECK_IN', fingerprint, idempotencyKey };
  const existing = await replayFor(prisma, identity);
  if (existing) return existing;

  try {
    return await runAtomically(prisma, async (transaction) => {
      const replay = await replayFor(transaction, identity);
      if (replay) return replay;

      const expiresBefore = new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS);
      await expirePendingEntries(transaction, scope, expiresBefore);
      const pending = await transaction.attendanceEntry.findFirst({
        where: {
          ...(pendingEntryId ? { id: pendingEntryId } : {}),
          ...scope,
          shiftId: null,
          eventType: 'CHECK_IN',
          verificationStatus: 'PENDING',
          occurredAt: { gte: expiresBefore },
        },
        orderBy: pendingEntryId ? undefined : { occurredAt: 'desc' },
      });
      if (!pending) {
        if (pendingEntryId) {
          throw domainError(
            'The attendance link no longer targets an active pending check-in.',
            'ATTENDANCE_LINK_STALE',
            409,
          );
        }
        return null;
      }

      const openShift = await findOpenShift(transaction, scope);
      if (openShift) {
        throw domainError(
          'The worker already has an open attendance shift in this project.',
          'ATTENDANCE_SHIFT_ALREADY_OPEN',
          409,
          { shiftId: openShift.id },
        );
      }

      const timezone = validTimezone(
        timezoneInput || pending.metadata?.attendanceTimezone || DEFAULT_ATTENDANCE_TIMEZONE,
      );
      const shift = await transaction.attendanceShift.create({
        data: {
          ...scope,
          workDate: localWorkDate(now, timezone),
          timezone,
          status: 'OPEN',
          phase: 'WORKING',
          openedAt: now,
          closedAt: null,
          revision: 0,
          metadata: {
            attendanceVersion: 1,
            openedFromPendingEntryId: pending.id,
            initialVerificationStatus: gps.verificationStatus,
          },
        },
      });
      const updated = await transaction.attendanceEntry.updateMany({
        where: {
          id: pending.id,
          ...scope,
          shiftId: null,
          eventType: 'CHECK_IN',
          verificationStatus: 'PENDING',
        },
        data: {
          shiftId: shift.id,
          verificationStatus: gps.verificationStatus,
          occurredAt: now,
          sourceOccurredAt,
          sequence: 1,
          idempotencyKey,
          requestFingerprint: fingerprint,
          status: gps.verificationStatus === 'VERIFIED' ? 'PRESENT' : 'OUTSIDE_GEOFENCE',
          latitude: gps.latitude,
          longitude: gps.longitude,
          accuracyMeters: gps.accuracyMeters,
          distanceMeters: gps.distanceMeters,
          geofenceRadiusMeters: gps.geofenceRadiusMeters,
          source,
          privacyNoticeVersion: gps.privacyNoticeVersion,
          ...(evidence ? { evidence } : {}),
          checkedInAt: now,
          metadata: {
            ...(pending.metadata && typeof pending.metadata === 'object' ? pending.metadata : {}),
            captureStartedAt: dateIso(pending.occurredAt || pending.checkedInAt),
            geofenceValidatedAt: now.toISOString(),
            accuracy: gps.accuracyMeters,
          },
        },
      });
      if (updated.count !== 1) {
        throw domainError(
          'The pending check-in changed before it could be completed.',
          'ATTENDANCE_CONCURRENT_MODIFICATION',
          409,
        );
      }

      const stored = await findEntryById(transaction, pending.id);
      return publicEvent(stored || {
        ...pending,
        shiftId: shift.id,
        eventType: 'CHECK_IN',
        verificationStatus: gps.verificationStatus,
        occurredAt: now,
        sourceOccurredAt,
        sequence: 1,
        source,
        status: gps.verificationStatus === 'VERIFIED' ? 'PRESENT' : 'OUTSIDE_GEOFENCE',
        ...gps,
        evidence,
      }, shift);
    });
  } catch (error) {
    if (!uniqueConstraint(error)) throw error;
    const replay = await replayFor(prisma, identity);
    if (replay) return replay;
    throw domainError(
      'A concurrent check-in already opened this attendance shift.',
      'ATTENDANCE_CONCURRENT_MODIFICATION',
      409,
    );
  }
}

function actionTransition(eventType, shift) {
  if (shift.status !== 'OPEN') {
    throw domainError('The attendance shift is not open.', 'ATTENDANCE_SHIFT_NOT_OPEN', 409);
  }
  if (eventType === 'BREAK_START') {
    if (shift.phase !== 'WORKING') {
      throw domainError('A break is already open.', 'ATTENDANCE_BREAK_ALREADY_OPEN', 409);
    }
    return { status: 'OPEN', phase: 'ON_BREAK', closedAt: null };
  }
  if (eventType === 'BREAK_END') {
    if (shift.phase !== 'ON_BREAK') {
      throw domainError('There is no open break to end.', 'ATTENDANCE_BREAK_NOT_OPEN', 409);
    }
    return { status: 'OPEN', phase: 'WORKING', closedAt: null };
  }
  if (eventType === 'CHECK_OUT') {
    if (shift.phase === 'ON_BREAK') {
      throw domainError(
        'The open break must be ended before check-out.',
        'ATTENDANCE_BREAK_OPEN',
        409,
      );
    }
    if (shift.phase !== 'WORKING') {
      throw domainError('The shift cannot be closed from its current phase.', 'ATTENDANCE_TRANSITION_INVALID', 409);
    }
    return { status: 'CLOSED', phase: 'WORKING' };
  }
  throw domainError(
    'CHECK_IN must be completed from a pending geolocation capture.',
    'ATTENDANCE_CHECK_IN_REQUIRES_PENDING',
    409,
  );
}

export async function recordAttendanceAction(prisma, {
  projectId,
  workerId,
  eventType: eventTypeInput,
  action = null,
  now: nowInput,
  source: sourceInput,
  idempotencyKey: rawIdempotencyKey,
  sourceOccurredAt: sourceOccurredAtInput = null,
  shiftId: shiftIdInput = null,
  expectedRevision: expectedRevisionInput = null,
  evidence: evidenceInput = null,
  ...locationInput
}) {
  const scope = attendanceScope({ projectId, workerId });
  const eventType = normalizedAction(eventTypeInput || action);
  if (eventType === 'CHECK_IN') actionTransition(eventType, { status: 'OPEN', phase: 'WORKING' });
  const now = trustedNow(nowInput);
  const source = normalizedSource(sourceInput);
  const sourceOccurredAt = trustedDate(sourceOccurredAtInput, 'sourceOccurredAt', { optional: true });
  const shiftBinding = normalizedShiftBinding(shiftIdInput, expectedRevisionInput);
  const evidence = plainJson(evidenceInput, 'evidence');
  const gps = normalizedGps(locationInput, eventType);
  const idempotencyKey = scopedIdempotencyKey(scope, source, eventType, rawIdempotencyKey);
  const fingerprint = requestFingerprint({
    scope,
    source,
    eventType,
    shiftBinding,
    sourceOccurredAt,
    gps,
    evidence,
  });
  const identity = { scope, source, eventType, fingerprint, idempotencyKey };
  const existing = await replayFor(prisma, identity);
  if (existing) return existing;

  try {
    return await runAtomically(prisma, async (transaction) => {
      const replay = await replayFor(transaction, identity);
      if (replay) return replay;
      const shift = await findBoundOpenShift(transaction, scope, shiftBinding);
      if (!shift) {
        throw domainError(
          'No open attendance shift exists for this worker and project.',
          'ATTENDANCE_SHIFT_NOT_OPEN',
          409,
        );
      }
      const transition = actionTransition(eventType, shift);
      const sequence = Number(shift.revision) + 2;
      const nextRevision = Number(shift.revision) + 1;
      const nextClosedAt = eventType === 'CHECK_OUT' ? now : null;
      const updatedShift = await transaction.attendanceShift.updateMany({
        where: {
          id: shift.id,
          ...scope,
          status: 'OPEN',
          phase: shift.phase,
          revision: shift.revision,
        },
        data: {
          status: transition.status,
          phase: transition.phase,
          closedAt: nextClosedAt,
          revision: { increment: 1 },
        },
      });
      if (updatedShift.count !== 1) {
        throw domainError(
          'The attendance shift changed before this action could be recorded.',
          'ATTENDANCE_CONCURRENT_MODIFICATION',
          409,
        );
      }

      const verificationStatus = gps?.verificationStatus || 'NOT_REQUIRED';
      const entry = await transaction.attendanceEntry.create({
        data: {
          ...scope,
          shiftId: shift.id,
          eventType,
          verificationStatus,
          occurredAt: now,
          ...(sourceOccurredAt ? { sourceOccurredAt } : {}),
          sequence,
          idempotencyKey,
          requestFingerprint: fingerprint,
          status: verificationStatus === 'REVIEW_REQUIRED' ? 'OUTSIDE_GEOFENCE' : 'PRESENT',
          ...(gps
            ? {
                latitude: gps.latitude,
                longitude: gps.longitude,
                accuracyMeters: gps.accuracyMeters,
                distanceMeters: gps.distanceMeters,
                geofenceRadiusMeters: gps.geofenceRadiusMeters,
                privacyNoticeVersion: gps.privacyNoticeVersion,
              }
            : {}),
          source,
          ...(evidence ? { evidence } : {}),
          checkedInAt: now,
          metadata: { serverTimeAuthority: true },
        },
      });
      return publicEvent(entry, {
        ...shift,
        status: transition.status,
        phase: transition.phase,
        closedAt: nextClosedAt,
        revision: nextRevision,
      });
    });
  } catch (error) {
    if (!uniqueConstraint(error)) throw error;
    const replay = await replayFor(prisma, identity);
    if (replay) return replay;
    throw domainError(
      'A concurrent attendance action won this transition.',
      'ATTENDANCE_CONCURRENT_MODIFICATION',
      409,
    );
  }
}

function normalizedWorkDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  const date = trustedDate(value, 'workDate');
  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function findJourneyShift(prisma, scope, { shiftId = null, workDate = null } = {}) {
  const include = {
    events: {
      orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
    },
  };
  if (shiftId) {
    return prisma.attendanceShift.findFirst({
      where: { id: requiredText(shiftId, 'shiftId', 180), ...scope },
      include,
    });
  }
  if (workDate) {
    return prisma.attendanceShift.findFirst({
      where: { ...scope, workDate: normalizedWorkDate(workDate) },
      orderBy: { openedAt: 'desc' },
      include,
    });
  }
  const open = await prisma.attendanceShift.findFirst({
    where: { ...scope, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include,
  });
  if (open) return open;
  return prisma.attendanceShift.findFirst({
    where: scope,
    orderBy: { openedAt: 'desc' },
    include,
  });
}

function journeyDurations(shift, events, now) {
  const openedAt = trustedDate(shift.openedAt, 'shift.openedAt');
  const end = shift.closedAt ? trustedDate(shift.closedAt, 'shift.closedAt') : now;
  const durationMs = Math.max(0, end.getTime() - openedAt.getTime());
  let breakStartedAt = null;
  let breakDurationMs = 0;
  for (const event of events) {
    if (['PENDING', 'EXPIRED', 'VOIDED'].includes(event.verificationStatus)) continue;
    const occurredAt = trustedDate(event.occurredAt, 'event.occurredAt');
    if (event.eventType === 'BREAK_START' && breakStartedAt === null) {
      breakStartedAt = occurredAt;
    } else if (event.eventType === 'BREAK_END' && breakStartedAt !== null) {
      breakDurationMs += Math.max(0, occurredAt.getTime() - breakStartedAt.getTime());
      breakStartedAt = null;
    }
  }
  if (breakStartedAt !== null && shift.status === 'OPEN' && shift.phase === 'ON_BREAK') {
    breakDurationMs += Math.max(0, end.getTime() - breakStartedAt.getTime());
  }
  return {
    durationMs,
    breakDurationMs,
    workedDurationMs: Math.max(0, durationMs - breakDurationMs),
  };
}

export async function getAttendanceJourney(prisma, {
  projectId,
  workerId,
  shiftId = null,
  workDate = null,
  now: nowInput,
} = {}) {
  const scope = attendanceScope({ projectId, workerId });
  const now = trustedNow(nowInput);
  const shift = await findJourneyShift(prisma, scope, { shiftId, workDate });
  if (!shift) return null;
  const events = Array.isArray(shift.events) ? shift.events : [];
  const nextAllowedActions = shift.status !== 'OPEN'
    ? []
    : shift.phase === 'ON_BREAK'
      ? ['BREAK_END']
      : ['BREAK_START', 'CHECK_OUT'];
  return {
    shift: publicShift(shift),
    events: events.map((event) => publicEvent(event, shift)),
    totals: journeyDurations(shift, events, now),
    nextAllowedActions,
  };
}
