import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStartActTransition,
  assertWorkerDocumentTransition,
  normalizeStartActInput,
  normalizeWorkerDocumentInput,
  listProjectStartActs,
  listWorkerDocuments,
} from '../src/lib/worker-documents.js';

const HASH = 'a'.repeat(64);

test('normalizes a private worker document and rejects invalid dates', () => {
  const result = normalizeWorkerDocumentInput({
    workerId: 'worker-1', type: 'art', version: 2, sha256: HASH,
    storage: { provider: 's3', key: 'private/doc-1', visibility: 'private' },
    issuedAt: '2026-07-01T00:00:00Z', expiresAt: '2027-07-01T00:00:00Z',
  });
  assert.equal(result.type, 'ART');
  assert.equal(result.version, 2);
  assert.deepEqual(result.storage, { provider: 's3', key: 'private/doc-1', visibility: 'private' });
  assert.throws(() => normalizeWorkerDocumentInput({ ...result, expiresAt: '2026-06-01T00:00:00Z' }), /expiresAt/);
  assert.throws(() => normalizeWorkerDocumentInput({ ...result, storage: { provider: 's3', key: 'https://public.example/doc', visibility: 'private' } }), /Clave/);
  assert.throws(() => normalizeWorkerDocumentInput({ ...result, storage: { provider: 's3', key: 'private/doc', visibility: 'public' } }), /privado/);
  assert.throws(() => normalizeWorkerDocumentInput({ ...result, storage: { provider: 's3', key: 'private/doc', visibility: 'private', contentType: 'application/zip' } }), /MIME/);
  assert.throws(() => normalizeWorkerDocumentInput({ ...result, storage: { provider: 's3', key: 'private/doc', visibility: 'private', sizeBytes: 26 * 1024 * 1024 } }), /Tama/);
});

test('document lifecycle is terminal after archive and rejects illegal transitions', () => {
  assert.equal(assertWorkerDocumentTransition('PENDING_REVIEW', 'VALID'), 'VALID');
  assert.equal(assertWorkerDocumentTransition('VALID', 'EXPIRED'), 'EXPIRED');
  assert.throws(() => assertWorkerDocumentTransition('ARCHIVED', 'VALID'), /Transición/);
});

test('start act requires unique participants and follows signature lifecycle', () => {
  const act = normalizeStartActInput({
    version: 1, sha256: HASH, document: { title: 'Acta de inicio' },
    participants: [{ subjectType: 'CLIENT', subjectId: 'c1', displayName: 'Cliente', role: 'CLIENTE' }],
  });
  assert.equal(act.participants.length, 1);
  assert.equal(act.sha256, HASH);
  assert.throws(() => normalizeStartActInput({ ...act, sha256: 'not-a-sha' }), /sha256/);
  assert.throws(() => normalizeStartActInput({ ...act, participants: [...act.participants, act.participants[0]] }), /duplicado/);
  assert.equal(assertStartActTransition('DRAFT', 'PENDING_SIGNATURES'), 'PENDING_SIGNATURES');
  assert.equal(assertStartActTransition('PENDING_SIGNATURES', 'SIGNED'), 'SIGNED');
  assert.throws(() => assertStartActTransition('SIGNED', 'DRAFT'), /Transición/);
});

test('document reads are project-scoped, bounded and omit private storage fields', async () => {
  let query;
  const prisma = { workerDocument: { findMany: async (input) => { query = input; return [{
    id: 'doc-1', workerId: 'worker-1', type: 'ART', version: 1, status: 'VALID',
    issuedAt: new Date('2026-01-01T00:00:00Z'), expiresAt: null, reviewedAt: null,
    reviewedById: 'reviewer-1', rejectionReason: null, createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  }]; } } };
  const result = await listWorkerDocuments(prisma, { projectId: 'project-1', workerId: 'worker-1', status: 'valid', limit: 25 });
  assert.deepEqual(query.where, { projectId: 'project-1', workerId: 'worker-1', status: 'VALID' });
  assert.equal(query.take, 25);
  assert.equal('storage' in query.select, false);
  assert.equal('sha256' in query.select, false);
  assert.equal(result.documents[0].issuedAt, '2026-01-01T00:00:00.000Z');
  assert.equal('storage' in result.documents[0], false);
  assert.equal('sha256' in result.documents[0], false);
  assert.rejects(() => listWorkerDocuments(prisma, { projectId: 'project-1', limit: 501 }), /limit/);
});

test('start act reads are project-scoped and omit document and signature payloads', async () => {
  let query;
  const prisma = { projectStartAct: { findMany: async (input) => { query = input; return [{
    id: 'act-1', projectId: 'project-1', version: 1, status: 'SIGNED', effectiveAt: null,
    signedAt: new Date('2026-01-03T00:00:00Z'), voidedAt: null, createdAt: new Date('2026-01-03T00:00:00Z'),
    updatedAt: new Date('2026-01-03T00:00:00Z'),
    participants: [{ id: 'p-1', subjectType: 'CLIENT', subjectId: 'c-1', displayName: 'Cliente', role: 'CLIENTE', signedAt: null }],
  }]; } } };
  const result = await listProjectStartActs(prisma, { projectId: 'project-1', status: 'signed' });
  assert.deepEqual(query.where, { projectId: 'project-1', status: 'SIGNED' });
  assert.equal(query.take, 100);
  assert.equal('document' in query.select, false);
  assert.equal('signatureEvidence' in query.select, false);
  assert.equal(result.acts[0].signedAt, '2026-01-03T00:00:00.000Z');
  assert.equal('document' in result.acts[0], false);
  assert.equal('signatureEvidence' in result.acts[0], false);
});
