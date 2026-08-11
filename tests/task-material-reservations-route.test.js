import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:task-material-reservation-route-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:task-material-reservation-route-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:task-material-reservation-route-server-only', shortCircuit: true };
    }
    if (specifier.startsWith('@/')) {
      const extension = specifier.startsWith('@/generated/') ? '.ts' : '.js';
      return nextResolve(
        new URL(`../src/${specifier.slice(2)}${extension}`, import.meta.url).href,
        context,
      );
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === 'mock:task-material-reservation-route-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:task-material-reservation-route-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:task-material-reservation-route-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const ACCESS = Object.freeze({
  organization: { id: SCOPE.organizationId },
  project: { id: SCOPE.projectId },
  databaseUserId: 'user-a',
});

function request(init = {}, path = '') {
  return new Request(
    `https://obrasaas.test/api/tasks/task-a/material-reservations${path}`,
    {
      method: 'POST',
      ...init,
      headers: {
        'x-request-id': 'task-material-reservation-route-test',
        ...(init.headers || {}),
      },
    },
  );
}

test('GET requires both read permissions and returns a no-store trusted snapshot', async () => {
  const authorizations = [];
  const calls = [];
  const prisma = { kind: 'task-material-reservation-read-prisma' };
  const handlers = await createHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => prisma,
    readReservation: async (...args) => {
      calls.push(args);
      return {
        task: { id: 'task-a', revision: 3 },
        requirementRevision: null,
        reservationHead: null,
        readiness: {
          state: 'NOT_DEFINED',
          available: false,
          requiredLineCount: 0,
          coveredLineCount: 0,
        },
        lineBalances: [],
        availability: [],
      };
    },
  });
  const response = await handlers.GET(
    request({ method: 'GET' }),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-request-id'), 'task-material-reservation-route-test');
  assert.equal(calls[0][0], prisma);
  assert.deepEqual(calls[0][1], { scope: SCOPE, taskId: 'task-a' });
  assert.deepEqual(
    authorizations.map(([, permission, options]) => [permission, options]),
    [
      ['org:tasks:read', { subscriptionMode: 'read' }],
      ['org:inventory:read', { subscriptionMode: 'read' }],
    ],
  );

  const rejected = await handlers.GET(
    request({ method: 'GET' }, '?projectId=project-attacker'),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );
  assert.equal(rejected.status, 400);
  assert.equal(calls.length, 1);
});

async function createHandlers(options) {
  const { createTaskMaterialReservationHandlers } = await import(
    '../src/app/api/tasks/[taskId]/material-reservations/route.js'
  );
  return createTaskMaterialReservationHandlers(options);
}

test('POST requires both manage permissions and forwards only trusted scope and actor', async () => {
  const authorizations = [];
  const calls = [];
  const readCalls = [];
  const prisma = { kind: 'task-material-reservation-route-prisma' };
  const body = {
    kind: 'RESERVE',
    expectedRequirementRevisionId: 'revision-a',
    expectedReservationHeadId: null,
    reason: 'Reserva completa',
    allocations: [
      { requirementLineId: 'line-a', locationId: 'location-a', quantity: '2.500' },
    ],
  };
  let replayed = false;
  const handlers = await createHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => prisma,
    readBody: async (...args) => {
      readCalls.push(args);
      return body;
    },
    applyReservation: async (...args) => {
      calls.push(args);
      return {
        transaction: { id: 'reservation-a' },
        readiness: { state: 'AVAILABLE', available: true },
        replayed,
      };
    },
  });
  const send = () => handlers.POST(
    request({ headers: { 'Idempotency-Key': 'reservation-route-operation-0001' } }),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );

  const created = await send();
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(created.headers.get('x-request-id'), 'task-material-reservation-route-test');
  assert.deepEqual(readCalls[0][1], { maxBytes: 256 * 1024 });
  assert.equal(calls[0][0], prisma);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    taskId: 'task-a',
    actorId: 'user-a',
    operationKey: 'reservation-route-operation-0001',
    input: body,
  });
  assert.deepEqual(
    authorizations.slice(0, 2).map(([, permission, options]) => [permission, options]),
    [
      ['org:tasks:manage', { subscriptionMode: 'write' }],
      ['org:inventory:manage', { subscriptionMode: 'write' }],
    ],
  );

  replayed = true;
  const replay = await send();
  assert.equal(replay.status, 200);
});

test('authorization failure stops before body parsing and domain work', async () => {
  const { AccessError } = await import('../src/lib/access.js');
  let bodyCalls = 0;
  let reservationCalls = 0;
  const handlers = await createHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (_access, permission) => {
      throw new AccessError(`Falta ${permission}.`, {
        code: 'MISSING_PERMISSION',
        status: 403,
      });
    },
    readBody: async () => { bodyCalls += 1; },
    applyReservation: async () => { reservationCalls += 1; },
  });

  const response = await handlers.POST(
    request(),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );
  assert.equal(response.status, 403);
  assert.equal(bodyCalls, 0);
  assert.equal(reservationCalls, 0);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('known domain failures are safe and keep correlation metadata', async () => {
  const { TaskMaterialReservationError } = await import(
    '../src/lib/task-material-reservations.js'
  );
  const handlers = await createHandlers({
    resolveAccess: async () => ACCESS,
    authorize: () => {},
    prismaFactory: () => ({ kind: 'known-error-prisma' }),
    readBody: async () => ({}),
    applyReservation: async () => {
      throw new TaskMaterialReservationError(
        'No hay stock disponible suficiente para reservar la BOM completa.',
        'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK',
        409,
      );
    },
  });
  const response = await handlers.POST(
    request(),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );

  assert.equal(response.status, 409);
  assert.equal(response.headers.get('x-request-id'), 'task-material-reservation-route-test');
  assert.deepEqual(await response.json(), {
    error: 'No hay stock disponible suficiente para reservar la BOM completa.',
    code: 'TASK_MATERIAL_RESERVATION_INSUFFICIENT_STOCK',
  });
});

test('unexpected failures stay generic and log correlation-only metadata', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const handlers = await createHandlers({
      resolveAccess: async () => ACCESS,
      authorize: () => {},
      prismaFactory: () => ({ kind: 'unexpected-error-prisma' }),
      readBody: async () => ({}),
      applyReservation: async () => {
        throw new Error('database-url-with-secret');
      },
    });
    const response = await handlers.POST(
      request(),
      { params: Promise.resolve({ taskId: 'task-a' }) },
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'No se pudo modificar la reserva de materiales.',
      code: 'TASK_MATERIAL_RESERVATION_WRITE_FAILED',
    });
    assert.deepEqual(logs[0], [
      'task_material_reservations.unexpected',
      {
        correlationId: 'task-material-reservation-route-test',
        operation: 'apply',
        name: 'Error',
        code: null,
      },
    ]);
    assert.equal(JSON.stringify(logs).includes('database-url-with-secret'), false);
  } finally {
    console.error = originalError;
  }
});
