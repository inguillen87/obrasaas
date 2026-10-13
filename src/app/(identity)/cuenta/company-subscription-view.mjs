import {companyWhatsappOnboardingEntitlement} from '../../../lib/company-entitlement.mjs';
import {createBrowserRecoveryStorage} from './workspace-recovery-storage.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const scopeValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const reference = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,254}$/.test(value);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const text = (value, limit = 160) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]/.test(value);
const attemptId = value => typeof value === 'string' && /^company_subscription_[a-f0-9]{64}$/.test(value);
const receiptId = value => typeof value === 'string' && /^company_subscription_payment_[a-f0-9]{64}$/.test(value);
const acceptanceId = value => typeof value === 'string' && /^company_subscription_offer_acceptance_[a-f0-9]{64}$/.test(value);
const verifiedViews = new WeakSet();
const offerFields = ['id','plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','includedTerms','termsVersion','termsText','termsSha256','includesAllIn','automaticExtras'];
const utf8 = new TextEncoder();
const commercialText = (value,limit) => typeof value === 'string' && value.isWellFormed() && value.trim().length > 0 && utf8.encode(value).byteLength <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(value);
const stable = value => Array.isArray(value)?value.map(stable):record(value)?Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])])):value;
const pick = (value,keys) => Object.fromEntries(keys.map(key => [key,value[key]]));
async function sha(value) {return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',utf8.encode(value))),byte => byte.toString(16).padStart(2,'0')).join('');}
const contractDigest = value => sha(JSON.stringify(stable(value)));
const approvedAmount = value => ['ARS','USD'].includes(value.currency) && typeof value.amountMinor === 'string' && /^[1-9]\d{0,14}$/.test(value.amountMinor) && (value.currency !== 'USD' || value.amountMinor === ({PRO:'14900',ENTERPRISE:'34900'})[value.plan]);
const moneyLabel = value => `${value.currency} ${new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value.amountMinor) / 100)}`;
const plans = Object.freeze({TRIAL:'Prueba gratuita',PRO:'Pro',ENTERPRISE:'Empresa'});
const states = new Set(['DISPATCHING','UNKNOWN','CHECKOUT_READY','AUTHORIZED','ACTIVE','PAST_DUE','SUSPENDED','CANCELED','CANCEL_REQUESTED','CANCEL_CONFIRMED']);
const cancellable = new Set(['CHECKOUT_READY','AUTHORIZED','ACTIVE','PAST_DUE','SUSPENDED']);
const hosts = new Set(['www.mercadopago.com.ar','www.mercadopago.com.br','www.mercadopago.com.mx','www.mercadopago.com.co','www.mercadopago.com.pe','www.mercadopago.com.uy','www.mercadopago.cl']);
const freeze = value => Object.freeze(Object.fromEntries(Object.entries(value).map(([key,item]) => [key,Array.isArray(item) ? Object.freeze(item.map(freeze)) : record(item) ? freeze(item) : item])));
function fail(code = 'COMPANY_SUBSCRIPTION_RESULT_UNCONFIRMED') {throw Object.assign(new Error(code),{code});}
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === (value.includes('.') ? value : value.replace('Z','.000Z'));
}
const formatter = new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const dateLabel = value => `${formatter.format(new Date(value))} (hora de Argentina)`;

// A link can only resume the provider resource observed by the server. Redirect
// query strings, browser location and client supplied URLs are never evidence.
export function companySubscriptionCheckoutUrl(value) {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > 2048) fail();
  let url;try {url = new URL(value);} catch {fail();}
  const providerId = url.searchParams.get('preapproval_id');
  if (url.protocol !== 'https:' || !hosts.has(url.hostname) || url.username || url.password || url.port || url.hash || url.pathname !== '/subscriptions/checkout' || url.searchParams.size !== 1 || !id(providerId)) fail();
  const canonical = `https://${url.hostname}/subscriptions/checkout?preapproval_id=${encodeURIComponent(providerId)}`;
  if (value !== canonical) fail();
  return canonical;
}

function offerView(offer) {
  if (!exact(offer,['id','plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','termsVersion','includesAllIn','automaticExtras']) || !reference(offer.id) || !['PRO','ENTERPRISE'].includes(offer.plan) || !approvedAmount(offer) || offer.periodUnit !== 'MONTH' || offer.periodCount !== 1 || !text(offer.taxTreatment) || !reference(offer.termsVersion) || offer.includesAllIn !== true || offer.automaticExtras !== false) fail();
  return {...offer,planLabel:plans[offer.plan],priceLabel:moneyLabel(offer),periodLabel:'por mes',taxLabel:offer.taxTreatment};
}

function commercialOffer(value,{capabilities = true} = {}) {
  if (!exact(value,[...offerFields,'offerDigest',...(capabilities?['canAccept','checkoutAvailable']:[])]) || !reference(value.id) || !['PRO','ENTERPRISE'].includes(value.plan) || !approvedAmount(value) || value.periodUnit !== 'MONTH' || value.periodCount !== 1 || value.includesAllIn !== true || value.automaticExtras !== false || !scopeValid(value.offerDigest)) fail();
  if (value.taxTreatment !== null && !commercialText(value.taxTreatment,1024) || value.includedTerms !== null && !commercialText(value.includedTerms,16384) || value.termsVersion !== null && !reference(value.termsVersion) || value.termsText !== null && !commercialText(value.termsText,32768) || value.termsSha256 !== null && !scopeValid(value.termsSha256) || (value.termsText === null) !== (value.termsSha256 === null)) fail();
  const ready = ['taxTreatment','includedTerms','termsVersion','termsText','termsSha256'].every(key => value[key] !== null);
  if (capabilities && (typeof value.canAccept !== 'boolean' || typeof value.checkoutAvailable !== 'boolean' || (value.canAccept || value.checkoutAvailable) && !ready)) fail();
  return {...value,termsReady:ready,planLabel:plans[value.plan],priceLabel:moneyLabel(value),periodLabel:'por empresa / mes',taxLabel:value.taxTreatment || 'Tratamiento de impuestos pendiente de aprobación.'};
}

function commercialView(value,config) {
  if (!exact(value,['version','state','catalogVersion','catalogDigest','actorBinding','offers']) || value.version !== 1 || !['READY','TERMS_PENDING'].includes(value.state) || !reference(value.catalogVersion) || !scopeValid(value.catalogDigest) || !scopeValid(value.actorBinding) || !Array.isArray(value.offers) || value.offers.length < 1 || value.offers.length > 2) fail();
  const offers = value.offers.map(offer => commercialOffer(offer));
  if (new Set(offers.map(offer => offer.id)).size !== offers.length || new Set(offers.map(offer => offer.plan)).size !== offers.length || (offers.every(offer => offer.termsReady)?'READY':'TERMS_PENDING') !== value.state) fail();
  for (const offer of offers) if (offer.checkoutAvailable) {
    const financial = config.offers.find(item => item.id === offer.id);
    if (config.state !== 'READY' || config.catalogVersion !== value.catalogVersion || !financial || ['plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','termsVersion','includesAllIn','automaticExtras'].some(key => financial[key] !== offer[key])) fail();
  }
  return {...value,offers};
}

function acceptanceView(value,commercial,organizationId,expected) {
  if (value === null) return null;
  if (!exact(value,['version','receiptId','operationId','state','organizationId','actorBinding','catalogVersion','catalogDigest','offer','acceptedAt','acceptanceDigest','current','canCheckout']) || value.version !== 1 || !acceptanceId(value.receiptId) || !uuid(value.operationId) || value.state !== 'TERMS_ACCEPTED' || value.organizationId !== organizationId || !scopeValid(value.actorBinding) || !reference(value.catalogVersion) || !scopeValid(value.catalogDigest) || !scopeValid(value.acceptanceDigest) || !instant(value.acceptedAt) || typeof value.current !== 'boolean' || typeof value.canCheckout !== 'boolean') fail();
  if (expected.acceptanceOperationId && value.operationId !== expected.acceptanceOperationId) fail('WORKSPACE_CONTEXT_CHANGED');
  const offer = commercialOffer(value.offer,{capabilities:false});
  if (!offer.termsReady || value.canCheckout && !value.current) fail();
  if (value.current) {
    const current = commercial.offers.find(item => item.id === offer.id);
    if (value.actorBinding !== commercial.actorBinding || value.catalogVersion !== commercial.catalogVersion || value.catalogDigest !== commercial.catalogDigest || !current || [...offerFields,'offerDigest'].some(key => current[key] !== offer[key]) || value.canCheckout && !current.checkoutAvailable) fail('WORKSPACE_CONTEXT_CHANGED');
  }
  return {...value,offer};
}

function attemptView(value, observedAt, expected) {
  if (value === null) return null;
  if (!exact(value,['attemptId','operationId','state','plan','offerId','catalogVersion','amountMinor','currency','periodUnit','periodCount','taxTreatment','termsVersion','includesAllIn','automaticExtras','checkoutUrl','receiptId','paidPeriod','cancelAtPeriodEnd','code','cancellation']) || !attemptId(value.attemptId) || !uuid(value.operationId) || !states.has(value.state) || !['PRO','ENTERPRISE'].includes(value.plan) || !reference(value.offerId) || !reference(value.catalogVersion) || !approvedAmount(value) || value.periodUnit !== 'MONTH' || value.periodCount !== 1 || !text(value.taxTreatment) || !reference(value.termsVersion) || value.includesAllIn !== true || value.automaticExtras !== false || typeof value.cancelAtPeriodEnd !== 'boolean' || value.code !== null && (typeof value.code !== 'string' || !/^[A-Z0-9_]{1,128}$/.test(value.code))) fail();
  if (value.cancellation !== null && (!exact(value.cancellation,['operationId','state']) || !uuid(value.cancellation.operationId) || !['DISPATCHING','UNKNOWN','CONFIRMED'].includes(value.cancellation.state) || value.cancellation.operationId === value.operationId)) fail();
  if (expected.operationId && (expected.action === 'cancel_renewal' ? value.cancellation?.operationId !== expected.operationId : expected.action === 'begin' ? value.operationId !== expected.operationId : value.operationId !== expected.operationId && value.cancellation?.operationId !== expected.operationId)) fail('WORKSPACE_CONTEXT_CHANGED');
  if ((value.receiptId === null) !== (value.paidPeriod === null) || value.receiptId !== null && !receiptId(value.receiptId)) fail();
  let paidCovered = false;
  if (value.paidPeriod !== null) {
    if (!exact(value.paidPeriod,['startsAt','endsAt']) || !instant(value.paidPeriod.startsAt) || !instant(value.paidPeriod.endsAt) || Date.parse(value.paidPeriod.endsAt) <= Date.parse(value.paidPeriod.startsAt)) fail();
    paidCovered = (['ACTIVE','CANCELED','CANCEL_REQUESTED','CANCEL_CONFIRMED'].includes(value.state) || value.state === 'UNKNOWN' && value.cancellation !== null) && Date.parse(value.paidPeriod.startsAt) <= Date.parse(observedAt) && Date.parse(value.paidPeriod.endsAt) > Date.parse(observedAt);
  }
  const checkoutUrl = companySubscriptionCheckoutUrl(value.checkoutUrl);
  if (checkoutUrl !== null && value.state !== 'CHECKOUT_READY') fail();
  if (value.state === 'CHECKOUT_READY' && checkoutUrl === null) fail();
  if (['CANCELED','CANCEL_CONFIRMED'].includes(value.state) && value.cancelAtPeriodEnd !== true) fail();
  if (value.cancellation?.state === 'CONFIRMED' && value.cancelAtPeriodEnd !== true) fail();
  const labels = {DISPATCHING:'Pago por comprobar',UNKNOWN:value.cancellation?'Cancelación por comprobar':'Pago por comprobar',CHECKOUT_READY:'Continuar el pago',AUTHORIZED:'Débito autorizado · pago pendiente',ACTIVE:paidCovered?'Período pagado':'Pago pendiente de confirmación',PAST_DUE:'Pago pendiente',SUSPENDED:'Suscripción suspendida',CANCELED:'Renovación cancelada',CANCEL_REQUESTED:'Cancelación por comprobar',CANCEL_CONFIRMED:'Renovación cancelada'};
  return {...value,paidCovered,paymentConfirmed:value.receiptId !== null,checkoutUrl,planLabel:plans[value.plan],priceLabel:moneyLabel(value),taxLabel:value.taxTreatment,statusLabel:labels[value.state],paidThroughLabel:paidCovered?dateLabel(value.paidPeriod.endsAt):null,canCancel:cancellable.has(value.state) && value.cancelAtPeriodEnd === false && value.cancellation === null};
}

// Validate the whole envelope before projecting any financial claim. The
// canonical ACTIVE row itself still does not establish payment collection.
export function companySubscriptionView(value, expected = {}) {
  if (!scopeValid(expected.scope) || value?.scope !== expected.scope) fail('WORKSPACE_CONTEXT_CHANGED');
  if (!exact(value,['version','scope','organization','observedAt','configuration','subscription','attempt','recovery','commercial','acceptance']) || value.version !== 2 || !exact(value.organization,['id','name']) || !id(value.organization.id) || !text(value.organization.name,512) || !instant(value.observedAt)) fail();
  if (expected.organizationId && value.organization.id !== expected.organizationId) fail('WORKSPACE_CONTEXT_CHANGED');
  if (expected.operationId && !uuid(expected.operationId)) fail('WORKSPACE_CONTEXT_CHANGED');
  if (expected.acceptanceOperationId && !uuid(expected.acceptanceOperationId)) fail('WORKSPACE_CONTEXT_CHANGED');
  if (value.recovery !== null && (!exact(value.recovery,['operationId','state']) || !uuid(value.recovery.operationId) || value.recovery.state !== 'NO_DISPATCH' || !expected.operationId || value.recovery.operationId !== expected.operationId || value.attempt !== null)) fail();
  const config = value.configuration;
  if (!exact(config,['state','catalogVersion','offers']) || !['READY','CONFIGURATION_PENDING'].includes(config.state) || !Array.isArray(config.offers) || config.offers.length > 2) fail();
  if (config.state === 'CONFIGURATION_PENDING' && (config.catalogVersion !== null || config.offers.length !== 0) || config.state === 'READY' && (!reference(config.catalogVersion) || config.offers.length < 1)) fail();
  const financialOffers = config.offers.map(offerView);
  if (new Set(financialOffers.map(offer => offer.id)).size !== financialOffers.length || new Set(financialOffers.map(offer => offer.plan)).size !== financialOffers.length) fail();
  const commercial = commercialView(value.commercial,config),acceptance = acceptanceView(value.acceptance,commercial,value.organization.id,expected);
  const offers = commercial.offers;
  const subscription = value.subscription;
  if (!exact(subscription,['plan','status','trialEndsAt','entitlement']) || !Object.hasOwn(plans,subscription.plan) || !['TRIALING','ACTIVE','PAST_DUE','CANCELED','SUSPENDED'].includes(subscription.status) || subscription.trialEndsAt !== null && !instant(subscription.trialEndsAt) || !exact(subscription.entitlement,['allowed','basis','reasonCode'])) fail();
  const checked = companyWhatsappOnboardingEntitlement({subscriptionPlan:subscription.plan,subscriptionStatus:subscription.status,trialEndsAt:subscription.trialEndsAt},{now:value.observedAt});
  const managedDenial = subscription.status === 'ACTIVE' && ['PRO','ENTERPRISE'].includes(subscription.plan) && subscription.entitlement.allowed === false && subscription.entitlement.basis === null && ['COMPANY_ENTITLEMENT_PAID_PERIOD_UNOBSERVED','COMPANY_ENTITLEMENT_PAID_PERIOD_NOT_STARTED','COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED'].includes(subscription.entitlement.reasonCode);
  if (!managedDenial && ['allowed','basis','reasonCode'].some(key => subscription.entitlement[key] !== checked[key])) fail();
  const attempt = attemptView(value.attempt,value.observedAt,expected);
  if (attempt?.paidCovered && (subscription.plan !== attempt.plan || subscription.status !== 'ACTIVE' || subscription.entitlement.allowed !== true)) fail();
  if (managedDenial && attempt?.paidPeriod && subscription.entitlement.reasonCode === 'COMPANY_ENTITLEMENT_PAID_PERIOD_NOT_STARTED' && Date.parse(attempt.paidPeriod.startsAt) <= Date.parse(value.observedAt)) fail();
  if (managedDenial && attempt?.paidPeriod && subscription.entitlement.reasonCode === 'COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED' && Date.parse(attempt.paidPeriod.endsAt) > Date.parse(value.observedAt)) fail();
  if (attempt && config.state === 'READY' && attempt.catalogVersion === config.catalogVersion) {
    const selected = financialOffers.find(offer => offer.id === attempt.offerId);
    if (!selected || ['plan','amountMinor','currency','periodUnit','periodCount','taxTreatment','termsVersion','includesAllIn','automaticExtras'].some(key => selected[key] !== attempt[key])) fail();
  }
  const trialCurrent = checked.basis === 'CURRENT_TRIAL';
  const trialStatus = checked.reasonCode === 'COMPANY_ENTITLEMENT_TRIAL_EXPIRED'?'Prueba finalizada':checked.reasonCode === 'COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE'?'Vencimiento por revisar':'Estado por revisar';
  const statusLabel = managedDenial ? subscription.entitlement.reasonCode === 'COMPANY_ENTITLEMENT_PAID_PERIOD_EXPIRED'?'Período pagado finalizado':subscription.entitlement.reasonCode === 'COMPANY_ENTITLEMENT_PAID_PERIOD_NOT_STARTED'?'Período pagado aún no iniciado':'Pago por revisar' : attempt?.statusLabel || (trialCurrent?'Prueba vigente':subscription.status === 'TRIALING'?trialStatus:subscription.status === 'ACTIVE' && checked.allowed?'Suscripción registrada':({PAST_DUE:'Pago pendiente',CANCELED:'Suscripción cancelada',SUSPENDED:'Suscripción suspendida'})[subscription.status] || 'Estado por revisar');
  const closedAttempt = attempt && ['CANCELED','CANCEL_CONFIRMED'].includes(attempt.state) && attempt.cancelAtPeriodEnd && !attempt.paidCovered && (attempt.cancellation === null || attempt.cancellation.state === 'CONFIRMED') && (attempt.paidPeriod !== null ? Date.parse(attempt.paidPeriod.endsAt) <= Date.parse(value.observedAt) : attempt.state === 'CANCELED');
  return freeze({
    scope:value.scope,organizationId:value.organization.id,companyName:value.organization.name,observedAt:value.observedAt,observedAtLabel:dateLabel(value.observedAt),
    configurationReady:config.state === 'READY',catalogVersion:commercial.catalogVersion,commercial,offers,acceptance,attempt,recovery:value.recovery,termsVerified:false,
    planLabel:attempt?.planLabel || plans[subscription.plan],statusLabel,tone:trialCurrent || attempt?.paidCovered?'positive':'attention',
    trialCurrent,trialExpiryLabel:subscription.trialEndsAt === null?null:dateLabel(subscription.trialEndsAt),
    paymentLabel:attempt?.paidCovered?'Pago confirmado para el período vigente.':attempt?.paymentConfirmed?'Hay un pago registrado; el período vigente requiere confirmación.':'Todavía no hay un pago confirmado.',
    purchaseEligible:value.recovery === null && config.state === 'READY' && (attempt === null && ['TRIALING','CANCELED'].includes(subscription.status) || closedAttempt === true),canBegin:false,
    canCancel:attempt?.canCancel === true,
  });
}

// Hash the exact received UTF-8 text and immutable snapshots before showing a
// consent control. The synchronous projection alone cannot authorize a POST.
export async function companySubscriptionVerifiedView(value,expected = {}) {
  const projected = companySubscriptionView(value,expected),commercial = value.commercial;
  for (const offer of commercial.offers) {
    if (offer.termsText !== null && await sha(offer.termsText) !== offer.termsSha256 || await contractDigest(['company-subscription-commercial-offer-v1',pick(offer,offerFields)]) !== offer.offerDigest) fail();
  }
  if (await contractDigest(['company-subscription-commercial-catalog-v1',{version:1,catalogVersion:commercial.catalogVersion,offers:commercial.offers.map(offer => pick(offer,[...offerFields,'offerDigest']))}]) !== commercial.catalogDigest) fail();
  const receipt = value.acceptance;
  if (receipt && (await sha(receipt.offer.termsText) !== receipt.offer.termsSha256 || await contractDigest(['company-subscription-commercial-offer-v1',pick(receipt.offer,offerFields)]) !== receipt.offer.offerDigest || await contractDigest(['company-subscription-offer-acceptance-v1',pick(receipt,['version','receiptId','operationId','organizationId','actorBinding','catalogVersion','catalogDigest','offer','acceptedAt'])]) !== receipt.acceptanceDigest)) fail();
  const verified = freeze({...projected,termsVerified:true,canBegin:projected.purchaseEligible && projected.acceptance?.current === true && projected.acceptance.canCheckout === true});
  verifiedViews.add(verified);return verified;
}

export function companySubscriptionAcceptCommand(view,{scope,offerId,confirmed} = {}) {
  const selected = view?.offers?.find(offer => offer.id === offerId);
  if (!verifiedViews.has(view) || view.scope !== scope || !scopeValid(scope) || confirmed !== true || selected?.canAccept !== true || !selected.termsReady) fail('COMPANY_SUBSCRIPTION_REVIEW_REQUIRED');
  return {action:'accept_offer',scope,offerId:selected.id,catalogVersion:view.catalogVersion,catalogDigest:view.commercial.catalogDigest,offerDigest:selected.offerDigest,termsVersion:selected.termsVersion,termsSha256:selected.termsSha256,accepted:true};
}

export function companySubscriptionBeginCommand(view,{scope,offerId,confirmed} = {}) {
  const accepted = view?.acceptance;
  if (!verifiedViews.has(view) || view?.scope !== scope || !scopeValid(scope) || view?.canBegin !== true || confirmed !== true || accepted?.current !== true || accepted.offer.id !== offerId) fail('COMPANY_SUBSCRIPTION_REVIEW_REQUIRED');
  return {action:'begin',scope,offerId:accepted.offer.id,catalogVersion:accepted.catalogVersion,acceptanceReceiptId:accepted.receiptId,acceptanceDigest:accepted.acceptanceDigest};
}
export function companySubscriptionCancelCommand(view,{scope,confirmed} = {}) {
  if (view?.scope !== scope || !scopeValid(scope) || view?.canCancel !== true || confirmed !== true || !attemptId(view.attempt?.attemptId)) fail('COMPANY_SUBSCRIPTION_REVIEW_REQUIRED');
  return {action:'cancel_renewal',scope,subscriptionAttemptId:view.attempt.attemptId};
}

export function companySubscriptionErrorMessage(error,{mutation = false} = {}) {
  if ([401,403].includes(error?.status) || ['SESSION_REQUIRED','SESSION_INVALID','WORKSPACE_MEMBERSHIP_REQUIRED','WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'].includes(error?.code)) return 'Tu acceso a esta empresa requiere una nueva consulta. Volvé a ingresar.';
  if (error?.code === 'WORKSPACE_CONTEXT_CHANGED') return 'Cambió la empresa o tu acceso. Volvé a abrir la empresa correcta.';
  if (error?.code === 'COMPANY_SUBSCRIPTION_CONFIGURATION_PENDING') return 'El pago en línea todavía no está habilitado para esta empresa.';
  if (['COMPANY_SUBSCRIPTION_TERMS_PENDING','COMPANY_SUBSCRIPTION_CATALOG_CHANGED','COMPANY_SUBSCRIPTION_ACCEPTANCE_REQUIRED','COMPANY_SUBSCRIPTION_ACCEPTANCE_BINDING_REJECTED'].includes(error?.code)) return 'Las condiciones de esta oferta requieren una nueva consulta y aceptación.';
  if (error?.code === 'COMPANY_SUBSCRIPTION_REVIEW_REQUIRED') return 'Elegí el plan y revisá sus condiciones antes de continuar.';
  if (error?.code?.startsWith('WORKSPACE_RECOVERY_')) return 'No se pudo conservar o consultar el intento en este navegador. El pago queda bloqueado hasta recuperarlo.';
  if (mutation && error?.requestDispatched !== false) return 'La confirmación no llegó. Comprobá el mismo intento antes de continuar.';
  if (mutation) return 'No se pudo enviar la solicitud. Consultá el intento antes de continuar.';
  return 'No se pudo confirmar el estado de la suscripción. Actualizá la consulta.';
}

export const COMPANY_SUBSCRIPTION_RECOVERY_EVENT = 'obrasaas:company-subscription-pending';
const prefix = 'obrasaas.company-subscription-reference.v1.';
const referenceKeys = ['version','scope','organizationId','operationId','action','createdAt'];
const recoveryFailure = code => Object.assign(new Error(code),{code,status:409,requestDispatched:false});
function validReference(value) {
  return exact(value,referenceKeys) && value.version === 1 && scopeValid(value.scope) && id(value.organizationId) && uuid(value.operationId) && ['accept_offer','begin','cancel_renewal'].includes(value.action) && Number.isSafeInteger(value.createdAt) && value.createdAt >= 0;
}
const keyOf = value => `${prefix}${value.scope}.${value.organizationId}`;
function storedReference(key,raw) {
  let value;try {value = JSON.parse(raw);} catch {throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');}
  if (!validReference(value) || key !== keyOf(value)) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
  return value;
}
const notify = () => {try {globalThis.window?.dispatchEvent(new Event(COMPANY_SUBSCRIPTION_RECOVERY_EVENT));} catch { /* A saved reference remains authoritative. */ }};

// Reference only, committed before dispatch. Unknown results never age out into
// a new charge. The storage adapter already serializes reservations across tabs.
export function createCompanySubscriptionJournal({withStorage = createBrowserRecoveryStorage({prefix,validateStored:storedReference}),now = Date.now,onChange = notify} = {}) {
  const list = async (scope,signal) => withStorage('readonly',scope,storage => {
    if (storage.length > 16) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
    const rows = [];
    for (let index = 0;index < storage.length;index++) {const key = storage.key(index);const row = storedReference(key,storage.getItem(key));if (row.scope !== scope || row.createdAt > now() + 60000) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');rows.push(row);}
    return rows;
  },signal);
  return {
    list,
    async read(scope,organizationId,signal) {if (!id(organizationId)) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');return (await list(scope,signal)).find(row => row.organizationId === organizationId) || null;},
    async reserve(value,signal) {
      if (!validReference(value) || value.createdAt > now() + 5000 || now() - value.createdAt > 60000) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
      const saved = await withStorage('readwrite',value.scope,storage => {
        if (storage.length > 16) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
        const key = keyOf(value),existing = storage.getItem(key);
        if (existing !== null) {const row = storedReference(key,existing);if (row.operationId !== value.operationId || row.action !== value.action) throw recoveryFailure('WORKSPACE_RECOVERY_PENDING');return row;}
        if (storage.length >= 16) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
        storage.setItem(key,JSON.stringify(value));return {...value};
      },signal);
      const checked = await this.read(value.scope,value.organizationId,signal);
      if (!checked || checked.operationId !== saved.operationId || checked.action !== saved.action) throw recoveryFailure('WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
      onChange();return checked;
    },
    async settle(reference,view,signal) {
      if (!validReference(reference) || view?.scope !== reference.scope || view.organizationId !== reference.organizationId) return false;
      if (reference.action === 'accept_offer' && (!verifiedViews.has(view) || view.acceptance?.operationId !== reference.operationId || view.acceptance.state !== 'TERMS_ACCEPTED')) return false;
      const noDispatch = exact(view.recovery,['operationId','state']) && view.recovery.operationId === reference.operationId && view.recovery.state === 'NO_DISPATCH' && view.attempt === null;
      if (!noDispatch && reference.action === 'begin' && (view.attempt?.operationId !== reference.operationId || ['DISPATCHING','UNKNOWN','CANCEL_REQUESTED'].includes(view.attempt.state))) return false;
      if (!noDispatch && reference.action === 'cancel_renewal' && (view.attempt?.cancellation?.operationId !== reference.operationId || view.attempt.cancellation.state !== 'CONFIRMED' || view.attempt.cancelAtPeriodEnd !== true)) return false;
      await withStorage('readwrite',reference.scope,storage => {const key = keyOf(reference),raw = storage.getItem(key);if (raw === null) return;const row = storedReference(key,raw);if (row.operationId !== reference.operationId || row.action !== reference.action) throw recoveryFailure('WORKSPACE_RECOVERY_PENDING');storage.removeItem(key);},signal);
      onChange();return true;
    },
  };
}
export const browserCompanySubscriptionJournal = createCompanySubscriptionJournal();
