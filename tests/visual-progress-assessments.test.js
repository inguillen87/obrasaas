import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { VisualProgressProviderError } from '../src/lib/ai/visual-progress-provider.js';
import { whatsAppMediaAssetHash } from '../src/lib/whatsapp/media-assets.js';
import {
  listVisualProgressAssessments,
  recoverExpiredVisualProgressAssessments,
  VisualProgressAssessmentError,
  VISUAL_PROGRESS_LEASE_EXPIRED_CODE,
  VISUAL_PROGRESS_LEASE_MS,
  requestVisualProgressAssessment,
  reviewVisualProgressAssessment,
  serializePublicVisualProgressAssessment,
} from '../src/lib/visual-progress-assessments.js';

const scope = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
});
const actorId = 'user-director';
const image = Buffer.from('private-construction-image');
const imageSha256 = createHash('sha256').update(image).digest('hex');
const whatsAppPhoneNumberId = '1225843560610854';
const whatsAppConversationId = 'conversation-whatsapp-a';
const whatsAppMessageId = 'message-whatsapp-a';
const whatsAppProviderMessageId = 'wamid.visual-progress-a';

function v2WhatsAppStorage() {
  const pathname = `obrasaas/projects/${scope.projectId}/whatsapp/${whatsAppPhoneNumberId}/muro-norte.png`;
  return {
    provider: 'vercel-blob',
    assetId: `https://tenant.private.blob.vercel-storage.com/${pathname}`,
    publicId: pathname,
    pathname,
    resourceType: 'image',
    format: 'png',
    bytes: image.length,
    reused: false,
  };
}

function claimedWhatsAppMediaAsset(overrides = {}) {
  const storage = v2WhatsAppStorage();
  return {
    id: 'media-asset-visual-a',
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    webhookEventId: 'webhook-event-visual-a',
    status: 'CLAIMED',
    mediaKind: 'IMAGE',
    declaredMimeType: 'image/png',
    storageProvider: 'vercel-blob',
    storage,
    storageLocatorHash: whatsAppMediaAssetHash(JSON.stringify({
      path: ['storage', 'pathname'],
      provider: 'vercel-blob',
      value: storage.pathname,
    })),
    fileName: 'muro-norte.png',
    mimeType: 'image/png',
    contentSha256: imageSha256,
    sizeBytes: image.length,
    messageConversationId: whatsAppConversationId,
    messageId: whatsAppMessageId,
    claimFingerprint: 'c'.repeat(64),
    providerMessageIdHash: whatsAppMediaAssetHash(whatsAppProviderMessageId),
    providerMediaIdHash: 'd'.repeat(64),
    ...overrides,
  };
}

function durableWhatsAppEvidence() {
  const asset = claimedWhatsAppMediaAsset();
  const legacyStorage = {
    provider: 'vercel-blob',
    assetId: `https://tenant.private.blob.vercel-storage.com/obrasaas/whatsapp/${whatsAppPhoneNumberId}/legacy.png`,
    pathname: `obrasaas/whatsapp/${whatsAppPhoneNumberId}/legacy.png`,
    publicId: `obrasaas/whatsapp/${whatsAppPhoneNumberId}/legacy.png`,
    resourceType: 'image',
    format: 'png',
    bytes: image.length,
  };
  return {
    media: {
      schemaVersion: 2,
      source: 'whatsapp-media-asset',
      assetId: asset.id,
      kind: 'image',
      mimeType: asset.mimeType,
      filename: asset.fileName,
      size: asset.sizeBytes,
      sha256: asset.contentSha256,
    },
    sourceConversationId: whatsAppConversationId,
    sourceMessageId: whatsAppMessageId,
    sourceMessage: {
      id: whatsAppMessageId,
      conversationId: whatsAppConversationId,
      externalId: whatsAppProviderMessageId,
      direction: 'INBOUND',
      kind: 'IMAGE',
      body: 'Muro norte al mediodia',
      mediaUrl: legacyStorage.assetId,
      metadata: {
        provider: 'meta',
        authorized: true,
        quarantined: false,
        phoneNumberId: whatsAppPhoneNumberId,
        media: {
          url: legacyStorage.assetId,
          mimeType: 'image/png',
          filename: 'legacy.png',
          size: image.length,
          sha256: imageSha256,
          storage: { ...legacyStorage, status: 'stored' },
        },
      },
      conversation: {
        id: whatsAppConversationId,
        projectId: scope.projectId,
        channel: 'whatsapp',
        externalId: 'meta:+15551230001',
      },
      whatsappMediaAsset: asset,
    },
  };
}

function legacyWhatsAppEvidence() {
  const pathname = `obrasaas/whatsapp/${whatsAppPhoneNumberId}/legacy-muro.png`;
  const url = `https://tenant.private.blob.vercel-storage.com/${pathname}`;
  const storage = {
    provider: 'vercel-blob',
    assetId: url,
    publicId: pathname,
    pathname,
    resourceType: 'image',
    format: 'png',
    bytes: image.length,
    status: 'stored',
  };
  return {
    media: {
      schemaVersion: 1,
      source: 'whatsapp-message',
      kind: 'image',
      mimeType: 'image/png',
      filename: 'legacy-muro.png',
      size: image.length,
      sha256: imageSha256,
    },
    sourceConversationId: whatsAppConversationId,
    sourceMessageId: whatsAppMessageId,
    sourceMessage: {
      id: whatsAppMessageId,
      conversationId: whatsAppConversationId,
      externalId: whatsAppProviderMessageId,
      direction: 'INBOUND',
      kind: 'IMAGE',
      body: 'Muro norte al mediodia',
      mediaUrl: url,
      metadata: {
        provider: 'meta',
        authorized: true,
        quarantined: false,
        phoneNumberId: whatsAppPhoneNumberId,
        media: {
          url,
          mimeType: 'image/png',
          filename: 'legacy-muro.png',
          size: image.length,
          sha256: imageSha256,
          storage,
        },
      },
      conversation: {
        id: whatsAppConversationId,
        projectId: scope.projectId,
        channel: 'whatsapp',
        externalId: 'meta:+15551230001',
      },
      whatsappMediaAsset: null,
    },
  };
}

function aiMetadata(enabled = true) {
  return {
    aiProcessing: {
      supervisorEnabled: false,
      audioTranscriptionEnabled: false,
      visualProgressEnabled: enabled,
      disclosureVersion: '2026-07-26',
      authorizationAttestedAt: '2026-07-26T12:00:00.000Z',
      authorizationAttestedBy: actorId,
    },
  };
}

function providerAssessment(overrides = {}) {
  return {
    schemaVersion: 1,
    abstained: false,
    abstentionReason: null,
    summary: 'Se observa mamposteria parcialmente ejecutada.',
    elementType: 'mamposteria',
    progressMin: 35,
    progressMax: 50,
    confidence: 0.74,
    facts: ['Hay hiladas construidas y un tramo superior abierto.'],
    quality: {
      overall: 'good',
      angle: 'good',
      lighting: 'good',
      occlusion: 'none',
    },
    limitations: ['Una sola toma no permite medir toda la superficie.'],
    ...overrides,
  };
}

function providerResult(overrides = {}) {
  return {
    provider: 'openai',
    model: 'gpt-5.6-sol',
    registryModelId: 'openai:gpt-5.6-sol',
    responseId: 'resp-safe-1',
    requestId: 'req-safe-1',
    usage: {
      inputTokens: 120,
      outputTokens: 30,
      totalTokens: 150,
      cachedInputTokens: 40,
      cacheWriteTokens: 0,
    },
    input: {
      inputSha256: imageSha256,
      submittedSha256: imageSha256,
      width: 800,
      height: 600,
    },
    assessment: providerAssessment(),
    ...overrides,
  };
}

function providerRoute() {
  return {
    provider: 'openai',
    model: 'gpt-5.6-sol',
    registryModelId: 'openai:gpt-5.6-sol',
  };
}

async function dispatchedProviderResult(input, overrides = {}) {
  await input.onBeforeProviderRequest(providerRoute());
  return providerResult(overrides);
}

function safeJson(value) {
  return JSON.stringify(value, (_key, item) => (
    typeof item === 'bigint' ? item.toString() : item
  ));
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'AND' && Array.isArray(expected)) {
      return expected.every((condition) => matches(row, condition));
    }
    if (key === 'OR' && Array.isArray(expected)) {
      return expected.some((condition) => matches(row, condition));
    }
    if (expected instanceof Date) {
      const actual = row[key] instanceof Date ? row[key] : new Date(row[key]);
      return !Number.isNaN(actual.getTime()) && actual.getTime() === expected.getTime();
    }
    if (expected && typeof expected === 'object') {
      if (Object.hasOwn(expected, 'in') && !expected.in.includes(row[key])) return false;
      if (Object.hasOwn(expected, 'not') && row[key] === expected.not) return false;
      if (Object.hasOwn(expected, 'equals')) {
        const actual = row[key] instanceof Date ? row[key].getTime() : row[key];
        const wanted = expected.equals instanceof Date ? expected.equals.getTime() : expected.equals;
        if (actual !== wanted) return false;
      }
      if (Object.hasOwn(expected, 'lte')) {
        const actual = row[key] instanceof Date ? row[key] : new Date(row[key]);
        const ceiling = expected.lte instanceof Date ? expected.lte : new Date(expected.lte);
        if (Number.isNaN(actual.getTime()) || actual.getTime() > ceiling.getTime()) return false;
      }
      if (Object.hasOwn(expected, 'gt')) {
        const actual = row[key] instanceof Date ? row[key] : new Date(row[key]);
        const floor = expected.gt instanceof Date ? expected.gt : new Date(expected.gt);
        if (Number.isNaN(actual.getTime()) || actual.getTime() <= floor.getTime()) return false;
      }
      return true;
    }
    return row[key] === expected;
  });
}

function orderedRows(rows, orderBy = []) {
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((left, right) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause || {})[0] || [];
      if (!field) continue;
      const leftValue = left[field] instanceof Date ? left[field].getTime() : left[field];
      const rightValue = right[field] instanceof Date ? right[field].getTime() : right[field];
      if (leftValue === rightValue) continue;
      const comparison = leftValue < rightValue ? -1 : 1;
      return direction === 'desc' ? -comparison : comparison;
    }
    return 0;
  });
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && value.increment != null) {
      row[key] = (row[key] || 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
  row.updatedAt = new Date('2026-07-26T12:02:00.000Z');
}

function databaseFixture({
  visualProgressEnabled = true,
  subscriptionStatus = 'ACTIVE',
  evidenceProjectId = scope.projectId,
  evidenceSha256 = imageSha256,
  evidenceSize = image.length,
  evidenceSource = 'dashboard',
  projectStatus = 'ACTIVE',
  beforeAssessmentUpdate = null,
} = {}) {
  const calls = [];
  const state = {
    organization: {
      id: scope.organizationId,
      metadata: aiMetadata(visualProgressEnabled),
      subscriptionPlan: 'PRO',
      subscriptionStatus,
      trialEndsAt: null,
    },
    actor: {
      id: actorId,
      systemRole: 'TENANT_USER',
      membershipStatus: 'ACTIVE',
      tenantRole: 'DIRECTOR',
      projectMembershipStatus: 'ACTIVE',
    },
    project: {
      id: scope.projectId,
      organizationId: scope.organizationId,
      status: projectStatus,
    },
    task: {
      id: 'task-a',
      externalId: 'A-10',
      code: 'MURO-10',
      title: 'Muro norte',
      description: 'Ejecutar mamposteria del muro norte.',
      type: 'TASK',
      status: 'IN_PROGRESS',
      progress: 30,
      startsAt: new Date('2026-07-20T12:00:00.000Z'),
      endsAt: new Date('2026-07-30T12:00:00.000Z'),
      parentId: null,
      revision: 4,
      predecessors: [],
    },
    evidence: {
      id: 'evidence-a',
      projectId: evidenceProjectId,
      taskId: 'task-a',
      capturedAt: new Date('2026-07-26T11:00:00.000Z'),
      caption: 'Muro norte al mediodia',
      media: {
        provider: 'vercel-blob',
        visibility: 'private',
        sha256: evidenceSha256,
        size: evidenceSize,
        mimeType: 'image/png',
        filename: 'muro-norte.png',
        storage: {
          provider: 'vercel-blob',
          assetId: 'https://private.blob.vercel-storage.com/obrasaas/projects/project-a/progress/image.png',
          pathname: 'obrasaas/projects/project-a/progress/image.png',
          publicId: 'obrasaas/projects/project-a/progress/image.png',
          resourceType: 'image',
          format: 'png',
          bytes: evidenceSize,
        },
      },
      status: 'PENDING',
      revision: 2,
      sourceMessageId: null,
      sourceMessage: null,
      ...(evidenceSource === 'whatsapp-v2'
        ? durableWhatsAppEvidence()
        : evidenceSource === 'whatsapp-legacy'
          ? legacyWhatsAppEvidence()
          : {}),
    },
    whatsAppConnection: {
      projectId: scope.projectId,
      phoneNumberId: whatsAppPhoneNumberId,
      enabled: true,
    },
    assessments: [],
    resultReceipts: [],
    budgetLedger: null,
    budgetReservations: new Map(),
    audits: [],
  };

  function evidenceFor(where) {
    if (where.id !== state.evidence.id || where.projectId !== state.evidence.projectId) return null;
    return { ...state.evidence, task: { ...state.task } };
  }

  const transaction = {
    async $executeRawUnsafe(query, projectId) {
      calls.push(['project-lock', query, projectId]);
    },
    async $queryRaw(strings, ...values) {
      const sql = strings.join('?');
      calls.push(['budget-query', sql, values]);
      if (sql.includes('obrasaas_ai_daily_budget_reserve')) {
        const [assessmentId, civilDayUtc, workload, quotaPolicyVersion, limit, reserved] = values;
        const assessment = state.assessments.find((row) => row.id === assessmentId);
        if (!assessment) throw new Error('missing assessment');
        const existing = state.budgetReservations.get(assessmentId);
        if (existing) return [{ ...existing }];
        const row = {
          assessmentId,
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          civilDayUtc,
          workload,
          quotaPolicyVersion,
          budgetLimitMicros: limit,
          reservedMicros: reserved,
          actualMicros: null,
          status: 'RESERVED',
          settlementBasis: null,
          settlementOperationKeyHash: null,
          settlementEvidenceSha256: null,
          settledById: null,
        };
        state.budgetReservations.set(assessmentId, row);
        state.budgetLedger = {
          quotaPolicyVersion,
          budgetLimitMicros: limit,
          reservedMicros: (state.budgetLedger?.reservedMicros || 0n) + reserved,
          settledMicros: state.budgetLedger?.settledMicros || 0n,
        };
        return [{ ...row }];
      }
      if (sql.includes('obrasaas_ai_daily_budget_settle')) {
        const [
          assessmentId,
          actualMicros,
          settlementBasis,
          settlementOperationKeyHash,
          settlementEvidenceSha256,
          settledById,
        ] = values;
        const reservation = state.budgetReservations.get(assessmentId);
        const assessment = state.assessments.find((row) => row.id === assessmentId);
        if (!reservation || !assessment) throw new Error('missing reservation');
        if (reservation.status !== 'RESERVED') return [{ ...reservation }];
        state.budgetLedger.reservedMicros -= reservation.reservedMicros;
        state.budgetLedger.settledMicros += actualMicros;
        reservation.actualMicros = actualMicros;
        reservation.status = settlementBasis === 'PRE_DISPATCH_RELEASE' ? 'RELEASED' : 'SETTLED';
        reservation.settlementBasis = settlementBasis;
        reservation.settlementOperationKeyHash = settlementOperationKeyHash;
        reservation.settlementEvidenceSha256 = settlementEvidenceSha256;
        reservation.settledById = settledById;
        assessment.actualCostMicros = actualMicros;
        return [{ ...reservation }];
      }
      throw new Error('unexpected budget query');
    },
    project: {
      async findFirst({ where }) {
        calls.push(['project-find', where]);
        return where.id === state.project.id
          && (where.organizationId == null || where.organizationId === state.project.organizationId)
          ? { ...state.project }
          : null;
      },
    },
    organization: {
      async findUnique({ where }) {
        calls.push(['organization-find', where]);
        return where.id === state.organization.id ? structuredClone(state.organization) : null;
      },
    },
    aiDailyBudgetLedger: {
      async findUnique() {
        calls.push(['budget-ledger-find']);
        return state.budgetLedger ? { ...state.budgetLedger } : null;
      },
    },
    platformUser: {
      async findUnique({ where }) {
        calls.push(['platform-user-find', where]);
        if (where.id !== state.actor.id) return null;
        const memberships = state.actor.membershipStatus === 'ACTIVE'
          ? [{
              tenantRole: state.actor.tenantRole,
              projectMemberships: state.actor.projectMembershipStatus === 'ACTIVE'
                ? [{ id: 'project-membership-a' }]
                : [],
            }]
          : [];
        return { systemRole: state.actor.systemRole, memberships };
      },
    },
    progressEvidence: {
      async findFirst({ where }) {
        calls.push(['evidence-find', where]);
        return evidenceFor(where);
      },
    },
    whatsAppConnection: {
      async findFirst({ where }) {
        calls.push(['whatsapp-connection-find', where]);
        return where.projectId === state.whatsAppConnection.projectId
          ? { ...state.whatsAppConnection }
          : null;
      },
    },
    task: {
      async findMany({ where }) {
        calls.push(['tasks-find', where]);
        return where.projectId === scope.projectId ? [{ ...state.task }] : [];
      },
    },
    visualProgressAssessment: {
      async findFirst({ where }) {
        calls.push(['assessment-find', where]);
        const row = state.assessments.find((candidate) => matches(candidate, where));
        if (!row) return null;
        if (where.id && (where.evidenceId == null || where.evidenceId === row.evidenceId)) {
          return {
            ...row,
            project: { organizationId: state.project.organizationId },
            evidence: { status: state.evidence.status, media: structuredClone(state.evidence.media) },
            task: { revision: state.task.revision },
          };
        }
        return { ...row };
      },
      async findMany({ where, orderBy, take }) {
        const rows = orderedRows(
          state.assessments.filter((candidate) => matches(candidate, where)),
          orderBy,
        );
        return rows.slice(0, take ?? rows.length).map((row) => ({ ...row }));
      },
      async create({ data }) {
        calls.push(['assessment-create', data]);
        if (state.assessments.some((row) => (
          row.projectId === data.projectId && row.operationKeyHash === data.operationKeyHash
        ))) {
          const conflict = new Error('unique conflict');
          conflict.code = 'P2002';
          throw conflict;
        }
        if (data.registryModelId && state.assessments.some((row) => (
          row.projectId === data.projectId
          && row.evidenceId === data.evidenceId
          && row.registryModelId != null
          && row.actualCostMicros == null
        ))) {
          const conflict = new Error('unsettled dispatch conflict');
          conflict.code = 'P2002';
          throw conflict;
        }
        const row = {
          id: `assessment-${state.assessments.length + 1}`,
          ...data,
          summary: null,
          elementType: null,
          progressMin: null,
          progressMax: null,
          confidence: null,
          quality: {},
          observations: [],
          limitations: [],
          failureCode: null,
          providerResponseId: null,
          providerRequestId: null,
          providerDispatchStartedAt: null,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          cachedInputTokens: null,
          actualCostMicros: null,
          reviewStatus: null,
          reviewNote: null,
          correctedProgressMin: null,
          correctedProgressMax: null,
          reviewedById: null,
          reviewedAt: null,
          completedAt: null,
          revision: 0,
          createdAt: new Date('2026-07-26T12:00:00.000Z'),
          updatedAt: new Date('2026-07-26T12:00:00.000Z'),
        };
        state.assessments.push(row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        calls.push(['assessment-update', where, data]);
        if (typeof beforeAssessmentUpdate === 'function') {
          await beforeAssessmentUpdate({ where, data, state });
        }
        const rows = state.assessments.filter((candidate) => matches(candidate, where));
        for (const row of rows) applyData(row, data);
        return { count: rows.length };
      },
    },
    visualProgressProviderResultReceipt: {
      async findUnique({ where }) {
        calls.push(['result-receipt-find', where]);
        const row = state.resultReceipts.find((candidate) => (
          candidate.assessmentId === where.assessmentId
        ));
        return row ? structuredClone(row) : null;
      },
      async findMany({ where, orderBy, take }) {
        calls.push(['result-receipt-find-many', where]);
        const rows = orderedRows(
          state.resultReceipts.filter((candidate) => matches(candidate, where)),
          orderBy,
        );
        return rows.slice(0, take ?? rows.length).map((row) => structuredClone(row));
      },
      async create({ data }) {
        calls.push(['result-receipt-create', data]);
        if (state.resultReceipts.some((row) => row.assessmentId === data.assessmentId)) {
          const conflict = new Error('receipt unique conflict');
          conflict.code = 'P2002';
          throw conflict;
        }
        const row = {
          ...structuredClone(data),
          appliedAt: null,
          revision: 0,
        };
        state.resultReceipts.push(row);
        return structuredClone(row);
      },
      async updateMany({ where, data }) {
        calls.push(['result-receipt-update', where, data]);
        const rows = state.resultReceipts.filter((candidate) => matches(candidate, where));
        for (const row of rows) applyData(row, data);
        return { count: rows.length };
      },
    },
    auditLog: {
      async create({ data }) {
        calls.push(['audit-create', data]);
        state.audits.push(structuredClone(data));
        return data;
      },
    },
  };
  const prisma = {
    ...transaction,
    async $transaction(callback) {
      return callback(transaction);
    },
  };
  return { prisma, state, calls };
}

function requestInput(overrides = {}) {
  const requestNow = overrides.now instanceof Date
    ? overrides.now
    : new Date('2026-07-26T12:00:00.000Z');
  return {
    scope,
    actorId,
    evidenceId: 'evidence-a',
    idempotencyKey: 'visual-request-0001',
    now: requestNow,
    readFile: async () => ({ stream: image, size: image.length }),
    analyze: async (input) => dispatchedProviderResult(input),
    provider: {
      id: 'openai:gpt-5.6-sol',
      provider: 'openai',
      model: 'gpt-5.6-sol',
    },
    budgetLimitMicros: 1_000_000,
    clock: () => new Date(requestNow.getTime() + 30_000),
    ...overrides,
  };
}

function assertAssessmentError(code, status) {
  return (error) => {
    assert.equal(error instanceof VisualProgressAssessmentError, true);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}

test('tenant opt-in and subscription fail closed before private bytes or provider access', async (t) => {
  for (const scenario of [
    { name: 'visual opt-in disabled', fixture: { visualProgressEnabled: false }, code: 'VISUAL_PROGRESS_DISABLED', status: 409 },
    { name: 'subscription suspended', fixture: { subscriptionStatus: 'SUSPENDED' }, code: 'SUBSCRIPTION_READ_ONLY', status: 402 },
  ]) {
    await t.test(scenario.name, async () => {
      const database = databaseFixture(scenario.fixture);
      let readCalls = 0;
      let providerCalls = 0;
      await assert.rejects(
        requestVisualProgressAssessment(database.prisma, requestInput({
          readFile: async () => { readCalls += 1; },
          analyze: async () => { providerCalls += 1; },
        })),
        assertAssessmentError(scenario.code, scenario.status),
      );
      assert.equal(readCalls, 0);
      assert.equal(providerCalls, 0);
      assert.equal(database.state.assessments.length, 0);
    });
  }
});

test('subscription and tenant opt-in are rechecked immediately before provider dispatch', async (t) => {
  for (const scenario of [
    {
      name: 'subscription revoked during private read',
      mutate(database) { database.state.organization.subscriptionStatus = 'SUSPENDED'; },
      code: 'SUBSCRIPTION_READ_ONLY',
      status: 402,
    },
    {
      name: 'visual opt-in revoked during private read',
      mutate(database) { database.state.organization.metadata = aiMetadata(false); },
      code: 'VISUAL_PROGRESS_DISABLED',
      status: 409,
    },
  ]) {
    await t.test(scenario.name, async () => {
      const database = databaseFixture();
      let providerCalls = 0;
      await assert.rejects(
        requestVisualProgressAssessment(database.prisma, requestInput({
          readFile: async () => {
            scenario.mutate(database);
            return { stream: image, size: image.length };
          },
          analyze: async () => {
            providerCalls += 1;
            return providerResult();
          },
        })),
        assertAssessmentError(scenario.code, scenario.status),
      );
      assert.equal(providerCalls, 0);
      assert.equal(database.state.assessments[0].status, 'FAILED');
      assert.equal(database.state.assessments[0].failureCode, scenario.code);
    });
  }
});

test('exhausted AI budget rejects before private bytes, assessment creation, or provider access', async () => {
  const database = databaseFixture();
  database.state.budgetLedger = {
    quotaPolicyVersion: 'ai-visual-daily-budget-v1',
    budgetLimitMicros: 1_000_000n,
    reservedMicros: 800_000n,
    settledMicros: 0n,
  };
  let readCalls = 0;
  let providerCalls = 0;

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      readFile: async () => { readCalls += 1; },
      analyze: async () => { providerCalls += 1; },
    })),
    assertAssessmentError('AI_DISPATCH_BUDGET_EXCEEDED', 429),
  );

  assert.equal(readCalls, 0);
  assert.equal(providerCalls, 0);
  assert.equal(database.state.assessments.length, 0);
  assert.equal(database.state.budgetReservations.size, 0);
});

test('actor evidence access is rechecked immediately before provider dispatch', async () => {
  const database = databaseFixture();
  let providerCalls = 0;

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      readFile: async () => {
        database.state.actor.membershipStatus = 'DISABLED';
        return { stream: image, size: image.length };
      },
      analyze: async () => {
        providerCalls += 1;
        return providerResult();
      },
    })),
    assertAssessmentError('VISUAL_PROGRESS_ACTOR_ACCESS_REVOKED', 403),
  );
  assert.equal(providerCalls, 0);
  assert.equal(database.state.assessments[0].status, 'FAILED');
  assert.equal(
    database.state.assessments[0].failureCode,
    'VISUAL_PROGRESS_ACTOR_ACCESS_REVOKED',
  );
});

test('private evidence enforces declared size and SHA before exactly one provider call', async (t) => {
  await t.test('stored binary size mismatch', async () => {
    const database = databaseFixture();
    let providerCalls = 0;
    const oversized = Buffer.concat([image, Buffer.from([0])]);
    await assert.rejects(
      requestVisualProgressAssessment(database.prisma, requestInput({
        readFile: async () => ({ stream: oversized, size: oversized.length }),
        analyze: async () => { providerCalls += 1; },
      })),
      assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_INTEGRITY_FAILED', 422),
    );
    assert.equal(providerCalls, 0);
    assert.equal(database.state.budgetReservations.get('assessment-1').status, 'RELEASED');
    assert.equal(database.state.assessments[0].actualCostMicros, 0n);
  });

  await t.test('binary hash mismatch', async () => {
    const database = databaseFixture();
    let providerCalls = 0;
    const altered = Buffer.from('altered-private-image');
    await assert.rejects(
      requestVisualProgressAssessment(database.prisma, requestInput({
        readFile: async () => ({ stream: altered, size: altered.length }),
        analyze: async () => { providerCalls += 1; },
      })),
      assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_INTEGRITY_FAILED', 422),
    );
    assert.equal(providerCalls, 0);
    assert.equal(database.state.budgetReservations.get('assessment-1').status, 'RELEASED');
    assert.equal(database.state.assessments[0].actualCostMicros, 0n);
  });

  await t.test('valid image reaches one selected provider once', async () => {
    const database = databaseFixture();
    let providerCalls = 0;
    const result = await requestVisualProgressAssessment(database.prisma, requestInput({
      readFile: async () => {
        database.calls.push(['private-read']);
        return { stream: image, size: image.length };
      },
      analyze: async (input) => {
        providerCalls += 1;
        database.calls.push(['provider-adapter']);
        assert.equal(input.imageBuffer.equals(image), true);
        assert.equal(input.modelId, 'openai:gpt-5.6-sol');
        return dispatchedProviderResult(input);
      },
    }));
    assert.equal(providerCalls, 1);
    assert.equal(result.assessment.status, 'COMPLETED');
    assert.equal(result.assessment.reviewStatus, 'PENDING');
    assert.equal(result.assessment.actualCostMicros, '1320');
    assert.equal(result.assessment.providerResponseId, 'resp-safe-1');
    assert.equal(result.assessment.providerRequestId, 'req-safe-1');
    assert.equal(database.state.assessments[0].attemptCount, 1);
    assert.equal(database.state.assessments[0].leaseExpiresAt, null);
    assert.equal(database.state.assessments[0].actualCostMicros, 1320n);
    assert.equal(database.state.budgetReservations.get('assessment-1').status, 'SETTLED');
    assert.equal(database.state.budgetReservations.get('assessment-1').actualMicros, 1320n);
    assert.equal(database.state.budgetLedger.reservedMicros, 0n);
    assert.equal(database.state.budgetLedger.settledMicros, 1320n);
    assert.equal(
      database.calls.filter(([kind, sql]) => (
        kind === 'budget-query' && sql.includes('obrasaas_ai_daily_budget_settle')
      )).length,
      1,
    );
    assert.equal(database.state.audits.at(-1).action, 'progress.visual_assessment.completed');
    assert.equal(database.state.audits.at(-1).metadata.providerResponseId, 'resp-safe-1');
    assert.equal(database.state.audits.at(-1).metadata.providerRequestId, 'req-safe-1');
    const budgetRead = database.calls.findIndex(([kind]) => kind === 'budget-ledger-find');
    const assessmentCreate = database.calls.findIndex(([kind]) => kind === 'assessment-create');
    const budgetReserve = database.calls.findIndex(([kind, sql]) => (
      kind === 'budget-query' && sql.includes('obrasaas_ai_daily_budget_reserve')
    ));
    const privateRead = database.calls.findIndex(([kind]) => kind === 'private-read');
    const providerAdapter = database.calls.findIndex(([kind]) => kind === 'provider-adapter');
    assert.equal(
      budgetRead < assessmentCreate
        && assessmentCreate < budgetReserve
        && budgetReserve < privateRead
        && privateRead < providerAdapter,
      true,
    );
  });
});

test('claimed WhatsAppMediaAsset v2 is the exclusive visual source and binds the request fingerprint', async () => {
  const database = databaseFixture({ evidenceSource: 'whatsapp-v2' });
  let providerCalls = 0;
  let selectedStorage = null;
  const result = await requestVisualProgressAssessment(database.prisma, requestInput({
    readFile: async (storage) => {
      selectedStorage = structuredClone(storage);
      return { stream: image, size: image.length };
    },
    analyze: async (input) => {
      providerCalls += 1;
      return dispatchedProviderResult(input);
    },
  }));

  assert.equal(result.assessment.status, 'COMPLETED');
  assert.equal(providerCalls, 1);
  assert.equal(
    selectedStorage.pathname,
    v2WhatsAppStorage().pathname,
  );
  assert.notEqual(
    selectedStorage.pathname,
    database.state.evidence.sourceMessage.metadata.media.storage.pathname,
  );

  const alternate = databaseFixture({ evidenceSource: 'whatsapp-v2' });
  alternate.state.evidence.sourceMessage.whatsappMediaAsset.id = 'media-asset-visual-b';
  alternate.state.evidence.media.assetId = 'media-asset-visual-b';
  await requestVisualProgressAssessment(alternate.prisma, requestInput({
    idempotencyKey: 'visual-request-asset-b',
  }));
  assert.notEqual(
    database.state.assessments[0].requestFingerprint,
    alternate.state.assessments[0].requestFingerprint,
  );
});

test('durable WhatsApp media fails closed for invalid, cross-scope, or incomplete relations', async (t) => {
  const scenarios = [
    {
      name: 'asset is not CLAIMED even when a valid legacy descriptor is present',
      mutate(state) {
        const legacy = legacyWhatsAppEvidence();
        state.evidence.media = legacy.media;
        state.evidence.sourceMessage.mediaUrl = legacy.sourceMessage.mediaUrl;
        state.evidence.sourceMessage.metadata = legacy.sourceMessage.metadata;
        state.evidence.sourceMessage.whatsappMediaAsset.status = 'AVAILABLE';
      },
    },
    {
      name: 'asset organization differs',
      mutate(state) {
        state.evidence.sourceMessage.whatsappMediaAsset.organizationId = 'organization-foreign';
      },
    },
    {
      name: 'asset project differs',
      mutate(state) {
        state.evidence.sourceMessage.whatsappMediaAsset.projectId = 'project-foreign';
      },
    },
    {
      name: 'asset is claimed by another message',
      mutate(state) {
        state.evidence.sourceMessage.whatsappMediaAsset.messageId = 'message-foreign';
      },
    },
    {
      name: 'asset is claimed by another conversation',
      mutate(state) {
        state.evidence.sourceMessage.whatsappMediaAsset.messageConversationId = 'conversation-foreign';
      },
    },
    {
      name: 'provider message hash differs from Message.externalId',
      mutate(state) {
        state.evidence.sourceMessage.whatsappMediaAsset.providerMessageIdHash = 'f'.repeat(64);
      },
    },
    {
      name: 'asset is not an image',
      mutate(state) {
        state.evidence.sourceMessage.whatsappMediaAsset.mediaKind = 'AUDIO';
      },
    },
    {
      name: 'asset MIME is not eligible for visual analysis',
      mutate(state) {
        const asset = state.evidence.sourceMessage.whatsappMediaAsset;
        asset.declaredMimeType = 'application/pdf';
        asset.mimeType = 'application/pdf';
        state.evidence.media.mimeType = 'application/pdf';
      },
    },
    {
      name: 'asset exceeds the visual analysis limit',
      mutate(state) {
        const excessiveSize = 20 * 1024 * 1024 + 1;
        const asset = state.evidence.sourceMessage.whatsappMediaAsset;
        asset.sizeBytes = excessiveSize;
        asset.storage.bytes = excessiveSize;
        state.evidence.media.size = excessiveSize;
      },
    },
    {
      name: 'ProgressEvidence snapshot does not bind the asset id',
      mutate(state) {
        state.evidence.media.assetId = 'media-asset-foreign';
      },
    },
    {
      name: 'ProgressEvidence snapshot SHA differs',
      mutate(state) {
        state.evidence.media.sha256 = '0'.repeat(64);
      },
    },
    {
      name: 'ProgressEvidence snapshot MIME differs',
      mutate(state) {
        state.evidence.media.mimeType = 'image/jpeg';
      },
    },
    {
      name: 'ProgressEvidence snapshot size differs',
      mutate(state) {
        state.evidence.media.size += 1;
      },
    },
    {
      name: 'ProgressEvidence snapshot filename differs',
      mutate(state) {
        state.evidence.media.filename = 'otra-foto.png';
      },
    },
    {
      name: 'selected relation is missing rather than explicitly legacy null',
      mutate(state) {
        delete state.evidence.sourceMessage.whatsappMediaAsset;
      },
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const database = databaseFixture({ evidenceSource: 'whatsapp-v2' });
      scenario.mutate(database.state);
      let readCalls = 0;
      let providerCalls = 0;
      await assert.rejects(
        requestVisualProgressAssessment(database.prisma, requestInput({
          readFile: async () => {
            readCalls += 1;
            return { stream: image, size: image.length };
          },
          analyze: async () => {
            providerCalls += 1;
            return providerResult();
          },
        })),
        assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_INVALID', 422),
      );
      assert.equal(readCalls, 0);
      assert.equal(providerCalls, 0);
      assert.equal(database.state.assessments.length, 0);
    });
  }
});

test('durable source identity is rechecked after private read and before OpenAI dispatch', async () => {
  const database = databaseFixture({ evidenceSource: 'whatsapp-v2' });
  let providerCalls = 0;
  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      readFile: async () => {
        database.state.evidence.sourceMessage.whatsappMediaAsset.id = 'media-asset-visual-changed';
        database.state.evidence.media.assetId = 'media-asset-visual-changed';
        return { stream: image, size: image.length };
      },
      analyze: async () => {
        providerCalls += 1;
        return providerResult();
      },
    })),
    assertAssessmentError('VISUAL_PROGRESS_SOURCE_CHANGED', 409),
  );
  assert.equal(providerCalls, 0);
  assert.equal(database.state.assessments[0].status, 'FAILED');
  assert.equal(database.state.assessments[0].failureCode, 'VISUAL_PROGRESS_SOURCE_CHANGED');
});

test('legacy WhatsApp evidence remains readable only when the selected asset relation is null', async () => {
  const database = databaseFixture({ evidenceSource: 'whatsapp-legacy' });
  let providerCalls = 0;
  let selectedStorage = null;
  const result = await requestVisualProgressAssessment(database.prisma, requestInput({
    readFile: async (storage) => {
      selectedStorage = structuredClone(storage);
      return { stream: image, size: image.length };
    },
    analyze: async (input) => {
      providerCalls += 1;
      return dispatchedProviderResult(input);
    },
  }));
  assert.equal(result.assessment.status, 'COMPLETED');
  assert.equal(providerCalls, 1);
  assert.equal(database.state.evidence.sourceMessage.whatsappMediaAsset, null);
  assert.equal(
    selectedStorage.pathname,
    `obrasaas/whatsapp/${whatsAppPhoneNumberId}/legacy-muro.png`,
  );
});

test('a durable late provider result supersedes lease recovery without a second dispatch', async () => {
  const database = databaseFixture();
  let providerCalls = 0;
  let releaseProvider;
  let enteredProvider;
  const release = new Promise((resolve) => { releaseProvider = resolve; });
  const entered = new Promise((resolve) => { enteredProvider = resolve; });
  const firstInput = requestInput({
    analyze: async (input) => {
      providerCalls += 1;
      await input.onBeforeProviderRequest(providerRoute());
      enteredProvider();
      await release;
      return providerResult();
    },
  });

  const inFlight = requestVisualProgressAssessment(database.prisma, firstInput);
  await entered;
  const running = database.state.assessments[0];
  assert.equal(running.status, 'RUNNING');
  assert.equal(running.attemptCount, 1);
  assert.equal(
    running.leaseExpiresAt.getTime(),
    firstInput.clock().getTime() + VISUAL_PROGRESS_LEASE_MS,
  );

  const recoveryNow = new Date(running.leaseExpiresAt.getTime() + 1);
  const [listed, replayedDuringRecovery] = await Promise.all([
    listVisualProgressAssessments(database.prisma, {
      projectId: scope.projectId,
      evidenceId: 'evidence-a',
      now: recoveryNow,
    }),
    requestVisualProgressAssessment(database.prisma, {
      ...firstInput,
      now: recoveryNow,
    }),
  ]);
  assert.equal(listed.assessments[0].status, 'FAILED');
  assert.equal(listed.assessments[0].failureCode, VISUAL_PROGRESS_LEASE_EXPIRED_CODE);
  assert.equal(replayedDuringRecovery.replayed, true);
  assert.equal(replayedDuringRecovery.pending, false);
  assert.equal(replayedDuringRecovery.assessment.status, 'FAILED');
  assert.equal(
    replayedDuringRecovery.assessment.failureCode,
    VISUAL_PROGRESS_LEASE_EXPIRED_CODE,
  );
  assert.equal(database.state.assessments[0].leaseExpiresAt, null);
  assert.equal(database.state.assessments[0].revision, 2);
  assert.equal(database.state.assessments[0].actualCostMicros, null);
  assert.equal(database.state.budgetReservations.get('assessment-1').status, 'RESERVED');
  assert.equal(
    database.state.audits.filter(
      (entry) => entry.action === 'progress.visual_assessment.lease_expired',
    ).length,
    1,
  );

  releaseProvider();
  const lateResult = await inFlight;
  assert.equal(lateResult.pending, false);
  assert.equal(lateResult.assessment.status, 'COMPLETED');
  assert.equal(database.state.assessments[0].status, 'COMPLETED');
  assert.equal(database.state.assessments[0].failureCode, null);
  assert.equal(database.state.resultReceipts[0].appliedAt instanceof Date, true);
  assert.equal(
    database.state.audits.some(
      (entry) => entry.action === 'progress.visual_assessment.completed',
    ),
    true,
  );

  const replay = await requestVisualProgressAssessment(database.prisma, {
    ...firstInput,
    now: recoveryNow,
    analyze: async () => { providerCalls += 1; return providerResult(); },
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.pending, false);
  assert.equal(replay.assessment.status, 'COMPLETED');
  assert.equal(providerCalls, 1);

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, {
      ...firstInput,
      idempotencyKey: 'visual-request-0002',
      now: recoveryNow,
      analyze: async () => { providerCalls += 1; return providerResult(); },
    }),
    assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_BUSY', 409),
  );
  assert.equal(database.state.assessments.length, 1);
  assert.equal(providerCalls, 1);
});

test('recovery during a blocked private read fences the old worker before provider dispatch', async () => {
  const database = databaseFixture();
  let releaseRead;
  let enteredRead;
  let providerCalls = 0;
  let clockNow = new Date('2026-07-26T12:00:30.000Z');
  const readReleased = new Promise((resolve) => { releaseRead = resolve; });
  const readEntered = new Promise((resolve) => { enteredRead = resolve; });
  const input = requestInput({
    clock: () => new Date(clockNow),
    readFile: async () => {
      enteredRead();
      await readReleased;
      return { stream: image, size: image.length };
    },
    analyze: async (providerInput) => {
      await providerInput.onBeforeProviderRequest(providerRoute());
      providerCalls += 1;
      return providerResult();
    },
  });

  const inFlight = requestVisualProgressAssessment(database.prisma, input);
  await readEntered;
  const initialLease = database.state.assessments[0].leaseExpiresAt;
  clockNow = new Date(initialLease.getTime() + 1);
  const listed = await listVisualProgressAssessments(database.prisma, {
    projectId: scope.projectId,
    evidenceId: 'evidence-a',
    now: clockNow,
  });
  assert.equal(listed.assessments[0].status, 'FAILED');

  releaseRead();
  await assert.rejects(
    inFlight,
    assertAssessmentError('VISUAL_PROGRESS_LEASE_LOST', 409),
  );
  assert.equal(providerCalls, 0);
  assert.equal(database.state.assessments[0].failureCode, VISUAL_PROGRESS_LEASE_EXPIRED_CODE);
  assert.equal(
    database.state.audits.filter(
      (entry) => entry.action === 'progress.visual_assessment.lease_expired',
    ).length,
    1,
  );
});

test('provider result received after lease expiry is staged and applied without redispatch', async () => {
  const database = databaseFixture();
  let releaseProvider;
  let enteredProvider;
  let clockNow = new Date('2026-07-26T12:00:30.000Z');
  const providerReleased = new Promise((resolve) => { releaseProvider = resolve; });
  const providerEntered = new Promise((resolve) => { enteredProvider = resolve; });
  const input = requestInput({
    clock: () => new Date(clockNow),
    analyze: async (providerInput) => {
      await providerInput.onBeforeProviderRequest(providerRoute());
      enteredProvider();
      await providerReleased;
      return providerResult();
    },
  });

  const inFlight = requestVisualProgressAssessment(database.prisma, input);
  await providerEntered;
  const renewedLease = database.state.assessments[0].leaseExpiresAt;
  clockNow = new Date(renewedLease.getTime() + 1);
  releaseProvider();

  const lateResult = await inFlight;
  assert.equal(lateResult.pending, false);
  assert.equal(lateResult.assessment.status, 'COMPLETED');
  assert.equal(database.state.assessments[0].status, 'COMPLETED');
  assert.equal(
    database.state.audits.some(
      (entry) => entry.action === 'progress.visual_assessment.completed',
    ),
    true,
  );

  const recovered = await listVisualProgressAssessments(database.prisma, {
    projectId: scope.projectId,
    evidenceId: 'evidence-a',
    now: clockNow,
  });
  assert.equal(recovered.assessments[0].status, 'COMPLETED');
  assert.equal(recovered.assessments[0].failureCode, null);
});

test('lease renewal fences a recovery that selected the previous lease concurrently', async () => {
  let holdRecovery = false;
  let releaseRecovery;
  let enteredRecovery;
  const recoveryReleased = new Promise((resolve) => { releaseRecovery = resolve; });
  const recoveryEntered = new Promise((resolve) => { enteredRecovery = resolve; });
  const database = databaseFixture({
    beforeAssessmentUpdate: async ({ data }) => {
      if (holdRecovery && data.failureCode === VISUAL_PROGRESS_LEASE_EXPIRED_CODE) {
        enteredRecovery();
        await recoveryReleased;
      }
    },
  });
  let releaseRead;
  let enteredRead;
  let releaseProvider;
  let enteredProvider;
  const readReleased = new Promise((resolve) => { releaseRead = resolve; });
  const readEntered = new Promise((resolve) => { enteredRead = resolve; });
  const providerReleased = new Promise((resolve) => { releaseProvider = resolve; });
  const providerEntered = new Promise((resolve) => { enteredProvider = resolve; });
  const input = requestInput({
    readFile: async () => {
      enteredRead();
      await readReleased;
      return { stream: image, size: image.length };
    },
    analyze: async (providerInput) => {
      await providerInput.onBeforeProviderRequest(providerRoute());
      enteredProvider();
      await providerReleased;
      return providerResult();
    },
  });

  const inFlight = requestVisualProgressAssessment(database.prisma, input);
  await readEntered;
  const previousLease = database.state.assessments[0].leaseExpiresAt;
  holdRecovery = true;
  const recovery = recoverExpiredVisualProgressAssessments(database.prisma, {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    evidenceId: 'evidence-a',
    now: new Date(previousLease.getTime() + 1),
  });
  await recoveryEntered;

  releaseRead();
  await providerEntered;
  const renewed = database.state.assessments[0];
  assert.equal(renewed.revision, 1);
  assert.equal(renewed.leaseExpiresAt.getTime() > previousLease.getTime(), true);

  releaseRecovery();
  const recoveryResult = await recovery;
  assert.deepEqual(recoveryResult.recoveredIds, []);
  assert.equal(
    database.state.audits.some(
      (entry) => entry.action === 'progress.visual_assessment.lease_expired',
    ),
    false,
  );

  releaseProvider();
  const completed = await inFlight;
  assert.equal(completed.assessment.status, 'COMPLETED');
  assert.equal(completed.pending, false);
  assert.equal(completed.costPending, false);
});

test('list recovery targets the newest returned page instead of an older expired backlog', async () => {
  const database = databaseFixture();
  await requestVisualProgressAssessment(database.prisma, requestInput());
  const template = database.state.assessments[0];
  const expiredRows = Array.from({ length: 5 }, (_, index) => ({
    ...template,
    id: `expired-${index + 1}`,
    operationKeyHash: `${index + 1}`.padStart(64, '0'),
    status: 'RUNNING',
    leaseExpiresAt: new Date(`2026-07-26T12:1${index}:00.000Z`),
    attemptCount: 1,
    summary: null,
    elementType: null,
    progressMin: null,
    progressMax: null,
    confidence: null,
    quality: null,
    observations: null,
    limitations: null,
    providerResponseId: null,
    failureCode: null,
    completedAt: null,
    reviewStatus: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    correctedProgressMin: null,
    correctedProgressMax: null,
    revision: 0,
    createdAt: new Date(`2026-07-26T12:0${index}:00.000Z`),
    updatedAt: new Date(`2026-07-26T12:0${index}:00.000Z`),
  }));
  database.state.assessments = expiredRows;
  database.state.audits = [];

  const listed = await listVisualProgressAssessments(database.prisma, {
    projectId: scope.projectId,
    evidenceId: 'evidence-a',
    limit: 2,
    now: new Date('2026-07-26T13:00:00.000Z'),
  });

  assert.deepEqual(listed.assessments.map((row) => row.id), ['expired-5', 'expired-4']);
  assert.deepEqual(listed.assessments.map((row) => row.status), ['FAILED', 'FAILED']);
  assert.deepEqual(
    database.state.audits
      .filter((entry) => entry.action === 'progress.visual_assessment.lease_expired')
      .map((entry) => entry.entityId)
      .sort(),
    ['expired-4', 'expired-5'],
  );
  assert.deepEqual(
    database.state.assessments
      .filter((row) => row.status === 'RUNNING')
      .map((row) => row.id)
      .sort(),
    ['expired-1', 'expired-2', 'expired-3'],
  );
});

test('idempotent replay and concurrent retry never duplicate provider dispatch', async () => {
  const database = databaseFixture();
  let providerCalls = 0;
  let releaseProvider;
  const providerStarted = new Promise((resolve) => { releaseProvider = resolve; });
  let enteredProvider;
  const entered = new Promise((resolve) => { enteredProvider = resolve; });
  const input = requestInput({
    analyze: async (providerInput) => {
      providerCalls += 1;
      await providerInput.onBeforeProviderRequest(providerRoute());
      enteredProvider();
      await providerStarted;
      return providerResult();
    },
  });

  const firstPromise = requestVisualProgressAssessment(database.prisma, input);
  await entered;
  const concurrentReplay = await requestVisualProgressAssessment(database.prisma, input);
  assert.equal(concurrentReplay.replayed, true);
  assert.equal(concurrentReplay.pending, true);
  releaseProvider();
  const first = await firstPromise;
  const completedReplay = await requestVisualProgressAssessment(database.prisma, input);

  assert.equal(first.replayed, false);
  assert.equal(completedReplay.replayed, true);
  assert.equal(completedReplay.pending, false);
  assert.equal(providerCalls, 1);
  assert.equal(database.state.assessments.length, 1);

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, {
      ...input,
      evidenceId: 'different-evidence',
    }),
    assertAssessmentError('IDEMPOTENCY_PAYLOAD_MISMATCH', 409),
  );
});

test('different idempotency keys cannot dispatch two open analyses for one evidence', async () => {
  const database = databaseFixture();
  let providerCalls = 0;
  let releaseProvider;
  let enteredProvider;
  const release = new Promise((resolve) => { releaseProvider = resolve; });
  const entered = new Promise((resolve) => { enteredProvider = resolve; });
  const firstPromise = requestVisualProgressAssessment(database.prisma, requestInput({
    analyze: async (providerInput) => {
      providerCalls += 1;
      await providerInput.onBeforeProviderRequest(providerRoute());
      enteredProvider();
      await release;
      return providerResult();
    },
  }));
  await entered;

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      idempotencyKey: 'visual-request-0002',
      analyze: async () => { providerCalls += 1; return providerResult(); },
    })),
    (error) => (
      error instanceof VisualProgressAssessmentError
      && error.code === 'VISUAL_PROGRESS_EVIDENCE_BUSY'
      && error.status === 409
      && error.assessmentId === 'assessment-1'
    ),
  );
  assert.equal(providerCalls, 1);
  releaseProvider();
  await firstPromise;

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      idempotencyKey: 'visual-request-0003',
    })),
    assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_BUSY', 409),
  );
});

test('completed and abstained outputs remain pending human governance', async () => {
  const completedDb = databaseFixture();
  const completed = await requestVisualProgressAssessment(completedDb.prisma, requestInput());
  assert.equal(completed.assessment.status, 'COMPLETED');
  assert.equal(completed.assessment.reviewStatus, 'PENDING');
  assert.equal(completed.assessment.progressMin, 35);

  const abstainedDb = databaseFixture();
  const abstained = await requestVisualProgressAssessment(abstainedDb.prisma, requestInput({
    analyze: async (input) => dispatchedProviderResult(input, {
      assessment: providerAssessment({
        abstained: true,
        abstentionReason: 'insufficient_context',
        progressMin: null,
        progressMax: null,
        confidence: 0.12,
      }),
    }),
  }));
  assert.equal(abstained.assessment.status, 'ABSTAINED');
  assert.equal(abstained.assessment.reviewStatus, 'PENDING');
  assert.equal(abstained.assessment.progressMin, null);
  assert.equal(abstainedDb.state.audits.at(-1).action, 'progress.visual_assessment.abstained');
});

test('idempotent replay does not require budget configuration or reserve again', async () => {
  const database = databaseFixture();
  const input = requestInput();
  await requestVisualProgressAssessment(database.prisma, input);
  const budgetQueries = database.calls.filter(([kind]) => kind === 'budget-query').length;

  const replay = await requestVisualProgressAssessment(database.prisma, {
    ...input,
    budgetLimitMicros: undefined,
    readBudgetSnapshot: async () => {
      throw new Error('replay must not read budget');
    },
    planDispatch: () => {
      throw new Error('replay must not plan dispatch');
    },
    reserveBudget: async () => {
      throw new Error('replay must not reserve budget');
    },
  });

  assert.equal(replay.replayed, true);
  assert.equal(replay.assessment.status, 'COMPLETED');
  assert.equal(database.calls.filter(([kind]) => kind === 'budget-query').length, budgetQueries);
});

test('valid result without usage retains its reservation and blocks a new dispatch', async () => {
  const database = databaseFixture();
  const completed = await requestVisualProgressAssessment(database.prisma, requestInput({
    analyze: async (input) => dispatchedProviderResult(input, { usage: null }),
  }));

  assert.equal(completed.assessment.status, 'COMPLETED');
  assert.equal(completed.pending, false);
  assert.equal(completed.costPending, true);
  assert.equal(completed.assessment.actualCostMicros, null);
  assert.equal(completed.assessment.providerResponseId, 'resp-safe-1');
  assert.equal(database.state.budgetReservations.get('assessment-1').status, 'RESERVED');
  assert.equal(database.state.budgetLedger.reservedMicros, 250_000n);
  assert.equal(database.state.budgetLedger.settledMicros, 0n);
  assert.equal(database.state.audits.at(-1).metadata.budgetDisposition, 'retained_usage_missing');

  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      idempotencyKey: 'visual-request-usage-missing',
    })),
    assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_UNCERTAIN', 409),
  );
  assert.equal(database.state.assessments.length, 1);
});

test('pre-dispatch adapter failure releases budget and discards an impossible request id', async () => {
  const database = databaseFixture();
  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      analyze: async () => {
        throw new VisualProgressProviderError(
          'PROVIDER_NOT_CONFIGURED',
          'adapter failed before durable dispatch',
          { requestId: 'req-must-not-persist' },
        );
      },
    })),
    assertAssessmentError('PROVIDER_NOT_CONFIGURED', 503),
  );

  const failed = database.state.assessments[0];
  assert.equal(failed.providerDispatchStartedAt, null);
  assert.equal(failed.providerRequestId, null);
  assert.equal(failed.actualCostMicros, 0n);
  assert.equal(database.state.budgetReservations.get(failed.id).status, 'RELEASED');
  assert.equal(safeJson(database.state.audits).includes('req-must-not-persist'), false);
});

test('dispatch boundary rejects a mismatched route before provider contact and releases budget', async () => {
  const database = databaseFixture();
  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      analyze: async (input) => input.onBeforeProviderRequest({
        provider: 'openai',
        model: 'gpt-5.6-terra',
        registryModelId: 'openai:gpt-5.6-terra',
      }),
    })),
    assertAssessmentError('VISUAL_PROGRESS_PROVIDER_ROUTE_MISMATCH', 409),
  );

  const failed = database.state.assessments[0];
  assert.equal(failed.providerDispatchStartedAt, null);
  assert.equal(failed.actualCostMicros, 0n);
  assert.equal(database.state.budgetReservations.get(failed.id).status, 'RELEASED');
  assert.equal(
    database.state.audits.filter(
      (entry) => entry.action === 'progress.visual_assessment.provider_dispatch_started',
    ).length,
    0,
  );
});

test('dispatch boundary is exactly once and a duplicate call retains uncertain budget', async () => {
  const database = databaseFixture();
  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      analyze: async (input) => {
        await input.onBeforeProviderRequest(providerRoute());
        await input.onBeforeProviderRequest(providerRoute());
        return providerResult();
      },
    })),
    assertAssessmentError('VISUAL_PROGRESS_PROVIDER_ROUTE_MISMATCH', 409),
  );

  const failed = database.state.assessments[0];
  assert.notEqual(failed.providerDispatchStartedAt, null);
  assert.equal(failed.actualCostMicros, null);
  assert.equal(database.state.budgetReservations.get(failed.id).status, 'RESERVED');
  assert.equal(
    database.state.audits.filter(
      (entry) => entry.action === 'progress.visual_assessment.provider_dispatch_started',
    ).length,
    1,
  );
});

test('post-dispatch provider failure retains safe correlation without private payloads', async () => {
  const database = databaseFixture();
  await assert.rejects(
    requestVisualProgressAssessment(database.prisma, requestInput({
      analyze: async (input) => {
        await input.onBeforeProviderRequest(providerRoute());
        throw new VisualProgressProviderError(
          'PROVIDER_HTTP_ERROR',
          'secret provider payload and private image detail',
          { status: 429, requestId: 'req-private' },
        );
      },
    })),
    assertAssessmentError('PROVIDER_HTTP_ERROR', 429),
  );
  const failed = database.state.assessments[0];
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.failureCode, 'PROVIDER_HTTP_ERROR');
  assert.equal(failed.providerRequestId, 'req-private');
  assert.equal(database.state.budgetReservations.get(failed.id).status, 'RESERVED');
  assert.equal(safeJson(failed).includes('secret provider payload'), false);
  assert.equal(safeJson(database.state.audits).includes('secret provider payload'), false);
  assert.equal(safeJson(database.state.audits).includes('req-private'), true);
});

test('human review uses CAS, rejects stale baselines, and never mutates Task or Gantt state', async () => {
  const database = databaseFixture();
  const requested = await requestVisualProgressAssessment(database.prisma, requestInput());
  const originalTask = structuredClone(database.state.task);
  for (const [correctedProgressMin, correctedProgressMax] of [
    ['30', '42'],
    ['', ''],
    [null, 42],
  ]) {
    await assert.rejects(
      reviewVisualProgressAssessment(database.prisma, {
        scope,
        actorId,
        evidenceId: 'evidence-a',
        assessmentId: requested.assessment.id,
        expectedRevision: requested.assessment.revision,
        status: 'CORRECTED',
        reviewNote: 'Entrada que debe ser rechazada por tipo.',
        correctedProgressMin,
        correctedProgressMax,
      }),
      assertAssessmentError('VISUAL_PROGRESS_REVIEW_RANGE_INVALID', 400),
    );
  }
  const reviewed = await reviewVisualProgressAssessment(database.prisma, {
    scope,
    actorId,
    evidenceId: 'evidence-a',
    assessmentId: requested.assessment.id,
    expectedRevision: requested.assessment.revision,
    status: 'CORRECTED',
    reviewNote: 'La medicion de obra confirma un rango menor.',
    correctedProgressMin: 30,
    correctedProgressMax: 42,
    now: new Date('2026-07-26T12:03:00.000Z'),
  });
  assert.equal(reviewed.assessment.reviewStatus, 'CORRECTED');
  assert.deepEqual(database.state.task, originalTask);
  assert.equal(database.calls.some(([name]) => name === 'task-update'), false);

  await assert.rejects(
    reviewVisualProgressAssessment(database.prisma, {
      scope,
      actorId,
      evidenceId: 'evidence-a',
      assessmentId: requested.assessment.id,
      expectedRevision: requested.assessment.revision,
      status: 'APPROVED',
    }),
    assertAssessmentError('VISUAL_PROGRESS_ASSESSMENT_CONFLICT', 409),
  );

  const staleDb = databaseFixture();
  const staleRequest = await requestVisualProgressAssessment(staleDb.prisma, requestInput());
  staleDb.state.task.revision += 1;
  await assert.rejects(
    reviewVisualProgressAssessment(staleDb.prisma, {
      scope,
      actorId,
      evidenceId: 'evidence-a',
      assessmentId: staleRequest.assessment.id,
      expectedRevision: staleRequest.assessment.revision,
      status: 'APPROVED',
    }),
    assertAssessmentError('VISUAL_PROGRESS_ASSESSMENT_STALE', 409),
  );
  assert.equal(staleDb.state.assessments[0].reviewStatus, 'PENDING');

  const staleRejected = await reviewVisualProgressAssessment(staleDb.prisma, {
    scope,
    actorId,
    evidenceId: 'evidence-a',
    assessmentId: staleRequest.assessment.id,
    expectedRevision: staleRequest.assessment.revision,
    status: 'REJECTED',
    reviewNote: 'Descartada porque cambió la línea base.',
  });
  assert.equal(staleRejected.assessment.reviewStatus, 'REJECTED');
  assert.equal(staleDb.state.audits.at(-1).metadata.staleAtReview, true);
});

test('public visual DTO omits provider, hashes and internal failure details', async () => {
  const database = databaseFixture();
  const result = await requestVisualProgressAssessment(database.prisma, requestInput());
  const publicDto = serializePublicVisualProgressAssessment(result.assessment);
  assert.equal(publicDto.id, result.assessment.id);
  assert.equal(publicDto.evidenceId, result.assessment.evidenceId);
  assert.equal(publicDto.taskId, result.assessment.taskId);
  assert.equal(publicDto.summary, result.assessment.summary);
  for (const privateField of [
    'projectId',
    'provider',
    'model',
    'analyzerVersion',
    'baselineHash',
    'taskRevisionAtRequest',
    'evidenceRevisionAtRequest',
    'failureCode',
  ]) {
    assert.equal(Object.hasOwn(publicDto, privateField), false, privateField);
  }
});

test('project and evidence isolation fail closed for requests and reviews', async () => {
  const foreignEvidence = databaseFixture({ evidenceProjectId: 'project-foreign' });
  let providerCalls = 0;
  await assert.rejects(
    requestVisualProgressAssessment(foreignEvidence.prisma, requestInput({
      analyze: async () => { providerCalls += 1; },
    })),
    assertAssessmentError('VISUAL_PROGRESS_EVIDENCE_NOT_FOUND', 404),
  );
  assert.equal(providerCalls, 0);

  const database = databaseFixture();
  const requested = await requestVisualProgressAssessment(database.prisma, requestInput());
  await assert.rejects(
    reviewVisualProgressAssessment(database.prisma, {
      scope: { ...scope, projectId: 'project-foreign' },
      actorId,
      evidenceId: 'evidence-a',
      assessmentId: requested.assessment.id,
      expectedRevision: requested.assessment.revision,
      status: 'APPROVED',
    }),
    (error) => error.code === 'PROJECT_WRITE_SCOPE_INVALID' && error.status === 403,
  );
});

test('visual assessment routes bind record scope, evidence permission, idempotency and bounded review input', async () => {
  const [collectionRoute, reviewRoute] = await Promise.all([
    readFile(
      new URL('../src/app/api/progress/[recordId]/visual-assessments/route.js', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL(
        '../src/app/api/progress/[recordId]/visual-assessments/[assessmentId]/route.js',
        import.meta.url,
      ),
      'utf8',
    ),
  ]);

  assert.match(collectionRoute, /requireTenantPermission\(access, 'org:execution:read'/);
  assert.match(collectionRoute, /requireTenantPermission\(access, SOURCE_EVIDENCE_PERMISSION/);
  assert.match(collectionRoute, /requireTenantPermission\(access, 'org:execution:manage'/);
  assert.match(collectionRoute, /projectId: access\.project\.id/);
  assert.match(collectionRoute, /evidenceId: recordId/);
  assert.match(collectionRoute, /request\.headers\.get\('Idempotency-Key'\)/);
  assert.match(collectionRoute, /result\.assessments\.map\(serializePublicVisualProgressAssessment\)/);
  assert.match(collectionRoute, /assessment: serializePublicVisualProgressAssessment\(result\.assessment\)/);
  assert.match(collectionRoute, /'Cache-Control': 'private, no-store'/);

  assert.match(reviewRoute, /const MAX_REVIEW_BODY_BYTES = 16 \* 1024/);
  assert.match(reviewRoute, /readJsonRequest\(request, \{ maxBytes: MAX_REVIEW_BODY_BYTES \}\)/);
  assert.match(reviewRoute, /requireTenantPermission\(access, 'org:execution:manage'/);
  assert.match(reviewRoute, /requireTenantPermission\(access, SOURCE_EVIDENCE_PERMISSION/);
  assert.match(reviewRoute, /projectId: access\.project\.id/);
  assert.match(reviewRoute, /evidenceId: recordId/);
  assert.match(reviewRoute, /assessmentId/);
  assert.match(reviewRoute, /expectedRevision: input\.expectedRevision/);
  assert.match(reviewRoute, /assessment: serializePublicVisualProgressAssessment\(result\.assessment\)/);
  assert.match(reviewRoute, /'Cache-Control': 'private, no-store'/);
});
