import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertWeeklyReportRateLimits,
  reserveWeeklyReportRateLimit,
  WEEKLY_REPORT_RATE_LIMITS,
  WeeklyReportRateLimitError,
} from '../src/lib/report-rate-limit.js';

test('weekly PDF limits admit normal use and reject actor bursts', () => {
  assert.doesNotThrow(() => assertWeeklyReportRateLimits({
    actorMinuteCount: WEEKLY_REPORT_RATE_LIMITS.actorPerMinute - 1,
    organizationDayCount: 0,
  }));
  assert.throws(
    () => assertWeeklyReportRateLimits({
      actorMinuteCount: WEEKLY_REPORT_RATE_LIMITS.actorPerMinute,
      organizationDayCount: 0,
    }),
    (error) => error instanceof WeeklyReportRateLimitError
      && error.code === 'REPORT_ACTOR_RATE_LIMIT'
      && error.retryAfterSeconds === 60,
  );
});

test('weekly PDF reservation serializes the organization and records one bounded request', async () => {
  const rawCalls = [];
  const countCalls = [];
  const createCalls = [];
  const transaction = {
    $executeRawUnsafe: async (...args) => rawCalls.push(args),
    auditLog: {
      count: async (args) => {
        countCalls.push(args);
        return countCalls.length === 1 ? 2 : 20;
      },
      create: async (args) => createCalls.push(args),
    },
  };

  await reserveWeeklyReportRateLimit(transaction, {
    organizationId: 'org-1',
    actorId: 'user-1',
    projectId: 'project-1',
    now: new Date('2026-07-16T15:00:00.000Z'),
  });

  assert.equal(rawCalls.length, 2);
  assert.match(rawCalls[1][0], /pg_advisory_xact_lock/);
  assert.equal(rawCalls[1][1], 'obrasaas:weekly-report-rate:org-1');
  assert.equal(countCalls.length, 2);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].data.action, 'report.weekly.requested');
  assert.equal(createCalls[0].data.entityId, 'project-1');
});

test('weekly PDF limits bound organization-wide daily generation', () => {
  assert.throws(
    () => assertWeeklyReportRateLimits({
      actorMinuteCount: 0,
      organizationDayCount: WEEKLY_REPORT_RATE_LIMITS.organizationPerDay,
      organizationRetryAfterSeconds: 7_200,
    }),
    (error) => error instanceof WeeklyReportRateLimitError
      && error.code === 'REPORT_ORGANIZATION_RATE_LIMIT'
      && error.retryAfterSeconds === 7_200,
  );
});

test('weekly PDF daily limit reports when the rolling window really reopens', async () => {
  const now = new Date('2026-07-16T15:00:00.000Z');
  const transaction = {
    $executeRawUnsafe: async () => undefined,
    auditLog: {
      count: async ({ where }) => (where.actorId ? 0 : WEEKLY_REPORT_RATE_LIMITS.organizationPerDay),
      findFirst: async () => ({ createdAt: new Date('2026-07-15T17:00:00.000Z') }),
      create: async () => assert.fail('a limited request must not be reserved'),
    },
  };

  await assert.rejects(
    reserveWeeklyReportRateLimit(transaction, {
      organizationId: 'org-1',
      actorId: 'user-1',
      projectId: 'project-1',
      now,
    }),
    (error) => error instanceof WeeklyReportRateLimitError
      && error.code === 'REPORT_ORGANIZATION_RATE_LIMIT'
      && error.retryAfterSeconds === 7_200,
  );
});
