import assert from 'node:assert/strict';
import {Client} from 'pg';
import {mkdirSync,writeFileSync} from 'node:fs';
import {readLegacyCutover} from './lib/read-legacy-cutover.mjs';
import {buildIdentityReview} from './lib/identity-review-context.mjs';
import {checkLegacyMappingPlan} from './lib/legacy-mapping-plan.mjs';
import {identityContextSnapshot} from '../tests/helpers/identity-context-fixture.mjs';
import {fillMappingSelections,SHA} from '../tests/helpers/legacy-mapping-fixture.mjs';
const url=new URL(process.env.CUTOVER_TEST_DATABASE_URL||'http://not-configured');
assert.ok(process.env.CUTOVER_TEST_DISPOSABLE==='1'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/obrasaas_cutover_ci','Only the explicitly disposable local fixture database is accepted');
const client=new Client({connectionString:url.toString()}),calls=[];
const reader={query(sql){calls.push(sql);return client.query(sql);}};
try{
  await client.connect();const fixture=identityContextSnapshot();
  for(const table of ['Organization','Project','Worker','Task']){
    await client.query(`ALTER TABLE public."${table}" ADD COLUMN name text`);
    for(const row of fixture.displayLabels[table])await client.query(`UPDATE public."${table}" SET name=$1 WHERE id=$2`,[row.label,row.id]);
  }
  await client.query('UPDATE public.obrasaas_app_state SET state=$1,messages=$2 WHERE id=$3',[fixture.sources[0].stateText,fixture.sources[0].messagesText,'default']);
  const before=(await client.query('SELECT state::text,messages::text FROM public.obrasaas_app_state')).rows;
  const ordinary=await readLegacyCutover(reader),snapshot=await readLegacyCutover(reader,{withDisplayLabels:true});
  const {displayLabels,...plain}=snapshot;assert.deepEqual(plain,ordinary);assert.deepEqual(displayLabels,fixture.displayLabels);
  const draft=buildIdentityReview(snapshot,null,{sourceSha:SHA});assert.equal(draft.report.counts.withLabel,4);assert.equal(draft.report.counts.pending,4);
  const proposal=structuredClone(draft.proposal);proposal.plan=fillMappingSelections(proposal.plan);
  const verified=buildIdentityReview(await readLegacyCutover(reader,{withDisplayLabels:true}),proposal,{sourceSha:SHA});
  assert.equal(verified.report.status,'SELECTIONS_COMPLETE_NOT_AUTHORIZED');assert.equal(verified.report.importAuthorized,false);
  assert.equal(checkLegacyMappingPlan(snapshot,verified.proposal.plan,{sourceSha:SHA}).rehearsalSteps.length,4);
  await client.query('UPDATE public."Project" SET name=$1 WHERE id=$2',['Otro nombre visible','project-a']);
  const renamed=await readLegacyCutover(reader,{withDisplayLabels:true});
  assert.throws(()=>buildIdentityReview(renamed,proposal,{sourceSha:SHA}),{code:'IDENTITY_DISPLAY_OBSERVATION_CHANGED'});
  const {displayLabels:changedLabels,...sameCatalog}=renamed;assert.deepEqual(sameCatalog,ordinary);assert.notDeepEqual(changedLabels,displayLabels);
  await client.query('UPDATE public."Project" SET name=$1 WHERE id=$2',[fixture.displayLabels.Project[0].label,'project-a']);
  assert.deepEqual((await client.query('SELECT state::text,messages::text FROM public.obrasaas_app_state')).rows,before);
  assert.ok(!calls.some(sql=>/INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|COMMIT/.test(sql)));
  const proof={status:'PASS',environment:'disposable-local-postgresql17',realCustomerData:false,fixtureDdlAndDml:true,
    reviewerWrites:0,sourceUnchangedByReview:true,sameReadOnlySnapshot:true,unlabeledContractUnchanged:true,
    catalogRenameInvalidatesContext:true,checkedPlanCompatibleWithRehearsal:true,importAuthorized:false};
  mkdirSync('.vercel/identity-context-evidence',{recursive:true});
  writeFileSync('.vercel/identity-context-evidence/postgres.json',JSON.stringify(proof,null,2));
  writeFileSync('.vercel/identity-context-evidence/synthetic-snapshot.json',JSON.stringify(snapshot,null,2));
  console.log(JSON.stringify(proof));
}finally{await client.end();}
