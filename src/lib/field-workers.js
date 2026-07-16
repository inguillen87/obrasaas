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
  WORKER: Object.freeze([...BASE_INTENTS]),
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
  const normalizedRole = isFieldWorkerWhatsAppRole(role) ? role : 'WORKER';
  return FIELD_WORKER_INTENT_MATRIX[normalizedRole].includes(intent);
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
  return {
    id: worker.id,
    name: worker.name,
    phone: normalizeWorkerPhone(worker.phone),
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

const RESOLUTION_SELECT = {
  id: true,
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
};

function rowBelongsToScope(worker, scope) {
  return worker?.projectId === scope.projectId
    && worker?.project?.organizationId === scope.organizationId;
}

function activeRowBelongsToScope(worker, scope) {
  return worker?.active === true && rowBelongsToScope(worker, scope);
}

export async function resolveActiveFieldWorkerByPhone(prisma, scope, phone) {
  const trustedScope = validateScope(scope);
  const normalizedPhone = tryNormalizeWorkerPhone(phone);
  if (!normalizedPhone) {
    return { status: FIELD_WORKER_RESOLUTION.INVALID_PHONE, worker: null, normalizedPhone: null };
  }

  const candidates = await prisma.worker.findMany({
    where: scopedWhere(trustedScope, { active: true }),
    select: RESOLUTION_SELECT,
  });
  const matches = candidates.filter((worker) => (
    activeRowBelongsToScope(worker, trustedScope)
    && tryNormalizeWorkerPhone(worker.phone) === normalizedPhone
  ));
  if (matches.length === 0) {
    return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null, normalizedPhone };
  }
  if (matches.length > 1) {
    return { status: FIELD_WORKER_RESOLUTION.AMBIGUOUS, worker: null, normalizedPhone };
  }
  return { status: FIELD_WORKER_RESOLUTION.RESOLVED, worker: matches[0], normalizedPhone };
}

export async function resolveActiveFieldWorkerById(prisma, scope, workerId) {
  const trustedScope = validateScope(scope);
  const id = typeof workerId === 'string' ? workerId.trim() : '';
  if (!id) return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null };
  const worker = await prisma.worker.findFirst({
    where: scopedWhere(trustedScope, { id, active: true }),
    select: RESOLUTION_SELECT,
  });
  if (!activeRowBelongsToScope(worker, trustedScope)) {
    return { status: FIELD_WORKER_RESOLUTION.UNKNOWN, worker: null };
  }
  return { status: FIELD_WORKER_RESOLUTION.RESOLVED, worker };
}

export async function findFieldWorkerPhoneConflict(prisma, scope, phone, excludeWorkerId = null) {
  const trustedScope = validateScope(scope);
  const normalizedPhone = normalizeWorkerPhone(phone);
  const candidates = await prisma.worker.findMany({
    where: scopedWhere(trustedScope, excludeWorkerId ? { NOT: { id: excludeWorkerId } } : {}),
    select: RESOLUTION_SELECT,
  });
  return candidates.find((worker) => (
    rowBelongsToScope(worker, trustedScope)
    && tryNormalizeWorkerPhone(worker.phone) === normalizedPhone
  )) || null;
}
