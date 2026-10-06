const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const actions=['DRAFT_ORDER','REVIEW_ORDER','RECEIVE_MATERIAL','CANCEL_ORDER'];
const text=(value,max,min=0)=>typeof value==='string'&&value.length>=min&&value.length<=max;
const quantity=(value,zero=false)=>text(value,20,1)&&/^\d+(?:\.\d{1,3})?$/.test(value)&&(zero||/[1-9]/.test(value));
const money=(value,zero=false)=>text(value,32,1)&&/^\d+(?:\.\d{1,2})?$/.test(value)&&(zero||/[1-9]/.test(value));
const date=value=>typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value));
const fail=()=>{throw Object.assign(new Error('El resultado no permite confirmar esta compra. Conservamos su referencia.'),{code:'PURCHASE_RESULT_UNCONFIRMED'});};
function context(value,expected){if(value?.scope!==expected.scope||value.projectId!==expected.projectId)throw Object.assign(new Error('La respuesta no corresponde a esta obra. Volvé a consultar con tu acceso vigente.'),{code:'WORKSPACE_CONTEXT_CHANGED'});}
export const purchaseAccessDenied=error=>[401,403].includes(error?.status)||['WORKSPACE_CONTEXT_CHANGED','WORKSPACE_PROJECT_UNAVAILABLE'].includes(error?.code);
export function purchaseRecord(value){
 if(!value||!id(value.id)||!text(value.material,160,2)||!quantity(value.requestedQuantity)||!text(value.unit,40,1)||!text(value.sector,120,1)||!['OPEN','ACKNOWLEDGED','RESOLVED','REJECTED'].includes(value.requestState)||!text(value.revision,32,26)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/.test(value.revision))fail();
 const order=value.order;
 if(order!==null){
  if(!order||!['DRAFT','APPROVED','REJECTED','PARTIAL','RECEIVED','CANCELLED'].includes(order.state)||!text(order.supplier,160,2)||!quantity(order.quantity)||!money(order.unitPrice)||!money(order.total,true)||!['ARS','USD'].includes(order.currency)||!text(order.reference,100,2)||!quantity(order.received,true)||!Array.isArray(order.receipts)||order.receipts.length>100)fail();
  if(order.decision!==null&&(!order.decision||!date(order.decision.at)||!text(order.decision.reason,1000,8)))fail();
  for(const receipt of order.receipts)if(!quantity(receipt?.quantity)||!text(receipt.deliveryReference,100,2)||!date(receipt.at)||!text(receipt.reason,1000,8))fail();
 }
 return value;
}
export function purchaseSnapshot(value,expected){
 context(value,expected);
 if(value.inventory!==undefined){const i=value.inventory;if(!i||typeof i.configured!=='boolean'||!/^[a-f0-9]{64}$/.test(i.catalogHash||'')||!Array.isArray(i.materials)||i.materials.length>200||i.materials.some(m=>!id(m?.id)||!text(m.name,160,2)||!['unidad','m','m2','m3','kg','litro','bolsa'].includes(m.unit))||new Set(i.materials.map(m=>m.id)).size!==i.materials.length)fail();}
 if(!Array.isArray(value.records)||value.records.length>100||!Number.isSafeInteger(value.total)||value.total<value.records.length||value.nextCursor!==null&&!id(value.nextCursor))fail();
 value.records.forEach(purchaseRecord);if(new Set(value.records.map(row=>row.id)).size!==value.records.length)fail();
 if(expected.requestId&&(value.records.length!==1||value.records[0].id!==expected.requestId||value.total!==1||value.nextCursor!==null))fail();
 return value;
}
export function purchaseOutcome(value,command){
 context(value,command);if(!uuid(command?.operationId))fail();
 if(value.state==='NOT_OBSERVED'&&value.saved===false&&value.definitive===false&&!value.receipt&&!value.receiptId&&!value.record)return value;
 const receipt=value.receipt,target=command.requestId||command.payload?.requestId;
 if(value.state!=='RECORDED'||value.saved!==true||value.definitive!==true||typeof value.replayed!=='boolean'||!/^purchase_[a-f0-9]{64}$/.test(value.receiptId||'')||receipt?.id!==value.receiptId||receipt.operationId!==command.operationId||!id(receipt.requestId)||!actions.includes(receipt.action)||command.action&&receipt.action!==command.action||target&&receipt.requestId!==target)fail();
 purchaseRecord(value.record);if(value.record.id!==receipt.requestId)fail();return value;
}
export function purchaseRecordedOutcome(value,command){
 purchaseOutcome(value,command);if(value.state!=='RECORDED')fail();return value;
}
export function purchaseCanContinue(row,draft){
 if(!row||!draft||row.id!==draft.payload.requestId||row.material!==draft.material||row.unit!==draft.unit)return false;
 const open=['OPEN','ACKNOWLEDGED'].includes(row.requestState),state=row.order?.state;
 if(draft.action==='DRAFT_ORDER')return open&&(!row.order||['DRAFT','REJECTED'].includes(state));
 if(draft.action==='REVIEW_ORDER')return open&&state==='DRAFT';
 if(draft.action==='RECEIVE_MATERIAL')return open&&['APPROVED','PARTIAL'].includes(state);
 return draft.action==='CANCEL_ORDER'&&['DRAFT','APPROVED','PARTIAL'].includes(state);
}
