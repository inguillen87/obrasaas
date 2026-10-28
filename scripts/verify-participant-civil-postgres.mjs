import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {Client,Pool} from 'pg';
import {WorkspaceError,scopeStamp,digest} from '../src/lib/workspace-policy.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createPrivateImageUploader} from '../src/lib/private-image-upload.mjs';
import {PARTICIPANT_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {createBindxCivilDataClient,BINDX_CIVIL_CONFIGURATION_VERSION,BINDX_CIVIL_CONSENT_VERSION,BINDX_CIVIL_RESPONSE_SCHEMA} from '../src/lib/bindx-civil-data-client.mjs';
import {civilSha} from '../src/lib/participant-civil-policy.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {syntheticCaptureQuality} from './lib/synthetic-capture-quality.mjs';

export const PARTICIPANT_CIVIL_POSTGRES_PROOF_VERSION='participant-civil-postgres-v1';
export const PARTICIPANT_CIVIL_POSTGRES_CHECKS=Object.freeze([
 'closed-default-zero-transport-and-no-durable-reservation',
 'canonical-upload-receipts-and-own-dedicated-consent-before-dispatch',
 'native-manager-held-Project-lock-blocks-holder-before-Worker',
 'native-holder-held-Project-lock-blocks-manager-before-Worker',
 'native-concurrent-instance-query-one-committed-attempt-one-provider-GET',
 'unknown-preserved-across-new-UUID-operator-instance-and-clock',
 'interrupted-client-reconstruction-does-not-repeat-source',
 'post-GET-operator-revocation-retains-OBSERVED-and-denies-private-output',
 'current-holder-account-replacement-denied-before-dispatch',
 'missing-or-substituted-durable-holder-consent-denied-before-dispatch',
 'post-GET-holder-revocation-retains-OBSERVED-and-denies-private-output',
 'current-source-and-submission-required-for-private-recovery',
 'server-context-and-exact-command-input-cannot-be-forged',
 'late-observer-ACK-preserves-one-OBSERVED-without-UNKNOWN-overwrite',
 'native-status-read-is-read-only-and-never-requeries-provider',
 'civil-facts-do-not-approve-KYC-biometry-liveness-permissions-or-finance',
]);

export function participantCivilDisposableUrl(environment={}){
 let url;try{url=new URL(environment.CUTOVER_TEST_DATABASE_URL);}catch{throw new WorkspaceError('PARTICIPANT_CIVIL_DISPOSABLE_TARGET_REJECTED');}
 if(environment.CUTOVER_TEST_DISPOSABLE!=='1'||['VERCEL','VERCEL_ENV','VERCEL_TARGET','VERCEL_TARGET_ENV'].some(key=>environment[key])||!['postgres:','postgresql:'].includes(url.protocol)||!['127.0.0.1','localhost'].includes(url.hostname)||!['5432','6549'].includes(url.port)||url.username!=='cutover_test'||url.pathname!=='/obrasaas_cutover_ci'||url.search||url.hash||(url.port==='6549'?url.password!=='':!['','cutover_test'].includes(url.password)))throw new WorkspaceError('PARTICIPANT_CIVIL_DISPOSABLE_TARGET_REJECTED');
 return url;
}
export function participantCivilOwnedDatabase(value){if(typeof value!=='string'||!/^obrasaas_civil_[a-f0-9]{32}$/.test(value))throw new WorkspaceError('PARTICIPANT_CIVIL_OWNED_DATABASE_REJECTED');return value;}
export function createParticipantCivilBlobAdapter({objects=new Map(),onPut=()=>{}}={}){
 assert.ok(objects instanceof Map);assert.equal(typeof onPut,'function');
 return {
  async get(pathname,options){
   assert.equal(options.access,'private');assert.equal(options.useCache,false);const item=objects.get(pathname);if(!item)return null;
   return {statusCode:200,blob:{url:item.url,pathname,size:item.bytes.length,contentType:item.contentType},stream:new Response(item.bytes).body};
  },
  async put(pathname,bytes,options){
   assert.equal(options.access,'private');assert.equal(options.allowOverwrite,false);assert.equal(options.addRandomSuffix,false);assert.equal(objects.has(pathname),false);
   const item={bytes:Buffer.from(bytes),contentType:options.contentType,url:'https://synthetic.private.blob.vercel-storage.com/'+pathname};objects.set(pathname,item);onPut();return {url:item.url,pathname};
  },
 };
}
// Track actual pool checkouts within one logical dispatch. Another dispatch can
// hold a native transaction while this caller has committed and released its own.
export function createParticipantCivilDispatchObserver(){
 const storage=new AsyncLocalStorage();let sequence=0;
 return {
  run:callback=>storage.run({dispatchId:'civil-dispatch-'+(++sequence),clients:[]},callback),
  trackClient(pid){
   const dispatch=storage.getStore();if(!dispatch)return {acquired(){},released(){}};
   const client={pid,active:false,readOnly:null,committedWritable:false,released:false};dispatch.clients.push(client);
   return {
    acquired(stage,readOnly=null){
     if(stage==='BEGIN'){assert.equal(client.active,false);assert.equal(client.released,false);client.active=true;client.readOnly=readOnly;}
     else if(stage==='COMMIT'||stage==='ROLLBACK'){assert.equal(client.active,true);if(stage==='COMMIT'&&client.readOnly===false)client.committedWritable=true;client.active=false;}
    },
    released(){assert.equal(client.released,false);client.released=true;},
   };
  },
  beforeExternal(){
   const dispatch=storage.getStore();assert.ok(dispatch,'Provider transport requires its actual dispatch context');
   assert.ok(dispatch.clients.length>0&&dispatch.clients[0].committedWritable,'The caller reservation must commit before provider transport');
   assert.ok(dispatch.clients.every(client=>client.released&&!client.active),'Every caller pool checkout must release before provider transport');
   return {dispatchId:dispatch.dispatchId,reservationCommitted:true,callerClientsReleased:true,callerCheckoutCount:dispatch.clients.length};
  },
 };
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const gitBlob=(root,file)=>execFileSync('git',['show','HEAD:'+file],{cwd:root,stdio:['ignore','pipe','pipe']});
const workingBlob=(root,file)=>execFileSync('git',['hash-object','--path='+file,'--stdin'],{cwd:root,input:readFileSync(path.join(root,file)),encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
export function participantCivilSourceFiles(root=process.cwd()){
 const files=new Set(['package.json','package-lock.json']);
 function visit(file){
  assert.match(file,/^(src|scripts|tests)\//);assert.equal(file.includes('..'),false);if(files.has(file))return;files.add(file);
  if(!/\.(mjs|js)$/.test(file))return;
  const ast=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'unambiguous',plugins:['jsx']}),imports=[];
  function walk(node){if(!node||typeof node!=='object')return;if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source?.value)imports.push(node.source.value);if(node.type==='ImportExpression'){assert.equal(node.source?.type,'StringLiteral','Native source closure cannot hide a dynamic import');imports.push(node.source.value);}if(node.type==='CallExpression'&&node.callee?.type==='Import'){assert.equal(node.arguments[0]?.type,'StringLiteral','Native source closure cannot hide a dynamic import');imports.push(node.arguments[0].value);}for(const item of Object.values(node))if(Array.isArray(item))item.forEach(walk);else if(item&&typeof item==='object')walk(item);}
  walk(ast.program);
  for(const reference of imports.filter(value=>value.startsWith('.'))){const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),reference)),resolved=[base,base+'.mjs',base+'.js'].find(candidate=>existsSync(path.join(root,candidate)));assert.ok(resolved,'Every native source import must resolve');visit(resolved);}
 }
 visit('scripts/verify-participant-civil-postgres.mjs');visit('tests/production-participant-civil-postgres-target.test.mjs');return [...files].sort();
}
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const facts={nombres:'Persona',apellido:'Sintética',ejemplar:'A',fecha_nacimiento:'01/01/1990',emision:'01/01/2024',vencimiento:'01/01/2034',codigo_fallecido:0};
const FIXTURE_SQL=`CREATE TYPE "TenantRole" AS ENUM('ADMIN','DIRECTOR','SITE_MANAGER','FINANCE','AUDITOR');
 CREATE TABLE fixture_clock(id integer PRIMARY KEY CHECK(id=1),now timestamptz NOT NULL);
 CREATE FUNCTION fixture_clock_timestamp() RETURNS timestamptz LANGUAGE sql STABLE AS 'SELECT now FROM public.fixture_clock WHERE id=1';
 CREATE TABLE "Organization"(id text PRIMARY KEY,name text NOT NULL,"clerkOrganizationId" text UNIQUE,metadata jsonb);
 CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text UNIQUE NOT NULL,"primaryEmail" text NOT NULL UNIQUE,"fullName" text,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","userId" text REFERENCES "PlatformUser","tenantRole" "TenantRole","clerkRole" text,status text,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,UNIQUE("organizationId","userId"));
 CREATE TABLE "Project"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text,status text,metadata jsonb,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE "ProjectMembership"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status text,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,UNIQUE("projectId","tenantMembershipId"));
 CREATE TABLE "Worker"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",name text NOT NULL,phone text,active boolean DEFAULT true,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP,UNIQUE("projectId",phone));
 CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text,"entityType" text,"entityId" text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);`;
const sqlState=value=>typeof value==='string'&&/^(?:[0-9]{2}|0[A-Z]|2[A-Z]|3[BDF]|F0|HV|P0|XX)[0-9A-Z]{3}$/.test(value)?value:null;
let failureContext={stage:'TARGET_GUARD',check:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false,adminClosed:false,sqlCode:null};

export async function verifyParticipantCivilPostgres(environment=process.env){
 failureContext={stage:'TARGET_GUARD',check:null,completedCheckCount:0,poolClosed:false,databaseRemoved:false,adminClosed:false,sqlCode:null};
 const target=participantCivilDisposableUrl(environment),root=process.cwd(),revision=git(root,['rev-parse','HEAD']),tree=git(root,['rev-parse','HEAD^{tree}']);assert.match(revision,/^[a-f0-9]{40}$/);
 assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'','Native verification requires committed clean tracked sources');
 const exactCi=environment.CI==='true';if(exactCi){assert.match(environment.GITHUB_SHA||'',/^[a-f0-9]{40}$/);assert.equal(environment.GITHUB_SHA,revision,'CI must execute the exact event SHA');}
 const sourceManifest=participantCivilSourceFiles(root).map(file=>{const committedBlobOid=git(root,['rev-parse','HEAD:'+file]);assert.equal(workingBlob(root,file),committedBlobOid,'Every executed source must exist unchanged in HEAD');return {path:file,sha256:sha(readFileSync(path.join(root,file))),committedSha256:sha(gitBlob(root,file)),committedBlobOid};});
 const database=participantCivilOwnedDatabase('obrasaas_civil_'+randomUUID().replaceAll('-','')),admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000}),checks=[],nativeLockObservations=[],trace=[],dispatchObserver=createParticipantCivilDispatchObserver(),dispatchTransportObservations=[],objects=new Map(),pendingSettlements=new Set(),settlementGates=new Set();
 let connected=false,created=false,removed=false,pool,poolClosed=false,adminClosed=false,cleanupActivityCount=null,uncontrolledFetchAttempts=0,syntheticLoginRequests=0,syntheticCivilGetRequests=0,syntheticBlobWrites=0,barrier=null,time=Date.now();
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{uncontrolledFetchAttempts++;throw Error('PARTICIPANT_CIVIL_UNCONTROLLED_HTTP_REJECTED');};
 async function until(predicate,message){const end=Date.now()+2500;while(Date.now()<end){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail(message);}
 const beginCheck=index=>{failureContext={...failureContext,stage:'NATIVE_CHECK',check:PARTICIPANT_CIVIL_POSTGRES_CHECKS[index],completedCheckCount:checks.length,sqlCode:null};};
 const finishCheck=index=>{assert.equal(checks.length,index);checks.push(PARTICIPANT_CIVIL_POSTGRES_CHECKS[index]);};
 try{
  failureContext.stage='OWNED_DATABASE';await admin.connect();connected=true;let authority=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(authority.db,'obrasaas_cutover_ci');assert.equal(authority.role,'cutover_test');
  participantCivilOwnedDatabase(database);await admin.query(`CREATE DATABASE "${database}"`);created=true;const fixtureUrl=new URL(target);fixtureUrl.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:fixtureUrl.toString(),max:12,connectionTimeoutMillis:5000}));assert.equal((await pool.query('SELECT current_database() AS db')).rows[0].db,database);await pool.query(FIXTURE_SQL);await pool.query('INSERT INTO fixture_clock VALUES(1,$1)',[new Date(time)]);
  const engine=(await pool.query(`SELECT current_setting('server_version') AS version,current_setting('server_version_num') AS "versionNum"`)).rows[0];failureContext.stage='SEED_CANONICAL';
  await pool.query(`INSERT INTO "Organization" VALUES('company-civil-a','Synthetic A','org_CivilA','{}'),('company-civil-b','Synthetic B','org_CivilB','{}');
   INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('civil-manager','user_CivilManager','manager@example.invalid'),('civil-director','user_CivilDirector','director@example.invalid'),('civil-foreign','user_CivilForeign','foreign@example.invalid');
   INSERT INTO "TenantMembership"(id,"organizationId","userId","tenantRole","clerkRole",status) VALUES('civil-manager-m','company-civil-a','civil-manager','ADMIN','org:admin','ACTIVE'),('civil-director-m','company-civil-a','civil-director','DIRECTOR','org:member','ACTIVE'),('civil-foreign-m','company-civil-b','civil-foreign','ADMIN','org:admin','ACTIVE');`);
  const session=(userId,organizationId='org_CivilA',organizationRole='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId,organizationId,organizationRole});
  const manager={session:session('user_CivilManager','org_CivilA','org:admin'),member:{actorId:'civil-manager',membershipId:'civil-manager-m',organizationId:'company-civil-a',role:'ADMIN'}},director={session:session('user_CivilDirector'),member:{actorId:'civil-director',membershipId:'civil-director-m',organizationId:'company-civil-a',role:'DIRECTOR'}},foreign={session:session('user_CivilForeign','org_CivilB','org:admin'),member:{actorId:'civil-foreign',membershipId:'civil-foreign-m',organizationId:'company-civil-b',role:'ADMIN'}};
  for(const actor of [manager,director,foreign])actor.scope=scopeStamp(actor.session,actor.member);
  const sqlClock=sql=>sql.replaceAll('clock_timestamp()','public.fixture_clock_timestamp()');
  const connect=async()=>{const native=await pool.connect(),caller=dispatchObserver.trackClient(native.processID);return {release:broken=>{native.release(broken);caller.released();},query:async(sql,args=[])=>{
   const stage=sql.startsWith('BEGIN')?'BEGIN':sql==='COMMIT'||sql==='ROLLBACK'?sql:sql.includes('pg_advisory_xact_lock')?'ADVISORY':sql.includes('FOR UPDATE OF p')?'PROJECT_LOCK':sql.includes('FROM public."Worker"')&&sql.endsWith('FOR UPDATE')?'WORKER_LOCK':null;
   if(stage)trace.push({pid:native.processID,stage,phase:'REQUEST',readOnly:stage==='BEGIN'?sql.includes('READ ONLY'):null});let result;try{result=await native.query(sqlClock(sql),args);}catch(error){failureContext.sqlCode=sqlState(error?.code)||failureContext.sqlCode;throw error;}if(stage){caller.acquired(stage,stage==='BEGIN'?sql.includes('READ ONLY'):null);trace.push({pid:native.processID,stage,phase:'ACQUIRED',readOnly:stage==='BEGIN'?sql.includes('READ ONLY'):null});}
   if(barrier&&stage==='WORKER_LOCK'&&args[0]===barrier.workerId&&!barrier.held){barrier.held=true;barrier.pid=native.processID;barrier.reached.resolve();await barrier.release.promise;}
   return result;
  }};};
  const workspace=createWorkspaceStore({connect});
  const {get,put}=createParticipantCivilBlobAdapter({objects,onPut:()=>{syntheticBlobWrites++;}});
  const uploader=createPrivateImageUploader({get,put,environment:()=>({PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'synthetic-civil-blob-token-only'})});
  const template={version:BINDX_CIVIL_CONFIGURATION_VERSION,state:'CONFIRMED',product:'RENAPER_CIVIL_DATA',origin:'https://apistore.pcnt.io',authentication:'JWT',credentials:{username:'synthetic-civil',password:'synthetic-civil'},providerEvidence:{reference:'synthetic-provider-contract',confirmedAt:new Date(time-60000).toISOString(),confirmed:true,origin:'https://apistore.pcnt.io',product:'RENAPER_CIVIL_DATA',authentication:'JWT',responseSchema:BINDX_CIVIL_RESPONSE_SCHEMA,environmentConfirmed:true},renaperAgreement:{reference:'synthetic-renaper-agreement',confirmedAt:new Date(time-60000).toISOString(),confirmed:true},notice:{version:BINDX_CIVIL_CONSENT_VERSION,text:'Aviso exclusivamente sintético del harness civil PostgreSQL.',sha256:null}};template.notice.sha256=civilSha(template.notice.text);
  async function seed(label){
   assert.match(label,/^[A-Za-z0-9]+$/);const projectId='civil-project-'+label,workerId='civil-worker-'+label,actorId='civil-holder-'+label,membershipId=actorId+'-m',clerkUserId='user_CivilHolder'+label;
   await pool.query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[actorId,clerkUserId,label.toLowerCase()+'@example.invalid']);await pool.query(`INSERT INTO "TenantMembership"(id,"organizationId","userId","tenantRole","clerkRole",status) VALUES($1,'company-civil-a',$2,'AUDITOR','org:member','ACTIVE')`,[membershipId,actorId]);
   await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,'company-civil-a','Synthetic civil project','ACTIVE','{"retained":true}')`,[projectId]);await pool.query(`INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES($1,$2,$3,'ACTIVE')`,['civil-pm-'+label,projectId,membershipId]);
   const metadata={retained:true,participant:{version:1,status:'ACTIVE',clerkUserId,permissions:{attendance:false,report:false},kyc:{status:'NOT_SUBMITTED'}}};await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES($1,$2,'Synthetic civil holder',$3,true,$4::jsonb)`,[workerId,projectId,'+1555000'+String(objects.size).padStart(4,'0'),JSON.stringify(metadata)]);
   const holder={session:session(clerkUserId),member:{actorId,membershipId,organizationId:'company-civil-a',role:'AUDITOR'}};holder.scope=scopeStamp(holder.session,holder.member);
   const f={projectId,workerId,holder,configuration:template,response:()=>Response.json(facts),afterQuery:null,settlementGate:null,settlementCommitAckGate:null,settlementCommitApplied:false,settlementAckReleased:false,observerTimeoutMs:6000,crash:false,loginRequests:0,queryRequests:0,factoryCalls:0};
   f.row=async()=>(await pool.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1 AND "projectId"=$2`,[workerId,projectId])).rows[0];
   f.context=async(actor=manager,operationId=null)=>({projectId,scope:actor.scope,workerId,submissionId:(await f.row()).metadata.participant.kyc.submissionId,...(operationId?{operationId}:{})});
   f.store=()=>{const store=createParticipantStore({assessCaptureQuality:syntheticCaptureQuality,workspace,connect:async()=>{const work=(async()=>{
    if(f.settlementGate)await f.settlementGate.promise;const native=await connect(),ackGate=f.settlementCommitAckGate;if(!ackGate)return native;
    return {release:broken=>{native.release(broken);f.settlementAckReleased=true;},query:async(...args)=>{const result=await native.query(...args);if(args[0]==='COMMIT'){f.settlementCommitApplied=true;await ackGate.promise;}return result;}};
   })();pendingSettlements.add(work);work.finally(()=>pendingSettlements.delete(work)).catch(()=>{});return work;},upload:uploader.uploadImageToBlob,get,civilConfiguration:()=>f.configuration,civilClientFactory:options=>{
    f.factoryCalls++;if(f.crash)return {lookup:async()=>{throw Error('Synthetic interrupted civil client');}};
    return createBindxCivilDataClient({...options,technicalObservationTimeoutMs:f.observerTimeoutMs,clock:()=>time,fetchImpl:async(value,request)=>{
     const url=new URL(value);assert.equal(url.origin,'https://apistore.pcnt.io');dispatchTransportObservations.push({...dispatchObserver.beforeExternal(),method:request.method});
     const attempts=(await pool.query(`SELECT metadata FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.civil.attempt'`,[workerId])).rows;assert.equal(attempts.length,1);assert.equal(attempts[0].metadata.state,'DISPATCHING');assert.ok(attempts[0].metadata.claimId);
     if(request.method==='POST'){assert.equal(url.pathname,'/v1/login/jwt');syntheticLoginRequests++;f.loginRequests++;return Response.json({token:'synthetic.civil.token'});}
     assert.equal(request.method,'GET');assert.equal(url.pathname,'/v1/information/person-renaper/00012345/gender/F');syntheticCivilGetRequests++;f.queryRequests++;if(f.afterQuery)await f.afterQuery();return f.response();
    }});
   }});return {...store,civilDispatch:(...args)=>dispatchObserver.run(()=>store.civilDispatch(...args))};};
   const row=await f.row(),submitted=await f.store().submitKyc(holder.session,{projectId,scope:holder.scope,workerId,revision:row.revision,operationId:randomUUID(),noticeVersion:PARTICIPANT_NOTICE_VERSION,consent:true,front:picture.toString('base64'),selfie:picture.toString('base64')});assert.equal(submitted.saved,true);assert.equal(submitted.participant.kyc.status,'PENDING_REVIEW');
   f.prepare=async(actor=manager,id=randomUUID())=>f.store().civilPrepare(actor.session,{...await f.context(actor,id),revision:(await f.row()).revision});
   f.authorize=async(actor=manager)=>{const prepared=await f.prepare(actor),operationId=prepared.civil.attempt.operationId,input={...await f.context(holder,operationId),attemptDigest:prepared.civil.attempt.attemptDigest,noticeVersion:template.notice.version,noticeSha256:template.notice.sha256,consent:true,dni:'00012345',gender:'F'};await f.store().civilConsent(holder.session,input);return {prepared,operationId,input:await f.context(actor,operationId)};};
   f.attempts=async()=>(await pool.query(`SELECT metadata FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.civil.attempt'`,[workerId])).rows.map(item=>item.metadata);
   f.observations=async()=>(await pool.query(`SELECT metadata FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.civil.observation'`,[workerId])).rows.map(item=>item.metadata);
   return f;
  }
  async function lockRace(firstActorKind){
   const f=await seed('Lock'+firstActorKind),first=firstActorKind==='Manager'?manager:f.holder,second=firstActorKind==='Manager'?f.holder:manager;barrier={workerId:f.workerId,held:false,reached:deferred(),release:deferred()};let a,b;
   try{
    a=f.prepare(first);a.catch(()=>{});await until(()=>barrier.held,'First actor must acquire the actual Worker lock');b=f.prepare(second);b.catch(()=>{});
    let waiting=[];await until(async()=>{waiting=(await pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query LIKE '%FOR UPDATE OF p%'`,[database])).rows;return waiting.length>0;},'Second actor must wait for the native Project lock');
    const holderPid=barrier.pid;for(const item of waiting){assert.notEqual(item.pid,holderPid);const events=trace.filter(event=>event.pid===item.pid),start=events.findLastIndex(event=>event.stage==='BEGIN'&&event.phase==='REQUEST'),current=events.slice(start+1);assert.ok(current.some(event=>event.stage==='PROJECT_LOCK'&&event.phase==='REQUEST'));assert.equal(current.some(event=>event.stage==='WORKER_LOCK'),false,'Canonical Project lock precedes civil Worker locks');}
    barrier.release.resolve();const results=await Promise.allSettled([a,b]);assert.equal(results.filter(result=>result.status==='fulfilled').length,1);assert.equal(results.find(result=>result.status==='rejected').reason.code,'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED');assert.equal((await f.attempts()).length,1);assert.equal(f.queryRequests,0);nativeLockObservations.push({firstActor:firstActorKind.toUpperCase(),secondActor:firstActorKind==='Manager'?'HOLDER':'MANAGER',sameProject:true,nativeProjectLockWaiters:waiting.length,waitingBeforeWorker:true,civilOrganizationPrehook:false,bothSettled:true});
   }finally{barrier?.release.resolve();barrier=null;await Promise.allSettled([a,b].filter(Boolean));}
  }
  beginCheck(0);const closed=await seed('Closed');closed.configuration=null;const beforeClosed=(await closed.row()).metadata,closedRead=await closed.store().civilRead(closed.holder.session,await closed.context(closed.holder)),closedPrepare=await closed.prepare();for(const value of [closedRead,closedPrepare]){assert.equal(value.civil.state,'CONTRACT_PENDING');assert.equal(value.civil.notice,null);assert.equal(value.civil.available,false);}assert.equal(closed.factoryCalls,0);assert.equal((await closed.attempts()).length,0);assert.deepEqual((await closed.row()).metadata,beforeClosed);finishCheck(0);
  beginCheck(1);const exact=await seed('Exact'),exactOperation=await exact.authorize();assert.equal((await exact.attempts())[0].state,'CONSENT_RECORDED');assert.equal((await exact.row()).metadata.participant.kyc.civilConsent.clerkUserId,exact.holder.session.userId);assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE "entityId"=$1 AND action='participant.operation.recorded' AND metadata->>'kind'='KYC_SUBMITTED'`,[exact.workerId])).rows[0].n,1);assert.equal(exact.queryRequests,0);finishCheck(1);
  beginCheck(2);await lockRace('Manager');finishCheck(2);beginCheck(3);await lockRace('Holder');finishCheck(3);
  beginCheck(4);const concurrent=await seed('Concurrent'),concurrentOperation=await concurrent.authorize(),entered=deferred(),release=deferred();concurrent.afterQuery=async()=>{entered.resolve();await release.promise;};let running=concurrent.store().civilDispatch(manager.session,concurrentOperation.input);running.catch(()=>{});try{await until(()=>concurrent.queryRequests===1,'First instance must reach one actual synthetic civil GET');const held=await concurrent.store().civilDispatch(manager.session,concurrentOperation.input);assert.equal(held.civil.state,'DISPATCHING');assert.equal(concurrent.factoryCalls,1);release.resolve();assert.equal((await running).civil.state,'OBSERVED');assert.equal(concurrent.loginRequests,1);assert.equal(concurrent.queryRequests,1);assert.equal((await concurrent.observations()).length,1);}finally{release.resolve();await Promise.allSettled([running]);}finishCheck(4);
  beginCheck(5);const unknown=await seed('Unknown'),unknownOperation=await unknown.authorize();unknown.response=()=>Response.json({verified:true});assert.equal((await unknown.store().civilDispatch(manager.session,unknownOperation.input)).civil.state,'UNKNOWN');time+=365*86400000;await pool.query('UPDATE fixture_clock SET now=$1 WHERE id=1',[new Date(time)]);await unknown.store().civilDispatch(manager.session,unknownOperation.input);for(const actor of [manager,director])await assert.rejects(unknown.prepare(actor),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});assert.equal(unknown.queryRequests,1);assert.equal((await unknown.observations())[0].observation.queryAttempted,true);finishCheck(5);
  beginCheck(6);const interrupted=await seed('Interrupted'),interruptedOperation=await interrupted.authorize();interrupted.crash=true;assert.equal((await interrupted.store().civilDispatch(manager.session,interruptedOperation.input)).civil.state,'UNKNOWN');interrupted.crash=false;await interrupted.store().civilDispatch(manager.session,interruptedOperation.input);await assert.rejects(interrupted.prepare(),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});assert.equal(interrupted.factoryCalls,1);assert.equal(interrupted.queryRequests,0);finishCheck(6);
  beginCheck(7);const revoked=await seed('Revoked'),revokedOperation=await revoked.authorize();revoked.afterQuery=()=>pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id=$1`,[manager.member.membershipId]);await assert.rejects(revoked.store().civilDispatch(manager.session,revokedOperation.input),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});assert.equal((await revoked.attempts())[0].state,'OBSERVED');assert.deepEqual((await revoked.observations())[0].observation.data,facts);await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id=$1`,[manager.member.membershipId]);finishCheck(7);
  beginCheck(8);const changedHolder=await seed('ChangedHolder'),changedHolderOperation=await changedHolder.authorize();await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,clerkUserId}','"user_ReplacedHolder"'::jsonb) WHERE id=$1`,[changedHolder.workerId]);await assert.rejects(changedHolder.store().civilDispatch(manager.session,changedHolderOperation.input),{code:'PARTICIPANT_CIVIL_PRESENTATION_CHANGED'});assert.equal(changedHolder.queryRequests,0);finishCheck(8);
  beginCheck(9);for(const kind of ['MissingConsent','ChangedConsent']){const f=await seed(kind),op=await f.authorize(),a=(await f.attempts())[0];if(kind==='MissingConsent')await pool.query(`DELETE FROM "AuditLog" WHERE id=$1 AND action='participant.civil.consent'`,[a.consentReference]);else await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,civilConsent,dni}','"99999999"'::jsonb) WHERE id=$1`,[f.workerId]);await assert.rejects(f.store().civilDispatch(manager.session,op.input),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal(f.queryRequests,0);}finishCheck(9);
  beginCheck(10);const holderRevoked=await seed('HolderRevoked'),holderRevokedOperation=await holderRevoked.authorize();holderRevoked.afterQuery=()=>pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id=$1`,[holderRevoked.holder.member.membershipId]);await assert.rejects(holderRevoked.store().civilDispatch(manager.session,holderRevokedOperation.input),{code:'PARTICIPANT_CIVIL_CONSENT_REQUIRED'});assert.equal((await holderRevoked.attempts())[0].state,'OBSERVED');assert.equal((await holderRevoked.store().civilRead(manager.session,holderRevokedOperation.input)).civil.attempt.data,null);await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id=$1`,[holderRevoked.holder.member.membershipId]);finishCheck(10);
  beginCheck(11);const recovered=await revoked.store().civilRead(manager.session,revokedOperation.input);assert.deepEqual(recovered.civil.attempt.data,facts);await assert.rejects(revoked.store().civilRead(foreign.session,{...revokedOperation.input,scope:foreign.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});const previous=await revoked.row(),submissionId='synthetic-replacement-'+randomUUID().replaceAll('-','');await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,submissionId}',to_jsonb($2::text)) WHERE id=$1`,[revoked.workerId,submissionId]);await pool.query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,'company-civil-a',$2,'participant.operation.recorded','Worker',$3,$4::jsonb)`,['replacement-'+submissionId,revoked.holder.member.actorId,revoked.workerId,JSON.stringify({version:1,projectId:revoked.projectId,kind:'KYC_SUBMITTED',submissionId,noticeVersion:PARTICIPANT_NOTICE_VERSION,contentHash:previous.metadata.participant.kyc.contentHash})]);await assert.rejects(revoked.store().civilRead(manager.session,revokedOperation.input),{code:'PARTICIPANT_CIVIL_PRESENTATION_REQUIRED'});assert.equal((await revoked.store().civilRead(manager.session,await revoked.context())).civil.attempt.data,null);await assert.rejects(revoked.prepare(),{code:'PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED'});finishCheck(11);
  beginCheck(12);await assert.rejects(exact.store().civilDispatch(manager.session,{...exactOperation.input,dni:'00012345',gender:'F'}),{code:'PARTICIPANT_CIVIL_INPUT_INVALID'});const forged=await exact.store().civilRead(manager.session,exactOperation.input),consentInput={...await exact.context(exact.holder,exactOperation.operationId),attemptDigest:'f'.repeat(64),noticeVersion:template.notice.version,noticeSha256:template.notice.sha256,consent:true,dni:'00012345',gender:'F'};assert.equal(forged.civil.state,'CONSENT_RECORDED');await assert.rejects(exact.store().civilConsent(exact.holder.session,consentInput),{code:'PARTICIPANT_CIVIL_CONSENT_BINDING_REJECTED'});assert.equal(exact.queryRequests,0);finishCheck(12);
  beginCheck(13);const late=await seed('Late'),lateOperation=await late.authorize();late.settlementGate=deferred();settlementGates.add(late.settlementGate);late.observerTimeoutMs=20;const heldLate=await late.store().civilDispatch(manager.session,lateOperation.input);assert.equal(heldLate.civil.state,'DISPATCHING');assert.equal(heldLate.civil.attempt.data,null);assert.equal((await late.observations()).length,0);assert.equal((await late.store().civilDispatch(manager.session,lateOperation.input)).civil.state,'DISPATCHING');late.settlementGate.resolve();await until(async()=>(await late.attempts())[0].state==='OBSERVED','The one late technical receipt must commit');const lateObservations=await late.observations();assert.equal(lateObservations.length,1);assert.equal(lateObservations[0].observation.state,'OBSERVED');assert.deepEqual((await late.store().civilRead(manager.session,lateOperation.input)).civil.attempt.data,facts);assert.equal(late.queryRequests,1);
  const lateAck=await seed('LateAck'),lateAckOperation=await lateAck.authorize();lateAck.settlementCommitAckGate=deferred();settlementGates.add(lateAck.settlementCommitAckGate);lateAck.observerTimeoutMs=1000;
  const unconfirmedAck=await lateAck.store().civilDispatch(manager.session,lateAckOperation.input);assert.equal(lateAck.settlementCommitApplied,true,'The native technical COMMIT must apply before its withheld ACK');assert.equal(lateAck.settlementAckReleased,false);assert.equal(unconfirmedAck.civil.state,'OBSERVED');assert.equal(unconfirmedAck.civil.code,'PARTICIPANT_CIVIL_RESULT_UNCONFIRMED');assert.equal(unconfirmedAck.civil.attempt.data,null,'This POST cannot expose private facts after the observer deadline');assert.equal((await lateAck.attempts())[0].state,'OBSERVED');assert.equal((await lateAck.observations()).length,1);
  lateAck.settlementCommitAckGate.resolve();await until(()=>lateAck.settlementAckReleased,'The original technical caller must eventually release after its late ACK');assert.equal((await lateAck.observations()).length,1);assert.equal((await lateAck.observations())[0].observation.state,'OBSERVED');assert.deepEqual((await lateAck.store().civilRead(manager.session,lateAckOperation.input)).civil.attempt.data,facts,'A future explicit authorized GET may recover the same durable observation');assert.equal(lateAck.queryRequests,1);finishCheck(13);
  beginCheck(14);const beforeRead=(await pool.query(`SELECT id,metadata FROM "AuditLog" ORDER BY id`)).rows,beforeRequests=syntheticCivilGetRequests,traceStart=trace.length;await unknown.store().civilRead(manager.session,unknownOperation.input);await late.store().civilRead(late.holder.session,await late.context(late.holder,lateOperation.operationId));assert.deepEqual((await pool.query(`SELECT id,metadata FROM "AuditLog" ORDER BY id`)).rows,beforeRead);assert.equal(syntheticCivilGetRequests,beforeRequests);const readTransactions=trace.slice(traceStart).filter(event=>event.stage==='BEGIN'&&event.phase==='ACQUIRED');assert.ok(readTransactions.length>=2);assert.ok(readTransactions.every(event=>event.readOnly===true));finishCheck(14);
  beginCheck(15);const civilMarkers=(await pool.query(`SELECT metadata FROM "AuditLog" WHERE action='participant.civil.observation'`)).rows;for(const item of civilMarkers){const observation=item.metadata.observation;assert.equal(observation.identityCertified,false);assert.equal(observation.biometricsVerified,false);assert.equal(observation.livenessVerified,false);assert.equal(observation.permissionsGranted,false);assert.equal(observation.requiresHumanReview,true);assert.doesNotMatch(JSON.stringify(item),/00012345|private\.blob|synthetic\.civil\.token|synthetic-civil-blob-token/);}assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "Worker" WHERE metadata->'participant'->'kyc'->>'status'='APPROVED' OR metadata->'participant'->'permissions'->>'attendance'='true' OR metadata->'participant'->'permissions'->>'report'='true'`)).rows[0].n,0);assert.equal(uncontrolledFetchAttempts,0);assert.ok(syntheticBlobWrites>=2);assert.ok(syntheticLoginRequests>0);assert.ok(syntheticCivilGetRequests>0);finishCheck(15);
  assert.deepEqual(checks,[...PARTICIPANT_CIVIL_POSTGRES_CHECKS]);assert.equal(nativeLockObservations.length,2);assert.equal(dispatchTransportObservations.length,syntheticLoginRequests+syntheticCivilGetRequests);assert.ok(dispatchTransportObservations.every(item=>item.reservationCommitted&&item.callerClientsReleased));assert.equal(trace.some(event=>event.stage==='ADVISORY'),false,'The current civil module has no organization prehook');assert.equal(git(root,['rev-parse','HEAD']),revision);assert.equal(git(root,['rev-parse','HEAD^{tree}']),tree);assert.equal(git(root,['status','--porcelain','--untracked-files=no']),'');for(const item of sourceManifest){assert.equal(sha(readFileSync(path.join(root,item.path))),item.sha256);assert.equal(sha(gitBlob(root,item.path)),item.committedSha256);assert.equal(workingBlob(root,item.path),item.committedBlobOid);}failureContext.engine=engine;
 }finally{
  barrier?.release.resolve();for(const gate of settlementGates)gate.resolve();globalThis.fetch=originalFetch;let cleanupError;
  try{await Promise.allSettled([...pendingSettlements]);if(pool){await closeDisposablePool(pool);poolClosed=true;failureContext.poolClosed=true;}}catch(error){cleanupError=error;}
  try{if(connected&&created){participantCivilOwnedDatabase(database);const authority=(await admin.query('SELECT current_database() AS db,current_user AS role')).rows[0];assert.equal(authority.db,'obrasaas_cutover_ci');assert.equal(authority.role,'cutover_test');cleanupActivityCount=(await admin.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[database])).rows[0].n;assert.equal(cleanupActivityCount,0,'Every owned fixture socket must close before DROP DATABASE');await admin.query(`DROP DATABASE "${database}"`);removed=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rows.length===0;failureContext.databaseRemoved=removed;}}catch(error){cleanupError||=error;}finally{if(connected){await admin.end();adminClosed=true;failureContext.adminClosed=true;}}
  if(cleanupError)throw cleanupError;
 }
 assert.equal(poolClosed,true);assert.equal(removed,true);assert.equal(adminClosed,true);
 return {version:PARTICIPANT_CIVIL_POSTGRES_PROOF_VERSION,status:'PASS',recordedAt:new Date().toISOString(),postgresExecuted:true,environment:'owned-local-disposable-postgresql',engine:failureContext.engine,syntheticOnly:true,totalCheckCount:checks.length,checks,sourceRevision:revision,sourceTree:tree,sourceState:exactCi?'EXACT_CI_SOURCE':'COMMITTED_LOCAL_SOURCE',trackedClean:true,sourceManifest,harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url))),providerTransport:'injected-synthetic-http-only',uncontrolledFetchAttempts,syntheticLoginRequests,syntheticCivilGetRequests,syntheticBlobWrites,realProviderRequests:null,realProviderAcceptanceVerified:false,sqlClock:'synthetic-fixture-clock',civilOrganizationPrehook:false,nativeLockObservations,dispatchTransportObservations,trace,productionDataWritten:false,realIdentityPresented:false,identityApproved:false,identityCertified:false,biometricsVerified:false,livenessVerified:false,financialAccountsCreated:false,paymentAttempted:false,databaseRemoved:removed,poolClosed,cleanup:{poolClosed,databaseRemoved:removed,adminClosed,pgStatActivityBeforeDrop:cleanupActivityCount}};
}

const nativeFailureCodes=new Set([
 'PARTICIPANT_CIVIL_DISPOSABLE_TARGET_REJECTED','PARTICIPANT_CIVIL_OWNED_DATABASE_REJECTED','PARTICIPANT_CIVIL_NATIVE_UNCONFIRMED',
 'PARTICIPANT_CIVIL_INPUT_INVALID','PARTICIPANT_CIVIL_OBSERVATION_INVALID','PARTICIPANT_CIVIL_ATTEMPT_REQUIRED','PARTICIPANT_CIVIL_CONFIGURATION_CHANGED','PARTICIPANT_CIVIL_CONSENT_BINDING_REJECTED','PARTICIPANT_CIVIL_CONSENT_REQUIRED','PARTICIPANT_CIVIL_HOLDER_CONSENT_REQUIRED','PARTICIPANT_CIVIL_OBSERVATION_CONFLICT','PARTICIPANT_CIVIL_OPERATOR_REQUIRED','PARTICIPANT_CIVIL_PRESENTATION_CHANGED','PARTICIPANT_CIVIL_PRESENTATION_REQUIRED','PARTICIPANT_CIVIL_RECEIPT_INVALID','PARTICIPANT_CIVIL_RESULT_UNCONFIRMED','PARTICIPANT_CIVIL_SOURCE_ALREADY_RESERVED','PARTICIPANT_CIVIL_STATE_CHANGED','PARTICIPANT_CIVIL_TECHNICAL_UNCONFIRMED','PARTICIPANT_CIVIL_UNCONFIRMED',
 'PARTICIPANT_ACCESS_REQUIRED','PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED','PARTICIPANT_KYC_NOT_PENDING','PARTICIPANT_MANAGE_REQUIRED','PARTICIPANT_PRIVATE_STORAGE_UNCONFIRMED','PARTICIPANT_REVISION_CHANGED','PARTICIPANT_UNAVAILABLE','PARTICIPANT_KYC_INTEGRITY','PARTICIPANT_KYC_IMAGE_UNAVAILABLE','PARTICIPANT_KYC_ALREADY_SUBMITTED','PARTICIPANT_OPERATION_UNCONFIRMED','PARTICIPANT_RECEIPT_INVALID',
 'WORKSPACE_CONTEXT_CHANGED','WORKSPACE_DATABASE_UNAVAILABLE','WORKSPACE_ORGANIZATION_REQUIRED','WORKSPACE_MEMBERSHIP_REQUIRED','WORKSPACE_OPERATION_UNCONFIRMED','WORKSPACE_ORGANIZATION_PERMISSION_REQUIRED','WORKSPACE_PROJECT_INVALID','WORKSPACE_PROJECT_UNAVAILABLE','WORKSPACE_QUERY_INVALID',
 'PRIVATE_IMAGE_ADAPTER_INVALID','PRIVATE_IMAGE_CONFIRMATION_PENDING','PRIVATE_IMAGE_FILENAME_INVALID','PRIVATE_IMAGE_IDENTITY_REQUIRED','PRIVATE_IMAGE_INVALID','PRIVATE_IMAGE_PROVIDER_REQUIRED','PRIVATE_IMAGE_RECEIPT_MISMATCH','PRIVATE_IMAGE_REQUEST_INVALID','PRIVATE_IMAGE_STORAGE_NOT_CONFIGURED','PRIVATE_IMAGE_STORAGE_UNAVAILABLE','PRIVATE_IMAGE_TOO_LARGE','PRIVATE_IMAGE_TYPE_MISMATCH',
]);
export function participantCivilPostgresFailure(error,{root=process.cwd(),context=failureContext}={}){
 const name=['AssertionError','TypeError','WorkspaceError','PrivateImageError','Error'].includes(error?.name)?error.name:'Error',relativeRoot=(root.startsWith('/')?path.posix.normalize(root):path.resolve(root).replaceAll('\\','/')).replace(/\/$/,'')+'/',locations=[];
 for(const line of typeof error?.stack==='string'?error.stack.split('\n').slice(1,65):[]){
  let normalized=line.replaceAll('\\','/');normalized=normalized.replace(/file:\/\/\/[^\s)]+/g,reference=>{try{const value=new URL(reference.replace(/:\d+:\d+$/,''));if(value.hostname||value.search||value.hash)return '';return decodeURIComponent(value.pathname).replace(/^\/([A-Za-z]:\/)/,'$1')+(reference.match(/:\d+:\d+$/)?.[0]||'');}catch{return '';}});
  const at=normalized.indexOf(relativeRoot);if(at<0)continue;const relative=normalized.slice(at+relativeRoot.length),match=/^(?:src|scripts|tests)\/[A-Za-z0-9_./-]+\.(?:mjs|js):[1-9]\d{0,6}:[1-9]\d{0,6}/.exec(relative);if(match&&!match[0].includes('..'))locations.push(match[0]);
 }
 return {version:PARTICIPANT_CIVIL_POSTGRES_PROOF_VERSION,status:'FAILED',stage:['TARGET_GUARD','OWNED_DATABASE','SEED_CANONICAL','NATIVE_CHECK','CLEANUP'].includes(context.stage)?context.stage:'TARGET_GUARD',check:PARTICIPANT_CIVIL_POSTGRES_CHECKS.includes(context.check)?context.check:null,completedCheckCount:Number.isInteger(context.completedCheckCount)&&context.completedCheckCount>=0&&context.completedCheckCount<=PARTICIPANT_CIVIL_POSTGRES_CHECKS.length?context.completedCheckCount:0,errorName:name,code:nativeFailureCodes.has(error?.code)?error.code:'PARTICIPANT_CIVIL_NATIVE_UNCONFIRMED',sqlCode:sqlState(error?.code)||sqlState(error?.cause?.code)||sqlState(context.sqlCode),locations:[...new Set(locations)].slice(0,8),poolClosed:context.poolClosed===true,databaseRemoved:context.databaseRemoved===true,adminClosed:context.adminClosed===true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 verifyParticipantCivilPostgres().then(proof=>{const out=path.resolve('.vercel/private/participant-civil-postgres.json');mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({status:proof.status,totalCheckCount:proof.totalCheckCount,postgresExecuted:proof.postgresExecuted,poolClosed:proof.poolClosed,databaseRemoved:proof.databaseRemoved,syntheticCivilGetRequests:proof.syntheticCivilGetRequests,realProviderRequests:proof.realProviderRequests}));}).catch(error=>{const proof=participantCivilPostgresFailure(error),out=path.resolve('.vercel/private/participant-civil-postgres-failure.json');mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(proof,null,2)+'\n');console.error(JSON.stringify({status:proof.status,stage:proof.stage,check:proof.check,errorName:proof.errorName,code:proof.code}));process.exitCode=1;});
}
