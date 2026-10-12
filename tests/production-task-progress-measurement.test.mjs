import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {TASK_MEASUREMENT_VERSION,MEASUREMENT_UNITS,TaskProgressMeasurementError,publicTaskMeasurement,deriveTaskMeasurement,assertMeasurementConfiguration} from '../src/lib/task-progress-measurement.js';

const definition = {version:TASK_MEASUREMENT_VERSION,definitionId:'measurement-definition-a',baseline:'10.0000',unit:'M2',sourceReference:'Planilla de metrado A-01',configuredBy:'manager-a',configuredAt:'2026-10-12T12:00:00.000Z'};
function task({executed = '2.5000',baseline = definition.baseline,unit = definition.unit,progress = 25,quantity = true} = {}) {
  return {id:'task-a',revision:'2026-10-12T12:00:00.000001',progress,metadata:{unrelated:{keep:true},fieldOperations:{measurement:{...definition,baseline,unit},...(quantity?{quantity:{executed,baseline,unit},approvedProposalId:'proposal-approved-a',approvedAt:'2026-10-12T12:30:00.000Z'}:{})}}};
}
const error = (run,code,status) => assert.throws(run,value => value instanceof TaskProgressMeasurementError && value.code === code && value.status === status);

test('public projection exposes exact configuration and approved quantity without internal actor or metadata',() => {
  const current = task(),before = structuredClone(current),result = publicTaskMeasurement(current);
  assert.deepEqual(result,{version:TASK_MEASUREMENT_VERSION,definitionId:definition.definitionId,baseline:'10.0000',unit:'M2',executed:'2.5000',sourceReference:definition.sourceReference,configuredAt:definition.configuredAt,approvedProposalId:'proposal-approved-a',approvedAt:'2026-10-12T12:30:00.000Z'});
  assert.deepEqual(current,before);
  assert.equal(Object.isFrozen(result),true);
  assert.doesNotMatch(JSON.stringify(result),/manager-a|unrelated|metadata|configuredBy/);
});

test('daily delta and accumulated total produce the same exact approved candidate',() => {
  const current = task(),delta = deriveTaskMeasurement(current,{mode:'DELTA',quantity:'1.0001'}),cumulative = deriveTaskMeasurement(current,{mode:'CUMULATIVE',quantity:'3.5001'});
  assert.deepEqual(delta,{definitionId:definition.definitionId,mode:'DELTA',reported:'1.0001',previous:'2.5000',delta:'1.0001',executed:'3.5001',baseline:'10.0000',unit:'M2',remaining:'6.4999',percent:'35.0010',progress:35});
  for (const key of ['previous','delta','executed','baseline','unit','remaining','percent','progress']) assert.equal(cumulative[key],delta[key]);
  assert.equal(Object.isFrozen(delta),true);
  assert.equal(task().metadata.fieldOperations.quantity.executed,'2.5000');
});

test('browser DTO and server metadata derive identical results and reject conflicting copies',() => {
  const current = task(),measurement = publicTaskMeasurement(current),browser = {id:current.id,revision:current.revision,progress:current.progress,measurement};
  assert.deepEqual(deriveTaskMeasurement(browser,{mode:'DELTA',quantity:'0.1'}),deriveTaskMeasurement(current,{mode:'DELTA',quantity:'0.1'}));
  assert.deepEqual(publicTaskMeasurement({...current,measurement}),measurement);
  error(() => publicTaskMeasurement({...current,measurement:{...measurement,definitionId:'foreign-definition'}}),'TASK_MEASUREMENT_STATE_INVALID',409);
  error(() => publicTaskMeasurement({...current,measurement:null}),'TASK_MEASUREMENT_STATE_INVALID',409);
});

test('zero is observed only for an explicitly configured task with zero current progress',() => {
  const current = task({progress:0,quantity:false}),measurement = publicTaskMeasurement(current);
  assert.equal(measurement.executed,'0.0000');
  assert.equal(measurement.approvedProposalId,null);
  assert.equal(measurement.approvedAt,null);
  for (const quantity of ['0','0.0000']) error(() => deriveTaskMeasurement(current,{mode:'DELTA',quantity}),'TASK_MEASUREMENT_INVALID',400);
  assert.equal(deriveTaskMeasurement(current,{mode:'CUMULATIVE',quantity:'0'}).percent,'0.0000');
  assert.equal(deriveTaskMeasurement(current,{mode:'CUMULATIVE',quantity:'0'}).delta,'0.0000');
  current.progress = 30;
  error(() => publicTaskMeasurement(current),'TASK_MEASUREMENT_STATE_INVALID',409);
  error(() => assertMeasurementConfiguration(current,{baseline:'10',unit:'M2'}),'TASK_MEASUREMENT_STATE_INVALID',409);
});

test('missing definition never converts a historical percentage into quantity',() => {
  for (const progress of [0,25,100]) {
    const current = {progress,metadata:{}};
    assert.equal(publicTaskMeasurement(current),null);
    error(() => deriveTaskMeasurement(current,{mode:'DELTA',quantity:'1'}),'TASK_MEASUREMENT_NOT_CONFIGURED',409);
    if (progress) error(() => assertMeasurementConfiguration(current,{baseline:'10',unit:'M2'}),'TASK_MEASUREMENT_STATE_INVALID',409);
  }
});

test('exact arithmetic never uses floating point to add decimals or round up completion',() => {
  const current = task({executed:'0.1000',baseline:'1.0000',progress:10}),result = deriveTaskMeasurement(current,{mode:'DELTA',quantity:'0.2'});
  assert.equal(result.executed,'0.3000');assert.equal(result.percent,'30.0000');assert.equal(result.progress,30);
  const thirds = task({executed:'1.0000',baseline:'3.0000',progress:33});
  assert.equal(deriveTaskMeasurement(thirds,{mode:'CUMULATIVE',quantity:'1.0000'}).percent,'33.3333');
  const maximum = '99999999999999.9999',edge = task({executed:'99999999999999.9998',baseline:maximum,progress:99});
  const incomplete = deriveTaskMeasurement(edge,{mode:'CUMULATIVE',quantity:'99999999999999.9998'});
  assert.equal(incomplete.percent,'99.9999');assert.equal(incomplete.progress,99);assert.equal(incomplete.remaining,'0.0001');
  const complete = deriveTaskMeasurement(edge,{mode:'DELTA',quantity:'0.0001'});
  assert.equal(complete.executed,maximum);assert.equal(complete.percent,'100.0000');assert.equal(complete.progress,100);assert.equal(complete.remaining,'0.0000');
});

test('regression, excess, invalid decimals and forged derived fields are rejected without changing the task',() => {
  const current = task(),before = structuredClone(current);
  error(() => deriveTaskMeasurement(current,{mode:'CUMULATIVE',quantity:'2.4999'}),'TASK_MEASUREMENT_REGRESSION',409);
  for (const input of [{mode:'DELTA',quantity:'7.5001'},{mode:'CUMULATIVE',quantity:'10.0001'}]) error(() => deriveTaskMeasurement(current,input),'TASK_MEASUREMENT_EXCEEDS_BASELINE',400);
  for (const quantity of [1,'01','-1','+1','1e3','1,5','.5','1.','0.00001','100000000000000',' 1','1 ']) error(() => deriveTaskMeasurement(current,{mode:'DELTA',quantity}),'TASK_MEASUREMENT_INVALID',400);
  for (const input of [{mode:'UNKNOWN',quantity:'1'},{mode:'DELTA',quantity:'1',baseline:'100'},{mode:'DELTA',quantity:'1',unit:'KG'},{mode:'DELTA',quantity:'1',progress:100},{mode:'DELTA',quantity:'1',definitionId:'foreign'}]) error(() => deriveTaskMeasurement(current,input),'TASK_MEASUREMENT_INVALID',400);
  assert.deepEqual(current,before);
});

test('definition, approval source and current percentage are validated before projecting or deriving',() => {
  for (const change of [
    t => t.metadata.fieldOperations.measurement.version = 1,
    t => t.metadata.fieldOperations.measurement.baseline = '0.0000',
    t => t.metadata.fieldOperations.measurement.baseline = '20.0000',
    t => t.metadata.fieldOperations.measurement.unit = 'KG',
    t => t.metadata.fieldOperations.measurement.definitionId = '../foreign',
    t => t.metadata.fieldOperations.measurement.configuredBy = null,
    t => t.metadata.fieldOperations.measurement.configuredAt = '2026-02-30T12:00:00Z',
    t => t.metadata.fieldOperations.measurement.sourceReference = '',
    t => t.metadata.fieldOperations.measurement.extra = true,
    t => t.metadata.fieldOperations.quantity.executed = '2.5',
    t => t.metadata.fieldOperations.quantity.executed = 'broken',
    t => t.metadata.fieldOperations.quantity.executed = '10.0001',
    t => t.metadata.fieldOperations.quantity.extra = true,
    t => delete t.metadata.fieldOperations.approvedProposalId,
    t => t.metadata.fieldOperations.approvedAt = 'yesterday',
  ]) {
    const current = task();change(current);
    error(() => publicTaskMeasurement(current),'TASK_MEASUREMENT_STATE_INVALID',409);
  }
  for (const progress of [0,24,26,100]) error(() => publicTaskMeasurement({...task(),progress}),'TASK_MEASUREMENT_PROGRESS_MISMATCH',409);
  for (const progress of [-1,101,25.1,'25',NaN]) error(() => publicTaskMeasurement({...task(),progress}),'TASK_MEASUREMENT_STATE_INVALID',409);
});

test('public DTO cannot leak fields, invent positive execution or lose its approval references',() => {
  const current = task(),measurement = publicTaskMeasurement(current);
  for (const patch of [{configuredBy:'internal-actor'},{executed:'2.5'},{approvedProposalId:null},{approvedAt:null},{approvedProposalId:null,approvedAt:null},{baseline:'20.0000'},{unit:'BTC'}]) {
    const browser = {progress:current.progress,measurement:{...measurement,...patch}};
    assert.throws(() => publicTaskMeasurement(browser),TaskProgressMeasurementError);
  }
});

test('configuration normalizes allowed units and fixes base/unit for legacy approved quantities including zero',() => {
  for (const unit of MEASUREMENT_UNITS) assert.deepEqual(assertMeasurementConfiguration({progress:0,metadata:{}},{baseline:'12.3',unit}),{baseline:'12.3000',unit,executed:'0.0000'});
  const legacy = task();delete legacy.metadata.fieldOperations.measurement;
  assert.deepEqual(assertMeasurementConfiguration(legacy,{baseline:'10',unit:'M2'}),{baseline:'10.0000',unit:'M2',executed:'2.5000'});
  for (const current of [legacy,task(),task({executed:'0.0000',progress:0})]) {
    error(() => assertMeasurementConfiguration(current,{baseline:'20',unit:'M2'}),'TASK_MEASUREMENT_BASELINE_LOCKED',409);
    error(() => assertMeasurementConfiguration(current,{baseline:'10',unit:'M3'}),'TASK_MEASUREMENT_BASELINE_LOCKED',409);
  }
  const zero = task({quantity:false,progress:0});
  assert.deepEqual(assertMeasurementConfiguration(zero,{baseline:'20',unit:'M3'}),{baseline:'20.0000',unit:'M3',executed:'0.0000'});
  error(() => assertMeasurementConfiguration(legacy,{baseline:'0',unit:'M2'}),'TASK_MEASUREMENT_INVALID',400);
  error(() => assertMeasurementConfiguration(legacy,{baseline:'10',unit:'USD'}),'TASK_MEASUREMENT_INVALID',400);
  error(() => assertMeasurementConfiguration(legacy,{baseline:'10',unit:'M2',executed:'0'}),'TASK_MEASUREMENT_INVALID',400);
});

test('percentage-only historical approval does not become a quantity approval at zero',() => {
  const current = task({quantity:false,progress:0});
  current.metadata.fieldOperations.approvedProposalId = 'legacy-percent-only';
  current.metadata.fieldOperations.approvedAt = '2026-10-01T12:00:00Z';
  assert.equal(publicTaskMeasurement(current).approvedProposalId,null);
  assert.equal(publicTaskMeasurement(current).approvedAt,null);
  current.progress = 10;
  error(() => assertMeasurementConfiguration(current,{baseline:'100',unit:'M2'}),'TASK_MEASUREMENT_STATE_INVALID',409);
});

test('shared module remains browser-safe and DTO outputs contain only JSON values',() => {
  const source = readFileSync(new URL('../src/lib/task-progress-measurement.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/node:|process\.|Buffer\b|fetch\(|localStorage|sessionStorage/);
  assert.doesNotThrow(() => JSON.stringify(publicTaskMeasurement(task())));
  assert.doesNotThrow(() => JSON.stringify(deriveTaskMeasurement(task(),{mode:'DELTA',quantity:'1'})));
});
