import { deriveStoredWhatsAppChannelReadiness } from './channel-health.js';

// Public, read-only diagnosis. Neither accepts a token nor contacts Meta.
export function publicWhatsAppCredentialExpiry(connection) {
  const value = connection?.metadata?.channelHealth?.expiresAt ?? connection?.metadata?.expiresAt;
  if (!(typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value))) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0 || seconds > 8640000000000) return null;
  return new Date(seconds * 1000).toISOString();
}

export function deriveWhatsAppTextChannelState(connection, { env = process.env, now = new Date() } = {}) {
  const readiness = deriveStoredWhatsAppChannelReadiness({ connection, env, now });
  const account = readiness.checks.account;
  const webhook = readiness.checks.webhook;
  const operational = Boolean(connection?.enabled === true && connection.connectionStatus === 'CONNECTED' && readiness.checks.platform.configured
    && account.enabled && account.tokenStatus === 'VALID' && account.scopesVerified
    && account.phoneStatus === 'REGISTERED' && account.providerStatus !== 'DEGRADED'
    && account.qualityStatus !== 'DEGRADED'
    && webhook.subscriptionStatus === 'SUBSCRIBED');
  let blocker = null;
  const blocked = (code, title, message, action) => ({ code, title, message, action });
  if (!operational) {
    if (!connection || connection.enabled !== true || connection.connectionStatus !== 'CONNECTED') {
      blocker = blocked('WHATSAPP_CONNECTION_NOT_OPERATIONAL', 'Conexión no habilitada',
        'La conexión debe estar habilitada en esta obra antes de enviar.', 'CHECK_CONNECTION');
    } else if (account.tokenStatus === 'EXPIRED') {
      blocker = blocked('WHATSAPP_TOKEN_EXPIRED', 'Renová la autorización de WhatsApp',
        'La autorización de WhatsApp venció. Renová la conexión en Integraciones; no hace falta crear otra empresa ni volver a registrar el número.', 'RECONNECT');
    } else if (account.tokenStatus === 'INVALID') {
      blocker = blocked('WHATSAPP_TOKEN_INVALID', 'La autorización necesita renovarse',
        'La credencial fue rechazada. Reconectá esta misma cuenta desde Integraciones antes de volver a enviar.', 'RECONNECT');
    } else if (!readiness.checks.platform.configured) {
      blocker = blocked('WHATSAPP_PLATFORM_NOT_READY', 'Configuración de la plataforma pendiente',
        'La administración de ObraSaaS debe completar la configuración segura. No repitas el alta ni compartas claves.', 'CONTACT_PLATFORM');
    } else if (account.tokenStatus === 'UNKNOWN' || !account.scopesVerified) {
      blocker = blocked('WHATSAPP_CHANNEL_NOT_READY', 'Verificación de cuenta pendiente',
        'Verificá el canal desde Integraciones. Todavía no se confirmó una autorización con los permisos necesarios.', 'VERIFY_CHANNEL');
    } else if (webhook.subscriptionStatus !== 'SUBSCRIBED') {
      blocker = blocked('WHATSAPP_CHANNEL_NOT_READY', 'Recepción de eventos pendiente',
        'Revisá la vinculación del canal en Integraciones antes de enviar.', 'VERIFY_CHANNEL');
    } else {
      blocker = blocked('WHATSAPP_CHANNEL_NOT_READY', 'El canal requiere atención',
        'Consultá el estado de la cuenta y el número en Integraciones. Esta comprobación no habilita envíos por sí sola.', 'VERIFY_CHANNEL');
    }
  }
  return { operational, readiness, recovery: {
    version: 1, sendAllowed: operational, blocker,
    tokenStatus: account.tokenStatus,
    credentialExpiresAt: publicWhatsAppCredentialExpiry(connection),
    checkedAt: now.toISOString(), basis: 'STORED_PROVIDER_STATE',
    providerVerifiedByThisRead: false,
  } };
}
