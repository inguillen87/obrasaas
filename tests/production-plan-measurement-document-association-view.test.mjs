import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlanMeasurementDocument} from '../src/lib/plan-measurement-source.mjs';
import {planMeasurementCanAssociateExisting,confirmPlanMeasurementDocumentAssociation,planMeasurementRows,planMeasurementReviewCommand,planMeasurementReviewStatus,planMeasurementErrorMessage} from '../src/app/(identity)/cuenta/plan-measurement-view.mjs';

const context={scope:'a'.repeat(64),projectId:'project-document',operationId:'11111111-1111-4111-8111-111111111111'};
const reason='Comparación expresa con la evidencia de la página original.';
const task={id:'task-existing',title:'Trabajo ya registrado',progress:0,revision:'2026-10-16T18:00:00.000001',measurement:null};
function draft(contentType='application/pdf',codes=[null]){
 const source=normalizePlanMeasurementDocument({isMeasurement:true,truncated:false,warnings:[],rows:codes.map((code,index)=>({code,title:'Muro de la página '+(index+1),rawQuantity:'12.5',rawUnit:'m²',evidence:[{page:contentType==='application/pdf'?index+1:1,quote:'Muro 12.5 m²',location:null}],uncertainty:''}))},{sourceSha256:'b'.repeat(64),contentType});
 return {id:'draft-document',status:'READY',revision:2,measurementImport:true,source:{sha256:source.sourceSha256},sourceDigest:'c'.repeat(64),measurementSource:source,review:null};
}
function selection(value,target=task){
 return planMeasurementRows(value).map(row=>({...row,choice:'INCLUDE',mode:'EXISTING',taskId:target.id,baseline:'12.5000',unit:'M2',reason,confirmed:true,issuesAcknowledged:true,identityConfirmed:true,confirmIdentity:true,confirmReplacement:Boolean(target.measurement)}));
}
function confirmed(value,target=task){const edits=selection(value,target);for(const edit of edits)edit.documentAssociation=confirmPlanMeasurementDocumentAssociation(value,edit.sourceRowId,target);return edits;}
const command=(value,edits,tasks=[task])=>planMeasurementReviewCommand(value,edits,tasks,reason,context);

test('association conflicts explain the next review action without exposing backend codes',()=>{
 for(const code of ['PLAN_MEASUREMENT_SOURCE_IDENTITY_REQUIRED','PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED']){
  const message=planMeasurementErrorMessage({code});assert.match(message,/asociación|asociacion/);assert.match(message,/confirm/);assert.equal(message.includes(code),false);
 }
 assert.match(planMeasurementErrorMessage({code:'PLAN_MEASUREMENT_SOURCE_IDENTITY_CHANGED'}),/Conservamos tus correcciones/);
});

test('codeless document begins without any task selection or association confirmation',()=>{
 const value=draft(),before=structuredClone(value),edits=planMeasurementRows(value),edit=edits[0];
 assert.equal(planMeasurementCanAssociateExisting(value.measurementSource.rows[0],'DOCUMENT'),true);
 for(const key of ['choice','mode','taskId'])assert.equal(edit[key],'');
 assert.equal(edit.confirmIdentity,false);assert.equal(edit.documentAssociation,null);assert.equal(edit.confirmed,false);
 assert.equal(planMeasurementReviewStatus(value,edits,[task])[0].complete,false);assert.throws(()=>command(value,edits),/Elegí incluir/);assert.deepEqual(value,before);
});

for(const type of ['application/pdf','image/png','image/jpeg'])test(type+' association captures the selected task revision and exact source row without fabricating a code',()=>{
 const value=draft(type),edits=confirmed(value),proof=structuredClone(edits[0].documentAssociation),result=command(value,edits),destination=result.destinations[0];
 assert.equal(destination.mode,'EXISTING');assert.equal(destination.sourceCode,null);assert.deepEqual(destination.documentAssociation,proof);
 assert.deepEqual(Object.keys(proof).sort(),['version','mode','sourceSha256','sourceDigest','sourceRowId','taskId','taskRevision','confirmed'].sort());
 assert.equal(proof.sourceSha256,value.source.sha256);assert.equal(proof.sourceDigest,value.sourceDigest);assert.equal(proof.sourceRowId,'document:1');assert.equal(proof.taskRevision,task.revision);
 assert.equal(result.rows[0].baseline,'12.5000');assert.equal(result.destinations.some(row=>row.mode==='CREATE'),false);
 assert.notStrictEqual(destination.documentAssociation,edits[0].documentAssociation);edits[0].documentAssociation.sourceDigest='d'.repeat(64);assert.deepEqual(destination.documentAssociation,proof);
});

test('a legacy identity checkbox alone cannot authorize a codeless document association',()=>{
 const value=draft(),edits=selection(value);assert.equal(edits[0].confirmIdentity,true);assert.throws(()=>command(value,edits),/Volvé a confirmar la asociación/);assert.equal(planMeasurementReviewStatus(value,edits,[task])[0].complete,false);
});

test('each changed or malformed captured association field is rejected instead of regenerated on submission',()=>{
 for(const [key,other] of [['version',2],['mode','CODE'],['sourceSha256','d'.repeat(64)],['sourceDigest','d'.repeat(64)],['sourceRowId','document:2'],['taskId','task-other'],['taskRevision','2026-10-16T18:00:00.000002'],['confirmed',false],['confirmed','true'],['extra','untrusted']]){
  const value=draft(),edits=confirmed(value);edits[0].documentAssociation[key]=other;const before=structuredClone(edits);
  assert.throws(()=>command(value,edits),/Volvé a confirmar la asociación/,key);assert.deepEqual(edits,before);
 }
});

test('new source bytes, source digest, task selection or task revision require another explicit confirmation',()=>{
 for(const mutate of [(value)=>{value.source.sha256='d'.repeat(64);value.measurementSource.sourceSha256='d'.repeat(64);},value=>{value.sourceDigest='d'.repeat(64);},(value,edits,tasks)=>{tasks[0].revision='2026-10-16T18:00:00.000002';},(value,edits,tasks)=>{tasks[0].id='task-other';edits[0].taskId='task-other';}]){
  const value=draft(),edits=confirmed(value),tasks=[structuredClone(task)];mutate(value,edits,tasks);const before=structuredClone(edits[0].documentAssociation);
  assert.throws(()=>command(value,edits,tasks),/Volvé a confirmar la asociación/);assert.deepEqual(edits[0].documentAssociation,before);
  edits[0].documentAssociation=confirmPlanMeasurementDocumentAssociation(value,edits[0].sourceRowId,tasks[0]);assert.equal(command(value,edits,tasks).destinations[0].taskId,tasks[0].id);
 }
});

test('missing, empty and Excel codes do not use the DOCUMENT-only association path',()=>{
 for(const [format,code] of [['DOCUMENT',undefined],['DOCUMENT',''],['COTIZACION_PARTIDAS',null],['CYP_PARTIDAS',null]]){
  const value=draft();value.measurementSource.format=format;value.measurementSource.rows[0].code=code;
  assert.equal(planMeasurementCanAssociateExisting(value.measurementSource.rows[0],format),false);
  assert.throws(()=>confirmPlanMeasurementDocumentAssociation(value,'document:1',task),/Consultá la fuente/);assert.throws(()=>command(value,selection(value)),/código/);
 }
});

test('coded DOCUMENT destinations retain the nine-key historical contract with no association proof',()=>{
 const value=draft('application/pdf',['M.1']),edits=selection(value),result=command(value,edits),destination=result.destinations[0];
 assert.equal(destination.sourceCode,'M.1');assert.equal(Object.hasOwn(destination,'documentAssociation'),false);assert.equal(Object.keys(destination).length,9);
 assert.throws(()=>confirmPlanMeasurementDocumentAssociation(value,'document:1',task),/Consultá la fuente/);
});

test('different codeless rows still cannot select the same task',()=>{
 const value=draft('application/pdf',[null,null]),edits=confirmed(value);assert.throws(()=>command(value,edits),/tarea distinta/);
 const status=planMeasurementReviewStatus(value,edits,[task]);assert.equal(status[0].complete,true);assert.equal(status[1].complete,false);
});

test('association proof does not unlock a task with approved measurement, progress or a missing replacement confirmation',()=>{
 for(const target of [{...task,progress:20},{...task,measurement:{definitionId:'definition-existing',baseline:'12.5000',unit:'M2',executed:'0.0000',approvedProposalId:'proposal-sealed'}},{...task,measurement:{definitionId:'definition-existing',baseline:'12.5000',unit:'M2',executed:'1.0000',approvedProposalId:null}}])assert.throws(()=>command(draft(),confirmed(draft(),target),[target]),/avance o metrado aprobado/);
 const value=draft(),target={...task,measurement:{definitionId:'definition-existing',baseline:'12.5000',unit:'M2',executed:'0.0000',approvedProposalId:null}},edits=confirmed(value,target);edits[0].confirmReplacement=false;
 assert.throws(()=>command(value,edits,[target]),/reemplazo/);
});

test('loading a saved review copies its captured proof without changing its historical task revision',()=>{
 const value=draft(),result=command(value,confirmed(value));value.review={rows:result.rows,destinations:result.destinations,excludedSourceRowIds:[],excludedRows:[],reason};
 const edits=planMeasurementRows(value);assert.deepEqual(edits[0].documentAssociation,result.destinations[0].documentAssociation);assert.notStrictEqual(edits[0].documentAssociation,result.destinations[0].documentAssociation);
 const tasks=[{...task,revision:'2026-10-16T18:00:01.000001'}];assert.equal(planMeasurementReviewStatus(value,edits,tasks)[0].complete,false);assert.throws(()=>command(value,edits,tasks),/Volvé a confirmar la asociación/);
});
