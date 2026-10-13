import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {Client,Pool} from 'pg';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createOrganizationUsage} from '../src/lib/organization-usage-store.mjs';
import {ORGANIZATION_USAGE_STAGE,openAiUsageFact} from '../src/lib/organization-usage-policy.mjs';
import {openAiChatUsageFact,openAiTranscriptionUsageFact} from '../src/lib/organization-resource-usage-policy.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL} from './lib/company-channel-disposable-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {organizationUsageDisposableUrl,organizationUsageFailure} from './verify-organization-usage-postgres.mjs';

export const RESOURCE_USAGE_POSTGRES_PROOF_VERSION='resource-usage-postgres-v2';
export const RESOURCE_USAGE_POSTGRES_CHECKS=Object.freeze([
 'canonical-Worker-reservation-fence-typed-context-and-private-source-hashes',
 'canonical-Incident-vision-reservation-fence-and-observed-provider-token-units',
 'exact-observation-replay-is-idempotent-conflicting-fact-and-forged-capability-denied',
 'same-operation-settled-resource-replay-does-not-admit-another-dispatch',
 'unknown-source-holds-new-operation-current-reviewer-and-resource-revision',
 'reserved-recovery-mints-a-capability-but-only-one-fence-can-dispatch',
 'expired-trial-before-reserve-and-after-reserve-fences-zero-dispatches',
 'post-dispatch-membership-revocation-keeps-technical-observation-and-denies-private-company-read',
 'combined-company-v2-DTO-merges-legacy-plan-Worker-OCR-and-observed-audio-seconds-without-private-identifiers',
 'same-video-Incident-operation-preserves-independent-transcription-and-vision-stages',
 'canonical-foreign-project-and-resource-projection-contexts-denied',
 'current-non-admin-company-reader-denied-before-private-consumption-SQL',
 'malformed-fact-and-vision-duration-rejected-without-inventing-free-use',
 'native-resource-held-organization-lock-blocks-plan-before-Project-and-callbacks',
 'native-plan-held-organization-lock-blocks-resource-before-Project-and-callbacks',
 'older-RESERVED-capability-cannot-dispatch-after-other-operation-becomes-UNKNOWN',
]);
export const resourceUsageDisposableUrl=organizationUsageDisposableUrl;
export function resourceUsageOwnedDatabase(value){
 if(typeof value!=='string'||!/^obrasaas_resource_usage_[a-f0-9]{32}$/.test(value))throw Object.assign(new Error('RESOURCE_USAGE_OWNED_DATABASE_REJECTED'),{code:'RESOURCE_USAGE_OWNED_DATABASE_REJECTED'});
 return value;
}
const sha=value=>createHash('sha256').update(value).digest('hex');
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const gitBlob=(root,file)=>execFileSync('git',['show','HEAD:'+file],{cwd:root,stdio:['ignore','pipe','pipe']});
// Git's clean filter makes a CRLF Windows checkout and its LF committed blob
// equivalent. Separately hash the exact executed bytes before and after.
const workingBlob=(root,file)=>execFileSync('git',['hash-object','--path='+file,'--stdin'],{cwd:root,input:readFileSync(path.join(root,file)),encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
export function resourceUsageSourceFiles(root=process.cwd()){
 const files=new Set(['package.json','package-lock.json']);
 function visit(file){
  assert.match(file,/^(src|scripts|tests)\//);if(files.has(file))return;files.add(file);if(file.endsWith('.css'))return;
  const ast=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'unambiguous',plugins:['jsx']}),imports=[];
  function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source?.value)imports.push(node.source.value);if(node.type==='ImportExpression'&&node.source?.type==='StringLiteral')imports.push(node.source.value);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(ast.program);
  for(const reference of imports.filter(value=>value.startsWith('.'))){const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),reference)),resolved=[base,base+'.mjs',base+'.js'].find(candidate=>existsSync(path.join(root,candidate)));assert.ok(resolved,'Native source import must resolve');visit(resolved);}
 }
 visit('scripts/verify-resource-usage-postgres.mjs');visit('tests/production-resource-usage-postgres-target.test.mjs');return [...files].sort();
}
const tokenFact=()=>openAiChatUsageFact({id:'chatcmpl-synthetic'+randomUUID().replaceAll('-',''),model:'gpt-4o-2024-08-06',usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120,prompt_tokens_details:{cached_tokens:10},completion_tokens_details:{reasoning_tokens:0}}},'req_synthetic'+randomUUID().replaceAll('-',''));
const durationFact=(seconds=12.5)=>openAiTranscriptionUsageFact({model:'whisper-1',usage:{type:'duration',seconds}},'req_synthetic'+randomUUID().replaceAll('-',''));
let failureContext={stage:'TARGET_GUARD',check:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false};

export async function verifyResourceUsagePostgres(environment=process.env){
 failureContext={stage:'TARGET_GUARD',check:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false};
 // Validate the complete connection target before constructing any connection.
 const target=resourceUsageDisposableUrl(environment),root=process.cwd(),revision=git(root,['rev-parse','HEAD']),tree=git(root,['rev-parse','HEAD^{tree}']),trackedClean=git(root,['status','--porcelain','--untracked-files=no'])==='';
 assert.equal(trackedClean,true,'Native verification requires clean committed tracked sources');
 const exactCi=environment.CI==='true';if(exactCi){assert.match(environment.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(environment.GITHUB_SHA,revision,'CI must check out the exact event commit');}
 const sourceManifest=resourceUsageSourceFiles(root).map(file=>{const sha256=sha(readFileSync(path.join(root,file))),committedSha256=sha(gitBlob(root,file)),committedBlobOid=git(root,['rev-parse','HEAD:'+file]);assert.equal(workingBlob(root,file),committedBlobOid,'Every source import must exist unchanged in HEAD after the Git clean filter');return {path:file,sha256,committedSha256,committedBlobOid};});
 const database=resourceUsageOwnedDatabase('obrasaas_resource_usage_'+randomUUID().replaceAll('-','')),admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000});
 const checks=[],nativeLockObservations=[],trace=[];let connected=false,created=false,removed=false,pool,poolClosed=false,providerRequests=0,privateUsageQueries=0,barrier=null;
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{providerRequests++;throw new Error('RESOURCE_USAGE_UNCONTROLLED_HTTP_REJECTED');};
 try{
  failureContext={stage:'OWNED_DATABASE',check:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false};
  await admin.connect();connected=true;const authority=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(authority.db,'obrasaas_cutover_ci');assert.equal(authority.role,'cutover_test');
  resourceUsageOwnedDatabase(database);await admin.query(`CREATE DATABASE "${database}"`);created=true;
  const fixtureUrl=new URL(target);fixtureUrl.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:fixtureUrl.toString(),max:12,connectionTimeoutMillis:5000}));assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,database);
  await pool.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
  await pool.query(`ALTER TABLE "Organization" ADD COLUMN "subscriptionPlan" text DEFAULT 'TRIAL',ADD COLUMN "subscriptionStatus" text DEFAULT 'TRIALING';
   UPDATE "Organization" SET "trialEndsAt"=clock_timestamp()+interval '15 days';
   INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('director','user_Director','director@example.invalid');
   INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('director-m','director','org-a','DIRECTOR','org:member','ACTIVE');
   INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('project-web','org-a','Synthetic parallel worksite','ACTIVE','{}');
   INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('owner-a','project-a','owner-m','ACTIVE'),('owner-web','project-web','owner-m','ACTIVE'),('director-a','project-a','director-m','ACTIVE');`);
  const connect=async()=>{const client=await pool.connect();return {release:broken=>client.release(broken),query:async(sql,args)=>{
   if(sql.startsWith('BEGIN'))trace.push({pid:client.processID,stage:'BEGIN'});
   if(sql.includes('FROM public."AuditLog"')&&sql.includes('organization.usage.'))privateUsageQueries++;
   if(sql.includes('FROM public."Project"')&&sql.includes('FOR UPDATE'))trace.push({pid:client.processID,stage:'PROJECT'});
   const result=await client.query(sql,args);
   if(sql.includes('pg_advisory_xact_lock')&&args?.[0]?.startsWith('organization-usage-v1:')){
    trace.push({pid:client.processID,stage:'USAGE_ADVISORY'});
    if(barrier&&!barrier.held){barrier.held=true;barrier.pid=client.processID;barrier.reached();await barrier.wait;}
   }
   return result;
  }};};
  const workspace=createWorkspaceStore({connect}),usage=createOrganizationUsage({workspace,connect}),session=(userId,organizationId='org_A',organizationRole='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId,organizationId,organizationRole});
  const owner=session('user_Owner','org_A','org:admin'),director=session('user_Director'),foreign=session('user_Foreign','org_B','org:admin'),scopes=new Map();
  for(const actor of [owner,director,foreign])scopes.set(actor.userId,(await workspace.list(actor)).scope);
  const usageLock=(client,member)=>usage.lockBeforeProject(client,member),context=(actor,projectId)=>({projectId,scope:scopes.get(actor.userId)});
  const run=(actor,projectId,callback)=>workspace.projectOperation(actor,context(actor,projectId),true,callback,usageLock);
  async function resource({resourceType='Worker',stage=resourceType==='Worker'?'IDENTITY_OPENAI_OCR':'FIELD_OPENAI_VISION',projectId='project-a',sourceSha256=sha('synthetic-source-'+randomUUID()),operationId=randomUUID()}={}){
   assert.ok(['Worker','Incident'].includes(resourceType));const resourceId='native_'+resourceType.toLowerCase()+'_'+randomUUID().replaceAll('-',''),resourceRevision=digest(['synthetic-native-resource',resourceId,sourceSha256]),metadata={usageFixture:{sourceSha256,resourceRevision}};
   if(resourceType==='Worker')await pool.query(`INSERT INTO "Worker"(id,"projectId",name,active,metadata) VALUES($1,$2,'Synthetic identity resource',true,$3::jsonb)`,[resourceId,projectId,JSON.stringify(metadata)]);
   else await pool.query(`INSERT INTO "Incident"(id,"projectId",title,metadata) VALUES($1,$2,'Synthetic private media resource',$3::jsonb)`,[resourceId,projectId,JSON.stringify(metadata)]);
   return {version:2,projectId,resourceType,resourceId,resourceRevision,operationId,stage,sourceSha256,requestDigest:digest(['native-resource-request',operationId,stage]),consentVersion:stage==='IDENTITY_OPENAI_OCR'?'participant-external-ocr-v1':stage==='FIELD_VIDEO_TRANSCRIPTION'?'field-video-audio-transcription-v1':stage==='FIELD_VIDEO_VISION'?'field-media-analysis-v2':'field-media-analysis-v1',requestedModel:stage.includes('TRANSCRIPTION')?'whisper-1':'gpt-4o'};
  }
  const runResource=(actor,binding,callback)=>run(actor,binding.projectId,async(client,member,scope)=>{
   if(!['ADMIN','DIRECTOR'].includes(member.role))throw new WorkspaceError('PARTICIPANT_MANAGE_REQUIRED',403);
   assert.ok(['Worker','Incident'].includes(binding.resourceType));const row=(await client.query(`SELECT id,"projectId",metadata FROM public."${binding.resourceType}" WHERE id=$1 AND "projectId"=$2 FOR UPDATE`,[binding.resourceId,binding.projectId])).rows[0];assert.ok(row,'Canonical resource must exist in the selected authorized project');assert.equal(row.metadata.usageFixture.sourceSha256,binding.sourceSha256);assert.equal(row.metadata.usageFixture.resourceRevision,binding.resourceRevision);return callback(client,member,scope,row);
  });
  const reserve=(binding,actor=owner)=>runResource(actor,binding,(client,member)=>usage.reserveResource(client,member,binding));
  const fence=(binding,capability,actor=owner)=>runResource(actor,binding,(client,member)=>usage.fence(client,member,capability));
  const record=async receiptId=>(await pool.query(`SELECT id,"organizationId","actorId","entityType","entityId",metadata FROM "AuditLog" WHERE id=$1`,[receiptId])).rows[0];
  const plan=(projectId='project-web')=>({projectId,draftId:'native_plan_'+randomUUID().replaceAll('-',''),operationId:randomUUID(),stage:ORGANIZATION_USAGE_STAGE,sourceSha256:sha('synthetic-plan-'+randomUUID()),requestDigest:digest(['synthetic-plan-request',randomUUID()]),consentVersion:'plan-document-openai-v1',requestedModel:'gpt-4o'});
  const reservePlan=(binding,actor=owner)=>run(actor,binding.projectId,(client,member)=>usage.reserve(client,member,binding));
  const check=async(index,callback)=>{failureContext={...failureContext,stage:'NATIVE_CHECK',check:RESOURCE_USAGE_POSTGRES_CHECKS[index]};await callback();checks.push(RESOURCE_USAGE_POSTGRES_CHECKS[index]);failureContext.completedCheckCount=checks.length;};
  let workerBinding,workerReserved,workerFact;
  await check(0,async()=>{workerBinding=await resource();workerReserved=await reserve(workerBinding);assert.equal(workerReserved.usage.state,'RESERVED');assert.equal((await fence(workerBinding,workerReserved.capability)).dispatched,true);workerFact=tokenFact();await usage.observe(workerReserved.capability,workerFact);const saved=await record(workerReserved.usage.receiptId);assert.equal(saved.entityType,'Worker');assert.equal(saved.entityId,workerBinding.resourceId);assert.equal(saved.organizationId,'org-a');assert.equal(saved.actorId,'owner');assert.equal(saved.metadata.version,2);assert.equal(saved.metadata.binding.resourceRevision,workerBinding.resourceRevision);assert.equal(saved.metadata.binding.sourceSha256,workerBinding.sourceSha256);assert.equal(saved.metadata.binding.projectId,'project-a');assert.equal(saved.metadata.binding.consentVersion,'participant-external-ocr-v1');assert.doesNotMatch(JSON.stringify(saved.metadata),/base64|document-front|private\.blob|nombreCompleto|\bdni\b/);});
  await check(1,async()=>{const binding=await resource({resourceType:'Incident'}),reserved=await reserve(binding);await fence(binding,reserved.capability);await usage.observe(reserved.capability,tokenFact());const saved=await record(reserved.usage.receiptId);assert.equal(saved.entityType,'Incident');assert.equal(saved.entityId,binding.resourceId);assert.equal(saved.metadata.state,'OBSERVED');assert.equal(saved.metadata.observation.usage.totalTokens,'120');assert.equal(saved.metadata.observation.measurement.unit,'TOKENS');});
  await check(2,async()=>{const before=(await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='organization.usage.resource'`)).rows[0].count;assert.equal((await usage.observe(workerReserved.capability,workerFact)).state,'OBSERVED');const conflicting={...workerFact,usage:{...workerFact.usage,inputTokens:'101',totalTokens:'121'}};await assert.rejects(usage.observe(workerReserved.capability,conflicting),{code:'ORGANIZATION_USAGE_OBSERVATION_CONFLICT'});await assert.rejects(usage.observe(JSON.parse(JSON.stringify(workerReserved.capability)),workerFact),{code:'ORGANIZATION_USAGE_PROOF_REQUIRED'});assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='organization.usage.resource'`)).rows[0].count,before);});
  await check(3,async()=>{const replay=await reserve(workerBinding);assert.equal(replay.done,true);assert.equal(replay.code,'ORGANIZATION_USAGE_ALREADY_DISPATCHED');assert.equal(replay.capability,undefined);await assert.rejects(fence(workerBinding,workerReserved.capability),{code:'ORGANIZATION_USAGE_ALREADY_DISPATCHED'});});
  await check(4,async()=>{const binding=await resource(),reserved=await reserve(binding);await fence(binding,reserved.capability);await usage.unknown(reserved.capability);const changed={...binding,operationId:randomUUID(),resourceRevision:digest(['changed-canonical-revision',binding.resourceId]),requestDigest:digest(['new-current-reviewer',randomUUID()])};await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{usageFixture,resourceRevision}',to_jsonb($2::text)),"updatedAt"=clock_timestamp() WHERE id=$1`,[binding.resourceId,changed.resourceRevision]);const held=await reserve(changed,director);assert.equal(held.done,true);assert.equal(held.code,'ORGANIZATION_USAGE_RESULT_PENDING');assert.equal(held.usage.receiptId,reserved.usage.receiptId);assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='organization.usage.resource' AND "entityId"=$1`,[binding.resourceId])).rows[0].count,1);});
  await check(5,async()=>{const binding=await resource(),first=await reserve(binding),recovered=await reserve(binding);assert.equal(recovered.recovered,true);assert.equal(first.usage.receiptId,recovered.usage.receiptId);await fence(binding,recovered.capability);await assert.rejects(fence(binding,first.capability),{code:'ORGANIZATION_USAGE_ALREADY_DISPATCHED'});await usage.observe(recovered.capability,tokenFact());});
  await check(6,async()=>{const binding=await resource(),before=(await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='organization.usage.resource'`)).rows[0].count;await pool.query(`UPDATE "Organization" SET "trialEndsAt"=clock_timestamp()-interval '1 second' WHERE id='org-a'`);try{const deferred=await reserve(binding);assert.equal(deferred.deferred,true);assert.equal(deferred.code,'ORGANIZATION_USAGE_COVERAGE_EXPIRED');assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='organization.usage.resource'`)).rows[0].count,before);}finally{await pool.query(`UPDATE "Organization" SET "trialEndsAt"=clock_timestamp()+interval '15 days' WHERE id='org-a'`);}const pending=await reserve(binding);await pool.query(`UPDATE "Organization" SET "trialEndsAt"=clock_timestamp()-interval '1 second' WHERE id='org-a'`);try{assert.equal((await fence(binding,pending.capability)).deferred,true);assert.equal((await record(pending.usage.receiptId)).metadata.state,'RESERVED');}finally{await pool.query(`UPDATE "Organization" SET "trialEndsAt"=clock_timestamp()+interval '15 days' WHERE id='org-a'`);}});
  await check(7,async()=>{const binding=await resource(),reserved=await reserve(binding);await fence(binding,reserved.capability);await pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='owner-m'`);try{await usage.observe(reserved.capability,tokenFact());assert.equal((await record(reserved.usage.receiptId)).metadata.state,'OBSERVED');const before=privateUsageQueries;await assert.rejects(usage.read(owner,{scope:scopes.get(owner.userId)}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal(privateUsageQueries,before);}finally{await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='owner-m'`);}});
  await check(8,async()=>{const legacy=plan('project-b'),legacyReserved=await reservePlan(legacy,foreign);await run(foreign,'project-b',(client,member)=>usage.fence(client,member,legacyReserved.capability));await usage.observe(legacyReserved.capability,openAiUsageFact({id:'resp_synthetic_dto',model:'gpt-4o',usage:{input_tokens:10,output_tokens:2,total_tokens:12}},'req_synthetic_dto'));const worker=await resource({projectId:'project-b'}),ocr=await reserve(worker,foreign);await fence(worker,ocr.capability,foreign);await usage.observe(ocr.capability,tokenFact());const audio=await resource({resourceType:'Incident',projectId:'project-b',stage:'FIELD_OPENAI_TRANSCRIPTION'}),audioReserved=await reserve(audio,foreign);await fence(audio,audioReserved.capability,foreign);await usage.observe(audioReserved.capability,durationFact());const dto=await usage.read(foreign,{scope:scopes.get(foreign.userId)});assert.equal(dto.version,2);assert.deepEqual(dto.summary,{total:3,reserved:0,pending:0,observed:3,unmeasured:0,inputTokens:'110',outputTokens:'22',totalTokens:'132',audioSeconds:'12.5'});assert.equal(dto.capacity.cost,null);assert.equal(dto.recent.find(row=>row.stage==='FIELD_OPENAI_TRANSCRIPTION').usage,null);assert.doesNotMatch(JSON.stringify(dto),/native_worker_|native_incident_|native_plan_|project-b|sourceSha256|resourceRevision|chatcmpl-|req_synthetic|resp_synthetic|user_Foreign/);});
  await check(9,async()=>{const audio=await resource({resourceType:'Incident',stage:'FIELD_VIDEO_TRANSCRIPTION'}),vision={...audio,stage:'FIELD_VIDEO_VISION',consentVersion:'field-media-analysis-v2',requestedModel:'gpt-4o',requestDigest:digest(['same-video-vision',audio.operationId])},a=await reserve(audio),v=await reserve(vision);assert.notEqual(a.usage.receiptId,v.usage.receiptId);await fence(audio,a.capability);await fence(vision,v.capability);await usage.observe(a.capability,durationFact(7.25));await usage.observe(v.capability,tokenFact());const rows=(await pool.query(`SELECT metadata FROM "AuditLog" WHERE action='organization.usage.resource' AND "entityId"=$1`,[audio.resourceId])).rows;assert.equal(rows.length,2);assert.ok(rows.every(row=>row.metadata.state==='OBSERVED'));assert.deepEqual(new Set(rows.map(row=>row.metadata.binding.stage)),new Set(['FIELD_VIDEO_TRANSCRIPTION','FIELD_VIDEO_VISION']));});
  await check(10,async()=>{const value={receiptId:workerReserved.usage.receiptId,resourceType:'Worker',resourceId:workerBinding.resourceId,projectId:'project-a'};await assert.rejects(run(foreign,'project-b',(client,member)=>usage.resourceProjection(client,member,value)),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});const before=privateUsageQueries;await assert.rejects(workspace.projectOperation(foreign,context(foreign,'project-a'),true,(client,member)=>usage.resourceProjection(client,member,value),usageLock),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(privateUsageQueries,before);await assert.rejects(run(owner,'project-a',(client,member)=>usage.resourceProjection(client,member,{...value,resourceId:'foreign-synthetic-worker'})),{code:'ORGANIZATION_USAGE_BINDING_REJECTED'});});
  await check(11,async()=>{const before=privateUsageQueries;await assert.rejects(usage.read(director,{scope:scopes.get(director.userId)}),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});assert.equal(privateUsageQueries,before);});
  await check(12,async()=>{const binding=await resource(),reserved=await reserve(binding);await fence(binding,reserved.capability);const malformed=tokenFact();malformed.usage.totalTokens='121';await assert.rejects(usage.observe(reserved.capability,malformed),{code:'ORGANIZATION_USAGE_UNCONFIRMED'});await assert.rejects(usage.observe(reserved.capability,durationFact()),{code:'ORGANIZATION_USAGE_UNCONFIRMED'});assert.equal((await record(reserved.usage.receiptId)).metadata.state,'DISPATCHED');await usage.unknown(reserved.capability);await usage.observe(reserved.capability,openAiChatUsageFact(null));const saved=await record(reserved.usage.receiptId);assert.equal(saved.metadata.state,'UNMEASURED');assert.equal(saved.metadata.observation.usage,null);assert.equal(saved.metadata.cost,null);});
  async function race(firstTransport){
   const binding=await resource(),legacy=plan();let reached,release,callbacks=0;const reachedPromise=new Promise(resolve=>{reached=resolve;});barrier={held:false,pid:null,reached,wait:new Promise(resolve=>{release=resolve;})};
   const resourceRun=()=>runResource(owner,binding,async(client,member)=>{callbacks++;return usage.reserveResource(client,member,binding);}),planRun=()=>run(owner,legacy.projectId,async(client,member)=>{callbacks++;return usage.reserve(client,member,legacy);});let first,second;
   try{
    first=(firstTransport==='RESOURCE'?resourceRun:planRun)();first.catch(()=>{});await Promise.race([reachedPromise,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Native organization advisory barrier was not reached')),1500))]);second=(firstTransport==='RESOURCE'?planRun:resourceRun)();second.catch(()=>{});
    const deadline=Date.now()+1200;let waiting=[];while(Date.now()<deadline){waiting=(await pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'`)).rows;if(waiting.length)break;await new Promise(resolve=>setTimeout(resolve,20));}
    assert.ok(waiting.length>=1,'The second canonical transaction must wait at the organization advisory lock');assert.equal(callbacks,0,'Neither business callback can run while the first pre-project hook is held');
    for(const waiter of waiting){assert.notEqual(waiter.pid,barrier.pid);const current=trace.filter(item=>item.pid===waiter.pid),begin=current.findLastIndex(item=>item.stage==='BEGIN');assert.ok(begin>=0);assert.equal(current.slice(begin+1).some(item=>item.stage==='PROJECT'),false,'Waiting transaction must not acquire Project before the usage hook');}
    release();const values=await Promise.all([first,second]);assert.equal(values.length,2);assert.equal(callbacks,2);nativeLockObservations.push({firstTransport,secondTransport:firstTransport==='RESOURCE'?'PLAN':'RESOURCE',sameOrganization:true,differentProjects:true,waitingCount:waiting.length,waitingBeforeProject:true,callbacksWhileHeld:0,bothCompleted:true});
   }finally{release?.();barrier=null;await Promise.allSettled([first,second].filter(Boolean));}
  }
  await check(13,()=>race('RESOURCE'));await check(14,()=>race('PLAN'));
  await check(15,async()=>{const first=await resource({resourceType:'Incident'}),second={...first,operationId:randomUUID(),requestDigest:digest(['new-reserved-operation',randomUUID()])},a=await reserve(first),b=await reserve(second);assert.equal(a.usage.state,'RESERVED');assert.equal(b.usage.state,'RESERVED');assert.notEqual(a.usage.receiptId,b.usage.receiptId);await fence(second,b.capability);await usage.unknown(b.capability);const recovered=await reserve(first);assert.equal(recovered.done,true);assert.equal(recovered.code,'ORGANIZATION_USAGE_RESULT_PENDING');assert.equal(recovered.usage.receiptId,b.usage.receiptId);await assert.rejects(fence(first,a.capability),{code:'ORGANIZATION_USAGE_RESULT_PENDING'});const records=(await pool.query(`SELECT metadata->>'state' AS state FROM "AuditLog" WHERE action='organization.usage.resource' AND "entityId"=$1`,[first.resourceId])).rows;assert.deepEqual(records.map(row=>row.state).sort(),['RESERVED','UNKNOWN']);});
  assert.deepEqual(checks,[...RESOURCE_USAGE_POSTGRES_CHECKS]);assert.equal(nativeLockObservations.length,2);assert.equal(providerRequests,0);assert.equal(git(root,['rev-parse','HEAD']),revision);assert.equal(git(root,['rev-parse','HEAD^{tree}']),tree);assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'');for(const item of sourceManifest){assert.equal(sha(readFileSync(path.join(root,item.path))),item.sha256);assert.equal(sha(gitBlob(root,item.path)),item.committedSha256);assert.equal(workingBlob(root,item.path),item.committedBlobOid);}
 }finally{
  globalThis.fetch=originalFetch;let cleanupError;
  try{if(pool){await closeDisposablePool(pool);poolClosed=true;failureContext.poolClosed=true;}}catch(error){cleanupError=error;}
  try{if(connected&&created){resourceUsageOwnedDatabase(database);assert.equal((await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0].db,'obrasaas_cutover_ci');assert.equal((await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].count,0,'Close every owned fixture socket before dropping the database');await admin.query(`DROP DATABASE "${database}"`);removed=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rows.length===0;failureContext.databaseRemoved=removed;}}catch(error){cleanupError||=error;}
  finally{if(connected)await admin.end();}
  if(cleanupError)throw cleanupError;
 }
 assert.equal(removed,true);assert.equal(poolClosed,true);
 return {status:'PASS',version:RESOURCE_USAGE_POSTGRES_PROOF_VERSION,recordedAt:new Date().toISOString(),syntheticOnly:true,postgresExecuted:true,totalCheckCount:checks.length,checks,sourceRevision:revision,sourceTree:tree,sourceState:exactCi?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',trackedClean,harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url))),sourceManifest,providerRequests,nativeLockObservations,productionDataWritten:false,identityPresented:false,identityApproved:false,identityCertified:false,paymentAttempted:false,capacityContractPending:true,cost:null,databaseRemoved:removed,poolClosed,cleanup:{databaseRemoved:removed,poolClosed}};
}

export function resourceUsageFailure(error,{root=process.cwd(),context=failureContext}={}){
 return {...organizationUsageFailure(error,{root,context}),version:RESOURCE_USAGE_POSTGRES_PROOF_VERSION,check:RESOURCE_USAGE_POSTGRES_CHECKS.includes(context.check)?context.check:null,completedCheckCount:Number.isInteger(context.completedCheckCount)&&context.completedCheckCount>=0&&context.completedCheckCount<=RESOURCE_USAGE_POSTGRES_CHECKS.length?context.completedCheckCount:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyResourceUsagePostgres().then(proof=>{const out=path.resolve('.vercel/private/resource-usage-postgres.json');mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,totalCheckCount:proof.totalCheckCount,postgresExecuted:proof.postgresExecuted,databaseRemoved:proof.databaseRemoved,poolClosed:proof.poolClosed,providerRequests:proof.providerRequests}));}).catch(error=>{const proof=resourceUsageFailure(error),out=path.resolve('.vercel/private/resource-usage-postgres-failure.json');mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.error(JSON.stringify({status:'FAILED',code:proof.code,stage:proof.stage,check:proof.check,errorName:proof.errorName}));process.exitCode=1;});
}
