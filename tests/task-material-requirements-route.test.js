import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:task-material-route-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:task-material-route-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:task-material-route-server-only', shortCircuit: true };
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
    if (url === 'mock:task-material-route-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:task-material-route-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:task-material-route-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const SCOPE = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
});
const ACCESS = Object.freeze({
  organization: { id: SCOPE.organizationId },
  project: { id: SCOPE.projectId },
  databaseUserId: 'user-a',
});

function request(path = '', init = {}) {
  return new Request(
    `https://obrasaas.test/api/tasks/task-a/material-requirements${path}`,
    {
      ...init,
      headers: {
        'x-request-id': 'task-material-route-test',
        ...(init.headers || {}),
      },
    },
  );
}

async function createHandlers(options) {
  const { createTaskMaterialRequirementHandlers } = await import(
    '../src/app/api/tasks/[taskId]/material-requirements/route.js'
  );
  return createTaskMaterialRequirementHandlers(options);
}

test('GET requires task and inventory read permissions and owns task scope', async () => {
  const authorizations = [];
  const calls = [];
  const prisma = { kind: 'task-material-route-prisma' };
  const handlers = await createHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => prisma,
    listRequirements: async (...args) => {
      calls.push(args);
      return {
        task: { id: 'task-a' },
        head: null,
        readiness: { state: 'NOT_DEFINED', available: false },
        history: [],
        hasMore: false,
        nextCursor: null,
      };
    },
  });

  const response = await handlers.GET(
    request('?limit=25'),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-request-id'), 'task-material-route-test');
  assert.deepEqual(
    authorizations.map(([, permission, options]) => [permission, options]),
    [
      ['org:tasks:read', { subscriptionMode: 'read' }],
      ['org:inventory:read', { subscriptionMode: 'read' }],
    ],
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], prisma);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    taskId: 'task-a',
    limit: 25,
    cursor: null,
  });

  const rejected = await handlers.GET(
    request('?projectId=attacker'),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );
  assert.equal(rejected.status, 400);
  assert.equal(calls.length, 1);
});

test('POST requires both manage permissions and forwards only trusted scope and actor', async () => {
  const authorizations = [];
  const calls = [];
  const readCalls = [];
  const prisma = { kind: 'task-material-route-prisma' };
  const body = {
    expectedActiveRevisionId: null,
    kind: 'MATERIALS_REQUIRED',
    reason: 'Plan inicial',
    lines: [{ inventoryItemId: 'item-a', quantity: '2.500' }],
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
    publishRequirements: async (...args) => {
      calls.push(args);
      return {
        revision: { id: 'revision-a' },
        readiness: { state: 'DEFINED_UNRESERVED', available: false },
        replayed,
      };
    },
  });
  const send = () => handlers.POST(
    request('', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'bom-route-operation-0001' },
    }),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );

  const created = await send();
  assert.equal(created.status, 201);
  assert.equal(created.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.deepEqual(readCalls[0][1], { maxBytes: 128 * 1024 });
  assert.equal(calls[0][0], prisma);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    taskId: 'task-a',
    actorId: 'user-a',
    operationKey: 'bom-route-operation-0001',
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

test('authorization failure stops before reads, body parsing, or domain work', async () => {
  const { AccessError } = await import('../src/lib/access.js');
  let listCalls = 0;
  let bodyCalls = 0;
  let publishCalls = 0;
  const handlers = await createHandlers({
    resolveAccess: async () => ACCESS,
    authorize: (_access, permission) => {
      throw new AccessError(`Falta ${permission}.`, {
        code: 'MISSING_PERMISSION',
        status: 403,
      });
    },
    listRequirements: async () => { listCalls += 1; },
    readBody: async () => { bodyCalls += 1; },
    publishRequirements: async () => { publishCalls += 1; },
  });

  const getResponse = await handlers.GET(
    request(),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );
  const postResponse = await handlers.POST(
    request('', { method: 'POST' }),
    { params: Promise.resolve({ taskId: 'task-a' }) },
  );

  assert.equal(getResponse.status, 403);
  assert.equal(postResponse.status, 403);
  assert.equal(listCalls, 0);
  assert.equal(bodyCalls, 0);
  assert.equal(publishCalls, 0);
  assert.equal(getResponse.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(postResponse.headers.get('x-request-id'), 'task-material-route-test');
});

test('unexpected route failures stay generic and correlation-only', async () => {
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  try {
    const handlers = await createHandlers({
      resolveAccess: async () => ACCESS,
      authorize: () => {},
      listRequirements: async () => {
        throw new Error('database-url-with-secret');
      },
    });
    const response = await handlers.GET(
      request(),
      { params: Promise.resolve({ taskId: 'task-a' }) },
    );
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      error: 'No se pudo cargar la BOM de la tarea.',
      code: 'TASK_MATERIAL_REQUIREMENT_READ_FAILED',
    });
    assert.equal(response.headers.get('x-request-id'), 'task-material-route-test');
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], 'task_material_requirements.unexpected');
    assert.deepEqual(logs[0][1], {
      correlationId: 'task-material-route-test',
      operation: 'read',
      name: 'Error',
      code: null,
    });
    assert.equal(JSON.stringify(logs).includes('database-url-with-secret'), false);
  } finally {
    console.error = originalError;
  }
});
