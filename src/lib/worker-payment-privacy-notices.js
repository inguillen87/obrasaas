import crypto from 'node:crypto';

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class WorkerPaymentPrivacyNoticeError extends Error {
  constructor(message, code = 'WORKER_PAYMENT_PRIVACY_NOTICE_INVALID') {
    super(message);
    this.name = 'WorkerPaymentPrivacyNoticeError';
    this.code = code;
  }
}

function contentSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function immutableNotice({ version, content, expectedContentSha256 }) {
  if (!VERSION_PATTERN.test(version) || typeof content !== 'string' || !content.trim()) {
    throw new WorkerPaymentPrivacyNoticeError(
      'El registro del aviso de privacidad de cobro es invalido.',
    );
  }
  const calculated = contentSha256(content);
  if (!SHA256_PATTERN.test(expectedContentSha256) || calculated !== expectedContentSha256) {
    throw new WorkerPaymentPrivacyNoticeError(
      `El contenido del aviso ${version} no coincide con su compromiso SHA-256.`,
      'WORKER_PAYMENT_PRIVACY_NOTICE_INTEGRITY_FAILED',
    );
  }
  return Object.freeze({
    version,
    content,
    contentSha256: expectedContentSha256,
  });
}

// Append-only product-copy registry. Never edit a published version. A new
// entry may become current only in the same reviewed release as the database
// trigger migration that authorizes its exact version/hash; advancing this
// constant alone intentionally fails closed. Legal basis and retention still
// require review for each jurisdiction.
const NOTICE_REGISTRY = Object.freeze({
  'worker-payment-capture-v1': immutableNotice({
    version: 'worker-payment-capture-v1',
    content: 'La empresa responsable de esta obra, mediante ObraSaaS, usará el CBU, CVU o alias que informes únicamente para administrar y conciliar haberes o reintegros laborales, verificar su titularidad con un proveedor autorizado y conservar evidencia auditada de los cambios. El dato se almacenará cifrado y el panel mostrará sólo una referencia enmascarada. Informar un destino no ejecuta ningún pago ni garantiza su aprobación. Declará que el destino está a tu nombre. Podés pedir corrección, sustitución o baja a la empresa responsable.',
    expectedContentSha256: '76a909dfb5f5e0ffc6c3f80335ed5097d552647c9be805ebf6ba61afdbd2752b',
  }),
});

export const CURRENT_WORKER_PAYMENT_PRIVACY_NOTICE_VERSION = 'worker-payment-capture-v1';

export function getWorkerPaymentPrivacyNotice(version) {
  const normalized = typeof version === 'string' ? version.trim() : '';
  const notice = VERSION_PATTERN.test(normalized) ? NOTICE_REGISTRY[normalized] : null;
  if (!notice) {
    throw new WorkerPaymentPrivacyNoticeError(
      'La version fijada del aviso de privacidad de cobro no esta registrada.',
      'WORKER_PAYMENT_PRIVACY_NOTICE_NOT_FOUND',
    );
  }
  return notice;
}

export function getCurrentWorkerPaymentPrivacyNotice() {
  return getWorkerPaymentPrivacyNotice(CURRENT_WORKER_PAYMENT_PRIVACY_NOTICE_VERSION);
}

export function assertWorkerPaymentPrivacyNoticeEvidence(version, sha256) {
  const notice = getWorkerPaymentPrivacyNotice(version);
  const normalizedHash = typeof sha256 === 'string' ? sha256.trim().toLowerCase() : '';
  const expected = Buffer.from(notice.contentSha256, 'utf8');
  const actual = Buffer.from(normalizedHash, 'utf8');
  if (
    !SHA256_PATTERN.test(normalizedHash)
    || actual.length !== expected.length
    || !crypto.timingSafeEqual(actual, expected)
  ) {
    throw new WorkerPaymentPrivacyNoticeError(
      'La evidencia fijada del aviso de privacidad de cobro no supera la validacion de integridad.',
      'WORKER_PAYMENT_PRIVACY_NOTICE_INTEGRITY_FAILED',
    );
  }
  return notice;
}
