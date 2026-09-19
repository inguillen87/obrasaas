// A safe projection of a stored verification, never an authorization to send.
export const CREDENTIAL_WARNING_MS = 24 * 60 * 60 * 1000;
export const CREDENTIAL_VERIFICATION_TTL_MS = 15 * 60 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;
const STATES = new Set(['UNLINKED', 'DISABLED', 'EXPIRED', 'INVALID', 'UNKNOWN', 'RECHECK', 'EXPIRING', 'CURRENT']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
const plain = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const status = value => typeof value === 'string' ? value.trim().toUpperCase() : '';
const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)
  && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
function expiry(raw) {
  if (raw === undefined || raw === null || raw === 0 || raw === '0') return { milliseconds: null, malformed: false };
  if (!(typeof raw === 'number' || typeof raw === 'string' && /^\d+$/.test(raw))) return { milliseconds: null, malformed: true };
  const seconds = Number(raw);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 8640000000000) return { milliseconds: null, malformed: true };
  return { milliseconds: seconds * 1000, malformed: false };
}
function classify(input, now) {
  if (!input.linked) return 'UNLINKED';
  if (input.disabled) return 'DISABLED';
  if (input.expirationMilliseconds !== null && input.expirationMilliseconds <= now) return 'EXPIRED';
  if (input.tokenStatus === 'EXPIRED' || input.tokenStatus === 'INVALID') return input.tokenStatus;
  if (input.malformedExpiry || input.tokenStatus !== 'VALID' || input.checkedMilliseconds === null
    || input.checkedMilliseconds > now + FUTURE_SKEW_MS) return 'UNKNOWN';
  if (now - input.checkedMilliseconds > CREDENTIAL_VERIFICATION_TTL_MS) return 'RECHECK';
  if (input.expirationMilliseconds !== null && input.expirationMilliseconds - now <= CREDENTIAL_WARNING_MS) return 'EXPIRING';
  return 'CURRENT';
}
function projection(input, now) {
  const state = classify(input, now);
  return {
    version: 1, state, observedAt: new Date(now).toISOString(),
    expiresAt: input.expirationMilliseconds === null ? null : new Date(input.expirationMilliseconds).toISOString(),
    checkedAt: input.checkedMilliseconds === null ? null : new Date(input.checkedMilliseconds).toISOString(),
    expirationKnown: input.expirationMilliseconds !== null,
    blocksProviderActions: !['CURRENT', 'EXPIRING'].includes(state),
    reauthorizationRequired: ['EXPIRED', 'INVALID'].includes(state),
    providerVerifiedByThisRead: false,
  };
}
export function inspectWhatsAppCredentialLifecycle(connection, { now = new Date() } = {}) {
  const time = now instanceof Date ? now.getTime() : NaN;
  if (!Number.isFinite(time)) throw new TypeError('A valid observation time is required');
  const metadata = plain(connection?.metadata), health = plain(metadata.channelHealth);
  // A modern snapshot must not inherit an obsolete deadline from an earlier token.
  const modern = Object.prototype.hasOwnProperty.call(metadata, 'channelHealth');
  const expiration = expiry(modern ? health.expiresAt : metadata.expiresAt);
  const checked = timestamp(modern ? health.checkedAt : metadata.lastRemoteVerifiedAt);
  const tokenStatus = status(health.tokenStatus) || (!modern && checked !== null && Array.isArray(metadata.scopes) ? 'VALID' : 'UNKNOWN');
  return projection({ linked: Boolean(connection), disabled: connection?.enabled !== true || status(connection?.connectionStatus) === 'DISABLED',
    tokenStatus, checkedMilliseconds: checked, expirationMilliseconds: expiration.milliseconds, malformedExpiry: expiration.malformed }, time);
}
export function validCredentialSnapshot(value) {
  return Boolean(value && value.version === 1 && STATES.has(value.state) && timestamp(value.observedAt) !== null
    && (value.expiresAt === null || timestamp(value.expiresAt) !== null)
    && (value.checkedAt === null || timestamp(value.checkedAt) !== null)
    && value.expirationKnown === (value.expiresAt !== null)
    && value.blocksProviderActions === !['CURRENT', 'EXPIRING'].includes(value.state)
    && value.reauthorizationRequired === ['EXPIRED', 'INVALID'].includes(value.state)
    && value.providerVerifiedByThisRead === false);
}
export function confirmCredentialSnapshot(payload, scope) {
  if (!ID.test(scope?.organizationId || '') || !ID.test(scope?.projectId || '')
    || payload?.context?.organizationId !== scope.organizationId || payload?.context?.projectId !== scope.projectId
    || !validCredentialSnapshot(payload?.credential)) {
    const error = new Error('No se confirmó el estado de WhatsApp en esta empresa y obra. Recargá la página.');
    error.code = 'WHATSAPP_LIFECYCLE_CONTEXT_CHANGED'; throw error;
  }
  return payload.credential;
}
// Client clock advances from the server's observation using monotonic elapsed time.
// It can expire a snapshot, never turn an unknown/revoked snapshot into permission.
export function advanceCredentialSnapshot(snapshot, elapsedMs) {
  if (!validCredentialSnapshot(snapshot) || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const now = timestamp(snapshot.observedAt) + elapsedMs;
  if (!Number.isFinite(now) || Math.abs(now) > 8640000000000000) return null;
  if (!['CURRENT', 'EXPIRING', 'RECHECK'].includes(snapshot.state)) return snapshot;
  return projection({ linked: true, disabled: false, tokenStatus: 'VALID', malformedExpiry: false,
    checkedMilliseconds: timestamp(snapshot.checkedAt), expirationMilliseconds: timestamp(snapshot.expiresAt) }, now);
}
export function credentialRecoveryCopy(snapshot) {
  const map = {
    UNLINKED: ['Todavía sin autorización', 'Prepará esta obra y conectá el número de tu empresa con Meta.'],
    DISABLED: ['Canal desactivado', 'La conexión está desactivada. No se reactivará por consultar su estado.'],
    EXPIRED: ['La autorización de WhatsApp venció', 'Volvé a autorizar el mismo número en Meta. La empresa, la obra y sus mensajes se conservan; no los crees otra vez.'],
    INVALID: ['Meta requiere una nueva autorización', 'La verificación registrada rechazó la credencial. Recuperá el acceso al mismo canal con su titular.'],
    UNKNOWN: ['Falta verificar la autorización', 'No hay una comprobación utilizable de la credencial. Verificá el canal antes de operar.'],
    RECHECK: ['La verificación necesita actualizarse', 'La última comprobación con Meta quedó fuera del intervalo vigente. Consultar esta pantalla no renueva la autorización.'],
    EXPIRING: ['La autorización vence pronto', 'La fecha informada está dentro de las próximas 24 horas. Planificá su renovación antes de que se interrumpan los envíos.'],
    CURRENT: ['Autorización verificada recientemente', 'La verificación registrada sigue vigente. Esto no acredita entrega de mensajes ni finalización de una tarea.'],
  };
  const copy = map[snapshot?.state] || map.UNKNOWN;
  return { title: copy[0], description: copy[1] };
}
