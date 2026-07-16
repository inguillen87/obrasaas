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
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
