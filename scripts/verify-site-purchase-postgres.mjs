import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Client,Pool} from 'pg';
import {trackDisposablePool,closeDisposablePool} from './lib/disposable-postgres-cleanup.mjs';
import {createWorkspaceStore} from '../src/lib/workspace-store.mjs';
import {createSiteRegister} from '../src/lib/site-register-store.mjs';
import {createSitePurchases} from '../src/lib/site-purchase-store.mjs';
import {createOperationsStatus} from '../src/lib/operations-status.mjs';
import {META_CUSTOMER_PROOF_REVIEW_CODES} from '../src/lib/meta-customer-processing.mjs';
const url=new URL(process.env.CUTOVER_TEST_DATABASE_URL||'http://missing');
assert.equal(process.env.CUTOVER_TEST_DISPOSABLE,'1');assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));assert.equal(url.pathname,'/obrasaas_cutover_ci');assert.equal(url.search,'');
const database='obrasaas_purchase_'+randomUUID().replaceAll('-',''),admin=new Client({connectionString:url.toString()});
let pool,created=false;const checks=[];
const session=(user,org='org_A',role='org:admin')=>({authenticated:true,verification:'clerk-production-jwt',userId:user,organizationId:org,organizationRole:role});
const owner=session('user_Owner'),auditor=session('user_Auditor','org_A','org:member'),foreign=session('user_Foreign','org_B');
try {
 await admin.connect();await admin.query(`CREATE DATABASE "${database}"`);created=true;url.pathname='/'+database;pool=trackDisposablePool(new Pool({connectionString:url.toString(),max:8}));
 await pool.query(`
  CREATE TYPE "IncidentSeverity" AS ENUM('INFO','LOW','MEDIUM','HIGH','CRITICAL');
  CREATE TABLE "Organization"(id text PRIMARY KEY,name text,"clerkOrganizationId" text UNIQUE,metadata jsonb);
  CREATE TABLE "PlatformUser"(id text PRIMARY KEY,"clerkUserId" text UNIQUE NOT NULL);
  CREATE TABLE "TenantMembership"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","userId" text REFERENCES "PlatformUser","tenantRole" text,"clerkRole" text,status text,UNIQUE("organizationId","userId"));
  CREATE TABLE "Project"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization",name text,status text,metadata jsonb,"updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "ProjectMembership"(id text PRIMARY KEY,"projectId" text REFERENCES "Project","tenantMembershipId" text REFERENCES "TenantMembership",status text);
  CREATE TABLE "Incident"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",title text,description text,severity "IncidentSeverity",status text,reporter text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,"updatedAt" timestamp);
  CREATE TABLE "AuditLog"(id text PRIMARY KEY,"organizationId" text REFERENCES "Organization","actorId" text REFERENCES "PlatformUser",action text,"entityType" text,"entityId" text,metadata jsonb,"createdAt" timestamp DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE "Worker"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",active boolean,metadata jsonb);
  CREATE TABLE "AttendanceEntry"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",metadata jsonb);
  CREATE TABLE "OperationalProposal"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",status text,action jsonb,"expiresAt" timestamp DEFAULT CURRENT_TIMESTAMP+interval '7 days',type text DEFAULT 'TASK_PROGRESS',"sourceProvider" text DEFAULT 'account-field');
  CREATE TABLE "WebhookEvent"(id text PRIMARY KEY,"projectId" text REFERENCES "Project",status text,provider text,payload jsonb,outcome jsonb,"leaseToken" text,"leaseExpiresAt" timestamp,"lastError" text);
  INSERT INTO "Organization" VALUES('company-a','Synthetic A','org_A','{}'),('company-b','Synthetic B','org_B','{}');
  INSERT INTO "PlatformUser" VALUES('owner','user_Owner'),('auditor','user_Auditor'),('foreign','user_Foreign');
  INSERT INTO "TenantMembership" VALUES('owner-m','company-a','owner','ADMIN','org:admin','ACTIVE'),('auditor-m','company-a','auditor','AUDITOR','org:member','ACTIVE'),('foreign-m','company-b','foreign','ADMIN','org:admin','ACTIVE');
  INSERT INTO "Project" VALUES('p-a','company-a','Site A','ACTIVE','{"keep":true}',CURRENT_TIMESTAMP),('p-b','company-b','Site B','ACTIVE','{}',CURRENT_TIMESTAMP);
  INSERT INTO "ProjectMembership" VALUES('auditor-p','p-a','auditor-m','ACTIVE');
 `);
 const workspace=createWorkspaceStore({connect:()=>pool.connect()}),register=createSiteRegister({workspace}),store=createSitePurchases({workspace});
 const own=await workspace.list(owner),other=await workspace.list(foreign),readonly=await workspace.list(auditor),context={projectId:'p-a',scope:own.scope};
 const input=(action,payload)=>({...context,operationId:randomUUID(),action,payload});
 const request=await register.save(owner,input('REQUEST_MATERIAL',{material:'Cemento sintético',quantity:'12.5',unit:'bolsa',sector:'Planta baja',details:'Pedido de ensayo para recepción controlada.'}));
 const draft=input('DRAFT_ORDER',{requestId:request.report.id,revision:request.report.revision,supplier:'Proveedor de ensayo',quantity:'12.500',unitPrice:'123.45',currency:'ARS',reference:'Cotización 01',reason:'Importe respaldado por cotización de ensayo.'});
 const attempts=await Promise.all([store.save(owner,draft),store.save(owner,draft),store.save(owner,draft)]);
 assert.equal(attempts.filter(r=>!r.replayed).length,1);assert.equal(new Set(attempts.map(r=>r.receiptId)).size,1);
 let current=attempts[0].record;assert.equal(current.order.total,'1543.13');checks.push('concurrent-draft-persists-once-with-exact-enterprise-total');
 await assert.rejects(store.save(owner,{...draft,payload:{...draft.payload,unitPrice:'1.00'}}),{code:'PURCHASE_OPERATION_CONFLICT'});
 await assert.rejects(store.list(foreign,{projectId:'p-a',scope:other.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 await assert.rejects(store.list(auditor,{...context,scope:readonly.scope}),{code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'});
 await assert.rejects(store.save(owner,input('RECEIVE_MATERIAL',{requestId:current.id,revision:current.revision,quantity:'1',deliveryReference:'Remito 01',reason:'Entrega no autorizada en este ensayo.'})),{code:'PURCHASE_APPROVAL_REQUIRED'});
 const approval=await store.save(owner,input('REVIEW_ORDER',{requestId:current.id,revision:current.revision,decision:'APPROVED',reason:'Compra aprobada con importe y proveedor explícitos.'}));current=approval.record;
 await assert.rejects(register.save(owner,input('REVIEW_REPORT',{reportId:current.id,revision:current.revision,decision:'RESOLVED',reason:'No debe cerrar el pedido eludiendo su recepción.'})),{code:'SITE_PURCHASE_WORKFLOW_REQUIRED'});
 await assert.rejects(register.save(owner,input('REVIEW_REPORT',{reportId:current.id,revision:current.revision,decision:'REJECTED',reason:'No debe rechazar el pedido eludiendo su compra.'})),{code:'SITE_PURCHASE_WORKFLOW_REQUIRED'});
 checks.push('tenant-isolation-permissions-and-request-review-cannot-bypass-purchase');
 const receive=input('RECEIVE_MATERIAL',{requestId:current.id,revision:current.revision,quantity:'4.250',deliveryReference:'Remito 01',reason:'Entrega parcial comprobada en el ensayo.'});
 const delivery=await Promise.all([store.save(owner,receive),store.save(owner,receive)]);current=delivery[0].record;
 assert.equal(current.order.received,'4.250');assert.equal(current.order.receipts.length,1);
 await assert.rejects(store.save(owner,input('RECEIVE_MATERIAL',{...receive.payload,revision:current.revision,quantity:'9',deliveryReference:'Remito 02'})),{code:'PURCHASE_RECEIPT_EXCEEDS_ORDER'});
 await assert.rejects(store.save(owner,input('RECEIVE_MATERIAL',{...receive.payload,revision:current.revision,deliveryReference:'remito 01'})),{code:'PURCHASE_DELIVERY_ALREADY_RECORDED'});
 checks.push('partial-delivery-replay-never-duplicates-and-over-receipt-rejected');
 const adapt=mode=>createSitePurchases({workspace:createWorkspaceStore({connect:async()=>{
  const c=await pool.connect();return {release:e=>c.release(e),query:async(sql,values)=>{
   if(mode==='audit-failure'&&sql.startsWith('INSERT INTO public."AuditLog"'))throw new Error('Synthetic audit failure');
   const value=await c.query(sql,values);if(mode==='lost-commit'&&sql==='COMMIT')throw new Error('Synthetic response loss');return value;
  }};
 }})});
 const last=input('RECEIVE_MATERIAL',{requestId:current.id,revision:current.revision,quantity:'8.250',deliveryReference:'Remito 02',reason:'Entrega completa comprobada en este ensayo.'});
 await assert.rejects(adapt('audit-failure').save(owner,last),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
 assert.equal((await store.list(owner,context)).records[0].order.received,'4.250');
 await assert.rejects(adapt('lost-commit').save(owner,last),{code:'WORKSPACE_OPERATION_UNCONFIRMED'});
 const recovered=await store.status(owner,{...context,operationId:last.operationId});
 assert.equal(recovered.state,'RECORDED');assert.equal(recovered.record.order.received,'12.500');assert.equal(recovered.record.order.state,'RECEIVED');
 assert.equal((await store.save(owner,last)).replayed,true);
 checks.push('audit-failure-rolls-back-and-lost-commit-recovers-without-second-delivery');
 await pool.query(`INSERT INTO "AuditLog"(id,"organizationId","actorId",action,"entityType","entityId",metadata) VALUES('foreign-audit','company-b','foreign','foreign-private-operation','Project','p-a','{"projectId":"p-a","privateCredential":"fixture-secret"}')`);
 await pool.query(`INSERT INTO "AttendanceEntry" VALUES('review-a','p-a','{"fieldOperations":{"verificationStatus":"REVIEW_REQUIRED","review":null}}'),('review-b','p-b','{"fieldOperations":{"verificationStatus":"REVIEW_REQUIRED","review":null}}')`);
 await pool.query(`INSERT INTO "Worker" VALUES('person-a','p-a',true,'{"participant":{"status":"ACTIVE","clerkUserId":"user_Auditor","kyc":{"status":"PENDING_REVIEW"}}}'),('person-revoked','p-a',true,'{"participant":{"status":"REVOKED","clerkUserId":"user_Owner","kyc":{"status":"PENDING_REVIEW"}}}')`);
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId",status,action,"expiresAt") VALUES('expired-proposal','p-a','PENDING','{"fieldOperationsVersion":1}',CURRENT_TIMESTAMP-interval '1 day'),('current-proposal','p-a','PENDING','{"fieldOperationsVersion":1}',CURRENT_TIMESTAMP+interval '1 day')`);
 await pool.query(`INSERT INTO "OperationalProposal"(id,"projectId",status,action,"sourceProvider") VALUES('other-engine','p-a','PENDING','{"fieldOperationsVersion":1}','other-source')`);
 const inbox=(id,state,outcome={},extra={})=>pool.query(`INSERT INTO "WebhookEvent"(id,"projectId",provider,status,payload,outcome,"leaseToken","leaseExpiresAt","lastError") VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,[id,extra.projectId||'p-a',extra.provider||'meta-customer-v1',state,JSON.stringify({version:1,organizationId:extra.organizationId||'company-a',encryptedPayload:'synthetic-encrypted-payload-must-not-leak'}),JSON.stringify({version:1,...outcome}),extra.leaseToken||null,extra.leaseExpiresAt||null,extra.lastError||null]);
 await inbox('inbox-waiting','PENDING');await inbox('inbox-running','PENDING',{}, {leaseToken:'synthetic-lease',leaseExpiresAt:new Date(Date.now()+3600000)});await inbox('inbox-expired','PENDING',{}, {leaseToken:'synthetic-expired',leaseExpiresAt:new Date(Date.now()-3600000)});await inbox('inbox-retry','PENDING',{}, {lastError:'synthetic-private-provider-error'});await inbox('inbox-applied','PROCESSED',{businessApplied:true});await inbox('inbox-observed','PROCESSED',{businessApplied:false});
 for(const [index,code] of META_CUSTOMER_PROOF_REVIEW_CODES.entries())await inbox('proof-review-'+index,'PENDING',{}, {lastError:code});
 await inbox('other-namespace','PROCESSED',{businessApplied:true},{provider:'meta-test-v1'});await inbox('wrong-org-same-project','PROCESSED',{businessApplied:true},{organizationId:'company-b'});await inbox('foreign-inbox','PENDING',{}, {projectId:'p-b',organizationId:'company-b'});
 const outgoing=(id,state,providerStatus=null,extra={})=>inbox(id,extra.pending?'PENDING':'PROCESSED',{state,providerStatus},{...extra,provider:'meta-customer-outbound-v1'});
 await outgoing('out-unknown','SEND_UNKNOWN');await outgoing('out-expired-reserve','SEND_STARTED',null,{pending:true,leaseToken:'synthetic-out-expired',leaseExpiresAt:new Date(Date.now()-3600000)});await outgoing('out-running-reserve','SEND_STARTED',null,{pending:true,leaseToken:'synthetic-out-running',leaseExpiresAt:new Date(Date.now()+3600000)});await outgoing('out-sent','SENT');await outgoing('out-provider-sent','STATUS_OBSERVED','sent');await outgoing('out-delivered','STATUS_OBSERVED','delivered');await outgoing('out-read','STATUS_OBSERVED','read');await outgoing('out-failed','STATUS_OBSERVED','failed');await outgoing('out-deleted','STATUS_OBSERVED','deleted');await outgoing('out-rejected','REJECTED');await outgoing('foreign-outbound','SENT',null,{projectId:'p-b',organizationId:'company-b'});await outgoing('wrong-org-outbound','SENT',null,{organizationId:'company-b'});
 for(const [id,processing,review] of [['queued-evidence','QUEUED',null],['running-evidence','RUNNING',null],['failed-evidence','FAILED_RETRYABLE',null],['manual-evidence','MANUAL_REVIEW_REQUIRED',null],['reviewed-failure','FAILED_RETRYABLE',{decision:'APPROVE'}]])await pool.query(`INSERT INTO "Incident"(id,"projectId",metadata) VALUES($1,'p-a',$2::jsonb)`,[id,JSON.stringify({fieldOperations:{version:1,kind:'EVIDENCE',processing:{status:processing},review}})]);
 await pool.query(`INSERT INTO "Incident"(id,"projectId",metadata) VALUES('foreign-failure','p-b','{"fieldOperations":{"version":1,"kind":"EVIDENCE","processing":{"status":"FAILED_RETRYABLE"}}}'),('legacy-failure','p-a','{"fieldOperations":{"kind":"EVIDENCE","processing":{"status":"FAILED_RETRYABLE"}}}'),('canonical-request-open','p-a','{"siteRegister":{"version":1,"type":"MATERIAL_REQUEST","state":"OPEN"}}'),('canonical-request-followup','p-a','{"siteRegister":{"version":1,"type":"MATERIAL_REQUEST","state":"ACKNOWLEDGED"}}'),('canonical-request-closed','p-a','{"siteRegister":{"version":1,"type":"MATERIAL_REQUEST","state":"RESOLVED"}}')`);
 const status=createOperationsStatus({workspace}),observed=await status.read(owner,context);
 assert.equal(observed.attendance.pending,1);assert.ok(!JSON.stringify(observed).includes('fixture-secret'));assert.ok(!observed.history.some(r=>r.id==='foreign-audit'));
 assert.equal(observed.people.active,1);assert.equal(observed.people.kycPending,1);
 assert.equal(observed.proposals.pending,1);
 assert.deepEqual(observed.channel.inbox,{total:6+META_CUSTOMER_PROOF_REVIEW_CODES.length,pending:4+META_CUSTOMER_PROOF_REVIEW_CODES.length,processing:1,staleLease:1,retryableErrors:1,proofReviewRequired:META_CUSTOMER_PROOF_REVIEW_CODES.length,processed:2,businessApplied:1});assert.deepEqual(observed.channel.outbound,{total:10,pending:2,processing:1,staleLease:1,unknown:2,sent:2,delivered:1,read:1,rejected:3});
 assert.equal(observed.reports.evidencePending,4);assert.equal(observed.reports.processingQueued,1);assert.equal(observed.reports.processingRunning,1);assert.equal(observed.reports.processingFailed,1);assert.equal(observed.reports.manualReviewPending,1);assert.equal(observed.reports.requestsOpen,2);
 assert.ok(!JSON.stringify(observed).includes('synthetic-encrypted-payload-must-not-leak'));assert.ok(!JSON.stringify(observed).includes('synthetic-private-provider-error'));assert.equal(observed.acceptance,'NOT_VERIFIED');
 checks.push('unverified-proof-errors-require-manual-authenticity-review-and-never-count-as-retryable-provider-failures');checks.push('customer-inbox-and-outbound-namespaces-count-tenant-isolation-pending-active-expired-errors-applied-and-unknown-without-claiming-delivery-acceptance');checks.push('canonical-private-media-processing-and-open-material-requests-exclude-foreign-legacy-and-reviewed-records');

 await pool.query(`UPDATE "ProjectMembership" SET status='REVOKED' WHERE id='auditor-p'`);
 const afterRevocation=await status.read(owner,context);assert.equal(afterRevocation.people.active,0);assert.equal(afterRevocation.people.kycPending,0);
 await assert.rejects(status.read(foreign,{projectId:'p-a',scope:other.scope}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});
 await assert.rejects(status.read(auditor,{...context,scope:readonly.scope}),{code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'});
 checks.push('operational-observability-counts-scoped-pending-reviews-without-credentials-or-foreign-audits');
 assert.equal((await store.status(foreign,{projectId:'p-b',scope:other.scope,operationId:last.operationId})).state,'NOT_OBSERVED');

 // New contract checks reuse the same random disposable DB, canonical models
 // and actual actor/project transactions. No provider or product DB is used.
 const legacyReceipt=await store.status(owner,{...context,operationId:draft.operationId});
 assert.deepEqual(legacyReceipt.receipt,{id:legacyReceipt.receiptId,operationId:draft.operationId,requestId:request.report.id,action:'DRAFT_ORDER'});assert.equal(legacyReceipt.projectId,'p-a');assert.equal(legacyReceipt.state,'RECORDED');assert.equal(legacyReceipt.definitive,true);
 const legacyRow=(await pool.query('SELECT metadata FROM "AuditLog" WHERE id=$1',[legacyReceipt.receiptId])).rows[0];assert.equal(legacyRow.metadata.version,1);assert.equal(legacyRow.metadata.operationId,undefined);assert.equal(legacyReceipt.record.order.state,'RECEIVED');
 checks.push('version-one-purchase-receipt-correlates-original-operation-with-later-current-record-without-metadata-migration');
 const foreignContext={projectId:'p-b',scope:other.scope};
 const notObserved=await store.status(foreign,{...foreignContext,operationId:draft.operationId});assert.deepEqual(notObserved,{scope:other.scope,projectId:'p-b',state:'NOT_OBSERVED',saved:false,definitive:false});
 const directed=await store.list(owner,{...context,requestId:request.report.id});assert.equal(directed.total,1);assert.equal(directed.nextCursor,null);assert.equal(directed.records.length,1);assert.equal(directed.records[0].id,request.report.id);
 await assert.rejects(store.list(foreign,{...foreignContext,requestId:request.report.id}),{code:'PURCHASE_REQUEST_UNAVAILABLE'});await assert.rejects(store.list(foreign,{projectId:'p-a',scope:other.scope,requestId:request.report.id}),{code:'WORKSPACE_PROJECT_UNAVAILABLE'});assert.throws(()=>store.list(owner,{...context,requestId:request.report.id,after:request.report.id}),{code:'PURCHASE_QUERY_INVALID'});
 checks.push('directed-purchase-read-is-exactly-one-current-request-and-never-exposes-another-tenants-request');
 const corruptionCases=[
  ['version',{...legacyRow.metadata,version:2},'Incident',request.report.id],
  ['project',{...legacyRow.metadata,projectId:'p-b'},'Incident',request.report.id],
  ['action',{...legacyRow.metadata,command:'OTHER_ENGINE'},'Incident',request.report.id],
  ['digest',{...legacyRow.metadata,requestDigest:'broken'},'Incident',request.report.id],
  ['entity-type',legacyRow.metadata,'Worker',request.report.id],
  ['entity-id',legacyRow.metadata,'Incident','../foreign'],
 ];
 const countsBefore=(await pool.query('SELECT (SELECT count(*)::int FROM "AuditLog") AS audit,(SELECT count(*)::int FROM "Incident") AS incident')).rows[0];
 for(const [name,metadata,entityType,entityId] of corruptionCases){
  try{await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb,"entityType"=$3,"entityId"=$4 WHERE id=$1',[legacyReceipt.receiptId,JSON.stringify(metadata),entityType,entityId]);await assert.rejects(store.status(owner,{...context,operationId:draft.operationId}),{code:'PURCHASE_RECEIPT_INTEGRITY'},name);}
  finally{await pool.query('UPDATE "AuditLog" SET metadata=$2::jsonb,"entityType"=$4,"entityId"=$3 WHERE id=$1',[legacyReceipt.receiptId,JSON.stringify(legacyRow.metadata),request.report.id,'Incident']);}
 }
 assert.deepEqual((await pool.query('SELECT (SELECT count(*)::int FROM "AuditLog") AS audit,(SELECT count(*)::int FROM "Incident") AS incident')).rows[0],countsBefore);
 checks.push('purchase-corrupted-audit-action-project-version-digest-and-entity-fail-closed-with-zero-business-writes');
 const recoveredAgain=await store.status(owner,{...context,operationId:last.operationId});assert.equal(recoveredAgain.receipt.operationId,last.operationId);assert.equal(recoveredAgain.receipt.requestId,current.id);assert.equal(recoveredAgain.receipt.action,'RECEIVE_MATERIAL');assert.equal(recoveredAgain.receipt.id,recovered.receiptId);assert.equal(recoveredAgain.record.order.received,'12.500');
 const replayAgain=await store.save(owner,last);assert.equal(replayAgain.replayed,true);assert.deepEqual(replayAgain.receipt,recoveredAgain.receipt);assert.deepEqual((await pool.query('SELECT (SELECT count(*)::int FROM "AuditLog") AS audit,(SELECT count(*)::int FROM "Incident") AS incident')).rows[0],countsBefore);
 checks.push('lost-response-purchase-status-and-exact-replay-keep-one-durable-correlated-receipt-without-second-delivery');

 await pool.query(`UPDATE "TenantMembership" SET status='DISABLED' WHERE id='owner-m'`);
 await assert.rejects(store.list(owner,context),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 await assert.rejects(store.status(owner,{...context,operationId:last.operationId}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 await assert.rejects(store.list(owner,{...context,requestId:request.report.id}),{code:'WORKSPACE_MEMBERSHIP_REQUIRED'});
 checks.push('receipt-isolation-and-immediate-revocation');
 const proof={status:'PASS',environment:'disposable-local-postgresql',checks,productionDataWritten:false,providerCalls:0,stockLedgerChanged:false,paymentRecorded:false};
 mkdirSync('.vercel/purchase-evidence',{recursive:true});writeFileSync('.vercel/purchase-evidence/postgres.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{try{await closeDisposablePool(pool);if(created)await admin.query(`DROP DATABASE "${database}"`);}finally{await admin.end();}}
