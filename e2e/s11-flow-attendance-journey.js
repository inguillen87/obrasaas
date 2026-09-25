import { expect, test } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';
import { sameOriginJson, requireS92DisposableTarget, openS92ActorSession } from './s92-fixture.js';
import { openAuthenticatedFlowAttendanceFixture, ATTENDANCE_ACCEPTANCE } from '../scripts/lib/s11-flow-attendance-fixture.mjs';
import { flowAttendanceMatches } from '../src/lib/whatsapp/flow-attendance-policy.js';

export async function verifyAuthenticatedFlowAttendance({ fixture, sessions, baseURL }) {
  requireS92DisposableTarget(baseURL);
  const db = await openAuthenticatedFlowAttendanceFixture(fixture), scope = {
    organizationId: fixture.primary.databaseOrganizationId, projectId: fixture.primary.project.id, conversationId: ATTENDANCE_ACCEPTANCE.conversationId,
  };
  const headers = { 'X-ObraSaaS-Organization': scope.organizationId, 'X-ObraSaaS-Project': scope.projectId };
  const path = (row, mode = 'attendance', projectId = scope.projectId) => '/api/whatsapp/inbox/' + scope.conversationId + '/proactive-flows?' + new URLSearchParams({ projectId, mode, messageId: row.sourceId });
  const admin = sessions.admin.page, before = await db.snapshot(), calls = [], cases = [];
  const observe = request => { if (new URL(request.url()).pathname.includes(scope.conversationId + '/proactive-flows')) calls.push(request.method()); };
  admin.on('request', observe);
  try {
    await test.step('S11-ATTENDANCE: real session reads the reused exact entry, not a nearby match', async () => {
      expect(before.entries).toHaveLength(1); expect(before.sessions).toHaveLength(3); expect(before.messages).toHaveLength(6);
      for (const row of db.rows.slice(0, 2)) {
        const result = await sameOriginJson(admin, path(row), { headers });
        expect(result.status).toBe(200); expect(flowAttendanceMatches(result.payload, scope, row.sourceId)).toBe(true);
        expect(result.payload).toMatchObject({ state: 'available', entry: { id: db.entry.id, verificationStatus: 'PENDING', shift: null } });
        expect(result.payload.entry.occurredAt).toBe(db.entry.occurredAt); expect(new Date(db.entry.occurredAt).getTime()).toBeLessThan(row.createdAt.getTime());
        expect(result.headers['cache-control']).toContain('private, no-store');
        for (const text of [ATTENDANCE_ACCEPTANCE.privateCanary, 'latitude', 'longitude', 'recipientPhone', 'tokenSha256', 'wamid.', '5497777777777']) expect(JSON.stringify(result.payload)).not.toContain(text);
      }
      const legacy = await sameOriginJson(admin, path(db.rows[2]), { headers });
      expect(legacy.status).toBe(200); expect(legacy.payload).toMatchObject({ state: 'unlinked', entry: null });
      expect(await db.snapshot()).toEqual(before); cases.push('real-session-domain-pending-reuse-and-no-legacy-backfill');
    });
    await test.step('S11-ATTENDANCE: both permissions, tenant scope and strict query are enforced', async () => {
      const auditor = await sameOriginJson(sessions.auditor.page, path(db.rows[0]), { headers });
      expect(auditor.status).toBe(403); expect(auditor.payload).not.toHaveProperty('entry');
      expect((await sameOriginJson(sessions.outsider.page, path(db.rows[0]), { headers })).status).toBe(409);
      const foreignHeaders = { 'X-ObraSaaS-Organization': fixture.otherTenant.databaseOrganizationId, 'X-ObraSaaS-Project': fixture.otherTenant.anchorProjectId };
      expect((await sameOriginJson(sessions.outsider.page, path(db.rows[0], 'attendance', fixture.otherTenant.anchorProjectId), { headers: foreignHeaders })).status).toBe(404);
      const anonymous = await sameOriginJson(sessions.anonymous.page, path(db.rows[0]), { headers });
      expect(anonymous.status).toBe(404); expect(anonymous.payload).toBeNull();
      expect((await sameOriginJson(admin, path(db.rows[0]))).status).toBe(409);
      expect((await sameOriginJson(admin, path(db.rows[0]) + '&entryId=' + db.entry.id, { headers })).status).toBe(400);
      expect((await sameOriginJson(admin, path(db.rows[0]) + '&messageId=' + db.rows[1].sourceId, { headers })).status).toBe(400);
      expect(await db.snapshot()).toEqual(before); cases.push('real-permissions-foreign-context-anonymous-and-no-client-entry-selector');
    });
    await test.step('S11-ATTENDANCE: mobile inbox follows the stored link and survives reload without writes', async () => {
      await admin.setViewportSize({ width: 390, height: 844 }); await admin.goto('/dashboard/inbox'); await clerk.loaded({ page: admin });
      const open = async () => {
        await admin.getByRole('button', { name: new RegExp(ATTENDANCE_ACCEPTANCE.displayName) }).click();
        const history = admin.getByRole('region', { name: 'Seguimiento de formularios' });
        await admin.getByRole('button', { name: 'Abrir seguimiento de formularios', exact: true }).click();
        await expect(history.getByRole('listitem')).toHaveCount(3);
        const linked = history.getByRole('listitem').filter({ hasText: db.rows[0].sourceId });
        await linked.getByRole('button', { name: 'Consultar respuesta vinculada', exact: true }).click();
        await linked.getByRole('button', { name: 'Consultar ingreso vinculado', exact: true }).click();
        await expect(linked.getByText(db.entry.id, { exact: true })).toBeVisible();
        await expect(linked.getByText('Ubicación pendiente', { exact: true })).toBeVisible();
        await expect(linked.getByRole('link', { name: 'Abrir control de asistencia', exact: true })).toHaveAttribute('href', '/dashboard/attendance');
        expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect(await linked.innerText()).not.toContain(ATTENDANCE_ACCEPTANCE.privateCanary);
      };
      await open(); await admin.reload(); await clerk.loaded({ page: admin }); await open();
      expect(calls.every(method => method === 'GET')).toBe(true); expect(await db.snapshot()).toEqual(before);
      cases.push('real-mobile-ui-reload-and-no-domain-writes');
    });
    await test.step('S11-ATTENDANCE: ending an independent real session removes both linked reads', async () => {
      const actor = await openS92ActorSession(admin.context().browser(), { actor: fixture.primary.actors.director, baseURL,
        organizationId: fixture.primary.clerkOrganizationId, projectId: scope.projectId });
      try {
        expect((await sameOriginJson(actor.page, path(db.rows[0]), { headers })).status).toBe(200);
        await actor.page.evaluate(async () => { await window.Clerk.signOut(); });
        await actor.page.goto('/sign-in'); await clerk.loaded({ page: actor.page });
        await actor.page.waitForFunction(() => window.Clerk?.loaded === true && window.Clerk.session === null);
        for (const mode of ['attendance', 'reply']) {
          const denied = await sameOriginJson(actor.page, path(db.rows[0], mode), { headers });
          expect(denied.status).toBe(404); expect(denied.payload).toBeNull();
        }
        expect((await sameOriginJson(admin, path(db.rows[0]), { headers })).status).toBe(200);
        expect(await db.snapshot()).toEqual(before); cases.push('real-signout-removes-access-without-affecting-other-session');
      } finally { await actor.context.close(); }
    });
    console.log('S11_ATTENDANCE_AUTHENTICATED ' + JSON.stringify({ status: 'PASS', cases, clerk: 'development-real-sessions', database: 'loopback-disposable-postgresql', linkedForms: 2, legacyForms: 1, actualPendingEntries: 1, httpWrites: 0, realMessagesSent: 0, completeWebhookIngressTested: false }));
  } finally { admin.off('request', observe); await db.close(); }
}
