'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import styles from './customer-whatsapp-panel.module.css';
const endpoint='/api/identity/whatsapp-setup';
const messages={WORKSPACE_INTEGRATION_PERMISSION_REQUIRED:'Tu rol actual no permite configurar el WhatsApp de esta empresa.',WORKSPACE_MEMBERSHIP_REQUIRED:'La pertenencia a esta empresa no está vigente.',WORKSPACE_CONTEXT_CHANGED:'Cambió el contexto de tu organización. Volvé a abrir la obra.',WORKSPACE_CONFLICT:'La preparación cambió mientras editabas. Tu borrador se conserva; consultá la versión actual antes de volver a guardar.',WORKSPACE_INTEGRITY:'La preparación anterior requiere revisión. No la reemplazamos por un ejemplo.',WORKSPACE_INVALID:'Revisá el nombre, el tipo de número y los circuitos elegidos.',WORKSPACE_PROJECT_MISMATCH:'La preparación no pertenece a la obra abierta.',WHATSAPP_PREPARATION_OPERATION_CONFLICT:'La clave de este intento ya pertenece a otra solicitud.',SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.'};
const explain=code=>messages[code]||'No se pudo confirmar la preparación. No se modificó ninguna cuenta de Meta.';
const stateLabel=value=>({SAVED:'Guardado',PENDING:'Pendiente',NOT_VERIFIED:'Sin verificar',RECORD_PRESENT:'Registro existente; operación no verificada',NOT_LINKED:'Sin vincular'}[value]||'Sin verificar');
async function api(sessionRequest,url,options={}){
 return sessionRequest(url,options,async result=>{const data=await result.json();if(!result.ok){const error=new Error(explain(data.code));error.status=result.status;error.code=data.code;throw error;}return data;});
}
const empty=()=>({assistantName:'',numberMode:'',useCases:[],confirmOwnership:false});
export function CustomerWhatsAppPanel({projectId,scope,onPending,getSessionToken}){
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[draft,setDraft]=useState(empty),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[attempt,setAttempt]=useState(null),[canRetry,setCanRetry]=useState(false);
 const mounted=useRef(true),active=useRef(null);
 const dirty=Boolean(opened&&data&&(draft.assistantName!==data.profile.assistantName||draft.numberMode!==(data.profile.numberMode||'')||JSON.stringify([...draft.useCases].sort())!==JSON.stringify([...data.profile.useCases].sort())||draft.confirmOwnership));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort();};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(attempt)||dirty);return()=>onPending?.(false);},[busy,attempt,dirty,onPending]);
 function accept(result,replaceDraft){
  if(result.scope!==scope||result.projectId!==projectId)throw new Error('La respuesta no pertenece a esta obra.');
  setData(result);
  if(replaceDraft)setDraft({assistantName:result.profile.assistantName,numberMode:result.profile.numberMode||'',useCases:result.profile.useCases,confirmOwnership:false});
 }
 async function load(){
  if(busy||attempt||dirty)return;setOpened(true);setBusy(true);setMessage('');const abort=new AbortController();active.current=abort;
  try{const result=await api(sessionRequest,endpoint+'?'+new URLSearchParams({projectId,scope}),{signal:abort.signal});if(mounted.current)accept(result,true);}
  catch(error){if(mounted.current&&error.name!=='AbortError')setMessage(error.message);}finally{if(mounted.current)setBusy(false);}
 }
 function finish(result){
  if(result.saved!==true||!result.receipt?.id)throw new Error('Falta el recibo de la preparación.');
  accept(result,true);setAttempt(null);setCanRetry(false);setMessage(result.savedProfileIsCurrent===false?'Se recuperó tu recibo. Otro cambio posterior ya modificó la preparación; se muestra la versión vigente.':'Preparación guardada. El número todavía no quedó conectado ni se enviaron mensajes.');
 }
 async function send(payload,retrying=false){
  setBusy(true);setCanRetry(false);setMessage('');onPending?.(true);
  try{const result=await api(sessionRequest,endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),requestTimeoutMs:20000});if(mounted.current)finish(result);}
  catch(error){if(mounted.current){if((error.requestDispatched===false||error.status&&error.status<500)){if(!retrying)setAttempt(null);setMessage(error.message);}else setMessage('El guardado quedó sin confirmar. Conservamos este intento: comprobalo antes de reenviar.');}}
  finally{if(mounted.current)setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(busy||attempt||!data)return;
  const payload={operationId:crypto.randomUUID(),projectId,scope,profile:{...draft,useCases:[...draft.useCases],initialProjectId:projectId,expectedRevision:data.profile.revision}};
  setAttempt(payload);await send(payload);
 }
 async function retry(){if(!attempt||busy||!canRetry)return;await send(attempt,true);}
 async function recover(){
  if(!attempt||busy)return;setBusy(true);setCanRetry(false);
  try{const result=await api(sessionRequest,endpoint+'?'+new URLSearchParams({projectId,scope,operationId:attempt.operationId}),{requestTimeoutMs:15000});
   if(mounted.current){if(result.state==='RECORDED')finish(result);else if(result.state==='NOT_OBSERVED'){
    accept(result,false);setCanRetry(true);setMessage('Todavía no se observa el recibo. Podés reenviar este mismo intento con su identificador y sus datos originales. No se reenvía automáticamente.');
   }else throw new Error('No se pudo comprobar el recibo de la preparación.');}}
  catch(error){if(mounted.current)setMessage(error.message);}finally{if(mounted.current)setBusy(false);}
 }
 function toggle(value){setDraft(previous=>({...previous,useCases:previous.useCases.includes(value)?previous.useCases.filter(item=>item!==value):[...previous.useCases,value]}));}
 const locked=busy||Boolean(attempt);
 return <section className={styles.panel} aria-labelledby="customer-whatsapp-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>WHATSAPP DE TU EMPRESA</p><h3 id="customer-whatsapp-title">Tu número. Tu obra.</h3></div><button type="button" onClick={load} disabled={locked||dirty}>{opened?'Volver a cargar':'Preparar WhatsApp'}</button>{opened&&<button type="button" disabled={locked} onClick={()=>{if(data)setDraft({assistantName:data.profile.assistantName,numberMode:data.profile.numberMode||'',useCases:[...data.profile.useCases],confirmOwnership:false});setOpened(false);setMessage('');}}>Cancelar edición</button>}</div>
  <p className={styles.intro}>Prepará la conexión desde tu cuenta. No tenés que compartir tokens, contraseñas ni claves con ObraSaaS. La autorización del número se realizará en Meta.</p>
  <p role="status" aria-live="polite" className={message?styles.notice:styles.silent}>{message}</p>
  {busy&&!data&&<p>Consultando la preparación de esta obra…</p>}
  {opened&&data&&<>
   <div className={styles.context}><strong>{data.companyName}</strong><span>{data.projectName}</span></div>
   <form onSubmit={save}>
    <label className={styles.field}>Nombre del asistente<input maxLength={70} required autoComplete="off" value={draft.assistantName} disabled={locked} onChange={event=>setDraft({...draft,assistantName:event.target.value})}/></label>
    <fieldset disabled={locked} className={styles.modes}><legend>¿Qué número vas a utilizar?</legend>{data.options.numberModes.map(mode=><label key={mode.key}><input type="radio" name="number-mode" value={mode.key} checked={draft.numberMode===mode.key} required onChange={()=>setDraft({...draft,numberMode:mode.key})}/><span><strong>{mode.label}</strong><small>{mode.detail}</small></span></label>)}</fieldset>
    <fieldset disabled={locked} className={styles.cases}><legend>Circuitos que necesitás en esta obra</legend>{data.options.useCases.map(item=><label key={item.key}><input type="checkbox" checked={draft.useCases.includes(item.key)} onChange={()=>toggle(item.key)}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</fieldset>
    <label className={styles.consent}><input type="checkbox" required checked={draft.confirmOwnership} disabled={locked} onChange={event=>setDraft({...draft,confirmOwnership:event.target.checked})}/><span>Confirmo que preparo la conexión para esta empresa y esta obra. Esto no autoriza todavía a ObraSaaS ante Meta.</span></label>
    <div className={styles.actions}>{attempt?<><button type="button" disabled={busy} onClick={recover}>Comprobar preparación</button>{canRetry&&<button type="button" disabled={busy} onClick={retry}>Reenviar mismo intento</button>}</>:<button type="submit" disabled={busy||!draft.numberMode||!draft.useCases.length}>Guardar preparación</button>}</div>
   </form>
   <section className={styles.progress} aria-labelledby="wa-connection-progress"><h4 id="wa-connection-progress">Preparación y pasos del alta</h4><ol>{data.readiness.steps.map(step=>{const inMetaPanel=['AUTHORIZATION','CONNECTION','TEMPLATES'].includes(step.key);return <li key={step.key}><span>{step.title}</span><strong data-status={inMetaPanel?'CONSULT_META':step.state}>{inMetaPanel?'Consultar conexión Meta':stateLabel(step.state)}</strong></li>;})}</ol>
    <p>Guardar esta preparación no registra un número, no cambia tu proveedor y no activa los circuitos seleccionados.</p>
    <p className={styles.note}>El panel «Autorizar WhatsApp con Meta» muestra la disponibilidad, el registro, las plantillas y la habilitación actual del canal. Estos pasos describen el recorrido; guardar la preparación no confirma su aceptación.</p>
   </section>
  </>}
 </section>;
}
