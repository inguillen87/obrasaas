'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import { BLOCKER_LABELS, BLOCKER_PRIORITIES, normalizeMessageBlocker, confirmedMessageBlocker } from '@/lib/whatsapp/message-blocker-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import { tokens } from '@/lib/design-system';
import styles from './message-report-action.module.css';
const href = id => '/dashboard/execution?blockerId=' + encodeURIComponent(id);
export default function MessageBlockerAction({ onOpen, saved }) {
  return <div className={styles.entry}>{saved ? <Link href={href(saved.id)}>Restricción registrada · abrir seguimiento</Link> : <button type="button" onClick={onOpen}>Registrar una restricción</button>}</div>;
}
export function MessageBlockerDialog({ organizationId, projectId, projectName, conversationId, messageId, tasks, onClose, onSaved }) {
  const dialog = useRef(null), closeButton = useRef(null), attempt = useRef(null), inFlight = useRef(false), titleId = useId();
  const [data, setData] = useState(null), [phase, setPhase] = useState('loading'), [error, setError] = useState('');
  const [draft, setDraft] = useState({ taskId: '', title: '', description: '', severity: 'MEDIUM', ownerWorkerId: null, ownerTeamId: null });
  const [reviewed, setReviewed] = useState(false), [copied, setCopied] = useState('');
  const scope = { organizationId, projectId, conversationId, messageId };
  const dirty = Boolean(draft.title || draft.description || draft.taskId || reviewed), busy = phase === 'saving';
  const endpoint = '/api/whatsapp/inbox/' + encodeURIComponent(conversationId) + '/messages/' + encodeURIComponent(messageId) + '/blocker';
  useWorkspaceLeaveGuard({ dirty: dirty && !data?.existing, busy });
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement; if (!node.open) node.showModal(); closeButton.current?.focus();
    return () => { node.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    const warn = event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn);
  }, [dirty,busy]);
  useEffect(() => {
    const controller = new AbortController(); let alive = true; const timeout = setTimeout(() => controller.abort(),15000);
    fetch(endpoint, { signal: controller.signal, cache: 'no-store', headers: evidenceScopeHeaders({ organizationId,projectId }) }).then(async response => {
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'No se pudo consultar el mensaje.');
      if (result?.source?.messageId !== messageId || result.source.conversationId !== conversationId || result.source.projectId !== projectId || result.source.organizationId !== organizationId || !/^[a-f0-9]{64}$/.test(result.source.version) || typeof result.source.text !== 'string' || !Array.isArray(result.owners?.workers) || !Array.isArray(result.owners?.teams)) throw new Error('El origen no corresponde a esta obra.');
      if (result.existing) confirmedMessageBlocker({ blocker:result.existing, source:result.source, replayed:true }, {organizationId,projectId,conversationId,messageId});
      if (alive) { setData(result); setPhase('editing'); }
    }).catch(failure => { if(alive){setError(failure.name==='AbortError'?'La consulta demoró. Cerrá y volvé a abrir el mensaje.':failure.message);setPhase('blocked');} }).finally(()=>clearTimeout(timeout));
    return () => { alive=false;clearTimeout(timeout);controller.abort(); };
  }, [endpoint,organizationId,projectId,conversationId,messageId]);
  function close() { if (inFlight.current) return; if (dirty && !data?.existing && !window.confirm('¿Salir sin confirmar la restricción? Se perderá el borrador local.')) return; onClose(); }
  async function copy() { try { await navigator.clipboard.writeText(draft.title+'\n\n'+draft.description);setCopied('Texto copiado.'); } catch {setCopied('Seleccioná el texto para conservarlo.');} }
  async function save(event) {
    event.preventDefault(); if (inFlight.current || !reviewed || !data || phase === 'blocked') return;
    try { if (!attempt.current) attempt.current = { key:crypto.randomUUID(), input:normalizeMessageBlocker({...draft,sourceVersion:data.source.version}) }; }
    catch(failure){setError(failure.message);return;}
    inFlight.current=true;setPhase('saving');setError('');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(endpoint,{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId}),'Idempotency-Key':attempt.current.key},body:JSON.stringify(attempt.current.input)});
      const result=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(result?.error||'No se confirmó la operación.'),{status:response.status});
      const confirmed=confirmedMessageBlocker(result,scope);
      if(!result.replayed&&(confirmed.status!=='OPEN'||confirmed.taskId!==attempt.current.input.taskId||confirmed.title!==attempt.current.input.title||confirmed.ownerWorkerId!==attempt.current.input.ownerWorkerId||confirmed.ownerTeamId!==attempt.current.input.ownerTeamId))throw new Error('La respuesta no coincide con la restricción solicitada.');
      publishFieldInvalidation({organizationId,projectId});onSaved(confirmed);setPhase('saved');
    } catch(failure){
      if([400,422].includes(failure.status)){attempt.current=null;setPhase('editing');}
      else setPhase([401,402,403,404,409,410].includes(failure.status)?'blocked':'uncertain');
      setError(failure.name==='AbortError'?'El guardado podría haberse completado. Verificá el mismo intento.':failure.message);
    } finally{clearTimeout(timeout);inFlight.current=false;}
  }
  const locked=['loading','saving','uncertain','blocked'].includes(phase)||data?.canCreate===false;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}
    style={{'--report-bg':tokens.colors.bg.secondary,'--report-accent':tokens.colors.accent.primary}}
    onCancel={event=>{event.preventDefault();close();}}>
    <header><div><span className={styles.eyebrow}>DEL MENSAJE AL SEGUIMIENTO</span>
      <h2 id={titleId}>Registrar restricción de obra</h2><p>{projectName}</p></div>
      <button ref={closeButton} type="button" onClick={close} disabled={busy} aria-label="Cerrar restricción">×</button></header>
    <div className={styles.body}>
      <p className={styles.intro}>Convertí un faltante o impedimento en trabajo pendiente, con tarea y responsable. No se emiten compras ni se modifican fechas o avance automáticamente.</p>
      {data?.canCreate===false&&!data.existing&&<p className={styles.warning}>La obra o la suscripción están en modo de solo lectura. No se puede registrar una restricción nueva.</p>}
      {phase==='loading'&&<p role="status">Consultando el mensaje y sus referencias…</p>}
      {data&&<section className={styles.source} aria-label="Mensaje de origen"><div>
        <strong>{data.source.kind==='AUDIO_TRANSCRIPT'?'Transcripción registrada':'Texto recibido'}</strong><span>Origen conservado</span></div><p>{data.source.text}</p></section>}
      {data?.existing?<section className={styles.existing}><h3>Este mensaje ya tiene una restricción</h3>
        <p>{data.existing.title} · {BLOCKER_LABELS[data.existing.status]}</p><Link href={href(data.existing.id)}>Abrir seguimiento existente</Link>
        <p className={styles.hint}>No se creará otro registro ni se reabrirá una restricción resuelta.</p></section>:data&&<form id={titleId+'-form'} onSubmit={save}>
        <fieldset disabled={locked} className={styles.fields}>
          <label>Título de la restricción<input aria-label="Título de la restricción" required maxLength={180} value={draft.title} onChange={event=>setDraft(current=>({...current,title:event.target.value}))}/></label>
          <label>Detalle revisado<textarea aria-label="Detalle revisado" required rows={4} maxLength={3000} value={draft.description} onChange={event=>setDraft(current=>({...current,description:event.target.value}))}/></label>
          <label>Actividad afectada<select aria-label="Actividad afectada" required value={draft.taskId} onChange={event=>setDraft(current=>({...current,taskId:event.target.value}))}>
            <option value="">Elegí la actividad</option>{tasks.filter(task=>task.type==='TASK').map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
          <label>Responsable de resolver<select aria-label="Responsable de resolver" required value={draft.ownerWorkerId?'worker:'+draft.ownerWorkerId:draft.ownerTeamId?'team:'+draft.ownerTeamId:''}
            onChange={event=>{const value=event.target.value;setDraft(current=>({...current,ownerWorkerId:value.startsWith('worker:')?value.slice(7):null,ownerTeamId:value.startsWith('team:')?value.slice(5):null}));}}>
            <option value="">Elegí una persona o cuadrilla</option>
            <optgroup label="Personas activas">{data.owners.workers.map(owner=><option key={owner.id} value={'worker:'+owner.id}>{owner.name}</option>)}</optgroup>
            <optgroup label="Cuadrillas activas">{data.owners.teams.map(owner=><option key={owner.id} value={'team:'+owner.id}>{owner.name}</option>)}</optgroup>
          </select></label>
          {data.owners.truncated&&<p className={styles.hint}>Se muestran hasta 100 responsables por tipo. Administrá el equipo en Cuadrillas y restricciones si falta una persona.</p>}
          {!data.owners.workers.length&&!data.owners.teams.length&&<p className={styles.warning}>Esta obra todavía no tiene responsables activos. Incorporá una persona o cuadrilla antes de registrar la restricción.</p>}
          <label>Prioridad<select aria-label="Prioridad de la restricción" value={draft.severity} onChange={event=>setDraft(current=>({...current,severity:event.target.value}))}>
            {Object.entries(BLOCKER_PRIORITIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
          <p className={styles.hint}>Las prioridades alta y crítica generan una notificación interna para los miembros activos de la obra. No se envía un WhatsApp al registrar.</p>
          <label className={styles.check}><input type="checkbox" checked={reviewed} onChange={event=>setReviewed(event.target.checked)}/>Revisé el mensaje, la tarea y el responsable. Confirmo abrir una restricción, no una compra.</label>
        </fieldset>
      </form>}
      {error&&<p className={styles.warning} role="alert">{error}</p>}
      {['uncertain','blocked'].includes(phase)&&data&&<div className={styles.recovery}><button type="button" onClick={copy}>Copiar detalle revisado</button><span role="status">{copied}</span></div>}
    </div>
    <footer><small>Texto y antecedentes conservados en la obra. Repetir el mismo intento no genera otra restricción.</small>
      {!data?.existing&&<button type="submit" form={titleId+'-form'} className={styles.primary} disabled={busy||!data||data.canCreate===false||!reviewed||phase==='blocked'||!draft.taskId||!(draft.ownerWorkerId||draft.ownerTeamId)}>
        {busy?'Confirmando…':phase==='uncertain'?'Verificar el mismo intento':'Crear restricción abierta'}</button>}
    </footer>
  </dialog>;
}
