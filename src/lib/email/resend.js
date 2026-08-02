const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 10_000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ResendConfigurationError extends Error {
  constructor(message, code = 'SUPPLIER_REMINDER_EMAIL_NOT_CONFIGURED') {
    super(message);
    this.name = 'ResendConfigurationError';
    this.code = code;
    this.status = 503;
  }
}

function configured(value, name, max = 500) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max) {
    throw new ResendConfigurationError(`${name} no esta configurado.`);
  }
  return normalized;
}

function senderEmail(value) {
  const match = String(value).match(/<([^<>]+)>\s*$/);
  return (match?.[1] || value).trim().toLowerCase();
}

export function readResendEmailConfig(env = process.env) {
  if (env.SUPPLIER_REMINDER_EMAIL_ENABLED !== 'true') {
    throw new ResendConfigurationError('El envio de recordatorios a proveedores no esta habilitado.');
  }
  const apiKey = configured(env.RESEND_API_KEY, 'RESEND_API_KEY');
  const from = configured(env.RESEND_FROM_EMAIL, 'RESEND_FROM_EMAIL', 220);
  const fromEmail = senderEmail(from);
  if (!EMAIL_PATTERN.test(fromEmail)) {
    throw new ResendConfigurationError('RESEND_FROM_EMAIL no es un remitente valido.');
  }
  const verifiedFromDomain = configured(env.RESEND_VERIFIED_FROM_DOMAIN, 'RESEND_VERIFIED_FROM_DOMAIN', 253).toLowerCase();
  const fromDomain = fromEmail.split('@')[1];
  if (fromDomain !== verifiedFromDomain && !fromDomain.endsWith(`.${verifiedFromDomain}`)) {
    throw new ResendConfigurationError('El remitente no pertenece al dominio verificado configurado.');
  }
  const idempotencyNamespace = configured(env.RESEND_IDEMPOTENCY_NAMESPACE, 'RESEND_IDEMPOTENCY_NAMESPACE', 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$|^[a-z0-9]$/.test(idempotencyNamespace)) {
    throw new ResendConfigurationError('RESEND_IDEMPOTENCY_NAMESPACE no es valido.');
  }
  const { webhookSecret, webhookSecrets } = readResendWebhookConfig(env);
  const replyTo = typeof env.RESEND_REPLY_TO === 'string' && env.RESEND_REPLY_TO.trim()
    ? env.RESEND_REPLY_TO.trim().toLowerCase()
    : null;
  if (replyTo && !EMAIL_PATTERN.test(replyTo)) {
    throw new ResendConfigurationError('RESEND_REPLY_TO no es un email valido.');
  }
  return {
    apiKey,
    from,
    verifiedFromDomain,
    idempotencyNamespace,
    webhookSecret,
    webhookSecrets,
    replyTo,
  };
}

export function readResendWebhookConfig(env = process.env) {
  const webhookSecret = configured(env.RESEND_WEBHOOK_SECRET, 'RESEND_WEBHOOK_SECRET');
  const previous = typeof env.RESEND_WEBHOOK_SECRET_PREVIOUS === 'string'
    ? env.RESEND_WEBHOOK_SECRET_PREVIOUS.trim()
    : '';
  if (previous.length > 500) {
    throw new ResendConfigurationError('RESEND_WEBHOOK_SECRET_PREVIOUS no es valido.');
  }
  return {
    webhookSecret,
    webhookSecrets: [...new Set([webhookSecret, previous].filter(Boolean))],
  };
}

function providerErrorCode(value, status) {
  const candidate = value && typeof value === 'object' ? value : {};
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  if (/^[a-z0-9_:-]{1,100}$/i.test(name)) return `RESEND_${name.toUpperCase()}`;
  return `RESEND_HTTP_${status}`;
}

export async function sendResendEmail({
  config,
  delivery,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = new Date(),
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return { outcome: 'uncertain', code: 'RESEND_FETCH_UNAVAILABLE' };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': delivery.providerIdempotencyKey,
      },
      body: JSON.stringify({
        from: config.from,
        to: [delivery.recipientEmail],
        subject: delivery.subject,
        text: delivery.textBody,
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (response.ok) {
      const providerMessageId = typeof payload?.id === 'string' ? payload.id.trim() : '';
      if (!providerMessageId) return { outcome: 'uncertain', code: 'RESEND_ACCEPTED_WITHOUT_ID' };
      return { outcome: 'accepted', provider: 'resend', providerMessageId };
    }
    const code = providerErrorCode(payload, response.status);
    if (response.status === 409 || /IDEMPOTENT/i.test(code)) {
      return { outcome: 'conflict', code };
    }
    const retryAfter = response.headers.get('retry-after');
    let retryAt = null;
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const parsed = Number.isFinite(seconds)
        ? new Date(now.getTime() + Math.max(0, seconds) * 1_000)
        : new Date(retryAfter);
      if (!Number.isNaN(parsed.getTime()) && parsed > now && parsed <= new Date(now.getTime() + 24 * 60 * 60_000)) {
        retryAt = parsed;
      }
    }
    return {
      outcome: 'definitive_failure',
      code,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      ...(retryAt ? { retryAt } : {}),
    };
  } catch {
    // The request may have reached the provider even when the response was lost.
    // A stable provider key helps reconciliation, but automatic retry remains
    // blocked after an ambiguous transport outcome.
    return { outcome: 'uncertain', code: 'RESEND_TRANSPORT_UNCERTAIN' };
  } finally {
    clearTimeout(timeout);
  }
}

export function resendConfigurationErrorResponse(error) {
  if (!(error instanceof ResendConfigurationError)) return null;
  return Response.json({ ok: false, status: 'unavailable', code: error.code }, { status: error.status });
}
