'use client';
import {useEffect,useRef,useState} from 'react';
import {Building2,MessageCircle,RefreshCw,ShieldCheck,TriangleAlert} from 'lucide-react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,recoveryResult} from './workspace-recovery-journal.mjs';
import {OWN_COMPANY_ACTIONS,OWN_COMPANY_STATES,ownCompanyNumberSnapshot,ownCompanyNumberOutcome,ownCompanyNumberCommand,ownCompanyNumberRecoveryCommand,ownCompanyNumberCanAct,ownCompanyNumberFresh,ownCompanyNumberExplain,ownCompanyNumberAccessDenied} from './own-company-number-view.mjs';
import styles from './company-channel-panel.module.css';
const endpoint='/api/identity/company-channel';
const labels={CONNECT_OWN_NUMBER:'Conectar número propio',ACTIVATE_OWN_NUMBER:'Activar conexión del número'};
const referenceOf=command=>({version:1,resource:'company-channel',scope:command.scope,projectId:command.projectId,operationId:command.operationId,action:command.action,connectionId:command.payload.connectionId,createdAt:Date.now()});
export function OwnCompanyNumberPanel(props){return <OwnCompanyNumberInner key={props.scope+':'+props.projectId} {...props}/>;}
function OwnCompanyNumberInner({projectId,scope,getSessionToken,onPending,locked=false}){
 const transport=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[busy,setBusy]=useState(false),[data,setData]=useState(null),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[recoveryReady,setRecoveryReady]=useState(false),[needsRead,setNeedsRead]=useState(true),[notice,setNotice]=useState(''),[receipt,setReceipt]=useState(null);
 const [connectRecovery,setConnectRecovery]=useState(null),[originalSourceHead,setOriginalSourceHead]=useState(''),[confirmRecovery,setConfirmRecovery]=useState(false);
 const alive=useRef(true),epoch=useRef(0),controller=useRef(null),editor=useRef(null),reference=useRef(null),attemptContext=useRef(null),localRequest=useRef(false),refreshReferences=useRef(async()=>{});
 useEffect(()=>{alive.current=true;const generation=epoch;return()=>{alive.current=false;generation.current++;controller.current?.abort();attemptContext.current=null;};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(draft)||opened&&(!recoveryReady||Boolean(attempt)));return()=>onPending?.(false);},[busy,draft,opened,recoveryReady,attempt,onPending]);
 const draftAction=draft?.action;
 useEffect(()=>{if(draftAction){editor.current?.focus({preventScroll:true});editor.current?.scrollIntoView({block:'start',behavior:'auto'});}},[draftAction]);
 useEffect(()=>{
  if(!data)return;const remaining=Date.parse(data.expiresAt)-Date.now();
  const invalidate=()=>{if(!alive.current)return;epoch.current++;controller.current?.abort();setBusy(false);setDraft(null);setNeedsRead(true);setNotice('La consulta venció. Volvé a consultar el número con tu acceso actual.');};
  if(remaining<=0){invalidate();return;}
  const timer=setTimeout(invalidate,remaining);return()=>clearTimeout(timer);
 },[data]);
 useEffect(()=>{
  let active=true,sequence=0,initializing=true;
  const read=async(initial=false,invalidate=false)=>{const n=++sequence;try{
   const entry=(await browserRecoveryJournal.list(scope)).find(row=>row.resource==='company-channel');
   if(!active||n!==sequence||localRequest.current)return;
   if(reference.current?.operationId!==entry?.operationId||invalidate){
    epoch.current++;controller.current?.abort();setData(null);setDraft(null);setReceipt(null);setConnectRecovery(null);setConfirmRecovery(false);setOriginalSourceHead('');setNeedsRead(true);setBusy(false);
    if(reference.current?.operationId!==entry?.operationId)attemptContext.current=null;
    if(!initial)setNotice(entry?'Hay una decisión pendiente. Comprobala antes de continuar.':'La configuración pudo cambiar en otra pestaña. Volvé a consultar antes de otra decisión.');
   }
   reference.current=entry||null;setAttempt(entry||null);setRecoveryReady(true);
   if(initial&&entry&&OWN_COMPANY_ACTIONS.includes(entry.action)){setOpened(true);setNotice('Hay un intento por comprobar. La consulta del resultado no vuelve a enviarlo.');}
  }catch{if(active&&n===sequence){setRecoveryReady(false);setNotice('No se pudo comprobar el almacenamiento de referencias. Las decisiones quedan bloqueadas.');}}};
  refreshReferences.current=read;
  const invalidated=()=>{if(!initializing)void read(false,true);},refresh=()=>{if(!initializing)void read();},visible=()=>{if(document.visibilityState==='visible')refresh();};let channel;
  if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel(RECOVERY_EVENT);channel.onmessage=event=>{if(event.data?.version===1&&event.data?.type==='invalidate')invalidated();};}catch{/* Focus and same-window invalidation remain available. */}}
  void read(true).finally(()=>{initializing=false;});window.addEventListener(RECOVERY_EVENT,invalidated);window.addEventListener('storage',invalidated);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;channel?.close();window.removeEventListener(RECOVERY_EVENT,invalidated);window.removeEventListener('storage',invalidated);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[scope,projectId]);
 function expected(){return {scope,projectId,...(data?{organizationId:data.organization.id,actorId:data.actor.id}:{})};}
 function hideDenied(error){if(!ownCompanyNumberAccessDenied(error))return;setData(null);setDraft(null);setReceipt(null);setConnectRecovery(null);setConfirmRecovery(false);setNeedsRead(true);attemptContext.current=null;}
 async function request(params,options,validate){
  let retained;
  const result=await transport(endpoint+(options.method==='POST'?'':'?'+new URLSearchParams({scope,projectId,...params})),options,async response=>{
   if(!response.ok){let body;try{body=await response.json();}catch{/* HTTP status still controls access. */}
    const error=Object.assign(new Error(ownCompanyNumberExplain(response.status===401?'SESSION_REQUIRED':body?.code)),{status:response.status,code:body?.code});
    if(options.method==='POST'){retained=error;return null;}throw error;
   }
   try{return validate(await response.json());}catch(error){if(options.method==='POST'){retained=error;return null;}throw error;}
  });
  if(retained)throw retained;return result;
 }
 async function fetchSnapshot(n,signal){
  const snapshot=await request({discovery:'OWN_NUMBER'},{signal,requestTimeoutMs:15000},value=>ownCompanyNumberSnapshot(value,expected()));
  if(alive.current&&epoch.current===n){setData(snapshot);setNeedsRead(!ownCompanyNumberFresh(snapshot));}return snapshot;
 }
 async function load(){
  if(busy||localRequest.current)return;const n=++epoch.current,abort=new AbortController();controller.current?.abort();controller.current=abort;setOpened(true);setBusy(true);setData(null);setDraft(null);setNeedsRead(true);setNotice('');
  try{await fetchSnapshot(n,abort.signal);}catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice(ownCompanyNumberExplain(error.code)+' La consulta no cambia la configuración.');}}
  finally{if(alive.current&&epoch.current===n)setBusy(false);}
 }
 function close(){if(busy||localRequest.current)return;epoch.current++;controller.current?.abort();setDraft(null);setData(null);setReceipt(null);setConnectRecovery(null);setConfirmRecovery(false);setNeedsRead(true);setOpened(false);setNotice(attempt?'La referencia del intento sigue guardada para comprobarla.':'');}
 function start(action){
  if(busy||localRequest.current||locked||attempt||!recoveryReady||needsRead||!ownCompanyNumberCanAct(data,action))return;
  setDraft({action,connectionId:data.channel?.id||null,revision:data.channel?.revision||0,companyPhoneRevision:data.companyPhoneRevision,confirmOwnBusiness:false,confirmReplacement:false});setReceipt(null);setNotice('');
 }
 async function finish(result,n){
  reference.current=null;attemptContext.current=null;setAttempt(null);setDraft(null);setConnectRecovery(null);setConfirmRecovery(false);setOriginalSourceHead('');setNeedsRead(true);
  setReceipt({id:result.receiptId,action:result.action,state:result.state});
  const message=result.state==='REJECTED'?ownCompanyNumberExplain(result.code)+' El rechazo quedó registrado.':'Configuración registrada. La prueba de conversación sigue pendiente.';setNotice(message);
  try{await fetchSnapshot(n,controller.current?.signal);}catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice(message+' Volvé a consultar antes de otra decisión.');}}
 }
 async function save(event){
  event.preventDefault();if(busy||localRequest.current||locked||attempt||!recoveryReady||needsRead||!draft?.confirmOwnBusiness)return;
  let command;try{command={...ownCompanyNumberCommand(data,draft,expected()),operationId:crypto.randomUUID()};}catch(error){setNotice(error.code?ownCompanyNumberExplain(error.code):'Revisá y confirmá la empresa y el número.');setDraft(old=>old?{...old,confirmOwnBusiness:false}:old);return;}
  const ref=referenceOf(command),n=++epoch.current,abort=new AbortController(),context={...expected(),operationId:command.operationId,action:command.action,connectionId:command.payload.connectionId};
  controller.current?.abort();controller.current=abort;localRequest.current=true;reference.current=ref;attemptContext.current=context;setAttempt(ref);setBusy(true);setNotice('');
  try{
   const result=await request({},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:abort.signal,requestTimeoutMs:20000},value=>ownCompanyNumberOutcome(value,context,{post:true}));
   const outcome=recoveryResult(ref,result);if(!outcome)throw new Error('Uncorrelated result');
   if(alive.current&&epoch.current===n){if(['RECORDED','REJECTED'].includes(outcome.state))await finish(result,n);else{setData(null);setDraft(null);setNeedsRead(true);setNotice('La activación sigue por comprobar. Consultá el resultado; no se volverá a enviar.');}}
  }catch(error){
   if(error.requestDispatched===false){try{const entry=(await browserRecoveryJournal.list(scope)).find(row=>row.resource==='company-channel');if(alive.current&&epoch.current===n){reference.current=entry||null;setAttempt(entry||null);if(entry?.operationId!==ref.operationId)attemptContext.current=null;}}catch{if(alive.current&&epoch.current===n)setRecoveryReady(false);}}
   if(alive.current&&epoch.current===n){hideDenied(error);setDraft(null);setNeedsRead(true);setNotice(error.requestDispatched===false?ownCompanyNumberExplain(error.code)+' La operación no se envió.':'La confirmación no llegó. Conservamos la referencia: comprobá su resultado antes de continuar.');}
  }
  finally{localRequest.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refreshReferences.current();}}
 }
 async function recover(){
  if(busy||localRequest.current||!attempt||attempt.projectId!==projectId||!OWN_COMPANY_ACTIONS.includes(attempt.action))return;
  const n=++epoch.current,ref=attempt,abort=new AbortController();controller.current?.abort();controller.current=abort;localRequest.current=true;setBusy(true);setDraft(null);setConnectRecovery(null);setConfirmRecovery(false);setNotice('');
  const context=attemptContext.current?.operationId===ref.operationId?attemptContext.current:expected();
  try{
   const result=await request({operationId:ref.operationId},{signal:abort.signal,requestTimeoutMs:15000},value=>ownCompanyNumberOutcome(value,{...context,scope:ref.scope,projectId:ref.projectId,operationId:ref.operationId,action:ref.action,connectionId:ref.connectionId}));
   const outcome=recoveryResult(ref,result);if(!outcome)throw new Error('Uncorrelated result');
   if(alive.current&&epoch.current===n){if(['RECORDED','REJECTED'].includes(outcome.state))await finish(result,n);else{setData(null);setNeedsRead(true);if(result.connectRecovery){setConnectRecovery(result);setOriginalSourceHead(result.connectRecovery.policySourceHead||'');setNotice('La conexión original no quedó registrada. Revisá la recuperación excepcional de este mismo intento.');}else setNotice(result.recovery==='EXPLICIT_REVIEW_REQUIRED'?'Meta fue consultado sin reenviar la activación. El responsable debe revisar este intento pendiente.':'El intento sigue sin un resultado definitivo. Su referencia se conserva; otra decisión queda bloqueada.');}}
  }catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice(ownCompanyNumberExplain(error.code)+' Conservamos la referencia para volver a comprobar.');}}
  finally{localRequest.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refreshReferences.current();}}
 }
 async function confirmConnectRecovery(event){
  event.preventDefault();if(busy||localRequest.current||locked||!recoveryReady||!attempt||attempt.action!=='CONNECT_OWN_NUMBER'||!connectRecovery||!confirmRecovery)return;
  const ref=attempt,context={...expected(),scope:ref.scope,projectId:ref.projectId,operationId:ref.operationId,action:ref.action,connectionId:null};let command;
  try{command=ownCompanyNumberRecoveryCommand(connectRecovery,{originalSourceHead,confirmRecovery},context);}catch(error){setNotice(ownCompanyNumberExplain(error.code));return;}
  const n=++epoch.current,abort=new AbortController();controller.current?.abort();controller.current=abort;localRequest.current=true;setBusy(true);setNotice('');setConnectRecovery(null);setConfirmRecovery(false);
  try{const result=await request({},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:abort.signal,requestTimeoutMs:20000},value=>ownCompanyNumberOutcome(value,context,{post:true}));const outcome=recoveryResult(ref,result);if(!outcome)throw new Error('Uncorrelated result');if(alive.current&&epoch.current===n){if(['RECORDED','REJECTED'].includes(outcome.state))await finish(result,n);else setNotice('Conservamos el intento original. Comprobá el resultado antes de otra decisión.');}}
  catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice(ownCompanyNumberExplain(error.code)+' Conservamos el intento original; comprobá su resultado antes de volver a revisar la recuperación.');}}
  finally{localRequest.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refreshReferences.current();}}
 }
 const disabled=busy||locked||!recoveryReady||Boolean(attempt)||needsRead;
 const replacement=draft?.action==='CONNECT_OWN_NUMBER'&&data?.channel&&!data.connectionMatchesAssets;
 const canRecover=attempt&&attempt.projectId===projectId&&OWN_COMPANY_ACTIONS.includes(attempt.action);
 const canActivate=ownCompanyNumberCanAct(data,'ACTIVATE_OWN_NUMBER');
 const numberStatus=data?.operationalGrant?({ACTIVE:'Conexión habilitada',REVOKED:'Operación revocada',EXPIRED:'Credencial vencida',UNAVAILABLE:'Operación por revisar'}[data.operationalGrant.state]):data?.connectionOwnVerified?(data.channel.enabled&&data.channel.connectionStatus==='CONNECTED'?'Conexión habilitada':'Conexión pendiente de activación'):data?.channel&&data.connectionMatchesAssets?'Conexión anterior por revisar':'Pendiente de conexión';
 return <section className={styles.panel} aria-labelledby="own-company-number-title" aria-busy={busy} data-own-company-number>
  <div className={styles.heading}><div><p className={styles.eyebrow}>NÚMERO DE LA EMPRESA</p><h3 id="own-company-number-title"><MessageCircle size={21} aria-hidden="true"/>Conectar nuestro WhatsApp</h3><p className={styles.intro}>Consultá el número propio en Meta, revisá su titularidad y confirmá la conexión con ObraSaaS.</p></div><button type="button" className={!opened?styles.primary:undefined} disabled={busy} onClick={opened?close:load}>{opened?'Cerrar consulta':'Consultar número en Meta'}</button></div>
  <p className={notice?styles.notice:styles.silent} role="status" aria-live="polite">{notice}</p>
  {!opened&&attempt&&<p className={styles.note}>Hay una decisión del canal por comprobar. Su referencia permanece guardada.</p>}
  {opened&&<>
   <div className={styles.actions}><button type="button" disabled={busy} onClick={load}><RefreshCw size={16} aria-hidden="true"/>Consultar número en Meta</button><a href="https://business.facebook.com/" target="_blank" rel="noreferrer">Abrir Meta Business</a></div>
   {!recoveryReady&&<p className={styles.warning}>No se pudo comprobar el almacenamiento de referencias. Podés consultar; las decisiones quedan bloqueadas.</p>}
   {attempt&&<div className={styles.recovery}><h4><TriangleAlert size={18} aria-hidden="true"/>Intento por comprobar</h4><p>Referencia: <code>{attempt.operationId}</code></p>{canRecover?<button type="button" disabled={busy} onClick={recover}>Comprobar resultado</button>:<p>Revisá esta decisión en <a href="#pending-receipts-title">Operaciones por comprobar</a>. Si pertenece a otra obra, cerrá esta consulta y elegí su obra.</p>}<p>Comprobar sólo consulta el resultado. Podés cerrar para actualizar tu acceso; la referencia permanece guardada.</p></div>}
   {attempt&&connectRecovery&&<form onSubmit={confirmConnectRecovery} className={styles.review} aria-labelledby="own-connect-recovery-title"><h4 id="own-connect-recovery-title">Recuperar conexión pendiente</h4><p>Se volverá a comprobar la titularidad y se guardará la conexión del intento original. Quedará pendiente de activación y de la prueba de conversación.</p><p className={styles.note}>La autorización conserva su plazo hasta {new Date(connectRecovery.connectRecovery.expiresAt).toLocaleString('es-AR')}.</p>{connectRecovery.connectRecovery.policySourceHead===null&&<details open><summary>Referencia de la versión original</summary><label className={styles.field}>Referencia de versión original (SHA)<input value={originalSourceHead} maxLength={40} pattern="[a-f0-9]{40}" required autoComplete="off" spellCheck={false} disabled={busy||locked} onChange={event=>{setOriginalSourceHead(event.target.value.trim());setConfirmRecovery(false);}}/></label><p className={styles.note}>El responsable debe indicar la versión que reservó este intento. El servidor comprobará que corresponde a la misma autorización.</p></details>}<label className={styles.checkbox}><input type="checkbox" checked={confirmRecovery} disabled={busy||locked} onChange={event=>setConfirmRecovery(event.target.checked)}/>Revisé el intento original y confirmo guardar su conexión pendiente.</label><div className={styles.actions}><button type="submit" className={styles.primary} disabled={busy||locked||!recoveryReady||!confirmRecovery||!/^[a-f0-9]{40}$/.test(originalSourceHead)}>Confirmar recuperación de conexión</button><button type="button" disabled={busy} onClick={()=>{setConnectRecovery(null);setConfirmRecovery(false);}}>Cancelar revisión</button></div></form>}
   {data&&<>
    <dl className={styles.context}><div><dt><Building2 size={16} aria-hidden="true"/>Empresa en ObraSaaS</dt><dd>{data.organization.name}</dd></div><div><dt><ShieldCheck size={16} aria-hidden="true"/>Número consultado en Meta</dt><dd>{data.displayPhoneNumber}<small>{data.verifiedBusinessName||'Nombre de empresa no informado por Meta'}</small></dd></div></dl>
    <div className={styles.channel}><div className={styles.channelHeading}><h4>Estado del número</h4><span className={styles.badge}>{numberStatus}</span></div><p className={styles.note}>{data.registered?'Registro del número comprobado en Meta.':'Completá el registro del número en Meta y volvé a consultar antes de activar.'} {data.subscribed?'Suscripción de la aplicación comprobada.':'La suscripción de la aplicación se comprobará al activar.'}</p>{data.channel&&!data.connectionMatchesAssets&&data.channel.mode!=='SUSPENDED'&&<p className={styles.warning}>Hay otro número en este canal. Revisalo y suspendelo en WhatsApp para varias obras antes de reemplazarlo.</p>}{data.channel&&data.connectionMatchesAssets&&!data.connectionOwnVerified&&!ownCompanyNumberCanAct(data,'CONNECT_OWN_NUMBER')&&<p className={styles.note}>Hay una conexión anterior de este número. Revisá su estado en WhatsApp para varias obras antes de preparar esta conexión.</p>}<div className={styles.actions}>{canActivate?<button type="button" disabled={disabled} onClick={()=>start('ACTIVATE_OWN_NUMBER')}>{labels.ACTIVATE_OWN_NUMBER}</button>:ownCompanyNumberCanAct(data,'CONNECT_OWN_NUMBER')&&<button type="button" disabled={disabled} onClick={()=>start('CONNECT_OWN_NUMBER')}>{data.channel&&!data.connectionMatchesAssets?'Revisar reemplazo del número':labels.CONNECT_OWN_NUMBER}</button>}</div></div>
    <p className={styles.note}>Ventana de configuración hasta {new Date(data.expiresAt).toLocaleString('es-AR')}. Este plazo limita el alta y los cambios.</p>
    {data.operationalGrant&&<p className={styles.note}>{data.operationalGrant.state==='ACTIVE'?'Autorización operativa vigente':data.operationalGrant.state==='REVOKED'?'Autorización operativa revocada':data.operationalGrant.state==='EXPIRED'?'Credencial de operación vencida':'Autorización operativa por revisar'}. {data.operationalGrant.credentialExpiresAt&&<>Vencimiento de credencial: {new Date(data.operationalGrant.credentialExpiresAt).toLocaleString('es-AR')}. </>}La operación requiere que Meta mantenga el acceso y que la empresa conserve este número.</p>}
    <p className={styles.note}>El nombre y logo visibles en WhatsApp se administran en Meta. Conectar este número no cambia el perfil público de la empresa.</p>
    <div className={styles.capabilities}><strong>Prueba de conversación pendiente</strong><p>Después de habilitar la conexión, falta comprobar un mensaje recibido y su respuesta con un participante autorizado. La consulta y el recibo de configuración no acreditan esa prueba.</p><small>Las obras y permisos se revisan por separado en WhatsApp para varias obras.</small></div>
   </>}
   {draft&&data&&<form onSubmit={save} className={styles.review} aria-labelledby="own-company-number-review-title"><h4 id="own-company-number-review-title" ref={editor} tabIndex={-1}>Revisar: {labels[draft.action]}</h4><dl><div><dt>Empresa</dt><dd>{data.organization.name}</dd></div><div><dt>Número en Meta</dt><dd>{data.displayPhoneNumber}</dd></div><div><dt>Nombre en Meta</dt><dd>{data.verifiedBusinessName||'No informado'}</dd></div><div><dt>Decisión</dt><dd>{replacement?'Reemplazar el número del canal suspendido':labels[draft.action]}</dd></div></dl>{replacement&&<><p className={styles.warning}>Se reemplazará {data.channel.displayPhoneNumber||'el número actual'} por {data.displayPhoneNumber}. Las asignaciones de obras del canal anterior se revocarán y deberán revisarse.</p><label className={styles.checkbox}><input type="checkbox" checked={draft.confirmReplacement} disabled={disabled} onChange={event=>setDraft(old=>({...old,confirmReplacement:event.target.checked}))}/>Confirmo el reemplazo del número del canal suspendido.</label></>}<label className={styles.checkbox}><input type="checkbox" checked={draft.confirmOwnBusiness} disabled={disabled} onChange={event=>setDraft(old=>({...old,confirmOwnBusiness:event.target.checked}))}/>Revisé la empresa y confirmo que este número le pertenece.</label>{draft.action==='ACTIVATE_OWN_NUMBER'&&<p className={styles.note}>Confirmar habilita la conexión y su suscripción en Meta. La prueba de conversación seguirá pendiente.</p>}<div className={styles.actions}><button type="submit" className={styles.primary} disabled={disabled||!draft.confirmOwnBusiness||replacement&&!draft.confirmReplacement}>Confirmar {draft.action==='CONNECT_OWN_NUMBER'?'conexión':'activación'}</button><button type="button" disabled={busy} onClick={()=>setDraft(null)}>Cancelar revisión</button></div></form>}
   {receipt&&<p className={styles.receipt}>Recibo: <code>{receipt.id}</code><small>{labels[receipt.action]} · {OWN_COMPANY_STATES[receipt.state]} · Prueba de conversación pendiente</small></p>}
  </>}
 </section>;
}
