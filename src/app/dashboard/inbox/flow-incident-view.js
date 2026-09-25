'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { flowIncidentMatches, FLOW_INCIDENT_STATES, FLOW_INCIDENT_SEVERITIES } from '@/lib/whatsapp/flow-incident-policy';
import styles from './proactive-flow-reply.module.css';
import attendanceStyles from './flow-attendance-view.module.css';
const date = value => new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const unavailable = {
  not_recorded: 'No hay una respuesta procesada. No se infiere una incidencia.',
  unlinked: 'Esta respuesta no conserva el vínculo a una incidencia. No se reconstruye por texto, teléfono o fecha.',
  unsupported: 'El formulario consultado no corresponde a incidencias.',
  unavailable: 'No se pudo verificar la incidencia original. No se reemplaza por otro registro.',
};
export default function FlowIncidentView(props) {
  return <ScopedIncident key={[props.organizationId,props.projectId,props.conversationId,props.sourceMessageId,props.online].join(':')} {...props}/>;
}
function ScopedIncident({ organizationId, projectId, conversationId, sourceMessageId, online = true }) {
  const panelId = useId(), alive = useRef(true), active = useRef(null);
  const [open, setOpen] = useState(false), [phase, setPhase] = useState('idle'), [result, setResult] = useState(null), [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; active.current?.abort(); active.current = null; }; }, []);
  async function load() {
    if (!online || active.current || phase === 'blocked') return;
    const controller = new AbortController(); active.current = controller;
    setOpen(true); setPhase('loading'); setResult(null); setError('');
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const params = new URLSearchParams({ projectId, mode: 'incident', messageId: sourceMessageId });
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?' + params,
        { method: 'GET', cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) } });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error('No se pudo consultar la incidencia vinculada.'), { status: response.status });
      if (!flowIncidentMatches(body, { organizationId, projectId, conversationId }, sourceMessageId)) throw new Error('La respuesta no corresponde a esta incidencia y conversación.');
      if (alive.current && active.current === controller) { setResult(body); setPhase('ready'); }
    } catch (failure) {
      if (alive.current && active.current === controller) { setResult(null); setPhase([401,402,403,404].includes(failure.status) ? 'blocked' : 'error');
        setError(failure.name === 'AbortError' ? 'La consulta demoró. Podés reintentar sin crear otra incidencia.' : failure.message); }
    } finally { clearTimeout(timer); if (active.current === controller) active.current = null; }
  }
  function close() { active.current?.abort(); active.current = null; setOpen(false); setResult(null); setError(''); if (phase !== 'blocked') setPhase('idle'); }
  const entry = phase === 'ready' && online ? result?.incident : null;
  return <section className={styles.reply} aria-label="Incidencia vinculada al formulario">
    <div className={styles.actions}><button type="button" onClick={load} disabled={!online || phase === 'loading' || phase === 'blocked'} aria-expanded={open} aria-controls={panelId}>{open ? 'Actualizar incidencia' : 'Consultar incidencia vinculada'}</button>{open && <button type="button" onClick={close}>Cerrar incidencia</button>}</div>
    {open && <div id={panelId} className={styles.panel} aria-busy={phase === 'loading'}>
      {phase === 'loading' && <p role="status">Comprobando respuesta, vínculo y estado de la incidencia…</p>}
      {error && <p role="alert" className={styles.notice}>{error}</p>}
      {phase === 'ready' && online && result && <>
        <p className={styles.caption}>Consulta: {date(result.observedAt)} · Horas mostradas en este dispositivo.</p>
        {entry ? <><strong>Incidencia de obra verificada</strong><dl>
          <div><dt>Registro original</dt><dd>{entry.id}</dd></div>
          <div><dt>Severidad registrada</dt><dd>{FLOW_INCIDENT_SEVERITIES[entry.severity]}</dd></div>
          <div><dt>Estado de resolución</dt><dd>{FLOW_INCIDENT_STATES[entry.status]}</dd></div>
          <div><dt>Versión del estado de la obra</dt><dd>{entry.snapshotVersion}</dd></div>
          <div><dt>Estado de obra actualizado</dt><dd><time dateTime={entry.snapshotUpdatedAt}>{date(entry.snapshotUpdatedAt)}</time></dd></div>
        </dl><p className={styles.caption}>La fecha corresponde al conjunto de datos de la obra, no a una decisión de resolución de esta incidencia.</p>
          <a className={attendanceStyles.link} href="/dashboard">Abrir tablero de obra</a></> : <p role="status" className={styles.notice}>{unavailable[result.state]}</p>}
        <p className={styles.disclaimer}>Consulta del registro operativo existente. No crea ni resuelve incidencias, no cambia tareas y no envía mensajes. El detalle privado permanece en su canal autorizado.</p>
      </>}
    </div>}
    {!online && <p role="status">Sin conexión. La consulta requiere una nueva verificación al volver.</p>}
  </section>;
}
