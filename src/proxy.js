import { NextResponse } from 'next/server';
import { authorizeLegacyService, legacyBoundaryKind, privateLegacyHeaders, unauthorizedLegacyResponse } from './lib/legacy-access-boundary.js';
import { identityRoute, IDENTITY_ORIGIN } from './lib/production-identity-config.mjs';
const verifiedWorkspaceRoutes=new Set(['/api/identity/workspace','/api/identity/whatsapp-setup','/api/identity/site-register','/api/identity/site-photo','/api/identity/company-onboarding','/api/identity/company-channel','/api/identity/task-creation','/api/identity/site-purchases','/api/identity/participants','/api/identity/participant-join','/api/identity/worker-channel','/api/identity/field-operations','/api/identity/field-media','/api/identity/field-qr','/api/identity/meta-onboarding','/api/identity/operations-status','/api/identity/template-send','/api/identity/constructor-crm','/api/identity/demo-pilot','/api/identity/plan-import']);

export async function proxy(request) {
  const path = request.nextUrl.pathname;
  const workspaceRoute=verifiedWorkspaceRoutes.has(path)&&(path!=='/api/identity/plan-import'||['GET','POST'].includes(request.method));
  if (identityRoute(path) || workspaceRoute) {
    if (process.env.VERCEL_ENV === 'production' && request.nextUrl.origin !== IDENTITY_ORIGIN) {
      const destination = new URL(path, IDENTITY_ORIGIN);
      destination.search = request.nextUrl.search;
      return NextResponse.redirect(destination, 307);
    }
    // Each exact route verifies the signed session at its server boundary.
    // The workspace additionally checks canonical membership, project, and origin.
    const response = NextResponse.next();
    for (const [key,value] of Object.entries(privateLegacyHeaders())) response.headers.set(key,value);
    return response;
  }
  const kind = legacyBoundaryKind(path, request.method);
  if (kind === 'public') return NextResponse.next();
  if ((kind === 'private-api' || kind === 'private-page') && !authorizeLegacyService(request)) {
    if (kind === 'private-api') return unauthorizedLegacyResponse();
    const response = NextResponse.redirect(new URL('/sign-in', request.url), 307);
    for (const [key,value] of Object.entries(privateLegacyHeaders())) response.headers.set(key,value);
    return response;
  }
  const response = NextResponse.next();
  for (const [key,value] of Object.entries(privateLegacyHeaders())) response.headers.set(key,value);
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.svg|icon-512.svg).*)'] };
