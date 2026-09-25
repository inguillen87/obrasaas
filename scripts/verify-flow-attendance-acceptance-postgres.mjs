import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { authorizeS92DisposableDatabase, S92_DB_FIXTURE } from './seed-s92-e2e-db.mjs';
import { openAuthenticatedFlowAttendanceFixture, ATTENDANCE_ACCEPTANCE } from './lib/s11-flow-attendance-fixture.mjs';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL('../src/' + specifier.slice(2) + (specifier.startsWith('@/generated/') ? '.ts' : '.js'), import.meta.url).href, context);
  return next(specifier, context);
} });
const target = authorizeS92DisposableDatabase(process.env), db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.databaseUrl }) });
const fixture = { primary: { databaseOrganizationId: S92_DB_FIXTURE.organizations.tenantA.id, project: { id: S92_DB_FIXTURE.projects.primary.id } } };
const scope = { organizationId: fixture.primary.databaseOrganizationId, projectId: fixture.primary.project.id };
const report = { status: 'RUNNING', cases: [], environment: 'guarded-loopback-postgresql', clerk: false, providerCalls: 0 };
let seeded;
const check = async (name, fn) => { await fn(); report.cases.push({ name, status: 'PASS' }); };
try {
  const { readProactiveFlowAttendance } = await import('../src/lib/whatsapp/flow-attendance.js');
  await check('empty test database with explicitly synthetic tenant and worksite', async () => {
    assert.equal(await db.organization.count(), 0);
    await db.organization.create({ data: { id: scope.organizationId, name: 'Acceptance fixture', slug: 'acceptance-fixture', subscriptionPlan: 'PRO', subscriptionStatus: 'ACTIVE' } });
    await db.project.create({ data: { id: scope.projectId, organizationId: scope.organizationId, name: 'Synthetic worksite', slug: 'synthetic-worksite', metadata: { synthetic: true }, status: 'ACTIVE' } });
  });
  await check('actual domain reuses one pending entry across both linked forms', async () => {
    seeded = await openAuthenticatedFlowAttendanceFixture(fixture); const snapshot = await seeded.snapshot();
    assert.equal(snapshot.entries.length, 1); assert.equal(snapshot.sessions.length, 3); assert.equal(snapshot.messages.length, 6); assert.equal(snapshot.auditCount, 0);
  });
  await check('actual Prisma reader resolves both receipts and does not infer legacy', async () => {
    const before = await seeded.snapshot();
    for (const [index, row] of seeded.rows.entries()) {
      const result = await readProactiveFlowAttendance({ prisma: db, access: { organization: { id: scope.organizationId }, project: { id: scope.projectId } }, conversationId: ATTENDANCE_ACCEPTANCE.conversationId, messageId: row.sourceId });
      assert.equal(result.state, index === 2 ? 'unlinked' : 'available');
      if (index < 2) assert.equal(result.entry.id, seeded.entry.id);
      assert.equal(JSON.stringify(result).includes(ATTENDANCE_ACCEPTANCE.privateCanary), false);
    }
    assert.deepEqual(await seeded.snapshot(), before);
  });
  await check('duplicate preparation fails and rolls back without changing existing evidence', async () => {
    const before = await seeded.snapshot(); await assert.rejects(openAuthenticatedFlowAttendanceFixture(fixture), { code: 'P2002' }); assert.deepEqual(await seeded.snapshot(), before);
    assert.equal(await db.whatsAppConnection.count(), 0);
  });
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.error = { code: error.code || error.name, message: String(error.message).slice(0, 1200) }; process.exitCode = 1; }
finally { await seeded?.close(); await db.$disconnect(); mkdirSync('evidence', { recursive: true }); writeFileSync('evidence/flow-attendance-acceptance.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); }
