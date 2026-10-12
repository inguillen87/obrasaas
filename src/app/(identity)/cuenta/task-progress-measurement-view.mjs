import {deriveTaskMeasurement,TASK_MEASUREMENT_VERSION} from '../../../lib/task-progress-measurement.js';
import {normalizeProgressMeasurementQuantity} from '../../../lib/progress-measurement-quantity.js';
import {voiceProgressDraftForEvidence,prepareVoiceProgressDraft,UNKNOWN_VOICE_VALUE,voiceProgressUnitLabel} from '../../../lib/voice-progress-draft.mjs';

export const MEASUREMENT_CONFIGURATION_ACTION='CONFIGURE_PROGRESS_MEASUREMENT';
export const MEASUREMENT_CONFIGURATION_CANCEL_ACTION='CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION';
const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
const revision=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{6}$/.test(value)&&Number.isFinite(Date.parse(value+'Z'));
const instant=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const text=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max&&!/[\u0000-\u001f\u007f<>]/.test(value);
const fail=message=>{throw new Error(message);};
export const measuredQuantityLabel=value=>String(value).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace('.',',');
export function configurationFailureRetainsAttempt({method,action,existingAttempt},error){
 return !(method==='POST'&&action===MEASUREMENT_CONFIGURATION_ACTION&&existingAttempt!==true&&(error?.requestDispatched===false||error?.definitiveConfigurationRejection===true));
}

export function taskMeasurementView(task){
 if(task?.measurement===null||task?.measurement===undefined)return {state:'UNCONFIGURED',label:'Sin base de medición definida'};
 try{
  const value=task.measurement;
  if(!exact(value,['version','definitionId','baseline','unit','executed','sourceReference','configuredAt','approvedProposalId','approvedAt'])||value.version!==TASK_MEASUREMENT_VERSION||!identifier(value.definitionId)||!text(value.sourceReference,3,240)||!instant(value.configuredAt)||value.approvedProposalId!==null&&!identifier(value.approvedProposalId)||value.approvedAt!==null&&!instant(value.approvedAt)||(value.approvedProposalId===null)!==(value.approvedAt===null))throw new Error('Invalid measurement');
  const derived=deriveTaskMeasurement(task,{mode:'CUMULATIVE',quantity:value.executed});
  return {state:'CONFIGURED',...value,percent:derived.percent,progress:derived.progress,remaining:derived.remaining,unitLabel:voiceProgressUnitLabel(value.unit),label:`${measuredQuantityLabel(value.executed)} / ${measuredQuantityLabel(value.baseline)} ${voiceProgressUnitLabel(value.unit)}`};
 }catch{return {state:'UNCONFIRMED',label:'Medición por comprobar'};}
}

export function measurementProposalPreview(task,{mode,quantity}={}){
 if(taskMeasurementView(task).state!=='CONFIGURED')return {ready:false,message:'El responsable debe definir una base vigente antes de proponer un metrado.'};
 if(!['DELTA','CUMULATIVE'].includes(mode))return {ready:false,message:'Elegí si la cantidad es del día o acumulada.'};
 if(typeof quantity!=='string'||!quantity.trim())return {ready:false,message:'Ingresá la cantidad medida.'};
 try{return {ready:true,...deriveTaskMeasurement(task,{mode,quantity:normalizeProgressMeasurementQuantity(quantity.trim().replace(',','.'))})};}
 catch(error){return {ready:false,message:measurementErrorMessage(error)};}
}

export function measurementErrorMessage(error){
 return ({TASK_MEASUREMENT_NOT_CONFIGURED:'El responsable debe definir la base y unidad de esta tarea.',TASK_MEASUREMENT_INVALID:'Ingresá una cantidad exacta con hasta cuatro decimales. Una cantidad del día debe ser mayor que cero.',TASK_MEASUREMENT_EXCEEDS_BASELINE:'La cantidad propuesta supera la base definida para esta tarea.',TASK_MEASUREMENT_REGRESSION:'La cantidad acumulada no puede ser menor a la ya aprobada.',TASK_MEASUREMENT_STATE_INVALID:'La tarea necesita comprobar su metrado anterior antes de continuar.',TASK_MEASUREMENT_PROGRESS_MISMATCH:'La medición y el porcentaje vigentes necesitan revisión del responsable.',TASK_MEASUREMENT_BASELINE_LOCKED:'Esta base ya tiene una medición aprobada y conserva su cantidad y unidad.',FIELD_REVISION_CHANGED:'La tarea cambió. Conservamos lo escrito; consultá su estado vigente antes de confirmar.',WORKSPACE_CONTEXT_CHANGED:'Cambió la empresa o tu permiso. Volvé a consultar la obra.',FIELD_PROGRESS_PERMISSION_REQUIRED:'La base debe definirla un administrador o director.'})[error?.code]||'Revisá la cantidad, el alcance y la base vigente. Conservamos lo escrito.';
}

export function measurementProposalPayload(task,payload,confirmed){
 const preview=measurementProposalPreview(task,payload);
 if(!preview.ready||confirmed!==true)fail(preview.message||'Revisá y confirmá el metrado antes de proponerlo.');
 if(!identifier(payload.workerId)||!identifier(task.id)||!revision(task.revision)||!text(payload.reason,8,1000)||!Array.isArray(payload.evidenceIds)||payload.evidenceIds.length<1||payload.evidenceIds.length>10||payload.evidenceIds.some(id=>!identifier(id))||new Set(payload.evidenceIds).size!==payload.evidenceIds.length)fail('Completá el fundamento y elegí evidencia aprobada de esta tarea.');
 return {workerId:payload.workerId,taskId:task.id,revision:task.revision,measurement:{mode:preview.mode,quantity:preview.reported},reason:payload.reason.trim(),evidenceIds:[...payload.evidenceIds]};
}

export function measurementConfirmation(task,payload){
 const preview=measurementProposalPreview(task,payload);if(!preview.ready)return null;
 return {taskId:task.id,revision:task.revision,definitionId:preview.definitionId,mode:preview.mode,reported:preview.reported,previous:preview.previous,executed:preview.executed,baseline:preview.baseline,unit:preview.unit};
}
export function measurementConfirmationMatches(review,task,payload){
 const current=measurementConfirmation(task,payload);
 return Boolean(review&&current&&exact(review,Object.keys(current))&&Object.keys(current).every(key=>review[key]===current[key]));
}

export function prepareMeasuredVoiceProgress(evidence,task,workerId){
 const prepared=prepareVoiceProgressDraft(evidence,task,workerId),interpretation=voiceProgressDraftForEvidence(evidence,task);
 if(taskMeasurementView(task).state!=='CONFIGURED')return prepared;
 return {...prepared,payload:{workerId,taskId:task.id,mode:'',quantity:'',reason:prepared.payload.reason,evidenceIds:prepared.payload.evidenceIds},unitMismatch:interpretation.unit!==UNKNOWN_VOICE_VALUE&&interpretation.unit!==task.measurement.unit};
}

export function measurementConfigurationCommand(task,fields,{scope,projectId,operationId,confirmed,allowed}={}){
 if(allowed!==true||confirmed!==true||!identifier(task?.id)||!revision(task.revision)||!/^[a-f0-9]{64}$/.test(scope||'')||!identifier(projectId)||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(operationId||''))fail('Revisá la tarea y confirmá la base con tus permisos actuales.');
 let baseline;try{baseline=normalizeProgressMeasurementQuantity(fields.baseline.trim().replace(',','.'),{allowZero:false});}catch{fail('La cantidad base debe ser mayor que cero, con hasta cuatro decimales.');}
 if(!['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT'].includes(fields.unit)||!text(fields.sourceReference,3,240)||!text(fields.reason,8,1000))fail('Elegí la unidad e indicá la fuente y el motivo de esta base.');
 return {projectId,scope,operationId,action:MEASUREMENT_CONFIGURATION_ACTION,payload:{taskId:task.id,revision:task.revision,baseline,unit:fields.unit,sourceReference:fields.sourceReference.trim(),reason:fields.reason.trim()}};
}

export function measurementConfigurationResult(result,reference){
 if(result?.scope!==reference.scope||result.projectId!==undefined&&result.projectId!==reference.projectId||result.operationId!==undefined&&result.operationId!==reference.operationId||result.action!==undefined&&result.action!==MEASUREMENT_CONFIGURATION_ACTION)fail('El recibo no corresponde a este intento y esta obra. Conservamos su referencia.');
 if(result.state==='NOT_OBSERVED'&&result.definitive===false&&result.saved!==true&&!result.receiptId)return {state:'PENDING'};
 if(result.projectId!==reference.projectId||result.operationId!==reference.operationId||result.action!==MEASUREMENT_CONFIGURATION_ACTION)fail('El recibo no corresponde a este intento y esta obra. Conservamos su referencia.');
 if(result.state==='CANCELLED'){
  if(!exact(result,['scope','projectId','operationId','action','state','saved','replayed','receiptId','kind','taskId','taskProgressUnchanged'])||result.saved!==false||typeof result.replayed!=='boolean'||result.kind!=='MEASUREMENT_CONFIGURATION_CANCELLED'||result.taskId!==reference.taskId||result.taskProgressUnchanged!==true||!/^field_[a-f0-9]{64}$/.test(result.receiptId||''))fail('No pudimos comprobar el cierre de este intento. Conservamos su referencia.');
  return {state:'CANCELLED',receiptId:result.receiptId};
 }
 const recorded=result.configuredTaskSnapshot||result.task;
 if(result.state!=='RECORDED'||result.saved!==true||result.kind!=='MEASUREMENT_CONFIGURATION'||!/^field_[a-f0-9]{64}$/.test(result.receiptId||'')||recorded?.id!==reference.taskId||result.task?.id!==reference.taskId||taskMeasurementView(recorded).state!=='CONFIGURED'||taskMeasurementView(result.task).state!=='CONFIGURED'||!revision(result.task.revision))fail('Todavía no pudimos comprobar la base guardada. Conservamos este intento.');
 return {state:'RECORDED',task:result.task,recordedTask:recorded,receiptId:result.receiptId};
}
