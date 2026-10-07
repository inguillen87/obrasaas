import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createWorkspaceRecoveryJournal,recoveryResult,recoveryQuery,planImportCommandDigest} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
const scope='a'.repeat(64),projectId='plan-project',operationId='01234567-89ab-4cde-8fab-0123456789ab',endpoint='/api/identity/plan-import';
const body={scope,projectId,operationId,action:'APPLY',draftId:'plan-draft',expectedRevision:3,rows:[{title:'Private task',evidence:'Private evidence'}],reason:'Private reason'};
const command=value=>({method:'POST',body:JSON.stringify(value)});
function storage(){const data=new Map();return {get length(){return data.size;},key:index=>[...data.keys()][index]??null,getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};}
const journal=store=>createWorkspaceRecoveryJournal({getStorage:()=>store,now:()=>123});
const receipt=async(extra={})=>({scope,projectId,operationId,state:'REJECTED',saved:false,definitive:true,phase:'PRE_DECISION',taskEffects:false,code:'PLAN_IMPORT_DUPLICATE_ROWS',receiptId:'plan_receipt_'+'b'.repeat(64),action:body.action,draftId:body.draftId,expectedRevision:body.expectedRevision,inputDigest:await planImportCommandDigest(body),recordedAt:'2026-10-07T00:00:00.000Z',replayed:true,taskSnapshots:[],tasks:[],...extra});
test('decision reference preserves action draft revision and canonical input hash without command contents',async()=>{
 const store=storage(),j=journal(store),ticket=await j.prepare(endpoint,command(body));assert.equal(ticket.entry.action,'APPLY');assert.equal(ticket.entry.inputDigest,await planImportCommandDigest(body));
 const serialized=JSON.stringify([...store.data.values()]);assert.doesNotMatch(serialized,/Private|reason|rows|evidence|title/);
 const reordered=Object.fromEntries(Object.entries(body).reverse());reordered.rows=body.rows.map(row=>Object.fromEntries(Object.entries(row).reverse()));assert.equal(await planImportCommandDigest(reordered),ticket.entry.inputDigest);
 const canonical={action:'APPLY',draftId:'plan-draft',expectedRevision:3,operationId,projectId,reason:'Private reason',rows:[{evidence:'Private evidence',title:'Private task'}],scope};
 assert.equal(ticket.entry.inputDigest,createHash('sha256').update(JSON.stringify(['plan-import-command-v1',canonical])).digest('hex'));
 await assert.rejects(j.prepare(endpoint,command({...body,reason:'Other private reason'})),{code:'WORKSPACE_RECOVERY_CONFLICT',requestDispatched:false});
});
test('durable terminal rejection survives lost ACK and reload then exact GET releases only its reference',async()=>{
 const store=storage(),j=journal(store),ticket=await j.prepare(endpoint,command(body));await j.settle(ticket,null,{status:503});assert.equal((await j.list(scope)).length,1);
 const restored=journal(store),entry=(await restored.list(scope))[0],result=await receipt();assert.equal(recoveryResult(entry,result).state,'REJECTED');await restored.observe(recoveryQuery(entry),result);assert.equal((await restored.list(scope)).length,0);
 assert.ok(await restored.prepare(endpoint,command({...body,operationId:'01234567-89ab-4cde-8fab-0123456789ac'})));
});
test('same UUID replay terminal rejection settles an existing ticket without treating rejection as application',async()=>{
 const j=journal(storage());await j.prepare(endpoint,command(body));const ticket=await j.prepare(endpoint,command(body));assert.equal(ticket.existed,true);await j.settle(ticket,await receipt());assert.equal((await j.list(scope)).length,0);
});
test('unknown absence denied reads draft snapshots and malformed rejection proofs retain uncertainty',async()=>{
 const patches=[{scope:'c'.repeat(64)},{projectId:'other'},{operationId:'01234567-89ab-4cde-8fab-0123456789ac'},{action:'EDIT'},{draftId:'other'},{expectedRevision:4},{inputDigest:'d'.repeat(64)},{receiptId:'receipt-fake'},{phase:'UNKNOWN'},{code:'WORKSPACE_OPERATION_UNCONFIRMED'},{taskEffects:true},{definitive:false},{saved:true},{tasks:[{id:'task-fake'}]},{taskSnapshots:[{id:'task-fake'}]},{recordedAt:'invalid'},{unexpected:'private'},{replayed:undefined}];
 for(const patch of patches){const j=journal(storage()),ticket=await j.prepare(endpoint,command(body)),result=await receipt(patch);assert.equal(recoveryResult(ticket.entry,result),null);await j.settle(ticket,result);await j.observe(recoveryQuery(ticket.entry),result);assert.equal((await j.list(scope)).length,1);}
 const j=journal(storage()),ticket=await j.prepare(endpoint,command(body));await j.observe(recoveryQuery(ticket.entry),{scope,projectId,state:'NOT_OBSERVED',definitive:false});await j.observe(endpoint+'?'+new URLSearchParams({scope,projectId,draftId:body.draftId}),await receipt());assert.equal((await j.list(scope)).length,1);
 for(const status of [400,403,409,503]){await j.settle(ticket,null,{status,code:'PLAN_IMPORT_DUPLICATE_ROWS'});assert.equal((await j.list(scope)).length,1);}
});
