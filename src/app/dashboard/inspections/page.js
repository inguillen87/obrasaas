import { notFound } from 'next/navigation';
import { getPlatformAccess, requireTenantPermission, hasTenantPermission } from '@/lib/access';
import { INSPECTION_TEMPLATES, InspectionError } from '@/lib/site-inspections';
import { getInspection } from '@/lib/site-inspection-store';
import { getPrisma } from '@/lib/prisma';
import InspectionWorkspace from './workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inspecciones de obra', robots: { index: false, follow: false } };
export default async function InspectionsPage({ searchParams }) {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  const { inspection: id } = await searchParams;
  let initialRecord = null;
  if (id !== undefined) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,190}$/.test(id)) notFound();
    try {
      initialRecord = await getInspection(getPrisma(), {
        scope: { organizationId: access.organization.id, projectId: access.project.id }, id,
      });
    } catch (error) {
      if (error instanceof InspectionError && error.status === 404) notFound();
      throw error;
    }
  }
  return <InspectionWorkspace
    key={access.project.id}
    projectName={access.project.name}
    templates={INSPECTION_TEMPLATES}
    initialRecord={initialRecord ? JSON.parse(JSON.stringify(initialRecord)) : null}
    canManage={hasTenantPermission(access, 'org:execution:manage')}
    canReview={hasTenantPermission(access, 'org:inspections:approve')}
  />;
}
