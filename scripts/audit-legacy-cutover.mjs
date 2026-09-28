import { Client } from 'pg';
import { mkdir,readFile,writeFile,realpath,lstat } from 'node:fs/promises';
import { resolve,dirname,relative,isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { analyzeLegacyCutover,compareCutoverAudits,CutoverAuditError } from './lib/legacy-cutover-audit.mjs';
import { auditConnectionConfig,readLegacyCutover } from './lib/read-legacy-cutover.mjs';
const fail=code=>{throw new CutoverAuditError(code);};
export function parseAuditArguments(args){
  const result={};
  for(let i=0;i<args.length;i+=2){
    const key=args[i];if(!['--expected-host','--output','--compare'].includes(key)||Object.hasOwn(result,key)||!args[i+1]||args[i+1].startsWith('--'))fail('AUDIT_ARGUMENT_INVALID');
    result[key]=args[i+1];
  }
  if(!result['--expected-host']||!result['--output'])fail('AUDIT_ARGUMENT_REQUIRED');return result;
}
async function privateOutput(pathname,root){
  const output=resolve(root,pathname),folder=resolve(root,'.vercel'),rel=relative(folder,output);
  if(!rel||rel.startsWith('..')||isAbsolute(rel)||!output.endsWith('.json'))fail('AUDIT_OUTPUT_LOCATION_INVALID');
  await mkdir(dirname(output),{recursive:true});
  const base=await realpath(root),actual=await realpath(dirname(output));
  const actualRel=relative(resolve(base,'.vercel'),actual);
  if(actualRel.startsWith('..')||isAbsolute(actualRel))fail('AUDIT_OUTPUT_LOCATION_INVALID');
  const existing=await lstat(output).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  if(existing)fail('AUDIT_OUTPUT_EXISTS');return output;
}
export async function runAudit(args,environment=process.env){
  const parsed=parseAuditArguments(args),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const config=auditConnectionConfig(environment.CUTOVER_AUDIT_DATABASE_URL,parsed['--expected-host']);
  const sha=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'});
  const dirty=spawnSync('git',['-C',root,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'});
  if(sha.status!==0||dirty.status!==0||dirty.stdout.trim())fail('AUDIT_SOURCE_NOT_COMMITTED');
  const output=await privateOutput(parsed['--output'],root);
  const client=new Client(config);client.on('error',()=>{});
  let report;
  try{await client.connect();report=analyzeLegacyCutover(await readLegacyCutover(client),{sourceSha:sha.stdout.trim()});}
  finally{await client.end().catch(()=>{});}
  let comparison=null;
  if(parsed['--compare']){
    let previous;try{previous=JSON.parse(await readFile(resolve(root,parsed['--compare']),'utf8'));}
    catch{fail('AUDIT_COMPARISON_UNAVAILABLE');}
    comparison=compareCutoverAudits(previous.report??previous,report);
  }
  const receipt={observedAt:new Date().toISOString(),report,comparison};
  await writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  return {status:'AUDIT_COMPLETED',migrationReadiness:report.status,importAuthorized:false,
    sourceFingerprint:report.sourceFingerprint,catalogFingerprint:report.catalogFingerprint,
    totals:report.totals,blockers:report.blockers,comparison};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  runAudit(process.argv.slice(2)).then(result=>{
    console.log(JSON.stringify(result));
    if(result.comparison&&(!result.comparison.sourceUnchanged||!result.comparison.catalogUnchanged))process.exitCode=2;
  }).catch(error=>{
    console.error(JSON.stringify({status:'AUDIT_FAILED',code:error instanceof CutoverAuditError?error.code:'AUDIT_UNAVAILABLE',importAuthorized:false}));
    process.exitCode=1;
  });
}
