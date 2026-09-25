import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { buildFlowAttendanceAcceptance, openAuthenticatedFlowAttendanceFixture, ATTENDANCE_ACCEPTANCE } from '../scripts/lib/s11-flow-attendance-fixture.mjs';
import { S92_DB_FIXTURE } from '../scripts/seed-s92-e2e-db.mjs';
const scope = { organizationId: S92_DB_FIXTURE.organizations.tenantA.id, projectId: S92_DB_FIXTURE.projects.primary.id };
const now = new Date('2026-09-24T12:00:00.000Z');
test('attendance acceptance records are deterministic and separate two receipts from legacy', () => {
  const rows = buildFlowAttendanceAcceptance(scope, now); assert.deepEqual(rows, buildFlowAttendanceAcceptance(scope, now));
  assert.equal(rows.length, 3); assert.equal(ATTENDANCE_ACCEPTANCE.count, 3); assert.deepEqual(rows.map(row => row.legacy), [false, false, true]);
  for (const field of ['sourceId', 'replyId', 'sessionId', 'externalId', 'providerMessageId', 'consumedExternalId', 'tokenSha256']) assert.equal(new Set(rows.map(row => row[field])).size, 3);
});
test('fixture timestamp ordering satisfies issue delivery consumption and expiry chronology', () => {
  for (const row of buildFlowAttendanceAcceptance(scope, now)) {
    assert.ok(row.createdAt < row.consumedAt); assert.ok(row.consumedAt < now); assert.ok(now < row.expiresAt);
    assert.match(row.tokenSha256, /^[a-f0-9]{64}$/); assert.match(row.sessionId, /^[a-f0-9-]{36}$/);
  }
});
for (const bad of [{ ...scope, organizationId: 'real-org' }, { ...scope, projectId: 'other-project' }, null]) test('foreign fixture identity rejected before persistence: ' + JSON.stringify(bad), () => {
  assert.throws(() => buildFlowAttendanceAcceptance(bad, now));
});
for (const invalid of [null, '2026-09-24', new Date('bad')]) test('invalid clock never creates acceptance rows: ' + String(invalid), () => {
  assert.throws(() => buildFlowAttendanceAcceptance(scope, invalid));
});
test('database access requires explicit disposable flag and loopback exact database', async () => {
  for (const environment of [{}, { S92_E2E_DISPOSABLE: '1', DATABASE_URL: 'postgresql://fixture:fixture@remote.invalid/obrasaas_e2e' }, { S92_E2E_DISPOSABLE: '1', DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1/production' }]) {
    await assert.rejects(openAuthenticatedFlowAttendanceFixture({}, environment));
  }
});
test('the new journey is wired before history sign-out and keeps real HTTP identity boundaries', () => {
  const integration = fs.readFileSync(new URL('../e2e/s92-authenticated.spec.js', import.meta.url), 'utf8');
  assert.ok(integration.indexOf('await verifyAuthenticatedFlowAttendance(') < integration.indexOf('await verifyAuthenticatedFlowHistory('));
  const source = fs.readFileSync(new URL('../e2e/s11-flow-attendance-journey.js', import.meta.url), 'utf8');
  assert.equal((source.match(/await test.step\('S11-ATTENDANCE:/g) || []).length, 4);
  assert.doesNotMatch(source, /route\.(?:fulfill|abort)|routeFromHAR|addInitScript/);
  assert.match(source, /httpWrites: 0/); assert.match(source, /completeWebhookIngressTested: false/);
});
