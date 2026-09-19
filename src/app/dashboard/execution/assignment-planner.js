'use client';
import { useEffect,useId,useRef,useState } from 'react';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { normalizeAssignmentPlan,confirmAssignmentPlan } from '@/lib/task-assignment-policy';
import { useWorkspaceLeaveGuard } from '../use-workspace-leave-guard';
import styles from './assignments.module.css';
export default function AssignmentPlanner({organizationId,projectId,tasks,focusedTask,onClose,onSaved}) {
  const dialog=useRef(null),alive=useRef(true),inFlight=useRef(false),attempt=useRef(null),heading=useId();
  const [taskId,setTaskId]=useState(focusedTask?.id||''),[source,setSource]=useState(null),[phase,setPhase]=useState('idle'),[error,setError]=useState('');
  const [draft,setDraft]=useState({ownerKind:'WORKER',ownerId:'',startsOn:'',endsOn:''}),[consent,setConsent]=useState(false),[search,setSearch]=useState('');
  const busy=phase==='saving',uncertain=phase==='uncertain',blocked=phase==='blocked';
  const dirty=Boolean(draft.ownerId||draft.startsOn||draft.endsOn||phase==='saving'||phase==='uncertain'||taskId&&!focusedTask);
  useWorkspaceLeaveGuard({dirty,busy});
  useEffect(()=>{alive.current=true;const el=dialog.current,previous=document.activeElement;el.showModal();el.querySelector('[aria-label="Cerrar planificación"]')?.focus();return()=>{alive.current=false;el.close();if(previous?.isConnected)previous.focus();};},[]);
  useEffect(()=>{const warn=event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,busy]);
  useEffect(()=>{
    if(!taskId)return;
    let active=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
    fetch('/api/execution/assignments?taskId='+encodeURIComponent(taskId),{cache:'no-store',signal:controller.signal,headers:evidenceScopeHeaders({organizationId,projectId})})
      .then(async response=>{const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||'No se pudo consultar la actividad.');
        if(body?.context?.organizationId!==organizationId||body.context.projectId!==projectId||body.task?.id!==taskId||!Number.isSafeInteger(body.task.revision)||!Array.isArray(body.owners?.workers)||!Array.isArray(body.owners?.teams)||body.owners.workers.length>100||body.owners.teams.length>100||![...body.owners.workers,...body.owners.teams].every(owner=>typeof owner.id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,189}$/.test(owner.id)&&typeof owner.name==='string')||body.task.revision<0)throw new Error('La consulta no corresponde a esta actividad y obra.');
        if(active){setSource(body);if(body.canCreate!==true){setPhase('blocked');setError('La obra o empresa no permite planificar nuevas asignaciones.');}}})
      .catch(failure=>{if(active){setError(failure.name==='AbortError'?'La consulta demoró. Cerrá y volvé a consultar.':failure.message);setPhase('blocked');}}).finally(()=>clearTimeout(timeout));
    return()=>{active=false;controller.abort();clearTimeout(timeout);};
  },[organizationId,projectId,taskId]);
  function close(){if(inFlight.current)return;if(dirty&&!window.confirm('¿Salir sin confirmar esta planificación? El texto y la selección sólo están en esta ventana.'))return;onClose();}
  function change(key,value){setDraft(previous=>({...previous,[key]:value,...(key==='ownerKind'?{ownerId:''}:{})}));setConsent(false);}
  async function save(event){
    event.preventDefault();if(inFlight.current||!source||!consent||blocked)return;
    try{if(!attempt.current){const input={taskId,expectedTaskRevision:source.task.revision,...draft};attempt.current={key:crypto.randomUUID(),input,normalized:normalizeAssignmentPlan(input)};}}catch(failure){setError(failure.message);return;}
    inFlight.current=true;setPhase('saving');setError('');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/execution/assignments',{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json',...evidenceScopeHeaders({organizationId,projectId}),'Idempotency-Key':attempt.current.key},body:JSON.stringify(attempt.current.input)});
      const payload=await response.json().catch(()=>null);if(!response.ok)throw Object.assign(new Error(payload?.error||'La planificación no quedó confirmada.'),{status:response.status});
      const assignment=confirmAssignmentPlan(payload,attempt.current.normalized,{organizationId,projectId});
      if(alive.current)onSaved(assignment);
    }catch(failure){if(alive.current){setError(failure.name==='AbortError'?'La respuesta demoró. Verificá el mismo intento antes de crear otra asignación.':failure.message);
      if([400,422].includes(failure.status)){attempt.current=null;setPhase('idle');}else setPhase([401,402,403,404,409,410].includes(failure.status)?'blocked':'uncertain');}}
    finally{clearTimeout(timeout);inFlight.current=false;}
  }
  const options=source?.owners?.[draft.ownerKind==='WORKER'?'workers':'teams']||[];
  const displayed=options.filter(owner=>owner.id===draft.ownerId||owner.name.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const owner=options.find(row=>row.id===draft.ownerId),locked=busy||uncertain||blocked;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={heading} onCancel={event=>{event.preventDefault();close();}}
    style={{'--assign-bg':tokens.colors.bg.secondary,'--assign-accent':tokens.colors.accent.primary,'--assign-border':tokens.colors.border.default}}>
    <header className={styles.dialogHeader}><div><span>ACTIVIDAD → RESPONSABLE → SEGUIMIENTO</span><h2 id={heading}>Planificar asignación</h2></div><button type="button" aria-label="Cerrar planificación" onClick={close} disabled={busy}>×</button></header>
    <form onSubmit={save}><div className={styles.dialogBody}>
      <p>Elegí quién se ocupará de la actividad. Se guarda como <strong>planificada</strong>; no inicia tareas, fichajes, pagos ni permisos de WhatsApp.</p>
      <fieldset disabled={locked} className={styles.fields}><label>Actividad<select aria-label="Actividad a asignar" required disabled={Boolean(focusedTask)} value={taskId} onChange={event=>{setTaskId(event.target.value);setSource(null);setDraft({ownerKind:'WORKER',ownerId:'',startsOn:'',endsOn:''});setConsent(false);setSearch('');setError('');}}><option value="">Seleccionar actividad</option>{tasks.filter(task=>task.type==='TASK').map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      {taskId&&!source&&!blocked&&<p role="status">Consultando versión, responsables y estado de la obra…</p>}
      {source&&<><div className={styles.ownerTypes} role="group" aria-label="Tipo de responsable"><button type="button" aria-pressed={draft.ownerKind==='WORKER'} onClick={()=>change('ownerKind','WORKER')}>Una persona</button><button type="button" aria-pressed={draft.ownerKind==='TEAM'} onClick={()=>change('ownerKind','TEAM')}>Una cuadrilla</button></div>
      <label>Buscar responsable<input type="search" maxLength={80} value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar en las opciones disponibles" /></label>
      <label>{draft.ownerKind==='WORKER'?'Persona de esta obra':'Cuadrilla de esta obra'}<select required aria-label="Responsable de la asignación" value={draft.ownerId} onChange={event=>change('ownerId',event.target.value)}><option value="">Seleccionar responsable</option>{displayed.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      {options.length===0&&<p role="status">No hay {draft.ownerKind==='WORKER'?'personas activas':'cuadrillas activas'} disponibles en esta obra. Registralas antes de asignar.</p>}
      {source.owners.truncated&&<p className={styles.warning}>Se muestran hasta 100 opciones por tipo. No encontrar un responsable en esta lista no confirma que no exista.</p>}
      <div className={styles.dates}><label>Inicio previsto · opcional<input aria-label="Inicio previsto" type="date" value={draft.startsOn} onChange={event=>change('startsOn',event.target.value)} /></label><label>Fin previsto · opcional<input aria-label="Fin previsto" type="date" min={draft.startsOn||undefined} value={draft.endsOn} onChange={event=>change('endsOn',event.target.value)} /></label></div>
      <p className={styles.hint}>Fechas de planificación, sin horas ni cálculo de disponibilidad. No cambian las fechas del Gantt.</p></>}
      </fieldset>
      {source&&owner&&<section className={styles.confirmation} aria-label="Revisar planificación"><span>ANTES DE CONFIRMAR</span><strong>{source.task.title}</strong><p>{draft.ownerKind==='WORKER'?'Persona':'Cuadrilla'}: {owner.name}</p><p>{draft.startsOn||'Sin fecha de inicio'} → {draft.endsOn||'Sin fecha final'}</p><small>Versión de la actividad: {source.task.revision}. Estado inicial: planificada.</small></section>}
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={locked||!owner} onChange={event=>setConsent(event.target.checked)} />Confirmo actividad, responsable y fechas. Esta asignación no acredita avance ni otorga acceso adicional.</label>
      {error&&<p role="alert" className={styles.warning}>{error}</p>}
      </div><footer className={styles.dialogFooter}><button type="button" onClick={close} disabled={busy}>Volver sin confirmar</button><button className={styles.primary} disabled={!source||!owner||!consent||busy||blocked} type="submit">{busy?'Confirmando…':uncertain?'Verificar el mismo intento':'Confirmar planificación'}</button></footer>
    </form>
  </dialog>;
}
