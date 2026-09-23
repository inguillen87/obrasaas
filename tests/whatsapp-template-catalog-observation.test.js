import assert from 'node:assert/strict';
import test from 'node:test';
import { initialTemplateCatalogObservation, templateCatalogObservationReducer as reduce, templateCatalogObservationPresentation as show } from '../src/lib/whatsapp/template-catalog-observation.js';
import { templateWorkbenchFixture } from './helpers/template-workbench-fixture.js';
const key='incident-report';
async function entry(status='APPROVED',category='UTILITY') {
 const f=templateWorkbenchFixture();await f.provision();Object.assign(f.remote[0],{status,category});return (await f.sync())[0];
}
function begin(state,generation){return reduce(state,{type:'begin',generation});}
function resolved(state,items,partial=false){return reduce(state,{type:'resolved',generation:state.generation,items,partial});}
async function approved(){return resolved(begin(initialTemplateCatalogObservation(),1),[await entry()]);}

test('before any observation the panel does not invent a missing or approved template',()=>{
 const state=initialTemplateCatalogObservation();assert.equal(show(state,key,true).label,'Plantilla sin verificar');assert.notEqual(show(state,key,true).tone,'ready');
});
test('beginning refresh immediately removes approval confidence without mutating cached content',async()=>{
 const old=await approved(),next=begin(old,2);assert.equal(show(old,key,true).tone,'ready');assert.equal(show(next,key,true).label,'Consultando plantilla…');assert.deepEqual(next.catalog,old.catalog);assert.deepEqual(next.verifiedKeys,[]);assert.equal(old.phase,'ready');
});
test('failed refresh cannot leave an approved badge from the previous response',async()=>{
 const state=reduce(begin(await approved(),2),{type:'failed',generation:2});assert.equal(show(state,key,true).label,'Plantilla sin verificar');assert.equal(state.catalog[0].template.status,'APPROVED');assert.deepEqual(state.verifiedKeys,[]);
});
test('cancelled read removes pending confidence and cannot later adopt its response',async()=>{
 const reading=begin(await approved(),2),cancelled=reduce(reading,{type:'settled',generation:2});assert.equal(show(cancelled,key,true).label,'Plantilla sin verificar');assert.equal(resolved(cancelled,[await entry()]),cancelled);
});
for(const type of ['resolved','failed','settled'])test('older '+type+' cannot replace a more recent paused observation',async()=>{
 let state=begin(await approved(),2);state=begin(state,3);state=resolved(state,[await entry('PAUSED')]);
 const after=reduce(state,{type,generation:2,items:[await entry()],partial:false});assert.equal(after,state);assert.equal(show(after,key,true).label,'Pausada por Meta');
});
for(const type of ['resolved','failed','settled'])test('unsolicited future '+type+' cannot overwrite the current request',async()=>{
 const state=begin(await approved(),2);assert.equal(reduce(state,{type,generation:3,items:[await entry()],partial:false}),state);
});
for(const generation of [null,undefined,0,-1,1.5,'2',Number.MAX_SAFE_INTEGER+1])test('invalid local request identity does not transition: '+String(generation),()=>{
 const state=initialTemplateCatalogObservation();for(const type of ['begin','reset','resolved','failed','settled'])assert.equal(reduce(state,{type,generation,items:[],partial:false}),state);
});
test('a partial confirmation verifies only its own blueprint, not old records retained for display',async()=>{
 const a=await entry(),b={...a,blueprintKey:'daily-report',template:{...a.template,blueprintKey:'daily-report'}};
 const old=resolved(begin(initialTemplateCatalogObservation(),1),[a,b]);
 const next=resolved(begin(old,2),[await entry('PENDING')],true);
 assert.equal(next.catalog.length,2);assert.equal(show(next,key,true).label,'En revisión de Meta');assert.equal(show(next,'daily-report',true).label,'Plantilla sin verificar');assert.deepEqual(next.verifiedKeys,[key]);
});
test('a full verified empty catalog says no version instead of asserting approval or a submitted request',()=>{
 const state=resolved(begin(initialTemplateCatalogObservation(),1),[]);assert.equal(show(state,key,true).label,'Sin versión de plantilla');assert.equal(state.fullSnapshot,true);
});
test('an exact reviewed entry without a remote record may correctly say not requested',async()=>{
 const f=templateWorkbenchFixture();const state=resolved(begin(initialTemplateCatalogObservation(),1),await f.sync());assert.equal(show(state,key,true).label,'Sin solicitar');
});
test('channel gating overrides even a verified approved template',async()=>{
 const state=await approved();assert.equal(show(state,key,false).label,'Estado Meta no verificado');assert.equal(show(state,key,false).tone,'blocked');
});
for(const [status,category,label] of [['APPROVED','MARKETING','Categoría distinta'],['PAUSED','UTILITY','Pausada por Meta'],['REJECTED','UTILITY','Rechazada por Meta'],['UNKNOWN','UNKNOWN','Categoría distinta']])test('fresh '+status+'/'+category+' never acquires an approved icon',async()=>{
 const state=resolved(begin(initialTemplateCatalogObservation(),1),[await entry(status,category)]);assert.equal(show(state,key,true).label,label);assert.notEqual(show(state,key,true).tone,'ready');
});
test('reset on channel replacement discards catalog and invalidates an outstanding request',async()=>{
 const old=begin(await approved(),2),reset=reduce(old,{type:'reset',generation:3});assert.deepEqual(reset.catalog,[]);assert.equal(show(reset,key,true).label,'Plantilla sin verificar');assert.equal(reduce(reset,{type:'resolved',generation:2,items:[await entry()],partial:false}),reset);
});
test('settlement after a successful observation cannot erase it',async()=>{
 const state=await approved();assert.equal(reduce(state,{type:'settled',generation:1}),state);assert.equal(reduce(state,{type:'failed',generation:1}),state);
});
test('invalid result data cannot confer verification even from the current request',async()=>{
 const a=await entry();for(const items of [null,{},[null],[a,a],[{...a,contentSha256:'bad'}],Array(33).fill(a)]){
  const state=resolved(begin(initialTemplateCatalogObservation(),1),items);assert.equal(state.phase,'error');assert.notEqual(show(state,key,true).tone,'ready');assert.deepEqual(state.verifiedKeys,[]);
 }
});
test('old or repeated begin/reset generations do not erase a current observation',async()=>{
 const state=await approved();for(const type of ['begin','reset'])assert.equal(reduce(state,{type,generation:1}),state);
});
