import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {focusedWorkspaceUiCiOptions,focusedWorkspaceUiSourceClosure,focusedWorkspaceUiSourceFiles,FOCUSED_WORKSPACE_WIDTHS} from './verify-focused-workspace-ui.mjs';

export const FOCUSED_WORKSPACE_CI_VERSION='focused-workspace-ci-v1';
export const FOCUSED_WORKSPACE_CI_KIND='UI_FOCUSED_WORKSPACE';
export const FOCUSED_WORKSPACE_CI_PROOF_ID='focused-workspace-ui';
export const FOCUSED_WORKSPACE_CI_EVIDENCE='.vercel/private/focused-workspace-ui-evidence/';
const producer='scripts/verify-focused-workspace-ui.mjs',runner='scripts/verify-focused-workspace-ci.mjs';
const contractPath='.github/workspace-acceptance-contract.json';
const unitFiles=['tests/production-focused-workspace-navigation.test.mjs','tests/production-focused-workspace-ui.test.mjs','tests/production-focused-workspace-ci.test.mjs'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const reject=(ok,message)=>{if(!ok)throw Object.assign(new Error(message),{code:'FOCUSED_WORKSPACE_CI_REJECTED'});};
const keys=(value,expected,label)=>reject(plain(value)&&same(Object.keys(value).sort(),[...expected].sort()),'Exact '+label+' keys required');
const safe=value=>typeof value==='string'&&value!==''&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../');
const bytes=(reader,file)=>{reject(safe(file),'Unsafe source or evidence path');const value=reader(file);reject(Buffer.isBuffer(value),'Missing actual bytes: '+file);return value;};
const refs=(files,reader)=>files.map(file=>({path:file,sha256:sha(bytes(reader,file))}));

export const FOCUSED_WORKSPACE_CHECK_NAMES=Object.freeze(FOCUSED_WORKSPACE_WIDTHS.flatMap(width=>[
 'hidden-panel-headings-absent-from-accessibility-tree-'+width,
 'one-mounted-visible-overview-and-hidden-panels-'+width,
 'identity-deep-link-history-no-mutation-'+width,
 'legacy-plan-import-fragment-opens-schedule-'+width,
 'nonadmin-cannot-see-billing-or-integration-navigation-'+width,
 'schedule-draft-survives-section-navigation-without-POST-'+width,
 'no-project-hint-keeps-an-explicit-usable-project-picker-'+width,
 'company-plan-and-recovery-without-selected-project-company-without-selection-'+width,
 'company-plan-and-recovery-without-selected-project-empty-company-'+width,
 'three-step-synthetic-identity-explicit-consents-and-unknown-receipt-survive-navigation-'+width
]));
export function normalizeFocusedWorkspaceChecks(checks){
 reject(Array.isArray(checks)&&checks.length===FOCUSED_WORKSPACE_CHECK_NAMES.length,'All original browser observations are required');
 return checks.map((check,index)=>{
  const expected=FOCUSED_WORKSPACE_CHECK_NAMES[index];
  if(expected.startsWith('hidden-panel-headings-')){
   reject(typeof check==='string'&&check.startsWith(expected+':'),'Original accessibility observation required');
   const count=check.slice(expected.length+1);reject(/^[1-9][0-9]*$/.test(count)&&Number.isSafeInteger(Number(count))&&Number(count)>=5,'Hidden headings must be absent from the actual accessibility tree');
  }else reject(check===expected,'Original browser check order or identity changed');
  return expected;
 });
}

function localImports(value,file){
 if(file.endsWith('.css')||file.endsWith('.json'))return[];
 const found=[],ast=parse(value.toString('utf8'),{sourceType:'module',plugins:['jsx'],createImportExpressions:true});
 function walk(node){if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type)&&node.source){reject(node.source.type==='StringLiteral','Computed CI import is not bounded');found.push(node.source.value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 }walk(ast.program);return found;
}
export function focusedWorkspaceCiSourceClosure(readSource){
 const ui=focusedWorkspaceUiSourceClosure(readSource),files=new Set(ui.files);
 function visit(file){reject(safe(file),'Unsafe CI dependency');if(files.has(file))return;const value=bytes(readSource,file);files.add(file);
  for(const ref of localImports(value,file)){
   if(!ref.startsWith('.')&&!ref.startsWith('@/')){reject(!/^(https?:|data:|file:)/.test(ref),'Remote CI executable import');continue;}
   const base=ref.startsWith('@/')?'src/'+ref.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));
   const resolved=[base,base+'.js',base+'.mjs',base+'.css'].find(candidate=>readSource(candidate)!==null);reject(Boolean(resolved),'Missing actual CI import: '+ref);visit(resolved);
  }
 }
 for(const file of [producer,runner,...unitFiles,'scripts/lib/integrated-identity-current-ci-lineage.mjs','tests/production-integrated-identity-current-ci-lineage.test.mjs','src/app/(identity)/cuenta/page.js','src/app/(identity)/cuenta/workspace-identity.js','src/app/(identity)/cuenta/onboarding-guide.js','src/lib/identity-return-path.mjs','src/lib/participant-analysis-consent.mjs','src/lib/participant-kyc-image-set.mjs','src/lib/participant-policy.mjs','src/lib/workspace-policy.mjs','package.json','package-lock.json'])visit(file);
 return [...files].sort();
}
export function parseFocusedWorkspaceTap(input){
 const text=Buffer.isBuffer(input)?input.toString('utf8'):String(input),value={};
 for(const field of ['tests','pass','fail','cancelled','skipped','todo']){const found=[...text.matchAll(new RegExp('^# '+field+' (\\d+)\\r?$','gm'))];reject(found.length===1,'Complete unambiguous TAP summary required');value[field]=Number(found[0][1]);}
 reject(value.tests>0&&value.pass===value.tests&&['fail','cancelled','skipped','todo'].every(key=>value[key]===0)&&!/^not ok /m.test(text),'Every declared unit must pass without a skip');
 const cases=text.split(/\r?\n/).filter(line=>/^ok [0-9]+ - /.test(line)).map(line=>line.replace(/^ok [0-9]+ - /,''));reject(cases.length===value.tests&&new Set(cases).size===cases.length,'Complete distinct TAP cases required');
 return{...value,cases};
}
export function focusedWorkspaceUnitCases(readSource,file){
 const ast=parse(bytes(readSource,file).toString('utf8'),{sourceType:'module'}),cases=[];
 function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee?.type==='Identifier'&&node.callee.name==='test'){reject(node.arguments[0]?.type==='StringLiteral','Every focused unit needs a declared literal case name');cases.push(node.arguments[0].value);}for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
 walk(ast.program);reject(cases.length>0&&new Set(cases).size===cases.length,'Distinct actual unit cases required');return cases;
}

export function validateFocusedWorkspaceCi(proof,{expectedHead,expectedTree,readSource,readEvidence,spec,runId,runAttempt}){
 reject(/^[a-f0-9]{40}$/.test(expectedHead)&&/^[a-f0-9]{40}$/.test(expectedTree)&&typeof readSource==='function'&&typeof readEvidence==='function','Immutable source identity and original evidence readers required');
 keys(proof,['version','status','sourceRevision','sourceTree','sourceState','trackedClean','ciRun','harnessSha256','sourceManifest','checks','rawBrowser','unitSuites','providerCalls','realClerkOrSsrVerified','productionDataTouched','humanAccepted'],'CI envelope');
 reject(proof.version===FOCUSED_WORKSPACE_CI_VERSION&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===expectedTree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,'Current exact CI source required');
 keys(proof.ciRun,['repository','workflow','runId','runAttempt','event','job'],'CI identity');
 reject(proof.ciRun.repository==='inguillen87/obrasaas'&&proof.ciRun.workflow==='.github/workflows/workspace-acceptance.yml'&&proof.ciRun.job==='workspace-ui'&&['push','workflow_dispatch'].includes(proof.ciRun.event)&&proof.ciRun.runId===Number(runId)&&proof.ciRun.runAttempt===Number(runAttempt)&&Number.isSafeInteger(proof.ciRun.runId)&&proof.ciRun.runId>0&&Number.isSafeInteger(proof.ciRun.runAttempt)&&proof.ciRun.runAttempt>0,'Original current workflow run and attempt required');
 reject(spec?.id===FOCUSED_WORKSPACE_CI_PROOF_ID&&spec.kind===FOCUSED_WORKSPACE_CI_KIND&&spec.producer===runner&&spec.path===FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json'&&spec.lane==='workspace-ui'&&spec.blockId===64,'Original focused proof binding required');
 reject(proof.harnessSha256===spec.producerSha256&&proof.harnessSha256===sha(bytes(readSource,runner))&&same(spec.checkNames,FOCUSED_WORKSPACE_CHECK_NAMES)&&same(proof.checks,spec.checkNames),'Current runner and browser check matrix required');
 reject(same(spec.sourceFiles,focusedWorkspaceCiSourceClosure(readSource))&&same(proof.sourceManifest,refs(spec.sourceFiles,readSource)),'Complete current AST closure and every RAW source required');
 keys(proof.rawBrowser,['path','bytes','sha256'],'original browser proof');reject(proof.rawBrowser.path.startsWith(FOCUSED_WORKSPACE_CI_EVIDENCE+'run-')&&proof.rawBrowser.path.endsWith('/browser.json'),'Owned original browser evidence required');
 const rawBytes=bytes(readEvidence,proof.rawBrowser.path);reject(rawBytes.length===proof.rawBrowser.bytes&&sha(rawBytes)===proof.rawBrowser.sha256,'Original browser bytes changed');let raw;try{raw=JSON.parse(rawBytes);}catch{reject(false,'Original browser JSON must parse');}
 keys(raw,['version','status','sourceState','ciRun','sourceRevision','sourceTree','trackedClean','checkedAt','widths','checks','totalCheckCount','sourceManifest','sourceBytesUnchanged','externalImports','requests','errors','screenshots','providerCalls','businessPosts','navigationPosts','productionDataTouched','actualAccountWorkspaceMounted','actualClerkOrSSRVerified','syntheticPixelsOnly','transport','cleanup'],'original browser');
 reject(raw.version===1&&raw.status==='PASS'&&raw.sourceState==='EXACT_CI_SOURCE'&&raw.sourceRevision===expectedHead&&raw.sourceTree===expectedTree&&raw.trackedClean===true&&same(raw.ciRun,proof.ciRun),'Browser must execute on this actual CI source and identity');
 reject(typeof raw.checkedAt==='string'&&Number.isFinite(Date.parse(raw.checkedAt))&&new Date(raw.checkedAt).toISOString()===raw.checkedAt,'Original browser completion timestamp required');
 reject(same(raw.widths,FOCUSED_WORKSPACE_WIDTHS)&&raw.totalCheckCount===20&&same(normalizeFocusedWorkspaceChecks(raw.checks),proof.checks),'Both original browser widths and all observations required');
 reject(same(raw.sourceManifest,refs(focusedWorkspaceUiSourceFiles(readSource),readSource)),'Original independent complete browser source manifest required');
 for(const row of raw.sourceManifest){keys(row,['path','sha256'],'browser source');reject(spec.sourceFiles.includes(row.path)&&sha(bytes(readSource,row.path))===row.sha256,'Browser RAW source differs: '+row.path);}
 reject(raw.sourceBytesUnchanged===true&&raw.providerCalls===0&&raw.productionDataTouched===false&&raw.actualAccountWorkspaceMounted===true&&raw.actualClerkOrSSRVerified===false&&raw.syntheticPixelsOnly===true&&raw.navigationPosts===0&&raw.businessPosts===2&&same(raw.errors,[]),'Actual synthetic browser isolation required');
 reject(raw.cleanup?.browserClosed===true&&raw.cleanup.serverClosed===true&&raw.cleanup.gracefulCloseAcknowledged===true&&raw.cleanup.fixtureRemoved===true&&raw.cleanup.fixtureCleanupProof?.fixtureRemoved===true,'Positive owned fixture cleanup required');
 reject(Array.isArray(raw.requests)&&raw.requests.length>0&&raw.requests.filter(row=>row.method==='POST').length===2&&raw.requests.every(row=>row.method==='GET'||row.mode==='wizard'&&row.method==='POST'),'Only the two controlled final wizard requests are allowed');
 reject(Array.isArray(raw.screenshots)&&raw.screenshots.length>=26,'Original browser screenshots required');
 const directory=path.posix.dirname(proof.rawBrowser.path);for(const row of raw.screenshots){reject(safe(row.path)&&path.posix.basename(row.path)===row.path,'Owned screenshot filename required');reject(sha(bytes(readEvidence,directory+'/'+row.path))===row.sha256,'Original screenshot changed');}
 reject(Array.isArray(proof.unitSuites)&&same(proof.unitSuites.map(row=>row.file),unitFiles),'Every focused unit suite required');
 let unitTests=0;for(const row of proof.unitSuites){keys(row,['file','sourceSha256','exitCode','tap','result'],'unit suite');keys(row.tap,['path','bytes','sha256'],'unit TAP');reject(row.sourceSha256===sha(bytes(readSource,row.file))&&row.exitCode===0&&row.tap.path.startsWith(FOCUSED_WORKSPACE_CI_EVIDENCE+'unit-'),'Exact executed unit source required');const tap=bytes(readEvidence,row.tap.path);reject(tap.length===row.tap.bytes&&sha(tap)===row.tap.sha256,'Unit TAP changed');const parsed=parseFocusedWorkspaceTap(tap);reject(same(parsed,row.result)&&same(parsed.cases,focusedWorkspaceUnitCases(readSource,row.file)),'Original complete unit summary and every declared case required');unitTests+=parsed.tests;}
 reject(proof.providerCalls===0&&proof.realClerkOrSsrVerified===false&&proof.productionDataTouched===false&&proof.humanAccepted===false,'No real session or customer acceptance can be asserted');
 return{version:1,status:'PASS',checks:20,widths:FOCUSED_WORKSPACE_WIDTHS,sourceReferences:proof.sourceManifest.length,unitTests,rawBrowserSha256:proof.rawBrowser.sha256,originalBrowserRewritten:false,realSessionOrIdentityAccepted:false};
}

async function main(){
 const [mode,...args]=process.argv.slice(2);reject(['browser','verify'].includes(mode)&&args.length===2&&args[0]==='--expected-head','Explicit browser or verification mode required');
 const root=process.cwd(),options=focusedWorkspaceUiCiOptions(['--ci',...args],{repoRoot:root,environment:process.env});
 const git=argv=>execFileSync('git',argv,{cwd:root,maxBuffer:32*1024*1024,windowsHide:true}),head=git(['rev-parse','HEAD']).toString().trim(),tree=git(['rev-parse','HEAD^{tree}']).toString().trim();
 reject(head===options.expectedHead&&git(['status','--porcelain','--untracked-files=no']).toString()==='','Clean current CI checkout required');
 const readSource=file=>{try{return git(['show',head+':'+file]);}catch{return null;}},readEvidence=file=>{if(!safe(file))return null;const absolute=path.join(root,file);return existsSync(absolute)&&lstatSync(absolute).isFile()?readFileSync(absolute):null;};
 const contract=JSON.parse(bytes(readSource,contractPath)),{verifyIntegratedIdentityCurrentSources}=await import('./lib/integrated-identity-current-ci-lineage.mjs');verifyIntegratedIdentityCurrentSources(contract,readSource);
 const spec=contract.extension.proofs.find(row=>row.id===FOCUSED_WORKSPACE_CI_PROOF_ID),output=FOCUSED_WORKSPACE_CI_EVIDENCE+'current-ci.json';
 reject(same(spec?.sourceFiles,focusedWorkspaceCiSourceClosure(readSource)),'Reviewed current source closure required');
 const before=refs(spec.sourceFiles,readSource);
 if(mode==='browser'){
  reject(!existsSync(path.join(root,output)),'A new CI browser proof is required');mkdirSync(path.join(root,FOCUSED_WORKSPACE_CI_EVIDENCE),{recursive:true});
  const environment=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(SystemRoot|WINDIR|SystemDrive|ComSpec|Path|PATHEXT|TEMP|TMP|CI|GITHUB_ACTIONS|GITHUB_REPOSITORY|GITHUB_SHA|GITHUB_WORKFLOW|GITHUB_JOB|GITHUB_EVENT_NAME|GITHUB_RUN_ID|GITHUB_RUN_ATTEMPT|GITHUB_REF|GITHUB_WORKFLOW_REF)$/i.test(key)));environment.NEXT_TELEMETRY_DISABLED='1';
  const unitSuites=[];
  for(const [index,file]of unitFiles.entries()){const result=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{cwd:root,env:environment,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});const tap=Buffer.from(result.stdout||''),tapPath=FOCUSED_WORKSPACE_CI_EVIDENCE+'unit-'+index+'.tap';writeFileSync(path.join(root,tapPath),tap,{flag:'wx'});writeFileSync(path.join(root,tapPath+'.stderr.log'),result.stderr||'',{flag:'wx'});reject(result.status===0,'Current unit suite failed: '+file);unitSuites.push({file,sourceSha256:sha(bytes(readSource,file)),exitCode:result.status,tap:{path:tapPath,bytes:tap.length,sha256:sha(tap)},result:parseFocusedWorkspaceTap(tap)});}
  const run=spawnSync(process.execPath,[producer,'--ci',...args],{cwd:root,env:environment,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});writeFileSync(path.join(root,FOCUSED_WORKSPACE_CI_EVIDENCE+'browser.stdout.log'),run.stdout||'',{flag:'wx'});writeFileSync(path.join(root,FOCUSED_WORKSPACE_CI_EVIDENCE+'browser.stderr.log'),run.stderr||'',{flag:'wx'});reject(run.status===0,'Original browser producer failed');
  const lines=run.stdout.trim().split(/\r?\n/),emitted=JSON.parse(lines.at(-1)),relative=path.relative(root,emitted.target).split(path.sep).join('/');reject(safe(relative),'Owned browser output required');const raw=bytes(readEvidence,relative),rawProof=JSON.parse(raw);
  const proof={version:FOCUSED_WORKSPACE_CI_VERSION,status:'PASS',sourceRevision:head,sourceTree:tree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,ciRun:options.ciRun,harnessSha256:sha(bytes(readSource,runner)),sourceManifest:before,checks:normalizeFocusedWorkspaceChecks(rawProof.checks),rawBrowser:{path:relative,bytes:raw.length,sha256:sha(raw)},unitSuites,providerCalls:0,realClerkOrSsrVerified:false,productionDataTouched:false,humanAccepted:false};
  validateFocusedWorkspaceCi(proof,{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:options.ciRun.runId,runAttempt:options.ciRun.runAttempt});writeFileSync(path.join(root,output),JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
 }
 const result=validateFocusedWorkspaceCi(JSON.parse(bytes(readEvidence,output)),{expectedHead:head,expectedTree:tree,readSource,readEvidence,spec,runId:options.ciRun.runId,runAttempt:options.ciRun.runAttempt});
 reject(git(['rev-parse','HEAD']).toString().trim()===head&&git(['rev-parse','HEAD^{tree}']).toString().trim()===tree&&git(['status','--porcelain','--untracked-files=no']).toString()===''&&same(before,refs(spec.sourceFiles,readSource)),'Source must remain unchanged');
 assert.equal(result.status,'PASS');console.log(JSON.stringify({...result,sourceRevision:head,sourceTree:tree,ciRun:options.ciRun}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
