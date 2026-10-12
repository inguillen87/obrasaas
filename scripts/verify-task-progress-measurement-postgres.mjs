import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,Pool} from 'pg';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL} from './lib/company-channel-disposable-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {createCanonicalParticipantKycFixture} from './fixtures/canonical-participant-kyc.mjs';

// Standalone native PostgreSQL integration. No browser, production database,
// Clerk, Meta, OCR, document provider or other HTTP endpoint is contacted.
export function taskProgressMeasurementDisposableUrl(environment={}){
  const fail=()=>{throw Object.assign(new Error('TASK_PROGRESS_DISPOSABLE_TARGET_REJECTED'),{code:'TASK_PROGRESS_DISPOSABLE_TARGET_REJECTED'});};
  let target;try{target=new URL(environment.CUTOVER_TEST_DATABASE_URL);}catch{fail();}
  if(environment.CUTOVER_TEST_DISPOSABLE!=='1'||environment.VERCEL||environment.VERCEL_ENV||environment.VERCEL_TARGET_ENV||!['postgres:','postgresql:'].includes(target.protocol)||!['127.0.0.1','localhost'].includes(target.hostname)||!['5432','6549'].includes(target.port)||target.username!=='cutover_test'||target.pathname!=='/obrasaas_cutover_ci'||target.search||target.hash||(target.port==='6549'?target.password!=='':!['','cutover_test'].includes(target.password)))fail();
  return target;
}

const session=(userId,organizationId='org_A',organizationRole='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId,organizationId,organizationRole});
const sha=value=>createHash('sha256').update(value).digest('hex');
const quantities=row=>row.metadata?.fieldOperations?.quantity;
const definition=row=>row.metadata?.fieldOperations?.measurement;
const sameDates=(before,after)=>{assert.equal(after.startsAt?.toISOString(),before.startsAt?.toISOString());assert.equal(after.endsAt?.toISOString(),before.endsAt?.toISOString());};
const ownedDatabase=name=>assert.match(name,/^obrasaas_task_measurement_[a-f0-9]{32}$/);
const publicMeasurementKeys=['version','definitionId','baseline','unit','executed','sourceReference','configuredAt','approvedProposalId','approvedAt'];
const assertPublicMeasurement=value=>{assert.deepEqual(Object.keys(value).sort(),publicMeasurementKeys.toSorted());assert.equal(Object.hasOwn(value,'configuredBy'),false);assert.equal(Object.hasOwn(value,'metadata'),false);};

export function taskProgressMeasurementSourceFiles(root=process.cwd()){
  const files=new Set();
  const visit=file=>{
    assert.ok(file.startsWith('src/')||file.startsWith('scripts/'),'Only this native fixture source graph');
    if(files.has(file))return;files.add(file);
    const source=readFileSync(path.join(root,file),'utf8');
    for(const match of source.matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g))visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1])));
  };
  visit('scripts/verify-task-progress-measurement-postgres.mjs');return [...files].sort();
}

export async function verifyTaskProgressMeasurementPostgres(environment=process.env){
  const target=taskProgressMeasurementDisposableUrl(environment),database='obrasaas_task_measurement_'+randomUUID().replaceAll('-','');
  ownedDatabase(database);
  const admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000}),checks=[];
  let connected=false,created=false,removed=false,pool,poolClosed=false,uncontrolledHttp=0;
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async()=>{uncontrolledHttp++;throw new Error('TASK_PROGRESS_UNCONTROLLED_HTTP_REJECTED');};
  try{
    await admin.connect();connected=true;
    assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,'obrasaas_cutover_ci');
    ownedDatabase(database);await admin.query(`CREATE DATABASE "${database}"`);created=true;
    const fixture=new URL(target);fixture.pathname='/'+database;
    pool=trackDisposablePool(new Pool({connectionString:fixture.toString(),max:8,connectionTimeoutMillis:5000}));
    assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,database);
    await pool.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
    await pool.query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('director','user_Director','director@example.invalid'),('planner','user_Planner','planner@example.invalid');
      INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('director-m','director','org-a','DIRECTOR','org:member','ACTIVE'),('planner-m','planner','org-a','SITE_MANAGER','org:member','ACTIVE');
      INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('owner-pm','project-a','owner-m','ACTIVE'),('director-pm','project-a','director-m','ACTIVE'),('planner-pm','project-a','planner-m','ACTIVE');`);
    const connect=async()=>{const client=await pool.connect();return {query:(...args)=>client.query(...args),release:broken=>client.release(broken)};};
    const workspace=createWorkspaceStore({connect}),operations=createFieldOperations({workspace});
    const owner=session('user_Owner','org_A','org:admin'),worker=session('user_Person'),director=session('user_Director'),planner=session('user_Planner'),foreign=session('user_Foreign','org_B','org:admin');
    const context=async actor=>({projectId:'project-a',scope:(await workspace.list(actor)).scope});
    const actorContexts=new Map();for(const actor of [owner,worker,director,planner])actorContexts.set(actor.userId,await context(actor));
    const command=(actor,action,payload,operationId=randomUUID())=>({...actorContexts.get(actor.userId),operationId,action,payload});
    const rawTask=async(id='task-a')=>(await pool.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Task" WHERE id=$1`,[id])).rows[0];
    const publicTask=async(actor=owner,id='task-a')=>(await workspace.read(actor,actorContexts.get(actor.userId))).tasks.find(task=>task.id===id);
    const state=async()=>(await pool.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM "Task" t) AS tasks,
      (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id),'[]'::jsonb) FROM "OperationalProposal" p) AS proposals,
      (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb) FROM "AuditLog" a) AS audits`)).rows[0];
    const check=async(name,run)=>{await run();checks.push(name);};
    const rejectedWithoutWrites=async(run,code=null)=>{const before=await state();await assert.rejects(run,error=>code?error.code===code:typeof error.code==='string');assert.deepEqual(await state(),before);};
    const configure=async(actor=owner,{taskId='task-a',baseline='100',unit='M2',sourceReference='Synthetic approved plan sheet A',reason='Synthetic responsible baseline declaration.',operationId=randomUUID(),revision=null}={})=>operations.save(actor,command(actor,'CONFIGURE_PROGRESS_MEASUREMENT',{taskId,revision:revision??(await rawTask(taskId)).revision,baseline,unit,sourceReference,reason},operationId));
    const cancelConfiguration=(actor,taskId,operationId)=>operations.save(actor,command(actor,'CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION',{taskId},operationId));
    const assertConfigurationProof=(result,actor,operationId,taskId='task-a')=>{assert.equal(result.scope,actorContexts.get(actor.userId).scope);assert.equal(result.projectId,'project-a');assert.equal(result.operationId,operationId);assert.equal(result.action,'CONFIGURE_PROGRESS_MEASUREMENT');assert.equal(result.state,'RECORDED');assert.equal(result.kind,'MEASUREMENT_CONFIGURATION');assert.equal(result.saved,true);assert.equal(result.task.id,taskId);assertPublicMeasurement(result.task.measurement);};
    const assertCancellationProof=(result,actor,operationId,taskId)=>{assert.deepEqual(Object.keys(result).sort(),['scope','projectId','operationId','action','state','saved','replayed','receiptId','kind','taskId','taskProgressUnchanged'].toSorted());assert.equal(result.scope,actorContexts.get(actor.userId).scope);assert.equal(result.projectId,'project-a');assert.equal(result.operationId,operationId);assert.equal(result.action,'CONFIGURE_PROGRESS_MEASUREMENT');assert.equal(result.state,'CANCELLED');assert.equal(result.kind,'MEASUREMENT_CONFIGURATION_CANCELLED');assert.equal(result.saved,false);assert.equal(result.taskId,taskId);assert.equal(result.taskProgressUnchanged,true);assert.match(result.receiptId,/^field_[a-f0-9]{64}$/);};
    const projectLockRace=async(first,second)=>{
      const blocker=await pool.connect();let firstResult,secondResult;
      const waitForQueue=async count=>{const deadline=Date.now()+1000;while(Date.now()<deadline){const row=(await pool.query(`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF p%'`)).rows[0];if(row.count>=count)return;await new Promise(resolve=>setTimeout(resolve,20));}assert.fail('Canonical project lock queue was not observed');};
      try{
        await blocker.query('BEGIN');await blocker.query(`SELECT id FROM "Project" WHERE id='project-a' FOR UPDATE`);
        firstResult=first();firstResult.catch(()=>{});await waitForQueue(1);
        secondResult=second();secondResult.catch(()=>{});await waitForQueue(2);
        await blocker.query('COMMIT');return await Promise.all([firstResult,secondResult]);
      }finally{try{await blocker.query('ROLLBACK');}finally{blocker.release();await Promise.allSettled([firstResult,secondResult].filter(Boolean));}}
    };
    const propose=async(actor=worker,{taskId='task-a',mode='DELTA',quantity='10',evidenceId='evidence-a',operationId=randomUUID(),revision=null}={})=>operations.save(actor,command(actor,'PROPOSE_PROGRESS',{workerId:actor===owner?'worker-owner':'worker-a',taskId,revision:revision??(await rawTask(taskId)).revision,measurement:{mode,quantity},reason:'Synthetic independently reviewable measured work.',evidenceIds:[evidenceId]},operationId));
    const decide=(actor,proposal,decision='APPROVE',operationId=randomUUID())=>operations.save(actor,command(actor,'DECIDE_PROGRESS',{proposalId:proposal.id,revision:proposal.revision,decision,reason:'Synthetic independent decision after checking the measurement.'},operationId));
    const newTask=async(id,progress=0,metadata={preserve:true})=>pool.query(`INSERT INTO "Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata) VALUES($1,'project-a',$2,$3,$4,'2026-10-01','2026-10-10',$5::jsonb)`,[id,'Synthetic '+id,progress?'IN_PROGRESS':'BACKLOG',progress,JSON.stringify(metadata)]);
    const approvedEvidence=async(id,taskId='task-a',recordedBy='person',workerId='worker-a')=>{
      const details={version:1,kind:'EVIDENCE',taskId,workerId,sectorId:'synthetic-sector',recordedBy,capturedAt:new Date().toISOString(),media:{kind:'image',contentType:'image/png',bytes:1,sha256:'b'.repeat(64)},processing:{status:'NOT_REQUESTED'}};
      await pool.query(`INSERT INTO "Incident"(id,"projectId",title,description,status,metadata) VALUES($1,'project-a',$2,'Synthetic evidence record; no real document or private object.','open',$3::jsonb)`,[id,'Synthetic '+id,JSON.stringify({fieldOperations:details})]);
      const revision=(await pool.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Incident" WHERE id=$1`,[id])).rows[0].revision;
      await operations.save(recordedBy==='owner'?director:owner,command(recordedBy==='owner'?director:owner,'REVIEW_EVIDENCE',{evidenceId:id,revision,decision:'APPROVE',reason:'Synthetic independent review of the controlled evidence record.'}));
    };
    for(const [id,clerkUserId,phone]of [['worker-a',worker.userId,'+5491100001111'],['worker-owner',owner.userId,'+5491100002222']]){
      const metadata={siteRegister:{version:1,job:'WORKER',source:'responsible-entry',identityStatus:'UNVERIFIED',channelVerified:false},participant:{version:1,status:'ACTIVE',clerkUserId,permissions:{attendance:true,report:true},invitation:null,kyc:{version:1,status:'NOT_SUBMITTED'}}};
      await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES($1,'project-a',$2,$3,true,$4::jsonb)`,[id,'Synthetic '+id,phone,JSON.stringify(metadata)]);
    }
    const kyc=createCanonicalParticipantKycFixture({workspace,connect,query:(...args)=>pool.query(...args)});
    await kyc.approve({projectId:'project-a',workerId:'worker-a',actor:worker,reviewer:owner});
    await kyc.approve({projectId:'project-a',workerId:'worker-owner',actor:owner,reviewer:director});
    await approvedEvidence('evidence-a');

    await check('responsible-only-definition-permissions-and-foreign-task-fail-without-writes',async()=>{
      await rejectedWithoutWrites(()=>configure(planner));await rejectedWithoutWrites(()=>configure(worker));
      const foreignScope=(await workspace.list(foreign)).scope;
      await rejectedWithoutWrites(()=>operations.save(foreign,{projectId:'project-a',scope:foreignScope,operationId:randomUUID(),action:'CONFIGURE_PROGRESS_MEASUREMENT',payload:{taskId:'task-a',revision:'2026-10-01T12:00:00.000000',baseline:'100',unit:'M2',sourceReference:'Synthetic foreign source',reason:'Synthetic foreign configuration rejected.'}}));
    });
    await check('definition-concurrent-exact-replay-preserves-progress-dates-metadata-and-one-receipt',async()=>{
      const before=await rawTask(),operationId=randomUUID(),revision=before.revision;
      const results=await Promise.all([configure(owner,{operationId,revision}),configure(owner,{operationId,revision})]);
      assert.equal(results.filter(result=>result.replayed===false).length,1);assert.equal(results[0].receiptId,results[1].receiptId);
      for(const result of results)assertConfigurationProof(result,owner,operationId);
      const after=await rawTask();assert.equal(after.progress,0);assert.equal(after.status,before.status);sameDates(before,after);assert.equal(after.metadata.preserve,true);
      assert.equal(definition(after).version,'task-progress-measurement-v1');assert.equal(definition(after).baseline,'100.0000');assert.equal(definition(after).unit,'M2');assert.equal(definition(after).configuredBy,'owner');assert.ok(definition(after).definitionId);assert.equal((await publicTask()).measurement.definitionId,definition(after).definitionId);
      await rejectedWithoutWrites(()=>configure(owner,{operationId,revision,baseline:'101'}));
    });
    await check('configuration-recovery-and-stale-revision-never-duplicate-the-definition',async()=>{
      const before=await rawTask(),operationId=randomUUID(),result=await configure(owner,{operationId,baseline:'100',sourceReference:'Synthetic revised plan reference'});
      const observed=await operations.status(owner,{...actorContexts.get(owner.userId),operationId});assert.equal(observed.receiptId,result.receiptId);assert.equal(observed.state,'RECORDED');assert.equal((await rawTask()).progress,0);
      assertConfigurationProof(observed,owner,operationId);assertPublicMeasurement(observed.configuredTaskSnapshot.measurement);assert.equal(observed.configuredTaskSnapshot.measurement.definitionId,result.task.measurement.definitionId);
      await rejectedWithoutWrites(()=>configure(owner,{revision:before.revision,baseline:'110'}));
    });
    let first;
    await check('delta-derives-zero-start-baseline-unit-and-percentage-without-changing-task',async()=>{
      const before=await rawTask();first=await propose();assert.equal(first.taskUnchanged,true);assert.equal(first.proposal.progress,10);assert.deepEqual(await rawTask(),before);
      await rejectedWithoutWrites(()=>configure(owner,{baseline:'120'}),'FIELD_PROGRESS_REVIEW_PENDING');
    });
    await check('pending-review-and-mixed-client-base-or-percentage-cannot-create-a-second-proposal',async()=>{
      await rejectedWithoutWrites(()=>propose(worker,{quantity:'5'}),'FIELD_PROGRESS_REVIEW_PENDING');
      const p={workerId:'worker-a',taskId:'task-a',revision:(await rawTask()).revision,measurement:{mode:'DELTA',quantity:'5'},baseline:'200',unit:'M3',progress:99,reason:'Synthetic injected calculation inputs.',evidenceIds:['evidence-a']};
      await rejectedWithoutWrites(()=>operations.save(worker,command(worker,'PROPOSE_PROGRESS',p)));
    });
    await check('independent-concurrent-approval-applies-exact-delta-once-and-preserves-definition-and-gantt',async()=>{
      const before=await rawTask(),operationId=randomUUID();
      const results=await Promise.all([decide(director,first.proposal,'APPROVE',operationId),decide(director,first.proposal,'APPROVE',operationId)]);
      assert.equal(results.filter(result=>result.replayed===false).length,1);assert.equal(results[0].receiptId,results[1].receiptId);
      const after=await rawTask();assert.equal(after.progress,10);assert.equal(quantities(after).executed,'10.0000');assert.equal(quantities(after).baseline,'100.0000');assert.equal(quantities(after).unit,'M2');assert.deepEqual(definition(after),definition(before));sameDates(before,after);assert.equal(after.metadata.preserve,true);
      const observed=await operations.status(director,{...actorContexts.get(director.userId),operationId});assert.equal(observed.receiptId,results[0].receiptId);assert.equal((await rawTask()).progress,10);
    });
    await check('approved-execution-locks-baseline-and-unit-and-refuses-regression-or-overflow',async()=>{
      await rejectedWithoutWrites(()=>configure(owner,{baseline:'200'}));await rejectedWithoutWrites(()=>configure(owner,{unit:'M3'}));
      await rejectedWithoutWrites(()=>propose(worker,{mode:'CUMULATIVE',quantity:'9.9999'}));await rejectedWithoutWrites(()=>propose(worker,{quantity:'90.0001'}));
      for(const quantity of ['1e3','2,5',' 2','-1','NaN'])await rejectedWithoutWrites(()=>propose(worker,{quantity}));
    });
    await check('rejected-proposal-never-adds-its-delta-and-fresh-cumulative-applies-total-not-addition',async()=>{
      const before=await rawTask(),pending=await propose(worker,{quantity:'5'});await decide(director,pending.proposal,'REJECT');assert.deepEqual(await rawTask(),before);
      const cumulative=await propose(worker,{mode:'CUMULATIVE',quantity:'12.5'});assert.equal(cumulative.proposal.progress,12);await decide(director,cumulative.proposal);
      assert.equal(quantities(await rawTask()).executed,'12.5000');assert.equal((await rawTask()).progress,12);
    });
    await check('maker-checker-applies-even-to-an-administrator-reporting-own-work',async()=>{
      const own=await propose(owner,{quantity:'2.5'});await rejectedWithoutWrites(()=>decide(owner,own.proposal),'FIELD_MAKER_CHECKER_REQUIRED');await decide(director,own.proposal);
      assert.equal(quantities(await rawTask()).executed,'15.0000');
    });
    await check('schedule-is-dates-only-and-invalidates-a-pending-measurement-cas-without-changing-execution',async()=>{
      const pending=await propose(worker,{quantity:'5'}),before=await rawTask();
      await workspace.schedule(planner,{...actorContexts.get(planner.userId),operationId:randomUUID(),taskId:'task-a',expectedRevision:before.revision,startsOn:'2026-10-02',endsOn:'2026-10-11',reason:'Synthetic assigned planner changes dates only.'});
      const after=await rawTask();assert.equal(after.progress,before.progress);assert.deepEqual(quantities(after),quantities(before));assert.deepEqual(definition(after),definition(before));
      await rejectedWithoutWrites(()=>decide(director,pending.proposal),'FIELD_REVISION_CHANGED');await decide(director,pending.proposal,'REJECT');
    });
    await check('legacy-percentage-only-task-never-invents-a-zero-opening-measurement',async()=>{
      await newTask('task-percent-only',25);await rejectedWithoutWrites(()=>configure(owner,{taskId:'task-percent-only',baseline:'100'}));
    });
    await check('legacy-quantity-proposal-and-review-work-before-compatible-definition-adoption',async()=>{
      await newTask('task-legacy');await approvedEvidence('evidence-legacy','task-legacy');
      const current=await rawTask('task-legacy'),payload={workerId:'worker-a',taskId:current.id,revision:current.revision,progress:25,quantity:'2.5',baseline:'10',unit:'M2',reason:'Synthetic historical cumulative measurement.',evidenceIds:['evidence-legacy']};
      const legacy=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',payload));await decide(director,legacy.proposal);assert.equal(quantities(await rawTask('task-legacy')).executed,'2.5000');
      await configure(owner,{taskId:'task-legacy',baseline:'10',unit:'M2'});assert.equal(quantities(await rawTask('task-legacy')).executed,'2.5000');
      await rejectedWithoutWrites(async()=>operations.save(worker,command(worker,'PROPOSE_PROGRESS',{...payload,revision:(await rawTask('task-legacy')).revision})),'FIELD_MEASUREMENT_REQUIRED');
      const next=await propose(worker,{taskId:'task-legacy',quantity:'0.0001',evidenceId:'evidence-legacy'});await decide(director,next.proposal);assert.equal(quantities(await rawTask('task-legacy')).executed,'2.5001');
    });
    await check('legacy-pending-requires-explicit-rejection-before-definition-and-fresh-modes',async()=>{
      await newTask('task-legacy-pending');await approvedEvidence('evidence-legacy-pending','task-legacy-pending');
      const current=await rawTask('task-legacy-pending'),payload={workerId:'worker-a',taskId:current.id,revision:current.revision,progress:20,quantity:'2',baseline:'10',unit:'M2',reason:'Synthetic still-pending historical cumulative measurement.',evidenceIds:['evidence-legacy-pending']};
      const legacy=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',payload));await rejectedWithoutWrites(()=>configure(owner,{taskId:current.id,baseline:'10'}),'FIELD_PROGRESS_REVIEW_PENDING');
      await decide(director,legacy.proposal,'REJECT');await configure(owner,{taskId:current.id,baseline:'10'});assert.equal((await rawTask(current.id)).progress,0);
    });
    await check('native-concurrent-definitions-on-one-task-version-have-one-winner',async()=>{
      await newTask('task-config-race');const current=await rawTask('task-config-race');
      const results=await Promise.allSettled([configure(owner,{taskId:current.id,revision:current.revision,baseline:'100'}),configure(director,{taskId:current.id,revision:current.revision,baseline:'200'})]);
      assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.filter(result=>result.status==='rejected').length,1);assert.equal((await rawTask(current.id)).progress,0);
      assert.ok(['100.0000','200.0000'].includes(definition(await rawTask(current.id)).baseline));
    });
    await check('receipt-failure-rolls-back-definition-task-revision-and-audit-atomically',async()=>{
      await newTask('task-rollback');const before=await state();
      await pool.query(`CREATE FUNCTION reject_measurement_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='field.operation.recorded' AND NEW.metadata->>'command'='CONFIGURE_PROGRESS_MEASUREMENT' THEN RAISE EXCEPTION 'SYNTHETIC_MEASUREMENT_RECEIPT_FAILURE'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_measurement_receipt BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_measurement_receipt();`);
      try{await assert.rejects(configure(owner,{taskId:'task-rollback'}));assert.deepEqual(await state(),before);}
      finally{await pool.query('DROP TRIGGER reject_measurement_receipt ON "AuditLog";DROP FUNCTION reject_measurement_receipt();');}
    });
    await check('approval-receipt-failure-rolls-back-execution-proposal-and-decision-before-exact-retry',async()=>{
      const pending=await propose(worker,{quantity:'1'}),before=await state(),operationId=randomUUID(),previous=quantities(await rawTask()).executed;
      await pool.query(`CREATE FUNCTION reject_measurement_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='field.operation.recorded' AND NEW.metadata->>'command'='DECIDE_PROGRESS' THEN RAISE EXCEPTION 'SYNTHETIC_MEASUREMENT_DECISION_FAILURE'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_measurement_decision BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_measurement_decision();`);
      try{await assert.rejects(decide(director,pending.proposal,'APPROVE',operationId));assert.deepEqual(await state(),before);}
      finally{await pool.query('DROP TRIGGER reject_measurement_decision ON "AuditLog";DROP FUNCTION reject_measurement_decision();');}
      const result=await decide(director,pending.proposal,'APPROVE',operationId);assert.equal(quantities(await rawTask()).executed,'16.0000');assert.equal(previous,'15.0000');
      const observed=await operations.status(director,{...actorContexts.get(director.userId),operationId});assert.equal(observed.receiptId,result.receiptId);
    });
    await check('expired-legacy-pending-is-audited-before-a-new-definition-without-progress-change',async()=>{
      await newTask('task-expired-pending');await approvedEvidence('evidence-expired-pending','task-expired-pending');
      const current=await rawTask('task-expired-pending'),payload={workerId:'worker-a',taskId:current.id,revision:current.revision,progress:20,quantity:'2',baseline:'10',unit:'M2',reason:'Synthetic historical proposal waiting past its deadline.',evidenceIds:['evidence-expired-pending']};
      const pending=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',payload));await pool.query(`UPDATE "OperationalProposal" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,[pending.proposal.id]);
      await configure(owner,{taskId:current.id,baseline:'10'});assert.equal((await rawTask(current.id)).progress,0);
      assert.equal((await pool.query('SELECT status::text AS status FROM "OperationalProposal" WHERE id=$1',[pending.proposal.id])).rows[0].status,'EXPIRED');
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='field.progress.expired' AND "entityId"=$1`,[pending.proposal.id])).rows[0].count,1);
    });
    await check('decimal-capacity-regression-inside-one-integer-percent-is-rejected-exactly',async()=>{
      await newTask('task-large');await approvedEvidence('evidence-large','task-large');await configure(owner,{taskId:'task-large',baseline:'99999999999999.9999'});
      const large=await propose(worker,{taskId:'task-large',mode:'CUMULATIVE',quantity:'99999999999999.9998',evidenceId:'evidence-large'});await decide(director,large.proposal);
      assert.equal((await rawTask('task-large')).progress,99);assert.equal(quantities(await rawTask('task-large')).executed,'99999999999999.9998');
      await rejectedWithoutWrites(()=>propose(worker,{taskId:'task-large',mode:'CUMULATIVE',quantity:'99999999999999.9997',evidenceId:'evidence-large'}));
    });
    await check('native-project-lock-cancel-wins-delayed-configuration-and-read-replay-remain-closed',async()=>{
      const taskId='task-cancel-race',operationId=randomUUID();await newTask(taskId);const before=await rawTask(taskId);
      const results=await projectLockRace(()=>cancelConfiguration(owner,taskId,operationId),()=>configure(owner,{taskId,operationId,revision:before.revision}));
      for(const result of results)assertCancellationProof(result,owner,operationId,taskId);assert.deepEqual(results.map(result=>result.replayed),[false,true]);assert.equal(results[0].receiptId,results[1].receiptId);assert.deepEqual(await rawTask(taskId),before);
      const read=await operations.status(owner,{...actorContexts.get(owner.userId),operationId});assertCancellationProof(read,owner,operationId,taskId);
      const replay=await cancelConfiguration(owner,taskId,operationId);assertCancellationProof(replay,owner,operationId,taskId);
      assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE id=$1`,[read.receiptId])).rows[0].count,1);
      const receipt=(await pool.query(`SELECT metadata FROM "AuditLog" WHERE id=$1`,[read.receiptId])).rows[0].metadata;assert.equal(receipt.requestDigest,null);assert.equal(receipt.command,'CONFIGURE_PROGRESS_MEASUREMENT');
      await rejectedWithoutWrites(()=>cancelConfiguration(owner,'task-a',operationId),'FIELD_OPERATION_CONFLICT');
      await rejectedWithoutWrites(()=>operations.save(owner,command(owner,'CONFIGURE_SITE',{revision:before.revision,sectors:[{id:'synthetic-sector',name:'Synthetic site',latitude:0,longitude:0,radius:50}]},operationId)),'FIELD_OPERATION_CONFLICT');
    });
    await check('native-project-lock-configuration-wins-cancel-recovers-the-original-receipt',async()=>{
      const taskId='task-config-wins',operationId=randomUUID();await newTask(taskId);const before=await rawTask(taskId);
      const results=await projectLockRace(()=>configure(owner,{taskId,operationId,revision:before.revision}),()=>cancelConfiguration(owner,taskId,operationId));
      for(const result of results)assertConfigurationProof(result,owner,operationId,taskId);assert.equal(results[0].receiptId,results[1].receiptId);assert.equal(results[1].replayed,true);assertPublicMeasurement(results[1].configuredTaskSnapshot.measurement);
      const after=await rawTask(taskId);sameDates(before,after);assert.equal(after.progress,before.progress);assert.equal((await pool.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE id=$1`,[results[0].receiptId])).rows[0].count,1);
      assert.equal((await operations.status(owner,{...actorContexts.get(owner.userId),operationId})).state,'RECORDED');
    });
    await check('current-role-revocation-denies-cancellation-replay-and-status-without-writes',async()=>{
      const taskId='task-role-revoked',operationId=randomUUID();await newTask(taskId);await cancelConfiguration(director,taskId,operationId);
      try{
        await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='SITE_MANAGER',"updatedAt"=clock_timestamp() WHERE id='director-m'`);actorContexts.set(director.userId,await context(director));
        await rejectedWithoutWrites(()=>cancelConfiguration(director,taskId,randomUUID()),'FIELD_PROGRESS_PERMISSION_REQUIRED');
        await rejectedWithoutWrites(()=>cancelConfiguration(director,taskId,operationId),'FIELD_PERMISSION_REQUIRED');
        await rejectedWithoutWrites(()=>operations.status(director,{...actorContexts.get(director.userId),operationId}),'FIELD_PERMISSION_REQUIRED');
        await rejectedWithoutWrites(()=>configure(director,{taskId,operationId}),'FIELD_PERMISSION_REQUIRED');
      }finally{await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR',"updatedAt"=clock_timestamp() WHERE id='director-m'`);actorContexts.set(director.userId,await context(director));}
    });
    await check('cancellation-receipt-failure-leaves-no-tombstone-and-exact-retry-closes-once',async()=>{
      const taskId='task-cancel-rollback',operationId=randomUUID();await newTask(taskId);const before=await state();
      await pool.query(`CREATE FUNCTION reject_measurement_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='field.operation.recorded' AND NEW.metadata->'outcome'->>'kind'='MEASUREMENT_CONFIGURATION_CANCELLED' THEN RAISE EXCEPTION 'SYNTHETIC_CANCELLATION_RECEIPT_FAILURE'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_measurement_cancellation BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_measurement_cancellation();`);
      try{await assert.rejects(cancelConfiguration(owner,taskId,operationId));assert.deepEqual(await state(),before);assert.equal((await operations.status(owner,{...actorContexts.get(owner.userId),operationId})).state,'NOT_OBSERVED');}
      finally{await pool.query('DROP TRIGGER reject_measurement_cancellation ON "AuditLog";DROP FUNCTION reject_measurement_cancellation();');}
      const result=await cancelConfiguration(owner,taskId,operationId);assertCancellationProof(result,owner,operationId,taskId);assert.equal((await cancelConfiguration(owner,taskId,operationId)).receiptId,result.receiptId);assert.equal((await rawTask(taskId)).progress,0);assert.equal(definition(await rawTask(taskId)),undefined);
    });
    assert.equal(uncontrolledHttp,0);
  }finally{
    try{
      if(pool){await closeDisposablePool(pool);poolClosed=true;}
      if(created){
        assert.equal(connected,true);ownedDatabase(database);assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,'obrasaas_cutover_ci');
        assert.equal((await admin.query('SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].count,0,'Owned fixture sockets must be closed before its database is dropped');
        await admin.query(`DROP DATABASE "${database}"`);removed=(await admin.query('SELECT count(*)::int AS count FROM pg_database WHERE datname=$1',[database])).rows[0].count===0;
        assert.equal(removed,true);
      }
    }finally{try{if(connected)await admin.end();}finally{globalThis.fetch=originalFetch;}}
  }
  assert.equal(created,true);assert.equal(removed,true);assert.equal(poolClosed,true);assert.equal(uncontrolledHttp,0);
  return {status:'PASS',environment:'local-disposable-postgresql',postgresExecuted:true,providerCalls:0,realIdentityDocuments:false,productionDataWritten:false,databaseRemoved:removed,poolClosed,totalCheckCount:checks.length,checks};
}

async function main(){
  const root=process.cwd(),harnessPath=fileURLToPath(import.meta.url),sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),trackedClean=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()==='';
  if(process.env.CI==='true')assert.equal(trackedClean,true,'CI evidence must use committed clean source');
  const sourceManifest=taskProgressMeasurementSourceFiles(root).map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))}));
  const proof=await verifyTaskProgressMeasurementPostgres();
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceRevision,'The tested source commit must remain unchanged');
  for(const reference of sourceManifest)assert.equal(sha(readFileSync(path.join(root,reference.path))),reference.sha256,'Native fixture sources must remain unchanged: '+reference.path);
  if(process.env.CI==='true')assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'','CI tested source must remain clean');
  const result={...proof,sourceRevision,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',trackedClean,sourceManifest,harnessSha256:sha(readFileSync(harnessPath))};
  const output=path.join(root,'.vercel/private/task-progress-measurement-postgres.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({status:'FAIL',code:/^[A-Z0-9_]{2,100}$/.test(error.code||'')?error.code:'TASK_PROGRESS_FIXTURE_UNCONFIRMED'}));process.exitCode=1;});
