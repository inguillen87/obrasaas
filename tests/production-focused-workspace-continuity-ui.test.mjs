import assert from 'node:assert/strict';
import test from 'node:test';
import {focusedCompanyBootstrapUiSourceClosure,focusedWorkspaceUiSourceClosure,FOCUSED_WORKSPACE_WIDTHS,FOCUSED_WORKSPACE_CONTINUITY_WIDTHS,FOCUSED_WORKSPACE_REFRESH_NEGATIVES,FOCUSED_WORKSPACE_CONTINUITY_CHECKS,FOCUSED_WORKSPACE_UI_VERSION,FOCUSED_WORKSPACE_UI_EXPECTED_CHECK_COUNT,FOCUSED_WORKSPACE_TASK_PAGING_WIDTHS,FOCUSED_WORKSPACE_TASK_PAGING_CHECKS,FOCUSED_WORKSPACE_UI_CURRENT_CHECK_COUNT,HOME_DECISIONS_WIDTHS,HOME_DECISIONS_NEGATIVES,HOME_DECISIONS_CHECKS} from '../scripts/verify-focused-workspace-ui.mjs';
const entry='src/app/(identity)/cuenta/company-bootstrap-panel.js',reader=files=>file=>Object.hasOwn(files,file)?Buffer.from(files[file]):null;
test('continuity matrix preserves baseline widths and explicitly appends all controlled cases',()=>{
 assert.equal(FOCUSED_WORKSPACE_UI_VERSION,4);assert.deepEqual(FOCUSED_WORKSPACE_WIDTHS,[390,1440]);assert.deepEqual(FOCUSED_WORKSPACE_CONTINUITY_WIDTHS,[320,390,1440]);
 assert.equal(FOCUSED_WORKSPACE_CONTINUITY_CHECKS.length,25);assert.equal(new Set(FOCUSED_WORKSPACE_CONTINUITY_CHECKS).size,25);assert.equal(FOCUSED_WORKSPACE_UI_EXPECTED_CHECK_COUNT,20+25);
 assert.deepEqual(FOCUSED_WORKSPACE_TASK_PAGING_WIDTHS,[320,390,1440]);
 assert.deepEqual(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS,[
  ...[320,390,1440].flatMap(width=>['field','inventory'].map(consumer=>'account-task-pages-draft-100-200-205-single-GET-'+consumer+'-'+width)),
  ...['field','inventory'].flatMap(consumer=>['503-retry','403-clear','busy-uncertain-and-late-page'].map(scenario=>'account-task-pages-'+scenario+'-'+consumer+'-390')),
  ...['field','inventory'].map(consumer=>'account-task-pages-404-revoked-clear-'+consumer+'-390')
 ]);
 assert.equal(new Set(FOCUSED_WORKSPACE_TASK_PAGING_CHECKS).size,14);
 assert.deepEqual(HOME_DECISIONS_WIDTHS,[320,390,768,1440]);assert.deepEqual(HOME_DECISIONS_NEGATIVES,['denied','500','missing','foreign-scope','foreign-project','negative','invalid-date','capability','missing-evidence','negative-evidence']);
 assert.deepEqual(HOME_DECISIONS_CHECKS,[
  ...[320,390,768,1440].map(width=>'home-decisions-auto-scoped-read-and-queues-'+width),
  'home-decisions-director-390',...['WORKER','AUDITOR'].map(role=>'home-decisions-no-management-read-'+role+'-390'),
  'home-decisions-only-when-home-active-390',...['denied','500','missing','foreign-scope','foreign-project','negative','invalid-date','capability','missing-evidence','negative-evidence'].map(mode=>'home-decisions-no-false-zero-'+mode+'-390'),
  'home-decisions-explicit-retry-390','home-decisions-late-response-does-not-reenter-hidden-home-390'
 ]);
 assert.equal(HOME_DECISIONS_CHECKS.length,20);assert.equal(new Set(HOME_DECISIONS_CHECKS).size,20);assert.equal(FOCUSED_WORKSPACE_UI_CURRENT_CHECK_COUNT,45+14+20);
 for(const mode of ['list-role','list-scope','list-missing','list-401','list-403','list-500','project-401','project-403','project-500','project-scope','project-id','project-null'])assert.ok(FOCUSED_WORKSPACE_REFRESH_NEGATIVES.includes(mode));
 for(const width of [320,390,1440]){assert.ok(FOCUSED_WORKSPACE_CONTINUITY_CHECKS.includes('fresh-list-project-preserves-section-no-POST-'+width));assert.ok(FOCUSED_WORKSPACE_CONTINUITY_CHECKS.includes('bootstrap-ready-receipt-compact-disclosure-trial-no-POST-'+width));}
});
test('bootstrap closure independently follows actual JSX CSS aliases and static dynamic imports',()=>{
 const files={[entry]:"import React from 'react';import './panel.css';export const load=()=>import('@/lib/bootstrap-pure.mjs');",'src/app/(identity)/cuenta/panel.css':'.panel{color:white}','src/lib/bootstrap-pure.mjs':'export const value=1;'};
 assert.deepEqual(focusedCompanyBootstrapUiSourceClosure(reader(files)),{files:Object.keys(files).sort(),externalImports:['react']});
 assert.throws(()=>focusedWorkspaceUiSourceClosure(reader(files)),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
test('bootstrap closure rejects missing unsafe remote and external CSS dependencies',()=>{
 for(const ref of ['./missing','https://example.invalid/code.mjs','file:/private/code.mjs','data:text/javascript,void0','../../../../outside.mjs','./bad\\path.mjs','./bad\0path.mjs']){
  const files={[entry]:'import '+JSON.stringify(ref)+';','outside.mjs':'export const value=1;','src/app/(identity)/cuenta/bad\\path.mjs':'export const value=1;','src/app/(identity)/cuenta/bad\0path.mjs':'export const value=1;'};
  assert.throws(()=>focusedCompanyBootstrapUiSourceClosure(reader(files)),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'},ref);
 }
 for(const css of ['@import "https://example.invalid/font.css";','body{background:url(https://example.invalid/image.png)}'])assert.throws(()=>focusedCompanyBootstrapUiSourceClosure(reader({[entry]:"import './panel.css';",'src/app/(identity)/cuenta/panel.css':css})),{code:'FOCUSED_WORKSPACE_UI_BOUNDARY_REJECTED'});
});
