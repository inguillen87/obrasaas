import {
  AccessError,
  getPlatformAccess,
  hasTenantPermission,
  requireTenantPermission,
} from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { readProjectContractSnapshot } from '@/lib/project-contracts';
import { localDateKey } from '@/lib/zoned-time';

import ContractsClient from './contracts-client';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Contrato y SOV',
  description: 'Autoridad contractual y Schedule of Values versionada por obra.',
  robots: { index: false, follow: false, nocache: true },
};

function memberOption(membership) {
  return {
    id: membership.id,
    label: membership.user.fullName || membership.user.primaryEmail,
    tenantRole: membership.tenantRole,
  };
}

export default async function ContractsPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:contracts:read', { subscriptionMode: 'read' });
  if (!access.tenantMembershipId) {
    throw new AccessError('Una membresía activa en la organización es obligatoria.', {
      code: 'TENANT_MEMBERSHIP_REQUIRED',
      status: 403,
    });
  }

  const prisma = getPrisma();
  const scope = {
    organizationId: access.organization.id,
    projectId: access.project.id,
  };
  const canReadMembers = hasTenantPermission(access, 'tenant:members:read');
  const [initialSnapshot, authorityMemberships] = await Promise.all([
    readProjectContractSnapshot(prisma, {
      scope,
      actorMembershipId: access.tenantMembershipId,
    }),
    canReadMembers ? prisma.tenantMembership.findMany({
      where: {
        organizationId: access.organization.id,
        status: 'ACTIVE',
        tenantRole: { in: ['ADMIN', 'DIRECTOR', 'FINANCE'] },
        projectMemberships: {
          some: { projectId: access.project.id, status: 'ACTIVE' },
        },
      },
      orderBy: [
        { tenantRole: 'asc' },
        { user: { fullName: 'asc' } },
        { id: 'asc' },
      ],
      select: {
        id: true,
        tenantRole: true,
        user: { select: { fullName: true, primaryEmail: true } },
      },
    }) : Promise.resolve([]),
  ]);

  const members = authorityMemberships.map(memberOption);

  return (
    <ContractsClient
      authorityCandidates={{
        certifiers: members.filter((member) => member.tenantRole === 'DIRECTOR'),
        finances: members.filter((member) => member.tenantRole === 'FINANCE'),
        registrars: members.filter((member) => member.tenantRole === 'ADMIN'),
      }}
      initialSnapshot={initialSnapshot}
      organizationName={access.organization.name}
      projectName={access.project.name}
      scope={scope}
      tenantToday={localDateKey(new Date(), access.organization.timezone)}
    />
  );
}
