import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validatePlanPartidaPreviewImportUiProofBytes} from './lib/home-decisions-current-ci-lineage.mjs';
import {PLAN_BUDGET_UI_PROOF_PATH,PLAN_BUDGET_UI_HISTORICAL_PATH,validatePlanBudgetUiProofBytes} from './lib/plan-budget-ui-contract.mjs';

// This CLI reads an actual clean checkout and already-produced synthetic files.
// It launches no browser, makes no provider call, and never rewrites a proof.
export function verifyPlanBudgetUi({root,expectedHead}){
 const resolved=realpathSync(root),git=(...args)=>execFileSync('git',args,{cwd:resolved,encoding:'utf8',windowsHide:true}).trim();
 assert.match(expectedHead,/^[a-f0-9]{40}$/);assert.equal(git('rev-parse','HEAD'),expectedHead);assert.equal(git('status','--porcelain','--untracked-files=no'),'');const expectedTree=git('rev-parse','HEAD^{tree}');const assertIdentity=()=>{assert.equal(git('rev-parse','HEAD'),expectedHead);assert.equal(git('rev-parse','HEAD^{tree}'),expectedTree);assert.equal(git('status','--porcelain','--untracked-files=no'),'');};
 const sourceCache=new Map(),gitFiles=new Set(git('ls-tree','-r','--name-only',expectedHead).split('\n'));const readSource=file=>{assert.ok(gitFiles.has(file));if(!sourceCache.has(file))sourceCache.set(file,execFileSync('git',['show',expectedHead+':'+file],{cwd:resolved,maxBuffer:16*1024*1024,windowsHide:true}));return sourceCache.get(file);};
 const readEvidence=file=>{assert.equal(path.posix.normalize(file),file);assert.equal(file.includes('..'),false);assert.equal(/[\\:\x00-\x1f]/.test(file),false);assert.ok(file.startsWith('.vercel/private/'));let parent=resolved;for(const part of file.split('/').slice(0,-1)){parent=path.join(parent,part);const parentStat=lstatSync(parent);assert.ok(parentStat.isDirectory()&&!parentStat.isSymbolicLink());assert.equal(realpathSync(parent),parent);}const target=path.join(resolved,file),stat=lstatSync(target);assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&realpathSync(target).startsWith(resolved+path.sep));return readFileSync(target);};
 const old=readEvidence(PLAN_BUDGET_UI_HISTORICAL_PATH);
 validatePlanPartidaPreviewImportUiProofBytes(old,readSource,{expectedHead,expectedTree,expectedRoot:resolved,readEvidence:file=>readEvidence(path.isAbsolute(file)?path.relative(resolved,file).split(path.sep).join('/'):file)});
 const bytes=readEvidence(PLAN_BUDGET_UI_PROOF_PATH),result=validatePlanBudgetUiProofBytes(bytes,readSource,{expectedHead,expectedTree,expectedRoot:resolved,readEvidence});
 for(const image of result.screenshots){const target=path.join(resolved,image.path);assert.equal(realpathSync(path.dirname(target)),realpathSync(path.join(resolved,'.vercel/private')));assert.equal(image.sourcePath,image.path);}
 assertIdentity();const target=path.join(resolved,'.vercel/private/plan-budget-ui-ci.json');writeFileSync(target,bytes,{flag:'wx'});assert.ok(readEvidence('.vercel/private/plan-budget-ui-ci.json').equals(bytes));assertIdentity();
 return {status:'PASS',sourceRevision:expectedHead,sourceTree:expectedTree,historicalChecks:180,budgetChecks:23,combinedChecks:203,screenshots:result.screenshots.length,sourceCount:result.sourceCount,nativePostgresExecuted:false,productionDataWritten:false,humanAccepted:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--expected-head');console.log(JSON.stringify(verifyPlanBudgetUi({root:process.cwd(),expectedHead:process.argv[3]})));}
