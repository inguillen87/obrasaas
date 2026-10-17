'use client';
import {useId} from 'react';
import styles from './worksite-task-selector.module.css';

// This is a controlled choice over already authorized public task rows. The
// workspace owns reads and their context; paging never edits the current draft.
export function WorksiteTaskSelector({tasks=[],taskPaging,onLoadMoreTasks,value='',onChange,label='Tarea',required=false,emptyLabel='Elegí una tarea',disabled=false,showProgress=false}){
 const id=useId(),descriptionId=id+'-description',errorId=id+'-error';
 const total=Number.isSafeInteger(taskPaging?.totalTasks)&&taskPaging.totalTasks>=tasks.length?taskPaging.totalTasks:null;
 const more=typeof taskPaging?.nextCursor==='string'&&taskPaging.nextCursor.length>0;
 const loading=taskPaging?.loading===true,error=typeof taskPaging?.error==='string'&&taskPaging.error.length>0;
 const missingSelection=Boolean(value)&&!tasks.some(task=>task.id===value);
 return <div className={styles.selector} data-worksite-task-selector aria-busy={loading}>
  <label htmlFor={id}>{label}<select id={id} required={required} disabled={disabled} value={value||''} onChange={event=>onChange(event.target.value)} aria-describedby={[descriptionId,error?errorId:null].filter(Boolean).join(' ')}>
   <option value="">{emptyLabel}</option>
   {missingSelection&&<option value={value} disabled>Tarea seleccionada pendiente de consulta</option>}
   {tasks.map(task=><option key={task.id} value={task.id}>{task.title}{showProgress?` · ${task.progress}% aprobado`:''}</option>)}
  </select></label>
  <p id={descriptionId} className={styles.description} role="status" aria-live="polite" aria-atomic="true">
   {total===null?`${tasks.length} ${tasks.length===1?'tarea cargada':'tareas cargadas'}.`:`${tasks.length} de ${total} tareas cargadas.`}
   {loading?' Consultando más tareas…':more?' Hay más tareas de esta obra por consultar.':total!==null&&total===tasks.length?' Lista completa de esta consulta.':''}
  </p>
  {error&&<p id={errorId} className={styles.error} role="alert">{taskPaging.error}</p>}
  {more&&typeof onLoadMoreTasks==='function'&&<button className={styles.more} type="button" disabled={disabled||loading} onClick={()=>onLoadMoreTasks()} aria-describedby={descriptionId}>{loading?'Consultando tareas…':error?'Reintentar cargar más tareas':'Cargar más tareas'}</button>}
 </div>;
}
