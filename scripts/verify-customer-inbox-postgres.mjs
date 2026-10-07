import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {Client,Pool} from 'pg';
import {lifecycleDisposableUrl,lifecycleSchema,lifecycleEnvironment} from './fixtures/meta-signup-field-lifecycle-fixture.mjs';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createMetaCustomerOnboarding} from '../src/lib/meta-customer-onboarding.mjs';
import {encryptCustomerSecret} from '../src/lib/meta-customer-credentials.mjs';
import {metaCustomerContentDigest} from '../src/lib/meta-customer-callback.mjs';
import {createMetaCustomerInboxReview} from '../src/lib/meta-customer-inbox-review.mjs';
const url=lifecycleDisposableUrl(process.env),database='obrasaas_inbox_'+randomUUID().replaceAll('-',''),admin=new Client({connectionString:url.toString()});
const eventId=(tenant,n)=>'customer_webhook_'+createHash('sha256').update(tenant+'_'+n).digest('hex'),asset=(prefix,tenant)=>prefix+(tenant==='a'?'1':'2'),environment=lifecycleEnvironment,checks=[];
const sessions={a:{authenticated:true,verification:'clerk-production-jwt',userId:'user_CrmOwnerA',organizationId:'org_CrmA',organizationRole:'org:admin'},b:{authenticated:true,verification:'clerk-production-jwt',userId:'user_CrmOwnerB',organizationId:'org_CrmB',organizationRole:'org:admin'}};
function corruptAuthenticatedPayload(encrypted){
 const parts=encrypted.split('.'),original=Buffer.from(parts[3],'base64url');assert.equal(parts.length,4);assert.ok(original.length>0);
 // Alter an authenticated byte. Replacing encoded suffix characters can only
 // change ignored base64 padding bits and accidentally retain the same bytes.
 const altered=Buffer.from(original);altered[0]^=1;assert.equal(altered.equals(original),false);
 parts[3]=altered.toString('base64url');return parts.join('.');
}
let pool,created=false;
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:6}));await pool.query(lifecycleSchema);
 for(const tenant of ['a','b']){
  await pool.query(`INSERT INTO "Organization"(id,name,"clerkOrganizationId",metadata) VALUES($1,$2,$3,'{}')`,['company-'+tenant,'Empresa sintética '+tenant,sessions[tenant].organizationId]);
  await pool.query(`INSERT INTO "PlatformUser"(id,"clerkUserId","primaryEmail") VALUES($1,$2,$3)`,['owner-'+tenant,sessions[tenant].userId,'owner-'+tenant+'@example.invalid']);
  await pool.query(`INSERT INTO "TenantMembership"(id,"userId","organizationId","tenantRole","clerkRole",status) VALUES($1,$2,$3,'ADMIN','org:admin','ACTIVE')`,['member-'+tenant,'owner-'+tenant,'company-'+tenant]);
  await pool.query(`INSERT INTO "Project"(id,"organizationId",name,status,metadata) VALUES($1,$2,$3,'ACTIVE','{}')`,['project-'+tenant,'company-'+tenant,'Obra sintética '+tenant]);
  await pool.query(`INSERT INTO "WhatsAppConnection"(id,"projectId","phoneNumberId","whatsappBusinessId",enabled,"connectionStatus",metadata) VALUES($1,$2,$3,$4,false,'CONNECTED',$5::jsonb)`,['channel-'+tenant,'project-'+tenant,asset('12000001',tenant),asset('13000001',tenant),JSON.stringify({credentialFormat:'tenant-aad-v2',credentialOrganizationId:'company-'+tenant})]);
 }
 const workspace=createWorkspaceStore({connect:()=>pool.connect()}),provider={readiness:()=>({canLaunchMeta:false})},service=createMetaCustomerOnboarding({workspace,provider,environment});
 const accountA=await workspace.list(sessions.a),accountB=await workspace.list(sessions.b),contextA={projectId:'project-a',scope:accountA.scope},contextB={projectId:'project-b',scope:accountB.scope};
 async function seed(tenant,n,{processed=false,corrupt=false}={}){
  const id=eventId(tenant,n),payload={type:'message',wabaId:asset('13000001',tenant),phoneNumberId:asset('12000001',tenant),value:{from:'5491100001111',type:'text',text:{body:'Texto privado sintético '+n}}};
  const encryptedPayload=encryptCustomerSecret(JSON.stringify(payload),{organizationId:'company-'+tenant,projectId:'project-'+tenant,purpose:'webhook',resourceId:id},environment),metadata={organizationId:'company-'+tenant,channelId:'channel-'+tenant,payloadDigest:metaCustomerContentDigest(payload),encryptedPayload:corrupt?corruptAuthenticatedPayload(encryptedPayload):encryptedPayload};
  await pool.query(`INSERT INTO "WebhookEvent"(id,"projectId",provider,"externalId","eventType",status,payload,outcome,"createdAt","updatedAt") VALUES($1,$2,'meta-customer-v1',$1,'message',$3,$4::jsonb,$5::jsonb,$6,$6)`,[id,'project-'+tenant,processed?'PROCESSED':'PENDING',JSON.stringify(metadata),processed?JSON.stringify({version:1,reviewState:'REVIEW_REQUIRED',intent:'EVIDENCE',identity:{status:'UNKNOWN'},businessApplied:false}):null,'2026-10-01T12:00:00.'+String(n).padStart(6,'0')]);return id;
 }
 for(let i=1;i<=45;i++)await seed('a',i);const foreign=await seed('b',1);
 const first=await service.read(sessions.a,contextA);assert.equal(first.inbox.items.length,20);assert.equal(first.inbox.nextCursor,first.inbox.items[19].id);assert.equal(first.inbox.truncated,true);checks.push('first-page-20-authorized-encrypted-events-and-canonical-cursor');
 const inserted=await seed('a',46),second=await service.read(sessions.a,{...contextA,after:first.inbox.nextCursor}),third=await service.read(sessions.a,{...contextA,after:second.inbox.nextCursor});
 const loaded=[...first.inbox.items,...second.inbox.items,...third.inbox.items];assert.equal(loaded.length,45);assert.equal(new Set(loaded.map(item=>item.id)).size,45);assert.ok(!loaded.some(item=>item.id===inserted));assert.equal(third.inbox.nextCursor,null);assert.equal(third.inbox.items.length,5);assert.ok(loaded.every(item=>item.payloadVerified&&item.body.startsWith('Texto privado sintético')));checks.push('keyset-preserves-microsecond-order-and-has-no-duplicate-or-omitted-old-events-after-new-arrival');
 assert.equal((await service.read(sessions.a,contextA)).inbox.items[0].id,inserted);checks.push('explicit-refresh-discovers-new-arrival-without-rewriting-earlier-pages');
 await assert.rejects(service.read(sessions.a,{...contextA,after:foreign}),{code:'META_CUSTOMER_INBOX_CURSOR_UNAVAILABLE'});await assert.rejects(service.read(sessions.b,{...contextB,after:first.inbox.nextCursor}),{code:'META_CUSTOMER_INBOX_CURSOR_UNAVAILABLE'});await assert.rejects(service.read(sessions.b,contextA),{code:'WORKSPACE_CONTEXT_CHANGED'});checks.push('foreign-channel-cursor-and-cross-tenant-scope-fail-closed');
 const reviewed=await seed('a',47,{processed:true}),operationId=randomUUID(),review=createMetaCustomerInboxReview({workspace,environment});
 const before=await service.read(sessions.a,contextA),row=before.inbox.items.find(item=>item.id===reviewed);await review.command(sessions.a,{...contextA,action:'review_inbox',operationId,eventId:reviewed,expectedRevision:row.revision,decision:'REFER_TO_FIELD'});
 const receipt=await service.read(sessions.a,{...contextA,action:'review_inbox',operationId,eventId:reviewed});assert.equal(receipt.receipt.state,'RECORDED');assert.equal(receipt.receipt.actorOperationVerified,true);assert.equal(receipt.receipt.decision,'REFER_TO_FIELD');assert.ok(receipt.receipt.receiptId.startsWith('meta_inbox_request_'));assert.ok(!JSON.stringify(receipt.receipt).includes('Texto privado'));assert.ok(!JSON.stringify(receipt.receipt).includes('5491100001111'));checks.push('review-recovery-uses-actual-canonical-audit-receipt-without-message-or-phone');
 const missing=await service.read(sessions.a,{...contextA,action:'review_inbox',operationId:randomUUID(),eventId:reviewed});assert.equal(missing.receipt.state,'NOT_OBSERVED');assert.equal(missing.receipt.actorOperationVerified,false);checks.push('different-operation-cannot-claim-a-review-already-recorded-by-another-request');
 const state=await service.read(sessions.a,{...contextA,action:'process_inbox',operationId:randomUUID(),eventId:reviewed});assert.equal(state.receipt.state,'EVENT_PROCESSED');assert.equal(state.receipt.actorOperationVerified,false);assert.ok(!state.receipt.receiptId);checks.push('processed-event-state-is-observed-without-attributing-effect-to-browser-uuid');
 const pending=await service.read(sessions.a,{...contextA,action:'process_inbox',operationId:randomUUID(),eventId:eventId('a',1)});assert.equal(pending.receipt.state,'NOT_OBSERVED');assert.equal(pending.receipt.definitive,false);checks.push('pending-event-stays-unconfirmed-without-automatic-dispatch-or-send');
 await assert.rejects(service.read(sessions.a,{...contextA,action:'review_inbox',operationId,eventId:foreign}),{code:'META_CUSTOMER_INBOX_UNAVAILABLE'});checks.push('operation-recovery-cannot-read-foreign-event-even-with-valid-local-operation');
 const tampered=await seed('a',48,{processed:true,corrupt:true}),unverified=await service.read(sessions.a,contextA);assert.equal(unverified.inbox.items[0].payloadVerified,false);assert.equal(unverified.inbox.items[0].body,'');assert.equal(unverified.inbox.items[0].canProcess,false);await assert.rejects(service.read(sessions.a,{...contextA,action:'process_inbox',operationId:randomUUID(),eventId:tampered}),{code:'META_CUSTOMER_INBOX_PAYLOAD_UNVERIFIED'});checks.push('tampered-encrypted-event-cannot-expose-body-or-confirm-recovery');
 await pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='member-a'`);await assert.rejects(service.read(sessions.a,contextA),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});checks.push('revoked-canonical-membership-denies-pages-and-operation-recovery');
 const proof={status:'PASS',checks,realProviderCalls:0,productionDataWritten:false,fixture:'canonical-services-with-disposable-postgresql-and-synthetic-encrypted-events'};const evidence=path.join(process.cwd(),'.vercel/customer-inbox-evidence');mkdirSync(evidence,{recursive:true});writeFileSync(path.join(evidence,'postgresql.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}}
