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
  return <ClerkProvider publishableKey={setup.publishableKey}
    localization={{ ...esES,
      formFieldInputPlaceholder__emailAddress:'Tu correo electrónico',
      formFieldInputPlaceholder__password:'Ingresá tu contraseña',
      formFieldInputPlaceholder__signUpPassword:'Creá una contraseña',
      signIn:{...esES.signIn,start:{...esES.signIn.start,title:'Ingresá',actionText:'¿No tenés cuenta?',actionLink:'Crear cuenta'}},
      signUp:{...esES.signUp,start:{...esES.signUp.start,title:'Datos de acceso',titleCombined:'Datos de acceso',actionText:'¿Ya tenés una cuenta?',actionLink:'Ingresar'}} }}
    signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/"
    signInFallbackRedirectUrl="/cuenta" signUpFallbackRedirectUrl="/cuenta"
    allowedRedirectOrigins={[setup.origin]}
    appearance={{ options: { socialButtonsVariant:'blockButton',socialButtonsPlacement:'top' }, variables: { colorPrimary:'#f4b049',colorPrimaryForeground:'#121b2a',
      colorBackground:'#111b2b',colorForeground:'#eef4ff',colorMuted:'#19283d',
      colorMutedForeground:'#bac9de',colorNeutral:'#eef4ff',colorInput:'#09101d',
      colorInputForeground:'#eef4ff',colorBorder:'#6c809c',colorRing:'#acd1ff',
      colorDanger:'#ffb4ab',colorSuccess:'#87dcb5',colorWarning:'#f4b049',
      borderRadius:'0.7rem',fontFamily:'Inter, Arial, sans-serif' } }}>
    <main className={styles.shell}>{children}</main>
  </ClerkProvider>;
}
