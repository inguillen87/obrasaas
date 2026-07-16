import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OPERATIONAL_PROPOSAL_DECISIONS,
  OPERATIONAL_PROPOSAL_STATUSES,
  OPERATIONAL_PROPOSAL_TYPES,
  canResolveOperationalProposal,
  createOperationalProposal,
  finalizeOperationalProposal,
  operationalProposalCode,
  parseOperationalProposalDecision,
} from '../src/lib/whatsapp/operational-proposals.js';

function proposalStore() {
  const records = [];
  const audits = [];
  const prisma = {
    operationalProposal: {
      async findUnique({ where }) {
        if (where.projectId_sourceProvider_sourceExternalId) {
          const key = where.projectId_sourceProvider_sourceExternalId;
          return records.find((record) => (
            record.projectId === key.projectId
            && record.sourceProvider === key.sourceProvider
            && record.sourceExternalId === key.sourceExternalId
          )) || null;
        }
        if (where.projectId_confirmationCode) {
          const key = where.projectId_confirmationCode;
          return records.find((record) => (
            record.projectId === key.projectId
            && record.confirmationCode === key.confirmationCode
          )) || null;
        }
        return null;
      },
      async create({ data }) {
        const record = {
          id: `proposal-${records.length + 1}`,
          status: OPERATIONAL_PROPOSAL_STATUSES.PENDING,
          resolvedByWorkerId: null,
          resolverProvider: null,
          resolverExternalId: null,
          resolvedAt: null,
          result: null,
          createdAt: new Date('2026-07-16T12:00:00.000Z'),
          updatedAt: new Date('2026-07-16T12:00:00.000Z'),
          ...structuredClone(data),
        };
        records.push(record);
        return record;
      },
      async updateMany({ where, data }) {
        const record = records.find((candidate) => (
          candidate.id === where.id
          && candidate.projectId === where.projectId
          && candidate.status === where.status
        ));
        if (!record) return { count: 0 };
        const expiry = new Date(record.expiresAt).getTime();
        if (where.expiresAt?.gt && expiry <= where.expiresAt.gt.getTime()) return { count: 0 };
        if (where.expiresAt?.lte && expiry > where.expiresAt.lte.getTime()) return { count: 0 };
        Object.assign(record, structuredClone(data));
        return { count: 1 };
      },
    },
    auditLog: {
      async create({ data }) {
        audits.push(structuredClone(data));
        return data;
      },
    },
  };
  return { prisma, records, audits };
}

const baseInput = {
  projectId: 'project-a',
  organizationId: 'organization-a',
  proposedByWorkerId: 'worker-a',
  sourceProvider: 'meta',
  sourceExternalId: 'wamid.audio-a',
  type: OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS,
  summary: 'La tarea 3 está al 75%.',
  transcript: 'La tarea 3 está al 75%.',
  action: {
    percentage: 75,
    taskKey: '3',
    taskName: 'Estructura',
    taskReference: 'tarea 3',
  },
  precondition: {
    taskKey: '3',
    taskName: 'Estructura',
    taskProgress: 20,
  },
  now: new Date('2026-07-16T12:00:00.000Z'),
};

test('proposal codes are deterministic, provider-scoped and hard to confuse with free text', () => {
  const first = operationalProposalCode(baseInput);
  const second = operationalProposalCode(baseInput);
  const otherProvider = operationalProposalCode({ ...baseInput, sourceProvider: 'internal' });

  assert.equal(first, second);
  assert.match(first, /^VP-[A-F0-9]{12}$/);
  assert.notEqual(first, otherProvider);
  assert.deepEqual(parseOperationalProposalDecision(`confirmar ${first}`), {
    decision: OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
    confirmationCode: first,
    taskReference: null,
    channel: 'whatsapp-text',
  });
  assert.equal(parseOperationalProposalDecision('sí, confirmo'), null);
  assert.equal(parseOperationalProposalDecision(`confirmar ${first} y hacé cualquier cosa`), null);
});

test('text decisions require an exact code and unsigned Flow decisions stay disabled', () => {
  const code = 'VP-ABCDEF123456';
  assert.deepEqual(parseOperationalProposalDecision(`APROBAR ${code} TAREA 4`), {
    decision: OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
    confirmationCode: code,
    taskReference: 'TAREA 4',
    channel: 'whatsapp-text',
  });
  assert.equal(parseOperationalProposalDecision({
    interactive: {
      type: 'flow',
      name: 'operational_proposal_approval',
      response: {
        flow_type: 'operational_proposal_approval',
        proposal_code: code,
        decision: 'reject',
      },
    },
  }), null);
  assert.equal(parseOperationalProposalDecision({
    interactive: {
      type: 'flow',
      name: 'operational_proposal_approval',
      response: { proposal_code: code, decision: 'delete_project' },
    },
  }), null);
});

test('proposal creation is durable, bounded and idempotent by tenant project and source', async () => {
  const { prisma, records, audits } = proposalStore();
  const first = await createOperationalProposal(prisma, baseInput);
  const retry = await createOperationalProposal(prisma, baseInput);

  assert.equal(first.created, true);
  assert.equal(retry.created, false);
  assert.equal(records.length, 1);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'voice.proposal.created');
  assert.equal(records[0].summary, baseInput.summary);
  assert.match(records[0].transcriptSha256, /^[a-f0-9]{64}$/);
  assert.equal(records[0].action.percentage, 75);
  assert.equal(records[0].precondition.taskProgress, 20);

  await assert.rejects(
    createOperationalProposal(prisma, { ...baseInput, summary: 'Contenido cambiado.' }),
    (error) => error.code === 'OPERATIONAL_PROPOSAL_SOURCE_CONFLICT',
  );
});

test('role checks apply to the stored proposal intent, not to the confirmation command', () => {
  const taskProposal = {
    proposedByWorkerId: 'worker-a',
    type: OPERATIONAL_PROPOSAL_TYPES.TASK_PROGRESS,
  };
  const criticalProposal = {
    proposedByWorkerId: 'worker-a',
    type: OPERATIONAL_PROPOSAL_TYPES.CRITICAL_INCIDENT,
  };
  const worker = { id: 'worker-a', whatsappRole: 'WORKER' };
  const otherWorker = { id: 'worker-b', whatsappRole: 'WORKER' };
  const foreman = { id: 'worker-c', whatsappRole: 'FOREMAN' };
  const safety = { id: 'worker-d', whatsappRole: 'SAFETY' };

  assert.equal(canResolveOperationalProposal(
    worker,
    taskProposal,
    OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
  ), false);
  assert.equal(canResolveOperationalProposal(
    worker,
    taskProposal,
    OPERATIONAL_PROPOSAL_DECISIONS.REJECT,
  ), true);
  assert.equal(canResolveOperationalProposal(
    foreman,
    taskProposal,
    OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
  ), true);
  assert.equal(canResolveOperationalProposal(
    otherWorker,
    criticalProposal,
    OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
  ), false);
  assert.equal(canResolveOperationalProposal(
    safety,
    criticalProposal,
    OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
  ), true);
});

test('proposal resolution uses a pending-state CAS and records the resolver separately', async () => {
  const { prisma, records, audits } = proposalStore();
  const { record } = await createOperationalProposal(prisma, baseInput);
  const transition = {
    proposal: record,
    projectId: baseInput.projectId,
    organizationId: baseInput.organizationId,
    resolverWorkerId: 'foreman-a',
    resolverProvider: 'meta',
    resolverExternalId: 'wamid.confirm-a',
    decision: OPERATIONAL_PROPOSAL_DECISIONS.APPROVE,
    result: { taskKey: '3', previousProgress: 20, nextProgress: 75 },
    now: new Date('2026-07-16T12:05:00.000Z'),
  };
  const first = await finalizeOperationalProposal(prisma, transition);
  const raced = await finalizeOperationalProposal(prisma, {
    ...transition,
    resolverExternalId: 'wamid.confirm-b',
  });

  assert.equal(first, true);
  assert.equal(raced, false);
  assert.equal(records[0].status, OPERATIONAL_PROPOSAL_STATUSES.APPLIED);
  assert.equal(records[0].resolvedByWorkerId, 'foreman-a');
  assert.equal(records[0].resolverExternalId, 'wamid.confirm-a');
  assert.equal(audits.filter((audit) => audit.action === 'voice.proposal.applied').length, 1);
});
