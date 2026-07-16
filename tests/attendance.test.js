import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ATTENDANCE_GEO_WINDOW_MS,
  completePendingGeoAttendance,
  ensurePendingGeoAttendance,
} from '../src/lib/attendance.js';

const now = new Date('2026-07-16T12:00:00.000Z');

test('pending attendance completion uses a status compare-and-swap', async () => {
  let updateArgs;
  const prisma = {
    attendanceEntry: {
      findFirst: async () => ({
        id: 'attendance-a',
        status: 'PENDING_GEO',
        metadata: { source: 'whatsapp' },
      }),
      updateMany: async (args) => {
        updateArgs = args;
        return { count: 1 };
      },
    },
  };

  const completed = await completePendingGeoAttendance(prisma, {
    projectId: 'project-a',
    workerId: 'worker-a',
    now,
    latitude: -34.5886,
    longitude: -58.4302,
    distanceMeters: 12,
    inside: true,
    accuracy: 18,
  });

  assert.deepEqual(updateArgs.where, {
    id: 'attendance-a',
    projectId: 'project-a',
    workerId: 'worker-a',
    status: 'PENDING_GEO',
  });
  assert.equal(updateArgs.data.status, 'PRESENT');
  assert.equal(completed.id, 'attendance-a');
  assert.equal(completed.status, 'PRESENT');
});

test('a lost attendance race returns null and cannot authorize a snapshot mutation', async () => {
  const prisma = {
    attendanceEntry: {
      findFirst: async () => ({ id: 'attendance-a', status: 'PENDING_GEO', metadata: null }),
      updateMany: async () => ({ count: 0 }),
    },
  };

  const completed = await completePendingGeoAttendance(prisma, {
    projectId: 'project-a',
    workerId: 'worker-a',
    now,
    latitude: -34.5886,
    longitude: -58.4302,
    distanceMeters: 12,
    inside: true,
    accuracy: 18,
  });

  assert.equal(completed, null);
});

test('starting attendance expires stale pending rows before creating a new request', async () => {
  const calls = [];
  const prisma = {
    attendanceEntry: {
      findFirst: async () => null,
      updateMany: async (args) => {
        calls.push(['expire', args]);
        return { count: 1 };
      },
      create: async (args) => {
        calls.push(['create', args]);
        return { id: 'attendance-new', ...args.data };
      },
    },
  };

  const pending = await ensurePendingGeoAttendance(prisma, {
    projectId: 'project-a',
    workerId: 'worker-a',
    now,
    metadata: { source: 'test' },
  });

  assert.equal(pending.id, 'attendance-new');
  assert.equal(calls[0][1].where.checkedInAt.lt.toISOString(), new Date(
    now.getTime() - ATTENDANCE_GEO_WINDOW_MS,
  ).toISOString());
  assert.equal(calls[0][1].data.status, 'ABSENT');
  assert.equal(calls[1][1].data.status, 'PENDING_GEO');
});

test('a concurrent pending-attendance winner is reused after the partial unique constraint wins', async () => {
  let findCalls = 0;
  const winner = { id: 'attendance-winner', status: 'PENDING_GEO' };
  const prisma = {
    attendanceEntry: {
      findFirst: async () => {
        findCalls += 1;
        return findCalls === 1 ? null : winner;
      },
      updateMany: async () => ({ count: 0 }),
      create: async () => {
        const error = new Error('Unique constraint');
        error.code = 'P2002';
        throw error;
      },
    },
  };

  const pending = await ensurePendingGeoAttendance(prisma, {
    projectId: 'project-a',
    workerId: 'worker-a',
    now,
  });

  assert.equal(pending, winner);
  assert.equal(findCalls, 2);
});
