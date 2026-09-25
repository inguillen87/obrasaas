'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { evidenceScopeHeaders } from '@/lib/evidence-capture-policy';
import { flowReplyMatches } from '@/lib/whatsapp/proactive-flow-reply-policy';
import FlowAttendanceView from './flow-attendance-view';
import styles from './proactive-flow-reply.module.css';
const formatDate = value => new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export default function ProactiveFlowReply(props) {
  return <ScopedReply key={[props.organizationId,props.projectId,props.conversationId,props.sourceMessageId,props.observedAt].join(':')} {...props}/>;
}
function ScopedReply({organizationId,projectId,conversationId,sourceMessageId,online=true}) {
  const regionId=useId(),alive=useRef(true),active=useRef(null);
  const [open,setOpen]=useState(false),[phase,setPhase]=useState('idle'),[result,setResult]=useState(null),[error,setError]=useState('');
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;active.current?.abort();active.current=null;};},[]);
  async function load() {
    if(!online||active.current)return;
    const controller=new AbortController();active.current=controller;
    setOpen(true);setPhase('loading');setError('');setResult(null);
    const timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const params=new URLSearchParams({projectId,mode:'reply',messageId:sourceMessageId});
      const response=await fetch('/api/whatsapp/inbox/'+encodeURIComponent(conversationId)+'/proactive-flows?'+params,{method:'GET',cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',...evidenceScopeHeaders({organizationId,projectId})}});
      const payload=await response.json().catch(()=>null);
      if(!response.ok)throw Object.assign(new Error('No se pudo consultar la respuesta vinculada.'),{status:response.status});
      if(!flowReplyMatches(payload,{organizationId,projectId,conversationId},sourceMessageId))throw new Error('La respuesta recibida no corresponde al envío consultado.');
      if(alive.current&&active.current===controller){setResult(payload);setPhase('ready');}
    }catch(failure){if(alive.current&&active.current===controller){setResult(null);setPhase([401,402,403,404].includes(failure.status)?'blocked':'error');setError(failure.name==='AbortError'?'La consulta demoró. Podés volver a consultar; no se reenviará el formulario.':failure.message);}}
    finally{clearTimeout(timeout);if(active.current===controller)active.current=null;}
  }
  function close(){active.current?.abort();active.current=null;setOpen(false);setResult(null);setError('');setPhase('idle');}
  return <section className={styles.reply} aria-label="Respuesta vinculada al formulario">
    <div className={styles.actions}><button type="button" onClick={load} disabled={!online||phase==='loading'||phase==='blocked'} aria-expanded={open} aria-controls={regionId}>{open?'Actualizar respuesta':'Consultar respuesta vinculada'}</button>{open&&<button type="button" onClick={close}>Cerrar respuesta</button>}</div>
    {open&&<div id={regionId} className={styles.panel} aria-busy={phase==='loading'}>
      {phase==='loading'&&<p role="status">Comprobando el envío, su sesión y el mensaje recibido…</p>}
      {error&&<p role="alert" className={styles.notice}>{error}</p>}
      {phase==='ready'&&online&&result&&<>
        <p className={styles.caption}>Consulta: {formatDate(result.observedAt)} · Fechas en hora de este dispositivo.</p>
        {result.state==='available'?<><strong className={styles.verified}>Origen de la respuesta verificado</strong><p className={styles.body}>{result.reply.body||'El mensaje no tiene texto operativo conservado.'}</p><dl><div><dt>Mensaje recibido</dt><dd>{result.reply.messageId}</dd></div><div><dt>Registrado en la bandeja</dt><dd><time dateTime={result.reply.recordedAt}>{formatDate(result.reply.recordedAt)}</time></dd></div><div><dt>Respuesta procesada</dt><dd><time dateTime={result.reply.processedAt}>{formatDate(result.reply.processedAt)}</time></dd></div></dl></>
          :<p role="status" className={styles.notice}>{result.state==='not_recorded'?'La consulta actual no encontró una respuesta procesada para esta sesión. No se infiere recepción ni se reenvía el formulario.':'No se pudo vincular un mensaje visible con certeza. Puede no estar disponible o sus datos no ser consistentes; no se busca por nombre, teléfono ni cercanía de fechas.'}</p>}
        {result.attendanceAvailable === true && <FlowAttendanceView organizationId={organizationId} projectId={projectId} conversationId={conversationId} sourceMessageId={sourceMessageId} online={online}/>}
        <p className={styles.disclaimer}>Esta consulta comprueba el mensaje de origen; no certifica un parte, fichaje, incidencia o pago aprobado. Los datos privados siguen sujetos a las restricciones de la bandeja. No se ejecutó ninguna acción de obra.</p>
      </>}
      {!online&&<p role="status" className={styles.notice}>Sin conexión. Volvé a consultar antes de utilizar esta información.</p>}
    </div>}
  </section>;
}
