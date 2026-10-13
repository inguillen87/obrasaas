import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {createOrganizationUsage} from '../src/lib/organization-usage-store.mjs';
import {openAiUsageFact} from '../src/lib/organization-usage-policy.mjs';
import {resourceUsageBinding,resourceUsageLookup,publicResourceUsageReceipt,openAiChatUsageFact,openAiTranscriptionUsageFact} from '../src/lib/organization-resource-usage-policy.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const scope='a'.repeat(64),member={organizationId:'organization-synthetic',actorId:'actor-synthetic',role:'ADMIN'},session={authenticated:true};
const asMicros=value=>{const [whole,fraction='']=String(value).split('.');return BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));};
const asSeconds=value=>{const whole=value/1000000n,fraction=String(value%1000000n).padStart(6,'0').replace(/0+$/,'');return String(whole)+(fraction?'.'+fraction:'');};
const visionFact=()=>openAiChatUsageFact({id:'chatcmpl-synthetic',model:'gpt-4o',usage:{prompt_tokens:24,completion_tokens:6,total_tokens:30}},'req_synthetic');
const binding=(patch={})=>({version:2,projectId:'project-synthetic',resourceType:'Incident',resourceId:'incident-synthetic',resourceRevision:'b'.repeat(64),operationId:randomUUID(),stage:'FIELD_OPENAI_VISION',sourceSha256:'c'.repeat(64),requestDigest:'d'.repeat(64),consentVersion:'field-media-analysis-v1',requestedModel:'gpt-4o',...patch});
function fixture(){
 const rows=new Map(),queries=[];let revoked=false,internal=false,clock=Date.parse('2026-10-12T12:00:00.000Z');
 const company={id:member.organizationId,name:'Synthetic company',metadata:{},subscriptionPlan:'TRIAL',subscriptionStatus:'TRIALING',trialEndsAt:new Date('2026-10-13T12:00:00.000Z')};
 const client={release(){},async query(sql,args=[]){
  queries.push({sql,args});
  if(/^(BEGIN|COMMIT|ROLLBACK|SET LOCAL)/.test(sql)||sql.includes('pg_advisory_xact_lock'))return {rows:[],rowCount:1};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(clock++)}],rowCount:1};
  if(sql.includes('FROM public."Organization"'))return {rows:args[0]===member.organizationId&&!internal?[sql.startsWith('SELECT id FROM')?{id:member.organizationId}:{...company,observedAt:new Date(clock++)}]:[]};
  const action=/action='([^']+)'/.exec(sql)?.[1];
  if(sql.startsWith('INSERT INTO public."AuditLog"')){
   assert.equal(rows.has(args[0]),false);const resource=sql.includes("'organization.usage.resource'");
   rows.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],action:resource?'organization.usage.resource':'organization.usage.plan-import',entityType:resource?args[3]:'Project',entityId:resource?args[4]:args[3],metadata:JSON.parse(resource?args[5]:args[4])});return {rows:[],rowCount:1};
  }
  if(sql.startsWith('UPDATE public."AuditLog"')){const row=rows.get(args[0]);assert.ok(row);assert.equal(row.action,action);row.metadata=JSON.parse(args[1]);return {rows:[],rowCount:1};}
  if(sql.includes('FROM public."AuditLog"')){
   let selected=[...rows.values()].filter(row=>!action||row.action===action);
   if(sql.includes('WHERE id=$1'))selected=selected.filter(row=>row.id===args[0]&&(!args[1]||row.organizationId===args[1]));
   else if(sql.includes('"organizationId"=$1'))selected=selected.filter(row=>row.organizationId===args[0]);
   if(sql.includes("metadata->>'pendingKey'=$2"))selected=selected.filter(row=>row.metadata.pendingKey===args[1]&&['DISPATCHED','UNKNOWN'].includes(row.metadata.state));
   if(sql.includes('count(*)::text')){
    const totals={total:String(selected.length),reserved:'0',pending:'0',observed:'0',unmeasured:'0',inputTokens:'0',outputTokens:'0',totalTokens:'0',audioSeconds:'0'};let micros=0n;
    for(const row of selected){const state=row.metadata.state,key={RESERVED:'reserved',DISPATCHED:'pending',UNKNOWN:'pending',OBSERVED:'observed',UNMEASURED:'unmeasured'}[state];if(key)totals[key]=String(BigInt(totals[key])+1n);if(state==='OBSERVED'){for(const field of ['inputTokens','outputTokens','totalTokens'])totals[field]=String(BigInt(totals[field])+BigInt(row.metadata.observation.usage?.[field]||'0'));if(row.metadata.observation.measurement?.audioSeconds!==null&&row.metadata.observation.measurement?.audioSeconds!==undefined)micros+=asMicros(row.metadata.observation.measurement.audioSeconds);}}
    totals.audioSeconds=asSeconds(micros);return {rows:[totals]};
   }
   if(sql.includes('ORDER BY'))selected.sort((a,b)=>b.metadata.updatedAt.localeCompare(a.metadata.updatedAt)||b.id.localeCompare(a.id));
   if(sql.includes('LIMIT 1'))selected=selected.slice(0,1);else if(sql.includes('LIMIT 21'))selected=selected.slice(0,21);
   return {rows:selected.map(row=>structuredClone(row)),rowCount:selected.length};
  }
  assert.fail('Unexpected SQL in resource usage fixture');
 }};
 const workspace={async companyRead(_session,context,callback){assert.equal(context.scope,scope);if(revoked)throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);return callback(client,member,scope);}};
 const usage=createOrganizationUsage({workspace,connect:async()=>client});
 return {usage,client,rows,queries,company,revoke:()=>{revoked=true;},setInternal:()=>{internal=true;}};
}
async function reserve(f,value,actor=member){await f.usage.lockBeforeProject(f.client,actor);return f.usage.reserveResource(f.client,actor,value);}

test('an older reserved capability cannot bypass a newer unknown dispatch for the same resource/source',async()=>{
 const f=fixture(),aInput=binding(),bInput={...aInput,operationId:randomUUID()},a=await reserve(f,aInput),b=await reserve(f,bInput);
 assert.ok(a.capability);assert.ok(b.capability);assert.equal((await f.usage.fence(f.client,member,b.capability)).dispatched,true);await f.usage.unknown(b.capability);
 const recovered=await reserve(f,aInput);assert.equal(recovered.done,true);assert.equal(recovered.code,'ORGANIZATION_USAGE_RESULT_PENDING');assert.equal(recovered.capability,undefined);assert.equal(recovered.usage.receiptId,b.usage.receiptId);assert.equal(recovered.usage.state,'UNKNOWN');
 await assert.rejects(f.usage.fence(f.client,member,a.capability),{code:'ORGANIZATION_USAGE_RESULT_PENDING'});
 assert.equal(f.rows.get(a.usage.receiptId).metadata.state,'RESERVED');assert.equal(f.rows.get(b.usage.receiptId).metadata.state,'UNKNOWN');
 const dispatchWrites=f.queries.filter(({sql,args})=>sql.startsWith('UPDATE public."AuditLog"')&&JSON.parse(args[1]).state==='DISPATCHED');assert.equal(dispatchWrites.length,1);
});

test('changing actor, operation, revision or caption digest cannot release a same-source unknown dispatch',async()=>{
 const f=fixture(),input=binding(),held=await reserve(f,input);await f.usage.fence(f.client,member,held.capability);await f.usage.unknown(held.capability);
 const next=await reserve(f,{...input,operationId:randomUUID(),resourceRevision:'e'.repeat(64),requestDigest:'f'.repeat(64)},{...member,actorId:'actor-other-synthetic'});
 assert.equal(next.done,true);assert.equal(next.code,'ORGANIZATION_USAGE_RESULT_PENDING');assert.equal(next.capability,undefined);assert.equal(next.usage.receiptId,held.usage.receiptId);assert.equal(f.rows.size,1);
});

test('a different canonical source has its own reservation',async()=>{
 const f=fixture(),input=binding(),held=await reserve(f,input);await f.usage.fence(f.client,member,held.capability);await f.usage.unknown(held.capability);
 const next=await reserve(f,{...input,operationId:randomUUID(),sourceSha256:'e'.repeat(64)});assert.ok(next.capability);assert.equal(next.done,undefined);assert.equal(f.rows.size,2);
});

test('serialized receipt IDs cannot mint settlement or dispatch authority',async()=>{
 const f=fixture(),reserved=await reserve(f,binding()),fake={id:reserved.usage.receiptId},queryCount=f.queries.length;
 await assert.rejects(f.usage.fence(f.client,member,fake),{code:'ORGANIZATION_USAGE_PROOF_REQUIRED'});await assert.rejects(f.usage.observe(fake,visionFact()),{code:'ORGANIZATION_USAGE_PROOF_REQUIRED'});await assert.rejects(f.usage.unknown(fake),{code:'ORGANIZATION_USAGE_PROOF_REQUIRED'});assert.equal(f.queries.length,queryCount);assert.equal(f.rows.get(reserved.usage.receiptId).metadata.state,'RESERVED');
});

test('a minted capability cannot dispatch with a different canonical member or tampered binding',async()=>{
 const f=fixture(),reserved=await reserve(f,binding());
 for(const actor of [{...member,organizationId:'organization-other-synthetic'},{...member,actorId:'actor-other-synthetic'}])await assert.rejects(f.usage.fence(f.client,actor,reserved.capability),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});
 f.rows.get(reserved.usage.receiptId).metadata.binding.requestDigest='e'.repeat(64);await assert.rejects(f.usage.fence(f.client,member,reserved.capability),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});
});

test('settlement before dispatch and audio measurements on a vision stage are denied',async()=>{
 const f=fixture(),reserved=await reserve(f,binding());await assert.rejects(f.usage.observe(reserved.capability,visionFact()),{code:'ORGANIZATION_USAGE_NOT_DISPATCHED'});await f.usage.fence(f.client,member,reserved.capability);
 const audioFact=openAiTranscriptionUsageFact({usage:{type:'duration',seconds:4}});await assert.rejects(f.usage.observe(reserved.capability,audioFact),{code:'ORGANIZATION_USAGE_UNCONFIRMED'});assert.equal(f.rows.get(reserved.usage.receiptId).metadata.state,'DISPATCHED');
});

test('technical observation survives actor revocation without granting private company readback',async()=>{
 const f=fixture(),reserved=await reserve(f,binding());await f.usage.fence(f.client,member,reserved.capability);f.revoke();const count=f.queries.length;
 assert.equal((await f.usage.observe(reserved.capability,visionFact())).state,'OBSERVED');assert.equal(f.rows.get(reserved.usage.receiptId).metadata.state,'OBSERVED');assert.ok(f.queries.slice(count).some(({sql})=>sql.includes('pg_advisory_xact_lock')));
 assert.ok(f.queries.slice(count).every(({sql})=>!sql.includes('TenantMembership')&&!sql.includes('Worker')&&!sql.includes('Incident')));await assert.rejects(f.usage.read(session,{scope}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
});

test('technical observation still rejects an organization that became internal',async()=>{
 const f=fixture(),reserved=await reserve(f,binding());await f.usage.fence(f.client,member,reserved.capability);f.setInternal();await assert.rejects(f.usage.observe(reserved.capability,visionFact()),{code:'ORGANIZATION_USAGE_UNCONFIRMED'});assert.equal(f.rows.get(reserved.usage.receiptId).metadata.state,'DISPATCHED');
});

test('settlement is idempotent, conflicts are rejected and unknown cannot downgrade observed usage',async()=>{
 const f=fixture(),reserved=await reserve(f,binding()),fact=visionFact();await f.usage.fence(f.client,member,reserved.capability);await f.usage.observe(reserved.capability,fact);assert.equal((await f.usage.observe(reserved.capability,fact)).state,'OBSERVED');assert.equal((await f.usage.unknown(reserved.capability)).state,'OBSERVED');
 const other=openAiChatUsageFact({model:'gpt-4o',usage:{prompt_tokens:25,completion_tokens:6,total_tokens:31}});await assert.rejects(f.usage.observe(reserved.capability,other),{code:'ORGANIZATION_USAGE_OBSERVATION_CONFLICT'});assert.equal(f.rows.get(reserved.usage.receiptId).metadata.observation.usage.totalTokens,'30');
});

test('company read combines legacy plan tokens and resource audio without duplicating actions or disclosing source metadata',async()=>{
 const f=fixture(),plan=await f.usage.reserve(f.client,member,{projectId:'project-plan-synthetic',draftId:'draft-synthetic',operationId:randomUUID(),stage:'PLAN_OPENAI_EXTRACTION',sourceSha256:'e'.repeat(64),requestDigest:'f'.repeat(64),consentVersion:'plan-document-openai-v1',requestedModel:'gpt-4o'});
 await f.usage.fence(f.client,member,plan.capability);await f.usage.observe(plan.capability,openAiUsageFact({id:'resp_synthetic',model:'gpt-4o',usage:{input_tokens:100,output_tokens:4,total_tokens:104}},'req_plan_synthetic'));
 const vision=await reserve(f,binding());await f.usage.fence(f.client,member,vision.capability);await f.usage.observe(vision.capability,visionFact());
 const audio=await reserve(f,binding({stage:'FIELD_OPENAI_TRANSCRIPTION',requestedModel:'whisper-1'}));await f.usage.fence(f.client,member,audio.capability);await f.usage.observe(audio.capability,openAiTranscriptionUsageFact({text:'PRIVATE_TRANSCRIPT',duration:99,usage:{type:'duration',seconds:0.100001}},'req_audio_synthetic'));
 const value=await f.usage.read(session,{scope});assert.equal(value.summary.total,3);assert.equal(value.summary.observed,3);assert.equal(value.summary.totalTokens,'134');assert.equal(value.summary.audioSeconds,'0.100001');assert.equal(value.recent.length,3);assert.equal(value.capacity.cost,null);assert.equal(value.funding.state,'UNCONFIRMED');assert.doesNotMatch(JSON.stringify(value),/PRIVATE_TRANSCRIPT|sourceSha256|requestDigest|resourceRevision|actor-synthetic|incident-synthetic|project-plan-synthetic|resp_synthetic|req_audio_synthetic/);
});

test('company aggregates preserve token precision above safe integer and exact microsecond duration totals',async()=>{
 const f=fixture(),huge=openAiChatUsageFact({usage:{prompt_tokens:9007199254740000,completion_tokens:991,total_tokens:9007199254740991}});
 for(let index=0;index<2;index++){const reserved=await reserve(f,binding({resourceId:'incident-large-'+index}));await f.usage.fence(f.client,member,reserved.capability);await f.usage.observe(reserved.capability,huge);}
 for(const [index,seconds] of [[0,0.000001],[1,0.100001]]){const reserved=await reserve(f,binding({resourceId:'incident-audio-'+index,stage:'FIELD_OPENAI_TRANSCRIPTION',requestedModel:'whisper-1'}));await f.usage.fence(f.client,member,reserved.capability);await f.usage.observe(reserved.capability,openAiTranscriptionUsageFact({usage:{type:'duration',seconds}}));}
 const value=await f.usage.read(session,{scope});assert.equal(value.summary.totalTokens,'18014398509481982');assert.equal(value.summary.audioSeconds,'0.100002');assert.equal(value.summary.observed,4);assert.equal(value.summary.pending,0);
});

test('readback observes a settled receipt even when a prior business projection was pending',async()=>{
 const f=fixture(),reserved=await reserve(f,binding());await f.usage.fence(f.client,member,reserved.capability);await f.usage.unknown(reserved.capability);const prior=await f.usage.read(session,{scope});assert.equal(prior.summary.pending,1);assert.equal(prior.recent[0].state,'UNKNOWN');
 await f.usage.observe(reserved.capability,visionFact());const current=await f.usage.read(session,{scope});assert.equal(current.summary.pending,0);assert.equal(current.summary.observed,1);assert.equal(current.recent[0].state,'OBSERVED');assert.ok(current.recent[0].recordedAt>prior.recent[0].recordedAt);
});

for(const stage of ['toString','constructor','__proto__','NOT_A_STAGE'])test('inherited or unknown stage '+stage+' cannot enter binding, lookup or public receipts',()=>{
 const value=binding({stage,resourceType:undefined});assert.throws(()=>resourceUsageBinding({...value,organizationId:member.organizationId,actorId:member.actorId}),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});
 assert.throws(()=>resourceUsageLookup({projectId:value.projectId,resourceType:undefined,resourceId:value.resourceId,resourceRevision:value.resourceRevision,stage,sourceSha256:value.sourceSha256},member),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});
 assert.throws(()=>publicResourceUsageReceipt({id:'organization_usage_'+'a'.repeat(64),metadata:{version:2,binding:{stage},state:'RESERVED',coverage:{state:'TRIAL_CURRENT'},updatedAt:'2026-10-12T12:00:00.000Z'}}),WorkspaceError);
});

test('valid canonical bindings survive closed-stage validation and requested model misuse is rejected',()=>{
 const value=binding(),canonical=resourceUsageBinding({...value,organizationId:member.organizationId,actorId:member.actorId});assert.deepEqual(canonical,{...value,organizationId:member.organizationId,actorId:member.actorId});
 for(const patch of [{requestedModel:'whisper-1'},{stage:'FIELD_OPENAI_TRANSCRIPTION',requestedModel:'gpt-4o'},{stage:'IDENTITY_OPENAI_OCR',resourceType:'Incident',consentVersion:'participant-external-ocr-v1'}])assert.throws(()=>resourceUsageBinding({...canonical,...patch}),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});
});

test('public company read rejects a resource receipt whose canonical binding was tampered',async()=>{
 const f=fixture(),reserved=await reserve(f,binding());await f.usage.fence(f.client,member,reserved.capability);await f.usage.observe(reserved.capability,visionFact());f.rows.get(reserved.usage.receiptId).metadata.binding.sourceSha256='e'.repeat(64);
 await assert.rejects(f.usage.read(session,{scope}),WorkspaceError);
});
