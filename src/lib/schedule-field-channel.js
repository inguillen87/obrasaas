const CHANNEL = 'obrasaas-field-invalidations-v1';
const EVENT = 'obrasaas:field-invalidated';
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/;
export function fieldSignalMatches(signal, scope) {
  return Boolean(signal && signal.version === 1 && ID.test(signal.organizationId || '') && ID.test(signal.projectId || '')
    && signal.organizationId === scope?.organizationId && signal.projectId === scope?.projectId);
}
// Only invalidate. No counts, images, records, credentials or authority travel here.
export function publishFieldInvalidation(scope) {
  if (typeof window === 'undefined') return;
  const message = { version: 1, organizationId: scope?.organizationId, projectId: scope?.projectId };
  if (!fieldSignalMatches(message, scope)) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
  try { const channel = new BroadcastChannel(CHANNEL); channel.postMessage(message); channel.close(); } catch { /* Server polling remains the recovery path. */ }
}
export function subscribeFieldInvalidation(scope, onInvalidate) {
  if (typeof window === 'undefined') return () => {};
  const local = event => { if (fieldSignalMatches(event.detail, scope)) onInvalidate(); };
  window.addEventListener(EVENT, local);
  let channel;
  try { channel = new BroadcastChannel(CHANNEL); channel.onmessage = event => { if (fieldSignalMatches(event.data, scope)) onInvalidate(); }; } catch { /* Optional same-browser acceleration. */ }
  return () => { window.removeEventListener(EVENT, local); channel?.close(); };
}
