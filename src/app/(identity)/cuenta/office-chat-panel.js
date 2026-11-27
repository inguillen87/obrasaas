'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {createWorkspaceRequestLifecycle} from './workspace-request-lifecycle.mjs';
import styles from './company-bootstrap-panel.module.css';

export function OfficeChatSlot({active,role,...props}){
 // Unlike durable worksite drafts, the ephemeral code must leave the rendered
 // subtree when its section closes. The parent's WorkerChannelPanel stays put.
 return active&&['ADMIN','DIRECTOR'].includes(role)?<OfficeChatPanel {...props}/>:null;
}
export function OfficeChatPanel({projectId,scope,getSessionToken,onPending,canManageCompanyChannel=false,disabled=false}){
 // Deliberately no recovery journal: the one-time plaintext code must never
 // enter local/session storage, response capture or a durable browser draft.
 const transport=useMemo(()=>createWorkspaceRequestLifecycle(getSessionToken),[getSessionToken]);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[state,setState]=useState(null),[sender,setSender]=useState(''),[message,setMessage]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{transport.activate();return()=>transport.abort();},[transport]);
 useEffect(()=>{onPending?.(busy);return()=>onPending?.(false);},[busy,onPending]);
 useEffect(()=>{if(!message||!state?.expiresAt)return;const timer=setTimeout(()=>{setMessage('');setNotice('El código venció. Consultá el vínculo antes de preparar otro.');},Math.max(0,Date.parse(state.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[message,state?.expiresAt]);
 async function request(options){return transport.request('/api/identity/office-chat'+(options?.method==='POST'?'':'?'+new URLSearchParams({projectId,scope})),options||{},async response=>{const body=await response.json();if(!response.ok)throw new Error(response.status===403?'Tu acceso cambió. Volvé a consultar con tu sesión vigente.':'No se pudo confirmar la operación. Consultá el estado antes de generar otro código.');return body;});}
 async function consult(){if(busy||disabled)return;setBusy(true);setNotice('');try{const result=await request();setState(result);if(result.state!=='PREPARED')setMessage('');setOpen(true);}catch(error){if(error.name!=='AbortError')setNotice(error.message);}finally{setBusy(false);}}
 async function command(action){if(busy||disabled)return;setBusy(true);setMessage('');setNotice('');try{const body={projectId,scope,operationId:crypto.randomUUID(),action,...(action==='PREPARE'?{sender}:{})},result=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});setState(result);if(result.codeAvailable&&/^CUENTA [A-Za-z0-9_-]{43}$/.test(result.message||''))setMessage(result.message);else setNotice(result.state==='REVOKED'?'Vínculo de cuenta cerrado. Tus permisos de obra se conservan.':result.state==='CONNECT_WHATSAPP'?'Primero conectá el WhatsApp de esta empresa.':'El resultado está registrado. El código sólo se muestra en la primera respuesta.');}catch(error){if(error.name!=='AbortError')setNotice(error.message);}finally{setBusy(false);}}
 const locked=disabled||busy,businessPhone=typeof state?.businessPhone==='string'&&/^\+[\d\s()-]+$/.test(state.businessPhone)?state.businessPhone.replace(/\D/g,''):null;
 return <section className={styles.panel} aria-labelledby="office-chat-title"><h3 id="office-chat-title">Tu cuenta de oficina en WhatsApp</h3><p>Accedé a tus obras, equipo y opciones de WhatsApp desde el chat. Las decisiones se realizan en la plataforma con tu cuenta personal.</p>
  {!open?<button type="button" disabled={locked} onClick={consult}>Continuar con mi cuenta</button>:<>
   {state?.state==='CONNECT_WHATSAPP'?<p>Esta obra todavía no tiene un canal corporativo activo. {canManageCompanyChannel?<Link href="/cuenta?seccion=canal">Conectar WhatsApp de la empresa</Link>:<>Pedile al administrador que conecte el WhatsApp de la empresa.</>}</p>:<>
    {state?.state==='BOUND'&&<p role="status">Cuenta vinculada para navegación. Escribí CUENTA en el chat de la empresa.</p>}
    <label>Tu WhatsApp personal<input type="tel" autoComplete="tel" placeholder="+549..." value={sender} disabled={locked||Boolean(message)} onChange={event=>setSender(event.target.value)}/></label>
    <p>Incluí + y código de país. Enviarás el mensaje desde ese número exacto al WhatsApp corporativo. El código vence en cinco minutos y reemplaza el vínculo anterior.</p>
    {!message&&<button type="button" disabled={locked||!/^\+[1-9]\d{7,14}$/.test(sender)} onClick={()=>command('PREPARE')}>{state?.state==='PREPARED'?'Generar otro código':'Preparar código de cuenta'}</button>}
    {message&&<div role="status"><p>Copiá este mensaje y envialo al WhatsApp de esta empresa. Sólo se muestra ahora.</p><code>{message}</code><div className={styles.actions}><button type="button" disabled={locked} onClick={async()=>{try{await navigator.clipboard.writeText(message);setNotice('Mensaje copiado. Envialo desde tu número personal al WhatsApp corporativo.');}catch{setNotice('No se pudo copiar. Seleccioná el mensaje y copialo manualmente.');}}}>Copiar mensaje</button>{businessPhone&&<a href={'https://wa.me/'+businessPhone} target="_blank" rel="noreferrer">Abrir WhatsApp de la empresa</a>}<button type="button" disabled={locked} onClick={()=>setMessage('')}>Ocultar código</button></div></div>}
    <div className={styles.actions}><button type="button" disabled={locked} onClick={consult}>Consultar vínculo</button><button type="button" disabled={locked||Boolean(message)} onClick={()=>command('REVOKE')}>Cerrar vínculo de cuenta</button></div>
   </>}
  </>}{notice&&<p role="status">{notice}</p>}<small>Este vínculo no verifica identidad, no registra asistencia ni concede permisos de campo.</small></section>;
}
