import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';
import {parseTap,TEST_SUITES,RECOVERY_CASES,EXPECTED_SUITE_COUNTS,EXPECTED_TOTAL_TESTS} from '../../scripts/verify-participant-bank-intake-contracts.mjs';

export const EXPECTED_CONTRACT_SHA256='d38e025df92e37f03b69e853bb9eb34aa15ba1af22ec38f674aafe67ad336999';
const BASELINE_BLOCKS_SHA256='97abbb70282f13efede473f08954e3a233cb77c76efe7178c0de981310c6f8bd';
const BASELINE_OWNERSHIP_SHA256='26c7acdbb7d3a5eb6e75355c3c4af715c8f07ce27b12248d6028160c76fa77a4';
const BASELINE_PRODUCERS_SHA256='07d0016608332c0775f86bee6d005e60d4686d2ffe33a3065dfd9fd8e974ab20';
export const LANES=['contracts','plans','people','field','meta','channels','business','workspace-ui'];
const LANE_ENV_BYTES=64*1024;
const LANE_OUTPUT_BYTES=60*1024;
const laneEnvironmentKey=lane=>'WORKSPACE_LANE_'+lane.toUpperCase().replaceAll('-','_')+'_JSON';
const script='.github/scripts/verify-workspace-ci-parallelization.mjs';
const contractPath='.github/workspace-acceptance-contract.json';
const workflowPath='.github/workflows/workspace-acceptance.yml';
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const clone=value=>structuredClone(value);
const deny=code=>{throw Object.assign(new Error(code),{code});};
const equal=(actual,expected,code)=>{if(canonical(actual)!==canonical(expected))deny(code);};
const exactKeys=(value,keys,code)=>{if(!value||typeof value!=='object'||Array.isArray(value))deny(code);equal(Object.keys(value).sort(),[...keys].sort(),code);};
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const head=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const positive=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value);

const EXTENSION_PROOFS=[
 ['bank-intake-units','contracts',53,'.vercel/participant-bank-intake-contract-evidence/proof.json','UNIT'],
 ['bank-postgres','people',54,'.vercel/private-bank-evidence/postgres.json','PG_BANK'],
 ['intake-postgres','people',54,'.vercel/private/employee-intake-postgres.json','PG_INTAKE'],
 ['bank-ui','people',55,'.vercel/private-bank-evidence/proof.json','UI_BANK'],
 ['intake-ui','people',55,'.vercel/private/employee-intake-ui/browser.json','UI_INTAKE'],
 ['joint-ui','people',56,'.vercel/private/participant-bank-intake-integration/current/browser.json','UI_JOINT'],
 ['joint-causal','people',56,'.vercel/private/participant-bank-intake-integration/bad-resolution/browser.json','UI_CAUSAL'],
 ['company-kyc-postgres','people',57,'.vercel/company-kyc-evidence/postgres.json','PG_COMPANY_KYC']
];
function sourcePath(value){if(typeof value!=='string'||value.length>500||/[\\\x00-\x1f]/.test(value)||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))deny('UNSAFE_SOURCE_PATH');return value;}
function gitSource(root,expectedHead){if(!head(expectedHead))deny('EXPECTED_HEAD_INVALID');const cache=new Map();return filename=>{sourcePath(filename);if(!cache.has(filename))cache.set(filename,execFileSync('git',['show',expectedHead+':'+filename],{cwd:root,maxBuffer:8*1024*1024}));return cache.get(filename);};}
function manifestDigest(references){return hash(canonical([...references].sort((a,b)=>a.path.localeCompare(b.path))));}
function expectedSourceDigest(spec,readSource){if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');return manifestDigest(spec.sourceFiles.map(file=>{const bytes=readSource(file);if(!Buffer.isBuffer(bytes))deny('PROOF_SOURCE_BYTES');return {path:file,sha256:hash(bytes)};}));}
const utf8=bytes=>{if(!Buffer.isBuffer(bytes))deny('PROOF_BYTES');const text=bytes.toString('utf8');if(!bytes.equals(Buffer.from(text)))deny('PROOF_ENCODING');return text;};
function matrix(rows,widths,modes){if(!Array.isArray(rows))deny('PROOF_MATRIX');const keys=rows.map(row=>row&&row.width+':'+row.mode);equal(keys.toSorted(),widths.flatMap(width=>modes.map(mode=>width+':'+mode)).toSorted(),'PROOF_MATRIX');}
function summary(spec){return spec.kind==='UNIT'?{suites:7,tests:EXPECTED_TOTAL_TESTS,recovery:7,corporateKyc:76,nextSteps:35}:spec.kind==='PG_COMPANY_KYC'?6:spec.kind==='UI_CAUSAL'?0:spec.kind==='UI_JOINT'?8:spec.kind.startsWith('UI_')?32:spec.kind==='PG_BANK'?10:8;}
function validateExtension(contract){
 const extension=contract.extension;exactKeys(extension,['baseHead','baselineBlocksSha256','baselineOwnershipSha256','baselineProducersSha256','proofs'],'EXTENSION_SHAPE');
 if(extension.baseHead!=='a4b79d7a7f75427ed1d0b0e1e9b247e1188adf3f')deny('EXTENSION_BASE');
 equal(extension.proofs.map(p=>[p.id,p.lane,p.blockId,p.path,p.kind]),EXTENSION_PROOFS,'EXTENSION_PROOF_COVERAGE');
 for(const spec of extension.proofs){exactKeys(spec,['id','lane','blockId','path','kind','producer','producerSha256','sourceFiles','checkNames'],'EXTENSION_PROOF_SHAPE');if(!sha(spec.producerSha256)||!Array.isArray(spec.sourceFiles)||!spec.sourceFiles.length||new Set(spec.sourceFiles).size!==spec.sourceFiles.length)deny('EXTENSION_SOURCE_CONTRACT');spec.sourceFiles.forEach(sourcePath);sourcePath(spec.producer);if(!Array.isArray(spec.checkNames))deny('EXTENSION_CHECK_NAMES');}
 for(const spec of extension.proofs){const record=contract.evidenceProducers.find(p=>p.path===spec.path);equal(record&&{producer:record.producer,path:record.path,retained:record.retained,blockId:record.blockId,lane:record.lane,producerSha256:record.producerSha256,sourceBasis:record.sourceBasis},{producer:spec.producer,path:spec.path,retained:true,blockId:spec.blockId,lane:spec.lane,producerSha256:spec.producerSha256,sourceBasis:'EXPECTED_HEAD_GIT_BYTES'},'EXTENSION_PRODUCER_CONTRACT');}
 if(hash(canonical(contract.blocks.slice(0,46)))!==extension.baselineBlocksSha256||extension.baselineBlocksSha256!==BASELINE_BLOCKS_SHA256)deny('BASELINE_BLOCKS_CHANGED');
 const newPatterns=new Set(extension.proofs.flatMap(spec=>contract.lanes[spec.lane].artifacts.filter(pattern=>matches(spec.path,pattern))));
 const ownership=Object.fromEntries(LANES.map(lane=>[lane,{blocks:contract.lanes[lane].blocks.filter(id=>id<=52),artifacts:contract.lanes[lane].artifacts.filter(pattern=>!newPatterns.has(pattern))}]));
 if(hash(canonical(ownership))!==extension.baselineOwnershipSha256||extension.baselineOwnershipSha256!==BASELINE_OWNERSHIP_SHA256)deny('BASELINE_OWNERSHIP_CHANGED');
 if(hash(canonical(contract.evidenceProducers.filter(p=>p.blockId<=52)))!==extension.baselineProducersSha256||extension.baselineProducersSha256!==BASELINE_PRODUCERS_SHA256)deny('BASELINE_PRODUCERS_CHANGED');
}
export function validateExtensionProof(spec,bytes,{expectedHead,readSource,readEvidence}){
 if(!head(expectedHead)||typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');let proof;try{proof=JSON.parse(utf8(bytes));}catch(error){if(error.code)throw error;deny('PROOF_JSON');}if(!proof||typeof proof!=='object'||Array.isArray(proof))deny('PROOF_SHAPE');
 const expectedStatus=spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS';if(proof.status!==expectedStatus)deny('PROOF_STATUS');if((spec.kind==='PG_COMPANY_KYC'?proof.productionDataTouched:proof.productionDataWritten)!==false)deny('PROOF_PRODUCTION_BOUNDARY');
 const producerBytes=readSource(spec.producer);if(!Buffer.isBuffer(producerBytes)||hash(producerBytes)!==spec.producerSha256||proof.harnessSha256!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');
 if(!Array.isArray(proof.sourceManifest))deny('PROOF_SOURCE_MANIFEST');equal(proof.sourceManifest.map(r=>r?.path).toSorted(),spec.sourceFiles.toSorted(),'PROOF_SOURCE_MANIFEST');
 for(const ref of proof.sourceManifest){exactKeys(ref,['path','sha256'],'PROOF_SOURCE_REFERENCE');sourcePath(ref.path);if(!sha(ref.sha256)||hash(readSource(ref.path))!==ref.sha256)deny('PROOF_SOURCE_HASH');}
 if(proof.sourceRevision!==undefined&&proof.sourceRevision!==expectedHead)deny('PROOF_SOURCE_HEAD');
 if(spec.kind==='PG_COMPANY_KYC'){
  if(proof.databaseCreated!==false||proof.schemaRemoved!==true||proof.environment!=='schema-only-localhost-postgresql-corporate-KYC')deny('PROOF_CLEANUP');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(proof.realProviderCalls!==0||proof.unexpectedNetworkCalls!==0||proof.realClerkLogin!==false||proof.realMetaAccepted!==false||proof.humanAccepted!==false)deny('PROOF_PROVIDER_IO');
 }
 else if(spec.kind==='PG_BANK'||spec.kind==='PG_INTAKE'){if(proof.schemaRemoved!==true)deny('PROOF_CLEANUP');equal(proof.checks,spec.checkNames,'PROOF_CHECK_NAMES');if(spec.kind==='PG_BANK'){if(proof.realProviderCalls!==0)deny('PROOF_PROVIDER_IO');}else{if(proof.providerCalls!==0||proof.unexpectedNetworkCalls!==0)deny('PROOF_PROVIDER_IO');equal(proof.sqlFailures,[],'PROOF_SQL_ERRORS');}}
 else if(spec.kind==='UNIT'){
  if(proof.sourceRevision!==expectedHead||proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true||proof.postgresExecuted!==false)deny('PROOF_SOURCE_STATE');if(!Array.isArray(proof.suites))deny('PROOF_UNIT_SUITES');equal(proof.suites.map(s=>s.file),TEST_SUITES,'PROOF_UNIT_SUITES');if(typeof readEvidence!=='function')deny('PROOF_TAP_RESOLVER');
  for(const [index,suite] of proof.suites.entries()){exactKeys(suite,['file','exitCode','tests','pass','fail','cancelled','skipped','todo','caseNames','tap'],'PROOF_UNIT_SUITE_SHAPE');exactKeys(suite.tap,['path','bytes','sha256'],'PROOF_UNIT_TAP_SHAPE');if(suite.exitCode!==0||suite.tap.path!=='.vercel/participant-bank-intake-contract-evidence/suite-'+index+'.tap')deny('PROOF_UNIT_EXECUTION');const tap=readEvidence(suite.tap.path);if(!Buffer.isBuffer(tap)||tap.length!==suite.tap.bytes||hash(tap)!==suite.tap.sha256)deny('PROOF_TAP_DIGEST');let parsed;try{parsed=parseTap(tap,{recovery:index===4,expectedTests:EXPECTED_SUITE_COUNTS[suite.file]??null});}catch{deny('PROOF_UNIT_RESULTS');}equal(parsed,Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo','caseNames'].map(k=>[k,suite[k]])),'PROOF_UNIT_RESULTS');}
  if(proof.suites.reduce((total,suite)=>total+suite.tests,0)!==EXPECTED_TOTAL_TESTS)deny('PROOF_UNIT_RESULTS');
 }else{
  equal(proof.errors,[],'PROOF_UI_ERRORS');if(spec.kind==='UI_INTAKE'){if(proof.providerCalls!==0||proof.realIdentityAccepted!==false)deny('PROOF_PROVIDER_IO');}else if(proof.realProviderCalls!==0||proof.postgresExecuted!==false)deny('PROOF_PROVIDER_IO');
  if(spec.kind==='UI_BANK'){if(proof.sourceRevision!==expectedHead||proof.fullSuite!==true)deny('PROOF_SOURCE_STATE');equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated']);}
  if(spec.kind==='UI_INTAKE'){equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['success','unknown','wrong-receipt','html403','scope-switch','paging','config','invite']);}
  if(spec.kind==='UI_JOINT'||spec.kind==='UI_CAUSAL'){
   if(proof.sourceRevision!==expectedHead||proof.sourceState!=='committed exact Git HEAD'||proof.trackedClean!==true)deny('PROOF_SOURCE_STATE');equal(proof.dirtyTrackedPaths,[],'PROOF_SOURCE_STATE');if(proof.realIdentityAccepted!==false)deny('PROOF_PROVIDER_IO');
   if(spec.kind==='UI_JOINT'){equal(proof.widths,[320,390,768,1280],'PROOF_MATRIX');matrix(proof.checks,proof.widths,['bank','intake']);if(proof.badTransform!==null||proof.causalFailure!==null||proof.checks.some(c=>c.parentAndSiblingBlocked!==true||c.ownRecoveryAndLocalCloseEnabled!==true||c.noFeedbackDeadlock!==true||c.automaticPost!==false||c.storagePrivate!==true))deny('PROOF_JOINT_GUARDS');}
   else{equal(proof.widths,[320],'PROOF_MATRIX');equal(proof.checks,[],'PROOF_MATRIX');const transform=proof.badTransform,needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}',replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||hasBankPending}';exactKeys(transform,['source','originalSha256','fixtureSha256','needle','replacement','runtimeSourceEdited'],'PROOF_CAUSAL_TRANSFORM');if(transform.source!=='src/app/(identity)/cuenta/participant-panel.js'||transform.needle!==needle||transform.replacement!==replacement||transform.runtimeSourceEdited!==false)deny('PROOF_CAUSAL_TRANSFORM');const original=readSource(transform.source),text=utf8(original);if(text.split(needle).length!==2||transform.originalSha256!==hash(original)||transform.fixtureSha256!==hash(Buffer.from(text.replace(needle,replacement))))deny('PROOF_CAUSAL_TRANSFORM');exactKeys(proof.causalFailure,['stage','message','expectedFailure'],'PROOF_CAUSAL_FAILURE');if(proof.causalFailure.stage!=='own-bank-save'||proof.causalFailure.expectedFailure!==true||typeof proof.causalFailure.message!=='string'||!proof.causalFailure.message.startsWith('own bank save must remain enabled while its own pending gates siblings'))deny('PROOF_CAUSAL_FAILURE');}
  }
 }
 return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:expectedStatus,sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:manifestDigest(proof.sourceManifest),sourceReferences:spec.sourceFiles.length,proofSha256:hash(bytes),bytes:bytes.length,checks:summary(spec)};
}
function proofBindings(contract,lane,files,expectedHead,readSource){return contract.extension.proofs.filter(p=>p.lane===lane).map(spec=>{if(hash(readSource(spec.producer))!==spec.producerSha256)deny('PROOF_HARNESS_SOURCE');return {id:spec.id,path:spec.path,producer:spec.producer,kind:spec.kind,result:spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',sourceRevision:expectedHead,harnessSha256:spec.producerSha256,sourceManifestSha256:expectedSourceDigest(spec,readSource),sourceReferences:spec.sourceFiles.length,proofSha256:files.find(f=>f.path===spec.path).sha256,bytes:files.find(f=>f.path===spec.path).bytes,checks:summary(spec)};});}
function assertProofBindings(bindings,contract,lane,files,expectedHead,readSource){
 if(!Array.isArray(bindings))deny('PROOF_BINDINGS');const specs=contract.extension.proofs.filter(p=>p.lane===lane);equal(bindings.map(b=>b?.id),specs.map(p=>p.id),'PROOF_BINDINGS');const expectedBindings=proofBindings(contract,lane,files,expectedHead,readSource);for(const [index,binding] of bindings.entries()){exactKeys(binding,['id','path','producer','kind','result','sourceRevision','harnessSha256','sourceManifestSha256','sourceReferences','proofSha256','bytes','checks'],'PROOF_BINDING_SHAPE');const expected=expectedBindings[index];if(!sha(binding.sourceManifestSha256)||binding.sourceManifestSha256!==expected.sourceManifestSha256)deny('PROOF_BINDING_SOURCE');equal(binding,expected,'PROOF_BINDING_IDENTITY');if(binding.bytes<1)deny('PROOF_BINDING_EMPTY');}
}
function extensionSelftest(contract,root){
 const checks=[],expectedHead=contract.extension.baseHead;
 const good=(name,run)=>{run();checks.push({name,result:'PASS',boundary:'pure shadow fixture, no Git/PG/UI/provider execution'});},bad=(name,code,run)=>{assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code,boundary:'pure shadow fixture'});};
 // Normalize only these shadow source fixtures to Linux Git text. The actual proof validator never normalizes bytes.
 const readSource=file=>{const bytes=readFileSync(path.join(root,sourcePath(file))),text=bytes.toString('utf8');assert.ok(bytes.equals(Buffer.from(text)));return Buffer.from(text.replaceAll('\r\n','\n'));};
 const tap=names=>Buffer.from('TAP version 13\n'+names.map((name,i)=>'ok '+(i+1)+' - '+name+'\n').join('')+'1..'+names.length+'\n# tests '+names.length+'\n# pass '+names.length+'\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n');
 for(const spec of contract.extension.proofs){
  const evidence=new Map(),base={status:spec.kind==='UI_CAUSAL'?'EXPECTED_CAUSAL_FAILURE':'PASS',productionDataWritten:false,sourceManifest:spec.sourceFiles.map(file=>({path:file,sha256:hash(readSource(file))})),harnessSha256:spec.producerSha256};
  let proof={...base};
  if(spec.kind.startsWith('PG_'))Object.assign(proof,{schemaRemoved:true,checks:[...spec.checkNames],realProviderCalls:0,providerCalls:0,unexpectedNetworkCalls:0,sqlFailures:[],...(spec.kind==='PG_COMPANY_KYC'?{productionDataTouched:false,databaseCreated:false,environment:'schema-only-localhost-postgresql-corporate-KYC',realClerkLogin:false,realMetaAccepted:false,humanAccepted:false}:{})});
  else if(spec.kind==='UNIT'){Object.assign(proof,{sourceRevision:expectedHead,sourceState:'committed exact Git HEAD',trackedClean:true,postgresExecuted:false,suites:TEST_SUITES.map((file,index)=>{const bytes=tap(index===4?RECOVERY_CASES:Array.from({length:EXPECTED_SUITE_COUNTS[file]||1},(_,i)=>'shadow fixture '+index+' case '+i)),filename='.vercel/participant-bank-intake-contract-evidence/suite-'+index+'.tap';evidence.set(filename,bytes);return {file,exitCode:0,...parseTap(bytes,{recovery:index===4,expectedTests:EXPECTED_SUITE_COUNTS[file]??null}),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};})});}
  else{Object.assign(proof,{errors:[],realProviderCalls:0,providerCalls:0,postgresExecuted:false,realIdentityAccepted:false,widths:[320,390,768,1280],sourceRevision:expectedHead,sourceState:'committed exact Git HEAD',trackedClean:true,dirtyTrackedPaths:[],fullSuite:true,badTransform:null,causalFailure:null});const modes=spec.kind==='UI_BANK'?['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated']:spec.kind==='UI_INTAKE'?['success','unknown','wrong-receipt','html403','scope-switch','paging','config','invite']:['bank','intake'];proof.checks=proof.widths.flatMap(width=>modes.map(mode=>({width,mode,parentAndSiblingBlocked:true,ownRecoveryAndLocalCloseEnabled:true,noFeedbackDeadlock:true,automaticPost:false,storagePrivate:true})));
   if(spec.kind==='UI_CAUSAL'){const source='src/app/(identity)/cuenta/participant-panel.js',original=readSource(source),needle='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending}',replacement='locked={busy||Boolean(attempt)||Boolean(durableReference)||!recoveryReady||Boolean(draft)||intakePending||hasBankPending}';Object.assign(proof,{widths:[320],checks:[],badTransform:{source,originalSha256:hash(original),fixtureSha256:hash(Buffer.from(original.toString().replace(needle,replacement))),needle,replacement,runtimeSourceEdited:false},causalFailure:{stage:'own-bank-save',message:'own bank save must remain enabled while its own pending gates siblings (shadow fixture)',expectedFailure:true}});}
  }
  const validate=value=>validateExtensionProof(spec,Buffer.from(JSON.stringify(value)),{expectedHead,readSource,readEvidence:file=>evidence.get(file)}),mutate=(name,code,edit)=>{const value=clone(proof);edit(value);bad(spec.id+'-'+name,code,()=>validate(value));};
  good(spec.id+'-complete-proof',()=>validate(proof));
  good(spec.id+'-reordered-source-manifest',()=>{const reordered=clone(proof);reordered.sourceManifest.reverse();assert.equal(validate(reordered).sourceManifestSha256,validate(proof).sourceManifestSha256);});
  bad(spec.id+'-malformed-json','PROOF_JSON',()=>validateExtensionProof(spec,Buffer.from('{'),{expectedHead,readSource}));bad(spec.id+'-invalid-utf8','PROOF_ENCODING',()=>validateExtensionProof(spec,Buffer.from([255]),{expectedHead,readSource}));
  mutate('wrong-status','PROOF_STATUS',p=>{p.status='FAIL';});mutate('production-write','PROOF_PRODUCTION_BOUNDARY',p=>{if(spec.kind==='PG_COMPANY_KYC')p.productionDataTouched=true;else p.productionDataWritten=true;});mutate('wrong-source-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision='f'.repeat(40);});mutate('wrong-harness','PROOF_HARNESS_SOURCE',p=>{p.harnessSha256='f'.repeat(64);});mutate('missing-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.pop();});mutate('foreign-source','PROOF_SOURCE_MANIFEST',p=>{p.sourceManifest.push({path:'src/foreign.mjs',sha256:'f'.repeat(64)});});mutate('wrong-source-hash','PROOF_SOURCE_HASH',p=>{p.sourceManifest[0].sha256='f'.repeat(64);});
  if(spec.kind.startsWith('PG_')){mutate('cleanup-failure','PROOF_CLEANUP',p=>{p.schemaRemoved=false;});mutate('missing-check','PROOF_CHECK_NAMES',p=>{p.checks.pop();});mutate('provider-call','PROOF_PROVIDER_IO',p=>{p.realProviderCalls=1;p.providerCalls=1;});}
  if(spec.kind==='PG_COMPANY_KYC'){
   mutate('database-created','PROOF_CLEANUP',p=>{p.databaseCreated=true;});mutate('wrong-engine','PROOF_CLEANUP',p=>{p.environment='database-created-fixture';});mutate('network-call','PROOF_PROVIDER_IO',p=>{p.unexpectedNetworkCalls=1;});mutate('network-array-is-not-zero','PROOF_PROVIDER_IO',p=>{p.unexpectedNetworkCalls=[];});for(const key of ['realClerkLogin','realMetaAccepted','humanAccepted'])mutate('accepted-'+key,'PROOF_PROVIDER_IO',p=>{p[key]=true;});
  }
  if(['UI_BANK','UI_INTAKE','UI_JOINT'].includes(spec.kind)){mutate('partial-matrix','PROOF_MATRIX',p=>{p.checks.pop();});mutate('duplicate-matrix','PROOF_MATRIX',p=>{p.checks[0]=p.checks[1];});mutate('ui-error','PROOF_UI_ERRORS',p=>{p.errors=['shadow error'];});}
  if(spec.kind==='UI_JOINT'){mutate('dirty-tracked','PROOF_SOURCE_STATE',p=>{p.trackedClean=false;});mutate('uncommitted-source','PROOF_SOURCE_STATE',p=>{p.sourceState='uncommitted';});mutate('null-head','PROOF_SOURCE_HEAD',p=>{p.sourceRevision=null;});for(const key of ['parentAndSiblingBlocked','ownRecoveryAndLocalCloseEnabled','noFeedbackDeadlock','storagePrivate'])mutate('missing-'+key,'PROOF_JOINT_GUARDS',p=>{p.checks[0][key]=false;});mutate('auto-post','PROOF_JOINT_GUARDS',p=>{p.checks[0].automaticPost=true;});}
  if(spec.kind==='UI_CAUSAL'){mutate('wrong-stage','PROOF_CAUSAL_FAILURE',p=>{p.causalFailure.stage='unrelated';});mutate('runtime-mutated','PROOF_CAUSAL_TRANSFORM',p=>{p.badTransform.runtimeSourceEdited=true;});mutate('wrong-fixture-hash','PROOF_CAUSAL_TRANSFORM',p=>{p.badTransform.fixtureSha256='f'.repeat(64);});}
  if(spec.kind==='UNIT'){mutate('missing-suite','PROOF_UNIT_SUITES',p=>{p.suites.pop();});mutate('changed-tap-digest','PROOF_TAP_DIGEST',p=>{p.suites[4].tap.sha256='f'.repeat(64);});for(const names of [RECOVERY_CASES.slice(0,6),[...RECOVERY_CASES,'extra shadow case'],[...RECOVERY_CASES.slice(0,6),'wrong case']]){const bytes=tap(names),filename=proof.suites[4].tap.path,original=evidence.get(filename);evidence.set(filename,bytes);mutate('recovery-exact7-'+names.length+'-'+names.at(-1),'PROOF_UNIT_RESULTS',p=>{p.suites[4].tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});evidence.set(filename,original);}for(const key of ['fail','cancelled','skipped','todo']){const filename=proof.suites[4].tap.path,original=evidence.get(filename),bytes=Buffer.from(original.toString().replace('# '+key+' 0','# '+key+' 1'));evidence.set(filename,bytes);mutate('recovery-'+key,'PROOF_UNIT_RESULTS',p=>{p.suites[4].tap={path:filename,bytes:bytes.length,sha256:hash(bytes)};});evidence.set(filename,original);}}
  if(spec.kind==='UNIT')for(const [file,count] of Object.entries(EXPECTED_SUITE_COUNTS)){
   const index=TEST_SUITES.indexOf(file),filename=proof.suites[index].tap.path,original=evidence.get(filename);
   for(const size of [count-1,count+1]){const bytes=tap(Array.from({length:size},(_,i)=>'shadow exact suite '+i));evidence.set(filename,bytes);mutate('exact-suite-count-'+file+'-'+size,'PROOF_UNIT_RESULTS',p=>{p.suites[index]={file,exitCode:0,...parseTap(bytes),tap:{path:filename,bytes:bytes.length,sha256:hash(bytes)}};});}
   evidence.set(filename,original);
  }
 }
 return checks;
}

export function cleanPath(value){
 if(typeof value!=='string'||value.length>500||!value||! /^[A-Za-z0-9._/-]+$/.test(value)||value.startsWith('/')||value.split('/').some(part=>!part||part==='.'||part==='..'))deny('UNSAFE_PATH');
 return value;
}
function patternValid(value){
 if(typeof value!=='string'||value.includes('**'))deny('INVALID_ARTIFACT_PATTERN');
 cleanPath(value.replaceAll('*','fixture').replace(/\/$/,''));
}
function matches(value,pattern){
 if(pattern.endsWith('/'))return value.startsWith(pattern);
 const regex=new RegExp('^'+pattern.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replaceAll('*','[^/]*')+'$');
 return regex.test(value);
}
const verifierSha256=()=>hash(readFileSync(fileURLToPath(import.meta.url)));
function requireEvidence(files,required,code){if(required.some(filename=>!files.some(file=>file.path===filename)))deny(code);}
function executedProducers(contract){return contract.blocks.flatMap(block=>[...block.step.run.matchAll(/(?:^|\n)(?:node|python)\s+(scripts\/[A-Za-z0-9._/-]+\.(?:mjs|py))(?=\s|$)/g)].map(match=>({producer:match[1],blockId:block.id,lane:LANES.find(lane=>contract.lanes[lane].blocks.includes(block.id))})));}
export function assertSourceIdentity({actualHead,expectedHead,dirtyTrackedPaths}){
 if(!head(expectedHead))deny('EXPECTED_HEAD_INVALID');
 if(actualHead!==expectedHead)deny('SOURCE_HEAD_MISMATCH');
 if(!Array.isArray(dirtyTrackedPaths)||dirtyTrackedPaths.some(value=>typeof value!=='string'))deny('INVALID_TRACKED_SOURCE_STATE');
 if(dirtyTrackedPaths.length)deny('TRACKED_SOURCE_DIRTY');
 return actualHead;
}
function validateEvidenceContract(contract){
 const infra=contract.infrastructureCheck;
 exactKeys(infra,['id','lane','producer','step','producedNotUploaded'],'INFRASTRUCTURE_CHECK_SHAPE');
 if(infra.id!=='ci-gate-selftest'||infra.lane!=='contracts'||infra.producer!==script)deny('INFRASTRUCTURE_CHECK_IDENTITY');
 equal(infra.step,{name:'CI gate helper lint and negative controls',run:'npx eslint '+script+' --max-warnings 0\nnode '+script+' selftest --expected-head "$GITHUB_SHA"\n'},'INFRASTRUCTURE_CHECK_COMMAND');
 equal(infra.producedNotUploaded,['.vercel/workspace-ci-evidence/selftest.json','.vercel/workspace-ci-evidence/selftest.xml'],'INFRASTRUCTURE_EVIDENCE');
 if(!Array.isArray(contract.evidenceProducers)||!Array.isArray(contract.stdoutOnlyProducers))deny('EVIDENCE_PRODUCER_SHAPE');
 const declared=[...contract.evidenceProducers,...contract.stdoutOnlyProducers].map(({producer,blockId,lane})=>({producer,blockId,lane}));
 const byKey=items=>items.map(x=>JSON.stringify(x)).sort();
 equal(byKey(declared),byKey(executedProducers(contract)),'EVIDENCE_PRODUCER_COVERAGE');
 const allPaths=new Set();
 for(const producer of contract.evidenceProducers){
  exactKeys(producer,producer.blockId<=52?['producer','path','retained','blockId','lane','baselineSourceLine','baselineProducerGitBlobSha256']:['producer','path','retained','blockId','lane','sourceLine','producerSha256','sourceBasis'],'EVIDENCE_PRODUCER_SHAPE');
  cleanPath(producer.path);if(!producer.path.endsWith('.json')||typeof producer.retained!=='boolean'||!(producer.blockId<=52?sha(producer.baselineProducerGitBlobSha256)&&Number.isSafeInteger(producer.baselineSourceLine)&&producer.baselineSourceLine>0:sha(producer.producerSha256)&&Number.isSafeInteger(producer.sourceLine)&&producer.sourceLine>0&&producer.sourceBasis==='EXPECTED_HEAD_GIT_BYTES'))deny('EVIDENCE_PRODUCER_SHAPE');
  if(allPaths.has(producer.path))deny('DUPLICATE_REQUIRED_EVIDENCE');allPaths.add(producer.path);
  if(!contract.lanes[producer.lane]?.blocks.includes(producer.blockId))deny('EVIDENCE_PRODUCER_LANE');
 }
 for(const producer of contract.stdoutOnlyProducers){
  exactKeys(producer,['producer','blockId','lane','reason'],'STDOUT_PRODUCER_SHAPE');
  if(!contract.lanes[producer.lane]?.blocks.includes(producer.blockId)||typeof producer.reason!=='string'||!producer.reason)deny('STDOUT_PRODUCER_SHAPE');
 }
 for(const lane of LANES){
  const owner=contract.lanes[lane];
  equal(owner.optionalArtifactPatterns,owner.artifacts.filter(pattern=>pattern.includes('*')),'OPTIONAL_ARTIFACT_COVERAGE');
  equal(owner.requiredRetainedEvidence,contract.evidenceProducers.filter(p=>p.lane===lane&&p.retained).map(p=>p.path),'RETAINED_PRODUCER_COVERAGE');
  equal(owner.requiredProducedEvidence,[...contract.evidenceProducers.filter(p=>p.lane===lane&&!p.retained).map(p=>p.path),...(lane==='contracts'?infra.producedNotUploaded:[])],'PRODUCED_PRODUCER_COVERAGE');
  for(const filename of owner.requiredRetainedEvidence){cleanPath(filename);if(!owner.artifacts.some(pattern=>matches(filename,pattern)))deny('RETAINED_EVIDENCE_NOT_OWNED');}
  for(const filename of owner.requiredProducedEvidence){cleanPath(filename);if(owner.artifacts.some(pattern=>matches(filename,pattern)))deny('PRODUCED_EVIDENCE_IS_UPLOAD_OWNED');}
  if(owner.artifacts.filter(pattern=>!owner.optionalArtifactPatterns.includes(pattern)).some(pattern=>!owner.requiredRetainedEvidence.some(filename=>matches(filename,pattern))))deny('MANDATORY_PATTERN_WITHOUT_MAIN_PROOF');
 }
 if(Object.values(contract.lanes).flatMap(owner=>owner.optionalArtifactPatterns).length!==3)deny('OPTIONAL_ARTIFACT_COVERAGE');
}
export function validateContract(contract){
 if(contract?.version!==2||contract.sourceCommit!=='61d316a8983c268d43f8af6de10df9743a46278e')deny('CONTRACT_BASE');
 equal(Object.keys(contract.lanes).sort(),[...LANES].sort(),'CONTRACT_LANES');
 const ids=contract.blocks.map(block=>block.id);
 equal(ids,Array.from({length:51},(_,i)=>i+7),'CONTRACT_BLOCKS');
 for(const block of contract.blocks){if(typeof block.step.run!=='string'||hash(block.step.run)!==block.commandSha256)deny('CONTRACT_COMMAND');}
 const assigned=Object.values(contract.lanes).flatMap(lane=>lane.blocks);
 equal([...assigned].sort((a,b)=>a-b),ids,'CONTRACT_COVERAGE');
 if(new Set(assigned).size!==51)deny('CONTRACT_DUPLICATE_BLOCK');
 const patterns=Object.values(contract.lanes).flatMap(lane=>lane.artifacts);
 equal([...patterns].sort(),[...contract.artifactPatterns].sort(),'CONTRACT_ARTIFACT_COVERAGE');
 if(patterns.length!==51||new Set(patterns).size!==51)deny('CONTRACT_ARTIFACT_DUPLICATE');
 patterns.forEach(patternValid);
 validateEvidenceContract(contract);validateExtension(contract);
 return contract;
}
export function loadContract(filename){
 const bytes=readFileSync(filename);if(hash(bytes)!==EXPECTED_CONTRACT_SHA256)deny('CONTRACT_CHECKSUM');
 return validateContract(JSON.parse(bytes.toString('utf8')));
}
export function buildWorkflow(contract){
 validateContract(contract);
 const base=contract.workflow;
 const jobs={};
 const setup=clone(contract.setup);
 setup[0].with.ref='${{ github.sha }}';
 for(const lane of LANES){
  const ownership=contract.lanes[lane];
  const manifest='.vercel/workspace-ci-evidence/lane-'+lane+'.json';
  jobs[lane]={
   'runs-on':base.runner,'timeout-minutes':base.timeout,services:clone(base.services),env:clone(base.env),
   outputs:{provenance:'${{ steps.provenance.outputs.record }}',artifactId:'${{ steps.evidence.outputs.artifact-id }}',artifactDigest:'${{ steps.evidence.outputs.artifact-digest }}'},
   steps:[...clone(setup),
    {name:'Verify exact source, workflow and fresh evidence',run:`node ${script} preflight --lane ${lane} --expected-head "$GITHUB_SHA"`},
    {name:'Pinned Python dependencies',run:'python -m pip install --disable-pip-version-check -r requirements.txt'},
    ...(lane===contract.infrastructureCheck.lane?[clone(contract.infrastructureCheck.step)]:[]),
    ...ownership.blocks.map(id=>clone(contract.blocks.find(block=>block.id===id).step)),
    {name:'Record bounded synthetic provenance',id:'provenance',run:`node ${script} provenance --lane ${lane} --expected-head "$GITHUB_SHA"`},
    {uses:base.uploadAction,id:'evidence',if:'always()',with:{name:'workspace-acceptance-${{ github.run_id }}-${{ github.run_attempt }}-'+lane,path:[...ownership.artifacts,manifest].join('\n')+'\n','include-hidden-files':true,'retention-days':7}}
   ]};
 }
 jobs.workspace={name:'workspace',if:'always()',needs:[...LANES],'runs-on':base.runner,'timeout-minutes':base.timeout,env:clone(base.env),steps:[...clone(setup),
  {name:'Require every lane, artifact and exact provenance',env:Object.fromEntries(LANES.map(lane=>[laneEnvironmentKey(lane),'${{ toJSON(needs.'+lane+') }}'])),run:`node ${script} gate --expected-head "$GITHUB_SHA"`},
  {uses:base.uploadAction,if:'always()',with:{name:'workspace-acceptance-${{ github.run_id }}-${{ github.run_attempt }}-index',path:'.vercel/workspace-ci-evidence/gate.json','include-hidden-files':true,'retention-days':7}}
 ]};
 return {name:base.name,on:clone(base.on),permissions:clone(base.permissions),jobs};
}
export function equivalent(workflow,contract){
 equal(workflow,buildWorkflow(contract),'WORKFLOW_NOT_EQUIVALENT');
 return {blocks:51,artifactPatterns:51,lanes:8};
}
function collect(root,patterns){
 const files=new Map();
 function visit(filename){
  const stat=lstatSync(filename);if(stat.isSymbolicLink())deny('EVIDENCE_SYMLINK');
  const relative=cleanPath(path.relative(root,filename).split(path.sep).join('/'));
  if(!realpathSync(filename).startsWith(realpathSync(root)+path.sep))deny('EVIDENCE_OUTSIDE_ROOT');
  if(stat.isDirectory()){for(const entry of readdirSync(filename).sort())visit(path.join(filename,entry));return;}
  if(!stat.isFile())deny('EVIDENCE_NOT_REGULAR_FILE');
  if(stat.size>64*1024*1024)deny('EVIDENCE_TOO_LARGE');
  files.set(relative,{path:relative,sha256:hash(readFileSync(filename)),bytes:stat.size});
 }
 for(const pattern of patterns){
  if(pattern.endsWith('/')){const filename=path.join(root,pattern);try{lstatSync(filename);}catch(error){if(error.code==='ENOENT')continue;throw error;}visit(filename);}
  else if(pattern.includes('*')){const directory=path.dirname(pattern);let names;try{names=readdirSync(path.join(root,directory));}catch(error){if(error.code==='ENOENT')continue;throw error;}for(const name of names)if(matches(directory+'/'+name,pattern))visit(path.join(root,directory,name));}
  else {const filename=path.join(root,pattern);try{lstatSync(filename);}catch(error){if(error.code==='ENOENT')continue;throw error;}visit(filename);}
 }
 const values=[...files.values()].sort((a,b)=>a.path.localeCompare(b.path));
 if(values.length>2000||values.reduce((n,item)=>n+item.bytes,0)>200*1024*1024)deny('EVIDENCE_LIMIT');
 return values;
}
export function assertFreshEvidence({root,lane,contract}){
 if(!LANES.includes(lane))deny('UNKNOWN_LANE');
 const owner=contract.lanes[lane];
 if(collect(root,[...owner.artifacts,...owner.requiredProducedEvidence]).length)deny('STALE_EVIDENCE');
 return {state:'PASS',lane};
}
function seal(record){return {...record,manifestSha256:hash(JSON.stringify(record)+'\n')};}
function unseal(record){const copy=clone(record);delete copy.manifestSha256;return copy;}
function identity(root,expected){const actual=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const dirty=execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim();return assertSourceIdentity({actualHead:actual,expectedHead:expected,dirtyTrackedPaths:dirty?dirty.split(/\r?\n/):[]});}
export function canonicalDependencyTextSha256(bytes){
 if(!Buffer.isBuffer(bytes))deny('DEPENDENCY_TEXT_BYTES');
 const text=bytes.toString('utf8');if(!bytes.equals(Buffer.from(text,'utf8')))deny('DEPENDENCY_TEXT_ENCODING');
 return hash(text.replace(/\r\n/g,'\n'));
}
export function assertDependencies({packageLockBytes,requirementsBytes,contract}){
 if(canonicalDependencyTextSha256(packageLockBytes)!==contract.packageLockSha256)deny('PACKAGE_LOCK_CHANGED');
 if(canonicalDependencyTextSha256(requirementsBytes)!==contract.requirementsSha256)deny('PYTHON_REQUIREMENTS_CHANGED');
 return {packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256};
}
function dependencies(root,contract){return assertDependencies({packageLockBytes:readFileSync(path.join(root,'package-lock.json')),requirementsBytes:readFileSync(path.join(root,'requirements.txt')),contract});}
function clocks(env){if(!positive(env.GITHUB_RUN_ID)||!positive(env.GITHUB_RUN_ATTEMPT))deny('RUN_IDENTITY');return {runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT};}
export function assertLaneOutputSize(provenance){
 if(typeof provenance!=='string')deny('PROVENANCE_LIMIT');
 const transport={result:'success',outputs:{artifactId:'9'.repeat(64),artifactDigest:'a'.repeat(64),provenance}};
 const bytes=Buffer.byteLength(JSON.stringify(transport));
 if(bytes>LANE_OUTPUT_BYTES)deny('LANE_OUTPUT_TRANSPORT_LIMIT');
 return bytes;
}
export function readLaneNeedsEnvironment(env){
 if(Object.hasOwn(env,'WORKSPACE_NEEDS_JSON'))deny('LEGACY_AGGREGATE_ENV_DENIED');
 const keys=LANES.map(laneEnvironmentKey);
 equal(Object.keys(env).filter(key=>key.startsWith('WORKSPACE_LANE_')).sort(),keys.toSorted(),'LANE_ENV_COVERAGE');
 const needs={};let bytes=0;
 for(const lane of LANES){
  const value=env[laneEnvironmentKey(lane)];
  if(typeof value!=='string'||!value||Buffer.byteLength(value)>LANE_ENV_BYTES)deny('LANE_ENV_LIMIT');
  if(Buffer.from(value,'utf8').toString('utf8')!==value)deny('LANE_ENV_ENCODING');
  bytes+=Buffer.byteLength(value);
  try{needs[lane]=JSON.parse(value);}catch{deny('INVALID_LANE_ENV_JSON');}
  exactKeys(needs[lane],['result','outputs'],'INVALID_LANE_JOB_SHAPE');
 }
 if(bytes>LANES.length*LANE_ENV_BYTES)deny('LANE_ENV_TOTAL_LIMIT');
 return needs;
}
export function provenance({root,lane,contract,expectedHead,workflowSha256,env=process.env}){
 if(!LANES.includes(lane))deny('UNKNOWN_LANE');
 const actual=identity(root,expectedHead),clock=clocks(env),owner=contract.lanes[lane];
 const files=collect(root,owner.artifacts);
 requireEvidence(files,owner.requiredRetainedEvidence,'MISSING_REQUIRED_RETAINED_EVIDENCE');
 const producedNotUploaded=collect(root,owner.requiredProducedEvidence);
 requireEvidence(producedNotUploaded,owner.requiredProducedEvidence,'MISSING_REQUIRED_PRODUCED_EVIDENCE');
 const readSource=gitSource(root,actual),extensionProofBindings=contract.extension.proofs.filter(p=>p.lane===lane).map(spec=>validateExtensionProof(spec,readFileSync(path.join(root,spec.path)),{expectedHead:actual,readSource,readEvidence:file=>readFileSync(path.join(root,cleanPath(file)))}));
 const record=seal({version:2,proofBindings:extensionProofBindings,lane,head:actual,...clock,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files});
 if(Buffer.byteLength(JSON.stringify(record))>400*1024)deny('PROVENANCE_LIMIT');
 assertLaneOutputSize(JSON.stringify(record));
 return record;
}
export function gate({needs,contract,expectedHead,workflowSha256,runId,runAttempt,readSource}){
 validateContract(contract);if(!head(expectedHead)||!sha(workflowSha256)||!positive(runId)||!positive(runAttempt))deny('EXPECTED_IDENTITY_INVALID');
 if(typeof readSource!=='function')deny('PROOF_SOURCE_RESOLVER');
 exactKeys(needs,LANES,'MISSING_OR_EXTRA_LANE');
 const paths=new Set(),artifacts=new Set();let fileCount=0;
 const records=[];
 for(const lane of LANES){
  const job=needs[lane];if(job?.result!=='success')deny('LANE_NOT_SUCCESS');
  exactKeys(job.outputs,['provenance','artifactId','artifactDigest'],'MISSING_LANE_OUTPUT');
  if(!positive(job.outputs.artifactId)||!sha(job.outputs.artifactDigest))deny('MISSING_ARTIFACT');
  if(artifacts.has(job.outputs.artifactId))deny('ARTIFACT_COLLISION');artifacts.add(job.outputs.artifactId);
  if(typeof job.outputs.provenance!=='string'||Buffer.byteLength(job.outputs.provenance)>400*1024)deny('PROVENANCE_LIMIT');
  let record;try{record=JSON.parse(job.outputs.provenance);}catch{deny('INVALID_PROVENANCE_JSON');}
  exactKeys(record,['version','lane','head','runId','runAttempt','workflowSha256','contractSha256','blockIds','commandDigests','artifactPatterns','requiredRetainedEvidence','requiredProducedEvidence','producedNotUploaded','verifierSha256','packageLockSha256','requirementsSha256','files','proofBindings','manifestSha256'],'INVALID_PROVENANCE_SHAPE');
  if(record.version!==2||record.lane!==lane||record.head!==expectedHead||record.runId!==runId||record.runAttempt!==runAttempt||record.workflowSha256!==workflowSha256||record.contractSha256!==EXPECTED_CONTRACT_SHA256||record.verifierSha256!==verifierSha256()||record.packageLockSha256!==contract.packageLockSha256||record.requirementsSha256!==contract.requirementsSha256)deny('PROVENANCE_IDENTITY');
  if(!sha(record.manifestSha256)||hash(JSON.stringify(unseal(record))+'\n')!==record.manifestSha256)deny('PROVENANCE_DIGEST');
  equal(record.blockIds,contract.lanes[lane].blocks,'BLOCK_COVERAGE');
  equal(record.commandDigests,record.blockIds.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),'COMMAND_DIGEST');
  equal(record.artifactPatterns,contract.lanes[lane].artifacts,'ARTIFACT_PATTERN_COVERAGE');
  if(!Array.isArray(record.files)||!record.files.length||record.files.length>2000)deny('EMPTY_EVIDENCE');
  for(const file of record.files){
   exactKeys(file,['path','sha256','bytes'],'INVALID_EVIDENCE_SHAPE');cleanPath(file.path);
   if(paths.has(file.path))deny('PATH_COLLISION');paths.add(file.path);
   if(!sha(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>64*1024*1024)deny('INVALID_EVIDENCE_DIGEST');
   if(!record.artifactPatterns.some(pattern=>matches(file.path,pattern)))deny('PATH_NOT_OWNED');
  }
  equal(record.requiredRetainedEvidence,contract.lanes[lane].requiredRetainedEvidence,'RETAINED_EVIDENCE_CONTRACT');
  equal(record.requiredProducedEvidence,contract.lanes[lane].requiredProducedEvidence,'PRODUCED_EVIDENCE_CONTRACT');
  requireEvidence(record.files,record.requiredRetainedEvidence,'MISSING_REQUIRED_RETAINED_EVIDENCE');
  if(!Array.isArray(record.producedNotUploaded)||record.producedNotUploaded.length!==record.requiredProducedEvidence.length)deny('MISSING_REQUIRED_PRODUCED_EVIDENCE');
  for(const file of record.producedNotUploaded){
   exactKeys(file,['path','sha256','bytes'],'INVALID_EVIDENCE_SHAPE');cleanPath(file.path);
   if(paths.has(file.path))deny('PATH_COLLISION');paths.add(file.path);
   if(!sha(file.sha256)||!Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>64*1024*1024)deny('INVALID_EVIDENCE_DIGEST');
   if(!record.requiredProducedEvidence.includes(file.path))deny('PRODUCED_EVIDENCE_NOT_OWNED');
  }
  requireEvidence(record.producedNotUploaded,record.requiredProducedEvidence,'MISSING_REQUIRED_PRODUCED_EVIDENCE');
  if(record.files.reduce((n,item)=>n+item.bytes,0)>200*1024*1024)deny('EVIDENCE_LIMIT');
  assertProofBindings(record.proofBindings,contract,lane,record.files,expectedHead,readSource);
  fileCount+=record.files.length;
  records.push({lane,artifactId:job.outputs.artifactId,artifactDigest:job.outputs.artifactDigest,manifestSha256:record.manifestSha256,fileCount:record.files.length,producedNotUploaded:record.producedNotUploaded,blockIds:record.blockIds,proofBindings:record.proofBindings});
 }
 equal(records.flatMap(record=>record.blockIds).sort((a,b)=>a-b),contract.blocks.map(block=>block.id),'TOTAL_BLOCK_COVERAGE');
 return {version:1,state:'PASS',head:expectedHead,runId,runAttempt,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,lanes:records,commandBlocks:51,artifactPatterns:51,requiredRetainedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredRetainedEvidence).length,producedNotUploadedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredProducedEvidence).length,fileCount};
}
function expectedNeeds(contract,expectedHead,workflowSha256,readSource){
 return Object.fromEntries(LANES.map((lane,i)=>{
  const owner=contract.lanes[lane],file=filename=>({path:filename,sha256:'1'.repeat(64),bytes:128});
  const record=seal({version:2,proofBindings:proofBindings(contract,lane,owner.requiredRetainedEvidence.map(file),expectedHead,readSource),lane,head:expectedHead,runId:'100',runAttempt:'1',workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded:owner.requiredProducedEvidence.map(file),verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files:owner.requiredRetainedEvidence.map(file)});
  return [lane,{result:'success',outputs:{provenance:JSON.stringify(record),artifactId:String(i+1),artifactDigest:'2'.repeat(64)}}];
 }));
}
export function selftest(workflow,contract,root=process.cwd()){
 const checks=[];
 function good(name,run){run();checks.push({name,result:'PASS'});}
 function bad(name,code,run){assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code});}
 good('yaml-parsed-and-full-baseline-equivalent',()=>equivalent(workflow,contract));
 const shadowSource=file=>Buffer.from(utf8(readFileSync(path.join(root,sourcePath(file)))).replaceAll('\r\n','\n'));
 const original=buildWorkflow(contract),expectedHead='a'.repeat(40),workflowSha256='b'.repeat(64),needs=expectedNeeds(contract,expectedHead,workflowSha256,shadowSource),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1',readSource:shadowSource};
 bad('gate-source-resolver-required','PROOF_SOURCE_RESOLVER',()=>gate({...input,readSource:undefined}));
 good('gate-all-eight-lanes-and-50-blocks',()=>{assert.equal(contract.blocks.filter(block=>block.id<=56).length,50);assert.equal(gate(input).commandBlocks,51);});
 good('gate-all-eight-lanes-and-additive-KYC-57',()=>assert.equal(gate(input).commandBlocks,51));
 const laneEnv=Object.fromEntries(LANES.map(lane=>[laneEnvironmentKey(lane),JSON.stringify(needs[lane])]));
 good('lane-environment-preserves-exact-eight-records',()=>equal(readLaneNeedsEnvironment({...laneEnv,PATH:'controlled'}),needs,'ENV_TRANSPORT_CHANGED'));
 good('lane-environment-still-runs-exact-gate',()=>assert.equal(gate({...input,needs:readLaneNeedsEnvironment(laneEnv)}).commandBlocks,51));
 bad('legacy-aggregate-environment-denied','LEGACY_AGGREGATE_ENV_DENIED',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_NEEDS_JSON:JSON.stringify(needs)}));
 const missingEnv={...laneEnv};delete missingEnv.WORKSPACE_LANE_META_JSON;
 bad('missing-lane-environment-denied','LANE_ENV_COVERAGE',()=>readLaneNeedsEnvironment(missingEnv));
 bad('extra-lane-environment-denied','LANE_ENV_COVERAGE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_UNKNOWN_JSON:'{}'}));
 bad('invalid-lane-environment-json-denied','INVALID_LANE_ENV_JSON',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'{'}));
 bad('empty-lane-environment-denied','LANE_ENV_LIMIT',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:''}));
 bad('non-string-lane-environment-denied','LANE_ENV_LIMIT',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:17}));
 bad('null-lane-job-denied','INVALID_LANE_JOB_SHAPE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'null'}));
 bad('array-lane-job-denied','INVALID_LANE_JOB_SHAPE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'[]'}));
 bad('extra-lane-job-field-denied','INVALID_LANE_JOB_SHAPE',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:JSON.stringify({...needs.meta,extra:true})}));
 bad('oversized-lane-environment-denied','LANE_ENV_LIMIT',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'x'.repeat(LANE_ENV_BYTES+1)}));
 bad('invalid-lane-environment-unicode-denied','LANE_ENV_ENCODING',()=>readLaneNeedsEnvironment({...laneEnv,WORKSPACE_LANE_META_JSON:'"\ud800"'}));
 good('lane-output-size-bounds-every-fixture',()=>{for(const lane of LANES)assert.ok(assertLaneOutputSize(needs[lane].outputs.provenance)<LANE_OUTPUT_BYTES);});
 bad('oversized-output-blocked-before-github-output','LANE_OUTPUT_TRANSPORT_LIMIT',()=>assertLaneOutputSize('x'.repeat(LANE_OUTPUT_BYTES)));
 bad('escaped-output-size-uses-wire-bytes','LANE_OUTPUT_TRANSPORT_LIMIT',()=>assertLaneOutputSize('"'.repeat(LANE_OUTPUT_BYTES/2)));
 bad('non-string-output-size-denied','PROVENANCE_LIMIT',()=>assertLaneOutputSize(null));
 for(const result of ['failure','cancelled','skipped']){const n=clone(needs);n.people.result=result;bad('gate-'+result,'LANE_NOT_SUCCESS',()=>gate({...input,needs:n}));}
 let n=clone(needs);delete n.meta;bad('missing-lane','MISSING_OR_EXTRA_LANE',()=>gate({...input,needs:n}));
 n=clone(needs);n.unexpected=n.meta;bad('extra-lane','MISSING_OR_EXTRA_LANE',()=>gate({...input,needs:n}));
 n=clone(needs);n.meta.outputs.artifactId='';bad('missing-artifact','MISSING_ARTIFACT',()=>gate({...input,needs:n}));
 n=clone(needs);delete n.meta.outputs.provenance;bad('missing-output','MISSING_LANE_OUTPUT',()=>gate({...input,needs:n}));
 n=clone(needs);n.meta.outputs.artifactDigest='';bad('missing-artifact-digest','MISSING_ARTIFACT',()=>gate({...input,needs:n}));
 n=clone(needs);n.meta.outputs.artifactId=n.contracts.outputs.artifactId;bad('artifact-id-collision','ARTIFACT_COLLISION',()=>gate({...input,needs:n}));
 function altered(name,code,edit){const n=clone(needs),r=JSON.parse(n.people.outputs.provenance);edit(r);delete r.manifestSha256;n.people.outputs.provenance=JSON.stringify(seal(r));bad(name,code,()=>gate({...input,needs:n}));}
 altered('wrong-source-sha','PROVENANCE_IDENTITY',r=>{r.head='c'.repeat(40);});
 altered('wrong-workflow-sha','PROVENANCE_IDENTITY',r=>{r.workflowSha256='c'.repeat(64);});
 altered('wrong-contract-sha','PROVENANCE_IDENTITY',r=>{r.contractSha256='c'.repeat(64);});
 altered('wrong-run','PROVENANCE_IDENTITY',r=>{r.runId='101';});
 altered('old-attempt','PROVENANCE_IDENTITY',r=>{r.runAttempt='2';});
 altered('omitted-block','BLOCK_COVERAGE',r=>{r.blockIds.pop();});
 altered('duplicate-block','BLOCK_COVERAGE',r=>{r.blockIds.push(r.blockIds[0]);});
 altered('changed-command','COMMAND_DIGEST',r=>{r.commandDigests[0]='3'.repeat(64);});
 altered('omitted-artifact-pattern','ARTIFACT_PATTERN_COVERAGE',r=>{r.artifactPatterns.pop();});
 altered('omitted-evidence-file','MISSING_REQUIRED_RETAINED_EVIDENCE',r=>{r.files.pop();});
 altered('empty-evidence','EMPTY_EVIDENCE',r=>{r.files=[];});
 altered('invalid-file-digest','INVALID_EVIDENCE_DIGEST',r=>{r.files[0].sha256='';});
 altered('oversized-file','INVALID_EVIDENCE_DIGEST',r=>{r.files[0].bytes=64*1024*1024+1;});
 altered('duplicate-evidence-path','PATH_COLLISION',r=>{r.files.push(clone(r.files[0]));});
 altered('foreign-artifact-path','PATH_NOT_OWNED',r=>{r.files[0].path='.vercel/private/foreign.json';});
 altered('traversal-relative','UNSAFE_PATH',r=>{r.files[0].path='.vercel/private/../foreign.json';});
 altered('traversal-absolute','UNSAFE_PATH',r=>{r.files[0].path='/tmp/foreign.json';});
 altered('traversal-backslash','UNSAFE_PATH',r=>{r.files[0].path='C:\\private\\foreign.json';});
 n=clone(needs);n.people.outputs.provenance='{}';bad('empty-provenance','INVALID_PROVENANCE_SHAPE',()=>gate({...input,needs:n}));
 n=clone(needs);let r=JSON.parse(n.people.outputs.provenance);r.files[0].bytes++;n.people.outputs.provenance=JSON.stringify(r);bad('unsealed-provenance-change','PROVENANCE_DIGEST',()=>gate({...input,needs:n}));
 for(const [name,edit] of [
  ['omitted-workflow-block',w=>{w.jobs.people.steps.splice(6,1);}],
  ['duplicate-workflow-block',w=>{w.jobs.people.steps.splice(6,0,clone(w.jobs.people.steps[6]));}],
  ['changed-workflow-command',w=>{w.jobs.plans.steps[6].run+='\ntrue';}],
  ['changed-service',w=>{w.jobs.field.services.postgres.image='postgres:latest';}],
  ['changed-trigger',w=>{w.on.push.branches=['master'];}],
  ['missing-needed-lane',w=>{w.jobs.workspace.needs.pop();}],
  ['always-green-gate',w=>{w.jobs.workspace.steps[4].run='true';}],
  ['changed-upload-path',w=>{w.jobs.channels.steps.at(-1).with.path+='.vercel/private/**\n';}]
 ]){const w=clone(original);edit(w);bad(name,'WORKFLOW_NOT_EQUIVALENT',()=>equivalent(w,contract));}
 good('all-three-optional-PNG-patterns-absent',()=>assert.equal(gate(input).state,'PASS'));
 for(const lane of LANES)for(const pattern of contract.lanes[lane].optionalArtifactPatterns){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.files.push({path:pattern.replaceAll('*','fixture'),sha256:'4'.repeat(64),bytes:128});
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
  good('optional-PNG-present-'+lane,()=>assert.equal(gate({...input,needs:n}).state,'PASS'));
 }
 for(const lane of LANES)for(const filename of contract.lanes[lane].requiredRetainedEvidence){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.files=r.files.filter(file=>file.path!==filename);
  if(!r.files.length){const owned=contract.lanes[lane].artifacts.find(pattern=>pattern.endsWith('/'));if(owned)r.files.push({path:owned+'diagnostic.json',sha256:'4'.repeat(64),bytes:128});}
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
   const historicalEmpty=lane==='contracts'&&filename==='.vercel/private/biometric-real-model-proof.json';
   bad((historicalEmpty?'missing-main-proof-with-other-artifact-':'missing-main-proof-')+lane+'-'+filename,r.files.length?'MISSING_REQUIRED_RETAINED_EVIDENCE':'EMPTY_EVIDENCE',()=>gate({...input,needs:n}));
   if(historicalEmpty){const prior=clone(needs),empty=JSON.parse(prior[lane].outputs.provenance);empty.files=[];delete empty.manifestSha256;prior[lane].outputs.provenance=JSON.stringify(seal(empty));bad('missing-main-proof-'+lane+'-'+filename,'EMPTY_EVIDENCE',()=>gate({...input,needs:prior}));}
 }
 for(const lane of LANES)for(const filename of contract.lanes[lane].requiredProducedEvidence){
  const n=clone(needs),r=JSON.parse(n[lane].outputs.provenance);
  r.producedNotUploaded=r.producedNotUploaded.filter(file=>file.path!==filename);
  delete r.manifestSha256;n[lane].outputs.provenance=JSON.stringify(seal(r));
  bad('missing-produced-not-uploaded-'+filename,'MISSING_REQUIRED_PRODUCED_EVIDENCE',()=>gate({...input,needs:n}));
 }
 altered('required-retained-list-omitted','RETAINED_EVIDENCE_CONTRACT',r=>{r.requiredRetainedEvidence.pop();});
 altered('required-produced-list-omitted','PRODUCED_EVIDENCE_CONTRACT',r=>{r.requiredProducedEvidence.pop();});
 altered('wrong-helper-digest','PROVENANCE_IDENTITY',r=>{r.verifierSha256='c'.repeat(64);});
 altered('wrong-package-lock-digest','PROVENANCE_IDENTITY',r=>{r.packageLockSha256='c'.repeat(64);});
 altered('wrong-python-requirements-digest','PROVENANCE_IDENTITY',r=>{r.requirementsSha256='c'.repeat(64);});
 altered('produced-file-foreign','PRODUCED_EVIDENCE_NOT_OWNED',r=>{r.producedNotUploaded[0].path='.vercel/foreign-produced.json';});
 for(const file of ['scripts/verify-participants-ui.mjs','src/lib/field-operations-store.mjs','AGENTS.md']){
  bad('dirty-tracked-source-'+file,'TRACKED_SOURCE_DIRTY',()=>assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:[file]}));
 }
 bad('dirty-staged-source','TRACKED_SOURCE_DIRTY',()=>assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:['src/lib/verified-session.mjs']}));
 bad('source-HEAD-mismatch-before-provenance','SOURCE_HEAD_MISMATCH',()=>assertSourceIdentity({expectedHead,actualHead:'c'.repeat(40),dirtyTrackedPaths:[]}));
 good('clean-source-identity',()=>assert.equal(assertSourceIdentity({expectedHead,actualHead:expectedHead,dirtyTrackedPaths:[]}),expectedHead));
 const wrongLane=clone(contract),wa='.vercel/customer-whatsapp-evidence/';
 wrongLane.lanes.meta.artifacts=wrongLane.lanes.meta.artifacts.filter(pattern=>pattern!==wa);
 wrongLane.lanes['workspace-ui'].artifacts.push(wa);
 bad('wrong-upload-lane-for-canonical-producer','RETAINED_EVIDENCE_NOT_OWNED',()=>validateContract(wrongLane));
 const wrongProducer=clone(contract);wrongProducer.evidenceProducers[0].producer='scripts/verify-workspace-ui.mjs';
 bad('wrong-principal-proof-producer','EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(wrongProducer));
 const overtimeProducers=contract.evidenceProducers.filter(producer=>producer.blockId===52);
 good('overtime-block-52-three-canonical-proofs',()=>{
  equal(overtimeProducers.map(producer=>({path:producer.path,lane:producer.lane,retained:producer.retained})),[
   {path:'.vercel/private/field-overtime-unit-proof.json',lane:'field',retained:true},
   {path:'.vercel/private/field-overtime-postgres-proof.json',lane:'field',retained:true},
   {path:'.vercel/private/field-overtime-ui-proof.json',lane:'field',retained:true}
  ],'OVERTIME_PRODUCER_CONTRACT');
  equal(contract.lanes.field.blocks,[20,39,40,52],'OVERTIME_BLOCK_ASSIGNMENT');
 });
 for(const [name,code,edit] of [
  ['omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(block=>block.id!==52);}],
  ['duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(block=>block.id===52)));}],
  ['duplicate-assignment','CONTRACT_COVERAGE',c=>{c.lanes.field.blocks.push(52);}],
  ['foreign-lane','EVIDENCE_PRODUCER_COVERAGE',c=>{c.lanes.field.blocks=c.lanes.field.blocks.filter(id=>id!==52);c.lanes.meta.blocks.push(52);}],
  ['changed-command','CONTRACT_COMMAND',c=>{c.blocks.find(block=>block.id===52).step.run+='\ntrue';}]
 ]){const c=clone(contract);edit(c);bad('overtime-52-'+name,code,()=>validateContract(c));}
 function alteredField(name,code,edit){const n=clone(needs),r=JSON.parse(n.field.outputs.provenance);edit(r);delete r.manifestSha256;n.field.outputs.provenance=JSON.stringify(seal(r));bad(name,code,()=>gate({...input,needs:n}));}
 alteredField('overtime-52-omitted-from-provenance','BLOCK_COVERAGE',r=>{r.blockIds=r.blockIds.filter(id=>id!==52);});
 alteredField('overtime-52-duplicate-in-provenance','BLOCK_COVERAGE',r=>{r.blockIds.push(52);});
 alteredField('overtime-52-command-digest-changed','COMMAND_DIGEST',r=>{r.commandDigests[r.blockIds.indexOf(52)]='3'.repeat(64);});
 for(const producer of overtimeProducers){
  const omitted=clone(contract);omitted.evidenceProducers=omitted.evidenceProducers.filter(item=>item.path!==producer.path);
  bad('overtime-producer-omitted-'+producer.path,'EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(omitted));
  const notRetained=clone(contract);notRetained.evidenceProducers.find(item=>item.path===producer.path).retained=false;
  bad('overtime-producer-not-retained-'+producer.path,'RETAINED_PRODUCER_COVERAGE',()=>validateContract(notRetained));
  const foreign=clone(contract);foreign.evidenceProducers.find(item=>item.path===producer.path).lane='meta';
  bad('overtime-producer-foreign-lane-'+producer.path,'EVIDENCE_PRODUCER_COVERAGE',()=>validateContract(foreign));
  const colliding=clone(contract);colliding.evidenceProducers.find(item=>item.path===producer.path).path=contract.evidenceProducers[0].path;
  bad('overtime-producer-path-collision-'+producer.path,'DUPLICATE_REQUIRED_EVIDENCE',()=>validateContract(colliding));
 }
 const packageLf=Buffer.from('{"controlledLock":1}\n'),requirementsLf=Buffer.from('controlled-fixture==1.0\n');
 const fixtureContract={packageLockSha256:hash(packageLf),requirementsSha256:hash(requirementsLf)};
 const fixtureDependencies={packageLockBytes:packageLf,requirementsBytes:requirementsLf,contract:fixtureContract};
 good('canonical-dependencies-LF-accepted',()=>equal(assertDependencies(fixtureDependencies),fixtureContract,'DEPENDENCY_FIXTURE_RESULT'));
 good('canonical-dependencies-CRLF-accepted',()=>equal(assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from(packageLf.toString().replaceAll('\n','\r\n')),requirementsBytes:Buffer.from(requirementsLf.toString().replaceAll('\n','\r\n'))}),fixtureContract,'DEPENDENCY_FIXTURE_RESULT'));
 bad('dependency-package-content-altered','PACKAGE_LOCK_CHANGED',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from('{"controlledLock":2}\n')}));
 bad('dependency-requirements-content-altered','PYTHON_REQUIREMENTS_CHANGED',()=>assertDependencies({...fixtureDependencies,requirementsBytes:Buffer.from('controlled-fixture==2.0\n')}));
 bad('dependency-invalid-UTF8-denied','DEPENDENCY_TEXT_ENCODING',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from([0xff])}));
 bad('dependency-lone-CR-is-content','PACKAGE_LOCK_CHANGED',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.from(packageLf.toString().replaceAll('\n','\r'))}));
 bad('dependency-BOM-is-content','PACKAGE_LOCK_CHANGED',()=>assertDependencies({...fixtureDependencies,packageLockBytes:Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),packageLf])}));
 const parent=path.resolve(root,'.vercel/workspace-ci-evidence');
 mkdirSync(parent,{recursive:true});
 const fixture=mkdtempSync(path.join(parent,'ci-gate-selftest-fixture-'));
 const ownedFile=relative=>{cleanPath(relative);const filename=path.resolve(fixture,relative);assert.ok(filename.startsWith(fixture+path.sep));return filename;};
 try{
  good('filesystem-preflight-clean-retained-and-produced',()=>assert.equal(assertFreshEvidence({root:fixture,lane:'people',contract}).state,'PASS'));
  for(const lane of LANES)for(const filename of contract.lanes[lane].requiredProducedEvidence){
   const target=ownedFile(filename);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'controlled stale evidence; not a real producer proof');
   bad('filesystem-preflight-stale-produced-'+filename,'STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane,contract}));
   rmSync(target);
  }
  const retained=ownedFile(contract.lanes.people.requiredRetainedEvidence[0]);mkdirSync(path.dirname(retained),{recursive:true});writeFileSync(retained,'controlled stale retained evidence');
  bad('filesystem-preflight-stale-main-retained','STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:'people',contract}));
  rmSync(retained);
  for(const producer of overtimeProducers){
   const target=ownedFile(producer.path);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,'controlled stale overtime proof');
   bad('filesystem-preflight-stale-overtime-'+producer.path,'STALE_EVIDENCE',()=>assertFreshEvidence({root:fixture,lane:'field',contract}));
   rmSync(target);
  }
 }finally{
  const resolved=path.resolve(fixture);assert.ok(resolved.startsWith(parent+path.sep)&&path.basename(resolved).startsWith('ci-gate-selftest-fixture-'));
  rmSync(resolved,{recursive:true,force:true});
 }
  for(const spec of contract.extension.proofs){
   for(const [name,code,edit] of [
    ['binding-omitted','PROOF_BINDINGS',r=>{r.proofBindings=r.proofBindings.filter(b=>b.id!==spec.id);}],
    ['binding-head','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceRevision='f'.repeat(40);}],
    ['binding-proof-digest','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).proofSha256='f'.repeat(64);}],
    ['binding-source-manifest','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='invalid';}],
    ['binding-source-manifest-valid64-wrong','PROOF_BINDING_SOURCE',r=>{r.proofBindings.find(b=>b.id===spec.id).sourceManifestSha256='f'.repeat(64);}],
    ['binding-harness','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).harnessSha256='f'.repeat(64);}],
    ['binding-checks','PROOF_BINDING_IDENTITY',r=>{r.proofBindings.find(b=>b.id===spec.id).checks=0;}]
   ]){if(spec.kind==='UI_CAUSAL'&&name==='binding-checks')continue;const n=clone(needs),r=JSON.parse(n[spec.lane].outputs.provenance);edit(r);delete r.manifestSha256;n[spec.lane].outputs.provenance=JSON.stringify(seal(r));bad(spec.id+'-'+name,code,()=>gate({...input,needs:n}));}
   bad(spec.id+'-current-source-bytes-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,readSource:file=>file===spec.sourceFiles[0]?Buffer.concat([shadowSource(file),Buffer.from('altered shadow source')]):shadowSource(file)}));
   const changedPath=clone(contract);changedPath.extension.proofs.find(p=>p.id===spec.id).sourceFiles[0]=spec.producer;bad(spec.id+'-current-source-path-tampered','PROOF_BINDING_SOURCE',()=>gate({...input,contract:changedPath}));
  }
  for(const id of [53,54,55,56,57])for(const [name,code,edit] of [
   ['omitted','CONTRACT_BLOCKS',c=>{c.blocks=c.blocks.filter(b=>b.id!==id);}],
   ['duplicate','CONTRACT_BLOCKS',c=>{c.blocks.push(clone(c.blocks.find(b=>b.id===id)));}],
   ['command-changed','CONTRACT_COMMAND',c=>{c.blocks.find(b=>b.id===id).step.run+='\ntrue';}]
  ]){const c=clone(contract);edit(c);bad('extension-block-'+id+'-'+name,code,()=>validateContract(c));}
  const changedBaseline=clone(contract);changedBaseline.blocks[0].step.run+='\ntrue';changedBaseline.blocks[0].commandSha256=hash(changedBaseline.blocks[0].step.run);bad('old-block-changed-with-recomputed-digest','BASELINE_BLOCKS_CHANGED',()=>validateContract(changedBaseline));
  const freshFixture=mkdtempSync(path.join(parent,'ci-bank-intake-selftest-fixture-'));
  try{for(const spec of contract.extension.proofs){const filename=path.join(freshFixture,spec.path);mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,'shadow stale evidence\n');bad(spec.id+'-stale-main-before-execution','STALE_EVIDENCE',()=>assertFreshEvidence({root:freshFixture,lane:spec.lane,contract}));rmSync(filename);}}
  finally{const resolved=path.resolve(freshFixture);assert.ok(path.dirname(resolved)===path.resolve(parent)&&path.basename(resolved).startsWith('ci-bank-intake-selftest-fixture-'));rmSync(resolved,{recursive:true,force:true});}
  checks.push(...extensionSelftest(contract,root));return checks;
}
function writeJson(filename,value){mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,JSON.stringify(value,null,2)+'\n');}
function options(argv){const parsed={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])deny('CLI_ARGUMENT');parsed[argv[i].slice(2)]=argv[i+1];}return parsed;}
function main(){
 const [mode,...args]=process.argv.slice(2),opts=options(args),root=path.resolve(opts.root||process.cwd()),contract=loadContract(path.resolve(root,opts.contract||contractPath)),file=path.resolve(root,opts.workflow||workflowPath),bytes=readFileSync(file),workflow=yaml.load(bytes.toString('utf8'));
 equivalent(workflow,contract);dependencies(root,contract);
 if(mode==='equivalence'){if(opts['expected-head'])identity(root,opts['expected-head']);console.log(JSON.stringify({state:'PASS',commandBlocks:51,artifactPatterns:51,lanes:8}));return;}
 if(mode==='selftest'){
  const sourceHead=opts['expected-head']?identity(root,opts['expected-head']):identity(root,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
   const checks=selftest(workflow,contract,root),output=path.resolve(root,opts.output||'.vercel/workspace-ci-evidence/selftest.json');writeJson(output,{version:1,state:'PASS',head:sourceHead,workflowSha256:hash(bytes),contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,checks});
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  writeFileSync(output.replace(/\.json$/,'.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="workspace-ci-private-design" tests="${checks.length}" failures="0">${checks.map(check=>`<testcase name="${escape(check.name)}"/>`).join('')}</testsuite>\n`);
  console.log(JSON.stringify({state:'PASS',checks:checks.length,commandBlocks:51,artifactPatterns:51,lanes:8}));return;
 }
 if(mode==='preflight'){
  identity(root,opts['expected-head']);clocks(process.env);if(!LANES.includes(opts.lane))deny('UNKNOWN_LANE');
  assertFreshEvidence({root,lane:opts.lane,contract});
  console.log(JSON.stringify({state:'PASS',lane:opts.lane}));return;
 }
 if(mode==='provenance'){
  const record=provenance({root,lane:opts.lane,contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes)}),manifest=path.join(root,'.vercel/workspace-ci-evidence/lane-'+opts.lane+'.json');mkdirSync(path.dirname(manifest),{recursive:true});writeFileSync(manifest,JSON.stringify(unseal(record))+'\n');
  if(!process.env.GITHUB_OUTPUT)deny('OUTPUT_FILE_REQUIRED');writeFileSync(process.env.GITHUB_OUTPUT,'record='+JSON.stringify(record)+'\n',{flag:'a'});return;
 }
 if(mode==='gate'){
  identity(root,opts['expected-head']);const filename=path.join(root,'.vercel/workspace-ci-evidence/gate.json');
  try{const report=gate({needs:readLaneNeedsEnvironment(process.env),contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes),...clocks(process.env),readSource:gitSource(root,opts['expected-head'])});writeJson(filename,report);console.log(JSON.stringify({state:'PASS',lanes:8,commandBlocks:51,artifactPatterns:51,fileCount:report.fileCount}));}
  catch(error){writeJson(filename,{version:1,state:'FAIL',code:error.code||'GATE_FAILED'});throw error;}return;
 }
 deny('UNKNOWN_COMMAND');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({state:'FAIL',code:error.code||'VERIFIER_FAILED'}));process.exitCode=1;}}
