'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { normalizeReschedule,rescheduleReviewMatches,rescheduleReceiptMatches,rescheduleSnapshotMatches } from '@/lib/assignment-reschedule-policy';
import { ASSIGNMENT_LABELS } from '@/lib/task-assignment-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './assignment-reschedule.module.css';
const day=value=>value?String(value).slice(0,10).split('-').reverse().join('/'):'Sin fecha';
export default function AssignmentRescheduleDialog({assignmentId,organizationId,projectId,canManage,onClose,onSaved}) {
  const dialog=useRef(null),alive=useRef(true),active=useRef(null),attempt=useRef(null),heading=useId();
  const [snapshot,setSnapshot]=useState(null),[draft,setDraft]=useState(null),[note,setNote]=useState(''),[review,setReview]=useState(null),[consent,setConsent]=useState(false);
  const [phase,setPhase]=useState('loading'),[message,setMessage]=useState('');
  const busy=['loading','reviewing','saving'].includes(phase),uncertain=phase==='uncertain',blocked=phase==='blocked';
  const editable=canManage&&snapshot?.writable&&!blocked;
  const changed=Boolean(snapshot&&draft&&(draft.startsOn!==(snapshot.assignment.startsAt?.slice(0,10)||'')||draft.endsOn!==(snapshot.assignment.endsAt?.slice(0,10)||'')));
  const dirty=changed||Boolean(note)||uncertain;
  const endpoint='/api/execution/assignments/'+encodeURIComponent(assignmentId)+'/reschedule';
  useWorkspaceLeaveGuard({dirty,busy});
  useEffect(()=>{
    alive.current=true;const el=dialog.current,previous=document.activeElement;el.showModal();el.querySelector('[aria-label="Cerrar fechas de asignación"]')?.focus();
    const controller=new AbortController();active.current=controller;const timeout=setTimeout(()=>controller.abort(),15000);
    fetch('/api/execution/assignments/'+encodeURIComponent(assignmentId)+'/reschedule',{cache:'no-store',signal:controller.signal,headers:evidenceScopeHeaders({organizationId,projectId})})
      .then(async response=>{const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error||'No se pudo consultar la asignación.');
        if(!rescheduleSnapshotMatches(data,{organizationId,projectId},assignmentId))throw new Error('La consulta no corresponde a esta asignación y obra.');
        if(alive.current&&!controller.signal.aborted){setSnapshot(data);setDraft({startsOn:data.assignment.startsAt?.slice(0,10)||'',endsOn:data.assignment.endsAt?.slice(0,10)||''});setPhase('ready');}})
      .catch(error=>{if(alive.current){setMessage(error.name==='AbortError'?'La consulta demoró. Cerrá y volvé a consultar.':error.message);setPhase('blocked');}})
      .finally(()=>{clearTimeout(timeout);if(active.current===controller)active.current=null;});
    return()=>{alive.current=false;controller.abort();active.current?.abort();clearTimeout(timeout);el.close();if(previous?.isConnected)previous.focus();};
  },[assignmentId,organizationId,projectId]);
  useEffect(()=>{const warn=event=>{if(dirty||phase==='saving'){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,phase]);
  function close(){if(['saving','reviewing'].includes(phase))return;if(dirty&&!window.confirm('¿Salir sin confirmar estas fechas? Se conservan los registros guardados, pero se descarta esta preparación.'))return;onClose();}
  function dates(key,value){setDraft(previous=>({...previous,[key]:value}));setReview(null);setConsent(false);setMessage('');}
  async function request(mode){
    if(active.current||blocked||!snapshot||mode!=='read'&&(!editable||!changed)||mode==='save'&&(!review||!consent||note.trim().length<8)||mode!=='read'&&uncertain)return;
    const raw={expectedRevision:snapshot.assignment.revision,...draft};
    let input;
    try{
      input=mode==='save'?{...raw,reviewVersion:review.version,note,confirmed:true}:raw;
      if(mode!=='read')normalizeReschedule(input,mode==='save');
      if(mode==='save'&&!rescheduleReviewMatches(review,snapshot,raw,{organizationId,projectId}))throw new Error('Revisá de nuevo las fechas antes de guardar.');
    }catch(error){setMessage(error.message);return;}
    if(mode==='save')attempt.current={snapshot,input};
    const controller=new AbortController();active.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);
    setPhase(mode==='save'?'saving':mode==='review'?'reviewing':'loading');setMessage('');setConsent(false);
    if(mode==='review')setReview(null);
    try{
      const response=await fetch(endpoint,{method:mode==='save'?'PATCH':mode==='review'?'POST':'GET',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId})},...(mode==='read'?{}:{body:JSON.stringify(input)})});
      const body=await response.json().catch(()=>null);
      if(!response.ok)throw Object.assign(new Error(body?.error||'No se confirmó la operación.'),{status:response.status,code:body?.code});
      if(!alive.current||controller.signal.aborted)return;
      if(mode==='review'){
        if(!rescheduleReviewMatches(body,snapshot,raw,{organizationId,projectId}))throw new Error('La revisión no coincide con estas fechas y asignación.');
        setReview(body);setPhase('ready');return;
      }
      if(!rescheduleSnapshotMatches(body,{organizationId,projectId},assignmentId))throw new Error('No se confirmó el registro de esta obra.');
      const saved=attempt.current&&rescheduleReceiptMatches(body,attempt.current.snapshot,attempt.current.input,{organizationId,projectId});
      if(mode==='save'&&!saved)throw new Error('La respuesta no confirmó estas fechas. Consultá el estado sin reenviar.');
      if(saved){attempt.current=null;onSaved({...body.assignment,lastReschedule:body.lastReschedule});return;}
      setSnapshot(body);setReview(null);attempt.current=null;setPhase('ready');
      setMessage('Estado consultado sin reenviar. Se mantienen tus fechas propuestas y el motivo; revisalos contra la versión actual antes de confirmar.');
    }catch(error){if(alive.current){setMessage(error.name==='AbortError'?'La respuesta demoró. El cambio podría estar guardado; consultá el estado antes de repetir.':error.message);
      if([401,402,403,404,410].includes(error.status)){setSnapshot(null);setReview(null);setPhase('blocked');}
      else if(mode==='save'&&[400,422].includes(error.status)){attempt.current=null;setPhase('ready');}
      else setPhase(mode==='save'||mode==='read'||error.status===409?'uncertain':'ready');}}
    finally{clearTimeout(timeout);active.current=null;}
  }
  const locked=busy||uncertain||blocked||!editable;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event=>{event.preventDefault();close();}}
    style={{'--replan-bg':tokens.colors.bg.secondary,'--replan-text':tokens.colors.text.primary,'--replan-muted':tokens.colors.text.secondary,'--replan-border':tokens.colors.border.default,'--replan-accent':tokens.colors.accent.primary}}>
    <header className={styles.header}><div><span>REVISAR → COORDINAR → GUARDAR</span><h2 id={heading}>Fechas de la asignación</h2><p>La misma asignación, con cambios trazables.</p></div><button type="button" aria-label="Cerrar fechas de asignación" disabled={phase==='saving'||phase==='reviewing'} onClick={close}>×</button></header>
    <form onSubmit={event=>{event.preventDefault();request('save');}}><div className={styles.body}>
      {phase==='loading'&&<p role="status">Consultando el registro guardado…</p>}
      {snapshot&&<><section className={styles.identity}><strong>{snapshot.task.title}</strong><span>{snapshot.ownerLabel}</span><small>{ASSIGNMENT_LABELS[snapshot.assignment.status]} · revisión {snapshot.assignment.revision}</small></section>
        <p className={styles.hint}>Modifica sólo el período previsto de esta asignación. No mueve la actividad del Gantt, no cambia al responsable y no acredita avance ni jornada trabajada.</p>
        {!editable&&<p className={styles.notice}>Consulta de fechas: sólo se pueden reprogramar asignaciones planificadas con responsable activo y una obra habilitada. Los trabajos iniciados o finalizados conservan su período.</p>}
        <div className={styles.comparison}><section aria-label="Fechas guardadas"><span>GUARDADO AHORA</span><strong>{day(snapshot.assignment.startsAt)} → {day(snapshot.assignment.endsAt)}</strong><small>Referencia: revisión {snapshot.assignment.revision}</small></section>
          <section aria-label="Fechas propuestas"><span>NUEVA PROPUESTA</span><strong>{day(draft?.startsOn)} → {day(draft?.endsOn)}</strong><small>{changed?'Sin guardar':'Todavía no hay cambios'}</small></section></div>
        <fieldset disabled={locked} className={styles.fields}><legend>Nuevo período previsto</legend><label>Inicio<input aria-label="Nuevo inicio previsto" type="date" value={draft?.startsOn||''} onChange={event=>dates('startsOn',event.target.value)}/></label><label>Fin<input aria-label="Nuevo fin previsto" type="date" min={draft?.startsOn||undefined} value={draft?.endsOn||''} onChange={event=>dates('endsOn',event.target.value)}/></label></fieldset>
        {editable&&<><button type="button" disabled={locked||!changed} onClick={()=>request('review')}>{phase==='reviewing'?'Revisando…':review?'Actualizar revisión':'Revisar nuevas fechas'}</button>
          <p className={styles.hint}>Compara otras asignaciones de esta obra, con días incluidos e integrantes compartidos. Excluye esta misma asignación; no calcula horas ni disponibilidad en otras obras.</p></>}
        {review&&<section className={styles.review} aria-label="Resultado de coincidencias" aria-live="polite"><strong>{review.overlap.warnings?'Requiere coordinación':'Sin coincidencias detectadas en esta revisión'}</strong>
          <p>{review.overlap.summary.overlaps} coincidencias de fechas · {review.overlap.summary.incomplete} con fechas incompletas</p>
          {review.overlap.summary.proposedDatesIncomplete&&<p>Las fechas propuestas están incompletas. No se puede confirmar disponibilidad.</p>}
          {review.overlap.summary.rosterUnverified&&<p>No se confirmó la dotación de la cuadrilla durante este período.</p>}
          <ul>{review.overlap.findings.map(row=><li key={row.assignmentId}><strong>{row.taskTitle}</strong><span>{row.ownerLabel} · {day(row.startsOn)} → {day(row.endsOn)}</span></li>)}</ul>
          {review.overlap.totalFindings>review.overlap.findings.length&&<p>Se muestran {review.overlap.findings.length} de {review.overlap.totalFindings} hallazgos; la validación incluye todos.</p>}
          <small>El servidor vuelve a revisar al guardar.</small></section>}
        {editable&&<><label className={styles.note}>Motivo y coordinación<textarea aria-label="Motivo de reprogramación" value={note} minLength={8} maxLength={1000} rows={3} disabled={locked} onChange={event=>{setNote(event.target.value);setConsent(false);}} placeholder="Por qué cambian las fechas y cómo se coordinarán las coincidencias."/></label>
          <label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked||!review||note.trim().length<8} onChange={event=>setConsent(event.target.checked)}/>Confirmo las nuevas fechas y el motivo. La actividad y el responsable no cambian.</label></>}
        {snapshot.lastReschedule&&<section className={styles.history} aria-label="Última reprogramación"><span>ÚLTIMO CAMBIO DE FECHAS REGISTRADO</span><p>{day(snapshot.lastReschedule.previousStartsAt)} → {day(snapshot.lastReschedule.previousEndsAt)} · revisión {snapshot.lastReschedule.previousRevision}</p><strong>{snapshot.lastReschedule.note}</strong><small>Registrado en la revisión {snapshot.lastReschedule.revision}.</small></section>}
      </>}
      {message&&<p className={styles.notice} role="alert">{message}</p>}
      {uncertain&&<button type="button" onClick={()=>request('read')}>Consultar estado sin reenviar</button>}
    </div><footer className={styles.footer}><button type="button" disabled={phase==='saving'||phase==='reviewing'} onClick={close}>Volver sin cambiar</button>
      {editable&&<button type="submit" className={styles.primary} disabled={locked||!changed||!review||!consent||note.trim().length<8}>{phase==='saving'?'Guardando…':'Guardar reprogramación'}</button>}</footer></form>
  </dialog>;
}
