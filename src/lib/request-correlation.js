import { randomUUID } from 'node:crypto';

const MAX_LENGTH = 128;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveRequestCorrelationId(request) {
  const candidate = request?.headers?.get?.('x-request-id')?.trim() || '';
  return SAFE_ID.test(candidate.slice(0, MAX_LENGTH)) && candidate.length <= MAX_LENGTH
    ? candidate
    : randomUUID();
}

export function withCorrelationId(response, correlationId) {
  const headers = new Headers(response?.headers);
  headers.set('x-request-id', correlationId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
