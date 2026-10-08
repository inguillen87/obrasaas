import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {Client,Pool} from 'pg';
import {lifecycleEnvironment,lifecycleSchema,lifecycleTenants,createControlledLifecycleClerk,createControlledLifecycleGraph,createControlledLifecycleBlob} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {COMPANY_CHANNEL_SCHEMA_SQL,COMPANY_CHANNEL_SCHEMA_CONTRACT,companyChannelCatalogFingerprint,companyChannelSchemaReady} from '../src/lib/company-channel-schema.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantIdentityProvider} from '../src/lib/participant-identity-provider.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {resolveMetaKycAuthority,META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../src/lib/meta-kyc-outbound.mjs';
import {createParticipantChannelKycDeposit,createParticipantChannelKycUploader} from '../src/lib/participant-channel-kyc.mjs';
import {EMPLOYEE_INTAKE_AUTHORIZATION_CODES,readEmployeeIntake} from '../src/lib/meta-employee-intake.mjs';
import {createMetaCustomerCallbackHandlers,createMetaCustomerInbox,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {customerOutboundId,customerJobTransaction} from '../src/lib/meta-customer-outbound.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';

// Root-run only: strict existing disposable database, random schema, actual SQL
// and canonical signed callback/bridges. No database creation, network or pilot.
assert.ok(process.env.CUTOVER_TEST_DISPOSABLE==='1'||process.env.CUTOVER_TEST_DATABASE_DISPOSABLE==='1');
for(const key of ['CUTOVER_TEST_DISPOSABLE','CUTOVER_TEST_DATABASE_DISPOSABLE'])assert.ok(process.env[key]===undefined||process.env[key]==='1');
for(const key of ['VERCEL','VERCEL_ENV','TARGET'])assert.ok(!process.env[key]);
const url=new URL(process.env.CUTOVER_TEST_DATABASE_URL||'https://unconfigured.invalid');
assert.ok(['postgres:','postgresql:'].includes(url.protocol));assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.ok(['5432','6549'].includes(url.port));
assert.equal(url.username,'cutover_test');assert.equal(url.pathname,'/obrasaas_cutover_ci');assert.ok(url.port==='6549'?url.password==='':['','cutover_test'].includes(url.password));assert.equal(url.search,'');assert.equal(url.hash,'');
const schema='obrasaas_onboarding_recovery_'+randomUUID().replaceAll('-',''),quoted='"'+schema+'"';assert.match(schema,/^obrasaas_onboarding_recovery_[a-f0-9]{32}$/);
const rewrite=sql=>{let value=sql.replace(/\bpublic\./g,quoted+'.').replaceAll("'public'::regnamespace","'"+schema+"'::regnamespace").replaceAll("table_schema='public'","table_schema='"+schema+"'");if(value.includes('FROM pg_trigger WHERE tgname=ANY'))value=value.replace('AND NOT tgisinternal','AND NOT tgisinternal AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace=\''+schema+'\'::regnamespace)');return value;};
const output='.vercel/participant-onboarding-recovery-evidence/postgres.json';assert.equal(existsSync(output),false,'PRESERVE_EXISTING_ONBOARDING_RECOVERY_PROOF');
const root=process.cwd(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function readCiSourceState(){
 if(process.env.CI!=='true')return {sourceRevision:null,sourceState:'WORK_IN_PROGRESS',trackedClean:null};
 const sourceRevision=process.env.GITHUB_SHA;assert.match(sourceRevision||'',/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),sourceRevision);
 assert.equal(execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim(),'');
 return {sourceRevision,sourceState:'EXACT_CI_SOURCE',trackedClean:true};
}
const initialSourceState=readCiSourceState();
const sources=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?sources(relative+'/'+e.name):[relative+'/'+e.name]);
const sourceManifest=[...sources('src/lib'),'src/app/(identity)/cuenta/private-bank-account-format.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/disposable-postgres-cleanup.mjs'].map(file=>({path:file,sha256:sha(readFileSync(file))})),harnessSha256=sha(readFileSync(new URL(import.meta.url)));
function assertStableSource(){for(const source of sourceManifest)assert.equal(sha(readFileSync(source.path)),source.sha256);assert.equal(sha(readFileSync(new URL(import.meta.url))),harnessSha256);assert.deepEqual(readCiSourceState(),initialSourceState);}
const admin=new Client({connectionString:url.href}),environment={...lifecycleEnvironment},a={...lifecycleTenants[0],anchorProjectId:'onboarding-anchor-a',projectId:'onboarding-target-b',channelId:'onboarding-channel-a'},b={...lifecycleTenants[1],projectId:'onboarding-foreign'},clerk=createControlledLifecycleClerk(),graph=createControlledLifecycleGraph(environment),blob=createControlledLifecycleBlob(),checks=[];
let pool,created=false,schemaRemoved=false,passed=false,networkCalls=0,lastReplyId=null,sequence=0,loseClosureCommit=false;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('ONBOARDING_UNCONTROLLED_NETWORK_REJECTED');};
const query=(sql,args=[])=>pool.query(rewrite(sql),args);
const connect=async()=>{const c=await pool.connect();let closureWritten=false;return {release:bad=>c.release(bad),query:async(sql,args=[])=>{
  let result;try{result=await c.query(rewrite(sql),args);}catch(error){console.error(JSON.stringify({code:'ONBOARDING_SQL_FAILED',sqlState:/^[A-Z0-9]{5}$/.test(error?.code||'')?error.code:null,querySha256:sha(Buffer.from(sql)),queryType:sql.split(' ')[0]}));throw error;}
 if(sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'participant.operation.recorded'")&&JSON.parse(args.at(-1)).kind==='CANCEL_KYC_CHAT')closureWritten=true;
 if(sql==='COMMIT'&&closureWritten&&loseClosureCommit){loseClosureCommit=false;throw Error('SYNTHETIC_ONBOARDING_CLOSURE_COMMITTED_ACK_LOST');}return result;
}};};
const session=(userId,organizationId,role)=>({authenticated:true,verification:'clerk-production-jwt',userId,organizationId,organizationRole:role});
const owner=session(a.ownerUserId,a.clerkOrganizationId,'org:admin'),own=session(a.workerUserId,a.clerkOrganizationId,'org:member'),other=session('user_OtherIssuer',a.clerkOrganizationId,'org:admin'),foreign=session(b.ownerUserId,b.clerkOrganizationId,'org:admin');
try{
 assertStableSource();
 await admin.connect();const boundary=(await admin.query('SELECT current_database() AS database,session_user AS actor')).rows[0];assert.equal(boundary.database,'obrasaas_cutover_ci');assert.equal(boundary.actor,'cutover_test');
 await admin.query('CREATE SCHEMA '+quoted);created=true;pool=trackDisposablePool(new Pool({connectionString:url.href,max:8,options:'-c search_path='+schema}));await query(lifecycleSchema);
 for(const t of [a,b]){
  await query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata) VALUES($1,$2,$3,'{}')`,[t.organizationId,'Synthetic '+t.key,t.clerkOrganizationId]);
  await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,[t.ownerId,t.ownerUserId,'owner-'+t.key+'@example.invalid']);
  await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['owner-member-'+t.key,t.ownerId,t.organizationId]);
  for(const id of t===a?[a.anchorProjectId,a.projectId]:[b.projectId])await query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{}')`,[id,t.organizationId,'Synthetic '+id]);
 }
 await query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('onboarding-own',$1,$2),('other-issuer','user_OtherIssuer','other-issuer@example.invalid')`,[a.workerUserId,a.workerEmail]);
 await query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('other-issuer-membership','other-issuer',$1,'ADMIN','org:admin','ACTIVE')`,[a.organizationId]);
 const metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:a.organizationId,customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE',actorId:a.ownerId},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null},companyRoutingVersion:1};
 await query(`INSERT INTO "WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken",metadata) VALUES($1,$2,true,'CONNECTED',$3,$4,$5,$6::jsonb)`,[a.channelId,a.anchorProjectId,a.phoneNumberId,a.wabaId,encryptCustomerSecret(a.token,{organizationId:a.organizationId,projectId:a.anchorProjectId,purpose:'access-token',resourceId:a.phoneNumberId},environment),JSON.stringify(metadata)]);
 await query(COMPANY_CHANNEL_SCHEMA_SQL);await query(`UPDATE "WhatsAppCompanyChannel" SET mode='COMPANY',revision=2 WHERE "connectionId"=$1`,[a.channelId]);
 await query(`INSERT INTO "WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status) VALUES($1,$2,$3,'ACTIVE')`,[a.channelId,a.organizationId,a.projectId]);
 const catalog=await connect();try{const fingerprint=await companyChannelCatalogFingerprint(catalog);await catalog.query(`INSERT INTO public."WhatsAppCompanySchema" VALUES(1,1,$1,$2)`,[COMPANY_CHANNEL_SCHEMA_CONTRACT,fingerprint]);assert.equal(await companyChannelSchemaReady(catalog),true);}finally{catalog.release();}
 graph.assets.get('a').registered=true;graph.assets.get('a').subscribed=true;
  // This scenario issues two invitations for one address. Model the controlled
  // SDK's membership metadata from its sole actually accepted invitation;
  // preserve the older provider records and the canonical identity validator.
  const clerkClient=async()=>{const sdk=await clerk.client();return {...sdk,organizations:{...sdk.organizations,getOrganizationMembershipList:async input=>{
   const page=await sdk.organizations.getOrganizationMembershipList(input);
   if(input.organizationId===a.clerkOrganizationId&&input.userId?.length===1&&input.userId[0]===a.workerUserId){const accepted=[...clerk.invitations.values()].filter(row=>row.organizationId===input.organizationId&&row.emailAddress===a.workerEmail&&row.status==='accepted');assert.equal(accepted.length,1);assert.equal(page.totalCount,1);assert.equal(page.data[0].publicUserData.userId,a.workerUserId);return {...page,data:[{...page.data[0],publicMetadata:{...page.data[0].publicMetadata,...accepted[0].publicMetadata}}]};}
   return page;
  }}};};
  const workspace=createWorkspaceStore({connect}),identity=createParticipantIdentityProvider({client:clerkClient,environment:()=>environment}),participant=createParticipantStore({workspace,connect,identity,prepareKycChat:prepareMetaKycChallenge,environment});
 const scope=(await workspace.list(owner)).scope,otherScope=(await workspace.list(other)).scope,foreignScope=(await workspace.list(foreign)).scope;
 const context={scope,projectId:a.projectId},command=(action,payload)=>({...context,operationId:randomUUID(),action,payload});
 const provider={...createMetaCustomerProvider({environment,fetchImpl:graph.fetchImpl}),downloadMedia:async()=>{throw Error('ONBOARDING_PARTIAL_CAPTURE_MUST_NOT_DOWNLOAD');}},upload=createParticipantChannelKycUploader({get:blob.get,put:blob.put,environment:()=>environment}),deposit=createParticipantChannelKycDeposit({connect,resolveAuthority:resolveMetaKycAuthority,upload,environment}),bridge=createMetaKycBridge({connect,provider,deposit,environment}),outbound=createMetaKycOutbound({connect,provider,environment});
 const processor=createMetaCustomerProcessor({connect,environment,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,...EMPLOYEE_INTAKE_AUTHORIZATION_CODES],dispatch:async c=>(await bridge.executeIntake(c))||(await bridge.execute(c)),outbound:{send:(c,reply,{purpose})=>outbound.send(c,reply,{purpose})}}),callback=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect,environment}),environment,schedule:()=>{}});
 async function push(message,{replyId=lastReplyId,signed=true}={}){
  sequence++;const value={id:'wamid.OnboardingRecovery_'+randomUUID().replaceAll('-',''),from:a.sender,timestamp:String(Math.floor(Date.now()/1000)+sequence),...(typeof message==='string'?{type:'text',text:{body:message}}:message),...(replyId?{context:{id:replyId}}:{})};
  const body={object:'whatsapp_business_account',entry:[{id:a.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:a.phoneNumberId},messages:[value]}}]}]},bytes=Buffer.from(JSON.stringify(body));
  const response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json',...(signed?{'x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(bytes).digest('hex')}:{})},body:bytes}));assert.equal(response.status,signed?200:403);if(!signed)return null;assert.equal((await response.json()).durable,true);return 'customer_webhook_'+splitMetaCustomerEvents(body)[0].externalId;
 }
 async function execute(message,options){const id=await push(message,options),result=await processor.process(id),reply=graph.messages.get(customerOutboundId(id));if(reply)lastReplyId=reply.id;return {id,result,reply:reply?.body};}
 const choose=async(previous,title)=>{const row=previous.reply?.interactive?.action.sections.flatMap(section=>section.rows).find(row=>row.title===title);assert.ok(row,'EXACT_ONBOARDING_CHOICE_REQUIRED');return execute({type:'interactive',interactive:{type:'list_reply',list_reply:{id:row.id,title:row.title}}});};
 await participant.save(owner,command('CONFIGURE_EMPLOYEE_INTAKE',{connectionId:a.channelId,expectedRevision:0,enabled:true,confirmed:true}));
 let last=await execute('HOLA',{replyId:null}),applicationId=last.id;last=await execute('Synthetic employee');last=await choose(last,'Operario');last=await execute(a.workerEmail);last=await choose(last,'Enviar solicitud');
 const intakeState=async()=>{const row=(await query(`SELECT payload FROM "WebhookEvent" WHERE id=$1`,[applicationId])).rows[0];return JSON.parse(decryptCustomerSecret(row.payload.employeeIntake.encryptedState,{organizationId:a.organizationId,projectId:a.anchorProjectId,purpose:'employee-intake',resourceId:applicationId},environment));};
 const pending=await intakeState();assert.equal(pending.status,'WAITING_RESPONSIBLE');assert.equal(pending.consent,true);
 const admission=await participant.save(owner,command('ADMIT_EMPLOYEE_INTAKE',{connectionId:a.channelId,applicationId,expectedRevision:pending.revision,job:'WORKER',permissions:{attendance:true,report:false},confirmed:true})),workerId=admission.workerId;
 const worker=async()=>(await query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[workerId])).rows[0];assert.equal((await intakeState()).status,'ADMITTED');assert.equal((await worker()).projectId,a.projectId);
 assert.equal((await query(`SELECT count(*)::int AS n FROM "TenantMembership" WHERE "userId"='onboarding-own'`)).rows[0].n,0);
 const invitation=await participant.save(owner,command('INVITE',{workerId,revision:(await worker()).revision,email:a.workerEmail}));assert.equal(invitation.saved,true);assert.equal(clerk.sent(),1);
 let invitationId=(await worker()).metadata.participant.invitation.id;
 const prepareCurrent=async()=>participant.save(owner,command('PREPARE_KYC_CHAT',{workerId,revision:(await worker()).revision}));
 let prepared=await prepareCurrent();assert.match(prepared.code,/^IDENTIDAD [A-Za-z0-9_-]{43}$/);
 let currentView=(await participant.read(owner,context)).records.find(row=>row.id===workerId);assert.equal(currentView.kycChatChallenge.status,'PENDING');assert.equal(currentView.kycChatChallenge.canCancel,true);assert.equal(currentView.kycChatChallenge.canPrepare,false);
 last=await execute(prepared.code,{replyId:null});last=await choose(last,'Autorizar imágenes');assert.equal(last.result.kind,'KYC_CHAT');assert.equal((await worker()).metadata.participant.kycChatChallenge.status,'CLAIMED');
 currentView=(await participant.read(owner,context)).records.find(row=>row.id===workerId);assert.equal(currentView.kycChatChallenge.status,'CLAIMED');assert.equal(currentView.kycChatChallenge.canCancel,true);assert.equal(currentView.kycChatChallenge.canPrepare,false);
 assert.equal((await query(`SELECT count(*)::int AS n FROM "TenantMembership" WHERE "userId"='onboarding-own'`)).rows[0].n,0);
 const preRevoke=await worker(),revokedDraft=structuredClone(preRevoke.metadata.participant.kycChatChallenge),revokedConversation=structuredClone(preRevoke.metadata.participant.kycChatConversation),beforeRevoke={sends:graph.assets.get('a').sends,clerk:clerk.sent()};
 await participant.save(owner,command('REVOKE',{workerId,revision:preRevoke.revision,reason:'Synthetic revoke of invited unfinished capture'}));
 const revoked=await worker();assert.equal(revoked.metadata.participant.status,'REVOKED');assert.deepEqual(revoked.metadata.participant.permissions,{attendance:false,report:false});
 await assert.rejects(participant.save(owner,command('INVITE',{workerId,revision:revoked.revision,email:a.workerEmail})),{code:'PARTICIPANT_KYC_CHAT_CLOSURE_REQUIRED'});
 assert.deepEqual({sends:graph.assets.get('a').sends,clerk:clerk.sent()},beforeRevoke);assert.deepEqual((await worker()).metadata,revoked.metadata);
 const revokedCloseInput=command('CANCEL_KYC_CHAT',{workerId,revision:revoked.revision,challengeId:revokedDraft.id,reason:'Synthetic issuer closure before explicit invitation replacement'}),revokedClosure=await participant.save(owner,revokedCloseInput);
 const afterRevokedClosure=await worker();assert.equal(afterRevokedClosure.metadata.participant.status,'REVOKED');assert.deepEqual(afterRevokedClosure.metadata.participant.permissions,{attendance:false,report:false});
 const revokedArchive=(await query(`SELECT metadata FROM "AuditLog" WHERE id=$1`,[revokedClosure.receiptId+'_kyc_closed'])).rows[0].metadata;assert.deepEqual(revokedArchive.challenge,revokedDraft);assert.deepEqual(revokedArchive.conversation,revokedConversation);
 await participant.save(owner,command('INVITE',{workerId,revision:afterRevokedClosure.revision,email:a.workerEmail}));assert.equal(clerk.sent(),beforeRevoke.clerk+1);const invitedAgain=await worker();assert.equal(invitedAgain.metadata.participant.kycChatChallenge,undefined);const revokedReplay=await participant.save(owner,revokedCloseInput);assert.equal(revokedReplay.receiptId,revokedClosure.receiptId);assert.equal(revokedReplay.replayed,true);assert.deepEqual((await worker()).metadata,invitedAgain.metadata);
 invitationId=invitedAgain.metadata.participant.invitation.id;prepared=await prepareCurrent();assert.notEqual((await worker()).metadata.participant.kycChatChallenge.id,revokedDraft.id);
 last=await execute(prepared.code,{replyId:null});last=await choose(last,'Autorizar imágenes');assert.equal(last.result.kind,'KYC_CHAT');assert.deepEqual((await query(`SELECT metadata FROM "AuditLog" WHERE id=$1`,[revokedClosure.receiptId+'_kyc_closed'])).rows[0].metadata,revokedArchive);
 checks.push('revoked-invited-CLAIMED-blocks-new-invitation-before-original-issuer-closure-archives-draft-and-explicit-fresh-invitation-only');
 const beforeJoin=await worker(),oldChallenge=structuredClone(beforeJoin.metadata.participant.kycChatChallenge),oldConversation=structuredClone(beforeJoin.metadata.participant.kycChatConversation),oldProjection=(await query(`SELECT * FROM "AuditLog" WHERE action='participant.kyc_chat.projected' ORDER BY id`)).rows;
 checks.push('signed-A-callback-admitted-B-invitation-canonical-PREPARE-and-intake-first-consent-CLAIMED-with-no-guest-membership');
 clerk.invitations.get(invitationId).status='accepted';const accepted=await participant.join(own,{invitationId,operationId:randomUUID()},{accept:true});assert.equal(accepted.saved,true);
 assert.equal((await worker()).metadata.participant.status,'ACTIVE');assert.deepEqual((await worker()).metadata.participant.permissions,{attendance:true,report:false});assert.equal((await worker()).metadata.participant.kycChatChallenge.participantClerkUserId,null);
 const closure=command('CANCEL_KYC_CHAT',{workerId,revision:(await worker()).revision,challengeId:oldChallenge.id,reason:'Synthetic explicit stop of partial capture after own account acceptance'});
 const baseline={sends:graph.assets.get('a').sends,downloads:graph.assets.get('a').downloads,puts:blob.puts(),clerk:clerk.sent()};
 for(const [who,ctx,input,code] of [[foreign,foreignScope,closure,'PARTICIPANT_ACCESS_REQUIRED'],[other,otherScope,closure,'PARTICIPANT_KYC_CHAT_ISSUER_REQUIRED'],[owner,scope,{...closure,operationId:randomUUID(),payload:{...closure.payload,revision:beforeJoin.revision}},'PARTICIPANT_REVISION_CHANGED'],[owner,scope,{...closure,operationId:randomUUID(),payload:{...closure.payload,challengeId:'kyc_chat_'+'f'.repeat(32)}},'PARTICIPANT_KYC_CHAT_INTEGRITY']])await assert.rejects(participant.save(who,{...input,scope:ctx}),{code});
 await query(`UPDATE "TenantMembership" SET "tenantRole"='AUDITOR' WHERE "userId"=$1`,[a.ownerId]);await assert.rejects(participant.save(owner,closure),{code:'WORKSPACE_CONTEXT_CHANGED'});const downgradedScope=(await workspace.list(owner)).scope;await assert.rejects(participant.save(owner,{...closure,scope:downgradedScope}),{code:'PARTICIPANT_MANAGE_REQUIRED'});await query(`UPDATE "TenantMembership" SET "tenantRole"='ADMIN' WHERE "userId"=$1`,[a.ownerId]);
 const outcomes=await Promise.all([participant.save(owner,closure),participant.save(owner,closure)]);assert.equal(outcomes[0].receiptId,outcomes[1].receiptId);
 const cancelled=await worker();assert.equal(cancelled.metadata.participant.kycChatChallenge.status,'CANCELLED');assert.equal(cancelled.metadata.participant.kycChatConversation,null);assert.equal(cancelled.metadata.participant.kycChatChallenge.codeDigest,oldChallenge.codeDigest);assert.equal(cancelled.metadata.participant.kycChatChallenge.issuerActorId,oldChallenge.issuerActorId);assert.equal(cancelled.metadata.participant.kycChatChallenge.expiresAt,oldChallenge.expiresAt);
 const archive=(await query(`SELECT * FROM "AuditLog" WHERE id=$1`,[outcomes[0].receiptId+'_kyc_closed'])).rows[0];assert.equal(archive.actorId,a.ownerId);assert.equal(archive.metadata.closureReceiptId,outcomes[0].receiptId);assert.deepEqual(archive.metadata.challenge,oldChallenge);assert.deepEqual(archive.metadata.conversation,oldConversation);
 assert.deepEqual((await query(`SELECT * FROM "AuditLog" WHERE action='participant.kyc_chat.projected' ORDER BY id`)).rows,oldProjection);assert.equal((await query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action='participant.kyc_chat.closed'`)).rows[0].n,2);
 const observed=await participant.status(owner,{...context,operationId:closure.operationId});assert.equal(observed.state,'RECORDED');assert.equal(observed.receiptId,outcomes[0].receiptId);
 assert.deepEqual({sends:graph.assets.get('a').sends,downloads:graph.assets.get('a').downloads,puts:blob.puts(),clerk:clerk.sent()},baseline);
 checks.push('own-canonical-JOIN-controlled-Clerk-partial-CLAIMED-concurrent-same-UUID-closure-CAS-own-receipt-and-archive-with-original-projection-unchanged');
 const fresh=await prepareCurrent(),freshChallenge=(await worker()).metadata.participant.kycChatChallenge;assert.notEqual(fresh.code,prepared.code);assert.notEqual(freshChallenge.id,oldChallenge.id);assert.equal(freshChallenge.participantClerkUserId,a.workerUserId);
 const freshBeforeReplay=structuredClone((await worker()).metadata),replayedClosure=await participant.save(owner,closure);assert.equal(replayedClosure.receiptId,outcomes[0].receiptId);assert.equal(replayedClosure.replayed,true);assert.deepEqual((await worker()).metadata,freshBeforeReplay);
 last=await execute(fresh.code,{replyId:null});assert.equal(last.result.kind,'KYC_CHAT');assert.equal(last.result.replySent,true);assert.equal((await worker()).metadata.participant.kycChatChallenge.status,'CLAIMED');
 const lost=command('CANCEL_KYC_CHAT',{workerId,revision:(await worker()).revision,challengeId:freshChallenge.id,reason:'Synthetic closure committed with acknowledgment lost'});loseClosureCommit=true;const beforeLost=graph.assets.get('a').sends;
 await assert.rejects(participant.save(owner,lost),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const recovered=await participant.status(owner,{...context,operationId:lost.operationId});assert.equal(recovered.state,'RECORDED');assert.equal((await participant.read(owner,context)).records.find(row=>row.id===workerId).kycChatChallenge.status,'CANCELLED');assert.equal(graph.assets.get('a').sends,beforeLost);
 checks.push('fresh-PREPARE-after-explicit-closure-reaches-active-own-KYC-and-real-PG-lost-COMMIT-status-recovery-never-resends');
 const final=await prepareCurrent();assert.equal((await worker()).metadata.participant.kycChatChallenge.captureImageSetVersion,2);
 last=await execute(final.code,{replyId:null});last=await choose(last,'Autorizar imágenes');assert.match(last.reply.interactive.body.text,/dorso/);assert.equal(blob.puts(),0);assert.equal(graph.assets.get('a').downloads,0);
 last=await choose(last,'Autorizar dorso');last=await choose(last,'Sin lectura asistida');last=await choose(last,'Sin comparación facial');
 for(let image=0;image<3;image++)last=await execute({type:'image',image:{id:a.mediaId,mime_type:'image/png'}});
 const confirm=last.reply.interactive.action.sections.flatMap(section=>section.rows).find(row=>row.title==='Guardar identidad');assert.ok(confirm);const finalEvent=await push({type:'interactive',interactive:{type:'list_reply',list_reply:confirm}});await assert.rejects(processor.process(finalEvent),/ONBOARDING_PARTIAL_CAPTURE_MUST_NOT_DOWNLOAD/);
 const finalRow=await worker(),challenge=finalRow.metadata.participant.kycChatChallenge,finalState=JSON.parse(decryptCustomerSecret(finalRow.metadata.participant.kycChatConversation.encryptedState,{organizationId:a.organizationId,projectId:a.anchorProjectId,purpose:'kyc-chat-conversation',resourceId:challenge.id},environment));assert.equal(finalState.step,'FINALIZING');assert.equal(finalState.confirmationEventId,finalEvent);
 await assert.rejects(participant.save(owner,command('CANCEL_KYC_CHAT',{workerId,revision:finalRow.revision,challengeId:challenge.id,reason:'Synthetic finalization must stay recoverable, never discarded'})),{code:'PARTICIPANT_KYC_CHAT_CONFIRMATION_PENDING'});assert.deepEqual((await worker()).metadata,finalRow.metadata);assert.equal(blob.puts(),0);assert.equal(graph.assets.get('a').downloads,0);
 checks.push('durable-FINALIZING-with-unconfirmed-capture-cannot-be-cancelled-or-replaced');
 for(const row of (await query(`SELECT * FROM "WebhookEvent" WHERE provider='meta-customer-outbound-v1'`)).rows){assert.equal(row.projectId,a.anchorProjectId);const aad={organizationId:a.organizationId,projectId:a.anchorProjectId,purpose:'outbound',resourceId:row.id};assert.doesNotThrow(()=>decryptCustomerSecret(row.payload.encryptedPayload,aad,environment));assert.throws(()=>decryptCustomerSecret(row.payload.encryptedPayload,{...aad,projectId:a.projectId},environment));}
 const publicState=JSON.stringify(await participant.read(owner,context));for(const secret of ['IDENTIDAD ',prepared.code,a.token,'encryptedState','codeDigest','data:image'])assert.equal(publicState.includes(secret),false);
 assert.equal((await query(`SELECT count(*)::int AS n FROM "WhatsAppCompanyEventRoute"`)).rows[0].n,0);assert.equal((await query(`SELECT count(*)::int AS n FROM "Task"`)).rows[0].n,0);assert.equal((await query(`SELECT count(*)::int AS n FROM "AttendanceEntry"`)).rows[0].n,0);assert.equal(networkCalls,0);assert.deepEqual(graph.unexpected,[]);
 const intake=await customerJobTransaction(connect,c=>readEmployeeIntake(c,{organizationId:a.organizationId,role:'ADMIN'},a.projectId,environment));assert.equal(intake.records.length,1);assert.equal(intake.records[0].status,'ADMITTED');
 assertStableSource();checks.push('private-code-and-credential-AAD-no-public-secret-no-business-effect-and-zero-uncontrolled-network');passed=true;
}finally{
 try{await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_onboarding_recovery_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');assert.equal((await admin.query('SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname=$1) AS present',[schema])).rows[0].present,false);schemaRemoved=true;}}finally{try{await admin.end();}finally{globalThis.fetch=originalFetch;}}
}
assert.equal(passed,true);assert.equal(schemaRemoved,true);assert.equal(networkCalls,0);
assertStableSource();
const proof={status:'PASS',checkedAt:new Date().toISOString(),checks,sourceManifest,harnessSha256,...initialSourceState,databaseCreated:false,schemaRemoved,providerCalls:0,unexpectedNetworkCalls:networkCalls,realClerkLogin:false,realMetaAccepted:false,physicalPilotAccepted:false,coverageBoundary:'actual canonical SQL in random disposable schema; controlled Clerk/Meta only'};
mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({status:proof.status,checks:checks.length,schemaRemoved,providerCalls:0}));
