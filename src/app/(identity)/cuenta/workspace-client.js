'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Building2,FolderKanban,LoaderCircle,RefreshCw,Check,ArrowUpRight,LockKeyhole} from 'lucide-react';
import styles from './workspace.module.css';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {TaskCreatePanel} from './task-create-panel';
import {CustomerWhatsAppPanel} from './customer-whatsapp-panel';
import {SiteRegisterPanel} from './site-register-panel';
import {SitePurchasePanel} from './site-purchase-panel';
import {MaterialInventoryPanel} from './material-inventory-panel';
import {ParticipantPanel} from './participant-panel';
import {FieldOperationsPanel} from './field-operations-panel';
import {WorkerChannelPanel} from './worker-channel-panel';
import {CompanyChannelPanel} from './company-channel-panel';
import {MetaOnboardingPanel} from './meta-onboarding-panel';
import {OperationsStatusPanel} from './operations-status-panel';
import {WorkspaceRecoveryPanel} from './workspace-recovery-panel';
import {CustomerInboxPanel} from './customer-inbox-panel';
import {TemplateSendPanel} from './template-send-panel';
import {ConstructorCrmPanel} from './constructor-crm-panel';
import {DemoPilotPanel} from './demo-pilot-panel';
import {WorkspaceToolsNavigation} from './workspace-tools-navigation';
import {ScheduleWorkbench} from './schedule-workbench';
import {PlanImportPanel} from './plan-import-panel';
import {mergeLoadedTasks} from './schedule-workbench.mjs';
const endpoint='/api/identity/workspace';
const messages={WORKSPACE_ORGANIZATION_REQUIRED:'Elegí una organización desde tu cuenta para consultar las obras asignadas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Tu organización activa todavía no tiene una pertenencia vigente vinculada a esta cuenta.',WORKSPACE_PROJECT_UNAVAILABLE:'Esta obra no está disponible con tus permisos actuales.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a cargar las obras antes de continuar.',SCHEDULE_REVISION_CHANGED:'Otra persona modificó la tarea. Actualizá el cronograma antes de volver a planificar.',SCHEDULE_PERMISSION_REQUIRED:'Tu rol actual no puede modificar la planificación.',SCHEDULE_UNCHANGED:'Las fechas son iguales a las registradas. No se hizo ningún cambio.',SCHEDULE_OPERATION_CONFLICT:'Este intento ya pertenece a otra solicitud. Comprobá su recibo antes de continuar.',SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar.',SCHEDULE_DATES_INVALID:'Revisá el inicio y el fin. El fin no puede ser anterior al inicio.',SCHEDULE_REASON_REQUIRED:'Explicá brevemente el motivo del cambio.'};
const describe=code=>messages[code]||'No se pudo confirmar la operación. No se reemplazaron los datos por ejemplos.';
async function requestWorkspace(transport,query='',options={}){
 return transport(endpoint+query,options,async response=>{
  const body=await response.json();if(!response.ok){const error=new Error(describe(body.code));error.code=body.code;error.status=response.status;throw error;}return body;
 });
}
const query=values=>'?' + new URLSearchParams(values).toString();
export function AccountWorkspace({getSessionToken}={}){
 const transport=useWorkspaceRequest(getSessionToken);
 const request=useCallback((query='',options={})=>requestWorkspace(transport,query,options),[transport]);
 const [account,setAccount]=useState(null),[view,setView]=useState(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[saving,setSaving]=useState(false),[receipt,setReceipt]=useState(null);
 const generation=useRef(0),controller=useRef(null),mounted=useRef(true);
 const [channelSnapshot,setChannelSnapshot]=useState(null),[observationEpoch,setObservationEpoch]=useState(0),onboardingContext=useRef(null);
 useLayoutEffect(()=>{onboardingContext.current=account&&view?{scope:account.scope,projectId:view.project.id,generation:observationEpoch}:null;return()=>{onboardingContext.current=null;};},[account,view,observationEpoch]);
 const channelObserved=useCallback(value=>{const context=onboardingContext.current;if(!context||value.scope!==context.scope||value.projectId!==context.projectId||value.observedGeneration!==context.generation)return;setChannelSnapshot(value.snapshot?{...value.snapshot,observedGeneration:value.observedGeneration}:null);},[]);
 const navigateOnboarding=useCallback(value=>{const context=onboardingContext.current;if(!context||value.scope!==context.scope||value.projectId!==context.projectId)return;const id=value.target==='worker-channel'?'worker-channel-title':'pending-receipts-title',target=document.getElementById(id);if(!target)return;target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});},[]);
 const [creatingTask,setTaskCreating]=useState(false),[modulePending,setModulePending]=useState({});
 const [planReadback,setPlanReadback]=useState(null);
 const planReadbackMatches=Boolean(planReadback&&planReadback.scope===account?.scope&&planReadback.projectId===view?.project.id);
 const planReadbackPending=planReadbackMatches&&planReadback.status==='pending';
 const taskCreating=creatingTask||Object.values(modulePending).some(Boolean);
 const contextLocked=saving||Boolean(attempt)||taskCreating||Boolean(draft)||planReadbackPending;
 const scheduleEditor=useRef(null),editingTaskId=draft?.task?.id;
 useEffect(()=>{if(editingTaskId){scheduleEditor.current?.focus({preventScroll:true});scheduleEditor.current?.scrollIntoView({block:'start',behavior:'auto'});}},[editingTaskId]);
 const participantPending=useCallback(value=>setModulePending(old=>old.participants===value?old:{...old,participants:value}),[]);
 const fieldPending=useCallback(value=>setModulePending(old=>old.field===value?old:{...old,field:value}),[]);
 const channelPending=useCallback(value=>setModulePending(old=>old.channel===value?old:{...old,channel:value}),[]);
 const companyChannelPending=useCallback(value=>setModulePending(old=>old.companyChannel===value?old:{...old,companyChannel:value}),[]);
 const purchasePending=useCallback(value=>setModulePending(old=>old.purchase===value?old:{...old,purchase:value}),[]);
 const inventoryPending=useCallback(value=>setModulePending(old=>old.inventory===value?old:{...old,inventory:value}),[]);
 const metaPending=useCallback(value=>setModulePending(old=>old.meta===value?old:{...old,meta:value}),[]);
 const registerPending=useCallback(value=>setModulePending(old=>old.register===value?old:{...old,register:value}),[]);
 const preparationPending=useCallback(value=>setModulePending(old=>old.preparation===value?old:{...old,preparation:value}),[]);
 const inboxPending=useCallback(value=>setModulePending(old=>old.inbox===value?old:{...old,inbox:value}),[]);
 const templatePending=useCallback(value=>setModulePending(old=>old.template===value?old:{...old,template:value}),[]);
 const crmPending=useCallback(value=>setModulePending(old=>old.crm===value?old:{...old,crm:value}),[]);
 const demoPending=useCallback(value=>setModulePending(old=>old.demo===value?old:{...old,demo:value}),[]);
 const planPending=useCallback(value=>setModulePending(old=>old.plan===value?old:{...old,plan:value}),[]);
 const tasksChanged=useCallback(task=>{if(task?.id)setView(old=>old?{...old,tasks:old.tasks.map(t=>t.id===task.id?{...t,...task}:t)}:old);},[]);
 useEffect(()=>{
  const epoch=generation;mounted.current=true;const abort=new AbortController();controller.current=abort;const current=++epoch.current;setObservationEpoch(current);setChannelSnapshot(null);
  request('',{signal:abort.signal}).then(data=>{if(mounted.current&&current===generation.current)setAccount(data);}).catch(error=>{if(error.name!=='AbortError'&&mounted.current&&current===generation.current)setNotice(error.message);}).finally(()=>{if(mounted.current&&current===generation.current){setLoading(false);setPlanReadback(null);}});
  return()=>{mounted.current=false;epoch.current++;abort.abort();controller.current?.abort();};
 },[request]);
 async function refresh(){
  if(contextLocked)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  setAccount(null);setView(null);setDraft(null);setReceipt(null);setPlanReadback(null);setNotice('');setLoading(true);
  try{const data=await request('',{signal:abort.signal});if(mounted.current&&current===generation.current)setAccount(data);}catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current)setNotice(error.message);}finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 async function open(projectId,append=false){
  if(!account||contextLocked)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  const cursor=append?view?.nextCursor:null;setPlanReadback(null);setNotice('');setLoading(true);if(!append){setView(null);setDraft(null);setReceipt(null);}
  try{
   const data=await request(query({projectId,scope:account.scope,...(cursor?{afterTask:cursor}:{})}),{signal:abort.signal});
   if(!mounted.current||current!==generation.current)return;
   if(data.scope!==account.scope||data.project.id!==projectId)throw new Error('La respuesta no coincide con la obra seleccionada.');
   setView(previous=>append?{...data,tasks:mergeLoadedTasks(previous?.tasks||[],data.tasks)}:data);
  }catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);if(error.status===401||error.status===403||error.code==='WORKSPACE_CONTEXT_CHANGED'){setAccount(null);setView(null);}}}
  finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 async function readRecordedSchedule(target){
  if(!mounted.current||target.scope!==account?.scope||target.projectId!==view?.project.id)return;
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  const context={scope:target.scope,projectId:target.projectId,generation:current,kind:target.kind==='task'?'task':'plan'};
  const label=context.kind==='task'?'La tarea':'El plan';
  setPlanReadback({...context,status:'pending'});setLoading(true);setNotice(label+' tiene un recibo confirmado. Consultando el cronograma actualizado…');
  try{
   // A receipt's tasks may be outside the loaded page and already included in
   // count(*), especially after reload. Read the total and cursor together.
   const data=await request(query({projectId:context.projectId,scope:context.scope}),{signal:abort.signal});
   if(!mounted.current||current!==generation.current)return;
   if(data.scope!==context.scope||data.project?.id!==context.projectId)throw new Error('La respuesta no coincide con la obra seleccionada.');
   setView(previous=>previous?.scope===context.scope&&previous.project.id===context.projectId?data:previous);
   setPlanReadback(null);setNotice('Cronograma actualizado desde los registros de la obra. '+(context.kind==='task'?'El total incluye la tarea creada.':'El total incluye las tareas del plan aplicado.'));
  }catch(error){
   if(mounted.current&&current===generation.current){
    setPlanReadback({...context,status:'failed'});setNotice(label+' tiene un recibo confirmado, pero no pudimos actualizar el cronograma. '+(error.name==='AbortError'?'La consulta venció.':error.message)+' Volvé a consultar el cronograma para comprobar el total.');
    if(error.status===401||error.status===403||error.code==='WORKSPACE_CONTEXT_CHANGED'){setAccount(null);setView(null);setPlanReadback(null);}
   }
  }finally{if(mounted.current&&current===generation.current)setLoading(false);}
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
 return <section className={styles.workspace} aria-labelledby="workspace-title" aria-busy={loading}>
  <div className={styles.heading}><div><p className={styles.eyebrow}>ESPACIO DE TRABAJO</p><h2 id="workspace-title">Mis obras</h2><p className={styles.intro}>Elegí dónde trabajar. Las tareas, el equipo y los registros quedan en la obra seleccionada.</p></div><button type="button" className={styles.refresh} onClick={refresh} disabled={contextLocked||loading} aria-describedby={contextLocked?'workspace-context-lock':undefined}><RefreshCw size={16} aria-hidden="true"/>Actualizar</button></div>
  <div role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</div>
  {planReadbackMatches&&planReadback.status==='failed'&&<button type="button" disabled={loading||contextLocked} onClick={()=>readRecordedSchedule(planReadback)}>Volver a consultar el cronograma</button>}
  {loading&&<p className={styles.loading}><LoaderCircle size={18} className={styles.spinner} aria-hidden="true"/>Consultando registros autorizados…</p>}
  {contextLocked&&<p className={styles.contextLock} id="workspace-context-lock"><LockKeyhole size={16} aria-hidden="true"/><span>Hay una acción en curso. Completala, cancelá el borrador o comprobá su resultado antes de actualizar o cambiar de obra.</span></p>}
  {account&&<><div className={styles.context}><div className={styles.company}><Building2 size={22} aria-hidden="true"/><div><span>Empresa</span><strong>{account.organizationName}</strong></div></div><dl className={styles.contextDetails}><div><dt>Tu acceso</dt><dd>{account.roleLabel}</dd></div><div><dt>Obra activa</dt><dd>{view?.project.name||'Sin seleccionar'}</dd></div></dl></div>
   <WorkspaceRecoveryPanel key={account.scope} scope={account.scope} projects={account.projects} getSessionToken={getSessionToken} onRecovered={(result,reference)=>{if(reference?.resource==='plan-import'&&result.scope===reference.scope&&result.projectId===reference.projectId&&result.saved===true&&result.receiptId&&result.action==='APPLY'&&result.draft?.status==='APPLIED')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'plan'});else if(result.created===true&&result.task&&reference?.resource==='task-creation')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'task'});else if(result.task)tasksChanged(result.task);}}/>
   {!account.projects.length&&!loading&&<div className={styles.empty}><FolderKanban size={25} aria-hidden="true"/><strong>No hay obras activas asignadas a tu cuenta.</strong><p>Pedile al responsable que revise tu pertenencia y la obra asignada. Podés volver a actualizar cuando confirme el acceso.</p></div>}
   {account.projects.length>0&&<div className={styles.projectCollection}><div className={styles.collectionHeading}><h3>Obras disponibles</h3><span>{account.projects.length}{account.projectsTruncated?' mostradas':account.projects.length===1?' asignada':' asignadas'}</span></div><div className={styles.projects}>{account.projects.map(project=><button key={project.id} type="button" onClick={()=>open(project.id)} disabled={contextLocked} aria-pressed={view?.project.id===project.id}><span className={styles.projectName}><FolderKanban size={18} aria-hidden="true"/><span>{project.name}</span></span><small>{view?.project.id===project.id?<><Check size={14} aria-hidden="true"/>Seleccionada</>:<>Abrir obra<ArrowUpRight size={14} aria-hidden="true"/></>}</small></button>)}</div></div>}
   {account.projectsTruncated&&<p>Se muestran las primeras 100 obras autorizadas.</p>}
   {account.projects.length>0&&!view&&!loading&&<div className={styles.startState}><strong>Abrí una obra para empezar</strong><p>Consultá el cronograma, registrá el trabajo y accedé a las herramientas disponibles para tu rol.</p></div>}
  </>}
  {view&&<div className={styles.workbench}><WorkspaceToolsNavigation role={account?.role} canManageIntegrations={account?.canManageIntegrations} canImportPlan={view.canPlanSchedule} pending={modulePending} schedulePending={saving||Boolean(attempt)||Boolean(draft)||creatingTask} scheduleEditing={Boolean(draft)}/><div className={styles.modules}>
  {view&&<section aria-labelledby="schedule-title" className={styles.schedule}>
   <div className={styles.heading}><div><p className={styles.eyebrow}>CRONOGRAMA REGISTRADO</p><h3 id="schedule-title">{view.project.name}</h3></div><span>{view.tasks.length} de {view.totalTasks} tareas</span></div>
   {view.canPlanSchedule&&!draft&&<TaskCreatePanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={setTaskCreating} locked={planReadbackPending||Boolean(modulePending.plan)} onCreated={()=>readRecordedSchedule({scope:account.scope,projectId:view.project.id,kind:'task'})}/> }
   {view.canPlanSchedule&&!draft&&<PlanImportPanel key={`plan:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={planPending} locked={saving||Boolean(attempt)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='plan'&&value)} onApplied={()=>readRecordedSchedule({scope:account.scope,projectId:view.project.id,kind:'plan'})}/>}
   <ScheduleWorkbench key={`schedule:${account.scope}:${view.project.id}`} tasks={view.tasks} totalTasks={view.totalTasks} nextCursor={view.nextCursor} canPlan={view.canPlanSchedule} locked={contextLocked} onPlan={task=>{setReceipt(null);setNotice('');setDraft({task,startsOn:task.startsOn||'',endsOn:task.endsOn||'',reason:''});}}/>
   {view.nextCursor&&<button type="button" disabled={loading||contextLocked} onClick={()=>open(view.project.id,true)}>Cargar más tareas</button>}
   {!view.canPlanSchedule&&<p className={styles.caption}>Tu rol permite consultar este cronograma, no modificarlo.</p>}
   {draft&&<form onSubmit={save} className={styles.form} aria-labelledby="schedule-edit-title"><h4 id="schedule-edit-title" ref={scheduleEditor} tabIndex={-1}>Planificar: {draft.task.title}</h4><p>Revisá las fechas previstas y explicá el motivo. El cambio no certifica avance ni registra horas trabajadas.</p>
    <div className={styles.dates}><label>Inicio previsto<input type="date" required value={draft.startsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,startsOn:event.target.value})}/></label><label>Fin previsto<input type="date" required min={draft.startsOn||undefined} value={draft.endsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,endsOn:event.target.value})}/></label></div>
    <label>Motivo del cambio<textarea required minLength={8} maxLength={800} rows={3} value={draft.reason} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,reason:event.target.value})}/></label>
    <div className={styles.actions}>{attempt?<><button type="button" disabled={saving} onClick={recover}>{saving?'Comprobando…':'Comprobar guardado'}</button>{retryAllowed&&<button type="button" disabled={saving} onClick={retry}>Reintentar la misma planificación</button>}</>:<><button className={styles.primary} type="submit" disabled={saving}>Confirmar planificación</button><button type="button" disabled={saving} onClick={()=>setDraft(null)}>Cancelar</button></>}</div>
   </form>}
   {receipt&&<div className={styles.receipt}><strong>Cambio confirmado</strong><span>{receipt.after.startsOn} → {receipt.after.endsOn}</span><small>Recibo: {receipt.id}</small></div>}
  </section>}
  {view&&account?.canManageIntegrations&&<SiteRegisterPanel key={`register:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={registerPending}/> }
  {view&&<ParticipantPanel key={`participants:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={participantPending} channelSnapshot={channelSnapshot?.scope===account.scope&&channelSnapshot.projectId===view.project.id&&channelSnapshot.observedGeneration===observationEpoch?channelSnapshot:null} onNavigate={navigateOnboarding}/> }
  {view&&<WorkerChannelPanel key={`channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={channelPending} observationEpoch={observationEpoch} onSnapshot={channelObserved}/> }
  {view&&(account?.role==='ADMIN'||account?.canManageIntegrations)&&<CompanyChannelPanel key={`company-channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={companyChannelPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='companyChannel'&&value)}/> }
  {view&&account?.role==='ADMIN'&&<DemoPilotPanel key={`demo:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={demoPending}/> }
  {view&&<FieldOperationsPanel key={`field:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} onPending={fieldPending} onTasksChanged={tasksChanged}/> }
  {view&&<MaterialInventoryPanel key={`inventory:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} onPending={inventoryPending}/> }
  {view&&account?.canManageIntegrations&&<SitePurchasePanel key={`purchases:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={purchasePending}/> }
  {view&&account?.canManageIntegrations&&<CustomerWhatsAppPanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={preparationPending}/> }
  {view&&account?.canManageIntegrations&&<MetaOnboardingPanel key={`meta:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={metaPending}/> }
  {view&&account?.canManageIntegrations&&<CustomerInboxPanel key={`inbox:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={inboxPending}/> }
  {view&&account?.canManageIntegrations&&<TemplateSendPanel key={`template-send:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={templatePending}/> }
  {view&&account?.role==='ADMIN'&&<ConstructorCrmPanel key={`crm:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={crmPending}/> }
  {view&&account?.canManageIntegrations&&<OperationsStatusPanel key={`operations:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken}/> }
  </div></div>}
 </section>;
}
