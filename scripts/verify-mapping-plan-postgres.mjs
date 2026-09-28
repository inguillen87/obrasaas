import assert from 'node:assert/strict';
import { Client } from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readLegacyCutover } from './lib/read-legacy-cutover.mjs';
import { draftLegacyMappingPlan, checkLegacyMappingPlan } from './lib/legacy-mapping-plan.mjs';
import { mappingSnapshot, fillMappingSelections, SHA } from '../tests/helpers/legacy-mapping-fixture.mjs';
const url=new URL(process.env.CUTOVER_TEST_DATABASE_URL||'http://not-configured');
assert.ok(process.env.CUTOVER_TEST_DISPOSABLE==='1'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/obrasaas_cutover_ci','Only the explicitly disposable local database is permitted');
const client=new Client({connectionString:url.toString()}),calls=[];
const reader={query(sql){calls.push(sql);return client.query(sql);}};
try {
  await client.connect();
  const fixture=mappingSnapshot().sources[0];
  await client.query('UPDATE public.obrasaas_app_state SET state=$1,messages=$2 WHERE id=$3',[fixture.stateText,fixture.messagesText,'default']);
  // Existing integration fixture uses a different external worker/task spelling.
  await client.query('UPDATE public."Task" SET "externalId"=$1 WHERE id=$2',['old-task','task-a']);
  await client.query('UPDATE public."Worker" SET "externalId"=$1 WHERE id IN ($2,$3)',['old-worker','worker-a','worker-b']);
  const original=(await client.query('SELECT state::text,messages::text FROM public.obrasaas_app_state')).rows;
  const initial=await readLegacyCutover(reader),draft=draftLegacyMappingPlan(initial,{sourceSha:SHA});
  const fresh=await readLegacyCutover(reader),complete=fillMappingSelections(draft);
  const checked=checkLegacyMappingPlan(fresh,complete,{sourceSha:SHA});
  assert.equal(checked.status,'SELECTIONS_COMPLETE_NOT_AUTHORIZED');assert.equal(checked.importAuthorized,false);
  assert.equal(checked.rehearsalSteps.length,4);
  assert.deepEqual(checkLegacyMappingPlan(fresh,complete,{sourceSha:SHA}).rehearsalSteps,checked.rehearsalSteps);
  assert.equal(checkLegacyMappingPlan(fresh,draft,{sourceSha:SHA}).status,'BLOCKED');
  const crossed=structuredClone(complete),worker=crossed.records.find(row=>row.kind==='worker');
  worker.targetRef=crossed.targets.find(row=>row.kind==='worker'&&row.ordinal===2).targetRef;
  assert.ok(checkLegacyMappingPlan(fresh,crossed,{sourceSha:SHA}).findings.some(row=>row.code==='CROSS_SCOPE_TARGET'));

  await client.query('UPDATE public.obrasaas_app_state SET messages=$1 WHERE id=$2',['[{"text":"new synthetic message"}]','default']);
  const changed=await readLegacyCutover(reader);
  assert.throws(()=>checkLegacyMappingPlan(changed,complete,{sourceSha:SHA}),{code:'PLAN_OBSERVATION_CHANGED'});
  await client.query('UPDATE public.obrasaas_app_state SET messages=$1 WHERE id=$2',[original[0].messages,'default']);
  assert.deepEqual((await client.query('SELECT state::text,messages::text FROM public.obrasaas_app_state')).rows,original);
  assert.ok(!calls.some(sql=>/INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|COMMIT/.test(sql)));
  assert.equal((await client.query("SELECT current_setting('transaction_read_only') AS ro")).rows[0].ro,'off');
  const proof={status:'PASS',environment:'disposable-local-postgresql17',realCustomerData:false,
    draftUnselected:true,crossTenantChoiceRejected:true,staleSourceRejected:true,referenceKeysStable:true,
    sourceRestoredAfterSyntheticMutation:true,plannerWrites:0,importAuthorized:false};
  mkdirSync('.vercel/mapping-plan-evidence',{recursive:true});
  writeFileSync('.vercel/mapping-plan-evidence/postgres.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
} finally {await client.end();}
