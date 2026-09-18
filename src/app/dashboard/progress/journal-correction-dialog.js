'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { normalizeJournalCorrection } from '@/lib/journal-correction-policy';
import { tokens } from '@/lib/design-system';
import styles from './journal-correction-dialog.module.css';
const labels = { DRAFT: 'Borrador', SUBMITTED: 'En revisión', APPROVED: 'Aprobado', REJECTED: 'Rechazado' };
const recordHref = id => '/dashboard/progress?recordId=' + encodeURIComponent(id) + '#daily-log-' + encodeURIComponent(id);
export default function JournalCorrectionDialog({ sourceId, projectId, organizationId, projectName, tasks, onClose, onSaved, onDirtyChange, onBusyChange }) {
  const dialog = useRef(null), closeButton = useRef(null), inFlight = useRef(false), attempt = useRef(null);
  const [source, setSource] = useState(null), [existing, setExisting] = useState(null), [state, setState] = useState('loading');
  const [draft, setDraft] = useState({ title: '', summary: '', taskId: '' }), [error, setError] = useState(''), [copied, setCopied] = useState('');
  const headingId = useId(), helpId = useId();
  const busy = state === 'saving', locked = busy || ['loading', 'uncertain', 'blocked', 'existing'].includes(state);
  const changed = Boolean(source && (draft.title !== source.title || draft.summary !== source.summary || (draft.taskId || null) !== source.taskId));
  useEffect(() => { onDirtyChange(changed || state === 'uncertain'); return () => onDirtyChange(false); }, [changed, state, onDirtyChange]);
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal(); closeButton.current?.focus();
    return () => { element.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    fetch('/api/progress/' + encodeURIComponent(sourceId) + '/correction', { cache: 'no-store', signal: controller.signal, headers: evidenceScopeHeaders({ organizationId, projectId }) })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || 'No se pudo consultar el parte.');
        if (body?.source?.id !== sourceId || body.source.projectId !== projectId || body.source.status !== 'REJECTED' || !/^[a-f0-9]{64}$/.test(body.source.version)) throw new Error('No se confirmó el origen de la corrección.');
        if (body.existing && (body.existing.projectId !== projectId || typeof body.existing.id !== 'string' || !labels[body.existing.status])) throw new Error('La corrección existente no pudo verificarse.');
        if (!active) return;
        setSource(body.source); setDraft({ title: body.source.title, summary: body.source.summary, taskId: body.source.taskId || '' });
        setExisting(body.existing); setState(body.existing ? 'existing' : body.canCreate === false ? 'blocked' : 'editing');
        if (body.canCreate === false && !body.existing) setError('La obra está en modo solo lectura. No se puede crear una corrección.');
      }).catch(failure => { if (active) { setError(failure.name === 'AbortError' ? 'La consulta demoró. Cerrá y volvé a intentarlo.' : failure.message); setState('blocked'); } })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [sourceId, projectId, organizationId]);
  function close() {
    if (inFlight.current) return;
    if ((changed || state === 'uncertain') && !window.confirm('La corrección todavía no está confirmada. ¿Descartar los cambios locales y salir?')) return;
    onClose();
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(draft.title + '\n\n' + draft.summary); setCopied('Texto copiado.'); }
    catch { setCopied('No se pudo copiar. Seleccioná el texto para conservarlo.'); }
  }
  async function save(event) {
    event.preventDefault(); if (inFlight.current || !source || ['blocked', 'existing', 'loading'].includes(state)) return;
    try {
      if (!attempt.current) attempt.current = { key: crypto.randomUUID(), command: normalizeJournalCorrection({ ...draft, expectedRevision: source.revision, sourceVersion: source.version }) };
    } catch (failure) { setError(failure.message); return; }
    inFlight.current = true; setState('saving'); setError('');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/progress/' + encodeURIComponent(sourceId) + '/correction', { method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }), 'Idempotency-Key': attempt.current.key }, body: JSON.stringify(attempt.current.command) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const failure = new Error(body?.error || 'La corrección no quedó confirmada.'); failure.status = response.status; throw failure;
      }
      const row = body?.dailyLog;
      if (!row || typeof row.id !== 'string' || !row.id.startsWith('jcor_') || row.projectId !== projectId || row.correctionOf?.id !== sourceId
        || !labels[row.status] || !Number.isSafeInteger(row.revision) || row.revision < 0 || typeof body.replayed !== 'boolean') throw new Error('Respuesta incompleta. Conservá el texto y verificá el mismo intento.');
      if (!body.replayed && (row.title !== attempt.current.command.title || row.summary !== attempt.current.command.summary || row.taskId !== attempt.current.command.taskId || row.status !== 'DRAFT')) throw new Error('La respuesta no coincide con la corrección solicitada.');
      onSaved(row); setState('saved');
    } catch (failure) {
      if (failure.status === 422 || failure.status === 400) { attempt.current = null; setState('editing'); }
      else setState([401, 403, 404, 409, 410].includes(failure.status) ? 'blocked' : 'uncertain');
      setError(failure.name === 'AbortError' ? 'La respuesta demoró. El borrador podría haberse creado: verificá el mismo intento.' : failure.message);
    } finally { clearTimeout(timeout); inFlight.current = false; }
  }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const items = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
    const first = items[0], last = items.at(-1); if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const choices = tasks.filter(task => task.type === 'TASK');
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={headingId} aria-describedby={helpId}
    style={{ '--correction-bg': tokens.colors.bg.secondary, '--correction-accent': tokens.colors.accent.primary }}
    onKeyDown={keyboard} onCancel={event => { event.preventDefault(); close(); }}>
    <header className={styles.header}><div><span>CONTINUIDAD DE OBRA</span><h2 id={headingId}>Preparar una corrección</h2></div><button ref={closeButton} type="button" onClick={close} disabled={busy} aria-label="Cerrar corrección">×</button></header>
    <p id={helpId} className={styles.help}>El original y su rechazo se conservan. Se crea otro borrador vinculado para corregir y volver a revisar.</p>
    <p className={styles.project}>{projectName}</p>
    {state === 'loading' && <p role="status">Verificando el parte, su versión y las correcciones existentes…</p>}
    {source && <section className={styles.source} aria-label="Parte original rechazado"><div><span>ORIGINAL RECHAZADO · v{source.revision}</span><strong>{source.title}</strong></div><p>{source.rejectionReason || 'El registro histórico no incluye un motivo de rechazo.'}</p><small>Fecha de trabajo: {source.workDate}. Se conserva la atribución del autor original; la intervención actual queda auditada.</small></section>}
    {existing ? <section className={styles.existing}><h3>Este parte ya tiene una corrección</h3><p>{existing.title} · {labels[existing.status]}</p><p>No se creará una copia adicional. Continuá desde el registro existente.</p><Link href={recordHref(existing.id)}>Abrir la corrección existente</Link></section> : source && <form onSubmit={save}>
      <ol className={styles.steps}><li>1 · Corregir</li><li>2 · Guardar borrador</li><li>3 · Enviar a revisión</li></ol>
      <fieldset disabled={locked} className={styles.fields}>
        <label>Título corregido<input aria-label="Título corregido" required maxLength={220} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
        <label>Detalle corregido<textarea aria-label="Detalle corregido" required rows={6} maxLength={10000} value={draft.summary} onChange={event => setDraft(current => ({ ...current, summary: event.target.value }))} /></label>
        <label>Tarea de la corrección<select aria-label="Tarea de la corrección" value={draft.taskId} onChange={event => setDraft(current => ({ ...current, taskId: event.target.value }))}><option value="">Sin tarea · pendiente de vincular</option>
          {source.taskId && !choices.some(task => task.id === source.taskId) && <option value={source.taskId} disabled>Tarea original no disponible en este catálogo</option>}
          {choices.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      </fieldset>
      <p className={styles.scope}>No se copian archivos ni se cambia el avance, la planificación o la decisión anterior. Revisá el motivo y corregí el contenido antes de guardar.</p>
      {state === 'uncertain' && <p className={styles.warning}>Conservamos la misma solicitud. Verificarla no debe generar otra corrección del mismo parte.</p>}
      <footer className={styles.footer}><button type="button" disabled={busy} onClick={close}>Volver sin corregir</button><button className={styles.primary} type="submit" disabled={busy || state === 'blocked' || (!changed && state !== 'uncertain')}>{busy ? 'Confirmando borrador…' : state === 'uncertain' ? 'Verificar el mismo intento' : 'Crear borrador corregido'}</button></footer>
    </form>}
    {error && <div role="alert" className={styles.warning}>{error}</div>}
    {['blocked', 'uncertain'].includes(state) && source && <div className={styles.recovery}><button type="button" onClick={copyDraft}>Copiar texto corregido</button><Link href={recordHref(sourceId)} target="_blank" rel="noopener noreferrer">Consultar original y corrección</Link><p role="status">{copied}</p></div>}
  </dialog>;
}
