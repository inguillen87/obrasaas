'use client';
/* eslint-disable @next/next/no-html-link-for-pages -- Recovery must hard-reload so failed route CSS and client state cannot leak into marketing. */

import { useEffect, useRef } from 'react';
import { ObraSaasLogo } from './brand/brand-logo';
import styles from './error.module.css';

export default function AppError({ error, unstable_retry }) {
  const headingRef = useRef(null);

  useEffect(() => {
    console.error('ObraSaaS route render failed:', error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="app-error-title">
        <ObraSaasLogo
          className={styles.brand}
          markSize={38}
          variant="inverse"
        />

        <div className={styles.status} aria-hidden="true">
          <span />
          Interrupción temporal
        </div>

        <h1 id="app-error-title" ref={headingRef} tabIndex={-1}>
          No pudimos abrir el espacio de trabajo
        </h1>
        <p>
          No pudimos cargar esta vista. Reintentá la conexión o volvé al inicio
          para continuar desde una sesión nueva.
        </p>

        <div className={styles.actions}>
          <button type="button" onClick={() => unstable_retry()}>
            Reintentar
          </button>
          <a href="/">Volver al inicio</a>
        </div>
      </section>
    </main>
  );
}
