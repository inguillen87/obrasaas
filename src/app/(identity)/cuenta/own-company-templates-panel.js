'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,recoveryResult} from './workspace-recovery-journal.mjs';
import {OWN_TEMPLATE_ACTIONS,ownTemplatesSnapshot,ownTemplatesOutcome,ownTemplateCommand} from './own-company-templates-view.mjs';
import styles from './company-channel-panel.module.css';
const endpoint='/api/identity/company-channel';
const templateReadErrors={
 META_OWN_TEMPLATE_CHANNEL_REQUIRED:'No pudimos confirmar el canal propio de esta obra. Consultá Número propio de la empresa y Canal y obras de la empresa antes de preparar plantillas.',
 META_OWN_TEMPLATE_RUNTIME_REQUIRED:'No se confirmó una autorización operativa vigente para gestionar las plantillas. Consultá Número propio de la empresa con el administrador que autorizó el canal.',
 META_OWN_TEMPLATE_ADMIN_REQUIRED:'No pudimos confirmar la autorización para administrar las plantillas de este canal. El administrador que autorizó el canal debe revisar Número propio de la empresa desde la obra de origen.',
};
function templateErrorMessage(status,code,method){
 const fallback=status===403?'Tu acceso no permite administrar las plantillas de este canal.':'No se pudo confirmar esta operación. Conservamos la referencia para comprobarla.';
 if(method==='POST')return fallback;
 if(status===401)return 'Volvé a ingresar para confirmar tu sesión antes de consultar las plantillas.';
 if(status===403&&typeof code==='string'&&Object.hasOwn(templateReadErrors,code))return templateReadErrors[code];
 return status===403?fallback+' Volvé a consultar cuando se restablezca.':fallback;
}
const referenceOf=body=>({version:1,resource:'company-channel',scope:body.scope,projectId:body.projectId,operationId:body.operationId,action:body.action,connectionId:body.payload.connectionId,createdAt:Date.now()});
export function OwnCompanyTemplatesPanel(props){return <Templates key={props.scope+':'+props.projectId} {...props}/>;}
function Templates({scope,projectId,getSessionToken,onPending,locked=false}){
 const transport=useWorkspaceRequest(getSessionToken),alive=useRef(true),inFlight=useRef(false),epoch=useRef(0);
 const [data,setData]=useState(null),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[ready,setReady]=useState(false),[confirm,setConfirm]=useState(''),[notice,setNotice]=useState(''),[recovery,setRecovery]=useState(null);
 useEffect(()=>{alive.current=true;const generation=epoch;return()=>{alive.current=false;generation.current++;};},[]);
 useEffect(()=>{if(!data)return;const expire=()=>{if(Date.parse(data.validUntil)>Date.now())return;setData(null);setConfirm('');setRecovery(null);setNotice('La autorización operativa venció. Volvé a consultar el canal con tu acceso actual.');};const timer=setInterval(expire,1000);return()=>clearInterval(timer);},[data]);
 useEffect(()=>{onPending?.(busy||Boolean(confirm)||OWN_TEMPLATE_ACTIONS.includes(pending?.action));return()=>onPending?.(false);},[busy,confirm,pending,onPending]);
 useEffect(()=>{
  let live=true,sequence=0,channel;
  const refresh=async()=>{if(inFlight.current)return;const n=++sequence;try{const entries=await browserRecoveryJournal.list(scope);if(live&&n===sequence&&!inFlight.current){setPending(entries.find(row=>row.resource==='company-channel')||null);setReady(true);setConfirm('');setRecovery(null);setData(null);}}catch{if(live&&n===sequence){setReady(false);setNotice('No se pudo comprobar el almacenamiento de referencias. Las solicitudes quedan bloqueadas.');}}};
  const visible=()=>{if(document.visibilityState==='visible')void refresh();};
  if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel(RECOVERY_EVENT);channel.onmessage=event=>{if(event.data?.version===1&&event.data?.type==='invalidate')void refresh();};}catch{/* Focus and same-window invalidation remain available. */}}
  void refresh();window.addEventListener(RECOVERY_EVENT,refresh);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',visible);
  return()=>{live=false;channel?.close();window.removeEventListener(RECOVERY_EVENT,refresh);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visible);};
 },[scope,projectId]);
 const expected=()=>({scope,projectId,...(data?{organizationId:data.organization.id,actorId:data.actor.id}:{})});
 async function request(params,options,validate){
  let retained;const result=await transport(endpoint+(options.method==='POST'?'':'?'+new URLSearchParams({scope,projectId,...params})),options,async response=>{
   if(!response.ok){let body;try{body=await response.json();}catch{/* Status still denies the operation. */}const error=Object.assign(new Error(templateErrorMessage(response.status,body?.code,options.method)),{status:response.status,code:body?.code});if(options.method==='POST'){retained=error;return null;}throw error;}
   try{return validate(await response.json());}catch(error){if(options.method==='POST'){retained=error;return null;}throw error;}
  });if(retained)throw retained;return result;
 }
 async function snapshot(){return request({discovery:'OWN_TEMPLATES'},{requestTimeoutMs:15000},value=>ownTemplatesSnapshot(value,expected()));}
 async function load(){
  if(inFlight.current)return;inFlight.current=true;setBusy(true);setConfirm('');setRecovery(null);const n=++epoch.current;
  try{const result=await snapshot();if(alive.current&&epoch.current===n){setData(result);setNotice('Consulta local de las plantillas guardadas. Comprobar una solicitud consulta Meta sin volver a crearla.');}}
  catch(error){if(alive.current&&epoch.current===n){setData(null);setNotice(error.message);}}
  finally{inFlight.current=false;if(alive.current&&epoch.current===n)setBusy(false);}
 }
 async function check(){
  if(inFlight.current||!pending||pending.projectId!==projectId||!OWN_TEMPLATE_ACTIONS.includes(pending.action))return;
  const ref=pending,n=++epoch.current;inFlight.current=true;setBusy(true);setConfirm('');setRecovery(null);
  try{const result=await request({operationId:ref.operationId},{requestTimeoutMs:15000},value=>ownTemplatesOutcome(value,{...ref,...expected()}));
   if(alive.current&&epoch.current===n){if(['RECORDED','REJECTED'].includes(result.state)){setPending(null);setData(await snapshot());setNotice(result.state==='REJECTED'?'El rechazo quedó registrado. Consultá la autorización actual antes de otra solicitud.':result.providerConfirmed?'Solicitud comprobada en Meta. El envío a participantes sigue cerrado.':'El resultado incierto quedó registrado. Usá Comprobar solicitud para consultar Meta sin repetir su creación.');}
    else if(result.state==='PROVIDER_STARTED'){const fresh=await snapshot();if(fresh.connectionId!==result.connectionId||fresh.ownerRevision!==result.ownerRevision||fresh.grantDigest!==result.grantDigest)throw new Error('Cambió la autorización del canal. Conservamos el recibo para revisión.');setData(fresh);setRecovery(result);setNotice('La solicitud original sigue pendiente. Podés autorizar una consulta en Meta del mismo intento; no se crea otra plantilla.');}
    else{setData(null);setNotice('Todavía no se observa el recibo exacto. Conservamos la referencia y no se reenvía automáticamente.');}}
  }catch(error){if(alive.current&&epoch.current===n){setData(null);setNotice(error.message);}}
  finally{inFlight.current=false;if(alive.current&&epoch.current===n)setBusy(false);}
 }
 async function command(action,blueprintKey){
  if(inFlight.current||locked||!ready||!data||pending&&!recovery)return;
  let body;try{body={...ownTemplateCommand(data,{action,blueprintKey,confirmed:confirm===blueprintKey,recoveryOf:recovery?pending.action:null},expected()),operationId:recovery?pending.operationId:crypto.randomUUID()};}catch(error){setNotice(error.message);return;}
  const ref=recovery?pending:referenceOf(body),n=++epoch.current;
  inFlight.current=true;setPending(ref);setBusy(true);setConfirm('');setRecovery(null);
  try{const result=await request({},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),requestTimeoutMs:60000},value=>ownTemplatesOutcome(value,{...ref,...expected()}));
   if(!recoveryResult(ref,result))throw new Error('El resultado no corresponde al intento original.');
   if(alive.current&&epoch.current===n){if(['RECORDED','REJECTED'].includes(result.state)){setPending(null);setData(await snapshot());setNotice(result.state==='REJECTED'?'El rechazo quedó registrado. Volvé a revisar el canal antes de otra solicitud.':result.submissionState==='DRAFT'?'Borrador guardado. Revisá el texto antes de solicitar su aprobación.':result.providerConfirmed?'Estado de Meta guardado. La aprobación no habilita envíos a participantes.':'Conservamos el resultado incierto. Sólo se puede comprobar la solicitud, sin repetir su creación.');}else{setData(null);setNotice('La solicitud sigue pendiente. Comprobá el recibo del mismo intento.');}}
  }catch(error){if(alive.current&&epoch.current===n){const entries=await browserRecoveryJournal.list(scope).catch(()=>null);if(entries){setPending(entries.find(row=>row.resource==='company-channel')||null);setReady(true);}else setReady(false);setData(null);setNotice(error.requestDispatched===false?'La operación no se envió. Consultá las referencias antes de continuar.':'La confirmación no llegó. Conservamos el UUID original; comprobá su recibo antes de otra solicitud.');}}
  finally{inFlight.current=false;if(alive.current&&epoch.current===n)setBusy(false);}
 }
 const disabled=busy||locked||!ready||Boolean(pending),fresh=Boolean(data);
 return <section className={styles.panel} aria-labelledby="own-company-templates-title" aria-busy={busy} data-own-company-templates>
  <div className={styles.heading}><div><p className={styles.eyebrow}>MENSAJES DE LA EMPRESA</p><h3 id="own-company-templates-title">Revisar plantillas de nuestro WhatsApp</h3><p className={styles.intro}>El administrador que autorizó este canal puede preparar textos y solicitar su aprobación. Los envíos a participantes siguen pendientes de habilitación.</p></div><button type="button" disabled={busy||Boolean(confirm)} onClick={load}>Consultar plantillas</button></div>
  <p className={notice?styles.notice:styles.silent} role="status" aria-live="polite">{notice}</p>
  {pending&&<div className={styles.recovery}><p>Hay una decisión del canal por comprobar. La referencia se conserva: <code>{pending.operationId}</code>.</p>{pending.projectId===projectId&&OWN_TEMPLATE_ACTIONS.includes(pending.action)&&<button type="button" disabled={busy} onClick={check}>Comprobar resultado de plantilla</button>}</div>}
  {data&&<><p>Empresa: <strong>{data.organization.name}</strong>. Sólo se administra la conexión de origen de esta obra. La consulta guardada y la aprobación de Meta no acreditan entrega.</p>
   <div className={styles.actions}>{data.workbench.options.filter(option=>!data.workbench.drafts.some(draft=>draft.blueprintKey===option.key)).map(option=><button type="button" key={option.key} disabled={disabled||!fresh} onClick={()=>command('PREPARE_OWN_TEMPLATE',option.key)}>Preparar {option.title.toLowerCase()}</button>)}</div>
   {data.workbench.drafts.map(draft=><article className={styles.channel} key={draft.name}><h4>{draft.title}</h4><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{draft.bodyText}</p><p>{draft.state==='DRAFT'?'Borrador para revisar':draft.state==='SUBMITTED'?`Estado comprobado en Meta: ${draft.providerStatus}`:'Solicitud pendiente de comprobar'}. Envío a participantes cerrado.</p>
    {(!pending||recovery?.blueprintKey===draft.blueprintKey)&&<><label className={styles.checkbox}><input type="checkbox" disabled={busy||locked||!fresh} checked={confirm===draft.blueprintKey} onChange={event=>setConfirm(event.target.checked?draft.blueprintKey:'')}/><span>{draft.canSubmit?'Revisé este texto y autorizo solicitar su aprobación para la cuenta de esta empresa.':'Autorizo consultar en Meta esta solicitud sin volver a crear la plantilla.'}</span></label><div className={styles.actions}>{draft.canSubmit&&<button type="button" disabled={disabled||!fresh||confirm!==draft.blueprintKey} onClick={()=>command('SUBMIT_OWN_TEMPLATE',draft.blueprintKey)}>Solicitar aprobación</button>}{draft.canRecover&&<button type="button" disabled={busy||locked||!ready||!fresh||confirm!==draft.blueprintKey||Boolean(pending)&&!recovery} onClick={()=>command('RECOVER_OWN_TEMPLATE',draft.blueprintKey)}>Comprobar solicitud en Meta</button>}<button type="button" disabled={busy} onClick={()=>setConfirm('')}>Cancelar revisión</button></div></>}
   </article>)}
  </>}
 </section>;
}
