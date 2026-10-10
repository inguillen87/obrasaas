'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {identityOfficeInvitationId} from '../../../lib/identity-return-path.mjs';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,officeReviewReceiptOutcome} from './workspace-recovery-journal.mjs';
import {officeAccessDenied,officeReviewSnapshot,officeAdminSnapshot,officeEventLabels} from './office-review-view.mjs';
import styles from './workspace.module.css';
import officeStyles from './office-review-panel.module.css';
const path='/api/identity/office-review';
const query=values=>'?' + new URLSearchParams(values).toString();
const currentTime=()=>Date.now();
const invitationLabel=state=>({SENT:'Invitación enviada',INVITATION_UNCONFIRMED:'Confirmación pendiente',REVOKED:'Acceso revocado'})[state];
async function readResponse(response){
 let body;try{if(response.headers.get('content-type')?.includes('application/json'))body=await response.json();}catch{/* Preserve the actual denial even for HTML or broken JSON. */}
 if(!response.ok){const error=new Error(response.status===401?'Tu sesión venció. Volvé a ingresar.':response.status===403||response.status===404?'Este acceso ya no está disponible. Se ocultaron sus datos.':'No se pudo confirmar. Conservamos la referencia y no repetimos la invitación.');error.status=response.status;error.code=body?.code;throw error;}
 if(!body)throw new Error('No se pudo leer la confirmación. Volvé a consultar su referencia.');return body;
}
export function OfficeJoinPanel({getSessionToken}){
 const params=useSearchParams(),invitationId=identityOfficeInvitationId(params),request=useWorkspaceRequest(getSessionToken),epoch=useRef(0);
 const [data,setData]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const current=++epoch.current;setBusy(true);setData(null);try{const result=await request('/api/identity/office-join'+query({invitationId}),{},readResponse);if(result.invitationId!==invitationId||result.readOnly!==true)throw new Error('La invitación no corresponde a este acceso.');if(current===epoch.current)setData(result);}catch(error){if(current===epoch.current)setNotice(error.message);}finally{if(current===epoch.current)setBusy(false);}},[invitationId,request]);
 useEffect(()=>{const lifetime=epoch;let active=true;if(invitationId)void Promise.resolve().then(()=>{if(active)return load();});return()=>{active=false;lifetime.current++;};},[invitationId,load]);
 async function accept(){const current=epoch.current;setBusy(true);try{const result=await request('/api/identity/office-join',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({invitationId,operationId:crypto.randomUUID()})},readResponse);if(result.invitationId!==invitationId||result.saved!==true||result.joined!==true||result.readOnly!==true||!/^office_accept_[a-f0-9]{64}$/.test(result.receiptId||''))throw new Error('No se pudo comprobar la aceptación. Consultá la misma invitación antes de volver a intentar.');if(current===epoch.current){setData(result);setNotice('Acceso de lectura confirmado. Abrí la obra desde Mis obras; no se solicitaron documentos ni se creó una participación de operario.');}}catch(error){if(current===epoch.current){setData(null);setNotice(error.message);}}finally{if(current===epoch.current)setBusy(false);}}
 if(!invitationId)return null;
 return <section className={styles.recovery+' '+officeStyles.panel} aria-labelledby="office-join-title"><h2 id="office-join-title">Acceso de oficina de sólo lectura</h2><p>Aceptá primero la invitación de Clerk con su dirección verificada y seleccioná esa organización. Verás los saludos elegidos por el administrador y, si la comparte con tu invitación, la configuración guardada de la conexión.</p><p role="status">{notice}</p>{data?.canAccept&&<><p>{data.organizationName} · {data.projectName}</p><p>Vigencia hasta {new Date(data.expiresAt).toLocaleString('es-AR')}.</p><button type="button" disabled={busy} onClick={accept}>Aceptar acceso de lectura</button></>}{data?.joined&&<a href="/cuenta">Abrir Mis obras</a>}<button type="button" disabled={busy} onClick={load}>Comprobar esta invitación</button></section>;
}
export function OfficeReviewPanel({scope,projectId,getSessionToken}){
 const request=useWorkspaceRequest(getSessionToken),epoch=useRef(0);
 const [data,setData]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{const current=++epoch.current;setData(null);setBusy(true);setNotice('');try{const value=await request(path+query({scope,projectId,view:'review'}),{},async response=>officeReviewSnapshot(await readResponse(response),{scope,projectId}));if(current===epoch.current)setData(value);}catch(error){if(current===epoch.current)setNotice(error.message);}finally{if(current===epoch.current)setBusy(false);}},[scope,projectId,request]);
 useEffect(()=>{const lifetime=epoch;let active=true;void Promise.resolve().then(()=>{if(active)return load();});return()=>{active=false;lifetime.current++;};},[load]);
 return <section className={styles.recovery+' '+officeStyles.panel} aria-labelledby="office-review-title" aria-busy={busy}>
  <h3 id="office-review-title">Revisión de conexión y eventos</h3>
  <p>Consulta de sólo lectura. No incluye remitentes, textos, documentos ni herramientas de envío o gestión.</p>
  <p role="status">{notice}</p>
  <button type="button" disabled={busy} onClick={load}>Actualizar acceso y eventos</button>
  {data&&<>
   <p>{data.projectName} · acceso hasta {new Date(data.expiresAt).toLocaleString('es-AR')}.</p>
   <section aria-labelledby="office-connection-title" className={officeStyles.snapshot}>
    <h4 id="office-connection-title">Configuración guardada de la conexión</h4>
    {data.connection?<>
     <p>El administrador compartió este registro el {new Date(data.connection.observedAt).toLocaleString('es-AR')}.</p>
     <dl>
      <dt>Canal</dt><dd>De la empresa · habilitado</dd>
      <dt>Estado guardado</dt><dd>Conectado</dd>
      <dt>Versión del canal</dt><dd>{data.connection.channelRevision}</dd>
      <dt>Versión de asignación a esta obra</dt><dd>{data.connection.assignmentRevision}</dd>
      <dt>Referencia de conexión</dt><dd>{data.connection.connectionRef}</dd>
      <dt>Referencia de cuenta de WhatsApp</dt><dd>{data.connection.wabaRef}</dd>
      <dt>Referencia del número</dt><dd>{data.connection.phoneNumberRef}</dd>
     </dl>
     <p>Las referencias ocultan los identificadores y el teléfono. Actualizar esta pantalla comprueba tu acceso y la vigencia del registro; no consulta el estado actual en Meta.</p>
    </>:<p>No hay una configuración compartida con esta invitación.</p>}
   </section>
   <h4>Saludos compartidos</h4>
   {data.items.length===0?<p>El administrador todavía no seleccionó eventos verificables para esta obra.</p>:<ul>{data.items.map(row=><li key={row.id}><strong>Saludo recibido con firma verificada</strong><p>{new Date(row.receivedAt).toLocaleString('es-AR')} · procesamiento: {officeEventLabels(row).processing} · {officeEventLabels(row).reply}{officeEventLabels(row).delivery?` · ${officeEventLabels(row).delivery}`:''}</p><small>Referencia: {row.id}</small></li>)}</ul>}
   <p>Un estado observado no acredita una prueba de cliente autenticado ni que alguien haya leído el mensaje físicamente.</p>
  </>}
 </section>;
}
export function OfficeReviewAdminPanel({scope,projectId,getSessionToken,onPending,locked=false}){
 const request=useWorkspaceRequest(getSessionToken),epoch=useRef(0);
 const [data,setData]=useState(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[email,setEmail]=useState(''),[expires,setExpires]=useState(''),[eventId,setEventId]=useState(''),[confirmed,setConfirmed]=useState(false),[connectionConfirmed,setConnectionConfirmed]=useState({});
 const readPending=useCallback(async()=>{const current=epoch.current;const rows=await browserRecoveryJournal.list(scope);if(current===epoch.current)setPending(rows.find(row=>row.resource==='office-review'&&row.projectId===projectId)||null);},[scope,projectId]);
 const load=useCallback(async(successMessage='')=>{const current=++epoch.current;setData(null);setConnectionConfirmed({});setBusy(true);setNotice('');try{const value=await request(path+query({scope,projectId}),{},async response=>officeAdminSnapshot(await readResponse(response),{scope,projectId}));if(current===epoch.current){setData(value);if(typeof successMessage==='string')setNotice(successMessage);}await readPending();}catch(error){if(current===epoch.current){setEmail('');setExpires('');setEventId('');setConfirmed(false);setNotice(error.message);}}finally{if(current===epoch.current)setBusy(false);}},[scope,projectId,request,readPending]);
 useEffect(()=>{const lifetime=epoch;let active=true;void Promise.resolve().then(()=>{if(active)return load();});const change=()=>{void readPending().catch(()=>{});};window.addEventListener(RECOVERY_EVENT,change);return()=>{active=false;lifetime.current++;window.removeEventListener(RECOVERY_EVENT,change);};},[load,readPending]);
 useEffect(()=>{onPending?.(busy||Boolean(pending));return()=>onPending?.(false);},[busy,pending,onPending]);
 async function send(action,payload){const current=epoch.current,reference={scope,projectId,operationId:crypto.randomUUID(),action};setBusy(true);setNotice('');setConnectionConfirmed({});try{await request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...reference,payload})},async response=>{const value=await readResponse(response);if(!officeReviewReceiptOutcome(value,reference))throw new Error('El resultado no corresponde al recibo de esta acción.');return value;});if(current===epoch.current){setEmail('');setEventId('');setConfirmed(false);await load('Acción confirmada con recibo.');}}catch(error){if(current===epoch.current){if(officeAccessDenied(error)){setData(null);setEmail('');setExpires('');setEventId('');setConfirmed(false);}setNotice(error.message);await readPending();}}finally{if(current===epoch.current)setBusy(false);}}
 async function recover(){if(!pending)return;const current=epoch.current;setBusy(true);setConnectionConfirmed({});try{const value=await request(path+query({scope,projectId,operationId:pending.operationId}),{},async response=>{const result=await readResponse(response);if(!officeReviewReceiptOutcome(result,pending))throw new Error('La referencia aún no permite comprobar esta acción.');return result;});if(current!==epoch.current)return;if(value.state==='INVITATION_UNCONFIRMED'){const reference={...pending};await request(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'RECOVER_INVITATION',scope,projectId,operationId:reference.operationId,invitationId:value.invitationId})},async response=>{const result=await readResponse(response);if(!officeReviewReceiptOutcome(result,reference))throw new Error('La invitación no quedó confirmada. No se reenviará.');return result;});await request(path+query({scope,projectId,operationId:reference.operationId}),{},async response=>{const result=await readResponse(response);if(!officeReviewReceiptOutcome(result,reference))throw new Error('La consulta no confirma el mismo recibo.');return result;});}if(current===epoch.current){await readPending();await load(value.state==='NOT_OBSERVED'?'Todavía no se observa un recibo. Conservamos la referencia; esta consulta no habilita otro envío.':'Recibo comprobado sin repetir la acción.');}}catch(error){if(current===epoch.current){if(officeAccessDenied(error)){setData(null);setEmail('');setExpires('');setEventId('');setConfirmed(false);}setNotice(error.message);}}finally{if(current===epoch.current)setBusy(false);}}
 return <section className={styles.recovery+' '+officeStyles.panel} aria-labelledby="office-review-admin-title">
  <h3 id="office-review-admin-title">Revisión de oficina sin documentos</h3>
  <p>Asigná antes el canal de la empresa a esta obra desde Canal de la empresa. La invitación crea un auditor de lectura. Podés compartir saludos seleccionados y elegir, por separado, qué invitación puede ver la configuración guardada.</p>
  <p role="status">{notice}</p>
  {pending?<><p>Hay una acción pendiente. No se habilita otra acción.</p><button type="button" disabled={busy} onClick={recover}>Comprobar recibo e invitación</button></>:<button type="button" disabled={busy||locked} onClick={load}>Actualizar accesos</button>}
  {data&&!pending&&<>
   {data.channels.length===1?<>
    <form onSubmit={event=>{event.preventDefault();const expiry=new Date(expires+'T23:59:59').toISOString();if(Date.parse(expiry)>currentTime())void send('INVITE_AUDITOR',{email:email.trim().toLowerCase(),connectionId:data.channels[0].id,expiresAt:expiry,confirmReadOnly:true});}}>
     <label>Correo verificado del auditor<input type="email" required value={email} disabled={busy||locked} onChange={event=>setEmail(event.target.value)}/></label>
     <label>Acceso hasta (máximo 12 meses)<input type="date" required value={expires} disabled={busy||locked} onChange={event=>setExpires(event.target.value)}/></label>
     <button type="submit" disabled={busy||locked}>Invitar con acceso de lectura</button>
    </form>
    <form onSubmit={event=>{event.preventDefault();void send('SELECT_EVENT',{connectionId:data.channels[0].id,eventId,confirmNoPersonalData:true});}}>
     <label>Saludo real verificado<select required value={eventId} disabled={busy||locked} onChange={event=>setEventId(event.target.value)}><option value="">Elegir evento</option>{data.candidates.map(row=><option key={row.id} value={row.id}>{new Date(row.receivedAt).toLocaleString('es-AR')} · {row.processingState}</option>)}</select></label>
     <label><input type="checkbox" required checked={confirmed} disabled={busy||locked} onChange={event=>setConfirmed(event.target.checked)}/>Compartir sólo la observación de este saludo, sin datos personales ni documentos</label>
     <button type="submit" disabled={busy||locked||!confirmed}>Compartir evento de lectura</button>
    </form>
    {data.candidatesLimited&&<p>Se revisaron sólo los últimos 20 eventos del canal; no es un historial completo.</p>}
   </>:<p>No hay un único canal de empresa activo asignado a esta obra.</p>}
   <h4>Invitaciones y conexión compartida</h4>
   <ul>{data.invitations.map(invite=><li key={invite.id}>
    <span>{invite.email} · {invitationLabel(invite.state)} · hasta {new Date(invite.expiresAt).toLocaleDateString('es-AR')}</span>
    <p>{invite.connectionShared?'Hay una selección de configuración para esta invitación. Su consulta depende de que el acceso y el canal sigan vigentes.':'Sin configuración compartida.'}</p>
    {invite.canShareConnection&&<form aria-label={'Compartir configuración con '+invite.email} onSubmit={event=>{event.preventDefault();if(connectionConfirmed[invite.id])void send('SHARE_CONNECTION',{invitationId:invite.id,connectionId:invite.connectionId,confirmReadOnlyConfiguration:true});}}>
     <label><input type="checkbox" required checked={Boolean(connectionConfirmed[invite.id])} disabled={busy||locked} onChange={event=>setConnectionConfirmed(value=>({...value,[invite.id]:event.target.checked}))}/>Compartir con {invite.email} la configuración guardada, sin teléfono ni credenciales</label>
     <button type="submit" disabled={busy||locked||!connectionConfirmed[invite.id]}>{invite.connectionShared?'Volver a compartir configuración':'Compartir configuración'}</button>
    </form>}
    {!invite.canShareConnection&&invite.state!=='REVOKED'&&<p>Para compartir la configuración, la invitación debe estar aceptada y su acceso y canal vigentes. Actualizá los accesos después de la aceptación.</p>}
    {invite.connectionShared&&invite.state!=='REVOKED'&&<button type="button" disabled={busy||locked} onClick={()=>send('WITHDRAW_CONNECTION',{invitationId:invite.id,reason:'Retiro explícito de la configuración compartida'})}>Retirar configuración compartida</button>}
    {invite.state!=='REVOKED'&&<button type="button" disabled={busy||locked} onClick={()=>send('REVOKE_AUDITOR',{invitationId:invite.id,reason:'Revocación explícita del acceso de oficina'})}>Revocar acceso</button>}
   </li>)}</ul>
  </>}
 </section>;
}
