import PlatformProvider from '@/app/platform-provider';

export default function SessionTasksLayout({ children }) {
  return <PlatformProvider>{children}</PlatformProvider>;
}
