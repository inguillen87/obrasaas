import { hasTenantPermission, requireTenantPermission } from './access.js';

export const DASHBOARD_SHELL_READ_PERMISSION = 'org:projects:read';
export const TENANT_PRIVACY_CONTROL_PERMISSION = 'org:privacy:requests:manage';

export function canAccessTenantPrivacyControl(access) {
  return Boolean(
    access?.organization?.id
    && access?.tenantMembershipId
    && access?.databaseTenantRole === 'ADMIN'
    && hasTenantPermission(access, TENANT_PRIVACY_CONTROL_PERMISSION),
  );
}

export function requireDashboardShellReadAccess(access) {
  return requireTenantPermission(access, DASHBOARD_SHELL_READ_PERMISSION);
}

export function dashboardProjectAccessRequiredModel(access) {
  if (!access?.organization || access.project) return null;
  return {
    email: access.email,
    tenantRole: access.tenantRole,
    organization: { name: access.organization.name },
    canManagePrivacy: canAccessTenantPrivacyControl(access),
  };
}

export function resolveDashboardShellAccessState(access) {
  if (!access?.organization) return { kind: 'NO_ORGANIZATION' };
  requireDashboardShellReadAccess(access);
  const projectAccessRequired = dashboardProjectAccessRequiredModel(access);
  if (projectAccessRequired) {
    return { kind: 'PROJECT_ACCESS_REQUIRED', projectAccessRequired };
  }
  return { kind: 'READY' };
}
