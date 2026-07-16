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
      'Evidencia centralizada y soporte estándar',
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
      'Portfolio multiobra y 50 usuarios de gestión',
      'Hasta 500 colaboradores de campo',
      'Roles organizacionales y auditoría centralizada',
      'Configuración dedicada de Meta, IA y almacenamiento',
      'Onboarding técnico y soporte prioritario',
    ],
  },
};

export const VARIABLE_COST_NOTE =
  'Los cargos variables de Meta, IA y almacenamiento extraordinario se informan por separado y se trasladan sin margen oculto.';

export const PRICING_BASIS_NOTE =
  'Precio por organización, no por cada colaborador de campo. Los límites visibles evitan sorpresas y el plan Enterprise parte de una base publicada.';

export function fieldUserCapacity({ plan, activeCount }) {
  const limit = PLAN_CATALOG[plan]?.limits.fieldUsers ?? 0;
  const used = Math.max(0, Number.isFinite(Number(activeCount)) ? Number(activeCount) : 0);
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    canActivate: used < limit,
  };
}

export function officeUserCapacity({
  plan,
  activeMemberships,
  pendingInvitations,
}) {
  const limit = PLAN_CATALOG[plan]?.limits.officeUsers ?? 0;
  const active = Math.max(
    0,
    Number.isSafeInteger(activeMemberships) ? activeMemberships : 0,
  );
  const pending = Math.max(
    0,
    Number.isSafeInteger(pendingInvitations) ? pendingInvitations : 0,
  );
  const used = active + pending;

  return {
    plan,
    limit,
    activeMemberships: active,
    pendingInvitations: pending,
    used,
    remaining: Math.max(0, limit - used),
    canInvite: used < limit,
  };
}

export class OfficeSeatLimitError extends Error {
  constructor(capacity) {
    const planName = PLAN_CATALOG[capacity.plan]?.name || 'actual';
    super(
      `El plan ${planName} permite hasta ${capacity.limit} usuarios de gestión entre miembros activos e invitaciones pendientes.`,
    );
    this.name = 'OfficeSeatLimitError';
    this.code = 'OFFICE_SEAT_LIMIT_REACHED';
    this.capacity = capacity;
  }
}

export class OfficeSeatCheckError extends Error {
  constructor(cause) {
    super('No se pudo verificar el cupo de usuarios de gestión.', { cause });
    this.name = 'OfficeSeatCheckError';
    this.code = 'OFFICE_SEAT_CHECK_UNAVAILABLE';
  }
}

const OFFICE_SEAT_LOCK_MAX_WAIT_MS = 5_000;
const OFFICE_SEAT_TRANSACTION_TIMEOUT_MS = 20_000;

class OfficeInvitationCreationPassthrough extends Error {
  constructor(cause) {
    super('Clerk rechazó la creación de la invitación.', { cause });
    this.name = 'OfficeInvitationCreationPassthrough';
  }
}

function officeUserLimit(plan) {
  const limit = PLAN_CATALOG[plan]?.limits.officeUsers;
  // Clerk treats zero as unlimited, so an unknown or malformed plan must never
  // be synchronized as zero. Invalid entitlement state fails closed instead.
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new OfficeSeatCheckError(
      new Error(`El plan ${String(plan || 'desconocido')} no tiene un cupo de oficina válido.`),
    );
  }
  return limit;
}

async function synchronizeClerkOfficeLimit({
  organizations,
  organizationId,
  limit,
}) {
  if (
    typeof organizations?.getOrganization !== 'function'
    || typeof organizations?.updateOrganization !== 'function'
  ) {
    throw new Error('El cliente de Clerk no permite verificar y sincronizar el cupo de la organización.');
  }

  const organization = await organizations.getOrganization({ organizationId });
  if (organization?.maxAllowedMemberships === limit) return;

  const updated = await organizations.updateOrganization(organizationId, {
    maxAllowedMemberships: limit,
  });
  if (updated?.maxAllowedMemberships !== limit) {
    throw new Error('Clerk no confirmó el cupo de membresías solicitado.');
  }
}

function exactClerkTotal(page, resourceName) {
  if (!Number.isSafeInteger(page?.totalCount) || page.totalCount < 0) {
    throw new Error(`Clerk no devolvió un total exacto de ${resourceName}.`);
  }
  return page.totalCount;
}

export async function createOfficeInvitationWithinPlan({
  prisma,
  organizations,
  organizationId,
  plan,
  invitationParams,
}) {
  const normalizedOrganizationId = typeof organizationId === 'string'
    ? organizationId.trim()
    : '';
  if (!normalizedOrganizationId) {
    throw new OfficeSeatCheckError(new Error('La organización de Clerk es obligatoria.'));
  }

  const limit = officeUserLimit(plan);
  if (
    typeof prisma?.$transaction !== 'function'
    || typeof organizations?.getOrganizationMembershipList !== 'function'
    || typeof organizations?.getOrganizationInvitationList !== 'function'
    || typeof organizations?.createOrganizationInvitation !== 'function'
  ) {
    throw new OfficeSeatCheckError(
      new Error('No está disponible la infraestructura necesaria para reservar el cupo.'),
    );
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      try {
        await transaction.$executeRawUnsafe(
          `SET LOCAL lock_timeout = '${OFFICE_SEAT_LOCK_MAX_WAIT_MS}ms'`,
        );
        await transaction.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          `obrasaas:office-seats:${normalizedOrganizationId}`,
        );

        await synchronizeClerkOfficeLimit({
          organizations,
          organizationId: normalizedOrganizationId,
          limit,
        });

        // Read reservations first so an invitation accepted between both reads
        // is conservatively counted twice instead of disappearing from totals.
        const pendingInvitations = await organizations.getOrganizationInvitationList({
          organizationId: normalizedOrganizationId,
          status: ['pending'],
          limit: 1,
          offset: 0,
        });
        const memberships = await organizations.getOrganizationMembershipList({
          organizationId: normalizedOrganizationId,
          limit: 1,
          offset: 0,
        });

        const capacity = officeUserCapacity({
          plan,
          activeMemberships: exactClerkTotal(memberships, 'membresías'),
          pendingInvitations: exactClerkTotal(pendingInvitations, 'invitaciones pendientes'),
        });
        if (!capacity.canInvite) {
          throw new OfficeSeatLimitError(capacity);
        }

        try {
          // organizationId is authoritative and intentionally overwrites any
          // caller-controlled value.
          const invitation = await organizations.createOrganizationInvitation({
            ...invitationParams,
            organizationId: normalizedOrganizationId,
          });
          return { invitation, capacity };
        } catch (error) {
          // Preserve Clerk's public 4xx response instead of misclassifying it as
          // an unavailable seat check at the transaction boundary.
          throw new OfficeInvitationCreationPassthrough(error);
        }
      } catch (error) {
        if (
          error instanceof OfficeSeatLimitError
          || error instanceof OfficeInvitationCreationPassthrough
        ) {
          throw error;
        }
        throw new OfficeSeatCheckError(error);
      }
    }, {
      maxWait: OFFICE_SEAT_LOCK_MAX_WAIT_MS,
      timeout: OFFICE_SEAT_TRANSACTION_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof OfficeInvitationCreationPassthrough) throw error.cause;
    if (error instanceof OfficeSeatLimitError || error instanceof OfficeSeatCheckError) {
      throw error;
    }
    throw new OfficeSeatCheckError(error);
  }
}

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
