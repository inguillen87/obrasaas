import crypto from 'node:crypto';

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class WorkerOnboardingPrivacyNoticeError extends Error {
  constructor(message, code = 'WORKER_ONBOARDING_PRIVACY_NOTICE_INVALID') {
    super(message);
    this.name = 'WorkerOnboardingPrivacyNoticeError';
    this.code = code;
  }
}

function contentSha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function immutableNotice({ version, content, expectedContentSha256 }) {
  if (!VERSION_PATTERN.test(version) || typeof content !== 'string' || !content.trim()) {
    throw new WorkerOnboardingPrivacyNoticeError(
      'El registro del aviso de privacidad de alta es invalido.',
    );
  }
  const calculated = contentSha256(content);
  if (!SHA256_PATTERN.test(expectedContentSha256) || calculated !== expectedContentSha256) {
    throw new WorkerOnboardingPrivacyNoticeError(
      `El contenido del aviso ${version} no coincide con su compromiso SHA-256.`,
      'WORKER_ONBOARDING_PRIVACY_NOTICE_INTEGRITY_FAILED',
    );
  }
  return Object.freeze({
    version,
    content,
    contentSha256: expectedContentSha256,
  });
}

// Append-only registry. Published text must never be edited in place: add a
// new version and move CURRENT_WORKER_ONBOARDING_PRIVACY_NOTICE_VERSION.
// These notices are product copy. Legal review remains pending; this registry
// must not be read as legal advice or as evidence that review already occurred.
const NOTICE_REGISTRY = Object.freeze({
  'worker-privacy-v1': immutableNotice({
    version: 'worker-privacy-v1',
    content: 'Usaremos tu nombre y CUIL para validar tu identidad laboral en esta obra. Un responsable debe aprobar el alta antes de habilitar acciones.',
    expectedContentSha256: '207d44ef3ec8ba074aa1fb8f337ea464f751edb1d97d3e921e97d12e2b48eca2',
  }),
  'worker-privacy-v2': immutableNotice({
    version: 'worker-privacy-v2',
    content: 'La empresa responsable de esta obra, mediante ObraSaaS, tratará tu nombre, apellido, CUIL y número de WhatsApp para verificar tu identidad laboral, vincularte con esta obra y habilitar las funciones operativas que autorice la empresa. El envío del formulario no activa tu acceso automáticamente: una persona responsable de la empresa debe revisar y aprobar el alta. Al continuar, confirmás que los datos son tuyos, que son correctos y que aceptás este uso para las finalidades indicadas. Podés solicitar acceso, corrección o baja a la empresa responsable de la obra.',
    expectedContentSha256: 'dd2377b7c960670ed2ad3f9122beaf02b2b2db015f206059d3daad0fa8a66c32',
  }),
});

export const CURRENT_WORKER_ONBOARDING_PRIVACY_NOTICE_VERSION = 'worker-privacy-v2';

export function getWorkerOnboardingPrivacyNotice(version) {
  const normalized = typeof version === 'string' ? version.trim() : '';
  const notice = VERSION_PATTERN.test(normalized) ? NOTICE_REGISTRY[normalized] : null;
  if (!notice) {
    throw new WorkerOnboardingPrivacyNoticeError(
      'La version fijada del aviso de privacidad de alta no esta registrada.',
      'WORKER_ONBOARDING_PRIVACY_NOTICE_NOT_FOUND',
    );
  }
  return notice;
}

export function getCurrentWorkerOnboardingPrivacyNotice() {
  return getWorkerOnboardingPrivacyNotice(
    CURRENT_WORKER_ONBOARDING_PRIVACY_NOTICE_VERSION,
  );
}

export function assertWorkerOnboardingPrivacyNoticeEvidence(version, sha256) {
  const notice = getWorkerOnboardingPrivacyNotice(version);
  const normalizedHash = typeof sha256 === 'string' ? sha256.trim().toLowerCase() : '';
  const expected = Buffer.from(notice.contentSha256, 'utf8');
  const actual = Buffer.from(normalizedHash, 'utf8');
  if (
    !SHA256_PATTERN.test(normalizedHash)
    || actual.length !== expected.length
    || !crypto.timingSafeEqual(actual, expected)
  ) {
    throw new WorkerOnboardingPrivacyNoticeError(
      'La evidencia fijada del aviso de privacidad no supera la validacion de integridad.',
      'WORKER_ONBOARDING_PRIVACY_NOTICE_INTEGRITY_FAILED',
    );
  }
  return notice;
}
