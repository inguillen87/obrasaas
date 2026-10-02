'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {workspaceActiveToken} from './workspace-session-request.mjs';
import styles from './company-bootstrap-panel.module.css';
const endpoint='/api/identity/company-onboarding';
const explanations={COMPANY_VERIFIED_PROFILE_REQUIRED:'No se pudo confirmar tu correo verificado. Comprobá tu cuenta y volvé a consultar el alta.',COMPANY_IDENTITY_PROVIDER_UNAVAILABLE:'No se pudo comprobar tu acceso. Conservamos tus datos; volvé a consultar.',IDENTITY_PROVIDER_UNAVAILABLE:'No se pudo renovar tu acceso. Conservamos tus datos; volvé a consultar.',COMPANY_CREATOR_ROLE_REQUIRED:'La organización activa requiere un administrador para completar el alta.',COMPANY_ALREADY_CONFIGURED:'Esta organización ya tiene una empresa. No se creó otra.',COMPANY_IDENTITY_CONFLICT:'La identidad coincide con un registro que no puede reasignarse automáticamente. No se fusionaron cuentas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Tu pertenencia a esta empresa no está habilitada.',WORKSPACE_CONTEXT_CHANGED:'Cambió la organización activa. Volvé a abrir la empresa correcta.',COMPANY_CREATION_LIMIT:'Se alcanzó el límite de nuevas empresas durante las últimas 24 horas.',COMPANY_INITIAL_DATES_INVALID:'Completá inicio y fin de cada tarea, o dejá ambos vacíos.',COMPANY_INITIAL_TASKS_DUPLICATED:'Dos tareas tienen el mismo título. Diferencialas antes de guardar.',SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.'};
const explain=code=>explanations[code]||'No se pudo confirmar el alta. No se agregaron datos de ejemplo ni se conectó WhatsApp.';
export function CompanyBootstrapPanel({organizationId,organizationName,getSessionToken,getProfileToken,children}){
 const [stage,setStage]=useState('checking'),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(null),[receipt,setReceipt]=useState(null),[canRetry,setCanRetry]=useState(false);
 const [companyName,setCompanyName]=useState(organizationName||''),[projectName,setProjectName]=useState(''),[address,setAddress]=useState(''),[tasks,setTasks]=useState([]),[confirmed,setConfirmed]=useState(false);
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
 function accept(value){
  if(value.created!==true||value.state!=='CREATED'||!value.receiptId||!value.projectId||!value.organizationId)throw new Error('Falta el recibo confirmado del alta.');
  version.current++;retainedProfileProof.current=null;setBusy(false);setReceipt(value);setAttempt(null);setCanRetry(false);setStage('created');setNotice('Empresa y primera obra creadas. WhatsApp todavía no quedó conectado.');
 }
 async function inspect(){
  if(busy||attempt)return;setBusy(true);setNotice('');const current=++version.current;
  try{const value=await api('GET');if(!mounted.current||current!==version.current)return;
   if(value.state==='ALREADY_CONFIGURED')setStage('ready');else if(value.state==='NOT_CREATED'&&value.canCreate===true)setStage('new');else throw new Error('No se pudo determinar el estado de la empresa.');
  }catch(error){if(mounted.current&&current===version.current){setNotice(error.message);setStage('failed');}}
  finally{if(mounted.current&&current===version.current)setBusy(false);}
 }
 useEffect(()=>{
  const epoch=version;mounted.current=true;let cancelled=false;const current=++epoch.current;
  api('GET').then(value=>{
   if(cancelled||!mounted.current||current!==version.current)return;
   if(value.state==='ALREADY_CONFIGURED')setStage('ready');else if(value.state==='NOT_CREATED'&&value.canCreate===true)setStage('new');else throw new Error('No se pudo determinar el estado de la empresa.');
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
  const body={operationId:crypto.randomUUID(),expectedClerkOrganizationId:organizationId,companyName,project:{name:projectName,address},initialTasks:tasks.map(({title,startsOn,endsOn})=>({title,startsOn,endsOn})),confirmNewCompany:true};
  retainedProfileProof.current=null;setAttempt(body);await send(body);
 }
 async function retry(){if(!attempt||busy||!canRetry)return;await send(attempt,true);}
 async function recover(){
  if(!attempt||busy)return;const current=++version.current;setBusy(true);setCanRetry(false);
  try{const value=await api('GET',null,attempt.operationId);if(!mounted.current||current!==version.current)return;
   if(value.state==='CREATED')accept(value);else if(value.state==='ALREADY_CONFIGURED'){retainedProfileProof.current=null;setAttempt(null);setStage('ready');}else if(['NOT_OBSERVED','NOT_CREATED'].includes(value.state)&&value.canCreate===true){setCanRetry(true);setNotice('Todavía no se observa el alta. Podés reenviar este mismo intento con su identificador y sus datos originales. Actualizaremos la verificación de tu cuenta. No se reenvía automáticamente.');}else throw new Error('No se pudo comprobar el alta de la empresa.');
  }catch(error){if(mounted.current&&current===version.current)setNotice(error.name==='AbortError'?'La consulta no se completó. Conservamos tu intento; volvé a comprobar.':error.message);}finally{if(mounted.current&&current===version.current)setBusy(false);}
 }
 const locked=busy||Boolean(attempt);
 const editTask=(index,key,value)=>setTasks(previous=>previous.map((task,i)=>i===index?{...task,[key]:value}:task));
 if(stage==='ready')return children;
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
   <label className={styles.address}>Dirección de la obra <small>Opcional; no verifica ubicación ni activa una geocerca.</small><input maxLength={300} value={address} disabled={locked} onChange={event=>setAddress(event.target.value)} autoComplete="street-address"/></label>
   <section className={styles.taskSection} aria-labelledby="initial-tasks-heading"><div className={styles.sectionTitle}><div><h3 id="initial-tasks-heading">Primeras tareas</h3><p>Opcionales. Sólo se crean las que cargues, con avance 0 %.</p></div><button type="button" onClick={()=>setTasks([...tasks,{key:crypto.randomUUID(),title:'',startsOn:'',endsOn:''}])} disabled={locked||tasks.length>=25}>Agregar tarea</button></div>
    {!tasks.length&&<p className={styles.empty}>El cronograma empezará vacío. Podrás agregar tareas después, sin etapas o porcentajes inventados.</p>}
    {tasks.map((task,index)=><div key={task.key} className={styles.taskRow}><label>Tarea {index+1}<input required minLength={2} maxLength={160} value={task.title} disabled={locked} onChange={event=>editTask(index,'title',event.target.value)}/></label><label>Inicio previsto<input type="date" value={task.startsOn} disabled={locked} onChange={event=>editTask(index,'startsOn',event.target.value)}/></label><label>Fin previsto<input type="date" min={task.startsOn||undefined} value={task.endsOn} disabled={locked} onChange={event=>editTask(index,'endsOn',event.target.value)}/></label><button type="button" disabled={locked} onClick={()=>setTasks(tasks.filter((_,i)=>i!==index))} aria-label={`Quitar tarea ${index+1}`}>Quitar</button></div>)}
   </section>
   <label className={styles.confirmation}><input type="checkbox" checked={confirmed} required disabled={locked} onChange={event=>setConfirmed(event.target.checked)}/><span>Confirmo que quiero crear una empresa nueva para esta organización. No se importarán empleados, mensajes, gastos ni obras de otras empresas.</span></label>
   <p className={styles.caption}>Se comprobarán tu sesión de administrador y el correo verificado por Clerk. El nombre declarado no acredita una verificación legal de la empresa.</p>
   <div className={styles.actions}>{attempt?<><button type="button" disabled={busy} onClick={recover}>Comprobar creación</button>{canRetry&&<button type="button" disabled={busy} onClick={retry}>Reenviar mismo intento</button>}</>:<button className={styles.primary} type="submit" disabled={busy||!confirmed}>Crear empresa y primera obra</button>}</div>
  </form>}
  {stage==='created'&&receipt&&<div className={styles.created}><h3>El espacio está creado</h3><dl><dt>Empresa</dt><dd>{receipt.companyName}</dd><dt>Primera obra</dt><dd>{receipt.projectName}</dd><dt>Tareas iniciales</dt><dd>{receipt.initialTaskCount}</dd></dl><p>Sin empleados, movimientos económicos ni mensajes de ejemplo. El número y la autorización de Meta se completan por separado.</p><small>Recibo: {receipt.receiptId}</small><button type="button" className={styles.primary} onClick={()=>setStage('ready')}>Entrar a mi obra</button></div>}
 </section>;
}
