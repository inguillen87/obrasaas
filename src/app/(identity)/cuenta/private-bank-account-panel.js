'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,recoveryQuery,recoveryResult} from './workspace-recovery-journal.mjs';
import {PRIVATE_BANK_ACTIONS,privateBankNumber,privateBankType,PRIVATE_BANK_NOTICE_VERSION,validatePrivateBankSnapshot,validatePrivateBankOutcome} from './private-bank-account-format.mjs';
import styles from './private-bank-account-panel.module.css';
const endpoint='/api/identity/participants';
const message=value=>value.state==='CANCELLED'?'El intento pendiente quedó cancelado con recibo. Una solicitud demorada con esa referencia ya no puede guardar la cuenta.':value.state==='REJECTED'?'El registro cambió. El rechazo quedó registrado y este intento no modificó la cuenta. Consultá la referencia vigente antes de corregirla.':value.action==='REMOVE_PRIVATE_BANK_ACCOUNT'?'Declaración eliminada con recibo. No se inició ningún pago.':'Declaración registrada con recibo. Sólo se comprobó el formato; la titularidad bancaria no fue verificada.';
export function PrivateBankAccountPanel(props){return <PrivateBankAccountInner key={props.scope+':'+props.projectId+':'+props.workerId} {...props}/>;}
function PrivateBankAccountInner({scope,projectId,workerId,getSessionToken,onPending,locked=false}){
 const request=useWorkspaceRequest(getSessionToken),context={scope,projectId,workerId};
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[data,setData]=useState(null),[editing,setEditing]=useState(false),[type,setType]=useState('CBU'),[number,setNumber]=useState(''),[consent,setConsent]=useState(false),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[cancelAllowed,setCancelAllowed]=useState(false),[cancelConfirmed,setCancelConfirmed]=useState(false),[notice,setNotice]=useState(''),[receipt,setReceipt]=useState(null);
 const alive=useRef(true),epoch=useRef(0),local=useRef(false),ref=useRef(null),ram=useRef(null),refresh=useRef(async()=>{}),editor=useRef(null);
 useEffect(()=>{alive.current=true;const generation=epoch;return()=>{alive.current=false;generation.current++;ram.current=null;};},[]);
 useEffect(()=>{onPending?.(workerId,busy||open&&(!ready||Boolean(attempt)||editing));return()=>onPending?.(workerId,false);},[workerId,busy,open,ready,attempt,editing,onPending]);
 useEffect(()=>{if(editing)editor.current?.focus();},[editing]);
 useEffect(()=>{
  let active=true,sequence=0,initializing=true;
  const read=async(initial=false)=>{const n=++sequence;try{
   const pending=(await browserRecoveryJournal.list(scope)).find(row=>row.resource==='participants'&&row.projectId===projectId);
   if(!active||n!==sequence||local.current)return;
   const bank=pending&&PRIVATE_BANK_ACTIONS.includes(pending.action)&&pending.workerId===workerId?pending:null;
   if(ref.current?.operationId!==bank?.operationId){epoch.current++;ram.current=null;setNumber('');setConsent(false);setEditing(false);setData(null);setReceipt(null);setRetryAllowed(false);setCancelAllowed(false);setCancelConfirmed(false);if(ref.current)setNotice('Se comprobó la referencia desde otra consulta. Volvé a consultar tu cuenta privada antes de otro cambio.');}
   ref.current=bank;setAttempt(bank);setReady(!pending||Boolean(bank));if(initial&&bank){setOpen(true);setNotice('Hay una declaración privada por comprobar. La referencia no contiene el número de cuenta.');}
  }catch(error){if(active&&n===sequence){setReady(false);setNotice(error.message);}}};
  refresh.current=read;const update=()=>{if(!initializing)void read();};let channel;
  if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel(RECOVERY_EVENT);channel.onmessage=event=>{if(event.data?.version===1&&event.data.type==='invalidate')update();};}catch{/* Focus remains available. */}}
  void read(true).finally(()=>{initializing=false;});window.addEventListener(RECOVERY_EVENT,update);window.addEventListener('focus',update);window.addEventListener('storage',update);
  return()=>{active=false;channel?.close();window.removeEventListener(RECOVERY_EVENT,update);window.removeEventListener('focus',update);window.removeEventListener('storage',update);};
 },[scope,projectId,workerId]);
 function clearForm(){setNumber('');setConsent(false);setEditing(false);setCancelConfirmed(false);}
 function close(){if(busy||local.current)return;epoch.current++;ram.current=null;clearForm();setData(null);setReceipt(null);setRetryAllowed(false);setCancelAllowed(false);setOpen(false);setNotice(attempt?'La referencia sigue guardada. Cerrar no habilita otra solicitud.':'');}
 async function api(url,options,validate){
  let retained;
  const value=await request(url,options,async response=>{
   if(!response.ok){const error=Object.assign(new Error(response.status===401?'Ingresá nuevamente para comprobar tu referencia.':response.status===403?'Tu acceso actual no permite consultar esta cuenta privada.':'No se confirmó la operación. Conservamos la referencia si se envió.'),{status:response.status});if(options.method==='POST'){retained=error;return null;}throw error;}
   try{return validate(await response.json());}catch(error){if(options.method==='POST'){retained=error;return null;}throw error;}
  });if(retained)throw retained;return value;
 }
 async function load(){
  if(busy||local.current)return;const n=++epoch.current;setOpen(true);setBusy(true);setRetryAllowed(false);setCancelAllowed(false);clearForm();
  try{const value=await api(endpoint+'?'+new URLSearchParams({...context,detail:'private-bank-account'}),{},body=>validatePrivateBankSnapshot(body,context));if(alive.current&&epoch.current===n){setData(value);setNotice('Referencia privada consultada. No se muestra el número completo.');}}
  catch(error){if(alive.current&&epoch.current===n){setData(null);setNotice(error.message);}}
  finally{if(alive.current&&epoch.current===n)setBusy(false);}
 }
 function finish(value){ref.current=null;ram.current=null;setAttempt(null);setRetryAllowed(false);setCancelAllowed(false);clearForm();setData(null);setReceipt(value.receipt.id);setNotice(message(value));}
 async function send(snapshot,{cancel=false}={}){
  if(!snapshot||busy||local.current||locked||!ready||snapshot.ref.scope!==scope||snapshot.ref.projectId!==projectId||snapshot.ref.workerId!==workerId)return;
  const expected=snapshot.expected||{...snapshot.ref,...(data?{actorId:data.actorId,organizationId:data.organizationId}:{})};snapshot={...snapshot,expected};
  const n=++epoch.current;local.current=true;ref.current=snapshot.ref;if(cancel)ram.current=null;else ram.current=snapshot;setAttempt(snapshot.ref);setBusy(true);setRetryAllowed(false);setCancelAllowed(false);clearForm();setNotice('');
  try{const value=await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:snapshot.body,requestTimeoutMs:20000},body=>validatePrivateBankOutcome(body,snapshot.expected));if(!recoveryResult(snapshot.ref,value)||value.state==='NOT_OBSERVED')throw new Error('No se confirmó un recibo terminal.');if(alive.current&&epoch.current===n)finish(value);}
  catch(error){if(error.requestDispatched===false){try{const pending=(await browserRecoveryJournal.list(scope)).find(row=>row.resource==='participants'&&row.projectId===projectId);if(alive.current&&epoch.current===n){const same=pending&&pending.workerId===workerId&&PRIVATE_BANK_ACTIONS.includes(pending.action);ref.current=same?pending:null;setAttempt(ref.current);setReady(!pending||Boolean(same));if(pending?.operationId!==snapshot.ref.operationId)ram.current=null;}}catch{if(alive.current&&epoch.current===n)setReady(false);}}
   if(alive.current&&epoch.current===n){setData(null);setNotice(error.requestDispatched===false?error.message+' La solicitud no se envió.':'La confirmación no llegó. Comprobá la misma referencia antes de volver a guardar.');}}
  finally{local.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refresh.current();}}
 }
 async function save(event){
  event.preventDefault();if(busy||locked||!ready||attempt||!data||!editing)return;
  // Validate before creating a UUID or reserving a durable reference.
  if(!privateBankNumber(number)||!privateBankType(type)||!consent){setNotice('Ingresá exactamente 22 dígitos y autorizá este propósito privado. Sólo validamos el formato.');return;}
  const operationId=crypto.randomUUID(),command={scope,projectId,operationId,action:'SAVE_PRIVATE_BANK_ACCOUNT',payload:{workerId,revision:data.revision,expectedBankRevision:data.bankRevision,type,number,noticeVersion:PRIVATE_BANK_NOTICE_VERSION,consent:true}};
  await send({ref:{version:1,resource:'participants',scope,projectId,workerId,operationId,action:command.action,createdAt:Date.now()},body:JSON.stringify(command)});
 }
 async function remove(){if(busy||locked||!ready||attempt||!data||data.state!=='DECLARED')return;const operationId=crypto.randomUUID(),command={scope,projectId,operationId,action:'REMOVE_PRIVATE_BANK_ACCOUNT',payload:{workerId,revision:data.revision,expectedBankRevision:data.bankRevision}};await send({ref:{version:1,resource:'participants',scope,projectId,workerId,operationId,action:command.action,createdAt:Date.now()},body:JSON.stringify(command)});}
 async function recover(){
  if(busy||local.current||!attempt)return;const n=++epoch.current,pending=attempt;local.current=true;setBusy(true);setRetryAllowed(false);setCancelAllowed(false);setCancelConfirmed(false);
  try{const value=await api(recoveryQuery(pending),{requestTimeoutMs:15000},body=>validatePrivateBankOutcome(body,{...pending,...(ram.current?.expected?{actorId:ram.current.expected.actorId,organizationId:ram.current.expected.organizationId}:{})}));if(alive.current&&epoch.current===n){if(value.state==='NOT_OBSERVED'){setRetryAllowed(Boolean(ram.current&&ram.current.ref.operationId===pending.operationId));setCancelAllowed(true);setNotice('Todavía no se observa el recibo. Conservamos la referencia; podés volver a comprobarla o cancelar este intento con un recibo durable.');}else finish(value);}}
  catch(error){if(alive.current&&epoch.current===n){setData(null);setNotice(error.message+' La referencia sigue guardada.');}}
  finally{local.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refresh.current();}}
 }
 async function cancelPending(){if(!attempt||!cancelAllowed||!cancelConfirmed||busy||locked)return;const command={scope,projectId,operationId:attempt.operationId,action:'CANCEL_PENDING_PRIVATE_BANK_ACCOUNT',payload:{workerId,originalAction:attempt.action,confirmed:true}};await send({ref:attempt,body:JSON.stringify(command)},{cancel:true});}
 const disabled=busy||locked||!ready||Boolean(attempt);
 return <section className={styles.panel} aria-label="Mi cuenta bancaria privada" aria-busy={busy} data-private-bank-account>
  <div className={styles.heading}><h4>Mi cuenta bancaria privada</h4><button type="button" disabled={busy} onClick={open?close:load}>{open?'Cerrar cuenta privada':'Consultar mi cuenta privada'}</button></div>
  <p>Declaración personal para esta obra. No verifica titularidad ni habilita pagos; los datos bancarios por WhatsApp están cerrados.</p><p role="status" aria-live="polite">{notice}</p>
  {!open&&attempt&&<p>Hay una referencia pendiente. Cerrar la consulta conserva su recuperación.</p>}
  {open&&<><button type="button" disabled={busy} onClick={load}>Actualizar referencia privada</button>{!ready&&<p>Hay otra operación de Participantes pendiente o no se pudo comprobar el almacenamiento. Guardar queda bloqueado.</p>}
   {data&&<><p>{data.state==='DECLARED'?`${data.type} declarado · termina en ${data.last4}`:data.state==='REMOVED'?'Declaración eliminada.':'Sin cuenta declarada.'} Validación de formato únicamente.</p><p>{data.notice.text}</p><div className={styles.actions}><button type="button" disabled={disabled||editing} onClick={()=>{clearForm();setType('CBU');setEditing(true);}}>Declarar o corregir mi cuenta</button>{data.state==='DECLARED'&&<button type="button" disabled={disabled||editing} onClick={remove}>Eliminar mi declaración</button>}</div></>}
   {editing&&data&&<form onSubmit={save} className={styles.form}><label>Tipo de cuenta<select disabled={disabled} value={type} onChange={event=>setType(event.target.value)}><option value="CBU">CBU</option><option value="CVU">CVU</option></select></label><label>CBU o CVU · 22 dígitos<input ref={editor} type="text" inputMode="numeric" autoComplete="off" maxLength={22} value={number} disabled={disabled} onChange={event=>setNumber(event.target.value)}/></label><label className={styles.consent}><input type="checkbox" checked={consent} disabled={disabled} onChange={event=>setConsent(event.target.checked)}/>Leí el aviso y autorizo guardar esta declaración privada.</label><div className={styles.actions}><button type="submit" disabled={disabled}>Guardar declaración privada</button><button type="button" disabled={busy} onClick={clearForm}>Cancelar borrador privado</button></div></form>}
   {attempt&&<div className={styles.recovery}><p>Referencia: <code>{attempt.operationId}</code>. El número no se conserva en el almacenamiento del navegador.</p><button type="button" disabled={busy} onClick={recover}>Comprobar mi declaración pendiente</button>{retryAllowed&&<button type="button" disabled={busy||locked} onClick={()=>send(ram.current)}>Reintentar exactamente la misma declaración</button>}{cancelAllowed&&<><label className={styles.consent}><input type="checkbox" checked={cancelConfirmed} disabled={busy} onChange={event=>setCancelConfirmed(event.target.checked)}/>Quiero cancelar este intento pendiente e impedir su aplicación posterior.</label><button type="button" disabled={busy||locked||!cancelConfirmed} onClick={cancelPending}>Cancelar intento con recibo</button></>}</div>}
  </>}{receipt&&<p className={styles.receipt}>Recibo privado: <code>{receipt}</code></p>}
 </section>;
}
