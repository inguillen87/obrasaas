import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Pool,Client} from 'pg';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';

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
let created=false,pool;const checks=[];
const identify=(user,org='org_A',role='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId:user,organizationId:org,organizationRole:role});
const owner=identify('user_Owner','org_A','org:admin'),manager=identify('user_Manager'),viewer=identify('user_Viewer'),foreign=identify('user_Foreign','org_B','org:admin');
try{
  await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);created=true;
  url.pathname='/'+name;pool=new Pool({connectionString:url.toString(),max:8,connectionTimeoutMillis:5000});
  await pool.query(`
    CREATE TABLE "Organization" (id text PRIMARY KEY,name text NOT NULL,"clerkOrganizationId" text UNIQUE,metadata jsonb);
    CREATE TABLE "PlatformUser" (id text PRIMARY KEY,"clerkUserId" text UNIQUE NOT NULL);
    CREATE TABLE "TenantMembership" (id text PRIMARY KEY,"organizationId" text REFERENCES "Organization", "userId" text REFERENCES "PlatformUser", "tenantRole" text NOT NULL,"clerkRole" text NOT NULL,status text NOT NULL,UNIQUE("organizationId","userId"));
    CREATE TABLE "Project" (id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text NOT NULL,status text NOT NULL);
    CREATE TABLE "ProjectMembership" (id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status text NOT NULL,UNIQUE("projectId","tenantMembershipId"));
    CREATE TABLE "Task" (id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text NOT NULL,status text NOT NULL,progress integer NOT NULL,"startsAt" timestamp,"endsAt" timestamp,"updatedAt" timestamp NOT NULL,metadata jsonb);
    CREATE TABLE "AuditLog" (id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text NOT NULL,"entityType" text NOT NULL,"entityId" text,metadata jsonb,"createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP);
    INSERT INTO "Organization" VALUES ('company-a','Synthetic company A','org_A','{}'),('company-b','Synthetic company B','org_B','{}'),('internal','Internal fixture','org_Internal','{"internal":true}');
    INSERT INTO "PlatformUser" VALUES ('owner','user_Owner'),('manager','user_Manager'),('viewer','user_Viewer'),('foreign','user_Foreign');
    INSERT INTO "TenantMembership" VALUES ('m-owner','company-a','owner','ADMIN','org:admin','ACTIVE'),('m-manager','company-a','manager','SITE_MANAGER','org:member','ACTIVE'),('m-viewer','company-a','viewer','AUDITOR','org:member','ACTIVE'),('m-foreign','company-b','foreign','ADMIN','org:admin','ACTIVE'),('m-internal','internal','owner','ADMIN','org:admin','ACTIVE');
    INSERT INTO "Project" VALUES ('p-a','company-a','Synthetic worksite A','ACTIVE'),('p-a2','company-a','Synthetic worksite A2','ACTIVE'),('p-archived','company-a','Archived fixture','ARCHIVED'),('p-b','company-b','Synthetic worksite B','ACTIVE');
    INSERT INTO "ProjectMembership" VALUES ('pm-manager','p-a','m-manager','ACTIVE'),('pm-viewer','p-a','m-viewer','ACTIVE');
    INSERT INTO "Task" VALUES ('task-a','p-a','Synthetic scheduled task','IN_PROGRESS',37,'2026-10-01','2026-10-05','2026-09-30T12:00:00.123456','{"unrelated":"preserve"}'),('task-other','p-b','Other company task','BACKLOG',0,NULL,NULL,'2026-09-30T12:00:00.123456','{}');
  `);
  const store=createWorkspaceStore({connect:()=>pool.connect()});
  const own=await store.list(owner),manage=await store.list(manager),view=await store.list(viewer),other=await store.list(foreign);
  assert.deepEqual(own.projects.map(p=>p.id),['p-a','p-a2']);assert.deepEqual(manage.projects.map(p=>p.id),['p-a']);assert.deepEqual(view.projects.map(p=>p.id),['p-a']);assert.deepEqual(other.projects.map(p=>p.id),['p-b']);
  assert.equal(view.canPlanSchedule,false);assert.equal(manage.canPlanSchedule,true);checks.push('canonical-company-and-project-scope');
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
  const status=await store.status(manager,{projectId:'p-a',scope:manage.scope,operationId:original.operationId});assert.equal(status.state,'RECORDED');
  assert.equal((await store.status(owner,{projectId:'p-a',scope:own.scope,operationId:original.operationId})).state,'NOT_OBSERVED');checks.push('conflict-and-receipt-isolation');
  const beforeRollback=(await read()).tasks[0];
  const failing=createWorkspaceStore({connect:async()=>{const client=await pool.connect();return {release:bad=>client.release(bad),query:(sql,values)=>{if(sql.startsWith('INSERT INTO public."AuditLog"'))throw new Error('SYNTHETIC_PRIVATE_FAILURE');return client.query(sql,values);}};}});
  const failedInput={...await input(),startsOn:'2026-11-01',endsOn:'2026-11-05'};
  await assert.rejects(failing.schedule(manager,failedInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
  assert.deepEqual((await read()).tasks[0],beforeRollback);checks.push('audit-failure-rolls-back-schedule');
  const ambiguous=createWorkspaceStore({connect:async()=>{const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,values)=>{const result=await client.query(sql,values);if(sql==='COMMIT')throw new Error('Synthetic lost commit acknowledgement');return result;}};}});
  const ambiguousInput={...await input(),startsOn:'2026-11-03',endsOn:'2026-11-08'};
  await assert.rejects(ambiguous.schedule(manager,ambiguousInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
  assert.equal((await store.status(manager,{projectId:'p-a',scope:manage.scope,operationId:ambiguousInput.operationId})).state,'RECORDED');
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
  const result={status:'PASS',environment:'local-disposable-postgresql',checks,productionDataTouched:false,providerCalls:0,physicalWhatsAppTested:false};
  mkdirSync('.vercel/workspace-evidence',{recursive:true});writeFileSync('.vercel/workspace-evidence/postgres.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{
  await pool?.end();if(created)await admin.query(`DROP DATABASE "${name}"`);await admin.end();
}
