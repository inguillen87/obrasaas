import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkspaceRecoveryJournal,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {test} from 'node:test';
import {loadBindings,transform} from 'next/dist/build/swc/index.js';

await loadBindings();
const source=readFileSync(new URL('../src/app/(identity)/cuenta/workspace-client.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const compiled=await transform(source+'\nexport {requestWorkspace,guideAccessDenied};\n',{filename:'workspace-client.js',jsc:{parser:{syntax:'ecmascript',jsx:true},target:'es2022',transform:{react:{runtime:'classic'}}},module:{type:'es6'}});
const {requestWorkspace,guideAccessDenied}=await import('data:text/javascript;base64,'+Buffer.from(compiled.code).toString('base64'));
const transport=response=>async(_endpoint,_options,consume)=>consume(response);

for(const status of [401,403])test('HTML '+status+' preserves authority denial without parsing the gateway body',async()=>{
 const response=new Response('<html>private gateway diagnostic</html>',{status,headers:{'content-type':'text/html'}});let jsonReads=0;
 response.json=async()=>{jsonReads++;throw new SyntaxError('private diagnostic must not be displayed');};
 await assert.rejects(requestWorkspace(transport(response),'?scope=current&projectId=assigned'),error=>error.status===status&&guideAccessDenied(error)&&!error.message.includes('diagnostic'));
 assert.equal(jsonReads,0);
});
test('JSON context conflict retains its canonical code and invalidates the observed context',async()=>{
 const response=new Response(JSON.stringify({code:'WORKSPACE_CONTEXT_CHANGED'}),{status:409,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.status===409&&error.code==='WORKSPACE_CONTEXT_CHANGED'&&guideAccessDenied(error));
});
test('JSON schedule revision conflict keeps the original recovery behavior',async()=>{
 const response=new Response(JSON.stringify({code:'SCHEDULE_REVISION_CHANGED'}),{status:409,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.status===409&&error.code==='SCHEDULE_REVISION_CHANGED'&&!guideAccessDenied(error)&&error.message.includes('Otra persona modificó'));
});
test('malformed JSON server failure remains a 500 rather than a parser diagnostic',async()=>{
 const response=new Response('private malformed gateway payload',{status:500,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.status===500&&!guideAccessDenied(error)&&!error.message.includes('payload')&&error.name!=='SyntaxError');
});
test('malformed successful body shows a readable failed consultation',async()=>{
 const response=new Response('private malformed success',{status:200,headers:{'content-type':'application/json'}});
 await assert.rejects(requestWorkspace(transport(response)),error=>error.message.includes('Volvé a consultar')&&!error.message.includes('private')&&error.name!=='SyntaxError');
});
test('successful read uses the original query and options and returns the canonical body',async()=>{
 const body={scope:'current',project:{id:'assigned'},tasks:[]},options={signal:new AbortController().signal};let calls=0;
 const result=await requestWorkspace(async(endpoint,actualOptions,consume)=>{calls++;assert.equal(endpoint,'/api/identity/workspace?scope=current&projectId=assigned');assert.equal(actualOptions,options);return consume(new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}}));},'?scope=current&projectId=assigned',options);
 assert.equal(calls,1);assert.deepEqual(result,body);
});

test('only the canonical rejected schedule POST exposes revision recovery certainty',async()=>{
 const options={method:'POST'},body={saved:false,code:'SCHEDULE_REVISION_CHANGED'};
 await assert.rejects(requestWorkspace(transport(new Response(JSON.stringify(body),{status:409,headers:{'content-type':'application/json'}})),'',options),error=>error.status===409&&error.scheduleRevisionRejected===true&&!guideAccessDenied(error));
});
test('GET, ambiguous JSON, other conflicts and authority denials never gain revision recovery certainty',async()=>{
 for(const [status,body,query,options]of [
  [409,{saved:false,code:'SCHEDULE_REVISION_CHANGED'},'?projectId=assigned',{method:'GET'}],
  [409,{saved:false,code:'SCHEDULE_REVISION_CHANGED'},'?extra=unexpected',{method:'POST'}],
  [409,{code:'SCHEDULE_REVISION_CHANGED'},'',{method:'POST'}],
  [409,{saved:true,code:'SCHEDULE_REVISION_CHANGED'},'',{method:'POST'}],
  [409,{saved:false,code:'SCHEDULE_REVISION_CHANGED',scope:'foreign'},'',{method:'POST'}],
  [409,{saved:false,code:'SCHEDULE_OPERATION_CONFLICT'},'',{method:'POST'}],
  [409,{saved:false,code:'WORKSPACE_CONTEXT_CHANGED'},'',{method:'POST'}],
  [403,{saved:false,code:'SCHEDULE_REVISION_CHANGED'},'',{method:'POST'}],
  [503,{saved:false,code:'SCHEDULE_REVISION_CHANGED'},'',{method:'POST'}]
 ]){
  await assert.rejects(requestWorkspace(transport(new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})),query,options),error=>error.status===status&&error.scheduleRevisionRejected!==true);
 }
});

const scheduleRecoveryScope='a'.repeat(64),scheduleRecoveryId='01234567-89ab-4cde-8fab-0123456789ab',scheduleFreshId='01234567-89ab-4cde-8fab-0123456789ac';
function scheduleRecoveryStorage(){const rows=new Map();return {get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const scheduleRecoveryBody=(extra={})=>({operationId:scheduleRecoveryId,scope:scheduleRecoveryScope,projectId:'p-a',taskId:'task-a',expectedRevision:'2026-10-01T12:00:00.123456',startsOn:'2026-10-07',endsOn:'2026-10-15',reason:'Synthetic schedule reason retained in memory.',...extra});
const scheduleRecoveryOptions=(extra={})=>({method:'POST',body:JSON.stringify(scheduleRecoveryBody(extra))});
const scheduleRecoveryError=()=>Object.assign(new Error('Synthetic rejected schedule'),{status:409,code:'SCHEDULE_REVISION_CHANGED',scheduleRevisionRejected:true});

test('actual schedule HTTP pipeline keeps lost-ACK and NOT_OBSERVED, then closes only the exact rejected retry before a new UUID',async()=>{
 const storage=scheduleRecoveryStorage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456});
 await journal.prepare('/api/identity/task-creation',{method:'POST',body:JSON.stringify({operationId:'22222222-2222-4222-8222-222222222222',scope:scheduleRecoveryScope,projectId:'p-a',title:'Synthetic historical task'})});
 await journal.prepare('/api/identity/workspace',scheduleRecoveryOptions({operationId:'33333333-3333-4333-8333-333333333333',projectId:'p-b'}));
 const history=await journal.list(scheduleRecoveryScope),postBodies=[];let reads=0;
 const transport=createWorkspaceRequestLifecycle(async()=>'synthetic-session',{journal,fetchImpl:async(url,options)=>{
  if((options.method||'GET')==='GET'){reads++;assert.equal(url,recoveryQuery((await journal.list(scheduleRecoveryScope)).find(row=>row.resource==='workspace'&&row.projectId==='p-a')));return Response.json({scope:scheduleRecoveryScope,state:'NOT_OBSERVED',definitive:false});}
  assert.equal(url,'/api/identity/workspace');const body=JSON.parse(options.body);postBodies.push(body);
  if(postBodies.length===1)return Response.json({saved:false,code:'WORKSPACE_OPERATION_UNCONFIRMED'},{status:503});
  if(postBodies.length===2){assert.deepEqual(body,postBodies[0]);return Response.json({saved:false,code:'SCHEDULE_REVISION_CHANGED'},{status:409});}
  assert.equal(postBodies.length,3);assert.equal(body.operationId,scheduleFreshId);return Response.json({scope:scheduleRecoveryScope,saved:true,receipt:{id:'synthetic-confirmed-receipt'},task:{id:'task-a'}});
 }});
 try{
  await assert.rejects(requestWorkspace(transport.request,'',scheduleRecoveryOptions()),error=>error.status===503);
  const pending=(await journal.list(scheduleRecoveryScope)).find(row=>row.resource==='workspace'&&row.projectId==='p-a');assert.ok(pending);assert.equal((await journal.list(scheduleRecoveryScope)).length,history.length+1);
  await requestWorkspace(transport.request,recoveryQuery(pending).slice('/api/identity/workspace'.length));assert.equal(reads,1);assert.equal((await journal.list(scheduleRecoveryScope)).length,history.length+1);
  await assert.rejects(requestWorkspace(transport.request,'',scheduleRecoveryOptions()),error=>error.scheduleRevisionRejected===true);assert.deepEqual(await journal.list(scheduleRecoveryScope),history);
  await requestWorkspace(transport.request,'',scheduleRecoveryOptions({operationId:scheduleFreshId}));assert.equal(postBodies.length,3);assert.deepEqual(await journal.list(scheduleRecoveryScope),history);
  const persisted=JSON.stringify([...storage.rows]);for(const privateValue of ['Synthetic schedule reason','expectedRevision','startsOn','endsOn','synthetic-session'])assert.ok(!persisted.includes(privateValue));
 }finally{transport.abort();}
});
test('actual noncanonical HTTP, changed retry payload and a forged consumer flag retain the earlier uncertain schedule',async()=>{
 const canonical={saved:false,code:'SCHEDULE_REVISION_CHANGED'};
 for(const sample of [
  {status:503,body:canonical},{status:400,body:canonical},{status:401,body:canonical},{status:403,body:canonical},
  {status:409,body:{code:canonical.code}},{status:409,body:{...canonical,saved:true}},{status:409,body:{...canonical,scope:'b'.repeat(64)}},{status:409,body:{...canonical,code:'SCHEDULE_OPERATION_CONFLICT'}},
  {status:409,raw:'malformed',contentType:'application/json'},{status:409,raw:'<html>synthetic</html>',contentType:'text/html'},
  {status:409,body:canonical,extra:{taskId:'task-b'}},{status:409,body:canonical,extra:{expectedRevision:'2026-10-02T12:00:00.123456'}},{status:409,body:canonical,extra:{reason:'Different synthetic reason.'}},
  {status:409,body:canonical,extra:{unexpected:true}},{status:409,body:canonical,query:'?scope='+scheduleRecoveryScope+'&projectId=p-a'},
  {status:409,body:canonical,get:true},{status:200,body:{saved:true},forged:true}
 ]){
  const storage=scheduleRecoveryStorage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456});await journal.prepare('/api/identity/workspace',scheduleRecoveryOptions());const before=JSON.stringify([...storage.rows]);
  const response=()=>sample.raw!==undefined?new Response(sample.raw,{status:sample.status,headers:{'content-type':sample.contentType}}):Response.json(sample.body,{status:sample.status});
  const transport=createWorkspaceRequestLifecycle(async()=>'synthetic-session',{journal,fetchImpl:async()=>response()});
  try{
   if(sample.forged)await assert.rejects(transport.request('/api/identity/workspace',scheduleRecoveryOptions(),()=>{throw scheduleRecoveryError();}));
   else await assert.rejects(requestWorkspace(transport.request,sample.query||'',sample.get?{}:scheduleRecoveryOptions(sample.extra||{})));
   assert.equal(JSON.stringify([...storage.rows]),before,JSON.stringify(sample));await assert.rejects(journal.prepare('/api/identity/workspace',scheduleRecoveryOptions({operationId:scheduleFreshId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
  }finally{transport.abort();}
 }
});
test('rejection evidence belongs to the original in-memory command and current ticket, is consumed once and cannot adopt historical references',async()=>{
 const endpoint='/api/identity/workspace',canonical=()=>Response.json({saved:false,code:'SCHEDULE_REVISION_CHANGED'},{status:409});
 const make=()=>{const storage=scheduleRecoveryStorage();return {storage,journal:createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456})};};
 for(const mode of ['no-response','changed-after-prepare','foreign-ticket','mutated-ticket','single-use','historical']){
  const {storage,journal}=make();await journal.prepare(endpoint,scheduleRecoveryOptions());const before=JSON.stringify([...storage.rows]);let ticket=await journal.prepare(endpoint,scheduleRecoveryOptions());
  if(mode==='historical'){const reloaded=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123457});ticket=await reloaded.prepare(endpoint,scheduleRecoveryOptions());await reloaded.captureResponse(ticket,endpoint,scheduleRecoveryOptions(),canonical());await reloaded.settle(ticket,null,scheduleRecoveryError());}
  else if(mode==='foreign-ticket'){const fake={entry:{...ticket.entry},existed:true};await journal.captureResponse(fake,endpoint,scheduleRecoveryOptions(),canonical());await journal.settle(fake,null,scheduleRecoveryError());}
  else{
   if(mode!=='no-response')await journal.captureResponse(ticket,endpoint,mode==='changed-after-prepare'?scheduleRecoveryOptions({expectedRevision:'2026-10-02T12:00:00.123456'}):scheduleRecoveryOptions(),canonical());
   if(mode==='mutated-ticket')ticket.entry={...ticket.entry,operationId:scheduleFreshId};
   if(mode==='single-use')await journal.settle(ticket,null,new TypeError('Synthetic transport unknown'));
   await journal.settle(ticket,null,scheduleRecoveryError());
  }
  assert.equal(JSON.stringify([...storage.rows]),before,mode);
 }
});

test('bounded rejection observation retains the earlier uncertain command on hanging body, abort, deadline or oversized JSON',async()=>{
 const endpoint='/api/identity/workspace',canonical={saved:false,code:'SCHEDULE_REVISION_CHANGED'};
 for(const mode of ['abort','deadline','oversized']){
  const storage=scheduleRecoveryStorage(),journal=createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>123456});await journal.prepare(endpoint,scheduleRecoveryOptions());const before=JSON.stringify([...storage.rows]);
  let observed,sourceCancelled,consumeCalls=0;const cloned=new Promise(resolve=>{observed=resolve;}),cancelled=new Promise(resolve=>{sourceCancelled=resolve;});
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(mode==='oversized'?' '.repeat(4097)+JSON.stringify(canonical):'{"saved":false,'));if(mode==='oversized')controller.close();},cancel(){sourceCancelled();}});
  const response=new Response(stream,{status:409,headers:{'content-type':'application/json'}}),nativeClone=response.clone.bind(response);response.clone=()=>{const clone=nativeClone();observed();return clone;};
  const transport=createWorkspaceRequestLifecycle(async()=>'synthetic-session',{journal,fetchImpl:async()=>response});
  try{
   const request=mode==='oversized'?requestWorkspace(transport.request,'',scheduleRecoveryOptions()):transport.request(endpoint,{...scheduleRecoveryOptions(),requestTimeoutMs:mode==='deadline'?1000:20000},()=>{consumeCalls++;throw scheduleRecoveryError();});
   const rejection=assert.rejects(request,error=>mode==='oversized'?error.scheduleRevisionRejected===true:error.name==='AbortError');
   await Promise.race([cloned,rejection.then(()=>{throw new Error('Synthetic clone was not observed before request completion');})]);if(mode==='abort')transport.abort();await rejection;
   if(mode!=='oversized'){assert.equal(consumeCalls,0);await Promise.race([cancelled,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Synthetic body was not cancelled')),1000))]);}
   assert.equal(JSON.stringify([...storage.rows]),before,mode);await assert.rejects(journal.prepare(endpoint,scheduleRecoveryOptions({operationId:scheduleFreshId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
  }finally{transport.abort();}
 }
});
