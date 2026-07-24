import assert from 'node:assert/strict';
import test from 'node:test';
import { auditMetadata, createAuditLog } from '../src/lib/audit-log.js';

test('normaliza metadata y agrega correlationId seguro', () => {
  assert.deepEqual(auditMetadata({ projectId: 'p1' }, 'req-42'), { projectId: 'p1', correlationId: 'req-42' });
  assert.deepEqual(auditMetadata(null, '<unsafe>'), {});
});

test('createAuditLog centraliza la escritura y conserva el alcance', async () => {
  let payload;
  const transaction = { auditLog: { create: async ({ data }) => { payload = data; return data; } } };
  await createAuditLog(transaction, { organizationId: 'org', actorId: 'user', action: 'x', entityType: 'Y', entityId: 'id', metadata: { projectId: 'p' }, correlationId: 'req-1' });
  assert.deepEqual(payload.metadata, { projectId: 'p', correlationId: 'req-1' });
  assert.equal(payload.organizationId, 'org');
});
