import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProjectWritePolicyError,
  isOperationalProjectWriteStatus,
  projectWritePolicyErrorResponse,
  requireOperationalProjectWrite,
  runOperationalProjectMutation,
} from '../src/lib/project-write-policy.js';

const scope = {
  organizationId: 'organization-a',
  projectId: 'project-a',
};

function transactionDouble(status = 'ACTIVE') {
  const calls = [];
  return {
    calls,
    transaction: {
      async $executeRawUnsafe(query, projectId) {
        calls.push(['lock', query, projectId]);
      },
      project: {
        async findFirst(args) {
          calls.push(['project', args]);
          return {
            id: scope.projectId,
            organizationId: scope.organizationId,
            status,
          };
        },
      },
      worker: {
        async create(args) {
          calls.push(['worker-create', args]);
          return args.data;
        },
      },
    },
  };
}

test('planning, active and paused projects allow operational administration', () => {
  for (const status of ['PLANNING', 'ACTIVE', 'PAUSED']) {
    assert.equal(isOperationalProjectWriteStatus(status), true);
  }
  assert.equal(isOperationalProjectWriteStatus('COMPLETED'), false);
  assert.equal(isOperationalProjectWriteStatus('ARCHIVED'), false);
});

test('the write guard locks first and re-reads the tenant-bound project status', async () => {
  const { calls, transaction } = transactionDouble('PAUSED');
  const project = await requireOperationalProjectWrite(transaction, scope);

  assert.equal(project.status, 'PAUSED');
  assert.deepEqual(calls.map(([name]) => name), ['lock', 'project']);
  assert.match(calls[0][1], /pg_advisory_xact_lock/);
  assert.equal(calls[0][2], scope.projectId);
  assert.deepEqual(calls[1][1].where, {
    id: scope.projectId,
    organizationId: scope.organizationId,
  });
});

for (const status of ['COMPLETED', 'ARCHIVED']) {
  test(`${status.toLowerCase()} projects reject field administration before mutation`, async () => {
    const { calls, transaction } = transactionDouble(status);
    const prisma = {
      async $transaction(callback) {
        return callback(transaction);
      },
    };

    await assert.rejects(
      runOperationalProjectMutation(prisma, scope, (tx) => tx.worker.create({
        data: { projectId: scope.projectId, name: 'No debe guardarse' },
      })),
      (error) => (
        error instanceof ProjectWritePolicyError
        && error.code === 'PROJECT_READ_ONLY'
        && error.status === 409
        && error.projectStatus === status
      ),
    );
    assert.deepEqual(calls.map(([name]) => name), ['lock', 'project']);
  });
}

test('a project outside the active tenant fails closed with a structured 403', async () => {
  const { calls, transaction } = transactionDouble();
  transaction.project.findFirst = async (args) => {
    calls.push(['project', args]);
    return null;
  };

  let policyError;
  await assert.rejects(
    requireOperationalProjectWrite(transaction, scope),
    (error) => {
      policyError = error;
      return error.code === 'PROJECT_WRITE_SCOPE_INVALID' && error.status === 403;
    },
  );
  const response = projectWritePolicyErrorResponse(policyError);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: 'La obra ya no está disponible dentro de la organización activa.',
    code: 'PROJECT_WRITE_SCOPE_INVALID',
  });
  assert.deepEqual(calls.map(([name]) => name), ['lock', 'project']);
});
