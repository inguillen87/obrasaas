import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,Pool} from 'pg';
import {lifecycleDisposableUrl,lifecycleSchema} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {createCanonicalParticipantKycFixture,canonicalParticipantKycSourceFiles} from './fixtures/canonical-participant-kyc.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers} from '../src/lib/participant-http.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {participantAccountBound} from '../src/lib/participant-admission.mjs';

// This lane uses one private disposable schema, generated people and closed
// Clerk adapters. It cannot read production identity or call a network provider.
const url=lifecycleDisposableUrl(process.env);
assert.ok(!process.env.VERCEL_TARGET_ENV&&!process.env.TARGET,'OFFICE_ASSIGNMENT_PRODUCTION_TARGET_REJECTED');
assert.ok(['5432','6549'].includes(url.port),'OFFICE_ASSIGNMENT_DISPOSABLE_PORT_REQUIRED');
assert.equal(url.username,'cutover_test','OFFICE_ASSIGNMENT_DISPOSABLE_ROLE_REQUIRED');
assert.ok(url.port==='6549'?url.password==='':['','cutover_test'].includes(url.password),'OFFICE_ASSIGNMENT_DISPOSABLE_PASSWORD_REQUIRED');
const schema='obrasaas_verified_office_'+randomUUID().replaceAll('-','');
assert.match(schema,/^obrasaas_verified_office_[a-f0-9]{32}$/);
const quoted='"'+schema+'"',rewrite=sql=>sql.replace(/\bpublic\./g,quoted+'.').replace(/table_schema='public'/g,"table_schema='"+schema+"'");
const root=process.cwd(),sha=value=>createHash('sha256').update(value).digest('hex');
const sourceFiles=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.isDirectory()?sourceFiles(relative+'/'+entry.name):[relative+'/'+entry.name]);
const sourcePaths=[...new Set([...sourceFiles('src/lib'),'scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/disposable-postgres-cleanup.mjs',...canonicalParticipantKycSourceFiles()])];
const sourceManifest=sourcePaths.map(file=>({path:file,sha256:sha(readFileSync(file))})),harnessSha256=sha(readFileSync(new URL(import.meta.url)));
function sourceState(){
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const trackedClean=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim()==='';
 if(process.env.CI==='true'){assert.equal(sourceRevision,process.env.GITHUB_SHA,'OFFICE_ASSIGNMENT_CI_SOURCE_REVISION_REQUIRED');assert.equal(trackedClean,true,'OFFICE_ASSIGNMENT_CI_TRACKED_SOURCE_CLEAN_REQUIRED');execFileSync('git',['ls-files','--error-unmatch','--',...sourcePaths,path.relative(root,fileURLToPath(import.meta.url))],{cwd:root,stdio:'pipe'});}
 return {sourceRevision,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'WORK_IN_PROGRESS',trackedClean};
}
const initialSourceState=sourceState();
function assertStableSource(){for(const file of sourceManifest)assert.equal(sha(readFileSync(file.path)),file.sha256,'OFFICE_ASSIGNMENT_SOURCE_CHANGED_DURING_RUN: '+file.path);assert.equal(sha(readFileSync(new URL(import.meta.url))),harnessSha256);assert.deepEqual(sourceState(),initialSourceState);}
const admin=new Client({connectionString:url.href,connectionTimeoutMillis:5000}),checks=[],sqlFailures=[];
let pool,created=false,removed=false,network=0,loseAck=false,failAudit=false,kycFixture,issuerBarrier=null;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{network++;throw Error('UNCONTROLLED_NETWORK');};
const query=(sql,args)=>pool.query(rewrite(sql),args);
const connect=async()=>{const db=await pool.connect();await db.query('SET search_path TO '+quoted);let assignmentWritten=false;return {release:bad=>db.release(bad),async query(sql,args){try{
 if(sql.startsWith('INSERT INTO public."AuditLog"')&&args.some(value=>typeof value==='string'&&value.includes('VERIFIED_OFFICE_ASSIGNED'))){if(failAudit){failAudit=false;throw Error('SYNTHETIC_OFFICE_AUDIT_ROLLBACK');}assignmentWritten=true;}
 const result=await db.query(rewrite(sql),args);
 if(issuerBarrier&&sql.includes('FOR SHARE OF u,m,o'))await issuerBarrier(args[0]);
 if(sql==='COMMIT'&&assignmentWritten&&loseAck){loseAck=false;throw Error('SYNTHETIC_OFFICE_COMMITTED_ACK_LOSS');}return result;
 }catch(error){if(error.code)sqlFailures.push(error.code);throw error;}}};};
const signed=(user,org='org_A',role='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId:user,organizationId:org,organizationRole:role});
const owner=signed('user_Owner','org_A','org:admin'),person=signed('user_Person'),foreign=signed('user_Foreign','org_B','org:admin');
const candidates=new Map(),providerCalls=[];let providerHook=null;
function candidate(key,patch={}){
 const email=key.toLowerCase()+'@example.invalid',account={clerkUserId:'user_'+key,name:'Cuenta sintética '+key,email,primaryEmail:email,clerkRole:'org:member',providerMembershipId:'orgmem_'+key,providerMembershipUpdatedAt:1791580000000,userUpdatedAt:1791580000000,emailAddressId:'idn_'+key,primaryEmailAddressId:'idn_'+key,...patch};
 candidates.set(email,{state:'READY',code:null,account});return account;
}
const identity={async findVerifiedOfficeAccount(input){providerCalls.push(structuredClone(input));if(providerHook){const hook=providerHook;providerHook=null;await hook();}return structuredClone(candidates.get(input.email)||{state:'NOT_READY',code:'PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',account:null});}};
try{
 await admin.connect();assert.deepEqual((await admin.query('SELECT current_database() AS database,session_user AS actor')).rows[0],{database:'obrasaas_cutover_ci',actor:'cutover_test'});
 await admin.query('CREATE SCHEMA '+quoted);created=true;await admin.query('SET search_path TO '+quoted);
 await admin.query(lifecycleSchema.replace("CREATE TYPE \"SystemRole\" AS ENUM('TENANT_USER');","CREATE TYPE \"SystemRole\" AS ENUM('TENANT_USER','SUPERADMIN');"));
 pool=trackDisposablePool(new Pool({connectionString:url.href,max:6}));
 await query(`INSERT INTO public."Organization"(id,name,"clerkOrganizationId",metadata) VALUES('org-a','Empresa sintética A','org_A','{}'),('org-b','Empresa sintética B','org_B','{}');
 INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('owner','user_Owner','owner@example.invalid'),('person','user_Person','person@example.invalid'),('foreign','user_Foreign','foreign@example.invalid');
 INSERT INTO public."TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('owner-m','owner','org-a','ADMIN','org:admin','ACTIVE'),('person-m','person','org-a','AUDITOR','org:member','ACTIVE'),('foreign-m','foreign','org-b','ADMIN','org:admin','ACTIVE');
 INSERT INTO public."Project"(id,"organizationId",name,status,metadata) VALUES('project-a','org-a','Obra A','ACTIVE','{}'),('project-a2','org-a','Obra A2','ACTIVE','{}'),('project-b','org-b','Obra B','ACTIVE','{}');
 INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('person-pm','project-a','person-m','ACTIVE');
 INSERT INTO public."Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata) VALUES('task-a','project-a','Tarea sintética','BACKLOG',0,'2026-10-01','2026-10-20','{}');`);
 const workspace=createWorkspaceStore({connect}),store=createParticipantStore({workspace,connect,identity}),field=createFieldOperations({workspace});
 const context=async session=>({projectId:'project-a',scope:(await workspace.list(session)).scope}),ownerContext=await context(owner);
 const lookup=async account=>store.verifiedOfficeAccount(owner,{...ownerContext,email:account.email});
 const command=async(account,role='DIRECTOR',operationId=randomUUID())=>{const value=await lookup(account);assert.equal(value.verifiedOfficeAccount.state,'READY');assert.equal(value.verifiedOfficeAccount.account.clerkUserId,account.clerkUserId);assert.match(value.verifiedOfficeAccount.account.proofDigest,/^[a-f0-9]{64}$/);return {...ownerContext,operationId,action:'ASSIGN_VERIFIED_OFFICE',payload:{email:account.email,clerkUserId:account.clerkUserId,expectedProofDigest:value.verifiedOfficeAccount.account.proofDigest,role,reason:'Asignación explícita de permisos de oficina para una cuenta verificada.',confirmOfficePermissions:true}};};
 const status=body=>store.officeAssignmentStatus(owner,{...ownerContext,operationId:body.operationId,action:body.action});
 const snapshot=async()=>Object.fromEntries(await Promise.all(['PlatformUser','TenantMembership','ProjectMembership','Worker','AuditLog'].map(async table=>[table,(await query('SELECT row_to_json(t) AS row FROM public."'+table+'" t ORDER BY id')).rows.map(row=>row.row)])));
 const assignmentCount=async()=>Number((await query(`SELECT count(*) AS n FROM public."AuditLog" WHERE metadata->>'kind'='VERIFIED_OFFICE_ASSIGNED'`)).rows[0].n);
 const beforeLookup=await snapshot(),directorAccount=candidate('OfficeDirector'),directorBody=await command(directorAccount);assert.deepEqual(await snapshot(),beforeLookup);
 const assigned=await store.save(owner,directorBody),director=signed(directorAccount.clerkUserId),directorContext=await context(director);
 assert.equal(assigned.saved,true);assert.equal(assigned.replayed,false);assert.equal(assigned.account.role,'DIRECTOR');assert.equal(assigned.officeAssignmentReceipt.action,'ASSIGN_VERIFIED_OFFICE');assert.equal(assigned.officeAssignmentReceipt.role,'DIRECTOR');assert.equal(assigned.officeAssignmentReceipt.assignedProjectId,null);
 for(const flag of ['identityCertified','fieldPermissionsGranted'])assert.equal(assigned.officeAssignmentReceipt[flag],false);
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."Worker"`)).rows[0].n,0);assert.equal((await query(`SELECT count(*)::int AS n FROM public."AuditLog" WHERE action='office.review.accepted'`)).rows[0].n,0);
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."ProjectMembership" WHERE "tenantMembershipId"=$1`,[assigned.account.membershipId])).rows[0].n,0);
 const discovered=await store.accounts(owner,ownerContext);assert.ok(discovered.existingAccounts.some(account=>account.membershipId===assigned.account.membershipId));
 checks.push('verified-Clerk-office-assignment-creates-canonical-DIRECTOR-without-Worker-KYC-channel-or-limited-auditor-grant');

 const beforeReplay=await snapshot(),callsBeforeReplay=providerCalls.length,replayed=await store.save(owner,directorBody),recovered=await status(directorBody);
 for(const result of [replayed,recovered]){assert.equal(result.receiptId,assigned.receiptId);assert.equal(result.account.membershipId,assigned.account.membershipId);assert.deepEqual(result.officeAssignmentReceipt,assigned.officeAssignmentReceipt);}
 assert.equal(replayed.replayed,true);assert.equal(recovered.state,'RECORDED');assert.equal(providerCalls.length,callsBeforeReplay);assert.deepEqual(await snapshot(),beforeReplay);
 await assert.rejects(store.save(owner,{...directorBody,payload:{...directorBody.payload,role:'AUDITOR'}}),{code:'PARTICIPANT_OPERATION_CONFLICT'});assert.deepEqual(await snapshot(),beforeReplay);
 const absent=await store.officeAssignmentStatus(owner,{...ownerContext,operationId:randomUUID(),action:'ASSIGN_VERIFIED_OFFICE'});assert.equal(absent.state,'NOT_OBSERVED');assert.equal(absent.definitive,false);
 checks.push('office-assignment-exact-replay-and-status-recover-original-receipt-without-provider-or-write-and-changed-body-conflicts');

 const directorList=await workspace.list(director);assert.equal(directorList.officeReviewOnly,undefined);assert.deepEqual(directorList.projects.map(project=>project.id),['project-a','project-a2']);
 assert.equal((await workspace.read(director,directorContext)).canPlanSchedule,true);assert.equal((await workspace.overview(director,{scope:directorContext.scope})).projects.length,2);
 let integrated=false;await workspace.integrationProject(director,directorContext,true,(_client,member)=>{assert.equal(member.role,'DIRECTOR');integrated=true;});assert.equal(integrated,true);
 let companyRead=false;await assert.rejects(workspace.companyRead(director,directorContext,()=>{companyRead=true;}),{code:'WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED'});assert.equal(companyRead,false);
 checks.push('unbound-office-DIRECTOR-uses-canonical-project-portfolio-and-integration-guards-but-cannot-administer-commercial-account');

 const workerMetadata={participant:{version:1,status:'ACTIVE',clerkUserId:person.userId,permissions:{attendance:false,report:false},kyc:{version:1,status:'NOT_SUBMITTED'}}};
 await query(`INSERT INTO public."Worker"(id,"projectId",name,phone,active,metadata) VALUES('worker-person','project-a','Persona de campo sintética','+5491100001111',true,$1::jsonb)`,[JSON.stringify(workerMetadata)]);
 kycFixture=createCanonicalParticipantKycFixture({workspace,connect,query});await kycFixture.approve({projectId:'project-a',workerId:'worker-person',actor:person,reviewer:director});
 assert.equal((await store.read(director,directorContext)).canManage,true);
 const task=(await query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM public."Task" WHERE id='task-a'`)).rows[0];
 await query(`INSERT INTO public."Incident"(id,"projectId",title,metadata) VALUES('evidence-person','project-a','Evidencia sintética aprobada',$1::jsonb)`,[JSON.stringify({fieldOperations:{version:1,kind:'EVIDENCE',workerId:'worker-person',taskId:'task-a',review:{decision:'APPROVE',actorId:'owner'}}})]);
 await query(`INSERT INTO public."OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider",type,status,summary,action,precondition,"expiresAt","updatedAt") VALUES('proposal-person','project-a','worker-person','account-field','TASK_PROGRESS','PENDING','Avance sintético',$1::jsonb,$2::jsonb,clock_timestamp()+interval '1 day',clock_timestamp())`,[JSON.stringify({fieldOperationsVersion:1,taskId:'task-a',workerId:'worker-person',progress:25,quantity:null,baseline:null,unit:null,evidenceIds:['evidence-person'],submittedBy:'person'}),JSON.stringify({taskRevision:task.revision,progress:0})]);
 const progress=await field.reviewPage(director,{...directorContext,reviewSection:'PROGRESS',reviewFilter:'PENDING'});assert.equal(progress.canReview,true);assert.equal(progress.canApproveProgress,true);assert.equal(progress.records.length,1);
 const decision=await field.save(director,{...directorContext,operationId:randomUUID(),action:'DECIDE_PROGRESS',payload:{proposalId:progress.records[0].id,revision:progress.records[0].revision,decision:'APPROVE',reason:'Revisión independiente de evidencia y avance sintéticos.'}});
 assert.equal(decision.task.progress,25);assert.equal((await query(`SELECT progress FROM public."Task" WHERE id='task-a'`)).rows[0].progress,25);
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."Worker" WHERE metadata->'participant'->>'clerkUserId'=$1`,[director.userId])).rows[0].n,0);
 checks.push('new-office-DIRECTOR-independently-reviews-real-canonical-KYC-and-approves-field-progress-without-own-Worker');

 for(const role of ['SITE_MANAGER','FINANCE','AUDITOR']){
  const account=candidate('Office'+role.replaceAll('_','')),body=await command(account,role),saved=await store.save(owner,body),session=signed(account.clerkUserId),ctx=await context(session);
  assert.equal(saved.officeAssignmentReceipt.assignedProjectId,'project-a');assert.deepEqual((await workspace.list(session)).projects.map(project=>project.id),['project-a']);
  await workspace.read(session,ctx);await assert.rejects(workspace.read(session,{...ctx,projectId:'project-a2'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
  assert.equal((await store.read(session,ctx)).canManage,false);await assert.rejects(workspace.integrationProject(session,ctx,false,()=>assert.fail('Unexpected integration access')),{code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'});
 }
 checks.push('new-SITE_MANAGER-FINANCE-and-AUDITOR-remain-assigned-project-only-without-participant-management-or-integration-permission');

 for(const result of [{state:'NOT_READY',code:'PARTICIPANT_PROVIDER_MEMBERSHIP_REQUIRED',account:null},{state:'BLOCKED',code:'PARTICIPANT_VERIFIED_EMAIL_REQUIRED',account:null}]){
  const account=candidate('Unready'+result.state.replaceAll('_','')),body=await command(account),before=await snapshot();candidates.set(account.email,result);
  await assert.rejects(store.save(owner,body),{code:result.code});assert.deepEqual(await snapshot(),before);
 }
 const changed=candidate('ProofChanged'),changedBody=await command(changed),beforeChanged=await snapshot();candidates.get(changed.email).account.userUpdatedAt++;
 await assert.rejects(store.save(owner,changedBody),{code:'PARTICIPANT_OFFICE_PROOF_CHANGED'});assert.deepEqual(await snapshot(),beforeChanged);
 checks.push('missing-Clerk-membership-unverified-email-and-stale-independent-proof-cannot-write-canonical-office-membership');

 for(const kind of ['field-current','field-origin','limited-auditor','disabled','protected-admin','superadmin']){
  const account=candidate('Blocked'+kind.replaceAll('-','')),body=await command(account),actor='actor-'+kind,member='member-'+kind;
  await query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail","systemRole") VALUES($1,$2,$3,$4::"SystemRole")`,[actor,account.clerkUserId,account.email,kind==='superadmin'?'SUPERADMIN':'TENANT_USER']);
  if(['disabled','protected-admin'].includes(kind))await query(`INSERT INTO public."TenantMembership"(id,"organizationId","userId","tenantRole","clerkRole",status) VALUES($1,'org-a',$2,$3::"TenantRole",$4,$5::"MembershipStatus")`,[member,actor,kind==='protected-admin'?'ADMIN':'AUDITOR',kind==='protected-admin'?'org:admin':'org:member',kind==='disabled'?'DISABLED':'ACTIVE']);
  if(kind==='field-current')await query(`INSERT INTO public."Worker"(id,"projectId",name,phone,active,metadata) VALUES('worker-blocked','project-a','Campo bloqueado','+5491100002222',false,$1::jsonb)`,[JSON.stringify({participant:{version:1,status:'REVOKED',clerkUserId:account.clerkUserId}})]);
  if(kind==='field-origin'||kind==='limited-auditor')await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,'org-a',$2,$3,'Worker','deleted-worker',$4::jsonb)`,['origin-'+kind,actor,kind==='limited-auditor'?'office.review.accepted':'participant.operation.recorded',JSON.stringify({version:1,kind:kind==='limited-auditor'?'OFFICE_AUDITOR_INVITATION_ACCEPTED':'INVITATION_ACCEPTED',membershipId:member,projectId:'project-a'})]);
  const value=await lookup(account),before=await snapshot(),code=kind==='superadmin'?'PARTICIPANT_OFFICE_TARGET_PROTECTED':['disabled','protected-admin'].includes(kind)?'PARTICIPANT_OFFICE_ACCOUNT_EXISTS':kind==='limited-auditor'?'PARTICIPANT_OFFICE_ACCOUNT_RESTRICTED':'PARTICIPANT_OFFICE_ACCOUNT_FIELD_BOUND';
  assert.equal(value.verifiedOfficeAccount.state,'BLOCKED');assert.equal(value.verifiedOfficeAccount.code,code);await assert.rejects(store.save(owner,body),{code});assert.deepEqual(await snapshot(),before);
 }
 const self=candidate('Owner'),selfLookup=await lookup(self);assert.equal(selfLookup.verifiedOfficeAccount.code,'PARTICIPANT_OFFICE_TARGET_PROTECTED');
 const orphanAccount=candidate('OrphanOrigin'),orphanBody=await command(orphanAccount);
 // Isolated historical fixture: the old assignment has lost its canonical
 // membership, so its target cannot safely be inferred from an email or name.
 await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('orphan-field-origin','org-a','owner','participant.operation.recorded','Worker','deleted-assigned-worker','{"version":1,"kind":"EXISTING_ACCOUNT_ASSIGNED","membershipId":"deleted-membership","projectId":"project-a"}')`);
 const orphanBefore=await snapshot();assert.equal((await lookup(orphanAccount)).verifiedOfficeAccount.code,'PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED');await assert.rejects(store.save(owner,orphanBody),{code:'PARTICIPANT_OFFICE_HISTORY_UNCONFIRMED',status:409});assert.deepEqual(await snapshot(),orphanBefore);
 await query(`DELETE FROM public."AuditLog" WHERE id='orphan-field-origin'`);
 checks.push('field-current-or-deleted-origin-limited-auditor-disabled-ADMIN-and-SUPERADMIN-accounts-cannot-be-reclassified-as-new-office-members');

 const race=candidate('ActorRace'),raceBody=await command(race),raceBefore=await assignmentCount();providerHook=()=>query(`UPDATE public."TenantMembership" SET "tenantRole"='DIRECTOR',"updatedAt"=clock_timestamp() WHERE id='owner-m'`);
 await assert.rejects(store.save(owner,raceBody),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(await assignmentCount(),raceBefore);assert.equal((await query(`SELECT count(*)::int AS n FROM public."PlatformUser" WHERE "clerkUserId"=$1`,[race.clerkUserId])).rows[0].n,0);
 await query(`UPDATE public."TenantMembership" SET "tenantRole"='ADMIN',"updatedAt"=clock_timestamp() WHERE id='owner-m'`);
 const projectRace=candidate('ProjectRace'),projectRaceBody=await command(projectRace),projectRaceBefore=await assignmentCount();providerHook=()=>query(`UPDATE public."Project" SET status='ARCHIVED' WHERE id='project-a'`);
 await assert.rejects(store.save(owner,projectRaceBody),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(await assignmentCount(),projectRaceBefore);await query(`UPDATE public."Project" SET status='ACTIVE' WHERE id='project-a'`);
 const targetRace=candidate('TargetRace'),targetRaceBody=await command(targetRace),targetRaceBefore=await assignmentCount();providerHook=()=>query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('race-target',$1,$2);`,[targetRace.clerkUserId,targetRace.email]);
 // The final transaction may reuse an unchanged canonical TENANT_USER, but a
 // newly disabled membership is never silently repaired.
 const targetHook=providerHook;providerHook=async()=>{await targetHook();await query(`INSERT INTO public."TenantMembership"(id,"organizationId","userId","tenantRole","clerkRole",status) VALUES('race-target-m','org-a','race-target','AUDITOR','org:member','DISABLED')`);};
 await assert.rejects(store.save(owner,targetRaceBody),{code:'PARTICIPANT_OFFICE_ACCOUNT_EXISTS'});assert.equal(await assignmentCount(),targetRaceBefore);
 checks.push('actor-demotion-project-archive-and-target-membership-disable-during-Clerk-I-O-are-rechecked-before-assignment');

 const rollbackAccount=candidate('AuditRollback'),rollbackBody=await command(rollbackAccount),rollbackBefore=await snapshot();failAudit=true;
 await assert.rejects(store.save(owner,rollbackBody),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.deepEqual(await snapshot(),rollbackBefore);
 const lostAccount=candidate('LostAck'),lostBody=await command(lostAccount),lostBefore=await assignmentCount();loseAck=true;
 await assert.rejects(store.save(owner,lostBody),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const lostCalls=providerCalls.length,lostRecovered=await status(lostBody),lostReplay=await store.save(owner,lostBody);
 assert.equal(lostRecovered.state,'RECORDED');assert.equal(lostReplay.receiptId,lostRecovered.receiptId);assert.equal(await assignmentCount(),lostBefore+1);assert.equal(providerCalls.length,lostCalls);
 checks.push('office-assignment-audit-failure-rolls-back-all-writes-and-committed-ACK-loss-recovers-one-receipt-without-provider-retry');

 const concurrentAccount=candidate('Concurrent'),concurrentBody=await command(concurrentAccount),concurrentBefore=await assignmentCount();const concurrent=await Promise.all([store.save(owner,concurrentBody),store.save(owner,concurrentBody)]);
 assert.equal(concurrent[0].receiptId,concurrent[1].receiptId);assert.equal(concurrent.filter(result=>result.replayed===false).length,1);assert.equal(await assignmentCount(),concurrentBefore+1);
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."TenantMembership" tm JOIN public."PlatformUser" u ON u.id=tm."userId" WHERE tm."organizationId"='org-a' AND u."clerkUserId"=$1`,[concurrentAccount.clerkUserId])).rows[0].n,1);
 checks.push('concurrent-identical-office-assignment-serializes-one-canonical-membership-and-one-receipt');

 const crossOwner=candidate('Owner'),crossForeign=candidate('Foreign'),foreignContext={projectId:'project-b',scope:(await workspace.list(foreign)).scope};
 const crossCommand=async(session,ctx,target)=>{const value=await store.verifiedOfficeAccount(session,{...ctx,email:target.email});assert.equal(value.verifiedOfficeAccount.state,'READY');return {...ctx,operationId:randomUUID(),action:'ASSIGN_VERIFIED_OFFICE',payload:{email:target.email,clerkUserId:target.clerkUserId,expectedProofDigest:value.verifiedOfficeAccount.account.proofDigest,role:'DIRECTOR',reason:'Asignación sintética a otra empresa después de aceptación Clerk independiente.',confirmOfficePermissions:true}};};
 const crossA=await crossCommand(owner,ownerContext,crossForeign),crossB=await crossCommand(foreign,foreignContext,crossOwner),crossBefore=await assignmentCount();
 // Both transactions retain their own canonical issuer SHARE before reading
 // the other existing PlatformUser. FOR UPDATE on the target would deadlock;
 // compatible SHARE locks must keep its identity fixed and permit both writes.
 let releaseIssuers,rejectIssuers;const issuersReady=new Promise((resolve,reject)=>{releaseIssuers=resolve;rejectIssuers=reject;}),arrived=new Set();
 const issuerTimeout=setTimeout(()=>rejectIssuers(Error('SYNTHETIC_CROSS_ORGANIZATION_ISSUER_BARRIER_TIMEOUT')),5000);
 issuerBarrier=async userId=>{assert.ok([owner.userId,foreign.userId].includes(userId));assert.equal(arrived.has(userId),false);arrived.add(userId);if(arrived.size===2){clearTimeout(issuerTimeout);releaseIssuers();}await issuersReady;};
 let crossed;try{crossed=await Promise.all([store.save(owner,crossA),store.save(foreign,crossB)]);}finally{clearTimeout(issuerTimeout);issuerBarrier=null;}
 assert.equal(arrived.size,2);assert.equal(crossed.length,2);assert.equal(await assignmentCount(),crossBefore+2);
 for(const [result,target] of [[crossed[0],crossForeign],[crossed[1],crossOwner]]){assert.equal(result.saved,true);assert.equal(result.replayed,false);assert.equal(result.account.role,'DIRECTOR');assert.equal(result.officeAssignmentReceipt.clerkUserId,target.clerkUserId);}
 assert.deepEqual((await query(`SELECT "organizationId","userId","tenantRole"::text AS role,"clerkRole",status::text AS status FROM public."TenantMembership" WHERE id IN ('owner-m','foreign-m') ORDER BY id`)).rows,[{organizationId:'org-b',userId:'foreign',role:'ADMIN',clerkRole:'org:admin',status:'ACTIVE'},{organizationId:'org-a',userId:'owner',role:'ADMIN',clerkRole:'org:admin',status:'ACTIVE'}]);
 assert.deepEqual(sqlFailures,[]);
 checks.push('concurrent-cross-company-office-admissions-preserve-issuer-and-target-SHARE-locks-and-both-commit-without-deadlock');

 await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('historical-limited-office','org-a',$1,'office.review.accepted','Project','project-a',$2::jsonb)`,[(await query(`SELECT "userId" FROM public."TenantMembership" WHERE id=$1`,[assigned.account.membershipId])).rows[0].userId,JSON.stringify({membershipId:assigned.account.membershipId})]);
 const limitedContext=await context(director),limitedList=await workspace.list(director);assert.equal(limitedList.officeReviewOnly,true);
 let limitedCallback=false;for(const operation of [()=>workspace.projectOperation(director,limitedContext,true,()=>{limitedCallback=true;}),()=>workspace.integrationProject(director,limitedContext,true,()=>{limitedCallback=true;}),()=>store.read(director,limitedContext),()=>field.reviewPage(director,{...limitedContext,reviewSection:'PROGRESS',reviewFilter:'PENDING'})])await assert.rejects(operation(),{code:'OFFICE_REVIEW_ONLY'});assert.equal(limitedCallback,false);
 await query(`DELETE FROM public."AuditLog" WHERE id='historical-limited-office'`);
 const memberRecord=(await query(`SELECT "userId" FROM public."TenantMembership" WHERE id=$1`,[assigned.account.membershipId])).rows[0];
 await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('historical-deleted-field','org-a',$1,'participant.operation.recorded','Worker','deleted-office-worker',$2::jsonb)`,[memberRecord.userId,JSON.stringify({version:1,kind:'INVITATION_ACCEPTED',projectId:'project-a'})]);
 const bound=await workspace.projectOperation(owner,ownerContext,false,(client)=>participantAccountBound(client,{actorId:memberRecord.userId,membershipId:assigned.account.membershipId,organizationId:'org-a',clerkUserId:director.userId,clerkRole:'org:member',role:'DIRECTOR'}));assert.equal(bound,true);
 await assert.rejects(workspace.read(director,{...directorContext,projectId:'project-a2'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 await query(`DELETE FROM public."AuditLog" WHERE id='historical-deleted-field'`);
 checks.push('historical-limited-auditor-and-deleted-field-origin-continue-to-block-office-bypass-even-after-DIRECTOR-role');

 const staleContext=directorContext;await query(`UPDATE public."TenantMembership" SET "tenantRole"='FINANCE',"updatedAt"=clock_timestamp() WHERE id=$1`,[assigned.account.membershipId]);
 await assert.rejects(workspace.read(director,staleContext),{code:'WORKSPACE_CONTEXT_CHANGED'});
 await query(`UPDATE public."TenantMembership" SET status='DISABLED',"updatedAt"=clock_timestamp() WHERE id=$1`,[assigned.account.membershipId]);
 await assert.rejects(workspace.list(director),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 const currentReceipt=await status(directorBody);assert.equal(currentReceipt.account.status,'DISABLED');assert.equal(currentReceipt.account.role,'FINANCE');assert.deepEqual(currentReceipt.officeAssignmentReceipt,assigned.officeAssignmentReceipt);
 checks.push('later-role-change-or-disable-invalidates-office-session-and-recovery-projects-current-account-with-immutable-original-assignment');

 const httpAccount=candidate('HttpBoundary'),httpBody=await command(httpAccount),beforeHttp=await snapshot();
 const handler=createParticipantHandlers({verify:async()=>owner,store});const badOrigin=await handler.POST(new Request('https://obrasaas.com/api/identity/participants',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify(httpBody)}));assert.equal(badOrigin.status,403);assert.match(badOrigin.headers.get('cache-control'),/no-store/);
 await assert.rejects(store.save(foreign,{...httpBody,scope:(await workspace.list(foreign)).scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});await assert.rejects(store.save(owner,{...httpBody,scope:'0'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.deepEqual(await snapshot(),beforeHttp);
 checks.push('office-assignment-preserves-private-HTTP-origin-tenant-isolation-and-canonical-context-before-storage');
 assert.equal(network,0);assert.deepEqual(sqlFailures,[]);
}finally{
 globalThis.fetch=originalFetch;
 try{if(pool)await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_verified_office_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');assert.equal((await admin.query('SELECT nspname FROM pg_namespace WHERE nspname=$1',[schema])).rows.length,0);removed=true;}}finally{await admin.end();}
}
assertStableSource();
const proof={status:'PASS',checkedAt:new Date().toISOString(),...initialSourceState,sourceManifest,harnessSha256,checks,sqlFailures,schemaRemoved:removed,providerCalls:0,controlledIdentityLookups:providerCalls.length,unexpectedNetworkCalls:network,syntheticIdentityOnly:true,realHumanAcceptance:false,identityCertified:false,participantKycFixture:{records:kycFixture.records,syntheticPrivateCalls:kycFixture.calls,providerCalls:0,identityCertified:false}};
mkdirSync('.vercel/verified-office-onboarding-evidence',{recursive:true});writeFileSync('.vercel/verified-office-onboarding-evidence/postgres.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify({status:proof.status,checks:checks.length,schemaRemoved:removed,providerCalls:0,sourceRevision:proof.sourceRevision,sourceState:proof.sourceState,trackedClean:proof.trackedClean}));
