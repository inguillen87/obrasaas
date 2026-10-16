import assert from 'node:assert/strict';
import {createHash,createHmac,randomUUID} from 'node:crypto';
import {createMetaCustomerCallbackHandlers,createMetaCustomerInbox,splitMetaCustomerEvents} from '../../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProductionProcessor,decodeSignedCustomerEvent} from '../../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {createMetaKycBridge} from '../../src/lib/meta-kyc-bridge.mjs';
import {createMetaKycOutbound} from '../../src/lib/meta-kyc-outbound.mjs';
import {createMetaKycContextFeedback} from '../../src/lib/meta-kyc-context-feedback.mjs';
import {createMetaKycRejection} from '../../src/lib/meta-kyc-rejection.mjs';
import {createMetaKycExpiryFeedback} from '../../src/lib/meta-kyc-expiry-feedback.mjs';
import {currentImageReceiptId} from '../../src/lib/meta-kyc-current-image.mjs';
import {META_KYC_AUTHORIZATION_CODES} from '../../src/lib/meta-kyc-identity.mjs';
import {META_OWN_COMPANY_AUTHORIZATION_CODES} from '../../src/lib/meta-own-company-policy.mjs';
import {createParticipantStore} from '../../src/lib/participant-store.mjs';
import {prepareMetaKycChallenge} from '../../src/lib/meta-kyc-challenge.mjs';
import {customerOutboundId} from '../../src/lib/meta-customer-outbound.mjs';
import {decryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {ownCompanyFixture} from '../../tests/fixtures/own-company-meta.mjs';
import {usageDigest} from '../../src/lib/organization-usage-policy.mjs';
import {currentImageSyntheticPng} from './kyc-current-image-native.mjs';

export const CURRENT_IMAGE_OWN_NATIVE_CHECK='native-OWN-CURRENT-real-v2-grant-production-factory-fresh-compact-snapshot-after-Graph-source-receipt-tamper-zero-POST-and-no-replay';
const sha=b=>createHash('sha256').update(b).digest('hex'),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Runs in the already owned disposable child DB of the compact producer.
// Activation, grant, source receipt, issuer and assignment are reused from its
// canonical CONNECT/ACTIVATE flow. No flag can turn an ordinary channel OWN.
export async function verifyKycCurrentImageOwnNative({pool,fixture,workspace,owner,scope,channel}){
 const providerFixture=ownCompanyFixture({time:fixture.time});providerFixture.debug.expires_at=fixture.debug.expires_at;
 assert.deepEqual(providerFixture.policy,fixture.policy);assert.deepEqual(providerFixture.environment,fixture.environment);
 const environment=fixture.environment,grant=channel.metadata.ownCompanyRuntime;
 assert.equal(grant.version,2);assert.equal(grant.state,'ACTIVE');assert.equal(grant.connectionId,channel.id);
 const originalGrantReceipt=(await pool.query(`SELECT * FROM "AuditLog" WHERE id=$1`,[grant.origin.receiptId])).rows[0];assert.equal(originalGrantReceipt.metadata.action,'ACTIVATE_OWN_NUMBER');assert.deepEqual(originalGrantReceipt.metadata.runtimeGrant,grant);
 const originalChannel=(await pool.query(`SELECT * FROM "WhatsAppConnection" WHERE id=$1`,[channel.id])).rows[0],originalOwner=(await pool.query(`SELECT * FROM "TenantMembership" WHERE id='owner-m'`)).rows[0];
 const cases=[],workerIds=[],eventIds=[],responses=new Map(),traces=[],posts=[],mutations=[];let sequence=0,transaction=0,currentMutation=null,lastSnapshot=null,privateIo=0;
 const forbidden=async()=>{privateIo++;throw Error('OWN_CURRENT_PRIVATE_OR_OTHER_LANE_FORBIDDEN');};
 const connect=async()=>{
  const client=await pool.connect(),tx=++transaction;let open=false;
  return {release:broken=>{if(lastSnapshot?.client===client)lastSnapshot=null;client.release(broken);},query:async(sql,args=[])=>{
   const result=await client.query(sql,args);if(sql==='BEGIN')open=true;if(sql==='COMMIT'||sql==='ROLLBACK')open=false;
   const record={transaction:tx,sql,open};traces.push(record);
   if(sql.includes('AS "kycNow"')&&sql.includes('AS "kycCurrentImageSources"')){
    const row=result.rows[0];assert.ok(open);assert.match(row?.kycTransactionId||'',/^\d+$/);assert.ok(row.kycNow instanceof Date);assert.ok(Array.isArray(row.kycCurrentImageSources));
    assert.match(sql,/FOR UPDATE OF e,w FOR SHARE OF o,ap,tp,c,cc,assignment,im,iu,mm,mu/);
    lastSnapshot={client,transaction:tx,transactionId:row.kycTransactionId,eventId:row.id,traceIndex:traces.length-1,sourceIds:row.kycCurrentImageSources.map(s=>s.id),clock:row.kycNow};record.currentSnapshot={eventId:row.id,transactionId:row.kycTransactionId,sourceCount:row.kycCurrentImageSources.length};
   }
   return result;
  }};
 };
 const fetchImpl=async(url,options={})=>{
  const parsed=new URL(url);assert.equal(parsed.hostname,'graph.facebook.com','No media/CDN or live host is available in this add-on');
  const edge=parsed.pathname.slice('/v25.0/'.length),method=options.method||'GET';
  if(method==='POST'){
   assert.equal(edge,fixture.policy.phoneNumberId+'/messages');const wire=JSON.parse(options.body);
   if(currentMutation?.eventId&&wire.biz_opaque_callback_data===customerOutboundId(currentMutation.eventId))throw Error('OWN_CURRENT_TAMPER_MUST_DENY_BEFORE_POST');
   const source=eventIds.find(id=>customerOutboundId(id)===wire.biz_opaque_callback_data);assert.ok(source);
   if(lastSnapshot?.eventId===source){const actual=(await lastSnapshot.client.query('SELECT pg_current_xact_id()::text AS id')).rows[0].id;assert.equal(actual,lastSnapshot.transactionId);posts.push({eventId:source,transaction:lastSnapshot.transaction,transactionId:actual,sourceCount:lastSnapshot.sourceIds.length,lastCurrentFenceTrace:lastSnapshot.traceIndex,postTrace:traces.length});}
  }
  const response=await providerFixture.fetchImpl(url,options);
  // The mutation is intentionally in the SAME real send transaction after an
  // awaited Graph response. An external writer would block behind its locks;
  // this probe does not pretend such a blocked writer committed before POST.
  if(method==='GET'&&currentMutation&&!currentMutation.fired&&lastSnapshot?.eventId===currentMutation.eventId){
   await Promise.resolve();const cap=lastSnapshot,actual=(await cap.client.query('SELECT pg_current_xact_id()::text AS id')).rows[0].id;assert.equal(actual,cap.transactionId);currentMutation.fired=true;
   if(currentMutation.kind==='RECEIPT')await cap.client.query(`UPDATE "AuditLog" SET metadata=jsonb_set(metadata,'{proofDigest}',$2::jsonb) WHERE id=$1`,[currentImageReceiptId(currentMutation.eventId),JSON.stringify('0'.repeat(64))]);
   else await cap.client.query(`UPDATE "WebhookEvent" SET outcome=jsonb_set(outcome,'{providerStatus}','"failed"'::jsonb) WHERE id=$1`,[currentMutation.promptId]);
   mutations.push({kind:currentMutation.kind,transaction:cap.transaction,transactionId:actual,afterGraphEdge:edge,afterSnapshotTrace:cap.traceIndex,beforeNextFenceTrace:traces.length,eventId:currentMutation.eventId});
  }
  if(method==='POST'&&edge===fixture.policy.phoneNumberId+'/messages'){
   const wire=JSON.parse(options.body),id='wamid.OwnCurrentImageReply_'+(++sequence);responses.set(wire.biz_opaque_callback_data,{id,wire});return Response.json({messages:[{id}]});
  }
  return response;
 };
 const provider=createMetaCustomerProvider({environment,fetchImpl,now:()=>Date.now()}),capture=createMetaKycBridge({connect,provider,environment,deposit:{deposit:forbidden,recover:forbidden}}),outbound=createMetaKycOutbound({connect,provider,environment}),unused={execute:forbidden,send:forbidden,observeStatus:forbidden};
 const processor=createMetaCustomerProductionProcessor({connect,environment,kycBridge:capture,kycOutbound:outbound,fieldBridge:unused,fieldOutbound:unused,companyBridge:unused,companyOutbound:unused,appProjection:unused,isCompany:forbidden,deferAuthorization:async()=>false,rejectedKyc:createMetaKycRejection({connect,provider,environment}),expiredKyc:createMetaKycExpiryFeedback({connect,provider,environment}),contextKyc:createMetaKycContextFeedback({connect,provider,environment}),authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,...META_OWN_COMPANY_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED','META_KYC_EXPIRY_FEEDBACK_DENIED']});
 const callback=createMetaCustomerCallbackHandlers({inbox:createMetaCustomerInbox({connect,environment}),environment,schedule:()=>{}}),participants=createParticipantStore({workspace,connect,prepareKycChat:prepareMetaKycChallenge,environment});
 const worker=async id=>(await pool.query(`SELECT *,to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Worker" WHERE id=$1`,[id])).rows[0];
 const state=async f=>{const w=await worker(f.workerId),c=w.metadata.participant.kycChatChallenge;return w.metadata.participant.kycChatConversation?JSON.parse(decryptCustomerSecret(w.metadata.participant.kycChatConversation.encryptedState,{organizationId:'org-a',projectId:'project-a',purpose:'kyc-chat-conversation',resourceId:c.id},environment)):null;};
 const marker=async eventId=>(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[customerOutboundId(eventId)])).rows[0];
 const receipt=async eventId=>(await pool.query(`SELECT * FROM "AuditLog" WHERE id=$1`,[currentImageReceiptId(eventId)])).rows[0];
 const messagePosts=()=>providerFixture.calls.filter(c=>c.method==='POST'&&c.path===fixture.policy.phoneNumberId+'/messages').length;
 async function waitNext(f){const s=await state(f),out=await marker(s.lastEventId),completed=Date.parse(out.outcome.completedAt);assert.ok(Number.isFinite(completed));const minimum=Math.max(Math.floor(completed/1000),s.lastMessageTimestamp)+1,until=Date.now()+5000;while(Math.floor(Date.now()/1000)<minimum){assert.ok(Date.now()<until);await sleep(15);}return {s,out};}
 async function receive(f,message,{quote=false}={}){
  const s=await state(f),out=s?await marker(s.lastEventId):null,value={id:'wamid.OwnCurrentImageSource_'+randomUUID().replaceAll('-',''),from:f.sender,timestamp:String(Math.floor(Date.now()/1000)),...(typeof message==='string'?{type:'text',text:{body:message}}:message),...(quote?{context:{id:out.outcome.messageId}}:{})};
  const payload={object:'whatsapp_business_account',entry:[{id:fixture.policy.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:fixture.policy.phoneNumberId},messages:[value]}}]}]},wire=JSON.stringify(payload),response=await callback.POST(new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(wire).digest('hex')},body:wire}));assert.equal(response.status,200);assert.equal((await response.json()).durable,true);
  const id='customer_webhook_'+splitMetaCustomerEvents(payload)[0].externalId;eventIds.push(id);const raw=(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[id])).rows[0],decoded=decodeSignedCustomerEvent(raw,channel,environment);assert.equal(Object.hasOwn(decoded.value,'context'),quote);assert.deepEqual(decoded.value,value);return id;
 }
 async function seed(index){
  const f={workerId:'own-current-image-worker-'+index,sender:'54911997000'+index,projectId:'project-kyc-target'};workerIds.push(f.workerId);
  const assigned=(await pool.query(`SELECT id FROM "ProjectMembership" WHERE "projectId"=$1 AND "tenantMembershipId"='member' AND status='ACTIVE'`,[f.projectId])).rows;assert.equal(assigned.length,1);
  await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,role,active,metadata) VALUES($1,$2,'Synthetic OWN current image person',$3,'WORKER',true,$4::jsonb)`,[f.workerId,f.projectId,'+'+f.sender,JSON.stringify({siteRegister:{version:1},participant:{version:1,status:'ACTIVE',clerkUserId:'user_Person',permissions:{attendance:false,report:false},kyc:{version:1,status:'NOT_SUBMITTED'}}})]);
  const prepared=await participants.save(owner,{scope,projectId:f.projectId,action:'PREPARE_KYC_CHAT',operationId:randomUUID(),payload:{workerId:f.workerId,revision:(await worker(f.workerId)).revision}});assert.equal(prepared.captureImageSetVersion,2);
  const claim=await receive(f,prepared.code);assert.equal((await processor.process(claim)).replySent,true);
  for(const title of ['Autorizar imágenes','Autorizar dorso','Sin lectura asistida','Sin comparación facial']){const {s}=await waitNext(f),wire=responses.get(customerOutboundId(s.lastEventId)).wire,choice=wire.interactive.action.sections.flatMap(x=>x.rows).find(x=>x.title===title);assert.ok(choice);const id=await receive(f,{type:'interactive',interactive:{type:'list_reply',list_reply:choice}},{quote:true});assert.equal((await processor.process(id)).replySent,true);}
  assert.equal((await state(f)).step,'FRONT');return f;
 }
 async function image(f,index){const before=await waitNext(f),bytes=currentImageSyntheticPng(100+index),id=await receive(f,{type:'image',image:{id:'1977000'+index,mime_type:'image/png',sha256:sha(bytes)}});return {id,before};}
 try{
  for(const [index,kind]of [[1,'CURRENT'],[2,'DELIVERY_STATUS'],[3,'RECEIPT'],[4,'PROMPT_SOURCE']]){
   const f=await seed(index);let prompt=(await waitNext(f)).out,durable=prompt.outcome.completedAt;
   if(kind==='DELIVERY_STATUS'){await pool.query(`UPDATE "WebhookEvent" SET "processedAt"=clock_timestamp()+interval '1 minute',outcome=outcome||'{"state":"STATUS_OBSERVED","providerStatus":"read"}'::jsonb WHERE id=$1`,[prompt.id]);prompt=await marker((await state(f)).lastEventId);assert.equal(prompt.outcome.completedAt,durable);}
   const input=await image(f,index),beforePosts=messagePosts(),beforeCalls=providerFixture.calls.length,traceStart=traces.length;
   if(['RECEIPT','PROMPT_SOURCE'].includes(kind))currentMutation={kind,eventId:input.id,promptId:prompt.id,fired:false};
   const result=await processor.process(input.id),currentReceipt=await receipt(input.id),currentWorker=await worker(f.workerId),out=await marker(input.id),actualTrace=traces.slice(traceStart),snapshots=actualTrace.filter(q=>q.currentSnapshot?.eventId===input.id);
   assert.ok(currentReceipt);assert.equal(currentReceipt.metadata.mode,'CURRENT');assert.equal(currentReceipt.actorId,'person');assert.equal(currentReceipt.entityId,f.workerId);assert.equal(currentReceipt.metadata.stage,'FRONT');assert.equal(currentReceipt.metadata.nextStage,'BACK');assert.equal(currentReceipt.metadata.projectId,f.projectId);assert.equal(currentReceipt.metadata.anchorProjectId,'project-a');
   const proof=JSON.parse(decryptCustomerSecret(currentReceipt.metadata.encryptedProof,{organizationId:'org-a',projectId:'project-a',purpose:'kyc-current-image-v1',resourceId:currentReceipt.id},environment));assert.equal(usageDigest(proof),currentReceipt.metadata.proofDigest);assert.equal(proof.anchor.acceptedAt,durable);assert.equal(proof.binding.issuerActorId,'owner');assert.equal(proof.binding.memberActorId,'person');assert.equal(proof.binding.projectId,f.projectId);assert.equal(proof.binding.anchorProjectId,'project-a');assert.equal(proof.beforeState.consent,true);assert.equal(proof.beforeState.backConsent,true);assert.equal(proof.beforeState.ocrConsent,false);assert.equal(proof.beforeState.biometricConsent,false);
   assert.ok(snapshots.length>=2);assert.equal(new Set(snapshots.map(q=>q.currentSnapshot.transactionId)).size,1);assert.equal((await state(f)).step,'BACK');assert.equal(currentWorker.metadata.participant.kyc.status,'NOT_SUBMITTED');assert.deepEqual(currentWorker.metadata.participant.permissions,{attendance:false,report:false});
   if(currentMutation){
    assert.equal(currentMutation.fired,true);assert.equal(result.replySent,false);assert.equal(result.replyState,'META_KYC_COMPANY_AUTHORITY_CHANGED');assert.equal(messagePosts(),beforePosts);assert.equal(out.outcome.state,'SEND_STARTED');assert.ok(providerFixture.calls.length>beforeCalls);assert.deepEqual(await marker(proof.anchor.sourceEventId),prompt);assert.equal(currentReceipt.metadata.proofDigest,usageDigest(proof));
    const mutation=mutations.at(-1),afterMutation=traces.slice(mutation.beforeNextFenceTrace).find(q=>q.currentSnapshot?.eventId===input.id);assert.ok(afterMutation);assert.equal(afterMutation.currentSnapshot.transactionId,mutation.transactionId);assert.equal(snapshots.at(-1).open,true);assert.ok(actualTrace.some(q=>q.sql==='ROLLBACK'));const saved=structuredClone(out),replayCalls=providerFixture.calls.length;assert.equal((await processor.process(input.id)).done,true);assert.deepEqual(await marker(input.id),saved);assert.equal(messagePosts(),beforePosts);assert.equal(providerFixture.calls.length,replayCalls);
    cases.push({name:kind==='RECEIPT'?'OWN-CURRENT-receipt-mutated-in-locked-TX-after-Graph-await-denied-before-POST':'OWN-CURRENT-original-prompt-failed-in-locked-TX-after-Graph-await-denied-before-POST',mutation,compactReads:snapshots.length,transactionId:mutation.transactionId,realRollback:true,receiptAndPromptRestored:true,posts:0,replayTransfers:0,state:'SEND_STARTED'});currentMutation=null;
   }else{
    assert.equal(result.replySent,true);assert.equal(result.replyState,'SENT');assert.equal(messagePosts(),beforePosts+1);assert.equal(out.outcome.state,'SENT');const post=posts.find(x=>x.eventId===input.id);assert.ok(post);assert.equal(post.transactionId,snapshots.at(-1).currentSnapshot.transactionId);assert.ok(post.lastCurrentFenceTrace>=traceStart);assert.ok(post.sourceCount>=3);const saved=structuredClone(out),replayCalls=providerFixture.calls.length;assert.equal((await processor.process(input.id)).done,true);assert.deepEqual(await marker(input.id),saved);assert.equal(providerFixture.calls.length,replayCalls);
    cases.push({name:kind==='DELIVERY_STATUS'?'OWN-CURRENT-delivery-read-keeps-durable-completion-and-current-compact-authority':'OWN-CURRENT-HMAC-callback-production-priority-real-v2-grant-JSONB-receipt-fresh-compact-send',compactReads:snapshots.length,transactionId:post.transactionId,actualPostSameLockedTransaction:true,posts:1,replayTransfers:0,currentReceiptMode:'CURRENT',grantMintedBy:'ACTIVATE_OWN_NUMBER',anchorDistinctFromTarget:true,identityCertified:false,permissionsGranted:false});
   }
  }
  assert.equal(cases.length,4);assert.equal(privateIo,0);assert.deepEqual((await pool.query(`SELECT * FROM "AuditLog" WHERE id=$1`,[grant.origin.receiptId])).rows[0],originalGrantReceipt);assert.deepEqual((await pool.query(`SELECT * FROM "WhatsAppConnection" WHERE id=$1`,[channel.id])).rows[0],originalChannel);assert.deepEqual((await pool.query(`SELECT * FROM "TenantMembership" WHERE id='owner-m'`)).rows[0],originalOwner);
  return {version:1,status:'PASS',kind:'OWN_COMPANY_RUNTIME_CURRENT_IMAGE',checks:[CURRENT_IMAGE_OWN_NATIVE_CHECK],cases,postgresExecuted:true,compositionFactory:'createMetaCustomerProductionProcessor',originalV2ActivationReceipt:grant.origin.receiptId,originalGrantAndIssuerUnchanged:true,providerFixture:'ownCompanyFixture with identical policy/time/assets, independent call log',syntheticMessagePostCount:messagePosts(),downloads:0,privatePuts:0,realProviderCalls:0,identityCertified:false,permissionsGranted:false,humanAccepted:false};
 }finally{
  currentMutation=null;lastSnapshot=null;
  // Delete only this add-on's exact recorded synthetic IDs in the parent's
  // disposable DB. Historical fixtures, grants, prompts and counters remain.
  await pool.query(`DELETE FROM "WebhookEvent" WHERE id=ANY($1::text[])`,[eventIds.flatMap(id=>[id,customerOutboundId(id)])]);await pool.query(`DELETE FROM "AuditLog" WHERE "entityId"=ANY($1::text[])`,[[...workerIds,...eventIds]]);await pool.query(`DELETE FROM "Worker" WHERE id=ANY($1::text[])`,[workerIds]);assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "Worker" WHERE id=ANY($1::text[])`,[workerIds])).rows[0].n,0);
 }
}
