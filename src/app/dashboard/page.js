import DashboardClient from './dashboard-client';
import { getPlatformAccess, hasTenantPermission, requireTenantPermission } from '@/lib/access';
import { getAppState, getMessages } from '@/lib/db';
import { getPrisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const access = await getPlatformAccess({ requireOrganization: false });
  if (!access.organization || !access.project) {
    redirect('/session-tasks/choose-organization');
  }
  requireTenantPermission(access, 'org:projects:read');

  const prisma = getPrisma();
  const [initialState, initialMessages, whatsapp, membershipCount, snapshot] = await Promise.all([
    getAppState(access),
    getMessages(access),
    prisma.whatsAppConnection.findUnique({
      where: { projectId: access.project.id },
      select: { enabled: true, connectionStatus: true, lastVerifiedAt: true },
    }),
    prisma.tenantMembership.count({
      where: { organizationId: access.organization.id, status: 'ACTIVE' },
    }),
    prisma.projectSnapshot.findUnique({
      where: { projectId: access.project.id },
      select: { updatedAt: true },
    }),
  ]);
  return (
    <DashboardClient
      initialState={initialState}
      initialMessages={initialMessages}
      setup={{
        initialLoadedAt: new Date().toISOString(),
        membershipCount,
        whatsappConnected: Boolean(
          whatsapp?.enabled && whatsapp.connectionStatus === 'CONNECTED',
        ),
        whatsappStatus: whatsapp?.connectionStatus || 'PENDING',
        whatsappLastVerifiedAt: whatsapp?.lastVerifiedAt?.toISOString() || null,
        isDemoData: !snapshot,
        lastDataAt: snapshot?.updatedAt?.toISOString() || null,
        canViewTeam: hasTenantPermission(access, 'tenant:members:read'),
        canManageIntegrations: hasTenantPermission(access, 'org:integrations:manage'),
      }}
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
          address: access.project.address,
          status: access.project.status,
        },
      }}
    />
  );
}
