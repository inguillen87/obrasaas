export const PLAN_CATALOG = {
  TRIAL: {
    key: 'TRIAL',
    name: 'Prueba completa',
    priceMonthly: 0,
    priceAnnualMonthly: 0,
    trialDays: 14,
    description: 'Validá ObraSaaS en una obra real antes de decidir.',
    limits: { officeUsers: 3, fieldUsers: 20, activeProjects: 1 },
    features: [
      '1 obra activa y 3 usuarios de gestión',
      'Hasta 20 colaboradores de campo',
      'Bitácora, tareas, asistencia y evidencias',
      'Recorrido guiado de WhatsApp y Flows',
    ],
  },
  PRO: {
    key: 'PRO',
    name: 'Pro',
    priceMonthly: 199,
    priceAnnualMonthly: 159,
    description: 'Para estudios y constructoras que coordinan varias obras.',
    limits: { officeUsers: 10, fieldUsers: 100, activeProjects: 10 },
    features: [
      '10 obras activas y 10 usuarios de gestión',
      'Hasta 100 colaboradores de campo',
      'WhatsApp Cloud API, Flows y webviews seguros',
      'Gantt, reportes, geocercas y control de insumos',
      '100 GB de evidencia y soporte estándar',
    ],
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    priceMonthly: 699,
    priceAnnualMonthly: 699,
    pricePrefix: 'Desde',
    description: 'Para grandes organizaciones, portfolios y sector público.',
    limits: { officeUsers: 50, fieldUsers: 500, activeProjects: null },
    features: [
      'Obras activas ilimitadas y 50 usuarios de gestión',
      'Hasta 500 colaboradores de campo',
      'Portfolio multiempresa, roles avanzados y auditoría',
      'SSO, API, webhooks e integraciones bajo implementación',
      'Onboarding dedicado, SLA y soporte prioritario',
    ],
  },
};

export const VARIABLE_COST_NOTE =
  'Los cargos variables de Meta, IA y almacenamiento extraordinario se informan por separado y se trasladan sin margen oculto.';

export function getSubscriptionEntitlements(organization, now = new Date()) {
  const status = organization?.subscriptionStatus || 'TRIALING';
  const plan = organization?.subscriptionPlan || 'TRIAL';
  const trialEndsAt = organization?.trialEndsAt
    ? new Date(organization.trialEndsAt)
    : null;
  const trialExpired = status === 'TRIALING'
    && (!trialEndsAt || trialEndsAt.getTime() < now.getTime());
  const suspended = status === 'SUSPENDED';
  const canWrite = !suspended && (
    status === 'ACTIVE'
    || (status === 'TRIALING' && !trialExpired)
  );
  const canRead = !suspended;
  const millisecondsRemaining = trialEndsAt
    ? Math.max(0, trialEndsAt.getTime() - now.getTime())
    : 0;

  return {
    plan,
    status: trialExpired ? 'TRIAL_EXPIRED' : status,
    trialEndsAt,
    trialDaysRemaining: status === 'TRIALING'
      ? Math.ceil(millisecondsRemaining / (24 * 60 * 60 * 1_000))
      : null,
    canRead,
    canWrite,
  };
}
