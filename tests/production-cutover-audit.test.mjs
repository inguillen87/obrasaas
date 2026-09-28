import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeLegacyCutover,compareCutoverAudits } from '../scripts/lib/legacy-cutover-audit.mjs';
import { readLegacyCutover,auditConnectionConfig } from '../scripts/lib/read-legacy-cutover.mjs';
import { parseAuditArguments } from '../scripts/audit-legacy-cutover.mjs';
const SHA='a'.repeat(40),HOST='ep-test-only-ab123.eu-central-1.aws.neon.tech';
function snapshot(state={projects:[],tenants:[],workerRegistry:[],tasks:{}}){
  return {readOnlyVerified:true,sources:[{id:'default',stateText:JSON.stringify(state),messagesText:'[]'}],
    organizations:[{id:'org-a'},{id:'org-b'}],projects:[{id:'project-a',organizationId:'org-a'},{id:'project-b',organizationId:'org-b'}],
    workers:[{id:'worker-a',projectId:'project-a',externalId:'legacy-worker'}],tasks:[{id:'task-a',projectId:'project-a',externalId:'legacy-task'}],
    projectSnapshots:[],migrations:[{name:'baseline',completed:true,rolledBack:false}]};
}
const audit=value=>analyzeLegacyCutover(value,{sourceSha:SHA});
const codes=report=>report.blockers.map(row=>row.code);
test('empty collections are different from absent collections',()=>{
  assert.equal(audit(snapshot()).status,'REVIEW_REQUIRED');
  assert.ok(codes(audit(snapshot({}))).includes('CORE_COLLECTION_MISSING'));
  assert.equal(audit(snapshot()).importAuthorized,false);
});
test('structural matches never authorize import or recreate certificates',()=>{
  const report=audit(snapshot({projects:[{id:'project-a',organizationId:'org-a'}],tenants:[{id:'org-a'}],
    workerRegistry:[{id:'worker-a',projectId:'project-a',organizationId:'org-a'}],tasks:{'task-a':{projectId:'project-a',organizationId:'org-a'}}}));
  assert.ok(report.domains.filter(row=>row.domain!=='tenants').every(row=>row.explicitScopeMatched===1));
  assert.equal(report.importAuthorized,false);assert.equal(report.executionAllowed,false);
});
test('a selected active project cannot assign the entire historical ledger',()=>{
  const report=audit(snapshot({projects:[],tenants:[],activeProjectId:'project-a',workerRegistry:[{id:'legacy-worker'}],tasks:{'legacy-task':{}}}));
  assert.ok(codes(report).includes('GLOBAL_SELECTION_NOT_RECORD_AUTHORITY'));
  assert.equal(report.domains.find(x=>x.domain==='workerRegistry').explicitScopeMatched,0);
});
for(const binding of [{organizationId:'org-b'},{organizationId:'org-a',tenantId:'org-b'}])test('rejects cross-tenant or contradictory ownership '+JSON.stringify(binding),()=>{
  const report=audit(snapshot({projects:[],tenants:[],workerRegistry:[{id:'worker-a',projectId:'project-a',...binding}],tasks:{}}));
  assert.ok(codes(report).includes('CROSS_TENANT_BINDING_CONFLICT'));
});
test('matching phone or name has no authority and is not exported',()=>{
  const report=audit(snapshot({projects:[],tenants:[],workerRegistry:[{id:'foreign',name:'PRIVATE PERSON',phone:'549private',dni:'PRIVATE-DNI',organizationId:'org-a'}],tasks:{},privateOwnerEmail:'secret@example.test'}));
  assert.equal(report.totals.unknownFields,1);
  for(const text of ['PRIVATE PERSON','549private','PRIVATE-DNI','secret@example.test','privateOwnerEmail','foreign'])assert.ok(!JSON.stringify(report).includes(text));
});
test('external identifiers shared across projects remain unresolved',()=>{
  const data=snapshot({projects:[],tenants:[],workerRegistry:[{id:'legacy-worker'}],tasks:{}});
  data.workers.push({id:'worker-b',projectId:'project-b',externalId:'legacy-worker'});
  const row=audit(data).domains.find(x=>x.domain==='workerRegistry');
  assert.equal(row.multipleExternalCandidates,1);assert.equal(row.explicitScopeMatched,0);
});
for(const field of ['certifications','auditLedger','kycVerifications','workerReceipts'])test('historical assertions need review: '+field,()=>{
  const state={projects:[],tenants:[],workerRegistry:[],tasks:{},[field]:field.endsWith('s')&&field!=='certifications'?{one:{verified:true}}:[{approved:true}]};
  assert.ok(codes(audit(snapshot(state))).includes('HISTORICAL_ASSERTIONS_REQUIRE_REVIEW'));
});
test('unknown schema and bad types are not silently dropped',()=>{
  const report=audit(snapshot({projects:{},tenants:[],workerRegistry:[],tasks:{},unrecognized:[]}));
  assert.ok(codes(report).includes('FIELD_TYPE_MISMATCH'));assert.ok(codes(report).includes('UNKNOWN_FIELDS_REQUIRE_REVIEW'));
});
test('duplicate legacy IDs, malformed records and missing IDs are counted',()=>{
  const report=audit(snapshot({projects:[{id:'x'},{id:'x'},null,{}],tenants:[],workerRegistry:[],tasks:{}}));
  for(const code of ['RECORD_IDENTIFIER_DUPLICATED','RECORD_IDENTIFIER_MISSING','RECORD_SHAPE_INVALID'])assert.ok(codes(report).includes(code));
});
for(const [name,change]of [
  ['write context',x=>{x.readOnlyVerified=false;}],['duplicate catalog',x=>x.workers.push({...x.workers[0]})],
  ['foreign project',x=>{x.workers[0].projectId='missing';}],['foreign organization',x=>{x.projects[0].organizationId='missing';}],
  ['invalid JSON',x=>{x.sources[0].stateText='{';}],['array root',x=>{x.sources[0].stateText='[]';}],
  ['invalid messages',x=>{x.sources[0].messagesText='{}';}],['source duplicate',x=>x.sources.push({...x.sources[0]})],
  ['oversized source',x=>{x.sources[0].stateText='x'.repeat(8*1024*1024+1);}]
])test('fails closed for '+name,()=>{const data=snapshot();change(data);assert.throws(()=>audit(data),error=>error.code&&!error.message.includes('postgres'));});
test('fingerprints preserve original integers beyond Number precision',()=>{
  const before=snapshot(),after=snapshot();before.sources[0].stateText='{"amount":9007199254740992}';after.sources[0].stateText='{"amount":9007199254740993}';
  assert.notEqual(audit(before).sourceFingerprint,audit(after).sourceFingerprint);
  assert.equal(audit(before).monetaryValuesConverted,false);
});
test('schema history can change while source and scope stay unchanged',()=>{
  const before=audit(snapshot()),data=snapshot();data.migrations.push({name:'new',completed:true,rolledBack:false});
  const comparison=compareCutoverAudits(before,audit(data));
  assert.equal(comparison.sourceUnchanged,true);assert.equal(comparison.catalogUnchanged,true);assert.equal(comparison.schemaHistoryChanged,true);assert.equal(comparison.importAuthorized,false);
});
test('catalog reorder is stable and ownership changes are detected',()=>{
  const data=snapshot(),before=audit(data);data.projects.reverse();data.organizations.reverse();
  assert.equal(compareCutoverAudits(before,audit(data)).catalogUnchanged,true);
  data.projects[0].organizationId='org-a';assert.equal(compareCutoverAudits(before,audit(data)).catalogUnchanged,false);
});
test('edited report without updated digest is rejected',()=>{
  const before=audit(snapshot()),after=structuredClone(before);after.totals.workers=0;
  assert.throws(()=>compareCutoverAudits(before,after),error=>error.code==='AUDIT_REPORT_CHANGED');
});
for(const value of ['https://'+HOST+'/db','postgres://u:p@localhost/db','postgres://u:p@'+HOST+'/db?sslmode=disable','postgres://u:p@'+HOST+'/db?options=-cread_only=off','postgres://u:p@'+HOST+'/db?sslrootcert=secret'])
  test('connection target/options fail closed '+value.split('@').at(-1),()=>assert.throws(()=>auditConnectionConfig(value,HOST)));
test('TLS verification stays explicit and URL flags cannot replace it',()=>{
  const config=auditConnectionConfig('postgres://unit:unit@'+HOST+'/db?sslmode=require&channel_binding=require',HOST);
  assert.deepEqual(config.ssl,{rejectUnauthorized:true});assert.equal(new URL(config.connectionString).search,'');
  assert.throws(()=>auditConnectionConfig(config.connectionString,'ep-other.region.aws.neon.tech'));
});
for(const args of [[],['--output','a'],['--expected-host',HOST,'--output'],['--expected-host',HOST,'--output','x','--apply','true'],['--expected-host',HOST,'--output','x','--output','y']])
  test('CLI rejects incomplete/unknown arguments '+JSON.stringify(args),()=>assert.throws(()=>parseAuditArguments(args)));
function fakeClient(failure=null){
  const calls=[];return {calls,async query(sql){calls.push(sql);
    if(sql==='ROLLBACK')return {rows:[]};
    if(failure&&sql.includes(failure))throw new Error('private database location and credentials');
    if(sql.includes('current_setting'))return {rows:[{ro:'on',isolation:'repeatable read'}]};
    if(sql.startsWith('SELECT octet_length'))return {rows:[{bytes:8}]};
    if(sql.startsWith('SELECT id, state'))return {rows:[{id:'default',stateText:'{}',messagesText:'[]'}]};
    return {rows:[]};}};
}
test('reader uses one read-only repeatable snapshot and always rolls back',async()=>{
  const client=fakeClient(),result=await readLegacyCutover(client);
  assert.equal(result.readOnlyVerified,true);assert.equal(client.calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(client.calls.at(-1),'ROLLBACK');assert.ok(!client.calls.some(sql=>/INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT/.test(sql)));
});
test('database failures roll back and do not leak raw messages',async()=>{
  const client=fakeClient('FROM public."Project"');
  await assert.rejects(()=>readLegacyCutover(client),error=>error.code==='AUDIT_DATABASE_READ_FAILED'&&!error.message.includes('credentials'));
  assert.equal(client.calls.at(-1),'ROLLBACK');
});
test('reader refuses a writable transaction before querying source data',async()=>{
  const client=fakeClient(),query=client.query.bind(client);
  client.query=sql=>sql.includes('current_setting')?Promise.resolve({rows:[{ro:'off',isolation:'repeatable read'}]}):query(sql);
  await assert.rejects(()=>readLegacyCutover(client),error=>error.code==='READ_ONLY_TRANSACTION_REQUIRED');
  assert.ok(!client.calls.some(sql=>sql.includes('obrasaas_app_state')));assert.equal(client.calls.at(-1),'ROLLBACK');
});
test('reader refuses an oversized source before materializing the JSON',async()=>{
  const client=fakeClient(),query=client.query.bind(client);
  client.query=sql=>sql.startsWith('SELECT octet_length')?Promise.resolve({rows:[{bytes:8*1024*1024+1}]}):query(sql);
  await assert.rejects(()=>readLegacyCutover(client),error=>error.code==='SOURCE_TOO_LARGE');
  assert.ok(!client.calls.some(sql=>sql.startsWith('SELECT id, state')));assert.equal(client.calls.at(-1),'ROLLBACK');
});
test('incomplete migrations remain an explicit blocker',()=>{
  const data=snapshot();data.migrations.push({name:'failed',completed:false,rolledBack:false});
  assert.ok(codes(audit(data)).includes('INCOMPLETE_MIGRATIONS'));
});
test('sources are bounded and absence is not an empty approved migration',()=>{
  const data=snapshot();data.sources=[];assert.ok(codes(audit(data)).includes('LEGACY_SOURCE_MISSING'));
  data.sources=Array.from({length:11},(_,i)=>({id:String(i),stateText:'{}',messagesText:'[]'}));
  assert.throws(()=>audit(data),error=>error.code==='AUDIT_SOURCE_LIMIT');
});
