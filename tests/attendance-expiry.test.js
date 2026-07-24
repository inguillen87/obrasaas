import assert from 'node:assert/strict';
import test from 'node:test';

import {
  expirePendingAttendanceForWorker,
  expireStalePendingAttendanceBatch,
} from '../src/lib/attendance-expiry.js';
import { ATTENDANCE_GEO_WINDOW_MS } from '../src/lib/attendance.js';

const projectId = 'project-expiry';
const workerA = Object.freeze({ id: 'worker-a', name: 'Ana Obra' });
const workerB = Object.freeze({ id: 'worker-b', name: 'Bruno Obra' });

function pendingEntry({ id, worker, occurredAt }) {
  return {
    id,
    projectId,
    workerId: worker.id,
    shiftId: null,
    eventType: 'CHECK_IN',
    verificationStatus: 'PENDING',
    status: 'PENDING_GEO',
    occurredAt: new Date(occurredAt),
  };
}

function value(value) {
  if (value instanceof Date) return value.getTime();
  return value;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    const actual = row[field];
    if (
      expected
      && typeof expected === 'object'
      && !Array.isArray(expected)
      && !(expected instanceof Date)
    ) {
      if (Object.hasOwn(expected, 'in') && !expected.in.includes(actual)) return false;
      if (Object.hasOwn(expected, 'lt') && value(actual) >= value(expected.lt)) return false;
      if (Object.hasOwn(expected, 'gte') && value(actual) < value(expected.gte)) return false;
      return true;
    }
    return value(actual) === value(expected);
  });
}

function selectEntry(row, select, workers) {
  if (!select) return structuredClone(row);
  const result = {};
  for (const [field, requested] of Object.entries(select)) {
    if (!requested) continue;
    if (field === 'worker') {
      const worker = workers.get(row.workerId);
      result.worker = worker
        ? Object.fromEntries(
            Object.keys(requested.select || {})
              .filter((key) => requested.select[key])
              .map((key) => [key, worker[key]]),
          )
        : null;
    } else {
      result[field] = structuredClone(row[field]);
    }
  }
  return result;
}

function createExpiryDatabase({
  entries = [],
  shifts = [],
  attendance = {},
  snapshotVersion = 1,
  snapshotCasFailures = 0,
} = {}) {
  const workers = new Map([workerA, workerB].map((worker) => [worker.id, worker]));
  const database = {
    entries: structuredClone(entries),
    shifts: structuredClone(shifts),
    state: { attendance: structuredClone(attendance), tasks: {}, incidents: [] },
    snapshotVersion,
    locks: 0,
    transactions: 0,
    snapshotCasFailures,
  };

  const prisma = {
    async $executeRawUnsafe() {
      database.locks += 1;
      return 1;
    },
    async $transaction(callback) {
      database.transactions += 1;
      const backup = {
        entries: structuredClone(database.entries),
        shifts: structuredClone(database.shifts),
        state: structuredClone(database.state),
        snapshotVersion: database.snapshotVersion,
      };
      try {
        return await callback(prisma);
      } catch (error) {
        database.entries = backup.entries;
        database.shifts = backup.shifts;
        database.state = backup.state;
        database.snapshotVersion = backup.snapshotVersion;
        throw error;
      }
    },
    attendanceEntry: {
      async findMany({ where, orderBy, take, select } = {}) {
        const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        const rows = database.entries
          .filter((row) => matches(row, where))
          .sort((left, right) => {
            for (const clause of clauses) {
              const [field, direction] = Object.entries(clause)[0];
              const leftValue = value(left[field]);
              const rightValue = value(right[field]);
              if (leftValue === rightValue) continue;
              const comparison = leftValue < rightValue ? -1 : 1;
              return direction === 'desc' ? -comparison : comparison;
            }
            return 0;
          });
        return rows
          .slice(0, take == null ? rows.length : take)
          .map((row) => selectEntry(row, select, workers));
      },
      async findFirst({ where, select } = {}) {
        const row = database.entries.find((candidate) => matches(candidate, where));
        return row ? selectEntry(row, select, workers) : null;
      },
      async updateMany({ where, data }) {
        const rows = database.entries.filter((row) => matches(row, where));
        for (const row of rows) Object.assign(row, structuredClone(data));
        return { count: rows.length };
      },
    },
    attendanceShift: {
      async findFirst({ where, select, include, orderBy } = {}) {
        const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        const row = database.shifts
          .filter((candidate) => matches(candidate, where))
          .sort((left, right) => {
            for (const clause of clauses) {
              const [field, direction] = Object.entries(clause)[0];
              const leftValue = value(left[field]);
              const rightValue = value(right[field]);
              if (leftValue === rightValue) continue;
              const comparison = leftValue < rightValue ? -1 : 1;
              return direction === 'desc' ? -comparison : comparison;
            }
            return 0;
          })[0];
        if (!row) return null;
        if (include?.events) {
          const events = database.entries
            .filter((entry) => entry.shiftId === row.id && matches(entry, include.events.where))
            .sort((left, right) => {
              for (const clause of include.events.orderBy || []) {
                const [field, direction] = Object.entries(clause)[0];
                const leftValue = value(left[field]);
                const rightValue = value(right[field]);
                if (leftValue === rightValue) continue;
                const comparison = leftValue < rightValue ? -1 : 1;
                return direction === 'desc' ? -comparison : comparison;
              }
              return 0;
            });
          return { ...structuredClone(row), events: structuredClone(events) };
        }
        if (!select) return structuredClone(row);
        return Object.fromEntries(
          Object.keys(select).filter((key) => select[key]).map((key) => [key, row[key]]),
        );
      },
    },
    projectSnapshot: {
      async findUnique({ where }) {
        if (where.projectId !== projectId) return null;
        return {
          state: structuredClone(database.state),
          version: database.snapshotVersion,
        };
      },
      async updateMany({ where, data }) {
        if (database.snapshotCasFailures > 0) {
          database.snapshotCasFailures -= 1;
          return { count: 0 };
        }
        if (where.projectId !== projectId || where.version !== database.snapshotVersion) {
          return { count: 0 };
        }
        database.state = structuredClone(data.state);
        database.snapshotVersion += Number(data.version?.increment || 0);
        return { count: 1 };
      },
    },
  };

  return {
    prisma,
    snapshot() {
      return structuredClone(database);
    },
  };
}

test('cron expiry advances stale GPS captures without a second user action and is idempotent', async () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const staleAt = new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1);
  const database = createExpiryDatabase({
    entries: [pendingEntry({ id: 'pending-a', worker: workerA, occurredAt: staleAt })],
    attendance: {
      [workerA.id]: {
        workerId: workerA.id,
        name: workerA.name,
        checkin: '06:59',
        status: 'GPS pendiente',
        lastEventType: 'CHECK_IN',
      },
      [workerB.id]: {
        workerId: workerB.id,
        name: workerB.name,
        checkin: '08:00',
        status: 'Presente (ubicaciÃ³n informada)',
        shiftId: 'real-shift-b',
        shiftState: 'WORKING',
      },
    },
  });

  const first = await expireStalePendingAttendanceBatch(database.prisma, { now, maxEntries: 10 });
  assert.equal(first.expiredCount, 1);
  assert.equal(first.reconciledProjections, 1);
  assert.equal(first.hasMore, false);
  const afterFirst = database.snapshot();
  assert.equal(afterFirst.entries[0].verificationStatus, 'EXPIRED');
  assert.equal(afterFirst.entries[0].status, 'EXPIRED');
  assert.equal(afterFirst.state.attendance[workerA.id], undefined);
  assert.equal(afterFirst.state.attendance[workerB.id].shiftId, 'real-shift-b');
  assert.equal(afterFirst.snapshotVersion, 2);

  const retry = await expireStalePendingAttendanceBatch(database.prisma, { now, maxEntries: 10 });
  assert.equal(retry.expiredCount, 0);
  assert.equal(retry.reconciledProjections, 0);
  assert.equal(database.snapshot().snapshotVersion, 2);
});

test('expiry uses a strict server-clock boundary and advances after the clock moves', async () => {
  const startedAt = new Date('2026-07-23T08:00:00.000Z');
  const database = createExpiryDatabase({
    entries: [pendingEntry({ id: 'boundary-a', worker: workerA, occurredAt: startedAt })],
    attendance: {
      [workerA.id]: { workerId: workerA.id, status: 'GPS pendiente', lastEventType: 'CHECK_IN' },
    },
  });

  const boundary = await expirePendingAttendanceForWorker(database.prisma, {
    projectId,
    workerId: workerA.id,
    now: new Date(startedAt.getTime() + ATTENDANCE_GEO_WINDOW_MS),
  });
  assert.equal(boundary.expiredCount, 0);
  assert.equal(boundary.hasLivePending, true);
  assert.equal(database.snapshot().entries[0].verificationStatus, 'PENDING');

  const advanced = await expirePendingAttendanceForWorker(database.prisma, {
    projectId,
    workerId: workerA.id,
    now: new Date(startedAt.getTime() + ATTENDANCE_GEO_WINDOW_MS + 1),
  });
  assert.equal(advanced.expiredCount, 1);
  assert.equal(advanced.hasLivePending, false);
  assert.equal(database.snapshot().state.attendance[workerA.id], undefined);
});

test('an expired old capture cannot remove a newer pending projection or a real journey', async () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const database = createExpiryDatabase({
    entries: [
      pendingEntry({
        id: 'stale-a',
        worker: workerA,
        occurredAt: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1),
      }),
      pendingEntry({
        id: 'fresh-a',
        worker: workerA,
        occurredAt: new Date(now.getTime() - 60_000),
      }),
      pendingEntry({
        id: 'stale-b',
        worker: workerB,
        occurredAt: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1),
      }),
    ],
    shifts: [{ id: 'open-b', projectId, workerId: workerB.id, status: 'OPEN' }],
    attendance: {
      [workerA.id]: { workerId: workerA.id, status: 'GPS pendiente', lastEventType: 'CHECK_IN' },
      [workerB.id]: {
        workerId: workerB.id,
        status: 'GPS pendiente',
        shiftId: 'open-b',
        shiftState: 'WORKING',
        lastEventType: 'CHECK_IN',
      },
    },
  });

  const result = await expireStalePendingAttendanceBatch(database.prisma, { now, maxEntries: 10 });
  assert.equal(result.expiredCount, 2);
  assert.equal(result.reconciledProjections, 0);
  const snapshot = database.snapshot();
  assert.equal(snapshot.state.attendance[workerA.id].status, 'GPS pendiente');
  assert.equal(snapshot.state.attendance[workerB.id].shiftId, 'open-b');
  assert.equal(snapshot.entries.find((entry) => entry.id === 'fresh-a').verificationStatus, 'PENDING');
});

test('expiry restores the latest canonical journey after a pending overlay', async () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const closedShift = {
    id: 'closed-a',
    projectId,
    workerId: workerA.id,
    workDate: new Date('2026-07-22T00:00:00.000Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    status: 'CLOSED',
    phase: 'WORKING',
    openedAt: new Date('2026-07-22T11:00:00.000Z'),
    closedAt: new Date('2026-07-22T20:00:00.000Z'),
    revision: 1,
  };
  const database = createExpiryDatabase({
    entries: [
      {
        id: 'closed-check-in-a',
        projectId,
        workerId: workerA.id,
        shiftId: closedShift.id,
        eventType: 'CHECK_IN',
        verificationStatus: 'VERIFIED',
        occurredAt: closedShift.openedAt,
        sequence: 1,
        latitude: -34.6037,
        longitude: -58.3816,
        accuracyMeters: 12,
        distanceMeters: 3,
      },
      {
        id: 'closed-check-out-a',
        projectId,
        workerId: workerA.id,
        shiftId: closedShift.id,
        eventType: 'CHECK_OUT',
        verificationStatus: 'VERIFIED',
        occurredAt: closedShift.closedAt,
        sequence: 2,
      },
      pendingEntry({
        id: 'legacy-overlay-a',
        worker: workerA,
        occurredAt: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1),
      }),
    ],
    shifts: [closedShift],
    attendance: {
      [workerA.id]: {
        workerId: workerA.id,
        name: workerA.name,
        status: 'GPS pendiente',
        checkin: '08:00',
        checkout: '17:00',
        breakStartedAt: '12:00',
        breakEndedAt: '12:30',
        lastEventType: 'CHECK_IN',
      },
    },
  });

  const result = await expireStalePendingAttendanceBatch(database.prisma, { now });
  assert.equal(result.expiredCount, 1);
  assert.equal(result.reconciledProjections, 1);
  const restored = database.snapshot().state.attendance[workerA.id];
  assert.equal(restored.status, 'Jornada cerrada');
  assert.equal(restored.shiftId, closedShift.id);
  assert.equal(restored.shiftState, 'CLOSED');
  assert.equal(restored.lastEventType, 'CHECK_OUT');
  assert.equal(restored.checkin, '08:00');
  assert.equal(restored.checkout, '17:00');
  assert.equal(restored.breakStartedAt, undefined);
  assert.equal(restored.reviewRequired, false);
  assert.equal(restored.latitude, -34.6037);
});

test('expiry maps a migrated legacy shift to a valid terminal snapshot state', async () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const legacyShift = {
    id: 'legacy-shift-a',
    projectId,
    workerId: workerA.id,
    workDate: new Date('2026-07-20T00:00:00.000Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    status: 'LEGACY_INCOMPLETE',
    phase: 'WORKING',
    openedAt: new Date('2026-07-20T11:00:00.000Z'),
    closedAt: null,
    revision: 0,
  };
  const database = createExpiryDatabase({
    entries: [
      {
        id: 'legacy-check-in-a',
        projectId,
        workerId: workerA.id,
        shiftId: legacyShift.id,
        eventType: 'CHECK_IN',
        verificationStatus: 'VERIFIED',
        occurredAt: legacyShift.openedAt,
        sequence: 1,
      },
      pendingEntry({
        id: 'pending-after-legacy-a',
        worker: workerA,
        occurredAt: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1),
      }),
    ],
    shifts: [legacyShift],
    attendance: {
      [workerA.id]: {
        workerId: workerA.id,
        name: workerA.name,
        status: 'GPS pendiente',
        lastEventType: 'CHECK_IN',
      },
    },
  });

  const result = await expireStalePendingAttendanceBatch(database.prisma, { now });
  assert.equal(result.expiredCount, 1);
  assert.equal(result.reconciledProjections, 1);
  const restored = database.snapshot().state.attendance[workerA.id];
  assert.equal(restored.status, 'Registro histórico incompleto');
  assert.equal(restored.shiftId, legacyShift.id);
  assert.equal(restored.shiftState, 'CLOSED');
  assert.equal(restored.lastEventType, 'CHECK_IN');
});

test('snapshot compare-and-set loss rolls back expiry and retries the whole project safely', async () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const database = createExpiryDatabase({
    entries: [pendingEntry({
      id: 'retry-a',
      worker: workerA,
      occurredAt: new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1),
    })],
    attendance: {
      [workerA.id]: { workerId: workerA.id, status: 'GPS pendiente', lastEventType: 'CHECK_IN' },
    },
    snapshotCasFailures: 1,
  });

  const result = await expirePendingAttendanceForWorker(database.prisma, {
    projectId,
    workerId: workerA.id,
    now,
  });
  assert.equal(result.expiredCount, 1);
  assert.equal(result.reconciledProjections, 1);
  const snapshot = database.snapshot();
  assert.equal(snapshot.transactions, 2);
  assert.equal(snapshot.locks, 2);
  assert.equal(snapshot.entries[0].verificationStatus, 'EXPIRED');
  assert.equal(snapshot.state.attendance[workerA.id], undefined);
  assert.equal(snapshot.snapshotVersion, 2);
});

test('bounded sweep reports remaining backlog instead of hiding unprocessed expiry work', async () => {
  const now = new Date('2026-07-23T12:00:00.000Z');
  const staleAt = new Date(now.getTime() - ATTENDANCE_GEO_WINDOW_MS - 1);
  const database = createExpiryDatabase({
    entries: [
      pendingEntry({ id: 'bounded-a', worker: workerA, occurredAt: staleAt }),
      pendingEntry({ id: 'bounded-b', worker: workerB, occurredAt: staleAt }),
    ],
    attendance: {
      [workerA.id]: { workerId: workerA.id, status: 'GPS pendiente' },
      [workerB.id]: { workerId: workerB.id, status: 'GPS pendiente' },
    },
  });

  const result = await expireStalePendingAttendanceBatch(database.prisma, { now, maxEntries: 1 });
  assert.equal(result.scannedEntries, 1);
  assert.equal(result.expiredCount, 1);
  assert.equal(result.hasMore, true);
  assert.equal(database.snapshot().entries.filter((entry) => entry.verificationStatus === 'PENDING').length, 1);
});
