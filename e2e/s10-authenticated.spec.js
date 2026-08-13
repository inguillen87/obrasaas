import { expect, test } from '@playwright/test';

import {
  loadS92FixtureDescriptor,
  openS92ActorSession,
  postJsonOnce,
  requireS92DisposableTarget,
  sameOriginJson,
} from './s92-fixture.js';

const OPERATION_KEYS = Object.freeze({
  financePrepare: 's10-e2e-finance-prepare-v1',
  prepareForRejection: 's10-e2e-prepare-rejection-v1',
  outsiderReject: 's10-e2e-outsider-reject-v1',
  reject: 's10-e2e-reject-v1',
  prepareForApproval: 's10-e2e-prepare-approval-v1',
  auditorApprove: 's10-e2e-auditor-approve-v1',
  approve: 's10-e2e-approve-v1',
});
const RECEIPT_FIELDS = Object.freeze([
  'actorMembershipId',
  'bookRevisionAfter',
  'certificateVersionId',
  'decisionId',
  'operationKind',
  'operationReceiptId',
  'periodHeadRevisionAfter',
  'replayed',
]);

function requireS10DisposableTarget(baseURL, environment = process.env) {
  if (environment.S10_E2E_DISPOSABLE !== '1') {
    throw new Error('authenticated-s10 exige S10_E2E_DISPOSABLE=1 antes de cualquier sesion.');
  }
  return requireS92DisposableTarget(baseURL, environment);
}

function readCertificate(page, fixture) {
  return sameOriginJson(
    page,
    `/api/project-certificates?periodDate=${encodeURIComponent(fixture.period.date)}`,
  );
}

function prepareBody(snapshot, fixture, deductions) {
  return {
    periodDate: fixture.period.date,
    expectedBookRevision: snapshot.candidate.expectedBookRevision,
    expectedPeriodHeadRevision: snapshot.candidate.expectedPeriodHeadRevision,
    expectedCurrentApprovedVersionId: snapshot.candidate.expectedCurrentApprovedVersionId,
    deductions,
  };
}

function decisionBody(snapshot, decision, reason) {
  return {
    expectedBookRevision: snapshot.book.revision,
    expectedPeriodHeadRevision: snapshot.periodHead.revision,
    expectedCertificateDigest: snapshot.pendingCertificate.integrityDigest,
    decision,
    reason,
  };
}

function expectReceipt(response, {
  actorMembershipId,
  certificateVersionId = null,
  operationKind,
  replayed,
}) {
  expect(response.status).toBe(replayed ? 200 : 201);
  expect(response.headers['idempotency-replayed']).toBe(String(replayed));
  expect(response.payload).toMatchObject({ executionAllowed: false });
  expect(Object.hasOwn(response.payload, 'replayed')).toBe(false);
  expect(Object.keys(response.payload.receipt).sort()).toEqual(RECEIPT_FIELDS);
  expect(response.payload.receipt).toMatchObject({
    actorMembershipId,
    operationKind,
    replayed,
  });
  expect(response.payload.receipt.operationReceiptId).toEqual(expect.any(String));
  expect(response.payload.receipt.bookRevisionAfter).toEqual(expect.any(Number));
  expect(response.payload.receipt.periodHeadRevisionAfter).toEqual(expect.any(Number));
  if (certificateVersionId !== null) {
    expect(response.payload.receipt.certificateVersionId).toBe(certificateVersionId);
  }
  if (operationKind === 'PREPARE') {
    expect(response.payload.receipt.decisionId).toBeNull();
  } else {
    expect(response.payload.receipt.decisionId).toEqual(expect.any(String));
  }
}

function expectIdempotencyConflict(response) {
  expect(response).toMatchObject({
    payload: { code: 'PROJECT_CERTIFICATE_IDEMPOTENCY_CONFLICT' },
    status: 409,
  });
  expect(response.headers['idempotency-replayed']).not.toBe('true');
}

test.describe('S10-CERT F1 authenticated acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('governs certificate preparation, rejection and approval without tenant leakage', async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const baseURL = requireS10DisposableTarget(testInfo.project.use.baseURL);
    const fixture = await loadS92FixtureDescriptor();
    const sessions = {};

    try {
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

      const initial = await readCertificate(sessions.siteManager.page, fixture);
      expect(initial.status).toBe(200);
      expect(initial.payload).toMatchObject({
        organizationId: fixture.primary.databaseOrganizationId,
        projectId: fixture.primary.project.id,
        requestedPeriod: { start: fixture.period.start, end: fixture.period.end },
        book: null,
        periodHead: null,
        currentApprovedCertificate: null,
        pendingCertificate: null,
        readiness: { state: 'READY', mode: 'FIRST', candidateReady: true },
        capabilities: {
          read: { allowed: true },
          prepare: {
            allowed: true,
            expectedActorMembershipId: fixture.primary.actors.siteManager.membershipId,
          },
        },
        executionAllowed: false,
      });
      expect(initial.payload.readiness.blockingReasons).toEqual([]);
      expect(initial.payload.candidate).toMatchObject({
        period: { start: fixture.period.start, end: fixture.period.end },
        mode: 'FIRST',
        expectedBookRevision: 0,
        expectedPeriodHeadRevision: 0,
        expectedCurrentApprovedVersionId: null,
        lineCount: 2,
        valuedLineCount: 1,
        noClaimLineCount: 1,
      });

      const firstDeductions = [{
        code: 'ADVANCE_RECOVERY',
        reason: 'Recupero sintetico previo a rechazo S10-CERT.',
        amountMinor: '1',
      }];
      const firstPrepareBody = prepareBody(initial.payload, fixture, firstDeductions);
      const financePrepare = await postJsonOnce({
        body: firstPrepareBody,
        operationKey: OPERATION_KEYS.financePrepare,
        page: sessions.finance.page,
        pathname: '/api/project-certificates',
      });
      expect(financePrepare).toMatchObject({
        payload: { code: 'PROJECT_CERTIFICATE_FORBIDDEN' },
        status: 403,
      });

      const firstPrepare = await postJsonOnce({
        body: firstPrepareBody,
        operationKey: OPERATION_KEYS.prepareForRejection,
        page: sessions.siteManager.page,
        pathname: '/api/project-certificates',
      });
      expectReceipt(firstPrepare, {
        actorMembershipId: fixture.primary.actors.siteManager.membershipId,
        operationKind: 'PREPARE',
        replayed: false,
      });
      expect(firstPrepare.payload.certificate).toMatchObject({
        preparedByMembershipId: fixture.primary.actors.siteManager.membershipId,
        period: { start: fixture.period.start, end: fixture.period.end },
        deductionCount: 1,
        decision: null,
      });
      expect(firstPrepare.payload.certificate.totals.certificateIncrementDeductionsMinor).toBe('1');
      const rejectedCertificateId = firstPrepare.payload.certificate.id;
      expect(firstPrepare.payload.receipt.certificateVersionId).toBe(rejectedCertificateId);

      const firstPrepareReplay = await postJsonOnce({
        body: firstPrepareBody,
        operationKey: OPERATION_KEYS.prepareForRejection,
        page: sessions.siteManager.page,
        pathname: '/api/project-certificates',
      });
      expectReceipt(firstPrepareReplay, {
        actorMembershipId: fixture.primary.actors.siteManager.membershipId,
        certificateVersionId: rejectedCertificateId,
        operationKind: 'PREPARE',
        replayed: true,
      });
      expect(firstPrepareReplay.payload.receipt.operationReceiptId)
        .toBe(firstPrepare.payload.receipt.operationReceiptId);
      const firstPrepareMutation = await postJsonOnce({
        body: {
          ...firstPrepareBody,
          deductions: [{ ...firstDeductions[0], amountMinor: '2' }],
        },
        operationKey: OPERATION_KEYS.prepareForRejection,
        page: sessions.siteManager.page,
        pathname: '/api/project-certificates',
      });
      expectIdempotencyConflict(firstPrepareMutation);

      const pendingForRejection = await readCertificate(sessions.director.page, fixture);
      expect(pendingForRejection.status).toBe(200);
      expect(pendingForRejection.payload).toMatchObject({
        currentApprovedCertificate: null,
        pendingCertificate: { id: rejectedCertificateId, decision: null },
        readiness: { state: 'REVIEW_PENDING', candidateReady: false },
        capabilities: {
          approve: {
            allowed: true,
            expectedActorMembershipId: fixture.primary.actors.director.membershipId,
            targetId: rejectedCertificateId,
          },
          reject: {
            allowed: true,
            expectedActorMembershipId: fixture.primary.actors.director.membershipId,
            targetId: rejectedCertificateId,
          },
        },
      });
      const rejectBody = decisionBody(
        pendingForRejection.payload,
        'REJECT',
        'Rechazo sintetico S10 para verificar una nueva preparacion gobernada.',
      );

      const outsiderReject = await postJsonOnce({
        body: rejectBody,
        operationKey: OPERATION_KEYS.outsiderReject,
        page: sessions.outsider.page,
        pathname: `/api/project-certificates/${encodeURIComponent(rejectedCertificateId)}/decision`,
      });
      expect(outsiderReject).toMatchObject({
        payload: { code: 'PROJECT_CERTIFICATE_NOT_FOUND' },
        status: 404,
      });
      expect(JSON.stringify(outsiderReject.payload)).not.toContain(rejectedCertificateId);

      const rejection = await postJsonOnce({
        body: rejectBody,
        operationKey: OPERATION_KEYS.reject,
        page: sessions.director.page,
        pathname: `/api/project-certificates/${encodeURIComponent(rejectedCertificateId)}/decision`,
      });
      expectReceipt(rejection, {
        actorMembershipId: fixture.primary.actors.director.membershipId,
        certificateVersionId: rejectedCertificateId,
        operationKind: 'REJECT',
        replayed: false,
      });
      expect(rejection.payload.decision).toMatchObject({
        decision: 'REJECTED',
        decidedByMembershipId: fixture.primary.actors.director.membershipId,
      });
      const rejectionReplay = await postJsonOnce({
        body: rejectBody,
        operationKey: OPERATION_KEYS.reject,
        page: sessions.director.page,
        pathname: `/api/project-certificates/${encodeURIComponent(rejectedCertificateId)}/decision`,
      });
      expectReceipt(rejectionReplay, {
        actorMembershipId: fixture.primary.actors.director.membershipId,
        certificateVersionId: rejectedCertificateId,
        operationKind: 'REJECT',
        replayed: true,
      });
      expect(rejectionReplay.payload.receipt.operationReceiptId)
        .toBe(rejection.payload.receipt.operationReceiptId);
      const rejectionMutation = await postJsonOnce({
        body: { ...rejectBody, reason: `${rejectBody.reason} Mutado.` },
        operationKey: OPERATION_KEYS.reject,
        page: sessions.director.page,
        pathname: `/api/project-certificates/${encodeURIComponent(rejectedCertificateId)}/decision`,
      });
      expectIdempotencyConflict(rejectionMutation);

      const readyAgain = await readCertificate(sessions.siteManager.page, fixture);
      expect(readyAgain.status).toBe(200);
      expect(readyAgain.payload).toMatchObject({
        currentApprovedCertificate: null,
        pendingCertificate: null,
        readiness: { state: 'READY', mode: 'FIRST', candidateReady: true },
      });
      const approvalDeductions = [{
        code: 'QUALITY_HOLD',
        reason: 'Deduccion sintetica aprobable S10-CERT.',
        amountMinor: '2',
      }];
      const approvalPrepareBody = prepareBody(readyAgain.payload, fixture, approvalDeductions);
      const approvalPrepare = await postJsonOnce({
        body: approvalPrepareBody,
        operationKey: OPERATION_KEYS.prepareForApproval,
        page: sessions.siteManager.page,
        pathname: '/api/project-certificates',
      });
      expectReceipt(approvalPrepare, {
        actorMembershipId: fixture.primary.actors.siteManager.membershipId,
        operationKind: 'PREPARE',
        replayed: false,
      });
      const approvedCertificateId = approvalPrepare.payload.certificate.id;
      expect(approvedCertificateId).not.toBe(rejectedCertificateId);

      const pendingForApproval = await readCertificate(sessions.director.page, fixture);
      expect(pendingForApproval.status).toBe(200);
      expect(pendingForApproval.payload.pendingCertificate).toMatchObject({
        id: approvedCertificateId,
        deductionCount: 1,
        decision: null,
      });
      const approveBody = decisionBody(
        pendingForApproval.payload,
        'APPROVE',
        'Aprobacion sintetica S10-CERT con segregacion de funciones verificada.',
      );

      const auditorApprove = await postJsonOnce({
        body: approveBody,
        operationKey: OPERATION_KEYS.auditorApprove,
        page: sessions.auditor.page,
        pathname: `/api/project-certificates/${encodeURIComponent(approvedCertificateId)}/decision`,
      });
      expect(auditorApprove).toMatchObject({
        payload: { code: 'PROJECT_CERTIFICATE_FORBIDDEN' },
        status: 403,
      });

      const approval = await postJsonOnce({
        body: approveBody,
        operationKey: OPERATION_KEYS.approve,
        page: sessions.director.page,
        pathname: `/api/project-certificates/${encodeURIComponent(approvedCertificateId)}/decision`,
      });
      expectReceipt(approval, {
        actorMembershipId: fixture.primary.actors.director.membershipId,
        certificateVersionId: approvedCertificateId,
        operationKind: 'APPROVE',
        replayed: false,
      });
      expect(approval.payload.decision).toMatchObject({
        decision: 'APPROVED',
        decidedByMembershipId: fixture.primary.actors.director.membershipId,
      });
      expect(approval.payload.book.latestApprovedCertificateVersionId).toBe(approvedCertificateId);
      expect(approval.payload.periodHead.currentApprovedVersionId).toBe(approvedCertificateId);

      const approvalReplay = await postJsonOnce({
        body: approveBody,
        operationKey: OPERATION_KEYS.approve,
        page: sessions.director.page,
        pathname: `/api/project-certificates/${encodeURIComponent(approvedCertificateId)}/decision`,
      });
      expectReceipt(approvalReplay, {
        actorMembershipId: fixture.primary.actors.director.membershipId,
        certificateVersionId: approvedCertificateId,
        operationKind: 'APPROVE',
        replayed: true,
      });
      expect(approvalReplay.payload.receipt.operationReceiptId)
        .toBe(approval.payload.receipt.operationReceiptId);
      const approvalMutation = await postJsonOnce({
        body: { ...approveBody, reason: `${approveBody.reason} Mutada.` },
        operationKey: OPERATION_KEYS.approve,
        page: sessions.director.page,
        pathname: `/api/project-certificates/${encodeURIComponent(approvedCertificateId)}/decision`,
      });
      expectIdempotencyConflict(approvalMutation);

      for (const role of ['admin', 'director', 'siteManager', 'finance', 'auditor']) {
        const readable = await readCertificate(sessions[role].page, fixture);
        expect(readable.status).toBe(200);
        expect(readable.payload).toMatchObject({
          organizationId: fixture.primary.databaseOrganizationId,
          projectId: fixture.primary.project.id,
          currentApprovedCertificate: {
            id: approvedCertificateId,
            decision: { decision: 'APPROVED' },
          },
          pendingCertificate: null,
          executionAllowed: false,
        });
        expect(readable.payload.history.map(({ id }) => id)).toContain(approvedCertificateId);
        expect(readable.payload.history.map(({ id }) => id)).toContain(rejectedCertificateId);
      }

      const outsiderRead = await readCertificate(sessions.outsider.page, fixture);
      expect(outsiderRead.status).toBe(200);
      expect(outsiderRead.payload).toMatchObject({
        organizationId: fixture.otherTenant.databaseOrganizationId,
        projectId: fixture.otherTenant.anchorProjectId,
        executionAllowed: false,
      });
      const outsiderSerialized = JSON.stringify(outsiderRead.payload);
      for (const tenantAIdentifier of [
        fixture.primary.databaseOrganizationId,
        fixture.primary.project.id,
        fixture.primary.tasks.measured.id,
        fixture.primary.tasks.missing.id,
        rejectedCertificateId,
        approvedCertificateId,
      ]) {
        expect(outsiderSerialized).not.toContain(tenantAIdentifier);
      }
      const crossTenantSelection = await sameOriginJson(sessions.outsider.page, '/api/projects', {
        body: JSON.stringify({ projectId: fixture.primary.project.id }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      });
      expect(crossTenantSelection).toMatchObject({
        payload: { code: 'PROJECT_NOT_SELECTABLE' },
        status: 404,
      });
    } finally {
      await Promise.allSettled(
        Object.values(sessions).map(({ context }) => context.close()),
      );
    }
  });
});
