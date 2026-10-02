import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),context={projectId:'p-a',scope,proposalId:'proposal-a'};
const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Director',organizationId:'org_A',organizationRole:'org:member'};
const proposal={id:'proposal-a',revision:'2026-10-02T12:00:00.123456',action:{fieldOperationsVersion:1,taskId:'task-a',evidenceIds:['e-old','e-other-worker']}};
const row=(id,workerId='w-a',taskId='task-a')=>({id,title:'Synthetic linked file',description:'Synthetic caption',revision:'2026-10-01T12:00:00.123456',metadata:{fieldOperations:{version:1,kind:'EVIDENCE',taskId,workerId,sectorId:'sector-a',capturedAt:'2026-10-01T12:00:00Z',media:{kind:'image',contentType:'image/png',bytes:68,sha256:'b'.repeat(64),url:'https://private.invalid/never-expose'},review:{decision:'APPROVE',reason:'Synthetic independent review',recordedAt:'2026-10-01T13:00:00Z',actorId:'private-reviewer'}}}});
function fixture({role='DIRECTOR',stored=proposal,records=[row('e-old'),row('e-other-worker','w-b')],gateError}={}){
 const queries=[],transactions=[];
 const operations=createFieldOperations({workspace:{async projectOperation(actor,input,writable,callback){
  transactions.push({actor,input,writable});if(gateError)throw gateError;
  return callback({async query(sql,args){
   queries.push({sql,args});assert.match(sql,/^SELECT /);assert.equal(args[1],'p-a');assert.doesNotMatch(sql,/FOR UPDATE/);
   if(sql.includes('public."OperationalProposal"'))return {rows:stored?[stored]:[]};
   assert.ok(sql.includes('public."Incident"'));return {rows:records.filter(r=>r.id===args[0])};
  }},{role},scope);
 }}});
 return {operations,queries,transactions};
}
test('proposal lookup reads only server-linked evidence beyond the recent list, retaining another uploader on the same task',async()=>{
 const f=fixture(),result=await f.operations.proposalEvidence(session,context);
 assert.equal(f.transactions.length,1);assert.deepEqual(f.transactions[0],{actor:session,input:context,writable:false});
 assert.deepEqual(result,{scope,projectId:'p-a',proposalId:'proposal-a',proposalRevision:proposal.revision,evidence:result.evidence});
 assert.deepEqual(result.evidence.map(e=>[e.id,e.workerId]),[['e-old','w-a'],['e-other-worker','w-b']]);
 assert.deepEqual(f.queries.map(q=>q.args),[['proposal-a','p-a'],['e-old','p-a'],['e-other-worker','p-a']]);
 assert.equal(JSON.stringify(result).includes('private.invalid'),false);assert.equal(JSON.stringify(result).includes('private-reviewer'),false);
});
test('current project authorization and progress-decision role guard the targeted lookup before querying files',async()=>{
 for(const role of ['SITE_MANAGER','AUDITOR','WORKER',null]){
  const f=fixture({role});await assert.rejects(f.operations.proposalEvidence(session,context),{code:'FIELD_PROGRESS_PERMISSION_REQUIRED'});assert.equal(f.queries.length,0);
 }
 for(const code of ['WORKSPACE_PROJECT_UNAVAILABLE','WORKSPACE_CONTEXT_CHANGED','WORKSPACE_MEMBERSHIP_REQUIRED']){
  const f=fixture({gateError:new WorkspaceError(code,code==='WORKSPACE_CONTEXT_CHANGED'?409:403)});await assert.rejects(f.operations.proposalEvidence(session,context),{code});assert.equal(f.queries.length,0);
 }
 const f=fixture({role:'ADMIN'});assert.equal((await f.operations.proposalEvidence(session,context)).evidence.length,2);
});
test('malformed, duplicated or unbounded stored links never broaden the read',async()=>{
 for(const action of [{...proposal.action,evidenceIds:[]},{...proposal.action,evidenceIds:null},{...proposal.action,evidenceIds:['e-old','e-old']},{...proposal.action,evidenceIds:['bad/id']},{...proposal.action,evidenceIds:Array.from({length:11},(_,i)=>'e-'+i)},{...proposal.action,taskId:'bad/task'}]){
  const f=fixture({stored:{...proposal,action}});await assert.rejects(f.operations.proposalEvidence(session,context),{code:'FIELD_PROPOSAL_UNAVAILABLE'});assert.equal(f.queries.length,1);
 }
 const f=fixture();await assert.rejects(f.operations.proposalEvidence(session,{...context,proposalId:'bad/id'}),{code:'FIELD_QUERY_INVALID'});assert.equal(f.transactions.length,0);
});
test('foreign task, missing evidence and other-engine proposals fail closed without partial metadata',async()=>{
 for(const records of [[row('e-old','w-a','task-b'),row('e-other-worker')],[row('e-old')],[{...row('e-old'),metadata:{fieldOperations:{version:1,kind:'INCIDENT'}}},row('e-other-worker')]]){
  const f=fixture({records});await assert.rejects(f.operations.proposalEvidence(session,context),{code:'FIELD_EVIDENCE_UNAVAILABLE'});
 }
 for(const stored of [null,{...proposal,action:{...proposal.action,fieldOperationsVersion:2}}]){
  const f=fixture({stored});await assert.rejects(f.operations.proposalEvidence(session,context),{code:'FIELD_PROPOSAL_UNAVAILABLE'});assert.equal(f.queries.length,1);
 }
});
test('HTTP targeted lookup is private, strictly selected and leaves normal read, receipt recovery and save intact',async()=>{
 const calls=[],operations={proposalEvidence:async(actor,input)=>{calls.push(['linked',actor,input]);return {proposalId:input.proposalId};},read:async()=>{calls.push(['read']);return {};},status:async()=>{calls.push(['status']);return {};},save:async()=>{calls.push(['save']);return {};}};
 const h=createFieldHandlers({verify:async()=>session,operations}),url='https://obrasaas.com/api/identity/field-operations?projectId=p-a&scope='+scope;
 const response=await h.GET(new Request(url+'&proposalId=proposal-a'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(response.headers.get('vary'),'Cookie, Authorization');assert.deepEqual(calls,[['linked',session,context]]);
 for(const suffix of ['&proposalId=proposal-a&operationId=receipt-a','&proposalId=proposal-a&proposalId=proposal-b','&proposalId=','&proposalId=bad%2Fid','&proposalId=proposal-a&evidenceIds=e-foreign','&proposalId=proposal-a&projectId=p-b']){
  assert.equal((await h.GET(new Request(url+suffix))).status,400);
 }assert.equal(calls.length,1);
 await h.GET(new Request(url));await h.GET(new Request(url+'&operationId=receipt-a'));
 await h.POST(new Request('https://obrasaas.com/api/identity/field-operations',{method:'POST',headers:{Origin:'https://obrasaas.com','Content-Type':'application/json'},body:'{}'}));
 assert.deepEqual(calls.slice(1),[['read'],['status'],['save']]);
});
test('HTTP anonymous or cross-site lookups never reach the targeted service',async()=>{
 let reads=0;const operations={proposalEvidence:async()=>{reads++;return {};}};
 const url='https://obrasaas.com/api/identity/field-operations?projectId=p-a&scope='+scope+'&proposalId=proposal-a';
 const anonymous=createFieldHandlers({verify:async()=>({authenticated:false}),operations}),signed=createFieldHandlers({verify:async()=>session,operations});
 assert.equal((await anonymous.GET(new Request(url))).status,401);
 assert.equal((await signed.GET(new Request(url,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 assert.equal(reads,0);
});
