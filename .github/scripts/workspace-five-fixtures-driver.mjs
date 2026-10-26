import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Focal-only driver for the exact source declared in the separately hashed binding.
// Source and Operations SHA identities are independently checked.
const phase=process.argv[2],caseId=process.argv[3],opsRoot=path.resolve(process.env.OPS_ROOT||''),root=process.cwd();
const bindingFile=path.join(opsRoot,'.github/probes/workspace-five-fixtures-bindings.json');
const binding=JSON.parse(readFileSync(bindingFile,'utf8'));
const evidence=path.join(opsRoot,'.vercel/workspace-five-fixtures',caseId||'unknown');
mkdirSync(evidence,{recursive:true});
const write=(name,value)=>writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:16*1024*1024});
const clean=cwd=>assert.equal(git(cwd,'status','--porcelain'),'',`Tracked source must remain clean: ${cwd}`);
const actualHead=cwd=>git(cwd,'rev-parse','HEAD').trim();
const rawSnapshot=(cwd,files)=>files.map(file=>{assert.equal(typeof file,'string');assert.ok(!file.includes('..')&&!path.isAbsolute(file));const target=path.join(cwd,file),stat=lstatSync(target);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Only actual tracked regular source files');return{path:file,bytes:stat.size,sha256:hash(readFileSync(target))};});
const sourceSnapshot=()=>rawSnapshot(root,git(root,'ls-files','-z').split('\0').filter(Boolean));
const opsFiles=['.github/workflows/pilot-workspace-five-fixtures.yml','.github/scripts/workspace-five-fixtures-driver.mjs','.github/probes/workspace-five-fixtures-bindings.json'];
const fixture=binding.fixtures.find(row=>row.id===caseId);
const context=()=>({phase,caseId,sourceSha:binding.sourceSha,sourceActual:actualHead(root),operationsSha:actualHead(opsRoot),githubSha:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,at:new Date().toISOString()});
function bound(){
 assert.equal(process.platform,'linux');assert.equal(binding.state,'SEALED_REVIEWED_LITERAL_SOURCE');assert.match(binding.sourceSha,/^[a-f0-9]{40}$/);assert.equal(binding.sourceSha,process.env.SOURCE_SHA);assert.equal(actualHead(root),binding.sourceSha);assert.equal(actualHead(opsRoot),process.env.GITHUB_SHA);assert.ok(fixture,'Exact declared fixture required');assert.equal(binding.fixtures.length,5);assert.equal(new Set(binding.fixtures.map(r=>r.id)).size,5);assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');assert.equal(process.env.CUTOVER_TEST_DATABASE_URL,'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci');assert.equal(process.env.DATABASE_URL,'postgresql://build_only:build_only@127.0.0.1:5432/build_only');assert.equal(process.env.NEXT_TELEMETRY_DISABLED,'1');
 for(const flag of ['VERCEL','VERCEL_ENV','WORKSPACE_UI_SCENARIO','MOBILE_IDENTITY_UI_SCENARIO','MOBILE_IDENTITY_UI_WIDTH','MOBILE_IDENTITY_UI_EVIDENCE_DIR','PLAN_RECOVERY_UI_MODES'])assert.equal(process.env[flag],undefined,`Full existing fixture scope requires unset ${flag}`);
 assert.ok(Array.isArray(binding.sourceFiles));assert.equal(binding.sourceFiles.length,1380);assert.deepEqual(sourceSnapshot(),binding.sourceFiles);clean(root);clean(opsRoot);
}
function verifyProof(){
 const proof=JSON.parse(readFileSync(path.join(root,fixture.proof),'utf8'));
 assert.equal(fixture.validatedInsteadOfStatus?proof.validated:proof.status,fixture.validatedInsteadOfStatus?true:'PASS');assert.equal(proof.fullSuite,fixture.hasFullSuite?true:undefined);if(fixture.widths)assert.deepEqual(proof.widths,[320,390,768,1280]);assert.equal(proof.checks.length,fixture.expectedChecks);
 for(const field of ['errors','pageErrors'])if(Object.hasOwn(proof,field))assert.deepEqual(proof[field],[]);
 const current=new Map(binding.sourceFiles.map(r=>[r.path,r.sha256]));
 if(fixture.hasHarnessHash)assert.equal(proof.harnessSha256,current.get(fixture.script),'Actual file bytes, as the original harness emits them');
 if(fixture.hasOriginalSourceManifest){assert.ok(Array.isArray(proof.sourceManifest));assert.deepEqual(proof.sourceManifest.map(row=>row.path).sort(),fixture.expectedSourceManifestPaths);for(const row of proof.sourceManifest){assert.deepEqual(Object.keys(row).sort(),['path','sha256']);assert.equal(row.sha256,current.get(row.path),'Original/copy-identical bytes; no normalization');}assert.deepEqual(proof.documentCurveSourceManifest,fixture.expectedDocumentSourceManifest);assert.deepEqual(proof.fixtureTransforms,fixture.expectedFixtureTransforms,'Generated relocation hashes have their own exact sequential-byte contract');}
 if(caseId==='workspace-ui'){assert.equal(proof.focusedScenario,null);assert.equal(proof.productionLoginVerified,false);assert.equal(proof.productionDataWritten,false);assert.equal(proof.physicalWhatsAppVerified,false);}
 if(caseId==='meta'){assert.equal(proof.productionDataWritten,false);assert.equal(proof.realMetaRequests,0);assert.equal(proof.physicalAttendanceAccepted,false);assert.equal(proof.realHumanIdentityAccepted,false);assert.deepEqual(proof.cleanup,{poolClosed:true,ownConnectionsClosed:true,databaseRemoved:true,adminClosed:true});assert.deepEqual(proof.checks,fixture.exactCheckNames);}
 if(caseId==='people'){assert.equal(proof.focusedScenario,null);assert.deepEqual(proof.cleanup,{browserClosed:true,serverClosed:true,gracefulCloseAcknowledged:true,fixtureRemoved:true});assert.equal(proof.limits.preparedBytes,1024*1024);assert.equal(proof.limits.originalBytes,20*1024*1024);assert.equal(proof.limits.originalPixels,24_000_000);for(const key of ['physicalPhone','realDocument','realHumanIdentityAccepted','realProviderWrites'])assert.equal(proof.limitations[key],false);assert.equal(proof.limitations.noOfflineFileRestore,true);}
 if(caseId==='overtime'){assert.equal(proof.synthetic,true);assert.equal(proof.providerCalls,0);assert.equal(proof.realBusinessDatabaseUsed,false);assert.equal(proof.physicalPhoneAccepted,false);assert.equal(proof.humanAccepted,false);assert.equal(proof.fixtureRemoved,true);assert.equal(proof.agentsRestored,true);assert.deepEqual(proof.checks.map(r=>({mode:r.mode,width:r.width})),[320,390,768,1280].flatMap(width=>fixture.exactModes.map(mode=>({mode,width}))));}
 if(caseId==='plan-recovery'){assert.equal(proof.synthetic,true);assert.equal(proof.realProviderCalls,false);assert.equal(proof.physicalPhoneAccepted,false);assert.equal(proof.serverClosedBeforeFixtureRemoval,true);assert.equal(proof.fixtureRemoved,true);assert.deepEqual(proof.selectedModes,fixture.exactModes);assert.deepEqual(proof.checks.map(r=>({mode:r.mode,width:r.width})),[320,390,768,1280].flatMap(width=>fixture.exactModes.map(mode=>({mode,width}))));}
 write('postcondition.json',{...context(),state:'FOCAL_FIXTURE_POSTCONDITIONS_PASS',proof:fixture.proof,proofSha256:hash(readFileSync(path.join(root,fixture.proof))),checks:proof.checks.length,fullSuite:proof.fullSuite??null,sourceMatched:true,fullOfficialWorkspaceAccepted:false,productionOrHumanAccepted:false});
}
try{
 if(phase==='preflight'){bound();assert.equal(existsSync(path.join(root,fixture.proof)),false,'A stale proof may not pass this new run');write('before.json',{...context(),state:'FOCAL_PREFLIGHT_PASS',sourceFiles:sourceSnapshot(),opsFiles:rawSnapshot(opsRoot,opsFiles)});}
 else if(phase==='validate'){bound();verifyProof();}
 else if(phase==='final'){
  const beforeFile=path.join(evidence,'before.json');assert.ok(existsSync(beforeFile),'Missing preflight cannot establish completion');const before=JSON.parse(readFileSync(beforeFile,'utf8'));bound();assert.deepEqual(sourceSnapshot(),before.sourceFiles);assert.deepEqual(rawSnapshot(opsRoot,opsFiles),before.opsFiles);write('final.json',{...context(),state:'FINAL_SOURCE_AND_OPS_RAW_FENCES_PASS',sourceFileCount:1380,postconditionPresent:existsSync(path.join(evidence,'postcondition.json')),fullOfficialWorkspaceAccepted:false,productionOrHumanAccepted:false});
 }else throw Error('Unknown phase');
}catch(error){write('failure-'+(phase||'unknown')+'.json',{...context(),state:'FAIL',message:error.message,stack:error.stack,sourceOrOpsMayBeIncomplete:true,fullOfficialWorkspaceAccepted:false,productionOrHumanAccepted:false});throw error;}
