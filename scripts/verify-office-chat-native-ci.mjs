// Source-only proposal644. This envelope never authenticates CI by env alone.
// Final acceptance requires the independently fetched GitHub run/job/artifact
// (including digest) for these committed bytes. No local fake-CI positive run.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {OFFICE_NATIVE_CI_EVIDENCE,OFFICE_NATIVE_CI_WORKFLOW_PATH,officeCiSnapshot,officeCiContext,inspectOfficeCiService,officeCiSqlIdentity,officeCiOwnedDatabaseCatalog} from './lib/office-chat-native-ci-context.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const sha=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const requireCi=(value,label)=>{if(!value)throw Object.assign(new Error(label),{code:'OFFICE_NATIVE_CI_ENVELOPE_REJECTED'});};
const ref=file=>{const bytes=readFileSync(path.join(root,file));return {path:file,bytes:bytes.length,sha256:sha(bytes)};};
const output=path.join(root,OFFICE_NATIVE_CI_EVIDENCE);
function expectedChecks(file,count){
 const tree=parse(readFileSync(path.join(root,file),'utf8'),{sourceType:'module'}),declarations=tree.program.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).filter(node=>node.id.type==='Identifier'&&node.id.name==='expectedChecks');
 requireCi(declarations.length===1&&declarations[0].init?.type==='ArrayExpression','One actual native expectedChecks declaration required');
 const elements=declarations[0].init.elements;requireCi(elements.length===count&&elements.every(node=>node?.type==='StringLiteral')&&new Set(elements.map(node=>node.value)).size===count,'Original distinct native cases required');return elements.map(node=>node.value);
}
async function main(){
 const args=process.argv.slice(2);requireCi(args.length===2&&args[0]==='--expected-head'&&/^[a-f0-9]{40}$/.test(args[1]),'Use --expected-head <actual commit>');
 const before=officeCiSnapshot(args[1]),context=officeCiContext(before),serviceBefore=inspectOfficeCiService(context),sqlBefore=await officeCiSqlIdentity(serviceBefore),node={version:process.version,executableSha256:sha(readFileSync(process.execPath))};
 requireCi(!existsSync(output),'Create-only evidence directory required');mkdirSync(output,{recursive:true});
 const save=(name,value)=>writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 save('source-before.json',before);save('service-before.json',{service:serviceBefore,sql:sqlBefore});
 const results=[],createdDatabases=[];let failure=null,databaseOwnership=null;
 try{
  for(const spec of [{variant:'dedicated',file:'scripts/verify-office-chat-postgres.mjs',count:15,status:'PASS_NATIVE_DEDICATED_CORE_ONLY',schema:'office-chat-dedicated-native-pg-result.v1'},{variant:'own',file:'scripts/verify-office-chat-own-postgres.mjs',count:5,status:'PASS_NATIVE_OWN_CORE_ONLY',schema:'office-chat-own-native-pg-result.v1'}]){
   const names=expectedChecks(spec.file,spec.count),startedAt=new Date().toISOString();
   const child=spawnSync(process.execPath,[spec.file,'--github-actions-service'],{cwd:root,env:process.env,encoding:'utf8',maxBuffer:32*1024*1024});
   writeFileSync(path.join(output,spec.variant+'.stdout'),child.stdout||'',{flag:'wx'});writeFileSync(path.join(output,spec.variant+'.stderr'),child.stderr||'',{flag:'wx'});
   const finishedAt=new Date().toISOString(),nativePath=OFFICE_NATIVE_CI_EVIDENCE+'/'+spec.variant+'/result.json',record={variant:spec.variant,startedAt,finishedAt,exitCode:child.status,signal:child.signal||null,accepted:false,native:existsSync(path.join(root,nativePath))?ref(nativePath):null,observedNative:null};results.push(record);
   if(record.native){const observed=JSON.parse(readFileSync(path.join(root,nativePath)));requireCi(Array.isArray(observed.checks)&&Number.isInteger(observed.checksCompleted)&&observed.checksCompleted===observed.checks.length&&observed.checksExpected===spec.count&&same(observed.checks,names.slice(0,observed.checksCompleted)),'Honest original native progress required');record.observedNative={status:observed.status,checksExpected:observed.checksExpected,checksCompleted:observed.checksCompleted,checks:observed.checks};}
   requireCi(!child.error&&!child.signal&&child.status===0,'Original native child did not exit successfully: '+spec.variant);
   const native=JSON.parse(readFileSync(path.join(root,nativePath))),nativeContext=JSON.parse(readFileSync(path.join(output,spec.variant,'ci-context.json')));
   requireCi(native.schema===spec.schema&&native.status===spec.status&&!native.failure&&native.checksExpected===spec.count&&native.checksCompleted===spec.count&&same(native.checks,names),'All original native cases must actually pass');
   requireCi(native.externalNetworkAttempts===0&&native.realProviderRequests===0&&native.productionDataWritten===false&&native.personalIdentityOrFieldAccepted===false&&native.sourceFilesUnchanged===true&&native.sourceFiles===before.files.length,'Native source and provider boundary required');
   requireCi(native.mediaIo&&Object.values(native.mediaIo).every(value=>value===0)&&native.ownedLocalConnections>0,'Only actual local SQL with no media I/O required');
   requireCi(nativeContext.binding?.mode==='github-actions-service'&&same(nativeContext.binding.ci,context)&&same(native.ciExecution,context)&&same(nativeContext.sourceCensus,before),'Current native context and full source census required');
   requireCi(nativeContext.sqlIdentity.id===sqlBefore.id&&same(nativeContext.serviceBefore.container,serviceBefore.container)&&same(nativeContext.serviceBefore.image,serviceBefore.image)&&same(nativeContext.serviceBefore.network,serviceBefore.network),'Same owned service and SQL identity required');
   requireCi(spec.variant!=='own'||native.databases?.length===7&&native.negativeAuthorityVariants===3,'Original seven OWN databases and three issuer/audit/ciphertext variants required');
   const afterChild=officeCiSnapshot(args[1]);requireCi(same(afterChild,before),'Source changed during native child');
   record.accepted=true;record.context=ref(OFFICE_NATIVE_CI_EVIDENCE+'/'+spec.variant+'/ci-context.json');createdDatabases.push(...(spec.variant==='dedicated'?[native.database]:native.databases));
  }
  databaseOwnership=await officeCiOwnedDatabaseCatalog(createdDatabases);save('database-ownership.json',databaseOwnership);
 }catch(error){failure={code:typeof error?.code==='string'&&/^[A-Z0-9_]{1,100}$/.test(error.code)?error.code:'OFFICE_NATIVE_CI_UNCONFIRMED'};}
 let serviceAfter=null,sqlAfter=null,after=null;
 try{after=officeCiSnapshot(args[1]);requireCi(same(before,after)&&process.version===node.version&&sha(readFileSync(process.execPath))===node.executableSha256,'Source or Node changed');serviceAfter=inspectOfficeCiService(context);sqlAfter=await officeCiSqlIdentity(serviceAfter);requireCi(same(serviceBefore.container,serviceAfter.container)&&same(serviceBefore.image,serviceAfter.image)&&same(serviceBefore.network,serviceAfter.network)&&sqlBefore.id===sqlAfter.id,'Owned service changed');}
 catch{failure??={code:'OFFICE_NATIVE_CI_FINAL_RECHECK_FAILED'};}
 if(after)save('source-after.json',after);if(serviceAfter)save('service-after.json',{service:serviceAfter,sql:sqlAfter});
 const receipt={schema:'office-chat-native-ci-envelope.v1',status:failure?'FAIL_OR_INCOMPLETE':'NATIVE_CASES_PASSED_EXTERNAL_CI_VERIFICATION_REQUIRED',ciRun:context,node,workflow:ref(OFFICE_NATIVE_CI_WORKFLOW_PATH),sourceBefore:ref(OFFICE_NATIVE_CI_EVIDENCE+'/source-before.json'),sourceAfter:after?ref(OFFICE_NATIVE_CI_EVIDENCE+'/source-after.json'):null,results,acceptedChecksCompleted:results.filter(row=>row.accepted).reduce((sum,row)=>sum+row.observedNative.checksCompleted,0),checksPlanned:20,databaseOwnership:databaseOwnership?ref(OFFICE_NATIVE_CI_EVIDENCE+'/database-ownership.json'):null,productionDataWritten:false,realProviderRequests:0,sourceRetagged:false,externalGitHubRunArtifactVerification:'REQUIRED_NOT_PERFORMED_BY_THIS_PROCESS',databaseCleanup:'Job-owned service lifecycle; synthetic child databases retained until GitHub destroys its service; no PID kill, DROP of foreign DBs or container stop',failure};
 save('envelope.json',receipt);console.log(JSON.stringify({status:receipt.status,acceptedChecksCompleted:receipt.acceptedChecksCompleted,checksPlanned:receipt.checksPlanned}));if(failure)process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error?.code||'OFFICE_NATIVE_CI_PREFLIGHT_FAILED');process.exitCode=1;});
