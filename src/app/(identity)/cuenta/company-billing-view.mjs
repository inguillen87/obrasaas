import {companyWhatsappOnboardingEntitlement} from '../../../lib/company-entitlement.mjs';

const plans = Object.freeze({TRIAL:'Prueba gratuita',PRO:'Pro',ENTERPRISE:'Enterprise'});
const statuses = Object.freeze({TRIALING:'En prueba',ACTIVE:'Suscripción activa',PAST_DUE:'Pago pendiente',CANCELED:'Suscripción cancelada',SUSPENDED:'Suscripción suspendida'});
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => record(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const scopeValid = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const name = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
function utcInstant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === (value.includes('.') ? value : value.replace('Z','.000Z'));
}
function fail(code = 'COMPANY_BILLING_RESULT_UNCONFIRMED') {
  throw Object.assign(new Error(code), {code});
}
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone:'America/Argentina/Buenos_Aires',
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
});
const dateLabel = value => `${dateFormatter.format(new Date(value))} (hora de Argentina)`;
const reasons = Object.freeze({
  COMPANY_ENTITLEMENT_TRIAL_EXPIRED:{status:'Prueba finalizada',description:'La prueba terminó. Hace falta activar un plan para habilitar la conexión de WhatsApp.'},
  COMPANY_ENTITLEMENT_TRIAL_EXPIRY_UNAVAILABLE:{status:'Vencimiento por revisar',description:'No hay un vencimiento válido registrado para esta prueba.'},
  COMPANY_ENTITLEMENT_ACTIVE_PLAN_UNSUPPORTED:{status:'Estado por revisar',description:'El plan y el estado de la suscripción requieren revisión.'},
  COMPANY_ENTITLEMENT_TRIAL_PLAN_MISMATCH:{status:'Estado por revisar',description:'El plan y el estado de la suscripción requieren revisión.'},
  COMPANY_ENTITLEMENT_PAST_DUE:{status:statuses.PAST_DUE,description:'La suscripción tiene un pago pendiente. La conexión de WhatsApp requiere un plan vigente.'},
  COMPANY_ENTITLEMENT_CANCELED:{status:statuses.CANCELED,description:'La suscripción está cancelada. La conexión de WhatsApp requiere un plan vigente.'},
  COMPANY_ENTITLEMENT_SUSPENDED:{status:statuses.SUSPENDED,description:'La suscripción está suspendida. La conexión de WhatsApp requiere un plan vigente.'},
});

// The server observation is the only clock used here. This is a display check,
// never a client-side authorization or a payment receipt.
export function companyBillingView(value, {scope} = {}) {
  if (!scopeValid(scope) || value?.scope !== scope) fail('WORKSPACE_CONTEXT_CHANGED');
  if (!exact(value,['version','scope','organization','observedAt','subscription','billing']) || value.version !== 1 || !scopeValid(value.scope)) fail();
  if (!exact(value.organization,['id','name']) || !id(value.organization.id) || !name(value.organization.name) || !utcInstant(value.observedAt)) fail();
  const subscription = value.subscription;
  if (!exact(subscription,['plan','status','trialEndsAt','entitlement']) || !Object.hasOwn(plans,subscription.plan) || !Object.hasOwn(statuses,subscription.status) || subscription.trialEndsAt !== null && !utcInstant(subscription.trialEndsAt)) fail();
  if (!exact(subscription.entitlement,['allowed','basis','reasonCode'])) fail();
  const checked = companyWhatsappOnboardingEntitlement({subscriptionPlan:subscription.plan,subscriptionStatus:subscription.status,trialEndsAt:subscription.trialEndsAt},{now:value.observedAt});
  if (['allowed','basis','reasonCode'].some(key => subscription.entitlement[key] !== checked[key])) fail();
  if (!exact(value.billing,['state','checkoutAvailable','paymentEvidence']) || value.billing.state !== 'CONFIGURATION_PENDING' || value.billing.checkoutAvailable !== false || value.billing.paymentEvidence !== 'UNOBSERVED') fail();
  const denied = reasons[checked.reasonCode];
  if (!checked.allowed && !denied) fail();
  return Object.freeze({
    companyName:value.organization.name,
    planLabel:plans[subscription.plan],
    statusLabel:denied?.status || statuses[subscription.status],
    tone:checked.allowed ? 'positive' : 'attention',
    entitlementLabel:denied?.description || (checked.basis === 'CURRENT_TRIAL' ? 'La prueba está vigente para configurar WhatsApp.' : 'Hay una suscripción vigente registrada para configurar WhatsApp.'),
    trialExpiryLabel:subscription.trialEndsAt === null ? null : dateLabel(subscription.trialEndsAt),
    observedAtLabel:dateLabel(value.observedAt),
    paymentLabel:'Comprobante de pago: no consultado.',
    checkoutLabel:'El pago en línea está pendiente de activación.',
  });
}

export function companyBillingErrorMessage(error) {
  if ([401,403].includes(error?.status) || ['SESSION_REQUIRED','SESSION_INVALID','WORKSPACE_MEMBERSHIP_REQUIRED','WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'].includes(error?.code)) return 'No se pudo confirmar tu acceso a esta empresa. Volvé a ingresar y consultá el plan.';
  if (error?.status === 409 || error?.code === 'WORKSPACE_CONTEXT_CHANGED') return 'Cambió la empresa o tu acceso. Volvé a abrir la empresa correcta antes de consultar el plan.';
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return 'La consulta no se completó. Podés volver a intentarlo.';
  if (error?.code === 'COMPANY_BILLING_RESULT_UNCONFIRMED') return 'No se pudo confirmar el estado del plan. Actualizá la consulta.';
  return 'No se pudo consultar el plan. Podés volver a intentarlo.';
}
