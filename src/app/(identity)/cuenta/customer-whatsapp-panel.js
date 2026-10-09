'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {customerWhatsAppAccessDenied,customerWhatsAppNextStep,customerWhatsAppNumberModeGuidance,customerWhatsAppPersonalAppGuidance,customerWhatsAppResult} from './customer-whatsapp-view.mjs';
import styles from './customer-whatsapp-panel.module.css';
import {CompanyPhoneDeclarationForm} from './company-bootstrap-panel';
const endpoint='/api/identity/whatsapp-setup';
const messages={WORKSPACE_INTEGRATION_PERMISSION_REQUIRED:'Tu rol actual no permite configurar el WhatsApp de esta empresa.',WORKSPACE_MEMBERSHIP_REQUIRED:'La pertenencia a esta empresa no está vigente.',WORKSPACE_CONTEXT_CHANGED:'Cambió el contexto de tu organización. Volvé a abrir la obra.',WORKSPACE_PROJECT_UNAVAILABLE:'La obra ya no está disponible con tu acceso actual. Volvé a consultar cuando se restablezca.',WORKSPACE_CONFLICT:'La preparación cambió mientras editabas. Tu borrador se conserva; consultá la versión actual antes de volver a guardar.',WORKSPACE_INTEGRITY:'La preparación anterior requiere revisión. No la reemplazamos por un ejemplo.',WORKSPACE_INVALID:'Revisá el nombre, el tipo de número y los circuitos elegidos.',WORKSPACE_PROJECT_MISMATCH:'La preparación no pertenece a la obra abierta.',WHATSAPP_PREPARATION_OPERATION_CONFLICT:'La clave de este intento ya pertenece a otra solicitud.',SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.'};
const explain=code=>messages[code]||'No se pudo confirmar la preparación. No se modificó ninguna cuenta de Meta.';
const stateLabel=value=>({SAVED:'Guardado',PENDING:'Pendiente',NOT_VERIFIED:'Sin verificar',RECORD_PRESENT:'Registro existente; operación no verificada',NOT_LINKED:'Sin vincular'}[value]||'Sin verificar');
async function api(sessionRequest,url,options,validate){
 let retainedError;
 const value=await sessionRequest(url,options,async result=>{
  if(!result.ok){let data;try{data=await result.json();}catch{/* HTML access denials must preserve the HTTP status. */}const code=data?.code||(result.status===401?'SESSION_REQUIRED':undefined),error=Object.assign(new Error(messages[code]||(result.status===403?'Tu acceso no permite preparar esta conexión. Volvé a consultar cuando se restablezca.':explain(code))),{status:result.status,code});
   // Resolve without a receipt so the existing journal keeps a dispatched attempt.
   if(options?.method==='POST'&&customerWhatsAppAccessDenied(error)){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}throw error;
  }
  try{return validate(await result.json());}catch(error){if(options?.method==='POST'){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}throw error;}
 });
 if(retainedError)throw retainedError;return value;
}
const empty=()=>({assistantName:'',numberMode:'',useCases:[],confirmOwnership:false});
const draftFrom=profile=>({assistantName:profile.assistantName,numberMode:profile.numberMode||'',useCases:[...profile.useCases],confirmOwnership:false});
export function CustomerWhatsAppPanel(props){
 return <CustomerWhatsAppPreparation key={props.scope+':'+props.projectId} {...props}/>;
}
function CustomerWhatsAppPreparation({projectId,scope,onPending,getSessionToken}){
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[draft,setDraft]=useState(empty),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[attempt,setAttempt]=useState(null),[canRetry,setCanRetry]=useState(false),[revisionReview,setRevisionReview]=useState(null),[reviewed,setReviewed]=useState(false);
 const [phonePending,setPhonePending]=useState(false);
 const mounted=useRef(true),active=useRef(null);
 const currentData=data?.projectId===projectId&&data?.scope===scope?data:null;
 const companyBlocked=currentData?.companyRouting?.legacyActionsBlocked===true;
 const currentAttempt=attempt?.projectId===projectId&&attempt?.scope===scope?attempt:null;
 const dirty=Boolean(opened&&currentData&&!companyBlocked&&(draft.assistantName!==currentData.profile.assistantName||draft.numberMode!==(currentData.profile.numberMode||'')||JSON.stringify([...draft.useCases].sort())!==JSON.stringify([...currentData.profile.useCases].sort())||draft.confirmOwnership));
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort();};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(currentAttempt)||dirty||phonePending);return()=>onPending?.(false);},[busy,currentAttempt,dirty,phonePending,onPending]);
 const valid=(result,kind='snapshot',command)=>customerWhatsAppResult(result,{scope,projectId},{kind,command});
 function accept(result,replaceDraft){
  setData(result);if(replaceDraft)setDraft(draftFrom(result.profile));
 }
 function hideDenied(){
  setData(null);setDraft(empty());setRevisionReview(null);setReviewed(false);setCanRetry(false);
  // A denied read may keep a receipt reference, never the private old form.
  setAttempt(previous=>previous?{operationId:previous.operationId,projectId:previous.projectId,scope:previous.scope}:null);
 }
 async function load(preserveDraft=false){
  if(busy||currentAttempt||dirty&&!preserveDraft)return;
  const alive=()=>mounted.current;
  setOpened(true);setBusy(true);setMessage('');const abort=new AbortController();active.current=abort;
  try{const result=await api(sessionRequest,endpoint+'?'+new URLSearchParams({projectId,scope}),{signal:abort.signal},result=>valid(result));if(alive()){
   accept(result,!preserveDraft);setReviewed(false);setRevisionReview(preserveDraft?{previousRevision:currentData.profile.revision,currentRevision:result.profile.revision,profile:result.profile}:null);
   if(preserveDraft)setMessage('Consultaste la versión actual. Revisá sus datos antes de guardar tu edición. No se guardó ningún cambio.');
  }}catch(error){if(alive()&&error.name!=='AbortError'){if(customerWhatsAppAccessDenied(error))hideDenied();setMessage(error.message);}}finally{if(alive())setBusy(false);}
 }
 function finish(result){
  accept(result,true);setAttempt(null);setCanRetry(false);setRevisionReview(null);setReviewed(false);setMessage(result.savedProfileIsCurrent===false?'Se recuperó tu recibo. Otro cambio posterior ya modificó la preparación; se muestra la versión vigente.':'Preparación guardada. Este guardado no conecta el número ni envía mensajes.');
 }
 async function send(payload,retrying=false){
  if(companyBlocked){setCanRetry(false);setMessage('Este canal se administra como conexión compartida. Consultá sus obras y asignaciones en Canal y obras de la empresa.');return;}
  const alive=()=>mounted.current;
  setBusy(true);setCanRetry(false);setMessage('');onPending?.(true);
  try{const result=await api(sessionRequest,endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),requestTimeoutMs:20000},result=>valid(result,'save',payload));if(alive())finish(result);}
  catch(error){if(alive()){
   if(customerWhatsAppAccessDenied(error))hideDenied();
    if(!error.retainAttempt&&(error.requestDispatched===false||error.status&&error.status<500)){if(!retrying)setAttempt(null);if(error.code==='WORKSPACE_CONFLICT'&&!retrying){setRevisionReview({previousRevision:currentData.profile.revision,currentRevision:null,profile:null});setReviewed(false);}setMessage(error.message);}
    else setMessage(customerWhatsAppAccessDenied(error)?error.message+' El guardado sigue sin confirmar. Comprobá el mismo intento cuando se restablezca tu acceso.':'El guardado quedó sin confirmar. Conservamos este intento: comprobalo antes de reenviar.');
  }}finally{if(alive())setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(busy||companyBlocked||currentAttempt||!currentData||revisionReview&&!reviewed)return;
  const payload={operationId:crypto.randomUUID(),projectId,scope,profile:{...draft,useCases:[...draft.useCases],initialProjectId:projectId,expectedRevision:currentData.profile.revision}};
  setAttempt(payload);await send(payload);
 }
 async function retry(){if(companyBlocked||!currentAttempt?.profile||busy||!canRetry)return;await send(currentAttempt,true);}
 async function recover(){
  if(!currentAttempt||busy)return;
  const alive=()=>mounted.current;
  setBusy(true);setCanRetry(false);
  try{const result=await api(sessionRequest,endpoint+'?'+new URLSearchParams({projectId,scope,operationId:currentAttempt.operationId}),{requestTimeoutMs:15000},result=>valid(result,'status'));
   if(alive()){if(result.state==='RECORDED')finish(result);else{
    accept(result,!currentAttempt.profile);setCanRetry(Boolean(currentAttempt.profile));setMessage(currentAttempt.profile?'Todavía no se observa el recibo. Podés reenviar este mismo intento con su identificador y sus datos originales. No se reenvía automáticamente.':'Todavía no se observa el recibo. Los datos anteriores se ocultaron al cambiar el acceso y no se pueden reconstruir. No se reenvía automáticamente.');
   }}
  }catch(error){if(alive()){if(customerWhatsAppAccessDenied(error))hideDenied();setMessage(error.message);}}finally{if(alive())setBusy(false);}
 }
 function toggle(value){setDraft(previous=>({...previous,useCases:previous.useCases.includes(value)?previous.useCases.filter(item=>item!==value):[...previous.useCases,value]}));}
 const locked=busy||Boolean(currentAttempt)||phonePending,next=currentData?customerWhatsAppNextStep(currentData.profile,projectId):null,selectedModeGuidance=customerWhatsAppNumberModeGuidance(draft.numberMode);
 return <section className={styles.panel} aria-labelledby="customer-whatsapp-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>WHATSAPP DE TU EMPRESA</p><h3 id="customer-whatsapp-title">Tu número. Tu obra.</h3></div><button type="button" onClick={()=>load()} disabled={locked||dirty}>{opened?'Volver a cargar':'Preparar WhatsApp'}</button>{opened&&currentData&&<button type="button" disabled={locked} onClick={()=>{setDraft(draftFrom(currentData.profile));setRevisionReview(null);setReviewed(false);setOpened(false);setMessage('');}}>Cancelar edición</button>}</div>
  <p className={styles.intro}>Prepará la conexión desde tu cuenta. No tenés que compartir tokens, contraseñas ni claves con ObraSaaS. La autorización y el estado del número se consultan en Meta.</p>
  <p role="status" aria-live="polite" className={message?styles.notice:styles.silent}>{message}</p>
  {busy&&!currentData&&<p>Consultando la preparación de esta obra…</p>}
   {currentAttempt&&(!currentData||!currentAttempt.profile)&&<div className={styles.recovery}><p>Hay un intento sin confirmar. Consultá su recibo con tu acceso vigente; no reconstruimos ni reenviamos los datos ocultados.</p><button type="button" disabled={busy} onClick={recover}>Comprobar preparación</button><button type="button" disabled={busy} onClick={()=>{setAttempt(null);setMessage('Cerraste esta consulta. La referencia sigue en Operaciones por comprobar; no se declaró perdido el guardado ni se reenvió.');}}>Cerrar consulta y conservar referencia</button></div>}
  {opened&&currentData&&<>
   <div className={styles.context}><strong>{currentData.companyName}</strong><span>{currentData.projectName}</span></div>
   {currentData.currentCompany&&<CompanyPhoneDeclarationForm key={currentData.currentCompany.organizationId} company={currentData.currentCompany} projectId={projectId} scope={scope} getSessionToken={getSessionToken} onPending={setPhonePending} nextStep={companyBlocked?{target:'company-channel-title',label:'Ver canal y obras',detail:'La conexión se administra desde el canal compartido de esta empresa.'}:next.canConsultMeta?{target:'customer-meta-title',label:'Ver conexión de Meta',detail:'La preparación está guardada. En el siguiente panel, elegí Ver conexión para consultar sus requisitos y su estado.'}:{target:'wa-assistant-preparation-title',label:'Preparar el asistente',detail:'Completá el nombre, el tipo de número y los circuitos de esta obra antes de autorizar en Meta.'}}/>}
   {companyBlocked?<section className={styles.progress} aria-labelledby="wa-company-channel"><h4 id="wa-company-channel">Canal empresarial compartido</h4><p>Este canal se administra para varias obras. Revisá la conexión, las obras destino y las asignaciones en Canal y obras de la empresa.</p><p style={{overflowWrap:'anywhere'}}>Canal: <code>{currentData.companyRouting.connectionId}</code> · Obra de origen: <code>{currentData.companyRouting.anchorProjectId}</code>.</p><a className={styles.link} href="#company-channel-title">Administrar canal y obras de la empresa</a><p>Las consultas y referencias pendientes se conservan. El alcance operativo se consulta en Canal y obras con el estado vigente. Cada operación requiere un participante aprobado, permiso vigente y vinculación individual. Consultá en Canal y obras si la captura privada de identidad está disponible. Se prepara en Participantes con una invitación comprobada y código para esta obra; requiere aceptación de la cuenta en Clerk y revisión por otra persona. Flows, plantillas, avisos proactivos y datos bancarios por chat siguen cerrados.</p></section>:<>
   {revisionReview&&<section className={styles.review} aria-labelledby="wa-revision-review"><h4 id="wa-revision-review">Revisá el cambio antes de guardar</h4><p>Tu edición sigue en el formulario. {revisionReview.currentRevision===null?'Falta consultar la versión actual.':`La preparación pasó de la revisión ${revisionReview.previousRevision} a la revisión ${revisionReview.currentRevision}.`}</p>
    <button type="button" disabled={locked} onClick={()=>load(true)}>Consultar versión actual sin perder mi edición</button>
    {revisionReview.profile&&<><dl><dt>Nombre guardado</dt><dd>{revisionReview.profile.assistantName||'Sin preparar'}</dd><dt>Tipo de número guardado</dt><dd>{currentData.options.numberModes.find(mode=>mode.key===revisionReview.profile.numberMode)?.label||'Sin elegir'}</dd><dt>Circuitos guardados</dt><dd>{currentData.options.useCases.filter(item=>revisionReview.profile.useCases.includes(item.key)).map(item=>item.label).join(', ')||'Sin elegir'}</dd></dl><label className={styles.consent}><input type="checkbox" data-revision-reviewed checked={reviewed} disabled={locked} onChange={event=>setReviewed(event.target.checked)}/><span>Revisé la preparación vigente y quiero guardar mi edición sobre esta revisión.</span></label></>}
   </section>}
   <form onSubmit={save}>
    <h4 id="wa-assistant-preparation-title" tabIndex={-1}>Preparar el asistente de esta obra</h4>
    <label className={styles.field}>Nombre del asistente en ObraSaaS<input maxLength={70} required autoComplete="off" aria-describedby="wa-assistant-name-guidance" value={draft.assistantName} disabled={locked} onChange={event=>setDraft({...draft,assistantName:event.target.value})}/></label>
    <p id="wa-assistant-name-guidance" className={styles.note}>El nombre y logo visibles en WhatsApp se configuran por separado en Meta. Meta revisa el nombre.</p>
    <fieldset disabled={locked} className={styles.modes} aria-describedby="wa-personal-app-guidance"><legend>¿Dónde usás hoy este número?</legend>{currentData.options.numberModes.map(mode=>{const guidance=customerWhatsAppNumberModeGuidance(mode.key);return <label key={mode.key}><input type="radio" name="number-mode" value={mode.key} checked={draft.numberMode===mode.key} required onChange={()=>setDraft({...draft,numberMode:mode.key})}/><span><strong>{guidance.title}</strong><small>{guidance.detail}</small></span></label>;})}</fieldset>
    <p id="wa-personal-app-guidance" className={styles.note}>{customerWhatsAppPersonalAppGuidance}</p>
    {selectedModeGuidance&&<p className={styles.next} data-number-mode-guidance={draft.numberMode} aria-live="polite">{selectedModeGuidance.next}</p>}
    <fieldset disabled={locked} className={styles.cases}><legend>Circuitos que necesitás en esta obra</legend>{currentData.options.useCases.map(item=><label key={item.key}><input type="checkbox" checked={draft.useCases.includes(item.key)} onChange={()=>toggle(item.key)}/><span><strong>{item.label}</strong><small>{item.detail}</small></span></label>)}</fieldset>
    <label className={styles.consent}><input type="checkbox" required checked={draft.confirmOwnership} disabled={locked} onChange={event=>setDraft({...draft,confirmOwnership:event.target.checked})}/><span>Confirmo que preparo la conexión para esta empresa y esta obra. Esto no autoriza todavía a ObraSaaS ante Meta.</span></label>
    <div className={styles.actions}>{currentAttempt?<><button type="button" disabled={busy} onClick={recover}>Comprobar preparación</button>{canRetry&&currentAttempt.profile&&<button type="button" disabled={busy} onClick={retry}>Reenviar mismo intento</button>}</>:<button type="submit" disabled={busy||!draft.numberMode||!draft.useCases.length||Boolean(revisionReview&&!reviewed)}>Guardar preparación</button>}</div>
   </form>
   <section className={styles.progress} aria-labelledby="wa-connection-progress"><h4 id="wa-connection-progress">Preparación y pasos del alta</h4>
    <p className={styles.next}>{next.message} {next.requiresAssistance&&'La preparación se conserva; no inicies un alta dedicada para sustituir tu conexión actual.'}</p>
    {next.canConsultMeta&&<a className={styles.link} href="#customer-meta-title">Consultar autorización y conexión en Meta</a>}
    <ol>{currentData.readiness.steps.map(step=>{const inMetaPanel=['AUTHORIZATION','CONNECTION','TEMPLATES'].includes(step.key);return <li key={step.key}><span>{step.title}</span><strong data-status={inMetaPanel?'CONSULT_META':step.state}>{inMetaPanel?'Consultar conexión Meta':stateLabel(step.state)}</strong></li>;})}</ol>
    <p>Guardar esta preparación no registra un número, no cambia tu proveedor y no activa los circuitos seleccionados.</p>
    <p className={styles.note}>El panel «Autorizar WhatsApp con Meta» muestra la disponibilidad, el registro, las plantillas y la habilitación actual del canal. Estos pasos describen el recorrido; guardar la preparación no confirma su aceptación.</p>
   </section>
   </>}
  </>}
 </section>;
}
