import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import AccessNotice from '../access-notice';
import { sessionIdentityConfig } from '../../lib/production-identity-config.mjs';
import styles from './identity.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default function IdentityLayout({ children }) {
  const setup = sessionIdentityConfig();
  if (!setup.configured) return <AccessNotice />;
  return <ClerkProvider publishableKey={setup.publishableKey} localization={esES}
    signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/"
    signInFallbackRedirectUrl="/cuenta" signUpFallbackRedirectUrl="/cuenta"
    allowedRedirectOrigins={[setup.origin]}
    appearance={{ variables: { colorPrimary:'#f4b049',colorBackground:'#111b2b',
      colorText:'#eef4ff',colorTextSecondary:'#bac9de',colorInputBackground:'#09101d',
      colorInputText:'#eef4ff',borderRadius:'0.7rem',fontFamily:'Inter, Arial, sans-serif' } }}>
    <main className={styles.shell}>{children}</main>
  </ClerkProvider>;
}
