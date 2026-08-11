import PlatformProvider from '@/app/platform-provider';
import { headers } from 'next/headers';
import { getDashboardShellModel } from '@/lib/dashboard-shell';
import DashboardShell from './dashboard-shell';
import ProjectAccessRequired from './project-access-required';
import TenantPrivacyShell from './tenant-privacy-shell';
import '../platform.css';

const TENANT_PRIVACY_SURFACE_HEADER = 'x-obrasaas-dashboard-surface';
const TENANT_PRIVACY_SURFACE_VALUE = 'tenant-privacy-v1';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }) {
  const requestHeaders = await headers();
  if (
    requestHeaders.get(TENANT_PRIVACY_SURFACE_HEADER)
    === TENANT_PRIVACY_SURFACE_VALUE
  ) {
    return (
      <PlatformProvider>
        <TenantPrivacyShell>{children}</TenantPrivacyShell>
      </PlatformProvider>
    );
  }

  const shellModel = await getDashboardShellModel();
  return (
    <PlatformProvider includeIcons>
      {shellModel?.projectAccessRequired ? (
        <ProjectAccessRequired access={shellModel.projectAccessRequired} />
      ) : shellModel ? (
        <DashboardShell key={shellModel.project.id} model={shellModel}>
          {children}
        </DashboardShell>
      ) : children}
    </PlatformProvider>
  );
}
