import PlatformProvider from '@/app/platform-provider';
import '../platform.css';

export const metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }) {
  return <PlatformProvider includeIcons>{children}</PlatformProvider>;
}
