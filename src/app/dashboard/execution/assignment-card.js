'use client';
import { useEffect,useRef,useState } from 'react';
import Link from 'next/link';
import { ASSIGNMENT_LABELS,ASSIGNMENT_TRANSITIONS,assignmentRecordMatches,normalizeAssignmentDecision } from '@/lib/task-assignment-policy';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { requestWorkspaceNavigation } from '@/lib/workspace-leave-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import AssignmentRescheduleDialog from './assignment-reschedule-dialog';
import styles from './assignments.module.css';
const ACTIONS={ACTIVE:'Iniciar asignación',ENDED:'Finalizar asignación',CANCELLED:'Cancelar asignación'};
function day(value){if(!value)return 'Sin fecha';const date=String(value).slice(0,10);const [year,month,dayOfMonth]=date.split('-');return dayOfMonth+'/'+month+'/'+year;}
export default function AssignmentCard({assignment,tasks,workers,teams,organizationId,projectId,canManage,canReadTasks,onChanged}){
  const [action,setAction]=useState(''),[note,setNote]=useState(''),[consent,setConsent]=useState(false),[phase,setPhase]=useState('idle'),[message,setMessage]=useState('');
  const [replanning,setReplanning]=useState(false);
  const alive=useRef(true),inFlight=useRef(false),attempt=useRef(null),controllerRef=useRef(null);
  const busy=['saving','loading'].includes(phase),uncertain=phase==='uncertain',blocked=phase==='blocked';
  const allowed=ASSIGNMENT_TRANSITIONS[assignment.status]||[];
  useWorkspaceLeaveGuard({dirty:Boolean(note),busy});
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controllerRef.current?.abort();};},[]);
  useEffect(()=>{const warn=event=>{if(note||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[note,busy]);
  async function request(write=false){
    if(inFlight.current||blocked||write&&(!consent||!note.trim()||uncertain||!allowed.includes(action)))return;
    let input;if(write){try{input=normalizeAssignmentDecision({expectedRevision:assignment.revision,status:action,note});}catch(error){setMessage(error.message);return;}attempt.current=input;}
    inFlight.current=true;setPhase(write?'saving':'loading');setMessage('');const controller=new AbortController();controllerRef.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/execution/assignments/'+encodeURIComponent(assignment.id),{method:write?'PATCH':'GET',cache:'no-store',signal:controller.signal,
        headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId})},...(write?{body:JSON.stringify(input)}:{})});
      const data=await response.json().catch(()=>null);
      if(!response.ok)throw Object.assign(new Error(data?.error||'No se confirmó el estado de la asignación.'),{status:response.status});
      if(data?.context?.organizationId!==organizationId||data.context.projectId!==projectId||!assignmentRecordMatches(data.assignment,projectId,assignment))throw new Error('La respuesta no corresponde a esta asignación.');
      const saved=data.assignment;
      if(write&&(saved.status!==input.status||saved.revision!==input.expectedRevision+1||saved.lastDecision?.note!==input.note))throw new Error('No se confirmó este cambio. Consultá el estado sin reenviar.');
      if(!alive.current)return;onChanged(saved);setPhase('idle');
      const verified=attempt.current&&saved.revision===attempt.current.expectedRevision+1&&saved.status===attempt.current.status&&saved.lastDecision?.note===attempt.current.note;
      if(write||verified){setAction('');setNote('');setConsent(false);attempt.current=null;setMessage(write?'Cambio confirmado y auditado.':'Se recuperó la decisión guardada; no se envió otro cambio.');}
      else {setConsent(false);setMessage('Estado consultado. Revisá la versión y confirmá nuevamente antes de cualquier cambio.');}
    }catch(error){if(alive.current){setMessage(error.name==='AbortError'?'La respuesta demoró. Consultá el estado antes de repetir.':error.message);setPhase([401,402,403,404,410].includes(error.status)?'blocked':write||attempt.current?'uncertain':'idle');}}
    finally{clearTimeout(timeout);inFlight.current=false;controllerRef.current=null;}
  }
  function choose(status){if(note&&!window.confirm('¿Descartar la explicación sin guardar?'))return;setAction(status);setNote('');setConsent(false);setMessage('');}
  function cancel(){if(busy||uncertain||blocked)return;if(note&&!window.confirm('¿Descartar esta explicación sin guardar?'))return;setAction('');setNote('');setConsent(false);}
  const task=tasks.find(row=>row.id===assignment.taskId),worker=workers.find(row=>row.id===assignment.workerId),team=teams.find(row=>row.id===assignment.teamId);
  return <article className={styles.card} aria-label={'Asignación de '+(task?.title||'actividad')}>
    <header><div><span>ASIGNACIÓN · v{assignment.revision}</span><h3>{task?.title||'Actividad no disponible en este listado'}</h3></div><strong className={styles.status} data-status={assignment.status}>{ASSIGNMENT_LABELS[assignment.status]}</strong></header>
    <dl><div><dt>Responsable</dt><dd>{[worker?.name,team?.name].filter(Boolean).join(' · ')||'Responsable no activo en este listado'}</dd></div><div><dt>Tipo</dt><dd>{assignment.workerId&&assignment.teamId?'Persona y cuadrilla':assignment.workerId?'Persona':'Cuadrilla'}</dd></div><div><dt>Período previsto</dt><dd>{day(assignment.startsAt)} → {day(assignment.endsAt)}</dd></div></dl>
    <p className={styles.hint}>El estado de la asignación no modifica asistencia, permisos, fechas ni porcentajes de avance.</p>
    {assignment.lastDecision&&<section className={styles.decision} aria-label="Última decisión registrada"><strong>{ASSIGNMENT_LABELS[assignment.lastDecision.status]} · revisión {assignment.lastDecision.revision}</strong><p>{assignment.lastDecision.note}</p></section>}
    <div className={styles.cardLinks}><button type="button" disabled={busy||blocked} onClick={()=>request(false)}>{busy?'Consultando…':uncertain?'Consultar estado sin reenviar':'Consultar última decisión'}</button>
      {canReadTasks&&<Link href={'/dashboard?tab=sec-gantt&fieldTaskId='+encodeURIComponent(assignment.taskId)} onNavigate={event=>{if(!requestWorkspaceNavigation('route'))event.preventDefault();}}>Ver actividad en el Gantt →</Link>}{canReadTasks&&!action&&<button type="button" disabled={busy||blocked} onClick={()=>setReplanning(true)}>{canManage&&assignment.status==='PLANNED'?'Reprogramar fechas':'Ver fechas y cambios'}</button>}</div>
    {canManage&&canReadTasks&&!action&&!blocked&&<div className={styles.cardActions}>{allowed.map(status=><button key={status} type="button" disabled={busy} onClick={()=>choose(status)}>{ACTIONS[status]}</button>)}</div>}
    {action&&<form className={styles.changeForm} onSubmit={event=>{event.preventDefault();request(true);}}>
      <strong>{ACTIONS[action]}</strong><label>Motivo o resultado<textarea aria-label={'Explicación del cambio de '+(task?.title||'actividad')} value={note} onChange={event=>{setNote(event.target.value);setConsent(false);}} maxLength={1000} rows={3} disabled={busy||uncertain||blocked} required /></label>
      {!allowed.includes(action)&&<p role="status">El estado actual ya no permite esta acción. Conservá la explicación y volvé al seguimiento.</p>}
      <label className={styles.consent}><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)} disabled={busy||uncertain||blocked||!allowed.includes(action)} />Confirmo cambiar sólo el estado de la asignación, sin acreditar avance físico ni jornada trabajada.</label>
      <div className={styles.cardActions}><button type="button" onClick={cancel} disabled={busy||uncertain||blocked}>Volver al seguimiento</button><button type="submit" className={styles.primary} disabled={busy||uncertain||blocked||!note.trim()||!consent||!allowed.includes(action)}>Confirmar cambio</button></div>
    </form>}
    {replanning&&<AssignmentRescheduleDialog key={organizationId+':'+projectId+':'+assignment.id} assignmentId={assignment.id} organizationId={organizationId} projectId={projectId} canManage={canManage} onClose={()=>setReplanning(false)} onSaved={saved=>{onChanged(saved);setReplanning(false);setMessage('Fechas confirmadas y auditadas. Se conserva la misma asignación; no cambió el avance de la actividad.');}}/>}
    {message&&<p className={styles.warning} role="status">{message}</p>}
  </article>;
}
