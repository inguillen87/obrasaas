import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseTap} from './verify-participant-bank-intake-contracts.mjs';

export const TEST_FILE='tests/production-portfolio-overview.test.mjs';
export const EXPECTED_TESTS=17;
const output='.vercel/portfolio-overview-contract-evidence';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function sourceFiles(root){
 const found=new Set();
 function visit(file){
  if(found.has(file))return;
  assert.ok(!path.isAbsolute(file)&&!file.split('/').some(part=>!part||part==='.'||part==='..'));
  const absolute=path.join(root,file);assert.ok(realpathSync(absolute).startsWith(realpathSync(root)+path.sep));found.add(file);
  if(!/\.(?:js|mjs)$/.test(file))return;
  for(const match of readFileSync(absolute,'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
   const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
   const dependency=[relative,relative+'.js',relative+'.mjs'].find(value=>existsSync(path.join(root,value)));
   assert.ok(dependency,'Resolvable portfolio test dependency '+file);visit(dependency);
  }
 }
 for(const file of [TEST_FILE,'scripts/verify-participant-bank-intake-contracts.mjs'])visit(file);
 return [...found].sort();
}
function identity(root,expected){
 assert.match(expected,/^[a-f0-9]{40}$/);
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),expected,'Exact source HEAD');
 assert.equal(execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim(),'','No tracked modifications');
 return expected;
}
function main(){
 assert.deepEqual(process.argv.slice(2,3),['--expected-head']);assert.equal(process.argv.length,4);
 assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET);
 const root=realpathSync(process.cwd()),sourceRevision=identity(root,process.argv[3]);
 const sourceManifest=sourceFiles(root).map(file=>({path:file,sha256:hash(readFileSync(path.join(root,file)))}));
 const harnessSha256=hash(readFileSync(fileURLToPath(import.meta.url)));
 mkdirSync(output,{recursive:true});assert.equal(existsSync(path.join(output,'proof.json')),false,'Fresh main proof required');
 let tap;
 try{tap=execFileSync(process.execPath,['--test','--test-reporter=tap',TEST_FILE],{cwd:root,timeout:120000,maxBuffer:8*1024*1024});}
 catch(error){if(Buffer.isBuffer(error.stdout))writeFileSync(path.join(output,'failed.tap'),error.stdout,{flag:'wx'});throw error;}
 const parsed=parseTap(tap,{expectedTests:EXPECTED_TESTS}),tapPath=output+'/suite.tap';writeFileSync(tapPath,tap,{flag:'wx'});
 identity(root,sourceRevision);for(const item of sourceManifest)assert.equal(hash(readFileSync(path.join(root,item.path))),item.sha256,'Source stable during unit proof');
 assert.equal(hash(readFileSync(fileURLToPath(import.meta.url))),harnessSha256);
 const suite={file:TEST_FILE,exitCode:0,...parsed,tap:{path:tapPath,bytes:tap.length,sha256:hash(tap)}};
 const proof={version:1,status:'PASS',sourceRevision,sourceState:'committed exact Git HEAD',trackedClean:true,sourceManifest,harnessSha256,suite,postgresExecuted:false,providerCalls:0,productionDataWritten:false};
 writeFileSync(path.join(output,'proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS',sourceRevision,tests:EXPECTED_TESTS}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
