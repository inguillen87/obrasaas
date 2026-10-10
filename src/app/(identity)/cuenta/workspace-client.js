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
import {participantOnboardingNavigationTarget} from './participant-onboarding-next-step.mjs';
import {FieldOperationsPanel} from './field-operations-panel';
import {WorkerChannelPanel} from './worker-channel-panel';
import {CompanyChannelPanel} from './company-channel-panel';
import {OwnCompanyNumberPanel} from './own-company-number-panel';
import {OwnCompanyTemplatesPanel} from './own-company-templates-panel';
import {CompanyBillingPanel} from './company-billing-panel';
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
import {ProjectPreparationPanel} from './project-preparation-panel';
import {PortfolioOverviewPanel} from './portfolio-overview-panel';
import {OfficeReviewPanel,OfficeReviewAdminPanel} from './office-review-panel';
import {ProjectCreationPanel} from './project-creation-panel';
import {projectCreationReceiptOutcome} from './workspace-recovery-journal.mjs';
import {loadedScheduleOverview,mergeLoadedTasks,refreshLoadedTasks,updateLoadedTask} from './schedule-workbench.mjs';
const endpoint='/api/identity/workspace';
const messages={WORKSPACE_ORGANIZATION_REQUIRED:'Elegí una organización desde tu cuenta para consultar las obras asignadas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Todavía no podemos confirmar tu pertenencia vigente a esta empresa en ObraSaaS. Si ya aceptaste la invitación, pedile al administrador que habilite tu rol desde Permisos de las cuentas en la empresa. Cuando lo confirme, usá Actualizar en Mis obras.',WORKSPACE_PROJECT_UNAVAILABLE:'Esta obra no está disponible con tus permisos actuales.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a cargar las obras antes de continuar.',SCHEDULE_REVISION_CHANGED:'Otra persona modificó la tarea. Actualizá el cronograma antes de volver a planificar.',SCHEDULE_PERMISSION_REQUIRED:'Tu rol actual no puede modificar la planificación.',SCHEDULE_UNCHANGED:'Las fechas son iguales a las registradas. No se hizo ningún cambio.',SCHEDULE_OPERATION_CONFLICT:'Este intento ya pertenece a otra solicitud. Comprobá su recibo antes de continuar.',SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar.',SCHEDULE_DATES_INVALID:'Revisá el inicio y el fin. El fin no puede ser anterior al inicio.',SCHEDULE_REASON_REQUIRED:'Explicá brevemente el motivo del cambio.'};
const describe=code=>code==='PARTICIPANT_KYC_REVIEW_REQUIRED'?'Tu identidad necesita una revisión vigente para habilitar esta obra. Podés presentar o consultar tu documentación privada.':messages[code]||'No se pudo confirmar la operación. No se reemplazaron los datos por ejemplos.';
async function requestWorkspace(transport,query='',options={}){
 return transport(endpoint+query,options,async response=>{
  if(!response.ok){
   const error=new Error(describe(response.status===401?'SESSION_REQUIRED':response.status===403?'WORKSPACE_PROJECT_UNAVAILABLE':null));error.status=response.status;
   if(response.headers.get('content-type')?.includes('application/json'))try{const body=await response.json();if(typeof body?.code==='string'){error.code=body.code;error.message=describe(body.code);}}catch{}
   throw error;
  }
  try{return await response.json();}catch(error){if(error.name==='AbortError'||error.name==='TimeoutError')throw error;throw new Error('No pudimos leer la respuesta de la obra. Volvé a consultar antes de continuar.');}
 });
}
const query=values=>'?' + new URLSearchParams(values).toString();
const guideAccessReasons=['SESSION_REQUIRED','WORKSPACE_MEMBERSHIP_REQUIRED','WORKSPACE_PROJECT_UNAVAILABLE','WORKSPACE_CONTEXT_CHANGED','PARTICIPANT_KYC_REVIEW_REQUIRED'];
export function workspaceGuideAccessReason(error){
 if(error?.status===401)return 'SESSION_REQUIRED';
 if(error?.code==='WORKSPACE_CONTEXT_CHANGED')return 'WORKSPACE_CONTEXT_CHANGED';
 if(error?.status===403)return ['WORKSPACE_MEMBERSHIP_REQUIRED','PARTICIPANT_KYC_REVIEW_REQUIRED'].includes(error.code)?error.code:'WORKSPACE_PROJECT_UNAVAILABLE';
 return null;
}
// This projection is read-only and deliberately omits names, phones and identity evidence.
export function workspaceGuideObservation({account,view,officeProject,loading,generation,unavailable=false,readFailed=false,accessReason=null,schedulePending=false,channelSnapshot}){
 const state=loading?'CONSULTING':unavailable?'UNAVAILABLE':readFailed||!account?'UNOBSERVED':'OBSERVED';
 const reason=guideAccessReasons.includes(accessReason)?accessReason:null;
 const showReason=(state==='UNAVAILABLE'&&reason)||(state==='OBSERVED'&&reason==='PARTICIPANT_KYC_REVIEW_REQUIRED');
 const result={version:1,state,generation,...(showReason?{accessReason:reason}:{})};
 if(state!=='OBSERVED')return result;
 const officeReviewOnly=account.officeReviewOnly===true;
 const currentOffice=officeReviewOnly&&officeProject?.scope===account.scope&&account.projects.some(project=>project.id===officeProject.projectId)?officeProject:null;
 const currentView=!officeReviewOnly&&view?.scope===account.scope&&account.projects.some(project=>project.id===view.project?.id)?view:null;
 const overview=currentView&&!schedulePending?loadedScheduleOverview(currentView.tasks,currentView.totalTasks,currentView.nextCursor):null;
 const channel=currentView&&channelSnapshot?.scope===account.scope&&channelSnapshot.projectId===currentView.project.id&&channelSnapshot.observedGeneration===generation?channelSnapshot:null;
 return {...result,scope:account.scope,projectId:currentOffice?.projectId||currentView?.project.id||null,role:account.role,officeReviewOnly,projectCount:account.projects.length,projectsPartial:account.projectsTruncated===true,schedulePending:Boolean(currentView&&schedulePending),schedule:overview?{loaded:overview.loaded,total:overview.total,partial:overview.partial,missingDates:overview.missingDates,invalidDates:overview.invalidDates}:null,channel:channel&&Array.isArray(channel.records)?{ready:channel.channelReady===true,partial:channel.truncated===true,ownLinked:channel.channelReady===true&&channel.records.some(row=>row.eligible===true&&row.state==='VERIFIED'&&typeof row.binding?.id==='string'&&row.binding.id.length>0&&typeof row.binding.verifiedAt==='string'&&Number.isFinite(Date.parse(row.binding.verifiedAt))&&row.binding.revokedAt===null)}:null};
}
const guideAccessDenied=error=>error.status===401||error.status===403||error.code==='WORKSPACE_CONTEXT_CHANGED';
// Only the exact server denial for a project in the observed account can open
// identity self-service. It never carries an operational view or task data.
function workspaceIdentityOnlyProject(error,account,projectId){
 if(error?.status!==403||error.code!=='PARTICIPANT_KYC_REVIEW_REQUIRED'||!/^[a-f0-9]{64}$/.test(account?.scope||'')||!Array.isArray(account.projects))return null;
 const candidates=account.projects.filter(project=>project?.id===projectId);
 if(candidates.length!==1||typeof candidates[0].name!=='string')return null;
 return {scope:account.scope,projectId:candidates[0].id,name:candidates[0].name};
}
export function AccountWorkspace({getSessionToken,onGuideObservation}={}){
 const transport=useWorkspaceRequest(getSessionToken);
 const request=useCallback((query='',options={})=>requestWorkspace(transport,query,options),[transport]);
 const [account,setAccount]=useState(null),[view,setView]=useState(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[saving,setSaving]=useState(false),[receipt,setReceipt]=useState(null);
 const generation=useRef(0),controller=useRef(null),mounted=useRef(true);
 const [guideUnavailable,setGuideUnavailable]=useState(false),[guideReadFailed,setGuideReadFailed]=useState(false),[guideAccessReason,setGuideAccessReason]=useState(null);
 const [identityProject,setIdentityProject]=useState(null);
 const [officeProject,setOfficeProject]=useState(null);
 const officeSelection=account?.officeReviewOnly===true&&officeProject?.scope===account.scope&&account.projects.some(project=>project.id===officeProject.projectId)?officeProject:null;
 const identitySelection=identityProject&&account&&identityProject.scope===account.scope&&!view&&account.projects.some(project=>project.id===identityProject.projectId)?identityProject:null;
 const [channelSnapshot,setChannelSnapshot]=useState(null),[observationEpoch,setObservationEpoch]=useState(0),onboardingContext=useRef(null);
 useLayoutEffect(()=>{onboardingContext.current=account&&view?{scope:account.scope,projectId:view.project.id,generation:observationEpoch,canManageIntegrations:account.canManageIntegrations===true}:null;return()=>{onboardingContext.current=null;};},[account,view,observationEpoch]);
 const channelObserved=useCallback(value=>{const context=onboardingContext.current;if(!context||value.scope!==context.scope||value.projectId!==context.projectId||value.observedGeneration!==context.generation)return;setChannelSnapshot(value.snapshot?{...value.snapshot,observedGeneration:value.observedGeneration}:null);},[]);
 const navigateOnboarding=useCallback(value=>{const id=participantOnboardingNavigationTarget(value,onboardingContext.current);if(!id)return;const target=document.getElementById(id);if(!target?.getClientRects().length)return;target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});},[]);
 const [creatingTask,setTaskCreating]=useState(false),[modulePending,setModulePending]=useState({});
 const [planReadback,setPlanReadback]=useState(null),[preparationRecovery,setPreparationRecovery]=useState(null),[creationRecovery,setCreationRecovery]=useState(null);
 const planReadbackMatches=Boolean(planReadback&&planReadback.scope===account?.scope&&planReadback.projectId===view?.project.id);
 const planReadbackPending=planReadbackMatches&&planReadback.status==='pending';
 const taskCreating=creatingTask||Object.values(modulePending).some(Boolean);
 const contextLocked=saving||Boolean(attempt)||taskCreating||Boolean(draft)||planReadbackPending;
 useEffect(()=>()=>onGuideObservation?.(null),[onGuideObservation]);
 useEffect(()=>{onGuideObservation?.(workspaceGuideObservation({account,view,officeProject:officeSelection,loading,generation:observationEpoch,unavailable:guideUnavailable,readFailed:guideReadFailed,accessReason:guideAccessReason,schedulePending:saving||Boolean(attempt)||Boolean(creatingTask)||Boolean(modulePending.plan)||Boolean(planReadbackMatches),channelSnapshot}));},[account,view,officeSelection,loading,observationEpoch,guideUnavailable,guideReadFailed,guideAccessReason,saving,attempt,creatingTask,modulePending.plan,planReadbackMatches,channelSnapshot,onGuideObservation]);
 const scheduleEditor=useRef(null),editingTaskId=draft?.task?.id;
 useEffect(()=>{if(editingTaskId){scheduleEditor.current?.focus({preventScroll:true});scheduleEditor.current?.scrollIntoView({block:'start',behavior:'auto'});}},[editingTaskId]);
 const participantPending=useCallback(value=>setModulePending(old=>old.participants===value?old:{...old,participants:value}),[]);
 const fieldPending=useCallback(value=>setModulePending(old=>old.field===value?old:{...old,field:value}),[]);
 const channelPending=useCallback(value=>setModulePending(old=>old.channel===value?old:{...old,channel:value}),[]);
 const companyChannelPending=useCallback(value=>setModulePending(old=>old.companyChannel===value?old:{...old,companyChannel:value}),[]);
 const ownCompanyNumberPending=useCallback(value=>setModulePending(old=>old.ownCompanyNumber===value?old:{...old,ownCompanyNumber:value}),[]);
 const ownCompanyTemplatesPending=useCallback(value=>setModulePending(old=>old.ownCompanyTemplates===value?old:{...old,ownCompanyTemplates:value}),[]);
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
 const projectPreparationPending=useCallback(value=>setModulePending(old=>old.projectPreparation===value?old:{...old,projectPreparation:value}),[]);
 const officePending=useCallback(value=>setModulePending(old=>old.office===value?old:{...old,office:value}),[]);
 const projectCreationPending=useCallback(value=>setModulePending(old=>old.projectCreation===value?old:{...old,projectCreation:value}),[]);
 const projectCreated=useCallback(result=>{
  if(!mounted.current||projectCreationReceiptOutcome(result,result)?.state!=='RECORDED')return;
  setAccount(previous=>previous?.scope===result.scope&&previous.role==='ADMIN'&&previous.officeReviewOnly!==true&&previous.projects.some(project=>project.id===result.projectId)&&result.newProject.status==='ACTIVE'?{...previous,projects:[...previous.projects.filter(project=>project.id!==result.newProject.id),result.newProject].sort((a,b)=>a.id.localeCompare(b.id))}:previous);
  // Opening the created work always uses the ordinary fresh canonical GET.
 },[]);
 const projectPrepared=useCallback(result=>{setAccount(previous=>previous?.scope===result.scope?{...previous,projects:previous.projects.map(project=>project.id===result.projectId?{...project,name:result.name}:project)}:previous);setView(previous=>previous?.scope===result.scope&&previous.project.id===result.projectId?{...previous,project:{...previous.project,name:result.name}}:previous);},[]);
 const tasksChanged=useCallback((task,context)=>{if(mounted.current&&task?.id)setView(old=>old&&context&&old.scope===context.scope&&old.project.id===context.projectId?{...old,tasks:updateLoadedTask(old.tasks,task)}:old);},[]);
 const portfolioAccessRejected=useCallback(()=>{
  if(!mounted.current)return;
  controller.current?.abort();const current=++generation.current;
  onboardingContext.current=null;setObservationEpoch(current);setChannelSnapshot(null);
  setGuideUnavailable(true);setGuideReadFailed(true);setGuideAccessReason(null);setLoading(false);setSaving(false);
  setAccount(null);setView(null);setIdentityProject(null);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setPreparationRecovery(null);
  // The transport journal retains unresolved receipt references. Clear the
  // revoked view and its in-memory controls without deleting those references
  // or resending a command; refresh and receipt recovery stay explicit.
  setAttempt(null);setRetryAllowed(false);setTaskCreating(false);setModulePending({});
  setNotice('Tu acceso cambió. Actualizá las obras antes de continuar.');
 },[]);
 function restrictProject(error,projectId){
  const identity=workspaceIdentityOnlyProject(error,account,projectId);
   setGuideAccessReason(workspaceGuideAccessReason(error));
  onboardingContext.current=null;setChannelSnapshot(null);setView(null);setIdentityProject(identity);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setPreparationRecovery(null);
  // Recovery references remain in the durable journal. Clear revoked controls
  // without repeating a command or trusting tasks contained in an old receipt.
  setAttempt(null);setRetryAllowed(false);setTaskCreating(false);setModulePending({});
  setGuideUnavailable(!identity);setGuideReadFailed(!identity);
  if(!identity)setAccount(null);
 }
 useEffect(()=>{
  const epoch=generation;mounted.current=true;const abort=new AbortController();controller.current=abort;const current=++epoch.current;setObservationEpoch(current);setChannelSnapshot(null);
  setAccount(null);setView(null);setIdentityProject(null);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setPreparationRecovery(null);setAttempt(null);setRetryAllowed(false);setTaskCreating(false);setModulePending({});setNotice('');setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);setLoading(true);
  request('',{signal:abort.signal}).then(data=>{if(mounted.current&&current===generation.current){setAccount(data);setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);}}).catch(error=>{if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);setGuideAccessReason(workspaceGuideAccessReason(error));if(guideAccessDenied(error))setGuideUnavailable(true);}}).finally(()=>{if(mounted.current&&current===generation.current){setLoading(false);setPlanReadback(null);}});
  return()=>{mounted.current=false;epoch.current++;abort.abort();controller.current?.abort();};
 },[request]);
 async function refresh(){
  if(contextLocked)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  setAccount(null);setView(null);setIdentityProject(null);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setNotice('');setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);setLoading(true);
  try{const data=await request('',{signal:abort.signal});if(mounted.current&&current===generation.current){setAccount(data);setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);}}catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);setGuideAccessReason(workspaceGuideAccessReason(error));if(guideAccessDenied(error))setGuideUnavailable(true);}}finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 async function open(projectId,append=false){
  if(account?.officeReviewOnly===true){if(contextLocked)return;const selected=account.projects.find(project=>project.id===projectId);if(selected){setView(null);setIdentityProject(null);setOfficeProject({scope:account.scope,projectId,name:selected.name});}return;}
  if(!account||contextLocked||!account.projects.some(project=>project.id===projectId))return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  const cursor=append?view?.nextCursor:null;setIdentityProject(null);setPlanReadback(null);setNotice('');setGuideAccessReason(null);setLoading(true);if(!append){setView(null);setDraft(null);setReceipt(null);}
  try{
   const data=await request(query({projectId,scope:account.scope,...(cursor?{afterTask:cursor}:{})}),{signal:abort.signal});
   if(!mounted.current||current!==generation.current)return;
   if(data.scope!==account.scope||data.project.id!==projectId)throw new Error('La respuesta no coincide con la obra seleccionada.');
   setView(previous=>append?{...data,tasks:mergeLoadedTasks(previous?.tasks||[],data.tasks)}:data);
   setGuideReadFailed(false);
  }catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);if(guideAccessDenied(error))restrictProject(error,projectId);}}
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
   setView(previous=>previous?.scope===context.scope&&previous.project.id===context.projectId?{...data,tasks:refreshLoadedTasks(previous.tasks,data.tasks)}:previous);
   setGuideReadFailed(false);
   setPlanReadback(null);setNotice('Cronograma actualizado desde los registros de la obra. '+(context.kind==='task'?'El total incluye la tarea creada.':'El total incluye las tareas del plan aplicado.'));
  }catch(error){
   if(mounted.current&&current===generation.current){
    setPlanReadback({...context,status:'failed'});setNotice(label+' tiene un recibo confirmado, pero no pudimos actualizar el cronograma. '+(error.name==='AbortError'?'La consulta venció.':error.message)+' Volvé a consultar el cronograma para comprobar el total.');
    setGuideReadFailed(true);
    if(guideAccessDenied(error))restrictProject(error,context.projectId);
   }
  }finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 function applySaved(data){
  if(!mounted.current)return;
  if(data.scope!==account?.scope||data.task?.id!==draft?.task.id||data.saved!==true||!data.receipt?.id||data.receipt.taskId!==draft.task.id)throw new Error('No se pudo correlacionar el recibo con esta tarea.');
  setView(previous=>previous?.scope===data.scope&&previous.project.id===view?.project.id?{...previous,tasks:updateLoadedTask(previous.tasks,data.task)}:previous);setReceipt(data.receipt);setAttempt(null);setRetryAllowed(false);setDraft(null);setNotice('Planificación guardada con recibo. El avance ejecutado no fue modificado.');
 }
 async function sendAttempt(payload,retrying=false){
  const current=generation.current,abort=new AbortController();controller.current=abort;
  setSaving(true);setNotice('');setAttempt(payload);setRetryAllowed(false);
  try{const data=await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])});if(mounted.current&&current===generation.current)applySaved(data);}
  catch(error){if(mounted.current&&current===generation.current){if(guideAccessDenied(error)){restrictProject(error,payload.projectId);setNotice(error.message);}else if(retrying){setRetryAllowed(error.requestDispatched===false);setNotice(error.message+' Conservamos el intento anterior; comprobá su recibo antes de modificar la planificación.');}else if(error.requestDispatched===false||(error.status&&error.status<500)){setAttempt(null);setNotice(error.message);}else setNotice('El servidor no confirmó el guardado. Conservamos este intento: comprobá el recibo antes de modificar o reenviar.');}}
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
  if(saving||!attempt)return;const current=generation.current,abort=new AbortController();controller.current=abort;setSaving(true);setRetryAllowed(false);
  try{const data=await request(query({projectId:attempt.projectId,scope:attempt.scope,operationId:attempt.operationId}),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
   if(mounted.current&&current===generation.current){if(data.scope!==account?.scope)throw new Error('La respuesta corresponde a otra organización.');if(data.state==='RECORDED')applySaved(data);else if(data.state==='NOT_OBSERVED'){setRetryAllowed(true);setNotice('No se observa un recibo todavía. Podés comprobar otra vez o reintentar exactamente la misma planificación; conservamos sus datos para evitar duplicados.');}else throw new Error('Todavía no se pudo comprobar el guardado. Conservamos el intento.');}
  }catch(error){if(mounted.current&&current===generation.current){if(guideAccessDenied(error))restrictProject(error,attempt.projectId);setNotice(error.message);}}finally{if(mounted.current&&current===generation.current)setSaving(false);}
 }
 return <section className={styles.workspace} aria-labelledby="workspace-title" aria-busy={loading}>
  <div className={styles.heading}><div><p className={styles.eyebrow}>ESPACIO DE TRABAJO</p><h2 id="workspace-title">Mis obras</h2><p className={styles.intro}>Elegí dónde trabajar. Las tareas, el equipo y los registros quedan en la obra seleccionada.</p></div><button id="workspace-refresh" type="button" className={styles.refresh} onClick={refresh} disabled={contextLocked||loading} aria-describedby={contextLocked?'workspace-context-lock':undefined}><RefreshCw size={16} aria-hidden="true"/>Actualizar</button></div>
  <div role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</div>
  {planReadbackMatches&&planReadback.status==='failed'&&<button type="button" disabled={loading||contextLocked} onClick={()=>readRecordedSchedule(planReadback)}>Volver a consultar el cronograma</button>}
  {loading&&<p className={styles.loading}><LoaderCircle size={18} className={styles.spinner} aria-hidden="true"/>Consultando registros autorizados…</p>}
  {account?.role==='ADMIN'&&account.officeReviewOnly!==true&&<CompanyBillingPanel key={`billing:${account.scope}`} scope={account.scope} getSessionToken={getSessionToken}/>}
  {contextLocked&&<p className={styles.contextLock} id="workspace-context-lock"><LockKeyhole size={16} aria-hidden="true"/><span>Hay una acción en curso. Completala, cancelá el borrador o comprobá su resultado antes de actualizar o cambiar de obra.</span></p>}
  {account&&<><div className={styles.context}><div className={styles.company}><Building2 size={22} aria-hidden="true"/><div><span>Empresa</span><strong>{account.organizationName}</strong></div></div><dl className={styles.contextDetails}><div><dt>Tu acceso</dt><dd>{identitySelection?'Presentación privada de identidad':account.roleLabel}</dd></div><div><dt>Obra activa</dt><dd>{view?.project.name||identitySelection?.name||officeSelection?.name||'Sin seleccionar'}</dd></div></dl></div>
   {!identitySelection&&account.officeReviewOnly!==true&&<WorkspaceRecoveryPanel key={account.scope} scope={account.scope} projects={account.projects} getSessionToken={getSessionToken} onRecovered={(result,reference)=>{if(reference?.resource==='project-creation'&&projectCreationReceiptOutcome(result,reference)?.state==='RECORDED'){setCreationRecovery(result);projectCreated(result);}else if(reference?.resource==='project-preparation'&&result.scope===reference.scope&&result.projectId===reference.projectId&&['RECORDED','CANCELLED'].includes(result.state)){setPreparationRecovery(result);if(result.state==='RECORDED')projectPrepared(result);}else if(reference?.resource==='plan-import'&&result.scope===reference.scope&&result.projectId===reference.projectId&&result.saved===true&&result.receiptId&&result.action==='APPLY'&&result.draft?.status==='APPLIED')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'plan'});else if(result.created===true&&result.task&&reference?.resource==='task-creation')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'task'});else if(result.task)tasksChanged(result.task,reference);}}/>}
   {!account.projects.length&&!loading&&<div className={styles.empty}><FolderKanban size={25} aria-hidden="true"/><strong>No hay obras activas asignadas a tu cuenta.</strong><p>Pedile al responsable que revise tu pertenencia y la obra asignada. Podés volver a actualizar cuando confirme el acceso.</p></div>}
   {account.projects.length>0&&<div className={styles.projectCollection}><div className={styles.collectionHeading}><h3>Obras disponibles</h3><span>{account.projects.length}{account.projectsTruncated?' mostradas':account.projects.length===1?' asignada':' asignadas'}</span></div><div className={styles.projects}>{account.projects.map(project=><button key={project.id} type="button" onClick={()=>open(project.id)} disabled={contextLocked} aria-pressed={(view?.project.id||identitySelection?.projectId||officeSelection?.projectId)===project.id}><span className={styles.projectName}><FolderKanban size={18} aria-hidden="true"/><span>{project.name}</span></span><small>{(view?.project.id||identitySelection?.projectId||officeSelection?.projectId)===project.id?<><Check size={14} aria-hidden="true"/>Seleccionada</>:<>Abrir obra<ArrowUpRight size={14} aria-hidden="true"/></>}</small></button>)}</div></div>}
   {account.projectsTruncated&&<p>Se muestran las primeras 100 obras autorizadas.</p>}
   {!identitySelection&&account.officeReviewOnly!==true&&<PortfolioOverviewPanel key={`portfolio:${account.scope}`} scope={account.scope} role={account.role} getSessionToken={getSessionToken} locked={contextLocked||loading} onOpenProject={projectId=>open(projectId)} onAccessRejected={portfolioAccessRejected}/>}
   {account.projects.length>0&&!view&&!identitySelection&&!officeSelection&&!loading&&<div className={styles.startState}><strong>Abrí una obra para empezar</strong><p>{account.officeReviewOnly===true?'Consultá sólo los eventos de lectura que el administrador seleccionó.':'Consultá el cronograma, registrá el trabajo y accedé a las herramientas disponibles para tu rol.'}</p></div>}
  </>}
  {identitySelection&&<><section className={styles.startState} aria-labelledby="identity-access-title"><h3 id="identity-access-title">Identidad y habilitación de obra</h3><p>Tu acceso requiere una revisión humana vigente. Podés presentar o consultar tu documentación privada para esta obra. Después de la aprobación, comprobá la habilitación para abrir las tareas y los registros.</p><button type="button" disabled={contextLocked||loading} onClick={()=>open(identitySelection.projectId)}>Comprobar habilitación de obra</button></section><ParticipantPanel key={`identity-only:${identitySelection.scope}:${identitySelection.projectId}`} presentation="own-identity" projectId={identitySelection.projectId} scope={identitySelection.scope} getSessionToken={getSessionToken} onPending={participantPending} onNavigate={value=>{if(mounted.current&&generation.current===observationEpoch&&value.scope===identitySelection.scope&&value.projectId===identitySelection.projectId)open(identitySelection.projectId);}}/><details style={{marginTop:'1rem'}}><summary style={{minHeight:44,paddingBlock:'.6rem',cursor:'pointer',fontSize:16,fontWeight:700}}>Mi WhatsApp y mis avisos</summary><WorkerChannelPanel key={`identity-channel:${identitySelection.scope}:${identitySelection.projectId}`} presentation="own-privacy" projectId={identitySelection.projectId} scope={identitySelection.scope} getSessionToken={getSessionToken} onPending={channelPending} observationEpoch={observationEpoch}/></details></>}
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
  {view&&['ADMIN','DIRECTOR'].includes(account?.role)&&<ProjectPreparationPanel key={`project-preparation:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={projectPreparationPending} onPrepared={projectPrepared} recovered={preparationRecovery} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='projectPreparation'&&value)}/> }
  {view&&account?.role==='ADMIN'&&<ProjectCreationPanel key={`project-creation:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={projectCreationPending} onCreated={projectCreated} recovered={creationRecovery} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='projectCreation'&&value)}/>}
  {view&&account?.canManageIntegrations&&<SiteRegisterPanel key={`register:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={registerPending}/> }
  {view&&<ParticipantPanel key={`participants:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={participantPending} channelSnapshot={channelSnapshot?.scope===account.scope&&channelSnapshot.projectId===view.project.id&&channelSnapshot.observedGeneration===observationEpoch?channelSnapshot:null} onNavigate={navigateOnboarding}/> }
  {view&&<WorkerChannelPanel key={`channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={channelPending} observationEpoch={observationEpoch} onSnapshot={channelObserved}/> }
  {view&&account?.role==='ADMIN'&&<OwnCompanyNumberPanel key={`own-company-number:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={ownCompanyNumberPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='ownCompanyNumber'&&value)}/> }
  {view&&account?.role==='ADMIN'&&<OwnCompanyTemplatesPanel key={`own-company-templates:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={ownCompanyTemplatesPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='ownCompanyTemplates'&&value)}/> }
  {view&&(account?.role==='ADMIN'||account?.canManageIntegrations)&&<CompanyChannelPanel key={`company-channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={companyChannelPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='companyChannel'&&value)}/> }
  {view&&account?.role==='ADMIN'&&<DemoPilotPanel key={`demo:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={demoPending}/> }
  {view&&<FieldOperationsPanel key={`field:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} onPending={fieldPending} onTasksChanged={task=>tasksChanged(task,{scope:account.scope,projectId:view.project.id})}/> }
  {view&&<MaterialInventoryPanel key={`inventory:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} onPending={inventoryPending}/> }
  {view&&account?.canManageIntegrations&&<SitePurchasePanel key={`purchases:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={purchasePending}/> }
  {view&&account?.canManageIntegrations&&<CustomerWhatsAppPanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={preparationPending}/> }
  {view&&account?.canManageIntegrations&&<MetaOnboardingPanel key={`meta:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={metaPending}/> }
  {view&&account?.canManageIntegrations&&<CustomerInboxPanel key={`inbox:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={inboxPending}/> }
  {view&&account?.canManageIntegrations&&<TemplateSendPanel key={`template-send:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={templatePending}/> }
  {view&&account?.role==='ADMIN'&&<ConstructorCrmPanel key={`crm:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={crmPending}/> }
  {view&&account?.canManageIntegrations&&<OperationsStatusPanel key={`operations:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken}/> }
  {account?.role==='ADMIN'&&<OfficeReviewAdminPanel key={`office-admin:${account.scope}:${view.project.id}`} scope={account.scope} projectId={view.project.id} getSessionToken={getSessionToken} onPending={officePending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='office'&&value)}/>}
  </div></div>}
  {officeSelection&&<OfficeReviewPanel key={`office-review:${officeSelection.scope}:${officeSelection.projectId}`} scope={officeSelection.scope} projectId={officeSelection.projectId} getSessionToken={getSessionToken}/>}
 </section>;
}
