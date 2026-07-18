const CANONICAL_PRODUCTION_ORIGIN = 'https://obrasaas.vercel.app';
const CANONICAL_PREVIEW_ORIGIN = 'https://obrasaas-preview.vercel.app';

function normalizeOrigin(value, { strict = false } = {}) {
  const candidate = String(value || '').trim();
  if (!candidate) return null;

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    if (url.username || url.password) throw new Error('credentials are not allowed');
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('only origins are allowed');
    }
    return url.origin;
  } catch (error) {
    if (strict) {
      throw new Error(`Invalid Clerk authorized party origin: ${candidate}`, { cause: error });
    }
    return null;
  }
}

function configuredOrigins(value) {
  return String(value || '')
    .split(',')
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .map((candidate) => normalizeOrigin(candidate, { strict: true }));
}

export function resolveClerkAuthorizedParties(environment = process.env) {
  const origins = new Set(configuredOrigins(environment.CLERK_AUTHORIZED_PARTIES));
  const add = (value) => {
    const origin = normalizeOrigin(value);
    if (origin) origins.add(origin);
  };

  const vercelEnvironment = environment.VERCEL_ENV || null;
  if (vercelEnvironment === 'production') {
    add(CANONICAL_PRODUCTION_ORIGIN);
    add(environment.NEXT_PUBLIC_APP_URL);
    add(environment.VERCEL_PROJECT_PRODUCTION_URL);
    add(environment.VERCEL_URL);
  } else if (vercelEnvironment === 'preview') {
    add(CANONICAL_PREVIEW_ORIGIN);
    add(environment.VERCEL_URL);
  } else {
    add(environment.NEXT_PUBLIC_APP_URL);
    add(environment.VERCEL_URL);
    add('http://localhost:3000');
    add('http://127.0.0.1:3000');
    add('http://localhost:3100');
    add('http://127.0.0.1:3100');
  }

  if (origins.size === 0) add(CANONICAL_PRODUCTION_ORIGIN);
  return [...origins];
}

export { CANONICAL_PREVIEW_ORIGIN, CANONICAL_PRODUCTION_ORIGIN };
