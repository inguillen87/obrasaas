import { ATTENDANCE_GEO_WINDOW_MS } from './attendance.js';
import { buildAttendancePeriodProjection } from './attendance-reporting.js';
import { lockProjectTransaction } from './project-write-policy.js';

export const DEFAULT_ATTENDANCE_EXPIRY_BATCH_SIZE = 100;
const MAX_ATTENDANCE_EXPIRY_BATCH_SIZE = 500;
const TRANSACTION_ATTEMPTS = 3;

function requiredId(value, field) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id || id.length > 190) {
    throw new TypeError(`${field} is required.`);
  }
  return id;
}

function trustedNow(value) {
  const now = value instanceof Date ? new Date(value) : new Date(value ?? Date.now());
  if (Number.isNaN(now.getTime())) throw new TypeError('now must be a valid timestamp.');
  return now;
}

function expiryCutoff(now) {
  return new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS);
}

function pendingEntryWhere({ projectId, workerId = null, cutoff, ids = null }) {
  return {
    projectId,
    ...(workerId ? { workerId } : {}),
    ...(ids ? { id: { in: ids } } : {}),
    shiftId: null,
    eventType: 'CHECK_IN',
    verificationStatus: 'PENDING',
    occurredAt: { lt: cutoff },
  };
}

function normalizedStatus(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isPendingGpsProjection(entry, workerId, { canonicalKey = false } = {}) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (!canonicalKey && entry.workerId !== workerId) return false;
  if (entry.workerId && entry.workerId !== workerId) return false;
  if (entry.lastEventType && entry.lastEventType !== 'CHECK_IN') return false;
  return normalizedStatus(entry.status).startsWith('gps pendiente');
}

function pendingGpsProjectionExists(attendance, worker) {
  if (!attendance || typeof attendance !== 'object' || Array.isArray(attendance)) return false;
  return isPendingGpsProjection(attendance[worker.id], worker.id, { canonicalKey: true })
    || (
      worker.name
      && worker.name !== worker.id
      && isPendingGpsProjection(attendance[worker.name], worker.id)
    );
}

function reconcilePendingGpsProjection(attendance, worker, restoredProjection) {
  if (!attendance || typeof attendance !== 'object' || Array.isArray(attendance)) return 0;
  let reconciled = 0;
  if (isPendingGpsProjection(attendance[worker.id], worker.id, { canonicalKey: true })) {
    if (restoredProjection) attendance[worker.id] = restoredProjection;
    else delete attendance[worker.id];
    reconciled += 1;
  }
  if (
    worker.name
    && worker.name !== worker.id
    && isPendingGpsProjection(attendance[worker.name], worker.id)
  ) {
    delete attendance[worker.name];
    if (restoredProjection && !attendance[worker.id]) {
      attendance[worker.id] = restoredProjection;
    }
    reconciled += 1;
  }
  return reconciled;
}

function finiteNumber(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function withValue(target, field, value) {
  if (value !== null && value !== undefined && value !== '') target[field] = value;
}

function canonicalSnapshotProjection(shift, worker) {
  const reportableEvents = (Array.isArray(shift?.events) ? shift.events : [])
    .filter((event) => ['VERIFIED', 'REVIEW_REQUIRED', 'NOT_REQUIRED'].includes(
      event.verificationStatus,
    ));
  if (reportableEvents.length === 0) return null;
  const rows = reportableEvents.map((event) => ({
    ...event,
    shift,
    worker,
  }));
  const summary = buildAttendancePeriodProjection(rows, { timeZone: shift.timezone })[0];
  if (!summary) return null;
  const lastEvent = reportableEvents.at(-1);
  const checkIn = reportableEvents.find((event) => event.eventType === 'CHECK_IN') || null;
  const projection = {
    workerId: worker.id,
    name: worker.name,
    role: worker.role || 'Cuadrilla de obra',
    status: shift.status === 'LEGACY_INCOMPLETE'
      ? summary.reviewRequired
        ? 'Registro histórico incompleto · revisar ubicación'
        : 'Registro histórico incompleto'
      : summary.status,
    shiftId: shift.id,
    // ProjectSnapshot exposes only operational UI states. A migrated,
    // incomplete legacy shift is terminal here while the canonical ledger
    // retains the more precise LEGACY_INCOMPLETE status.
    shiftState: 'CLOSED',
    lastEventType: lastEvent.eventType,
    reviewRequired: summary.reviewRequired,
  };
  withValue(projection, 'checkin', summary.checkin);
  withValue(projection, 'breakStartedAt', summary.breakStartedAt);
  withValue(projection, 'breakEndedAt', summary.breakEndedAt);
  withValue(projection, 'checkout', summary.checkout);
  withValue(projection, 'latitude', finiteNumber(checkIn?.latitude));
  withValue(projection, 'longitude', finiteNumber(checkIn?.longitude));
  withValue(projection, 'accuracy', finiteNumber(checkIn?.accuracyMeters));
  withValue(projection, 'distanceMeters', finiteNumber(checkIn?.distanceMeters));
  return projection;
}

async function latestCanonicalProjection(transaction, projectId, worker) {
  const shift = await transaction.attendanceShift.findFirst({
    where: {
      projectId,
      workerId: worker.id,
      status: { in: ['CLOSED', 'LEGACY_INCOMPLETE'] },
    },
    orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
    include: {
      events: {
        where: { verificationStatus: { in: ['VERIFIED', 'REVIEW_REQUIRED', 'NOT_REQUIRED'] } },
        orderBy: [{ sequence: 'asc' }, { occurredAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
  return canonicalSnapshotProjection(shift, worker);
}

function retryableTransactionError(error) {
  return error?.code === 'P2034';
}

function snapshotCasError() {
  const error = new Error('The attendance snapshot changed during expiry reconciliation.');
  error.code = 'P2034';
  return error;
}

async function runTransactionWithRetry(prisma, operation) {
  for (let attempt = 1; attempt <= TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: 'ReadCommitted',
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      if (!retryableTransactionError(error) || attempt === TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw new Error('Attendance expiry transaction retry loop exhausted.');
}

async function hasPendingEntry(transaction, { projectId, workerId, cutoff = null }) {
  return Boolean(await transaction.attendanceEntry.findFirst({
    where: {
      projectId,
      workerId,
      shiftId: null,
      eventType: 'CHECK_IN',
      verificationStatus: 'PENDING',
      ...(cutoff ? { occurredAt: { gte: cutoff } } : {}),
    },
    select: { id: true },
  }));
}

async function hasOpenShift(transaction, { projectId, workerId }) {
  return Boolean(await transaction.attendanceShift.findFirst({
    where: { projectId, workerId, status: 'OPEN' },
    select: { id: true },
  }));
}

async function reconcileExpiredWorkers(transaction, projectId, expiredWorkers) {
  if (expiredWorkers.size === 0) return 0;
  const snapshot = await transaction.projectSnapshot.findUnique({
    where: { projectId },
    select: { state: true, version: true },
  });
  if (!snapshot?.state || typeof snapshot.state !== 'object') return 0;

  const state = structuredClone(snapshot.state);
  const attendance = state.attendance;
  let reconciledProjections = 0;
  for (const worker of expiredWorkers.values()) {
    const scope = { projectId, workerId: worker.id };
    const [stillPending, openShift] = await Promise.all([
      hasPendingEntry(transaction, scope),
      hasOpenShift(transaction, scope),
    ]);
    if (stillPending || openShift) continue;
    if (!pendingGpsProjectionExists(attendance, worker)) continue;
    const restoredProjection = await latestCanonicalProjection(transaction, projectId, worker);
    reconciledProjections += reconcilePendingGpsProjection(
      attendance,
      worker,
      restoredProjection,
    );
  }
  if (reconciledProjections === 0) return 0;

  const updated = await transaction.projectSnapshot.updateMany({
    where: { projectId, version: snapshot.version },
    data: { state, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw snapshotCasError();
  return reconciledProjections;
}

async function expireLockedProjectEntries(transaction, {
  projectId,
  cutoff,
  workerId = null,
  entryIds = null,
}) {
  await lockProjectTransaction(transaction, projectId);
  const staleEntries = await transaction.attendanceEntry.findMany({
    where: pendingEntryWhere({ projectId, workerId, cutoff, ids: entryIds }),
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      workerId: true,
      worker: { select: { name: true, role: true } },
    },
  });
  const expiredWorkers = new Map();
  for (const entry of staleEntries) {
    expiredWorkers.set(entry.workerId, {
      id: entry.workerId,
      name: entry.worker?.name || null,
      role: entry.worker?.role || null,
    });
  }
  const expired = staleEntries.length > 0
    ? await transaction.attendanceEntry.updateMany({
        where: pendingEntryWhere({
          projectId,
          cutoff,
          ids: staleEntries.map((entry) => entry.id),
        }),
        data: { verificationStatus: 'EXPIRED', status: 'EXPIRED' },
      })
    : { count: 0 };
  const reconciledProjections = await reconcileExpiredWorkers(
    transaction,
    projectId,
    expired.count > 0 ? expiredWorkers : new Map(),
  );
  return { expiredCount: expired.count, reconciledProjections };
}

/**
 * Expires one worker's stale pending check-ins and reconciles the snapshot in
 * a separate committed transaction. Route handlers can safely return a domain
 * error afterwards without rolling this lifecycle transition back.
 */
export async function expirePendingAttendanceForWorker(prisma, {
  projectId: projectIdInput,
  workerId: workerIdInput,
  now: nowInput = new Date(),
}) {
  const projectId = requiredId(projectIdInput, 'projectId');
  const workerId = requiredId(workerIdInput, 'workerId');
  const now = trustedNow(nowInput);
  const cutoff = expiryCutoff(now);

  return runTransactionWithRetry(prisma, async (transaction) => {
    const result = await expireLockedProjectEntries(transaction, {
      projectId,
      workerId,
      cutoff,
    });
    const hasLivePending = await hasPendingEntry(transaction, {
      projectId,
      workerId,
      cutoff,
    });
    return { ...result, hasLivePending, cutoff: cutoff.toISOString() };
  });
}

function boundedBatchSize(value) {
  const size = Math.trunc(Number(value) || DEFAULT_ATTENDANCE_EXPIRY_BATCH_SIZE);
  return Math.min(MAX_ATTENDANCE_EXPIRY_BATCH_SIZE, Math.max(1, size));
}

function failureCode(error) {
  return String(error?.code || error?.name || 'ATTENDANCE_EXPIRY_FAILED').slice(0, 100);
}

/**
 * Advances stale pending GPS captures by server clock in a bounded batch. Each
 * project commits independently so one unhealthy tenant cannot block the rest.
 */
export async function expireStalePendingAttendanceBatch(prisma, {
  now: nowInput = new Date(),
  maxEntries: maxEntriesInput = DEFAULT_ATTENDANCE_EXPIRY_BATCH_SIZE,
} = {}) {
  const now = trustedNow(nowInput);
  const cutoff = expiryCutoff(now);
  const maxEntries = boundedBatchSize(maxEntriesInput);
  const candidates = await prisma.attendanceEntry.findMany({
    where: {
      shiftId: null,
      eventType: 'CHECK_IN',
      verificationStatus: 'PENDING',
      occurredAt: { lt: cutoff },
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    take: maxEntries,
    select: { id: true, projectId: true },
  });
  const entriesByProject = new Map();
  for (const candidate of candidates) {
    const projectEntries = entriesByProject.get(candidate.projectId) || [];
    projectEntries.push(candidate.id);
    entriesByProject.set(candidate.projectId, projectEntries);
  }

  let processedProjects = 0;
  let failedProjects = 0;
  let expiredCount = 0;
  let reconciledProjections = 0;
  const failureCodes = new Set();
  for (const [projectId, entryIds] of entriesByProject) {
    try {
      const result = await runTransactionWithRetry(prisma, (transaction) => (
        expireLockedProjectEntries(transaction, { projectId, cutoff, entryIds })
      ));
      processedProjects += 1;
      expiredCount += result.expiredCount;
      reconciledProjections += result.reconciledProjections;
    } catch (error) {
      failedProjects += 1;
      failureCodes.add(failureCode(error));
    }
  }

  let hasMore = failedProjects > 0;
  let backlogCheckFailed = false;
  try {
    hasMore = hasMore || Boolean(await prisma.attendanceEntry.findFirst({
      where: {
        shiftId: null,
        eventType: 'CHECK_IN',
        verificationStatus: 'PENDING',
        occurredAt: { lt: cutoff },
      },
      select: { id: true },
    }));
  } catch (error) {
    hasMore = true;
    backlogCheckFailed = true;
    failureCodes.add(failureCode(error));
  }

  return {
    scannedEntries: candidates.length,
    processedProjects,
    failedProjects,
    expiredCount,
    reconciledProjections,
    hasMore,
    backlogCheckFailed,
    failureCodes: [...failureCodes],
    cutoff: cutoff.toISOString(),
  };
}
