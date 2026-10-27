import {WorkspaceError,workspaceId,operationId,digest} from './workspace-policy.mjs';
import {MATERIAL_UNITS,siteText,siteRevision} from './site-register-policy.mjs';
import {inventoryQuantity} from './material-inventory.mjs';
import {parseProcurementQuantity} from './procurement-quantity.js';
import {normalizeProgressMeasurementQuantity,parseProgressMeasurementQuantity} from './progress-measurement-quantity.js';
import {MEASUREMENT_UNITS} from './task-progress-measurement.js';

export const EXECUTION_ACTIONS=Object.freeze(['ISSUE_EXECUTION_MANDATE','REVOKE_EXECUTION_MANDATE','REPORT_EXECUTION']);

const fail=code=>{throw new WorkspaceError('FIELD_EXECUTION_'+code,400);};
function exact(value,keys){
 if(value===null||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('INPUT_INVALID');
 const names=Reflect.ownKeys(value);
 if(names.some(name=>typeof name!=='string')||names.sort().join('|')!==[...keys].sort().join('|'))fail('INPUT_INVALID');
}
function list(value,min,max){
 if(!Array.isArray(value)||value.length<min||value.length>max)fail('INPUT_INVALID');
 return Array.from(value);
}
function id(value){if(!workspaceId(value))fail('ID_INVALID');return value;}
function measurementId(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/.test(value))fail('ID_INVALID');
 return value;
}
function revision(value){
 try{return siteRevision(value);}catch{fail('REVISION_INVALID');}
}
function positiveInteger(value){
 if(!Number.isSafeInteger(value)||value<1)fail('REVISION_INVALID');
 return value;
}
function catalogHash(value){
 if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))fail('INPUT_INVALID');
 return value;
}
function reason(value){
 try{return siteText(value,1000,8,true);}catch{fail('REASON_INVALID');}
}
function quantity(value){
 try{return inventoryQuantity(value);}catch{fail('QUANTITY_INVALID');}
}
function measuredQuantity(value,allowZero=false){
 try{return normalizeProgressMeasurementQuantity(value,{allowZero});}catch{fail('QUANTITY_INVALID');}
}
function materialUnit(value){if(!MATERIAL_UNITS.includes(value))fail('UNIT_INVALID');return value;}
function measurementUnit(value){if(!MEASUREMENT_UNITS.includes(value))fail('UNIT_INVALID');return value;}
function validUntil(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))fail('VALID_UNTIL_INVALID');
 const date=new Date(value);
 if(!Number.isFinite(date.getTime())||date.toISOString()!==value)fail('VALID_UNTIL_INVALID');
 return value;
}
function unique(rows,key){
 if(new Set(rows.map(row=>row[key])).size!==rows.length)fail('INPUT_INVALID');
 return rows.sort((left,right)=>left[key]<right[key]?-1:left[key]>right[key]?1:0);
}
function mandateMaterials(value){
 return unique(list(value,1,20).map(row=>{
  exact(row,['materialId','unit','limit','maxPerReport']);
  const limit=quantity(row.limit),maxPerReport=quantity(row.maxPerReport);
  if(parseProcurementQuantity(maxPerReport)>parseProcurementQuantity(limit))fail('LIMIT_INVALID');
  return {materialId:id(row.materialId),unit:materialUnit(row.unit),limit,maxPerReport};
 }),'materialId');
}
function mandateProgress(value){
 if(value===null)return null;
 exact(value,['definitionId','baseline','unit','limit','maxPerReport']);
 const baseline=measuredQuantity(value.baseline),limit=measuredQuantity(value.limit),maxPerReport=measuredQuantity(value.maxPerReport);
 if(parseProgressMeasurementQuantity(limit)>parseProgressMeasurementQuantity(baseline)||parseProgressMeasurementQuantity(maxPerReport)>parseProgressMeasurementQuantity(limit))fail('LIMIT_INVALID');
 return {definitionId:measurementId(value.definitionId),baseline,unit:measurementUnit(value.unit),limit,maxPerReport};
}
function reportLines(value){
 const units=new Map();
 return unique(list(value,1,20).map(row=>{
  exact(row,['lineId','materialId','unit','quantity']);
  const materialId=id(row.materialId),unit=materialUnit(row.unit);
  if(units.has(materialId)&&units.get(materialId)!==unit)fail('UNIT_INVALID');
  units.set(materialId,unit);
  return {lineId:id(row.lineId),materialId,unit,quantity:quantity(row.quantity)};
 }),'lineId');
}
function reportProgress(value){
 if(value===null)return null;
 exact(value,['definitionId','baseline','unit','mode','quantity']);
 if(!['DELTA','CUMULATIVE'].includes(value.mode))fail('INPUT_INVALID');
 const baseline=measuredQuantity(value.baseline),amount=measuredQuantity(value.quantity,value.mode==='CUMULATIVE');
 if(parseProgressMeasurementQuantity(amount)>parseProgressMeasurementQuantity(baseline))fail('LIMIT_INVALID');
 return {definitionId:measurementId(value.definitionId),baseline,unit:measurementUnit(value.unit),mode:value.mode,quantity:amount};
}
function evidence(value,required){
 if(!Array.isArray(value)||value.length>10||required&&!value.length)fail('EVIDENCE_INVALID');
 const ids=Array.from(value,id);
 if(new Set(ids).size!==ids.length)fail('EVIDENCE_INVALID');
 return ids.sort();
}

// This layer validates exact facts only. Current authority, expiry and remaining
// mandate limits are checked by the transactional store against database state.
export function normalizeExecutionPayload(action,p){
 if(!EXECUTION_ACTIONS.includes(action))fail('ACTION_INVALID');
 if(action==='ISSUE_EXECUTION_MANDATE'){
  exact(p,['workerId','taskId','taskRevision','sectorId','catalogHash','validUntil','materials','progress','reason']);
  return {workerId:id(p.workerId),taskId:id(p.taskId),taskRevision:revision(p.taskRevision),sectorId:id(p.sectorId),catalogHash:catalogHash(p.catalogHash),validUntil:validUntil(p.validUntil),materials:mandateMaterials(p.materials),progress:mandateProgress(p.progress),reason:reason(p.reason)};
 }
 if(action==='REVOKE_EXECUTION_MANDATE'){
  exact(p,['mandateId','revision','reason']);
  return {mandateId:id(p.mandateId),revision:positiveInteger(p.revision),reason:reason(p.reason)};
 }
 exact(p,['reportId','mandateId','mandateRevision','workerId','taskId','taskRevision','sectorId','catalogHash','lines','progress','evidenceIds','reason']);
 if(!operationId(p.reportId))fail('ID_INVALID');
 const progress=reportProgress(p.progress);
 return {reportId:p.reportId.toLowerCase(),mandateId:id(p.mandateId),mandateRevision:positiveInteger(p.mandateRevision),workerId:id(p.workerId),taskId:id(p.taskId),taskRevision:revision(p.taskRevision),sectorId:id(p.sectorId),catalogHash:catalogHash(p.catalogHash),lines:reportLines(p.lines),progress,evidenceIds:evidence(p.evidenceIds,progress!==null),reason:reason(p.reason)};
}

export function executionFactDigest(payload){
 return digest(['field-execution-request-v1',normalizeExecutionPayload('REPORT_EXECUTION',payload)]);
}
