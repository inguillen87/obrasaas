const LOCAL_APP_URL = 'http://localhost:3000';

function deployedEnvironment(environment) {
  const vercelEnvironment = String(environment?.VERCEL_ENV || '').trim().toLowerCase();
  return Boolean(environment?.VERCEL)
    || vercelEnvironment === 'preview'
    || vercelEnvironment === 'production'
    || environment?.NODE_ENV === 'production';
}

function previewEnvironment(environment) {
  return String(environment?.VERCEL_ENV || '').trim().toLowerCase() === 'preview';
}

function publicAppUrlError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizedConfiguredUrl(environment) {
  const configured = String(environment?.NEXT_PUBLIC_APP_URL || '').trim();
  if (!configured) return null;

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw publicAppUrlError(
      'NEXT_PUBLIC_APP_URL must be a valid absolute URL before WhatsApp webview links can be issued.',
      'WHATSAPP_PUBLIC_APP_URL_INVALID',
    );
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol)
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || (deployedEnvironment(environment) && parsed.protocol !== 'https:')
  ) {
    throw publicAppUrlError(
      'NEXT_PUBLIC_APP_URL must be a stable HTTPS URL without credentials, query parameters or fragments.',
      'WHATSAPP_PUBLIC_APP_URL_INVALID',
    );
  }

  const productionProjectUrl = String(
    environment?.VERCEL_PROJECT_PRODUCTION_URL || '',
  ).trim();
  if (previewEnvironment(environment) && productionProjectUrl) {
    let productionHost = null;
    try {
      productionHost = new URL(
        productionProjectUrl.includes('://')
          ? productionProjectUrl
          : `https://${productionProjectUrl}`,
      ).host.toLowerCase();
    } catch {
      productionHost = null;
    }
    if (productionHost && parsed.host.toLowerCase() === productionHost) {
      throw publicAppUrlError(
        'A Preview deployment cannot issue WhatsApp webviews on the Production project URL.',
        'WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK',
      );
    }
  }

  return parsed.toString().replace(/\/$/, '');
}

export function inspectWhatsAppPublicAppUrl(environment = process.env) {
  try {
    const url = normalizedConfiguredUrl(environment);
    return {
      configured: Boolean(url),
      status: url ? 'CONFIGURED' : 'MISSING',
    };
  } catch (error) {
    return {
      configured: false,
      status: error?.code === 'WHATSAPP_PUBLIC_APP_URL_PRODUCTION_LEAK'
        ? 'PRODUCTION_LEAK'
        : 'INVALID',
    };
  }
}

/**
 * Resolve the public origin embedded in WhatsApp webview links.
 *
 * Vercel's project production URL must never be used as an implicit fallback:
 * a Preview deployment could otherwise send a worker into Production. Localhost
 * remains available only outside deployed/production environments.
 */
export function resolveWhatsAppPublicAppUrl(environment = process.env) {
  const configured = normalizedConfiguredUrl(environment);
  if (configured) return configured;
  if (deployedEnvironment(environment)) {
    throw publicAppUrlError(
      'NEXT_PUBLIC_APP_URL is required in deployed environments before WhatsApp webview links can be issued.',
      'WHATSAPP_PUBLIC_APP_URL_REQUIRED',
    );
  }
  return LOCAL_APP_URL;
}

export function isWhatsAppPublicAppUrlConfigured(environment = process.env) {
  return inspectWhatsAppPublicAppUrl(environment).configured;
}
