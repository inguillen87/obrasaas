import { headers } from 'next/headers';
import { verifyProductionSession } from '../../../lib/verified-session.mjs';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../lib/production-identity-config.mjs';
import { WorkspaceIdentityPanel } from './workspace-identity';
import styles from '../identity.module.css';
import workspaceStyles from './workspace.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi cuenta y mis obras · ObraSaaS' };
export default async function AccountPage() {
  if (!sessionIdentityConfig().configured) return null;
  const session = await verifyProductionSession(await headers());
  if (session.code === 'IDENTITY_PROVIDER_UNAVAILABLE') {
    return <section className={styles.card} role="alert"><h1>No se pudo verificar tu sesión</h1>
      <p className={styles.lead}>El proveedor de identidad no respondió. No se habilitaron datos ni operaciones.</p>
      <Link href="/cuenta" className={styles.home}>Volver a verificar</Link></section>;
  }
  if (!session.authenticated) redirect('/sign-in');
  return <section className={`${styles.card} ${workspaceStyles.shell}`}>
    <header className={styles.header}><Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link><UserButton /></header>
    <p className={styles.eyebrow}>MI CUENTA</p><h1>Sesión iniciada</h1>
    <p className={styles.lead}>Consultá tus obras y su cronograma con los permisos asignados por tu organización.</p>
    <WorkspaceIdentityPanel />
    <footer className={workspaceStyles.footer}><Link href="/demo" className={styles.home}>Ver demo ilustrativa</Link><Link href="/" className={styles.home}>Volver a la portada</Link></footer>
  </section>;
}
