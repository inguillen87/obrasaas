'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {workspaceActiveToken} from './workspace-session-request.mjs';
import {browserRecoveryJournal,RECOVERY_EVENT} from './workspace-recovery-journal.mjs';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import styles from './company-bootstrap-panel.module.css';
import {companyPhoneE164} from '../../../lib/company-phone-format.mjs';
const endpoint='/api/identity/company-onboarding';
const explanations={COMPANY_VERIFIED_PROFILE_REQUIRED:'No se pudo confirmar tu correo verificado. Comprobá tu cuenta y volvé a consultar el alta.',COMPANY_IDENTITY_PROVIDER_UNAVAILABLE:'No se pudo comprobar tu acceso. Conservamos tus datos; volvé a consultar.',IDENTITY_PROVIDER_UNAVAILABLE:'No se pudo renovar tu acceso. Conservamos tus datos; volvé a consultar.',COMPANY_CREATOR_ROLE_REQUIRED:'La organización activa requiere un administrador para completar el alta.',COMPANY_ALREADY_CONFIGURED:'Esta organización ya tiene una empresa. No se creó otra.',COMPANY_IDENTITY_CONFLICT:'La identidad coincide con un registro que no puede reasignarse automáticamente. No se fusionaron cuentas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Tu pertenencia a esta empresa no está habilitada.',WORKSPACE_CONTEXT_CHANGED:'Cambió la organización activa. Volvé a abrir la empresa correcta.',COMPANY_CREATION_LIMIT:'Se alcanzó el límite de nuevas empresas durante las últimas 24 horas.',COMPANY_INITIAL_DATES_INVALID:'Completá inicio y fin de cada tarea, o dejá ambos vacíos.',COMPANY_INITIAL_TASKS_DUPLICATED:'Dos tareas tienen el mismo título. Diferencialas antes de guardar.',SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.'};
const explain=code=>explanations[code]||'No se pudo confirmar el alta. No se agregaron datos de ejemplo ni se conectó WhatsApp.';
export function CompanyBootstrapPanel({organizationId,organizationName,getSessionToken,getProfileToken,children}){
 const [stage,setStage]=useState('checking'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(null),[receipt,setReceipt]=useState(null),[canRetry,setCanRetry]=useState(false);
 const [companyName,setCompanyName]=useState(organizationName||''),[projectName,setProjectName]=useState(''),[address,setAddress]=useState(''),[tasks,setTasks]=useState([]),[confirmed,setConfirmed]=useState(false);
 const [companyPhone,setCompanyPhone]=useState(''),[currentCompany,setCurrentCompany]=useState(null);
 const mounted=useRef(true),version=useRef(0),retainedProfileProof=useRef(null),request=useRef(null);
 const api=useCallback(async function(method,body=null,operationId=null,refreshProfile=false){
  const controller=new AbortController();request.current?.abort();request.current=controller;const signal=controller.signal;
  const timeout=setTimeout(()=>controller.abort(),20000);let dispatched=false;
  try{
  const token=await workspaceActiveToken(getSessionToken,{signal});if(!token)throw Object.assign(new Error(explain('SESSION_REQUIRED')),{status:401,code:'SESSION_REQUIRED'});
  const headers={Authorization:'Bearer '+token};
  if(method==='POST'){
   // Renew identity after a checked absence; the original command and UUID stay unchanged.
   let proof=refreshProfile?null:retainedProfileProof.current;
   if(!proof)proof=await workspaceActiveToken(getProfileToken,{signal});
   if(!proof)throw Object.assign(new Error(explain('COMPANY_VERIFIED_PROFILE_REQUIRED')),{status:403,code:'COMPANY_VERIFIED_PROFILE_REQUIRED'});
   retainedProfileProof.current=proof;
   headers['Content-Type']='application/json';headers['X-Obrasaas-Bootstrap-Profile']=proof;
  }
  if(signal.aborted)throw new DOMException('La consulta se canceló.','AbortError');
  const suffix=method==='GET'?'?'+new URLSearchParams({expectedClerkOrganizationId:organizationId,...(operationId?{operationId}:{})}):'';
  dispatched=true;
  const response=await fetch(endpoint+suffix,{method,headers,credentials:'same-origin',cache:'no-store',signal,...(body?{body:JSON.stringify(body)}:{})});
  const value=await response.json();if(signal.aborted)throw new DOMException('La consulta se canceló.','AbortError');
  if(!response.ok)throw Object.assign(new Error(explain(value.code)),{status:response.status,code:value.code});return value;
  }catch(error){error.requestDispatched=dispatched;throw error;}
  finally{clearTimeout(timeout);if(request.current===controller)request.current=null;}
 },[getSessionToken,getProfileToken,organizationId]);
 function accept(value,openWorkspace=false){
  if(value.created!==true||value.state!=='CREATED'||!value.receiptId||!value.projectId||!value.organizationId)throw new Error('Falta el recibo confirmado del alta.');
  setCurrentCompany(value.currentCompany||null);
  version.current++;retainedProfileProof.current=null;setBusy(false);setReceipt(value);setAttempt(null);setCanRetry(false);setStage(openWorkspace?'ready':'created');setNotice(openWorkspace?'Alta confirmada. Podés consultar el recibo original y continuar en tu espacio.':'Empresa y primera obra creadas. WhatsApp todavía no quedó conectado.');
 }
 async function inspect(){
  if(busy||attempt)return;setBusy(true);setNotice('');const current=++version.current;
  try{const value=await api('GET');if(!mounted.current||current!==version.current)return;
   if(value.state==='CREATED')accept(value,true);else if(value.state==='ALREADY_CONFIGURED'){setCurrentCompany(value.currentCompany||null);setStage('ready');}else if(value.state==='NOT_CREATED'&&value.canCreate===true)setStage('new');else throw new Error('No se pudo determinar el estado de la empresa.');
  }catch(error){if(mounted.current&&current===version.current){setNotice(error.message);setStage('failed');}}
  finally{if(mounted.current&&current===version.current)setBusy(false);}
 }
 useEffect(()=>{
  const epoch=version;mounted.current=true;let cancelled=false;const current=++epoch.current;
  api('GET').then(value=>{
   if(cancelled||!mounted.current||current!==version.current)return;
   if(value.state==='CREATED')accept(value,true);else if(value.state==='ALREADY_CONFIGURED'){setCurrentCompany(value.currentCompany||null);setStage('ready');}else if(value.state==='NOT_CREATED'&&value.canCreate===true)setStage('new');else throw new Error('No se pudo determinar el estado de la empresa.');
  }).catch(error=>{if(!cancelled&&mounted.current&&current===version.current){setNotice(error.message);setStage('failed');}});
  return()=>{cancelled=true;mounted.current=false;epoch.current++;request.current?.abort();retainedProfileProof.current=null;};
 },[api]);
 async function send(body,refreshProfile=false){
  const current=++version.current;setBusy(true);setCanRetry(false);setNotice('');
  try{const value=await api('POST',body,null,refreshProfile);if(mounted.current&&current===version.current)accept(value);}
  catch(error){if(mounted.current&&current===version.current){
   if(error.requestDispatched===false){setCanRetry(true);setNotice('No pudimos comprobar tu acceso. El alta no se envió. Conservamos los datos y el identificador de este intento. Volvé a comprobar o reenviar cuando el acceso esté disponible.');}
   else if(['SESSION_REQUIRED','SESSION_INVALID','COMPANY_VERIFIED_PROFILE_REQUIRED'].includes(error.code)){retainedProfileProof.current=null;setNotice(error.message+' Conservamos los datos y el intento; comprobá la creación antes de reenviar.');}
   else if(error.status&&error.status<500){retainedProfileProof.current=null;setAttempt(null);setNotice(error.message);}
   else setNotice('No recibimos la confirmación. Conservamos este intento: comprobá el alta antes de volver a crear una empresa.');
  }}
  finally{if(mounted.current&&current===version.current)setBusy(false);}
 }
 async function submit(event){
  event.preventDefault();if(busy||attempt||!confirmed)return;
  const normalizedPhone=companyPhone?companyPhoneE164(companyPhone):null;if(companyPhone&&!normalizedPhone){setNotice('Incluí + y código de país, con entre 8 y 15 dígitos. No se envió el alta.');return;}
  const body={operationId:crypto.randomUUID(),expectedClerkOrganizationId:organizationId,companyName,project:{name:projectName,address},initialTasks:tasks.map(({title,startsOn,endsOn})=>({title,startsOn,endsOn})),confirmNewCompany:true,...(normalizedPhone?{companyPhone:normalizedPhone}:{})};
  retainedProfileProof.current=null;setAttempt(body);await send(body);
 }
 async function retry(){if(!attempt||busy||!canRetry)return;await send(attempt,true);}
 async function recover(){
  if(!attempt||busy)return;const current=++version.current;setBusy(true);setCanRetry(false);
  try{const value=await api('GET',null,attempt.operationId);if(!mounted.current||current!==version.current)return;
   if(value.state==='CREATED')accept(value);else if(value.state==='ALREADY_CONFIGURED'){setCurrentCompany(value.currentCompany||null);retainedProfileProof.current=null;setAttempt(null);setStage('ready');}else if(['NOT_OBSERVED','NOT_CREATED'].includes(value.state)&&value.canCreate===true){setCanRetry(true);setNotice('Todavía no se observa el alta. Podés reenviar este mismo intento con su identificador y sus datos originales. Actualizaremos la verificación de tu cuenta. No se reenvía automáticamente.');}else throw new Error('No se pudo comprobar el alta de la empresa.');
  }catch(error){if(mounted.current&&current===version.current)setNotice(error.name==='AbortError'?'La consulta no se completó. Conservamos tu intento; volvé a comprobar.':error.message);}finally{if(mounted.current&&current===version.current)setBusy(false);}
 }
 const locked=busy||Boolean(attempt);
 const editTask=(index,key,value)=>setTasks(previous=>previous.map((task,i)=>i===index?{...task,[key]:value}:task));
 if(stage==='ready')return <><CompanyTrialExpiry company={currentCompany}/>{receipt&&<section className={styles.panel} aria-labelledby="company-receipt-heading"><h2 id="company-receipt-heading">Alta confirmada</h2><p>Este recibo confirma el alta original. Tu espacio de trabajo muestra el estado vigente.</p><details className={styles.created}><summary>Datos del alta</summary><dl><dt>Empresa declarada al crear el espacio</dt><dd>{receipt.companyName}</dd><dt>Primera obra registrada</dt><dd>{receipt.projectName}</dd><dt>Tareas cargadas en el plan inicial</dt><dd>{receipt.initialTaskCount}</dd></dl><p className={styles.caption}>La confirmación del alta no acredita una conexión de WhatsApp ni la aprobación de identidades.</p><small>Recibo: {receipt.receiptId}</small></details></section>}{children}</>;
 return <section className={styles.panel} aria-labelledby="company-bootstrap-heading">
  <p className={styles.eyebrow}>ALTA DE CONSTRUCTORA</p><h2 id="company-bootstrap-heading">Tu empresa, desde cero.</h2>
  <p className={styles.intro}>Creá el espacio de esta organización y su primera obra. No necesitás el número de WhatsApp para empezar a organizar el trabajo.</p>
  <div className={styles.flow}><span className={styles.current}>1 · Empresa y obra</span><span>2 · Tareas y equipo</span><span>3 · WhatsApp de la empresa</span></div>
  <p role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</p>
  {stage==='checking'&&<p>Comprobando la organización activa…</p>}
  {stage==='failed'&&<button type="button" disabled={busy} onClick={inspect}>Volver a comprobar</button>}
  {stage==='new'&&<form onSubmit={submit}>
   <div className={styles.fields}><label>Nombre de la empresa<input required minLength={2} maxLength={120} value={companyName} disabled={locked} onChange={event=>setCompanyName(event.target.value)} autoComplete="organization"/></label>
   <label>Nombre de la primera obra<input required minLength={2} maxLength={120} value={projectName} disabled={locked} onChange={event=>setProjectName(event.target.value)} placeholder="Por ejemplo: Edificio Centro"/></label></div>
   <label className={styles.address}>WhatsApp de la empresa <small>Opcional. Incluí + y código de país. Se guarda declarado, sin verificar; después autorizarás ese número en Meta.</small><input type="tel" autoComplete="tel" inputMode="tel" maxLength={27} pattern={String.raw`\+[1-9][0-9 \(\)\-]{7,25}`} style={{fontSize:16}} value={companyPhone} disabled={locked} onChange={event=>setCompanyPhone(event.target.value)}/></label>
   <label className={styles.address}>Dirección de la obra <small>Opcional; no verifica ubicación ni activa una geocerca.</small><input maxLength={300} value={address} disabled={locked} onChange={event=>setAddress(event.target.value)} autoComplete="street-address"/></label>
   <section className={styles.taskSection} aria-labelledby="initial-tasks-heading"><div className={styles.sectionTitle}><div><h3 id="initial-tasks-heading">Primeras tareas</h3><p>Opcionales. Sólo se crean las que cargues, con avance 0 %.</p></div><button type="button" onClick={()=>setTasks([...tasks,{key:crypto.randomUUID(),title:'',startsOn:'',endsOn:''}])} disabled={locked||tasks.length>=25}>Agregar tarea</button></div>
    {!tasks.length&&<p className={styles.empty}>El cronograma empezará vacío. Podrás agregar tareas después, sin etapas o porcentajes inventados.</p>}
    {tasks.map((task,index)=><div key={task.key} className={styles.taskRow}><label>Tarea {index+1}<input required minLength={2} maxLength={160} value={task.title} disabled={locked} onChange={event=>editTask(index,'title',event.target.value)}/></label><label>Inicio previsto<input type="date" value={task.startsOn} disabled={locked} onChange={event=>editTask(index,'startsOn',event.target.value)}/></label><label>Fin previsto<input type="date" min={task.startsOn||undefined} value={task.endsOn} disabled={locked} onChange={event=>editTask(index,'endsOn',event.target.value)}/></label><button type="button" disabled={locked} onClick={()=>setTasks(tasks.filter((_,i)=>i!==index))} aria-label={`Quitar tarea ${index+1}`}>Quitar</button></div>)}
   </section>
   <p id="company-trial-notice" className={styles.caption}>Al crear la empresa empieza una prueba de 15 días desde el alta. Después podés consultar su fecha y hora de vencimiento en esta cuenta. Recuperar un alta existente no reinicia la prueba.</p>
   <label className={styles.confirmation}><input type="checkbox" checked={confirmed} required disabled={locked} aria-describedby="company-trial-notice" onChange={event=>setConfirmed(event.target.checked)}/><span>Confirmo que quiero crear una empresa nueva para esta organización. No se importarán empleados, mensajes, gastos ni obras de otras empresas.</span></label>
   <p className={styles.caption}>Se comprobarán tu sesión de administrador y el correo verificado por Clerk. El nombre declarado no acredita una verificación legal de la empresa. El formulario no se conserva al recargar: se consultará el alta existente y no se reenviará automáticamente.</p>
   <div className={styles.actions}>{attempt?<><button type="button" disabled={busy} onClick={recover}>Comprobar creación</button>{canRetry&&<button type="button" disabled={busy} onClick={retry}>Reenviar mismo intento</button>}</>:<button className={styles.primary} type="submit" disabled={busy||!confirmed} aria-describedby="company-trial-notice">Crear empresa y primera obra</button>}</div>
  </form>}
  {stage==='created'&&receipt&&<><CompanyTrialExpiry company={currentCompany}/><div className={styles.created}><h3>El espacio está creado</h3><dl><dt>Empresa</dt><dd>{receipt.companyName}</dd><dt>Primera obra</dt><dd>{receipt.projectName}</dd><dt>Tareas iniciales</dt><dd>{receipt.initialTaskCount}</dd></dl><p>Sin empleados, movimientos económicos ni mensajes de ejemplo. El número y la autorización de Meta se completan por separado.</p><small>Recibo: {receipt.receiptId}</small><button type="button" className={styles.primary} onClick={()=>setStage('ready')}>Entrar a mi obra</button></div></>}
 </section>;
}

const trialExpiryFormatter=new Intl.DateTimeFormat('es-AR',{
 timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
});
function exactCompanyTrialLabel(value){
 // Only accept the additive server DTO: an exact ISO UTC instant with milliseconds.
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return null;
 const instant=new Date(value);
 if(!Number.isFinite(instant.getTime())||instant.toISOString()!==value)return null;
 return `${trialExpiryFormatter.format(instant)} (hora de Argentina)`;
}
function legacyCompanyTrialDate(value){
 // Validate the calendar only; the legacy date never supplies an invented expiry time.
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const day=new Date(value+'T00:00:00.000Z');
 return Number.isFinite(day.getTime())&&day.toISOString().slice(0,10)===value?value.split('-').reverse().join('/'):null;
}
export function CompanyTrialExpiry({company}){
 const exactLabel=exactCompanyTrialLabel(company?.trial?.endsAt),legacyDate=legacyCompanyTrialDate(company?.trial?.endsOn);
 const expiry=exactLabel?`vencimiento registrado ${exactLabel}.`:legacyDate?`vencimiento registrado ${legacyDate}; la hora exacta no está confirmada.`:'sin vencimiento exacto confirmado.';
 return company?<p style={{lineHeight:1.6,overflowWrap:'anywhere'}}>Prueba: {expiry} Esta fecha no confirma un plan pago.</p>:null;
}
export function CompanyPhoneDeclarationForm({company,projectId,scope,getSessionToken,onPending,nextStep=null}){
 const sessionRequest=useWorkspaceRequest(getSessionToken),mounted=useRef(true),active=useRef(null);
 const [snapshot,setSnapshot]=useState(company),[phone,setPhone]=useState(company.phoneDeclaration?.e164||''),[confirmed,setConfirmed]=useState(false),[attempt,setAttempt]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[canRetry,setCanRetry]=useState(false),[fresh,setFresh]=useState(true),[hidden,setHidden]=useState(false),[closed,setClosed]=useState(false);
 const [editing,setEditing]=useState(()=>!company.phoneDeclaration);
 const savedPhone=snapshot.phoneDeclaration?.e164||'',hasDeclaration=Boolean(savedPhone),samePhone=hasDeclaration&&companyPhoneE164(phone)===savedPhone;
 const dirty=!closed&&editing&&(phone!==savedPhone||confirmed),locked=busy||Boolean(attempt),authorized=snapshot.canDeclarePhone===true&&!hidden;
 const continuation=nextStep&&['wa-assistant-preparation-title','customer-meta-title','company-channel-title'].includes(nextStep.target)?nextStep:null;
 const summaryAction=useRef(null),returnFocus=useRef(false);
 useEffect(()=>{if(returnFocus.current&&!editing&&!attempt&&!hidden&&!closed){returnFocus.current=false;summaryAction.current?.focus();}},[editing,attempt,hidden,closed]);
 function finishEditing(){returnFocus.current=true;setEditing(false);}
 function continueToStep(event){const target=continuation&&document.getElementById(continuation.target);if(!target)return;event.preventDefault();target.scrollIntoView({block:'start',behavior:'auto'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;active.current?.abort();};},[]);
 useEffect(()=>{onPending?.(busy||!closed&&(Boolean(attempt)||dirty));return()=>onPending?.(false);},[busy,attempt,dirty,closed,onPending]);
 useEffect(()=>{let alive=true;const read=async()=>{try{const pending=(await browserRecoveryJournal.list(scope)).find(entry=>entry.resource==='company-onboarding'&&entry.expectedClerkOrganizationId===company.expectedClerkOrganizationId);if(alive&&pending)setAttempt(previous=>previous?.operationId===pending.operationId?previous:{operationId:pending.operationId,projectId:pending.projectId,scope:pending.scope});}catch{if(alive){setFresh(false);setNotice('No se pudieron consultar las referencias pendientes. No se enviará una nueva declaración.');}}};read();window.addEventListener(RECOVERY_EVENT,read);return()=>{alive=false;window.removeEventListener(RECOVERY_EVENT,read);};},[scope,company.expectedClerkOrganizationId]);
 const lastCompany=useRef(company);
 useEffect(()=>{if(lastCompany.current!==company){lastCompany.current=company;setSnapshot(company);setFresh(false);setConfirmed(false);}},[company]);
 const message=code=>({COMPANY_PHONE_INVALID:'Incluí + y código de país, sin internos ni texto.',COMPANY_PHONE_CONFLICT:'La declaración cambió. Consultá la versión actual sin perder tu edición.',COMPANY_PHONE_OPERATION_CONFLICT:'Este intento ya pertenece a otra declaración.',COMPANY_PHONE_INTEGRITY:'La declaración guardada necesita revisión.',WORKSPACE_MEMBERSHIP_REQUIRED:'Tu acceso a la empresa no está vigente.',COMPANY_CREATOR_ROLE_REQUIRED:'La declaración requiere al administrador de esta organización.'}[code]||'No se pudo confirmar la declaración. Comprobá su recibo antes de reenviar.');
 function validate(value,reference){
  if(value.scope!==(reference?.scope||scope)||value.projectId!==(reference?.projectId||projectId)||value.action!=='declare_company_phone'||value.organizationId!==company.organizationId||value.expectedClerkOrganizationId!==company.expectedClerkOrganizationId||value.currentCompany?.organizationId!==company.organizationId||value.currentCompany?.expectedClerkOrganizationId!==company.expectedClerkOrganizationId)throw new Error('La respuesta no corresponde a esta empresa. Conservamos el intento.');
  const next=value.currentCompany,stored=next.phoneDeclaration;
  if(typeof next.canDeclarePhone!=='boolean'||stored!=null&&(stored.version!==1||stored.status!=='UNVERIFIED'||typeof stored.e164!=='string'||!/^\+[1-9]\d{7,14}$/.test(stored.e164)||!Number.isSafeInteger(stored.revision)||stored.revision<1||!Number.isFinite(Date.parse(stored.declaredAt))))throw new Error('La declaración recibida necesita revisión.');
  if(reference&&value.operationId!==reference.operationId)throw new Error('El recibo no corresponde a este intento.');
  if(value.state==='RECORDED'&&(value.saved!==true||!/^company_phone_[a-f0-9]{64}$/.test(value.receipt?.id)||!Number.isSafeInteger(value.receipt.savedRevision)||typeof value.savedDeclarationIsCurrent!=='boolean'))throw new Error('Falta un recibo válido.');
  if(!['RECORDED','NOT_OBSERVED'].includes(value.state))throw new Error('La declaración sigue sin confirmar.');return value;
 }
 async function request(method,body=null,reference=null){
  const controller=new AbortController();active.current=controller;
  const query=new URLSearchParams({projectId:reference?.projectId||projectId,scope:reference?.scope||scope,expectedClerkOrganizationId:company.expectedClerkOrganizationId,action:'declare_company_phone',...(reference?{operationId:reference.operationId}:{})});
  return sessionRequest(method==='GET'?endpoint+'?'+query:endpoint,{method,signal:controller.signal,requestTimeoutMs:20000,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})},async response=>{let value;try{value=await response.json();}catch{if(response.ok)throw new Error('Respuesta sin confirmar.');}if(!response.ok)throw Object.assign(new Error(message(value?.code)),{status:response.status,code:value?.code});return validate(value,reference);});
 }
 function denied(error){if([401,403].includes(error.status)){setHidden(true);setPhone('');setConfirmed(false);setSnapshot(previous=>({...previous,phoneDeclaration:null,trial:null,canDeclarePhone:false}));setAttempt(previous=>previous?{operationId:previous.operationId,projectId:previous.projectId,scope:previous.scope}:null);}}
 async function send(body){
  if(busy)return;setBusy(true);setCanRetry(false);setNotice('');
  try{const value=await request('POST',body,body);if(!mounted.current)return;if(value.state!=='RECORDED')throw new Error('No se recibió el recibo.');setSnapshot(value.currentCompany);setPhone(value.currentCompany.phoneDeclaration?.e164||'');setAttempt(null);setConfirmed(false);setFresh(true);finishEditing();setNotice(value.savedDeclarationIsCurrent?'Número declarado, sin verificar. La conexión se autoriza por separado en Meta.':'Recibo recuperado; una declaración posterior ya cambió el número.');}
  catch(error){if(mounted.current){denied(error);setNotice(error.message+' Conservamos la referencia; no se reenvía automáticamente.');if(error.code==='COMPANY_PHONE_CONFLICT')setFresh(false);}}
  finally{if(mounted.current)setBusy(false);}
 }
 async function consult(){
  if(busy)return;setBusy(true);setCanRetry(false);
  try{const value=await request('GET',null,attempt);if(!mounted.current)return;setSnapshot(value.currentCompany);setHidden(false);setFresh(true);setConfirmed(false);
   if(attempt&&value.state==='RECORDED'){setAttempt(null);setPhone(value.currentCompany.phoneDeclaration?.e164||'');finishEditing();setNotice(value.savedDeclarationIsCurrent?'Recibo confirmado. El número permanece sin verificar.':'Recibo confirmado; se muestra una declaración posterior.');}
   else if(attempt){setCanRetry(Boolean(attempt.companyPhone)&&value.currentCompany.canDeclarePhone===true&&(value.currentCompany.phoneDeclaration?.revision||0)===attempt.expectedRevision);setNotice('Todavía no se observa este recibo. La consulta no declara perdido el guardado ni reenvía datos.');}
   else {if(!editing)setPhone(value.currentCompany.phoneDeclaration?.e164||'');setNotice(editing?'Versión vigente consultada. Tu edición se conserva; revisá el número antes de confirmar.':'Declaración vigente consultada. Guardar el número no conecta WhatsApp.');}
  }catch(error){if(mounted.current){denied(error);setNotice(error.message);}}finally{if(mounted.current)setBusy(false);}
 }
 function cancelDraft(){setPhone(savedPhone);setConfirmed(false);setCanRetry(false);if(hasDeclaration)finishEditing();setNotice('Borrador del número cancelado. No se guardó ningún cambio.');}
  function closeConsultation(){if(busy)return;setClosed(true);setPhone('');setConfirmed(false);setCanRetry(false);setFresh(false);setAttempt(previous=>previous?{operationId:previous.operationId,projectId:previous.projectId,scope:previous.scope}:null);setNotice('Consulta cerrada. Conservamos la referencia; no se reenvía ni se declara perdido el guardado.');}
  function submit(event){event.preventDefault();if(closed||!editing||!authorized||locked||!fresh||!confirmed)return;const normalizedPhone=companyPhoneE164(phone);if(!normalizedPhone){setNotice('Incluí + y código de país, con entre 8 y 15 dígitos. No se envió la declaración.');return;}if(normalizedPhone===savedPhone){setConfirmed(false);finishEditing();setNotice('Este número ya está declarado. No se guardó otro cambio ni se envió una verificación.');return;}const body={action:'declare_company_phone',operationId:crypto.randomUUID(),projectId,scope,expectedClerkOrganizationId:company.expectedClerkOrganizationId,companyPhone:normalizedPhone,expectedRevision:snapshot.phoneDeclaration?.revision||0,confirmDeclaration:true};setAttempt(body);send(body);}
 return <section className={styles.panel} aria-labelledby="company-phone-title"><h4 id="company-phone-title">Número de la empresa</h4><CompanyTrialExpiry company={hidden?null:snapshot}/>
  {!hidden&&<p>Declarado: <strong style={{overflowWrap:'anywhere'}}>{snapshot.phoneDeclaration?.e164||'Sin declarar'}</strong> · sin verificar. Guardarlo no conecta WhatsApp.</p>}
  <p role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</p>
  {authorized&&!closed&&(editing||Boolean(attempt))&&<form onSubmit={submit}><label>WhatsApp corporativo<input type="tel" inputMode="tel" autoComplete="tel" required maxLength={27} pattern={String.raw`\+[1-9][0-9 \(\)\-]{7,25}`} value={phone} disabled={locked} onChange={event=>{setPhone(event.target.value);setConfirmed(false);}} style={{fontSize:16}}/></label><p className={styles.caption}>Incluí + y código de país. Meta debe confirmar exactamente este número; no inferimos variantes.</p><label className={styles.confirmation} style={{minHeight:44}}><input type="checkbox" required checked={confirmed} disabled={locked||!fresh} onChange={event=>setConfirmed(event.target.checked)}/><span>Confirmo el número declarado para esta empresa.</span></label>{!attempt&&<button className={styles.primary} style={{fontSize:16}} type="submit" disabled={busy||!fresh||!confirmed||samePhone}>Guardar número declarado</button>}</form>}
  {authorized&&!closed&&!attempt&&editing&&samePhone&&<p className={styles.caption}>Este número ya está declarado. Para continuar con la conexión, cancelá esta edición; guardar de nuevo no lo verifica.</p>}
  {authorized&&!closed&&!attempt&&!editing&&hasDeclaration&&<div className={styles.nextStep}>
   <p><strong>Número guardado.</strong> Para usar WhatsApp, revisá la autorización y el estado de la conexión en Meta. Declarar el número no envía un código ni habilita el bot.</p>
   {fresh&&continuation&&<><p>{continuation.detail}</p><a ref={summaryAction} href={'#'+continuation.target} onClick={continueToStep}>{continuation.label}</a></>}
   <button ref={!continuation?summaryAction:undefined} style={{fontSize:16}} type="button" disabled={busy||!fresh} onClick={()=>{setPhone(savedPhone);setConfirmed(false);setEditing(true);setNotice('Editá el número sólo si necesitás cambiarlo. El guardado actual se conserva.');}}>Cambiar número declarado</button>
  </div>}
  <div className={styles.actions}>{!attempt&&!closed&&(dirty||editing&&hasDeclaration)&&<button style={{fontSize:16}} type="button" disabled={busy} onClick={cancelDraft}>Cancelar borrador del número</button>}{attempt&&!closed&&<button style={{fontSize:16}} type="button" disabled={busy} onClick={closeConsultation}>Cerrar consulta del número</button>}<button style={{fontSize:16}} type="button" disabled={busy} onClick={()=>{setClosed(false);consult();}}>{closed?'Reabrir consulta del número':attempt?'Comprobar recibo del número':'Consultar declaración vigente'}</button>{!closed&&canRetry&&attempt?.companyPhone&&<button style={{fontSize:16}} type="button" disabled={busy} onClick={()=>send(attempt)}>Reenviar mismo intento del número</button>}</div>
  <p className={styles.caption}>El borrador sólo permanece en esta pantalla. Al recargar se muestra la declaración guardada; no se envía de nuevo.</p>
 </section>;
}
