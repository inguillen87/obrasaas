import { WorkspaceError, operationId, workspaceId, digest } from './workspace-policy.mjs';
import { recordKeys, siteText, siteRevision } from './site-register-policy.mjs';
import { parseProcurementQuantity, formatProcurementQuantity } from './procurement-quantity.js';
import { parseProcurementMoney, formatProcurementMoney, calculateProcurementOrderTotal } from './procurement-money.js';

export function exactQuantity(value,allowZero=false) {
  if(typeof value!=='string'||value.length>20)throw new WorkspaceError('PURCHASE_QUANTITY_INVALID');
  try{return formatProcurementQuantity(parseProcurementQuantity(value,{allowZero}));}
  catch{throw new WorkspaceError('PURCHASE_QUANTITY_INVALID');}
}
export function exactPrice(value) {
  if(typeof value!=='string'||value.length>20)throw new WorkspaceError('PURCHASE_PRICE_INVALID');
  try{return formatProcurementMoney(parseProcurementMoney(value));}
  catch{throw new WorkspaceError('PURCHASE_PRICE_INVALID');}
}
export function purchaseTotal(quantity,unitPrice) {
  try{return formatProcurementMoney(calculateProcurementOrderTotal([{quantityScaled:parseProcurementQuantity(quantity),unitPriceScaled:parseProcurementMoney(unitPrice)}]));}
  catch{throw new WorkspaceError('PURCHASE_TOTAL_INVALID');}
}
export function normalizePurchase(input) {
  recordKeys(input,['operationId','projectId','scope','action','payload']);
  if(!operationId(input.operationId)||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('PURCHASE_INPUT_INVALID');
  const p=input.payload;let payload;
  if(input.action==='DRAFT_ORDER') {
    recordKeys(p,['requestId','revision','supplier','quantity','unitPrice','currency','reference','reason']);
    if(!['ARS','USD'].includes(p.currency))throw new WorkspaceError('PURCHASE_CURRENCY_INVALID');
    payload={requestId:p.requestId,revision:siteRevision(p.revision),supplier:siteText(p.supplier,160,2),quantity:exactQuantity(p.quantity),
      unitPrice:exactPrice(p.unitPrice),currency:p.currency,reference:siteText(p.reference,100,2),reason:siteText(p.reason,1000,8,true)};
  }else if(input.action==='REVIEW_ORDER') {
    recordKeys(p,['requestId','revision','decision','reason']);
    if(!['APPROVED','REJECTED'].includes(p.decision))throw new WorkspaceError('PURCHASE_DECISION_INVALID');
    payload={requestId:p.requestId,revision:siteRevision(p.revision),decision:p.decision,reason:siteText(p.reason,1000,8,true)};
  }else if(input.action==='RECEIVE_MATERIAL') {
    const inventory=Object.hasOwn(p,'materialId')||Object.hasOwn(p,'inventoryCatalogHash');
    recordKeys(p,['requestId','revision','quantity','deliveryReference','reason',...(inventory?['materialId','inventoryCatalogHash']:[])]);
    if(inventory&&(!workspaceId(p.materialId)||!/^[a-f0-9]{64}$/.test(p.inventoryCatalogHash||'')))throw new WorkspaceError('INVENTORY_RECEIPT_MATERIAL_REQUIRED');
    payload={requestId:p.requestId,revision:siteRevision(p.revision),quantity:exactQuantity(p.quantity),
      deliveryReference:siteText(p.deliveryReference,100,2),reason:siteText(p.reason,1000,8,true),...(inventory?{materialId:p.materialId,inventoryCatalogHash:p.inventoryCatalogHash}:{})};
  }else if(input.action==='CANCEL_ORDER') {
    recordKeys(p,['requestId','revision','reason']);
    payload={requestId:p.requestId,revision:siteRevision(p.revision),reason:siteText(p.reason,1000,8,true)};
  }else throw new WorkspaceError('PURCHASE_ACTION_INVALID');
  if(!workspaceId(payload.requestId))throw new WorkspaceError('PURCHASE_INPUT_INVALID');
  return {...input,operationId:input.operationId.toLowerCase(),payload};
}
export const purchaseReceiptId=(actorId,input)=>'purchase_'+digest([actorId,input.projectId,input.operationId.toLowerCase()]);
export const purchaseDigest=input=>digest([input.projectId,input.scope,input.action,input.payload]);
export function applyPurchase(record,input,actorId,recordedAt) {
  if(record.siteRegister?.version!==1||record.siteRegister.type!=='MATERIAL_REQUEST')throw new WorkspaceError('PURCHASE_REQUEST_UNAVAILABLE',404);
  const p=input.payload,prior=record.procurement;
  if(input.action==='DRAFT_ORDER') {
    if(!['OPEN','ACKNOWLEDGED'].includes(record.siteRegister.state))throw new WorkspaceError('PURCHASE_REQUEST_CLOSED',409);
    if(prior&&!['DRAFT','REJECTED'].includes(prior.state))throw new WorkspaceError('PURCHASE_STATE_CHANGED',409);
    if(parseProcurementQuantity(p.quantity)>parseProcurementQuantity(record.siteRegister.quantity))throw new WorkspaceError('PURCHASE_REQUEST_QUANTITY_EXCEEDED',409);
    return {...record,procurement:{version:1,state:'DRAFT',supplier:p.supplier,quantity:p.quantity,unitPrice:p.unitPrice,currency:p.currency,
      total:purchaseTotal(p.quantity,p.unitPrice),reference:p.reference,received:'0.000',preparedBy:actorId,preparedAt:recordedAt,reason:p.reason,receipts:[]}};
  }
  if(prior?.version!==1)throw new WorkspaceError('PURCHASE_ORDER_REQUIRED',409);
  if(['REVIEW_ORDER','RECEIVE_MATERIAL'].includes(input.action)&&!['OPEN','ACKNOWLEDGED'].includes(record.siteRegister.state))throw new WorkspaceError('PURCHASE_REQUEST_CLOSED',409);
  let order;
  if(input.action==='REVIEW_ORDER') {
    if(prior.state!=='DRAFT')throw new WorkspaceError('PURCHASE_STATE_CHANGED',409);
    order={...prior,state:p.decision,decision:{by:actorId,at:recordedAt,reason:p.reason}};
  }else if(input.action==='RECEIVE_MATERIAL') {
    if(!['APPROVED','PARTIAL'].includes(prior.state))throw new WorkspaceError('PURCHASE_APPROVAL_REQUIRED',409);
    if(prior.receipts.length>=100)throw new WorkspaceError('PURCHASE_RECEIPT_LIMIT',409);
    if(prior.receipts.some(r=>r.deliveryReference.toLocaleLowerCase('es')===p.deliveryReference.toLocaleLowerCase('es')))throw new WorkspaceError('PURCHASE_DELIVERY_ALREADY_RECORDED',409);
    const received=parseProcurementQuantity(prior.received,{allowZero:true})+parseProcurementQuantity(p.quantity),ordered=parseProcurementQuantity(prior.quantity);
    if(received>ordered)throw new WorkspaceError('PURCHASE_RECEIPT_EXCEEDS_ORDER',409);
    order={...prior,state:received===ordered?'RECEIVED':'PARTIAL',received:formatProcurementQuantity(received),
      receipts:[...prior.receipts,{operationId:input.operationId,quantity:p.quantity,deliveryReference:p.deliveryReference,reason:p.reason,by:actorId,at:recordedAt,...(p.materialId?{materialId:p.materialId,inventoryCatalogHash:p.inventoryCatalogHash}:{})}]};
  }else {
    if(!['DRAFT','APPROVED','PARTIAL'].includes(prior.state))throw new WorkspaceError('PURCHASE_STATE_CHANGED',409);
    order={...prior,state:'CANCELLED',cancellation:{by:actorId,at:recordedAt,reason:p.reason}};
  }
  return {...record,procurement:order,siteRegister:{...record.siteRegister,purchaseAuthorized:['APPROVED','PARTIAL','RECEIVED'].includes(order.state),
    ...(order.state==='RECEIVED'?{state:'RESOLVED',review:{decision:'RESOLVED',actorId,recordedAt,reason:'Recepción completa documentada: '+p.reason}}:{})}};
}
