import {parseProgressMeasurementQuantity,formatProgressMeasurementQuantity,normalizeProgressMeasurementQuantity} from './progress-measurement-quantity.js';

export const TASK_MEASUREMENT_VERSION = 'task-progress-measurement-v1';
export const MEASUREMENT_UNITS = Object.freeze(['M','M2','M3','KG','T','L','UNIT','HOUR','DAY','LOT']);
const definitionKeys = ['version','definitionId','baseline','unit','sourceReference','configuredBy','configuredAt'];
const publicKeys = ['version','definitionId','baseline','unit','executed','sourceReference','configuredAt','approvedProposalId','approvedAt'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact = (value,keys) => object(value) && Object.getOwnPropertySymbols(value).length === 0 && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const id = value => typeof value === 'string' && /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,127}$/.test(value);
const reference = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f-\u009f]/.test(value);
const unitValid = value => MEASUREMENT_UNITS.includes(value);

const messages = {
  TASK_MEASUREMENT_INVALID:'La medición debe usar una cantidad decimal exacta y una unidad admitida.',
  TASK_MEASUREMENT_NOT_CONFIGURED:'El responsable debe definir el metrado de esta tarea antes de informar cantidades.',
  TASK_MEASUREMENT_STATE_INVALID:'No se pudo confirmar el metrado aprobado de esta tarea.',
  TASK_MEASUREMENT_PROGRESS_MISMATCH:'El metrado guardado no coincide con el porcentaje vigente de la tarea.',
  TASK_MEASUREMENT_BASELINE_LOCKED:'La base y unidad del metrado aprobado requieren una revisión independiente para modificarse.',
  TASK_MEASUREMENT_EXCEEDS_BASELINE:'La cantidad acumulada no puede superar el metrado total de la tarea.',
  TASK_MEASUREMENT_REGRESSION:'La cantidad acumulada no puede ser menor que la cantidad ya aprobada.',
};
export class TaskProgressMeasurementError extends Error {
  constructor(code = 'TASK_MEASUREMENT_INVALID',status = 400) {
    super(messages[code] || messages.TASK_MEASUREMENT_INVALID);
    this.name = 'TaskProgressMeasurementError';
    this.code = code;
    this.status = status;
  }
}
const fail = (code = 'TASK_MEASUREMENT_INVALID',status = 400) => {throw new TaskProgressMeasurementError(code,status);};
const stateInvalid = () => fail('TASK_MEASUREMENT_STATE_INVALID',409);

function instant(value) {
  if (typeof value !== 'string' || value.length > 40) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [,yearText,monthText,dayText,hour,minute,second,zone] = match;
  const year = Number(yearText),month = Number(monthText),day = Number(dayText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60 && (zone === 'Z' || Number(zone.slice(1,3)) < 24 && Number(zone.slice(4,6)) < 60) && Number.isFinite(Date.parse(value));
}
function normalized(value,{positive = false,state = false} = {}) {
  try {
    const result = normalizeProgressMeasurementQuantity(value,{allowZero:!positive});
    if (state && value !== result) stateInvalid();
    return result;
  } catch (error) {
    if (error instanceof TaskProgressMeasurementError) throw error;
    if (state) stateInvalid();
    fail();
  }
}
function checkedTask(task) {
  if (!object(task) || !Number.isInteger(task.progress) || task.progress < 0 || task.progress > 100) stateInvalid();
  return task;
}
function percent(executed,baseline) {
  const amount = parseProgressMeasurementQuantity(executed),total = parseProgressMeasurementQuantity(baseline,{allowZero:false});
  if (amount > total) stateInvalid();
  // Floor at four decimal places, never round an incomplete task up to 100%.
  return {percent:formatProgressMeasurementQuantity(amount * 1_000_000n / total),progress:Number(amount * 100n / total)};
}
function checkedProgress(task,executed,baseline) {
  const computed = percent(executed,baseline);
  if (computed.progress !== task.progress) fail('TASK_MEASUREMENT_PROGRESS_MISMATCH',409);
  return computed;
}
function approvedReference(field) {
  if (!id(field.approvedProposalId) || !instant(field.approvedAt)) stateInvalid();
  return {approvedProposalId:field.approvedProposalId,approvedAt:field.approvedAt};
}
function privateQuantity(task,field) {
  if (!Object.hasOwn(field,'quantity')) return null;
  const quantity = field.quantity;
  if (!exact(quantity,['executed','baseline','unit']) || !unitValid(quantity.unit)) stateInvalid();
  const executed = normalized(quantity.executed,{state:true}),baseline = normalized(quantity.baseline,{positive:true,state:true});
  checkedProgress(task,executed,baseline);
  return {executed,baseline,unit:quantity.unit,...approvedReference(field)};
}
function fieldOf(task) {
  if (task.metadata === undefined || task.metadata === null) return {};
  if (!object(task.metadata)) stateInvalid();
  const field = task.metadata.fieldOperations;
  if (field === undefined) return {};
  if (!object(field)) stateInvalid();
  return field;
}
function publicProjection(task,value) {
  if (!exact(value,publicKeys) || value.version !== TASK_MEASUREMENT_VERSION || !id(value.definitionId) || !unitValid(value.unit) || !reference(value.sourceReference) || !instant(value.configuredAt)) stateInvalid();
  const baseline = normalized(value.baseline,{positive:true,state:true}),executed = normalized(value.executed,{state:true});
  checkedProgress(task,executed,baseline);
  const emptyApproval = value.approvedProposalId === null && value.approvedAt === null;
  if (!emptyApproval && (!id(value.approvedProposalId) || !instant(value.approvedAt)) || emptyApproval && executed !== '0.0000') stateInvalid();
  return Object.freeze({version:TASK_MEASUREMENT_VERSION,definitionId:value.definitionId,baseline,unit:value.unit,executed,sourceReference:value.sourceReference,configuredAt:value.configuredAt,approvedProposalId:value.approvedProposalId,approvedAt:value.approvedAt});
}

// Project only measurement facts. No actor, metadata, evidence locator or
// guessed quantity from a historical percentage enters this browser DTO.
export function publicTaskMeasurement(task) {
  checkedTask(task);
  const field = fieldOf(task),hasDefinition = Object.hasOwn(field,'measurement'),hasPublic = Object.hasOwn(task,'measurement');
  if (!hasDefinition) return hasPublic && task.measurement !== null ? publicProjection(task,task.measurement) : null;
  const definition = field.measurement;
  if (!exact(definition,definitionKeys) || definition.version !== TASK_MEASUREMENT_VERSION || !id(definition.definitionId) || !unitValid(definition.unit) || !reference(definition.sourceReference) || !id(definition.configuredBy) || !instant(definition.configuredAt)) stateInvalid();
  const baseline = normalized(definition.baseline,{positive:true,state:true}),approved = privateQuantity(task,field);
  if (approved && (approved.baseline !== baseline || approved.unit !== definition.unit)) stateInvalid();
  if (!approved && task.progress !== 0) stateInvalid();
  const value = Object.freeze({version:TASK_MEASUREMENT_VERSION,definitionId:definition.definitionId,baseline,unit:definition.unit,executed:approved?.executed || '0.0000',sourceReference:definition.sourceReference,configuredAt:definition.configuredAt,approvedProposalId:approved?.approvedProposalId || null,approvedAt:approved?.approvedAt || null});
  if (hasPublic) {
    if (task.measurement === null) stateInvalid();
    const observed = publicProjection(task,task.measurement);
    if (publicKeys.some(key => observed[key] !== value[key])) stateInvalid();
  }
  return value;
}

export function deriveTaskMeasurement(task,input) {
  const measurement = publicTaskMeasurement(task);
  if (!measurement) fail('TASK_MEASUREMENT_NOT_CONFIGURED',409);
  if (!exact(input,['mode','quantity']) || !['DELTA','CUMULATIVE'].includes(input.mode)) fail();
  const reported = normalized(input.quantity,{positive:input.mode === 'DELTA'}),before = parseProgressMeasurementQuantity(measurement.executed),amount = parseProgressMeasurementQuantity(reported);
  const executed = input.mode === 'DELTA' ? before + amount : amount;
  if (executed < before) fail('TASK_MEASUREMENT_REGRESSION',409);
  const baseline = parseProgressMeasurementQuantity(measurement.baseline,{allowZero:false});
  if (executed > baseline) fail('TASK_MEASUREMENT_EXCEEDS_BASELINE',400);
  const value = formatProgressMeasurementQuantity(executed),computed = percent(value,measurement.baseline);
  return Object.freeze({definitionId:measurement.definitionId,mode:input.mode,reported,previous:measurement.executed,delta:formatProgressMeasurementQuantity(executed-before),executed:value,baseline:measurement.baseline,unit:measurement.unit,remaining:formatProgressMeasurementQuantity(baseline-executed),percent:computed.percent,progress:computed.progress});
}

// Authorization, current Task revision and the AuditLog configuration receipt
// remain server/store responsibilities. This pure check never writes anything.
export function assertMeasurementConfiguration(task,input) {
  checkedTask(task);
  if (!exact(input,['baseline','unit']) || !unitValid(input.unit)) fail();
  const baseline = normalized(input.baseline,{positive:true}),field = fieldOf(task),approved = privateQuantity(task,field),measurement = publicTaskMeasurement(task);
  const sealed = approved || (measurement?.approvedProposalId ? measurement : null);
  if (sealed && (sealed.baseline !== baseline || sealed.unit !== input.unit)) fail('TASK_MEASUREMENT_BASELINE_LOCKED',409);
  if (!sealed && task.progress !== 0) stateInvalid();
  return Object.freeze({baseline,unit:input.unit,executed:sealed?.executed || '0.0000'});
}
