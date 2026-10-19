// Actual current canonical JSX read callbacks, synthetic GETs only.
// React DOM scheduling, real sessions, database and provider acceptance are separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {actualWorksiteLiveRead as actualRead} from './fixtures/worksite-live-reader-source.mjs';
import {collectRetainedPages,liveContextChanged,liveReadSignature} from '../src/app/(identity)/cuenta/workspace-live-read.mjs';
const scope='a'.repeat(64),stamp='b'.repeat(64),revision='2026-10-18T12:00:00.000001';
const rows=()=>['a','b','c'].map(id=>({id,revision,status:'PENDING'}));

function fieldFixture({filter='ALL',decided=false,holdBase=false}={}){
 const data={reviewAccessStamp:stamp,canReview:true,canApproveProgress:true,evidence:rows(),proposals:[]},page={reviewFilter:filter,records:rows(),total:3,nextCursor:null};
 const context={data,reviewPages:{EVIDENCE:page,PROGRESS:null},tab:'EVIDENCE',epoch:0,blocked:false};
 let release;const pending=new Promise(resolve=>{release=resolve;});const calls=[],draftRef={current:null};
 const deps={liveFieldContext:{current:context},mounted:{current:true},epoch:{current:0},draftRef,attemptRef:{current:null},projectId:'project',scope,sessionRequest:{},endpoint:'/api/identity/field-operations',collectRetainedPages,liveContextChanged,
  scoped:value=>value,fieldReviewPage:(value,expected)=>{assert.equal(value.reviewFilter,expected.reviewFilter);return value;},
  api:async(_request,_endpoint,params,options,validate)=>{
   calls.push({...params});assert.equal(options.method,undefined);assert.equal(options.body,undefined);
   if(!params.reviewSection){if(holdBase)await pending;return validate({scope,projectId:'project',...data});}
   const records=rows().map(row=>decided&&row.id==='a'?{...row,status:'APPROVED',revision:'2026-10-18T12:01:00.000001'}:row).filter(row=>params.reviewFilter==='ALL'||row.status==='PENDING');
   return validate({scope,projectId:'project',reviewAccessStamp:stamp,canReview:true,canApproveProgress:true,reviewFilter:params.reviewFilter,records,total:records.length,nextCursor:null});
  }};
 return {read:actualRead('field-operations-panel.js','fieldLive',deps),calls,context,draftRef,release:()=>release()};
}

test('actual pilot schedule read is one GET for three tasks',async()=>{
 const view={scope,project:{id:'project'},tasks:rows(),totalTasks:3,nextCursor:null};const context={account:{},view,generation:1,blocked:false};let calls=0;
 const read=actualRead('workspace-client.js','scheduleLive',{scheduleLiveContext:{current:context},mounted:{current:true},generation:{current:1},collectRetainedPages,query:values=>'?'+new URLSearchParams(values),
  request:async(_query,options)=>{calls++;assert.equal(options.method,undefined);assert.equal(options.body,undefined);return {...view};},confirmedWorksiteTaskPage:value=>value});
 const result=await read(new AbortController().signal);assert.equal(calls,1);assert.equal(result.rows.length,3);
});

test('actual pilot field read costs two GETs for unchanged head, three after independent decision',async()=>{
 for(const options of [{filter:'ALL'},{filter:'PENDING'},{filter:'PENDING',decided:true}]){
  const f=fieldFixture(options),result=await f.read(new AbortController().signal);assert.equal(result.rows.length,3);
  assert.equal(f.calls.length,options.decided?3:2);assert.ok(f.calls.every(call=>!Object.hasOwn(call,'operationId')));
 }
});

test('actual field callback sends no head request when a draft opens during base GET',async()=>{
 const f=fieldFixture({holdBase:true}),run=f.read(new AbortController().signal);
 f.draftRef.current={action:'PROPOSE_PROGRESS'};f.release();await assert.rejects(run,{name:'AbortError'});assert.equal(f.calls.length,1);
});

function inventoryFixture({manage=true,changedStamp=false,missingOld=false,balanceChanges=false}={}){
 const list=rows().map(row=>({...row,state:'PENDING'})),inventory={canManage:manage,...(manage?{inventoryFilter:'PENDING',pendingCounts:{consumptions:3,adjustments:0}}:{}),materials:[{id:'cement',balance:'10.000'}],catalogVersion:1,catalogHash:'catalog',consumptions:list,adjustments:[],nextConsumptionCursor:null,nextAdjustmentCursor:null,movements:[],nextMovementCursor:null};
 const data={scope,projectId:'project',reviewAccessStamp:stamp,projectRevision:revision,inventory},context={data,kind:'consumptions',epoch:0,blocked:false,pageChanged:false},calls=[];
 const deps={liveInventoryContext:{current:context},alive:{current:true},epoch:{current:0},control:{current:{busy:false,draft:null,attempt:null}},collectRetainedPages,liveContextChanged,liveReadSignature,
  consult:async(params,options)=>{
   calls.push({...params});assert.equal(options.method,undefined);assert.equal(options.body,undefined);
   if(params.afterConsumption)throw new Error('Automatic own history must not dispatch');
   if(params.inventoryFilter)return {scope,projectId:'project',inventory:{...inventory}};
   const base={...inventory};delete base.inventoryFilter;delete base.pendingCounts;
   if(missingOld){base.consumptions=list.slice(1);base.nextConsumptionCursor='last-recent';}
   if(balanceChanges&&calls.length===3)base.materials=[{id:'cement',balance:'9.000'}];
   return {...data,reviewAccessStamp:changedStamp?'c'.repeat(64):stamp,inventory:base};
  }};
 return {read:actualRead('material-inventory-panel.js','inventoryLive',deps),calls};
}

test('actual pilot inventory read costs three admin GETs or two own GETs',async()=>{
 for(const manage of [true,false]){const f=inventoryFixture({manage});const result=await f.read(new AbortController().signal);assert.equal(result.rows.length,3);assert.equal(f.calls.length,manage?3:2);}
});

test('revoked own report scope clears through context denial even when canManage remains false',async()=>{
 const f=inventoryFixture({manage:false,changedStamp:true});await assert.rejects(f.read(new AbortController().signal),{code:'WORKSPACE_CONTEXT_CHANGED'});assert.equal(f.calls.length,1);
});

test('own older history returns LIMITED before entering writable-history GET',async()=>{
 const f=inventoryFixture({manage:false,missingOld:true});await assert.rejects(f.read(new AbortController().signal),{code:'WORKSITE_LIVE_READ_INCOMPLETE'});assert.equal(f.calls.length,1);
});

test('balance changes between base and final read cannot be marked checked with old stock',async()=>{
 const f=inventoryFixture({balanceChanges:true});await assert.rejects(f.read(new AbortController().signal),{code:'WORKSITE_LIVE_READ_INCOMPLETE'});assert.equal(f.calls.length,3);
});
