'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import { normalizeMessageReport, confirmedMessageReport, messageReportSourceId, messageReportFingerprint, messageReportPreparationMatches, messageReportRecovery } from '@/lib/whatsapp/progress-report-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import { tokens } from '@/lib/design-system';
import styles from './message-report-action.module.css';
const reportHref = saved => '/dashboard/progress?taskId=' + encodeURIComponent(saved.taskId) + '#daily-log-' + encodeURIComponent(saved.id);
export default function MessageReportAction({ sourceKind, onOpen, saved }) {
  return <div className={styles.entry}>{saved
    ? <Link href={reportHref(saved)}>Parte registrado · abrir en la bitácora</Link>
    : <button type="button" onClick={onOpen}>Preparar parte desde {sourceKind === 'AUDIO_TRANSCRIPT' ? 'el audio transcripto' : 'este mensaje'}</button>}</div>;
}
export function MessageReportDialog(props) {
  return <ScopedMessageReportDialog key={[props.organizationId, props.projectId, props.conversationId, props.messageId].join(':')} {...props} />;
}
function ScopedMessageReportDialog({ organizationId, projectId, projectName, conversationId, messageId, tasks, onClose, onSaved }) {
  const dialog = useRef(null), cancel = useRef(null), attempt = useRef(null), sending = useRef(false), alive = useRef(true), activePost = useRef(null), titleId = useId();
  const [source, setSource] = useState(null), [existing, setExisting] = useState(null), [phase, setPhase] = useState('loading'), [queryEpoch, setQueryEpoch] = useState(0);
  const [draft, setDraft] = useState({ taskId: '', title: '', summary: '' }), [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState(null), [uncertain, setUncertain] = useState(false), [copyState, setCopyState] = useState('');
  const busy = phase === 'saving', loading = phase === 'loading', blocked = phase === 'blocked', locked = phase !== 'ready' || uncertain;
  const endpoint = '/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/messages/' + encodeURIComponent(messageId) + '/progress-report';
  const dirty = !existing && Boolean(draft.title || draft.summary || draft.taskId || uncertain);
  useWorkspaceLeaveGuard({ dirty, busy });
  useEffect(() => {
    alive.current = true;
    const node = dialog.current, previous = document.activeElement;
    if (!node.open) node.showModal(); cancel.current?.focus();
    return () => { alive.current = false; activePost.current?.abort(); node.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const warn = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, busy]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const context = { organizationId, projectId, conversationId, messageId };
    const timeout = setTimeout(() => controller.abort(), 15000);
    Promise.all([
      messageReportSourceId(context),
      fetch(endpoint, { signal: controller.signal, cache: 'no-store', headers: evidenceScopeHeaders(context) }).then(async response => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw Object.assign(new Error(data?.error || 'No se pudo comprobar el mensaje de origen.'), { status: response.status, code: data?.code });
        return data;
      }),
    ]).then(([reportId, data]) => {
      if (!active) return;
      if (!messageReportPreparationMatches(data, { ...context, reportId })) throw Object.assign(new Error('La consulta no confirmó el mensaje y parte esperados.'), { code: 'WHATSAPP_REPORT_SOURCE_UNCONFIRMED' });
      if (attempt.current) {
        // A read after an uncertain write may confirm only its original receipt.
        // Absence is not proof of failure and cannot unlock another POST.
        if (!data.existing) {
          setPhase('ready'); setError(new Error('El recibo aún no está disponible. Conservá el borrador y volvé a consultar; no se creará otro parte.')); return;
        }
        const confirmed = confirmedMessageReport({ context: data.context, ...data.existingReceipt, report: data.existing, replayed: true }, attempt.current.expected);
        setExisting(confirmed); setUncertain(false); setPhase('ready'); setError(null); attempt.current = null;
        return;
      }
      setSource(data.source); setExisting(data.existing); setPhase('ready'); setError(null);
    }).catch(failure => {
      if (!active) return;
      setError(failure);
      setPhase([401,402,403,404,410].includes(failure.status) || failure.code === 'WHATSAPP_REPORT_INTEGRITY' || failure.code === 'WHATSAPP_REPORT_CONTEXT' || failure.code === 'EVIDENCE_CONTEXT_CHANGED' ? 'blocked' : 'read-error');
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [endpoint, organizationId, projectId, messageId, conversationId, queryEpoch]);
  function refresh() {
    if (sending.current || loading || blocked) return;
    setPhase('loading'); setError(null); setReviewed(false); setQueryEpoch(value => value + 1);
  }
  function close() {
    if (sending.current) return;
    if (dirty && !window.confirm('El parte todavía no está confirmado. ¿Salir conservando únicamente lo que ya esté guardado en el servidor?')) return;
    onClose();
  }
  async function save(event) {
    event.preventDefault(); if (sending.current || locked || !source || !reviewed || existing) return;
    sending.current = true; setPhase('saving'); setError(null);
    const controller = new AbortController(); activePost.current = controller;
    const timeout = setTimeout(() => controller.abort(), 18000); let dispatchStarted = false, confirmed = null;
    try {
      const input = normalizeMessageReport({ ...draft, sourceVersion: source.version });
      const context = { organizationId, projectId, conversationId, messageId };
      const [reportId, requestFingerprint] = await Promise.all([messageReportSourceId(context), messageReportFingerprint(input)]);
      if (!alive.current || controller.signal.aborted) return;
      attempt.current = { key: crypto.randomUUID(), input, expected: { ...context, reportId, taskId: input.taskId, sourceVersion: input.sourceVersion, requestFingerprint } };
      dispatchStarted = true;
      const response = await fetch(endpoint, { method: 'POST', signal: controller.signal, cache: 'no-store', headers: { ...evidenceScopeHeaders(context), 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body: JSON.stringify(input) });
      const data = await response.json().catch(() => null);
      if (!alive.current) return;
      if (!response.ok) throw Object.assign(new Error(data?.error || 'No se confirmó el guardado.'), { status: response.status, code: data?.code });
      confirmed = confirmedMessageReport(data, attempt.current.expected);
      setExisting(confirmed); setUncertain(false); setPhase('ready'); attempt.current = null;
    } catch (failure) {
      if (!alive.current) return;
      const recovery = dispatchStarted ? messageReportRecovery(failure) : 'revise';
      if (recovery === 'refresh' || recovery === 'revise') { attempt.current = null; setUncertain(false); setReviewed(false); setPhase(recovery === 'refresh' ? 'refresh-required' : 'ready'); }
      else { setUncertain(true); setPhase(recovery === 'blocked' ? 'blocked' : 'ready'); }
      setError(failure);
    } finally { clearTimeout(timeout); activePost.current = null; sending.current = false; }
    if (confirmed && alive.current) {
      // Parent refresh failure must not turn a confirmed write into another send.
      try { publishFieldInvalidation({ organizationId, projectId }); onSaved(confirmed); }
      catch { setError(new Error('El parte quedó confirmado. No se pudo actualizar la bandeja; abrí el registro guardado.')); }
    }
  }
  return <dialog ref={dialog} className={styles.dialog} style={{ '--report-bg': tokens.colors.bg.secondary, '--report-accent': tokens.colors.accent.primary }} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }}>
    <header><div><span className={styles.eyebrow}>WHATSAPP → PARTE → TAREA</span><h2 id={titleId}>Preparar parte de obra</h2><p>{projectName}</p></div><button ref={cancel} type="button" aria-label="Cerrar preparación del parte" onClick={close} disabled={busy}>×</button></header>
    <div className={styles.body}>
      <p className={styles.intro}>Revisá el origen y redactá un parte operativo. Se guardará como borrador, sin enviar mensajes, ejecutar compras ni modificar el avance.</p>
      {loading && <p role="status">Comprobando origen y permisos…</p>}
      {error && <p role="alert" className={styles.warning}>{error.name === 'AbortError' ? 'La consulta demoró. Conservá el borrador y verificá el recibo sin repetir el guardado.' : error.message}</p>}
      {!existing && !blocked && (phase === 'read-error' || phase === 'refresh-required' || uncertain) && <section className={styles.recovery} aria-label="Recuperar parte sin perder el borrador"><p>Las fechas, la tarea y el texto de esta ventana se conservan. Consultar no crea ni modifica registros.</p><button type="button" disabled={loading || busy} onClick={refresh}>{uncertain ? 'Consultar recibo sin guardar de nuevo' : phase === 'refresh-required' ? 'Actualizar mensaje de origen' : 'Volver a consultar el origen'}</button></section>}
      {existing ? <section className={styles.existing}><h3>Este mensaje ya tiene un parte</h3><p>No se crea otra copia aunque cambies de pestaña o de usuario.</p><Link href={reportHref(existing)}>Consultar parte registrado</Link></section> : source && <form onSubmit={save}>
        <section className={styles.source} aria-label="Origen del parte"><div><strong>{source.kind === 'AUDIO_TRANSCRIPT' ? 'Transcripción ya procesada' : 'Texto recibido'}</strong><span>Fecha de trabajo: {source.workDate}</span></div><p>{source.text}</p>
          {source.kind === 'AUDIO_TRANSCRIPT' && <small>La transcripción puede contener errores. No se ejecuta otra llamada de IA desde esta acción.</small>}
          {source.text.length <= 3000 && <button type="button" disabled={locked} onClick={() => { setDraft(current => ({ ...current, summary: source.text })); setReviewed(false); }}>Usar este texto como borrador</button>}
        </section>
        <fieldset disabled={locked} className={styles.fields}>
          <label>Tarea de destino<select aria-label="Tarea de destino" required value={draft.taskId} onChange={event => { setDraft(current => ({ ...current, taskId: event.target.value })); setReviewed(false); }}><option value="">Elegí una actividad de esta obra</option>{tasks.filter(task => task.type === 'TASK').map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label>Título del parte<input required maxLength={180} value={draft.title} onChange={event => { setDraft(current => ({ ...current, title: event.target.value })); setReviewed(false); }} /></label>
          <label>Resumen operativo revisado<textarea rows={5} required maxLength={3000} value={draft.summary} onChange={event => { setDraft(current => ({ ...current, summary: event.target.value })); setReviewed(false); }} /></label>
          <p className={styles.hint}>No trasladar información médica, bancaria o de identidad a la bitácora general. El mensaje original queda en su canal con acceso restringido.</p>
          <label className={styles.check}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Revisé el texto, la tarea y el contexto de la obra.</label>
        </fieldset>
        {uncertain && <p className={styles.warning}>El resultado anterior no está confirmado. Se conserva la identidad de esa solicitud; no se habilita otro guardado.</p>}
        {uncertain && <div className={styles.recovery}><button type="button" onClick={async () => { try { await navigator.clipboard.writeText(draft.title + '\n\n' + draft.summary); setCopyState('Borrador copiado.'); } catch { setCopyState('No se pudo copiar. Conservá esta pantalla antes de salir.'); } }}>Copiar borrador</button><span role="status">{copyState}</span></div>}
        {blocked && <p className={styles.warning}>Verificá permisos, origen e integridad antes de continuar. No se ejecuta otro cambio automáticamente.</p>}
        <button className={styles.primary} type="submit" disabled={locked || !reviewed || !draft.taskId}>{busy ? 'Registrando parte…' : 'Crear borrador vinculado a la tarea'}</button>
      </form>}
    </div>
    <footer><button type="button" disabled={busy} onClick={close}>Volver a mensajes</button><small>Preparar un parte no aprueba su contenido. La revisión continúa en la bitácora.</small></footer>
  </dialog>;
}
