import crypto from 'node:crypto';

const ENVELOPE_VERSION = 'v2';
const FINGERPRINT_VERSION = 'v1';
const AAD_DOMAIN = 'obrasaas:worker-financial-data';
const FINGERPRINT_DOMAIN = 'obrasaas:worker-financial-fingerprint';
const KEK_ID_ENV = 'WORKER_FINANCIAL_KEK_ID';
const KEK_REGISTRY_ENV = 'WORKER_FINANCIAL_KEK_REGISTRY_JSON';
const FINGERPRINT_KEY_ID_ENV = 'WORKER_FINANCIAL_FINGERPRINT_KEY_ID';
const FINGERPRINT_KEY_REGISTRY_ENV = 'WORKER_FINANCIAL_FINGERPRINT_KEY_REGISTRY_JSON';
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const BINDING_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/;
const PRIVACY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ALIAS_PATTERN = /^[a-z0-9.-]{6,20}$/;
const MAX_KEK_REGISTRY_BYTES = 32 * 1024;
const MAX_FINANCIAL_PAYLOAD_BYTES = 8 * 1024;
const CUIT_WEIGHTS = Object.freeze([5, 4, 3, 2, 7, 6, 5, 4, 3, 2]);
const HUMAN_CUIL_PREFIXES = new Set(['20', '23', '24', '27']);
const CBU_BLOCK_ONE_WEIGHTS = Object.freeze([7, 1, 3, 9, 7, 1, 3]);
const CBU_BLOCK_TWO_WEIGHTS = Object.freeze([3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]);

export const WORKER_FINANCIAL_PURPOSES = Object.freeze({
  IDENTITY_CUIL: 'IDENTITY_CUIL',
  ONBOARDING_CLAIM: 'ONBOARDING_CLAIM',
  PAYMENT_DESTINATION: 'PAYMENT_DESTINATION',
});

export const WORKER_PAYMENT_DESTINATION_TYPES = Object.freeze(['CBU', 'CVU', 'ALIAS']);

const FINANCIAL_PURPOSES = new Set(Object.values(WORKER_FINANCIAL_PURPOSES));
const PAYMENT_DESTINATION_TYPES = new Set(WORKER_PAYMENT_DESTINATION_TYPES);
const IDENTITY_FIELDS = new Set([
  'givenNames',
  'familyName',
  'cuil',
  'privacyNoticeVersion',
  'privacyAccepted',
]);
const PAYMENT_FIELDS = new Set(['type', 'value', 'holderName', 'holderCuil']);

const ERROR_STATUS = Object.freeze({
  WORKER_FINANCIAL_INPUT_INVALID: 400,
  WORKER_FINANCIAL_UNKNOWN_FIELDS: 400,
  WORKER_FINANCIAL_PRIVACY_REQUIRED: 400,
  WORKER_FINANCIAL_CUIL_INVALID: 400,
  WORKER_FINANCIAL_DESTINATION_INVALID: 400,
  WORKER_FINANCIAL_CONFIGURATION_INVALID: 500,
  WORKER_FINANCIAL_ENCRYPTION_FAILED: 500,
  WORKER_FINANCIAL_DECRYPTION_FAILED: 500,
});

export class WorkerFinancialDataError extends Error {
  constructor(message, code, { cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WorkerFinancialDataError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function financialError(message, code, options) {
  return new WorkerFinancialDataError(message, code, options);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function inputRecord(input) {
  if (!isPlainObject(input)) {
    throw financialError(
      'El cuerpo debe ser un objeto JSON valido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return input;
}

function rejectUnknownFields(input, allowedFields) {
  const unknown = Object.keys(input).filter((key) => !allowedFields.has(key));
  if (unknown.length > 0) {
    throw financialError(
      'El cuerpo contiene campos no permitidos.',
      'WORKER_FINANCIAL_UNKNOWN_FIELDS',
    );
  }
}

function boundedText(value, { field, min = 1, max }) {
  if (typeof value !== 'string') {
    throw financialError(`${field} es invalido.`, 'WORKER_FINANCIAL_INPUT_INVALID');
  }
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ');
  if (
    normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw financialError(`${field} es invalido.`, 'WORKER_FINANCIAL_INPUT_INVALID');
  }
  return normalized;
}

function normalizedDigits(value, { field, length, code }) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw financialError(`${field} es invalido.`, code);
  }
  const raw = String(value).trim();
  if (!raw || !/^[0-9.\s-]+$/.test(raw)) {
    throw financialError(`${field} es invalido.`, code);
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== length) {
    throw financialError(`${field} es invalido.`, code);
  }
  return digits;
}

function moduloCheckDigit(digits, weights) {
  const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
  return (10 - (sum % 10)) % 10;
}

function cuitCheckDigit(firstTenDigits) {
  const sum = CUIT_WEIGHTS.reduce(
    (total, weight, index) => total + Number(firstTenDigits[index]) * weight,
    0,
  );
  const candidate = 11 - (sum % 11);
  if (candidate === 11) return 0;
  if (candidate === 10) return 9;
  return candidate;
}

export function normalizeWorkerCuil(value) {
  const digits = normalizedDigits(value, {
    field: 'El CUIL',
    length: 11,
    code: 'WORKER_FINANCIAL_CUIL_INVALID',
  });
  if (
    !HUMAN_CUIL_PREFIXES.has(digits.slice(0, 2))
    || Number(digits[10]) !== cuitCheckDigit(digits.slice(0, 10))
  ) {
    throw financialError('El CUIL es invalido.', 'WORKER_FINANCIAL_CUIL_INVALID');
  }
  return digits;
}

export function isValidWorkerCuil(value) {
  try {
    normalizeWorkerCuil(value);
    return true;
  } catch {
    return false;
  }
}

export function normalizeWorkerBankKey(value, type) {
  const destinationType = String(type || '').trim().toUpperCase();
  if (!['CBU', 'CVU'].includes(destinationType)) {
    throw financialError(
      'El tipo de destino de cobro es invalido.',
      'WORKER_FINANCIAL_DESTINATION_INVALID',
    );
  }
  const digits = normalizedDigits(value, {
    field: `La ${destinationType}`,
    length: 22,
    code: 'WORKER_FINANCIAL_DESTINATION_INVALID',
  });
  const firstBlockValid = Number(digits[7]) === moduloCheckDigit(
    digits.slice(0, 7),
    CBU_BLOCK_ONE_WEIGHTS,
  );
  const secondBlockValid = Number(digits[21]) === moduloCheckDigit(
    digits.slice(8, 21),
    CBU_BLOCK_TWO_WEIGHTS,
  );
  const typeShapeValid = destinationType === 'CVU'
    ? digits.startsWith('000') && digits[8] === '0'
    : !digits.startsWith('000');
  if (!firstBlockValid || !secondBlockValid || !typeShapeValid) {
    throw financialError(
      `La ${destinationType} es invalida.`,
      'WORKER_FINANCIAL_DESTINATION_INVALID',
    );
  }
  return digits;
}

export function normalizeWorkerPaymentAlias(value) {
  if (typeof value !== 'string') {
    throw financialError(
      'El alias de cobro es invalido.',
      'WORKER_FINANCIAL_DESTINATION_INVALID',
    );
  }
  const alias = value.trim().toLowerCase();
  if (!ALIAS_PATTERN.test(alias)) {
    throw financialError(
      'El alias de cobro es invalido.',
      'WORKER_FINANCIAL_DESTINATION_INVALID',
    );
  }
  return alias;
}

export function normalizeWorkerIdentityInput(input, { now = new Date() } = {}) {
  const body = inputRecord(input);
  rejectUnknownFields(body, IDENTITY_FIELDS);
  if (body.privacyAccepted !== true) {
    throw financialError(
      'La aceptacion del aviso de privacidad es obligatoria.',
      'WORKER_FINANCIAL_PRIVACY_REQUIRED',
    );
  }
  const acceptedAt = now instanceof Date ? new Date(now) : new Date(now);
  if (Number.isNaN(acceptedAt.getTime())) {
    throw financialError('La fecha de aceptacion es invalida.', 'WORKER_FINANCIAL_INPUT_INVALID');
  }
  const givenNames = boundedText(body.givenNames, {
    field: 'Los nombres',
    min: 2,
    max: 100,
  });
  const familyName = boundedText(body.familyName, {
    field: 'El apellido',
    min: 2,
    max: 100,
  });
  const privacyNoticeVersion = boundedText(body.privacyNoticeVersion, {
    field: 'La version del aviso de privacidad',
    max: 64,
  });
  if (!PRIVACY_VERSION_PATTERN.test(privacyNoticeVersion)) {
    throw financialError(
      'La version del aviso de privacidad es invalida.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return {
    givenNames,
    familyName,
    legalName: `${givenNames} ${familyName}`,
    cuil: normalizeWorkerCuil(body.cuil),
    identityStatus: 'PENDING_REVIEW',
    privacyNoticeVersion,
    privacyAcceptedAt: acceptedAt,
  };
}

export function normalizeWorkerPaymentDestinationInput(input) {
  const body = inputRecord(input);
  rejectUnknownFields(body, PAYMENT_FIELDS);
  const type = String(body.type || '').trim().toUpperCase();
  if (!PAYMENT_DESTINATION_TYPES.has(type)) {
    throw financialError(
      'El tipo de destino de cobro es invalido.',
      'WORKER_FINANCIAL_DESTINATION_INVALID',
    );
  }
  const value = type === 'ALIAS'
    ? normalizeWorkerPaymentAlias(body.value)
    : normalizeWorkerBankKey(body.value, type);
  return {
    type,
    value,
    holderName: boundedText(body.holderName, {
      field: 'El titular de la cuenta',
      min: 2,
      max: 190,
    }),
    holderCuil: normalizeWorkerCuil(body.holderCuil),
    currency: 'ARS',
    verificationStatus: 'PENDING_VERIFICATION',
  };
}

function decodeKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length === 32 && decoded.toString('base64') === value ? decoded : null;
}

export function readWorkerFinancialKekRegistry(env = process.env) {
  const currentKeyId = String(env?.[KEK_ID_ENV] || '').trim();
  const rawRegistry = String(env?.[KEK_REGISTRY_ENV] || '');
  if (
    !KEY_ID_PATTERN.test(currentKeyId)
    || !rawRegistry
    || Buffer.byteLength(rawRegistry, 'utf8') > MAX_KEK_REGISTRY_BYTES
  ) {
    throw financialError(
      'El cifrado de datos financieros no esta configurado.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(rawRegistry);
  } catch (cause) {
    throw financialError(
      'El registro de claves financieras es invalido.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
      { cause },
    );
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0 || Object.keys(parsed).length > 32) {
    throw financialError(
      'El registro de claves financieras es invalido.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  const keys = new Map();
  for (const [keyId, encodedKey] of Object.entries(parsed)) {
    const key = KEY_ID_PATTERN.test(keyId) ? decodeKey(encodedKey) : null;
    if (!key) {
      throw financialError(
        'El registro de claves financieras es invalido.',
        'WORKER_FINANCIAL_CONFIGURATION_INVALID',
      );
    }
    keys.set(keyId, key);
  }
  if (!keys.has(currentKeyId)) {
    throw financialError(
      'La clave financiera activa no esta disponible.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  return { currentKeyId, keys };
}

export function readWorkerFinancialFingerprintKey(env = process.env) {
  const { fingerprintRegistry: registry } = readWorkerFinancialKeyConfiguration(env);
  return registry.keys.get(registry.currentKeyId);
}

export function readWorkerFinancialFingerprintKeyRegistry(env = process.env) {
  const currentKeyId = String(env?.[FINGERPRINT_KEY_ID_ENV] || '').trim();
  const rawRegistry = String(env?.[FINGERPRINT_KEY_REGISTRY_ENV] || '');
  if (
    !KEY_ID_PATTERN.test(currentKeyId)
    || !rawRegistry
    || Buffer.byteLength(rawRegistry, 'utf8') > MAX_KEK_REGISTRY_BYTES
  ) {
    throw financialError(
      'La clave de huellas financieras no esta configurada.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(rawRegistry);
  } catch (cause) {
    throw financialError(
      'El registro de claves de huellas financieras es invalido.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
      { cause },
    );
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0 || Object.keys(parsed).length > 32) {
    throw financialError(
      'El registro de claves de huellas financieras es invalido.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  const keys = new Map();
  for (const [keyId, encodedKey] of Object.entries(parsed)) {
    const key = KEY_ID_PATTERN.test(keyId) ? decodeKey(encodedKey) : null;
    if (!key) {
      throw financialError(
        'El registro de claves de huellas financieras es invalido.',
        'WORKER_FINANCIAL_CONFIGURATION_INVALID',
      );
    }
    keys.set(keyId, key);
  }
  if (!keys.has(currentKeyId)) {
    throw financialError(
      'La clave activa de huellas financieras no esta disponible.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  return { currentKeyId, keys };
}

export function readWorkerFinancialKeyConfiguration(env = process.env) {
  const kekRegistry = readWorkerFinancialKekRegistry(env);
  const fingerprintRegistry = readWorkerFinancialFingerprintKeyRegistry(env);
  for (const fingerprintKey of fingerprintRegistry.keys.values()) {
    for (const kek of kekRegistry.keys.values()) {
      if (crypto.timingSafeEqual(fingerprintKey, kek)) {
        throw financialError(
          'Las claves de cifrado y huellas financieras deben ser independientes.',
          'WORKER_FINANCIAL_CONFIGURATION_INVALID',
        );
      }
    }
  }
  return { kekRegistry, fingerprintRegistry };
}

function bindingId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!BINDING_ID_PATTERN.test(normalized)) {
    throw financialError(
      'El alcance de cifrado es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return normalized;
}

function normalizeBinding(binding, wrappingKeyId) {
  const purpose = String(binding?.purpose || '').trim().toUpperCase();
  const destinationType = String(binding?.destinationType || '').trim().toUpperCase();
  const recordVersion = Number(binding?.recordVersion);
  if (
    !FINANCIAL_PURPOSES.has(purpose)
    || !Number.isSafeInteger(recordVersion)
    || recordVersion < 1
    || !KEY_ID_PATTERN.test(wrappingKeyId)
    || (purpose === WORKER_FINANCIAL_PURPOSES.PAYMENT_DESTINATION
      ? !PAYMENT_DESTINATION_TYPES.has(destinationType)
      : destinationType !== 'CUIL')
  ) {
    throw financialError(
      'El alcance de cifrado es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return {
    domain: AAD_DOMAIN,
    envelopeVersion: ENVELOPE_VERSION,
    organizationId: bindingId(binding?.organizationId),
    subjectId: bindingId(binding?.subjectId),
    recordId: bindingId(binding?.recordId),
    recordVersion,
    purpose,
    destinationType,
    wrappingKeyId,
  };
}

function canonicalPayload(payload) {
  if (!isPlainObject(payload)) {
    throw financialError(
      'El contenido financiero es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch (cause) {
    throw financialError(
      'El contenido financiero es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
      { cause },
    );
  }
  if (
    !serialized
    || Buffer.byteLength(serialized, 'utf8') > MAX_FINANCIAL_PAYLOAD_BYTES
    || /[\u0000]/.test(serialized)
  ) {
    throw financialError(
      'El contenido financiero es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return serialized;
}

function decodeBase64UrlCanonical(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const decoded = Buffer.from(value, 'base64url');
  return decoded.toString('base64url') === value ? decoded : null;
}

function randomBuffer(randomBytes, length) {
  const value = Buffer.from(randomBytes(length));
  if (value.length !== length) {
    throw financialError(
      'La configuracion de cifrado financiero es invalida.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  return value;
}

function componentAad(normalizedBinding, component) {
  if (component === 'payload') {
    const stableBinding = { ...normalizedBinding };
    delete stableBinding.wrappingKeyId;
    return Buffer.from(JSON.stringify({ ...stableBinding, component }), 'utf8');
  }
  return Buffer.from(JSON.stringify({ ...normalizedBinding, component }), 'utf8');
}

function parseEncryptedEnvelope(value) {
  const segments = String(value || '').split('.');
  const dataIv = decodeBase64UrlCanonical(segments[1]);
  const dataAuthTag = decodeBase64UrlCanonical(segments[2]);
  const ciphertext = decodeBase64UrlCanonical(segments[3]);
  const wrappingIv = decodeBase64UrlCanonical(segments[4]);
  const wrappingAuthTag = decodeBase64UrlCanonical(segments[5]);
  const wrappedDek = decodeBase64UrlCanonical(segments[6]);
  if (
    segments.length !== 7
    || segments[0] !== ENVELOPE_VERSION
    || dataIv?.length !== 12
    || dataAuthTag?.length !== 16
    || !ciphertext?.length
    || ciphertext.length > MAX_FINANCIAL_PAYLOAD_BYTES + 64
    || wrappingIv?.length !== 12
    || wrappingAuthTag?.length !== 16
    || wrappedDek?.length !== 32
  ) {
    throw financialError(
      'Los datos financieros cifrados son invalidos.',
      'WORKER_FINANCIAL_DECRYPTION_FAILED',
    );
  }
  return {
    segments,
    dataIv,
    dataAuthTag,
    ciphertext,
    wrappingIv,
    wrappingAuthTag,
    wrappedDek,
  };
}

export function encryptWorkerFinancialPayload(payload, binding, {
  registry = readWorkerFinancialKekRegistry(),
  randomBytes = crypto.randomBytes,
} = {}) {
  const wrappingKeyId = String(registry.currentKeyId || '');
  const kek = registry.keys.get(wrappingKeyId);
  if (!kek || kek.length !== 32) {
    throw financialError(
      'La clave financiera solicitada no esta disponible.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  const plaintext = canonicalPayload(payload);
  const normalizedBinding = normalizeBinding(binding, wrappingKeyId);
  const dataAad = componentAad(normalizedBinding, 'payload');
  const wrappingAad = componentAad(normalizedBinding, 'wrapped-dek');
  let dek;
  try {
    dek = randomBuffer(randomBytes, 32);
    const dataIv = randomBuffer(randomBytes, 12);
    const wrappingIv = randomBuffer(randomBytes, 12);
    const dataCipher = crypto.createCipheriv('aes-256-gcm', dek, dataIv);
    dataCipher.setAAD(dataAad, { plaintextLength: Buffer.byteLength(plaintext, 'utf8') });
    const ciphertext = Buffer.concat([
      dataCipher.update(plaintext, 'utf8'),
      dataCipher.final(),
    ]);
    const wrappingCipher = crypto.createCipheriv('aes-256-gcm', kek, wrappingIv);
    wrappingCipher.setAAD(wrappingAad, { plaintextLength: dek.length });
    const wrappedDek = Buffer.concat([wrappingCipher.update(dek), wrappingCipher.final()]);
    return {
      encryptedPayload: [
        ENVELOPE_VERSION,
        dataIv.toString('base64url'),
        dataCipher.getAuthTag().toString('base64url'),
        ciphertext.toString('base64url'),
        wrappingIv.toString('base64url'),
        wrappingCipher.getAuthTag().toString('base64url'),
        wrappedDek.toString('base64url'),
      ].join('.'),
      wrappingKeyId,
    };
  } catch (cause) {
    if (cause instanceof WorkerFinancialDataError) throw cause;
    throw financialError(
      'Los datos financieros no pudieron cifrarse.',
      'WORKER_FINANCIAL_ENCRYPTION_FAILED',
      { cause },
    );
  } finally {
    dek?.fill(0);
  }
}

export function decryptWorkerFinancialPayload(record, binding, {
  registry = readWorkerFinancialKekRegistry(),
} = {}) {
  const wrappingKeyId = String(record?.wrappingKeyId || '');
  const kek = registry.keys.get(wrappingKeyId);
  if (!kek || kek.length !== 32) {
    throw financialError(
      'La clave financiera solicitada no esta disponible.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  const {
    dataIv,
    dataAuthTag,
    ciphertext,
    wrappingIv,
    wrappingAuthTag,
    wrappedDek,
  } = parseEncryptedEnvelope(record?.encryptedPayload);
  let dek;
  try {
    const normalizedBinding = normalizeBinding(binding, wrappingKeyId);
    const wrappingDecipher = crypto.createDecipheriv('aes-256-gcm', kek, wrappingIv);
    wrappingDecipher.setAAD(componentAad(normalizedBinding, 'wrapped-dek'), {
      plaintextLength: wrappedDek.length,
    });
    wrappingDecipher.setAuthTag(wrappingAuthTag);
    dek = Buffer.concat([wrappingDecipher.update(wrappedDek), wrappingDecipher.final()]);
    if (dek.length !== 32) throw new TypeError('Unwrapped DEK has an invalid length.');
    const dataDecipher = crypto.createDecipheriv('aes-256-gcm', dek, dataIv);
    dataDecipher.setAAD(componentAad(normalizedBinding, 'payload'), {
      plaintextLength: ciphertext.length,
    });
    dataDecipher.setAuthTag(dataAuthTag);
    const plaintext = Buffer.concat([
      dataDecipher.update(ciphertext),
      dataDecipher.final(),
    ]).toString('utf8');
    const payload = JSON.parse(plaintext);
    if (!isPlainObject(payload)) throw new TypeError('Decrypted payload is not an object.');
    return payload;
  } catch (cause) {
    if (cause instanceof WorkerFinancialDataError) throw cause;
    throw financialError(
      'Los datos financieros cifrados no pudieron autenticarse.',
      'WORKER_FINANCIAL_DECRYPTION_FAILED',
      { cause },
    );
  } finally {
    dek?.fill(0);
  }
}

export function rewrapWorkerFinancialPayload(record, binding, {
  registry = readWorkerFinancialKekRegistry(),
  targetKeyId = registry.currentKeyId,
  randomBytes = crypto.randomBytes,
} = {}) {
  const previousKeyId = String(record?.wrappingKeyId || '');
  const nextKeyId = String(targetKeyId || '');
  const previousKek = registry.keys.get(previousKeyId);
  const nextKek = registry.keys.get(nextKeyId);
  if (previousKek?.length !== 32 || nextKek?.length !== 32) {
    throw financialError(
      'La clave financiera de destino no esta disponible.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  const envelope = parseEncryptedEnvelope(record?.encryptedPayload);
  let dek;
  try {
    const previousBinding = normalizeBinding(binding, previousKeyId);
    const unwrap = crypto.createDecipheriv('aes-256-gcm', previousKek, envelope.wrappingIv);
    unwrap.setAAD(componentAad(previousBinding, 'wrapped-dek'), {
      plaintextLength: envelope.wrappedDek.length,
    });
    unwrap.setAuthTag(envelope.wrappingAuthTag);
    dek = Buffer.concat([unwrap.update(envelope.wrappedDek), unwrap.final()]);
    if (dek.length !== 32) throw new TypeError('Unwrapped DEK has an invalid length.');

    const nextBinding = normalizeBinding(binding, nextKeyId);
    const wrappingIv = randomBuffer(randomBytes, 12);
    const wrap = crypto.createCipheriv('aes-256-gcm', nextKek, wrappingIv);
    wrap.setAAD(componentAad(nextBinding, 'wrapped-dek'), { plaintextLength: dek.length });
    const wrappedDek = Buffer.concat([wrap.update(dek), wrap.final()]);
    return {
      encryptedPayload: [
        envelope.segments[0],
        envelope.segments[1],
        envelope.segments[2],
        envelope.segments[3],
        wrappingIv.toString('base64url'),
        wrap.getAuthTag().toString('base64url'),
        wrappedDek.toString('base64url'),
      ].join('.'),
      wrappingKeyId: nextKeyId,
    };
  } catch (cause) {
    if (cause instanceof WorkerFinancialDataError) throw cause;
    throw financialError(
      'La clave de datos financieros no pudo reenvolverse.',
      'WORKER_FINANCIAL_DECRYPTION_FAILED',
      { cause },
    );
  } finally {
    dek?.fill(0);
  }
}

export function workerFinancialFingerprint(value, {
  organizationId,
  valueType,
}, {
  registry = readWorkerFinancialKeyConfiguration().fingerprintRegistry,
  keyId = registry.currentKeyId,
} = {}) {
  const fingerprintKeyId = String(keyId || '');
  const key = registry?.keys?.get(fingerprintKeyId);
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw financialError(
      'La clave de huellas financieras es invalida.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  const normalizedValueType = String(valueType || '').trim().toUpperCase();
  let normalizedValue;
  if (normalizedValueType === 'CUIL') normalizedValue = normalizeWorkerCuil(value);
  else if (normalizedValueType === 'CBU' || normalizedValueType === 'CVU') {
    normalizedValue = normalizeWorkerBankKey(value, normalizedValueType);
  } else if (normalizedValueType === 'ALIAS') {
    normalizedValue = normalizeWorkerPaymentAlias(value);
  }
  if (
    !normalizedValue
    || !KEY_ID_PATTERN.test(fingerprintKeyId)
    || normalizedValue.length > 190
  ) {
    throw financialError(
      'El valor de la huella financiera es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  const fingerprint = crypto.createHmac('sha256', key).update(JSON.stringify({
    domain: FINGERPRINT_DOMAIN,
    version: FINGERPRINT_VERSION,
    fingerprintKeyId,
    organizationId: bindingId(organizationId),
    valueType: normalizedValueType,
    value: normalizedValue,
  })).digest('hex');
  return { fingerprint, fingerprintKeyId };
}

export function workerFinancialFingerprintCandidates(value, scope, {
  registry = readWorkerFinancialKeyConfiguration().fingerprintRegistry,
  keyIds = [...registry.keys.keys()],
} = {}) {
  if (
    !Array.isArray(keyIds)
    || keyIds.length === 0
    || keyIds.length > 32
    || new Set(keyIds).size !== keyIds.length
  ) {
    throw financialError(
      'La seleccion de claves de huellas financieras es invalida.',
      'WORKER_FINANCIAL_CONFIGURATION_INVALID',
    );
  }
  return keyIds.map((keyId) => workerFinancialFingerprint(value, scope, { registry, keyId }));
}

export function workerFinancialLastFour(value, type) {
  const valueType = String(type || '').trim().toUpperCase();
  let normalized;
  if (valueType === 'CUIL') normalized = normalizeWorkerCuil(value);
  else if (valueType === 'CBU' || valueType === 'CVU') {
    normalized = normalizeWorkerBankKey(value, valueType);
  } else if (valueType === 'ALIAS') {
    normalized = normalizeWorkerPaymentAlias(value);
  } else {
    throw financialError(
      'El valor financiero es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return normalized ? normalized.slice(-4).toLowerCase() : null;
}

export function maskWorkerFinancialValue(type, lastFour) {
  const destinationType = String(type || '').trim().toUpperCase();
  const suffix = String(lastFour || '').trim().toLowerCase();
  const suffixValid = destinationType === 'ALIAS'
    ? /^[a-z0-9.-]{1,4}$/.test(suffix)
    : /^\d{4}$/.test(suffix);
  if (!PAYMENT_DESTINATION_TYPES.has(destinationType) || !suffixValid) {
    throw financialError(
      'La referencia enmascarada es invalida.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  const label = destinationType === 'ALIAS' ? 'Alias' : destinationType;
  return `${label} •••• ${suffix}`;
}

function optionalIso(value) {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function serializeWorkerPaymentDestination(record) {
  const type = String(record?.type || '').trim().toUpperCase();
  const version = Number(record?.version);
  const revision = Number(record?.revision);
  if (
    !PAYMENT_DESTINATION_TYPES.has(type)
    || !Number.isSafeInteger(version)
    || version < 1
    || !Number.isSafeInteger(revision)
    || revision < 0
  ) {
    throw financialError(
      'El destino de cobro persistido es invalido.',
      'WORKER_FINANCIAL_INPUT_INVALID',
    );
  }
  return {
    id: bindingId(record?.id),
    type,
    maskedValue: maskWorkerFinancialValue(type, record?.lastFour),
    status: boundedText(record?.status, {
      field: 'El estado del destino',
      max: 40,
    }),
    version,
    revision,
    availableFrom: optionalIso(record?.availableFrom),
    verifiedAt: optionalIso(record?.verifiedAt),
    createdAt: optionalIso(record?.createdAt),
    updatedAt: optionalIso(record?.updatedAt),
  };
}

export function serializeWorkerPaymentDestinationForPayroll(record) {
  return {
    ...serializeWorkerPaymentDestination(record),
    holderName: boundedText(record?.holderName, {
      field: 'El titular de la cuenta',
      min: 2,
      max: 190,
    }),
  };
}
