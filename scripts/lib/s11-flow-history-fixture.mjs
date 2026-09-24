import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { authorizeS92DisposableDatabase, assertS92ClientSocketIdentity, assertS92RuntimeDatabaseIdentity, S92_DB_FIXTURE } from '../seed-s92-e2e-db.mjs';

export const FLOW_HISTORY_ACCEPTANCE = Object.freeze({
  conversationId: 's11e2e_history_conversation',
  otherConversationId: 's11e2e_history_foreign',
  displayName: 'Seguimiento autenticado de ensayo',
  workerId: 's11e2e_history_worker',
  count: 26,
  privateCanary: 'S11_HISTORY_PRIVATE_METADATA_CANARY',
});
const id = index => 's11e2e_history_message_' + String(index).padStart(3, '0');
const sessionId = index => '41000000-0000-4000-8000-' + String(index).padStart(12, '0');

// Synthetic data only. Construction is pure; SQL access is guarded separately.
export function buildAuthenticatedFlowHistory(scope, now) {
  assert.equal(scope.organizationId, S92_DB_FIXTURE.organizations.tenantA.id);
  assert.equal(scope.projectId, S92_DB_FIXTURE.projects.primary.id);
  assert.ok(now instanceof Date && Number.isFinite(now.getTime()));
  return Array.from({ length: FLOW_HISTORY_ACCEPTANCE.count }, (_, index) => {
    const createdAt = new Date(now.getTime() - (index + 1) * 60000);
    const uncertain = index === 1, manual = index === 3;
    const reference = uncertain || manual ? null : 'wamid.synthetic.history.' + index;
    return {
      id: id(index), sessionId: sessionId(index), createdAt,
      externalId: 'obrasaas-flow-template:s11e2e-history-' + index,
      body: 'Formulario de ensayo autenticado ' + String(index).padStart(3, '0'),
      status: manual ? 'failed' : uncertain ? 'unknown' : index === 0 ? 'delivered' : 'accepted',
      reference, sentAt: manual || uncertain ? null : createdAt,
      attemptedAt: manual || uncertain ? null : createdAt,
      expiresAt: new Date(now.getTime() + (index === 2 ? -120000 : 3600000)),
      // Expired example still has creation/send before its original expiry.
      sessionCreatedAt: createdAt,
      consumedAt: index === 0 ? new Date(now.getTime() - 1000) : null,
      consumedExternalId: index === 0 ? 'wamid.synthetic.history.reply.0' : null,
      tokenSha256: createHash('sha256').update('synthetic-s11-history-' + index).digest('hex'),
      metadata: { messageType: 'whatsapp_flow_template', blueprintKey: 'incident-report', flowSessionId: sessionId(index),
        recipient: FLOW_HISTORY_ACCEPTANCE.privateCanary, flowToken: FLOW_HISTORY_ACCEPTANCE.privateCanary,
        ...(manual ? { uncertaintyResolution: { decision: 'ALLOW_NEW_ATTEMPT', riskAccepted: true } } : {}) },
    };
  });
}

export async function openAuthenticatedFlowHistoryFixture(fixture, environment = process.env) {
  const target = authorizeS92DisposableDatabase(environment);
  assert.equal(fixture.primary.databaseOrganizationId, S92_DB_FIXTURE.organizations.tenantA.id);
  assert.equal(fixture.primary.project.id, S92_DB_FIXTURE.projects.primary.id);
  assert.equal(fixture.otherTenant.databaseOrganizationId, S92_DB_FIXTURE.organizations.tenantB.id);
  assert.equal(fixture.otherTenant.anchorProjectId, S92_DB_FIXTURE.projects.isolation.id);
  const db = new pg.Client({ connectionString: target.databaseUrl, statement_timeout: 10000, connectionTimeoutMillis: 5000 });
  try {
    await db.connect(); assertS92ClientSocketIdentity(db.connection.stream, target.port);
    const identity = await db.query('SELECT current_database() AS database_name, inet_server_port() AS server_port');
    assertS92RuntimeDatabaseIdentity(identity.rows[0]);
    const projects = await db.query('SELECT id, "organizationId", metadata FROM "Project" WHERE id=ANY($1::text[]) ORDER BY id', [[fixture.primary.project.id, fixture.otherTenant.anchorProjectId]]);
    assert.equal(projects.rowCount, 2);
    for (const project of projects.rows) {
      assert.equal(project.metadata?.synthetic, true);
      assert.equal(project.organizationId, project.id === fixture.primary.project.id ? fixture.primary.databaseOrganizationId : fixture.otherTenant.databaseOrganizationId);
    }
    const connections = await db.query('SELECT count(*)::int AS n FROM "WhatsAppConnection" WHERE "projectId"=ANY($1::text[])', [[fixture.primary.project.id, fixture.otherTenant.anchorProjectId]]);
    assert.equal(connections.rows[0].n, 0, 'Acceptance must not have a sending channel.');
    const scope = { organizationId: fixture.primary.databaseOrganizationId, projectId: fixture.primary.project.id };
    const now = new Date(), rows = buildAuthenticatedFlowHistory(scope, now);
    await db.query('BEGIN');
    await db.query(`INSERT INTO "Worker" (id,"organizationId","projectId",name,active,"updatedAt") VALUES ($1,$2,$3,$4,true,$5)`, [FLOW_HISTORY_ACCEPTANCE.workerId, scope.organizationId, scope.projectId, 'Persona ficticia de aceptación', now]);
    for (const [conversationId, projectId, phone] of [[FLOW_HISTORY_ACCEPTANCE.conversationId, scope.projectId, '5491111111111'], [FLOW_HISTORY_ACCEPTANCE.otherConversationId, fixture.otherTenant.anchorProjectId, '5492222222222']]) {
      await db.query(`INSERT INTO "Conversation" (id,"projectId",channel,"externalId","displayName","lastMessageAt","updatedAt") VALUES ($1,$2,'whatsapp',$3,$4,$5,$5)`, [conversationId, projectId, 'meta:' + phone, FLOW_HISTORY_ACCEPTANCE.displayName, now]);
    }
    for (const row of rows) {
      await db.query(`INSERT INTO "Message" (id,"conversationId",direction,kind,"externalId","providerMessageId",body,status,metadata,"createdAt","sentAt") VALUES ($1,$2,'OUTBOUND','INTERACTIVE',$3,$4,$5,$6,$7::jsonb,$8,$8)`, [row.id, FLOW_HISTORY_ACCEPTANCE.conversationId, row.externalId, row.reference, row.body, row.status, JSON.stringify(row.metadata), row.createdAt]);
      await db.query(`INSERT INTO "WhatsAppFlowSession" (id,"organizationId","projectId","workerId","phoneNumberId","recipientPhone","blueprintKey","flowId","screenId","flowType","sourceExternalId","tokenSha256","expiresAt","createdAt","deliveryAttemptedAt","sentAt","providerMessageId","consumedAt","consumedExternalId") VALUES ($1,$2,$3,$4,'111111111111111','5491111111111','incident-report','222222222222222','INCIDENT','incident',$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [row.sessionId, scope.organizationId, scope.projectId, FLOW_HISTORY_ACCEPTANCE.workerId, row.externalId, row.tokenSha256, row.expiresAt, row.sessionCreatedAt, row.attemptedAt, row.sentAt, row.reference, row.consumedAt, row.consumedExternalId]);
    }
    await db.query('COMMIT');
    async function snapshot() {
      const messages = await db.query('SELECT * FROM "Message" WHERE "conversationId"=$1 ORDER BY id', [FLOW_HISTORY_ACCEPTANCE.conversationId]);
      const sessions = await db.query('SELECT * FROM "WhatsAppFlowSession" WHERE "workerId"=$1 ORDER BY id', [FLOW_HISTORY_ACCEPTANCE.workerId]);
      const audit = await db.query('SELECT count(*)::int AS n FROM "AuditLog"');
      return { messages: messages.rows, sessions: sessions.rows, auditCount: audit.rows[0].n };
    }
    return { rows, snapshot, close: () => db.end() };
  } catch (error) { await db.query('ROLLBACK').catch(() => {}); await db.end().catch(() => {}); throw error; }
}
