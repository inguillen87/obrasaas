import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeAttendanceReviewNativeProof,attendanceReviewCurrentCheckCount,ATTENDANCE_REVIEW_CHECK_NAMES} from '../scripts/lib/attendance-review-current-ci-proof.mjs';
import {verifyPlanBudgetCurrentSources,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetIntakeWithdrawalSource,restorePlanBudgetTrialExpiryNoticeSource,restorePlanBudgetPilotIntegrationSource,withCaptureRuntimePreviousSources,restoreCaptureRuntimePreviousSource} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {validateExtensionProof} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

// Portable public-source decoder shadows only. These tests neither import a
// private RAW receipt nor execute PostgreSQL, providers, browsers or real KYC.
const facialSources=["src/lib/participant-facial-attempt.mjs","src/lib/participant-facial-policy.mjs","src/lib/participant-facial-precommit.mjs"];
const producer='scripts/verify-field-operations-postgres.mjs';
const querySource='tests/production-field-attendance-review-query.test.mjs';
const readSource=file=>Buffer.from(readFileSync(new URL('../'+file,import.meta.url)).toString('utf8').replaceAll('\r\n','\n'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const code='ATTENDANCE_REVIEW_CURRENT_CI_PROOF_REJECTED';
const groups=[['checks','checkCount',19],['reviewPaginationChecks','reviewPaginationCheckCount',26],['voiceProgressChecks','voiceProgressCheckCount',4],['mediaLeaseChecks','mediaLeaseCheckCount',6],['videoAudioChecks','videoAudioCheckCount',8],['canonicalOwnFieldChecks','canonicalOwnFieldCheckCount',3]];

// Every old case below is a literal Git731 checkpoint. Each callback receives
// its own parent ports only after current physical sources are authenticated;
// the unchanged physical reader is checked again when the callback returns.
function historical731Case(name,run){test('literal Git731 checkpoint: '+name,()=>{
 const actual=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));
 return withCaptureRuntimePreviousSources(actual,readSource,(parent,parentRead)=>{
  assert.equal(hash(JSON.stringify(parent,null,2)+'\n'),'d5ef59b111dd3e25b8f08854d3e8e4df4838a7913e3e22b76299c1916b9913d2');
  assert.equal(hash(restoreCaptureRuntimePreviousSource(actual,'scripts/lib/plan-budget-current-ci-lineage.mjs',readSource('scripts/lib/plan-budget-current-ci-lineage.mjs'))),'0ba932090392ee957357d303ac8c4acd11fec9da46b4f01a9e5390e47d563510');
  const fixture=()=>fixtureForReader(parentRead),deny=edit=>denyForFixture(fixture,edit),denyGate=(edit,expectedCode=code)=>denyGateForFixture(fixture,edit,expectedCode);
  return run({fixture,deny,denyGate,readSource:parentRead});
 });
});}

function fixtureForReader(readSource){
 const contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));
 const spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD');
 // This exact Git731 companion comes only from the authenticated parent port.
 assert.equal(attendanceReviewCurrentCheckCount(spec),71);
 const text=readSource(producer).toString('utf8');
 const rootArray=name=>[...text.match(new RegExp('\\b'+name+'=\\[([^\\]]+)\\]'))[1].matchAll(/['"]([^'"]+)['"]/g)].map(row=>row[1]);
 const found=new Set(),visit=file=>{if(found.has(file))return;found.add(file);for(const row of readSource(file).toString('utf8').matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g))visit(path.posix.normalize(path.posix.join(path.posix.dirname(file),row[1])));};
 visit('scripts/fixtures/canonical-participant-kyc.mjs');const kyc=[...found].sort();
 const map=files=>Object.fromEntries([...new Set(files)].sort().map(file=>[file,hash(readSource(file))]));
 const kycFixture={sourceSha256:map(kyc),records:[{projectId:'synthetic-project',workerId:'synthetic-worker',submissionId:'synthetic-submission',submissionReceiptId:'participant_'+'1'.repeat(64),reviewReceiptId:'participant_'+'2'.repeat(64),actorId:'synthetic-author',reviewerActorId:'synthetic-reviewer',contentHash:'3'.repeat(64),canonicalAdmissionConfirmed:true,identityCertified:false,providerCalls:0}],syntheticPrivateCalls:{privatePuts:2,privateReads:6},providerCalls:0,biometricIdentityCertified:false};
 const privacyFixture=structuredClone(kycFixture);delete privacyFixture.sourceSha256;
 const proof={status:'PASS',harnessSha256:hash(readSource(producer)),environment:'disposable-local-postgresql17',databaseEngineVersion:'17.6',databaseRemoved:true,totalChecks:71,providerCalls:0,productionDataWritten:false,reviewPaginationProviderCalls:0,voiceProgressProviderCalls:0,mediaLeaseProviderCalls:0,videoAudioProviderCalls:0,physicalAttendanceAccepted:false,whatsAppTested:false,videoAudioFfmpegExecuted:false,participantKycFixture:kycFixture,ownHistoryPrivacy:{version:1,currentAccountKycCanonical:true,originalAuthorRestored:true,reviewerRoles:['ADMIN','DIRECTOR','SITE_MANAGER'],readBusinessWrites:0,deniedBeforePrivateRead:true,postReadAuthorityRaces:['REASSIGNED','REVOKED'],providerCalls:0,checks:spec.checkNames.map(row=>JSON.parse(row)).filter(row=>row.group==='ownHistoryPrivacy.checks').map(row=>row.name),participantKycFixture:privacyFixture}};
 for(const [key,name] of Object.entries({sourceSha256:'sourceFiles',voiceProgressSourceSha256:'voiceProgressSourceFiles',mediaLeaseSourceSha256:'mediaLeaseSourceFiles',videoAudioSourceSha256:'videoAudioSourceFiles'}))proof[key]=map([...rootArray(name),...kyc]);
 for(const [key,countKey,count] of groups){proof[key]=spec.checkNames.map(row=>JSON.parse(row)).filter(row=>row.group===key).map(row=>row.name);proof[countKey]=count;}
 proof.attendanceReviewChecks=[...text.matchAll(/attendanceReviewChecks\.push\('([^']+)'\)/g)].map(row=>row[1]);proof.attendanceReviewCheckCount=4;
 assert.deepEqual(proof.attendanceReviewChecks,ATTENDANCE_REVIEW_CHECK_NAMES);
 assert.deepEqual([proof.sourceSha256,proof.voiceProgressSourceSha256,proof.mediaLeaseSourceSha256,proof.videoAudioSourceSha256,proof.participantKycFixture.sourceSha256].map(map=>Object.keys(map).length),[125,118,118,121,115]);
 return {contract,spec,proof,reader:readSource};
}
function denyForFixture(fixture,edit){const f=fixture();edit(f);const before=structuredClone(f.proof);assert.throws(()=>normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec),{code});assert.deepEqual(f.proof,before);}

historical731Case('attendance native supplement authenticates RAW71 and five actual maps before an immutable historical67 projection',({fixture})=>{
 const f=fixture(),before=structuredClone(f.proof),result=normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec);
 const expected=structuredClone(before);delete expected.attendanceReviewChecks;delete expected.attendanceReviewCheckCount;expected.totalChecks=67;
 assert.deepEqual(result,expected);assert.deepEqual(f.proof,before);assert.notEqual(result,f.proof);assert.deepEqual(result.sourceSha256,before.sourceSha256);
});
historical731Case('attendance current summary declaration cannot replace validation of four actual controls',({deny})=>deny(f=>{assert.equal(attendanceReviewCurrentCheckCount(f.spec),71);delete f.proof.attendanceReviewChecks;delete f.proof.attendanceReviewCheckCount;f.proof.totalChecks=67;}));
historical731Case('attendance supplement rejects a missing additive control',({deny})=>deny(f=>f.proof.attendanceReviewChecks.pop()));
historical731Case('attendance supplement rejects duplicate additive controls',({deny})=>deny(f=>{f.proof.attendanceReviewChecks[1]=f.proof.attendanceReviewChecks[0];}));
historical731Case('attendance supplement rejects reordered additive controls',({deny})=>deny(f=>f.proof.attendanceReviewChecks.reverse()));
historical731Case('attendance supplement rejects an unreviewed fifth additive control',({deny})=>deny(f=>f.proof.attendanceReviewChecks.push('unreviewed-attendance-control')));
historical731Case('attendance supplement rejects substituted additive controls',({deny})=>deny(f=>{f.proof.attendanceReviewChecks[0]='unreviewed-attendance-control';}));
historical731Case('attendance supplement rejects a forged additive count',({deny})=>deny(f=>{f.proof.attendanceReviewCheckCount=3;}));
historical731Case('attendance supplement rejects a string additive count',({deny})=>deny(f=>{f.proof.attendanceReviewCheckCount='4';}));
historical731Case('attendance supplement rejects the historical total with the current producer',({deny})=>deny(f=>{f.proof.totalChecks=67;}));
historical731Case('attendance supplement preserves all historical ordered controls',({deny})=>deny(f=>f.proof.checks.reverse()));
historical731Case('attendance supplement rejects an omitted historical group',({deny})=>deny(f=>{delete f.proof.reviewPaginationChecks;}));
historical731Case('attendance supplement rejects changed historical counters',({deny})=>deny(f=>{f.proof.voiceProgressCheckCount=3;}));
historical731Case('attendance supplement rejects private data attached to the additive array',({deny})=>deny(f=>{f.proof.attendanceReviewChecks.privateDto={value:'unreviewed'};}));
historical731Case('attendance supplement rejects a stale raw harness digest',({deny})=>deny(f=>{f.proof.harnessSha256='0'.repeat(64);}));
historical731Case('attendance supplement rejects a missing current producer source',({deny,readSource})=>deny(f=>{f.reader=file=>file===producer?undefined:readSource(file);}));
historical731Case('attendance supplement rejects forged source bytes even with a matching self-reported hash',({deny,readSource})=>deny(f=>{const file='vercel.json',bytes=Buffer.from('{"unreviewed":true}');f.reader=name=>name===file?bytes:readSource(name);f.proof.sourceSha256[file]=hash(bytes);}));
historical731Case('attendance supplement rejects an omitted authentic current source map',({deny})=>deny(f=>{delete f.proof.videoAudioSourceSha256;}));
historical731Case('attendance supplement rejects the old132 closure with the new producer',({deny})=>deny(f=>{for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])delete map[querySource];}));
historical731Case('attendance supplement rejects same-count foreign source substitution',({deny})=>deny(f=>{const map=f.proof.sourceSha256;map['src/lib/foreign-attendance-source.mjs']=map[querySource];delete map[querySource];}));
historical731Case('attendance supplement rejects conflicting hashes across the five maps',({deny})=>deny(f=>{f.proof.voiceProgressSourceSha256['src/lib/field-operations-store.mjs']='f'.repeat(64);}));
historical731Case('attendance supplement rejects an invented sixth privacy source map',({deny})=>deny(f=>{f.proof.ownHistoryPrivacy.participantKycFixture.sourceSha256={};}));
historical731Case('attendance supplement rejects provider or physical acceptance claims',({deny})=>deny(f=>{f.proof.physicalAttendanceAccepted=true;f.proof.providerCalls=1;}));
historical731Case('attendance supplement rejects removal of current runtime authority',({deny})=>deny(f=>{delete f.contract.planBudgetCurrentRevision.attendanceReviewRuntime;}));
historical731Case('attendance supplement rejects a caller-resealed runtime producer declaration',({deny})=>deny(f=>{f.contract.planBudgetCurrentRevision.attendanceReviewRuntime.producer.currentSha256='f'.repeat(64);}));
historical731Case('attendance supplement rejects a detached or changed typed spec',({deny})=>deny(f=>{f.spec={...f.spec,producerSha256:'f'.repeat(64)};}));
historical731Case('attendance supplement snapshots source buffers per call without caching mutable readers between calls',({fixture,readSource})=>{
 const f=fixture(),calls=new Map();let first;
 const reader=file=>{calls.set(file,(calls.get(file)||0)+1);if(file===producer){if(!first){first=readSource(file);return first;}return first;}if(file==='scripts/lib/plan-budget-current-ci-reviewed.mjs'&&first)first.fill(32);return readSource(file);};
 assert.equal(normalizeAttendanceReviewNativeProof(f.proof,f.contract,reader,f.spec).totalChecks,67);assert.equal(calls.get(producer),1);
 assert.throws(()=>normalizeAttendanceReviewNativeProof(f.proof,f.contract,reader,f.spec),{code});
});
historical731Case('attendance historical delegation requires an explicit real prior producer and never certifies that delegated input',({fixture,readSource})=>{
 const f=fixture();verifyPlanBudgetCurrentSources(f.contract,readSource);const previous=restorePlanBudgetAttendanceReviewProducerText(f.contract,readSource(producer));
 const oldSpec={...f.spec,producerSha256:hash(previous),sourceFiles:f.spec.sourceFiles.filter(file=>file!==querySource&&file!=='src/lib/consumption-evidence-catalog.mjs')},input={status:'UNVALIDATED_HISTORICAL_INPUT',harnessSha256:hash(previous)};
 assert.equal(attendanceReviewCurrentCheckCount(oldSpec),null);
 const result=normalizeAttendanceReviewNativeProof(input,{},file=>file===producer?Buffer.from(previous):readSource(file),oldSpec);assert.deepEqual(result,input);assert.equal(result.status,'UNVALIDATED_HISTORICAL_INPUT');
});
historical731Case('attendance historical branch rejects the actual current producer behind an older spec',({fixture,readSource})=>{
 const f=fixture();verifyPlanBudgetCurrentSources(f.contract,readSource);const previous=restorePlanBudgetAttendanceReviewProducerText(f.contract,readSource(producer));
 const oldSpec={...f.spec,producerSha256:hash(previous),sourceFiles:f.spec.sourceFiles.filter(file=>file!==querySource&&file!=='src/lib/consumption-evidence-catalog.mjs')},input={harnessSha256:hash(previous)};
 assert.throws(()=>normalizeAttendanceReviewNativeProof(input,{},readSource,oldSpec),{code});
});
historical731Case('attendance historical branch rejects the actual133 query source under any prior spec',({fixture})=>{
 const f=fixture();const oldSpec={...f.spec,producerSha256:'0'.repeat(64)},input={harnessSha256:oldSpec.producerSha256};
 assert.throws(()=>normalizeAttendanceReviewNativeProof(input,{},readSource,oldSpec),{code});assert.equal(attendanceReviewCurrentCheckCount(oldSpec),null);
});

// Exercise the actual gate hook as pure decoder shadows. No native execution or
// CI/human acceptance is inferred from these synthesized public-source inputs.
function gate(f){return validateExtensionProof(f.spec,Buffer.from(JSON.stringify(f.proof)),{expectedHead:f.contract.extension.baseHead,readSource:f.reader});}
function denyGateForFixture(fixture,edit,expectedCode=code){const f=fixture();edit(f);const before=structuredClone(f.proof);assert.throws(()=>gate(f),{code:expectedCode});assert.deepEqual(f.proof,before);}
historical731Case('attendance real gate validates current71 and reports all four additive controls',({fixture})=>{
 const f=fixture(),before=structuredClone(f.proof),result=gate(f);assert.equal(result.checks,71);assert.equal(result.kind,'PG_FIELD');assert.equal(result.result,'PASS');assert.deepEqual(f.proof,before);
});
historical731Case('attendance real gate rejects total71 without both additive fields instead of trusting its summary',({denyGate})=>denyGate(f=>{delete f.proof.attendanceReviewChecks;delete f.proof.attendanceReviewCheckCount;}));
historical731Case('attendance real gate preserves exact inherited harness provider and source-manifest denial codes',({denyGate})=>{
 denyGate(f=>{f.proof.harnessSha256='0'.repeat(64);},'PROOF_HARNESS_SOURCE');
 denyGate(f=>{f.proof.providerCalls=1;},'PROOF_PROVIDER_IO');
 denyGate(f=>{delete f.proof.sourceSha256[querySource];},'PROOF_SOURCE_MANIFEST');
});
historical731Case('attendance real gate rejects altered additive arrays and counters before any current71 report',({denyGate})=>{
 denyGate(f=>{f.proof.attendanceReviewChecks[0]='unreviewed-attendance-control';});
 denyGate(f=>{f.proof.attendanceReviewChecks.pop();});
 denyGate(f=>{f.proof.attendanceReviewChecks.reverse();});
 denyGate(f=>{f.proof.attendanceReviewCheckCount=3;});
});

historical731Case('attendance actual134 rejects a complete prior133 RAW71 receipt without the shared consumption core',({deny})=>deny(f=>{for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])delete map['src/lib/consumption-evidence-catalog.mjs'];}));
historical731Case('attendance actual134 rejects resealed shared core bytes and the old wrapper under current source authority',({deny,readSource})=>{
 deny(f=>{const file='src/lib/consumption-evidence-catalog.mjs',bytes=Buffer.from('foreign shared core');f.reader=name=>name===file?bytes:readSource(name);for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])map[file]=hash(bytes);});
 deny(f=>{const file='src/lib/meta-consumption-evidence-catalog.mjs',bytes=Buffer.from(f.contract.planBudgetCurrentRevision.consumptionEvidenceRuntime.sourceHistory.inverseHunks[0].previousText);f.reader=name=>name===file?bytes:readSource(name);for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])map[file]=hash(bytes);});
});

historical731Case('attendance frozen source comparison accepts only authenticated withdrawal bytes projected to complete6058',({fixture,deny,readSource})=>{
 const f=fixture(),file='src/lib/meta-kyc-conversation.mjs',current=readSource(file),parent=restorePlanBudgetIntakeWithdrawalSource(f.contract,file,current),before=structuredClone(f.proof);assert.notEqual(hash(parent),hash(current));assert.equal(hash(parent),f.contract.planBudgetCurrentRevision.intakeWithdrawalRuntime.conversation.previousSha256);normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec);assert.deepEqual(f.proof,before);deny(g=>{g.reader=name=>name===file?parent:readSource(name);});
 for(const [path,previousSha256] of Object.entries({'src/lib/meta-field-bridge.mjs':'7f3bb80ba828e202f24e1d768b855131642dcc89fde39fcac4b81d64aa632955','src/lib/meta-field-conversation.mjs':'c68887db8fa04f5806d1c0f4c29e829befb89931b8371041ad65334deb1dab4d'})){
  const actual=readSource(path),captured=Buffer.from(actual),comparison65d=restorePlanBudgetPilotIntegrationSource(f.contract,path,actual);assert.equal(hash(comparison65d),previousSha256);assert.notEqual(hash(actual),previousSha256);assert.deepEqual(actual,captured);let maps=0;for(const map of rawMaps(f.proof))if(Object.hasOwn(map,path)){assert.equal(map[path],hash(actual));maps++;}assert.ok(maps>0);deny(g=>{g.reader=name=>name===path?comparison65d:readSource(name);});
 }
});
historical731Case('attendance all five RAW maps retain current withdrawal hashes and reject prior or forged source bytes',({deny,readSource})=>{
 const file='src/lib/meta-kyc-conversation.mjs';for(const key of ['sourceSha256','voiceProgressSourceSha256','mediaLeaseSourceSha256','videoAudioSourceSha256','participantKycFixture'])deny(f=>{const map=key==='participantKycFixture'?f.proof.participantKycFixture.sourceSha256:f.proof[key];assert.ok(Object.hasOwn(map,file));map[file]=f.contract.planBudgetCurrentRevision.intakeWithdrawalRuntime.conversation.previousSha256;});
 deny(f=>{const bytes=Buffer.from('forged withdrawal conversation');for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])map[file]=hash(bytes);f.reader=name=>name===file?bytes:readSource(name);});
});


const trialNoticeParentSources={
 'src/lib/participant-onboarding-authority.mjs':'dad5d9fd0a61c493ff02331d5333982627cdeb3a7addb74a3c86d44da931f916',
 'src/lib/participant-onboarding-reactive.mjs':'666a8c27f3ab7d6fdbe66c91f22ace4e25b04b98e865f401d19c72212916104d'
};
const rawMaps=proof=>[proof.sourceSha256,proof.voiceProgressSourceSha256,proof.mediaLeaseSourceSha256,proof.videoAudioSourceSha256,proof.participantKycFixture.sourceSha256];
historical731Case('attendance authenticates both current expiry-notice bodies before their exact efb8 historical source comparison',({fixture,readSource})=>{
 const f=fixture(),before=structuredClone(f.proof);
 for(const [file,parentSha] of Object.entries(trialNoticeParentSources)){const current=readSource(file),parent=restorePlanBudgetTrialExpiryNoticeSource(f.contract,file,current);assert.ok(Buffer.isBuffer(parent));assert.notEqual(hash(parent),hash(current));assert.equal(hash(parent),parentSha);for(const map of rawMaps(f.proof)){assert.ok(Object.hasOwn(map,file));assert.equal(map[file],hash(current));}}
 const result=normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec);assert.equal(result.totalChecks,67);assert.deepEqual(f.proof,before);assert.deepEqual(rawMaps(result),rawMaps(before));
});
historical731Case('attendance current RAW134 rejects either prior expiry-notice hash in every authentic source map',({deny})=>{
 for(const [file,parentSha] of Object.entries(trialNoticeParentSources))for(let index=0;index<5;index++)deny(f=>{const map=rawMaps(f.proof)[index];assert.ok(Object.hasOwn(map,file));map[file]=parentSha;});
});
historical731Case('attendance rejects parent or forged expiry-notice bytes even when all RAW maps self-report matching hashes',({fixture,deny,readSource})=>{
 for(const file of Object.keys(trialNoticeParentSources)){
  const f=fixture(),parent=restorePlanBudgetTrialExpiryNoticeSource(f.contract,file,readSource(file));
  for(const bytes of [parent,Buffer.from('unreviewed expiry-notice source')])deny(g=>{g.reader=name=>name===file?Buffer.from(bytes):readSource(name);for(const map of rawMaps(g.proof))map[file]=hash(bytes);});
 }
});
historical731Case('attendance current expiry-notice sources require the intact authenticated runtime and cannot fall back to an older contract',({deny})=>{
 deny(f=>{delete f.contract.planBudgetCurrentRevision.trialExpiryNoticeRuntime;});
 deny(f=>{f.contract.planBudgetCurrentRevision.trialExpiryNoticeRuntime={version:1};});
});


test('CURRENT143 FIELD canonical decoder reports71 controls from a synthetic component DTO with exact physical RAW sources; no native execution',()=>{
 const readRaw=file=>readFileSync(new URL('../'+file,import.meta.url)),contract=JSON.parse(readRaw('.github/workspace-acceptance-contract.json')),spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD');
 const descriptor=contract.planBudgetCurrentRevision.captureQualityRuntime.nativeSourceAdvances.find(row=>row.kind==='PG_FIELD');for(const file of facialSources){assert.ok(spec.sourceFiles.includes(file));for(const row of descriptor.nested.maps)assert.ok(row.currentFiles.includes(file));}
 let historical;
 withCaptureRuntimePreviousSources(contract,readRaw,(_parent,parentRead)=>{historical=structuredClone(fixtureForReader(parentRead).proof);});
 const proof=structuredClone(historical),set=(value,key,map)=>{if(key==='participantKycFixture.sourceSha256')value.participantKycFixture.sourceSha256=map;else value[key]=map;},get=(value,key)=>key==='participantKycFixture.sourceSha256'?value.participantKycFixture.sourceSha256:value[key];
 for(const row of descriptor.nested.maps)set(proof,row.field,Object.fromEntries(row.currentFiles.map(file=>[file,hash(readRaw(file))])));
 proof.harnessSha256=hash(readRaw(producer));
 const business=structuredClone(proof);for(const row of descriptor.nested.maps)set(business,row.field,structuredClone(get(historical,row.field)));business.harnessSha256=historical.harnessSha256;assert.deepEqual(business,historical);
 const raw=Buffer.from(JSON.stringify(proof)),rawBefore=Buffer.from(raw),proofBefore=structuredClone(proof);
 const options={expectedHead:contract.extension.baseHead,readSource:readRaw,readEvidence:file=>{assert.equal(file,spec.path);return raw;}};
 const result=validateExtensionProof(spec,raw,options);
 assert.equal(result.checks,71);assert.equal(result.sourceReferences,143);assert.equal(result.sourceReferences,spec.sourceFiles.length);assert.equal(result.proofSha256,hash(raw));assert.equal(result.bytes,raw.length);assert.deepEqual(raw,rawBefore);assert.deepEqual(proof,proofBefore);
 // Equal parsed JSON is insufficient: the caller and retained evidence must be
 // the identical RAW bytes. This is an in-memory unit port, not a native run.
 assert.throws(()=>validateExtensionProof(spec,raw,{...options,readEvidence:()=>Buffer.concat([raw,Buffer.from('\n')])}),{code:'PROOF_NATIVE_RAW_BINDING'});
});
