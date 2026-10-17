import test from 'node:test';
import assert from 'node:assert/strict';
import {existingApiPlanSnapshot,existingApiPlanReceiptOutcome,existingApiPlanCommandReference,EXISTING_API_PLAN_REJECTION_CODES} from '../src/app/(identity)/cuenta/meta-existing-api-plan-view.mjs';

const op='12345678-1234-4234-8234-123456789012',planId='12345678-1234-4234-8234-123456789013',scope='a'.repeat(64);
const plan=()=>({id:planId,state:'ADDITIONAL_AUTHORIZATION_REVIEW_REQUIRED',preparedRevision:1,preparedAt:'2026-10-17T12:00:00.000Z',currentPreparationRevision:1,preparationCurrent:true,connectionCurrent:true,canClose:true,closedAt:null,preserveProvider:true,providerChanged:false,authorizationGranted:false,remoteMutationDispatched:false});
const reference=(action='prepare_existing_api_plan')=>({action,operationId:op,projectId:'project-a',scope,planId:action==='prepare_existing_api_plan'?op:planId,...(action==='prepare_existing_api_plan'?{preparedRevision:1}:{})});
const receipt=(ref=reference())=>({action:ref.action,operationId:ref.operationId,projectId:ref.projectId,scope:ref.scope,planId:ref.planId,state:'RECORDED',saved:true,receiptId:'meta_existing_api_'+'b'.repeat(64),recordedAt:'2026-10-17T12:00:00.000Z',preparedRevision:1,providerChanged:false,remoteMutationDispatched:false,authorizationGranted:false,code:null});
const result=(r=receipt())=>({scope,projectId:'project-a',existingApiPlanReceipt:r});

test('a current or stale plan and an explicitly closed plan remain declarations without provider authority',()=>{
 assert.equal(existingApiPlanSnapshot(null),null);assert.equal(existingApiPlanSnapshot(plan(),{numberMode:'EXISTING_API',preparedRevision:1}).canClose,true);
 const stale={...plan(),currentPreparationRevision:2,preparationCurrent:false,connectionCurrent:false};assert.equal(existingApiPlanSnapshot(stale,{numberMode:'DEDICATED',preparedRevision:2}),stale);
 const closed={...stale,state:'CLOSED',canClose:false,closedAt:'2026-10-17T12:01:00.000Z'};assert.equal(existingApiPlanSnapshot(closed,{numberMode:'BUSINESS_APP',preparedRevision:2}),closed);
});

test('private, malformed or optimistic plan projections fail closed',()=>{
 for(const patch of [{id:'foreign'},{preparedRevision:0},{preparedAt:'yesterday'},{currentPreparationRevision:-1},{currentPreparationRevision:2},{connectionCurrent:1},{canClose:false},{closedAt:'2026-10-17T12:01:00.000Z'},{preserveProvider:false},{providerChanged:true},{authorizationGranted:true},{remoteMutationDispatched:true},{token:'private'}])assert.throws(()=>existingApiPlanSnapshot({...plan(),...patch}),{code:'META_CUSTOMER_EXISTING_API_PLAN_RESPONSE_INVALID'});
 assert.throws(()=>existingApiPlanSnapshot(plan(),{numberMode:'BUSINESS_APP',preparedRevision:1}));
 assert.throws(()=>existingApiPlanSnapshot({...plan(),state:'CLOSED',canClose:false,closedAt:'2026-10-17T11:59:59.000Z'}));
});

test('plan commands produce only the action, plan identifier and expected preparation revision',()=>{
 const base={operationId:op,projectId:'project-a',scope};
 assert.deepEqual(existingApiPlanCommandReference({...base,action:'prepare_existing_api_plan',preparedRevision:1,confirmPreserveProvider:true}),{action:'prepare_existing_api_plan',planId:op,preparedRevision:1});
 assert.deepEqual(existingApiPlanCommandReference({...base,action:'close_existing_api_plan',planId,confirmLocalClosure:true}),{action:'close_existing_api_plan',planId});
 for(const patch of [{preparedRevision:0},{preparedRevision:1.5},{confirmPreserveProvider:false},{token:'private'}])assert.throws(()=>existingApiPlanCommandReference({...base,action:'prepare_existing_api_plan',preparedRevision:1,confirmPreserveProvider:true,...patch}));
});

test('only the exact historical action, UUID, plan, project, scope and preparation revision settle a receipt',()=>{
 for(const action of ['prepare_existing_api_plan','close_existing_api_plan']){
  const ref=reference(action),r=receipt(ref);assert.deepEqual(existingApiPlanReceiptOutcome(result(r),ref),{state:'RECORDED',receiptId:r.receiptId});
  for(const patch of [{operationId:planId},{planId:'12345678-1234-4234-8234-123456789014'},{projectId:'project-b'},{scope:'c'.repeat(64)},{action:'reconcile'},{receiptId:'other'},{recordedAt:'today'},{providerChanged:true},{remoteMutationDispatched:true},{authorizationGranted:true},{token:'private'},{code:'META_CUSTOMER_PREPARATION_CHANGED'}])assert.equal(existingApiPlanReceiptOutcome(result({...r,...patch}),ref),null);
  assert.equal(existingApiPlanReceiptOutcome({...result(r),scope:'c'.repeat(64)},ref),null);
 }
 assert.equal(existingApiPlanReceiptOutcome(result({...receipt(),preparedRevision:2}),reference()),null);
 const ref=reference(),newer={...result(),existingApiPlan:{...plan(),id:planId,currentPreparationRevision:2,preparationCurrent:false}};assert.equal(existingApiPlanReceiptOutcome(newer,ref).state,'RECORDED','a newer snapshot cannot replace or invalidate the exact historical receipt');
});

test('absence remains uncertain and only an exact durable rejection permits another explicit action',()=>{
 for(const action of ['prepare_existing_api_plan','close_existing_api_plan']){
  const ref=reference(action),r=receipt(ref),absent={...r,state:'NOT_OBSERVED',saved:false,receiptId:null,recordedAt:null,preparedRevision:null};
  assert.deepEqual(existingApiPlanReceiptOutcome(result(absent),ref),{state:'NOT_OBSERVED'});
  for(const code of EXISTING_API_PLAN_REJECTION_CODES){const rejected={...r,state:'REJECTED',saved:false,code,...(action==='close_existing_api_plan'?{preparedRevision:null}:{})};assert.deepEqual(existingApiPlanReceiptOutcome(result(rejected),ref),{state:'REJECTED',receiptId:r.receiptId,code});}
  assert.equal(existingApiPlanReceiptOutcome(result({...absent,saved:true}),ref),null);
  assert.equal(existingApiPlanReceiptOutcome(result({...r,state:'REJECTED',saved:false,code:'WORKSPACE_MEMBERSHIP_REQUIRED'}),ref),null);
 }
 for(const preparedRevision of [1,3]){
  const ref={...reference(),preparedRevision},r={...receipt(ref),state:'REJECTED',saved:false,preparedRevision,code:'META_CUSTOMER_EXISTING_API_CONNECTION_INCOMPLETE'},value={...result(r),existingApiPlan:null};
  assert.deepEqual(existingApiPlanReceiptOutcome(value,ref),{state:'REJECTED',receiptId:r.receiptId,code:r.code});
  for(const patch of [{operationId:planId},{planId},{preparedRevision:null},{preparedRevision:0},{preparedRevision:preparedRevision+1},{saved:true},{providerChanged:true},{remoteMutationDispatched:true},{authorizationGranted:true}])assert.equal(existingApiPlanReceiptOutcome({...value,existingApiPlanReceipt:{...r,...patch}},ref),null);
 }
});
