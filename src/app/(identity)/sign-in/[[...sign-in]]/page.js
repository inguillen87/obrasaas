import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../../lib/production-identity-config.mjs';
import { identityAccountReturnPath, identitySignUpPath } from '../../../../lib/identity-return-path.mjs';
import styles from '../../identity.module.css';
export const metadata = { title: 'Ingresar · ObraSaaS' };
export default async function SignInPage({ searchParams }) {
  if (!sessionIdentityConfig().configured) return null;
  const query = await searchParams;
  const returnPath = identityAccountReturnPath(query);
  return <section className={styles.card}>
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
    <h1>Ingresá a tu cuenta</h1>
    <p className={styles.lead}>Entrá para consultar y gestionar las obras de tu empresa.</p>
    <div className={styles.widget}><SignIn routing="path" path="/sign-in" signUpUrl={identitySignUpPath(query)}
      forceRedirectUrl={returnPath} signUpForceRedirectUrl={returnPath} /></div>
    <p className={styles.note}>El responsable de la obra define tu acceso.</p>
  </section>;
}
