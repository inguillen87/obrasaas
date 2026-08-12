import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideProjectContractAuthority,
  normalizeProjectContractAuthorityDecision,
  normalizeProjectContractAuthorityProposal,
  normalizeProjectContractProposal,
  ProjectContractError,
  proposeProjectContractAuthority,
  proposeProjectContractVersion,
  readProjectContractSnapshot,
  requireProjectContractRouteMembership,
  serializeProjectContractSnapshot,
} from '../src/lib/project-contracts.js';

const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
const SCOPE = Object.freeze({ organizationId: 'organization-a', projectId: 'project-a' });
const ACTOR = 'membership-actor';
const OPERATION_KEY = 'project-contract-operation-0001';

function valuedLine(overrides = {}) {
  return {
    taskId: 'task-a',
    state: 'VALUED',
    unitCode: 'M2',
    baseQuantity: '12.5',
    contractAmountMinor: '9223372036854775807',
    noClaimReason: null,
    ...overrides,
  };
}

function contractInput(overrides = {}) {
  return {
    authorityVersionId: 'authority-a',
    expectedAuthorityRevision: 2,
    expectedCurrentVersionId: null,
    expectedHeadRevision: 0,
    contractReference: 'CONTRATO-001',
    title: 'Contrato principal',
    counterpartyLabel: 'Constructora ejemplo',
    effectiveFrom: '2026-08-11',
    currencyCode: 'ARS',
    currencyMinorUnits: 2,
    retentionBps: 500,
    roundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1',
    adjustmentPolicyVersion: 'NONE',
    lines: [valuedLine()],
    ...overrides,
  };
}

function decision(decisionValue = null) {
  return decisionValue === null ? null : {
    id: `decision-${decisionValue.toLowerCase()}`,
    decision: decisionValue,
    reason: 'Decisión contractual fundada.',
    decidedByMembershipId: 'membership-checker',
    decidedAt: '2026-08-11T18:00:00.000Z',
  };
}

function authority(version = 1, decisionValue = 'APPROVED') {
  return {
    id: `authority-${version}`,
    version,
    previousAuthorityVersionId: version === 1 ? null : `authority-${version - 1}`,
    authorities: {
      certifierMembershipId: 'membership-director',
      financeMembershipId: 'membership-finance',
      registrarMembershipId: 'membership-admin',
    },
    candidateToken: HASH,
    integrityDigest: OTHER_HASH,
    preparedByMembershipId: 'membership-admin',
    preparedAt: '2026-08-11T16:00:00.000Z',
    decision: decision(decisionValue),
  };
}

function line() {
  return {
    ordinal: 1,
    state: 'VALUED',
    taskId: 'task-a',
    taskCode: '01',
    taskTitle: 'Excavación',
    taskRevision: 3,
    unitCode: 'M3',
    baseQuantity: '12.5000',
    contractAmountMinor: '100000',
    noClaimReason: null,
    technicalBasisStatusAtPrepare: 'MATCHED',
    currentTechnicalCompatibility: 'MATCHED',
    integrityDigest: HASH,
  };
}

function contract(version = 1, { includeLines = true, decisionValue = 'APPROVED' } = {}) {
  return {
    id: `contract-${version}`,
    version,
    previousContractVersionId: version === 1 ? null : `contract-${version - 1}`,
    authorityVersionId: 'authority-1',
    contractReference: 'CONTRATO-001',
    title: 'Contrato principal',
    counterpartyLabel: 'Constructora ejemplo',
    effectiveFrom: '2026-08-11',
    currencyCode: 'ARS',
    currencyMinorUnits: 2,
    retentionBps: 500,
    roundingPolicyVersion: 'CERT_RETENTION_HALF_UP_V1',
    adjustmentPolicyVersion: 'NONE',
    lineCount: 1,
    valuedLineCount: 1,
    noClaimLineCount: 0,
    totalContractAmountMinor: '100000',
    candidateToken: HASH,
    integrityDigest: OTHER_HASH,
    preparedByMembershipId: 'membership-director',
    preparedAt: '2026-08-11T17:00:00.000Z',
    currentTechnicalCompatibility: 'MATCHED',
    s10BlockerCode: null,
    decision: decision(decisionValue),
    ...(includeLines ? { lines: [line()] } : {}),
  };
}

function capabilities(overrides = {}) {
  return {
    read: { allowed: true, reasonCode: null },
    proposeAuthority: {
      allowed: false,
      reasonCode: 'PROJECT_CONTRACT_AUTHORITY_ROTATION_FORBIDDEN',
      expectedActorMembershipId: 'membership-admin',
    },
    decideAuthority: {
      allowed: false,
      reasonCode: 'PROJECT_CONTRACT_NO_PENDING_AUTHORITY',
      expectedActorMembershipId: null,
      targetId: null,
    },
    prepareContract: {
      allowed: false,
      reasonCode: 'PROJECT_CONTRACT_REVIEW_PENDING',
      expectedActorMembershipId: 'membership-director',
    },
    decideContract: {
      allowed: true,
      reasonCode: null,
      expectedActorMembershipId: ACTOR,
      targetId: 'contract-2',
    },
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    organizationId: SCOPE.organizationId,
    projectId: SCOPE.projectId,
    authorityRevision: 2,
    headRevision: 3,
    readiness: 'CONTRACT_REVIEW_PENDING',
    currentAuthority: authority(),
    pendingAuthority: null,
    currentContract: contract(),
    pendingContract: contract(2, { decisionValue: null }),
    historyLimit: 20,
    authorityHistory: [authority()],
    contractHistory: [
      contract(2, { includeLines: false, decisionValue: null }),
      contract(1, { includeLines: false }),
    ],
    canonicalTasks: [{
      taskId: 'task-a',
      taskCode: '01',
      taskTitle: 'Excavación',
      taskRevision: 3,
      technicalBasis: { status: 'ESTABLISHED', unitCode: 'M3', baseQuantity: '12.5000' },
    }],
    capabilities: capabilities(),
    currentTechnicalCompatibility: 'MATCHED',
    s10BlockerCode: null,
    ...overrides,
  };
}

test('authority proposal is strict, distinct and keeps only explicit CAS', () => {
  const normalized = normalizeProjectContractAuthorityProposal({
    expectedCurrentAuthorityVersionId: null,
    expectedHeadRevision: 0,
    certifierMembershipId: 'membership-director',
    financeMembershipId: 'membership-finance',
    registrarMembershipId: 'membership-admin',
  }, OPERATION_KEY);
  assert.equal(normalized.operationKey, OPERATION_KEY);
  assert.throws(
    () => normalizeProjectContractAuthorityProposal({
      ...normalized,
      operationKey: undefined,
      financeMembershipId: 'membership-director',
    }, OPERATION_KEY),
    (error) => error.code === 'PROJECT_CONTRACT_INVALID'
      || error.code === 'PROJECT_CONTRACT_AUTHORITY_SEPARATION_REQUIRED',
  );
  assert.throws(
    () => normalizeProjectContractAuthorityProposal({
      expectedCurrentAuthorityVersionId: null,
      expectedHeadRevision: 0,
      certifierMembershipId: 'membership-director',
      financeMembershipId: 'membership-finance',
      registrarMembershipId: 'membership-admin',
      organizationId: 'attacker',
    }, OPERATION_KEY),
    /no está permitido/,
  );
});

test('contract proposal canonicalizes Decimal and minor units without Number', () => {
  const normalized = normalizeProjectContractProposal(contractInput(), OPERATION_KEY);
  assert.equal(normalized.lines[0].baseQuantity, '12.5000');
  assert.equal(normalized.lines[0].contractAmountMinor, '9223372036854775807');
  assert.equal(normalized.currencyCode, 'ARS');
  for (const badAmount of [0, 1.5, '0', '01', '1.0', '1e3', '9223372036854775808']) {
    assert.throws(
      () => normalizeProjectContractProposal(contractInput({
        lines: [valuedLine({ contractAmountMinor: badAmount })],
      }), OPERATION_KEY),
      ProjectContractError,
    );
  }
  for (const badQuantity of [12.5, '0', '01.0000', '1e2', '1,2', '-1']) {
    assert.throws(
      () => normalizeProjectContractProposal(contractInput({
        lines: [valuedLine({ baseQuantity: badQuantity })],
      }), OPERATION_KEY),
      ProjectContractError,
    );
  }
});

test('currency and both policies are an exact fail-closed allowlist', () => {
  for (const overrides of [
    { currencyCode: 'EUR' },
    { currencyCode: 'USD', currencyMinorUnits: 0 },
    { roundingPolicyVersion: 'CLIENT_ROUNDING' },
    { adjustmentPolicyVersion: 'FX' },
  ]) {
    assert.throws(
      () => normalizeProjectContractProposal(contractInput(overrides), OPERATION_KEY),
      ProjectContractError,
    );
  }
});

test('VALUED and NO_CLAIM line bodies are exact and never infer zero', () => {
  const normalized = normalizeProjectContractProposal(contractInput({
    lines: [valuedLine(), {
      taskId: 'task-b',
      state: 'NO_CLAIM',
      unitCode: null,
      baseQuantity: null,
      contractAmountMinor: null,
      noClaimReason: 'Fuera del alcance contractual.',
    }],
  }), OPERATION_KEY);
  assert.equal(normalized.lines[1].contractAmountMinor, null);
  assert.throws(
    () => normalizeProjectContractProposal(contractInput({
      lines: [{
        taskId: 'task-b', state: 'NO_CLAIM', unitCode: null,
        baseQuantity: null, contractAmountMinor: '0', noClaimReason: 'Fuera.',
      }],
    }), OPERATION_KEY),
    ProjectContractError,
  );
});

test('decision body accepts only persisted APPROVED or REJECTED and exact digest', () => {
  const normalized = normalizeProjectContractAuthorityDecision({
    expectedHeadRevision: 1,
    expectedAuthorityDigest: HASH,
    decision: 'APPROVED',
    reason: 'Autoridades verificadas.',
  }, OPERATION_KEY);
  assert.equal(normalized.expectedDigest, HASH);
  assert.throws(() => normalizeProjectContractAuthorityDecision({
    expectedHeadRevision: 1,
    expectedAuthorityDigest: HASH,
    decision: 'APPROVE',
    reason: 'Autoridades verificadas.',
  }, OPERATION_KEY), ProjectContractError);
  assert.throws(() => normalizeProjectContractAuthorityDecision({
    expectedHeadRevision: 2_147_483_648,
    expectedAuthorityDigest: HASH,
    decision: 'APPROVED',
    reason: 'Fuera del rango INTEGER de PostgreSQL.',
  }, OPERATION_KEY), ProjectContractError);
  assert.throws(() => normalizeProjectContractProposal(contractInput({
    expectedAuthorityRevision: 2_147_483_648,
  }), OPERATION_KEY), ProjectContractError);
});

test('authority proposal derives candidate server-side and returns an exact receipt', async () => {
  const commands = [];
  const result = await proposeProjectContractAuthority(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: {
      expectedCurrentAuthorityVersionId: null,
      expectedHeadRevision: 0,
      certifierMembershipId: 'membership-director',
      financeMembershipId: 'membership-finance',
      registrarMembershipId: 'membership-admin',
    },
  }, {
    sqlAdapter: {
      async proposeAuthority(command) {
        commands.push(command);
        return [{
          authority_version_id: 'authority-1',
          organization_id: SCOPE.organizationId,
          project_id: SCOPE.projectId,
          authority_version: 1,
          authority_sha256: HASH,
          prepared_by_membership_id: ACTOR,
          head_revision: 1,
          replayed: false,
        }];
      },
    },
  });
  assert.match(commands[0].requestFingerprint, /^[a-f0-9]{64}$/);
  assert.deepEqual(result, {
    authority: {
      id: 'authority-1', version: 1, integrityDigest: HASH,
      preparedByMembershipId: ACTOR,
    },
    head: { revision: 1 },
    executionAllowed: false,
    replayed: false,
  });
});

function sqlAdapterPrisma(results) {
  const state = { calls: [], transactionOptions: null };
  const database = {
    async $queryRawUnsafe(sql, ...args) {
      state.calls.push({ sql, args });
      const result = results[state.calls.length - 1];
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return {
    state,
    prisma: {
      $queryRawUnsafe: database.$queryRawUnsafe,
      async $transaction(operation, options) {
        state.transactionOptions = options;
        return operation(database);
      },
    },
  };
}

test('authority adapter resolves a late exact replay before touching live candidate state', async () => {
  const store = sqlAdapterPrisma([[{
    authority_version_id: 'authority-1',
    organization_id: SCOPE.organizationId,
    project_id: SCOPE.projectId,
    authority_version: 1,
    authority_sha256: HASH,
    prepared_by_membership_id: ACTOR,
    head_revision: 1,
    replayed: true,
  }]]);
  const result = await proposeProjectContractAuthority(store.prisma, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: {
      expectedCurrentAuthorityVersionId: null,
      expectedHeadRevision: 0,
      certifierMembershipId: 'membership-director',
      financeMembershipId: 'membership-finance',
      registrarMembershipId: 'membership-admin',
    },
  });
  assert.equal(result.replayed, true);
  assert.equal(store.state.calls.length, 1);
  assert.match(store.state.calls[0].sql, /authority_prepare_replay/);
  assert.deepEqual(store.state.transactionOptions, { isolationLevel: 'ReadCommitted' });
});

test('authority adapter permits a null bootstrap head and then performs candidate plus prepare', async () => {
  const store = sqlAdapterPrisma([
    [],
    [{
      head_id: null,
      current_authority_version_id: null,
      latest_authority_version_id: null,
      pending_authority_version_id: null,
      authority_revision: 0,
      candidate_sha256: HASH,
      readiness: 'READY',
    }],
    [{
      authority_version_id: 'authority-1',
      organization_id: SCOPE.organizationId,
      project_id: SCOPE.projectId,
      authority_version: 1,
      authority_sha256: HASH,
      prepared_by_membership_id: ACTOR,
      head_revision: 1,
      replayed: false,
    }],
  ]);
  const result = await proposeProjectContractAuthority(store.prisma, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: {
      expectedCurrentAuthorityVersionId: null,
      expectedHeadRevision: 0,
      certifierMembershipId: 'membership-director',
      financeMembershipId: 'membership-finance',
      registrarMembershipId: 'membership-admin',
    },
  });
  assert.equal(result.replayed, false);
  assert.deepEqual(
    store.state.calls.map(({ sql }) => /([a-z_]+)"\(/.exec(sql)?.[1]),
    [
      'obrasaas_project_contract_authority_prepare_replay',
      'obrasaas_project_contract_authority_candidate',
      'obrasaas_project_contract_authority_prepare',
    ],
  );
});

test('security-sensitive authority membership failures remain opaque 403 errors', async () => {
  await assert.rejects(
    proposeProjectContractAuthority(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: OPERATION_KEY,
      input: {
        expectedCurrentAuthorityVersionId: null,
        expectedHeadRevision: 0,
        certifierMembershipId: 'membership-director',
        financeMembershipId: 'membership-finance',
        registrarMembershipId: 'membership-admin',
      },
    }, {
      sqlAdapter: {
        async proposeAuthority() {
          throw new Error('PROJECT_CONTRACT_AUTHORITY_INVALID private membership detail');
        },
      },
    }),
    (error) => error instanceof ProjectContractError
      && error.code === 'PROJECT_CONTRACT_FORBIDDEN'
      && error.status === 403
      && !error.message.includes('private membership detail'),
  );
});

test('PostgreSQL no-data errors from scoped workers are returned as opaque 404', async () => {
  const noData = Object.assign(new Error('Raw query failed'), {
    code: 'P2010',
    meta: { code: 'P0002', message: 'query returned no rows private relation detail' },
  });
  await assert.rejects(
    proposeProjectContractAuthority(null, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: OPERATION_KEY,
      input: {
        expectedCurrentAuthorityVersionId: null,
        expectedHeadRevision: 0,
        certifierMembershipId: 'membership-director',
        financeMembershipId: 'membership-finance',
        registrarMembershipId: 'membership-admin',
      },
    }, { sqlAdapter: { proposeAuthority: async () => { throw noData; } } }),
    (error) => error instanceof ProjectContractError
      && error.code === 'PROJECT_CONTRACT_NOT_FOUND'
      && error.status === 404
      && !error.message.includes('private relation detail'),
  );
});

test('contract proposal serializes a BigInt receipt as a JSON-safe string', async () => {
  const result = await proposeProjectContractVersion(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: contractInput({ lines: [valuedLine({ contractAmountMinor: '100000' })] }),
  }, {
    sqlAdapter: {
      async proposeContract() {
        return [{
          contract_version_id: 'contract-1',
          organization_id: SCOPE.organizationId,
          project_id: SCOPE.projectId,
          contract_version: 1,
          contract_sha256: HASH,
          total_contract_amount_minor: 100000n,
          prepared_by_membership_id: ACTOR,
          head_revision: 1,
          replayed: false,
        }];
      },
    },
  });
  assert.equal(result.contract.totalContractAmountMinor, '100000');
  assert.doesNotThrow(() => JSON.stringify(result));
});

test('contract adapter resolves late replay first and maps a mutated same-key payload to 409', async () => {
  const receiptStore = sqlAdapterPrisma([[{
    contract_version_id: 'contract-1',
    organization_id: SCOPE.organizationId,
    project_id: SCOPE.projectId,
    contract_version: 1,
    contract_sha256: HASH,
    total_contract_amount_minor: 100000n,
    prepared_by_membership_id: ACTOR,
    head_revision: 1,
    replayed: true,
  }]]);
  const result = await proposeProjectContractVersion(receiptStore.prisma, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    operationKey: OPERATION_KEY,
    input: contractInput({ lines: [valuedLine({ contractAmountMinor: '100000' })] }),
  });
  assert.equal(result.replayed, true);
  assert.equal(result.contract.totalContractAmountMinor, '100000');
  assert.equal(receiptStore.state.calls.length, 1);
  assert.match(receiptStore.state.calls[0].sql, /project_contract_prepare_replay/);
  assert.deepEqual(receiptStore.state.transactionOptions, { isolationLevel: 'ReadCommitted' });

  const conflictStore = sqlAdapterPrisma([
    new Error('PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT private persisted payload'),
  ]);
  await assert.rejects(
    proposeProjectContractVersion(conflictStore.prisma, {
      scope: SCOPE,
      actorMembershipId: ACTOR,
      operationKey: OPERATION_KEY,
      input: contractInput({ title: 'Payload mutado' }),
    }),
    (error) => error instanceof ProjectContractError
      && error.code === 'PROJECT_CONTRACT_IDEMPOTENCY_CONFLICT'
      && error.status === 409
      && !error.message.includes('private persisted payload'),
  );
  assert.equal(conflictStore.state.calls.length, 1);
});

test('decision receipt is bound to the trusted actor and requested authority', async () => {
  const result = await decideProjectContractAuthority(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
    authorityVersionId: 'authority-1',
    operationKey: OPERATION_KEY,
    input: {
      expectedHeadRevision: 1,
      expectedAuthorityDigest: HASH,
      decision: 'REJECTED',
      reason: 'La autoridad financiera no corresponde.',
    },
  }, {
    sqlAdapter: {
      async decideAuthority() {
        return [{
          decision_id: 'decision-1',
          authority_version_id: 'authority-1',
          decision: 'REJECTED',
          decided_by_membership_id: ACTOR,
          head_revision: 2,
          replayed: true,
        }];
      },
    },
  });
  assert.equal(result.decision.authorityVersionId, 'authority-1');
  assert.equal(result.replayed, true);
});

test('rich read snapshot is exact, bounded, private-domain and non-executable', async () => {
  const raw = snapshot();
  const result = serializeProjectContractSnapshot(raw, {
    ...SCOPE,
    actorMembershipId: ACTOR,
  });
  assert.equal(result.historyLimit, 20);
  assert.equal(result.contractHistory[0].lines, undefined);
  assert.equal(result.pendingContract.lines[0].contractAmountMinor, '100000');
  assert.equal(result.capabilities.decideContract.targetId, 'contract-2');
  assert.equal(result.executionAllowed, false);
  assert.throws(
    () => serializeProjectContractSnapshot({ ...raw, paid: true }, SCOPE),
    (error) => error.code === 'PROJECT_CONTRACT_PERSISTENCE_CONTRACT_INVALID',
  );
  assert.throws(
    () => serializeProjectContractSnapshot({
      ...raw,
      currentContract: { ...raw.currentContract, totalContractAmountMinor: 100000 },
    }, SCOPE),
    ProjectContractError,
  );
});

test('read adapter accepts only one exact scoped snapshot row', async () => {
  const result = await readProjectContractSnapshot(null, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
  }, {
    sqlAdapter: { read: async () => [{ snapshot: snapshot() }] },
  });
  assert.equal(result.organizationId, SCOPE.organizationId);
  assert.equal(result.executionAllowed, false);
});

test('route membership guard requires ACTIVE tenant and project membership', async () => {
  const calls = [];
  const prisma = {
    projectMembership: {
      async findFirst(query) {
        calls.push(query);
        return { id: 'project-membership-a' };
      },
    },
  };
  assert.equal(await requireProjectContractRouteMembership(prisma, {
    scope: SCOPE,
    actorMembershipId: ACTOR,
  }), ACTOR);
  assert.deepEqual(calls[0].where, {
    projectId: SCOPE.projectId,
    tenantMembershipId: ACTOR,
    status: 'ACTIVE',
    tenantMembership: { organizationId: SCOPE.organizationId, status: 'ACTIVE' },
    project: {
      organizationId: SCOPE.organizationId,
      status: { not: 'ARCHIVED' },
    },
  });
  await assert.rejects(
    requireProjectContractRouteMembership({
      projectMembership: { findFirst: async () => null },
    }, { scope: SCOPE, actorMembershipId: ACTOR }),
    (error) => error.code === 'TENANT_PROJECT_MEMBERSHIP_REQUIRED' && error.status === 403,
  );
});
