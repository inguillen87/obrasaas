import crypto from 'node:crypto';

const RESOURCE_ID_PATTERN = /^\d{5,32}$/;
const REGISTRATION_PIN_PATTERN = /^\d{6}$/;

export class MetaIntegrationError extends Error {
  constructor(message, { code = 'META_INTEGRATION_FAILED', status = 502 } = {}) {
    super(message);
    this.name = 'MetaIntegrationError';
    this.code = code;
    this.status = status;
  }
}

export function isValidMetaResourceId(value) {
  return RESOURCE_ID_PATTERN.test(String(value || ''));
}

export function isValidRegistrationPin(value) {
  return REGISTRATION_PIN_PATTERN.test(String(value || ''));
}

export function createAppSecretProof(accessToken, appSecret) {
  if (!accessToken || !appSecret) throw new Error('Access token and app secret are required.');
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

function integrationConfig() {
  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const version = process.env.META_GRAPH_API_VERSION || 'v25.0';
  if (!appId || !appSecret) {
    throw new MetaIntegrationError('La integración de Meta todavía no está habilitada.', {
      code: 'META_NOT_CONFIGURED',
      status: 503,
    });
  }
  return { appId, appSecret, version };
}

async function metaResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;
  const graphCode = payload?.error?.code ? `META_${payload.error.code}` : 'META_GRAPH_ERROR';
  throw new MetaIntegrationError(payload?.error?.message || fallbackMessage, {
    code: graphCode,
    status: response.status >= 400 && response.status < 500 ? 400 : 502,
  });
}

async function graphRequest({
  path,
  accessToken,
  appSecret,
  version,
  method = 'GET',
  body,
  fetchImpl,
}) {
  const url = new URL(`https://graph.facebook.com/${version}/${path}`);
  url.searchParams.set('appsecret_proof', createAppSecretProof(accessToken, appSecret));
  const response = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });
  return metaResponse(response, 'Meta no pudo completar la operación solicitada.');
}

export async function completeEmbeddedSignup({
  code,
  whatsappBusinessId,
  phoneNumberId,
  registrationPin,
  fetchImpl = fetch,
}) {
  if (!code || typeof code !== 'string' || code.length > 2_048) {
    throw new MetaIntegrationError('El código de registro de Meta es inválido.', {
      code: 'INVALID_META_CODE',
      status: 400,
    });
  }
  if (!isValidMetaResourceId(whatsappBusinessId) || !isValidMetaResourceId(phoneNumberId)) {
    throw new MetaIntegrationError('Los identificadores de WhatsApp son inválidos.', {
      code: 'INVALID_WHATSAPP_IDS',
      status: 400,
    });
  }
  if (!isValidRegistrationPin(registrationPin)) {
    throw new MetaIntegrationError('El PIN debe tener exactamente 6 números.', {
      code: 'INVALID_REGISTRATION_PIN',
      status: 400,
    });
  }

  const { appId, appSecret, version } = integrationConfig();
  const exchangeUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
  exchangeUrl.searchParams.set('client_id', appId);
  exchangeUrl.searchParams.set('client_secret', appSecret);
  exchangeUrl.searchParams.set('code', code);
  const exchangeResponse = await fetchImpl(exchangeUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const exchange = await metaResponse(exchangeResponse, 'Meta rechazó el código de registro.');
  if (!exchange.access_token) {
    throw new MetaIntegrationError('Meta no devolvió un token de acceso.', {
      code: 'META_TOKEN_MISSING',
    });
  }
  const accessToken = exchange.access_token;

  const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`);
  debugUrl.searchParams.set('input_token', accessToken);
  const debugResponse = await fetchImpl(debugUrl, {
    headers: { Authorization: `Bearer ${appId}|${appSecret}` },
    cache: 'no-store',
  });
  const debug = await metaResponse(debugResponse, 'No se pudo validar el token de Meta.');
  if (!debug.data?.is_valid || String(debug.data?.app_id) !== String(appId)) {
    throw new MetaIntegrationError('El token no pertenece a la app ObraSaaS.', {
      code: 'META_TOKEN_APP_MISMATCH',
      status: 403,
    });
  }

  const phones = await graphRequest({
    path: `${whatsappBusinessId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&limit=100`,
    accessToken,
    appSecret,
    version,
    fetchImpl,
  });
  const selectedPhone = (phones.data || []).find(
    (phone) => String(phone.id) === String(phoneNumberId),
  );
  if (!selectedPhone) {
    throw new MetaIntegrationError('El número no pertenece a la cuenta de WhatsApp seleccionada.', {
      code: 'PHONE_WABA_MISMATCH',
      status: 403,
    });
  }

  await graphRequest({
    path: `${whatsappBusinessId}/subscribed_apps`,
    accessToken,
    appSecret,
    version,
    method: 'POST',
    fetchImpl,
  });
  await graphRequest({
    path: `${phoneNumberId}/register`,
    accessToken,
    appSecret,
    version,
    method: 'POST',
    body: { messaging_product: 'whatsapp', pin: registrationPin },
    fetchImpl,
  });

  return {
    accessToken,
    tokenType: exchange.token_type || null,
    expiresAt: Number(debug.data?.expires_at || 0) || null,
    scopes: Array.isArray(debug.data?.scopes) ? debug.data.scopes : [],
    displayPhoneNumber: selectedPhone.display_phone_number || null,
    verifiedBusinessName: selectedPhone.verified_name || null,
    qualityRating: selectedPhone.quality_rating || null,
    verificationStatus: selectedPhone.code_verification_status || null,
  };
}
