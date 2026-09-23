'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { templateCatalogMatches, templateProvisionMatches, templateStatusPresentation, templateRequestRejectedBeforeProvider } from '@/lib/whatsapp/template-review-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './template-review-control.module.css';
const noop = () => {};
const date = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin registro previo';

export default function TemplateReviewControl({ flow, organizationId, projectId, companyName, projectName, canReadInbox = false, disabled = false, onCatalog = noop, onBusy = noop, onGraphError = noop }) {
  const heading = useId(), dialog = useRef(null), alive = useRef(true), flight = useRef(null), sequence = useRef(0), attempt = useRef(null);
  const [open, setOpen] = useState(false), [entry, setEntry] = useState(null), [phase, setPhase] = useState('idle');
  const [consent, setConsent] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState('');
  const saving = phase === 'saving', busy = saving || phase === 'loading';
  useWorkspaceLeaveGuard({ dirty: uncertain || open && consent, busy: saving });
  useEffect(() => { alive.current = true; return () => { alive.current = false; flight.current?.abort(); }; }, []);
  useEffect(() => {
    if (!open) return;
    const el = dialog.current, previous = document.activeElement;
    el.showModal(); el.querySelector('[aria-label="Cerrar revisión de plantilla"]')?.focus();
    return () => { el.close(); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  useEffect(() => {
    const warn = event => { if (uncertain || saving) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [uncertain, saving]);

  async function request(write = false) {
    if (flight.current || disabled || write && (!consent || uncertain || !entry || !flow.runtimeActive)) return;
    const review = entry && { blueprintKey: flow.key, expectedName: entry.expectedName, contentSha256: entry.contentSha256, confirmed: true };
    if (write && entry.template && entry.template.status !== 'MISSING') return;
    if (write) attempt.current = review;
    const current = ++sequence.current, controller = new AbortController(); flight.current = controller;
    setConsent(false); setError(''); setPhase(write ? 'saving' : 'loading'); onBusy(true);
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch('/api/integrations/whatsapp/templates', { method: write ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
        headers: { ...evidenceScopeHeaders({ organizationId, projectId }), ...(write ? { 'Content-Type': 'application/json' } : {}) },
        ...(write ? { body: JSON.stringify(review) } : {}) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(payload?.error || 'No se pudo confirmar el estado de la plantilla.'), { code: payload?.code, status: response.status });
      if (write ? !templateProvisionMatches(payload, review, { organizationId, projectId }) : !templateCatalogMatches(payload, { organizationId, projectId })) {
        throw Object.assign(new Error('La respuesta no corresponde al mensaje, empresa y obra consultados.'), { code: 'TEMPLATE_RESPONSE_UNCONFIRMED' });
      }
      if (!alive.current || current !== sequence.current) return;
      const catalog = write ? [payload.result] : payload.templates;
      const found = catalog.find(row => row.blueprintKey === flow.key) || null;
      setEntry(found); setPhase('ready'); onCatalog(catalog, write);
      if (write || attempt.current && found?.template && found.template.status !== 'MISSING'
        && found.expectedName === attempt.current.expectedName && found.contentSha256 === attempt.current.contentSha256) {
        setUncertain(false); attempt.current = null;
      }
    } catch (failure) {
      if (!alive.current || current !== sequence.current) return;
      const preflight = write && templateRequestRejectedBeforeProvider(failure);
      if (write && !preflight) setUncertain(true);
      if (preflight) { attempt.current = null; setEntry(null); }
      const blocked = [401, 403].includes(failure.status) || failure.code === 'EVIDENCE_CONTEXT_CHANGED'
        || failure.code === 'WHATSAPP_TEMPLATE_CONTEXT_REQUIRED';
      setPhase(blocked ? 'blocked' : 'error');
      setError(failure.name === 'AbortError' ? 'La respuesta demoró. Consultá el estado; no se repetirá la creación automáticamente.' : failure.message);
      onGraphError(failure);
    } finally {
      clearTimeout(timer);
      if (current === sequence.current) { flight.current = null; if (alive.current) onBusy(false); }
    }
  }
  function show() { if (disabled || flight.current) return; setEntry(null); setOpen(true); void request(false); }
  function close() {
    if (saving) return;
    if (uncertain && !window.confirm('La solicitud todavía no está confirmada. Podés volver a consultar desde esta pantalla; cerrar no la cancela.')) return;
    sequence.current++; flight.current?.abort(); flight.current = null; onBusy(false); setOpen(false); setConsent(false); setPhase('idle');
  }
  const presentation = phase === 'ready' ? templateStatusPresentation(entry?.template)
    : { label: 'Estado pendiente de verificar', tone: 'pending', detail: 'La vista conserva el contenido anterior, pero no confirma el estado actual. Consultá de nuevo antes de continuar.' };
  const canCreate = phase === 'ready' && !uncertain && flow.runtimeActive && entry && (!entry.template || entry.template.status === 'MISSING');
  const preview = entry?.preview;
  return <>
    <button type="button" className={styles.openButton} disabled={disabled} onClick={show}>Ver mensaje y plantilla</button>
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); close(); }}>
      <header className={styles.header}><div><span>PLANTILLA OPERATIVA · WHATSAPP</span><h2 id={heading}>{flow.title}</h2></div><button type="button" onClick={close} disabled={saving} aria-label="Cerrar revisión de plantilla">×</button></header>
      <div className={styles.body}>
        <p className={styles.scope}><strong>{companyName}</strong><span>Obra: {projectName}</span></p>
        <p>Esta es la versión del mensaje vinculada al formulario de esta obra. Solicitar su aprobación no envía mensajes ni activa operaciones de campo.</p>
        {phase === 'loading' && <p role="status">Consultando esta versión en Meta…</p>}
        {preview && <>
          <section className={styles.preview} aria-label="Vista previa del mensaje"><span>MENSAJE QUE RECIBIRÍA EL DESTINATARIO</span><div className={styles.bubble}><p>{preview.bodyText}</p><div className={styles.flowButton}><span aria-hidden="true">▤</span> {preview.buttonText}</div></div><small>Vista de contenido: el aspecto final depende de WhatsApp. El botón abre el formulario vinculado, no acredita una tarea completada.</small></section>
          <section className={styles.status} data-tone={presentation.tone} aria-label="Estado de la plantilla"><strong>{presentation.label}</strong><p>{presentation.detail}</p></section>
          <dl className={styles.facts}><div><dt>Idioma</dt><dd>Español · Argentina ({preview.language})</dd></div><div><dt>Categoría consultada</dt><dd>{entry.template?.category || preview.category}</dd></div><div><dt>Última sincronización</dt><dd>{date(entry.template?.lastSyncedAt)}</dd></div></dl>
          {entry.template?.rejectionReason && <section className={styles.notice} aria-label="Motivo informado por Meta"><strong>Motivo informado por Meta</strong><p>{entry.template.rejectionReason}</p></section>}
          <details className={styles.identity}><summary>Identidad de esta versión</summary><p>{entry.expectedName}</p><small>Contenido SHA-256: {entry.contentSha256}</small></details>
        </>}
        {phase === 'ready' && !entry && <p className={styles.notice} role="status">No hay una versión publicada del formulario para preparar su plantilla. Revisá primero el estado del formulario en esta obra.</p>}
        {error && <p role="alert" className={styles.notice}>{error}</p>}
        {uncertain && <p className={styles.notice} role="status">Solicitud sin confirmar. Consultar estado no vuelve a crear la plantilla. Hasta reconocer la versión exacta, no se habilita otra solicitud desde este panel.</p>}
        {canCreate && <label className={styles.consent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />Revisé el mensaje, la empresa y la obra. Confirmo solicitar esta versión a Meta; no enviar mensajes a personas.</label>}
        {phase === 'ready' && entry?.template?.canSend && canReadInbox && !uncertain && <p className={styles.next}><Link href="/dashboard/inbox" onClick={event => { if (saving) event.preventDefault(); }}>Abrir conversaciones →</Link><span>Seleccioná el contacto autorizado y revisá el envío en la bandeja. Aprobada no significa enviada ni entregada.</span></p>}
      </div>
      <footer className={styles.footer}><button type="button" onClick={() => request(false)} disabled={busy || disabled || phase === 'blocked'}>{uncertain ? 'Consultar solicitud sin reenviar' : 'Consultar estado en Meta'}</button>
        {canCreate && <button type="button" className={styles.primary} disabled={!consent || busy || disabled} onClick={() => request(true)}>Solicitar aprobación de esta versión</button>}
        {saving && <span role="status">Solicitando aprobación… No cierres esta ventana.</span>}
      </footer>
    </dialog>}
  </>;
}
