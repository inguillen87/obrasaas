'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { tokens } from '@/lib/design-system';
import { createProgressRequest } from '@/lib/progress-request';
import { confirmedJournalTaskLink } from '@/lib/journal-task-link-policy';
import styles from './journal-task-link-dialog.module.css';
export default function JournalTaskLinkDialog({ record, tasks, projectName, projectId, organizationId, onCommit, onClose, onDirtyChange, onBusyChange }) {
  const dialogRef = useRef(null), cancelRef = useRef(null), pending = useRef(false), attempt = useRef(null);
  const [taskId, setTaskId] = useState(''), [filter, setFilter] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null), [uncertain, setUncertain] = useState(false);
  const headingId = useId(), helpId = useId();
  const request = useMemo(() => createProgressRequest({ organizationId, projectId }), [organizationId, projectId]);
  const choices = tasks.filter(task => task.type === 'TASK' && task.id !== record.taskId);
  const matches = choices.filter(task => task.title.toLocaleLowerCase('es').includes(filter.toLocaleLowerCase('es')));
  const selected = choices.find(task => task.id === taskId);
  const blocked = error && [401, 403, 404, 409].includes(error.status);
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  useEffect(() => { onDirtyChange(Boolean(taskId || uncertain)); return () => onDirtyChange(false); }, [taskId, uncertain, onDirtyChange]);
  useEffect(() => { const dialog = dialogRef.current, previous = document.activeElement; dialog.showModal(); cancelRef.current?.focus(); return () => { dialog.close(); if (previous?.isConnected) previous.focus(); }; }, []);
  function close() {
    if (pending.current) return;
    if ((taskId || uncertain) && !window.confirm(uncertain ? 'El resultado no está confirmado. Consultá el parte antes de crear otro intento. ¿Cerrar esta revisión?' : 'La tarea elegida todavía no se guardó. ¿Salir sin vincular?')) return;
    onClose();
  }
  async function submit(event) {
    event.preventDefault(); if (pending.current || blocked || !selected) return;
    if (!attempt.current) attempt.current = { key: crypto.randomUUID(), taskId, expectedRevision: record.revision };
    pending.current = true; setBusy(true); setError(null);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const command = attempt.current;
      const result = await request('/api/progress/' + encodeURIComponent(record.id) + '/task', { method: 'PATCH', signal: controller.signal, headers: { 'Idempotency-Key': command.key }, body: JSON.stringify({ taskId: command.taskId, expectedRevision: command.expectedRevision }) });
      const saved = confirmedJournalTaskLink(result, { recordId: record.id, projectId, taskId: command.taskId, expectedRevision: command.expectedRevision });
      setUncertain(false); onCommit(saved);
    } catch (failure) {
      setError(failure);
      if (!failure.status || failure.status >= 500 || failure.code === 'PROGRESS_RESPONSE_UNCONFIRMED') setUncertain(true);
      else if ([400, 422].includes(failure.status)) { attempt.current = null; setUncertain(false); }
    } finally { clearTimeout(timeout); pending.current = false; setBusy(false); }
  }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
    if (!elements.length) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === elements[0]) { event.preventDefault(); elements.at(-1).focus(); }
    else if (!event.shiftKey && document.activeElement === elements.at(-1)) { event.preventDefault(); elements[0].focus(); }
  }
  return <dialog className={styles.dialog} ref={dialogRef} aria-labelledby={headingId} aria-describedby={helpId}
    style={{ '--link-accent': tokens.colors.accent.primary }} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={keyboard}>
    <header><div><span className={styles.eyebrow}>CONTINUIDAD DE CAMPO</span><h2 id={headingId}>Vincular el parte a una tarea</h2></div><button type="button" aria-label="Cerrar vinculación" onClick={close} disabled={busy}>×</button></header>
    <p id={helpId}>El borrador seguirá siendo el mismo registro. La vinculación lo hará visible junto a su tarea en el Gantt; no modifica avance ni fechas.</p>
    <section className={styles.record}><span>{projectName} · borrador v{record.revision}</span><h3>{record.title}</h3><p>{record.summary}</p><small>{record.taskId ? 'Tarea actual: ' + (tasks.find(task => task.id === record.taskId)?.title || record.taskId) : 'Actualmente sin tarea vinculada'}</small></section>
    <form onSubmit={submit}>
      {choices.length ? <fieldset disabled={busy || uncertain || Boolean(blocked)}><label>Buscar actividad<input value={filter} onChange={event => setFilter(event.target.value)} placeholder="Nombre de la tarea" /></label>
        <label>Tarea de destino<select aria-label="Tarea de destino" value={taskId} onChange={event => { setTaskId(event.target.value); attempt.current = null; setError(null); }} required><option value="">Seleccioná una tarea de esta obra</option>{[...new Map([...(selected ? [selected] : []), ...matches].map(task => [task.id, task])).values()].map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        {!matches.length && <p>No hay actividades que coincidan con la búsqueda.</p>}
      </fieldset> : <p className={styles.warning}>No hay otra tarea disponible en este catálogo. Prepará la actividad en el cronograma o abrí toda la bitácora para elegir otra tarea.</p>}
      {selected && <div className={styles.impact}><strong>Después de confirmar</strong><span>Este parte aparecerá en «{selected.title}» y conservará su texto, fecha y autor.</span><span>El movimiento queda registrado en la auditoría.</span></div>}
      {error && <div className={styles.warning} role="alert"><strong>Vinculación no confirmada</strong><p>{error.name === 'AbortError' ? 'La respuesta demoró. El cambio podría haberse guardado; reintentá la misma solicitud.' : error.message}</p></div>}
      {(uncertain || blocked) && <a href="/dashboard/progress" target="_blank" rel="noopener noreferrer">Consultar el estado en otra pestaña</a>}
      <footer><button type="button" ref={cancelRef} disabled={busy} onClick={close}>Volver sin cambios</button><button type="submit" className={styles.confirm} disabled={busy || Boolean(blocked) || !selected}>{busy ? 'Vinculando…' : uncertain ? 'Verificar el mismo intento' : 'Confirmar vinculación'}</button></footer>
    </form>
  </dialog>;
}
