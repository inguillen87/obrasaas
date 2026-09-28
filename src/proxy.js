import { NextResponse } from 'next/server';
import { authorizeLegacyService, legacyBoundaryKind, privateLegacyHeaders, unauthorizedLegacyResponse } from './lib/legacy-access-boundary.js';

export function proxy(request) {
  const kind = legacyBoundaryKind(request.nextUrl.pathname, request.method);
  if (kind === 'public') return NextResponse.next();
  if (kind === 'private-api' || kind === 'private-page') {
    if (!authorizeLegacyService(request)) {
      if (kind === 'private-api') return unauthorizedLegacyResponse();
      const target = new URL('/sign-in', request.url);
      const response = NextResponse.redirect(target, 307);
      for (const [key, value] of Object.entries(privateLegacyHeaders())) response.headers.set(key, value);
      return response;
    }
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(privateLegacyHeaders())) response.headers.set(key, value);
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.svg|icon-512.svg).*)'] };
