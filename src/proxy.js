import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { resolveClerkAuthorizedParties } from '@/lib/clerk-authorized-parties';
import { resolveRequestCorrelationId } from '@/lib/request-correlation';

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
  '/api/cash-funds',
  '/api/cash-movements',
  '/api/goods-receipts',
  '/api/purchase-orders',
  '/api/supplier-invoices',
  '/api/suppliers',
];

function isProtectedPathname(pathname) {
  return PROTECTED_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default clerkMiddleware(
  async (auth, request) => {
    if (isProtectedPathname(request.nextUrl.pathname)) await auth.protect();
    const response = NextResponse.next();
    response.headers.set('x-request-id', resolveRequestCorrelationId(request));
    return response;
  },
  {
    authorizedParties: resolveClerkAuthorizedParties(),
  },
);

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
    '/api/cash-funds/:path*',
    '/api/cash-movements/:path*',
    '/api/goods-receipts/:path*',
    '/api/purchase-orders/:path*',
    '/api/supplier-invoices/:path*',
    '/api/suppliers/:path*',
    '/__clerk/:path*',
  ],
};
