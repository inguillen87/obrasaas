'use client';
import { AGENDA_LABELS, assignmentAgendaToday } from '@/lib/assignment-agenda';
import styles from './assignment-agenda.module.css';
const descriptions = {
  overdue: 'Abiertas con fin anterior a la fecha elegida.',
  onDate: 'El período completo incluye la fecha elegida.',
  upcoming: 'Empiezan después de la fecha, dentro de 7 días.',
  review: 'Falta un período completo o sus fechas no son consistentes.',
};
export default function AssignmentAgendaControls({ agenda, bucket, timeZone, onDayChange, onBucketChange, onReset }) {
  const canUseToday = assignmentAgendaToday(timeZone, new Date(0)) !== null;
  return <section className={styles.agenda} aria-label="Agenda de asignaciones">
    <div className={styles.heading}><div><span>PLANIFICACIÓN A LA VISTA</span><h3>¿Qué necesita atención?</h3><p>Filtrá las asignaciones sin cambiar sus fechas ni su estado.</p></div>
      <button type="button" onClick={onReset}>Mostrar todas las asignaciones</button>
    </div>
    <div className={styles.reference}><label>Fecha de referencia<input type="date" aria-label="Fecha de referencia de la agenda" value={agenda.day || ''} onChange={event => onDayChange(event.target.value)} /></label>
      <button type="button" disabled={!canUseToday} onClick={() => onDayChange(assignmentAgendaToday(timeZone, new Date()))}>Usar fecha actual de la empresa</button>
      <small>{canUseToday ? `Zona de la empresa: ${timeZone}` : 'Zona horaria no informada; elegí una fecha de referencia.'}</small>
    </div>
    {!agenda.day && <p className={styles.note} role="status">Elegí una fecha válida para clasificar vencimientos y próximos inicios. No se asumió la fecha del dispositivo.</p>}
    <div className={styles.tiles} role="group" aria-label="Prioridades de planificación">
      {['overdue', 'onDate', 'upcoming', 'review'].map(key => <button key={key} type="button" className={styles.tile} data-kind={key}
        aria-pressed={bucket === key} disabled={key !== 'review' && !agenda.day} onClick={() => onBucketChange(key)}>
        <span>{AGENDA_LABELS[key]}</span><strong>{agenda.day || key === 'review' ? agenda.counts[key] : '—'}</strong><small>{descriptions[key]}</small>
      </button>)}
    </div>
    <p className={styles.note}>Conteos del listado cargado, antes de aplicar búsqueda y estado. Sólo se clasifican asignaciones planificadas o en curso; no acreditan avance, asistencia ni incumplimiento real.</p>
    {agenda.counts.review > 0 && <p className={styles.note}>{agenda.incomplete} con fechas incompletas · {agenda.invalid} con fechas que requieren revisión. No se estimaron fechas faltantes.</p>}
  </section>;
}
