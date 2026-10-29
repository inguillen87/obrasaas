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
import {CompanySubscriptionPanel} from './company-subscription-panel';
import {MetaOnboardingPanel} from './meta-onboarding-panel';
import {OperationsStatusPanel} from './operations-status-panel';
import {WorkspaceRecoveryPanel} from './workspace-recovery-panel';
import {CustomerInboxPanel} from './customer-inbox-panel';
import {TemplateSendPanel} from './template-send-panel';
import {ConstructorCrmPanel} from './constructor-crm-panel';
import {DemoPilotPanel} from './demo-pilot-panel';
import {WorkspaceToolsNavigation} from './workspace-tools-navigation';
import {WorkspaceScreen,useWorkspaceView,useWorkspaceRequestedSection,revealWorkspaceDestination} from './workspace-screen';
import {workspacePendingProjectSection} from './workspace-view-routing.mjs';
import {WorkspaceOverview} from './workspace-overview';
import {ScheduleWorkbench} from './schedule-workbench';
import {ApprovedProgressCurvePanel} from './approved-progress-curve-panel';
import {TaskProgressMeasurementEditor} from './task-progress-measurement-editor';
import {taskMeasurementView} from './task-progress-measurement-view.mjs';
import {PlanImportPanel} from './plan-import-panel';
import {PlanMeasurementPanel} from './plan-measurement-panel';
import {PlanBaselinePanel} from './plan-baseline-panel';
import {ProjectPreparationPanel} from './project-preparation-panel';
import {PortfolioOverviewPanel} from './portfolio-overview-panel';
import {portfolioOverviewMatches} from './portfolio-overview-view.mjs';
import {OfficeReviewPanel,OfficeReviewAdminPanel} from './office-review-panel';
import {ProjectCreationPanel} from './project-creation-panel';
import {projectCreationReceiptOutcome} from './workspace-recovery-journal.mjs';
import {calendarDay,loadedScheduleOverview,mergeLoadedTasks,refreshLoadedTasks,updateLoadedTask} from './schedule-workbench.mjs';
import {createWorksiteTaskPager,confirmedWorksiteTaskPage} from './workspace-task-page.mjs';
import {collectRetainedPages,retainedRows} from './workspace-live-read.mjs';
import {useWorksiteLiveRefresh,WorksiteLiveRefreshStatus} from './workspace-live-refresh';
const endpoint='/api/identity/workspace';
const messages={WORKSPACE_ORGANIZATION_REQUIRED:'Elegí una organización desde tu cuenta para consultar las obras asignadas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Todavía no podemos confirmar tu pertenencia vigente a esta empresa en ObraSaaS. Si ya aceptaste la invitación, pedile al administrador que habilite tu rol desde Permisos de las cuentas en la empresa. Cuando lo confirme, usá Actualizar en Mis obras.',WORKSPACE_PROJECT_UNAVAILABLE:'Esta obra no está disponible con tus permisos actuales.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a cargar las obras antes de continuar.',SCHEDULE_REVISION_CHANGED:'Otra persona modificó la tarea. Consultá su revisión actual sin descartar tus fechas ni el motivo.',SCHEDULE_PERMISSION_REQUIRED:'Tu rol actual no puede modificar la planificación.',SCHEDULE_UNCHANGED:'Las fechas son iguales a las registradas. No se hizo ningún cambio.',SCHEDULE_OPERATION_CONFLICT:'Este intento ya pertenece a otra solicitud. Comprobá su recibo antes de continuar.',SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar.',SCHEDULE_DATES_INVALID:'Revisá el inicio y el fin. El fin no puede ser anterior al inicio.',SCHEDULE_REASON_REQUIRED:'Explicá brevemente el motivo del cambio.'};
const describe=code=>code==='PARTICIPANT_KYC_REVIEW_REQUIRED'?'Tu identidad necesita una revisión vigente para habilitar esta obra. Podés presentar o consultar tu documentación privada.':messages[code]||'No se pudo confirmar la operación. No se reemplazaron los datos por ejemplos.';
async function requestWorkspace(transport,query='',options={}){
 return transport(endpoint+query,options,async response=>{
  if(!response.ok){
   const error=new Error(describe(response.status===401?'SESSION_REQUIRED':response.status===403?'WORKSPACE_PROJECT_UNAVAILABLE':null));error.status=response.status;
   if(response.headers.get('content-type')?.includes('application/json'))try{const body=await response.json();if(typeof body?.code==='string'){error.code=body.code;error.message=describe(body.code);error.scheduleRevisionRejected=response.status===409&&options.method==='POST'&&query===''&&body.saved===false&&!Array.isArray(body)&&Object.keys(body).sort().join('|')==='code|saved'&&body.code==='SCHEDULE_REVISION_CHANGED';}}catch{}
   throw error;
  }
  try{return await response.json();}catch(error){if(error.name==='AbortError'||error.name==='TimeoutError')throw error;throw new Error('No pudimos leer la respuesta de la obra. Volvé a consultar antes de continuar.');}
 });
}
const query=values=>'?' + new URLSearchParams(values).toString();
function confirmedWorkspaceAccount(data){
 const projects=data?.projects;
 if(!Array.isArray(projects)||projects.some(project=>!project||typeof project.id!=='string'||!project.id.length||typeof project.name!=='string')||new Set(projects.map(project=>project.id)).size!==projects.length)throw new Error('No pudimos confirmar la lista de obras. Actualizá para volver a consultar antes de elegir una obra.');
 return data;
}
function consultedScheduleTask(data,context) {
 const value=data?.task,revision=value?.revision;
 const taskKeys=value&&Object.keys(value).sort().join('|');
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).sort().join('|')!=='canPlanSchedule|project|scope|task'||data.scope!==context.scope||data.project?.id!==context.projectId||data.project.status!=='ACTIVE'||typeof data.project.name!=='string'||typeof data.canPlanSchedule!=='boolean'||!value||typeof value!=='object'||Array.isArray(value)||!['endsOn|id|progress|revision|startsOn|status|title','endsOn|id|measurement|progress|revision|startsOn|status|title'].includes(taskKeys)||Object.hasOwn(value,'measurement')&&taskMeasurementView(value).state==='UNCONFIRMED'||value.id!==context.taskId||typeof value.title!=='string'||!value.title.trim()||typeof value.status!=='string'||!value.status.trim()||typeof value.progress!=='number'||!Number.isFinite(value.progress)||value.progress<0||value.progress>100||typeof revision!=='string'||!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}$/.test(revision)||calendarDay(revision.slice(0,10))===null||revision<=context.revision||(value.startsOn!==null&&calendarDay(value.startsOn)===null)||(value.endsOn!==null&&calendarDay(value.endsOn)===null))throw new Error('No pudimos confirmar una revisión actual de esta tarea en la misma obra. Conservamos tu borrador.');
 return {task:value,canPlan:data.canPlanSchedule};
}
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
export function AccountWorkspace({getSessionToken,onGuideObservation,onCompanyContext,onContextPending,initialProjectId='',initialPlanId=''}={}){
 const transport=useWorkspaceRequest(getSessionToken);
 const request=useCallback((query='',options={})=>requestWorkspace(transport,query,options),[transport]);
 const [account,setAccount]=useState(null),[view,setView]=useState(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[saving,setSaving]=useState(false),[receipt,setReceipt]=useState(null);
 const generation=useRef(0),controller=useRef(null),mounted=useRef(true),identityNavigation=useRef(null),identityNavigationEpoch=useRef(0);
 // Capture once per Clerk context. A query parameter can only suggest a read.
 const initialProjectHint=useRef({projectId:initialProjectId,consumed:false,listGeneration:null});
 const [guideUnavailable,setGuideUnavailable]=useState(false),[guideReadFailed,setGuideReadFailed]=useState(false),[guideAccessReason,setGuideAccessReason]=useState(null);
 const [identityProject,setIdentityProject]=useState(null);
 const [officeProject,setOfficeProject]=useState(null);
 const officeSelection=account?.officeReviewOnly===true&&officeProject?.scope===account.scope&&account.projects.some(project=>project.id===officeProject.projectId)?officeProject:null;
 const identitySelection=identityProject&&account&&identityProject.scope===account.scope&&!view&&account.projects.some(project=>project.id===identityProject.projectId)?identityProject:null;
 const [channelSnapshot,setChannelSnapshot]=useState(null),[observationEpoch,setObservationEpoch]=useState(0),onboardingContext=useRef(null);
 // A delayed canonical denial can mount own-privacy without an operational view.
 // Readiness only reschedules presentation; operation still requires view.
 const activeSection=useWorkspaceView({role:account?.role,canManageIntegrations:account?.canManageIntegrations,projectAvailable:Boolean(view),privatePresentationAvailable:Boolean(identitySelection)},`${account?.scope||''}:${view?.project.id||''}:${identitySelection?.projectId||''}`);
 const requestedSection=useWorkspaceRequestedSection(),identityProjectChoice=Boolean(account)&&workspacePendingProjectSection(requestedSection,{projectAvailable:Boolean(view),privatePresentationAvailable:Boolean(identitySelection),officeReviewOnly:account?.officeReviewOnly===true||Boolean(officeSelection),projectCount:account?.projects.length||0,loading})==='identidad';
 const privateSection=activeSection==='mi-whatsapp'?'mi-whatsapp':'identidad';
 const navigatePrivate=(event,id)=>{if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();revealWorkspaceDestination(id);};
 useLayoutEffect(()=>{onboardingContext.current=account&&view?{scope:account.scope,projectId:view.project.id,generation:observationEpoch,canManageIntegrations:account.canManageIntegrations===true}:null;return()=>{onboardingContext.current=null;};},[account,view,observationEpoch]);
 const channelObserved=useCallback(value=>{const context=onboardingContext.current;if(!context||value.scope!==context.scope||value.projectId!==context.projectId||value.observedGeneration!==context.generation)return;setChannelSnapshot(value.snapshot?{...value.snapshot,observedGeneration:value.observedGeneration}:null);},[]);
 const navigateOnboarding=useCallback(value=>{identityNavigation.current=null;identityNavigationEpoch.current++;const id=participantOnboardingNavigationTarget(value,onboardingContext.current);if(!id)return;revealWorkspaceDestination(id);const target=document.getElementById(id);if(!target?.getClientRects().length)return;target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});},[]);
 const [creatingTask,setTaskCreating]=useState(false),[modulePending,setModulePending]=useState({}),[moduleReported,setModuleReported]=useState({});
 const [taskPageReadSnapshot,setTaskPageReadSnapshot]=useState(null);
 const taskPager=useRef(null),taskPageContext=useRef(null),taskReadBusy=useRef({});
 const taskReadKey=[account?.scope||'',view?.project?.id||'',account?.role||'',observationEpoch].join(':');
 const taskPageRead=taskPageReadSnapshot?.account===account&&taskPageReadSnapshot.request===request&&taskPageReadSnapshot.contextKey===taskReadKey&&account?.officeReviewOnly!==true?taskPageReadSnapshot.value:{loading:false,error:''};
 const fieldTaskReadBusy=useCallback(busy=>{taskReadBusy.current.field={key:taskReadKey,busy:busy===true};},[taskReadKey]);
 const inventoryTaskReadBusy=useCallback(busy=>{taskReadBusy.current.inventory={key:taskReadKey,busy:busy===true};},[taskReadKey]);
 const loadMoreDraftTasks=useCallback(()=>taskPager.current?.loadMore(),[]);
 const [measurementSelection,setMeasurementSelection]=useState(null);
 const measurementTask=measurementSelection&&account&&view&&measurementSelection.scope===account.scope&&measurementSelection.projectId===view.project.id?view.tasks.find(task=>task.id===measurementSelection.taskId):null;
 const [planReadback,setPlanReadback]=useState(null),[preparationRecovery,setPreparationRecovery]=useState(null),[creationRecovery,setCreationRecovery]=useState(null);
 const planReadbackMatches=Boolean(planReadback&&planReadback.scope===account?.scope&&planReadback.projectId===view?.project.id);
 const planReadbackPending=planReadbackMatches&&planReadback.status==='pending';
 const taskCreating=creatingTask||Object.values(modulePending).some(Boolean);
 // These panels start with their own read and report it from an effect, one render after they mount.
 // Until the mounted panel has reported, it counts as pending: otherwise a live read starts in that
 // render and the lock cancels it in the next one, which costs a second GET once it unlocks.
 const preparationPanelKey=view&&['ADMIN','DIRECTOR'].includes(account?.role)?`project-preparation:${account.scope}:${view.project.id}:${observationEpoch}`:'';
 const creationPanelKey=view&&account?.role==='ADMIN'?`project-creation:${account.scope}:${view.project.id}:${observationEpoch}`:'';
 const modulesUnreported=Boolean(preparationPanelKey&&moduleReported.projectPreparation!==preparationPanelKey||creationPanelKey&&moduleReported.projectCreation!==creationPanelKey);
 const contextLocked=saving||Boolean(attempt)||taskCreating||Boolean(draft)||planReadbackPending||taskPageRead.loading||modulesUnreported;
 const inventoryInteractionBlocked=loading||saving||Boolean(attempt)||creatingTask||Boolean(draft)||planReadbackPending||taskPageRead.loading||Object.entries(modulePending).some(([name,pending])=>name!=='inventory'&&pending);
 // Publish before paint so the global organization selector respects this lock.
 useLayoutEffect(()=>()=>onContextPending?.(false),[onContextPending]);
 useLayoutEffect(()=>{onContextPending?.(contextLocked);},[contextLocked,onContextPending]);
 const portfolioContext=useRef(null);
 useLayoutEffect(()=>{
  portfolioContext.current=mounted.current&&account&&!loading&&!contextLocked?{account,generation:observationEpoch}:null;
  return()=>{portfolioContext.current=null;};
 },[account,loading,contextLocked,observationEpoch]);
 useLayoutEffect(()=>{
  const ticket=identityNavigation.current;
  if(!ticket)return;
  const context=onboardingContext.current;
  if(!mounted.current||ticket.generation!==generation.current||ticket.generation!==observationEpoch||context?.generation!==ticket.generation||ticket.scope!==account?.scope||ticket.scope!==view?.scope||ticket.projectId!==view?.project.id||contextLocked){identityNavigation.current=null;identityNavigationEpoch.current++;return;}
  if(loading)return;
  // The canonical project GET already succeeded. Consume once, without reading the channel.
  identityNavigation.current=null;identityNavigationEpoch.current++;
  const id=participantOnboardingNavigationTarget(ticket,context);
  if(id!=='worker-channel-title')return;
  revealWorkspaceDestination(id);
  const target=document.getElementById(id);
  if(!target?.getClientRects().length)return;
  target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});
 },[account,view,loading,observationEpoch,contextLocked]);
 // Only the accepted list GET of this exact generation supplies the selector label.
 // A project read, denial, failed read or unmount cannot restore an older list name.
 useLayoutEffect(()=>()=>onCompanyContext?.(null),[onCompanyContext]);
 useLayoutEffect(()=>{
  const current=initialProjectHint.current.listGeneration===observationEpoch&&observationEpoch===generation.current;
  const valid=mounted.current&&current&&!loading&&!guideUnavailable&&!guideReadFailed&&!guideAccessReason&&typeof account?.scope==='string'&&/^[a-f0-9]{64}$/.test(account.scope)&&typeof account.organizationName==='string'&&account.organizationName.trim()&&Number.isSafeInteger(observationEpoch)&&observationEpoch>0;
  onCompanyContext?.(valid?{name:account.organizationName,scope:account.scope,generation:observationEpoch}:null);
 },[account,loading,observationEpoch,guideUnavailable,guideReadFailed,guideAccessReason,onCompanyContext]);
 useEffect(()=>()=>onGuideObservation?.(null),[onGuideObservation]);
 useEffect(()=>{onGuideObservation?.(workspaceGuideObservation({account,view,officeProject:officeSelection,loading,generation:observationEpoch,unavailable:guideUnavailable,readFailed:guideReadFailed,accessReason:guideAccessReason,schedulePending:saving||Boolean(attempt)||Boolean(creatingTask)||Boolean(modulePending.plan)||Boolean(planReadbackMatches),channelSnapshot}));},[account,view,officeSelection,loading,observationEpoch,guideUnavailable,guideReadFailed,guideAccessReason,saving,attempt,creatingTask,modulePending.plan,planReadbackMatches,channelSnapshot,onGuideObservation]);
 const scheduleEditor=useRef(null),editingTaskId=draft?.task?.id;
 useEffect(()=>{if(editingTaskId){scheduleEditor.current?.focus({preventScroll:true});scheduleEditor.current?.scrollIntoView({block:'start',behavior:'auto'});}},[editingTaskId]);
 const participantPending=useCallback(value=>setModulePending(old=>old.participants===value?old:{...old,participants:value}),[]);
 const fieldPending=useCallback(value=>setModulePending(old=>old.field===value?old:{...old,field:value}),[]);
 const measurementPending=useCallback(value=>setModulePending(old=>old.measurement===value?old:{...old,measurement:value}),[]);
 const closeMeasurement=useCallback(message=>{setMeasurementSelection(null);if(typeof message==='string')setNotice(message);},[]);
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
 const planMeasurementPending=useCallback(value=>setModulePending(old=>old.planMeasurement===value?old:{...old,planMeasurement:value}),[]);
 const baselinePending=useCallback(value=>setModulePending(old=>old.baseline===value?old:{...old,baseline:value}),[]);
 const projectPreparationPending=useCallback(value=>{setModuleReported(old=>old.projectPreparation===preparationPanelKey?old:{...old,projectPreparation:preparationPanelKey});setModulePending(old=>old.projectPreparation===value?old:{...old,projectPreparation:value});},[preparationPanelKey]);
 const officePending=useCallback(value=>setModulePending(old=>old.office===value?old:{...old,office:value}),[]);
 const projectCreationPending=useCallback(value=>{setModuleReported(old=>old.projectCreation===creationPanelKey?old:{...old,projectCreation:creationPanelKey});setModulePending(old=>old.projectCreation===value?old:{...old,projectCreation:value});},[creationPanelKey]);
 const projectCreated=useCallback(result=>{
  if(!mounted.current||projectCreationReceiptOutcome(result,result)?.state!=='RECORDED')return;
  setAccount(previous=>previous?.scope===result.scope&&previous.role==='ADMIN'&&previous.officeReviewOnly!==true&&previous.projects.some(project=>project.id===result.projectId)&&result.newProject.status==='ACTIVE'?{...previous,projects:[...previous.projects.filter(project=>project.id!==result.newProject.id),result.newProject].sort((a,b)=>a.id.localeCompare(b.id))}:previous);
  // Opening the created work always uses the ordinary fresh canonical GET.
 },[]);
 const projectPrepared=useCallback(result=>{setAccount(previous=>previous?.scope===result.scope?{...previous,projects:previous.projects.map(project=>project.id===result.projectId?{...project,name:result.name}:project)}:previous);setView(previous=>previous?.scope===result.scope&&previous.project.id===result.projectId?{...previous,project:{...previous.project,name:result.name}}:previous);},[]);
 const tasksChanged=useCallback((task,context)=>{if(mounted.current&&task?.id)setView(old=>old&&context&&old.scope===context.scope&&old.project.id===context.projectId?{...old,tasks:updateLoadedTask(old.tasks,task)}:old);},[]);
 const navigateProgressSchedule=useCallback(value=>{
  const context=onboardingContext.current;if(!mounted.current||!context||context.generation!==generation.current||value?.scope!==context.scope||value.projectId!==context.projectId||typeof value.taskId!=='string'||!value.taskId.trim())return;
  const taskId=value.taskId;
  revealWorkspaceDestination('schedule-title');
  // Reveal commits the section first; its layout effect also focuses the heading.
  // Apply the more specific receipt destination after that presentation effect.
  window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
   const current=onboardingContext.current;
   if(!mounted.current||!current||current.generation!==generation.current||current.generation!==context.generation||current.scope!==context.scope||current.projectId!==context.projectId)return;
   const schedule=document.querySelector('section[aria-labelledby="schedule-title"]');
   if(!schedule?.getClientRects().length)return;
   const row=[...schedule.querySelectorAll('[data-task-id]')].find(element=>element.dataset.taskId===taskId),more=document.getElementById('schedule-load-more'),target=row||(more&&!more.disabled?more:document.getElementById('schedule-title'));
   if(!target?.getClientRects().length)return;if(target.tagName!=='BUTTON')target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:'auto'});
  }));
 },[]);
 const portfolioAccessRejected=useCallback(()=>{
  identityNavigation.current=null;identityNavigationEpoch.current++;
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
 const restrictProject=useCallback((error,projectId,currentAccount=account)=>{
  identityNavigation.current=null;identityNavigationEpoch.current++;
  const identity=workspaceIdentityOnlyProject(error,currentAccount,projectId);
   setGuideAccessReason(workspaceGuideAccessReason(error));
  onboardingContext.current=null;setChannelSnapshot(null);setView(null);setIdentityProject(identity);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setPreparationRecovery(null);
  // Recovery references remain in the durable journal. Clear revoked controls
  // without repeating a command or trusting tasks contained in an old receipt.
  setAttempt(null);setRetryAllowed(false);setTaskCreating(false);setModulePending({});
  setGuideUnavailable(!identity);setGuideReadFailed(!identity);
  if(!identity)setAccount(null);
 },[account]);
 // Loading another task page is allowed inside a field/material draft. It
 // never uses open(append), increments the workspace generation or resets a
 // draft. All writes, uncertain attempts and other modules still lock it.
 useLayoutEffect(()=>{
  taskPageContext.current=mounted.current&&account&&view&&account.officeReviewOnly!==true&&view.scope===account.scope&&!loading?{scope:account.scope,projectId:view.project.id,role:account.role,generation:observationEpoch,cursor:view.nextCursor,officeReviewOnly:false,blocked:saving||Boolean(attempt)||creatingTask||Boolean(draft)||planReadbackPending||Object.entries(modulePending).some(([name,pending])=>pending&&!['field','inventory'].includes(name))}:null;
  return()=>{taskPageContext.current=null;};
 },[account,view,loading,observationEpoch,saving,attempt,creatingTask,draft,planReadbackPending,modulePending]);
 useLayoutEffect(()=>{
  taskPager.current?.reset();
 },[account?.scope,account?.role,account?.officeReviewOnly,view?.project?.id,observationEpoch,request]);
 useLayoutEffect(()=>{
  const pager=createWorksiteTaskPager({request,getContext:()=>{
   const context=taskPageContext.current;
   if(!mounted.current||!context||context.generation!==generation.current)return null;
   const key=[context.scope,context.projectId,context.role,context.generation].join(':');
   return {...context,blocked:context.blocked||Object.values(taskReadBusy.current).some(value=>value.key===key&&value.busy)};
  },onState:value=>{
   const context=taskPageContext.current;
   if(mounted.current&&context)setTaskPageReadSnapshot({account,request,contextKey:[context.scope,context.projectId,context.role,context.generation].join(':'),value});
  },onPage:(page,captured)=>{
   if(!mounted.current||generation.current!==captured.generation)return;
   setView(previous=>previous?.scope===captured.scope&&previous.project.id===captured.projectId&&previous.nextCursor===captured.cursor?{...previous,tasks:mergeLoadedTasks(previous.tasks,page.tasks),totalTasks:page.totalTasks,nextCursor:page.nextCursor}:previous);
  },onAccessRejected:(error,captured)=>{
   if(mounted.current&&generation.current===captured.generation)restrictProject(error,captured.projectId);
  }});
  taskPager.current=pager;
  return()=>{if(taskPager.current===pager)taskPager.current=null;pager.dispose();};
 },[account,request,restrictProject]);
 const scheduleLiveContext=useRef(null);
 useLayoutEffect(()=>{scheduleLiveContext.current={account,view,generation:observationEpoch,blocked:contextLocked||loading,section:activeSection};});
 const scheduleLive=useWorksiteLiveRefresh({
  contextKey:[account?.scope||'',view?.project.id||'',observationEpoch,'schedule'].join(':'),
  // Keep initial live spacing after this canonical context first becomes eligible, including slow readback.
  canonicalRead:true,
  enabled:Boolean(view&&account?.officeReviewOnly!==true&&['inicio','cronograma'].includes(activeSection)),
  blocked:contextLocked||loading,
  read:async signal=>{
   const captured=scheduleLiveContext.current;
   if(!captured.view||captured.blocked)throw new DOMException('Consulta cancelada.','AbortError');
   const {scope,project}=captured.view;let total=null;
   const current=()=>{const value=scheduleLiveContext.current;return mounted.current&&generation.current===captured.generation&&value.account===captured.account&&value.view===captured.view&&!value.blocked;};
   const result=await collectRetainedPages({ids:captured.view.tasks.map(task=>task.id),signal,isCurrent:current,readPage:async cursor=>{
    const page=confirmedWorksiteTaskPage(await request(query({projectId:project.id,scope,...(cursor?{afterTask:cursor}:{})}),{signal,requestTimeoutMs:15000}),{scope,projectId:project.id,cursor});
    if(total!==null&&page.totalTasks!==total)throw Object.assign(new Error('La lista cambió mientras se consultaba. Volvé a comprobarla.'),{code:'WORKSITE_LIVE_READ_INCOMPLETE'});
    total=page.totalTasks;return {rows:page.tasks,cursor:page.nextCursor,data:page};
   }});
   return {captured,...result};
  },
  apply:value=>{
   const current=scheduleLiveContext.current,captured=value.captured;
   if(!mounted.current||generation.current!==captured.generation||current.account!==captured.account||current.view!==captured.view||current.generation!==captured.generation||current.blocked)return false;
   const page=value.first.data,tasks=retainedRows(captured.view.tasks,value.rows),updates=value.hasUnloaded||page.totalTasks!==captured.view.totalTasks||captured.view.nextCursor===null&&page.totalTasks>captured.view.tasks.length;
   setView(old=>old===captured.view?{...old,tasks,totalTasks:page.totalTasks,project:page.project,roleLabel:page.roleLabel,canPlanSchedule:page.canPlanSchedule}:old);
   return {updates,message:updates?'Hay tareas nuevas o cambió la lista completa. El Gantt conserva las tareas y páginas que tenías abiertas; consultá el cronograma completo para incorporar las nuevas.':''};
  },
  isCurrent:()=>{const current=scheduleLiveContext.current;return generation.current===observationEpoch&&current.account===account&&current.view===view&&current.generation===observationEpoch&&!current.blocked;},
  isAuthorityCurrent:()=>{const current=scheduleLiveContext.current;return mounted.current&&generation.current===observationEpoch&&current.account===account&&current.view===view;},
  onAccessRejected:error=>{const current=scheduleLiveContext.current;if(!mounted.current||generation.current!==observationEpoch||current.account!==account||current.view!==view)return false;if(current.view)restrictProject(error,current.view.project.id);}
 });
 useEffect(()=>{
  const epoch=generation,navigation=identityNavigation,navigationEpoch=identityNavigationEpoch;
  navigation.current=null;navigationEpoch.current++;mounted.current=true;const abort=new AbortController();controller.current=abort;const current=++epoch.current;setObservationEpoch(current);setChannelSnapshot(null);
  setAccount(null);setView(null);setIdentityProject(null);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setPreparationRecovery(null);setAttempt(null);setRetryAllowed(false);setTaskCreating(false);setModulePending({});setNotice('');setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);setLoading(true);
  request('',{signal:abort.signal}).then(data=>{if(mounted.current&&current===generation.current){const confirmed=confirmedWorkspaceAccount(data);initialProjectHint.current.listGeneration=current;setAccount(confirmed);setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);}}).catch(error=>{if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);setGuideAccessReason(workspaceGuideAccessReason(error));if(guideAccessDenied(error))setGuideUnavailable(true);}}).finally(()=>{if(mounted.current&&current===generation.current){setLoading(false);setPlanReadback(null);}});
  return()=>{navigation.current=null;navigationEpoch.current++;mounted.current=false;epoch.current++;abort.abort();controller.current?.abort();};
 },[request]);
 async function refresh(){
  identityNavigation.current=null;identityNavigationEpoch.current++;
  if(contextLocked||loading)return;
  // Preserve only an intention to read, never the previous worksite data.
  const projectId=(view?.scope===account?.scope?view?.project?.id:null)||officeSelection?.projectId||identitySelection?.projectId;
  const selection=projectId&&/^[a-f0-9]{64}$/.test(account?.scope||'')?{projectId,scope:account.scope,role:account.role,officeReviewOnly:account.officeReviewOnly===true}:null;
  initialProjectHint.current.consumed=true;
  controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  setAccount(null);setView(null);setIdentityProject(null);setOfficeProject(null);setCreationRecovery(null);setDraft(null);setReceipt(null);setPlanReadback(null);setNotice('');setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);setLoading(true);
  try{
   const confirmed=confirmedWorkspaceAccount(await request('',{signal:abort.signal}));
   if(!mounted.current||current!==generation.current)return;
   initialProjectHint.current.listGeneration=current;setAccount(confirmed);setGuideUnavailable(false);setGuideReadFailed(false);setGuideAccessReason(null);
   if(!selection||selection.scope!==confirmed.scope||selection.role!==confirmed.role||selection.officeReviewOnly!==(confirmed.officeReviewOnly===true))return;
   const listed=confirmed.projects.find(project=>project.id===selection.projectId);
   if(confirmed.officeReviewOnly===true){if(listed)setOfficeProject({scope:confirmed.scope,projectId:listed.id,name:listed.name});return;}
   // A truncated list cannot establish absence. The canonical project GET
   // still decides access, and only its fresh identity can extend the selector.
   if(!listed&&confirmed.projectsTruncated!==true){setNotice('La obra anterior no figura entre tus obras disponibles. Elegí una obra para continuar.');return;}
   try{
    const data=await request(query({projectId:selection.projectId,scope:confirmed.scope}),{signal:abort.signal});
    if(!mounted.current||current!==generation.current)return;
    if(data?.scope!==confirmed.scope||data?.project?.id!==selection.projectId||data.project.status!=='ACTIVE'||typeof data.project.name!=='string'||!data.project.name.trim())throw new Error('No pudimos confirmar la obra activa. Elegí una obra para volver a consultar.');
    if(!listed)setAccount(previous=>previous===confirmed?{...previous,projects:[...previous.projects,{id:data.project.id,name:data.project.name,status:data.project.status}].sort((a,b)=>a.id.localeCompare(b.id))}:previous);
    setView(data);setGuideReadFailed(false);
   }catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);if(guideAccessDenied(error))restrictProject(error,selection.projectId,confirmed);}}
  }catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);setGuideAccessReason(workspaceGuideAccessReason(error));if(guideAccessDenied(error))setGuideUnavailable(true);}}finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 const open=useCallback(async(projectId,append=false,navigation=null,portfolioSelection=null)=>{
  const currentPortfolio=portfolioContext.current;
  // A current validated summary card may request a read beyond the initial list.
  // The ordinary authenticated project GET remains the authority for access/data.
  const fromPortfolio=Boolean(portfolioSelection&&!append&&!navigation&&account&&account.officeReviewOnly!==true&&currentPortfolio?.account===account&&currentPortfolio.generation===generation.current&&portfolioSelection.scope===account.scope&&portfolioSelection.role===account.role&&portfolioSelection.project?.id===projectId&&portfolioOverviewMatches({scope:portfolioSelection.scope,organizationName:account.organizationName,role:portfolioSelection.role,projects:[portfolioSelection.project],nextCursor:null},{scope:account.scope,role:account.role}));
  if(portfolioSelection&&!fromPortfolio)return;
  identityNavigation.current=null;identityNavigationEpoch.current++;
  const navigationEpoch=identityNavigationEpoch.current;
  if(navigation&&(append||participantOnboardingNavigationTarget(navigation,{scope:account?.scope,projectId,canManageIntegrations:false})!=='worker-channel-title'))return;
  if(account?.officeReviewOnly===true){if(contextLocked)return;const selected=account.projects.find(project=>project.id===projectId);if(selected){initialProjectHint.current.consumed=true;setView(null);setIdentityProject(null);setOfficeProject({scope:account.scope,projectId,name:selected.name});}return;}
  if(!account||contextLocked||!fromPortfolio&&!account.projects.some(project=>project.id===projectId))return;initialProjectHint.current.consumed=true;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;setObservationEpoch(current);setChannelSnapshot(null);
  const cursor=append?view?.nextCursor:null;setIdentityProject(null);setPlanReadback(null);setNotice('');setGuideAccessReason(null);setLoading(true);if(!append){setView(null);setDraft(null);setReceipt(null);}
  try{
   const data=await request(query({projectId,scope:account.scope,...(cursor?{afterTask:cursor}:{})}),{signal:abort.signal});
   if(!mounted.current||current!==generation.current)return;
   if(data.scope!==account.scope||data.project.id!==projectId)throw new Error('La respuesta no coincide con la obra seleccionada.');
   if(fromPortfolio){
    if(data.project.status!=='ACTIVE'||typeof data.project.name!=='string'||!data.project.name.trim())throw new Error('No pudimos confirmar la obra activa. Volvé a consultar antes de continuar.');
    const confirmedProject={id:data.project.id,name:data.project.name,status:data.project.status};
    // Promote only the fresh canonical project, never the summary's label/counts.
    setAccount(previous=>previous===account?{...previous,projects:[...previous.projects.filter(project=>project.id!==projectId),confirmedProject].sort((a,b)=>a.id.localeCompare(b.id))}:previous);
   }
   if(navigation&&navigationEpoch===identityNavigationEpoch.current)identityNavigation.current={scope:account.scope,projectId,generation:current,target:'worker-channel'};
   setView(previous=>append?{...data,tasks:mergeLoadedTasks(previous?.tasks||[],data.tasks)}:data);
   setGuideReadFailed(false);
  }catch(error){if(mounted.current&&current===generation.current){identityNavigation.current=null;identityNavigationEpoch.current++;}if(error.name!=='AbortError'&&mounted.current&&current===generation.current){setNotice(error.message);setGuideReadFailed(true);if(guideAccessDenied(error))restrictProject(error,projectId);}}
  finally{if(mounted.current&&current===generation.current)setLoading(false);}
 },[account,contextLocked,request,restrictProject,view?.nextCursor]);
 useEffect(()=>{
  const hint=initialProjectHint.current;
  if(hint.consumed||!hint.projectId||!account||loading||contextLocked)return;
  // No implicit retry or later refresh may reopen the query-selected work.
  hint.consumed=true;
  if(!mounted.current||hint.listGeneration!==generation.current||account.officeReviewOnly===true||!Array.isArray(account.projects)||account.projects.filter(project=>project?.id===hint.projectId).length!==1)return;
  // The ordinary GET still decides current access and private-only KYC state.
  void open(hint.projectId);
 },[account,contextLocked,loading,open]);
 async function readRecordedSchedule(target){
  identityNavigation.current=null;identityNavigationEpoch.current++;
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
  async function consultScheduleRevision(){
   if(saving||attempt||!draft?.conflict||!account||!view)return;
   const current=generation.current,before=draft.conflict.before,context={scope:account.scope,projectId:view.project.id,taskId:draft.task.id,revision:before.revision},abort=new AbortController();controller.current=abort;
   setSaving(true);setNotice('');setDraft(old=>old?.task.id===context.taskId?{...old,conflict:{...old.conflict,state:'loading',snapshot:null,reviewed:false,error:null}}:old);
   try{
    const data=await request(query({scope:context.scope,projectId:context.projectId,taskId:context.taskId}),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
    if(!mounted.current||current!==generation.current)return;
    const confirmed=consultedScheduleTask(data,context);
    setDraft(old=>old?.task.id===context.taskId&&old.conflict?.before.revision===context.revision?{...old,conflict:{...old.conflict,state:confirmed.canPlan?'ready':'unavailable',snapshot:confirmed.task,reviewed:false,error:confirmed.canPlan?null:'Tu acceso actual permite consultar esta tarea, pero no volver a confirmar la planificación.'}}:old);
    setView(previous=>previous?.scope===context.scope&&previous.project.id===context.projectId?{...previous,canPlanSchedule:confirmed.canPlan,tasks:updateLoadedTask(previous.tasks,confirmed.task)}:previous);
    setNotice(confirmed.canPlan?'Revisión consultada. Revisá las fechas registradas y tu borrador antes de volver a confirmar.':'Tu acceso actual no permite confirmar esta planificación. Conservamos tu borrador para que puedas revisarlo o cancelarlo.');
   }catch(error){
    if(mounted.current&&current===generation.current){
     if(guideAccessDenied(error)){restrictProject(error,context.projectId);setNotice(error.message);}
     else{
      const missing=error.status===404&&error.code==='WORKSPACE_TASK_UNAVAILABLE';
      const message=missing?'Esta tarea ya no está disponible en la obra. Conservamos tus fechas y el motivo; no podés confirmar sin una revisión vigente.':'No pudimos consultar una revisión actual de esta tarea. Conservamos tus fechas y el motivo. Volvé a consultar o cancelá el borrador.';
      setDraft(old=>old?.task.id===context.taskId&&old.conflict?.before.revision===context.revision?{...old,conflict:{...old.conflict,state:missing?'missing':'failed',snapshot:null,reviewed:false,error:message}}:old);setNotice(message);
     }
    }
   }finally{if(mounted.current&&current===generation.current)setSaving(false);}
  }
 async function sendAttempt(payload,retrying=false){
  const current=generation.current,abort=new AbortController();controller.current=abort;
  setSaving(true);setNotice('');setAttempt(payload);setRetryAllowed(false);
  try{const data=await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])});if(mounted.current&&current===generation.current)applySaved(data);}
  catch(error){if(mounted.current&&current===generation.current){if(guideAccessDenied(error)){restrictProject(error,payload.projectId);setNotice(error.message);}else if(error.scheduleRevisionRejected===true&&payload.scope===account?.scope&&payload.projectId===view?.project.id&&payload.taskId===draft?.task.id&&payload.expectedRevision===(draft.conflict?.snapshot?.revision||draft.task.revision)){setAttempt(null);setDraft(old=>old?.task.id===payload.taskId?{...old,conflict:{state:'required',before:old.conflict?.snapshot||old.task,snapshot:null,reviewed:false,error:null}}:old);setNotice(error.message+' Conservamos el borrador. La consulta no vuelve a enviar la planificación.');}else if(retrying){setRetryAllowed(error.requestDispatched===false);setNotice(error.message+' Conservamos el intento anterior; comprobá su recibo antes de modificar la planificación.');}else if(error.requestDispatched===false||(error.status&&error.status<500)){setAttempt(null);setNotice(error.message);}else setNotice('El servidor no confirmó el guardado. Conservamos este intento: comprobá el recibo antes de modificar o reenviar.');}}
  finally{if(mounted.current&&current===generation.current)setSaving(false);}
 }
 async function save(event){
  event.preventDefault();if(saving||attempt||!draft||!view||draft.conflict&&(draft.conflict.state!=='ready'||draft.conflict.reviewed!==true))return;
  await sendAttempt({operationId:crypto.randomUUID(),projectId:view.project.id,taskId:draft.task.id,scope:account.scope,expectedRevision:draft.conflict?.snapshot?.revision||draft.task.revision,startsOn:draft.startsOn,endsOn:draft.endsOn,reason:draft.reason});
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
  <div className={styles.heading}><div><p className={styles.eyebrow}>ESPACIO DE TRABAJO</p><h2 id="workspace-title">Panel de obra</h2></div><button id="workspace-refresh" type="button" className={styles.refresh} onClick={refresh} disabled={contextLocked||loading} aria-describedby={contextLocked?'workspace-context-lock':undefined}><RefreshCw size={16} aria-hidden="true"/>Actualizar</button></div>
  <div role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</div>
  {planReadbackMatches&&planReadback.status==='failed'&&<button type="button" disabled={loading||contextLocked} onClick={()=>readRecordedSchedule(planReadback)}>Volver a consultar el cronograma</button>}
  {loading&&<p className={styles.loading}><LoaderCircle size={18} className={styles.spinner} aria-hidden="true"/>Consultando registros autorizados…</p>}
  {contextLocked&&<p className={styles.contextLock} id="workspace-context-lock"><LockKeyhole size={16} aria-hidden="true"/><span>Hay una acción en curso. Finalizala para cambiar de obra.</span></p>}
  {account&&<><div className={styles.context}><div className={styles.company}><Building2 size={22} aria-hidden="true"/><div><span>Empresa</span><strong>{account.organizationName}</strong></div></div><dl className={styles.contextDetails}><div><dt>Tu acceso</dt><dd>{identitySelection?'Presentación privada de identidad':account.roleLabel}</dd></div></dl></div>
   {!account.projects.length&&!loading&&<div className={styles.empty}><FolderKanban size={25} aria-hidden="true"/><strong>No hay obras activas asignadas a tu cuenta.</strong><p>Pedile al responsable que revise tu pertenencia y la obra asignada. Podés volver a actualizar cuando confirme el acceso.</p></div>}
   <details className={styles.projectPicker} open={!view&&!identitySelection&&!officeSelection?true:undefined}><summary>Obra actual: <strong>{view?.project.name||identitySelection?.name||officeSelection?.name||"Elegir una obra"}</strong><span>Cambiar obra</span></summary>{account.projects.length>0&&<div className={styles.projectCollection}><div className={styles.collectionHeading}><h3>Obras disponibles</h3><span>{account.projects.length}{account.projectsTruncated?' mostradas':account.projects.length===1?' asignada':' asignadas'}</span></div><div className={styles.projects}>{account.projects.map(project=><button key={project.id} type="button" onClick={()=>open(project.id)} disabled={contextLocked} aria-pressed={(view?.project.id||identitySelection?.projectId||officeSelection?.projectId)===project.id}><span className={styles.projectName}><FolderKanban size={18} aria-hidden="true"/><span>{project.name}</span></span><small>{(view?.project.id||identitySelection?.projectId||officeSelection?.projectId)===project.id?<><Check size={14} aria-hidden="true"/>Seleccionada</>:<>Abrir obra<ArrowUpRight size={14} aria-hidden="true"/></>}</small></button>)}</div></div>}</details>
   {account.projectsTruncated&&<p>{account.projects.length>100?'La lista incluye las primeras 100 obras y las que abriste desde el resumen.':'Se muestran las primeras 100 obras autorizadas.'}</p>}
   {identityProjectChoice&&<div className={styles.startState} data-identity-project-choice><strong>Elegí la obra para continuar con tu identidad</strong><p>Abrila desde «Obras disponibles». No se elige ninguna obra automáticamente.</p></div>}
   {account.projects.length>0&&!view&&!identitySelection&&!officeSelection&&!loading&&!identityProjectChoice&&<div className={styles.startState}><strong>Abrí una obra para empezar</strong><p>{account.officeReviewOnly===true?'Consultá sólo los eventos de lectura que el administrador seleccionó.':'Consultá el cronograma, registrá el trabajo y accedé a las herramientas disponibles para tu rol.'}</p></div>}
  </>}
  {identitySelection&&<><section className={styles.startState} aria-labelledby="identity-access-title"><h3 id="identity-access-title">Mi participación en esta obra</h3><p>Presentá tu identidad y consultá tu WhatsApp. El acceso al trabajo depende de la revisión y los permisos asignados.</p><button type="button" disabled={contextLocked||loading} onClick={()=>open(identitySelection.projectId)}>Comprobar habilitación de obra</button></section><nav className={styles.moduleNav} aria-label="Mi participación en la obra"><a href="#participant-title" className={privateSection==='identidad'?styles.primary:undefined} aria-current={privateSection==='identidad'?'page':undefined} onClick={event=>navigatePrivate(event,'participant-title')}>Mi identidad</a><a href="#worker-channel-title" className={privateSection==='mi-whatsapp'?styles.primary:undefined} aria-current={privateSection==='mi-whatsapp'?'page':undefined} onClick={event=>navigatePrivate(event,'worker-channel-title')}>Mi WhatsApp</a></nav><WorkspaceScreen name="identidad" active={privateSection}><ParticipantPanel active={privateSection==='identidad'} key={`identity-only:${identitySelection.scope}:${identitySelection.projectId}`} presentation="own-identity" projectId={identitySelection.projectId} scope={identitySelection.scope} getSessionToken={getSessionToken} onPending={participantPending} onNavigate={value=>{if(mounted.current&&generation.current===observationEpoch&&participantOnboardingNavigationTarget(value,{scope:identitySelection.scope,projectId:identitySelection.projectId,canManageIntegrations:false})==='worker-channel-title')void open(identitySelection.projectId,false,value);}}/></WorkspaceScreen><WorkspaceScreen name="mi-whatsapp" active={privateSection}><WorkerChannelPanel key={`identity-channel:${identitySelection.scope}:${identitySelection.projectId}`} presentation="own-privacy" projectId={identitySelection.projectId} scope={identitySelection.scope} getSessionToken={getSessionToken} onPending={channelPending} observationEpoch={observationEpoch}/></WorkspaceScreen></>}
  {view&&['inicio','cronograma'].includes(activeSection)&&<WorksiteLiveRefreshStatus refresh={scheduleLive} paused={contextLocked||loading} label="Cronograma" manual={refresh} manualLabel="Consultar cronograma completo"/>}
  {account&&!identitySelection&&!officeSelection&&<div className={styles.workbench}><WorkspaceToolsNavigation projectAvailable={Boolean(view)} activeSection={activeSection} role={account?.role} canManageIntegrations={account?.canManageIntegrations} canImportPlan={view?.canPlanSchedule} pending={modulePending} schedulePending={saving||Boolean(attempt)||Boolean(draft)||creatingTask} scheduleEditing={Boolean(draft)}/><div className={styles.modules}>
  <WorkspaceScreen name="recuperacion" active={activeSection}><h3 id="workspace-recovery-title" className={styles.screenTitle}>Operaciones pendientes</h3>{!identitySelection&&account.officeReviewOnly!==true&&<WorkspaceRecoveryPanel showEmpty key={account.scope} scope={account.scope} projects={account.projects} getSessionToken={getSessionToken} onRecovered={(result,reference)=>{if(reference?.resource==='project-creation'&&projectCreationReceiptOutcome(result,reference)?.state==='RECORDED'){setCreationRecovery(result);projectCreated(result);}else if(reference?.resource==='project-preparation'&&result.scope===reference.scope&&result.projectId===reference.projectId&&['RECORDED','CANCELLED'].includes(result.state)){setPreparationRecovery(result);if(result.state==='RECORDED')projectPrepared(result);}else if(reference?.resource==='plan-import'&&result.scope===reference.scope&&result.projectId===reference.projectId&&result.saved===true&&result.receiptId&&result.action==='APPLY'&&result.draft?.status==='APPLIED')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'plan'});else if(reference?.resource==='plan-measurement'&&result.scope===reference.scope&&result.projectId===reference.projectId&&result.saved===true&&result.definitive===true&&result.receiptId&&result.action==='APPLY_MEASUREMENT'&&result.draft?.status==='APPLIED')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'plan'});else if(result.created===true&&result.task&&reference?.resource==='task-creation')readRecordedSchedule({scope:reference.scope,projectId:reference.projectId,kind:'task'});else if(result.task)tasksChanged(result.task,reference);}}/>}</WorkspaceScreen>
  <WorkspaceScreen name="inicio" active={activeSection}>{view?<WorkspaceOverview project={view.project} tasks={view.tasks} totalTasks={view.totalTasks} nextCursor={view.nextCursor} roleLabel={account.roleLabel} canPlan={view.canPlanSchedule} scope={account.scope} active={activeSection==='inicio'} blocked={contextLocked||loading} observationKey={observationEpoch} onAccessRejected={error=>{const current=scheduleLiveContext.current;if(!mounted.current||generation.current!==observationEpoch||current.account!==account||current.view?.project.id!==view.project.id)return false;restrictProject(error,view.project.id);}} canManageDecisions={account.canManageIntegrations===true&&['ADMIN','DIRECTOR'].includes(account.role)} getSessionToken={getSessionToken}/>:identityProjectChoice?null:<h3 id="workspace-home-title" className={styles.screenTitle}>Espacio de tu empresa</h3>}{!identitySelection&&account.officeReviewOnly!==true&&!identityProjectChoice&&<PortfolioOverviewPanel key={`portfolio:${account.scope}`} scope={account.scope} role={account.role} getSessionToken={getSessionToken} locked={contextLocked||loading} onOpenProject={(projectId,selection)=>open(projectId,false,null,selection)} onAccessRejected={portfolioAccessRejected}/>}</WorkspaceScreen>
  <WorkspaceScreen name="plan" active={activeSection}><h3 id="company-subscription-title" className={styles.screenTitle}>Plan y facturación</h3>{account?.role==='ADMIN'&&account.officeReviewOnly!==true&&<CompanySubscriptionPanel key={`billing:${account.scope}`} scope={account.scope} getSessionToken={getSessionToken}/>}</WorkspaceScreen>
  <WorkspaceScreen name="cronograma" active={activeSection}>{view&&<section aria-labelledby="schedule-title" className={styles.schedule}>
   <div className={styles.heading}><div><p className={styles.eyebrow}>CRONOGRAMA REGISTRADO</p><h3 id="schedule-title">{view.project.name}</h3></div><span>{view.tasks.length} de {view.totalTasks} tareas</span></div>
   {view.canPlanSchedule&&!draft&&<TaskCreatePanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={setTaskCreating} locked={planReadbackPending||Boolean(modulePending.plan)||Boolean(modulePending.planMeasurement)} onCreated={()=>readRecordedSchedule({scope:account.scope,projectId:view.project.id,kind:'task'})}/> }
    {view.canPlanSchedule&&!draft&&<PlanImportPanel key={`plan:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={planPending} canonicalAccess={!loading&&view.canPlanSchedule===true&&account.officeReviewOnly!==true&&view.scope===account.scope&&account.projects.some(project=>project.id===view.project.id)} initialPlanId={view.project.id===initialProjectId&&typeof initialPlanId==='string'&&initialPlanId.length===75&&/^plan_draft_[a-f0-9]{64}$/.test(initialPlanId)?initialPlanId:''} locked={saving||Boolean(attempt)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='plan'&&value)} onApplied={()=>readRecordedSchedule({scope:account.scope,projectId:view.project.id,kind:'plan'})}/>}
   {account.canConfigureProgressMeasurement===true&&!draft&&<PlanMeasurementPanel key={`plan-measurement:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={planMeasurementPending} canonicalAccess={!loading&&account.canConfigureProgressMeasurement===true&&account.officeReviewOnly!==true&&view.scope===account.scope&&account.projects.some(project=>project.id===view.project.id)} locked={saving||Boolean(attempt)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='planMeasurement'&&value)} onApplied={()=>readRecordedSchedule({scope:account.scope,projectId:view.project.id,kind:'plan'})}/>}
   {['ADMIN','DIRECTOR'].includes(account?.role)&&<PlanBaselinePanel key={`baseline:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={baselinePending} canonicalAccess={!loading&&account.officeReviewOnly!==true&&view.scope===account.scope&&account.projects.some(project=>project.id===view.project.id)} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='baseline'&&value)}/>}
   <ScheduleWorkbench key={`schedule:${account.scope}:${view.project.id}`} tasks={view.tasks} totalTasks={view.totalTasks} nextCursor={view.nextCursor} canPlan={view.canPlanSchedule} canConfigureMeasurement={account.canConfigureProgressMeasurement===true} locked={contextLocked} onConfigureMeasurement={task=>{if(account.canConfigureProgressMeasurement!==true||contextLocked)return;setNotice('');setMeasurementSelection({scope:account.scope,projectId:view.project.id,taskId:task.id});}} onPlan={task=>{setReceipt(null);setNotice('');setDraft({task,startsOn:task.startsOn||'',endsOn:task.endsOn||'',reason:''});}}/>
   {['ADMIN','DIRECTOR','SITE_MANAGER'].includes(account?.role)&&<ApprovedProgressCurvePanel key={`approved-progress:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} generation={observationEpoch} tasks={view.tasks} getSessionToken={getSessionToken} active={activeSection==='cronograma'} canonicalAccess={!loading&&account.officeReviewOnly!==true&&view.scope===account.scope&&account.projects.some(project=>project.id===view.project.id)} disabled={contextLocked||loading} onAccessDenied={error=>{const current=scheduleLiveContext.current;if(mounted.current&&generation.current===observationEpoch&&current.account===account&&current.view?.project.id===view.project.id)restrictProject(error,view.project.id);}}/>}
   {measurementTask&&<TaskProgressMeasurementEditor key={`measurement:${account.scope}:${view.project.id}:${measurementTask.id}`} task={measurementTask} projectId={view.project.id} scope={account.scope} allowed={account.canConfigureProgressMeasurement===true} getSessionToken={getSessionToken} onPending={measurementPending} onClose={closeMeasurement} onChanged={task=>{tasksChanged(task,{scope:account.scope,projectId:view.project.id});setNotice('Base de medición guardada. Las cantidades ejecutadas siguen requiriendo propuesta y aprobación.');}}/>}
   {view.nextCursor&&<button id="schedule-load-more" type="button" disabled={loading||contextLocked} onClick={()=>open(view.project.id,true)}>Cargar más tareas</button>}
   {!view.canPlanSchedule&&<p className={styles.caption}>Tu rol permite consultar este cronograma, no modificarlo.</p>}
   {draft&&<form onSubmit={save} className={styles.form} aria-labelledby="schedule-edit-title"><h4 id="schedule-edit-title" ref={scheduleEditor} tabIndex={-1}>Planificar: {draft.task.title}</h4><p>Revisá las fechas previstas y explicá el motivo. El cambio no certifica avance ni registra horas trabajadas.</p>
    {draft.conflict&&<section data-schedule-conflict aria-labelledby="schedule-conflict-title" style={{border:'1px solid #967b4d',borderRadius:10,padding:'1rem',marginBlock:'1rem',overflowWrap:'anywhere'}}><h5 id="schedule-conflict-title" style={{margin:'0 0 .5rem',fontSize:16}}>La tarea cambió antes de guardar</h5><p>Tus fechas y el motivo siguen en el borrador. Consultar no vuelve a enviar la planificación.</p>{draft.conflict.error&&<p role="status">{draft.conflict.error}</p>}{draft.conflict.snapshot&&<><dl><dt>Tarea consultada</dt><dd>{draft.conflict.snapshot.title}</dd><dt>Fechas registradas en esta consulta</dt><dd>{draft.conflict.snapshot.startsOn||'Sin inicio'} → {draft.conflict.snapshot.endsOn||'Sin fin'}</dd><dt>Revisión consultada</dt><dd data-schedule-consulted-revision style={{marginInlineStart:0,fontFamily:'monospace'}}>{draft.conflict.snapshot.revision}</dd></dl>{draft.conflict.state==='ready'&&<label style={{flexDirection:'row',alignItems:'center',minHeight:44,gap:12}}><input type="checkbox" style={{width:20,height:20,padding:0,flex:'0 0 auto'}} checked={draft.conflict.reviewed===true} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,conflict:{...draft.conflict,reviewed:event.target.checked}})}/><span>Revisé la planificación consultada y quiero volver a confirmar mi borrador.</span></label>}</>}<button type="button" disabled={saving||Boolean(attempt)} onClick={consultScheduleRevision}>{saving?'Consultando revisión…':'Consultar revisión actual'}</button></section>}
    <div className={styles.dates}><label>Inicio previsto<input type="date" required value={draft.startsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,startsOn:event.target.value})}/></label><label>Fin previsto<input type="date" required min={draft.startsOn||undefined} value={draft.endsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,endsOn:event.target.value})}/></label></div>
    <label>Motivo del cambio<textarea required minLength={8} maxLength={800} rows={3} value={draft.reason} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,reason:event.target.value})}/></label>
    <div className={styles.actions}>{attempt?<><button type="button" disabled={saving} onClick={recover}>{saving?'Comprobando…':'Comprobar guardado'}</button>{retryAllowed&&<button type="button" disabled={saving} onClick={retry}>Reintentar la misma planificación</button>}</>:<><button className={styles.primary} type="submit" disabled={saving||Boolean(draft.conflict&&(draft.conflict.state!=='ready'||draft.conflict.reviewed!==true))}>Confirmar planificación</button><button type="button" disabled={saving} onClick={()=>setDraft(null)}>Cancelar</button></>}</div>
   </form>}
   {receipt&&<div className={styles.receipt}><strong>Cambio confirmado</strong><span>{receipt.after.startsOn} → {receipt.after.endsOn}</span><small>Recibo: {receipt.id}</small></div>}
  </section>}</WorkspaceScreen>
  <WorkspaceScreen name="preparacion" active={activeSection}>{view&&['ADMIN','DIRECTOR'].includes(account?.role)&&<ProjectPreparationPanel key={`project-preparation:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={projectPreparationPending} onPrepared={projectPrepared} recovered={preparationRecovery} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='projectPreparation'&&value)}/> }</WorkspaceScreen>
  <WorkspaceScreen name="nueva-obra" active={activeSection}>{view&&account?.role==='ADMIN'&&<ProjectCreationPanel key={`project-creation:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={projectCreationPending} onCreated={projectCreated} recovered={creationRecovery} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='projectCreation'&&value)}/>}</WorkspaceScreen>
  <WorkspaceScreen name="registros" active={activeSection}>{view&&account?.canManageIntegrations&&<SiteRegisterPanel key={`register:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={registerPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="identidad" active={activeSection}>{view&&<ParticipantPanel active={activeSection==='identidad'} key={`participants:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={participantPending} channelSnapshot={channelSnapshot?.scope===account.scope&&channelSnapshot.projectId===view.project.id&&channelSnapshot.observedGeneration===observationEpoch?channelSnapshot:null} onNavigate={navigateOnboarding}/> }</WorkspaceScreen>
  <WorkspaceScreen name="mi-whatsapp" active={activeSection}>{view&&<WorkerChannelPanel key={`channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={channelPending} observationEpoch={observationEpoch} onSnapshot={channelObserved}/> }</WorkspaceScreen>
  <WorkspaceScreen name="numero" active={activeSection}>{view&&account?.role==='ADMIN'&&<OwnCompanyNumberPanel key={`own-company-number:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={ownCompanyNumberPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='ownCompanyNumber'&&value)}/> }</WorkspaceScreen>
  <WorkspaceScreen name="plantillas" active={activeSection}>{view&&account?.role==='ADMIN'&&<OwnCompanyTemplatesPanel key={`own-company-templates:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={ownCompanyTemplatesPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='ownCompanyTemplates'&&value)}/> }</WorkspaceScreen>
  <WorkspaceScreen name="canal" active={activeSection}>{view&&(account?.role==='ADMIN'||account?.canManageIntegrations)&&<CompanyChannelPanel key={`company-channel:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={companyChannelPending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='companyChannel'&&value)}/> }</WorkspaceScreen>
  <WorkspaceScreen name="piloto" active={activeSection}>{view&&account?.role==='ADMIN'&&<DemoPilotPanel key={`demo:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={demoPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="actividad" active={activeSection}>{view&&<FieldOperationsPanel active={activeSection==='actividad'} backgroundBlocked={contextLocked||loading} key={`field:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} taskPaging={{totalTasks:view.totalTasks,nextCursor:view.nextCursor,...taskPageRead}} onLoadMoreTasks={loadMoreDraftTasks} onTaskReadBusy={fieldTaskReadBusy} onPending={fieldPending} onTasksChanged={task=>tasksChanged(task,{scope:account.scope,projectId:view.project.id})} onNavigateSchedule={navigateProgressSchedule}/> }</WorkspaceScreen>
  <WorkspaceScreen name="materiales" active={activeSection}>{view&&<MaterialInventoryPanel active={activeSection==='materiales'} backgroundBlocked={contextLocked||loading} interactionBlocked={inventoryInteractionBlocked} key={`inventory:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} tasks={view.tasks} taskPaging={{totalTasks:view.totalTasks,nextCursor:view.nextCursor,...taskPageRead}} onLoadMoreTasks={loadMoreDraftTasks} onTaskReadBusy={inventoryTaskReadBusy} onPending={inventoryPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="compras" active={activeSection}>{view&&account?.canManageIntegrations&&<SitePurchasePanel key={`purchases:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={purchasePending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="configurar-whatsapp" active={activeSection}>{view&&account?.canManageIntegrations&&<CustomerWhatsAppPanel key={`${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={preparationPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="conexion" active={activeSection}>{view&&account?.canManageIntegrations&&<MetaOnboardingPanel key={`meta:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={metaPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="bandeja" active={activeSection}>{view&&account?.canManageIntegrations&&<CustomerInboxPanel key={`inbox:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={inboxPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="recordatorios" active={activeSection}>{view&&account?.canManageIntegrations&&<TemplateSendPanel key={`template-send:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={templatePending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="clientes" active={activeSection}>{view&&account?.role==='ADMIN'&&<ConstructorCrmPanel key={`crm:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken} onPending={crmPending}/> }</WorkspaceScreen>
  <WorkspaceScreen name="actividad-administrativa" active={activeSection}>{view&&account?.canManageIntegrations&&<OperationsStatusPanel key={`operations:${account.scope}:${view.project.id}`} projectId={view.project.id} scope={account.scope} getSessionToken={getSessionToken}/> }</WorkspaceScreen>
  <WorkspaceScreen name="accesos" active={activeSection}>{view&&account?.role==='ADMIN'&&<OfficeReviewAdminPanel key={`office-admin:${account.scope}:${view.project.id}`} scope={account.scope} projectId={view.project.id} getSessionToken={getSessionToken} onPending={officePending} locked={saving||Boolean(attempt)||Boolean(draft)||creatingTask||planReadbackPending||Object.entries(modulePending).some(([key,value])=>key!=='office'&&value)}/>}</WorkspaceScreen>
  </div></div>}
  {officeSelection&&<OfficeReviewPanel key={`office-review:${officeSelection.scope}:${officeSelection.projectId}`} scope={officeSelection.scope} projectId={officeSelection.projectId} getSessionToken={getSessionToken}/>}
 </section>;
}
