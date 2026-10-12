import {approvedSubscriptionConfiguration} from './company-subscription-policy.mjs';
import {IDENTITY_ORIGIN} from './production-identity-config.mjs';

// Runtime release is separate from having a legacy financial SDK or token.
// An unset/partial catalog never invents an ARS conversion, tax treatment,
// merchant, approved usage package or recurring financial agreement.
export function companySubscriptionRuntimeConfiguration(environment={}){
  const closed=()=>({catalog:null,providerConfig:{}});
  if(environment.VERCEL_ENV!=='production'||environment.VERCEL_PROJECT_ID!=='prj_68NErbCqCFsDVaMak81gcwsGI9pF'||environment.NEXT_PUBLIC_APP_URL!==IDENTITY_ORIGIN||environment.VERCEL_TARGET_ENV&&environment.VERCEL_TARGET_ENV!=='production')return closed();
  if(environment.OBRASAAS_COMPANY_SUBSCRIPTION_RELEASE!=='company-subscription-v1')return closed();
  const raw=environment.OBRASAAS_COMPANY_SUBSCRIPTION_CATALOG;
  if(typeof raw!=='string'||raw.length===0||raw.length>16384)return closed();
  let catalog;try{catalog=approvedSubscriptionConfiguration(JSON.parse(raw));}catch{return closed();}
  if(!catalog||catalog.provider!=='MERCADO_PAGO'||catalog.accountMode!=='LIVE'||!/^\d{1,20}$/.test(catalog.merchantId))return closed();
  const currency=environment.MERCADOPAGO_SUBSCRIPTION_CURRENCY;
  if(!['ARS','USD'].includes(currency)||catalog.offers.some(offer=>offer.currency!==currency))return closed();
  if(environment.MERCADOPAGO_SUBSCRIPTION_MERCHANT_ID!==catalog.merchantId)return closed();
  const providerConfig={accessToken:environment.MERCADOPAGO_ACCESS_TOKEN,
    merchantId:catalog.merchantId,accountMode:'LIVE',currency,
    checkoutHost:environment.MERCADOPAGO_SUBSCRIPTION_CHECKOUT_HOST,
    webhookSecret:environment.MERCADOPAGO_SUBSCRIPTION_WEBHOOK_SECRET,
    backUrl:'https://obrasaas.com/cuenta',
    notificationUrl:'https://obrasaas.com/api/identity/company-subscription/notifications'};
  return {catalog,providerConfig};
}
