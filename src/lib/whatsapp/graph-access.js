import 'server-only';

import { deriveStoredWhatsAppChannelReadiness } from './channel-health.js';

const SAFE_FAILURES = Object.freeze({
  WHATSAPP_GRAPH_RECONNECT_REQUIRED: Object.freeze({
    message: 'La credencial de Meta requiere reconexión antes de usar esta función.',
    status: 409,
  }),
  WHATSAPP_GRAPH_VERIFICATION_REQUIRED: Object.freeze({
    message: 'Verificá la cuenta de Meta antes de usar esta función.',
    status: 409,
  }),
  WHATSAPP_GRAPH_CONFIGURATION_REQUIRED: Object.freeze({
    message: 'La configuración segura de Meta no está disponible en este ambiente.',
    status: 503,
  }),
  WHATSAPP_NOT_CONNECTED: Object.freeze({
    message: 'Conectá una cuenta de WhatsApp antes de usar esta función.',
    status: 409,
  }),
});

function normalized(value) {
  return String(value || '').trim().toUpperCase();
}

export class WhatsAppGraphAccessError extends Error {
  constructor(code) {
    const safeCode = Object.hasOwn(SAFE_FAILURES, code)
      ? code
      : 'WHATSAPP_GRAPH_VERIFICATION_REQUIRED';
    const failure = SAFE_FAILURES[safeCode];
    super(failure.message);
    this.name = 'WhatsAppGraphAccessError';
    this.code = safeCode;
    this.status = failure.status;
  }
}

export function inspectStoredWhatsAppGraphAccess(connection, {
  env = process.env,
  now = new Date(),
} = {}) {
  if (!env.META_APP_SECRET || !env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY) {
    return { ready: false, code: 'WHATSAPP_GRAPH_CONFIGURATION_REQUIRED' };
  }
  if (
    !connection?.enabled
    || normalized(connection.connectionStatus) !== 'CONNECTED'
    || !connection.whatsappBusinessId
    || !connection.phoneNumberId
    || !connection.encryptedAccessToken
  ) {
    return { ready: false, code: 'WHATSAPP_NOT_CONNECTED' };
  }

  const readiness = deriveStoredWhatsAppChannelReadiness({ connection, env, now });
  const account = readiness?.checks?.account || {};
  if (['EXPIRED', 'INVALID'].includes(normalized(account.tokenStatus))) {
    return { ready: false, code: 'WHATSAPP_GRAPH_RECONNECT_REQUIRED' };
  }
  if (
    normalized(account.tokenStatus) !== 'VALID'
    || account.scopesVerified !== true
    || normalized(account.phoneStatus) !== 'REGISTERED'
    || normalized(account.providerStatus) === 'DEGRADED'
  ) {
    return { ready: false, code: 'WHATSAPP_GRAPH_VERIFICATION_REQUIRED' };
  }
  return { ready: true, code: null };
}

export async function requireGraphReadyWhatsAppConnection(prisma, projectId, options) {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { projectId },
  });
  const access = inspectStoredWhatsAppGraphAccess(connection, options);
  if (!access.ready) throw new WhatsAppGraphAccessError(access.code);
  return connection;
}
