import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeAttendanceReviewNativeProof,attendanceReviewCurrentCheckCount,ATTENDANCE_REVIEW_CHECK_NAMES} from '../scripts/lib/attendance-review-current-ci-proof.mjs';
import {verifyPlanBudgetCurrentSources,restorePlanBudgetAttendanceReviewProducerText,restorePlanBudgetIntakeWithdrawalSource} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {validateExtensionProof} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';

// Portable public-source decoder shadows only. These tests neither import a
// private RAW receipt nor execute PostgreSQL, providers, browsers or real KYC.
const producer='scripts/verify-field-operations-postgres.mjs';
const querySource='tests/production-field-attendance-review-query.test.mjs';
const readSource=file=>Buffer.from(readFileSync(new URL('../'+file,import.meta.url)).toString('utf8').replaceAll('\r\n','\n'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const code='ATTENDANCE_REVIEW_CURRENT_CI_PROOF_REJECTED';
const groups=[['checks','checkCount',19],['reviewPaginationChecks','reviewPaginationCheckCount',26],['voiceProgressChecks','voiceProgressCheckCount',4],['mediaLeaseChecks','mediaLeaseCheckCount',6],['videoAudioChecks','videoAudioCheckCount',8],['canonicalOwnFieldChecks','canonicalOwnFieldCheckCount',3]];
function fixture(){
 const contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));
 const spec=contract.extension.proofs.find(row=>row.kind==='PG_FIELD');
 // Binding must be the actual current companion, never a test-supplied oracle.
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
function deny(edit){const f=fixture();edit(f);const before=structuredClone(f.proof);assert.throws(()=>normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec),{code});assert.deepEqual(f.proof,before);}

test('attendance native supplement authenticates RAW71 and five actual maps before an immutable historical67 projection',()=>{
 const f=fixture(),before=structuredClone(f.proof),result=normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec);
 const expected=structuredClone(before);delete expected.attendanceReviewChecks;delete expected.attendanceReviewCheckCount;expected.totalChecks=67;
 assert.deepEqual(result,expected);assert.deepEqual(f.proof,before);assert.notEqual(result,f.proof);assert.deepEqual(result.sourceSha256,before.sourceSha256);
});
test('attendance current summary declaration cannot replace validation of four actual controls',()=>deny(f=>{assert.equal(attendanceReviewCurrentCheckCount(f.spec),71);delete f.proof.attendanceReviewChecks;delete f.proof.attendanceReviewCheckCount;f.proof.totalChecks=67;}));
test('attendance supplement rejects a missing additive control',()=>deny(f=>f.proof.attendanceReviewChecks.pop()));
test('attendance supplement rejects duplicate additive controls',()=>deny(f=>{f.proof.attendanceReviewChecks[1]=f.proof.attendanceReviewChecks[0];}));
test('attendance supplement rejects reordered additive controls',()=>deny(f=>f.proof.attendanceReviewChecks.reverse()));
test('attendance supplement rejects an unreviewed fifth additive control',()=>deny(f=>f.proof.attendanceReviewChecks.push('unreviewed-attendance-control')));
test('attendance supplement rejects substituted additive controls',()=>deny(f=>{f.proof.attendanceReviewChecks[0]='unreviewed-attendance-control';}));
test('attendance supplement rejects a forged additive count',()=>deny(f=>{f.proof.attendanceReviewCheckCount=3;}));
test('attendance supplement rejects a string additive count',()=>deny(f=>{f.proof.attendanceReviewCheckCount='4';}));
test('attendance supplement rejects the historical total with the current producer',()=>deny(f=>{f.proof.totalChecks=67;}));
test('attendance supplement preserves all historical ordered controls',()=>deny(f=>f.proof.checks.reverse()));
test('attendance supplement rejects an omitted historical group',()=>deny(f=>{delete f.proof.reviewPaginationChecks;}));
test('attendance supplement rejects changed historical counters',()=>deny(f=>{f.proof.voiceProgressCheckCount=3;}));
test('attendance supplement rejects private data attached to the additive array',()=>deny(f=>{f.proof.attendanceReviewChecks.privateDto={value:'unreviewed'};}));
test('attendance supplement rejects a stale raw harness digest',()=>deny(f=>{f.proof.harnessSha256='0'.repeat(64);}));
test('attendance supplement rejects a missing current producer source',()=>deny(f=>{f.reader=file=>file===producer?undefined:readSource(file);}));
test('attendance supplement rejects forged source bytes even with a matching self-reported hash',()=>deny(f=>{const file='vercel.json',bytes=Buffer.from('{"unreviewed":true}');f.reader=name=>name===file?bytes:readSource(name);f.proof.sourceSha256[file]=hash(bytes);}));
test('attendance supplement rejects an omitted authentic current source map',()=>deny(f=>{delete f.proof.videoAudioSourceSha256;}));
test('attendance supplement rejects the old132 closure with the new producer',()=>deny(f=>{for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])delete map[querySource];}));
test('attendance supplement rejects same-count foreign source substitution',()=>deny(f=>{const map=f.proof.sourceSha256;map['src/lib/foreign-attendance-source.mjs']=map[querySource];delete map[querySource];}));
test('attendance supplement rejects conflicting hashes across the five maps',()=>deny(f=>{f.proof.voiceProgressSourceSha256['src/lib/field-operations-store.mjs']='f'.repeat(64);}));
test('attendance supplement rejects an invented sixth privacy source map',()=>deny(f=>{f.proof.ownHistoryPrivacy.participantKycFixture.sourceSha256={};}));
test('attendance supplement rejects provider or physical acceptance claims',()=>deny(f=>{f.proof.physicalAttendanceAccepted=true;f.proof.providerCalls=1;}));
test('attendance supplement rejects removal of current runtime authority',()=>deny(f=>{delete f.contract.planBudgetCurrentRevision.attendanceReviewRuntime;}));
test('attendance supplement rejects a caller-resealed runtime producer declaration',()=>deny(f=>{f.contract.planBudgetCurrentRevision.attendanceReviewRuntime.producer.currentSha256='f'.repeat(64);}));
test('attendance supplement rejects a detached or changed typed spec',()=>deny(f=>{f.spec={...f.spec,producerSha256:'f'.repeat(64)};}));
test('attendance supplement snapshots source buffers per call without caching mutable readers between calls',()=>{
 const f=fixture(),calls=new Map();let first;
 const reader=file=>{calls.set(file,(calls.get(file)||0)+1);if(file===producer){if(!first){first=readSource(file);return first;}return first;}if(file==='scripts/lib/plan-budget-current-ci-reviewed.mjs'&&first)first.fill(32);return readSource(file);};
 assert.equal(normalizeAttendanceReviewNativeProof(f.proof,f.contract,reader,f.spec).totalChecks,67);assert.equal(calls.get(producer),1);
 assert.throws(()=>normalizeAttendanceReviewNativeProof(f.proof,f.contract,reader,f.spec),{code});
});
test('attendance historical delegation requires an explicit real prior producer and never certifies that delegated input',()=>{
 const f=fixture();verifyPlanBudgetCurrentSources(f.contract,readSource);const previous=restorePlanBudgetAttendanceReviewProducerText(f.contract,readSource(producer));
 const oldSpec={...f.spec,producerSha256:hash(previous),sourceFiles:f.spec.sourceFiles.filter(file=>file!==querySource&&file!=='src/lib/consumption-evidence-catalog.mjs')},input={status:'UNVALIDATED_HISTORICAL_INPUT',harnessSha256:hash(previous)};
 assert.equal(attendanceReviewCurrentCheckCount(oldSpec),null);
 const result=normalizeAttendanceReviewNativeProof(input,{},file=>file===producer?Buffer.from(previous):readSource(file),oldSpec);assert.deepEqual(result,input);assert.equal(result.status,'UNVALIDATED_HISTORICAL_INPUT');
});
test('attendance historical branch rejects the actual current producer behind an older spec',()=>{
 const f=fixture();verifyPlanBudgetCurrentSources(f.contract,readSource);const previous=restorePlanBudgetAttendanceReviewProducerText(f.contract,readSource(producer));
 const oldSpec={...f.spec,producerSha256:hash(previous),sourceFiles:f.spec.sourceFiles.filter(file=>file!==querySource&&file!=='src/lib/consumption-evidence-catalog.mjs')},input={harnessSha256:hash(previous)};
 assert.throws(()=>normalizeAttendanceReviewNativeProof(input,{},readSource,oldSpec),{code});
});
test('attendance historical branch rejects the actual133 query source under any prior spec',()=>{
 const f=fixture();const oldSpec={...f.spec,producerSha256:'0'.repeat(64)},input={harnessSha256:oldSpec.producerSha256};
 assert.throws(()=>normalizeAttendanceReviewNativeProof(input,{},readSource,oldSpec),{code});assert.equal(attendanceReviewCurrentCheckCount(oldSpec),null);
});

// Exercise the actual gate hook as pure decoder shadows. No native execution or
// CI/human acceptance is inferred from these synthesized public-source inputs.
function gate(f){return validateExtensionProof(f.spec,Buffer.from(JSON.stringify(f.proof)),{expectedHead:f.contract.extension.baseHead,readSource:f.reader});}
function denyGate(edit,expectedCode=code){const f=fixture();edit(f);const before=structuredClone(f.proof);assert.throws(()=>gate(f),{code:expectedCode});assert.deepEqual(f.proof,before);}
test('attendance real gate validates current71 and reports all four additive controls',()=>{
 const f=fixture(),before=structuredClone(f.proof),result=gate(f);assert.equal(result.checks,71);assert.equal(result.kind,'PG_FIELD');assert.equal(result.result,'PASS');assert.deepEqual(f.proof,before);
});
test('attendance real gate rejects total71 without both additive fields instead of trusting its summary',()=>denyGate(f=>{delete f.proof.attendanceReviewChecks;delete f.proof.attendanceReviewCheckCount;}));
test('attendance real gate preserves exact inherited harness provider and source-manifest denial codes',()=>{
 denyGate(f=>{f.proof.harnessSha256='0'.repeat(64);},'PROOF_HARNESS_SOURCE');
 denyGate(f=>{f.proof.providerCalls=1;},'PROOF_PROVIDER_IO');
 denyGate(f=>{delete f.proof.sourceSha256[querySource];},'PROOF_SOURCE_MANIFEST');
});
test('attendance real gate rejects altered additive arrays and counters before any current71 report',()=>{
 denyGate(f=>{f.proof.attendanceReviewChecks[0]='unreviewed-attendance-control';});
 denyGate(f=>{f.proof.attendanceReviewChecks.pop();});
 denyGate(f=>{f.proof.attendanceReviewChecks.reverse();});
 denyGate(f=>{f.proof.attendanceReviewCheckCount=3;});
});

test('attendance actual134 rejects a complete prior133 RAW71 receipt without the shared consumption core',()=>deny(f=>{for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])delete map['src/lib/consumption-evidence-catalog.mjs'];}));
test('attendance actual134 rejects resealed shared core bytes and the old wrapper under current source authority',()=>{
 deny(f=>{const file='src/lib/consumption-evidence-catalog.mjs',bytes=Buffer.from('foreign shared core');f.reader=name=>name===file?bytes:readSource(name);for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])map[file]=hash(bytes);});
 deny(f=>{const file='src/lib/meta-consumption-evidence-catalog.mjs',bytes=Buffer.from(f.contract.planBudgetCurrentRevision.consumptionEvidenceRuntime.sourceHistory.inverseHunks[0].previousText);f.reader=name=>name===file?bytes:readSource(name);for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])map[file]=hash(bytes);});
});

test('attendance frozen source comparison accepts only authenticated withdrawal bytes projected to complete6058',()=>{
 const f=fixture(),file='src/lib/meta-kyc-conversation.mjs',current=readSource(file),parent=restorePlanBudgetIntakeWithdrawalSource(f.contract,file,current),before=structuredClone(f.proof);assert.notEqual(hash(parent),hash(current));assert.equal(hash(parent),f.contract.planBudgetCurrentRevision.intakeWithdrawalRuntime.conversation.previousSha256);normalizeAttendanceReviewNativeProof(f.proof,f.contract,f.reader,f.spec);assert.deepEqual(f.proof,before);deny(g=>{g.reader=name=>name===file?parent:readSource(name);});
});
test('attendance all five RAW maps retain current withdrawal hashes and reject prior or forged source bytes',()=>{
 const file='src/lib/meta-kyc-conversation.mjs';for(const key of ['sourceSha256','voiceProgressSourceSha256','mediaLeaseSourceSha256','videoAudioSourceSha256','participantKycFixture'])deny(f=>{const map=key==='participantKycFixture'?f.proof.participantKycFixture.sourceSha256:f.proof[key];assert.ok(Object.hasOwn(map,file));map[file]=f.contract.planBudgetCurrentRevision.intakeWithdrawalRuntime.conversation.previousSha256;});
 deny(f=>{const bytes=Buffer.from('forged withdrawal conversation');for(const map of [f.proof.sourceSha256,f.proof.voiceProgressSourceSha256,f.proof.mediaLeaseSourceSha256,f.proof.videoAudioSourceSha256,f.proof.participantKycFixture.sourceSha256])map[file]=hash(bytes);f.reader=name=>name===file?bytes:readSource(name);});
});
