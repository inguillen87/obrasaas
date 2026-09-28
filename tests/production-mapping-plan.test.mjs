import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { draftLegacyMappingPlan,checkLegacyMappingPlan } from '../scripts/lib/legacy-mapping-plan.mjs';
import { mappingBundleFor,parseMappingArguments } from '../scripts/plan-legacy-mapping.mjs';
import { readPrivateMappingReview,writePrivateMappingBundle } from '../scripts/lib/legacy-mapping-files.mjs';
import { renderLegacyMappingReview } from '../scripts/lib/legacy-mapping-review.mjs';
import { SHA,mappingSnapshot,editSource,fillMappingSelections } from './helpers/legacy-mapping-fixture.mjs';
const draft=snapshot=>draftLegacyMappingPlan(snapshot,{sourceSha:SHA});
const check=(snapshot,plan)=>checkLegacyMappingPlan(snapshot,plan,{sourceSha:SHA});
const codes=result=>result.findings.map(finding=>finding.code);
test('draft never chooses a target, parent or a review result',()=>{
  const value=draft(mappingSnapshot());assert.equal(value.records.length,4);
  assert.ok(value.records.every(row=>row.action==='UNREVIEWED'&&row.targetRef===null&&row.reason===null));
  assert.equal(value.executionAllowed,false);assert.equal(value.importAuthorized,false);assert.equal(value.excludedMessageCount,1);
  assert.equal(value.records.find(row=>row.kind==='worker').candidates.length,2);
});
test('complete synthetic selections create only ordered reference rehearsal steps',()=>{
  const snapshot=mappingSnapshot(),plan=fillMappingSelections(draft(snapshot)),result=check(snapshot,plan);
  assert.equal(result.status,'SELECTIONS_COMPLETE_NOT_AUTHORIZED');assert.equal(result.rehearsalSteps.length,4);
  const kinds=result.rehearsalSteps.map(step=>plan.records.find(row=>row.sourceRef===step.sourceRef).kind);
  assert.deepEqual(kinds,['organization','project','worker','task']);
  assert.equal(result.executionAllowed,false);assert.equal(result.importAuthorized,false);assert.equal(result.reviewIdentityVerified,false);
  assert.equal(result.excludedMessageCount,1);assert.ok(result.auditBlockers.some(row=>row.code==='HISTORICAL_ASSERTIONS_REQUIRE_REVIEW'));
});

test('same selections keep operation keys stable when their order changes',()=>{
  const snapshot=mappingSnapshot(),plan=fillMappingSelections(draft(snapshot));const first=check(snapshot,plan);
  plan.records.reverse();const second=check(snapshot,plan);assert.equal(second.planFingerprint,first.planFingerprint);assert.deepEqual(second.rehearsalSteps,first.rehearsalSteps);
});
for(const [name,change] of [
  ['source amount',s=>editSource(s,x=>{x.tasks['old-task'].amount='9007199254740993.26';})],
  ['message body',s=>{s.sources[0].messagesText='[{"text":"changed"}]';}],
  ['project ownership',s=>{s.projects[0].organizationId='org-b';}],
  ['task identity',s=>{s.tasks[0].externalId='new';}],
  ['schema history',s=>{s.migrations.push({name:'later',completed:true,rolledBack:false});}],
  ['catalog creation',s=>{s.organizations.push({id:'org-c'});}],
])test('rejects stale '+name,()=>{const snapshot=mappingSnapshot(),plan=draft(snapshot);change(snapshot);assert.throws(()=>check(snapshot,plan),{code:'PLAN_OBSERVATION_CHANGED'});});
for(const [name,change] of [
  ['authority flag',p=>{p.importAuthorized=true;}],['executable flag',p=>{p.executionAllowed=true;}],
  ['code revision',p=>{p.sourceSha='b'.repeat(40);}],['policy',p=>{p.policyVersion='other';}],
  ['unknown root',p=>{p.approved=true;}],['dropped row',p=>p.records.pop()],
  ['duplicate row',p=>{p.records[1]=p.records[0];}],['unknown action',p=>{p.records[0].action='IMPORT';}],
  ['injected property',p=>{p.records[0].payload={};}],['altered warning',p=>{p.records[0].warnings=['fake'];}],
  ['wrong target kind',p=>{p.records[0].targetRef=p.targets.find(t=>t.kind==='worker').targetRef;}],
  ['invented target',p=>{p.records[0].targetRef='target_'+'0'.repeat(64);}],
  ['arbitrary reason',p=>{p.records[0].reason='private text';}],['source locator',p=>{p.records[0].ordinal=99;}],
  ['invented candidate',p=>{p.records[0].candidates=['unexpected'];}],
])test('rejects tampered '+name,()=>{const s=mappingSnapshot(),p=fillMappingSelections(draft(s));change(p);assert.throws(()=>check(s,p),e=>typeof e.code==='string');});

for(const kind of ['project','worker','task'])test('cross-scope choice rejected for '+kind,()=>{
  const s=mappingSnapshot();if(kind==='task')s.tasks.push({id:'task-b',projectId:'project-b',externalId:'old-task'});
  const plan=fillMappingSelections(draft(s)),row=plan.records.find(r=>r.kind===kind);
  row.targetRef=plan.targets.find(t=>t.kind===kind&&t.ordinal===2).targetRef;
  const result=check(s,plan);assert.ok(codes(result).includes('CROSS_SCOPE_TARGET'));assert.equal(result.rehearsalSteps.length,0);
});
for(const kind of ['project','worker','task'])test('requires a reviewed parent for '+kind,()=>{
  const s=mappingSnapshot(),plan=fillMappingSelections(draft(s));plan.records.find(r=>r.kind===kind).parentSourceRef=null;
  assert.ok(codes(check(s,plan)).includes('REVIEWED_PARENT_REQUIRED'));
});
test('records from different source groups cannot share a parent selection',()=>{
  const s=mappingSnapshot();s.sources.push({...s.sources[0],id:'second'});
  const plan=fillMappingSelections(draft(s)),worker=plan.records.find(r=>r.kind==='worker'&&r.sourceGroup===2);
  worker.parentSourceRef=plan.records.find(r=>r.kind==='project'&&r.sourceGroup===1).sourceRef;
  assert.ok(codes(check(s,plan)).includes('REVIEWED_PARENT_REQUIRED'));
});
test('two different historical companies cannot silently merge into one',()=>{
  const s=editSource(mappingSnapshot(),x=>x.tenants.push({id:'another-legacy-company'}));
  assert.ok(codes(check(s,fillMappingSelections(draft(s)))).includes('MANY_TO_ONE_MERGE_FORBIDDEN'));
});
for(const [name,modify,code]of [
  ['duplicate ID',x=>x.workerRegistry.push({...x.workerRegistry[0]}),'SOURCE_IDENTIFIER_DUPLICATED'],
  ['missing ID',x=>{delete x.workerRegistry[0].id;},'SOURCE_IDENTIFIER_INVALID'],
  ['different key and ID',x=>{x.tasks['old-task'].id='different';},'SOURCE_KEY_ID_MISMATCH'],
  ['contradictory company',x=>{x.workerRegistry[0].organizationId='org-b';},'SOURCE_SCOPE_CONFLICT'],
  ['unknown declared project',x=>{x.workerRegistry[0].projectId='missing';},'DECLARED_SCOPE_UNKNOWN'],
])test('unresolved source blocks '+name,()=>{const s=editSource(mappingSnapshot(),modify);assert.ok(codes(check(s,fillMappingSelections(draft(s)))).includes(code));});

test('deferred records stay visible and cannot enable rehearsal steps',()=>{
  const s=mappingSnapshot(),plan=draft(s);for(const row of plan.records)Object.assign(row,{action:'DEFER',reason:'NEEDS_EVIDENCE'});
  const result=check(s,plan);assert.equal(result.counts.deferred,4);assert.equal(result.status,'BLOCKED');assert.deepEqual(result.rehearsalSteps,[]);
});
test('exact catalog ID cannot be retargeted by manual selection',()=>{
  const s=editSource(mappingSnapshot(),x=>{x.tenants[0].id='org-a';x.projects[0].tenantId='org-a';});
  const plan=fillMappingSelections(draft(s));plan.records[0].targetRef=plan.targets.find(t=>t.kind==='organization'&&t.ordinal===2).targetRef;
  assert.ok(codes(check(s,plan)).includes('EXACT_IDENTITY_RETARGETED'));
});
test('empty or absent sources do not produce a completed review',()=>{
  const s=mappingSnapshot();s.sources=[];assert.equal(check(s,draft(s)).status,'BLOCKED');
});
test('incomplete migration status blocks a complete set of selections',()=>{
  const s=mappingSnapshot();s.migrations.push({name:'failed',completed:false,rolledBack:false});
  assert.ok(codes(check(s,fillMappingSelections(draft(s)))).includes('INCOMPLETE_MIGRATIONS'));
});
test('record limit is enforced before constructing an unbounded worksheet',()=>{
  const s=editSource(mappingSnapshot(),x=>{x.workerRegistry=Array.from({length:5001},(_,i)=>({id:'w'+i}));});
  assert.throws(()=>draft(s),{code:'PLAN_SIZE_LIMIT'});
});
test('files and HTML never contain source IDs, direct PII or monetary values',()=>{
  const s=mappingSnapshot(),bundle=mappingBundleFor(s,null,{sourceSha:SHA});
  for(const needle of ['PRIVATE_ORG','PRIVATE_PHONE','PRIVATE_DOCUMENT','PRIVATE_MESSAGE','9007199254740993','old-worker','source-private-id'])
    assert.ok(!JSON.stringify(bundle).includes(needle),needle);
  assert.ok(bundle.manifest.records.every(row=>row.targetRef===null));assert.match(bundle.html,/connect-src 'none'/);
});
test('HTML embeds hostile source text only as escaped inert data',()=>{
  const plan=draft(mappingSnapshot());plan.untrusted='</script><script>window.pwned=1</script>';
  const html=renderLegacyMappingReview(plan);assert.ok(!html.includes(plan.untrusted));assert.match(html,/\\u003c\/script/);
});

for(const args of [[],['--output','x'],['--expected-host','x','--output'],['--expected-host','x','--output','x','--apply','true'],['--expected-host','x','--output','x','--approve','true'],['--expected-host','x','--output','x','--review','a','--review','b']])
  test('CLI has no import/approve mode: '+JSON.stringify(args),()=>assert.throws(()=>parseMappingArguments(args)));
async function tempRoot(fn){const root=await mkdtemp(join(tmpdir(),'obrasaas-plan-'));try{await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
test('private bundle writes new files without replacing previous evidence',()=>tempRoot(async root=>{
  const bundle=mappingBundleFor(mappingSnapshot(),null,{sourceSha:SHA});
  const folder=await writePrivateMappingBundle(root,'.vercel/review-test',bundle);
  assert.deepEqual((await readdir(folder)).sort(),['check.json','manifest.json','review.html']);
  assert.deepEqual(await readPrivateMappingReview(root,'.vercel/review-test/manifest.json'),bundle.manifest);
  const original=await readFile(join(folder,'manifest.json'),'utf8');
  await assert.rejects(()=>writePrivateMappingBundle(root,'.vercel/review-test',bundle),{code:'PLAN_BUNDLE_EXISTS'});
  assert.equal(await readFile(join(folder,'manifest.json'),'utf8'),original);
}));
for(const path of ['report','../other','.vercel/../outside','.vercel'])test('output restricted to private workspace: '+path,()=>tempRoot(async root=>{
  await assert.rejects(()=>writePrivateMappingBundle(root,path,mappingBundleFor(mappingSnapshot(),null,{sourceSha:SHA})),e=>Boolean(e.code));
}));
test('symbolic-link directory cannot redirect a report outside the workspace',()=>tempRoot(async root=>{
  await mkdir(join(root,'elsewhere'));await symlink(join(root,'elsewhere'),join(root,'.vercel'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(()=>writePrivateMappingBundle(root,'.vercel/review',mappingBundleFor(mappingSnapshot(),null,{sourceSha:SHA})),{code:'PLAN_FILE_LOCATION_INVALID'});
  assert.deepEqual(await readdir(join(root,'elsewhere')),[]);
}));
test('review reader rejects a symbolic link, non-JSON and oversized inputs',()=>tempRoot(async root=>{
  await mkdir(join(root,'.vercel'));await writeFile(join(root,'.vercel','source.json'),'{}');
  if(process.platform==='win32'){await mkdir(join(root,'link-target'));await symlink(join(root,'link-target'),join(root,'.vercel','linked.json'),'junction');}
  else await symlink(join(root,'.vercel','source.json'),join(root,'.vercel','linked.json'));
  await assert.rejects(()=>readPrivateMappingReview(root,'.vercel/linked.json'),{code:'PLAN_REVIEW_FILE_INVALID'});
  await writeFile(join(root,'.vercel','large.json'),'x'.repeat(16*1024*1024+1));
  await assert.rejects(()=>readPrivateMappingReview(root,'.vercel/large.json'),{code:'PLAN_REVIEW_FILE_INVALID'});
  await assert.rejects(()=>readPrivateMappingReview(root,'.vercel/source.txt'),{code:'PLAN_REVIEW_FILE_INVALID'});
}));

test('HTML script fingerprints survive Windows line-ending conversion',async()=>{
  const source=await readFile(new URL('../scripts/lib/legacy-mapping-review.mjs',import.meta.url),'utf8');
  const windows=source.replace(/\r\n?/g,'\n').replace(/\n/g,'\r\n');
  const alternate=await import('data:text/javascript;base64,'+Buffer.from(windows).toString('base64'));
  assert.equal(alternate.renderLegacyMappingReview(draft(mappingSnapshot())),renderLegacyMappingReview(draft(mappingSnapshot())));
});
test('changing a selection changes the proposed operation fingerprint',()=>{
  const s=mappingSnapshot(),before=draft(s),after=fillMappingSelections(before);
  assert.notEqual(check(s,before).planFingerprint,check(s,after).planFingerprint);
});
