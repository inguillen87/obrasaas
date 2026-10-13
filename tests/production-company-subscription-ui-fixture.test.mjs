import assert from 'node:assert/strict';
import test from 'node:test';
import {closedCompanySubscriptionFixture,respondClosedCompanySubscription} from '../scripts/lib/company-subscription-ui-fixture.mjs';
import {companySubscriptionView} from '../src/app/(identity)/cuenta/company-subscription-view.mjs';

const scope = 'a'.repeat(64), otherScope = 'b'.repeat(64), origin = 'http://127.0.0.1:3108';
const context = {origin,scope,authorization:'Bearer synthetic-active-tab-A',allowed:true,reads:[]};
function intercepted({url = `${origin}/api/identity/company-subscription?scope=${scope}`,method = 'GET',authorization = context.authorization,body} = {}) {
  const responses = [];
  return {responses,url:() => url,method:() => method,headers:() => ({authorization}),postData:() => body,respond:async value => {responses.push(value);}};
}

test('closed synthetic envelope satisfies the actual strict view with no payment or action',() => {
  const envelope = closedCompanySubscriptionFixture({scope,observedAt:'2026-10-12T12:00:00.000Z'});
  const view = companySubscriptionView(envelope,{scope});
  assert.equal(view.configurationReady,false);
  assert.deepEqual(view.offers.map(offer => offer.priceLabel),['USD 149,00','USD 349,00']);
  assert.ok(view.offers.every(offer => offer.canAccept === false && offer.termsText === null));
  assert.equal(view.canBegin,false);
  assert.equal(view.canCancel,false);
  assert.equal(view.attempt,null);
  assert.equal(view.recovery,null);
  assert.equal(envelope.subscription.entitlement.allowed,false);
  assert.equal(view.paymentLabel,'Todavía no hay un pago confirmado.');
});

test('only the explicit administrator scope and synthetic token receive a closed GET response',async () => {
  const request = intercepted(), reads = [];
  assert.equal(await respondClosedCompanySubscription(request,{...context,reads}),true);
  assert.deepEqual(reads,[{method:'GET',path:'/api/identity/company-subscription',scope}]);
  assert.equal(request.responses.length,1);
  assert.equal(request.responses[0].status,200);
  assert.equal(request.responses[0].headers['Cache-Control'],'private, no-store');
  const envelope = JSON.parse(request.responses[0].body);
  assert.equal(envelope.scope,scope);
  assert.equal(envelope.configuration.state,'CONFIGURATION_PENDING');
  assert.equal(companySubscriptionView(envelope,{scope}).canBegin,false);
});

test('unrelated APIs remain unhandled for the original strict allowlist',async () => {
  for (const path of ['/api/identity/workspace','/api/identity/payments','/api/identity/company-subscription/other']) {
    const request = intercepted({url:origin + path});
    assert.equal(await respondClosedCompanySubscription(request,{}),false);
    assert.deepEqual(request.responses,[]);
  }
});

test('financial commands, foreign scope or session, extra parameters and unauthorized mounts fail closed',async () => {
  const cases = [
    [intercepted(),{...context,allowed:false}],
    [intercepted({method:'POST',body:'{"action":"begin"}'}),context],
    [intercepted({method:'PUT'}),context],
    [intercepted({body:'{}'}),context],
    [intercepted({url:`${origin}/api/identity/company-subscription?scope=${otherScope}`}),context],
    [intercepted({authorization:'Bearer synthetic-active-tab-B'}),context],
    [intercepted(),{...context,authorization:'Bearer actual-account-token'}],
    [intercepted({url:`${origin}/api/identity/company-subscription?scope=${scope}&scope=${scope}`}),context],
    [intercepted({url:`${origin}/api/identity/company-subscription?scope=${scope}&operationId=synthetic`}),context],
    [intercepted({url:`${origin}/api/identity/company-subscription?scope=${scope}&amountMinor=14900`}),context],
    [intercepted({url:`${origin}/api/identity/company-subscription`}),context],
    [intercepted({url:`https://api.mercadopago.com/api/identity/company-subscription?scope=${scope}`}),context],
    [intercepted({url:`http://user:pass@127.0.0.1:3108/api/identity/company-subscription?scope=${scope}`}),context],
    [intercepted({url:`${origin}/api/identity/company-subscription?scope=${scope}#unexpected`}),context],
    [intercepted(),{...context,origin:'https://example.com'}],
    [intercepted(),{...context,reads:undefined}],
  ];
  for (const [request,options] of cases) {
    const reads = [];
    await assert.rejects(respondClosedCompanySubscription(request,{...options,reads:options.reads === undefined ? undefined : reads}));
    assert.deepEqual(request.responses,[]);
    assert.deepEqual(reads,[]);
  }
});

test('switching companies explicitly binds the response to the new token and scope',async () => {
  const request = intercepted({url:`${origin}/api/identity/company-subscription?scope=${otherScope}`,authorization:'Bearer synthetic-active-tab-B'});
  assert.equal(await respondClosedCompanySubscription(request,{...context,scope:otherScope,authorization:'Bearer synthetic-active-tab-B'}),true);
  const envelope = JSON.parse(request.responses[0].body);
  assert.equal(envelope.scope,otherScope);
  assert.notEqual(envelope.organization.id,closedCompanySubscriptionFixture({scope}).organization.id);
  assert.throws(() => companySubscriptionView(envelope,{scope}),{code:'WORKSPACE_CONTEXT_CHANGED'});
});
