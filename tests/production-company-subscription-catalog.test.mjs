import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {approvedCommercialCatalog,defaultCommercialCatalog,commercialTermsSha256,commercialOfferDigest,commercialCatalogDigest,commercialAuthority,commercialActorBinding,commercialAcceptanceId,commercialAcceptanceDigest} from '../src/lib/company-subscription-catalog.mjs';
import {subscriptionAttemptId} from '../src/lib/company-subscription-policy.mjs';

const terms=' Condiciones sintéticas: un único abono mensual.\r\nSin adicionales automáticos.\n';
const complete=()=>({version:1,catalogVersion:'synthetic-commercial-v1',offers:defaultCommercialCatalog().offers.map(offer=>({...offer,taxTreatment:'Impuestos incluidos (sintético)',includedTerms:'Servicios incluidos exclusivamente en la prueba; sin cuotas inventadas.',termsVersion:'synthetic-terms-v1',termsText:terms,termsSha256:commercialTermsSha256(terms)}))});
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'},member={actorId:'actor-a',membershipId:'member-a',organizationId:'company-a',role:'ADMIN'};

test('selected provider-independent company prices are immutable and pending unknown commercial terms',()=>{
 const raw=defaultCommercialCatalog(),catalog=approvedCommercialCatalog(raw);assert.deepEqual(catalog.offers.map(x=>[x.plan,x.amountMinor,x.currency,x.periodUnit,x.periodCount]),[['PRO','14900','USD','MONTH',1],['ENTERPRISE','34900','USD','MONTH',1]]);assert.equal(catalog.state,'TERMS_PENDING');
 for(const offer of catalog.offers){assert.equal(offer.includesAllIn,true);assert.equal(offer.automaticExtras,false);for(const key of ['taxTreatment','includedTerms','termsVersion','termsText','termsSha256'])assert.equal(offer[key],null);assert.ok(Object.isFrozen(offer));}
 assert.ok(Object.isFrozen(raw)&&Object.isFrozen(raw.offers)&&Object.isFrozen(catalog));assert.throws(()=>{raw.offers[0].amountMinor='1';});assert.equal(catalog.catalogDigest,commercialCatalogDigest(catalog));assert.equal(Object.hasOwn(catalog,'merchantId'),false);
});

test('trusted full commercial terms preserve exact UTF8 including leading space CR LF and terminal newline',()=>{
 const raw=complete(),catalog=approvedCommercialCatalog(raw);assert.equal(catalog.state,'READY');assert.equal(catalog.offers[0].termsText,terms);assert.equal(catalog.offers[0].termsSha256,createHash('sha256').update(terms,'utf8').digest('hex'));
 assert.notEqual(commercialTermsSha256(terms),commercialTermsSha256(terms.trim()));assert.notEqual(commercialTermsSha256('é'),commercialTermsSha256('e\u0301'));
 raw.offers[0].termsText=terms.replaceAll('\r\n','\n');assert.throws(()=>approvedCommercialCatalog(raw),{code:'COMPANY_SUBSCRIPTION_CATALOG_UNOBSERVED'});
});

test('a catalog never invents a merchant quote tax inclusion quota or executable terms from partial fields',()=>{
 for(const patch of [{amountMinor:14900},{amountMinor:'149.00'},{amountMinor:'1'},{amountMinor:'014900'},{currency:'EUR'},{periodCount:12},{includesAllIn:false},{automaticExtras:true},{taxTreatment:''},{includedTerms:' '},{termsVersion:''},{termsSha256:'bad'},{termsText:'\ud800'},{merchantId:'fake'},{quota:100}]){const raw=complete();Object.assign(raw.offers[0],patch);assert.throws(()=>approvedCommercialCatalog(raw),{code:'COMPANY_SUBSCRIPTION_CATALOG_UNOBSERVED'});}
 for(const field of ['taxTreatment','includedTerms','termsVersion']){const raw=complete();raw.offers[0][field]=null;assert.equal(approvedCommercialCatalog(raw).state,'TERMS_PENDING');}
 const raw=complete();raw.offers[0].currency='ARS';raw.offers[0].amountMinor='22500000';assert.equal(approvedCommercialCatalog(raw).offers[0].amountMinor,'22500000');assert.throws(()=>approvedCommercialCatalog({...raw,provider:'fake'}));
});

test('commercial digests ignore object order and bind every offer term while preserving offer order',()=>{
 const a=complete(),reorder=value=>Object.fromEntries(Object.entries(value).reverse());assert.equal(approvedCommercialCatalog(a).catalogDigest,approvedCommercialCatalog({...reorder(a),offers:a.offers.map(reorder)}).catalogDigest);
 const changed=complete();changed.offers[0].includedTerms+=' Una condición cambiada.';assert.notEqual(approvedCommercialCatalog(a).catalogDigest,approvedCommercialCatalog(changed).catalogDigest);assert.notEqual(commercialOfferDigest(a.offers[0]),commercialOfferDigest(changed.offers[0]));assert.notEqual(approvedCommercialCatalog(a).catalogDigest,approvedCommercialCatalog({...a,offers:[...a.offers].reverse()}).catalogDigest);
});

test('canonical accepting administrator authority binds actual actor membership organization and signed Clerk authority',()=>{
 const authority=commercialAuthority(session,member),binding=commercialActorBinding(authority);assert.equal(authority.tenantRole,'ADMIN');assert.ok(Object.isFrozen(authority));
 for(const patch of [{actorId:'actor-b'},{membershipId:'member-b'},{organizationId:'company-b'}])assert.notEqual(binding,commercialActorBinding(commercialAuthority(session,{...member,...patch})));
 for(const [identity,m] of [[{...session,userId:'user_Other'},member],[{...session,organizationId:'org_B'},member]])assert.notEqual(binding,commercialActorBinding(commercialAuthority(identity,m)));
 for(const [identity,m] of [[{...session,organizationRole:'org:member'},member],[{...session,verification:'mock'},member],[session,{...member,role:'AUDITOR'}],[session,{...member,officeReviewOnly:true}]])assert.throws(()=>commercialAuthority(identity,m),{code:'COMPANY_SUBSCRIPTION_ACCEPTANCE_AUTHORITY_CHANGED'});
});

test('accepted commercial receipt uses its own UUID namespace and stable full snapshot digest',()=>{
 const operationId='00000000-0000-4000-8000-000000000100',catalog=approvedCommercialCatalog(complete()),authority=commercialAuthority(session,member),value={version:1,id:commercialAcceptanceId(member.organizationId,operationId),operationId,organizationId:member.organizationId,actorBinding:commercialActorBinding(authority),catalogVersion:catalog.catalogVersion,catalogDigest:catalog.catalogDigest,offer:catalog.offers[0],acceptedAt:'2026-10-13T12:00:00.000Z'};
 assert.notEqual(value.id,subscriptionAttemptId(member.organizationId,operationId));const digest=commercialAcceptanceDigest(value);assert.equal(digest,commercialAcceptanceDigest({...value,id:undefined,receiptId:value.id,current:false,canCheckout:false}));
 for(const patch of [{acceptedAt:'2026-10-13T12:00:01.000Z'},{actorBinding:'a'.repeat(64)},{catalogVersion:'other'},{offer:catalog.offers[1]}])assert.notEqual(digest,commercialAcceptanceDigest({...value,...patch}));
});
