import test from 'node:test';
import assert from 'node:assert/strict';
import {planPartidaSourcePreview,planPartidaPreviewSelection,planPartidaSourceShare} from '../src/app/(identity)/cuenta/plan-partida-source-preview.mjs';

const context={projectId:'project-synthetic',scope:'a'.repeat(64)};
function fixture(version=2){
 const item=(code,row)=>({code,parentCode:code.slice(0,code.lastIndexOf('.')),sourceTitle:'Partida sintética '+code,sourceRange:`Plan de trabajo!A${row}:BE${row}`,missingUnit:false,missingQuantity:false,ordinalDistribution:Array.from({length:48},(_,index)=>index===0?0:index===1?1:index===2?.25:null)});
 const items=[item('A.1.1.1',10),item('A.1.1.2',11),item('B.1.2.1',45)];
 return {id:'plan-synthetic',revision:3,status:'READY',source:{sha256:'b'.repeat(64)},rows:items.map(row=>({code:row.code,title:row.sourceTitle,startsOn:null,endsOn:null})),spreadsheet:{version,profile:version===4?'CYP_PARTIDAS_CURVE':'CYP_PARTIDAS',worksheet:'Plan de trabajo',level:'PARTIDA',rowCount:items.length,groups:[{code:'A',title:'Grupo A'},{code:'A.1',title:'Grupo A.1'},{code:'A.1.1',title:'Grupo A.1.1'},{code:'B',title:'Grupo B'},{code:'B.1',title:'Grupo B.1'},{code:'B.1.2',title:'Grupo B.1.2'}],weeksPerPeriod:4,periodOrdinals:Array.from({length:12},(_,i)=>i+1),items,...(version===4?{curve:{syntheticWholeSource:true}}:{})}};
}
const build=(draft=fixture(),extra={})=>planPartidaSourcePreview(draft,{...context,...extra});
test('source preview preserves all 48 ordinal values, zeros and holes without mutating a draft',()=>{
 const draft=fixture(),before=structuredClone(draft),view=build(draft),weeks=view.items[0].months.flatMap(month=>month.weeks);
 assert.equal(view.items.length,3);assert.equal(weeks.length,48);assert.deepEqual(weeks.map(week=>week.value),draft.spreadsheet.items[0].ordinalDistribution);assert.deepEqual(weeks.map(week=>week.ordinal),Array.from({length:48},(_,i)=>i+1));assert.equal(weeks[0].value,0);assert.equal(weeks[1].value,1);assert.equal(weeks[3].value,null);assert.deepEqual(draft,before);
});
test('a selected partida and view persist across view changes in the same exact context',()=>{
 const view=build(),selected=planPartidaPreviewSelection(view,{contextKey:view.contextKey,code:'A.1.1.2',tab:'QUANTITIES'});assert.equal(selected.selected.code,'A.1.1.2');assert.equal(selected.tab,'QUANTITIES');
 const changed=planPartidaPreviewSelection(view,{...selected,tab:'CURVE'});assert.equal(changed.code,selected.code);assert.equal(changed.tab,'CURVE');
});
test('group changes clamp selection to an actual descendant, retaining the chosen view',()=>{
 const view=build(),selected=planPartidaPreviewSelection(view,{contextKey:view.contextKey,group:'B.1.2',code:'A.1.1.1',tab:'QUANTITIES'});assert.equal(selected.items.length,1);assert.equal(selected.code,'B.1.2.1');assert.equal(selected.tab,'QUANTITIES');
});
test('a forged or missing group/code/tab never fabricates a selected source row',()=>{
 const view=build(),selected=planPartidaPreviewSelection(view,{contextKey:view.contextKey,group:'C',code:'other-project-code',tab:'APPLY'});assert.equal(selected.group,'');assert.equal(selected.code,'A.1.1.1');assert.equal(selected.tab,'DIAGRAM');
});
for(const key of ['projectId','scope','draftId','revision','sourceSha256'])test('selection resets when '+key+' changes, even if the partida code is reused',()=>{
 const draft=fixture(),view=build(draft),previous={contextKey:view.contextKey,group:'B.1.2',code:'B.1.2.1',tab:'QUANTITIES'},other=structuredClone(draft),nextContext={...context};
 if(key==='projectId')nextContext.projectId='project-other';else if(key==='scope')nextContext.scope='c'.repeat(64);else if(key==='draftId')other.id='plan-other';else if(key==='revision')other.revision++;else other.source.sha256='d'.repeat(64);
 const selected=planPartidaPreviewSelection(planPartidaSourcePreview(other,nextContext),previous);assert.equal(selected.group,'');assert.equal(selected.code,'A.1.1.1');assert.equal(selected.tab,'DIAGRAM');
});
test('the full source curve stays unchanged when a subset or different partida is selected',()=>{
 const draft=fixture(4),before=structuredClone(draft),view=build(draft,{reviewRows:[draft.rows[0]]}),selected=planPartidaPreviewSelection(view,{contextKey:view.contextKey,group:'B.1.2',code:'B.1.2.1'});assert.equal(selected.tab,'CURVE');assert.deepEqual(view.curve,draft.spreadsheet.curve);assert.equal(view.items.length,3);assert.deepEqual(view.retainedCodes,['A.1.1.1']);assert.deepEqual(draft,before);
});
test('the preview never invents quantities, units, dates, money or execution from source flags/distribution',()=>{
 const view=build(),item=view.items[0];for(const key of ['quantity','unit','baseline','startsOn','endsOn','progress','cost','measurement'])assert.equal(Object.hasOwn(item,key),false);assert.equal(item.missingQuantity,false);assert.equal(item.missingUnit,false);assert.equal(view.curve,null);
});
test('a missing or foreign review selection is explicitly unavailable rather than treated as a source change',()=>{
 const draft=fixture();assert.equal(build(draft,{reviewRows:[{code:'B.9.9.9'}]}).retainedCodes,null);assert.equal(build(draft,{reviewRows:[draft.rows[0],draft.rows[0]]}).retainedCodes,null);assert.equal(build(draft,{reviewRows:null}).retainedCodes,null);assert.equal(build(draft,{reviewRows:[]}).items.length,3);
});
for(const mutate of [d=>{d.spreadsheet.items[1].code=d.spreadsheet.items[0].code;},d=>{d.spreadsheet.items[0].ordinalDistribution.pop();},d=>{d.spreadsheet.items[0].ordinalDistribution[0]=-1;},d=>{d.spreadsheet.items[0].ordinalDistribution[0]='0';},d=>{d.spreadsheet.items[0].sourceRange='Plan de trabajo!A10:BE11';},d=>{d.spreadsheet.items[0].parentCode='B.1.2';},d=>{d.spreadsheet.groups.pop();},d=>{d.spreadsheet.periodOrdinals[11]=13;}])test('an invalid physical source cannot produce a plausible partial preview: '+mutate.toString(),()=>{
 const draft=fixture();mutate(draft);assert.throws(()=>build(draft),/PLAN_PARTIDA_PREVIEW_UNAVAILABLE/);
});
test('unsupported financial-only and document/rubros sources keep their existing views',()=>{
 for(const version of [1,3,5,undefined]){const draft=fixture();draft.spreadsheet.version=version;assert.equal(build(draft),null);}
});
test('percentage presentation preserves zero versus missing and rejects unknown/coerced values',()=>{
 assert.equal(planPartidaSourceShare(null),'Sin dato');assert.match(planPartidaSourceShare(0),/^0\s*%$/);assert.match(planPartidaSourceShare(1),/^100\s*%$/);assert.match(planPartidaSourceShare(.25),/^25\s*%$/);for(const value of [-1,1.1,NaN,Infinity,'0',undefined])assert.throws(()=>planPartidaSourceShare(value),/PLAN_PARTIDA_PREVIEW_UNAVAILABLE/);
});
