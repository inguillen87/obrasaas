'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import styles from './workspace.module.css';
const endpoint='/api/identity/task-creation';
export function TaskCreatePanel({projectId,scope,onCreated,onPending,getSessionToken}){
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [open,setOpen]=useState(false),[title,setTitle]=useState(''),[startsOn,setStartsOn]=useState(''),[endsOn,setEndsOn]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[message,setMessage]=useState('');
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(attempt)||open);return()=>onPending?.(false);},[busy,attempt,open,onPending]);
 async function send(method,body){
  const query=method==='GET'?'?'+new URLSearchParams({projectId:attempt.projectId,scope:attempt.scope,operationId:attempt.operationId}):'';
  return sessionRequest(endpoint+query,{method,requestTimeoutMs:20000,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})},async result=>{const data=await result.json();if(!result.ok){const error=new Error(data.code==='SCHEDULE_DATES_INVALID'?'Revisá las fechas de la tarea.':'No se pudo confirmar la tarea con tus permisos actuales.');error.status=result.status;error.code=data.code;throw error;}return data;});
 }
 function finish(result){
  if(result.scope!==scope||result.created!==true||!result.receiptId||!result.task?.id)throw new Error('Falta un recibo correlacionado.');
  setAttempt(null);setRetryAllowed(false);setOpen(false);setTitle('');setStartsOn('');setEndsOn('');setMessage('Tarea creada y vinculada a esta obra.');onCreated?.(result.task);
 }
 async function sendAttempt(body,retrying=false){
  setAttempt(body);setRetryAllowed(false);setBusy(true);setMessage('');
  try{const result=await send('POST',body);if(mounted.current)finish(result);}catch(error){if(mounted.current){if(error.requestDispatched===false||error.status&&error.status<500){if(!retrying)setAttempt(null);setMessage(error.message);}else setMessage('La confirmación no llegó. Comprobá el recibo antes de volver a crear la tarea.');}}finally{if(mounted.current)setBusy(false);}
 }
 async function create(event){
  event.preventDefault();if(busy||attempt)return;await sendAttempt({operationId:crypto.randomUUID(),projectId,scope,title,startsOn,endsOn});
 }
 async function retry(){
  if(busy||!attempt||!retryAllowed)return;await sendAttempt(attempt,true);
 }
 async function recover(){
  if(busy||!attempt)return;setBusy(true);setRetryAllowed(false);try{const data=await send('GET');if(mounted.current){if(data.scope!==scope)throw new Error('La respuesta corresponde a otra organización.');if(data.state==='RECORDED')finish(data);else if(data.state==='NOT_OBSERVED'){setRetryAllowed(true);setMessage('No se observa un recibo todavía. Podés comprobar otra vez o reintentar exactamente la misma creación; conservamos sus datos para evitar duplicados.');}else throw new Error('Todavía no se pudo comprobar el guardado. Conservamos el intento.');}}catch(error){if(mounted.current)setMessage(error.message);}finally{if(mounted.current)setBusy(false);}
 }
 const locked=busy||Boolean(attempt);
 return <section aria-label="Crear tarea de la obra"><div role="status" aria-live="polite" className={message?styles.notice:styles.silent}>{message}</div>
 {!open?<button type="button" onClick={()=>setOpen(true)}>Nueva tarea</button>:<form onSubmit={create} className={styles.form}><h4>Nueva tarea</h4><p>La tarea comienza por iniciar y con avance cero. Las fechas son opcionales.</p><label>Título de la tarea<input required minLength={2} maxLength={160} disabled={locked} value={title} onChange={event=>setTitle(event.target.value)}/></label><div className={styles.dates}><label>Inicio previsto<input type="date" value={startsOn} disabled={locked} onChange={event=>setStartsOn(event.target.value)}/></label><label>Fin previsto<input type="date" value={endsOn} min={startsOn||undefined} disabled={locked} onChange={event=>setEndsOn(event.target.value)}/></label></div><div className={styles.actions}>{attempt?<><button type="button" disabled={busy} onClick={recover}>Comprobar tarea</button>{retryAllowed&&<button type="button" disabled={busy} onClick={retry}>Reintentar la misma creación</button>}</>:<><button type="submit">Crear tarea</button><button type="button" onClick={()=>setOpen(false)}>Cancelar</button></>}</div></form>}
 </section>;
}
