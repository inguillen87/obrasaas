'use client';

import { useMemo, useState } from 'react';

import { buildActivityCsv, formatActivityDate } from '@/lib/activity-export';
import styles from './activity.module.css';

const FILTERS = [
  ['ALL', 'Todo'],
  ['FIELD', 'Campo'],
  ['EXECUTION', 'Ejecución'],
  ['INTEGRATION', 'Integraciones'],
  ['GOVERNANCE', 'Gobernanza'],
];

const GROUP_LABELS = {
  FIELD: 'Campo',
  EXECUTION: 'Ejecución',
  INTEGRATION: 'Integración',
  GOVERNANCE: 'Gobernanza',
};

const CATEGORY_LABELS = {
  ATTENDANCE: 'Asistencia',
  AUDIT: 'Auditoría',
  INCIDENT: 'Incidencia',
  MATERIAL: 'Materiales',
  MESSAGE: 'Comunicación',
  PEOPLE: 'Personal',
  SYSTEM: 'Sistema',
  TASK: 'Cronograma',
  WEBHOOK: 'Webhook',
};

export default function ActivityClient({ entries, metrics, organizationName, projectName, timezone }) {
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es');
    return entries.filter((entry) => {
      if (filter !== 'ALL' && entry.group !== filter) return false;
      if (!needle) return true;
      return [entry.title, entry.description, entry.actor, entry.reference, entry.source]
        .some((value) => String(value || '').toLocaleLowerCase('es').includes(needle));
    });
  }, [entries, filter, query]);

  function exportCsv() {
    const csv = buildActivityCsv(filtered, {
      timezone,
      groupLabels: GROUP_LABELS,
      categoryLabels: CATEGORY_LABELS,
    });
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bitacora-${projectName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <section className={styles.metrics} aria-label="Resumen de la bitácora">
        <article><span>Últimas 24 h</span><strong>{metrics.lastDay}</strong><small>eventos registrados</small></article>
        <article><span>Señales de campo</span><strong>{metrics.fieldReports}</strong><small>reportes y fichajes</small></article>
        <article className={metrics.critical > 0 ? styles.metricAlert : ''}><span>Críticos</span><strong>{metrics.critical}</strong><small>requieren revisión</small></article>
        <article><span>Gobernanza</span><strong>{metrics.governance}</strong><small>cambios auditados</small></article>
      </section>

      <section className={styles.workspace}>
        <div className={styles.toolbar}>
          <div>
            <p className={styles.eyebrow}>Registro consolidado</p>
            <h2>Historia operativa verificable</h2>
            <p>
              {organizationName} · {entries.length} evento{entries.length === 1 ? '' : 's'}
              {' '}reciente{entries.length === 1 ? '' : 's'} dentro de esta obra.
            </p>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryAction} onClick={() => window.print()}>
              <i className="fa-solid fa-print" aria-hidden="true" /> Imprimir
            </button>
            <button type="button" className={styles.primaryAction} onClick={exportCsv} disabled={filtered.length === 0}>
              <i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> Exportar CSV
            </button>
          </div>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterTabs} aria-label="Filtrar eventos">
            {FILTERS.map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={filter === value ? styles.activeFilter : ''}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
                <span>{value === 'ALL' ? entries.length : entries.filter((entry) => entry.group === value).length}</span>
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <span className={styles.srOnly}>Buscar en la bitácora</span>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar tarea, persona, evento…"
            />
          </label>
        </div>

        <div className={styles.resultBar}>
          <span><i aria-hidden="true" /> Registro tenant-scoped</span>
          <strong>{filtered.length} resultado{filtered.length === 1 ? '' : 's'}</strong>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <i className="fa-solid fa-shield-check" aria-hidden="true" />
            <strong>{entries.length === 0 ? 'La bitácora está lista para el primer movimiento.' : 'No hay coincidencias.'}</strong>
            <p>{entries.length === 0
              ? 'Los cambios de cronograma, materiales, comunicaciones e integraciones aparecerán aquí automáticamente.'
              : 'Probá con otro término o eliminá los filtros activos.'}</p>
            {entries.length > 0 && <button type="button" onClick={() => { setFilter('ALL'); setQuery(''); }}>Limpiar filtros</button>}
          </div>
        ) : (
          <ol className={styles.timeline}>
            {filtered.map((entry) => (
              <li key={entry.id} className={`${styles.entry} ${styles[`severity${entry.severity}`] || ''}`}>
                <div className={styles.rail} aria-hidden="true"><i /></div>
                <article>
                  <div className={styles.entryTopline}>
                    <div>
                      <span>{GROUP_LABELS[entry.group] || entry.group}</span>
                      <b>{CATEGORY_LABELS[entry.category] || entry.category}</b>
                    </div>
                    <time dateTime={entry.occurredAt}>{formatActivityDate(entry.occurredAt, timezone)}</time>
                  </div>
                  <h3>{entry.title}</h3>
                  <p>{entry.description}</p>
                  <footer>
                    <span><i className="fa-regular fa-user" aria-hidden="true" />{entry.actor}</span>
                    <span><i className="fa-solid fa-satellite-dish" aria-hidden="true" />{entry.source}</span>
                    <code>{entry.reference}</code>
                  </footer>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
