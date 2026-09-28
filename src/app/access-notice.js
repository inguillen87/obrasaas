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
      <h1 id="access-title">El acceso empresarial necesita una sesión verificada.</h1>
      <p className={styles.description}>El ingreso anterior de demostración fue retirado. No habilitaba una cuenta de empresa ni verificaba la contraseña.</p>
      <div className={styles.notice}><strong>Datos y operaciones protegidos</strong><p>El panel permanecerá restringido hasta completar la configuración del servicio de identidad para producción.</p></div>
      <p className={styles.detail}>No ingreses claves en formularios anteriores ni compartas credenciales por correo. La portada continúa disponible.</p>
      <Link href="/" className={styles.primary}>Volver a la portada <span aria-hidden="true">→</span></Link>
      <p className={styles.footer}>Las marcas locales del navegador no conceden acceso a una obra.</p>
    </section>
  </main>;
}
