'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { flowAttendanceMatches, flowAttendancePresentation } from '@/lib/whatsapp/flow-attendance-policy';
import styles from './proactive-flow-reply.module.css';
import attendanceStyles from './flow-attendance-view.module.css';
const date = value => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const shiftLabels = { OPEN: 'Jornada abierta', PENDING_CLOSE: 'Cierre pendiente', CLOSED: 'Jornada cerrada', VOIDED: 'Jornada anulada' };
const unavailable = {
  not_recorded: 'No hay una respuesta procesada para esta sesión. No se infiere un fichaje.',
  unlinked: 'Esta respuesta no conserva un vínculo al ingreso. Los registros anteriores no se reconstruyen por teléfono o por fecha.',
  unsupported: 'Este formulario no corresponde al circuito de ingreso.',
  unavailable: 'El origen o el registro no se pudieron verificar. No se busca otra jornada para reemplazarlos.',
};
export default function FlowAttendanceView(props) {
  return <ScopedAttendance key={[props.organizationId,props.projectId,props.conversationId,props.sourceMessageId,props.online].join(':')} {...props}/>;
}
function ScopedAttendance({ organizationId, projectId, conversationId, sourceMessageId, online = true }) {
  const panelId = useId(), alive = useRef(true), active = useRef(null);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState('idle'), [result, setResult] = useState(null), [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); active.current = null; }; }, []);
  async function load() {
    if (!online || active.current || phase === 'blocked') return;
    const controller = new AbortController(); active.current = controller;
    setOpen(true); setPhase('loading'); setResult(null); setError('');
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({ projectId, mode: 'attendance', messageId: sourceMessageId });
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?' + params,
        { method: 'GET', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) } });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error('No se pudo consultar el ingreso vinculado.'), { status: response.status });
      if (!flowAttendanceMatches(body, { organizationId, projectId, conversationId }, sourceMessageId)) throw new Error('La respuesta no corresponde a este ingreso y conversación.');
      if (alive.current && active.current === controller) { setResult(body); setPhase('ready'); }
    } catch (failure) {
      if (alive.current && active.current === controller) { setResult(null); setPhase([401,402,403,404].includes(failure.status) ? 'blocked' : 'error');
        setError(failure.name === 'AbortError' ? 'La consulta demoró. Podés reintentar sin crear un fichaje.' : failure.message); }
    } finally { clearTimeout(timer); if (active.current === controller) active.current = null; }
  }
  function close() { active.current?.abort(); active.current = null; setOpen(false); setResult(null); setError(''); if (phase !== 'blocked') setPhase('idle'); }
  const entry = phase === 'ready' && online ? result?.entry : null;
  const presentation = entry ? flowAttendancePresentation(entry, result.observedAt) : null;
  return <section className={styles.reply} aria-label="Ingreso vinculado al formulario">
    <div className={styles.actions}><button type="button" onClick={load} disabled={!online || phase === 'loading' || phase === 'blocked'} aria-expanded={open} aria-controls={panelId}>{open ? 'Actualizar ingreso' : 'Consultar ingreso vinculado'}</button>{open && <button type="button" onClick={close}>Cerrar ingreso</button>}</div>
    {open && <div id={panelId} className={styles.panel} aria-busy={phase === 'loading'}>
      {phase === 'loading' && <p role="status">Comprobando respuesta, vínculo y registro de asistencia…</p>}
      {error && <p role="alert" className={styles.notice}>{error}</p>}
      {phase === 'ready' && online && result && <>
        <p className={styles.caption}>Consulta: {date(result.observedAt)} · Horas mostradas en este dispositivo.</p>
        {entry ? <><strong>{presentation.label}</strong><p>{presentation.detail}</p><dl>
          <div><dt>Registro de ingreso</dt><dd>{entry.id}</dd></div>
          <div><dt>Inicio registrado</dt><dd><time dateTime={entry.occurredAt}>{date(entry.occurredAt)}</time></dd></div>
          {entry.verificationStatus === 'PENDING' && <div><dt>Plazo para informar ubicación</dt><dd><time dateTime={entry.locationDeadlineAt}>{date(entry.locationDeadlineAt)}</time></dd></div>}
          {entry.shift && <><div><dt>Estado actual de la jornada</dt><dd>{shiftLabels[entry.shift.status]}</dd></div><div><dt>Fecha laboral</dt><dd>{entry.shift.workDate}</dd></div></>}
        </dl><a className={attendanceStyles.link} href="/dashboard/attendance">Abrir control de asistencia</a></> : <p role="status" className={styles.notice}>{unavailable[result.state]}</p>}
        <p className={styles.disclaimer}>Vínculo registrado por el módulo de asistencia; puede corresponder a un pendiente anterior. Consultar no completa el ingreso ni aprueba horas. Sin coordenadas ni documentos.</p>
      </>}
    </div>}
    {!online && <p role="status">Sin conexión. La consulta requiere una nueva verificación al volver.</p>}
  </section>;
}
