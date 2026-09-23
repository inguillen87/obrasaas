'use client';
import { useCallback,useEffect,useId,useRef,useState } from 'react';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { normalizeAssignmentPlan,confirmAssignmentPlan } from '@/lib/task-assignment-policy';
import { assignmentPlanRecovery,assignmentSourceRecovery } from '@/lib/assignment-planner-recovery';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import AssignmentOverlapCheck from './assignment-overlap-check';
import AssignmentOwnerDirectory from './assignment-owner-directory';
import { assignmentReviewMatches } from '@/lib/assignment-overlap-policy';
import styles from './assignments.module.css';
export default function AssignmentPlanner({organizationId,projectId,tasks,focusedTask,onClose,onSaved}) {
  const dialog=useRef(null),alive=useRef(true),inFlight=useRef(false),attempt=useRef(null),heading=useId();
  const [taskId,setTaskId]=useState(focusedTask?.id||''),[source,setSource]=useState(null),[phase,setPhase]=useState(focusedTask?'loading':'idle'),[error,setError]=useState('');
  const [draft,setDraft]=useState({ownerKind:'WORKER',ownerId:'',startsOn:'',endsOn:''}),[consent,setConsent]=useState(false),[search,setSearch]=useState('');
  const [directoryOpen,setDirectoryOpen]=useState(false),[externalOwner,setExternalOwner]=useState(null);
  const [review,setReview]=useState(null),[coordination,setCoordination]=useState(''),[reviewEpoch,setReviewEpoch]=useState(0),[queryEpoch,setQueryEpoch]=useState(0);
  const busy=phase==='saving',uncertain=phase==='uncertain',blocked=phase==='blocked';
  const sourcePending=['loading','load-error','refresh-required'].includes(phase);
  const dirty=Boolean(draft.ownerId||draft.startsOn||draft.endsOn||coordination||phase==='saving'||phase==='uncertain'||taskId&&!focusedTask);
  useWorkspaceLeaveGuard({dirty,busy});
  useEffect(()=>{alive.current=true;const el=dialog.current,previous=document.activeElement;el.showModal();el.querySelector('[aria-label="Cerrar planificación"]')?.focus();return()=>{alive.current=false;el.close();if(previous?.isConnected)previous.focus();};},[]);
  useEffect(()=>{const warn=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,busy]);
  useEffect(()=>{
    if(!taskId)return;
    let active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    fetch('/api/execution/assignments?taskId='+encodeURIComponent(taskId),{cache:'no-store',signal:controller.signal,headers:evidenceScopeHeaders({organizationId,projectId})})
      .then(async response=>{const body=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(body?.error||'No se pudo consultar la actividad.'),{status:response.status,code:body?.code});
        if(body?.context?.organizationId!==organizationId||body.context.projectId!==projectId||body.task?.id!==taskId||!Number.isSafeInteger(body.task.revision)||!Array.isArray(body.owners?.workers)||!Array.isArray(body.owners?.teams)||body.owners.workers.length>100||body.owners.teams.length>100||![...body.owners.workers,...body.owners.teams].every(owner=>owner&&typeof owner.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(owner.id)&&typeof owner.name==='string')||body.task.revision<0)throw Object.assign(new Error('La consulta no corresponde a esta actividad y obra.'),{code:'ASSIGNMENT_SOURCE_UNCONFIRMED'});
        if(active){setSource(body);setPhase(body.canCreate===true?'idle':'blocked');setError(body.canCreate===true?'':'La obra o empresa no permite planificar nuevas asignaciones.');}})
      .catch(failure=>{if(active){setError(failure.name==='AbortError'?'La consulta demoró. Volvé a consultar sin cerrar esta ventana.':failure.message);setPhase(assignmentSourceRecovery(failure)==='retry'?'load-error':'blocked');}}).finally(()=>clearTimeout(timeout));
    return()=>{active=false;controller.abort();clearTimeout(timeout);};
  },[organizationId,projectId,taskId,queryEpoch]);
  const directorySourceChanged=useCallback(()=>{
    if(inFlight.current||attempt.current)return;
    setDirectoryOpen(false);setReview(null);setConsent(false);setPhase('refresh-required');
    setError('La actividad cambió durante la búsqueda. Actualizá la actividad y responsables; se conserva tu planificación.');
  },[]);
  function close(){if(inFlight.current)return;if(dirty&&!window.confirm('¿Salir sin confirmar esta planificación? El texto y la selección sólo están en esta ventana.'))return;onClose();}
  function change(key,value){if(key==='ownerKind'){setDirectoryOpen(false);setExternalOwner(null);}setDraft(previous=>({...previous,[key]:value,...(key==='ownerKind'?{ownerId:''}:{})}));setConsent(false);setReview(null);}
  function openDirectory(){
    if(inFlight.current||attempt.current||locked)return;
    setReview(null);setReviewEpoch(value=>value+1);setConsent(false);setDirectoryOpen(true);
  }
  function refreshSource(){
    if(inFlight.current||!taskId||!['load-error','refresh-required'].includes(phase))return;
    // Offered only for a failed GET or a confirmed pre-write rejection, never an uncertain POST.
    setDirectoryOpen(false);setExternalOwner(null);setSource(null);setReview(null);setConsent(false);setError('');setPhase('loading');setReviewEpoch(value=>value+1);setQueryEpoch(value=>value+1);
  }
  async function save(event){
    event.preventDefault();if(inFlight.current||!source||!consent||blocked||sourcePending||directoryOpen)return;
    try{if(!attempt.current){const input={taskId,expectedTaskRevision:source.task.revision,...draft};const normalized=normalizeAssignmentPlan(input);if(!assignmentReviewMatches(review,normalized,{organizationId,projectId}))throw new Error('Revisá las coincidencias antes de confirmar.');attempt.current={key:crypto.randomUUID(),input:{...input,review:{version:review.version,acknowledged:true,reason:review.warnings?coordination:''}},normalized};}}catch(failure){setError(failure.message);return;}
    inFlight.current=true;setPhase('saving');setError('');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/execution/assignments',{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId}),'Idempotency-Key':attempt.current.key},body:JSON.stringify(attempt.current.input)});
      const payload=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(payload?.error||'La planificación no quedó confirmada.'),{status:response.status,code:payload?.code});
      const assignment=confirmAssignmentPlan(payload,attempt.current.normalized,{organizationId,projectId});
      if(alive.current)onSaved(assignment,{replayed:payload.replayed,periodChanged:assignment.startsAt!==attempt.current.normalized.startsAt||assignment.endsAt!==attempt.current.normalized.endsAt});
    }catch(failure){if(alive.current){setError(failure.name==='AbortError'?'La respuesta demoró. Verificá el mismo intento antes de crear otra asignación.':failure.message);
      const recovery=assignmentPlanRecovery(failure);
      if(recovery==='revise'||recovery==='refresh'){attempt.current=null;setReview(null);setReviewEpoch(value=>value+1);setConsent(false);setPhase(recovery==='refresh'?'refresh-required':'idle');}
      else setPhase(recovery);}}
    finally{clearTimeout(timeout);inFlight.current=false;}
  }
  const initialOptions=source?.owners?.[draft.ownerKind==='WORKER'?'workers':'teams']||[];
  // A directory choice belongs to this exact source snapshot and owner kind.
  // Reloading the source never silently reuses a choice from an older snapshot.
  const picked=externalOwner?.source===source&&externalOwner.kind===draft.ownerKind?externalOwner.record:null;
  const options=picked&&!initialOptions.some(row=>row.id===picked.id)?[...initialOptions,picked]:initialOptions;
  const displayed=options.filter(owner=>owner.id===draft.ownerId||owner.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const owner=options.find(row=>row.id===draft.ownerId),locked=busy||uncertain||blocked||sourcePending;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event=>{event.preventDefault();close();}}
    style={{'--assign-bg':tokens.colors.bg.secondary,'--assign-accent':tokens.colors.accent.primary,'--assign-border':tokens.colors.border.default}}>
    <header className={styles.dialogHeader}><div><span>ACTIVIDAD → RESPONSABLE → SEGUIMIENTO</span><h2 id={heading}>Planificar asignación</h2></div><button type="button" aria-label="Cerrar planificación" onClick={close} disabled={busy}>×</button></header>
    <form onSubmit={save}><div className={styles.dialogBody}>
      <p>Elegí quién se ocupará de la actividad. Se guarda como <strong>planificada</strong>; no inicia tareas, fichajes, pagos ni permisos de WhatsApp.</p>
      <fieldset disabled={locked} className={styles.fields}><label>Actividad<select aria-label="Actividad a asignar" required disabled={Boolean(focusedTask)} value={taskId} onChange={event=>{setDirectoryOpen(false);setExternalOwner(null);setTaskId(event.target.value);setSource(null);setPhase(event.target.value?'loading':'idle');setDraft({ownerKind:'WORKER',ownerId:'',startsOn:'',endsOn:''});setConsent(false);setReview(null);setCoordination('');setSearch('');setError('');}}><option value="">Seleccionar actividad</option>{tasks.filter(task=>task.type==='TASK').map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      {taskId&&!source&&phase==='loading'&&<p role="status">Consultando versión, responsables y estado de la obra…</p>}
      {source&&<><div className={styles.ownerTypes} role="group" aria-label="Tipo de responsable"><button type="button" aria-pressed={draft.ownerKind==='WORKER'} onClick={()=>change('ownerKind','WORKER')}>Una persona</button><button type="button" aria-pressed={draft.ownerKind==='TEAM'} onClick={()=>change('ownerKind','TEAM')}>Una cuadrilla</button></div>
      <label>Buscar responsable<input type="search" maxLength={80} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar en las opciones disponibles" /></label>
      <label>{draft.ownerKind==='WORKER'?'Persona de esta obra':'Cuadrilla de esta obra'}<select required aria-label="Responsable de la asignación" value={draft.ownerId} onChange={event=>change('ownerId',event.target.value)}><option value="">Seleccionar responsable</option>{draft.ownerId&&!owner&&<option value={draft.ownerId} disabled>Selección anterior no disponible en esta consulta</option>}{displayed.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {draft.ownerId&&!owner&&<p role="status">El responsable seleccionado no aparece en las opciones actuales. Revisá la selección antes de confirmar; tus fechas y explicación se conservaron.</p>}
      {options.length===0&&<p role="status">No hay {draft.ownerKind==='WORKER'?'personas activas':'cuadrillas activas'} disponibles en esta obra. Registralas antes de asignar.</p>}
      {source.owners.truncated&&<div className={styles.warning}><p>Se muestran hasta 100 opciones por tipo. No encontrar un responsable en esta lista no confirma que no exista.</p><button type="button" onClick={openDirectory} disabled={directoryOpen}>Abrir directorio completo</button></div>}
      {directoryOpen&&<AssignmentOwnerDirectory key={organizationId+':'+projectId+':'+taskId+':'+source.task.revision+':'+draft.ownerKind+':'+queryEpoch} organizationId={organizationId} projectId={projectId} taskId={taskId} taskRevision={source.task.revision} ownerKind={draft.ownerKind} disabled={locked} onClose={()=>setDirectoryOpen(false)} onSourceChanged={directorySourceChanged} onPick={record=>{if(locked||inFlight.current||attempt.current)return;setExternalOwner({source,kind:draft.ownerKind,record});change('ownerId',record.id);setDirectoryOpen(false);}}/>}
      <div className={styles.dates}><label>Inicio previsto · opcional<input aria-label="Inicio previsto" type="date" value={draft.startsOn} onChange={event=>change('startsOn',event.target.value)} /></label><label>Fin previsto · opcional<input aria-label="Fin previsto" type="date" min={draft.startsOn||undefined} value={draft.endsOn} onChange={event=>change('endsOn',event.target.value)} /></label></div>
      <p className={styles.hint}>Fechas de planificación, sin horas ni cálculo de disponibilidad. No cambian las fechas del Gantt.</p></>}
      </fieldset>
      {source&&owner&&<section className={styles.confirmation} aria-label="Revisar planificación"><span>ANTES DE CONFIRMAR</span><strong>{source.task.title}</strong><p>{draft.ownerKind==='WORKER'?'Persona':'Cuadrilla'}: {owner.name}</p><p>{draft.startsOn?draft.startsOn.split('-').reverse().join('/'):'Sin fecha de inicio'} → {draft.endsOn?draft.endsOn.split('-').reverse().join('/'):'Sin fecha final'}</p><small>Versión de la actividad: {source.task.revision}. Estado inicial: planificada.</small></section>}
      {source&&owner&&<AssignmentOverlapCheck key={JSON.stringify([taskId,source.task.revision,draft,reviewEpoch])}
        input={{taskId,expectedTaskRevision:source.task.revision,...draft}} organizationId={organizationId} projectId={projectId} disabled={locked||directoryOpen}
        onReviewed={value=>{setReview(value);setConsent(false);if(value)setError('');}}/>}
      {(review?.warnings||coordination)&&<label className={styles.coordinationNote}>Criterio de coordinación<textarea aria-label="Explicación de coordinación" value={coordination} minLength={8} maxLength={1000} rows={3} disabled={locked} onChange={event=>{setCoordination(event.target.value);setConsent(false);}} placeholder="Explicá cómo coordinarás los trabajos o completarás los datos pendientes."/></label>}
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked||directoryOpen||!owner||!review||review.warnings&&coordination.trim().length<8} onChange={event=>setConsent(event.target.checked)} />Confirmo actividad, responsable y fechas. Esta asignación no acredita avance ni otorga acceso adicional.</label>
      {error&&<p role="alert" className={styles.warning}>{error}</p>}
      {['load-error','refresh-required'].includes(phase)&&<section className={styles.confirmation} aria-label="Recuperar consulta de planificación"><p>Se conservan la selección, las fechas y la explicación en esta ventana. Volver a consultar no crea ni modifica asignaciones. Después deberás revisar y confirmar nuevamente.</p><button type="button" className={styles.primary} onClick={refreshSource}>{phase==='load-error'?'Volver a consultar la actividad':'Actualizar actividad y responsables'}</button></section>}
      </div><footer className={styles.dialogFooter}><button type="button" onClick={close} disabled={busy}>Volver sin confirmar</button><button className={styles.primary} disabled={!source||!owner||!consent||busy||blocked||sourcePending||directoryOpen||!review||review.warnings&&coordination.trim().length<8} type="submit">{busy?'Confirmando…':uncertain?'Verificar el mismo intento':'Confirmar planificación'}</button></footer>
    </form>
  </dialog>;
}
