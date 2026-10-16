import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PARTICIPANT_PREANALYSIS_CURRENT_REVISION,PARTICIPANT_PREANALYSIS_VALIDATION_PATHS,restoreParticipantPreanalysisPreviousContract,participantPreanalysisCurrentSourcePin,verifyParticipantPreanalysisCurrentSources,validateParticipantPreanalysisWorkspaceContract} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {PARTICIPANT_KYC_PREANALYSIS_CHECKS,participantPreanalysisSourceManifest} from '../scripts/verify-participant-kyc-preanalysis-postgres.mjs';
import {parseParticipantPreanalysisTap,validateParticipantKycPreanalysisNative,validateParticipantKycPreanalysisCi,PARTICIPANT_PREANALYSIS_CI_VERSION} from '../scripts/verify-participant-kyc-preanalysis-ci.mjs';
import {restoreOoxmlAccountingPreviousContract} from '../scripts/lib/ooxml-accounting-current-ci-lineage.mjs';
import {reconstructPublishedHContract} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';
import {restoreIntegratedIdentityPreviousContract} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
// This pure CI envelope fixture represents the committed LF runner bytes. The
// native shadow keeps every original RAW producer/runtime source observation.
const root=new URL('../',import.meta.url),read=file=>{const bytes=readFileSync(new URL(file,root));return file==='scripts/verify-participant-kyc-preanalysis-ci.mjs'?Buffer.from(bytes.toString().replaceAll('\r\n','\n')):bytes;};
const denied=run=>assert.throws(run,error=>['PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED','PARTICIPANT_PREANALYSIS_CI_REJECTED'].includes(error.code));
const nativeSource=participantPreanalysisSourceManifest(),nativeSourceFiles=nativeSource.map(row=>row.path);
// Pure adversarial validator inputs. These shadows do not execute PostgreSQL,
// a provider, a private-document read or personal consent/identity acceptance.
const shadow=()=>({version:1,status:'PASS',postgresExecuted:true,failure:null,
 completedCheckCount:PARTICIPANT_KYC_PREANALYSIS_CHECKS.length,checks:[...PARTICIPANT_KYC_PREANALYSIS_CHECKS],
 engine:{host:'127.0.0.1',port:5432,version:170006,database:'obrasaas_cutover_ci',actor:'cutover_test',role:'cutover_test'},ownership:{datname:'obrasaas_kyc_preanalysis_'+'a'.repeat(32),oid:12345,owner:'cutover_test'},ownedConnectionPids:[101],
 providerRequests:0,productionDataWritten:false,realConsentOrIdentityVerified:false,humanApprovalPerformed:false,counts:{unexpectedNetwork:0},
 sqlFailures:[],cleanup:{poolClosed:true,databaseRemoved:true,adminClosed:true,sourceBytesUnchanged:true,ownSessionsBeforeDrop:0},
 leaseFixtures:{normalServiceMs:150000,expiryOnlyFixtureMs:1000,sqlClockObservedBeforeRelease:true,productionLeaseConfigurationChanged:false},
 lockObservations:[{kind:'INITIAL_CLAIM_SERIALIZATION',blockerPid:101,waiterPid:102,canonicalWorkerLock:true,postgresReportedBlockingPid:true}],
 sourceManifest:structuredClone(nativeSource),sourceDigest:sha(JSON.stringify(nativeSource)),harnessSha256:sha(read('scripts/verify-participant-kyc-preanalysis-postgres.mjs'))});
const verify=proof=>validateParticipantKycPreanalysisNative(proof,{readSource:read,nativeSourceFiles});

test('native preanalysis validator binds every current source without claiming execution of the shadow',()=>{
 const result=verify(shadow());assert.equal(result.nativeCheckCount,PARTICIPANT_KYC_PREANALYSIS_CHECKS.length);assert.equal(result.realConsentOrIdentityVerified,false);
 for(const file of ['api/_biometric_core.py','src/app/api/identity/participants/route.js','src/app/api/meta/customer-process/route.js','src/lib/participant-analysis-consent.mjs','src/lib/participant-kyc-preanalysis.mjs'])assert.ok(nativeSourceFiles.includes(file));
});
test('partial failed skipped reordered and duplicate native cases cannot certify current preanalysis',()=>{
 for(const edit of [p=>{p.status='FAIL';},p=>{p.failure={code:'FAILED'};},p=>{p.checks.pop();},p=>{p.completedCheckCount--;},p=>{p.checks.reverse();},p=>{p.checks[1]=p.checks[0];},p=>{p.postgresExecuted=false;}]){const p=shadow();edit(p);denied(()=>verify(p));}
});
test('native cleanup failure open sessions and SQL errors are retained as denials',()=>{
 for(const edit of [p=>{p.cleanup.databaseRemoved=false;},p=>{p.cleanup.poolClosed=false;},p=>{p.cleanup.adminClosed=false;},p=>{p.cleanup.sourceBytesUnchanged=false;},p=>{p.cleanup.ownSessionsBeforeDrop=1;},p=>{p.cleanup.failureCode='FAILED';},p=>{p.sqlFailures.push({code:'XX000'});}]){const p=shadow();edit(p);denied(()=>verify(p));}
});
test('foreign database remote engine missing ownership and simulated lock acceptance are rejected',()=>{
 for(const edit of [p=>{p.engine.host='production.example';},p=>{p.engine.port=5433;},p=>{p.engine.version=160000;},p=>{p.ownership.datname='obrasaas_cutover_ci';},p=>{p.ownership.oid=null;},p=>{p.ownedConnectionPids=[];},p=>{p.lockObservations=[];},p=>{p.lockObservations[0].postgresReportedBlockingPid=false;}]){const p=shadow();edit(p);denied(()=>verify(p));}
});
test('a changed lease budget expiry fixture clock or production lease cannot pass',()=>{
 for(const [key,value]of [['normalServiceMs',150001],['expiryOnlyFixtureMs',60000],['sqlClockObservedBeforeRelease',false],['productionLeaseConfigurationChanged',true]]){const p=shadow();p.leaseFixtures[key]=value;denied(()=>verify(p));}
});
test('provider personal consent identity approval and production-write claims are rejected',()=>{
 for(const edit of [p=>{p.providerRequests=1;},p=>{p.counts.unexpectedNetwork=1;},p=>{p.productionDataWritten=true;},p=>{p.realConsentOrIdentityVerified=true;},p=>{p.humanApprovalPerformed=true;}]){const p=shadow();edit(p);denied(()=>verify(p));}
});
test('omitted foreign duplicate and tampered native source paths and raw hashes are rejected',()=>{
 for(const edit of [p=>{p.sourceManifest.pop();},p=>{p.sourceManifest[0].path='src/lib/foreign.mjs';},p=>{p.sourceManifest[1]=p.sourceManifest[0];},p=>{p.sourceManifest[0].sha256='f'.repeat(64);},p=>{p.sourceManifest[0].bytes++;},p=>{p.sourceDigest='f'.repeat(64);},p=>{p.harnessSha256='f'.repeat(64);}]){const p=shadow();edit(p);denied(()=>verify(p));}
});
test('current native source content is independently checked even if path and digest metadata remain unchanged',()=>{
 const changed=file=>file==='src/lib/participant-analysis-consent.mjs'?Buffer.concat([read(file),Buffer.from('\n// changed')]):read(file);
 denied(()=>validateParticipantKycPreanalysisNative(shadow(),{readSource:changed,nativeSourceFiles}));
});
const tap=Buffer.from('TAP version 13\nok 1 - current UI case\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');
test('unit TAP requires every named backend and UI case to run without skips or failure',()=>{
 assert.deepEqual(parseParticipantPreanalysisTap(tap),{tests:1,pass:1,fail:0,cancelled:0,skipped:0,todo:0,caseNames:['current UI case']});
 for(const text of [tap.toString().replace('ok 1','not ok 1'),tap.toString().replace('# skipped 0','# skipped 1'),tap.toString().replace('# pass 1','# pass 0'),tap.toString()+'# tests 1\n',tap.toString().replace('ok 1 - current UI case\n','')])denied(()=>parseParticipantPreanalysisTap(Buffer.from(text)));
});
test('a prior contract without the new extension authorizes no new preanalysis source revision',()=>{
 const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
 const prior=restoreParticipantPreanalysisPreviousContract(contract);
 assert.equal(sha(JSON.stringify(prior,null,2)+'\n'),'c2ba8944d4b004d31451f5bd248132295b4c4539704b87cca3d1305bef9160bb');
 assert.equal(prior.blocks.length,56);assert.equal(prior.extension.proofs.length,18);
 assert.equal(restoreParticipantPreanalysisPreviousContract(prior),prior);assert.equal(verifyParticipantPreanalysisCurrentSources(prior,read),null);
 assert.equal(sha(JSON.stringify(restoreOoxmlAccountingPreviousContract(contract),null,2)+'\n'),'63252e3af6a5e595f731302d33cf32e18182f24c75ac144cc062b0911efeda17');
 const historical=reconstructPublishedHContract(contract);assert.equal(historical.extension.proofs.length,18);
 assert.equal(historical.kycExpiredCurrentComposition.previousSourceCount,117);assert.equal(historical.kycExpiredCurrentComposition.sourceCount,125);
});
test('pending or foreign revision bindings cannot authorize source bytes before independent final freeze',()=>{
 const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
 assert.equal(PARTICIPANT_PREANALYSIS_CURRENT_REVISION.status,'REVIEWED_FROZEN_CURRENT_SOURCE');
 assert.deepEqual(contract.participantPreanalysisCurrentRevision.validationSources.map(row=>row.path),PARTICIPANT_PREANALYSIS_VALIDATION_PATHS);
 for(const edit of [value=>{value.status='PENDING_FINAL_SOURCE_FREEZE';},value=>{value.referenceHead='f'.repeat(40);},value=>{value.referenceTree='f'.repeat(40);},value=>{value.previousContractSha256='f'.repeat(64);},value=>{value.reviewedSourceChanges.pop();},value=>{value.consumerSourceDeltas[0].additions.pop();}]){
  const changed=structuredClone(contract);edit(changed.participantPreanalysisCurrentRevision);denied(()=>restoreParticipantPreanalysisPreviousContract(changed));
 }
 denied(()=>participantPreanalysisCurrentSourcePin(contract,{path:'src/lib/meta-kyc-identity.mjs',sha256:'f'.repeat(64)}));
});

test('every current preanalysis source pin and native producer rejects independent tampering',()=>{
 const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
 const result=verifyParticipantPreanalysisCurrentSources(contract,read);assert.equal(result.nativeAcceptance,false);assert.equal(result.historicalPinsPreserved,true);
 const paths=[...contract.participantPreanalysisCurrentRevision.reviewedSourceChanges.map(row=>row.path),...contract.participantPreanalysisCurrentRevision.validationDeltas.map(row=>row.path),...PARTICIPANT_PREANALYSIS_VALIDATION_PATHS,'scripts/verify-participant-kyc-preanalysis-postgres.mjs',...contract.participantPreanalysisCurrentRevision.unitSuites.map(row=>row.file)];
 for(const file of paths)denied(()=>verifyParticipantPreanalysisCurrentSources(contract,path=>path===file?Buffer.concat([read(path),Buffer.from('\n// foreign bytes')]):read(path)));
});

test('omitted delta source or new proof block cannot be concealed by an otherwise current contract',()=>{
 const contract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
 for(const edit of [value=>{value.extension.proofs.pop();},value=>{value.blocks.pop();},value=>{value.lanes.people.blocks.pop();},value=>{value.blocks.push(structuredClone(value.blocks.find(row=>row.id===63)));},value=>{value.extension.proofs.push(structuredClone(value.extension.proofs.find(row=>row.kind==='PG_PARTICIPANT_KYC_PREANALYSIS')));},value=>{value.artifactPatterns.pop();},value=>{value.extension.proofs.find(row=>row.id===value.participantPreanalysisCurrentRevision.proofSourceDeltas[0].id).sourceFiles.pop();}]){const changed=structuredClone(contract);edit(changed);denied(()=>restoreParticipantPreanalysisPreviousContract(changed));}
});

test('block63 binds all actual native source roots and the reviewed CI leaves without claiming PG execution',()=>{
 for(const kind of ['proof','block']){const changed=JSON.parse(read('.github/workspace-acceptance-contract.json')),target=kind==='proof'?changed.extension.proofs.find(row=>row.kind==='PG_PARTICIPANT_KYC_PREANALYSIS'):changed.blocks.find(row=>row.id===63);target.unreviewed=true;denied(()=>validateParticipantPreanalysisWorkspaceContract(changed));}
 const contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),result=validateParticipantPreanalysisWorkspaceContract(contract);
 assert.equal(result.nativeSourceCount,142);assert.equal(result.nativeCheckCount,19);assert.equal(result.nativeAcceptance,false);const checkpoint=restoreIntegratedIdentityPreviousContract(contract);assert.equal(checkpoint.blocks.length,57);assert.equal(checkpoint.extension.proofs.length,19);assert.equal(contract.blocks.length,58);assert.equal(contract.extension.proofs.length,20);
});

function ciShadow(){
 const contract=JSON.parse(read('.github/workspace-acceptance-contract.json')),revision=contract.participantPreanalysisCurrentRevision,spec=contract.extension.proofs.find(row=>row.kind==='PG_PARTICIPANT_KYC_PREANALYSIS'),evidence=new Map(),prefix='.vercel/private/participant-kyc-preanalysis-evidence/';
 const raw=Buffer.from(JSON.stringify(shadow(),null,2)+'\n');evidence.set(prefix+'native-original.json',raw);
 const unitSuites=revision.unitSuites.map((row,index)=>{const tap=Buffer.from('TAP version 13\n'+row.caseNames.map((name,i)=>'ok '+(i+1)+' - '+name+'\n').join('')+'1..'+row.caseNames.length+'\n# tests '+row.caseNames.length+'\n# pass '+row.caseNames.length+'\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'),path=prefix+'suite-'+index+'.tap';evidence.set(path,tap);return {file:row.file,sourceSha256:sha(read(row.file)),exitCode:0,tap:{path,bytes:tap.length,sha256:sha(tap)},result:parseParticipantPreanalysisTap(tap)};});
 const proof={version:PARTICIPANT_PREANALYSIS_CI_VERSION,status:'PASS',sourceRevision:'a'.repeat(40),sourceTree:'b'.repeat(40),sourceState:'EXACT_CI_SOURCE',trackedClean:true,dirtyTrackedPaths:[],ciRun:{repository:'inguillen87/obrasaas',runId:'123456789',runAttempt:'1',event:'workflow_dispatch',workflow:'Authorized workspace acceptance'},harnessSha256:sha(read(spec.producer)),sourceManifest:spec.sourceFiles.map(path=>({path,sha256:sha(read(path))})),checks:[...PARTICIPANT_KYC_PREANALYSIS_CHECKS],rawNative:{path:prefix+'native-original.json',bytes:raw.length,sha256:sha(raw)},unitSuites,providerRequests:0,productionDataWritten:false,realConsentOrIdentityVerified:false,humanApprovalPerformed:false};
 const context={expectedHead:proof.sourceRevision,expectedTree:proof.sourceTree,readSource:file=>{try{return read(file);}catch{return null;}},readEvidence:file=>evidence.get(file)||null,spec,runId:'123456789',runAttempt:'1'};
 return {proof,context,evidence,validate(){return validateParticipantKycPreanalysisCi(proof,context);}};
}

test('the new CI envelope independently binds the original raw native bytes and both complete executed unit matrices',()=>{
 const f=ciShadow(),before=JSON.stringify(f.proof),result=f.validate();assert.equal(JSON.stringify(f.proof),before);assert.equal(result.nativeCheckCount,19);assert.equal(result.nativeProofRewritten,false);assert.equal(result.humanApprovalPerformed,false);assert.equal(result.unitTests,f.proof.unitSuites.reduce((n,row)=>n+row.result.tests,0));
});
test('foreign CI head tree repository run attempt event and raw evidence cannot enter the new envelope',()=>{
 for(const edit of [f=>{f.proof.sourceRevision='f'.repeat(40);},f=>{f.proof.sourceTree='f'.repeat(40);},f=>{f.proof.ciRun.repository='foreign/repo';},f=>{f.proof.ciRun.runId='987654321';},f=>{f.proof.ciRun.runAttempt='2';},f=>{f.proof.ciRun.event='pull_request';},f=>{f.proof.rawNative.path='../private.json';},f=>{f.proof.rawNative.sha256='f'.repeat(64);},f=>{f.evidence.set(f.proof.rawNative.path,Buffer.from('{}'));}]){const f=ciShadow();edit(f);denied(()=>f.validate());}
});
test('unit source omission changed case order skipped TAP and a foreign current source remain denied by the envelope',()=>{
 for(const edit of [f=>{f.proof.unitSuites.pop();},f=>{f.proof.unitSuites[1].sourceSha256='f'.repeat(64);},f=>{f.proof.unitSuites[0].result.caseNames.reverse();},f=>{f.proof.unitSuites[1].tap.path=f.proof.unitSuites[0].tap.path;},f=>{f.proof.sourceManifest.pop();},f=>{f.proof.sourceManifest[0].path='src/lib/foreign.mjs';},f=>{f.proof.checks.pop();}]){const f=ciShadow();edit(f);denied(()=>f.validate());}
});
