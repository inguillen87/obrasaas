import { getPlatformAccess, requireTenantPermission, hasTenantPermission } from '@/lib/access';
import { INSPECTION_TEMPLATES } from '@/lib/site-inspections';
import InspectionWorkspace from './workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inspecciones de obra', robots: { index: false, follow: false } };
export default async function InspectionsPage() {
  const access = await getPlatformAccess();
  requireTenantPermission(access, 'org:execution:read', { subscriptionMode: 'read' });
  return <InspectionWorkspace
    projectName={access.project.name}
    templates={INSPECTION_TEMPLATES}
    canManage={hasTenantPermission(access, 'org:execution:manage')}
    canReview={hasTenantPermission(access, 'org:inspections:approve')}
  />;
}
