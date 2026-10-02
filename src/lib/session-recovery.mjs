// Recovery proves a fresh session through the existing server verifier. It never
// authorizes business data or writes/replaces a Clerk cookie itself.
export class SessionRecoveryError extends Error {
  constructor(code) { super(code); this.name = 'SessionRecoveryError'; this.code = code; }
}
const failure = code => { throw new SessionRecoveryError(code); };
const jwt = value => typeof value === 'string' && value.length <= 8192 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
export function safeRecoverySignInPath(value) {
  return typeof value === 'string' && /^\/sign-in(?:\?participar=invite_[a-f0-9]{32})?$/.test(value) ? value : '/sign-in';
}
export function sessionCookieMatches(cookie, token) {
  if (typeof cookie !== 'string' || cookie.length > 65536 || !jwt(token)) return false;
  const values = cookie.split(';').map(value => value.trim()).filter(value => value.startsWith('__session='));
  return values.length === 1 && values[0].slice('__session='.length) === token;
}
function abortable(promise, signal) {
  if (signal?.aborted) return Promise.reject(new SessionRecoveryError('SESSION_RECOVERY_ABORTED'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new SessionRecoveryError('SESSION_RECOVERY_ABORTED'));
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
  });
}
export async function verifyFreshSession({ getToken, fetchImpl = fetch, readCookie,
  isCurrent = () => true, signal, now = () => Date.now(), cookieChecks = 11, cookieIntervalMs = 50 }) {
  if (typeof getToken !== 'function' || typeof readCookie !== 'function' || !Number.isInteger(cookieChecks) || cookieChecks < 1 || cookieChecks > 11 || cookieIntervalMs < 0 || cookieIntervalMs > 50) throw new TypeError('Explicit bounded recovery dependencies required');
  const current = () => { if (signal?.aborted || !isCurrent()) failure('SESSION_RECOVERY_ABORTED'); };
  let token = null;
  try {
    current();
    token = await abortable(getToken({ skipCache: true }), signal);
    current();
    if (!jwt(token)) failure('SESSION_RECOVERY_REQUIRED');
    const response = await abortable(fetchImpl('/api/identity/session', {
      method: 'GET', headers: { Authorization: 'Bearer ' + token },
      credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal,
    }), signal);
    current();
    if (response.status === 401) failure('SESSION_RECOVERY_REQUIRED');
    if (response.status === 503) failure('SESSION_RECOVERY_UNAVAILABLE');
    if (!response.ok) failure('SESSION_RECOVERY_UNAVAILABLE');
    const result = await abortable(response.json(), signal);
    current();
    if (result?.authenticated !== true || result.verification !== 'clerk-production-jwt' ||
        result.businessAccessEnabled !== false || !Number.isSafeInteger(result.expiresAt) || result.expiresAt <= Math.floor(now() / 1000)) failure('SESSION_RECOVERY_UNAVAILABLE');
    for (let attempt = 0; attempt < cookieChecks; attempt++) {
      current();
      if (sessionCookieMatches(readCookie(), token)) return { verified: true, cookieSynchronized: true };
      if (attempt + 1 < cookieChecks) await abortable(new Promise(resolve => setTimeout(resolve, cookieIntervalMs)), signal);
    }
    failure('SESSION_RECOVERY_COOKIE_PENDING');
  } catch (error) {
    if (error instanceof SessionRecoveryError) throw error;
    current();
    failure('SESSION_RECOVERY_UNAVAILABLE');
  } finally {
    token = null;
  }
}
