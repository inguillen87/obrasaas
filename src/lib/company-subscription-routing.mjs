// Exact entrypoints authenticate inside their own route handlers. The customer
// endpoint verifies a signed Clerk session; notifications require a provider
// HMAC capability before reconciliation. No identity prefix is made public.
export function companySubscriptionRoute(path,method) {
  return ['/api/identity/company-subscription','/api/identity/company-subscription/notifications'].includes(path) && ['GET','POST'].includes(method);
}
