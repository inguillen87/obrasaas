import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { configuration, assertDisposableArchiveVsPending } from './verify-project-certificates-migration.mjs';

const report={status:'RUNNING',environment:'disposable-postgresql-17',orders:[],productionModified:false};
try {
  const config=configuration();
  if(!config.local || !config.disposable || process.env.VERCEL_ENV==='production' || process.env.VERCEL_TARGET_ENV==='production')
    throw new Error('Archive-order stress requires the explicitly acknowledged local disposable certificate database.');
  // Fixed coverage, not retry-until-success: all 15 outcomes must satisfy the contract.
  for(let iteration=1;iteration<=3;iteration++)
    await assertDisposableArchiveVsPending(config.connectionString,config.schema,{record:result=>report.orders.push({iteration,...result})});
  report.status='PASS';
} catch(error) {
  report.status='FAIL';report.error=String(error.message);process.exitCode=1;
} finally {
  const output=path.resolve(process.env.CERTIFICATE_ARCHIVE_PROOF_PATH||'evidence/certificate-archive-orders.json');
  mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
