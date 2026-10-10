import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Client,Pool} from 'pg';
import {lifecycleDisposableUrl,lifecycleSchema,lifecycleEnvironment} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {COMPANY_CHANNEL_SCHEMA_SQL} from '../src/lib/company-channel-schema.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createOfficeReviewStore} from '../src/lib/office-review-store.mjs';
import {createOfficeReviewHandlers} from '../src/lib/office-review-http.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';

// Use the existing dedicated local CI database and one generated schema. Real
// identities, provider calls and production credentials have no fallback here.
const url=lifecycleDisposableUrl(process.env);
assert.ok(!process.env.VERCEL_TARGET_ENV&&!process.env.TARGET,'OFFICE_REVIEW_PRODUCTION_TARGET_REJECTED');
assert.ok(['5432','6549'].includes(url.port),'OFFICE_REVIEW_DISPOSABLE_PORT_REQUIRED');
assert.equal(url.username,'cutover_test','OFFICE_REVIEW_DISPOSABLE_ROLE_REQUIRED');
assert.ok(url.port==='6549'?url.password==='':['','cutover_test'].includes(url.password),'OFFICE_REVIEW_DISPOSABLE_PASSWORD_REQUIRED');
const schema='obrasaas_office_review_'+randomUUID().replaceAll('-','');
assert.match(schema,/^obrasaas_office_review_[a-f0-9]{32}$/);
const quoted='"'+schema+'"',rewrite=sql=>{const rewritten=sql.replace(/\bpublic\./g,quoted+'.').replace(/table_schema='public'/g,"table_schema='"+schema+"'");assert.doesNotMatch(rewritten,/\bpublic\./,'OFFICE_REVIEW_PUBLIC_NAMESPACE_REJECTED');return rewritten;};
const root=process.cwd(),sha=value=>createHash('sha256').update(value).digest('hex');
const sourceFiles=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(entry=>entry.isDirectory()?sourceFiles(relative+'/'+entry.name):[relative+'/'+entry.name]);
const sourcePaths=[...sourceFiles('src/lib'),'scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/disposable-postgres-cleanup.mjs'];
const sourceManifest=sourcePaths.map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))})),harnessSha256=sha(readFileSync(new URL(import.meta.url)));
function sourceState(){
 const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.match(sourceRevision,/^[a-f0-9]{40}$/);
 const trackedClean=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim()==='';
 if(process.env.CI==='true'){assert.equal(sourceRevision,process.env.GITHUB_SHA,'OFFICE_REVIEW_CI_SOURCE_REVISION_REQUIRED');assert.equal(trackedClean,true,'OFFICE_REVIEW_CI_TRACKED_SOURCE_CLEAN_REQUIRED');execFileSync('git',['ls-files','--error-unmatch','--',...sourcePaths,path.relative(root,fileURLToPath(import.meta.url))],{cwd:root,stdio:'pipe'});}
 return {sourceRevision,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':'WORK_IN_PROGRESS',trackedClean};
}
const initialSourceState=sourceState();
function assertStableSource(){for(const file of sourceManifest)assert.equal(sha(readFileSync(path.join(root,file.path))),file.sha256,'OFFICE_REVIEW_SOURCE_CHANGED_DURING_RUN: '+file.path);assert.equal(sha(readFileSync(new URL(import.meta.url))),harnessSha256);assert.deepEqual(sourceState(),initialSourceState);}
const admin=new Client({connectionString:url.href,connectionTimeoutMillis:5000}),checks=[],sqlFailures=[],runtimeQueries=[],controlledIdentityCalls=[];
let pool,created=false,removed=false,networkCalls=0,failAudit=false,loseCommitAck=false;
const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{networkCalls++;throw Error('OFFICE_REVIEW_UNCONTROLLED_NETWORK_REJECTED');};
const query=(sql,args)=>pool.query(rewrite(sql),args);
const connect=async()=>{const db=await pool.connect();await db.query('SET search_path TO '+quoted);let auditWritten=false;return {release:bad=>db.release(bad),async query(sql,args=[]){
 runtimeQueries.push(sql);
 try{
  if(sql.startsWith('INSERT INTO public."AuditLog"')){if(failAudit){failAudit=false;throw Error('SYNTHETIC_OFFICE_REVIEW_AUDIT_ROLLBACK');}auditWritten=true;}
  const result=await db.query(rewrite(sql),args);
  if(sql==='COMMIT'&&auditWritten&&loseCommitAck){loseCommitAck=false;throw Error('SYNTHETIC_OFFICE_REVIEW_COMMITTED_ACK_LOSS');}
  return result;
 }catch(error){if(error.code)sqlFailures.push(error.code);throw error;}
}};};
const signed=(userId,organizationId='org_A',organizationRole='org:member')=>({authenticated:true,verification:'clerk-production-jwt',userId,organizationId,organizationRole});
const owner=signed('user_Owner','org_A','org:admin'),reviewerA=signed('user_ReviewerA'),reviewerB=signed('user_ReviewerB'),pendingReviewer=signed('user_PendingReviewer'),foreign=signed('user_Foreign','org_B','org:admin');
const emails=new Map([[reviewerA.userId,'reviewer-a@example.invalid'],[reviewerB.userId,'reviewer-b@example.invalid'],[pendingReviewer.userId,'pending@example.invalid']]),invitations=new Map();
const identity={
 async createInvitation(input){controlledIdentityCalls.push('create');const value={id:'orginv_'+randomUUID().replaceAll('-',''),invitationId:input.invitationId,email:input.email,role:'org:member',state:'accepted',expiresAt:new Date(Date.now()+86400000).toISOString()};invitations.set(input.invitationId,value);return {...value};},
 async findInvitation({invitationId}){controlledIdentityCalls.push('find');return {...invitations.get(invitationId)};},
 async verifiedEmail(userId,email){controlledIdentityCalls.push('email');return !email||email===emails.get(userId)?emails.get(userId):null;},
 async verifyMembership({userId,organizationId}){controlledIdentityCalls.push('member');return {userId,organizationId,role:'org:member'};}
};
const connectionId='private-company-channel',wabaId='70000001',phoneId='70000002',eventId='customer_webhook_'+'c'.repeat(64),environment={...lifecycleEnvironment};
const expiry=new Date(Date.now()+86400000).toISOString();
function assertConnection(value){
 assert.deepEqual(Object.keys(value).sort(),['version','connectionRef','wabaRef','phoneNumberRef','connectionStatus','enabled','mode','channelRevision','assignmentRevision','observedAt','evidenceOrigin'].sort());
 assert.equal(value.version,1);assert.match(value.connectionRef,/^office_connection_[a-f0-9]{64}$/);assert.match(value.wabaRef,/^office_waba_[a-f0-9]{64}$/);assert.match(value.phoneNumberRef,/^office_phone_[a-f0-9]{64}$/);
 assert.equal(value.connectionStatus,'CONNECTED');assert.equal(value.enabled,true);assert.equal(value.mode,'COMPANY');assert.equal(value.channelRevision,5);assert.equal(value.assignmentRevision,2);assert.equal(new Date(value.observedAt).toISOString(),value.observedAt);assert.equal(value.evidenceOrigin,'STORED_AUTHORIZED_CONNECTION');
}
function sourceEvent(){
 const payload={type:'message',wabaId,phoneNumberId:phoneId,value:{type:'text',from:'5491100001111',id:'wamid.synthetic',timestamp:'1791500000',text:{body:'HOLA'}}},payloadDigest=metaCustomerContentDigest(payload),aad={organizationId:'org-a',projectId:'anchor-a',resourceId:eventId};
 return {organizationId:'org-a',channelId:connectionId,payloadDigest,signatureVerified:true,signatureScheme:'meta-hmac-sha256-v1',encryptedPayload:encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},environment),encryptedProof:encryptCustomerSecret(JSON.stringify({scheme:'meta-hmac-sha256-v1',purpose:'CUSTOMER',appId:OBRASAAS_META_CHANNEL.appId,organizationId:'org-a',channelId:connectionId,payloadDigest}),{...aad,purpose:'webhook-proof'},environment)};
}
const snapshot=async()=>Object.fromEntries(await Promise.all(['PlatformUser','TenantMembership','ProjectMembership','Worker','WhatsAppConnection','WhatsAppCompanyChannel','WhatsAppChannelProjectAssignment','WebhookEvent','AuditLog'].map(async table=>[table,(await query('SELECT row_to_json(t) AS row FROM public."'+table+'" t ORDER BY row_to_json(t)::text')).rows.map(row=>row.row)])));
const deny=async operation=>assert.rejects(operation,error=>error.status>=400&&error.status<500);
try{
 await admin.connect();assert.deepEqual((await admin.query('SELECT current_database() AS database,session_user AS actor')).rows[0],{database:'obrasaas_cutover_ci',actor:'cutover_test'});
 await admin.query('CREATE SCHEMA '+quoted);created=true;await admin.query('SET search_path TO '+quoted);await admin.query(lifecycleSchema);
 pool=trackDisposablePool(new Pool({connectionString:url.href,max:6}));
 await query(`INSERT INTO public."Organization"(id,name,"clerkOrganizationId",metadata) VALUES('org-a','Empresa sintética A','org_A','{}'),('org-b','Empresa sintética B','org_B','{}');
 INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('owner','user_Owner','owner@example.invalid'),('foreign','user_Foreign','foreign@example.invalid');
 INSERT INTO public."TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('owner-m','owner','org-a','ADMIN','org:admin','ACTIVE'),('foreign-m','foreign','org-b','ADMIN','org:admin','ACTIVE');
 INSERT INTO public."Project"(id,"organizationId",name,status,metadata) VALUES('anchor-a','org-a','Ancla A','ACTIVE','{}'),('project-a','org-a','Obra de revisión A','ACTIVE','{}'),('project-a2','org-a','Otra obra A','ACTIVE','{}'),('project-b','org-b','Obra B','ACTIVE','{}');`);
 const metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:'org-a',customerSubscribed:true,customerActivation:{version:1,state:'ACTIVE'},customerVerification:{registered:true,scopes:['whatsapp_business_management','whatsapp_business_messaging'],expiresAt:null}};
 await query(`INSERT INTO public."WhatsAppConnection"(id,"projectId",enabled,"connectionStatus","phoneNumberId","whatsappBusinessId","encryptedAccessToken","displayPhoneNumber","verifiedBusinessName",metadata) VALUES($1,'anchor-a',true,'CONNECTED',$2,$3,'synthetic-private-cipher','+5491100009999','Nombre privado',$4::jsonb)`,[connectionId,phoneId,wabaId,JSON.stringify(metadata)]);
 await query(COMPANY_CHANNEL_SCHEMA_SQL);
 await query(`UPDATE public."WhatsAppCompanyChannel" SET mode='COMPANY',revision=5 WHERE "connectionId"=$1;`,[connectionId]);
 await query(`INSERT INTO public."WhatsAppChannelProjectAssignment"("connectionId","organizationId","projectId",status,revision) VALUES($1,'org-a','project-a','ACTIVE',2)`,[connectionId]);
 await query(`INSERT INTO public."WebhookEvent"(id,"projectId",provider,status,payload) VALUES($1,'anchor-a','meta-customer-v1','PROCESSED',$2::jsonb)`,[eventId,JSON.stringify(sourceEvent())]);
 const workspace=createWorkspaceStore({connect}),store=createOfficeReviewStore({workspace,connect,identity,environment});
 const context=async session=>({projectId:'project-a',scope:(await workspace.list(session)).scope}),ownerContext=await context(owner);
 const command=(action,payload,operationId=randomUUID())=>({...ownerContext,action,payload,operationId});
 const invite=async session=>store.command(owner,command('INVITE_AUDITOR',{email:emails.get(session.userId),connectionId,expiresAt:expiry,confirmReadOnly:true}));
 const acceptedA=await invite(reviewerA),acceptedB=await invite(reviewerB),pending=await invite(pendingReviewer);
 await store.join(reviewerA,{invitationId:acceptedA.invitationId,operationId:randomUUID()},{accept:true});
 await store.join(reviewerB,{invitationId:acceptedB.invitationId,operationId:randomUUID()},{accept:true});
 const contextA=await context(reviewerA),contextB=await context(reviewerB);
 const readA=()=>store.review(reviewerA,contextA),readB=()=>store.review(reviewerB,contextB);
 const unsharedA=await readA(),unsharedB=await readB();assert.equal(unsharedA.connection,null);assert.equal(unsharedB.connection,null);assert.equal(unsharedA.canObserveConfiguration,false);assert.equal(unsharedB.canObserveConfiguration,false);
 checks.push('accepted-canonical-AUDITOR-grants-do-not-implicitly-share-a-connection');
 const shareA=command('SHARE_CONNECTION',{invitationId:acceptedA.invitationId,connectionId,confirmReadOnlyConfiguration:true});
 const shareB=command('SHARE_CONNECTION',{invitationId:acceptedB.invitationId,connectionId,confirmReadOnlyConfiguration:true});
 const beforePending=await snapshot();await deny(store.command(owner,command('SHARE_CONNECTION',{invitationId:pending.invitationId,connectionId,confirmReadOnlyConfiguration:true})));assert.deepEqual(await snapshot(),beforePending);
 checks.push('an-invitation-without-accepted-grant-cannot-share-configuration');
 const savedA=await store.command(owner,shareA),firstA=await readA();assert.equal(savedA.saved,true);assertConnection(firstA.connection);assert.equal((await readB()).connection,null);assert.equal(firstA.canObserveConfiguration,true);assert.equal(firstA.canSend,false);assert.equal(firstA.canManage,false);
 assert.doesNotMatch(JSON.stringify(firstA),/private-company-channel|70000001|70000002|549110000|synthetic-private-cipher|Nombre privado|encrypted|accessToken|wamid/);
 checks.push('explicit-per-invitation-sharing-is-isolated-between-two-auditors-and-projects-only-opaque-stored-configuration');
 const beforeReplay=await snapshot(),replayed=await store.command(owner,shareA);assert.equal(replayed.receiptId,savedA.receiptId);assert.equal(replayed.replayed,true);assert.deepEqual(await snapshot(),beforeReplay);
 await assert.rejects(store.command(owner,{...shareA,payload:{...shareA.payload,invitationId:acceptedB.invitationId}}),{code:'OFFICE_REVIEW_OPERATION_CONFLICT'});assert.deepEqual(await snapshot(),beforeReplay);
 const recovered=await store.status(owner,{...ownerContext,operationId:shareA.operationId});assert.equal(recovered.receiptId,savedA.receiptId);assert.equal(recovered.saved,true);
 checks.push('same-UUID-replay-and-status-are-read-only-and-changed-payload-conflicts');
 await store.command(owner,command('SELECT_EVENT',{connectionId,eventId,confirmNoPersonalData:true}));
 const beforeRead=await snapshot(),queryStart=runtimeQueries.length,callsBeforeRead=controlledIdentityCalls.length;
 const reviewed=await readA();assert.equal(reviewed.items.length,1);assert.equal(reviewed.items[0].signatureVerified,true);assert.equal(reviewed.items[0].replyState,'NOT_OBSERVED');assert.deepEqual(await snapshot(),beforeRead);assert.equal(controlledIdentityCalls.length,callsBeforeRead);
 const queries=runtimeQueries.slice(queryStart);assert.ok(queries.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));assert.equal(queries.some(sql=>/^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/.test(sql)),false);
 checks.push('connection-and-signed-selected-event-use-a-real-repeatable-read-read-only-transaction-with-zero-provider-effects');
 const failBody=command('WITHDRAW_CONNECTION',{invitationId:acceptedA.invitationId,reason:'Retiro sintético para comprobar rollback'}),beforeRollback=await snapshot();failAudit=true;
 await assert.rejects(store.command(owner,failBody),error=>error.status===503);assert.deepEqual(await snapshot(),beforeRollback);assert.deepEqual((await readA()).connection,firstA.connection);
 checks.push('failed-selection-audit-rolls-back-the-entire-connection-command-and-preserves-prior-share');
 const withdrawn=await store.command(owner,failBody);assert.equal(withdrawn.saved,true);assert.equal((await readA()).connection,null);assert.equal((await readB()).connection,null);
 await store.command(owner,shareA);assert.equal((await readA()).connection,null);
 const reshared=command('SHARE_CONNECTION',{invitationId:acceptedA.invitationId,connectionId,confirmReadOnlyConfiguration:true});await store.command(owner,reshared);assert.ok((await readA()).connection);
 checks.push('withdrawal-wins-over-old-share-replay-and-an-explicit-new-operation-may-reshare');
 const lost=command('WITHDRAW_CONNECTION',{invitationId:acceptedA.invitationId,reason:'Retiro sintético con confirmación de COMMIT perdida'});loseCommitAck=true;
 await assert.rejects(store.command(owner,lost),error=>error.status===503);assert.equal((await readA()).connection,null);
 const lostRecovered=await store.status(owner,{...ownerContext,operationId:lost.operationId});assert.equal(lostRecovered.state,'RECORDED');const beforeLostReplay=await snapshot();assert.equal((await store.command(owner,lost)).receiptId,lostRecovered.receiptId);assert.deepEqual(await snapshot(),beforeLostReplay);
 checks.push('lost-commit-ack-is-recovered-by-exact-GET-and-replay-without-a-second-selection');
 await store.command(owner,command('SHARE_CONNECTION',{invitationId:acceptedA.invitationId,connectionId,confirmReadOnlyConfiguration:true}));await store.command(owner,shareB);
 const concurrentShare=command('SHARE_CONNECTION',{invitationId:acceptedA.invitationId,connectionId,confirmReadOnlyConfiguration:true}),concurrentWithdraw=command('WITHDRAW_CONNECTION',{invitationId:acceptedA.invitationId,reason:'Retiro explícito concurrente de la configuración'});
 const concurrent=await Promise.all([store.command(owner,concurrentShare),store.command(owner,concurrentWithdraw)]);assert.equal(concurrent.length,2);assert.ok(concurrent.every(result=>result.saved));
 const history=(await query(`SELECT action,metadata FROM public."AuditLog" WHERE action IN ('office.review.connection.shared','office.review.connection.withdrawn') AND metadata->>'invitationId'=$1 ORDER BY (metadata->>'selectionRevision')::integer`,[acceptedA.invitationId])).rows;
 assert.deepEqual(history.map(row=>row.metadata.selectionRevision),Array.from({length:history.length},(_,index)=>index+1));assert.equal((await readA()).connection!==null,history.at(-1).action==='office.review.connection.shared');
 await store.command(owner,command('SHARE_CONNECTION',{invitationId:acceptedA.invitationId,connectionId,confirmReadOnlyConfiguration:true}));
 checks.push('concurrent-share-and-withdraw-serialize-one-contiguous-selection-revision-history');
 const beforeDenied=await snapshot();await deny(store.command(reviewerA,{...shareA,scope:contextA.scope,operationId:randomUUID()}));await deny(store.command(foreign,{...shareA,scope:(await workspace.list(foreign)).scope,operationId:randomUUID()}));await deny(store.review(reviewerA,{...contextA,projectId:'project-a2'}));await assert.rejects(store.review(reviewerA,{...contextA,scope:'0'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.deepEqual(await snapshot(),beforeDenied);
 checks.push('auditor-writes-foreign-tenant-other-project-and-stale-context-deny-before-storage');
 const memberA=(await query(`SELECT id,"userId" FROM public."TenantMembership" WHERE "organizationId"='org-a' AND "userId" IN (SELECT id FROM public."PlatformUser" WHERE "clerkUserId"=$1)`,[reviewerA.userId])).rows[0];
 const mutations=[
  [`UPDATE public."WhatsAppConnection" SET enabled=false WHERE id=$1`,`UPDATE public."WhatsAppConnection" SET enabled=true WHERE id=$1`,[connectionId]],
  [`UPDATE public."WhatsAppConnection" SET "connectionStatus"='DISABLED' WHERE id=$1`,`UPDATE public."WhatsAppConnection" SET "connectionStatus"='CONNECTED' WHERE id=$1`,[connectionId]],
  [`UPDATE public."WhatsAppCompanyChannel" SET mode='SUSPENDED' WHERE "connectionId"=$1`,`UPDATE public."WhatsAppCompanyChannel" SET mode='COMPANY' WHERE "connectionId"=$1`,[connectionId]],
  [`UPDATE public."WhatsAppCompanyChannel" SET revision=6 WHERE "connectionId"=$1`,`UPDATE public."WhatsAppCompanyChannel" SET revision=5 WHERE "connectionId"=$1`,[connectionId]],
  [`UPDATE public."WhatsAppChannelProjectAssignment" SET revision=3 WHERE "connectionId"=$1 AND "projectId"='project-a'`,`UPDATE public."WhatsAppChannelProjectAssignment" SET revision=2 WHERE "connectionId"=$1 AND "projectId"='project-a'`,[connectionId]],
  [`UPDATE public."WhatsAppChannelProjectAssignment" SET status='REVOKED' WHERE "connectionId"=$1 AND "projectId"='project-a'`,`UPDATE public."WhatsAppChannelProjectAssignment" SET status='ACTIVE' WHERE "connectionId"=$1 AND "projectId"='project-a'`,[connectionId]],
  [`UPDATE public."WhatsAppConnection" SET "phoneNumberId"='70000009' WHERE id=$1`,`UPDATE public."WhatsAppConnection" SET "phoneNumberId"=$2 WHERE id=$1`,[connectionId,phoneId]],
  [`UPDATE public."WhatsAppConnection" SET "whatsappBusinessId"='70000008' WHERE id=$1`,`UPDATE public."WhatsAppConnection" SET "whatsappBusinessId"=$2 WHERE id=$1`,[connectionId,wabaId]],
  [`UPDATE public."TenantMembership" SET "tenantRole"='DIRECTOR' WHERE id='owner-m'`,`UPDATE public."TenantMembership" SET "tenantRole"='ADMIN' WHERE id='owner-m'`,[]],
  [`UPDATE public."TenantMembership" SET status='DISABLED' WHERE id=$1`,`UPDATE public."TenantMembership" SET status='ACTIVE' WHERE id=$1`,[memberA.id]],
  [`UPDATE public."ProjectMembership" SET status='DISABLED' WHERE "tenantMembershipId"=$1 AND "projectId"='project-a'`,`UPDATE public."ProjectMembership" SET status='ACTIVE' WHERE "tenantMembershipId"=$1 AND "projectId"='project-a'`,[memberA.id]],
  [`UPDATE public."Project" SET status='ARCHIVED' WHERE id='project-a'`,`UPDATE public."Project" SET status='ACTIVE' WHERE id='project-a'`,[]]
 ];
 for(const [change,restore,args] of mutations){await query(change,args.slice(0,change.includes('$2')?2:change.includes('$1')?1:0));try{await deny(readA());}finally{await query(restore,args);}}
 checks.push('fresh-review-denies-disabled-channel-mode-role-membership-project-and-both-current-revisions');
 await query(`UPDATE public."TenantMembership" SET "tenantRole"='DIRECTOR' WHERE id=$1`,[memberA.id]);try{await deny(store.review(reviewerA,await context(reviewerA)));}finally{await query(`UPDATE public."TenantMembership" SET "tenantRole"='AUDITOR' WHERE id=$1`,[memberA.id]);}
 const selected=(await query(`SELECT id,metadata FROM public."AuditLog" WHERE action='office.review.connection.shared' AND metadata->>'invitationId'=$1 ORDER BY (metadata->>'selectionRevision')::integer DESC LIMIT 1`,[acceptedA.invitationId])).rows[0];
 await query(`UPDATE public."AuditLog" SET metadata=jsonb_set(metadata,'{connectionDigest}',to_jsonb($2::text)) WHERE id=$1`,[selected.id,'f'.repeat(64)]);try{await deny(readA());}finally{await query(`UPDATE public."AuditLog" SET metadata=$2::jsonb WHERE id=$1`,[selected.id,JSON.stringify(selected.metadata)]);}
 const signedSource=sourceEvent();await query(`UPDATE public."WebhookEvent" SET payload=jsonb_set(payload,'{encryptedProof}',payload->'encryptedPayload') WHERE id=$1`,[eventId]);try{await deny(readA());}finally{await query(`UPDATE public."WebhookEvent" SET payload=$2::jsonb WHERE id=$1`,[eventId,JSON.stringify(signedSource)]);}
 checks.push('current-auditor-role-selection-digest-and-signed-event-source-tampering-fail-closed');
 await query(`INSERT INTO public."PlatformUser"(id,"clerkUserId","primaryEmail") VALUES('selector','user_Selector','selector@example.invalid');
 INSERT INTO public."TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES('selector-m','selector','org-a','ADMIN','org:admin','ACTIVE');`);
 const selector=signed('user_Selector','org_A','org:admin'),selectorContext=await context(selector);
 await store.command(selector,{...command('SHARE_CONNECTION',{invitationId:acceptedA.invitationId,connectionId,confirmReadOnlyConfiguration:true}),scope:selectorContext.scope});assertConnection((await readA()).connection);
 await query(`UPDATE public."TenantMembership" SET "tenantRole"='DIRECTOR' WHERE id='selector-m'`);try{await deny(readA());}finally{await query(`UPDATE public."TenantMembership" SET "tenantRole"='ADMIN' WHERE id='selector-m'`);}
 checks.push('selection-responsible-ADMIN-must-remain-current-independently-of-the-invitation-issuer');
 await query(`INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('field-origin','org-a',$1,'participant.operation.recorded','Worker','deleted-worker',$2::jsonb)`,[memberA.userId,JSON.stringify({kind:'INVITATION_ACCEPTED',projectId:'project-a'})]);await deny(readA());await query(`DELETE FROM public."AuditLog" WHERE id='field-origin'`);
 checks.push('historical-field-account-origin-cannot-use-the-office-read-composition');
 const expired=new Date(Date.now()-60000).toISOString();await query(`UPDATE public."AuditLog" SET metadata=jsonb_set(metadata,'{expiresAt}',to_jsonb($1::text)) WHERE metadata->>'invitationId'=$2 AND action IN ('office.review.accepted','office.review.invitation.attempted')`,[expired,acceptedA.invitationId]);await deny(readA());await query(`UPDATE public."AuditLog" SET metadata=jsonb_set(metadata,'{expiresAt}',to_jsonb($1::text)) WHERE metadata->>'invitationId'=$2 AND action IN ('office.review.accepted','office.review.invitation.attempted')`,[expiry,acceptedA.invitationId]);
 checks.push('grant-expiry-is-evaluated-by-database-clock-on-every-read');
 const handler=createOfficeReviewHandlers({verify:async()=>owner,store}),badOrigin=await handler.POST(new Request('https://obrasaas.com/api/identity/office-review',{method:'POST',headers:{origin:'https://evil.invalid','content-type':'application/json'},body:JSON.stringify(shareA)}));assert.equal(badOrigin.status,403);assert.match(badOrigin.headers.get('cache-control'),/no-store/);
 checks.push('connection-HTTP-denial-preserves-private-no-store-origin-boundary');
 await store.command(owner,command('REVOKE_AUDITOR',{invitationId:acceptedA.invitationId,reason:'Finalización sintética del acceso de revisión'}));await deny(readA());await deny(store.join(reviewerA,{invitationId:acceptedA.invitationId}));assert.ok((await readB()).connection);assert.equal((await query(`SELECT status::text AS status FROM public."ProjectMembership" WHERE "tenantMembershipId"=$1 AND "projectId"='project-a'`,[memberA.id])).rows[0].status,'DISABLED');
 checks.push('revoking-one-invitation-disables-its-project-membership-and-preserves-the-second-auditor');
 assert.equal((await query(`SELECT count(*)::int AS n FROM public."Worker"`)).rows[0].n,0);assert.equal(networkCalls,0);assert.deepEqual(sqlFailures,[]);
}finally{
 globalThis.fetch=originalFetch;
 try{if(pool)await closeDisposablePool(pool);if(created){assert.match(schema,/^obrasaas_office_review_[a-f0-9]{32}$/);await admin.query('DROP SCHEMA '+quoted+' CASCADE');assert.equal((await admin.query('SELECT nspname FROM pg_namespace WHERE nspname=$1',[schema])).rows.length,0);removed=true;}}finally{await admin.end();}
}
assertStableSource();
const proof={status:'PASS',checkedAt:new Date().toISOString(),...initialSourceState,sourceManifest,harnessSha256,checks,sqlFailures,schemaRemoved:removed,databaseCreated:false,providerCalls:0,controlledIdentityLookups:controlledIdentityCalls.length,unexpectedNetworkCalls:networkCalls,syntheticIdentityOnly:true,realClerkLogin:false,normalHumanLoginVerified:false,realMetaAccepted:false,realMessageDeliveryVerified:false,humanAccepted:false,productionDataTouched:false};
mkdirSync('.vercel/office-review-evidence',{recursive:true});writeFileSync('.vercel/office-review-evidence/postgres.json',JSON.stringify(proof,null,2));
console.log(JSON.stringify({status:proof.status,checks:checks.length,schemaRemoved:removed,providerCalls:0,sourceRevision:proof.sourceRevision,sourceState:proof.sourceState,trackedClean:proof.trackedClean}));
