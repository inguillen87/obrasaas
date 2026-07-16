export const PUBLIC_LEAD_SEGMENTS = Object.freeze([
  'ARCHITECTURE',
  'CONSTRUCTION',
  'REAL_ESTATE',
  'GOVERNMENT',
  'INDUSTRIAL',
  'OTHER',
]);

const SEGMENT_SET = new Set(PUBLIC_LEAD_SEGMENTS);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+0-9()\-\s.]{7,40}$/;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1_000;

export class PublicLeadInputError extends Error {
  constructor(message, { code = 'INVALID_LEAD', status = 400 } = {}) {
    super(message);
    this.name = 'PublicLeadInputError';
    this.code = code;
    this.status = status;
  }
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requiredText(value, label, { min = 2, max }) {
  if (typeof value !== 'string') throw new PublicLeadInputError(`${label} es obligatorio.`);
  const normalized = value.trim();
  if (normalized.length < min) throw new PublicLeadInputError(`${label} es demasiado corto.`);
  if (normalized.length > max) throw new PublicLeadInputError(`${label} supera ${max} caracteres.`);
  return normalized;
}

function optionalText(value, label, max) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new PublicLeadInputError(`${label} debe ser texto.`);
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) throw new PublicLeadInputError(`${label} supera ${max} caracteres.`);
  return normalized;
}

function normalizeSeats(value) {
  if (value === undefined || value === null || value === '') return null;
  const seats = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(seats) || seats < 1 || seats > 100_000) {
    throw new PublicLeadInputError('La cantidad de usuarios debe estar entre 1 y 100.000.');
  }
  return seats;
}

export function normalizePublicLeadInput(value, { now = Date.now() } = {}) {
  if (!isPlainRecord(value)) throw new PublicLeadInputError('La solicitud es inválida.');
  const allowedKeys = new Set([
    'organization',
    'contactName',
    'email',
    'phone',
    'segment',
    'estimatedSeats',
    'primaryChallenge',
    'website',
    'startedAt',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new PublicLeadInputError(`El campo ${key} no está permitido.`);
  }

  const honeypot = optionalText(value.website, 'Sitio web', 200);
  const startedAt = Number(value.startedAt);
  if (!Number.isSafeInteger(startedAt)) {
    throw new PublicLeadInputError('La sesión del formulario es inválida.');
  }
  const formAge = now - startedAt;
  const suspiciousTiming = formAge < 0 || formAge > MAX_FORM_AGE_MS;
  if (honeypot || suspiciousTiming) return { spam: true, data: null };

  const organization = requiredText(value.organization, 'La organización', { min: 2, max: 120 });
  const contactName = requiredText(value.contactName, 'Tu nombre', { min: 2, max: 120 });
  const email = requiredText(value.email, 'El email', { min: 5, max: 254 }).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw new PublicLeadInputError('Ingresá un email laboral válido.');
  const phone = optionalText(value.phone, 'El teléfono', 40);
  if (phone && !PHONE_PATTERN.test(phone)) {
    throw new PublicLeadInputError('Ingresá un teléfono válido.');
  }
  if (!SEGMENT_SET.has(value.segment)) {
    throw new PublicLeadInputError('Elegí el tipo de organización.');
  }
  const estimatedSeats = normalizeSeats(value.estimatedSeats);
  const primaryChallenge = requiredText(value.primaryChallenge, 'El desafío principal', {
    min: 10,
    max: 1_200,
  });

  return {
    spam: false,
    data: {
      name: organization,
      contactName,
      email,
      phone,
      segment: value.segment,
      source: 'ORGANIC',
      stage: 'NEW',
      estimatedSeats,
      notes: `Solicitud desde la landing de ObraSaaS.\n\nDesafío principal:\n${primaryChallenge}`,
    },
  };
}
