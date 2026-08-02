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
  '/api/attendance',
  '/api/billing',
  '/api/budget-entries',
  '/api/budgets',
  '/api/cash-funds',
  '/api/cash-movements',
  '/api/evidence',
  '/api/execution',
  '/api/extra-work',
  '/api/field',
  '/api/goods-receipt-inspections',
  '/api/goods-receipt-commitment-allocations',
  '/api/goods-receipts',
  '/api/integrations',
  '/api/inventory-locations',
  '/api/notifications',
  '/api/operational-proposals',
  '/api/progress',
  '/api/projects',
  '/api/purchase-orders',
  '/api/replan-scenarios',
  '/api/reports',
  '/api/schedule',
  '/api/start-acts',
  '/api/state',
  '/api/superadmin',
  '/api/supplier-invoices',
  '/api/supplier-commitment-line-closures',
  '/api/supplier-commitments',
  '/api/suppliers',
  '/api/tasks',
  '/api/tenant',
  '/api/whatsapp',
  '/api/worker-documents',
  '/api/worker-onboarding',
];

export function isProtectedPathname(pathname) {
  return PROTECTED_ROUTE_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default clerkMiddleware(
  async (auth, request) => {
    if (isProtectedPathname(request.nextUrl.pathname)) await auth.protect();
    const correlationId = resolveRequestCorrelationId(request);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', correlationId);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('x-request-id', correlationId);
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
    '/api/attendance/:path*',
    '/api/billing/:path*',
    '/api/budget-entries/:path*',
    '/api/budgets/:path*',
    '/api/cash-funds/:path*',
    '/api/cash-movements/:path*',
    '/api/evidence/:path*',
    '/api/execution/:path*',
    '/api/extra-work/:path*',
    '/api/field/:path*',
    '/api/goods-receipt-inspections/:path*',
    '/api/goods-receipt-commitment-allocations/:path*',
    '/api/goods-receipts/:path*',
    '/api/integrations/:path*',
    '/api/inventory-locations/:path*',
    '/api/notifications/:path*',
    '/api/operational-proposals/:path*',
    '/api/progress/:path*',
    '/api/projects/:path*',
    '/api/purchase-orders/:path*',
    '/api/replan-scenarios/:path*',
    '/api/reports/:path*',
    '/api/schedule/:path*',
    '/api/start-acts/:path*',
    '/api/state/:path*',
    '/api/superadmin/:path*',
    '/api/supplier-invoices/:path*',
    '/api/supplier-commitment-line-closures/:path*',
    '/api/supplier-commitments/:path*',
    '/api/suppliers/:path*',
    '/api/tasks/:path*',
    '/api/tenant/:path*',
    '/api/whatsapp/:path*',
    '/api/worker-documents/:path*',
    '/api/worker-onboarding/:path*',
    '/__clerk/:path*',
  ],
};
