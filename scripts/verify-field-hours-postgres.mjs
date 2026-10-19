import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,isAbsolute,posix,relative,resolve,sep} from 'node:path';
import {execFileSync} from 'node:child_process';
import {Client,Pool} from 'pg';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {readFieldHoursReport,fieldHoursCsv} from '../src/lib/field-hours-report.mjs';
import {fieldReceiptId} from '../src/lib/field-operations-policy.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';

// Local native SQL QA only. The launcher must create a NEW private cluster;
// neither a historical cluster nor a product database is an admissible target.
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
assert.equal(realpathSync(process.cwd()),root);
assert.equal(process.version,'v24.15.0');
assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');
for(const key of ['VERCEL','VERCEL_ENV','DATABASE_URL','DIRECT_URL','PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'])assert.ok(!process.env[key],key+' must not be inherited');
const url=new URL(process.env.CUTOVER_TEST_DATABASE_URL||'http://not-configured');
assert.equal(url.protocol,'postgresql:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'6549');assert.equal(url.username,'cutover_test');assert.equal(url.password,'');assert.equal(url.pathname,'/obrasaas_cutover_ci');assert.equal(url.search,'');assert.equal(url.hash,'');
const clusterName=process.env.HOURS_QA_CLUSTER_NAME;
assert.match(clusterName||'',/^obrasaas_hours_20261018_[a-f0-9]{32}$/);
const privateBase=resolve(root,'.vercel/private/pilot-readiness-20261018');
const runDirectory=resolve(process.env.HOURS_QA_RUN_DIRECTORY||'');
assert.ok(isAbsolute(process.env.HOURS_QA_RUN_DIRECTORY||''));
assert.equal(dirname(runDirectory),privateBase);assert.match(runDirectory.split(sep).at(-1),/^hours-postgres-qa-[a-f0-9]{32}$/);
assert.equal(clusterName,'obrasaas_hours_20261018_'+runDirectory.split(sep).at(-1).slice('hours-postgres-qa-'.length));
assert.equal(realpathSync(runDirectory),runDirectory,'No linked/reparse run directory');
const dataDirectory=resolve(runDirectory,'data'),evidenceDirectory=resolve(runDirectory,'evidence');
assert.equal(realpathSync(dataDirectory),dataDirectory);assert.equal(realpathSync(evidenceDirectory),evidenceDirectory);
const proofPath=resolve(evidenceDirectory,'field-hours-postgres-proof.json');assert.equal(existsSync(proofPath),false,'Never overwrite a previous proof');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const sourceFiles=new Set(['scripts/verify-field-operations-postgres.mjs','package.json','package-lock.json']);
function visit(file){
 if(sourceFiles.has(file)&&file!=='scripts/verify-field-operations-postgres.mjs')return;
 sourceFiles.add(file);const source=readFileSync(resolve(root,file),'utf8');
 for(const match of source.matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)|import\s*['"](\.[^'"]+)['"]/g)){
  const dependency=posix.normalize(posix.join(posix.dirname(file),match[1]||match[2]||match[3]));
  assert.ok(dependency.startsWith('src/')||dependency.startsWith('scripts/'),'Local source closure must remain in this repository');
  if(!sourceFiles.has(dependency))visit(dependency);
 }
}
visit('scripts/verify-field-hours-postgres.mjs');
const sourceManifest=[...sourceFiles].sort().map(file=>({file,sha256:sha256(readFileSync(resolve(root,file)))}));
const harnessSha256=sha256(readFileSync(fileURLToPath(import.meta.url)));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const gitContext={head:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),workingStatus:git('status','--porcelain')};
const providerAttempts=[];globalThis.fetch=async()=>{providerAttempts.push('fetch');throw Error('Native hours QA forbids HTTP/provider access');};
const schema='obrasaas_hours_'+randomUUID().replaceAll('-','');assert.match(schema,/^obrasaas_hours_[a-f0-9]{32}$/);
const quoted='"'+schema+'"',rewrite=sql=>sql.replace(/\bpublic\./g,quoted+'.');
const admin=new Client({connectionString:url.href,application_name:clusterName,connectionTimeoutMillis:4000});
const checks=[],readTransactions=[],sqlFailures=[];
let pool,connected=false,created=false,schemaRemoved=false,baseBefore,baseAfter,failure,afterLedger=null;
const query=(sql,args)=>pool.query(rewrite(sql),args);
const connect=async()=>{
 const client=await pool.connect();await client.query('SET search_path TO '+quoted);let readonly=false;
 return {release:bad=>client.release(bad),query:async(sql,args)=>{
  if(sql.startsWith('BEGIN ')){readonly=sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY';readTransactions.push({readOnly:readonly,isolation:sql});}
  if(readonly)assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|COPY)\b/i,'Report transaction must not attempt business writes');
  try{const result=await client.query(rewrite(sql),args);if(readonly&&sql.startsWith('SELECT id,"projectId","workerId",metadata FROM public."AttendanceEntry"')&&afterLedger){const run=afterLedger;afterLedger=null;await run();}return result;}
  catch(error){sqlFailures.push({code:error.code||'ASSERTION',stage:'native-fixture-query'});throw error;}
 }};
};
const session=(user,organizationId='org_A',organizationRole='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId:user,organizationId,organizationRole});
const owner=session('user_Owner','org_A','org:admin'),director=session('user_Director'),manager=session('user_Manager'),worker=session('user_Worker'),finance=session('user_Finance'),foreign=session('user_Foreign','org_B','org:admin');
const actors=[owner,director,manager,worker,finance,foreign],scopes={};
const period={fromDate:'2026-10-05',untilDate:'2026-10-06',timeZone:'America/Argentina/Buenos_Aires'};
const context=(actor=owner,selected=period)=>({projectId:'p-a',scope:scopes[actor.userId],period:selected});
const tableNames=['Organization','PlatformUser','TenantMembership','Project','ProjectMembership','Worker','Task','Incident','AttendanceEntry','OperationalProposal','AuditLog'];
async function stateDigest(){const tables=[];for(const name of tableNames)tables.push([name,(await query(`SELECT to_jsonb(t) AS row FROM public."${name}" t ORDER BY id`)).rows]);return sha256(JSON.stringify(stable(tables)));}
async function unchangedRead(action){const before=await stateDigest(),value=await action();assert.equal(await stateDigest(),before,'Read must preserve every fixture ledger, receipt, role and project row');return value;}
async function rejectedRead(action,expected){const before=await stateDigest();await assert.rejects(action,expected);assert.equal(await stateDigest(),before,'Denied read must preserve all fixture rows');}
async function baseCatalog(){return (await admin.query(`SELECT current_database() AS database,session_user AS actor,host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('cluster_name') AS cluster,current_setting('data_directory') AS "dataDirectory",current_setting('server_version_num')::int AS "serverVersion",(SELECT array_agg(datname ORDER BY datname) FROM pg_database) AS databases,(SELECT COALESCE(jsonb_agg(jsonb_build_array(c.relname,c.relkind) ORDER BY c.relname),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') AS "publicRelations"`)).rows[0];}
async function seedShift({types=['CHECK_IN','BREAK_START','BREAK_END','CHECK_OUT'],times=['2026-10-05T11:00:00.000Z','2026-10-05T11:00:00.500Z','2026-10-05T11:00:01.500Z','2026-10-05T11:00:02.000Z'],verification='VERIFIED',name='Synthetic hours worker'}={}){
 assert.equal(types.length,times.length);
 const workerId='w_hours_'+randomUUID().replaceAll('-',''),shiftId='shift_'+randomUUID().replaceAll('-',''),rows=[],receipts=[];
 await query(`INSERT INTO public."Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") VALUES($1,'p-a',$2,$1,'WORKER','{}'::jsonb,clock_timestamp())`,[workerId,name]);
 for(let n=0;n<types.length;n++){
  const id='attendance_'+randomUUID().replaceAll('-',''),eventType=types[n],located=['CHECK_IN','CHECK_OUT'].includes(eventType);
  const details={version:1,eventType,phase:eventType==='BREAK_START'?'ON_BREAK':'WORKING',shiftId,sequence:n+1,previousEventId:rows.at(-1)?.id||null,sectorId:'sector-fixture',sectorName:'Synthetic sector',configRevision:'config-fixture',qrStatus:located?'MATCHED':'NOT_PROVIDED',verificationStatus:located?verification:'NOT_REQUIRED',location:located?{latitude:12.345678,longitude:23.456789,accuracyMeters:3}:null,recordedBy:'worker',recordedAt:times[n],source:'account',review:null};
  const row={id,projectId:'p-a',workerId,metadata:{privateFixtureMarker:'PRIVATE_FIXTURE_NOT_EXPORTABLE',fieldOperations:details}},operationId=randomUUID();
  await query(`INSERT INTO public."AttendanceEntry"(id,"projectId","workerId",status,source,"checkedInAt",metadata) VALUES($1,'p-a',$2,'PRESENT','account-field',$3::timestamp,$4::jsonb)`,[id,workerId,times[n],JSON.stringify(row.metadata)]);
  // Explicit synthetic recording receipts, not claims of physical attendance.
  // Human-review receipts below are issued by the real operations.save path.
  const receipt={id:fieldReceiptId('worker','p-a',operationId),metadata:{version:1,projectId:'p-a',operationId,command:'ATTENDANCE',requestDigest:digest(['synthetic-hours-recording',id,operationId]),outcome:{kind:'ATTENDANCE',event:{id,workerId,...details}}}};
  await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,'company-a','worker','field.operation.recorded','Project','p-a',$2::jsonb)`,[receipt.id,JSON.stringify(receipt.metadata)]);
  rows.push(row);receipts.push(receipt);
 }
 return {workerId,shiftId,rows,receipts};
}
async function clearLedger(){await query(`DELETE FROM public."AttendanceEntry"`);await query(`DELETE FROM public."AuditLog" WHERE action='field.operation.recorded'`);}
try{
 await admin.connect();connected=true;baseBefore=await baseCatalog();
 assert.equal(baseBefore.database,'obrasaas_cutover_ci');assert.equal(baseBefore.actor,'cutover_test');assert.equal(baseBefore.host,'127.0.0.1');assert.equal(baseBefore.port,6549);assert.equal(baseBefore.cluster,clusterName);assert.equal(resolve(baseBefore.dataDirectory),dataDirectory);assert.equal(baseBefore.serverVersion,180006);assert.deepEqual(baseBefore.publicRelations,[]);
 checks.push('new-private-cluster-data-directory-identity-loopback-port-role-database-and-pg18.6-exact');
 await admin.query('CREATE SCHEMA '+quoted);created=true;await admin.query('SET search_path TO '+quoted);
 const ddl=readFileSync(resolve(root,'scripts/verify-field-operations-postgres.mjs'),'utf8').match(/await pool\.query\(`([\s\S]*?)`\);/)?.[1];assert.ok(ddl);assert.match(ddl,/CREATE TABLE "AttendanceEntry"/);assert.doesNotMatch(ddl,/DROP\s|CREATE DATABASE|\bpublic\./i);await admin.query(ddl);
 await admin.query(`ALTER TABLE "TenantMembership" ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT clock_timestamp();ALTER TABLE "ProjectMembership" ADD COLUMN "updatedAt" timestamp NOT NULL DEFAULT clock_timestamp();INSERT INTO "PlatformUser" VALUES('finance','user_Finance');INSERT INTO "TenantMembership"(id,"organizationId","userId","tenantRole","clerkRole",status) VALUES('finance-m','company-a','finance','FINANCE','org:member','ACTIVE');INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('finance-p','p-a','finance-m','ACTIVE');`);
 pool=trackDisposablePool(new Pool({connectionString:url.href,max:4,connectionTimeoutMillis:4000,application_name:clusterName}));
 const workspace=createWorkspaceStore({connect}),operations=createFieldOperations({workspace});
 for(const actor of actors)scopes[actor.userId]=(await workspace.list(actor)).scope;
 checks.push('canonical-fixture-ddl-executed-only-inside-new-uuid-schema-and-scopes-derived-from-real-store');
 const initial=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(initial.state,'COMPLETE');assert.deepEqual(initial.rows,[]);assert.equal(initial.totals.closedObservedNetMs,0);
 checks.push('native-select-syntax-and-empty-report-preserve-ledger');
 const closed=await seedShift();
 const report=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(report.rows.length,1);assert.equal(report.rows[0].status,'CLOSED');assert.equal(report.rows[0].auditStatus,'CONFIRMED');assert.equal(report.rows[0].readyForOperationalReview,true);assert.deepEqual([report.totals.closedElapsedMs,report.totals.closedBreakMs,report.totals.closedObservedNetMs,report.totals.closedEvidenceReadyNetMs],[2000,1000,1000,1000]);assert.deepEqual(report.rows[0].events.map(event=>event.recordingReceiptId),closed.receipts.map(receipt=>receipt.id));
 checks.push('closed-native-chain-exact-2000ms-minus-1000ms-break-net1000-with-all-recording-receipts');
 const direct=await unchangedRead(()=>workspace.projectOperation(owner,context(),false,async(client,member,scope,project)=>{assert.equal(member.role,'ADMIN');assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');assert.equal((await client.query('SHOW transaction_isolation')).rows[0].transaction_isolation,'repeatable read');return readFieldHoursReport(client,{project,scope,period});}));assert.equal(direct.reportDigest,report.reportDigest);
 assert.equal((await unchangedRead(()=>operations.hoursReport(director,context(director)))).totals.closedObservedNetMs,1000);assert.equal(readTransactions.every(entry=>entry.readOnly),true);
 checks.push('admin-director-canonical-permissions-and-real-repeatable-read-readonly-projection');
 const handlers=createFieldHandlers({verify:async()=>owner,operations});
 const get=async(format,expected)=>handlers.GET(new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams({projectId:'p-a',scope:scopes[owner.userId],hoursFrom:period.fromDate,hoursUntil:period.untilDate,hoursTimeZone:period.timeZone,hoursFormat:format,...(expected?{expectedHoursDigest:expected}:{})})));
 const json=await unchangedRead(()=>get('json'));assert.equal(json.status,200);assert.match(json.headers.get('cache-control'),/no-store/);const jsonBody=await json.json();const csv=await unchangedRead(()=>get('csv',jsonBody.reportDigest));assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);assert.equal(csv.headers.get('x-obrasaaS-hours-digest'),jsonBody.reportDigest);const csvText=await csv.text();assert.ok(csvText.includes('"1000"'));assert.equal(jsonBody.salaryCalculated,false);assert.equal(jsonBody.paymentEnabled,false);for(const secret of ['12.345678','23.456789','PRIVATE_FIXTURE_NOT_EXPORTABLE'])assert.equal(JSON.stringify(jsonBody).includes(secret)||csvText.includes(secret),false);
 checks.push('real-http-json-csv-no-store-same-digest-no-coordinates-private-metadata-or-salary');
 await query(`UPDATE public."Worker" SET name='Synthetic renamed worker' WHERE id=$1`,[closed.workerId]);const stale=await unchangedRead(()=>get('csv',jsonBody.reportDigest));assert.equal(stale.status,409);assert.equal((await stale.json()).code,'FIELD_HOURS_SOURCE_CHANGED');
 checks.push('csv-rechecks-current-native-source-and-rejects-stale-preview-digest');
 await query(`DELETE FROM public."AuditLog" WHERE id=$1`,[closed.receipts[0].id]);const missing=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(missing.rows[0].auditStatus,'REVIEW_REQUIRED');assert.equal(missing.totals.closedObservedNetMs,1000);assert.equal(missing.totals.closedEvidenceReadyNetMs,0);
 checks.push('missing-recording-receipt-preserves-observed-duration-but-excludes-ready-total');
 await clearLedger();const pending=await seedShift({verification:'REVIEW_REQUIRED'});const beforeReview=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(beforeReview.rows[0].evidenceStatus,'PENDING_REVIEW');assert.equal(beforeReview.totals.closedEvidenceReadyNetMs,0);
 for(const event of pending.rows.filter(row=>['CHECK_IN','CHECK_OUT'].includes(row.metadata.fieldOperations.eventType))){const result=await operations.save(owner,{projectId:'p-a',scope:scopes[owner.userId],action:'REVIEW_ATTENDANCE',operationId:randomUUID(),payload:{eventId:event.id,decision:'APPROVE',reason:'Synthetic independent review. PRIVATE_REVIEW_REASON'}});assert.match(result.receiptId,/^field_[a-f0-9]{64}$/);}
 const reviewed=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(reviewed.rows[0].evidenceStatus,'READY');assert.equal(reviewed.rows[0].auditStatus,'CONFIRMED');assert.equal(reviewed.totals.closedEvidenceReadyNetMs,1000);assert.equal(reviewed.rows[0].events.filter(event=>event.reviewReceiptId).length,2);assert.equal(JSON.stringify(reviewed).includes('PRIVATE_REVIEW_REASON'),false);assert.equal(fieldHoursCsv(reviewed,reviewed.reportDigest).csv.includes('PRIVATE_REVIEW_REASON'),false);
 checks.push('pending-evidence-independent-review-real-save-receipts-and-private-reason-excluded');
 await clearLedger();await seedShift({types:['CHECK_IN','CHECK_OUT'],times:['2026-10-06T02:59:59.000Z','2026-10-06T03:00:01.000Z']});await seedShift({types:['CHECK_IN','CHECK_OUT'],times:['2026-10-06T03:00:00.000Z','2026-10-06T03:00:01.000Z']});await seedShift({types:['CHECK_IN','CHECK_OUT'],times:['2026-10-05T02:59:59.000Z','2026-10-05T03:00:01.000Z']});const boundary=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(boundary.rows.length,1);assert.equal(boundary.rows[0].localStartDate,'2026-10-05');assert.equal(boundary.totals.closedObservedNetMs,2000);assert.equal(boundary.period.untilExclusive,true);assert.equal(boundary.period.allocation,'WHOLE_SHIFT_NOT_SPLIT_AT_PERIOD_BOUNDARIES');
 checks.push('explicit-argentina-local-start-period-until-exclusive-whole-cross-midnight-shift-not-prorated');
 await rejectedRead(()=>operations.hoursReport(owner,context(owner,{...period,timeZone:''})),{code:'FIELD_HOURS_PERIOD_INVALID'});await rejectedRead(()=>operations.hoursReport(owner,context(owner,{...period,untilDate:'2026-11-06'})),{code:'FIELD_HOURS_PERIOD_TOO_LONG'});
 checks.push('empty-timezone-and-over31day-period-reject-without-ledger-writes');
 for(const actor of [manager,worker,finance])await rejectedRead(()=>operations.hoursReport(actor,context(actor)),{code:'FIELD_HOURS_PERMISSION_REQUIRED',status:403});
 checks.push('site-manager-auditor-finance-canonical-role-denials');
 await rejectedRead(()=>operations.hoursReport(foreign,context(foreign)),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});await rejectedRead(()=>operations.hoursReport(owner,{...context(),projectId:'p-b'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});await rejectedRead(()=>operations.hoursReport(owner,{...context(),scope:'f'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 checks.push('foreign-tenant-project-and-forged-scope-deny-on-native-canonical-joins');
 await query(`UPDATE public."TenantMembership" SET status='DISABLED' WHERE id='owner-m'`);await rejectedRead(()=>operations.hoursReport(owner,context()),{code:'WORKSPACE_MEMBERSHIP_REQUIRED',status:403});await query(`UPDATE public."TenantMembership" SET status='ACTIVE' WHERE id='owner-m'`);
 await query(`UPDATE public."Project" SET status='DISABLED' WHERE id='p-a'`);await rejectedRead(()=>operations.hoursReport(owner,context()),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});await query(`UPDATE public."Project" SET status='ACTIVE' WHERE id='p-a'`);
 checks.push('current-membership-and-project-revocations-are-reread-not-cached');
 await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('office-fixture','company-a','owner','office.review.accepted','Project','p-a','{"membershipId":"owner-m"}')`);await rejectedRead(()=>operations.hoursReport(owner,context()),{code:'OFFICE_REVIEW_ONLY',status:403});await query(`DELETE FROM public."AuditLog" WHERE id='office-fixture'`);
 await query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('director-fixture-p','p-a','director-m','ACTIVE')`);await query(`INSERT INTO public."Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") VALUES('w-director-fixture','p-a','Synthetic linked director','director-fixture','WORKER','{"participant":{"version":1,"clerkUserId":"user_Director","status":"ACTIVE","permissions":{"attendance":true},"kyc":{"version":1,"status":"NOT_SUBMITTED"}}}',clock_timestamp())`);await rejectedRead(()=>operations.hoursReport(director,context(director)),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED',status:403});await query(`DELETE FROM public."Worker" WHERE id='w-director-fixture'`);
 checks.push('office-review-only-and-linked-participant-without-approved-kyc-never-bypass-project-admission');
 await clearLedger();const open=await seedShift({types:['CHECK_IN','BREAK_START'],times:['2026-10-05T11:00:00.000Z','2026-10-05T11:00:01.000Z']});const opened=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(opened.rows[0].status,'ON_BREAK');assert.equal(opened.rows[0].durationScope,'RECORDED_INTERVALS_ONLY_OPEN_SHIFT');assert.equal(opened.totals.closedObservedNetMs,0);await query(`UPDATE public."AttendanceEntry" SET metadata=jsonb_set(metadata,'{fieldOperations,previousEventId}','"missing-event"') WHERE id=$1`,[open.rows[1].id]);const broken=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(broken.rows[0].status,'INTEGRITY_REVIEW_REQUIRED');assert.equal(broken.rows[0].netMs,null);assert.equal(broken.totals.closedObservedNetMs,0);
 checks.push('open-break-and-broken-chain-never-count-as-closed-net-hours');
 await clearLedger();const snapshotSeed=await seedShift();afterLedger=()=>query(`UPDATE public."Worker" SET name='Synthetic concurrent change' WHERE id=$1`,[snapshotSeed.workerId]);const consistent=await operations.hoursReport(owner,context());assert.equal(consistent.rows[0].workerCurrentName,'Synthetic hours worker');assert.equal((await unchangedRead(()=>operations.hoursReport(owner,context()))).rows[0].workerCurrentName,'Synthetic concurrent change');
 checks.push('separate-native-writer-during-ledger-read-cannot-mix-repeatable-read-snapshot');
 await query(`INSERT INTO public."AttendanceEntry"(id,"projectId","workerId",status,metadata) VALUES('legacy-hours-fixture','p-a',$1,'PRESENT','{}')`,[snapshotSeed.workerId]);const incomplete=await unchangedRead(()=>operations.hoursReport(owner,context()));assert.equal(incomplete.state,'INCOMPLETE');assert.equal(incomplete.completeness.reason,'UNSUPPORTED_LEDGER_RECORDS');assert.deepEqual(incomplete.rows,[]);assert.throws(()=>fieldHoursCsv(incomplete,'f'.repeat(64)),{code:'FIELD_HOURS_INCOMPLETE'});
 checks.push('unsupported-legacy-source-fails-completeness-and-csv-instead-of-silent-partial-export');
 for(const file of sourceManifest)assert.equal(sha256(readFileSync(resolve(root,file.file))),file.sha256);assert.equal(sha256(readFileSync(fileURLToPath(import.meta.url))),harnessSha256);assert.deepEqual(providerAttempts,[]);assert.equal(sqlFailures.length,0);
 checks.push('exact-source-closure-and-harness-unchanged-zero-http-or-provider-attempts');
}catch(error){failure=error;}
finally{
 try{await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_hours_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');assert.equal((await admin.query('SELECT nspname FROM pg_namespace WHERE nspname=$1',[schema])).rows.length,0);schemaRemoved=true;}if(connected){baseAfter=await baseCatalog();assert.deepEqual(baseAfter,baseBefore,'Base catalog and database list must remain intact');}}
 catch(error){failure ||= error;}
 finally{await admin.end().catch(error=>{failure ||= error;});}
}
const proof={status:failure?'FAIL':'PASS',checkedAt:new Date().toISOString(),validationScope:'LOCAL_REVIEW_SOURCE_NATIVE_POSTGRES_ONLY',git:gitContext,cluster:{name:clusterName,dataDirectory,host:'127.0.0.1',port:6549,database:'obrasaas_cutover_ci',actor:'cutover_test',requiredServerVersion:180006},schema,disposableSchemaRemoved:schemaRemoved,baseCatalogBefore:baseBefore||null,baseCatalogAfter:baseAfter||null,baseCatalogUnchanged:Boolean(baseBefore&&baseAfter&&JSON.stringify(baseBefore)===JSON.stringify(baseAfter)),checks,checkCount:checks.length,sourceManifest,harnessSha256,readTransactions,sqlFailures,syntheticFixtures:{recordingReceipts:'Explicit synthetic AuditLog fixtures',attendanceReviewReceipts:'Issued by real operations.save REVIEW_ATTENDANCE',sessions:'Controlled verified-session fixtures; no real Clerk account or login',recordedTimes:'Explicit synthetic UTC millisecond timestamps'},providerAttempts,providerCalls:0,realBusinessDatabaseUsed:false,physicalAttendanceAccepted:false,humanAccepted:false,postgres17CiParityVerified:false,...(failure?{failure:{name:failure.name,code:failure.code||null,message:failure.message}}:{})};
mkdirSync(evidenceDirectory,{recursive:true});writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,checkCount:checks.length,disposableSchemaRemoved:schemaRemoved,providerCalls:0,proof:relative(root,proofPath)}));
if(failure)process.exitCode=1;
