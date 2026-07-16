import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizePublicLeadInput,
  PublicLeadInputError,
} from '../src/lib/public-leads.js';

const now = new Date('2026-07-16T01:00:00.000Z').getTime();

function validLead(overrides = {}) {
  return {
    organization: 'Constructora Norte',
    contactName: 'Ana Pérez',
    email: 'ANA@CONSTRUCTORA.COM',
    phone: '+54 9 11 5555 0000',
    segment: 'CONSTRUCTION',
    estimatedSeats: '24',
    primaryChallenge: 'Necesitamos ordenar avances, materiales y reportes diarios.',
    website: '',
    startedAt: now - 10_000,
    ...overrides,
  };
}

test('public lead normalization creates a CRM-ready organic opportunity', () => {
  const result = normalizePublicLeadInput(validLead(), { now });
  assert.equal(result.spam, false);
  assert.deepEqual(result.data, {
    name: 'Constructora Norte',
    contactName: 'Ana Pérez',
    email: 'ana@constructora.com',
    phone: '+54 9 11 5555 0000',
    segment: 'CONSTRUCTION',
    source: 'ORGANIC',
    stage: 'NEW',
    estimatedSeats: 24,
    notes: 'Solicitud desde la landing de ObraSaaS.\n\nDesafío principal:\nNecesitamos ordenar avances, materiales y reportes diarios.',
  });
});

test('public lead normalization rejects unknown fields, invalid emails and unsupported segments', () => {
  assert.throws(
    () => normalizePublicLeadInput(validLead({ admin: true }), { now }),
    PublicLeadInputError,
  );
  assert.throws(
    () => normalizePublicLeadInput(validLead({ email: 'no-email' }), { now }),
    /email laboral válido/,
  );
  assert.throws(
    () => normalizePublicLeadInput(validLead({ segment: 'SUPERADMIN' }), { now }),
    /tipo de organización/,
  );
});

test('public lead normalization silently quarantines honeypots and implausible timings', () => {
  assert.equal(
    normalizePublicLeadInput(validLead({ website: 'https://spam.example' }), { now }).spam,
    true,
  );
  assert.equal(
    normalizePublicLeadInput(validLead({ startedAt: now + 1_000 }), { now }).spam,
    true,
  );
  assert.equal(
    normalizePublicLeadInput(validLead({ startedAt: now - 3 * 60 * 60 * 1_000 }), { now }).spam,
    true,
  );
});
