'use client';
import {useId,useLayoutEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {companyUsageView,companyUsageErrorMessage} from './company-usage-view.mjs';
import styles from './company-subscription-panel.module.css';

export function CompanyUsagePanel(props){return <CompanyUsageContent key={`${props.scope}:${props.organizationId}`} {...props}/>;}
function CompanyUsageContent({scope,organizationId,getSessionToken,locked=false}){
 const request=useWorkspaceRequest(getSessionToken),headingId=useId(),alive=useRef(false),epoch=useRef(0),controller=useRef(null),owner=useRef(request);
 const [result,setResult]=useState(null);
 const current=result?.owner===request?result:null,view=current?.view,busy=current?.busy===true;
 useLayoutEffect(()=>{const active=controller,generation=epoch;owner.current=request;alive.current=true;return()=>{alive.current=false;generation.current++;active.current?.abort();active.current=null;};},[request]);
 const valid=(generation,active)=>alive.current&&owner.current===request&&epoch.current===generation&&!active.signal.aborted;
 async function consult(){
  if(busy||locked||controller.current)return;
  const active=new AbortController(),generation=++epoch.current;controller.current=active;
  setResult({owner:request,busy:true,view:null,message:''});
  try{
   const next=await request('/api/identity/company-usage?'+new URLSearchParams({scope}),{signal:active.signal,requestTimeoutMs:15000},async response=>{
    let body;try{body=await response.json();}catch{throw Object.assign(new Error('Usage observation unreadable'),{status:response.status});}
    if(!response.ok)throw Object.assign(new Error('Usage observation unavailable'),{status:response.status,code:body?.code});
    return companyUsageView(body,{scope,organizationId});
   });
   if(valid(generation,active))setResult({owner:request,busy:false,view:next,message:''});
  }catch(error){if(valid(generation,active))setResult({owner:request,busy:false,view:null,message:companyUsageErrorMessage(error)});}
  finally{if(controller.current===active)controller.current=null;}
 }
 function cancel(){const active=controller.current;if(!active)return;epoch.current++;active.abort();controller.current=null;setResult({owner:request,busy:false,view:null,message:'Consulta cancelada. No se procesaron archivos ni se volvió a invocar la IA.'});}
 return <section className={styles.payment} aria-labelledby={headingId} data-company-usage>
  <div className={styles.heading}><div><h4 id={headingId}>Uso registrado</h4><p>Consultá los análisis de cronogramas, documentos y medios de obra que tienen un registro de uso.</p></div><button type="button" className={styles.secondary} disabled={busy||locked} onClick={consult}>{busy?'Consultando…':'Consultar uso'}</button></div>
  <div className={styles.live} role="status" aria-live="polite">{busy&&<p>Comprobando registros guardados…</p>}{current?.message&&<p className={styles.notice}>{current.message}</p>}</div>
  {busy&&<button type="button" className={styles.secondary} onClick={cancel}>Cancelar consulta</button>}
  {!view&&!busy&&!current?.message&&<p className={styles.note}>La consulta no vuelve a analizar archivos ni autoriza pagos.</p>}
  {view&&<>
   <dl className={styles.facts}>
    <div><dt>Cobertura actual</dt><dd>{view.coverage.label}{view.coverage.endsLabel&&<><br/>{view.coverage.startsLabel?`${view.coverage.startsLabel} a ${view.coverage.endsLabel}`:`Hasta ${view.coverage.endsLabel}`}</>}</dd></div>
    <div><dt>Análisis con medición del proveedor</dt><dd>{view.summary.observedLabel}</dd></div>
    <div><dt>Reservas registradas</dt><dd>{view.summary.reservedLabel}</dd></div>
    <div><dt>Resultados por comprobar</dt><dd>{view.summary.pendingLabel}</dd></div>
    <div><dt>Registros sin medición del proveedor</dt><dd>{view.summary.unmeasuredLabel}</dd></div>
    {view.summary.totalTokens!=='0'&&<div><dt>Tokens comprobados</dt><dd>{view.summary.tokensLabel}</dd></div>}
    {view.summary.audioSeconds&&view.summary.audioSeconds!=='0'&&<div><dt>Segundos de audio informados por el proveedor</dt><dd>{view.summary.audioSecondsLabel}</dd></div>}
    <div><dt>Capacidad del abono</dt><dd>{view.capacityLabel}</dd></div>
    <div><dt>Costo interno</dt><dd>{view.costLabel}</dd></div>
   </dl>
   <p className={styles.note}>Estos registros no representan todo el consumo histórico de la empresa. {view.fundingLabel}. No se generan cargos adicionales.</p>
   {view.summary.total===0&&<p className={styles.note}>Todavía no hay análisis con un registro de uso. Esto no confirma que el consumo anterior haya sido cero.</p>}
   {view.recent.length>0&&<details className={styles.review}><summary className={styles.secondary}>Últimos registros de uso</summary>{view.recent.map(record=><div className={styles.payment} key={record.receiptId}>
    <h4>{record.stageLabel} · {record.stateLabel}</h4>
    <p className={styles.note}><time dateTime={record.recordedAt}>{record.recordedLabel}</time>{record.usage?` · ${record.usage.totalLabel} tokens comprobados`:record.audioSecondsLabel?` · ${record.audioSecondsLabel} segundos de audio informados por el proveedor`:''}</p>
    <details><summary className={styles.secondary}>Referencia del registro</summary><p className={styles.note}>{record.receiptId}</p>{record.model&&<p className={styles.note}>Modelo registrado: {record.model}</p>}</details>
   </div>)}{view.truncated&&<p className={styles.note}>Se muestran los 20 registros más recientes.</p>}</details>}
   <p className={styles.observed}>Consulta comprobada: <time dateTime={view.observedAt}>{view.observedLabel}</time> · Hora de Argentina.</p>
  </>}
 </section>;
}
