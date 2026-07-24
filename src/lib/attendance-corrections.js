import { createHash } from 'node:crypto';

import { runOperationalProjectMutation } from './project-write-policy.js';

const ATTENDANCE_EVENT_TYPES = new Set([
  'CHECK_IN',
  'BREAK_START',
  'BREAK_END',
  'CHECK_OUT',
]);
const EFFECTIVE_EVENT_FIELDS = new Set(['logicalId', 'eventType', 'occurredAt']);
const SENSITIVE_EVENT_FIELDS = new Set([
  'accuracy',
  'accuracyMeters',
  'distanceMeters',
  'evidence',
  'geofenceRadiusMeters',
  'latitude',
  'longitude',
  'metadata',
  'privacyNoticeVersion',
]);
const LOGICAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const REASON_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RFC3339_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const REQUESTER_TENANT_ROLES = new Set(['ADMIN', 'DIRECTOR', 'SITE_MANAGER']);
const DECIDER_TENANT_ROLES = new Set(['ADMIN', 'DIRECTOR']);

export const ATTENDANCE_CORRECTION_MAX_EVENTS = 64;
export const ATTENDANCE_CORRECTION_DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;
export const ATTENDANCE_CORRECTION_MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1_000;

export class AttendanceCorrectionError extends Error {
  constructor(message, {
    code = 'ATTENDANCE_CORRECTION_ERROR',
    status = 400,
    details = null,
  } = {}) {
    super(message);
    this.name = 'AttendanceCorrectionError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function correctionError(message, code, status = 400, details = null) {
  return new AttendanceCorrectionError(message, { code, status, details });
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requiredIdentifier(value, field, max = 180) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (
    !text
    || text.length > max
    || /[\u0000-\u001f\u007f]/.test(text)
  ) {
    throw correctionError(
      `${field} no es v\u00e1lido.`,
      'ATTENDANCE_CORRECTION_INPUT_INVALID',
    );
  }
  return text;
}

function optionalIdentifier(value, field, max = 180) {
  if (value === null || value === undefined || value === '') return null;
  return requiredIdentifier(value, field, max);
}

function normalizeReasonCode(value) {
  const reasonCode = requiredIdentifier(value, 'reasonCode', 64).toUpperCase();
  if (!REASON_CODE_PATTERN.test(reasonCode)) {
    throw correctionError(
      'reasonCode debe ser un c\u00f3digo estable sin espacios.',
      'ATTENDANCE_CORRECTION_REASON_INVALID',
    );
  }
  return reasonCode;
}

function normalizeNote(value) {
  if (value === null || value === undefined || value === '') return null;
  const note = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!note || note.length > 280) {
    throw correctionError(
      'La nota debe tener entre 1 y 280 caracteres.',
      'ATTENDANCE_CORRECTION_NOTE_INVALID',
    );
  }
  return note;
}

function normalizeScope(scope) {
  return {
    organizationId: requiredIdentifier(scope?.organizationId, 'organizationId'),
    projectId: requiredIdentifier(scope?.projectId, 'projectId'),
  };
}

function normalizeRevision(value, field = 'baseShiftRevision') {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw correctionError(
      `${field} debe ser un entero no negativo.`,
      'ATTENDANCE_CORRECTION_REVISION_INVALID',
    );
  }
  return revision;
}

function normalizeHash(value, field) {
  const hash = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!HASH_PATTERN.test(hash)) {
    throw correctionError(
      `${field} debe ser un hash SHA-256 v\u00e1lido.`,
      'ATTENDANCE_CORRECTION_HASH_INVALID',
    );
  }
  return hash;
}

function normalizeNow(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw correctionError(
      'now debe ser un timestamp v\u00e1lido.',
      'ATTENDANCE_CORRECTION_TIME_INVALID',
    );
  }
  return date;
}

function normalizeRfc3339(value, index) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw correctionError(
        `proposedEvents[${index}].occurredAt no es v\u00e1lido.`,
        'ATTENDANCE_CORRECTION_TIME_INVALID',
        422,
        { eventIndex: index },
      );
    }
    return value.toISOString();
  }
  const text = typeof value === 'string' ? value.trim() : '';
  const match = RFC3339_PATTERN.exec(text);
  if (!match) {
    throw correctionError(
      `proposedEvents[${index}].occurredAt debe ser RFC 3339 con zona horaria.`,
      'ATTENDANCE_CORRECTION_TIME_INVALID',
      422,
      { eventIndex: index },
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const daysInMonth = month >= 1 && month <= 12
    ? new Date(Date.UTC(year, month, 0)).getUTCDate()
    : 0;
  const parsed = new Date(text);
  if (
    day < 1
    || day > daysInMonth
    || hour > 23
    || minute > 59
    || second > 59
    || Number.isNaN(parsed.getTime())
  ) {
    throw correctionError(
      `proposedEvents[${index}].occurredAt no es v\u00e1lido.`,
      'ATTENDANCE_CORRECTION_TIME_INVALID',
      422,
      { eventIndex: index },
    );
  }
  return parsed.toISOString();
}

function eventShapeError(index, message, code = 'ATTENDANCE_CORRECTION_EVENTS_INVALID') {
  return correctionError(message, code, 422, { eventIndex: index });
}

/**
 * Produces the only JSON shape accepted by the correction ledger. The array
 * order is the effective order; location and evidence never cross this
 * boundary.
 */
export function normalizeEffectiveAttendanceEvents(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > ATTENDANCE_CORRECTION_MAX_EVENTS) {
    throw correctionError(
      `La secuencia efectiva debe contener entre 1 y ${ATTENDANCE_CORRECTION_MAX_EVENTS} eventos.`,
      'ATTENDANCE_CORRECTION_EVENTS_INVALID',
      422,
    );
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.hasOwn(value, index)) {
      throw eventShapeError(
        index,
        'La secuencia efectiva no puede contener posiciones vac\u00edas.',
      );
    }
  }

  const logicalIds = new Set();
  let checkInCount = 0;
  let checkOutCount = 0;
  let breakOpen = false;
  let previousTimestamp = null;

  return value.map((event, index) => {
    if (!isPlainObject(event)) {
      throw eventShapeError(index, `proposedEvents[${index}] debe ser un objeto JSON.`);
    }
    const fields = Object.keys(event);
    const sensitiveField = fields.find((field) => SENSITIVE_EVENT_FIELDS.has(field));
    if (sensitiveField) {
      throw eventShapeError(
        index,
        'La secuencia corregida no puede contener GPS, evidencia ni metadatos sensibles.',
        'ATTENDANCE_CORRECTION_SENSITIVE_FIELDS_FORBIDDEN',
      );
    }
    if (fields.some((field) => !EFFECTIVE_EVENT_FIELDS.has(field))) {
      throw eventShapeError(
        index,
        `proposedEvents[${index}] contiene campos no permitidos.`,
      );
    }

    const logicalId = typeof event.logicalId === 'string' ? event.logicalId.trim() : '';
    if (!LOGICAL_ID_PATTERN.test(logicalId)) {
      throw eventShapeError(
        index,
        `proposedEvents[${index}].logicalId no es v\u00e1lido.`,
        'ATTENDANCE_CORRECTION_LOGICAL_ID_INVALID',
      );
    }
    if (logicalIds.has(logicalId)) {
      throw eventShapeError(
        index,
        'Los logicalId de la secuencia efectiva deben ser \u00fanicos.',
        'ATTENDANCE_CORRECTION_LOGICAL_ID_DUPLICATE',
      );
    }
    logicalIds.add(logicalId);

    const eventType = typeof event.eventType === 'string'
      ? event.eventType.trim().toUpperCase()
      : '';
    if (!ATTENDANCE_EVENT_TYPES.has(eventType)) {
      throw eventShapeError(
        index,
        `proposedEvents[${index}].eventType no est\u00e1 soportado.`,
      );
    }
    const occurredAt = normalizeRfc3339(event.occurredAt, index);
    const timestamp = Date.parse(occurredAt);
    if (previousTimestamp !== null && timestamp < previousTimestamp) {
      throw eventShapeError(
        index,
        'Los timestamps de la secuencia efectiva deben ser monot\u00f3nicos.',
        'ATTENDANCE_CORRECTION_TIME_NOT_MONOTONIC',
      );
    }
    previousTimestamp = timestamp;

    if (eventType === 'CHECK_IN') {
      checkInCount += 1;
      if (checkInCount > 1 || index !== 0) {
        throw eventShapeError(
          index,
          'La secuencia debe comenzar con un \u00fanico CHECK_IN.',
          'ATTENDANCE_CORRECTION_CHECK_IN_INVALID',
        );
      }
    } else if (checkInCount !== 1) {
      throw eventShapeError(
        index,
        'La secuencia debe comenzar con CHECK_IN.',
        'ATTENDANCE_CORRECTION_CHECK_IN_INVALID',
      );
    }

    if (eventType === 'BREAK_START') {
      if (breakOpen || checkOutCount > 0) {
        throw eventShapeError(
          index,
          'Las pausas no pueden anidarse ni comenzar despu\u00e9s de CHECK_OUT.',
          'ATTENDANCE_CORRECTION_BREAKS_UNBALANCED',
        );
      }
      breakOpen = true;
    } else if (eventType === 'BREAK_END') {
      if (!breakOpen || checkOutCount > 0) {
        throw eventShapeError(
          index,
          'Cada BREAK_END debe cerrar una pausa abierta.',
          'ATTENDANCE_CORRECTION_BREAKS_UNBALANCED',
        );
      }
      breakOpen = false;
    } else if (eventType === 'CHECK_OUT') {
      checkOutCount += 1;
      if (checkOutCount > 1 || breakOpen || index !== value.length - 1) {
        throw eventShapeError(
          index,
          'CHECK_OUT debe ser \u00fanico, cerrar la jornada y no dejar una pausa abierta.',
          'ATTENDANCE_CORRECTION_CHECK_OUT_INVALID',
        );
      }
    }

    return { logicalId, eventType, occurredAt };
  }).map((event, index, normalized) => {
    if (index === normalized.length - 1) {
      if (checkInCount !== 1) {
        throw eventShapeError(
          index,
          'La secuencia debe contener un \u00fanico CHECK_IN.',
          'ATTENDANCE_CORRECTION_CHECK_IN_INVALID',
        );
      }
      if (breakOpen) {
        throw eventShapeError(
          index,
          'La secuencia no puede terminar con una pausa abierta.',
          'ATTENDANCE_CORRECTION_BREAKS_UNBALANCED',
        );
      }
    }
    return event;
  });
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

function canonicalHash(namespace, value) {
  return createHash('sha256')
    .update(`${namespace}\0${JSON.stringify(canonicalValue(value))}`)
    .digest('hex');
}

export function hashEffectiveAttendanceEvents(value) {
  return canonicalHash(
    'obrasaas:attendance-effective-events:v1',
    normalizeEffectiveAttendanceEvents(value),
  );
}

function normalizeIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw correctionError(
      'La operaci\u00f3n requiere una clave de idempotencia v\u00e1lida.',
      'ATTENDANCE_CORRECTION_IDEMPOTENCY_REQUIRED',
    );
  }
  return key;
}

function scopedIdempotencyKey(kind, scope, actor, rawKey) {
  const digest = createHash('sha256')
    .update(
      `obrasaas:attendance-correction:${kind}:v1\0${scope.organizationId}\0${scope.projectId}\0${actor.type}\0${actor.id}\0${rawKey}`,
    )
    .digest('hex');
  return `attendance-correction-${kind}:v1:${digest}`;
}

function normalizeRequester({ requestedByPlatformUserId, requestedByWorkerId }, workerId) {
  const platformUserId = optionalIdentifier(
    requestedByPlatformUserId,
    'requestedByPlatformUserId',
  );
  const requesterWorkerId = optionalIdentifier(
    requestedByWorkerId,
    'requestedByWorkerId',
  );
  if (Number(Boolean(platformUserId)) + Number(Boolean(requesterWorkerId)) !== 1) {
    throw correctionError(
      'La solicitud debe tener exactamente un actor: usuario de plataforma o trabajador.',
      'ATTENDANCE_CORRECTION_ACTOR_INVALID',
      422,
    );
  }
  if (requesterWorkerId && requesterWorkerId !== workerId) {
    throw correctionError(
      'Un trabajador solo puede solicitar correcciones sobre su propia jornada.',
      'ATTENDANCE_CORRECTION_ACTOR_SCOPE_INVALID',
      403,
    );
  }
  return platformUserId
    ? { type: 'PLATFORM_USER', id: platformUserId, platformUserId, workerId: null }
    : { type: 'WORKER', id: requesterWorkerId, platformUserId: null, workerId: requesterWorkerId };
}

function normalizeDecision(value) {
  const decision = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (decision !== 'APPROVED' && decision !== 'REJECTED') {
    throw correctionError(
      'decision debe ser APPROVED o REJECTED.',
      'ATTENDANCE_CORRECTION_DECISION_INVALID',
      422,
    );
  }
  return decision;
}

function normalizeExpiry(value, now) {
  const explicit = value !== null && value !== undefined && value !== '';
  const expiresAt = explicit
    ? normalizeNow(value)
    : new Date(now.getTime() + ATTENDANCE_CORRECTION_DEFAULT_EXPIRY_MS);
  const lifetime = expiresAt.getTime() - now.getTime();
  if (lifetime <= 0 || lifetime > ATTENDANCE_CORRECTION_MAX_EXPIRY_MS) {
    throw correctionError(
      'expiresAt debe estar en el futuro y no superar 30 d\u00edas.',
      'ATTENDANCE_CORRECTION_EXPIRY_INVALID',
      422,
    );
  }
  return { expiresAt, fingerprintValue: explicit ? expiresAt.toISOString() : null };
}

function dateIso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function correctionStatus(request, now) {
  if (request?.decision?.decision === 'APPROVED') return 'APPROVED';
  if (request?.decision?.decision === 'REJECTED') return 'REJECTED';
  const expiresAt = request?.expiresAt instanceof Date
    ? request.expiresAt
    : new Date(request?.expiresAt);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()
    ? 'EXPIRED'
    : 'PENDING';
}

/** Returns a DTO without idempotency keys, request fingerprints or free text by default. */
export function serializeAttendanceCorrection(request, {
  now: nowInput = new Date(),
  replayed = false,
  includeNote = false,
} = {}) {
  if (!request) return null;
  const now = normalizeNow(nowInput);
  const proposedEvents = normalizeEffectiveAttendanceEvents(request.proposedEvents);
  const decision = request.decision
    ? {
        id: request.decision.id,
        decision: request.decision.decision,
        reasonCode: request.decision.reasonCode,
        decidedById: request.decision.decidedById,
        createdAt: dateIso(request.decision.createdAt),
        ...(includeNote ? { note: request.decision.note ?? null } : {}),
        hasNote: Boolean(request.decision.note),
      }
    : null;
  const adjustment = request.adjustment
    ? {
        id: request.adjustment.id,
        appliedShiftRevision: Number(request.adjustment.appliedShiftRevision),
        baseLedgerSequence: Number(request.adjustment.baseLedgerSequence),
        baseEffectiveHash: request.adjustment.baseEffectiveHash,
        effectiveHash: request.adjustment.effectiveHash,
        effectiveEvents: normalizeEffectiveAttendanceEvents(request.adjustment.effectiveEvents),
        createdAt: dateIso(request.adjustment.createdAt),
      }
    : null;
  return {
    id: request.id,
    projectId: request.projectId,
    workerId: request.workerId,
    expectationId: request.expectationId ?? null,
    shiftId: request.shiftId,
    targetEntryId: request.targetEntryId ?? null,
    status: correctionStatus({ ...request, decision }, now),
    baseShiftRevision: Number(request.baseShiftRevision),
    baseEffectiveHash: request.baseEffectiveHash,
    proposedEffectiveHash: request.proposedEffectiveHash,
    proposedEvents,
    reasonCode: request.reasonCode,
    ...(includeNote ? { note: request.note ?? null } : {}),
    hasNote: Boolean(request.note),
    requestedBy: request.requestedByPlatformUserId
      ? { type: 'PLATFORM_USER', id: request.requestedByPlatformUserId }
      : { type: 'WORKER', id: request.requestedByWorkerId },
    expiresAt: dateIso(request.expiresAt),
    createdAt: dateIso(request.createdAt),
    decision,
    adjustment,
    replayed: Boolean(replayed),
  };
}

async function requirePlatformMembership(transaction, scope, userId, allowedRoles) {
  const membership = await transaction.tenantMembership.findFirst({
    where: {
      organizationId: scope.organizationId,
      userId,
      status: 'ACTIVE',
    },
    select: { id: true, tenantRole: true },
  });
  if (!membership || !allowedRoles.has(membership.tenantRole)) {
    throw correctionError(
      'El actor no tiene permisos vigentes para esta operaci\u00f3n.',
      'ATTENDANCE_CORRECTION_FORBIDDEN',
      403,
    );
  }
  if (membership.tenantRole === 'SITE_MANAGER') {
    const projectMembership = await transaction.projectMembership.findFirst({
      where: {
        projectId: scope.projectId,
        tenantMembershipId: membership.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!projectMembership) {
      throw correctionError(
        'El actor no tiene acceso vigente a esta obra.',
        'ATTENDANCE_CORRECTION_FORBIDDEN',
        403,
      );
    }
  }
  return membership;
}

async function requirePlatformCorrectionActor(
  transaction,
  scope,
  userId,
  allowedRoles,
  { isSuperadmin = false } = {},
) {
  if (isSuperadmin) return { tenantRole: 'SUPERADMIN' };
  return requirePlatformMembership(transaction, scope, userId, allowedRoles);
}

async function requireWorkerRequester(transaction, scope, workerId) {
  const worker = await transaction.worker.findFirst({
    where: {
      id: workerId,
      projectId: scope.projectId,
      active: true,
      project: { organizationId: scope.organizationId },
    },
    select: { id: true },
  });
  if (!worker) {
    throw correctionError(
      'El trabajador solicitante no est\u00e1 activo dentro de la obra.',
      'ATTENDANCE_CORRECTION_ACTOR_SCOPE_INVALID',
      403,
    );
  }
}

async function loadScopedShift(transaction, scope, shiftId, workerId) {
  const shift = await transaction.attendanceShift.findFirst({
    where: {
      id: shiftId,
      projectId: scope.projectId,
      workerId,
      project: { organizationId: scope.organizationId },
    },
    select: {
      id: true,
      projectId: true,
      workerId: true,
      expectationId: true,
      workDate: true,
      timezone: true,
      status: true,
      phase: true,
      openedAt: true,
      closedAt: true,
      revision: true,
    },
  });
  if (!shift) {
    throw correctionError(
      'La jornada no existe dentro del alcance activo.',
      'ATTENDANCE_CORRECTION_SHIFT_NOT_FOUND',
      404,
    );
  }
  if (shift.status === 'VOIDED') {
    throw correctionError(
      'Una jornada anulada no admite correcciones.',
      'ATTENDANCE_CORRECTION_SHIFT_VOIDED',
      409,
    );
  }
  return shift;
}

function ledgerEntryToEffectiveEvent(entry) {
  return {
    logicalId: requiredIdentifier(entry.id, 'AttendanceEntry.id', 128),
    eventType: entry.eventType,
    occurredAt: entry.occurredAt,
  };
}

async function loadLedgerEvents(transaction, scope, shift, sequenceAfter = null) {
  const entries = await transaction.attendanceEntry.findMany({
    where: {
      shiftId: shift.id,
      projectId: scope.projectId,
      workerId: shift.workerId,
      verificationStatus: { notIn: ['PENDING', 'EXPIRED', 'VOIDED'] },
      ...(sequenceAfter === null ? {} : { sequence: { gt: sequenceAfter } }),
    },
    select: {
      id: true,
      eventType: true,
      occurredAt: true,
      sequence: true,
    },
    orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
  });
  const ordered = [...entries]
    .sort((left, right) => (
      (Number(left.sequence) - Number(right.sequence))
      || (new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
      || String(left.id).localeCompare(String(right.id))
    ));
  return {
    events: ordered.map(ledgerEntryToEffectiveEvent),
    maxSequence: ordered.reduce(
      (maximum, entry) => Math.max(maximum, Number(entry.sequence) || 0),
      Number(sequenceAfter) || 0,
    ),
  };
}

async function loadCurrentEffectiveState(transaction, scope, shift) {
  const latestAdjustment = await transaction.attendanceAdjustment.findFirst({
    where: {
      correctionRequest: {
        is: {
          shiftId: shift.id,
          projectId: scope.projectId,
          workerId: shift.workerId,
        },
      },
    },
    select: {
      id: true,
      appliedShiftRevision: true,
      baseLedgerSequence: true,
      effectiveEvents: true,
      effectiveHash: true,
      createdAt: true,
    },
    orderBy: [
      { appliedShiftRevision: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ],
  });

  let events;
  if (latestAdjustment) {
    const appliedRevision = normalizeRevision(
      latestAdjustment.appliedShiftRevision,
      'AttendanceAdjustment.appliedShiftRevision',
    );
    if (appliedRevision > Number(shift.revision)) {
      throw correctionError(
        'El estado efectivo de la jornada es inconsistente.',
        'ATTENDANCE_CORRECTION_STATE_CORRUPT',
        500,
      );
    }
    const adjustedEvents = normalizeEffectiveAttendanceEvents(latestAdjustment.effectiveEvents);
    const storedHash = normalizeHash(latestAdjustment.effectiveHash, 'AttendanceAdjustment.effectiveHash');
    if (hashEffectiveAttendanceEvents(adjustedEvents) !== storedHash) {
      throw correctionError(
        'El ajuste vigente no supera la verificaci\u00f3n de integridad.',
        'ATTENDANCE_CORRECTION_STATE_CORRUPT',
        500,
      );
    }
    const baseLedgerSequence = normalizeRevision(
      latestAdjustment.baseLedgerSequence,
      'AttendanceAdjustment.baseLedgerSequence',
    );
    if (baseLedgerSequence < 1) {
      throw correctionError(
        'El estado efectivo de la jornada no conserva su secuencia base.',
        'ATTENDANCE_CORRECTION_STATE_CORRUPT',
        500,
      );
    }
    const laterLedger = appliedRevision < Number(shift.revision)
      ? await loadLedgerEvents(transaction, scope, shift, baseLedgerSequence)
      : { events: [], maxSequence: baseLedgerSequence };
    events = normalizeEffectiveAttendanceEvents([...adjustedEvents, ...laterLedger.events]);
    return {
      events,
      hash: hashEffectiveAttendanceEvents(events),
      baseLedgerSequence: laterLedger.maxSequence,
    };
  } else {
    const ledger = await loadLedgerEvents(transaction, scope, shift);
    events = normalizeEffectiveAttendanceEvents(ledger.events);
    return {
      events,
      hash: hashEffectiveAttendanceEvents(events),
      baseLedgerSequence: ledger.maxSequence,
    };
  }
}

async function validateOptionalTargets(transaction, scope, shift, {
  expectationId,
  targetEntryId,
}) {
  if (expectationId && expectationId !== shift.expectationId) {
    throw correctionError(
      'La expectativa ya no coincide con la jornada.',
      'ATTENDANCE_CORRECTION_EXPECTATION_STALE',
      409,
    );
  }
  if (!targetEntryId) return;
  const target = await transaction.attendanceEntry.findFirst({
    where: {
      id: targetEntryId,
      shiftId: shift.id,
      projectId: scope.projectId,
      workerId: shift.workerId,
    },
    select: { id: true },
  });
  if (!target) {
    throw correctionError(
      'El fichaje objetivo no pertenece a la jornada indicada.',
      'ATTENDANCE_CORRECTION_TARGET_NOT_FOUND',
      404,
    );
  }
}

async function findRequestByIdempotency(prisma, idempotencyKey) {
  return prisma.attendanceCorrectionRequest.findUnique({
    where: { idempotencyKey },
    include: { decision: true, adjustment: true },
  });
}

function assertRequestReplay(request, expected) {
  if (!request) return null;
  const exact = request.projectId === expected.scope.projectId
    && request.workerId === expected.workerId
    && request.shiftId === expected.shiftId
    && request.idempotencyKey === expected.idempotencyKey
    && request.requestFingerprint === expected.fingerprint
    && (request.requestedByPlatformUserId ?? null) === expected.requester.platformUserId
    && (request.requestedByWorkerId ?? null) === expected.requester.workerId;
  if (!exact) {
    throw correctionError(
      'La clave de idempotencia ya fue utilizada con otra solicitud.',
      'ATTENDANCE_CORRECTION_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
  return request;
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

export async function requestAttendanceCorrection(prisma, {
  scope: scopeInput,
  workerId: workerIdInput,
  shiftId: shiftIdInput,
  expectationId: expectationIdInput = null,
  targetEntryId: targetEntryIdInput = null,
  baseShiftRevision: baseShiftRevisionInput,
  baseEffectiveHash: baseEffectiveHashInput,
  proposedEvents: proposedEventsInput,
  reasonCode: reasonCodeInput,
  note: noteInput = null,
  requestedByPlatformUserId = null,
  requestedByIsSuperadmin = false,
  requestedByWorkerId = null,
  idempotencyKey: rawIdempotencyKey,
  expiresAt: expiresAtInput = null,
  now: nowInput = new Date(),
}) {
  const scope = normalizeScope(scopeInput);
  const workerId = requiredIdentifier(workerIdInput, 'workerId');
  const shiftId = requiredIdentifier(shiftIdInput, 'shiftId');
  const expectationId = optionalIdentifier(expectationIdInput, 'expectationId');
  const targetEntryId = optionalIdentifier(targetEntryIdInput, 'targetEntryId');
  const baseShiftRevision = normalizeRevision(baseShiftRevisionInput);
  const baseEffectiveHash = normalizeHash(baseEffectiveHashInput, 'baseEffectiveHash');
  const proposedEvents = normalizeEffectiveAttendanceEvents(proposedEventsInput);
  const proposedEffectiveHash = hashEffectiveAttendanceEvents(proposedEvents);
  const reasonCode = normalizeReasonCode(reasonCodeInput);
  const note = normalizeNote(noteInput);
  const requester = normalizeRequester({
    requestedByPlatformUserId,
    requestedByWorkerId,
  }, workerId);
  const rawKey = normalizeIdempotencyKey(rawIdempotencyKey);
  const now = normalizeNow(nowInput);
  const expiry = normalizeExpiry(expiresAtInput, now);
  const idempotencyKey = scopedIdempotencyKey('request', scope, requester, rawKey);
  const fingerprint = canonicalHash('obrasaas:attendance-correction-request:v1', {
    scope,
    workerId,
    shiftId,
    expectationId,
    targetEntryId,
    baseShiftRevision,
    baseEffectiveHash,
    proposedEvents,
    proposedEffectiveHash,
    reasonCode,
    note,
    requester: { type: requester.type, id: requester.id },
    expiresAt: expiry.fingerprintValue,
  });
  const replayIdentity = {
    scope,
    workerId,
    shiftId,
    requester,
    idempotencyKey,
    fingerprint,
  };

  try {
    return await runOperationalProjectMutation(prisma, scope, async (transaction) => {
      const replay = assertRequestReplay(
        await findRequestByIdempotency(transaction, idempotencyKey),
        replayIdentity,
      );
      if (replay) return serializeAttendanceCorrection(replay, { now, replayed: true });

      if (requester.platformUserId) {
        await requirePlatformCorrectionActor(
          transaction,
          scope,
          requester.platformUserId,
          REQUESTER_TENANT_ROLES,
          { isSuperadmin: requestedByIsSuperadmin === true },
        );
      } else {
        await requireWorkerRequester(transaction, scope, requester.workerId);
      }

      const shift = await loadScopedShift(transaction, scope, shiftId, workerId);
      await validateOptionalTargets(transaction, scope, shift, { expectationId, targetEntryId });
      if (Number(shift.revision) !== baseShiftRevision) {
        throw correctionError(
          'La jornada cambi\u00f3 desde que se prepar\u00f3 la correcci\u00f3n.',
          'ATTENDANCE_CORRECTION_BASE_REVISION_STALE',
          409,
          { expectedRevision: baseShiftRevision, currentRevision: Number(shift.revision) },
        );
      }
      const current = await loadCurrentEffectiveState(transaction, scope, shift);
      if (current.hash !== baseEffectiveHash) {
        throw correctionError(
          'La secuencia base ya no coincide con la jornada vigente.',
          'ATTENDANCE_CORRECTION_BASE_HASH_STALE',
          409,
          { currentEffectiveHash: current.hash },
        );
      }
      if (proposedEffectiveHash === current.hash) {
        throw correctionError(
          'La secuencia propuesta no contiene cambios efectivos.',
          'ATTENDANCE_CORRECTION_NO_CHANGES',
          422,
        );
      }

      const request = await transaction.attendanceCorrectionRequest.create({
        data: {
          projectId: scope.projectId,
          workerId,
          expectationId: shift.expectationId ?? null,
          shiftId,
          targetEntryId,
          baseShiftRevision,
          baseEffectiveHash,
          proposedEvents,
          proposedEffectiveHash,
          reasonCode,
          note,
          requestedByPlatformUserId: requester.platformUserId,
          requestedByWorkerId: requester.workerId,
          idempotencyKey,
          requestFingerprint: fingerprint,
          expiresAt: expiry.expiresAt,
          createdAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: requester.platformUserId,
          action: 'attendance.correction.requested',
          entityType: 'AttendanceCorrectionRequest',
          entityId: request.id,
          metadata: {
            projectId: scope.projectId,
            workerId,
            shiftId,
            expectationId: shift.expectationId ?? null,
            requesterType: requester.type,
            baseShiftRevision,
            baseEffectiveHash,
            proposedEffectiveHash,
            reasonCode,
          },
          createdAt: now,
        },
      });
      return serializeAttendanceCorrection(
        { ...request, decision: null, adjustment: null },
        { now, replayed: false },
      );
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const replay = assertRequestReplay(
      await findRequestByIdempotency(prisma, idempotencyKey),
      replayIdentity,
    );
    if (replay) return serializeAttendanceCorrection(replay, { now, replayed: true });
    throw correctionError(
      'Otra operaci\u00f3n cre\u00f3 la solicitud al mismo tiempo.',
      'ATTENDANCE_CORRECTION_CONCURRENT_MODIFICATION',
      409,
    );
  }
}

async function loadScopedRequest(transaction, scope, requestId) {
  const request = await transaction.attendanceCorrectionRequest.findFirst({
    where: {
      id: requestId,
      projectId: scope.projectId,
      project: { organizationId: scope.organizationId },
    },
    include: { decision: true, adjustment: true },
  });
  if (!request) {
    throw correctionError(
      'La solicitud de correcci\u00f3n no existe dentro del alcance activo.',
      'ATTENDANCE_CORRECTION_NOT_FOUND',
      404,
    );
  }
  return request;
}

async function findDecisionByIdempotency(prisma, idempotencyKey) {
  return prisma.attendanceCorrectionDecision.findUnique({
    where: { idempotencyKey },
  });
}

async function exactDecisionReplay(prisma, expected) {
  const decision = await findDecisionByIdempotency(prisma, expected.idempotencyKey);
  if (!decision) return null;
  if (
    decision.requestId !== expected.requestId
    || decision.decidedById !== expected.decidedById
    || decision.idempotencyKey !== expected.idempotencyKey
    || decision.requestFingerprint !== expected.fingerprint
  ) {
    throw correctionError(
      'La clave de idempotencia ya fue utilizada con otra decisi\u00f3n.',
      'ATTENDANCE_CORRECTION_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
  const request = await loadScopedRequest(prisma, expected.scope, expected.requestId);
  if (request.decision?.id !== decision.id) {
    throw correctionError(
      'La decisi\u00f3n almacenada no supera la verificaci\u00f3n de integridad.',
      'ATTENDANCE_CORRECTION_STATE_CORRUPT',
      500,
    );
  }
  return request;
}

function derivedShiftAggregate(shift, proposedEvents) {
  const checkIn = proposedEvents[0];
  const checkOut = proposedEvents.at(-1)?.eventType === 'CHECK_OUT'
    ? proposedEvents.at(-1)
    : null;
  let status;
  if (checkOut) status = 'CLOSED';
  else if (shift.status === 'OPEN') status = 'OPEN';
  else status = 'PENDING_CLOSE';
  return {
    openedAt: new Date(checkIn.occurredAt),
    closedAt: checkOut ? new Date(checkOut.occurredAt) : null,
    status,
    phase: 'WORKING',
  };
}

function alreadyDecidedError(request) {
  return correctionError(
    'La solicitud ya tiene una decisi\u00f3n terminal.',
    'ATTENDANCE_CORRECTION_ALREADY_DECIDED',
    409,
    { decision: request?.decision?.decision ?? null },
  );
}

export async function decideAttendanceCorrection(prisma, {
  scope: scopeInput,
  requestId: requestIdInput,
  decidedById: decidedByIdInput,
  decidedByIsSuperadmin = false,
  decision: decisionInput,
  reasonCode: reasonCodeInput,
  note: noteInput = null,
  idempotencyKey: rawIdempotencyKey,
  now: nowInput = new Date(),
}) {
  const scope = normalizeScope(scopeInput);
  const requestId = requiredIdentifier(requestIdInput, 'requestId');
  const decidedById = requiredIdentifier(decidedByIdInput, 'decidedById');
  const decisionKind = normalizeDecision(decisionInput);
  const reasonCode = normalizeReasonCode(reasonCodeInput);
  const note = normalizeNote(noteInput);
  const rawKey = normalizeIdempotencyKey(rawIdempotencyKey);
  const now = normalizeNow(nowInput);
  const actor = { type: 'PLATFORM_USER', id: decidedById };
  const idempotencyKey = scopedIdempotencyKey('decision', scope, actor, rawKey);
  const fingerprint = canonicalHash('obrasaas:attendance-correction-decision:v1', {
    scope,
    requestId,
    decidedById,
    decision: decisionKind,
    reasonCode,
    note,
  });
  const replayIdentity = {
    scope,
    requestId,
    decidedById,
    idempotencyKey,
    fingerprint,
  };

  try {
    return await runOperationalProjectMutation(prisma, scope, async (transaction) => {
      const replay = await exactDecisionReplay(transaction, replayIdentity);
      if (replay) return serializeAttendanceCorrection(replay, { now, replayed: true });

      await requirePlatformCorrectionActor(
        transaction,
        scope,
        decidedById,
        DECIDER_TENANT_ROLES,
        { isSuperadmin: decidedByIsSuperadmin === true },
      );
      const request = await loadScopedRequest(transaction, scope, requestId);
      if (request.decision) throw alreadyDecidedError(request);
      const expiresAt = request.expiresAt instanceof Date
        ? request.expiresAt
        : new Date(request.expiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
        throw correctionError(
          'La solicitud expir\u00f3 y ya no admite una decisi\u00f3n.',
          'ATTENDANCE_CORRECTION_EXPIRED',
          409,
        );
      }
      if (
        decisionKind === 'APPROVED'
        && request.requestedByPlatformUserId === decidedById
      ) {
        throw correctionError(
          'Quien solicit\u00f3 la correcci\u00f3n no puede aprobarla.',
          'ATTENDANCE_CORRECTION_SELF_APPROVAL_FORBIDDEN',
          403,
        );
      }

      let shift = null;
      let adjustment = null;
      let appliedShiftRevision = null;
      if (decisionKind === 'APPROVED') {
        shift = await loadScopedShift(
          transaction,
          scope,
          request.shiftId,
          request.workerId,
        );
        if (Number(shift.revision) !== Number(request.baseShiftRevision)) {
          throw correctionError(
            'La jornada cambi\u00f3 despu\u00e9s de creada la solicitud.',
            'ATTENDANCE_CORRECTION_BASE_REVISION_STALE',
            409,
            {
              expectedRevision: Number(request.baseShiftRevision),
              currentRevision: Number(shift.revision),
            },
          );
        }
        const current = await loadCurrentEffectiveState(transaction, scope, shift);
        if (current.hash !== request.baseEffectiveHash) {
          throw correctionError(
            'La secuencia efectiva cambi\u00f3 despu\u00e9s de creada la solicitud.',
            'ATTENDANCE_CORRECTION_BASE_HASH_STALE',
            409,
            { currentEffectiveHash: current.hash },
          );
        }
        const proposedEvents = normalizeEffectiveAttendanceEvents(request.proposedEvents);
        const proposedEffectiveHash = hashEffectiveAttendanceEvents(proposedEvents);
        if (proposedEffectiveHash !== request.proposedEffectiveHash) {
          throw correctionError(
            'La propuesta almacenada no supera la verificaci\u00f3n de integridad.',
            'ATTENDANCE_CORRECTION_STATE_CORRUPT',
            500,
          );
        }
        const aggregate = derivedShiftAggregate(shift, proposedEvents);
        const updated = await transaction.attendanceShift.updateMany({
          where: {
            id: shift.id,
            projectId: scope.projectId,
            workerId: request.workerId,
            revision: Number(request.baseShiftRevision),
          },
          data: {
            ...aggregate,
            revision: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw correctionError(
            'La jornada cambi\u00f3 durante la aprobaci\u00f3n.',
            'ATTENDANCE_CORRECTION_CONCURRENT_MODIFICATION',
            409,
          );
        }
        appliedShiftRevision = Number(request.baseShiftRevision) + 1;
        adjustment = await transaction.attendanceAdjustment.create({
          data: {
            correctionRequestId: request.id,
            appliedShiftRevision,
            baseLedgerSequence: current.baseLedgerSequence,
            baseEffectiveHash: request.baseEffectiveHash,
            effectiveHash: proposedEffectiveHash,
            effectiveEvents: proposedEvents,
            createdAt: now,
          },
        });
      }

      const storedDecision = await transaction.attendanceCorrectionDecision.create({
        data: {
          requestId: request.id,
          decision: decisionKind,
          reasonCode,
          note,
          decidedById,
          idempotencyKey,
          requestFingerprint: fingerprint,
          createdAt: now,
        },
      });
      await transaction.auditLog.create({
        data: {
          organizationId: scope.organizationId,
          actorId: decidedById,
          action: decisionKind === 'APPROVED'
            ? 'attendance.correction.approved'
            : 'attendance.correction.rejected',
          entityType: 'AttendanceCorrectionRequest',
          entityId: request.id,
          metadata: {
            projectId: scope.projectId,
            workerId: request.workerId,
            shiftId: request.shiftId,
            decisionId: storedDecision.id,
            reasonCode,
            baseShiftRevision: Number(request.baseShiftRevision),
            appliedShiftRevision,
            baseEffectiveHash: request.baseEffectiveHash,
            proposedEffectiveHash: request.proposedEffectiveHash,
          },
          createdAt: now,
        },
      });
      if (adjustment) {
        await transaction.auditLog.create({
          data: {
            organizationId: scope.organizationId,
            actorId: decidedById,
            action: 'attendance.adjustment.applied',
            entityType: 'AttendanceAdjustment',
            entityId: adjustment.id,
            metadata: {
              projectId: scope.projectId,
              workerId: request.workerId,
              shiftId: request.shiftId,
              correctionRequestId: request.id,
              appliedShiftRevision,
              baseEffectiveHash: request.baseEffectiveHash,
              effectiveHash: request.proposedEffectiveHash,
            },
            createdAt: now,
          },
        });
      }
      return serializeAttendanceCorrection({
        ...request,
        decision: storedDecision,
        adjustment,
      }, { now, replayed: false });
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const replay = await exactDecisionReplay(prisma, replayIdentity);
    if (replay) return serializeAttendanceCorrection(replay, { now, replayed: true });
    const request = await loadScopedRequest(prisma, scope, requestId);
    if (request.decision) throw alreadyDecidedError(request);
    throw correctionError(
      'Otra operaci\u00f3n decidi\u00f3 la solicitud al mismo tiempo.',
      'ATTENDANCE_CORRECTION_CONCURRENT_MODIFICATION',
      409,
    );
  }
}

export function attendanceCorrectionErrorResponse(error) {
  if (!(error instanceof AttendanceCorrectionError)) return null;
  return Response.json({
    error: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  }, {
    status: error.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export const normalizeAttendanceCorrectionEvents = normalizeEffectiveAttendanceEvents;
export const buildEffectiveAttendanceHash = hashEffectiveAttendanceEvents;
export const createAttendanceCorrectionRequest = requestAttendanceCorrection;
export const resolveAttendanceCorrection = decideAttendanceCorrection;
export const toAttendanceCorrectionDto = serializeAttendanceCorrection;
export { AttendanceCorrectionError as AttendanceCorrectionDomainError };
