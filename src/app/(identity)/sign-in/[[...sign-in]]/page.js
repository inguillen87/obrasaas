import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../../lib/production-identity-config.mjs';
import styles from '../../identity.module.css';
export const metadata = { title: 'Ingresar · ObraSaaS' };
export default function SignInPage() {
  if (!sessionIdentityConfig().configured) return null;
  return <section className={styles.card}>
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
    <h1>Ingresá a tu cuenta</h1>
    <p className={styles.lead}>Autenticación segura para tu identidad. El acceso a cada empresa y obra se asigna por separado.</p>
    <div className={styles.widget}><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up"
      forceRedirectUrl="/cuenta" signUpForceRedirectUrl="/cuenta" /></div>
    <p className={styles.note}>Nunca te pediremos claves de API ni credenciales de tu empresa para iniciar sesión.</p>
  </section>;
}
