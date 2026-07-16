import PlatformProvider from '@/app/platform-provider';

export default function PresupuestoLayout({ children }) {
  return <PlatformProvider includeIcons>{children}</PlatformProvider>;
}
