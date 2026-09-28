import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildIdentityReview,reviewLabel} from '../scripts/lib/identity-review-context.mjs';
import {renderIdentityReview} from '../scripts/lib/identity-review-page.mjs';
import {readPrivateMappingReview,writePrivateMappingBundle} from '../scripts/lib/legacy-mapping-files.mjs';
import {checkLegacyMappingPlan,draftLegacyMappingPlan} from '../scripts/lib/legacy-mapping-plan.mjs';
import {parseIdentityReviewArguments,runIdentityReview} from '../scripts/review-legacy-identities.mjs';
import {readLegacyCutover} from '../scripts/lib/read-legacy-cutover.mjs';
import {identityContextSnapshot} from './helpers/identity-context-fixture.mjs';
import {editSource,fillMappingSelections,SHA} from './helpers/legacy-mapping-fixture.mjs';
const build=(snapshot=identityContextSnapshot(),proposal=null)=>buildIdentityReview(snapshot,proposal,{sourceSha:SHA});
test('context names identify source and destination without selecting candidates',()=>{
  const {proposal,context,report}=build();assert.equal(report.counts.withLabel,4);assert.equal(report.counts.pending,4);
  assert.ok(context.records.some(row=>row.label==='PRIVATE_ORG'));assert.ok(context.targets.some(row=>row.organizationLabel==='PRIVATE_ORG'));
  assert.ok(proposal.plan.records.every(row=>row.action==='UNREVIEWED'&&row.targetRef===null));
  assert.equal(report.importAuthorized,false);assert.equal(report.reviewIdentityVerified,false);
});
test('ordinary mapping contract is unchanged by optional context',()=>{
  const snapshot=identityContextSnapshot(),named=draftLegacyMappingPlan(snapshot,{sourceSha:SHA});delete snapshot.displayLabels;
  assert.deepEqual(named,draftLegacyMappingPlan(snapshot,{sourceSha:SHA}));
});
test('name matches are separate from ID candidates and never decisions',()=>{
  const bundle=build(),org=bundle.context.records.find(row=>row.kind==='organization');
  assert.equal(org.nameCandidateRefs.length,1);assert.equal(org.idCandidateRefs.length,0);
  const worker=bundle.context.records.find(row=>row.kind==='worker');assert.equal(worker.idCandidateRefs.length,2);
  assert.equal(bundle.proposal.plan.records.find(row=>row.sourceRef===org.sourceRef).action,'UNREVIEWED');
});
test('repeated source names are visible without merging distinct identities',()=>{
  const snapshot=identityContextSnapshot();editSource(snapshot,state=>state.tenants.push({id:'old-org-copy',name:'PRIVATE_ORG'}));
  const result=build(snapshot);assert.equal(result.context.duplicateSources.length,1);assert.equal(result.context.duplicateSources[0].length,2);
  assert.equal(result.report.counts.linked,0);assert.equal(result.proposal.plan.records.length,5);
});
test('same-named canonical companies remain two distinct destinations',()=>{
  const snapshot=identityContextSnapshot();snapshot.displayLabels.Organization[1].label='PRIVATE_ORG';
  const result=build(snapshot);assert.equal(result.context.duplicateTargets.length,1);
  assert.equal(result.context.records.find(row=>row.kind==='organization').nameCandidateRefs.length,2);
});
for(const field of ['Organization','Project','Worker','Task'])test('renamed canonical '+field+' invalidates the displayed observation',()=>{
  const snapshot=identityContextSnapshot(),proposal=build(snapshot).proposal;snapshot.displayLabels[field][0].label+=' changed';
  assert.throws(()=>build(snapshot,proposal),{code:'IDENTITY_DISPLAY_OBSERVATION_CHANGED'});
});
test('full label fingerprint catches changes beyond the display limit',()=>{
  const snapshot=identityContextSnapshot();snapshot.displayLabels.Project[0].label='x'.repeat(200)+'A';const proposal=build(snapshot).proposal;
  snapshot.displayLabels.Project[0].label='x'.repeat(200)+'B';assert.throws(()=>build(snapshot,proposal),{code:'IDENTITY_DISPLAY_OBSERVATION_CHANGED'});
});
test('truncated prefixes do not create false name candidates',()=>{
  const snapshot=identityContextSnapshot();editSource(snapshot,state=>{state.projects[0].name='x'.repeat(180)+'A';});
  snapshot.displayLabels.Project[0].label='x'.repeat(180)+'B';assert.equal(build(snapshot).context.records.find(row=>row.kind==='project').nameCandidateRefs.length,0);
});
for(const mutate of [s=>{delete s.displayLabels;},s=>{s.displayLabels.Worker.pop();},s=>{s.displayLabels.Project[0].id='foreign';},s=>{s.displayLabels.Organization[1].id=s.displayLabels.Organization[0].id;}])
  test('display inventory must cover the same canonical identities '+String(mutate),()=>{const snapshot=identityContextSnapshot();mutate(snapshot);assert.throws(()=>build(snapshot));});
test('exported proposal and report exclude labels and source sensitive columns',()=>{
  const result=build();const text=JSON.stringify({proposal:result.proposal,report:result.report});
  for(const value of ['PRIVATE_ORG','PRIVATE_PROJECT','PRIVATE_TASK','PRIVATE_PHONE','PRIVATE_DOCUMENT','PRIVATE_MESSAGE','Operario sintético','old-worker'])assert.ok(!text.includes(value),value);
  const html=renderIdentityReview(result);assert.ok(html.includes('PRIVATE_ORG'));for(const value of ['PRIVATE_PHONE','PRIVATE_DOCUMENT','PRIVATE_MESSAGE'])assert.ok(!html.includes(value));
});
for(const [input,expected] of [[null,null],[{},null],[3,null],['  Norte\u202e\nSur  ','Norte Sur'],['x'.repeat(180),'x'.repeat(160)]])
  test('display label normalization '+String(input),()=>assert.equal(reviewLabel(input),expected));
test('untrusted names cannot inject HTML or active scripts',()=>{
  const snapshot=identityContextSnapshot();editSource(snapshot,state=>{state.projects[0].name='</script><img src=x onerror=alert(1)>';});
  const html=renderIdentityReview(build(snapshot));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('\\u003c/script\\u003e'));
  assert.ok(html.includes("connect-src 'none'"));assert.ok(!html.includes("'unsafe-inline'"));
});
test('revalidated complete proposal converts to the unchanged rehearsal plan',()=>{
  const snapshot=identityContextSnapshot(),proposal=build(snapshot).proposal;proposal.plan=fillMappingSelections(proposal.plan);
  const result=build(snapshot,proposal);assert.equal(result.report.status,'SELECTIONS_COMPLETE_NOT_AUTHORIZED');
  assert.equal(checkLegacyMappingPlan(snapshot,result.proposal.plan,{sourceSha:SHA}).rehearsalSteps.length,4);
});
test('named review still rejects cross-company choices',()=>{
  const snapshot=identityContextSnapshot(),proposal=build(snapshot).proposal;proposal.plan=fillMappingSelections(proposal.plan);
  const worker=proposal.plan.records.find(row=>row.kind==='worker');worker.targetRef=proposal.plan.targets.find(row=>row.kind==='worker'&&row.ordinal===2).targetRef;
  assert.equal(build(snapshot,proposal).report.status,'BLOCKED');
});
for(const mutate of [p=>{p.contextDigest='0'.repeat(64);},p=>{p.authorization=true;},p=>{delete p.policyVersion;},p=>{p.plan.executionAllowed=true;}])
  test('untrusted export cannot add authority or change evidence '+String(mutate),()=>{const proposal=build().proposal;mutate(proposal);assert.throws(()=>build(identityContextSnapshot(),proposal));});
test('source edits and additional messages require a fresh observation',()=>{
  const snapshot=identityContextSnapshot(),proposal=build(snapshot).proposal;snapshot.sources[0].messagesText='[]';assert.throws(()=>build(snapshot,proposal));
});
const validArgs=['--expected-host','ep-unit.eu-central-1.aws.neon.tech','--output','.vercel/context','--private-context','local'];
test('explicit private context is required',()=>assert.equal(parseIdentityReviewArguments(validArgs)['--private-context'],'local'));
for(const args of [[],validArgs.slice(0,4),[...validArgs,'--private-context','local'],[...validArgs,'--apply','yes'],['--expected-host','host','--output','x','--private-context','public']])
  test('invalid or ambiguous arguments '+JSON.stringify(args),()=>assert.throws(()=>parseIdentityReviewArguments(args)));
for(const key of ['VERCEL','VERCEL_ENV','VERCEL_TARGET_ENV'])test('public runtime '+key+' rejected before database construction',async()=>{
  await assert.rejects(runIdentityReview(validArgs,{[key]:'production'}),{code:'IDENTITY_PUBLIC_RUNTIME_FORBIDDEN'});
});
test('named reader uses the same read-only observation, default query path unchanged',async()=>{
  const snapshot=identityContextSnapshot(),calls=[];let transaction=false;
  const client={async query(sql){calls.push(sql);if(sql.startsWith('BEGIN')){transaction=true;return {rows:[]};}
    if(sql==='ROLLBACK'){transaction=false;return {rows:[]};}
    assert.equal(transaction,true);if(sql.startsWith('SET LOCAL'))return {rows:[]};
    if(sql.includes('current_setting'))return {rows:[{ro:'on',isolation:'repeatable read'}]};
    if(sql.includes('octet_length'))return {rows:snapshot.sources.map(()=>({bytes:1000}))};
    if(sql.includes('state::text AS'))return {rows:snapshot.sources};
    if(sql.includes('to_jsonb(record)')){const table=sql.match(/public\."([A-Za-z]+)"/)[1];return {rows:snapshot.displayLabels[table]};}
    for(const [table,key] of [['Organization','organizations'],['ProjectSnapshot','projectSnapshots'],['Project','projects'],['Worker','workers'],['Task','tasks']])if(sql.includes('public."'+table+'"'))return {rows:snapshot[key]};
    if(sql.includes('_prisma_migrations'))return {rows:snapshot.migrations};throw new Error('Unexpected SQL');}};
  const named=await readLegacyCutover(client,{withDisplayLabels:true});assert.deepEqual(named,snapshot);assert.equal(transaction,false);
  assert.equal(calls.filter(sql=>sql.includes('to_jsonb(record)')).length,4);
  assert.ok(!calls.some(sql=>/INSERT|UPDATE|DELETE|ALTER|DROP|COMMIT/.test(sql)));
  calls.length=0;const ordinary=await readLegacyCutover(client);assert.equal(ordinary.displayLabels,undefined);assert.equal(calls.filter(sql=>sql.includes('to_jsonb(record)')).length,0);
});
test('private output interoperates with replay executor only after complete revalidation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'obrasaas-context-'));
  try{const snapshot=identityContextSnapshot(),proposal=build(snapshot).proposal;proposal.plan=fillMappingSelections(proposal.plan);const bundle=build(snapshot,proposal);
    await writePrivateMappingBundle(root,'.vercel/complete',{manifest:bundle.proposal,report:bundle.report,html:renderIdentityReview(bundle),validatedPlan:bundle.proposal.plan});
    const plan=await readPrivateMappingReview(root,'.vercel/complete/validated-plan.json');assert.equal(checkLegacyMappingPlan(snapshot,plan,{sourceSha:SHA}).rehearsalSteps.length,4);
    assert.equal((await readdir(join(root,'.vercel/complete'))).length,4);
    assert.ok(!(await readFile(join(root,'.vercel/complete/manifest.json'),'utf8')).includes('PRIVATE_ORG'));
    const draft=build();await assert.rejects(writePrivateMappingBundle(root,'.vercel/bad',{manifest:draft.proposal,report:draft.report,html:'test',validatedPlan:draft.proposal.plan}),{code:'PLAN_VALIDATED_EXPORT_INVALID'});
  }finally{await rm(root,{recursive:true,force:true});}
});
