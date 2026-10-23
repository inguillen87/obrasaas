import {createHash} from 'node:crypto';
import {lstatSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {parse} from '@babel/parser';
import * as budget from './plan-budget-current-ci-lineage.mjs';

const contractPath='.github/workspace-acceptance-contract.json';
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error('Capture runtime collector rejected: '+reason),{code:'CAPTURE_QUALITY_COLLECTOR_REJECTED',reason});};
const safe=file=>typeof file==='string'&&file!==''&&!path.posix.isAbsolute(file)&&path.posix.normalize(file)===file&&!/[\\:\x00-\x1f]/.test(file)&&!file.split('/').includes('..');
const ordered=files=>Array.isArray(files)&&files.every(safe)&&same(files,[...new Set(files)].sort());
const quality=['src/lib/capture-quality-gate.mjs','src/lib/capture-quality-policy.mjs','src/lib/private-capture-quality.mjs'];
const pilot=['src/lib/organization-pilot-coverage.mjs','src/lib/platform-operator-authority.mjs'];
const image='src/app/(identity)/cuenta/kyc-image-quality.mjs';
const synthetic='scripts/lib/synthetic-capture-quality.mjs';
const companyLegacyFixture='tests/fixtures/meta-kyc-challenge-legacy-v2.mjs';
const fixture='tests/fixtures/capture-quality-synthetic.mjs';
const collector='scripts/lib/capture-runtime-canonical-collectors.mjs';
const preanalysisFixtures=['tests/fixtures/company-kyc-memory.mjs','tests/fixtures/meta-kyc-chat-memory.mjs','tests/fixtures/meta-kyc-context-feedback-memory.mjs','tests/fixtures/own-company-meta.mjs','tests/fixtures/own-company-runtime.mjs'];
const facialFixtures=["tests/fixtures/meta-kyc-challenge-legacy-v2.mjs","tests/fixtures/participant-facial-audit-memory.mjs","tests/fixtures/participant-facial-chat-audit-memory.mjs"];
const facialFixtureEdges=[['tests/fixtures/company-kyc-memory.mjs','./meta-kyc-challenge-legacy-v2.mjs',facialFixtures[0]],['tests/fixtures/company-kyc-memory.mjs','./participant-facial-chat-audit-memory.mjs',facialFixtures[2]],[facialFixtures[2],'./participant-facial-audit-memory.mjs',facialFixtures[1]]];
const facial=['src/lib/participant-facial-attempt.mjs','src/lib/participant-facial-policy.mjs','src/lib/participant-facial-precommit.mjs'];
const facialEdges=[['src/lib/participant-store.mjs','./participant-facial-precommit.mjs',facial[2]],[facial[2],'./participant-facial-attempt.mjs',facial[0]],[facial[2],'./participant-facial-policy.mjs',facial[1]]];
const qualityEdges=[[facial[2],'./capture-quality-gate.mjs',quality[0]],[quality[0],'./private-capture-quality.mjs',quality[2]],['src/lib/meta-kyc-conversation.mjs','./capture-quality-policy.mjs',quality[1]]];
const pilotEdges=[['src/lib/organization-usage-store.mjs','./organization-pilot-coverage.mjs',pilot[0]],[pilot[0],'./platform-operator-authority.mjs',pilot[1]]];
const uiEdges=[['src/app/(identity)/cuenta/participant-panel.js','../../../lib/capture-quality-policy.mjs',quality[1]],['src/app/(identity)/cuenta/participant-kyc-capture.js','../../../lib/capture-quality-policy.mjs',quality[1]],['src/app/(identity)/cuenta/kyc-photo-preparation.js','./kyc-image-quality.mjs',image]];
const fixtureEdges=[['tests/production-meta-customer-composition.test.mjs','./fixtures/meta-kyc-context-feedback-memory.mjs','tests/fixtures/meta-kyc-context-feedback-memory.mjs'],['tests/fixtures/meta-kyc-context-feedback-memory.mjs','./meta-kyc-chat-memory.mjs','tests/fixtures/meta-kyc-chat-memory.mjs'],['tests/fixtures/meta-kyc-chat-memory.mjs','./capture-quality-synthetic.mjs',fixture],[fixture,'../../scripts/lib/synthetic-capture-quality.mjs',synthetic]];
// The old collector is retained. Each exception below binds its actual current
// emitter/copy graph to one explicit additive delta, not to a caller's list.
const deltas=Object.freeze({
 PG_BANK:{id:'bank-postgres',producer:'scripts/verify-private-bank-account-postgres.mjs',previousCount:18,previousPathsSha256:'ee94b61d206c1493aa68d6bb1b8b83f925a55d814e362b09292e009fc8deb9a4',emitted:[...quality,...facial],additions:[...quality,...facial],edges:[...qualityEdges,...facialEdges]},
 PG_INTAKE:{id:'intake-postgres',producer:'scripts/verify-employee-intake-postgres.mjs',previousCount:32,previousPathsSha256:'f1570f201a21092710528999618e24149ae9d478ddd2c832c007f1b29f40e5a6',emitted:[...quality,...facial],additions:[...quality,...facial],edges:[...qualityEdges,...facialEdges]},
 UI_INTAKE:{id:'intake-ui',producer:'scripts/verify-employee-intake-ui.mjs',previousCount:39,previousPathsSha256:'6c68ffec2bcd268b9e7131575395133fc898ff7be8fb41b62edea8306b35548b',emitted:[image],additions:[image,quality[1]],edges:uiEdges},
 PG_FIELD:{id:'field-canonical-postgres',producer:'scripts/verify-field-operations-postgres.mjs',previousCount:134,previousPathsSha256:'19c54254b4b02db8c837bc891b15566d9c88d0ff8e28db5a7e2718eeb82be80a',emitted:[synthetic,...quality,...pilot,...facial],additions:[synthetic,...quality,...pilot,...facial],edges:[...qualityEdges,...pilotEdges,...facialEdges]},
 PG_PARTICIPANT_KYC_PREANALYSIS:{id:'participant-kyc-preanalysis-postgres',producer:'scripts/verify-participant-kyc-preanalysis-ci.mjs',previousCount:250,previousPathsSha256:'60240900100c26e8f43b32d671a4b574124cc7ccb6be216e1679d93746f9b26e',emitted:[synthetic,image,...quality,...pilot,fixture,collector,...preanalysisFixtures,...facial,...facialFixtures],additions:[synthetic,image,...quality,...pilot,fixture,collector,...preanalysisFixtures,...facial,...facialFixtures],edges:[...qualityEdges,...pilotEdges,...uiEdges,...fixtureEdges,...facialEdges,...facialFixtureEdges,['.github/scripts/verify-workspace-ci-parallelization.mjs','../../scripts/lib/capture-runtime-canonical-collectors.mjs',collector]]},
});

export const hasCaptureRuntime=contract=>Boolean(contract?.planBudgetCurrentRevision?.captureQualityRuntime);
export function captureRuntimeCollectorDeclarations(){return structuredClone(deltas);}

function imports(file,read,parentRead){
 const value=read(file);reject(Buffer.isBuffer(value),'ACTUAL_BYTES_'+file);
 if(!/\.[cm]?jsx?$/.test(file))return [];
 reject(Buffer.from(value.toString('utf8')).equals(value),'ACTUAL_UTF8_'+file);
 const tree=parse(value.toString('utf8'),{sourceType:'unambiguous',plugins:['jsx'],createImportExpressions:true}),refs=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  const dynamic=node.type==='ImportExpression'||node.type==='CallExpression'&&node.callee?.type==='Import';
  const ref=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)?node.source:dynamic?node.arguments[0]:null;
  if(ref){
   if(ref.type!=='StringLiteral'){
    // Existing computed loaders grant no new dependency authority. Their entire
    // authenticated source must remain byte-equivalent to the parent.
    const previous=parentRead(file);reject(Buffer.isBuffer(previous)&&lf(previous).equals(lf(value)),'CHANGED_COMPUTED_IMPORT_'+file);
   }else if(ref.value.startsWith('.')||ref.value.startsWith('@/')){
    const base=ref.value.startsWith('@/')?'src/'+ref.value.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),ref.value));reject(safe(base),'IMPORT_ESCAPE_'+file);
    const target=[base,base+'.js',base+'.mjs',base+'.css',base+'/index.js'].find(candidate=>Buffer.isBuffer(read(candidate)));reject(Boolean(target),'MISSING_IMPORT_'+file);refs.push({literal:ref.value,target});
   }else reject(!/^(?:https?:|file:|data:)/.test(ref.value),'REMOTE_IMPORT_'+file);
  }
  for(const child of Object.values(node))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);
 }
 visit(tree.program);return refs;
}

function checkWitnesses(previousFiles,delta,read,parentRead){
 const pending=[...previousFiles],graph=new Map();
 while(pending.length){const file=pending.shift();if(graph.has(file))continue;const edges=imports(file,read,parentRead);graph.set(file,edges);for(const edge of edges)if(!graph.has(edge.target))pending.push(edge.target);}
 for(const [source,literal,target] of delta.edges)reject(graph.has(source)&&(graph.get(source)||[]).filter(row=>row.literal===literal&&row.target===target).length===1,'EXACT_IMPORT_WITNESS_'+source+'_'+target);
 for(const file of delta.additions)reject(graph.has(file),'NEW_DEPENDENCY_REACHABLE_'+file);
}

function companyFiles(parentSpec,currentSpec,root,read,parentRead,collectParentCompany){
 const producer=currentSpec.producer,source=read(producer),previous=parentRead(producer);
 const oldRoots=['src/app/(identity)/cuenta/private-bank-account-format.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs','scripts/lib/kyc-context-feedback-native.mjs','scripts/lib/kyc-current-image-native.mjs','scripts/lib/kyc-neutral-step-guidance-native.mjs'];
 const declaration=roots=>"const sourceManifest=[...sources('src/lib'),"+roots.map(file=>"'"+file+"'").join(',')+"].map(file=>({path:file,sha256:sha(readFileSync(path.join(root,file)))})),harnessSha256=sha(readFileSync(new URL(import.meta.url)));";
 reject(source.toString('utf8').split(declaration([synthetic,...oldRoots,companyLegacyFixture])).length===2,'EXACT_CURRENT_COMPANY_EMITTER');
 reject(imports(producer,read,parentRead).filter(row=>row.literal==='../tests/fixtures/meta-kyc-challenge-legacy-v2.mjs'&&row.target===companyLegacyFixture).length===1,'EXACT_CURRENT_COMPANY_LEGACY_FIXTURE_IMPORT');
 reject(previous.toString('utf8').split(declaration(oldRoots)).length===2,'EXACT_PARENT_COMPANY_EMITTER');
 const scan=relative=>readdirSync(path.join(root,relative),{withFileTypes:true}).flatMap(entry=>{
  reject(!entry.isSymbolicLink(),'COMPANY_LIBRARY_LINK');const file=relative+'/'+entry.name;
  reject(safe(file),'COMPANY_LIBRARY_PATH');return entry.isDirectory()?scan(file):[file];
 });
 const currentLibraries=scan('src/lib').sort(),parentLibraries=parentSpec.sourceFiles.filter(file=>file.startsWith('src/lib/'));
 reject(same(collectParentCompany(parentRead,parentLibraries),parentSpec.sourceFiles),'EXACT_PARENT_COMPANY_COLLECTOR');
 const files=[...currentLibraries,synthetic,...oldRoots,companyLegacyFixture].sort();reject(ordered(files),'COMPANY_COMPLETE_SCAN');
 for(const file of files)reject(Buffer.isBuffer(read(file)),'COMPANY_SOURCE_BYTES_'+file);
 reject(same(files,currentSpec.sourceFiles),'EXACT_CURRENT_COMPANY_SET');return files;
}

// This entry uses fresh physical bytes for every invocation. Pure inverse
// helpers alone cannot authorize an actual collector or a native receipt.
export function captureRuntimeProducerSourceFiles({spec,root,legacyCollect,collectParentCompany}){
 let raw;try{raw=readFileSync(path.join(root,contractPath));}catch(error){if(error.code==='ENOENT')return legacyCollect(spec,root);throw error;}
 const contract=JSON.parse(raw);
 if(!hasCaptureRuntime(contract))return legacyCollect(spec,root);
 const read=file=>{if(!safe(file))return null;try{const target=path.join(root,file),stat=lstatSync(target);return stat.isFile()&&!stat.isSymbolicLink()?readFileSync(target):null;}catch{return null;}};
 return budget.withCaptureRuntimePreviousSources(contract,read,(parent,parentRead)=>{
  const currentSpec=contract.extension.proofs.find(row=>row.kind===spec.kind),parentSpec=parent.extension.proofs.find(row=>row.kind===spec.kind);
  reject(currentSpec&&parentSpec&&same(spec,currentSpec),'EXACT_CURRENT_PROOF_SPEC');
  reject(same(currentSpec.sourceFiles,budget.captureRuntimeProofSourceSet(contract,spec.kind)),'AUTHENTICATED_CURRENT_PROOF_SET');
  if(spec.kind==='PG_COMPANY_KYC')return companyFiles(parentSpec,currentSpec,root,read,parentRead,collectParentCompany);
  const emitted=legacyCollect(parentSpec,root),delta=deltas[spec.kind];let files=emitted;
  if(delta){
   reject(parentSpec.id===delta.id&&parentSpec.producer===delta.producer&&ordered(parentSpec.sourceFiles)&&parentSpec.sourceFiles.length===delta.previousCount&&sha(JSON.stringify(parentSpec.sourceFiles))===delta.previousPathsSha256,'EXACT_PARENT_SET_'+spec.kind);
   reject(ordered(emitted)&&same(emitted,[...parentSpec.sourceFiles,...delta.emitted].sort()),'EXACT_ACTUAL_EMITTER_DELTA_'+spec.kind);
   checkWitnesses(parentSpec.sourceFiles,delta,read,parentRead);files=[...parentSpec.sourceFiles,...delta.additions].sort();
  }
  reject(ordered(files)&&same(files,currentSpec.sourceFiles),'EXACT_ACTUAL_CURRENT_SET_'+spec.kind);
  for(const file of files)reject(Buffer.isBuffer(read(file)),'CURRENT_SOURCE_BYTES_'+file);
  return files;
 });
}

export function buildCaptureRuntimeWorkflow(contract,parentWorkflow){
 reject(hasCaptureRuntime(contract),'CAPTURE_RUNTIME_REQUIRED');
 budget.restoreCaptureRuntimePreviousContract(contract);
 const runtime=contract.planBudgetCurrentRevision.captureQualityRuntime;
 reject(sha(JSON.stringify(parentWorkflow))===runtime.workflowParentSemanticSha256,'EXACT_PARENT_WORKFLOW');
 const additions=budget.captureRuntimeWorkflowAdditions(contract),current=structuredClone(parentWorkflow);
 for(const row of additions){reject(Array.isArray(current.jobs?.[row.lane]?.steps)&&row.index<=current.jobs[row.lane].steps.length,'WORKFLOW_INSERTION');current.jobs[row.lane].steps.splice(row.index,0,structuredClone(row.step));}
 const restored=structuredClone(current);
 for(const row of [...additions].reverse()){reject(same(restored.jobs[row.lane].steps[row.index],row.step),'EXACT_WORKFLOW_ADDITION');restored.jobs[row.lane].steps.splice(row.index,1);}
 reject(same(restored,parentWorkflow),'COMPLETE_PARENT_WORKFLOW');return current;
}

// Retained block29 CORE proof. This is distinct from extension PG_COMPANY_KYC.
// Authenticate the complete current producer graph and RAW receipt before an
// owned, source-fields-only projection into the unchanged238-source oracle.
export function normalizeCaptureCompanyCoreNativeProof({contract,proof,root,readSource,readEvidence,normalizeLegacy}){
 const producer='scripts/verify-company-channel-postgres.mjs',proofPath='.vercel/private/company-channel-postgres-proof.json',legacyFixture='tests/fixtures/meta-kyc-challenge-legacy-v2.mjs',fixturePath='scripts/fixtures/canonical-participant-kyc.mjs';
 const fail=(ok,reason)=>reject(ok,'CORE_COMPANY_'+reason),read=file=>{fail(safe(file),'SAFE_SOURCE');let raw;try{raw=readSource(file);}catch{}fail(Buffer.isBuffer(raw)&&Buffer.from(raw.toString('utf8')).equals(raw),'SOURCE_BYTES_'+file);return raw;},sorted=files=>Array.isArray(files)&&same(files,[...new Set(files)].sort())&&files.every(safe);
 fail(hasCaptureRuntime(contract)&&typeof root==='string'&&typeof readSource==='function'&&typeof readEvidence==='function'&&typeof normalizeLegacy==='function','CURRENT_PORTS_REQUIRED');
 const contractBefore=JSON.stringify(contract),proofBefore=JSON.stringify(proof),rawInput=readEvidence(proofPath);fail(Buffer.isBuffer(rawInput)&&rawInput.length>0&&rawInput.length<=512*1024&&Buffer.from(rawInput.toString('utf8')).equals(rawInput),'RAW_PROOF_BYTES');const raw=Buffer.from(rawInput);let owned;try{owned=JSON.parse(raw);}catch{fail(false,'RAW_PROOF_JSON');}fail(owned?.status==='PASS'&&same(owned,proof),'EXACT_RAW_PROOF');
 const roots=['scripts/lib/company-channel-disposable-fixture.mjs','scripts/lib/company-channel-migration.mjs','scripts/lib/disposable-postgres-cleanup.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs'],kycOnly=['scripts/lib/kyc-context-feedback-native.mjs','scripts/lib/kyc-current-image-native.mjs','scripts/lib/kyc-neutral-step-guidance-native.mjs'],coreOnly=[fixturePath,...roots.slice(0,3),'tests/fixtures/own-company-meta.mjs'];
 const emitter=read(producer).toString('utf8').replaceAll('\r\n','\n'),tree=parse(emitter,{sourceType:'module'}),statements=tree.program.body.map(node=>emitter.slice(node.start,node.end));
 const witnesses=["sources('src/lib');","for(const file of ['scripts/lib/company-channel-disposable-fixture.mjs','scripts/lib/company-channel-migration.mjs','scripts/lib/disposable-postgres-cleanup.mjs','scripts/fixtures/meta-signup-field-lifecycle-fixture.mjs'])source(file);","source('tests/fixtures/own-company-meta.mjs');","for(const file of canonicalParticipantKycSourceFiles())if(!sourceManifest.some(entry=>entry.path===file))source(file);"];
 for(const witness of witnesses)fail(statements.filter(text=>text===witness).length===1,'EXACT_EMITTER_WITNESS');
 const libraries=[];function scan(relative){for(const entry of readdirSync(path.join(root,relative),{withFileTypes:true})){fail(!entry.isSymbolicLink(),'LIBRARY_LINK');const file=relative+'/'+entry.name;fail(safe(file),'LIBRARY_PATH');if(entry.isDirectory())scan(file);else{fail(lstatSync(path.join(root,file)).isFile(),'LIBRARY_FILE');libraries.push(file);}}}scan('src/lib');libraries.sort();
 const closure=new Set();function visit(file){if(closure.has(file))return;closure.add(file);for(const match of read(file).toString('utf8').matchAll(/(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g)){const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));fail(dependency.startsWith('src/')||dependency.startsWith('scripts/fixtures/')||dependency==='scripts/lib/synthetic-capture-quality.mjs','CANONICAL_IMPORT');visit(dependency);}}visit(fixturePath);
 const derived=[...new Set([...libraries,...roots,'tests/fixtures/own-company-meta.mjs',...closure])].sort(),spec=contract.extension?.proofs?.find(row=>row.kind==='PG_COMPANY_KYC');fail(spec&&sorted(spec.sourceFiles)&&same(spec.sourceFiles.filter(file=>file.startsWith('src/lib/')),libraries),'AUTHENTICATED_KYC_LIBRARY_JOIN');fail(kycOnly.every(file=>spec.sourceFiles.includes(file)),'KYC_LITERAL_ROOTS');
 const remove=[...kycOnly];if(spec.sourceFiles.includes(legacyFixture)){fail(!derived.includes(legacyFixture),'LEGACY_FIXTURE_NOT_CORE_DEPENDENCY');remove.push(legacyFixture);}const joined=[...new Set([...spec.sourceFiles.filter(file=>!remove.includes(file)),...coreOnly])].sort();fail(same(joined,derived),'EXACT_CORE_ROOT_JOIN');fail(derived.length===254,'CURRENT_GRAPH_254');
 const additions=['scripts/lib/synthetic-capture-quality.mjs','src/lib/capture-quality-gate.mjs','src/lib/capture-quality-policy.mjs','src/lib/consumption-evidence-catalog.mjs','src/lib/consumption-evidence-http.mjs','src/lib/field-hours-report.mjs','src/lib/meta-consumption-evidence-catalog.mjs','src/lib/organization-pilot-coverage.mjs','src/lib/participant-facial-attempt.mjs','src/lib/participant-facial-policy.mjs','src/lib/participant-facial-precommit.mjs','src/lib/plan-budget-source.mjs','src/lib/platform-operator-authority.mjs','src/lib/platform-pilot-coverage-http.mjs','src/lib/private-capture-quality.mjs','src/lib/voice-consumption-draft.mjs'],previous=derived.filter(file=>!additions.includes(file));fail(additions.every(file=>derived.includes(file))&&previous.length===238&&sha(JSON.stringify(previous))==='2419e373bc9ca766076ae015bae3af9bb187a7df663a5cc82979990e5b5c2d61','EXACT_REVIEWED_238_SET');
 const sourcePins=new Map();for(const file of [...derived,producer])sourcePins.set(file,sha(read(file)));const verify=()=>{fail(JSON.stringify(contract)===contractBefore&&JSON.stringify(proof)===proofBefore,'CALLER_UNCHANGED');budget.verifyCaptureRuntimeCurrentSources(contract,readSource);fail(Array.isArray(owned.sourceManifest)&&owned.sourceManifest.length===derived.length,'CURRENT_RAW_COUNT');const seen=new Set();for(const row of owned.sourceManifest){fail(row&&same(Object.keys(row).sort(),['path','sha256'])&&safe(row.path)&&typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256)&&!seen.has(row.path),'CURRENT_RAW_ROW');seen.add(row.path);fail(sourcePins.get(row.path)===row.sha256&&sha(read(row.path))===row.sha256,'CURRENT_RAW_SOURCE_'+row.path);}fail(same([...seen].sort(),derived),'CURRENT_RAW_SET');fail(owned.harnessSha256===sourcePins.get(producer)&&sha(read(producer))===owned.harnessSha256,'CURRENT_RAW_HARNESS');const final=readEvidence(proofPath);fail(Buffer.isBuffer(final)&&final.equals(raw),'RAW_UNCHANGED');};
 verify();const projected=structuredClone(owned);projected.sourceManifest=previous.map(file=>({path:file,sha256:sourcePins.get(file)}));projected.harnessSha256=sourcePins.get(producer);const sourceOnly=()=>fail(same({...projected,sourceManifest:owned.sourceManifest,harnessSha256:owned.harnessSha256},owned),'ONLY_SOURCE_FIELDS_PROJECTED');sourceOnly();const projectedBefore=JSON.stringify(projected);let legacy;
 try{legacy=normalizeLegacy(projected,readSource);fail(!legacy||typeof legacy.then!=='function','SYNCHRONOUS_ORACLE');fail(legacy?.status==='PASS'&&legacy.sourceReferences===238,'LEGACY_ORACLE_RESULT');}finally{fail(JSON.stringify(projected)===projectedBefore,'ORACLE_INPUT_UNCHANGED');sourceOnly();verify();}
 return {status:'PASS',checks:legacy.checks,coreChecks:legacy.coreChecks,sourceReferences:derived.length,historicalSourceReferences:238,sourceOnlyProjection:true,rawProofTransformed:false,syntheticOnly:true,realAcceptance:false};
}

// OWN carries its original complete RAW receipt. Only an owned copy of the
// source fields enters the unchanged pre-capture neutral-guidance oracle.
export function normalizeCaptureOwnNeutralNativeProof({contract,proof,readSource,readEvidence,normalizeLegacy}){
 const producer='scripts/verify-company-kyc-outbound-compact-postgres.mjs',proofPath='.vercel/private/company-kyc-outbound-compact-postgres.json',fail=(ok,reason)=>reject(ok,'OWN_NEUTRAL_'+reason);
 fail(hasCaptureRuntime(contract)&&typeof readSource==='function'&&typeof readEvidence==='function'&&typeof normalizeLegacy==='function','CURRENT_PORTS_REQUIRED');
 const contractBefore=JSON.stringify(contract),proofBefore=JSON.stringify(proof),input=readEvidence(proofPath);fail(Buffer.isBuffer(input)&&input.length>0&&input.length<=512*1024&&Buffer.from(input.toString('utf8')).equals(input),'RAW_PROOF_BYTES');const raw=Buffer.from(input);let owned;try{owned=JSON.parse(raw);}catch{fail(false,'RAW_PROOF_JSON');}fail(owned?.status==='PASS'&&same(owned,proof)&&['LOCAL_REVIEW_SOURCE','EXACT_CI_SOURCE'].includes(owned.sourceState),'EXACT_RAW_PROOF');
 const read=file=>{fail(safe(file),'SAFE_SOURCE');const value=readSource(file);fail(Buffer.isBuffer(value)&&Buffer.from(value.toString('utf8')).equals(value),'SOURCE_BYTES_'+file);return value;},section=contract.planBudgetCurrentRevision,currentFamily=section.sourceFamilies.find(row=>row.family==='COMPACT'),advance=section.captureQualityRuntime.familyAdvances.find(row=>row.family==='COMPACT');
 const parent=budget.restoreCaptureRuntimePreviousContract(contract),parentFamily=parent.planBudgetCurrentRevision.sourceFamilies.find(row=>row.family==='COMPACT');
 fail(currentFamily&&parentFamily&&advance&&ordered(currentFamily.currentFiles)&&ordered(parentFamily.currentFiles)&&ordered(advance.additions),'EXACT_FAMILY_DESCRIPTOR');
 fail(advance.previousCount===144&&advance.currentCount===155&&parentFamily.currentFiles.length===advance.previousCount&&currentFamily.currentFiles.length===advance.currentCount&&advance.additions.length===11&&same(advance.removals,[])&&same([...parentFamily.currentFiles,...advance.additions].sort(),currentFamily.currentFiles),'EXACT_144_TO_155_UNION');
 const files=[...currentFamily.currentFiles],pins=new Map(files.map(file=>[file,sha(read(file))]));fail(files.includes(producer),'PRODUCER_IN_CURRENT_CLOSURE');
 const verify=()=>{
  fail(JSON.stringify(contract)===contractBefore&&JSON.stringify(proof)===proofBefore,'CALLER_UNCHANGED');budget.verifyCaptureRuntimeCurrentSources(contract,read);budget.verifyPlanBudgetActualClosure(contract,'COMPACT',{files,externalImports:[...currentFamily.externalImports]},read);
  fail(Array.isArray(owned.sourceManifest)&&owned.sourceManifest.length===files.length,'CURRENT_RAW_COUNT');const seen=new Set();for(const row of owned.sourceManifest){fail(row&&same(Object.keys(row).sort(),['path','sha256'])&&safe(row.path)&&typeof row.sha256==='string'&&/^[a-f0-9]{64}$/.test(row.sha256)&&!seen.has(row.path),'CURRENT_RAW_ROW');seen.add(row.path);fail(pins.get(row.path)===row.sha256&&sha(read(row.path))===row.sha256,'CURRENT_RAW_SOURCE_'+row.path);}fail(same([...seen].sort(),files),'CURRENT_RAW_SET');fail(owned.harnessSha256===pins.get(producer)&&sha(read(producer))===owned.harnessSha256,'CURRENT_RAW_HARNESS');const fresh=readEvidence(proofPath);fail(Buffer.isBuffer(fresh)&&fresh.equals(raw),'RAW_UNCHANGED');
 };
 verify();let legacy;
 try{
  legacy=budget.withCaptureRuntimePreviousSources(contract,read,(historical,historicalRead)=>{
   fail(same(historical,parent),'EXACT_PARENT_CONTRACT');const projected=structuredClone(owned);projected.sourceManifest=parentFamily.currentFiles.map(path=>({path,sha256:sha(historicalRead(path))}));projected.harnessSha256=sha(historicalRead(producer));
   const sourceOnly=()=>fail(same({...projected,sourceManifest:owned.sourceManifest,harnessSha256:owned.harnessSha256},owned),'ONLY_SOURCE_FIELDS_PROJECTED');sourceOnly();const projectedBefore=JSON.stringify(projected);let result;
   try{result=normalizeLegacy(projected,historical,historicalRead);fail(!result||typeof result.then!=='function','SYNCHRONOUS_ORACLE');fail(result?.status==='PASS'&&result.family==='OWN'&&result.currentNativeSourceCount===144&&result.currentCases===owned.neutralStepGuidanceNative?.cases?.length&&result.historicalCasesPreserved===4,'LEGACY_ORACLE_RESULT');}
   finally{fail(JSON.stringify(projected)===projectedBefore,'ORACLE_INPUT_UNCHANGED');sourceOnly();verify();}
   return result;
  });
 }finally{verify();}
 return {...legacy,currentNativeSourceCount:files.length,historicalNativeSourceCount:parentFamily.currentFiles.length,sourceOnlyProjection:true,rawProofTransformed:false,sourceState:owned.sourceState,identityOrProviderAccepted:false};
}
