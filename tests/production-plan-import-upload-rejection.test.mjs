import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PLAN_IMPORT_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {createWorkspaceRecoveryJournal,recoveryResult,recoveryQuery,planImportUploadDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';

const scope='a'.repeat(64),projectId='plan-project',operationId='01234567-89ab-4cde-8fab-0123456789ab',secondId='01234567-89ab-4cde-8fab-0123456789ac',endpoint='/api/identity/plan-import';
const bytes=Buffer.from('%PDF-1.7\nPrivate source content\n%%EOF'),source={bytes:bytes.length,contentType:'application/pdf',sha256:createHash('sha256').update(bytes).digest('hex')};
const upload=patch=>({scope,projectId,operationId,consent:PLAN_IMPORT_CONSENT,source,...patch});
const expectedDigest=input=>createHash('sha256').update(JSON.stringify(['plan-import-upload-command-v1',{action:'UPLOAD',consent:input.consent,operationId:input.operationId.toLowerCase(),projectId:input.projectId,scope:input.scope,source:{bytes:input.source.bytes,contentType:input.source.contentType,sha256:input.source.sha256}}])).digest('hex');
function command(patch={},fileBytes=bytes,type='application/pdf',name='private-source-name.pdf'){
 const form=new FormData();for(const [key,value] of Object.entries({scope,projectId,operationId,consent:PLAN_IMPORT_CONSENT,...patch}))form.set(key,value);
 form.set('file',new Blob([fileBytes],{type}),name);return {method:'POST',body:form};
}
function storage(initial=[]){const data=new Map(initial);return {get length(){return data.size;},key:index=>[...data.keys()][index]??null,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};}
const journal=store=>createWorkspaceRecoveryJournal({getStorage:()=>store,now:()=>123});
const receipt=(patch={})=>({scope,projectId,operationId,state:'REJECTED',saved:false,definitive:true,reservationStarted:false,phase:'PRE_RESERVATION',proof:'AUDITED_UPLOAD',taskEffects:false,action:'UPLOAD',code:'PLAN_IMPORT_SOURCE_ALREADY_APPLIED',receiptId:'plan_receipt_'+'b'.repeat(64),inputDigest:expectedDigest(upload()),recordedAt:'2026-10-07T00:00:00.000Z',replayed:true,taskSnapshots:[],tasks:[],...patch});
const referenceKeys=['version','resource','scope','projectId','operationId','createdAt','action','inputDigest'].sort();

test('UPLOAD reference has exactly eight keys and an independent canonical digest without private bytes or filename',async()=>{
 const store=storage(),ticket=await journal(store).prepare(endpoint,command());
 assert.deepEqual(Object.keys(ticket.entry).sort(),referenceKeys);assert.equal(ticket.entry.action,'UPLOAD');assert.equal(ticket.entry.inputDigest,expectedDigest(upload()));
 assert.equal(await planImportUploadDigest(upload()),expectedDigest(upload()));
 assert.doesNotMatch(JSON.stringify([...store.data.values()]),/Private source content|private-source-name|application\/pdf|plan-document-openai|file|contentType|sha256|consent|bytes|name/);
 const upper=upload({operationId:operationId.toUpperCase()});assert.equal(await planImportUploadDigest(upper),ticket.entry.inputDigest);
 assert.equal((await journal(storage()).prepare(endpoint,command({},bytes,'application/pdf','another-private-name.pdf'))).entry.inputDigest,ticket.entry.inputDigest);
});

test('UPLOAD digest binds UUID project scope consent MIME byte count and source hash',async()=>{
 const original=await planImportUploadDigest(upload());
 const changes=[{operationId:secondId},{projectId:'other-project'},{scope:'c'.repeat(64)},{source:{...source,contentType:'image/png'}},{source:{...source,bytes:source.bytes+1}},{source:{...source,sha256:'d'.repeat(64)}}];
 for(const patch of changes)assert.notEqual(await planImportUploadDigest(upload(patch)),original);
 assert.notEqual(expectedDigest(upload({consent:PLAN_IMPORT_CONSENT+'-different'})),original);await assert.rejects(planImportUploadDigest(upload({consent:PLAN_IMPORT_CONSENT+'-different'})),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE',requestDispatched:false});
});

test('same UPLOAD UUID and same source reuses reference but changed bytes or MIME refuses dispatch',async()=>{
 const j=journal(storage()),ticket=await j.prepare(endpoint,command()),same=await j.prepare(endpoint,command({},bytes,'application/pdf','renamed.pdf'));
 assert.equal(same.existed,true);assert.deepEqual(same.entry,ticket.entry);
 for(const options of [command({},Buffer.from('%PDF-1.7\nOther private content\n%%EOF')),command({},bytes,'image/png')])await assert.rejects(j.prepare(endpoint,options),{code:'WORKSPACE_RECOVERY_CONFLICT',requestDispatched:false});
 assert.equal((await j.list(scope)).length,1);
});

test('lost terminal UPLOAD ACK survives reload and exact audited GET releases only its own reference',async()=>{
 for(const code of ['PLAN_IMPORT_SOURCE_ALREADY_APPLIED','PLAN_IMPORT_SCHEDULE_TOO_LARGE']){
  const store=storage(),j=journal(store),ticket=await j.prepare(endpoint,command()),other=await j.prepare(endpoint,command({projectId:'other-project',operationId:secondId}));
  await j.settle(ticket,null,{status:503,code:'PLAN_IMPORT_UNCONFIRMED'});const restored=journal(store),entry=(await restored.list(scope)).find(item=>item.projectId===projectId),result=receipt({code});
  assert.equal(recoveryResult(entry,result).state,'REJECTED');await restored.observe(recoveryQuery(entry),result);assert.deepEqual(await restored.list(scope),[other.entry]);
  assert.ok(await restored.prepare(endpoint,command({operationId:'01234567-89ab-4cde-8fab-0123456789ad'})));
 }
});

test('audited same UUID terminal replay settles an existing UPLOAD ticket without reporting application',async()=>{
 const j=journal(storage());await j.prepare(endpoint,command());const ticket=await j.prepare(endpoint,command());assert.equal(ticket.existed,true);
 const result=receipt();assert.equal(recoveryResult(ticket.entry,result).state,'REJECTED');assert.equal(result.saved,false);await j.settle(ticket,result);assert.equal((await j.list(scope)).length,0);
});

test('malformed or foreign audited UPLOAD proofs retain the pending reference',async()=>{
 const patches=[{scope:'c'.repeat(64)},{projectId:'other-project'},{operationId:secondId},{action:'APPLY'},{inputDigest:'d'.repeat(64)},{receiptId:'receipt-fake'},{proof:undefined},{proof:'CLIENT_CLAIM'},{phase:'PRE_DECISION'},{reservationStarted:true},{taskEffects:true},{definitive:false},{saved:true},{code:'PLAN_IMPORT_UNCONFIRMED'},{tasks:[{id:'task-fake'}]},{taskSnapshots:[{id:'task-fake'}]},{recordedAt:'invalid'},{recordedAt:'2026-02-30T00:00:00.000Z'},{replayed:undefined},{draft:{id:'draft-fake'}},{file:'private'},{source:'private'},{unexpected:'private'}];
 for(const patch of patches){const j=journal(storage()),ticket=await j.prepare(endpoint,command()),result=receipt(patch);assert.equal(recoveryResult(ticket.entry,result),null);await j.settle(ticket,result);await j.observe(recoveryQuery(ticket.entry),result);assert.equal((await j.list(scope)).length,1);}
});

test('NOT_OBSERVED denied reads bare error codes and draft GET cannot clear a terminal UPLOAD reference',async()=>{
 const j=journal(storage()),ticket=await j.prepare(endpoint,command());
 for(const status of [400,403,409,413,503]){await j.settle(ticket,null,{status,code:'PLAN_IMPORT_SOURCE_ALREADY_APPLIED'});assert.equal((await j.list(scope)).length,1);}
 await j.observe(recoveryQuery(ticket.entry),{scope,projectId,state:'NOT_OBSERVED',definitive:false});
 await j.observe(endpoint+'?'+new URLSearchParams({scope,projectId,draftId:'draft-plan'}),receipt());assert.equal((await j.list(scope)).length,1);
});

test('legacy six-key upload references cannot claim an uncorrelated audited rejection',async()=>{
 const key='obrasaas-plan-attempt-v1:'+scope+':'+projectId,legacy=storage([[key,JSON.stringify({scope,projectId,operationId,kind:'UPLOAD'})]]),store=storage(),j=journal(store);
 await j.migratePlanImportAttempt(scope,projectId,legacy);const entry=(await j.list(scope))[0];assert.equal(Object.keys(entry).length,6);assert.equal(recoveryResult(entry,receipt()),null);
 await j.observe(recoveryQuery(entry),receipt());assert.equal((await j.list(scope)).length,1);
});

test('old failed and applied draft snapshots still settle a digest-bound UPLOAD reference',async()=>{
 for(const status of ['FAILED','READY','APPLIED']){
  const j=journal(storage()),ticket=await j.prepare(endpoint,command());
  const result={scope,projectId,state:'RECORDED',draft:{id:'draft-plan',status,revision:3,rows:[],sourceAvailable:status!=='FAILED',processingExpired:false,source}};
  assert.equal(recoveryResult(ticket.entry,result).state,'RECORDED');await j.observe(recoveryQuery(ticket.entry),result);assert.equal((await j.list(scope)).length,0);
 }
});

test('valid source parser rejection remains live-only and cannot substitute for an audited receipt after reload',async()=>{
 const rejection={scope,projectId,operationId,state:'REJECTED',saved:false,definitive:true,reservationStarted:false,phase:'PRE_RESERVATION',code:'PLAN_IMPORT_FILE_INVALID'};
 const fresh=journal(storage()),ticket=await fresh.prepare(endpoint,command());await fresh.settle(ticket,null,{status:400,code:rejection.code,result:rejection});assert.equal((await fresh.list(scope)).length,0);
 const store=storage(),j=journal(store);await j.prepare(endpoint,command());const restored=journal(store),existing=await restored.prepare(endpoint,command());assert.equal(existing.existed,true);
 await restored.settle(existing,null,{status:400,code:rejection.code,result:rejection});await restored.observe(recoveryQuery(existing.entry),rejection);assert.equal((await restored.list(scope)).length,1);
});
