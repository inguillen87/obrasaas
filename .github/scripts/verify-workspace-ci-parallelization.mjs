import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,lstatSync,realpathSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import yaml from 'js-yaml';

export const EXPECTED_CONTRACT_SHA256='a4f886a7a8d4613e0bec8da0047105e4b5117310c3a912b78cf99fbdb0479cf8';
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
  exactKeys(producer,['producer','path','retained','blockId','lane','baselineSourceLine','baselineProducerGitBlobSha256'],'EVIDENCE_PRODUCER_SHAPE');
  cleanPath(producer.path);if(!producer.path.endsWith('.json')||typeof producer.retained!=='boolean'||!sha(producer.baselineProducerGitBlobSha256)||!Number.isSafeInteger(producer.baselineSourceLine)||producer.baselineSourceLine<1)deny('EVIDENCE_PRODUCER_SHAPE');
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
 if(contract?.version!==1||contract.sourceCommit!=='b671dc697d9493fc171ed38432544d7a9d970968')deny('CONTRACT_BASE');
 equal(Object.keys(contract.lanes).sort(),[...LANES].sort(),'CONTRACT_LANES');
 const ids=contract.blocks.map(block=>block.id);
 equal(ids,Array.from({length:45},(_,i)=>i+7),'CONTRACT_BLOCKS');
 for(const block of contract.blocks){if(typeof block.step.run!=='string'||hash(block.step.run)!==block.commandSha256)deny('CONTRACT_COMMAND');}
 const assigned=Object.values(contract.lanes).flatMap(lane=>lane.blocks);
 equal([...assigned].sort((a,b)=>a-b),ids,'CONTRACT_COVERAGE');
 if(new Set(assigned).size!==45)deny('CONTRACT_DUPLICATE_BLOCK');
 const patterns=Object.values(contract.lanes).flatMap(lane=>lane.artifacts);
 equal([...patterns].sort(),[...contract.artifactPatterns].sort(),'CONTRACT_ARTIFACT_COVERAGE');
 if(patterns.length!==41||new Set(patterns).size!==41)deny('CONTRACT_ARTIFACT_DUPLICATE');
 patterns.forEach(patternValid);
 validateEvidenceContract(contract);
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
 return {blocks:45,artifactPatterns:41,lanes:8};
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
 const record=seal({version:1,lane,head:actual,...clock,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files});
 if(Buffer.byteLength(JSON.stringify(record))>400*1024)deny('PROVENANCE_LIMIT');
 assertLaneOutputSize(JSON.stringify(record));
 return record;
}
export function gate({needs,contract,expectedHead,workflowSha256,runId,runAttempt}){
 validateContract(contract);if(!head(expectedHead)||!sha(workflowSha256)||!positive(runId)||!positive(runAttempt))deny('EXPECTED_IDENTITY_INVALID');
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
  exactKeys(record,['version','lane','head','runId','runAttempt','workflowSha256','contractSha256','blockIds','commandDigests','artifactPatterns','requiredRetainedEvidence','requiredProducedEvidence','producedNotUploaded','verifierSha256','packageLockSha256','requirementsSha256','files','manifestSha256'],'INVALID_PROVENANCE_SHAPE');
  if(record.version!==1||record.lane!==lane||record.head!==expectedHead||record.runId!==runId||record.runAttempt!==runAttempt||record.workflowSha256!==workflowSha256||record.contractSha256!==EXPECTED_CONTRACT_SHA256||record.verifierSha256!==verifierSha256()||record.packageLockSha256!==contract.packageLockSha256||record.requirementsSha256!==contract.requirementsSha256)deny('PROVENANCE_IDENTITY');
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
  fileCount+=record.files.length;
  records.push({lane,artifactId:job.outputs.artifactId,artifactDigest:job.outputs.artifactDigest,manifestSha256:record.manifestSha256,fileCount:record.files.length,producedNotUploaded:record.producedNotUploaded,blockIds:record.blockIds});
 }
 equal(records.flatMap(record=>record.blockIds).sort((a,b)=>a-b),contract.blocks.map(block=>block.id),'TOTAL_BLOCK_COVERAGE');
 return {version:1,state:'PASS',head:expectedHead,runId,runAttempt,workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,lanes:records,commandBlocks:45,artifactPatterns:41,requiredRetainedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredRetainedEvidence).length,producedNotUploadedFiles:Object.values(contract.lanes).flatMap(owner=>owner.requiredProducedEvidence).length,fileCount};
}
function expectedNeeds(contract,expectedHead,workflowSha256){
 return Object.fromEntries(LANES.map((lane,i)=>{
  const owner=contract.lanes[lane],file=filename=>({path:filename,sha256:'1'.repeat(64),bytes:128});
  const record=seal({version:1,lane,head:expectedHead,runId:'100',runAttempt:'1',workflowSha256,contractSha256:EXPECTED_CONTRACT_SHA256,blockIds:[...owner.blocks],commandDigests:owner.blocks.map(id=>contract.blocks.find(block=>block.id===id).commandSha256),artifactPatterns:[...owner.artifacts],requiredRetainedEvidence:[...owner.requiredRetainedEvidence],requiredProducedEvidence:[...owner.requiredProducedEvidence],producedNotUploaded:owner.requiredProducedEvidence.map(file),verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,files:owner.requiredRetainedEvidence.map(file)});
  return [lane,{result:'success',outputs:{provenance:JSON.stringify(record),artifactId:String(i+1),artifactDigest:'2'.repeat(64)}}];
 }));
}
export function selftest(workflow,contract,root=process.cwd()){
 const checks=[];
 function good(name,run){run();checks.push({name,result:'PASS'});}
 function bad(name,code,run){assert.throws(run,error=>error.code===code);checks.push({name,result:'PASS',expectedDenial:code});}
 good('yaml-parsed-and-full-baseline-equivalent',()=>equivalent(workflow,contract));
 const original=buildWorkflow(contract),expectedHead='a'.repeat(40),workflowSha256='b'.repeat(64),needs=expectedNeeds(contract,expectedHead,workflowSha256),input={needs,contract,expectedHead,workflowSha256,runId:'100',runAttempt:'1'};
 good('gate-all-eight-lanes-and-45-blocks',()=>assert.equal(gate(input).commandBlocks,45));
 const laneEnv=Object.fromEntries(LANES.map(lane=>[laneEnvironmentKey(lane),JSON.stringify(needs[lane])]));
 good('lane-environment-preserves-exact-eight-records',()=>equal(readLaneNeedsEnvironment({...laneEnv,PATH:'controlled'}),needs,'ENV_TRANSPORT_CHANGED'));
 good('lane-environment-still-runs-exact-gate',()=>assert.equal(gate({...input,needs:readLaneNeedsEnvironment(laneEnv)}).commandBlocks,45));
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
  bad('missing-main-proof-'+lane+'-'+filename,r.files.length?'MISSING_REQUIRED_RETAINED_EVIDENCE':'EMPTY_EVIDENCE',()=>gate({...input,needs:n}));
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
 }finally{
  const resolved=path.resolve(fixture);assert.ok(resolved.startsWith(parent+path.sep)&&path.basename(resolved).startsWith('ci-gate-selftest-fixture-'));
  rmSync(resolved,{recursive:true,force:true});
 }
 return checks;
}
function writeJson(filename,value){mkdirSync(path.dirname(filename),{recursive:true});writeFileSync(filename,JSON.stringify(value,null,2)+'\n');}
function options(argv){const parsed={};for(let i=0;i<argv.length;i+=2){if(!argv[i]?.startsWith('--')||!argv[i+1])deny('CLI_ARGUMENT');parsed[argv[i].slice(2)]=argv[i+1];}return parsed;}
function main(){
 const [mode,...args]=process.argv.slice(2),opts=options(args),root=path.resolve(opts.root||process.cwd()),contract=loadContract(path.resolve(root,opts.contract||contractPath)),file=path.resolve(root,opts.workflow||workflowPath),bytes=readFileSync(file),workflow=yaml.load(bytes.toString('utf8'));
 equivalent(workflow,contract);dependencies(root,contract);
 if(mode==='equivalence'){if(opts['expected-head'])identity(root,opts['expected-head']);console.log(JSON.stringify({state:'PASS',commandBlocks:45,artifactPatterns:41,lanes:8}));return;}
 if(mode==='selftest'){
  const sourceHead=opts['expected-head']?identity(root,opts['expected-head']):identity(root,execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
   const checks=selftest(workflow,contract,root),output=path.resolve(root,opts.output||'.vercel/workspace-ci-evidence/selftest.json');writeJson(output,{version:1,state:'PASS',head:sourceHead,workflowSha256:hash(bytes),contractSha256:EXPECTED_CONTRACT_SHA256,verifierSha256:verifierSha256(),packageLockSha256:contract.packageLockSha256,requirementsSha256:contract.requirementsSha256,checks});
  const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  writeFileSync(output.replace(/\.json$/,'.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="workspace-ci-private-design" tests="${checks.length}" failures="0">${checks.map(check=>`<testcase name="${escape(check.name)}"/>`).join('')}</testsuite>\n`);
  console.log(JSON.stringify({state:'PASS',checks:checks.length,commandBlocks:45,artifactPatterns:41,lanes:8}));return;
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
  try{const report=gate({needs:readLaneNeedsEnvironment(process.env),contract,expectedHead:opts['expected-head'],workflowSha256:hash(bytes),...clocks(process.env)});writeJson(filename,report);console.log(JSON.stringify({state:'PASS',lanes:8,commandBlocks:45,artifactPatterns:41,fileCount:report.fileCount}));}
  catch(error){writeJson(filename,{version:1,state:'FAIL',code:error.code||'GATE_FAILED'});throw error;}return;
 }
 deny('UNKNOWN_COMMAND');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({state:'FAIL',code:error.code||'VERIFIER_FAILED'}));process.exitCode=1;}}
