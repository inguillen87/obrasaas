'use client';
import {useEffect,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,RECOVERY_RESOURCES,recoveryQuery,recoveryResult} from './workspace-recovery-journal.mjs';
import styles from './workspace.module.css';
import {templateSendNotice} from './template-send-view.mjs';

export function WorkspaceRecoveryPanel({scope,projects,getSessionToken,onRecovered}) {
  const request=useWorkspaceRequest(getSessionToken);
  const [entries,setEntries]=useState([]),[busy,setBusy]=useState(null),[messages,setMessages]=useState({}),[notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true,readSequence=0;
    const storageNotice='No se pueden consultar las referencias pendientes de este navegador. Revisá su almacenamiento antes de guardar otra operación.';
    const read=async()=>{const sequence=++readSequence;try{const rows=await browserRecoveryJournal.list(scope);if(active&&sequence===readSequence){setEntries(rows.filter(row=>projects.some(project=>project.id===row.projectId)));setNotice(previous=>previous===storageNotice?'':previous);}}catch{if(active&&sequence===readSequence)setNotice(storageNotice);}};
    const visible=()=>{if(document.visibilityState==='visible')void read();};
    let channel;
    if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel(RECOVERY_EVENT);channel.onmessage=event=>{if(event.data?.version===1&&event.data?.type==='invalidate')void read();};}catch{/* Focus and the local event remain available. */}}
    read();window.addEventListener(RECOVERY_EVENT,read);window.addEventListener('storage',read);window.addEventListener('focus',read);document.addEventListener('visibilitychange',visible);
    return()=>{active=false;channel?.close();window.removeEventListener(RECOVERY_EVENT,read);window.removeEventListener('storage',read);window.removeEventListener('focus',read);document.removeEventListener('visibilitychange',visible);};
  },[scope,projects]);
  async function check(entry) {
    if(busy)return;setBusy(entry.operationId);setNotice('');
    try {
      const result=await request(recoveryQuery(entry),{requestTimeoutMs:15000},async response=>{const body=await response.json();if(!response.ok)throw new Error('No se pudo comprobar con tus permisos actuales. Conservamos la referencia.');if(!recoveryResult(entry,body))throw new Error('El resultado no permite confirmar este intento. Conservamos la referencia.');return body;});
      const outcome=recoveryResult(entry,result);
      const message=outcome.state==='RECORDED'?'Guardado confirmado. La consulta no volvió a enviar la operación.':outcome.state==='EVENT_PROCESSED'?'El evento ya está procesado. Este estado no atribuye su procesamiento a tu intento; consultá el seguimiento en la bandeja.':outcome.state==='PARTICIPATION_REVOKED'?'La participación está revocada en esta obra y no concede acceso. Esto no acredita la entrega ni la revocación remota de su correo.':outcome.state==='PROCESSING'?'El procesamiento sigue pendiente. Volvé a consultar su recibo.':outcome.state==='INVITATION_UNCONFIRMED'?'La invitación necesita comprobarse con el proveedor desde Participantes. No se volvió a enviar.':'Todavía no se observa un recibo. Esto no demuestra que el envío se haya perdido; conservamos su referencia y no habilitamos otro envío de este módulo.';
      const display=entry.resource==='template-send'?templateSendNotice(result):message;
      setMessages(old=>({...old,[entry.operationId]:display}));setNotice(display);
      if(outcome.state==='RECORDED')onRecovered?.(result,entry);
    } catch(error){if(error.name!=='AbortError')setNotice(error.message);}
    finally {setBusy(null);}
  }
  const visibleEntries=entries.filter(entry=>entry.scope===scope&&projects.some(project=>project.id===entry.projectId));
  if(!visibleEntries.length&&!notice)return null;
  return <section className={styles.recovery} aria-labelledby="pending-receipts-title">
    <p className={styles.eyebrow}>RECUPERACIÓN</p><h3 id="pending-receipts-title">Operaciones por comprobar</h3>
    <p>Quedó una confirmación pendiente en este navegador. Podemos consultar su recibo después de recargar o volver a abrir la cuenta. Se conservan sólo referencias del intento; los textos, archivos y datos del formulario no se guardan en el navegador.</p>
    <p role="status" aria-live="polite">{notice}</p>
    <ul>{visibleEntries.map(entry=><li key={entry.resource+entry.operationId}><div><strong>{RECOVERY_RESOURCES[entry.resource]}</strong><span>{projects.find(project=>project.id===entry.projectId)?.name}</span><small>{new Date(entry.createdAt).toLocaleString('es-AR')}</small>{messages[entry.operationId]&&<p>{messages[entry.operationId]}</p>}<details><summary>Referencia del intento</summary><code>{entry.operationId}</code></details></div><button type="button" disabled={Boolean(busy)} onClick={()=>check(entry)}>{busy===entry.operationId?'Comprobando…':'Comprobar recibo'}</button></li>)}</ul>
  </section>;
}
