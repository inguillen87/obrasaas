'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import styles from './workspace.module.css';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {TaskCreatePanel} from './task-create-panel';
import {CustomerWhatsAppPanel} from './customer-whatsapp-panel';
import {SiteRegisterPanel} from './site-register-panel';
import {SitePurchasePanel} from './site-purchase-panel';
import {ParticipantPanel} from './participant-panel';
import {FieldOperationsPanel} from './field-operations-panel';
import {WorkerChannelPanel} from './worker-channel-panel';
import {MetaOnboardingPanel} from './meta-onboarding-panel';
import {OperationsStatusPanel} from './operations-status-panel';
const endpoint='/api/identity/workspace';
const messages={WORKSPACE_ORGANIZATION_REQUIRED:'Elegí una organización desde tu cuenta para consultar las obras asignadas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Tu organización activa todavía no tiene una pertenencia vigente vinculada a esta cuenta.',WORKSPACE_PROJECT_UNAVAILABLE:'Esta obra no está disponible con tus permisos actuales.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a cargar las obras antes de continuar.',SCHEDULE_REVISION_CHANGED:'Otra persona modificó la tarea. Actualizá el cronograma antes de volver a planificar.',SCHEDULE_PERMISSION_REQUIRED:'Tu rol actual no puede modificar la planificación.',SCHEDULE_UNCHANGED:'Las fechas son iguales a las registradas. No se hizo ningún cambio.',SCHEDULE_OPERATION_CONFLICT:'Este intento ya pertenece a otra solicitud. Comprobá su recibo antes de continuar.',SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar.',SCHEDULE_DATES_INVALID:'Revisá el inicio y el fin. El fin no puede ser anterior al inicio.',SCHEDULE_REASON_REQUIRED:'Explicá brevemente el motivo del cambio.'};
const describe=code=>messages[code]||'No se pudo confirmar la operación. No se reemplazaron los datos por ejemplos.';
async function requestWorkspace(transport,query='',options={}){
 return transport(endpoint+query,options,async response=>{
  const body=await response.json();if(!response.ok){const error=new Error(describe(body.code));error.code=body.code;error.status=response.status;throw error;}return body;
 });
}
const query=values=>'?' + new URLSearchParams(values).toString();
const statusLabel=value=>({BACKLOG:'Por iniciar',IN_PROGRESS:'En curso',DONE:'Finalizada',BLOCKED:'Bloqueada'}[value]||value);
const day=value=>value?Date.parse(value+'T00:00:00Z'):NaN;
function timeline(tasks){
 const valid=tasks.filter(t=>Number.isFinite(day(t.startsOn))&&Number.isFinite(day(t.endsOn))&&day(t.endsOn)>=day(t.startsOn));
 if(!valid.length)return null;const start=Math.min(...valid.map(t=>day(t.startsOn))),end=Math.max(...valid.map(t=>day(t.endsOn)))+86400000;
 return {start,end};
}
export function AccountWorkspace({getSessionToken}={}){
 const transport=useWorkspaceRequest(getSessionToken);
 const request=useCallback((query='',options={})=>requestWorkspace(transport,query,options),[transport]);
 const [account,setAccount]=useState(null),[view,setView]=useState(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[saving,setSaving]=useState(false),[receipt,setReceipt]=useState(null);
 const generation=useRef(0),controller=useRef(null),mounted=useRef(true);
 const [creatingTask,setTaskCreating]=useState(false),[modulePending,setModulePending]=useState({});
 const taskCreating=creatingTask||Object.values(modulePending).some(Boolean);
 const contextLocked=saving||Boolean(attempt)||taskCreating||Boolean(draft);
 const participantPending=useCallback(value=>setModulePending(old=>old.participants===value?old:{...old,participants:value}),[]);
 const fieldPending=useCallback(value=>setModulePending(old=>old.field===value?old:{...old,field:value}),[]);
 const channelPending=useCallback(value=>setModulePending(old=>old.channel===value?old:{...old,channel:value}),[]);
 const purchasePending=useCallback(value=>setModulePending(old=>old.purchase===value?old:{...old,purchase:value}),[]);
 const metaPending=useCallback(value=>setModulePending(old=>old.meta===value?old:{...old,meta:value}),[]);
 const registerPending=useCallback(value=>setModulePending(old=>old.register===value?old:{...old,register:value}),[]);
 const preparationPending=useCallback(value=>setModulePending(old=>old.preparation===value?old:{...old,preparation:value}),[]);
 const tasksChanged=useCallback(task=>{if(task?.id)setView(old=>old?{...old,tasks:old.tasks.map(t=>t.id===task.id?{...t,...task}:t)}:old);},[]);
 const range=useMemo(()=>timeline(view?.tasks||[]),[view]);
 useEffect(()=>{
  const epoch=generation;mounted.current=true;const abort=new AbortController();controller.current=abort;const current=++epoch.current;
  request('',{signal:abort.signal}).then(data=>{if(mounted.current&&current===generation.current)setAccount(data);}).catch(error=>{if(error.name!=='AbortError'&&mounted.current&&current===generation.current)setNotice(error.message);}).finally(()=>{if(mounted.current&&current===generation.current)setLoading(false);});
  return()=>{mounted.current=false;epoch.current++;abort.abort();controller.current?.abort();};
 },[request]);
 async function refresh(){
  if(contextLocked)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;
  setAccount(null);setView(null);setDraft(null);setReceipt(null);setNotice('');setLoading(true);
  try{const data=await request('',{signal:abort.signal});if(mounted.current&&current===generation.current)setAccount(data);}catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current)setNotice(error.message);}finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 async function open(projectId,append=false){
  if(!account||contextLocked)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;
  const cursor=append?view?.nextCursor:null;setNotice('');setLoading(true);if(!append){setView(null);setDraft(null);setReceipt(null);}
  try{
   const data=await request(query({projectId,scope:account.scope,...(cursor?{afterTask:cursor}:{})}),{signal:abort.signal});
   if(!mounted.current||current!==generation.current)return;
   if(data.scope!==account.scope||data.project.id!==projectId)throw new Error('La respuesta no coincide con la obra seleccionada.');
   setView(previous=>append?{...data,tasks:[...(previous?.tasks||[]),...data.tasks]}:data);
  }catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);if(error.status===401||error.status===403||error.code==='WORKSPACE_CONTEXT_CHANGED'){setAccount(null);setView(null);}}}
  finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 function applySaved(data){
  if(!mounted.current)return;
  if(data.scope!==account?.scope||data.task?.id!==draft?.task.id||data.saved!==true||!data.receipt?.id||data.receipt.taskId!==draft.task.id)throw new Error('No se pudo correlacionar el recibo con esta tarea.');
  setView(previous=>({...previous,tasks:previous.tasks.map(task=>task.id===data.task.id?data.task:task)}));setReceipt(data.receipt);setAttempt(null);setRetryAllowed(false);setDraft(null);setNotice('Planificación guardada con recibo. El avance ejecutado no fue modificado.');
 }
 async function sendAttempt(payload,retrying=false){
  const current=generation.current;
  setSaving(true);setNotice('');setAttempt(payload);setRetryAllowed(false);
  try{const data=await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});if(mounted.current&&current===generation.current)applySaved(data);}
  catch(error){if(mounted.current&&current===generation.current){if(retrying){setRetryAllowed(error.requestDispatched===false);setNotice(error.message+' Conservamos el intento anterior; comprobá su recibo antes de modificar la planificación.');}else if(error.requestDispatched===false||(error.status&&error.status<500)){setAttempt(null);setNotice(error.message);}else setNotice('El servidor no confirmó el guardado. Conservamos este intento: comprobá el recibo antes de modificar o reenviar.');}}
  finally{if(mounted.current&&current===generation.current)setSaving(false);}
 }
 async function save(event){
  event.preventDefault();if(saving||attempt||!draft||!view)return;
  await sendAttempt({operationId:crypto.randomUUID(),projectId:view.project.id,taskId:draft.task.id,scope:account.scope,expectedRevision:draft.task.revision,startsOn:draft.startsOn,endsOn:draft.endsOn,reason:draft.reason});
 }
 async function retry(){
  if(saving||!attempt||!retryAllowed)return;await sendAttempt(attempt,true);
 }
 async function recover(){
  if(saving||!attempt)return;const current=generation.current;setSaving(true);setRetryAllowed(false);
  try{const data=await request(query({projectId:attempt.projectId,scope:attempt.scope,operationId:attempt.operationId}),{signal:AbortSignal.timeout(15000)});
   if(mounted.current&&current===generation.current){if(data.scope!==account?.scope)throw new Error('La respuesta corresponde a otra organización.');if(data.state==='RECORDED')applySaved(data);else if(data.state==='NOT_OBSERVED'){setRetryAllowed(true);setNotice('No se observa un recibo todavía. Podés comprobar otra vez o reintentar exactamente la misma planificación; conservamos sus datos para evitar duplicados.');}else throw new Error('Todavía no se pudo comprobar el guardado. Conservamos el intento.');}
  }catch(error){if(mounted.current&&current===generation.current)setNotice(error.message);}finally{if(mounted.current&&current===generation.current)setSaving(false);}
 }
 return <section className={styles.workspace} aria-labelledby="workspace-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>ESPACIO DE TRABAJO</p><h2 id="workspace-title">Mis obras</h2></div><button type="button" onClick={refresh} disabled={contextLocked||loading}>Actualizar</button></div>
  <p className={styles.intro}>Obras y tareas del registro de tu organización. Cada consulta vuelve a comprobar tu acceso; esta vista no usa los datos ficticios de la demo.</p>
  <div role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</div>
  {loading&&<p className={styles.loading}>Consultando registros autorizados…</p>}
  {account&&<><div className={styles.context}><strong>{account.organizationName}</strong><span>{account.roleLabel}</span></div>
   {!account.projects.length&&!loading&&<p className={styles.empty}>No hay obras activas asignadas a tu cuenta. El responsable debe aprobar la pertenencia; no se creó una obra ni se asignó un rol automáticamente.</p>}
   <div className={styles.projects}>{account.projects.map(project=><button key={project.id} type="button" onClick={()=>open(project.id)} disabled={contextLocked} aria-pressed={view?.project.id===project.id}><span>{project.name}</span><small>Ver cronograma</small></button>)}</div>
   {account.projectsTruncated&&<p>Se muestran las primeras 100 obras autorizadas.</p>}
  </>}
  {view&&<section aria-labelledby="schedule-title" className={styles.schedule}>
   <div className={styles.heading}><div><p className={styles.eyebrow}>CRONOGRAMA REGISTRADO</p><h3 id="schedule-title">{view.project.name}</h3></div><span>{view.tasks.length} de {view.totalTasks} tareas</span></div>
   {view.canPlanSchedule&&!draft&&<TaskCreatePanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={setTaskCreating} onCreated={task=>setView(current=>current&&current.project.id===view.project.id?{...current,totalTasks:current.tasks.some(t=>t.id===task.id)?current.totalTasks:current.totalTasks+1,tasks:current.tasks.some(t=>t.id===task.id)?current.tasks.map(t=>t.id===task.id?task:t):[task,...current.tasks]}:current)}/> }
   {range&&<div className={styles.range}><span>{new Date(range.start).toISOString().slice(0,10)}</span><span>{new Date(range.end-86400000).toISOString().slice(0,10)}</span></div>}
   {!view.tasks.length&&<p className={styles.empty}>Esta obra todavía no tiene tareas registradas. No se generaron barras ni porcentajes de ejemplo.</p>}
   <div className={styles.tasks}>{view.tasks.map(task=>{
    const hasDates=range&&Number.isFinite(day(task.startsOn))&&Number.isFinite(day(task.endsOn))&&day(task.endsOn)>=day(task.startsOn);
    const progress=Number.isInteger(task.progress)&&task.progress>=0&&task.progress<=100?task.progress:null;
    return <article key={task.id} className={styles.task} data-task-id={task.id}>
     <div className={styles.taskHeading}><strong>{task.title}</strong><span>{statusLabel(task.status)}</span></div>
     <div className={styles.track} aria-label={hasDates?`Planificada desde ${task.startsOn} hasta ${task.endsOn}`:'Sin intervalo de planificación válido'}>{hasDates?<span className={styles.bar} style={{left:((day(task.startsOn)-range.start)/(range.end-range.start)*100)+'%',width:((day(task.endsOn)+86400000-day(task.startsOn))/(range.end-range.start)*100)+'%'}}/>:<span className={styles.noDates}>Sin fechas planificadas válidas</span>}</div>
     <div className={styles.taskFooter}><div><span>{task.startsOn||'Sin inicio'} → {task.endsOn||'Sin fin'}</span><small>Avance registrado: {progress===null?'Requiere revisión':`${progress} %`}</small></div>{view.canPlanSchedule&&<button type="button" disabled={contextLocked} onClick={()=>{setReceipt(null);setNotice('');setDraft({task,startsOn:task.startsOn||'',endsOn:task.endsOn||'',reason:''});}}>Planificar fechas</button>}</div>
    </article>;
   })}</div>
   {view.nextCursor&&<button type="button" disabled={loading||contextLocked} onClick={()=>open(view.project.id,true)}>Cargar más tareas</button>}
   {!view.canPlanSchedule&&<p className={styles.caption}>Tu rol permite consultar este cronograma, no modificarlo.</p>}
   {draft&&<form onSubmit={save} className={styles.form} aria-labelledby="schedule-edit-title"><h4 id="schedule-edit-title">Planificar: {draft.task.title}</h4><p>Revisá las fechas previstas y explicá el motivo. El cambio no certifica avance ni registra horas trabajadas.</p>
    <div className={styles.dates}><label>Inicio previsto<input type="date" required value={draft.startsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,startsOn:event.target.value})}/></label><label>Fin previsto<input type="date" required min={draft.startsOn||undefined} value={draft.endsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,endsOn:event.target.value})}/></label></div>
    <label>Motivo del cambio<textarea required minLength={8} maxLength={800} rows={3} value={draft.reason} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,reason:event.target.value})}/></label>
    <div className={styles.actions}>{attempt?<><button type="button" disabled={saving} onClick={recover}>{saving?'Comprobando…':'Comprobar guardado'}</button>{retryAllowed&&<button type="button" disabled={saving} onClick={retry}>Reintentar la misma planificación</button>}</>:<><button className={styles.primary} type="submit" disabled={saving}>Confirmar planificación</button><button type="button" disabled={saving} onClick={()=>setDraft(null)}>Cancelar</button></>}</div>
   </form>}
   {receipt&&<div className={styles.receipt}><strong>Cambio confirmado</strong><span>{receipt.after.startsOn} → {receipt.after.endsOn}</span><small>Recibo: {receipt.id}</small></div>}
  </section>}
  {view&&account?.canManageIntegrations&&<SiteRegisterPanel key={`register:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={registerPending}/> }
  {view&&<ParticipantPanel key={`participants:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={participantPending}/> }
  {view&&<WorkerChannelPanel key={`channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={channelPending}/> }
  {view&&<FieldOperationsPanel key={`field:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} onPending={fieldPending} onTasksChanged={tasksChanged}/> }
  {view&&account?.canManageIntegrations&&<SitePurchasePanel key={`purchases:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={purchasePending}/> }
  {view&&account?.canManageIntegrations&&<CustomerWhatsAppPanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={preparationPending}/> }
  {view&&account?.canManageIntegrations&&<MetaOnboardingPanel key={`meta:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={metaPending}/> }
  {view&&account?.canManageIntegrations&&<OperationsStatusPanel key={`operations:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken}/> }
 </section>;
}
