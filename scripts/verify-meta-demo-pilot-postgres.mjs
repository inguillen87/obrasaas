import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {lifecycleDisposableUrl} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {demoSchema,demoEnvironment,demoSession,demoParticipant,demoSender,seedDemoPilot,createControlledDemoGraph,demoEnvelope,signedDemoRequest} from './fixtures/meta-demo-pilot-fixture.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createMetaDemoPilot} from '../src/lib/meta-demo-pilot.mjs';
import {createMetaAppCallback} from '../src/lib/meta-app-callback.mjs';
import {createFieldOperations} from '../src/lib/field-operations-store.mjs';
import {META_DEMO_NOTICE_VERSION,META_DEMO_NOTICE_SHA256,decodeDemoPilotGrant} from '../src/lib/meta-demo-pilot-policy.mjs';
import {META_CUSTOMER_PROTOCOL,META_DEMO_PILOT_PROTOCOL,metaCloudEventId} from '../src/lib/meta-cloud-protocol.mjs';
import {splitMetaDemoPilotEvents,splitMetaCustomerEvents} from '../src/lib/meta-customer-callback.mjs';
import {decodeWorkerChannelProof,resolveWorkerTemplateRecipient} from '../src/lib/worker-channel-identity.mjs';
import {customerOutboundId} from '../src/lib/meta-customer-outbound.mjs';
import {OBRASAAS_META_CHANNEL} from '../src/lib/meta-channel-binding.mjs';

const base=lifecycleDisposableUrl(process.env),database='obrasaas_demo_pilot_'+randomUUID().replaceAll('-',''),admin=new Client({connectionString:base.toString()}),checks=[];
let pool,created=false,failAudit=false,loseCommit=false,failInbox=false,analyses=0;
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;base.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:base.toString(),max:8}));await pool.query(demoSchema);await seedDemoPilot(pool);
 const connect=async()=>{const c=await pool.connect();return {release:broken=>c.release(broken),query:async(sql,args)=>{if(failAudit&&sql.startsWith('INSERT INTO public."AuditLog"'))throw Error('SYNTHETIC_DEMO_AUDIT_ROLLBACK');if(failInbox&&sql.startsWith('INSERT INTO public."WebhookEvent"'))throw Error('SYNTHETIC_DEMO_INBOX_ROLLBACK');const result=await c.query(sql,args);if(loseCommit&&sql==='COMMIT'){loseCommit=false;throw Error('SYNTHETIC_DEMO_COMMIT_ACK_LOST');}return result;}};};
 const workspace=createWorkspaceStore({connect}),graph=createControlledDemoGraph(),context={projectId:'demo-project',scope:(await workspace.list(demoSession)).scope};
 const analyzer={analyzePhoto:async()=>{analyses++;return {success:true,status:'ANALYZED_UNREVIEWED',aiAnalysis:'Synthetic image analysis only. Human review required.',requiresHumanReview:true};},transcribeAudio:async()=>({success:false,code:'SYNTHETIC_AUDIO_NOT_REQUESTED'})};
 const runtime=()=>createMetaDemoPilot({connect,workspace,environment:demoEnvironment,fetchImpl:graph.fetchImpl,put:graph.blob.put,get:graph.blob.get,analyzer});let demo=runtime();
 const read=()=>demo.service.read(demoSession,context),own=async()=> (await read()).participants[0];
 const command=async(action,extra={})=>({...context,operationId:randomUUID(),action,payload:{workerId:'demo-worker',revision:(await own()).revision,...(action==='PREPARE'?{noticeVersion:META_DEMO_NOTICE_VERSION,noticeSha256:META_DEMO_NOTICE_SHA256,confirmed:true,confirmedSandbox:true}:{}),...extra}});
 const prepare=await command('PREPARE');assert.equal((await read()).state,'NOT_PREPARED');
 await assert.rejects(demo.service.command({...demoSession,organizationRole:'org:member'},prepare),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 await assert.rejects(demo.service.command(demoSession,{...prepare,projectId:'foreign-project'}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 await assert.rejects(demo.service.command(demoSession,{...prepare,scope:'0'.repeat(64)}),{code:'WORKSPACE_CONTEXT_CHANGED'});
 await assert.rejects(demo.service.command(demoSession,{...prepare,payload:{...prepare.payload,confirmedSandbox:false}}),{code:'META_DEMO_PILOT_CONSENT_REQUIRED'});
 await pool.query(`UPDATE "Worker" SET metadata=jsonb_set(metadata,'{participant,kyc,status}','"REJECTED"'::jsonb) WHERE id='demo-worker'`);await assert.rejects(demo.service.command(demoSession,prepare),{code:'WORKER_CHANNEL_KYC_REVIEW_REQUIRED'});await pool.query(`UPDATE "Worker" SET metadata=$1::jsonb WHERE id='demo-worker'`,[JSON.stringify({participant:demoParticipant})]);
 assert.equal(graph.calls.length,0);checks.push('canonical-admin-selected-tenant-own-assignment-KYC-and-both-explicit-notices-before-provider-read');

 for(const table of ['PurchaseOrder','SitePhoto']){await pool.query(`INSERT INTO "${table}" VALUES('occupied','demo-project')`);await assert.rejects(demo.service.command(demoSession,prepare),{code:'META_DEMO_EMPTY_PROJECT_REQUIRED'});await pool.query(`DELETE FROM "${table}"`);}
 await pool.query(`INSERT INTO "Incident"(id,"projectId",metadata) VALUES('material-only','demo-project','{"siteRegister":{"version":1,"type":"MATERIAL_REQUEST"}}')`);await assert.rejects(demo.service.command(demoSession,prepare),{code:'META_DEMO_EMPTY_PROJECT_REQUIRED'});await pool.query(`DELETE FROM "Incident"`);
 await pool.query(`INSERT INTO "Worker"(id,"projectId",name,phone,metadata) VALUES('extra','demo-project','Extra synthetic person','+5491100002222','{}')`);await assert.rejects(demo.service.command(demoSession,prepare),{code:'META_DEMO_EMPTY_PROJECT_REQUIRED'});await pool.query(`DELETE FROM "Worker" WHERE id='extra'`);
 assert.equal(graph.calls.length,0);checks.push('material-only-order-photo-or-second-worker-worksite-cannot-be-converted-to-sandbox');

 let injected=false;graph.setBeforeGet(async()=>{if(!injected){injected=true;await pool.query(`INSERT INTO "PurchaseOrder" VALUES('late-order','demo-project')`);}});
 await assert.rejects(demo.service.command(demoSession,prepare),{code:'META_DEMO_EMPTY_PROJECT_REQUIRED'});graph.setBeforeGet(async()=>{});await pool.query(`DELETE FROM "PurchaseOrder"`);
 assert.equal((await read()).state,'NOT_PREPARED');assert.equal(graph.posts(),0);checks.push('fresh-empty-project-fence-after-readonly-Graph-observation-rejects-late-business-activity');

 failAudit=true;await assert.rejects(demo.service.command(demoSession,prepare),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});failAudit=false;assert.equal((await read()).state,'NOT_PREPARED');assert.equal((await demo.service.read(demoSession,{...context,operationId:prepare.operationId})).state,'NOT_OBSERVED');
 loseCommit=true;await assert.rejects(demo.service.command(demoSession,prepare),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});const recovered=await demo.service.read(demoSession,{...context,operationId:prepare.operationId});assert.equal(recovered.state,'RECORDED');assert.equal(recovered.identityCertified,false);assert.equal(recovered.productionVerified,false);
 const reads=graph.calls.length;assert.equal((await demo.service.command(demoSession,prepare)).replayed,true);assert.equal(graph.calls.length,reads);await assert.rejects(demo.service.command(demoSession,{...prepare,payload:{...prepare.payload,revision:'2026-10-02T02:00:00.000001'}}),{code:'META_DEMO_OPERATION_CONFLICT'});
 assert.equal(graph.posts(),0);checks.push('atomic-grant-audit-rollback-lost-COMMIT-readonly-receipt-replay-and-conflicting-UUID-without-provider-write');

 const connection=async()=>({...((await pool.query(`SELECT *,"connectionStatus"::text AS "connectionStatus" FROM "WhatsAppConnection" WHERE "projectId"='demo-project'`)).rows[0]),organizationId:'demo-org'});
 const c=await connection(),grant=decodeDemoPilotGrant(c,demoEnvironment);assert.equal(c.metadata.credentialFormat,'demo-tenant-aad-v2');assert.equal(c.metadata.customerVerification,undefined);assert.equal(c.metadata.customerActivation,undefined);assert.equal(grant.senderE164,'+'+demoSender);assert.ok(!JSON.stringify(c).includes(demoSender));assert.ok(!JSON.stringify(c).includes(demoEnvironment.META_WHATSAPP_ACCESS_TOKEN));assert.equal((await read()).participants[0].channelState,'NOT_LINKED');
 checks.push('separate-purpose-encrypted-credential-grant-and-provider-observation-never-create-commercial-activation');

 let wakeIds=[];const callback=createMetaAppCallback({connect,environment:demoEnvironment,schedule:ids=>{wakeIds.push(...ids);}});
 const receive=async(body,options={})=>{const payload=demoEnvelope(body,{id:'wamid.SyntheticDemoInbound_'+randomUUID().replaceAll('-',''),...options}),eventId=metaCloudEventId(META_DEMO_PILOT_PROTOCOL,splitMetaDemoPilotEvents(payload)[0].externalId),response=await callback.POST(signedDemoRequest(payload));return {eventId,payload,response};};
 const unknown=await receive('MENU',{sender:'5491100002222'});assert.equal(unknown.response.status,403);assert.equal(wakeIds.length,0);
 failInbox=true;const failedInbox=await receive('MENU');assert.equal(failedInbox.response.status,503);failInbox=false;assert.equal(wakeIds.length,0);assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n,0);
 checks.push('signed-callback-rejects-unknown-sender-and-failed-durable-inbox-without-ACK-or-wakeup');

 const challenge=await demo.service.command(demoSession,await command('REQUEST_CHALLENGE'));assert.match(challenge.code,/^VINCULAR /);assert.ok(!(JSON.stringify(await read())).includes(challenge.code));assert.equal((await own()).challenge.expired,false);
 const bound=await receive(challenge.code);assert.equal(bound.response.status,200);assert.equal(graph.posts(),0);assert.equal((await pool.query(`SELECT status::text AS status FROM "WebhookEvent" WHERE id=$1`,[bound.eventId])).rows[0].status,'PENDING');
 assert.equal((await demo.processor.process(bound.eventId)).kind,'CHANNEL_BOUND');assert.equal((await own()).channelState,'VERIFIED');assert.match(graph.messages.get(customerOutboundId(bound.eventId)).body.text.body,/DEMO/);
 const proof=(await pool.query(`SELECT * FROM "WebhookEvent" WHERE id=$1`,[bound.eventId])).rows[0];assert.throws(()=>decodeWorkerChannelProof(proof,c,demoEnvironment),{code:'WORKER_CHANNEL_SIGNED_PROOF_REQUIRED'});assert.equal(decodeWorkerChannelProof(proof,c,demoEnvironment,META_DEMO_PILOT_PROTOCOL).senderE164,grant.senderE164);
 const replay=await callback.POST(signedDemoRequest(bound.payload));assert.equal(replay.status,200);assert.equal((await demo.processor.process(bound.eventId)).done,true);assert.equal(graph.posts(),1);
 checks.push('durable-HMAC-AAD-challenge-to-canonical-binding-before-reply-replay-single-send-and-customer-proof-isolation');

 const execute=async(body,options={})=>{const input=await receive(body,options);assert.equal(input.response.status,200);const result=await demo.processor.process(input.eventId);return {...input,result,reply:graph.messages.get(customerOutboundId(input.eventId))?.body};};
 const menu=await execute('MENU');assert.equal(menu.reply.type,'interactive');assert.equal(menu.reply.interactive.action.sections[0].rows.length,10);assert.match(menu.reply.interactive.body.text,/DEMO/);const beforeMenu=graph.posts();await demo.processor.process(menu.eventId);assert.equal(graph.posts(),beforeMenu);
 const holder=await pool.connect();try{await holder.query('BEGIN');await assert.rejects(resolveWorkerTemplateRecipient(holder,{organizationId:'demo-org',projectId:context.projectId,workerId:'demo-worker',environment:demoEnvironment}),{code:'WORKER_CHANNEL_CUSTOMER_CONNECTION_REQUIRED'});}finally{await holder.query('ROLLBACK');holder.release();}
 checks.push('ten-command-verified-participant-menu-reuses-canonical-conversation-with-no-proactive-template-lane');

 const operations=createFieldOperations({workspace}),projectRevision=(await pool.query(`SELECT to_char("updatedAt",'YYYY-MM-DD"T"HH24:MI:SS.US') AS revision FROM "Project" WHERE id='demo-project'`)).rows[0].revision;
 await operations.save(demoSession,{...context,operationId:randomUUID(),action:'CONFIGURE_SITE',payload:{revision:projectRevision,sectors:[{id:'demo-sector',name:'Sector sintético',latitude:-34.6,longitude:-58.4,radius:200}]}});
 const choose=(reply,index=0)=>({type:'list_reply',list_reply:{id:reply.interactive.action.sections[0].rows[index].id}});
 let step=await execute('ENTRADA');step=await execute(choose(step.reply),{type:'interactive'});step=await execute(choose(step.reply),{type:'interactive'});step=await execute({latitude:-34.6,longitude:-58.4},{type:'location'});step=await execute(choose(step.reply),{type:'interactive'});
 assert.equal(step.result.businessApplied,true);const attendance=(await pool.query(`SELECT metadata FROM "AttendanceEntry" WHERE "projectId"='demo-project'`)).rows;assert.equal(attendance.length,1);assert.equal(attendance[0].metadata.fieldOperations.verificationStatus,'REVIEW_REQUIRED');assert.equal(attendance[0].metadata.fieldOperations.location.accuracyMeters,null);assert.equal(attendance[0].metadata.fieldOperations.qrStatus,'NOT_PROVIDED');
 checks.push('entry-confirmation-writes-sandbox-canonical-attendance-with-unknown-GPS-accuracy-and-no-invented-QR');

 step=await execute('INCIDENCIA');step=await execute(choose(step.reply),{type:'interactive'});step=await execute(choose(step.reply),{type:'interactive'});step=await execute('Incidencia sintética');step=await execute('Detalle controlado para verificar el origen del piloto.');step=await execute(choose(step.reply),{type:'interactive'});step=await execute(choose(step.reply),{type:'interactive'});
 assert.equal(step.result.businessApplied,true);assert.equal(attendance[0].metadata.fieldOperations.source,'meta-demo-pilot');
 const reportOrigin=(await pool.query(`SELECT metadata FROM "Incident" WHERE metadata->'siteRegister'->>'type'='ISSUE'`)).rows[0];assert.equal(reportOrigin.metadata.siteRegister.source,'participant-whatsapp-demo');
 const fieldAudits=(await pool.query(`SELECT metadata FROM "AuditLog" WHERE action='field.operation.recorded' AND metadata->>'command' IN ('ATTENDANCE','REPORT_INCIDENT')`)).rows;assert.equal(fieldAudits.length,2);assert.ok(fieldAudits.every(row=>row.metadata.channelProof.provider===META_DEMO_PILOT_PROTOCOL.provider));
 checks.push('sandbox-attendance-and-report-origin-match-internal-signed-protocol-and-canonical-audit-without-commercial-label');

 await workspace.createTask(demoSession,{...context,operationId:randomUUID(),title:'Tarea sintética del piloto',startsOn:'',endsOn:''});
 step=await execute('EVIDENCIA');step=await execute(choose(step.reply),{type:'interactive'});step=await execute(choose(step.reply),{type:'interactive'});step=await execute({id:'150000099',mime_type:'image/png'},{type:'image'});
 assert.equal(step.result.businessApplied,true);assert.equal(graph.blob.puts(),1);assert.equal(analyses,1);const evidence=(await pool.query(`SELECT metadata FROM "Incident" WHERE metadata->'fieldOperations'->>'kind'='EVIDENCE'`)).rows[0];assert.equal(evidence.metadata.fieldOperations.processing.humanReviewRequired,true);assert.notEqual(evidence.metadata.fieldOperations.review?.decision,'APPROVE');assert.equal((await pool.query(`SELECT progress FROM "Task"`)).rows[0].progress,0);
 checks.push('Graph-media-id-only-authorized-download-private-hash-readback-and-synthetic-analysis-never-auto-approve-progress');

 graph.loseNextSend();const lost=await execute('ESTADO');assert.equal(lost.result.replySent,false);assert.equal((await demo.outbound.result({eventId:lost.eventId,projectId:context.projectId,channelId:c.id})).state,'SEND_UNKNOWN');const lostPosts=graph.posts();demo=runtime();await demo.processor.process(lost.eventId);assert.equal(graph.posts(),lostPosts);
 const sent=graph.messages.get(customerOutboundId(lost.eventId)),status={object:'whatsapp_business_account',entry:[{id:OBRASAAS_META_CHANNEL.wabaId,changes:[{field:'messages',value:{metadata:{phone_number_id:OBRASAAS_META_CHANNEL.phoneNumberId},statuses:[{id:sent.id,status:'delivered',timestamp:String(Math.floor(Date.now()/1000)),recipient_id:demoSender,biz_opaque_callback_data:customerOutboundId(lost.eventId)}]}}]}]};
 assert.equal((await callback.POST(signedDemoRequest(status))).status,200);await demo.processor.process(metaCloudEventId(META_DEMO_PILOT_PROTOCOL,splitMetaDemoPilotEvents(status)[0].externalId));assert.equal((await demo.outbound.result({eventId:lost.eventId,projectId:context.projectId,channelId:c.id})).providerStatus,'delivered');assert.equal(graph.posts(),lostPosts);
 checks.push('uncertain-send-persists-with-no-auto-resend-and-only-signed-correlated-status-confirms-delivery');

 const pending=await receive('MENU');const beforeRevoke=graph.posts();await pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='demo-member'`);const revokedMembership=await demo.processor.process(pending.eventId);assert.equal(revokedMembership.businessApplied,false);assert.equal(revokedMembership.replySent,false);assert.equal(graph.posts(),beforeRevoke);await pool.query(`UPDATE "TenantMembership" SET status='ACTIVE' WHERE id='demo-member'`);
 const revoke=await demo.service.command(demoSession,await command('REVOKE'));assert.equal(revoke.state,'RECORDED');assert.equal((await read()).state,'INACTIVE');assert.equal((await receive('MENU')).response.status,409);assert.equal(graph.posts(),beforeRevoke);
 const renewed=await demo.service.command(demoSession,await command('PREPARE'));assert.notEqual(renewed.receipt.id,grant.grantId);assert.equal((await own()).channelState,'UNLINKED');const renewedConnection=await connection();assert.throws(()=>decodeWorkerChannelProof(proof,renewedConnection,demoEnvironment,META_DEMO_PILOT_PROTOCOL),{code:'WORKER_CHANNEL_SIGNED_PROOF_REQUIRED'});
 checks.push('current-membership-revocation-grant-revoke-and-renewal-invalidate-old-proof-and-never-trigger-reply');

 await pool.query(`INSERT INTO "WhatsAppConnection"(id,"projectId","phoneNumberId","whatsappBusinessId",metadata) VALUES('foreign-customer','foreign-project','120000011','130000011','{"credentialFormat":"tenant-aad-v2","credentialOrganizationId":"foreign-org"}')`);
 const customer=demoEnvelope('MENU');customer.entry[0].id='130000011';customer.entry[0].changes[0].value.metadata.phone_number_id='120000011';const mixed={object:'whatsapp_business_account',entry:[...demoEnvelope('MENU',{id:'wamid.MixedDemoValid_0001'}).entry,...customer.entry]},beforeMixed=(await pool.query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n;
 assert.equal((await callback.POST(signedDemoRequest(mixed))).status,200);const mixedDemoId=metaCloudEventId(META_DEMO_PILOT_PROTOCOL,splitMetaDemoPilotEvents({...mixed,entry:[mixed.entry[0]]})[0].externalId),mixedCustomerId=metaCloudEventId(META_CUSTOMER_PROTOCOL,splitMetaCustomerEvents(customer)[0].externalId);const mixedRows=(await pool.query(`SELECT id,provider,payload FROM "WebhookEvent" WHERE id=ANY($1::text[])`,[[mixedDemoId,mixedCustomerId]])).rows;assert.equal(mixedRows.length,2);assert.deepEqual(new Set(mixedRows.map(r=>r.provider)),new Set([META_CUSTOMER_PROTOCOL.provider,META_DEMO_PILOT_PROTOCOL.provider]));assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n,beforeMixed+2);
 const badMixed=structuredClone(mixed);badMixed.entry[0].changes[0].value.messages[0].id='wamid.MixedDemoInvalid_0001';badMixed.entry[1].id='130000099';const countBeforeRollback=(await pool.query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n;assert.equal((await callback.POST(signedDemoRequest(badMixed))).status,403);assert.equal((await pool.query(`SELECT count(*)::int AS n FROM "WebhookEvent"`)).rows[0].n,countBeforeRollback);
 checks.push('app-level-mixed-customer-and-Demo-batch-persists-distinct-namespaces-atomically-and-rejects-crossed-assets');

 const report={status:'PASS',environment:'local-disposable-postgresql',checks,provider:'strict-controlled-Graph-fetch-only',webIdentity:'controlled-canonical-session-not-real-Clerk-JWT',kyc:'synthetic-existing-reviewed-fixture-not-civil-identity',blob:'controlled-private-byte-store',analyzer:'controlled-synthetic-image-only',realProviderCalls:0,productionDataTouched:false,realWhatsAppReceived:false,realMetaAccepted:false,identityCertified:false,biometricIdentityVerified:false,humanAccepted:false};
 mkdirSync('.vercel/meta-demo-pilot-evidence',{recursive:true});writeFileSync('.vercel/meta-demo-pilot-evidence/postgres.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}}
