import { identityConfig, sessionIdentityConfig } from '../../../lib/production-identity-config.mjs';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ service: 'ObraSaaS', availability: 'public-site-online', operationalAccess: 'restricted',
    release: 'production-boundary-20260928', databaseChecked: false,
    identityAuthentication: sessionIdentityConfig().configured ? 'public-session-verification-configured' : 'configuration-incomplete',
    identityManagement: identityConfig().configured ? 'configuration-present' : 'configuration-incomplete',
    identityProviderVerifiedByThisCheck: false },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
