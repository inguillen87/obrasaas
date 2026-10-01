'use client';
import {useEffect,useRef,useState} from 'react';
import styles from './site-purchase-panel.module.css';
const names={'site.register.changed':'Registro de obra','site.purchase.changed':'Compra o recepción','participant.operation.recorded':'Acceso o identidad','field.operation.recorded':'Jornada, evidencia o avance','integration.whatsapp.customer_state':'Autorización WhatsApp','task.schedule.reviewed':'Fechas de tarea','task.created.from_workspace':'Nueva tarea'};
export function OperationsStatusPanel({projectId,scope}) {
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function load() {
  if(busy)return;setBusy(true);setNotice('');
  try{const r=await fetch('/api/identity/operations-status?'+new URLSearchParams({projectId,scope}),{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)}),result=await r.json();
   if(!r.ok||result.scope!==scope||result.projectId!==projectId)throw new Error('No se pudo consultar el estado con los permisos actuales.');
   if(alive.current)setData(result);
  }catch(e){if(alive.current){setData(null);setNotice(e.message);}}finally{if(alive.current)setBusy(false);}
 }
 return <section className={styles.panel} aria-labelledby="operation-status-title"><div className={styles.heading}><div><p className={styles.eyebrow}>SEGUIMIENTO</p><h3 id="operation-status-title">Pendientes y actividad</h3></div><button type="button" onClick={load} disabled={busy}>{data?'Actualizar estado':'Consultar estado'}</button></div>
  <p className={styles.caption}>Revisá lo que necesita una decisión y los últimos recibos de esta obra. Estos registros permiten seguir la operación; la aceptación con participantes reales se comprueba por separado.</p>
  <p role="status" aria-live="polite">{busy?'Consultando estado…':notice}</p>
  {data&&<><div className={styles.records}><article><dl><dt>Participantes con acceso vigente</dt><dd>{data.people.active}</dd><dt>Identidades por revisar</dt><dd>{data.people.kycPending}</dd><dt>Invitaciones sin confirmar</dt><dd>{data.people.invitationUncertain}</dd><dt>Fichajes por revisar</dt><dd>{data.attendance.pending}</dd><dt>Evidencias por revisar</dt><dd>{data.reports.evidencePending}</dd><dt>Avances por decidir</dt><dd>{data.proposals.pending}</dd><dt>Compras por autorizar</dt><dd>{data.reports.purchasesPending}</dd><dt>Incidencias abiertas</dt><dd>{data.reports.issuesOpen}</dd></dl></article>
   <article><strong>Recepción de eventos del canal</strong>{data.webhooks.length?<ul>{data.webhooks.map(r=><li key={r.state}>{r.state}: {r.count}</li>)}</ul>:<p>No hay eventos recibidos para esta obra.</p>}</article></div>
   <details><summary>Últimas operaciones ({data.history.length})</summary>{data.history.length?<ol>{data.history.map(r=><li key={r.id}>{names[r.action]||'Operación registrada'} · {r.recordedAt}<br/><small>Recibo: {r.id}</small></li>)}</ol>:<p>No hay recibos de operación para esta obra.</p>}</details>
  </>}
 </section>;
}
