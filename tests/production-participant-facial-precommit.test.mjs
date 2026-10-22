import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {WorkspaceError,digest} from '../src/lib/workspace-policy.mjs';
import {preanalysisMemoryFixture} from './fixtures/participant-preanalysis-memory.mjs';
import {syntheticCaptureQuality} from './fixtures/capture-quality-synthetic.mjs';
import {createFakeAuditSql} from './fixtures/participant-facial-audit-memory.mjs';
import {createPrivateBiometricAnalyzer} from '../src/lib/private-biometric-analyzer.mjs';
import {createParticipantFacialPrecommitCoordinator} from '../src/lib/participant-facial-precommit.mjs';
import {createParticipantFacialAttempts} from '../src/lib/participant-facial-attempt.mjs';
import {facialAttemptId,facialBindingDigest,facialPairKey,facialReceiptId,FACIAL_NOTICE_VERSION,FACIAL_NOTICE_SHA256,FACIAL_MODEL_MANIFEST_SHA256} from '../src/lib/participant-facial-policy.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const rawPictures=[picture,Buffer.concat([picture,Buffer.from('synthetic-selfie')])];
const advisory=body=>({success:true,status:'ADVISORY_UNREVIEWED',faceSimilarity:-1,captureRiskSignal:1,identityCertified:false,livenessVerified:false,documentAuthenticityVerified:false,measurementCalibrated:false,requiresHumanReview:true,provider:'private-opencv-onnx',modelManifestSha256:FACIAL_MODEL_MANIFEST_SHA256,frontSha256:body.front.sha256,selfieSha256:body.selfie.sha256});
async function fixture({mode='ASSISTED',ocr=false,quality,transport,allowOtherTransactions=false,configured=true}={}){
 const template=preanalysisMemoryFixture({ocr,biometric:false}),db=createFakeAuditSql(),worker=structuredClone(template.row),context={actorId:'actor-synthetic',organizationId:'company-synthetic',projectId:'project-synthetic',workerId:'worker-synthetic',revision:'2026-10-22T00:00:00.000001',operationId:randomUUID(),sourceAuthoritySha256:'a'.repeat(64)},security={active:true,actorId:context.actorId,organizationId:context.organizationId,revision:context.revision,canSubmitKyc:true},calls={quality:0,model:0,put:0};worker.metadata.participant.kyc={version:1,status:'NOT_SUBMITTED'};db.workers.set(worker.id,worker);
 const images=rawPictures.map((bytes,i)=>({kind:i?'SELFIE':'DOCUMENT_FRONT',image:{bytes:Buffer.from(bytes),contentType:'image/png',digest:sha(bytes)}}));
 const runner=async({requireSource},fn)=>{const client=await db.connect();try{await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');if(!security.active||security.actorId!==context.actorId||security.organizationId!==context.organizationId)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['canonical-worker:'+context.workerId]);const result=await fn(client,{...context,...security,requireSource});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}};
 const analyzer=createPrivateBiometricAnalyzer({environment:configured?{OBRASAAS_BIOMETRIC_SERVICE_KEY:'7'.repeat(64)}:{},clock:()=>1791248000000,nonce:()=>'a'.repeat(32),timeoutMs:50,fetchImpl:async(_url,request)=>{calls.model++;if(!allowOtherTransactions)assert.equal(db.active,0);const body=JSON.parse(request.body);if(transport)return transport({body,db,calls,security});return Response.json(advisory(body));}});
 const coordinator=createParticipantFacialPrecommitCoordinator({assessCaptureQuality:async input=>{calls.quality++;if(!allowOtherTransactions)assert.equal(db.active,0);if(quality)return quality(input,{calls,security});return syntheticCaptureQuality(input);},assessBiometrics:analyzer.analyzeBiometricPair,leaseMs:1000});
 const request={context,images,biometricMode:mode,biometricConsent:{allowed:mode==='ASSISTED',noticeVersion:FACIAL_NOTICE_VERSION,noticeSha256:FACIAL_NOTICE_SHA256},withAuthority:runner,beforeAssess:async()=>{if(!security.active)throw new WorkspaceError('PARTICIPANT_ACCESS_REQUIRED',403);}};
 const binding=()=>({version:1,mode:request.biometricMode,context:structuredClone(request.context),biometricConsent:structuredClone(request.biometricConsent),images:request.images.map(p=>({kind:p.kind,sha256:p.image.digest,bytes:p.image.bytes.length,mimeType:p.image.contentType})),modelManifestSha256:FACIAL_MODEL_MANIFEST_SHA256});
 async function prepare(){return coordinator.prepareCapture(request);}
 async function save(prepared,{omitWorker=false,alterReceipt=false,expire=false,failAfterWorker=false}={}){
  for(const capture of prepared.captureSet){await coordinator.fencePersistence(prepared.facialTicket);assert.equal(db.active,0);calls.put++;assert.equal(sha(capture.image.bytes),capture.image.digest);}
  const k=structuredClone(template.row.metadata.participant.kyc);k.biometricConsent={...request.biometricConsent,recordedAt:k.submittedAt};k.captureQuality=prepared.captureQuality;
  return runner({requireSource:true},async(client,currentContext)=>coordinator.commit(client,prepared.facialTicket,{currentContext,write:async({adoptKyc,facialPrecommit})=>{
   const sourceReceiptId=facialReceiptId(binding()),provenance={organizationId:context.organizationId,projectId:context.projectId,workerId:context.workerId,sourceActorId:context.actorId,sourceReceiptId};adoptKyc(k,provenance);
   if(!omitWorker)await client.query('UPDATE public."Worker" SET metadata=$3::jsonb WHERE id=$1 AND "projectId"=$2',[context.workerId,context.projectId,JSON.stringify({...worker.metadata,participant:{...worker.metadata.participant,kyc:k}})]);
   if(failAfterWorker)throw new WorkspaceError('SYNTHETIC_CALLBACK_FAILURE',409);
   const details={...structuredClone(template.receipt.metadata),biometricConsentRecorded:request.biometricConsent.allowed,biometricNoticeVersion:FACIAL_NOTICE_VERSION,biometricNoticeSha256:FACIAL_NOTICE_SHA256,facialPrecommit,status:k.status};if(alterReceipt)details.facialPrecommit.bindingSha256='f'.repeat(64);
   await client.query('INSERT INTO public."AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES($1,$2,$3,$4,\'Worker\',$5,$6::jsonb)',[sourceReceiptId,context.organizationId,context.actorId,'participant.operation.recorded',context.workerId,JSON.stringify(details)]);if(expire)db.at+=1001;return{saved:true,receiptId:sourceReceiptId};
  }}));
 }
 return{db,context,security,calls,request,coordinator,binding,template,prepare,save,row:()=>db.rows.get(facialAttemptId(binding()))};
}
test('ASSISTED quality completes for the whole set before pair, then atomic Worker/receipt/attempt adoption',async()=>{
 const f=await fixture(),p=await f.prepare();assert.equal(f.calls.quality,2);assert.equal(f.calls.model,1);assert.equal(f.calls.put,0);assert.equal(f.row().metadata.state,'READY');const r=await f.save(p);assert.equal(r.saved,true);assert.equal(f.row().metadata.state,'COMMITTED');const k=f.db.workers.get(f.context.workerId).metadata.participant.kyc;assert.equal(k.processing.stages.biometric.state,'COMPLETE');assert.equal(k.processing.status,'ADVISORY_UNREVIEWED');assert.equal(k.processing.biometrics.faceSimilarity,-1);assert.equal(k.facialPrecommit.timing,'BEFORE_PERSISTENCE');assert.equal(k.status,'PENDING_REVIEW');assert.equal(f.calls.put,2);assert.equal(f.db.active,0);assert.doesNotMatch(JSON.stringify([...f.db.rows.values()]),/faceSimilarity|captureRiskSignal|base64|"data"|embedding/);
});
test('the last quality rejection has no paired dispatch and no Blob intent',async()=>{
 const f=await fixture({quality:async(input,{calls})=>{const result=await syntheticCaptureQuality(input);return calls.quality===2?{...result,state:'RETAKE_REQUIRED',reasonCodes:['IMAGE_BLURRED']}:result;}});await assert.rejects(f.prepare(),{code:'PARTICIPANT_CAPTURE_SELFIE_IMAGE_BLURRED'});assert.equal(f.calls.model,0);assert.equal(f.calls.put,0);assert.equal(f.row().metadata.state,'REJECTED');assert.equal(f.row().metadata.persistenceStartedAt,null);
});
test('explicit MANUAL completes quality and saves NOT_REQUESTED without any pair inference',async()=>{
 const f=await fixture({mode:'MANUAL'}),p=await f.prepare();await f.save(p);const k=f.db.workers.get(f.context.workerId).metadata.participant.kyc;assert.equal(f.calls.model,0);assert.equal(k.processing.stages.biometric.state,'NOT_AUTHORIZED');assert.equal(k.processing.status,'SKIPPED_CONSENT');assert.equal(k.facialPrecommit.modelState,'NOT_REQUESTED');assert.equal(k.facialPrecommit.modelResultSha256,null);assert.equal(k.processing.biometrics,undefined);
});
test('v3 mode or consent cannot be omitted or implicitly translated to manual',async()=>{
 for(const change of [r=>{r.biometricMode=null;},r=>{r.biometricMode='MANUAL';},r=>{r.biometricConsent.noticeSha256='f'.repeat(64);}]){const f=await fixture();change(f.request);await assert.rejects(f.prepare());assert.equal(f.calls.model,0);assert.equal(f.calls.put,0);assert.equal(f.db.rows.size,0);}
});
test('legacy mode has no facial journal and keeps the one quality gate',async()=>{
 const f=await fixture();f.request.biometricMode=null;f.request.biometricConsent=null;const p=await f.prepare();assert.equal(p.facialTicket,null);assert.equal(f.calls.quality,2);assert.equal(f.calls.model,0);assert.equal(f.db.rows.size,0);
});
test('caller and owned image mutations are fenced before Blob',async()=>{
 for(const owned of [false,true]){const f=await fixture(),p=await f.prepare();(owned?p.captureSet:f.request.images)[0].image.bytes[0]^=1;await assert.rejects(f.coordinator.fencePersistence(p.facialTicket),{code:'PARTICIPANT_KYC_INTEGRITY'});assert.equal(f.calls.put,0);assert.equal(f.row().metadata.state,'READY');}
});
test('revocation or source change after model prevents the persistence intent',async()=>{
 for(const revoked of [false,true]){const f=await fixture(),p=await f.prepare();if(revoked)f.security.active=false;else f.security.revision+='changed';await assert.rejects(f.coordinator.fencePersistence(p.facialTicket));assert.equal(f.row().metadata.state,'READY');assert.equal(f.calls.put,0);}
});
for(const fault of ['omitWorker','alterReceipt','expire','failAfterWorker'])test('atomic commit rolls back Worker and KYC receipt for '+fault,async()=>{
 const f=await fixture(),p=await f.prepare(),before=structuredClone(f.db.workers.get(f.context.workerId));await assert.rejects(f.save(p,{[fault]:true}));assert.deepEqual(f.db.workers.get(f.context.workerId),before);assert.equal(f.db.rows.has(facialReceiptId(f.binding())),false);assert.equal(f.row().metadata.state,'PERSISTING');
});
test('commit replay skips old revision but continues to require the current principal',async()=>{
 const f=await fixture(),p=await f.prepare(),saved=await f.save(p);f.security.revision+='owncommit';await f.request.withAuthority({requireSource:false},async(client,currentContext)=>{await f.coordinator.reconcileReplay(client,p.facialTicket,{currentContext,receiptId:saved.receiptId});const verified=await f.coordinator.verifyCommittedReceipt(client,{storedContext:f.context,currentContext,receiptId:saved.receiptId});assert.equal(verified.receiptId,saved.receiptId);});assert.equal(f.calls.model,1);f.security.active=false;await assert.rejects(f.coordinator.status({context:f.context,withAuthority:f.request.withAuthority}),{code:'PARTICIPANT_ACCESS_REQUIRED'});
});
test('unknown model does not persist, blocks a new UUID, then explicit MANUAL tombstones the old attempt',async()=>{
 const f=await fixture({transport:async()=>{throw Error('synthetic timeout');}}),old=structuredClone(f.request.context);await assert.rejects(f.prepare(),{code:'PARTICIPANT_FACIAL_RESULT_UNCONFIRMED'});assert.equal(f.row().metadata.state,'MODEL_UNKNOWN');assert.equal(f.calls.put,0);const oldRow=f.row(),oldLease=oldRow.metadata.leaseId;f.request.context.operationId=randomUUID();await assert.rejects(f.prepare(),{code:'PARTICIPANT_FACIAL_RESULT_PENDING'});assert.equal(f.calls.model,1);f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=old.operationId;const p=await f.prepare();assert.equal(f.db.rows.get(oldRow.id).metadata.state,'CLOSED_MANUAL');assert.notEqual(f.db.rows.get(oldRow.id).metadata.leaseId,oldLease);assert.equal(f.calls.model,1);const status=await f.coordinator.status({context:old,withAuthority:f.request.withAuthority});assert.equal(status.phase,'CLOSED_MANUAL');assert.equal(status.closedReceiptId,oldRow.id);assert.equal(status.successorOperationId,f.request.context.operationId);await f.save(p);assert.equal(f.calls.model,1);assert.equal(f.calls.put,2);
});
test('PERSISTENCE_UNKNOWN closes atomically for manual and preserves possible private orphans',async()=>{
 const f=await fixture(),p=await f.prepare(),old=structuredClone(f.request.context),oldId=f.row().id;await f.coordinator.fencePersistence(p.facialTicket);f.calls.put++;await f.coordinator.unknown(p.facialTicket);assert.equal(f.row().metadata.state,'PERSISTENCE_UNKNOWN');f.request.context.operationId=randomUUID();f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=old.operationId;const next=await f.prepare();const status=await f.coordinator.status({context:old,withAuthority:f.request.withAuthority});assert.equal(status.privateObjectsMayExist,true);assert.equal(status.phase,'CLOSED_MANUAL');assert.equal(f.db.rows.get(oldId).metadata.orphanPrivateObjectsPossible,true);await assert.rejects(f.coordinator.fencePersistence(p.facialTicket),{code:'FACIAL_LEASE_CHANGED'});await f.save(next);assert.equal(f.calls.model,1);
});
test('manual resolution is rolled back if creating its successor fails',async()=>{
 const f=await fixture({transport:async()=>{throw Error();}}),old=structuredClone(f.request.context);await assert.rejects(f.prepare());const oldRow=structuredClone(f.row());f.request.context.operationId=randomUUID();f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=old.operationId;f.db.onQuery=sql=>{if(sql.startsWith('INSERT INTO public."AuditLog"'))throw new WorkspaceError('SYNTHETIC_INSERT_FAILURE',409);};await assert.rejects(f.prepare(),{code:'SYNTHETIC_INSERT_FAILURE'});assert.deepEqual(f.db.rows.get(oldRow.id),oldRow);assert.equal(f.db.rows.size,1);
});
test('read-only status uses no row locks or writes and does not pretend storage absence',async()=>{
 const f=await fixture(),p=await f.prepare();await f.coordinator.fencePersistence(p.facialTicket);f.db.at+=1001;const client=await f.db.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const start=f.db.statements.length,stored=await f.coordinator.lookup(client,f.context),status=await f.coordinator.statusInTransaction(client,{context:stored,currentContext:{...f.context,canSubmitKyc:true}});assert.equal(status.phase,'PERSISTENCE_UNKNOWN');assert.equal(status.privateObjectsMayExist,true);assert.equal(status.canContinueManual,true);assert.equal(f.db.statements.slice(start).some(r=>/FOR UPDATE|FOR SHARE|pg_advisory|UPDATE |INSERT /.test(r.sql)),false);await client.query('ROLLBACK');client.release();assert.equal(f.row().metadata.state,'PERSISTING');
});
async function transferToScheduler(f){const p=await f.prepare(),saved=await f.save(p),target=f.template;target.row.metadata=structuredClone(f.db.workers.get(f.context.workerId).metadata);target.audits.clear();for(const [key,value]of f.db.rows)target.audits.set(key,structuredClone(value));Object.assign(target.receipt,structuredClone(f.db.rows.get(saved.receiptId)));target.audits.set(target.receipt.id,target.receipt);return target;}
for(const ocr of [false,true])test('adopted facial COMPLETE plus OCR '+ocr+' never reads selfie or reinfers after scheduler/cron',async()=>{
 const f=await fixture({ocr}),target=await transferToScheduler(f);target.setStageAvailable('biometric',false);const r=await target.service.process(target.ref);assert.equal(r.state,ocr?'EXTRACTED_UNVERIFIED':'ADVISORY_UNREVIEWED');assert.equal(target.calls.biometric,0);assert.equal(target.calls.provider,ocr?1:0);assert.equal(target.calls.get,ocr?1:0);await target.service.process(target.ref);await target.service.recover();assert.equal(target.calls.biometric,0);assert.equal(target.calls.provider,ocr?1:0);assert.equal(f.calls.model,1);assert.equal(target.processing().stages.biometric.state,'COMPLETE');
});
for(const changed of ['score','stage','notice','journal','receipt'])test('adopted '+changed+' tampering is denied before scheduler source I/O',async()=>{
 const f=await fixture({ocr:true}),target=await transferToScheduler(f),k=target.row.metadata.participant.kyc;if(changed==='score')k.processing.biometrics.faceSimilarity=0.5;if(changed==='stage')k.processing.stages.biometric.state='PENDING';if(changed==='notice')k.biometricConsent.noticeSha256='f'.repeat(64);if(changed==='journal')target.audits.delete(k.facialPrecommit.attemptId);if(changed==='receipt')target.receipt.metadata.facialPrecommit.bindingSha256='f'.repeat(64);await assert.rejects(target.service.process(target.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(target.calls.get,0);assert.equal(target.calls.biometric,0);assert.equal(target.calls.provider,0);
});
test('manual after a failed manual persistence remains explicitly manual and keeps old pair tombstones',async()=>{
 const f=await fixture({transport:async()=>{throw Error();}});const original=f.request.context.operationId;await assert.rejects(f.prepare());f.request.context.operationId=randomUUID();f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=original;const first=await f.prepare();await f.coordinator.fencePersistence(first.facialTicket);await f.coordinator.unknown(first.facialTicket);const previous=f.request.context.operationId;f.request.context.operationId=randomUUID();f.request.manualFromOperationId=previous;const next=await f.prepare();await f.save(next);assert.equal(f.calls.model,1);assert.equal([...f.db.rows.values()].filter(r=>r.metadata.state==='CLOSED_MANUAL').length,2);
});
test('low-level bound dispatch rejects a mixed capability before opening another SQL callback',async()=>{
 const f=await fixture(),attempts=createParticipantFacialAttempts({leaseMs:1000}),b=f.binding(),r=await attempts.reserve(b,f.request.withAuthority),other=structuredClone(b);other.context.operationId=randomUUID();const count=f.db.statements.length;await assert.rejects(attempts.dispatch(r.ticket,facialBindingDigest(other)),{code:'FACIAL_DISPATCH_BINDING_MISMATCH'});assert.equal(f.db.statements.length,count);assert.equal(facialPairKey(b),facialPairKey(other));
});
test('concurrent same operation or new UUID same pair permits only one quality/model owner',async()=>{
 for(const differentOperation of [false,true]){const f=await fixture({allowOtherTransactions:true}),other={...f.request,context:{...f.request.context,...(differentOperation?{operationId:randomUUID()}:{})}},results=await Promise.allSettled([f.prepare(),f.coordinator.prepareCapture(other)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='PARTICIPANT_FACIAL_RESULT_PENDING').length,1);assert.equal(f.calls.model,1);assert.equal(f.calls.quality,2);assert.equal(f.calls.put,0);}
});
test('optional back quality finishes before pair and never enters the paired wire payload',async()=>{
 const f=await fixture({transport:async({body,calls})=>{assert.equal(calls.quality,3);assert.deepEqual(Object.keys(body),['version','consentVersion','front','selfie']);assert.doesNotMatch(JSON.stringify(body),/document-back|synthetic-back/);return Response.json(advisory(body));}}),bytes=Buffer.from('synthetic-back');f.request.images.push({kind:'DOCUMENT_BACK',image:{bytes,contentType:'image/png',digest:sha(bytes)}});const p=await f.prepare();assert.equal(p.captureSet.length,3);assert.equal(f.calls.model,1);assert.equal(f.calls.put,0);
});
test('manual resolution reconciles an already committed old receipt before rejecting a stale new revision',async()=>{
 const f=await fixture(),p=await f.prepare(),old=f.request.context.operationId;await f.save(p);f.security.revision+='owncommit';f.security.canSubmitKyc=false;f.request.context.operationId=randomUUID();f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=old;await assert.rejects(f.prepare(),{code:'PARTICIPANT_FACIAL_RECEIPT_AVAILABLE'});assert.equal([...f.db.rows.values()].filter(r=>r.action==='participant.kyc.facial.attempt').length,1);assert.equal(f.calls.model,1);assert.equal(f.calls.put,2);
});
test('expired never-dispatched reservation can be reclaimed while its old capability is fenced',async()=>{
 const f=await fixture(),attempts=createParticipantFacialAttempts({leaseMs:1000}),b=f.binding(),old=await attempts.reserve(b,f.request.withAuthority);f.db.at+=1001;const next=await attempts.reserve(b,f.request.withAuthority);assert.equal(next.recovered,true);await assert.rejects(attempts.dispatch(old.ticket,facialBindingDigest(b)),{code:'FACIAL_LEASE_CHANGED'});await attempts.dispatch(next.ticket,facialBindingDigest(b));assert.equal(f.row().metadata.state,'DISPATCHED');assert.equal(f.calls.model,0);
});
test('expired MANUAL readiness resumes explicitly without any paired request or old-cap persistence',async()=>{
 const f=await fixture({mode:'MANUAL'}),old=await f.prepare();f.db.at+=1001;const status=await f.coordinator.status({context:f.context,withAuthority:f.request.withAuthority});assert.equal(status.phase,'READY');assert.equal(status.canContinueManual,true);assert.equal(status.privateObjectsMayExist,false);const next=await f.prepare();await assert.rejects(f.coordinator.fencePersistence(old.facialTicket),{code:'FACIAL_LEASE_CHANGED'});await f.save(next);assert.equal(f.calls.model,0);assert.equal(f.calls.put,2);
});
test('local unconfigured paired service permits only an explicit manual successor and never calls the model',async()=>{
 const f=await fixture({configured:false}),old=f.request.context.operationId;await assert.rejects(f.prepare(),{code:'PARTICIPANT_FACIAL_RESULT_UNCONFIRMED'});assert.equal(f.row().metadata.state,'REJECTED');assert.equal(f.calls.model,0);const status=await f.coordinator.status({context:f.context,withAuthority:f.request.withAuthority});assert.equal(status.phase,'REJECTED');assert.equal(status.canContinueManual,true);assert.equal(status.privateObjectsMayExist,false);f.request.context.operationId=randomUUID();f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=old;const p=await f.prepare();await f.save(p);assert.equal(f.calls.model,0);assert.equal(f.calls.put,2);
});

test('unknown MANUAL READY before persistence remains a valid rejected non-dispatched attempt',async()=>{
 const f=await fixture({mode:'MANUAL'}),p=await f.prepare();await f.coordinator.unknown(p.facialTicket);
 const status=await f.coordinator.status({context:f.context,withAuthority:f.request.withAuthority});
 assert.equal(status.phase,'REJECTED');assert.equal(status.canContinueManual,true);assert.equal(status.privateObjectsMayExist,false);assert.equal(f.calls.model,0);assert.equal(f.calls.put,0);
});
test('an inherited private-orphan possibility survives an expired unstarted manual successor closure',async()=>{
 const f=await fixture(),p=await f.prepare(),original=f.context.operationId;await f.coordinator.fencePersistence(p.facialTicket);await f.coordinator.unknown(p.facialTicket);
 f.request.context.operationId=randomUUID();f.request.biometricMode='MANUAL';f.request.biometricConsent.allowed=false;f.request.manualFromOperationId=original;
 await f.prepare();const manualContext=structuredClone(f.context);assert.equal(f.row().metadata.orphanPrivateObjectsPossible,true);
 f.db.at+=1001;f.request.context.operationId=randomUUID();f.request.manualFromOperationId=manualContext.operationId;await f.prepare();
 const closed=await f.coordinator.status({context:manualContext,withAuthority:f.request.withAuthority});
 const successor=await f.coordinator.status({context:f.context,withAuthority:f.request.withAuthority});
 assert.equal(closed.privateObjectsMayExist,true);assert.equal(successor.privateObjectsMayExist,true);assert.equal(f.calls.model,1);
});
