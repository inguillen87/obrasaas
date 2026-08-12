import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectContractVersionPayload,
  createProjectContractAttempt,
  createProjectContractDraft,
  formatMinorUnits,
  normalizePositiveMinorUnitsInput,
  normalizePositiveQuantityInput,
  projectContractMutationIsAmbiguous,
  projectContractMutationReceiptIsUsable,
  projectContractSnapshotConfirmsAttempt,
  projectContractSnapshotIsUsable,
  uncertainProjectContractAttempt,
} from '../src/app/dashboard/contracts/project-contract-state.js';

const tasks = [
  { id: 'task-a', code: '1', title: 'Fundaciones' },
  { id: 'task-b', code: '2', title: 'Mampostería' },
];

const snapshot = {
  authorityRevision: 3,
  headRevision: 2,
  currentAuthority: { id: 'authority-1' },
  currentContract: null,
};

test('minor-unit and quantity helpers stay exact without floating point conversion', () => {
  assert.equal(normalizePositiveMinorUnitsInput('0009007199254740993'), '9007199254740993');
  assert.equal(normalizePositiveMinorUnitsInput('0'), null);
  assert.equal(normalizePositiveMinorUnitsInput('10.50'), null);
  assert.equal(normalizePositiveMinorUnitsInput('9223372036854775808'), null);
  assert.equal(normalizePositiveQuantityInput('00012,34'), '12.3400');
  assert.equal(normalizePositiveQuantityInput('0.0001'), '0.0001');
  assert.equal(normalizePositiveQuantityInput('0'), null);
  assert.equal(normalizePositiveQuantityInput('1e4'), null);
  assert.equal(normalizePositiveQuantityInput('100000000000000.0000'), null);
  assert.equal(formatMinorUnits('9007199254740993', 'ARS', 2), 'ARS 90.071.992.547.409,93');
});

test('contract payload covers every canonical task and preserves amounts as strings', () => {
  const draft = createProjectContractDraft(tasks, '2026-08-11');
  Object.assign(draft, {
    contractReference: 'CT-2026-01',
    title: 'Contrato principal',
    counterpartyLabel: 'Constructora ejemplo',
    retentionBps: '500',
  });
  Object.assign(draft.lines[0], {
    state: 'VALUED',
    unitCode: 'M3',
    baseQuantity: '12,5',
    contractAmountMinor: '09007199254740993',
  });
  Object.assign(draft.lines[1], {
    state: 'NO_CLAIM',
    noClaimReason: 'Incluida expresamente sin reclamo en esta versión.',
  });

  const result = buildProjectContractVersionPayload({ draft, snapshot, tasks });
  assert.equal(result.ok, true);
  assert.equal(result.payload.lines.length, 2);
  assert.equal(result.payload.lines[0].baseQuantity, '12.5000');
  assert.equal(result.payload.lines[0].contractAmountMinor, '9007199254740993');
  assert.equal(typeof result.payload.lines[0].contractAmountMinor, 'string');
  assert.deepEqual(result.payload.lines[1], {
    taskId: 'task-b',
    state: 'NO_CLAIM',
    unitCode: null,
    baseQuantity: null,
    contractAmountMinor: null,
    noClaimReason: 'Incluida expresamente sin reclamo en esta versión.',
  });
  assert.equal(result.payload.totalContractAmountMinor, undefined);
});

test('contract payload fails closed for incomplete coverage and all-NO_CLAIM snapshots', () => {
  const draft = createProjectContractDraft(tasks, '2026-08-11');
  Object.assign(draft, {
    contractReference: 'CT-1',
    title: 'Contrato',
    counterpartyLabel: 'Contraparte',
  });
  for (const line of draft.lines) {
    line.state = 'NO_CLAIM';
    line.noClaimReason = 'Fuera de reclamo.';
  }
  const allNoClaim = buildProjectContractVersionPayload({ draft, snapshot, tasks });
  assert.equal(allNoClaim.ok, false);
  assert.match(allNoClaim.errors.join(' '), /Al menos una tarea/);

  draft.lines.pop();
  const incomplete = buildProjectContractVersionPayload({ draft, snapshot, tasks });
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.errors.join(' '), /exactamente todas/);
});

test('ambiguous mutations retain one immutable operation key and block blind replacement', () => {
  const attempt = createProjectContractAttempt({
    kind: 'CONTRACT_PROPOSAL',
    operationKey: '7a2730c3-ae5a-43ce-b582-c62b7907aaec',
    path: '/api/project-contract/versions',
    body: { expectedHeadRevision: 1 },
  });
  const uncertain = uncertainProjectContractAttempt(attempt);
  assert.equal(uncertain.operationKey, attempt.operationKey);
  assert.equal(uncertain.state, 'UNCERTAIN');
  assert.equal(Object.isFrozen(uncertain), true);
  assert.equal(projectContractMutationIsAmbiguous({ status: 503 }), true);
  assert.equal(projectContractMutationIsAmbiguous({ status: 201, malformedSuccess: true }), true);
  assert.equal(projectContractMutationIsAmbiguous({ status: 409 }), false);
});

test('proposal reconciliation cannot confirm against a resource observed before the attempt', () => {
  const digest = 'a'.repeat(64);
  const body = {
    expectedCurrentAuthorityVersionId: null,
    certifierMembershipId: 'member-director',
    financeMembershipId: 'member-finance',
    registrarMembershipId: 'member-admin',
  };
  const attempt = uncertainProjectContractAttempt(createProjectContractAttempt({
    kind: 'AUTHORITY_PROPOSAL',
    operationKey: '7a2730c3-ae5a-43ce-b582-c62b7907aaed',
    path: '/api/project-contract/authorities',
    body,
    knownResourceIds: ['authority-old'],
  }));
  const oldAuthority = {
    id: 'authority-old',
    version: 1,
    previousAuthorityVersionId: null,
    authorities: {
      certifierMembershipId: body.certifierMembershipId,
      financeMembershipId: body.financeMembershipId,
      registrarMembershipId: body.registrarMembershipId,
    },
    candidateToken: digest,
    integrityDigest: digest,
    preparedByMembershipId: 'member-admin',
    preparedAt: '2026-08-11T12:00:00.000Z',
    decision: {
      id: 'decision-old',
      decision: 'REJECTED',
      reason: 'Rejected old authority.',
      decidedByMembershipId: 'member-director',
      decidedAt: '2026-08-11T12:01:00.000Z',
    },
  };
  const oldOnly = {
    organizationId: 'org-1',
    projectId: 'project-1',
    authorityRevision: 1,
    headRevision: 0,
    readiness: 'AUTHORITY_REQUIRED',
    currentAuthority: null,
    pendingAuthority: null,
    currentContract: null,
    pendingContract: null,
    historyLimit: 20,
    authorityHistory: [oldAuthority],
    contractHistory: [],
    canonicalTasks: [],
    capabilities: {
      read: { allowed: true, reasonCode: null },
      proposeAuthority: {
        allowed: true,
        reasonCode: null,
        expectedActorMembershipId: 'member-admin',
      },
      decideAuthority: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_NO_PENDING_AUTHORITY',
        expectedActorMembershipId: null,
        targetId: null,
      },
      prepareContract: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_AUTHORITY_REQUIRED',
        expectedActorMembershipId: null,
      },
      decideContract: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_NO_PENDING_VERSION',
        expectedActorMembershipId: null,
        targetId: null,
      },
    },
    currentTechnicalCompatibility: 'UNESTABLISHED',
    s10BlockerCode: null,
    executionAllowed: false,
  };
  assert.equal(projectContractSnapshotConfirmsAttempt(oldOnly, attempt), false);
  const withNew = {
    ...oldOnly,
    pendingAuthority: { ...oldAuthority, id: 'authority-new', decision: null },
    readiness: 'AUTHORITY_REVIEW_PENDING',
  };
  assert.equal(projectContractSnapshotConfirmsAttempt(withNew, attempt), true);
});

test('mutation receipts accept only the exact final wire contract', () => {
  const digest = 'a'.repeat(64);
  const receipt = {
    contract: {
      id: 'contract-1',
      version: 2,
      integrityDigest: digest,
      totalContractAmountMinor: '9007199254740993',
      preparedByMembershipId: 'member-1',
    },
    head: { revision: 4 },
    executionAllowed: false,
    replayed: false,
  };
  assert.equal(projectContractMutationReceiptIsUsable(receipt, 'CONTRACT_PROPOSAL'), true);
  assert.equal(projectContractMutationReceiptIsUsable({ ...receipt, unexpected: true }, 'CONTRACT_PROPOSAL'), false);
  assert.equal(projectContractMutationReceiptIsUsable({
    ...receipt,
    contract: { ...receipt.contract, totalContractAmountMinor: 9007199254740993 },
  }, 'CONTRACT_PROPOSAL'), false);
});

test('GET snapshots accept only the exact rich DTO with nested server capabilities', () => {
  const snapshotDto = {
    organizationId: 'org-1',
    projectId: 'project-1',
    authorityRevision: 0,
    headRevision: 0,
    readiness: 'AUTHORITY_REQUIRED',
    currentAuthority: null,
    pendingAuthority: null,
    currentContract: null,
    pendingContract: null,
    historyLimit: 20,
    authorityHistory: [],
    contractHistory: [],
    canonicalTasks: [{
      taskId: 'task-a',
      taskCode: '1',
      taskTitle: 'Fundaciones',
      taskRevision: 0,
      technicalBasis: { status: 'UNESTABLISHED', unitCode: null, baseQuantity: null },
    }],
    capabilities: {
      read: { allowed: true, reasonCode: null },
      proposeAuthority: {
        allowed: true,
        reasonCode: null,
        expectedActorMembershipId: 'member-admin',
      },
      decideAuthority: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_NO_PENDING_AUTHORITY',
        expectedActorMembershipId: null,
        targetId: null,
      },
      prepareContract: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_AUTHORITY_REQUIRED',
        expectedActorMembershipId: null,
      },
      decideContract: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_NO_PENDING_VERSION',
        expectedActorMembershipId: null,
        targetId: null,
      },
    },
    currentTechnicalCompatibility: 'UNESTABLISHED',
    s10BlockerCode: null,
    executionAllowed: false,
  };
  assert.equal(projectContractSnapshotIsUsable(snapshotDto, {
    organizationId: 'org-1',
    projectId: 'project-1',
  }), true);
  assert.equal(projectContractSnapshotIsUsable({ ...snapshotDto, unexpected: true }), false);
  assert.equal(projectContractSnapshotIsUsable({
    ...snapshotDto,
    capabilities: {
      ...snapshotDto.capabilities,
      proposeAuthority: { ...snapshotDto.capabilities.proposeAuthority, allowed: 'yes' },
    },
  }), false);

  const digest = 'a'.repeat(64);
  const decision = {
    id: 'decision-1',
    decision: 'APPROVED',
    reason: 'Decision fundada.',
    decidedByMembershipId: 'member-finance',
    decidedAt: '2026-08-11T12:15:00.000Z',
  };
  const authority = {
    id: 'authority-1',
    version: 1,
    previousAuthorityVersionId: null,
    authorities: {
      certifierMembershipId: 'member-director',
      financeMembershipId: 'member-finance',
      registrarMembershipId: 'member-admin',
    },
    candidateToken: digest,
    integrityDigest: digest,
    preparedByMembershipId: 'member-admin',
    preparedAt: '2026-08-11T12:00:00.000Z',
    decision,
  };
  const contract = {
    id: 'contract-1',
    version: 1,
    previousContractVersionId: null,
    authorityVersionId: authority.id,
    contractReference: 'OC-1',
    title: 'Contrato',
    counterpartyLabel: 'Proveedor',
    effectiveFrom: '2026-08-11',
    currencyCode: 'ARS',
    currencyMinorUnits: 2,
    retentionBps: 500,
    roundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1',
    adjustmentPolicyVersion: 'NONE',
    lineCount: 1,
    valuedLineCount: 1,
    noClaimLineCount: 0,
    totalContractAmountMinor: '10000',
    candidateToken: digest,
    integrityDigest: digest,
    preparedByMembershipId: 'member-director',
    preparedAt: '2026-08-11T12:10:00.000Z',
    currentTechnicalCompatibility: 'MATCHED',
    s10BlockerCode: null,
    decision,
    lines: [{
      ordinal: 1,
      state: 'VALUED',
      taskId: 'task-a',
      taskCode: '1',
      taskTitle: 'Fundaciones',
      taskRevision: 1,
      unitCode: 'M3',
      baseQuantity: '10.0000',
      contractAmountMinor: '10000',
      noClaimReason: null,
      technicalBasisStatusAtPrepare: 'MATCHED',
      currentTechnicalCompatibility: 'MATCHED',
      integrityDigest: digest,
    }],
  };
  const contractSummary = structuredClone(contract);
  delete contractSummary.lines;
  const activeSnapshot = {
    ...snapshotDto,
    authorityRevision: 1,
    headRevision: 2,
    readiness: 'ACTIVE',
    currentAuthority: authority,
    currentContract: contract,
    authorityHistory: [authority],
    contractHistory: [contractSummary],
    canonicalTasks: [{
      taskId: 'task-a',
      taskCode: '1',
      taskTitle: 'Fundaciones',
      taskRevision: 1,
      technicalBasis: { status: 'ESTABLISHED', unitCode: 'M3', baseQuantity: '10.0000' },
    }],
    capabilities: {
      read: { allowed: true, reasonCode: null },
      proposeAuthority: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_AUTHORITY_ROTATION_FORBIDDEN',
        expectedActorMembershipId: 'member-admin',
      },
      decideAuthority: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_NO_PENDING_AUTHORITY',
        expectedActorMembershipId: null,
        targetId: null,
      },
      prepareContract: {
        allowed: true,
        reasonCode: null,
        expectedActorMembershipId: 'member-director',
      },
      decideContract: {
        allowed: false,
        reasonCode: 'PROJECT_CONTRACT_NO_PENDING_VERSION',
        expectedActorMembershipId: 'member-finance',
        targetId: null,
      },
    },
    currentTechnicalCompatibility: 'MATCHED',
  };
  assert.equal(projectContractSnapshotIsUsable(activeSnapshot, {
    organizationId: 'org-1',
    projectId: 'project-1',
  }), true);

  const wrongCompatibility = structuredClone(activeSnapshot);
  wrongCompatibility.currentTechnicalCompatibility = 'COMPATIBLE';
  assert.equal(projectContractSnapshotIsUsable(wrongCompatibility), false);

  const wrongPreparedBasis = structuredClone(activeSnapshot);
  wrongPreparedBasis.currentContract.lines[0].technicalBasisStatusAtPrepare = 'ESTABLISHED';
  assert.equal(projectContractSnapshotIsUsable(wrongPreparedBasis), false);

  const wrongAllowedReason = structuredClone(activeSnapshot);
  wrongAllowedReason.capabilities.prepareContract.reasonCode = 'ALLOWED';
  assert.equal(projectContractSnapshotIsUsable(wrongAllowedReason), false);

  const missingAssignedActor = structuredClone(activeSnapshot);
  missingAssignedActor.capabilities.prepareContract.expectedActorMembershipId = null;
  assert.equal(projectContractSnapshotIsUsable(missingAssignedActor), false);
});
