'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';
import styles from './site-purchase-panel.module.css';
const endpoint='/api/identity/site-purchases';
const label={DRAFT:'Por autorizar',APPROVED:'Compra autorizada',REJECTED:'Rechazada',PARTIAL:'Recepción parcial',RECEIVED:'Recibida completa',CANCELLED:'Cancelada'};
const messages={PURCHASE_REVISION_CHANGED:'Otra persona cambió este pedido. Conservamos tus campos; actualizá antes de decidir.',PURCHASE_RECEIPT_EXCEEDS_ORDER:'La recepción supera el saldo de la compra. Revisá la cantidad.',PURCHASE_REQUEST_QUANTITY_EXCEEDED:'La compra supera la cantidad solicitada. Revisá el pedido.',PURCHASE_DELIVERY_ALREADY_RECORDED:'Ese remito ya está registrado en esta compra.',PURCHASE_APPROVAL_REQUIRED:'Primero debe autorizarse la compra.',PURCHASE_STATE_CHANGED:'La compra cambió de estado. Actualizá antes de decidir.',PURCHASE_PRICE_INVALID:'Ingresá un precio positivo con hasta dos decimales.',PURCHASE_QUANTITY_INVALID:'Ingresá una cantidad positiva con hasta tres decimales.',PURCHASE_REQUEST_CLOSED:'Este pedido está cerrado. Hace falta registrar un nuevo pedido.',WORKSPACE_CONTEXT_CHANGED:'Cambió tu organización o permiso. Volvé a abrir la obra.'};
async function api(sessionRequest,params,options={}) {
 return sessionRequest(endpoint+(params?'?'+new URLSearchParams(params):''),options,async r=>{const body=await r.json();if(!r.ok){const e=new Error(messages[body.code]||'No se pudo confirmar la operación. Conservamos tus datos.');e.status=r.status;e.code=body.code;throw e;}return body;});
}
export function SitePurchasePanel({projectId,scope,onPending,getSessionToken}) {
 const sessionRequest=useWorkspaceRequest(getSessionToken);
 const [opened,setOpened]=useState(false),[data,setData]=useState(null),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(null),[retryAllowed,setRetryAllowed]=useState(false),[notice,setNotice]=useState(''),[receipt,setReceipt]=useState('');
 const alive=useRef(true),sequence=useRef(0),abort=useRef(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{onPending?.(busy||Boolean(attempt)||Boolean(draft));return()=>onPending?.(false);},[busy,attempt,draft,onPending]);
 async function load(append=false) {
  if(busy||attempt)return;const n=++sequence.current;abort.current?.abort();const c=new AbortController();abort.current=c;
  setOpened(true);setBusy(true);setNotice('');
  try {const result=await api(sessionRequest,{projectId,scope,...(append&&data?.nextCursor?{after:data.nextCursor}:{})},{signal:c.signal});
   if(!alive.current||n!==sequence.current)return;if(result.scope!==scope||result.projectId!==projectId)throw new Error('La respuesta corresponde a otra obra.');
   setData(old=>append?{...result,records:[...(old?.records||[]),...result.records]}:result);
  }catch(e){if(alive.current&&e.name!=='AbortError')setNotice(e.message);}finally{if(alive.current&&n===sequence.current)setBusy(false);}
 }
 function edit(key,value){setDraft(old=>({...old,payload:{...old.payload,[key]:value}}));}
 function begin(row,action,decision) {
  setReceipt('');setNotice('');
  const base={requestId:row.id,revision:row.revision};
  setDraft({action,material:row.material,unit:row.unit,payload:action==='DRAFT_ORDER'?{...base,supplier:row.order?.supplier||'',quantity:row.order?.quantity||row.requestedQuantity,unitPrice:row.order?.unitPrice||'',currency:row.order?.currency||'ARS',reference:row.order?.reference||'',reason:''}:
   action==='REVIEW_ORDER'?{...base,decision,reason:''}:action==='RECEIVE_MATERIAL'?{...base,quantity:'',deliveryReference:'',reason:''}:{...base,reason:''}});
 }
 function confirmed(result) {
  if(result.scope!==scope||result.saved!==true||!result.receiptId||!result.record)throw new Error('Falta confirmar el recibo.');
  setData(old=>old?{...old,records:old.records.map(r=>r.id===result.record.id?result.record:r)}:old);
  setAttempt(null);setRetryAllowed(false);setDraft(null);setReceipt(result.receiptId);setNotice('Operación confirmada.');
 }
 async function sendAttempt(input,retrying=false) {
  setBusy(true);setAttempt(input);setRetryAllowed(false);setNotice('');setReceipt('');
  try{const result=await api(sessionRequest,null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),requestTimeoutMs:15000});if(alive.current)confirmed(result);}
  catch(error){if(alive.current){if(!retrying&&(error.requestDispatched===false||error.status&&error.status<500))setAttempt(null);setNotice((error.requestDispatched===false||error.status&&error.status<500)?error.message:'El resultado quedó sin confirmar. Comprobá el guardado antes de otro intento.');}}
  finally{if(alive.current)setBusy(false);}
 }
 async function save(e) {
  e.preventDefault();if(busy||attempt||!draft)return;
  await sendAttempt({operationId:crypto.randomUUID(),projectId,scope,action:draft.action,payload:draft.payload});
 }
 async function retry() {
  if(busy||!attempt||!retryAllowed)return;
  await sendAttempt(attempt,true);
 }
 async function recover() {
  if(busy||!attempt)return;setBusy(true);setRetryAllowed(false);
  try{const result=await api(sessionRequest,{projectId,scope,operationId:attempt.operationId},{requestTimeoutMs:15000});
   if(alive.current){if(result.scope!==scope)throw new Error('La respuesta corresponde a otra organización.');if(result.state==='RECORDED')confirmed(result);else if(result.state==='NOT_OBSERVED'){setRetryAllowed(true);setNotice('No se observa un recibo todavía. Podés comprobar otra vez o reintentar exactamente la misma operación; conservamos sus datos para evitar duplicados.');}else throw new Error('Todavía no se pudo comprobar el guardado. Conservamos el intento.');}}
  catch(error){if(alive.current)setNotice(error.message);}finally{if(alive.current)setBusy(false);}
 }
 const disabled=busy||Boolean(attempt);
 return <section className={styles.panel} aria-labelledby="purchase-title">
  <div className={styles.heading}><div><p className={styles.eyebrow}>MATERIALES</p><h3 id="purchase-title">Compras y recepciones</h3></div><button disabled={disabled} onClick={()=>load()} type="button">{opened?'Actualizar compras':'Abrir compras'}</button></div>
  <p className={styles.caption}>Prepará una compra desde un pedido, autorizá su importe y registrá cada entrega. Las recepciones documentan lo recibido; los pagos y las existencias disponibles requieren su registro propio.</p>
  <p role="status" aria-live="polite">{busy?'Consultando o guardando…':notice}</p>
  {attempt&&<div className={styles.actions}><button type="button" onClick={recover} disabled={busy}>Comprobar compra guardada</button>{retryAllowed&&<button type="button" onClick={retry} disabled={busy}>Reintentar la misma operación</button>}</div>}
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
  {data?.nextCursor&&<button type="button" disabled={disabled} onClick={()=>load(true)}>Ver más pedidos</button>}
  {draft&&<form onSubmit={save} className={styles.form}>
   <h4>{{DRAFT_ORDER:'Preparar cotización',REVIEW_ORDER:draft.payload.decision==='APPROVED'?'Autorizar importe':'Rechazar cotización',RECEIVE_MATERIAL:'Registrar entrega',CANCEL_ORDER:'Cancelar saldo pendiente'}[draft.action]} · {draft.material}</h4>
   {draft.action==='DRAFT_ORDER'&&<div className={styles.grid}>
    <label>Proveedor<input required minLength={2} maxLength={160} value={draft.payload.supplier} onChange={e=>edit('supplier',e.target.value)} disabled={disabled}/></label>
    <label>Cantidad ({draft.unit})<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,3})?" value={draft.payload.quantity} onChange={e=>edit('quantity',e.target.value)} disabled={disabled}/></label>
    <label>Precio unitario<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" value={draft.payload.unitPrice} onChange={e=>edit('unitPrice',e.target.value)} disabled={disabled}/></label>
    <label>Moneda<select value={draft.payload.currency} onChange={e=>edit('currency',e.target.value)} disabled={disabled}><option>ARS</option><option>USD</option></select></label>
    <label>Referencia de cotización<input required minLength={2} maxLength={100} value={draft.payload.reference} onChange={e=>edit('reference',e.target.value)} disabled={disabled}/></label>
   </div>}
   {draft.action==='RECEIVE_MATERIAL'&&<div className={styles.grid}><label>Cantidad recibida ({draft.unit})<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,3})?" value={draft.payload.quantity} onChange={e=>edit('quantity',e.target.value)} disabled={disabled}/></label><label>Remito o referencia de entrega<input required minLength={2} maxLength={100} value={draft.payload.deliveryReference} onChange={e=>edit('deliveryReference',e.target.value)} disabled={disabled}/></label></div>}
   <label>Motivo o detalle<textarea required minLength={8} maxLength={1000} value={draft.payload.reason} onChange={e=>edit('reason',e.target.value)} disabled={disabled}/></label>
   <div className={styles.actions}><button className={styles.primary} type="submit" disabled={disabled}>Confirmar operación</button><button type="button" disabled={disabled} onClick={()=>setDraft(null)}>Volver</button></div>
  </form>}
 </section>;
}
