import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createParticipantStore} from '../src/lib/participant-store.mjs';
import {createParticipantHandlers,readParticipantKycBody} from '../src/lib/participant-http.mjs';
import {readPrivateKycBody} from '../src/lib/private-image-upload.mjs';
import {participantKycInput,PARTICIPANT_OCR_NOTICE_VERSION,PARTICIPANT_BIOMETRIC_NOTICE_VERSION} from '../src/lib/participant-policy.mjs';
import {PARTICIPANT_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256,participantKycImageSet} from '../src/lib/participant-kyc-image-set.mjs';
import {assertApprovedParticipantKyc} from '../src/lib/participant-approved-identity.mjs';
import {participantOnboardingNextStep,participantKycReviewImages,participantKycHistoricalReceipt} from '../src/app/(identity)/cuenta/participant-onboarding-next-step.mjs';
import {digest,WorkspaceError} from '../src/lib/workspace-policy.mjs';

// Synthetic signatures and in-memory SQL/Blob adapters only. No real document,
// database, account, credential, external provider or product write is used.
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const png=mark=>Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),Buffer.from(mark)]);
const pictures={front:png('synthetic-front'),selfie:png('synthetic-selfie'),back:png('synthetic-back')};
const backChoice={back:pictures.back.toString('base64'),backConsent:true,backNoticeVersion:PARTICIPANT_DOCUMENT_BACK_NOTICE_VERSION,backNoticeSha256:PARTICIPANT_DOCUMENT_BACK_NOTICE_SHA256};
const request=body=>new Request('https://obrasaas.com/api/identity/participants',{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:JSON.stringify(body)});
function fixture(){
 const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_Participant',organizationId:'org_Fixture',organizationRole:'org:member'};
 const member={actorId:'own-actor',clerkUserId:session.userId,membershipId:'own-membership',organizationId:'company-fixture',role:'AUDITOR'};
 const context={projectId:'project-fixture',scope:'a'.repeat(64)},audits=new Map(),blobs=new Map(),counts={upload:0,get:0,analyze:0,biometrics:0,writes:0,provider:0,sql:[],providerImages:[]};
 let revision=1,onGet=null,corrupt=false;
 const row={id:'worker-fixture',projectId:context.projectId,name:'Synthetic participant',active:true,revision:'2026-10-01T00:00:00.000001',metadata:{participant:{version:1,status:'ACTIVE',clerkUserId:session.userId,permissions:{attendance:false,report:false},kyc:{status:'NOT_SUBMITTED',images:[]}}}};
 const client={query:async(sql,args=[])=>{
  counts.sql.push(sql);
  if(sql.startsWith('SELECT pg_advisory'))return {rows:[]};
  if(sql==='SELECT clock_timestamp() AS now')return {rows:[{now:new Date('2026-10-07T12:00:00.000Z')}]};
  if(sql.startsWith('INSERT INTO public."AuditLog"')){assert.ok(!audits.has(args[0]));audits.set(args[0],{id:args[0],organizationId:args[1],actorId:args[2],entityType:args[3],entityId:args[4],metadata:JSON.parse(args[5])});return {rows:[]};}
  if(sql.startsWith('UPDATE public."Worker"')){row.metadata=JSON.parse(args[2]);row.revision='2026-10-01T00:00:00.'+String(++revision).padStart(6,'0');counts.writes++;return {rows:[]};}
  if(sql.includes('FROM public."AuditLog"')){
   const all=[...audits.values()];
   if(sql.includes("metadata->>'kind'='REVIEW_KYC'"))return {rows:all.filter(a=>a.actorId===args[1]&&a.metadata.kind==='REVIEW_KYC'&&a.metadata.submissionId===args[4]&&a.metadata.decision==='APPROVED')};
   if(sql.includes("metadata->>'kind'='KYC_SUBMITTED'")){const submission=sql.startsWith('SELECT metadata')?args[2]:args[4];return {rows:all.filter(a=>a.metadata.kind==='KYC_SUBMITTED'&&a.metadata.submissionId===submission)};}
   return {rows:audits.has(args[0])?[structuredClone(audits.get(args[0]))]:[]};
  }
  if(sql.includes('SELECT m.id FROM public."TenantMembership"'))return {rows:[{id:member.membershipId}]};
  if(sql.includes('FROM public."Worker"'))return {rows:[structuredClone(row)]};
  assert.fail('Unexpected synthetic SQL: '+sql);
 }};
 const workspace={projectOperation:async(active,input,_write,callback)=>{if(!active.authenticated||active.organizationId!==session.organizationId||input.projectId!==context.projectId||input.scope!==context.scope)throw new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409);return callback(client,member,context.scope);}};
 const store=createParticipantStore({workspace,upload:async(value,filename,type)=>{counts.upload++;const bytes=Buffer.from(value,'base64'),path='obrasaas/legacy-images/v1/'+digest(filename)+'/image.png',url='https://fixture.private.blob.vercel-storage.com/'+path;blobs.set(path,{bytes,type,url});return url;},get:async(path)=>{counts.get++;const blob=blobs.get(path);assert.ok(blob);onGet?.();return {statusCode:200,blob:{url:blob.url,size:blob.bytes.length,contentType:blob.type},stream:new Response(corrupt?png('corrupt'):blob.bytes).body};},analyzer:{analyzeDni:async input=>{counts.analyze++;counts.providerImages.push(Buffer.from(input.base64,'base64'));return {success:false,code:'AI_RESPONSE_UNCONFIRMED'};}},assessBiometrics:async input=>{counts.biometrics++;assert.deepEqual(Object.keys(input).sort(),['consentVersion','front','selfie']);assert.deepEqual(input.front.buffer,pictures.front);assert.deepEqual(input.selfie.buffer,pictures.selfie);return {success:false,code:'BIOMETRIC_RESULT_UNCONFIRMED'};}});
 const body=(back=true,extra={})=>({operationId:randomUUID(),...context,workerId:row.id,revision:row.revision,noticeVersion:PARTICIPANT_NOTICE_VERSION,consent:true,front:pictures.front.toString('base64'),selfie:pictures.selfie.toString('base64'),...(back?backChoice:{}),...extra});
 const manager=()=>{session.userId='user_Reviewer';member.actorId='reviewer-actor';member.clerkUserId=session.userId;member.role='DIRECTOR';};
 const command=action=>({operationId:randomUUID(),...context,action,payload:{workerId:row.id,revision:row.revision,submissionId:row.metadata.participant.kyc.submissionId,...(action==='REVIEW_KYC'?{decision:'APPROVED',reason:'Synthetic manual review of all images.'}:{})}});
 const handlers=createParticipantHandlers({verify:async()=>session,store});
 return {session,member,context,row,client,store,body,command,manager,audits,counts,handlers,setOnGet:fn=>{onGet=fn;},setCorrupt:()=>{corrupt=true;},download:imageId=>store.downloadKyc(session,{...context,workerId:row.id,imageId})};
}

test('old exact two-image IDs, content hash, request digest and replay are unchanged',async()=>{
 const f=fixture(),body=f.body(false),input=participantKycInput(body),saved=await f.store.submitKyc(f.session,body),k=f.row.metadata.participant.kyc,receipt=f.audits.get(saved.receiptId);
 assert.deepEqual(k.images.map(i=>[i.id,i.kind]),[['document-front','DOCUMENT_FRONT'],['selfie','SELFIE']]);assert.equal(k.documentBackConsent,undefined);
 assert.equal(k.contentHash,digest(k.images.map(i=>[i.kind,i.sha256,i.bytes,i.contentType])));
 assert.equal(receipt.metadata.requestDigest,digest([input.projectId,input.scope,input.workerId,input.revision,input.noticeVersion,input.front.digest,input.selfie.digest]));assert.equal(receipt.metadata.documentBackConsentRecorded,undefined);
 assert.equal((await f.store.submitKyc(f.session,body)).replayed,true);assert.equal(f.counts.upload,2);assert.equal(f.counts.writes,1);assert.equal(saved.participant.kyc.documentBackConsent,undefined);
});
test('three images pin independent consent, private receipt and digest without granting identity or permissions',async()=>{
 const f=fixture(),body=f.body(),saved=await f.store.submitKyc(f.session,body),k=f.row.metadata.participant.kyc,receipt=f.audits.get(saved.receiptId);
 assert.equal(f.counts.upload,3);assert.equal(participantKycImageSet(k,{receipt:receipt.metadata}),true);assert.deepEqual(k.images.map(i=>i.id),['document-front','selfie','document-back']);assert.equal(k.documentBackConsent.recordedAt,k.submittedAt);assert.equal(k.status,'PENDING_REVIEW');assert.equal(saved.participant.identityCertified,false);assert.equal(saved.participant.whatsAppAccessGranted,false);assert.deepEqual(f.row.metadata.participant.permissions,{attendance:false,report:false});
 assert.equal(saved.participant.kyc.documentBackConsent.allowed,true);assert.doesNotMatch(JSON.stringify([saved,[...f.audits.values()]]),/\.private\.blob|synthetic-back|data:image|base64/);
 assert.equal((await f.store.submitKyc(f.session,body)).replayed,true);assert.equal(f.counts.upload,3);assert.equal(f.counts.writes,1);
 await assert.rejects(f.store.submitKyc(f.session,{...body,back:png('changed-back').toString('base64')}),{code:'PARTICIPANT_OPERATION_CONFLICT'});assert.equal(f.counts.upload,3);
});
for(const field of Object.keys(backChoice))test('partial back input never writes: missing '+field,async()=>{
 const f=fixture(),body=f.body();delete body[field];await assert.rejects(f.store.submitKyc(f.session,body));assert.equal(f.counts.upload,0);assert.equal(f.counts.writes,0);
});
for(const extra of [{backConsent:false},{backNoticeVersion:'participant-kyc-v1'},{backNoticeSha256:'a'.repeat(64)},{back:'data:image/jpeg;base64,'+pictures.back.toString('base64')},{autoApprove:true}])test('back opt-in rejects substituted consent or image '+JSON.stringify(Object.keys(extra)),async()=>{
 const f=fixture();await assert.rejects(f.store.submitKyc(f.session,f.body(true,extra)));assert.equal(f.counts.upload,0);assert.equal(f.counts.provider,0);
});
test('three prepared 1 MiB images fit only the fully valid participant opt-in envelope',async()=>{
 const f=fixture(),large=Buffer.alloc(1024*1024);pictures.front.copy(large);const encoded=large.toString('base64'),body={...f.body(),front:encoded,selfie:encoded,back:encoded};assert.ok(Buffer.byteLength(JSON.stringify(body))>4*1024*1024);
 assert.deepEqual(await readParticipantKycBody(request(body)),body);await assert.rejects(readPrivateKycBody(request(body)),{code:'PRIVATE_IMAGE_TOO_LARGE'});
 for(const mutate of [b=>delete b.backConsent,b=>b.backConsent=false,b=>b.backNoticeSha256='0'.repeat(64),b=>b.back='A'.repeat(encoded.length),b=>b.action='REVIEW_KYC',b=>b.consent=false,b=>b.ocrConsent=true]){const invalid=structuredClone(body);mutate(invalid);await assert.rejects(readParticipantKycBody(request(invalid)),{code:'PRIVATE_IMAGE_TOO_LARGE'});}
});
test('large administrative and old two-image bodies keep 4 MiB; expanded ceiling remains bounded',async()=>{
 const f=fixture(),legacy=f.body(false),large=Buffer.alloc(2*1024*1024);pictures.front.copy(large);legacy.front=large.toString('base64');legacy.selfie=legacy.front;
 await assert.rejects(readParticipantKycBody(request(legacy)),{code:'PRIVATE_IMAGE_TOO_LARGE'});
 await assert.rejects(readParticipantKycBody(request({...f.command('REVIEW_KYC'),padding:'x'.repeat(4*1024*1024)})),{code:'PRIVATE_IMAGE_TOO_LARGE'});
 await assert.rejects(readParticipantKycBody(request({...f.body(),padding:'x'.repeat(9*1024*1024)})),{code:'PRIVATE_IMAGE_TOO_LARGE'});
 const response=await f.handlers.POST(request({...legacy,backConsent:true}));assert.equal(response.status,413);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(f.counts.upload,0);
});
for(const mode of ['consent','version','hash','timestamp','image-id','image-kind','duplicate','missing','bytes','digest','public-url','port','receipt','receipt-project','receipt-notice','channel'])test('strict back evidence refuses '+mode+' before download or review',async()=>{
 const f=fixture(),saved=await f.store.submitKyc(f.session,f.body()),k=f.row.metadata.participant.kyc,c=k.documentBackConsent;
 if(mode==='consent')c.allowed=false;if(mode==='version')c.noticeVersion='old';if(mode==='hash')c.noticeSha256='0'.repeat(64);if(mode==='timestamp')c.recordedAt='2026-10-07T11:59:59.000Z';if(mode==='image-id')k.images[2].id='arbitrary';if(mode==='image-kind')k.images[2].kind='DOCUMENT_FRONT';if(mode==='duplicate')k.images[2]=structuredClone(k.images[0]);if(mode==='missing')k.images.pop();if(mode==='bytes')k.images[2].bytes=3*1024*1024;if(mode==='digest')k.contentHash='0'.repeat(64);if(mode==='public-url')k.images[2].url=k.images[2].url.replace('.private.','.public.');if(mode==='port')k.images[2].url=k.images[2].url.replace('.com/', '.com:8443/');if(mode==='receipt')delete f.audits.get(saved.receiptId).metadata.documentBackConsentRecorded;if(mode==='receipt-project')f.audits.get(saved.receiptId).metadata.projectId='project-other';if(mode==='receipt-notice')f.audits.get(saved.receiptId).metadata.noticeVersion='old';if(mode==='channel')k.channelCapture={kind:'META_KYC_CHAT'};
 await assert.rejects(f.download('document-back'),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(f.counts.get,0);f.manager();await assert.rejects(f.store.save(f.session,f.command('REVIEW_KYC')),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(k.status,'PENDING_REVIEW');
});
test('authorized back download verifies bytes and rechecks consent after storage I/O',async()=>{
 const f=fixture();await f.store.submitKyc(f.session,f.body());assert.deepEqual((await f.download('document-back')).bytes,pictures.back);f.setOnGet(()=>{f.row.metadata.participant.kyc.documentBackConsent.allowed=false;});await assert.rejects(f.download('document-back'),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});
});
test('back download rejects corrupt bytes and revoked own participation',async()=>{
 const f=fixture();await f.store.submitKyc(f.session,f.body());f.setCorrupt();await assert.rejects(f.download('document-back'),{code:'PARTICIPANT_KYC_INTEGRITY'});f.row.metadata.participant.status='REVOKED';const before=f.counts.get;await assert.rejects(f.download('document-back'),{code:'PARTICIPANT_ACCESS_REQUIRED'});assert.equal(f.counts.get,before);
});
test('manual three-image review and approved identity require separate human and original submission proof',async()=>{
 const f=fixture(),saved=await f.store.submitKyc(f.session,f.body()),own={...f.member};f.manager();await f.store.save(f.session,f.command('REVIEW_KYC'));assert.equal(f.row.metadata.participant.kyc.status,'APPROVED');assert.equal((await assertApprovedParticipantKyc(f.client,f.row,own)).status,'ACTIVE');delete f.audits.get(saved.receiptId).metadata.documentBackNoticeSha256;await assert.rejects(assertApprovedParticipantKyc(f.client,f.row,own),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});assert.equal(f.counts.analyze,0);assert.equal(f.counts.biometrics,0);
});
test('optional OCR and biometric adapters consume the original front and selfie only',async()=>{
 const f=fixture();await f.store.submitKyc(f.session,f.body(true,{ocrConsent:true,ocrNoticeVersion:PARTICIPANT_OCR_NOTICE_VERSION,biometricConsent:true,biometricNoticeVersion:PARTICIPANT_BIOMETRIC_NOTICE_VERSION}));f.manager();await f.store.save(f.session,f.command('PROCESS_KYC'));assert.equal(f.counts.get,2);assert.equal(f.counts.analyze,1);assert.equal(f.counts.biometrics,1);assert.deepEqual(f.counts.providerImages,[pictures.front]);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');assert.equal(f.counts.provider,0);
});
test('public next step exposes human review for two or three images and rejects a malformed back set',async()=>{
 const f=fixture(),saved=await f.store.submitKyc(f.session,f.body()),row={...saved.participant,self:false};
 const input={context:{...f.context,verified:true,now:Date.now()},snapshot:{...f.context,canManage:true,canInvite:true,records:[row]},workerId:row.id};
 assert.equal(participantKycReviewImages(row.kyc),true);assert.equal(participantOnboardingNextStep(input).primary.action,'REVIEW_KYC');row.kyc.images[2].kind='SELFIE';assert.equal(participantKycReviewImages(row.kyc),false);assert.equal(participantOnboardingNextStep(input).primary.action,'CONSULT_PARTICIPANTS');delete row.kyc.documentBackConsent;row.kyc.images=row.kyc.images.slice(0,2);assert.equal(participantOnboardingNextStep(input).primary.action,'REVIEW_KYC');
});

test('back receipt GET refuses a missing consent flag and never reports an incomplete presentation as saved',async()=>{
 const f=fixture(),body=f.body(),saved=await f.store.submitKyc(f.session,body),url='https://obrasaas.com/api/identity/participants?'+new URLSearchParams({...f.context,operationId:body.operationId});
 const valid=await f.handlers.GET(new Request(url));assert.equal(valid.status,200);assert.equal((await valid.json()).state,'RECORDED');
 delete f.audits.get(saved.receiptId).metadata.documentBackConsentRecorded;
 const incomplete=await f.handlers.GET(new Request(url));assert.equal(incomplete.status,409);const value=await incomplete.json();assert.equal(value.saved,false);assert.equal(value.code,'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED');assert.match(incomplete.headers.get('cache-control'),/no-store/);assert.equal(f.counts.upload,3);assert.equal(f.counts.writes,1);
 await assert.rejects(f.store.submitKyc(f.session,body),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});
});
test('current back receipt rejects a mismatched content hash through GET and exact POST replay',async()=>{
 const f=fixture(),body=f.body(),saved=await f.store.submitKyc(f.session,body);f.audits.get(saved.receiptId).metadata.contentHash='0'.repeat(64);
 const url='https://obrasaas.com/api/identity/participants?'+new URLSearchParams({...f.context,operationId:body.operationId}),response=await f.handlers.GET(new Request(url));assert.equal(response.status,409);const value=await response.json();assert.equal(value.saved,false);assert.equal(value.code,'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED');await assert.rejects(f.store.submitKyc(f.session,body),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(f.counts.upload,3);assert.equal(f.counts.writes,1);
});
test('a back receipt cannot fall back to legacy authorization after its third image and consent disappear',async()=>{
 const f=fixture(),body=f.body(),saved=await f.store.submitKyc(f.session,body),own={...f.member};f.manager();await f.store.save(f.session,f.command('REVIEW_KYC'));const k=f.row.metadata.participant.kyc;k.images.pop();delete k.documentBackConsent;
 assert.equal(participantKycImageSet(k,{receipt:f.audits.get(saved.receiptId).metadata}),false);
 await assert.rejects(assertApprovedParticipantKyc(f.client,f.row,own),{code:'PARTICIPANT_KYC_REVIEW_REQUIRED'});
 f.session.userId=own.clerkUserId;Object.assign(f.member,own);await assert.rejects(f.store.status(f.session,{...f.context,operationId:body.operationId}),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});await assert.rejects(f.store.submitKyc(f.session,body),{code:'PARTICIPANT_KYC_EVIDENCE_UNCONFIRMED'});assert.equal(f.counts.upload,3);
});

async function supersededFixture(oldBack,newBack){
 const f=fixture(),own={...f.member},body=f.body(oldBack),first=await f.store.submitKyc(f.session,body);
 f.manager();const review=f.command('REVIEW_KYC');review.payload.decision='REJECTED';await f.store.save(f.session,review);f.session.userId=own.clerkUserId;Object.assign(f.member,own);
 const nextBody=f.body(newBack),second=await f.store.submitKyc(f.session,nextBody);return {f,body,first,nextBody,second};
}
for(const [oldBack,newBack] of [[true,false],[false,true]])test('historical '+(oldBack?'three':'two')+' image receipt recovers after a rejected presentation is superseded by '+(newBack?'three':'two')+' images',async()=>{
 const {f,body,first,second}=await supersededFixture(oldBack,newBack),uploads=f.counts.upload,writes=f.counts.writes,current=f.row.metadata.participant.kyc.submissionId;
 const status=await f.store.status(f.session,{...f.context,operationId:body.operationId}),replay=await f.store.submitKyc(f.session,body);
 for(const value of [status,replay]){assert.equal(value.saved,true);assert.equal(value.receiptId,first.receiptId);assert.equal(value.participant.kyc.submissionId,current);assert.equal(value.participant.kyc.status,'PENDING_REVIEW');assert.equal(value.participant.identityCertified,false);assert.equal(value.participant.whatsAppAccessGranted,false);assert.deepEqual(value.participant.permissions,{attendance:false,report:false});}
 assert.equal(status.state,'RECORDED');assert.equal(replay.replayed,true);assert.notEqual(first.receiptId,second.receiptId);assert.equal(f.counts.upload,uploads);assert.equal(f.counts.writes,writes);
 if(oldBack){assert.equal(participantKycHistoricalReceipt(status,body),true);assert.equal(status.kycSubmissionReceipt.submissionId,first.participant.kyc.submissionId);assert.equal(status.kycSubmissionReceipt.superseded,true);for(const key of ['identityCertified','permissionsGranted','whatsAppAccessGranted'])assert.equal(status.kycSubmissionReceipt[key],false);assert.doesNotMatch(JSON.stringify(status.kycSubmissionReceipt),/contentHash|requestDigest|\.private\.blob|data:image/);}
 else assert.equal(status.kycSubmissionReceipt,undefined);
});
test('historical document-back receipt still rejects missing consent and a mismatched original digest',async()=>{
 for(const mode of ['missing-flag','wrong-notice','wrong-project','wrong-digest']){
  const {f,body,first}=await supersededFixture(true,false),receipt=f.audits.get(first.receiptId).metadata;
  if(mode==='missing-flag')delete receipt.documentBackConsentRecorded;if(mode==='wrong-notice')receipt.documentBackNoticeSha256='0'.repeat(64);if(mode==='wrong-project')receipt.projectId='project-other';if(mode==='wrong-digest')receipt.contentHash='0'.repeat(64);
  await assert.rejects(f.store.submitKyc(f.session,body));if(mode!=='wrong-digest')await assert.rejects(f.store.status(f.session,{...f.context,operationId:body.operationId}));assert.equal(f.counts.upload,5);
 }
});
test('historical document-back receipt recovery requires current active own participation',async()=>{
 const {f,body}=await supersededFixture(true,false);f.row.metadata.participant.status='REVOKED';await assert.rejects(f.store.status(f.session,{...f.context,operationId:body.operationId}),{code:'PARTICIPANT_ACCESS_REQUIRED'});await assert.rejects(f.store.submitKyc(f.session,body),{code:'PARTICIPANT_ACCESS_REQUIRED'});assert.equal(f.counts.upload,5);assert.equal(f.counts.get,0);
});
test('historical browser ACK accepts only the exact no-grant receipt projection',async()=>{
 const {f,body}=await supersededFixture(true,false),status=await f.store.status(f.session,{...f.context,operationId:body.operationId});assert.equal(participantKycHistoricalReceipt(status,body),true);
 for(const mutate of [r=>r.superseded=false,r=>r.permissionsGranted=true,r=>r.identityCertified=true,r=>r.whatsAppAccessGranted=true,r=>r.documentBackConsentRecorded=false,r=>r.documentBackNoticeSha256='0'.repeat(64),r=>r.receiptId='different',r=>r.extra='unknown']){const wrong=structuredClone(status);mutate(wrong.kycSubmissionReceipt);assert.equal(participantKycHistoricalReceipt(wrong,body),false);}
});
