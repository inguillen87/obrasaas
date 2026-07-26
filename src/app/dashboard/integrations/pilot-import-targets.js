import { databaseOrganizationIsInternal } from "@/lib/organization-policy";
import { subscriptionAllowsWrites } from "@/lib/plans";
import { tenantRoleHasPortfolioAccess } from "@/lib/project-access";
import { roleHasPermission } from "@/lib/tenant-roles";

const PILOT_IMPORT_PERMISSION = "org:integrations:manage";
const MAX_PILOT_TENANTS = 50;
const MAX_PROJECTS_PER_TENANT = 100;

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

export async function listWhatsAppPilotImportTargets(
  prisma,
  access,
  { now = new Date() } = {},
) {
  if (access?.isSuperadmin !== true || !access.databaseUserId) return [];

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

  return memberships
    .filter(
      (membership) =>
        membership.status === "ACTIVE" &&
        membership.organization &&
        !databaseOrganizationIsInternal(membership.organization) &&
        subscriptionAllowsWrites(membership.organization, now) &&
        roleHasPermission(membership.tenantRole, PILOT_IMPORT_PERMISSION),
    )
    .map((membership) => ({
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      projects: publicProjectsForMembership(membership),
    }))
    .filter((target) => target.projects.length > 0)
    .sort((left, right) =>
      left.organizationName.localeCompare(right.organizationName, "es"),
    );
}
