'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,CalendarDays,UsersRound,Package,HardHat,RefreshCw} from 'lucide-react';
import {loadedScheduleOverview} from './schedule-workbench.mjs';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {inventoryPendingCounts,INVENTORY_PENDING_EVENT} from './material-inventory-view.mjs';
import {FIELD_PROGRESS_PENDING_EVENT} from './field-review-page-view.mjs';
import styles from './workspace.module.css';
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.sort().join('|');
function decisionsSnapshot(value,projectId,scope){
 const at=value?.observedAt;
 if(!exact(value,['scope','projectId','view','observedAt','proposals','inventory'])||value.scope!==scope||value.projectId!==projectId||value.view!=='decisions'||
  typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at)||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at||
  !exact(value.proposals,['pending'])||!Number.isSafeInteger(value.proposals.pending)||value.proposals.pending<0||
  !exact(value.inventory,['canManage','pendingCounts'])||!inventoryPendingCounts({...value.inventory,inventoryFilter:'PENDING'}))throw new Error('DECISIONS_RESPONSE_UNCONFIRMED');
 return value;
}
function Decisions({projectId,scope,active,allowed,getSessionToken}){
 const request=useWorkspaceRequest(getSessionToken),reload=useRef(null);
 const [state,setState]=useState({busy:false,data:null,notice:''});
 useEffect(()=>{
  if(!active||!allowed)return;
  let alive=true,inFlight=false,controller;
  async function load(){
   if(inFlight||!alive)return;inFlight=true;controller=new AbortController();setState({busy:true,data:null,notice:''});
   try{
    const result=await request('/api/identity/operations-status?'+new URLSearchParams({projectId,scope,view:'decisions'}),{signal:controller.signal,requestTimeoutMs:15000},async response=>{
     if(!response.ok)throw new Error(response.status===401||response.status===403?'DECISIONS_ACCESS_REQUIRED':'DECISIONS_UNAVAILABLE');
     return decisionsSnapshot(await response.json(),projectId,scope);
    });
    if(alive)setState({busy:false,data:result,notice:''});
   }catch(error){if(alive)setState({busy:false,data:null,notice:error.message==='DECISIONS_ACCESS_REQUIRED'?'No se pudieron consultar los pendientes con tu acceso actual.':'No pudimos confirmar los pendientes de esta obra. Volvé a consultar.'});}
   finally{inFlight=false;}
  }
  reload.current=load;void load();
  return()=>{alive=false;controller?.abort();reload.current=null;};
 },[active,allowed,projectId,scope,request]);
 if(!allowed)return null;
 const data=state.data,counts=data?.inventory.pendingCounts;
 const open=eventName=>window.dispatchEvent(new CustomEvent(eventName,{detail:{projectId,scope}}));
 return <section className={styles.decisions} aria-labelledby="home-decisions-title">
  <div className={styles.decisionsHeading}><h4 id="home-decisions-title">Por revisar</h4><button type="button" onClick={()=>reload.current?.()} disabled={state.busy}><RefreshCw size={15} aria-hidden="true"/>{data?'Actualizar pendientes':'Consultar pendientes'}</button></div>
  <p role="status" aria-live="polite" className={styles.caption}>{state.busy?'Consultando pendientes…':state.notice}</p>
  {data&&<><div className={styles.decisionCards}>
   <article><p>Avances de obra</p><strong>{data.proposals.pending}</strong><span>propuestas pendientes</span><a href="#field-title" onClick={()=>open(FIELD_PROGRESS_PENDING_EVENT)}>Revisar avances <ArrowUpRight size={16} aria-hidden="true"/></a></article>
   <article><p>Materiales</p><dl><div><dt>Consumos pendientes</dt><dd>{counts.consumptions}</dd></div><div><dt>Existencias pendientes</dt><dd>{counts.adjustments}</dd></div></dl><a href="#inventory-title" onClick={()=>open(INVENTORY_PENDING_EVENT)}>Revisar materiales <ArrowUpRight size={16} aria-hidden="true"/></a></article>
  </div><p className={styles.decisionsObserved}>Consultado {new Date(data.observedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})} (hora de Argentina). Las colas comprueban nuevamente los registros al abrirlas.</p></>}
 </section>;
}
export function WorkspaceOverview({project,tasks,totalTasks,nextCursor,roleLabel,canPlan,scope,active=false,canManageDecisions=false,getSessionToken}){
 const overview=loadedScheduleOverview(tasks,totalTasks,nextCursor);
 return <section aria-labelledby="workspace-home-title" className={styles.overview}>
  <div className={styles.overviewHeading}><p className={styles.eyebrow}>RESUMEN DE LA OBRA</p><h3 id="workspace-home-title">{project.name}</h3><p>Elegí una tarea para continuar.</p></div>
  <Decisions key={scope+':'+project.id} projectId={project.id} scope={scope} active={active} allowed={canManageDecisions===true} getSessionToken={getSessionToken}/>
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
