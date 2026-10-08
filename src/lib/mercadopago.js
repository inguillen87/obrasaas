// The legacy singleton checkout is retired. Canonical merchant integration
// requires an authorized catalog, durable company attempts and verified receipts.
export const PLAN_CONFIGS=Object.freeze({});
export async function createCheckoutPreference(){
  throw Object.assign(new Error('BILLING_ROUTE_RETIRED'),{code:'BILLING_ROUTE_RETIRED',status:410});
}
