import { requireTenantPermission } from './access.js';

export const DASHBOARD_SHELL_READ_PERMISSION = 'org:projects:read';

export function requireDashboardShellReadAccess(access) {
  return requireTenantPermission(access, DASHBOARD_SHELL_READ_PERMISSION);
}
