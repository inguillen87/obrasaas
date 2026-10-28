import {companyOnboardingUxHistoricalFocusedAssertions} from '../scripts/lib/home-decisions-current-ci-lineage.mjs';
import {verifyPlanBudgetCurrentSources,restorePilotCompletionPreviousSourceText} from '../scripts/lib/plan-budget-current-ci-lineage.mjs';
import {focusedWorkspaceCiSourceClosure} from '../scripts/verify-focused-workspace-ci.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parse} from '@babel/parser';
import {focusedWorkspaceTaskPagingCopy,focusedWorkspaceTaskPageResponse,focusedWorkspaceUiSourceFiles,FOCUSED_WORKSPACE_TASK_PAGING_WIDTHS,FOCUSED_WORKSPACE_TASK_PAGING_CHECKS,FOCUSED_WORKSPACE_UI_EXPECTED_CHECK_COUNT,FOCUSED_WORKSPACE_UI_CURRENT_CHECK_COUNT,HOME_DECISIONS_CHECKS} from '../scripts/verify-focused-workspace-ui.mjs';
import {confirmedWorksiteTaskPage} from '../src/app/(identity)/cuenta/workspace-task-page.mjs';

const root=new URL('../',import.meta.url),readSource=file=>{const target=new URL(file,root);return existsSync(target)&&lstatSync(target).isFile()?readFileSync(target):null;};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),entry='src/app/(identity)/cuenta/workspace-client.js',factory='src/app/(identity)/cuenta/workspace-task-page.mjs',scope='c'.repeat(64);
const consumers=['src/app/(identity)/cuenta/field-operations-panel.js','src/app/(identity)/cuenta/material-inventory-panel.js'];

test('task-page browser extension preserves the historical45 and fourteen ordered additions before eighteen home cases',()=>{
 assert.equal(FOCUSED_WORKSPACE_UI_EXPECTED_CHECK_COUNT,45);assert.equal(HOME_DECISIONS_CHECKS.length,20);assert.equal(new Set(HOME_DECISIONS_CHECKS).size,20);assert.equal(FOCUSED_WORKSPACE_UI_CURRENT_CHECK_COUNT,45+14+20+6);assert.deepEqual(FOCUSED_WORKSPACE_TASK_PAGING_WIDTHS,[320,390,1440]);assert.equal(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS.length,14);assert.equal(new Set(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS).size,14);
 assert.deepEqual(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS.slice(0,6),[320,390,1440].flatMap(width=>['field','inventory'].map(name=>'account-task-pages-draft-100-200-205-single-GET-'+name+'-'+width)));
 assert.deepEqual(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS.slice(6,12),['field','inventory'].flatMap(name=>['503-retry','403-clear','busy-uncertain-and-late-page'].map(kind=>'account-task-pages-'+kind+'-'+name+'-390')));assert.deepEqual(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS.slice(12),['field','inventory'].map(name=>'account-task-pages-404-revoked-clear-'+name+'-390'));
});
test('separate fixture retains real AccountWorkspace and factory bytes and replaces exactly two declared consumers',()=>{
 const copy=focusedWorkspaceTaskPagingCopy(readSource);assert.deepEqual(copy.overrides.map(item=>item.path),consumers);assert.equal(new Set(copy.files.map(file=>file.path)).size,copy.files.length);
 for(const file of copy.files)assert.deepEqual(file.bytes,readSource(file.path));
 for(const file of [entry,factory]){assert.ok(copy.files.some(item=>item.path===file));assert.equal(sha(copy.files.find(item=>item.path===file).bytes),sha(readSource(file)));assert.equal(copy.overrides.some(item=>item.path===file),false);}
});
test('controlled consumers publish pending and busy callbacks but cannot send commands or replace authority',()=>{
 for(const item of focusedWorkspaceTaskPagingCopy(readSource).overrides){
  const ast=parse(item.source,{sourceType:'module',plugins:['jsx']}),exports=ast.program.body.filter(node=>node.type==='ExportNamedDeclaration');assert.equal(exports.length,1);assert.equal(exports[0].declaration.id.name,item.exportName);
  assert.match(item.source,/onPending\?\.\(Boolean\(draft.text\)\|\|phase!=='draft'\)/);assert.match(item.source,/onTaskReadBusy\?\.\(phase!=='draft'\)/);assert.match(item.source,/await onLoadMoreTasks\(\)/);assert.doesNotMatch(item.source,/\bfetch\s*\(|XMLHttpRequest|requestWorkspace|sessionStorage|localStorage|document\.cookie|getSessionToken|\.dispatch\(/);
  assert.match(item.source,/data-paging-more onClick=/);assert.doesNotMatch(item.source,/data-paging-more disabled=/);
 }
});
test('a missing actual pager or consumer fails before creating a browser fixture',()=>{
 for(const missing of [factory,...consumers])assert.throws(()=>focusedWorkspaceTaskPagingCopy(file=>file===missing?null:readSource(file)),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('the second exact source tree refuses an alias that could silently reach the original consumer tree',()=>{
 assert.throws(()=>focusedWorkspaceTaskPagingCopy(file=>file===entry?Buffer.from(readSource(file).toString()+"\nimport '@/lib/identity-return-path.mjs';\n"):readSource(file)),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('synthetic pages satisfy the real canonical response validator for100 then100 then5 without changing existing revisions',()=>{
 const pages=[null,'task_100','task_200'].map(cursor=>confirmedWorksiteTaskPage(focusedWorkspaceTaskPageResponse(scope,cursor),{scope,projectId:'project-a',cursor}));
 assert.deepEqual(pages.map(page=>page.tasks.length),[100,100,5]);assert.deepEqual(pages.map(page=>page.nextCursor),['task_100','task_200',null]);const tasks=pages.flatMap(page=>page.tasks);assert.equal(tasks.length,205);assert.equal(new Set(tasks.map(task=>task.id)).size,205);assert.equal(tasks.at(-1).id,'task_205');assert.ok(tasks.every(task=>task.progress===0&&task.revision==='2026-10-16T12:00:00.000000'&&task.startsOn===null&&task.endsOn===null));
 for(const cursor of ['task_101','../foreign',''])assert.throws(()=>focusedWorkspaceTaskPageResponse(scope,cursor),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});assert.throws(()=>focusedWorkspaceTaskPageResponse('foreign'),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('browser source manifest includes this test and the canonical parent pager without a private evidence dependency',()=>{
 const files=focusedWorkspaceUiSourceFiles(readSource);for(const file of [entry,factory,'tests/production-focused-workspace-task-pagination.test.mjs'])assert.ok(files.includes(file));assert.ok(files.every(file=>!file.includes('.vercel/')&&!file.includes('node_modules/')));assert.equal(new Set(files).size,files.length);
});
test('all128 historical producer assertions remain exact after projecting only authenticated home additions',()=>{
 // Authenticate the physical current producer and its complete real closure
 // before exposing a predecessor only to this historical assertion oracle.
 const contract=JSON.parse(readSource('.github/workspace-acceptance-contract.json')),producer='scripts/verify-focused-workspace-ui.mjs';
 assert.equal(verifyPlanBudgetCurrentSources(contract,readSource).nativeOrBrowserAcceptance,false);
 const specs=contract.extension.proofs.filter(row=>row.id==='focused-workspace-ui');assert.equal(specs.length,1);
 assert.deepEqual(focusedWorkspaceCiSourceClosure(readSource),specs[0].sourceFiles);
 const raw=readSource(producer),previous=restorePilotCompletionPreviousSourceText(contract,producer,raw.toString('utf8'));
 const calls=companyOnboardingUxHistoricalFocusedAssertions(previous,contract);assert.equal(calls.length,201);
 assert.deepEqual(calls.slice(18,23),["assert.ok(['ADMIN','DIRECTOR'].includes(role))","assert.equal(url.searchParams.size,3)","assert.equal(url.searchParams.get('view'),'decisions')","assert.equal(url.searchParams.get('scope'),scope)","assert.equal(url.searchParams.get('projectId'),'project-a')"]);
 assert.equal(sha(JSON.stringify(calls.slice(128,150))),'74f50ce9dd5d97d531eed6cb99a0eb26461aa19fd7ac5bb49526dfc7b78eac0e');
 const historicalPrefix=[...calls.slice(0,18),...calls.slice(23,128),...calls.slice(150,155)];assert.equal(historicalPrefix.length,128);assert.equal(sha(JSON.stringify(historicalPrefix)),'41c2c075ff830bd9b0cab70c778c50a782915f466773e72299fce4977712dcdb');
});
