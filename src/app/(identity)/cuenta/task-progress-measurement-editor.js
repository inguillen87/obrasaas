'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {measurementConfigurationCommand,measurementConfigurationResult,measurementErrorMessage,taskMeasurementView,MEASUREMENT_CONFIGURATION_CANCEL_ACTION,configurationFailureRetainsAttempt} from './task-progress-measurement-view.mjs';
import {voiceProgressUnitLabel} from '../../../lib/voice-progress-draft.mjs';
import styles from './task-progress-measurement-editor.module.css';

const endpoint='/api/identity/field-operations';
const initial=task=>({baseline:task.measurement?.baseline||'',unit:task.measurement?.unit||'',sourceReference:task.measurement?.sourceReference||'',reason:'',confirmed:false,reviewedRevision:null});
export function TaskProgressMeasurementEditor({task,projectId,scope,allowed,getSessionToken,onPending,onChanged,onClose}){
 const request=useWorkspaceRequest(getSessionToken),owner=useMemo(()=>({scope,projectId,taskId:task.id,request}),[scope,projectId,task.id,request]);
 const [state,setState]=useState(()=>({owner,fields:initial(task),busy:false,attempt:null,message:'',denied:false,canClosePending:false}));
 const current=state.owner===owner?state:null,active=useRef(owner),mounted=useRef(false),sequence=useRef(0),heading=useRef(null),taskRef=useRef(task);
 active.current=owner;taskRef.current=task;
 useLayoutEffect(()=>{mounted.current=true;const ownedSequence=sequence;ownedSequence.current++;setState({owner,fields:initial(taskRef.current),busy:false,attempt:null,message:'',denied:false,canClosePending:false});heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start',behavior:'instant'});return()=>{mounted.current=false;ownedSequence.current++;};},[owner]);
 useEffect(()=>{setState(previous=>previous.owner===owner?{...previous,fields:{...previous.fields,confirmed:false}}:previous);},[owner,task.revision]);
 useLayoutEffect(()=>{onPending?.(true);return()=>onPending?.(false);},[onPending]);
 const valid=token=>mounted.current&&active.current===owner&&sequence.current===token;
 const edit=(key,value)=>setState(previous=>previous.owner===owner?{...previous,fields:{...previous.fields,[key]:value,confirmed:key==='confirmed'?value:false,reviewedRevision:key==='confirmed'&&value?task.revision:null},message:''}:previous);
 async function send(method,command,reference){
  const query=method==='GET'?'?'+new URLSearchParams({scope,projectId,operationId:reference.operationId}):'';
  const result=await request(endpoint+query,{method,requestTimeoutMs:20000,...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify(command)}:{})},async response=>{
   const data=await response.json();
   if(!response.ok){const error=Object.assign(new Error(measurementErrorMessage(data)),{status:response.status,code:data?.code});error.definitiveConfigurationRejection=method==='POST'&&command?.action!==MEASUREMENT_CONFIGURATION_CANCEL_ACTION&&[400,409,413].includes(response.status)&&data?.code!=='WORKSPACE_CONTEXT_CHANGED'&&data?.saved===false&&Object.keys(data).sort().join('|')==='code|saved';throw error;}
   measurementConfigurationResult(data,reference);return data;
  });
  return measurementConfigurationResult(result,reference);
 }
 async function execute(method,command,reference){
  const token=++sequence.current;setState(previous=>({...previous,busy:true,attempt:reference,canClosePending:false,message:''}));
  try{
   const result=await send(method,command,reference);if(!valid(token))return;
   if(result.state==='RECORDED'){onChanged?.(result.task);setState(previous=>({...previous,busy:false,attempt:null,canClosePending:false,message:'Base de medición guardada con recibo.',fields:{...previous.fields,confirmed:false}}));onClose?.();}
   else if(result.state==='CANCELLED'){setState(previous=>({...previous,busy:false,attempt:null,canClosePending:false}));onClose?.('Intento cerrado con recibo. La tarea y su avance no cambiaron.');}
   else setState(previous=>({...previous,busy:false,canClosePending:method==='GET',message:'Todavía no se observa el recibo. Conservamos este intento; comprobalo nuevamente antes de definir otra base.'}));
  }catch(error){
   if(!valid(token))return;
   const denied=[401,403].includes(error.status)||error.code==='WORKSPACE_CONTEXT_CHANGED';
   const mayRelease=!configurationFailureRetainsAttempt({method,action:command?.action,existingAttempt:Boolean(current?.attempt)},error);
   setState(previous=>({...previous,busy:false,denied,message:denied?'Tu acceso cambió. Conservamos la referencia del intento; consultala cuando recuperes el permiso.':mayRelease?error.message:'No pudimos confirmar el guardado. Conservamos este intento; comprobá su recibo antes de volver a enviar.',attempt:mayRelease?null:reference,fields:denied?{baseline:'',unit:'',sourceReference:'',reason:'',confirmed:false,reviewedRevision:null}:{...previous.fields,confirmed:false}}));
  }
 }
 async function submit(event){
  event.preventDefault();if(!current||current.busy||current.attempt||current.denied)return;
  try{const command=measurementConfigurationCommand(task,current.fields,{scope,projectId,operationId:crypto.randomUUID(),confirmed:current.fields.confirmed&&current.fields.reviewedRevision===task.revision,allowed});await execute('POST',command,{scope,projectId,taskId:task.id,operationId:command.operationId,revision:task.revision});}
  catch(error){if(mounted.current&&active.current===owner)setState(previous=>({...previous,message:error.message}));}
 }
 const blocked=!current||current.busy||Boolean(current.attempt)||current.denied||allowed!==true,measurement=taskMeasurementView(task);
 return <section className={styles.editor} aria-labelledby="measurement-editor-title" data-measurement-editor>
  <h4 id="measurement-editor-title" ref={heading} tabIndex={-1}>{current?.denied?'Base de medición':'Base de medición · '+task.title}</h4>
  <p>Indicá cuánto se debe ejecutar y en qué unidad. El metrado se propone por separado y requiere revisión antes de cambiar el avance.</p>
  {!current?.denied&&measurement.state==='CONFIGURED'&&<p>Base vigente: <strong>{measurement.label}</strong>. Fuente: {measurement.sourceReference}.</p>}
  {current?.message&&<p className={styles.notice} role="status" aria-live="polite">{current.message}</p>}
  {current?.denied?<><p>Tu acceso actual no permite definir esta base. La referencia de un intento sin confirmar se conserva para recuperarla cuando corresponda.</p><div className={styles.actions}><button type="button" disabled={current.busy} onClick={onClose}>Cerrar y conservar la referencia</button></div></>:<form onSubmit={submit}>
   <div className={styles.quantities}><label>Cantidad base<input required inputMode="decimal" maxLength={20} disabled={blocked} value={current?.fields.baseline||''} onChange={event=>edit('baseline',event.target.value)}/></label><label>Unidad<select required disabled={blocked} value={current?.fields.unit||''} onChange={event=>edit('unit',event.target.value)}><option value="">Elegí la unidad</option>{['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT'].map(unit=><option key={unit} value={unit}>{voiceProgressUnitLabel(unit)}</option>)}</select></label></div>
   <label>Fuente de la cantidad base<input required minLength={3} maxLength={240} disabled={blocked} value={current?.fields.sourceReference||''} placeholder="Plano, cómputo o relevamiento revisado" onChange={event=>edit('sourceReference',event.target.value)}/></label>
   <label>Motivo<textarea required minLength={8} maxLength={1000} disabled={blocked} value={current?.fields.reason||''} onChange={event=>edit('reason',event.target.value)}/></label>
   <label className={styles.confirm}><input type="checkbox" disabled={blocked} checked={current?.fields.confirmed===true&&current.fields.reviewedRevision===task.revision} onChange={event=>edit('confirmed',event.target.checked)}/><span>Revisé la cantidad, la unidad y su fuente para esta tarea. Definir la base conserva el avance ya aprobado.</span></label>
   <div className={styles.actions}>{current?.attempt?<><button type="button" disabled={current.busy} onClick={()=>execute('GET',null,current.attempt)}>Comprobar la base guardada</button>{current.canClosePending&&<button type="button" disabled={current.busy} onClick={()=>execute('POST',{scope,projectId,operationId:current.attempt.operationId,action:MEASUREMENT_CONFIGURATION_CANCEL_ACTION,payload:{taskId:current.attempt.taskId}},current.attempt)}>Cerrar intento pendiente</button>}</>:<button type="submit" disabled={blocked||current?.fields.confirmed!==true||current.fields.reviewedRevision!==task.revision}>Guardar base con recibo</button>}<button type="button" disabled={current?.busy} onClick={onClose}>{current?.attempt?'Cerrar y conservar el intento':'Cancelar'}</button></div>
  </form>}
 </section>;
}
