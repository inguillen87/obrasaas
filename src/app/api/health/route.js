import { identityConfig, sessionIdentityConfig } from '../../../lib/production-identity-config.mjs';
export const dynamic = 'force-dynamic';
export function GET() {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA;
  return Response.json({ service: 'ObraSaaS', availability: 'public-site-online', operationalAccess: 'restricted',
    release: 'authorized-workspace-20261001', sourceRevision: /^[a-f0-9]{40}$/.test(revision || '') ? revision : null,
    databaseChecked: false, workspaceAccess: 'signed-organization-and-canonical-membership-required',
    identityAuthentication: sessionIdentityConfig().configured ? 'public-session-verification-configured' : 'configuration-incomplete',
    identityManagement: identityConfig().configured ? 'configuration-present' : 'configuration-incomplete',
    identityProviderVerifiedByThisCheck: false },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}
