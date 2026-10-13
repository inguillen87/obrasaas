import test from 'node:test';
import assert from 'node:assert/strict';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';
import {ownCompanyRuntimeFixture} from './fixtures/own-company-runtime.mjs';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {encryptCustomerSecret,decryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaKycRejection,META_KYC_REJECTION_REPLY} from '../src/lib/meta-kyc-rejection.mjs';
import {resolveMetaKycRejectionAuthority,metaKycRejectionAuthorityDigest} from '../src/lib/meta-kyc-rejection-policy.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerProvider} from '../src/lib/meta-customer-provider.mjs';
import {resolveMetaKycAuthority} from '../src/lib/meta-kyc-identity.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {COMPANY_CHANNEL_SCHEMA_CONTRACT} from '../src/lib/company-channel-schema.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';

// Real encrypted proof/authority/reservation code, synthetic SQL and transport.
// This does not emulate PostgreSQL locks or prove a real provider delivery.
async function fixture({own=false,company=false,actualHttp=false,afterReserve=async()=>{}}={}){
 const f=kycMemoryFixture({active:true,captureImageSetVersion:2}),runtime=own?await ownCompanyRuntimeFixture():null;
 if(runtime){Object.assign(f.environment,runtime.environment);Object.assign(f.connection,runtime.connection);f.now.setTime(runtime.time);f.project.organizationId=f.connection.organizationId;}
 const issuer={...(runtime?runtime.context.member:f.issuer),membershipId:'current-reply-administrator',revision:'2026-10-10T00:00:00.000001'};
 f.connection.metadata.customerActivation.operationDigest=digest(['synthetic-activation',f.connection.id]);
 const activation={version:1,projectId:f.connection.projectId,providerGrantVerified:true,phoneRegistered:true,appSubscribed:true};
 const owner=company?{connectionId:f.connection.id,organizationId:f.connection.organizationId,anchorProjectId:f.connection.projectId,mode:'COMPANY',revision:2}:null;
 if(company)f.connection.metadata.companyRoutingVersion=1;
 const coreControls=f.controls,controls={issuer:true,project:true,activation:true,activationDuplicates:false,channel:true,sends:0,throwSend:null,beforeSend:null,afterScope:null,afterSend:null,failCommit:false},trace=[],queries=[];
 const rows=value=>({rows:structuredClone(value),rowCount:value.length});
 const client={async query(sql,args=[]){
  queries.push({sql,args});trace.push(sql.split(' ')[0]);
  assert.doesNotMatch(sql,/UPDATE public\."Worker"|INSERT INTO public\."Worker"|ProjectMembership.*(?:INSERT|UPDATE)/,'Rejection cannot write participant or permission state');
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL')||sql==='ROLLBACK')return rows([]);
  if(sql==='COMMIT'){if(controls.failCommit&&f.outbounds.size){controls.failCommit=false;throw new Error('Synthetic marker commit acknowledgement lost');}return rows([]);}
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date(f.now)}]};
  if(sql.includes('to_regclass'))return rows([{present:company,count:1}]);
  if(sql.startsWith('SELECT version,contract,"catalogFingerprint",'))return rows([{version:1,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT,catalogFingerprint:digest({columns:[],keys:[],indexes:[],triggers:[]}),currentCatalog:{columns:[],keys:[],indexes:[],triggers:[]},catalog:args[1].map(conname=>({conname,convalidated:true})),indexes:args[2].map(relname=>({relname,indisvalid:true,indisready:true,indisunique:true})),triggers:args[3].map(tgname=>({tgname,tgenabled:'O'}))}]);
  if(sql.includes('FROM public."WhatsAppCompanyChannel"'))return rows(owner?[owner]:[]);
  if(sql.includes('FROM public."PlatformUser" u JOIN public."TenantMembership"')){
   if(args.length===5)return runtime.client.query(sql,args);
   assert.deepEqual(args,[f.connection.metadata.customerActivation.actorId,f.connection.organizationId]);return rows(controls.issuer?[issuer]:[]);
  }
  if(sql.includes('FROM public."WhatsAppConnection"')){
   if(runtime&&args.length===3&&sql.includes('p."organizationId"=$3')&&!sql.includes("p.status='ACTIVE'"))return runtime.client.query(sql,args);
   return rows(controls.channel&&controls.project&&args[0]===f.connection.id&&args[1]===f.connection.projectId?[f.connection]:[]);
  }
  if(sql.includes('FROM public."Project"'))return rows(controls.project&&args[0]===f.connection.projectId&&args[1]===f.connection.organizationId?[{id:f.connection.projectId}]:[]);
  if(sql.includes('FROM public."AuditLog"')){
   if(sql.includes("action='company.own.number.recorded'"))return runtime.client.query(sql,args);
   if(sql.includes("action='integration.whatsapp.customer.activated'"))return rows(controls.activation?Array.from({length:controls.activationDuplicates?2:1},()=>({metadata:activation})):[]);
   const a=f.audits.get(args[0]);return rows(a&&a.entityType==='WebhookEvent'&&a.entityId===(args.length===2?args[1]:args[2])&&(args.length===2||a.organizationId===args[1])?[a]:[]);
  }
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.equal(f.audits.has(args[0]),false);f.audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],action:'participant.kyc_chat.rejected',entityType:'WebhookEvent',entityId:args[3],metadata:JSON.parse(args[4])});return rows([]);}
  if(sql.startsWith('SELECT')&&sql.includes('FROM public."WebhookEvent"')){const value=f.events.get(args[0])||f.outbounds.get(args[0]);return rows(value?[value]:[]);}
  if(sql.startsWith('INSERT INTO public."WebhookEvent"')){assert.equal(f.outbounds.has(args[0]),false);f.outbounds.set(args[0],{id:args[0],projectId:args[1],provider:'meta-customer-outbound-v1',status:'PENDING',payload:JSON.parse(args[3]),outcome:JSON.parse(args[4]),leaseToken:args[5],leaseExpiresAt:args[6]});return rows([]);}
  if(sql.startsWith('UPDATE public."WebhookEvent"')){
   const e=f.events.get(args[0])||f.outbounds.get(args[0]);
   if(sql.includes('attempts=attempts+1')){e.leaseToken=args[1];e.leaseExpiresAt=args[2];e.attempts=(e.attempts||0)+1;}
   else if(sql.includes('"lastError"=$3')){e.lastError=args[2];e.leaseToken=null;e.leaseExpiresAt=null;}
   else {assert.equal(e.leaseToken,args[2]);e.status='PROCESSED';e.outcome=JSON.parse(args[3]);e.leaseToken=null;e.leaseExpiresAt=null;}
   return {rows:[],rowCount:1};
  }
  assert.fail('Unexpected rejection SQL: '+sql);
 },release(){}};
 const connect=async()=>client;
 const httpRequests=[],http=createMetaCustomerProvider({environment:f.environment,now:()=>f.now.getTime(),fetchImpl:async(url,options)=>{assert.equal(new URL(url).hostname,'graph.facebook.com');assert.equal(options.method,'POST');assert.match(new URL(url).pathname,/\/120000011\/messages$/);const body=JSON.parse(options.body);assert.equal(body.type,'text');assert.equal(body.text.body,META_KYC_REJECTION_REPLY.body);httpRequests.push(body);return new Response(JSON.stringify({messages:[{id:'wamid.syntheticrejectHTTP'}]}),{status:200,headers:{'Content-Type':'application/json'}});}});
 const provider={async forConnection(options){assert.ok(runtime);assert.ok(options.capability);await options.beforeExternal();if(controls.afterScope)await controls.afterScope();return this;},async sendReply(value){
  if(controls.beforeSend)await controls.beforeSend();await value.beforeExternal();
  assert.ok(f.outbounds.has(value.correlationId));assert.equal(f.outbounds.get(value.correlationId).outcome.state,'SEND_STARTED');assert.ok(trace.lastIndexOf('COMMIT')>=0,'Reservation commit must precede transport');assert.deepEqual(value.message,META_KYC_REJECTION_REPLY);
  controls.sends++;trace.push('POST');if(controls.throwSend)throw controls.throwSend;const sent=actualHttp?await http.sendReply(value):{messageId:'wamid.syntheticreject123456'};if(controls.afterSend)await controls.afterSend();return sent;
 }};
 const adapter=createMetaKycRejection({connect,provider,environment:f.environment,afterReserve:()=>afterReserve({f,controls,runtime,owner})});
 const receive=(text='IDENTIDAD '+'z'.repeat(43))=>{const c=f.receive(text),event=f.events.get(c.eventId);event.eventType='message';event.attempts=0;event.status='PENDING';if(company){rewrite(event,()=>{},{mode:'COMPANY',revision:owner.revision,contract:COMPANY_CHANNEL_SCHEMA_CONTRACT});c.payloadDigest=event.payload.payloadDigest;}return c;};
 function rewrite(event,change,companyRouting){const aad={organizationId:f.connection.organizationId,projectId:f.connection.projectId,resourceId:event.id},payload=JSON.parse(decryptCustomerSecret(event.payload.encryptedPayload,{...aad,purpose:'webhook'},f.environment)),proof=JSON.parse(decryptCustomerSecret(event.payload.encryptedProof,{...aad,purpose:'webhook-proof'},f.environment));change(payload);proof.payloadDigest=metaCustomerContentDigest(payload);if(companyRouting)proof.companyRouting=companyRouting;event.payload.payloadDigest=proof.payloadDigest;event.payload.encryptedPayload=encryptCustomerSecret(JSON.stringify(payload),{...aad,purpose:'webhook'},f.environment);event.payload.encryptedProof=encryptCustomerSecret(JSON.stringify(proof),{...aad,purpose:'webhook-proof'},f.environment);}
 const rejected=context=>adapter.rejection(context,{code:'META_KYC_CHALLENGE_REJECTED'}),snapshot=()=>JSON.stringify(f.worker);
 return {...f,runtime,issuer,activation,owner,controls,coreControls,trace,queries,client,connect,provider,adapter,receive,rewrite,rejected,snapshot,httpRequests};
}

test('actual expired never-started IDENTIDAD uses the unchanged generic rejection and privately retains EXPIRED without granting capture',async()=>{
 const f=await fixture({actualHttp:true});f.worker.metadata.participant.kycChatChallenge.expiresAt=new Date(f.now.getTime()-1).toISOString();const c=f.receive(f.code),event=f.events.get(c.eventId),before=f.snapshot();event.leaseToken=null;event.leaseExpiresAt=null;let captureAttempts=0;
 const processor=createMetaCustomerProcessor({connect:f.connect,environment:f.environment,now:()=>f.now.getTime(),lockChannel:async()=>f.connection,authorizationCodes:['META_KYC_CHALLENGE_EXPIRED'],expiredKyc:async()=>null,rejectedKyc:f.adapter.rejection,dispatch:async context=>{captureAttempts++;return resolveMetaKycAuthority({query:f.query},context,{environment:f.environment});},outbound:{send:(context,reply,{purpose})=>{assert.equal(purpose,'KYC_REJECTION');return f.adapter.send(context,reply);}}});
 const value=await processor.process(c.eventId);assert.equal(value.processed,true);assert.equal(value.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(value.businessApplied,false);assert.equal(value.replySent,true);assert.equal(captureAttempts,1);assert.equal(f.httpRequests.length,1);assert.equal(f.httpRequests[0].text.body,META_KYC_REJECTION_REPLY.body);assert.equal(f.queries.some(q=>q.sql.includes('public."Worker"')||q.sql.includes('public."ProjectMembership"')),false,'Generic reply authority does not select or write a person');
 const audit=[...f.audits.values()].find(a=>a.action==='participant.kyc_chat.rejected');assert.equal(audit.metadata.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(audit.metadata.observedCode,'META_KYC_CHALLENGE_EXPIRED');assert.equal(f.snapshot(),before);assert.equal(f.coreControls.downloads,0);assert.equal(f.blob.puts(),0);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'PENDING');
 await processor.process(c.eventId);assert.equal(f.httpRequests.length,1);assert.equal(captureAttempts,1);assert.equal(f.snapshot(),before);
});
test('expired marker feedback is the same public result as a mismatched marker and never reveals whether its challenge exists',async()=>{
 for(const company of [false,true]){const f=await fixture({company}),c=f.receive();const expired=await f.adapter.rejection(c,{code:'META_KYC_CHALLENGE_EXPIRED'});assert.deepEqual(expired.reply,META_KYC_REJECTION_REPLY);assert.equal(expired.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(f.queries.some(q=>q.sql.includes('public."Worker"')),false);const sealed=structuredClone([...f.audits]);assert.deepEqual(await f.adapter.rejection(c,{code:'META_KYC_CHALLENGE_REJECTED'}),expired);assert.deepEqual([...f.audits],sealed);assert.equal(f.controls.sends,0);}
});

for(const own of [false,true])test((own?'OWN runtime':'customer activation')+' replies once with fixed text and no capture or identity authority',async()=>{
 const f=await fixture({own}),context=f.receive(),before=f.snapshot(),r=await f.rejected(context);
 assert.equal(r.kind,'KYC_REJECTION');assert.equal(r.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(r.businessApplied,false);assert.equal(r.identityStatus,'CHANNEL_IDENTITY_UNVERIFIED');assert.deepEqual(r.reply,META_KYC_REJECTION_REPLY);
 assert.equal((await f.adapter.send(context,r.reply)).state,'SENT');assert.equal(f.controls.sends,1);assert.equal((await f.adapter.send(context,r.reply)).replayed,true);assert.equal(f.controls.sends,1);assert.equal(f.snapshot(),before);assert.equal(f.coreControls.downloads,0);assert.equal(f.blob.puts(),0);
 const request=JSON.parse(decryptCustomerSecret([...f.outbounds.values()][0].payload.encryptedPayload,{organizationId:f.connection.organizationId,projectId:f.connection.projectId,purpose:'outbound',resourceId:customerOutboundId(context.eventId)},f.environment));
 assert.equal(request.channelPurpose,'KYC_REJECTION');assert.equal(request.to,f.worker.phone.slice(1));assert.deepEqual(request.message,META_KYC_REJECTION_REPLY);assert.equal(Object.hasOwn(request,'workerId'),false);assert.equal(Object.hasOwn(request,'challengeId'),false);
});
test('a mismatched code and an arbitrary signed sender receive the same non-enumerating rejection text',async()=>{
 const f=await fixture(),context=f.receive();f.rewrite(f.events.get(context.eventId),p=>{p.value.from='5491100009999';});context.payloadDigest=f.events.get(context.eventId).payload.payloadDigest;
 const r=await f.rejected(context);await f.adapter.send(context,r.reply);assert.equal(f.controls.sends,1);assert.equal(f.worker.metadata.participant.kycChatChallenge.status,'PENDING');assert.doesNotMatch(r.reply.body,/IDENTIDAD |teléfono distinto|código no coincide|Persona|aprobad|habilitad/i);
});
test('inapplicable commands and other authorization codes never create a rejection receipt',async()=>{
 const f=await fixture();for(const text of ['HOLA','VINCULAR '+'x'.repeat(43),'IDENTIDADother','ESTADO'])assert.equal(await f.rejected(f.receive(text)),null);
 assert.equal(await f.adapter.rejection(f.receive(),{code:'META_KYC_CHALLENGE_REVOKED'}),null);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.rejected').length,0);assert.equal(f.outbounds.size,0);
});
for(const[label,change]of[
 ['unsigned event',(f,c)=>{f.events.get(c.eventId).payload.signatureVerified=false;}],
 ['corrupt proof',(f,c)=>{f.events.get(c.eventId).payload.encryptedProof='corrupt';}],
 ['foreign tenant',(f,c)=>{f.events.get(c.eventId).payload.organizationId='foreign-tenant';}],
 ['foreign channel',(f,c)=>{f.events.get(c.eventId).payload.channelId='foreign-channel';}],
 ['foreign WABA',(f,c)=>{f.rewrite(f.events.get(c.eventId),p=>{p.wabaId='130000099';});c.payloadDigest=f.events.get(c.eventId).payload.payloadDigest;}],
 ['foreign phone asset',(f,c)=>{f.rewrite(f.events.get(c.eventId),p=>{p.phoneNumberId='120000099';});c.payloadDigest=f.events.get(c.eventId).payload.payloadDigest;}],
 ['wrong credential AAD',f=>{f.connection.metadata.credentialOrganizationId='foreign-tenant';}],
 ['disabled channel',f=>{f.connection.enabled=false;}],
 ['revoked issuer',f=>{f.controls.issuer=false;}],
 ['missing activation receipt',f=>{f.controls.activation=false;}],
 ['ambiguous activation receipt',f=>{f.controls.activationDuplicates=true;}],
 ['unapproved activation receipt',f=>{f.activation.providerGrantVerified=false;}],
 ['inactive anchor',f=>{f.controls.project=false;}],
 ['stale lease',(f,c)=>{f.events.get(c.eventId).leaseToken='00000000-0000-4000-8000-000000000000';}],
 ['expired lease',(f,c)=>{f.events.get(c.eventId).leaseExpiresAt=new Date(f.now.getTime()-1);}],
 ['processed history',(f,c)=>{f.events.get(c.eventId).status='PROCESSED';}],
 ['expired reply window',(f,c)=>{f.rewrite(f.events.get(c.eventId),p=>{p.value.timestamp=String(Math.floor(f.now.getTime()/1000)-86400);});c.payloadDigest=f.events.get(c.eventId).payload.payloadDigest;}],
 ['future signed time',(f,c)=>{f.rewrite(f.events.get(c.eventId),p=>{p.value.timestamp=String(Math.floor(f.now.getTime()/1000)+61);});c.payloadDigest=f.events.get(c.eventId).payload.payloadDigest;}],
 ['demo protocol',(f,c)=>{f.events.get(c.eventId).provider='meta-demo-pilot-v1';}],
 ['development pilot',f=>{f.connection.metadata.developmentPilot={version:1};}],
])test(label+' cannot obtain fixed reply authority or write a receipt',async()=>{const f=await fixture(),c=f.receive(),before=f.snapshot();change(f,c);await assert.rejects(resolveMetaKycRejectionAuthority(f.client,c,{environment:f.environment}));assert.equal(f.controls.sends,0);assert.equal(f.outbounds.size,0);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.rejected').length,0);assert.equal(f.snapshot(),before);});
test('corporate channel requires current COMPANY owner and signed revision without selecting a target worker',async()=>{
 const f=await fixture({company:true}),c=f.receive();assert.equal((await f.rejected(c)).kind,'KYC_REJECTION');assert.equal(f.queries.some(q=>q.sql.includes('FROM public."Worker"')),false);
 for(const change of [()=>{f.owner.mode='SUSPENDED';},()=>{f.owner.mode='COMPANY';f.owner.revision++;}]){change();await assert.rejects(resolveMetaKycRejectionAuthority(f.client,c,{environment:f.environment}));}assert.equal(f.controls.sends,0);
});
for(const state of ['SEND_STARTED','SEND_UNKNOWN','SENT'])test(state+' reservation is never sent again even after its lease expires',async()=>{
 const f=await fixture(),c=f.receive(),r=await f.rejected(c);await f.adapter.send(c,r.reply);const outbound=f.outbounds.get(customerOutboundId(c.eventId));outbound.outcome.state=state;outbound.leaseExpiresAt=new Date(f.now.getTime()-1);const sends=f.controls.sends;
 assert.equal((await f.adapter.send(c,r.reply)).state,state);assert.equal(f.controls.sends,sends);
});
test('uncertain transport and a lost marker commit acknowledgement never permit another POST',async()=>{
 const f=await fixture(),c=f.receive(),r=await f.rejected(c);f.controls.throwSend=new Error('Synthetic acknowledgement lost');assert.equal((await f.adapter.send(c,r.reply)).state,'SEND_UNKNOWN');assert.equal(f.controls.sends,1);await f.adapter.send(c,r.reply);assert.equal(f.controls.sends,1);
 const g=await fixture(),d=g.receive(),s=await g.rejected(d);g.controls.failCommit=true;await assert.rejects(g.adapter.send(d,s.reply));assert.equal(g.controls.sends,0);assert.equal((await g.adapter.send(d,s.reply)).state,'SEND_STARTED');assert.equal(g.controls.sends,0);
});
for(const[label,change]of[
 ['issuer',x=>{x.controls.issuer=false;}],['channel',x=>{x.f.connection.enabled=false;}],['credential',x=>{x.f.connection.encryptedAccessToken='changed';}],['owner',x=>{x.owner.mode='SUSPENDED';}],['lease',x=>{for(const e of x.f.events.values())e.leaseExpiresAt=new Date(x.f.now.getTime()-1);}],
])test('revoked '+label+' after reservation cannot send or reuse the marker',async()=>{
 const f=await fixture({company:true,afterReserve:async x=>change(x)}),c=f.receive(),r=await f.rejected(c);await assert.rejects(f.adapter.send(c,r.reply));assert.equal(f.controls.sends,0);assert.equal(f.outbounds.get(customerOutboundId(c.eventId)).outcome.state,'SEND_STARTED');
});
test('OWN issuer loss between provider awaits is checked before the only permitted POST',async()=>{
 const f=await fixture({own:true}),c=f.receive(),r=await f.rejected(c);f.controls.afterScope=()=>{f.runtime.controls.issuerActive=false;};await assert.rejects(f.adapter.send(c,r.reply));assert.equal(f.controls.sends,0);assert.equal(f.outbounds.get(customerOutboundId(c.eventId)).outcome.state,'SEND_STARTED');
});
test('edited fixed reply, sealed dispatch or prior purpose conflict cannot send',async()=>{
 const f=await fixture(),c=f.receive(),r=await f.rejected(c);await assert.rejects(f.adapter.send(c,{type:'text',body:'invented'}));assert.equal(f.outbounds.size,0);
 const audit=[...f.audits.values()].find(a=>a.action==='participant.kyc_chat.rejected');audit.metadata.replyDigest=digest('edited');await assert.rejects(f.adapter.send(c,r.reply));assert.equal(f.controls.sends,0);
 const g=await fixture(),d=g.receive(),s=await g.rejected(d);g.outbounds.set(customerOutboundId(d.eventId),{id:customerOutboundId(d.eventId),projectId:g.connection.projectId,payload:{requestDigest:digest('different-purpose')},outcome:{state:'SENT'}});await assert.rejects(g.adapter.send(d,s.reply),{code:'META_CUSTOMER_OUTBOUND_CONFLICT'});assert.equal(g.controls.sends,0);
 assert.throws(()=>metaKycRejectionAuthorityDigest({kind:'KYC_REJECTION_REPLY'}));
});
test('processor default-null keeps legacy rejection silent; explicit callback preserves rejection and avoids capture on replay',async()=>{
 for(const enabled of [false,true]){
  const f=await fixture(),c=f.receive(),e=f.events.get(c.eventId),before=f.snapshot();e.leaseToken=null;e.leaseExpiresAt=null;let dispatches=0,purposes=[];
  const processor=createMetaCustomerProcessor({connect:f.connect,environment:f.environment,now:()=>f.now.getTime(),lockChannel:async()=>f.connection,authorizationCodes:['META_KYC_CHALLENGE_REJECTED'],dispatch:async()=>{dispatches++;throw new WorkspaceError('META_KYC_CHALLENGE_REJECTED',409);},...(enabled?{rejectedKyc:f.adapter.rejection}:{}),outbound:{send:async(context,reply,{purpose})=>{purposes.push(purpose);return f.adapter.send(context,reply);}}});
  const value=await processor.process(c.eventId);assert.equal(value.processed,true);assert.equal(value.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(value.businessApplied,false);assert.equal(value.replySent,enabled);assert.equal(f.controls.sends,enabled?1:0);assert.deepEqual(purposes,enabled?['KYC_REJECTION']:[]);assert.equal(f.snapshot(),before);
  await processor.process(c.eventId);assert.equal(dispatches,1);assert.equal(f.controls.sends,enabled?1:0);
  if(enabled){e.status='PENDING';e.leaseToken=null;e.leaseExpiresAt=null;await processor.process(c.eventId);assert.equal(dispatches,1,'A sealed rejection must be recovered before any capture dispatch');assert.equal(f.controls.sends,1);}
 }
});
for(const state of [null,'SEND_STARTED','SEND_UNKNOWN','SENT'])test('closed reply window terminally recovers sealed rejection '+(state||'without a marker')+' with no capture or new POST',async()=>{
 const f=await fixture(),c=f.receive(),r=await f.rejected(c),e=f.events.get(c.eventId);
 if(state){await f.adapter.send(c,r.reply);f.outbounds.get(customerOutboundId(c.eventId)).outcome.state=state;}
 const sends=f.controls.sends,before=f.snapshot(),audits=f.audits.size,outbounds=f.outbounds.size;f.now.setTime(f.now.getTime()+86461000);e.leaseToken=null;e.leaseExpiresAt=null;
 let dispatches=0,sendAttempts=0;
 const processor=createMetaCustomerProcessor({connect:f.connect,environment:f.environment,now:()=>f.now.getTime(),rejectedKyc:f.adapter.rejection,dispatch:async()=>{dispatches++;assert.fail('Historical rejection cannot recapture');},outbound:{send:async()=>{sendAttempts++;assert.fail('Closed window cannot send');}}});
 const value=await processor.process(c.eventId);assert.equal(value.processed,true);assert.equal(value.replyWindowClosed,true);assert.equal(value.code,'META_KYC_CHALLENGE_REJECTED');assert.equal(value.businessApplied,false);assert.equal(value.replySent,state==='SENT');assert.equal(value.replyState,state||'META_CUSTOMER_REPLY_WINDOW_CLOSED');assert.equal(e.status,'PROCESSED');assert.equal(dispatches,0);assert.equal(sendAttempts,0);assert.equal(f.controls.sends,sends);assert.equal(f.snapshot(),before);assert.equal(f.audits.size,audits);assert.equal(f.outbounds.size,outbounds);
 await processor.process(c.eventId);assert.equal(f.controls.sends,sends);
});
test('expired initial rejection or inactive reply authority falls back to observation without a receipt or send',async()=>{
 for(const mutate of [f=>{f.connection.enabled=false;},f=>{f.controls.issuer=false;},f=>{f.now.setTime(f.now.getTime()+86461000);}]){const f=await fixture(),c=f.receive();mutate(f);const e=f.events.get(c.eventId);e.leaseExpiresAt=new Date(f.now.getTime()+60000);assert.equal(await f.rejected(c),null);assert.equal(f.outbounds.size,0);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc_chat.rejected').length,0);assert.equal(f.controls.sends,0);}
});
