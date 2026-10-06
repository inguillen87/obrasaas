import test from 'node:test';
import assert from 'node:assert/strict';
import {PROGRESS_TEMPLATE_SEND_KEY,templateSendSnapshot,templateSendResult,templateSendNotice} from '../src/app/(identity)/cuenta/template-send-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryResult,validateWorkspaceRecoveryStoredEntry} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const command={scope:'a'.repeat(64),projectId:'p-a',operationId:'01234567-89ab-4cde-8fab-0123456789ab',workerId:'worker-a',templateKey:'open_attendance_reminder'};
const context={projectId:command.projectId,scope:command.scope};
const receipt={id:'template-receipt-a',operationId:command.operationId,workerId:command.workerId,templateKey:command.templateKey};
const result=extra=>({...context,receipt,state:'ACCEPTED',saved:true,definitive:true,providerAccepted:true,providerStatus:null,deliveryConfirmed:false,...extra});
const snapshot=()=>({...context,projectName:'Obra sintética',canSend:true,template:{key:command.templateKey,title:'Jornada abierta',bodyText:'Tu jornada sigue abierta.',canSend:true,providerStatus:'APPROVED'},records:[{workerId:'worker-a',name:'Trabajador de ensayo',eligible:true}]});
test('snapshot rejects foreign project/scope, duplicate recipient and unsupported template',()=>{for(const value of [{...snapshot(),projectId:'p-b'},{...snapshot(),scope:'b'.repeat(64)},{...snapshot(),records:[...snapshot().records,...snapshot().records]},{...snapshot(),template:{...snapshot().template,key:'participant_invitation'}}])assert.throws(()=>templateSendSnapshot(value,context));assert.equal(templateSendSnapshot(snapshot(),context).records.length,1);});
test('accepted dispatch is explicit and is never interpreted as delivery or attendance',()=>{const value=templateSendResult(result(),command);assert.equal(value.deliveryConfirmed,false);assert.match(templateSendNotice(value),/aceptó.*entrega todavía no está confirmada/);assert.match(templateSendNotice(value),/no registra la salida/);assert.throws(()=>templateSendResult(result({deliveryConfirmed:true}),command));});
test('receipt attribution requires exact operation, recipient, template and project',()=>{for(const changed of [{operationId:'01234567-89ab-4cde-8fab-0123456789ac'},{workerId:'worker-b'},{templateKey:'field_evidence_request'},{id:''}])assert.throws(()=>templateSendResult(result({receipt:{...receipt,...changed}}),command));assert.throws(()=>templateSendResult(result({projectId:'p-b'}),command));});
test('unknown and missing outcomes stay uncertain without fabricated confirmation',()=>{for(const state of ['SEND_STARTED','SEND_UNKNOWN']){const value=templateSendResult(result({state,saved:false,definitive:false,providerAccepted:false}),command);assert.match(templateSendNotice(value),/sin confirmar/);assert.throws(()=>templateSendResult({...value,definitive:true},command));}const absent=templateSendResult({...context,state:'NOT_OBSERVED',definitive:false,providerAccepted:false,deliveryConfirmed:false},command);assert.match(templateSendNotice(absent),/no se genera otro envío/);assert.throws(()=>templateSendResult({...absent,definitive:true},command));});
test('signed delivery and failed statuses retain distinct user-facing results',()=>{for(const status of ['sent','delivered','read','failed','deleted']){const value=templateSendResult(result({state:'STATUS_OBSERVED',providerStatus:status,deliveryConfirmed:['delivered','read'].includes(status)}),command);if(['failed','deleted'].includes(status))assert.match(templateSendNotice(value),/falló o fue eliminado/);if(status==='read')assert.match(templateSendNotice(value),/lectura/);if(status==='delivered')assert.match(templateSendNotice(value),/entrega del mensaje/);}assert.throws(()=>templateSendResult(result({state:'STATUS_OBSERVED',providerStatus:'sent',deliveryConfirmed:true}),command));assert.throws(()=>templateSendResult(result({state:'STATUS_OBSERVED',providerStatus:'imaginary'}),command));});
test('definitive local stop and provider rejection have different messages',()=>{const value=templateSendResult(result({state:'REJECTED',saved:false,providerAccepted:false}),command);assert.match(templateSendNotice(value),/Se detuvo/);assert.match(templateSendNotice({...value,code:'META_CUSTOMER_PROVIDER_REJECTED'}),/Meta rechazó/);assert.throws(()=>templateSendResult({...value,saved:true},command));assert.throws(()=>templateSendResult({...value,providerAccepted:true},command));});
test('malformed POST or recovery result is rejected before a durable reference can be removed',async()=>{
 for(const method of ['POST','GET']){
  const rows=new Map(),storage={get length(){return rows.size;},key:index=>[...rows.keys()][index],getItem:key=>rows.get(key),setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
  const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage});await journal.prepare('/api/identity/template-send',{method:'POST',body:JSON.stringify(command)});
  const transport=createWorkspaceRequestLifecycle(async()=>'controlled',{journal,fetchImpl:async()=>Response.json(result({receipt:{...receipt,workerId:'worker-b'}}))});
  const url='/api/identity/template-send'+(method==='GET'?'?'+new URLSearchParams({projectId:command.projectId,scope:command.scope,operationId:command.operationId}):'');
  await assert.rejects(transport.request(url,{method,...(method==='POST'?{body:JSON.stringify(command)}:{})},async response=>templateSendResult(await response.json(),command)));
  assert.equal((await journal.list(command.scope)).length,1);transport.abort();
 }
});

test('changed company notice is a definite local stop with actionable renewal and no provider rejection claim',()=>{const value=templateSendResult(result({state:'REJECTED',saved:false,providerAccepted:false,code:'WORKER_TEMPLATE_CONSENT_NOTICE_CHANGED'}),command);assert.match(templateSendNotice(value),/No se envió/);assert.match(templateSendNotice(value),/aceptar el aviso actualizado de la empresa/);assert.doesNotMatch(templateSendNotice(value),/Meta rechazó/);});

const actionReference={proposalId:'proposal-a',revision:'2026-10-06T03:00:00.123456'};
const progressCommand={...command,templateKey:PROGRESS_TEMPLATE_SEND_KEY,actionReference};
const progressResult=extra=>result({receipt:{...receipt,templateKey:PROGRESS_TEMPLATE_SEND_KEY,actionReference},...extra});
const progressSnapshot=()=>({...snapshot(),template:{...snapshot().template,key:PROGRESS_TEMPLATE_SEND_KEY,title:'Avance por revisar'},proposals:[{...actionReference,title:'Hormigonado del sector norte',eligibleWorkerIds:['worker-a']}]});
const progressContext={...context,templateKey:PROGRESS_TEMPLATE_SEND_KEY};
test('progress snapshot requires an exact type, bounded canonical proposals and eligible reviewer references',()=>{
 assert.equal(templateSendSnapshot(progressSnapshot(),progressContext).proposals[0].revision,actionReference.revision);
 assert.throws(()=>templateSendSnapshot(progressSnapshot(),context));
 for(const proposals of [undefined,Array.from({length:21},(_,index)=>({...progressSnapshot().proposals[0],proposalId:'proposal-'+index})),[...progressSnapshot().proposals,...progressSnapshot().proposals],[{...progressSnapshot().proposals[0],revision:'2026-10-06T03:00:00Z'}],[{...progressSnapshot().proposals[0],eligibleWorkerIds:['foreign-worker']}],[{...progressSnapshot().proposals[0],eligibleWorkerIds:['worker-a','worker-a']}]])assert.throws(()=>templateSendSnapshot({...progressSnapshot(),proposals},progressContext));
 assert.throws(()=>templateSendSnapshot({...progressSnapshot(),records:[{workerId:'worker-a',name:'Revisor no habilitado',eligible:false}]},progressContext));
 assert.throws(()=>templateSendSnapshot({...progressSnapshot(),recent:[result()]},progressContext));
 assert.equal(templateSendSnapshot({...progressSnapshot(),recent:[progressResult()]},progressContext).recent.length,1);
});
test('progress receipt cannot mix a recipient, proposal, revision, extra reference fields or template',()=>{
 assert.equal(templateSendResult(progressResult(),progressCommand).state,'ACCEPTED');
 for(const changed of [{templateKey:command.templateKey},{workerId:'worker-b'},{actionReference:{...actionReference,proposalId:'proposal-b'}},{actionReference:{...actionReference,revision:'2026-10-06T03:00:01.123456'}},{actionReference:{...actionReference,phone:'private'}},{actionReference:null}])assert.throws(()=>templateSendResult(progressResult({receipt:{...progressResult().receipt,...changed}}),progressCommand));
 assert.throws(()=>templateSendResult(progressResult(),command));
 assert.throws(()=>templateSendResult(result({receipt:{...receipt,actionReference}}),command));
});
test('progress delivery remains separate from proposal approval and Task/Gantt changes',()=>{
 for(const value of [progressResult(),progressResult({state:'STATUS_OBSERVED',providerStatus:'delivered',deliveryConfirmed:true}),progressResult({state:'STATUS_OBSERVED',providerStatus:'read',deliveryConfirmed:true})]){
  templateSendResult(value,progressCommand);assert.match(templateSendNotice(value),/no aprueba la propuesta ni modifica tareas o el Gantt/);assert.doesNotMatch(templateSendNotice(value),/jornada|registra la salida/);
 }
 assert.match(templateSendNotice(progressResult({state:'REJECTED',saved:false,providerAccepted:false})),/propuesta pendiente.*revisor/);
});
test('progress recovery stores only immutable receipt attribution and rejects changed same-operation subjects',async()=>{
 const rows=new Map(),storage={get length(){return rows.size;},key:index=>[...rows.keys()][index],getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123});
 const ticket=await journal.prepare('/api/identity/template-send',{method:'POST',body:JSON.stringify({...progressCommand,privatePhone:'+541100000000',privateMessage:'private message',token:'private token'})});
 assert.deepEqual(Object.keys(ticket.entry).sort(),['actionReference','createdAt','operationId','projectId','resource','scope','templateKey','version','workerId']);
 assert.deepEqual(ticket.entry.actionReference,actionReference);assert.doesNotMatch([...rows.values()].join(''),/private|\+5411/);
 const second=createWorkspaceRecoveryJournal({getStorage:()=>storage});assert.deepEqual((await second.list(command.scope))[0],ticket.entry);
 await assert.rejects(journal.prepare('/api/identity/template-send',{method:'POST',body:JSON.stringify({...progressCommand,actionReference:{...actionReference,revision:'2026-10-06T03:00:01.123456'}})}),{code:'WORKSPACE_RECOVERY_CONFLICT'});
 await assert.rejects(journal.prepare('/api/identity/template-send',{method:'POST',body:JSON.stringify(command)}),{code:'WORKSPACE_RECOVERY_CONFLICT'});
 await assert.rejects(journal.prepare('/api/identity/template-send',{method:'POST',body:JSON.stringify({...progressCommand,operationId:'01234567-89ab-4cde-8fab-0123456789ac'})}),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 const storedKey=[...rows.keys()][0];assert.throws(()=>validateWorkspaceRecoveryStoredEntry(storedKey,JSON.stringify({...ticket.entry,actionReference:{...actionReference,phone:'private'}})));
 for(const bad of [result(),progressResult({receipt:{...progressResult().receipt,workerId:'worker-b'}}),progressResult({receipt:{...progressResult().receipt,actionReference:{...actionReference,proposalId:'proposal-b'}}})]){assert.equal(recoveryResult(ticket.entry,bad),null);await journal.settle(ticket,bad);assert.equal((await journal.list(command.scope)).length,1);}
 await second.observe('/api/identity/template-send?'+new URLSearchParams({...context,operationId:command.operationId}),progressResult());assert.equal((await journal.list(command.scope)).length,0);
});
test('malformed progress POST and GET receipts keep the same durable attempt without another dispatch',async()=>{
 for(const method of ['POST','GET']){
  const rows=new Map(),storage={get length(){return rows.size;},key:index=>[...rows.keys()][index],getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
  const journal=createWorkspaceRecoveryJournal({getStorage:()=>storage});await journal.prepare('/api/identity/template-send',{method:'POST',body:JSON.stringify(progressCommand)});
  const transport=createWorkspaceRequestLifecycle(async()=>'controlled',{journal,fetchImpl:async()=>Response.json(progressResult({receipt:{...progressResult().receipt,actionReference:{...actionReference,proposalId:'proposal-b'}}}))});
  const url='/api/identity/template-send'+(method==='GET'?'?'+new URLSearchParams({...context,operationId:command.operationId}):'');
  await assert.rejects(transport.request(url,{method,...(method==='POST'?{body:JSON.stringify(progressCommand)}:{})},async response=>templateSendResult(await response.json(),progressCommand)));
  assert.deepEqual((await journal.list(command.scope))[0].actionReference,actionReference);transport.abort();
 }
});
