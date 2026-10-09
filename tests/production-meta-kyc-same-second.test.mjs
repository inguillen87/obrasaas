import test from 'node:test';
import assert from 'node:assert/strict';
import {companyKycMemoryFixture} from './fixtures/company-kyc-memory.mjs';
import {kycMemoryFixture} from './fixtures/meta-kyc-chat-memory.mjs';

const text=body=>({type:'text',text:{body}});
const at=(message,timestamp)=>({...message,timestamp:String(timestamp)});
function choice(f,title){
 const state=f.state(),index=state.choices.findIndex(row=>row.title===title);
 assert.ok(index>=0,'The current conversation must offer '+title);
 return {type:'interactive',interactive:{list_reply:{id:'kyc:'+state.nonce+':'+index}}};
}
function stable(f){return {worker:structuredClone(f.worker.metadata),audits:structuredClone([...f.audits]),outbounds:structuredClone([...f.outbounds]),puts:f.blob.puts(),sends:f.controls.sends,graph:f.control?.graph||0,cdn:f.control?.cdn||0};}

test('same-second corporate schema2 replies follow their exact confirmed prompts through one private submission',async()=>{
 const f=await companyKycMemoryFixture({captureImageSetVersion:2}),timestamp=Math.floor(f.now.getTime()/1000);
 await f.execute(at(text(f.code),timestamp));
 for(const title of ['Autorizar imágenes','Autorizar dorso','Sin lectura asistida','Sin comparación facial'])await f.execute(at(choice(f,title),timestamp));
 for(const expected of ['FRONT','BACK','SELFIE']){
  assert.equal(f.state().step,expected);
  await f.execute(at({type:'image',image:{id:'150000011',mime_type:'image/png'}},timestamp));
 }
 const final=await f.execute(at(choice(f,'Guardar identidad'),timestamp));
 assert.equal(final.result.kind,'KYC_CHAT');assert.equal(final.result.businessApplied,true);
 assert.equal(f.worker.metadata.participant.kyc.status,'PENDING_ACCOUNT_CLAIM');
 assert.equal(f.worker.metadata.participant.status,'INVITED');
 assert.equal(f.worker.metadata.participant.channelIdentity,undefined);
 assert.equal(f.blob.puts(),3);assert.equal(f.controls.sends,9);
 const submissions=[...f.audits.values()].filter(row=>row.metadata.kind==='KYC_SUBMITTED');assert.equal(submissions.length,1);
 const projections=[...f.audits.values()].filter(row=>row.action==='participant.kyc_chat.projected');
 assert.equal(projections.length,9);assert.ok(projections.every(row=>row.metadata.anchorProjectId===f.anchor.id&&row.metadata.targetProjectId===f.target.id&&row.metadata.workerId===f.worker.id));
 const before=stable(f);await f.bridge.execute(final.context);await f.outbound.send(final.context,final.result.reply);assert.deepEqual(stable(f),before);
});

for(const [name,options,mutate,code] of [
 ['absent reply context',{contextId:null},()=>{},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['foreign reply context',{contextId:'wamid.ForeignPrompt'},()=>{},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['SEND_UNKNOWN prompt',{},f=>{[...f.outbounds.values()].at(-1).outcome.state='SEND_UNKNOWN';},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['failed prompt',{},f=>{[...f.outbounds.values()].at(-1).outcome.providerStatus='failed';},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['stale choice nonce',{},()=>{},'META_KYC_COMPANY_CONTEXT_REQUIRED'],
 ['earlier timestamp',{},()=>{},'META_KYC_MESSAGE_OUT_OF_ORDER'],
 ['revoked issuer',{},f=>{f.controls.issuerActive=false;},'META_KYC_CHALLENGE_REVOKED'],
 ['revoked assignment',{},f=>{f.control.assignment=false;},'META_KYC_CHALLENGE_REJECTED'],
 ['suspended owner',{},f=>{f.owner.mode='SUSPENDED';},'META_KYC_COMPANY_AUTHORITY_CHANGED'],
 ['changed grant',{},f=>{f.connection.metadata.customerVerification.scopes=[];},'META_KYC_COMPANY_AUTHORITY_CHANGED']
])test('same-second capture keeps authority closed for '+name,async()=>{
 const f=await companyKycMemoryFixture(),timestamp=Math.floor(f.now.getTime()/1000);
 await f.execute(at(text(f.code),timestamp));
 const message=choice(f,'Autorizar imágenes');if(name==='stale choice nonce')message.interactive.list_reply.id='kyc:'+'f'.repeat(20)+':0';
 const context=f.receive(at(message,name==='earlier timestamp'?timestamp-1:timestamp),options);mutate(f);const before=stable(f);
 await assert.rejects(f.bridge.execute(context),{code});assert.deepEqual(stable(f),before);
});

test('an older confirmed prompt cannot advance the current same-second conversation even with its current nonce',async()=>{
 const f=await companyKycMemoryFixture(),timestamp=Math.floor(f.now.getTime()/1000);
 await f.execute(at(text(f.code),timestamp));const oldPrompt=[...f.outbounds.values()].at(-1).outcome.messageId;
 await f.execute(at(choice(f,'Autorizar imágenes'),timestamp));assert.equal(f.state().step,'OCR');
 const context=f.receive(at(choice(f,'Sin lectura asistida'),timestamp),{contextId:oldPrompt}),before=stable(f);
 await assert.rejects(f.bridge.execute(context),{code:'META_KYC_MESSAGE_OUT_OF_ORDER'});assert.deepEqual(stable(f),before);
});

test('same-second acceptance does not revive an old dispatch after a newer prompt or duplicate a provider send',async()=>{
 const f=await companyKycMemoryFixture(),timestamp=Math.floor(f.now.getTime()/1000);
 const first=await f.execute(at(text(f.code),timestamp));await f.execute(at(choice(f,'Autorizar imágenes'),timestamp));const before=stable(f);
 assert.deepEqual(await f.bridge.execute(first.context),first.result);
 await assert.rejects(f.outbound.send(first.context,first.result.reply),{code:'META_KYC_MESSAGE_OUT_OF_ORDER'});assert.deepEqual(stable(f),before);
});

test('same-second ACTIVE capture still requires its own current membership and project assignment',async()=>{
 for(const revoked of [null,'membership','assignment']){
  const f=await companyKycMemoryFixture({active:true}),timestamp=Math.floor(f.now.getTime()/1000);
  await f.execute(at(text(f.code),timestamp));
  const context=f.receive(at(choice(f,'Autorizar imágenes'),timestamp));
  if(revoked==='membership')f.controls.workerMembershipActive=false;
  if(revoked==='assignment')f.controls.projectAssignmentActive=false;
  const before=stable(f);
  if(revoked){await assert.rejects(f.bridge.execute(context),{code:'META_KYC_CHALLENGE_REVOKED'});assert.deepEqual(stable(f),before);}
  else{assert.equal((await f.bridge.execute(context)).kind,'KYC_CHAT');assert.equal(f.state().step,'OCR');assert.equal(f.worker.metadata.participant.clerkUserId,f.member.clerkUserId);assert.equal(f.blob.puts(),0);}
 }
});

test('legacy KYC without a canonical confirmed reply binding still rejects same-second advancement',async()=>{
 const f=kycMemoryFixture(),timestamp=Math.floor(f.now.getTime()/1000);
 await f.execute(at(text(f.code),timestamp));const context=f.receive(at(choice(f,'Autorizar imágenes'),timestamp)),before=stable(f);
 await assert.rejects(f.bridge.execute(context),{code:'META_KYC_MESSAGE_OUT_OF_ORDER'});assert.deepEqual(stable(f),before);
});
