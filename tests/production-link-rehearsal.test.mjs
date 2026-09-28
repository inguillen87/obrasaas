import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { LINK_TARGET, LINK_REHEARSAL_POLICY, linkRehearsalConfig, linkDigest, recordCommand, revertCommand, classifyLinkError, linkFlags } from '../scripts/lib/legacy-link-policy.mjs';
import { parseLinkArguments } from '../scripts/rehearse-legacy-links.mjs';
import { renderLinkRehearsalReport } from '../scripts/lib/legacy-link-report.mjs';
import { executeLinkRehearsal } from '../scripts/lib/legacy-link-store.mjs';
import { draftLegacyMappingPlan } from '../scripts/lib/legacy-mapping-plan.mjs';
import { mappingSnapshot, fillMappingSelections, SHA } from './helpers/legacy-mapping-fixture.mjs';
const CONNECTION = `postgresql://test:unit-only@${LINK_TARGET.host}/neondb?sslmode=require`;
const plan = () => fillMappingSelections(draftLegacyMappingPlan(mappingSnapshot(),{sourceSha:SHA}));
const settings = {sourceSha:SHA,operationKey:'unit-record-key-0001'};
const receipt = () => ({policyVersion:LINK_REHEARSAL_POLICY,targetRef:LINK_TARGET.branchId,
  runId:'run_'+'a'.repeat(64),recordDigest:'b'.repeat(64),...linkFlags});

test('only the specifically allowlisted isolated branch config can connect',()=>{
  const result=linkRehearsalConfig(CONNECTION,LINK_TARGET.branchId,{});
  assert.equal(result.ssl.rejectUnauthorized,true);assert.equal(result.enableChannelBinding,true);
  assert.match(result.application_name,/isolated/);
});
for (const value of [CONNECTION.replace(LINK_TARGET.host,'ep-production-main.sa-east-1.aws.neon.tech'),
  CONNECTION.replace(LINK_TARGET.host,LINK_TARGET.host.replace('.','-pooler.')), CONNECTION.replace('/neondb','/production'),
  CONNECTION+'&options=-csearch_path=public',CONNECTION.replace('sslmode=require','sslmode=disable'),
  CONNECTION.replace('postgresql:','http:'),CONNECTION+'#secret',CONNECTION.replace(LINK_TARGET.host,LINK_TARGET.host+':6432')])
  test('rejects an alternate or weakened connection '+value.replace(/test:unit-only/,'redacted'),()=>{
    assert.throws(()=>linkRehearsalConfig(value,LINK_TARGET.branchId,{}));
  });
for(const value of [undefined,'main','br-jolly-rain-acdyvz9p','br-other',''])
  test('rejects branch '+String(value),()=>assert.throws(()=>linkRehearsalConfig(CONNECTION,value,{}),{code:'REHEARSAL_TARGET_FORBIDDEN'}));
for(const name of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])test('cannot run inside '+name,()=>{
  assert.throws(()=>linkRehearsalConfig(CONNECTION,LINK_TARGET.branchId,{[name]:'production'}),{code:'REHEARSAL_RUNTIME_FORBIDDEN'});
});
test('canonical digest survives JSONB object-key order, not array order',()=>{
  assert.equal(linkDigest({a:1,b:{c:2,d:3}}),linkDigest({b:{d:3,c:2},a:1}));
  assert.notEqual(linkDigest([1,2]),linkDigest([2,1]));
});
for(const value of [undefined,NaN,Infinity,new Date(),()=>{}])test('non-JSON value rejected '+String(value),()=>assert.throws(()=>linkDigest(value),{code:'REHEARSAL_VALUE_INVALID'}));
test('record fingerprint binds target, reviewed manifest and source revision',()=>{
  const original=recordCommand(plan(),settings);
  assert.equal(original.requestDigest,recordCommand(plan(),{...settings,operationKey:'unit-record-key-0002'}).requestDigest);
  assert.notEqual(original.requestDigest,recordCommand(plan(),{...settings,targetRef:'another-target'}).requestDigest);
  const changed=plan();changed.records[0].reason='NEEDS_EVIDENCE';assert.notEqual(original.requestDigest,recordCommand(changed,settings).requestDigest);
});
for(const key of ['',null,'short','x'.repeat(129),'key-containing whitespace','../some-path-key-here'])test('invalid operation key rejected '+String(key),()=>{
  assert.throws(()=>recordCommand(plan(),{...settings,operationKey:key}),{code:'REHEARSAL_COMMAND_INVALID'});
});
for(const change of [p=>{p.executionAllowed=true;},p=>{p.importAuthorized=true;},p=>{p.sourceSha='b'.repeat(40);},p=>{p.records=[];},p=>{p.intent='CREATE_TENANTS';}])
  test('record input cannot grant authority or expand its effect '+String(change),()=>{const value=plan();change(value);assert.throws(()=>recordCommand(value,settings),{code:'REHEARSAL_MANIFEST_INVALID'});});
for(const change of [r=>{r.targetRef='another-branch';},r=>{r.runId='bad';},r=>{r.recordDigest='a';},r=>{r.importAuthorized=true;},r=>{r.businessDataWritten=true;},r=>{r.policyVersion='new';}])
  test('reversal requires a bound receipt '+String(change),()=>{const value=receipt();change(value);assert.throws(()=>revertCommand(value,{operationKey:settings.operationKey}),{code:'REHEARSAL_RECEIPT_INVALID'});});
test('reversal key does not authorize any public-table operation',()=>{
  const command=revertCommand(receipt(),{operationKey:settings.operationKey});assert.equal(command.operation,'REVERT');assert.equal(command.runId,receipt().runId);
});
test('invalid command fails before constructing a connection',async()=>{
  let clients=0;const factory=()=>{clients++;throw new Error('must not connect');};
  const command=recordCommand(plan(),settings);command.requestDigest='0'.repeat(64);
  await assert.rejects(executeLinkRehearsal(factory,command,plan()),{code:'REHEARSAL_COMMAND_INVALID'});assert.equal(clients,0);
});
const args=['--branch',LINK_TARGET.branchId,'--review','.vercel/review.json','--output','.vercel/report'];
test('CLI defaults to read-only check',()=>assert.equal(parseLinkArguments(args)['--mode'],'check'));
for(const input of [[],[...args,'--mode','apply'],[...args,'--mode','record'],[...args,'--receipt','x'],[...args,'--branch','main'],[...args,'--operation-key',settings.operationKey],[...args,'--unknown','x']])
  test('CLI refuses ambiguous/executable arguments '+JSON.stringify(input),()=>assert.throws(()=>parseLinkArguments(input)));
test('CLI exposes only record/revert of rehearsal references',()=>{
  assert.equal(parseLinkArguments([...args,'--mode','record','--operation-key',settings.operationKey])['--mode'],'record');
  assert.equal(parseLinkArguments(['--mode','revert','--branch',LINK_TARGET.branchId,'--receipt','.vercel/receipt.json','--operation-key',settings.operationKey,'--output','.vercel/out'])['--mode'],'revert');
});
test('commit ambiguity is distinguished from rollback and never auto-retried',()=>{
  assert.equal(classifyLinkError(new Error('private connection material'),true).code,'REHEARSAL_COMMIT_UNCONFIRMED');
  for(const code of ['55P03','40001','40P01','57014'])assert.equal(classifyLinkError({code}).code,'REHEARSAL_BUSY_RETRY_SAME_KEY');
  assert.doesNotMatch(classifyLinkError(new Error('postgres://private-password')).message,/postgres|password/);
});
test('receipt view has no scripts, remote assets or actionable authorization',()=>{
  const html=renderLinkRehearsalReport({...receipt(),status:'REHEARSAL_RECORDED',linkCount:4,activeReferenceCount:4,revision:1});
  assert.ok(html.includes('No es una importación productiva'));assert.ok(html.includes("connect-src 'none'"));
  assert.doesNotMatch(html,/<script|<form|https:\/\/|http:\/\//);
  const injected=renderLinkRehearsalReport({...receipt(),runId:'</code><script>alert(1)</script>',status:'<img src=x>'});assert.doesNotMatch(injected,/<script|<img/);
});
test('reverted/historical receipt view does not claim current-source approval',()=>{
  const html=renderLinkRehearsalReport({...receipt(),status:'REHEARSAL_REVERTED',historicalReplay:true});
  assert.ok(html.includes('Ensayo revertido'));assert.ok(html.includes('recuperación del recibo histórico'));
});
test('rehearsal SQL has no public-table DML or destructive cleanup',()=>{
  const sql=readFileSync(new URL('../scripts/lib/legacy-link-schema.sql',import.meta.url),'utf8');
  const store=readFileSync(new URL('../scripts/lib/legacy-link-store.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/DROP |TRUNCATE |DELETE |(?:INSERT INTO|UPDATE) public/i);
  assert.doesNotMatch(store,/(?:INSERT INTO|UPDATE|DELETE FROM) public/i);
  assert.ok(store.includes('IN SHARE MODE'));assert.ok(store.includes('readLegacyCutover(reader)'));
  assert.match(sql,/REVOKE ALL ON SCHEMA .* FROM PUBLIC/);
});
