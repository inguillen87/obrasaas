'use client';
import { useEffect, useRef, useState } from 'react';
import { WORKSPACE_NUMBER_MODES, WORKSPACE_USE_CASES, workspaceAuthorizationState, normalizeTenantWorkspace, tenantWorkspaceFromMetadata, confirmsTenantWorkspaceSave } from '@/lib/whatsapp/tenant-workspace-policy';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import { tokens } from '@/lib/design-system';
import styles from './tenant-whatsapp-workspace.module.css';
const empty = { assistantName: 'Asistente de obra', numberMode: '', initialProjectId: '', useCases: ['FIELD_REPORTS'] };
const fromProfile = p => ({ assistantName: p.assistantName || empty.assistantName, numberMode: p.numberMode || empty.numberMode, initialProjectId: p.initialProjectId || '', useCases: p.useCases.length ? p.useCases : empty.useCases });
export default function TenantWhatsAppWorkspace({ organizationId, projectId, companyName, onState, connectionPending = false }) {
  const [view, setView] = useState(null), [draft, setDraft] = useState(empty), [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(true);
  const [phase, setPhase] = useState('loading'), [error, setError] = useState(''), [notice, setNotice] = useState(''), [refresh, setRefresh] = useState(0);
  const attempt = useRef(null), inFlight = useRef(false);
  const dirty = Boolean(view && JSON.stringify(draft) !== JSON.stringify(fromProfile(view.profile)));
  const busy = phase === 'saving';
  const uncertain = phase === 'uncertain';
  useWorkspaceLeaveGuard({ dirty: dirty || uncertain, busy: busy || connectionPending });
  useEffect(() => {
    const guard = event => { if (dirty || uncertain || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, uncertain, busy]);
  useEffect(() => {
    onState(!editing && !dirty && phase === 'ready' && view ? { ...view.authorization, revision: view.profile.revision } : null);
    return () => onState(null);
  }, [editing, dirty, phase, view, onState]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch('/api/integrations/whatsapp/workspace', { cache: 'no-store', headers: evidenceScopeHeaders({ organizationId, projectId }), signal: controller.signal })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || 'No se pudo consultar la preparación de tu empresa.');
        if (body?.organizationId !== organizationId || body?.projectId !== projectId || !Array.isArray(body.projects) || body.projects.length > 50 || body.automationActivated !== false) throw new Error('La respuesta no corresponde al espacio de tu empresa.');
        const profile = tenantWorkspaceFromMetadata(body.profile?.configured === true ? { whatsappWorkspace: { ...body.profile, schemaVersion: 1 } } : {});
        if (!active) return;
        const next = fromProfile(profile); if (!profile.configured) next.initialProjectId = body.projects.some(p => p.id === projectId) ? projectId : '';
        setView({ ...body, profile, authorization: workspaceAuthorizationState(profile, projectId) }); setDraft(next); setEditing(!profile.configured); setConfirmed(false); setPhase('ready');
      }).catch(failure => { if (active) { setError(failure.name === 'AbortError' ? 'La consulta demoró. Podés volver a consultar.' : failure.message); setPhase('blocked'); } })
      .finally(() => clearTimeout(timer));
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [organizationId, projectId, refresh]);
  function reload() {
    if ((dirty || uncertain) && !window.confirm('Hay preparación sin confirmar. ¿Descartarla y consultar lo guardado?')) return;
    attempt.current = null; setView(null); setError(''); setNotice(''); setPhase('loading'); setRefresh(n => n + 1);
  }
  async function save(event) {
    event.preventDefault(); if (inFlight.current || connectionPending || !view || phase === 'blocked') return;
    try {
      if (!attempt.current) attempt.current = normalizeTenantWorkspace({ ...draft, expectedRevision: view.profile.revision, confirmOwnership: confirmed });
    } catch (failure) { setError(failure.message); return; }
    inFlight.current = true; setPhase('saving'); setError(''); setNotice('');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch('/api/integrations/whatsapp/workspace', { method: 'POST', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...evidenceScopeHeaders({ organizationId, projectId }) }, body: JSON.stringify(attempt.current) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { const failure = new Error(body?.error || 'No se confirmó la preparación.'); failure.status = response.status; throw failure; }
      if (!confirmsTenantWorkspaceSave(body, attempt.current, { organizationId, projectId })) throw new Error('Respuesta incompleta: conservamos el mismo intento para verificarlo.');
      setView(current => ({ ...current, ...body, authorization: workspaceAuthorizationState(body.profile, projectId) })); setDraft(fromProfile(body.profile)); setEditing(false); setConfirmed(false); attempt.current = null; setPhase('ready');
      setNotice('Preparación guardada para tu empresa. Todavía no activa IA, invita empleados ni envía mensajes.');
    } catch (failure) {
      const status = failure.status;
      if (status === 400 || status === 422) { attempt.current = null; setPhase('ready'); }
      else if ([401,403,404,409].includes(status)) { attempt.current = null; setPhase('blocked'); }
      else setPhase('uncertain');
      setError(failure.name === 'AbortError' ? 'La respuesta demoró. Verificá el mismo intento antes de comenzar otro.' : failure.message);
    } finally { clearTimeout(timer); inFlight.current = false; }
  }
  const disabled = busy || uncertain || phase === 'blocked' || phase === 'loading' || connectionPending;
  const css = { '--setup-bg': tokens.colors.bg.secondary, '--setup-border': tokens.colors.border.default, '--setup-accent': tokens.colors.accent.primary, '--setup-text': tokens.colors.text.primary, '--setup-muted': tokens.colors.text.secondary };
  return <section id="tenant-whatsapp-preparation" className={styles.panel} style={css} aria-label="Preparación del WhatsApp de tu empresa">
    <header className={styles.header}><div><span>1 · TU EMPRESA, TU NÚMERO</span><h2>Prepará tu asistente de obra</h2><p>{companyName}</p></div><b className={styles.private}>Espacio privado de tu empresa</b></header>
    <p className={styles.intro}>Tu equipo escribirá al número que autorice tu empresa. El WhatsApp comercial de ObraSaaS no recibe ni mezcla los partes de tus obras.</p>
    {phase === 'loading' && <p role="status">Consultando la configuración de tu empresa…</p>}
    {view?.profile.configured && !editing && <section className={styles.saved} aria-label="Configuración guardada del asistente">
      <div><span>Tu asistente</span><strong>{view.profile.assistantName}</strong></div>
      <div><span>Tipo de conexión</span><strong>{WORKSPACE_NUMBER_MODES.find(m => m.key === view.profile.numberMode)?.label}</strong></div>
      <div><span>Primera obra</span><strong>{view.projects.find(p => p.id === view.profile.initialProjectId)?.name || 'Revisar disponibilidad de la obra'}</strong></div>
      <div><span>Circuitos preparados</span><strong>{WORKSPACE_USE_CASES.filter(c => view.profile.useCases.includes(c.key)).map(c => c.label).join(' · ')}</strong></div>
      <button type="button" className={styles.secondary} disabled={connectionPending} onClick={() => { setEditing(true); setNotice(''); }}>Editar preparación</button>
    </section>}
    {view && editing && <form onSubmit={save}>
      <fieldset className={styles.fields} disabled={disabled}><legend>Asistente y cobertura inicial</legend>
        <label>Nombre del asistente<input aria-label="Nombre del asistente" value={draft.assistantName} maxLength={70} onChange={e => setDraft(d => ({ ...d, assistantName: e.target.value }))} /></label>
        <label>Primera obra<select aria-label="Primera obra" value={draft.initialProjectId} onChange={e => setDraft(d => ({ ...d, initialProjectId: e.target.value }))}><option value="">Elegí la primera obra</option>{view.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      </fieldset>
      {view.projectsTruncated && <p className={styles.note}>Se muestran las primeras 50 obras. No se seleccionó otra obra automáticamente.</p>}
      <fieldset className={styles.choices} disabled={disabled}><legend>¿Qué número va a usar tu empresa?</legend>{WORKSPACE_NUMBER_MODES.map(mode => <label key={mode.key} data-selected={draft.numberMode === mode.key}><input type="radio" name="company-number-mode" value={mode.key} checked={draft.numberMode === mode.key} onChange={() => setDraft(d => ({ ...d, numberMode: mode.key }))} /><span><strong>{mode.label}</strong><small>{mode.detail}</small></span></label>)}</fieldset>
      <fieldset className={styles.useCases} disabled={disabled}><legend>¿Qué querés preparar primero?</legend>{WORKSPACE_USE_CASES.map(item => <label key={item.key}><input type="checkbox" checked={draft.useCases.includes(item.key)} onChange={e => setDraft(d => ({ ...d, useCases: e.target.checked ? [...d.useCases,item.key] : d.useCases.filter(key => key !== item.key) }))} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</fieldset>
      <aside className={styles.boundary}><strong>Primero asistido; después, automatización verificada.</strong><p>Guardar define la preparación del asistente, no lo pone a actuar. Las acciones sensibles seguirán requiriendo autorización. Hoy el canal opera sobre una obra; el enrutamiento de un número entre varias obras está en implementación.</p></aside>
      <label className={styles.consent}><input type="checkbox" disabled={disabled} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Prepararé una cuenta y número autorizados por mi empresa. Los empleados tendrán los permisos que se les asignen, no acceso por el solo hecho de escribir.</label>
      <div className={styles.actions}>{view.profile.configured && <button type="button" className={styles.secondary} disabled={busy || uncertain || connectionPending} onClick={() => { if (dirty && !window.confirm('¿Descartar los cambios de preparación?')) return; setDraft(fromProfile(view.profile)); setEditing(false); setConfirmed(false); setError(''); }}>Cancelar cambios</button>}<button type="submit" disabled={busy || connectionPending || phase === 'blocked' || (!uncertain && (!confirmed || !dirty && view.profile.configured))}>{busy ? 'Guardando preparación…' : uncertain ? 'Verificar el mismo intento' : 'Guardar preparación'}</button><small>{view.profile.configured ? 'Configuración de empresa · revisión ' + view.profile.revision : 'Sin configuración guardada'}</small></div>
    </form>}
    {notice && <p role="status" className={styles.success}>{notice}</p>}
    {!editing && !dirty && phase === 'ready' && view?.profile.configured && <p role="status" className={styles.next}>{view.authorization.message}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {phase === 'blocked' && <button type="button" onClick={reload}>Consultar versión actual</button>}
    {editing && <p className={styles.note}>El nombre y los circuitos quedan preparados en este espacio. La autorización de Meta, el acceso de empleados y el encendido del agente se comprueban por separado.</p>}
  </section>;
}
