'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { publishFieldInvalidation } from '@/lib/schedule-field-channel';
import { BLOCKER_LABELS, BLOCKER_PRIORITIES } from '@/lib/whatsapp/message-blocker-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import { tokens } from '@/lib/design-system';
import styles from './blocker-followup-card.module.css';
function validRecord(row, original, projectId) { return row?.id === original.id && row.projectId === projectId && Object.hasOwn(BLOCKER_LABELS,row.status) && Number.isSafeInteger(row.revision) && row.revision >= original.revision; }
export default function BlockerFollowupCard({ blocker, tasks, workers, teams, organizationId, projectId, canManage, canReadTasks, onChanged }) {
  const [editing,setEditing]=useState(false),[note,setNote]=useState(''),[consent,setConsent]=useState(false),[phase,setPhase]=useState('idle'),[error,setError]=useState('');
  const attempt=useRef(null),inFlight=useRef(false),alive=useRef(true);
  const busy=phase==='saving'||phase==='checking',terminal=['RESOLVED','CANCELLED'].includes(blocker.status);
  useWorkspaceLeaveGuard({dirty:editing&&Boolean(note),busy});
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{const warn=event=>{if(editing&&note||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[editing,note,busy]);
  const endpoint='/api/execution/blockers/'+encodeURIComponent(blocker.id);
  async function update(event) {
    event.preventDefault();if(inFlight.current||!consent||!note.trim()||terminal||phase==='uncertain'||phase==='blocked')return;
    const input={expectedRevision:blocker.revision,status:'RESOLVED',resolution:note.trim().replace(/\s+/g,' ')};
    attempt.current=input;inFlight.current=true;setPhase('saving');setError('');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch(endpoint,{method:'PATCH',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId})},body:JSON.stringify(input)});
      const payload=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(payload?.error||'No se confirmó la resolución.'),{status:response.status});
      if(!validRecord(payload?.blocker,blocker,projectId)||payload.blocker.status!=='RESOLVED'||payload.blocker.revision!==input.expectedRevision+1||payload.blocker.resolution!==input.resolution)throw new Error('El servidor no confirmó esta resolución. Consultá el estado antes de repetirla.');
      if(alive.current){onChanged(payload.blocker);setEditing(false);setNote('');setPhase('idle');publishFieldInvalidation({organizationId,projectId});}
    }catch(failure){if(alive.current){setError(failure.name==='AbortError'?'La respuesta demoró. Consultá el estado: la resolución podría haberse guardado.':failure.message);setPhase([400,422].includes(failure.status)?'idle':[401,402,403,404].includes(failure.status)?'blocked':'uncertain');}}
    finally{clearTimeout(timeout);inFlight.current=false;}
  }
  async function verify(){
    if(inFlight.current)return;inFlight.current=true;setPhase('checking');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal,headers:evidenceScopeHeaders({organizationId,projectId})});const payload=await response.json().catch(()=>null);
      if(!response.ok||!validRecord(payload?.blocker,blocker,projectId))throw Object.assign(new Error(payload?.error||'No se pudo verificar el estado de esta restricción.'),{status:response.status});
      if(!alive.current)return;onChanged(payload.blocker);
      if(['RESOLVED','CANCELLED'].includes(payload.blocker.status)){setEditing(false);setError('Se consultó la decisión registrada. No se envió otra resolución.');setPhase('idle');publishFieldInvalidation({organizationId,projectId});}
      else if(payload.blocker.revision!==attempt.current?.expectedRevision){setConsent(false);setError('El registro cambió. Revisá la nueva versión y confirmá nuevamente.');setPhase('idle');}
      else{setError('El registro continúa abierto. Podés confirmar la resolución; la revisión evita aplicarla dos veces.');setPhase('idle');}
    }catch(failure){if(alive.current){setError(failure.message);setPhase([401,402,403,404].includes(failure.status)?'blocked':'uncertain');}}
    finally{clearTimeout(timeout);inFlight.current=false;}
  }
  function cancel(){if(busy)return;if(note&&!window.confirm('¿Descartar el detalle de resolución sin guardarlo?'))return;setEditing(false);setNote('');setConsent(false);setError('');}
  const task=tasks.find(item=>item.id===blocker.taskId),person=workers.find(item=>item.id===blocker.ownerWorkerId),team=teams.find(item=>item.id===blocker.ownerTeamId);
  return <li className={styles.card} id={'blocker-'+blocker.id} style={{'--blocker-bg':tokens.colors.bg.secondary,'--blocker-border':tokens.colors.border.default,'--blocker-accent':tokens.colors.accent.primary}}>
    <header><div><span>RESTRICCIÓN · v{blocker.revision}</span><h3>{blocker.title}</h3></div><strong data-status={blocker.status}>{BLOCKER_LABELS[blocker.status]}</strong></header>
    <p className={styles.description}>{blocker.description||'Sin detalle adicional registrado.'}</p>
    <dl><div><dt>Actividad</dt><dd>{task?.title||(blocker.taskId?'Actividad no disponible en este listado':'Sin actividad vinculada')}</dd></div>
      <div><dt>Responsable</dt><dd>{person?.name||team?.name||'Responsable no activo en este listado'}</dd></div><div><dt>Prioridad</dt><dd>{BLOCKER_PRIORITIES[blocker.severity]}</dd></div></dl>
    {blocker.taskId&&canReadTasks&&<Link href={'/dashboard?tab=sec-gantt&fieldTaskId='+encodeURIComponent(blocker.taskId)} onNavigate={event=>{if(!requestWorkspaceNavigation('route'))event.preventDefault();}}>Consultar actividad en el cronograma →</Link>}
    {blocker.status==='RESOLVED'&&<section className={styles.resolved} aria-label="Resolución registrada"><strong>Cómo se resolvió</strong><p>{blocker.resolution}</p></section>}
    {canManage&&!terminal&&!editing&&<button type="button" onClick={()=>{setEditing(true);setError('');}}>Preparar resolución</button>}
    {canManage&&!terminal&&editing&&<form onSubmit={update}>
      <label>Cómo se resolvió<textarea aria-label={'Resolución de '+blocker.title} required maxLength={4000} rows={3} value={note} disabled={busy||phase==='uncertain'||phase==='blocked'} onChange={event=>setNote(event.target.value)}/></label>
      <label className={styles.check}><input type="checkbox" checked={consent} disabled={busy||phase==='uncertain'||phase==='blocked'} onChange={event=>setConsent(event.target.checked)}/>Confirmo que el impedimento fue resuelto. No se modificará el porcentaje de avance ni se emitirá una compra.</label>
      <div className={styles.actions}><button type="button" disabled={busy||phase==='uncertain'||phase==='blocked'} onClick={cancel}>Cancelar</button>
        {phase==='uncertain'?<button type="button" onClick={verify}>Consultar estado sin reenviar</button>:<button type="submit" className={styles.primary} disabled={busy||phase==='blocked'||!consent||!note.trim()}>{busy?'Comprobando…':'Confirmar resolución'}</button>}
      </div>
    </form>}
    {error&&<p className={styles.notice} role="status">{error}</p>}
  </li>;
}
