import assert from 'node:assert/strict';
import {kycMemoryFixture} from './meta-kyc-chat-memory.mjs';
import {companyKycMemoryFixture} from './company-kyc-memory.mjs';
import {ownCompanyRuntimeFixture} from './own-company-runtime.mjs';
import {createMetaCustomerProvider} from '../../src/lib/meta-customer-provider.mjs';
import {createMetaKycContextFeedback,META_KYC_CONTEXT_REPLY} from '../../src/lib/meta-kyc-context-feedback.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../../src/lib/meta-customer-callback.mjs';
// Synthetic SQL transaction adapter and actual provider serializer; no network.
export async function contextFeedbackFixture(kind,{active=true,expired=false,stale=true,text=null,own=false,grantLifetimeMs=null,historicalChallengeVersion,factory=createMetaKycContextFeedback,afterReserve=async()=>{},providerAfterFirstFence=null}={}){
 const runtime=own?await ownCompanyRuntimeFixture({time:Date.now()}):null,f=kind==='COMPANY'?await companyKycMemoryFixture({active,captureImageSetVersion:2,grantLifetimeMs,historicalChallengeVersion}):kycMemoryFixture({active,captureImageSetVersion:2,ownRuntime:runtime});
 if(kind==='PROJECT'&&grantLifetimeMs!==null)f.connection.metadata.customerVerification.expiresAt=new Date(f.now.getTime()+grantLifetimeMs).toISOString();
 await f.execute(f.code);const originalState=f.state(),original=[...f.outbounds.values()].at(-1);if(stale)await f.choose('Autorizar imágenes');const prompt=stale?original.outcome.messageId:[...f.outbounds.values()].at(-1).outcome.messageId;
 if(expired)f.now.setTime(f.now.getTime()+31*60*1000);
 const context=f.receive(text?{type:'text',context:{id:prompt},text:{body:text}}:{type:'interactive',context:{id:prompt},interactive:{type:'list_reply',list_reply:{id:'kyc:'+originalState.nonce+':0'}}},{contextId:prompt}),requests=[],controls={loseAck:false,beforeSql:null,commitOutcome:null,afterOwnBoundary:null,afterFirstFence:providerAfterFirstFence};let tail=Promise.resolve();
 let transactionSequence=0;
 const connect=async()=>{const client=await f.connect();let unlock=null,snapshot=null,committed=false,transactionId=null;return {release(){unlock?.();client.release();},async query(sql,args=[]){
  if(sql.startsWith('BEGIN')){const previous=tail;tail=new Promise(resolve=>{unlock=resolve;});await previous;transactionId=String(++transactionSequence);snapshot=structuredClone({worker:f.worker,audits:[...f.audits],events:[...f.events],outbounds:[...f.outbounds]});}
  if(controls.beforeSql)await controls.beforeSql(sql,args);
  if(sql.includes('AS "contextTransactionId"')){
   const event=f.events.get(args[0]);if(!event||!f.controls.issuerActive||!f.controls.workerMembershipActive||!f.controls.projectActive||!f.worker.active||f.worker.metadata.participant.status==='ACTIVE'&&!f.controls.projectAssignmentActive||event.leaseToken!==args[11]||Date.parse(event.leaseExpiresAt)<=f.now.getTime()||f.control&&(!f.control.owner||!f.control.assignment))return {rows:[],rowCount:0};
   const sources=[...new Set(args[9])].map(id=>f.events.get(id)||f.outbounds.get(id)).filter(Boolean).map(s=>({id:s.id,projectId:s.projectId,provider:s.provider||(f.outbounds.has(s.id)?'meta-customer-outbound-v1':null),eventType:s.eventType,externalId:s.externalId,payload:s.payload,messageId:s.outcome?.messageId||null,accepted:f.outbounds.has(s.id)?['SENT','STATUS_OBSERVED'].includes(s.outcome?.state)&&!['failed','deleted'].includes(s.outcome?.providerStatus):true}));
   const snapshotMember=args[6]===f.issuer.membershipId?f.issuer:f.member;const value={event,worker:f.worker,channel:f.connection,issuer:{...f.issuer,id:f.issuer.membershipId,userId:f.issuer.actorId,tenantRole:f.issuer.role},member:{...snapshotMember,id:snapshotMember.membershipId,userId:snapshotMember.actorId,tenantRole:snapshotMember.role},sources,receipts:[...f.audits.values()].filter(a=>a.entityType!=='WebhookEvent'),assignment:f.controls.projectAssignmentActive,company:f.owner||null};return {rows:[{contextNow:new Date(f.now),contextTransactionId:transactionId,leaseExpiresAt:event.leaseExpiresAt,snapshot:structuredClone(value)}],rowCount:1};
  }
  const feedbackRecorded=[...f.audits.values()].some(a=>a.action==='participant.kyc_chat.context_feedback');
  if(sql==='COMMIT'&&feedbackRecorded&&controls.commitOutcome==='ROLLBACK'){controls.commitOutcome=null;throw new Error('Synthetic expiry COMMIT rejected before applying');}
  const value=await client.query(sql,args);
  if(sql==='COMMIT'){committed=true;unlock?.();unlock=null;if(feedbackRecorded&&controls.commitOutcome==='LOST_ACK'){controls.commitOutcome=null;throw new Error('Synthetic expiry COMMIT applied then ACK lost');}}
  if(sql==='ROLLBACK'&&!committed&&snapshot){Object.assign(f.worker,snapshot.worker);for(const [map,key] of [[f.audits,'audits'],[f.events,'events'],[f.outbounds,'outbounds']]){map.clear();for(const [id,entry]of snapshot[key])map.set(id,entry);}unlock?.();unlock=null;}
  return value;
 }};};
 const actual=createMetaCustomerProvider({environment:f.environment,now:()=>f.now.getTime(),fetchImpl:async(url,options)=>{
  assert.equal(new URL(url).hostname,'graph.facebook.com');if(runtime&&options.method==='GET')return runtime.fetchImpl(url,options);assert.equal(options.method,'POST');assert.equal(new URL(url).pathname,'/'+f.environment.META_GRAPH_API_VERSION+'/'+f.connection.phoneNumberId+'/messages');const body=JSON.parse(options.body);assert.equal(body.type,'text');assert.equal(body.text.body,META_KYC_CONTEXT_REPLY.body);assert.equal(body.to,f.worker.metadata.participant.kycChatChallenge.senderE164.slice(1));assert.match(body.context.message_id,/^wamid\./);assert.match(body.biz_opaque_callback_data,/^customer_outbound_[a-f0-9]{64}$/);
  requests.push({method:options.method,body});if(controls.loseAck)throw new Error('Synthetic HTTP accepted then ACK lost');return new Response(JSON.stringify({messages:[{id:'wamid.SyntheticExpiryAccepted_'+requests.length}]}),{status:200,headers:{'Content-Type':'application/json'}});
 }});
 const provider={sendReply:async input=>actual.sendReply({...input,beforeExternal:async()=>{await input.beforeExternal();if(controls.afterFirstFence)await controls.afterFirstFence();}})};
 if(runtime)provider.forConnection=async input=>{let armed=false;const scoped=await actual.forConnection({...input,beforeExternal:async()=>{await input.beforeExternal();if(armed&&controls.afterOwnBoundary)await controls.afterOwnBoundary();}});armed=true;return scoped;};
 const adapter=factory({connect,provider,environment:f.environment,afterReserve:()=>afterReserve({f,controls,context})});
 return {f,context,connect,adapter,requests,controls,runtime};
}
export const unchangedMedia=f=>{assert.equal(f.controls.downloads,0);assert.equal(f.blob.puts(),0);if(f.control){assert.equal(f.control.graph,0);assert.equal(f.control.cdn,0);}};
export function rewriteContextEvent(t,change){
 const e=t.f.events.get(t.context.eventId),aad={organizationId:t.f.connection.organizationId,projectId:t.f.connection.projectId,resourceId:e.id},payload=JSON.parse(decryptCustomerSecret(e.payload.encryptedPayload,{...aad,purpose:'webhook'},t.f.environment)),proof=JSON.parse(decryptCustomerSecret(e.payload.encryptedProof,{...aad,purpose:'webhook-proof'},t.f.environment));
 change(payload);proof.payloadDigest=metaCustomerContentDigest(payload);e.payload.payloadDigest=proof.payloadDigest;e.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},t.f.environment);e.payload.encryptedProof=encryptCustomerSecret(JSON.stringify(proof),{...aad,purpose:'webhook-proof'},t.f.environment);t.context.payloadDigest=proof.payloadDigest;
}
