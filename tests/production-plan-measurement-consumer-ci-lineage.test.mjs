import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {organizationUsageCiSourceClosure} from '../scripts/verify-organization-usage-ci.mjs';
import {consumptionFeedbackSourceClosure} from '../scripts/verify-consumption-feedback-ci.mjs';
import {kycReplyFeedbackSourceClosure} from '../scripts/verify-kyc-reply-feedback-ci.mjs';
import {PLAN_MEASUREMENT_CONSUMER_CI_HELPER,PLAN_MEASUREMENT_CONSUMER_CI_VERSION,PLAN_MEASUREMENT_CONSUMER_SOURCES,PLAN_MEASUREMENT_CONSUMER_LINEAGE,validatePlanMeasurementConsumerSourceLineage} from '../scripts/lib/plan-measurement-consumer-ci-lineage.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readSource=file=>existsSync(path.join(root,file))?readFileSync(path.join(root,file)):null;
for(const [family,close]of [['ORGANIZATION_USAGE',organizationUsageCiSourceClosure],['CONSUMPTION_FEEDBACK',consumptionFeedbackSourceClosure],['KYC_REPLY_FEEDBACK',kycReplyFeedbackSourceClosure]]){
 const files=close(readSource).files,expected=PLAN_MEASUREMENT_CONSUMER_LINEAGE[family];
 const validate=(candidate=files,reader=readSource)=>validatePlanMeasurementConsumerSourceLineage({family,files:candidate,readSource:reader});
 const rejects=(candidate,reader)=>assert.throws(()=>validate(candidate,reader),{code:'PLAN_MEASUREMENT_CONSUMER_LINEAGE_REJECTED'});
 test(family+' exact AST CURRENT adds two files and retains previous producer and source hashes',()=>{
  const before=JSON.stringify(files),value=validate();assert.equal(JSON.stringify(files),before);assert.equal(value.version,PLAN_MEASUREMENT_CONSUMER_CI_VERSION);assert.equal(value.previousSourceCount,expected.previousSourceCount);assert.equal(value.sourceCount,expected.previousSourceCount+2);assert.equal(value.nativeCheckCount,expected.nativeCheckCount);assert.deepEqual(value.sourceAdditions,PLAN_MEASUREMENT_CONSUMER_SOURCES);
  assert.equal(sha(JSON.stringify(files.filter(file=>!PLAN_MEASUREMENT_CONSUMER_SOURCES.includes(file)))),expected.previousSourcePathsSha256);assert.equal(value.validationSource.sha256,sha(readSource(PLAN_MEASUREMENT_CONSUMER_CI_HELPER)));for(const ref of value.sourceReferences)assert.equal(ref.sha256,sha(readSource(ref.path)));
 });
 test(family+' previous receipt paths cannot satisfy current source import',()=>rejects(files.filter(file=>!PLAN_MEASUREMENT_CONSUMER_SOURCES.includes(file))));
 test(family+' omissions duplicates reordering and extras remain denied',()=>{rejects(files.slice(1));rejects([files[0],...files.slice(0,-1)].sort());rejects([...files].reverse());rejects([...files,'src/lib/extra.mjs'].sort());});
 test(family+' same-count resolvable substitution cannot replace a source or historical node',()=>{
  for(const original of [...PLAN_MEASUREMENT_CONSUMER_SOURCES,'src/lib/workspace-policy.mjs']){const foreign='src/lib/foreign-measurement.mjs',changed=files.map(file=>file===original?foreign:file).sort();assert.equal(changed.length,files.length);rejects(changed,file=>file===foreign?readSource(original):readSource(file));}
 });
 test(family+' missing raw committed bytes and resealed producer remain denied',()=>{
  for(const missing of [...PLAN_MEASUREMENT_CONSUMER_SOURCES,expected.producer,PLAN_MEASUREMENT_CONSUMER_CI_HELPER])rejects(files,file=>file===missing?null:readSource(file));
  rejects(files,file=>file===expected.producer?Buffer.concat([readSource(file),Buffer.from('\n// Resealed current producer\n')]):readSource(file));
 });
}
test('unknown consumer cannot reinterpret another published lineage',()=>assert.throws(()=>validatePlanMeasurementConsumerSourceLineage({family:'FOREIGN',files:[],readSource}),{code:'PLAN_MEASUREMENT_CONSUMER_LINEAGE_REJECTED'}));
