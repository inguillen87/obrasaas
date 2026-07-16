import Link from 'next/link';
import styles from './legal.module.css';

export default function LegalPage({
  eyebrow,
  title,
  lead,
  updatedAt = '15 de julio de 2026',
  children,
}) {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Navegación legal">
        <Link href="/" className={styles.brand}>ObraSaaS</Link>
        <div className={styles.navLinks}>
          <Link href="/privacy">Privacidad</Link>
          <Link href="/terms">Términos</Link>
          <Link href="/data-deletion">Eliminar datos</Link>
        </div>
      </nav>
      <article className={styles.article}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p className={styles.lead}>{lead}</p>
        <p className={styles.updated}>Última actualización: {updatedAt}</p>
        {children}
      </article>
    </main>
  );
}

export function LegalSection({ id, title, children }) {
  return (
    <section className={styles.section} id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalCallout({ children }) {
  return <div className={styles.callout}>{children}</div>;
}
