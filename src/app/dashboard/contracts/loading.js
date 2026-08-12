import styles from './contracts.module.css';

export default function ContractsLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando autoridad contractual" className={styles.page}>
      <div className={styles.skeleton} />
      <div className={styles.statusGrid}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
      <span className="sr-only">Cargando autoridad contractual y SOV…</span>
    </div>
  );
}
