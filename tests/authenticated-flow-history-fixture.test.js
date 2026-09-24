import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { FLOW_HISTORY_ACCEPTANCE, buildAuthenticatedFlowHistory, openAuthenticatedFlowHistoryFixture } from '../scripts/lib/s11-flow-history-fixture.mjs';
const scope = { organizationId: 's92e2e_org_primary', projectId: 's92e2e_project_primary' };
const now = new Date('2026-09-24T16:00:00Z');
const fixture = { primary: { databaseOrganizationId: scope.organizationId, project: { id: scope.projectId } }, otherTenant: { databaseOrganizationId: 's92e2e_org_other', anchorProjectId: 's92e2e_project_isolation' } };
const env = { S92_E2E_DISPOSABLE: '1', DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/obrasaas_e2e?schema=public' };
test('synthetic history has 26 deterministic records and unique provider/session keys', () => {
 const rows = buildAuthenticatedFlowHistory(scope, now);
 assert.equal(rows.length, FLOW_HISTORY_ACCEPTANCE.count);
 for (const key of ['id','sessionId','externalId','tokenSha256']) assert.equal(new Set(rows.map(row => row[key])).size,26);
 assert.deepEqual(buildAuthenticatedFlowHistory(scope,now),rows);
 for(const row of rows){assert.ok(row.sessionCreatedAt<row.expiresAt);if(row.sentAt){assert.ok(row.attemptedAt);assert.ok(row.sentAt>=row.attemptedAt);assert.ok(row.sentAt<row.expiresAt);}if(row.consumedAt){assert.ok(row.consumedExternalId);assert.ok(row.consumedAt>=row.sentAt);assert.ok(row.consumedAt<row.expiresAt);}}
});
test('synthetic scenarios preserve receipt, unknown, expiry and manual-risk distinctions',()=>{
 const rows=buildAuthenticatedFlowHistory(scope,now);assert.equal(rows[0].status,'delivered');assert.ok(rows[0].consumedAt);
 assert.equal(rows[1].status,'unknown');assert.equal(rows[1].reference,null);
 assert.ok(rows[2].expiresAt<now);assert.equal(rows[2].consumedAt,null);
 assert.equal(rows[3].status,'failed');assert.equal(rows[3].metadata.uncertaintyResolution.riskAccepted,true);
 assert.equal(rows[3].sentAt,null);assert.equal(rows[3].reference,null);
 for(const row of rows.slice(4)){assert.equal(row.status,'accepted');assert.ok(row.expiresAt>now);assert.equal(row.consumedAt,null);}
});
for(const invalidScope of [{...scope,projectId:'production'},{...scope,organizationId:'other'}])test('fixture cannot be built for '+JSON.stringify(invalidScope),()=>assert.throws(()=>buildAuthenticatedFlowHistory(invalidScope,now)));
for(const date of [null,'2026-09-24',new Date('invalid')])test('invalid reference time is rejected '+String(date),()=>assert.throws(()=>buildAuthenticatedFlowHistory(scope,date)));
for(const patch of [{S92_E2E_DISPOSABLE:'0'},{DATABASE_URL:''},{DATABASE_URL:'postgresql://test:test@example.com/obrasaas_e2e'},{DATABASE_URL:'postgresql://test:test@127.0.0.1/production'},{DATABASE_URL:'postgresql://test:test@127.0.0.1/obrasaas_e2e?options=other'},{DATABASE_URL:'https://localhost/obrasaas_e2e'}])test('database guard rejects unsafe target before connecting '+JSON.stringify(patch),async()=>{
 await assert.rejects(openAuthenticatedFlowHistoryFixture(fixture,{...env,...patch}));
});
test('unknown tenant fixture is rejected before a PostgreSQL client is opened',async()=>{
 await assert.rejects(openAuthenticatedFlowHistoryFixture({...fixture,primary:{...fixture.primary,project:{id:'other'}}},env));
});
test('authenticated journey is wired after existing acceptance without mocking identity or provider calls',()=>{
 const spec=fs.readFileSync(new URL('../e2e/s92-authenticated.spec.js',import.meta.url),'utf8');
 const journey=fs.readFileSync(new URL('../e2e/s11-flow-history-journey.js',import.meta.url),'utf8');
 assert.match(spec,/await verifyAuthenticatedFlowHistory/);assert.ok(spec.indexOf('await verifyAuthenticatedAssignmentContinuity')<spec.indexOf('await verifyAuthenticatedFlowHistory'));
 assert.match(journey,/openAuthenticatedFlowHistoryFixture/);assert.match(journey,/window.Clerk.signOut/);assert.match(journey,/expect\(await db.snapshot\(\)\).toEqual\(before\)/);
 assert.doesNotMatch(journey,/route\.fulfill|storageState\s*:|Authorization\s*:/);
});


test('raw SQL fixture names only persisted columns and supplies client-managed updatedAt values',()=>{
 const source=fs.readFileSync(new URL('../scripts/lib/s11-flow-history-fixture.mjs',import.meta.url),'utf8');
 const schema=fs.readFileSync(new URL('../prisma/schema.prisma',import.meta.url),'utf8');
 const statements=[...source.matchAll(/INSERT INTO "(Worker|Conversation|Message|WhatsAppFlowSession)" \(([^)]+)\) VALUES/g)];
 assert.equal(statements.length,4);
 for(const [,table,columns] of statements){
  const marker='model '+table+' {'; const start=schema.indexOf(marker);assert.notEqual(start,-1);
  const lines=schema.slice(start+marker.length,schema.indexOf('\n}',start)).split('\n');
  const fields=new Map(lines.map(line=>line.trim()).filter(line=>/^[A-Za-z]\w*\s/.test(line)).map(line=>[line.split(/\s+/)[0],line]));
  const supplied=columns.split(',').map(value=>value.replaceAll('"','').trim());
  assert.equal(new Set(supplied).size,supplied.length);
  for(const name of supplied)assert.ok(fields.has(name),table+'.'+name+' must exist in the current schema');
  for(const [name,line] of fields)if(line.includes('@updatedAt'))assert.ok(supplied.includes(name),table+'.'+name+' requires an explicit raw-SQL value');
 }
});
