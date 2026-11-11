'use client';
import {useLayoutEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {createApprovedProgressRead} from './approved-progress-curve-view.mjs';
import styles from './approved-progress-curve-panel.module.css';

const units={M:'m',M2:'m²',M3:'m³',KG:'kg',T:'t',L:'l',UNIT:'unidades',HOUR:'horas',DAY:'días',LOT:'lotes'};
const amount=value=>value.replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1').replace('.',',');
const timestamp=value=>new Intl.DateTimeFormat('es-AR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
const day=value=>new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short'}).format(new Date(value));
const origin=row=>row.origin==='HUMAN_APPROVAL'?'Aprobación del responsable':'Reporte autorizado';
function ObservedPoints({rows}){
 const first=Date.parse(rows[0].at),last=Date.parse(rows.at(-1).at),x=row=>first===last?310:45+(Date.parse(row.at)-first)/(last-first)*530;
 return <svg className={styles.chart} viewBox="0 0 620 190" role="img" aria-label="Observaciones de avance aprobado por fecha. Sin interpolación entre registros.">
  {[0,25,50,75,100].map(value=><g key={value}><line x1="45" x2="575" y1={155-value*1.25} y2={155-value*1.25}/><text x="5" y={159-value*1.25}>{value}%</text></g>)}
  {rows.map(row=><circle key={row.id} cx={x(row)} cy={155-row.progress*1.25} r="5"><title>{timestamp(row.at)} · {row.progress}% · {origin(row)} · tramo {row.segment+1}</title></circle>)}
  <text x="45" y="183">{day(rows[0].at)}</text><text x="575" y="183" textAnchor="end">{day(rows.at(-1).at)}</text>
 </svg>;
}
export function ApprovedProgressCurvePanel({projectId,scope,generation,tasks,getSessionToken,active=false,canonicalAccess=false,disabled=false,onAccessDenied}){
 const request=useWorkspaceRequest(getSessionToken),[taskId,setTaskId]=useState(''),[state,setState]=useState({value:null,busy:false,notice:''}),reader=useRef(null),current=useRef(null),accessDenied=useRef(onAccessDenied);
 const selected=tasks.find(task=>task.id===taskId),key=[scope,projectId,generation,selected?.revision||''].join('|'),eligible=active&&canonicalAccess&&!disabled&&Boolean(selected);
 useLayoutEffect(()=>{accessDenied.current=onAccessDenied;current.current={key,projectId,scope,taskId,eligible};},[onAccessDenied,key,projectId,scope,taskId,eligible]);
 useLayoutEffect(()=>{const service=createApprovedProgressRead({request,getContext:()=>current.current,onState:setState,onAccessDenied:error=>accessDenied.current?.(error)});reader.current=service;return()=>{if(reader.current===service)reader.current=null;service.dispose();};},[request,key]);
 useLayoutEffect(()=>{reader.current?.invalidate();if(eligible)reader.current?.read();},[request,key,taskId,active,canonicalAccess,disabled,eligible]);
 const value=eligible&&state.value?.scope===scope&&state.value.projectId===projectId&&state.value.taskId===taskId?state.value:null;
 const multipleBases=value?.rows.some(point=>point.segment>0);
 return <section className={styles.panel} aria-labelledby="approved-progress-curve-title">
  <h4 id="approved-progress-curve-title">Avance aprobado de la tarea</h4>
  <p>Elegí una tarea para ver sus aprobaciones y reportes autorizados.</p>
  <div className={styles.controls}><label>Tarea<select value={taskId} disabled={!active||!canonicalAccess||disabled} onChange={event=>setTaskId(event.target.value)}><option value="">Elegí una tarea</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label><button type="button" disabled={!eligible||state.busy} onClick={()=>reader.current?.read()}>Actualizar avance</button></div>
  <p role="status" aria-live="polite">{state.busy?'Consultando registros históricos…':state.notice}</p>
  {value?.state==='INCOMPLETE'&&<p role="alert">No pudimos confirmar el historial completo. Actualizá la consulta; si continúa, consultá al responsable de la obra.</p>}
  {value?.state==='CONFIRMED'&&<>
   <p>{value.complete?`${value.total} registros disponibles.`:`Mostrando ${value.rows.length} de ${value.total} registros.`}</p>
   <details><summary>Cómo leer este avance</summary><p>Cada punto corresponde a una aprobación o un reporte con autorización previa. La fecha del registro no acredita por sí sola el día de trabajo. Las horas se muestran según tu dispositivo.</p><p>Los períodos sin registros no se consideran avance cero. Cada tramo conserva su base y unidad. Este historial no representa inversión ni pagos.</p></details>
   {!value.rows.length?<p>Todavía no hay avances registrados en este historial.</p>:<><ObservedPoints rows={value.rows}/><div className={styles.scroll} role="region" aria-label="Historia de avance por tarea" tabIndex={0}><table><caption>Avances registrados · hora de tu dispositivo</caption><thead><tr><th>Fecha del registro</th><th>Origen</th><th>Avance</th><th>Cantidad registrada</th></tr></thead><tbody>{value.rows.map(row=><tr key={row.id}><td><time dateTime={row.at}>{timestamp(row.at)}</time></td><td>{origin(row)}{multipleBases?` · tramo ${row.segment+1}`:''}</td><td>{row.progress}%</td><td>{row.measurement?`${amount(row.measurement.executed)} / ${amount(row.measurement.baseline)} ${units[row.measurement.unit]}`:'Sólo porcentaje registrado'}</td></tr>)}</tbody></table></div><details><summary>Referencias de los registros</summary><ul>{value.rows.map(row=><li key={row.id}><code>{row.id}</code> · recibo <code>{row.receiptId}</code></li>)}</ul></details></>}
   {value.nextCursor&&<button type="button" disabled={!eligible||state.busy} onClick={()=>reader.current?.read(true)}>Consultar más observaciones</button>}
  </>}
 </section>;
}
