import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTENDANCE_GEO_WINDOW_MS,
  AttendanceDomainError,
  completePendingGeoAttendance,
  ensurePendingGeoAttendance,
  getAttendanceJourney,
  recordAttendanceAction,
} from '../src/lib/attendance.js';

const scope = Object.freeze({ projectId: 'project-a', workerId: 'worker-a' });
const timezone = 'America/Argentina/Buenos_Aires';

function valueForSort(value) {
  if (value instanceof Date) return value.getTime();
  if (value === null || value === undefined) return Number.MAX_SAFE_INTEGER;
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
      if (Object.hasOwn(expected, 'gte') && valueForSort(actual) < valueForSort(expected.gte)) return false;
      if (Object.hasOwn(expected, 'gt') && valueForSort(actual) <= valueForSort(expected.gt)) return false;
      if (Object.hasOwn(expected, 'lte') && valueForSort(actual) > valueForSort(expected.lte)) return false;
      if (Object.hasOwn(expected, 'lt') && valueForSort(actual) >= valueForSort(expected.lt)) return false;
      if (Object.hasOwn(expected, 'not') && actual === expected.not) return false;
      return true;
    }
    if (actual instanceof Date && expected instanceof Date) {
      return actual.getTime() === expected.getTime();
    }
    return actual === expected;
  });
}

function sorted(rows, orderBy) {
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause)[0];
      const leftValue = valueForSort(left[field]);
      const rightValue = valueForSort(right[field]);
      if (leftValue === rightValue) continue;
      const comparison = leftValue < rightValue ? -1 : 1;
      return direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
}

function uniqueError() {
  const error = new Error('Unique constraint');
  error.code = 'P2002';
  return error;
}

function applyData(row, data) {
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'increment')) {
      row[field] = Number(row[field] || 0) + Number(value.increment);
    } else {
      row[field] = value;
    }
  }
}

function createAttendancePrisma({ entries = [], shifts = [], loseShiftCas = false, loseEntryCas = false } = {}) {
  const database = {
    entries: structuredClone(entries),
    shifts: structuredClone(shifts),
    nextEntry: entries.length + 1,
    nextShift: shifts.length + 1,
    loseShiftCas,
    loseEntryCas,
  };

  function entryWithInclude(entry, include) {
    if (!entry) return null;
    const result = structuredClone(entry);
    if (include?.shift) {
      result.shift = structuredClone(database.shifts.find((shift) => shift.id === entry.shiftId) || null);
    }
    return result;
  }

  function shiftWithInclude(shift, include) {
    if (!shift) return null;
    const result = structuredClone(shift);
    if (include?.events) {
      result.events = sorted(
        database.entries.filter((entry) => entry.shiftId === shift.id),
        include.events.orderBy,
      ).map((entry) => structuredClone(entry));
    }
    return result;
  }

  const prisma = {
    attendanceEntry: {
      async findFirst({ where, orderBy, include } = {}) {
        const entry = sorted(database.entries.filter((candidate) => matches(candidate, where)), orderBy)[0] || null;
        return entryWithInclude(entry, include);
      },
      async findUnique({ where, include }) {
        const entry = database.entries.find((candidate) => (
          (where.id !== undefined && candidate.id === where.id)
          || (where.idempotencyKey !== undefined && candidate.idempotencyKey === where.idempotencyKey)
        )) || null;
        return entryWithInclude(entry, include);
      },
      async create({ data }) {
        if (database.entries.some((entry) => entry.idempotencyKey === data.idempotencyKey)) throw uniqueError();
        if (
          data.shiftId != null
          && data.sequence != null
          && database.entries.some((entry) => (
            entry.shiftId === data.shiftId && entry.sequence === data.sequence
          ))
        ) {
          throw uniqueError();
        }
        const entry = {
          id: `attendance-${database.nextEntry++}`,
          createdAt: new Date(data.occurredAt || Date.now()),
          ...structuredClone(data),
        };
        database.entries.push(entry);
        return structuredClone(entry);
      },
      async updateMany({ where, data }) {
        if (database.loseEntryCas && where.id && where.verificationStatus === 'PENDING') {
          database.loseEntryCas = false;
          return { count: 0 };
        }
        const selected = database.entries.filter((entry) => matches(entry, where));
        for (const entry of selected) {
          if (
            data.idempotencyKey
            && database.entries.some((other) => (
              other !== entry && other.idempotencyKey === data.idempotencyKey
            ))
          ) {
            throw uniqueError();
          }
          applyData(entry, structuredClone(data));
        }
        return { count: selected.length };
      },
    },
    attendanceShift: {
      async findFirst({ where, orderBy, include } = {}) {
        const shift = sorted(database.shifts.filter((candidate) => matches(candidate, where)), orderBy)[0] || null;
        return shiftWithInclude(shift, include);
      },
      async create({ data }) {
        if (data.status === 'OPEN' && database.shifts.some((shift) => (
          shift.projectId === data.projectId
          && shift.workerId === data.workerId
          && shift.status === 'OPEN'
        ))) {
          throw uniqueError();
        }
        const shift = {
          id: `shift-${database.nextShift++}`,
          createdAt: new Date(data.openedAt),
          updatedAt: new Date(data.openedAt),
          ...structuredClone(data),
        };
        database.shifts.push(shift);
        return structuredClone(shift);
      },
      async updateMany({ where, data }) {
        if (database.loseShiftCas) {
          database.loseShiftCas = false;
          return { count: 0 };
        }
        const selected = database.shifts.filter((shift) => matches(shift, where));
        for (const shift of selected) {
          applyData(shift, structuredClone(data));
          shift.updatedAt = new Date();
        }
        return { count: selected.length };
      },
    },
    async $transaction(callback) {
      const backup = structuredClone(database);
      try {
        return await callback(prisma);
      } catch (error) {
        database.entries = backup.entries;
        database.shifts = backup.shifts;
        database.nextEntry = backup.nextEntry;
        database.nextShift = backup.nextShift;
        database.loseShiftCas = backup.loseShiftCas;
        database.loseEntryCas = backup.loseEntryCas;
        throw error;
      }
    },
  };

  return {
    prisma,
    snapshot() {
      return structuredClone(database);
    },
  };
}

async function startPending(prisma, {
  now = new Date('2026-07-16T11:00:00.000Z'),
  workerId = scope.workerId,
  key = 'check-in-start-1',
  source = 'whatsapp',
  sourceOccurredAt = new Date('2026-07-16T10:59:50.000Z'),
  metadata = { workArea: 'Planta baja' },
} = {}) {
  return ensurePendingGeoAttendance(prisma, {
    projectId: scope.projectId,
    workerId,
    now,
    source,
    idempotencyKey: key,
    sourceOccurredAt,
    timezone,
    metadata,
  });
}

async function completeCheckIn(prisma, {
  now = new Date('2026-07-16T11:01:00.000Z'),
  workerId = scope.workerId,
  key = 'check-in-geo-1',
  source = 'webview',
  sourceOccurredAt = new Date('2026-07-16T11:00:55.000Z'),
  pendingEntryId = null,
  latitude = -34.5886,
  longitude = -58.4302,
  accuracyMeters = 18,
  distanceMeters = 12,
  geofenceRadiusMeters = 100,
  privacyNoticeVersion = 'attendance-location-v1',
  evidence = { assetId: 'asset-check-in' },
} = {}) {
  return completePendingGeoAttendance(prisma, {
    projectId: scope.projectId,
    workerId,
    now,
    source,
    idempotencyKey: key,
    sourceOccurredAt,
    pendingEntryId,
    timezone,
    latitude,
    longitude,
    accuracyMeters,
    distanceMeters,
    geofenceRadiusMeters,
    privacyNoticeVersion,
    evidence,
  });
}

async function openShift(prisma, options = {}) {
  await startPending(prisma, options);
  return completeCheckIn(prisma, options);
}

function action(prisma, eventType, now, key, overrides = {}) {
  return recordAttendanceAction(prisma, {
    ...scope,
    eventType,
    now,
    source: 'whatsapp',
    idempotencyKey: key,
    sourceOccurredAt: now,
    ...overrides,
  });
}

test('pending capture stores its real source and server-owned occurrence time', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  const now = new Date('2026-07-16T12:00:00.000Z');
  const sourceOccurredAt = new Date('2026-07-16T11:59:40.000Z');

  const pending = await startPending(prisma, {
    now,
    source: 'whatsapp-flow',
    sourceOccurredAt,
  });

  assert.equal(pending.eventType, 'CHECK_IN');
  assert.equal(pending.verificationStatus, 'PENDING');
  assert.equal(pending.status, 'PENDING_GEO');
  assert.equal(pending.source, 'whatsapp-flow');
  assert.equal(pending.occurredAt, now.toISOString());
  assert.equal(pending.sourceOccurredAt, sourceOccurredAt.toISOString());
  assert.equal(snapshot().entries[0].metadata.attendanceTimezone, timezone);
  assert.match(snapshot().entries[0].requestFingerprint, /^[a-f0-9]{64}$/);
  assert.match(snapshot().entries[0].idempotencyKey, /^attendance:v1:[a-f0-9]{64}$/);
});

test('CHECK_IN completion inherits the tenant timezone captured by the pending request', async () => {
  const { prisma } = createAttendancePrisma();
  const tenantTimezone = 'America/Santiago';
  const completedAt = new Date('2026-07-16T03:30:00.000Z');
  await ensurePendingGeoAttendance(prisma, {
    ...scope,
    now: new Date('2026-07-16T03:29:00.000Z'),
    source: 'whatsapp',
    idempotencyKey: 'timezone-pending',
    timezone: tenantTimezone,
  });

  const checkIn = await completePendingGeoAttendance(prisma, {
    ...scope,
    now: completedAt,
    source: 'webview',
    idempotencyKey: 'timezone-complete',
    latitude: -33.4489,
    longitude: -70.6693,
    accuracyMeters: 15,
    distanceMeters: 8,
    geofenceRadiusMeters: 100,
    privacyNoticeVersion: 'attendance-location-v1',
  });

  assert.equal(checkIn.shift.timezone, tenantTimezone);
  assert.equal(checkIn.shift.workDate, '2026-07-15');
});

test('stale pending capture expires technically and never becomes an absence', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  const startedAt = new Date('2026-07-16T08:00:00.000Z');
  await startPending(prisma, { now: startedAt, key: 'stale-start' });

  await startPending(prisma, {
    now: new Date(startedAt.getTime() + ATTENDANCE_GEO_WINDOW_MS + 1),
    key: 'fresh-start',
    sourceOccurredAt: new Date(startedAt.getTime() + ATTENDANCE_GEO_WINDOW_MS),
  });

  const [stale, fresh] = snapshot().entries;
  assert.equal(stale.verificationStatus, 'EXPIRED');
  assert.equal(stale.status, 'EXPIRED');
  assert.notEqual(stale.status, 'ABSENT');
  assert.equal(fresh.verificationStatus, 'PENDING');
});

test('pending replay is stable and changed payload under the same scope/source/key conflicts', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  const first = await startPending(prisma);
  const replay = await startPending(prisma);
  assert.equal(replay.id, first.id);
  assert.equal(snapshot().entries.length, 1);

  await assert.rejects(
    startPending(prisma, { metadata: { workArea: 'Nivel 2' } }),
    (error) => error instanceof AttendanceDomainError
      && error.code === 'ATTENDANCE_IDEMPOTENCY_CONFLICT'
      && error.status === 409,
  );
});

test('CHECK_IN consumes pending, opens WORKING shift and derives workDate from server time', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  const pendingAt = new Date('2026-07-16T02:29:00.000Z');
  const completedAt = new Date('2026-07-16T02:30:00.000Z');
  await startPending(prisma, { now: pendingAt, sourceOccurredAt: pendingAt });
  const checkIn = await completeCheckIn(prisma, {
    now: completedAt,
    sourceOccurredAt: new Date('2026-07-15T23:59:00.000Z'),
  });

  assert.equal(checkIn.eventType, 'CHECK_IN');
  assert.equal(checkIn.verificationStatus, 'VERIFIED');
  assert.equal(checkIn.status, 'PRESENT');
  assert.equal(checkIn.source, 'webview');
  assert.equal(checkIn.occurredAt, completedAt.toISOString());
  assert.equal(checkIn.sequence, 1);
  assert.equal(checkIn.shift.status, 'OPEN');
  assert.equal(checkIn.shift.phase, 'WORKING');
  assert.equal(checkIn.shift.workDate, '2026-07-15');
  assert.equal(checkIn.shift.timezone, timezone);
  assert.equal(checkIn.shift.revision, 0);
  assert.equal(snapshot().entries[0].checkedInAt.toISOString(), completedAt.toISOString());
});

test('GPS and privacy notice are mandatory for entry, and outside result is server-derived', async () => {
  const first = createAttendancePrisma();
  await startPending(first.prisma);
  await assert.rejects(
    completeCheckIn(first.prisma, { accuracyMeters: 101 }),
    (error) => error.code === 'ATTENDANCE_LOCATION_ACCURACY_INVALID' && error.status === 422,
  );
  assert.equal(first.snapshot().shifts.length, 0);
  assert.equal(first.snapshot().entries[0].verificationStatus, 'PENDING');

  await assert.rejects(
    completeCheckIn(first.prisma, { privacyNoticeVersion: null }),
    (error) => error.code === 'ATTENDANCE_PRIVACY_NOTICE_REQUIRED' && error.status === 422,
  );

  const second = createAttendancePrisma();
  await startPending(second.prisma);
  const reviewed = await completeCheckIn(second.prisma, {
    distanceMeters: 140,
    geofenceRadiusMeters: 100,
  });
  assert.equal(reviewed.verificationStatus, 'REVIEW_REQUIRED');
  assert.equal(reviewed.status, 'OUTSIDE_GEOFENCE');
  assert.equal(reviewed.shift.status, 'OPEN');

  const ambiguous = createAttendancePrisma();
  await startPending(ambiguous.prisma);
  const accuracyReviewed = await completeCheckIn(ambiguous.prisma, {
    distanceMeters: 90,
    accuracyMeters: 20,
    geofenceRadiusMeters: 100,
  });
  assert.equal(accuracyReviewed.verificationStatus, 'REVIEW_REQUIRED');
  assert.equal(accuracyReviewed.status, 'OUTSIDE_GEOFENCE');

  const boundary = createAttendancePrisma();
  await startPending(boundary.prisma);
  const boundaryVerified = await completeCheckIn(boundary.prisma, {
    distanceMeters: 80,
    accuracyMeters: 20,
    geofenceRadiusMeters: 100,
  });
  assert.equal(boundaryVerified.verificationStatus, 'VERIFIED');
});

test('completion after the geo window expires the pending capture and opens no shift', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  const startedAt = new Date('2026-07-16T08:00:00.000Z');
  await startPending(prisma, { now: startedAt, sourceOccurredAt: startedAt });
  const result = await completeCheckIn(prisma, {
    now: new Date(startedAt.getTime() + ATTENDANCE_GEO_WINDOW_MS + 1),
    sourceOccurredAt: new Date(startedAt.getTime() + ATTENDANCE_GEO_WINDOW_MS),
  });

  assert.equal(result, null);
  assert.equal(snapshot().entries[0].verificationStatus, 'EXPIRED');
  assert.equal(snapshot().entries[0].status, 'EXPIRED');
  assert.equal(snapshot().shifts.length, 0);
});

test('journey enforces CHECK_IN, break pair and CHECK_OUT sequence with server durations', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  await openShift(prisma, {
    now: new Date('2026-07-16T08:00:00.000Z'),
    sourceOccurredAt: new Date('2026-07-16T07:59:30.000Z'),
  });
  const breakStart = await action(
    prisma,
    'BREAK_START',
    new Date('2026-07-16T12:00:00.000Z'),
    'break-start-1',
  );
  assert.equal(breakStart.verificationStatus, 'NOT_REQUIRED');
  assert.equal(breakStart.shift.phase, 'ON_BREAK');
  assert.equal(breakStart.shift.revision, 1);

  const breakEnd = await action(
    prisma,
    'BREAK_END',
    new Date('2026-07-16T12:30:00.000Z'),
    'break-end-1',
  );
  assert.equal(breakEnd.shift.phase, 'WORKING');
  assert.equal(breakEnd.shift.revision, 2);

  const checkOut = await action(
    prisma,
    'CHECK_OUT',
    new Date('2026-07-16T17:00:00.000Z'),
    'check-out-1',
    {
      source: 'webview',
      latitude: -34.5886,
      longitude: -58.4302,
      accuracyMeters: 20,
      distanceMeters: 15,
      geofenceRadiusMeters: 100,
      privacyNoticeVersion: 'attendance-location-v1',
    },
  );
  assert.equal(checkOut.verificationStatus, 'VERIFIED');
  assert.equal(checkOut.shift.status, 'CLOSED');
  assert.equal(checkOut.shift.closedAt, '2026-07-16T17:00:00.000Z');
  assert.equal(checkOut.shift.revision, 3);

  const journey = await getAttendanceJourney(prisma, {
    ...scope,
    now: new Date('2026-07-16T18:00:00.000Z'),
  });
  assert.deepEqual(journey.events.map((event) => event.eventType), [
    'CHECK_IN',
    'BREAK_START',
    'BREAK_END',
    'CHECK_OUT',
  ]);
  assert.deepEqual(journey.events.map((event) => event.sequence), [1, 2, 3, 4]);
  assert.deepEqual(journey.totals, {
    durationMs: 9 * 60 * 60 * 1_000,
    breakDurationMs: 30 * 60 * 1_000,
    workedDurationMs: 8.5 * 60 * 60 * 1_000,
  });
  assert.deepEqual(journey.nextAllowedActions, []);
  assert.equal(snapshot().shifts[0].status, 'CLOSED');
});

test('CHECK_OUT never closes an open break implicitly', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  await openShift(prisma);
  await action(prisma, 'BREAK_START', new Date('2026-07-16T12:00:00.000Z'), 'break-open');

  await assert.rejects(
    action(prisma, 'CHECK_OUT', new Date('2026-07-16T17:00:00.000Z'), 'invalid-close', {
      source: 'webview',
      latitude: -34.5886,
      longitude: -58.4302,
      accuracyMeters: 20,
      distanceMeters: 10,
      geofenceRadiusMeters: 100,
      privacyNoticeVersion: 'attendance-location-v1',
    }),
    (error) => error.code === 'ATTENDANCE_BREAK_OPEN',
  );

  assert.equal(snapshot().shifts[0].status, 'OPEN');
  assert.equal(snapshot().shifts[0].phase, 'ON_BREAK');
  assert.equal(snapshot().entries.length, 2);
});

test('invalid break transitions and a second CHECK_IN fail without effects', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  await assert.rejects(
    action(prisma, 'BREAK_START', new Date('2026-07-16T08:00:00.000Z'), 'no-shift'),
    (error) => error.code === 'ATTENDANCE_SHIFT_NOT_OPEN',
  );
  await openShift(prisma);
  await assert.rejects(
    action(prisma, 'BREAK_END', new Date('2026-07-16T10:00:00.000Z'), 'no-break'),
    (error) => error.code === 'ATTENDANCE_BREAK_NOT_OPEN',
  );
  await assert.rejects(
    startPending(prisma, { key: 'second-check-in' }),
    (error) => error.code === 'ATTENDANCE_SHIFT_ALREADY_OPEN',
  );
  await assert.rejects(
    action(prisma, 'CHECK_IN', new Date('2026-07-16T10:00:00.000Z'), 'direct-check-in'),
    (error) => error.code === 'ATTENDANCE_CHECK_IN_REQUIRES_PENDING',
  );
  assert.equal(snapshot().entries.length, 1);
});

test('action replay returns the original event and payload change yields 409', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  await openShift(prisma);
  const at = new Date('2026-07-16T12:00:00.000Z');
  const first = await action(prisma, 'BREAK_START', at, 'stable-break');
  const replay = await action(prisma, 'BREAK_START', at, 'stable-break');
  assert.equal(replay.id, first.id);
  assert.equal(snapshot().entries.length, 2);
  assert.equal(snapshot().shifts[0].revision, 1);

  await assert.rejects(
    action(prisma, 'BREAK_START', at, 'stable-break', {
      sourceOccurredAt: new Date('2026-07-16T11:59:59.000Z'),
    }),
    (error) => error.code === 'ATTENDANCE_IDEMPOTENCY_CONFLICT' && error.status === 409,
  );
});

test('resource-bound links cannot target another pending entry or shift revision', async () => {
  const pendingDatabase = createAttendancePrisma();
  const pending = await startPending(pendingDatabase.prisma);
  await assert.rejects(
    completeCheckIn(pendingDatabase.prisma, { pendingEntryId: 'pending-from-another-link' }),
    (error) => error.code === 'ATTENDANCE_LINK_STALE' && error.status === 409,
  );
  assert.equal(pendingDatabase.snapshot().shifts.length, 0);
  assert.equal(pendingDatabase.snapshot().entries[0].id, pending.id);
  assert.equal(pendingDatabase.snapshot().entries[0].verificationStatus, 'PENDING');

  const shiftDatabase = createAttendancePrisma();
  const checkIn = await openShift(shiftDatabase.prisma);
  const binding = {
    shiftId: checkIn.shift.id,
    expectedRevision: checkIn.shift.revision,
  };
  const at = new Date('2026-07-16T12:00:00.000Z');
  const first = await action(
    shiftDatabase.prisma,
    'BREAK_START',
    at,
    'bound-break-start',
    binding,
  );
  const replay = await action(
    shiftDatabase.prisma,
    'BREAK_START',
    at,
    'bound-break-start',
    binding,
  );
  assert.equal(replay.id, first.id);

  await assert.rejects(
    action(
      shiftDatabase.prisma,
      'BREAK_END',
      new Date('2026-07-16T12:30:00.000Z'),
      'stale-shift-revision',
      binding,
    ),
    (error) => error.code === 'ATTENDANCE_LINK_STALE' && error.status === 409,
  );
  assert.equal(shiftDatabase.snapshot().entries.length, 2);
  assert.equal(shiftDatabase.snapshot().shifts[0].phase, 'ON_BREAK');
  assert.equal(shiftDatabase.snapshot().shifts[0].revision, 1);
});

test('global idempotency storage is safely namespaced by project, worker, source and action', async () => {
  const { prisma, snapshot } = createAttendancePrisma();
  await openShift(prisma);
  await startPending(prisma, {
    workerId: 'worker-b',
    key: 'check-in-start-b',
    sourceOccurredAt: new Date('2026-07-16T11:00:00.000Z'),
  });
  await completeCheckIn(prisma, {
    workerId: 'worker-b',
    key: 'check-in-geo-b',
    sourceOccurredAt: new Date('2026-07-16T11:01:00.000Z'),
  });

  const at = new Date('2026-07-16T12:00:00.000Z');
  await action(prisma, 'BREAK_START', at, 'same-raw-key');
  await recordAttendanceAction(prisma, {
    projectId: scope.projectId,
    workerId: 'worker-b',
    eventType: 'BREAK_START',
    now: at,
    source: 'whatsapp',
    idempotencyKey: 'same-raw-key',
    sourceOccurredAt: at,
  });

  const keys = snapshot().entries.map((entry) => entry.idempotencyKey);
  assert.equal(new Set(keys).size, keys.length);
});

test('lost shift and pending CAS races roll back every partial effect', async () => {
  const shiftRace = createAttendancePrisma({ loseShiftCas: true });
  await openShift(shiftRace.prisma);
  await assert.rejects(
    action(
      shiftRace.prisma,
      'BREAK_START',
      new Date('2026-07-16T12:00:00.000Z'),
      'lost-shift-cas',
    ),
    (error) => error.code === 'ATTENDANCE_CONCURRENT_MODIFICATION',
  );
  assert.equal(shiftRace.snapshot().entries.length, 1);
  assert.equal(shiftRace.snapshot().shifts[0].revision, 0);
  assert.equal(shiftRace.snapshot().shifts[0].phase, 'WORKING');

  const pendingRace = createAttendancePrisma({ loseEntryCas: true });
  await startPending(pendingRace.prisma);
  await assert.rejects(
    completeCheckIn(pendingRace.prisma),
    (error) => error.code === 'ATTENDANCE_CONCURRENT_MODIFICATION',
  );
  assert.equal(pendingRace.snapshot().shifts.length, 0);
  assert.equal(pendingRace.snapshot().entries[0].verificationStatus, 'PENDING');
});

test('journey is scoped and returns null when that worker has no shift', async () => {
  const { prisma } = createAttendancePrisma();
  await openShift(prisma);
  assert.equal(await getAttendanceJourney(prisma, {
    projectId: scope.projectId,
    workerId: 'worker-b',
  }), null);
  const journey = await getAttendanceJourney(prisma, {
    ...scope,
    workDate: '2026-07-16',
    now: new Date('2026-07-16T12:00:00.000Z'),
  });
  assert.equal(journey.shift.workerId, scope.workerId);
  assert.deepEqual(journey.nextAllowedActions, ['BREAK_START', 'CHECK_OUT']);
});
