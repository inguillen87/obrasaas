import { Client } from 'pg';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CutoverAuditError } from './lib/legacy-cutover-audit.mjs';
import { readLegacyCutover } from './lib/read-legacy-cutover.mjs';
import { checkLegacyMappingPlan } from './lib/legacy-mapping-plan.mjs';
import { readPrivateMappingReview, writePrivateMappingBundle } from './lib/legacy-mapping-files.mjs';
import { LINK_TARGET, failLink, linkRehearsalConfig, recordCommand, revertCommand, linkFlags } from './lib/legacy-link-policy.mjs';
import { executeLinkRehearsal } from './lib/legacy-link-store.mjs';
import { renderLinkRehearsalReport } from './lib/legacy-link-report.mjs';

export function parseLinkArguments(args) {
  const values={};
  for(let i=0;i<args.length;i+=2) {
    const [key,value]=args.slice(i,i+2);
    if(!['--mode','--branch','--review','--receipt','--operation-key','--output'].includes(key)||
        Object.hasOwn(values,key)||!value||value.startsWith('--')) failLink('REHEARSAL_ARGUMENT_INVALID');
    values[key]=value;
  }
  values['--mode'] ??= 'check';
  if(!['check','record','revert'].includes(values['--mode'])) failLink('REHEARSAL_ARGUMENT_INVALID');
  if(values['--branch']!==LINK_TARGET.branchId||!values['--output']) failLink('REHEARSAL_ARGUMENT_REQUIRED');
  const revert=values['--mode']==='revert';
  if(revert?!values['--receipt']||values['--review']:!values['--review']||values['--receipt']) failLink('REHEARSAL_ARGUMENT_INVALID');
  if(values['--mode']!=='check'&&!values['--operation-key']) failLink('REHEARSAL_OPERATION_KEY_REQUIRED');
  if(values['--mode']==='check'&&values['--operation-key']) failLink('REHEARSAL_ARGUMENT_INVALID');
  return values;
}
export async function runLinkCommand(args,environment=process.env) {
  const options=parseLinkArguments(args),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const config=linkRehearsalConfig(environment.CUTOVER_REHEARSAL_DATABASE_URL,options['--branch'],environment);
  const sha=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'});
  const status=spawnSync('git',['-C',root,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'});
  if(sha.status!==0||status.status!==0||status.stdout.trim()) failLink('REHEARSAL_SOURCE_NOT_COMMITTED');
  const sourceSha=sha.stdout.trim(),mode=options['--mode'];
  const input=await readPrivateMappingReview(root,options['--review']||options['--receipt']);
  const makeClient=()=>{const client=new Client(config);client.on('error',()=>{});return client;};
  let report;
  if(mode==='check') {
    const client=makeClient();
    try{await client.connect();report={...checkLegacyMappingPlan(await readLegacyCutover(client),input,{sourceSha}),sourceRevalidated:true,...linkFlags};}
    finally{await client.end().catch(()=>{});}
  } else {
    const settings={sourceSha,operationKey:options['--operation-key']};
    const command=mode==='record'?recordCommand(input,settings):revertCommand(input,settings);
    report=await executeLinkRehearsal(makeClient,command,mode==='record'?input:null);
  }
  // A report-file failure must never be represented as a failed database write.
  // Reuse the SAME operation key and input to recover the persisted receipt.
  try {await writePrivateMappingBundle(root,options['--output'],{manifest:input,report,html:renderLinkRehearsalReport(report)});}
  catch(error) {if(mode!=='check') failLink('REHEARSAL_REPORT_FAILED_RECOVER_SAME_KEY');throw error;}
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  runLinkCommand(process.argv.slice(2)).then(report=>{
    console.log(JSON.stringify(report));if(report.status==='BLOCKED')process.exitCode=2;
  }).catch(error=>{console.error(JSON.stringify({status:'REHEARSAL_FAILED',code:error instanceof CutoverAuditError?error.code:'REHEARSAL_UNAVAILABLE',...linkFlags}));process.exitCode=1;});
}
