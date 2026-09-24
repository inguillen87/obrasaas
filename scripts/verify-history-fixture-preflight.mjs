
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { authorizeS92DisposableDatabase, assertS92ClientSocketIdentity, assertS92RuntimeDatabaseIdentity, S92_DB_FIXTURE } from './seed-s92-e2e-db.mjs';
import { openAuthenticatedFlowHistoryFixture, FLOW_HISTORY_ACCEPTANCE } from './lib/s11-flow-history-fixture.mjs';
import { listProactiveFlowHistory } from '../src/lib/whatsapp/proactive-flow-history.js';
import { flowHistoryPageMatches } from '../src/lib/whatsapp/proactive-flow-history-policy.js';
const target=authorizeS92DisposableDatabase();
const connection=new pg.Client({connectionString:target.databaseUrl,connectionTimeoutMillis:5000,statement_timeout:10000});
const descriptor={primary:{databaseOrganizationId:S92_DB_FIXTURE.organizations.tenantA.id,project:{id:S92_DB_FIXTURE.projects.primary.id}},otherTenant:{databaseOrganizationId:S92_DB_FIXTURE.organizations.tenantB.id,anchorProjectId:S92_DB_FIXTURE.projects.isolation.id}};
const report={status:'RUNNING',environment:'empty-loopback-disposable-PostgreSQL-17',authenticated:false,clerkCalls:0,providerCalls:0,realMessagesSent:0,cases:[]};
let fixture,prisma;
try{
 await connection.connect(); assertS92ClientSocketIdentity(connection.connection.stream,target.port);
 const info=await connection.query('SELECT current_database() AS database_name, inet_server_port() AS server_port');assertS92RuntimeDatabaseIdentity(info.rows[0]);
 const count=await connection.query('SELECT count(*)::int AS n FROM "Organization"');assert.equal(count.rows[0].n,0,'Standalone preflight requires an empty database');
 const version=await connection.query('SHOW server_version_num');assert.equal(String(version.rows[0].server_version_num).slice(0,2),'17');
 await connection.query('BEGIN');
 for(const [organization,project] of [[S92_DB_FIXTURE.organizations.tenantA,S92_DB_FIXTURE.projects.primary],[S92_DB_FIXTURE.organizations.tenantB,S92_DB_FIXTURE.projects.isolation]]){
  await connection.query(`INSERT INTO "Organization" (id,name,slug,"subscriptionPlan","subscriptionStatus",metadata,"updatedAt") VALUES ($1,$2,$3,'PRO','ACTIVE',$4::jsonb,CURRENT_TIMESTAMP)`,[organization.id,organization.name,organization.slug,JSON.stringify({synthetic:true})]);
  await connection.query(`INSERT INTO "Project" (id,"organizationId",name,slug,status,metadata,"updatedAt") VALUES ($1,$2,$3,$4,'ACTIVE',$5::jsonb,CURRENT_TIMESTAMP)`,[project.id,organization.id,project.name,project.slug,JSON.stringify({synthetic:true})]);
 }
 await connection.query('COMMIT');report.cases.push({name:'empty-exact-database-and-synthetic-scope',status:'PASS'});
 fixture=await openAuthenticatedFlowHistoryFixture(descriptor);
 const before=await fixture.snapshot();assert.equal(before.messages.length,26);assert.equal(before.sessions.length,26);
 assert.ok(before.sessions.every(row=>row.updatedAt instanceof Date));
 report.cases.push({name:'real-helper-inserts-26-messages-and-sessions-with-required-timestamps',status:'PASS'});
 prisma=new PrismaClient({adapter:new PrismaPg({connectionString:target.databaseUrl})});
 const scope={organizationId:descriptor.primary.databaseOrganizationId,projectId:descriptor.primary.project.id,conversationId:FLOW_HISTORY_ACCEPTANCE.conversationId};
 const input={prisma,access:{organization:{id:scope.organizationId},project:{id:scope.projectId}},conversationId:scope.conversationId};
 const page=await listProactiveFlowHistory(input);assert.equal(flowHistoryPageMatches(page,scope),true);assert.equal(page.items.length,20);assert.equal(page.items[0].reply.state,'recorded');assert.equal(page.items[1].status,'unknown');assert.equal(page.items[3].riskDecision,true);
 const next=await listProactiveFlowHistory({...input,cursor:page.nextCursor});assert.equal(next.items.length,6);assert.equal(next.nextCursor,null);assert.equal(new Set([...page.items,...next.items].map(row=>row.messageId)).size,26);
 for(const canary of [FLOW_HISTORY_ACCEPTANCE.privateCanary,'recipientPhone','tokenSha256','wamid.'])assert.equal(JSON.stringify([page,next]).includes(canary),false);
 report.cases.push({name:'Prisma-query-20-plus-6-and-private-metadata-not-returned',status:'PASS'});
 const foreign={prisma,access:{organization:{id:descriptor.otherTenant.databaseOrganizationId},project:{id:descriptor.otherTenant.anchorProjectId}},conversationId:FLOW_HISTORY_ACCEPTANCE.otherConversationId};
 await assert.rejects(listProactiveFlowHistory({...foreign,cursor:page.nextCursor}),{status:400,code:'WHATSAPP_FLOW_HISTORY_CURSOR_INVALID'});
 const own=await listProactiveFlowHistory(foreign);assert.equal(own.items.length,0);
 report.cases.push({name:'other-scope-cursor-rejected-by-exact-existing-contract',status:'PASS'});
 assert.deepEqual(await fixture.snapshot(),before);
 const channelCount=await connection.query('SELECT count(*)::int AS n FROM "WhatsAppConnection"');assert.equal(channelCount.rows[0].n,0);
 report.cases.push({name:'read-only-query-preserves-rows-audits-and-no-sending-channel',status:'PASS'});
 await assert.rejects(openAuthenticatedFlowHistoryFixture(descriptor),error=>error.code==='23505');
 assert.deepEqual(await fixture.snapshot(),before);
 report.cases.push({name:'duplicate-fixture-rejected-and-rolled-back-without-overwrite',status:'PASS'});
 report.status='PASS';
}catch(error){report.status='FAIL';report.error={name:error.name,code:error.code,message:error.message};process.exitCode=1;}
finally{await connection.query('ROLLBACK').catch(()=>{});await fixture?.close();await prisma?.$disconnect();await connection.end();mkdirSync('evidence',{recursive:true});writeFileSync('evidence/sql-fixture-proof.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
