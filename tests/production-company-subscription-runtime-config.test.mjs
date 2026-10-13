import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {companySubscriptionRuntimeConfiguration,companyCommercialRuntimeCatalog} from '../src/lib/company-subscription-runtime-config.mjs';
import {approvedCommercialCatalog,commercialCatalogDigest,defaultCommercialCatalog} from '../src/lib/company-subscription-catalog.mjs';
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

const terms='Condiciones sintéticas aprobadas: servicio mensual por empresa, identidad e IA incluidas.\r\nSin adicionales automáticos. Cancelación al terminar el período pagado.\r\n';
const termsHash=text=>createHash('sha256').update(text,'utf8').digest('hex');
const commercial=()=>({version:1,catalogVersion:'synthetic-commercial-v1',offers:[{...offer,includedTerms:'Alcance sintético incluido: WhatsApp, identidad e IA.',termsText:terms,termsSha256:termsHash(terms)}]});
const approvalFor=value=>({version:1,catalogDigest:commercialCatalogDigest(value),approvalReference:'synthetic-approval:20261013-v1',fundingEvidenceReference:'synthetic-funding:20261013-v1'});
const commercialEnvironment=value=>({VERCEL_ENV:'production',VERCEL_PROJECT_ID:environment.VERCEL_PROJECT_ID,NEXT_PUBLIC_APP_URL:environment.NEXT_PUBLIC_APP_URL,OBRASAAS_COMPANY_COMMERCIAL_RELEASE:'company-commercial-v1',OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify(value),OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:JSON.stringify(approvalFor(value))});
function assertFrozen(value){
  if(value===null||typeof value!=='object')return;
  assert.equal(Object.isFrozen(value),true);for(const item of Object.values(value))assertFrozen(item);
}
function assertCommercialClosed(value){const result=companyCommercialRuntimeCatalog(value);assert.deepEqual(result,defaultCommercialCatalog());assertFrozen(result);}

test('commercial release is closed without an exact approval and does not inherit the financial release or merchant',()=>{
  const ready=commercialEnvironment(commercial());
  for(const value of [{},environment,{...ready,OBRASAAS_COMPANY_COMMERCIAL_RELEASE:undefined},{...ready,OBRASAAS_COMPANY_COMMERCIAL_RELEASE:'true'},{...ready,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:undefined},{...ready,OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:undefined}])assertCommercialClosed(value);
  assert.deepEqual(companySubscriptionRuntimeConfiguration(ready),{catalog:null,providerConfig:{}});
});

test('shared production guard closes invalid environment types without throwing or releasing either catalog',()=>{
  for(const value of [null,[],true,1,'production',Symbol('synthetic-environment'),()=>environment]){
    assertCommercialClosed(value);assert.deepEqual(companySubscriptionRuntimeConfiguration(value),{catalog:null,providerConfig:{}});
  }
});

test('approved private catalog returns the frozen raw three-key schema and exact UTF8 CRLF terms without provider credentials',()=>{
  const raw=commercial(),env=commercialEnvironment(raw),result=companyCommercialRuntimeCatalog(env);
  assert.deepEqual(result,raw);assertFrozen(result);assert.deepEqual(Object.keys(result).sort(),['catalogVersion','offers','version']);
  assert.equal(result.offers[0].termsText,terms);assert.equal(result.offers[0].termsSha256,termsHash(terms));
  assert.notEqual(result.offers[0].termsSha256,termsHash(terms.replaceAll('\r\n','\n')));
  assert.notEqual(result.offers[0].termsSha256,termsHash(terms.trimEnd()));
  assert.equal(approvedCommercialCatalog(result).state,'READY');assert.equal(approvedCommercialCatalog(result).catalogDigest,approvalFor(raw).catalogDigest);
  for(const key of ['catalogDigest','state','approvalReference','fundingEvidenceReference','providerConfig','accessToken'])assert.equal(Object.hasOwn(result,key),false);
  assert.throws(()=>{result.offers[0].termsText='Client substitution';},TypeError);assert.throws(()=>result.offers.push(raw.offers[0]),TypeError);
  raw.offers[0].termsText='Later fixture mutation';assert.equal(result.offers[0].termsText,terms);
});

test('commercial approval requires exactly four typed fields and the exact whole catalog digest',()=>{
  const raw=commercial(),env=commercialEnvironment(raw),approved=approvalFor(raw);
  const values=[null,[],true,'approval',{...approved,version:2},{...approved,catalogDigest:'a'.repeat(64)},{...approved,catalogDigest:approved.catalogDigest.toUpperCase()},{...approved,catalogDigest:123},{...approved,approvalReference:''},{...approved,approvalReference:'synthetic approval'},{...approved,approvalReference:'https://example.invalid/approval'},{...approved,approvalReference:'a'.repeat(256)},{...approved,fundingEvidenceReference:null},{...approved,fundingEvidenceReference:'fondos-é'},{...approved,merchantId:'12345'}];
  for(const field of Object.keys(approved)){const missing={...approved};delete missing[field];values.push(missing);}
  for(const value of values)assertCommercialClosed({...env,OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:JSON.stringify(value)});
  const changed=structuredClone(raw);changed.offers[0].includedTerms+=' Condición diferente.';
  assertCommercialClosed({...env,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify(changed)});
});

test('commercial catalogs reject derived schemas incomplete second offers and reuse of the pending default version',()=>{
  const raw=commercial(),env=commercialEnvironment(raw),derived=approvedCommercialCatalog(raw);
  assertCommercialClosed({...env,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify(derived)});
  assertCommercialClosed({...env,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify({...raw,offers:[derived.offers[0]]})});
  for(const field of ['taxTreatment','includedTerms','termsVersion','termsText','termsSha256']){
    const pending=structuredClone(raw);pending.offers.push({...raw.offers[0],id:'enterprise-offer',plan:'ENTERPRISE',amountMinor:'34900',[field]:null});
    if(['termsText','termsSha256'].includes(field)){pending.offers[1].termsText=null;pending.offers[1].termsSha256=null;}
    assertCommercialClosed(commercialEnvironment(pending));
  }
  const reused={...raw,catalogVersion:defaultCommercialCatalog().catalogVersion};assertCommercialClosed(commercialEnvironment(reused));
  const complete=structuredClone(raw);complete.offers.push({...raw.offers[0],id:'enterprise-offer',plan:'ENTERPRISE',amountMinor:'34900'});
  assert.deepEqual(companyCommercialRuntimeCatalog(commercialEnvironment(complete)),complete);
});

test('commercial production guard rejects preview wrong project origin and target even with an approved catalog',()=>{
  const raw=commercial(),env=commercialEnvironment(raw);
  for(const patch of [{VERCEL_ENV:undefined},{VERCEL_ENV:'preview'},{VERCEL_ENV:'development'},{VERCEL_PROJECT_ID:undefined},{VERCEL_PROJECT_ID:'another-project'},{NEXT_PUBLIC_APP_URL:undefined},{NEXT_PUBLIC_APP_URL:'https://preview.example.invalid'},{NEXT_PUBLIC_APP_URL:'https://obrasaas.com/'},{VERCEL_TARGET_ENV:'preview'}])assertCommercialClosed({...env,...patch});
  assert.deepEqual(companyCommercialRuntimeCatalog({...env,VERCEL_TARGET_ENV:'production'}),raw);
});

test('commercial JSON and approval honor inclusive byte bounds and count UTF8 rather than string characters',()=>{
  const raw=commercial(),env=commercialEnvironment(raw),catalogBytes=Buffer.byteLength(env.OBRASAAS_COMPANY_COMMERCIAL_CATALOG,'utf8'),approvalBytes=Buffer.byteLength(env.OBRASAAS_COMPANY_COMMERCIAL_APPROVAL,'utf8');
  const padded={...env,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:env.OBRASAAS_COMPANY_COMMERCIAL_CATALOG+' '.repeat(131072-catalogBytes),OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:env.OBRASAAS_COMPANY_COMMERCIAL_APPROVAL+' '.repeat(4096-approvalBytes)};
  assert.deepEqual(companyCommercialRuntimeCatalog(padded),raw);
  assertCommercialClosed({...padded,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:padded.OBRASAAS_COMPANY_COMMERCIAL_CATALOG+' '});
  assertCommercialClosed({...padded,OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:padded.OBRASAAS_COMPANY_COMMERCIAL_APPROVAL+' '});
  const heavy=structuredClone(raw),text='é'.repeat(8192)+'\r\n'.repeat(8192);
  heavy.offers[0]={...heavy.offers[0],includedTerms:'é'.repeat(8192),termsText:text,termsSha256:termsHash(text)};
  heavy.offers.push({...heavy.offers[0],id:'enterprise-offer',plan:'ENTERPRISE',amountMinor:'34900'});
  assert.equal(approvedCommercialCatalog(heavy).state,'READY');const encoded=commercialEnvironment(heavy);
  assert.ok(encoded.OBRASAAS_COMPANY_COMMERCIAL_CATALOG.length<131072);assert.ok(Buffer.byteLength(encoded.OBRASAAS_COMPANY_COMMERCIAL_CATALOG,'utf8')>131072);
  assertCommercialClosed(encoded);
});

test('malformed JSON and substituted exact terms bytes never produce an executable catalog',()=>{
  const raw=commercial(),env=commercialEnvironment(raw);
  for(const field of ['OBRASAAS_COMPANY_COMMERCIAL_CATALOG','OBRASAAS_COMPANY_COMMERCIAL_APPROVAL'])for(const value of ['', '{', 'null', '[]', '\ud800'])assertCommercialClosed({...env,[field]:value});
  const normalized=structuredClone(raw);normalized.offers[0].termsText=terms.replaceAll('\r\n','\n');
  assertCommercialClosed({...env,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify(normalized)});
  const missing=structuredClone(raw);delete missing.offers[0].includedTerms;assertCommercialClosed({...env,OBRASAAS_COMPANY_COMMERCIAL_CATALOG:JSON.stringify(missing)});
});

test('commercial readiness also requires financial representability without borrowing a merchant or currency conversion',()=>{
  const raw=commercial(),tax=structuredClone(raw);tax.offers[0].taxTreatment='x'.repeat(161);
  assert.equal(approvedCommercialCatalog(tax).state,'READY');assertCommercialClosed(commercialEnvironment(tax));
  const maximum=structuredClone(raw);maximum.offers[0].currency='ARS';maximum.offers[0].amountMinor='1000000000000';maximum.offers[0].taxTreatment='x'.repeat(160);
  assert.deepEqual(companyCommercialRuntimeCatalog(commercialEnvironment(maximum)),maximum);
  for(const amountMinor of ['1000000000001','10000000000000']){const unsupported=structuredClone(maximum);unsupported.offers[0].amountMinor=amountMinor;assert.equal(approvedCommercialCatalog(unsupported).state,'READY');assertCommercialClosed(commercialEnvironment(unsupported));}
  assert.deepEqual(companySubscriptionRuntimeConfiguration(commercialEnvironment(maximum)),{catalog:null,providerConfig:{}});
});

test('closing only commercial approval leaves the independent financial configuration byte identical',()=>{
  const ready={...environment,...commercialEnvironment(commercial())},financial=companySubscriptionRuntimeConfiguration(ready),closed={...ready,OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:undefined};
  assertCommercialClosed(closed);assert.deepEqual(companySubscriptionRuntimeConfiguration(closed),financial);
  const mismatched={...ready,OBRASAAS_COMPANY_COMMERCIAL_APPROVAL:JSON.stringify({...approvalFor(commercial()),catalogDigest:'f'.repeat(64)})};
  assertCommercialClosed(mismatched);assert.deepEqual(companySubscriptionRuntimeConfiguration(mismatched),financial);
});
