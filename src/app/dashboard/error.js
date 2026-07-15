'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './route-state.module.css';

export default function DashboardError({ error, unstable_retry }) {
  useEffect(() => {
    console.error('Dashboard render failed:', error);
  }, [error]);

  return (
    <main className={styles.errorShell}>
      <div className={styles.errorCard}>
        <span className={styles.errorIcon} aria-hidden="true"><i className="fa-solid fa-triangle-exclamation" /></span>
        <p>Centro operativo</p>
        <h1>No pudimos cargar la obra</h1>
        <span>La sesión sigue protegida. Podés reintentar la lectura o volver al inicio sin perder datos.</span>
        <div>
          <button type="button" onClick={() => unstable_retry()}>Reintentar</button>
          <Link href="/">Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}
