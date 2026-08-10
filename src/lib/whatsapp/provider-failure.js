const MAX_META_PROVIDER_CODE = 999_999;
const META_MACHINE_CODE_PATTERN = /^META_(\d{1,6})$/;

export function normalizeMetaProviderCode(value) {
  const normalized = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d{1,6}$/.test(value.trim())
      ? Number(value.trim())
      : null;
  return Number.isSafeInteger(normalized)
    && normalized > 0
    && normalized <= MAX_META_PROVIDER_CODE
    ? normalized
    : null;
}

export function metaProviderCodeFromError(error) {
  const direct = normalizeMetaProviderCode(error?.providerCode);
  if (direct) return direct;
  const match = typeof error?.code === 'string'
    ? META_MACHINE_CODE_PATTERN.exec(error.code.trim().toUpperCase())
    : null;
  return normalizeMetaProviderCode(match?.[1]);
}

function isMetaTestEnvironment(env) {
  const vercelEnvironment = String(env?.VERCEL_ENV || '').trim().toLowerCase();
  const nodeEnvironment = String(env?.NODE_ENV || '').trim().toLowerCase();
  return ['preview', 'development'].includes(vercelEnvironment)
    || ['test', 'development'].includes(nodeEnvironment);
}

export function metaProviderFailurePresentation({
  providerCode,
  deliveryStatus = 'failed',
  env = process.env,
} = {}) {
  const normalizedProviderCode = normalizeMetaProviderCode(providerCode);
  if (!normalizedProviderCode) return null;

  if (String(deliveryStatus || '').trim().toLowerCase() === 'unknown') {
    return {
      providerCode: normalizedProviderCode,
      code: 'META_DELIVERY_UNCONFIRMED',
      title: 'Entrega sin confirmar',
      detail: 'No repitas el envío hasta revisar el intento con el código informado.',
    };
  }

  if (normalizedProviderCode === 131030 && isMetaTestEnvironment(env)) {
    return {
      providerCode: normalizedProviderCode,
      code: 'META_TEST_RECIPIENT_NOT_ENABLED',
      title: 'Destinatario de prueba no habilitado',
      detail: 'Agregá el número a los destinatarios de prueba de Meta y repetí la prueba como un envío nuevo.',
    };
  }

  return {
    providerCode: normalizedProviderCode,
    code: 'META_PROVIDER_REJECTED',
    title: 'Meta rechazó el envío',
    detail: 'Revisá la configuración del canal en Meta con el código informado antes de iniciar un envío nuevo.',
  };
}
