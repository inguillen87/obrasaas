import {MATERIAL_NATIVE_PRE_DOCUMENT_SOURCES,MATERIAL_UI_PRE_DOCUMENT_SOURCES} from './fixtures/feedback-ci-historical-source-sets.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateConsumptionFeedbackCi,consumptionFeedbackSourceClosure,CONSUMPTION_FEEDBACK_CI_VERSION,CONSUMPTION_FEEDBACK_UI_WIDTHS,CONSUMPTION_FEEDBACK_UI_CASES} from '../scripts/verify-consumption-feedback-ci.mjs';
import {MATERIAL_CONSUMPTION_FEEDBACK_CHECKS,MATERIAL_CONSUMPTION_FEEDBACK_PROOF_VERSION} from '../scripts/verify-material-consumption-feedback-postgres.mjs';
import {MATERIAL_FEEDBACK_HISTORICAL_97_SOURCES,MATERIAL_FEEDBACK_HISTORICAL_100_SOURCES} from './fixtures/feedback-ci-historical-source-sets.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),sources=Object.create(null),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const readSource=file=>{const filename=path.join(root,file);if(!existsSync(filename))return null;if(!Object.hasOwn(sources,file))sources[file]=readFileSync(filename);return sources[file];};
const native=consumptionFeedbackSourceClosure(readSource),browser=consumptionFeedbackSourceClosure(readSource,{ui:true});
for(const file of ['scripts/verify-consumption-feedback-ui.mjs','scripts/lib/owned-fixture-cleanup.mjs'])readSource(file);
const manifest=files=>files.map(file=>({path:file,sha256:sha(sources[file])}));
const head='a'.repeat(40),tree='b'.repeat(40),operationId=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function fixture(){
 const provenance={sourceRevision:head,sourceTree:tree,trackedClean:true,status:'PASS',productionDataWritten:false};
 const checks=[...CONSUMPTION_FEEDBACK_UI_WIDTHS.map(width=>({check:'true-consumption-history-progressive-references-long-content',width,documentWidth:width,targets:[{tag:'BUTTON',height:44,width:80}],cards:[{text:'Pending',dates:[]},{text:'Approved',dates:[]},{text:'Rejected',dates:[]},{text:'Reversed',dates:['2026-10-12T13:00:00.000Z','2026-10-12T16:00:00.000Z']}]})),...CONSUMPTION_FEEDBACK_UI_CASES.map((check,index)=>({check,...(index>=1&&index<=4?{operationId:operationId(index)}:{}),...(index===5||index===6?{beforeCards:4,afterCards:0,afterReceipts:0,afterForms:0,postCount:0}:{})}))];
 return {expectedHead:head,head,sourceTree:tree,trackedClean:true,gitSources:{...sources},postgres:{...provenance,version:MATERIAL_CONSUMPTION_FEEDBACK_PROOF_VERSION,sourceState:'EXACT_CI_SOURCE',environment:'local-disposable-postgresql',postgresExecuted:true,providerCalls:0,realIdentityDocuments:false,poolClosed:true,databaseRemoved:true,totalCheckCount:23,checks:[...MATERIAL_CONSUMPTION_FEEDBACK_CHECKS],sourceManifest:manifest(native.files),harnessSha256:sha(sources['scripts/verify-material-consumption-feedback-postgres.mjs'])},ui:{...provenance,sourceState:'clean',environment:'isolated-localhost-next-exact-jsx-synthetic-api',widths:[...CONSUMPTION_FEEDBACK_UI_WIDTHS],checks,sourceManifest:manifest(browser.files),externalImports:[...browser.externalImports],harnessSha256:sha(sources['scripts/verify-consumption-feedback-ui.mjs']),cleanupHelperSha256:sha(sources['scripts/lib/owned-fixture-cleanup.mjs']),pageErrors:[],interceptErrors:[],externalRequests:[],providerRequests:0,productionLoginVerified:false,physicalDeviceAccepted:false,cleanup:{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true,fixtureCleanupProof:{fixtureRemoved:true,postcondition:{absent:true}}}}};
}
function rejected(mutate){const input=fixture();mutate(input);assert.throws(()=>validateConsumptionFeedbackCi(input),{code:'CONSUMPTION_FEEDBACK_CI_REJECTED'});}

test('CI validator accepts the complete exact native/browser contracts without running either producer',()=>{
 assert.equal(native.files.length,108);assert.equal(browser.files.length,20);
 const input=fixture(),before=JSON.stringify(input),result=validateConsumptionFeedbackCi(input);
 assert.equal(JSON.stringify(input),before);assert.equal(result.version,CONSUMPTION_FEEDBACK_CI_VERSION);assert.equal(result.status,'PASS');assert.equal(result.sourceRevision,head);assert.equal(result.postgres.totalCheckCount,23);assert.equal(result.postgres.sourceCount,108);assert.equal(result.ui.totalCheckCount,12);assert.equal(result.ui.sourceCount,20);assert.equal(result.productionLoginVerified,false);assert.equal(result.productionDataWritten,false);assert.equal(result.providerCalls,0);
 // Challenge the new graph with the independently frozen pre-document path set.
 assert.equal(MATERIAL_NATIVE_PRE_DOCUMENT_SOURCES.length,105);
 assert.deepEqual(native.files.filter(file=>!['src/lib/plan-baseline-policy.mjs','src/lib/plan-import-document-curve.mjs','src/lib/field-report-feedback.mjs'].includes(file)),MATERIAL_NATIVE_PRE_DOCUMENT_SOURCES);
 rejected(input=>{input.postgres.sourceManifest=manifest(MATERIAL_NATIVE_PRE_DOCUMENT_SOURCES);});
 for(const file of ["src/lib/plan-baseline-policy.mjs", "src/lib/plan-import-document-curve.mjs"]){rejected(input=>{input.postgres.sourceManifest=input.postgres.sourceManifest.filter(ref=>ref.path!==file);});rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).path='src/lib/substituted-document-curve.mjs';});rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});rejected(input=>{delete input.gitSources[file];});}
 for(const file of ["src/lib/plan-import-document-curve.mjs"]){rejected(input=>{input.ui.sourceManifest=input.ui.sourceManifest.filter(ref=>ref.path!==file);});rejected(input=>{input.ui.sourceManifest.find(ref=>ref.path===file).path='src/lib/substituted-document-curve.mjs';});rejected(input=>{input.ui.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});rejected(input=>{delete input.gitSources[file];});}
 assert.equal(MATERIAL_UI_PRE_DOCUMENT_SOURCES.length,19);assert.deepEqual(browser.files.filter(file=>file!=='src/lib/plan-import-document-curve.mjs'),MATERIAL_UI_PRE_DOCUMENT_SOURCES);rejected(input=>{input.ui.sourceManifest=manifest(MATERIAL_UI_PRE_DOCUMENT_SOURCES);});

});
test('current signed KYC reply imports require their exact immutable source bytes',()=>{
 for(const file of ['src/lib/meta-kyc-identity.mjs','src/lib/meta-kyc-rejection-policy.mjs','src/lib/meta-kyc-rejection.mjs']){
  assert.equal(native.files.filter(source=>source===file).length,1);
  rejected(input=>{input.postgres.sourceManifest=input.postgres.sourceManifest.filter(ref=>ref.path!==file);});
  rejected(input=>{const ref=input.postgres.sourceManifest.find(ref=>ref.path===file);ref.path='src/lib/foreign-kyc-reply-source.mjs';assert.equal(input.postgres.sourceManifest.length,108);});
  rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  rejected(input=>{delete input.gitSources[file];});
 }
});
test('the historical 97-source receipt cannot certify the current signed reply reader',()=>{
 assert.equal(MATERIAL_FEEDBACK_HISTORICAL_97_SOURCES.length,97);
 rejected(input=>{input.postgres.sourceManifest=manifest(MATERIAL_FEEDBACK_HISTORICAL_97_SOURCES);assert.equal(input.postgres.sourceManifest.length,97);});
});
test('current usage policy cannot be omitted, substituted or certified by a historical 100-source receipt',()=>{
 const files=['src/lib/organization-usage-policy.mjs','src/lib/organization-resource-usage-policy.mjs'];
 for(const file of files){
  assert.equal(native.files.filter(source=>source===file).length,1);
  rejected(input=>{input.postgres.sourceManifest=input.postgres.sourceManifest.filter(ref=>ref.path!==file);assert.equal(input.postgres.sourceManifest.length,107);});
  rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-usage-policy.mjs';assert.equal(input.postgres.sourceManifest.length,108);});
  rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  rejected(input=>{delete input.gitSources[file];});
 }
 assert.equal(MATERIAL_FEEDBACK_HISTORICAL_100_SOURCES.length,100);
 rejected(input=>{input.postgres.sourceManifest=manifest(MATERIAL_FEEDBACK_HISTORICAL_100_SOURCES);assert.equal(input.postgres.sourceManifest.length,100);});
});
test('durable civil source lineage cannot be omitted, substituted or certified by the pre-civil manifest',()=>{
 const files=['src/lib/participant-civil-store.mjs','src/lib/participant-civil-policy.mjs','src/lib/bindx-civil-data-client.mjs'];
 for(const file of files){
  assert.equal(native.files.filter(source=>source===file).length,1);
  rejected(input=>{input.postgres.sourceManifest=input.postgres.sourceManifest.filter(ref=>ref.path!==file);});
  rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-civil-source.mjs';assert.equal(input.postgres.sourceManifest.length,108);});
  rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
  rejected(input=>{delete input.gitSources[file];});
 }
 rejected(input=>{input.postgres.sourceManifest=input.postgres.sourceManifest.filter(ref=>!files.includes(ref.path));assert.equal(input.postgres.sourceManifest.length,105);});
});
test('new own field report lineage and all eight additive native checks require exact current proofs',()=>{
 const file='src/lib/field-report-feedback.mjs';assert.equal(native.files.filter(source=>source===file).length,1);
 rejected(input=>{input.postgres.sourceManifest=input.postgres.sourceManifest.filter(ref=>ref.path!==file);});
 rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
 rejected(input=>{input.postgres.sourceManifest.find(ref=>ref.path===file).path='src/lib/foreign-report-reader.mjs';});
 rejected(input=>{delete input.gitSources[file];});
 rejected(input=>{input.postgres.totalCheckCount=15;input.postgres.checks=input.postgres.checks.slice(0,15);});
});
test('stale, abbreviated or foreign HEAD/tree provenance fails even when proof status says PASS',()=>{
 for(const key of ['expectedHead','head','sourceTree'])rejected(input=>{input[key]='c'.repeat(40);});
 rejected(input=>{input.expectedHead=head.slice(0,7);});
 for(const proof of ['postgres','ui'])for(const key of ['sourceRevision','sourceTree'])rejected(input=>{input[proof][key]='c'.repeat(40);});
});
test('dirty/local proofs and false clean attestations never qualify as committed CI evidence',()=>{
 rejected(input=>{input.trackedClean=false;});
 for(const proof of ['postgres','ui'])rejected(input=>{input[proof].trackedClean=false;});
 for(const value of ['LOCAL_REVIEW_SOURCE','clean','working-tree',undefined])rejected(input=>{input.postgres.sourceState=value;});
 for(const value of ['EXACT_CI_SOURCE','working-tree',undefined])rejected(input=>{input.ui.sourceState=value;});
});
test('failed, nonnative, unsafely authenticated and real-data producer claims fail closed',()=>{
 for(const proof of ['postgres','ui']){rejected(input=>{input[proof].status='FAIL';});rejected(input=>{input[proof].productionDataWritten=true;});rejected(input=>{delete input[proof].productionDataWritten;});}
 for(const [key,value] of [['version','older'],['environment','production-postgresql'],['postgresExecuted',false],['realIdentityDocuments',true]])rejected(input=>{input.postgres[key]=value;});
 for(const [key,value] of [['environment','production-browser'],['productionLoginVerified',true],['physicalDeviceAccepted',true]])rejected(input=>{input.ui[key]=value;});
});
test('source manifests must include every transitive dependency once and no substituted source',()=>{
 const baselineFiles=['src/app/(identity)/cuenta/plan-baseline-view.mjs','src/app/(identity)/cuenta/plan-source-curve.mjs'];
 for(const file of baselineFiles){
  assert.equal(browser.files.filter(source=>source===file).length,1);
  rejected(input=>{input.ui.sourceManifest=input.ui.sourceManifest.filter(ref=>ref.path!==file);});
  rejected(input=>{input.ui.sourceManifest.find(ref=>ref.path===file).path='src/app/(identity)/cuenta/foreign-baseline-view.mjs';assert.equal(input.ui.sourceManifest.length,20);});
  rejected(input=>{input.ui.sourceManifest.find(ref=>ref.path===file).sha256='f'.repeat(64);});
 }
 rejected(input=>{input.ui.sourceManifest=input.ui.sourceManifest.filter(ref=>!baselineFiles.includes(ref.path));assert.equal(input.ui.sourceManifest.length,18);});
 for(const proof of ['postgres','ui']){
  rejected(input=>{input[proof].sourceManifest.pop();});
  rejected(input=>{input[proof].sourceManifest[1]={...input[proof].sourceManifest[0]};});
  rejected(input=>{input[proof].sourceManifest[0].path='src/foreign-synthetic.mjs';});
  rejected(input=>{input[proof].sourceManifest.push({path:'src/unrelated.mjs',sha256:'f'.repeat(64)});});
 }
});
test('matching manifest counts cannot conceal stale source, producer or owned-cleanup bytes',()=>{
 for(const proof of ['postgres','ui']){
  rejected(input=>{input[proof].sourceManifest[0].sha256='f'.repeat(64);});
  rejected(input=>{input[proof].harnessSha256='f'.repeat(64);});
 }
 rejected(input=>{input.ui.cleanupHelperSha256='f'.repeat(64);});
 rejected(input=>{input.gitSources['src/lib/material-inventory.mjs']=Buffer.from('// stale implementation\n');});
});
test('missing graph dependencies and omitted committed producer/helper files fail before acceptance',()=>{
 for(const file of ['src/lib/material-inventory.mjs','src/app/(identity)/cuenta/material-inventory-view.mjs','src/app/(identity)/cuenta/plan-baseline-view.mjs','src/app/(identity)/cuenta/plan-source-curve.mjs','scripts/verify-consumption-feedback-ui.mjs','scripts/lib/owned-fixture-cleanup.mjs','package-lock.json'])rejected(input=>{delete input.gitSources[file];});
});
test('recursive JSX closure rejects traversal, external stylesheet and nonliteral hidden imports',()=>{
 for(const source of ["import '../outside.mjs';","import('../../../../../../outside.mjs');","const target='hidden';import(target);"]){
  const input=fixture();input.gitSources['src/app/(identity)/cuenta/material-inventory-panel.js']=Buffer.from(source);
  assert.throws(()=>validateConsumptionFeedbackCi(input),{code:'CONSUMPTION_FEEDBACK_CI_REJECTED'});
 }
 rejected(input=>{input.gitSources['src/app/(identity)/cuenta/material-inventory-panel.module.css']=Buffer.from('@import "https://example.invalid/style.css";');});
});
test('all 23 native names must match the exported ordered contract without duplicates',()=>{
 rejected(input=>{input.postgres.totalCheckCount=14;});
 rejected(input=>{input.postgres.checks.pop();});
 rejected(input=>{input.postgres.checks[1]=input.postgres.checks[0];});
 rejected(input=>{input.postgres.checks.reverse();});
 rejected(input=>{input.postgres.checks[0]='synthetic-unasserted-shortcut';});
});
test('browser evidence requires the complete twelve-check identity set and four-width matrix',()=>{
 rejected(input=>{input.ui.widths=[390,768,1280];});
 rejected(input=>{input.ui.widths=[320,390,768,768];});
 rejected(input=>{input.ui.checks.pop();});
 rejected(input=>{input.ui.checks[1]=input.ui.checks[0];});
 rejected(input=>{input.ui.checks[8]=input.ui.checks[7];});
 rejected(input=>{input.ui.checks[9].check='denied-empty-history-only';});
});
test('viewport touch-target, overflow, initial timeline and true reversal timestamps are required',()=>{
 rejected(input=>{input.ui.checks[0].documentWidth=321;});
 rejected(input=>{input.ui.checks[0].targets[0].height=43;});
 rejected(input=>{input.ui.checks[0].targets=[];});
 rejected(input=>{input.ui.checks[0].cards=[];});
 rejected(input=>{input.ui.checks[0].cards[3].dates=['2026-10-12T13:00:00.000Z'];});
});
test('unknown recovery IDs and loaded-history denial results cannot be replaced by empty assertions',()=>{
 rejected(input=>{delete input.ui.checks[5].operationId;});
 rejected(input=>{input.ui.checks[6].operationId=input.ui.checks[5].operationId;});
 for(const key of ['beforeCards','afterCards','afterReceipts','afterForms','postCount'])for(const index of [9,10])rejected(input=>{input.ui.checks[index][key]=key==='beforeCards'?0:1;});
});
test('provider calls, browser errors, external requests and undeclared package imports reject CI acceptance',()=>{
 rejected(input=>{input.postgres.providerCalls=1;});rejected(input=>{delete input.postgres.providerCalls;});
 rejected(input=>{input.ui.providerRequests=1;});rejected(input=>{delete input.ui.providerRequests;});
 for(const key of ['pageErrors','interceptErrors','externalRequests']){rejected(input=>{input.ui[key]=['synthetic failure'];});rejected(input=>{delete input.ui[key];});}
 rejected(input=>{input.ui.externalImports.push('unapproved-package');});
});
test('native pool/database and owned IPC/browser/fixture postconditions must all be true',()=>{
 for(const key of ['poolClosed','databaseRemoved'])rejected(input=>{input.postgres[key]=false;});
 for(const key of ['browserClosed','serverClosed','gracefulCloseAcknowledged','fixtureRemoved'])rejected(input=>{input.ui.cleanup[key]=false;});
 rejected(input=>{input.ui.cleanup.fixtureCleanupProof.fixtureRemoved=false;});
 rejected(input=>{input.ui.cleanup.fixtureCleanupProof.postcondition.absent=false;});
 rejected(input=>{delete input.ui.cleanup;});
});
