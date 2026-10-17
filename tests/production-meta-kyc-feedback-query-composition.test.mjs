import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {contextFeedbackFixture,rewriteContextEvent,unchangedMedia} from './fixtures/meta-kyc-context-feedback-memory.mjs';
import {stepReminderFixture} from './fixtures/meta-kyc-step-reminder-memory.mjs';
import {createMetaKycContextFeedback,metaKycContextReceiptId} from '../src/lib/meta-kyc-context-feedback.mjs';
import {createMetaKycExpiryFeedback,metaKycExpiryReceiptId} from '../src/lib/meta-kyc-expiry-feedback.mjs';
import {resolveMetaKycContextOrReminderAuthority,resolveMetaKycContextFeedbackAuthority,resolveMetaKycStepReminderAuthority,metaKycContextAuthorityDigest} from '../src/lib/meta-kyc-identity.mjs';

// Existing signed fixtures and provider counters; this file adds query-shape
// regressions without changing any historical assertion or native oracle.
test('combined signed neutral resolver preserves the historical reminder authority with two fewer reads',async()=>{
 const t=await stepReminderFixture('FRONT');rewriteContextEvent(t,p=>{p.value.type='text';delete p.value.image;delete p.value.context;p.value.text={body:'HOLA'};});
 const client=await t.currentConnect(),sql=[],wrapped={query:async(...args)=>{sql.push(args[0]);return client.query(...args);}},before=structuredClone(t.f.worker);await client.query('BEGIN');
 try{
  const combined=await resolveMetaKycContextOrReminderAuthority(wrapped,t.context,{environment:t.f.environment}),combinedQueries=sql.splice(0);
  const historical=await resolveMetaKycContextFeedbackAuthority(wrapped,t.context,{environment:t.f.environment})||await resolveMetaKycStepReminderAuthority(wrapped,t.context,{environment:t.f.environment}),historicalQueries=sql.splice(0);
  assert.equal(combined.feedbackUnquotedGuidance,true);assert.equal(metaKycContextAuthorityDigest(wrapped,combined,t.context),metaKycContextAuthorityDigest(wrapped,historical,t.context));
  const initialReads=values=>values.filter(q=>q==='SELECT id,"projectId",provider,"eventType","externalId",status::text AS status,payload,"leaseToken","leaseExpiresAt","createdAt" FROM public."WebhookEvent" WHERE id=$1'||q==='SELECT c.*,p."organizationId" FROM public."WhatsAppConnection" c JOIN public."Project" p ON p.id=c."projectId" WHERE c.id=$1 AND c."projectId"=$2 AND p.status=\'ACTIVE\'').length;
  assert.equal(initialReads(combinedQueries),2);assert.equal(initialReads(historicalQueries),4);assert.deepEqual(t.f.worker,before);assert.equal(t.requests.length,0);unchangedMedia(t.f);
 }finally{await client.query('ROLLBACK');client.release();}
});

test('combined quoted route preserves the strict historical context authority',async()=>{
 const t=await contextFeedbackFixture('COMPANY'),client=await t.connect();await client.query('BEGIN');
 try{const combined=await resolveMetaKycContextOrReminderAuthority(client,t.context,{environment:t.f.environment}),historical=await resolveMetaKycContextFeedbackAuthority(client,t.context,{environment:t.f.environment});assert.equal(combined.feedbackStalePrompt,true);assert.equal(combined.feedbackUnquotedGuidance,undefined);assert.equal(metaKycContextAuthorityDigest(client,combined,t.context),metaKycContextAuthorityDigest(client,historical,t.context));assert.equal(t.requests.length,0);unchangedMedia(t.f);}
 finally{await client.query('ROLLBACK');client.release();}
});

for(const [name,context]of [['null',null],['empty',{}],['number',17],['non-string id',{id:17}]])test('combined '+name+' explicit context never falls back to reminder discovery',async()=>{
 const t=await stepReminderFixture('FRONT');rewriteContextEvent(t,p=>{p.value.type='text';delete p.value.image;p.value.text={body:'HOLA'};p.value.context=context;});const before=structuredClone(t.f.worker),client=await t.currentConnect(),calls=t.reminderControls.discoveryCalls.length;await client.query('BEGIN');
 try{assert.equal(await resolveMetaKycContextOrReminderAuthority(client,t.context,{environment:t.f.environment}),null);assert.equal(t.reminderControls.discoveryCalls.length,calls);assert.deepEqual(t.f.worker,before);assert.equal(t.requests.length,0);unchangedMedia(t.f);}
 finally{await client.query('ROLLBACK');client.release();}
});

test('combined route verifies the signed source before selecting reminder discovery',async()=>{
 const t=await stepReminderFixture('FRONT');rewriteContextEvent(t,p=>{p.value.type='text';delete p.value.image;delete p.value.context;p.value.text={body:'HOLA'};});t.f.events.get(t.context.eventId).payload.encryptedProof=null;const client=await t.currentConnect(),calls=t.reminderControls.discoveryCalls.length;await client.query('BEGIN');
 try{await assert.rejects(resolveMetaKycContextOrReminderAuthority(client,t.context,{environment:t.f.environment}),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});assert.equal(t.reminderControls.discoveryCalls.length,calls);assert.equal(t.requests.length,0);unchangedMedia(t.f);}
 finally{await client.query('ROLLBACK');client.release();}
});

const routes=[{name:'context',factory:createMetaKycContextFeedback,receipt:metaKycContextReceiptId,action:'participant.kyc_chat.context_feedback',denied:'META_KYC_CONTEXT_FEEDBACK_DENIED',prepare:{staleOnly:true}},{name:'expiry',factory:createMetaKycExpiryFeedback,receipt:metaKycExpiryReceiptId,action:'participant.kyc_chat.expiry_feedback',denied:'META_KYC_EXPIRY_FEEDBACK_DENIED',prepare:{code:'META_KYC_CHALLENGE_EXPIRED'}}];
const fixtureFor=(route,kind='COMPANY')=>contextFeedbackFixture(kind,{factory:route.factory,expired:route.name==='expiry',stale:route.name==='context'});
function sourceAdapter(t,route,{mutateSource=value=>value,beforeSql=async()=>{},mutateRecorded=value=>value}={}){
 const seen={sourceReads:0,recordedReads:0,posts:0};
 const connect=async()=>{const client=await t.connect();return {release:()=>client.release(),query:async(sql,args=[])=>{
  await beforeSql(sql,args);const value=await client.query(sql,args);
  if(sql.includes('AS "feedbackSourceNow"')){
   seen.sourceReads++;assert.deepEqual(args,[t.context.eventId,t.context.projectId,t.context.channelId]);assert.doesNotMatch(sql,/FOR (SHARE|UPDATE)|to_jsonb|row_to_json/);assert.match(sql,/c\."projectId"=e\."projectId"/);assert.match(sql,/p\.status='ACTIVE'/);
   for(const row of value.rows){assert.ok(row.feedbackSourceNow instanceof Date);assert.ok(row.feedbackSourceLeaseExpiresAt instanceof Date);}
   return mutateSource(value);
  }
  if(sql.includes("action='"+route.action+"'")&&sql.startsWith('SELECT')){seen.recordedReads++;assert.equal(args[1],t.f.connection.organizationId);return mutateRecorded(value);}
  return value;
 }};};
 return {adapter:route.factory({connect,environment:t.f.environment,provider:{sendReply:async()=>{seen.posts++;throw Error('Unexpected recovery POST');}}}),seen};
}

for(const route of routes)for(const kind of ['PROJECT','COMPANY'])test(route.name+' '+kind+' recovery joins a native Date source once and returns null without a receipt',async()=>{
 const t=await fixtureFor(route,kind),before=structuredClone(t.f.worker),audits=structuredClone([...t.f.audits]),s=sourceAdapter(t,route);assert.equal(await s.adapter.feedback(t.context,{recoverOnly:true}),null);assert.equal(s.seen.sourceReads,1);assert.equal(s.seen.recordedReads,1);assert.equal(s.seen.posts,0);assert.deepEqual(t.f.worker,before);assert.deepEqual([...t.f.audits],audits);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});

const invalidSources=[
 ['missing event',t=>{t.f.events.delete(t.context.eventId);}],
 ['foreign project',t=>{t.context.projectId='foreign-project';}],
 ['foreign channel',t=>{t.context.channelId='foreign-channel';}],
 ['inactive project',t=>{t.f.controls.projectActive=false;}],
 ['tenant credentials',t=>{t.f.connection.metadata.credentialOrganizationId='foreign-organization';}],
 ['payload digest',t=>{t.f.events.get(t.context.eventId).payload.payloadDigest='f'.repeat(64);}],
 ['provider',t=>{t.f.events.get(t.context.eventId).provider='other-provider';}],
 ['lease token',t=>{t.context.leaseToken=randomUUID();}],
 ['expired lease',t=>{t.f.events.get(t.context.eventId).leaseExpiresAt=new Date(t.f.now.getTime()-1);}],
 ['unsigned payload',t=>{t.f.events.get(t.context.eventId).payload.encryptedProof=null;},'META_CUSTOMER_EVENT_PROOF_REQUIRED'],
];
for(const route of routes)for(const [name,mutate,code]of invalidSources)test(route.name+' recovery denies '+name+' before reading a receipt',async()=>{
 const t=await fixtureFor(route);mutate(t);const before=structuredClone(t.f.worker),audits=structuredClone([...t.f.audits]),s=sourceAdapter(t,route);await assert.rejects(s.adapter.feedback(t.context,{recoverOnly:true}),{code:code||route.denied});assert.equal(s.seen.recordedReads,0);assert.equal(s.seen.posts,0);assert.deepEqual(t.f.worker,before);assert.deepEqual([...t.f.audits],audits);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});

for(const route of routes)for(const [name,mutateSource]of [['ambiguous rows',value=>({...value,rows:[...value.rows,...value.rows],rowCount:2})],['non-native clock',value=>({...value,rows:value.rows.map(row=>({...row,feedbackSourceNow:row.feedbackSourceNow.toISOString()}))})]])test(route.name+' recovery rejects '+name+' with no receipt or POST',async()=>{
 const t=await fixtureFor(route),before=structuredClone(t.f.worker),s=sourceAdapter(t,route,{mutateSource});await assert.rejects(s.adapter.feedback(t.context,{recoverOnly:true}),{code:route.denied});assert.equal(s.seen.recordedReads,0);assert.equal(s.seen.posts,0);assert.deepEqual(t.f.worker,before);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});

for(const route of routes)for(const fault of ['metadata binding','ambiguous receipt'])test(route.name+' recovery preserves strict '+fault+' checks',async()=>{
 const t=await fixtureFor(route);await t.adapter.feedback(t.context,route.prepare);if(fault==='metadata binding')t.f.audits.get(route.receipt(t.context.eventId)).metadata.payloadDigest='f'.repeat(64);const before=structuredClone(t.f.worker),audits=structuredClone([...t.f.audits]),s=sourceAdapter(t,route,{mutateRecorded:value=>fault==='ambiguous receipt'?{...value,rows:[...value.rows,...value.rows],rowCount:2}:value});await assert.rejects(s.adapter.feedback(t.context,{recoverOnly:true}),{code:route.denied});assert.equal(s.seen.posts,0);assert.deepEqual(t.f.worker,before);assert.deepEqual([...t.f.audits],audits);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});

for(const route of routes)for(const wait of ['recorded','full inspect'])test(route.name+' recovery cannot reuse its source clock after lease expires awaiting '+wait,async()=>{
 const t=await fixtureFor(route);await t.adapter.feedback(t.context,route.prepare);const before=structuredClone(t.f.worker),audits=structuredClone([...t.f.audits]),deadline=new Date(t.f.events.get(t.context.eventId).leaseExpiresAt).toISOString();let crossed=false;
 const s=sourceAdapter(t,route,{beforeSql:async sql=>{if(!crossed&&(wait==='recorded'?sql.includes("action='"+route.action+"'")&&sql.startsWith('SELECT'):sql.startsWith('SELECT id,"projectId",provider,"eventType"'))){await Promise.resolve();t.f.now.setTime(t.f.now.getTime()+61000);crossed=true;}}});
 const observed=await s.adapter.feedback(t.context,{recoverOnly:true});assert.equal(crossed,true);assert.equal(observed.reply,undefined);assert.equal(observed.replySent,false);assert.equal(observed.businessApplied,false);assert.equal(observed.replyState,route.denied);assert.equal(s.seen.posts,0);assert.equal(new Date(t.f.events.get(t.context.eventId).leaseExpiresAt).toISOString(),deadline);assert.ok(Date.parse(deadline)<t.f.now.getTime());assert.deepEqual(t.f.worker,before);assert.deepEqual([...t.f.audits],audits);assert.equal(t.requests.length,0);unchangedMedia(t.f);
});
