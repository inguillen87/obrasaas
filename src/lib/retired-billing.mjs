// Old singleton billing never belonged to the canonical customer organization.
// Retire it even for internal callers; no redirect or callback can grant a plan.
export function retiredBillingResponse(){
  return Response.json({code:'BILLING_ROUTE_RETIRED',message:'Consultá el plan de tu empresa en Mi cuenta.',accountPath:'/cuenta'},
    {status:410,headers:{'Cache-Control':'private, no-store, max-age=0','Vary':'Authorization, X-Api-Key, Cookie','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive'}});
}
