import { expect, test } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

import {
  loadS92FixtureDescriptor,
  openS92ActorSession,
  postJsonOnce,
  requireS92DisposableTarget,
  sameOriginJson,
} from './s92-fixture.js';

const OPERATION_KEYS = Object.freeze({
  authorityProposal: 's93-e2e-authority-proposal-v1',
  authoritySelfDecision: 's93-e2e-authority-self-decision-v1',
  authorityDecision: 's93-e2e-authority-decision-v1',
  contractAdminProposal: 's93-e2e-contract-admin-proposal-v1',
  contractProposal: 's93-e2e-contract-proposal-v1',
  contractAuditorDecision: 's93-e2e-contract-auditor-decision-v1',
  contractAdminDecision: 's93-e2e-contract-admin-decision-v1',
  contractDecision: 's93-e2e-contract-decision-v1',
  siteManagerAuthority: 's93-e2e-site-manager-authority-v1',
});

function requireS93DisposableTarget(baseURL, environment = process.env) {
  if (environment.S93_E2E_DISPOSABLE !== '1') {
    throw new Error('authenticated-s93 exige S93_E2E_DISPOSABLE=1 antes de cualquier sesion.');
  }
  return requireS92DisposableTarget(baseURL, environment);
}

function readContract(page) {
  return sameOriginJson(page, '/api/project-contract');
}

function authorityProposalBody(snapshot, fixture) {
  return {
    expectedCurrentAuthorityVersionId: snapshot.currentAuthority?.id || null,
    expectedHeadRevision: snapshot.authorityRevision,
    certifierMembershipId: fixture.primary.actors.director.membershipId,
    financeMembershipId: fixture.primary.actors.finance.membershipId,
    registrarMembershipId: fixture.primary.actors.admin.membershipId,
  };
}

function authorityDecisionBody(snapshot, decision = 'APPROVED') {
  return {
    expectedHeadRevision: snapshot.authorityRevision,
    expectedAuthorityDigest: snapshot.pendingAuthority.integrityDigest,
    decision,
    reason: 'Segregacion contractual S9.3 verificada en fixture disposable.',
  };
}

function contractProposalBody(snapshot, fixture) {
  const tasks = new Map(snapshot.canonicalTasks.map((task) => [task.taskId, task]));
  const measured = tasks.get(fixture.primary.tasks.measured.id);
  const missing = tasks.get(fixture.primary.tasks.missing.id);
  expect([...tasks.keys()].sort()).toEqual([
    fixture.primary.tasks.measured.id,
    fixture.primary.tasks.missing.id,
  ].sort());
  expect(measured).toBeTruthy();
  expect(missing).toBeTruthy();

  const measuredBasis = measured.technicalBasis.status === 'ESTABLISHED'
    ? measured.technicalBasis
    : { unitCode: 'M2', baseQuantity: '100.0000' };

  return {
    authorityVersionId: snapshot.currentAuthority.id,
    expectedAuthorityRevision: snapshot.authorityRevision,
    expectedCurrentVersionId: snapshot.currentContract?.id || null,
    expectedHeadRevision: snapshot.headRevision,
    contractReference: 'S93-E2E-CT-001',
    title: 'Contrato sintetico S9.3',
    counterpartyLabel: 'Contraparte sintetica S9.3',
    effectiveFrom: fixture.period.start,
    currencyCode: 'ARS',
    currencyMinorUnits: 2,
    retentionBps: 500,
    roundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1',
    adjustmentPolicyVersion: 'NONE',
    lines: [
      {
        taskId: measured.taskId,
        state: 'VALUED',
        unitCode: measuredBasis.unitCode,
        baseQuantity: measuredBasis.baseQuantity,
        contractAmountMinor: '12500000',
        noClaimReason: null,
      },
      {
        taskId: missing.taskId,
        state: 'NO_CLAIM',
        unitCode: null,
        baseQuantity: null,
        contractAmountMinor: null,
        noClaimReason: 'Fuera del alcance contractual sintetico S9.3.',
      },
    ],
  };
}

function contractDecisionBody(snapshot, decision = 'APPROVED') {
  return {
    expectedHeadRevision: snapshot.headRevision,
    expectedContractDigest: snapshot.pendingContract.integrityDigest,
    decision,
    reason: 'Conformidad financiera S9.3 verificada en fixture disposable.',
  };
}

function expectCreated(response) {
  expect(response.status).toBe(201);
  expect(response.headers['idempotency-replayed']).not.toBe('true');
  expect(response.payload).toMatchObject({ executionAllowed: false, replayed: false });
}

function expectExactReplay(response) {
  expect(response.status).toBe(200);
  expect(response.headers['idempotency-replayed']).toBe('true');
  expect(response.payload).toMatchObject({ executionAllowed: false, replayed: true });
}

function expectMutatedConflict(response) {
  expect(response).toMatchObject({
    payload: { code: 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT' },
    status: 409,
  });
  expect(response.headers['idempotency-replayed']).not.toBe('true');
}

test.describe('S9.3 authenticated acceptance', () => {
  test.describe.configure({ mode: 'serial' });

  test('governs authority and full SOV across exact project roles', async ({ browser }, testInfo) => {
    test.setTimeout(120_000);
    const baseURL = requireS93DisposableTarget(testInfo.project.use.baseURL);
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

      const siteManagerRead = await readContract(sessions.siteManager.page);
      expect(siteManagerRead).toMatchObject({
        payload: { code: 'PERMISSION_REQUIRED' },
        status: 403,
      });

      const initial = await readContract(sessions.admin.page);
      expect(initial.status).toBe(200);
      expect(initial.payload).toMatchObject({
        organizationId: fixture.primary.databaseOrganizationId,
        projectId: fixture.primary.project.id,
        authorityRevision: 0,
        headRevision: 0,
        readiness: 'AUTHORITY_REQUIRED',
        currentAuthority: null,
        pendingAuthority: null,
        currentContract: null,
        pendingContract: null,
        executionAllowed: false,
      });
      expect(initial.payload.capabilities.proposeAuthority).toMatchObject({
        allowed: true,
        expectedActorMembershipId: fixture.primary.actors.admin.membershipId,
      });

      const authorityBody = authorityProposalBody(initial.payload, fixture);
      const siteManagerAuthority = await postJsonOnce({
        body: authorityBody,
        operationKey: OPERATION_KEYS.siteManagerAuthority,
        page: sessions.siteManager.page,
        pathname: '/api/project-contract/authorities',
      });
      expect(siteManagerAuthority).toMatchObject({
        payload: { code: 'PERMISSION_REQUIRED' },
        status: 403,
      });

      const authorityProposal = await postJsonOnce({
        body: authorityBody,
        operationKey: OPERATION_KEYS.authorityProposal,
        page: sessions.admin.page,
        pathname: '/api/project-contract/authorities',
      });
      expectCreated(authorityProposal);
      expect(authorityProposal.payload.authority).toMatchObject({
        version: 1,
        preparedByMembershipId: fixture.primary.actors.admin.membershipId,
      });
      const authorityId = authorityProposal.payload.authority.id;

      const pendingAuthority = await readContract(sessions.director.page);
      expect(pendingAuthority.status).toBe(200);
      expect(pendingAuthority.payload).toMatchObject({
        readiness: 'AUTHORITY_REVIEW_PENDING',
        pendingAuthority: {
          id: authorityId,
          authorities: {
            certifierMembershipId: fixture.primary.actors.director.membershipId,
            financeMembershipId: fixture.primary.actors.finance.membershipId,
            registrarMembershipId: fixture.primary.actors.admin.membershipId,
          },
        },
      });
      expect(pendingAuthority.payload.capabilities.decideAuthority).toMatchObject({
        allowed: true,
        expectedActorMembershipId: fixture.primary.actors.director.membershipId,
        targetId: authorityId,
      });
      const authorityDecision = authorityDecisionBody(pendingAuthority.payload);

      const selfDecision = await postJsonOnce({
        body: authorityDecision,
        operationKey: OPERATION_KEYS.authoritySelfDecision,
        page: sessions.admin.page,
        pathname: `/api/project-contract/authorities/${encodeURIComponent(authorityId)}/decision`,
      });
      expect(selfDecision).toMatchObject({
        payload: { code: 'PROJECT_CONTRACT_FORBIDDEN' },
        status: 403,
      });

      const authorityApproval = await postJsonOnce({
        body: authorityDecision,
        operationKey: OPERATION_KEYS.authorityDecision,
        page: sessions.director.page,
        pathname: `/api/project-contract/authorities/${encodeURIComponent(authorityId)}/decision`,
      });
      expectCreated(authorityApproval);
      expect(authorityApproval.payload.decision).toMatchObject({
        authorityVersionId: authorityId,
        decision: 'APPROVED',
        decidedByMembershipId: fixture.primary.actors.director.membershipId,
      });

      const authorityDecisionReplay = await postJsonOnce({
        body: authorityDecision,
        operationKey: OPERATION_KEYS.authorityDecision,
        page: sessions.director.page,
        pathname: `/api/project-contract/authorities/${encodeURIComponent(authorityId)}/decision`,
      });
      expectExactReplay(authorityDecisionReplay);
      expect(authorityDecisionReplay.payload.decision.id).toBe(authorityApproval.payload.decision.id);
      const authorityDecisionMutation = await postJsonOnce({
        body: { ...authorityDecision, reason: `${authorityDecision.reason} Mutada.` },
        operationKey: OPERATION_KEYS.authorityDecision,
        page: sessions.director.page,
        pathname: `/api/project-contract/authorities/${encodeURIComponent(authorityId)}/decision`,
      });
      expectMutatedConflict(authorityDecisionMutation);

      const lateAuthorityReplay = await postJsonOnce({
        body: authorityBody,
        operationKey: OPERATION_KEYS.authorityProposal,
        page: sessions.admin.page,
        pathname: '/api/project-contract/authorities',
      });
      expectExactReplay(lateAuthorityReplay);
      expect(lateAuthorityReplay.payload.authority.id).toBe(authorityId);
      const authorityProposalMutation = await postJsonOnce({
        body: { ...authorityBody, expectedHeadRevision: authorityBody.expectedHeadRevision + 1 },
        operationKey: OPERATION_KEYS.authorityProposal,
        page: sessions.admin.page,
        pathname: '/api/project-contract/authorities',
      });
      expectMutatedConflict(authorityProposalMutation);

      const contractCandidate = await readContract(sessions.director.page);
      expect(contractCandidate.status).toBe(200);
      expect(contractCandidate.payload).toMatchObject({
        readiness: 'CONTRACT_REQUIRED',
        currentAuthority: { id: authorityId, decision: { decision: 'APPROVED' } },
        currentContract: null,
        pendingContract: null,
      });
      expect(contractCandidate.payload.capabilities.prepareContract).toMatchObject({
        allowed: true,
        expectedActorMembershipId: fixture.primary.actors.director.membershipId,
      });
      const contractBody = contractProposalBody(contractCandidate.payload, fixture);

      const adminProposal = await postJsonOnce({
        body: contractBody,
        operationKey: OPERATION_KEYS.contractAdminProposal,
        page: sessions.admin.page,
        pathname: '/api/project-contract/versions',
      });
      expect(adminProposal).toMatchObject({
        payload: { code: 'PROJECT_CONTRACT_FORBIDDEN' },
        status: 403,
      });

      const contractProposal = await postJsonOnce({
        body: contractBody,
        operationKey: OPERATION_KEYS.contractProposal,
        page: sessions.director.page,
        pathname: '/api/project-contract/versions',
      });
      expectCreated(contractProposal);
      expect(contractProposal.payload.contract).toMatchObject({
        version: 1,
        totalContractAmountMinor: '12500000',
        preparedByMembershipId: fixture.primary.actors.director.membershipId,
      });
      const contractId = contractProposal.payload.contract.id;

      const pendingContract = await readContract(sessions.finance.page);
      expect(pendingContract.status).toBe(200);
      expect(pendingContract.payload).toMatchObject({
        readiness: 'CONTRACT_REVIEW_PENDING',
        pendingContract: {
          id: contractId,
          lineCount: 2,
          valuedLineCount: 1,
          noClaimLineCount: 1,
          totalContractAmountMinor: '12500000',
        },
      });
      expect(pendingContract.payload.pendingContract.lines.map(({ state }) => state).sort())
        .toEqual(['NO_CLAIM', 'VALUED']);
      expect(pendingContract.payload.capabilities.decideContract).toMatchObject({
        allowed: true,
        expectedActorMembershipId: fixture.primary.actors.finance.membershipId,
        targetId: contractId,
      });
      const contractDecision = contractDecisionBody(pendingContract.payload);

      const auditorDecision = await postJsonOnce({
        body: contractDecision,
        operationKey: OPERATION_KEYS.contractAuditorDecision,
        page: sessions.auditor.page,
        pathname: `/api/project-contract/versions/${encodeURIComponent(contractId)}/decision`,
      });
      expect(auditorDecision).toMatchObject({
        payload: { code: 'PERMISSION_REQUIRED' },
        status: 403,
      });
      const adminDecision = await postJsonOnce({
        body: contractDecision,
        operationKey: OPERATION_KEYS.contractAdminDecision,
        page: sessions.admin.page,
        pathname: `/api/project-contract/versions/${encodeURIComponent(contractId)}/decision`,
      });
      expect(adminDecision).toMatchObject({
        payload: { code: 'PROJECT_CONTRACT_FORBIDDEN' },
        status: 403,
      });

      const contractApproval = await postJsonOnce({
        body: contractDecision,
        operationKey: OPERATION_KEYS.contractDecision,
        page: sessions.finance.page,
        pathname: `/api/project-contract/versions/${encodeURIComponent(contractId)}/decision`,
      });
      expectCreated(contractApproval);
      expect(contractApproval.payload.decision).toMatchObject({
        contractVersionId: contractId,
        decision: 'APPROVED',
        decidedByMembershipId: fixture.primary.actors.finance.membershipId,
      });

      const contractDecisionReplay = await postJsonOnce({
        body: contractDecision,
        operationKey: OPERATION_KEYS.contractDecision,
        page: sessions.finance.page,
        pathname: `/api/project-contract/versions/${encodeURIComponent(contractId)}/decision`,
      });
      expectExactReplay(contractDecisionReplay);
      expect(contractDecisionReplay.payload.decision.id).toBe(contractApproval.payload.decision.id);
      const contractDecisionMutation = await postJsonOnce({
        body: { ...contractDecision, reason: `${contractDecision.reason} Mutada.` },
        operationKey: OPERATION_KEYS.contractDecision,
        page: sessions.finance.page,
        pathname: `/api/project-contract/versions/${encodeURIComponent(contractId)}/decision`,
      });
      expectMutatedConflict(contractDecisionMutation);

      const lateContractReplay = await postJsonOnce({
        body: contractBody,
        operationKey: OPERATION_KEYS.contractProposal,
        page: sessions.director.page,
        pathname: '/api/project-contract/versions',
      });
      expectExactReplay(lateContractReplay);
      expect(lateContractReplay.payload.contract.id).toBe(contractId);
      const contractProposalMutation = await postJsonOnce({
        body: { ...contractBody, title: `${contractBody.title} mutado` },
        operationKey: OPERATION_KEYS.contractProposal,
        page: sessions.director.page,
        pathname: '/api/project-contract/versions',
      });
      expectMutatedConflict(contractProposalMutation);

      for (const role of ['admin', 'director', 'finance', 'auditor']) {
        const readable = await readContract(sessions[role].page);
        expect(readable.status).toBe(200);
        expect(readable.payload).toMatchObject({
          organizationId: fixture.primary.databaseOrganizationId,
          projectId: fixture.primary.project.id,
          readiness: 'ACTIVE',
          currentAuthority: { id: authorityId, decision: { decision: 'APPROVED' } },
          currentContract: { id: contractId, decision: { decision: 'APPROVED' } },
          executionAllowed: false,
        });
      }

      const outsiderRead = await readContract(sessions.outsider.page);
      expect(outsiderRead.status).toBe(200);
      expect(outsiderRead.payload).toMatchObject({
        organizationId: fixture.otherTenant.databaseOrganizationId,
        projectId: fixture.otherTenant.anchorProjectId,
        readiness: 'AUTHORITY_REQUIRED',
      });
      const outsiderSerialized = JSON.stringify(outsiderRead.payload);
      for (const tenantAIdentifier of [
        fixture.primary.databaseOrganizationId,
        fixture.primary.project.id,
        fixture.primary.tasks.measured.id,
        fixture.primary.tasks.missing.id,
        authorityId,
        contractId,
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

      await sessions.auditor.page.goto('/dashboard/contracts');
      await clerk.loaded({ page: sessions.auditor.page });
      await expect(
        sessions.auditor.page.getByRole('heading', { name: 'Contrato y Schedule of Values' }),
      ).toBeVisible();
      await expect(
        sessions.auditor.page.getByRole('heading', { name: 'SOV vigente' }),
      ).toBeVisible();
      const currentContract = sessions.auditor.page.getByRole('region', { name: 'Contrato vigente' });
      await expect(currentContract).toBeVisible();
      await expect(currentContract.getByText(/S93-E2E-CT-001/)).toBeVisible();
      await expect(currentContract.getByText('VALUED', { exact: true })).toBeVisible();
      await expect(currentContract.getByText('NO_CLAIM', { exact: true })).toBeVisible();
      await expect(
        sessions.auditor.page.getByRole('button', {
          name: /Proponer autoridades|Aprobar autoridad|Rechazar autoridad|Preparar versión contractual completa|Aprobar contrato|Rechazar contrato/,
        }),
      ).toHaveCount(0);
    } finally {
      await Promise.allSettled(
        Object.values(sessions).map(({ context }) => context.close()),
      );
    }
  });
});
