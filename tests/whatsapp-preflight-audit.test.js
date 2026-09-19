import assert from 'node:assert/strict';
import test from 'node:test';
import { reserveMetaPreflight, recordMetaPreflight } from '../src/lib/whatsapp/platform-preflight-audit.js';
const context = { organizationId: 'org-a', projectId: 'project-a', actorId: 'actor-a', now: new Date('2026-09-18T12:00:00Z') };
function fake(count = 0) {
  const calls = [];
  const tx = { $executeRawUnsafe: async (...args) => { calls.push({ type: 'lock', args }); },
    project: { findFirst: async ({ where }) => { assert.deepEqual(where, { id: context.projectId, organizationId: context.organizationId }); return { id: context.projectId }; } },
    auditLog: { count: async ({ where }) => { calls.push({ type: 'count', where }); return count; }, create: async ({ data }) => { calls.push({ type: 'create', data }); return { id: 'request-a' }; } } };
  return { calls, prisma: { ...tx, $transaction: operation => operation(tx) } };
}
test('reserve enforces actor-wide cooldown under a database lock', async () => {
  const { prisma, calls } = fake(2); const result = await reserveMetaPreflight(prisma, context);
  assert.equal(result.id, 'request-a'); assert.match(calls[1].args[0], /pg_advisory_xact_lock/);
  assert.equal(calls[2].where.actorId, context.actorId); assert.equal(calls[2].where.organizationId, undefined);
  assert.equal(calls[3].data.organizationId, context.organizationId); assert.equal(calls[3].data.entityId, context.projectId);
});
test('third previous request blocks another query reservation', async () => {
  const { prisma, calls } = fake(3); await assert.rejects(reserveMetaPreflight(prisma, context), { code: 'META_PREFLIGHT_RATE_LIMIT', status: 429 });
  assert.equal(calls.filter(call => call.type === 'create').length, 0);
});
test('invalid identity cannot reserve an external probe', async () => {
  await assert.rejects(reserveMetaPreflight({}, { ...context, actorId: '' }));
});
test('stored result contains codes only, not returned provider fields', async () => {
  const { prisma, calls } = fake(); const report = { authentication: { code: 'APP_AUTHENTICATED', ignoredToken: 'secret' }, webhook: { code: 'CALLBACK_MISMATCH' }, checkedAt: context.now.toISOString(), provider: 'secret' };
  await recordMetaPreflight(prisma, { ...context, requestId: 'request-a', report });
  const serialized = JSON.stringify(calls); assert.ok(!serialized.includes('secret')); assert.equal(calls[0].data.metadata.provesOperationalTraffic, false);
});
