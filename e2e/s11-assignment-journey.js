import { expect, test } from '@playwright/test';
import { requireS92DisposableTarget, sameOriginJson } from './s92-fixture.js';

// Reuses real Clerk sessions and the isolated fixture. No authentication or API mocks.
export async function verifyAuthenticatedAssignmentContinuity({ fixture, sessions, baseURL }) {
  requireS92DisposableTarget(baseURL);
  const admin = sessions.admin.page;
  const taskId = fixture.primary.tasks.measured.id;
  const context = { organizationId: fixture.primary.databaseOrganizationId, projectId: fixture.primary.project.id };
  const headers = { 'Content-Type': 'application/json', 'X-ObraSaaS-Organization': context.organizationId, 'X-ObraSaaS-Project': context.projectId };
  const api = (page, pathname, method = 'GET', body, extra = {}) => sameOriginJson(page, pathname, {
    method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const preparePath = '/api/execution/assignments?taskId=' + encodeURIComponent(taskId);
  const cutPath = '/api/progress-measurement-cuts?periodDate=' + encodeURIComponent(fixture.period.date);
  const cutBefore = await api(admin, cutPath);
  expect(cutBefore.status).toBe(200);
  const before = await api(admin, preparePath);
  expect(before.status).toBe(200);
  expect(before.payload.context).toEqual(context);
  const createdTeam = await api(admin, '/api/execution', 'POST', { kind: 'TEAM', name: 'Cuadrilla de ensayo autenticado S11' });
  expect(createdTeam.status).toBe(201);
  const team = createdTeam.payload.team;
  expect(team).toMatchObject({ projectId: context.projectId, status: 'ACTIVE' });
  const executionPath = '/dashboard/execution?taskId=' + encodeURIComponent(taskId);
  const assignmentResponse = (method, pathname) => admin.waitForResponse(response => (
    response.request().method() === method && new URL(response.url()).pathname === pathname
  ));
  let saved, originalInput, originalKey;
  await test.step('S11: create one planned assignment through the mobile interface', async () => {
    await admin.setViewportSize({ width: 390, height: 844 });
    await admin.goto(executionPath);
    const board = admin.getByRole('region', { name: 'Planificación y seguimiento de asignaciones' });
    await board.getByRole('button', { name: 'Planificar asignación', exact: true }).click();
    const dialog = admin.getByRole('dialog', { name: 'Planificar asignación', exact: true });
    await dialog.getByRole('button', { name: 'Una cuadrilla', exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Responsable de la asignación' }).selectOption(team.id);
    await dialog.getByLabel('Inicio previsto', { exact: true }).fill('2030-03-01');
    await dialog.getByLabel('Fin previsto', { exact: true }).fill('2030-03-03');
    await dialog.getByRole('button', { name: 'Revisar coincidencias', exact: true }).click();
    await expect(dialog.getByRole('region', { name: 'Revisión de coincidencias de planificación' })).toContainText('Requiere coordinación');
    await dialog.getByLabel('Explicación de coordinación').fill('Cuadrilla de ensayo sin integrantes; no se acredita disponibilidad laboral.');
    await dialog.getByRole('checkbox').check();
    const responsePromise = assignmentResponse('POST', '/api/execution/assignments');
    await dialog.getByRole('button', { name: 'Confirmar planificación' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    originalInput = response.request().postDataJSON();
    originalKey = response.request().headers()['idempotency-key'];
    expect(originalKey).toMatch(/^[A-Za-z0-9_-]{16,96}$/);
    saved = (await response.json()).assignment;
    expect(saved).toMatchObject({ projectId: context.projectId, taskId, teamId: team.id, workerId: null, status: 'PLANNED', revision: 0 });
    await expect(dialog).toHaveCount(0);
    await expect(board.getByRole('article').filter({ hasText: team.name })).toContainText('01/03/2030');
  });
  const reschedulePath = '/api/execution/assignments/' + saved.id + '/reschedule';
  await test.step('S11: persist mobile reprogramming without recreating the assignment', async () => {
    const card = admin.getByRole('article').filter({ hasText: team.name });
    await card.getByRole('button', { name: 'Reprogramar fechas' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Fechas de la asignación' });
    await dialog.getByLabel('Nuevo inicio previsto').fill('2030-03-05');
    await dialog.getByLabel('Nuevo fin previsto').fill('2030-03-07');
    await dialog.getByLabel('Motivo de reprogramación').fill('Coordinación explícita del período de la cuadrilla de ensayo.');
    await dialog.getByRole('button', { name: 'Revisar nuevas fechas' }).click();
    await expect(dialog.getByRole('region', { name: 'Resultado de coincidencias' })).toContainText('Requiere coordinación');
    await dialog.getByRole('checkbox').check();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    const responsePromise = assignmentResponse('PATCH', reschedulePath);
    await dialog.getByRole('button', { name: 'Guardar reprogramación' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect((await response.json()).assignment).toMatchObject({ id: saved.id, teamId: team.id, revision: 1, status: 'PLANNED', startsAt: '2030-03-05T00:00:00.000Z' });
    await expect(dialog).toHaveCount(0);
    await admin.reload();
    await expect(admin.getByRole('article').filter({ hasText: team.name })).toContainText('05/03/2030');
    const replay = await api(admin, '/api/execution/assignments', 'POST', originalInput, { 'Idempotency-Key': originalKey });
    expect(replay.status).toBe(200);
    expect(replay.payload).toMatchObject({ replayed: true, context, assignment: { id: saved.id, revision: 1, startsAt: '2030-03-05T00:00:00.000Z' }, creationReceipt: { assignmentId: saved.id, startsAt: '2030-03-01T00:00:00.000Z' } });
    const listing = await api(admin, '/api/execution');
    expect(listing.payload.assignments.filter(row => row.teamId === team.id)).toHaveLength(1);
  });
  await test.step('S11: an exact duplicate keeps the form editable and preserves the reason', async () => {
    const input = { taskId, expectedTaskRevision: before.payload.task.revision, ownerKind: 'TEAM', ownerId: team.id, startsOn: '2030-03-11', endsOn: '2030-03-13' };
    const reviewed = await api(admin, '/api/execution/assignments/review', 'POST', input);
    expect(reviewed.status).toBe(200);
    const peer = await api(admin, '/api/execution/assignments', 'POST', { ...input, review: { version: reviewed.payload.version, acknowledged: true, reason: 'Coordinación de la cuadrilla de ensayo sin dotación laboral.' } }, { 'Idempotency-Key': 's11_authenticated_peer_001' });
    expect(peer.status).toBe(201);
    await admin.reload();
    const card = admin.getByRole('article').filter({ hasText: team.name }).filter({ hasText: '05/03/2030' });
    await card.getByRole('button', { name: 'Reprogramar fechas' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Fechas de la asignación' });
    await dialog.getByLabel('Nuevo inicio previsto').fill(input.startsOn);
    await dialog.getByLabel('Nuevo fin previsto').fill(input.endsOn);
    const note = 'Conservar este motivo después del rechazo y coordinar el nuevo período.';
    await dialog.getByLabel('Motivo de reprogramación').fill(note);
    const rejectedResponse = assignmentResponse('POST', reschedulePath);
    await dialog.getByRole('button', { name: 'Revisar nuevas fechas' }).click();
    const rejected = await rejectedResponse;
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).code).toBe('ASSIGNMENT_DUPLICATE');
    await expect(dialog.getByLabel('Nuevo inicio previsto')).toBeEnabled();
    await expect(dialog.getByLabel('Motivo de reprogramación')).toHaveValue(note);
    await dialog.getByLabel('Nuevo fin previsto').fill('2030-03-14');
    await dialog.getByRole('button', { name: 'Revisar nuevas fechas' }).click();
    await expect(dialog.getByRole('region', { name: 'Resultado de coincidencias' })).toContainText('Requiere coordinación');
    await dialog.getByRole('checkbox').check();
    const savedResponse = assignmentResponse('PATCH', reschedulePath);
    await dialog.getByRole('button', { name: 'Guardar reprogramación' }).click();
    expect((await savedResponse).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
  });
  await test.step('S11: auditor is read-only and another tenant cannot access the assignment', async () => {
    const current = await api(sessions.auditor.page, reschedulePath);
    expect(current.status).toBe(200);
    expect(current.payload.assignment).toMatchObject({ id: saved.id, revision: 2, status: 'PLANNED', startsAt: '2030-03-11T00:00:00.000Z', endsAt: '2030-03-14T00:00:00.000Z' });
    const forbidden = await api(sessions.auditor.page, reschedulePath, 'PATCH', { expectedRevision: 2, startsOn: '2030-03-20', endsOn: '2030-03-21' });
    expect(forbidden).toMatchObject({ status: 403, payload: { code: 'PERMISSION_REQUIRED' } });
    const forged = await api(sessions.outsider.page, reschedulePath);
    expect(forged).toMatchObject({ status: 409, payload: { code: 'EVIDENCE_CONTEXT_CHANGED' } });
    const outside = await api(sessions.outsider.page, reschedulePath, 'GET', undefined, {
      'X-ObraSaaS-Organization': fixture.otherTenant.databaseOrganizationId,
      'X-ObraSaaS-Project': fixture.otherTenant.anchorProjectId,
    });
    expect(outside).toMatchObject({ status: 404, payload: { code: 'ASSIGNMENT_NOT_FOUND' } });
    expect(JSON.stringify(outside.payload)).not.toContain(saved.id);
    expect(JSON.stringify(outside.payload)).not.toContain(context.projectId);
    const missingContext = await sameOriginJson(admin, reschedulePath);
    expect(missingContext).toMatchObject({ status: 409, payload: { code: 'ASSIGNMENT_CONTEXT_REQUIRED' } });
    const auditor = sessions.auditor.page;
    await auditor.goto(executionPath);
    const board = auditor.getByRole('region', { name: 'Planificación y seguimiento de asignaciones' });
    await expect(board.getByRole('button', { name: 'Planificar asignación' })).toHaveCount(0);
    const card = board.getByRole('article').filter({ hasText: team.name }).filter({ hasText: '14/03/2030' });
    await card.getByRole('button', { name: 'Ver fechas y cambios' }).click();
    const dialog = auditor.getByRole('dialog', { name: 'Fechas de la asignación' });
    await expect(dialog).toContainText('Conservar este motivo después del rechazo');
    await expect(dialog.getByRole('button', { name: 'Guardar reprogramación' })).toHaveCount(0);
  });
  const after = await api(admin, preparePath);
  expect(after.status).toBe(200);
  expect(after.payload.task).toEqual(before.payload.task);
  const cutAfter = await api(admin, cutPath);
  expect(cutAfter.status).toBe(200);
  expect(cutAfter.payload.head).toEqual(cutBefore.payload.head);
  expect(cutAfter.payload.latestCut.integrity).toEqual(cutBefore.payload.latestCut.integrity);
  const finalListing = await api(admin, '/api/execution');
  expect(finalListing.status).toBe(200);
  expect(finalListing.payload.assignments.filter(row => row.teamId === team.id)).toHaveLength(2);
  const finalState = await api(admin, reschedulePath);
  expect(finalState.status).toBe(200);
  expect(finalState.payload.assignment).toMatchObject({ id: saved.id, revision: 2, status: 'PLANNED' });
}
