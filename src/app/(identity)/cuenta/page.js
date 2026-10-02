import { headers } from 'next/headers';
import { verifyProductionSession } from '../../../lib/verified-session.mjs';
import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../lib/production-identity-config.mjs';
import { WorkspaceIdentityPanel } from './workspace-identity';
import { SessionRecovery } from './session-recovery';
import { InvitationEntry } from './invitation-entry';
import { identityAccountReturnPath, identityHasPendingInvitation, identitySignInPath } from '../../../lib/identity-return-path.mjs';
import styles from '../identity.module.css';
import workspaceStyles from './workspace.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi cuenta y mis obras · ObraSaaS' };
export default async function AccountPage({ searchParams } = {}) {
  if (!sessionIdentityConfig().configured) return null;
  const query = await searchParams;
  if (identityHasPendingInvitation(query)) return <InvitationEntry returnPath={identityAccountReturnPath(query)} />;
  const session = await verifyProductionSession(await headers());
  if (!session.authenticated) {
    return <section className={styles.card}>
      <Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link>
      <SessionRecovery signInPath={identitySignInPath(query)} initialCode={session.code} />
    </section>;
  }
  return <section className={`${styles.card} ${workspaceStyles.shell}`}>
    <header className={styles.header}><Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link><UserButton /></header>
    <p className={styles.eyebrow}>ESPACIO DE TRABAJO</p><h1>Mi cuenta</h1>
    <p className={styles.lead}>Consultá tus obras y su cronograma con los permisos asignados por tu organización.</p>
    <WorkspaceIdentityPanel />
    <footer className={workspaceStyles.footer}><Link href="/manual" className={styles.home}>Manual de inicio y WhatsApp</Link><Link href="/demo" className={styles.home}>Ver demo ilustrativa</Link><Link href="/" className={styles.home}>Volver a la portada</Link></footer>
  </section>;
}
