import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../../lib/production-identity-config.mjs';
import styles from '../../identity.module.css';
export const metadata = { title: 'Crear cuenta · ObraSaaS' };
export default function SignUpPage() {
  if (!sessionIdentityConfig().configured) return null;
  return <section className={styles.card}>
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
    <h1>Creá tu cuenta</h1>
    <p className={styles.lead}>Verificá tu correo. Crear una identidad no incorpora automáticamente datos de empresas ni habilita operaciones de obra.</p>
    <div className={styles.widget}><SignUp routing="path" path="/sign-up" signInUrl="/sign-in"
      forceRedirectUrl="/cuenta" /></div>
    <p className={styles.note}>Las invitaciones y pertenencias empresariales se validan antes de habilitar información privada.</p>
  </section>;
}
