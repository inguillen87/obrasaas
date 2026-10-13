import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {ORGANIZATION_USAGE_PG_VERSION,ORGANIZATION_USAGE_PG_CHECKS} from './verify-organization-usage-postgres.mjs';
import {ORGANIZATION_USAGE_UI_VERSION,ORGANIZATION_USAGE_UI_CHECKS,ORGANIZATION_USAGE_UI_WIDTHS} from './verify-organization-usage-ui.mjs';

export const ORGANIZATION_USAGE_CI_VERSION='organization-usage-ci-v2';
const pgHarness='scripts/verify-organization-usage-postgres.mjs',uiHarness='scripts/verify-organization-usage-ui.mjs',cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs';
const dependencies=['package-lock.json','package.json'];
const uiRoots=['src/app/(identity)/cuenta/company-subscription-panel.js','src/app/(identity)/cuenta/plan-import-panel.js'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const requireProof=(condition,message)=>{if(!condition)throw Object.assign(new Error(message),{code:'ORGANIZATION_USAGE_CI_REJECTED'});};
const same=(a,b,message)=>requireProof(JSON.stringify(a)===JSON.stringify(b),message);
const safePath=value=>typeof value==='string'&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../')&&/^(src|scripts|tests)\//.test(value);
function imports(bytes,file){
 if(file.endsWith('.css')){requireProof(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'External CSS dependency');return [];}
 const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx'],createImportExpressions:true}),found=[];
 function visit(node){if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)found.push(node.source.value);
  if(node.type==='ImportExpression'){requireProof(node.source.type==='StringLiteral','Hidden nonliteral source import');found.push(node.source.value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }visit(ast.program);return found;
}
export function organizationUsageCiSourceClosure(readSource,{ui=false,fixture=false}={}){
 requireProof(!(ui&&fixture),'Distinct browser and Node fixture closures');
 const files=new Set(ui||fixture?[]:dependencies),external=new Set();
 for(const file of files)requireProof(readSource(file)!=null,'Missing package dependency: '+file);
 function visit(file){requireProof(safePath(file),'Unsafe source path');if(files.has(file))return;const bytes=readSource(file);requireProof(bytes!=null,'Missing source: '+file);files.add(file);
  for(const specifier of imports(bytes,file)){if(!specifier.startsWith('.')){external.add(specifier);continue;}const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier)),dependency=[relative,relative+'.js',relative+'.mjs',relative+'.css',relative+'/index.js'].find(value=>safePath(value)&&readSource(value)!=null);requireProof(Boolean(dependency),'Unresolved source import: '+file);visit(dependency);}
 }(fixture?['scripts/lib/company-subscription-ui-fixture.mjs']:ui?uiRoots:[pgHarness]).forEach(visit);return {files:[...files].sort(),externalImports:[...external].sort()};
}
function manifest(records,files,readSource,label){
 requireProof(Array.isArray(records)&&records.length===files.length,label+' source count');const map=new Map();
 for(const record of records){requireProof(exact(record,['path','sha256'])&&hash(record.sha256)&&!map.has(record.path),label+' source shape');map.set(record.path,record.sha256);}
 same([...map.keys()].sort(),files,label+' source closure');for(const file of files)requireProof(map.get(file)===sha(readSource(file)),label+' source hash: '+file);
}
function provenance(proof,head,tree,label){
 requireProof(proof?.status==='PASS'&&proof.sourceRevision===head&&proof.sourceTree===tree&&proof.sourceState==='EXACT_CI_SOURCE'&&proof.trackedClean===true,label+' exact CI provenance');
 requireProof(proof.productionDataWritten===false,label+' production boundary');
}
export function validateOrganizationUsageCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}){
 requireProof(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Exact clean expected Git HEAD/tree');requireProof(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources),'Committed source map');
 const readSource=file=>Object.hasOwn(gitSources,file)?gitSources[file]:null;
 for(const file of [pgHarness,uiHarness,cleanupHelper,...dependencies])requireProof(readSource(file)!=null,'Missing producer/helper/package: '+file);
 provenance(postgres,expectedHead,sourceTree,'PostgreSQL');provenance(ui,expectedHead,sourceTree,'UI');
 requireProof(postgres.version===ORGANIZATION_USAGE_PG_VERSION&&postgres.syntheticOnly===true&&postgres.postgresExecuted===true,'Native disposable execution');
 requireProof(ORGANIZATION_USAGE_PG_CHECKS.length===16&&postgres.totalCheckCount===16,'Complete sixteen native groups');same(postgres.checks,[...ORGANIZATION_USAGE_PG_CHECKS],'Exact ordered native group names');
 requireProof(postgres.providerRequests===0&&postgres.syntheticOpenAiRequests===11&&Number.isSafeInteger(postgres.syntheticReplyRequests)&&postgres.syntheticReplyRequests>=1,'Closed provider counters');
 requireProof(postgres.paymentAttempted===false&&postgres.paymentVerified===false&&postgres.capacityContractPending===true&&postgres.cost===null,'No merchant acceptance, approved capacity or invented price');
 requireProof(postgres.poolClosed===true&&postgres.databaseRemoved===true&&postgres.cleanup?.poolClosed===true&&postgres.cleanup.databaseRemoved===true,'Owned PostgreSQL cleanup');
 requireProof(Array.isArray(postgres.nativeLockObservations)&&postgres.nativeLockObservations.length===2,'Two native lock races');
 for(const [index,record] of postgres.nativeLockObservations.entries())requireProof(exact(record,['firstTransport','secondTransport','sameOrganization','differentProjects','waitingCount','waitingBeforeProject','bothCompleted'])&&record.firstTransport===['WEB','WHATSAPP'][index]&&record.secondTransport===['WHATSAPP','WEB'][index]&&record.sameOrganization===true&&record.differentProjects===true&&Number.isSafeInteger(record.waitingCount)&&record.waitingCount>=1&&record.waitingBeforeProject===true&&record.bothCompleted===true,'Native advisory-before-project ordering');
 const native=organizationUsageCiSourceClosure(readSource);requireProof(native.files.length===110,'Complete 110-source native closure with durable civil composition');manifest(postgres.sourceManifest,native.files,readSource,'PostgreSQL');requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'Native producer Git bytes');
 requireProof(['src/lib/participant-civil-store.mjs','src/lib/participant-civil-policy.mjs','src/lib/bindx-civil-data-client.mjs'].every(file=>native.files.includes(file)),'The current native lineage requires every durable civil source');
 requireProof(ui.version===ORGANIZATION_USAGE_UI_VERSION&&ui.environment==='isolated-localhost-next-exact-jsx-synthetic-api','Controlled real JSX fixture');
 for(const key of ['productionLoginVerified','realIdentityDocuments','realPlanDocuments','physicalDeviceAccepted'])requireProof(ui[key]===false,'No real acceptance claim: '+key);
 requireProof(ui.providerRequests===0&&ui.automaticPostCount===0&&ui.explicitSyntheticUploadCount===6,'Only six explicitly requested synthetic uploads');
 for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'Empty browser errors/foreign calls: '+key);
 same(ui.widths,[...ORGANIZATION_USAGE_UI_WIDTHS],'Complete viewport matrix');requireProof(ui.totalCheckCount===14&&Array.isArray(ui.checks)&&ui.checks.length===14,'Complete fourteen DOM groups');same(ui.checks.map(item=>item.check),[...ORGANIZATION_USAGE_UI_CHECKS],'Exact ordered DOM group names');
 for(const [index,record] of ui.checks.entries()){
  if(index<4){requireProof(record.width===ORGANIZATION_USAGE_UI_WIDTHS[index]&&record.documentWidth<=record.width&&Array.isArray(record.targets)&&record.targets.length>3&&record.targets.every(target=>Number.isFinite(target.height)&&target.height>=44&&Number.isFinite(target.width)&&target.width>=44)&&record.targets.filter(target=>target.tag==='LABEL'&&target.label==='radio').length===2&&record.postCount===0,'Responsive real targets and zero automatic upload');same(record.commercial,{prices:['USD 149,00','USD 349,00'],termsPending:true,acceptanceEnabled:false,checkoutPresent:false,receiptPresent:false},'Displayed current references with closed terms and payment');}
  else if(index<8)requireProof(record.postCount===0,'Read cancel/denial/context boundary');
  else requireProof(record.postCount===1&&uuid(record.operationId)&&Array.isArray(record.recoveryOperationIds)&&record.recoveryOperationIds.every(value=>value===record.operationId),'Exact source recovery without repeated POST');
 }
 const operations=new Map(ui.checks.slice(8).map(record=>[record.check,record.operationId]));requireProof(new Set(operations.values()).size===6,'Six distinct explicit source attempts');
 const labels=ui.checks.map((record,index)=>index<4?'viewport-'+record.width:record.check),requestCounts=[3,3,3,3,2,3,3,3,5,10,7,5,6,4],counts=new Map(labels.map(label=>[label,0])),posts=new Map(labels.map(label=>[label,0]));
 requireProof(Array.isArray(ui.apiRequests)&&ui.apiRequests.length===60,'All sixty controlled API calls');let uploads=0;
 for(const record of ui.apiRequests){requireProof(record&&Object.keys(record).every(key=>['label','path','method','scope','operationId'].includes(key))&&counts.has(record.label)&&['/api/identity/company-subscription','/api/identity/company-usage','/api/identity/plan-import'].includes(record.path)&&['GET','POST'].includes(record.method)&&['a'.repeat(64),'b'.repeat(64)].includes(record.scope),'Finite read API scope and metadata');counts.set(record.label,counts.get(record.label)+1);if(Object.hasOwn(record,'operationId'))requireProof(record.path==='/api/identity/plan-import'&&uuid(record.operationId)&&record.operationId===operations.get(record.label),'The HTTP and recovery receipt must identify the same case and attempt');if(record.method==='POST'){uploads++;posts.set(record.label,posts.get(record.label)+1);requireProof(record.path==='/api/identity/plan-import'&&uuid(record.operationId)&&record.operationId===operations.get(record.label),'Only the explicit synthetic source attempt for this case');}}
 requireProof(uploads===6,'Exact observed synthetic upload count');
 for(const [index,label] of labels.entries())requireProof(counts.get(label)===requestCounts[index]&&posts.get(label)===(index>=8?1:0),'Complete bounded request observations for '+label);
 const browser=organizationUsageCiSourceClosure(readSource,{ui:true});requireProof(browser.files.length===25,'Complete 25-source UI graph');manifest(ui.sourceManifest,browser.files,readSource,'UI');manifest(ui.dependencyManifest,dependencies,readSource,'UI dependencies');same(ui.externalImports,browser.externalImports,'Browser packages match actual JSX');
 const fixture=organizationUsageCiSourceClosure(readSource,{fixture:true});same(fixture.files,['scripts/lib/company-subscription-ui-fixture.mjs','src/lib/company-subscription-catalog.mjs','src/lib/workspace-policy.mjs'],'Complete current three-source Node fixture graph');manifest(ui.fixtureSourceManifest,fixture.files,readSource,'UI fixture');
 requireProof(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI and cleanup producer Git bytes');
 const cleanup=ui.cleanup;requireProof(cleanup?.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true&&cleanup.fixtureCleanupProof.postcondition?.absent===true,'Owned browser/server/fixture cleanup');
 return {version:ORGANIZATION_USAGE_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,postgres:{totalCheckCount:16,sourceCount:110,syntheticOpenAiRequests:11,nativeLockRaceCount:2,harnessSha256:postgres.harnessSha256},ui:{totalCheckCount:14,sourceCount:25,fixtureSourceCount:fixture.files.length,dependencyCount:2,widths:[...ORGANIZATION_USAGE_UI_WIDTHS],explicitSyntheticUploadCount:6,harnessSha256:ui.harnessSha256},providerRequests:0,productionDataWritten:false,paymentVerified:false,capacityContractPending:true,cost:null,productionLoginVerified:false,physicalDeviceAccepted:false};
}
function main(){
 const args=process.argv.slice(2);requireProof(args.length===2&&args[0]==='--expected-head'&&revision(args[1]),'Usage --expected-head <full SHA>');const expectedHead=args[1],root=process.cwd(),git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8'}).trim();
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';requireProof(head===expectedHead&&trackedClean,'Exact clean source');
 const gitSources=Object.create(null),readSource=file=>{if(!Object.hasOwn(gitSources,file)){try{gitSources[file]=execFileSync('git',['show',head+':'+file],{cwd:root,stdio:['ignore','pipe','ignore'],maxBuffer:4*1024*1024});}catch{return null;}}return gitSources[file];};
 organizationUsageCiSourceClosure(readSource);organizationUsageCiSourceClosure(readSource,{ui:true});organizationUsageCiSourceClosure(readSource,{fixture:true});[uiHarness,cleanupHelper,...dependencies].forEach(readSource);
 const postgres=JSON.parse(readFileSync(path.join(root,'.vercel/private/organization-usage-postgres.json'),'utf8')),ui=JSON.parse(readFileSync(path.join(root,'.vercel/private/organization-usage-evidence/browser.json'),'utf8'));
 const result=validateOrganizationUsageCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}),output=path.join(root,'.vercel/private/organization-usage-ci.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,nativeGroups:16,uiGroups:14,providerRequests:0}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
