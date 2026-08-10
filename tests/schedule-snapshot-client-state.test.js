import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeConfirmedBaselineRows,
  mergeConfirmedForecastRows,
  startFailSoftScheduleRefreshes,
} from '../src/lib/schedule-snapshot-client.js';

function deferred() {
  let reject;
  let resolve;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

test('a confirmed POST result remains visible while the forecast GET is slow and then fails', async () => {
  const slowForecast = deferred();
  const confirmed = {
    id: 'forecast-confirmed',
    createdAt: '2026-08-10T12:00:00.000Z',
    finishDeltaDays: 3,
  };
  const forecasts = mergeConfirmedForecastRows([], confirmed);
  const fulfilled = [];
  const rejected = [];
  let refreshSettled = false;

  const refreshPromise = startFailSoftScheduleRefreshes({
    baselines: async () => [{ id: 'baseline-a', status: 'ACTIVE' }],
    forecasts: () => slowForecast.promise,
  }, {
    onFulfilled: (resource) => fulfilled.push(resource),
    onRejected: (resource, error) => rejected.push([resource, error.message]),
  });
  refreshPromise.then(() => { refreshSettled = true; });

  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(forecasts, [confirmed]);
  assert.deepEqual(fulfilled, ['baselines']);
  assert.equal(refreshSettled, false);

  slowForecast.reject(new Error('forecast list unavailable'));
  const results = await refreshPromise;

  assert.equal(refreshSettled, true);
  assert.deepEqual(rejected, [['forecasts', 'forecast list unavailable']]);
  assert.deepEqual(results.map(({ resource, status }) => ({ resource, status })), [
    { resource: 'baselines', status: 'fulfilled' },
    { resource: 'forecasts', status: 'rejected' },
  ]);
  assert.deepEqual(forecasts, [confirmed]);
});

test('confirmed baseline and forecast replays are idempotent in client state', () => {
  const previousBaseline = {
    id: 'baseline-1',
    status: 'ACTIVE',
    version: 1,
  };
  const confirmedBaseline = {
    id: 'baseline-2',
    publishedAt: '2026-08-10T12:00:00.000Z',
    status: 'ACTIVE',
    version: 2,
  };
  let baselines = mergeConfirmedBaselineRows([previousBaseline], confirmedBaseline);
  baselines = mergeConfirmedBaselineRows(baselines, confirmedBaseline);

  assert.equal(baselines.filter(({ id }) => id === confirmedBaseline.id).length, 1);
  assert.equal(baselines.find(({ id }) => id === previousBaseline.id).status, 'SUPERSEDED');
  assert.equal(
    baselines.find(({ id }) => id === previousBaseline.id).supersededById,
    confirmedBaseline.id,
  );

  const confirmedForecast = { id: 'forecast-2', createdAt: '2026-08-10T12:05:00.000Z' };
  let forecasts = mergeConfirmedForecastRows([
    { id: 'forecast-1', createdAt: '2026-08-10T12:00:00.000Z' },
    { id: 'forecast-1', createdAt: '2026-08-10T12:00:00.000Z' },
  ], confirmedForecast);
  forecasts = mergeConfirmedForecastRows(forecasts, confirmedForecast);

  assert.deepEqual(forecasts.map(({ id }) => id), ['forecast-2', 'forecast-1']);
});

test('an old idempotent replay cannot displace a newer forecast returned by GET', () => {
  const replayed = {
    id: 'forecast-replayed-old',
    createdAt: '2026-08-10T12:00:00.000Z',
  };
  const newer = {
    id: 'forecast-newer',
    createdAt: '2026-08-10T13:00:00.000Z',
  };

  const forecasts = mergeConfirmedForecastRows([newer], replayed);

  assert.deepEqual(forecasts.map(({ id }) => id), [newer.id, replayed.id]);
});
