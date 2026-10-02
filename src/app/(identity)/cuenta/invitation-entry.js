import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import styles from '../identity.module.css';

// Clerk handles its invitation on the original URL. No ticket is passed through
// component props, copied into another URL, or persisted by ObraSaaS.
export function InvitationEntry({ returnPath = '/cuenta' }) {
  return <section className={styles.card}>
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
    <h1>Aceptá tu invitación</h1>
    <p className={styles.lead}>Completá el ingreso con el correo invitado. Después confirmá tu participación en la obra.</p>
    <div className={styles.widget}><SignIn routing="hash" forceRedirectUrl={returnPath} signUpForceRedirectUrl={returnPath} /></div>
    <p className={styles.note}>El responsable de la obra define tu acceso.</p>
  </section>;
}
