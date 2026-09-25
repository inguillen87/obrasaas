import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { authorizeS92DisposableDatabase, assertS92ClientSocketIdentity, assertS92RuntimeDatabaseIdentity, S92_DB_FIXTURE } from '../seed-s92-e2e-db.mjs';
import { getWhatsAppFlowBlueprint } from '../../src/lib/whatsapp/flows.js';
import { ensurePendingGeoAttendance } from '../../src/lib/attendance.js';
import { buildFlowAttendanceReceipt } from '../../src/lib/whatsapp/flow-attendance-policy.js';

export const ATTENDANCE_ACCEPTANCE = Object.freeze({
  conversationId: 's11e2e_attendance_conversation', workerId: 's11e2e_attendance_worker',
  displayName: 'Ingreso vinculado de ensayo', privateCanary: 'S11_ATTENDANCE_PRIVATE_CANARY', count: 3,
});
export function buildFlowAttendanceAcceptance(scope, now) {
  assert.equal(scope?.organizationId, S92_DB_FIXTURE.organizations.tenantA.id);
  assert.equal(scope?.projectId, S92_DB_FIXTURE.projects.primary.id);
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()));
  return Array.from({ length: ATTENDANCE_ACCEPTANCE.count }, (_, index) => {
    const createdAt = new Date(now.getTime() - (6 - index) * 60000);
    const consumedAt = new Date(now.getTime() - (3 - index) * 30000);
    return {
      sourceId: 's11e2e_attendance_message_' + index, replyId: 's11e2e_attendance_reply_' + index,
      sessionId: '42000000-0000-4000-8000-' + String(index).padStart(12, '0'),
      externalId: 'obrasaas-flow-template:s11e2e-attendance-' + index,
      providerMessageId: 'wamid.synthetic.attendance.' + index,
      consumedExternalId: 'wamid.synthetic.attendance.reply.' + index,
      createdAt, consumedAt, expiresAt: new Date(now.getTime() + 3600000),
      tokenSha256: createHash('sha256').update('synthetic-s11-attendance-' + index).digest('hex'),
      legacy: index === 2,
    };
  });
}

// Guarded fixture only: real attendance domain + Prisma persistence, not Meta ingress.
// No sending connection, credentials or production data are created or consulted.
export async function openAuthenticatedFlowAttendanceFixture(fixture, environment = process.env) {
  const target = authorizeS92DisposableDatabase(environment);
  const scope = { organizationId: fixture.primary.databaseOrganizationId, projectId: fixture.primary.project.id };
  const rows = buildFlowAttendanceAcceptance(scope, new Date());
  const identity = new pg.Client({ connectionString: target.databaseUrl, statement_timeout: 10000, connectionTimeoutMillis: 5000 });
  let db;
  try {
    await identity.connect(); assertS92ClientSocketIdentity(identity.connection.stream, target.port);
    assertS92RuntimeDatabaseIdentity((await identity.query('SELECT current_database() AS database_name, inet_server_port() AS server_port')).rows[0]);
    const { PrismaClient } = await import('../../src/generated/prisma/client.ts');
    const { PrismaPg } = await import('@prisma/adapter-pg');
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.databaseUrl }) });
    const project = await db.project.findFirst({ where: { id: scope.projectId, organizationId: scope.organizationId }, select: { id: true, metadata: true } });
    assert.equal(project?.metadata?.synthetic, true);
    assert.equal(await db.whatsAppConnection.count({ where: { projectId: scope.projectId } }), 0);
    const workerId = ATTENDANCE_ACCEPTANCE.workerId;
    let entry;
    await db.$transaction(async tx => {
      await tx.worker.create({ data: { id: workerId, ...scope, name: 'Persona sintética de asistencia', active: true } });
      await tx.conversation.create({ data: { id: ATTENDANCE_ACCEPTANCE.conversationId, projectId: scope.projectId, channel: 'whatsapp', externalId: 'meta:5497777777777', displayName: ATTENDANCE_ACCEPTANCE.displayName } });
      const pendingAt = new Date(rows[0].createdAt.getTime() - 300000);
      entry = await ensurePendingGeoAttendance(tx, { projectId: scope.projectId, workerId, source: 'meta', now: pendingAt, idempotencyKey: 's11-attendance-before-form', timezone: 'America/Argentina/Buenos_Aires' });
      for (const row of rows) {
        const pending = await ensurePendingGeoAttendance(tx, { projectId: scope.projectId, workerId, source: 'meta', now: row.consumedAt, idempotencyKey: row.consumedExternalId, timezone: 'America/Argentina/Buenos_Aires' });
        assert.equal(pending.id, entry.id, 'The attendance domain must reuse the existing pending entry.');
        const session = await tx.whatsAppFlowSession.create({ data: {
          id: row.sessionId, ...scope, workerId, phoneNumberId: '777777777777777', recipientPhone: '5497777777777', blueprintKey: 'shift-check-in',
          flowId: '888888888888888', screenId: getWhatsAppFlowBlueprint('shift-check-in').screenId, flowType: 'attendance', sourceExternalId: row.externalId, tokenSha256: row.tokenSha256,
          createdAt: row.createdAt, expiresAt: row.expiresAt, deliveryAttemptedAt: row.createdAt, sentAt: row.createdAt, providerMessageId: row.providerMessageId,
          consumedAt: row.consumedAt, consumedExternalId: row.consumedExternalId,
        } });
        await tx.message.create({ data: { id: row.sourceId, conversationId: ATTENDANCE_ACCEPTANCE.conversationId, direction: 'OUTBOUND', kind: 'INTERACTIVE', externalId: row.externalId,
          providerMessageId: row.providerMessageId, body: 'Formulario de ingreso de ensayo', status: 'delivered', createdAt: row.createdAt, sentAt: row.createdAt,
          metadata: { messageType: 'whatsapp_flow_template', blueprintKey: 'shift-check-in', flowSessionId: session.id, recipient: ATTENDANCE_ACCEPTANCE.privateCanary } } });
        await tx.message.create({ data: { id: row.replyId, conversationId: ATTENDANCE_ACCEPTANCE.conversationId, direction: 'INBOUND', kind: 'INTERACTIVE', externalId: row.consumedExternalId,
          body: 'Formulario de ingreso recibido.', createdAt: row.consumedAt, sentAt: row.consumedAt,
          metadata: { provider: 'meta', authorized: true, workerId, whatsappFlowSessionId: session.id, whatsappFlowBlueprintKey: session.blueprintKey,
            recipient: ATTENDANCE_ACCEPTANCE.privateCanary, ...(row.legacy ? {} : { flowAttendanceReceipt: buildFlowAttendanceReceipt(pending, session) }) } } });
      }
    }, { timeout: 15000 });
    await identity.end();
    async function snapshot() {
      return JSON.parse(JSON.stringify({
        entries: await db.attendanceEntry.findMany({ where: { projectId: scope.projectId, workerId }, orderBy: { id: 'asc' } }),
        shifts: await db.attendanceShift.findMany({ where: { projectId: scope.projectId, workerId }, orderBy: { id: 'asc' } }),
        messages: await db.message.findMany({ where: { conversationId: ATTENDANCE_ACCEPTANCE.conversationId }, orderBy: { id: 'asc' } }),
        sessions: await db.whatsAppFlowSession.findMany({ where: { projectId: scope.projectId, workerId }, orderBy: { id: 'asc' } }),
        auditCount: await db.auditLog.count(),
      }));
    }
    return { rows, entry, snapshot, close: () => db.$disconnect() };
  } catch (error) { await identity.end().catch(() => {}); await db?.$disconnect().catch(() => {}); throw error; }
}
