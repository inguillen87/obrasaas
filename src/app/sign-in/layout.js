import PlatformProvider from '@/app/platform-provider';

export default function SignInLayout({ children }) {
  return <PlatformProvider>{children}</PlatformProvider>;
}
