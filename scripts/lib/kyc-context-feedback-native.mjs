import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createMetaKycContextFeedback,metaKycContextReceiptId,META_KYC_CONTEXT_REPLY} from '../../src/lib/meta-kyc-context-feedback.mjs';
import {createMetaCustomerProcessor} from '../../src/lib/meta-customer-processing.mjs';
import {customerOutboundId} from '../../src/lib/meta-customer-outbound.mjs';
import {META_KYC_AUTHORIZATION_CODES} from '../../src/lib/meta-kyc-identity.mjs';

// Called only by the two existing localhost disposable PostgreSQL producers.
// This helper owns no server, schema, database, provider or real identity.
export async function verifyKycContextFeedbackNative({query,connect,provider,environment,fixture,receive,readWorker,stats,kind,checks}){
 const cases=[],adapter=createMetaKycContextFeedback({connect,provider,environment});
 const count=async context=>(await query(`SELECT (SELECT count(*)::int FROM "AuditLog" WHERE id=$1 AND action='participant.kyc_chat.context_feedback') AS receipts,(SELECT count(*)::int FROM "WebhookEvent" WHERE id=$2 AND provider='meta-customer-outbound-v1') AS outbounds`,[metaKycContextReceiptId(context.eventId),customerOutboundId(context.eventId)])).rows[0];
 async function contextFor(t,eventId){const leaseToken=randomUUID();await query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,"leaseExpiresAt"=clock_timestamp()+interval '1 minute' WHERE id=$1 AND status='PENDING'`,[eventId,leaseToken]);const e=(await query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[eventId])).rows[0];return {eventId,projectId:t.anchorProjectId||t.projectId,channelId:t.channelId,payloadDigest:e.payload.payloadDigest,leaseToken};}
 {
  const f=await fixture(10,{advance:true}),baseline=stats(),before=f.before;
  // The original expired consent source is now older than the BACK_CONSENT
  // source. Only a text reply may recover this event; no consent is selected.
  const receipts=await Promise.all([adapter.feedback(f.context,{staleOnly:true}),adapter.feedback(f.context,{staleOnly:true})]);assert.deepEqual(receipts[0],receipts[1]);assert.deepEqual(receipts[0].reply,META_KYC_CONTEXT_REPLY);assert.deepEqual(await count(f.context),{receipts:1,outbounds:0});
  const sent=await Promise.all(receipts.map(r=>adapter.send(f.context,r.reply)));assert.equal(sent.filter(r=>r.replayed).length,1);assert.deepEqual(await count(f.context),{receipts:1,outbounds:1});assert.deepEqual(stats(),{...baseline,sends:baseline.sends+1});assert.deepEqual(await readWorker(f.t),before);assert.deepEqual(await adapter.feedback(f.context,{recoverOnly:true}),receipts[0]);assert.equal((await adapter.send(f.context,receipts[0].reply)).replayed,true);assert.equal(stats().sends,baseline.sends+1);
  cases.push({name:'native-prior-prompt-concurrent-receipt-one-HTTP-private-state-unchanged',receiptCount:1,outboxCount:1,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0});checks.push(kind+'-context-native-old-signed-source-concurrent-single-outbox-HTTP-no-capture-writes');
 }
 {
  const f=await fixture(11),baseline=stats(),eventId=await receive(f.t,'ESTADO IDENTIDAD',f.prompt.outcome.messageId),context=await contextFor(f.t,eventId),receipt=await adapter.feedback(context,{code:'META_KYC_CHALLENGE_EXPIRED'});
  assert.deepEqual(receipt.reply,META_KYC_CONTEXT_REPLY);await adapter.send(context,receipt.reply);assert.deepEqual(await readWorker(f.t),f.before);assert.deepEqual(stats(),{...baseline,sends:baseline.sends+1});assert.deepEqual(await count(context),{receipts:1,outbounds:1});
  cases.push({name:'native-neutral-status-exact-expired-source-without-consent-choice',receiptCount:1,outboxCount:1,httpTransfers:1,consentChosen:false,workerBytesUnchanged:true,mediaDelta:0});checks.push(kind+'-context-native-neutral-ESTADO-IDENTIDAD-no-consent-or-private-media');
 }
 {
  const f=await fixture(12,{advance:true}),baseline=stats(),receipt=await adapter.feedback(f.context,{staleOnly:true}),denied=createMetaKycContextFeedback({connect,provider,environment,afterReserve:()=>query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id=$1`,['owner-member-'+f.t.key])});
  try{await assert.rejects(denied.send(f.context,receipt.reply));const observed=await denied.feedback(f.context,{recoverOnly:true});assert.equal(observed.reply,undefined);assert.equal(observed.replyState,'SEND_STARTED');assert.deepEqual(stats(),baseline);assert.deepEqual(await readWorker(f.t),f.before);assert.deepEqual(await count(f.context),{receipts:1,outbounds:1});}
  finally{await query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id=$1`,['owner-member-'+f.t.key]);}
  cases.push({name:'native-current-issuer-revoked-after-reservation-no-HTTP',receiptCount:1,outboxCount:1,httpTransfers:0,workerBytesUnchanged:true,mediaDelta:0});checks.push(kind+'-context-native-current-issuer-revocation-no-HTTP-no-media');
 }
 {
  const f=await fixture(13,{advance:true}),baseline=stats();await query(`UPDATE "WebhookEvent" SET "leaseToken"=NULL,"leaseExpiresAt"=NULL WHERE id=$1`,[f.context.eventId]);let dispatches=0;
  const processor=createMetaCustomerProcessor({connect,environment,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED'],contextKyc:adapter.feedback,dispatch:async()=>{dispatches++;throw Error('NATIVE_STALE_CONTEXT_MUST_NOT_ENTER_CAPTURE');},outbound:{send:(context,reply,{purpose})=>{assert.equal(purpose,'KYC_CONTEXT_FEEDBACK');return adapter.send(context,reply);}}});
  const result=await processor.process(f.context.eventId);assert.equal(result.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(result.replySent,true);assert.equal(dispatches,0);assert.deepEqual(await readWorker(f.t),f.before);assert.deepEqual(stats(),{...baseline,sends:baseline.sends+1});assert.equal((await processor.process(f.context.eventId)).done,true);
  cases.push({name:'native-processor-intercepts-before-capture-without-replay-dispatch',captureDispatches:0,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0});checks.push(kind+'-context-native-processor-pre-dispatch-no-capture-or-replay');
 }
 {
  const f=await fixture(14,{advance:true}),baseline=stats();await query(`UPDATE "WebhookEvent" SET "leaseToken"=NULL,"leaseExpiresAt"=NULL WHERE id=$1`,[f.context.eventId]);
  const statements=[],started=Date.now();let prePostMs=null,leaseDeadline=null;
  const delayedConnect=async()=>{const client=await connect();return {release:broken=>client.release(broken),query:async(sql,args=[])=>{await new Promise(resolve=>setTimeout(resolve,225));statements.push(sql);if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"=$2'))leaseDeadline=args[2];return client.query(sql,args);}};};
  const delayedProvider={...provider,sendReply:async input=>{await new Promise(resolve=>setTimeout(resolve,200));return provider.sendReply({...input,finalBeforeExternal:async()=>{await input.finalBeforeExternal();prePostMs=Date.now()-started;}});}};
  const delayedAdapter=createMetaKycContextFeedback({connect:delayedConnect,provider:delayedProvider,environment}),processor=createMetaCustomerProcessor({connect:delayedConnect,environment,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED'],contextKyc:delayedAdapter.feedback,dispatch:async()=>{throw Error('NATIVE_DELAYED_STALE_CONTEXT_MUST_NOT_CAPTURE');},outbound:{send:(context,reply)=>delayedAdapter.send(context,reply)}});
  const result=await processor.process(f.context.eventId),elapsedMs=Date.now()-started;assert.equal(result.replyState,'SENT');assert.ok(prePostMs!==null&&prePostMs<60000);assert.ok(elapsedMs<60000);assert.ok(leaseDeadline instanceof Date);assert.deepEqual(await readWorker(f.t),f.before);assert.deepEqual(stats(),{...baseline,sends:baseline.sends+1});
  cases.push({name:'native-original-60s-lease-controlled-225ms-SQL-200ms-Graph',sqlStatements:statements.length,compactFences:statements.filter(sql=>sql.includes('AS "contextTransactionId"')).length,fullResolutions:statements.filter(sql=>sql.startsWith('SELECT id,"projectId",provider,"eventType","externalId"')).length,elapsedMs,prePostMs,statementDelayMs:225,graphDelayMs:200,sourceLeaseMs:60000,marginMs:60000-elapsedMs,leaseExtended:false,httpTransfers:1,workerBytesUnchanged:true,mediaDelta:0,productionLatencyMeasured:false});checks.push(kind+'-context-native-original-60s-lease-225ms-SQL-200ms-Graph-single-POST');
 }
 return {kind,postgresExecuted:true,cases,provider:'actual-adapter-controlled-Graph-fetch',realProviderCalls:0,humanAccepted:false,identityCertified:false,permissionsGranted:false};
}
