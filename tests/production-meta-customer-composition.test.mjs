import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {createMetaCustomerProductionProcessor} from '../src/lib/meta-customer-processing.mjs';
import {createMetaKycContextFeedback,META_KYC_CONTEXT_REPLY} from '../src/lib/meta-kyc-context-feedback.mjs';
import {META_KYC_AUTHORIZATION_CODES} from '../src/lib/meta-kyc-identity.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {contextFeedbackFixture,unchangedMedia,rewriteContextEvent} from './fixtures/meta-kyc-context-feedback-memory.mjs';

function processingConnect(t,counters){
 return async()=>{const client=await t.connect();return {release:()=>client.release(),query:async(sql,args=[])=>{
  if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"=$2')&&t.f.events.has(args[0])){const row=t.f.events.get(args[0]);row.leaseToken=args[1];row.leaseExpiresAt=args[2];counters.claims++;return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')&&t.f.events.has(args[0])){const row=t.f.events.get(args[0]);assert.equal(row.leaseToken,args[2]);assert.ok(Date.parse(row.leaseExpiresAt)>t.f.now.getTime());row.status='PROCESSED';row.outcome=JSON.parse(args[3]);row.leaseToken=null;counters.finishes++;return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT c.*,p."organizationId"')&&!sql.includes("p.status='ACTIVE'"))counters.beforeDispatch++;
  return client.query(sql,args);
 }};};
}
async function composed(kind,{factory=createMetaKycContextFeedback,mutate=null,liveCapture=false}={}){
 const t=await contextFeedbackFixture(kind,{expired:!liveCapture,stale:false,text:liveCapture?null:'ESTADO IDENTIDAD'}),event=t.f.events.get(t.context.eventId),calls=[],counters={claims:0,finishes:0,beforeDispatch:0,posts:0};
 if(mutate)mutate(t);event.leaseToken=null;event.leaseExpiresAt=null;event.attempts=0;
 const connect=processingConnect(t,counters),provider={sendReply:async input=>{await input.beforeExternal();await input.finalBeforeExternal();counters.posts++;assert.deepEqual(input.message,META_KYC_CONTEXT_REPLY);return {messageId:'wamid.SyntheticProductionCurrentExpired'};}},context=factory({connect,provider,environment:t.f.environment});
 const unexpected=name=>async()=>{calls.push(name);throw new Error('Unexpected composed route: '+name);};
 const rejection={rejection:async(_context,options)=>{calls.push(options.recoverOnly?'rejection-recovery':'rejection');return null;},send:unexpected('rejection-send')};
 const expiry={feedback:async(_context,options)=>{calls.push(options.recoverOnly?'expiry-recovery':'expiry-fallback');return options.recoverOnly?null:{kind:'KYC_EXPIRY_FEEDBACK',businessApplied:false,replySent:false};},send:unexpected('expiry-send')};
 const kycBridge={executeIntake:async()=>{calls.push('intake');return null;},execute:async ctx=>{calls.push('capture');if(liveCapture)return t.f.bridge.execute(ctx);throw new WorkspaceError('META_KYC_CHALLENGE_EXPIRED',409);}};
 const kycOutbound=liveCapture?{send:async(...args)=>{calls.push('kyc-send');counters.posts++;return t.f.outbound.send(...args);}}:{send:unexpected('kyc-send')};
 const processor=createMetaCustomerProductionProcessor({connect,environment:t.f.environment,now:()=>t.f.now.getTime(),onboarding:null,fieldBridge:{execute:unexpected('field')},kycBridge,kycOutbound,appProjection:{execute:unexpected('app')},companyBridge:{execute:unexpected('company')},fieldOutbound:{send:unexpected('field-send'),observeStatus:unexpected('status')},companyOutbound:{send:unexpected('company-send')},isCompany:unexpected('company-envelope'),rejectedKyc:rejection,expiredKyc:expiry,contextKyc:context,deferAuthorization:async()=>false,authorizationCodes:[...META_KYC_AUTHORIZATION_CODES,'META_KYC_CONTEXT_FEEDBACK_DENIED']});
 return {t,event,calls,counters,processor};
}
for(const kind of ['PROJECT','COMPANY'])test(kind+' production composition intercepts latest expired neutral before intake capture and expiry fallback',async()=>{
 const c=await composed(kind),before=structuredClone(c.t.f.worker),result=await c.processor.process(c.event.id);
 assert.equal(result.kind,'KYC_CONTEXT_FEEDBACK');assert.equal(result.replySent,true);assert.equal(result.businessApplied,false);assert.deepEqual(c.calls,['rejection-recovery','expiry-recovery']);assert.deepEqual(c.counters,{claims:1,finishes:1,beforeDispatch:1,posts:1});assert.deepEqual(c.t.f.worker,before);unchangedMedia(c.t.f);
 assert.equal((await c.processor.process(c.event.id)).done,true);assert.equal(c.counters.posts,1);assert.equal(c.counters.claims,1);assert.deepEqual(c.t.f.worker,before);
});
for(const kind of ['PROJECT','COMPANY'])test(kind+' shared production composition preserves real current live consent capture and KYC outbound',async()=>{
 const c=await composed(kind,{liveCapture:true}),before=c.t.f.state(),result=await c.processor.process(c.event.id);
 assert.equal(before.consent,false);assert.equal(result.kind,'KYC_CHAT');assert.equal(result.replySent,true);assert.equal(result.businessApplied,false);assert.equal(c.t.f.state().consent,true);assert.equal(c.t.f.state().step,'BACK_CONSENT');assert.deepEqual(c.calls,['rejection-recovery','expiry-recovery','intake','capture','kyc-send']);assert.equal(c.counters.posts,1);assert.equal(c.counters.beforeDispatch,1);unchangedMedia(c.t.f);
});
test('production composition regression rejects the published prior-only predispatch behavior',async()=>{
 const url=new URL('../src/lib/meta-kyc-context-feedback.mjs',import.meta.url),source=readFileSync(url,'utf8'),needle='&&!expiredNeutral)return null;';assert.ok(source.includes(needle));
 const previous=source.replace(needle,')return null;').replace(/from (['"])(\.\.?\/[^'"]+)\1/g,(_all,_quote,relative)=>'from '+JSON.stringify(new URL(relative,url).href));
 const factory=(await import('data:text/javascript;base64,'+Buffer.from(previous).toString('base64'))).createMetaKycContextFeedback,c=await composed('COMPANY',{factory}),before=structuredClone(c.t.f.worker),result=await c.processor.process(c.event.id);
 assert.equal(result.kind,'KYC_EXPIRY_FEEDBACK');assert.equal(result.replySent,false);assert.deepEqual(c.calls,['rejection-recovery','expiry-recovery','intake','capture','expiry-fallback']);assert.equal(c.counters.posts,0);assert.deepEqual(c.t.f.worker,before);unchangedMedia(c.t.f);
});
for(const cause of ['foreign-prompt','issuer-revoked','challenge-replaced'])test('latest expired composed source denies '+cause+' without reply or Worker effects',async()=>{
 const c=await composed('COMPANY',{mutate:t=>{if(cause==='foreign-prompt')rewriteContextEvent(t,p=>{p.value.context.id='wamid.ForeignCurrentExpired';});else if(cause==='issuer-revoked')t.f.controls.issuerActive=false;else t.f.worker.metadata.participant.kycChatChallenge.id='kyc_chat_replaced';}}),before=structuredClone(c.t.f.worker);
 // Capture/expiry remain guarded independently; this fixture's fallback is an
 // observation only. The new predispatch capability must not reserve or POST.
 await c.processor.process(c.event.id);assert.equal(c.counters.posts,0);assert.deepEqual(c.t.f.worker,before);assert.ok(c.calls.includes('intake'));assert.ok(c.calls.includes('capture'));unchangedMedia(c.t.f);
});
test('actual runtime calls the shared production composition with the existing named adapters and no route override',()=>{
 const tree=parse(readFileSync(new URL('../src/lib/meta-customer-processing-runtime.mjs',import.meta.url),'utf8'),{sourceType:'module'}),binding=tree.program.body.find(node=>node.type==='ExportNamedDeclaration'&&node.declaration?.type==='VariableDeclaration'&&node.declaration.declarations[0]?.id.name==='productionMetaCustomerProcessor').declaration.declarations[0].init;
 assert.equal(binding.callee.name,'createMetaCustomerProductionProcessor');assert.equal(binding.arguments.length,1);
 const props=new Map(binding.arguments[0].properties.map(prop=>[prop.key.name,prop.value]));
 assert.deepEqual([...props.keys()].sort(),['connect','onboarding','fieldBridge','kycBridge','kycOutbound','appProjection','companyBridge','fieldOutbound','companyOutbound','isCompany','rejectedKyc','expiredKyc','contextKyc','deferAuthorization','authorizationCodes'].sort());
 for(const [key,name]of [['fieldBridge','bridge'],['kycBridge','kycBridge'],['kycOutbound','kycOutbound'],['fieldOutbound','productionMetaCustomerOutbound'],['rejectedKyc','kycRejection'],['expiredKyc','kycExpiryFeedback'],['contextKyc','kycContextFeedback']])assert.equal(props.get(key).name,name);
});
