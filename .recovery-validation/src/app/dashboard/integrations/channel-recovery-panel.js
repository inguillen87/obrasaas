'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { advanceCredentialSnapshot, confirmCredentialSnapshot, credentialRecoveryCopy } from '@/lib/whatsapp/credential-lifecycle';
import styles from './channel-recovery-panel.module.css';
const dateLabel = value => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha informada';
export default function ChannelRecoveryPanel({ organizationId, projectId, refreshKey = '', busy = false, onStatus, onVerify }) {
  const [view, setView] = useState({ state: 'loading', snapshot: null, error: '', receivedAt: 0 });
  const [tick, setTick] = useState(0);
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let active = true, running = false, blocked = false, timer, controller;
    async function read() {
      if (!active || running || blocked) return;
      clearTimeout(timer);
      if (document.visibilityState === 'hidden' || navigator.onLine === false) { timer = setTimeout(read, 60000); return; }
      running = true; controller = new AbortController();
      setView(previous => ({ ...previous, state: 'loading' }));
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/integrations/whatsapp/lifecycle', { method: 'GET', cache: 'no-store', signal: controller.signal,
          headers: evidenceScopeHeaders({ organizationId, projectId }) });
        const payload = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) { blocked = [401, 403, 404, 409].includes(response.status); throw new Error(blocked ? 'El acceso o la obra cambiaron. Recargá Integraciones.' : 'No se pudo actualizar el estado. Se conserva la última lectura, sin habilitar acciones.'); }
        let snapshot;
        try { snapshot = confirmCredentialSnapshot(payload, { organizationId, projectId }); }
        catch (error) { blocked = true; throw error; }
        setView({ state: 'ready', snapshot, error: '', receivedAt: performance.now() }); setTick(0);
      } catch (error) {
        if (active) setView(previous => ({ ...previous, state: blocked ? 'blocked' : 'stale', snapshot: blocked ? null : previous.snapshot,
          error: error.name === 'AbortError' ? 'La consulta demoró. No se renovó ninguna autorización; podés volver a consultar.' : error.message }));
      } finally { clearTimeout(timeout); running = false; if (active && !blocked) timer = setTimeout(read, 60000); }
    }
    function wake() { if (document.visibilityState === 'visible') void read(); }
    const offline = () => setView(previous => ({ ...previous, state: 'stale', error: 'Sin conexión. La última lectura no habilita acciones hasta volver a comprobarla.' }));
    refreshRef.current = read;
    document.addEventListener('visibilitychange', wake); window.addEventListener('online', wake); window.addEventListener('offline', offline);
    if (navigator.onLine === false) offline(); else void read();
    return () => { active = false; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake); window.removeEventListener('offline', offline); refreshRef.current = () => {}; };
  }, [organizationId, projectId, refreshKey]);
  useEffect(() => {
    if (!view.snapshot) return undefined;
    let timer;
    const update = () => {
      const elapsed = Math.max(0, performance.now() - view.receivedAt); setTick(elapsed);
      const observed = Date.parse(view.snapshot.observedAt) + elapsed;
      const deadlines = [view.snapshot.expiresAt, view.snapshot.checkedAt ? new Date(Date.parse(view.snapshot.checkedAt) + 15 * 60 * 1000 + 1).toISOString() : null]
        .filter(Boolean).map(Date.parse).filter(value => value > observed);
      const wait = Math.min(30000, ...deadlines.map(value => Math.max(10, value - observed)));
      timer = setTimeout(update, wait);
    };
    update(); return () => clearTimeout(timer);
  }, [view.snapshot, view.receivedAt]);
  const credential = useMemo(() => advanceCredentialSnapshot(view.snapshot, tick), [view.snapshot, tick]);
  useEffect(() => { onStatus({ organizationId, projectId, state: view.state, credential }); }, [organizationId, projectId, view.state, credential, onStatus]);
  const copy = credentialRecoveryCopy(credential);
  const expired = credential?.reauthorizationRequired;
  function focusAuthorization(event) {
    event.preventDefault(); if (busy) return; const area = document.getElementById('customer-whatsapp-authorization');
    area?.scrollIntoView({ behavior: 'auto', block: 'center' }); area?.focus();
  }
  return <section className={styles.panel} aria-label="Vigencia y recuperación de WhatsApp" data-state={credential?.state || 'UNKNOWN'}
    style={{ '--recovery-bg': tokens.colors.bg.secondary, '--recovery-border': tokens.colors.border.default, '--recovery-text': tokens.colors.text.primary,
      '--recovery-muted': tokens.colors.text.secondary, '--recovery-warning': tokens.colors.accent.primary, '--recovery-danger': tokens.colors.accent.danger }}>
    <header><span>AUTORIZACIÓN DEL CANAL</span><h3>{view.state === 'loading' && !credential ? 'Consultando la autorización…' : view.state === 'blocked' ? 'Confirmá de nuevo tu acceso' : copy.title}</h3></header>
    {credential && <><p>{copy.description}</p><dl><div><dt>Vencimiento informado</dt><dd>{dateLabel(credential.expiresAt)}</dd></div><div><dt>Última verificación con Meta</dt><dd>{dateLabel(credential.checkedAt)}</dd></div></dl></>}
    {!credential?.expirationKnown && credential && <p className={styles.note}>Sin una fecha informada no se promete una autorización permanente. El titular puede revocarla.</p>}
    <div className={styles.actions}>
      <button type="button" onClick={() => refreshRef.current()} disabled={busy || view.state === 'loading' || view.state === 'blocked'}>Actualizar estado</button>
      {expired && view.state !== 'blocked' ? <a href="#customer-whatsapp-authorization" onClick={focusAuthorization} aria-disabled={busy} tabIndex={busy ? -1 : 0}>Preparar reautorización</a>
        : credential && view.state === 'ready' && !['UNLINKED', 'DISABLED'].includes(credential.state) && <button type="button" onClick={onVerify} disabled={busy}>Verificar con Meta</button>}
    </div>
    {view.error && <p className={styles.error} role="alert">{view.error}</p>}
    <p className={styles.note} role="status">{view.state === 'ready' ? 'Estado consultado en el backend.' : view.state === 'loading' ? 'Consultando sin enviar mensajes…' : 'Lectura pendiente de confirmar.'} Actualización cada 60 s mientras la pantalla está visible. Consultar no renueva credenciales, no envía mensajes y no cambia tu obra.</p>
  </section>;
}
