import {createHash} from 'node:crypto';
import {WorkspaceError,digest,workspaceId,operationId} from './workspace-policy.mjs';

const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>record(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const reference=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=(value,limit)=>typeof value==='string'&&value.isWellFormed()&&value.trim().length>0&&Buffer.byteLength(value,'utf8')<=limit&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value);
const stable=value=>Array.isArray(value)?value.map(stable):record(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const freeze=value=>Array.isArray(value)?Object.freeze(value.map(freeze)):record(value)?Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item])=>[key,freeze(item)]))):value;
const fail=(code='COMPANY_SUBSCRIPTION_CATALOG_UNOBSERVED',status=503)=>{throw new WorkspaceError(code,status);};

export const commercialContractDigest=value=>digest(stable(value));
// Terms bind exactly the bytes displayed, including any explicit CR/LF or final
// newline. JSON canonicalization applies to the enclosing contract separately.
export function commercialTermsSha256(value){if(!text(value,32768))fail();return createHash('sha256').update(value,'utf8').digest('hex');}
export const COMMERCIAL_OFFER_FIELDS=Object.freeze(['id','plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','includedTerms','termsVersion','termsText','termsSha256','includesAllIn','automaticExtras']);
export function commercialOfferSnapshot(value){
  if(!record(value))fail();
  const offer=Object.fromEntries(COMMERCIAL_OFFER_FIELDS.map(key=>[key,value[key]]));
  if(!reference(offer.id)||!['PRO','ENTERPRISE'].includes(offer.plan)||typeof offer.amountMinor!=='string'||!/^[1-9]\d{0,14}$/.test(offer.amountMinor)||!['USD','ARS'].includes(offer.currency)||offer.currency==='USD'&&offer.amountMinor!==({PRO:'14900',ENTERPRISE:'34900'})[offer.plan]||offer.periodUnit!=='MONTH'||offer.periodCount!==1||offer.includesAllIn!==true||offer.automaticExtras!==false)fail();
  if(offer.taxTreatment!==null&&!text(offer.taxTreatment,1024)||offer.includedTerms!==null&&!text(offer.includedTerms,16384)||offer.termsVersion!==null&&!reference(offer.termsVersion))fail();
  if((offer.termsText===null)!==(offer.termsSha256===null)||offer.termsText!==null&&(!hash(offer.termsSha256)||commercialTermsSha256(offer.termsText)!==offer.termsSha256))fail();
  return freeze(offer);
}
export const commercialOfferDigest=offer=>commercialContractDigest(['company-subscription-commercial-offer-v1',commercialOfferSnapshot(offer)]);
export const commercialOfferReady=offer=>offer.taxTreatment!==null&&offer.includedTerms!==null&&offer.termsVersion!==null&&offer.termsText!==null&&offer.termsSha256!==null;
export function commercialCatalogDigest(catalog){return commercialContractDigest(['company-subscription-commercial-catalog-v1',{version:1,catalogVersion:catalog.catalogVersion,offers:catalog.offers.map(offer=>({...commercialOfferSnapshot(offer),offerDigest:commercialOfferDigest(offer)}))}]);}

const pendingOffer=(id,plan,amountMinor)=>({id,plan,amountMinor,currency:'USD',periodUnit:'MONTH',periodCount:1,taxTreatment:null,includedTerms:null,termsVersion:null,termsText:null,termsSha256:null,includesAllIn:true,automaticExtras:false});
export const DEFAULT_COMPANY_SUBSCRIPTION_CATALOG=freeze({version:1,catalogVersion:'company-offers-usd-20261013-v1',offers:[pendingOffer('pro-monthly','PRO','14900'),pendingOffer('enterprise-monthly','ENTERPRISE','34900')]});
export const defaultCommercialCatalog=()=>DEFAULT_COMPANY_SUBSCRIPTION_CATALOG;
export function approvedCommercialCatalog(value){
  if(!exact(value,['version','catalogVersion','offers'])||value.version!==1||!reference(value.catalogVersion)||!Array.isArray(value.offers)||value.offers.length<1||value.offers.length>2)fail();
  const ids=new Set(),plans=new Set(),offers=value.offers.map(value=>{
    if(!exact(value,COMMERCIAL_OFFER_FIELDS))fail();const offer=commercialOfferSnapshot(value);
    if(ids.has(offer.id)||plans.has(offer.plan))fail();ids.add(offer.id);plans.add(offer.plan);
    return {...offer,offerDigest:commercialOfferDigest(offer)};
  });
  const catalog={version:1,state:offers.every(commercialOfferReady)?'READY':'TERMS_PENDING',catalogVersion:value.catalogVersion,offers};
  return freeze({...catalog,catalogDigest:commercialCatalogDigest(catalog)});
}

export function commercialAuthority(session,member){
  if(!record(member)||![member.actorId,member.membershipId,member.organizationId].every(workspaceId)||member.role!=='ADMIN'||session?.authenticated!==true||session.verification!=='clerk-production-jwt'||!/^user_[A-Za-z0-9]+$/.test(session.userId||'')||!/^org_[A-Za-z0-9]+$/.test(session.organizationId||'')||session.organizationRole!=='org:admin'||member.officeReviewOnly===true)fail('COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED',403);
  return freeze({actorId:member.actorId,membershipId:member.membershipId,organizationId:member.organizationId,tenantRole:member.role,clerkUserId:session.userId,clerkOrganizationId:session.organizationId,clerkRole:session.organizationRole,verification:session.verification});
}
export const commercialActorBinding=authority=>commercialContractDigest(['company-subscription-accepting-admin-v1',authority]);
export function commercialAcceptanceId(organizationId,id){if(!workspaceId(organizationId)||!operationId(id))fail('COMPANY_SUBSCRIPTION_INPUT_INVALID',400);return 'company_subscription_offer_acceptance_'+digest([organizationId,id.toLowerCase()]);}
export function commercialAcceptanceDigest(value){
  const snapshot={version:1,receiptId:value.id??value.receiptId,operationId:value.operationId,organizationId:value.organizationId,actorBinding:value.actorBinding,catalogVersion:value.catalogVersion,catalogDigest:value.catalogDigest,offer:value.offer,acceptedAt:value.acceptedAt};
  return commercialContractDigest(['company-subscription-offer-acceptance-v1',snapshot]);
}
export const commercialOfferMatchesFinancial=(offer,financial)=>['id','plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','termsVersion','includesAllIn','automaticExtras'].every(key=>offer[key]===financial?.[key]);
