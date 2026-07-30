import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@clerk/nextjs/server') {
      return { url: 'mock:schedule-detail-clerk', shortCircuit: true };
    }
    if (specifier === 'next/headers') {
      return { url: 'mock:schedule-detail-next-headers', shortCircuit: true };
    }
    if (specifier === 'server-only') {
      return { url: 'mock:schedule-detail-server-only', shortCircuit: true };
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
    if (url === 'mock:schedule-detail-clerk') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export async function auth() { throw new Error('Unexpected auth call.'); }
          export async function clerkClient() { throw new Error('Unexpected Clerk call.'); }
        `,
      };
    }
    if (url === 'mock:schedule-detail-next-headers') {
      return {
        format: 'module',
        shortCircuit: true,
        source: `export async function cookies() { throw new Error('Unexpected cookie call.'); }`,
      };
    }
    if (url === 'mock:schedule-detail-server-only') {
      return { format: 'module', shortCircuit: true, source: '' };
    }
    return nextLoad(url, context);
  },
});

const [
  { createScheduleForecastDetailHandler },
  { ScheduleSnapshotError, getScheduleForecastRun },
] = await Promise.all([
  import('../src/app/api/schedule/forecasts/[forecastId]/route.js'),
  import('../src/lib/schedule-snapshots.js'),
]);

const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });

function access() {
  return {
    databaseUserId: 'user-a',
    organization: { id: SCOPE.organizationId },
    project: { id: SCOPE.projectId, organizationId: SCOPE.organizationId },
    subscription: { canRead: true, canWrite: true },
    tenantRole: 'DIRECTOR',
  };
}

function request(path) {
  return new Request(`https://app.obrasaas.test${path}`, {
    headers: { 'x-request-id': 'request-forecast-detail' },
  });
}

test('forecast detail route requires task-read and injects only trusted tenant scope', async () => {
  const authorizations = [];
  const calls = [];
  const handler = createScheduleForecastDetailHandler({
    resolveAccess: async () => access(),
    authorize: (...args) => authorizations.push(args),
    prismaFactory: () => ({ kind: 'detail-prisma' }),
    getForecast: async (...args) => {
      calls.push(args);
      return { forecast: { id: 'forecast-a', tasks: [] } };
    },
  });
  const response = await handler(request('/api/schedule/forecasts/forecast-a'), {
    params: Promise.resolve({ forecastId: 'forecast-a' }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /private/i);
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.equal(response.headers.get('x-request-id'), 'request-forecast-detail');
  assert.deepEqual(authorizations.map(([, permission, options]) => [permission, options]), [
    ['org:tasks:read', { subscriptionMode: 'read' }],
  ]);
  assert.deepEqual(calls[0][1], {
    scope: SCOPE,
    forecastId: 'forecast-a',
  });

  const invalid = await handler(request('/api/schedule/forecasts/forecast-a?projectId=attacker'), {
    params: Promise.resolve({ forecastId: 'forecast-a' }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'SCHEDULE_QUERY_INVALID');
  assert.equal(calls.length, 1);
});

function forecastRow() {
  const asOf = new Date('2026-07-29T00:00:00.000Z');
  return {
    id: 'forecast-a',
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    baselineId: 'baseline-a',
    engineVersion: 'deterministic-civil-days-v1',
    calendarPolicy: 'CIVIL_CALENDAR_DAYS_V1',
    asOfDate: asOf,
    baselineStartDate: new Date('2026-07-20T00:00:00.000Z'),
    baselineFinishDate: new Date('2026-07-30T00:00:00.000Z'),
    forecastStartDate: new Date('2026-07-20T00:00:00.000Z'),
    forecastFinishDate: new Date('2026-08-02T00:00:00.000Z'),
    startDeltaDays: 0,
    finishDeltaDays: 3,
    taskCount: 1,
    inputHash: 'a'.repeat(64),
    resultHash: 'b'.repeat(64),
    topologicalOrder: ['task-a'],
    createdAt: new Date('2026-07-29T18:00:00.000Z'),
    tasks: [{
      id: 'forecast-task-a',
      sourceTaskId: 'task-a',
      observedTaskRevision: 8,
      progressSource: 'REVIEWED_EVIDENCE',
      progressObservationId: 'private-progress-observation-id',
      progressObservation: {
        rationale: 'private rationale',
        evidenceSha256: 'c'.repeat(64),
        latitude: -32.8,
        longitude: -68.8,
      },
      progressPercent: 45,
      observedOn: asOf,
      actualStart: new Date('2026-07-20T00:00:00.000Z'),
      actualFinish: null,
      remainingDurationDays: 4,
      baselineStart: new Date('2026-07-20T00:00:00.000Z'),
      baselineFinish: new Date('2026-07-30T00:00:00.000Z'),
      forecastStart: new Date('2026-07-20T00:00:00.000Z'),
      forecastFinish: new Date('2026-08-02T00:00:00.000Z'),
      forecastDurationDays: 14,
      forecastRemainingDays: 4,
      startDeltaDays: 0,
      finishDeltaDays: 3,
      durationDeltaDays: 3,
      driver: { kind: 'DATA_DATE_AND_REMAINING_DURATION' },
      relationshipConstraints: [],
      baselineTask: { code: '2.1', title: 'Mampostería', type: 'TASK' },
    }],
  };
}

test('forecast detail is tenant-scoped and returns safe immutable task fields without observation internals', async () => {
  const queries = [];
  const result = await getScheduleForecastRun({
    scheduleForecastRun: {
      async findFirst(args) {
        queries.push(args);
        return forecastRow();
      },
    },
  }, { scope: SCOPE, forecastId: 'forecast-a' });
  assert.deepEqual(queries[0].where, { ...SCOPE, id: 'forecast-a' });
  assert.deepEqual(queries[0].include, {
    tasks: {
      include: {
        baselineTask: { select: { code: true, title: true, type: true } },
      },
    },
  });
  assert.deepEqual(Object.keys(result.forecast.tasks[0]).sort(), [
    'actualFinish',
    'actualStart',
    'baselineFinish',
    'baselineStart',
    'code',
    'driver',
    'durationDeltaDays',
    'finishDeltaDays',
    'forecastDurationDays',
    'forecastFinish',
    'forecastRemainingDays',
    'forecastStart',
    'observedOn',
    'progressPercent',
    'progressSource',
    'relationshipConstraints',
    'remainingDurationDays',
    'sourceTaskId',
    'startDeltaDays',
    'title',
    'type',
  ]);
  const serialized = JSON.stringify(result);
  for (const privateValue of [
    'private-progress-observation-id',
    'private rationale',
    'evidenceSha256',
    'latitude',
    'longitude',
    'observedTaskRevision',
  ]) {
    assert.equal(serialized.includes(privateValue), false, `detail leaked ${privateValue}`);
  }

  const missing = { scheduleForecastRun: { findFirst: async () => null } };
  await assert.rejects(
    getScheduleForecastRun(missing, {
      scope: { organizationId: 'organization-b', projectId: 'project-b' },
      forecastId: 'forecast-a',
    }),
    (error) => error instanceof ScheduleSnapshotError
      && error.code === 'SCHEDULE_FORECAST_NOT_FOUND'
      && error.status === 404,
  );
});
