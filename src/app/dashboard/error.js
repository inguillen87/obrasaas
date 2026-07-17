'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Returning to marketing must hard-reload to unload route-scoped global platform CSS. */

import { useEffect } from 'react';
import styles from './route-state.module.css';

export default function DashboardError({ error, unstable_retry }) {
  useEffect(() => {
    console.error('Dashboard render failed:', error);
  }, [error]);

  return (
    <div className={styles.errorShell}>
      <div className={styles.errorCard}>
        <span className={styles.errorIcon} aria-hidden="true"><i className="fa-solid fa-triangle-exclamation" /></span>
        <p>Centro operativo</p>
        <h1>No pudimos cargar la obra</h1>
        <span>La sesión sigue protegida. Podés reintentar la lectura o volver al inicio sin perder datos.</span>
        <div>
          <button type="button" onClick={() => unstable_retry()}>Reintentar</button>
          <a href="/">Volver al inicio</a>
        </div>
      </div>
    </div>
  );
}
