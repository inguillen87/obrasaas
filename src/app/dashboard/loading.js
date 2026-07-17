import styles from './route-state.module.css';

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando operación"
      className={styles.loadingShell}
      role="status"
    >
      <section className={styles.loadingContent}>
        <div className={styles.loadingLine} />
        <div className={styles.loadingHero} />
        <div className={styles.loadingGrid}>
          {Array.from({ length: 4 }, (_, index) => <div key={index} />)}
        </div>
        <div className={styles.loadingPanel} />
      </section>
    </div>
  );
}
