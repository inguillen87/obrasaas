import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,restoreWorksiteLiveHoursSourceSet,verifyWorksiteLiveHoursCurrentSources,verifyWorksiteLiveHoursActualClosure} from '../scripts/lib/worksite-live-hours-current-ci-lineage.mjs';
import {participantPreanalysisConsumerSourceFiles} from '../scripts/lib/participant-preanalysis-current-ci-lineage.mjs';
import {organizationUsageCiSourceClosure} from '../scripts/verify-organization-usage-ci.mjs';
import {kycReplyFeedbackSourceClosure} from '../scripts/verify-kyc-reply-feedback-ci.mjs';

const root=new URL('../',import.meta.url),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>existsSync(new URL(file,root))?readFileSync(new URL(file,root)):null;
const contract=()=>JSON.parse(read('.github/workspace-acceptance-contract.json'));
const rejected=run=>assert.throws(run,{code:'WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED'});
for(const [family,close,priorCount,publishedCount]of [['ORGANIZATION_USAGE',organizationUsageCiSourceClosure,120,115],['KYC_REPLY_FEEDBACK',kycReplyFeedbackSourceClosure,116,111]]){
 test(family+' current native graph restores its complete historical layers without changing the current proof',()=>{
  const actual=close(read),value=contract(),before=JSON.stringify(actual),delta=value[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===family);
  assert.equal(delta.previousCount,priorCount);assert.equal(delta.currentCount,priorCount+1);assert.deepEqual(delta.additions,['src/lib/field-hours-report.mjs']);
  assert.equal(actual.files.length,delta.currentCount);assert.equal(sha(JSON.stringify(actual.files)),delta.currentPathsSha256);
  const previous=restoreWorksiteLiveHoursSourceSet(value,family,actual.files);assert.equal(previous.length,priorCount);assert.equal(sha(JSON.stringify(previous)),delta.previousPathsSha256);assert.deepEqual([...previous,...delta.additions].sort(),actual.files);
  assert.equal(participantPreanalysisConsumerSourceFiles(family,actual.files,read).length,publishedCount);
  assert.equal(verifyWorksiteLiveHoursActualClosure(value,family,actual,read).nativeOrBrowserAcceptance,false);assert.equal(JSON.stringify(actual),before);
 });
 test(family+' omission duplicate reordered and same-count resolvable foreign sources cannot satisfy the current family',()=>{
  const actual=close(read),value=contract(),altered=actual.files.map(path=>path==='src/lib/field-hours-report.mjs'?'src/lib/foreign-hours-report.mjs':path).sort();
  for(const files of [actual.files.filter(path=>path!=='src/lib/field-hours-report.mjs'),[actual.files[0],...actual.files.slice(0,-1)].sort(),[...actual.files].reverse(),altered])rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,{...actual,files},file=>file==='src/lib/foreign-hours-report.mjs'?read('src/lib/field-hours-report.mjs'):read(file)));
 });
 test(family+' a later changed unchanged-source read is rejected after the first valid content check',()=>{
  const actual=close(read),value=contract(),path='src/lib/workspace-policy.mjs';assert.ok(actual.files.includes(path));verifyWorksiteLiveHoursActualClosure(value,family,actual,read);
  const changed=Buffer.concat([read(path),Buffer.from('\n// changed after the first source read\n')]);rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,actual,file=>file===path?changed:read(file)));
 });
 test(family+' correlated current content and contract-manifest edits cannot replace the compiled trust anchor',()=>{
  const actual=close(read),value=contract(),path='src/lib/workspace-policy.mjs',changed=Buffer.concat([read(path),Buffer.from('\n// correlated contract/source tamper\n')]);
  const row=value[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceFamilies.find(row=>row.family===family).currentManifest.find(row=>row.path===path);assert.ok(row);row.sha256=sha(changed);
  rejected(()=>verifyWorksiteLiveHoursCurrentSources(value,file=>file===path?changed:read(file)));rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,actual,file=>file===path?changed:read(file)));
 });
}
