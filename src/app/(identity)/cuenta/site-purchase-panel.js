'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import {purchaseAccessDenied,purchaseSnapshot,purchaseOutcome,purchaseRecordedOutcome,purchaseCanContinue} from './site-purchase-view.mjs';
import styles from './site-purchase-panel.module.css';
const endpoint='/api/identity/site-purchases';
const label={DRAFT:'Por autorizar',APPROVED:'Compra autorizada',REJECTED:'Rechazada',PARTIAL:'Recepción parcial',RECEIVED:'Recibida completa',CANCELLED:'Cancelada'};
const messages={INVENTORY_RECEIPT_MATERIAL_REQUIRED:'Elegí el material exacto del catálogo antes de registrar esta entrega. Consultá el pedido vigente para cargar la selección.',INVENTORY_CATALOG_CHANGED:'El catálogo cambió. Conservamos tus campos; consultá el pedido vigente y revisá el material antes de confirmar.',INVENTORY_UNIT_MISMATCH:'El material del catálogo debe tener la misma unidad del pedido. No se convierten unidades.',INVENTORY_BALANCE_OVERFLOW:'El saldo del material supera la cantidad máxima admitida. Revisá la entrega.',PURCHASE_REVISION_CHANGED:'Otra persona cambió este pedido. Conservamos tus campos y el motivo; consultá el pedido vigente antes de decidir.',PURCHASE_RECEIPT_EXCEEDS_ORDER:'La recepción supera el saldo de la compra. Revisá la cantidad.',PURCHASE_REQUEST_QUANTITY_EXCEEDED:'La compra supera la cantidad solicitada. Revisá el pedido.',PURCHASE_DELIVERY_ALREADY_RECORDED:'Ese remito ya está registrado en esta compra.',PURCHASE_APPROVAL_REQUIRED:'Primero debe autorizarse la compra.',PURCHASE_STATE_CHANGED:'La compra cambió de estado. Consultá el pedido vigente antes de decidir.',PURCHASE_PRICE_INVALID:'Ingresá un precio positivo con hasta dos decimales.',PURCHASE_QUANTITY_INVALID:'Ingresá una cantidad positiva con hasta tres decimales.',PURCHASE_REQUEST_CLOSED:'Este pedido está cerrado. Hace falta registrar un nuevo pedido.',PURCHASE_REQUEST_UNAVAILABLE:'El pedido no está disponible con tu acceso actual. Conservamos tu borrador; volvé a consultar la obra.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o permiso. Volvé a abrir la obra.',WORKSPACE_PROJECT_UNAVAILABLE:'La obra ya no está disponible con tu acceso actual. Volvé a consultarla cuando se restablezca.',WORKSPACE_MEMBERSHIP_REQUIRED:'La pertenencia a esta empresa no está vigente.'};
async function api(sessionRequest,params,options={},validate=value=>value){
 let retainedError;
 const result=await sessionRequest(endpoint+(params?'?'+new URLSearchParams(params):''),options,async response=>{
  if(!response.ok){let body;try{body=await response.json();}catch{/* A denied HTTP status still applies to an HTML body. */}
   const code=body?.code||(response.status===401?'SESSION_REQUIRED':undefined),message=response.status===401?'Tu sesión terminó. Volvé a ingresar.':messages[code]||(response.status===403?'Tu acceso no permite consultar las compras de esta obra. Volvé a consultarla cuando se restablezca.':'No se pudo confirmar la operación. Conservamos tus datos.'),error=Object.assign(new Error(message),{status:response.status,code});
   if(options.method==='POST'&&(purchaseAccessDenied(error)||code==='PURCHASE_RECEIPT_INTEGRITY')){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}throw error;
  }
  try{return validate(await response.json());}catch(error){if(options.method==='POST'){retainedError=Object.assign(error,{retainAttempt:true});return undefined;}throw error;}
 });
 if(retainedError)throw retainedError;return result;
}
export function SitePurchasePanel(props){return <SitePurchasePanelInner key={props.scope+':'+props.projectId} {...props}/>;}
function SitePurchasePanelInner({projectId,scope,onPending,getSessionToken}){
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[notice,setNotice]=useState(''),[receipt,setReceipt]=useState(''),[accessBlocked,setAccessBlocked]=useState(false),[revisionReview,setRevisionReview]=useState(null);
 const alive=useRef(true),sequence=useRef(0),abort=useRef(null),editorTitle=useRef(null),editingRequestId=draft?.payload.requestId;
 useEffect(()=>{alive.current=true;const epoch=sequence;return()=>{alive.current=false;epoch.current++;abort.current?.abort();};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(attempt)||Boolean(draft));return()=>onPending?.(false);},[busy,attempt,draft,onPending]);
 useEffect(()=>{if(editingRequestId){editorTitle.current?.focus({preventScroll:true});editorTitle.current?.scrollIntoView({block:'start',behavior:'auto'});}},[editingRequestId]);
 function hideDenied(error){
  if(!purchaseAccessDenied(error)||error.requestDispatched===false)return false;
  sequence.current++;abort.current?.abort();setBusy(false);setData(null);setDraft(null);setReceipt('');setRetryAllowed(false);setRevisionReview(null);setAccessBlocked(true);
  setAttempt(previous=>previous?{scope:previous.scope,projectId:previous.projectId,operationId:previous.operationId,action:previous.action,requestId:previous.requestId||previous.payload?.requestId}:null);return true;
 }
 async function load(append=false){
  if(busy||attempt||append&&draft)return;const n=++sequence.current;abort.current?.abort();const c=new AbortController();abort.current=c;const target=draft?.payload.requestId;
  setOpened(true);setBusy(true);setNotice('');
  try{const result=await api(sessionRequest,{projectId,scope,...(target?{requestId:target}:append&&data?.nextCursor?{after:data.nextCursor}:{})},{signal:c.signal},value=>purchaseSnapshot(value,{projectId,scope,...(target?{requestId:target}:{})}));
   if(!alive.current||n!==sequence.current)return;setAccessBlocked(false);
   if(target){const row=result.records[0];setData(previous=>previous?{...previous,inventory:result.inventory,records:previous.records.map(record=>record.id===target?row:record)}:result);if(revisionReview||row.revision!==draft.payload.revision){setRevisionReview({state:'LOADED',row,allowed:purchaseCanContinue(row,draft),reviewed:false});setNotice('Pedido vigente consultado. Revisalo antes de confirmar; conservamos tus campos y el motivo.');}}
   else setData(previous=>append?{...result,records:[...(previous?.records||[]),...result.records]}:result);
  }catch(error){if(alive.current&&n===sequence.current&&error.name!=='AbortError'){hideDenied(error);if(target&&!purchaseAccessDenied(error))setRevisionReview({state:'STALE',allowed:false,reviewed:false,row:null});setNotice(error.message);}}finally{if(alive.current&&n===sequence.current)setBusy(false);}
 }
 function edit(key,value){setDraft(previous=>({...previous,payload:{...previous.payload,[key]:value}}));setRevisionReview(previous=>previous?{...previous,reviewed:false}:previous);}
 function begin(row,action,decision){
  if(busy||attempt||accessBlocked||draft)return;setReceipt('');setNotice('');setRevisionReview(null);const base={requestId:row.id,revision:row.revision};
  setDraft({action,material:row.material,unit:row.unit,baseline:row.order,payload:action==='DRAFT_ORDER'?{...base,supplier:row.order?.supplier||'',quantity:row.order?.quantity||row.requestedQuantity,unitPrice:row.order?.unitPrice||'',currency:row.order?.currency||'ARS',reference:row.order?.reference||'',reason:''}:action==='REVIEW_ORDER'?{...base,decision,reason:''}:action==='RECEIVE_MATERIAL'?{...base,quantity:'',deliveryReference:'',reason:'',...(data.inventory?.configured?{materialId:'',inventoryCatalogHash:data.inventory.catalogHash}:{})}:{...base,reason:''}});
 }
 function confirmed(result){
  setData(previous=>previous?{...previous,records:previous.records.map(record=>record.id===result.record.id?result.record:record)}:{scope,projectId,records:[result.record],total:1,nextCursor:null});
  setAttempt(null);setRetryAllowed(false);setDraft(null);setRevisionReview(null);setAccessBlocked(false);setReceipt(result.receiptId);setNotice('Operación confirmada.');
 }
 async function sendAttempt(input,retrying=false){
  if(accessBlocked||!input.payload)return;const n=++sequence.current;setBusy(true);setAttempt(input);setRetryAllowed(false);setNotice('');setReceipt('');
  try{const result=await api(sessionRequest,null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),requestTimeoutMs:15000},value=>purchaseRecordedOutcome(value,input));if(alive.current&&n===sequence.current)confirmed(result);}
  catch(error){if(alive.current&&n===sequence.current){const denied=hideDenied(error);if(!denied&&!error.retainAttempt&&!retrying&&(error.requestDispatched===false||error.status&&error.status<500))setAttempt(null);
   if(!denied&&['PURCHASE_REVISION_CHANGED','PURCHASE_STATE_CHANGED','PURCHASE_REQUEST_CLOSED','INVENTORY_CATALOG_CHANGED','INVENTORY_RECEIPT_MATERIAL_REQUIRED'].includes(error.code))setRevisionReview({state:'STALE',allowed:false,reviewed:false,row:null});
   setNotice(denied?'El resultado sigue sin confirmar. Comprobá este mismo intento cuando se restablezca tu acceso.':error.requestDispatched===false||!error.retainAttempt&&error.status&&error.status<500?error.message:'El resultado quedó sin confirmar. Comprobá el guardado antes de otro intento.');
  }}finally{if(alive.current&&n===sequence.current)setBusy(false);}
 }
 async function save(event){
  event.preventDefault();if(busy||attempt||accessBlocked||!draft||revisionReview&&(!revisionReview.allowed||!revisionReview.reviewed||!revisionReview.row))return;
  const payload={...draft.payload,...(revisionReview?{revision:revisionReview.row.revision}:{}),...(draft.action==='RECEIVE_MATERIAL'&&data.inventory?.configured?{materialId:draft.payload.materialId||'',inventoryCatalogHash:revisionReview?data.inventory.catalogHash:draft.payload.inventoryCatalogHash}:{})};await sendAttempt({operationId:crypto.randomUUID(),projectId,scope,action:draft.action,payload});
 }
 async function retry(){if(busy||!attempt?.payload||!retryAllowed||accessBlocked)return;await sendAttempt(attempt,true);}
 async function recover(){
  if(busy||!attempt)return;const n=++sequence.current,command=attempt;setBusy(true);setRetryAllowed(false);setNotice('');
  try{const result=await api(sessionRequest,{projectId,scope,operationId:command.operationId},{requestTimeoutMs:15000},value=>purchaseOutcome(value,command));if(!alive.current||n!==sequence.current)return;
   if(result.state==='RECORDED')confirmed(result);else{setRetryAllowed(Boolean(command.payload)&&!accessBlocked);setNotice(command.payload&&!accessBlocked?'No se observa un recibo todavía. Podés comprobar otra vez o reintentar exactamente la misma operación; conservamos sus datos para evitar duplicados.':'No se observa un recibo todavía. Conservamos su referencia; el borrador ocultado no se vuelve a enviar.');}
  }catch(error){if(alive.current&&n===sequence.current){const denied=hideDenied(error);setNotice(denied?'El resultado sigue sin confirmar. Comprobá este mismo intento cuando se restablezca tu acceso.':error.message);}}finally{if(alive.current&&n===sequence.current)setBusy(false);}
 }
 const disabled=busy||Boolean(attempt)||accessBlocked;
return <section className={styles.panel} aria-labelledby="purchase-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>MATERIALES</p><h3 id="purchase-title">Compras y recepciones</h3></div><button disabled={busy||Boolean(attempt)} onClick={()=>load()} type="button">{revisionReview?'Consultar pedido vigente':opened?'Actualizar compras':'Abrir compras'}</button></div>
  <p className={styles.caption}>Prepará una compra desde un pedido, autorizá su importe y registrá cada entrega. Las entregas asignadas a un material del catálogo aumentan su stock. Los pagos requieren su registro propio.</p>
  <p role="status" aria-live="polite">{busy?'Consultando o guardando…':notice}</p>
  {attempt&&<div className={styles.actions}><button type="button" onClick={recover} disabled={busy}>Comprobar compra guardada</button>{retryAllowed&&!accessBlocked&&attempt.payload&&<button type="button" onClick={retry} disabled={busy}>Reintentar la misma operación</button>}{accessBlocked&&<button type="button" disabled={busy} onClick={()=>{setAttempt(null);setNotice('Conservamos la referencia pendiente. Volvé a abrir la obra con tu acceso vigente para consultarla sin repetir el envío.');}}>Cerrar consulta y conservar referencia</button>}</div>}
  {receipt&&<p className={styles.receipt}>Recibo confirmado: <small>{receipt}</small></p>}
  {data&&!data.records.length&&<p className={styles.empty}>No hay pedidos de materiales en esta obra. Registrá primero un pedido en el registro de obra.</p>}
  {data&&<div className={styles.records}>{data.records.map(row=><article key={row.id}>
   <div className={styles.heading}><strong>{row.material}</strong><span className={styles.state}>{row.order?label[row.order.state]:'Sin compra preparada'}</span></div>
   <p>Pedido: {row.requestedQuantity} {row.unit} · {row.sector}</p>
   {row.order&&<><p>{row.order.supplier} · {row.order.quantity} {row.unit} × {row.order.unitPrice} {row.order.currency}</p><p><strong>Total: {row.order.total} {row.order.currency}</strong> · Recibido: {row.order.received} {row.unit}</p><small>Referencia: {row.order.reference}</small>
    {row.order.decision&&<p>Decisión: {row.order.decision.reason}</p>}
    {row.order.receipts.length>0&&<details><summary>Ver entregas ({row.order.receipts.length})</summary><ul>{row.order.receipts.map((r,i)=><li key={i}>{r.quantity} {row.unit} · {r.deliveryReference} · {r.reason}</li>)}</ul></details>}
   </>}
   <div className={styles.actions}>
    {(!row.order||['DRAFT','REJECTED'].includes(row.order.state))&&['OPEN','ACKNOWLEDGED'].includes(row.requestState)&&<button type="button" disabled={disabled||Boolean(draft)} onClick={()=>begin(row,'DRAFT_ORDER')}>{row.order?'Editar cotización':'Preparar compra'}</button>}
    {row.order?.state==='DRAFT'&&<><button type="button" disabled={disabled||Boolean(draft)} onClick={()=>begin(row,'REVIEW_ORDER','APPROVED')}>Autorizar compra</button><button type="button" disabled={disabled||Boolean(draft)} onClick={()=>begin(row,'REVIEW_ORDER','REJECTED')}>Rechazar compra</button></>}
    {['APPROVED','PARTIAL'].includes(row.order?.state)&&<button type="button" disabled={disabled||Boolean(draft)} onClick={()=>begin(row,'RECEIVE_MATERIAL')}>Registrar entrega</button>}
    {['DRAFT','APPROVED','PARTIAL'].includes(row.order?.state)&&<button type="button" disabled={disabled||Boolean(draft)} onClick={()=>begin(row,'CANCEL_ORDER')}>Cancelar saldo de compra</button>}
   </div>
  </article>)}</div>}
  {data?.nextCursor&&<button type="button" disabled={disabled||Boolean(draft)} onClick={()=>load(true)}>Ver más pedidos</button>}
  {draft&&<form onSubmit={save} className={styles.form}>
   <h4 tabIndex={-1} ref={editorTitle}>{{DRAFT_ORDER:'Preparar cotización',REVIEW_ORDER:draft.payload.decision==='APPROVED'?'Autorizar importe':'Rechazar cotización',RECEIVE_MATERIAL:'Registrar entrega',CANCEL_ORDER:'Cancelar saldo pendiente'}[draft.action]} · {draft.material}</h4>
   {revisionReview&&<div className={styles.reviewNotice} role="status"><p>{revisionReview.state==='STALE'?'Otra persona cambió este pedido. Consultá el pedido vigente antes de guardar. Conservamos tus campos y el motivo.':revisionReview.allowed?'Pedido vigente consultado. Compará el importe y el estado antes de confirmar tu borrador.':'El estado vigente no permite repetir esta operación. Conservamos tus campos y el motivo; cancelá el borrador para elegir una acción disponible.'}</p>{revisionReview.row&&<><p>Estado vigente: {revisionReview.row.order?label[revisionReview.row.order.state]:'Sin compra preparada'} · Pedido {revisionReview.row.requestedQuantity} {revisionReview.row.unit}.</p><details><summary>Referencia de revisión</summary><small>{revisionReview.row.revision}</small></details>{draft.baseline&&<p>Cotización al abrir el borrador: {draft.baseline.supplier} · {draft.baseline.quantity} {draft.unit} × {draft.baseline.unitPrice} {draft.baseline.currency} · Total {draft.baseline.total} {draft.baseline.currency}.</p>}{revisionReview.row.order&&<p>Cotización vigente: {revisionReview.row.order.supplier} · {revisionReview.row.order.quantity} {revisionReview.row.unit} × {revisionReview.row.order.unitPrice} {revisionReview.row.order.currency} · Total {revisionReview.row.order.total} {revisionReview.row.order.currency} · Recibido {revisionReview.row.order.received} {revisionReview.row.unit}.</p>}</>}{revisionReview.state==='LOADED'&&revisionReview.allowed&&<label className={styles.reviewCheck}><input type="checkbox" disabled={disabled} checked={revisionReview.reviewed} onChange={event=>setRevisionReview(previous=>({...previous,reviewed:event.target.checked}))}/>Revisé el pedido vigente y quiero continuar</label>}</div>}
   {draft.action==='DRAFT_ORDER'&&<div className={styles.grid}>
    <label>Proveedor<input required minLength={2} maxLength={160} value={draft.payload.supplier} onChange={e=>edit('supplier',e.target.value)} disabled={disabled}/></label>
    <label>Cantidad ({draft.unit})<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,3})?" value={draft.payload.quantity} onChange={e=>edit('quantity',e.target.value)} disabled={disabled}/></label>
    <label>Precio unitario<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={draft.payload.unitPrice} onChange={e=>edit('unitPrice',e.target.value)} disabled={disabled}/></label>
    <label>Moneda<select value={draft.payload.currency} onChange={e=>edit('currency',e.target.value)} disabled={disabled}><option>ARS</option><option>USD</option></select></label>
    <label>Referencia de cotización<input required minLength={2} maxLength={100} value={draft.payload.reference} onChange={e=>edit('reference',e.target.value)} disabled={disabled}/></label>
   </div>}
   {draft.action==='RECEIVE_MATERIAL'&&<>{data.inventory?.configured?<label>Material del catálogo ({draft.unit})<select required disabled={disabled} value={draft.payload.materialId||''} onChange={e=>edit('materialId',e.target.value)}><option value="">Elegí el material exacto</option>{data.inventory.materials.filter(m=>m.unit===draft.unit).map(m=><option key={m.id} value={m.id}>{m.name} · {m.unit}</option>)}</select>{!data.inventory.materials.some(m=>m.unit===draft.unit)&&<span>Agregá primero un material con esta unidad en <a href="#inventory-title">Inventario y consumo</a>.</span>}</label>:<p>Esta obra aún no tiene catálogo. La entrega documentará lo recibido; agregá el material en <a href="#inventory-title">Inventario y consumo</a> para registrar existencias.</p>}<div className={styles.grid}><label>Cantidad recibida ({draft.unit})<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,3})?" value={draft.payload.quantity} onChange={e=>edit('quantity',e.target.value)} disabled={disabled}/></label><label>Remito o referencia de entrega<input required minLength={2} maxLength={100} value={draft.payload.deliveryReference} onChange={e=>edit('deliveryReference',e.target.value)} disabled={disabled}/></label></div></>}
   <label>Motivo o detalle<textarea required minLength={8} maxLength={1000} value={draft.payload.reason} onChange={e=>edit('reason',e.target.value)} disabled={disabled}/></label>
   <div className={styles.actions}><button className={styles.primary} type="submit" disabled={disabled||Boolean(revisionReview&&(!revisionReview.allowed||!revisionReview.reviewed))}>Confirmar operación</button><button type="button" disabled={disabled} onClick={()=>{setDraft(null);setRevisionReview(null);}}>Volver</button></div>
  </form>}
 </section>;
}
