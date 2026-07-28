import {
  decryptWorkerFinancialPayload,
  maskWorkerFinancialValue,
  normalizeWorkerWhatsAppAddress,
  normalizeWorkerWhatsAppProviderSubject,
  readWorkerFinancialKeyConfiguration,
  workerChannelAddressBinding,
  workerChannelProviderSubjectBinding,
  workerFinancialFingerprintCandidates,
} from './worker-financial-data.js';

const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;

export const FIELD_WORKER_WHATSAPP_ROLES = Object.freeze([
  'WORKER',
  'FOREMAN',
  'SITE_MANAGER',
  'SAFETY',
]);

export const FIELD_WORKER_INTENTS = Object.freeze({
  HELP: 'HELP',
  EVIDENCE: 'EVIDENCE',
  INCIDENT: 'INCIDENT',
  DELAY_REPORT: 'DELAY_REPORT',
  ATTENDANCE_START: 'ATTENDANCE_START',
  ATTENDANCE_LOCATION: 'ATTENDANCE_LOCATION',
  MEDICAL: 'MEDICAL',
  TASK_PROGRESS: 'TASK_PROGRESS',
  COMMAND_CONFIRMATION: 'COMMAND_CONFIRMATION',
});

const BASE_INTENTS = [
  FIELD_WORKER_INTENTS.HELP,
  FIELD_WORKER_INTENTS.EVIDENCE,
  FIELD_WORKER_INTENTS.INCIDENT,
  FIELD_WORKER_INTENTS.ATTENDANCE_START,
  FIELD_WORKER_INTENTS.ATTENDANCE_LOCATION,
  FIELD_WORKER_INTENTS.MEDICAL,
  FIELD_WORKER_INTENTS.COMMAND_CONFIRMATION,
];

export const FIELD_WORKER_INTENT_MATRIX = Object.freeze({
  WORKER: Object.freeze([
    ...BASE_INTENTS,
    FIELD_WORKER_INTENTS.TASK_PROGRESS,
  ]),
  FOREMAN: Object.freeze([
    ...BASE_INTENTS,
    FIELD_WORKER_INTENTS.TASK_PROGRESS,
    FIELD_WORKER_INTENTS.DELAY_REPORT,
  ]),
  SITE_MANAGER: Object.freeze([
    ...BASE_INTENTS,
    FIELD_WORKER_INTENTS.TASK_PROGRESS,
    FIELD_WORKER_INTENTS.DELAY_REPORT,
  ]),
  SAFETY: Object.freeze([...BASE_INTENTS]),
});

export const FIELD_WORKER_RESOLUTION = Object.freeze({
  RESOLVED: 'RESOLVED',
  UNKNOWN: 'UNKNOWN',
  AMBIGUOUS: 'AMBIGUOUS',
  CANONICAL_BLOCKED: 'CANONICAL_BLOCKED',
  INVALID_PHONE: 'INVALID_PHONE',
});

const CREATE_FIELDS = new Set(['name', 'phone', 'role', 'whatsappRole']);
const PATCH_FIELDS = new Set(['workerId', 'name', 'phone', 'role', 'whatsappRole', 'active']);

export class FieldWorkerInputError extends Error {
  constructor(message, code = 'INVALID_FIELD_WORKER') {
    super(message);
    this.name = 'FieldWorkerInputError';
    this.code = code;
  }
}

function inputRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new FieldWorkerInputError('El cuerpo debe ser un objeto JSON válido.', 'INVALID_JSON_BODY');
  }
  return input;
}

function rejectUnknownFields(input, allowedFields) {
  const unknown = Object.keys(input).filter((key) => !allowedFields.has(key));
  if (unknown.length > 0) {
    throw new FieldWorkerInputError('El cuerpo contiene campos no permitidos.', 'UNKNOWN_FIELDS');
  }
}

function cleanRequiredText(value, { label, min, max, code }) {
  if (typeof value !== 'string') {
    throw new FieldWorkerInputError(`${label} es obligatorio.`, code);
  }
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < min || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new FieldWorkerInputError(`${label} debe tener entre ${min} y ${max} caracteres.`, code);
  }
  return text;
}

function cleanOptionalRole(value) {
  if (value === null || value === undefined || value === '') return null;
  return cleanRequiredText(value, {
    label: 'La función en obra',
    min: 2,
    max: 120,
    code: 'INVALID_ROLE',
  });
}

export function normalizeWorkerPhone(value) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new FieldWorkerInputError('Ingresá un teléfono internacional válido.', 'INVALID_PHONE');
  }
  const raw = String(value).trim();
  if (!raw || !/^\+?[0-9\s().-]+$/.test(raw)) {
    throw new FieldWorkerInputError('Ingresá un teléfono internacional válido.', 'INVALID_PHONE');
  }

  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    throw new FieldWorkerInputError(
      `El teléfono debe tener entre ${PHONE_MIN_DIGITS} y ${PHONE_MAX_DIGITS} dígitos.`,
      'INVALID_PHONE',
    );
  }
  return `+${digits}`;
}

function tryNormalizeWorkerPhone(value) {
  try {
    return normalizeWorkerPhone(value);
  } catch {
    return null;
  }
}

export function isFieldWorkerWhatsAppRole(value) {
  return FIELD_WORKER_WHATSAPP_ROLES.includes(value);
}

function normalizeWhatsAppRole(value, { fallback = null } = {}) {
  if ((value === undefined || value === null || value === '') && fallback) return fallback;
  const role = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!isFieldWorkerWhatsAppRole(role)) {
    throw new FieldWorkerInputError('Seleccioná un rol de WhatsApp válido.', 'INVALID_WHATSAPP_ROLE');
  }
  return role;
}

export function fieldWorkerWhatsAppRole(worker) {
  const metadata = worker?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'WORKER';
  return isFieldWorkerWhatsAppRole(metadata.whatsappRole) ? metadata.whatsappRole : 'WORKER';
}

export function metadataWithWhatsAppRole(metadata, whatsappRole) {
  const current = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? metadata
    : {};
  return { ...current, whatsappRole: normalizeWhatsAppRole(whatsappRole) };
}

export function canFieldWorkerHandleIntent(role, intent) {
  if (!isFieldWorkerWhatsAppRole(role)) return false;
  return FIELD_WORKER_INTENT_MATRIX[role].includes(intent);
}

export class FieldWorkerIdentityError extends Error {
  constructor(message, code = 'FIELD_WORKER_CANONICAL_IDENTITY_INVALID', options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'FieldWorkerIdentityError';
    this.code = code;
  }
}

export function normalizeFieldWorkerCreateInput(input) {
  const body = inputRecord(input);
  rejectUnknownFields(body, CREATE_FIELDS);
  return {
    name: cleanRequiredText(body.name, {
      label: 'El nombre',
      min: 2,
      max: 100,
      code: 'INVALID_NAME',
    }),
    phone: normalizeWorkerPhone(body.phone),
    role: cleanOptionalRole(body.role),
    whatsappRole: normalizeWhatsAppRole(body.whatsappRole, { fallback: 'WORKER' }),
  };
}

export function normalizeFieldWorkerPatchInput(input) {
  const body = inputRecord(input);
  rejectUnknownFields(body, PATCH_FIELDS);
  const workerId = cleanRequiredText(body.workerId, {
    label: 'El operario',
    min: 1,
    max: 128,
    code: 'INVALID_WORKER_ID',
  });
  const data = {};
  if (Object.hasOwn(body, 'name')) {
    data.name = cleanRequiredText(body.name, {
      label: 'El nombre',
      min: 2,
      max: 100,
      code: 'INVALID_NAME',
    });
  }
  if (Object.hasOwn(body, 'phone')) data.phone = normalizeWorkerPhone(body.phone);
  if (Object.hasOwn(body, 'role')) data.role = cleanOptionalRole(body.role);
  if (Object.hasOwn(body, 'whatsappRole')) {
    data.whatsappRole = normalizeWhatsAppRole(body.whatsappRole);
  }
  if (Object.hasOwn(body, 'active')) {
    if (typeof body.active !== 'boolean') {
      throw new FieldWorkerInputError('El estado activo debe ser verdadero o falso.', 'INVALID_ACTIVE');
    }
    data.active = body.active;
  }
  if (Object.keys(data).length === 0) {
    throw new FieldWorkerInputError('Indicá al menos un campo para actualizar.', 'EMPTY_UPDATE');
  }
  return { workerId, data };
}

export function serializeFieldWorker(worker) {
  const channels = [...(worker?.person?.channelIdentities || [])]
    .sort((left, right) => (
      String(left.provider).localeCompare(String(right.provider))
      || String(left.id).localeCompare(String(right.id))
    ))
    .map((channel) => ({
      provider: channel.provider,
      status: channel.status,
      addressMasked: maskWorkerFinancialValue('WHATSAPP_E164', channel.addressLastFour),
      verifiedAt: channel.verifiedAt ? new Date(channel.verifiedAt).toISOString() : null,
    }));
  return {
    id: worker.id,
    name: worker.name,
    phone: worker.phone ? normalizeWorkerPhone(worker.phone) : null,
    channels,
    role: worker.role || null,
    whatsappRole: fieldWorkerWhatsAppRole(worker),
    active: Boolean(worker.active),
    createdAt: new Date(worker.createdAt).toISOString(),
    updatedAt: new Date(worker.updatedAt).toISOString(),
  };
}

function validateScope(scope) {
  const organizationId = typeof scope?.organizationId === 'string' ? scope.organizationId.trim() : '';
  const projectId = typeof scope?.projectId === 'string' ? scope.projectId.trim() : '';
  if (!organizationId || !projectId) {
    throw new Error('A trusted organization and project scope is required.');
  }
  return { organizationId, projectId };
}

function scopedWhere(scope, extra = {}) {
  const { organizationId, projectId } = validateScope(scope);
  return {
    projectId,
    project: { organizationId },
    ...extra,
  };
}

export const FIELD_WORKER_CANONICAL_PERSON_SELECT = Object.freeze({
  status: true,
  identityStatus: true,
  channelIdentities: {
    where: { provider: 'WHATSAPP' },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      verifiedAt: true,
      revokedAt: true,
    },
  },
});

const RESOLUTION_SELECT = {
  id: true,
  organizationId: true,
  personId: true,
  projectId: true,
  externalId: true,
  phone: true,
  name: true,
  role: true,
  active: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { organizationId: true } },
  person: { select: FIELD_WORKER_CANONICAL_PERSON_SELECT },
};

const CHANNEL_RESOLUTION_SELECT = {
  id: true,
  organizationId: true,
  personId: true,
  provider: true,
  status: true,
  encryptedAddressPayload: true,
  addressFingerprint: true,
  addressFingerprintKeyId: true,
  addressLastFour: true,
  wrappingKeyId: true,
  recordVersion: true,
  encryptedProviderSubjectPayload: true,
  providerSubjectFingerprint: true,
  providerSubjectFingerprintKeyId: true,
  verifiedAt: true,
  revokedAt: true,
  person: {
    select: {
      id: true,
      organizationId: true,
      status: true,
      identityStatus: true,
    },
  },
};

function rowBelongsToScope(worker, scope) {
  return worker?.projectId === scope.projectId
    && worker?.project?.organizationId === scope.organizationId;
}

function activeRowBelongsToScope(worker, scope) {
  return worker?.active === true && rowBelongsToScope(worker, scope);
}

function canonicalBridgeBelongsToScope(worker, scope, personId) {
  return activeRowBelongsToScope(worker, scope)
    && worker.organizationId === scope.organizationId
    && worker.personId === personId
    && worker.person?.status === 'ACTIVE';
}

function canonicalIdentityError(message, code, cause = null) {
  return new FieldWorkerIdentityError(message, code, cause ? { cause } : undefined);
}

async function organizationHasCanonicalChannels(prisma, organizationId) {
  const model = prisma?.workerChannelIdentity;
  if (!model) return false;
  const where = { organizationId, provider: 'WHATSAPP' };
  if (typeof model.count === 'function') return (await model.count({ where })) > 0;
  if (typeof model.findFirst === 'function') {
    return Boolean(await model.findFirst({ where, select: { id: true } }));
  }
  if (typeof model.findMany === 'function') {
    return (await model.findMany({ where, select: { id: true }, take: 1 })).length > 0;
  }
  return false;
}

function channelFingerprintWhere(candidates) {
  return candidates.map((candidate) => ({
    addressFingerprintKeyId: candidate.fingerprintKeyId,
    addressFingerprint: candidate.fingerprint,
  }));
}

function channelMatchesFingerprint(channel, keyField, fingerprintField, candidates) {
  return candidates.some((candidate) => (
    channel[keyField] === candidate.fingerprintKeyId
    && channel[fingerprintField] === candidate.fingerprint
  ));
}

function decryptCanonicalChannelAddress(channel, keyConfiguration, decryptFinancialPayload) {
  let payload;
  try {
    payload = decryptFinancialPayload(
      {
        encryptedPayload: channel.encryptedAddressPayload,
        wrappingKeyId: channel.wrappingKeyId,
      },
      workerChannelAddressBinding(channel),
      { registry: keyConfiguration.kekRegistry },
    );
  } catch (cause) {
    throw canonicalIdentityError(
      'La identidad canónica de WhatsApp no supera la verificación criptográfica.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
      cause,
    );
  }
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || Object.keys(payload).length !== 1
    || !Object.hasOwn(payload, 'address')
  ) {
    throw canonicalIdentityError(
      'La identidad canónica de WhatsApp contiene un payload inválido.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
    );
  }
  try {
    return normalizeWorkerWhatsAppAddress(payload.address);
  } catch (cause) {
    throw canonicalIdentityError(
      'La identidad canónica de WhatsApp contiene una dirección inválida.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
      cause,
    );
  }
}

function decryptCanonicalProviderSubject(channel, keyConfiguration, decryptFinancialPayload) {
  if (
    !channel.encryptedProviderSubjectPayload
    || !channel.providerSubjectFingerprint
    || !channel.providerSubjectFingerprintKeyId
  ) {
    throw canonicalIdentityError(
      'La identidad canónica de WhatsApp no tiene un sujeto de proveedor verificable.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
    );
  }
  let payload;
  try {
    payload = decryptFinancialPayload(
      {
        encryptedPayload: channel.encryptedProviderSubjectPayload,
        wrappingKeyId: channel.wrappingKeyId,
      },
      workerChannelProviderSubjectBinding(channel),
      { registry: keyConfiguration.kekRegistry },
    );
  } catch (cause) {
    throw canonicalIdentityError(
      'El sujeto canónico de WhatsApp no supera la verificación criptográfica.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
      cause,
    );
  }
  if (
    !payload
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || Object.keys(payload).length !== 1
    || !Object.hasOwn(payload, 'providerSubject')
  ) {
    throw canonicalIdentityError(
      'El sujeto canónico de WhatsApp contiene un payload inválido.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
    );
  }
  try {
    return normalizeWorkerWhatsAppProviderSubject(payload.providerSubject);
  } catch (cause) {
    throw canonicalIdentityError(
      'El sujeto canónico de WhatsApp contiene una dirección inválida.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
      cause,
    );
  }
}

async function loadExactCanonicalChannels(prisma, scope, normalizedPhone, {
  keyConfiguration: suppliedKeyConfiguration = null,
  decryptFinancialPayload = decryptWorkerFinancialPayload,
} = {}) {
  const model = prisma?.workerChannelIdentity;
  if (!model || typeof model.findMany !== 'function') {
    return { channels: [], conflict: false, modelUnavailable: true };
  }

  let keyConfiguration = suppliedKeyConfiguration;
  if (!keyConfiguration) {
    try {
      keyConfiguration = readWorkerFinancialKeyConfiguration();
    } catch (cause) {
      if (!(await organizationHasCanonicalChannels(prisma, scope.organizationId))) {
        return { channels: [], conflict: false };
      }
      throw canonicalIdentityError(
        'Las claves de identidad canónica de WhatsApp no están disponibles.',
        'FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID',
        cause,
      );
    }
  }

  let addressFingerprints;
  let providerFingerprints;
  const providerSubject = normalizeWorkerWhatsAppProviderSubject(normalizedPhone);
  try {
    addressFingerprints = workerFinancialFingerprintCandidates(
      normalizedPhone,
      { organizationId: scope.organizationId, valueType: 'WHATSAPP_E164' },
      { registry: keyConfiguration.fingerprintRegistry },
    );
    providerFingerprints = workerFinancialFingerprintCandidates(
      providerSubject,
      { organizationId: scope.organizationId, valueType: 'WHATSAPP_PROVIDER_SUBJECT' },
      { registry: keyConfiguration.fingerprintRegistry },
    );
  } catch (cause) {
    throw canonicalIdentityError(
      'No se pudo verificar la huella de la identidad canónica de WhatsApp.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID',
      cause,
    );
  }

  const retainedFingerprintKeyIds = [...new Set([
    ...addressFingerprints,
    ...providerFingerprints,
  ].map((candidate) => candidate.fingerprintKeyId))];
  const uncoveredChannels = await model.findMany({
    where: {
      organizationId: scope.organizationId,
      provider: 'WHATSAPP',
      OR: [
        { addressFingerprintKeyId: { notIn: retainedFingerprintKeyIds } },
        { providerSubjectFingerprintKeyId: { notIn: retainedFingerprintKeyIds } },
      ],
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 1,
  });
  if (uncoveredChannels.length > 0) {
    throw canonicalIdentityError(
      'La identidad canónica de WhatsApp usa una huella fuera del registro de claves retenidas.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID',
    );
  }

  const channels = await model.findMany({
    where: {
      organizationId: scope.organizationId,
      provider: 'WHATSAPP',
      OR: [
        ...channelFingerprintWhere(addressFingerprints),
        ...providerFingerprints.map((candidate) => ({
          providerSubjectFingerprintKeyId: candidate.fingerprintKeyId,
          providerSubjectFingerprint: candidate.fingerprint,
        })),
      ],
    },
    select: CHANNEL_RESOLUTION_SELECT,
    orderBy: { id: 'asc' },
    take: 3,
  });
  const exact = [];
  let conflict = false;
  for (const channel of channels) {
    if (channel.organizationId !== scope.organizationId || channel.provider !== 'WHATSAPP') {
      throw canonicalIdentityError(
        'La identidad canónica de WhatsApp contradice su alcance.',
        'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
      );
    }
    const addressFingerprintMatches = channelMatchesFingerprint(
      channel,
      'addressFingerprintKeyId',
      'addressFingerprint',
      addressFingerprints,
    );
    const providerFingerprintMatches = channelMatchesFingerprint(
      channel,
      'providerSubjectFingerprintKeyId',
      'providerSubjectFingerprint',
      providerFingerprints,
    );
    const storedAddress = decryptCanonicalChannelAddress(
      channel,
      keyConfiguration,
      decryptFinancialPayload,
    );
    const storedProviderSubject = decryptCanonicalProviderSubject(
      channel,
      keyConfiguration,
      decryptFinancialPayload,
    );
    if (
      (addressFingerprintMatches && storedAddress !== normalizedPhone)
      || (providerFingerprintMatches && storedProviderSubject !== providerSubject)
    ) {
      throw canonicalIdentityError(
        'La identidad canónica de WhatsApp contradice una huella autenticada.',
        'FIELD_WORKER_CANONICAL_IDENTITY_CORRUPT',
      );
    }
    if (
      addressFingerprintMatches
      && providerFingerprintMatches
      && storedAddress === normalizedPhone
      && storedProviderSubject === providerSubject
    ) {
      exact.push(channel);
    } else {
      conflict = true;
    }
  }
  return { channels: exact, conflict, modelUnavailable: false };
}

function deployedCanonicalRuntime(environment = process.env) {
  return Boolean(environment?.VERCEL) || environment?.NODE_ENV === 'production';
}

function canonicalModelRequired(dependencies) {
  return dependencies.requireCanonicalModel
    ?? deployedCanonicalRuntime(dependencies.environment);
}

function assertCanonicalModelAvailable(canonicalLookup, dependencies, candidates = []) {
  if (
    canonicalLookup.modelUnavailable
    && (
      canonicalModelRequired(dependencies)
      || candidates.some((worker) => Boolean(worker.personId))
    )
  ) {
    throw canonicalIdentityError(
      'El modelo de identidad canónica de WhatsApp no está disponible en este runtime.',
      'FIELD_WORKER_CANONICAL_IDENTITY_CONFIGURATION_INVALID',
    );
  }
}

async function legacyMatchesHaveCanonicalAuthority(prisma, scope, legacyMatches) {
  const personIds = [...new Set(
    legacyMatches.map((worker) => worker.personId).filter(Boolean),
  )];
  if (personIds.length === 0) return false;
  const model = prisma?.workerChannelIdentity;
  if (!model || typeof model.findMany !== 'function') return false;
  const rows = await model.findMany({
    where: {
      organizationId: scope.organizationId,
      provider: 'WHATSAPP',
      personId: { in: personIds },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: 1,
  });
  return rows.length > 0;
}

export async function resolveActiveFieldWorkerByPhone(prisma, scope, phone, dependencies = {}) {
  const trustedScope = validateScope(scope);
  const normalizedPhone = tryNormalizeWorkerPhone(phone);
  if (!normalizedPhone) {
    return { status: FIELD_WORKER_RESOLUTION.INVALID_PHONE, worker: null, normalizedPhone: null };
  }

  const canonicalLookup = await loadExactCanonicalChannels(
    prisma,
    trustedScope,
    normalizedPhone,
    dependencies,
  );
  const candidates = await prisma.worker.findMany({
    where: scopedWhere(trustedScope, { active: true }),
    select: RESOLUTION_SELECT,
  });
  const legacyMatches = candidates.filter((worker) => (
    activeRowBelongsToScope(worker, trustedScope)
    && tryNormalizeWorkerPhone(worker.phone) === normalizedPhone
  ));

  assertCanonicalModelAvailable(canonicalLookup, dependencies, candidates);

  if (canonicalLookup.conflict) {
    return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
  }
  const canonicalChannels = canonicalLookup.channels;
  if (canonicalChannels.length > 1) {
    return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
  }
  const canonicalChannel = canonicalChannels[0] || null;
  if (canonicalChannel) {
    if (canonicalChannel.status === 'CONFLICT') {
      return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
    }
    if (
      canonicalChannel.status !== 'VERIFIED'
      || !canonicalChannel.verifiedAt
      || canonicalChannel.revokedAt
      || canonicalChannel.person?.id !== canonicalChannel.personId
      || canonicalChannel.person?.organizationId !== trustedScope.organizationId
      || canonicalChannel.person?.status !== 'ACTIVE'
      || !['PENDING_REVIEW', 'VERIFIED'].includes(canonicalChannel.person?.identityStatus)
    ) {
      return {
        status: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
        worker: null,
        normalizedPhone,
      };
    }
    const canonicalBridges = candidates.filter((worker) => (
      canonicalBridgeBelongsToScope(worker, trustedScope, canonicalChannel.personId)
    ));
    if (canonicalBridges.length > 1) {
      return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
    }
    const canonicalWorker = canonicalBridges[0] || null;
    if (!canonicalWorker) {
      return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null, normalizedPhone };
    }
    if (legacyMatches.some((worker) => worker.id !== canonicalWorker.id)) {
      return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
    }
    return {
      status: FIELD_WORKER_RESOLUTION.RESOLVED,
      worker: { ...canonicalWorker, phone: normalizedPhone },
      normalizedPhone,
      source: 'CANONICAL',
    };
  }

  if (legacyMatches.length === 0) {
    return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null, normalizedPhone };
  }
  if (legacyMatches.length > 1) {
    return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
  }
  if (await legacyMatchesHaveCanonicalAuthority(prisma, trustedScope, legacyMatches)) {
    return {
      status: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
      worker: null,
      normalizedPhone,
    };
  }
  return {
    status: FIELD_WORKER_RESOLUTION.RESOLVED,
    worker: legacyMatches[0],
    normalizedPhone,
    source: 'LEGACY',
  };
}

export async function resolveActiveFieldWorkerById(prisma, scope, workerId) {
  const trustedScope = validateScope(scope);
  const id = typeof workerId === 'string' ? workerId.trim() : '';
  if (!id) return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null };
  const worker = await prisma.worker.findFirst({
    where: scopedWhere(trustedScope, { id, active: true }),
    select: RESOLUTION_SELECT,
  });
  return evaluateActiveFieldWorkerById(worker, trustedScope);
}

export function evaluateActiveFieldWorkerById(worker, scope) {
  const trustedScope = validateScope(scope);
  if (!activeRowBelongsToScope(worker, trustedScope)) {
    return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null };
  }
  if (worker.personId) {
    const person = worker.person;
    const channels = Array.isArray(person?.channelIdentities)
      ? person.channelIdentities
      : [];
    const verifiedChannels = channels.filter((channel) => (
      channel.status === 'VERIFIED'
      && Boolean(channel.verifiedAt)
      && !channel.revokedAt
    ));
    if (
      worker.organizationId !== trustedScope.organizationId
      || person?.status !== 'ACTIVE'
      || !['PENDING_REVIEW', 'VERIFIED'].includes(person?.identityStatus)
      || verifiedChannels.length === 0
    ) {
      return {
        status: FIELD_WORKER_RESOLUTION.CANONICAL_BLOCKED,
        worker: null,
      };
    }
    if (verifiedChannels.length > 1) {
      return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null };
    }
  }
  return { status: FIELD_WORKER_RESOLUTION.RESOLVED, worker };
}

export async function findFieldWorkerPhoneConflict(
  prisma,
  scope,
  phone,
  excludeWorkerId = null,
  dependencies = {},
) {
  const trustedScope = validateScope(scope);
  const normalizedPhone = normalizeWorkerPhone(phone);
  const canonicalLookup = await loadExactCanonicalChannels(
    prisma,
    trustedScope,
    normalizedPhone,
    dependencies,
  );
  if (canonicalLookup.modelUnavailable && canonicalModelRequired(dependencies)) {
    assertCanonicalModelAvailable(canonicalLookup, dependencies);
  }
  if (canonicalLookup.conflict || canonicalLookup.channels.length > 0) {
    return {
      id: canonicalLookup.channels[0]?.id || 'canonical-channel-conflict',
      canonical: true,
    };
  }
  const candidates = await prisma.worker.findMany({
    where: scopedWhere(trustedScope, excludeWorkerId ? { NOT: { id: excludeWorkerId } } : {}),
    select: RESOLUTION_SELECT,
  });
  assertCanonicalModelAvailable(canonicalLookup, dependencies, candidates);
  return candidates.find((worker) => (
    rowBelongsToScope(worker, trustedScope)
    && tryNormalizeWorkerPhone(worker.phone) === normalizedPhone
  )) || null;
}
