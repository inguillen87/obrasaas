import assert from 'node:assert/strict';
import test from 'node:test';
import {companySubscriptionRuntimeConfiguration} from '../src/lib/company-subscription-runtime-config.mjs';
const offer={id:'pro-offer',plan:'PRO',amountMinor:'14900',currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:'Precio final confirmado',termsVersion:'terms-v1',includesAllIn:true,automaticExtras:false};
const catalog={version:1,provider:'MERCADO_PAGO',merchantId:'123456',accountMode:'LIVE',catalogVersion:'catalog-v1',offers:[offer]};
const environment={VERCEL_ENV:'production',VERCEL_PROJECT_ID:'prj_68NErbCqCFsDVaMak81gcwsGI9pF',NEXT_PUBLIC_APP_URL:'https://obrasaas.com',OBRASAAS_COMPANY_SUBSCRIPTION_RELEASE:'company-subscription-v1',OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:JSON.stringify(catalog),MERCADOPAGO_SUBSCRIPTION_MERCHANT_ID:'123456',MERCADOPAGO_SUBSCRIPTION_CURRENCY:'USD',MERCADOPAGO_SUBSCRIPTION_CHECKOUT_HOST:'www.mercadopago.com.ar',MERCADOPAGO_ACCESS_TOKEN:'synthetic-access-token-for-config-test',MERCADOPAGO_SUBSCRIPTION_WEBHOOK_SECRET:'synthetic-webhook-secret-for-config-test'};
test('legacy SDK or token alone never releases company purchases',()=>{
  for(const value of [{},{MERCADOPAGO_ACCESS_TOKEN:'synthetic-token'},{...environment,OBRASAAS_COMPANY_SUBSCRIPTION_RELEASE:'true'},{...environment,OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:''}])assert.deepEqual(companySubscriptionRuntimeConfiguration(value),{catalog:null,providerConfig:{}});
});
test('merchant, account mode, malformed catalog and mismatched currency close runtime before provider composition',()=>{
  for(const patch of [{MERCADOPAGO_SUBSCRIPTION_MERCHANT_ID:'654321'},{MERCADOPAGO_SUBSCRIPTION_CURRENCY:'ARS'},{OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:'{'},{OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:' '.repeat(16385)},{OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:JSON.stringify({...catalog,accountMode:'TEST'})},{OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG:JSON.stringify({...catalog,offers:[{...offer,automaticExtras:true}]})}])assert.deepEqual(companySubscriptionRuntimeConfiguration({...environment,...patch}),{catalog:null,providerConfig:{}});
});
test('explicit server offer preserves exact charge and fixed return/notification origins',()=>{
  const value=companySubscriptionRuntimeConfiguration(environment);
  assert.deepEqual(value.catalog,catalog);assert.equal(value.providerConfig.merchantId,'123456');assert.equal(value.providerConfig.currency,'USD');
  assert.equal(value.providerConfig.accountMode,'LIVE');assert.equal(value.providerConfig.backUrl,'https://obrasaas.com/cuenta');
  assert.equal(value.providerConfig.notificationUrl,'https://obrasaas.com/api/identity/company-subscription/notifications');
  assert.equal(value.catalog.offers[0].amountMinor,'14900');assert.equal(Object.hasOwn(value.catalog,'accessToken'),false);
});
test('live credentials cannot release local, preview or a different production project',()=>{
  for(const patch of [{VERCEL_ENV:undefined},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{VERCEL_PROJECT_ID:undefined},{VERCEL_PROJECT_ID:'another-project'},{NEXT_PUBLIC_APP_URL:'https://preview.example.invalid'},{NEXT_PUBLIC_APP_URL:undefined},{VERCEL_TARGET_ENV:'preview'}])assert.deepEqual(companySubscriptionRuntimeConfiguration({...environment,...patch}),{catalog:null,providerConfig:{}});
  assert.deepEqual(companySubscriptionRuntimeConfiguration({...environment,VERCEL_TARGET_ENV:'production'}).catalog,catalog);
});
