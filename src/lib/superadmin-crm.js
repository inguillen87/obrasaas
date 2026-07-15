export const CRM_STAGES = Object.freeze([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DEMO',
  'PROPOSAL',
  'TRIAL',
  'WON',
  'LOST',
]);

export const CRM_SEGMENTS = Object.freeze([
  'ARCHITECTURE',
  'CONSTRUCTION',
  'REAL_ESTATE',
  'GOVERNMENT',
  'INDUSTRIAL',
  'OTHER',
]);

export const CRM_SOURCES = Object.freeze([
  'REFERRAL',
  'ORGANIC',
  'OUTBOUND',
  'PARTNER',
  'EVENT',
  'OTHER',
]);

const STAGE_SET = new Set(CRM_STAGES);
const SEGMENT_SET = new Set(CRM_SEGMENTS);
const SOURCE_SET = new Set(CRM_SOURCES);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CrmAccountInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CrmAccountInputError';
  }
}

function optionalText(value, label, maxLength) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new CrmAccountInputError(`${label} debe ser texto.`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw new CrmAccountInputError(`${label} no puede superar ${maxLength} caracteres.`);
  }
  return normalized;
}

function requiredName(value, current) {
  const candidate = value === undefined ? current?.name : value;
  if (typeof candidate !== 'string' || candidate.trim().length < 2) {
    throw new CrmAccountInputError('La organización debe tener al menos 2 caracteres.');
  }
  const name = candidate.trim();
  if (name.length > 120) {
    throw new CrmAccountInputError('La organización no puede superar 120 caracteres.');
  }
  return name;
}

function optionalEnum(value, allowed, label) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new CrmAccountInputError(`${label} no es válido.`);
  }
  return value;
}

function optionalInteger(value, label, max) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw new CrmAccountInputError(`${label} debe ser un entero entre 1 y ${max}.`);
  }
  return number;
}

function optionalMoney(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000) {
    throw new CrmAccountInputError('El valor mensual debe estar entre USD 0 y USD 1.000.000.');
  }
  return Math.round(number * 100) / 100;
}

function optionalDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CrmAccountInputError('El próximo seguimiento debe usar el formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  const [year, month, day] = value.split('-').map(Number);
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new CrmAccountInputError('La fecha de seguimiento es inválida.');
  }
  return date;
}

function comparable(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return value.toString();
  if (value && typeof value === 'object' && typeof value.toString === 'function') {
    return value.toString();
  }
  return value ?? null;
}

export function normalizeCrmAccountInput(body, current = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new CrmAccountInputError('La oportunidad comercial es inválida.');
  }

  const data = {
    name: requiredName(body.name, current),
    contactName: optionalText(body.contactName, 'El contacto', 120),
    email: optionalText(body.email, 'El email', 254),
    phone: optionalText(body.phone, 'El teléfono', 40),
    segment: optionalEnum(body.segment, SEGMENT_SET, 'El segmento'),
    source: optionalEnum(body.source, SOURCE_SET, 'El origen'),
    stage: optionalEnum(body.stage, STAGE_SET, 'La etapa'),
    estimatedSeats: optionalInteger(body.estimatedSeats, 'La cantidad de usuarios', 100_000),
    estimatedMonthlyValue: optionalMoney(body.estimatedMonthlyValue),
    nextFollowUpAt: optionalDate(body.nextFollowUpAt),
    notes: optionalText(body.notes, 'Las notas', 5_000),
  };

  if (data.email) {
    data.email = data.email.toLowerCase();
    if (!EMAIL_PATTERN.test(data.email)) {
      throw new CrmAccountInputError('Ingresá un email válido.');
    }
  }

  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }

  if (!current) {
    data.stage ||= 'NEW';
    return { data, changes: { created: true } };
  }

  const changes = {};
  for (const [key, value] of Object.entries(data)) {
    const previous = comparable(current[key]);
    const next = comparable(value);
    if (previous !== next) changes[key] = { from: previous, to: next };
  }
  if (Object.keys(changes).length === 0) {
    throw new CrmAccountInputError('No hay cambios para guardar.');
  }

  return { data, changes };
}

export function serializeCrmAccount(account) {
  return {
    id: account.id,
    organizationId: account.organizationId || null,
    name: account.name,
    contactName: account.contactName || null,
    email: account.email || null,
    phone: account.phone || null,
    segment: account.segment || null,
    source: account.source || null,
    stage: account.stage,
    estimatedSeats: account.estimatedSeats ?? null,
    estimatedMonthlyValue: account.estimatedMonthlyValue === null
      || account.estimatedMonthlyValue === undefined
      ? null
      : Number(account.estimatedMonthlyValue),
    nextFollowUpAt: account.nextFollowUpAt?.toISOString() || null,
    notes: account.notes || null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}
