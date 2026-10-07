import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldHandlers,fieldHeaders} from '../src/lib/field-operations-http.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {fieldReviewPage,mergeFieldReviewRows} from '../src/app/(identity)/cuenta/field-review-page-view.mjs';

const session={authenticated:true,verification:'clerk-production-jwt',userId:'user_A',organizationId:'org_A',organizationRole:'org:member'};
const context={projectId:'p-a',scope:'a'.repeat(64)};
const query={...context,reviewAccessStamp:'c'.repeat(64),reviewSection:'EVIDENCE',reviewFilter:'PENDING'};
const page=input=>({...input,reviewAccessStamp:input.reviewAccessStamp??query.reviewAccessStamp,afterReview:input.afterReview??null,reviewId:input.reviewId??null,records:[],total:0,nextCursor:null,canReview:true,canApproveProgress:true});
const request=(input,headers={})=>new Request('https://obrasaas.com/api/identity/field-operations?'+new URLSearchParams(input),{headers});
function harness(verify=async()=>session,overrides={}){
 const calls=[];
 const operations=Object.fromEntries(['read','reviewPage','status','proposalEvidence','inventoryHistory','shift','save'].map(method=>[method,async(actor,input)=>{calls.push({method,actor,input});return method==='reviewPage'?page(input):{method};}]));
 return {calls,handlers:createFieldHandlers({verify,operations:{...operations,...overrides}})};
}

test('review GET dispatches both sections and filters with current authenticated actor and private headers',async()=>{
 const {calls,handlers}=harness();
 for(const reviewSection of ['EVIDENCE','PROGRESS'])for(const reviewFilter of ['PENDING','ALL']){
  const input={...context,reviewSection,reviewFilter},response=await handlers.GET(request(input));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),page(input));
  for(const [header,value] of Object.entries(fieldHeaders))assert.equal(response.headers.get(header),value);
  assert.deepEqual(calls.at(-1),{method:'reviewPage',actor:session,input});
 }
 assert.equal(calls.length,4);
});

test('cursor and exact ALL reference remain exclusive canonical ID selectors',async()=>{
 const {calls,handlers}=harness();
 const cursor={...query,afterReview:'evidence-old'},target={...query,reviewFilter:'ALL',reviewId:'evidence-old'};
 for(const input of [cursor,target]){const response=await handlers.GET(request(input));assert.equal(response.status,200);assert.deepEqual(calls.at(-1).input,input);}
 assert.equal(calls.length,2);
});

test('invalid, incomplete, repeated and mixed review selectors cannot reach any store path',async()=>{
 const {calls,handlers}=harness(),invalid=[
  {...context,reviewSection:'EVIDENCE'}, {...context,reviewFilter:'PENDING'},
  {...query,reviewSection:'ATTENDANCE'}, {...query,reviewFilter:'OPEN'},
  {...query,afterReview:''}, {...query,afterReview:'../evidence'},
  {...query,reviewId:'evidence-old'}, {...query,reviewFilter:'ALL',afterReview:'one',reviewId:'two'},
  {...query,scope:'stale'}, {...query,projectId:''},
  {...query,reviewAccessStamp:''}, {...query,reviewAccessStamp:'invalid'}, {...context,reviewSection:'EVIDENCE',reviewFilter:'PENDING',afterReview:'evidence-old'}, {...context,reviewSection:'EVIDENCE',reviewFilter:'ALL',reviewId:'evidence-old'},
  ...['operationId','proposalId','afterMovement','afterConsumption','consumptionId','afterAdjustment','adjustmentId','shiftId','closingEventId','journeyCursor','workerId','tenantRole'].map(key=>({...query,[key]:'synthetic-id'})),
  [...Object.entries(query),['reviewSection','PROGRESS']], [...Object.entries(query),['afterReview','one'],['afterReview','two']],
  [...Object.entries(query),['scope',context.scope]],
 ];
 for(const input of invalid){const response=await handlers.GET(request(input));assert.equal(response.status,400,JSON.stringify(input));assert.deepEqual(await response.json(),{saved:false,code:'FIELD_QUERY_INVALID'});}
 assert.deepEqual(calls,[]);
});

test('existing field GET paths remain distinct from paginated review',async()=>{
 const {calls,handlers}=harness(),paths=[
  [context,'read'],[{...context,operationId:'7f998006-a463-46c4-9c26-d80e1150f876'},'status'],
  [{...context,proposalId:'proposal-old'},'proposalEvidence'],[{...context,afterConsumption:'consumption-old'},'inventoryHistory'],
  [{...context,shiftId:'shift-old'},'shift'],
 ];
 for(const [input,method] of paths){assert.equal((await handlers.GET(request(input))).status,200);assert.equal(calls.at(-1).method,method);assert.deepEqual(calls.at(-1).input,input);}
 assert.equal(calls.length,paths.length);
});

test('review pages preserve identity and cross-site guards before store dispatch',async()=>{
 const {handlers,calls}=harness();
 assert.equal((await handlers.GET(request(query,{'sec-fetch-site':'cross-site'}))).status,403);assert.deepEqual(calls,[]);
 for(const [identity,status,code] of [
  [{authenticated:false},401,'SESSION_REQUIRED'],
  [{authenticated:false,code:'IDENTITY_PROVIDER_UNAVAILABLE'},503,'IDENTITY_PROVIDER_UNAVAILABLE'],
 ]){
  const denied=harness(async()=>identity),response=await denied.handlers.GET(request(query));
  assert.equal(response.status,status);assert.equal((await response.json()).code,code);assert.deepEqual(denied.calls,[]);
 }
});

test('review failures expose only safe error codes and preserve status and no-store headers',async()=>{
 for(const [error,status,code] of [
  [new WorkspaceError('FIELD_REVIEW_CURSOR_UNAVAILABLE',404),404,'FIELD_REVIEW_CURSOR_UNAVAILABLE'],
  [new WorkspaceError('WORKSPACE_CONTEXT_CHANGED',409),409,'WORKSPACE_CONTEXT_CHANGED'],
  [new WorkspaceError('WORKSPACE_MEMBERSHIP_REQUIRED',403),403,'WORKSPACE_MEMBERSHIP_REQUIRED'],
  [new Error('Synthetic database detail that must remain private'),503,'FIELD_OPERATION_UNCONFIRMED'],
 ]){
  const {handlers}=harness(undefined,{reviewPage:async()=>{throw error;}}),response=await handlers.GET(request(query));
  assert.equal(response.status,status);assert.deepEqual(await response.json(),{saved:false,code});assert.equal(response.headers.get('cache-control'),fieldHeaders['Cache-Control']);
 }
});

test('store rejects invalid review selectors before opening canonical project transaction',()=>{
 let transactions=0;const operations=createFieldOperations({workspace:{projectOperation:()=>{transactions++;throw new Error('Must not open database');}}});
 for(const change of [{reviewSection:'ATTENDANCE'},{reviewFilter:'OPEN'},{afterReview:''},{afterReview:'a/b'},{reviewId:'a/b'},{afterReview:'one',reviewId:'two',reviewFilter:'ALL'},{reviewId:'one'},{afterReview:'one',reviewAccessStamp:undefined},{reviewId:'one',reviewFilter:'ALL',reviewAccessStamp:undefined},{reviewAccessStamp:'bad'}])assert.throws(()=>operations.reviewPage(session,{...query,...change}),{code:'FIELD_QUERY_INVALID'});
 assert.equal(transactions,0);
});

test('review queries use a read-only canonical project snapshot with unchanged session and context',async()=>{
 const transactions=[],sentinel={scope:context.scope};
 const operations=createFieldOperations({workspace:{projectOperation:async(actor,input,writable,callback,beforeProject)=>{transactions.push({actor,input,writable,callback,beforeProject});return sentinel;}}});
 assert.equal(await operations.reviewPage(session,query),sentinel);
 assert.equal(transactions.length,1);assert.equal(transactions[0].actor,session);assert.equal(transactions[0].input,query);assert.equal(transactions[0].writable,false);assert.equal(typeof transactions[0].callback,'function');assert.equal(transactions[0].beforeProject,undefined);
});

const evidence={id:'evidence-old',workerId:'worker-a',taskId:'task-a',sectorId:'sector-a',revision:'2026-10-01T14:00:00.123456',status:'PENDING',title:'Synthetic evidence',caption:'Synthetic caption',capturedAt:'2026-10-01T14:00:00.000Z',media:{kind:'image',contentType:'image/png',bytes:68,sha256:'b'.repeat(64)},processing:{status:'RUNNING'},review:null};
const proposal={id:'proposal-old',workerId:'worker-a',taskId:'task-a',revision:evidence.revision,status:'PENDING',statusStored:'PENDING',expiresAt:'2026-10-10T14:00:00.000Z',summary:'Synthetic measured advance',reason:'Synthetic measured quantity',progress:25,quantity:'2.5999',baseline:'10.0000',unit:'M2',evidenceIds:[evidence.id],result:null};

test('browser review envelope is bound to exact section, filter, cursor and current project context',()=>{
 const value={...page(query),records:[evidence],total:1};assert.equal(fieldReviewPage(value,query),value);
 for(const update of [{scope:'b'.repeat(64)},{projectId:'p-b'},{reviewAccessStamp:'d'.repeat(64)},{reviewAccessStamp:undefined}])assert.throws(()=>fieldReviewPage({...value,...update},query),{code:'WORKSPACE_CONTEXT_CHANGED'});
 for(const update of [{extra:true},{reviewSection:'PROGRESS'},{reviewFilter:'ALL'},{afterReview:'evidence-old'},{reviewId:'evidence-old'},{canReview:'true'},{canReview:false,canApproveProgress:true}])assert.throws(()=>fieldReviewPage({...value,...update},query),{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});
 const selected={...query,reviewFilter:'ALL',reviewId:evidence.id},exact={...page(selected),records:[evidence],total:1};assert.equal(fieldReviewPage(exact,selected),exact);
 assert.throws(()=>fieldReviewPage({...exact,records:[],total:0},selected),{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});
});

test('browser page bound, unique IDs and last-row cursor reject unsafe pagination envelopes',()=>{
 const records=Array.from({length:100},(_,n)=>({...evidence,id:'evidence-'+n})),value={...page(query),records,total:201,nextCursor:records.at(-1).id};
 assert.equal(fieldReviewPage(value,query),value);
 for(const update of [{records:[...records,evidence]},{records:[evidence,evidence],nextCursor:null},{nextCursor:'evidence-0'},{records:[evidence],nextCursor:evidence.id},{total:99},{total:201.5}])assert.throws(()=>fieldReviewPage({...value,...update},query),{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});
});

test('browser review preserves human pending status, precise measurements, media hashes and ALL history',()=>{
 const pending={...page(query),records:[evidence],total:1};assert.equal(fieldReviewPage(pending,query).records[0].processing.status,'RUNNING');
 for(const row of [{...evidence,status:'APPROVED'}, {...evidence,review:{decision:'APPROVE'}}, {...evidence,media:{...evidence.media,sha256:'bad'}}, {...evidence,media:{...evidence.media,bytes:0}}])assert.throws(()=>fieldReviewPage({...pending,records:[row]},query),{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});
 const expected={...query,reviewSection:'PROGRESS'},value={...page(expected),records:[proposal],total:1};assert.equal(fieldReviewPage(value,expected).records[0].quantity,'2.5999');
 for(const update of [{quantity:'2.59999'},{quantity:'2e1'},{quantity:2.5999},{baseline:'0.0000'},{unit:'USD'},{evidenceIds:[evidence.id,evidence.id]},{status:'EXPIRED'}])assert.throws(()=>fieldReviewPage({...value,records:[{...proposal,...update}]},expected),{code:'FIELD_REVIEW_PAGE_UNCONFIRMED'});
 const all={...expected,reviewFilter:'ALL'};for(const status of ['APPLIED','REJECTED','EXPIRED','INVALIDATED'])assert.equal(fieldReviewPage({...page(all),records:[{...proposal,status}],total:1},all).records[0].status,status);
});

test('page merging keeps a newly reviewed row when an older page response arrives late',()=>{
 const newest={...evidence,revision:'2026-10-07T14:00:00.654321',status:'APPROVED',review:{decision:'APPROVE'}},other={...evidence,id:'evidence-other'};
 const previous=[newest],incoming=[evidence,other],merged=mergeFieldReviewRows(previous,incoming);assert.deepEqual(merged,[newest,other]);assert.deepEqual(previous,[newest]);assert.deepEqual(incoming,[evidence,other]);
 assert.deepEqual(mergeFieldReviewRows([evidence],[newest]),[newest]);
});

function eligibilityStore(owned){
 const statements=[],member={role:'AUDITOR'},client={async query(sql){statements.push(sql);if(sql.startsWith('SELECT id,name,active,metadata'))return {rows:owned.slice().sort((a,b)=>a.id.localeCompare(b.id))};if(sql.startsWith('SELECT id FROM'))return {rows:[{id:'anchor-b'}]};if(sql.startsWith('SELECT count(*)'))return {rows:[{total:0}]};return {rows:[]};}};
 const operations=createFieldOperations({workspace:{async projectOperation(actor,input,writable,callback){assert.equal(actor,session);assert.equal(writable,false);return callback(client,member,context.scope);}}});
 return {operations,statements};
}
const eligible=id=>({id,name:'Synthetic private name '+id,metadata:{participant:{permissions:{report:true,attendance:true},unrelated:'synthetic private detail'}}});

test('review access stamp is opaque, canonical and independent of display names or unrelated worker metadata',async()=>{
 const owned=[eligible('worker-b'),eligible('worker-a')],{operations,statements}=eligibilityStore(owned),input={...context,reviewSection:'EVIDENCE',reviewFilter:'PENDING'};
 const first=await operations.reviewPage(session,input);assert.match(first.reviewAccessStamp,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(first).includes('Synthetic private'),false);assert.ok(statements[0].endsWith('ORDER BY id'));assert.equal(statements[0].includes('LIMIT'),false);
 owned.reverse();owned[0].name='Changed display only';owned[0].metadata.participant.unrelated='Changed unrelated only';assert.equal((await operations.reviewPage(session,input)).reviewAccessStamp,first.reviewAccessStamp);
});

test('a revoked first worker invalidates an old continuation before consulting the still-visible second worker anchor',async()=>{
 const owned=[eligible('worker-a'),eligible('worker-b')],{operations,statements}=eligibilityStore(owned),input={...context,reviewSection:'EVIDENCE',reviewFilter:'PENDING'};
 const old=await operations.reviewPage(session,input);owned.shift();const now=await operations.reviewPage(session,input);assert.notEqual(now.reviewAccessStamp,old.reviewAccessStamp);
 statements.length=0;await assert.rejects(operations.reviewPage(session,{...input,afterReview:'anchor-b',reviewAccessStamp:old.reviewAccessStamp}),{code:'WORKSPACE_CONTEXT_CHANGED',status:409});assert.equal(statements.length,1);
 assert.equal((await operations.reviewPage(session,{...input,afterReview:'anchor-b',reviewAccessStamp:now.reviewAccessStamp})).reviewAccessStamp,now.reviewAccessStamp);
 assert.throws(()=>fieldReviewPage(now,{...input,reviewAccessStamp:old.reviewAccessStamp}),{code:'WORKSPACE_CONTEXT_CHANGED'});
});

test('report or attendance flags beyond the display limit invalidate current-base eligibility for both sections',async()=>{
 const owned=Array.from({length:105},(_,n)=>eligible('worker-'+String(n).padStart(3,'0'))),{operations}=eligibilityStore(owned),input={...context,reviewSection:'EVIDENCE',reviewFilter:'PENDING'};
 for(const permission of ['report','attendance']){
  const before=await operations.reviewPage(session,input);owned.at(-1).metadata.participant.permissions[permission]=false;
  const now=await operations.reviewPage(session,{...input,reviewSection:'PROGRESS'});assert.notEqual(now.reviewAccessStamp,before.reviewAccessStamp);
  await assert.rejects(operations.reviewPage(session,{...input,reviewSection:'PROGRESS',reviewFilter:'ALL',reviewId:'anchor-b',reviewAccessStamp:before.reviewAccessStamp}),{code:'WORKSPACE_CONTEXT_CHANGED'});
 }
});
