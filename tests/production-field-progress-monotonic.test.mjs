import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';

const scope='a'.repeat(64),revision='2026-10-05T12:00:00.123456';
const session={userId:'unit-worker'},operationId='11111111-1111-4111-8111-111111111111';
const payload={workerId:'worker-a',taskId:'task-a',revision,progress:25,quantity:'2.5000',baseline:'10.0000',unit:'M2',reason:'Synthetic measured cumulative quantity.',evidenceIds:['evidence-a']};
function fixture({executed='2.5900',baseline='10.0000',progress=25,proposed=payload}={}){
 const writes=[],queries=[],task={id:'task-a',title:'Synthetic measured task',revision,progress,status:'IN_PROGRESS',metadata:{fieldOperations:{quantity:{executed,baseline,unit:'M2'}}}};
 const proposal={id:'proposal-a',revision,status:'PENDING',expired:false,action:{...proposed,fieldOperationsVersion:1,submittedBy:'another-actor'},precondition:{taskRevision:revision}};
 const operations=createFieldOperations({assertParticipant:async()=>({}),workspace:{projectOperation:async(actor,input,writable,callback)=>callback({query:async(sql,args)=>{
  queries.push(sql);if(!sql.startsWith('SELECT ')){writes.push(sql);return {rows:[]};}
  if(sql.includes('clock_timestamp() AS now'))return {rows:[{now:new Date('2026-10-05T12:00:00Z')}]};
  if(sql.includes('public."AuditLog"'))return {rows:[]};
  if(sql.includes('public."Task"'))return {rows:[task]};
  if(sql.includes('public."Incident"'))return {rows:[{id:'evidence-a',metadata:{fieldOperations:{version:1,kind:'EVIDENCE',taskId:'task-a',review:{decision:'APPROVE'}}}}]};
  if(sql.includes('public."OperationalProposal"'))return {rows:sql.includes('AND id=')||args?.[0]==='proposal-a'||sql.includes('SELECT id,summary')?[proposal]:[]};
  throw new Error('Unexpected query: '+sql);
 }},{role:'DIRECTOR',actorId:'director-a',organizationId:'company-a'},scope,{})}});
 return {operations,writes,queries,proposal};
}
const propose=p=>({projectId:'project-a',scope,operationId,action:'PROPOSE_PROGRESS',payload:p});
const decide={projectId:'project-a',scope,operationId,action:'DECIDE_PROGRESS',payload:{proposalId:'proposal-a',revision,decision:'APPROVE',reason:'Synthetic independent approval of measurement.'}};
test('a smaller cumulative amount inside the same integer percentage never creates a proposal or receipt',async()=>{
 const f=fixture();await assert.rejects(f.operations.save(session,propose(payload)),{code:'FIELD_PROGRESS_REGRESSION'});assert.deepEqual(f.writes,[]);
});
test('approval defensively rejects a stored cumulative quantity regression without task/proposal/audit writes',async()=>{
 const f=fixture();await assert.rejects(f.operations.save(session,decide),{code:'FIELD_PROGRESS_REGRESSION'});assert.deepEqual(f.writes,[]);
});
test('equal and increasing cumulative quantities remain proposals until an authorized decision',async()=>{
 for(const quantity of ['2.5900','2.5999']){
  const f=fixture({proposed:{...payload,quantity}});const result=await f.operations.save(session,propose({...payload,quantity}));
  assert.equal(result.taskUnchanged,true);assert.equal(result.kind,'PROGRESS_PROPOSAL');assert.equal(f.writes.length,2);assert.ok(f.writes.every(sql=>!sql.includes('UPDATE public."Task"')));
 }
});
test('four-decimal regression near Decimal(18,4) capacity cannot disappear through Number rounding',async()=>{
 const proposed={...payload,progress:99,quantity:'99999999999999.9997',baseline:'99999999999999.9999'};
 const f=fixture({executed:'99999999999999.9998',baseline:proposed.baseline,progress:99,proposed});
 await assert.rejects(f.operations.save(session,propose(proposed)),{code:'FIELD_PROGRESS_REGRESSION'});assert.deepEqual(f.writes,[]);
});
test('stored malformed quantity and changed baseline fail closed before approval writes',async()=>{
 for(const [executed,proposed,code] of [['broken',payload,'FIELD_QUANTITY_INVALID'],['2.5900',{...payload,baseline:'20.0000'},'FIELD_BASELINE_CHANGED']]){
  const f=fixture({executed,proposed});await assert.rejects(f.operations.save(session,decide),{code});assert.deepEqual(f.writes,[]);
 }
});
