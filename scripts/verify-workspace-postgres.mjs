import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,realpathSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Pool,Client} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createWorkspaceHandlers} from '../src/lib/workspace-http.mjs';
import {createCustomerWhatsAppSetup} from '../src/lib/customer-whatsapp-setup.mjs';

const sourcePaths=['scripts/lib/disposable-postgres-cleanup.mjs','src/lib/workspace-store.mjs','src/lib/workspace-http.mjs','src/lib/customer-whatsapp-setup.mjs'];
const sourceRoot=realpathSync(process.cwd()),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function sourceFiles(){
 const found=new Set();function visit(file){
  if(found.has(file))return;assert.ok(!path.isAbsolute(file)&&!file.split('/').some(part=>!part||part==='.'||part==='..'));
  const absolute=path.join(sourceRoot,file);assert.ok(realpathSync(absolute).startsWith(sourceRoot+path.sep));found.add(file);
  if(!/\.(?:js|mjs)$/.test(file))return;
  for(const match of readFileSync(absolute,'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
   const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])),dependency=[relative,relative+'.js',relative+'.mjs'].find(value=>existsSync(path.join(sourceRoot,value)));
   assert.ok(dependency,'Resolvable workspace PostgreSQL dependency '+file);visit(dependency);
  }
 }
 sourcePaths.forEach(visit);return [...found].sort();
}
function sourceIdentity(){
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim();assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const dirtyTrackedPaths=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:sourceRoot,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
 if(process.env.GITHUB_SHA){assert.equal(sourceRevision,process.env.GITHUB_SHA);assert.deepEqual(dirtyTrackedPaths,[],'Exact clean CI source required');}
 return {sourceRevision,trackedClean:dirtyTrackedPaths.length===0,sourceState:dirtyTrackedPaths.length?'LOCAL_REVIEW_SOURCE':'EXACT_CI_SOURCE',dirtyTrackedPaths};
}
const identityBefore=sourceIdentity(),sourceManifest=sourceFiles().map(file=>({path:file,sha256:hash(readFileSync(path.join(sourceRoot,file)))})),harnessSha256=hash(readFileSync(fileURLToPath(import.meta.url)));

// This script never connects to Neon/production and never receives provider secrets.
const source=process.env.CUTOVER_TEST_DATABASE_URL;
let url;try{url=new URL(source);}catch{throw new Error('Explicit disposable database URL required');}
assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET_ENV);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
assert.equal(url.pathname,'/obrasaas_cutover_ci');assert.equal(url.search,'');assert.equal(url.hash,'');
const name='obrasaas_ws_'+randomUUID().replaceAll('-','');
assert.match(name,/^obrasaas_ws_[a-f0-9]{32}$/);
const admin=new Client({connectionString:source,connectionTimeoutMillis:5000});
let created=false,pool,result,databaseRemoved=false;const checks=[];
const identify=(user,org='org_A',role='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId:user,organizationId:org,organizationRole:role});
const owner=identify('user_Owner','org_A','org:admin'),manager=identify('user_Manager'),viewer=identify('user_Viewer'),foreign=identify('user_Foreign','org_B','org:admin');
try{
  await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);created=true;
  url.pathname='/'+name;pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8,connectionTimeoutMillis:5000}));
  await pool.query(`
    CREATE TABLE "Organization" (id text PRIMARY KEY,name text NOT NULL,"clerkOrganizationId" text UNIQUE,metadata jsonb,"trialEndsAt" timestamp);
    CREATE TABLE "PlatformUser" (id text PRIMARY KEY,"clerkUserId" text UNIQUE NOT NULL);
    CREATE TABLE "TenantMembership" (id text PRIMARY KEY,"organizationId" text REFERENCES "Organization", "userId" text REFERENCES "PlatformUser", "tenantRole" text NOT NULL,"clerkRole" text NOT NULL,status text NOT NULL,UNIQUE("organizationId","userId"));
    CREATE TABLE "Project" (id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text NOT NULL,status text NOT NULL,metadata jsonb,"updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE "ProjectMembership" (id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status text NOT NULL,UNIQUE("projectId","tenantMembershipId"));
    CREATE TABLE "Task" (id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text NOT NULL,status text NOT NULL,progress integer NOT NULL,"startsAt" timestamp,"endsAt" timestamp,"updatedAt" timestamp NOT NULL,metadata jsonb);
    CREATE TABLE "AuditLog" (id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text NOT NULL,"entityType" text NOT NULL,"entityId" text,metadata jsonb,"createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO "Organization" VALUES ('company-a','Synthetic company A','org_A','{}'),('company-b','Synthetic company B','org_B','{}'),('internal','Internal fixture','org_Internal','{"internal":true}');
    INSERT INTO "PlatformUser" VALUES ('owner','user_Owner'),('manager','user_Manager'),('viewer','user_Viewer'),('foreign','user_Foreign');
    INSERT INTO "TenantMembership" VALUES ('m-owner','company-a','owner','ADMIN','org:admin','ACTIVE'),('m-manager','company-a','manager','SITE_MANAGER','org:member','ACTIVE'),('m-viewer','company-a','viewer','AUDITOR','org:member','ACTIVE'),('m-foreign','company-b','foreign','ADMIN','org:admin','ACTIVE'),('m-internal','internal','owner','ADMIN','org:admin','ACTIVE');
    INSERT INTO "Project" (id,"organizationId",name,status) VALUES ('p-a','company-a','Synthetic worksite A','ACTIVE'),('p-a2','company-a','Synthetic worksite A2','ACTIVE'),('p-archived','company-a','Archived fixture','ARCHIVED'),('p-b','company-b','Synthetic worksite B','ACTIVE');
    INSERT INTO "ProjectMembership" VALUES ('pm-manager','p-a','m-manager','ACTIVE'),('pm-viewer','p-a','m-viewer','ACTIVE');
    INSERT INTO "Task" VALUES ('task-a','p-a','Synthetic scheduled task','IN_PROGRESS',37,'2026-10-01','2026-10-05','2026-09-30T12:00:00.123456','{"unrelated":"preserve"}'),('task-other','p-b','Other company task','BACKLOG',0,NULL,NULL,'2026-09-30T12:00:00.123456','{}');
  `);
  const store=createWorkspaceStore({connect:()=>pool.connect()});
  const own=await store.list(owner),manage=await store.list(manager),view=await store.list(viewer),other=await store.list(foreign);
  assert.deepEqual(own.projects.map(p=>p.id),['p-a','p-a2']);assert.deepEqual(manage.projects.map(p=>p.id),['p-a']);assert.deepEqual(view.projects.map(p=>p.id),['p-a']);assert.deepEqual(other.projects.map(p=>p.id),['p-b']);
  assert.equal(view.canPlanSchedule,false);assert.equal(manage.canPlanSchedule,true);checks.push('canonical-company-and-project-scope');
  const beforeOverview=(await pool.query(`SELECT (SELECT count(*) FROM "AuditLog")::int AS audit,(SELECT count(*) FROM "Task")::int AS tasks`)).rows[0];
  const ownOverview=await store.overview(owner,{scope:own.scope}),assignedOverview=await store.overview(manager,{scope:manage.scope}),foreignOverview=await store.overview(foreign,{scope:other.scope});
  assert.deepEqual(ownOverview.projects.map(p=>p.id),['p-a','p-a2']);assert.deepEqual(assignedOverview.projects.map(p=>p.id),['p-a']);assert.deepEqual(foreignOverview.projects.map(p=>p.id),['p-b']);
  assert.deepEqual(ownOverview.projects[0],{id:'p-a',name:'Synthetic worksite A',status:'ACTIVE',totalTasks:1,completedTasks:0,inProgressTasks:1,blockedTasks:0,unscheduledTasks:0,nextEndsOn:'2026-10-05'});
  assert.deepEqual(ownOverview.projects[1],{id:'p-a2',name:'Synthetic worksite A2',status:'ACTIVE',totalTasks:0,completedTasks:0,inProgressTasks:0,blockedTasks:0,unscheduledTasks:0,nextEndsOn:null});
  assert.deepEqual((await pool.query(`SELECT (SELECT count(*) FROM "AuditLog")::int AS audit,(SELECT count(*) FROM "Task")::int AS tasks`)).rows[0],beforeOverview);
  checks.push('portfolio-uses-canonical-company-and-assignment-without-writes-or-private-projection');
  for(const cursor of ['p-b','p-a2','p-archived'])await assert.rejects(store.overview(manager,{scope:manage.scope,afterProject:cursor}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
  await assert.rejects(store.overview(owner,{scope:other.scope}),{code:'WORKSPACE_CONTEXT_CHANGED'});
  await pool.query(`UPDATE "ProjectMembership" SET status='DISABLED' WHERE id='pm-manager'`);
  assert.deepEqual((await store.overview(manager,{scope:manage.scope})).projects,[]);await assert.rejects(store.overview(manager,{scope:manage.scope,afterProject:'p-a'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
  await pool.query(`UPDATE "ProjectMembership" SET status='ACTIVE' WHERE id='pm-manager'`);
  checks.push('portfolio-revoked-assignment-and-foreign-cursor-denied');
  await pool.query(`INSERT INTO "Task" VALUES ('summary-blocked','p-a','Synthetic blocked task','BLOCKED',0,NULL,NULL,CURRENT_TIMESTAMP,'{}'),('summary-done','p-a','Synthetic completed task','DONE',100,'2026-01-01','2026-01-02',CURRENT_TIMESTAMP,'{}'),('summary-inconsistent','p-a','Synthetic incomplete done task','DONE',75,NULL,'2026-10-04',CURRENT_TIMESTAMP,'{}')`);
  const summary=(await store.overview(owner,{scope:own.scope})).projects[0];assert.equal(summary.totalTasks,4);assert.equal(summary.completedTasks,1);assert.equal(summary.inProgressTasks,1);assert.equal(summary.blockedTasks,1);assert.equal(summary.unscheduledTasks,2);assert.equal(summary.nextEndsOn,'2026-10-04');
  await pool.query(`DELETE FROM "Task" WHERE id IN ('summary-blocked','summary-done','summary-inconsistent')`);
  checks.push('portfolio-counts-approved-task-state-without-average-or-false-completion');
  await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status) SELECT 'portfolio-'||lpad(n::text,3,'0'),'company-a','Synthetic portfolio worksite '||n,'ACTIVE' FROM generate_series(1,105) n`);
  const portfolioFirst=await store.overview(owner,{scope:own.scope}),portfolioSecond=await store.overview(owner,{scope:own.scope,afterProject:portfolioFirst.nextCursor}),portfolioThird=await store.overview(owner,{scope:own.scope,afterProject:portfolioSecond.nextCursor});
  assert.equal(portfolioFirst.projects.length,50);assert.equal(portfolioSecond.projects.length,50);assert.equal(portfolioThird.projects.length,7);assert.equal(portfolioThird.nextCursor,null);
  const portfolioIds=[...portfolioFirst.projects,...portfolioSecond.projects,...portfolioThird.projects].map(p=>p.id);assert.equal(new Set(portfolioIds).size,107);assert.deepEqual([...portfolioIds].sort(),portfolioIds);assert.ok(!portfolioIds.includes('p-b'));assert.ok(!portfolioIds.includes('p-archived'));
  await pool.query(`DELETE FROM "Project" WHERE id LIKE 'portfolio-%'`);
  checks.push('portfolio-pages-over-one-hundred-works-without-foreign-or-archived-rows');
  await assert.rejects(store.list(identify('user_Owner','org_Internal','org:admin')),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
  await assert.rejects(store.list({...manager,organizationRole:'org:admin'}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
  await assert.rejects(store.list(identify('user_Unknown')),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
  for(const id of ['p-b','p-a2','p-archived'])await assert.rejects(store.read(manager,{projectId:id,scope:manage.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
  await assert.rejects(store.read(owner,{projectId:'p-a',scope:other.scope}),{code:'WORKSPACE_CONTEXT_CHANGED'});checks.push('cross-tenant-archived-and-stale-identity-denied');
  const read=()=>store.read(manager,{projectId:'p-a',scope:manage.scope});
  const input=async()=>({operationId:randomUUID(),projectId:'p-a',taskId:'task-a',scope:manage.scope,expectedRevision:(await read()).tasks[0].revision,startsOn:'2026-10-10',endsOn:'2026-10-14',reason:'Explicit synthetic planning decision'});
  const original=await input();assert.equal(original.expectedRevision,'2026-09-30T12:00:00.123456');
  await assert.rejects(store.schedule(viewer,{...original,scope:view.scope}),{code:'SCHEDULE_PERMISSION_REQUIRED'});
  await assert.rejects(store.schedule(manager,{...original,taskId:'task-other'}),{code:'WORKSPACE_TASK_UNAVAILABLE'});
  const results=await Promise.all([store.schedule(manager,original),store.schedule(manager,original),store.schedule(manager,original)]);
  assert.equal(results.filter(r=>!r.replayed).length,1);assert.equal(new Set(results.map(r=>r.receipt.id)).size,1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM "AuditLog"')).rows[0].n,1);
  const persisted=(await pool.query('SELECT progress,status,metadata FROM "Task" WHERE id=$1',['task-a'])).rows[0];
  assert.deepEqual(persisted,{progress:37,status:'IN_PROGRESS',metadata:{unrelated:'preserve'}});checks.push('one-durable-receipt-under-concurrent-retries-no-progress-side-effects');
  await assert.rejects(store.schedule(manager,{...original,operationId:randomUUID()}),{code:'SCHEDULE_REVISION_CHANGED'});
  await assert.rejects(store.schedule(manager,{...original,reason:'Different payload using the same operation key'}),{code:'SCHEDULE_OPERATION_CONFLICT'});
  const status=await store.status(manager,{projectId:'p-a',scope:manage.scope,operationId:original.operationId});assert.equal(status.state,'RECORDED');assert.equal(status.saved,true);assert.equal(status.receipt.id,results[0].receipt.id);assert.equal(status.receipt.taskId,status.task.id);
  assert.equal((await store.status(owner,{projectId:'p-a',scope:own.scope,operationId:original.operationId})).state,'NOT_OBSERVED');checks.push('conflict-and-receipt-isolation');
  const beforeRollback=(await read()).tasks[0];
  const failing=createWorkspaceStore({connect:async()=>{const client=await pool.connect();return {release:bad=>client.release(bad),query:(sql,values)=>{if(sql.startsWith('INSERT INTO public."AuditLog"'))throw new Error('SYNTHETIC_PRIVATE_FAILURE');return client.query(sql,values);}};}});
  const failedInput={...await input(),startsOn:'2026-11-01',endsOn:'2026-11-05'};
  await assert.rejects(failing.schedule(manager,failedInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
  assert.deepEqual((await read()).tasks[0],beforeRollback);checks.push('audit-failure-rolls-back-schedule');
  const ambiguous=createWorkspaceStore({connect:async()=>{const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,values)=>{const result=await client.query(sql,values);if(sql==='COMMIT')throw new Error('Synthetic lost commit acknowledgement');return result;}};}});
  const ambiguousInput={...await input(),startsOn:'2026-11-03',endsOn:'2026-11-08'};
  await assert.rejects(ambiguous.schedule(manager,ambiguousInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
  const handlers=createWorkspaceHandlers({verify:async()=>manager,store});
  const recoveryResponse=await handlers.GET(new Request('https://obrasaas.com/api/identity/workspace?'+new URLSearchParams({projectId:'p-a',scope:manage.scope,operationId:ambiguousInput.operationId})));
  assert.equal(recoveryResponse.status,200);assert.match(recoveryResponse.headers.get('Cache-Control'),/no-store/);
  const recovery=await recoveryResponse.json();assert.equal(recovery.state,'RECORDED');assert.equal(recovery.saved,true);assert.equal(recovery.task.id,ambiguousInput.taskId);assert.equal(recovery.receipt.taskId,recovery.task.id);assert.deepEqual(recovery.receipt.after,{startsOn:ambiguousInput.startsOn,endsOn:ambiguousInput.endsOn,revision:recovery.task.revision});assert.equal(recovery.task.progress,37);
  assert.equal((await store.schedule(manager,ambiguousInput)).replayed,true);checks.push('lost-commit-acknowledgement-recovers-without-a-second-write');
  // Revocation wins before authorization: SELECT FOR SHARE waits and rechecks ACTIVE.
  const beforeRevocation=(await read()).tasks[0],blockedInput={...await input(),startsOn:'2026-12-01',endsOn:'2026-12-05'};
  const blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query('UPDATE "TenantMembership" SET status=$1 WHERE id=$2',['DISABLED','m-manager']);
  const attempt=store.schedule(manager,blockedInput);const rejection=assert.rejects(attempt,{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});await new Promise(r=>setTimeout(r,80));await blocker.query('COMMIT');blocker.release();await rejection;
  await pool.query('UPDATE "TenantMembership" SET status=$1 WHERE id=$2',['ACTIVE','m-manager']);
  assert.deepEqual((await read()).tasks[0],beforeRevocation);checks.push('revocation-before-lock-prevents-the-write');
  // Authorized operation wins: concurrent revocation waits until its receipt commits.
  let unlock,entered;const gate=new Promise(resolve=>{unlock=resolve;});const started=new Promise(resolve=>{entered=resolve;});
  const gated=createWorkspaceStore({connect:async()=>{const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,values)=>{const result=await client.query(sql,values);if(sql.includes('FOR UPDATE OF t')){entered();await gate;}return result;}};}});
  const winningInput={...await input(),startsOn:'2026-12-10',endsOn:'2026-12-14'};const saving=gated.schedule(manager,winningInput);await started;
  let revoked=false;const revoke=pool.query('UPDATE "TenantMembership" SET status=$1 WHERE id=$2',['DISABLED','m-manager']).then(()=>{revoked=true;});
  await new Promise(r=>setTimeout(r,80));assert.equal(revoked,false);unlock();assert.equal((await saving).saved,true);await revoke;
  await assert.rejects(store.read(manager,{projectId:'p-a',scope:manage.scope}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});checks.push('concurrent-revocation-serializes-after-authorized-commit');
  await pool.query('UPDATE "TenantMembership" SET status=$1 WHERE id=$2',['ACTIVE','m-manager']);
  await pool.query('UPDATE "ProjectMembership" SET status=$1 WHERE id=$2',['DISABLED','pm-manager']);
  await assert.rejects(store.read(manager,{projectId:'p-a',scope:manage.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
  await pool.query('UPDATE "ProjectMembership" SET status=$1 WHERE id=$2',['ACTIVE','pm-manager']);
  await pool.query(`INSERT INTO "Task" (id,"projectId",title,status,progress,"updatedAt") SELECT 'page-'||lpad(i::text,3,'0'),'p-a','Synthetic paginated task','BACKLOG',0,CURRENT_TIMESTAMP FROM generate_series(1,105) i`);
  const first=await read(),second=await store.read(manager,{projectId:'p-a',scope:manage.scope,afterTask:first.nextCursor});
  assert.equal(first.tasks.length,100);assert.equal(first.totalTasks,106);assert.equal(second.tasks.length,6);assert.equal(new Set([...first.tasks,...second.tasks].map(t=>t.id)).size,106);assert.equal(second.nextCursor,null);checks.push('bounded-canonical-pagination-without-dropped-or-foreign-tasks');
  // Customer preparation reuses the same canonical authorization and project metadata.
  await pool.query(`CREATE TABLE "WhatsAppConnection" (id text PRIMARY KEY,"projectId" text REFERENCES "Project","displayPhoneNumber" text,enabled boolean NOT NULL,"connectionStatus" text NOT NULL)`);
  const setup=createCustomerWhatsAppSetup({workspace:store});
  const context={projectId:'p-a',scope:own.scope};
  const initial=await setup.read(owner,context);assert.equal(initial.profile.configured,false);assert.equal(initial.readiness.canLaunchMeta,false);
  await assert.rejects(setup.read(manager,{...context,scope:manage.scope}),{code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'});
  await assert.rejects(setup.read(foreign,{...context,scope:other.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
  await pool.query(`UPDATE "Project" SET metadata='{"otherFeature":{"preserve":true}}'::jsonb WHERE id='p-a'`);
  const setupInput={...context,operationId:randomUUID(),profile:{assistantName:'Asistente de la obra',numberMode:'DEDICATED',initialProjectId:'p-a',useCases:['FIELD_REPORTS'],expectedRevision:0,confirmOwnership:true}};
  const prepared=await Promise.all([setup.save(owner,setupInput),setup.save(owner,setupInput)]);
  assert.equal(prepared.filter(value=>value.replayed===false).length,1);assert.equal(prepared[0].receipt.id,prepared[1].receipt.id);
  assert.equal(prepared[0].profile.revision,1);assert.equal(prepared[0].readiness.operational,false);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action='project.whatsapp_workspace.prepared.self_service'`)).rows[0].n,1);
  assert.deepEqual((await pool.query(`SELECT metadata->'otherFeature' AS other FROM "Project" WHERE id='p-a'`)).rows[0].other,{preserve:true});
  assert.equal((await setup.read(owner,{projectId:'p-a2',scope:own.scope})).profile.configured,false);
  checks.push('customer-preparation-is-scoped-persistent-idempotent-and-preserves-other-metadata');
  const later={...setupInput,operationId:randomUUID(),profile:{...setupInput.profile,numberMode:'BUSINESS_APP',expectedRevision:1}};
  const savedLater=await setup.save(owner,later);assert.equal(savedLater.profile.revision,2);assert.equal(savedLater.readiness.canLaunchMeta,false);
  const historical=await setup.save(owner,setupInput);assert.equal(historical.replayed,true);assert.equal(historical.savedProfileIsCurrent,false);assert.equal(historical.profile.numberMode,'BUSINESS_APP');
  assert.equal((await setup.status(owner,{...context,operationId:setupInput.operationId})).state,'RECORDED');
  await assert.rejects(setup.save(owner,{...later,operationId:randomUUID()}),{code:'WORKSPACE_CONFLICT'});
  await assert.rejects(setup.save(owner,{...setupInput,profile:{...setupInput.profile,assistantName:'Another request'}}),{code:'WHATSAPP_PREPARATION_OPERATION_CONFLICT'});
  checks.push('customer-preparation-recovery-does-not-revert-a-later-selection');
  const failingSetup=createCustomerWhatsAppSetup({workspace:failing});
  await assert.rejects(failingSetup.save(owner,{...later,operationId:randomUUID(),profile:{...later.profile,assistantName:'Must roll back',expectedRevision:2}}),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
  assert.equal((await setup.read(owner,context)).profile.assistantName,'Asistente de la obra');
  await pool.query(`INSERT INTO "WhatsAppConnection" VALUES ('connection-fixture','p-a','Synthetic phone label',true,'CONNECTED')`);
  const linked=await setup.read(owner,context);assert.equal(linked.connection.recordPresent,true);assert.equal(linked.readiness.steps.find(step=>step.key==='CONNECTION').state,'RECORD_PRESENT');
  assert.equal(linked.readiness.operational,false);assert.equal(linked.readiness.steps.find(step=>step.key==='TEMPLATES').state,'NOT_VERIFIED');
  assert.equal(linked.readiness.steps.find(step=>step.key==='ROUND_TRIP').state,'NOT_VERIFIED');
  checks.push('stored-connected-status-is-not-template-or-roundtrip-acceptance');
  const metadataBefore=(await pool.query(`SELECT metadata FROM "Project" WHERE id='p-a'`)).rows[0].metadata;
  await pool.query(`UPDATE "Project" SET metadata='{"whatsappWorkspace":{"schemaVersion":2}}'::jsonb WHERE id='p-a'`);
  await assert.rejects(setup.read(owner,context),{code:'WORKSPACE_INTEGRITY'});
  await pool.query(`UPDATE "Project" SET metadata=$1::jsonb WHERE id='p-a'`,[JSON.stringify(metadataBefore)]);
  checks.push('invalid-prior-preparation-fails-without-replacing-it');
  result={status:'PASS',environment:'local-disposable-postgresql',checks,productionDataTouched:false,providerCalls:0,physicalWhatsAppTested:false};
}finally{try{
 await closeDisposablePool(pool);
 if(created){await admin.query(`DROP DATABASE "${name}"`);assert.equal((await admin.query('SELECT datname FROM pg_database WHERE datname=$1',[name])).rows.length,0,'Disposable database removed');databaseRemoved=true;}
}finally{await admin.end();}}
assert.equal(databaseRemoved,true,'No PASS before confirmed cleanup and connection closure');
assert.deepEqual(sourceIdentity(),identityBefore,'Source identity stable during PostgreSQL proof');
for(const item of sourceManifest)assert.equal(hash(readFileSync(path.join(sourceRoot,item.path))),item.sha256,'Source stable during PostgreSQL proof');
assert.equal(hash(readFileSync(fileURLToPath(import.meta.url))),harnessSha256);
Object.assign(result,identityBefore,{sourceManifest,harnessSha256,databaseRemoved,connectionClosed:true,totalCheckCount:checks.length});
mkdirSync('.vercel/workspace-evidence',{recursive:true});writeFileSync('.vercel/workspace-evidence/postgres.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
