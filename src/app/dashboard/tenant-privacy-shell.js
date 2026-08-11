import styles from './tenant-privacy-shell.module.css';

export default function TenantPrivacyShell({ children }) {
  return (
    <div className={styles.shell} data-tenant-privacy-shell="isolated">
      <a className={styles.skipLink} href="#privacy-console-content">
        Saltar al contenido
      </a>
      <header className={styles.header}>
        <a
          aria-label="Volver al panel operativo de ObraSaaS"
          className={styles.brand}
          href="/dashboard"
        >
          <span aria-hidden="true" className={styles.brandMark}>O</span>
          <span>
            <strong>ObraSaaS</strong>
            <small>Control de privacidad</small>
          </span>
        </a>
        <nav aria-label="Navegación de privacidad">
          <a className={styles.exitLink} href="/dashboard">
            Salir al panel operativo
          </a>
        </nav>
      </header>

      <aside className={styles.safetyBanner} role="note">
        <strong>Expediente de decisión no ejecutable</strong>
        <span>
          Esta consola documenta verificación, criterio legal, retenciones y
          doble aprobación. No exporta, corrige, restringe, anonimiza, elimina
          ni envía datos.
        </span>
      </aside>

      <main className={styles.content} id="privacy-console-content">
        {children}
      </main>

      <footer className={styles.footer}>
        Acceso exclusivo para administradores activos del tenant.
      </footer>
    </div>
  );
}
