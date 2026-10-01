'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import styles from './workspace.module.css';
const endpoint='/api/identity/workspace';
const messages={WORKSPACE_ORGANIZATION_REQUIRED:'Elegí una organización desde tu cuenta para consultar las obras asignadas.',WORKSPACE_MEMBERSHIP_REQUIRED:'Tu organización activa todavía no tiene una pertenencia vigente vinculada a esta cuenta.',WORKSPACE_PROJECT_UNAVAILABLE:'Esta obra no está disponible con tus permisos actuales.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a cargar las obras antes de continuar.',SCHEDULE_REVISION_CHANGED:'Otra persona modificó la tarea. Actualizá el cronograma antes de volver a planificar.',SCHEDULE_PERMISSION_REQUIRED:'Tu rol actual no puede modificar la planificación.',SCHEDULE_UNCHANGED:'Las fechas son iguales a las registradas. No se hizo ningún cambio.',SCHEDULE_OPERATION_CONFLICT:'Este intento ya pertenece a otra solicitud. Comprobá su recibo antes de continuar.',SESSION_REQUIRED:'Tu sesión venció. Volvé a ingresar.',SCHEDULE_DATES_INVALID:'Revisá el inicio y el fin. El fin no puede ser anterior al inicio.',SCHEDULE_REASON_REQUIRED:'Explicá brevemente el motivo del cambio.'};
const describe=code=>messages[code]||'No se pudo confirmar la operación. No se reemplazaron los datos por ejemplos.';
async function request(query='',options={}){
 const response=await fetch(endpoint+query,{credentials:'same-origin',cache:'no-store',...options});
 const body=await response.json();if(!response.ok){const error=new Error(describe(body.code));error.code=body.code;error.status=response.status;throw error;}return body;
}
const query=values=>'?' + new URLSearchParams(values).toString();
const statusLabel=value=>({BACKLOG:'Por iniciar',IN_PROGRESS:'En curso',DONE:'Finalizada',BLOCKED:'Bloqueada'}[value]||value);
const day=value=>value?Date.parse(value+'T00:00:00Z'):NaN;
function timeline(tasks){
 const valid=tasks.filter(t=>Number.isFinite(day(t.startsOn))&&Number.isFinite(day(t.endsOn))&&day(t.endsOn)>=day(t.startsOn));
 if(!valid.length)return null;const start=Math.min(...valid.map(t=>day(t.startsOn))),end=Math.max(...valid.map(t=>day(t.endsOn)))+86400000;
 return {start,end};
}
export function AccountWorkspace(){
 const [account,setAccount]=useState(null),[view,setView]=useState(null),[loading,setLoading]=useState(true),[notice,setNotice]=useState(''),[draft,setDraft]=useState(null),[attempt,setAttempt]=useState(null),[saving,setSaving]=useState(false),[receipt,setReceipt]=useState(null);
 const generation=useRef(0),controller=useRef(null),mounted=useRef(true);
 const range=useMemo(()=>timeline(view?.tasks||[]),[view]);
 useEffect(()=>{
  mounted.current=true;const abort=new AbortController();controller.current=abort;const current=++generation.current;
  request('',{signal:abort.signal}).then(data=>{if(mounted.current&&current===generation.current)setAccount(data);}).catch(error=>{if(error.name!=='AbortError'&&mounted.current&&current===generation.current)setNotice(error.message);}).finally(()=>{if(mounted.current&&current===generation.current)setLoading(false);});
  return()=>{mounted.current=false;generation.current++;abort.abort();controller.current?.abort();};
 },[]);
 async function refresh(){
  if(saving||attempt)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;
  setAccount(null);setView(null);setDraft(null);setReceipt(null);setNotice('');setLoading(true);
  try{const data=await request('',{signal:abort.signal});if(mounted.current&&current===generation.current)setAccount(data);}catch(error){if(error.name!=='AbortError'&&mounted.current&&current===generation.current)setNotice(error.message);}finally{if(mounted.current&&current===generation.current)setLoading(false);}
 }
 async function open(projectId,append=false){
  if(!account||saving||attempt)return;controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;
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
  if(data.scope!==account?.scope||data.task?.id!==draft?.task.id)throw new Error('No se pudo correlacionar el recibo con esta tarea.');
  setView(previous=>({...previous,tasks:previous.tasks.map(task=>task.id===data.task.id?data.task:task)}));setReceipt(data.receipt);setAttempt(null);setDraft(null);setNotice('Planificación guardada con recibo. El avance ejecutado no fue modificado.');
 }
 async function save(event){
  event.preventDefault();if(saving||attempt||!draft||!view)return;
  const payload={operationId:crypto.randomUUID(),projectId:view.project.id,taskId:draft.task.id,scope:account.scope,expectedRevision:draft.task.revision,startsOn:draft.startsOn,endsOn:draft.endsOn,reason:draft.reason};
  setSaving(true);setNotice('');setAttempt(payload);
  try{const data=await request('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});applySaved(data);}
  catch(error){if(mounted.current){if(error.status&&error.status<500){setAttempt(null);setNotice(error.message);}else setNotice('El servidor no confirmó el guardado. Conservamos este intento: comprobá el recibo antes de modificar o reenviar.');}}
  finally{if(mounted.current)setSaving(false);}
 }
 async function recover(){
  if(saving||!attempt)return;setSaving(true);
  try{const data=await request(query({projectId:attempt.projectId,scope:attempt.scope,operationId:attempt.operationId}),{signal:AbortSignal.timeout(15000)});
   if(data.state==='RECORDED')applySaved(data);else setNotice('Todavía no se observa un recibo de este intento. No se reenvió ni se declaró perdido. Volvé a comprobarlo.');
  }catch(error){if(mounted.current)setNotice(error.message);}finally{if(mounted.current)setSaving(false);}
 }
 return <section className={styles.workspace} aria-labelledby="workspace-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>ESPACIO DE TRABAJO</p><h2 id="workspace-title">Mis obras</h2></div><button type="button" onClick={refresh} disabled={saving||Boolean(attempt)||loading}>Actualizar</button></div>
  <p className={styles.intro}>Obras y tareas del registro de tu organización. Cada consulta vuelve a comprobar tu acceso; esta vista no usa los datos ficticios de la demo.</p>
  <div role="status" aria-live="polite" className={notice?styles.notice:styles.silent}>{notice}</div>
  {loading&&<p className={styles.loading}>Consultando registros autorizados…</p>}
  {account&&<><div className={styles.context}><strong>{account.organizationName}</strong><span>{account.roleLabel}</span></div>
   {!account.projects.length&&!loading&&<p className={styles.empty}>No hay obras activas asignadas a tu cuenta. El responsable debe aprobar la pertenencia; no se creó una obra ni se asignó un rol automáticamente.</p>}
   <div className={styles.projects}>{account.projects.map(project=><button key={project.id} type="button" onClick={()=>open(project.id)} disabled={saving||Boolean(attempt)} aria-pressed={view?.project.id===project.id}><span>{project.name}</span><small>Ver cronograma</small></button>)}</div>
   {account.projectsTruncated&&<p>Se muestran las primeras 100 obras autorizadas.</p>}
  </>}
  {view&&<section aria-labelledby="schedule-title" className={styles.schedule}>
   <div className={styles.heading}><div><p className={styles.eyebrow}>CRONOGRAMA REGISTRADO</p><h3 id="schedule-title">{view.project.name}</h3></div><span>{view.tasks.length} de {view.totalTasks} tareas</span></div>
   {range&&<div className={styles.range}><span>{new Date(range.start).toISOString().slice(0,10)}</span><span>{new Date(range.end-86400000).toISOString().slice(0,10)}</span></div>}
   {!view.tasks.length&&<p className={styles.empty}>Esta obra todavía no tiene tareas registradas. No se generaron barras ni porcentajes de ejemplo.</p>}
   <div className={styles.tasks}>{view.tasks.map(task=>{
    const hasDates=range&&Number.isFinite(day(task.startsOn))&&Number.isFinite(day(task.endsOn))&&day(task.endsOn)>=day(task.startsOn);
    const progress=Number.isInteger(task.progress)&&task.progress>=0&&task.progress<=100?task.progress:null;
    return <article key={task.id} className={styles.task} data-task-id={task.id}>
     <div className={styles.taskHeading}><strong>{task.title}</strong><span>{statusLabel(task.status)}</span></div>
     <div className={styles.track} aria-label={hasDates?`Planificada desde ${task.startsOn} hasta ${task.endsOn}`:'Sin intervalo de planificación válido'}>{hasDates?<span className={styles.bar} style={{left:((day(task.startsOn)-range.start)/(range.end-range.start)*100)+'%',width:((day(task.endsOn)+86400000-day(task.startsOn))/(range.end-range.start)*100)+'%'}}/>:<span className={styles.noDates}>Sin fechas planificadas válidas</span>}</div>
     <div className={styles.taskFooter}><div><span>{task.startsOn||'Sin inicio'} → {task.endsOn||'Sin fin'}</span><small>Avance registrado: {progress===null?'Requiere revisión':`${progress} %`}</small></div>{view.canPlanSchedule&&<button type="button" disabled={saving||Boolean(attempt)} onClick={()=>{setReceipt(null);setNotice('');setDraft({task,startsOn:task.startsOn||'',endsOn:task.endsOn||'',reason:''});}}>Planificar fechas</button>}</div>
    </article>;
   })}</div>
   {view.nextCursor&&<button type="button" disabled={loading||saving||Boolean(attempt)} onClick={()=>open(view.project.id,true)}>Cargar más tareas</button>}
   {!view.canPlanSchedule&&<p className={styles.caption}>Tu rol permite consultar este cronograma, no modificarlo.</p>}
   {draft&&<form onSubmit={save} className={styles.form} aria-labelledby="schedule-edit-title"><h4 id="schedule-edit-title">Planificar: {draft.task.title}</h4><p>Revisá las fechas previstas y explicá el motivo. El cambio no certifica avance ni registra horas trabajadas.</p>
    <div className={styles.dates}><label>Inicio previsto<input type="date" required value={draft.startsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,startsOn:event.target.value})}/></label><label>Fin previsto<input type="date" required min={draft.startsOn||undefined} value={draft.endsOn} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,endsOn:event.target.value})}/></label></div>
    <label>Motivo del cambio<textarea required minLength={8} maxLength={800} rows={3} value={draft.reason} disabled={saving||Boolean(attempt)} onChange={event=>setDraft({...draft,reason:event.target.value})}/></label>
    <div className={styles.actions}>{attempt?<button type="button" disabled={saving} onClick={recover}>{saving?'Comprobando…':'Comprobar guardado'}</button>:<><button className={styles.primary} type="submit" disabled={saving}>Confirmar planificación</button><button type="button" disabled={saving} onClick={()=>setDraft(null)}>Cancelar</button></>}</div>
   </form>}
   {receipt&&<div className={styles.receipt}><strong>Cambio confirmado</strong><span>{receipt.after.startsOn} → {receipt.after.endsOn}</span><small>Recibo: {receipt.id}</small></div>}
  </section>}
 </section>;
}
