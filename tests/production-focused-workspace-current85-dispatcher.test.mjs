import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createWorkspaceCiVerifier,current85TypedGateSelftest,loadContract} from '../.github/scripts/verify-workspace-ci-parallelization.mjs';
import {createSyntheticCurrent85FixtureFromSource} from './fixtures/focused-workspace-current85-fixture.mjs';

// Explicit unit models only. These tests do not issue browser/CI evidence or
// modify the process environment; production and CLI defaults still use Git.
const rejected=error=>error?.code==='CURRENT85_VERIFIER_DEPENDENCY_INVALID';
const environment=()=>Object.fromEntries(['CI','GITHUB_ACTIONS','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'].map(key=>[key,process.env[key]]));

test('factory rejects undeclared dependency switches and non-object inputs',()=>{
 for(const dependencies of [null,1,[],{acceptSyntheticHead:true}])assert.throws(()=>createWorkspaceCiVerifier(dependencies),rejected);
});

test('factory rejects an incomplete or non-callable explicit Git authority',()=>{
 for(const port of [{readGitBlob:()=>null},{resolveGitTree:()=>null,readGitBlob:()=>null,readWorkingSource:'not a function'}])assert.throws(()=>createWorkspaceCiVerifier({current85GitAuthority:port}),rejected);
});

test('fixture input validation rejects invalid unit identities before source reads',()=>{
 let reads=0;const readSource=()=>{reads++;return null;};
 for(const options of [{readSource:null},{readSource,expectedHead:'not a revision'},{readSource,expectedTree:'not a tree'},{readSource,runId:0},{readSource,runAttempt:0}])assert.throws(()=>createSyntheticCurrent85FixtureFromSource(options),TypeError);
 assert.equal(reads,0);
});

test('factory creation freezes its API and does not invoke Git or change CI environment',()=>{
 const before=environment();let reads=0;const reader=()=>{reads++;return null;};
 const verifier=createWorkspaceCiVerifier({current85GitAuthority:{resolveGitTree:reader,readGitBlob:reader,readWorkingSource:reader}});
 assert(Object.isFrozen(verifier));assert.deepEqual(Object.keys(verifier).sort(),['expectedNeeds','gate','validateExtensionProof']);assert.equal(reads,0);assert.deepEqual(environment(),before);
});

test('typed dispatcher expectedNeeds and eight-lane gate enforce all twenty source-bound unit cases',()=>{
 const before=environment(),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const contract=loadContract(path.join(root,'.github/workspace-acceptance-contract.json'));
 // LF belongs only to this unit source model; validator inputs are never
 // normalized by the acceptance API itself.
 const readSource=file=>{try{return Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n'));}catch{return null;}};
 const checks=current85TypedGateSelftest(contract,readSource);
 assert.equal(checks.length,20);assert.equal(new Set(checks.map(row=>row.name)).size,20);
 for(const row of checks){assert.equal(row.result,'PASS');assert.match(row.boundary,/UNIT/);}
 assert.deepEqual(environment(),before);
});
