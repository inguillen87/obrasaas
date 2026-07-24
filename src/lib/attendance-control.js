import {
  ATTENDANCE_CLASSIFIER_VERSION,
  evaluateAttendanceDay,
  serializeAttendanceEvaluation,
} from './attendance-schedules.js';
import { ATTENDANCE_GEO_WINDOW_MS } from './attendance.js';
import {
  hashEffectiveAttendanceEvents,
  normalizeEffectiveAttendanceEvents,
} from './attendance-corrections.js';
import {
  AttendanceExpectationError,
  materializeAttendanceExpectationInTransaction,
  serializeAttendanceSchedule,
} from './attendance-expectations.js';
import { localDateKey, shiftDateKey } from './zoned-time.js';
import { runOperationalProjectMutation } from './project-write-policy.js';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';
const ALERT_TYPES = new Set(['NO_SHOW', 'PENDING_CLOSE']);
const MAX_SWEEP_WORKERS = 50;
const MAX_SWEEP_EXPECTATIONS = 250;
const DEFAULT_PROJECT_BATCH_SIZE = 4;
const MAX_PROJECT_BATCH_SIZE = 20;

export class AttendanceControlError extends Error {
  constructor(message, code = 'ATTENDANCE_CONTROL_INVALID', status = 400, details = null) {
    super(message);
    this.name = 'AttendanceControlError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function controlError(message, code, status = 400, details = null) {
  return new AttendanceControlError(message, code, status, details);
}

function requiredText(value, field, max = 190) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw controlError(`${field} is invalid.`, 'ATTENDANCE_CONTROL_INPUT_INVALID');
  }
  return text;
}

function trustedScope(scope) {
  return {
    organizationId: requiredText(scope?.organizationId, 'organizationId', 180),
    projectId: requiredText(scope?.projectId, 'projectId', 180),
  };
}

function trustedNow(value) {
  const now = value == null ? new Date() : new Date(value);
  if (Number.isNaN(now.getTime())) {
    throw controlError('now must be a valid timestamp.', 'ATTENDANCE_TIME_INVALID');
  }
  return now;
}

function dateKey(value, field = 'workDate') {
  const candidate = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (typeof candidate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
    throw controlError(`${field} must be a YYYY-MM-DD date.`, 'ATTENDANCE_DATE_INVALID');
  }
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate) {
    throw controlError(`${field} must be a real calendar date.`, 'ATTENDANCE_DATE_INVALID');
  }
  return candidate;
}

function dbDate(value) {
  return new Date(`${dateKey(value)}T00:00:00.000Z`);
}

function effectiveEventsForShift(shift) {
  const correction = [...(shift?.correctionRequests || [])]
    .filter((request) => (
      request.decision?.decision === 'APPROVED'
      && Array.isArray(request.adjustment?.effectiveEvents)
    ))
    .sort((left, right) => (
      Number(right.adjustment.appliedShiftRevision)
      - Number(left.adjustment.appliedShiftRevision)
      || new Date(right.adjustment.createdAt) - new Date(left.adjustment.createdAt)
      || String(right.adjustment.id).localeCompare(String(left.adjustment.id))
    ))[0];
  if (Array.isArray(correction?.adjustment?.effectiveEvents)) {
    if (
      hashEffectiveAttendanceEvents(correction.adjustment.effectiveEvents)
      !== correction.adjustment.effectiveHash
    ) {
      throw controlError(
        'The approved attendance adjustment failed its integrity check.',
        'ATTENDANCE_ADJUSTMENT_CORRUPT',
        500,
      );
    }
    const manualEvents = correction.adjustment.effectiveEvents.map((event, index) => ({
      id: event.logicalId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      sequence: index + 1,
      verificationStatus: 'MANUAL_APPROVED',
      origin: 'MANUAL_APPROVED',
    }));
    const baseLedgerSequence = Number(correction.adjustment.baseLedgerSequence) || 0;
    const laterLedgerEvents = (shift?.events || []).filter((event) => (
      Number(event.sequence) > baseLedgerSequence
    ));
    return [...manualEvents, ...laterLedgerEvents];
  }
  return shift?.events || [];
}

function latestAlertState(events, type) {
  const matching = [...(events || [])]
    .filter((event) => event.type === type)
    .sort((left, right) => {
      const time = new Date(left.occurredAt) - new Date(right.occurredAt);
      return time || String(left.id).localeCompare(String(right.id));
    });
  let opened = null;
  let acknowledged = null;
  for (const event of matching) {
    if (event.transition === 'OPENED') {
      opened = event;
      acknowledged = null;
    } else if (event.transition === 'ACKNOWLEDGED' && opened) {
      acknowledged = event;
    } else if (event.transition === 'RESOLVED') {
      opened = null;
      acknowledged = null;
    }
  }
  return {
    open: Boolean(opened),
    acknowledged: Boolean(acknowledged),
    openedEvent: opened,
    latestEvent: matching.at(-1) || null,
  };
}

function correctionBaseForShift(shift, effectiveEvents) {
  if (!shift) return null;
  try {
    const events = normalizeEffectiveAttendanceEvents(effectiveEvents.map((event, index) => ({
      logicalId: event.id || `effective:${index + 1}`,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
    })));
    return {
      available: true,
      effectiveHash: hashEffectiveAttendanceEvents(events),
      events,
    };
  } catch {
    return {
      available: false,
      effectiveHash: null,
      events: [],
    };
  }
}

function serializeAlertState(events) {
  return [...ALERT_TYPES].map((type) => {
    const state = latestAlertState(events, type);
    return {
      type,
      open: state.open,
      acknowledged: state.acknowledged,
      openedEventId: state.openedEvent?.id || null,
      openedAt: state.openedEvent?.occurredAt?.toISOString?.() || null,
      lastTransition: state.latestEvent?.transition || null,
      lastTransitionAt: state.latestEvent?.occurredAt?.toISOString?.() || null,
    };
  });
}

function attendanceDaySummary(rows) {
  const summary = {
    totalWorkers: rows.length,
    present: 0,
    late: 0,
    absent: 0,
    noShow: 0,
    pendingClose: 0,
    reviewRequired: 0,
    excused: 0,
    unscheduled: 0,
    expected: 0,
    openAlerts: 0,
  };
  for (const row of rows) {
    const key = {
      PRESENT: 'present',
      LATE: 'late',
      ABSENT: 'absent',
      NO_SHOW: 'noShow',
      PENDING_CLOSE: 'pendingClose',
      REVIEW_REQUIRED: 'reviewRequired',
      EXCUSED: 'excused',
      UNSCHEDULED: 'unscheduled',
      EXPECTED: 'expected',
    }[row.evaluation.classification];
    if (key) summary[key] += 1;
    summary.openAlerts += row.alerts.filter((alert) => alert.open).length;
  }
  return summary;
}

function currentRevision(expectation) {
  return expectation?.revisions?.[0] || null;
}

function attendanceRow({ worker, expectation, shift, exception, pendingEvents, now, workDate }) {
  const revision = currentRevision(expectation);
  const events = shift ? effectiveEventsForShift(shift) : pendingEvents;
  const evaluation = evaluateAttendanceDay({
    expectationRevision: revision,
    events,
    shift,
    asOf: now,
    workDate,
  });
  return {
    worker: {
      id: worker.id,
      name: worker.name,
      role: worker.role || null,
      active: worker.active,
    },
    expectation: expectation
      ? {
          id: expectation.id,
          revision: expectation.revision,
          kind: revision?.kind || null,
          policyHash: revision?.policyHash || null,
        }
      : null,
    shift: shift
      ? {
          id: shift.id,
          status: shift.status,
          phase: shift.phase,
          revision: shift.revision,
          openedAt: shift.openedAt?.toISOString?.() || null,
          closedAt: shift.closedAt?.toISOString?.() || null,
          hasApprovedCorrection: shift.correctionRequests?.some((request) => (
            request.decision?.decision === 'APPROVED' && request.adjustment
          )) || false,
          pendingCorrectionCount: shift.correctionRequests?.filter((request) => (
            !request.decision && request.expiresAt > now
          )).length || 0,
          correctionBase: correctionBaseForShift(shift, events),
        }
      : null,
    exception: exception?.active
      ? {
          id: exception.id,
          revision: exception.revision,
          type: exception.currentType,
          reasonCode: exception.revisions?.[0]?.reasonCode || null,
        }
      : null,
    evaluation: serializeAttendanceEvaluation(evaluation),
    alerts: serializeAlertState(expectation?.alertEvents || []),
  };
}

export async function loadAttendanceControlDay(prisma, {
  scope: scopeInput,
  workDate: workDateInput = null,
  now: nowInput,
} = {}) {
  const scope = trustedScope(scopeInput);
  const now = trustedNow(nowInput);
  const latestVersion = await prisma.attendanceScheduleVersion.findFirst({
    where: { projectId: scope.projectId, status: 'PUBLISHED' },
    orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
    select: { timezone: true },
  });
  const timezone = latestVersion?.timezone || DEFAULT_TIMEZONE;
  const workDate = workDateInput
    ? dateKey(workDateInput)
    : localDateKey(now, timezone);
  const workDateValue = dbDate(workDate);
  const pendingWindowStart = new Date(workDateValue.getTime() - (14 * 60 * 60 * 1_000));
  const pendingWindowEnd = new Date(workDateValue.getTime() + (38 * 60 * 60 * 1_000));

  const [workers, expectations, shifts, exceptions, pendingEntries, schedules] = await Promise.all([
    prisma.worker.findMany({
      where: { projectId: scope.projectId, active: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, role: true, active: true },
    }),
    prisma.attendanceExpectation.findMany({
      where: { projectId: scope.projectId, workDate: workDateValue },
      include: {
        revisions: { orderBy: { revision: 'desc' }, take: 1 },
        alertEvents: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
      },
    }),
    prisma.attendanceShift.findMany({
      where: { projectId: scope.projectId, workDate: workDateValue },
      include: {
        events: { orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }] },
        correctionRequests: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: { decision: true, adjustment: true },
        },
      },
    }),
    prisma.attendanceException.findMany({
      where: { projectId: scope.projectId, workDate: workDateValue },
      include: { revisions: { orderBy: { revision: 'desc' }, take: 1 } },
    }),
    prisma.attendanceEntry.findMany({
      where: {
        projectId: scope.projectId,
        shiftId: null,
        eventType: 'CHECK_IN',
        verificationStatus: 'PENDING',
        occurredAt: { gte: pendingWindowStart, lt: pendingWindowEnd },
      },
      orderBy: { occurredAt: 'desc' },
    }),
    prisma.attendanceSchedule.findMany({
      where: { projectId: scope.projectId, status: 'ACTIVE' },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { version: 'desc' },
          take: 1,
          include: { days: true },
        },
      },
    }),
  ]);

  const expectationByWorker = new Map(expectations.map((item) => [item.workerId, item]));
  const shiftByWorker = new Map(shifts.map((item) => [item.workerId, item]));
  const exceptionByWorker = new Map(exceptions.map((item) => [item.workerId, item]));
  const pendingByWorker = new Map();
  for (const entry of pendingEntries) {
    if (!pendingByWorker.has(entry.workerId)) pendingByWorker.set(entry.workerId, []);
    pendingByWorker.get(entry.workerId).push(entry);
  }
  const rows = workers.map((worker) => attendanceRow({
    worker,
    expectation: expectationByWorker.get(worker.id) || null,
    shift: shiftByWorker.get(worker.id) || null,
    exception: exceptionByWorker.get(worker.id) || null,
    pendingEvents: pendingByWorker.get(worker.id) || [],
    now,
    workDate,
  }));
  return {
    workDate,
    timezone,
    generatedAt: now.toISOString(),
    summary: attendanceDaySummary(rows),
    rows,
    schedules: schedules.map(serializeAttendanceSchedule),
  };
}

async function appendAlertEvent(transaction, {
  expectation,
  expectationRevision,
  shift,
  type,
  transition,
  dedupeKey,
  causationId = null,
  actorId = null,
  now,
  payload = null,
}) {
  await transaction.attendanceAlertEvent.createMany({
    data: [{
        projectId: expectation.projectId,
        workerId: expectation.workerId,
        expectationId: expectation.id,
        expectationRevisionId: expectationRevision.id,
        shiftId: shift?.id || null,
        type,
        transition,
        dedupeKey,
        causationId,
        classifierVersion: expectationRevision.classifierVersion,
        payload,
        actorId,
        occurredAt: now,
      }],
    skipDuplicates: true,
  });
  return transaction.attendanceAlertEvent.findUnique({ where: { dedupeKey } });
}

async function reconcileAlert(transaction, {
  expectation,
  revision,
  shift,
  type,
  shouldOpen,
  now,
  evaluation,
}) {
  const state = latestAlertState(expectation.alertEvents, type);
  if (shouldOpen && !state.open) {
    const dedupeKey = `attendance:alert:v1:${revision.id}:${type}:opened`;
    const event = await appendAlertEvent(transaction, {
      expectation,
      expectationRevision: revision,
      shift,
      type,
      transition: 'OPENED',
      dedupeKey,
      now,
      payload: {
        classification: evaluation.classification,
        workDate: expectation.workDate.toISOString().slice(0, 10),
        expectedStartAt: revision.expectedStartAt?.toISOString?.() || null,
        expectedEndAt: revision.expectedEndAt?.toISOString?.() || null,
      },
    });
    expectation.alertEvents.push(event);
    return 'opened';
  }
  if (!shouldOpen && state.open) {
    const dedupeKey = `${state.openedEvent.dedupeKey}:resolved`;
    const event = await appendAlertEvent(transaction, {
      expectation,
      expectationRevision: revision,
      shift,
      type,
      transition: 'RESOLVED',
      dedupeKey,
      causationId: state.openedEvent.id,
      now,
      payload: { classification: evaluation.classification },
    });
    expectation.alertEvents.push(event);
    return 'resolved';
  }
  return 'unchanged';
}

function candidateDatesForVersion(now, timezone) {
  const today = localDateKey(now, timezone);
  return [shiftDateKey(today, -1), today];
}

export async function runAttendanceAutomationSweep(prisma, {
  scope: scopeInput,
  now: nowInput,
} = {}) {
  const scope = trustedScope(scopeInput);
  const now = trustedNow(nowInput);
  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const workerWhere = { projectId: scope.projectId, active: true };
    const eligibleWorkerCount = await transaction.worker.count({ where: workerWhere });
    const workerOffset = eligibleWorkerCount === 0
      ? 0
      : (Math.floor(now.getTime() / 60_000) * MAX_SWEEP_WORKERS) % eligibleWorkerCount;
    const workerSelect = {
      id: true,
      attendanceScheduleAssignments: {
        where: {
          scheduleVersion: { status: 'PUBLISHED' },
        },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        take: 4,
        include: { scheduleVersion: { select: { timezone: true } } },
      },
    };
    const firstWorkers = await transaction.worker.findMany({
      where: workerWhere,
      orderBy: { id: 'asc' },
      skip: workerOffset,
      take: MAX_SWEEP_WORKERS,
      select: workerSelect,
    });
    let workers = firstWorkers;
    if (firstWorkers.length < MAX_SWEEP_WORKERS && eligibleWorkerCount > firstWorkers.length) {
      const wrappedWorkers = await transaction.worker.findMany({
        where: workerWhere,
        orderBy: { id: 'asc' },
        take: Math.min(
          MAX_SWEEP_WORKERS - firstWorkers.length,
          eligibleWorkerCount - firstWorkers.length,
        ),
        select: workerSelect,
      });
      const seenWorkerIds = new Set(firstWorkers.map((worker) => worker.id));
      workers = [
        ...firstWorkers,
        ...wrappedWorkers.filter((worker) => !seenWorkerIds.has(worker.id)),
      ];
    }
    const dateWorkerPairs = new Set();
    for (const worker of workers) {
      for (const assignment of worker.attendanceScheduleAssignments) {
        for (const workDate of candidateDatesForVersion(now, assignment.scheduleVersion.timezone)) {
          const date = dbDate(workDate);
          if (assignment.effectiveFrom > date) continue;
          if (assignment.effectiveThrough && assignment.effectiveThrough < date) continue;
          dateWorkerPairs.add(`${worker.id}\0${workDate}`);
        }
      }
    }
    let materialized = 0;
    for (const pair of dateWorkerPairs) {
      const [workerId, workDate] = pair.split('\0');
      const value = await materializeAttendanceExpectationInTransaction(transaction, {
        projectId: scope.projectId,
        workerId,
        workDate,
      });
      if (value) materialized += 1;
    }

    const candidateDates = [...new Set(
      [...dateWorkerPairs].map((pair) => pair.split('\0')[1]),
    )].map(dbDate);
    if (candidateDates.length === 0) {
      return {
        workerCount: workers.length,
        materialized,
        evaluated: 0,
        shiftsMarkedPendingClose: 0,
        alertsOpened: 0,
        alertsResolved: 0,
        hasMoreWorkers: eligibleWorkerCount > workers.length,
        hasMoreExpectations: false,
      };
    }
    const [expectations, pendingEntries] = await Promise.all([
      transaction.attendanceExpectation.findMany({
      where: {
        projectId: scope.projectId,
        workerId: { in: workers.map((worker) => worker.id) },
        workDate: { in: candidateDates },
      },
      orderBy: [{ workDate: 'asc' }, { workerId: 'asc' }],
      take: MAX_SWEEP_EXPECTATIONS,
      include: {
        revisions: { orderBy: { revision: 'desc' }, take: 1 },
        shift: {
          include: {
            events: { orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }] },
            correctionRequests: {
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              include: { decision: true, adjustment: true },
            },
          },
        },
        alertEvents: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
      },
      }),
      transaction.attendanceEntry.findMany({
        where: {
          projectId: scope.projectId,
          workerId: { in: workers.map((worker) => worker.id) },
          shiftId: null,
          eventType: 'CHECK_IN',
          verificationStatus: 'PENDING',
          occurredAt: {
            gte: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS),
            lte: now,
          },
        },
        orderBy: { occurredAt: 'desc' },
      }),
    ]);
    const pendingByWorker = new Map();
    for (const entry of pendingEntries) {
      if (!pendingByWorker.has(entry.workerId)) pendingByWorker.set(entry.workerId, []);
      pendingByWorker.get(entry.workerId).push(entry);
    }
    let shiftsMarkedPendingClose = 0;
    let alertsOpened = 0;
    let alertsResolved = 0;
    for (const expectation of expectations) {
      const revision = currentRevision(expectation);
      if (!revision) continue;
      const shift = expectation.shift;
      const evaluation = evaluateAttendanceDay({
        expectationRevision: revision,
        events: shift
          ? effectiveEventsForShift(shift)
          : (pendingByWorker.get(expectation.workerId) || []),
        shift,
        asOf: now,
        workDate: expectation.workDate.toISOString().slice(0, 10),
      });
      if (
        evaluation.lifecycle === 'PENDING_CLOSE'
        && shift?.status === 'OPEN'
        && shift.phase === 'WORKING'
      ) {
        const changed = await transaction.attendanceShift.updateMany({
          where: {
            id: shift.id,
            projectId: scope.projectId,
            workerId: expectation.workerId,
            status: 'OPEN',
            phase: 'WORKING',
            revision: shift.revision,
          },
          data: { status: 'PENDING_CLOSE', revision: { increment: 1 } },
        });
        if (changed.count === 1) {
          shift.status = 'PENDING_CLOSE';
          shift.revision += 1;
          shiftsMarkedPendingClose += 1;
        }
      }
      const results = [];
      results.push(await reconcileAlert(transaction, {
          expectation,
          revision,
          shift,
          type: 'NO_SHOW',
          shouldOpen: ['NO_SHOW', 'ABSENT'].includes(evaluation.lifecycle),
          now,
          evaluation,
        }));
      results.push(await reconcileAlert(transaction, {
          expectation,
          revision,
          shift,
          type: 'PENDING_CLOSE',
          shouldOpen: evaluation.lifecycle === 'PENDING_CLOSE',
          now,
          evaluation,
        }));
      alertsOpened += results.filter((result) => result === 'opened').length;
      alertsResolved += results.filter((result) => result === 'resolved').length;
    }
    return {
      workerCount: workers.length,
      materialized,
      evaluated: expectations.length,
      shiftsMarkedPendingClose,
      alertsOpened,
      alertsResolved,
      hasMoreWorkers: eligibleWorkerCount > workers.length,
      hasMoreExpectations: expectations.length === MAX_SWEEP_EXPECTATIONS,
    };
  });
}

export async function runAttendanceAutomationBatch(prisma, {
  now: nowInput,
  maxProjects: maxProjectsInput = DEFAULT_PROJECT_BATCH_SIZE,
} = {}) {
  const now = trustedNow(nowInput);
  const maxProjects = Math.min(
    MAX_PROJECT_BATCH_SIZE,
    Math.max(1, Math.trunc(Number(maxProjectsInput) || DEFAULT_PROJECT_BATCH_SIZE)),
  );
  const eligibleWhere = {
    status: { in: ['PLANNING', 'ACTIVE', 'PAUSED'] },
    attendanceScheduleVersions: { some: { status: 'PUBLISHED' } },
  };
  const eligibleProjects = await prisma.project.count({ where: eligibleWhere });
  if (eligibleProjects === 0) {
    return {
      eligibleProjects: 0,
      processedProjects: 0,
      failedProjects: 0,
      hasMore: false,
      totals: {
        materialized: 0,
        evaluated: 0,
        shiftsMarkedPendingClose: 0,
        alertsOpened: 0,
        alertsResolved: 0,
      },
      failureCodes: [],
    };
  }
  // Rotate a bounded window every minute so a large tenant set cannot leave
  // later projects permanently behind without introducing a mutable cursor.
  const minuteBucket = Math.floor(now.getTime() / 60_000);
  const offset = (minuteBucket * maxProjects) % eligibleProjects;
  const first = await prisma.project.findMany({
    where: eligibleWhere,
    orderBy: { id: 'asc' },
    skip: offset,
    take: maxProjects,
    select: { id: true, organizationId: true },
  });
  let projects = first;
  if (first.length < maxProjects && eligibleProjects > first.length) {
    const wrapped = await prisma.project.findMany({
      where: eligibleWhere,
      orderBy: { id: 'asc' },
      take: Math.min(maxProjects - first.length, eligibleProjects - first.length),
      select: { id: true, organizationId: true },
    });
    const seen = new Set(first.map((project) => project.id));
    projects = [...first, ...wrapped.filter((project) => !seen.has(project.id))];
  }
  const totals = {
    materialized: 0,
    evaluated: 0,
    shiftsMarkedPendingClose: 0,
    alertsOpened: 0,
    alertsResolved: 0,
  };
  const failureCodes = [];
  let failedProjects = 0;
  for (const project of projects) {
    try {
      const result = await runAttendanceAutomationSweep(prisma, {
        scope: {
          organizationId: project.organizationId,
          projectId: project.id,
        },
        now,
      });
      for (const key of Object.keys(totals)) totals[key] += Number(result[key]) || 0;
    } catch (error) {
      failedProjects += 1;
      const code = String(error?.code || error?.name || 'ATTENDANCE_AUTOMATION_FAILED')
        .slice(0, 100);
      if (!failureCodes.includes(code)) failureCodes.push(code);
      console.error('Attendance automation project failed:', {
        code: error?.code,
        name: error?.name,
        status: error?.status,
      });
    }
  }
  return {
    eligibleProjects,
    processedProjects: projects.length - failedProjects,
    failedProjects,
    hasMore: eligibleProjects > projects.length,
    totals,
    failureCodes,
  };
}

export async function acknowledgeAttendanceAlert(prisma, {
  scope: scopeInput,
  alertEventId: alertEventIdInput,
  actorId: actorIdInput,
  now: nowInput,
} = {}) {
  const scope = trustedScope(scopeInput);
  const alertEventId = requiredText(alertEventIdInput, 'alertEventId', 180);
  const actorId = requiredText(actorIdInput, 'actorId', 180);
  const now = trustedNow(nowInput);
  return runOperationalProjectMutation(prisma, scope, async (transaction) => {
    const opened = await transaction.attendanceAlertEvent.findFirst({
      where: {
        id: alertEventId,
        projectId: scope.projectId,
        transition: 'OPENED',
      },
      include: {
        expectation: {
          include: {
            revisions: { orderBy: { revision: 'desc' }, take: 1 },
            alertEvents: { orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] },
          },
        },
        shift: true,
      },
    });
    if (!opened) {
      throw controlError('The open attendance alert was not found.', 'ATTENDANCE_ALERT_NOT_FOUND', 404);
    }
    const state = latestAlertState(opened.expectation.alertEvents, opened.type);
    if (!state.open || state.openedEvent?.id !== opened.id) {
      throw controlError('The attendance alert is no longer open.', 'ATTENDANCE_ALERT_NOT_OPEN', 409);
    }
    if (state.acknowledged) {
      return { alertEventId: state.latestEvent.id, replayed: true };
    }
    const revision = currentRevision(opened.expectation);
    if (!revision) {
      throw new AttendanceExpectationError(
        'The attendance expectation has no current revision.',
        'ATTENDANCE_EXPECTATION_INVALID',
        409,
      );
    }
    const event = await appendAlertEvent(transaction, {
      expectation: opened.expectation,
      expectationRevision: revision,
      shift: opened.shift,
      type: opened.type,
      transition: 'ACKNOWLEDGED',
      dedupeKey: `${opened.dedupeKey}:acknowledged`,
      causationId: opened.id,
      actorId,
      now,
      payload: { acknowledgedBy: actorId },
    });
    await transaction.auditLog.create({
      data: {
        organizationId: scope.organizationId,
        actorId,
        action: 'attendance.alert.acknowledged',
        entityType: 'AttendanceAlertEvent',
        entityId: event.id,
        metadata: {
          projectId: scope.projectId,
          openedEventId: opened.id,
          alertType: opened.type,
          workerId: opened.workerId,
        },
      },
    });
    return { alertEventId: event.id, replayed: false };
  });
}

export function attendanceControlErrorResponse(error) {
  if (!(error instanceof AttendanceControlError)) return null;
  return Response.json({
    error: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  }, { status: error.status });
}

export const ATTENDANCE_AUTOMATION_CLASSIFIER_VERSION = ATTENDANCE_CLASSIFIER_VERSION;
