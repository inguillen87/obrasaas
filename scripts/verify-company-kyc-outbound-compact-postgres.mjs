import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Client,Pool} from 'pg';
import {parse} from '@babel/parser';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createCompanyChannelStore} from '../src/lib/company-channel-store.mjs';
import {createOwnCompanyConnection} from '../src/lib/meta-own-company-connection.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {resolveMetaKycAuthority,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {hasCompanyKycOutboundAuthority,prepareLockedCompanyKycOutboundAuthority,fenceLockedCompanyKycOutboundAuthority,releaseLockedCompanyKycOutboundAuthority} from '../src/lib/company-channel-kyc.mjs';
import {lockOwnCompanyIssuer,META_OWN_COMPANY_AUTHORIZATION_CODES} from '../src/lib/meta-own-company-policy.mjs';
import {createMetaCustomerInbox,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {customerJobTransaction,customerOutboundId,readCustomerOutboundDiagnostic} from '../src/lib/meta-customer-outbound.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {ownCompanyFixture} from '../tests/fixtures/own-company-meta.mjs';
import {COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL} from './lib/company-channel-disposable-fixture.mjs';
import {executeCompanyChannelAdoption} from './lib/company-channel-migration.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {companyKycRejectionFeedbackDisposableUrl} from './verify-company-kyc-rejection-feedback-postgres.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const producer='scripts/verify-company-kyc-outbound-compact-postgres.mjs';
const baselineFixture='tests/fixtures/meta-kyc-outbound-baseline-b572.json';
export const COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION='company-kyc-outbound-compact-postgres-v1';
export const COMPANY_KYC_OUTBOUND_COMPACT_CHECKS=Object.freeze([
 'native-canonical-OWN-COMPANY-KYC-start-four-full-resolutions-seventeen-compact-sixteen-runtime-fences-one-POST-no-consent-or-permissions',
 'native-distinct-participant-and-issuer-distinct-anchor-and-target-preserve-projection-and-credential-context',
 'real-original-60s-source-lease-survives-controlled-225ms-every-SQL-and-200ms-every-Graph',
 'same-controlled-delay-baseline-outbound-repeated-discovery-expires-original-lease-before-first-POST',
 'fault-between-reserve-and-first-Graph-retains-first-private-enum-cause-and-never-replays',
 'source-lease-expired-after-reservation-zero-POST-no-replay',
 'current-issuer-revoked-after-reservation-zero-POST-no-replay',
 'finite-credential-rotation-after-reservation-zero-POST-no-replay',
 'same-transaction-principal-ABA-with-revision-and-authority-trail-change-denies-before-first-Graph',
 'expiry-between-final-KYC-and-runtime-clock-denies-first-POST-no-capability-extension',
 'provider-POST-lost-ACK-private-enum-cause-SEND_UNKNOWN-no-message-id-never-second-POST',
 'native-seal-rejects-forged-object-other-client-context-reply-Date-mutation-and-release',
 'native-same-client-new-transaction-cannot-prepare-or-reuse-previous-resolver-authority',
]);
export function companyKycOutboundCompactProofOutput(args=[],root=process.cwd()){
 assert.ok(args.length===0||args.length===2&&args[0]==='--output','Expected an optional --output proof path');
 const directory=path.resolve(root,'.vercel/private'),output=path.resolve(root,args[1]||'.vercel/private/company-kyc-outbound-compact-postgres.json');
 assert.equal(path.dirname(output),directory,'Native proof must stay in the private evidence directory');
 assert.match(path.basename(output),/^company-kyc-outbound-compact-postgres(?:-[A-Za-z0-9-]+)?\.json$/);
 return output;
}
export function companyKycOutboundCompactSourceFiles(root=process.cwd()){
 const workspace=path.resolve(root),files=new Set(['package.json','package-lock.json',baselineFixture]);
 const visit=file=>{assert.ok(/^(src|scripts|tests)\//.test(file)&&path.resolve(workspace,file).startsWith(workspace+path.sep));if(files.has(file))return;files.add(file);
  const tree=parse(readFileSync(path.join(workspace,file),'utf8'),{sourceType:'module',plugins:['jsx'],createImportExpressions:true});
  const walk=node=>{if(!node||typeof node!=='object')return;const ref=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)?node.source:node.type==='CallExpression'&&node.callee?.type==='Import'?node.arguments[0]:null;
   if(ref?.type==='StringLiteral'&&ref.value.startsWith('.'))visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),ref.value)));
   // The only computed module is the immutable baseline whose exact original
   // imports are transformed to the same pinned local dependency closure.
   if((node.type==='ImportExpression'||node.type==='CallExpression'&&node.callee?.type==='Import')&&ref?.type!=='StringLiteral')assert.equal(file,producer,'Unbounded dynamic dependency in native fixture closure');
   for(const value of Object.values(node))if(Array.isArray(value)){for(const child of value)walk(child);}else if(value&&typeof value==='object')walk(value);
  };walk(tree);
 };visit(producer);return [...files].sort();
}
const initialRead='SELECT id,"projectId",provider,"eventType","externalId",status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1';
export async function verifyCompanyKycOutboundCompactPostgres(environment=process.env){
 const target=companyKycRejectionFeedbackDisposableUrl(environment),database='obrasaas_kyc_compact_'+randomUUID().replaceAll('-','');
 assert.match(database,/^obrasaas_kyc_compact_[a-f0-9]{32}$/);
 const admin=new Client({connectionString:target.toString(),connectionTimeoutMillis:5000}),checks=[],measurements=[],scenarios=[];
 let pool,created=false,removed=false,connected=false,poolClosed=false,adminClosed=false,proof,sequence=0,currentEvent=null,afterReserve=async()=>{},statementDelayMs=0,graphDelayMs=0,fenceHook=null,runtimeHook=null;
 const queries=[],originalFetch=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('KYC_COMPACT_UNCONTROLLED_HTTP_REJECTED');};
 try{
  await admin.connect();connected=true;assert.equal((await admin.query('SELECT current_database() AS db')).rows[0].db,'obrasaas_cutover_ci');
  await admin.query(`CREATE DATABASE "${database}"`);created=true;const child=new URL(target);child.pathname='/'+database;
  pool=trackDisposablePool(new Pool({connectionString:child.toString(),max:8,connectionTimeoutMillis:5000}));await pool.query(COMPANY_CHANNEL_DISPOSABLE_FIXTURE_SQL);
  await pool.query(`CREATE TYPE "SystemRole" AS ENUM('TENANT_USER');ALTER TABLE "PlatformUser" ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'TENANT_USER';ALTER TABLE "Worker" ADD COLUMN role text;ALTER TABLE "Organization" ADD COLUMN "subscriptionPlan" text DEFAULT 'PRO',ADD COLUMN "subscriptionStatus" text DEFAULT 'ACTIVE';ALTER TABLE "WhatsAppConnection" ADD COLUMN "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,ADD COLUMN "updatedAt" timestamp(3) NOT NULL`);
  const f=ownCompanyFixture(),channelEnvironment=f.environment;f.debug.expires_at=Math.floor((f.time+24*3600000)/1000);
  await pool.query(`UPDATE "Organization" SET metadata=$1::jsonb WHERE id='org-a'`,[JSON.stringify(f.context.project.organizationMetadata)]);
  const migration=await pool.connect();try{const dry=await executeCompanyChannelAdoption(migration);await executeCompanyChannelAdoption(migration,{mode:'APPLY',expectedFingerprint:dry.fingerprint});}finally{migration.release();}
  const connect=async()=>{const c=await pool.connect();return {release:bad=>c.release(bad),query:async(sql,args=[])=>{
   if(statementDelayMs)await new Promise(resolve=>setTimeout(resolve,statementDelayMs));
   if(sql.includes('AS "kycNow"')&&fenceHook)await fenceHook(c,sql,args);
   if(sql.includes('AS "runtimeNow"')&&runtimeHook)await runtimeHook(c,sql,args);
   const start=performance.now();try{return await c.query(sql,args);}finally{queries.push({sql,durationMs:performance.now()-start});}
  }};};
  const workspace=createWorkspaceStore({connect}),provider=createMetaCustomerProvider({environment:channelEnvironment,now:()=>Date.now(),fetchImpl:async(...args)=>{if(graphDelayMs)await new Promise(resolve=>setTimeout(resolve,graphDelayMs));return f.fetchImpl(...args);}}),ownConnection=createOwnCompanyConnection({workspace,provider,environment:channelEnvironment}),store=createCompanyChannelStore({workspace,ownConnection,environment:channelEnvironment}),owner=f.context.session;
  const scope=(await workspace.list(owner)).scope,operation=(action,payload)=>({scope,projectId:'project-a',action,payload,operationId:randomUUID()}),assets={connectionId:null,revision:0,companyPhoneRevision:1,wabaId:f.policy.wabaId,phoneNumberId:f.policy.phoneNumberId,confirmOwnBusiness:true,confirmReplacement:false};
  const linked=await store.command(owner,operation('CONNECT_OWN_NUMBER',assets));assert.equal(linked.state,'RECORDED');
  await store.command(owner,operation('ACTIVATE_OWN_NUMBER',{...assets,connectionId:linked.channel.id,revision:linked.channel.revision,confirmRegistration:false,securityPin:null}));
  const preparedChannel=(await store.read(owner,{scope,projectId:'project-a'})).channels[0];await store.command(owner,operation('ACTIVATE',{connectionId:preparedChannel.id,revision:preparedChannel.revision,targetProjectId:null}));
  const channel=async()=>(await pool.query(`SELECT c.*,p."organizationId" FROM "WhatsAppConnection" c JOIN "Project" p ON p.id=c."projectId" WHERE c.id=$1`,[linked.channel.id])).rows[0],originalChannel=await channel();
  const participants=createParticipantStore({workspace,connect,prepareKycChat:prepareMetaKycChallenge,environment:channelEnvironment}),inbox=createMetaCustomerInbox({connect,environment:channelEnvironment}),bridge=createMetaKycBridge({connect,provider,environment:channelEnvironment}),outbound=createMetaKycOutbound({connect,provider,environment:channelEnvironment,afterReserve:()=>afterReserve()}),processor=createMetaCustomerProcessor({connect,environment:channelEnvironment,dispatch:context=>bridge.execute(context),outbound,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,...META_OWN_COMPANY_AUTHORIZATION_CODES]});
  const posts=()=>f.calls.filter(call=>call.method==='POST'&&call.path===f.policy.phoneNumberId+'/messages').length;
  const marker=async id=>(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[customerOutboundId(id)])).rows[0];
  const worker=async id=>(await pool.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[id])).rows[0];
  const receive=async(label,targetProjectId='project-a')=>{
   sequence++;const id='kyc-synthetic-'+sequence,phone='+549110000'+String(sequence).padStart(4,'0');
   await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,active,metadata) VALUES($1,$4,'Synthetic KYC participant',$2,true,$3::jsonb)`,[id,phone,JSON.stringify({siteRegister:{version:1,job:'WORKER',source:'responsible-entry',identityStatus:'UNVERIFIED',channelVerified:false},participant:{version:1,status:'ACTIVE',clerkUserId:'user_Person',permissions:{attendance:false,report:false},invitation:null,kyc:{version:1,status:'NOT_SUBMITTED'}}}),targetProjectId]);
   const challenge=await participants.save(owner,{scope,projectId:targetProjectId,action:'PREPARE_KYC_CHAT',operationId:randomUUID(),payload:{workerId:id,revision:(await worker(id)).revision}});assert.match(challenge.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);
   const message={id:'wamid.SyntheticKycCompact_'+label+'_'+sequence,from:phone.slice(1),timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:challenge.code}};
   currentEvent=(await inbox.record(splitMetaCustomerEvents({object:'whatsapp_business_account',entry:[{id:f.policy.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:f.policy.phoneNumberId},messages:[message]}}]}]}),{signatureVerified:true})).eventIds[0];return {eventId:currentEvent,workerId:id};
  };
  const contextFor=async id=>{const row=(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[id])).rows[0];return {eventId:id,projectId:row.projectId,channelId:row.payload.channelId,payloadDigest:row.payload.payloadDigest,leaseToken:row.leaseToken};};
  const proveNoReplay=async(name,id,before,expected,expectedPosts=0)=>{const first=await marker(id),firstPosts=posts()-before,beforeReplay=posts();assert.equal(firstPosts,expectedPosts);assert.equal(first.outcome.state,expected);assert.equal(first.outcome.messageId||null,null);await processor.process(id);const replayedPosts=posts()-beforeReplay;assert.equal(replayedPosts,0);assert.deepEqual(await marker(id),first);scenarios.push({name,providerPosts:firstPosts,replayedPosts,state:expected,messageIdPresent:false,diagnostic:readCustomerOutboundDiagnostic(first.outcome.diagnostic)});};
  const positive=await receive('Positive'),before=posts();queries.length=0;let started=Date.now();const result=await processor.process(positive.eventId),elapsedMs=Date.now()-started;
  assert.equal(result.replyState,'SENT');assert.equal(result.replySent,true);assert.equal(posts(),before+1);
  const full=queries.filter(q=>q.sql===initialRead).length,compact=queries.filter(q=>q.sql.includes('AS "kycNow"')).length,runtime=queries.filter(q=>q.sql.includes('AS "runtimeNow"')).length;
  assert.equal(full,4);assert.equal(compact,17);assert.equal(runtime,16);assert.ok(queries.filter(q=>q.sql.includes('AS "kycNow"')).every(q=>q.sql.includes('FOR UPDATE OF e,w FOR SHARE OF o,ap,tp,c,cc,assignment,im,iu,mm,mu')));
  const current=await worker(positive.workerId);assert.equal(current.metadata.participant.kycChatChallenge.status,'CLAIMED');assert.equal(current.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.deepEqual(current.metadata.participant.permissions,{attendance:false,report:false});
  const nativeBeforeReplay=posts();assert.equal(await processor.process(positive.eventId).then(r=>r.done),true);assert.equal(posts(),before+1);
  scenarios.push({name:'native-current',providerPosts:posts()-before,replayedPosts:posts()-nativeBeforeReplay,state:'SENT',messageIdPresent:Boolean((await marker(positive.eventId)).outcome.messageId)});measurements.push({kind:'native-current',sqlStatements:queries.length,fullResolutions:full,compactFences:compact,runtimeFences:runtime,elapsedMs,sourceLeaseMs:60000,providerPosts:posts()-before,replyState:'SENT',leaseExtended:false});checks.push('native-canonical-OWN-COMPANY-KYC-start-four-full-resolutions-seventeen-compact-sixteen-runtime-fences-one-POST-no-consent-or-permissions');
  await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES('project-kyc-target','org-a','Synthetic separate KYC worksite','ACTIVE','{"preserve":true}');INSERT INTO "ProjectMembership"(id,"projectId","tenantMembershipId",status) VALUES('kyc-target-member','project-kyc-target','member','ACTIVE')`);
  const assignmentChannel=(await store.read(owner,{scope,projectId:'project-a'})).channels.find(c=>c.id===originalChannel.id);assert.equal((await store.command(owner,operation('ASSIGN',{connectionId:originalChannel.id,revision:assignmentChannel.revision,targetProjectId:'project-kyc-target'}))).state,'RECORDED');
  const different=await receive('DifferentWorksite','project-kyc-target'),differentBefore=posts();queries.length=0;const differentResult=await processor.process(different.eventId);assert.equal(differentResult.replyState,'SENT');const differentWorker=await worker(different.workerId),differentMarker=await marker(different.eventId),differentRequest=JSON.parse(decryptCustomerSecret(differentMarker.payload.encryptedPayload,{organizationId:'org-a',projectId:'project-a',purpose:'outbound',resourceId:differentMarker.id},channelEnvironment));
  assert.equal(differentWorker.projectId,'project-kyc-target');assert.equal(differentWorker.metadata.participant.clerkUserId,'user_Person');assert.equal(differentWorker.metadata.participant.kycChatChallenge.issuerActorId,'owner');assert.equal(differentWorker.metadata.participant.kycChatChallenge.companyKyc.anchorProjectId,'project-a');assert.equal(differentWorker.metadata.participant.kycChatChallenge.companyKyc.targetProjectId,'project-kyc-target');assert.equal(differentRequest.targetProjectId,'project-kyc-target');assert.equal(differentMarker.projectId,'project-a');assert.equal(differentWorker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.deepEqual(differentWorker.metadata.participant.permissions,{attendance:false,report:false});
  const differentFull=queries.filter(q=>q.sql===initialRead).length,differentCompact=queries.filter(q=>q.sql.includes('AS "kycNow"')).length,differentRuntime=queries.filter(q=>q.sql.includes('AS "runtimeNow"')).length;assert.equal(differentFull,4);assert.equal(differentCompact,17);assert.equal(differentRuntime,16);assert.equal(posts(),differentBefore+1);const differentBeforeReplay=posts();assert.equal((await processor.process(different.eventId)).done,true);assert.deepEqual(await marker(different.eventId),differentMarker);scenarios.push({name:'distinct-participant-multiworksite',providerPosts:posts()-differentBefore,replayedPosts:posts()-differentBeforeReplay,state:differentMarker.outcome.state,messageIdPresent:Boolean(differentMarker.outcome.messageId),distinctParticipant:true,distinctAnchorTarget:true,fullResolutions:differentFull,compactFences:differentCompact,runtimeFences:differentRuntime});checks.push('native-distinct-participant-and-issuer-distinct-anchor-and-target-preserve-projection-and-credential-context');
  const delayed=await receive('Delayed'),delayBefore=posts();queries.length=0;statementDelayMs=225;graphDelayMs=200;started=Date.now();let delayedResult;try{delayedResult=await processor.process(delayed.eventId);}finally{statementDelayMs=0;graphDelayMs=0;}
  const delayedElapsed=Date.now()-started;assert.equal(delayedResult.replyState,'SENT');assert.equal(posts(),delayBefore+1);assert.ok(delayedElapsed<60000);
  measurements.push({kind:'controlled-current',sqlStatements:queries.length,fullResolutions:queries.filter(q=>q.sql===initialRead).length,compactFences:queries.filter(q=>q.sql.includes('AS "kycNow"')).length,runtimeFences:queries.filter(q=>q.sql.includes('AS "runtimeNow"')).length,statementDelayMs:225,graphDelayMs:200,elapsedMs:delayedElapsed,sourceLeaseMs:60000,marginMs:60000-delayedElapsed,providerPosts:posts()-delayBefore,replyState:'SENT',leaseExtended:false,productionLatencyMeasured:false});const delayedMarker=await marker(delayed.eventId),delayedBeforeReplay=posts();assert.equal((await processor.process(delayed.eventId)).done,true);assert.deepEqual(await marker(delayed.eventId),delayedMarker);scenarios.push({name:'controlled-current',providerPosts:posts()-delayBefore,replayedPosts:posts()-delayedBeforeReplay,state:delayedMarker.outcome.state,messageIdPresent:Boolean(delayedMarker.outcome.messageId)});checks.push('real-original-60s-source-lease-survives-controlled-225ms-every-SQL-and-200ms-every-Graph');
  // Source-baseline comparison changes only the transport factory. Relative
  // dependencies still resolve to this source; no provider or SQL is mocked.
  const baseline=JSON.parse(readFileSync(baselineFixture,'utf8'));assert.equal(baseline.version,1);assert.equal(baseline.sourceRevision,'b5723d23092bd214b9271582af8e6bcb2c929a66');assert.equal(baseline.sourcePath,'src/lib/meta-kyc-outbound.mjs');assert.equal(baseline.sourceSha256,'3f562c8d30280bf9ccce53a94523c9f0dd33278ce744bd72cae3949becc72f7f');assert.equal(sha(baseline.source),baseline.sourceSha256);const baselineSource=baseline.source,baselineSha=baseline.sourceRevision;
  const baselineModule=baselineSource.replace(/from '(\.\/[^']+)'/g,(_,ref)=>"from '"+pathToFileURL(path.resolve('src/lib',ref)).href+"'");
  const baselineFactory=(await import('data:text/javascript;base64,'+Buffer.from(baselineModule).toString('base64'))).createMetaKycOutbound;
  const baselineOutbound=baselineFactory({connect,provider,environment:channelEnvironment}),baselineProcessor=createMetaCustomerProcessor({connect,environment:channelEnvironment,dispatch:context=>bridge.execute(context),outbound:baselineOutbound,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,...META_OWN_COMPANY_AUTHORIZATION_CODES]}),baselineEvent=await receive('Baseline'),baselineBefore=posts();queries.length=0;statementDelayMs=225;graphDelayMs=200;started=Date.now();let baselineResult,baselineCode=null;try{baselineResult=await baselineProcessor.process(baselineEvent.eventId);}catch(error){baselineCode=error.code;}finally{statementDelayMs=0;graphDelayMs=0;}
  const baselineElapsed=Date.now()-started,baselineMarker=await marker(baselineEvent.eventId);assert.equal(posts(),baselineBefore);assert.equal(baselineMarker.outcome.state,'SEND_STARTED');assert.equal(baselineResult?.replySent||false,false);assert.ok(['META_CUSTOMER_INBOX_LEASE_CHANGED','META_OWN_COMPANY_UNAVAILABLE'].includes(baselineCode||baselineResult?.replyState));
  measurements.push({kind:'controlled-source-baseline',baselineSourceRevision:baselineSha,baselineOutboundSha256:sha(baselineSource),sqlStatements:queries.length,fullResolutions:queries.filter(q=>q.sql===initialRead).length,compactFences:queries.filter(q=>q.sql.includes('AS "kycNow"')).length,elapsedMs:baselineElapsed,statementDelayMs:225,graphDelayMs:200,sourceLeaseMs:60000,replySent:false,providerPosts:posts()-baselineBefore,leaseExtended:false,productionLatencyMeasured:false});await proveNoReplay('controlled-source-baseline',baselineEvent.eventId,baselineBefore,'SEND_STARTED');checks.push('same-controlled-delay-baseline-outbound-repeated-discovery-expires-original-lease-before-first-POST');
  const fault=await receive('AfterReserve'),faultBefore=posts();afterReserve=async()=>{throw new WorkspaceError('META_OWN_COMPANY_OWNER_UNCONFIRMED',503);};try{await assert.rejects(processor.process(fault.eventId),e=>e.code==='META_OWN_COMPANY_OWNER_UNCONFIRMED');}finally{afterReserve=async()=>{};}
  const faultMarker=await marker(fault.eventId);assert.equal(readCustomerOutboundDiagnostic(faultMarker.outcome.diagnostic)?.phase,'AFTER_RESERVE');assert.equal(faultMarker.outcome.diagnostic.code,'META_OWN_COMPANY_OWNER_UNCONFIRMED');await proveNoReplay('after-reserve-fault',fault.eventId,faultBefore,'SEND_STARTED');checks.push('fault-between-reserve-and-first-Graph-retains-first-private-enum-cause-and-never-replays');
  const expired=await receive('Expired'),expiredBefore=posts();afterReserve=()=>pool.query(`UPDATE "WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()-interval '1 millisecond' WHERE id=$1`,[expired.eventId]);try{await assert.rejects(processor.process(expired.eventId),e=>e.code==='META_CUSTOMER_INBOX_LEASE_CHANGED');}finally{afterReserve=async()=>{};}await proveNoReplay('source-lease-expired',expired.eventId,expiredBefore,'SEND_STARTED');checks.push('source-lease-expired-after-reservation-zero-POST-no-replay');
  const revoked=await receive('Revoked'),revokedBefore=posts();afterReserve=()=>pool.query(`UPDATE "TenantMembership" SET status='REVOKED' WHERE id='owner-m'`);try{const denied=await processor.process(revoked.eventId);assert.equal(denied.replySent,false);}finally{afterReserve=async()=>{};await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='owner-m'`);}await proveNoReplay('issuer-revoked',revoked.eventId,revokedBefore,'SEND_STARTED');checks.push('current-issuer-revoked-after-reservation-zero-POST-no-replay');
  const credential=await receive('Credential'),credentialBefore=posts();afterReserve=()=>pool.query(`UPDATE "WhatsAppConnection" SET "encryptedAccessToken"=$2 WHERE id=$1`,[originalChannel.id,encryptCustomerSecret('synthetic-rotated-token',{organizationId:'org-a',projectId:'project-a',purpose:'access-token',resourceId:f.policy.phoneNumberId},channelEnvironment)]);try{const denied=await processor.process(credential.eventId);assert.equal(denied.replySent,false);}finally{afterReserve=async()=>{};await pool.query(`UPDATE "WhatsAppConnection" SET "encryptedAccessToken"=$2 WHERE id=$1`,[originalChannel.id,originalChannel.encryptedAccessToken]);}await proveNoReplay('credential-rotated',credential.eventId,credentialBefore,'SEND_STARTED');checks.push('finite-credential-rotation-after-reservation-zero-POST-no-replay');
  const aba=await receive('ABA'),abaBefore=posts();let fenceCount=0;fenceHook=async(c)=>{if(++fenceCount===2){await c.query(`UPDATE "TenantMembership" SET "tenantRole"='DIRECTOR',"updatedAt"=clock_timestamp() WHERE id='owner-m';UPDATE "TenantMembership" SET "tenantRole"='ADMIN',"updatedAt"=clock_timestamp() WHERE id='owner-m'`);await c.query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,'org-a','owner','participant.operation.recorded','TenantMembership','owner-m','{"kind":"OFFICE_ROLE_CHANGED"}')`,['synthetic-aba-'+randomUUID()]);}};
  try{const denied=await processor.process(aba.eventId);assert.equal(denied.replySent,false);}finally{fenceHook=null;}assert.equal(fenceCount,2);await proveNoReplay('principal-trailed-ABA',aba.eventId,abaBefore,'SEND_STARTED');checks.push('same-transaction-principal-ABA-with-revision-and-authority-trail-change-denies-before-first-Graph');
  const boundary=await receive('FinalBoundary'),boundaryBefore=posts();let runtimeCount=0;afterReserve=()=>pool.query(`UPDATE "WebhookEvent" SET "leaseExpiresAt"=clock_timestamp()+interval '2 seconds' WHERE id=$1`,[boundary.eventId]);runtimeHook=async()=>{if(++runtimeCount===15)await new Promise(resolve=>setTimeout(resolve,2500));};try{await assert.rejects(processor.process(boundary.eventId),e=>e.code==='META_CUSTOMER_INBOX_LEASE_CHANGED'||e.code==='META_OWN_COMPANY_UNAVAILABLE');}finally{runtimeHook=null;afterReserve=async()=>{};}assert.equal(runtimeCount,15);await proveNoReplay('between-KYC-runtime-clock-expired',boundary.eventId,boundaryBefore,'SEND_STARTED');checks.push('expiry-between-final-KYC-and-runtime-clock-denies-first-POST-no-capability-extension');
  const lost=await receive('LostACK'),lostBefore=posts();f.state.failPost=f.policy.phoneNumberId+'/messages';try{const uncertain=await processor.process(lost.eventId);assert.equal(uncertain.replyState,'SEND_UNKNOWN');assert.equal(uncertain.replySent,false);}finally{f.state.failPost=null;}const lostMarker=await marker(lost.eventId);assert.equal(lostMarker.outcome.diagnostic.phase,'REPLY_POST');await proveNoReplay('provider-lost-ACK',lost.eventId,lostBefore,'SEND_UNKNOWN',1);checks.push('provider-POST-lost-ACK-private-enum-cause-SEND_UNKNOWN-no-message-id-never-second-POST');
  // Full native authority, not a mock object, must create the WeakMap seal.
  const sealed=await receive('Sealed');await pool.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,"leaseExpiresAt"=clock_timestamp()+interval '60 seconds' WHERE id=$1`,[sealed.eventId,randomUUID()]);const sealedContext=await contextFor(sealed.eventId);await bridge.execute(sealedContext);
  await customerJobTransaction(connect,async c=>{const r=await resolveMetaKycAuthority(c,sealedContext,{outbound:true,environment:channelEnvironment});r.ownCompanyCapability=await lockOwnCompanyIssuer(c,r.connection,{environment:channelEnvironment,now:r.now.getTime()});assert.equal(hasCompanyKycOutboundAuthority(c,r),true);const deadline=await prepareLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment});assert.ok(deadline<=Date.parse(r.event.leaseExpiresAt));assert.ok(deadline<=Date.parse(r.connection.metadata.ownCompanyRuntime.validUntil));await fenceLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment});
   await assert.rejects(fenceLockedCompanyKycOutboundAuthority({},r,sealedContext,{environment:channelEnvironment}),e=>e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');await assert.rejects(fenceLockedCompanyKycOutboundAuthority(c,{...r},sealedContext,{environment:channelEnvironment}),e=>e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');await assert.rejects(fenceLockedCompanyKycOutboundAuthority(c,r,{...sealedContext,payloadDigest:'0'.repeat(64)},{environment:channelEnvironment}),e=>e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');
   const expiry=r.event.leaseExpiresAt;r.event.leaseExpiresAt=new Date(expiry.getTime()+1);await assert.rejects(fenceLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment}),e=>e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');r.event.leaseExpiresAt=expiry;
   const reply=r.recorded.reply;r.recorded.reply={type:'text',body:'Synthetic modified response'};await assert.rejects(fenceLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment}),e=>e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');r.recorded.reply=reply;await fenceLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment});releaseLockedCompanyKycOutboundAuthority(r);await assert.rejects(fenceLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment}),e=>e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED');
  });checks.push('native-seal-rejects-forged-object-other-client-context-reply-Date-mutation-and-release');
  for(const prepareBeforeCommit of [false,true]){
   const c=await connect(),beforePosts=posts(),beforeCalls=f.calls.length;let r,rejectedCode=null;
   try{await c.query('BEGIN');r=await resolveMetaKycAuthority(c,sealedContext,{outbound:true,environment:channelEnvironment});r.ownCompanyCapability=await lockOwnCompanyIssuer(c,r.connection,{environment:channelEnvironment,now:r.now.getTime()});
    if(prepareBeforeCommit)await prepareLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment});
    await c.query('COMMIT');await c.query('BEGIN');
    await assert.rejects(prepareBeforeCommit?fenceLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment}):prepareLockedCompanyKycOutboundAuthority(c,r,sealedContext,{environment:channelEnvironment}),e=>{rejectedCode=e.code;return e.code==='META_KYC_COMPANY_AUTHORITY_CHANGED';});
    await c.query('ROLLBACK');assert.equal(posts(),beforePosts);assert.equal(f.calls.length,beforeCalls);scenarios.push({name:prepareBeforeCommit?'same-client-new-transaction-after-prepare':'same-client-new-transaction-before-prepare',providerPosts:posts()-beforePosts,graphRequests:f.calls.length-beforeCalls,rejectedCode,sameClient:true,newTransaction:true});
   }finally{try{await c.query('ROLLBACK');}finally{if(r)releaseLockedCompanyKycOutboundAuthority(r);c.release();}}
  }
  checks.push('native-same-client-new-transaction-cannot-prepare-or-reuse-previous-resolver-authority');
  const ledger=(await pool.query(`SELECT (SELECT count(*) FROM "AttendanceEntry")::int AS attendance,(SELECT count(*) FROM "OperationalProposal")::int AS proposals,(SELECT count(*) FROM "Worker" WHERE metadata->'participant'->'kyc'->>'status'<>'NOT_SUBMITTED')::int AS submitted`)).rows[0];assert.deepEqual(ledger,{attendance:0,proposals:0,submitted:0});
  assert.deepEqual(checks,COMPANY_KYC_OUTBOUND_COMPACT_CHECKS);
  return proof={version:COMPANY_KYC_OUTBOUND_COMPACT_PROOF_VERSION,status:'PASS',checks,measurements,scenarios,syntheticMessagePostCount:posts(),provider:'controlled-synthetic-only',operativeDatabaseUsed:false,realProviderUsed:false,municipalOrIdentityAcceptance:false,leaseExtended:false,poolClosed:false,databaseRemoved:false,adminClosed:false};
 }finally{globalThis.fetch=originalFetch;await closeDisposablePool(pool);poolClosed=true;if(created){await admin.query(`DROP DATABASE "${database}"`);removed=true;}if(connected){await admin.end();adminClosed=true;}assert.ok(!created||removed);if(proof)Object.assign(proof,{poolClosed,databaseRemoved:removed,adminClosed});}
}

async function main(){
 companyKycRejectionFeedbackDisposableUrl(process.env);
 const output=companyKycOutboundCompactProofOutput(process.argv.slice(2));assert.equal(existsSync(output),false,'A previous native proof must be preserved');
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceTree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),trackedClean=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()==='';
 if(process.env.CI==='true'){assert.equal(trackedClean,true,'CI native evidence requires committed clean source');assert.equal(process.env.GITHUB_SHA,sourceRevision);}
 const sourceManifest=companyKycOutboundCompactSourceFiles().map(file=>({path:file,sha256:sha(readFileSync(file))}));
 const proof=await verifyCompanyKycOutboundCompactPostgres();for(const ref of sourceManifest)assert.equal(sha(readFileSync(ref.path)),ref.sha256,'Native fixture source changed during execution');
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceRevision);assert.equal(execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),sourceTree);
 if(process.env.CI==='true')assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'');
 const result={...proof,sourceRevision,sourceTree,trackedClean,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',sourceManifest,harnessSha256:sha(readFileSync(fileURLToPath(import.meta.url)))};
 mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...proof,output}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(JSON.stringify({status:'FAIL',code:/^[A-Z0-9_]{2,100}$/.test(error?.code||'')?error.code:'KYC_COMPACT_UNCONFIRMED',locations:String(error.stack||'').split('\n').filter(line=>line.includes('verify-company-kyc-outbound-compact-postgres.mjs:')).map(line=>line.match(/verify-company-kyc-outbound-compact-postgres\.mjs:(\d+:\d+)/)?.[1]).filter(Boolean)}));process.exitCode=1;});
