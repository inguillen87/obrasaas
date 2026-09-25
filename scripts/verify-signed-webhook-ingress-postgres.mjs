import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { registerHooks } from 'node:module';
import { createServer, request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { mkdirSync, writeFileSync } from 'node:fs';
import { executionTestConnection } from './lib/execution-test-database.mjs';

// Refuse any application target before loading Prisma or opening an HTTP socket.
const connectionString=executionTestConnection();
assert.ok(!['preview','production'].includes(process.env.VERCEL_ENV));
assert.ok(!['preview','production'].includes(process.env.VERCEL_TARGET_ENV));
assert.ok(!globalThis.__obraSaasPrisma);
process.env.DATABASE_URL=connectionString;
process.env.META_APP_SECRET='a32-synthetic-signature-secret-not-a-provider-key';
process.env.META_VERIFY_TOKEN='a32-synthetic-verification-token';
process.env.WHATSAPP_FLOW_TOKEN_SECRET='a32-synthetic-flow-signing-secret-not-a-provider-key';
const secret=process.env.META_APP_SECRET;
const boundary={scheduled:[],drains:[]};globalThis.__a32IngressBoundary=boundary;
// Keep signature, normalization, scope resolution and persistence real. Only
// after-response scheduling and the outbound worker are captured (not executed).
registerHooks({resolve(specifier,context,next){
 if(specifier==='next/server')return {url:'fixture:a32-scheduler',shortCircuit:true};
 if(specifier==='@/lib/whatsapp/webhook-worker')return {url:'fixture:a32-worker',shortCircuit:true};
 if(specifier.startsWith('@/'))return next(new URL('../src/'+specifier.slice(2)+(specifier.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,context);
 return next(specifier,context);
},load(url,context,next){
 if(url==='fixture:a32-scheduler')return {format:'module',shortCircuit:true,source:'export function after(fn){globalThis.__a32IngressBoundary.scheduled.push(fn)}'};
 if(url==='fixture:a32-worker')return {format:'module',shortCircuit:true,source:'export async function drainProjectWebhookEvents(projectId){globalThis.__a32IngressBoundary.drains.push(projectId)}'};
 return next(url,context);
}});
const {PrismaPg}=await import('@prisma/adapter-pg');
const {PrismaClient}=await import('../src/generated/prisma/client.ts');
const db=new PrismaClient({adapter:new PrismaPg({connectionString})});globalThis.__obraSaasPrisma=db;
const previousFetch=globalThis.fetch;let externalCalls=0;
globalThis.fetch=async()=>{externalCalls++;throw new Error('External HTTP is forbidden in the signed ingress verifier.');};
const {GET,POST}=await import('../src/app/api/webhooks/whatsapp/route.js');
const {META_WEBHOOK_MAX_BODY_BYTES,META_WEBHOOK_MAX_UPDATES}=await import('../src/lib/whatsapp/webhook-ingress.js');
const {acquireWebhookEvent,applyWebhookMessageAtomically,createEmptyAppState}=await import('../src/lib/db.js');
const {issueWhatsAppFlowSession}=await import('../src/lib/whatsapp/flow-sessions.js');
const {getWhatsAppFlowBlueprint}=await import('../src/lib/whatsapp/flows.js');
const {deserializeWebhookPayload}=await import('../src/lib/webhook-queue.js');
const {validateStoredWebhookScope}=await import('../src/lib/whatsapp/webhook-scope.js');
const {processIncomingObraMessage}=await import('../src/lib/whatsapp/obra-engine.js');
const {normalizeWorkerPhone}=await import('../src/lib/field-workers.js');
const {readProactiveFlowIncident}=await import('../src/lib/whatsapp/flow-incident.js');
const report={status:'RUNNING',environment:'loopback-http-production-route-real-signature-normalization-postgresql',cases:[],syntheticSigningKey:true,nextAfterSchedulerCaptured:true,fullNextServer:false,workerDispatchExecuted:false,physicalMetaMessages:0};
const errors=[],server=createServer(async(req,res)=>{
 try{
  assert.ok(req.url.startsWith('/api/webhooks/whatsapp'));
  const webRequest=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await (req.method==='POST'?POST:GET)(webRequest);
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){errors.push({code:error.code||error.name});res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Unexpected verification adapter error"}');}
});
let port,serial=0;
const sign=body=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
function send(body,options={}){
 const bytes=body===null?null:Buffer.isBuffer(body)?body:Buffer.from(typeof body==='string'?body:JSON.stringify(body));
 return new Promise((resolve,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port,path:options.path||'/api/webhooks/whatsapp',method:bytes===null?'GET':'POST',headers:bytes===null?{}:{'content-type':'application/json',...(!options.chunked?{'content-length':bytes.length}:{}),...(!options.noSignature?{'x-hub-signature-256':options.signature??sign(bytes)}:{}),...options.headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const body=Buffer.concat(chunks).toString('utf8');let payload;try{payload=JSON.parse(body);}catch{payload=null;}resolve({status:res.statusCode,headers:res.headers,body,payload});});
  });req.setTimeout(20000,()=>req.destroy(new Error('Loopback request timed out')));req.on('error',reject);
  if(bytes&&options.chunked){const split=Math.max(1,Math.floor(bytes.length/3));req.write(bytes.subarray(0,split));req.write(bytes.subarray(split,split*2));req.end(bytes.subarray(split*2));}else req.end(bytes);
 });
}
async function check(name,fn){await fn();report.cases.push({name,status:'PASS'});console.log('PASS '+name);}
async function fixture(label,{organizationId='a32-org-a',enabled=true,status='ACTIVE'}={}){
 const n=++serial,projectId='a32-'+label,phoneNumberId=String(810000000000000+n),whatsappBusinessId=String(820000000000000+n);
 await db.project.create({data:{id:projectId,organizationId,name:'Synthetic ingress project',slug:projectId,status}});
 await db.whatsAppConnection.create({data:{id:projectId+'-connection',projectId,phoneNumberId,whatsappBusinessId,enabled,connectionStatus:'CONNECTED'}});
 return {projectId,organizationId,phoneNumberId,whatsappBusinessId};
}
const from='5491111111111',timestamp=String(Math.floor(Date.now()/1000));
const message=(id,text='Synthetic field message')=>({from,id,timestamp,type:'text',text:{body:text}});
const change=(f,messages,statuses=[])=>({field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:f.phoneNumberId},contacts:[{wa_id:from,profile:{name:'Synthetic participant'}}],messages,statuses}});
const envelope=(changes,waba='820000000000001')=>({object:'whatsapp_business_account',entry:[{id:waba,changes}]});
const queueSnapshot=async()=>JSON.stringify(await db.webhookEvent.findMany({orderBy:{id:'asc'}}));
const businessSnapshot=async()=>JSON.stringify({messages:await db.message.findMany({orderBy:{id:'asc'}}),sessions:await db.whatsAppFlowSession.findMany({orderBy:{id:'asc'}}),snapshots:await db.projectSnapshot.findMany({orderBy:{projectId:'asc'}}),audits:await db.auditLog.count()});
async function rejectWithoutWrite(payload,status,options={}){
 const before=await queueSnapshot(),scheduled=boundary.scheduled.length,r=await send(payload,options);
 assert.equal(r.status,status,r.body);assert.equal(await queueSnapshot(),before);assert.equal(boundary.scheduled.length,scheduled);assert.notEqual(r.payload?.received,true);return r;
}
try{
 await check('empty isolated TCP database, synthetic accounts and no provider credentials',async()=>{
  const rows=await db.$queryRawUnsafe('SELECT current_database() AS name, inet_server_port() AS port');assert.equal(rows[0].name,'obrasaas_execution_ci');assert.equal(rows[0].port,5432);assert.equal(await db.organization.count(),0);
  for(const [id,status] of [['a32-org-a','ACTIVE'],['a32-org-b','ACTIVE'],['a32-org-blocked','CANCELED']])await db.organization.create({data:{id,name:'Synthetic ingress tenant',slug:id,subscriptionPlan:'ENTERPRISE',subscriptionStatus:status}});
  await new Promise(done=>server.listen(0,'127.0.0.1',done));port=server.address().port;
 });
 const a=await fixture('primary'),b=await fixture('foreign',{organizationId:'a32-org-b'});
 await check('subscription challenge proves the verify token, not message-signature authority',async()=>{
  const before=await queueSnapshot();assert.equal((await send(null,{path:'/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token='+process.env.META_VERIFY_TOKEN+'&hub.challenge=a32-proof'})).body,'a32-proof');
  assert.equal((await send(null,{path:'/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=a32-proof'})).status,403);assert.equal(await queueSnapshot(),before);
 });
 await check('invalid, missing, wrong-domain and malformed signatures are rejected before persistence',async()=>{
  const body=JSON.stringify(envelope([change(a,[message('wamid.a32.rejected')])])),valid=sign(body);
  await rejectWithoutWrite(body,401,{noSignature:true});
  for(const signature of ['sha256='+'0'.repeat(64),valid+'=junk',valid+', '+valid,'sha1='+valid.slice(7),'sha256='+createHmac('sha256',process.env.META_VERIFY_TOKEN).update(body).digest('hex')])await rejectWithoutWrite(body,401,{signature});
  await rejectWithoutWrite(body+' ',401,{signature:valid});
  delete process.env.META_APP_SECRET;try{await rejectWithoutWrite(body,503);}finally{process.env.META_APP_SECRET=secret;}
 });
 await check('signed malformed JSON, UTF-8 and partial collections never enqueue a partial batch',async()=>{
  await rejectWithoutWrite('{',400);await rejectWithoutWrite(Buffer.from([0xff,0xfe]),400);
  await rejectWithoutWrite(envelope([change(a,[message('wamid.a32.partial'),null])]),400);
 });
 await check('raw-byte Unicode and whitespace signatures survive chunked transport',async()=>{
  const body=JSON.stringify(envelope([change(a,[message('wamid.a32.unicode','Revisi\u00f3n de obra \u00f1')])]),null,2);
  const escaped=body.replaceAll('\u00f1','\\u00f1').replaceAll('\u00f3','\\u00f3');
  await rejectWithoutWrite(escaped,401,{signature:sign(body),chunked:true});
  const result=await send(escaped,{chunked:true});assert.equal(result.status,200);assert.equal(result.payload.accepted,1);
 });
 await check('body and update boundaries fail without storage or after-response work',async()=>{
  const prefix='{"object":"whatsapp_business_account","entry":[],"padding":"',suffix='"}';
  const exact=prefix+'a'.repeat(META_WEBHOOK_MAX_BODY_BYTES-Buffer.byteLength(prefix+suffix))+suffix;
  assert.equal((await send(exact,{chunked:true})).status,200);
  await rejectWithoutWrite(exact+' ',413,{chunked:true});
  await rejectWithoutWrite(envelope(Array.from({length:META_WEBHOOK_MAX_UPDATES+1},()=>({field:'unhandled',value:{}}))),413);
  await rejectWithoutWrite('{}',415,{headers:{'content-type':'text/plain'}});
 });
 await check('mixed tenant message and status batch is durable before any drain or business effect',async()=>{
  const before=await businessSnapshot(),scheduled=boundary.scheduled.length;
  const r=await send(envelope([change(a,[message('wamid.a32.shared')],[{id:'wamid.a32.shared',status:'delivered',timestamp,recipient_id:from}]),change(b,[message('wamid.a32.shared')])]));
  assert.equal(r.status,200);assert.deepEqual(r.payload,{received:true,updates:2,accepted:3,duplicate:0,unknownConnections:0});
  const rows=await db.webhookEvent.findMany({where:{externalId:{contains:'wamid.a32.shared'}}});assert.equal(rows.length,3);assert.equal(new Set(rows.map(r=>r.projectId)).size,2);
  for(const row of rows){const f=row.projectId===a.projectId?a:b;assert.equal(row.payload.scope.organizationId,f.organizationId);assert.equal(row.payload.scope.phoneNumberId,f.phoneNumberId);assert.equal(row.status,'PENDING');assert.equal(row.appliedAt,null);}
  assert.equal(await businessSnapshot(),before);assert.equal(boundary.drains.length,0);assert.equal(boundary.scheduled.length,scheduled+1);
  await boundary.scheduled[scheduled]();assert.deepEqual(boundary.drains,[a.projectId,b.projectId].sort());assert.equal(await businessSnapshot(),before);
 });
 await check('concurrent replay and duplicates inside a signed batch persist one exact event',async()=>{
  const payload=envelope([change(a,[message('wamid.a32.concurrent'),message('wamid.a32.concurrent')])]);
  const results=await Promise.all([send(payload),send(payload)]);assert.ok(results.every(r=>r.status===200));assert.equal(results.reduce((s,r)=>s+r.payload.accepted,0),1);assert.equal(results.reduce((s,r)=>s+r.payload.duplicate,0),3);
  const before=await queueSnapshot();const replay=await send(payload);assert.equal(replay.payload.accepted,0);assert.equal(replay.payload.duplicate,2);assert.equal(await queueSnapshot(),before);
 });
 await check('unknown, disabled and paused destinations cannot fall back to the known account',async()=>{
  const disabled=await fixture('disabled',{enabled:false}),paused=await fixture('paused',{status:'PAUSED'}),before=await queueSnapshot(),scheduled=boundary.scheduled.length;
  const r=await send(envelope([change({...a,phoneNumberId:'899999999999999'},[message('wamid.a32.unknown')]),change(disabled,[message('wamid.a32.disabled')]),change(paused,[message('wamid.a32.paused')])],a.whatsappBusinessId));
  assert.equal(r.payload.accepted,0);assert.equal(r.payload.unknownConnections,3);assert.equal(await queueSnapshot(),before);assert.equal(boundary.scheduled.length,scheduled);
 });
 await check('blocked subscription messages are redacted and cannot schedule business processing',async()=>{
  const blocked=await fixture('blocked',{organizationId:'a32-org-blocked'}),scheduled=boundary.scheduled.length;
  const r=await send(envelope([change(blocked,[message('wamid.a32.blocked','PRIVATE_SUBSCRIPTION_CANARY')])]));assert.equal(r.status,200);assert.equal(r.payload.accepted,1);
  const row=await db.webhookEvent.findFirst({where:{projectId:blocked.projectId}});assert.equal(row.status,'FAILED');assert.deepEqual(row.payload,{version:1,redacted:true});assert.equal(row.nextAttemptAt,null);assert.equal(boundary.scheduled.length,scheduled);
 });
 await check('late SQL insert failure rolls back the complete batch and returns a private retryable response',async()=>{
  await db.$executeRawUnsafe(`CREATE FUNCTION a32_reject_ingress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."externalId" LIKE '%wamid.a32.rollback.second' THEN RAISE EXCEPTION 'PRIVATE_SQL_CANARY'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER a32_ingress_failure BEFORE INSERT ON "WebhookEvent" FOR EACH ROW EXECUTE FUNCTION a32_reject_ingress()`);
  const payload=envelope([change(a,[message('wamid.a32.rollback.first'),message('wamid.a32.rollback.second')])]);
  try{const r=await rejectWithoutWrite(payload,503);assert.equal(r.payload.code,'META_WEBHOOK_PERSISTENCE_UNAVAILABLE');assert.equal(r.body.includes('PRIVATE_SQL_CANARY'),false);assert.match(r.headers['cache-control'],/no-store/);}finally{await db.$executeRawUnsafe('DROP TRIGGER a32_ingress_failure ON "WebhookEvent"');await db.$executeRawUnsafe('DROP FUNCTION a32_reject_ingress()');}
  const r=await send(payload);assert.equal(r.status,200);assert.equal(r.payload.accepted,2);const replay=await send(payload);assert.equal(replay.payload.accepted,0);assert.equal(replay.payload.duplicate,2);
 });
 await check('a legitimate 1000-update delivery is accepted once and replayed without duplicate rows',async()=>{
  const f=await fixture('capacity'),payload=envelope(Array.from({length:META_WEBHOOK_MAX_UPDATES},(_,i)=>change(f,[message('wamid.a32.capacity.'+i)])));
  const r=await send(payload);assert.equal(r.status,200);assert.equal(r.payload.accepted,1000);assert.equal(await db.webhookEvent.count({where:{projectId:f.projectId}}),1000);
  const replay=await send(payload);assert.equal(replay.payload.accepted,0);assert.equal(replay.payload.duplicate,1000);
 });
 await check('signed raw Flow body is scrubbed, durably normalized and applied to the exact incident',async()=>{
  const f=await fixture('flow'),workerId=f.projectId+'-worker',phone=normalizeWorkerPhone(from);
  await db.worker.create({data:{id:workerId,organizationId:f.organizationId,projectId:f.projectId,phone,name:'Synthetic field manager',active:true,metadata:{whatsappRole:'SITE_MANAGER'}}});
  await db.projectSnapshot.create({data:{projectId:f.projectId,state:createEmptyAppState(),version:1}});
  const issued=await issueWhatsAppFlowSession(db,{...f,workerId,recipientPhone:phone,blueprintKey:'incident-report',flowId:'830000000000000',screenId:getWhatsAppFlowBlueprint('incident-report').screenId,flowType:'incident',sourceExternalId:'obrasaas-flow-template:a32-source'});
  const sentAt=new Date(),providerMessageId='wamid.a32.flow.sent',conversationId=f.projectId+'-conversation',sourceId=f.projectId+'-source';
  await db.whatsAppFlowSession.update({where:{id:issued.session.id},data:{deliveryAttemptedAt:sentAt,sentAt,providerMessageId}});
  await db.conversation.create({data:{id:conversationId,projectId:f.projectId,channel:'whatsapp',externalId:'meta:'+from}});
  await db.message.create({data:{id:sourceId,conversationId,direction:'OUTBOUND',kind:'INTERACTIVE',externalId:issued.session.sourceExternalId,providerMessageId,status:'delivered',body:'Synthetic request',createdAt:issued.session.createdAt,sentAt,metadata:{messageType:'whatsapp_flow_template',blueprintKey:'incident-report',flowSessionId:issued.session.id}}});
  const raw=message('wamid.a32.flow.received');raw.type='interactive';delete raw.text;
  raw.interactive={type:'nfm_reply',nfm_reply:{name:'flow',body:'Synthetic response',response_json:JSON.stringify({flow_token:issued.token,flow_type:'incident',severity:'high',area:'Synthetic area',description:'PRIVATE_FLOW_DESCRIPTION_CANARY'})}};
  const before=await businessSnapshot(),payload=envelope([change(f,[raw])]);const r=await send(payload);assert.equal(r.status,200);assert.equal(r.payload.accepted,1);assert.equal(await businessSnapshot(),before);
  const row=await db.webhookEvent.findFirst({where:{projectId:f.projectId}}),serialized=JSON.stringify(row.payload);
  assert.equal(serialized.includes(issued.token),false);assert.equal(serialized.includes('PRIVATE_FLOW_DESCRIPTION_CANARY'),false);
  const leased=await acquireWebhookEvent({projectId:f.projectId}),{event,scope}=deserializeWebhookPayload(leased.payload);await validateStoredWebhookScope(db,leased,event,scope);
  assert.equal(event.interactive.flowToken.sessionId,issued.session.id);assert.equal(event.interactive.response.flow_type,'incident');
  const result=await applyWebhookMessageAtomically({eventId:leased.id,leaseToken:leased.leaseToken,event,scope,apply:context=>processIncomingObraMessage(event,scope,{...context,persist:false,environment:{}})});
  assert.equal(result.alreadyApplied,false);assert.ok((await db.whatsAppFlowSession.findUnique({where:{id:issued.session.id}})).consumedAt);
  const linked=await readProactiveFlowIncident({prisma:db,access:{organization:{id:f.organizationId},project:{id:f.projectId}},conversationId,messageId:sourceId});assert.equal(linked.state,'available');
  const final=await businessSnapshot();assert.equal((await send(payload)).payload.duplicate,1);assert.equal(await businessSnapshot(),final);
 });
 await check('no provider HTTP, dispatcher delivery or adapter error is hidden by the harness',async()=>{
  assert.equal(externalCalls,0);assert.deepEqual(errors,[]);assert.equal(await db.whatsAppConnection.count({where:{encryptedAccessToken:{not:null}}}),0);
 });
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={code:error.code||error.name,message:String(error.message).slice(0,1600)};process.exitCode=1;}
finally{await new Promise(done=>{if(server.listening)server.close(done);else done();});await db.$disconnect();globalThis.fetch=previousFetch;delete globalThis.__obraSaasPrisma;delete globalThis.__a32IngressBoundary;mkdirSync('evidence',{recursive:true});writeFileSync('evidence/signed-webhook-ingress-postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
