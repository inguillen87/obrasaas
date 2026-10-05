'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {customerInboxAccessDenied,customerInboxSnapshot,mergeCustomerInboxPages,customerInboxGroups,customerInboxSummary,customerInboxStage,customerInboxReply,customerInboxIdentity,customerInboxEventTitle,customerInboxReceipt} from './customer-inbox-view.mjs';
import styles from './customer-inbox-panel.module.css';
const endpoint='/api/identity/meta-onboarding';
const decisions={OBSERVED:'Tomar conocimiento',REFER_TO_PARTICIPANTS:'Revisar participantes e identidad',REFER_TO_FIELD:'Revisar con el responsable de la obra'};
const errors={SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.',WORKSPACE_CONTEXT_CHANGED:'Cambió el contexto de la obra. Volvé a consultarla desde tu cuenta.',WORKSPACE_PROJECT_UNAVAILABLE:'La obra ya no está disponible con tu acceso actual. Volvé a consultar cuando se restablezca.',WORKSPACE_MEMBERSHIP_REQUIRED:'La pertenencia a esta empresa no está vigente.',WORKSPACE_INTEGRATION_PERMISSION_REQUIRED:'Tu acceso no permite consultar esta bandeja privada.',META_CUSTOMER_INBOX_REVISION_CHANGED:'El evento cambió. Actualizá la bandeja y revisá su estado antes de iniciar otra decisión.',META_CUSTOMER_INBOX_ALREADY_REVIEWED:'Este evento ya tiene un seguimiento. Consultá el estado vigente.',META_CUSTOMER_INBOX_BUSY:'El evento se está procesando. Comprobá su estado cuando termine.',META_CUSTOMER_INBOX_PAYLOAD_UNVERIFIED:'No se pudo comprobar el contenido privado. Requiere revisar el almacenamiento.',META_CUSTOMER_INBOX_CURSOR_UNAVAILABLE:'La página dejó de estar disponible. Actualizá la bandeja desde los eventos recientes.'};
const date=value=>{const d=new Date(value);return value&&!Number.isNaN(d.getTime())?d.toLocaleString('es-AR'):'Fecha no disponible';};
export function CustomerInboxPanel({projectId,scope,getSessionToken,onPending}){
 const request=useWorkspaceRequest(getSessionToken),mounted=useRef(true),pendingCallback=useRef(onPending);
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[selected,setSelected]=useState(''),[filter,setFilter]=useState('ALL'),[query,setQuery]=useState(''),[decision,setDecision]=useState({}),[attempt,setAttempt]=useState(null),[stale,setStale]=useState(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{pendingCallback.current=onPending;},[onPending]);
 const dirty=Object.values(decision).some(Boolean);
 useEffect(()=>{pendingCallback.current?.(busy||Boolean(attempt)||dirty);return()=>pendingCallback.current?.(false);},[busy,attempt,dirty]);
  async function api(url,options={},validate=value=>value){
   let retainedError;
   const result=await request(url,options,async response=>{
    if(!response.ok){let value;try{value=await response.json();}catch{/* HTTP denials apply even when the body is HTML. */}const code=value?.code||(response.status===401?'SESSION_REQUIRED':undefined),error=Object.assign(new Error(errors[code]||(response.status===403?'Tu acceso no permite consultar esta bandeja privada. Volvé a consultar cuando se restablezca.':'No se pudo confirmar la consulta. Conservá el intento y comprobá su estado.')),{status:response.status,code});
     if(options.method==='POST'&&customerInboxAccessDenied(error)){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}throw error;
    }
    const value=await response.json();
    try{return validate(value);}catch(error){if(options.method==='POST'){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}throw error;}
   });
   if(retainedError)throw retainedError;return result;
  }
  function hideDenied(error){
   if(!customerInboxAccessDenied(error))return false;
   setData(null);setSelected('');setDecision({});setQuery('');setFilter('ALL');setStale(true);
   setAttempt(previous=>previous?{action:previous.action,operationId:previous.operationId,projectId:previous.projectId,scope:previous.scope,eventId:previous.eventId}:null);
   return true;
  }
 async function load(more=false){
  if(busy||attempt||dirty)return;setOpened(true);setBusy(true);setNotice('');
   try{const value=await api(endpoint+'?'+new URLSearchParams({projectId,scope,...(more&&data?.nextCursor?{after:data.nextCursor}:{})}),{requestTimeoutMs:15000},value=>customerInboxSnapshot(value,{projectId,scope}));if(!mounted.current)return;setData(prior=>more?mergeCustomerInboxPages(prior,value):value);setStale(false);if(!more)setSelected('');}
   catch(error){if(mounted.current){setStale(true);hideDenied(error);setNotice(error.message);}}finally{if(mounted.current)setBusy(false);}
 }
 async function verifyAttempt(command){
   const value=await api(endpoint+'?'+new URLSearchParams({projectId,scope,action:command.action,eventId:command.eventId,operationId:command.operationId}),{requestTimeoutMs:15000},value=>{customerInboxReceipt(value,command,{projectId,scope});customerInboxSnapshot(value,{projectId,scope});return value;});
  const receipt=customerInboxReceipt(value,command,{projectId,scope});if(!mounted.current)return false;
  if(receipt.state==='NOT_OBSERVED'){setNotice('Todavía no se observa el resultado confirmado. El intento se conserva y no se vuelve a enviar automáticamente.');return false;}
  setAttempt(null);setDecision({});setData(customerInboxSnapshot(value,{projectId,scope}));setSelected('');setStale(false);
  setNotice(receipt.state==='RECORDED'?'Seguimiento comprobado con su recibo. No aprueba avances ni modifica acciones de campo.':'El evento está procesado. Se comprobó su estado actual; esto no atribuye el resultado al identificador de tu solicitud.');return true;
 }
 async function command(action,item){
  if(busy||attempt||stale)return;const body={action,operationId:crypto.randomUUID(),projectId,scope,eventId:item.id,...(action==='review_inbox'?{expectedRevision:item.revision,decision:decision[item.id]}:{})};
  setAttempt(body);setBusy(true);setNotice('');let postResponse=false;
   try{await api(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),requestTimeoutMs:55000},value=>customerInboxSnapshot(value,{projectId,scope}));postResponse=true;if(mounted.current)await verifyAttempt(body);}
   catch(error){if(mounted.current){const denied=hideDenied(error);if(!postResponse&&!error.retainAttempt&&(error.requestDispatched===false||error.status&&error.status<500)){setAttempt(null);if(error.code==='META_CUSTOMER_INBOX_REVISION_CHANGED'||error.code==='META_CUSTOMER_INBOX_ALREADY_REVIEWED'){setDecision({});setStale(true);}setNotice(error.message);}else setNotice((denied?error.message+' ':'')+'El resultado quedó sin confirmar. Comprobá este mismo intento; no se vuelve a procesar ni se envía otra respuesta automáticamente.');}}finally{if(mounted.current)setBusy(false);}
 }
  async function recover(){if(!attempt||busy)return;setBusy(true);try{await verifyAttempt(attempt);}catch(error){if(mounted.current){setNotice(error.message);hideDenied(error);}}finally{if(mounted.current)setBusy(false);}}
 const groups=customerInboxGroups(data?.items||[],{filter,query}),current=groups.find(group=>group.key===selected),summary=customerInboxSummary(data?.items||[]),locked=busy||Boolean(attempt),messages=current?[...current.items].reverse():[];
 return <section className={styles.panel} aria-labelledby="customer-inbox-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>EQUIPO Y SEGUIMIENTO</p><h3 id="customer-inbox-title">Bandeja privada de WhatsApp</h3></div><button type="button" disabled={locked||dirty} onClick={()=>load()}>{opened?'Actualizar bandeja':'Abrir bandeja de mensajes'}</button></div>
  <p className={styles.intro}>Consultá lo recibido en esta obra y registrá el seguimiento del equipo. El teléfono agrupa mensajes; la identidad y los permisos se comprueban por separado.</p>
  <p role="status" aria-live="polite" className={styles.notice}>{notice}</p>
   {attempt&&<div className={styles.actions}><button type="button" disabled={busy} onClick={recover}>Comprobar este mismo intento</button>{!data&&<button type="button" disabled={busy} onClick={()=>{setAttempt(null);setNotice('Cerraste esta consulta. La referencia sigue en Operaciones por comprobar; no se declaró perdida ni se reenvió.');}}>Cerrar consulta y conservar referencia</button>}<p className={styles.note}>La comprobación consulta el resultado guardado. No reenvía mensajes.</p></div>}
  {opened&&data&&<>
   <div className={styles.context}><strong>{data.companyName}</strong><span>{data.projectName}</span></div>
   {!data.connectionPresent&&<p className={styles.empty}>Esta obra todavía no tiene una conexión cliente vinculada. La preparación y autorización se realizan en la sección de conexión.</p>}
   {data.connectionPresent&&!data.operational&&<p className={styles.note}>La conexión está guardada, pero la operación del canal sigue pendiente. Los eventos históricos no prueban que el canal esté habilitado hoy.</p>}
   <div className={styles.summary} aria-label="Eventos consultados"><span>{summary.total} eventos consultados</span><span>{summary.pending} pendientes</span><span>{summary.review} para revisar</span><span>{summary.recorded} con acción registrada</span></div>
   <p className={styles.note}>Los conteos y la búsqueda incluyen sólo los eventos que consultaste. Cada página trae hasta 20; no representan todos los contactos ni resultados de la empresa.</p>
   <div className={styles.filters}><label>Buscar en lo consultado<input type="search" maxLength={120} value={query} onChange={event=>{setQuery(event.target.value);setSelected('');}} placeholder="Texto o teléfono" disabled={locked}/></label><label>Estado<select value={filter} onChange={event=>{setFilter(event.target.value);setSelected('');}} disabled={locked}><option value="ALL">Todos los consultados</option><option value="PENDING">Pendientes</option><option value="REVIEW">Para revisar</option><option value="RECORDED">Acción registrada</option><option value="REVIEWED">Seguimiento registrado</option><option value="OBSERVED">Avisos observados</option></select></label></div>
   <div className={styles.layout}><div className={styles.contacts} aria-label="Remitentes y avisos consultados">{groups.map(group=><button type="button" key={group.key} aria-pressed={group.key===selected} disabled={locked} onClick={()=>setSelected(group.key)}><strong>{group.label}</strong><small>{group.items.length} eventos en esta consulta</small><small>{customerInboxStage(group.items[0]).label}</small></button>)}{!groups.length&&<p className={styles.empty}>{data.items.length?'No hay coincidencias en los eventos consultados.':'Todavía no hay eventos recibidos para esta conexión.'}</p>}</div>
    <div className={styles.timeline}>{current?<><h4>{current.label}</h4>{current.from&&<p className={styles.note}>Agrupación de lectura. La coincidencia telefónica no certifica identidad ni concede acceso.</p>}{messages.map(item=>{const reply=customerInboxReply(item);return <article className={styles.event} key={item.id}>
     <h5>{customerInboxEventTitle(item)}</h5><small>{date(item.createdAt)}</small><div><span className={styles.badge}>{customerInboxStage(item).label}</span></div>
     {item.body&&<p className={styles.body}>{item.body}</p>}{item.observation&&<p>{item.observation}</p>}
     <p className={styles.note}>{customerInboxIdentity(item)}</p>
     <dl className={styles.outcome}><div><dt>Acción de campo</dt><dd>{item.businessApplied?'Registrada; sus revisiones se consultan en la obra':'Sin acción registrada'}</dd></div><div><dt>Respuesta</dt><dd>{reply.acceptance}</dd></div><div><dt>Entrega</dt><dd>{reply.delivery}</dd></div></dl>
     {item.providerStatus&&<p>Estado comunicado por Meta: {item.providerStatus}.</p>}{item.hasLocation&&<p className={styles.note}>Recibir una ubicación no prueba precisión, sector ni asistencia.</p>}
     {!item.payloadVerified&&<p className={styles.notice}>El contenido privado no superó su verificación. No se ofrece procesarlo desde esta consulta.</p>}
     {['image','audio','video','document'].includes(item.kind)&&item.businessKind!=='EVIDENCE'&&<p className={styles.note}>El archivo recibido todavía no acredita evidencia procesada de la obra.</p>}
     {item.canProcess&&item.payloadVerified&&<button type="button" disabled={locked||stale||dirty} onClick={()=>command('process_inbox',item)}>Procesar evento recibido</button>}
     {item.canReview&&item.payloadVerified&&<div className={styles.review}><label>Seguimiento de este evento<select disabled={locked||stale} value={decision[item.id]||''} onChange={event=>setDecision(prior=>({...prior,[item.id]:event.target.value}))}><option value="">Elegí una acción</option>{Object.entries(decisions).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label><button type="button" disabled={locked||stale||!decision[item.id]} onClick={()=>command('review_inbox',item)}>Registrar seguimiento</button></div>}
     {item.reviewDecision&&<p>Seguimiento registrado: {decisions[item.reviewDecision]||'Consultar el registro vigente'}.</p>}
     {item.receiptId&&<small>Referencia de la acción: {item.receiptId}</small>}
    </article>;})}</>:<p className={styles.empty}>Elegí un remitente o los avisos de la cuenta para consultar sus eventos y resultados.</p>}</div>
   </div>
   <div className={styles.actions}>{data.nextCursor&&<button type="button" className={styles.secondary} disabled={locked||dirty||stale} onClick={()=>load(true)}>Consultar eventos anteriores</button>}{dirty&&<button type="button" className={styles.secondary} disabled={locked} onClick={()=>setDecision({})}>Cancelar selección de seguimiento</button>}</div>
   <div className={styles.links}><a href="#participant-title">Revisar participantes e identidad</a><a href="#field-title">Consultar jornada, evidencia y avance</a><a href="#site-register-title">Consultar incidencias y materiales</a></div>
  </>}
 </section>;
}
