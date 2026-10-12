import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TASK_MEASUREMENT_VERSION} from '../src/lib/task-progress-measurement.js';
import {createVoiceProgressDraft} from '../src/lib/voice-progress-draft.mjs';
import {taskMeasurementView,measurementProposalPreview,measurementProposalPayload,measurementConfirmation,measurementConfirmationMatches,prepareMeasuredVoiceProgress,measurementConfigurationCommand,measurementConfigurationResult,configurationFailureRetainsAttempt} from '../src/app/(identity)/cuenta/task-progress-measurement-view.mjs';

const scope='a'.repeat(64),projectId='synthetic-project',operationId='12345678-1234-4123-8123-123456789012',revision='2026-10-12T10:00:00.000001';
const task={id:'synthetic-task',title:'Revoque sintético',revision,progress:15,measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'synthetic-definition',baseline:'200.0000',unit:'M2',executed:'30.0000',sourceReference:'Relevamiento sintético revisado',configuredAt:'2026-10-12T09:00:00.000Z',approvedProposalId:'synthetic-proposal',approvedAt:'2026-10-12T09:30:00.000Z'}};
const input={workerId:'synthetic-worker',taskId:task.id,mode:'DELTA',quantity:'50',reason:'Cantidad medida y revisada en el sector sintético.',evidenceIds:['synthetic-evidence']};
const reference={scope,projectId,taskId:task.id,operationId,revision};
function evidence(transcript,patch={}){
 const mediaSha256='b'.repeat(64),evidenceRevision='2026-10-12T10:00:00.000002',transcriptSha256=createHash('sha256').update(transcript).digest('hex');
 return {id:'synthetic-evidence',taskId:task.id,revision:evidenceRevision,status:'APPROVED',media:{kind:'audio',sha256:mediaSha256},processing:{status:'TRANSCRIBED_UNREVIEWED',result:{text:transcript,progressDraft:createVoiceProgressDraft({transcript,evidenceId:'synthetic-evidence',evidenceRevision,mediaSha256,transcriptSha256,task})}},...patch};
}
test('approved task quantities are displayed separately from absence and unconfirmed data',()=>{
 assert.equal(taskMeasurementView(task).label,'30 / 200 m²');assert.equal(taskMeasurementView(task).remaining,'170.0000');
 assert.equal(taskMeasurementView({...task,measurement:null}).state,'UNCONFIGURED');assert.equal(taskMeasurementView({progress:35}).state,'UNCONFIGURED');
 for(const patch of [{executed:'1e3'},{executed:'40.0000'},{approvedAt:null},{configuredBy:'private-actor'},{baseline:'0.0000'},{sourceReference:'<source>'}])assert.equal(taskMeasurementView({...task,measurement:{...task.measurement,...patch}}).state,'UNCONFIRMED');
});
test('daily and cumulative previews derive quantities without changing the approved task',()=>{
 const saved=structuredClone(task),daily=measurementProposalPreview(task,input),cumulative=measurementProposalPreview(task,{mode:'CUMULATIVE',quantity:'80,25'});
 assert.deepEqual([daily.previous,daily.delta,daily.executed,daily.percent,daily.progress],['30.0000','50.0000','80.0000','40.0000',40]);
 assert.deepEqual([cumulative.delta,cumulative.executed,cumulative.percent],['50.2500','80.2500','40.1250']);assert.deepEqual(task,saved);
 for(const value of [{mode:'',quantity:'50'},{mode:'DELTA',quantity:'0'},{mode:'DELTA',quantity:'171'},{mode:'CUMULATIVE',quantity:'29'},{mode:'DELTA',quantity:'1e3'}])assert.equal(measurementProposalPreview(task,value).ready,false);
});
test('review confirmation is bound to task revision, definition and computed previous amount',()=>{
 const review=measurementConfirmation(task,input);assert.equal(measurementConfirmationMatches(review,task,input),true);
 for(const changed of [{...task,id:'other-task'},{...task,revision:'2026-10-12T10:00:00.000003'},{...task,measurement:{...task.measurement,definitionId:'other-definition'}},{...task,progress:20,measurement:{...task.measurement,executed:'40.0000'}}])assert.equal(measurementConfirmationMatches(review,changed,input),false);
 assert.equal(measurementConfirmationMatches(review,task,{...input,quantity:'51'}),false);assert.equal(measurementConfirmationMatches({...review,extra:true},task,input),false);
});
test('a confirmed measured command contains only reported quantity and scope, never client base or percent',()=>{
 const payload=measurementProposalPayload(task,input,true);
 assert.deepEqual(payload,{workerId:input.workerId,taskId:task.id,revision,measurement:{mode:'DELTA',quantity:'50.0000'},reason:input.reason,evidenceIds:input.evidenceIds});
 assert.equal(Object.hasOwn(payload,'progress'),false);assert.equal(Object.hasOwn(payload,'baseline'),false);assert.equal(Object.hasOwn(payload,'unit'),false);
 assert.throws(()=>measurementProposalPayload(task,input,false));for(const patch of [{reason:'short'},{evidenceIds:[]},{evidenceIds:['synthetic-evidence','synthetic-evidence']}])assert.throws(()=>measurementProposalPayload(task,{...input,...patch},true));
});
test('approved audio is only a reference and both measurement inputs require explicit manual entry',()=>{
 const daily=prepareMeasuredVoiceProgress(evidence('Hoy completamos 50 m2 de revoque.'),task,input.workerId);assert.equal(daily.payload.mode,'');assert.equal(daily.payload.quantity,'');assert.equal(daily.sourceVoice.confirmed,false);
 const accumulated=prepareMeasuredVoiceProgress(evidence('Completamos en total 80 m2 de revoque.'),task,input.workerId);assert.equal(accumulated.payload.mode,'');assert.equal(accumulated.payload.quantity,'');
 const unknown=prepareMeasuredVoiceProgress(evidence('Completamos 50 m2 de revoque.'),task,input.workerId);assert.equal(unknown.payload.mode,'');assert.equal(unknown.payload.quantity,'');
 const wrongUnit=prepareMeasuredVoiceProgress(evidence('Hoy colocamos 120 unidades de mampostería.'),task,input.workerId);assert.equal(wrongUnit.payload.quantity,'');assert.equal(wrongUnit.payload.mode,'');assert.equal(wrongUnit.unitMismatch,true);
 assert.throws(()=>prepareMeasuredVoiceProgress(evidence('Hoy completamos 50 m2 de revoque.',{status:'PENDING'}),task,input.workerId));
});
test('configuration requires actual boolean authority and explicit reviewed source',()=>{
 const fields={baseline:'200',unit:'M2',sourceReference:'Plano sintético revisado',reason:'Base comprobada por responsable sintético.'},options={scope,projectId,operationId,confirmed:true,allowed:true};
 const command=measurementConfigurationCommand(task,fields,options);assert.equal(command.action,'CONFIGURE_PROGRESS_MEASUREMENT');assert.deepEqual(Object.keys(command.payload).sort(),['baseline','reason','revision','sourceReference','taskId','unit']);assert.equal(command.payload.baseline,'200.0000');
 for(const change of [{allowed:false},{allowed:'ADMIN'},{confirmed:false},{scope:'foreign'},{operationId:'invalid'}])assert.throws(()=>measurementConfigurationCommand(task,fields,{...options,...change}));
 for(const patch of [{baseline:'0'},{sourceReference:'ab'},{unit:'ladrillos'},{reason:'short'}])assert.throws(()=>measurementConfigurationCommand(task,{...fields,...patch},options));
});
test('receipt validation rejects foreign contexts, unrelated action and unsupported payment-style claims',()=>{
 const result={scope,projectId,operationId,action:'CONFIGURE_PROGRESS_MEASUREMENT',state:'RECORDED',saved:true,receiptId:'field_'+'c'.repeat(64),kind:'MEASUREMENT_CONFIGURATION',task};
 assert.equal(measurementConfigurationResult(result,reference).state,'RECORDED');
 for(const patch of [{scope:'d'.repeat(64)},{projectId:'foreign-project'},{operationId:'22345678-1234-4123-8123-123456789012'},{action:'DECIDE_PROGRESS'},{state:'AUTHORIZED'},{saved:false},{task:{...task,id:'foreign-task'}},{task:{...task,measurement:null}}])assert.throws(()=>measurementConfigurationResult({...result,...patch},reference));
 const updated={...task,revision:'2026-10-12T10:00:00.000005',progress:40,measurement:{...task.measurement,executed:'80.0000'}};const recovered=measurementConfigurationResult({...result,task:updated,configuredTaskSnapshot:task},reference);assert.equal(recovered.task.measurement.executed,'80.0000');assert.equal(recovered.recordedTask.measurement.executed,'30.0000');
});
test('a missing receipt is pending and cannot settle or authorize another configuration',()=>{
 const pending={scope,state:'NOT_OBSERVED',definitive:false};assert.deepEqual(measurementConfigurationResult(pending,reference),{state:'PENDING'});
 for(const patch of [{scope:'d'.repeat(64)},{projectId:'foreign-project'},{saved:true},{receiptId:'field_'+'c'.repeat(64)},{definitive:true}])assert.throws(()=>measurementConfigurationResult({...pending,...patch},reference));
});
test('only an exact durable cancellation proves no task effect, independently of missing reads',()=>{
 const value={scope,projectId,operationId,action:'CONFIGURE_PROGRESS_MEASUREMENT',state:'CANCELLED',saved:false,replayed:false,receiptId:'field_'+'c'.repeat(64),kind:'MEASUREMENT_CONFIGURATION_CANCELLED',taskId:task.id,taskProgressUnchanged:true};
 assert.equal(measurementConfigurationResult(value,reference).state,'CANCELLED');
 for(const patch of [{taskId:'foreign-task'},{saved:true},{replayed:'false'},{taskProgressUnchanged:false},{action:'CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION'},{task},{receiptId:null}])assert.throws(()=>measurementConfigurationResult({...value,...patch},reference));
});
test('a failed receipt read or cancellation never releases the original configuration attempt',()=>{
 for(const error of [{requestDispatched:false},{status:403},{status:400,definitiveConfigurationRejection:true}]){
  assert.equal(configurationFailureRetainsAttempt({method:'GET',action:undefined,existingAttempt:true},error),true);
  assert.equal(configurationFailureRetainsAttempt({method:'POST',action:'CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION',existingAttempt:true},error),true);
 }
 assert.equal(configurationFailureRetainsAttempt({method:'POST',action:'CONFIGURE_PROGRESS_MEASUREMENT',existingAttempt:false},{requestDispatched:false}),false);
 assert.equal(configurationFailureRetainsAttempt({method:'POST',action:'CONFIGURE_PROGRESS_MEASUREMENT',existingAttempt:true},{requestDispatched:false}),true);
});
