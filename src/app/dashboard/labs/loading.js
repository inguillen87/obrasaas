import styles from './labs.module.css';

export default function LabsLoading() {
  return (
    <div className={styles.shell} role="status" aria-label="Cargando ObraSaaS Labs">
      <div className={styles.gridTexture} aria-hidden="true" />
      <div className={styles.loadingShell} aria-hidden="true">
        <div className={styles.loadingHeader}>
          <div>
            <span className={styles.loadingLine} />
            <span className={styles.loadingTitle} />
            <span className={styles.loadingTitleShort} />
            <span className={styles.loadingCopy} />
          </div>
          <span className={styles.loadingScope} />
        </div>
        <span className={styles.loadingBar} />
        <div className={styles.loadingFeature}>
          <span />
          <span />
        </div>
      </div>
      <span className={styles.srOnly}>Cargando laboratorio tecnológico…</span>
    </div>
  );
}
