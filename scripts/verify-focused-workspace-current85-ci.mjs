import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {focusedWorkspaceUiCiOptions,focusedWorkspaceUiSourceFiles} from './verify-focused-workspace-ui.mjs';
import {parseFocusedWorkspaceTap,focusedWorkspaceUnitCases,focusedWorkspaceCiLocalImports} from './verify-focused-workspace-ci.mjs';
import {CURRENT85_SPEC,CURRENT85_CHECK_NAMES,CURRENT85_UNIT_FILES} from './lib/focused-workspace-current85-spec.mjs';
import {CURRENT85_CLAIMS,validateCurrent85Raw} from './lib/focused-workspace-current85-evidence.mjs';

export const CURRENT85_CI_KIND='UI_FOCUSED_WORKSPACE_85';
export const CURRENT85_CI_VERSION='focused-workspace-current85-ci-v1';
export const CURRENT85_CI_ID='focused-workspace-current85-ui';
export const CURRENT85_CI_PATH='.vercel/private/focused-workspace-ui-evidence/current85-ci.json';
const outputPrefix='.vercel/private/focused-workspace-ui-evidence/';
const runner='scripts/verify-focused-workspace-current85-ci.mjs',producer='scripts/verify-focused-workspace-ui.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const reject=(ok,reason)=>{if(!ok)throw Object.assign(new Error(reason),{code:'CURRENT85_CI_REJECTED',reason});};
const exact=(value,names,label)=>reject(plain(value)&&same(Object.keys(value).sort(),names.slice().sort()),'EXACT_'+label);
const safe=file=>typeof file==='string'&&file!==''&&!file.includes('\\')&&!file.includes('\0')&&!file.includes(':')&&!path.posix.isAbsolute(file)&&path.posix.normalize(file)===file&&!file.split('/').includes('..');
const bytes=(reader,file)=>{reject(typeof reader==='function'&&safe(file),'SAFE_READ');const b=reader(file);reject(Buffer.isBuffer(b),'BYTES_'+file);return b;};
const refs=(files,reader)=>files.map(file=>({path:file,sha256:digest(bytes(reader,file))}));
const literalImportCache=new Map();

export function assertCurrent85CiIdentity(identity,{runId,runAttempt}){
 exact(identity,['repository','workflow','runId','runAttempt','event','job'],'CI_IDENTITY');
 reject(identity.repository==='inguillen87/obrasaas'&&identity.workflow==='.github/workflows/workspace-acceptance.yml'&&identity.job==='workspace-ui'&&['push','workflow_dispatch'].includes(identity.event),'DECLARED_CI_LANE');
 reject(Number.isSafeInteger(identity.runId)&&identity.runId>0&&Number.isSafeInteger(identity.runAttempt)&&identity.runAttempt>0&&identity.runId===Number(runId)&&identity.runAttempt===Number(runAttempt),'EXTERNAL_RUN_AND_ATTEMPT');
}

export function focusedWorkspaceCurrent85CiSourceClosure(readSource){
 const files=new Set();
 function visit(file){reject(safe(file),'SOURCE_PATH');if(files.has(file))return;const b=bytes(readSource,file);files.add(file);if(file.endsWith('.json')){JSON.parse(b);return;}if(file.endsWith('.css')){reject(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(b.toString()),'UNBOUNDED_CSS');return;}
  // Reuse the unchanged legacy parser: its one reviewed SWC bootstrap transform
  // remains bounded by actual source/lock bytes; arbitrary computed imports fail.
  const cacheKey=file+':'+digest(b),contextual=file==='tests/production-company-bootstrap-receipt.test.mjs';
  let imports=contextual?null:literalImportCache.get(cacheKey);
  if(!imports){imports=focusedWorkspaceCiLocalImports(b,file,readSource);if(!contextual)literalImportCache.set(cacheKey,imports.slice());}
  for(const ref of imports){if(!ref.startsWith('.')&&!ref.startsWith('@/')){reject(!/^(https?:|data:|file:)/.test(ref),'REMOTE_IMPORT');continue;}const base=ref.startsWith('@/')?'src/'+ref.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),ref)),target=[base,base+'.js',base+'.mjs',base+'.css'].find(p=>readSource(p)!==null);reject(Boolean(target),'MISSING_IMPORT_'+ref);visit(target);}
 }
 for(const file of [...focusedWorkspaceUiSourceFiles(readSource),runner,...CURRENT85_UNIT_FILES])visit(file);
 return [...files].sort();
}

export function current85Descriptor(readSource){
 return {id:CURRENT85_CI_ID,lane:'workspace-ui',blockId:64,path:CURRENT85_CI_PATH,kind:CURRENT85_CI_KIND,producer:runner,producerSha256:digest(bytes(readSource,runner)),sourceFiles:focusedWorkspaceCurrent85CiSourceClosure(readSource),rawSourceFiles:focusedWorkspaceUiSourceFiles(readSource),checkNames:[...CURRENT85_CHECK_NAMES]};
}

export function createCurrent85GitAuthority(root,expectedHead,expectedTree){
 reject(typeof root==='string'&&path.isAbsolute(root),'EXPLICIT_REPOSITORY_ROOT');const cache=new Map();
 const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:32*1024*1024});
 reject(git('rev-parse','HEAD').toString().trim()===expectedHead&&git('status','--porcelain','--untracked-files=no').toString()==='','CLEAN_EXACT_CHECKOUT');
 reject(git('rev-parse',expectedHead+'^{tree}').toString().trim()===expectedTree,'EXPECTED_GIT_TREE');
 return {resolveGitTree:revision=>git('rev-parse',revision+'^{tree}').toString().trim(),readGitBlob:(revision,file)=>{reject(revision===expectedHead&&safe(file),'EXACT_GIT_BLOB_REFERENCE');const key=revision+':'+file;if(!cache.has(key))cache.set(key,git('show',key));return cache.get(key);},readWorkingSource:file=>{reject(safe(file),'SOURCE_PATH');try{const p=path.join(root,file);return lstatSync(p).isFile()?readFileSync(p):null;}catch{return null;}}};
}

export function validateFocusedWorkspaceCurrent85Ci(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt,expectedRoot,gitAuthority}){
 exact(proof,['version','status','sourceRevision','sourceTree','sourceState','trackedClean','ciRun','harnessSha256','sourceManifest','checks','rawBrowser','browserExitCode','unitSuites','claims','legacy59Projection'],'ENVELOPE');
 reject(proof.version===CURRENT85_CI_VERSION&&proof.status==='PASS'&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true&&proof.sourceRevision===expectedHead&&proof.sourceTree===expectedTree&&proof.browserExitCode===0,'CURRENT85_EXACT_CI_ENVELOPE');
 assertCurrent85CiIdentity(proof.ciRun,{runId,runAttempt});
 const expected=current85Descriptor(readSource);reject(spec?.id===expected.id&&spec.kind===expected.kind&&spec.lane===expected.lane&&spec.blockId===expected.blockId&&spec.path===expected.path&&spec.producer===expected.producer&&spec.producerSha256===expected.producerSha256&&same(spec.sourceFiles,expected.sourceFiles)&&same(spec.rawSourceFiles,expected.rawSourceFiles)&&same(spec.checkNames,expected.checkNames),'ACTIVE_CURRENT85_DESCRIPTOR');
 reject(proof.harnessSha256===expected.producerSha256&&same(proof.sourceManifest,refs(expected.sourceFiles,readSource))&&same(proof.checks,CURRENT85_CHECK_NAMES)&&same(proof.claims,CURRENT85_CLAIMS),'CURRENT85_COMPLETE_SOURCE_AND_CHECKS');
 exact(proof.rawBrowser,['path','bytes','sha256'],'ORIGINAL_RAW_REF');const rawBytes=bytes(readEvidence,proof.rawBrowser.path);reject(rawBytes.length===proof.rawBrowser.bytes&&digest(rawBytes)===proof.rawBrowser.sha256,'ORIGINAL_RAW_INTEGRITY');
 const authority=gitAuthority||createCurrent85GitAuthority(expectedRoot,expectedHead,expectedTree);
 for(const file of expected.sourceFiles)reject(authority.readGitBlob(expectedHead,file)?.equals(bytes(readSource,file))&&authority.readWorkingSource(file)?.equals(bytes(readSource,file)),'OUTER_EXACT_GIT_BYTES_'+file);
 const result=validateCurrent85Raw(rawBytes,{...authority,expectedHead,expectedTree,expectedSourceState:'EXACT_CI_SOURCE',ciRun:proof.ciRun,expectedRawSourceFiles:spec.rawSourceFiles,rawReference:proof.rawBrowser,readEvidence});
 reject(same(result.legacy59Projection,proof.legacy59Projection),'EXACT_HISTORICAL59_PROJECTION');
 reject(Array.isArray(proof.unitSuites)&&same(proof.unitSuites.map(row=>row.file),CURRENT85_UNIT_FILES),'ALL_SIX_PREVIOUS_AND_CURRENT_UNIT_SUITES');
 let tests=0;
 for(const [index,row]of proof.unitSuites.entries()){
  exact(row,['file','sourceSha256','exitCode','tap','stderr','result'],'UNIT_SUITE');reject(row.sourceSha256===digest(bytes(readSource,row.file))&&row.exitCode===0,'EXACT_UNIT_SOURCE_AND_EXIT');
  for(const [kind,ref]of [['tap',row.tap],['stderr',row.stderr]]){exact(ref,['path','bytes','sha256'],'UNIT_'+kind);reject(ref.path===outputPrefix+'unit85-'+index+'.'+(kind==='tap'?'tap':'stderr.log'),'OWNED_UNIT_OUTPUT');const artifact=bytes(readEvidence,ref.path);reject(artifact.length===ref.bytes&&digest(artifact)===ref.sha256,'UNIT_ARTIFACT_BYTES');}
  const actual=parseFocusedWorkspaceTap(bytes(readEvidence,row.tap.path));reject(same(actual,row.result)&&same(actual.cases,focusedWorkspaceUnitCases(readSource,row.file)),'ORIGINAL_COMPLETE_UNIT_CASES');tests+=actual.tests;
 }
 return {...result,status:'PASS',version:CURRENT85_CI_VERSION,unitSuites:CURRENT85_UNIT_FILES.length,unitTests:tests};
}

export async function main(args=process.argv.slice(2),environment=process.env){
 const [mode,...sourceArgs]=args;reject(['browser','verify'].includes(mode),'EXPLICIT_BROWSER_OR_VERIFY_MODE');
 const root=process.cwd(),options=focusedWorkspaceUiCiOptions(['--ci',...sourceArgs],{repoRoot:root,environment});
 const git=(...a)=>execFileSync('git',a,{cwd:root,windowsHide:true,maxBuffer:32*1024*1024}),head=git('rev-parse','HEAD').toString().trim(),tree=git('rev-parse','HEAD^{tree}').toString().trim();reject(head===options.expectedHead,'EXACT_EXPECTED_HEAD');
 const authority=createCurrent85GitAuthority(root,head,tree),readSource=file=>{try{return authority.readGitBlob(head,file);}catch{return null;}},readEvidence=file=>{if(!safe(file))return null;try{const p=path.join(root,file);return lstatSync(p).isFile()?readFileSync(p):null;}catch{return null;}};
 const contract=JSON.parse(bytes(readSource,'.github/workspace-acceptance-contract.json')),matches=contract.extension.proofs.filter(row=>row.kind===CURRENT85_CI_KIND);reject(matches.length===1,'ONE_ACTIVE_CURRENT85_DESCRIPTOR');const spec=matches[0];reject(!contract.extension.proofs.some(row=>row.kind==='UI_FOCUSED_WORKSPACE'),'NO_PARALLEL_LEGACY_PRODUCER_IN_ACTIVE_CONTRACT');
 const descriptor=current85Descriptor(readSource);reject(same(spec.sourceFiles,descriptor.sourceFiles)&&spec.producerSha256===descriptor.producerSha256,'COMPOSED_CURRENT85_SOURCE_DESCRIPTOR');
 const before=refs(spec.sourceFiles,readSource);
 if(mode==='browser'){
  reject(!existsSync(path.join(root,CURRENT85_CI_PATH)),'NEW_CURRENT85_PROOF_REQUIRED');mkdirSync(path.join(root,outputPrefix),{recursive:true});
  const childEnvironment=Object.fromEntries(Object.entries(environment).filter(([key])=>/^(SystemRoot|WINDIR|SystemDrive|ComSpec|Path|PATHEXT|TEMP|TMP|CI|GITHUB_ACTIONS|GITHUB_REPOSITORY|GITHUB_SHA|GITHUB_WORKFLOW|GITHUB_JOB|GITHUB_EVENT_NAME|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT|GITHUB_REF|GITHUB_WORKFLOW_REF)$/i.test(key)));childEnvironment.NEXT_TELEMETRY_DISABLED='1';
  const unitSuites=[];
  for(const [index,file]of CURRENT85_UNIT_FILES.entries()){
   const run=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{cwd:root,env:childEnvironment,windowsHide:true,encoding:'utf8',maxBuffer:16*1024*1024});
   const artifacts={};for(const [kind,text,suffix]of [['tap',run.stdout||'','tap'],['stderr',run.stderr||'','stderr.log']]){const p=outputPrefix+'unit85-'+index+'.'+suffix,b=Buffer.from(text);writeFileSync(path.join(root,p),b,{flag:'wx'});artifacts[kind]={path:p,bytes:b.length,sha256:digest(b)};}
   reject(run.status===0,'UNIT_FAILED_'+file);unitSuites.push({file,sourceSha256:digest(bytes(readSource,file)),exitCode:run.status,...artifacts,result:parseFocusedWorkspaceTap(Buffer.from(run.stdout||''))});
  }
  const run=spawnSync(process.execPath,[producer,'--ci',...sourceArgs],{cwd:root,env:childEnvironment,windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});for(const [name,text]of [['stdout',run.stdout||''],['stderr',run.stderr||'']])writeFileSync(path.join(root,outputPrefix+'browser85.'+name+'.log'),text,{flag:'wx'});reject(run.status===0,'ORIGINAL85_PRODUCER_FAILED');
  const emitted=JSON.parse(run.stdout.trim().split(/\r?\n/).at(-1)),relative=path.relative(root,emitted.target).split(path.sep).join('/'),rawBytes=bytes(readEvidence,relative),rawBrowser={path:relative,bytes:rawBytes.length,sha256:digest(rawBytes)};
  const result=validateCurrent85Raw(rawBytes,{...authority,expectedHead:head,expectedTree:tree,expectedSourceState:'EXACT_CI_SOURCE',ciRun:options.ciRun,expectedRawSourceFiles:descriptor.rawSourceFiles,rawReference:rawBrowser,readEvidence});
  const proof={version:CURRENT85_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:options.ciRun,harnessSha256:descriptor.producerSha256,sourceManifest:before,checks:[...CURRENT85_CHECK_NAMES],rawBrowser,browserExitCode:run.status,unitSuites,claims:CURRENT85_CLAIMS,legacy59Projection:result.legacy59Projection};
  validateFocusedWorkspaceCurrent85Ci(proof,{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:options.ciRun.runId,runAttempt:options.ciRun.runAttempt,expectedRoot:root,gitAuthority:authority});writeFileSync(path.join(root,CURRENT85_CI_PATH),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 }
 const result=validateFocusedWorkspaceCurrent85Ci(JSON.parse(bytes(readEvidence,CURRENT85_CI_PATH)),{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:options.ciRun.runId,runAttempt:options.ciRun.runAttempt,expectedRoot:root,gitAuthority:authority});reject(git('rev-parse','HEAD').toString().trim()===head&&git('status','--porcelain','--untracked-files=no').toString()===''&&same(before,refs(spec.sourceFiles,readSource)),'SOURCE_UNCHANGED_AFTER_RUN');console.log(JSON.stringify({...result,ciRun:options.ciRun}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
