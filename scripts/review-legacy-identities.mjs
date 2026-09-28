import {Client} from 'pg';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {CutoverAuditError} from './lib/legacy-cutover-audit.mjs';
import {auditConnectionConfig,readLegacyCutover} from './lib/read-legacy-cutover.mjs';
import {readPrivateMappingReview,writePrivateMappingBundle} from './lib/legacy-mapping-files.mjs';
import {buildIdentityReview} from './lib/identity-review-context.mjs';
import {renderIdentityReview} from './lib/identity-review-page.mjs';
const fail=code=>{throw new CutoverAuditError(code);};
export function parseIdentityReviewArguments(args){
  const options={};
  for(let i=0;i<args.length;i+=2){const [key,value]=args.slice(i,i+2);
    if(!['--expected-host','--output','--review','--private-context'].includes(key)||Object.hasOwn(options,key)||!value||value.startsWith('--'))fail('IDENTITY_ARGUMENT_INVALID');
    options[key]=value;
  }
  if(!options['--expected-host']||!options['--output']||options['--private-context']!=='local')fail('IDENTITY_PRIVATE_CONTEXT_REQUIRED');
  return options;
}
export async function runIdentityReview(args,environment=process.env){
  const options=parseIdentityReviewArguments(args),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  if(environment.VERCEL||environment.VERCEL_ENV||environment.VERCEL_TARGET_ENV)fail('IDENTITY_PUBLIC_RUNTIME_FORBIDDEN');
  const config=auditConnectionConfig(environment.CUTOVER_AUDIT_DATABASE_URL,options['--expected-host']);
  const sha=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'});
  const dirty=spawnSync('git',['-C',root,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'});
  if(sha.status!==0||dirty.status!==0||dirty.stdout.trim())fail('IDENTITY_SOURCE_NOT_COMMITTED');
  const proposal=options['--review']?await readPrivateMappingReview(root,options['--review']):null;
  const client=new Client(config);client.on('error',()=>{});let bundle;
  try{await client.connect();bundle=buildIdentityReview(await readLegacyCutover(client,{withDisplayLabels:true}),proposal,{sourceSha:sha.stdout.trim()});}
  finally{await client.end().catch(()=>{});}
  const validatedPlan=proposal&&bundle.report.status==='SELECTIONS_COMPLETE_NOT_AUTHORIZED'?bundle.proposal.plan:undefined;
  await writePrivateMappingBundle(root,options['--output'],{manifest:bundle.proposal,report:bundle.report,html:renderIdentityReview(bundle),validatedPlan});
  return {status:proposal?'IDENTITY_RECHECK_COMPLETED':'IDENTITY_CONTEXT_CREATED',selectionReadiness:bundle.report.status,
    displayContextValidated:true,localHtmlContainsNames:true,exportContainsNames:false,validatedPlanWritten:Boolean(validatedPlan),
    counts:bundle.report.counts,excludedMessages:bundle.report.excludedMessageCount,sourceSha:sha.stdout.trim(),
    executionAllowed:false,importAuthorized:false,reviewIdentityVerified:false,businessDataWritten:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runIdentityReview(process.argv.slice(2)).then(report=>{console.log(JSON.stringify(report));
    if(report.status==='IDENTITY_RECHECK_COMPLETED'&&report.selectionReadiness==='BLOCKED')process.exitCode=2;
  }).catch(error=>{console.error(JSON.stringify({status:'IDENTITY_REVIEW_FAILED',code:error instanceof CutoverAuditError?error.code:'IDENTITY_REVIEW_UNAVAILABLE',businessDataWritten:false,importAuthorized:false}));process.exitCode=1;});
}
