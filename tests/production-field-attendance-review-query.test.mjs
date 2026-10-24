import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldHandlers,fieldHeaders} from '../src/lib/field-operations-http.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';

const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_AttendanceReviewer',organizationId:'org_Attendance',organizationRole:'org:member'};
const context={projectId:'project-attendance',scope:'a'.repeat(64)};
const accessStamp='c'.repeat(64);
const pending={...context,reviewSection:'ATTENDANCE',reviewFilter:'PENDING'};
const all={...pending,reviewFilter:'ALL'};
const event={id:'attendance-a',workerId:'worker-a',workerName:'Persona de prueba',recordedAt:'2026-10-20T12:00:00.000Z',version:1,eventType:'CHECK_IN',phase:'WORKING',sequence:1,verificationStatus:'REVIEW_REQUIRED',recordedBy:'member-a',review:null};
const envelope=(input,records=[])=>({...input,reviewAccessStamp:input.reviewAccessStamp??accessStamp,afterReview:input.afterReview??null,reviewId:input.reviewId??null,records,total:records.length,nextCursor:null,canReview:true,canApproveProgress:true});
const request=(input,headers={})=>new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams(input),{headers});
function privateHeaders(response){for(const [name,value] of Object.entries(fieldHeaders))assert.equal(response.headers.get(name),value);}
function transport({verify=async()=>session,reviewPage=async(_actor,input)=>envelope(input,[event])}={}){
 const calls=[];
 const operations=Object.fromEntries(['read','reviewPage','status','proposalEvidence','inventoryHistory','shift','save','hoursReport'].map(method=>[method,async(actor,input)=>{calls.push({method,actor,input});if(method!=='reviewPage')throw new Error('Unexpected store path: '+method);return reviewPage(actor,input);} ]));
 return {calls,handlers:createFieldHandlers({verify,operations})};
}
async function rejected(handlers,input,status=400,code='FIELD_QUERY_INVALID',headers={}){
 const response=await handlers.GET(request(input,headers));assert.equal(response.status,status);assert.deepEqual(await response.json(),{saved:false,code});privateHeaders(response);
}

test('attendance pending GET dispatches the current actor and project without a client access stamp',async()=>{
 const f=transport(),response=await f.handlers.GET(request(pending));
 assert.equal(response.status,200);privateHeaders(response);assert.deepEqual(await response.json(),envelope(pending,[event]));
 assert.deepEqual(f.calls,[{method:'reviewPage',actor:session,input:pending}]);
});

test('attendance ALL GET preserves the returned human decision and scoped display name',async()=>{
 const decided={...event,workerName:null,review:{decision:'APPROVE',reason:'Revisión de prueba',actorId:'reviewer-b',recordedAt:'2026-10-20T13:00:00.000Z'}};
 const f=transport({reviewPage:async(_actor,input)=>envelope(input,[decided])}),input={...all,reviewAccessStamp:accessStamp},response=await f.handlers.GET(request(input));
 assert.equal(response.status,200);privateHeaders(response);assert.deepEqual(await response.json(),envelope(input,[decided]));assert.deepEqual(f.calls[0].input,input);
});

test('attendance continuation forwards only its canonical event cursor and current access stamp',async()=>{
 const f=transport(),input={...pending,afterReview:'attendance-old',reviewAccessStamp:accessStamp},response=await f.handlers.GET(request(input));
 assert.equal(response.status,200);privateHeaders(response);assert.deepEqual(f.calls,[{method:'reviewPage',actor:session,input}]);assert.deepEqual(await response.json(),envelope(input,[event]));
});

test('attendance directed recovery is an ALL read with an exact event reference',async()=>{
 const f=transport(),input={...all,reviewId:event.id,reviewAccessStamp:accessStamp},response=await f.handlers.GET(request(input));
 assert.equal(response.status,200);privateHeaders(response);assert.deepEqual(f.calls,[{method:'reviewPage',actor:session,input}]);assert.deepEqual(await response.json(),envelope(input,[event]));
});

test('attendance reference cannot target PENDING or coexist with a page cursor',async()=>{
 const f=transport();
 await rejected(f.handlers,{...pending,reviewId:event.id,reviewAccessStamp:accessStamp});
 await rejected(f.handlers,{...all,reviewId:event.id,afterReview:'attendance-old',reviewAccessStamp:accessStamp});
 assert.deepEqual(f.calls,[]);
});

test('attendance incomplete selectors and malformed project context never dispatch',async()=>{
 const f=transport();
 for(const input of [{...context,reviewSection:'ATTENDANCE'},{...context,reviewFilter:'PENDING'},{...pending,reviewSection:'attendance'},{...pending,reviewFilter:'OPEN'},{...pending,projectId:''},{...pending,scope:'stale'},{...pending,scope:'A'.repeat(64)}])await rejected(f.handlers,input);
 assert.deepEqual(f.calls,[]);
});

test('attendance duplicate context and review selectors are rejected before every store method',async()=>{
 const f=transport(),target={...all,reviewId:event.id,reviewAccessStamp:accessStamp};
 for(const key of ['projectId','scope','reviewSection','reviewFilter','reviewId','reviewAccessStamp'])await rejected(f.handlers,[...Object.entries(target),[key,target[key]]]);
 await rejected(f.handlers,[...Object.entries({...pending,afterReview:'attendance-old',reviewAccessStamp:accessStamp}),['afterReview','attendance-other']]);
 assert.deepEqual(f.calls,[]);
});

test('attendance query cannot mix inventory evidence shift status or hours selectors',async()=>{
 const f=transport();
 for(const key of ['operationId','proposalId','afterMovement','afterConsumption','consumptionId','afterAdjustment','adjustmentId','shiftId','closingEventId','journeyCursor','hoursFrom','hoursFormat'])await rejected(f.handlers,{...pending,[key]:'other'});
 await rejected(f.handlers,{...pending,inventoryFilter:'PENDING'},400,'INVENTORY_QUERY_INVALID');
 assert.deepEqual(f.calls,[]);
});

test('attendance query rejects client worker role timestamp and tenant overrides',async()=>{
 const f=transport();
 for(const key of ['workerId','actorId','organizationId','tenantRole','canReview','checkedInAt','recordedAt','createdAt'])await rejected(f.handlers,{...pending,[key]:'untrusted'});
 assert.deepEqual(f.calls,[]);
});

test('attendance cursors require valid IDs and a complete lowercase access stamp',async()=>{
 const f=transport();
 for(const input of [{...pending,afterReview:''},{...pending,afterReview:'../attendance'},{...pending,afterReview:'attendance-old'},{...all,reviewId:''},{...all,reviewId:'attendance/bad'},{...all,reviewId:event.id},{...pending,reviewAccessStamp:''},{...pending,reviewAccessStamp:'C'.repeat(64)},{...pending,afterReview:'attendance-old',reviewAccessStamp:'c'.repeat(63)}])await rejected(f.handlers,input);
 assert.deepEqual(f.calls,[]);
});

test('attendance cross-site GET is denied before any review or write dispatch',async()=>{
 const f=transport();await rejected(f.handlers,pending,403,'WORKSPACE_ORIGIN_REJECTED',{'sec-fetch-site':'cross-site'});assert.deepEqual(f.calls,[]);
});

test('attendance GET keeps anonymous and unavailable identity responses private',async()=>{
 const anonymous=transport({verify:async()=>({authenticated:false})});await rejected(anonymous.handlers,pending,401,'SESSION_REQUIRED');assert.deepEqual(anonymous.calls,[]);
 const unavailable=transport({verify:async()=>({authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'})});await rejected(unavailable.handlers,pending,503,'IDENTITY_PROVIDER_UNAVAILABLE');assert.deepEqual(unavailable.calls,[]);
});

test('attendance stale access or missing canonical cursor retains its exact denial code',async()=>{
 for(const [error,status,code] of [[new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409),409,'WORKSPACE_CONTEXT_CHANGED'],[new WorkspaceError('FIELD_REVIEW_CURSOR_UNAVAILABLE',404),404,'FIELD_REVIEW_CURSOR_UNAVAILABLE']]){
  const f=transport({reviewPage:async()=>{throw error;}}),input={...all,reviewId:event.id,reviewAccessStamp:accessStamp};
  await rejected(f.handlers,input,status,code);assert.deepEqual(f.calls,[{method:'reviewPage',actor:session,input}]);
 }
});

test('attendance unexpected store failure reveals no SQL or exception detail',async()=>{
 const f=transport({reviewPage:async()=>{throw new Error('Private synthetic SQL and worker details must not leave this boundary');}});
 await rejected(f.handlers,pending,503,'FIELD_OPERATION_UNCONFIRMED');assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'reviewPage');
});

test('attendance canonical dispatch remains read-only for pending history and exact recovery',async()=>{
 const calls=[],sentinel={canonicalRead:true},workspace={async projectOperation(actor,input,writable,callback,beforeProject){calls.push({actor,input,writable,callback,beforeProject});return sentinel;}},operations=createFieldOperations({workspace});
 for(const input of [pending,all,{...all,reviewId:event.id,reviewAccessStamp:accessStamp}]){
  assert.equal(await operations.reviewPage(session,input),sentinel);const call=calls.at(-1);assert.equal(call.actor,session);assert.equal(call.input,input);assert.equal(call.writable,false);assert.equal(typeof call.callback,'function');assert.equal(call.beforeProject,undefined);
 }
 assert.equal(calls.length,3);
});

test('attendance invalid direct store selectors cannot open a canonical transaction',()=>{
 let transactions=0;const operations=createFieldOperations({workspace:{projectOperation(){transactions++;throw new Error('No transaction should open');}}});
 for(const input of [{...pending,reviewFilter:'OPEN'},{...pending,reviewId:event.id,reviewAccessStamp:accessStamp},{...pending,afterReview:'attendance-old'},{...all,reviewId:event.id,reviewAccessStamp:'invalid'},{...all,reviewId:event.id,afterReview:'attendance-old',reviewAccessStamp:accessStamp}])assert.throws(()=>operations.reviewPage(session,input),{code:'FIELD_QUERY_INVALID'});
 assert.equal(transactions,0);
});

test('attendance HTTP reaches canonical membership denial without changing the actor or enabling writes',async()=>{
 const calls=[],operations=createFieldOperations({workspace:{async projectOperation(actor,input,writable){calls.push({actor,input,writable});throw new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403);}}}),handlers=createFieldHandlers({verify:async()=>session,operations});
 await rejected(handlers,pending,403,'WORKSPACE_MEMBERSHIP_REQUIRED');assert.deepEqual(calls,[{actor:session,input:pending,writable:false}]);
});

test('attendance read selectors on POST cannot turn the read query into a save',async()=>{
 const f=transport(),response=await f.handlers.POST(new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams(pending),{method:'POST',headers:{origin:'https://obrasaas.com','content-type':'application/json'},body:'{}'}));
 assert.equal(response.status,400);privateHeaders(response);assert.deepEqual(await response.json(),{saved:false,code:'FIELD_QUERY_INVALID'});assert.deepEqual(f.calls,[]);
});
