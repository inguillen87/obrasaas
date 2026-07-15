import DashboardClient from './dashboard-client';
import { getPlatformAccess, requireTenantPermission } from '@/lib/access';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:projects:read');
  return (
    <DashboardClient
      platformAccess={{
        email: access.email,
        isSuperadmin: access.isSuperadmin,
        systemRole: access.systemRole,
        orgRole: access.orgRole,
        tenantRole: access.tenantRole,
        organization: {
          name: access.organization.name,
          plan: access.organization.subscriptionPlan,
          subscriptionStatus: access.organization.subscriptionStatus,
          trialEndsAt: access.organization.trialEndsAt?.toISOString() || null,
        },
        project: {
          id: access.project.id,
          name: access.project.name,
        },
      }}
    />
  );
}
