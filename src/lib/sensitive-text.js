export const SECURE_LINK_REDACTION = '[enlace seguro omitido]';

const SECURE_WEBVIEW_URL_PATTERN = /(?:https?:\/\/[^\s/?#<>"']+)?\/webview\/(?:attendance|medical|progress-evidence-location|worker-payment-receipt)(?:[/?#][^\s<>"']*)?/giu;
const SENSITIVE_QUERY_PARAMETER_PATTERN = /([?&](?:token|code|sig|signature|key|api[_-]?key|authorization)=)[^&#\s<>"']+/giu;
const ENCODED_SENSITIVE_QUERY_PARAMETER_PATTERN = /(?:%3f|%26)(?:token|code|sig|signature|key|api[_-]?key|authorization)%3d[^%\s<>"']+/giu;
const AUTHORIZATION_SECRET_PATTERN = /((?:["']?)\b(?:authorization|x-api-key)\b(?:["']?)\s*[:=]\s*)["']?(?:bearer\s+)?[A-Za-z0-9._~+/=-]{8,}["']?/giu;
const BEARER_SECRET_PATTERN = /\bbearer\s+[A-Za-z0-9._~+/=-]{8,}/giu;
const LABELED_SECRET_PATTERN = /((?:["']?)\b(?:token|code|sig|signature|key|api[_ -]?key|secret)\b(?:["']?)\s*[:=]\s*)["']?[A-Za-z0-9._~+/=-]{8,}["']?/giu;

/**
 * Removes bearer material while retaining enough surrounding copy for an
 * operator to understand what happened. This helper is intentionally pure so
 * it can guard both server DTOs and client-side exports.
 */
export function redactSensitiveText(value, {
  secureLinkReplacement = SECURE_LINK_REDACTION,
} = {}) {
  return String(value ?? '')
    .replace(SECURE_WEBVIEW_URL_PATTERN, secureLinkReplacement)
    .replace(SENSITIVE_QUERY_PARAMETER_PATTERN, '$1[secreto omitido]')
    .replace(
      ENCODED_SENSITIVE_QUERY_PARAMETER_PATTERN,
      '%3Fsecreto%3D[omitido]',
    )
    .replace(AUTHORIZATION_SECRET_PATTERN, '$1[secreto omitido]')
    .replace(BEARER_SECRET_PATTERN, 'Bearer [secreto omitido]')
    .replace(LABELED_SECRET_PATTERN, '$1[secreto omitido]');
}
