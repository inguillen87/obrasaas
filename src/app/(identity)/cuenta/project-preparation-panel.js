'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';
import {PREPARATION_JOBS,projectPreparationSnapshot,projectPreparationOutcome,projectPreparationPublicSnapshot,projectPreparationDraft,preparationReadDenied} from './project-preparation-format.mjs';
import styles from './project-preparation-panel.module.css';

const endpoint='/api/identity/project-preparation';
const messages={SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar para comprobar el intento.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a abrir la obra.',PROJECT_PREPARATION_PERMISSION_REQUIRED:'Sólo un administrador o director puede preparar esta obra.',PROJECT_PREPARATION_INPUT_INVALID:'Revisá los datos y el motivo. Las etiquetas son provisorias y las notas tienen un límite de extensión.',PROJECT_PREPARATION_REVISION_CHANGED:'Otra persona modificó los datos. Conservamos tu borrador; consultá los registros actuales antes de preparar otro guardado.',PROJECT_PREPARATION_CANCELLED:'Este intento fue cancelado. Comprobá su recibo para continuar.',WORKSPACE_RECOVERY_REQUIRED:'Hay un intento anterior pendiente. Comprobá su resultado antes de preparar otro guardado.',PROJECT_PREPARATION_INTEGRITY:'No se pudo verificar la preparación registrada. Pedí una revisión de los registros de esta obra.'};
const describe=code=>messages[code]||'No se pudo confirmar la preparación. Conservamos el intento para comprobar su resultado.';
const teamId=()=>`planned_team_${crypto.randomUUID()}`,slotId=()=>`planned_slot_${crypto.randomUUID()}`;

export function ProjectPreparationPanel({projectId,scope,getSessionToken,onPending,onPrepared,recovered=null,locked=false}){
 const request=useWorkspaceRequest(getSessionToken);
 const [snapshot,setSnapshot]=useState(null),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[notObserved,setNotObserved]=useState(false),[cancelConfirmed,setCancelConfirmed]=useState(false),[stale,setStale]=useState(false);
 const mounted=useRef(true),epoch=useRef(0),inFlight=useRef(false);
 const context={scope,projectId};
 useEffect(()=>{onPending?.(busy||Boolean(draft)||Boolean(attempt));return()=>onPending?.(false);},[busy,draft,attempt,onPending]);
 async function send(url,options={}){return request(url,{requestTimeoutMs:20000,...options},async response=>{const value=await response.json();if(!response.ok)throw Object.assign(new Error(describe(value.code)),{code:value.code,status:response.status});return value;});}
 useEffect(()=>{
  mounted.current=true;const generation=epoch,current=++generation.current;
  // Withdraw any prior display when the signed-session provider changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setBusy(true);setSnapshot(null);setDraft(null);setAttempt(null);setStale(false);
  async function load(){try{
   const [value,references]=await Promise.all([send(endpoint+'?'+new URLSearchParams({scope,projectId})),browserRecoveryJournal.list(scope)]);
   if(!mounted.current||current!==epoch.current)return;
   setSnapshot(projectPreparationSnapshot(value,{scope,projectId}));
   const pending=references.find(entry=>entry.resource==='project-preparation'&&entry.projectId===projectId);if(pending){setAttempt(pending);setMessage('Hay un guardado pendiente de comprobación. Consultá su recibo; el formulario anterior no se conservó en este navegador.');}
  }catch(error){if(mounted.current&&current===epoch.current)setMessage(error.message);}finally{if(mounted.current&&current===epoch.current)setBusy(false);}}
  void load();return()=>{mounted.current=false;generation.current++;};
  // The transport changes when the signed-session provider changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[request,scope,projectId]);
 function denied(error){if(preparationReadDenied(error)){setSnapshot(null);setDraft(null);}}
 function finish(value,reference){
  const result=projectPreparationOutcome(value,reference);
  if(result.state==='NOT_OBSERVED'){setNotObserved(true);setMessage('Todavía no se observa un recibo. Conservamos la referencia. Podés comprobar otra vez, reintentar el mismo guardado si su formulario sigue abierto o cancelar este intento con un recibo.');return;}
  setAttempt(null);setNotObserved(false);setCancelConfirmed(false);setDraft(null);setStale(false);
  if(result.state==='CANCELLED'){setMessage('Intento cancelado con recibo. Una solicitud demorada con esta referencia ya no puede modificar la obra.');return;}
  const next=projectPreparationSnapshot(projectPreparationPublicSnapshot(result),context);setSnapshot(next);onPrepared?.(next);
  setMessage(result.savedPreparationIsCurrent?'Preparación guardada con recibo. Los puestos siguen pendientes de identificación.':'El recibo confirma ese guardado; se muestra la versión actual, modificada posteriormente.');
 }
 useEffect(()=>{
  if(!attempt||recovered?.scope!==scope||recovered.projectId!==projectId||recovered.operationId!==attempt.operationId)return;
  // Synchronize a receipt explicitly checked in the shared recovery panel.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  try{finish(recovered,attempt);}catch{/* Keep the pending attempt if its projection differs. */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[recovered,attempt,scope,projectId]);
 async function execute(body,retrying=false){
  if(inFlight.current)return;inFlight.current=true;const current=epoch.current;setBusy(true);setMessage('');setAttempt(body);setNotObserved(false);setCancelConfirmed(false);
  try{const value=await send(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(mounted.current&&current===epoch.current)finish(value,body);}
  catch(error){if(mounted.current&&current===epoch.current){denied(error);if(!retrying&&(error.requestDispatched===false||error.status&&error.status<500)){setAttempt(null);if(error.code==='PROJECT_PREPARATION_REVISION_CHANGED')setStale(true);setMessage(error.message);}else setMessage('El servidor no confirmó el resultado. Conservamos este intento: comprobá su recibo antes de continuar. '+error.message);}}
  finally{inFlight.current=false;if(mounted.current&&current===epoch.current)setBusy(false);}
 }
 async function save(event){event.preventDefault();if(locked||busy||attempt||!draft||stale)return;await execute({operationId:crypto.randomUUID(),scope,projectId,action:'SAVE_PREPARATION',payload:draft});}
 async function recover(){
  if(inFlight.current||!attempt)return;inFlight.current=true;const current=epoch.current;setBusy(true);setNotObserved(false);setCancelConfirmed(false);
  try{const value=await send(endpoint+'?'+new URLSearchParams({scope,projectId,operationId:attempt.operationId}));if(mounted.current&&current===epoch.current)finish(value,attempt);}
  catch(error){if(mounted.current&&current===epoch.current){denied(error);setMessage(error.message);}}
  finally{inFlight.current=false;if(mounted.current&&current===epoch.current)setBusy(false);}
 }
 async function refresh(){
  if(inFlight.current||attempt)return;inFlight.current=true;const current=epoch.current;setBusy(true);
  try{const value=await send(endpoint+'?'+new URLSearchParams(context));if(mounted.current&&current===epoch.current){setSnapshot(projectPreparationSnapshot(value,context));setDraft(null);setStale(false);setMessage('Datos actuales consultados. Podés preparar una nueva edición.');}}
  catch(error){if(mounted.current&&current===epoch.current){denied(error);setMessage(error.message);}}
  finally{inFlight.current=false;if(mounted.current&&current===epoch.current)setBusy(false);}
 }
 function change(key,value){setDraft(previous=>({...previous,[key]:value}));}
 function changeTeam(id,key,value){setDraft(previous=>({...previous,teams:previous.teams.map(team=>team.id===id?{...team,[key]:value}:team)}));}
 function changeSlot(id,key,value){setDraft(previous=>({...previous,slots:previous.slots.map(slot=>slot.id===id?{...slot,[key]:value}:slot)}));}
 function addTeam(){setDraft(previous=>({...previous,teams:[...previous.teams,{id:teamId(),label:`Cuadrilla prevista ${previous.teams.length+1}`,engagement:'IN_HOUSE',headcount:null,note:'',status:'PLANNED'}]}));}
 function addSlot(id){setDraft(previous=>({...previous,slots:[...previous.slots,{id:slotId(),teamId:id,label:`Puesto pendiente ${previous.slots.filter(slot=>slot.teamId===id).length+1}`,job:'WORKER',note:'',provisional:true,status:'PLANNED'}]}));}
 const blocked=locked||busy||Boolean(attempt),display=draft||snapshot;
 return <section className={styles.panel} aria-labelledby="project-preparation-title" aria-busy={busy}>
  <div className={styles.heading}><p className={styles.eyebrow}>PREOBRA</p><h3 id="project-preparation-title">Preparación de la obra</h3><p>Ordená los datos generales y el equipo previsto antes del inicio.</p></div>
  <p className={styles.notice}>Inicio por confirmar. La preparación se guarda aparte del cronograma; las fechas y el avance se consultan en <a href="#schedule-title">Tareas y cronograma</a>.</p>
  <p role="status" aria-live="polite" className={styles.message}>{busy?'Consultando preparación… ':''}{message}</p>
  {!snapshot&&!busy&&!attempt&&<button type="button" disabled={locked} onClick={refresh}>Volver a consultar</button>}
  {attempt&&<div className={styles.recovery}><strong>Intento pendiente de comprobación</strong><p>No cambies los datos hasta confirmar el resultado.</p><button type="button" disabled={busy} onClick={recover}>Comprobar resultado</button>{notObserved&&<><p>La cancelación conserva un recibo y bloquea un guardado que llegue tarde.</p><label className={styles.confirm}><input type="checkbox" checked={cancelConfirmed} disabled={busy} onChange={event=>setCancelConfirmed(event.target.checked)}/>Quiero cancelar este intento pendiente</label><div className={styles.actions}><button type="button" disabled={busy||!cancelConfirmed} onClick={()=>execute({operationId:attempt.operationId,scope,projectId,action:'CANCEL_PENDING_PREPARATION',payload:{confirmed:true}},true)}>Cancelar intento con recibo</button>{attempt.payload&&attempt.action==='SAVE_PREPARATION'&&<button type="button" disabled={busy} onClick={()=>execute(attempt,true)}>Reintentar el mismo guardado</button>}</div></>}<details><summary>Referencia del intento</summary><code>{attempt.operationId}</code></details></div>}
  {snapshot&&!draft&&<><dl className={styles.facts}><div><dt>Obra</dt><dd>{snapshot.name}</dd></div><div><dt>Cliente / comitente</dt><dd>{snapshot.clientName||'Por completar'}</dd></div><div><dt>Dirección</dt><dd>{snapshot.address||'Por completar'}</dd></div></dl><div className={styles.teams}>{snapshot.teams.map(team=><article className={styles.team} key={team.id}><h4>{team.label}</h4><p>{team.engagement==='SUBCONTRACTED'?'Cuadrilla subcontratada':'Equipo propio'} · {team.headcount===null?'Cantidad por confirmar':`${team.headcount} puestos previstos`}</p>{team.note&&<p>{team.note}</p>}<ul>{snapshot.slots.filter(slot=>slot.teamId===team.id).map(slot=><li key={slot.id}><strong>{slot.label}</strong> · {PREPARATION_JOBS[slot.job]}<small>Pendiente de identificación</small>{slot.note&&<span>{slot.note}</span>}</li>)}</ul></article>)}</div>{!snapshot.teams.length&&<p>Todavía no hay cuadrillas previstas.</p>}<p className={styles.notice}>Los puestos previstos son etiquetas provisorias. La identidad, el contacto y los permisos se completan desde <a href="#participant-title">Participantes y permisos</a>.</p><button className={styles.primary} type="button" disabled={blocked} onClick={()=>{setDraft(projectPreparationDraft(snapshot));setMessage('');}}>Preparar datos y equipo</button></>}
  {draft&&<form onSubmit={save} className={styles.form}><fieldset disabled={blocked}><legend>Datos generales</legend><label>Nombre de la obra<input autoComplete="off" required minLength={2} maxLength={120} value={display.name} onChange={event=>change('name',event.target.value)}/></label><label>Cliente / comitente<input autoComplete="off" maxLength={120} value={display.clientName} onChange={event=>change('clientName',event.target.value)}/></label><label>Dirección<input autoComplete="off" maxLength={300} value={display.address} onChange={event=>change('address',event.target.value)}/></label></fieldset>
   <fieldset disabled={blocked}><legend>Cuadrillas previstas</legend><p>Indicá alcance y disponibilidad. El responsable puede quedar pendiente en la nota.</p>{draft.teams.map(team=>{const slots=draft.slots.filter(slot=>slot.teamId===team.id);return <article className={styles.team} key={team.id}><div className={styles.grid}><label>Nombre de la cuadrilla<input required minLength={2} maxLength={100} value={team.label} onChange={event=>changeTeam(team.id,'label',event.target.value)}/></label><label>Tipo<select value={team.engagement} onChange={event=>changeTeam(team.id,'engagement',event.target.value)}><option value="IN_HOUSE">Equipo propio</option><option value="SUBCONTRACTED">Subcontratada</option></select></label><label>Cantidad prevista<input type="number" min={Math.max(1,slots.length)} max={99} value={team.headcount??''} placeholder="Por confirmar" onChange={event=>changeTeam(team.id,'headcount',event.target.value===''?null:Number(event.target.value))}/></label></div><label>Alcance y disponibilidad<input maxLength={500} value={team.note} placeholder="Trabajo previsto, disponibilidad y responsable pendiente" onChange={event=>changeTeam(team.id,'note',event.target.value)}/></label><div className={styles.slots}>{slots.map(slot=><div className={styles.slot} key={slot.id}><p className={styles.pending}>Pendiente de identificación</p><label>Etiqueta provisoria<input required minLength={2} maxLength={100} value={slot.label} onChange={event=>changeSlot(slot.id,'label',event.target.value)}/></label><label>Trabajo previsto<select value={slot.job} onChange={event=>changeSlot(slot.id,'job',event.target.value)}>{Object.entries(PREPARATION_JOBS).map(([job,label])=><option key={job} value={job}>{label}</option>)}</select></label><label>Nota del puesto<input maxLength={300} value={slot.note} onChange={event=>changeSlot(slot.id,'note',event.target.value)}/></label><button type="button" onClick={()=>change('slots',draft.slots.filter(value=>value.id!==slot.id))}>Quitar puesto</button></div>)}</div><div className={styles.actions}><button type="button" disabled={draft.slots.length>=50||team.headcount!==null&&slots.length>=team.headcount} onClick={()=>addSlot(team.id)}>Agregar puesto previsto</button><button type="button" onClick={()=>setDraft(previous=>({...previous,teams:previous.teams.filter(value=>value.id!==team.id),slots:previous.slots.filter(slot=>slot.teamId!==team.id)}))}>Quitar cuadrilla y puestos</button></div></article>;} )}<button type="button" disabled={draft.teams.length>=20} onClick={addTeam}>Agregar cuadrilla</button></fieldset>
   <p className={styles.notice}>Cada puesto sigue pendiente de identificación. Completá su identidad, contacto y permisos desde Participantes cuando se confirme la persona.</p><label>Motivo de esta preparación<textarea required minLength={8} maxLength={500} rows={3} disabled={blocked} value={draft.reason} onChange={event=>change('reason',event.target.value)}/></label>
   {stale&&<p className={styles.notice}>Tu borrador sigue visible. Consultar los registros actuales reemplaza este borrador; copiá primero cualquier dato que quieras conservar.</p>}
   <div className={styles.actions}>{!attempt&&<><button className={styles.primary} type="submit" disabled={blocked||stale}>Guardar preparación</button><button type="button" disabled={busy||locked} onClick={()=>{setDraft(null);setStale(false);}}>Cancelar borrador</button>{stale&&<button type="button" disabled={busy||locked} onClick={refresh}>Descartar borrador y consultar registros</button>}</>}</div>
  </form>}
 </section>;
}
