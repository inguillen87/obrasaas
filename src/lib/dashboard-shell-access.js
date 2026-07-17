import { requireTenantPermission } from './access.js';

export const DASHBOARD_SHELL_READ_PERMISSION = 'org:projects:read';

export function requireDashboardShellReadAccess(access) {
  return requireTenantPermission(access, DASHBOARD_SHELL_READ_PERMISSION);
}

export function dashboardProjectAccessRequiredModel(access) {
  if (!access?.organization || access.project) return null;
  return {
    email: access.email,
    tenantRole: access.tenantRole,
    organization: { name: access.organization.name },
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
