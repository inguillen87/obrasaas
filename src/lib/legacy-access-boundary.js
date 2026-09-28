import { createHash, timingSafeEqual } from 'node:crypto';

const INSECURE_KEYS = new Set(['internal', 'obrasaas_admin_key']);
export function exactSecretMatch(candidate, expected) {
  if (typeof candidate !== 'string' || typeof expected !== 'string' || !candidate || !expected || candidate.length > 8192) return false;
  return timingSafeEqual(createHash('sha256').update(candidate).digest(), createHash('sha256').update(expected).digest());
}
export function authorizeLegacyService(request, environment = process.env) {
  const secret = environment.INTERNAL_API_SECRET;
  if (typeof secret !== 'string' || !secret.trim() || INSECURE_KEYS.has(secret)) return false;
  const authorization = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  const bearer = authorization?.match(/^Bearer ([^\s,]+)$/i)?.[1];
  if (authorization !== null && !bearer) return false;
  if (bearer && apiKey && !exactSecretMatch(bearer, apiKey)) return false;
  const credential = bearer || apiKey;
  return !INSECURE_KEYS.has(credential) && exactSecretMatch(credential, secret);
}

const PUBLIC_PAGES = new Set(['/', '/sign-in', '/sign-up', '/pricing', '/poster', '/api-docs']);
const PUBLIC_ASSETS = new Set(['/sw.js', '/manifest.json', '/favicon.ico', '/icon-192.svg', '/icon-512.svg', '/robots.txt', '/sitemap.xml', '/bim_render.png', '/cctv_render.png', '/file.svg', '/globe.svg', '/next.svg', '/vercel.svg', '/window.svg']);
export function legacyBoundaryKind(pathname, method = 'GET') {
  const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const read = method === 'GET' || method === 'HEAD';
  if (read && (PUBLIC_PAGES.has(path) || PUBLIC_ASSETS.has(path) || path.startsWith('/_next/static/') || path === '/_next/image')) return 'public';
  if (read && path === '/api/health') return 'public-api';
  // These entrypoints validate their own signed protocols; no browser role or
  // Origin/Referer header is an identity. All other legacy APIs are internal.
  if (path === '/api/whatsapp' && ['GET', 'POST'].includes(method)) return 'signed-protocol';
  if (read && path === '/api/auth/verify') return 'signed-protocol';
  return path === '/api' || path.startsWith('/api/') || !read ? 'private-api' : 'private-page';
}
export function privateLegacyHeaders() {
  return { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Authorization, X-Api-Key, Cookie',
    'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow, noarchive' };
}
export function unauthorizedLegacyResponse() {
  return Response.json({ error: 'Se requiere acceso verificado para esta operación.', code: 'AUTHENTICATION_REQUIRED' },
    { status: 401, headers: privateLegacyHeaders() });
}
