const PUBLIC_MESSAGES = Object.freeze({
  FLOW_BLUEPRINT_NOT_FOUND: 'El blueprint de WhatsApp Flow no existe.',
  FLOW_JSON_REJECTED: 'Meta rechazó la definición del Flow. Revisá el contrato antes de reintentar.',
  INVALID_META_CODE: 'El código temporal de Meta no es válido o ya venció.',
  INVALID_REGISTRATION_PIN: 'El PIN debe tener exactamente 6 números.',
  INVALID_WHATSAPP_IDS: 'Los activos seleccionados de WhatsApp no son válidos.',
  META_APP_NOT_SUBSCRIBED: 'La app no está suscripta al WABA seleccionado.',
  META_GRAPH_NETWORK_ERROR: 'No se pudo contactar a Meta. Reintentá cuando la conexión esté estable.',
  META_GRAPH_TIMEOUT: 'Meta no respondió dentro del tiempo seguro. Reintentá más tarde.',
  META_NOT_CONFIGURED: 'La configuración segura de Meta no está disponible en este ambiente.',
  META_SCOPES_INCOMPLETE: 'La cuenta no concedió todos los permisos obligatorios de WhatsApp.',
  META_TOKEN_APP_MISMATCH: 'La credencial no pertenece a la app de Meta configurada para ObraSaaS.',
  META_TOKEN_MISSING: 'Meta no devolvió una credencial utilizable.',
  PHONE_WABA_MISMATCH: 'El número seleccionado no pertenece al WABA indicado.',
  WHATSAPP_PUBLIC_APP_URL_INVALID: 'La URL pública de este ambiente no es válida.',
  WHATSAPP_PUBLIC_APP_URL_PREVIEW_NOT_ALLOWED: 'El origen de Preview no está autorizado para WhatsApp Flows.',
  WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK: 'Preview no puede operar sobre el origen de Producción.',
  WHATSAPP_PUBLIC_APP_URL_REQUIRED: 'Configurá la URL pública segura antes de administrar WhatsApp Flows.',
});

const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,95}$/;

function safeStatus(value) {
  return Number.isSafeInteger(value) && value >= 400 && value <= 599 ? value : 500;
}

export function publicMetaIntegrationFailure(error, {
  fallback = 'No se pudo completar la operación con Meta.',
  fallbackCode = 'META_OPERATION_FAILED',
} = {}) {
  const candidate = String(error?.code || '').trim().toUpperCase();
  const safeFallbackCode = SAFE_CODE_PATTERN.test(fallbackCode)
    ? fallbackCode
    : 'META_OPERATION_FAILED';
  const code = SAFE_CODE_PATTERN.test(candidate) ? candidate : safeFallbackCode;
  let message = PUBLIC_MESSAGES[code] || String(fallback || '').trim();
  if (/^META_(?:190|PILOT_TOKEN_EXPIRED|PILOT_TOKEN_INVALID)$/.test(code)) {
    message = 'La credencial de Meta venció o dejó de ser válida. Reconectá la cuenta.';
  } else if (code.startsWith('META_') && !PUBLIC_MESSAGES[code]) {
    message = 'Meta rechazó la operación. Revisá la cuenta y volvé a intentarlo.';
  }
  if (!message) message = 'No se pudo completar la operación con Meta.';
  return {
    code,
    message: message.slice(0, 300),
    status: safeStatus(error?.status),
  };
}
