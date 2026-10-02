// Use the active tab's Clerk token. The shared __session cookie can belong to
// a different organization after another tab switches its active context.
async function activeToken(getSessionToken, signal, timeoutMs) {
  if (signal?.aborted) throw new DOMException('La consulta se canceló.', 'AbortError');
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const unavailable = () => Object.assign(new Error('No se pudo renovar tu sesión. Volvé a consultar.'), {code:'IDENTITY_PROVIDER_UNAVAILABLE',status:503});
    const abort = () => finish(reject, new DOMException('La consulta se canceló.', 'AbortError'));
    const timer = setTimeout(() => finish(reject, unavailable()), timeoutMs);
    signal?.addEventListener('abort', abort, {once:true});
    Promise.resolve().then(getSessionToken).then(token => finish(resolve, token), () => finish(reject, unavailable()));
  });
}

export async function workspaceSessionRequest(url, options, {getSessionToken, fetchImpl = fetch, tokenTimeoutMs = 15000} = {}) {
  if (!Number.isInteger(tokenTimeoutMs) || tokenTimeoutMs < 1 || tokenTimeoutMs > 15000) throw new TypeError('A bounded token deadline is required');
  const headers = new Headers(options?.headers);
  if (getSessionToken) {
    const token = await activeToken(getSessionToken, options?.signal, tokenTimeoutMs);
    if (!token) throw Object.assign(new Error('Tu sesión terminó. Volvé a ingresar.'), {code:'SESSION_REQUIRED',status:401});
    headers.set('Authorization', 'Bearer ' + token);
  }
  if (options?.signal?.aborted) throw new DOMException('La consulta se canceló.', 'AbortError');
  // Never retry a mutation here. A lost confirmation must use its receipt.
  return fetchImpl(url, {...options, headers, credentials:'same-origin', cache:'no-store'});
}
