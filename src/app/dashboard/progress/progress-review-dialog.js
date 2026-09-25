'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { tokens } from '@/lib/design-system';
import { normalizeProgressReviewNote, PROGRESS_REVIEW_NOTE_LIMIT, progressReviewAttachmentHref } from '@/lib/progress-review-policy';
import styles from './progress-review-dialog.module.css';
const LOCKED_CODES = new Set(['EVIDENCE_CONTEXT_CHANGED', 'PROGRESS_JOURNAL_CONFLICT', 'PROGRESS_JOURNAL_TRANSITION_INVALID', 'PROGRESS_RESPONSE_UNCONFIRMED']);
export default function ProgressReviewDialog({ selection, projectName, taskTitle, onConfirm, onClose, onDirtyChange }) {
  const dialogRef = useRef(null), cancelRef = useRef(null), inFlight = useRef(false);
  const [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null), [copied, setCopied] = useState(false);
  const titleId = useId(), descriptionId = useId(), noteId = useId();
  const { item, kind, status } = selection;
  const attachmentHref = kind === 'EVIDENCE' ? progressReviewAttachmentHref(item) : null;
  const rejection = status === 'REJECTED';
  const hasNoteField = rejection || kind === 'EVIDENCE';
  const locked = LOCKED_CODES.has(error?.code) || Boolean(error && (!error.status || error.status >= 500));
  const recordTitle = item.title || item.caption || 'Evidencia sin descripción';
  function requestClose() {
    if (inFlight.current) return;
    if (note.trim() && !window.confirm('El fundamento todavía no está confirmado. ¿Descartarlo y cerrar la revisión?')) return;
    onClose();
  }
  useEffect(() => {
    onDirtyChange(Boolean(note.trim()));
    return () => onDirtyChange(false);
  }, [note, onDirtyChange]);
  useEffect(() => {
    const dialog = dialogRef.current, previous = document.activeElement;
    if (!dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (inFlight.current || locked) return;
    let normalized;
    try { normalized = normalizeProgressReviewNote(kind, status, note); }
    catch (failure) { setError(failure); return; }
    inFlight.current = true; setBusy(true); setError(null);
    try { await onConfirm(normalized); }
    catch (failure) { setError(failure); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function copyNote() {
    try { await navigator.clipboard.writeText(note); setCopied(true); }
    catch { setCopied('failed'); }
  }
  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled),a[href]')].filter(el => el.getClientRects().length);
    if (!focusable.length) { event.preventDefault(); return; }
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    style={{ '--review-bg': tokens.colors.bg.secondary, '--review-accent': tokens.colors.accent.primary }}
    onCancel={event => { event.preventDefault(); requestClose(); }} onKeyDown={keyboard}>
    <div className={styles.header}><div><span className={styles.eyebrow}>REVISIÓN HUMANA · {kind === 'DAILY_LOG' ? 'PARTE DE OBRA' : 'EVIDENCIA'}</span>
      <h2 id={titleId}>{rejection ? 'Revisar rechazo' : 'Revisar aprobación'}</h2></div>
      <button type="button" className={styles.close} aria-label="Cerrar revisión" onClick={requestClose} disabled={busy}>×</button>
    </div>
    <p id={descriptionId} className={styles.description}>Confirmá el registro y su alcance antes de decidir. El estado final no se modifica desde este circuito.</p>
    <section className={styles.record} aria-label="Registro que se revisará">
      <p className={styles.project}>{projectName}</p><h3>{recordTitle}</h3>
      <div className={styles.metadata}><span>{kind === 'DAILY_LOG' ? 'En revisión' : 'Pendiente de revisión'}</span><span>Versión {item.revision}</span></div>
      {taskTitle && <p>Tarea: {taskTitle}</p>}
      {item.summary && <p className={styles.summary}>{item.summary}</p>}
      {attachmentHref && <a className={styles.attachment} href={attachmentHref} target="_blank" rel="noopener noreferrer">Abrir evidencia original</a>}
      <small>Referencia: {item.id}</small>
    </section>
    <form onSubmit={submit}>
      {hasNoteField && <label className={styles.note} htmlFor={noteId}>{rejection ? 'Motivo del rechazo · obligatorio' : 'Nota de revisión · opcional'}
        <textarea id={noteId} value={note} maxLength={PROGRESS_REVIEW_NOTE_LIMIT} rows={4} disabled={busy || locked}
          required={rejection} onChange={event => { setNote(event.target.value); setCopied(false); }}
          placeholder={rejection ? 'Explicá qué falta o qué debe corregirse.' : 'Aclaraciones sobre la evidencia revisada.'} />
        <span className={styles.noteHint}>{note.length} / {PROGRESS_REVIEW_NOTE_LIMIT} · No incluyas información personal sensible.</span>
      </label>}
      <p className={styles.scope}>{rejection ? 'El motivo quedará visible en el registro para orientar la corrección. No se borra la evidencia.' : 'La aprobación registra esta revisión; no certifica cantidades, no autoriza pagos y no modifica el Gantt.'}</p>
      {error && <div role="alert" className={styles.error}><strong>No se confirmó esta decisión</strong><p>{error.message}</p></div>}
      {locked && <div className={styles.recovery}><p>La decisión no se reenvía automáticamente. Verificá el estado del registro antes de volver a decidir.</p>
        {note.trim() && <button type="button" onClick={copyNote}>Copiar fundamento</button>}
        <a href="/dashboard/progress" target="_blank" rel="noopener noreferrer">Consultar bitácora en otra pestaña</a>
        {copied && <p role="status">{copied === true ? "Fundamento copiado." : "No se pudo copiar. Seleccioná el texto para conservarlo."}</p>}
      </div>}
      <footer className={styles.footer}><button ref={cancelRef} type="button" onClick={requestClose} disabled={busy}>Volver sin decidir</button>
        <button type="submit" className={rejection ? styles.reject : styles.approve} disabled={busy || locked || (rejection && !note.trim())}>
          {busy ? 'Registrando decisión…' : rejection ? 'Confirmar rechazo' : 'Confirmar aprobación'}
        </button>
      </footer>
    </form>
  </dialog>;
}
