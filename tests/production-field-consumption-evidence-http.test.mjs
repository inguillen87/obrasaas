import test from 'node:test';
import assert from 'node:assert/strict';
import {createConsumptionEvidenceCatalog,createConsumptionEvidenceHandler,consumptionEvidenceQuery} from '../src/lib/consumption-evidence-http.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {scopeStamp,digest} from '../src/lib/workspace-policy.mjs';

const identity={authenticated:true,verification:'clerk-production-jwt',userId:'user_A',organizationId:'org_A',organizationRole:'org:member'},membership={actorId:'actor-a',membershipId:'membership-a',role:'AUDITOR',organizationId:'company-a',officeReviewOnly:false},scope=scopeStamp(identity,membership),base={projectId:'project-a',scope,workerId:'worker-a',sectorId:'sector-a',taskId:null};
const query=value=>new URLSearchParams({...base,taskId:'',...value}),url=value=>'https://obrasaas.com/api/identity/consumption-evidence?'+query(value);
function fixture(change={}){
 const images=[{id:'document-front',kind:'DOCUMENT_FRONT',sha256:'a'.repeat(64),bytes:8,contentType:'image/png'},{id:'selfie',kind:'SELFIE',sha256:'b'.repeat(64),bytes:8,contentType:'image/png'}],kyc={version:1,status:'APPROVED',submissionId:'kyc-a',contentHash:digest(images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])),images,review:{decision:'APPROVED',actorId:'reviewer-a',recordedAt:'2026-10-19T12:00:00.000Z'}},worker={id:'worker-a',projectId:'project-a',active:true,metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:'user_A',permissions:{report:true},kyc}}},queries=[];
 change.worker?.(worker);const currentMember={...membership,...change.member},session={...identity,...change.session},currentScope=scopeStamp(session,currentMember);let released=0;
 const client={release(){released++;},async query(sql,args){
  queries.push({sql,args:structuredClone(args)});assert.doesNotMatch(sql,/FOR SHARE|FOR UPDATE|\bCOMMIT\b|^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER)\b/);
  if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'||sql==='ROLLBACK'||sql.startsWith('SET LOCAL '))return {rows:[]};
  if(sql.includes('FROM public."PlatformUser"')){assert.deepEqual(args,[session.userId,session.organizationId,session.organizationRole]);assert.match(sql,/m\.status='ACTIVE'/);return {rows:change.membershipMissing?[]:[currentMember]};}
  if(sql.includes('SELECT id,name,status::text AS status FROM public."Project"')){assert.deepEqual(args,['project-a','company-a']);return {rows:change.projectMissing?[]:[{id:'project-a',name:'Test',status:'ACTIVE'}]};}
  if(sql.includes('SELECT w.id FROM public."Worker"')){assert.deepEqual(args,['company-a',session.userId]);return {rows:[{id:'worker-a'}]};}
  if(sql.includes('FROM public."ProjectMembership"')){assert.deepEqual(args,['project-a','membership-a']);assert.match(sql,/status='ACTIVE'/);return {rows:change.assignmentMissing?[]:[{id:'assignment-a'}]};}
  if(sql.includes('FROM public."Worker"')&&sql.includes("metadata->'participant'->>'clerkUserId'")){assert.deepEqual(args,['project-a',session.userId]);return {rows:[worker]};}
  if(sql.includes("metadata->>'kind'='REVIEW_KYC'")){assert.deepEqual(args,['company-a',kyc.review.actorId,'worker-a','project-a','kyc-a']);return {rows:change.reviewMissing?[]:[{id:'review-a',metadata:{}}]};}
  if(sql.includes("metadata->>'kind'='KYC_SUBMITTED'")){assert.deepEqual(args,['company-a','actor-a','worker-a','project-a','kyc-a']);return {rows:[{id:'submission-a',metadata:{contentHash:kyc.contentHash}}]};}
  if(sql.includes('SELECT p.id,p.name,p.metadata')){assert.deepEqual(args,['project-a','company-a']);return {rows:[{id:'project-a',metadata:{fieldOperations:{sectors:change.sectorMissing?[]:[{id:'sector-a'}]}}}]};}
  if(sql.includes('FROM public."Worker" WHERE id=$1')){assert.deepEqual(args,['worker-a','project-a']);assert.match(sql,/active=true/);return {rows:worker.active?[worker]:[]};}
  if(sql.includes('FROM public."Task"')){assert.deepEqual(args,['task-outside-100','project-a']);assert.doesNotMatch(sql,/LIMIT/);return {rows:change.taskMissing?[]:[{id:'task-outside-100'}]};}
  if(sql.includes('FROM public."Incident"')){assert.deepEqual(args.slice(0,6),['project-a',change.taskId??null,'worker-a','actor-a','company-a','sector-a']);assert.match(sql,/recordedBy'=\$4/);assert.doesNotMatch(sql,/processing/);return {rows:[]};}
  assert.fail('Unexpected read: '+sql);
 }};
 const workspace=createWorkspaceStore({connect:async()=>client}),store=createConsumptionEvidenceCatalog({workspace});return {store,session,scope:currentScope,queries,released:()=>released};
}
test('wire requires explicit nullable task and rejects duplicate extra oversized or inconsistent paging input',()=>{
 assert.deepEqual(consumptionEvidenceQuery(query()),{...base,page:null,direction:'FIRST',selectedIds:[]});
 const page={contextDigest:'a'.repeat(64),first:null,last:null,hasNext:false,hasPrevious:false};
 for(const params of [query({direction:'NEXT'}),query({page:JSON.stringify(page)}),query({page:'null',direction:'FIRST'}),query({page:'x'.repeat(1201)}),query({selectedIds:'x'.repeat(2001)}),query({selectedIds:'["a","a"]'}),query({selectedIds:JSON.stringify(Array.from({length:11},(_,i)=>'e-'+i))}),query({page:JSON.stringify({...page,extra:true}),direction:'REFRESH'})])assert.throws(()=>consumptionEvidenceQuery(params),{code:'CONSUMPTION_EVIDENCE_QUERY_INVALID'});
 const missing=query();missing.delete('taskId');assert.throws(()=>consumptionEvidenceQuery(missing),{code:'CONSUMPTION_EVIDENCE_QUERY_INVALID'});const duplicate=query();duplicate.append('scope',scope);assert.throws(()=>consumptionEvidenceQuery(duplicate),{code:'CONSUMPTION_EVIDENCE_QUERY_INVALID'});assert.throws(()=>consumptionEvidenceQuery(query({provider:'anything'})),{code:'CONSUMPTION_EVIDENCE_QUERY_INVALID'});
 assert.equal(consumptionEvidenceQuery(query({selectedIds:JSON.stringify(Array.from({length:10},(_,i)=>'e-'+i))})).selectedIds.length,10);
});
test('canonical participant read authenticates membership assignment KYC and exact task within a read-only transaction',async()=>{
 const f=fixture({taskId:'task-outside-100'}),result=await f.store.read(f.session,{...base,taskId:'task-outside-100'});assert.deepEqual(Object.keys(result).sort(),['projectId','scope','workerId','taskId','sectorId','entries','evidence','page','unavailableIds'].sort());assert.deepEqual(result.unavailableIds,[]);assert.equal(result.scope,scope);assert.equal(result.taskId,'task-outside-100');assert.deepEqual(result.entries,[]);assert.deepEqual(result.evidence,[]);
 assert.equal(f.queries[0].sql,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.queries.at(-1).sql,'ROLLBACK');assert.equal(f.released(),1);assert.ok(f.queries.some(q=>q.sql.includes('FROM public."ProjectMembership"')));assert.ok(f.queries.some(q=>q.sql.includes("metadata->>'kind'='REVIEW_KYC'")));assert.ok(f.queries.some(q=>q.sql.includes('FROM public."Task"')));
});
test('revoked current membership assignment ownership reporting permission KYC sector or task blocks catalogue rows',async()=>{
 for(const [change,code] of [[{membershipMissing:true},'WORKSPACE_MEMBERSHIP_REQUIRED'],[{assignmentMissing:true},'WORKSPACE_PROJECT_UNAVAILABLE'],[{worker:w=>w.active=false},'PARTICIPANT_KYC_REVIEW_REQUIRED'],[{worker:w=>w.metadata.participant.status='SUSPENDED'},'PARTICIPANT_KYC_REVIEW_REQUIRED'],[{worker:w=>w.metadata.participant.clerkUserId='user_Other'},'PARTICIPANT_KYC_REVIEW_REQUIRED'],[{worker:w=>w.metadata.participant.permissions.report=false},'FIELD_EVIDENCE_UNAVAILABLE'],[{reviewMissing:true},'PARTICIPANT_KYC_REVIEW_REQUIRED'],[{worker:w=>w.metadata.participant.kyc.status='REJECTED'},'PARTICIPANT_KYC_REVIEW_REQUIRED'],[{sectorMissing:true},'FIELD_SECTOR_UNAVAILABLE'],[{taskId:'task-outside-100',taskMissing:true},'WORKSPACE_TASK_UNAVAILABLE']]){const f=fixture(change);await assert.rejects(f.store.read(f.session,{...base,taskId:change.taskId??null}),{code});assert.equal(f.queries.some(q=>q.sql.includes('FROM public."Incident"')),false);assert.equal(f.released(),1);}
 const stale=fixture();await assert.rejects(stale.store.read(stale.session,{...base,scope:'f'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(stale.queries.some(q=>q.sql.includes('FROM public."Worker"')),false);
});
test('an administrator still requires their own reporting participant and current independent KYC receipts',async()=>{
 for(const [mutate,code] of [[w=>w.metadata.participant.clerkUserId='user_Other','FIELD_EVIDENCE_UNAVAILABLE'],[w=>w.metadata.participant.permissions.report=false,'FIELD_EVIDENCE_UNAVAILABLE'],[w=>w.metadata.participant.kyc.review.actorId='actor-a','FIELD_KYC_REVIEW_REQUIRED']]){const f=fixture({member:{role:'ADMIN'},session:{organizationRole:'org:admin'},worker:mutate});await assert.rejects(f.store.read(f.session,{...base,scope:f.scope}),{code});assert.equal(f.queries.some(q=>q.sql.includes('FROM public."Incident"')),false);}
});
test('HTTP denies cross-origin writes invalid identity and invalid input before the reader and always sends private headers',async()=>{
 let reads=0;const handler=createConsumptionEvidenceHandler({verify:async()=>identity,store:{read:async()=>{reads++;return {ok:true};}}});
 for(const [request,status] of [[new Request(url(),{headers:{origin:'https://foreign.example'}}),403],[new Request(url(),{headers:{'sec-fetch-site':'cross-site'}}),403],[new Request(url(),{method:'POST',body:'{}'}),405],[new Request(url({extra:'x'})),400]]){const response=await handler(request);assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('vary'),'Cookie, Authorization');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');}
 for(const [session,status] of [[{authenticated:false},401],[{...identity,verification:'unverified'},401],[{authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'},503]]){const denied=createConsumptionEvidenceHandler({verify:async()=>session,store:{read:async()=>{reads++;}}});assert.equal((await denied(new Request(url()))).status,status);}
 assert.equal(reads,0);
});
test('HTTP accepts the canonical read-only result and suppresses unexpected reader details',async()=>{
 const f=fixture(),handler=createConsumptionEvidenceHandler({verify:async()=>f.session,store:f.store}),response=await handler(new Request(url(),{headers:{origin:'https://obrasaas.com','sec-fetch-site':'same-origin'}}));assert.equal(response.status,200);assert.equal((await response.json()).taskId,null);
 const broken=createConsumptionEvidenceHandler({verify:async()=>identity,store:{read:async()=>{throw new Error('PRIVATE_DATABASE_DETAIL');}}}),failure=await broken(new Request(url()));assert.equal(failure.status,503);assert.deepEqual(await failure.json(),{saved:false,code:'CONSUMPTION_EVIDENCE_UNCONFIRMED'});
});
