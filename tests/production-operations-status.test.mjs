import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationsStatus,createOperationsStatusHandler} from '../src/lib/operations-status.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
const scope='a'.repeat(64),url='https://obrasaas.com/api/identity/operations-status?projectId=p-a&scope='+scope;
const identity={authenticated:true,verification:'clerk-production-jwt',userId:'user_Test',organizationId:'org_Test',organizationRole:'org:admin'};
test('observability requires verified workspace identity before querying aggregates',async()=>{
 let reads=0;const store={read:()=>{reads++;throw new Error('Must not read');}};
 for(const session of [{authenticated:false},{...identity,verification:'synthetic-unverified'}, {...identity,organizationId:null}]){
  const handler=createOperationsStatusHandler({verify:async()=>session,store});const response=await handler(new Request(url));assert.ok([401,403].includes(response.status));assert.match(response.headers.get('cache-control'),/private.*no-store/);
 }
 assert.equal(reads,0);
});
test('cross-site, duplicated scope, extra fields and writes cannot query operational history',async()=>{
 let reads=0;const handler=createOperationsStatusHandler({verify:async()=>identity,store:{read:()=>{reads++;}}});
 for(const request of [new Request(url,{headers:{'sec-fetch-site':'cross-site'}}),new Request(url+'&scope='+scope),new Request(url+'&provider=meta-test-v1'),new Request(url,{method:'POST',body:'{}'})]){
  const response=await handler(request);assert.ok([400,403,405].includes(response.status));assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 }
 assert.equal(reads,0);
});
test('tenant permission denial exposes the public code without credential or provider detail',async()=>{
 const handler=createOperationsStatusHandler({verify:async()=>identity,store:{read:async()=>{const error=new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',403);error.privatePayload='synthetic-private-provider-payload';throw error;}}});
 const response=await handler(new Request(url));assert.equal(response.status,403);assert.deepEqual(await response.json(),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
});

function statusFixture({role='DIRECTOR',counts={consumptions:132,adjustments:4},progressRows=[{pending:0}],denial=null}={}){
 const queries=[],calls=[];
 const member={role,organizationId:'company-a',actorId:'director-a'};
 const client={query:async(sql,params)=>{
  queries.push({sql,params});
  if(sql.includes('AS consumptions'))return {rows:counts===null?[]:[counts]};
  if(sql.includes('FROM public."OperationalProposal"'))return {rows:progressRows};
  if(sql.includes('GROUP BY status')||sql.includes('FROM public."AuditLog"'))return {rows:[]};
  return {rows:[{pending:0}]};
 }};
 const workspace={integrationProject:async(session,context,writable,callback)=>{
  calls.push({session,context,writable});
  if(denial)throw denial;
  return callback(client,member,scope,{id:context.projectId});
 }};
 return {store:createOperationsStatus({workspace}),queries,calls};
}

test('status reports full material queues in the canonical read-only project transaction',async()=>{
 for(const role of ['ADMIN','DIRECTOR']){
  const {store,queries,calls}=statusFixture({role});
  const context={projectId:'p-a',scope};
  const data=await store.read(identity,context);
  assert.deepEqual(calls,[{session:identity,context,writable:false}]);
  assert.equal(data.projectId,'p-a');assert.equal(data.scope,scope);
  assert.deepEqual(data.inventory,{canManage:true,pendingCounts:{consumptions:132,adjustments:4}});
  assert.equal(data.acceptance,'NOT_VERIFIED');
  const counts=queries.filter(({sql})=>sql.includes('AS consumptions'));
  assert.equal(counts.length,1);
  assert.deepEqual(counts[0].params,['p-a','company-a']);
  assert.ok(queries.every(({sql})=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i.test(sql)));
 }
});

test('broader field-review roles never receive inventory review counts or an expanded capability',async()=>{
 for(const role of ['SITE_MANAGER','AUDITOR','MEMBER',null]){
  const {store,queries}=statusFixture({role});
  const data=await store.read(identity,{projectId:'p-a',scope});
  assert.deepEqual(data.inventory,{canManage:false,pendingCounts:null});
  assert.equal(queries.filter(({sql})=>sql.includes('AS consumptions')).length,0);
 }
});

test('missing or malformed material totals fail the read instead of inventing a zero',async()=>{
 for(const counts of [null,{}, {consumptions:0}, {consumptions:-1,adjustments:0}, {consumptions:'132',adjustments:4}, {consumptions:0,adjustments:NaN}]){
  const {store}=statusFixture({counts});
  const handler=createOperationsStatusHandler({verify:async()=>identity,store});
  const response=await handler(new Request(url));
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{code:'INVENTORY_READ_UNCONFIRMED'});
 }
 const {store}=statusFixture({counts:{consumptions:0,adjustments:0}});
 assert.deepEqual((await store.read(identity,{projectId:'p-a',scope})).inventory.pendingCounts,{consumptions:0,adjustments:0});
});

test('canonical project denial prevents every aggregate query including material counts',async()=>{
 const {store,queries}=statusFixture({denial:new WorkspaceError('WORKSPACE_PROJECT_UNAVAILABLE',404)});
 await assert.rejects(store.read(identity,{projectId:'p-b',scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 assert.equal(queries.length,0);
});

test('the optional decisions view carries an exact read selector while the two-parameter legacy read stays unchanged',async()=>{
 const calls=[],handler=createOperationsStatusHandler({verify:async()=>identity,store:{read:async(session,context)=>{calls.push({session,context});return context;}}});
 for(const [requestUrl,context] of [[url,{projectId:'p-a',scope}],[url+'&view=decisions',{projectId:'p-a',scope,view:'decisions'}]]){
  const response=await handler(new Request(requestUrl));assert.equal(response.status,200);assert.deepEqual(await response.json(),context);assert.match(response.headers.get('cache-control'),/private.*no-store/);
 }
 assert.deepEqual(calls,[{session:identity,context:{projectId:'p-a',scope}},{session:identity,context:{projectId:'p-a',scope,view:'decisions'}}]);
});

test('decisions rejects arbitrary duplicate mixed or writable selectors before reading the store',async()=>{
 let reads=0;const handler=createOperationsStatusHandler({verify:async()=>identity,store:{read:async()=>{reads++;}}});
 for(const suffix of ['&view=','&view=full','&view=DECISIONS','&view=decisions&view=decisions','&view=decisions&after=old','&view=decisions&reviewFilter=PENDING','&view=decisions&scope='+scope,'&view=decisions&provider=meta-customer-v1']){
  const response=await handler(new Request(url+suffix));assert.equal(response.status,400);assert.deepEqual(await response.json(),{code:'OPERATIONS_STATUS_QUERY_INVALID'});
 }
 for(const request of [new Request(url+'&view=decisions',{headers:{'sec-fetch-site':'cross-site'}}),new Request(url+'&view=decisions',{method:'POST',body:'{}'})])assert.ok([403,405].includes((await handler(request)).status));
 assert.equal(reads,0);
});

test('decisions returns only complete progress and material totals in one canonical read-only project transaction',async()=>{
 for(const role of ['ADMIN','DIRECTOR']){
  const {store,queries,calls}=statusFixture({role,progressRows:[{pending:237,private:'must not project'}]}),context={projectId:'p-a',scope,view:'decisions'};
  const data=await store.read(identity,context),{observedAt,...body}=data;
  assert.equal(new Date(observedAt).toISOString(),observedAt);
  assert.deepEqual(body,{scope,projectId:'p-a',view:'decisions',proposals:{pending:237},inventory:{canManage:true,pendingCounts:{consumptions:132,adjustments:4}}});
  assert.deepEqual(calls,[{session:identity,context,writable:false}]);assert.equal(queries.length,2);
  assert.match(queries[0].sql,/type='TASK_PROGRESS'.*"sourceProvider"='account-field'.*status='PENDING'.*"expiresAt">transaction_timestamp\(\).*fieldOperationsVersion/s);assert.deepEqual(queries[0].params,['p-a']);
  assert.deepEqual(queries[1].params,['p-a','company-a']);assert.match(queries[1].sql,/p\."organizationId"=\$2/);
  assert.ok(queries.every(({sql})=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i.test(sql)&&!(/Worker|PlatformUser|AttendanceEntry|WebhookEvent|AuditLog|\bLIMIT\b/.test(sql))));
 }
});

test('decisions cannot expose manager totals to field-review or unknown roles',async()=>{
 for(const role of ['SITE_MANAGER','AUDITOR','MEMBER','WORKER','',null]){
  const {store,queries,calls}=statusFixture({role}),handler=createOperationsStatusHandler({verify:async()=>identity,store});
  const response=await handler(new Request(url+'&view=decisions'));assert.equal(response.status,403);assert.deepEqual(await response.json(),{code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'});assert.equal(calls.length,1);assert.equal(calls[0].writable,false);assert.equal(queries.length,0);
 }
});

test('decisions retains canonical authority denial and rejects unknown service views before aggregate queries',async()=>{
 for(const [code,status] of [['SESSION_REQUIRED',401],['WORKSPACE_MEMBERSHIP_REQUIRED',403],['WORKSPACE_PROJECT_UNAVAILABLE',404],['WORKSPACE_CONTEXT_CHANGED',409]]){
  const {store,queries}=statusFixture({denial:new WorkspaceError(code,status)}),handler=createOperationsStatusHandler({verify:async()=>identity,store});
  const response=await handler(new Request(url+'&view=decisions'));assert.equal(response.status,status);assert.deepEqual(await response.json(),{code});assert.equal(queries.length,0);
 }
 for(const view of ['',null,'full','DECISIONS']){
  const {store,queries}=statusFixture();await assert.rejects(store.read(identity,{projectId:'p-a',scope,view}),{code:'OPERATIONS_STATUS_QUERY_INVALID'});assert.equal(queries.length,0);
 }
});

test('decisions never turns absent malformed progress or material totals into zero',async()=>{
 for(const progressRows of [[],[{}],[{pending:null}],[{pending:-1}],[{pending:'1'}],[{pending:0.5}],[{pending:Number.MAX_SAFE_INTEGER+1}]]){
  const {store,queries}=statusFixture({progressRows}),handler=createOperationsStatusHandler({verify:async()=>identity,store});
  const response=await handler(new Request(url+'&view=decisions'));assert.equal(response.status,503);assert.deepEqual(await response.json(),{code:'OPERATIONS_STATUS_UNAVAILABLE'});assert.equal(queries.length,1);
 }
 for(const counts of [null,{}, {consumptions:0}, {consumptions:-1,adjustments:0}, {consumptions:'132',adjustments:4}, {consumptions:0,adjustments:NaN}]){
  const {store}=statusFixture({counts}),handler=createOperationsStatusHandler({verify:async()=>identity,store});
  const response=await handler(new Request(url+'&view=decisions'));assert.equal(response.status,503);assert.deepEqual(await response.json(),{code:'INVENTORY_READ_UNCONFIRMED'});
 }
 const {store}=statusFixture({counts:{consumptions:0,adjustments:0},progressRows:[{pending:0}]});
 const data=await store.read(identity,{projectId:'p-a',scope,view:'decisions'});assert.equal(data.proposals.pending,0);assert.deepEqual(data.inventory.pendingCounts,{consumptions:0,adjustments:0});
});
