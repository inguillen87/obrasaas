'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import { normalizeMessageReport, confirmedMessageReport } from '@/lib/whatsapp/progress-report-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import { tokens } from '@/lib/design-system';
import styles from './message-report-action.module.css';
export default function MessageReportAction({ sourceKind, onOpen, saved }) {
  return <div className={styles.entry}>{saved
    ? <Link href={'/dashboard/progress?taskId=' + encodeURIComponent(saved.taskId) + '#daily-log-' + saved.id}>Parte registrado · abrir en la bitácora</Link>
    : <button type="button" onClick={onOpen}>Preparar parte desde {sourceKind === 'AUDIO_TRANSCRIPT' ? 'el audio transcripto' : 'este mensaje'}</button>}</div>;
}
export function MessageReportDialog({ organizationId, projectId, projectName, conversationId, messageId, tasks, onClose, onSaved }) {
  const dialog = useRef(null), cancel = useRef(null), attempt = useRef(null), sending = useRef(false), titleId = useId();
  const [source, setSource] = useState(null), [existing, setExisting] = useState(null), [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ taskId: '', title: '', summary: '' }), [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState(null), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [blocked, setBlocked] = useState(false), [copyState, setCopyState] = useState('');
  const endpoint = '/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/messages/' + encodeURIComponent(messageId) + '/progress-report';
  const dirty = !existing && Boolean(draft.title || draft.summary || draft.taskId);
  useWorkspaceLeaveGuard({ dirty, busy });
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement;
    if (!node.open) node.showModal(); cancel.current?.focus();
    return () => { node.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const warn = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch(endpoint, { signal: controller.signal, cache: 'no-store', headers: evidenceScopeHeaders({ organizationId, projectId }) }).then(async response => {
      const data = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok || !data?.source || data.source.id !== messageId || data.source.conversationId !== conversationId || data.source.projectId !== projectId || !['TEXT', 'AUDIO_TRANSCRIPT'].includes(data.source.kind) || typeof data.source.text !== 'string' || !/^[a-f0-9]{64}$/.test(data.source.version)) throw new Error(data?.error || 'No se pudo comprobar el mensaje de origen.');
      setSource(data.source); setExisting(data.existing || null);
    }).catch(failure => { if (active) setError(failure); }).finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [endpoint, organizationId, projectId, messageId, conversationId]);
  function close() {
    if (sending.current) return;
    if (dirty && !window.confirm('El parte todavía no está confirmado. ¿Descartar este borrador local?')) return;
    onClose();
  }
  async function save(event) {
    event.preventDefault(); if (sending.current || blocked || !source || !reviewed) return;
    try { if (!attempt.current) attempt.current = { key: crypto.randomUUID(), input: normalizeMessageReport({ ...draft, sourceVersion: source.version }) }; }
    catch (failure) { setError(failure); return; }
    sending.current = true; setBusy(true); setError(null);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 18000);
    try {
      const response = await fetch(endpoint, { method: 'POST', signal: controller.signal, cache: 'no-store', headers: { ...evidenceScopeHeaders({ organizationId, projectId }), 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body: JSON.stringify(attempt.current.input) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          if ([400, 422].includes(response.status)) { attempt.current = null; setUncertain(false); }
          else { setBlocked(true); setUncertain(true); }
        }
        throw new Error(data?.error || 'No se confirmó el guardado.');
      }
      const confirmed = confirmedMessageReport(data, { projectId, taskId: attempt.current.input.taskId });
      publishFieldInvalidation({ organizationId, projectId }); onSaved(confirmed);
    } catch (failure) { if (attempt.current) setUncertain(true); setError(failure); }
    finally { clearTimeout(timeout); sending.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} style={{ '--report-bg': tokens.colors.bg.secondary, '--report-accent': tokens.colors.accent.primary }} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }}>
    <header><div><span className={styles.eyebrow}>WHATSAPP → PARTE → TAREA</span><h2 id={titleId}>Preparar parte de obra</h2><p>{projectName}</p></div><button ref={cancel} type="button" aria-label="Cerrar preparación del parte" onClick={close} disabled={busy}>×</button></header>
    <div className={styles.body}>
    <p className={styles.intro}>Revisá el origen y redactá un parte operativo. Se guardará como borrador, sin enviar mensajes, ejecutar compras ni modificar el avance.</p>
    {loading && <p role="status">Comprobando origen y permisos…</p>}
    {error && <p role="alert" className={styles.warning}>{error.name === 'AbortError' ? 'La conexión demoró. Conservá el borrador y verificá el mismo intento.' : error.message}</p>}
    {existing ? <section className={styles.existing}><h3>Este mensaje ya tiene un parte</h3><p>No se crea otra copia aunque cambies de pestaña o de usuario.</p><Link href={'/dashboard/progress?taskId=' + encodeURIComponent(existing.taskId) + '#daily-log-' + existing.id}>Consultar parte registrado</Link></section> : source && <form onSubmit={save}>
      <section className={styles.source} aria-label="Origen del parte"><div><strong>{source.kind === 'AUDIO_TRANSCRIPT' ? 'Transcripción ya procesada' : 'Texto recibido'}</strong><span>Fecha de trabajo: {source.workDate}</span></div><p>{source.text}</p>
        {source.kind === 'AUDIO_TRANSCRIPT' && <small>La transcripción puede contener errores. No se ejecuta otra llamada de IA desde esta acción.</small>}
        {source.text.length <= 3000 && <button type="button" disabled={busy || uncertain} onClick={() => { setDraft(current => ({ ...current, summary: source.text })); setReviewed(false); }}>Usar este texto como borrador</button>}
      </section>
      <fieldset disabled={busy || uncertain || blocked} className={styles.fields}>
        <label>Tarea de destino<select aria-label="Tarea de destino" required value={draft.taskId} onChange={event => { setDraft(current => ({ ...current, taskId: event.target.value })); setReviewed(false); }}><option value="">Elegí una actividad de esta obra</option>{tasks.filter(task => task.type === 'TASK').map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        <label>Título del parte<input required maxLength={180} value={draft.title} onChange={event => { setDraft(current => ({ ...current, title: event.target.value })); setReviewed(false); }} /></label>
        <label>Resumen operativo revisado<textarea rows={5} required maxLength={3000} value={draft.summary} onChange={event => { setDraft(current => ({ ...current, summary: event.target.value })); setReviewed(false); }} /></label>
        <p className={styles.hint}>No trasladar información médica, bancaria o de identidad a la bitácora general. El mensaje original queda en su canal con acceso restringido.</p>
        <label className={styles.check}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Revisé el texto, la tarea y el contexto de la obra.</label>
      </fieldset>
      {uncertain && <p className={styles.warning}>El resultado anterior no está confirmado. Conservamos la misma solicitud para no duplicar el parte.</p>}
      {uncertain && <div className={styles.recovery}><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(draft.title + '\n\n' + draft.summary); setCopyState('Borrador copiado.'); } catch { setCopyState('No se pudo copiar. ConservÃ¡ esta pantalla antes de salir.'); } }}>Copiar borrador</button><span role="status">{copyState}</span></div>}
      {blocked && <p className={styles.warning}>Verificá permisos, origen y registro existente antes de volver a intentar. No se ejecuta otro cambio automáticamente.</p>}
      <button className={styles.primary} type="submit" disabled={busy || blocked || !reviewed || !draft.taskId}>{busy ? 'Registrando parte…' : uncertain ? 'Verificar el mismo intento' : 'Crear borrador vinculado a la tarea'}</button>
    </form>}
    </div>
    <footer><button type="button" disabled={busy} onClick={close}>Volver a mensajes</button><small>Preparar un parte no aprueba su contenido. La revisión continúa en la bitácora.</small></footer>
  </dialog>;
}
