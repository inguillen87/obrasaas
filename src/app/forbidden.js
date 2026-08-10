import Link from 'next/link';

import { ObraSaasLogo } from '@/app/brand/brand-logo';

import styles from './error.module.css';

export default function Forbidden() {
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="forbidden-title">
        <ObraSaasLogo
          className={styles.brand}
          markSize={38}
          variant="inverse"
        />

        <div className={styles.status} aria-hidden="true">
          <span />
          Acceso restringido
        </div>

        <h1 id="forbidden-title">No tenés acceso a esta sección en el contexto actual</h1>
        <p>
          Tu sesión sigue protegida y no se mostró información privada. Volvé al panel
          para continuar con las funciones disponibles o consultá a un administrador.
        </p>

        <div className={styles.actions}>
          <Link href="/dashboard">Volver al panel</Link>
          <Link href="/">Ir al inicio</Link>
        </div>
      </section>
    </main>
  );
}
