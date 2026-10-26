import {PLAN_BUDGET_CURRENT_SECTION,restorePlanBudgetSourceSet,restoreOwnRuntimeDiagnosticPreviousContract,verifyPlanBudgetCurrentSources} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
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
function assertCurrentNativeGraph(family,close){
  // Only the two independently reviewed families can select a finite current advance.
  const reviewed=family==='ORGANIZATION_USAGE'?{close:organizationUsageCiSourceClosure,priorCount:120,publishedCount:115,beforeOwnCount:122,baselineCount:125,currentCount:132,baselineHash:"68a900cabdcb7bb88c080793d9f868993c429b0930621686494f48ff8f9fc5c9",currentHash:"acb7883a99077bb943da5c6b4eb91df94e8273271fbcd0f3f9fb4b7fb5d24e9b",additions:["scripts/lib/synthetic-capture-quality.mjs","src/lib/capture-quality-gate.mjs","src/lib/capture-quality-policy.mjs","src/lib/participant-facial-attempt.mjs","src/lib/participant-facial-policy.mjs","src/lib/participant-facial-precommit.mjs","src/lib/private-capture-quality.mjs"],missing:"scripts/lib/synthetic-capture-quality.mjs",missingCode:"ORGANIZATION_USAGE_CI_REJECTED",missingMessage:"Unresolved source import: scripts/fixtures/canonical-participant-kyc.mjs"}:family==='KYC_REPLY_FEEDBACK'?{close:kycReplyFeedbackSourceClosure,priorCount:116,publishedCount:111,beforeOwnCount:118,baselineCount:121,currentCount:127,baselineHash:"9e4dd45bcac9fab4e896801537440f4266d0ff0648fb3a0952cc6fc70934f77a",currentHash:"76f5c6a25d742d87243e57003a1ec905fe305462d259d23a1a1bc1dcb1638fa5",additions:["src/lib/capture-quality-gate.mjs","src/lib/capture-quality-policy.mjs","src/lib/participant-facial-attempt.mjs","src/lib/participant-facial-policy.mjs","src/lib/participant-facial-precommit.mjs","src/lib/private-capture-quality.mjs"],missing:"src/lib/capture-quality-gate.mjs",missingCode:"KYC_REPLY_FEEDBACK_CI_REJECTED",missingMessage:"Missing relative dependency ./capture-quality-gate.mjs from src/lib/participant-facial-precommit.mjs"}:null;
  assert.ok(reviewed,'Explicit reviewed native consumer family required');assert.equal(close,reviewed.close,'Original current collector required');
  const {priorCount,publishedCount}=reviewed,actual=close(read),value=contract(),before=JSON.stringify(actual),delta=value[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===family);
  assert.equal(delta.previousCount,priorCount);assert.equal(delta.currentCount,priorCount+1);assert.deepEqual(delta.additions,['src/lib/field-hours-report.mjs']);
  verifyPlanBudgetCurrentSources(value,read);
  const budgetDelta=value[PLAN_BUDGET_CURRENT_SECTION].sourceSetDeltas.find(row=>row.family===family),beforeBudget=restorePlanBudgetSourceSet(value,family,actual.files);
  assert.deepEqual(budgetDelta.additions,['src/lib/plan-budget-source.mjs']);
  const ownBase=restoreOwnRuntimeDiagnosticPreviousContract(value,read),beforeOwn=ownBase[PLAN_BUDGET_CURRENT_SECTION].sourceFamilies.find(row=>row.family===family).currentFiles,git67=[...beforeOwn,'src/lib/field-execution-policy.mjs','src/lib/field-execution-store.mjs','src/lib/meta-field-execution-conversation.mjs'].sort();
  assert.equal(beforeOwn.length,reviewed.beforeOwnCount);assert.equal(git67.length,reviewed.baselineCount);assert.equal(sha(JSON.stringify(git67)),reviewed.baselineHash);assert.deepEqual(actual.files,[...git67,...reviewed.additions].sort());assert.equal(actual.files.length,reviewed.currentCount);assert.equal(sha(JSON.stringify(actual.files)),reviewed.currentHash);
  for(const file of reviewed.additions){const row=value[PLAN_BUDGET_CURRENT_SECTION].ownRuntimeDiagnosticAdvance.sourceChanges.find(row=>row.path===file);assert.equal(row.status,'ADDED');assert.equal(row.previousSha256,null);assert.equal(row.previousBytes,0);assert.equal(sha(read(file).toString('utf8').replaceAll('\r\n','\n')),row.currentSha256);}
  assert.equal(beforeOwn.length,budgetDelta.currentCount);assert.equal(sha(JSON.stringify(beforeOwn)),budgetDelta.currentPathsSha256);assert.deepEqual(beforeOwn,[...beforeBudget,...budgetDelta.additions].sort());
  assert.equal(beforeBudget.length,delta.currentCount);assert.equal(sha(JSON.stringify(beforeBudget)),delta.currentPathsSha256);
  const previous=restoreWorksiteLiveHoursSourceSet(value,family,actual.files);assert.equal(previous.length,priorCount);assert.equal(sha(JSON.stringify(previous)),delta.previousPathsSha256);assert.deepEqual([...previous,...delta.additions].sort(),beforeBudget);
  assert.equal(participantPreanalysisConsumerSourceFiles(family,actual.files,read).length,publishedCount);
  assert.equal(verifyWorksiteLiveHoursActualClosure(value,family,actual,read).nativeOrBrowserAcceptance,false);
  assert.throws(()=>close(file=>file===reviewed.missing?null:read(file)),error=>error?.code===reviewed.missingCode&&error.message===reviewed.missingMessage);
  const changed=Buffer.concat([read(reviewed.missing),Buffer.from('\n// changed current KYC dependency\n')]);rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,actual,file=>file===reviewed.missing?changed:read(file)));
  const foreign='src/lib/foreign-current-kyc.mjs';rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,{...actual,files:[...actual.files,foreign].sort()},file=>file===foreign?read(reviewed.missing):read(file)));
  assert.equal(JSON.stringify(actual),before);
}

function assertRejectedSourceShapes(family,close){
  const actual=close(read),value=contract(),altered=actual.files.map(path=>path==='src/lib/field-hours-report.mjs'?'src/lib/foreign-hours-report.mjs':path).sort();
  for(const files of [actual.files.filter(path=>path!=='src/lib/plan-budget-source.mjs'),actual.files.filter(path=>path!=='src/lib/field-hours-report.mjs'),[actual.files[0],...actual.files.slice(0,-1)].sort(),[...actual.files].reverse(),altered])rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,{...actual,files},file=>file==='src/lib/foreign-hours-report.mjs'?read('src/lib/field-hours-report.mjs'):read(file)));
}

function assertChangedSourceRead(family,close){
  const actual=close(read),value=contract(),path='src/lib/workspace-policy.mjs';assert.ok(actual.files.includes(path));verifyWorksiteLiveHoursActualClosure(value,family,actual,read);
  const changed=Buffer.concat([read(path),Buffer.from('\n// changed after the first source read\n')]);rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,actual,file=>file===path?changed:read(file)));
}

function assertCorrelatedSourceTamper(family,close){
  const actual=close(read),value=contract(),path='src/lib/workspace-policy.mjs',changed=Buffer.concat([read(path),Buffer.from('\n// correlated contract/source tamper\n')]);
  const row=value[WORKSITE_LIVE_HOURS_CURRENT_SECTION].sourceFamilies.find(row=>row.family===family).currentManifest.find(row=>row.path===path);assert.ok(row);row.sha256=sha(changed);
  rejected(()=>verifyWorksiteLiveHoursCurrentSources(value,file=>file===path?changed:read(file)));rejected(()=>verifyWorksiteLiveHoursActualClosure(value,family,actual,file=>file===path?changed:read(file)));
}

test("ORGANIZATION_USAGE current native graph restores its complete historical layers without changing the current proof",()=>assertCurrentNativeGraph("ORGANIZATION_USAGE",organizationUsageCiSourceClosure));
test("ORGANIZATION_USAGE omission duplicate reordered and same-count resolvable foreign sources cannot satisfy the current family",()=>assertRejectedSourceShapes("ORGANIZATION_USAGE",organizationUsageCiSourceClosure));
test("ORGANIZATION_USAGE a later changed unchanged-source read is rejected after the first valid content check",()=>assertChangedSourceRead("ORGANIZATION_USAGE",organizationUsageCiSourceClosure));
test("ORGANIZATION_USAGE correlated current content and contract-manifest edits cannot replace the compiled trust anchor",()=>assertCorrelatedSourceTamper("ORGANIZATION_USAGE",organizationUsageCiSourceClosure));
test("KYC_REPLY_FEEDBACK current native graph restores its complete historical layers without changing the current proof",()=>assertCurrentNativeGraph("KYC_REPLY_FEEDBACK",kycReplyFeedbackSourceClosure));
test("KYC_REPLY_FEEDBACK omission duplicate reordered and same-count resolvable foreign sources cannot satisfy the current family",()=>assertRejectedSourceShapes("KYC_REPLY_FEEDBACK",kycReplyFeedbackSourceClosure));
test("KYC_REPLY_FEEDBACK a later changed unchanged-source read is rejected after the first valid content check",()=>assertChangedSourceRead("KYC_REPLY_FEEDBACK",kycReplyFeedbackSourceClosure));
test("KYC_REPLY_FEEDBACK correlated current content and contract-manifest edits cannot replace the compiled trust anchor",()=>assertCorrelatedSourceTamper("KYC_REPLY_FEEDBACK",kycReplyFeedbackSourceClosure));
