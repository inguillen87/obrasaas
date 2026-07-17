import Link from 'next/link';
import { buildOperationalPulseModel } from './operational-pulse-model';
import styles from './operational-pulse.module.css';

export { buildOperationalPulseModel } from './operational-pulse-model';

const PROJECT_STATUS_TONE_CLASSES = Object.freeze({
  active: styles.statusActive,
  planning: styles.statusPlanning,
  paused: styles.statusPaused,
  completed: styles.statusCompleted,
  archived: styles.statusArchived,
  neutral: styles.statusNeutral,
});

export function OperationalPulse({
  project,
  state,
  tasks,
  incidents,
  attendance,
  setup,
  syncState,
  lastSyncedAt,
}) {
  const model = buildOperationalPulseModel({
    project,
    state,
    tasks,
    incidents,
    attendance,
    setup,
    syncState,
    lastSyncedAt,
  });

  return (
    <section className={styles.shell} aria-labelledby="operational-pulse-title">
      <header className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Pulso operativo · hoy</p>
          <div className={styles.titleRow}>
            <h1 id="operational-pulse-title">{model.project.name}</h1>
            {model.project.status && (
              <span className={`${styles.projectStatus} ${PROJECT_STATUS_TONE_CLASSES[model.project.statusTone]}`}>
                {model.project.status}
              </span>
            )}
          </div>
          <p className={styles.headline}>{model.attention.headline}</p>
        </div>

        <div
          className={`${styles.syncStatus} ${styles[model.sync.tone]}`}
          role="status"
          aria-live="polite"
        >
          <span className={styles.syncDot} aria-hidden="true" />
          <span className={styles.syncCopy}>
            <strong>{model.sync.label}</strong>
            <small>
              {model.sync.detail}
              {model.sync.timeLabel && model.sync.dateTime ? ' · ' : ''}
              {model.sync.dateTime && (
                <time dateTime={model.sync.dateTime}>{model.sync.timeLabel}</time>
              )}
            </small>
          </span>
        </div>
      </header>

      <div className={styles.body}>
        <article className={styles.attentionPanel} aria-labelledby="operational-attention-title">
          <div className={styles.panelHeading}>
            <div>
              <span>Prioridad</span>
              <h2 id="operational-attention-title">Qué requiere atención</h2>
            </div>
            <span className={`${styles.attentionCount} ${model.attention.count > 0 ? styles.hasAttention : ''}`}>
              {model.attention.count}
              <span className={styles.srOnly}> señales para revisar</span>
            </span>
          </div>

          {model.attention.signals.length > 0 ? (
            <ol className={styles.signalList}>
              {model.attention.signals.map((signal) => (
                <li key={signal.id} className={styles[signal.tone]}>
                  <Link href={signal.href}>
                    <span className={styles.signalMarker} aria-hidden="true" />
                    <span className={styles.signalCopy}>
                      <small>{signal.kind}</small>
                      <strong>{signal.title}</strong>
                      {signal.detail && <span>{signal.detail}</span>}
                    </span>
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.emptyAttention}>
              <span className={styles.emptyIcon} aria-hidden="true">
                <i className={model.hasOperationalData ? 'fa-solid fa-shield-check' : 'fa-solid fa-wave-square'} />
              </span>
              <p>{model.attention.emptyCopy}</p>
            </div>
          )}

          {model.attention.hiddenCount > 0 && (
            <Link className={styles.moreSignals} href="/dashboard/activity">
              Ver {model.attention.hiddenCount} señal{model.attention.hiddenCount === 1 ? '' : 'es'} más
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </article>

        <div className={styles.metrics} aria-label="Indicadores operativos registrados">
          <article className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={`${styles.metricIcon} ${styles.progressIcon}`} aria-hidden="true">
                <i className="fa-solid fa-chart-simple" />
              </span>
              <span>Avance de tareas</span>
            </div>
            <strong className={styles.metricValue}>
              {model.progress.average == null ? 'Sin registro' : `${model.progress.average}%`}
            </strong>
            <p>
              {model.progress.taskCount === 0
                ? 'Todavía no hay tareas cargadas.'
                : `${model.progress.completedTaskCount} de ${model.progress.taskCount} completada${model.progress.taskCount === 1 ? '' : 's'}.`}
            </p>
            {model.progress.average != null && (
              <progress
                className={styles.progressBar}
                max="100"
                value={model.progress.average}
                aria-label={`Avance promedio registrado en tareas: ${model.progress.average}%`}
              />
            )}
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={`${styles.metricIcon} ${styles.presenceIcon}`} aria-hidden="true">
                <i className="fa-solid fa-helmet-safety" />
              </span>
              <span>Presencia registrada</span>
            </div>
            <strong className={styles.metricValue}>
              {model.presence.recordCount === 0 ? 'Sin fichajes' : model.presence.presentCount}
            </strong>
            <p>
              {model.presence.recordCount === 0
                ? 'No hay asistencia informada para esta obra.'
                : `${model.presence.presentCount} presente${model.presence.presentCount === 1 ? '' : 's'} sobre ${model.presence.recordCount} registro${model.presence.recordCount === 1 ? '' : 's'}.`}
            </p>
          </article>

          <article className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={`${styles.metricIcon} ${styles.activityIcon}`} aria-hidden="true">
                <i className="fa-solid fa-clock-rotate-left" />
              </span>
              <span>Última señal</span>
            </div>
            <strong className={`${styles.metricValue} ${styles.activityValue}`}>
              {model.latestSignal?.title || 'Sin actividad'}
            </strong>
            <p>
              {model.latestSignal?.timestamp || 'Todavía no hay novedades registradas en la bitácora.'}
            </p>
          </article>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.context}>
          <i className="fa-solid fa-location-dot" aria-hidden="true" />
          <span>{model.project.address || 'Dirección de obra no informada'}</span>
        </div>
        <nav className={styles.actions} aria-label="Acciones rápidas de la obra">
          {model.actions.map((action) => (
            <Link key={action.href} href={action.href}>
              <i className={action.icon} aria-hidden="true" />
              <span>{action.label}</span>
            </Link>
          ))}
        </nav>
      </footer>
    </section>
  );
}

export default OperationalPulse;
