import {WorkspaceError,digest,operationId,workspaceId} from './workspace-policy.mjs';

const fail=(code='COMPANY_SUBSCRIPTION_INPUT_INVALID',status=400)=>{throw new WorkspaceError(code,status);};
export const subscriptionRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const stable=value=>Array.isArray(value)?value.map(stable):subscriptionRecord(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const subscriptionContractDigest=value=>digest(stable(value));
const exact=(value,keys)=>subscriptionRecord(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(value);
const label=value=>typeof value==='string'&&value.trim()===value&&value.length>0&&value.length<=160&&!/[\u0000-\u001f\u007f<>]/.test(value);
export const minorUnits=value=>typeof value==='string'&&/^[1-9]\d{0,14}$/.test(value);
export function subscriptionInstant(value){
  if(value instanceof Date&&Number.isFinite(value.getTime()))return value.toISOString();
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return null;
  const date=new Date(value);return Number.isFinite(date.getTime())&&date.toISOString()===(value.includes('.')?value:value.replace('Z','.000Z'))?date.toISOString():null;
}
const freeze=value=>Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,Array.isArray(item)?Object.freeze(item.map(freeze)):subscriptionRecord(item)?freeze(item):item])));

// The server supplies the approved immutable contract. Missing or partial
// commercial configuration does not become an executable default offer.
export function approvedSubscriptionConfiguration(value){
  if(value===null||value===undefined)return null;
  if(!exact(value,['version','provider','merchantId','accountMode','catalogVersion','offers'])||value.version!==1||!reference(value.provider)||!reference(value.merchantId)||value.accountMode!=='LIVE'||!reference(value.catalogVersion)||!Array.isArray(value.offers)||value.offers.length<1||value.offers.length>2)fail('COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING',503);
  const ids=new Set(),plans=new Set();
  for(const offer of value.offers){
    if(!exact(offer,['id','plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','termsVersion','includesAllIn','automaticExtras'])||!reference(offer.id)||!['PRO','ENTERPRISE'].includes(offer.plan)||!minorUnits(offer.amountMinor)||!['USD','ARS'].includes(offer.currency)||offer.currency==='USD'&&offer.amountMinor!==({PRO:'14900',ENTERPRISE:'34900'})[offer.plan]||offer.periodUnit!=='MONTH'||offer.periodCount!==1||!label(offer.taxTreatment)||!reference(offer.termsVersion)||offer.includesAllIn!==true||offer.automaticExtras!==false||ids.has(offer.id)||plans.has(offer.plan))fail('COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING',503);
    ids.add(offer.id);plans.add(offer.plan);
  }
  return freeze({...value,offers:value.offers.map(offer=>({...offer}))});
}
export const subscriptionConfigurationDigest=config=>subscriptionContractDigest(['company-subscription-configuration-v1',config]);
export function subscriptionCommand(value,kind){
  const keys=kind==='accept_offer'?['scope','operationId','offerId','catalogVersion','catalogDigest','offerDigest','termsVersion','termsSha256','accepted']:kind==='begin'?['scope','operationId','offerId','catalogVersion','acceptanceReceiptId','acceptanceDigest']:kind==='cancel'?['scope','operationId','subscriptionAttemptId']:['scope','operationId'];
  if(!['accept_offer','begin','cancel','recover'].includes(kind)||!exact(value,keys)||!/^[a-f0-9]{64}$/.test(value.scope||'')||!operationId(value.operationId)||['begin','accept_offer'].includes(kind)&&(!reference(value.offerId)||!reference(value.catalogVersion))||kind==='begin'&&(!/^company_subscription_offer_acceptance_[a-f0-9]{64}$/.test(value.acceptanceReceiptId||'')||!/^[a-f0-9]{64}$/.test(value.acceptanceDigest||''))||kind==='accept_offer'&&(value.accepted!==true||!reference(value.termsVersion)||!['catalogDigest','offerDigest','termsSha256'].every(key=>/^[a-f0-9]{64}$/.test(value[key]||'')))||kind==='cancel'&&!/^company_subscription_[a-f0-9]{64}$/.test(value.subscriptionAttemptId||''))fail();
  return {...value,operationId:value.operationId.toLowerCase()};
}
export function subscriptionAttemptId(organizationId,id){
  if(!workspaceId(organizationId)||!operationId(id))fail();
  return 'company_subscription_'+digest([organizationId,id.toLowerCase()]);
}
export const subscriptionRequestDigest=command=>subscriptionContractDigest(['company-subscription-command-v1',command]);
export const subscriptionExternalReference=(_organizationId,attemptId)=>attemptId;
export const subscriptionOpenStates=new Set(['DISPATCHING','UNKNOWN','CHECKOUT_READY','AUTHORIZED','ACTIVE','PAST_DUE','SUSPENDED','CANCEL_REQUESTED','CANCEL_CONFIRMED']);

export function subscriptionCheckoutUrl(value,host){
  if(value===null)return null;
  let url;try{url=new URL(value);}catch{fail('COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED',503);}
  if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.port||url.hash||value.length>2048)fail('COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED',503);
  return url.href;
}

// Only a freshly retrieved provider resource can enter this normalizer. A
// request body and a browser redirect never supply an observation to the store.
export function verifiedSubscriptionObservation(value,attempt,{checkoutHost,observedAt}={}){
  if(!subscriptionRecord(value)||value.state==='UNKNOWN')fail('COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED',503);
  const expected={provider:attempt.provider,merchantId:attempt.merchantId,accountMode:attempt.accountMode,organizationId:attempt.organizationId,attemptId:attempt.id,offerId:attempt.offer.id,catalogVersion:attempt.catalogVersion,amountMinor:attempt.offer.amountMinor,currency:attempt.offer.currency,periodUnit:attempt.offer.periodUnit,periodCount:attempt.offer.periodCount};
  for(const [key,item]of Object.entries(expected))if(value[key]!==item)fail('COMPANY_SUBSCRIPTION_PROVIDER_BINDING_REJECTED',409);
  if(!reference(value.resourceId)||attempt.resourceId!==null&&value.resourceId!==attempt.resourceId||!['PENDING','AUTHORIZED','ACTIVE','PAST_DUE','CANCELED','SUSPENDED'].includes(value.status)||typeof value.cancelAtPeriodEnd!=='boolean')fail('COMPANY_SUBSCRIPTION_PROVIDER_BINDING_REJECTED',409);
  const seen=subscriptionInstant(value.observedAt),now=subscriptionInstant(observedAt);
  if(!seen||!now||Date.parse(seen)>Date.parse(now)+5000||Date.parse(now)-Date.parse(seen)>60000)fail('COMPANY_SUBSCRIPTION_PROVIDER_STALE',409);
  const start=value.periodStartsAt===null?null:subscriptionInstant(value.periodStartsAt),end=value.periodEndsAt===null?null:subscriptionInstant(value.periodEndsAt);
  if((start===null)!==(end===null)||value.periodStartsAt!==null&&!start||value.periodEndsAt!==null&&!end||start&&Date.parse(end)<=Date.parse(start))fail('COMPANY_SUBSCRIPTION_PROVIDER_UNOBSERVED',503);
  if(start){const date=new Date(start),day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));if(date.toISOString()!==end)fail('COMPANY_SUBSCRIPTION_PAYMENT_UNCONFIRMED',409);}
  let payment=null;
  if(value.payment!==null){
    const p=value.payment;
    if(!subscriptionRecord(p)||!reference(p.id)||!['APPROVED','REFUNDED','CHARGEBACK','PENDING','REJECTED','CANCELED','DISPUTED'].includes(p.status)||p.amountMinor!==attempt.offer.amountMinor||p.currency!==attempt.offer.currency||p.paidAt!==null&&!subscriptionInstant(p.paidAt)||p.status==='APPROVED'&&!subscriptionInstant(p.paidAt)||p.invoiceId!==undefined&&p.invoiceId!==null&&!reference(p.invoiceId))fail('COMPANY_SUBSCRIPTION_PAYMENT_UNCONFIRMED',409);
    if(!start||!end||p.paidAt!==null&&(Date.parse(p.paidAt)>Date.parse(seen)||Date.parse(p.paidAt)<Date.parse(start)||Date.parse(p.paidAt)>=Date.parse(end)))fail('COMPANY_SUBSCRIPTION_PAYMENT_UNCONFIRMED',409);
    payment={id:p.id,status:p.status,amountMinor:p.amountMinor,currency:p.currency,paidAt:subscriptionInstant(p.paidAt),invoiceId:p.invoiceId||null};
  }
  const covered=payment?.status==='APPROVED'&&['ACTIVE','CANCELED'].includes(value.status)&&start&&Date.parse(start)<=Date.parse(now)&&Date.parse(end)>Date.parse(now);
  return freeze({...expected,resourceId:value.resourceId,status:value.status,observedAt:seen,periodStartsAt:start,periodEndsAt:end,cancelAtPeriodEnd:value.cancelAtPeriodEnd,payment,paidCovered:covered===true,checkoutUrl:subscriptionCheckoutUrl(value.checkoutUrl,checkoutHost)});
}

export function publicSubscriptionAttempt(attempt){
  return {attemptId:attempt.id,operationId:attempt.operationId,state:attempt.state,plan:attempt.offer.plan,offerId:attempt.offer.id,catalogVersion:attempt.catalogVersion,amountMinor:attempt.offer.amountMinor,currency:attempt.offer.currency,periodUnit:attempt.offer.periodUnit,periodCount:attempt.offer.periodCount,taxTreatment:attempt.offer.taxTreatment,termsVersion:attempt.offer.termsVersion,includesAllIn:attempt.offer.includesAllIn,automaticExtras:attempt.offer.automaticExtras,checkoutUrl:attempt.state==='CHECKOUT_READY'?attempt.checkoutUrl||null:null,receiptId:attempt.receiptId||null,paidPeriod:attempt.paidPeriod||null,cancelAtPeriodEnd:attempt.cancelAtPeriodEnd===true,cancellation:attempt.cancellation?{operationId:attempt.cancellation.operationId,state:attempt.cancellation.state}:null,code:attempt.code||null};
}
