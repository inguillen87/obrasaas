import crypto from 'node:crypto';

import {
  WORKER_FINANCIAL_FIELDS,
  WORKER_FINANCIAL_PURPOSES,
  WorkerFinancialDataError,
  decryptWorkerFinancialPayload,
  normalizeWorkerIdentityInput,
  readWorkerFinancialKeyConfiguration,
} from '../worker-financial-data.js';
import {
  WorkerPaymentDestinationError,
  submitWorkerPaymentDestination,
  validateWorkerPaymentDestinationSubmissionInput,
  workerPaymentDestinationSubmissionOperationKey,
} from '../worker-payment-destinations.js';
import {
  recordWorkerPaymentCapturePrivacyChoice,
  workerPaymentCapturePrivacyChoiceOperationKey,
} from '../worker-privacy-choices.js';

const OPTION_FIELDS = new Set([
  'scope',
  'form',
  'notice',
  'operationKey',
  'flowSubmission',
  'now',
  'correlationId',
]);
const SCOPE_FIELDS = new Set([
  'organizationId',
  'projectId',
  'workerId',
  'personId',
  'channelIdentityId',
]);
const FORM_FIELDS = new Set([
  'purpose',
  'destination_type',
  'destination_value',
  'holder_declaration',
  'capture_notice_acknowledged',
  'receipt_delivery_requested',
]);
const NOTICE_FIELDS = new Set(['version', 'contentSha256', 'presentedAt']);
const FLOW_SUBMISSION_FIELDS = new Set([
  'reservationId',
  'fingerprintKeyId',
  'fingerprintHmac',
  'receiptDeliveryRequested',
]);
const DEPENDENCY_FIELDS = new Set([
  'readKeyConfiguration',
  'decryptIdentity',
  'validatePaymentInput',
  'recordPrivacyChoice',
  'submitPaymentDestination',
]);
const PAYMENT_PURPOSES = new Map([
  ['salary', 'SALARY'],
  ['reimbursement', 'REIMBURSEMENT'],
]);
const DESTINATION_TYPES = new Map([
  ['cbu', 'CBU'],
  ['cvu', 'CVU'],
  ['alias', 'ALIAS'],
]);
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,190}$/;
const OPERATION_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,511}$/;
const NOTICE_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HMAC_KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const TERMINAL_OPERATION_KEY_PATTERN = new RegExp(
  `^wpf-terminal:(${UUID_PATTERN.source.slice(1, -1)}):(${UUID_PATTERN.source.slice(1, -1)})$`,
);

const ERROR_STATUS = Object.freeze({
  WORKER_PAYMENT_FLOW_INPUT_INVALID: 400,
  WORKER_PAYMENT_FLOW_UNKNOWN_FIELDS: 400,
  WORKER_PAYMENT_FLOW_CONSENT_REQUIRED: 422,
  WORKER_PAYMENT_FLOW_SCOPE_FORBIDDEN: 403,
  WORKER_PAYMENT_FLOW_IDENTITY_UNVERIFIED: 422,
  WORKER_PAYMENT_FLOW_CHANNEL_UNVERIFIED: 403,
  WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID: 500,
});

export class WorkerPaymentFlowSubmissionError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_FLOW_INPUT_INVALID') {
    super(message);
    this.name = 'WorkerPaymentFlowSubmissionError';
    this.code = code;
    this.status = ERROR_STATUS[code] || 500;
  }
}

function flowError(message, code) {
  return new WorkerPaymentFlowSubmissionError(message, code);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function objectInput(value, field) {
  if (!isPlainObject(value)) {
    throw flowError(
      `${field} debe ser un objeto valido.`,
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  return value;
}

function rejectUnknownFields(value, allowedFields) {
  if (Object.keys(value).some((field) => !allowedFields.has(field))) {
    // Deliberately do not echo field names. A future client must not be able to
    // reflect civil-identity or financial values into logs or error bodies.
    throw flowError(
      'La solicitud contiene campos no permitidos.',
      'WORKER_PAYMENT_FLOW_UNKNOWN_FIELDS',
    );
  }
}

function identifier(value, field) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_IDENTIFIER_PATTERN.test(normalized)) {
    throw flowError(`${field} es invalido.`, 'WORKER_PAYMENT_FLOW_INPUT_INVALID');
  }
  return normalized;
}

function normalizedScope(value) {
  const scope = objectInput(value, 'scope');
  rejectUnknownFields(scope, SCOPE_FIELDS);
  return {
    organizationId: identifier(scope.organizationId, 'organizationId'),
    projectId: identifier(scope.projectId, 'projectId'),
    workerId: identifier(scope.workerId, 'workerId'),
    personId: identifier(scope.personId, 'personId'),
    channelIdentityId: identifier(scope.channelIdentityId, 'channelIdentityId'),
  };
}

function normalizedForm(rawForm) {
  const form = objectInput(rawForm, 'form');
  rejectUnknownFields(form, FORM_FIELDS);
  if (form.holder_declaration !== true || form.capture_notice_acknowledged !== true) {
    throw flowError(
      'Las declaraciones obligatorias deben aceptarse expresamente.',
      'WORKER_PAYMENT_FLOW_CONSENT_REQUIRED',
    );
  }
  if (
    form.receipt_delivery_requested !== undefined
    && typeof form.receipt_delivery_requested !== 'boolean'
  ) {
    throw flowError(
      'La preferencia de entrega de constancia es invalida.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  const purposeKey = typeof form.purpose === 'string'
    ? form.purpose.trim().toLowerCase()
    : '';
  const destinationTypeKey = typeof form.destination_type === 'string'
    ? form.destination_type.trim().toLowerCase()
    : '';
  const purpose = PAYMENT_PURPOSES.get(purposeKey);
  const type = DESTINATION_TYPES.get(destinationTypeKey);
  const value = typeof form.destination_value === 'string'
    ? form.destination_value.trim()
    : '';
  if (!purpose || !type || !value || value.length > 190 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw flowError(
      'Los datos del destino de cobro son invalidos.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  return {
    purpose,
    type,
    value,
    ...(form.receipt_delivery_requested === true
      ? { receiptDeliveryRequested: true }
      : {}),
  };
}

function normalizedDate(value, field) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw flowError(`${field} es invalido.`, 'WORKER_PAYMENT_FLOW_INPUT_INVALID');
  }
  return date;
}

function normalizedNotice(value) {
  const notice = objectInput(value, 'notice');
  rejectUnknownFields(notice, NOTICE_FIELDS);
  const version = typeof notice.version === 'string' ? notice.version.trim() : '';
  const contentSha256 = typeof notice.contentSha256 === 'string'
    ? notice.contentSha256.trim().toLowerCase()
    : '';
  if (!NOTICE_VERSION_PATTERN.test(version) || !SHA256_PATTERN.test(contentSha256)) {
    throw flowError(
      'El aviso de captura fijado por el servidor es invalido.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  return {
    version,
    contentSha256,
    presentedAt: normalizedDate(notice.presentedAt, 'notice.presentedAt'),
  };
}

function normalizedOperationKey(value) {
  const operationKey = typeof value === 'string' ? value.trim() : '';
  if (!OPERATION_KEY_PATTERN.test(operationKey)) {
    throw flowError(
      'La identidad de la operacion es invalida.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  return operationKey;
}

function normalizedFlowSubmission(value, operationKey) {
  const evidence = objectInput(value, 'flowSubmission');
  rejectUnknownFields(evidence, FLOW_SUBMISSION_FIELDS);
  if (
    evidence.receiptDeliveryRequested !== undefined
    && typeof evidence.receiptDeliveryRequested !== 'boolean'
  ) {
    throw flowError(
      'La evidencia de reserva del destino de cobro es invalida.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  const reservationId = identifier(evidence.reservationId, 'flowSubmission.reservationId')
    .toLowerCase();
  const fingerprintKeyId = identifier(
    evidence.fingerprintKeyId,
    'flowSubmission.fingerprintKeyId',
  );
  const fingerprintHmac = identifier(
    evidence.fingerprintHmac,
    'flowSubmission.fingerprintHmac',
  ).toLowerCase();
  const operationMatch = operationKey.match(TERMINAL_OPERATION_KEY_PATTERN);
  if (
    !UUID_PATTERN.test(reservationId)
    || !HMAC_KEY_ID_PATTERN.test(fingerprintKeyId)
    || !SHA256_PATTERN.test(fingerprintHmac)
    || operationMatch?.[2] !== reservationId
  ) {
    throw flowError(
      'La evidencia de reserva del destino de cobro es invalida.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  return {
    reservationId,
    fingerprintKeyId,
    fingerprintHmac,
    ...(evidence.receiptDeliveryRequested === true
      ? { receiptDeliveryRequested: true }
      : {}),
  };
}

function normalizedOptions(value) {
  const options = objectInput(value, 'options');
  rejectUnknownFields(options, OPTION_FIELDS);
  const now = normalizedDate(options.now ?? Date.now(), 'now');
  const notice = normalizedNotice(options.notice);
  if (notice.presentedAt.getTime() > now.getTime()) {
    throw flowError(
      'El aviso de captura no puede presentarse despues de la decision.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  const correlationId = options.correlationId === undefined
    ? null
    : identifier(options.correlationId, 'correlationId');
  const operationKey = normalizedOperationKey(options.operationKey);
  const form = normalizedForm(options.form);
  const flowSubmission = normalizedFlowSubmission(options.flowSubmission, operationKey);
  if (
    (form.receiptDeliveryRequested === true)
    !== (flowSubmission.receiptDeliveryRequested === true)
  ) {
    throw flowError(
      'La preferencia de constancia no coincide con la reserva.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  return {
    scope: normalizedScope(options.scope),
    form,
    notice,
    operationKey,
    flowSubmission,
    now,
    correlationId,
  };
}

function operationDigest(scope, rawOperationKey, purpose) {
  return crypto
    .createHash('sha256')
    .update([
      'obrasaas:worker-payment-flow-operation:v1',
      purpose,
      scope.organizationId,
      scope.projectId,
      scope.workerId,
      scope.personId,
      scope.channelIdentityId,
      rawOperationKey,
    ].join('\n'), 'utf8')
    .digest('hex');
}

function derivedOperationKeys(scope, rawOperationKey) {
  return {
    privacy: `wpf:privacy:${operationDigest(scope, rawOperationKey, 'privacy-choice')}`,
    destination: `wpf:submit:${operationDigest(scope, rawOperationKey, 'payment-destination')}`,
  };
}

export function workerPaymentFlowExpectedOperationKeys(
  rawScope,
  rawOperationKey,
  rawPaymentPurpose,
) {
  const scope = normalizedScope(rawScope);
  const operationKey = normalizedOperationKey(rawOperationKey);
  const paymentPurpose = String(rawPaymentPurpose || '').trim().toUpperCase();
  if (![...PAYMENT_PURPOSES.values()].includes(paymentPurpose)) {
    throw flowError(
      'El proposito de la operacion de cobro es invalido.',
      'WORKER_PAYMENT_FLOW_INPUT_INVALID',
    );
  }
  const derived = derivedOperationKeys(scope, operationKey);
  return Object.freeze({
    privacy: workerPaymentCapturePrivacyChoiceOperationKey({
      organizationId: scope.organizationId,
      personId: scope.personId,
      paymentPurpose,
      channelIdentityId: scope.channelIdentityId,
    }, derived.privacy),
    destination: workerPaymentDestinationSubmissionOperationKey({
      organizationId: scope.organizationId,
      personId: scope.personId,
      channelIdentityId: scope.channelIdentityId,
    }, derived.destination),
  });
}

function exactRecord(record, expected) {
  return record && Object.entries(expected).every(([field, value]) => record[field] === value);
}

async function resolveTrustedWorkerContext(prisma, scope) {
  if (
    !prisma?.worker?.findFirst
    || !prisma?.workerPerson?.findFirst
    || !prisma?.workerChannelIdentity?.findFirst
  ) {
    throw flowError(
      'La persistencia del flujo de cobro no esta disponible.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }

  const worker = await prisma.worker.findFirst({
    where: {
      id: scope.workerId,
      organizationId: scope.organizationId,
      projectId: scope.projectId,
      personId: scope.personId,
      active: true,
      project: {
        organizationId: scope.organizationId,
        status: 'ACTIVE',
      },
    },
    select: {
      id: true,
      organizationId: true,
      projectId: true,
      personId: true,
      active: true,
    },
  });
  if (!exactRecord(worker, {
    id: scope.workerId,
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    personId: scope.personId,
    active: true,
  })) {
    throw flowError(
      'El trabajador no pertenece al alcance activo del flujo.',
      'WORKER_PAYMENT_FLOW_SCOPE_FORBIDDEN',
    );
  }

  const person = await prisma.workerPerson.findFirst({
    where: {
      id: scope.personId,
      organizationId: scope.organizationId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
      identityStatus: true,
      encryptedIdentityPayload: true,
      wrappingKeyId: true,
      recordVersion: true,
      privacyNoticeVersion: true,
      privacyAcceptedAt: true,
    },
  });
  if (!exactRecord(person, {
    id: scope.personId,
    organizationId: scope.organizationId,
    status: 'ACTIVE',
  })) {
    throw flowError(
      'La persona no pertenece al alcance activo del flujo.',
      'WORKER_PAYMENT_FLOW_SCOPE_FORBIDDEN',
    );
  }
  if (person.identityStatus !== 'VERIFIED') {
    throw flowError(
      'La identidad laboral debe estar verificada antes de registrar un destino.',
      'WORKER_PAYMENT_FLOW_IDENTITY_UNVERIFIED',
    );
  }

  const channel = await prisma.workerChannelIdentity.findFirst({
    where: {
      id: scope.channelIdentityId,
      organizationId: scope.organizationId,
      personId: scope.personId,
      provider: 'WHATSAPP',
      status: 'VERIFIED',
      revokedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      personId: true,
      provider: true,
      status: true,
      revokedAt: true,
    },
  });
  if (!exactRecord(channel, {
    id: scope.channelIdentityId,
    organizationId: scope.organizationId,
    personId: scope.personId,
    provider: 'WHATSAPP',
    status: 'VERIFIED',
    revokedAt: null,
  })) {
    throw flowError(
      'El canal de WhatsApp no esta verificado para esta persona.',
      'WORKER_PAYMENT_FLOW_CHANNEL_UNVERIFIED',
    );
  }
  return { worker, person, channel };
}

function personIdentityBinding(person) {
  return {
    organizationId: person.organizationId,
    subjectId: person.id,
    recordId: person.id,
    recordVersion: Number(person.recordVersion),
    purpose: WORKER_FINANCIAL_PURPOSES.IDENTITY_CUIL,
    destinationType: 'CUIL',
    field: WORKER_FINANCIAL_FIELDS.IDENTITY_CUIL,
  };
}

function defaultDecryptIdentity(person, keyConfiguration) {
  const payload = decryptWorkerFinancialPayload({
    encryptedPayload: person.encryptedIdentityPayload,
    wrappingKeyId: person.wrappingKeyId,
  }, personIdentityBinding(person), {
    registry: keyConfiguration.kekRegistry,
  });
  const allowedFields = new Set(['givenNames', 'familyName', 'cuil', 'privacyNoticeVersion']);
  if (
    Object.keys(payload).some((field) => !allowedFields.has(field))
    || payload.privacyNoticeVersion !== person.privacyNoticeVersion
  ) {
    throw new TypeError('Stored identity payload is not bound to its persisted notice.');
  }
  return normalizeWorkerIdentityInput({
    ...payload,
    privacyAccepted: true,
  }, { now: person.privacyAcceptedAt });
}

function resolvedDependencies(value) {
  const provided = value === undefined ? {} : objectInput(value, 'dependencies');
  rejectUnknownFields(provided, DEPENDENCY_FIELDS);
  const dependencies = {
    readKeyConfiguration: readWorkerFinancialKeyConfiguration,
    decryptIdentity: defaultDecryptIdentity,
    validatePaymentInput: validateWorkerPaymentDestinationSubmissionInput,
    recordPrivacyChoice: recordWorkerPaymentCapturePrivacyChoice,
    submitPaymentDestination: submitWorkerPaymentDestination,
    ...provided,
  };
  for (const [name, dependency] of Object.entries(dependencies)) {
    if (typeof dependency !== 'function') {
      throw flowError(
        `La dependencia ${name} no esta disponible.`,
        'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
      );
    }
  }
  return dependencies;
}

function assertDerivedIdentity(value) {
  if (!isPlainObject(value)) {
    throw flowError(
      'La identidad laboral verificada no esta disponible.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }
  const givenNames = typeof value.givenNames === 'string' ? value.givenNames.trim() : '';
  const familyName = typeof value.familyName === 'string' ? value.familyName.trim() : '';
  const cuil = typeof value.cuil === 'string' ? value.cuil.trim() : '';
  if (
    !givenNames
    || !familyName
    || !cuil
    || [givenNames, familyName, cuil].some((entry) => /[\u0000-\u001f\u007f]/.test(entry))
  ) {
    throw flowError(
      'La identidad laboral verificada no esta disponible.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }
  return { holderName: `${givenNames} ${familyName}`, holderCuil: cuil };
}

function maskedDestinationDto(value) {
  if (!isPlainObject(value)) {
    throw flowError(
      'El destino persistido no produjo un comprobante seguro.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }
  const allowedFields = [
    'id',
    'purpose',
    'type',
    'maskedValue',
    'currency',
    'status',
    'version',
    'revision',
    'availableFrom',
    'verifiedAt',
    'createdAt',
    'updatedAt',
    'privacyStatus',
    'paymentUsable',
  ];
  const dto = Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(value, field))
      .map((field) => [field, value[field]]),
  );
  if (
    typeof dto.id !== 'string'
    || typeof dto.status !== 'string'
    || typeof dto.maskedValue !== 'string'
  ) {
    throw flowError(
      'El destino persistido no produjo un comprobante seguro.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }
  return dto;
}

/**
 * Bridges a trusted, session-bound WhatsApp Flow submission into the existing
 * privacy ledger and payment-destination domain. Civil identity is always read
 * and decrypted server-side; the Flow can only declare the destination value.
 */
export async function submitWorkerPaymentDestinationFromWhatsAppFlow(
  prisma,
  rawOptions,
  rawDependencies,
) {
  const options = normalizedOptions(rawOptions);
  const dependencies = resolvedDependencies(rawDependencies);
  const context = await resolveTrustedWorkerContext(prisma, options.scope);

  let keyConfiguration;
  let identity;
  try {
    keyConfiguration = dependencies.readKeyConfiguration();
    identity = assertDerivedIdentity(
      dependencies.decryptIdentity(context.person, keyConfiguration),
    );
  } catch (error) {
    if (error instanceof WorkerPaymentFlowSubmissionError) throw error;
    throw flowError(
      'La identidad laboral verificada no esta disponible.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }

  const operationKeys = derivedOperationKeys(options.scope, options.operationKey);
  const submittedBy = {
    type: 'WORKER_CHANNEL',
    channelIdentityId: options.scope.channelIdentityId,
  };
  const common = {
    personId: options.scope.personId,
    submittedBy,
    now: options.now,
    ...(options.correlationId ? { correlationId: options.correlationId } : {}),
  };
  let validatedPaymentInput;
  try {
    validatedPaymentInput = dependencies.validatePaymentInput({
      purpose: options.form.purpose,
      type: options.form.type,
      value: options.form.value,
      holderName: identity.holderName,
      holderCuil: identity.holderCuil,
      operationKey: operationKeys.destination,
    });
  } catch (cause) {
    if (
      !(cause instanceof WorkerPaymentDestinationError)
      && !(cause instanceof WorkerFinancialDataError)
    ) throw cause;
    throw flowError(
      cause.status < 500
        ? 'Los datos del destino de cobro son invalidos.'
        : 'La validacion del destino de cobro no esta disponible.',
      cause.status < 500
        ? 'WORKER_PAYMENT_FLOW_INPUT_INVALID'
        : 'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }
  // The pure validator also derives domain metadata used internally by the
  // payment service. Project only its public submission contract here so the
  // strict transactional boundary never receives unknown trusted fields.
  const paymentInput = {
    purpose: validatedPaymentInput.purpose,
    type: validatedPaymentInput.type,
    value: validatedPaymentInput.value,
    holderName: validatedPaymentInput.holderName,
    holderCuil: validatedPaymentInput.holderCuil,
    operationKey: validatedPaymentInput.operationKey,
  };
  // Receipt delivery is a channel preference bound to the reservation HMAC,
  // not financial-domain input. Keep the strict domain evidence projection
  // backward compatible with destinations created before this optional opt-in.
  const financialFlowSubmission = {
    reservationId: options.flowSubmission.reservationId,
    fingerprintKeyId: options.flowSubmission.fingerprintKeyId,
    fingerprintHmac: options.flowSubmission.fingerprintHmac,
  };

  const privacyResult = await dependencies.recordPrivacyChoice(prisma, {
    ...common,
    scope: { organizationId: options.scope.organizationId },
    paymentPurpose: paymentInput.purpose,
    notice: options.notice,
    operationKey: operationKeys.privacy,
  });
  const privacyChoiceEvent = privacyResult?.privacyChoiceEvent;
  const privacyChoiceEventId = privacyChoiceEvent?.id;
  const rawPrivacyDecidedAt = privacyChoiceEvent?.decidedAt;
  const privacyDecidedAt = rawPrivacyDecidedAt instanceof Date
    || typeof rawPrivacyDecidedAt === 'string'
    ? new Date(rawPrivacyDecidedAt)
    : new Date(Number.NaN);
  if (
    typeof privacyChoiceEventId !== 'string'
    || !privacyChoiceEventId.trim()
    || Number.isNaN(privacyDecidedAt.getTime())
  ) {
    throw flowError(
      'La aceptacion de privacidad no produjo evidencia valida.',
      'WORKER_PAYMENT_FLOW_CONFIGURATION_INVALID',
    );
  }

  const submissionResult = await dependencies.submitPaymentDestination(prisma, {
    ...common,
    now: privacyDecidedAt,
    scope: {
      organizationId: options.scope.organizationId,
      projectId: options.scope.projectId,
      workerId: options.scope.workerId,
    },
    privacyChoice: { eventId: privacyChoiceEventId },
    flowSubmission: financialFlowSubmission,
    input: paymentInput,
    keyConfiguration,
  });
  const paymentDestination = maskedDestinationDto(submissionResult?.paymentDestination);
  return {
    paymentDestination,
    destinationRef: paymentDestination.id,
    status: paymentDestination.status,
    replayed: Boolean(submissionResult?.replayed),
    privacyChoiceReplayed: Boolean(privacyResult?.replayed),
  };
}
