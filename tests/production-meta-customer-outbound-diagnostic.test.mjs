import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
import {customerOutboundId,customerOutboundDiagnostic,readCustomerOutboundDiagnostic,recordCustomerOutboundDiagnostic,createMetaCustomerOutbound} from '../src/lib/meta-customer-outbound.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {createMetaCustomerProcessor} from '../src/lib/meta-customer-processing.mjs';

const time=Date.parse('2026-10-14T14:00:00.000Z'),eventId='customer_webhook_'+'a'.repeat(64),id=customerOutboundId(eventId);
function diagnosticFixture(){
 const context={eventId,projectId:'project-a',channelId:'channel-a',payloadDigest:'b'.repeat(64),leaseToken:'synthetic-source-lease'};
 const source={id:eventId,projectId:context.projectId,status:'PENDING',leaseToken:context.leaseToken,payload:{organizationId:'org-a',channelId:context.channelId,payloadDigest:context.payloadDigest}};
 const outbound={id,projectId:context.projectId,leaseToken:'synthetic-outbound-lease',payload:{version:1,eventId,organizationId:'org-a',channelId:context.channelId,requestDigest:'c'.repeat(64)},outcome:{version:1,state:'SEND_STARTED',actorId:'actor-a'}};
 const reserved={id,leaseToken:outbound.leaseToken,requestDigest:outbound.payload.requestDigest,connection:{id:'channel-a',projectId:'project-a',organizationId:'org-a'}};
 const calls=[];let beforeUpdate=null;
 const client={async query(sql,args){calls.push(sql);
  if(sql.startsWith('SELECT id,"projectId",status::text'))return {rows:source.status==='PENDING'&&source.leaseToken===args[2]?[structuredClone(source)]:[]};
  if(sql.startsWith('SELECT id,"projectId",payload,outcome'))return {rows:[structuredClone(outbound)]};
  if(sql.startsWith('UPDATE public."WebhookEvent" SET outcome=jsonb_set')){
   assert.match(sql,/"leaseToken" IS NOT DISTINCT FROM \$4::text/);assert.match(sql,/payload->>'requestDigest'=\$3/);assert.match(sql,/source\."leaseToken"=\$8/);assert.match(sql,/source\.payload->>'payloadDigest'=\$10/);assert.match(sql,/NOT \(outcome \? 'diagnostic'\)/);
   beforeUpdate?.();const matches=outbound.payload.requestDigest===args[2]&&outbound.leaseToken===args[3]&&outbound.outcome.state===args[4]&&!outbound.outcome.diagnostic&&source.leaseToken===args[7]&&source.payload.channelId===args[8]&&source.payload.payloadDigest===args[9]&&source.payload.organizationId===args[10];
   if(matches)outbound.outcome.diagnostic=JSON.parse(args[5]);return {rows:[],rowCount:matches?1:0};
  }throw new Error('Unsupported synthetic diagnostic branch');
 }};
 return {context,source,outbound,reserved,client,calls,beforeUpdate(value){beforeUpdate=value;}};
}
test('diagnostic contains only bounded phase, allowlisted cause and timestamp',()=>{
 const value=customerOutboundDiagnostic({phase:'OWN_PROVIDER_SCOPE',code:'META_CUSTOMER_INBOX_LEASE_CHANGED',now:time,message:'private',stack:'private'});
 assert.deepEqual(value,{version:1,phase:'OWN_PROVIDER_SCOPE',code:'META_CUSTOMER_INBOX_LEASE_CHANGED',recordedAt:new Date(time).toISOString()});assert.deepEqual(readCustomerOutboundDiagnostic(value),value);
 const unknown=customerOutboundDiagnostic({phase:'private SQL',code:'private token',now:time});assert.equal(unknown.phase,'PROCESSING');assert.equal(unknown.code,'META_CUSTOMER_OUTBOUND_FAILURE_UNCONFIRMED');assert.doesNotMatch(JSON.stringify(unknown),/private/);
 for(const invalid of [null,[],42,'private',{...value,message:'private'},{...value,code:'arbitrary'}, {...value,phase:'SQL'}, {...value,recordedAt:'invalid'}, {...value,recordedAt:'2026-10-14'}, {...value,version:2}])assert.equal(readCustomerOutboundDiagnostic(invalid),null);
 for(const now of [NaN,Infinity,-Infinity,8640000000000001])assert.equal(customerOutboundDiagnostic({now}),null);
});
test('first diagnostic survives replay without changing state, leases, request or marker',async()=>{
 const f=diagnosticFixture(),before=structuredClone(f.outbound);
 assert.equal(await recordCustomerOutboundDiagnostic(f.client,{reserved:f.reserved,context:f.context,phase:'AFTER_RESERVE',code:'META_CUSTOMER_INBOX_LEASE_CHANGED',now:time}),true);
 const saved=structuredClone(f.outbound);assert.deepEqual({...saved,outcome:before.outcome},before);assert.equal(saved.outcome.state,'SEND_STARTED');
 assert.equal(await recordCustomerOutboundDiagnostic(f.client,{reserved:f.reserved,context:f.context,phase:'OUTCOME_COMMIT',code:'META_CUSTOMER_OUTBOUND_LEASE_CHANGED',now:time+1000}),false);assert.deepEqual(f.outbound,saved);
});
for(const [name,change] of [
 ['source lease',f=>f.context.leaseToken='foreign'],['source digest',f=>f.context.payloadDigest='d'.repeat(64)],['channel',f=>f.context.channelId='foreign'],['organization',f=>f.reserved.connection.organizationId='foreign'],['request digest',f=>f.reserved.requestDigest='d'.repeat(64)],['outbound lease',f=>f.reserved.leaseToken='foreign'],['confirmed delivery',f=>{f.outbound.outcome.state='STATUS_OBSERVED';f.outbound.outcome.messageId='wamid.SyntheticConfirmed';}],
])test('diagnostic refuses crossed '+name+' without writes',async()=>{
 const f=diagnosticFixture();change(f);const before=structuredClone(f.outbound);assert.equal(await recordCustomerOutboundDiagnostic(f.client,{reserved:f.reserved,context:f.context,phase:'REPLY_POST',code:'META_CUSTOMER_PROVIDER_UNCONFIRMED',now:time}),false);assert.deepEqual(f.outbound,before);assert.equal(f.calls.filter(sql=>sql.startsWith('UPDATE')).length,0);
});
for(const [name,change] of [
 ['source lease',f=>f.source.leaseToken='changed'],['source digest',f=>f.source.payload.payloadDigest='d'.repeat(64)],['request digest',f=>f.outbound.payload.requestDigest='d'.repeat(64)],['outbound lease',f=>f.outbound.leaseToken='changed'],
])test('diagnostic update CAS detects late '+name+' changes',async()=>{
 const f=diagnosticFixture();f.beforeUpdate(()=>change(f));assert.equal(await recordCustomerOutboundDiagnostic(f.client,{reserved:f.reserved,context:f.context,phase:'OWN_PROVIDER_SCOPE',code:'META_OWN_COMPANY_UNAVAILABLE',now:time}),false);assert.equal(f.outbound.outcome.diagnostic,undefined);
});
function processingFixture(recoveredState='SEND_STARTED'){
 const row={id:eventId,projectId:'project-a',payload:{organizationId:'org-a',channelId:'channel-a',payloadDigest:'b'.repeat(64)},status:'PENDING',leaseToken:null,leaseExpiresAt:null,attempts:0,lastError:null,outcome:null};let sends=0;
 const query=async(sql,args=[])=>{
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL'))return {rows:[],rowCount:0};
  if(sql.startsWith('SELECT id,"projectId",payload,status::text AS status'))return {rows:[structuredClone(row)]};
  if(sql.startsWith('SELECT id,"projectId",status::text'))return {rows:[structuredClone(row)]};
  if(sql.startsWith('SELECT id,"projectId",payload,outcome'))return {rows:[]};
  if(sql.startsWith('UPDATE public."WebhookEvent" SET "leaseToken"')){row.leaseToken=args[1];row.leaseExpiresAt=args[2];row.attempts++;return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WebhookEvent" SET "lastError"')){row.lastError=args[2];row.leaseToken=null;row.leaseExpiresAt=null;return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')){assert.match(sql,/"lastError"=CASE WHEN \$7 THEN "lastError" ELSE NULL END/);row.status='PROCESSED';row.outcome=JSON.parse(args[3]);row.leaseToken=null;row.leaseExpiresAt=null;if(!args[6])row.lastError=null;return {rows:[],rowCount:1};}
  throw new Error('Unsupported synthetic processor branch');
 };
 const processor=createMetaCustomerProcessor({connect:async()=>({query,release(){}}),now:()=>time,dispatch:async()=>({kind:'KYC_CHAT',identityStatus:'LIMITED_KYC_UPLOAD',businessApplied:false,reply:{type:'text',body:'Synthetic fixed prompt'}}),outbound:{async send(){if(++sends===1)throw new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409);return {state:recoveredState,replySent:recoveredState==='SENT'};}}});
 return {row,processor,sends:()=>sends};
}
for(const state of ['SEND_STARTED','SEND_UNKNOWN'])test('same-event '+state+' recovery preserves the original failure without a provider POST',async()=>{
 const f=processingFixture(state);await assert.rejects(f.processor.process(eventId),{code:'META_CUSTOMER_INBOX_LEASE_CHANGED'});assert.equal(f.row.lastError,'META_CUSTOMER_INBOX_LEASE_CHANGED');const recovered=await f.processor.process(eventId);assert.equal(recovered.replyState,state);assert.equal(f.row.lastError,'META_CUSTOMER_INBOX_LEASE_CHANGED');assert.equal(f.row.attempts,2);assert.equal(f.sends(),2);assert.equal((await f.processor.process(eventId)).done,true);assert.equal(f.sends(),2);
});
test('confirmed reply recovery clears the transient inbound error',async()=>{
 const f=processingFixture('SENT');await assert.rejects(f.processor.process(eventId));assert.equal((await f.processor.process(eventId)).replyState,'SENT');assert.equal(f.row.lastError,null);
});

function outboundFixture({afterReserve=async()=>{},channelActive=()=>true,sendError=null,completeError=null,diagnosticError=false}={}){
 const f=diagnosticFixture(),environment={META_CUSTOMER_CREDENTIALS_KEY:Buffer.alloc(32,19).toString('base64')};let outbound=null,posts=0,connections=0;
 const connection={...f.reserved.connection,phoneNumberId:'990001100000002',metadata:{},encryptedAccessToken:encryptCustomerSecret('synthetic-private-token',{organizationId:'org-a',projectId:'project-a',purpose:'access-token',resourceId:'990001100000002'},environment)};
 const event={...f.source,leaseExpiresAt:new Date(time+60000).toISOString()},reply={type:'text',body:'Synthetic private fixed reply'};
 const query=async(sql,args=[])=>{
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SET LOCAL'))return {rows:[],rowCount:0};
  if(sql.startsWith('SELECT id,"projectId",status::text'))return {rows:[structuredClone(event)]};
  if(sql.startsWith('SELECT id,')&&sql.includes("provider='meta-customer-outbound-v1'"))return {rows:outbound?[structuredClone(outbound)]:[]};
  if(sql.startsWith('INSERT INTO public."WebhookEvent"')){assert.equal(outbound,null);outbound={id:args[0],projectId:args[1],status:'PENDING',payload:JSON.parse(args[3]),outcome:JSON.parse(args[4]),leaseToken:args[5],leaseExpiresAt:args[6]};return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE public."WebhookEvent" SET outcome=jsonb_set')){if(diagnosticError)throw new Error('Synthetic private SQL token');const matches=!Object.hasOwn(outbound.outcome,'diagnostic')&&outbound.payload.requestDigest===args[2]&&outbound.leaseToken===args[3]&&outbound.outcome.state===args[4]&&event.leaseToken===args[7]&&event.payload.payloadDigest===args[9];if(matches)outbound.outcome.diagnostic=JSON.parse(args[5]);return {rows:[],rowCount:matches?1:0};}
  if(sql.startsWith('UPDATE public."WebhookEvent" SET status=\'PROCESSED\'')){if(completeError)throw completeError;assert.equal(outbound.leaseToken,args[2]);outbound.status='PROCESSED';outbound.outcome=JSON.parse(args[3]);outbound.leaseToken=null;outbound.leaseExpiresAt=null;return {rows:[],rowCount:1};}
  throw new Error('Unsupported synthetic outbound branch');
 };
 const lane=createMetaCustomerOutbound({connect:async()=>{connections++;return {query,release(){}};},environment,now:()=>time,afterReserve,channelActive,resolveIdentity:async()=>({kind:'CHANNEL_VERIFIED',project:{id:'project-a'},connection,event,member:{organizationId:'org-a',actorId:'actor-a'},proof:{type:'message',value:{id:'wamid.SyntheticSource0001',from:'5491100001111',timestamp:String(time/1000)}}}),provider:{async sendReply(){posts++;if(sendError)throw sendError;return {messageId:'wamid.SyntheticReply0001'};}}});
 return {lane,context:f.context,reply,marker:()=>outbound,posts:()=>posts,connections:()=>connections};
}

test('actual outbound records AFTER_RESERVE once and replay never invokes the provider',async()=>{
 const error=new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409),f=outboundFixture({afterReserve:async()=>{throw error;}});
 await assert.rejects(()=>f.lane.send(f.context,f.reply),value=>value===error);const before=structuredClone(f.marker());assert.equal(before.outcome.diagnostic.phase,'AFTER_RESERVE');assert.equal(before.outcome.diagnostic.code,error.code);assert.equal(before.outcome.state,'SEND_STARTED');assert.equal(f.posts(),0);
 assert.equal((await f.lane.send(f.context,f.reply)).state,'SEND_STARTED');assert.deepEqual(f.marker(),before);assert.equal(f.posts(),0);
});

test('current channel fence failure records its phase without provider transport',async()=>{
 let checks=0;const f=outboundFixture({channelActive:()=>++checks===1});await assert.rejects(()=>f.lane.send(f.context,f.reply),{code:'META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED'});assert.equal(f.marker().outcome.diagnostic.phase,'OWN_BEFORE_EXTERNAL');assert.equal(f.marker().outcome.diagnostic.code,'META_CUSTOMER_CHANNEL_ACCEPTANCE_REQUIRED');assert.equal(f.posts(),0);
});

for(const code of ['META_CUSTOMER_PROVIDER_REJECTED','META_CUSTOMER_SEND_UNCONFIRMED'])test('actual '+code+' diagnosis survives completion and cannot trigger another POST',async()=>{
 const f=outboundFixture({sendError:new WorkspaceError(code,503)}),result=await f.lane.send(f.context,f.reply);assert.equal(result.state,code==='META_CUSTOMER_PROVIDER_REJECTED'?'REJECTED':'SEND_UNKNOWN');const before=structuredClone(f.marker());assert.equal(before.outcome.diagnostic.phase,'REPLY_POST');assert.equal(before.outcome.diagnostic.code,code);assert.equal(before.status,'PROCESSED');assert.equal(f.posts(),1);
 assert.equal((await f.lane.send(f.context,f.reply)).replayed,true);assert.deepEqual(f.marker(),before);assert.equal(f.posts(),1);
});

test('failed outcome commit records OUTCOME_COMMIT and retains the reservation',async()=>{
 const error=new WorkspaceError('META_CUSTOMER_OUTBOUND_LEASE_CHANGED',409),f=outboundFixture({completeError:error});await assert.rejects(()=>f.lane.send(f.context,f.reply),value=>value===error);assert.equal(f.marker().outcome.diagnostic.phase,'OUTCOME_COMMIT');assert.equal(f.marker().outcome.diagnostic.code,error.code);assert.equal(f.marker().outcome.state,'SEND_STARTED');assert.equal(f.posts(),1);await f.lane.send(f.context,f.reply);assert.equal(f.posts(),1);
});

test('diagnostic write failure preserves the original exception and forbids retry transport',async()=>{
 const error=new WorkspaceError('META_CUSTOMER_INBOX_LEASE_CHANGED',409),f=outboundFixture({afterReserve:async()=>{throw error;},diagnosticError:true});await assert.rejects(()=>f.lane.send(f.context,f.reply),value=>value===error);assert.equal(f.marker().outcome.diagnostic,undefined);assert.equal(f.marker().outcome.state,'SEND_STARTED');await f.lane.send(f.context,f.reply);assert.equal(f.posts(),0);
});

test('unknown exception details are excluded from the durable outbound diagnostic',async()=>{
 const f=outboundFixture({sendError:new Error('private SQL token https://private.invalid/document')});assert.equal((await f.lane.send(f.context,f.reply)).state,'SEND_UNKNOWN');assert.equal(f.marker().outcome.diagnostic.code,'META_CUSTOMER_OUTBOUND_FAILURE_UNCONFIRMED');assert.doesNotMatch(JSON.stringify(f.marker().outcome),/private|SQL|token|https:/);
});
