// Use the active tab's Clerk token. The shared __session cookie can belong to
// a different organization after another tab switches its active context.
const unsent = error => Object.assign(error, {requestDispatched:false});
export async function workspaceActiveToken(getSessionToken, {signal, tokenTimeoutMs = 15000} = {}) {
  if (!Number.isInteger(tokenTimeoutMs) || tokenTimeoutMs < 1 || tokenTimeoutMs > 15000) throw unsent(new TypeError('A bounded token deadline is required'));
  if (signal?.aborted) throw unsent(new DOMException('La consulta se canceló.', 'AbortError'));
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const unavailable = () => unsent(Object.assign(new Error('No se pudo renovar tu sesión. Volvé a consultar.'), {code:'IDENTITY_PROVIDER_UNAVAILABLE',status:503}));
    const abort = () => finish(reject, unsent(new DOMException('La consulta se canceló.', 'AbortError')));
    const timer = setTimeout(() => finish(reject, unavailable()), tokenTimeoutMs);
    signal?.addEventListener('abort', abort, {once:true});
    Promise.resolve().then(() => finished ? undefined : getSessionToken()).then(token => finish(resolve, token), () => finish(reject, unavailable()));
  });
}

export async function workspaceSessionRequest(url, options, {getSessionToken, fetchImpl = fetch, tokenTimeoutMs = 15000, requestTimeoutMs = 20000} = {}) {
  if (!Number.isInteger(tokenTimeoutMs) || tokenTimeoutMs < 1 || tokenTimeoutMs > 15000) throw unsent(new TypeError('A bounded token deadline is required'));
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 60000) throw unsent(new TypeError('A bounded request deadline is required'));
  const signal = AbortSignal.any([...(options?.signal ? [options.signal] : []), AbortSignal.timeout(requestTimeoutMs)]);
  const headers = new Headers(options?.headers);
  if (typeof getSessionToken !== 'function') throw unsent(Object.assign(new Error('Tu sesión terminó. Volvé a ingresar.'), {code:'SESSION_REQUIRED',status:401}));
  const token = await workspaceActiveToken(getSessionToken, {signal, tokenTimeoutMs});
  if (!token) throw unsent(Object.assign(new Error('Tu sesión terminó. Volvé a ingresar.'), {code:'SESSION_REQUIRED',status:401}));
  headers.set('Authorization', 'Bearer ' + token);
  if (signal.aborted) throw unsent(new DOMException('La consulta se canceló.', 'AbortError'));
  // Never retry a mutation here. A lost confirmation must use its receipt.
  return fetchImpl(url, {...options, signal, headers, credentials:'same-origin', cache:'no-store'});
}
