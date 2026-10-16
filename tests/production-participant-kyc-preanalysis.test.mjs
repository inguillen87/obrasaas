import test from 'node:test';
import assert from 'node:assert/strict';
import {preanalysisMemoryFixture} from './fixtures/participant-preanalysis-memory.mjs';
import {participantOcrNotice,participantBiometricNotice} from '../src/lib/participant-analysis-consent.mjs';
import {publicParticipantPreanalysisIssues,publicParticipantPreanalysisFields} from '../src/lib/participant-kyc-preanalysis-policy.mjs';
import {createMetaAppRecovery} from '../src/lib/meta-app-recovery.mjs';

test('historical notices retain their original immutable hashes and never enqueue automatically',async()=>{
 const f=preanalysisMemoryFixture({legacy:true});assert.equal(f.processing(),undefined);await assert.rejects(f.service.process(f.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.calls.provider,0);assert.equal(f.calls.get,0);
 assert.equal(participantOcrNotice('participant-external-ocr-v1').automatic,false);assert.equal(participantBiometricNotice('participant-private-biometric-v1').automatic,false);
 assert.equal(participantOcrNotice('participant-external-ocr-v1').sha256,'23b97856db336ac622b6d4773f6b922949cd202623660adb297fdfdc8e8bf475');assert.equal(participantBiometricNotice('participant-private-biometric-v1').sha256,'8b38f12428c3d4daa5b32b144febed7f8027360aa6233fb15dee8cb62b14f722');
 assert.equal(participantOcrNotice('other'),null);
});
test('new independently granted stages run from canonical source, keep business status and replay without new I/O',async()=>{
 const f=preanalysisMemoryFixture(),before=structuredClone(f.row.metadata),result=await f.service.process(f.ref);
 assert.equal(result.state,'EXTRACTED_UNVERIFIED');assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);assert.equal(f.calls.get,2);assert.equal(f.processing().biometrics.status,'ADVISORY_UNREVIEWED');assert.equal(f.processing().identityVerified,false);
 assert.deepEqual({...f.row.metadata,participant:{...f.row.metadata.participant,kyc:{...f.row.metadata.participant.kyc,processing:before.participant.kyc.processing}}},before);
 assert.equal(f.usageRows()[0].metadata.state,'OBSERVED');assert.equal(f.usageRows()[0].metadata.observation.usage.totalTokens,'30');
 const receipt=[...f.audits.values()].find(a=>a.action==='participant.kyc.preanalysis');assert.equal(receipt.actorId,f.receipt.actorId);assert.equal(receipt.metadata.executor,'INTERNAL_KYC_PRECHECK');assert.doesNotMatch(JSON.stringify(receipt),/Persona|12345678|base64|private\.blob|faceSimilarity/);
 const counts={...f.calls};await f.service.process(f.ref);assert.equal(f.calls.get,counts.get);assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);
 assert.equal(f.calls.requests[0].messages[1].content.filter(c=>c.type==='image_url').length,1);
});
test('PostgreSQL JSONB object key ordering preserves the exact source binding, consent fingerprint and deterministic operation',async()=>{
 const jsonb=value=>Array.isArray(value)?value.map(jsonb):value!==null&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort((a,b)=>Buffer.byteLength(a)-Buffer.byteLength(b)||Buffer.compare(Buffer.from(a),Buffer.from(b))).map(key=>[key,jsonb(value[key])])):value;
 const f=preanalysisMemoryFixture(),original=structuredClone(f.processing().auto),consent=structuredClone(f.row.metadata.participant.kyc.ocrConsent);f.row.metadata=jsonb(f.row.metadata);f.receipt.metadata=jsonb(f.receipt.metadata);
 assert.notDeepEqual(Object.keys(f.row.metadata.participant.kyc.ocrConsent),Object.keys(consent));assert.deepEqual(f.processing().auto,original);
 assert.equal((await f.service.process(f.ref)).state,'EXTRACTED_UNVERIFIED');assert.equal(f.processing().auto.operationId,original.operationId);assert.equal(f.processing().auto.consentDigest,original.consentDigest);await f.service.process(f.ref);assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);assert.equal(f.usageRows().length,1);
});
for(const mode of ['extra-auto-key','changed-operation','changed-notice-proof','changed-consent-time'])test('JSONB canonicalization preserves strict semantic tamper rejection: '+mode,async()=>{
 const f=preanalysisMemoryFixture();if(mode==='extra-auto-key')f.processing().auto.unexpected=true;if(mode==='changed-operation')f.processing().auto.operationId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';if(mode==='changed-notice-proof')f.receipt.metadata.ocrNoticeSha256='f'.repeat(64);if(mode==='changed-consent-time')f.row.metadata.participant.kyc.ocrConsent.recordedAt='2026-10-16T11:59:59.000Z';await assert.rejects(f.service.process(f.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.calls.get,0);assert.equal(f.calls.provider,0);assert.equal(f.calls.biometric,0);
});
for(const [ocr,biometric] of [[false,false],[true,false],[false,true]])test(`independent consent ${ocr}/${biometric} never discloses an unauthorized image`,async()=>{
 const f=preanalysisMemoryFixture({ocr,biometric});await f.service.process(f.ref);assert.equal(f.calls.provider,ocr?1:0);assert.equal(f.calls.biometric,biometric?1:0);assert.equal(f.usageRows().length,ocr?1:0);assert.equal(f.calls.get,biometric?2:ocr?1:0);
 assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');
});
test('configuration absence remains durable and automatic recovery uses the same operation after configuration returns',async()=>{
 const f=preanalysisMemoryFixture({configured:false}),op=f.processing().auto.operationId;assert.equal((await f.service.process(f.ref)).state,'WAITING_CONFIGURATION');assert.equal(f.calls.get,0);assert.equal(f.usageRows().length,0);
 f.setAvailable(true);f.advance(300001);assert.equal((await f.service.recover()).results[0].state,'EXTRACTED_UNVERIFIED');assert.equal(f.processing().auto.operationId,op);assert.equal(f.calls.provider,1);
});
test('commercial expired coverage holds only paid OCR while authorized private comparison still completes',async()=>{
 const f=preanalysisMemoryFixture({expired:true});assert.equal((await f.service.process(f.ref)).state,'USAGE_HELD');assert.equal(f.calls.provider,0);assert.equal(f.calls.biometric,1);assert.equal(f.usageRows().length,0);
 f.setExpired(false);f.advance(300001);await f.service.process(f.ref);assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);
});
test('concurrent processing obtains one durable claim and no second provider or biometric dispatch',async()=>{
 let enter,finish;const started=new Promise(r=>{enter=r;}),pending=new Promise(r=>{finish=r;});const f=preanalysisMemoryFixture({provider:async()=>{enter();await pending;return Response.json({model:'gpt-4o',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({isDni:true,nombreCompleto:'Sintética',dni:'12345678',cuil:null})}}]});}});
 const first=f.service.process(f.ref);await started;assert.equal((await f.service.process(f.ref)).state,'RUNNING');assert.equal(f.calls.provider,1);finish();await first;assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);
});
test('unknown paid dispatch remains uncertain across replay and cron, without another charge or analysis',async()=>{
 const f=preanalysisMemoryFixture({provider:async()=>{throw Error('synthetic transport failure');}});assert.equal((await f.service.process(f.ref)).state,'UNCERTAIN');assert.equal(f.usageRows()[0].metadata.state,'UNKNOWN');f.advance(500000);await f.service.process(f.ref);await f.service.recover();assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);
});
test('an expired OCR dispatch remains uncertain while a new claim completes only the independently authorized pending facial stage',async()=>{
 let enter,finish;const started=new Promise(r=>{enter=r;}),pending=new Promise(r=>{finish=r;});const f=preanalysisMemoryFixture({provider:async()=>{enter();await pending;return Response.json({model:'gpt-4o',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({isDni:true,nombreCompleto:'Sintética',dni:'12345678',cuil:null})}}]});}});
 const first=f.service.process(f.ref);await started;const originalClaim=f.processing().claimId,source=structuredClone(f.receipt);f.advance(150001);assert.equal((await f.service.process(f.ref)).state,'UNCERTAIN');assert.notEqual(f.processing().claimId,originalClaim);assert.equal(f.processing().stages.ocr.state,'DISPATCHED');assert.equal(f.processing().stages.biometric.state,'COMPLETE');assert.deepEqual(f.processing().issueCodes,['OCR_DISPATCH_UNCERTAIN']);finish();await assert.rejects(first,{code:'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);assert.equal(f.processing().fields,undefined);assert.equal(f.usageRows()[0].metadata.state,'OBSERVED');assert.deepEqual(f.receipt,source);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc.preanalysis'&&a.metadata.status==='UNCERTAIN').length,1);await f.service.process(f.ref);assert.equal(f.calls.biometric,1);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc.preanalysis').length,1);
});
test('an uncertain OCR stage preserves a waiting facial stage and recovers it after configuration without a second paid dispatch or receipt',async()=>{
 let enter,finish;const started=new Promise(r=>{enter=r;}),pending=new Promise(r=>{finish=r;});const f=preanalysisMemoryFixture({provider:async()=>{enter();await pending;return Response.json({model:'gpt-4o',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({isDni:true,nombreCompleto:'Sintética',dni:'12345678',cuil:null})}}]});}});f.setStageAvailable('biometric',false);
 const first=f.service.process(f.ref);await started;f.advance(150001);const waiting=await f.service.process(f.ref);assert.equal(waiting.state,'UNCERTAIN');assert.equal(waiting.processed,false);assert.equal(f.processing().stages.biometric.state,'WAITING_CONFIGURATION');assert.deepEqual(f.processing().issueCodes,['OCR_DISPATCH_UNCERTAIN','FACIAL_UNAVAILABLE']);assert.equal(f.calls.biometric,0);f.setStageAvailable('biometric',true);f.advance(300001);const recovered=await f.service.recover();assert.equal(recovered.results[0].state,'UNCERTAIN');assert.equal(recovered.results[0].processed,true);assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);assert.equal(f.usageRows().length,1);finish();await assert.rejects(first,{code:'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc.preanalysis').length,1);
});
test('a new independent facial claim that also crashes cannot redispatch either fenced stage',async()=>{
 let enterOcr,finishOcr,enterBio,finishBio;const startedOcr=new Promise(r=>{enterOcr=r;}),startedBio=new Promise(r=>{enterBio=r;}),pendingOcr=new Promise(r=>{finishOcr=r;}),pendingBio=new Promise(r=>{finishBio=r;});const f=preanalysisMemoryFixture({provider:async()=>{enterOcr();await pendingOcr;return Response.json({model:'gpt-4o',usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2},choices:[{finish_reason:'stop',message:{content:JSON.stringify({isDni:true,nombreCompleto:'Sintética',dni:'12345678',cuil:null})}}]});},bioProvider:async()=>{enterBio();await pendingBio;return {success:false,code:'BIOMETRIC_RESULT_UNCONFIRMED'};}});
 const first=f.service.process(f.ref);await startedOcr;f.advance(150001);const second=f.service.process(f.ref);await startedBio;assert.equal((await f.service.process(f.ref)).state,'RUNNING');f.advance(150001);assert.equal((await f.service.process(f.ref)).state,'UNCERTAIN');assert.deepEqual(f.processing().issueCodes,['OCR_DISPATCH_UNCERTAIN','FACIAL_DISPATCH_UNCERTAIN']);finishOcr();finishBio();await assert.rejects(first,{code:'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});await assert.rejects(second,{code:'PARTICIPANT_ANALYSIS_LEASE_CHANGED'});await f.service.recover();assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);assert.equal(f.usageRows().length,1);assert.equal([...f.audits.values()].filter(a=>a.action==='participant.kyc.preanalysis').length,1);
});
test('a reclaimed pending stage rechecks source after awaiting its first storage read and does not transfer the next image',async()=>{
 let enter,finish;const started=new Promise(r=>{enter=r;}),pending=new Promise(r=>{finish=r;});const f=preanalysisMemoryFixture({provider:async()=>{enter();await pending;return Response.json({usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}});},beforeGet:({row,calls})=>{if(calls.get===2)row.metadata.participant.status='REVOKED';}});
 const first=f.service.process(f.ref);await started;f.advance(150001);await assert.rejects(f.service.process(f.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.calls.get,2);assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,0);finish();await assert.rejects(first,{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.processing().fields,undefined);
});
test('a completed OCR partial result is normalized for another authorized reviewer independently of the aggregate status',async()=>{
 const f=preanalysisMemoryFixture();f.setStageAvailable('biometric',false);await f.service.process(f.ref);assert.equal(f.processing().status,'WAITING_CONFIGURATION');assert.equal(f.processing().stages.ocr.state,'COMPLETE');const expected={nombreCompleto:'Persona Sintética',dni:'12345678',cuil:null};
 for(const status of ['WAITING_CONFIGURATION','USAGE_HELD','UNCERTAIN']){const processing={...f.processing(),status,fields:{...f.processing().fields,providerRaw:'must never project'}};assert.deepEqual(publicParticipantPreanalysisFields(processing,{reviewer:true}),expected);assert.equal(publicParticipantPreanalysisFields(processing,{reviewer:false}),null);assert.equal(publicParticipantPreanalysisFields(processing,{reviewer:true,own:true}),null);assert.equal(publicParticipantPreanalysisFields({...processing,stages:{...processing.stages,ocr:{state:'DISPATCHED'}}},{reviewer:true}),null);assert.equal(publicParticipantPreanalysisFields({...processing,fields:{nombreCompleto:'x',dni:'invalid'}},{reviewer:true}),null);}
 f.setStageAvailable('biometric',true);f.advance(300001);await f.service.recover();assert.equal(f.calls.provider,1);assert.equal(f.calls.biometric,1);assert.equal(f.usageRows().length,1);
});
for(const mode of ['receipt','source-actor','consent','set','tenant','principal','assignment'])test(`source authority ${mode} stops before image reads or provider calls`,async()=>{
 const f=preanalysisMemoryFixture();if(mode==='receipt')f.audits.delete(f.receipt.id);if(mode==='source-actor')f.receipt.actorId='foreign-actor';if(mode==='consent')f.row.metadata.participant.kyc.ocrConsent.allowed=false;if(mode==='set')f.row.metadata.participant.kyc.images[0].sha256='f'.repeat(64);if(mode==='tenant')f.row.organizationId='other-company';if(mode==='principal')f.disableMember();if(mode==='assignment')f.unassign();
 await assert.rejects(f.service.process(f.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.calls.get,0);assert.equal(f.calls.provider,0);
});
test('revocation while private storage is read prevents every subsequent provider transfer',async()=>{
 const f=preanalysisMemoryFixture({beforeGet:({row})=>{row.metadata.participant.status='REVOKED';}});await assert.rejects(f.service.process(f.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.calls.provider,0);assert.equal(f.calls.biometric,0);
});
test('provider-declared success cannot smuggle certification or embeddings into private biometrics',async()=>{
 const f=preanalysisMemoryFixture({ocr:false,bioProvider:async()=>({success:true,status:'ADVISORY_UNREVIEWED',identityCertified:true,embedding:[123]})});await f.service.process(f.ref);assert.equal(f.processing().biometrics.status,'UNAVAILABLE');assert.equal(f.processing().biometrics.identityCertified,false);assert.equal(f.processing().biometrics.embedding,undefined);
});
test('malformed scheduling timestamps fail before private I/O without a PostgreSQL date cast',async()=>{
 const f=preanalysisMemoryFixture();f.processing().nextCheckAt='not-a-timestamp';await assert.rejects(f.service.process(f.ref),{code:'PARTICIPANT_ANALYSIS_SOURCE_CHANGED'});assert.equal(f.calls.get,0);await f.service.recover();const query=f.calls.sql.find(sql=>sql.includes('AS "workerId"'));assert.doesNotMatch(query,/::timestamptz/);assert.match(query,/USAGE_HELD.*ORGANIZATION_USAGE_COVERAGE_EXPIRED/);assert.equal(f.processing().recoveryCode,'PARTICIPANT_ANALYSIS_SOURCE_CHANGED');assert.match(f.processing().nextCheckAt,/^2026-10-16T12:05:00/);
});
test('issue codes stay informational, closed and independent of any identity or access verdict',async()=>{
 const f=preanalysisMemoryFixture({biometric:false});await f.service.process(f.ref);assert.deepEqual(f.processing().issueCodes,['FACIAL_NOT_AUTHORIZED','CUIL_NOT_READ']);assert.equal(f.row.metadata.participant.kyc.status,'PENDING_REVIEW');assert.deepEqual(f.row.metadata.participant.permissions,{attendance:false,report:false});assert.deepEqual(publicParticipantPreanalysisIssues({issueCodes:['CUIL_NOT_READ','PROVIDER_SENSITIVE_TEXT','CUIL_NOT_READ',null]}),['CUIL_NOT_READ']);
});
test('the existing cron recovers AI alongside Meta while signed event jobs preserve their own scope',async()=>{
 const calls=[],empty={durable:true,checked:0,results:[]},customer={recover:async input=>{calls.push(['CUSTOMER',input]);return empty;}},demo={recover:async input=>{calls.push(['DEMO',input]);return empty;}},analysis={recover:async input=>{calls.push(['ANALYSIS',input]);return {durable:true,checked:1,results:[{automatic:true,state:'QUEUED'}]};}},cron=createMetaAppRecovery({customer,demo,analysis,log:()=>{}});
 const result=await cron.recover();assert.equal(result.checked,1);assert.deepEqual(calls.find(c=>c[0]==='ANALYSIS'),['ANALYSIS',{limit:1,budgetMs:160000}]);calls.length=0;await cron.recover({eventIds:['customer_webhook_'+'a'.repeat(64)]});assert.equal(calls.length,1);assert.equal(calls[0][0],'CUSTOMER');
});
