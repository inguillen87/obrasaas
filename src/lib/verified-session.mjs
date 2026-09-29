import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { sessionIdentityConfig, IDENTITY_JWKS_URL, IDENTITY_ISSUER, IDENTITY_ORIGIN } from './production-identity-config.mjs';

const MAX_TOKEN_LENGTH = 8192;
// A fixed HTTPS issuer and JOSE's rotating-key cache. No URL, key or algorithm
// supplied in an incoming JWT can change the key source.
const productionKeys = createRemoteJWKSet(new URL(IDENTITY_JWKS_URL), {
  timeoutDuration: 5000, cooldownDuration: 10000, cacheMaxAge: 300000,
});
const denied = code => ({ authenticated: false, code, businessAccessEnabled: false });
export function sessionTokenFromHeaders(headers) {
  const authorization = headers.get('authorization');
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(authorization);
    return match && match[1].length <= MAX_TOKEN_LENGTH ? match[1] : null;
  }
  const cookie = headers.get('cookie') || '';
  if (cookie.length > 65536) return null;
  const tokens = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith('__session='));
  if (tokens.length !== 1) return null;
  const token = tokens[0].slice('__session='.length);
  return token.length <= MAX_TOKEN_LENGTH && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) ? token : null;
}
export function createSessionVerifier(keyResolver, { now = () => new Date() } = {}) {
  if (typeof keyResolver !== 'function') throw new TypeError('An explicit trusted key resolver is required');
  return async function verify(headers, environment = process.env) {
    const config = sessionIdentityConfig(environment);
    if (!config.configured) return denied('IDENTITY_CONFIGURATION_PENDING');
    const token = sessionTokenFromHeaders(headers);
    if (!token) return denied('SESSION_REQUIRED');
    try {
      const header = decodeProtectedHeader(token);
      if (header.alg !== 'RS256' || header.typ !== 'JWT' || typeof header.kid !== 'string' ||
          header.kid.length > 160 || !/^[A-Za-z0-9_-]+$/.test(header.kid) ||
          ['jku','jwk','x5u','x5c','crit','b64'].some(key => Object.hasOwn(header,key))) return denied('SESSION_INVALID');
      const {payload} = await jwtVerify(token, keyResolver, {
        algorithms: ['RS256'], issuer: IDENTITY_ISSUER, typ: 'JWT',
        requiredClaims: ['iss','sub','sid','azp','iat','nbf','exp'],
        clockTolerance: 5, maxTokenAge: '5m', currentDate: now(),
      });
      if (payload.aud !== undefined || payload.azp !== IDENTITY_ORIGIN || !/^user_[A-Za-z0-9]+$/.test(payload.sub) ||
          typeof payload.sid !== 'string' || !/^sess_[A-Za-z0-9]+$/.test(payload.sid) ||
          !Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp) || !Number.isSafeInteger(payload.nbf) ||
          payload.exp <= payload.iat || payload.exp - payload.iat > 300 || payload.nbf > payload.exp ||
          (payload.sts !== undefined && payload.sts !== 'active') ||
          (payload.v !== undefined && ![1,2].includes(payload.v))) return denied('SESSION_INVALID');
      return { authenticated: true, userId: payload.sub, sessionId: payload.sid,
        expiresAt: payload.exp, verification: 'clerk-production-jwt', businessAccessEnabled: false };
    } catch (error) {
      const unavailable = ['ERR_JWKS_TIMEOUT','ERR_JWKS_INVALID','ECONNRESET','ENOTFOUND','ETIMEDOUT'].includes(error?.code) ||
        (error?.code === 'ERR_JOSE_GENERIC' && /JSON Web Key Set HTTP response/.test(error.message || ''));
      return denied(unavailable ? 'IDENTITY_PROVIDER_UNAVAILABLE' : 'SESSION_INVALID');
    }
  };
}
export const verifyProductionSession = createSessionVerifier(productionKeys);
export async function sessionCheckResponse(request, verify = verifyProductionSession) {
  const result = await verify(request.headers);
  const code = result.authenticated ? 200 : ['IDENTITY_CONFIGURATION_PENDING','IDENTITY_PROVIDER_UNAVAILABLE'].includes(result.code) ? 503 : 401;
  // No raw claims, identifiers, tokens, roles or personal data are returned.
  return Response.json(result.authenticated
    ? {authenticated:true,verification:result.verification,expiresAt:result.expiresAt,businessAccessEnabled:false}
    : {authenticated:false,code:result.code,businessAccessEnabled:false}, {
      status:code,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Cookie, Authorization',
        'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'},
    });
}
