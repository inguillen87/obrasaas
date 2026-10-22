import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult,validateWorkspaceRecoveryStoredEntry,WORKSPACE_RECOVERY_PREFIX,wasCompanyPhoneRevisionRejected} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const scope='a'.repeat(64),other='b'.repeat(64),operationId='01234567-89ab-4cde-8fab-0123456789ab';
const secondId='01234567-89ab-4cde-8fab-0123456789ac';
function storage(seed=[]) {const rows=new Map(seed);return {get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const command=(extra={})=>({method:'POST',body:JSON.stringify({operationId,scope,projectId:'p-a',reason:'Private medical text',front:'data:image/png;base64,secret',location:{lat:12},pin:'123456',token:'private-token',...extra})});
const journal=s=>createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456});

test('own-number creation retains a null connection reference without private setup fields and blocks another channel write',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-channel',command({action:'CONNECT_OWN_NUMBER',payload:{connectionId:null,revision:0,wabaId:'778899442',phoneNumberId:'887799443',confirmOwnBusiness:true,securityPin:'654321'}}));
 assert.equal(ticket.entry.connectionId,null);assert.equal(ticket.entry.action,'CONNECT_OWN_NUMBER');
 const persisted=JSON.stringify([...s.rows]);for(const value of ['887799443','778899442','654321','wabaId','securityPin','Private medical'])assert.equal(persisted.includes(value),false,value);
 const fresh=journal(storage(s.rows));assert.equal((await fresh.list(scope))[0].connectionId,null);
 await assert.rejects(j.prepare('/api/identity/company-channel',command({operationId:secondId,projectId:'p-b',action:'PREPARE',payload:{connectionId:'legacy-channel'}})),error=>error.code==='WORKSPACE_RECOVERY_REQUIRED');
 await assert.rejects(j.prepare('/api/identity/company-channel',command({operationId:secondId,action:'ACTIVATE_OWN_NUMBER',payload:{connectionId:null}})),error=>error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
});

test('own-number provider uncertainty survives reload and readonly inspection until the exact terminal receipt',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-channel',command({action:'ACTIVATE_OWN_NUMBER',payload:{connectionId:'own-channel'}}));
 const base={organization:{id:'org-a',name:'Synthetic company'},actor:{id:'actor-a',role:'ADMIN'},scope,projectId:'p-a',operationId,action:'ACTIVATE_OWN_NUMBER',receiptId:'company_own_'+'c'.repeat(64),replayed:false,channel:{id:'own-channel',anchorProjectId:'p-a',revision:2,mode:'PREPARED',displayPhoneNumber:'+541100000000',connectionStatus:'PENDING',enabled:false},accepted:false,roundTrip:'NOT_VERIFIED'};
 for(const state of ['VERIFYING','PROVIDER_STARTED','PROVIDER_UNKNOWN']){
  const pending={...base,state,saved:false,definitive:false};assert.deepEqual(recoveryResult(ticket.entry,pending),{state});await j.settle(ticket,pending);assert.equal((await j.list(scope)).length,1);
 }
 const current=journal(storage(s.rows)),entry=(await current.list(scope))[0],query=recoveryQuery(entry);
 await current.observe(query,{...base,state:'PROVIDER_UNKNOWN',saved:false,definitive:false,providerObservation:{registered:true,subscribed:true,readOnly:true},recovery:'EXPLICIT_REVIEW_REQUIRED'});assert.equal((await current.list(scope)).length,1);
 const terminal={...base,state:'RECORDED',saved:true,definitive:true,channel:{...base.channel,connectionStatus:'CONNECTED',enabled:true}};
 assert.equal(recoveryResult(entry,{...terminal,scope:other}),null);assert.equal(recoveryResult(entry,{...terminal,operationId:secondId}),null);assert.equal(recoveryResult(entry,{...terminal,channel:{...terminal.channel,id:'foreign-channel'}}),null);
 await current.observe(query,terminal);assert.equal((await current.list(scope)).length,0);
});

test('stores only receipt references before dispatch, survives a new page instance and never stores private bodies',async()=>{
 const s=storage(),j=journal(s);let calls=0;
 const transport=createWorkspaceRequestLifecycle(async()=>'private-jwt',{journal:j,fetchImpl:async(url)=>{calls++;assert.equal((await j.list(scope)).length,1);assert.equal(url,'/api/identity/participants');throw new TypeError('Lost ack');}});
 await assert.rejects(transport.request('/api/identity/participants',command()),TypeError);
 assert.equal(calls,1);const fresh=journal(storage(s.rows));assert.equal((await fresh.list(scope)).length,1);
 const persisted=JSON.stringify([...s.rows]);for(const word of ['Private medical','private-jwt','private-token','123456"','base64','location','front','pin'])assert.equal(persisted.includes(word),false,word);
 assert.deepEqual(Object.keys((await fresh.list(scope))[0]).sort(),['createdAt','operationId','projectId','resource','scope','version']);transport.abort();
});
test('known confirmed save removes only the exact receipt and a fresh GET retrieves a committed result without another POST',async()=>{
 const s=storage(),j=journal(s);(await j.prepare('/api/identity/workspace',command()));(await j.prepare('/api/identity/task-creation',command({operationId:secondId})));
 const entry=(await j.list(scope)).find(row=>row.resource==='workspace');let calls=0;
 const transport=createWorkspaceRequestLifecycle(async()=>'current-token',{journal:j,fetchImpl:async(url,options)=>{calls++;assert.equal(options.method||'GET','GET');assert.equal(url,recoveryQuery(entry));return Response.json({scope,state:'RECORDED',saved:true,receipt:{id:'confirmed-a'},task:{id:'task-a'}});}});
 const result=await transport.request(recoveryQuery(entry));assert.equal(result.state,'RECORDED');assert.equal(calls,1);assert.equal((await j.list(scope)).length,1);assert.equal((await j.list(scope))[0].resource,'task-creation');transport.abort();
});
test('same UUID retry that never dispatches cannot erase the earlier uncertain operation',async()=>{
 const s=storage(),j=journal(s);(await j.prepare('/api/identity/task-creation',command()));let calls=0;
 const transport=createWorkspaceRequestLifecycle(async()=>null,{journal:j,fetchImpl:async()=>{calls++;}});
 await assert.rejects(transport.request('/api/identity/task-creation',command()),error=>error.requestDispatched===false);
 assert.equal((await j.list(scope)).length,1);assert.equal(calls,0);transport.abort();
});
test('a new operation with no active token does not leave a falsely uncertain entry',async()=>{
 const s=storage(),j=journal(s);let calls=0;const transport=createWorkspaceRequestLifecycle(async()=>null,{journal:j,fetchImpl:async()=>{calls++;}});
 await assert.rejects(transport.request('/api/identity/task-creation',command()),error=>error.requestDispatched===false);
 assert.equal((await j.list(scope)).length,0);assert.equal(calls,0);transport.abort();
});
test('NOT_OBSERVED, processing, invitation uncertainty and denied receipt reads never discard the original reference',async()=>{
 const s=storage(),j=journal(s),ticket=(await j.prepare('/api/identity/field-media',command()));
 for(const state of ['NOT_OBSERVED','PROCESSING']){(await j.observe(recoveryQuery(ticket.entry),{scope,state,definitive:false}));assert.equal((await j.list(scope)).length,1);}
 const transport=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>Response.json({code:'WORKSPACE_CONTEXT_CHANGED'},{status:409})});
 await assert.rejects(transport.request(recoveryQuery(ticket.entry),{},async response=>{throw Object.assign(new Error('Access changed'),{status:response.status});}));
 assert.equal((await j.list(scope)).length,1);transport.abort();
});
test('no expiration or scope migration hides an unresolved write',async()=>{
 const s=storage(),j=journal(s);(await j.prepare('/api/identity/site-purchases',command()));
 assert.equal((await createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456+30*86400000}).list(scope)).length,1);
 assert.equal((await j.list(other)).length,0);(await j.observe('/api/identity/site-purchases?'+new URLSearchParams({scope:other,projectId:'p-a',operationId}),{scope:other,state:'RECORDED',saved:true,receiptId:'other'}));assert.equal((await j.list(scope)).length,1);
});
test('photo and multipart evidence references retain only the identifiers required by canonical status queries',async()=>{
 const s=storage(),j=journal(s),photo=(await j.prepare('/api/identity/site-photo',command({reportId:'report-a',image:'private-photo'})));
 assert.equal(new URL(recoveryQuery(photo.entry),'https://obrasaas.com').searchParams.get('reportId'),'report-a');
 const body=new FormData();for(const [key,value] of Object.entries({scope,projectId:'p-a',operationId:secondId,workerId:'worker-a',caption:'Private caption'}))body.append(key,value);body.append('file',new Blob(['private-video']),'private.mp4');
 const media=(await j.prepare('/api/identity/field-media',{method:'POST',body}));assert.deepEqual(Object.keys(media.entry).sort(),['createdAt','operationId','projectId','resource','scope','version']);
});
test('full or unavailable storage prevents the first POST without discarding earlier pending references',async()=>{
 const s=storage();s.setItem=()=>{throw new Error('Quota');};const j=journal(s);let calls=0;const transport=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>{calls++;}});
 await assert.rejects(transport.request('/api/identity/site-purchases',command()),error=>error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'&&error.requestDispatched===false);assert.equal(calls,0);transport.abort();
});
test('tampered metadata cannot redirect a receipt query, retain private fields or cross project confirmation',async()=>{
 const s=storage(),j=journal(s),ticket=(await j.prepare('/api/identity/workspace',command()));
 assert.equal(recoveryResult(ticket.entry,{scope,projectId:'p-b',state:'RECORDED',saved:true,receiptId:'foreign'}),null);
 assert.throws(()=>recoveryQuery({...ticket.entry,resource:'https://attacker.test'}),TypeError);
 const key=s.key(0);s.setItem(key,JSON.stringify({...ticket.entry,body:'private'}));(await assert.rejects(async()=>(await j.list(scope)),error=>error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'));
});
test('a second UUID is blocked until the earlier receipt is confirmed, while the same UUID remains available for explicit in-panel recovery',async()=>{
 const j=journal(storage()),first=(await j.prepare('/api/identity/task-creation',command()));
 (await assert.rejects(async()=>(await j.prepare('/api/identity/task-creation',command({operationId:secondId}))),error=>error.code==='WORKSPACE_RECOVERY_REQUIRED'&&error.requestDispatched===false));
 assert.equal((await j.prepare('/api/identity/task-creation',command())).existed,true);
 (await j.observe(recoveryQuery(first.entry),{scope,state:'RECORDED',created:true,receiptId:'task-receipt'}));assert.equal((await j.prepare('/api/identity/task-creation',command({operationId:secondId}))).existed,false);
});
test('Meta snapshot HTTP success never substitutes for an exact review receipt or an explicitly observed event status',async()=>{
 const j=journal(storage()),ticket=(await j.prepare('/api/identity/meta-onboarding',command({action:'review_inbox',eventId:'event-a'})));
 (await j.settle(ticket,{scope,projectId:'p-a',saved:true}));assert.equal((await j.list(scope)).length,1);
 const snapshot={scope,projectId:'p-a',receipt:{action:'review_inbox',eventId:'event-a',operationId,state:'RECORDED',actorOperationVerified:true,receiptId:'review-a'}};
 assert.equal(recoveryResult(ticket.entry,{...snapshot,receipt:{...snapshot.receipt,operationId:secondId}}),null);
 (await j.observe(recoveryQuery(ticket.entry),snapshot));assert.equal((await j.list(scope)).length,0);
 const event=(await j.prepare('/api/identity/meta-onboarding',command({action:'process_inbox',eventId:'event-b'})));
 assert.deepEqual(recoveryResult(event.entry,{scope,receipt:{action:'process_inbox',eventId:'event-b',operationId,state:'EVENT_PROCESSED',eventStatus:'PROCESSED',actorOperationVerified:false,businessReceiptId:'canonical-field-receipt'}}),{state:'EVENT_PROCESSED',receiptId:'canonical-field-receipt'});
});
test('post-dispatch body cancellation conserves its reference after the panel unmounts',async()=>{
 const j=journal(storage());let entered;const ready=new Promise(resolve=>{entered=resolve;});
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>Response.json({saved:true})});
 const pending=lifecycle.request('/api/identity/site-purchases',command(),()=>{entered();return new Promise(()=>{});});await ready;lifecycle.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal((await j.list(scope)).length,1);
});
test('canonical invitation reconciliation and an explicit revocation are not blocked by the original uncertain invitation',async()=>{
 const j=journal(storage()),original=(await j.prepare('/api/identity/participants',command({action:'INVITE'})));
 assert.equal((await j.prepare('/api/identity/participants',command({action:'RECOVER_INVITATION',operationId:secondId}))),null);
 const revoke=(await j.prepare('/api/identity/participants',command({action:'REVOKE',operationId:secondId})));assert.equal((await j.list(scope)).length,2);
 (await j.settle(revoke,{scope,saved:true,receiptId:'revocation-receipt'}));assert.equal((await j.list(scope)).length,1);
 const observed={scope,state:'INVITATION_UNCONFIRMED',definitive:false,participant:{status:'REVOKED'}};
 assert.deepEqual(recoveryResult(original.entry,observed),{state:'PARTICIPATION_REVOKED'});(await j.observe(recoveryQuery(original.entry),observed));assert.equal((await j.list(scope)).length,0);
});
test('storage read failures are reported as no dispatch instead of falsely claiming a lost command',async()=>{
 const s=storage(),j=journal(s);(await j.prepare('/api/identity/task-creation',command()));s.getItem=()=>{throw new Error('Blocked storage');};let sent=0;
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>{sent++;}});
 await assert.rejects(lifecycle.request('/api/identity/task-creation',command({operationId:secondId})),error=>error.requestDispatched===false&&error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');assert.equal(sent,0);lifecycle.abort();
});
test('shared reservation serializes two tabs before either can dispatch a new UUID',async()=>{
 const s=storage();let queue=Promise.resolve();
 const withLock=(_name,_signal,reserve)=>{const task=queue.then(reserve);queue=task.catch(()=>{});return task;};
 const a=createWorkspaceRecoveryJournal({getStorage:()=>s,withLock}),b=createWorkspaceRecoveryJournal({getStorage:()=>s,withLock});
 const results=await Promise.allSettled([a.prepare('/api/identity/task-creation',command()),b.prepare('/api/identity/task-creation',command({operationId:secondId}))]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.find(row=>row.status==='rejected').reason.code,'WORKSPACE_RECOVERY_REQUIRED');assert.equal((await a.list(scope)).length,1);
});
test('a panel unmounted while awaiting the reservation lock never stores a reference or obtains a token',async()=>{
 const s=storage();let release,tokens=0,sent=0;
 const withLock=(_name,signal,reserve)=>new Promise((resolve,reject)=>{release=()=>{if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}resolve(reserve());};});
 const j=createWorkspaceRecoveryJournal({getStorage:()=>s,withLock});const lifecycle=createWorkspaceRequestLifecycle(async()=>{tokens++;return 'private';},{journal:j,fetchImpl:async()=>{sent++;}});
 const pending=lifecycle.request('/api/identity/task-creation',command());await new Promise(resolve=>setImmediate(resolve));lifecycle.abort();release();
 await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===false);assert.equal((await j.list(scope)).length,0);assert.equal(tokens,0);assert.equal(sent,0);
});
test('template uncertainty survives restart and forbids a fresh UUID without storing recipient or message',async()=>{
 const s=storage(),j=journal(s),ticket=(await j.prepare('/api/identity/template-send',command({workerId:'worker-private',templateKey:'open_attendance_reminder'})));
 const receipt={id:'outbound-a',operationId,workerId:'worker-private',templateKey:'open_attendance_reminder'};
 const value={scope,projectId:'p-a',state:'SEND_UNKNOWN',receipt,saved:false,definitive:false,providerAccepted:false,deliveryConfirmed:false};
 (await j.settle(ticket,value));assert.equal((await j.list(scope)).length,1);(await j.observe(recoveryQuery(ticket.entry),value));assert.equal((await journal(storage(s.rows)).list(scope)).length,1);
 (await assert.rejects(async()=>(await j.prepare('/api/identity/template-send',command({operationId:secondId}))),{code:'WORKSPACE_RECOVERY_REQUIRED'}));
 assert.equal(JSON.stringify([...s.rows]).includes('worker-private'),false);assert.equal(JSON.stringify([...s.rows]).includes('Private medical'),false);
});
test('only exact terminal template outcomes clear the pending reference, with no claim of delivery',async()=>{
 for(const state of ['ACCEPTED','REJECTED','STATUS_OBSERVED']){
  const j=journal(storage()),ticket=(await j.prepare('/api/identity/template-send',command())),receipt={id:'outbound-a',operationId,workerId:'worker-a',templateKey:'open_attendance_reminder'};
  const value={scope,projectId:'p-a',receipt,state,definitive:true,saved:state!=='REJECTED',providerAccepted:state!=='REJECTED',providerStatus:state==='STATUS_OBSERVED'?'sent':null,deliveryConfirmed:false};
  (await j.observe(recoveryQuery(ticket.entry),{...value,receipt:{...receipt,operationId:secondId}}));assert.equal((await j.list(scope)).length,1);
  if(state==='ACCEPTED'){(await j.observe(recoveryQuery(ticket.entry),{...value,deliveryConfirmed:true}));assert.equal((await j.list(scope)).length,1);}
  (await j.observe(recoveryQuery(ticket.entry),value));assert.equal((await j.list(scope)).length,0);
 }
});
test('worker consent and unlink receipts survive lost response without storing challenge code',async()=>{
 const s=storage(),j=journal(s),ticket=(await j.prepare('/api/identity/worker-channel',command({action:'GRANT_TEMPLATE_MESSAGES',payload:{workerId:'worker-private',revision:'private-version',noticeSha256:'private-notice',confirmed:true}})));
 assert.match(recoveryQuery(ticket.entry),/worker-channel\?/);(await j.settle(ticket,null,Object.assign(new Error('Lost ACK'),{requestDispatched:true})));assert.equal((await j.list(scope)).length,1);
 (await j.observe(recoveryQuery(ticket.entry),{scope,projectId:'p-a',state:'RECORDED',saved:true,receiptId:'worker-receipt'}));assert.equal((await j.list(scope)).length,0);
 assert.equal(JSON.stringify([...s.rows]).includes('private-notice'),false);
});

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
// Controlled commit/failure boundaries, not a browser-storage implementation.
// Real IDB migration, isolation and schema behavior are exercised separately.
function transactionalMemory(beforeCommit=async()=>{}) {
 const rows=new Map();let queue=Promise.resolve();
 return {rows,withStorage:(mode,scope,callback,signal)=>{
  const task=queue.then(async()=>{
   if(signal?.aborted)throw new DOMException('Cancelled before transaction','AbortError');
   const staged=storage(rows),result=callback(staged);
   assert.equal(typeof result?.then,'undefined','Journal storage callbacks must remain synchronous');
   if(mode==='readwrite')await beforeCommit({rows,staged:staged.rows,scope,signal});
   if(signal?.aborted)throw new DOMException('Cancelled before commit','AbortError');
   if(mode==='readwrite'){rows.clear();for(const pair of staged.rows)rows.set(...pair);}
   return result;
  });
  queue=task.then(()=>undefined,()=>undefined);return task;
 }};
}
test('legacy validation admits only a minimal exact-key reference and rejects private fields, unknown versions and oversized input',async()=>{
 const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/worker-channel',command());
 const key=s.key(0),raw=s.getItem(key);assert.deepEqual(validateWorkspaceRecoveryStoredEntry(key,raw),ticket.entry);
 for(const [alteredKey,alteredRaw] of [[key+'extra',raw],[key,JSON.stringify({...ticket.entry,scope:other})],[key,JSON.stringify({...ticket.entry,body:'private'})],[key,JSON.stringify({...ticket.entry,version:2})],[key,' '.repeat(2049)],[key,'null'],[key,'{invalid']])assert.throws(()=>validateWorkspaceRecoveryStoredEntry(alteredKey,alteredRaw),error=>error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'&&error.requestDispatched===false);
 assert.ok(key.startsWith(WORKSPACE_RECOVERY_PREFIX));
});
test('the lifecycle cannot acquire a token, notify or POST until the reservation transaction commits',async()=>{
 const entered=deferred(),commit=deferred(),store=transactionalMemory(async({rows,staged})=>{if(staged.size>rows.size){entered.resolve();await commit.promise;}});
 let tokens=0,posts=0,notifications=0;
 const j=createWorkspaceRecoveryJournal({withStorage:store.withStorage,notify:()=>{notifications++;}}),lost=new TypeError('Lost HTTP acknowledgement');
 const lifecycle=createWorkspaceRequestLifecycle(async()=>{tokens++;return 'controlled-current';},{journal:j,fetchImpl:async()=>{posts++;assert.equal(store.rows.size,1);throw lost;}});
 const pending=lifecycle.request('/api/identity/task-creation',command());await entered.promise;
 assert.equal(store.rows.size,0);assert.equal(tokens,0);assert.equal(posts,0);assert.equal(notifications,0);
 commit.resolve();await assert.rejects(pending,error=>error===lost);
 assert.equal(tokens,1);assert.equal(posts,1);assert.equal(notifications,1);assert.equal((await j.list(scope)).length,1);lifecycle.abort();
});
test('a failed reservation commit leaves earlier references intact and blocks token acquisition and HTTP',async()=>{
 const store=transactionalMemory(async()=>{throw new Error('Controlled private commit failure');});
 const previous={version:1,resource:'field-media',scope,projectId:'p-a',operationId:secondId,createdAt:1};
 store.rows.set(WORKSPACE_RECOVERY_PREFIX+scope+'.field-media.'+secondId,JSON.stringify(previous));
 let tokens=0,posts=0,notifications=0;const j=createWorkspaceRecoveryJournal({withStorage:store.withStorage,notify:()=>{notifications++;}});
 const lifecycle=createWorkspaceRequestLifecycle(async()=>{tokens++;return 'controlled';},{journal:j,fetchImpl:async()=>{posts++;}});
 await assert.rejects(lifecycle.request('/api/identity/task-creation',command()),error=>error.requestDispatched===false&&error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'&&!error.message.includes('private commit'));
 assert.deepEqual(await j.list(scope),[previous]);assert.equal(tokens,0);assert.equal(posts,0);assert.equal(notifications,0);lifecycle.abort();
});
test('cancellation before reservation commit cannot persist or dispatch a late command',async()=>{
 const entered=deferred(),commit=deferred(),store=transactionalMemory(async()=>{entered.resolve();await commit.promise;});
 let tokens=0,posts=0,notifications=0;const j=createWorkspaceRecoveryJournal({withStorage:store.withStorage,notify:()=>{notifications++;}});
 const lifecycle=createWorkspaceRequestLifecycle(async()=>{tokens++;return 'controlled';},{journal:j,fetchImpl:async()=>{posts++;}});
 const pending=lifecycle.request('/api/identity/task-creation',command());await entered.promise;lifecycle.abort();commit.resolve();
 await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===false);
 assert.equal(store.rows.size,0);assert.equal(tokens,0);assert.equal(posts,0);assert.equal(notifications,0);
});
test('the reservation lock spans commit and authoritative storage blocks a second tab without reading cached legacy views',async()=>{
 const entered=deferred(),commit=deferred(),store=transactionalMemory(async({rows,staged})=>{if(staged.size>rows.size){entered.resolve();await commit.promise;}});
 let queue=Promise.resolve(),activeLocks=0,lockEntries=0,legacyReads=0;
 const withLock=(_name,_signal,reserve)=>{const task=queue.then(async()=>{activeLocks++;lockEntries++;try{return await reserve();}finally{activeLocks--;}});queue=task.then(()=>undefined,()=>undefined);return task;};
 const options={withStorage:store.withStorage,withLock,getStorage:()=>{legacyReads++;return storage();}},a=createWorkspaceRecoveryJournal(options),b=createWorkspaceRecoveryJournal(options);
 const first=a.prepare('/api/identity/task-creation',command());await entered.promise;
 const second=b.prepare('/api/identity/task-creation',command({operationId:secondId}));
 assert.equal(activeLocks,1);assert.equal(lockEntries,1);assert.equal(store.rows.size,0);
 commit.resolve();const results=await Promise.allSettled([first,second]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.find(row=>row.status==='rejected').reason.code,'WORKSPACE_RECOVERY_REQUIRED');
 assert.equal(activeLocks,0);assert.equal(lockEntries,2);assert.equal(legacyReads,0);assert.equal(store.rows.size,1);
});
test('POST settlement and receipt GET observation wait for the confirmed removal transaction before returning',async()=>{
 for(const method of ['POST','GET']){
  const entered=deferred(),commit=deferred(),store=transactionalMemory(async({rows,staged})=>{if(staged.size<rows.size){entered.resolve();await commit.promise;}});
  let notifications=0,returned=false;const j=createWorkspaceRecoveryJournal({withStorage:store.withStorage,notify:()=>{notifications++;}});
  const ticket=method==='GET'?await j.prepare('/api/identity/task-creation',command()):null;
  const lifecycle=createWorkspaceRequestLifecycle(async()=>'controlled',{journal:j,fetchImpl:async()=>Response.json({scope,state:'RECORDED',created:true,receiptId:'canonical-receipt'})});
  const pending=lifecycle.request(method==='GET'?recoveryQuery(ticket.entry):'/api/identity/task-creation',method==='GET'?{}:command()).then(result=>{returned=true;return result;});
  await entered.promise;assert.equal(store.rows.size,1);assert.equal(returned,false);assert.equal(notifications,1);
  commit.resolve();assert.equal((await pending).receiptId,'canonical-receipt');assert.equal(store.rows.size,0);assert.equal(notifications,2);lifecycle.abort();
 }
});
test('failed cleanup preserves the durable reference and the original unsent session error without claiming rollback',async()=>{
 const store=transactionalMemory(async({rows,staged})=>{if(staged.size<rows.size)throw new Error('Controlled removal commit failure');});
 let posts=0,notifications=0;const j=createWorkspaceRecoveryJournal({withStorage:store.withStorage,notify:()=>{notifications++;}});
 const lifecycle=createWorkspaceRequestLifecycle(async()=>{throw new Error('Controlled SDK failure');},{journal:j,fetchImpl:async()=>{posts++;}});
 await assert.rejects(lifecycle.request('/api/identity/task-creation',command()),error=>error.code==='IDENTITY_PROVIDER_UNAVAILABLE'&&error.status===503&&error.requestDispatched===false&&!error.message.includes('removal'));
 assert.equal(posts,0);assert.equal(notifications,1);assert.equal((await j.list(scope)).length,1);lifecycle.abort();
});

const companyPhoneBody=(extra={})=>command({action:'declare_company_phone',expectedClerkOrganizationId:'org_A',companyPhone:'+12025550123',expectedRevision:1,confirmDeclaration:true,...extra});
const companyPhoneOutcome=(entry,extra={})=>({scope:entry.scope,projectId:entry.projectId,operationId:entry.operationId,action:'declare_company_phone',expectedClerkOrganizationId:'org_A',organizationId:'company-a',state:'RECORDED',saved:true,receipt:{id:'company_phone_'+'a'.repeat(64),savedRevision:2},savedDeclarationIsCurrent:true,currentCompany:{organizationId:'company-a',expectedClerkOrganizationId:'org_A'},...extra});
test('company phone lost ACK reload retains only typed references and blocks another worksite UUID',async()=>{const s=storage(),j=journal(s),runtime=createWorkspaceRequestLifecycle(async()=>'synthetic-private-session',{journal:j,fetchImpl:async()=>{throw new Error('lost ACK');}});await assert.rejects(runtime.request('/api/identity/company-onboarding',companyPhoneBody()));const fresh=journal(storage(s.rows)),entry=(await fresh.list(scope))[0];assert.equal(entry.resource,'company-onboarding');assert.deepEqual(Object.keys(entry).sort(),['action','createdAt','expectedClerkOrganizationId','operationId','projectId','resource','scope','version']);assert.equal(JSON.stringify([...s.rows]).includes('+12025550123'),false);assert.equal((await fresh.list(other)).length,0);await assert.rejects(fresh.prepare('/api/identity/company-onboarding',companyPhoneBody({operationId:secondId,projectId:'p-b'})),{code:'WORKSPACE_RECOVERY_REQUIRED'});assert.equal(new URL('https://obrasaas.com'+recoveryQuery(entry)).searchParams.get('expectedClerkOrganizationId'),'org_A');runtime.abort();});
test('company declaration receipt rejects wrong UUID actor-scope company project and action before settling',async()=>{const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-onboarding',companyPhoneBody()),entry=ticket.entry;for(const patch of [{operationId:secondId},{scope:other},{projectId:'p-b'},{expectedClerkOrganizationId:'org_B'},{action:'create_company'},{receipt:{id:'bad',savedRevision:2}},{currentCompany:{organizationId:'company-other',expectedClerkOrganizationId:'org_A'}}]){const wrong=companyPhoneOutcome(entry,patch);assert.equal(recoveryResult(entry,wrong),null);await j.settle(ticket,wrong);await j.observe(recoveryQuery(entry),wrong);assert.equal((await j.list(scope)).length,1);}await j.observe(recoveryQuery(entry),companyPhoneOutcome(entry));assert.equal((await j.list(scope)).length,0);});
test('dispatched company declaration denial and nondefinitive absence never silently release reference',async()=>{const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-onboarding',companyPhoneBody());await j.settle(ticket,null,Object.assign(new Error('denied'),{status:403}));const absent=companyPhoneOutcome(ticket.entry,{state:'NOT_OBSERVED',saved:false,definitive:false,receipt:undefined});assert.deepEqual(recoveryResult(ticket.entry,absent),{state:'NOT_OBSERVED'});await j.observe(recoveryQuery(ticket.entry),absent);assert.equal((await j.list(scope)).length,1);assert.equal(recoveryResult(ticket.entry,{...absent,definitive:true}),null);});
test('unrelated company query and unknown resource cannot settle or reserve canonical declaration',async()=>{const s=storage(),j=journal(s),ticket=await j.prepare('/api/identity/company-onboarding',companyPhoneBody());await j.observe(recoveryQuery(ticket.entry).replace('org_A','org_B'),companyPhoneOutcome(ticket.entry));assert.equal((await j.list(scope)).length,1);assert.equal(await j.prepare('/api/identity/unknown-company',companyPhoneBody()),null);await assert.rejects(j.prepare('/api/identity/company-onboarding',companyPhoneBody({action:'verify_phone'})),{code:'WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'});});

test('manual Meta correction has exact typed reference and reload GET receipt without provider mutation',async()=>{const s=storage(),j=journal(s),signupId='11234567-89ab-4cde-8fab-0123456789ab',options=command({action:'reconcile',signupId,expectedCompanyPhoneRevision:2,confirmCompanyPhoneRevision:true,companyPhone:'+12025550123'}),ticket=await j.prepare('/api/identity/meta-onboarding',options);assert.equal(ticket.entry.signupId,signupId);assert.equal(JSON.stringify([...s.rows]).includes('12025550123'),false);await j.settle(ticket,null,Object.assign(new Error('denied'),{status:403}));assert.equal((await j.list(scope)).length,1);const entry=(await journal(storage(s.rows)).list(scope))[0],outcome={scope,projectId:'p-a',receipt:{state:'RECORDED',saved:true,action:'reconcile',operationId,signupId,scope,projectId:'p-a',expectedCompanyPhoneRevision:2,receiptId:'meta_company_phone_'+'a'.repeat(64)}};for(const patch of [{operationId:secondId},{signupId:'21234567-89ab-4cde-8fab-0123456789ab'},{action:'register_number'},{scope:other},{projectId:'p-b'}]){const wrong={...outcome,receipt:{...outcome.receipt,...patch}};assert.equal(recoveryResult(entry,wrong),null);await j.observe(recoveryQuery(entry),wrong);assert.equal((await j.list(scope)).length,1);}await j.observe(recoveryQuery(entry),outcome);assert.equal((await j.list(scope)).length,0);});
test('only correlated durable pre-provider rejection releases manual Meta review after denial or reload',async()=>{
 for(const method of ['POST','GET']){const s=storage(),j=journal(s),signupId='11234567-89ab-4cde-8fab-0123456789ab',ticket=await j.prepare('/api/identity/meta-onboarding',command({action:'reconcile',signupId,expectedCompanyPhoneRevision:2,confirmCompanyPhoneRevision:true})),entry=ticket.entry;
 const result={scope,projectId:'p-a',receipt:{action:'reconcile',operationId,signupId,projectId:'p-a',scope,state:'REJECTED',saved:false,definitive:true,receiptId:'meta_company_phone_'+'a'.repeat(64),phase:'BEFORE_PROVIDER',code:'META_CUSTOMER_COMPANY_PHONE_CHANGED',expectedCompanyPhoneRevision:2,observedCompanyPhoneRevision:3,effectiveCompanyPhoneRevision:1}};
 for(const patch of [{state:'NOT_OBSERVED'},{saved:true},{definitive:false},{phase:'AFTER_PROVIDER'},{code:'WORKSPACE_CONTEXT_CHANGED'},{operationId:secondId},{projectId:'p-b'},{scope:other},{signupId:secondId},{observedCompanyPhoneRevision:2},{receiptId:'unverified'},{actorId:'forged'},{effectiveCompanyPhoneRevision:0}]){const wrong={...result,receipt:{...result.receipt,...patch}};assert.equal(recoveryResult(entry,wrong),null);await j.settle(ticket,wrong);await j.observe(recoveryQuery(entry),wrong);assert.equal((await j.list(scope)).length,1);}
 for(const status of [403,409])await j.settle(ticket,null,Object.assign(new Error('ambiguous'),{status}));await j.observe(recoveryQuery(entry),{scope,projectId:'p-a',receipt:{action:'reconcile',operationId,signupId,projectId:'p-a',scope,state:'NOT_OBSERVED',definitive:false}});assert.equal((await j.list(scope)).length,1);
 assert.deepEqual(recoveryResult(entry,result),{state:'REJECTED',receiptId:result.receipt.receiptId});const settled=method==='POST'?j:journal(storage(s.rows));if(method==='POST')await settled.settle(ticket,result);else await settled.observe(recoveryQuery(entry),result);assert.equal((await settled.list(scope)).length,0);assert.ok(!JSON.stringify([...s.rows]).includes('companyPhone'));
 }
});


const attendanceRecoveryOptions=(patch={})=>({method:'POST',body:JSON.stringify({operationId,projectId:'p-a',scope,action:'ATTENDANCE',payload:{workerId:'worker-a',eventType:'CHECK_OUT',expectedEventId:'arrival-a',sectorId:'sector-a',qrToken:'d'.repeat(64),location:{latitude:0,longitude:0,accuracy:5,capturedAt:'2026-10-11T10:00:00.000Z',noticeVersion:'field-location-v1'}},...patch})});
const attendanceRecoveryError=()=>Object.assign(new Error('Actual rejected attendance'),{status:409,code:'ATTENDANCE_REVISION_CHANGED',attendanceRevisionRejected:true});
async function consumeAttendanceRecovery(response){
 const body=await response.json();if(response.ok)return body;
 throw Object.assign(new Error('Observed attendance response'),{status:response.status,code:body?.code,attendanceRevisionRejected:response.status===409&&response.headers.get('content-type')?.includes('application/json')&&body?.saved===false&&!Array.isArray(body)&&Object.keys(body).sort().join('|')==='code|saved'&&body.code==='ATTENDANCE_REVISION_CHANGED'});
}
test('an actual exact attendance rejection after lost ACK releases only that same in-memory retry and permits a reviewed new UUID',async()=>{
 const s=storage(),j=journal(s),history=await j.prepare('/api/identity/field-media',command({projectId:'historical-project',operationId:secondId})),options=attendanceRecoveryOptions();let calls=0;
 const runtime=createWorkspaceRequestLifecycle(async()=>'controlled-participant',{journal:j,fetchImpl:async(_url,input)=>{calls++;assert.equal(input.body,options.body);if(calls===1)throw new TypeError('Controlled lost response');return Response.json({saved:false,code:'ATTENDANCE_REVISION_CHANGED'},{status:409});}});
 await assert.rejects(runtime.request('/api/identity/field-operations',options,consumeAttendanceRecovery),TypeError);assert.equal((await j.list(scope)).length,2);
 const persisted=JSON.stringify([...s.rows]);for(const text of ['worker-a','arrival-a','sector-a','dddddddd','latitude','capturedAt'])assert.equal(persisted.includes(text),false,text);
 await assert.rejects(runtime.request('/api/identity/field-operations',options,consumeAttendanceRecovery),error=>error.attendanceRevisionRejected===true);assert.equal(calls,2);assert.deepEqual(await j.list(scope),[history.entry]);
 const revised=JSON.parse(options.body);revised.operationId='01234567-89ab-4cde-8fab-0123456789ad';revised.payload.expectedEventId='return-a';const next=await j.prepare('/api/identity/field-operations',{method:'POST',body:JSON.stringify(revised)});assert.equal(next.existed,false);assert.notEqual(next.entry.operationId,operationId);assert.deepEqual((await j.list(scope)).find(row=>row.operationId===history.entry.operationId),history.entry);runtime.abort();
});
test('attendance cannot release an uncertain historical reference from an invented error, a changed command or another HTTP response',async()=>{
 for(const mode of ['invented','changed-command','wrong-code','wrong-shape','wrong-status','wrong-content-type','oversized','reloaded']){
  const s=storage(),j=journal(s),options=attendanceRecoveryOptions(),original=await j.prepare('/api/identity/field-operations',options);await j.settle(original,null,new TypeError('Controlled uncertainty'));const current=mode==='reloaded'?journal(storage(s.rows)):j;
  const changed=JSON.parse(options.body);if(mode==='changed-command')changed.payload.expectedEventId='other-arrival';const attempted=mode==='changed-command'?{method:'POST',body:JSON.stringify(changed)}:options,ticket=await current.prepare('/api/identity/field-operations',attempted);assert.equal(ticket.existed,true);
  if(mode!=='invented'){
   const text=mode==='oversized'?JSON.stringify({saved:false,code:'ATTENDANCE_REVISION_CHANGED',padding:'x'.repeat(5000)}):JSON.stringify(mode==='wrong-shape'?{saved:false,code:'ATTENDANCE_REVISION_CHANGED',receiptId:'invented'}:{saved:false,code:mode==='wrong-code'?'FIELD_REVISION_CHANGED':'ATTENDANCE_REVISION_CHANGED'});
   await current.captureResponse(ticket,'/api/identity/field-operations',attempted,new Response(text,{status:mode==='wrong-status'?500:409,headers:{'content-type':mode==='wrong-content-type'?'text/html':'application/json'}}));
  }
  await current.settle(ticket,null,attendanceRecoveryError());assert.equal((await current.list(scope)).length,1,mode);await assert.rejects(current.prepare('/api/identity/field-operations',attendanceRecoveryOptions({operationId:secondId})),error=>error.code==='WORKSPACE_RECOVERY_REQUIRED',mode);
 }
});
test('attendance rejection must belong to its active response capture and cannot survive cancellation or settle a sibling ticket',async()=>{
 for(const mode of ['inactive','aborted','wrong-ticket']){
  const s=storage(),j=journal(s),options=attendanceRecoveryOptions(),original=await j.prepare('/api/identity/field-operations',options);await j.settle(original,null,new TypeError('Controlled uncertainty'));const ticket=await j.prepare('/api/identity/field-operations',options),controller=new AbortController();if(mode==='aborted')controller.abort();
  await j.captureResponse(ticket,'/api/identity/field-operations',options,Response.json({saved:false,code:'ATTENDANCE_REVISION_CHANGED'},{status:409}),{signal:controller.signal,isActive:()=>mode!=='inactive'});
  const settled=mode==='wrong-ticket'?await j.prepare('/api/identity/field-operations',options):ticket;await j.settle(settled,null,attendanceRecoveryError());assert.equal((await j.list(scope)).length,1,mode);
 }
});

// Separate from companyPhoneBody: the older helper deliberately carries extra
// private fields and must not acquire canonical-response rejection authority.
const phone409Url='/api/identity/company-onboarding';
const phone409Options=(patch={})=>({method:'POST',body:JSON.stringify({action:'declare_company_phone',operationId,projectId:'p-a',scope,expectedClerkOrganizationId:'org_A',companyPhone:'+12025550123',expectedRevision:1,confirmDeclaration:true,...patch})});
const phone409Error=()=>Object.assign(new Error('Observed company phone conflict'),{status:409,code:'COMPANY_PHONE_CONFLICT'});
const phone409Response=()=>Response.json({created:false,code:'COMPANY_PHONE_CONFLICT'},{status:409});
const phone409Observation=()=>({signal:new AbortController().signal,isActive:()=>true});
async function consumePhone409(response){const body=await response.json();if(response.ok)return body;throw Object.assign(new Error('Actual company phone response'),{status:response.status,code:body?.code});}

test('a current canonical company phone POST conflict releases only its new ticket and permits a reviewed new UUID',async()=>{
 const s=storage(),j=journal(s),history=await j.prepare('/api/identity/field-media',command({operationId:secondId,projectId:'historical-project'})),otherCompany=await j.prepare(phone409Url,phone409Options({scope:other,projectId:'other-project',expectedClerkOrganizationId:'org_B',operationId:secondId})),options=phone409Options();let calls=0,observed;
 const preserved=[...s.rows],runtime=createWorkspaceRequestLifecycle(async()=>'controlled-current-company',{journal:j,fetchImpl:async(url,input)=>{calls++;assert.equal(url,phone409Url);assert.equal(input.body,options.body);const pending=(await j.list(scope)).find(entry=>entry.resource==='company-onboarding');assert.deepEqual(Object.keys(pending).sort(),['action','createdAt','expectedClerkOrganizationId','operationId','projectId','resource','scope','version']);for(const text of ['12025550123','inputDigest','expectedRevision','controlled-current-company'])assert.equal(JSON.stringify([...s.rows]).includes(text),false,text);return phone409Response();}});
 await assert.rejects(runtime.request(phone409Url,options,consumePhone409),error=>{observed=error;return error.status===409&&error.code==='COMPANY_PHONE_CONFLICT';});
 assert.equal(await wasCompanyPhoneRevisionRejected(observed,phone409Url,options),true);assert.equal(await wasCompanyPhoneRevisionRejected(observed,phone409Url,phone409Options({companyPhone:'+12025550124'})),false);assert.equal(calls,1);assert.deepEqual([...s.rows],preserved);assert.deepEqual(await j.list(scope),[history.entry]);assert.deepEqual(await j.list(other),[otherCompany.entry]);
 const revised=phone409Options({operationId:'01234567-89ab-4cde-8fab-0123456789ad',expectedRevision:2}),next=await j.prepare(phone409Url,revised);assert.equal(next.existed,false);assert.notEqual(next.entry.operationId,operationId);assert.equal(await wasCompanyPhoneRevisionRejected(observed,phone409Url,revised),false);assert.equal(calls,1);runtime.abort();
});

test('company phone requires exact observed HTTP shape status MIME endpoint and the complete current command digest',async()=>{
 const modes=['invented-error','consumer-flag','code-only','created-true','saved-shape','extra-key','array','incomplete','invalid-utf8','oversized','wrong-code','status-401','status-403','status-503','wrong-mime','misleading-mime','redirected','response-url','response-origin','no-signal','no-active','wrong-endpoint','query','GET','action','scope','project','uuid','clerk-org','revision','phone','confirm','extra-command'];
 for(const mode of modes){
  const s=storage(),j=journal(s),options=phone409Options(),ticket=await j.prepare(phone409Url,options),before=[...s.rows],changed=JSON.parse(options.body);let url=phone409Url,input=options;
  const patches={action:{action:'create_company'},scope:{scope:other},project:{projectId:'p-b'},uuid:{operationId:secondId},'clerk-org':{expectedClerkOrganizationId:'org_B'},revision:{expectedRevision:2},phone:{companyPhone:'+12025550124'},confirm:{confirmDeclaration:false},'extra-command':{extra:'not-canonical'}};
  if(patches[mode]){Object.assign(changed,patches[mode]);input={method:'POST',body:JSON.stringify(changed)};}if(mode==='wrong-endpoint')url='/api/identity/whatsapp-setup';if(mode==='query')url+='?scope='+scope;if(mode==='GET')input={...options,method:'GET'};
  if(!['invented-error','consumer-flag'].includes(mode)){
   let value={created:false,code:'COMPANY_PHONE_CONFLICT'};if(mode==='code-only')value={code:value.code};if(mode==='created-true')value.created=true;if(mode==='saved-shape')value={saved:false,code:value.code};if(mode==='extra-key')value.receiptId='invented';if(mode==='array')value=[value];if(mode==='wrong-code')value.code='COMPANY_PHONE_OPERATION_CONFLICT';
   const text=mode==='incomplete'?'{"created":false':mode==='invalid-utf8'?new Uint8Array([0xff]):mode==='oversized'?' '.repeat(4097)+JSON.stringify(value):JSON.stringify(value),status=mode.startsWith('status-')?Number(mode.slice(7)):409;
   const response=new Response(text,{status,headers:{'content-type':mode==='wrong-mime'?'text/html':mode==='misleading-mime'?'text/html; application/json':'application/json'}}),observation=phone409Observation();if(mode==='redirected')Object.defineProperty(response,'redirected',{value:true});if(mode==='response-url'||mode==='response-origin')Object.defineProperty(response,'url',{value:mode==='response-origin'?'https://other.invalid/api/identity/company-onboarding':'https://obrasaas.com/api/identity/whatsapp-setup'});if(mode==='no-signal')delete observation.signal;if(mode==='no-active')delete observation.isActive;await j.captureResponse(ticket,url,input,response,observation);
  }
  const error=phone409Error();if(mode==='consumer-flag')error.companyPhoneRevisionRejected=true;await j.settle(ticket,null,error);assert.equal(await wasCompanyPhoneRevisionRejected(error,phone409Url,options),false,mode);assert.deepEqual([...s.rows],before,mode);await assert.rejects(j.prepare(phone409Url,phone409Options({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'},mode);
 }
 const s=storage(),j=journal(s),legacy=companyPhoneBody(),ticket=await j.prepare(phone409Url,legacy),before=[...s.rows],error=phone409Error();await j.captureResponse(ticket,phone409Url,legacy,phone409Response(),phone409Observation());await j.settle(ticket,null,error);assert.deepEqual([...s.rows],before);assert.equal(await wasCompanyPhoneRevisionRejected(error,phone409Url,legacy),false);
});

test('a company phone conflict cannot settle another ticket a changed durable entry or an inactive observation',async()=>{
 for(const mode of ['foreign-ticket','changed-entry','inactive-before','inactive-after','aborted-before','aborted-after','repeat-settle','cleanup-failed']){
  const s=storage(),j=journal(s),options=phone409Options(),ticket=await j.prepare(phone409Url,options),controller=new AbortController();let active=mode!=='inactive-before';if(mode==='aborted-before')controller.abort();
  if(mode==='changed-entry'){const key=s.key(0);s.setItem(key,JSON.stringify({...ticket.entry,expectedClerkOrganizationId:'org_B'}));}const before=[...s.rows];
  await j.captureResponse(ticket,phone409Url,options,phone409Response(),{signal:controller.signal,isActive:()=>active});if(mode==='inactive-after')active=false;if(mode==='aborted-after')controller.abort();
  const settled=mode==='foreign-ticket'?{entry:{...ticket.entry},existed:false}:ticket,error=phone409Error();if(mode==='repeat-settle')await j.settle(ticket,null,new TypeError('Earlier uncertain consumption'));if(mode==='cleanup-failed')s.removeItem=()=>{throw new Error('Controlled cleanup failure');};
  await j.settle(settled,null,error);assert.equal(await wasCompanyPhoneRevisionRejected(error,phone409Url,options),false,mode);assert.deepEqual([...s.rows],before,mode);
 }
});

test('an older company phone uncertainty survives a later exact POST conflict and every absent denied or failed GET',async()=>{
 for(const mode of ['lost-response','status-401','status-403','status-503','reload']){
  const s=storage(),j=journal(s),options=phone409Options();let calls=0,original;
  const first=createWorkspaceRequestLifecycle(async()=>'controlled',{journal:j,fetchImpl:async()=>{calls++;if(['lost-response','reload'].includes(mode))throw new TypeError('Controlled lost response');return Response.json({created:false,code:'COMPANY_PHONE_CONFLICT'},{status:Number(mode.slice(7))});}});
  await assert.rejects(first.request(phone409Url,options,consumePhone409),error=>{original=error;return true;});assert.equal(await wasCompanyPhoneRevisionRejected(original,phone409Url,options),false,mode);const before=[...s.rows];first.abort();
  const current=mode==='reload'?journal(storage(s.rows)):j,runtime=createWorkspaceRequestLifecycle(async()=>'controlled',{journal:current,fetchImpl:async()=>{calls++;return phone409Response();}});let retried;
  await assert.rejects(runtime.request(phone409Url,options,consumePhone409),error=>{retried=error;return error.status===409;});assert.equal(await wasCompanyPhoneRevisionRejected(retried,phone409Url,options),false,mode);assert.equal(calls,2);assert.deepEqual(await current.list(scope),await j.list(scope));assert.deepEqual([...s.rows],before,mode);runtime.abort();
 }
 for(const status of [200,401,403,409,503]){
  const s=storage(),j=journal(s),ticket=await j.prepare(phone409Url,phone409Options()),before=[...s.rows],absent=companyPhoneOutcome(ticket.entry,{state:'NOT_OBSERVED',saved:false,definitive:false,receipt:undefined}),runtime=createWorkspaceRequestLifecycle(async()=>'controlled',{journal:j,fetchImpl:async()=>status===200?Response.json(absent):Response.json({created:false,code:'COMPANY_PHONE_CONFLICT'},{status})});
  if(status===200)assert.equal((await runtime.request(recoveryQuery(ticket.entry),{},consumePhone409)).state,'NOT_OBSERVED');else await assert.rejects(runtime.request(recoveryQuery(ticket.entry),{},consumePhone409),error=>error.status===status);assert.deepEqual([...s.rows],before);runtime.abort();
 }
});

test('a hanging company phone rejection body is cancelled on both native branches without consumption or reference removal',async()=>{
 for(const mode of ['abort','deadline']){
  const s=storage(),j=journal(s),options=phone409Options(),entered=deferred(),cancelled=deferred();let cloneCalls=0,cloneCancelled=0,originalCancelled=0,sourceCancelled=0,consumeCalls=0;
  const runtime=createWorkspaceRequestLifecycle(async()=>'controlled',{journal:j,fetchImpl:async()=>{
   const response=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"created":false,"code":"COMPANY_PHONE_CONFLICT"'));},cancel(){sourceCancelled++;cancelled.resolve();}}),{status:409,headers:{'content-type':'application/json'}}),nativeClone=response.clone.bind(response);
   response.clone=()=>{cloneCalls++;const cloned=nativeClone(),nativeCancel=response.body.cancel.bind(response.body),getReader=cloned.body.getReader.bind(cloned.body);response.body.cancel=(...args)=>{originalCancelled++;return nativeCancel(...args);};cloned.body.getReader=()=>{const reader=getReader(),cancel=reader.cancel.bind(reader);reader.cancel=(...args)=>{cloneCancelled++;return cancel(...args);};entered.resolve();return reader;};return cloned;};return response;
  }});
  try{
   const pending=runtime.request(phone409Url,{...options,requestTimeoutMs:mode==='deadline'?1000:20000},response=>{consumeCalls++;return consumePhone409(response);}),rejection=assert.rejects(pending,error=>error.name==='AbortError');await Promise.race([entered.promise,rejection.then(()=>{throw new Error('Native clone was not observed before termination');})]);if(mode==='abort')runtime.abort();await rejection;
   let cancelDeadline;try{await Promise.race([cancelled.promise,new Promise((_,reject)=>{cancelDeadline=setTimeout(()=>reject(new Error('Native response branches were not cancelled')),1000);})]);}finally{clearTimeout(cancelDeadline);}
   assert.equal(cloneCalls,1);assert.ok(cloneCancelled>=1);assert.ok(originalCancelled>=1);assert.equal(sourceCancelled,1);assert.equal(consumeCalls,0);assert.equal((await j.list(scope)).length,1);
  }finally{runtime.abort();}
 }
});

test('cancellation after a complete company phone capture or during removal commit conserves the reference',async()=>{
 for(const phase of ['consume','removal']){
  const entered=deferred(),release=deferred(),store=transactionalMemory(async({rows,staged})=>{if(phase==='removal'&&staged.size<rows.size){entered.resolve();await release.promise;}}),j=createWorkspaceRecoveryJournal({withStorage:store.withStorage}),options=phone409Options();let consumed=0,observed;
  const runtime=createWorkspaceRequestLifecycle(async()=>'controlled',{journal:j,fetchImpl:async()=>phone409Response()}),pending=runtime.request(phone409Url,options,async response=>{consumed++;if(phase==='consume'){entered.resolve();await release.promise;}return consumePhone409(response);});await entered.promise;const before=[...store.rows];runtime.abort();release.resolve();
  await assert.rejects(pending,error=>{observed=error;return phase==='consume'?error.name==='AbortError':error.status===409;});assert.equal(await wasCompanyPhoneRevisionRejected(observed,phone409Url,options),false);assert.equal(consumed,1);assert.deepEqual([...store.rows],before);assert.equal((await j.list(scope)).length,1);
 }
});

const captureQualityUrl='/api/identity/participants';
const captureQualityCode='PARTICIPANT_CAPTURE_SELFIE_QUALITY_SERVICE_UNAVAILABLE';
const captureQualityOptions=(patch={})=>({method:'POST',body:JSON.stringify({operationId,projectId:'p-a',scope,workerId:'worker-quality',revision:'2026-10-22T12:00:00.000001',noticeVersion:'participant-kyc-v1',consent:true,front:'data:image/png;base64,c3ludGhldGljLWZyb250',selfie:'data:image/png;base64,c3ludGhldGljLXNlbGZpZQ==',...patch})});
const captureQualityError=(patch={})=>Object.assign(new Error('Controlled capture quality rejection'),{status:503,code:captureQualityCode,...patch});
const captureQualityResponse=(code=captureQualityCode,status=503)=>Response.json({saved:false,identityCertified:false,code},{status});
const captureQualityObservation=()=>({signal:new AbortController().signal,isActive:()=>true});
async function consumeCaptureQuality(response){const value=await response.json();if(!response.ok)throw Object.assign(new Error('Observed capture response'),{status:response.status,code:value?.code});return value;}

test('an observed pre-storage quality 503 clears only its new capture reference and enables a corrected new UUID',async()=>{
 for(const status of [422,503]){
  const s=storage(),j=journal(s),history=await j.prepare('/api/identity/field-media',command({operationId:secondId,projectId:'historical-project'})),otherTicket=await j.prepare(captureQualityUrl,captureQualityOptions({scope:other,projectId:'other-project',operationId:secondId})),before=[...s.rows],options=captureQualityOptions();let calls=0;
  const runtime=createWorkspaceRequestLifecycle(async()=>'controlled-quality-session',{journal:j,fetchImpl:async(url,input)=>{calls++;assert.equal(url,captureQualityUrl);assert.equal(input.body,options.body);const entry=(await j.list(scope)).find(value=>value.resource==='participants');assert.deepEqual(Object.keys(entry).sort(),['createdAt','operationId','projectId','resource','scope','version']);const persisted=JSON.stringify([...s.rows]);for(const text of ['worker-quality','inputDigest','participant-kyc-v1','consent','front','selfie','c3ludGhldGlj','controlled-quality-session'])assert.equal(persisted.includes(text),false,text);return captureQualityResponse(status===422?'PARTICIPANT_CAPTURE_SELFIE_IMAGE_BLURRED':captureQualityCode,status);}});
  await assert.rejects(runtime.request(captureQualityUrl,options,consumeCaptureQuality),{status,code:status===422?'PARTICIPANT_CAPTURE_SELFIE_IMAGE_BLURRED':captureQualityCode});assert.equal(calls,1);assert.deepEqual([...s.rows],before);assert.deepEqual(await j.list(scope),[history.entry]);assert.deepEqual(await j.list(other),[otherTicket.entry]);
  const next=await j.prepare(captureQualityUrl,captureQualityOptions({operationId:'01234567-89ab-4cde-8fab-0123456789ad',revision:'2026-10-22T12:00:00.000002'}));assert.equal(next.existed,false);runtime.abort();
 }
});

test('capture quality 503 requires an exact actual response and a matching complete current KYC command',async()=>{
 const modes=['no-response','consumer-flags','saved-true','certified','extra-response','array','wrong-code','wrong-kind','truncated','oversized','invalid-utf8','wrong-mime','misleading-mime','redirected','foreign-url','wrong-path','response-query','content-length','no-signal','no-active','status-200','status-401','status-403','status-409','status-500','wrong-endpoint','query','GET','scope','project','uuid','worker','revision','front','selfie','notice','consent','action','extra-command'];
 for(const mode of modes){
  const s=storage(),j=journal(s),options=captureQualityOptions(),ticket=await j.prepare(captureQualityUrl,options),before=[...s.rows];let url=captureQualityUrl,input=options;
  const patches={scope:{scope:other},project:{projectId:'p-b'},uuid:{operationId:secondId},worker:{workerId:'worker-other'},revision:{revision:'2026-10-22T12:00:00.000002'},front:{front:'different-front'},selfie:{selfie:'different-selfie'},notice:{noticeVersion:'old'},consent:{consent:false},action:{action:'SUBMIT_KYC'},'extra-command':{extra:'not-canonical'}};
  if(patches[mode])input=captureQualityOptions(patches[mode]);if(mode==='wrong-endpoint')url='/api/identity/field-media';if(mode==='query')url+='?scope='+scope;if(mode==='GET')input={...input,method:'GET'};
  if(!['no-response','consumer-flags'].includes(mode)){
   let body={saved:false,identityCertified:false,code:captureQualityCode};if(mode==='saved-true')body.saved=true;if(mode==='certified')body.identityCertified=true;if(mode==='extra-response')body.receiptId='invented';if(mode==='array')body=[body];if(mode==='wrong-code')body.code='PARTICIPANT_OPERATION_UNCONFIRMED';if(mode==='wrong-kind')body.code='PARTICIPANT_CAPTURE_OTHER_QUALITY_SERVICE_UNAVAILABLE';
   const bytes=mode==='truncated'?'{"saved":false':mode==='oversized'?' '.repeat(4097)+JSON.stringify(body):mode==='invalid-utf8'?new Uint8Array([0xff]):JSON.stringify(body),status=mode.startsWith('status-')?Number(mode.slice(7)):503;
   const response=new Response(bytes,{status,headers:{'content-type':mode==='wrong-mime'?'text/html':mode==='misleading-mime'?'text/html; application/json':'application/json',...(mode==='content-length'?{'content-length':'5000'}:{})}}),observation=captureQualityObservation();
   if(mode==='redirected')Object.defineProperty(response,'redirected',{value:true});if(['foreign-url','wrong-path','response-query'].includes(mode))Object.defineProperty(response,'url',{value:mode==='foreign-url'?'https://foreign.invalid/api/identity/participants':mode==='wrong-path'?'https://obrasaas.com/api/identity/field-media':'https://obrasaas.com/api/identity/participants?extra=1'});if(mode==='no-signal')delete observation.signal;if(mode==='no-active')delete observation.isActive;
   await j.captureResponse(ticket,url,input,response,observation);
  }
  await j.settle(ticket,null,captureQualityError(mode==='consumer-flags'?{captureQualityRejected:true,precommitRejected:true}:{}));assert.deepEqual([...s.rows],before,mode);await assert.rejects(j.prepare(captureQualityUrl,captureQualityOptions({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'},mode);
 }
});

test('only the newly prepared KYC body shape can acquire capture-quality rejection proof',async()=>{
 for(const patch of [{action:'SUBMIT_KYC'},{front:''},{selfie:null},{workerId:'invalid worker'},{revision:'invalid'},{noticeVersion:'old'},{consent:false},{ocrConsent:true},{biometricConsent:true},{back:'synthetic-back'},{extra:true}]){
  const s=storage(),j=journal(s),options=captureQualityOptions(patch),ticket=await j.prepare(captureQualityUrl,options),before=[...s.rows];await j.captureResponse(ticket,captureQualityUrl,options,captureQualityResponse(),captureQualityObservation());await j.settle(ticket,null,captureQualityError());assert.deepEqual([...s.rows],before,JSON.stringify(patch));
 }
});

test('capture quality proof cannot settle another ticket a changed reference or a changed command after observation',async()=>{
 for(const mode of ['foreign-ticket','changed-entry','changed-command','inactive-before','inactive-after','aborted-before','aborted-after','wrong-error-status','wrong-error-code','network-error','repeat-settle','cleanup-failed']){
  const s=storage(),j=journal(s),options=captureQualityOptions(),ticket=await j.prepare(captureQualityUrl,options),controller=new AbortController();let active=mode!=='inactive-before';if(mode==='aborted-before')controller.abort();if(mode==='changed-entry'){const key=s.key(0);s.setItem(key,JSON.stringify({...ticket.entry,projectId:'other-project'}));}const before=[...s.rows];
  await j.captureResponse(ticket,captureQualityUrl,options,captureQualityResponse(),{signal:controller.signal,isActive:()=>active});if(mode==='changed-command')options.body=captureQualityOptions({front:'replacement-after-observed-response'}).body;if(mode==='inactive-after')active=false;if(mode==='aborted-after')controller.abort();if(mode==='cleanup-failed')s.removeItem=()=>{throw Error('Controlled cleanup failure');};if(mode==='repeat-settle')await j.settle(ticket,null,new TypeError('Earlier uncertain consumption'));
  const error=mode==='network-error'?new TypeError('Uncertain body consumption'):captureQualityError(mode==='wrong-error-status'?{status:500}:mode==='wrong-error-code'?{code:'PARTICIPANT_OPERATION_UNCONFIRMED'}:{});await j.settle(mode==='foreign-ticket'?{entry:{...ticket.entry},existed:false}:ticket,null,error);assert.deepEqual([...s.rows],before,mode);
 }
});

test('an earlier capture uncertainty survives a later quality 503 in the same journal or after reload',async()=>{
 for(const reload of [false,true]){
  const s=storage(),j=journal(s),options=captureQualityOptions(),original=await j.prepare(captureQualityUrl,options);await j.settle(original,null,new TypeError('Lost capture response'));const before=[...s.rows],current=reload?journal(storage(s.rows)):j,ticket=await current.prepare(captureQualityUrl,options);assert.equal(ticket.existed,true);await current.captureResponse(ticket,captureQualityUrl,options,captureQualityResponse(),captureQualityObservation());await current.settle(ticket,null,captureQualityError());assert.deepEqual(await current.list(scope),await j.list(scope));assert.deepEqual([...s.rows],before);await assert.rejects(current.prepare(captureQualityUrl,captureQualityOptions({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 }
});

test('a hanging quality response cancels both branches and preserves the capture reference',async()=>{
 const s=storage(),j=journal(s),options=captureQualityOptions(),ticket=await j.prepare(captureQualityUrl,options),controller=new AbortController(),entered=deferred(),cancelled=deferred();let originalCancelled=0,cloneCancelled=0;
 const response=new Response(new ReadableStream({start(stream){stream.enqueue(new TextEncoder().encode('{"saved":false,"identityCertified":false'));},cancel(){cancelled.resolve();}}),{status:503,headers:{'content-type':'application/json'}}),nativeClone=response.clone.bind(response);
 response.clone=()=>{const clone=nativeClone(),nativeCancel=response.body.cancel.bind(response.body),getReader=clone.body.getReader.bind(clone.body);response.body.cancel=(...args)=>{originalCancelled++;return nativeCancel(...args);};clone.body.getReader=()=>{const reader=getReader(),cancel=reader.cancel.bind(reader);reader.cancel=(...args)=>{cloneCancelled++;return cancel(...args);};entered.resolve();return reader;};return clone;};
 const pending=j.captureResponse(ticket,captureQualityUrl,options,response,{signal:controller.signal,isActive:()=>true});await entered.promise;controller.abort();await pending;let timer;try{await Promise.race([cancelled.promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Quality response branches not cancelled')),1000);})]);}finally{clearTimeout(timer);}
 await j.settle(ticket,null,captureQualityError());assert.ok(originalCancelled>=1);assert.ok(cloneCancelled>=1);assert.equal((await j.list(scope)).length,1);
});
