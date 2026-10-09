import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const TEST_SUITES=[
 'tests/production-participant-private-bank.test.mjs',
 'tests/production-private-bank-recovery.test.mjs',
 'tests/production-employee-intake.test.mjs',
 'tests/production-employee-intake-recovery.test.mjs',
 'tests/production-participant-bank-intake-recovery.test.mjs',
 'tests/production-company-channel-kyc.test.mjs',
 'tests/production-participant-onboarding-next-step.test.mjs'
];
export const EXPECTED_SUITE_COUNTS=Object.freeze({
 'tests/production-participant-private-bank.test.mjs':20,
 'tests/production-private-bank-recovery.test.mjs':11,
 'tests/production-employee-intake.test.mjs':91,
 'tests/production-employee-intake-recovery.test.mjs':4,
 'tests/production-participant-bank-intake-recovery.test.mjs':7,
 'tests/production-company-channel-kyc.test.mjs':80,
 'tests/production-participant-onboarding-next-step.test.mjs':37
});
export const EXPECTED_TOTAL_TESTS=250;
export const RECOVERY_CASES=[
 ...['bank','intake'].flatMap(kind=>['lost-response','http403'].map(failure=>kind+' '+failure+' persists its typed reference across reload and rejects the sibling receipt before exact GET recovery')),
 ...['bank','intake'].map(kind=>kind+' nonterminal and cross-context responses retain unknown and never use the generic participant fallback'),
 'independent bank and intake projects keep both typed references; settling one never clears the other'
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function parseTap(bytes,{recovery=false,expectedTests=null}={}){
 assert.ok(Buffer.isBuffer(bytes));const text=bytes.toString('utf8');assert.ok(bytes.equals(Buffer.from(text)),'TAP must be UTF-8');
 assert.ok(text.startsWith('TAP version 13\n'));assert.doesNotMatch(text,/^not ok /m);const plans=[...text.matchAll(/^1\.\.([0-9]+)$/gm)];assert.equal(plans.length,1);
 const counts={};for(const key of ['tests','pass','fail','cancelled','skipped','todo']){const rows=[...text.matchAll(new RegExp('^# '+key+' ([0-9]+)$','gm'))];assert.equal(rows.length,1,'One TAP summary: '+key);counts[key]=Number(rows[0][1]);assert.ok(Number.isSafeInteger(counts[key]));}assert.equal(Number(plans[0][1]),counts.tests);
 assert.ok(counts.tests>0);assert.equal(counts.pass,counts.tests);for(const key of ['fail','cancelled','skipped','todo'])assert.equal(counts[key],0,key);
 const cases=[...text.matchAll(/^ok ([0-9]+) - (.+)$/gm)].map(match=>({index:Number(match[1]),name:match[2]}));assert.equal(cases.length,counts.tests,'Complete top-level TAP cases');assert.deepEqual(cases.map(c=>c.index),Array.from({length:counts.tests},(_,i)=>i+1));assert.ok(cases.every(c=>!/#\s*(?:SKIP|TODO)\b/i.test(c.name)));assert.equal(new Set(cases.map(c=>c.name)).size,cases.length,'No duplicate cases');
 if(expectedTests!==null){assert.ok(Number.isSafeInteger(expectedTests)&&expectedTests>0);assert.equal(counts.tests,expectedTests,'Exact canonical suite count');}
 if(recovery){assert.equal(counts.tests,7);assert.deepEqual(cases.map(c=>c.name).sort(),[...RECOVERY_CASES].sort());}
 return {...counts,caseNames:cases.map(c=>c.name)};
}
export function sourceFiles(root){
 const found=new Set();function visit(file){if(found.has(file))return;assert.ok(!file.startsWith('../')&&!path.isAbsolute(file));const absolute=path.join(root,file);assert.ok(realpathSync(absolute).startsWith(realpathSync(root)+path.sep));found.add(file);if(!/\.(?:js|mjs)$/.test(file))return;for(const match of readFileSync(absolute,'utf8').matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));const dependency=[relative,relative+'.js',relative+'.mjs'].find(value=>existsSync(path.join(root,value)));assert.ok(dependency,'Resolvable test dependency '+file);visit(dependency);}}
 for(const file of TEST_SUITES)visit(file);return [...found].sort();
}
function identity(root,expected){assert.match(expected,/^[a-f0-9]{40}$/);const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();assert.equal(head,expected,'Exact source HEAD');assert.equal(execFileSync('git',['diff','--name-only','HEAD','--'],{cwd:root,encoding:'utf8'}).trim(),'','No tracked modifications');return head;}
function main(){
 assert.deepEqual(process.argv.slice(2,3),['--expected-head']);assert.equal(process.argv.length,4);assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET);
 const root=realpathSync(process.cwd()),sourceRevision=identity(root,process.argv[3]),out='.vercel/participant-bank-intake-contract-evidence',files=sourceFiles(root),sourceManifest=files.map(file=>({path:file,sha256:hash(readFileSync(path.join(root,file)))})),harnessSha256=hash(readFileSync(fileURLToPath(import.meta.url)));mkdirSync(out,{recursive:true});assert.equal(existsSync(path.join(out,'proof.json')),false,'Fresh main proof required');const suites=[];
 try{for(const [index,file] of TEST_SUITES.entries()){
  let bytes;try{bytes=execFileSync(process.execPath,['--test','--test-reporter=tap',file],{cwd:root,timeout:120000,maxBuffer:8*1024*1024});}catch(error){if(Buffer.isBuffer(error.stdout))writeFileSync(path.join(out,'failed-'+index+'.tap'),error.stdout,{flag:'wx'});throw error;}
  const parsed=parseTap(bytes,{recovery:file===TEST_SUITES[4],expectedTests:EXPECTED_SUITE_COUNTS[file]??null}),tapPath=out+'/suite-'+index+'.tap';writeFileSync(tapPath,bytes,{flag:'wx'});suites.push({file,exitCode:0,...parsed,tap:{path:tapPath,bytes:bytes.length,sha256:hash(bytes)}});
 }
 assert.equal(suites.reduce((total,suite)=>total+suite.tests,0),EXPECTED_TOTAL_TESTS,'Exact seven-suite total');
 identity(root,sourceRevision);for(const item of sourceManifest)assert.equal(hash(readFileSync(path.join(root,item.path))),item.sha256,'Source stable during unit proof');assert.equal(hash(readFileSync(fileURLToPath(import.meta.url))),harnessSha256);
 const proof={version:1,status:'PASS',sourceRevision,sourceState:'committed exact Git HEAD',trackedClean:true,sourceManifest,harnessSha256,suites,postgresExecuted:false,productionDataWritten:false,coverageBoundary:'canonical unit assertions with synthetic fixtures; no database, UI or provider acceptance'};writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS',sourceRevision,suites:suites.length,recoveryChecks:7,tests:suites.reduce((n,s)=>n+s.tests,0)}));
 }catch(error){writeFileSync(path.join(out,'failure.json'),JSON.stringify({status:'FAIL',sourceRevision,message:error.message,suites},null,2)+'\n',{flag:'wx'});throw error;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
