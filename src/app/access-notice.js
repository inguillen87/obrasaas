'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import styles from './access-notice.module.css';

export default function AccessNotice() {
  useEffect(() => {
    // Remove only obsolete presentation flags, never business drafts or queues.
    for (const key of ['obrasaas_logged_in', 'obrasaas_user_role', 'obrasaas_demo_mode']) {
      try { localStorage.removeItem(key); } catch { /* Storage can be unavailable. */ }
    }
  }, []);
  return <main className={styles.shell}>
    <section className={styles.card} aria-labelledby="access-title">
      <Link href="/" className={styles.brand} aria-label="ObraSaaS, volver al inicio"><span>OS</span> ObraSaaS</Link>
      <p className={styles.status}>OPERACIONES RESTRINGIDAS</p>
      <h1 id="access-title">Acceso empresarial temporalmente restringido.</h1>
      <p className={styles.description}>La portada está disponible. Para entrar a los datos y operaciones de tu empresa necesitamos completar la configuración de inicio de sesión.</p>
      <div className={styles.notice}><strong>Datos y operaciones protegidos</strong><p>El panel permanecerá restringido hasta completar la configuración del servicio de identidad para producción.</p></div>
      <p className={styles.detail}>Esta pantalla no solicita contraseñas ni modifica registros de obra.</p>
      <Link href="/" className={styles.primary}>Volver a la portada <span aria-hidden="true">→</span></Link>
      <p className={styles.footer}>No se habilitan operaciones sin verificar el acceso correspondiente.</p>
    </section>
  </main>;
}
