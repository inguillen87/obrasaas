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
 // This case tests first issuance against the invitation receipt. Existing
 // pending captures have a separate explicit-closure guard.
 delete f.worker.metadata.participant.kycChatChallenge;
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
 delete f.worker.metadata.participant.kycChatChallenge;
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
test('a committed acceptance with lost ACK is recovered without changing the code, TTL or transition',async()=>{
 const f=await companyKycMemoryFixture(),operationId=randomUUID();f.control.loseJoinCommit=true;
 await assert.rejects(f.join(operationId),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});
 const metadata=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);assert.equal(metadata.participant.status,'ACTIVE');assert.equal(audits.filter(a=>a.action==='participant.kyc_chat.account_bound').length,1);
 const recovered=await f.join(operationId);assert.equal(recovered.replayed,true);assert.deepEqual(f.worker.metadata,metadata);assert.deepEqual([...f.audits.values()],audits);assert.equal((await f.bridge.execute(f.receive(f.code))).kind,'KYC_CHAT');assert.equal(f.controls.sends,0);
});

for(const stage of ['transition-receipt','worker-write'])test('acceptance '+stage+' failure rolls back its JOIN receipt and metadata',async()=>{
 const f=await companyKycMemoryFixture(),before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);let observed=false;
 f.control.hook=async sql=>{if(stage==='transition-receipt'&&sql.includes("'participant.kyc_chat.account_bound'")||stage==='worker-write'&&sql.startsWith('UPDATE public."Worker"')){observed=true;throw new Error('SYNTHETIC_WRITE_DENIED');}};
 await assert.rejects(f.join(),{code:'PARTICIPANT_OPERATION_UNCONFIRMED'});assert.equal(observed,true);assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits.values()],audits);assert.equal(f.controls.sends,0);assert.ok(f.control.rollbacks>0);
});

test('pending acceptance preserves explicit intake permissions and unrelated private metadata',async()=>{
 const f=await companyKycMemoryFixture(),permissions={attendance:false,report:false},applicationId='customer_webhook_'+'d'.repeat(64),personReceiptId='synthetic_person_receipt',receiptId='synthetic_admission_receipt';
 f.worker.metadata.employeeIntakeAdmission={version:1,projectId:f.target.id,workerId:f.worker.id,permissions,receiptId,actorId:f.issuer.actorId,applicationId,personReceiptId};
 f.worker.metadata.privateBankAccount={version:1,opaqueSynthetic:'preserved'};f.worker.metadata.channelSettings={synthetic:'preserved'};
 f.audits.set(receiptId,{id:receiptId,organizationId:f.target.organizationId,actorId:f.issuer.actorId,entityType:'WebhookEvent',entityId:applicationId,action:'participant.operation.recorded',metadata:{kind:'ADMIT_EMPLOYEE_INTAKE',workerId:f.worker.id,projectId:f.target.id,personReceiptId,approvedPermissionsDigest:metaCustomerContentDigest(permissions)}});
 const bank=structuredClone(f.worker.metadata.privateBankAccount),settings=structuredClone(f.worker.metadata.channelSettings);
 await f.join();assert.deepEqual(f.worker.metadata.participant.permissions,permissions);assert.deepEqual(f.worker.metadata.privateBankAccount,bank);assert.deepEqual(f.worker.metadata.channelSettings,settings);
 await f.toConfirmation();await f.choose('Guardar identidad');assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');assert.deepEqual(f.worker.metadata.participant.permissions,permissions);
});
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
test('canonical acceptance before IDENTIDAD binds only the own account and receipt-derived issuer trail without renewing the challenge',async()=>{
 const f=await companyKycMemoryFixture(),before=structuredClone(f.worker.metadata.participant.kycChatChallenge),originalAudits=structuredClone([...f.audits.values()]);
 const accepted=await f.join(),after=f.worker.metadata.participant.kycChatChallenge,restored={...after,participantClerkUserId:before.participantClerkUserId,companyKyc:{...after.companyKyc,issuerAuthorityDigest:before.companyKyc.issuerAuthorityDigest}};
 assert.equal(accepted.saved,true);assert.deepEqual(restored,before);assert.equal(after.participantClerkUserId,f.member.clerkUserId);assert.notEqual(after.companyKyc.issuerAuthorityDigest,before.companyKyc.issuerAuthorityDigest);
 const transitions=[...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.account_bound');assert.equal(transitions.length,1);const t=transitions[0];
 assert.equal(t.actorId,f.member.actorId);assert.equal(t.entityId,f.worker.id);assert.equal(t.metadata.projectId,f.target.id);assert.equal(t.metadata.acceptanceReceiptId,accepted.receiptId);assert.equal(t.metadata.challengeId,before.id);assert.equal(t.metadata.beforeIssuerAuthorityDigest,before.companyKyc.issuerAuthorityDigest);assert.equal(t.metadata.afterIssuerAuthorityDigest,after.companyKyc.issuerAuthorityDigest);assert.notEqual(t.metadata.beforeChallengeDigest,t.metadata.afterChallengeDigest);
 for(const a of originalAudits)assert.deepEqual(f.audits.get(a.id),a);
 assert.equal(f.worker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.equal(t.metadata.identityCertified,false);assert.equal(t.metadata.permissionsGranted,false);assert.equal(f.controls.sends,0);assert.equal(f.blob.puts(),0);
 await f.toConfirmation();const saved=await f.choose('Guardar identidad');assert.equal(saved.result.businessApplied,true);assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_REVIEW');
 const captures=[...f.audits.values()].filter(a=>a.metadata.kind==='KYC_SUBMITTED');assert.equal(captures.length,1);assert.equal(captures[0].actorId,f.member.actorId);assert.equal(captures[0].metadata.channelCapture.capturedParticipantClerkUserId,f.member.clerkUserId);assert.equal(captures[0].metadata.channelCapture.accountClaimRequired,false);assert.equal(captures[0].metadata.channelCapture.invitationId,null);
 assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.account_bound').length,1);
});

test('acceptance replay with the same or another UUID retains the first transition and original expiry',async()=>{
 const f=await companyKycMemoryFixture(),op=randomUUID(),first=await f.join(op),after=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);
 for(const operationId of [op,randomUUID()]){const value=await f.join(operationId);assert.equal(value.replayed,true);assert.equal(value.receiptId,first.receiptId);assert.deepEqual(f.worker.metadata,after);assert.deepEqual([...f.audits.values()],audits);}
 assert.equal(f.controls.sends,0);assert.equal(f.blob.puts(),0);
});

for(const order of ['issuer-first','own-first'])test('pending acceptance retains principals and journey locks before ordered A/B projects: '+order,async()=>{
 const f=await companyKycMemoryFixture();if(order==='own-first')f.member.actorId='actor-before-issuer';
 const start=f.control.sql.length;await f.join();const sql=f.control.sql.slice(start),firstProject=sql.findIndex(q=>q.includes('FROM public."Project"')&&q.includes('FOR UPDATE')),worker=sql.findIndex(q=>q.includes('FROM public."Worker"')&&q.includes('FOR UPDATE'));
 const firstIssuer=sql.findIndex(q=>q.includes('FROM public."PlatformUser"')&&q.includes('WHERE id=$1 FOR SHARE')),own=sql.findIndex(q=>q.includes('FROM public."PlatformUser"')&&q.includes('WHERE id=$1 FOR UPDATE'));
 assert.ok(firstProject>firstIssuer&&firstProject>own);assert.ok(worker>firstProject);assert.ok(sql.slice(0,firstProject).some(q=>q.startsWith('SELECT pg_advisory')));
 assert.equal(order==='issuer-first'?firstIssuer<own:own<firstIssuer,true);
});

for(const [label,mutate,code] of [
 ['issuer revocation',f=>{f.controls.issuerActive=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['issuer demotion',f=>{f.issuer.role='SITE_MANAGER';},'META_KYC_CHALLENGE_REVOKED'],
 ['issuer revoke/restore audit with equal timestamps',f=>{f.control.trail.push('canonical_revoke_restore');},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['owner suspension',f=>{f.owner.mode='SUSPENDED';},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['assignment version',f=>{f.owner.assignmentRevision++;},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['assignment revoked',f=>{f.control.assignment=false;},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['grant changed',f=>{f.connection.metadata.customerVerification.scopes=[];},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['pilot substituted',f=>{f.connection.metadata.developmentPilot={};},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['own membership disabled',f=>{f.controls.workerMembershipActive=false;},'PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED'],
 ['own PM disabled',f=>{f.controls.projectAssignmentActive=false;},'PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED'],
 ['own role changed',f=>{f.member.role='DIRECTOR';},'PARTICIPANT_MEMBERSHIP_REVIEW_REQUIRED'],
 ['invitation receipt missing',f=>{f.audits.delete('invite_receipt');},'META_KYC_CHALLENGE_REVOKED'],
 ['prepared receipt missing',f=>{for(const [id,a] of f.audits)if(a.action==='participant.kyc_chat.prepared')f.audits.delete(id);},'META_KYC_CHALLENGE_REVOKED'],
 ['prepared outer receipt missing',f=>{for(const [id,a] of f.audits)if(a.metadata.kind==='PREPARE_KYC_CHAT')f.audits.delete(id);},'META_KYC_CHALLENGE_REVOKED'],
 ['foreign original target',f=>{f.worker.metadata.participant.kycChatChallenge.projectId=f.anchor.id;},'META_KYC_CHALLENGE_REVOKED'],
 ['wrong current phone',f=>{f.worker.phone='+19999999999';},'META_KYC_CHALLENGE_REVOKED'],
 ['pre-existing conversation',f=>{f.worker.metadata.participant.kycChatConversation={version:1};},'META_KYC_CHALLENGE_REVOKED']
])test('pending acceptance '+label+' cannot refresh authority and rolls back before IO',async()=>{
 const f=await companyKycMemoryFixture();mutate(f);const metadata=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);
 await assert.rejects(f.join(),{code});assert.deepEqual(f.worker.metadata,metadata);assert.deepEqual([...f.audits.values()],audits);assert.equal(f.controls.sends,0);assert.equal(f.control.graph,0);assert.equal(f.blob.puts(),0);
});

for(const type of ['projection','dispatch','capture'])test('PENDING metadata cannot hide an existing '+type+' receipt',async()=>{
 const f=await companyKycMemoryFixture(),c=f.worker.metadata.participant.kycChatChallenge;
 f.audits.set('existing_source',{id:'existing_source',organizationId:f.target.organizationId,entityId:f.worker.id,entityType:'Worker',actorId:f.issuer.actorId,action:type==='projection'?'participant.kyc_chat.projected':type==='dispatch'?'participant.kyc_chat.dispatched':'participant.operation.recorded',metadata:{challengeId:c.id,kind:type==='capture'?'KYC_SUBMITTED':null,channelCapture:{challengeId:c.id}}});
 const before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);
 await assert.rejects(f.join(),{code:'META_KYC_COMPANY_AUTHORITY_CHANGED'});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits.values()],audits);assert.equal(f.controls.sends,0);
});

for(const cause of ['grant','challenge','invitation','invalid-clock'])test('pending acceptance final '+cause+' clock after writes rolls back both receipts and account linkage',async()=>{
 const f=await companyKycMemoryFixture({grantLifetimeMs:cause==='grant'?90000:null}),before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);let final=false;
 f.control.hook=async sql=>{if(sql==='SELECT clock_timestamp() AS now'&&[...f.audits.values()].some(a=>a.action==='participant.kyc_chat.account_bound')){final=true;if(cause==='invalid-clock')f.now.setTime(NaN);else if(cause==='grant')f.now.setTime(f.now.getTime()+120000);else if(cause==='invitation'){f.now.setTime(Date.parse(before.participant.invitation.expiresAt)+1);}else f.now.setTime(Date.parse(before.participant.kycChatChallenge.expiresAt)+1);}};
 await assert.rejects(f.join(),error=>['META_KYC_CHALLENGE_REVOKED','META_KYC_CHALLENGE_EXPIRED'].includes(error.code));assert.equal(final,true);assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits.values()],audits);assert.ok(f.control.rollbacks>0);assert.equal(f.controls.sends,0);assert.equal(f.blob.puts(),0);
});

test('a second trail mutation after the JOIN receipt cannot be treated as canonical acceptance',async()=>{
 const f=await companyKycMemoryFixture(),before=structuredClone(f.worker.metadata),audits=structuredClone([...f.audits.values()]);
 f.control.hook=async(sql,args)=>{if(sql.startsWith('INSERT INTO public."AuditLog"')&&args.length===6&&JSON.parse(args[5]).kind==='INVITATION_ACCEPTED')f.control.trail.push('unrelated_canonical_change');};
 await assert.rejects(f.join(),{code:'META_KYC_COMPANY_AUTHORITY_CHANGED'});assert.deepEqual(f.worker.metadata,before);assert.deepEqual([...f.audits.values()],audits);assert.equal(f.controls.sends,0);
});

test('partial CLAIMED acceptance does not rewrite or silently cancel its original capture authority',async()=>{
 const f=await companyKycMemoryFixture();await f.execute(f.code);const challenge=structuredClone(f.worker.metadata.participant.kycChatChallenge),conversation=structuredClone(f.worker.metadata.participant.kycChatConversation),projections=structuredClone([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected'));
 assert.equal(challenge.status,'CLAIMED');assert.equal((await f.join()).saved,true);assert.deepEqual(f.worker.metadata.participant.kycChatChallenge,challenge);assert.deepEqual(f.worker.metadata.participant.kycChatConversation,conversation);assert.deepEqual([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.projected'),projections);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.account_bound').length,0);
 await assert.rejects(f.bridge.execute(f.receive(f.code)),{code:'META_KYC_CHALLENGE_REVOKED'});
});

test('completed capture before acceptance still adopts the exact original receipt and preserves its issuer actor',async()=>{
 const f=await companyKycMemoryFixture();await f.toConfirmation();await f.choose('Guardar identidad');const submitted=[...f.audits.values()].find(a=>a.metadata.kind==='KYC_SUBMITTED'),before=structuredClone(submitted),capture=structuredClone(f.worker.metadata.participant.kyc.channelCapture);
 const accepted=await f.join(),p=f.worker.metadata.participant;assert.equal(p.kyc.status,'PENDING_REVIEW');assert.equal(p.kyc.channelCapture.receiptId,capture.receiptId);assert.equal(p.kyc.channelCapture.acceptanceReceiptId,accepted.receiptId);assert.equal(p.kyc.channelCapture.claimedActorId,f.member.actorId);assert.deepEqual(f.audits.get(submitted.id),before);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.account_bound').length,0);
});

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
