import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { registerHooks } from 'node:module';
import { after, test } from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      const sourcePath = new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url);
      return nextResolve(sourcePath.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalWebviewSecret = process.env.WEBVIEW_TOKEN_SECRET;
process.env.DATABASE_URL = 'postgresql://attendance-s1.invalid/obrasaas';
process.env.WEBVIEW_TOKEN_SECRET = 'attendance-s1-integration-secret';

const [
  {
    ATTENDANCE_ACTIONS,
    ATTENDANCE_V1_COMPATIBILITY,
    generateWebviewToken,
    readWebviewToken,
  },
  { POST: postAttendance },
  { processIncomingObraMessage },
] = await Promise.all([
  import('../src/lib/auth.js'),
  import('../src/app/api/webviews/attendance/route.js'),
  import('../src/lib/whatsapp/obra-engine.js'),
]);

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalWebviewSecret === undefined) delete process.env.WEBVIEW_TOKEN_SECRET;
  else process.env.WEBVIEW_TOKEN_SECRET = originalWebviewSecret;
  delete globalThis.__obraSaasPrisma;
});

const projectId = 'project-attendance-s1';
const organizationId = 'organization-attendance-s1';
const workerId = 'worker-attendance-s1';
const shiftId = 'shift-attendance-s1';
const projectLocation = Object.freeze({ latitude: -34.6037, longitude: -58.3816 });
const openedAt = new Date('2026-07-23T11:00:00.000Z');

const worker = Object.freeze({
  id: workerId,
  projectId,
  externalId: null,
  phone: '+5491112345678',
  name: 'Operaria S1',
  role: 'Oficial',
  active: true,
  metadata: { whatsappRole: 'WORKER' },
  createdAt: openedAt,
  updatedAt: openedAt,
  project: { organizationId },
});

function valueForSort(value) {
  if (value instanceof Date) return value.getTime();
  if (value === null || value === undefined) return Number.MAX_SAFE_INTEGER;
  return value;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([field, expected]) => {
    if (field === 'project' && expected?.organizationId) {
      return row.projectId === projectId && expected.organizationId === organizationId;
    }
    const actual = row[field];
    if (
      expected
      && typeof expected === 'object'
      && !Array.isArray(expected)
      && !(expected instanceof Date)
    ) {
      if (Object.hasOwn(expected, 'in') && !expected.in.includes(actual)) return false;
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

function applyData(row, data) {
  for (const [field, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && Object.hasOwn(value, 'increment')) {
      row[field] = Number(row[field] || 0) + Number(value.increment);
    } else {
      row[field] = structuredClone(value);
    }
  }
}

function uniqueError() {
  const error = new Error('Unique constraint');
  error.code = 'P2002';
  return error;
}

function initialSnapshotState() {
  return {
    operariosCount: 1,
    avancePercentage: 0,
    alertsCount: 0,
    diasEstimados: '',
    tasks: {},
    incidents: [],
    attendance: {
      [workerId]: {
        workerId,
        name: worker.name,
        role: worker.role,
        checkin: '08:00',
        status: 'Presente (ubicación informada)',
        shiftId,
        shiftState: 'WORKING',
        lastEventType: 'CHECK_IN',
        reviewRequired: false,
      },
    },
    stockpiles: {},
    hrAttendance: {},
    hrBonuses: [],
  };
}

function seedShift({ phase = 'WORKING' } = {}) {
  return {
    id: shiftId,
    projectId,
    workerId,
    workDate: new Date('2026-07-23T00:00:00.000Z'),
    timezone: 'America/Argentina/Buenos_Aires',
    status: 'OPEN',
    phase,
    openedAt,
    closedAt: null,
    revision: phase === 'ON_BREAK' ? 1 : 0,
    metadata: {},
    createdAt: openedAt,
    updatedAt: openedAt,
  };
}

function seedEntries({ phase = 'WORKING' } = {}) {
  const entries = [{
    id: 'attendance-check-in-s1',
    projectId,
    workerId,
    shiftId,
    eventType: 'CHECK_IN',
    verificationStatus: 'VERIFIED',
    status: 'PRESENT',
    occurredAt: openedAt,
    sourceOccurredAt: new Date(openedAt.getTime() - 5_000),
    sequence: 1,
    idempotencyKey: 'attendance:seed:check-in',
    requestFingerprint: 'seed-check-in',
    source: 'webview',
    latitude: projectLocation.latitude,
    longitude: projectLocation.longitude,
    accuracyMeters: 10,
    distanceMeters: 0,
    geofenceRadiusMeters: 150,
    privacyNoticeVersion: '2026-07-23',
    evidence: null,
    checkedInAt: openedAt,
    metadata: {},
    createdAt: openedAt,
  }];
  if (phase === 'ON_BREAK') {
    entries.push({
      id: 'attendance-break-start-s1',
      projectId,
      workerId,
      shiftId,
      eventType: 'BREAK_START',
      verificationStatus: 'NOT_REQUIRED',
      status: 'PRESENT',
      occurredAt: new Date('2026-07-23T15:00:00.000Z'),
      sourceOccurredAt: new Date('2026-07-23T15:00:00.000Z'),
      sequence: 2,
      idempotencyKey: 'attendance:seed:break-start',
      requestFingerprint: 'seed-break-start',
      source: 'webview',
      checkedInAt: new Date('2026-07-23T15:00:00.000Z'),
      metadata: {},
      createdAt: new Date('2026-07-23T15:00:00.000Z'),
    });
  }
  return entries;
}

function seedPendingEntry(occurredAt) {
  return {
    id: 'attendance-pending-s1',
    projectId,
    workerId,
    shiftId: null,
    eventType: 'CHECK_IN',
    verificationStatus: 'PENDING',
    status: 'PENDING',
    occurredAt,
    sourceOccurredAt: occurredAt,
    sequence: null,
    idempotencyKey: 'attendance:seed:pending-check-in',
    requestFingerprint: 'seed-pending-check-in',
    source: 'whatsapp',
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    distanceMeters: null,
    geofenceRadiusMeters: null,
    privacyNoticeVersion: null,
    evidence: null,
    checkedInAt: occurredAt,
    metadata: { attendanceTimezone: 'America/Argentina/Buenos_Aires' },
    createdAt: occurredAt,
  };
}

function createAttendanceDatabase({ phase = 'WORKING', pendingCheckInAt = null } = {}) {
  const pendingCheckIn = pendingCheckInAt instanceof Date;
  const initialState = initialSnapshotState();
  if (pendingCheckIn) {
    initialState.operariosCount = 0;
    initialState.attendance = {
      [workerId]: {
        workerId,
        name: worker.name,
        role: worker.role,
        checkin: '08:00',
        status: 'GPS pendiente',
        lastEventType: 'CHECK_IN',
        reviewRequired: false,
      },
    };
  }
  const database = {
    shifts: pendingCheckIn ? [] : [seedShift({ phase })],
    entries: pendingCheckIn
      ? [seedPendingEntry(pendingCheckInAt)]
      : seedEntries({ phase }),
    audits: new Map(),
    messages: new Map(),
    state: initialState,
    stateVersion: 1,
    nextEntry: pendingCheckIn ? 1 : phase === 'ON_BREAK' ? 3 : 2,
    auditCreates: 0,
  };
  if (phase === 'ON_BREAK') {
    database.state.attendance[workerId] = {
      ...database.state.attendance[workerId],
      status: 'Presente · en pausa',
      shiftState: 'ON_BREAK',
      lastEventType: 'BREAK_START',
    };
  }

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
    async $executeRawUnsafe() {
      return 1;
    },
    async $transaction(callback) {
      const backup = {
        shifts: structuredClone(database.shifts),
        entries: structuredClone(database.entries),
        audits: structuredClone(database.audits),
        messages: structuredClone(database.messages),
        state: structuredClone(database.state),
        stateVersion: database.stateVersion,
        nextEntry: database.nextEntry,
        auditCreates: database.auditCreates,
      };
      try {
        return await callback(prisma);
      } catch (error) {
        database.shifts = backup.shifts;
        database.entries = backup.entries;
        database.audits = backup.audits;
        database.messages = backup.messages;
        database.state = backup.state;
        database.stateVersion = backup.stateVersion;
        database.nextEntry = backup.nextEntry;
        database.auditCreates = backup.auditCreates;
        throw error;
      }
    },
    project: {
      async findFirst() {
        return {
          id: projectId,
          organizationId,
          status: 'ACTIVE',
          ...projectLocation,
          geofenceMeters: 150,
          startsAt: new Date('2026-07-01T00:00:00.000Z'),
          organization: {
            timezone: 'America/Argentina/Buenos_Aires',
            subscriptionPlan: 'PRO',
            subscriptionStatus: 'ACTIVE',
            trialEndsAt: null,
          },
          snapshot: {
            state: structuredClone(database.state),
            version: database.stateVersion,
          },
        };
      },
    },
    worker: {
      async findFirst() {
        return {
          ...structuredClone(worker),
          project: {
            organizationId,
            organization: {
              subscriptionPlan: 'PRO',
              subscriptionStatus: 'ACTIVE',
              trialEndsAt: null,
            },
          },
        };
      },
    },
    attendanceEntry: {
      async findMany({ where, orderBy, take, select } = {}) {
        const entries = sorted(
          database.entries.filter((candidate) => matches(candidate, where)),
          orderBy,
        ).slice(0, take == null ? undefined : take);
        return entries.map((entry) => {
          if (!select) return structuredClone(entry);
          const selected = {};
          for (const [field, requested] of Object.entries(select)) {
            if (!requested) continue;
            if (field === 'worker') selected.worker = { name: worker.name };
            else selected[field] = structuredClone(entry[field]);
          }
          return selected;
        });
      },
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
        if (database.entries.some((entry) => entry.idempotencyKey === data.idempotencyKey)) {
          throw uniqueError();
        }
        if (database.entries.some((entry) => (
          entry.shiftId === data.shiftId && entry.sequence === data.sequence
        ))) {
          throw uniqueError();
        }
        const entry = {
          id: `attendance-s1-${database.nextEntry++}`,
          createdAt: new Date(data.occurredAt),
          ...structuredClone(data),
        };
        database.entries.push(entry);
        return structuredClone(entry);
      },
      async updateMany({ where, data }) {
        const selected = database.entries.filter((entry) => matches(entry, where));
        for (const entry of selected) applyData(entry, data);
        return { count: selected.length };
      },
    },
    attendanceShift: {
      async findFirst({ where, orderBy, include } = {}) {
        const shift = sorted(database.shifts.filter((candidate) => matches(candidate, where)), orderBy)[0] || null;
        return shiftWithInclude(shift, include);
      },
      async create({ data }) {
        const shift = {
          id: shiftId,
          ...structuredClone(data),
          createdAt: new Date(data.openedAt),
          updatedAt: new Date(data.openedAt),
        };
        database.shifts.push(shift);
        return structuredClone(shift);
      },
      async updateMany({ where, data }) {
        const selected = database.shifts.filter((shift) => matches(shift, where));
        for (const shift of selected) applyData(shift, data);
        return { count: selected.length };
      },
    },
    auditLog: {
      async findUnique({ where }) {
        return structuredClone(database.audits.get(where.id) || null);
      },
      async create({ data }) {
        if (database.audits.has(data.id)) throw uniqueError();
        database.auditCreates += 1;
        database.audits.set(data.id, structuredClone(data));
        return structuredClone(data);
      },
    },
    task: {
      async findMany() {
        return [];
      },
      async upsert() {
        throw new Error('The empty task projection must not upsert tasks.');
      },
      async deleteMany() {
        return { count: 0 };
      },
    },
    projectSnapshot: {
      async findUnique({ where }) {
        if (where.projectId !== projectId || database.stateVersion <= 0) return null;
        return {
          state: structuredClone(database.state),
          version: database.stateVersion,
        };
      },
      async updateMany({ where, data }) {
        if (where.projectId !== projectId || where.version !== database.stateVersion) {
          return { count: 0 };
        }
        database.state = structuredClone(data.state);
        database.stateVersion += Number(data.version?.increment || 0);
        return { count: 1 };
      },
      async upsert({ update, create }) {
        const data = database.stateVersion > 0 ? update : create;
        database.state = structuredClone(data.state);
        database.stateVersion = data.version?.increment
          ? database.stateVersion + Number(data.version.increment)
          : data.version;
        return { state: structuredClone(database.state), version: database.stateVersion };
      },
    },
    conversation: {
      async upsert() {
        return { id: 'conversation-attendance-s1' };
      },
    },
    message: {
      async findUnique({ where }) {
        return structuredClone(database.messages.get(where.externalId) || null);
      },
      async create({ data }) {
        const record = { id: `message-${database.messages.size + 1}`, ...structuredClone(data) };
        if (record.externalId) database.messages.set(record.externalId, record);
        return structuredClone(record);
      },
      async update({ where, data }) {
        const current = [...database.messages.values()].find((item) => item.id === where.id);
        if (!current) throw new Error('Message not found.');
        Object.assign(current, structuredClone(data));
        return structuredClone(current);
      },
    },
  };

  return {
    prisma,
    mutate(callback) {
      callback(database);
    },
    snapshot() {
      return structuredClone({
        shifts: database.shifts,
        entries: database.entries,
        state: database.state,
        stateVersion: database.stateVersion,
        auditCreates: database.auditCreates,
        auditCount: database.audits.size,
        auditRecords: [...database.audits.values()],
        messageCount: database.messages.size,
      });
    },
  };
}

function engineOptions(prisma, state, processingTime) {
  return {
    prisma,
    state,
    projectSettings: {
      id: projectId,
      organizationId,
      ...projectLocation,
      geofenceMeters: 150,
      timezone: 'America/Argentina/Buenos_Aires',
    },
    worker,
    processingTime,
    persist: false,
  };
}

function whatsappText(text, externalId, timestamp) {
  return {
    externalId,
    provider: 'meta',
    from: worker.phone,
    displayName: worker.name,
    kind: 'text',
    text,
    timestamp,
  };
}

function attendanceRequest(action, idempotencyKey, overrides = {}) {
  const {
    tokenBinding = {},
    ...bodyOverrides
  } = overrides;
  const defaultShiftRevision = action === ATTENDANCE_ACTIONS.BREAK_START
    ? 0
    : action === ATTENDANCE_ACTIONS.BREAK_END
      ? 1
      : 2;
  const token = generateWebviewToken(workerId, {
    purpose: 'attendance',
    scope: projectId,
    action,
    ...(action === ATTENDANCE_ACTIONS.CHECK_IN
      ? { pendingEntryId: 'attendance-pending-s1', ...tokenBinding }
      : { shiftId, shiftRevision: defaultShiftRevision, ...tokenBinding }),
  });
  return new Request('http://localhost/api/webviews/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      worker: workerId,
      token,
      action,
      idempotencyKey,
      ...([ATTENDANCE_ACTIONS.CHECK_IN, ATTENDANCE_ACTIONS.CHECK_OUT].includes(action)
        ? {
            location: {
              ...projectLocation,
              accuracy: 10,
              capturedAt: new Date().toISOString(),
            },
            locationNoticeAcknowledged: true,
            locationNoticeVersion: '2026-07-23',
          }
        : {}),
      ...bodyOverrides,
    }),
  });
}

function legacyAttendanceToken() {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    sub: workerId,
    aud: 'attendance',
    ctx: projectId,
    exp: Math.floor(Date.now() / 1_000) + 60 * 60,
  })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.WEBVIEW_TOKEN_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function legacyAttendanceRequest(token, location) {
  return new Request('http://localhost/api/webviews/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      worker: workerId,
      token,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
    }),
  });
}

test('WhatsApp records a break pair idempotently and requires the signed GPS link for checkout', async () => {
  const { prisma, snapshot } = createAttendanceDatabase();
  const state = initialSnapshotState();
  const breakStartAt = new Date('2026-07-23T15:00:00.000Z');
  const breakStartEvent = whatsappText('almuerzo', 'wamid.break-start-s1', breakStartAt);

  const started = await processIncomingObraMessage(
    breakStartEvent,
    { projectId, organizationId },
    engineOptions(prisma, state, breakStartAt),
  );
  assert.equal(started.attendanceResult.eventType, 'BREAK_START');
  assert.equal(started.attendanceResult.sequence, 2);
  assert.equal(state.attendance[workerId].shiftState, 'ON_BREAK');
  assert.equal(snapshot().entries.length, 2);

  const replayed = await processIncomingObraMessage(
    breakStartEvent,
    { projectId, organizationId },
    engineOptions(prisma, state, breakStartAt),
  );
  assert.equal(replayed.attendanceResult.id, started.attendanceResult.id);
  assert.equal(snapshot().entries.length, 2);
  assert.equal(state.incidents.filter((incident) => incident.title.includes('Pausa iniciada')).length, 1);

  const breakEndAt = new Date('2026-07-23T15:30:00.000Z');
  const ended = await processIncomingObraMessage(
    whatsappText('volví', 'wamid.break-end-s1', breakEndAt),
    { projectId, organizationId },
    engineOptions(prisma, state, breakEndAt),
  );
  assert.equal(ended.attendanceResult.eventType, 'BREAK_END');
  assert.equal(ended.attendanceResult.sequence, 3);
  assert.equal(state.attendance[workerId].shiftState, 'WORKING');

  const checkoutPrompt = await processIncomingObraMessage(
    whatsappText('chau', 'wamid.checkout-prompt-s1', new Date('2026-07-23T20:00:00.000Z')),
    { projectId, organizationId },
    engineOptions(prisma, state, new Date('2026-07-23T20:00:00.000Z')),
  );
  assert.equal(checkoutPrompt.attendanceResult, null);
  assert.equal(checkoutPrompt.stateChanged, false);
  assert.match(checkoutPrompt.reply, /lectura puntual de ubicación/i);
  const secureUrl = new URL(checkoutPrompt.reply.match(/https?:\/\/\S+/u)[0]);
  const checkoutPayload = readWebviewToken(
    secureUrl.searchParams.get('worker'),
    secureUrl.searchParams.get('token'),
    { purpose: 'attendance', scope: projectId, action: ATTENDANCE_ACTIONS.CHECK_OUT },
  );
  assert.equal(checkoutPayload.act, ATTENDANCE_ACTIONS.CHECK_OUT);
  assert.equal(checkoutPayload.sid, shiftId);
  assert.equal(checkoutPayload.rev, 2);
  assert.equal(snapshot().entries.length, 3);
  assert.equal(snapshot().shifts[0].status, 'OPEN');
});

test('a new pending check-in does not inherit fields from the previous closed journey', async () => {
  const database = createAttendanceDatabase();
  database.mutate((current) => {
    current.shifts[0].status = 'CLOSED';
    current.shifts[0].closedAt = new Date('2026-07-22T20:00:00.000Z');
    current.state.attendance[workerId] = {
      ...current.state.attendance[workerId],
      status: 'Jornada cerrada · revisar ubicación',
      shiftState: 'CLOSED',
      checkout: '17:00',
      breakStartedAt: '12:00',
      breakEndedAt: '12:30',
      reviewRequired: true,
    };
  });
  const state = database.snapshot().state;
  const requestedAt = new Date('2026-07-23T11:00:00.000Z');

  const result = await processIncomingObraMessage(
    whatsappText('fichar', 'wamid.new-pending-s1', requestedAt),
    { projectId, organizationId },
    engineOptions(database.prisma, state, requestedAt),
  );

  assert.equal(result.stateChanged, true);
  assert.equal(state.attendance[workerId].status, 'GPS pendiente');
  assert.equal(state.attendance[workerId].reviewRequired, false);
  assert.equal(state.attendance[workerId].shiftId, undefined);
  assert.equal(state.attendance[workerId].shiftState, undefined);
  assert.equal(state.attendance[workerId].checkout, undefined);
  assert.equal(state.attendance[workerId].breakStartedAt, undefined);
  assert.equal(state.attendance[workerId].breakEndedAt, undefined);
});

test('a bound v2 check-in consumes only its signed pending entry', async () => {
  const database = createAttendanceDatabase({ pendingCheckInAt: new Date(Date.now() - 10_000) });
  database.mutate(({ state }) => {
    state.attendance[workerId] = {
      ...state.attendance[workerId],
      checkout: '18:00',
      status: 'Jornada anterior cerrada con observación',
      reviewRequired: true,
    };
  });
  globalThis.__obraSaasPrisma = database.prisma;

  const response = await postAttendance(attendanceRequest(
    ATTENDANCE_ACTIONS.CHECK_IN,
    'route-bound-check-in-s1',
  ));
  const payload = await response.json();
  const after = database.snapshot();

  assert.equal(response.status, 200);
  assert.equal(payload.outcome, 'RECORDED');
  assert.equal(after.shifts.length, 1);
  assert.equal(after.entries[0].shiftId, shiftId);
  assert.equal(after.entries[0].eventType, 'CHECK_IN');
  assert.equal(after.entries[0].sourceOccurredAt instanceof Date, true);
  assert.equal(after.state.attendance[workerId].reviewRequired, false);
  assert.equal(after.state.attendance[workerId].checkout, undefined);
});

test('attendance Route Handler persists the complete S1 journey and replays one operation exactly once', async () => {
  const database = createAttendanceDatabase();
  globalThis.__obraSaasPrisma = database.prisma;
  const checkoutLocation = {
    ...projectLocation,
    accuracy: 10,
    capturedAt: new Date().toISOString(),
  };

  const steps = [
    [ATTENDANCE_ACTIONS.BREAK_START, 'route-break-start-s1'],
    [ATTENDANCE_ACTIONS.BREAK_END, 'route-break-end-s1'],
    [ATTENDANCE_ACTIONS.CHECK_OUT, 'route-check-out-s1'],
  ];
  for (const [action, key] of steps) {
    const response = await postAttendance(attendanceRequest(
      action,
      key,
      action === ATTENDANCE_ACTIONS.CHECK_OUT ? { location: checkoutLocation } : {},
    ));
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(payload.success, true);
    assert.equal(payload.outcome, 'RECORDED');
    assert.equal(payload.action, action);
  }

  const recorded = database.snapshot();
  assert.deepEqual(recorded.entries.map((entry) => entry.eventType), [
    'CHECK_IN',
    'BREAK_START',
    'BREAK_END',
    'CHECK_OUT',
  ]);
  assert.deepEqual(recorded.entries.map((entry) => entry.sequence), [1, 2, 3, 4]);
  assert.equal(recorded.entries[3].verificationStatus, 'VERIFIED');
  assert.equal(recorded.shifts[0].status, 'CLOSED');
  assert.equal(recorded.shifts[0].phase, 'WORKING');
  assert.equal(recorded.shifts[0].revision, 3);
  assert.equal(recorded.state.attendance[workerId].shiftState, 'CLOSED');
  assert.equal(recorded.state.operariosCount, 0);
  assert.equal(recorded.auditCount, 3);

  const replay = await postAttendance(attendanceRequest(
    ATTENDANCE_ACTIONS.CHECK_OUT,
    'route-check-out-s1',
    { location: checkoutLocation },
  ));
  const replayPayload = await replay.json();
  assert.equal(replay.status, 200);
  assert.equal(replayPayload.outcome, 'REPLAYED');
  assert.equal(replayPayload.journey.shift.status, 'CLOSED');
  assert.equal(database.snapshot().entries.length, 4);
  assert.equal(database.snapshot().auditCreates, 3);
});

test('an already-recorded operation replays after GPS freshness expires', async (context) => {
  const initialNow = new Date('2026-07-23T20:00:00.000Z');
  context.mock.timers.enable({ apis: ['Date'], now: initialNow });
  const database = createAttendanceDatabase();
  globalThis.__obraSaasPrisma = database.prisma;
  const capturedAt = initialNow.toISOString();
  const request = attendanceRequest(
    ATTENDANCE_ACTIONS.CHECK_OUT,
    'route-delayed-replay-s1',
    {
      tokenBinding: { shiftRevision: 0 },
      location: { ...projectLocation, accuracy: 10, capturedAt },
    },
  );
  const retry = request.clone();

  const first = await postAttendance(request);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).outcome, 'RECORDED');

  context.mock.timers.setTime(initialNow.getTime() + (3 * 60 * 1_000));
  const replay = await postAttendance(retry);
  const payload = await replay.json();

  assert.equal(replay.status, 200);
  assert.equal(payload.outcome, 'REPLAYED');
  assert.equal(database.snapshot().auditCreates, 1);
  assert.equal(database.snapshot().entries.length, 2);
});

test('attendance Route Handler rejects checkout during an open break without partial effects', async () => {
  const database = createAttendanceDatabase({ phase: 'ON_BREAK' });
  globalThis.__obraSaasPrisma = database.prisma;

  const response = await postAttendance(attendanceRequest(
    ATTENDANCE_ACTIONS.CHECK_OUT,
    'route-checkout-open-break-s1',
    { tokenBinding: { shiftRevision: 1 } },
  ));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'ATTENDANCE_BREAK_OPEN');
  assert.match(payload.error, /finalizá la pausa/i);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(database.snapshot().entries.length, 2);
  assert.equal(database.snapshot().shifts[0].status, 'OPEN');
  assert.equal(database.snapshot().shifts[0].phase, 'ON_BREAK');
  assert.equal(database.snapshot().auditCount, 0);
});

test('attendance Route Handler rejects reusing one outer idempotency key for another signed action', async () => {
  const database = createAttendanceDatabase();
  globalThis.__obraSaasPrisma = database.prisma;
  const sharedKey = 'route-shared-idempotency-s1';

  const first = await postAttendance(attendanceRequest(
    ATTENDANCE_ACTIONS.BREAK_START,
    sharedKey,
  ));
  assert.equal(first.status, 200);

  const conflict = await postAttendance(attendanceRequest(
    ATTENDANCE_ACTIONS.BREAK_END,
    sharedKey,
  ));
  const payload = await conflict.json();
  assert.equal(conflict.status, 409);
  assert.equal(payload.code, 'DIRECT_OPERATION_OUTCOME_INVALID');
  assert.match(payload.error, /forma segura/i);
  assert.equal(database.snapshot().entries.length, 2);
  assert.equal(database.snapshot().shifts[0].phase, 'ON_BREAK');
  assert.equal(database.snapshot().auditCount, 1);
});

test('a stale checkout link cannot close a later shift for the same worker', async () => {
  const database = createAttendanceDatabase();
  globalThis.__obraSaasPrisma = database.prisma;
  const staleRequest = attendanceRequest(
    ATTENDANCE_ACTIONS.CHECK_OUT,
    'route-stale-checkout-s1',
    {
      tokenBinding: { shiftId, shiftRevision: 0 },
      location: {
        ...projectLocation,
        accuracy: 10,
        capturedAt: new Date().toISOString(),
      },
    },
  );
  database.mutate((current) => {
    current.shifts[0].status = 'CLOSED';
    current.shifts[0].closedAt = new Date('2026-07-23T12:00:00.000Z');
    current.shifts[0].revision = 1;
    current.shifts.push({
      ...seedShift(),
      id: 'shift-attendance-s1-later',
      openedAt: new Date('2026-07-24T11:00:00.000Z'),
      workDate: new Date('2026-07-24T00:00:00.000Z'),
    });
  });

  const response = await postAttendance(staleRequest);
  const payload = await response.json();
  const after = database.snapshot();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'ATTENDANCE_LINK_STALE');
  assert.equal(after.shifts.find((shift) => shift.id === 'shift-attendance-s1-later').status, 'OPEN');
  assert.equal(after.entries.length, 1);
  assert.equal(after.auditCount, 0);
});

test('legacy v1 check-in keeps the historical operation identity across a fresh GPS retry', async () => {
  const database = createAttendanceDatabase({
    pendingCheckInAt: new Date(Date.now() - 10_000),
  });
  globalThis.__obraSaasPrisma = database.prisma;
  const token = legacyAttendanceToken();
  const firstLocation = { ...projectLocation, accuracy: 10 };

  const first = await postAttendance(legacyAttendanceRequest(token, firstLocation));
  const firstPayload = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstPayload.outcome, 'RECORDED');
  assert.equal(firstPayload.action, ATTENDANCE_ACTIONS.CHECK_IN);
  assert.equal(first.headers.get('deprecation'), 'true');
  assert.equal(
    first.headers.get('sunset'),
    new Date(ATTENDANCE_V1_COMPATIBILITY.acceptUntilExclusive).toUTCString(),
  );
  assert.equal(
    first.headers.get('x-obrasaas-removal-marker'),
    ATTENDANCE_V1_COMPATIBILITY.removalMarker,
  );

  const afterFirst = database.snapshot();
  assert.equal(afterFirst.entries.length, 1);
  assert.equal(afterFirst.entries[0].source, 'webview-legacy-v1');
  assert.equal(
    afterFirst.entries[0].privacyNoticeVersion,
    'legacy-v1-ui-disclosure-unversioned',
  );
  const expectedHistoricalOperationId = `webview-attendance-${crypto
    .createHash('sha256')
    .update(`attendance\0${projectId}\0${workerId}\0${token}`)
    .digest('hex')}`;
  assert.equal(afterFirst.auditRecords[0].id, expectedHistoricalOperationId);
  assert.equal(afterFirst.auditRecords[0].action, 'webview.attendance.location_applied');
  assert.equal(afterFirst.auditRecords[0].metadata.provider, 'webview-legacy-v1');

  const replay = await postAttendance(legacyAttendanceRequest(token, {
    latitude: projectLocation.latitude + 0.0001,
    longitude: projectLocation.longitude + 0.0001,
    accuracy: 18,
  }));
  const replayPayload = await replay.json();
  assert.equal(replay.status, 200);
  assert.equal(replayPayload.outcome, 'REPLAYED');

  const afterReplay = database.snapshot();
  assert.equal(afterReplay.auditCreates, 1);
  assert.equal(afterReplay.entries.length, 1);
  assert.equal(Number(afterReplay.entries[0].latitude), firstLocation.latitude);
  assert.equal(Number(afterReplay.entries[0].longitude), firstLocation.longitude);
  assert.equal(Number(afterReplay.entries[0].accuracyMeters), firstLocation.accuracy);
});

test('an expired legacy v1 check-in commits expiry before returning NO_PENDING and retries cleanly', async () => {
  const database = createAttendanceDatabase({
    pendingCheckInAt: new Date(Date.now() - (2 * 60 * 60 * 1_000) - 1_000),
  });
  globalThis.__obraSaasPrisma = database.prisma;
  const token = legacyAttendanceToken();
  const request = () => legacyAttendanceRequest(token, { ...projectLocation, accuracy: 10 });

  const first = await postAttendance(request());
  const firstPayload = await first.json();
  assert.equal(first.status, 409);
  assert.equal(firstPayload.code, 'NO_PENDING_CHECK_IN');
  const afterFirst = database.snapshot();
  assert.equal(afterFirst.entries[0].verificationStatus, 'EXPIRED');
  assert.equal(afterFirst.entries[0].status, 'EXPIRED');
  assert.equal(afterFirst.state.attendance[workerId], undefined);
  assert.equal(afterFirst.stateVersion, 2);
  assert.equal(afterFirst.shifts.length, 0);
  assert.equal(afterFirst.auditCount, 0);

  const retry = await postAttendance(request());
  const retryPayload = await retry.json();
  assert.equal(retry.status, 409);
  assert.equal(retryPayload.code, 'NO_PENDING_CHECK_IN');
  const afterRetry = database.snapshot();
  assert.equal(afterRetry.entries[0].verificationStatus, 'EXPIRED');
  assert.equal(afterRetry.stateVersion, 2);
  assert.equal(afterRetry.auditCount, 0);
});
