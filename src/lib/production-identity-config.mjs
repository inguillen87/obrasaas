export const IDENTITY_ORIGIN = 'https://obrasaas.com';
export const IDENTITY_INSTANCE = 'ins_3JyUDcOoJ4VPW8D75Dkzzyc6J0m';
export const IDENTITY_PUBLIC_KEY = 'pk_live_Y2xlcmsub2JyYXNhYXMuY29tJA';
export function identityRoute(pathname) {
  return /^\/(sign-in|sign-up)(\/.*)?$/.test(pathname) || pathname === '/cuenta' || pathname === '/cuenta/';
}
export function identityConfig(environment = process.env) {
  const errors = [];
  if (environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== IDENTITY_PUBLIC_KEY) errors.push('IDENTITY_PUBLIC_KEY_MISMATCH');
  if (!/^sk_live_[A-Za-z0-9_-]{20,}$/.test(environment.CLERK_SECRET_KEY || '')) errors.push('IDENTITY_PRIVATE_KEY_REQUIRED');
  if (environment.CLERK_EXPECTED_INSTANCE_ID !== IDENTITY_INSTANCE) errors.push('IDENTITY_INSTANCE_MISMATCH');
  if (environment.NEXT_PUBLIC_APP_URL !== IDENTITY_ORIGIN) errors.push('IDENTITY_ORIGIN_MISMATCH');
  const parties = (environment.CLERK_AUTHORIZED_PARTIES || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (parties.length !== 1 || parties[0] !== IDENTITY_ORIGIN) errors.push('IDENTITY_PARTIES_MISMATCH');
  return { configured: errors.length === 0, errors, origin: IDENTITY_ORIGIN,
    publishableKey: IDENTITY_PUBLIC_KEY, instanceId: IDENTITY_INSTANCE,
    authorizedParties: [IDENTITY_ORIGIN], businessAccessEnabled: false };
}
// A verified identity is not an authorization to the aggregate legacy database.
export function accountAccess(authResult) {
  return Boolean(authResult && authResult.isAuthenticated === true &&
    typeof authResult.userId === 'string' && /^user_[A-Za-z0-9]+$/.test(authResult.userId));
}
