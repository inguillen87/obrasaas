import {approvedSubscriptionConfiguration,approvedSubscriptionOffer,SUBSCRIPTION_OFFER_FIELDS} from './company-subscription-policy.mjs';
import {approvedCommercialCatalog,commercialOfferSnapshot,defaultCommercialCatalog} from './company-subscription-catalog.mjs';
import {IDENTITY_ORIGIN} from './production-identity-config.mjs';

const productionCompanyRuntime=environment=>environment!==null&&typeof environment==='object'&&!Array.isArray(environment)&&environment.VERCEL_ENV==='production'&&environment.VERCEL_PROJECT_ID==='prj_68NErbCqCFsDVaMak81gcwsGI9pF'&&environment.NEXT_PUBLIC_APP_URL===IDENTITY_ORIGIN&&(!environment.VERCEL_TARGET_ENV||environment.VERCEL_TARGET_ENV==='production');
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(value);
const boundedJson=(value,limit)=>{
  if(typeof value!=='string'||value.length===0||!value.isWellFormed()||Buffer.byteLength(value,'utf8')>limit)throw new TypeError('Bounded private catalog required');
  return JSON.parse(value);
};

// The approval references point to the operator-reviewed commercial dossier;
// strings alone do not verify a provider contract, funding or identity service.
// This process/deployment snapshot is independent from financial configuration
// so closing a commercial offer does not erase or disable older attempts.
export function companyCommercialRuntimeCatalog(environment={}){
  const closed=defaultCommercialCatalog;
  if(!productionCompanyRuntime(environment)||environment.OBRASAAS_COMPANY_COMMERCIAL_RELEASE!=='company-commercial-v1')return closed();
  try{
    const catalog=approvedCommercialCatalog(boundedJson(environment.OBRASAAS_COMPANY_COMMERCIAL_CATALOG,131072));
    const approval=boundedJson(environment.OBRASAAS_COMPANY_COMMERCIAL_APPROVAL,4096);
    if(!approval||typeof approval!=='object'||Array.isArray(approval)||Object.keys(approval).sort().join('|')!==['version','catalogDigest','approvalReference','fundingEvidenceReference'].sort().join('|')||approval.version!==1||approval.catalogDigest!==catalog.catalogDigest||!reference(approval.approvalReference)||!reference(approval.fundingEvidenceReference)||catalog.state!=='READY'||catalog.catalogVersion===closed().catalogVersion)return closed();
    for(const offer of catalog.offers){
      // Share the financial schema without inventing a merchant. Also respect
      // the current adapter's exact decimal/minor-unit ceiling before READY.
      approvedSubscriptionOffer(Object.fromEntries(SUBSCRIPTION_OFFER_FIELDS.map(key=>[key,offer[key]])));
      if(!/^[1-9][0-9]{0,12}$/.test(offer.amountMinor)||BigInt(offer.amountMinor)>1000000000000n)return closed();
    }
    // Keep the raw input schema. The store derives state and digests itself;
    // passing the normalized catalog back would correctly reject extra fields.
    return Object.freeze({version:1,catalogVersion:catalog.catalogVersion,offers:Object.freeze(catalog.offers.map(commercialOfferSnapshot))});
  }catch{return closed();}
}

// Runtime release is separate from having a legacy financial SDK or token.
// An unset/partial catalog never invents an ARS conversion, tax treatment,
// merchant, approved usage package or recurring financial agreement.
export function companySubscriptionRuntimeConfiguration(environment={}){
  const closed=()=>({catalog:null,providerConfig:{}});
  if(!productionCompanyRuntime(environment))return closed();
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
