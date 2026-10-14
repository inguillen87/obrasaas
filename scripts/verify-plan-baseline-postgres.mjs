import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {Client,Pool} from 'pg';
import {WorkspaceError,scopeStamp} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createPlanImport} from '../src/lib/plan-import-store.mjs';
import {createPlanImportAnalyzer} from '../src/lib/plan-import-analyzer.mjs';
import {decodePlanSource,PLAN_IMPORT_CYP_CURVE_CONSENT,PLAN_IMPORT_MONTHLY_CURVE_CONSENT} from '../src/lib/plan-import-policy.mjs';
import {createPlanBaseline} from '../src/lib/plan-baseline-store.mjs';
import {createPlanBaselineHandlers} from '../src/lib/plan-baseline-http.mjs';
import {planBaselineSelectionDigest,planBaselineCursor} from '../src/lib/plan-baseline-policy.mjs';
import {cypCurveFixture} from '../tests/fixtures/plan-import-cyp-curve-synthetic.mjs';
import {monthlyCurveFixture} from '../tests/fixtures/plan-import-monthly-curve-synthetic.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';

export const PLAN_BASELINE_POSTGRES_VERSION='plan-baseline-postgres-v1';
export const PLAN_BASELINE_POSTGRES_CHECKS=Object.freeze([
 'real-local-OOXML-APPLIED-receipts-no-automatic-baseline',
 'explicit-HTTP-selection-preserves-original-financial-curve',
 'native-held-Project-lock-blocks-selection-before-CAS',
 'concurrent-same-operation-one-immutable-selection',
 'concurrent-stale-CAS-one-winner-one-audited-rejection',
 'replacement-old-replay-original-snapshot-no-reactivation',
 'actual-COMMIT-lost-ACK-recovers-durable-selection',
 'actual-ROLLBACK-remains-uncertain-same-operation-retry',
 'active-write-failure-rolls-back-selection-receipt',
 'current-role-membership-project-tenant-scope-deny-private-data',
 'tampered-active-pointer-APPLY-receipt-and-source-fail-closed',
 'native-candidate-pagination-bound-to-current-project-scope',
 'all-selection-reads-preserve-Tasks-imports-and-original-curve',
]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function planBaselineDisposableUrl(environment={}){
 let url;try{url=new URL(environment.CUTOVER_TEST_DATABASE_URL);}catch{throw new WorkspaceError('PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED');}
 if(environment.CUTOVER_TEST_DISPOSABLE!=='1'||['VERCEL','VERCEL_ENV','VERCEL_TARGET','VERCEL_TARGET_ENV'].some(k=>environment[k])||!['postgres:','postgresql:'].includes(url.protocol)||!['localhost','127.0.0.1'].includes(url.hostname)||!['5432','6549'].includes(url.port)||url.username!=='cutover_test'||!['','cutover_test'].includes(url.password)||url.pathname!=='/obrasaas_cutover_ci'||url.search||url.hash)throw new WorkspaceError('PLAN_BASELINE_DISPOSABLE_TARGET_REJECTED');
 return url;
}
export function planBaselineOwnedDatabase(value){if(typeof value!=='string'||!/^obrasaas_plan_baseline_[a-f0-9]{32}$/.test(value))throw new WorkspaceError('PLAN_BASELINE_OWNED_DATABASE_REJECTED');return value;}
export function planBaselinePostgresSourceFiles(root=process.cwd()){
 const files=new Set(['package.json','package-lock.json']);
 function visit(file){
  assert.match(file,/^(src|scripts|tests)\//);assert.equal(file.includes('..'),false);if(files.has(file))return;files.add(file);if(!/\.(mjs|js)$/.test(file))return;
  const ast=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'unambiguous',plugins:['jsx']}),imports=[];
  function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source?.value)imports.push(node.source.value);if(node.type==='ImportExpression'){assert.equal(node.source.type,'StringLiteral');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){assert.equal(node.arguments[0]?.type,'StringLiteral');imports.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(ast.program);
  for(const ref of imports.filter(v=>v.startsWith('.'))){const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)),found=[base,base+'.mjs',base+'.js'].find(p=>existsSync(path.join(root,p)));assert.ok(found,'Every actual source import must resolve');visit(found);}
 }
 visit('scripts/verify-plan-baseline-postgres.mjs');visit('tests/production-plan-baseline-postgres-target.test.mjs');visit('src/app/api/identity/plan-baseline/route.js');return [...files].sort();
}
const SCHEMA=`CREATE TABLE "Organization"(id text PRIMARY KEY,name text,"clerkOrganizationId" text,metadata jsonb);
 CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text);
 CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","userId" text REFERENCES "PlatformUser","tenantRole" text,"clerkRole" text,status text);
 CREATE TABLE "Project"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text,status text,metadata jsonb,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "ProjectMembership"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status text);
 CREATE TABLE "Worker"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",active boolean DEFAULT true,metadata jsonb DEFAULT '{}');
 CREATE TABLE "Task"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text,status text,progress int,"startsAt" timestamp,"endsAt" timestamp,metadata jsonb,"updatedAt" timestamp);
 CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text,"entityType" text,"entityId" text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO "Organization" VALUES('company-a','Synthetic A','org_A','{}'),('company-b','Synthetic B','org_B','{}');
 INSERT INTO "PlatformUser" VALUES('owner','user_Owner'),('director','user_Director'),('manager','user_Manager'),('foreign','user_Foreign');
 INSERT INTO "TenantMembership" VALUES('m-owner','company-a','owner','ADMIN','org:admin','ACTIVE'),('m-director','company-a','director','DIRECTOR','org:member','ACTIVE'),('m-manager','company-a','manager','SITE_MANAGER','org:member','ACTIVE'),('m-foreign','company-b','foreign','ADMIN','org:admin','ACTIVE');
 INSERT INTO "Project"(id,"organizationId",name,status,metadata) SELECT 'p-'||name,'company-a','Synthetic '||name,'ACTIVE','{"sentinel":"unchanged"}' FROM unnest(ARRAY['a','lock','same','cas','rollback','pagination']) name;
 INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('p-foreign','company-b','Synthetic foreign','ACTIVE','{}');
 INSERT INTO "ProjectMembership" VALUES('pm-manager','p-a','m-manager','ACTIVE');`;
const owner={authenticated:true,verification:'clerk-production-jwt',userId:'user_Owner',organizationId:'org_A',organizationRole:'org:admin'};
const director={...owner,userId:'user_Director',organizationRole:'org:member'},manager={...owner,userId:'user_Manager',organizationRole:'org:member'},foreign={...owner,userId:'user_Foreign',organizationId:'org_B'};
const members={user_Owner:{membershipId:'m-owner',organizationId:'company-a',role:'ADMIN'},user_Director:{membershipId:'m-director',organizationId:'company-a',role:'DIRECTOR'},user_Manager:{membershipId:'m-manager',organizationId:'company-a',role:'SITE_MANAGER'},user_Foreign:{membershipId:'m-foreign',organizationId:'company-b',role:'ADMIN'}};
const context=(projectId='p-a',session=owner)=>({projectId,scope:scopeStamp(session,members[session.userId])});
const command=(draft,previous=null,projectId='p-a',session=owner)=>({action:'SELECT',...context(projectId,session),operationId:randomUUID(),draftId:draft.id,draftRevision:draft.revision,decisionReceiptId:draft.decision.receiptId,sourceSha256:draft.source.sha256,expectedBaselineId:previous?.id||null,expectedBaselineRevision:previous?.revision||0,reason:'Explicit native synthetic approved plan selection',confirmed:true});
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function sourceManifest(root){return planBaselinePostgresSourceFiles(root).map(file=>{const b=readFileSync(path.join(root,file));return {path:file,sha256:sha(b),bytes:b.length,worktreeGitBlobOid:git(root,['hash-object','--path='+file,file])};});}

export async function verifyPlanBaselinePostgres(environment=process.env){
 const url=planBaselineDisposableUrl(environment),root=process.cwd(),baseRevision=git(root,['rev-parse','HEAD']),baseTree=git(root,['rev-parse','HEAD^{tree}']),trackedClean=git(root,['status','--porcelain'])==='',exactCi=environment.CI==='true';
 if(exactCi)assert.equal(trackedClean,true,'CI requires committed clean source');assert.equal(new Intl.DateTimeFormat().resolvedOptions().timeZone,'UTC');
 const beforeSource=sourceManifest(root),database=planBaselineOwnedDatabase('obrasaas_plan_baseline_'+randomUUID().replaceAll('-','')),admin=new Client({connectionString:url.toString(),connectionTimeoutMillis:5000});
 let connected=false,created=false,pool,blocker,poolClosed=false,removed=false,adminClosed=false,activity=null,failure=null,engine=null;const checks=[],lockObservations=[],objects=new Map();let syntheticBlobWrites=0,syntheticBlobReads=0,analyses=0,uncontrolledFetchAttempts=0;
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{uncontrolledFetchAttempts++;throw Error('No uncontrolled HTTP transport permitted');};
 const completed=index=>{assert.equal(checks.length,index);checks.push({check:PLAN_BASELINE_POSTGRES_CHECKS[index],status:'PASS'});};
 try{
  await admin.connect();connected=true;const authority=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(authority.db,'obrasaas_cutover_ci');assert.equal(authority.role,'cutover_test');
  await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8,connectionTimeoutMillis:5000,application_name:'obrasaas-plan-baseline-native'}));
  engine=(await pool.query('SELECT version() AS version,current_setting(\'server_version_num\') AS number,current_setting(\'TimeZone\') AS timezone')).rows[0];assert.equal(engine.timezone,'UTC');await pool.query(SCHEMA);
  const workspace=createWorkspaceStore({connect:()=>pool.connect()}),baselines=createPlanBaseline({workspace}),analyzer=createPlanImportAnalyzer({environment:()=>{throw Error('No AI credentials permitted');},fetchImpl:()=>{throw Error('No provider permitted');}}),imports=createPlanImport({workspace,analyzer:{analyze(...args){analyses++;return analyzer.analyze(...args);}},environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_synthetic'}),put:async(pathname,bytes,options)=>{syntheticBlobWrites++;assert.equal(options.access,'private');assert.equal(objects.has(pathname),false);objects.set(pathname,{bytes:Buffer.from(bytes),contentType:options.contentType});},get:async(pathname)=>{syntheticBlobReads++;const item=objects.get(pathname);return {statusCode:200,blob:{url:'https://synthetic.private.blob.vercel-storage.com/'+pathname,pathname,size:item.bytes.length,contentType:item.contentType},stream:new Response(item.bytes).body};}});
  async function applied(projectId,index=0,monthly=false){
   const source=decodePlanSource(monthly?monthlyCurveFixture():cypCurveFixture({partidas:4,initial:String(index)}),monthly?'application/vnd.ms-excel.sheet.macroenabled.12':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),draft=(await imports.attach(owner,{...context(projectId),operationId:randomUUID(),source,consent:monthly?PLAN_IMPORT_MONTHLY_CURVE_CONSENT:PLAN_IMPORT_CYP_CURVE_CONSENT})).draft;
   const rows=draft.rows.map(row=>({...row,title:row.title.slice(0,160),startsOn:'2026-10-13',endsOn:'2026-10-21',uncertainty:'',...(row.code?{sourceIssueReviewed:true}:{})})),edit={...context(projectId),operationId:randomUUID(),draftId:draft.id,expectedRevision:draft.revision,action:'EDIT',rows,reason:'Native explicit human review synthetic'},edited=(await imports.decide(owner,edit)).draft;
   return (await imports.decide(owner,{...edit,operationId:randomUUID(),expectedRevision:edited.revision,action:'APPLY'})).draft;
  }
  const first=await applied('p-a'),second=await applied('p-a',0,true),lockedDraft=await applied('p-lock'),sameDraft=await applied('p-same'),casDraft=await applied('p-cas'),rollbackDraft=await applied('p-rollback');
  const preserved=await pool.query(`SELECT id,metadata FROM "AuditLog" WHERE action LIKE 'plan.import.%' ORDER BY id`),tasksBefore=await pool.query('SELECT * FROM "Task" ORDER BY id'),view=await baselines.read(owner,context());assert.equal(view.active,null);assert.equal(view.candidates.length,2);assert.equal(view.candidates.every(c=>c.curve.currency===null&&c.curve.calendarStart===null),true);assert.equal((await pool.query(`SELECT count(*)::int n FROM "AuditLog" WHERE action LIKE 'plan.baseline.%'`)).rows[0].n,0);completed(0);
  const http=createPlanBaselineHandlers({verify:async()=>owner,baselines}),input=command(first),post=await http.POST(new Request('https://obrasaas.com/api/identity/plan-baseline',{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(input)})),initial=await post.json();assert.equal(post.status,200);assert.equal(initial.state,'RECORDED');assert.deepEqual(initial.active.curve,first.spreadsheet.curve);assert.equal(initial.inputDigest,planBaselineSelectionDigest(input));assert.match(post.headers.get('cache-control'),/private, no-store/);completed(1);
  blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query(`SELECT id FROM "Project" WHERE id='p-lock' FOR UPDATE`);let finished=false;const pending=baselines.select(owner,command(lockedDraft,null,'p-lock')).then(value=>{finished=true;return value;});
  try{let observation;for(let i=0;i<60&&!observation;i++){observation=(await pool.query(`SELECT pid,wait_event_type,wait_event FROM pg_stat_activity WHERE datname=$1 AND application_name='obrasaas-plan-baseline-native' AND wait_event_type='Lock' AND query LIKE 'SELECT p.id,p.name,p.metadata%'`,[database])).rows[0];if(!observation)await new Promise(r=>setTimeout(r,20));}assert.ok(observation,'Canonical Project row lock must actually block this selection');assert.equal(finished,false);lockObservations.push(observation);}finally{await blocker.query('COMMIT');blocker.release();blocker=null;}assert.equal((await pending).state,'RECORDED');completed(2);
  const same=command(sameDraft,null,'p-same'),raced=await Promise.all([baselines.select(owner,same),createPlanBaseline({workspace:createWorkspaceStore({connect:()=>pool.connect()})}).select(owner,same)]);assert.equal(raced.filter(r=>!r.replayed).length,1);assert.equal(raced[0].receiptId,raced[1].receiptId);completed(3);
  const casA=command(casDraft,null,'p-cas'),casB=command(casDraft,null,'p-cas'),casResults=await Promise.all([baselines.select(owner,casA),baselines.select(owner,casB)]);assert.equal(casResults.filter(r=>r.state==='RECORDED').length,1);const rejected=casResults.find(r=>r.state==='REJECTED');assert.equal(rejected.code,'PLAN_BASELINE_REVISION_CHANGED');assert.equal(rejected.baselineEffects,false);assert.equal(rejected.definitive,true);assert.equal((await baselines.read(owner,{...context('p-cas'),operationId:rejected.operationId})).receiptId,rejected.receiptId);completed(4);
  const replacement=await baselines.select(director,command(second,initial.active,'p-a',director)),old=await baselines.select(owner,input);assert.equal(replacement.active.profile,'MONTHLY_RUBROS_CURVE');assert.deepEqual(old.baselineSnapshot,initial.baselineSnapshot);assert.deepEqual(old.active,replacement.active);completed(5);
  function faultStore(mode){let armed=true;return createPlanBaseline({workspace:createWorkspaceStore({connect:async()=>{const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,args)=>{if(armed&&sql==='COMMIT'){armed=false;if(mode==='ACK_LOST')await client.query('COMMIT');throw Error('Synthetic native acknowledgement failure');}if(mode==='ACTIVE_WRITE'&&sql.includes("'plan.baseline.active'")&&sql.startsWith('INSERT'))throw Error('Synthetic active write failure');return client.query(sql,args);}};}})});}
  const ackInput=command(first,replacement.active),ack=faultStore('ACK_LOST');await assert.rejects(ack.select(owner,ackInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const ackRecovered=await baselines.read(owner,{...context(),operationId:ackInput.operationId});assert.equal(ackRecovered.state,'RECORDED');assert.equal((await baselines.select(owner,ackInput)).replayed,true);completed(6);
  const rollbackInput=command(rollbackDraft,null,'p-rollback');await assert.rejects(faultStore('ROLLBACK').select(owner,rollbackInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const missing=await baselines.read(owner,{...context('p-rollback'),operationId:rollbackInput.operationId});assert.equal(missing.state,'NOT_OBSERVED');assert.equal(missing.definitive,false);assert.equal(missing.baselineEffects,null);assert.equal((await baselines.select(owner,rollbackInput)).replayed,false);completed(7);
  const current=(await baselines.read(owner,context())).active,writeFailure=command(second,current),logsBefore=(await pool.query(`SELECT * FROM "AuditLog" WHERE action LIKE 'plan.baseline.%' ORDER BY id`)).rows;await assert.rejects(faultStore('ACTIVE_WRITE').select(owner,writeFailure),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.deepEqual((await pool.query(`SELECT * FROM "AuditLog" WHERE action LIKE 'plan.baseline.%' ORDER BY id`)).rows,logsBefore);completed(8);
  await assert.rejects(baselines.read(manager,context('p-a',manager)),{code:'PLAN_BASELINE_PERMISSION_REQUIRED'});await assert.rejects(baselines.read(foreign,context('p-a',foreign)),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});await assert.rejects(baselines.read(owner,{...context(),scope:'0'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});
  await pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='m-owner'`);try{await assert.rejects(baselines.read(owner,{...context(),operationId:ackInput.operationId}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});}finally{await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='m-owner'`);}await pool.query(`UPDATE "Project" SET status='ARCHIVED' WHERE id='p-a'`);try{await assert.rejects(baselines.read(owner,context()),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});}finally{await pool.query(`UPDATE "Project" SET status='ACTIVE' WHERE id='p-a'`);}completed(9);
  for(const [id,mutate] of [[current.id,m=>({...m,revision:99})],[first.decision.receiptId,m=>({...m,outcome:{...m.outcome,draft:{...m.outcome.draft,source:{...m.outcome.draft.source,sha256:'f'.repeat(64)}}}})],[first.id,m=>({...m,analysis:{...m.analysis,reviewed:false}})]]){const original=(await pool.query('SELECT metadata FROM "AuditLog" WHERE id=$1',[id])).rows[0].metadata;await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1',[id,JSON.stringify(mutate(original))]);try{await assert.rejects(baselines.read(owner,context()),{code:'PLAN_BASELINE_INTEGRITY'});}finally{await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1',[id,JSON.stringify(original)]);}}completed(10);
  for(let i=0;i<12;i++)await applied('p-pagination',i);const page1=await baselines.read(owner,context('p-pagination')),page2=await baselines.read(owner,{...context('p-pagination'),cursor:page1.nextCursor});assert.equal(page1.candidates.length,10);assert.equal(page2.candidates.length,2);assert.equal(page2.nextCursor,null);assert.equal(new Set([...page1.candidates,...page2.candidates].map(c=>c.draftId)).size,12);await assert.rejects(baselines.read(owner,{...context('p-pagination'),cursor:planBaselineCursor(context(),page1.candidates.at(-1).draftId)}),{code:'PLAN_BASELINE_CURSOR_INVALID'});completed(11);
  assert.deepEqual((await pool.query('SELECT * FROM "Task" WHERE "projectId"<>\'p-pagination\' ORDER BY id')).rows,tasksBefore.rows);assert.deepEqual((await pool.query(`SELECT id,metadata FROM "AuditLog" WHERE action LIKE 'plan.import.%' AND "entityId"<>'p-pagination' ORDER BY id`)).rows,preserved.rows);assert.deepEqual((await baselines.read(owner,context())).active.curve,first.spreadsheet.curve);assert.equal(uncontrolledFetchAttempts,0);completed(12);assert.deepEqual(checks.map(c=>c.check),PLAN_BASELINE_POSTGRES_CHECKS);
 }catch(error){failure=error;}
 finally{
  try{if(blocker){await blocker.query('ROLLBACK');blocker.release();blocker=null;}if(pool){await closeDisposablePool(pool);poolClosed=true;}}catch(error){failure||=error;}
  try{if(connected&&created){planBaselineOwnedDatabase(database);activity=(await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].n;assert.equal(activity,0);await admin.query(`DROP DATABASE "${database}"`);removed=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rows.length===0;}}catch(error){failure||=error;}finally{if(connected){await admin.end();adminClosed=true;}globalThis.fetch=originalFetch;}
 }
 const afterSource=sourceManifest(root);assert.deepEqual(afterSource,beforeSource,'All source bytes and AST import paths must remain unchanged through cleanup');assert.equal(git(root,['rev-parse','HEAD']),baseRevision);assert.equal(git(root,['rev-parse','HEAD^{tree}']),baseTree);
 if(failure){failure.nativeProof={status:'FAIL',completedCheckCount:checks.length,failedCheck:PLAN_BASELINE_POSTGRES_CHECKS[checks.length]||'FINAL_ASSERTION',cleanup:{poolClosed,databaseRemoved:removed,adminClosed,pgStatActivityBeforeDrop:activity}};throw failure;}
 assert.equal(poolClosed&&removed&&adminClosed,true);
 return {version:PLAN_BASELINE_POSTGRES_VERSION,status:'PASS',recordedAt:new Date().toISOString(),postgresExecuted:true,syntheticOnly:true,engine,totalCheckCount:checks.length,checks,nativeLockObservations:lockObservations,sourceRevision:trackedClean?baseRevision:null,sourceTree:trackedClean?baseTree:null,baseRevision,baseTree,sourceState:exactCi?'EXACT_CI_SOURCE':trackedClean?'COMMITTED_LOCAL_SOURCE':'LOCAL_DIRTY_REVIEW_SOURCE',trackedClean,sourceManifest:beforeSource,sourceManifestAfter:afterSource,harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url))),syntheticBlobWrites,syntheticBlobReads,localOoxmlAnalyses:analyses,uncontrolledFetchAttempts,realProviderRequests:0,realProviderAcceptanceVerified:false,productionDataWritten:false,realWorkbookImported:false,realHumanSelectionVerified:false,currencyConfirmed:false,calendarConfirmed:false,actualCurveCreated:false,poolClosed,databaseRemoved:removed,cleanup:{poolClosed,databaseRemoved:removed,adminClosed,pgStatActivityBeforeDrop:activity}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=path.resolve('.vercel/private/approved-plan-baseline-evidence/postgres.json');
 verifyPlanBaselinePostgres().then(proof=>{mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,totalCheckCount:proof.totalCheckCount,postgresExecuted:proof.postgresExecuted,sourceState:proof.sourceState,cleanup:proof.cleanup}));}).catch(error=>{const proof={version:PLAN_BASELINE_POSTGRES_VERSION,status:'FAIL',code:error instanceof WorkspaceError?error.code:'NATIVE_ASSERTION_UNCONFIRMED',...(error.nativeProof||{})};mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output.replace('.json','-failure.json'),JSON.stringify(proof,null,2)+'\n');console.error(JSON.stringify(proof));process.exitCode=1;});
}
