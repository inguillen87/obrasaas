import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {approved} from './fixtures/attendance-effective-audited.fixture.mjs';
import {closureUtcFromLocal} from '../src/app/(identity)/cuenta/attendance-closure-view.mjs';
const requireRoot=createRequire(new URL('../package.json',import.meta.url)),{loadBindings,transform}=requireRoot('next/dist/build/swc/index.js');
await loadBindings();
const reactUrl=pathToFileURL(requireRoot.resolve('react')).href,helperUrl=new URL('../src/app/(identity)/cuenta/attendance-closure-view.mjs',import.meta.url).href;
async function compile(file,prefix){const source=fs.readFileSync(new URL(file,import.meta.url),'utf8').replace(/^import .+;\r?\n/gm,'');return (await transform(prefix+source,{filename:'actual-closure-form.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}})).code;}
const overtime=await compile('../src/app/(identity)/cuenta/field-overtime-view.js',`import React from '${reactUrl}';const styles={};\n`),overtimeUrl='data:text/javascript;base64,'+Buffer.from(overtime).toString('base64');
const code=await compile('../src/app/(identity)/cuenta/attendance-closure-view.js',`import React from '${reactUrl}';import {recordedDuration} from '${overtimeUrl}';import {closureUtcFromLocal} from '${helperUrl}';const styles={};\n`),ui=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const text=tree=>typeof tree==='string'?tree:typeof tree==='number'?String(tree):tree?.props?React.Children.toArray(tree.props.children).map(text).join(''):'';
function nodes(tree,predicate,result=[]){if(!tree||typeof tree!=='object')return result;if(predicate(tree))result.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,result);return result;}
const a=approved(),p=a.bundle.proposalEnvelope.proposal,base={source:a.snapshot.source129,chronology:a.projection,capabilities:{canPropose:false,decisions:[{proposalId:p.id,canDecide:false}]},proposals:[{proposalEnvelope:a.bundle.proposalEnvelope,decisionEnvelope:null,state:'PENDING',currentSource:true}]};
test('actual review JSX keeps a proposer out of its own decision and exposes the independent reviewer action',()=>{
 const calls=[],onBegin=(...args)=>calls.push(args),own=ui.FieldAttendanceClosureReview({view:base,disabled:false,onBegin,onRefresh(){}});assert.match(text(own),/Debe revisarla otra cuenta autorizada/);assert.equal(nodes(own,n=>n.type==='button'&&text(n)==='Revisar esta propuesta').length,0);
 const reviewer=ui.FieldAttendanceClosureReview({view:{...base,capabilities:{canPropose:false,decisions:[{proposalId:p.id,canDecide:true}]}},disabled:false,onBegin,onRefresh(){}}),button=nodes(reviewer,n=>n.type==='button'&&text(n)==='Revisar esta propuesta')[0];button.props.onClick();assert.equal(calls.length,1);assert.equal(calls[0][0],'DECIDE_ATTENDANCE_CLOSURE');assert.equal(calls[0][1].proposalDigest,p.proposalDigest);assert.equal(calls[0][1].decision,'');
});
test('actual proposal form captures time zone and reason explicitly without a prefilled closing hour',()=>{
 const payload={effectiveLocalInput:'',effectiveTimeZone:'',reason:''},edits=[],tree=ui.FieldAttendanceClosureForm({action:'PROPOSE_ATTENDANCE_CLOSURE',payload,view:base,disabled:false,onEdit:(...args)=>edits.push(args)}),input=nodes(tree,n=>n.type==='input'&&n.props.type==='datetime-local')[0];assert.equal(input.props.required,true);assert.equal(input.props.value,'');const select=nodes(tree,n=>n.type==='select')[0];assert.equal(select.props.required,true);assert.equal(select.props.value,'');const reason=nodes(tree,n=>n.type==='textarea')[0];assert.equal(reason.props.minLength,8);input.props.onChange({target:{value:'2026-10-26T17:00'}});assert.deepEqual(edits,[['effectiveLocalInput','2026-10-26T17:00']]);assert.match(text(tree),/fichajes originales se conservan/);
});
test('actual decision form displays the original reason and both explicit decisions, and can be locked during unknown outcome',()=>{
 const tree=ui.FieldAttendanceClosureForm({action:'DECIDE_ATTENDANCE_CLOSURE',payload:{proposalId:p.id,decision:'',reason:''},view:base,disabled:true,onEdit(){}});assert.equal(tree.props.disabled,true);assert.match(text(tree),new RegExp(p.reason.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));const options=nodes(tree,n=>n.type==='option').map(n=>n.props.value);assert.deepEqual(options,['','APPROVE','REJECT']);assert.equal(closureUtcFromLocal('2026-10-26T17:00','America/Argentina/Buenos_Aires').effectiveEndAt,'2026-10-26T20:00:00.000Z');
});
test('actual integrated panel and journal parse as their real JSX/module sources',async()=>{
 const source=fs.readFileSync(new URL('../src/app/(identity)/cuenta/field-operations-panel.js',import.meta.url),'utf8');const result=await transform(source,{filename:'actual-integrated-closure-panel.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022'},module:{type:'es6'}});assert.ok(result.code.includes('attendanceClosurePayload'));assert.ok(result.code.includes('FieldAttendanceClosureForm'));assert.ok(result.code.includes('attendanceClosureViewMatches'));
});
