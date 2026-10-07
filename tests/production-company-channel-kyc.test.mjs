import test from 'node:test';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {createParticipantChannelKycUploader,createParticipantChannelKycDeposit} from '../src/lib/participant-channel-kyc.mjs';
import {createMetaKycBridge} from '../src/lib/meta-kyc-bridge.mjs';
import {resolveMetaKycAuthority} from '../src/lib/meta-kyc-identity.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {createHash} from 'node:crypto';
import {lifecyclePng} from '../scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {prepareMetaKycChallenge} from '../src/lib/meta-kyc-challenge.mjs';
import {randomUUID} from 'node:crypto';

test('corporate INVITED preparation uses the selected Worker project and refuses a foreign invitation receipt',async()=>{
 const f=await companyKycMemoryFixture(),client={query:f.query};
 const projected=await client.query('SELECT id,phone,active,metadata,to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.US\') AS revision FROM public."Worker" WHERE id=$1 AND "projectId"=$2 FOR UPDATE',[f.worker.id,f.target.id]);
 assert.equal(Object.hasOwn(projected.rows[0],'projectId'),false);
 assert.equal(f.worker.metadata.participant.kycChatChallenge.projectId,f.target.id);
 assert.equal(f.worker.metadata.participant.kycChatChallenge.companyKyc.targetProjectId,f.target.id);
 f.audits.get('invite_receipt').metadata.projectId=f.anchor.id;
 const before=structuredClone(f.worker.metadata);
 await prepareMetaKycChallenge.beforeProject(client,f.issuer,{projectId:f.target.id});
 await assert.rejects(prepareMetaKycChallenge(client,f.issuer,f.target,{workerId:f.worker.id,revision:f.worker.revision,operationId:randomUUID()}),{code:'META_KYC_CHALLENGE_REVOKED'});
 assert.deepEqual(f.worker.metadata,before);assert.equal(f.controls.sends,0);
});

test('corporate signed KYC resolves authentic selected event metadata on both initial and locked reads',async()=>{
 const f=await companyKycMemoryFixture(),context=f.receive(f.code);
 const projected=await f.query('SELECT id,"projectId",provider,status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1',[context.eventId]);
 assert.equal(Object.hasOwn(projected.rows[0],'eventType'),false);assert.equal(Object.hasOwn(projected.rows[0],'externalId'),false);
 const complete=(await f.query('SELECT * FROM public."WebhookEvent" WHERE id=$1 AND "projectId"=$2',[context.eventId,f.anchor.id])).rows[0];
 assert.equal(complete.eventType,'message');assert.equal(complete.externalId,f.events.get(context.eventId).externalId);
 const result=await f.bridge.execute(context);
 assert.equal(result.kind,'KYC_CHAT');assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'CLAIMED');
 assert.equal([...f.audits.values()].find(row=>row.action==='participant.kyc_chat.projected').metadata.targetProjectId,f.target.id);
 assert.equal(f.controls.sends,0);
});

for(const stage of ['initial','locked'])for(const [field,code] of [['eventType','WORKER_CHANNEL_SIGNED_PROOF_REQUIRED'],['externalId','WORKER_CHANNEL_PROOF_INTEGRITY']])test(stage+' corporate signed read rejects missing authentic '+field+' and rolls back before I/O',async()=>{
 const f=await companyKycMemoryFixture(),context=f.receive(f.code),before=structuredClone(f.worker.metadata),audits=[...f.audits.keys()];let removed=false;
 f.control.hook=async(sql,args)=>{
  if(sql.startsWith('SELECT id,')&&sql.includes('FROM public."WebhookEvent"')&&sql.includes('"createdAt"')&&args[0]===context.eventId&&sql.includes('FOR UPDATE')===(stage==='locked')){delete f.events.get(context.eventId)[field];removed=true;}
 };
 await assert.rejects(f.bridge.execute(context),{code});assert.equal(removed,true);
 assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits.keys()],audits);assert.equal(f.controls.sends,0);assert.equal(f.control.graph,0);assert.equal(f.control.cdn,0);assert.equal(f.blob.puts(),0);assert.equal(f.outbounds.size,0);assert.ok(f.control.rollbacks>0);
});

test('issuing a corporate challenge cannot overlap a live capture of the same phone on another worksite',async()=>{
 const f=await companyKycMemoryFixture(),client={query:f.query};
 for(const status of ['PENDING','CLAIMED']){
  f.control.competingChallenges=[{id:'worker-other',metadata:{participant:{kycChatChallenge:{status,expiresAt:new Date(f.now.getTime()+60000).toISOString(),claimedAt:f.now.toISOString()}}}}];
  await prepareMetaKycChallenge.beforeProject(client,f.issuer,{projectId:f.target.id});
  const before=JSON.stringify(f.worker.metadata);
  await assert.rejects(prepareMetaKycChallenge(client,f.issuer,f.target,{workerId:f.worker.id,revision:f.worker.revision,operationId:randomUUID()}),{code:'META_KYC_CHALLENGE_AMBIGUOUS'});
  assert.equal(JSON.stringify(f.worker.metadata),before);assert.equal(f.controls.sends,0);
 }
});

for(const stage of ['initial-get','put'])test('private uploader '+stage+' suspension revalidates before the next Blob IO and preserves denial',async()=>{
 const f=await companyKycMemoryFixture({active:true});await f.toConfirmation();let gets=0,puts=0;
 const upload=createParticipantChannelKycUploader({environment:()=>f.environment,
  get:async(...args)=>{gets++;const result=await f.blob.get(...args);if(stage==='initial-get')f.controls.projectAssignmentActive=false;return result;},
  put:async(...args)=>{puts++;const result=await f.blob.put(...args);if(stage==='put')f.controls.projectAssignmentActive=false;return result;}});
 const deposit=createParticipantChannelKycDeposit({connect:f.connect,resolveAuthority:resolveMetaKycAuthority,upload,environment:f.environment});
 const bridge=createMetaKycBridge({connect:f.connect,provider:f.provider,deposit,environment:f.environment}),s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});
 await assert.rejects(bridge.execute(context),{code:'META_KYC_CHALLENGE_REVOKED'});
 assert.equal(gets,1);assert.equal(puts,stage==='put'?1:0);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
 assert.equal([...f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED').length,0);
});
test('real provider Graph-to-CDN guard receives the corporate frozen authority and preserves WorkspaceError',async()=>{
 const f=await companyKycMemoryFixture({active:true});await f.toConfirmation();const calls=[];
 const provider=createMetaCustomerProvider({environment:f.environment,fetchImpl:async(url,options)=>{
  calls.push({url:String(url),method:options.method||'GET'});
  assert.equal(new URL(url).hostname,'graph.facebook.com');
  f.controls.projectAssignmentActive=false;
  return Response.json({id:'150000011',url:'https://lookaside.fbsbx.com/whatsapp_business/attachments/synthetic',mime_type:'image/png',file_size:lifecyclePng.length,sha256:createHash('sha256').update(lifecyclePng).digest('hex')});
 }});
 const bridge=createMetaKycBridge({connect:f.connect,provider,deposit:f.deposit,environment:f.environment}),s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});
 await assert.rejects(bridge.execute(context),{code:'META_KYC_CHALLENGE_REVOKED'});
 assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');assert.equal(f.blob.puts(),0);
});
test('corporate capabilities describe support only and preserve the historical receipt recovery contract',()=>{
 const old={scope:'a'.repeat(64),projectId:'project-a',operationId:'11111111-1111-4111-8111-111111111111',action:'ACTIVATE',state:'RECORDED',saved:true,definitive:true,receiptId:'old_receipt',replayed:true,organization:{id:'org_Test',name:'Synthetic'},actor:{id:'actor_Test',role:'ADMIN'},channel:{id:'connection-a',anchorProjectId:'project-a',anchorName:'Synthetic',displayPhoneNumber:null,mode:'COMPANY',revision:3,assignments:[],capabilities:{attendance:true,media:true,kyc:false,flows:false,templates:false}}};
 const expected={scope:old.scope,projectId:old.projectId,operationId:old.operationId,action:old.action};
 assert.equal(companyChannelOutcome(old,expected).state,'RECORDED');
 const snapshot={...old,schemaReady:true,canManage:true,truncated:false,accepted:false,channels:[old.channel],projects:[],capabilities:old.channel.capabilities};
 assert.throws(()=>companyChannelSnapshot(snapshot,expected));
});
import {companyChannelOutcome,companyChannelSnapshot} from '../src/app/(identity)/cuenta/company-channel-view.mjs';
for(const [label,mutate,code] of [
 ['owner suspended',f=>{f.owner.mode='SUSPENDED';},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['assignment revision changed',f=>{f.owner.assignmentRevision++;},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['assignment revoked',f=>{f.control.assignment=false;},'META_KYC_CHALLENGE_REJECTED'],
 ['issuer revoked',f=>{f.controls.issuerActive=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['issuer loses management role',f=>{f.issuer.role='SITE_MANAGER';},'META_KYC_CHALLENGE_REVOKED'],
 ['issuer revoke and restore receipt',f=>{f.control.trail.push('canonical_role_cycle');},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['worker revoked',f=>{f.worker.metadata.participant.status='REVOKED';},'META_KYC_CHALLENGE_REVOKED'],
 ['grant changed',f=>{f.connection.metadata.customerVerification.scopes=[];},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['pilot substituted',f=>{f.connection.metadata.developmentPilot={};},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['expired invitation',f=>{f.worker.metadata.participant.invitation.expiresAt=new Date(f.now.getTime()-1).toISOString();},'META_KYC_CHALLENGE_REVOKED'],
 ['missing invitation receipt',f=>{f.audits.delete('invite_receipt');},'META_KYC_CHALLENGE_REVOKED'],
 ['schema unavailable',f=>{f.control.schema=false;},'COMPANY_CHANNEL_CATALOG_REQUIRED']
])test('corporate '+label+' stops before capture or external IO',async()=>{
 const f=await companyKycMemoryFixture(),context=f.receive(f.code);mutate(f);
 await assert.rejects(f.bridge.execute(context),{code});
 assert.equal(f.control.graph,0);assert.equal(f.control.cdn,0);assert.equal(f.blob.puts(),0);assert.equal(f.controls.sends,0);
 assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected').length,0);
});
test('active capture requires its real Clerk membership and B assignment without inventing a guest membership',async()=>{
 for(const target of ['membership','assignment']){
  const f=await companyKycMemoryFixture({active:true}),context=f.receive(f.code);
  if(target==='membership')f.controls.workerMembershipActive=false;else f.controls.projectAssignmentActive=false;
  await assert.rejects(f.bridge.execute(context),{code:'META_KYC_CHALLENGE_REVOKED'});assert.equal(f.blob.puts(),0);
 }
});
test('old or absent prompt context and a stale nonce cannot reserve a KYC source in B',async()=>{
 for(const variant of ['absent','foreign','nonce','unknown']){
  const f=await companyKycMemoryFixture();await f.execute(f.code);
  const s=f.state(),message={type:'interactive',interactive:{list_reply:{id:'kyc:'+(variant==='nonce'?'f'.repeat(20):s.nonce)+':0'}}};
  if(variant==='unknown')[...f.outbounds.values()].at(-1).outcome.state='SEND_UNKNOWN';
  const context=f.receive(message,{...(variant==='absent'?{contextId:null}:variant==='foreign'?{contextId:'wamid.ForeignPrompt_123'}:{})});
  const before=f.audits.size,metadata=JSON.stringify(f.worker.metadata);
  await assert.rejects(f.bridge.execute(context),{code:'META_KYC_COMPANY_CONTEXT_REQUIRED'});
  assert.equal(f.audits.size,before);assert.equal(JSON.stringify(f.worker.metadata),metadata);assert.equal(f.control.graph,0);
 }
});
for(const cause of ['lease','grant','reply'])test('corporate final '+cause+' expiry after Audit write rolls back Worker and projection',async()=>{
 const f=await companyKycMemoryFixture({grantLifetimeMs:cause==='grant'?90000:null}),context=f.receive(f.code),before=JSON.stringify(f.worker.metadata),count=f.audits.size;
 f.control.hook=async sql=>{if(sql.startsWith('SELECT id,"projectId",payload')&&sql.includes('clock_timestamp()')){
  if(cause==='lease')f.now.setTime(f.now.getTime()+61000);
  if(cause==='grant')f.now.setTime(f.now.getTime()+31000);
  if(cause==='reply')f.now.setTime(f.now.getTime()+24*3600000);
 }};
 await assert.rejects(f.bridge.execute(context),error=>['META_CUSTOMER_INBOX_LEASE_CHANGED','META_KYC_CHALLENGE_REVOKED'].includes(error.code));
 assert.equal(JSON.stringify(f.worker.metadata),before);assert.equal(f.audits.size,count);assert.equal(f.controls.sends,0);assert.ok(f.control.rollbacks>0);
});
test('Graph readback suspension followed by PM revocation prevents CDN GET and every Blob operation',async()=>{
 const f=await companyKycMemoryFixture({active:true});await f.toConfirmation();
 f.control.afterGraph=async()=>{f.controls.projectAssignmentActive=false;};
 await assert.rejects(f.choose('Guardar identidad'),{code:'META_KYC_CHALLENGE_REVOKED'});
 assert.equal(f.control.graph,1);assert.equal(f.control.cdn,0);assert.equal(f.blob.puts(),0);
 assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');
});
test('lease expiry between Graph and CDN cannot be renewed by a deposit replay',async()=>{
 const f=await companyKycMemoryFixture();await f.toConfirmation();
 f.control.afterGraph=async()=>{f.now.setTime(f.now.getTime()+61000);};
 await assert.rejects(f.choose('Guardar identidad'),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});
 assert.equal(f.control.graph,1);assert.equal(f.control.cdn,0);assert.equal(f.blob.puts(),0);
});
test('post-provider authorization loss keeps SEND_STARTED uncertain and never resends the same outbound',async()=>{
 const f=await companyKycMemoryFixture(),context=f.receive(f.code),result=await f.bridge.execute(context);
 f.control.afterSend=async()=>{f.controls.issuerActive=false;};
 await assert.rejects(f.outbound.send(context,result.reply),{code:'META_KYC_CHALLENGE_REVOKED'});
 assert.equal(f.controls.sends,1);assert.equal([...f.outbounds.values()].at(-1).outcome.state,'SEND_STARTED');
 f.controls.issuerActive=true;f.control.afterSend=null;
 const recovered=await f.outbound.send(context,result.reply);assert.equal(recovered.state,'SEND_STARTED');assert.equal(f.controls.sends,1);
});
test('inbound plaintext or purpose cannot reconstruct B without the canonical encrypted corporate source',async()=>{
 const f=await companyKycMemoryFixture(),context=f.receive(f.code,{company:false});
 await assert.rejects(f.bridge.execute(context),error=>error.code==='META_KYC_CHALLENGE_REJECTED'||error.code==='META_KYC_NOT_APPLICABLE');
 assert.equal(f.controls.sends,0);assert.equal(f.blob.puts(),0);
});
test('corporate signed KYC deposits into B with encrypted conversation and outbound anchored only to A',async()=>{
 const f=await companyKycMemoryFixture();await f.toConfirmation();const before=f.worker.metadata.participant.permissions;
 const final=await f.choose('Guardar identidad');
 assert.equal(final.result.businessApplied,true);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_ACCOUNT_CLAIM');assert.deepEqual(f.worker.metadata.participant.permissions,before);
 assert.equal(f.blob.puts(),2);assert.equal(f.control.graph,2);assert.equal(f.control.cdn,2);
 const captured=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED');
 assert.equal(captured.metadata.projectId,f.target.id);assert.equal(captured.actorId,f.issuer.actorId);
 const projection=[...f.audits.values()].find(a=>a.action==='participant.kyc_chat.projected');
 assert.equal(projection.metadata.anchorProjectId,f.anchor.id);assert.equal(projection.metadata.targetProjectId,f.target.id);
 assert.ok([...f.events.values(),...f.outbounds.values()].every(e=>e.projectId===f.anchor.id));
 const puts=f.blob.puts(),sends=f.controls.sends;
 await f.bridge.execute(final.context);await f.outbound.send(final.context,final.result.reply);
 assert.equal(f.blob.puts(),puts);assert.equal(f.controls.sends,sends);
});
for(const cause of ['lease','grant'])test('corporate deposit '+cause+' expiry after the KYC_SUBMITTED write rolls back submission and keeps the confirmation pending',async()=>{
 const f=await companyKycMemoryFixture({grantLifetimeMs:cause==='grant'?90000:null});await f.toConfirmation();
 const s=f.state(),context=f.receive({type:'interactive',interactive:{list_reply:{id:'kyc:'+s.nonce+':0'}}});
 f.control.hook=async(sql,args)=>{if(sql.startsWith('INSERT INTO public."AuditLog"')&&sql.includes("'participant.operation.recorded'")&&JSON.parse(args[4]).kind==='KYC_SUBMITTED')f.now.setTime(f.now.getTime()+(cause==='lease'?61000:31000));};
 await assert.rejects(f.bridge.execute(context),error=>['META_CUSTOMER_INBOX_LEASE_CHANGED','META_KYC_CHALLENGE_REVOKED'].includes(error.code));
 assert.equal(f.blob.puts(),2);assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal([...f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED').length,0);assert.equal(f.state().step,'FINALIZING');
});
test('deposit revalidates each image source projection rather than accepting the media ID of another target',async()=>{
 const f=await companyKycMemoryFixture();await f.toConfirmation();
 const source=f.state().front.eventId,row=[...f.audits.values()].find(a=>a.action==='participant.kyc_chat.projected'&&a.metadata.sourceEventId===source);row.metadata.targetProjectId='project-other';
 await assert.rejects(f.choose('Guardar identidad'),{code:'META_KYC_COMPANY_PROJECTION_REJECTED'});assert.equal(f.control.graph,0);assert.equal(f.control.cdn,0);assert.equal(f.blob.puts(),0);
});
import assert from 'node:assert/strict';
import {companyKycProjectionContract,companyKycProjectionDigest,companyKycProjectionId,companyKycProjectLockIds,companyKycSecretContext} from '../src/lib/company-channel-kyc.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';

const projection=()=>({version:1,kind:'COMPANY_KYC_CAPTURE',sourceEventId:'customer_webhook_'+'a'.repeat(64),payloadDigest:'b'.repeat(64),organizationId:'org_synthetic',connectionId:'connection_a',anchorProjectId:'project_a',targetProjectId:'project_b',workerId:'worker_b',challengeId:'kyc_chat_synthetic',ownerRevision:3,assignmentRevision:7,grantDigest:'c'.repeat(64),issuerActorId:'issuer_synthetic',issuerMembershipId:'membership_issuer',authorityDigest:'d'.repeat(64),participantActorId:null,participantMembershipId:null,participantClerkUserId:null});
const environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,7).toString('base64')};
test('projection JSONB key order cannot change its digest or original source reservation',()=>{
 const p=projection(),reordered=Object.fromEntries(Object.entries(p).reverse());
 assert.equal(companyKycProjectionDigest(p),companyKycProjectionDigest(reordered));
 assert.equal(companyKycProjectionId(p.sourceEventId),companyKycProjectionId(reordered.sourceEventId));
 assert.deepEqual(companyKycProjectLockIds('project_b','project_a'),['project_a','project_b']);
 assert.deepEqual(companyKycProjectLockIds('project_a','project_a'),['project_a']);
});
test('a tuple pins source, tenant, target, worker, assignment, grant and issuer independently',()=>{
 const p=projection();
 for(const [key,value] of Object.entries({sourceEventId:'customer_webhook_'+'e'.repeat(64),payloadDigest:'e'.repeat(64),organizationId:'org_other',connectionId:'connection_other',anchorProjectId:'project_other',targetProjectId:'project_other',workerId:'worker_other',challengeId:'challenge_other',ownerRevision:4,assignmentRevision:8,grantDigest:'e'.repeat(64),issuerActorId:'issuer_other',issuerMembershipId:'membership_other',authorityDigest:'e'.repeat(64)})){
  const changed={...p,[key]:value};assert.notEqual(companyKycProjectionDigest(changed),companyKycProjectionDigest(p));assert.throws(()=>companyKycProjectionContract(changed,{[key]:p[key]}),{code:'META_KYC_COMPANY_PROJECTION_REJECTED'});
 }
});
test('projection never treats a partial participant identity as an invited guest',()=>{
 const p=projection();
 for(const changed of [{participantActorId:'actor_other'},{participantMembershipId:'membership_other'},{participantClerkUserId:'user_Synthetic'},{participantActorId:'actor_other',participantMembershipId:'membership_other',participantClerkUserId:null}])assert.throws(()=>companyKycProjectionContract({...p,...changed}));
 const own={...p,participantActorId:'actor_own',participantMembershipId:'membership_own',participantClerkUserId:'user_Synthetic'};assert.equal(companyKycProjectionContract(own).participantActorId,'actor_own');assert.notEqual(companyKycProjectionDigest(own),companyKycProjectionDigest(p));
});
test('projection rejects field authority and private command material as extra properties',()=>{
 const p=projection();
 for(const extra of [{kind:'FIELD'},{version:2},{operationId:'not-a-projection'},{token:'synthetic'},{senderE164:'+19999999999'},{code:'IDENTIDAD synthetic'},{number:'0'.repeat(22)},{front:'synthetic-image'},{selectedProjectId:'project_b'}])assert.throws(()=>companyKycProjectionContract({...p,...extra}),{code:'META_KYC_COMPANY_PROJECTION_REJECTED'});
});
test('corporate KYC envelopes decrypt only with credential anchor A even when the legajo is B',()=>{
 const p=projection(),context=companyKycSecretContext(p,'kyc-chat-conversation',p.challengeId),plain=JSON.stringify({targetProjectId:p.targetProjectId,workerId:p.workerId,projectionDigest:companyKycProjectionDigest(p)}),cipher=encryptCustomerSecret(plain,context,environment);
 assert.equal(context.projectId,'project_a');assert.equal(decryptCustomerSecret(cipher,context,environment),plain);
 for(const mutation of [{projectId:p.targetProjectId},{organizationId:'org_other'},{resourceId:'challenge_other'},{purpose:'kyc-chat-dispatch'}])assert.throws(()=>decryptCustomerSecret(cipher,{...context,...mutation},environment));
 assert.throws(()=>companyKycSecretContext({...p,anchorProjectId:null},'kyc-chat-conversation',p.challengeId));
});
