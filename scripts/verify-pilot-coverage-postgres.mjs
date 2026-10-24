import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {Client,Pool} from 'pg';
import {createPilotKycCoverage,PILOT_KYC_PRESET,lockPilotUsage} from '../src/lib/organization-pilot-coverage.mjs';
import {createPlatformOperatorAuthority} from '../src/lib/platform-operator-authority.mjs';
import {createOrganizationResourceUsage} from '../src/lib/organization-resource-usage-store.mjs';
import {usageCoverage,usageDigest} from '../src/lib/organization-usage-policy.mjs';
import {resourceUsageId,openAiChatUsageFact} from '../src/lib/organization-resource-usage-policy.mjs';
import {enqueueParticipantPreanalysis} from '../src/lib/participant-kyc-preanalysis-policy.mjs';
import {createParticipantKycPreanalysis} from '../src/lib/participant-kyc-preanalysis.mjs';
import {digest} from '../src/lib/workspace-policy.mjs';
import {preanalysisMemoryFixture} from '../tests/fixtures/participant-preanalysis-memory.mjs';
import {COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL} from './lib/company-channel-disposable-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {organizationUsageDisposableUrl,organizationUsageFailure} from './verify-organization-usage-postgres.mjs';

export const PILOT_COVERAGE_POSTGRES_VERSION='pilot-coverage-postgres-v1';
export const PILOT_COVERAGE_POSTGRES_CHECKS=Object.freeze([
 'native-concurrent-create-admits-one-organization-grant-ever',
 'exact-create-replay-preserves-issuance-and-conflicting-request-is-denied',
 'native-simultaneous-reservation-and-fence-admit-one-slot-and-one-dispatch',
 'revocation-after-reservation-denies-fence-and-never-refunds-capacity',
 'natural-SQL-expiry-before-fence-and-at-final-UPDATE-preserves-original-binding',
 'issuer-role-revocation-after-reservation-denies-fence',
 'changed-source-or-consent-after-reservation-denies-fence',
 'UNKNOWN-source-denies-new-operation-actor-or-resource-revision',
 'FIRST-capture-binds-the-first-current-source-without-a-second-slot',
 'current-HELD-v2-resumes-original-OCR-once-and-keeps-completed-facial-stage',
 'organization-admin-and-foreign-worker-project-stage-scope-cannot-use-pilot',
 'all-original-commercial-trials-and-payment-ledgers-remain-unchanged',
]);
export const pilotCoverageDisposableUrl=organizationUsageDisposableUrl;
export function pilotCoverageOwnedDatabase(value){
 if(typeof value!=='string'||!/^obrasaas_pilot_coverage_[a-f0-9]{32}$/.test(value))throw Object.assign(new Error('PILOT_COVERAGE_OWNED_DATABASE_REJECTED'),{code:'PILOT_COVERAGE_OWNED_DATABASE_REJECTED'});return value;
}
export function pilotCoveragePostgresArguments(args){
 if(!Array.isArray(args)||args.length!==1||args[0]!=='--run-disposable-postgres')throw Object.assign(new Error('PILOT_COVERAGE_POSTGRES_RUN_REQUIRED'),{code:'PILOT_COVERAGE_POSTGRES_RUN_REQUIRED'});return {runDisposable:true};
}
const sha=value=>createHash('sha256').update(value).digest('hex');
export function pilotCoveragePostgresSourceFiles(root=process.cwd()){
 const files=new Set(['package.json','package-lock.json']);
 function visit(file){
  assert.match(file,/^(src|scripts|tests)\//);assert.ok(!file.includes('..'));if(files.has(file))return;files.add(file);if(file.endsWith('.css'))return;
  const ast=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'unambiguous',plugins:['jsx'],createImportExpressions:true});
  function reference(value){if(!value.startsWith('.'))return;const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),value)),resolved=[base,base+'.mjs',base+'.js',base+'.css'].find(candidate=>existsSync(path.join(root,candidate)));assert.ok(resolved,'Native fixture relative import must resolve');visit(resolved);}
  function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&node.source?.type==='StringLiteral')reference(node.source.value);if(node.type==='CallExpression'&&node.callee?.type==='Import'&&node.arguments[0]?.type==='StringLiteral')reference(node.arguments[0].value);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  walk(ast.program);
 }
 visit('scripts/verify-pilot-coverage-postgres.mjs');visit('tests/production-pilot-coverage-postgres-target.test.mjs');return [...files].sort();
}
let failureContext={stage:'TARGET_GUARD',check:null,completedCheckCount:0,postgresExecuted:false,poolClosed:false,databaseRemoved:false};
export function pilotCoveragePostgresFailure(error,{root=process.cwd(),context=failureContext}={}){
 return {...organizationUsageFailure(error,{root,context}),version:PILOT_COVERAGE_POSTGRES_VERSION,sourceAuthorityAccepted:false,canonicalGatePassed:false,postgresExecuted:context.postgresExecuted===true,check:PILOT_COVERAGE_POSTGRES_CHECKS.includes(context.check)?context.check:null,completedCheckCount:Number.isInteger(context.completedCheckCount)&&context.completedCheckCount>=0&&context.completedCheckCount<=PILOT_COVERAGE_POSTGRES_CHECKS.length?context.completedCheckCount:0};
}

export async function verifyPilotCoveragePostgres(environment={},options={}){
 failureContext={stage:'TARGET_GUARD',check:null,completedCheckCount:0,postgresExecuted:false,poolClosed:false,databaseRemoved:false};
 if(options.runDisposable!==true)pilotCoveragePostgresArguments([]);
 // No Client/Pool is constructed before the exact local disposable guard.
 const target=pilotCoverageDisposableUrl(environment),root=process.cwd(),sources=pilotCoveragePostgresSourceFiles(root).map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))}));
 const database=pilotCoverageOwnedDatabase('obrasaas_pilot_coverage_'+randomUUID().replaceAll('-',''));
 const admin=new Client({connectionString:target.href,connectionTimeoutMillis:5000,query_timeout:8000});
 const checks=[],nativeLockObservations=[],fixtures=[],inFlight=new Set();let connected=false,created=false,ownedOid=null,pool,poolClosed=false,databaseRemoved=false,unexpectedNetwork=0,syntheticOcrDispatches=0;
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{unexpectedNetwork++;throw Error('PILOT_COVERAGE_UNCONTROLLED_HTTP_REJECTED');};
 const track=promise=>{inFlight.add(promise);promise.then(()=>inFlight.delete(promise),()=>inFlight.delete(promise));return promise;};
 const adminEnded=new Promise(resolve=>admin.once('end',resolve));
 try{
  failureContext.stage='OWNED_DATABASE';await admin.connect();connected=true;
  const identity=(await admin.query('SELECT current_database() AS db,current_user AS role,session_user AS actor,host(inet_server_addr()) AS host,inet_server_port() AS port')).rows[0];
  failureContext.postgresExecuted=true;
  assert.equal(identity.db,'obrasaas_cutover_ci');assert.equal(identity.role,'cutover_test');assert.equal(identity.actor,'cutover_test');assert.equal(identity.host,'127.0.0.1');assert.equal(identity.port,Number(target.port));
  assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rows.length,0);await admin.query(`CREATE DATABASE "${database}"`);created=true;
  const ownership=(await admin.query('SELECT oid,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',[database])).rows[0];assert.equal(ownership.owner,'cutover_test');ownedOid=ownership.oid;
  const child=new URL(target);child.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:child.href,max:12,connectionTimeoutMillis:5000,options:'-c statement_timeout=8000 -c lock_timeout=5000'}));
  assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,database);
  await pool.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
  await pool.query(`ALTER TABLE public."PlatformUser" ADD COLUMN "systemRole" text NOT NULL DEFAULT 'TENANT_USER';ALTER TABLE public."Organization" ADD COLUMN "subscriptionPlan" text DEFAULT 'TRIAL',ADD COLUMN "subscriptionStatus" text DEFAULT 'TRIALING';INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail","systemRole") VALUES('pilot-platform-operator','user_PilotOperator','pilot-operator@example.invalid','SUPERADMIN');`);
  const commercialRows=() => pool.query('SELECT * FROM public."Organization" ORDER BY id').then(result=>result.rows);
  const commercialLedger=() => pool.query(`SELECT * FROM public."AuditLog" WHERE action LIKE 'company.subscription.%' ORDER BY id`).then(result=>result.rows);
  const originalCompanies=await commercialRows(),originalCommercialLedger=await commercialLedger();
  const connect=()=>pool.connect(),authority=createPlatformOperatorAuthority({verifySession:async headers=>({authenticated:true,verification:'clerk-production-jwt',impersonationRejected:true,userId:headers.get('x-synthetic-subject'),sessionId:'sess_PilotNative',expiresAt:Math.floor(Date.now()/1000)+120,businessAccessEnabled:false})});
  const cap=await authority.authenticate(new Headers({'x-synthetic-subject':'user_PilotOperator'})),pilot=createPilotKycCoverage({connect,authority});
  const company=async(client,id)=>(await client.query(`SELECT id,metadata,"subscriptionPlan","subscriptionStatus","trialEndsAt" AT TIME ZONE 'UTC' AS "trialEndsAt",clock_timestamp() AS "observedAt" FROM public."Organization" WHERE id=$1`,[id])).rows[0];
  const usage=createOrganizationResourceUsage({connect,lock:lockPilotUsage,company,coverage:async(client,row)=>usageCoverage(row,null),pilotCoverage:pilot});
  async function transaction(f,fn){const client=await connect();try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='6000ms'");await client.query("SET LOCAL lock_timeout='2500ms'");await lockPilotUsage(client,f.organizationId);const value=await fn(client,{organizationId:f.organizationId,actorId:f.actorId});await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
  const reserve=(f,b=f.binding)=>transaction(f,(client,member)=>usage.reserveResource(client,member,b));
  const fence=(f,capability)=>transaction(f,(client,member)=>usage.fence(client,member,capability));
  const usageRows=f=>pool.query(`SELECT * FROM public."AuditLog" WHERE "organizationId"=$1 AND action='organization.usage.resource' ORDER BY id`,[f.organizationId]).then(r=>r.rows);
  const readWorker=f=>pool.query(`SELECT metadata FROM public."Worker" WHERE id=$1`,[f.workerId]).then(r=>r.rows[0].metadata);
  const updateWorker=(f,metadata)=>pool.query(`UPDATE public."Worker" SET metadata=$2::jsonb,"updatedAt"=clock_timestamp() WHERE id=$1`,[f.workerId,JSON.stringify(metadata)]);
  async function fixtureExpiryBoundary(grant,milliseconds){
   assert.ok(Number.isInteger(milliseconds)&&milliseconds>=1000&&milliseconds<=4000);
   // Set the fixture clock window before reservation seals the grant digest.
   await pool.query(`WITH boundary AS MATERIALIZED (SELECT date_trunc('milliseconds',clock_timestamp())+$2::int*interval '1 millisecond' AS expires) UPDATE public."AuditLog" SET metadata=jsonb_set(jsonb_set(metadata,'{issuedAt}',to_jsonb(to_char((boundary.expires-interval '24 hours') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'{expiresAt}',to_jsonb(to_char(boundary.expires AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))) FROM boundary WHERE id=$1`,[grant.grantId,milliseconds]);
   const metadata=(await pool.query('SELECT metadata FROM public."AuditLog" WHERE id=$1',[grant.grantId])).rows[0].metadata;
   assert.equal(Date.parse(metadata.expiresAt)-Date.parse(metadata.issuedAt),86400000);return metadata;
  }
  async function fixture({first=false}={}){
   // Obtain real canonical consent/source objects without running its service.
   const memory=preanalysisMemoryFixture(),row=structuredClone(memory.row),receipt=structuredClone(memory.receipt),suffix=randomUUID().replaceAll('-',''),organizationId='pilot_org_'+suffix,projectId='pilot_project_'+suffix,workerId='pilot_worker_'+suffix,actorId='pilot_actor_'+suffix,clerkUserId='user_Pilot'+suffix,sourceReceiptId='participant_'+sha(suffix),submissionId='pilot_kyc_'+suffix;
   row.id=workerId;row.projectId=projectId;row.organizationId=organizationId;row.metadata.participant.clerkUserId=clerkUserId;const k=row.metadata.participant.kyc;k.submissionId=submissionId;
   receipt.id=sourceReceiptId;receipt.organizationId=organizationId;receipt.actorId=actorId;receipt.entityId=workerId;receipt.metadata.projectId=projectId;receipt.metadata.submissionId=submissionId;
   enqueueParticipantPreanalysis({kyc:k,organizationId,projectId,workerId,sourceReceiptId,sourceActorId:actorId});k.processing.status='USAGE_HELD';k.processing.code='ORGANIZATION_USAGE_COVERAGE_EXPIRED';k.processing.nextCheckAt=null;k.processing.stages.ocr={state:'HELD',code:'ORGANIZATION_USAGE_COVERAGE_EXPIRED'};k.processing.stages.biometric={state:'COMPLETE'};
   k.processing.biometrics={status:'ADVISORY_UNREVIEWED',provider:'private-opencv-onnx',modelManifestSha256:'c695e1a85db3ac933836562ce1f7d7e2b372ba2951dc9c4d0160b88cd448c860',frontSha256:k.images[0].sha256,selfieSha256:k.images[1].sha256,faceSimilarity:0.4,captureRiskSignal:0.3,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true};
   const fullMetadata=structuredClone(row.metadata),initial=structuredClone(row.metadata);if(first)initial.participant.kyc={version:1,status:'NOT_SUBMITTED'};
   await pool.query(`INSERT INTO public."Organization"(id,name,"clerkOrganizationId",metadata,"trialEndsAt","subscriptionPlan","subscriptionStatus") VALUES($1,'Synthetic pilot',$2,'{}',clock_timestamp()-interval '1 day','TRIAL','TRIALING')`,[organizationId,'org_Pilot'+suffix]);
   await pool.query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[actorId,clerkUserId,suffix+'@example.invalid']);
   await pool.query(`INSERT INTO public."TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'AUDITOR','org:member','ACTIVE')`,['pilot_m_'+suffix,actorId,organizationId]);
   await pool.query(`INSERT INTO public."Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,'Synthetic pilot','ACTIVE','{}')`,[projectId,organizationId]);
   await pool.query(`INSERT INTO public."ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES($1,$2,$3,'ACTIVE')`,['pilot_pm_'+suffix,projectId,'pilot_m_'+suffix]);
   await pool.query(`INSERT INTO public."Worker"(id,"projectId",name,active,metadata) VALUES($1,$2,'Synthetic participant',true,$3::jsonb)`,[workerId,projectId,JSON.stringify(initial)]);
   async function insertReceipt(){await pool.query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,'participant.operation.recorded','Worker',$4,$5::jsonb)`,[receipt.id,organizationId,actorId,workerId,JSON.stringify(receipt.metadata)]);}
   if(!first)await insertReceipt();
   const a=k.processing.auto,binding={version:2,projectId,resourceType:'Worker',resourceId:workerId,resourceRevision:digest(['participant-ocr-resource-v1',submissionId,k.contentHash]),stage:'IDENTITY_OPENAI_OCR',sourceSha256:k.images[0].sha256,operationId:a.operationId,requestDigest:usageDigest(a),consentVersion:k.ocrConsent.noticeVersion,requestedModel:'gpt-4o'};
   const f={organizationId,projectId,workerId,actorId,clerkUserId,binding,row,receipt,ref:{projectId,workerId,submissionId},request:{preset:PILOT_KYC_PRESET,operationId:randomUUID(),organizationId,projectId,workerId,expectedSubmissionId:first?null:submissionId,expectedContentHash:first?null:k.contentHash},commercial:await company(pool,organizationId),async installCapture(){await updateWorker(f,fullMetadata);await insertReceipt();}};delete f.commercial.observedAt;fixtures.push(f);return f;
  }
  async function nativeRace(f,first,second,label,competitor=null){
   const held=await pool.connect();let tasks=[];try{await held.query('BEGIN');await lockPilotUsage(held,f.organizationId);tasks=[first,second,...(competitor?[competitor]:[])].map(run=>track(run()));let waiting=[];const until=Date.now()+1500;while(Date.now()<until){waiting=(await pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%pg_advisory_xact_lock%'`)).rows;if(waiting.length>=tasks.length)break;await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(waiting.length>=tasks.length,'Every native transaction must wait at the organization usage lock');nativeLockObservations.push({label,waitingCount:waiting.length,heldPid:held.processID});await held.query('ROLLBACK');return await Promise.allSettled(tasks);}finally{await held.query('ROLLBACK').catch(()=>{});held.release();await Promise.allSettled(tasks);}
  }
  async function check(index,fn){failureContext={stage:'NATIVE_CHECK',check:PILOT_COVERAGE_POSTGRES_CHECKS[index],completedCheckCount:checks.length,postgresExecuted:true,poolClosed:false,databaseRemoved:false};assert.equal(index,checks.length);await fn();checks.push(PILOT_COVERAGE_POSTGRES_CHECKS[index]);failureContext.completedCheckCount=checks.length;}
  await check(0,async()=>{const f=await fixture(),result=await nativeRace(f,()=>pilot.create(cap,f.request),()=>pilot.create(cap,{...f.request,operationId:randomUUID()}),'create');assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected'&&r.reason.code==='PILOT_COVERAGE_ALREADY_ISSUED').length,1);const grant=await pilot.read(cap,{organizationId:f.organizationId});assert.equal(grant.limit,1);assert.equal(grant.remaining,1);assert.equal(Date.parse(grant.expiresAt)-Date.parse(grant.issuedAt),86400000);});
  await check(1,async()=>{const f=await fixture(),first=await pilot.create(cap,f.request),replay=await pilot.create(cap,f.request);assert.equal(replay.recovered,true);assert.equal(replay.grantId,first.grantId);assert.equal(replay.issuedAt,first.issuedAt);await assert.rejects(()=>pilot.create(cap,{...f.request,operationId:randomUUID()}),{code:'PILOT_COVERAGE_ALREADY_ISSUED'});assert.equal((await reserve(f,{...f.binding,requestDigest:'a'.repeat(64)})).deferred,true);});
  await check(2,async()=>{const f=await fixture();await pilot.create(cap,f.request);const r=await nativeRace(f,()=>reserve(f),()=>reserve(f),'reserve',()=>reserve(f,{...f.binding,operationId:randomUUID()}));assert.ok(r.every(x=>x.status==='fulfilled'));assert.equal(r.filter(x=>x.value.recovered===true).length,1);assert.equal(r.filter(x=>x.value.capability).length,2);assert.equal(r[2].value.deferred,true);const rows=await usageRows(f);assert.equal(rows.length,1);assert.equal(rows[0].id,resourceUsageId({...f.binding,organizationId:f.organizationId,actorId:f.actorId}));const fences=await nativeRace(f,()=>fence(f,r[0].value.capability),()=>fence(f,r[1].value.capability),'fence');assert.equal(fences.filter(x=>x.status==='fulfilled'&&x.value.dispatched===true).length,1);assert.equal(fences.filter(x=>x.status==='rejected'&&x.reason.code==='ORGANIZATION_USAGE_ALREADY_DISPATCHED').length,1);assert.equal((await pilot.read(cap,{organizationId:f.organizationId})).remaining,0);});
  await check(3,async()=>{const f=await fixture(),grant=await pilot.create(cap,f.request),r=await reserve(f),before=(await usageRows(f))[0];const revoked=await pilot.revoke(cap,{organizationId:f.organizationId,grantId:grant.grantId,operationId:randomUUID()});assert.equal(revoked.state,'REVOKED');assert.equal(revoked.remaining,0);assert.equal((await fence(f,r.capability)).deferred,true);assert.deepEqual((await usageRows(f))[0],before);const replay=await pilot.create(cap,f.request);assert.equal(replay.recovered,true);assert.equal(replay.state,'REVOKED');assert.equal(replay.remaining,0);await assert.rejects(()=>pilot.create(cap,{...f.request,operationId:randomUUID()}),{code:'PILOT_COVERAGE_ALREADY_ISSUED'});});
  await check(4,async()=>{const f=await fixture(),grant=await pilot.create(cap,f.request);
   // Fixture clock setup occurs BEFORE reservation/hash binding. Thereafter the
   // real SQL clock expires an unchanged 24h receipt; no proof is resealed later.
   const before=await fixtureExpiryBoundary(grant,2500);
   const r=await reserve(f);assert.ok(r.capability);const reservation=(await usageRows(f))[0],until=Date.now()+4000;let expired=false;while(Date.now()<until){const at=(await pool.query('SELECT clock_timestamp() AS now')).rows[0].now;if(at.getTime()>=Date.parse(before.expiresAt)){expired=true;break;}await new Promise(resolve=>setTimeout(resolve,25));}assert.equal(expired,true);
   assert.equal((await fence(f,r.capability)).deferred,true);assert.deepEqual((await pool.query('SELECT metadata FROM public."AuditLog" WHERE id=$1',[grant.grantId])).rows[0].metadata,before);assert.deepEqual((await usageRows(f))[0],reservation);const expiredGrant=await pilot.read(cap,{organizationId:f.organizationId});assert.equal(expiredGrant.state,'EXPIRED');assert.equal(expiredGrant.remaining,0);
   const final=await fixture(),finalGrant=await pilot.create(cap,final.request),finalGrantBefore=await fixtureExpiryBoundary(finalGrant,2500),finalReservation=await reserve(final),finalRowBefore=(await usageRows(final))[0];let finalUpdateWaits=0;
   const denied=await transaction(final,(client,member)=>usage.fence({query:async(sql,args)=>{if(sql.startsWith('UPDATE public."AuditLog"')){assert.match(sql,/clock_timestamp\(\)<\$3::timestamptz RETURNING id/);assert.equal(args[2],finalGrantBefore.expiresAt);finalUpdateWaits++;await client.query(`SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM ($1::timestamptz-clock_timestamp())))+0.025)`,[args[2]]);}return client.query(sql,args);}},member,finalReservation.capability));
   assert.equal(finalUpdateWaits,1);assert.equal(denied.deferred,true);assert.equal(denied.code,'ORGANIZATION_USAGE_COVERAGE_EXPIRED');assert.deepEqual((await usageRows(final))[0],finalRowBefore);assert.deepEqual((await pool.query('SELECT metadata FROM public."AuditLog" WHERE id=$1',[finalGrant.grantId])).rows[0].metadata,finalGrantBefore);
  });
  await check(5,async()=>{const f=await fixture();await pilot.create(cap,f.request);const r=await reserve(f);try{await pool.query(`UPDATE public."PlatformUser" SET "systemRole"='TENANT_USER' WHERE id='pilot-platform-operator'`);assert.equal((await fence(f,r.capability)).deferred,true);}finally{await pool.query(`UPDATE public."PlatformUser" SET "systemRole"='SUPERADMIN' WHERE id='pilot-platform-operator'`);}});
  await check(6,async()=>{for(const mode of ['source','consent']){const f=await fixture();await pilot.create(cap,f.request);const r=await reserve(f),metadata=await readWorker(f);if(mode==='source')metadata.participant.kyc.submissionId+='_changed';else metadata.participant.kyc.ocrConsent.allowed=false;await updateWorker(f,metadata);assert.equal((await fence(f,r.capability)).deferred,true);assert.equal((await usageRows(f))[0].metadata.state,'RESERVED');}});
  await check(7,async()=>{const f=await fixture();await pilot.create(cap,f.request);const r=await reserve(f);await fence(f,r.capability);await usage.unknown(r.capability);const replay=await reserve(f);assert.equal(replay.done,true);assert.equal(replay.code,'ORGANIZATION_USAGE_ALREADY_DISPATCHED');for(const [actorId,changed] of [[f.actorId,{operationId:randomUUID()}],['owner',{operationId:randomUUID()}],[f.actorId,{operationId:randomUUID(),resourceRevision:'b'.repeat(64)}],[f.actorId,{operationId:randomUUID(),requestDigest:'c'.repeat(64)}]]){const result=await reserve({...f,actorId},{...f.binding,...changed});assert.equal(result.done,true);assert.equal(result.code,'ORGANIZATION_USAGE_RESULT_PENDING');}const rows=await usageRows(f);assert.equal(rows.length,1);assert.equal(rows[0].metadata.state,'UNKNOWN');assert.equal(rows[0].id,r.usage.receiptId);assert.equal((await pilot.read(cap,{organizationId:f.organizationId})).remaining,0);});
  await check(8,async()=>{const f=await fixture({first:true});await pilot.create(cap,f.request);assert.equal((await reserve(f)).deferred,true);await f.installCapture();const r=await reserve(f);assert.ok(r.capability);assert.equal((await fence(f,r.capability)).dispatched,true);const replay=await reserve(f);assert.equal(replay.done,true);assert.equal(replay.code,'ORGANIZATION_USAGE_ALREADY_DISPATCHED');assert.equal((await usageRows(f)).length,1);});
  await check(9,async()=>{const f=await fixture(),before=await readWorker(f),old=before.participant.kyc;await pilot.create(cap,f.request);let privateReads=0,facialCalls=0;const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
   const service=createParticipantKycPreanalysis({connect,usage:{...usage,lockBeforeProject:(client,member)=>lockPilotUsage(client,member.organizationId)},readiness:()=>({ocr:true,biometric:true}),get:async pathname=>{privateReads++;assert.equal(pathname,old.images[0].url.split('.com/')[1]);return {statusCode:200,blob:{url:old.images[0].url,size:picture.length,contentType:'image/png'},stream:new Response(picture).body};},analyzer:{async analyzeDni(options){await options.beforeDispatch({requestedModel:'gpt-4o',endpoint:'chat.completions'});syntheticOcrDispatches++;await options.observeUsage(openAiChatUsageFact({id:'chatcmpl_SyntheticPilot',model:'gpt-4o',usage:{prompt_tokens:20,completion_tokens:10,total_tokens:30}}));return {success:true,isDni:true,nombreCompleto:'Persona Sintética',dni:'12345678',cuil:null};}},assessBiometrics:async()=>{facialCalls++;throw Error('Completed facial stage must not repeat');}});
   const count=syntheticOcrDispatches,attempts=await Promise.allSettled([track(service.process(f.ref)),track(service.process(f.ref))]);for(const attempt of attempts)if(attempt.status==='rejected')throw attempt.reason;const after=(await readWorker(f)).participant.kyc;assert.equal(after.processing.stages.ocr.state,'COMPLETE');assert.deepEqual(after.processing.stages.biometric,old.processing.stages.biometric);assert.deepEqual(after.processing.biometrics,old.processing.biometrics);assert.equal(after.submissionId,old.submissionId);assert.equal(after.contentHash,old.contentHash);assert.deepEqual(after.images,old.images);assert.deepEqual(after.processing.auto,old.processing.auto);assert.equal(after.status,'PENDING_REVIEW');assert.equal(syntheticOcrDispatches,count+1);assert.equal(facialCalls,0);assert.equal(privateReads,1);await service.process(f.ref);assert.equal(syntheticOcrDispatches,count+1);assert.equal(privateReads,1);assert.equal((await usageRows(f))[0].metadata.state,'OBSERVED');assert.deepEqual((await readWorker(f)).participant.permissions,before.participant.permissions);
  });
  await check(10,async()=>{const f=await fixture(),foreign=await fixture();await pool.query(`UPDATE public."TenantMembership" SET "tenantRole"='ADMIN',"clerkRole"='org:admin' WHERE "userId"=$1 AND "organizationId"=$2`,[f.actorId,f.organizationId]);const customer=await authority.authenticate(new Headers({'x-synthetic-subject':f.clerkUserId}));await assert.rejects(()=>pilot.create(customer,f.request),{code:'PLATFORM_OPERATOR_REQUIRED'});await pilot.create(cap,f.request);for(const changed of [{projectId:foreign.projectId},{resourceId:foreign.workerId},{stage:'FIELD_OPENAI_VISION',resourceType:'Incident',consentVersion:'field-media-analysis-v1'}])assert.equal((await reserve(f,{...f.binding,...changed})).deferred,true);assert.equal((await usageRows(f)).length,0);assert.equal((await usageRows(foreign)).length,0);});
  await check(11,async()=>{const before=(await pool.query('SELECT * FROM public."AuditLog" ORDER BY id')).rows,reader=await connect();try{await reader.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal((await reader.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');for(const f of fixtures){const projection=await pilot.companyProjection(reader,f.organizationId);if(projection!==null){assert.deepEqual(Object.keys(projection).sort(),['version','preset','observedAt','issuedAt','expiresAt','limit','remaining','state'].sort());assert.doesNotMatch(JSON.stringify(projection),/actorId|clerkUserId|workerId|projectId|grantId|submissionId|contentHash/);}}await reader.query('COMMIT');}catch(error){await reader.query('ROLLBACK');throw error;}finally{reader.release();}assert.deepEqual((await pool.query('SELECT * FROM public."AuditLog" ORDER BY id')).rows,before);for(const f of fixtures){const current=await company(pool,f.organizationId);delete current.observedAt;assert.deepEqual(current,f.commercial);}const current=await commercialRows();assert.deepEqual(current.filter(row=>originalCompanies.some(original=>original.id===row.id)),originalCompanies);assert.equal(current.length,originalCompanies.length+fixtures.length);assert.deepEqual(await commercialLedger(),originalCommercialLedger);});
  assert.deepEqual(checks,[...PILOT_COVERAGE_POSTGRES_CHECKS]);assert.equal(unexpectedNetwork,0);for(const source of sources)assert.equal(sha(readFileSync(path.join(root,source.path))),source.sha256,source.path);
 }finally{
  globalThis.fetch=originalFetch;let cleanupError;await Promise.allSettled([...inFlight]);
  try{if(pool){await closeDisposablePool(pool);poolClosed=true;failureContext.poolClosed=true;}}catch(error){cleanupError=error;}
  try{if(connected&&created){pilotCoverageOwnedDatabase(database);const context=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(context.db,'obrasaas_cutover_ci');assert.equal(context.role,'cutover_test');const row=(await admin.query('SELECT oid,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1',[database])).rows[0];assert.equal(row.oid,ownedOid);assert.equal(row.owner,'cutover_test');assert.equal((await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].n,0);await admin.query(`DROP DATABASE "${database}"`);databaseRemoved=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rows.length===0;failureContext.databaseRemoved=databaseRemoved;}}catch(error){cleanupError||=error;}
  finally{if(connected){await admin.end();await adminEnded;}}
  if(cleanupError){failureContext.stage='CLEANUP';throw cleanupError;}
 }
 assert.equal(poolClosed,true);assert.equal(databaseRemoved,true);
 return {status:'PASS',version:PILOT_COVERAGE_POSTGRES_VERSION,validationScope:'LOCAL_SYNTHETIC_POSTGRES_ONLY',sourceAuthorityAccepted:false,canonicalGatePassed:false,postgresExecuted:true,checks,totalCheckCount:checks.length,nativeLockObservations,syntheticOcrDispatches,providerRequests:unexpectedNetwork,sourceManifest:sources,cleanup:{poolClosed,databaseRemoved},productionDataWritten:false,grantIssuedInProduction:false,paymentAttempted:false,identityApproved:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const namespace=path.resolve('.vercel/private/pilot-coverage-postgres-'+new Date().toISOString().replaceAll(/[:.]/g,'-')+'-'+randomUUID().replaceAll('-',''));
 async function run(){const options=pilotCoveragePostgresArguments(process.argv.slice(2));return verifyPilotCoveragePostgres(process.env,options);}
 run().then(proof=>{mkdirSync(namespace,{recursive:true});writeFileSync(path.join(namespace,'result.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,totalCheckCount:proof.totalCheckCount,postgresExecuted:true,cleanup:proof.cleanup,sourceAuthorityAccepted:false}));}).catch(error=>{const proof=pilotCoveragePostgresFailure(error);mkdirSync(namespace,{recursive:true});writeFileSync(path.join(namespace,'failure.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.error(JSON.stringify({status:'FAIL',code:proof.code,stage:proof.stage,check:proof.check,sourceAuthorityAccepted:false}));process.exitCode=1;});
}
