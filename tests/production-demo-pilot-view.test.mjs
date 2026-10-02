import test from 'node:test';
import assert from 'node:assert/strict';
import {demoPilotSnapshot,demoPilotOutcome} from '../src/app/(identity)/cuenta/demo-pilot-view.mjs';
import {createWorkspaceRecoveryJournal,recoveryQuery} from '../src/app/(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorkspaceRequestLifecycle} from '../src/app/(identity)/cuenta/workspace-request-lifecycle.mjs';
import {createMetaAppRecovery} from '../src/lib/meta-app-recovery.mjs';
import {createMetaCustomerJobHandlers,signMetaCustomerJob} from '../src/lib/meta-customer-processing.mjs';
import {legacyBoundaryKind} from '../src/lib/legacy-access-boundary.js';
const scope='a'.repeat(64),projectId='p-test',operationId='01234567-89ab-4cde-8fab-0123456789ab';
const command={scope,projectId,operationId,action:'REQUEST_CHALLENGE',payload:{workerId:'w-test',revision:'2026-10-02T04:00:00.000000'}};
const snapshot={scope,projectId,purpose:'DEMO_PILOT',state:'NOT_PREPARED',participants:[{workerId:'w-test',name:'Ensayo',revision:command.payload.revision,eligible:true}],events:[],notice:{version:'demo-pilot-v1',sha256:'b'.repeat(64),text:'Aviso de prueba'},readiness:{canLaunchMeta:true,gates:{}},identityCertified:false,humanAcceptance:'NOT_VERIFIED',callbackHealth:'NOT_CONFIRMED'};
const outcome={scope,projectId,state:'RECORDED',saved:true,identityCertified:false,productionVerified:false,receipt:{id:'demo-receipt',operationId,action:command.action,workerId:'w-test',channelId:'wa-demo'}};
test('demo snapshot cannot imply certified identity, callback acceptance or another tenant',()=>{
 assert.equal(demoPilotSnapshot(snapshot,{scope,projectId}),snapshot);
 for(const change of [{scope:'c'.repeat(64)},{projectId:'p-foreign'},{purpose:'CUSTOMER'},{identityCertified:true},{humanAcceptance:'ACCEPTED'},{callbackHealth:'VERIFIED'},{participants:[snapshot.participants[0],snapshot.participants[0]]},{events:[{eventId:'customer_webhook_'+'d'.repeat(64),businessApplied:false,replySent:false}]},{state:'PREPARED',expiresAt:'invalid'}])assert.throws(()=>demoPilotSnapshot({...snapshot,...change},{scope,projectId}));
});
test('demo receipts match exact operation, action, worker and namespace truth',()=>{
 assert.equal(demoPilotOutcome(outcome,command),outcome);
 for(const change of [{operationId:'01234567-89ab-4cde-8fab-0123456789ac'},{action:'PREPARE'},{workerId:'w-foreign'},{channelId:null}])assert.throws(()=>demoPilotOutcome({...outcome,receipt:{...outcome.receipt,...change}},command));
 for(const change of [{identityCertified:true},{productionVerified:true},{scope:'b'.repeat(64)},{saved:false}])assert.throws(()=>demoPilotOutcome({...outcome,...change},command));
 const absent={scope,projectId,state:'NOT_OBSERVED',saved:false,definitive:false};assert.equal(demoPilotOutcome(absent,command),absent);
 const challenge={...outcome,code:'VINCULAR '+'z'.repeat(43),participant:{workerId:'w-test',challenge:{id:'challenge-a',expiresAt:'2026-10-02T04:05:00Z'}}};assert.equal(demoPilotOutcome(challenge,command),challenge);
 for(const change of [{workerId:'w-foreign'},{workerId:'w-test',challenge:{id:null,expiresAt:'2026-10-02T04:05:00Z'}},{workerId:'w-test',challenge:{id:'challenge-a',expiresAt:'invalid'}}])assert.throws(()=>demoPilotOutcome({...challenge,participant:change},command));
 assert.throws(()=>demoPilotOutcome({...challenge,code:'VINCULAR invalid'},command));
 assert.throws(()=>demoPilotOutcome({...challenge,receipt:{...challenge.receipt,action:'PREPARE'}},{...command,action:'PREPARE'}));
});
test('lost demo ACK survives page instance using only reference, GET receipt never repeats POST or reveals challenge',async()=>{
 const rows=new Map(),storage={get length(){return rows.size;},key:i=>[...rows.keys()][i]??null,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
 const journal=()=>createWorkspaceRecoveryJournal({getStorage:()=>storage,now:()=>1234});let posts=0,gets=0;
 const first=createWorkspaceRequestLifecycle(async()=>'controlled-token',{journal:journal(),fetchImpl:async()=>{posts++;throw new TypeError('Lost ACK');}});
 await assert.rejects(first.request('/api/identity/demo-pilot',{method:'POST',body:JSON.stringify({...command,payload:{...command.payload,token:'never-store',code:'VINCULAR never-store'}})}));first.abort();
 const fresh=journal(),entries=await fresh.list(scope);assert.equal(entries.length,1);assert.equal(entries[0].resource,'demo-pilot');assert.equal(JSON.stringify([...rows]).includes('never-store'),false);
 const second=createWorkspaceRequestLifecycle(async()=>'controlled-token',{journal:fresh,fetchImpl:async(_url,options)=>{assert.equal(options.method||'GET','GET');gets++;return Response.json(outcome);}});
 await second.request(recoveryQuery(entries[0]));assert.equal((await fresh.list(scope)).length,0);assert.equal(posts,1);assert.equal(gets,1);second.abort();
});
test('exact generic callback bypass has no child, sibling or alternate write methods; manual reads only',()=>{
 for(const method of ['GET','POST'])assert.equal(legacyBoundaryKind('/api/webhooks/whatsapp',method),'signed-protocol');
 for(const method of ['HEAD','PUT','PATCH','DELETE','OPTIONS'])assert.equal(legacyBoundaryKind('/api/webhooks/whatsapp',method),'private-api');
 for(const path of ['/api/webhooks/whatsapp/fake','/api/webhooks/whatsapp-extra','/api/webhooks'])assert.equal(legacyBoundaryKind(path,'POST'),'private-api');
 assert.equal(legacyBoundaryKind('/manual','GET'),'public');assert.equal(legacyBoundaryKind('/manual','HEAD'),'public');assert.equal(legacyBoundaryKind('/manual','POST'),'private-api');assert.equal(legacyBoundaryKind('/manual/private'),'private-page');
});
test('one signed existing cron independently recovers both bounded namespaces; direct signed ids stay customer-only',async()=>{
 const calls=[],customer={recover:async input=>{calls.push(['CUSTOMER',input]);return {durable:true,checked:1,results:[{eventId:'customer_webhook_'+'a'.repeat(64)}]};}},demo={recover:async input=>{calls.push(['DEMO_PILOT',input]);return {durable:true,checked:1,results:[{eventId:'demo_webhook_'+'b'.repeat(64)}]};}};
 const processor=createMetaAppRecovery({customer,demo}),environment={CRON_SECRET:'synthetic-cron-'.repeat(4),META_CUSTOMER_JOB_SECRET:'synthetic-job-'.repeat(4)},now=()=>1790926512000,handlers=createMetaCustomerJobHandlers({processor,environment,now});
 assert.equal((await handlers.GET(new Request('https://obrasaas.com/api/meta/customer-process'))).status,403);assert.equal(calls.length,0);
 const response=await handlers.GET(new Request('https://obrasaas.com/api/meta/customer-process',{headers:{authorization:'Bearer '+environment.CRON_SECRET}}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.checked,2);assert.equal(result.durable,true);assert.deepEqual(calls.map(([,input])=>input),[{limit:1},{limit:1}]);
 const body=JSON.stringify({version:1,eventIds:['demo_webhook_'+'b'.repeat(64)]}),time=now();const denied=await handlers.POST(new Request('https://obrasaas.com/api/meta/customer-process',{method:'POST',headers:{'Content-Type':'application/json','x-obrasaas-job-time':String(time),'x-obrasaas-job-signature':'sha256='+signMetaCustomerJob(body,time,environment)},body}));assert.equal(denied.status,400);assert.equal((await denied.json()).code,'META_CUSTOMER_JOB_INPUT_INVALID');assert.equal(calls.length,2);
 const partial=await createMetaAppRecovery({customer,demo:{recover:async()=>{throw new Error('sensitive private provider detail');}}}).recover();assert.equal(partial.durable,false);assert.equal(partial.checked,1);assert.equal(partial.recovery[1].code,'META_APP_RECOVERY_UNCONFIRMED');assert.equal(JSON.stringify(partial).includes('sensitive'),false);
});
