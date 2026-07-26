import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  WorkerFinancialDataError,
  WORKER_FINANCIAL_FIELDS,
  WORKER_FINANCIAL_PURPOSES,
  decryptWorkerFinancialPayload,
  encryptWorkerFinancialPayload,
  isValidWorkerCuil,
  maskWorkerFinancialValue,
  normalizeWorkerBankKey,
  normalizeWorkerCuil,
  normalizeWorkerIdentityInput,
  normalizeWorkerPaymentAlias,
  normalizeWorkerPaymentDestinationInput,
  normalizeWorkerWhatsAppAddress,
  normalizeWorkerWhatsAppProviderSubject,
  readWorkerFinancialFingerprintKey,
  readWorkerFinancialFingerprintKeyRegistry,
  readWorkerFinancialKeyConfiguration,
  readWorkerFinancialKekRegistry,
  rewrapWorkerFinancialPayload,
  serializeWorkerPaymentDestination,
  serializeWorkerPaymentDestinationForPayroll,
  workerFinancialFingerprint,
  workerFinancialFingerprintCandidates,
  workerFinancialLastFour,
} from '../src/lib/worker-financial-data.js';

// Test-only, algorithmically generated fixtures. They are not copied from a
// person, bank account, wallet, production database, or provider response.
const TEST_CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const TEST_BANK_BLOCK_ONE_WEIGHTS = [7, 1, 3, 9, 7, 1, 3];
const TEST_BANK_BLOCK_TWO_WEIGHTS = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3];

function syntheticModuloCheckDigit(digits, weights) {
  const sum = weights.reduce(
    (total, weight, index) => total + Number(digits[index]) * weight,
    0,
  );
  return (10 - (sum % 10)) % 10;
}

function syntheticCuilDigits(prefix = '20', document = '00000000') {
  const firstTenDigits = `${prefix}${document}`;
  const sum = TEST_CUIT_WEIGHTS.reduce(
    (total, weight, index) => total + Number(firstTenDigits[index]) * weight,
    0,
  );
  const candidate = 11 - (sum % 11);
  const checkDigit = candidate === 11 ? 0 : candidate === 10 ? 9 : candidate;
  return `${firstTenDigits}${checkDigit}`;
}

function formatSyntheticCuil(digits) {
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

function syntheticBankKey(firstSevenDigits, accountThirteenDigits) {
  return [
    firstSevenDigits,
    syntheticModuloCheckDigit(firstSevenDigits, TEST_BANK_BLOCK_ONE_WEIGHTS),
    accountThirteenDigits,
    syntheticModuloCheckDigit(accountThirteenDigits, TEST_BANK_BLOCK_TWO_WEIGHTS),
  ].join('');
}

const CUIL_DIGITS = syntheticCuilDigits();
const CUIL = formatSyntheticCuil(CUIL_DIGITS);
const NON_HUMAN_CUIT = formatSyntheticCuil(syntheticCuilDigits('30'));
const CBU = syntheticBankKey('9999999', '0000000000000');
const CVU = syntheticBankKey('0000001', '0000000000000');
const KEY_ID = 'worker-financial-kek-v1';
const FINGERPRINT_KEY_ID = 'worker-financial-fingerprint-v1';

function registry(key = crypto.randomBytes(32)) {
  return { currentKeyId: KEY_ID, keys: new Map([[KEY_ID, key]]) };
}

function fingerprintRegistry(key = crypto.randomBytes(32)) {
  return {
    currentKeyId: FINGERPRINT_KEY_ID,
    keys: new Map([[FINGERPRINT_KEY_ID, key]]),
  };
}

function paymentBinding(overrides = {}) {
  return {
    organizationId: 'org-a',
    subjectId: 'person-a',
    recordId: 'destination-a',
    recordVersion: 1,
    purpose: WORKER_FINANCIAL_PURPOSES.PAYMENT_DESTINATION,
    destinationType: 'CBU',
    field: WORKER_FINANCIAL_FIELDS.PAYMENT_DESTINATION,
    ...overrides,
  };
}

function channelBinding(overrides = {}) {
  return {
    organizationId: 'org-a',
    subjectId: 'person-a',
    recordId: 'channel-a',
    recordVersion: 1,
    purpose: WORKER_FINANCIAL_PURPOSES.CHANNEL_ADDRESS,
    destinationType: 'WHATSAPP_E164',
    field: WORKER_FINANCIAL_FIELDS.CHANNEL_ADDRESS,
    ...overrides,
  };
}

function legacyV2Envelope(payload, binding, keyRegistry) {
  const wrappingKeyId = keyRegistry.currentKeyId;
  const kek = keyRegistry.keys.get(wrappingKeyId);
  const normalizedBinding = {
    domain: 'obrasaas:worker-financial-data',
    envelopeVersion: 'v2',
    organizationId: binding.organizationId,
    subjectId: binding.subjectId,
    recordId: binding.recordId,
    recordVersion: binding.recordVersion,
    purpose: binding.purpose,
    destinationType: binding.destinationType,
    wrappingKeyId,
  };
  const payloadBinding = { ...normalizedBinding };
  delete payloadBinding.wrappingKeyId;
  const plaintext = JSON.stringify(payload);
  const dek = crypto.randomBytes(32);
  const dataIv = crypto.randomBytes(12);
  const wrappingIv = crypto.randomBytes(12);
  const dataCipher = crypto.createCipheriv('aes-256-gcm', dek, dataIv);
  dataCipher.setAAD(Buffer.from(JSON.stringify({ ...payloadBinding, component: 'payload' })), {
    plaintextLength: Buffer.byteLength(plaintext),
  });
  const ciphertext = Buffer.concat([dataCipher.update(plaintext, 'utf8'), dataCipher.final()]);
  const wrappingCipher = crypto.createCipheriv('aes-256-gcm', kek, wrappingIv);
  wrappingCipher.setAAD(Buffer.from(JSON.stringify({
    ...normalizedBinding,
    component: 'wrapped-dek',
  })), { plaintextLength: dek.length });
  const wrappedDek = Buffer.concat([wrappingCipher.update(dek), wrappingCipher.final()]);
  dek.fill(0);
  return {
    encryptedPayload: [
      'v2',
      dataIv.toString('base64url'),
      dataCipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
      wrappingIv.toString('base64url'),
      wrappingCipher.getAuthTag().toString('base64url'),
      wrappedDek.toString('base64url'),
    ].join('.'),
    wrappingKeyId,
  };
}

test('CUIL normalization accepts separators and rejects invalid check digits', () => {
  const invalidCheckDigit = `${CUIL.slice(0, -1)}${(Number(CUIL.at(-1)) + 1) % 10}`;
  assert.equal(normalizeWorkerCuil(CUIL), CUIL_DIGITS);
  assert.equal(isValidWorkerCuil(CUIL.replaceAll('-', ' ')), true);
  assert.equal(isValidWorkerCuil(invalidCheckDigit), false);
  assert.equal(isValidWorkerCuil(NON_HUMAN_CUIT), false);
  assert.throws(
    () => normalizeWorkerCuil(invalidCheckDigit),
    (error) => error.code === 'WORKER_FINANCIAL_CUIL_INVALID',
  );
});

test('CBU and CVU validation enforces both check digits and their official shapes', () => {
  assert.equal(normalizeWorkerBankKey(CBU, 'CBU'), CBU);
  assert.equal(normalizeWorkerBankKey(CVU, 'CVU'), CVU);
  assert.throws(() => normalizeWorkerBankKey(`${CBU.slice(0, -1)}2`, 'CBU'));
  assert.throws(() => normalizeWorkerBankKey(CBU, 'CVU'));
  assert.throws(() => normalizeWorkerBankKey(CVU, 'CBU'));
});

test('payment aliases are bounded, canonical and never treated as verified', () => {
  assert.equal(normalizeWorkerPaymentAlias(' Mi.Alias-1 '), 'mi.alias-1');
  assert.equal(normalizeWorkerPaymentAlias(' .alias-valido '), '.alias-valido');
  assert.throws(() => normalizeWorkerPaymentAlias('corto'));
  assert.throws(() => normalizeWorkerPaymentAlias('alias_invalido'));
  assert.deepEqual(normalizeWorkerPaymentDestinationInput({
    type: 'alias',
    value: 'Mi.Alias-1',
    holderName: '  Carlos   Perez ',
    holderCuil: CUIL,
  }), {
    type: 'ALIAS',
    value: 'mi.alias-1',
    holderName: 'Carlos Perez',
    holderCuil: CUIL_DIGITS,
    currency: 'ARS',
    verificationStatus: 'PENDING_VERIFICATION',
  });
});

test('WhatsApp addresses and provider subjects have strict canonical forms', () => {
  assert.equal(normalizeWorkerWhatsAppAddress(' +54 9 261 555-0123 '), '+5492615550123');
  assert.equal(normalizeWorkerWhatsAppProviderSubject('+54 9 261 555-0123'), '5492615550123');
  assert.throws(() => normalizeWorkerWhatsAppAddress('0261 555 0123'));
  assert.throws(() => normalizeWorkerWhatsAppProviderSubject('wa:user@example.com'));
});

test('worker identity requires explicit versioned privacy acceptance and starts pending', () => {
  const now = new Date('2026-07-24T12:00:00.000Z');
  assert.deepEqual(normalizeWorkerIdentityInput({
    givenNames: '  Carlos Alberto ',
    familyName: ' Perez ',
    cuil: CUIL,
    privacyNoticeVersion: 'worker-onboarding-ar-v1',
    privacyAccepted: true,
  }, { now }), {
    givenNames: 'Carlos Alberto',
    familyName: 'Perez',
    legalName: 'Carlos Alberto Perez',
    cuil: CUIL_DIGITS,
    identityStatus: 'PENDING_REVIEW',
    privacyNoticeVersion: 'worker-onboarding-ar-v1',
    privacyAcceptedAt: now,
  });
  assert.throws(
    () => normalizeWorkerIdentityInput({
      givenNames: 'Carlos',
      familyName: 'Perez',
      cuil: CUIL,
      privacyNoticeVersion: 'v1',
      privacyAccepted: false,
    }),
    (error) => error.code === 'WORKER_FINANCIAL_PRIVACY_REQUIRED',
  );
});

test('identity and payment inputs reject unknown or non-object payloads', () => {
  assert.throws(() => normalizeWorkerIdentityInput([]), WorkerFinancialDataError);
  assert.throws(
    () => normalizeWorkerPaymentDestinationInput({
      type: 'CBU',
      value: CBU,
      holderName: 'Carlos Perez',
      holderCuil: CUIL,
      verified: true,
    }),
    (error) => error.code === 'WORKER_FINANCIAL_UNKNOWN_FIELDS',
  );
});

test('financial payloads use randomized authenticated encryption and round-trip', () => {
  const keyRegistry = registry();
  const payload = {
    value: CBU,
    holderCuil: normalizeWorkerCuil(CUIL),
    holderName: 'Carlos Perez',
  };
  const first = encryptWorkerFinancialPayload(payload, paymentBinding(), { registry: keyRegistry });
  const second = encryptWorkerFinancialPayload(payload, paymentBinding(), { registry: keyRegistry });
  assert.notEqual(first.encryptedPayload, second.encryptedPayload);
  assert.match(first.encryptedPayload, /^v3\./);
  assert.equal(first.encryptedPayload.includes(CBU), false);
  assert.equal(first.encryptedPayload.includes(payload.holderCuil), false);
  assert.deepEqual(
    decryptWorkerFinancialPayload(first, paymentBinding(), { registry: keyRegistry }),
    payload,
  );
});

test('new encryption requires an explicit authenticated field', () => {
  assert.throws(
    () => encryptWorkerFinancialPayload({ value: CBU }, {
      ...paymentBinding(),
      field: undefined,
    }, { registry: registry() }),
    (error) => error.code === 'WORKER_FINANCIAL_INPUT_INVALID',
  );
});

test('new encryption accepts only the canonical field for each purpose and value type', () => {
  const keyRegistry = registry();
  assert.throws(
    () => encryptWorkerFinancialPayload(
      { value: CBU },
      paymentBinding({ field: WORKER_FINANCIAL_FIELDS.PAYMENT_RESOLUTION }),
      { registry: keyRegistry },
    ),
    (error) => error.code === 'WORKER_FINANCIAL_INPUT_INVALID',
  );
  assert.throws(
    () => encryptWorkerFinancialPayload(
      { cuil: CUIL_DIGITS },
      {
        organizationId: 'org-a',
        subjectId: 'person-a',
        recordId: 'claim-a',
        recordVersion: 1,
        purpose: WORKER_FINANCIAL_PURPOSES.ONBOARDING_CLAIM,
        destinationType: 'CUIL',
        field: WORKER_FINANCIAL_FIELDS.CLAIM_IDENTITY,
      },
      { registry: keyRegistry },
    ),
    (error) => error.code === 'WORKER_FINANCIAL_INPUT_INVALID',
  );
});

test('ciphertext tampering and every AAD scope change fail authentication', () => {
  const keyRegistry = registry();
  const encrypted = encryptWorkerFinancialPayload({ value: CBU }, paymentBinding(), {
    registry: keyRegistry,
  });
  const segments = encrypted.encryptedPayload.split('.');
  const tag = Buffer.from(segments[2], 'base64url');
  tag[0] ^= 0x01;
  const tampered = { ...encrypted, encryptedPayload: [
    segments[0],
    segments[1],
    tag.toString('base64url'),
    ...segments.slice(3),
  ].join('.') };
  assert.throws(
    () => decryptWorkerFinancialPayload(tampered, paymentBinding(), { registry: keyRegistry }),
    (error) => error.code === 'WORKER_FINANCIAL_DECRYPTION_FAILED',
  );
  for (const changedBinding of [
    paymentBinding({ organizationId: 'org-b' }),
    paymentBinding({ subjectId: 'person-b' }),
    paymentBinding({ recordId: 'destination-b' }),
    paymentBinding({ recordVersion: 2 }),
    paymentBinding({ destinationType: 'CVU' }),
    paymentBinding({ field: WORKER_FINANCIAL_FIELDS.PAYMENT_RESOLUTION }),
  ]) {
    assert.throws(
      () => decryptWorkerFinancialPayload(encrypted, changedBinding, { registry: keyRegistry }),
      (error) => error.code === 'WORKER_FINANCIAL_DECRYPTION_FAILED',
    );
  }
});

test('ciphertexts cannot be swapped between sensitive fields in the same record', () => {
  const keyRegistry = registry();
  const encrypted = encryptWorkerFinancialPayload(
    { address: '+5492615550123' },
    channelBinding(),
    { registry: keyRegistry },
  );
  assert.throws(
    () => decryptWorkerFinancialPayload(encrypted, channelBinding({
      field: WORKER_FINANCIAL_FIELDS.CLAIM_SENDER,
    }), { registry: keyRegistry }),
    (error) => error.code === 'WORKER_FINANCIAL_DECRYPTION_FAILED',
  );
});

test('envelope data keys can be rewrapped onto a rotated KEK', () => {
  const oldKeyId = 'worker-financial-kek-old';
  const newKeyId = 'worker-financial-kek-new';
  const keyRegistry = {
    currentKeyId: oldKeyId,
    keys: new Map([
      [oldKeyId, crypto.randomBytes(32)],
      [newKeyId, crypto.randomBytes(32)],
    ]),
  };
  const binding = paymentBinding({ wrappingKeyId: oldKeyId });
  const encrypted = encryptWorkerFinancialPayload({ value: CBU }, binding, {
    registry: keyRegistry,
  });
  const rewrapped = rewrapWorkerFinancialPayload(encrypted, binding, {
    registry: keyRegistry,
    targetKeyId: newKeyId,
  });
  const beforeSegments = encrypted.encryptedPayload.split('.');
  const afterSegments = rewrapped.encryptedPayload.split('.');
  assert.equal(rewrapped.wrappingKeyId, newKeyId);
  assert.notEqual(rewrapped.encryptedPayload, encrypted.encryptedPayload);
  assert.deepEqual(afterSegments.slice(1, 4), beforeSegments.slice(1, 4));
  assert.notDeepEqual(afterSegments.slice(4), beforeSegments.slice(4));
  assert.deepEqual(
    decryptWorkerFinancialPayload(rewrapped, paymentBinding(), { registry: keyRegistry }),
    { value: CBU },
  );
});

test('safe legacy v2 payment envelopes remain readable and rewrappable', () => {
  const oldKeyId = 'worker-financial-kek-old';
  const newKeyId = 'worker-financial-kek-new';
  const keyRegistry = {
    currentKeyId: newKeyId,
    keys: new Map([
      [oldKeyId, crypto.randomBytes(32)],
      [newKeyId, crypto.randomBytes(32)],
    ]),
  };
  const legacyRegistry = { currentKeyId: oldKeyId, keys: keyRegistry.keys };
  const binding = paymentBinding();
  const legacy = legacyV2Envelope({ value: CBU }, binding, legacyRegistry);
  assert.deepEqual(
    decryptWorkerFinancialPayload(legacy, { ...binding, field: undefined }, { registry: keyRegistry }),
    { value: CBU },
  );
  const rewrapped = rewrapWorkerFinancialPayload(legacy, binding, {
    registry: keyRegistry,
    targetKeyId: newKeyId,
  });
  assert.match(rewrapped.encryptedPayload, /^v2\./);
  assert.equal(rewrapped.wrappingKeyId, newKeyId);
  assert.deepEqual(
    decryptWorkerFinancialPayload(rewrapped, binding, { registry: keyRegistry }),
    { value: CBU },
  );
});

test('ambiguous legacy v2 onboarding envelopes fail closed', () => {
  const keyRegistry = registry();
  const binding = {
    organizationId: 'org-a',
    subjectId: 'person-a',
    recordId: 'claim-a',
    recordVersion: 1,
    purpose: WORKER_FINANCIAL_PURPOSES.ONBOARDING_CLAIM,
    destinationType: 'CUIL',
    field: WORKER_FINANCIAL_FIELDS.CLAIM_IDENTITY,
  };
  const legacy = legacyV2Envelope({ cuil: CUIL_DIGITS }, binding, keyRegistry);
  assert.throws(
    () => decryptWorkerFinancialPayload(legacy, binding, { registry: keyRegistry }),
    (error) => error.code === 'WORKER_FINANCIAL_DECRYPTION_FAILED',
  );
  assert.throws(
    () => rewrapWorkerFinancialPayload(legacy, binding, { registry: keyRegistry }),
    (error) => error.code === 'WORKER_FINANCIAL_DECRYPTION_FAILED',
  );
});

test('fresh encryption cannot be downgraded to a retained KEK', () => {
  const oldKeyId = 'worker-financial-kek-old';
  const newKeyId = 'worker-financial-kek-current';
  const keyRegistry = {
    currentKeyId: newKeyId,
    keys: new Map([
      [oldKeyId, crypto.randomBytes(32)],
      [newKeyId, crypto.randomBytes(32)],
    ]),
  };
  const encrypted = encryptWorkerFinancialPayload(
    { value: CBU },
    paymentBinding({ wrappingKeyId: oldKeyId }),
    { registry: keyRegistry },
  );
  assert.equal(encrypted.wrappingKeyId, newKeyId);
});

test('financial key registries fail closed for absent, malformed or unavailable keys', () => {
  const keyBytes = crypto.randomBytes(32);
  const key = keyBytes.toString('base64');
  const fingerprintKey = crypto.randomBytes(32).toString('base64');
  assert.throws(() => readWorkerFinancialKekRegistry({}));
  assert.throws(() => readWorkerFinancialKekRegistry({
    WORKER_FINANCIAL_KEK_ID: KEY_ID,
    WORKER_FINANCIAL_KEK_REGISTRY_JSON: '{',
  }));
  assert.throws(() => readWorkerFinancialKekRegistry({
    WORKER_FINANCIAL_KEK_ID: 'missing',
    WORKER_FINANCIAL_KEK_REGISTRY_JSON: JSON.stringify({ [KEY_ID]: key }),
  }));
  assert.throws(() => readWorkerFinancialFingerprintKeyRegistry({
    WORKER_FINANCIAL_FINGERPRINT_KEY_ID: FINGERPRINT_KEY_ID,
    WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON: JSON.stringify({
      [FINGERPRINT_KEY_ID]: Buffer.alloc(16).toString('base64'),
    }),
  }));
  const completeEnv = {
    WORKER_FINANCIAL_KEK_ID: KEY_ID,
    WORKER_FINANCIAL_KEK_REGISTRY_JSON: JSON.stringify({ [KEY_ID]: key }),
    WORKER_FINANCIAL_FINGERPRINT_KEY_ID: FINGERPRINT_KEY_ID,
    WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON: JSON.stringify({
      [FINGERPRINT_KEY_ID]: fingerprintKey,
    }),
  };
  assert.equal(readWorkerFinancialFingerprintKey(completeEnv).length, 32);
  assert.equal(
    readWorkerFinancialKeyConfiguration(completeEnv).fingerprintRegistry.currentKeyId,
    FINGERPRINT_KEY_ID,
  );
  assert.throws(() => readWorkerFinancialKeyConfiguration({
    ...completeEnv,
    WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON: JSON.stringify({
      [FINGERPRINT_KEY_ID]: key,
    }),
  }));
});

test('keyed fingerprints are stable but tenant and value type scoped', () => {
  const keyRegistry = fingerprintRegistry();
  const first = workerFinancialFingerprint(CBU, {
    organizationId: 'org-a',
    valueType: 'CBU',
  }, { registry: keyRegistry });
  assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(first.fingerprintKeyId, FINGERPRINT_KEY_ID);
  assert.deepEqual(workerFinancialFingerprint(`${CBU.slice(0, 8)}-${CBU.slice(8)}`, {
    organizationId: 'org-a',
    valueType: 'CBU',
  }, { registry: keyRegistry }), first);
  assert.notEqual(workerFinancialFingerprint(CBU, {
    organizationId: 'org-b',
    valueType: 'CBU',
  }, { registry: keyRegistry }).fingerprint, first.fingerprint);
  assert.notEqual(workerFinancialFingerprint(CVU, {
    organizationId: 'org-a',
    valueType: 'CVU',
  }, { registry: keyRegistry }).fingerprint, first.fingerprint);
});

test('WhatsApp fingerprints and suffixes are canonical without exposing addresses', () => {
  const keyRegistry = fingerprintRegistry();
  const formatted = '+54 9 261 555-0123';
  const canonical = '+5492615550123';
  const address = workerFinancialFingerprint(formatted, {
    organizationId: 'org-a',
    valueType: 'WHATSAPP_E164',
  }, { registry: keyRegistry });
  assert.deepEqual(workerFinancialFingerprint(canonical, {
    organizationId: 'org-a',
    valueType: 'WHATSAPP_E164',
  }, { registry: keyRegistry }), address);
  assert.match(address.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(address.fingerprint.includes('5492615550123'), false);
  assert.equal(workerFinancialLastFour(formatted, 'WHATSAPP_E164'), '0123');
  assert.equal(
    workerFinancialLastFour('5492615550123', 'WHATSAPP_PROVIDER_SUBJECT'),
    '0123',
  );
});

test('dual fingerprint candidates support controlled key rotation', () => {
  const oldKeyId = 'worker-financial-fingerprint-old';
  const newKeyId = 'worker-financial-fingerprint-new';
  const keyRegistry = {
    currentKeyId: newKeyId,
    keys: new Map([
      [oldKeyId, crypto.randomBytes(32)],
      [newKeyId, crypto.randomBytes(32)],
    ]),
  };
  const candidates = workerFinancialFingerprintCandidates(CBU, {
    organizationId: 'org-a',
    valueType: 'CBU',
  }, { registry: keyRegistry, keyIds: [newKeyId, oldKeyId] });
  assert.deepEqual(candidates.map(({ fingerprintKeyId }) => fingerprintKeyId), [
    newKeyId,
    oldKeyId,
  ]);
  assert.notEqual(candidates[0].fingerprint, candidates[1].fingerprint);
});

test('public serializers expose only a masked destination DTO', () => {
  const row = {
    id: 'destination-a',
    type: 'CBU',
    lastFour: workerFinancialLastFour(CBU, 'CBU'),
    holderName: 'Carlos Perez',
    holderCuil: 'test-only-holder-cuil',
    status: 'PENDING_VERIFICATION',
    version: 1,
    revision: 0,
    availableFrom: null,
    verifiedAt: null,
    createdAt: new Date('2026-07-24T12:00:00.000Z'),
    updatedAt: new Date('2026-07-24T12:05:00.000Z'),
    encryptedPayload: `secret-${CBU}`,
    fingerprint: 'f'.repeat(64),
    wrappingKeyId: KEY_ID,
  };
  const lastFour = CBU.slice(-4);
  assert.equal(maskWorkerFinancialValue('CBU', lastFour), `CBU •••• ${lastFour}`);
  assert.throws(() => maskWorkerFinancialValue('CBU', '52-1'));
  const serialized = serializeWorkerPaymentDestination(row);
  assert.deepEqual(serialized, {
    id: 'destination-a',
    type: 'CBU',
    maskedValue: `CBU •••• ${lastFour}`,
    status: 'PENDING_VERIFICATION',
    version: 1,
    revision: 0,
    availableFrom: null,
    verifiedAt: null,
    createdAt: '2026-07-24T12:00:00.000Z',
    updatedAt: '2026-07-24T12:05:00.000Z',
  });
  assert.equal(serializeWorkerPaymentDestinationForPayroll(row).holderName, 'Carlos Perez');
  const encoded = JSON.stringify(serialized);
  for (const forbidden of [
    CBU,
    row.holderName,
    row.holderCuil,
    'encryptedPayload',
    'fingerprint',
    'wrappingKeyId',
  ]) {
    assert.equal(encoded.includes(forbidden), false);
  }
});
