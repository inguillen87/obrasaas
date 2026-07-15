import Link from 'next/link';
import styles from './auth-shell.module.css';

export default function AuthShell({
  eyebrow,
  title,
  description,
  points,
  children,
}) {
  return (
    <main className={styles.page}>
      <div className={styles.grid}>
        <section className={styles.context} aria-labelledby="auth-heading">
          <Link className={styles.brand} href="/" aria-label="ObraSaaS, volver al inicio">
            <span className={styles.brandMark} aria-hidden="true">OS</span>
            <span>ObraSaaS</span>
          </Link>

          <div className={styles.copy}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 id="auth-heading">{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>

          <ul className={styles.points}>
            {points.map((point) => (
              <li key={point.title}>
                <span className={styles.check} aria-hidden="true">✓</span>
                <span><strong>{point.title}</strong>{point.detail}</span>
              </li>
            ))}
          </ul>

          <p className={styles.footnote}>Infraestructura aislada por organización · Argentina / LATAM</p>
        </section>

        <section className={styles.formArea} aria-label="Acceso seguro">
          <div className={styles.formGlow} aria-hidden="true" />
          <div className={styles.formFrame}>{children}</div>
          <p className={styles.legal}>
            Al continuar aceptás los <Link href="/terms">Términos</Link> y la{' '}
            <Link href="/privacy">Política de privacidad</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
