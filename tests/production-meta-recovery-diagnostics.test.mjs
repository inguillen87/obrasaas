import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createMetaAppRecovery} from '../src/lib/meta-app-recovery.mjs';
import {createMetaCustomerCallbackHandlers} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerJobHandlers,signMetaCustomerJob} from '../src/lib/meta-customer-processing.mjs';
import {metaRecoveryDiagnostics,reportMetaRecoveryDiagnostics,recoverWithMetaDiagnostics} from '../src/lib/meta-recovery-diagnostics.mjs';

const privateValue='synthetic-private-token-phone-payload-error';
const fields=['purpose','trigger','checked','processed','done','busy','failed','recoveryFailed','replyUncertain','replyRejected'];
const environment={CRON_SECRET:'synthetic-cron-secret-'.repeat(3),META_CUSTOMER_JOB_SECRET:'synthetic-job-secret-'.repeat(3)};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('cron warns for a fulfilled recovery containing an unprocessed event without changing its canonical result',async()=>{
 const entries=[],failed={eventId:'synthetic-private-event-id',processed:false,code:'synthetic-private-code'},result={durable:true,checked:1,results:[failed]};
 const customer={recover:async()=>result},demo={recover:async()=>({durable:true,checked:0,results:[]})};
 const recovered=await createMetaAppRecovery({customer,demo,log:(...entry)=>entries.push(entry)}).recover();
 assert.equal(recovered.durable,true);assert.equal(recovered.checked,1);assert.equal(recovered.results[0],failed);
 assert.equal(entries.length,1);
 assert.deepEqual(entries[0],['META_RECOVERY_UNCONFIRMED',{purpose:'CUSTOMER',trigger:'CRON',checked:1,processed:0,done:0,busy:0,failed:1,recoveryFailed:0,replyUncertain:0,replyRejected:0}]);
 assert.equal(JSON.stringify(entries).includes('synthetic-private'),false);
});

test('diagnostics derive fixed counts and distinguish processing, completion, occupancy and uncertain replies',()=>{
 const result={durable:true,checked:privateValue,code:privateValue,eventId:privateValue,unknown:privateValue,results:[
  {processed:true,replySent:false,reviewState:'REVIEW_REQUIRED',code:privateValue,payload:privateValue},
  {processed:true,kind:'message_status',replySent:false,providerError:privateValue},
  {processed:true,replyState:'SEND_UNKNOWN',messageId:privateValue},
  {processed:true,replyState:'SEND_STARTED',phone:privateValue},
  {processed:true,replyState:'REJECTED',error:privateValue},
  {done:true,eventId:privateValue},
  {busy:true,leaseToken:privateValue},
  {processed:false,code:privateValue},
  {eventId:privateValue,replyState:privateValue},
 ]};
 Object.defineProperty(result,'checked',{get(){throw new Error(privateValue);}});
 Object.defineProperty(result,'unexpected',{get(){throw new Error(privateValue);}});
 const summary=metaRecoveryDiagnostics(result,{purpose:'DEMO_PILOT',trigger:'WEBHOOK',unknown:privateValue});
 assert.deepEqual(Object.keys(summary),fields);
 assert.deepEqual(summary,{purpose:'DEMO_PILOT',trigger:'WEBHOOK',checked:9,processed:5,done:1,busy:1,failed:1,recoveryFailed:0,replyUncertain:2,replyRejected:1});
 assert.ok(Object.isFrozen(summary));
 assert.ok(Object.values(summary).slice(2).every(value=>Number.isInteger(value)&&value>=0));
 assert.equal(JSON.stringify(summary).includes(privateValue),false);
});

test('unknown purpose or trigger never becomes a log value, even with failed recovery',()=>{
 const entries=[],result={durable:false,results:[{processed:false,eventId:privateValue}]};
 for(const context of [{purpose:privateValue,trigger:'CRON'},{purpose:'CUSTOMER',trigger:privateValue},{purpose:{secret:privateValue},trigger:'WEBHOOK'},{purpose:'DEMO_PILOT',trigger:null}]){
  assert.equal(metaRecoveryDiagnostics(result,context),null);
  assert.equal(reportMetaRecoveryDiagnostics(result,{...context,log:(...entry)=>entries.push(entry)}),null);
 }
 assert.deepEqual(entries,[]);
});

test('normal review, status observation, already done and busy events never create false warnings',()=>{
 const entries=[],result={durable:true,results:[{processed:true,reviewState:'REVIEW_REQUIRED',replySent:false,code:privateValue},{processed:true,kind:'message_status',replySent:false},{done:true,replySent:false},{busy:true}]};
 const summary=reportMetaRecoveryDiagnostics(result,{purpose:'CUSTOMER',trigger:'CRON',log:(...entry)=>entries.push(entry)});
 assert.deepEqual(summary,{purpose:'CUSTOMER',trigger:'CRON',checked:4,processed:2,done:1,busy:1,failed:0,recoveryFailed:0,replyUncertain:0,replyRejected:0});
 assert.deepEqual(entries,[]);
});

test('each explicit uncertain or rejected reply produces a count warning without raw reply data',()=>{
 for(const replyState of ['SEND_UNKNOWN','SEND_STARTED','REJECTED']){
  const entries=[],row={processed:true,replySent:false,replyState,to:privateValue,body:privateValue,code:privateValue};
  reportMetaRecoveryDiagnostics({durable:true,results:[row]},{purpose:'DEMO_PILOT',trigger:'WEBHOOK',log:(...entry)=>entries.push(entry)});
  assert.equal(entries.length,1);assert.equal(entries[0][1].replyUncertain,replyState==='REJECTED'?0:1);assert.equal(entries[0][1].replyRejected,replyState==='REJECTED'?1:0);
  assert.equal(JSON.stringify(entries).includes(privateValue),false);
 }
});

test('webhook recovery returns the same result and input, with one invocation despite sync or async logger failures',{timeout:1000},async()=>{
 const row={processed:false,eventId:privateValue,code:privateValue},result={durable:true,checked:1,results:[row]},input={eventIds:['customer_webhook_'+'a'.repeat(64)],limit:1};
 const unhandled=[],listener=error=>unhandled.push(error);process.on('unhandledRejection',listener);
 try{
  for(const log of [()=>{throw new Error(privateValue);},async()=>{throw new Error(privateValue);},()=>new Promise(()=>{})]){
   let calls=0;const processor={recover:async function(received){calls++;assert.equal(this,processor);assert.equal(received,input);return result;}};
   assert.equal(await recoverWithMetaDiagnostics(processor,input,{purpose:'CUSTOMER',trigger:'WEBHOOK',log}),result);
   assert.equal(calls,1);assert.equal(result.results[0],row);
  }
  await tick();await tick();assert.deepEqual(unhandled,[]);
 }finally{process.off('unhandledRejection',listener);}
});

test('recovery rejection preserves the original error identity while diagnostics expose only a fixed failure count',async()=>{
 const original=new Error(privateValue),entries=[],input={limit:1};let calls=0;
 const processor={recover:async received=>{calls++;assert.equal(received,input);throw original;}};
 await assert.rejects(recoverWithMetaDiagnostics(processor,input,{purpose:'DEMO_PILOT',trigger:'WEBHOOK',log:(...entry)=>{entries.push(entry);return Promise.reject(new Error(privateValue));}}),error=>error===original);
 assert.equal(calls,1);assert.deepEqual(entries,[['META_RECOVERY_UNCONFIRMED',{purpose:'DEMO_PILOT',trigger:'WEBHOOK',checked:0,processed:0,done:0,busy:0,failed:0,recoveryFailed:1,replyUncertain:0,replyRejected:0}]]);
 assert.equal(JSON.stringify(entries).includes(privateValue),false);await tick();
 const poisonedOptions={purpose:'CUSTOMER',trigger:'CRON'};Object.defineProperty(poisonedOptions,'unknown',{enumerable:true,get(){throw new Error('different '+privateValue);}});
 await assert.rejects(recoverWithMetaDiagnostics(processor,input,poisonedOptions),error=>error===original);
});

test('unreadable diagnostic fields cannot change the canonical recovery result or leak a private exception',async()=>{
 const result={durable:true},entries=[];Object.defineProperty(result,'results',{get(){throw new Error(privateValue);}});
 const recovered=await recoverWithMetaDiagnostics({recover:async()=>result},{limit:1},{purpose:'CUSTOMER',trigger:'WEBHOOK',log:(...entry)=>entries.push(entry)});
 assert.equal(recovered,result);assert.deepEqual(entries,[]);
});

test('cron logs each namespace independently while keeping canonical outcomes and authenticating before recovery',async()=>{
 const entries=[],calls=[],row={processed:false,eventId:privateValue,code:privateValue};
 const customer={recover:async input=>{calls.push(['CUSTOMER',input]);return {durable:true,checked:1,results:[row]};}},demo={recover:async input=>{calls.push(['DEMO_PILOT',input]);throw new Error(privateValue);}};
 const processor=createMetaAppRecovery({customer,demo,log:(...entry)=>entries.push(entry)}),handlers=createMetaCustomerJobHandlers({processor,environment});
 assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/meta/customer-process'))).status,403);assert.deepEqual(calls,[]);assert.deepEqual(entries,[]);
 const response=await handlers.GET(new Request('https://obrasaas.com/api/meta/customer-process',{headers:{authorization:'Bearer '+environment.CRON_SECRET}}));
 assert.equal(response.status,200);assert.equal(response.bodyUsed,false);const result=await response.json();
 assert.equal(result.durable,false);assert.equal(result.checked,1);assert.deepEqual(result.results,[row]);assert.equal(result.recovery[1].code,'META_APP_RECOVERY_UNCONFIRMED');
 assert.deepEqual(calls,[['CUSTOMER',{limit:1}],['DEMO_PILOT',{limit:1}]]);assert.equal(entries.length,2);
 assert.deepEqual(entries.map(entry=>[entry[1].purpose,entry[1].trigger,entry[1].failed,entry[1].recoveryFailed]),[['CUSTOMER','CRON',1,0],['DEMO_PILOT','CRON',0,1]]);
 assert.equal(JSON.stringify(entries).includes(privateValue),false);
});

test('cron response and authenticated recovery remain unchanged if logging throws or rejects',{timeout:1000},async()=>{
 const row={processed:false,eventId:privateValue,code:privateValue},result={durable:true,checked:1,results:[row]};
 for(const log of [()=>{throw new Error(privateValue);},async()=>{throw new Error(privateValue);},()=>new Promise(()=>{})]){
  let calls=0;const processor=createMetaAppRecovery({customer:{recover:async()=>{calls++;return result;}},demo:{recover:async()=>({durable:true,checked:0,results:[]})},log});
  const handlers=createMetaCustomerJobHandlers({processor,environment}),response=await handlers.GET(new Request('https://obrasaas.com/api/meta/customer-process',{headers:{authorization:'Bearer '+environment.CRON_SECRET}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.bodyUsed,false);
  const received=await response.json();assert.equal(received.durable,true);assert.deepEqual(received.results,[row]);assert.equal(calls,1);
 }
 await tick();
});

test('explicit signed event jobs remain customer-only and do not become cron or webhook diagnostic calls',async()=>{
 const entries=[],customerCalls=[],result={durable:true,checked:1,results:[{processed:false,eventId:privateValue}]};let demoCalls=0;
 const customer={recover:async input=>{customerCalls.push(input);return result;}},demo={recover:async()=>{demoCalls++;throw new Error(privateValue);}},processor=createMetaAppRecovery({customer,demo,log:(...entry)=>entries.push(entry)});
 const explicit={eventIds:['customer_webhook_'+'b'.repeat(64)]};assert.equal(await processor.recover(explicit),result);assert.equal(customerCalls[0],explicit);assert.equal(demoCalls,0);assert.deepEqual(entries,[]);
 const now=()=>1790926512000,handlers=createMetaCustomerJobHandlers({processor,environment,now});
 const request=id=>{const body=JSON.stringify({version:1,eventIds:[id]});return new Request('https://obrasaas.com/api/meta/customer-process',{method:'POST',headers:{'Content-Type':'application/json','x-obrasaas-job-time':String(now()),'x-obrasaas-job-signature':'sha256='+signMetaCustomerJob(body,now(),environment)},body});};
 assert.equal((await handlers.POST(request(explicit.eventIds[0]))).status,200);assert.equal(customerCalls.length,2);
 assert.equal((await handlers.POST(request('demo_webhook_'+'c'.repeat(64)))).status,400);assert.equal(customerCalls.length,2);assert.equal(demoCalls,0);assert.deepEqual(entries,[]);
});

test('durable signed webhook ACK remains identical when scheduled recovery fails and its logger rejects',async()=>{
 const env={META_APP_SECRET:'synthetic-app-secret-for-recovery-test',WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:Buffer.alloc(32,71).toString('base64')},id='customer_webhook_'+'d'.repeat(64),entries=[];
 const payload={object:'whatsapp_business_account',entry:[{id:'123456789012345',changes:[{field:'messages',value:{metadata:{phone_number_id:'123456789012346'},messages:[{id:'wamid.synthetic_private_inbound_000000',from:'5491100000000',timestamp:'1790926512',type:'text',text:{body:privateValue}}]}}]}]},bytes=JSON.stringify(payload),signature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(bytes).digest('hex');
 const request=()=>new Request('https://obrasaas.com/api/meta/customer-callback',{method:'POST',headers:{'content-type':'application/json','x-hub-signature-256':signature},body:bytes});
 let records=0,calls=0,wake;const inbox={record:async()=>{records++;return {durable:true,eventIds:[id]};}},processor={recover:async input=>{calls++;assert.deepEqual(input,{eventIds:[id],limit:1});return {durable:true,checked:1,results:[{processed:false,eventId:privateValue,code:privateValue}]};}};
 const baseline=createMetaCustomerCallbackHandlers({environment:env,inbox}),observed=createMetaCustomerCallbackHandlers({environment:env,inbox,schedule:eventIds=>{wake=recoverWithMetaDiagnostics(processor,{eventIds,limit:1},{purpose:'CUSTOMER',trigger:'WEBHOOK',log:(...entry)=>{entries.push(entry);return Promise.reject(new Error(privateValue));}});}});
 const before=await baseline.POST(request()),after=await observed.POST(request());assert.equal(after.status,before.status);assert.equal(after.status,200);assert.deepEqual(Object.fromEntries(after.headers),Object.fromEntries(before.headers));assert.equal(after.bodyUsed,false);assert.deepEqual(await after.json(),await before.json());
 await wake;await tick();assert.equal(records,2);assert.equal(calls,1);assert.equal(entries.length,1);assert.equal(JSON.stringify(entries).includes(privateValue),false);
});
