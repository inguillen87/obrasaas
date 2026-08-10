import { databaseOrganizationIsInternal } from "@/lib/organization-policy";
import { getSubscriptionEntitlements } from "@/lib/plans";
import { tenantRoleHasPortfolioAccess } from "@/lib/project-access";
import { roleHasPermission } from "@/lib/tenant-roles";

const PILOT_IMPORT_PERMISSION = "org:integrations:manage";
const MAX_PILOT_TENANTS = 50;
const MAX_PROJECTS_PER_TENANT = 100;

const EMPTY_TARGET_STATES = Object.freeze({
  ACCESS_REQUIRED: Object.freeze({
    code: "ACCESS_REQUIRED",
    title: "No se pudo autorizar el destino piloto",
    description:
      "Volvé a ingresar con el superadmin habilitado para esta herramienta de Preview.",
  }),
  NO_ACTIVE_MEMBERSHIP: Object.freeze({
    code: "NO_ACTIVE_MEMBERSHIP",
    title: "No hay una asignación activa a un tenant piloto",
    description:
      "Activá la membresía del superadmin en el tenant externo que recibirá la conexión.",
  }),
  NO_EXTERNAL_TENANT: Object.freeze({
    code: "NO_EXTERNAL_TENANT",
    title: "No hay un tenant externo disponible",
    description:
      "La organización interna de ObraSaaS no puede recibir activos piloto de clientes.",
  }),
  PERMISSION_REQUIRED: Object.freeze({
    code: "PERMISSION_REQUIRED",
    title: "El rol asignado no administra integraciones",
    description:
      "Asigná al superadmin un rol con permiso de integraciones dentro del tenant externo.",
  }),
  TRIAL_EXPIRED: Object.freeze({
    code: "TRIAL_EXPIRED",
    title: "La prueba del tenant externo venció",
    description:
      "Extendé la prueba o activá la suscripción desde Administración global. La membresía ya está reconocida.",
  }),
  SUBSCRIPTION_BLOCKED: Object.freeze({
    code: "SUBSCRIPTION_BLOCKED",
    title: "La suscripción no permite cambios",
    description:
      "Regularizá o activá el tenant desde Administración global antes de importar la conexión.",
  }),
  NO_ACTIVE_PROJECT: Object.freeze({
    code: "NO_ACTIVE_PROJECT",
    title: "No hay una obra activa autorizada",
    description:
      "Activá una obra del tenant o asignala al rol actual antes de importar la conexión.",
  }),
});

export function whatsappPilotImportPanelEnabled(environment, access) {
  return (
    environment?.VERCEL_ENV === "preview" &&
    environment?.WHATSAPP_PILOT_IMPORT_ENABLED === "true" &&
    access?.isSuperadmin === true
  );
}

function activeAssignedProjects(membership) {
  return (membership.projectMemberships || [])
    .map((projectMembership) => projectMembership.project)
    .filter(
      (project) =>
        project?.status === "ACTIVE" &&
        project.organizationId === membership.organization.id,
    );
}

function publicProjectsForMembership(membership) {
  const projects = tenantRoleHasPortfolioAccess(membership.tenantRole)
    ? membership.organization.projects
    : activeAssignedProjects(membership);
  const unique = new Map();
  for (const project of projects || []) {
    if (project?.id && project?.name && project.status === "ACTIVE") {
      unique.set(project.id, { id: project.id, name: project.name });
    }
  }
  return [...unique.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "es"),
  );
}

export async function loadWhatsAppPilotImportTargetCatalog(
  prisma,
  access,
  { now = new Date() } = {},
) {
  if (access?.isSuperadmin !== true || !access.databaseUserId) {
    return { targets: [], emptyState: EMPTY_TARGET_STATES.ACCESS_REQUIRED };
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      userId: access.databaseUserId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      status: true,
      tenantRole: true,
      organization: {
        select: {
          id: true,
          name: true,
          clerkOrganizationId: true,
          metadata: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
          projects: {
            where: { status: "ACTIVE" },
            orderBy: [{ name: "asc" }, { id: "asc" }],
            take: MAX_PROJECTS_PER_TENANT,
            select: {
              id: true,
              name: true,
              status: true,
              organizationId: true,
            },
          },
        },
      },
      projectMemberships: {
        where: {
          status: "ACTIVE",
          project: { status: "ACTIVE" },
        },
        orderBy: { project: { name: "asc" } },
        take: MAX_PROJECTS_PER_TENANT,
        select: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
              organizationId: true,
            },
          },
        },
      },
    },
    orderBy: { organization: { name: "asc" } },
    take: MAX_PILOT_TENANTS,
  });

  const activeMemberships = memberships.filter(
    (membership) => membership.status === "ACTIVE" && membership.organization,
  );
  const externalMemberships = activeMemberships.filter(
    (membership) => !databaseOrganizationIsInternal(membership.organization),
  );
  const permittedMemberships = externalMemberships.filter((membership) =>
    roleHasPermission(membership.tenantRole, PILOT_IMPORT_PERMISSION),
  );
  const membershipEntitlements = permittedMemberships.map((membership) => ({
    membership,
    entitlements: getSubscriptionEntitlements(membership.organization, now),
  }));
  const writableMemberships = membershipEntitlements
    .filter(({ entitlements }) => entitlements.canWrite)
    .map(({ membership }) => membership);

  const targets = writableMemberships
    .map((membership) => ({
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      projects: publicProjectsForMembership(membership),
    }))
    .filter((target) => target.projects.length > 0)
    .sort((left, right) =>
      left.organizationName.localeCompare(right.organizationName, "es"),
    );

  if (targets.length > 0) return { targets, emptyState: null };
  if (activeMemberships.length === 0) {
    return { targets, emptyState: EMPTY_TARGET_STATES.NO_ACTIVE_MEMBERSHIP };
  }
  if (externalMemberships.length === 0) {
    return { targets, emptyState: EMPTY_TARGET_STATES.NO_EXTERNAL_TENANT };
  }
  if (permittedMemberships.length === 0) {
    return { targets, emptyState: EMPTY_TARGET_STATES.PERMISSION_REQUIRED };
  }
  if (writableMemberships.length === 0) {
    const hasExpiredTrial = membershipEntitlements.some(
      ({ entitlements }) => entitlements.status === "TRIAL_EXPIRED",
    );
    return {
      targets,
      emptyState: hasExpiredTrial
        ? EMPTY_TARGET_STATES.TRIAL_EXPIRED
        : EMPTY_TARGET_STATES.SUBSCRIPTION_BLOCKED,
    };
  }
  return { targets, emptyState: EMPTY_TARGET_STATES.NO_ACTIVE_PROJECT };
}

export async function listWhatsAppPilotImportTargets(
  prisma,
  access,
  options,
) {
  const catalog = await loadWhatsAppPilotImportTargetCatalog(
    prisma,
    access,
    options,
  );
  return catalog.targets;
}
