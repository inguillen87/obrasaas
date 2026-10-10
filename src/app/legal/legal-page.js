import Link from 'next/link';
import { ObraSaasLogo } from '../brand/brand-logo';
import styles from './legal.module.css';

export const LEGAL_CONTACT_EMAIL = 'info@obrasaas.com';
export const LEGAL_UPDATED_DATE = '10 de octubre de 2026';

const documents = [
  ['/privacidad', 'Privacidad'],
  ['/terminos', 'Términos de uso'],
  ['/eliminacion-datos', 'Eliminación de datos'],
];

export function LegalSection({ id, title, children }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

export function LegalNotice({ title, children }) {
  return (
    <div className={styles.notice}>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function LegalEmail({ subject, children }) {
  const href = `mailto:${LEGAL_CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
  return <a href={href}>{children || LEGAL_CONTACT_EMAIL}</a>;
}

export function LegalPage({ pathname, title, description, contents, children }) {
  return (
    <div className={styles.page} data-public-legal-page={pathname}>
      <a className={styles.skip} href="#contenido-legal">Ir al contenido</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" aria-label="ObraSaaS, inicio" className={styles.brand}>
            <ObraSaasLogo markSize={32} variant="inverse" />
          </Link>
          <nav aria-label="Accesos del sitio">
            <Link href="/">Portada</Link>
            <Link href="/manual">Manual de inicio</Link>
          </nav>
        </div>
      </header>
      <main id="contenido-legal" className={styles.main}>
        <section className={styles.hero} aria-labelledby="legal-title">
          <p className={styles.eyebrow}>INFORMACIÓN DEL SERVICIO</p>
          <h1 id="legal-title">{title}</h1>
          <p className={styles.lead}>{description}</p>
          <p className={styles.updated}>Última actualización: <time dateTime="2026-10-10">{LEGAL_UPDATED_DATE}</time></p>
          <nav className={styles.documents} aria-label="Información legal">
            {documents.map(([href, label]) => (
              <Link key={href} href={href} aria-current={href === pathname ? 'page' : undefined}>{label}</Link>
            ))}
          </nav>
        </section>
        <div className={styles.layout}>
          <aside className={styles.index}>
            <nav aria-label="Contenido de esta página">
              <h2>En esta página</h2>
              {contents.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
            </nav>
            <p>Consultas y solicitudes sobre tus datos: <LegalEmail /></p>
          </aside>
          <div className={styles.sections}>{children}</div>
        </div>
        <footer className={styles.footer}>
          <div>
            <p><strong>ObraSaaS, un producto de Inmovar LATAM.</strong></p>
            <p>Titular del servicio: <strong>GUILLEN ALBA, MARCELO ARIEL</strong>.</p>
            <p>Nombre registrado en ARCA: <strong>GUILLEN MARCELO ARIEL</strong>.</p>
            <p>Contacto: <LegalEmail /></p>
          </div>
          <nav aria-label="Enlaces de información legal">
            {documents.map(([href, label]) => <Link key={href} href={href} aria-current={href === pathname ? 'page' : undefined}>{label}</Link>)}
            <a href="#legal-title">Volver al inicio</a>
          </nav>
        </footer>
      </main>
    </div>
  );
}
