import { clerkMiddleware } from '@clerk/nextjs/server';

const PROTECTED_ROUTE_ROOTS = [
  '/dashboard',
  '/superadmin',
  '/presupuesto',
  '/session-tasks',
  '/api/ai',
  '/api/billing',
  '/api/evidence',
  '/api/field',
  '/api/integrations',
  '/api/operational-proposals',
  '/api/projects',
  '/api/reports',
  '/api/state',
  '/api/superadmin',
  '/api/tenant',
  '/api/whatsapp',
];

function isProtectedPathname(pathname) {
  return PROTECTED_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedPathname(request.nextUrl.pathname)) await auth.protect();
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/superadmin/:path*',
    '/presupuesto/:path*',
    '/session-tasks/:path*',
    '/sign-in/:path*',
    '/sign-up/:path*',
    '/api/ai/:path*',
    '/api/billing/:path*',
    '/api/evidence/:path*',
    '/api/field/:path*',
    '/api/integrations/:path*',
    '/api/operational-proposals/:path*',
    '/api/projects/:path*',
    '/api/reports/:path*',
    '/api/state/:path*',
    '/api/superadmin/:path*',
    '/api/tenant/:path*',
    '/api/whatsapp/:path*',
    '/__clerk/:path*',
  ],
};
