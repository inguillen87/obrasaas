'use client';
import { useRef, useState } from 'react';
import { tokens } from '@/lib/design-system';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import styles from './platform-preflight-panel.module.css';
const LABELS={prepared:'Preparada',sending:'Enviando',accepted:'Aceptada por Meta',sent:'Enviada',delivered:'Entregada',read:'Leída',failed:'Fallida',unknown:'Sin confirmar'};
export default function PilotChannelProofPanel({organizationId,projectId,targets}) {
 const [target,setTarget]=useState(''),[snapshot,setSnapshot]=useState(null),[receipt,setReceipt]=useState(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[uncertain,setUncertain]=useState(false);
 const lock=useRef(false),attempt=useRef(null);
 const choices=targets.flatMap(t=>t.projects.map(p=>({id:p.id,organizationId:t.organizationId,label:t.organizationName+' · '+p.name})));
 const css={'--preflight-bg':tokens.colors.bg.secondary,'--preflight-border':tokens.colors.border.default,'--preflight-accent':tokens.colors.accent.primary,'--preflight-text':tokens.colors.text.primary,'--preflight-muted':tokens.colors.text.secondary};
 function select(value){if(lock.current||uncertain)return;setTarget(value);setSnapshot(null);setReceipt(null);setError('');setConfirmed(false);attempt.current=null;}
 async function run(write=false){
  if(lock.current||!target||(!write&&uncertain)||write&&!confirmed&&!uncertain)return;
  if(write&&!attempt.current){if(!snapshot?.inbound?.canReply)return;attempt.current={projectId:target,connectionId:snapshot.connectionId,inboundId:snapshot.inbound.id,confirmSend:true};}
  lock.current=true;setBusy(true);setError('');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),55000);
  try{
   const response=await fetch('/api/integrations/whatsapp/pilot-proof'+(write?'':'?projectId='+encodeURIComponent(target)),{method:write?'POST':'GET',cache:'no-store',signal:controller.signal,headers:{...evidenceScopeHeaders({organizationId,projectId}),...(write?{'Content-Type':'application/json'}:{})},...(write?{body:JSON.stringify(attempt.current)}:{})});
   const data=await response.json().catch(()=>null);
   if(!response.ok){const failure=new Error(data?.error||'Comprobación no confirmada.');failure.status=response.status;throw failure;}
   if(data?.projectId!==target||data.organizationId!==choices.find(c=>c.id===target)?.organizationId||data.workersAuthorizedByThisAction!==false)throw new Error('El resultado no coincide con el piloto seleccionado.');
   if(write){if(data.inboundId!==attempt.current.inboundId||data.connectionId!==attempt.current.connectionId||!data.reply?.id||!Object.hasOwn(LABELS,data.reply.status))throw new Error('No se confirmó el mensaje. Verificá el mismo intento.');setReceipt(data.reply);setUncertain(false);setConfirmed(false);attempt.current=null;}
   else{if(!data.connectionId||data.inbound&&(!data.inbound.id||!/^\d{4}$/.test(data.inbound.contactLast4)))throw new Error('Estado del canal incompleto.');setSnapshot(data);setReceipt(data.reply);setConfirmed(false);}
  }catch(failure){if(write){setUncertain(!failure.status||failure.status>=500);if(failure.status&&failure.status<500)attempt.current=null;}else if([401,403,404,409].includes(failure.status)){setSnapshot(null);setReceipt(null);}setError(failure.name==='AbortError'?'La respuesta demoró. Un envío podría haberse realizado; verificá el mismo intento.':failure.message);}
  finally{clearTimeout(timer);lock.current=false;setBusy(false);}
 }
 return <section className={styles.panel} style={css} aria-labelledby="pilot-proof-heading">
  <header className={styles.header}><div><span>PRUEBA REAL · NÚMERO PILOTO</span><h2 id="pilot-proof-heading">Recepción y respuesta verificables</h2><p>La conexión no basta. Comprobá un mensaje recibido y una respuesta registrada por el backend.</p></div></header>
  <div className={styles.pilotForm}><label>Empresa y obra para la prueba<select aria-label="Empresa y obra para la prueba" value={target} disabled={busy||uncertain} onChange={e=>select(e.target.value)}><option value="">Seleccioná tu piloto</option>{choices.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
   <button type="button" disabled={!target||busy||uncertain} onClick={()=>run(false)}>{busy?'Verificando…':'Comprobar recepción y estado'}</button></div>
  {choices.length===0&&<p className={styles.scope}>Primero prepará la empresa piloto. Sólo se admiten destinos con membresía administrativa vigente.</p>}
  {snapshot&&<div className={styles.results}>
   <article><h3>1 · Número vinculado</h3><strong>{snapshot.sender||'Número verificado'}</strong><p>{snapshot.projectName}</p></article>
   <article><h3>2 · Mensaje recibido</h3>{snapshot.inbound?<><strong>Registrado en esta obra</strong><p>Remitente terminado en {snapshot.inbound.contactLast4}. No se otorgan permisos laborales por recibir el mensaje.</p></>:<><strong>Sin mensajes registrados</strong><p>Escribí desde el celular autorizado al número piloto y volvé a comprobar.</p></>}</article>
   <article><h3>3 · Respuesta del backend</h3><strong>{receipt?LABELS[receipt.status]||'Sin confirmar':'Todavía no enviada'}</strong><p>“Aceptada” no equivale a “entregada”. El estado se consulta desde los registros y eventos de Meta.</p></article>
  </div>}
  {snapshot?.inbound&&!receipt&&<div className={styles.pilotForm}>
   <label className={styles.pilotConsent}><input type="checkbox" disabled={busy||uncertain||!snapshot.inbound.canReply} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo enviar una única respuesta técnica al remitente terminado en {snapshot.inbound.contactLast4}, dentro de esta obra piloto.</label>
   <button type="button" disabled={busy||!confirmed&&!uncertain||!snapshot.inbound.canReply} onClick={()=>run(true)}>{uncertain?'Verificar el mismo envío':'Enviar respuesta de prueba'}</button>
   {!snapshot.inbound.canReply&&<p>La ventana de respuesta no está abierta. El contacto debe enviar un mensaje nuevo; no se envían plantillas automáticamente.</p>}
  </div>}
  {receipt&&<p role="status" className={styles.scope}>Respuesta registrada: {LABELS[receipt.status]||'Sin confirmar'}. Usá “Comprobar recepción y estado” para actualizar la entrega.</p>}
  {error&&<p role="alert" className={styles.error}>{error}</p>}
  <p className={styles.scope}>La prueba usa el envío auditado de la bandeja y conserva su protección contra duplicados. No crea empleados, no cambia roles, no modifica tareas y no activa un agente autónomo. No es un envío desde la consola de Meta.</p>
 </section>;
}
