'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import {ArrowUpRight,CalendarDays,UsersRound,Package,HardHat,RefreshCw} from 'lucide-react';
import {loadedScheduleOverview} from './schedule-workbench.mjs';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {useWorksiteLiveRefresh} from './workspace-live-refresh';
import {inventoryPendingCounts,INVENTORY_PENDING_EVENT} from './material-inventory-view.mjs';
import {FIELD_EVIDENCE_PENDING_EVENT,FIELD_PROGRESS_PENDING_EVENT} from './field-review-page-view.mjs';
import styles from './workspace.module.css';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.sort().join('|');
function decisionsSnapshot(value,projectId,scope){
 const at=value?.observedAt;
 if(!exact(value,['scope','projectId','view','observedAt','evidence','proposals','inventory'])||value.scope!==scope||value.projectId!==projectId||value.view!=='decisions'||
  typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at)||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at||
  !exact(value.proposals,['pending'])||!Number.isSafeInteger(value.proposals.pending)||value.proposals.pending<0||
  !exact(value.evidence,['pending'])||!Number.isSafeInteger(value.evidence.pending)||value.evidence.pending<0||
  !exact(value.inventory,['canManage','pendingCounts'])||!inventoryPendingCounts({...value.inventory,inventoryFilter:'PENDING'}))throw new Error('DECISIONS_RESPONSE_UNCONFIRMED');
 return value;
}
function Decisions({projectId,scope,active,allowed,blocked,observationKey,getSessionToken,onAccessRejected}){
 const request=useWorkspaceRequest(getSessionToken),owner=[scope,projectId,observationKey,'decisions'].join(':'),latest=useRef(null),mounted=useRef(false);
 const [snapshot,setSnapshot]=useState(null),[rejectedOwner,setRejectedOwner]=useState(null);
 const rejected=rejectedOwner===owner;
 useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useLayoutEffect(()=>{latest.current={owner,request,active,allowed,blocked,rejected,onAccessRejected};});
 const authorityCurrent=stamp=>mounted.current&&stamp?.owner===latest.current?.owner&&stamp?.request===latest.current?.request&&latest.current.allowed;
 const usable=stamp=>authorityCurrent(stamp)&&latest.current.active&&!latest.current.blocked&&!latest.current.rejected;
 const refresh=useWorksiteLiveRefresh({
  contextKey:owner,enabled:active&&allowed&&!rejected,blocked,
  getAuthorityStamp:()=>({owner:latest.current.owner,request:latest.current.request}),
  read:async signal=>{
   const stamp={owner,request};if(!usable(stamp))throw new DOMException('Consulta cancelada.','AbortError');
   const data=await request('/api/identity/operations-status?'+new URLSearchParams({projectId,scope,view:'decisions'}),{signal,requestTimeoutMs:15000},async response=>{
    if(!response.ok){let body;try{body=await response.json();}catch{}throw Object.assign(new Error('DECISIONS_UNAVAILABLE'),{status:response.status,code:typeof body?.code==='string'?body.code:null});}
    return decisionsSnapshot(await response.json(),projectId,scope);
   });
   return {stamp,data};
  },
  apply:value=>{if(!usable(value.stamp))return false;setSnapshot(value);return {updates:false};},
  isCurrent:usable,isAuthorityCurrent:authorityCurrent,
  onAccessRejected:error=>{
   const current=latest.current;if(!mounted.current||current.owner!==owner||current.request!==request)return false;
   if(current.onAccessRejected?.(error)===false)return false;
   setSnapshot(null);setRejectedOwner(owner);return true;
  }
 });
 if(!allowed)return null;
 const data=!rejected&&snapshot?.stamp.owner===owner&&snapshot.stamp.request===request?snapshot.data:null,counts=data?.inventory.pendingCounts,status=refresh.status;
 const busy=status.state==='CONSULTING',paused=blocked||!active;
 const notice=rejected?'Tu acceso cambió. Volvé a consultar la obra antes de continuar.':
  paused?'La actualización de pendientes está en pausa mientras terminás lo preparado.':
  status.state==='OFFLINE'?'Sin conexión. Conservamos la última consulta de pendientes.':
  status.state==='HIDDEN'?'La consulta de pendientes está en pausa mientras esta pestaña no está visible.':
  ['STALE','LIMITED','ACCESS'].includes(status.state)?status.message:busy?'Consultando pendientes…':'';
 const open=(event,eventName)=>{if(!data||!usable({owner,request})){event.preventDefault();return;}window.dispatchEvent(new CustomEvent(eventName,{detail:{projectId,scope}}));};
 return <section className={styles.decisions} aria-labelledby="home-decisions-title">
  <div className={styles.decisionsHeading}><h4 id="home-decisions-title">Por revisar</h4><button type="button" onClick={refresh.check} disabled={busy||paused||rejected}><RefreshCw size={15} aria-hidden="true"/>{data?'Actualizar pendientes':'Consultar pendientes'}</button></div>
  <p role="status" aria-live="polite" className={styles.caption}>{notice}</p>
  {data&&<><div className={styles.decisionCards}>
   <article><p>Evidencias</p><strong>{data.evidence.pending}</strong><span>archivos pendientes de revisión</span><a href="#field-title" aria-disabled={paused} onClick={event=>open(event,FIELD_EVIDENCE_PENDING_EVENT)}>Revisar evidencias <ArrowUpRight size={16} aria-hidden="true"/></a></article>
   <article><p>Avances de obra</p><strong>{data.proposals.pending}</strong><span>propuestas pendientes</span><a href="#field-title" aria-disabled={paused} onClick={event=>open(event,FIELD_PROGRESS_PENDING_EVENT)}>Revisar avances <ArrowUpRight size={16} aria-hidden="true"/></a></article>
   <article><p>Materiales</p><dl><div><dt>Consumos pendientes</dt><dd>{counts.consumptions}</dd></div><div><dt>Existencias pendientes</dt><dd>{counts.adjustments}</dd></div></dl><a href="#inventory-title" aria-disabled={paused} onClick={event=>open(event,INVENTORY_PENDING_EVENT)}>Revisar materiales <ArrowUpRight size={16} aria-hidden="true"/></a></article>
  </div><p className={styles.decisionsObserved}>Consultado {new Date(data.observedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'})} (hora de Argentina). Las colas comprueban nuevamente los registros al abrirlas.</p></>}
 </section>;
}
export function WorkspaceOverview({project,tasks,totalTasks,nextCursor,roleLabel,canPlan,scope,active=false,blocked=false,observationKey=0,canManageDecisions=false,getSessionToken,onAccessRejected}){
 const overview=loadedScheduleOverview(tasks,totalTasks,nextCursor);
 return <section aria-labelledby="workspace-home-title" className={styles.overview}>
  <div className={styles.overviewHeading}><p className={styles.eyebrow}>RESUMEN DE LA OBRA</p><h3 id="workspace-home-title">{project.name}</h3><p>Elegí una tarea para continuar.</p></div>
  <Decisions key={scope+':'+project.id+':'+observationKey} projectId={project.id} scope={scope} active={active} blocked={blocked} observationKey={observationKey} allowed={canManageDecisions===true} getSessionToken={getSessionToken} onAccessRejected={onAccessRejected}/>
  <div className={styles.quickActions}>
   <a className={styles.featuredAction} href="#participant-title"><UsersRound size={23} aria-hidden="true"/><span><strong>Equipo e identidad</strong><small>Continuar una presentación o revisar al equipo</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
   <a href="#field-title"><HardHat size={23} aria-hidden="true"/><span><strong>Registrar el trabajo</strong><small>Jornada, fotos y avances de obra</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
   <a href="#schedule-title"><CalendarDays size={23} aria-hidden="true"/><span><strong>Ver el cronograma</strong><small>{canPlan?'Consultar tareas y organizar las próximas fechas':'Consultar las tareas de esta obra'}</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
   <a href="#inventory-title"><Package size={23} aria-hidden="true"/><span><strong>Consultar materiales</strong><small>Inventario y consumos registrados</small></span><ArrowUpRight size={18} aria-hidden="true"/></a>
  </div>
  <dl className={styles.overviewMetrics}><div><dt>Tareas cargadas</dt><dd>{overview.loaded}{overview.partial?<small> de {overview.total??'total sin confirmar'}</small>:null}</dd></div><div><dt>Sin fechas previstas</dt><dd>{overview.missingDates}</dd></div><div><dt>Tu acceso</dt><dd className={styles.roleMetric}>{roleLabel}</dd></div></dl>
  {overview.partial&&<p className={styles.caption}>Los indicadores corresponden a las tareas cargadas. Consultá el cronograma para cargar más.</p>}
  {overview.missingDates>0&&<p className={styles.overviewNote}>Hay tareas con fechas pendientes de definir. Podés consultarlas en el cronograma.</p>}
 </section>;
}
