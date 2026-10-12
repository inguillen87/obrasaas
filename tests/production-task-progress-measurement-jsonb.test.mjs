import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMeasuredProposalSnapshot} from '../src/lib/field-operations-store.mjs';
import {deriveTaskMeasurement,TASK_MEASUREMENT_VERSION} from '../src/lib/task-progress-measurement.js';
const task={progress:0,metadata:{fieldOperations:{version:1,measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'definition-synthetic',baseline:'200.0000',unit:'M2',sourceReference:'Synthetic reviewed source',configuredBy:'actor-synthetic',configuredAt:'2026-10-12T12:00:00.000Z'}}}};
const measurement=deriveTaskMeasurement(task,{mode:'DELTA',quantity:'50'}),action={measurement,progress:measurement.progress,quantity:measurement.executed,baseline:measurement.baseline,unit:measurement.unit};
test('reordered PostgreSQL JSONB measurement facts still permit the exact independent decision',()=>{
 const decoded=JSON.parse(JSON.stringify({...action,measurement:Object.fromEntries(Object.entries(measurement).reverse())}));
 assert.deepEqual(decoded.measurement,measurement);assert.doesNotThrow(()=>assertMeasuredProposalSnapshot(task,decoded));
});
test('order-independent checking still rejects altered, missing or extra measurement facts',()=>{
 const {remaining,...missing}=measurement;
 for(const candidate of [{...measurement,previous:'1.0000'},{...measurement,definitionId:'other-definition'},{...measurement,percent:'99.0000'},{...measurement,extra:'untrusted'},missing])assert.throws(()=>assertMeasuredProposalSnapshot(task,{...action,measurement:candidate}),{code:'FIELD_MEASUREMENT_CHANGED'});
 for(const update of [{progress:100},{quantity:'150.0000'},{baseline:'999.0000'},{unit:'M3'}])assert.throws(()=>assertMeasuredProposalSnapshot(task,{...action,...update}),{code:'FIELD_MEASUREMENT_CHANGED'});
 assert.equal(remaining,'150.0000');
});
