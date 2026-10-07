'use client';
import {useEffect,useRef,useState} from 'react';
import {Building2,MessageCircle,ShieldCheck,RefreshCw,TriangleAlert} from 'lucide-react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,recoveryResult} from './workspace-recovery-journal.mjs';
import {COMPANY_CHANNEL_MODES,companyChannelSnapshot,companyChannelOutcome,companyChannelCommand,companyChannelCanAct,companyChannelExplain,companyChannelAccessDenied} from './company-channel-view.mjs';
import styles from './company-channel-panel.module.css';
const endpoint='/api/identity/company-channel';
const actionLabels={PREPARE:'Preparar canal',ASSIGN:'Asignar obra',REVOKE:'Revocar obra',ACTIVATE:'Activar canal de empresa',SUSPEND:'Suspender canal de empresa'};
const referenceOf=command=>({version:1,resource:'company-channel',scope:command.scope,projectId:command.projectId,operationId:command.operationId,action:command.action,connectionId:command.payload.connectionId,createdAt:Date.now()});
export function CompanyChannelPanel(props){return <CompanyChannelInner key={props.scope+':'+props.projectId} {...props}/>;}
function CompanyChannelInner({projectId,scope,getSessionToken,onPending,locked=false}){
 const transport=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[busy,setBusy]=useState(false),[data,setData]=useState(null),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[recoveryReady,setRecoveryReady]=useState(false),[retryAllowed,setRetryAllowed]=useState(false),[needsRead,setNeedsRead]=useState(true),[notice,setNotice]=useState(''),[receipt,setReceipt]=useState(null);
 const alive=useRef(true),epoch=useRef(0),controller=useRef(null),editor=useRef(null),reference=useRef(null),payload=useRef(null),localRequest=useRef(false),refreshReferences=useRef(async()=>{});
 useEffect(()=>{alive.current=true;const generation=epoch;return()=>{alive.current=false;generation.current++;controller.current?.abort();payload.current=null;};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(draft)||opened&&(!recoveryReady||Boolean(attempt)));return()=>onPending?.(false);},[busy,draft,opened,recoveryReady,attempt,onPending]);
 const draftAction=draft?.action;
 useEffect(()=>{if(draftAction){editor.current?.focus({preventScroll:true});editor.current?.scrollIntoView({block:'start',behavior:'auto'});}},[draftAction]);
 useEffect(()=>{
  let active=true,sequence=0,initializing=true;
  const read=async(initial=false)=>{const n=++sequence;try{
   const entry=(await browserRecoveryJournal.list(scope)).find(row=>row.resource==='company-channel');
   if(!active||n!==sequence||localRequest.current)return;
   if(reference.current?.operationId!==entry?.operationId){
    epoch.current++;controller.current?.abort();payload.current=null;setRetryAllowed(false);setData(null);setDraft(null);setReceipt(null);setNeedsRead(true);setBusy(false);
    if(reference.current)setNotice(entry?'Hay otra referencia pendiente. Consultala antes de una nueva decisión.':'El intento fue comprobado desde Operaciones por comprobar. Consultá el canal vigente antes de otra decisión.');
   }
   reference.current=entry||null;setAttempt(entry||null);setRecoveryReady(true);
   if(initial&&entry){setOpened(true);setNotice('Hay un intento pendiente de comprobación en este navegador. La consulta no vuelve a enviarlo.');}
  }catch(error){if(active&&n===sequence){setRecoveryReady(false);setNotice(error.message);}}};
  refreshReferences.current=read;
  const refresh=()=>{if(!initializing)void read();},visible=()=>{if(document.visibilityState==='visible')refresh();};let channel;
  if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel(RECOVERY_EVENT);channel.onmessage=event=>{if(event.data?.version===1&&event.data?.type==='invalidate')refresh();};}catch{/* Same-window and focus invalidation still work. */}}
  void read(true).finally(()=>{initializing=false;});window.addEventListener(RECOVERY_EVENT,refresh);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;channel?.close();window.removeEventListener(RECOVERY_EVENT,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[scope,projectId]);
 function expected(){return {scope,projectId,...(data?{organizationId:data.organization.id,actorId:data.actor.id}:{})};}
 function hideDenied(error){if(!companyChannelAccessDenied(error))return;setData(null);setDraft(null);setReceipt(null);setNeedsRead(true);setRetryAllowed(false);}
 async function request(params,options,validate){
  let retained;
  const result=await transport(endpoint+(options.method==='POST'?'':'?'+new URLSearchParams({scope,projectId,...params})),options,async response=>{
   if(!response.ok){let body;try{body=await response.json();}catch{/* The HTTP denial still applies. */}
    const error=Object.assign(new Error(response.status===401?'Tu sesión terminó. Volvé a ingresar.':companyChannelExplain(body?.code)),{status:response.status,code:body?.code});
    if(options.method==='POST'){retained=error;return null;}throw error;
   }
   try{return validate(await response.json());}catch(error){if(options.method==='POST'){retained=error;return null;}throw error;}
  });
  if(retained)throw retained;return result;
 }
 async function fetchSnapshot(n,signal){
  const snapshot=await request({}, {signal},value=>companyChannelSnapshot(value,expected()));
  if(alive.current&&epoch.current===n){setData(snapshot);setNeedsRead(false);}return snapshot;
 }
 async function load(){
  if(busy||localRequest.current)return;const n=++epoch.current,abort=new AbortController();controller.current?.abort();controller.current=abort;setOpened(true);setBusy(true);setRetryAllowed(false);setNeedsRead(true);setDraft(null);setNotice('');
  try{await fetchSnapshot(n,abort.signal);}catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice(error.message+' La consulta no cambia la configuración.');}}
  finally{if(alive.current&&epoch.current===n)setBusy(false);}
 }
 function close(){if(busy||localRequest.current)return;epoch.current++;controller.current?.abort();payload.current=null;setRetryAllowed(false);setDraft(null);setData(null);setReceipt(null);setNeedsRead(true);setOpened(false);setNotice(attempt?'La referencia sigue guardada. Podés volver a comprobarla con tu acceso actual.':'');}
 function start(item,action,targetProjectId=''){
  if(busy||localRequest.current||locked||attempt||!recoveryReady||needsRead||!companyChannelCanAct(data,item,action))return;
  setDraft({action,connectionId:item.id,revision:item.revision,targetProjectId,reviewed:false});setReceipt(null);setNotice('');
 }
 async function finish(result,n){
  reference.current=null;payload.current=null;setAttempt(null);setRetryAllowed(false);setDraft(null);setNeedsRead(true);
  setReceipt({id:result.receiptId,action:result.action,state:result.state,actorId:result.actor.id,organizationId:result.organization.id});
  setNotice(result.state==='REJECTED'?companyChannelExplain(result.code)+' El rechazo quedó registrado; la acción no se aplicó.':'Configuración registrada con recibo. Consultando el canal vigente…');
  try{await fetchSnapshot(n);if(alive.current&&epoch.current===n)setNotice(result.state==='REJECTED'?companyChannelExplain(result.code)+' El rechazo quedó registrado; la acción no se aplicó. Estado actual consultado.':'Configuración registrada con recibo. Estado actual consultado.');}catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice('El resultado tiene un recibo confirmado. Volvé a consultar el canal con tu acceso vigente antes de otra decisión.');}}
 }
 async function dispatch(snapshot,retrying=false){
  if(!snapshot||snapshot.reference.scope!==scope||snapshot.reference.projectId!==projectId||busy||localRequest.current||locked||!recoveryReady||retrying&&(!retryAllowed||payload.current!==snapshot||reference.current?.operationId!==snapshot.reference.operationId||!data?.canManage||data.actor.id!==snapshot.actorId||data.organization.id!==snapshot.organizationId))return;
  const n=++epoch.current;localRequest.current=true;reference.current=snapshot.reference;payload.current=snapshot;setAttempt(snapshot.reference);setBusy(true);setRetryAllowed(false);setNotice('');
  try{
   const result=await request({},snapshot.options,value=>companyChannelOutcome(value,snapshot.expected,{post:true}));
   if(!recoveryResult(snapshot.reference,result))throw new Error('No se pudo correlacionar el recibo con este intento. Conservamos su referencia.');
   if(alive.current&&epoch.current===n)await finish(result,n);
  }catch(error){
   if(error.requestDispatched===false){try{const entry=(await browserRecoveryJournal.list(scope)).find(row=>row.resource==='company-channel');if(alive.current&&epoch.current===n){reference.current=entry||null;setAttempt(entry||null);if(!entry||entry.operationId!==snapshot.reference.operationId)payload.current=null;}}catch{if(alive.current&&epoch.current===n)setRecoveryReady(false);}}
   if(alive.current&&epoch.current===n){hideDenied(error);setNotice(error.requestDispatched===false?error.message+' La operación no se envió. La referencia anterior, si existe, se conserva.':'La confirmación no llegó. Comprobá el resultado con tus permisos actuales antes de otra decisión.');}
  }
  finally{localRequest.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refreshReferences.current();}}
 }
 async function save(event){
  event.preventDefault();if(busy||localRequest.current||locked||attempt||!recoveryReady||needsRead||!draft?.reviewed)return;
  let command;try{command={...companyChannelCommand(data,draft,expected()),operationId:crypto.randomUUID()};}catch(error){setNotice(error.message);setDraft(old=>old?{...old,reviewed:false}:old);return;}
  const ref=referenceOf(command),body=JSON.stringify(command);
  await dispatch({reference:ref,expected:{...expected(),operationId:command.operationId,action:command.action,connectionId:command.payload.connectionId},actorId:data.actor.id,organizationId:data.organization.id,options:{method:'POST',headers:{'Content-Type':'application/json'},body,requestTimeoutMs:20000}});
 }
 async function recover(){
  if(busy||localRequest.current||!attempt)return;const n=++epoch.current,ref=attempt;localRequest.current=true;setBusy(true);setRetryAllowed(false);setNotice('');
  try{
   const snapshot=payload.current;
   const result=await request({scope:ref.scope,projectId:ref.projectId,operationId:ref.operationId},{requestTimeoutMs:15000},value=>companyChannelOutcome(value,{...expected(),scope:ref.scope,projectId:ref.projectId,operationId:ref.operationId,action:ref.action,connectionId:ref.connectionId}));
   const outcome=recoveryResult(ref,result);if(!outcome)throw new Error('La respuesta no confirma este intento. Conservamos su referencia.');
   if(alive.current&&epoch.current===n){
    if(['RECORDED','REJECTED'].includes(outcome.state))await finish(result,n);
    else if(outcome.state==='NOT_OBSERVED'){
     setRetryAllowed(Boolean(snapshot&&snapshot.reference.operationId===ref.operationId&&snapshot.reference.scope===scope&&snapshot.reference.projectId===projectId&&data?.canManage&&snapshot.actorId===data.actor.id&&snapshot.organizationId===data.organization.id));
     setNotice('Todavía no se observa un recibo. Esto no confirma que el envío se haya perdido; la referencia se conserva y otro intento sigue bloqueado.');
    }else throw new Error('El intento sigue sin confirmar.');
   }
  }catch(error){if(alive.current&&epoch.current===n){hideDenied(error);setNotice(error.message+' Conservamos la referencia para volver a comprobar.');}}
  finally{localRequest.current=false;if(alive.current&&epoch.current===n){setBusy(false);void refreshReferences.current();}}
 }
 const disabled=busy||locked||!recoveryReady||Boolean(attempt)||needsRead;
 const selected=data?.channels.find(item=>item.id===draft?.connectionId),target=data?.projects.find(item=>item.id===draft?.targetProjectId);
 const targets=draft&&selected?data.projects.filter(project=>draft.action==='REVOKE'?selected.assignments.some(row=>row.projectId===project.id&&row.status==='ACTIVE'):!selected.assignments.some(row=>row.projectId===project.id&&row.status==='ACTIVE')):[];
 return <section className={styles.panel} aria-labelledby="company-channel-title" aria-busy={busy} data-company-channel>
  <div className={styles.heading}><div><p className={styles.eyebrow}>CANAL Y OBRAS</p><h3 id="company-channel-title"><MessageCircle size={21} aria-hidden="true"/>WhatsApp para varias obras</h3><p className={styles.intro}>Consultá el número, su obra de origen y las obras que puede ofrecer a cada participante autorizado.</p></div><button type="button" disabled={busy} onClick={opened?close:load}>{opened?'Cerrar consulta':'Consultar canal'}</button></div>
  <p className={notice?styles.notice:styles.silent} role="status" aria-live="polite">{notice}</p>
  {!opened&&attempt&&<p className={styles.note}>Hay un intento por comprobar. Su referencia sigue guardada; abrir la consulta no vuelve a enviarlo.</p>}
  {opened&&<>
   <div className={styles.actions}><button type="button" disabled={busy} onClick={load}><RefreshCw size={16} aria-hidden="true"/>Actualizar canales</button><a href="#participant-title">Revisar participantes de esta obra</a></div>
   <p className={styles.note}>La asignación individual se revisa en Participantes y permisos. Este panel relaciona el canal con obras; no crea una identidad ni vincula el número de otra persona.</p>
   {attempt&&<div className={styles.recovery}><h4><TriangleAlert size={18} aria-hidden="true"/>Intento pendiente de comprobación</h4><p>Obra del intento: <strong>{data?.projects.find(item=>item.id===attempt.projectId)?.name||attempt.projectId}</strong></p><p>Referencia: <code>{attempt.operationId}</code></p><div className={styles.actions}><button type="button" disabled={busy} onClick={recover}>Comprobar resultado</button>{retryAllowed&&<button type="button" disabled={busy||locked||!recoveryReady||!data?.canManage} onClick={()=>dispatch(payload.current,true)}>Reintentar los mismos datos</button>}</div><p>Podés cerrar la consulta y actualizar tu acceso o cambiar de obra. La referencia permanece guardada y podés volver a consultarla; cerrar no habilita otro envío.</p></div>}
   {!recoveryReady&&<p className={styles.warning}>No se pudo comprobar el almacenamiento de referencias. Podés consultar, pero las decisiones quedan bloqueadas.</p>}
   {data&&<>
    <dl className={styles.context}><div><dt><Building2 size={16} aria-hidden="true"/>Empresa</dt><dd>{data.organization.name}<small>Referencia: {data.organization.id}</small></dd></div><div><dt><ShieldCheck size={16} aria-hidden="true"/>Acceso actual</dt><dd>{data.canManage?'Administrador':'Sólo consulta'}<small>Cuenta: {data.actor.id}</small></dd></div></dl>
    {!data.schemaReady&&<p className={styles.warning}>La configuración de canales de empresa todavía no está disponible en este entorno. Podés consultar las conexiones existentes; ninguna acción se aplicó.</p>}
    {data.truncated&&<p className={styles.warning}>Se muestran hasta 100 canales, obras y asignaciones. La lista está incompleta; asignar o activar queda bloqueado hasta revisar el catálogo completo.</p>}
    {!data.canManage&&<p className={styles.note}>Tu acceso permite consultar. Un administrador con permiso vigente debe revisar y confirmar cambios del canal.</p>}
    <div className={styles.capabilities}><strong>Alcance del canal de empresa</strong><p>Cada operación requiere un participante aprobado, permiso vigente y vinculación individual para la obra elegida. {data.capabilities.media?'Hay canales activos que admiten jornada, tareas, evidencias privadas, incidencias, pedidos de materiales y propuestas de consumo o avance. Las evidencias y propuestas requieren revisión humana; enviar un mensaje no aprueba el avance ni descuenta stock.':'Las operaciones de empresa por WhatsApp no están disponibles en los canales consultados.'} {data.capabilities.kyc?'La captura privada de identidad requiere invitación comprobada y código del responsable para una obra concreta. La persona acepta su cuenta en Clerk y otro responsable revisa las imágenes antes de vincular WhatsApp.':'La captura privada de identidad por este canal no está disponible en el estado consultado.'} Flows, plantillas, avisos proactivos y datos bancarios por chat siguen cerrados.</p><small>El soporte del canal no otorga permisos individuales. La configuración interna no acredita entrega ni aceptación en campo.</small></div>
    {data.channels.length===0?<div className={styles.empty}><strong>No hay canales visibles para esta obra.</strong><p>Consultá la conexión de WhatsApp con el responsable de la empresa.</p></div>:<div className={styles.channels}>{data.channels.map(item=><article className={styles.channel} key={item.id} data-channel-id={item.id}><div className={styles.channelHeading}><h4>{item.displayPhoneNumber||'Número no informado'}</h4><span className={styles.badge}>{item.mode==='COMPANY'&&!item.capabilities.media?'Configurado · operaciones no disponibles':COMPANY_CHANNEL_MODES[item.mode]}</span></div><p className={styles.anchor}>Origen: <strong>{item.anchorName}</strong></p><p className={styles.reference}>Canal {item.id} · Revisión {item.revision}</p><p className={styles.note} data-channel-support>{item.capabilities.media?'Operaciones de obra disponibles con permisos individuales vigentes. Captura privada de identidad mediante invitación y código, con aceptación de cuenta y revisión por otra persona; evidencias y propuestas también requieren revisión humana.':'Operaciones de empresa por WhatsApp no disponibles para este canal.'}</p><ul className={styles.assignments}>{item.assignments.map(assignment=><li key={assignment.projectId}><span>{assignment.projectName}<small>{assignment.status==='ACTIVE'?'Obra asignada':'Asignación revocada'}</small></span>{assignment.status==='ACTIVE'&&data.canManage&&<button type="button" disabled={disabled||!companyChannelCanAct(data,item,'REVOKE')} onClick={()=>start(item,'REVOKE',assignment.projectId)}>Revocar obra</button>}</li>)}</ul>{!item.assignments.length&&<p className={styles.note}>Todavía no hay obras asignadas a este canal de empresa.</p>}<div className={styles.actions}>{['PREPARE','ASSIGN','ACTIVATE','SUSPEND'].filter(action=>companyChannelCanAct(data,item,action)).map(action=><button type="button" key={action} disabled={disabled} onClick={()=>start(item,action)}>{actionLabels[action]}</button>)}</div></article>)}</div>}
   </>}
   {draft&&selected&&<form onSubmit={save} className={styles.review} aria-labelledby="company-channel-review-title"><h4 id="company-channel-review-title" tabIndex={-1} ref={editor}>Revisar: {actionLabels[draft.action]}</h4><dl><div><dt>Empresa</dt><dd>{data.organization.name}</dd></div><div><dt>Canal</dt><dd>{selected.displayPhoneNumber||selected.id}</dd></div><div><dt>Obra de origen</dt><dd>{selected.anchorName}</dd></div><div><dt>Revisión consultada</dt><dd>{draft.revision}</dd></div></dl>
    {['ASSIGN','REVOKE'].includes(draft.action)&&<label className={styles.field}>Obra destino<select required value={draft.targetProjectId} disabled={disabled} onChange={event=>setDraft(old=>({...old,targetProjectId:event.target.value,reviewed:false}))}><option value="">Elegí una obra explícitamente</option>{targets.map(project=><option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}
    <p>{draft.action==='PREPARE'?'La conexión y su obra de origen se conservan. Preparar registra el canal para revisar sus asignaciones; todavía no lo activa.':draft.action==='ASSIGN'?`El canal podrá ofrecer ${target?.name||'la obra elegida'} sólo a sus participantes aprobados y vinculados con permiso vigente.`:draft.action==='REVOKE'?`Se revocará la relación de este canal con ${target?.name||'la obra elegida'}. El origen y los registros históricos se conservan.`:draft.action==='ACTIVATE'?'La activación se confirma sólo si las asignaciones, participantes y registros pendientes permiten usar el canal de empresa. No envía mensajes por sí sola.':'La suspensión afecta el canal de empresa para todas sus obras asignadas. Los registros y referencias se conservan.'}</p>
    {['ASSIGN','REVOKE'].includes(draft.action)&&<p className={styles.note}>Revisá los participantes de la obra destino en Participantes y permisos. Para abrir otra obra, cancelá este borrador primero.</p>}
    <label className={styles.checkbox}><input type="checkbox" checked={draft.reviewed} disabled={disabled||['ASSIGN','REVOKE'].includes(draft.action)&&!target} onChange={event=>setDraft(old=>({...old,reviewed:event.target.checked}))}/><span>Revisé el canal, la obra y el alcance de esta decisión. Confirmo con mi acceso actual.</span></label><div className={styles.actions}><button type="submit" className={styles.primary} disabled={disabled||!draft.reviewed||['ASSIGN','REVOKE'].includes(draft.action)&&!target}>Confirmar decisión</button><button type="button" disabled={busy||Boolean(attempt)} onClick={()=>{setDraft(null);setNotice('');}}>Cancelar borrador</button></div>
   </form>}
   {receipt&&<p className={styles.receipt}>Recibo {receipt.state==='REJECTED'?'de rechazo':'confirmado'}: <code>{receipt.id}</code><small>Decisión: {actionLabels[receipt.action]} · Consulta con cuenta {receipt.actorId} · Empresa {receipt.organizationId}</small></p>}
  </>}
 </section>;
}
