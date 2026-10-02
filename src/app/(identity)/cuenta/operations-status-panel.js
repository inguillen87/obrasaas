'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import styles from './operations-status-panel.module.css';
const names={'site.register.changed':'Registro de obra','site.purchase.changed':'Compra o recepción','participant.operation.recorded':'Acceso o identidad','field.operation.recorded':'Jornada, evidencia o avance','field.media.recorded':'Archivo privado o procesamiento','meta.field.dispatched':'Actividad de campo recibida por WhatsApp','worker.channel.identity.recorded':'Vinculación de identidad al canal','integration.whatsapp.customer_state':'Autorización WhatsApp','integration.whatsapp.customer.activated':'Canal de WhatsApp habilitado','integration.whatsapp.customer.deactivated':'Canal de WhatsApp desactivado','integration.whatsapp.inbox.reviewed':'Revisión de un mensaje recibido','integration.whatsapp.inbox.classified':'Mensaje recibido clasificado','task.schedule.reviewed':'Fechas de tarea','task.created.from_workspace':'Nueva tarea'};
const count=value=>Number.isInteger(value)&&value>=0?value:'Sin dato';
function Metrics({rows}){return <dl className={styles.metrics}>{rows.map(([title,value])=><div key={title}><dt>{title}</dt><dd>{count(value)}</dd></div>)}</dl>;}
const date=value=>new Date(/Z$|[+-]\d\d:\d\d$/.test(value||'')?value:value+'Z').toLocaleString('es-AR');
function OperationsStatusPanelInner({projectId,scope,getSessionToken}) {
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),alive=useRef(true),request=useRef(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;request.current?.abort();};},[]);
 async function load() {
  if(busy)return;setBusy(true);setNotice('');const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),15000);
  try{const result=await sessionRequest('/api/identity/operations-status?'+new URLSearchParams({projectId,scope}),{signal:controller.signal,requestTimeoutMs:15000},async r=>{const value=await r.json();if(!r.ok)throw new Error('No se pudo consultar el estado con los permisos actuales. Volvé a intentar desde esta obra.');return value;});
   if(result.scope!==scope||result.projectId!==projectId)throw new Error('No se pudo consultar el estado con los permisos actuales. Volvé a intentar desde esta obra.');
   if(alive.current)setData(result);
  }catch(e){if(alive.current){setData(null);setNotice(e.name==='AbortError'?'La consulta no se completó. Podés volver a intentar.':e.message);}}finally{clearTimeout(timeout);if(alive.current)setBusy(false);}
 }
 return <section className={styles.panel} aria-labelledby="operation-status-title"><div className={styles.heading}><div><p className={styles.eyebrow}>SEGUIMIENTO DE ESTA OBRA</p><h3 id="operation-status-title">Pendientes y actividad</h3></div><button type="button" onClick={load} disabled={busy}>{data?'Actualizar estado':'Consultar estado'}</button></div>
  <p className={styles.caption}>Revisá las decisiones pendientes y el recorrido de los mensajes. El envío, la entrega y la lectura informados por WhatsApp se muestran por separado de los registros guardados en la obra.</p>
  <p role="status" aria-live="polite">{busy?'Consultando estado…':notice}</p>
  {data&&<><p className={styles.observed}>Consulta: {date(data.observedAt)}. La aceptación con participantes reales sigue pendiente de comprobación.</p><div className={styles.records}>
   <article><h4>Decisiones de la obra</h4><Metrics rows={[
    ['Participantes con acceso vigente',data.people.active],['Identidades por revisar',data.people.kycPending],['Invitaciones sin confirmar',data.people.invitationUncertain],['Fichajes por revisar',data.attendance.pending],['Evidencias por revisar',data.reports.evidencePending],['Avances por decidir',data.proposals.pending],['Compras por autorizar',data.reports.purchasesPending],['Pedidos de material abiertos',data.reports.requestsOpen],['Incidencias abiertas',data.reports.issuesOpen],
   ]}/></article>
   <article><h4>Archivos privados</h4><Metrics rows={[
    ['Pendientes de procesamiento',data.reports.processingQueued],['En procesamiento',data.reports.processingRunning],['Procesamiento sin confirmar; admite revisión o reintento',data.reports.processingFailed],['Videos pendientes de revisión humana',data.reports.manualReviewPending],
   ]}/><p>Una falla de procesamiento conserva el archivo privado. Los análisis y las transcripciones requieren revisión; el video lo revisa una persona.</p></article>
   <article><h4>Mensajes recibidos por WhatsApp</h4>{data.channel?.inbox?<><Metrics rows={[
    ['Eventos recibidos del canal de esta obra',data.channel.inbox.total],['Sin completar',data.channel.inbox.pending],['En procesamiento',data.channel.inbox.processing],['Procesamiento interrumpido; plazo vencido',data.channel.inbox.staleLease],['Con error pendiente de recuperación',data.channel.inbox.retryableErrors],['Eventos que requieren revisar autenticidad',data.channel.inbox.proofReviewRequired],['Procesamiento completado',data.channel.inbox.processed],['Con una operación guardada en la obra',data.channel.inbox.businessApplied],
   ]}/><p>Los eventos que requieren revisar autenticidad quedan para revisión y no se recuperan automáticamente. Los estados de entrega también llegan como eventos. Completar su recepción no confirma una operación de campo ni la identidad de quien escribe.</p></>:<p>No se pudo informar el recorrido de recepción. Actualizá esta consulta.</p>}</article>
   <article><h4>Respuestas enviadas por WhatsApp</h4>{data.channel?.outbound?<><Metrics rows={[
    ['Respuestas reservadas para este canal',data.channel.outbound.total],['Sin completar el envío',data.channel.outbound.pending],['Envío en curso',data.channel.outbound.processing],['Intentos interrumpidos; plazo vencido',data.channel.outbound.staleLease],['Envío sin confirmar',data.channel.outbound.unknown],['Envío confirmado por el proveedor',data.channel.outbound.sent],['Entrega informada por el proveedor',data.channel.outbound.delivered],['Lectura informada por el proveedor',data.channel.outbound.read],['Rechazadas, fallidas o eliminadas',data.channel.outbound.rejected],
   ]}/><p>Una respuesta sin confirmar puede haber salido. No se reenvía automáticamente. La entrega o lectura informada por el proveedor no acredita aceptación humana del circuito.</p></>:<p>No se pudo informar el recorrido de respuestas. Actualizá esta consulta.</p>}</article>
  </div><details className={styles.history}><summary>Últimas operaciones ({data.history.length})</summary>{data.history.length?<ol>{data.history.map(r=><li key={r.id}>{names[r.action]||'Operación registrada'} · {date(r.recordedAt)}<br/><small>Recibo: {r.id}</small></li>)}</ol>:<p>No hay recibos de operación para esta obra.</p>}</details></>}
 </section>;
}
export function OperationsStatusPanel(props){return <OperationsStatusPanelInner key={props.projectId+':'+props.scope} {...props}/>;}
