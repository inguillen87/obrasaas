import assert from 'node:assert/strict';
import {approvedCommercialCatalog,defaultCommercialCatalog} from '../../src/lib/company-subscription-catalog.mjs';

const endpoint = '/api/identity/company-subscription';
const scopePattern = /^[a-f0-9]{64}$/;

// Synthetic browser fixtures only. The server's pending commercial catalogue
// is informative; this fixture never grants acceptance, checkout or paid access.
export function closedCompanySubscriptionFixture({scope,observedAt = new Date().toISOString()} = {}) {
  assert.match(scope,scopePattern,'Explicit synthetic company scope');
  assert.equal(new Date(observedAt).toISOString(),observedAt,'Explicit fixture observation instant');
  const catalog = approvedCommercialCatalog(defaultCommercialCatalog());
  return {
    version:2,scope,
    organization:{id:`org_subscription_fixture_${scope.slice(0,16)}`,name:'Empresa de ensayo sin cobro habilitado'},
    observedAt,
    configuration:{state:'CONFIGURATION_PENDING',catalogVersion:null,offers:[]},
    subscription:{plan:'TRIAL',status:'TRIALING',trialEndsAt:null,entitlement:{allowed:false,basis:null,reasonCode:'COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'}},
    attempt:null,recovery:null,acceptance:null,
    commercial:{...catalog,actorBinding:'f'.repeat(64),offers:catalog.offers.map(offer => ({...offer,canAccept:false,checkoutAvailable:false}))},
  };
}

// Matching is deliberately narrow: every other API still reaches the calling
// harness's original unexpected-request assertion. Matching malformed requests
// fail instead of receiving a permissive stub.
export async function respondClosedCompanySubscription(request,{origin,scope,authorization,allowed,reads} = {}) {
  const url = new URL(request.url());
  if (url.pathname !== endpoint) return false;
  assert.equal(allowed,true,'Company subscription consult requires an explicit administrator fixture');
  assert.match(origin,/^http:\/\/127\.0\.0\.1:[0-9]{4,5}$/,'Only the local synthetic browser origin');
  const port = Number(new URL(origin).port);
  assert.ok(port >= 3000 && port <= 65535,'Only the local synthetic browser port');
  assert.equal(url.origin,origin,'No external subscription requests');
  assert.equal(url.username + url.password + url.hash,'','Synthetic consult URL has no credentials or fragment');
  assert.equal(request.method(),'GET','Synthetic status consult never accepts financial commands');
  assert.equal(request.postData() ?? '', '', 'Synthetic status consult has no request body');
  assert.match(scope,scopePattern,'Explicit active company scope');
  assert.deepEqual([...url.searchParams.keys()],['scope'],'Status consult accepts only one company scope');
  assert.equal(url.searchParams.get('scope'),scope,'Subscription status must match the active company');
  assert.match(authorization,/^Bearer synthetic-[A-Za-z0-9-]+$/,'Only an explicit synthetic session token');
  assert.equal(request.headers().authorization,authorization,'Subscription status must match the active session');
  assert.ok(Array.isArray(reads),'Recognized subscription consults need their own fixture read journal');
  reads.push({method:'GET',path:endpoint,scope});
  await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(closedCompanySubscriptionFixture({scope}))});
  return true;
}
