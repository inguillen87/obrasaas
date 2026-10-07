import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {createFieldMedia,decodeFieldMedia} from '../src/lib/field-media.mjs';
import {fieldMediaAnalysisConsent} from '../src/lib/field-media-privacy.mjs';
import {createSiteRegister} from '../src/lib/site-register-store.mjs';
import {createFieldQrHandler,createFieldHandlers} from '../src/lib/field-operations-http.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {fieldReviewPage} from '../src/app/(identity)/cuenta/field-review-page-view.mjs';
import {prepareVoiceProgressDraft,voiceProgressDraftReady} from '../src/lib/voice-progress-draft.mjs';
import QRCode from 'qrcode';
const url=new URL(process.env.CUTOVER_TEST_DATABASE_URL||'http://not-configured');
assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.pathname,'/obrasaas_cutover_ci');assert.equal(url.search,'');
const database='obrasaas_field_'+randomUUID().replaceAll('-','');assert.match(database,/^obrasaas_field_[a-f0-9]{32}$/);
const admin=new Client({connectionString:url.toString()});let pool,created=false,proof;const checks=[],reviewPaginationChecks=[],voiceProgressChecks=[];
const session=(user,organization='org_A',role='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId:user,organizationId:organization,organizationRole:role});
const owner=session('user_Owner','org_A','org:admin'),director=session('user_Director'),manager=session('user_Manager'),worker=session('user_Worker'),otherWorker=session('user_Worker2'),foreign=session('user_Foreign','org_B','org:admin');
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8}));
 await pool.query(`
 CREATE TYPE "IncidentSeverity" AS ENUM('INFO','LOW','MEDIUM','HIGH','CRITICAL');
 CREATE TYPE "AttendanceStatus" AS ENUM('PRESENT','OUTSIDE_GEOFENCE','EXCUSED','ABSENT','PENDING_GEO');
 CREATE TYPE "TaskStatus" AS ENUM('BACKLOG','READY','IN_PROGRESS','BLOCKED','DONE');
 CREATE TYPE "OperationalProposalType" AS ENUM('TASK_PROGRESS','DELAY_REPORT','CRITICAL_INCIDENT');
 CREATE TYPE "OperationalProposalStatus" AS ENUM('PENDING','APPLIED','REJECTED','EXPIRED','INVALIDATED');
 CREATE TABLE "Organization"(id text PRIMARY KEY,name text NOT NULL,"clerkOrganizationId" text UNIQUE,metadata jsonb);
 CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text UNIQUE NOT NULL);
 CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","userId" text REFERENCES "PlatformUser","tenantRole" text,"clerkRole" text,status text,UNIQUE("organizationId","userId"));
 CREATE TABLE "Project"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text,status text,metadata jsonb,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "ProjectMembership"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status text,UNIQUE("projectId","tenantMembershipId"));
 CREATE TABLE "Worker"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",name text NOT NULL,phone text NOT NULL,role text,active boolean DEFAULT true,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp NOT NULL,UNIQUE("projectId",phone));
 CREATE TABLE "Task"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text,status "TaskStatus",progress int,"startsAt" timestamp,"endsAt" timestamp,metadata jsonb,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "Incident"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text NOT NULL,description text,severity "IncidentSeverity" DEFAULT 'INFO',status text DEFAULT 'open',reporter text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp NOT NULL);
 CREATE TABLE "AttendanceEntry"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","workerId" text REFERENCES "Worker",status "AttendanceStatus",latitude numeric,longitude numeric,"distanceMeters" int,source text,"checkedInAt" timestamp DEFAULT CURRENT_TIMESTAMP,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "OperationalProposal"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","proposedByWorkerId" text REFERENCES "Worker","resolvedByWorkerId" text,"sourceProvider" varchar(32),"sourceExternalId" varchar(190),"resolverProvider" varchar(32),"resolverExternalId" varchar(190),"confirmationCode" varchar(12),type "OperationalProposalType",status "OperationalProposalStatus" DEFAULT 'PENDING',summary varchar(240),action jsonb,precondition jsonb,result jsonb,"classifierVersion" varchar(64),"transcriptSha256" char(64),"expiresAt" timestamp,"resolvedAt" timestamp,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp);
 CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text NOT NULL,"entityType" text,"entityId" text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE UNIQUE INDEX "OperationalProposal_source_event_key" ON "OperationalProposal"("projectId","sourceProvider","sourceExternalId");
 CREATE UNIQUE INDEX "OperationalProposal_resolver_event_key" ON "OperationalProposal"("projectId","resolverProvider","resolverExternalId");
 CREATE UNIQUE INDEX "OperationalProposal_project_confirmation_key" ON "OperationalProposal"("projectId","confirmationCode");
 INSERT INTO "Organization" VALUES('company-a','Synthetic A','org_A','{}'),('company-b','Synthetic B','org_B','{}');
 INSERT INTO "PlatformUser" VALUES('owner','user_Owner'),('director','user_Director'),('manager','user_Manager'),('worker','user_Worker'),('worker2','user_Worker2'),('foreign','user_Foreign');
 INSERT INTO "TenantMembership" VALUES('owner-m','company-a','owner','ADMIN','org:admin','ACTIVE'),('director-m','company-a','director','DIRECTOR','org:member','ACTIVE'),('manager-m','company-a','manager','SITE_MANAGER','org:member','ACTIVE'),('worker-m','company-a','worker','AUDITOR','org:member','ACTIVE'),('worker2-m','company-a','worker2','AUDITOR','org:member','ACTIVE'),('foreign-m','company-b','foreign','ADMIN','org:admin','ACTIVE');
 INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('p-a','company-a','Synthetic A','ACTIVE','{"unrelated":true}'),('p-b','company-b','Synthetic B','ACTIVE','{}');
 INSERT INTO "ProjectMembership" VALUES('manager-p','p-a','manager-m','ACTIVE'),('worker-p','p-a','worker-m','ACTIVE'),('worker2-p','p-a','worker2-m','ACTIVE');
 INSERT INTO "Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata) VALUES('task-a','p-a','Synthetic task','BACKLOG',0,'2026-10-01','2026-10-10','{"unrelated":true}'),('task-b','p-b','Foreign task','BACKLOG',0,null,null,'{}');
 `);
 for(const [id,user] of [['w-a','user_Worker'],['w-a2','user_Worker2'],['w-owner','user_Owner']])await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") VALUES($1,'p-a',$1,$2,'WORKER',$3::jsonb,clock_timestamp())`,[id,'+549110000'+(id==='w-a'?'1111':id==='w-a2'?'2222':'3333'),JSON.stringify({participant:{version:1,clerkUserId:user,status:'ACTIVE',permissions:{attendance:true,report:true},kyc:{version:1,status:'APPROVED'}}})]);
 const workspace=createWorkspaceStore({connect:()=>pool.connect()}),operations=createFieldOperations({workspace}),scopes={};for(const s of [owner,director,manager,worker,otherWorker,foreign])scopes[s.userId]=(await workspace.list(s)).scope;
 const context=s=>({projectId:'p-a',scope:scopes[s.userId]}),command=(s,action,payload,extra={})=>({...context(s),operationId:randomUUID(),action,payload,...extra}),read=s=>operations.read(s,context(s));
 await assert.rejects(operations.read(foreign,context(foreign)),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 const conf=await operations.save(owner,command(owner,'CONFIGURE_SITE',{revision:(await read(owner)).projectRevision,sectors:[{id:'sector-main',name:'Synthetic sector',latitude:0,longitude:0,radius:100}]}));assert.equal(conf.qrTokens.length,1);
 assert.equal((await pool.query('SELECT metadata FROM "Project" WHERE id=$1',['p-a'])).rows[0].metadata.unrelated,true);
 const token=conf.qrTokens[0].token;checks.push('canonical-project-configuration-preserves-unrelated-metadata-and-is-tenant-isolated');
 const requestMaterial=command(worker,'REQUEST_MATERIAL',{workerId:'w-a',sectorId:'sector-main',taskId:'task-a',name:'Synthetic cement',quantity:'002.500',unit:'bolsa',reason:'Synthetic worksite material need.',evidenceIds:[]});
 const requests=await Promise.all([operations.save(worker,requestMaterial),operations.save(worker,requestMaterial)]);assert.equal(requests.filter(r=>!r.replayed).length,1);assert.equal(requests[0].report.quantity,'2.5');assert.equal(requests[0].purchaseAuthorized,false);
 const register=createSiteRegister({workspace}),officeMaterials=await register.read(owner,{...context(owner),section:'MATERIALS'});assert.equal(officeMaterials.records[0].id,requests[0].report.id);assert.equal((await read(otherWorker)).materialRequests.length,0);
 await assert.rejects(operations.save(otherWorker,{...requestMaterial,...context(otherWorker),operationId:randomUUID()}),{code:'FIELD_PARTICIPANT_REQUIRED'});
 await assert.rejects(operations.save(worker,{...requestMaterial,operationId:randomUUID(),payload:{...requestMaterial.payload,taskId:'task-b'}}),{code:'WORKSPACE_TASK_UNAVAILABLE'});
 const incidentCommand=command(worker,'REPORT_INCIDENT',{workerId:'w-a',sectorId:'sector-main',taskId:null,title:'Synthetic access issue',description:'Synthetic access needs the responsible review.',severity:'MEDIUM',evidenceIds:[]}),issue=await operations.save(worker,incidentCommand);
 assert.equal((await register.read(owner,{...context(owner),section:'ISSUES'})).records[0].id,issue.report.id);
 await register.save(owner,{...context(owner),operationId:randomUUID(),action:'REVIEW_REPORT',payload:{reportId:issue.report.id,revision:issue.report.revision,decision:'ACKNOWLEDGED',reason:'Responsible follows up the canonical worker report.'}});
 assert.equal((await operations.status(worker,{...context(worker),operationId:incidentCommand.operationId})).report.state,'ACKNOWLEDGED');
 const failReportWorkspace=createWorkspaceStore({connect:async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:(sql,args)=>{if(sql.startsWith('INSERT INTO public."AuditLog"'))throw new Error('Synthetic worker report audit failure');return c.query(sql,args);}};}});
 const reportCount=(await read(worker)).incidents.length;await assert.rejects(createFieldOperations({workspace:failReportWorkspace}).save(worker,{...incidentCommand,operationId:randomUUID()}),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal((await read(worker)).incidents.length,reportCount);
 checks.push('worker-material-and-incidence-are-canonical-office-records-with-private-ownership-concurrent-receipt-and-audit-rollback');
 const attendance=(s,eventType,expectedEventId,overrides={})=>command(s,'ATTENDANCE',{workerId:'w-a',eventType,expectedEventId,sectorId:'sector-main',qrToken:token,location:['CHECK_IN','CHECK_OUT'].includes(eventType)?{latitude:0,longitude:0,accuracy:5,capturedAt:new Date().toISOString(),noticeVersion:'field-location-v1'}:null,...overrides});
 await assert.rejects(operations.save(otherWorker,attendance(otherWorker,'CHECK_IN',null)),{code:'FIELD_PARTICIPANT_REQUIRED'});
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"PENDING_REVIEW"') WHERE id='w-a'`);
 await assert.rejects(operations.save(worker,attendance(worker,'CHECK_IN',null)),{code:'FIELD_KYC_REVIEW_REQUIRED'});await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"APPROVED"') WHERE id='w-a'`);
 const entryInput=attendance(worker,'CHECK_IN',null),concurrent=await Promise.all([operations.save(worker,entryInput),operations.save(worker,entryInput),operations.save(worker,entryInput)]);assert.equal(concurrent.filter(r=>!r.replayed).length,1);const entry=concurrent[0].event;assert.equal(entry.verificationStatus,'VERIFIED');
 await assert.rejects(operations.save(worker,{...entryInput,payload:{...entryInput.payload,sectorId:'changed'}}),{code:'FIELD_OPERATION_CONFLICT'});
 const paused=await operations.save(worker,attendance(worker,'BREAK_START',entry.id));await assert.rejects(operations.save(worker,attendance(worker,'CHECK_OUT',paused.event.id)),{code:'ATTENDANCE_BREAK_OPEN'});
 const resumed=await operations.save(worker,attendance(worker,'BREAK_END',paused.event.id)),exit=await operations.save(worker,attendance(worker,'CHECK_OUT',resumed.event.id,{qrToken:null}));assert.equal(exit.event.verificationStatus,'REVIEW_REQUIRED');
 await operations.save(owner,command(owner,'REVIEW_ATTENDANCE',{eventId:exit.event.id,decision:'APPROVE',reason:'Human reviewed worksite evidence.'}));
 const review=(await read(owner)).attendance.find(e=>e.id===exit.event.id);assert.equal(review.review?.decision,'APPROVE');assert.equal((await read(otherWorker)).attendance.length,0);
 checks.push('participant-kyc-self-ownership-concurrent-idempotency-break-sequence-qr-review-and-private-journey');
 const objects=new Map();let putCount=0,getCount=0,providerCalls=0;const get=async pathname=>{getCount++;const o=objects.get(pathname);return o?{statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname,size:o.bytes.length,contentType:o.contentType},stream:new ReadableStream({start(c){c.enqueue(o.bytes);c.close();}})}:null;};
 const put=async(pathname,bytes,options)=>{assert.equal(options.access,'private');putCount++;if(objects.has(pathname))throw new Error('Already exists');objects.set(pathname,{bytes:Buffer.from(bytes),contentType:options.contentType});return {url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname};};
 const analyzer={analyzePhoto:async()=>{providerCalls++;return {success:true,status:'ANALYZED_UNREVIEWED',aiAnalysis:'Synthetic adapter response only.',requiresHumanReview:true};},transcribeAudio:async()=>{providerCalls++;return {success:false,code:'AI_PROVIDER_NOT_CONFIGURED'};}};
 const media=createFieldMedia({operations,put,get,analyzer,environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-private-fixture'})});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2l8AAAAASUVORK5CYII=','base64'),upload={...context(worker),operationId:randomUUID(),workerId:'w-a',taskId:'task-a',sectorId:'sector-main',caption:'Synthetic evidence for the measured task.',media:decodeFieldMedia(png,'image/png')};
 const attached=await media.attach(worker,upload);assert.equal((await media.attach(worker,upload)).replayed,true);assert.equal(putCount,1);assert.equal(attached.evidence.status,'PENDING');
 await assert.rejects(media.download(otherWorker,{...context(otherWorker),evidenceId:attached.evidence.id}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});assert.deepEqual((await media.download(worker,{...context(worker),evidenceId:attached.evidence.id})).bytes,png);
 const rejectUnconsented=async(evidence,kind)=>{const before={getCount,putCount,providerCalls,metadata:(await pool.query('SELECT metadata FROM "Incident" WHERE id=$1',[evidence.id])).rows[0].metadata,audits:(await pool.query('SELECT count(*)::int AS n FROM "AuditLog"')).rows[0].n};for(const analysisConsent of [undefined,fieldMediaAnalysisConsent(false),{...fieldMediaAnalysisConsent(true),noticeVersion:'old-media-v0'},{...fieldMediaAnalysisConsent(true),noticeSha256:'f'.repeat(64)}]){const input={...context(worker),operationId:randomUUID(),evidenceId:evidence.id,revision:evidence.revision,...(analysisConsent?{analysisConsent}:{})};await assert.rejects(media.process(worker,input),{code:'FIELD_MEDIA_ANALYSIS_CONSENT_REQUIRED'});}assert.deepEqual({getCount,putCount,providerCalls,metadata:(await pool.query('SELECT metadata FROM "Incident" WHERE id=$1',[evidence.id])).rows[0].metadata,audits:(await pool.query('SELECT count(*)::int AS n FROM "AuditLog"')).rows[0].n},before);checks.push('queued-'+kind+'-missing-declined-stale-or-forged-consent-zero-private-storage-provider-reservation-and-audit-effects');};
 await rejectUnconsented(attached.evidence,'image');
 const processed=await media.process(worker,{...context(worker),operationId:randomUUID(),evidenceId:attached.evidence.id,revision:attached.evidence.revision,analysisConsent:fieldMediaAnalysisConsent(true)});assert.equal(processed.evidence.processing.status,'ANALYZED_UNREVIEWED');assert.equal((await workspace.read(owner,context(owner))).tasks[0].progress,0);
 const wav=Buffer.concat([Buffer.from('RIFF0000WAVE'),Buffer.alloc(40)]),audio=await media.attach(worker,{...upload,operationId:randomUUID(),media:decodeFieldMedia(wav,'audio/wav')}),processingInput={...context(worker),operationId:randomUUID(),evidenceId:audio.evidence.id,revision:audio.evidence.revision,analysisConsent:fieldMediaAnalysisConsent(true)};
 await rejectUnconsented(audio.evidence,'audio');
 const uncertainProcessWorkspace=createWorkspaceStore({connect:async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:async(sql,args)=>{const r=await c.query(sql,args);if(sql==='COMMIT')throw new Error('Synthetic process claim acknowledgement loss');return r;}};}});
 const uncertainProcess=createFieldMedia({operations:createFieldOperations({workspace:uncertainProcessWorkspace}),put,get,analyzer});
 await assert.rejects(uncertainProcess.process(worker,processingInput),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal((await media.status(worker,{...context(worker),operationId:processingInput.operationId})).state,'PROCESSING');
 await pool.query(`UPDATE "Incident" SET metadata=jsonb_set(metadata,'{fieldOperations,processing,expiresAt}',$2::jsonb) WHERE id=$1`,[audio.evidence.id,JSON.stringify('2000-01-01T00:00:00.000Z')]);
 const retryProcess=await media.process(worker,processingInput);assert.equal(retryProcess.evidence.processing.status,'FAILED_RETRYABLE');assert.equal(retryProcess.evidence.processing.code,'AI_PROVIDER_NOT_CONFIGURED');assert.deepEqual((await media.download(worker,{...context(worker),evidenceId:audio.evidence.id})).bytes,wav);
 checks.push('durable-processing-claim-loss-expiration-exact-retry-and-provider-failure-preserve-private-audio');
 const approved=await operations.save(director,command(director,'REVIEW_EVIDENCE',{evidenceId:attached.evidence.id,revision:processed.evidence.revision,decision:'APPROVE',reason:'Reviewed the original private evidence.'}));
 const badObjects=[...objects.values()][0],original=badObjects.bytes;badObjects.bytes=Buffer.from(original);badObjects.bytes[badObjects.bytes.length-1]^=1;await assert.rejects(media.download(worker,{...context(worker),evidenceId:attached.evidence.id}),{code:'FIELD_MEDIA_INTEGRITY'});badObjects.bytes=original;
 checks.push('private-media-byte-readback-cross-worker-download-denial-explicit-processing-and-human-review');
 const otherAttached=await media.attach(otherWorker,{...upload,...context(otherWorker),operationId:randomUUID(),workerId:'w-a2',caption:'Synthetic same-task evidence from another participant.'});
 const otherApproved=await operations.save(director,command(director,'REVIEW_EVIDENCE',{evidenceId:otherAttached.evidence.id,revision:otherAttached.evidence.revision,decision:'APPROVE',reason:'Independently reviewed the second participant original.'}));
 const task=(await workspace.read(owner,context(owner))).tasks[0],propose=command(worker,'PROPOSE_PROGRESS',{workerId:'w-a',taskId:task.id,revision:task.revision,progress:25,quantity:'2.5',baseline:'10',unit:'M2',reason:'Synthetic measured quantity for approved evidence.',evidenceIds:[approved.evidence.id,otherApproved.evidence.id]});
 const proposed=await operations.save(worker,propose);assert.equal(proposed.taskUnchanged,true);assert.equal((await workspace.read(owner,context(owner))).tasks[0].progress,0);
 await pool.query(`INSERT INTO "Incident"(id,"projectId",title,description,metadata,"createdAt","updatedAt") SELECT 'synthetic_recent_'||n,'p-a',title,description,metadata,clock_timestamp(),clock_timestamp() FROM "Incident" CROSS JOIN generate_series(1,101) AS n WHERE id=$1`,[otherApproved.evidence.id]);
 assert.equal((await read(director)).evidence.some(e=>e.id===approved.evidence.id),false);
 const stateBeforeLookup=await pool.query(`SELECT (SELECT count(*)::int FROM "Incident") AS evidence,(SELECT count(*)::int FROM "AuditLog") AS audit,(SELECT count(*)::int FROM "OperationalProposal") AS proposals`);
 const linked=await operations.proposalEvidence(director,{...context(director),proposalId:proposed.proposal.id});
 assert.equal(linked.proposalRevision,proposed.proposal.revision);assert.equal(linked.scope,scopes[director.userId]);assert.deepEqual(linked.evidence.map(e=>e.id).sort(),[...propose.payload.evidenceIds].sort());assert.ok(linked.evidence.some(e=>e.workerId==='w-a2'));
 assert.equal(JSON.stringify(linked).includes('blob.vercel-storage.com'),false);
 for(const s of [manager,worker,otherWorker])await assert.rejects(operations.proposalEvidence(s,{...context(s),proposalId:proposed.proposal.id}),{code:'FIELD_PROGRESS_PERMISSION_REQUIRED'});
 await assert.rejects(operations.proposalEvidence(foreign,{...context(foreign),proposalId:proposed.proposal.id}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 await assert.rejects(operations.proposalEvidence(director,{...context(director),scope:scopes[owner.userId],proposalId:proposed.proposal.id}),{code:'WORKSPACE_CONTEXT_CHANGED'});
 assert.deepEqual((await pool.query(`SELECT (SELECT count(*)::int FROM "Incident") AS evidence,(SELECT count(*)::int FROM "AuditLog") AS audit,(SELECT count(*)::int FROM "OperationalProposal") AS proposals`)).rows,stateBeforeLookup.rows);
 assert.deepEqual((await workspace.read(owner,context(owner))).tasks[0],task);assert.equal((await read(owner)).proposals[0].status,'PENDING');
 checks.push('exact-linked-evidence-older-than-100-rows-supports-other-uploader-and-rechecks-current-role-tenant-scope-without-writes');
 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE id='worker-m'`);const makerScope=(await workspace.list(worker)).scope;
 await assert.rejects(operations.save(worker,command(worker,'DECIDE_PROGRESS',{proposalId:proposed.proposal.id,revision:proposed.proposal.revision,decision:'APPROVE',reason:'The maker must not approve their own proposal.'},{scope:makerScope})),{code:'FIELD_MAKER_CHECKER_REQUIRED'});await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR' WHERE id='worker-m'`);
 await assert.rejects(operations.save(manager,command(manager,'DECIDE_PROGRESS',{proposalId:proposed.proposal.id,revision:proposed.proposal.revision,decision:'APPROVE',reason:'Role cannot decide progress.'})),{code:'FIELD_PROGRESS_PERMISSION_REQUIRED'});
 const decision=command(director,'DECIDE_PROGRESS',{proposalId:proposed.proposal.id,revision:proposed.proposal.revision,decision:'APPROVE',reason:'Director reviewed measured progress and private evidence.'});
 const failApprovalWorkspace=createWorkspaceStore({connect:async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:(sql,args)=>{if(sql.startsWith('INSERT INTO public."AuditLog"'))throw new Error('Synthetic audit failure');return c.query(sql,args);}};}});
 await assert.rejects(createFieldOperations({workspace:failApprovalWorkspace}).save(director,decision),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal((await workspace.read(owner,context(owner))).tasks[0].progress,0);assert.equal((await read(owner)).proposals[0].status,'PENDING');
 const decisions=await Promise.all([operations.save(director,decision),operations.save(director,decision)]);assert.equal(decisions.filter(r=>!r.replayed).length,1);assert.equal(decisions[0].task.progress,25);
 const persisted=(await pool.query('SELECT progress,status,metadata,"startsAt","endsAt" FROM "Task" WHERE id=$1',['task-a'])).rows[0];assert.equal(persisted.metadata.unrelated,true);assert.equal(persisted.metadata.fieldOperations.quantity.executed,'2.5000');assert.equal(persisted.startsAt.toISOString().slice(0,10),'2026-10-01');
 checks.push('quantity-proposal-does-not-change-task-until-authorized-concurrent-approval-and-preserves-gantt-dates');
 const exactTask=(await workspace.read(owner,context(owner))).tasks[0],exact=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:exactTask.revision,progress:25,quantity:'2.59'}));
 await operations.save(director,command(director,'DECIDE_PROGRESS',{proposalId:exact.proposal.id,revision:exact.proposal.revision,decision:'APPROVE',reason:'Synthetic exact cumulative measurement inside the same integer percentage.'}));
 const exactCurrent=(await workspace.read(owner,context(owner))).tasks[0],quantityState=async()=>(await pool.query(`SELECT (SELECT to_jsonb(t) FROM "Task" t WHERE id='task-a') AS task,(SELECT count(*)::int FROM "OperationalProposal") AS proposals,(SELECT count(*)::int FROM "AuditLog") AS audits`)).rows;
 const beforeRegression=await quantityState();await assert.rejects(operations.save(worker,command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:exactCurrent.revision,progress:25,quantity:'2.5'})),{code:'FIELD_PROGRESS_REGRESSION'});assert.deepEqual(await quantityState(),beforeRegression);
 const defensive=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:exactCurrent.revision,progress:25,quantity:'2.5999'}));
 await pool.query(`UPDATE "OperationalProposal" SET action=jsonb_set(action,'{quantity}','"2.5000"'::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1`,[defensive.proposal.id]);
 const defensiveCurrent=(await read(director)).proposals.find(p=>p.id===defensive.proposal.id),beforeDecisionRegression=await quantityState();await assert.rejects(operations.save(director,command(director,'DECIDE_PROGRESS',{proposalId:defensiveCurrent.id,revision:defensiveCurrent.revision,decision:'APPROVE',reason:'Synthetic corrupted proposal must not regress the precise measurement.'})),{code:'FIELD_PROGRESS_REGRESSION'});assert.deepEqual(await quantityState(),beforeDecisionRegression);
 await operations.save(director,command(director,'DECIDE_PROGRESS',{proposalId:defensiveCurrent.id,revision:defensiveCurrent.revision,decision:'REJECT',reason:'Synthetic corrupted cumulative quantity is rejected for cleanup.'}));
 checks.push('exact-cumulative-quantity-regression-inside-same-integer-percent-refused-on-propose-and-defensive-decision-with-zero-task-proposal-audit-writes');
 const currentTask=(await workspace.read(owner,context(owner))).tasks[0],second=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:currentTask.revision,progress:30,quantity:'3'}));
 await operations.save(director,command(director,'DECIDE_PROGRESS',{proposalId:second.proposal.id,revision:second.proposal.revision,decision:'REJECT',reason:'The extra quantity lacks an adequate foundation.'}));assert.equal((await workspace.read(owner,context(owner))).tasks[0].progress,25);checks.push('maker-checker-task-approval-audit-rollback-and-rejection-never-changes-approved-progress');
 await pool.query(`UPDATE "Task" SET status='BLOCKED',"updatedAt"=clock_timestamp() WHERE id='task-a'`);const blockedTask=(await workspace.read(owner,context(owner))).tasks[0];
 const later=await operations.save(worker,command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:blockedTask.revision,progress:50,quantity:'5'}));
 await operations.save(director,command(director,'DECIDE_PROGRESS',{proposalId:later.proposal.id,revision:later.proposal.revision,decision:'APPROVE',reason:'Measured work does not remove the independent task blocker.'}));
 const recovered=(await operations.status(director,{...context(director),operationId:decision.operationId}));assert.equal(recovered.task.progress,50);assert.equal(recovered.task.status,'BLOCKED');assert.equal(recovered.decisionTaskSnapshot.progress,25);
 assert.equal((await operations.save(director,decision)).task.progress,50);assert.equal((await workspace.read(owner,context(owner))).tasks[0].status,'BLOCKED');checks.push('old-approval-recovery-returns-current-task-and-never-clears-an-independent-blocker');
 const expiryTask=(await workspace.read(owner,context(owner))).tasks[0],expiringCommand=command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:expiryTask.revision,progress:60,quantity:'6'}),expiring=await operations.save(worker,expiringCommand);
 assert.ok(expiring.proposal.expiresAt);assert.equal(expiring.proposal.statusStored,'PENDING');
 await pool.query(`UPDATE "OperationalProposal" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE id=$1`,[expiring.proposal.id]);
 const expiredVisible=(await read(director)).proposals.find(p=>p.id===expiring.proposal.id);assert.equal(expiredVisible.status,'EXPIRED');assert.equal(expiredVisible.statusStored,'PENDING');
 assert.equal((await operations.status(worker,{...context(worker),operationId:expiringCommand.operationId})).proposal.status,'EXPIRED');
 await assert.rejects(operations.save(director,command(director,'DECIDE_PROGRESS',{proposalId:expiring.proposal.id,revision:expiring.proposal.revision,decision:'APPROVE',reason:'An expired proposal must never update the task.'})),{code:'FIELD_PROPOSAL_EXPIRED'});
 for(const [id,provider,taskId,type] of [['other-engine-expiry','other-engine','task-a','TASK_PROGRESS'],['other-task-expiry','account-field','task-other','TASK_PROGRESS'],['other-type-expiry','account-field','task-a','DELAY_REPORT']]){
  await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId","confirmationCode",type,status,summary,action,precondition,"expiresAt","updatedAt") SELECT $1::text,"projectId","proposedByWorkerId",$2,$1::text,left($1::text,12),$4::"OperationalProposalType",'PENDING',summary,jsonb_set(action,'{taskId}',to_jsonb($3::text)),precondition,clock_timestamp()-interval '1 second',clock_timestamp() FROM "OperationalProposal" WHERE id=$5`,[id,provider,taskId,type,expiring.proposal.id]);
 }
 const replacementCommand=command(worker,'PROPOSE_PROGRESS',{...propose.payload,revision:expiryTask.revision,progress:65,quantity:'6.5'}),expiryCount=async()=>(await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action='field.progress.expired'`)).rows[0].n;
 await assert.rejects(operations.save(manager,command(manager,'PROPOSE_PROGRESS',replacementCommand.payload)),{code:'FIELD_PARTICIPANT_REQUIRED'});
 await assert.rejects(operations.save(foreign,command(foreign,'PROPOSE_PROGRESS',replacementCommand.payload)),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.equal(await expiryCount(),0);
 await assert.rejects(createFieldOperations({workspace:failApprovalWorkspace}).save(worker,replacementCommand),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
 assert.equal((await pool.query(`SELECT status FROM "OperationalProposal" WHERE id=$1`,[expiring.proposal.id])).rows[0].status,'PENDING');assert.equal(await expiryCount(),0);assert.deepEqual((await workspace.read(owner,context(owner))).tasks[0],expiryTask);
 const replacements=await Promise.all([operations.save(worker,replacementCommand),operations.save(worker,replacementCommand)]);assert.equal(replacements.filter(r=>!r.replayed).length,1);assert.equal(replacements[0].proposal.status,'PENDING');assert.equal(await expiryCount(),1);
 const expiryAudit=(await pool.query(`SELECT "actorId",metadata FROM "AuditLog" WHERE action='field.progress.expired'`)).rows[0];assert.equal(expiryAudit.actorId,'worker');assert.equal(expiryAudit.metadata.taskUpdated,false);assert.equal(expiryAudit.metadata.triggerOperationId,replacementCommand.operationId);
 assert.equal((await pool.query(`SELECT status FROM "OperationalProposal" WHERE id=$1`,[expiring.proposal.id])).rows[0].status,'EXPIRED');
 assert.ok((await pool.query(`SELECT status FROM "OperationalProposal" WHERE id IN ('other-engine-expiry','other-task-expiry','other-type-expiry')`)).rows.every(row=>row.status==='PENDING'));
 assert.equal((await operations.save(worker,expiringCommand)).proposal.status,'EXPIRED');assert.equal((await operations.save(worker,replacementCommand)).proposal.id,replacements[0].proposal.id);assert.equal(await expiryCount(),1);assert.deepEqual((await workspace.read(owner,context(owner))).tasks[0],expiryTask);
 await pool.query(`UPDATE "Worker" SET active=false WHERE id='w-a'`);await assert.rejects(operations.save(worker,replacementCommand),{code:'FIELD_PARTICIPANT_REQUIRED'});await assert.rejects(operations.status(worker,{...context(worker),operationId:replacementCommand.operationId}),{code:'FIELD_PARTICIPANT_REQUIRED'});await pool.query(`UPDATE "Worker" SET active=true,metadata=jsonb_set(metadata,'{participant,permissions,report}','false') WHERE id='w-a'`);await assert.rejects(operations.save(worker,expiringCommand),{code:'FIELD_PARTICIPANT_REQUIRED'});await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,permissions,report}','true') WHERE id='w-a'`);
 checks.push('server-clock-expiration-audit-rollback-and-exact-replacement-ignore-other-engines-and-never-change-task');
 const ambiguousWorkspace=createWorkspaceStore({connect:async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:async(sql,args)=>{const result=await c.query(sql,args);if(sql==='COMMIT')throw new Error('Synthetic lost acknowledgement');return result;}};}}),ambiguous=createFieldOperations({workspace:ambiguousWorkspace}),uncertain=attendance(worker,'CHECK_IN',exit.event.id);
 await assert.rejects(ambiguous.save(worker,uncertain),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal((await operations.status(worker,{...context(worker),operationId:uncertain.operationId})).state,'RECORDED');assert.equal((await operations.save(worker,uncertain)).replayed,true);
 const failingWorkspace=createWorkspaceStore({connect:async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:(sql,args)=>{if(sql.startsWith('INSERT INTO public."AuditLog"'))throw new Error('Synthetic audit failure');return c.query(sql,args);}};}}),failing=createFieldOperations({workspace:failingWorkspace}),before=(await read(worker)).attendance.length,last=(await read(worker)).attendance[0];
 await assert.rejects(failing.save(worker,attendance(worker,'BREAK_START',last.id)),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});assert.equal((await read(worker)).attendance.length,before);
 const siteBefore=(await pool.query(`SELECT metadata FROM "Project" WHERE id='p-a'`)).rows[0].metadata,sectorUpload={...upload,operationId:randomUUID(),caption:'Synthetic sector changed during upload.'},evidenceCount=(await read(worker)).evidence.length,putsBefore=putCount;
 const changedSectorMedia=createFieldMedia({operations,put:async(...args)=>{const stored=await put(...args);await pool.query(`UPDATE "Project" SET metadata=jsonb_set(metadata,'{fieldOperations,sectors}','[]'::jsonb) WHERE id='p-a'`);return stored;},get,analyzer,environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-private-fixture'})});
 await assert.rejects(changedSectorMedia.attach(worker,sectorUpload),{code:'FIELD_SECTOR_UNAVAILABLE'});assert.equal((await read(worker)).evidence.length,evidenceCount);
 await pool.query(`UPDATE "Project" SET metadata=$1::jsonb WHERE id='p-a'`,[JSON.stringify(siteBefore)]);const sectorRecovered=await media.attach(worker,sectorUpload);assert.equal(sectorRecovered.saved,true);assert.equal(putCount,putsBefore+1);assert.equal((await media.attach(worker,sectorUpload)).replayed,true);
 checks.push('sector-removal-during-private-upload-prevents-orphan-evidence-and-exact-recovery-reuses-confirmed-object');
 const revokedDownload=createFieldMedia({operations,put,get:async pathname=>{await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,status}','"REVOKED"') WHERE id='w-a'`);return get(pathname);},analyzer});
 await assert.rejects(revokedDownload.download(worker,{...context(worker),evidenceId:attached.evidence.id}),{code:'FIELD_EVIDENCE_UNAVAILABLE'});await assert.rejects(operations.save(worker,attendance(worker,'BREAK_START',last.id)),{code:'FIELD_PARTICIPANT_REQUIRED'});
 await assert.rejects(operations.save(worker,uncertain),{code:'FIELD_PARTICIPANT_REQUIRED'});await assert.rejects(operations.status(worker,{...context(worker),operationId:uncertain.operationId}),{code:'FIELD_PARTICIPANT_REQUIRED'});
 checks.push('lost-commit-recovery-audit-failure-rollback-and-participant-revocation');
 const qrPayloads=[],qr=async(s,options={})=>{
  const params=new URLSearchParams({...context(s),sectorId:'sector-main'});
  if(options.token!==undefined)params.set('token',options.token);else params.set('expectedConfigRevision',options.revision??(await read(owner)).configurationRevision);
  return createFieldQrHandler({verify:async()=>s,workspace,toSvg:async payload=>{qrPayloads.push(JSON.parse(payload));return QRCode.toString(payload,{type:'svg',errorCorrectionLevel:'M',margin:4,width:360});}})(new Request('https://obrasaas.com/api/identity/field-qr?'+params));
 };
 const qrSnapshot=async()=>({project:(await pool.query(`SELECT metadata,"updatedAt" FROM "Project" WHERE id='p-a'`)).rows,audit:(await pool.query(`SELECT id,metadata FROM "AuditLog" ORDER BY id`)).rows});
 const currentConfig=(await pool.query(`SELECT metadata->'fieldOperations' AS configuration FROM "Project" WHERE id='p-a'`)).rows[0].configuration,qrBefore=await qrSnapshot();
 assert.equal((await read(owner)).configurationRevision,currentConfig.configRevision);assert.equal((await read(director)).configurationRevision,currentConfig.configRevision);
 assert.equal(Object.hasOwn(await read(otherWorker),'configurationRevision'),false);assert.equal(Object.hasOwn(await read(manager),'configurationRevision'),false);
 for(const s of [owner,director]){const response=await qr(s);assert.equal(response.status,200);assert.match(await response.text(),/<svg/);assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');assert.equal(qrPayloads.at(-1).token,token);}
 assert.equal((await qr(owner,{token})).status,200);
 for(const [s,status] of [[worker,403],[otherWorker,403],[manager,403],[foreign,404]])assert.equal((await qr(s)).status,status);
 assert.deepEqual(await qrSnapshot(),qrBefore);
 assert.ok((await read(owner)).sectors.every(sector=>!Object.hasOwn(sector,'token')&&!Object.hasOwn(sector,'qrHash')));
 checks.push('current-configuration-qr-reprint-cross-actor-private-svg-readonly-snapshot-and-role-tenant-isolation');
 const rotated=await operations.save(owner,command(owner,'CONFIGURE_SITE',{revision:(await read(owner)).projectRevision,sectors:[{id:'sector-main',name:'Synthetic updated sector',latitude:0,longitude:0,radius:100},{id:'sector-extra',name:'Synthetic second sector',latitude:0,longitude:0,radius:100}]}));
 const currentToken=rotated.qrTokens.find(t=>t.sectorId==='sector-main').token,rotatedRevision=(await read(owner)).configurationRevision;assert.notEqual(currentToken,token);assert.notEqual(rotatedRevision,currentConfig.configRevision);
 const renderedBeforeStale=qrPayloads.length;
 assert.equal((await qr(director,{revision:currentConfig.configRevision})).status,409);assert.equal((await qr(owner,{token})).status,422);assert.equal(qrPayloads.length,renderedBeforeStale);
 assert.equal((await qr(director,{revision:rotatedRevision})).status,200);assert.equal(qrPayloads.at(-1).token,currentToken);
 const currentReceipt=(await pool.query('SELECT * FROM "AuditLog" WHERE id=$1',[rotated.receiptId])).rows[0];
 const unavailableQr=async()=>{const before=qrPayloads.length,response=await qr(owner,{revision:rotatedRevision});assert.equal(response.status,409);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_QR_RECEIPT_UNAVAILABLE'});assert.equal(qrPayloads.length,before);};
 const corruptMetadata=structuredClone(currentReceipt.metadata);corruptMetadata.outcome.qrTokens.find(t=>t.sectorId==='sector-extra').token='f'.repeat(64);
 await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1',[rotated.receiptId,JSON.stringify(corruptMetadata)]);await unavailableQr();
 await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1',[rotated.receiptId,JSON.stringify(currentReceipt.metadata)]);
 await pool.query(`UPDATE "AuditLog" SET action='synthetic.quarantined' WHERE id=$1`,[rotated.receiptId]);await unavailableQr();
 await pool.query(`UPDATE "AuditLog" SET action='field.operation.recorded' WHERE id=$1`,[rotated.receiptId]);assert.equal((await qr(owner)).status,200);
 checks.push('observed-qr-configuration-revision-guards-rotation-and-missing-or-corrupt-current-receipts-never-regenerate');
 const collisionId='field_'+digest(['synthetic-same-millisecond']),sentinelId='field_'+digest(['synthetic-bound-sentinel']),staleMetadata=structuredClone(currentReceipt.metadata);
 staleMetadata.outcome.qrTokens[0].token='0'.repeat(64);
 const insertReceipt=async(id,metadata)=>pool.query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'field.operation.recorded','Project',$4,$5::jsonb)`,[id,currentReceipt.organizationId,currentReceipt.actorId,'p-a',JSON.stringify(metadata)]);
 await insertReceipt(collisionId,staleMetadata);assert.equal((await qr(director)).status,200);assert.equal(qrPayloads.at(-1).token,currentToken);
 await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1',[collisionId,JSON.stringify(currentReceipt.metadata)]);await unavailableQr();
 await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb WHERE id=$1',[collisionId,JSON.stringify(staleMetadata)]);await insertReceipt(sentinelId,staleMetadata);await unavailableQr();
 await pool.query('DELETE FROM "AuditLog" WHERE id=ANY($1::text[])',[[collisionId,sentinelId]]);assert.equal((await qr(owner)).status,200);
 checks.push('same-millisecond-configuration-receipts-require-a-unique-full-current-hash-map-with-bounded-ambiguity-denial');
 const beforeRevocation=qrPayloads.length;await pool.query(`UPDATE "TenantMembership" SET status='REVOKED' WHERE id='director-m'`);
 assert.equal((await qr(director)).status,403);assert.equal(qrPayloads.length,beforeRevocation);await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='director-m'`);
 assert.equal((await qr(director)).status,200);assert.equal(qrPayloads.at(-1).token,currentToken);
 checks.push('current-canonical-membership-revocation-denies-durable-qr-despite-a-formerly-valid-session-and-scope');

 // Additive pagination controls use another canonical project and workers, so
 // the original field/media/attendance checks and their counts remain intact.
 const reviewAdaptersBefore={putCount,getCount,providerCalls};
 await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('p-review','company-a','Synthetic review pagination','ACTIVE','{"unrelated":true}'),('p-review-other','company-a','Synthetic other project','ACTIVE','{}');
 INSERT INTO "ProjectMembership" VALUES('manager-review-p','p-review','manager-m','ACTIVE'),('worker-review-p','p-review','worker-m','ACTIVE'),('worker2-review-p','p-review','worker2-m','ACTIVE');
 INSERT INTO "Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata) VALUES('task-review','p-review','Synthetic canonical measured task','BLOCKED',0,'2026-10-01','2026-10-10','{"unrelated":true}');`);
 for(const [id,user] of [['wr-a','user_Worker'],['wr-a2','user_Worker2']])await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") VALUES($1,'p-review',$1,$2,'WORKER',$3::jsonb,clock_timestamp())`,[id,id==='wr-a'?'+5491100004444':'+5491100005555',JSON.stringify({participant:{version:1,clerkUserId:user,status:'ACTIVE',permissions:{attendance:true,report:true},kyc:{version:1,status:'APPROVED'}}})]);
 const reviewContext=s=>({projectId:'p-review',scope:scopes[s.userId]}),reviewCommand=(s,action,payload)=>({...reviewContext(s),operationId:randomUUID(),action,payload});
 const reviewAccessStamps=new Map();
 const reviewInput=(s,reviewSection,reviewFilter='PENDING',extra={})=>({...reviewContext(s),reviewSection,reviewFilter,...(extra.afterReview||extra.reviewId?{reviewAccessStamp:reviewAccessStamps.get(s.userId)}:{}),...extra});
 const reviewPage=async(s,section,filter='PENDING',extra={})=>{if((extra.afterReview||extra.reviewId)&&!reviewAccessStamps.has(s.userId))await reviewPage(s,section);const input=reviewInput(s,section,filter,extra),result=fieldReviewPage(await operations.reviewPage(s,input),input);reviewAccessStamps.set(s.userId,result.reviewAccessStamp);return result;};
 const reviewEvidence={version:1,kind:'EVIDENCE',workerId:'wr-a',taskId:'task-review',sectorId:'review-sector',recordedBy:'worker',capturedAt:'2020-01-01T10:00:00.000Z',media:{kind:'image',contentType:'image/png',bytes:68,sha256:'a'.repeat(64),pathname:'synthetic-private-evidence-path',url:'https://fixture.invalid/private-evidence'},processing:{status:'QUEUED',code:null},review:null};
 const insertReviewEvidence=(id,details,createdAt='2020-01-01',projectId='p-review')=>pool.query(`INSERT INTO "Incident"(id,"projectId",title,description,metadata,"createdAt","updatedAt") VALUES($1,$2,'Synthetic review evidence','Synthetic local caption',$3::jsonb,$4::timestamp,clock_timestamp())`,[id,projectId,JSON.stringify({fieldOperations:details}),createdAt]);
 await insertReviewEvidence('review-old-pending',reviewEvidence);
 await insertReviewEvidence('review-approved-source',{...reviewEvidence,review:{decision:'APPROVE',reason:'Synthetic source approved before proposal',recordedAt:'2020-01-01T11:00:00.000Z'}});
 const initialReviewTask=(await workspace.read(owner,reviewContext(owner))).tasks[0];
 const oldReviewProposal=await operations.save(worker,reviewCommand(worker,'PROPOSE_PROGRESS',{workerId:'wr-a',taskId:'task-review',revision:initialReviewTask.revision,progress:25,quantity:'2.5999',baseline:'10',unit:'M2',reason:'Synthetic precise measured work for old proposal.',evidenceIds:['review-approved-source']}));
 await pool.query(`UPDATE "OperationalProposal" SET "createdAt"='2020-01-01' WHERE id=$1`,[oldReviewProposal.proposal.id]);
 await pool.query(`INSERT INTO "Incident"(id,"projectId",title,description,metadata,"createdAt","updatedAt") SELECT 'review-resolved-'||lpad(n::text,4,'0'),"projectId",title,description,metadata,'2021-01-01',clock_timestamp() FROM "Incident" CROSS JOIN generate_series(1,101) AS n WHERE id='review-approved-source'`);
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-applied-'||lpad(n::text,4,'0'),"projectId","proposedByWorkerId",'account-field','review-applied-'||n,'TASK_PROGRESS','APPLIED',summary,action,precondition,"expiresAt",'2021-01-01',clock_timestamp() FROM "OperationalProposal" CROSS JOIN generate_series(1,101) AS n WHERE id=$1`,[oldReviewProposal.proposal.id]);
 const oldReviewRead=await operations.read(director,reviewContext(director));assert.equal(oldReviewRead.evidence.some(row=>row.id==='review-old-pending'),false);assert.equal(oldReviewRead.proposals.some(row=>row.id===oldReviewProposal.proposal.id),false);assert.equal(oldReviewRead.truncated,true);
 const oldEvidencePage=await reviewPage(director,'EVIDENCE'),oldProgressPage=await reviewPage(director,'PROGRESS');assert.deepEqual(oldEvidencePage.records.map(row=>row.id),['review-old-pending']);assert.deepEqual(oldProgressPage.records.map(row=>row.id),[oldReviewProposal.proposal.id]);assert.equal(oldEvidencePage.total,1);assert.equal(oldProgressPage.total,1);
 reviewPaginationChecks.push('pending-evidence-and-proposal-older-than-101-resolved-rows-remain-actionable-in-canonical-review-pages');

 const readonlyReviewSnapshot=async()=>(await pool.query(`SELECT (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM "Incident" i WHERE "projectId"='p-review') AS evidence,(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM "OperationalProposal" p WHERE "projectId"='p-review') AS proposals,(SELECT to_jsonb(t) FROM "Task" t WHERE id='task-review') AS task,(SELECT count(*)::int FROM "AuditLog") AS audits`)).rows;
 const beforeReviewReads=await readonlyReviewSnapshot();
 for(const section of ['EVIDENCE','PROGRESS']){
  const all=await reviewPage(director,section,'ALL');assert.equal(all.records.length,100);assert.equal(all.nextCursor,all.records.at(-1).id);assert.equal(all.total,section==='EVIDENCE'?103:102);
  const exact=await reviewPage(director,section,'ALL',{reviewId:section==='EVIDENCE'?'review-old-pending':oldReviewProposal.proposal.id});assert.equal(exact.records.length,1);assert.equal(exact.total,1);assert.equal(exact.nextCursor,null);
 }
 const safeEvidence=oldEvidencePage.records[0];assert.deepEqual(Object.keys(safeEvidence.media).sort(),['bytes','contentType','kind','sha256']);assert.equal('recordedBy' in safeEvidence,false);assert.equal(JSON.stringify(oldEvidencePage).includes('synthetic-private-evidence-path'),false);assert.equal(JSON.stringify(oldEvidencePage).includes('fixture.invalid'),false);assert.deepEqual(await readonlyReviewSnapshot(),beforeReviewReads);
 reviewPaginationChecks.push('bounded-all-and-exact-old-record-pages-are-readonly-and-exclude-private-media-path-url-and-actor-metadata');

 await pool.query(`INSERT INTO "Incident"(id,"projectId",title,description,metadata,"createdAt","updatedAt") SELECT 'review-pending-'||lpad(n::text,4,'0'),"projectId",title,description,metadata,'2022-01-01',clock_timestamp() FROM "Incident" CROSS JOIN generate_series(1,201) AS n WHERE id='review-old-pending'`);
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-pending-proposal-'||lpad(n::text,4,'0'),"projectId","proposedByWorkerId",'account-field','review-pending-proposal-'||n,'TASK_PROGRESS','PENDING',summary,jsonb_set(action,'{taskId}','"synthetic-pagination-task"'),precondition,"expiresAt",'2022-01-01',clock_timestamp() FROM "OperationalProposal" CROSS JOIN generate_series(1,201) AS n WHERE id=$1`,[oldReviewProposal.proposal.id]);
 const expectedEvidenceIds=[...Array.from({length:201},(_,n)=>'review-pending-'+String(n+1).padStart(4,'0')).reverse(),'review-old-pending'];
 const expectedProposalIds=[...Array.from({length:201},(_,n)=>'review-pending-proposal-'+String(n+1).padStart(4,'0')).reverse(),oldReviewProposal.proposal.id];
 const firstEvidencePage=await reviewPage(director,'EVIDENCE');assert.equal(firstEvidencePage.total,202);assert.deepEqual(firstEvidencePage.records.map(row=>row.id),expectedEvidenceIds.slice(0,100));
 const firstProgressPage=await reviewPage(director,'PROGRESS');assert.equal(firstProgressPage.total,202);assert.deepEqual(firstProgressPage.records.map(row=>row.id),expectedProposalIds.slice(0,100));
 await insertReviewEvidence('review-inserted-newer',reviewEvidence,'2023-01-01');
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-inserted-proposal',"projectId","proposedByWorkerId",'account-field','review-inserted-proposal','TASK_PROGRESS','PENDING',summary,jsonb_set(action,'{taskId}','"synthetic-pagination-task"'),precondition,"expiresAt",'2023-01-01',clock_timestamp() FROM "OperationalProposal" WHERE id=$1`,[oldReviewProposal.proposal.id]);
 const pagesAfter=async(s,section,first)=>{const result=[...first.records];let cursor=first.nextCursor;while(cursor){const next=await reviewPage(s,section,'PENDING',{afterReview:cursor});result.push(...next.records);cursor=next.nextCursor;}return result;};
 assert.deepEqual((await pagesAfter(director,'EVIDENCE',firstEvidencePage)).map(row=>row.id),expectedEvidenceIds);assert.deepEqual((await pagesAfter(director,'PROGRESS',firstProgressPage)).map(row=>row.id),expectedProposalIds);
 reviewPaginationChecks.push('over-200-pending-evidence-keyset-pages-have-no-duplicates-or-missing-tied-timestamp-rows-after-newer-insert');
 reviewPaginationChecks.push('over-200-pending-progress-keyset-pages-have-no-duplicates-or-missing-tied-timestamp-rows-after-newer-insert');

 await pool.query(`UPDATE "Incident" SET metadata=jsonb_set(metadata,'{fieldOperations,review}',$2::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1`,[firstEvidencePage.nextCursor,JSON.stringify({decision:'APPROVE',reason:'Synthetic concurrent review',recordedAt:new Date().toISOString()})]);
 await pool.query(`UPDATE "OperationalProposal" SET status='APPLIED',"updatedAt"=clock_timestamp() WHERE id=$1`,[firstProgressPage.nextCursor]);
 assert.deepEqual((await pagesAfter(director,'EVIDENCE',firstEvidencePage)).map(row=>row.id),expectedEvidenceIds);assert.deepEqual((await pagesAfter(director,'PROGRESS',firstProgressPage)).map(row=>row.id),expectedProposalIds);
 reviewPaginationChecks.push('cursor-remains-valid-after-concurrent-human-evidence-and-progress-decisions-change-its-pending-status');

 await insertReviewEvidence('review-running',{...reviewEvidence,processing:{status:'RUNNING',operationId:randomUUID(),expiresAt:'2000-01-01T00:00:00.000Z'}},'2024-01-01');
 const running=(await reviewPage(director,'EVIDENCE')).records.find(row=>row.id==='review-running'),beforeRunning=await readonlyReviewSnapshot();assert.equal(running.status,'PENDING');assert.equal(running.review,null);
 await assert.rejects(operations.save(director,reviewCommand(director,'REVIEW_EVIDENCE',{evidenceId:running.id,revision:running.revision,decision:'APPROVE',reason:'Synthetic running processing must not auto approve.'})),{code:'FIELD_MEDIA_PROCESSING'});assert.deepEqual(await readonlyReviewSnapshot(),beforeRunning);
 reviewPaginationChecks.push('running-media-is-human-pending-and-cannot-be-auto-approved-even-after-its-processing-lease-expired');

 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-expired',"projectId","proposedByWorkerId",'account-field','review-expired','TASK_PROGRESS','PENDING',summary,action,precondition,clock_timestamp()-interval '1 second','2024-01-01',clock_timestamp() FROM "OperationalProposal" WHERE id=$1`,[oldReviewProposal.proposal.id]);
 const beforeExpiryRead=await readonlyReviewSnapshot();assert.equal((await reviewPage(director,'PROGRESS')).records.some(row=>row.id==='review-expired'),false);const expiredReview=await reviewPage(director,'PROGRESS','ALL',{reviewId:'review-expired'});assert.equal(expiredReview.records[0].status,'EXPIRED');assert.equal(expiredReview.records[0].statusStored,'PENDING');assert.deepEqual(await readonlyReviewSnapshot(),beforeExpiryRead);
 reviewPaginationChecks.push('database-clock-expired-progress-is-excluded-from-pending-but-exact-all-shows-it-without-expiry-writes');

 await insertReviewEvidence('review-other-worker',{...reviewEvidence,workerId:'wr-a2',recordedBy:'worker2'},'2025-01-01');
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-other-worker-proposal',"projectId",'wr-a2','account-field','review-other-worker-proposal','TASK_PROGRESS','PENDING',summary,jsonb_set(jsonb_set(action,'{workerId}','"wr-a2"'),'{taskId}','"synthetic-pagination-task"'),precondition,"expiresAt",'2025-01-01',clock_timestamp() FROM "OperationalProposal" WHERE id=$1`,[oldReviewProposal.proposal.id]);
 for(const section of ['EVIDENCE','PROGRESS']){
  const own=await reviewPage(worker,section);assert.ok(own.records.every(row=>row.workerId==='wr-a'));assert.equal(own.canReview,false);assert.equal(own.canApproveProgress,false);
  const theirs=await reviewPage(otherWorker,section);assert.deepEqual(theirs.records.map(row=>row.workerId),['wr-a2']);assert.equal(theirs.total,1);
 }
 reviewPaginationChecks.push('auditor-author-sees-only-active-kyc-approved-account-linked-own-worker-records-in-both-sections');
 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='FINANCE' WHERE id='worker-m'`);const financeScope=(await workspace.list(worker)).scope;
 for(const section of ['EVIDENCE','PROGRESS']){const finance=await operations.reviewPage(worker,{...reviewInput(worker,section),scope:financeScope});assert.ok(finance.records.every(row=>row.workerId==='wr-a'));assert.equal(finance.canReview,false);assert.equal(finance.canApproveProgress,false);}
 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR' WHERE id='worker-m'`);
 reviewPaginationChecks.push('finance-role-does-not-gain-review-or-progress-approval-and-keeps-only-its-own-field-history');

 const eligibleWorker=(await pool.query(`SELECT active,metadata FROM "Worker" WHERE id='wr-a'`)).rows[0];
 for(const change of [
  {active:false,metadata:eligibleWorker.metadata},
  {active:true,metadata:{participant:{...eligibleWorker.metadata.participant,status:'REVOKED'}}},
  {active:true,metadata:{participant:{...eligibleWorker.metadata.participant,kyc:{version:1,status:'PENDING_REVIEW'}}}},
  {active:true,metadata:{participant:{...eligibleWorker.metadata.participant,clerkUserId:'user_Worker2'}}},
 ]){
  await pool.query(`UPDATE "Worker" SET active=$1,metadata=$2::jsonb WHERE id='wr-a'`,[change.active,JSON.stringify(change.metadata)]);
  for(const section of ['EVIDENCE','PROGRESS']){const empty=await reviewPage(worker,section);assert.equal(empty.total,0);assert.deepEqual(empty.records,[]);const target=section==='EVIDENCE'?'review-old-pending':oldReviewProposal.proposal.id;await assert.rejects(operations.reviewPage(worker,reviewInput(worker,section,'ALL',{reviewId:target})),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});}
 }
 await pool.query(`UPDATE "Worker" SET active=$1,metadata=$2::jsonb WHERE id='wr-a'`,[eligibleWorker.active,JSON.stringify(eligibleWorker.metadata)]);
 reviewPaginationChecks.push('current-query-participant-kyc-or-account-link-revocation-removes-author-pages-and-denies-exact-record-reference');

 // A remains in an old page while B supplies a still-visible anchor. The
 // membership/project scope is unchanged; only canonical eligibility changed.
 const secondEligibleWorker=(await pool.query(`SELECT active,metadata FROM "Worker" WHERE id='wr-a2'`)).rows[0];
 const linkedSecond={...secondEligibleWorker.metadata,participant:{...secondEligibleWorker.metadata.participant,clerkUserId:worker.userId}};
 await pool.query(`UPDATE "Worker" SET metadata=$1::jsonb WHERE id='wr-a2'`,[JSON.stringify(linkedSecond)]);
 const oldAuthorPage=await reviewPage(worker,'EVIDENCE'),oldAuthorStamp=oldAuthorPage.reviewAccessStamp;
 assert.equal((await operations.read(worker,reviewContext(worker))).reviewAccessStamp,oldAuthorStamp);
 const eligibilityBefore=await readonlyReviewSnapshot();
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"PENDING_REVIEW"') WHERE id='wr-a'`);
 const revokedSnapshot=await readonlyReviewSnapshot(),currentAuthorPage=await reviewPage(worker,'EVIDENCE'),currentBase=await operations.read(worker,reviewContext(worker));
 assert.equal(currentAuthorPage.scope,oldAuthorPage.scope);assert.notEqual(currentAuthorPage.reviewAccessStamp,oldAuthorStamp);assert.equal(currentAuthorPage.reviewAccessStamp,currentBase.reviewAccessStamp);assert.deepEqual(currentAuthorPage.records.map(row=>row.workerId),['wr-a2']);assert.deepEqual(currentBase.selfWorkers.map(row=>row.id),['wr-a2']);
 for(const section of ['EVIDENCE','PROGRESS'])for(const extra of [{afterReview:section==='EVIDENCE'?'review-other-worker':'review-other-worker-proposal'},{reviewId:section==='EVIDENCE'?'review-old-pending':oldReviewProposal.proposal.id}])await assert.rejects(operations.reviewPage(worker,reviewInput(worker,section,extra.reviewId?'ALL':'PENDING',{...extra,reviewAccessStamp:oldAuthorStamp})),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 await assert.rejects(operations.reviewPage(worker,reviewInput(worker,'EVIDENCE','ALL',{reviewId:'review-old-pending'})),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});
 assert.equal((await reviewPage(worker,'EVIDENCE','ALL',{reviewId:'review-other-worker'})).records[0].workerId,'wr-a2');assert.deepEqual(await readonlyReviewSnapshot(),revokedSnapshot);
 reviewPaginationChecks.push('eligibility-stamp-clears-old-two-worker-context-before-visible-other-worker-cursor-or-selected-record-recheck-with-zero-read-writes');

 for(const permission of ['report','attendance']){
  const before=(await reviewPage(worker,'EVIDENCE')).reviewAccessStamp;
  await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,$1::text[],'false') WHERE id='wr-a2'`,[['participant','permissions',permission]]);
  const now=await reviewPage(worker,'EVIDENCE'),base=await operations.read(worker,reviewContext(worker));assert.notEqual(now.reviewAccessStamp,before);assert.equal(base.reviewAccessStamp,now.reviewAccessStamp);assert.equal(base.selfWorkers[0][permission==='report'?'canReport':'canAttendance'],false);
  await assert.rejects(operations.reviewPage(worker,reviewInput(worker,'EVIDENCE','PENDING',{afterReview:'review-other-worker',reviewAccessStamp:before})),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 }
 reviewPaginationChecks.push('self-worker-report-and-attendance-permission-flags-change-only-opaque-review-eligibility-stamp-and-deny-stale-continuation');
 await pool.query(`UPDATE "Worker" SET metadata=$1::jsonb WHERE id='wr-a'`,[JSON.stringify(eligibleWorker.metadata)]);
 await pool.query(`UPDATE "Worker" SET active=$1,metadata=$2::jsonb WHERE id='wr-a2'`,[secondEligibleWorker.active,JSON.stringify(secondEligibleWorker.metadata)]);
 await reviewPage(worker,'EVIDENCE');assert.deepEqual(await readonlyReviewSnapshot(),eligibilityBefore);

 const beforeMissingStamp=await readonlyReviewSnapshot();
 for(const section of ['EVIDENCE','PROGRESS'])for(const selector of ['afterReview','reviewId'])for(const stamp of [undefined,'bad']){
  const input={...reviewContext(worker),reviewSection:section,reviewFilter:selector==='reviewId'?'ALL':'PENDING',[selector]:'review-old-pending',...(stamp===undefined?{}:{reviewAccessStamp:stamp})};
  assert.throws(()=>operations.reviewPage(worker,input),{code:'FIELD_QUERY_INVALID',status:400});
 }
 assert.deepEqual(await readonlyReviewSnapshot(),beforeMissingStamp);
 reviewPaginationChecks.push('missing-or-malformed-eligibility-stamp-cannot-authorize-cursor-or-exact-recheck-and-never-writes');

 const beforeDisplayLimit=await readonlyReviewSnapshot();
 await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") SELECT 'review-stamp-extra-'||lpad(n::text,3,'0'),'p-review','Synthetic extra eligible worker','synthetic-stamp-phone-'||n,'WORKER',$1::jsonb,clock_timestamp() FROM generate_series(1,102) AS n`,[JSON.stringify(eligibleWorker.metadata)]);
 const boundedBase=await operations.read(worker,reviewContext(worker)),unboundedStampPage=await reviewPage(worker,'EVIDENCE');assert.equal(boundedBase.selfWorkers.length,101);assert.equal(boundedBase.selfWorkers.some(w=>w.id==='wr-a'),false);assert.equal(boundedBase.reviewAccessStamp,unboundedStampPage.reviewAccessStamp);
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,permissions,report}','false') WHERE id='wr-a'`);
 const afterBeyondDisplay=await operations.read(worker,reviewContext(worker));assert.deepEqual(afterBeyondDisplay.selfWorkers,boundedBase.selfWorkers);assert.notEqual(afterBeyondDisplay.reviewAccessStamp,boundedBase.reviewAccessStamp);
 await assert.rejects(operations.reviewPage(worker,reviewInput(worker,'EVIDENCE','PENDING',{afterReview:'review-old-pending',reviewAccessStamp:boundedBase.reviewAccessStamp})),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
 await pool.query(`UPDATE "Worker" SET metadata=$1::jsonb WHERE id='wr-a'`,[JSON.stringify(eligibleWorker.metadata)]);
 await pool.query(`DELETE FROM "Worker" WHERE "projectId"='p-review' AND id LIKE 'review-stamp-extra-%'`);
 await reviewPage(worker,'EVIDENCE');assert.deepEqual(await readonlyReviewSnapshot(),beforeDisplayLimit);
 reviewPaginationChecks.push('eligibility-stamp-includes-own-workers-and-permissions-beyond-101-display-rows-without-expanding-base-display-or-writing-operations');

 for(const s of [owner,director,manager])for(const section of ['EVIDENCE','PROGRESS']){const responsible=await reviewPage(s,section);assert.equal(responsible.canReview,true);assert.equal(responsible.canApproveProgress,s!==manager);assert.ok(responsible.records.some(row=>row.workerId==='wr-a2'));}
 reviewPaginationChecks.push('admin-director-and-site-manager-see-all-project-review-records-with-current-approval-capability-and-no-worker-required');
 const beforeContextDenials=await readonlyReviewSnapshot();
 for(const section of ['EVIDENCE','PROGRESS']){
  await assert.rejects(operations.reviewPage(worker,{...reviewInput(worker,section),scope:scopes[director.userId]}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});
  await assert.rejects(operations.reviewPage(foreign,{...reviewInput(foreign,section),scope:scopes[foreign.userId]}),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});
  await assert.rejects(operations.reviewPage(director,{...reviewInput(director,section),projectId:'p-b'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});
  await assert.rejects(operations.reviewPage(worker,{...reviewInput(worker,section),projectId:'p-review-other'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});
 }
 assert.deepEqual(await readonlyReviewSnapshot(),beforeContextDenials);
 reviewPaginationChecks.push('stale-actor-scope-cross-company-and-unassigned-project-denials-use-canonical-current-project-guard-with-zero-writes');
 await pool.query(`UPDATE "ProjectMembership" SET status='REVOKED' WHERE id='worker-review-p'`);await assert.rejects(operations.reviewPage(worker,reviewInput(worker,'EVIDENCE')),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});await pool.query(`UPDATE "ProjectMembership" SET status='ACTIVE' WHERE id='worker-review-p'`);
 await pool.query(`UPDATE "TenantMembership" SET status='REVOKED' WHERE id='director-m'`);await assert.rejects(operations.reviewPage(director,reviewInput(director,'PROGRESS')),{code:'WORKSPACE_MEMBERSHIP_REQUIRED',status:403});await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='director-m'`);
 await pool.query(`UPDATE "Project" SET status='ARCHIVED' WHERE id='p-review'`);await assert.rejects(operations.reviewPage(owner,reviewInput(owner,'EVIDENCE')),{code:'WORKSPACE_PROJECT_UNAVAILABLE',status:404});await pool.query(`UPDATE "Project" SET status='ACTIVE' WHERE id='p-review'`);
 reviewPaginationChecks.push('project-assignment-membership-and-project-status-revocation-deny-formerly-authorized-review-pages');

 await insertReviewEvidence('review-foreign-project',reviewEvidence,'2026-01-01','p-review-other');
 await insertReviewEvidence('review-wrong-kind',{...reviewEvidence,kind:'REPORT'},'2026-01-01');
 await insertReviewEvidence('review-wrong-version',{...reviewEvidence,version:0},'2026-01-01');
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-foreign-proposal','p-review-other',"proposedByWorkerId",'account-field','review-foreign-proposal','TASK_PROGRESS','PENDING',summary,action,precondition,"expiresAt",'2026-01-01',clock_timestamp() FROM "OperationalProposal" WHERE id=$1`,[oldReviewProposal.proposal.id]);
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","createdAt","updatedAt") SELECT 'review-other-engine',"projectId","proposedByWorkerId",'other-engine','review-other-engine','TASK_PROGRESS','PENDING',summary,action,precondition,"expiresAt",'2026-01-01',clock_timestamp() FROM "OperationalProposal" WHERE id=$1`,[oldReviewProposal.proposal.id]);
 const beforeCursorDenials=await readonlyReviewSnapshot();
 for(const section of ['EVIDENCE','PROGRESS'])for(const selector of ['afterReview','reviewId']){
  const filter=selector==='reviewId'?'ALL':'PENDING';
  for(const id of section==='EVIDENCE'?['unknown-evidence','review-foreign-project','review-wrong-kind','review-wrong-version']:['unknown-proposal','review-foreign-proposal','review-other-engine','review-old-pending'])await assert.rejects(operations.reviewPage(director,reviewInput(director,section,filter,{[selector]:id})),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});
  await assert.rejects(operations.reviewPage(worker,reviewInput(worker,section,filter,{[selector]:section==='EVIDENCE'?'review-other-worker':'review-other-worker-proposal'})),{code:'FIELD_REVIEW_CURSOR_UNAVAILABLE',status:404});
 }
 assert.deepEqual(await readonlyReviewSnapshot(),beforeCursorDenials);
 reviewPaginationChecks.push('unknown-cross-project-other-owner-other-section-kind-version-and-engine-cursors-and-exact-targets-fail-private-404');
 const fieldHttp=createFieldHandlers({verify:async()=>director,operations}),reviewRequest=input=>new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams(input));
 for(const input of [{...reviewInput(director,'EVIDENCE'),afterReview:'review-old-pending',reviewId:'review-other-worker'}, {...reviewInput(director,'EVIDENCE'),reviewId:'review-old-pending'}, {...reviewInput(director,'EVIDENCE'),operationId:randomUUID()}]){const response=await fieldHttp.GET(reviewRequest(input));assert.equal(response.status,400);assert.equal((await response.json()).code,'FIELD_QUERY_INVALID');}
 const httpPending=await fieldHttp.GET(reviewRequest(reviewInput(director,'PROGRESS')));assert.equal(httpPending.status,200);fieldReviewPage(await httpPending.json(),reviewInput(director,'PROGRESS'));assert.equal(httpPending.headers.get('cache-control'),'private, no-store, max-age=0');
 reviewPaginationChecks.push('real-http-dispatch-validates-exclusive-review-query-and-returns-private-canonical-page');

 const oldActionableEvidence=(await reviewPage(director,'EVIDENCE','ALL',{reviewId:'review-old-pending'})).records[0],beforeDeniedEvidence=await readonlyReviewSnapshot();
 await assert.rejects(operations.save(worker,reviewCommand(worker,'REVIEW_EVIDENCE',{evidenceId:oldActionableEvidence.id,revision:oldActionableEvidence.revision,decision:'APPROVE',reason:'Synthetic author cannot decide evidence.'})),{code:'FIELD_PERMISSION_REQUIRED',status:403});assert.deepEqual(await readonlyReviewSnapshot(),beforeDeniedEvidence);
 const oldEvidenceApproved=await operations.save(director,reviewCommand(director,'REVIEW_EVIDENCE',{evidenceId:oldActionableEvidence.id,revision:oldActionableEvidence.revision,decision:'APPROVE',reason:'Synthetic human review of old paginated evidence.'}));assert.equal(oldEvidenceApproved.evidence.status,'APPROVED');assert.equal((await reviewPage(director,'EVIDENCE','ALL',{reviewId:oldActionableEvidence.id})).records[0].status,'APPROVED');assert.equal((await workspace.read(owner,reviewContext(owner))).tasks[0].progress,0);
 reviewPaginationChecks.push('old-evidence-exact-page-uses-existing-human-review-engine-and-author-denial-never-changes-task');
 const oldActionableProposal=(await reviewPage(director,'PROGRESS','ALL',{reviewId:oldReviewProposal.proposal.id})).records[0],oldProposalDecision=reviewCommand(director,'DECIDE_PROGRESS',{proposalId:oldActionableProposal.id,revision:oldActionableProposal.revision,decision:'APPROVE',reason:'Synthetic director approves old exact measured advance.'}),beforeDeniedProgress=await readonlyReviewSnapshot();
 await assert.rejects(operations.save(manager,{...oldProposalDecision,...reviewContext(manager),operationId:randomUUID()}),{code:'FIELD_PROGRESS_PERMISSION_REQUIRED',status:403});assert.deepEqual(await readonlyReviewSnapshot(),beforeDeniedProgress);
 reviewPaginationChecks.push('site-manager-can-read-old-progress-but-current-capability-denies-decision-with-zero-canonical-writes');
 await assert.rejects(createFieldOperations({workspace:failApprovalWorkspace}).save(director,oldProposalDecision),{code:'WORKSPACE_OPERATION_UNCONFIRMED',status:503});assert.deepEqual(await readonlyReviewSnapshot(),beforeDeniedProgress);assert.equal((await reviewPage(director,'PROGRESS','ALL',{reviewId:oldActionableProposal.id})).records[0].status,'PENDING');
 reviewPaginationChecks.push('old-proposal-approval-audit-failure-rolls-back-task-measurement-proposal-and-receipt-through-existing-engine');
 await assert.rejects(ambiguous.save(director,oldProposalDecision),{code:'WORKSPACE_OPERATION_UNCONFIRMED',status:503});
 const recoveredReviewDecision=await operations.status(director,{...reviewContext(director),operationId:oldProposalDecision.operationId});assert.equal(recoveredReviewDecision.saved,true);assert.equal(recoveredReviewDecision.task.progress,25);
 const beforeReviewReplay=await readonlyReviewSnapshot(),oldReviewReplay=await operations.save(director,oldProposalDecision);assert.equal(oldReviewReplay.replayed,true);assert.equal(oldReviewReplay.task.progress,25);assert.deepEqual(await readonlyReviewSnapshot(),beforeReviewReplay);assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE id=$1`,[recoveredReviewDecision.receiptId])).rows[0].n,1);
 const persistedReviewTask=(await pool.query(`SELECT progress,status,metadata,"startsAt","endsAt" FROM "Task" WHERE id='task-review'`)).rows[0];assert.equal(persistedReviewTask.metadata.fieldOperations.quantity.executed,'2.5999');assert.equal(persistedReviewTask.metadata.fieldOperations.quantity.baseline,'10.0000');assert.equal(persistedReviewTask.metadata.unrelated,true);assert.equal(persistedReviewTask.status,'BLOCKED');assert.equal(persistedReviewTask.startsAt.toISOString().slice(0,10),'2026-10-01');assert.equal(persistedReviewTask.endsAt.toISOString().slice(0,10),'2026-10-10');assert.equal((await reviewPage(director,'PROGRESS','ALL',{reviewId:oldActionableProposal.id})).records[0].status,'APPLIED');
 reviewPaginationChecks.push('old-quantity-approval-lost-ack-get-and-exact-replay-update-canonical-task-once-preserving-four-decimals-dates-metadata-and-independent-blocker');
 const taskBeforeRejectedReview=(await workspace.read(owner,reviewContext(owner))).tasks[0],nextReviewProposal=await operations.save(worker,reviewCommand(worker,'PROPOSE_PROGRESS',{workerId:'wr-a',taskId:'task-review',revision:taskBeforeRejectedReview.revision,progress:30,quantity:'3',baseline:'10',unit:'M2',reason:'Synthetic follow up advance needs human review.',evidenceIds:['review-approved-source']}));
 const selectedForRejection=(await reviewPage(director,'PROGRESS','ALL',{reviewId:nextReviewProposal.proposal.id})).records[0];await operations.save(director,reviewCommand(director,'DECIDE_PROGRESS',{proposalId:selectedForRejection.id,revision:selectedForRejection.revision,decision:'REJECT',reason:'Synthetic reviewer rejected additional measured work.'}));assert.deepEqual((await workspace.read(owner,reviewContext(owner))).tasks[0],taskBeforeRejectedReview);assert.equal((await reviewPage(director,'PROGRESS','ALL',{reviewId:selectedForRejection.id})).records[0].status,'REJECTED');
 reviewPaginationChecks.push('exact-selected-proposal-rejection-preserves-approved-task-and-remains-in-all-history');
 await reviewPage(director,'EVIDENCE');await reviewPage(director,'PROGRESS');assert.deepEqual({putCount,getCount,providerCalls},reviewAdaptersBefore);
 reviewPaginationChecks.push('review-page-navigation-and-decisions-use-no-media-storage-or-ai-provider-calls');
 // A real readonly transaction crosses this proposal's deadline between its
 // rows query and count query. Both must describe the same transaction snapshot.
 await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('p-review-clock','company-a','Synthetic review clock boundary','ACTIVE','{}');
 INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") SELECT 'wr-clock','p-review-clock','Synthetic clock author','+5491100006666',role,metadata,clock_timestamp() FROM "Worker" WHERE id='wr-a';
 INSERT INTO "Task"(id,"projectId",title,status,progress,metadata) VALUES('task-review-clock','p-review-clock','Synthetic clock task','BACKLOG',0,'{}');`);
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId","proposedByWorkerId","sourceProvider","sourceExternalId",type,status,summary,action,precondition,"expiresAt","updatedAt") SELECT 'review-clock-proposal','p-review-clock','wr-clock','account-field','review-clock-proposal','TASK_PROGRESS','PENDING',summary,jsonb_set(jsonb_set(action,'{workerId}','"wr-clock"'),'{taskId}','"task-review-clock"'),precondition,clock_timestamp()+interval '4 seconds',clock_timestamp() FROM "OperationalProposal" WHERE id=$1`,[oldReviewProposal.proposal.id]);
 const clockBoundarySnapshot=async()=>(await pool.query(`SELECT (SELECT to_jsonb(p) FROM "OperationalProposal" p WHERE id='review-clock-proposal') AS proposal,(SELECT to_jsonb(t) FROM "Task" t WHERE id='task-review-clock') AS task,(SELECT count(*)::int FROM "AuditLog") AS audits`)).rows;
 const beforeClockBoundary=await clockBoundarySnapshot();let boundaryRowsSelected=false,boundaryCountDelayed=false,boundaryExpiresAt,boundaryTransactionAt;
 const clockBoundaryWorkspace=createWorkspaceStore({connect:async()=>{
  const client=await pool.connect();return {release:bad=>client.release(bad),query:async(sql,args)=>{
   if(args?.[0]==='p-review-clock'&&sql.startsWith('SELECT count(*)::int AS total FROM public."OperationalProposal"')){
    assert.equal(boundaryRowsSelected,true);
    await client.query(`SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.1)`,[boundaryExpiresAt.toISOString()]);
    const afterWait=(await client.query('SELECT clock_timestamp() AS now,transaction_timestamp() AS snapshot')).rows[0];assert.ok(afterWait.now>=boundaryExpiresAt);assert.equal(afterWait.snapshot.toISOString(),boundaryTransactionAt.toISOString());boundaryCountDelayed=true;
   }
   const result=await client.query(sql,args);
   if(args?.[0]==='p-review-clock'&&sql.startsWith('SELECT id,summary,status::text')&&sql.includes('LIMIT 101')){
    assert.deepEqual(result.rows.map(row=>row.id),['review-clock-proposal']);assert.equal(result.rows[0].expired,false);boundaryExpiresAt=result.rows[0].expiresAt;
    const beforeWait=(await client.query('SELECT clock_timestamp() AS now,transaction_timestamp() AS snapshot')).rows[0];assert.ok(boundaryExpiresAt>beforeWait.now);boundaryTransactionAt=beforeWait.snapshot;boundaryRowsSelected=true;
   }
   return result;
  }};
 }});
 const boundaryInput={...reviewInput(director,'PROGRESS'),projectId:'p-review-clock'},boundaryPage=fieldReviewPage(await createFieldOperations({workspace:clockBoundaryWorkspace}).reviewPage(director,boundaryInput),boundaryInput);
 assert.equal(boundaryRowsSelected,true);assert.equal(boundaryCountDelayed,true);assert.equal(boundaryPage.records.length,1);assert.equal(boundaryPage.records[0].status,'PENDING');assert.equal(boundaryPage.total,1);assert.equal(boundaryPage.nextCursor,null);assert.deepEqual(await clockBoundarySnapshot(),beforeClockBoundary);
 const afterClockBoundary=await operations.reviewPage(director,boundaryInput);assert.deepEqual(afterClockBoundary.records,[]);assert.equal(afterClockBoundary.total,0);assert.deepEqual(await clockBoundarySnapshot(),beforeClockBoundary);assert.deepEqual({putCount,getCount,providerCalls},reviewAdaptersBefore);
 reviewPaginationChecks.push('proposal-expiring-between-select-and-count-remains-coherent-in-one-readonly-database-clock-snapshot-and-next-transaction-excludes-it-with-zero-writes');
 assert.equal(checks.length,19);assert.equal(reviewPaginationChecks.length,26);

 // These additive voice controls use another project, worker and fake media
 // adapters. None of the previous 45 controls or their counters are replaced.
 await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('p-voice','company-a','Synthetic voice progress','ACTIVE','{"unrelated":true}');
 INSERT INTO "ProjectMembership" VALUES('worker-voice-p','p-voice','worker-m','ACTIVE');
 INSERT INTO "Task"(id,"projectId",title,status,progress,"startsAt","endsAt",metadata) VALUES('task-voice','p-voice','Synthetic voice measured task','BACKLOG',0,'2026-10-01','2026-10-10','{"unrelated":true}');`);
 await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,metadata,"updatedAt") VALUES('wv-a','p-voice','Synthetic voice author','+5491100007777','WORKER',$1::jsonb,clock_timestamp())`,[JSON.stringify({participant:{version:1,clerkUserId:'user_Worker',status:'ACTIVE',permissions:{attendance:true,report:true},kyc:{version:1,status:'APPROVED'}}})]);
 const voiceContext=s=>({projectId:'p-voice',scope:scopes[s.userId]}),voiceCommand=(s,action,payload,extra={})=>({...voiceContext(s),operationId:randomUUID(),action,payload,...extra});
 await operations.save(owner,voiceCommand(owner,'CONFIGURE_SITE',{revision:(await operations.read(owner,voiceContext(owner))).projectRevision,sectors:[{id:'voice-sector',name:'Synthetic voice sector',latitude:0,longitude:0,radius:100}]}));
 const voiceTask=(await workspace.read(owner,voiceContext(owner))).tasks.find(t=>t.id==='task-voice'),voiceTaskState=async()=>(await pool.query(`SELECT to_jsonb(t) AS task FROM "Task" t WHERE id='task-voice'`)).rows[0].task,voiceTaskBefore=await voiceTaskState();
 const voiceObjects=new Map(),voiceAdapterCalls={uploads:0,privateReads:0,transcriptions:0},voiceTranscript='Ejecute\u0301 en total 2,5999 metros cuadrados de revoque.';
 const voiceMedia=createFieldMedia({operations,
  put:async(pathname,bytes,options)=>{assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);assert.equal(voiceObjects.has(pathname),false);voiceAdapterCalls.uploads++;voiceObjects.set(pathname,{bytes:Buffer.from(bytes),contentType:options.contentType});return {url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname};},
  get:async pathname=>{voiceAdapterCalls.privateReads++;const object=voiceObjects.get(pathname);return object?{statusCode:200,blob:{url:'https://fixture.private.blob.vercel-storage.com/'+pathname,pathname,size:object.bytes.length,contentType:object.contentType},stream:new ReadableStream({start(controller){controller.enqueue(object.bytes);controller.close();}})}:null;},
  analyzer:{transcribeAudio:async()=>{voiceAdapterCalls.transcriptions++;return {success:true,status:'TRANSCRIBED_UNREVIEWED',text:voiceTranscript,speakerVerified:false,identityVerified:false,attendanceRegistered:false,requiresHumanReview:true};},analyzePhoto:async()=>assert.fail('Voice fixture cannot analyze a photo'),analyzeVideo:async()=>assert.fail('Voice fixture cannot analyze a video')},
  environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-private-fixture'})});
 const voiceAttached=await voiceMedia.attach(worker,{...voiceContext(worker),operationId:randomUUID(),workerId:'wv-a',taskId:'task-voice',sectorId:'voice-sector',caption:'Synthetic audio only; original must be independently reviewed.',media:decodeFieldMedia(wav,'audio/wav')}),voiceProcessInput={...voiceContext(worker),operationId:randomUUID(),evidenceId:voiceAttached.evidence.id,revision:voiceAttached.evidence.revision,analysisConsent:fieldMediaAnalysisConsent(true)};
 const voiceAdapterAfterAttach={...voiceAdapterCalls};assert.deepEqual(voiceAdapterAfterAttach,{uploads:1,privateReads:2,transcriptions:0});
 const voiceState=async()=>(await pool.query(`SELECT (SELECT to_jsonb(t) FROM "Task" t WHERE id='task-voice') AS task,(SELECT to_jsonb(i) FROM "Incident" i WHERE id=$1) AS evidence,(SELECT count(*)::int FROM "OperationalProposal" WHERE "projectId"='p-voice') AS proposals,(SELECT count(*)::int FROM "AuditLog") AS audits`,[voiceAttached.evidence.id])).rows;
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"PENDING_REVIEW"') WHERE id='wv-a'`);
 const voiceBeforeDeniedProcess=await voiceState(),voiceAdaptersBeforeDeniedProcess={...voiceAdapterCalls};
 await assert.rejects(voiceMedia.process(worker,voiceProcessInput),{code:'FIELD_KYC_REVIEW_REQUIRED',status:403});assert.deepEqual(await voiceState(),voiceBeforeDeniedProcess);assert.deepEqual(voiceAdapterCalls,voiceAdaptersBeforeDeniedProcess);
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"APPROVED"') WHERE id='wv-a'`);
 const voiceProcessed=await voiceMedia.process(worker,voiceProcessInput),voiceDraft=voiceProcessed.evidence.processing.result.progressDraft;
 const voiceAdapterAfterProcess={...voiceAdapterCalls};assert.deepEqual(voiceAdapterAfterProcess,{uploads:1,privateReads:3,transcriptions:1});
 assert.equal(voiceProcessed.evidence.status,'PENDING');assert.equal(voiceProcessed.evidence.processing.status,'TRANSCRIBED_UNREVIEWED');assert.equal(voiceDraft.humanReviewRequired,true);assert.equal(voiceDraft.quantity,'2.5999');assert.equal(voiceDraft.unit,'M2');assert.equal(voiceDraft.quantitySemantics,'ACUMULADA');assert.equal(voiceDraft.progress,null);assert.equal(voiceDraft.baseline,null);assert.equal(voiceDraft.task.id,voiceTask.id);assert.equal(voiceDraft.task.revision,voiceTask.revision);
 assert.deepEqual(voiceDraft.source,{evidenceId:voiceAttached.evidence.id,evidenceRevision:voiceAttached.evidence.revision,mediaSha256:createHash('sha256').update(wav).digest('hex'),transcriptSha256:createHash('sha256').update(voiceTranscript.trim(),'utf8').digest('hex')});assert.equal(voiceTranscript.includes(voiceDraft.quantityQuote),true);assert.equal(voiceDraft.quantityQuote,'2,5999 metros cuadrados');assert.equal(voiceDraft.activity,'revoque');
 const voiceBeforeProcessReplay=await voiceState(),voiceProcessReplay=await voiceMedia.process(worker,voiceProcessInput);assert.equal(voiceProcessReplay.replayed,true);assert.equal(voiceProcessReplay.receiptId,voiceProcessed.receiptId);assert.deepEqual(await voiceState(),voiceBeforeProcessReplay);assert.deepEqual(voiceAdapterCalls,voiceAdapterAfterProcess);assert.deepEqual(await voiceTaskState(),voiceTaskBefore);assert.equal(voiceBeforeProcessReplay[0].proposals,0);
 voiceProgressChecks.push('voice-audio-current-kyc-denial-and-exact-process-replay-use-one-synthetic-transcription-with-source-digests-four-decimals-and-zero-task-or-proposal-writes');

 assert.throws(()=>prepareVoiceProgressDraft(voiceProcessed.evidence,voiceTask,'wv-a'),/revisión aprobada/);
 const voiceEvidenceReview={evidenceId:voiceProcessed.evidence.id,revision:voiceProcessed.evidence.revision,decision:'APPROVE',reason:'Synthetic reviewer checked the original private audio.'},voiceBeforeMakerReview=await voiceState();
 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE id='worker-m'`);
 const voiceMakerScope=(await workspace.list(worker)).scope;
 await assert.rejects(operations.save(worker,voiceCommand(worker,'REVIEW_EVIDENCE',voiceEvidenceReview,{scope:voiceMakerScope})),{code:'FIELD_MAKER_CHECKER_REQUIRED',status:403});
 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR' WHERE id='worker-m'`);assert.deepEqual(await voiceState(),voiceBeforeMakerReview);
 const voiceApproved=await operations.save(owner,voiceCommand(owner,'REVIEW_EVIDENCE',voiceEvidenceReview)),voicePrepared=prepareVoiceProgressDraft(voiceApproved.evidence,voiceTask,'wv-a');
 assert.equal(voiceApproved.evidence.status,'APPROVED');assert.equal((await pool.query(`SELECT metadata->'fieldOperations'->'review'->>'actorId' AS reviewer FROM "Incident" WHERE id=$1`,[voiceApproved.evidence.id])).rows[0].reviewer,'owner');assert.equal(voicePrepared.payload.quantity,'2.5999');assert.equal(voicePrepared.payload.unit,'M2');assert.equal(voicePrepared.payload.progress,'');assert.equal(voicePrepared.payload.baseline,'');assert.equal(voicePrepared.sourceVoice.confirmed,false);assert.equal(voiceProgressDraftReady(voicePrepared.sourceVoice,voiceApproved.evidence,voiceTask,voicePrepared.payload.evidenceIds),false);assert.equal(voiceProgressDraftReady({...voicePrepared.sourceVoice,confirmed:true},voiceApproved.evidence,voiceTask,voicePrepared.payload.evidenceIds),true);assert.deepEqual(await voiceTaskState(),voiceTaskBefore);
 const voiceProposeInput=voiceCommand(worker,'PROPOSE_PROGRESS',{...voicePrepared.payload,revision:voicePrepared.sourceVoice.taskRevision,progress:25,baseline:'10.0000'});
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"PENDING_REVIEW"') WHERE id='wv-a'`);const voiceBeforeDeniedPropose=await voiceState();
 await assert.rejects(operations.save(worker,voiceProposeInput),{code:'FIELD_KYC_REVIEW_REQUIRED',status:403});assert.deepEqual(await voiceState(),voiceBeforeDeniedPropose);assert.deepEqual(voiceAdapterCalls,{uploads:1,privateReads:3,transcriptions:1});
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"APPROVED"') WHERE id='wv-a'`);
 voiceProgressChecks.push('voice-approved-evidence-requires-independent-maker-checker-review-and-human-preparation-with-current-kyc-before-existing-progress-proposal');

 const voiceProposed=await operations.save(worker,voiceProposeInput);assert.equal(voiceProposed.taskUnchanged,true);assert.equal(voiceProposed.proposal.status,'PENDING');assert.deepEqual(voiceProposed.proposal.evidenceIds,[voiceApproved.evidence.id]);assert.deepEqual(await voiceTaskState(),voiceTaskBefore);
 const voiceDecision=voiceCommand(owner,'DECIDE_PROGRESS',{proposalId:voiceProposed.proposal.id,revision:voiceProposed.proposal.revision,decision:'APPROVE',reason:'Synthetic owner independently verified accumulated work and base.'});
 // Change only the controlled fixture revision, then restore its exact six
 // decimals after denials so this same proposal can exercise successful CAS.
 await pool.query(`UPDATE "Task" SET "updatedAt"="updatedAt"+interval '1 second' WHERE id='task-voice'`);
 const voiceChangedTask=(await workspace.read(owner,voiceContext(owner))).tasks.find(t=>t.id==='task-voice'),voiceBeforeRevisionDenials=await voiceState();
 assert.notEqual(voiceChangedTask.revision,voiceTask.revision);assert.throws(()=>prepareVoiceProgressDraft(voiceApproved.evidence,voiceChangedTask,'wv-a'),/La tarea cambió/);assert.equal(voiceProgressDraftReady({...voicePrepared.sourceVoice,confirmed:true},voiceApproved.evidence,voiceChangedTask,voicePrepared.payload.evidenceIds),false);
 await assert.rejects(operations.save(worker,{...voiceProposeInput,operationId:randomUUID()}),{code:'FIELD_REVISION_CHANGED',status:409});await assert.rejects(operations.save(owner,voiceDecision),{code:'FIELD_REVISION_CHANGED',status:409});assert.deepEqual(await voiceState(),voiceBeforeRevisionDenials);
 await pool.query(`UPDATE "Task" SET "updatedAt"=$1::timestamp WHERE id='task-voice'`,[voiceTask.revision]);assert.deepEqual(await voiceTaskState(),voiceTaskBefore);
 voiceProgressChecks.push('voice-human-proposal-keeps-task-intact-and-current-task-changes-deny-draft-new-propose-and-canonical-decision-cas-with-zero-receipts');

 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE id='worker-m'`);const voiceProposalMakerScope=(await workspace.list(worker)).scope,voiceBeforeMakerDecision=await voiceState();
 await assert.rejects(operations.save(worker,{...voiceDecision,...voiceContext(worker),scope:voiceProposalMakerScope,operationId:randomUUID()}),{code:'FIELD_MAKER_CHECKER_REQUIRED',status:403});
 await pool.query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR' WHERE id='worker-m'`);assert.deepEqual(await voiceState(),voiceBeforeMakerDecision);
 const voiceDecisions=await Promise.all([operations.save(owner,voiceDecision),operations.save(owner,voiceDecision)]);assert.equal(voiceDecisions.filter(result=>!result.replayed).length,1);assert.ok(voiceDecisions.every(result=>result.task.progress===25));
 const voicePersisted=(await pool.query(`SELECT progress,status,metadata,"startsAt","endsAt" FROM "Task" WHERE id='task-voice'`)).rows[0];assert.equal(voicePersisted.progress,25);assert.equal(voicePersisted.status,'IN_PROGRESS');assert.equal(voicePersisted.metadata.unrelated,true);assert.deepEqual(voicePersisted.metadata.fieldOperations.quantity,{executed:'2.5999',baseline:'10.0000',unit:'M2'});assert.equal(voicePersisted.startsAt.toISOString().slice(0,10),'2026-10-01');assert.equal(voicePersisted.endsAt.toISOString().slice(0,10),'2026-10-10');assert.equal((await pool.query(`SELECT status FROM "OperationalProposal" WHERE id=$1`,[voiceProposed.proposal.id])).rows[0].status,'APPLIED');assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE id=$1`,[voiceDecisions[0].receiptId])).rows[0].n,1);
 const voiceBeforeDecisionReplay=await voiceState();assert.equal((await operations.save(owner,voiceDecision)).replayed,true);assert.deepEqual(await voiceState(),voiceBeforeDecisionReplay);assert.deepEqual(voiceAdapterCalls,{uploads:1,privateReads:3,transcriptions:1});
 voiceProgressChecks.push('voice-progress-applies-only-through-independent-existing-decision-engine-and-concurrent-exact-replay-preserves-precise-measurement-gantt-and-metadata-once');
 assert.equal(voiceProgressChecks.length,4);
 const databaseEngineVersion=(await pool.query('SHOW server_version')).rows[0].server_version;
 const sourceFiles=['src/lib/workspace-store.mjs','src/lib/workspace-policy.mjs','src/lib/field-operations-store.mjs','src/lib/field-operations-policy.mjs','src/lib/field-operations-http.mjs','src/app/api/identity/field-operations/route.js','src/app/(identity)/cuenta/field-review-page-view.mjs','src/app/(identity)/cuenta/field-operations-panel.js','tests/production-field-review-pagination.test.mjs','scripts/verify-field-operations-postgres.mjs','scripts/verify-field-operations-ui.mjs','vercel.json'];
 const sourceSha256=Object.fromEntries(sourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 const voiceProgressSourceFiles=['src/lib/voice-progress-draft.mjs','src/lib/field-media.mjs','src/lib/field-media-privacy.mjs','src/lib/field-operations-store.mjs','src/lib/field-operations-policy.mjs','src/lib/workspace-store.mjs','src/lib/progress-measurement-quantity.js','tests/production-voice-progress-draft.test.mjs','tests/production-field-media.test.mjs','scripts/verify-field-operations-postgres.mjs'],voiceProgressSourceSha256=Object.fromEntries(voiceProgressSourceFiles.map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 proof={status:'PASS',environment:'disposable-local-postgresql'+databaseEngineVersion.split('.')[0],databaseEngineVersion,checks,reviewPaginationChecks,voiceProgressChecks,checkCount:checks.length,reviewPaginationCheckCount:reviewPaginationChecks.length,voiceProgressCheckCount:voiceProgressChecks.length,totalChecks:checks.length+reviewPaginationChecks.length+voiceProgressChecks.length,sourceSha256,voiceProgressSourceSha256,productionDataWritten:false,providerCalls:0,reviewPaginationProviderCalls:0,voiceProgressProviderCalls:0,voiceProgressSyntheticAdapterCalls:voiceAdapterCalls,mediaAdapters:'synthetic-isolated-objects-and-responses',physicalAttendanceAccepted:false,whatsAppTested:false};
}finally{try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}}
proof.databaseRemoved=true;mkdirSync('.vercel/field-operations-evidence',{recursive:true});writeFileSync('.vercel/field-operations-evidence/postgres.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
