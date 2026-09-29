import { headers } from 'next/headers';
import { verifyProductionSession } from '../../../lib/verified-session.mjs';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ObraSaasLogo } from '@/app/brand/brand-logo';
import { sessionIdentityConfig } from '../../../lib/production-identity-config.mjs';
import styles from '../identity.module.css';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mi cuenta · ObraSaaS' };
export default async function AccountPage() {
  if (!sessionIdentityConfig().configured) return null;
  const session = await verifyProductionSession(await headers());
  if (session.code === 'IDENTITY_PROVIDER_UNAVAILABLE') {
    return <section className={styles.card} role="alert"><h1>No se pudo verificar tu sesión</h1>
      <p className={styles.lead}>El proveedor de identidad no respondió. No se habilitaron datos ni operaciones.</p>
      <Link href="/cuenta" className={styles.home}>Volver a verificar</Link></section>;
  }
  if (!session.authenticated) redirect('/sign-in');
  return <section className={styles.card}>
    <header className={styles.header}><Link href="/" className={styles.brand}><ObraSaasLogo markSize={36} variant="inverse" /></Link><UserButton /></header>
    <p className={styles.eyebrow}>MI CUENTA</p><h1>Sesión iniciada</h1>
    <p className={styles.lead}>Tu identidad está autenticada. Podés administrar tu perfil y cerrar la sesión desde el menú de tu cuenta.</p>
    <section className={styles.pending} aria-labelledby="business-access-title"><h2 id="business-access-title">Acceso empresarial pendiente</h2>
      <p>Las pertenencias a empresas y obras todavía deben vincularse y aprobarse. Esta sesión no habilita los registros históricos ni concede permisos de administración.</p>
    </section>
    <dl className={styles.status}><div><dt>Identidad</dt><dd>Autenticada</dd></div><div><dt>Empresa y obra</dt><dd>Pendiente de vinculación</dd></div>
      <div><dt>Operaciones empresariales</dt><dd>Restringidas</dd></div></dl>
    <Link href="/demo" className={styles.home}>Abrir la demo guiada</Link><br />
    <Link href="/" className={styles.home}>Volver a la portada</Link>
  </section>;
}
