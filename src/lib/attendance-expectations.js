import {
  ATTENDANCE_CLASSIFIER_VERSION,
  ATTENDANCE_SCHEDULE_CONTRACT_VERSION,
  AttendanceScheduleDomainError,
  attendanceScheduleIdempotencyKey,
  buildAttendanceExpectationRevision,
  canonicalAttendanceHash,
  normalizePublishedAttendanceSchedule,
} from './attendance-schedules.js';
import {
  isoWeekday,
  localDateKey,
  parseDateKey,
  shiftDateKey,
} from './zoned-time.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EXCEPTION_TYPES = new Set([
  'EXCUSED_ABSENCE',
  'APPROVED_LEAVE',
  'NON_WORKING_DAY',
  'OFFSITE_WORK',
]);
const MAX_ASSIGNED_WORKERS = 250;
const MAX_MATERIALIZATION_DAYS = 14;
const DEFAULT_MATERIALIZATION_WORKERS = 25;
const MAX_MATERIALIZATION_WORKERS = 50;

export class AttendanceExpectationError extends Error {
  constructor(message, code = 'ATTENDANCE_EXPECTATION_INVALID', status = 400, details = null) {
    super(message);
    this.name = 'AttendanceExpectationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function expectationError(message, code, status = 400, details = null) {
  return new AttendanceExpectationError(message, code, status, details);
}

function requiredText(value, field, max = 190) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw expectationError(
      `${field} is required and must contain at most ${max} safe characters.`,
      'ATTENDANCE_EXPECTATION_INPUT_INVALID',
    );
  }
  return text;
}

function optionalText(value, field, max) {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field, max);
}

function requiredScope(scope) {
  return {
    organizationId: requiredText(scope?.organizationId, 'organizationId', 180),
    projectId: requiredText(scope?.projectId, 'projectId', 180),
  };
}

function trustedNow(value) {
  const date = value == null ? new Date() : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw expectationError('now must be a valid timestamp.', 'ATTENDANCE_TIME_INVALID');
  }
  return date;
}

function normalizedDateKey(value, field = 'workDate') {
  const candidate = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof candidate !== 'string' || !DATE_KEY_PATTERN.test(candidate)) {
    throw expectationError(`${field} must be a YYYY-MM-DD date.`, 'ATTENDANCE_DATE_INVALID');
  }
  try {
    parseDateKey(candidate);
  } catch {
    throw expectationError(`${field} must be a real calendar date.`, 'ATTENDANCE_DATE_INVALID');
  }
  return candidate;
}

function databaseDate(value, field = 'workDate') {
  return new Date(`${normalizedDateKey(value, field)}T00:00:00.000Z`);
}

function boundedRevision(value, field = 'expectedRevision') {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw expectationError(
      `${field} must be a non-negative safe integer.`,
      'ATTENDANCE_REVISION_INVALID',
    );
  }
  return revision;
}

function uniqueSortedIds(value, field = 'workerIds') {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ASSIGNED_WORKERS) {
    throw expectationError(
      `${field} must be an array with at most ${MAX_ASSIGNED_WORKERS} items.`,
      'ATTENDANCE_ASSIGNMENT_INVALID',
    );
  }
  return [...new Set(value.map((item, index) => (
    requiredText(item, `${field}[${index}]`, 180)
  )))].sort();
}

function scopedKey(namespace, scope, rawKey, subject) {
  const idempotencyKey = requiredText(rawKey, 'idempotencyKey', 512);
  const digest = canonicalAttendanceHash({
    projectId: scope.projectId,
    subject,
    idempotencyKey,
  }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:${namespace}:idempotency`);
  return `attendance:${namespace}:v1:${digest}`;
}

function scheduleVersionShape(version) {
  return {
    id: version.id,
    projectId: version.projectId,
    scheduleId: version.scheduleId,
    version: version.version,
    effectiveFrom: version.effectiveFrom instanceof Date
      ? version.effectiveFrom.toISOString().slice(0, 10)
      : String(version.effectiveFrom).slice(0, 10),
    timezone: version.timezone,
    earlyCheckInMinutes: version.earlyCheckInMinutes,
    lateToleranceMinutes: version.lateToleranceMinutes,
    latePolicy: version.latePolicy,
    noShowAfterMinutes: version.noShowAfterMinutes,
    pendingCloseAfterMinutes: version.pendingCloseAfterMinutes,
    absenceFinalizeAfterMinutes: version.absenceFinalizeAfterMinutes,
    status: version.status,
    publishedAt: version.publishedAt,
    days: [...(version.days || [])].sort((left, right) => left.isoWeekday - right.isoWeekday),
  };
}

function serializeDay(day) {
  return {
    id: day.id,
    isoWeekday: day.isoWeekday,
    isWorkingDay: day.isWorkingDay,
    startMinute: day.startMinute,
    endMinute: day.endMinute,
    endDayOffset: day.endDayOffset,
    expectedBreakMinutes: day.expectedBreakMinutes,
  };
}

export function serializeAttendanceScheduleVersion(version) {
  if (!version) return null;
  return {
    id: version.id,
    scheduleId: version.scheduleId,
    version: version.version,
    effectiveFrom: version.effectiveFrom?.toISOString?.().slice(0, 10)
      || String(version.effectiveFrom).slice(0, 10),
    timezone: version.timezone,
    earlyCheckInMinutes: version.earlyCheckInMinutes,
    lateToleranceMinutes: version.lateToleranceMinutes,
    latePolicy: version.latePolicy,
    noShowAfterMinutes: version.noShowAfterMinutes,
    pendingCloseAfterMinutes: version.pendingCloseAfterMinutes,
    absenceFinalizeAfterMinutes: version.absenceFinalizeAfterMinutes,
    status: version.status,
    configHash: version.configHash,
    publishedAt: version.publishedAt?.toISOString?.() || null,
    days: [...(version.days || [])]
      .sort((left, right) => left.isoWeekday - right.isoWeekday)
      .map(serializeDay),
  };
}

export function serializeAttendanceSchedule(schedule) {
  if (!schedule) return null;
  return {
    id: schedule.id,
    name: schedule.name,
    status: schedule.status,
    revision: schedule.revision,
    createdAt: schedule.createdAt?.toISOString?.() || null,
    updatedAt: schedule.updatedAt?.toISOString?.() || null,
    versions: (schedule.versions || []).map(serializeAttendanceScheduleVersion),
  };
}

function normalizePublishRequest(input, { version, publishedAt }) {
  const workerIds = uniqueSortedIds(input?.workerIds);
  const name = requiredText(input?.name, 'name', 120);
  const schedule = normalizePublishedAttendanceSchedule({
    ...input,
    version,
    publishedAt,
    status: 'PUBLISHED',
  });
  return { name, workerIds, schedule };
}

function publishFingerprint({ name, workerIds, expectedRevision, schedule }) {
  return canonicalAttendanceHash({
    name,
    workerIds,
    expectedRevision,
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
  }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:publish-request`);
}

async function assertWorkersBelongToProject(transaction, projectId, workerIds) {
  if (workerIds.length === 0) return;
  const workers = await transaction.worker.findMany({
    where: { projectId, id: { in: workerIds }, active: true },
    select: { id: true },
  });
  const found = new Set(workers.map((worker) => worker.id));
  const missing = workerIds.filter((workerId) => !found.has(workerId));
  if (missing.length > 0) {
    throw expectationError(
      'One or more selected workers are inactive or do not belong to this project.',
      'ATTENDANCE_WORKER_NOT_FOUND',
      404,
      { workerIds: missing },
    );
  }
}

async function assertScheduleIsNotRetroactiveToday(transaction, {
  projectId,
  workerIds,
  schedule,
  now,
}) {
  if (workerIds.length === 0) return;
  const localToday = localDateKey(now, schedule.timezone);
  if (schedule.effectiveFrom !== localToday) return;
  const preview = buildAttendanceExpectationRevision({
    expectationId: 'attendance-schedule-preview',
    revision: 1,
    workDate: localToday,
    schedule,
    scheduleVersionId: 'attendance-schedule-preview-version',
    scheduleDayId: 'attendance-schedule-preview-day',
  });
  const earliestCheckIn = preview.kind === 'WORKING'
    ? new Date(
        preview.expectedStartAt.getTime() - (schedule.earlyCheckInMinutes * 60_000),
      )
    : null;
  const date = databaseDate(localToday);
  const broadStart = new Date(date.getTime() - (14 * 60 * 60 * 1_000));
  const broadEnd = new Date(date.getTime() + (38 * 60 * 60 * 1_000));
  const [expectations, shifts, entries] = await Promise.all([
    transaction.attendanceExpectation.count({
      where: { projectId, workerId: { in: workerIds }, workDate: date },
    }),
    transaction.attendanceShift.count({
      where: { projectId, workerId: { in: workerIds }, workDate: date },
    }),
    transaction.attendanceEntry.count({
      where: {
        projectId,
        workerId: { in: workerIds },
        occurredAt: { gte: broadStart, lt: broadEnd },
      },
    }),
  ]);
  if (
    preview.kind !== 'WORKING'
    || now >= earliestCheckIn
    || expectations > 0
    || shifts > 0
    || entries > 0
  ) {
    throw expectationError(
      'A schedule assigned to workers cannot become effective today after attendance processing has begun.',
      'ATTENDANCE_SCHEDULE_RETROACTIVE_FORBIDDEN',
      409,
      { earliestEffectiveFrom: shiftDateKey(localToday, 1) },
    );
  }
}

function exceptionShape(exception) {
  if (!exception?.active) return null;
  const revision = exception.revisions?.[0];
  if (!revision || revision.action !== 'SET') return null;
  return revision;
}

export async function materializeAttendanceExpectationInTransaction(transaction, {
  projectId,
  workerId,
  workDate,
} = {}) {
  const safeProjectId = requiredText(projectId, 'projectId', 180);
  const safeWorkerId = requiredText(workerId, 'workerId', 180);
  const safeWorkDate = normalizedDateKey(workDate);
  const workDateValue = databaseDate(safeWorkDate);

  const assignment = await transaction.attendanceScheduleAssignment.findFirst({
    where: {
      projectId: safeProjectId,
      workerId: safeWorkerId,
      effectiveFrom: { lte: workDateValue },
      OR: [
        { effectiveThrough: null },
        { effectiveThrough: { gte: workDateValue } },
      ],
      scheduleVersion: { status: 'PUBLISHED' },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    include: {
      scheduleVersion: { include: { days: true } },
    },
  });
  if (!assignment) return null;

  const [expectation, exception] = await Promise.all([
    transaction.attendanceExpectation.upsert({
      where: {
        projectId_workerId_workDate: {
          projectId: safeProjectId,
          workerId: safeWorkerId,
          workDate: workDateValue,
        },
      },
      update: {},
      create: {
        projectId: safeProjectId,
        workerId: safeWorkerId,
        workDate: workDateValue,
      },
      include: {
        revisions: { orderBy: { revision: 'desc' }, take: 1 },
      },
    }),
    transaction.attendanceException.findUnique({
      where: {
        projectId_workerId_workDate: {
          projectId: safeProjectId,
          workerId: safeWorkerId,
          workDate: workDateValue,
        },
      },
      include: {
        revisions: { orderBy: { revision: 'desc' }, take: 1 },
      },
    }),
  ]);
  const currentRevision = expectation.revisions?.[0] || null;
  const nextRevision = Number(expectation.revision) + 1;
  const revision = buildAttendanceExpectationRevision({
    expectationId: expectation.id,
    revision: nextRevision,
    workDate: safeWorkDate,
    schedule: scheduleVersionShape(assignment.scheduleVersion),
    scheduleVersionId: assignment.scheduleVersion.id,
    scheduleDayId: assignment.scheduleVersion.days.find((day) => (
      day.isoWeekday === isoWeekday(safeWorkDate)
    ))?.id,
    exceptionRevision: exceptionShape(exception),
    classifierVersion: ATTENDANCE_CLASSIFIER_VERSION,
  });
  if (currentRevision?.policyHash === revision.policyHash) {
    return { ...expectation, currentRevision };
  }

  const updated = await transaction.attendanceExpectation.updateMany({
    where: {
      id: expectation.id,
      projectId: safeProjectId,
      workerId: safeWorkerId,
      revision: expectation.revision,
    },
    data: { revision: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw expectationError(
      'The attendance expectation changed concurrently.',
      'ATTENDANCE_EXPECTATION_CONCURRENT_MODIFICATION',
      409,
    );
  }
  const createdRevision = await transaction.attendanceExpectationRevision.create({
    data: {
      ...revision,
      projectId: safeProjectId,
      workerId: safeWorkerId,
      workDate: workDateValue,
    },
  });
  return {
    ...expectation,
    revision: nextRevision,
    currentRevision: createdRevision,
  };
}

async function closeOverlappingAssignments(transaction, {
  projectId,
  workerIds,
  effectiveFrom,
  actorId,
  now,
}) {
  if (workerIds.length === 0) return;
  const fromDate = databaseDate(effectiveFrom, 'effectiveFrom');
  const overlaps = await transaction.attendanceScheduleAssignment.findMany({
    where: {
      projectId,
      workerId: { in: workerIds },
      OR: [
        { effectiveThrough: null },
        { effectiveThrough: { gte: fromDate } },
      ],
    },
    select: { id: true, workerId: true, effectiveFrom: true },
  });
  const conflicting = overlaps.filter((assignment) => assignment.effectiveFrom >= fromDate);
  if (conflicting.length > 0) {
    throw expectationError(
      'A selected worker already has an assignment starting on or after this effective date.',
      'ATTENDANCE_ASSIGNMENT_CONFLICT',
      409,
      { workerIds: [...new Set(conflicting.map((item) => item.workerId))] },
    );
  }
  if (overlaps.length === 0) return;
  const effectiveThrough = databaseDate(shiftDateKey(effectiveFrom, -1));
  await transaction.attendanceScheduleAssignment.updateMany({
    where: { id: { in: overlaps.map((assignment) => assignment.id) } },
    data: {
      effectiveThrough,
      endedById: actorId,
      endedAt: now,
    },
  });
}

async function replayPublishedSchedule(transaction, idempotencyKey, fingerprint) {
  const version = await transaction.attendanceScheduleVersion.findUnique({
    where: { idempotencyKey },
    include: {
      days: true,
      schedule: true,
      assignments: { select: { workerId: true } },
    },
  });
  if (!version) return null;
  if (version.requestFingerprint !== fingerprint) {
    throw expectationError(
      'The idempotency key was already used with a different schedule request.',
      'ATTENDANCE_IDEMPOTENCY_CONFLICT',
      409,
    );
  }
  return {
    schedule: serializeAttendanceSchedule({ ...version.schedule, versions: [version] }),
    version: serializeAttendanceScheduleVersion(version),
    assignedWorkerIds: version.assignments.map((assignment) => assignment.workerId).sort(),
    replayed: true,
  };
}

export async function publishAttendanceSchedule(prisma, {
  scope: scopeInput,
  scheduleId: scheduleIdInput = null,
  expectedRevision: expectedRevisionInput = 0,
  idempotencyKey: rawIdempotencyKey,
  actorId: actorIdInput,
  now: nowInput,
  input,
} = {}) {
  const scope = requiredScope(scopeInput);
  const actorId = requiredText(actorIdInput, 'actorId', 180);
  const scheduleId = optionalText(scheduleIdInput, 'scheduleId', 180);
  const expectedRevision = boundedRevision(expectedRevisionInput);
  const now = trustedNow(nowInput);
  const initial = normalizePublishRequest(input, {
    version: expectedRevision + 1,
    publishedAt: now,
  });
  const target = scheduleId || `new:${initial.name.toLocaleLowerCase('es')}`;
  const idempotencyKey = attendanceScheduleIdempotencyKey({
    projectId: scope.projectId,
    scheduleId: target,
    operation: 'publish',
    idempotencyKey: rawIdempotencyKey,
  });
  const fingerprint = publishFingerprint({
    ...initial,
    expectedRevision,
  });

  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const replay = await replayPublishedSchedule(transaction, idempotencyKey, fingerprint);
    if (replay) return replay;

    let schedule = null;
    if (scheduleId) {
      schedule = await transaction.attendanceSchedule.findFirst({
        where: { id: scheduleId, projectId: scope.projectId, status: 'ACTIVE' },
      });
      if (!schedule) {
        throw expectationError('The attendance schedule was not found.', 'ATTENDANCE_SCHEDULE_NOT_FOUND', 404);
      }
      if (schedule.revision !== expectedRevision) {
        throw expectationError(
          'The attendance schedule changed before this version could be published.',
          'ATTENDANCE_SCHEDULE_CONCURRENT_MODIFICATION',
          409,
          { currentRevision: schedule.revision },
        );
      }
      if (schedule.name !== initial.name) {
        const duplicate = await transaction.attendanceSchedule.findFirst({
          where: { projectId: scope.projectId, name: initial.name, id: { not: schedule.id } },
          select: { id: true },
        });
        if (duplicate) {
          throw expectationError('A schedule with this name already exists.', 'ATTENDANCE_SCHEDULE_NAME_EXISTS', 409);
        }
      }
    } else {
      const duplicate = await transaction.attendanceSchedule.findUnique({
        where: { projectId_name: { projectId: scope.projectId, name: initial.name } },
        select: { id: true },
      });
      if (duplicate) {
        throw expectationError(
          'A schedule with this name already exists; send its id and revision to publish a new version.',
          'ATTENDANCE_SCHEDULE_NAME_EXISTS',
          409,
          { scheduleId: duplicate.id },
        );
      }
      if (expectedRevision !== 0) {
        throw expectationError('A new schedule must start at revision zero.', 'ATTENDANCE_REVISION_INVALID');
      }
    }

    const normalized = normalizePublishRequest(input, {
      version: expectedRevision + 1,
      publishedAt: now,
    });
    const localToday = localDateKey(now, normalized.schedule.timezone);
    if (normalized.schedule.effectiveFrom < localToday) {
      throw expectationError(
        'A new schedule version cannot become effective in the past.',
        'ATTENDANCE_SCHEDULE_RETROACTIVE_FORBIDDEN',
        409,
        { earliestEffectiveFrom: localToday },
      );
    }
    await assertWorkersBelongToProject(transaction, scope.projectId, normalized.workerIds);
    await assertScheduleIsNotRetroactiveToday(transaction, {
      projectId: scope.projectId,
      workerIds: normalized.workerIds,
      schedule: normalized.schedule,
      now,
    });

    if (!schedule) {
      schedule = await transaction.attendanceSchedule.create({
        data: {
          projectId: scope.projectId,
          name: normalized.name,
          status: 'ACTIVE',
          revision: 1,
        },
      });
    } else {
      const changed = await transaction.attendanceSchedule.updateMany({
        where: {
          id: schedule.id,
          projectId: scope.projectId,
          status: 'ACTIVE',
          revision: expectedRevision,
        },
        data: { name: normalized.name, revision: { increment: 1 } },
      });
      if (changed.count !== 1) {
        throw expectationError(
          'The attendance schedule changed before this version could be published.',
          'ATTENDANCE_SCHEDULE_CONCURRENT_MODIFICATION',
          409,
        );
      }
      schedule = { ...schedule, name: normalized.name, revision: expectedRevision + 1 };
    }

    const version = await transaction.attendanceScheduleVersion.create({
      data: {
        projectId: scope.projectId,
        scheduleId: schedule.id,
        version: normalized.schedule.version,
        effectiveFrom: databaseDate(normalized.schedule.effectiveFrom, 'effectiveFrom'),
        timezone: normalized.schedule.timezone,
        earlyCheckInMinutes: normalized.schedule.earlyCheckInMinutes,
        lateToleranceMinutes: normalized.schedule.lateToleranceMinutes,
        latePolicy: normalized.schedule.latePolicy,
        noShowAfterMinutes: normalized.schedule.noShowAfterMinutes,
        pendingCloseAfterMinutes: normalized.schedule.pendingCloseAfterMinutes,
        absenceFinalizeAfterMinutes: normalized.schedule.absenceFinalizeAfterMinutes,
        status: 'PUBLISHED',
        configHash: normalized.schedule.configHash,
        idempotencyKey,
        requestFingerprint: fingerprint,
        createdById: actorId,
        publishedAt: now,
        days: {
          create: normalized.schedule.days.map((day) => ({
            projectId: scope.projectId,
            isoWeekday: day.isoWeekday,
            isWorkingDay: day.isWorkingDay,
            startMinute: day.startMinute,
            endMinute: day.endMinute,
            endDayOffset: day.endDayOffset,
            expectedBreakMinutes: day.expectedBreakMinutes,
          })),
        },
      },
      include: { days: true },
    });

    await closeOverlappingAssignments(transaction, {
      projectId: scope.projectId,
      workerIds: normalized.workerIds,
      effectiveFrom: normalized.schedule.effectiveFrom,
      actorId,
      now,
    });
    if (normalized.workerIds.length > 0) {
      await transaction.attendanceScheduleAssignment.createMany({
        data: normalized.workerIds.map((workerId) => ({
          projectId: scope.projectId,
          workerId,
          scheduleVersionId: version.id,
          effectiveFrom: databaseDate(normalized.schedule.effectiveFrom, 'effectiveFrom'),
          reasonCode: 'SCHEDULE_PUBLISHED',
          idempotencyKey: scopedKey(
            'assignment',
            scope,
            rawIdempotencyKey,
            `${version.id}:${workerId}`,
          ),
          requestFingerprint: canonicalAttendanceHash({
            scheduleVersionId: version.id,
            workerId,
            effectiveFrom: normalized.schedule.effectiveFrom,
          }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:assignment-request`),
          createdById: actorId,
        })),
      });
    }

    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action: 'attendance.schedule.published',
        entityType: 'AttendanceScheduleVersion',
        entityId: version.id,
        metadata: {
          projectId: scope.projectId,
          scheduleId: schedule.id,
          scheduleRevision: schedule.revision,
          version: version.version,
          effectiveFrom: normalized.schedule.effectiveFrom,
          assignedWorkerCount: normalized.workerIds.length,
          configHash: version.configHash,
        },
      },
    });
    return {
      schedule: serializeAttendanceSchedule({ ...schedule, versions: [version] }),
      version: serializeAttendanceScheduleVersion(version),
      assignedWorkerIds: normalized.workerIds,
      replayed: false,
    };
  });
}

function normalizedExceptionInput(input) {
  const action = String(input?.action || 'SET').trim().toUpperCase();
  if (!['SET', 'CANCEL'].includes(action)) {
    throw expectationError('action must be SET or CANCEL.', 'ATTENDANCE_EXCEPTION_INVALID');
  }
  const type = action === 'SET'
    ? requiredText(input?.type, 'type', 64).toUpperCase()
    : null;
  if (type && !EXCEPTION_TYPES.has(type)) {
    throw expectationError('type is not a supported attendance exception.', 'ATTENDANCE_EXCEPTION_INVALID');
  }
  return {
    action,
    type,
    reasonCode: requiredText(input?.reasonCode, 'reasonCode', 64),
    note: optionalText(input?.note, 'note', 280),
  };
}

function serializeExceptionRevision(value, aggregate = null) {
  return {
    id: value.id,
    exceptionId: value.exceptionId,
    workerId: aggregate?.workerId || null,
    workDate: aggregate?.workDate?.toISOString?.().slice(0, 10) || null,
    revision: value.revision,
    action: value.action,
    type: value.type,
    reasonCode: value.reasonCode,
    note: value.note,
    createdAt: value.createdAt?.toISOString?.() || null,
  };
}

export async function setAttendanceException(prisma, {
  scope: scopeInput,
  workerId: workerIdInput,
  workDate: workDateInput,
  expectedRevision: expectedRevisionInput = 0,
  idempotencyKey: rawIdempotencyKey,
  actorId: actorIdInput,
  input,
} = {}) {
  const scope = requiredScope(scopeInput);
  const workerId = requiredText(workerIdInput, 'workerId', 180);
  const workDate = normalizedDateKey(workDateInput);
  const expectedRevision = boundedRevision(expectedRevisionInput);
  const actorId = requiredText(actorIdInput, 'actorId', 180);
  const normalized = normalizedExceptionInput(input);
  const idempotencyKey = scopedKey(
    'exception',
    scope,
    rawIdempotencyKey,
    `${workerId}:${workDate}`,
  );
  const fingerprint = canonicalAttendanceHash({
    workerId,
    workDate,
    expectedRevision,
    ...normalized,
  }, `${ATTENDANCE_SCHEDULE_CONTRACT_VERSION}:exception-request`);

  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const replay = await transaction.attendanceExceptionRevision.findUnique({
      where: { idempotencyKey },
      include: { exception: true },
    });
    if (replay) {
      if (replay.requestFingerprint !== fingerprint) {
        throw expectationError(
          'The idempotency key was already used with a different exception request.',
          'ATTENDANCE_IDEMPOTENCY_CONFLICT',
          409,
        );
      }
      return { exception: serializeExceptionRevision(replay, replay.exception), replayed: true };
    }

    const worker = await transaction.worker.findFirst({
      where: { id: workerId, projectId: scope.projectId },
      select: { id: true },
    });
    if (!worker) {
      throw expectationError('The worker was not found in this project.', 'ATTENDANCE_WORKER_NOT_FOUND', 404);
    }
    const aggregate = await transaction.attendanceException.upsert({
      where: {
        projectId_workerId_workDate: {
          projectId: scope.projectId,
          workerId,
          workDate: databaseDate(workDate),
        },
      },
      update: {},
      create: {
        projectId: scope.projectId,
        workerId,
        workDate: databaseDate(workDate),
      },
    });
    if (aggregate.revision !== expectedRevision) {
      throw expectationError(
        'The attendance exception changed before this update.',
        'ATTENDANCE_EXCEPTION_CONCURRENT_MODIFICATION',
        409,
        { currentRevision: aggregate.revision },
      );
    }
    const nextRevision = aggregate.revision + 1;
    const changed = await transaction.attendanceException.updateMany({
      where: {
        id: aggregate.id,
        projectId: scope.projectId,
        workerId,
        revision: expectedRevision,
      },
      data: {
        revision: { increment: 1 },
        active: normalized.action === 'SET',
        currentType: normalized.type,
      },
    });
    if (changed.count !== 1) {
      throw expectationError(
        'The attendance exception changed before this update.',
        'ATTENDANCE_EXCEPTION_CONCURRENT_MODIFICATION',
        409,
      );
    }
    const revision = await transaction.attendanceExceptionRevision.create({
      data: {
        projectId: scope.projectId,
        workerId,
        workDate: databaseDate(workDate),
        exceptionId: aggregate.id,
        revision: nextRevision,
        ...normalized,
        idempotencyKey,
        requestFingerprint: fingerprint,
        createdById: actorId,
      },
    });
    await materializeAttendanceExpectationInTransaction(transaction, {
      projectId: scope.projectId,
      workerId,
      workDate,
    });
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action: normalized.action === 'SET'
          ? 'attendance.exception.set'
          : 'attendance.exception.cancelled',
        entityType: 'AttendanceException',
        entityId: aggregate.id,
        metadata: {
          projectId: scope.projectId,
          workerId,
          workDate,
          revision: nextRevision,
          type: normalized.type,
          reasonCode: normalized.reasonCode,
        },
      },
    });
    return {
      exception: serializeExceptionRevision(revision, {
        ...aggregate,
        revision: nextRevision,
        active: normalized.action === 'SET',
        currentType: normalized.type,
      }),
      replayed: false,
    };
  });
}

export async function materializeAttendanceRange(prisma, {
  scope: scopeInput,
  fromDate: fromDateInput,
  throughDate: throughDateInput,
  workerIds: workerIdsInput = null,
  afterWorkerId: afterWorkerIdInput = null,
  maxWorkers: maxWorkersInput = DEFAULT_MATERIALIZATION_WORKERS,
} = {}) {
  const scope = requiredScope(scopeInput);
  const fromDate = normalizedDateKey(fromDateInput, 'fromDate');
  const throughDate = normalizedDateKey(throughDateInput, 'throughDate');
  if (throughDate < fromDate) {
    throw expectationError('throughDate must not precede fromDate.', 'ATTENDANCE_DATE_RANGE_INVALID');
  }
  const dates = [];
  for (let date = fromDate; date <= throughDate; date = shiftDateKey(date, 1)) {
    dates.push(date);
    if (dates.length > MAX_MATERIALIZATION_DAYS) {
      throw expectationError(
        `An attendance materialization range cannot exceed ${MAX_MATERIALIZATION_DAYS} days.`,
        'ATTENDANCE_DATE_RANGE_INVALID',
      );
    }
  }
  const selectedWorkerIds = workerIdsInput == null ? null : uniqueSortedIds(workerIdsInput);
  const afterWorkerId = optionalText(afterWorkerIdInput, 'afterWorkerId', 180);
  const maxWorkers = Math.min(
    MAX_MATERIALIZATION_WORKERS,
    Math.max(1, Math.trunc(Number(maxWorkersInput) || DEFAULT_MATERIALIZATION_WORKERS)),
  );
  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const workerPage = await transaction.worker.findMany({
      where: {
        projectId: scope.projectId,
        active: true,
        ...(selectedWorkerIds ? { id: { in: selectedWorkerIds } } : {}),
        ...(afterWorkerId ? { id: { gt: afterWorkerId } } : {}),
      },
      orderBy: { id: 'asc' },
      take: maxWorkers + 1,
      select: { id: true },
    });
    const hasMore = workerPage.length > maxWorkers;
    const workers = workerPage.slice(0, maxWorkers);
    let materialized = 0;
    for (const worker of workers) {
      for (const workDate of dates) {
        const result = await materializeAttendanceExpectationInTransaction(transaction, {
          projectId: scope.projectId,
          workerId: worker.id,
          workDate,
        });
        if (result) materialized += 1;
      }
    }
    return {
      workerCount: workers.length,
      dateCount: dates.length,
      materialized,
      hasMore,
      nextWorkerCursor: hasMore ? workers.at(-1)?.id || null : null,
    };
  });
}

export async function resolveAttendanceExpectationForCheckIn(transaction, {
  projectId,
  workerId,
  now: nowInput,
} = {}) {
  if (!transaction?.attendanceScheduleAssignment?.findMany) return null;
  const safeProjectId = requiredText(projectId, 'projectId', 180);
  const safeWorkerId = requiredText(workerId, 'workerId', 180);
  const now = trustedNow(nowInput);
  const utcDate = now.toISOString().slice(0, 10);
  const lowerDate = databaseDate(shiftDateKey(utcDate, -2));
  const upperDate = databaseDate(shiftDateKey(utcDate, 1));
  const assignments = await transaction.attendanceScheduleAssignment.findMany({
    where: {
      projectId: safeProjectId,
      workerId: safeWorkerId,
      effectiveFrom: { lte: upperDate },
      OR: [
        { effectiveThrough: null },
        { effectiveThrough: { gte: lowerDate } },
      ],
      scheduleVersion: { status: 'PUBLISHED' },
    },
    include: { scheduleVersion: { include: { days: true } } },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
    take: 8,
  });
  const workingCandidates = [];
  const fallbackCandidates = [];
  const visitedExpectations = new Set();
  for (const assignment of assignments) {
    const version = assignment.scheduleVersion;
    const localToday = localDateKey(now, version.timezone);
    for (const workDate of [shiftDateKey(localToday, -1), localToday]) {
      const date = databaseDate(workDate);
      if (assignment.effectiveFrom > date) continue;
      if (assignment.effectiveThrough && assignment.effectiveThrough < date) continue;
      const expectation = await materializeAttendanceExpectationInTransaction(transaction, {
        projectId: safeProjectId,
        workerId: safeWorkerId,
        workDate,
      });
      const revision = expectation?.currentRevision;
      if (!revision || visitedExpectations.has(expectation.id)) continue;
      visitedExpectations.add(expectation.id);
      const resolvedVersion = assignments.find((candidate) => (
        candidate.scheduleVersion.id === revision.scheduleVersionId
      ))?.scheduleVersion;
      if (!resolvedVersion) continue;
      if (revision.kind !== 'WORKING') {
        if (workDate === localToday) {
          fallbackCandidates.push({
            expectation,
            revision,
            version: resolvedVersion,
            workDate,
          });
        }
        continue;
      }
      const earliest = new Date(
        revision.expectedStartAt.getTime() - (resolvedVersion.earlyCheckInMinutes * 60_000),
      );
      if (now < earliest || now > revision.absenceAt) continue;
      workingCandidates.push({
        expectation,
        revision,
        version: resolvedVersion,
        workDate,
      });
    }
  }
  workingCandidates.sort((left, right) => {
    const leftDistance = Math.abs(now - left.revision.expectedStartAt);
    const rightDistance = Math.abs(now - right.revision.expectedStartAt);
    return leftDistance - rightDistance;
  });
  return workingCandidates[0] || fallbackCandidates[0] || null;
}

export function attendanceExpectationErrorResponse(error) {
  if (
    !(error instanceof AttendanceExpectationError)
    && !(error instanceof AttendanceScheduleDomainError)
  ) return null;
  return Response.json({
    error: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  }, { status: error.status || 400 });
}
