'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { tokens } from '@/lib/design-system';
import useScheduleFieldStatus from './use-schedule-field-status';
import styles from './schedule-field-panel.module.css';
const percent = value => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 4 }).format(Number(value));
function checkedTime(value) { const date = new Date(value); return value && Number.isFinite(date.getTime()) ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Sin verificar'; }
export default function ScheduleFieldPanel({ organizationId, projectId, onSnapshot }) {
  const params = useSearchParams();
  const requested = params.get('fieldTaskId');
  const taskId = requested && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(requested) ? requested : null;
  const [after, setAfter] = useState(null);
  const { snapshot, state, error, checkedAt, refresh } = useScheduleFieldStatus({ organizationId, projectId, taskId, after: taskId ? null : after });
  useEffect(() => { onSnapshot?.(snapshot); return () => onSnapshot?.(null); }, [snapshot, onSnapshot]);
  const rows = snapshot?.tasks || [];
  const totals = rows.reduce((sum, row) => ({ captured: sum.captured + row.evidence.total + row.reports.total, reviewed: sum.reviewed + row.evidence.approved + row.reports.approved, measured: sum.measured + (row.measured ? 1 : 0) }), { captured: 0, reviewed: 0, measured: 0 });
  return <section id="field-schedule-status" className={styles.panel} style={{ '--field-accent': tokens.colors.accent.primary }} aria-label="Evidencia y avance en el cronograma">
    <header className={styles.header}><div><span className={styles.eyebrow}>CAMPO → EVIDENCIA → AVANCE</span><h2>Lo que llega de la obra, junto al Gantt</h2><p>La captura informa; la medición revisada acredita el avance. La línea base no se reescribe.</p></div>
      <button type="button" onClick={refresh} disabled={state === 'blocked'}>Actualizar ahora</button></header>
    <div className={styles.sync} role="status"><i data-state={state} />{state === 'verified' ? 'Verificado con el servidor · ' + checkedTime(checkedAt) : state === 'offline' ? 'Sin conexión · datos sin actualizar' : state === 'blocked' ? 'Contexto o acceso cambiado · volvé a abrir el cronograma' : state === 'stale' ? 'Última consulta sin confirmar · se muestran datos anteriores' : 'Consultando estado de campo…'}<small>Consulta automática cada 10 s mientras esta pantalla está visible; intervalos mayores ante errores.</small></div>
    {error && <p role="alert" className={styles.warning}>{error}</p>}
    <ol className={styles.steps}><li><strong>{totals.captured}</strong><span>Partes y evidencias vinculados</span></li><li><strong>{totals.reviewed}</strong><span>Registros aprobados</span></li><li><strong>{snapshot?.canReadMeasurements ? totals.measured : '—'}</strong><span>Tareas con medición aprobada</span></li></ol>
    <p className={styles.hint}>Totales de las tareas mostradas, no de toda la obra. Una imagen aprobada no se convierte por sí sola en un porcentaje.</p>
    {taskId && <Link href="/dashboard?tab=sec-gantt" className={styles.back}>Ver todas las tareas</Link>}
    {snapshot && rows.length === 0 && <p className={styles.empty}>Todavía no hay tareas en este contexto. Creá una actividad del cronograma y vinculá sus registros.</p>}
    <div className={styles.tasks}>{rows.map(task => <article key={task.id} className={styles.task}>
      <div><h3>{task.title}</h3><p>{task.evidence.total} evidencias · {task.reports.total} partes · {task.evidence.pending + task.reports.pending} sin aprobación</p></div>
      <div className={styles.progress}><label>Avance operativo registrado <strong>{percent(task.operationalProgress)}%</strong></label><meter className={styles.operational} min="0" max="100" value={task.operationalProgress} aria-label={'Avance operativo de ' + task.title} />
        <label>Avance medido aprobado <strong>{task.measured ? percent(task.measured.percent) + '%' : snapshot.canReadMeasurements ? 'Sin medición' : 'Acceso restringido'}</strong></label>
        {task.measured && <><meter min="0" max="100" value={Number(task.measured.percent)} aria-label={'Avance medido de ' + task.title} /><small>{task.measured.completed} / {task.measured.baseline} {task.measured.unit} · revisión {task.measured.revision}</small></>}
      </div>
      <nav aria-label={'Continuar tarea ' + task.title}><Link href={'/dashboard/progress?taskId=' + encodeURIComponent(task.id)}>Ver partes y evidencias</Link>
        {snapshot.canReadMeasurements && task.type === 'TASK' && <Link href={'/dashboard/measurements?taskId=' + encodeURIComponent(task.id)}>{task.measured ? 'Consultar medición' : 'Preparar medición'}</Link>}
      </nav>
    </article>)}</div>
    {snapshot?.unassignedParts > 0 && <p className={styles.warning}>{snapshot.unassignedParts} partes de la obra todavía no están vinculados a una tarea. No se atribuyen automáticamente a ninguna barra.</p>}
    {snapshot && !taskId && <footer className={styles.pagination}>{after && <button type="button" onClick={() => setAfter(null)}>Primera página</button>}<span>Hasta {snapshot.page.limit} tareas por consulta</span>{snapshot.page.hasMore && <button type="button" onClick={() => setAfter(snapshot.page.nextAfter)}>Siguientes tareas</button>}</footer>}
  </section>;
}
