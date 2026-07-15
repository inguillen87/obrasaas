import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CrmAccountInputError,
  normalizeCrmAccountInput,
  serializeCrmAccount,
} from '../src/lib/superadmin-crm.js';

test('CRM opportunities normalize contacts and commercial data', () => {
  const normalized = normalizeCrmAccountInput({
    name: '  Constructora Río  ',
    contactName: ' Ana Pérez ',
    email: ' ANA@EJEMPLO.COM ',
    phone: ' +54 11 5555 0101 ',
    segment: 'CONSTRUCTION',
    source: 'REFERRAL',
    stage: 'QUALIFIED',
    estimatedSeats: '25',
    estimatedMonthlyValue: '399.999',
    nextFollowUpAt: '2026-07-20',
  });

  assert.equal(normalized.data.name, 'Constructora Río');
  assert.equal(normalized.data.email, 'ana@ejemplo.com');
  assert.equal(normalized.data.estimatedSeats, 25);
  assert.equal(normalized.data.estimatedMonthlyValue, 400);
  assert.equal(normalized.data.nextFollowUpAt.toISOString(), '2026-07-20T12:00:00.000Z');
});

test('CRM opportunity updates produce an auditable diff and reject no-op saves', () => {
  const current = {
    name: 'Estudio Norte',
    contactName: null,
    email: 'hola@estudio.test',
    phone: null,
    segment: 'ARCHITECTURE',
    source: 'ORGANIC',
    stage: 'NEW',
    estimatedSeats: 5,
    estimatedMonthlyValue: { toString: () => '199' },
    nextFollowUpAt: null,
    notes: null,
  };
  const update = normalizeCrmAccountInput({
    name: current.name,
    email: current.email,
    segment: current.segment,
    source: current.source,
    stage: 'CONTACTED',
    estimatedSeats: 5,
    estimatedMonthlyValue: 199,
  }, current);

  assert.deepEqual(update.changes, { stage: { from: 'NEW', to: 'CONTACTED' } });
  assert.throws(
    () => normalizeCrmAccountInput({ name: current.name }, current),
    CrmAccountInputError,
  );
});

test('CRM inputs fail closed for invalid enums, emails, values and dates', () => {
  assert.throws(() => normalizeCrmAccountInput({ name: 'A' }), /2 caracteres/);
  assert.throws(() => normalizeCrmAccountInput({ name: 'Empresa', email: 'bad' }), /email válido/);
  assert.throws(() => normalizeCrmAccountInput({ name: 'Empresa', stage: 'HACKED' }), /etapa/);
  assert.throws(() => normalizeCrmAccountInput({ name: 'Empresa', estimatedSeats: 0 }), /entero/);
  assert.throws(() => normalizeCrmAccountInput({ name: 'Empresa', nextFollowUpAt: '20-07-2026' }), /AAAA-MM-DD/);
  assert.throws(() => normalizeCrmAccountInput({ name: 'Empresa', nextFollowUpAt: '2026-02-31' }), /inválida/);
});

test('CRM serializer exposes safe JSON primitives', () => {
  const result = serializeCrmAccount({
    id: 'crm-1',
    organizationId: null,
    name: 'Gobierno Local',
    contactName: null,
    email: null,
    phone: null,
    segment: 'GOVERNMENT',
    source: 'OUTBOUND',
    stage: 'PROPOSAL',
    estimatedSeats: 100,
    estimatedMonthlyValue: { toString: () => '899.50' },
    nextFollowUpAt: new Date('2026-07-22T12:00:00.000Z'),
    notes: null,
    createdAt: new Date('2026-07-15T12:00:00.000Z'),
    updatedAt: new Date('2026-07-16T12:00:00.000Z'),
  });

  assert.equal(result.estimatedMonthlyValue, 899.5);
  assert.equal(result.nextFollowUpAt, '2026-07-22T12:00:00.000Z');
});
