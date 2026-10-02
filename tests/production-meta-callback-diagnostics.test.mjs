import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {reportMetaCallbackRejection} from '../src/lib/meta-callback-diagnostics.mjs';
import {createMetaCustomerCallbackHandlers} from '../src/lib/meta-customer-callback.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
const environment={META_APP_SECRET:'synthetic-private-app-secret-1234',WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:Buffer.alloc(32,31).toString('base64')};
const value={object:'whatsapp_business_account',entry:[{id:'12345678901234',changes:[{field:'messages',value:{metadata:{phone_number_id:'12345678901235'},messages:[{id:'wamid.SyntheticPrivateMessage01',from:'5491112345678',type:'text',text:{body:'synthetic-private-message-body'}}]}}]}]};
const request=(body,options={})=>new Request('https://synthetic-private-origin.invalid/private?token=synthetic-private-query',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':'sha256='+createHmac('sha256',environment.META_APP_SECRET).update(body).digest('hex'),...options},body});
test('callback diagnostics expose only allowlisted stage, category, status and signature flag',()=>{
 const entries=[],log=(...entry)=>entries.push(entry);
 reportMetaCallbackRejection({stage:'synthetic-private-stage',code:'synthetic-private-error',status:'synthetic-private-status',signatureVerified:'synthetic-private-proof',request:value,token:environment.META_APP_SECRET},{log});
 assert.deepEqual(entries,[['META_CALLBACK_REJECTED',{stage:'UNCONFIRMED',failureKind:'UNCONFIRMED',status:503,signatureVerified:false}]]);
 assert.doesNotMatch(JSON.stringify(entries),/synthetic-private|5491112345678|wamid/);
});
test('a signed invalid Meta sample is distinguished from an invalid signature before any inbox record',async()=>{
 const malformed=structuredClone(value);malformed.entry[0].changes[0].value.messages[0].id='ABGGFlA5Fpa';let records=0;const entries=[];
 const handlers=createMetaCustomerCallbackHandlers({environment,inbox:{record:async()=>{records++;throw new Error('must not record');}},reportRejection:shape=>reportMetaCallbackRejection(shape,{log:(...entry)=>entries.push(entry)})});
 const invalid=await handlers.POST(request(JSON.stringify(malformed)));assert.equal(invalid.status,400);assert.deepEqual(await invalid.json(),{received:false,code:'META_CUSTOMER_CALLBACK_INVALID'});
 const forged=await handlers.POST(request(JSON.stringify(value),{'x-hub-signature-256':'sha256='+'0'.repeat(64)}));assert.equal(forged.status,403);
 assert.deepEqual(entries,[['META_CALLBACK_REJECTED',{stage:'VALIDATING_EVENTS',failureKind:'FORMAT',status:400,signatureVerified:true}],['META_CALLBACK_REJECTED',{stage:'SIGNATURE',failureKind:'SIGNATURE',status:403,signatureVerified:false}]]);assert.equal(records,0);
});
test('private data and arbitrary provider errors are never printed while the existing response stays intact',async()=>{
 const entries=[];let calls=0;const handlers=createMetaCustomerCallbackHandlers({environment,inbox:{record:async()=>{calls++;throw new WorkspaceError('synthetic-private-provider-token',503);}},reportRejection:shape=>reportMetaCallbackRejection(shape,{log:(...entry)=>entries.push(entry)})});
 const response=await handlers.POST(request(JSON.stringify(value)));assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(calls,1);
 assert.deepEqual(entries,[['META_CALLBACK_REJECTED',{stage:'RECORDING',failureKind:'UNCONFIRMED',status:503,signatureVerified:true}]]);assert.doesNotMatch(JSON.stringify(entries),/synthetic-private|5491112345678|wamid|private-origin/);
});
test('failure logging cannot turn a durable commit into failure or acknowledge an uncommitted inbox',async()=>{
 for(const durable of [true,false]){let records=0,wakes=0,reports=0;const handlers=createMetaCustomerCallbackHandlers({environment,inbox:{record:async()=>{records++;return {durable,eventIds:['synthetic-private-event']};}},schedule:()=>{wakes++;},reportRejection:()=>{reports++;throw new Error('synthetic-private-log-failure');}});const response=await handlers.POST(request(JSON.stringify(value)));assert.equal(response.status,durable?200:503);assert.equal(records,1);assert.equal(wakes,durable?1:0);assert.equal(reports,durable?0:1);assert.deepEqual(await response.json(),durable?{received:true,durable:true,applied:false}:{received:false,code:'META_CUSTOMER_CALLBACK_UNCONFIRMED'});}
});
test('synchronous and asynchronous logging failures are safely contained',async()=>{
 assert.doesNotThrow(()=>reportMetaCallbackRejection({stage:'SIGNATURE',code:'META_CUSTOMER_SIGNATURE_REJECTED',status:403},{log:()=>{throw new Error('private failure');}}));
 reportMetaCallbackRejection({stage:'SIGNATURE',code:'META_CUSTOMER_SIGNATURE_REJECTED',status:403},{log:async()=>{throw new Error('private failure');}});await new Promise(resolve=>setImmediate(resolve));
});
test('scope rejection is signed but never accepted, and a body failure is not misreported as a committed inbox',async()=>{
 const entries=[],handlers=createMetaCustomerCallbackHandlers({environment,inbox:{record:async()=>{throw new WorkspaceError('META_CUSTOMER_CALLBACK_SCOPE_REJECTED',403);}},reportRejection:shape=>reportMetaCallbackRejection(shape,{log:(...entry)=>entries.push(entry)})});
 assert.equal((await handlers.POST(request(JSON.stringify(value)))).status,403);
 assert.deepEqual(entries,[['META_CALLBACK_REJECTED',{stage:'RECORDING',failureKind:'CHANNEL_SCOPE',status:403,signatureVerified:true}]]);
 reportMetaCallbackRejection({stage:'BODY',code:'META_CUSTOMER_CALLBACK_UNCONFIRMED',status:503,signatureVerified:false},{log:(...entry)=>entries.push(entry)});
 assert.deepEqual(entries[1],['META_CALLBACK_REJECTED',{stage:'BODY',failureKind:'UNCONFIRMED',status:503,signatureVerified:false}]);
});
test('an asynchronous reporter rejection cannot change the callback error or trigger scheduling',async()=>{
 let scheduled=0;const handlers=createMetaCustomerCallbackHandlers({environment,inbox:{record:async()=>({durable:false})},schedule:()=>{scheduled++;},reportRejection:async()=>{throw new Error('synthetic-private-reporter-error');}});
 const response=await handlers.POST(request(JSON.stringify(value)));assert.equal(response.status,503);assert.deepEqual(await response.json(),{received:false,code:'META_CUSTOMER_CALLBACK_UNCONFIRMED'});assert.equal(scheduled,0);await new Promise(resolve=>setImmediate(resolve));
});
