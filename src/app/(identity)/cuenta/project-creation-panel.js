'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';
import {projectCreationSnapshot,projectCreationOutcome,projectCreationReadDenied,readProjectCreationResponse} from './project-creation-format.mjs';
import styles from './project-creation-panel.module.css';

const endpoint='/api/identity/project-creation';
const messages={SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar para comprobar el intento.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a abrir la obra.',PROJECT_CREATION_PERMISSION_REQUIRED:'El alta de una obra requiere el administrador vigente de la empresa.',PROJECT_CREATION_INPUT_INVALID:'Revisá el nombre, la dirección y el motivo del alta.',PROJECT_CREATION_OPERATION_CONFLICT:'Esta referencia corresponde a otros datos. Consultá su recibo antes de continuar.',PROJECT_CREATION_OPERATION_CONTEXT_CHANGED:'Cambió el acceso que originó este intento. Conservamos su referencia para revisar el recibo.',WORKSPACE_RECOVERY_REQUIRED:'Hay un alta pendiente. Comprobá su resultado antes de iniciar otra.',PROJECT_CREATION_INTEGRITY:'El recibo no coincide con los registros de la empresa. Pedí una revisión antes de crear otra obra.'};
const describe=code=>messages[code]||'No se pudo confirmar el alta. Conservamos la referencia para comprobar el resultado.';
const reference=value=>({scope:value.scope,projectId:value.projectId,operationId:value.operationId,action:'CREATE_PROJECT'});

export function ProjectCreationPanel({projectId,scope,getSessionToken,onPending,onCreated,recovered=null,locked=false}){
 const request=useWorkspaceRequest(getSessionToken);
 const [snapshot,setSnapshot]=useState(null),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[busy,setBusy]=useState(true),[message,setMessage]=useState(''),[notObserved,setNotObserved]=useState(false);
 const mounted=useRef(true),epoch=useRef(0),inFlight=useRef(false);
 useEffect(()=>{onPending?.(busy||Boolean(draft)||Boolean(attempt));return()=>onPending?.(false);},[busy,draft,attempt,onPending]);
 async function send(url,options={},expected={scope,projectId}){return request(url,{requestTimeoutMs:20000,...options},async response=>{try{return await readProjectCreationResponse(response,expected);}catch(error){error.message=describe(error.code);throw error;}});}
 function deny(error){if(projectCreationReadDenied(error)){setSnapshot(null);setDraft(null);setAttempt(previous=>previous?reference(previous):null);setNotObserved(false);}}
 function finish(value,pending){
  const result=projectCreationOutcome(value,pending);
  if(result.state==='NOT_OBSERVED'){setNotObserved(true);setMessage('Todavía no se observa un recibo. Conservamos la referencia para consultar otra vez. Si los datos originales siguen abiertos, podés reintentar esta misma alta.');return;}
  setAttempt(null);setDraft(null);setNotObserved(false);setMessage('El recibo confirma que se creó la obra '+result.newProject.name+'.');onCreated?.(result);
 }
 useEffect(()=>{
  mounted.current=true;const generation=epoch,current=++generation.current;
  // Withdraw private drafts and prior data when the signed session changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setBusy(true);setSnapshot(null);setDraft(null);setAttempt(null);setMessage('');setNotObserved(false);
  async function load(){
   const results=await Promise.allSettled([send(endpoint+'?'+new URLSearchParams({scope,projectId})),browserRecoveryJournal.list(scope)]);
   if(!mounted.current||current!==epoch.current)return;
   if(results[1].status==='fulfilled'){const pending=results[1].value.find(entry=>entry.resource==='project-creation');if(pending){setAttempt(pending);setMessage('Hay un alta pendiente de comprobación en esta empresa. Consultá su recibo; los datos del formulario no se guardaron en este navegador.');}}
   else setMessage(results[1].reason.message);
   if(results[0].status==='fulfilled'){try{setSnapshot(projectCreationSnapshot(results[0].value,{scope,projectId}));}catch(error){setMessage(error.message);}}
   else setMessage(results[0].reason.message);
   setBusy(false);
  }
  void load();return()=>{mounted.current=false;generation.current++;};
  // The transport changes with the signed-session provider.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[request,scope,projectId]);
 useEffect(()=>{
  if(!attempt||recovered?.scope!==scope||recovered.projectId!==attempt.projectId||recovered.operationId!==attempt.operationId)return;
  // An explicitly checked shared receipt may finish this same attempt.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  try{finish(recovered,attempt);}catch{/* Keep the reference when its projection differs. */}
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[recovered,attempt,scope,projectId]);
 async function execute(body,retrying=false){
  if(inFlight.current)return;inFlight.current=true;const current=epoch.current;setBusy(true);setMessage('');setAttempt(body);setNotObserved(false);
  try{const value=await send(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},body);if(mounted.current&&current===epoch.current)finish(value,body);}
  catch(error){if(mounted.current&&current===epoch.current){deny(error);if(!retrying&&error.requestDispatched===false){setAttempt(null);setMessage(error.message);}else setMessage('No se confirmó el resultado. Comprobá el recibo antes de crear otra obra. '+error.message);}}
  finally{inFlight.current=false;if(mounted.current&&current===epoch.current)setBusy(false);}
 }
 async function save(event){event.preventDefault();if(locked||busy||attempt||!draft||!snapshot)return;await execute({operationId:crypto.randomUUID(),scope,projectId,action:'CREATE_PROJECT',payload:draft});}
 async function recover(){
  if(inFlight.current||!attempt)return;inFlight.current=true;const current=epoch.current;setBusy(true);setNotObserved(false);
  try{const value=await send(endpoint+'?'+new URLSearchParams({scope:attempt.scope,projectId:attempt.projectId,operationId:attempt.operationId}),{},attempt);if(mounted.current&&current===epoch.current)finish(value,attempt);}
  catch(error){if(mounted.current&&current===epoch.current){deny(error);setMessage(error.message);}}
  finally{inFlight.current=false;if(mounted.current&&current===epoch.current)setBusy(false);}
 }
 async function refresh(){
  if(inFlight.current||attempt)return;inFlight.current=true;const current=epoch.current;setBusy(true);
  try{const value=await send(endpoint+'?'+new URLSearchParams({scope,projectId}));if(mounted.current&&current===epoch.current){setSnapshot(projectCreationSnapshot(value,{scope,projectId}));setMessage('Podés preparar el alta de otra obra.');}}
  catch(error){if(mounted.current&&current===epoch.current){deny(error);setMessage(error.message);}}
  finally{inFlight.current=false;if(mounted.current&&current===epoch.current)setBusy(false);}
 }
 const blocked=locked||busy||Boolean(attempt);
 return <section className={styles.panel} aria-labelledby="project-creation-title" aria-busy={busy}>
  <div><p className={styles.eyebrow}>EMPRESA</p><h3 id="project-creation-title">Agregar otra obra</h3><p>Creá una obra en esta empresa. Después podrás completar su preparación y sus permisos.</p></div>
  <p className={styles.message} role="status" aria-live="polite">{busy?'Consultando… ':''}{message}</p>
  {attempt&&<div className={styles.recovery}><strong>Alta pendiente de comprobación</strong><p>Esta referencia se conserva hasta verificar un recibo. Consultar el resultado no crea otra obra.</p><button type="button" disabled={busy} onClick={recover}>Comprobar resultado</button>{notObserved&&attempt.payload&&snapshot&&<button type="button" disabled={busy||locked} onClick={()=>execute(attempt,true)}>Reintentar esta misma alta</button>}<details><summary>Referencia del intento</summary><code>{attempt.operationId}</code></details></div>}
  {!snapshot&&!busy&&!attempt&&<button type="button" disabled={locked} onClick={refresh}>Volver a consultar</button>}
  {snapshot&&!draft&&!attempt&&<button type="button" disabled={blocked} onClick={()=>{setDraft({name:'',address:'',reason:''});setMessage('');}}>Preparar nueva obra</button>}
  {snapshot&&draft&&<form onSubmit={save} className={styles.form}><fieldset disabled={blocked}><legend>Datos de la nueva obra</legend><label>Nombre de la obra<input autoComplete="off" required minLength={2} maxLength={120} value={draft.name} onChange={event=>setDraft(previous=>({...previous,name:event.target.value}))}/></label><label>Dirección<input autoComplete="off" maxLength={300} value={draft.address} onChange={event=>setDraft(previous=>({...previous,address:event.target.value}))}/></label><label>Motivo del alta<textarea required minLength={8} maxLength={500} rows={3} value={draft.reason} onChange={event=>setDraft(previous=>({...previous,reason:event.target.value}))}/></label></fieldset><p>La obra empieza sin tareas, personas ni canales vinculados. La dirección declarada queda pendiente de verificación.</p><div className={styles.actions}><button type="submit" disabled={blocked}>Crear obra</button>{!attempt&&<button type="button" disabled={busy||locked} onClick={()=>setDraft(null)}>Cancelar borrador</button>}</div></form>}
 </section>;
}
