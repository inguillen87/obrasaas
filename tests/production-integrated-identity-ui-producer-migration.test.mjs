import {restoreIdentityDestinationUxPreviousProducerText} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 INTEGRATED_IDENTITY_CURRENT_REVISION,INTEGRATED_IDENTITY_VALIDATION_PATHS,
 INTEGRATED_IDENTITY_CHECKPOINT_PATH,INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH,
 INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_SHA256,INTEGRATED_IDENTITY_UI_PRODUCER_PATHS,
 authenticateIntegratedIdentityUiProducerMigrationSource,restoreIntegratedIdentityUiProducerText,
 composeIntegratedIdentityContract,restoreIntegratedIdentityPreviousContract,
 integratedIdentityCurrentSourcePin,integratedIdentityCurrentUiProducerPin,
 verifyIntegratedIdentityCurrentSources
} from '../scripts/lib/integrated-identity-current-ci-lineage.mjs';
import {verifyPlanMeasurementCurrentSources,restorePlanMeasurementPublishedGProducerText} from '../scripts/lib/plan-measurement-current-ci-lineage.mjs';

const root=new URL('../',import.meta.url),read=file=>readFileSync(new URL(file,root));
const sha=value=>createHash('sha256').update(value).digest('hex');
const lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));
const actualContract=JSON.parse(read('.github/workspace-acceptance-contract.json'));
const publishedProducer=(file,bytes=read(file))=>actualContract.identityDestinationUxCurrentRevision?.browser.producerDelta.producer===file?restoreIdentityDestinationUxPreviousProducerText(actualContract,file,bytes):bytes;
const fixture=authenticateIntegratedIdentityUiProducerMigrationSource(read(INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH));
const denied=fn=>assert.throws(fn,{code:'INTEGRATED_IDENTITY_CURRENT_CI_LINEAGE_REJECTED'});
// This is a pure current-metadata shadow, not a native/browser result. Its
// validation leaves use actual checkout bytes, including this test itself.
function current(){const value=structuredClone(INTEGRATED_IDENTITY_CURRENT_REVISION);value.validationSources=INTEGRATED_IDENTITY_VALIDATION_PATHS.map(path=>({path,sha256:sha(lf(read(path)))}));return composeIntegratedIdentityContract(value);}

test('UI producer migration authenticates all nine exact source inverses and enumerates the validation JSON',()=>{
 assert.equal(sha(lf(read(INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH))),INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_SHA256);
 assert.equal(fixture.referenceHead,'86f2c484f3d4affb10d1852a320956c4c46aae99');assert.equal(fixture.reviewedHead,'600a0887691077748e82f06388a16187b56bf4c5');assert.equal(fixture.historicalProofsRewritten,false);
 assert.equal(fixture.producers.length,9);assert.deepEqual(INTEGRATED_IDENTITY_UI_PRODUCER_PATHS,fixture.producers.map(row=>row.path));assert.deepEqual(INTEGRATED_IDENTITY_UI_PRODUCER_PATHS,[...new Set(INTEGRATED_IDENTITY_UI_PRODUCER_PATHS)].sort());
 const c=current();assert.ok(c.integratedIdentityCurrentRevision.addedSources.some(row=>row.path===INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH&&row.sha256===INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_SHA256));assert.ok(c.integratedIdentityCurrentRevision.validationSources.some(row=>row.path===INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH));assert.ok(c.integratedIdentityCurrentRevision.validationSources.some(row=>row.path===fileURLToPath(import.meta.url).replaceAll('\\','/').split('/').slice(-2).join('/')));
 for(const row of fixture.producers){const raw=publishedProducer(row.path),restored=restoreIntegratedIdentityUiProducerText(row.path,raw);assert.equal(sha(lf(raw)),row.currentSha256);assert.equal(lf(raw).length,row.currentBytes);assert.equal(sha(restored),row.previousSha256);assert.equal(restored.length,row.previousBytes);assert.equal(integratedIdentityCurrentSourcePin(c,{path:row.path,sha256:row.previousSha256}),row.currentSha256);}
});
test('UI producer history accepts exact LF and Windows CRLF without rewriting current raw sources',()=>{
 for(const row of fixture.producers){const before=read(row.path),currentLf=lf(publishedProducer(row.path,before)),old=restoreIntegratedIdentityUiProducerText(row.path,currentLf),windows=Buffer.from(currentLf.toString('utf8').replaceAll('\n','\r\n'));assert.deepEqual(restoreIntegratedIdentityUiProducerText(row.path,windows),old);assert.deepEqual(restoreIntegratedIdentityUiProducerText(row.path,old),old);assert.deepEqual(restoreIntegratedIdentityUiProducerText(row.path,Buffer.from(old.toString('utf8').replaceAll('\n','\r\n'))),old);assert.deepEqual(read(row.path),before);}
 assert.equal(authenticateIntegratedIdentityUiProducerMigrationSource(Buffer.from(lf(read(INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH)).toString('utf8').replaceAll('\n','\r\n'))).producers.length,9);
});
test('UI producer altered current historical missing and extra bytes remain rejected',()=>{
 for(const row of fixture.producers){const raw=publishedProducer(row.path),old=restoreIntegratedIdentityUiProducerText(row.path,raw);for(const bytes of [null,Buffer.concat([raw,Buffer.from('\n')]),raw.subarray(1),Buffer.concat([old,Buffer.from('\n')]),old.subarray(1),Buffer.from([0xff])])denied(()=>restoreIntegratedIdentityUiProducerText(row.path,bytes));}
 denied(()=>restoreIntegratedIdentityUiProducerText('scripts/verify-clerk-access-ui.mjs',read(fixture.producers[0].path)));denied(()=>restoreIntegratedIdentityUiProducerText('scripts/foreign.mjs',Buffer.from('')));
});
test('UI producer migration rejects altered hash old body extra path hunk and encoding',()=>{
 for(const edit of [x=>{x.producers[0].currentSha256='f'.repeat(64);},x=>{x.producers[0].previousSha256='f'.repeat(64);},x=>{x.producers[0].inverseHunks[0].previousText+='\n';},x=>{x.producers.push(x.producers[0]);},x=>{x.producers[0].path='scripts/foreign.mjs';},x=>{x.historicalProofsRewritten=true;}]){const changed=structuredClone(fixture);edit(changed);denied(()=>authenticateIntegratedIdentityUiProducerMigrationSource(Buffer.from(JSON.stringify(changed,null,2)+'\n')));}
 denied(()=>authenticateIntegratedIdentityUiProducerMigrationSource(null));denied(()=>authenticateIntegratedIdentityUiProducerMigrationSource(Buffer.from([0xff])));denied(()=>authenticateIntegratedIdentityUiProducerMigrationSource(Buffer.concat([read(INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH),Buffer.from(' ')])));
});
test('UI producer current gate denies every old-as-current source and missing substituted validation JSON',()=>{
 const c=JSON.parse(read('.github/workspace-acceptance-contract.json'));denied(()=>verifyIntegratedIdentityCurrentSources(current(),read));assert.equal(verifyIntegratedIdentityCurrentSources(c,read).historicalPinsPreserved,true);
 for(const row of fixture.producers){const old=restoreIntegratedIdentityUiProducerText(row.path,publishedProducer(row.path));denied(()=>verifyIntegratedIdentityCurrentSources(c,file=>file===row.path?old:read(file)));denied(()=>verifyIntegratedIdentityCurrentSources(c,file=>file===row.path?null:read(file)));}
 for(const value of [null,Buffer.from('{}'),Buffer.concat([read(INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH),Buffer.from('\n')])])denied(()=>verifyIntegratedIdentityCurrentSources(c,file=>file===INTEGRATED_IDENTITY_UI_PRODUCER_MIGRATION_PATH?value:read(file)));
});
test('current identity proof and evidence record share reviewed Git SHA with identical historical cases',()=>{
 const c=current(),previous=restoreIntegratedIdentityPreviousContract(c),old=previous.extension.proofs.find(row=>row.id==='identity-only-ui'),proof=c.extension.proofs.find(row=>row.id===old.id),record=c.evidenceProducers.find(row=>row.path===proof.path),row=fixture.producers.find(row=>row.path===proof.producer);
 assert.equal(old.producerSha256,row.previousSha256);assert.equal(proof.producerSha256,row.currentSha256);assert.equal(record.producerSha256,row.currentSha256);assert.equal(sha(lf(publishedProducer(proof.producer))),proof.producerSha256);assert.deepEqual(proof.checkNames,old.checkNames);assert.equal(proof.checkNames.length,103);
 assert.equal(integratedIdentityCurrentUiProducerPin(c,{path:proof.producer,sha256:proof.producerSha256}),proof.producerSha256);assert.equal(integratedIdentityCurrentSourcePin(c,{path:proof.producer,sha256:proof.producerSha256}),proof.producerSha256);
 for(const changed of [{path:proof.producer,sha256:'f'.repeat(64)},{path:fixture.producers[0].path,sha256:fixture.producers[0].currentSha256}])denied(()=>integratedIdentityCurrentUiProducerPin(c,changed));
 for(const row of fixture.producers.filter(row=>row.path!==proof.producer))denied(()=>integratedIdentityCurrentSourcePin(c,{path:row.path,sha256:row.currentSha256}));
 const bad=structuredClone(c);bad.extension.proofs.find(row=>row.id===proof.id).producerSha256=row.previousSha256;denied(()=>integratedIdentityCurrentUiProducerPin(bad,{path:proof.producer,sha256:row.currentSha256}));denied(()=>restoreIntegratedIdentityPreviousContract(bad));
});
test('UI migration retains complete checkpoint and native source sets and every case matrix',()=>{
 const c=current(),restored=restoreIntegratedIdentityPreviousContract(c),checkpoint=JSON.parse(read(INTEGRATED_IDENTITY_CHECKPOINT_PATH));assert.deepEqual(restored,checkpoint);assert.equal(sha(JSON.stringify(restored,null,2)+'\n'),'3c1a184f2e6839bba6bd7116ccf6c062fbb015500ec4900583dbd15f82fe7270');
 assert.deepEqual(c.participantPreanalysisCurrentRevision.nativeSourceFiles,JSON.parse(read('.github/workspace-acceptance-contract.json')).participantPreanalysisCurrentRevision.nativeSourceFiles);assert.deepEqual(c.integratedIdentityCurrentRevision.companyCurrentCaseNames,INTEGRATED_IDENTITY_CURRENT_REVISION.companyCurrentCaseNames);assert.deepEqual(c.integratedIdentityCurrentRevision.ownCurrentCaseFacts,INTEGRATED_IDENTITY_CURRENT_REVISION.ownCurrentCaseFacts);
 assert.equal(c.integratedIdentityCurrentRevision.validationDeltas.filter(row=>row.path==='scripts/lib/plan-measurement-current-ci-lineage.mjs').length,1);const prior=checkpoint.integratedIdentityCurrentRevision;assert.equal(prior,undefined);
});
test('Plan lower validator restores unchanged I G and H lineage while binding actual current UI producers',()=>{
 assert.throws(()=>verifyPlanMeasurementCurrentSources(current(),read),{code:'PLAN_MEASUREMENT_CURRENT_CI_LINEAGE_REJECTED'});
 const c=JSON.parse(read('.github/workspace-acceptance-contract.json')),result=verifyPlanMeasurementCurrentSources(c,read);assert.equal(result.publishedCurrentSourceCount,127);assert.equal(result.previousSourceCount,125);assert.equal(result.historicalSourceCount,117);assert.equal(result.publishedContractSha256,'9dab901cb93f3834cad0f1ea9ba386c5bb12acc913463a7dfb6368847af3fd37');
 const producer='scripts/verify-workspace-plan-recovery-ui.mjs',raw=read(producer),old=restoreIntegratedIdentityUiProducerText(producer,raw),section=c.planMeasurementCurrentLineage;assert.equal(sha(restorePlanMeasurementPublishedGProducerText(section,producer,raw)),'9835f6f8af3a3d81bc770aa611bcf9233324a7ff196d63f4a1c9194c5b931f51');assert.equal(restorePlanMeasurementPublishedGProducerText(section,producer,raw),restorePlanMeasurementPublishedGProducerText(section,producer,old));
 assert.throws(()=>verifyPlanMeasurementCurrentSources(c,file=>file===producer?old:read(file)));assert.throws(()=>restorePlanMeasurementPublishedGProducerText(section,producer,Buffer.concat([raw,Buffer.from('\n')])));
});
