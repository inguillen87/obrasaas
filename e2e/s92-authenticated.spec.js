import { expect, test } from '@playwright/test';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';

import {
  loadS92FixtureDescriptor,
  openS92ActorSession,
  postJsonOnce,
  postJsonOnceWithReconciliation,
  requireS92DisposableTarget,
  sameOriginJson,
} from './s92-fixture.js';

function measurementBody(fixture, version, expectedHeadId) {
  return {
    taskId: fixture.primary.tasks.measured.id,
    periodDate: fixture.period.date,
    ...fixture.payloads[`measurementV${version}`],
    evidenceIds: [fixture.primary.evidence.id],
    expectedHeadId,
  };
}

function reviewBody(fixture, version, expectedRevision) {
  return {
    expectedRevision,
    ...fixture.payloads[`reviewV${version}`],
  };
}

function cutBody(snapshot, periodDate) {
  return {
    periodDate,
    expectedHeadCutId: snapshot.candidate.expectedHeadCutId,
    expectedCandidateToken: snapshot.candidate.token,
  };
}

function mutateSha256(value) {
  return `${value.startsWith('0') ? '1' : '0'}${value.slice(1)}`;
}

function measurementMatchesBody(measurement, body) {
  return (
    measurement?.taskId === body.taskId
    && measurement?.period?.start === body.periodDate
    && measurement?.unit === body.unit
    && measurement?.baselineQuantity === body.baselineQuantity
    && measurement?.executedQuantity === body.executedQuantity
    && measurement?.method === body.method
    && measurement?.rationale === body.rationale
    && JSON.stringify((measurement?.evidence || []).map(({ id }) => id).sort())
      === JSON.stringify([...body.evidenceIds].sort())
  );
}

async function readMeasurement(page, fixture) {
  return sameOriginJson(
    page,
    `/api/progress-measurements?taskId=${encodeURIComponent(fixture.primary.tasks.measured.id)}`
      + `&periodDate=${encodeURIComponent(fixture.period.date)}&limit=25`,
  );
}

async function readCut(page, fixture) {
  return sameOriginJson(
    page,
    `/api/progress-measurement-cuts?periodDate=${encodeURIComponent(fixture.period.date)}`,
  );
}

async function submitMeasurement(page, fixture, version, expectedHeadId) {
  const body = measurementBody(fixture, version, expectedHeadId);
  return postJsonOnceWithReconciliation({
    body,
    operationKey: fixture.operationKeys[`measurementV${version}`],
    page,
    pathname: '/api/progress-measurements',
    reconcile: async () => {
      const snapshot = await readMeasurement(page, fixture);
      if (snapshot.status !== 200) return null;
      const measurement = snapshot.payload?.measurements?.find((candidate) => (
        measurementMatchesBody(candidate, body)
      ));
      if (!measurement || snapshot.payload?.head?.latestMeasurementId !== measurement.id) return null;
      return {
        measurement,
        head: snapshot.payload.head,
        replayed: false,
      };
    },
  });
}

async function approveMeasurement(page, fixture, version, measurement, expectedRevision) {
  const body = reviewBody(fixture, version, expectedRevision);
  return postJsonOnceWithReconciliation({
    body,
    operationKey: fixture.operationKeys[`reviewV${version}`],
    page,
    pathname: `/api/progress-measurements/${encodeURIComponent(measurement.id)}/review`,
    reconcile: async () => {
      const snapshot = await readMeasurement(page, fixture);
      if (snapshot.status !== 200) return null;
      const decided = snapshot.payload?.measurements?.find(({ id }) => id === measurement.id);
      if (
        decided?.status !== 'APPROVED'
        || decided.review?.decision !== 'APPROVE'
        || decided.review?.reason !== body.reason
      ) return null;
      return {
        measurement: decided,
        head: snapshot.payload.head,
        replayed: false,
      };
    },
  });
}

async function sealCut(page, fixture, version, snapshot) {
  const body = cutBody(snapshot, fixture.period.date);
  return postJsonOnceWithReconciliation({
    body,
    operationKey: fixture.operationKeys[`cutV${version}`],
    page,
    pathname: '/api/progress-measurement-cuts',
    reconcile: async () => {
      const current = await readCut(page, fixture);
      if (
        current.status !== 200
        || current.payload?.latestCut?.previousCutId !== body.expectedHeadCutId
        || current.payload?.latestCut?.candidateToken !== body.expectedCandidateToken
        || current.payload?.head?.currentCutId !== current.payload?.latestCut?.id
      ) return null;
      return {
        cut: current.payload.latestCut,
        executionAllowed: false,
        head: current.payload.head,
        replayed: false,
      };
    },
  });
}

function expectCreatedOrReconciled(result) {
  if (!result.reconciled) expect(result.status).toBe(201);
}

test.describe('S9.2 authenticated acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('seals reproducible versions across roles without tenant leakage', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const fixture = await loadS92FixtureDescriptor();
    const baseURL = testInfo.project.use.baseURL;
    expect(typeof baseURL).toBe('string');
    requireS92DisposableTarget(baseURL);

    const sessions = {};
    try {
      const anonymousContext = await browser.newContext({
        baseURL,
        storageState: { cookies: [], origins: [] },
      });
      const anonymousPage = await anonymousContext.newPage();
      sessions.anonymous = { context: anonymousContext, page: anonymousPage };
      await setupClerkTestingToken({ context: anonymousContext });
      await anonymousPage.goto('/sign-in');
      await clerk.loaded({ page: anonymousPage });
      await anonymousPage.waitForFunction(() => (
        window.Clerk?.loaded === true
        && window.Clerk.session === null
        && window.Clerk.user === null
      ));
      const anonymousRead = await readCut(anonymousPage, fixture);
      const anonymousAuthReasons = (anonymousRead.headers['x-clerk-auth-reason'] || '')
        .split(',')
        .map((reason) => reason.trim())
        .filter(Boolean);
      expect({
        authStatus: anonymousRead.headers['x-clerk-auth-status'] ?? null,
        hasLocation: anonymousRead.diagnostic.hasLocation,
        hasProtectRewrite: anonymousAuthReasons.includes('protect-rewrite'),
        location: anonymousRead.headers.location ?? null,
        redirectTo: anonymousRead.headers['x-clerk-redirect-to'] ?? null,
        status: anonymousRead.status,
      }).toEqual({
        authStatus: 'signed-out',
        hasLocation: false,
        hasProtectRewrite: true,
        location: null,
        redirectTo: null,
        status: 404,
      });

      for (const [key, actor] of Object.entries(fixture.primary.actors)) {
        sessions[key] = await openS92ActorSession(browser, {
          actor,
          baseURL,
          organizationId: fixture.primary.clerkOrganizationId,
          projectId: fixture.primary.project.id,
        });
      }
      sessions.outsider = await openS92ActorSession(browser, {
        actor: fixture.otherTenant.admin,
        baseURL,
        organizationId: fixture.otherTenant.clerkOrganizationId,
        projectId: fixture.otherTenant.anchorProjectId,
      });

      const v1Submission = await submitMeasurement(
        sessions.director.page,
        fixture,
        1,
        null,
      );
      expectCreatedOrReconciled(v1Submission);
      expect(v1Submission.payload?.measurement).toMatchObject({
        executedQuantity: fixture.payloads.measurementV1.executedQuantity,
        status: 'PENDING',
        taskId: fixture.primary.tasks.measured.id,
      });
      const measurementV1 = v1Submission.payload.measurement;

      const selfReviewBody = reviewBody(
        fixture,
        1,
        v1Submission.payload.head.revision,
      );
      const selfReview = await postJsonOnce({
        body: selfReviewBody,
        operationKey: fixture.operationKeys.reviewV1,
        page: sessions.director.page,
        pathname: `/api/progress-measurements/${encodeURIComponent(measurementV1.id)}/review`,
      });
      expect(selfReview).toMatchObject({
        payload: { code: 'PROGRESS_MEASUREMENT_FORBIDDEN' },
        status: 403,
      });
      const pendingAfterSelfReview = await readMeasurement(sessions.admin.page, fixture);
      expect(pendingAfterSelfReview.status).toBe(200);
      expect(pendingAfterSelfReview.payload).toMatchObject({
        head: { pendingMeasurementId: measurementV1.id },
      });
      expect(
        pendingAfterSelfReview.payload.measurements.find(({ id }) => id === measurementV1.id),
      ).toMatchObject({ review: null, status: 'PENDING' });

      const v1Approval = await approveMeasurement(
        sessions.admin.page,
        fixture,
        1,
        measurementV1,
        v1Submission.payload.head.revision,
      );
      expectCreatedOrReconciled(v1Approval);
      expect(v1Approval.payload?.measurement).toMatchObject({
        id: measurementV1.id,
        status: 'APPROVED',
        review: { decision: 'APPROVE' },
      });

      const initialCut = await readCut(sessions.admin.page, fixture);
      expect(initialCut.status).toBe(200);
      expect(initialCut.payload).toMatchObject({
        executionAllowed: false,
        project: { id: fixture.primary.project.id },
        readiness: {
          measuredLineCount: 1,
          missingLineCount: 1,
          state: 'READY',
          taskCount: 2,
        },
      });
      const measuredLine = initialCut.payload.candidate.lines.find(
        ({ task }) => task.id === fixture.primary.tasks.measured.id,
      );
      const missingLine = initialCut.payload.candidate.lines.find(
        ({ task }) => task.id === fixture.primary.tasks.missing.id,
      );
      expect(measuredLine).toMatchObject({
        approvedMeasurement: {
          cumulativeQuantity: fixture.payloads.measurementV1.executedQuantity,
          executedQuantity: fixture.payloads.measurementV1.executedQuantity,
          id: measurementV1.id,
        },
        state: 'MEASURED',
      });
      expect(missingLine).toMatchObject({ approvedMeasurement: null, state: 'MISSING' });

      const validCutV1Body = cutBody(initialCut.payload, fixture.period.date);
      for (const role of ['siteManager', 'finance', 'auditor']) {
        const denied = await sameOriginJson(sessions[role].page, '/api/progress-measurement-cuts', {
          body: JSON.stringify(validCutV1Body),
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': fixture.operationKeys.cutV1,
          },
          method: 'POST',
        });
        expect(denied).toMatchObject({
          payload: { code: 'PERMISSION_REQUIRED' },
          status: 403,
        });
      }

      const v1Seal = await sealCut(sessions.admin.page, fixture, 1, initialCut.payload);
      expectCreatedOrReconciled(v1Seal);
      expect(v1Seal.payload).toMatchObject({
        cut: {
          previousCutId: null,
          version: 1,
        },
        executionAllowed: false,
        replayed: false,
      });
      const cutV1 = v1Seal.payload.cut;
      const cutV1Body = validCutV1Body;

      const v1Replay = await postJsonOnce({
        body: cutV1Body,
        operationKey: fixture.operationKeys.cutV1,
        page: sessions.admin.page,
        pathname: '/api/progress-measurement-cuts',
      });
      expect(v1Replay.status).toBe(200);
      expect(v1Replay.headers['idempotency-replayed']).toBe('true');
      expect(v1Replay.payload).toMatchObject({
        cut: {
          candidateToken: cutV1.candidateToken,
          id: cutV1.id,
          previousCutId: null,
          version: 1,
        },
        replayed: true,
      });

      const mutatedReplay = await postJsonOnce({
        body: {
          ...cutV1Body,
          expectedCandidateToken: mutateSha256(cutV1Body.expectedCandidateToken),
        },
        operationKey: fixture.operationKeys.cutV1,
        page: sessions.admin.page,
        pathname: '/api/progress-measurement-cuts',
      });
      expect(mutatedReplay).toMatchObject({
        payload: { code: 'PROGRESS_MEASUREMENT_CUT_IDEMPOTENCY_CONFLICT' },
        status: 409,
      });

      for (const role of ['admin', 'director', 'siteManager', 'finance', 'auditor']) {
        const readable = await readCut(sessions[role].page, fixture);
        expect(readable.status).toBe(200);
        expect(readable.payload).toMatchObject({
          latestCut: { id: cutV1.id, version: 1 },
          project: { id: fixture.primary.project.id },
        });
      }

      const outsiderRead = await readCut(sessions.outsider.page, fixture);
      expect(outsiderRead.status).toBe(200);
      expect(outsiderRead.payload?.project?.id).toBe(fixture.otherTenant.anchorProjectId);
      const outsiderSerialized = JSON.stringify(outsiderRead.payload);
      for (const tenantAIdentifier of [
        fixture.primary.databaseOrganizationId,
        fixture.primary.project.id,
        fixture.primary.tasks.measured.id,
        fixture.primary.tasks.missing.id,
        fixture.primary.evidence.id,
        measurementV1.id,
        cutV1.id,
      ]) {
        expect(outsiderSerialized).not.toContain(tenantAIdentifier);
      }
      const outsiderProjectSwitch = await sameOriginJson(
        sessions.outsider.page,
        '/api/projects',
        {
          body: JSON.stringify({ projectId: fixture.primary.project.id }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PUT',
        },
      );
      expect(outsiderProjectSwitch).toMatchObject({
        payload: { code: 'PROJECT_NOT_SELECTABLE' },
        status: 404,
      });
      const outsiderTaskRead = await readMeasurement(sessions.outsider.page, fixture);
      expect(outsiderTaskRead.status).toBe(404);
      expect(outsiderTaskRead.payload?.code).toBe('PROGRESS_MEASUREMENT_TASK_NOT_FOUND');
      expect(JSON.stringify(outsiderTaskRead.payload)).not.toContain(fixture.primary.project.id);
      const strictScopeBody = {
        ...measurementBody(fixture, 1, null),
        projectId: fixture.primary.project.id,
      };
      const outsiderScopeOverride = await postJsonOnce({
        body: strictScopeBody,
        operationKey: fixture.operationKeys.measurementV1,
        page: sessions.outsider.page,
        pathname: '/api/progress-measurements',
      });
      expect(outsiderScopeOverride).toMatchObject({
        payload: { code: 'PROGRESS_MEASUREMENT_INVALID' },
        status: 400,
      });
      const outsiderReplayProbe = await postJsonOnce({
        body: cutV1Body,
        operationKey: fixture.operationKeys.cutV1,
        page: sessions.outsider.page,
        pathname: '/api/progress-measurement-cuts',
      });
      expect(outsiderReplayProbe.status).not.toBe(200);
      expect(outsiderReplayProbe.status).not.toBe(201);
      expect(outsiderReplayProbe.headers['idempotency-replayed']).not.toBe('true');
      expect(outsiderReplayProbe.payload?.replayed).not.toBe(true);
      expect(JSON.stringify(outsiderReplayProbe.payload)).not.toContain(cutV1.id);

      const afterV1 = await readMeasurement(sessions.siteManager.page, fixture);
      expect(afterV1.status).toBe(200);
      expect(afterV1.payload?.head?.latestMeasurementId).toBe(measurementV1.id);
      const v2Submission = await submitMeasurement(
        sessions.siteManager.page,
        fixture,
        2,
        afterV1.payload.head.latestMeasurementId,
      );
      expectCreatedOrReconciled(v2Submission);
      expect(v2Submission.payload?.measurement).toMatchObject({
        executedQuantity: fixture.payloads.measurementV2.executedQuantity,
        status: 'PENDING',
        taskId: fixture.primary.tasks.measured.id,
      });
      const measurementV2 = v2Submission.payload.measurement;
      expect(measurementV2.id).not.toBe(measurementV1.id);

      const v2Approval = await approveMeasurement(
        sessions.director.page,
        fixture,
        2,
        measurementV2,
        v2Submission.payload.head.revision,
      );
      expectCreatedOrReconciled(v2Approval);
      expect(v2Approval.payload?.measurement).toMatchObject({
        id: measurementV2.id,
        status: 'APPROVED',
        review: { decision: 'APPROVE' },
      });

      const staleCut = await readCut(sessions.director.page, fixture);
      expect(staleCut.status).toBe(200);
      expect(staleCut.payload).toMatchObject({
        latestCut: { id: cutV1.id, version: 1 },
        readiness: { state: 'STALE' },
      });
      expect(staleCut.payload.candidate.expectedHeadCutId).toBe(cutV1.id);
      expect(staleCut.payload.candidate.token).not.toBe(cutV1.candidateToken);
      const staleCandidateMeasurement = staleCut.payload.candidate.lines.find(
        ({ task }) => task.id === fixture.primary.tasks.measured.id,
      )?.approvedMeasurement;
      const frozenV1Measurement = staleCut.payload.latestCut.lines.find(
        ({ task }) => task.id === fixture.primary.tasks.measured.id,
      )?.approvedMeasurement;
      expect(staleCandidateMeasurement).toMatchObject({
        cumulativeQuantity: fixture.payloads.measurementV2.executedQuantity,
        executedQuantity: fixture.payloads.measurementV2.executedQuantity,
        id: measurementV2.id,
      });
      expect(frozenV1Measurement).toMatchObject({
        cumulativeQuantity: fixture.payloads.measurementV1.executedQuantity,
        executedQuantity: fixture.payloads.measurementV1.executedQuantity,
        id: measurementV1.id,
      });

      const v2Seal = await sealCut(sessions.director.page, fixture, 2, staleCut.payload);
      expectCreatedOrReconciled(v2Seal);
      expect(v2Seal.payload).toMatchObject({
        cut: {
          previousCutId: cutV1.id,
          version: 2,
        },
        executionAllowed: false,
        replayed: false,
      });
      const cutV2 = v2Seal.payload.cut;
      expect(cutV2.id).not.toBe(cutV1.id);

      const lateV1Replay = await postJsonOnce({
        body: cutV1Body,
        operationKey: fixture.operationKeys.cutV1,
        page: sessions.admin.page,
        pathname: '/api/progress-measurement-cuts',
      });
      expect(lateV1Replay.status).toBe(200);
      expect(lateV1Replay.headers['idempotency-replayed']).toBe('true');
      expect(lateV1Replay.payload).toMatchObject({
        cut: {
          candidateToken: cutV1.candidateToken,
          id: cutV1.id,
          previousCutId: null,
          version: 1,
        },
        replayed: true,
      });
      expect(lateV1Replay.payload.cut.integrity.digest).toBe(cutV1.integrity.digest);

      const finalRead = await readCut(sessions.auditor.page, fixture);
      expect(finalRead.status).toBe(200);
      expect(finalRead.payload).toMatchObject({
        head: { currentCutId: cutV2.id, revision: 2 },
        latestCut: {
          id: cutV2.id,
          previousCutId: cutV1.id,
          version: 2,
        },
        readiness: { state: 'UP_TO_DATE' },
      });
      expect(
        finalRead.payload.latestCut.lines.find(
          ({ task }) => task.id === fixture.primary.tasks.measured.id,
        )?.approvedMeasurement,
      ).toMatchObject({
        cumulativeQuantity: fixture.payloads.measurementV2.executedQuantity,
        executedQuantity: fixture.payloads.measurementV2.executedQuantity,
        id: measurementV2.id,
      });
      expect(
        finalRead.payload.latestCut.lines.find(
          ({ task }) => task.id === fixture.primary.tasks.missing.id,
        ),
      ).toMatchObject({ approvedMeasurement: null, state: 'MISSING' });

      await sessions.auditor.page.goto('/dashboard/measurements?view=cut');
      await expect(sessions.auditor.page.getByRole('heading', { name: 'Corte quincenal' })).toBeVisible();
      const fixtureCutResponse = sessions.auditor.page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          response.request().method() === 'GET'
          && url.pathname === '/api/progress-measurement-cuts'
          && url.searchParams.get('periodDate') === fixture.period.date
          && response.status() === 200
        );
      });
      await sessions.auditor.page.locator('#measurement-cut-period').fill(fixture.period.date);
      await fixtureCutResponse;
      await expect(sessions.auditor.page.getByText('Corte vigente', { exact: true })).toBeVisible();
      await expect(sessions.auditor.page.getByText(/Versión 2/)).toBeVisible();
      await expect(
        sessions.auditor.page.getByText(/Lectura autorizada · sellado restringido/),
      ).toBeVisible();
      await expect(
        sessions.auditor.page.getByRole('button', { name: /Sellar (primer corte|nueva revisión)/ }),
      ).toHaveCount(0);
    } finally {
      await Promise.allSettled(
        Object.values(sessions).map(({ context }) => context.close()),
      );
    }
  });
});
