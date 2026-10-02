import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceRecoveryJournal,recoveryQuery,recoveryResult} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
const scope='a'.repeat(64),other='b'.repeat(64),operationId='01234567-89ab-4cde-8fab-0123456789ab';
const secondId='01234567-89ab-4cde-8fab-0123456789ac';
function storage(seed=[]) {const rows=new Map(seed);return {get length(){return rows.size;},key:index=>[...rows.keys()][index]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key),rows};}
const command=(extra={})=>({method:'POST',body:JSON.stringify({operationId,scope,projectId:'p-a',reason:'Private medical text',front:'data:image/png;base64,secret',location:{lat:12},pin:'123456',token:'private-token',...extra})});
const journal=s=>createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456});

test('stores only receipt references before dispatch, survives a new page instance and never stores private bodies',async()=>{
 const s=storage(),j=journal(s);let calls=0;
 const transport=createWorkspaceRequestLifecycle(async()=>'private-jwt',{journal:j,fetchImpl:async(url)=>{calls++;assert.equal(j.list(scope).length,1);assert.equal(url,'/api/identity/participants');throw new TypeError('Lost ack');}});
 await assert.rejects(transport.request('/api/identity/participants',command()),TypeError);
 assert.equal(calls,1);const fresh=journal(storage(s.rows));assert.equal(fresh.list(scope).length,1);
 const persisted=JSON.stringify([...s.rows]);for(const word of ['Private medical','private-jwt','private-token','123456"','base64','location','front','pin'])assert.equal(persisted.includes(word),false,word);
 assert.deepEqual(Object.keys(fresh.list(scope)[0]).sort(),['createdAt','operationId','projectId','resource','scope','version']);transport.abort();
});
test('known confirmed save removes only the exact receipt and a fresh GET retrieves a committed result without another POST',async()=>{
 const s=storage(),j=journal(s);j.prepare('/api/identity/workspace',command());j.prepare('/api/identity/task-creation',command({operationId:secondId}));
 const entry=j.list(scope).find(row=>row.resource==='workspace');let calls=0;
 const transport=createWorkspaceRequestLifecycle(async()=>'current-token',{journal:j,fetchImpl:async(url,options)=>{calls++;assert.equal(options.method||'GET','GET');assert.equal(url,recoveryQuery(entry));return Response.json({scope,state:'RECORDED',saved:true,receipt:{id:'confirmed-a'},task:{id:'task-a'}});}});
 const result=await transport.request(recoveryQuery(entry));assert.equal(result.state,'RECORDED');assert.equal(calls,1);assert.equal(j.list(scope).length,1);assert.equal(j.list(scope)[0].resource,'task-creation');transport.abort();
});
test('same UUID retry that never dispatches cannot erase the earlier uncertain operation',async()=>{
 const s=storage(),j=journal(s);j.prepare('/api/identity/task-creation',command());let calls=0;
 const transport=createWorkspaceRequestLifecycle(async()=>null,{journal:j,fetchImpl:async()=>{calls++;}});
 await assert.rejects(transport.request('/api/identity/task-creation',command()),error=>error.requestDispatched===false);
 assert.equal(j.list(scope).length,1);assert.equal(calls,0);transport.abort();
});
test('a new operation with no active token does not leave a falsely uncertain entry',async()=>{
 const s=storage(),j=journal(s);let calls=0;const transport=createWorkspaceRequestLifecycle(async()=>null,{journal:j,fetchImpl:async()=>{calls++;}});
 await assert.rejects(transport.request('/api/identity/task-creation',command()),error=>error.requestDispatched===false);
 assert.equal(j.list(scope).length,0);assert.equal(calls,0);transport.abort();
});
test('NOT_OBSERVED, processing, invitation uncertainty and denied receipt reads never discard the original reference',async()=>{
 const s=storage(),j=journal(s),ticket=j.prepare('/api/identity/field-media',command());
 for(const state of ['NOT_OBSERVED','PROCESSING']){j.observe(recoveryQuery(ticket.entry),{scope,state,definitive:false});assert.equal(j.list(scope).length,1);}
 const transport=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>Response.json({code:'WORKSPACE_CONTEXT_CHANGED'},{status:409})});
 await assert.rejects(transport.request(recoveryQuery(ticket.entry),{},async response=>{throw Object.assign(new Error('Access changed'),{status:response.status});}));
 assert.equal(j.list(scope).length,1);transport.abort();
});
test('no expiration or scope migration hides an unresolved write',()=>{
 const s=storage(),j=journal(s);j.prepare('/api/identity/site-purchases',command());
 assert.equal(createWorkspaceRecoveryJournal({getStorage:()=>s,now:()=>123456+30*86400000}).list(scope).length,1);
 assert.equal(j.list(other).length,0);j.observe('/api/identity/site-purchases?'+new URLSearchParams({scope:other,projectId:'p-a',operationId}),{scope:other,state:'RECORDED',saved:true,receiptId:'other'});assert.equal(j.list(scope).length,1);
});
test('photo and multipart evidence references retain only the identifiers required by canonical status queries',()=>{
 const s=storage(),j=journal(s),photo=j.prepare('/api/identity/site-photo',command({reportId:'report-a',image:'private-photo'}));
 assert.equal(new URL(recoveryQuery(photo.entry),'https://obrasaas.com').searchParams.get('reportId'),'report-a');
 const body=new FormData();for(const [key,value] of Object.entries({scope,projectId:'p-a',operationId:secondId,workerId:'worker-a',caption:'Private caption'}))body.append(key,value);body.append('file',new Blob(['private-video']),'private.mp4');
 const media=j.prepare('/api/identity/field-media',{method:'POST',body});assert.deepEqual(Object.keys(media.entry).sort(),['createdAt','operationId','projectId','resource','scope','version']);
});
test('full or unavailable storage prevents the first POST without discarding earlier pending references',async()=>{
 const s=storage();s.setItem=()=>{throw new Error('Quota');};const j=journal(s);let calls=0;const transport=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>{calls++;}});
 await assert.rejects(transport.request('/api/identity/site-purchases',command()),error=>error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE'&&error.requestDispatched===false);assert.equal(calls,0);transport.abort();
});
test('tampered metadata cannot redirect a receipt query, retain private fields or cross project confirmation',()=>{
 const s=storage(),j=journal(s),ticket=j.prepare('/api/identity/workspace',command());
 assert.equal(recoveryResult(ticket.entry,{scope,projectId:'p-b',state:'RECORDED',saved:true,receiptId:'foreign'}),null);
 assert.throws(()=>recoveryQuery({...ticket.entry,resource:'https://attacker.test'}),TypeError);
 const key=s.key(0);s.setItem(key,JSON.stringify({...ticket.entry,body:'private'}));assert.throws(()=>j.list(scope),error=>error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');
});
test('a second UUID is blocked until the earlier receipt is confirmed, while the same UUID remains available for explicit in-panel recovery',()=>{
 const j=journal(storage()),first=j.prepare('/api/identity/task-creation',command());
 assert.throws(()=>j.prepare('/api/identity/task-creation',command({operationId:secondId})),error=>error.code==='WORKSPACE_RECOVERY_REQUIRED'&&error.requestDispatched===false);
 assert.equal(j.prepare('/api/identity/task-creation',command()).existed,true);
 j.observe(recoveryQuery(first.entry),{scope,state:'RECORDED',created:true,receiptId:'task-receipt'});assert.equal(j.prepare('/api/identity/task-creation',command({operationId:secondId})).existed,false);
});
test('Meta snapshot HTTP success never substitutes for an exact review receipt or an explicitly observed event status',()=>{
 const j=journal(storage()),ticket=j.prepare('/api/identity/meta-onboarding',command({action:'review_inbox',eventId:'event-a'}));
 j.settle(ticket,{scope,projectId:'p-a',saved:true});assert.equal(j.list(scope).length,1);
 const snapshot={scope,projectId:'p-a',receipt:{action:'review_inbox',eventId:'event-a',operationId,state:'RECORDED',actorOperationVerified:true,receiptId:'review-a'}};
 assert.equal(recoveryResult(ticket.entry,{...snapshot,receipt:{...snapshot.receipt,operationId:secondId}}),null);
 j.observe(recoveryQuery(ticket.entry),snapshot);assert.equal(j.list(scope).length,0);
 const event=j.prepare('/api/identity/meta-onboarding',command({action:'process_inbox',eventId:'event-b'}));
 assert.deepEqual(recoveryResult(event.entry,{scope,receipt:{action:'process_inbox',eventId:'event-b',operationId,state:'EVENT_PROCESSED',eventStatus:'PROCESSED',actorOperationVerified:false,businessReceiptId:'canonical-field-receipt'}}),{state:'EVENT_PROCESSED',receiptId:'canonical-field-receipt'});
});
test('post-dispatch body cancellation conserves its reference after the panel unmounts',async()=>{
 const j=journal(storage());let entered;const ready=new Promise(resolve=>{entered=resolve;});
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>Response.json({saved:true})});
 const pending=lifecycle.request('/api/identity/site-purchases',command(),()=>{entered();return new Promise(()=>{});});await ready;lifecycle.abort();await assert.rejects(pending,error=>error.name==='AbortError');assert.equal(j.list(scope).length,1);
});
test('canonical invitation reconciliation and an explicit revocation are not blocked by the original uncertain invitation',()=>{
 const j=journal(storage()),original=j.prepare('/api/identity/participants',command({action:'INVITE'}));
 assert.equal(j.prepare('/api/identity/participants',command({action:'RECOVER_INVITATION',operationId:secondId})),null);
 const revoke=j.prepare('/api/identity/participants',command({action:'REVOKE',operationId:secondId}));assert.equal(j.list(scope).length,2);
 j.settle(revoke,{scope,saved:true,receiptId:'revocation-receipt'});assert.equal(j.list(scope).length,1);
 const observed={scope,state:'INVITATION_UNCONFIRMED',definitive:false,participant:{status:'REVOKED'}};
 assert.deepEqual(recoveryResult(original.entry,observed),{state:'PARTICIPATION_REVOKED'});j.observe(recoveryQuery(original.entry),observed);assert.equal(j.list(scope).length,0);
});
test('storage read failures are reported as no dispatch instead of falsely claiming a lost command',async()=>{
 const s=storage(),j=journal(s);j.prepare('/api/identity/task-creation',command());s.getItem=()=>{throw new Error('Blocked storage');};let sent=0;
 const lifecycle=createWorkspaceRequestLifecycle(async()=>'current',{journal:j,fetchImpl:async()=>{sent++;}});
 await assert.rejects(lifecycle.request('/api/identity/task-creation',command({operationId:secondId})),error=>error.requestDispatched===false&&error.code==='WORKSPACE_RECOVERY_STORAGE_UNAVAILABLE');assert.equal(sent,0);lifecycle.abort();
});
test('shared reservation serializes two tabs before either can dispatch a new UUID',async()=>{
 const s=storage();let queue=Promise.resolve();
 const withLock=(_name,_signal,reserve)=>{const task=queue.then(reserve);queue=task.catch(()=>{});return task;};
 const a=createWorkspaceRecoveryJournal({getStorage:()=>s,withLock}),b=createWorkspaceRecoveryJournal({getStorage:()=>s,withLock});
 const results=await Promise.allSettled([a.prepare('/api/identity/task-creation',command()),b.prepare('/api/identity/task-creation',command({operationId:secondId}))]);
 assert.equal(results.filter(row=>row.status==='fulfilled').length,1);assert.equal(results.find(row=>row.status==='rejected').reason.code,'WORKSPACE_RECOVERY_REQUIRED');assert.equal(a.list(scope).length,1);
});
test('a panel unmounted while awaiting the reservation lock never stores a reference or obtains a token',async()=>{
 const s=storage();let release,tokens=0,sent=0;
 const withLock=(_name,signal,reserve)=>new Promise((resolve,reject)=>{release=()=>{if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}resolve(reserve());};});
 const j=createWorkspaceRecoveryJournal({getStorage:()=>s,withLock});const lifecycle=createWorkspaceRequestLifecycle(async()=>{tokens++;return 'private';},{journal:j,fetchImpl:async()=>{sent++;}});
 const pending=lifecycle.request('/api/identity/task-creation',command());await new Promise(resolve=>setImmediate(resolve));lifecycle.abort();release();
 await assert.rejects(pending,error=>error.name==='AbortError'&&error.requestDispatched===false);assert.equal(j.list(scope).length,0);assert.equal(tokens,0);assert.equal(sent,0);
});
test('template uncertainty survives restart and forbids a fresh UUID without storing recipient or message',()=>{
 const s=storage(),j=journal(s),ticket=j.prepare('/api/identity/template-send',command({workerId:'worker-private',templateKey:'open_attendance_reminder'}));
 const receipt={id:'outbound-a',operationId,workerId:'worker-private',templateKey:'open_attendance_reminder'};
 const value={scope,projectId:'p-a',state:'SEND_UNKNOWN',receipt,saved:false,definitive:false,providerAccepted:false,deliveryConfirmed:false};
 j.settle(ticket,value);assert.equal(j.list(scope).length,1);j.observe(recoveryQuery(ticket.entry),value);assert.equal(journal(storage(s.rows)).list(scope).length,1);
 assert.throws(()=>j.prepare('/api/identity/template-send',command({operationId:secondId})),{code:'WORKSPACE_RECOVERY_REQUIRED'});
 assert.equal(JSON.stringify([...s.rows]).includes('worker-private'),false);assert.equal(JSON.stringify([...s.rows]).includes('Private medical'),false);
});
test('only exact terminal template outcomes clear the pending reference, with no claim of delivery',()=>{
 for(const state of ['ACCEPTED','REJECTED','STATUS_OBSERVED']){
  const j=journal(storage()),ticket=j.prepare('/api/identity/template-send',command()),receipt={id:'outbound-a',operationId,workerId:'worker-a',templateKey:'open_attendance_reminder'};
  const value={scope,projectId:'p-a',receipt,state,definitive:true,saved:state!=='REJECTED',providerAccepted:state!=='REJECTED',providerStatus:state==='STATUS_OBSERVED'?'sent':null,deliveryConfirmed:false};
  j.observe(recoveryQuery(ticket.entry),{...value,receipt:{...receipt,operationId:secondId}});assert.equal(j.list(scope).length,1);
  if(state==='ACCEPTED'){j.observe(recoveryQuery(ticket.entry),{...value,deliveryConfirmed:true});assert.equal(j.list(scope).length,1);}
  j.observe(recoveryQuery(ticket.entry),value);assert.equal(j.list(scope).length,0);
 }
});
test('worker consent and unlink receipts survive lost response without storing challenge code',()=>{
 const s=storage(),j=journal(s),ticket=j.prepare('/api/identity/worker-channel',command({action:'GRANT_TEMPLATE_MESSAGES',payload:{workerId:'worker-private',revision:'private-version',noticeSha256:'private-notice',confirmed:true}}));
 assert.match(recoveryQuery(ticket.entry),/worker-channel\?/);j.settle(ticket,null,Object.assign(new Error('Lost ACK'),{requestDispatched:true}));assert.equal(j.list(scope).length,1);
 j.observe(recoveryQuery(ticket.entry),{scope,projectId:'p-a',state:'RECORDED',saved:true,receiptId:'worker-receipt'});assert.equal(j.list(scope).length,0);
 assert.equal(JSON.stringify([...s.rows]).includes('private-notice'),false);
});
