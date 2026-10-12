import test from 'node:test';
import assert from 'node:assert/strict';
import {companySubscriptionRoute} from '../src/lib/company-subscription-routing.mjs';

test('only the two exact signed subscription entrypoints reach route authentication',()=>{
  for(const path of ['/api/identity/company-subscription','/api/identity/company-subscription/notifications']) {
    for(const method of ['GET','POST']) assert.equal(companySubscriptionRoute(path,method),true);
    for(const method of ['HEAD','PUT','DELETE','PATCH','OPTIONS','post',null]) assert.equal(companySubscriptionRoute(path,method),false);
  }
  for(const path of ['/api/identity/company-subscription/','/api/identity/company-subscription/notifications/','/api/identity/company-subscription/notifications/other','/api/identity/company-subscriptions','/api/identity/company-subscription/notifications%2Fother','/api/identity/unknown','/api/billing/checkout','/api/billing/webhook']) {
    assert.equal(companySubscriptionRoute(path,'GET'),false);assert.equal(companySubscriptionRoute(path,'POST'),false);
  }
});
