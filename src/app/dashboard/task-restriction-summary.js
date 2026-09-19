'use client';
import Link from 'next/link';
import { tokens } from '@/lib/design-system';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import styles from './task-restriction-summary.module.css';
function dateLabel(value) { return value ? new Date(value).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: 'short', year: 'numeric' }) : null; }
export function restrictionsVerified(value) {
  return value && ['active','open','inProgress','critical','high','resolved','cancelled'].every(key => Number.isSafeInteger(value[key]) && value[key] >= 0)
    && value.active === value.open + value.inProgress && value.critical + value.high <= value.active && typeof value.overdue === 'boolean' && (!value.earliestDueAt || Number.isFinite(new Date(value.earliestDueAt).getTime()));
}
export default function TaskRestrictionSummary({ taskId, taskTitle, restrictions }) {
  const verified = restrictionsVerified(restrictions), active = verified ? restrictions.active : null;
  const style = { '--risk-bg': tokens.colors.bg.secondary, '--risk-border': tokens.colors.border.default, '--risk-text': tokens.colors.text.primary,
    '--risk-muted': tokens.colors.text.secondary, '--risk-warning': tokens.colors.accent.primary, '--risk-danger': tokens.colors.accent.danger };
  return <section className={styles.card} style={style} aria-label={'Restricciones de ' + taskTitle} data-attention={active > 0} data-critical={verified && restrictions.critical > 0}>
    <header><span>SEGUIMIENTO DE LA ACTIVIDAD</span><strong>{active === null ? 'Restricciones sin verificar' : active > 0 ? `${active} ${active === 1 ? 'restricción activa' : 'restricciones activas'}` : 'Sin restricciones activas registradas'}</strong></header>
    {verified && <>{(active > 0 || restrictions.resolved + restrictions.cancelled > 0) && <div className={styles.statuses}><span>{restrictions.open} por atender</span><span>{restrictions.inProgress} en tratamiento</span>
      {restrictions.critical > 0 && <b>Prioridad crítica: {restrictions.critical}</b>}{restrictions.high > 0 && <b>Prioridad alta: {restrictions.high}</b>}
      {(restrictions.resolved + restrictions.cancelled) > 0 && <span>{restrictions.resolved} resueltas · {restrictions.cancelled} canceladas</span>}</div>}
      {restrictions.earliestDueAt && <p className={restrictions.overdue ? styles.overdue : styles.due}>{restrictions.overdue ? 'Hay un plazo registrado vencido' : 'Próximo plazo registrado'} · {dateLabel(restrictions.earliestDueAt)}</p>}
      <Link href={'/dashboard/execution?taskId=' + encodeURIComponent(taskId)} prefetch={false} onNavigate={event => { if (!requestWorkspaceNavigation('route')) event.preventDefault(); }}>{active > 0 ? 'Ver responsables y seguimiento' : 'Ver historial de restricciones'} <span aria-hidden="true">→</span></Link>
      <small>Informan impedimentos; no cambian la línea base, las fechas ni el avance medido.</small></>}
  </section>;
}
