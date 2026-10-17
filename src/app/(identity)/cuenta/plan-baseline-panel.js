'use client';
import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {browserRecoveryJournal,RECOVERY_EVENT,recoveryQuery} from './workspace-recovery-journal.mjs';
import {planBaselineCandidateView,planBaselineListView,planBaselineOutcome,planBaselineCommandDigest} from './plan-baseline-view.mjs';
import {PlanSourceCurve} from './plan-source-curve';
import styles from './plan-baseline.module.css';

const endpoint='/api/identity/plan-baseline';
const query=value=>'?'+new URLSearchParams(value);
const messages={PLAN_BASELINE_PERMISSION_REQUIRED:'La curva de inversión está disponible para administración y dirección de obra.',PLAN_BASELINE_REVISION_CHANGED:'Otra persona cambió la línea base. Consultá la versión vigente y revisá tu selección antes de volver a confirmar.',PLAN_BASELINE_CANDIDATE_UNAVAILABLE:'Esta importación ya no está disponible como línea base. Consultá las fuentes aplicadas.',PLAN_BASELINE_SOURCE_CHANGED:'La fuente o su recibo no coinciden con la revisión elegida. Volvé a consultar antes de seleccionar.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o tu permiso. Volvé a cargar las obras.',SESSION_REQUIRED:'Tu sesión terminó. Volvé a ingresar.'};
const explain=code=>messages[code]||'No se pudo confirmar el resultado. Comprobá el recibo antes de intentar otra selección.';
const date=value=>new Date(value).toLocaleString('es-AR');
const profile=value=>value==='CYP_INVESTMENT_CURVES_V1'?'Inversión mensual y semanal':value==='DOCUMENT_MONTHLY_CURVE_V1'?'Documento financiero mensual':value==='CYP_PARTIDAS_CURVE'?'Plan por partidas':'Plan por rubros';

export function PlanBaselinePanel({scope,projectId,getSessionToken,onPending,canonicalAccess=false,locked=false}){
 const transport=useWorkspaceRequest(getSessionToken),owner=useMemo(()=>({scope,projectId,transport,canonicalAccess}),[scope,projectId,transport,canonicalAccess]),active=useRef(null),working=useRef(null);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[data,setData]=useState(null),[choice,setChoice]=useState(null),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState(''),[attempt,setAttempt]=useState(null),[referencesReady,setReferencesReady]=useState(false),[lastReceipt,setLastReceipt]=useState(null);
 const [stateOwner,setStateOwner]=useState(owner);
 if(stateOwner!==owner){setStateOwner(owner);setData(null);setChoice(null);setReason('');setConfirmed(false);setNotice('');setLastReceipt(null);setBusy(false);setAttempt(null);setReferencesReady(false);}
 useLayoutEffect(()=>{active.current=owner;working.current=null;return()=>{if(active.current===owner)active.current=null;};},[owner]);
 useEffect(()=>{onPending?.(busy||Boolean(attempt)||Boolean(choice));return()=>onPending?.(false);},[busy,attempt,choice,onPending]);
 const current=()=>active.current===owner&&canonicalAccess===true;
 const clearPrivate=()=>{setData(null);setChoice(null);setReason('');setConfirmed(false);setLastReceipt(null);};
 const syncReferences=useCallback(async()=>{
  const values=await browserRecoveryJournal.list(scope);
  if(active.current!==owner)return;
  const pending=values.filter(value=>value.resource==='plan-baseline'&&value.projectId===projectId);
  if(pending.length>1)throw new Error('Hay varias referencias pendientes. Comprobá sus recibos desde Operaciones por comprobar.');
  setAttempt(pending[0]||null);setReferencesReady(true);
  if(pending.length)setOpen(true);
 },[scope,projectId,owner]);
 useEffect(()=>{
  let alive=true;
  const sync=()=>{void syncReferences().catch(error=>{if(alive&&active.current===owner){setReferencesReady(false);setNotice(error.message);}});};
  const visible=()=>{if(document.visibilityState==='visible')sync();};
  let channel;
  if(typeof BroadcastChannel==='function')try{channel=new BroadcastChannel(RECOVERY_EVENT);channel.onmessage=event=>{if(event.data?.version===1&&event.data?.type==='invalidate')sync();};}catch{/* Focus still consults the durable references. */}
  sync();window.addEventListener(RECOVERY_EVENT,sync);window.addEventListener('storage',sync);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',visible);
  return()=>{alive=false;channel?.close();window.removeEventListener(RECOVERY_EVENT,sync);window.removeEventListener('storage',sync);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',visible);};
 },[syncReferences,owner]);
 async function request(url,options={},reference){
  try{return await transport(url,options,async response=>{
   let result;try{result=await response.json();}catch(error){if([401,403].includes(response.status))throw Object.assign(new Error(explain(response.status===401?'SESSION_REQUIRED':'PLAN_BASELINE_PERMISSION_REQUIRED')),{status:response.status});throw error;}
   if(!response.ok)throw Object.assign(new Error(explain(result.code)),{status:response.status,code:result.code,result});
   if(reference)planBaselineOutcome(result,reference);else planBaselineListView(result,{scope,projectId});
   return result;
  });}catch(error){if(current()&&([401,403].includes(error.status)||error.code==='WORKSPACE_CONTEXT_CHANGED'))clearPrivate();throw error;}
 }
 async function consult(more=false){
  if(!current()||working.current)return;
  working.current=owner;setBusy(true);setNotice('');
  try{
   const cursor=more?data?.nextCursor:null;if(more&&!cursor)return;
   const result=await request(endpoint+query({scope,projectId,...(cursor?{cursor}:{})}));if(!current())return;
   if(more){const candidates=[...(data?.candidates||[]),...result.candidates];if(new Set(candidates.map(row=>row.draftId)).size!==candidates.length)throw new Error('Cambió la lista de fuentes mientras la consultabas. Volvé a consultar desde el principio.');setData({...result,candidates});}
   else setData(result);
   setOpen(true);
  }catch(error){if(current())setNotice(error.message);}
  finally{if(working.current===owner)working.current=null;if(active.current===owner)setBusy(false);}
 }
 function choose(candidate){
  if(!current()||locked||working.current||attempt||!referencesReady||!data)return;
  planBaselineCandidateView(candidate);
  setChoice({candidate,expectedBaselineId:data.active?.id??null,expectedBaselineRevision:data.active?.revision??0});setConfirmed(false);setReason('');setLastReceipt(null);setNotice('');
 }
 async function select(event){
  event.preventDefault();if(!current()||locked||working.current||!choice||choice.needsReview||!confirmed||attempt||!referencesReady)return;
  working.current=owner;setBusy(true);setNotice('');
  try{
   const body={action:'SELECT',scope,projectId,operationId:crypto.randomUUID(),draftId:choice.candidate.draftId,draftRevision:choice.candidate.draftRevision,decisionReceiptId:choice.candidate.decisionReceiptId,sourceSha256:choice.candidate.sourceSha256,expectedBaselineId:choice.expectedBaselineId,expectedBaselineRevision:choice.expectedBaselineRevision,reason:reason.trim(),confirmed:true};
   const reference={scope,projectId,operationId:body.operationId,inputDigest:await planBaselineCommandDigest(body)};
   const result=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},reference);if(!current())return;
   const outcome=planBaselineOutcome(result,reference);
   setLastReceipt(outcome.receiptId||null);setConfirmed(false);
   if(outcome.state==='RECORDED'){setData(old=>old?{...old,active:result.active}:null);setChoice(null);setReason('');setNotice('Línea base guardada. La curva conserva los valores completos del archivo aplicado.');}
   else if(outcome.state==='REJECTED'){setNotice(explain(result.code));setData(null);setChoice(old=>old?{...old,needsReview:true}:null);}
   else setNotice('El guardado sigue sin confirmación. Conservamos su referencia; comprobá el recibo.');
  }catch(error){if(current())setNotice(error.message);}
  finally{if(working.current===owner)working.current=null;if(active.current===owner){setBusy(false);await syncReferences().catch(error=>{if(active.current===owner){setReferencesReady(false);setNotice(error.message);}});}}
 }
 async function recover(){
  if(!current()||working.current||!attempt)return;
  working.current=owner;setBusy(true);setNotice('');
  try{
   const result=await request(recoveryQuery(attempt),{},attempt);if(!current())return;
   const outcome=planBaselineOutcome(result,attempt);setLastReceipt(outcome.receiptId||null);
   if(outcome.state==='NOT_OBSERVED')setNotice('Todavía no se observa el recibo. Esto no confirma que la solicitud se haya perdido. Conservamos la referencia y no repetimos la selección.');
   else{setChoice(null);setReason('');setConfirmed(false);setData(null);setNotice(outcome.state==='RECORDED'?'Guardado confirmado. Consultá la curva vigente; esta comprobación no volvió a seleccionar la fuente.':explain(result.code));}
  }catch(error){if(current())setNotice(error.message);}
  finally{if(working.current===owner)working.current=null;if(active.current===owner){setBusy(false);await syncReferences().catch(error=>{if(active.current===owner){setReferencesReady(false);setNotice(error.message);}});}}
 }
 if(!canonicalAccess)return null;
 const unavailable=busy||locked||Boolean(attempt)||!referencesReady;
 const preview=choice?.candidate;
 return <section className={styles.panel} aria-labelledby="plan-baseline-title">
  <div className={styles.heading}><div><h4 id="plan-baseline-title">Curva de inversión prevista</h4><p>Consultá la línea base elegida para esta obra y las fuentes aplicadas.</p></div><button type="button" disabled={busy} onClick={()=>consult()}>{busy?'Consultando…':data?'Actualizar curva':'Consultar curva'}</button></div>
  {notice&&<p className={styles.notice} role="status" aria-live="polite">{notice}</p>}
  {attempt&&<div className={styles.notice}><p>Hay una selección pendiente de confirmación. Comprobar consulta el mismo recibo.</p><button type="button" disabled={busy} onClick={recover}>Comprobar guardado</button></div>}
  {open&&data&&!choice&&<>
   {data.active?<><div className={styles.receipt}><strong>Línea base · versión {data.active.revision}</strong><span>Elegida el {date(data.active.selectedAt)}</span><p>{data.active.reason}</p></div><PlanSourceCurve presentation="baseline" key={data.active.selectionReceiptId} curve={data.active.curve} status="APPLIED" sourceRowCount={data.active.sourceRowCount} selectedRowCount={data.active.selectedRowCount} profile={data.active.profile}/></>:<p className={styles.notice}>Todavía no hay una línea base elegida. Primero aprobá una fuente revisada con curva de inversión.</p>}
   {!choice&&<details className={styles.sources}><summary>{data.active?'Cambiar la fuente prevista':'Elegir una fuente aplicada'}</summary>{!data.candidates.length?<p>No se encontraron fuentes aprobadas con curva de inversión. Importá un Excel financiero compatible o un PDF o imagen financiera, revisá su alcance y aprobalo antes de elegir su curva.</p>:<ul>{data.candidates.map(candidate=><li key={candidate.draftId}><div><strong>{profile(candidate.profile)}</strong><span>Aplicado el {date(candidate.appliedAt)} · {['DOCUMENT_MONTHLY_CURVE_V1','CYP_INVESTMENT_CURVES_V1'].includes(candidate.profile)?'Fuente financiera sin tareas nuevas':candidate.selectedRowCount+' tareas elegidas de '+candidate.sourceRowCount}</span></div><button type="button" disabled={unavailable} onClick={()=>choose(candidate)}>Revisar esta curva</button></li>)}</ul>}{data.nextCursor&&<button type="button" disabled={busy} onClick={()=>consult(true)}>Consultar más fuentes</button>}</details>}
  </>}
  {choice&&<form onSubmit={select} className={styles.review} aria-labelledby="plan-baseline-review-title"><h5 id="plan-baseline-review-title">Revisá la curva que vas a conservar</h5><p>La selección guarda la previsión completa de esta fuente. Los importes ejecutados, el avance físico y las fechas de las tareas se registran por separado.</p>{choice.needsReview&&<div className={styles.notice}><p>Conservamos tu motivo. Consultá la versión vigente y revisá de nuevo esta fuente antes de confirmar.</p><button type="button" disabled={unavailable||!data?.candidates.some(value=>value.draftId===preview.draftId&&value.draftRevision===preview.draftRevision&&value.sourceSha256===preview.sourceSha256&&value.decisionReceiptId===preview.decisionReceiptId)} onClick={()=>{setChoice({...choice,expectedBaselineId:data.active?.id??null,expectedBaselineRevision:data.active?.revision??0,needsReview:false});setConfirmed(false);}}>Usar la versión consultada para revisar</button></div>}<PlanSourceCurve presentation="baseline" curve={preview.curve} status="APPLIED" sourceRowCount={preview.sourceRowCount} selectedRowCount={preview.selectedRowCount} profile={preview.profile}/><label>Motivo de la selección<textarea required minLength={8} maxLength={800} rows={3} value={reason} disabled={unavailable} onChange={event=>{setReason(event.target.value);setConfirmed(false);}}/></label><label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={unavailable||choice.needsReview===true} onChange={event=>setConfirmed(event.target.checked)}/><span>Revisé la previsión y quiero conservarla como línea base de esta obra. La moneda y el calendario de los meses siguen por confirmar.</span></label><div className={styles.actions}><button type="submit" disabled={unavailable||choice.needsReview===true||!confirmed||reason.trim().length<8}>Confirmar línea base</button><button type="button" disabled={busy||Boolean(attempt)} onClick={()=>{setChoice(null);setReason('');setConfirmed(false);}}>Cancelar selección</button></div></form>}
  {!choice&&(lastReceipt||data?.active)&&<details className={styles.provenance}><summary>Referencia y procedencia</summary>{lastReceipt&&<p>Recibo consultado: <code>{lastReceipt}</code></p>}{data?.active&&<><p>Importación: <code>{data.active.draftId}</code> · revisión {data.active.draftRevision}</p><p>Recibo de aplicación: <code>{data.active.decisionReceiptId}</code></p><p>SHA-256 del archivo: <code>{data.active.sourceSha256}</code></p><p>Recibo de selección vigente: <code>{data.active.selectionReceiptId}</code></p></>}</details>}
 </section>;
}
