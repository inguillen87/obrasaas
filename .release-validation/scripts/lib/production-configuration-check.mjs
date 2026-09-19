// Structural preflight only. Never reads the database, contacts a provider,
// creates credentials, changes configuration, or returns input values.
const text = value => typeof value === 'string' && value.length > 0
  && value === value.trim() && !value.includes('\0')
  && !/^(?:replace-with-|your[-_ ]|changeme|<)/i.test(value);

function httpsOrigin(value) {
  if (!text(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search
      || url.hash || url.pathname !== '/' || url.hostname === 'localhost'
      || url.hostname.endsWith('.localhost')) return null;
    return url.origin;
  } catch { return null; }
}

function encryptionKey(value) {
  if (!text(value) || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 32 && bytes.toString('base64') === value;
}

export function inspectProductionPrerequisites(environment = {}) {
  const env = environment || {};
  const checks = [];
  const mode = env.VERCEL_ENV;
  const target = env.VERCEL_TARGET_ENV;
  const conflicting = Boolean(target && target !== mode);
  const applicable = mode === 'production' || target === 'production';
  const knownMode = mode === undefined || ['development', 'preview', 'production'].includes(mode);
  function check(key, ok, code) {
    checks.push({ key, status: ok ? 'FORMAT_CHECKED' : 'BLOCKED', code: ok ? null : code });
  }
  if (conflicting || !knownMode) check('VERCEL_ENV', false, 'ENVIRONMENT_MISMATCH');
  if (applicable) {
    const origin = httpsOrigin(env.NEXT_PUBLIC_APP_URL);
    check('NEXT_PUBLIC_APP_URL', Boolean(origin), 'PUBLIC_HTTPS_ORIGIN_REQUIRED');
    check('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', text(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
      && /^pk_live_[A-Za-z0-9_-]+$/.test(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY), 'CLERK_PRODUCTION_KEY_REQUIRED');
    check('CLERK_SECRET_KEY', text(env.CLERK_SECRET_KEY)
      && /^sk_live_[A-Za-z0-9_-]+$/.test(env.CLERK_SECRET_KEY), 'CLERK_PRODUCTION_KEY_REQUIRED');
    const parties = typeof env.CLERK_AUTHORIZED_PARTIES === 'string'
      ? env.CLERK_AUTHORIZED_PARTIES.split(',').map(party => party.trim()) : [];
    check('CLERK_AUTHORIZED_PARTIES', Boolean(origin) && parties.length > 0
      && parties.every(party => httpsOrigin(party) === party)
      && parties.includes(origin), 'CLERK_ORIGIN_NOT_AUTHORIZED');
    check('CLERK_EXPECTED_INSTANCE_ID', text(env.CLERK_EXPECTED_INSTANCE_ID)
      && /^ins_[A-Za-z0-9]+$/.test(env.CLERK_EXPECTED_INSTANCE_ID), 'CLERK_INSTANCE_REQUIRED');
    for (const key of ['CLERK_WEBHOOK_SIGNING_SECRET', 'CLERK_WEBHOOK_EVIDENCE_SECRET',
      'META_APP_SECRET', 'META_VERIFY_TOKEN', 'CRON_SECRET']) {
      check(key, text(env[key]), 'REQUIRED_CONFIGURATION_MISSING');
    }
    check('WEBVIEW_TOKEN_SECRET', text(env.WEBVIEW_TOKEN_SECRET)
      && Buffer.byteLength(env.WEBVIEW_TOKEN_SECRET, 'utf8') >= 32, 'WEBVIEW_SIGNING_KEY_REQUIRED');
    for (const key of ['NEXT_PUBLIC_META_APP_ID', 'NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID']) {
      check(key, text(env[key]) && /^\d{5,32}$/.test(env[key]), 'META_IDENTIFIER_REQUIRED');
    }
    check('META_GRAPH_API_VERSION', text(env.META_GRAPH_API_VERSION)
      && /^v\d+\.\d+$/.test(env.META_GRAPH_API_VERSION), 'META_VERSION_REQUIRED');
    check('WHATSAPP_CREDENTIALS_ENCRYPTION_KEY', encryptionKey(env.WHATSAPP_CREDENTIALS_ENCRYPTION_KEY),
      'WHATSAPP_ENCRYPTION_KEY_INVALID');
    check('WHATSAPP_PILOT_IMPORT_ENABLED', env.WHATSAPP_PILOT_IMPORT_ENABLED === undefined
      || env.WHATSAPP_PILOT_IMPORT_ENABLED === 'false', 'PREVIEW_IMPORT_FORBIDDEN_IN_PRODUCTION');
    const provider = env.PRIVATE_MEDIA_PROVIDER;
    check('PRIVATE_MEDIA_PROVIDER', ['vercel-blob', 'cloudinary'].includes(provider), 'PRIVATE_STORAGE_PROVIDER_REQUIRED');
    if (provider === 'vercel-blob') check('BLOB_READ_WRITE_TOKEN', text(env.BLOB_READ_WRITE_TOKEN), 'PRIVATE_STORAGE_CREDENTIAL_REQUIRED');
    if (provider === 'cloudinary') {
      let configuredUrl = false;
      try {
        const url = new URL(env.CLOUDINARY_URL);
        configuredUrl = url.protocol === 'cloudinary:' && Boolean(url.hostname && url.username && url.password);
      } catch { /* The separate cloud/key/secret fields remain a supported configuration. */ }
      check('CLOUDINARY_CONFIGURATION', configuredUrl || ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET'].every(key => text(env[key])), 'PRIVATE_STORAGE_CREDENTIAL_REQUIRED');
    }
    const independent = ['META_APP_SECRET', 'META_VERIFY_TOKEN', 'WEBVIEW_TOKEN_SECRET',
      'CLERK_WEBHOOK_SIGNING_SECRET', 'CLERK_WEBHOOK_EVIDENCE_SECRET', 'CRON_SECRET']
      .filter(key => text(env[key])).map(key => env[key]);
    check('SIGNING_KEY_SEPARATION', new Set(independent).size === independent.length,
      'SIGNING_KEYS_MUST_BE_INDEPENDENT');
  }
  const blocked = checks.filter(item => item.status === 'BLOCKED');
  return {
    version: 1,
    status: blocked.length ? 'BLOCKED' : applicable ? 'CONFIGURATION_CHECKED' : 'NOT_APPLICABLE',
    applicable,
    checks,
    blockerCount: blocked.length,
    runtimeVerified: false,
    providerVerified: false,
    migrationAuthorizedByThisCheck: false,
    note: 'Comprobación local de configuración. No valida credenciales, entrega de mensajes, permisos del almacenamiento ni autoriza migraciones.',
  };
}
