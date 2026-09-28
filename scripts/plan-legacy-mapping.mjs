import { Client } from 'pg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CutoverAuditError } from './lib/legacy-cutover-audit.mjs';
import { auditConnectionConfig, readLegacyCutover } from './lib/read-legacy-cutover.mjs';
import { draftLegacyMappingPlan, checkLegacyMappingPlan } from './lib/legacy-mapping-plan.mjs';
import { readPrivateMappingReview, writePrivateMappingBundle } from './lib/legacy-mapping-files.mjs';
import { renderLegacyMappingReview } from './lib/legacy-mapping-review.mjs';
const fail=code=>{throw new CutoverAuditError(code);};
export function parseMappingArguments(args) {
  const parsed={};
  for(let index=0;index<args.length;index+=2) {
    const key=args[index],value=args[index+1];
    if(!['--expected-host','--output','--review'].includes(key)||Object.hasOwn(parsed,key)||!value||value.startsWith('--'))fail('PLAN_ARGUMENT_INVALID');
    parsed[key]=value;
  }
  if(!parsed['--expected-host']||!parsed['--output'])fail('PLAN_ARGUMENT_REQUIRED');
  return parsed;
}
export function mappingBundleFor(snapshot,manifest,{sourceSha}={}) {
  const reviewed=manifest??draftLegacyMappingPlan(snapshot,{sourceSha});
  const report=checkLegacyMappingPlan(snapshot,reviewed,{sourceSha});
  return {manifest:reviewed,report,html:renderLegacyMappingReview(reviewed)};
}

export async function runMappingPlan(args,environment=process.env) {
  const parsed=parseMappingArguments(args),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const config=auditConnectionConfig(environment.CUTOVER_AUDIT_DATABASE_URL,parsed['--expected-host']);
  const sha=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'});
  const dirty=spawnSync('git',['-C',root,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'});
  if(sha.status!==0||dirty.status!==0||dirty.stdout.trim())fail('PLAN_SOURCE_NOT_COMMITTED');
  const manifest=parsed['--review']?await readPrivateMappingReview(root,parsed['--review']):null;
  const client=new Client(config);client.on('error',()=>{});
  let bundle;
  try {
    await client.connect();
    bundle=mappingBundleFor(await readLegacyCutover(client),manifest,{sourceSha:sha.stdout.trim()});
  } finally {await client.end().catch(()=>{});}
  await writePrivateMappingBundle(root,parsed['--output'],bundle);
  const counts={};for(const finding of bundle.report.findings)counts[finding.code]=(counts[finding.code]||0)+1;
  return {status:manifest?'PLAN_RECHECK_COMPLETED':'PLAN_DRAFT_CREATED',selectionReadiness:bundle.report.status,
    importAuthorized:false,executionAllowed:false,reviewIdentityVerified:false,
    counts:bundle.report.counts,targets:bundle.manifest.targets.length,excludedMessages:bundle.report.excludedMessageCount,
    findingCounts:counts,planFingerprint:bundle.report.planFingerprint};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  runMappingPlan(process.argv.slice(2)).then(result=>{
    console.log(JSON.stringify(result));
    if(result.status==='PLAN_RECHECK_COMPLETED'&&result.selectionReadiness==='BLOCKED')process.exitCode=2;
  }).catch(error=>{
    console.error(JSON.stringify({status:'PLAN_FAILED',code:error instanceof CutoverAuditError?error.code:'PLAN_UNAVAILABLE',importAuthorized:false}));
    process.exitCode=1;
  });
}
