import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertStartActTransition,
  assertWorkerDocumentTransition,
  normalizeStartActInput,
  normalizeWorkerDocumentInput,
} from '../src/lib/worker-documents.js';

const HASH = 'a'.repeat(64);

test('normalizes a private worker document and rejects invalid dates', () => {
  const result = normalizeWorkerDocumentInput({
    workerId: 'worker-1', type: 'art', version: 2, sha256: HASH,
    storage: { provider: 'cloudinary', publicId: 'private/doc-1', visibility: 'private' },
    issuedAt: '2026-07-01T00:00:00Z', expiresAt: '2027-07-01T00:00:00Z',
  });
  assert.equal(result.type, 'ART');
  assert.equal(result.version, 2);
  assert.throws(() => normalizeWorkerDocumentInput({ ...result, expiresAt: '2026-06-01T00:00:00Z' }), /expiresAt/);
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
  assert.throws(() => normalizeStartActInput({ ...act, participants: [...act.participants, act.participants[0]] }), /duplicado/);
  assert.equal(assertStartActTransition('DRAFT', 'PENDING_SIGNATURES'), 'PENDING_SIGNATURES');
  assert.equal(assertStartActTransition('PENDING_SIGNATURES', 'SIGNED'), 'SIGNED');
  assert.throws(() => assertStartActTransition('SIGNED', 'DRAFT'), /Transición/);
});
