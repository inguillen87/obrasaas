import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {normalizeFieldCommand} from '../src/lib/field-operations-policy.mjs';
import {EXECUTION_MANAGEMENT_ACTIONS,createExecutionAttemptJournal,executionAccessDenied,executionCommand,executionCommandDigest,executionCommandResult,executionDirectedReceipt,executionFailureRetainsAttempt,executionMandate,executionMandateState,executionReceiptView,executionStoredAttempt,executionTaskMeasurement,executionValidatedResponse,executionViewSnapshot,prepareExecutionMandate,prepareExecutionRevocation,verifyExecutionAttempt} from '../src/app/(identity)/cuenta/field-execution-view.mjs';
import {createWorkspaceRecoveryJournal} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';

const scope='a'.repeat(64),context={projectId:'project-a',scope},operationId='11111111-2222-4333-8444-555555555555',mandateId='execution_mandate_'+'b'.repeat(64),receiptId='field_'+'c'.repeat(64),taskRevision='2026-10-24T12:00:00.123456';
const task=()=>({id:'task-a',title:'Tarea sintética',revision:taskRevision,status:'BLOCKED',progress:0,measurement:{version:'task-progress-measurement-v1',definitionId:'measurement-a',baseline:'10.0000',unit:'M2',executed:'0.0000',sourceReference:'Fuente medida y confirmada',configuredAt:'2026-10-24T12:00:00.000Z',approvedProposalId:null,approvedAt:null}});
const data=()=>({...context,version:1,canManage:true,workers:[{id:'worker-a',name:'Otra cuenta sintética'}],workersTruncated:false,sectors:[{id:'sector-a',name:'Sector sintético'}],catalogHash:'d'.repeat(64),materials:[{id:'material-a',name:'Material A',unit:'bolsa',active:true,balance:'10.000'},{id:'material-z',name:'Material Z',unit:'kg',active:true,balance:'20.000'}],mandates:[],mandatesTruncated:false,receipts:[],receiptsTruncated:false});
const fields=()=>({workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',validUntil:'2026-10-25T12:00:00.000Z',materials:[{materialId:'material-z',limit:'0002',maxPerReport:'1'},{materialId:'material-a',limit:'10.001',maxPerReport:'0001.001'}],progress:null,reason:'  Cupo explícito\r\npara la tarea.  '});
const payload=()=>prepareExecutionMandate(fields(),data(),[task()]);
const command=()=>executionCommand('ISSUE_EXECUTION_MANDATE',payload(),{...context,operationId,canManage:true,confirmed:true});
const mandate=(p=payload())=>({id:mandateId,version:1,revision:1,state:'ACTIVE',issuedBy:'issuer-a',reporterActorId:'reporter-a',workerId:p.workerId,taskId:p.taskId,sectorId:p.sectorId,catalogHash:p.catalogHash,issuedAt:'2026-10-24T12:00:00.000Z',validUntil:p.validUntil,materials:p.materials.map(m=>({...m,used:'0.000'})),progress:p.progress?{...p.progress,used:'0.0000'}:null,revocation:null});
async function attempt(){const cmd=command();return {version:1,command:cmd,requestDigest:await executionCommandDigest(cmd)};}
const issued=a=>({...context,operationId,action:'ISSUE_EXECUTION_MANDATE',state:'RECORDED',saved:true,replayed:false,receiptId,requestDigest:a.requestDigest,kind:'EXECUTION_MANDATE_ISSUED',mandate:mandate(a.command?.payload),stockChanged:false,taskUpdated:false});
const reordered=value=>Array.isArray(value)?value.map(reordered):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reordered(v)])):value;
function storage(){const values=new Map();return {values,get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
const notObserved=()=>({...context,operationId,state:'NOT_OBSERVED',definitive:false});

test('mandate review derives current units, task revision and exact allowances without taking an actor or progress from stock',()=>{
 const input=fields(),before=structuredClone(input),out=prepareExecutionMandate(input,data(),[task()]);assert.deepEqual(input,before);assert.equal(out.taskRevision,taskRevision);assert.equal(out.catalogHash,data().catalogHash);assert.deepEqual(out.materials,[{materialId:'material-a',unit:'bolsa',limit:'10.001',maxPerReport:'1.001'},{materialId:'material-z',unit:'kg',limit:'2.000',maxPerReport:'1.000'}]);assert.equal(out.progress,null);assert.equal(out.reason,'Cupo explícito\npara la tarea.');assert.equal(Object.hasOwn(out,'actorId'),false);
 const configured=fields();configured.progress={limit:'4',maxPerReport:'1.2501'};assert.deepEqual(prepareExecutionMandate(configured,data(),[task()]).progress,{definitionId:'measurement-a',baseline:'10.0000',unit:'M2',limit:'4.0000',maxPerReport:'1.2501'});
 const noMeasurement={...task(),measurement:undefined};assert.throws(()=>prepareExecutionMandate(configured,data(),[noMeasurement]));assert.equal(executionTaskMeasurement(noMeasurement),null);
});

test('permissions, explicit confirmation and current context are mandatory before constructing a command',()=>{
 assert.deepEqual(EXECUTION_MANAGEMENT_ACTIONS,['ISSUE_EXECUTION_MANDATE','REVOKE_EXECUTION_MANDATE']);for(const canManage of [false,undefined])assert.throws(()=>prepareExecutionMandate(fields(),{...data(),canManage},[task()]));
 for(const overrides of [{confirmed:false},{canManage:false},{operationId:'foreign'},{scope:'bad'},{projectId:'bad/id'}])assert.throws(()=>executionCommand('ISSUE_EXECUTION_MANDATE',payload(),{...context,operationId,canManage:true,confirmed:true,...overrides}));
 for(const edit of [f=>f.workerId='foreign',f=>f.taskId='foreign',f=>f.sectorId='foreign',f=>f.materials[0].materialId='foreign',f=>f.materials[0].limit=1,f=>f.materials[0].maxPerReport='2.001',f=>f.materials[1].materialId=f.materials[0].materialId]){const f=fields();edit(f);assert.throws(()=>prepareExecutionMandate(f,data(),[task()]));}
 for(const key of ['actorId','approved','scope','unit']){const p={...payload(),[key]:'foreign'};assert.throws(()=>executionCommand('ISSUE_EXECUTION_MANDATE',p,{...context,operationId,canManage:true,confirmed:true}));}
});

test('browser canonical wire bytes and SHA256 exactly match the existing server field normalizer',async()=>{
 const cmd=command(),server=normalizeFieldCommand(cmd);assert.deepEqual(cmd,server);assert.equal(await executionCommandDigest(cmd),createHash('sha256').update(JSON.stringify(server)).digest('hex'));
 const f=fields();f.progress={limit:'4.0000',maxPerReport:'1.0000'};const measured=executionCommand('ISSUE_EXECUTION_MANDATE',prepareExecutionMandate(f,data(),[task()]),{...context,operationId,canManage:true,confirmed:true});assert.equal(await executionCommandDigest(measured),createHash('sha256').update(JSON.stringify(normalizeFieldCommand(measured))).digest('hex'));
 await assert.rejects(executionCommandDigest(reordered(cmd)));const a=await attempt(),changed=structuredClone(a);changed.command.payload.reason='Otro motivo aprobado.';await assert.rejects(verifyExecutionAttempt(changed,context));
});

test('durable attempt storage reserves the full canonical envelope, restores it and refuses another UUID until resolution',async()=>{
 const s=storage(),j=createExecutionAttemptJournal(s,context),a=await attempt();assert.equal(j.read(),null);j.reserve(a);assert.deepEqual(j.read(),a);assert.deepEqual(await verifyExecutionAttempt(j.read(),context),a);assert.deepEqual(j.reserve(a),a);
 const different=structuredClone(a);different.command.operationId='21111111-2222-4333-8444-555555555555';different.requestDigest=await executionCommandDigest(different.command);assert.throws(()=>j.reserve(different),{code:'FIELD_EXECUTION_PENDING'});assert.deepEqual(j.read(),a);
 assert.throws(()=>executionStoredAttempt(a,{...context,scope:'e'.repeat(64)}));const other=createExecutionAttemptJournal(s,{...context,scope:'e'.repeat(64)});assert.equal(other.read(),null);j.clear(a);assert.equal(j.read(),null);
});

test('storage write/readback/parse failures stop dispatch preparation and never replace a pending reference',async()=>{
 const a=await attempt();for(const s of [{getItem:()=>null,setItem(){throw new Error('quota');}},{getItem:()=>null,setItem(){}},{getItem:()=>'{malformed',setItem(){}}]){const j=createExecutionAttemptJournal(s,context);assert.throws(()=>j.reserve(a),{code:'FIELD_EXECUTION_STORAGE_UNAVAILABLE'});}
 const s=storage(),j=createExecutionAttemptJournal(s,context);j.reserve(a);s.values.set(j.key,JSON.stringify({...a,actorId:'foreign'}));assert.throws(()=>j.read(),{code:'FIELD_EXECUTION_STORAGE_UNAVAILABLE'});
});

test('permission loss redacts business payload while retaining the exact operation and digest for receipt recovery',async()=>{
 const s=storage(),j=createExecutionAttemptJournal(s,context),a=await attempt();j.reserve(a);const redacted=j.redact(a);assert.deepEqual(Object.keys(redacted).sort(),['reference','version']);assert.equal(redacted.reference.operationId,operationId);assert.equal(redacted.reference.requestDigest,a.requestDigest);assert.equal(JSON.stringify(redacted).includes('Cupo explícito'),false);assert.equal(Object.hasOwn(redacted,'command'),false);assert.equal(executionCommandResult(issued(a),redacted).state,'RECORDED');
 for(const error of [{status:401},{status:403},{code:'WORKSPACE_CONTEXT_CHANGED'},{code:'FIELD_EXECUTION_MANAGE_REQUIRED'}])assert.equal(executionAccessDenied(error),true);
});

test('fresh unsent or definitive 4xx can close only their own attempt; ambiguous, restored, conflict and receipt-integrity cases remain pending',()=>{
 assert.equal(executionFailureRetainsAttempt({requestDispatched:false},{fresh:true}),false);assert.equal(executionFailureRetainsAttempt({status:400,responseObserved:true},{fresh:true}),false);
 for(const error of [{status:500,responseObserved:true},{status:400},{name:'AbortError'},{status:409,responseObserved:true,code:'FIELD_OPERATION_CONFLICT'},{status:409,responseObserved:true,code:'FIELD_EXECUTION_REPORT_CONFLICT'},{status:409,responseObserved:true,code:'FIELD_RECEIPT_INTEGRITY'},{code:'WORKSPACE_CONTEXT_CHANGED',requestDispatched:false}])assert.equal(executionFailureRetainsAttempt(error,{fresh:true}),true);
 for(const error of [{requestDispatched:false},{status:400,responseObserved:true},{status:403,responseObserved:true}])assert.equal(executionFailureRetainsAttempt(error,{fresh:false}),true);
});

test('recorded receipts bind scope, operation, action, digest and the entire authorized mandate terms without requiring JSONB key order',async()=>{
 const a=await attempt(),r=issued(a);assert.equal(executionCommandResult(r,a).state,'RECORDED');assert.equal(executionCommandResult(reordered(r),a).state,'RECORDED');assert.equal(executionReceiptView(r,context).title,'Autorización registrada');
 for(const edit of [v=>v.scope='e'.repeat(64),v=>v.projectId='other',v=>v.operationId='21111111-2222-4333-8444-555555555555',v=>v.action='REVOKE_EXECUTION_MANDATE',v=>v.requestDigest='f'.repeat(64),v=>v.saved=false,v=>v.mandate.workerId='other',v=>v.mandate.taskId='other',v=>v.mandate.catalogHash='f'.repeat(64),v=>v.mandate.materials[0].limit='11.000',v=>v.mandate.materials[0].unit='kg',v=>v.stockChanged=true,v=>v.actorId='foreign']){const bad=structuredClone(r);edit(bad);assert.throws(()=>executionCommandResult(bad,a));}
});

test('NOT_OBSERVED never certifies failure and directed lookups reject foreign references or business data',async()=>{
 const a=await attempt(),v=notObserved();assert.deepEqual(executionCommandResult(v,a),{state:'NOT_OBSERVED'});assert.deepEqual(executionDirectedReceipt(v,{...context,operationId}),{state:'NOT_OBSERVED'});
 for(const bad of [{...v,definitive:true},{...v,saved:true},{...v,receiptId},{...v,operationId:'21111111-2222-4333-8444-555555555555'}])assert.throws(()=>executionCommandResult(bad,a));assert.throws(()=>executionDirectedReceipt(issued(a),{...context,operationId:'21111111-2222-4333-8444-555555555555'}));
});

test('revocation receipts bind the reviewed mandate revision and reason while earlier records remain readable',async()=>{
 const m=mandate(),p=prepareExecutionRevocation(m,' Motivo de revocación explícita. '),cmd=executionCommand('REVOKE_EXECUTION_MANDATE',p,{...context,operationId,canManage:true,confirmed:true}),a={version:1,command:cmd,requestDigest:await executionCommandDigest(cmd)},r={...context,operationId,action:cmd.action,state:'RECORDED',saved:true,replayed:true,receiptId,requestDigest:a.requestDigest,kind:'EXECUTION_MANDATE_REVOKED',stockChanged:false,taskUpdated:false,mandate:{...m,state:'REVOKED',revision:2,revocation:{actorId:'issuer-b',reason:p.reason,recordedAt:'2026-10-24T13:00:00.000Z',receiptId}}};
 assert.equal(executionCommandResult(r,a).state,'RECORDED');assert.equal(executionMandateState(r.mandate).label,'Revocado');assert.throws(()=>prepareExecutionRevocation(r.mandate,p.reason));for(const edit of [v=>v.mandate.revision=1,v=>v.mandate.revocation.reason='Otro fundamento.',v=>v.mandate.revocation.receiptId='field_'+'f'.repeat(64)]){const bad=structuredClone(r);edit(bad);assert.throws(()=>executionCommandResult(bad,a));}
});

test('current snapshots reject malformed controls, duplicated rows and foreign receipts while preserving explicit truncation',async()=>{
 const a=await attempt(),value=data();value.mandates=[mandate()];value.receipts=[issued(a)];assert.equal(executionViewSnapshot(reordered(value),context).mandates.length,1);
 for(const edit of [v=>v.canManage='true',v=>v.workersTruncated=undefined,v=>v.workers.push(v.workers[0]),v=>v.materials[0].unit='KG',v=>v.materials[0].balance='-1',v=>v.mandates[0].materials[0].used='11.000',v=>v.mandates[0].reporterActorId=v.mandates[0].issuedBy,v=>v.receipts[0].scope='e'.repeat(64),v=>v.actorId='foreign']){const bad=structuredClone(value);edit(bad);assert.throws(()=>executionViewSnapshot(bad,context));}
 assert.equal(executionMandateState(value.mandates[0],Date.parse('2026-10-26T00:00:00.000Z')).label,'Vigencia vencida');assert.equal(executionMandateState(value.mandates[0],NaN).available,false);assert.equal(executionMandate(value.mandates[0]),value.mandates[0]);
});

test('execution receipt presentation authenticates each linked OUT and its exact balance arithmetic without inventing a task percentage',()=>{
 const executionId='field_execution_'+'e'.repeat(64),reportId='31111111-2222-4333-8444-555555555555',movement={id:'inventory_move_'+'f'.repeat(64),version:1,projectId:context.projectId,executionId,reportId,mandateId,executionReceiptId:receiptId,lineId:'line-a',materialId:'material-a',unit:'bolsa',kind:'CONSUMPTION',direction:'OUT',authorizedBy:'issuer-a',submittedBy:'reporter-a',quantity:'1.001',balanceBefore:'10.000',balanceAfter:'8.999'},r={...context,operationId,action:'REPORT_EXECUTION',state:'RECORDED',saved:true,replayed:true,receiptId,requestDigest:'d'.repeat(64),kind:'EXECUTION_APPLIED',executionReplay:false,effectsApplied:true,stockChanged:true,taskUpdated:false,task:null,execution:{version:1,id:executionId,reportId,workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',mandateId,mandateRevision:1,authorizedBy:'issuer-a',executedBy:'reporter-a',recordedAt:'2026-10-24T12:00:00.000Z',receiptId,movements:[movement],measurement:null}};
 const view=executionReceiptView(r,context);assert.equal(view.measurement,null);assert.equal(Object.hasOwn(view,'progress'),false);assert.equal(view.movements[0].quantity,'1.001');for(const edit of [v=>v.execution.movements[0].balanceAfter='9.000',v=>v.execution.movements[0].executionId='field_execution_'+'a'.repeat(64),v=>v.execution.movements[0].executionReceiptId='field_'+'b'.repeat(64),v=>v.execution.movements[0].direction='IN',v=>v.execution.movements.push(v.execution.movements[0])]){const bad=structuredClone(r);edit(bad);assert.throws(()=>executionReceiptView(bad,context));}
});

test('the existing authenticated request lifecycle settles only a strictly validated receipt and preserves malformed responses for GET recovery',async()=>{
 const a=await attempt(),s=storage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123}),url='/api/identity/field-operations',options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a.command)};let bad=true,posts=0,gets=0;
 const transport=createWorkspaceRequestLifecycle(async()=>'synthetic-active-token',{journal,fetchImpl:async(_,opts)=>{if(opts.method==='POST')posts++;else gets++;return Response.json({...issued(a),...(bad?{requestDigest:'f'.repeat(64)}:{})});}});
 const consume=async response=>executionValidatedResponse(await response.json(),value=>executionCommandResult(value,a));await assert.rejects(transport.request(url,options,consume));assert.equal((await journal.list(scope)).length,1);assert.equal(posts,1);
 bad=false;const recovered=await transport.request(url+'?'+new URLSearchParams({...context,operationId}),{},consume);assert.equal(recovered.scope,scope);assert.equal(recovered.projectId,context.projectId);assert.equal(recovered.saved,true);assert.equal(recovered.view.receiptId,receiptId);assert.equal((await journal.list(scope)).length,0);assert.equal(posts,1);assert.equal(gets,1);transport.abort();
});
