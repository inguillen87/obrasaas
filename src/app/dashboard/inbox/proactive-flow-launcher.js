'use client';
import Link from 'next/link';
import ProactiveFlowHistory from './proactive-flow-history';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { flowCatalogMatches, flowResultMatches, flowReceiptMatches, flowResolutionMatches, flowOutcomePresentation } from '@/lib/whatsapp/proactive-flow-confirmation';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './inbox.module.css';
import reviewStyles from './proactive-flow-review.module.css';

const maskedPhone = value => '•••• ' + String(value || '').replace(/\D/g, '').slice(-4);
const safeError = (error, fallback) => error?.name === 'AbortError' ? 'La respuesta demoró. Consultá el mismo intento sin reenviarlo.'
  : typeof error?.message === 'string' && !/failed to fetch|networkerror|load failed/i.test(error.message) ? error.message : fallback;
async function responseBody(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(typeof body?.error === 'string' ? body.error : 'No se pudo confirmar la operación.'), { status: response.status, code: body?.code });
  return body;
}
const unconfirmed = () => Object.assign(new Error('La respuesta no confirmó este formulario y conversación. Conservamos el intento para consultar su recibo.'), { code: 'FLOW_UNCONFIRMED' });

// Remount on every scope change. No attempt or recipient survives into another chat.
export default function ProactiveFlowLauncher(props) {
  return <><ScopedFlowLauncher key={[props.organizationId, props.projectId, props.conversationId].join(':')} {...props} /><ProactiveFlowHistory organizationId={props.organizationId} projectId={props.projectId} conversationId={props.conversationId} online={props.online} /></>;
}
function ScopedFlowLauncher({ organizationId, projectId, conversationId, online = true, canManageIntegrations = false, replyWindowOpen = false, onMessageSent }) {
  const heading = useId(), contentId = useId();
  const alive = useRef(true), reader = useRef(null), mutation = useRef(null), attempt = useRef(null);
  const [payload, setPayload] = useState(null), [phase, setPhase] = useState('loading'), [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState(''), [consent, setConsent] = useState(false), [expanded, setExpanded] = useState(!replyWindowOpen);
  const [operation, setOperation] = useState(null), [working, setWorking] = useState(''), [notice, setNotice] = useState(null), [refreshWarning, setRefreshWarning] = useState('');
  const [resolution, setResolution] = useState(null), [riskAccepted, setRiskAccepted] = useState(false), [resolutionUncertain, setResolutionUncertain] = useState(false);
  const selected = payload?.catalog.find(row => row.key === selectedKey) || null;
  const busy = Boolean(working), uncertain = Boolean(operation);
  useWorkspaceLeaveGuard({ dirty: uncertain || Boolean(resolution) || consent, busy });
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; reader.current?.abort(); mutation.current?.abort(); };
  }, []);
  useEffect(() => {
    const warn = event => { if (uncertain || busy || resolutionUncertain) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [uncertain, busy, resolutionUncertain]);
  const loadCatalog = useCallback(async () => {
    if (!organizationId || !projectId || !conversationId || mutation.current) return;
    reader.current?.abort(); const controller = new AbortController(); reader.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    setPhase('loading'); setError(''); setConsent(false); setSelectedKey('');
    try {
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?projectId=' + encodeURIComponent(projectId), {
        cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) },
      });
      const body = await responseBody(response);
      if (!flowCatalogMatches(body, { organizationId, projectId, conversationId })) throw unconfirmed();
      if (alive.current && reader.current === controller) { setPayload(body); setPhase('ready'); }
    } catch (failure) {
      if (alive.current && reader.current === controller) { setPayload(null); setPhase('error'); setError(safeError(failure, 'No se pudo verificar el catálogo y destinatario de esta conversación.')); }
    } finally { clearTimeout(timer); if (reader.current === controller) reader.current = null; }
  }, [organizationId, projectId, conversationId]);
  useEffect(() => { const frame = requestAnimationFrame(() => void loadCatalog()); return () => { cancelAnimationFrame(frame); reader.current?.abort(); reader.current = null; }; }, [loadCatalog]);

  function notify(result) {
    if (!alive.current) return;
    try { Promise.resolve(onMessageSent?.(result)).catch(() => { if (alive.current) setRefreshWarning('El recibo está confirmado, pero el historial no pudo actualizarse. No vuelvas a enviar por este error.'); }); }
    catch { setRefreshWarning('El recibo está confirmado, pero el historial no pudo actualizarse. No vuelvas a enviar por este error.'); }
  }
  function adopt(result) {
    const shown = flowOutcomePresentation(result.message.status); setNotice(shown); setError('');
    if (!shown.uncertain) { attempt.current = null; setOperation(null); setSelectedKey(''); setConsent(false); }
    notify(result);
  }
  async function send() {
    if (mutation.current || reader.current || attempt.current || !online || phase !== 'ready' || !selected?.canSend || !consent || resolution) return;
    const command = { key: 'inbox-flow-' + crypto.randomUUID(), blueprintKey: selected.key, reviewVersion: selected.reviewVersion, bodyText: selected.preview.bodyText };
    attempt.current = command; setOperation(command); setConsent(false); setNotice(null); setError(''); setRefreshWarning('');
    const controller = new AbortController(); mutation.current = controller; setWorking('send');
    const timer = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?projectId=' + encodeURIComponent(projectId), {
        method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }), 'Idempotency-Key': command.key },
        body: JSON.stringify({ projectId, blueprintKey: command.blueprintKey, idempotencyKey: command.key, reviewVersion: command.reviewVersion, confirmed: true }),
      });
      const result = await responseBody(response);
      if (!flowResultMatches(result, command, { organizationId, projectId, conversationId })) throw unconfirmed();
      if (alive.current && mutation.current === controller) adopt(result);
    } catch (failure) {
      if (!alive.current || mutation.current !== controller) return;
      setError(safeError(failure, 'No se confirmó la entrega. Consultá el recibo sin repetir el envío.'));
      if (failure.code === 'WHATSAPP_FLOW_REVIEW_CHANGED' && failure.status === 409 || failure.code === 'WHATSAPP_FLOW_REVIEW_REQUIRED' && failure.status === 400) {
        attempt.current = null; setOperation(null); setSelectedKey(''); setPayload(null); setPhase('error');
      } else setNotice(flowOutcomePresentation('unknown'));
    } finally { clearTimeout(timer); if (mutation.current === controller) { mutation.current = null; if (alive.current) setWorking(''); } }
  }
  async function readReceipt() {
    if (mutation.current || !online || !attempt.current) return;
    const command = attempt.current, controller = new AbortController(); mutation.current = controller; setWorking('receipt'); setError('');
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const params = new URLSearchParams({ projectId, mode: 'receipt', blueprintKey: command.blueprintKey });
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?' + params, {
        cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }), 'Idempotency-Key': command.key, 'X-ObraSaaS-Flow-Review': command.reviewVersion },
      });
      const result = await responseBody(response);
      if (!flowReceiptMatches(result, command, { organizationId, projectId, conversationId })) throw unconfirmed();
      if (!alive.current || mutation.current !== controller) return;
      if (result.found) adopt(result);
      else { setNotice(flowOutcomePresentation('unknown')); setError('El recibo todavía no aparece. Esto no confirma que el envío haya fallado; no habilitamos otro envío.'); }
    } catch (failure) { if (alive.current && mutation.current === controller) setError(safeError(failure, 'No se pudo consultar el recibo. El intento se conserva sin reenviarlo.')); }
    finally { clearTimeout(timer); if (mutation.current === controller) { mutation.current = null; if (alive.current) setWorking(''); } }
  }
  async function resolve() {
    if (mutation.current || !online || !resolution || !riskAccepted) return;
    const command = resolution, controller = new AbortController(); mutation.current = controller; setWorking('resolve'); setError('');
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/proactive-flows?projectId=' + encodeURIComponent(projectId), {
        method: 'PATCH', cache: 'no-store', signal: controller.signal,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) },
        body: JSON.stringify({ projectId, ...command, confirmation: 'ACEPTO_RIESGO_DE_DUPLICADO' }),
      });
      const result = await responseBody(response);
      if (!flowResolutionMatches(result, command, { organizationId, projectId, conversationId })) throw unconfirmed();
      if (!alive.current || mutation.current !== controller) return;
      setResolution(null); setResolutionUncertain(false); setRiskAccepted(false); attempt.current = null; setOperation(null); setSelectedKey(''); setPayload(null); setPhase('idle');
      setNotice({ label: 'Decisión registrada', detail: 'No se envió otro mensaje. Actualizá el catálogo para revisar una nueva operación.' });
      notify({ ...result, message: result.resolvedAttempt });
    } catch (failure) { if (alive.current && mutation.current === controller) { setResolutionUncertain(true); setError(safeError(failure, 'La decisión no quedó confirmada. No se habilitó un nuevo envío.')); } }
    finally { clearTimeout(timer); if (mutation.current === controller) { mutation.current = null; if (alive.current) setWorking(''); } }
  }

  const verified = phase === 'ready';
  return <section className={styles.flowLauncher} data-window={replyWindowOpen ? 'open' : 'closed'} aria-labelledby={heading}>
    <header className={styles.flowLauncherHeader}>
      <span className={styles.flowLauncherIcon} aria-hidden="true"><i className="fa-brands fa-whatsapp" /></span>
      <div className={styles.flowLauncherCopy}><strong id={heading}>Formularios operativos</strong><small>Revisá el mensaje y su destinatario antes de enviar. La plantilla y los permisos se comprueban nuevamente en el servidor.</small></div>
      <div className={styles.flowHeaderActions}><span className={styles.flowWindowBadge} role="status">{phase === 'loading' ? 'Verificando…' : verified ? 'Catálogo consultado' : 'Estado sin verificar'}</span>
        <button className={styles.flowToggle} type="button" aria-controls={contentId} aria-expanded={expanded} aria-label={expanded ? 'Ocultar formularios operativos' : 'Abrir formularios operativos'} onClick={() => setExpanded(value => !value)}>{expanded ? 'Ocultar' : 'Abrir'}</button>
      </div>
    </header>
    {(expanded || uncertain || resolutionUncertain) && <div id={contentId} className={`${styles.flowLauncherBody} ${reviewStyles.content}`}>
      {notice && <div className={notice.uncertain ? styles.flowUnresolved : styles.flowSuccess} role="status"><strong>{notice.label}</strong><span>{notice.detail}</span></div>}
      {error && <p className={styles.flowSendError} role="alert">{error}</p>}
      {refreshWarning && <p className={styles.flowSendError} role="alert">{refreshWarning}</p>}
      {!online && <p role="status">Sin conexión. El intento no se reenvía al reconectar.</p>}
      {uncertain && <div className={reviewStyles.receipt} aria-label="Recuperación del mismo intento"><p>Conservamos el mismo intento en esta conversación. Consultar su recibo no envía el formulario ni levanta un bloqueo.</p><button type="button" onClick={readReceipt} disabled={busy || !online}>{working === 'receipt' ? 'Consultando recibo…' : 'Consultar recibo sin reenviar'}</button></div>}
      {phase === 'loading' && <p role="status">Verificando plantillas y destinatario…</p>}
      <button type="button" className={reviewStyles.refresh} onClick={() => void loadCatalog()} disabled={busy || phase === 'loading' || !online}>Actualizar catálogo</button>
      {verified && <>
        {!payload.capability.allowed && <div className={styles.flowLauncherState} data-tone="warning" role="status"><span>{payload.capability.reason || 'No hay formularios disponibles.'}</span>{canManageIntegrations && <Link href="/dashboard/integrations">Revisar canal y plantillas</Link>}</div>}
        <div className={styles.flowOptions}>{payload.catalog.map(flow => <button type="button" key={flow.key} className={styles.flowOption} aria-pressed={selectedKey === flow.key} disabled={!flow.canSend || !online || busy || uncertain || Boolean(resolution)} onClick={() => { setSelectedKey(flow.key); setConsent(false); setError(''); setNotice(null); setRefreshWarning(''); }}>
          <span className={styles.flowOptionCopy}><strong>{flow.title}</strong><small>{flow.capabilities.join(' · ') || flow.description}</small></span>
          <span className={styles.flowTemplateStatus} data-tone={flow.canSend ? 'approved' : 'pending'}>{flow.unresolvedAttempt ? 'Entrega sin confirmar' : flow.template.statusLabel}</span>
        </button>)}</div>
        {payload.catalog.filter(flow => flow.unresolvedAttempt).map(flow => <div key={flow.key} className={styles.flowUnresolved} role="status"><p><strong>{flow.title}</strong> tiene un intento anterior sin resultado confirmado. No se reenvía automáticamente.</p><button type="button" disabled={busy || !online || Boolean(resolution) || !['READY', 'WHATSAPP_FLOW_TEMPLATE_UNRESOLVED'].includes(payload.capability.code)} onClick={() => { setResolution({ blueprintKey: flow.key, messageId: flow.unresolvedAttempt.messageId }); setRiskAccepted(false); setSelectedKey(''); setError(''); }}>Revisar bloqueo</button></div>)}
        {selected?.canSend && payload.recipient && selected.preview && !uncertain && <div className={`${styles.flowConfirmation} ${reviewStyles.panel}`} role="group" aria-label="Revisar envío de formulario">
          <div className={reviewStyles.preview}><span>MENSAJE Y DESTINATARIO</span><strong>{selected.title}</strong><p>Para {payload.recipient.name} · {maskedPhone(payload.recipient.phone)}</p>
            <div className={reviewStyles.bubble}><p>{selected.preview.bodyText}</p><span>{selected.preview.buttonText}</span></div>
            <small>Idioma: {selected.preview.language} · Formulario válido por {selected.expiresInMinutes} minutos. Esto no acredita una tarea completada ni un pago.</small>
            <label className={reviewStyles.consent}><input type="checkbox" checked={consent} disabled={busy || !online} onChange={event => setConsent(event.target.checked)} />Revisé este mensaje y destinatario. Confirmo enviar una sola vez desde esta obra.</label>
          </div>
          <div className={styles.flowConfirmationActions}><button type="button" disabled={busy} onClick={() => { setSelectedKey(''); setConsent(false); }}>Cancelar</button><button type="button" disabled={!consent || busy || !online || !selected.canSend} onClick={send}>Enviar formulario</button></div>
        </div>}
      </>}
      {resolution && <div className={`${styles.flowConfirmation} ${reviewStyles.panel}`} role="group" aria-label="Decisión sobre bloqueo">
        <strong>Revisar un intento sin entrega confirmada</strong><p>El mensaje anterior podría haberse entregado. Esta decisión se audita y no envía otro formulario; el servidor mantiene el bloqueo si existe evidencia de aceptación o entrega.</p>
        <label className={reviewStyles.consent}><input type="checkbox" checked={riskAccepted} onChange={event => setRiskAccepted(event.target.checked)} disabled={busy || resolutionUncertain} />Revisé el intento y acepto el riesgo de duplicación al habilitar una operación nueva.</label>
        <div className={styles.flowConfirmationActions}><button type="button" disabled={busy || resolutionUncertain} onClick={() => { setResolution(null); setRiskAccepted(false); }}>Mantener bloqueo</button><button type="button" disabled={busy || !online || !riskAccepted} onClick={resolve}>{resolutionUncertain ? 'Verificar la misma decisión' : 'Habilitar nuevo intento'}</button></div>
        {resolutionUncertain && <p role="status">La decisión no está confirmada. Se conserva el mismo mensaje y la misma decisión, sin crear un nuevo envío.</p>}
      </div>}
      {busy && <p role="status">{working === 'send' ? 'Procesando el envío…' : working === 'resolve' ? 'Comprobando la decisión…' : 'Consultando el recibo…'}</p>}
    </div>}
  </section>;
}
