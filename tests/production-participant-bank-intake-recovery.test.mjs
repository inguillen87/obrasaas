import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {PRIVATE_BANK_NOTICE_VERSION} from '../src/app/(identity)/cuenta/private-bank-account-format.mjs';

const scope='a'.repeat(64),projectId='shared-project',applicationId='customer_webhook_'+'c'.repeat(64);
function fixture(){const rows=new Map(),storage={get length(){return rows.size;},key:i=>[...rows.keys()][i],getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};return {rows,storage,journal:createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456})};}
function command(kind,operationId=randomUUID()){
 return {scope,projectId,operationId,action:kind==='bank'?'SAVE_PRIVATE_BANK_ACCOUNT':'ADMIT_EMPLOYEE_INTAKE',payload:kind==='bank'?{workerId:'own-worker',revision:'2026-10-06T00:00:00.000001',expectedBankRevision:0,type:'CBU',number:'0000000000000000000001',consent:true,noticeVersion:PRIVATE_BANK_NOTICE_VERSION}:{connectionId:'company-channel',applicationId,expectedRevision:5,job:'WORKER',permissions:{attendance:false,report:true},confirmed:true}};
}
function recorded(body){
 const common={scope:body.scope,projectId:body.projectId,operationId:body.operationId,action:body.action,state:'RECORDED',saved:true};
 return body.action==='SAVE_PRIVATE_BANK_ACCOUNT'?{...common,actorId:'own-actor',organizationId:'own-company',workerId:body.payload.workerId,definitive:true,replayed:false,receipt:{id:'participant_'+'b'.repeat(64),actorId:'own-actor',organizationId:'own-company',projectId:body.projectId,workerId:body.payload.workerId,operationId:body.operationId,action:body.action,state:'RECORDED',bankRevision:1,code:null}}:{...common,connectionId:body.payload.connectionId,applicationId:body.payload.applicationId,receiptId:'participant_'+'d'.repeat(64),permissionsGranted:false};
}
function assertPrivate(rows){const serialized=JSON.stringify([...rows]);for(const value of ['0000000000000000000001','Private synthetic applicant','15550001001','private@example.invalid','WORKER','noticeVersion','expectedBankRevision','permissions','attendance','consent','synthetic-token'])assert.equal(serialized.includes(value),false,value);}

for(const kind of ['bank','intake'])for(const failure of ['lost-response','http403'])test(kind+' '+failure+' persists its typed reference across reload and rejects the sibling receipt before exact GET recovery',async()=>{
 const f=fixture(),body=command(kind);let posts=0,gets=0;
 const first=createWorkspaceRequestLifecycle(async()=>'synthetic-token',{journal:f.journal,fetchImpl:async()=>{posts++;if(failure==='lost-response')throw new TypeError('Synthetic lost ACK');return new Response('<html>Denied</html>',{status:403});}});
 await assert.rejects(first.request('/api/identity/participants',{method:'POST',body:JSON.stringify(body)},async response=>{if(!response.ok)throw Object.assign(new Error('Synthetic access changed'),{status:response.status});return response.json();}));first.abort();assert.equal(posts,1);assertPrivate(f.rows);
 const journal=createWorkspaceRecoveryJournal({getStorage:()=>f.storage,now:()=>123457}),entry=(await journal.list(scope))[0];assert.ok(entry);assert.equal(entry.action,body.action);assert.equal(entry.workerId,kind==='bank'?body.payload.workerId:undefined);assert.equal(entry.applicationId,kind==='intake'?applicationId:undefined);
 const sibling=command(kind==='bank'?'intake':'bank',body.operationId),forged=recorded(sibling);assert.equal(recoveryResult(entry,forged),null);await journal.observe(recoveryQuery(entry),forged);assert.equal((await journal.list(scope)).length,1);
 await assert.rejects(journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify({...sibling,operationId:randomUUID()})}),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 const result=recorded(body),second=createWorkspaceRequestLifecycle(async()=>'synthetic-fresh-token',{journal,fetchImpl:async(url,options)=>{assert.equal(options.method||'GET','GET');const params=new URL(url,'https://obrasaas.com').searchParams;assert.equal(params.get('operationId'),body.operationId);assert.equal(params.get('projectId'),projectId);assert.equal(params.get('scope'),scope);if(kind==='bank'){assert.equal(params.get('action'),body.action);assert.equal(params.get('detail'),'private-bank-account');assert.equal(params.get('workerId'),body.payload.workerId);}else assert.deepEqual([...params.keys()].sort(),['operationId','projectId','scope']);gets++;return Response.json(result);}});
 assert.equal((await second.request(recoveryQuery(entry))).state,'RECORDED');second.abort();assert.equal(posts,1);assert.equal(gets,1);assert.deepEqual(await journal.list(scope),[]);
});

for(const kind of ['bank','intake'])test(kind+' nonterminal and cross-context responses retain unknown and never use the generic participant fallback',async()=>{
 const f=fixture(),body=command(kind),ticket=await f.journal.prepare('/api/identity/participants',{method:'POST',body:JSON.stringify(body)}),good=recorded(body);
 const forged=[{scope,projectId,saved:true,receiptId:'participant_'+'e'.repeat(64)}, {...good,operationId:randomUUID()}, {...good,projectId:'other-project'}, {...good,scope:'b'.repeat(64)},kind==='bank'?{...good,workerId:'foreign-worker'}:{...good,connectionId:'foreign-channel'},kind==='bank'?{...good,receipt:{...good.receipt,actorId:'foreign-actor'}}:{...good,applicationId:'customer_webhook_'+'f'.repeat(64)}];
 for(const value of forged){assert.equal(recoveryResult(ticket.entry,value),null);await f.journal.settle(ticket,value);await f.journal.observe(recoveryQuery(ticket.entry),value);assert.equal((await f.journal.list(scope)).length,1);}
 for(const value of [null,{scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false},{scope,projectId,state:'PROCESSING',definitive:false}]){await f.journal.settle(ticket,value,{status:403,requestDispatched:true});await f.journal.observe(recoveryQuery(ticket.entry),value);assert.equal((await f.journal.list(scope)).length,1);}
 assert.deepEqual(await f.journal.list('b'.repeat(64)),[]);assertPrivate(f.rows);assert.equal((await f.journal.list(scope))[0].operationId,body.operationId);
});
test('independent bank and intake projects keep both typed references; settling one never clears the other',async()=>{
 const f=fixture(),bank=command('bank'),intake={...command('intake'),projectId:'other-project'},options=body=>({method:'POST',body:JSON.stringify(body)}),bankTicket=await f.journal.prepare('/api/identity/participants',options(bank)),intakeTicket=await f.journal.prepare('/api/identity/participants',options(intake));
 assert.equal((await f.journal.list(scope)).length,2);await f.journal.observe(recoveryQuery(bankTicket.entry),recorded(intake));assert.equal((await f.journal.list(scope)).length,2);await f.journal.observe(recoveryQuery(bankTicket.entry),recorded(bank));assert.deepEqual(await f.journal.list(scope),[intakeTicket.entry]);assertPrivate(f.rows);await f.journal.observe(recoveryQuery(intakeTicket.entry),recorded(intake));assert.deepEqual(await f.journal.list(scope),[]);
});
