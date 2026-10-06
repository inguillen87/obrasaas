import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../../lib/production-identity-config.mjs';
import { identityAccountReturnPath, identitySignUpPath } from '../../../../lib/identity-return-path.mjs';
import styles from '../../identity.module.css';
import { IdentityWidget } from '../../identity-load-guard';
import { AuthIntro } from '../../auth-intro';
export const metadata = { title: 'Ingresar · ObraSaaS' };
export default async function SignInPage({ searchParams }) {
  if (!sessionIdentityConfig().configured) return null;
  const query = await searchParams;
  const returnPath = identityAccountReturnPath(query);
  return <div className={styles.authFrame}><AuthIntro /><section className={`${styles.card} ${styles.authCard}`}>
    <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
    <h1>Ingresá con tu cuenta personal</h1>
    <p className={styles.lead}>Creá una empresa o aceptá una invitación. Tu acceso a cada obra depende de los permisos asignados.</p>
    <div className={styles.widget}><IdentityWidget><SignIn routing="path" path="/sign-in" signUpUrl={identitySignUpPath(query)}
      forceRedirectUrl={returnPath} signUpForceRedirectUrl={returnPath} /></IdentityWidget></div>
    <p className={styles.note}>El responsable de la obra define tu acceso.</p>
  </section></div>;
}
