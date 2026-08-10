import { deriveStoredWhatsAppChannelReadiness } from './channel-health.js';

export const WHATSAPP_CHANNEL_PRESENTATION_STATES = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  DISABLED: 'DISABLED',
  PENDING: 'PENDING',
  CONNECTED: 'CONNECTED',
  ATTENTION: 'ATTENTION',
});

const PRESENTATION = Object.freeze({
  [WHATSAPP_CHANNEL_PRESENTATION_STATES.NOT_CONFIGURED]: Object.freeze({
    label: 'WhatsApp pendiente',
    summary: 'Todavía no hay una cuenta vinculada a esta obra.',
    tone: 'pending',
  }),
  [WHATSAPP_CHANNEL_PRESENTATION_STATES.DISABLED]: Object.freeze({
    label: 'WhatsApp desactivado',
    summary: 'La conexión está desactivada para esta obra.',
    tone: 'pending',
  }),
  [WHATSAPP_CHANNEL_PRESENTATION_STATES.PENDING]: Object.freeze({
    label: 'WhatsApp por verificar',
    summary: 'Falta confirmar la cuenta y el webhook antes de operar.',
    tone: 'pending',
  }),
  [WHATSAPP_CHANNEL_PRESENTATION_STATES.CONNECTED]: Object.freeze({
    label: 'WhatsApp verificado',
    summary: 'La cuenta y el webhook están verificados.',
    tone: 'connected',
  }),
  [WHATSAPP_CHANNEL_PRESENTATION_STATES.ATTENTION]: Object.freeze({
    label: 'WhatsApp requiere atención',
    summary: 'Revisá Integraciones antes de continuar operando.',
    tone: 'attention',
  }),
});

function normalizedStatus(value) {
  return String(value || '').trim().toUpperCase();
}

function verifiedAccountAndWebhook(readiness) {
  const account = readiness?.checks?.account;
  const webhook = readiness?.checks?.webhook;
  return account?.tokenStatus === 'VALID'
    && account?.scopesVerified === true
    && account?.phoneStatus === 'REGISTERED'
    && account?.providerStatus !== 'DEGRADED'
    && webhook?.subscriptionStatus === 'SUBSCRIBED';
}

/**
 * Produces a credential-free status for compact navigation and portfolio UI.
 * It never claims that real two-way traffic exists; that stronger contract is
 * represented only by the complete channel-readiness model.
 */
export function deriveWhatsAppChannelPresentation(connection, {
  env = process.env,
  now = new Date(),
} = {}) {
  const linked = Boolean(connection);
  let state = WHATSAPP_CHANNEL_PRESENTATION_STATES.NOT_CONFIGURED;
  let readiness = null;

  if (linked) {
    readiness = deriveStoredWhatsAppChannelReadiness({ connection, env, now });
    const status = normalizedStatus(connection.connectionStatus);
    if (connection.enabled === false || status === 'DISABLED') {
      state = WHATSAPP_CHANNEL_PRESENTATION_STATES.DISABLED;
    } else if (readiness.degraded || status === 'ERROR') {
      state = WHATSAPP_CHANNEL_PRESENTATION_STATES.ATTENTION;
    } else if (
      connection.enabled === true
      && status === 'CONNECTED'
      && verifiedAccountAndWebhook(readiness)
    ) {
      state = WHATSAPP_CHANNEL_PRESENTATION_STATES.CONNECTED;
    } else {
      state = WHATSAPP_CHANNEL_PRESENTATION_STATES.PENDING;
    }
  }

  const copy = PRESENTATION[state];
  return {
    state,
    label: copy.label,
    summary: copy.summary,
    tone: copy.tone,
    linked,
    connected: state === WHATSAPP_CHANNEL_PRESENTATION_STATES.CONNECTED,
    requiresAttention: state === WHATSAPP_CHANNEL_PRESENTATION_STATES.ATTENTION,
  };
}
