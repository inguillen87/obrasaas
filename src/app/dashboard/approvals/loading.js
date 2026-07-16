import styles from './approvals.module.css';

export default function ApprovalsLoading() {
  return (
    <main className={styles.shell} aria-busy="true" aria-label="Cargando aprobaciones operativas">
      <header className={styles.loadingHeader}>
        <div className={`${styles.skeleton} ${styles.loadingBack}`} />
        <div className={`${styles.skeleton} ${styles.loadingTitle}`} />
        <div className={`${styles.skeleton} ${styles.loadingLead}`} />
      </header>

      <section className={styles.loadingMetrics} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className={`${styles.skeleton} ${styles.loadingMetric}`} key={index} />
        ))}
      </section>

      <section className={styles.loadingWorkspace} aria-hidden="true">
        <div className={`${styles.skeleton} ${styles.loadingToolbar}`} />
        {Array.from({ length: 3 }, (_, index) => (
          <div className={`${styles.skeleton} ${styles.loadingCard}`} key={index} />
        ))}
      </section>
    </main>
  );
}
