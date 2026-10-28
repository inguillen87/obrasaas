'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {consumptionEvidenceSnapshot} from './consumption-evidence-view.mjs';
import styles from './consumption-evidence-picker.module.css';

export function ConsumptionEvidencePicker(props){
 return <EvidencePickerInner key={[props.scope,props.projectId,props.workerId,props.taskId||'',props.sectorId].join(':')} {...props}/>;
}
function EvidencePickerInner({projectId,scope,workerId,taskId,sectorId,selectedIds,onChange,onBusyChange,onAccessDenied,request,disabled=false}){
 const [catalog,setCatalog]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[current,setCurrent]=useState(false);
 const lifecycle=useRef({alive:true,epoch:0,busy:false,controller:null}),handlers=useRef({selectedIds,onChange,onBusyChange,onAccessDenied,disabled});
 useLayoutEffect(()=>{handlers.current={selectedIds,onChange,onBusyChange,onAccessDenied,disabled};},[selectedIds,onChange,onBusyChange,onAccessDenied,disabled]);
 useEffect(()=>{const life=lifecycle.current;life.alive=true;return()=>{life.alive=false;life.epoch++;life.controller?.abort();handlers.current.onBusyChange?.(false);};},[]);
 async function load(direction='FIRST'){
  const life=lifecycle.current;if(life.busy||handlers.current.disabled)return;
  const selected=handlers.current.selectedIds.slice(),expected={projectId,scope,workerId,taskId,sectorId,selectedIds:selected,...(direction!=='FIRST'?{page:catalog?.page}:{})},n=++life.epoch,controller=new AbortController();
  life.controller?.abort();life.controller=controller;life.busy=true;setBusy(true);setCurrent(false);setNotice('');handlers.current.onBusyChange?.(true);
  try{
   const params={projectId,scope,workerId,taskId:taskId||'',sectorId,direction,selectedIds:JSON.stringify(selected),...(direction!=='FIRST'?{page:JSON.stringify(catalog.page)}:{})};
   const result=await request('/api/identity/consumption-evidence?'+new URLSearchParams(params),{signal:controller.signal,requestTimeoutMs:15000},async response=>{
    if(!response.ok){let body;try{body=await response.json();}catch{/* Status still controls denial. */}throw Object.assign(new Error(response.status===401?'Tu sesión terminó. Volvé a ingresar.':[401,403].includes(response.status)?'Tu acceso ya no permite consultar estos archivos.':response.status===404?'La lista cambió. Consultá de nuevo los archivos para revisar tu selección.':'No pudimos consultar los archivos. Conservamos tu borrador; podés reintentar.'),{status:response.status,code:body?.code});}
    return consumptionEvidenceSnapshot(await response.json(),expected);
   });
   if(!life.alive||life.epoch!==n)return;
   const available=new Set(result.evidence.map(row=>row.id)),retained=selected.filter(id=>available.has(id)),removed=selected.length-retained.length;
   setCatalog(result);setCurrent(true);
   if(removed){handlers.current.onChange(retained);setNotice(`${removed===1?'Un archivo seleccionado ya no está disponible':'Algunos archivos seleccionados ya no están disponibles'}. Revisá la selección antes de confirmar el consumo.`);}
  }catch(error){
   if(!life.alive||life.epoch!==n)return;
   if([401,403].includes(error.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error.code)){setCatalog(null);handlers.current.onAccessDenied?.(error);}
   setNotice(error.name==='AbortError'?'La consulta no se completó. Conservamos tu selección; podés reintentar.':error.message);
  }finally{if(life.alive&&life.epoch===n){life.busy=false;setBusy(false);handlers.current.onBusyChange?.(false);}}
 }
 const selected=new Set(selectedIds),selectedRows=catalog?.evidence.filter(row=>selected.has(row.id))||[],rows=catalog?.entries.filter(row=>!selected.has(row.id))||[];
 function toggle(row,checked){if(disabled||busy||!current||checked&&selectedIds.length>=10)return;onChange(checked?[...selectedIds,row.id]:selectedIds.filter(id=>id!==row.id));}
 const choice=row=><label className={styles.choice} key={row.id}><input type="checkbox" checked={selected.has(row.id)} disabled={disabled||busy||!current||!selected.has(row.id)&&selectedIds.length>=10} onChange={event=>toggle(row,event.target.checked)}/><span>{row.title||'Archivo guardado'}<small>{row.media.kind==='audio'?'Audio':'Foto'} · {row.status==='APPROVED'?'Revisado':'Por revisar'}</small></span></label>;
 return <fieldset className={styles.picker} aria-busy={busy}>
  <legend>Fotos y audios guardados · opcional</legend>
  <p>Elegí archivos de tu ficha, esta tarea y este sector. Podés recorrer los anteriores sin volver a subirlos.</p>
  <p className={styles.count} aria-live="polite">{selectedIds.length} de 10 archivos seleccionados</p>
  {selectedRows.length>0&&<div className={styles.selected} role="group" aria-label="Archivos seleccionados"><strong>Seleccionados</strong>{selectedRows.map(choice)}</div>}
  {catalog&&<div role="group" aria-label="Archivos de esta página">{rows.map(choice)}{!catalog.entries.length&&<p>No hay fotos ni audios disponibles en este contexto.</p>}{catalog.entries.length>0&&!rows.length&&<p>Todos los archivos de esta página ya están seleccionados.</p>}</div>}
  <div className={styles.actions}>
   {selectedIds.length>0&&<button type="button" disabled={disabled||busy} onClick={()=>{onChange([]);setNotice('Se quitaron los adjuntos del borrador. Los archivos guardados se conservan.');}}>Quitar todos los adjuntos</button>}
   {(!catalog||!current)&&<button type="button" disabled={disabled||busy} onClick={()=>load('FIRST')}>{busy?'Consultando archivos…':!catalog?'Buscar fotos y audios guardados':'Reintentar consulta'}</button>}
   {catalog&&current&&<button type="button" disabled={disabled||busy} onClick={()=>load('REFRESH')}>Actualizar esta página</button>}
   {catalog&&current&&catalog.page.hasPrevious&&<button type="button" disabled={disabled||busy} onClick={()=>load('PREVIOUS')}>Ver más recientes</button>}
   {catalog&&current&&catalog.page.hasNext&&<button type="button" disabled={disabled||busy} onClick={()=>load('NEXT')}>Ver más antiguos</button>}
  </div>
  {catalog&&current&&!catalog.page.hasNext&&catalog.entries.length>0&&<p>Consultaste los archivos más antiguos de este contexto.</p>}
  {notice&&<p role="status">{notice}</p>}
 </fieldset>;
}
