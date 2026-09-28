'use client';
import Link from 'next/link';
import styles from './identity.module.css';
export default function IdentityError({ reset }) {
  return <main className={styles.shell}><section className={styles.card} role="alert">
    <h1>No se pudo verificar la sesión</h1>
    <p className={styles.lead}>El servicio de acceso no respondió correctamente. No se habilitó información de empresas ni operaciones de obra.</p>
    <button type="button" className={styles.retry} onClick={reset}>Volver a intentar</button>
    <p><Link href="/" className={styles.home}>Volver a la portada</Link></p>
  </section></main>;
}
