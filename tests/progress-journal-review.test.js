import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProgressJournalError,
  reviewProgressRecord,
} from '../src/lib/progress-journal.js';

const SCOPE = Object.freeze({
  organizationId: 'organization-a',
  projectId: 'project-a',
});

function progressRecord(kind, status, revision = 0) {
  const common = {
    id: 'record-a',
    projectId: SCOPE.projectId,
    taskId: 'task-a',
    status,
    revision,
    createdAt: new Date('2026-07-26T12:00:00.000Z'),
    updatedAt: new Date('2026-07-26T12:00:00.000Z'),
  };
  if (kind === 'DAILY_LOG') {
    return {
      ...common,
      workDate: new Date('2026-07-26T00:00:00.000Z'),
      title: 'Avance del frente norte',
      summary: 'Se completó la mampostería prevista.',
      submittedAt: status === 'DRAFT' ? null : new Date('2026-07-26T13:00:00.000Z'),
      approvedAt: status === 'APPROVED' ? new Date('2026-07-26T14:00:00.000Z') : null,
      rejectionReason: status === 'REJECTED' ? 'Corregir cantidades.' : null,
    };
  }
  return {
    ...common,
    authorWorkerId: null,
    capturedAt: new Date('2026-07-26T11:45:00.000Z'),
    caption: 'Muro norte',
    media: {},
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    reviewedAt: status === 'PENDING' ? null : new Date('2026-07-26T14:00:00.000Z'),
    reviewNote: status === 'PENDING' ? null : 'Revisión previa',
    sourceMessageId: null,
  };
}

function fakePrisma(kind, initialStatus, revision = 0) {
  const state = {
    row: progressRecord(kind, initialStatus, revision),
    updates: [],
    audits: [],
  };
  const table = {
    async findFirst(args) {
      if (args.where.projectId !== SCOPE.projectId || args.where.id !== state.row.id) return null;
      return { ...state.row };
    },
    async update(args) {
      assert.equal(args.where.id, state.row.id);
      state.updates.push(args);
      const data = args.data;
      state.row = {
        ...state.row,
        ...data,
        revision: state.row.revision + data.revision.increment,
        updatedAt: new Date('2026-07-26T15:00:00.000Z'),
      };
      return { ...state.row };
    },
  };
  const transaction = {
    async $executeRawUnsafe() {
      return 1;
    },
    project: {
      async findFirst() {
        return { ...SCOPE, status: 'ACTIVE' };
      },
    },
    dailyLog: kind === 'DAILY_LOG' ? table : {},
    progressEvidence: kind === 'EVIDENCE' ? table : {},
    auditLog: {
      async create(args) {
        state.audits.push(args.data);
        return args.data;
      },
    },
  };
  return {
    state,
    prisma: {
      async $transaction(operation) {
        return operation(transaction);
      },
    },
  };
}

async function review(prisma, kind, status, expected, reviewNote = null) {
  return reviewProgressRecord(prisma, {
    scope: SCOPE,
    actorId: 'actor-a',
    id: 'record-a',
    kind,
    status,
    expected,
    reviewNote,
  });
}

function transitionError(error) {
  assert.ok(error instanceof ProgressJournalError);
  assert.equal(error.code, 'PROGRESS_JOURNAL_TRANSITION_INVALID');
  assert.equal(error.status, 409);
  assert.doesNotMatch(error.message, /undefined|null|record-a|project-a/i);
  return true;
}

test('daily logs follow DRAFT -> SUBMITTED -> APPROVED and retain CAS revisions', async () => {
  const { prisma, state } = fakePrisma('DAILY_LOG', 'DRAFT');

  const submitted = await review(prisma, 'DAILY_LOG', 'SUBMITTED', 0);
  assert.equal(submitted.dailyLog.status, 'SUBMITTED');
  assert.equal(submitted.dailyLog.revision, 1);
  assert.ok(submitted.dailyLog.submittedAt);
  assert.equal(submitted.dailyLog.approvedAt, null);

  const approved = await review(prisma, 'DAILY_LOG', 'APPROVED', 1);
  assert.equal(approved.dailyLog.status, 'APPROVED');
  assert.equal(approved.dailyLog.revision, 2);
  assert.ok(approved.dailyLog.approvedAt);
  assert.deepEqual(
    state.audits.map((audit) => audit.metadata),
    [
      {
        projectId: SCOPE.projectId,
        previousStatus: 'DRAFT',
        status: 'SUBMITTED',
        revision: 1,
      },
      {
        projectId: SCOPE.projectId,
        previousStatus: 'SUBMITTED',
        status: 'APPROVED',
        revision: 2,
      },
    ],
  );
});

test('a submitted daily log can be rejected but cannot be reopened implicitly', async () => {
  const { prisma, state } = fakePrisma('DAILY_LOG', 'SUBMITTED', 4);

  const result = await review(prisma, 'DAILY_LOG', 'REJECTED', 4, 'Falta el metrado ejecutado.');
  assert.equal(result.dailyLog.status, 'REJECTED');
  assert.equal(result.dailyLog.revision, 5);
  assert.equal(result.dailyLog.rejectionReason, 'Falta el metrado ejecutado.');

  await assert.rejects(
    review(prisma, 'DAILY_LOG', 'SUBMITTED', 5),
    transitionError,
  );
  assert.equal(state.updates.length, 1);
  assert.equal(state.audits.length, 1);
});

test('daily logs reject skips, no-op reviews, rollbacks, and terminal-state changes', async () => {
  const forbidden = {
    DRAFT: ['DRAFT', 'APPROVED', 'REJECTED'],
    SUBMITTED: ['DRAFT', 'SUBMITTED'],
    APPROVED: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    REJECTED: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  };

  for (const [currentStatus, nextStatuses] of Object.entries(forbidden)) {
    for (const nextStatus of nextStatuses) {
      const { prisma, state } = fakePrisma('DAILY_LOG', currentStatus, 3);
      await assert.rejects(
        review(prisma, 'DAILY_LOG', nextStatus, 3),
        transitionError,
      );
      assert.equal(state.updates.length, 0, `${currentStatus} -> ${nextStatus} updated the row`);
      assert.equal(state.audits.length, 0, `${currentStatus} -> ${nextStatus} emitted an audit`);
    }
  }
});

test('evidence allows only PENDING -> APPROVED or PENDING -> REJECTED', async () => {
  for (const nextStatus of ['APPROVED', 'REJECTED']) {
    const { prisma, state } = fakePrisma('EVIDENCE', 'PENDING', 7);
    const result = await review(prisma, 'EVIDENCE', nextStatus, 7, 'Revisión humana');
    assert.equal(result.evidence.status, nextStatus);
    assert.equal(result.evidence.revision, 8);
    assert.ok(result.evidence.reviewedAt);
    assert.equal(result.evidence.reviewNote, 'Revisión humana');
    assert.equal(state.updates.length, 1);
    assert.equal(state.audits[0].metadata.previousStatus, 'PENDING');
  }
});

test('evidence rejects no-op reviews and every transition out of a terminal state', async () => {
  const forbidden = {
    PENDING: ['PENDING'],
    APPROVED: ['PENDING', 'APPROVED', 'REJECTED'],
    REJECTED: ['PENDING', 'APPROVED', 'REJECTED'],
  };

  for (const [currentStatus, nextStatuses] of Object.entries(forbidden)) {
    for (const nextStatus of nextStatuses) {
      const { prisma, state } = fakePrisma('EVIDENCE', currentStatus, 2);
      await assert.rejects(
        review(prisma, 'EVIDENCE', nextStatus, 2),
        transitionError,
      );
      assert.equal(state.updates.length, 0, `${currentStatus} -> ${nextStatus} updated the row`);
      assert.equal(state.audits.length, 0, `${currentStatus} -> ${nextStatus} emitted an audit`);
    }
  }
});

test('revision conflicts win before transition evaluation and have no side effects', async () => {
  const { prisma, state } = fakePrisma('DAILY_LOG', 'DRAFT', 9);

  await assert.rejects(
    review(prisma, 'DAILY_LOG', 'APPROVED', 8),
    (error) => {
      assert.ok(error instanceof ProgressJournalError);
      assert.equal(error.code, 'PROGRESS_JOURNAL_CONFLICT');
      assert.equal(error.status, 409);
      return true;
    },
  );
  assert.equal(state.updates.length, 0);
  assert.equal(state.audits.length, 0);
});
