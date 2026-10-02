import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../../lib/production-identity-config.mjs';
import { identityAccountReturnPath, identitySignInPath } from '../../../../lib/identity-return-path.mjs';
import styles from '../../identity.module.css';
import { IdentityWidget } from '../../identity-load-guard';
export const metadata = { title: 'Crear cuenta · ObraSaaS' };
export default async function SignUpPage({ searchParams }) {
  if (!sessionIdentityConfig().configured) return null;
  const query = await searchParams;
  const returnPath = identityAccountReturnPath(query);
  return <section className={styles.card}>
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
    <h1>Creá tu cuenta</h1>
    <p className={styles.lead}>Creá tu cuenta con Google o tu correo, según las opciones disponibles. Después podés abrir tu constructora o aceptar una invitación.</p>
    <div className={styles.widget}><IdentityWidget><SignUp routing="path" path="/sign-up" signInUrl={identitySignInPath(query)}
      forceRedirectUrl={returnPath} signInForceRedirectUrl={returnPath} /></IdentityWidget></div>
    <p className={styles.note}>El responsable de la obra define tu acceso.</p>
  </section>;
}
