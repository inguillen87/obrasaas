const PLANS = new Set(['TRIAL', 'PRO', 'ENTERPRISE']);
const STATUSES = new Set(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'SUSPENDED']);

export class TenantSubscriptionUpdateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantSubscriptionUpdateError';
  }
}

function parseTrialEnd(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TenantSubscriptionUpdateError('La fecha de prueba debe usar el formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T23:59:59.999Z`);
  const [year, month, day] = value.split('-').map(Number);
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new TenantSubscriptionUpdateError('La fecha de prueba es inválida.');
  }
  return date;
}

export function normalizeTenantSubscriptionUpdate(body, current, now = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TenantSubscriptionUpdateError('La actualización del tenant es inválida.');
  }

  const subscriptionPlan = body.subscriptionPlan ?? current.subscriptionPlan;
  const subscriptionStatus = body.subscriptionStatus ?? current.subscriptionStatus;
  if (!PLANS.has(subscriptionPlan)) {
    throw new TenantSubscriptionUpdateError('El plan seleccionado no existe.');
  }
  if (!STATUSES.has(subscriptionStatus)) {
    throw new TenantSubscriptionUpdateError('El estado seleccionado no existe.');
  }

  const hasTrialEnd = Object.prototype.hasOwnProperty.call(body, 'trialEndsAt');
  const trialEndsAt = hasTrialEnd
    ? parseTrialEnd(body.trialEndsAt)
    : current.trialEndsAt;

  if (subscriptionStatus === 'TRIALING') {
    if (subscriptionPlan !== 'TRIAL') {
      throw new TenantSubscriptionUpdateError('Una organización en prueba debe usar el plan Trial.');
    }
    if (!trialEndsAt || new Date(trialEndsAt).getTime() <= now.getTime()) {
      throw new TenantSubscriptionUpdateError('La prueba debe finalizar en una fecha futura.');
    }
  }

  if (subscriptionPlan === 'TRIAL' && ['ACTIVE', 'PAST_DUE'].includes(subscriptionStatus)) {
    throw new TenantSubscriptionUpdateError('Los estados Active y Past due requieren Pro o Enterprise.');
  }
  if (subscriptionPlan !== 'TRIAL' && subscriptionStatus === 'TRIALING') {
    throw new TenantSubscriptionUpdateError('Pro y Enterprise no pueden permanecer en estado Trialing.');
  }

  const previousTrial = current.trialEndsAt ? new Date(current.trialEndsAt).getTime() : null;
  const nextTrial = trialEndsAt ? new Date(trialEndsAt).getTime() : null;
  const changes = {};
  if (subscriptionPlan !== current.subscriptionPlan) {
    changes.subscriptionPlan = { from: current.subscriptionPlan, to: subscriptionPlan };
  }
  if (subscriptionStatus !== current.subscriptionStatus) {
    changes.subscriptionStatus = { from: current.subscriptionStatus, to: subscriptionStatus };
  }
  if (previousTrial !== nextTrial) {
    changes.trialEndsAt = {
      from: current.trialEndsAt ? new Date(current.trialEndsAt).toISOString() : null,
      to: trialEndsAt ? new Date(trialEndsAt).toISOString() : null,
    };
  }
  if (Object.keys(changes).length === 0) {
    throw new TenantSubscriptionUpdateError('No hay cambios para guardar.');
  }

  return {
    data: {
      subscriptionPlan,
      subscriptionStatus,
      trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
    },
    changes,
  };
}

export function isExternalTenant(organization) {
  return Boolean(
    organization
    && organization.clerkOrganizationId !== 'system:obrasaas'
    && organization.metadata?.internal !== true,
  );
}
