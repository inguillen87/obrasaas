import assert from 'node:assert/strict';
import {randomUUID,createHash,createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path,{posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleSchema} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {createCanonicalParticipantKycFixture} from './fixtures/canonical-participant-kyc.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {createWorkerChannelStore} from '../src/lib/worker-channel-identity.mjs';
import {createMetaFieldBridge,readMetaFieldConversation,metaFieldOperationId} from '../src/lib/meta-field-bridge.mjs';
import {createMetaCustomerInbox,createMetaCustomerCallbackHandlers,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {parseProcurementQuantity} from '../src/lib/procurement-quantity.js';

// Invocation requires an explicitly provisioned disposable loopback control DB:
// FIELD_EXECUTION_TEST_DISPOSABLE=1
// FIELD_EXECUTION_TEST_DATABASE_URL=postgresql://<local-user>@127.0.0.1:<port>/obrasaas_cutover_ci
// node scripts/verify-field-execution-postgres.mjs --run
// This creates and drops ONLY its own UUID-named database. It never reads
// DATABASE_URL, contacts a provider, or reuses an existing application schema.
export function fieldExecutionDisposableTarget(environment){
 assert.equal(environment.FIELD_EXECUTION_TEST_DISPOSABLE,'1','FIELD_EXECUTION_DISPOSABLE_MARKER_REQUIRED');
 assert.ok(!environment.VERCEL&&!environment.VERCEL_ENV,'FIELD_EXECUTION_PRODUCTION_CONTEXT_REJECTED');
 assert.equal(typeof environment.FIELD_EXECUTION_TEST_DATABASE_URL,'string','FIELD_EXECUTION_EXPLICIT_DATABASE_REQUIRED');
 const url=new URL(environment.FIELD_EXECUTION_TEST_DATABASE_URL);
 assert.ok(['postgres:','postgresql:'].includes(url.protocol),'FIELD_EXECUTION_DATABASE_PROTOCOL_REJECTED');
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'FIELD_EXECUTION_REMOTE_DATABASE_REJECTED');
 assert.equal(url.pathname,'/obrasaas_cutover_ci','FIELD_EXECUTION_CONTROL_DATABASE_REJECTED');
 assert.equal(url.search,'','FIELD_EXECUTION_DATABASE_OPTIONS_REJECTED');
 assert.equal(url.hash,'','FIELD_EXECUTION_DATABASE_FRAGMENT_REJECTED');
 return url;
}
export function fieldExecutionTargetGuards(){
 const valid={FIELD_EXECUTION_TEST_DISPOSABLE:'1',FIELD_EXECUTION_TEST_DATABASE_URL:'postgresql://synthetic@127.0.0.1:6548/obrasaas_cutover_ci'};
 assert.equal(fieldExecutionDisposableTarget(valid).hostname,'127.0.0.1');
 const invalid=[{}, {FIELD_EXECUTION_TEST_DISPOSABLE:'1',DATABASE_URL:valid.FIELD_EXECUTION_TEST_DATABASE_URL},{...valid,FIELD_EXECUTION_TEST_DISPOSABLE:'0'},{...valid,FIELD_EXECUTION_TEST_DATABASE_URL:undefined},...['https://127.0.0.1/obrasaas_cutover_ci','postgresql://db.example.invalid/obrasaas_cutover_ci','postgresql://127.0.0.1/neondb','postgresql://127.0.0.1/obrasaas_cutover_ci?sslmode=require','postgresql://127.0.0.1/obrasaas_cutover_ci#fragment'].map(FIELD_EXECUTION_TEST_DATABASE_URL=>({...valid,FIELD_EXECUTION_TEST_DATABASE_URL})),{...valid,VERCEL:'1'},{...valid,VERCEL_ENV:'production'}];
 for(const value of invalid)assert.throws(()=>fieldExecutionDisposableTarget(value));
 return {status:'TARGET_GUARDS_PASS_POSTGRES_NOT_EXECUTED',accepted:1,rejected:invalid.length,clientsConstructed:0};
}
const sha=value=>createHash('sha256').update(value).digest('hex');
const harness='scripts/verify-field-execution-postgres.mjs';
function sources(){
 const files=new Set();
 function visit(file){if(files.has(file))return;files.add(file);const text=readFileSync(file,'utf8');for(const m of text.matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g))visit(posix.normalize(posix.join(posix.dirname(file),m[1])));}
 for(const file of [harness,'package.json','package-lock.json'])visit(file);
 return [...files].sort().map(path=>({path,sha256:sha(readFileSync(path))}));
}
const identity=(userId,organizationId='org_A',organizationRole='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId,organizationId,organizationRole});
const owner=identity('user_Owner','org_A','org:admin'),director=identity('user_Director'),worker=identity('user_Worker'),foreign=identity('user_Foreign','org_B','org:admin');

export async function verifyFieldExecutionPostgres(environment){
 const url=fieldExecutionDisposableTarget(environment),database='obrasaas_field_execution_'+randomUUID().replaceAll('-',''),manifest=sources();
 assert.match(database,/^obrasaas_field_execution_[a-f0-9]{32}$/);
 const admin=new Client({connectionString:url.toString()}),checks=[],faultsObserved=[];let pool,created=false,fault=null;
 try{
  await admin.connect();await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);created=true;
  const target=new URL(url);target.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:target.toString(),max:12}));
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')`)).rows[0].n,0,'New database must have an empty application schema');
  await pool.query(lifecycleSchema);
  await pool.query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata) VALUES('company-a','Synthetic execution A','org_A','{}'),('company-b','Synthetic execution B','org_B','{}');
   INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('owner','user_Owner','owner@example.invalid'),('director','user_Director','director@example.invalid'),('worker','user_Worker','worker@example.invalid'),('foreign','user_Foreign','foreign@example.invalid');
   INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('owner-m','owner','company-a','ADMIN','org:admin','ACTIVE'),('director-m','director','company-a','DIRECTOR','org:member','ACTIVE'),('worker-m','worker','company-a','AUDITOR','org:member','ACTIVE'),('foreign-m','foreign','company-b','ADMIN','org:admin','ACTIVE');
   INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('p-a','company-a','Synthetic A','ACTIVE','{"unrelated":{"keep":true}}'),('p-b','company-b','Synthetic B','ACTIVE','{}'),('p-origin','company-a','Synthetic historical origin','ACTIVE','{}');
   INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('owner-p','p-a','owner-m','ACTIVE'),('director-p','p-a','director-m','ACTIVE'),('worker-p','p-a','worker-m','ACTIVE');`);
  async function addWorker(id,userId,phone){await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata) VALUES($1,'p-a',$1,$2,'WORKER',$3::jsonb)`,[id,phone,JSON.stringify({siteRegister:{version:1},participant:{version:1,clerkUserId:userId,status:'ACTIVE',permissions:{report:true,attendance:true},kyc:{version:1,status:'NOT_SUBMITTED'}}})]);}
  await addWorker('w-owner','user_Owner','+5491100001111');await addWorker('w-worker','user_Worker','+5491100002222');
  const connect=async()=>{
   const client=await pool.connect();let executionReceipt=false;
   return {release:broken=>client.release(broken),query:async(sql,args)=>{
    const text=typeof sql==='string'?sql:sql.text,auditInsert=text.startsWith('INSERT INTO public."AuditLog"'),isMovement=auditInsert&&text.includes("'material.inventory.moved'"),isExecution=auditInsert&&text.includes("'field.execution.applied'"),isReceipt=auditInsert&&text.includes("'field.operation.recorded'"),isTask=text.startsWith('UPDATE public."Task"'),receiptMetadata=isReceipt?JSON.parse(args.at(-1)):null,isExecutionReceipt=receiptMetadata?.command==='REPORT_EXECUTION';
    if(fault?.phase==='movement'&&isMovement&&++fault.seen===2||fault?.phase==='late-audit'&&isExecution||fault?.phase==='receipt'&&isExecutionReceipt){fault.hit=true;throw new Error('SYNTHETIC_FIELD_EXECUTION_'+fault.phase);}
    const result=await client.query(sql,args);
    if(fault?.phase==='task-rowcount'&&isTask){fault.hit=true;return {...result,rowCount:0};}
    if(isReceipt){executionReceipt=isExecutionReceipt;if(fault?.phase==='expire-after-receipt'&&executionReceipt){fault.hit=true;await client.query(`SELECT pg_sleep(GREATEST(0,extract(epoch FROM ($1::timestamptz-clock_timestamp())))+0.05)`,[fault.validUntil]);}if(fault?.phase==='channel-source-expiry'&&executionReceipt){fault.hit=true;assert.equal((await client.query(`UPDATE public."WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()-interval '1 millisecond' WHERE id=$1 AND status='PENDING'`,[fault.eventId])).rowCount,1);}}
    if(text==='COMMIT'&&executionReceipt&&fault?.phase==='commit-ack'){fault.hit=true;throw new Error('SYNTHETIC_FIELD_EXECUTION_COMMIT_ACK_LOST');}
    return result;
   }};
  };
  const workspace=createWorkspaceStore({connect}),field=createFieldOperations({workspace}),kyc=createCanonicalParticipantKycFixture({workspace,connect,query:(...args)=>pool.query(...args)});
  await kyc.approve({projectId:'p-a',workerId:'w-owner',actor:owner,reviewer:director});
  await kyc.approve({projectId:'p-a',workerId:'w-worker',actor:worker,reviewer:owner});
  await addWorker('w-director','user_Director','+5491100003333');await kyc.approve({projectId:'p-a',workerId:'w-director',actor:director,reviewer:owner});
  // An inactive historical linkage retains the existing account-bound fence;
  // it supplies no KYC approval or permission in the execution project.
  await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES('w-director-origin','p-origin','Synthetic old link','+5491100004444',false,'{"participant":{"version":1,"clerkUserId":"user_Director","status":"REVOKED"}}')`);
  const context=async(actor,projectId='p-a')=>({projectId,scope:(await workspace.list(actor)).scope}),ownerContext=await context(owner),directorContext=await context(director),workerContext=await context(worker),foreignContext=await context(foreign,'p-b');
  const command=(ctx,action,payload)=>({...ctx,operationId:randomUUID(),action,payload}),read=()=>field.read(owner,ownerContext);
  const task=async id=>(await pool.query(`SELECT id,title,status::text AS status,progress,metadata,"startsAt"::text AS "startsAt","endsAt"::text AS "endsAt",to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Task" WHERE id=$1 AND "projectId"='p-a'`,[id])).rows[0];
  async function addTask(id,status='BACKLOG'){await pool.query(`INSERT INTO "Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata,"updatedAt") VALUES($1,'p-a',$1,$2::"TaskStatus",0,'2026-10-01','2026-12-31','{"unrelated":{"keep":"task"}}',clock_timestamp())`,[id,status]);return task(id);}
  const expiry=async seconds=>(await pool.query(`SELECT (clock_timestamp()+($1::text||' seconds')::interval) AS until`,[seconds])).rows[0].until.toISOString();
  async function state(){const client=await pool.connect();try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const out={};for(const table of ['Organization','PlatformUser','TenantMembership','ProjectMembership','Project','Worker','Task','Incident','OperationalProposal','AuditLog'])out[table]=(await client.query(`SELECT to_jsonb(t) AS value FROM public."${table}" t ORDER BY id`)).rows.map(row=>row.value);return JSON.stringify(out);}finally{try{await client.query('ROLLBACK');}finally{client.release();}}}
  const unchanged=async(fn,codes)=>{const before=await state();await assert.rejects(fn,error=>!codes||codes.includes(error.code));assert.equal(await state(),before,'Rejected execution must leave every business, receipt and audit row unchanged');};
  await field.save(owner,command(ownerContext,'CONFIGURE_SITE',{revision:(await read()).projectRevision,sectors:[{id:'sector-a',name:'Synthetic sector',latitude:0,longitude:0,radius:100}]}));
  async function stock(name,unit,amount){const view=await read(),added=await field.save(owner,command(ownerContext,'ADD_MATERIAL',{revision:view.projectRevision,catalogHash:view.inventory.catalogHash,name,unit})),catalog=(await read()).inventory.catalogHash;const proposed=await field.save(owner,command(ownerContext,'PROPOSE_STOCK_ADJUSTMENT',{materialId:added.material.id,catalogHash:catalog,quantity:amount,direction:'IN',source:{type:'OPENING',reference:'Synthetic counted opening '+name},reason:'Synthetic independent opening count for exact stock.'}));await field.save(director,command(directorContext,'DECIDE_STOCK_ADJUSTMENT',{proposalId:proposed.adjustment.id,revision:proposed.adjustment.revision,catalogHash:catalog,decision:'APPROVE',reason:'Another authorized actor checked synthetic opening.'}));return added.material.id;}
  const materialId=await stock('Synthetic execution cement','bolsa','100.000'),raceMaterialId=await stock('Synthetic race stock','kg','1.000');await addTask('task-a');await addTask('task-progress','BLOCKED');
  const balance=async id=>(await read()).inventory.materials.find(row=>row.id===id).balance;
  async function issueMandate({actor=owner,ctx=ownerContext,workerId='w-worker',taskId='task-a',materials=[{materialId,unit:'bolsa',limit:'50',maxPerReport:'10'}],progress=null,validUntil}={}){return field.save(actor,command(ctx,'ISSUE_EXECUTION_MANDATE',{workerId,taskId,taskRevision:(await task(taskId)).revision,sectorId:'sector-a',catalogHash:(await read()).inventory.catalogHash,validUntil:validUntil||await expiry(3600),materials,progress,reason:'Another actor explicitly authorizes these exact bounded facts.'}));}
  async function reportCommand(m,{lines=[{lineId:'line-b',materialId,unit:'bolsa',quantity:'1.000'},{lineId:'line-a',materialId,unit:'bolsa',quantity:'0.001'}],progress=null,evidenceIds=[],reportId=randomUUID()}={}){return command(workerContext,'REPORT_EXECUTION',{reportId,mandateId:m.id,mandateRevision:m.revision,workerId:m.workerId,taskId:m.taskId,taskRevision:(await task(m.taskId)).revision,sectorId:m.sectorId,catalogHash:m.catalogHash,lines,progress,evidenceIds,reason:'Explicit structured facts reported by their own worker.'});}
  const movements=async id=>(await pool.query(`SELECT id,metadata FROM "AuditLog" WHERE action='material.inventory.moved' AND metadata->>'executionId'=$1 ORDER BY metadata->>'lineId'`,[id])).rows;
  const mandateState=async id=>(await pool.query(`SELECT metadata FROM "AuditLog" WHERE id=$1 AND action='field.execution.mandate'`,[id])).rows[0].metadata;

  await unchanged(()=>issueMandate({workerId:'w-owner'}),['FIELD_MAKER_CHECKER_REQUIRED']);
  await unchanged(()=>issueMandate({actor:worker,ctx:workerContext}),['FIELD_EXECUTION_MANAGE_REQUIRED']);
  const issued=await issueMandate(),m=issued.mandate;assert.equal(issued.stockChanged,false);assert.equal(issued.taskUpdated,false);assert.equal(m.issuedBy,'owner');assert.equal(m.reporterActorId,'worker');
  assert.equal((await field.executionMandate(worker,{...workerContext,executionMandateId:m.id})).readOnly,true);
  await assert.rejects(field.executionMandate(foreign,{...foreignContext,executionMandateId:m.id}),{code:'FIELD_EXECUTION_MANDATE_UNAVAILABLE'});
  checks.push('canonical-distinct-issuer-reporter-KYC-role-tenant-and-read-only-mandate-boundaries');

  const first=await reportCommand(m),beforeTask=await task('task-a'),applied=await field.save(worker,first);assert.equal(applied.kind,'EXECUTION_APPLIED');assert.equal(applied.effectsApplied,true);assert.equal(applied.taskUpdated,false);assert.equal(applied.execution.measurement,null);assert.deepEqual(await task('task-a'),beforeTask);assert.equal(await balance(materialId),'98.999');
  const ledger=await movements(applied.execution.id);assert.equal(ledger.length,2);assert.equal(new Set(ledger.map(row=>row.id)).size,2);assert.deepEqual(ledger.map(row=>[row.metadata.lineId,row.metadata.balanceBefore,row.metadata.balanceAfter]),[['line-a','100.000','99.999'],['line-b','99.999','98.999']]);assert.ok(ledger.every(row=>row.metadata.authorizedBy==='owner'&&row.metadata.submittedBy==='worker'&&row.metadata.direction==='OUT'&&row.metadata.executionReceiptId===applied.receiptId));assert.equal((await mandateState(m.id)).used[0].quantity,'1.001');
  const afterFirst=await state();assert.equal((await field.save(worker,first)).replayed,true);assert.equal(await state(),afterFirst);
  checks.push('real-per-line-exact-stock-ledger-quota-and-receipt-commit-together-with-no-inferred-task-percent');

  const concurrent=await reportCommand(m),twins=await Promise.all([field.save(worker,concurrent),field.save(worker,{...concurrent,operationId:randomUUID()})]);assert.equal(twins.filter(row=>row.effectsApplied).length,1);assert.equal(twins.filter(row=>row.executionReplay).length,1);assert.equal((await movements(twins[0].execution.id)).length,2);assert.equal(await balance(materialId),'97.998');assert.equal((await mandateState(m.id)).used[0].quantity,'2.002');
  const conflict={...concurrent,operationId:randomUUID(),payload:{...concurrent.payload,reason:'Changed fact under the same external report identity.'}};await unchanged(()=>field.save(worker,conflict),['FIELD_EXECUTION_REPORT_CONFLICT']);
  checks.push('concurrent-same-report-new-operation-UUIDs-deduct-exactly-once-and-changed-facts-conflict');

  const quotas=(await issueMandate({materials:[{materialId,unit:'bolsa',limit:'0.003',maxPerReport:'0.002'}]})).mandate;
  await unchanged(async()=>field.save(worker,await reportCommand(quotas,{lines:[{lineId:'a',materialId,unit:'bolsa',quantity:'0.002'},{lineId:'b',materialId,unit:'bolsa',quantity:'0.001'}]})),['FIELD_EXECUTION_ALLOWANCE_EXCEEDED']);
  await field.save(worker,await reportCommand(quotas,{lines:[{lineId:'a',materialId,unit:'bolsa',quantity:'0.002'}]}));await unchanged(async()=>field.save(worker,await reportCommand(quotas,{lines:[{lineId:'a',materialId,unit:'bolsa',quantity:'0.002'}]})),['FIELD_EXECUTION_ALLOWANCE_EXCEEDED']);
  checks.push('repeated-material-lines-share-per-report-and-lifetime-exact-allowances');

  const raceMandates=[];for(let i=0;i<2;i++)raceMandates.push((await issueMandate({materials:[{materialId:raceMaterialId,unit:'kg',limit:'1',maxPerReport:'1'}]})).mandate);
  const raceCommands=await Promise.all(raceMandates.map(mandate=>reportCommand(mandate,{lines:[{lineId:'a',materialId:raceMaterialId,unit:'kg',quantity:'0.750'}]}))),race=await Promise.allSettled(raceCommands.map(cmd=>field.save(worker,cmd)));assert.equal(race.filter(row=>row.status==='fulfilled').length,1);assert.equal(race.find(row=>row.status==='rejected').reason.code,'INVENTORY_STOCK_INSUFFICIENT');assert.equal(await balance(raceMaterialId),'0.250');assert.deepEqual((await Promise.all(raceMandates.map(async mandate=>(await mandateState(mandate.id)).used[0].quantity))).sort(),['0.000','0.750']);
  checks.push('distinct-concurrent-mandates-share-the-project-lock-and-cannot-overdraw-stock');

  for(const phase of ['movement','late-audit','receipt']){const cmd=await reportCommand(m);fault={phase,seen:0,hit:false};try{await unchanged(()=>field.save(worker,cmd),['WORKSPACE_OPERATION_UNCONFIRMED']);assert.equal(fault.hit,true);faultsObserved.push(phase);}finally{fault=null;}assert.equal((await field.status(worker,{...workerContext,operationId:cmd.operationId})).state,'NOT_OBSERVED');}
  checks.push('second-movement-late-execution-audit-and-final-receipt-failures-roll-back-all-state');

  const revocable=(await issueMandate()).mandate;await field.save(owner,command(ownerContext,'REVOKE_EXECUTION_MANDATE',{mandateId:revocable.id,revision:revocable.revision,reason:'Responsible actor explicitly revokes future execution.'}));await unchanged(async()=>field.save(worker,await reportCommand(revocable)),['FIELD_EXECUTION_MANDATE_REVOKED']);
  const short=(await issueMandate({validUntil:await expiry(5)})).mandate,expiresCommand=await reportCommand(short);fault={phase:'expire-after-receipt',validUntil:short.validUntil,hit:false};try{await unchanged(()=>field.save(worker,expiresCommand),['FIELD_EXECUTION_MANDATE_EXPIRED']);assert.equal(fault.hit,true);faultsObserved.push(fault.phase);}finally{fault=null;}
  checks.push('explicit-revocation-and-real-database-clock-expiry-after-receipt-insertion-prevent-commit');

  const directorMandate=(await issueMandate({actor:director,ctx:directorContext})).mandate;
  for(const [sql,restore,codes]of [[`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='director-m'`,`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='director-m'`,['FIELD_EXECUTION_ISSUER_UNAVAILABLE']],[`UPDATE "ProjectMembership" SET status='DISABLED' WHERE id='director-p'`,`UPDATE "ProjectMembership" SET status='ACTIVE' WHERE id='director-p'`,['FIELD_EXECUTION_ISSUER_UNAVAILABLE']],[`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"PENDING_REVIEW"') WHERE id='w-director'`,null,['FIELD_EXECUTION_ISSUER_UNAVAILABLE']]]){const prior=(await pool.query(`SELECT metadata FROM "Worker" WHERE id='w-director'`)).rows[0].metadata;await pool.query(sql);try{await unchanged(async()=>field.save(worker,await reportCommand(directorMandate)),codes);}finally{if(restore)await pool.query(restore);else await pool.query(`UPDATE "Worker" SET metadata=$1::jsonb WHERE id='w-director'`,[JSON.stringify(prior)]);}}
  const directorRow=(await pool.query(`SELECT * FROM "Worker" WHERE id='w-director'`)).rows[0];await pool.query(`DELETE FROM "Worker" WHERE id='w-director'`);try{await unchanged(async()=>field.save(worker,await reportCommand(directorMandate)),['FIELD_EXECUTION_ISSUER_UNAVAILABLE']);}finally{await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,active,metadata,"createdAt","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,[directorRow.id,directorRow.projectId,directorRow.name,directorRow.phone,directorRow.role,directorRow.active,JSON.stringify(directorRow.metadata),directorRow.createdAt,directorRow.updatedAt]);}
  checks.push('issuer-membership-assignment-KYC-and-account-bound-missing-worker-admission-remain-current');

  const held=await pool.connect();try{await held.query('BEGIN');await held.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='director-m'`);const pendingCommand=await reportCommand(directorMandate),pending=field.save(worker,pendingCommand).then(value=>({value}),error=>({error}));let waiting=false;for(let attempt=0;attempt<100;attempt++){if((await pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT u.id AS "actorId"%'`)).rows.length){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}assert.equal(waiting,true,'Report must wait for the issuer membership lock before the Project lock');await held.query('COMMIT');const result=await pending;assert.equal(result.error?.code,'FIELD_EXECUTION_ISSUER_UNAVAILABLE');assert.equal((await field.status(worker,{...workerContext,operationId:pendingCommand.operationId})).state,'NOT_OBSERVED');}finally{await held.query('ROLLBACK');held.release();await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='director-m'`);}
  checks.push('concurrent-prior-issuer-revocation-is-observed-without-project-membership-lock-inversion');

  const workerRow=(await pool.query(`SELECT metadata FROM "Worker" WHERE id='w-worker'`)).rows[0].metadata;await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"PENDING_REVIEW"') WHERE id='w-worker'`);try{await unchanged(async()=>field.save(worker,await reportCommand(m)),['PARTICIPANT_KYC_REVIEW_REQUIRED','FIELD_KYC_REVIEW_REQUIRED']);}finally{await pool.query(`UPDATE "Worker" SET metadata=$1::jsonb WHERE id='w-worker'`,[JSON.stringify(workerRow)]);}
  const stale=await reportCommand(m);stale.payload.taskRevision='2000-01-01T00:00:00.000000';await unchanged(()=>field.save(worker,stale),['FIELD_REVISION_CHANGED']);const unit=await reportCommand(m,{lines:[{lineId:'a',materialId,unit:'kg',quantity:'0.001'}]});await unchanged(()=>field.save(worker,unit),['FIELD_EXECUTION_MATERIAL_SCOPE']);
  const projectBefore=(await pool.query(`SELECT metadata FROM "Project" WHERE id='p-a'`)).rows[0].metadata;await pool.query(`UPDATE "Project" SET metadata=jsonb_set(metadata,'{materialInventory,catalogVersion}',to_jsonb((metadata->'materialInventory'->>'catalogVersion')::int+1)) WHERE id='p-a'`);try{await unchanged(async()=>field.save(worker,await reportCommand(m)),['INVENTORY_CATALOG_CHANGED']);}finally{await pool.query(`UPDATE "Project" SET metadata=$1::jsonb WHERE id='p-a'`,[JSON.stringify(projectBefore)]);}
  checks.push('reporter-KYC-stale-task-current-catalog-and-physical-unit-fences-reject-with-no-effects');

  const configured=await field.save(owner,command(ownerContext,'CONFIGURE_PROGRESS_MEASUREMENT',{taskId:'task-progress',revision:(await task('task-progress')).revision,baseline:'10.0000',unit:'M2',sourceReference:'Synthetic confirmed task measurement',reason:'Responsible actor configured an explicit quantity baseline.'})),measurement=configured.task.measurement;
  const evidenceId='evidence-execution';await pool.query(`INSERT INTO "Incident"(id,"projectId",title,description,metadata,"updatedAt") VALUES($1,'p-a','Synthetic evidence','Synthetic captured fact',$2::jsonb,clock_timestamp())`,[evidenceId,JSON.stringify({fieldOperations:{version:1,kind:'EVIDENCE',workerId:'w-worker',taskId:'task-progress',sectorId:'sector-a',recordedBy:'worker',capturedAt:await expiry(-1),media:{kind:'image',contentType:'image/png',bytes:1,sha256:'a'.repeat(64),pathname:'obrasaas/field/v1/'+'a'.repeat(64)+'/evidence.png'},review:null}})]);
  const measuredMandate=(await issueMandate({taskId:'task-progress',progress:{definitionId:measurement.definitionId,baseline:measurement.baseline,unit:measurement.unit,limit:'4.0000',maxPerReport:'2.0000'}})).mandate,measuredCommand=await reportCommand(measuredMandate,{progress:{definitionId:measurement.definitionId,baseline:measurement.baseline,unit:measurement.unit,mode:'DELTA',quantity:'1.2500'},evidenceIds:[evidenceId]});
  await unchanged(()=>field.save(worker,measuredCommand),['FIELD_EVIDENCE_NOT_APPROVED']);const evidenceRevision=(await pool.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Incident" WHERE id=$1`,[evidenceId])).rows[0].revision;await field.save(owner,command(ownerContext,'REVIEW_EVIDENCE',{evidenceId,revision:evidenceRevision,decision:'APPROVE',reason:'Another actor approved the exact captured synthetic fact.'}));
  const taskBefore=await task('task-progress'),progressResult=await field.save(worker,measuredCommand),taskAfter=await task('task-progress');assert.equal(progressResult.execution.measurement.executed,'1.2500');assert.equal(taskAfter.progress,12);assert.equal(taskAfter.status,'BLOCKED');assert.equal(taskAfter.startsAt,taskBefore.startsAt);assert.equal(taskAfter.endsAt,taskBefore.endsAt);assert.deepEqual(taskAfter.metadata.unrelated,taskBefore.metadata.unrelated);assert.deepEqual(taskAfter.metadata.fieldOperations.measurement,taskBefore.metadata.fieldOperations.measurement);assert.equal((await mandateState(measuredMandate.id)).progressUsed,'1.2500');
  await unchanged(async()=>field.save(worker,await reportCommand(measuredMandate,{progress:{definitionId:measurement.definitionId,baseline:measurement.baseline,unit:measurement.unit,mode:'DELTA',quantity:'2.0001'},evidenceIds:[evidenceId]})),['FIELD_EXECUTION_ALLOWANCE_EXCEEDED']);
  await unchanged(async()=>field.save(worker,await reportCommand(measuredMandate,{progress:{definitionId:measurement.definitionId,baseline:measurement.baseline,unit:measurement.unit,mode:'CUMULATIVE',quantity:'1.0000'},evidenceIds:[evidenceId]})),['TASK_MEASUREMENT_REGRESSION']);
  checks.push('explicit-measurement-and-independently-approved-evidence-drive-progress-preserving-BLOCKED-dates-and-unrelated-metadata');

  const lateMeasured=await reportCommand(measuredMandate,{progress:{definitionId:measurement.definitionId,baseline:measurement.baseline,unit:measurement.unit,mode:'DELTA',quantity:'0.5000'},evidenceIds:[evidenceId]});for(const phase of ['late-audit','receipt','task-rowcount']){fault={phase,seen:0,hit:false};try{await unchanged(()=>field.save(worker,lateMeasured),phase==='task-rowcount'?['FIELD_EXECUTION_WRITE_CONFLICT']:['WORKSPACE_OPERATION_UNCONFIRMED']);assert.equal(fault.hit,true);faultsObserved.push('measured-'+phase);}finally{fault=null;}}
  checks.push('late-measured-task-proposal-quota-ledger-and-receipt-failures-roll-back-atomically');

  const lost=await reportCommand(m),beforeLost=await balance(materialId);fault={phase:'commit-ack',hit:false};try{await assert.rejects(field.save(worker,lost),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal(fault.hit,true);faultsObserved.push(fault.phase);}finally{fault=null;}
  const recovered=await field.status(worker,{...workerContext,operationId:lost.operationId});assert.equal(recovered.state,'RECORDED');assert.equal(recovered.execution.reportId,lost.payload.reportId);assert.equal((await movements(recovered.execution.id)).length,2);const durable=await state();assert.equal((await field.save(worker,lost)).replayed,true);assert.equal(await state(),durable);assert.notEqual(await balance(materialId),beforeLost);
  checks.push('lost-commit-ack-is-recovered-by-canonical-status-and-replay-without-a-second-debit');

  // This is an actual signed inbox -> canonical channel resolver -> two-phase
  // bridge -> field store path in this disposable database. No outbound send,
  // provider fetch, model or private-media API is configured or invoked.
  const channelEnvironment={META_APP_SECRET:'synthetic-field-execution-HMAC-no-provider',META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,51).toString('base64')},channelId='execution-channel',phoneNumberId='120000071',wabaId='130000071';
  const channelMetadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:'company-a',customerSubscribed:true,customerVerification:{registered:true,expiresAt:null,scopes:['whatsapp_business_management','whatsapp_business_messaging']},customerActivation:{version:1,state:'ACTIVE',actorId:'owner'}};
  await pool.query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken","displayPhoneNumber",metadata) VALUES($1,'p-a',true,'CONNECTED',$2,$3,$4,'+5491100009999',$5::jsonb)`,[channelId,phoneNumberId,wabaId,encryptCustomerSecret('synthetic-field-execution-token',{organizationId:'company-a',projectId:'p-a',purpose:'access-token',resourceId:phoneNumberId},channelEnvironment),JSON.stringify(channelMetadata)]);
  const channel=createWorkerChannelStore({workspace}),bridge=createMetaFieldBridge({connect,environment:channelEnvironment}),inbox=createMetaCustomerInbox({connect,environment:channelEnvironment}),callback=createMetaCustomerCallbackHandlers({inbox,environment:channelEnvironment}),dispatched=new Map();let outboundCalls=0;
  const processor=createMetaCustomerProcessor({connect,environment:channelEnvironment,dispatch:async context=>{const result=await bridge.execute(context);dispatched.set(context.eventId,result);return result;},outbound:{send:async()=>{outboundCalls++;return {replySent:false,state:'SYNTHETIC_NOT_SENT'};}}});
  async function push(message,{signatureValid=true,messageId='wamid.'+randomUUID().replaceAll('-','')}={}){
   const value={id:messageId,from:'5491100002222',timestamp:String(Math.floor(Date.now()/1000)),...(typeof message==='string'?{type:'text',text:{body:message}}:message)},payload={object:'whatsapp_business_account',entry:[{id:wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:phoneNumberId},messages:[value]}}]}]},bytes=Buffer.from(JSON.stringify(payload)),signature='sha256='+createHmac('sha256',channelEnvironment.META_APP_SECRET).update(bytes).digest('hex'),response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':signatureValid?signature:'sha256='+'0'.repeat(64)},body:bytes}));
   if(!signatureValid){assert.equal(response.status,403);return null;}assert.equal(response.status,200);const eventId='customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId;if(fault?.phase==='channel-source-expiry')fault.eventId=eventId;const job=await processor.recover({eventIds:[eventId]});return {eventId,job,result:dispatched.get(eventId),messageId,payload};
  }
  async function channelConversation(){const row=(await pool.query(`SELECT id,metadata FROM "Worker" WHERE id='w-worker'`)).rows[0];return readMetaFieldConversation({worker:row,member:{organizationId:'company-a'},project:{id:'p-a'},channelBinding:row.metadata.participant.channelIdentity.binding},channelEnvironment);}
  async function choice(value){const state=await channelConversation(),index=state.choices.findIndex(row=>row.value===value);assert.ok(index>=0,'Expected canonical execution choice '+value);return push({type:'interactive',interactive:{type:'list_reply',list_reply:{id:'obra:'+state.nonce+':'+index}}});}
  const personal=(await channel.read(worker,workerContext)).records.find(row=>row.workerId==='w-worker'),challenge=await channel.command(worker,{...workerContext,operationId:randomUUID(),action:'REQUEST_CHALLENGE',payload:{workerId:'w-worker',revision:personal.revision}}),bound=await push(challenge.code);assert.equal(bound.result?.kind,'CHANNEL_BOUND');
  const chatMandate=(await issueMandate({materials:[{materialId,unit:'bolsa',limit:'1',maxPerReport:'1'}]})).mandate,beforeChat=await balance(materialId),beforeInvalid=await state();await push('REPORTAR',{signatureValid:false});assert.equal(await state(),beforeInvalid);
  const started=await push('REPORTAR');assert.equal(started.result?.kind,'CONVERSATION');await choice(chatMandate.id);await push('0.001');await push('Material exacto aplicado a la tarea desde el canal.');const confirmed=await choice('CONFIRM');assert.equal(confirmed.result?.kind,'EXECUTION_APPLIED',JSON.stringify(confirmed.job));assert.equal(confirmed.result.businessApplied,true);assert.match(confirmed.result.reply.body,/salida registrada/);
  assert.equal(parseProcurementQuantity(beforeChat)-parseProcurementQuantity(await balance(materialId)),1n);const canonicalReceipt=await field.status(worker,{...workerContext,operationId:metaFieldOperationId(confirmed.eventId,'REPORT_EXECUTION')});assert.equal(canonicalReceipt.kind,'EXECUTION_APPLIED');assert.equal(canonicalReceipt.execution.executedBy,'worker');assert.equal(canonicalReceipt.execution.authorizedBy,'owner');assert.equal((await movements(canonicalReceipt.execution.id)).length,1);
  const afterChat=await state(),afterChatBalance=await balance(materialId);assert.equal((await processor.recover({eventIds:[confirmed.eventId]})).results[0].done,true);assert.equal(await state(),afterChat);
  checks.push('real-signed-WhatsApp-callback-encrypted-inbox-current-binding-two-phase-canonical-lock-order-and-confirmed-OUT-commit-once');
  const receiptRead=await push('EJECUCIONES');assert.equal(receiptRead.result?.kind,'CONVERSATION');const detail=await choice(canonicalReceipt.receiptId);assert.equal(detail.result?.businessApplied,false);assert.match(detail.result.reply.body,new RegExp(canonicalReceipt.execution.reportId));assert.equal(await balance(materialId),afterChatBalance);assert.equal((await movements(canonicalReceipt.execution.id)).length,1);assert.ok(outboundCalls>0,'Only the injected no-send outbound adapter ran');
  checks.push('WhatsApp-own-execution-receipts-observe-the-canonical-report-without-another-stock-or-task-write');
  await push('REPORTAR');await choice(chatMandate.id);await push('0.001');await push('Otro hecho exacto cuyo lease se comprueba al final.');const retainedSourceDraft=await channelConversation(),sourceBalance=await balance(materialId),sourceUsage=await mandateState(chatMandate.id);let expiredSource;
  fault={phase:'channel-source-expiry',hit:false};try{expiredSource=await choice('CONFIRM');assert.equal(fault.hit,true);assert.equal(expiredSource.result,undefined);assert.ok(expiredSource.job.results.some(row=>row.code==='META_CUSTOMER_INBOX_LEASE_CHANGED'));faultsObserved.push(fault.phase);}finally{fault=null;}
  assert.equal(await balance(materialId),sourceBalance);assert.deepEqual(await mandateState(chatMandate.id),sourceUsage);assert.deepEqual(await channelConversation(),retainedSourceDraft);assert.equal((await field.status(worker,{...workerContext,operationId:metaFieldOperationId(expiredSource.eventId,'REPORT_EXECUTION')})).state,'NOT_OBSERVED');assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action='meta.field.dispatched' AND metadata->>'eventId'=$1`,[expiredSource.eventId])).rows[0].n,0);
  const sourceRetried=await processor.recover({eventIds:[expiredSource.eventId]});assert.equal(sourceRetried.results[0].processed,true);const sameFact=await field.status(worker,{...workerContext,operationId:metaFieldOperationId(expiredSource.eventId,'REPORT_EXECUTION')});assert.equal(sameFact.execution.reportId,retainedSourceDraft.reportId);assert.equal((await movements(sameFact.execution.id)).length,1);assert.equal(parseProcurementQuantity(sourceBalance)-parseProcurementQuantity(await balance(materialId)),1n);
  checks.push('ordinary-channel-source-lease-expiring-after-business-receipt-rolls-back-all-effects-and-retries-the-identical-fact-once');
  for(const entry of manifest)assert.equal(sha(readFileSync(entry.path)),entry.sha256,'Source changed during PostgreSQL verification: '+entry.path);
  return {status:'PASS',environment:'disposable-loopback-new-database',checks,checkCount:checks.length,faultsObserved,sourceManifest:manifest,harnessSha256:sha(readFileSync(harness)),canonicalKyc:{records:kyc.records,privateSyntheticCalls:kyc.calls,providerCalls:0},productionDataTouched:false,providerCalls:0,humanAccepted:false,newProductionTables:false};
 }finally{try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,3,'Use --guard-self-test or --run with the explicit disposable environment');
 if(process.argv[2]==='--guard-self-test')console.log(JSON.stringify(fieldExecutionTargetGuards()));
 else {assert.equal(process.argv[2],'--run');console.log(JSON.stringify(await verifyFieldExecutionPostgres(process.env)));}
}
