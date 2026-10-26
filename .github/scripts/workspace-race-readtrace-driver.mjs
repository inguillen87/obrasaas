import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Diagnostic fences only. This does not validate the public Own76 contract.
const phase=process.argv[2],root=process.cwd(),ops=path.resolve(process.env.OPS_ROOT||'');
const binding=JSON.parse(readFileSync(path.join(ops,'.github/probes/workspace-race-readtrace-binding.json'),'utf8'));
const evidence=path.join(ops,'.vercel/workspace-race-readtrace');mkdirSync(evidence,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:null,maxBuffer:150*1024*1024});
const head=cwd=>git(cwd,'rev-parse','HEAD').toString().trim();
const names=cwd=>git(cwd,'ls-files','-z').toString().split('\0').filter(Boolean);
const snapshot=cwd=>names(cwd).map(file=>{assert.ok(!file.split('/').includes('..')&&!path.isAbsolute(file));const absolute=path.join(cwd,file),stat=lstatSync(absolute);assert.ok(stat.isFile()&&!stat.isSymbolicLink());return {path:file,size:stat.size,sha256:hash(readFileSync(absolute))};});
const record=(name,value)=>writeFileSync(path.join(evidence,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
function gitPhysical(cwd,rows){
 const input=Buffer.from(rows.map(row=>'HEAD:'+row.path).join('\n')+'\n');
 const buffer=execFileSync('git',['cat-file','--batch'],{cwd,input,encoding:null,maxBuffer:150*1024*1024});let offset=0;
 for(const row of rows){const end=buffer.indexOf(10,offset),match=/^([a-f0-9]{40}) blob (\d+)$/.exec(buffer.subarray(offset,end).toString());assert.ok(match);const size=Number(match[2]),bytes=buffer.subarray(end+1,end+1+size);assert.equal(buffer[end+1+size],10);assert.equal(size,row.size);assert.equal(hash(bytes),row.sha256,'Physical bytes must equal actual Git HEAD: '+row.path);offset=end+size+2;}assert.equal(offset,buffer.length);
}
function fenced(){
 assert.equal(process.platform,'linux');assert.equal(binding.status,'SEALED_DIAGNOSTIC_ONLY_NOT_PUBLIC_AUTHORITY');assert.match(binding.diagnosticSourceSha,/^[a-f0-9]{40}$/);assert.notEqual(binding.diagnosticSourceSha,binding.baseSourceSha);assert.equal(binding.diagnosticSourceSha,process.env.SOURCE_SHA);assert.equal(head(root),binding.diagnosticSourceSha);assert.equal(head(ops),process.env.GITHUB_SHA);
 assert.equal(git(root,'rev-parse','HEAD^').toString().trim(),binding.baseSourceSha);assert.equal(git(root,'rev-list','--parents','-n','1','HEAD').toString().trim().split(' ').length,2);
 assert.deepEqual(git(root,'diff-tree','--no-commit-id','--name-only','-r','HEAD^','HEAD').toString().trim().split('\n'),[binding.target]);
 assert.equal(names(root).length,1380);assert.equal(hash(readFileSync(path.join(root,binding.target))),binding.candidateSha256);
 assert.equal(git(ops,'rev-parse','HEAD^').toString().trim(),binding.baseOpsSha);assert.deepEqual(git(ops,'diff-tree','--no-commit-id','--name-only','-r','HEAD^','HEAD').toString().trim().split('\n'),['.github/probes/workspace-race-readtrace-binding.json','.github/scripts/workspace-race-readtrace-driver.mjs','.github/workflows/workspace-race-readtrace.yml']);
 assert.equal(JSON.parse(git(root,'show','HEAD:vercel.json')).git.deploymentEnabled['operations/*'],false);
 assert.equal(git(root,'status','--porcelain').length,0);assert.equal(git(ops,'status','--porcelain').length,0);
 assert.equal(binding.scenario,'portfolio-access-race');assert.equal(binding.sourceOwnMetadata.validatedForInstrumentedHarness,false);assert.equal(binding.sourceOwnMetadata.metadataFilesMustRemainByteExact,true);
 assert.equal(process.env.WORKSPACE_UI_SCENARIO,'portfolio-access-race');assert.equal(process.env.NEXT_TELEMETRY_DISABLED,'1');assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');
 assert.equal(process.env.CUTOVER_TEST_DATABASE_URL,'postgresql://cutover_test:cutover_test@127.0.0.1:5432/obrasaas_cutover_ci');assert.equal(process.env.DATABASE_URL,'postgresql://build_only:build_only@127.0.0.1:5432/build_only');
 for(const flag of ['VERCEL','VERCEL_ENV'])assert.equal(process.env[flag],undefined);
 const sourceFiles=snapshot(root),operationsFiles=snapshot(ops);gitPhysical(root,sourceFiles);gitPhysical(ops,operationsFiles);assert.equal(hash(Buffer.from(JSON.stringify(sourceFiles))),binding.diagnosticGitSourceFilesSha256);
 return {sourceSha:head(root),baseSourceSha:binding.baseSourceSha,operationsSha:head(ops),githubSha:process.env.GITHUB_SHA,classification:'DIAGNOSTIC_ONLY_NOT_PUBLIC_AUTHORITY',publicSourceContractValidated:false,sourceFiles,operationsFiles,at:new Date().toISOString()};
}
assert.ok(['preflight','final'].includes(phase));
if(phase==='preflight')record('before.json',fenced());
else{
 let result;try{result=fenced();const before=JSON.parse(readFileSync(path.join(evidence,'before.json'),'utf8'));assert.deepEqual(result.sourceFiles,before.sourceFiles);assert.deepEqual(result.operationsFiles,before.operationsFiles);record('final.json',{status:'DIAGNOSTIC_FENCES_PASS',...result,fixtureAcceptance:false,physicalAcceptance:false});}
 catch(error){record('final-failure.json',{status:'DIAGNOSTIC_FENCES_FAILED',name:error.name,message:error.message,sourceSha:head(root),operationsSha:head(ops),publicSourceContractValidated:false});throw error;}
}
