import { NextResponse } from 'next/server';
import { authorizeLegacyService, legacyBoundaryKind, privateLegacyHeaders, unauthorizedLegacyResponse } from './lib/legacy-access-boundary.js';
import { identityRoute, IDENTITY_ORIGIN } from './lib/production-identity-config.mjs';

export async function proxy(request) {
  const path = request.nextUrl.pathname;
  if (identityRoute(path)) {
    if (process.env.VERCEL_ENV === 'production' && request.nextUrl.origin !== IDENTITY_ORIGIN) {
      const destination = new URL(path, IDENTITY_ORIGIN);
      destination.search = request.nextUrl.search;
      return NextResponse.redirect(destination, 307);
    }
    // Identity pages and the read-only session endpoint verify the actual JWT
    // at their server boundary. No client-supplied Clerk headers grant access.
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
