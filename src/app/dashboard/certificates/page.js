import { getPlatformAccess, requireTenantPermission } from '@/lib/access';
import { getPrisma } from '@/lib/prisma';
import { localDateKey } from '@/lib/zoned-time';
import { normalizeProjectCertificateReadQuery, readProjectCertificateSnapshot, requireProjectCertificateRouteMembership } from '@/lib/project-certificates';
import CertificateClient from './certificate-client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Certificaciones contractuales', description: 'Preparación y dictamen de certificados por quincena.', robots: { index:false, follow:false } };

export default async function CertificatesPage() {
  const access=await getPlatformAccess();
  requireTenantPermission(access,'org:certificates:read',{subscriptionMode:'read'});
  const actorMembershipId=access.tenantMembershipId;
  if (!actorMembershipId) throw new Error('TENANT_PROJECT_MEMBERSHIP_REQUIRED');
  const prisma=getPrisma();
  const scope={organizationId:access.organization.id,projectId:access.project.id};
  await requireProjectCertificateRouteMembership(prisma,{scope,actorMembershipId});
  const periodDate=localDateKey(new Date(),access.organization.timezone);
  const query=normalizeProjectCertificateReadQuery(new URLSearchParams({periodDate}));
  const snapshot=await readProjectCertificateSnapshot(prisma,{scope,actorMembershipId,query});
  return <CertificateClient initialSnapshot={snapshot} initialPeriodDate={periodDate} projectName={access.project.name} scope={scope} actorMembershipId={actorMembershipId}/>;
}
