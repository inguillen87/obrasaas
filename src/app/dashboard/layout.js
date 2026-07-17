import PlatformProvider from '@/app/platform-provider';
import { getDashboardShellModel } from '@/lib/dashboard-shell';
import DashboardShell from './dashboard-shell';
import ProjectAccessRequired from './project-access-required';
import '../platform.css';

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }) {
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
