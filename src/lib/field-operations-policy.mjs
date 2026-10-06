import { WorkspaceError, workspaceId, operationId, digest } from './workspace-policy.mjs';
import { recordKeys, siteText, siteRevision, siteQuantity, MATERIAL_UNITS } from './site-register-policy.mjs';
import { validateReportedLocation, getDistanceMeters } from './geo.js';
import { normalizeProgressMeasurementQuantity, parseProgressMeasurementQuantity } from './progress-measurement-quantity.js';
import {inventoryQuantity} from './material-inventory.mjs';
import {OVERTIME_ACTIONS,normalizeOvertimePayload} from './field-overtime-policy.mjs';

// The enterprise attendance transition and conservative geofence contracts are
// preserved from 1677ff72773c95140535603093e5cb8624d1f063. This adapter writes the
// canonical tables deployed in Production; it does not introduce another ledger.
export const FIELD_NOTICE = 'field-location-v1';
export const FIELD_ACTIONS = ['CHECK_IN','BREAK_START','BREAK_END','CHECK_OUT'];
export const canReviewField = role => ['ADMIN','DIRECTOR','SITE_MANAGER'].includes(role);
export const canApproveProgress = role => ['ADMIN','DIRECTOR'].includes(role);
const id = value => { if(!workspaceId(value))throw new WorkspaceError('FIELD_INPUT_INVALID');return value; };
export function fieldTransition(action, latest) {
  if (!FIELD_ACTIONS.includes(action)) throw new WorkspaceError('ATTENDANCE_ACTION_INVALID');
  if(action==='CHECK_IN') {
    if(latest && latest.eventType!=='CHECK_OUT')throw new WorkspaceError('ATTENDANCE_SHIFT_ALREADY_OPEN',409);
    return {phase:'WORKING',closed:false};
  }
  if(!latest || latest.eventType==='CHECK_OUT')throw new WorkspaceError('ATTENDANCE_SHIFT_NOT_OPEN',409);
  if(action==='BREAK_START') {
    if(latest.phase!=='WORKING')throw new WorkspaceError('ATTENDANCE_BREAK_ALREADY_OPEN',409);
    return {phase:'ON_BREAK',closed:false};
  }
  if(action==='BREAK_END') {
    if(latest.phase!=='ON_BREAK')throw new WorkspaceError('ATTENDANCE_BREAK_NOT_OPEN',409);
    return {phase:'WORKING',closed:false};
  }
  if(latest.phase==='ON_BREAK')throw new WorkspaceError('ATTENDANCE_BREAK_OPEN',409);
  return {phase:'WORKING',closed:true};
}
export function evaluateFieldLocation(location, sector, now) {
  recordKeys(location,['latitude','longitude','accuracy','capturedAt','noticeVersion']);
  if(location.noticeVersion!==FIELD_NOTICE)throw new WorkspaceError('ATTENDANCE_PRIVACY_NOTICE_REQUIRED',422);
  // Some channels supply coordinates without a measured accuracy. Preserve that
  // absence and require human review; never fabricate a GPS precision.
  const unknownAccuracy=location.accuracy===null;
  const point=validateReportedLocation({...location,accuracy:unknownAccuracy?1:location.accuracy}),captured=new Date(location.capturedAt);
  if(!point.valid)throw new WorkspaceError(point.reason==='INVALID_COORDINATES'?'ATTENDANCE_LOCATION_INVALID':'ATTENDANCE_LOCATION_ACCURACY_INVALID',422);
  if(typeof location.capturedAt!=='string'||!Number.isFinite(captured.getTime())||Math.abs(now.getTime()-captured.getTime())>120000)throw new WorkspaceError('ATTENDANCE_LOCATION_STALE',422);
  const distance=getDistanceMeters(point.latitude,point.longitude,sector.latitude,sector.longitude);
  return {latitude:point.latitude,longitude:point.longitude,accuracyMeters:unknownAccuracy?null:point.accuracy,distanceMeters:Math.round(distance),
    geofenceRadiusMeters:sector.radius,locationCapturedAt:captured.toISOString(),noticeVersion:FIELD_NOTICE,
    verificationStatus:!unknownAccuracy&&distance+point.accuracy<=sector.radius?'VERIFIED':'REVIEW_REQUIRED'};
}
export const fieldReceiptId = (actorId,projectId,key) => 'field_'+digest([actorId,projectId,key.toLowerCase()]);
export function normalizeFieldCommand(input) {
  recordKeys(input,['operationId','projectId','scope','action','payload']);
  if(!operationId(input.operationId)||!workspaceId(input.projectId)||!/^[a-f0-9]{64}$/.test(input.scope||''))throw new WorkspaceError('FIELD_INPUT_INVALID');
  const p=input.payload;let payload;
  if(OVERTIME_ACTIONS.includes(input.action))payload=normalizeOvertimePayload(input.action,p);
  else if(input.action==='ADD_MATERIAL') {
    recordKeys(p,['revision','catalogHash','name','unit']);if(!MATERIAL_UNITS.includes(p.unit)||!/^[a-f0-9]{64}$/.test(p.catalogHash||''))throw new WorkspaceError('INVENTORY_INPUT_INVALID');
    payload={revision:siteRevision(p.revision),catalogHash:p.catalogHash,name:siteText(p.name,160,2),unit:p.unit};
  }else if(input.action==='PROPOSE_CONSUMPTION') {
    recordKeys(p,['workerId','taskId','sectorId','materialId','catalogHash','quantity','reason']);if(p.taskId!==null&&!workspaceId(p.taskId)||!/^[a-f0-9]{64}$/.test(p.catalogHash||''))throw new WorkspaceError('INVENTORY_INPUT_INVALID');
    payload={workerId:id(p.workerId),taskId:p.taskId,sectorId:id(p.sectorId),materialId:id(p.materialId),catalogHash:p.catalogHash,quantity:inventoryQuantity(p.quantity),reason:siteText(p.reason,1000,8,true)};
  }else if(['DECIDE_CONSUMPTION','REVERSE_CONSUMPTION'].includes(input.action)) {
    const review=input.action==='DECIDE_CONSUMPTION';recordKeys(p,['proposalId','revision','catalogHash','reason',...(review?['decision']:[])]);
    if(!/^[a-f0-9]{64}$/.test(p.catalogHash||'')||review&&!['APPROVE','REJECT'].includes(p.decision))throw new WorkspaceError('INVENTORY_INPUT_INVALID');
    payload={proposalId:id(p.proposalId),revision:siteRevision(p.revision),catalogHash:p.catalogHash,reason:siteText(p.reason,1000,8,true),...(review?{decision:p.decision}:{})};
  }else if(input.action==='CONFIGURE_SITE') {
    recordKeys(p,['revision','sectors']);siteRevision(p.revision);
    if(!Array.isArray(p.sectors)||!p.sectors.length||p.sectors.length>20)throw new WorkspaceError('FIELD_SECTORS_INVALID');
    payload={revision:p.revision,sectors:p.sectors.map(s=>{
      recordKeys(s,['id','name','latitude','longitude','radius']);
      if(typeof s.latitude!=='number'||typeof s.longitude!=='number'||!Number.isFinite(s.latitude)||!Number.isFinite(s.longitude)||s.latitude< -90||s.latitude>90||s.longitude< -180||s.longitude>180||!Number.isInteger(s.radius)||s.radius<20||s.radius>2000)throw new WorkspaceError('FIELD_SECTORS_INVALID');
      return {id:id(s.id),name:siteText(s.name,80),latitude:s.latitude,longitude:s.longitude,radius:s.radius};
    })};
    if(new Set(payload.sectors.map(s=>s.id)).size!==payload.sectors.length)throw new WorkspaceError('FIELD_SECTORS_INVALID');
  }else if(input.action==='ATTENDANCE') {
    recordKeys(p,['workerId','eventType','expectedEventId','sectorId','qrToken','location']);
    if(!FIELD_ACTIONS.includes(p.eventType)|| (p.expectedEventId!==null&&!workspaceId(p.expectedEventId)) || (p.qrToken!==null&&!/^[a-f0-9]{64}$/.test(p.qrToken)))throw new WorkspaceError('FIELD_INPUT_INVALID');
    payload={...p,workerId:id(p.workerId),sectorId:id(p.sectorId)};
  }else if(['REPORT_INCIDENT','REQUEST_MATERIAL'].includes(input.action)) {
    const incident=input.action==='REPORT_INCIDENT';
    recordKeys(p,incident?['workerId','sectorId','taskId','title','description','severity','evidenceIds']:['workerId','sectorId','taskId','name','quantity','unit','reason','evidenceIds']);
    if(!Array.isArray(p.evidenceIds)||p.evidenceIds.length>10||new Set(p.evidenceIds).size!==p.evidenceIds.length||(p.taskId!==null&&!workspaceId(p.taskId)))throw new WorkspaceError('FIELD_REPORT_INVALID');
    const common={workerId:id(p.workerId),sectorId:id(p.sectorId),taskId:p.taskId,evidenceIds:p.evidenceIds.map(id).sort()};
    if(incident){if(!['INFO','LOW','MEDIUM','HIGH','CRITICAL'].includes(p.severity))throw new WorkspaceError('FIELD_REPORT_INVALID');payload={...common,title:siteText(p.title,160,3),description:siteText(p.description,2000,8,true),severity:p.severity};}
    else{if(!MATERIAL_UNITS.includes(p.unit))throw new WorkspaceError('FIELD_REPORT_INVALID');payload={...common,name:siteText(p.name,160,2),quantity:siteQuantity(p.quantity),unit:p.unit,reason:siteText(p.reason,2000,8,true)};}
  }else if(input.action==='REVIEW_ATTENDANCE') {
    recordKeys(p,['eventId','decision','reason']);
    if(!['APPROVE','REJECT'].includes(p.decision))throw new WorkspaceError('FIELD_DECISION_INVALID');
    payload={eventId:id(p.eventId),decision:p.decision,reason:siteText(p.reason,1000,8,true)};
  }else if(input.action==='REVIEW_EVIDENCE') {
    recordKeys(p,['evidenceId','revision','decision','reason']);
    if(!['APPROVE','REJECT'].includes(p.decision))throw new WorkspaceError('FIELD_DECISION_INVALID');
    payload={evidenceId:id(p.evidenceId),revision:siteRevision(p.revision),decision:p.decision,reason:siteText(p.reason,1000,8,true)};
  }else if(input.action==='PROPOSE_PROGRESS') {
    recordKeys(p,['workerId','taskId','revision','progress','quantity','baseline','unit','reason','evidenceIds']);
    if(!Number.isInteger(p.progress)||p.progress<0||p.progress>100||!Array.isArray(p.evidenceIds)||!p.evidenceIds.length||p.evidenceIds.length>10||new Set(p.evidenceIds).size!==p.evidenceIds.length)throw new WorkspaceError('FIELD_PROGRESS_INVALID');
    const hasQuantity=p.quantity!==null||p.baseline!==null||p.unit!==null;
    let quantity=null,baseline=null,unit=null;
    if(hasQuantity){try{quantity=normalizeProgressMeasurementQuantity(p.quantity);baseline=normalizeProgressMeasurementQuantity(p.baseline,{allowZero:false});}catch{throw new WorkspaceError('FIELD_QUANTITY_INVALID');}
      if(!['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT'].includes(p.unit)||parseProgressMeasurementQuantity(quantity)>parseProgressMeasurementQuantity(baseline))throw new WorkspaceError('FIELD_QUANTITY_INVALID');
      unit=p.unit;const derived=Number(parseProgressMeasurementQuantity(quantity)*100n/parseProgressMeasurementQuantity(baseline));if(derived!==p.progress)throw new WorkspaceError('FIELD_QUANTITY_PROGRESS_MISMATCH');
    }
    payload={workerId:id(p.workerId),taskId:id(p.taskId),revision:siteRevision(p.revision),progress:p.progress,quantity,baseline,unit,reason:siteText(p.reason,1000,8,true),evidenceIds:p.evidenceIds.map(id).sort()};
  }else if(input.action==='DECIDE_PROGRESS') {
    recordKeys(p,['proposalId','revision','decision','reason']);
    if(!['APPROVE','REJECT'].includes(p.decision))throw new WorkspaceError('FIELD_DECISION_INVALID');
    payload={proposalId:id(p.proposalId),revision:siteRevision(p.revision),decision:p.decision,reason:siteText(p.reason,1000,8,true)};
  }else throw new WorkspaceError('FIELD_ACTION_INVALID');
  return {...input,operationId:input.operationId.toLowerCase(),payload};
}
