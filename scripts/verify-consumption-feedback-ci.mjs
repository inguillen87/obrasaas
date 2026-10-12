import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {MATERIAL_CONSUMPTION_FEEDBACK_CHECKS,MATERIAL_CONSUMPTION_FEEDBACK_PROOF_VERSION} from './verify-material-consumption-feedback-postgres.mjs';

export const CONSUMPTION_FEEDBACK_CI_VERSION='material-consumption-feedback-ci-v1';
export const CONSUMPTION_FEEDBACK_UI_WIDTHS=Object.freeze([320,390,768,1280]);
export const CONSUMPTION_FEEDBACK_UI_CASES=Object.freeze([
 'legacy-missing-date-name-receipt-never-fabricated',
 'original-proposal-receipt-separated-from-current-approved-stock',
 'reload-same-receipt-no-repeat-post',
 'unknown-read-and-token-failure-keep-exact-original-attempt',
 'denied-private-state-clears-but-unknown-reference-survives',
 'loaded-four-card-history-cleared-on-refresh-denial',
 'loaded-history-and-private-draft-cleared-on-refresh-denial',
 'late-foreign-company-consumption-response-never-renders',
]);
const pgHarness='scripts/verify-material-consumption-feedback-postgres.mjs';
const uiHarness='scripts/verify-consumption-feedback-ui.mjs';
const cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs';
const uiEntries=['src/app/(identity)/cuenta/material-inventory-panel.js','src/app/(identity)/cuenta/workspace-recovery-panel.js'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const own=(value,key)=>Object.hasOwn(value,key);
function requireProof(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'CONSUMPTION_FEEDBACK_CI_REJECTED'});}
function same(actual,expected,message){requireProof(JSON.stringify(actual)===JSON.stringify(expected),message);}
function sourcePath(value){return typeof value==='string'&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../')&&/^(?:src|scripts)\//.test(value);}
function importPaths(bytes,filename){
 if(filename.endsWith('.css')){requireProof(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'External stylesheet dependency: '+filename);return [];}
 const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx']}),imports=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);
  if(node.type==='ImportExpression'){requireProof(node.source.type==='StringLiteral','Nonliteral import: '+filename);imports.push(node.source.value);}
  if(node.type==='CallExpression'&&node.callee?.type==='Import'){requireProof(node.arguments[0]?.type==='StringLiteral','Nonliteral import: '+filename);imports.push(node.arguments[0].value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(ast.program);return imports;
}

// The reader supplies committed Git blob bytes in the CLI, or isolated bytes in
// unit tests. No producer executes and no database/browser/provider is created.
export function consumptionFeedbackSourceClosure(readSource,{ui=false}={}){
 const files=new Set(ui?[]:['package.json','package-lock.json']),external=new Set();
 for(const file of files)requireProof(readSource(file)!==null,'Missing committed dependency: '+file);
 function visit(file){
  requireProof(sourcePath(file),'Unsafe relative source dependency: '+file);if(files.has(file))return;
  const bytes=readSource(file);requireProof(bytes!==null,'Missing committed dependency: '+file);files.add(file);
  for(const specifier of importPaths(bytes,file)){
   if(!specifier.startsWith('.')){external.add(specifier);continue;}
   const absolute=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));
   const dependency=[absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.posix.join(absolute,'index.js')].find(candidate=>sourcePath(candidate)&&readSource(candidate)!==null);
   requireProof(Boolean(dependency),'Missing relative dependency '+specifier+' from '+file);visit(dependency);
  }
 }
 for(const entry of ui?uiEntries:[pgHarness])visit(entry);
 return {files:[...files].sort(),externalImports:[...external].sort()};
}
function manifest(proof,files,readSource,label){
 requireProof(Array.isArray(proof.sourceManifest)&&proof.sourceManifest.length===files.length,label+' source manifest is incomplete');
 const found=new Map();
 for(const record of proof.sourceManifest){
  requireProof(record&&typeof record==='object'&&typeof record.path==='string'&&hash(record.sha256)&&!found.has(record.path),label+' duplicate or malformed source record');
  found.set(record.path,record.sha256);
 }
 same([...found.keys()].sort(),files,label+' manifest must equal the full recursive committed dependency closure');
 for(const file of files)requireProof(found.get(file)===sha(readSource(file)),label+' stale committed source hash: '+file);
}
function provenance(proof,{expectedHead,sourceTree},sourceState,label){
 requireProof(proof&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===sourceTree&&proof.trackedClean===true&&proof.sourceState===sourceState,label+' requires exact clean CI commit/tree provenance');
 requireProof(proof.productionDataWritten===false,label+' cannot certify production data');
}
function uiChecks(proof){
 same(proof.widths,CONSUMPTION_FEEDBACK_UI_WIDTHS,'UI viewport matrix must be complete');
 requireProof(Array.isArray(proof.checks)&&proof.checks.length===12,'UI needs all 12 checks');
 const identities=proof.checks.map(check=>check?.check==='true-consumption-history-progressive-references-long-content'?check.check+':'+check.width:check?.check);
 const expected=[...CONSUMPTION_FEEDBACK_UI_WIDTHS.map(width=>'true-consumption-history-progressive-references-long-content:'+width),...CONSUMPTION_FEEDBACK_UI_CASES];
 same(identities,expected,'UI checks must match all named scenarios once in the complete viewport matrix');
 for(const check of proof.checks.slice(0,4)){
  requireProof(Number.isSafeInteger(check.documentWidth)&&check.documentWidth>0&&check.documentWidth<=check.width,'UI viewport must not overflow');
  requireProof(Array.isArray(check.targets)&&check.targets.length>0&&check.targets.every(target=>Number.isFinite(target?.height)&&target.height>=44&&Number.isFinite(target.width)&&target.width>=44),'UI requires measured accessible touch targets');
  requireProof(Array.isArray(check.cards)&&check.cards.length===4,'UI must start with four real rendered fixture states');
  same(check.cards[3].dates,['2026-10-12T13:00:00.000Z','2026-10-12T16:00:00.000Z'],'UI must preserve separate decision/reversal timestamps');
 }
 const operations=proof.checks.slice(5,9).map(check=>check.operationId);
 requireProof(operations.every(uuid)&&new Set(operations).size===operations.length,'UI recovery scenarios need independent exact original UUIDs');
 for(const check of proof.checks.slice(9,11))requireProof(check.beforeCards===4&&check.afterCards===0&&check.afterReceipts===0&&check.afterForms===0&&check.postCount===0,'UI loaded-denial scenarios must clear private state without POST');
}

export function validateConsumptionFeedbackCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}){
 requireProof(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Expected Git HEAD/tree must be exact and tracked source clean');
 requireProof(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources),'Committed Git blob map required');
 const readSource=file=>own(gitSources,file)?gitSources[file]:null;
 for(const file of [pgHarness,uiHarness,cleanupHelper])requireProof(readSource(file)!==null,'Missing committed producer: '+file);
 provenance(postgres,{expectedHead,sourceTree},'EXACT_CI_SOURCE','PostgreSQL');provenance(ui,{expectedHead,sourceTree},'clean','UI');
 requireProof(postgres.version===MATERIAL_CONSUMPTION_FEEDBACK_PROOF_VERSION&&postgres.environment==='local-disposable-postgresql'&&postgres.postgresExecuted===true,'PostgreSQL proof must use the native disposable producer');
 requireProof(postgres.realIdentityDocuments===false&&postgres.providerCalls===0&&postgres.poolClosed===true&&postgres.databaseRemoved===true,'PostgreSQL provider/identity/cleanup boundary must be closed');
 requireProof(postgres.totalCheckCount===15&&Array.isArray(postgres.checks),'PostgreSQL requires 15 native checks');
 same(postgres.checks,MATERIAL_CONSUMPTION_FEEDBACK_CHECKS,'PostgreSQL checks must equal the exported native contract');
 const pgClosure=consumptionFeedbackSourceClosure(readSource);requireProof(pgClosure.files.length===101,'PostgreSQL committed closure must contain all 101 sources, including the current usage policy');manifest(postgres,pgClosure.files,readSource,'PostgreSQL');
 requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'PostgreSQL producer hash must match committed Git bytes');
 requireProof(ui.environment==='isolated-localhost-next-exact-jsx-synthetic-api'&&ui.productionLoginVerified===false&&ui.physicalDeviceAccepted===false&&ui.providerRequests===0,'UI requires intercepted synthetic API/authentication only');
 for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'UI '+key+' must be empty');
 const cleanup=ui.cleanup;
 requireProof(cleanup&&cleanup.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.postcondition?.absent===true,'UI browser/server/owned fixture cleanup must be confirmed');
 uiChecks(ui);
 const uiClosure=consumptionFeedbackSourceClosure(readSource,{ui:true});requireProof(uiClosure.files.length===17,'UI committed closure must contain all 17 sources');manifest(ui,uiClosure.files,readSource,'UI');
 same(ui.externalImports,uiClosure.externalImports,'UI package imports must match committed JSX graph');same(ui.externalImports,['react'],'UI fixture package dependency boundary changed');
 requireProof(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI producer and owned cleanup hashes must match committed Git bytes');
 return {version:CONSUMPTION_FEEDBACK_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,postgres:{version:postgres.version,totalCheckCount:15,sourceCount:101,harnessSha256:postgres.harnessSha256},ui:{totalCheckCount:12,sourceCount:17,widths:[...CONSUMPTION_FEEDBACK_UI_WIDTHS],harnessSha256:ui.harnessSha256,cleanupHelperSha256:ui.cleanupHelperSha256},providerCalls:0,productionDataWritten:false,productionLoginVerified:false,physicalDeviceAccepted:false};
}

function main(){
 const args=process.argv.slice(2);requireProof(args.length===2&&args[0]==='--expected-head'&&revision(args[1]),'Usage: --expected-head <full Git SHA>');
 const root=process.cwd(),expectedHead=args[1],git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).trim();
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';
 requireProof(head===expectedHead&&trackedClean,'CLI requires the exact clean expected checkout');
 const committed=new Set(git('ls-tree','-r','--name-only',expectedHead).split('\n')),gitSources=Object.create(null);
 const readSource=file=>{if(!committed.has(file))return null;if(!own(gitSources,file))gitSources[file]=execFileSync('git',['show',expectedHead+':'+file],{cwd:root,maxBuffer:16*1024*1024,windowsHide:true});return gitSources[file];};
 const validatorPath='scripts/verify-consumption-feedback-ci.mjs',validatorBytes=readFileSync(fileURLToPath(import.meta.url));
 requireProof(readSource(validatorPath)!==null&&sha(validatorBytes)===sha(readSource(validatorPath)),'CI validator itself must match the committed expected source');
 consumptionFeedbackSourceClosure(readSource);consumptionFeedbackSourceClosure(readSource,{ui:true});for(const file of [uiHarness,cleanupHelper])requireProof(readSource(file)!==null,'Missing committed producer: '+file);
 const pgBytes=readFileSync(path.join(root,'.vercel/private/material-consumption-feedback-postgres.json')),uiBytes=readFileSync(path.join(root,'.vercel/private/consumption-feedback-evidence/browser.json'));
 const result=validateConsumptionFeedbackCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres:JSON.parse(pgBytes),ui:JSON.parse(uiBytes)});
 requireProof(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===sourceTree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during CI proof validation');
 const output=path.join(root,'.vercel/private/consumption-feedback-ci.json');mkdirSync(path.dirname(output),{recursive:true});
 const proof={...result,checkedAt:new Date().toISOString(),validatorSha256:sha(validatorBytes),inputProofs:[{path:'.vercel/private/material-consumption-feedback-postgres.json',sha256:sha(pgBytes)},{path:'.vercel/private/consumption-feedback-evidence/browser.json',sha256:sha(uiBytes)}]};
 writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,sourceRevision:head,output:path.relative(root,output).split(path.sep).join('/'),nativeChecks:15,uiChecks:12}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code==='CONSUMPTION_FEEDBACK_CI_REJECTED'?error.code:'CONSUMPTION_FEEDBACK_CI_UNCONFIRMED',reason:error.message}));process.exitCode=1;}}
