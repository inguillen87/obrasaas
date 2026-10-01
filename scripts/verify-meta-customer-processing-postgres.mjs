import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool,Client} from 'pg';
import {createMetaCustomerInbox,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerProcessor,decodeSignedCustomerEvent} from '../src/lib/meta-customer-processing.mjs';
import {createMetaCustomerOutbound,customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {WorkspaceError} from '../src/lib/workspace-policy.mjs';
const source=process.env.CUTOVER_TEST_DATABASE_URL,url=new URL(source||'https://unconfigured.invalid');
assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.pathname,'/obrasaas_cutover_ci');
const database='obrasaas_processing_'+randomUUID().replaceAll('-',''),admin=new Client({connectionString:source}),environment={WHATSAPP_CREDENTIALS_ENCRYPTION_KEY:Buffer.alloc(32,41).toString('base64')};let pool,created=false,clock=Date.now(),sends=0,revoked=false,afterReserve=async()=>{};
const checked=[],connect=()=>pool.connect(),provider={sendReply:async()=>{sends++;throw new WorkspaceError('META_CUSTOMER_SEND_UNCONFIRMED',503);}};
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;pool=new Pool({connectionString:url.toString(),max:8});
 await pool.query(`CREATE TABLE "Project"(id text PRIMARY KEY,"organizationId" text,status text);
 CREATE TABLE "WhatsAppConnection"(id text PRIMARY KEY,"projectId" text UNIQUE,"phoneNumberId" text UNIQUE,"whatsappBusinessId" text,enabled boolean,"connectionStatus" text,"encryptedAccessToken" text,metadata jsonb);
 CREATE TYPE "WebhookStatus" AS ENUM('PENDING','PROCESSED','FAILED');
 CREATE TABLE "WebhookEvent"(id text PRIMARY KEY,"projectId" text,provider text,"externalId" text,"eventType" text,status "WebhookStatus",payload jsonb,"updatedAt" timestamp,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"processedAt" timestamp,"appliedAt" timestamp,"leaseToken" text,"leaseExpiresAt" timestamp,attempts int DEFAULT 0,outcome jsonb,"lastError" text,UNIQUE(provider,"externalId"));
 CREATE TABLE "CanonicalEffect"("eventId" text PRIMARY KEY,kind text);`);
 const metadata={credentialFormat:'tenant-aad-v2',credentialOrganizationId:'o1',customerActivation:{version:1,state:'ACTIVE',actorId:'admin1'},customerSubscribed:true,customerVerification:{registered:true,expiresAt:null,scopes:['business_management','whatsapp_business_management','whatsapp_business_messaging']}};
 await pool.query(`INSERT INTO "Project" VALUES('p1','o1','ACTIVE'),('p2','o2','ACTIVE')`);
 await pool.query(`INSERT INTO "WhatsAppConnection" VALUES('c1','p1','12345678901235','12345678901234',true,'CONNECTED',$1,$2::jsonb)`,[encryptCustomerSecret('synthetic-scoped-customer-token',{organizationId:'o1',projectId:'p1',purpose:'access-token',resourceId:'12345678901235'},environment),JSON.stringify(metadata)]);
 const inbox=createMetaCustomerInbox({connect,environment}),eventPayload=(suffix,extra={})=>({object:'whatsapp_business_account',entry:[{id:'12345678901234',changes:[{field:'messages',value:{metadata:{phone_number_id:'12345678901235'},messages:[{id:'wamid.SyntheticMessage_'+suffix,from:'5491112345678',timestamp:String(Math.floor(clock/1000)),type:'text',text:{body:'ayuda'},...extra}]}}]}]}),receive=async(suffix,extra={})=>(await inbox.record(splitMetaCustomerEvents(eventPayload(suffix,extra)),{signatureVerified:true})).eventIds[0];
 // Controlled resolver isolates transport durability; canonical membership,
 // KYC and cryptographic worker binding are tested by the identity PG suite.
 const resolveIdentity=async(client,{eventId})=>{
  if(revoked)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  const event=(await client.query(`SELECT *,status::text AS status FROM "WebhookEvent" WHERE id=$1 FOR UPDATE`,[eventId])).rows[0],connection=(await client.query(`SELECT * FROM "WhatsAppConnection" WHERE id='c1'`)).rows[0];connection.organizationId='o1';
  return {kind:'CHANNEL_VERIFIED',event,connection,project:{id:'p1'},member:{organizationId:'o1',actorId:'worker1'},worker:{id:'w1'},proof:decodeSignedCustomerEvent(event,connection,environment)};
 };
 const outbound=createMetaCustomerOutbound({connect,resolveIdentity,provider,environment,now:()=>clock,afterReserve:()=>afterReserve()}),dispatch=async context=>{
  if(context.channelId!=='c1')throw new Error('scope');
  if(revoked)throw new WorkspaceError('WORKER_CHANNEL_PERMISSION_REQUIRED',403);
  const row=(await pool.query(`SELECT "eventType" FROM "WebhookEvent" WHERE id=$1`,[context.eventId])).rows[0];if(row.eventType!=='message')return null;
  const client=await pool.connect();try{await client.query('BEGIN');await resolveIdentity(client,{eventId:context.eventId});await client.query(`INSERT INTO "CanonicalEffect" VALUES($1,'HELP') ON CONFLICT DO NOTHING`,[context.eventId]);await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  return {businessApplied:true,kind:'HELP',receiptId:'receipt_'+context.eventId,identityStatus:'VERIFIED',workerId:'w1',reply:{type:'text',body:'Menú de esta obra'}};
 },processor=createMetaCustomerProcessor({connect,dispatch,outbound,environment,now:()=>clock});
 const first=await receive('unknown');const processed=await processor.process(first);assert.equal(processed.businessApplied,true);assert.equal(processed.replySent,false);assert.equal(processed.replyState,'SEND_UNKNOWN');assert.equal(sends,1);assert.equal((await processor.process(first)).done,true);assert.equal(sends,1);assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "CanonicalEffect"`)).rows[0].n,1);checked.push('durable-canonical-effect-and-reservation-before-send; uncertain-post-never-retransmitted');
 const initial=(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[first])).rows[0];assert.ok(!JSON.stringify(initial.outcome).includes('5491112345678'));assert.ok(initial.appliedAt);assert.ok(!JSON.stringify((await pool.query(`SELECT payload FROM "WebhookEvent" WHERE provider='meta-customer-outbound-v1'`)).rows).includes('Menú de esta obra'));
 const statusPayload={object:'whatsapp_business_account',entry:[{id:'12345678901234',changes:[{field:'messages',value:{metadata:{phone_number_id:'12345678901235'},statuses:[{id:'wamid.SyntheticOutbound01',status:'delivered',timestamp:String(Math.floor(clock/1000)),recipient_id:'5491112345678',biz_opaque_callback_data:customerOutboundId(first)}]}}]}]};
 const statusId=(await inbox.record(splitMetaCustomerEvents(statusPayload),{signatureVerified:true})).eventIds[0];await processor.process(statusId);const observed=await outbound.result({eventId:first,projectId:'p1',channelId:'c1'});assert.equal(observed.state,'STATUS_OBSERVED');assert.equal(observed.providerStatus,'delivered');assert.equal(observed.replySent,true);assert.equal(sends,1);checked.push('signed-provider-status-correlates-uncertain-post-without-new-send');
 const revokedId=await receive('revoked');revoked=true;const denied=await processor.process(revokedId);assert.equal(denied.businessApplied,false);assert.equal(denied.replySent,false);assert.equal(sends,1);revoked=false;checked.push('revoked-participant-observed-without-mutation-or-send');
 const raceId=await receive('race');afterReserve=async()=>{revoked=true;};const race=await processor.process(raceId);assert.equal(race.replySent,false);assert.equal(sends,1);revoked=false;afterReserve=async()=>{};checked.push('permission-revalidated-after-reservation-before-provider-post');
 const crossId=await receive('cross'),lease=randomUUID();await pool.query(`UPDATE "WebhookEvent" SET "leaseToken"=$2,"leaseExpiresAt"=$3 WHERE id=$1`,[crossId,lease,new Date(clock+60000)]);const crossRow=(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[crossId])).rows[0];await assert.rejects(outbound.send({eventId:crossId,payloadDigest:crossRow.payload.payloadDigest,leaseToken:lease,projectId:'p2',channelId:'c1'},{type:'text',body:'Menú de esta obra'}),{code:'META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED'});assert.equal(sends,1);checked.push('tenant-context-cannot-cross-canonical-resolved-proof');
 const leaseId=await receive('lease'),old=createMetaCustomerProcessor({connect,dispatch,outbound,environment,now:()=>clock,afterClaim:async()=>{clock+=61000;await processor.process(leaseId);}});await assert.rejects(old.process(leaseId),{code:'META_CUSTOMER_OUTBOUND_CONTEXT_CHANGED'});assert.equal((await pool.query(`SELECT status::text AS status FROM "WebhookEvent" WHERE id=$1`,[leaseId])).rows[0].status,'PROCESSED');checked.push('expired-worker-is-fenced-after-new-worker-completes');
 const unsigned=(await inbox.record(splitMetaCustomerEvents(eventPayload('unsigned')))).eventIds[0];await assert.rejects(processor.process(unsigned),{code:'META_CUSTOMER_EVENT_PROOF_REQUIRED'});assert.equal((await pool.query(`SELECT status::text AS status FROM "WebhookEvent" WHERE id=$1`,[unsigned])).rows[0].status,'PENDING');assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "CanonicalEffect" WHERE "eventId"=$1`,[unsigned])).rows[0].n,0);clock+=120000;assert.ok(!(await processor.recover()).results.some(row=>row.eventId===unsigned));checked.push('legacy-unsigned-inbox-cannot-gain-authority-by-mutable-flag-or-loop-in-periodic-recovery');
 console.log(JSON.stringify({passed:true,checks:checked,realProviderCalls:0},null,2));
}finally{
 await pool?.end();if(created){await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1',[database]);await admin.query(`DROP DATABASE "${database}"`);}await admin.end();
}
