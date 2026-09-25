'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { normalizeAssignmentPlan } from '@/lib/task-assignment-policy';
import { assignmentReviewMatches } from '@/lib/assignment-overlap-policy';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import styles from './assignment-overlap.module.css';
const day = value => value ? value.split('-').reverse().join('/') : 'Sin fecha';
export default function AssignmentOverlapCheck({ input, organizationId, projectId, disabled, onReviewed }) {
  const [phase,setPhase] = useState('idle'), [review,setReview] = useState(null), [error,setError] = useState('');
  const alive = useRef(true), active = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); }; }, []);
  async function check() {
    if (active.current || disabled) return;
    let plan; try { plan = normalizeAssignmentPlan(input); } catch (failure) { setError(failure.message); return; }
    const controller = new AbortController(); active.current = controller; setPhase('loading'); setError(''); setReview(null); onReviewed(null);
    const timeout = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetch('/api/execution/assignments/review', { method:'POST', cache:'no-store', signal:controller.signal,
        headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId})}, body:JSON.stringify(input) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'No se pudo revisar la planificación. No equivale a disponibilidad confirmada.');
      if (!assignmentReviewMatches(body,plan,{organizationId,projectId})) throw new Error('La revisión no corresponde a esta actividad, responsable y fechas.');
      if (alive.current) { setReview(body); onReviewed(body); setPhase('ready'); }
    } catch (failure) { if (alive.current) { setError(failure.name === 'AbortError' ? 'La consulta demoró. Volvé a revisar; no se guardó ninguna asignación.' : failure.message); setPhase('error'); } }
    finally { clearTimeout(timeout); active.current = null; }
  }
  return <section className={styles.review} aria-label="Revisión de coincidencias de planificación">
    <header><div><span>ANTES DE COMPROMETER RECURSOS</span><h3>Coincidencias de planificación</h3></div><button type="button" disabled={disabled || phase==='loading'} onClick={check}>{phase==='loading'?'Revisando…':review?'Actualizar revisión':'Revisar coincidencias'}</button></header>
    <p>Compara días completos de esta obra, con inicio y fin incluidos. También revisa el personal compartido entre cuadrillas según sus participaciones. No calcula horas, disponibilidad contractual ni trabajo en otras obras.</p>
    {error && <p className={styles.warning} role="alert">{error}</p>}
    {review && <div aria-live="polite">
      <div className={styles.result} data-warning={review.warnings}><strong>{review.warnings?'Requiere coordinación':'Sin coincidencias detectadas en esta revisión'}</strong><span>{review.summary.overlaps} {review.summary.overlaps===1?'coincidencia de fechas':'coincidencias de fechas'} · {review.summary.incomplete} con fechas incompletas</span></div>
      {review.summary.proposedDatesIncomplete && <p className={styles.warning}>Faltan fechas completas en la propuesta. No se puede afirmar disponibilidad.</p>}
      {review.summary.rosterUnverified && <p className={styles.warning}>No hay integrantes registrados para esta cuadrilla durante el período revisado. Se comparó la cuadrilla, pero no se confirmó su dotación.</p>}
      <ul>{review.findings.map(row => <li key={row.assignmentId}><strong>{row.taskTitle}</strong><span>{row.ownerLabel} · {row.kind==='DIRECT'?'Mismo responsable':'Comparte integrantes en parte del período'}</span>
        <small>{day(row.startsOn)} → {day(row.endsOn)} · {row.certainty==='DATES_INCOMPLETE'?'Fechas insuficientes para descartar coincidencia':'Coincidencia de días; no implica jornada completa'}</small>
        <Link href={'/dashboard/execution?taskId='+encodeURIComponent(row.taskId)+'#task-assignments'} onNavigate={event=>{if(!requestWorkspaceNavigation('route'))event.preventDefault();}}>Abrir actividad y asignaciones →</Link></li>)}</ul>
      {review.totalFindings > review.findings.length && <p className={styles.warning}>Se muestran {review.findings.length} de {review.totalFindings} coincidencias. El resumen y la confirmación incluyen todas las detectadas.</p>}
      <p className={styles.scope}>Revisado sobre asignaciones planificadas y en curso. No cambia fechas, personas, cuadrillas ni avance. El servidor lo comprueba nuevamente al guardar.</p>
    </div>}
  </section>;
}
