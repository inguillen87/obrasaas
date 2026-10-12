import test from 'node:test';
import assert from 'node:assert/strict';
import {companySubscriptionDisposableUrl} from '../scripts/verify-company-subscription-postgres.mjs';
const local={CUTOVER_TEST_DISPOSABLE:'1',CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'};
test('subscription integration harness permits only explicitly marked disposable local PostgreSQL targets',()=>{
  assert.equal(companySubscriptionDisposableUrl(local).pathname,'/obrasaas_cutover_ci');
  assert.equal(companySubscriptionDisposableUrl({...local,CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci'}).hostname,'127.0.0.1');
  for(const patch of [{CUTOVER_TEST_DISPOSABLE:undefined},{CUTOVER_TEST_DISPOSABLE:'true'},{VERCEL:'1'},{VERCEL_ENV:'production'},{VERCEL_TARGET_ENV:'preview'},{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@ep-private.neon.tech/obrasaas_cutover_ci'},{CUTOVER_TEST_DATABASE_URL:'postgresql://postgres@127.0.0.1:6549/obrasaas_cutover_ci'},{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6549/production'},{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test:cutover_test@127.0.0.1:6549/obrasaas_cutover_ci'},{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6549/obrasaas_cutover_ci?sslmode=require'},{CUTOVER_TEST_DATABASE_URL:'https://127.0.0.1:6549/obrasaas_cutover_ci'},{CUTOVER_TEST_DATABASE_URL:'postgresql://cutover_test@127.0.0.1:6548/obrasaas_cutover_ci'}])assert.throws(()=>companySubscriptionDisposableUrl({...local,...patch}),{code:'COMPANY_SUBSCRIPTION_DISPOSABLE_TARGET_REJECTED'});
});
