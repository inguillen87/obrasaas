import {WORKSITE_LIVE_HOURS_CURRENT_SECTION,verifyWorksiteLiveHoursCurrentSources as worksiteSourceCheck0,verifyWorksiteLiveHoursActualClosure as worksiteSourceCheck1} from './lib/worksite-live-hours-current-ci-lineage.mjs';
function checkWorksiteSource(action){try{return action();}catch(error){if(error.code==='WORKSITE_LIVE_HOURS_CURRENT_CI_LINEAGE_REJECTED')requireProof(false,error.message);throw error;}}
const verifyWorksiteLiveHoursCurrentSources=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck0(...args));
const verifyWorksiteLiveHoursActualClosure=(...args)=>checkWorksiteSource(()=>worksiteSourceCheck1(...args));
import {createHash} from 'node:crypto';
import {types as earlyDtoTypes} from 'node:util';
import {restoreWeeklyCypConsumerSourceSet} from './lib/home-decisions-current-ci-lineage.mjs';
import {participantPreanalysisConsumerSourceFiles,preloadParticipantPreanalysisConsumerSources} from './lib/participant-preanalysis-current-ci-lineage.mjs';
import {restoreWhatsappFieldContinuitySourceSet,verifyWhatsappFieldContinuityCurrentSources} from './lib/whatsapp-field-continuity-current-ci-lineage.mjs';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import {PLAN_MEASUREMENT_CONSUMER_CI_HELPER,validatePlanMeasurementConsumerSourceLineage} from './lib/plan-measurement-consumer-ci-lineage.mjs';
import {MATERIAL_CONSUMPTION_FEEDBACK_CHECKS,MATERIAL_CONSUMPTION_FEEDBACK_PROOF_VERSION} from './verify-material-consumption-feedback-postgres.mjs';

export const CONSUMPTION_FEEDBACK_CI_VERSION='material-consumption-feedback-ci-v1';
export const CONSUMPTION_FEEDBACK_UI_WIDTHS=Object.freeze([320,390,768,1280]);
export const CONSUMPTION_FEEDBACK_UI_CASES=Object.freeze([
 'legacy-missing-date-name-receipt-never-fabricated',
 'original-proposal-receipt-separated-from-current-approved-stock',
 'reload-same-receipt-no-repeat-post',
 'unknown-read-and-token-failure-keep-exact-original-attempt',
 'denied-private-state-clears-but-unknown-reference-survives',
 'loaded-four-card-history-cleared-on-refresh-denial',
 'loaded-history-and-private-draft-cleared-on-refresh-denial',
 'late-foreign-company-consumption-response-never-renders',
]);
const pgHarness='scripts/verify-material-consumption-feedback-postgres.mjs';
const uiHarness='scripts/verify-consumption-feedback-ui.mjs';
const cleanupHelper='scripts/lib/owned-fixture-cleanup.mjs';
const uiEntries=['src/app/(identity)/cuenta/material-inventory-panel.js','src/app/(identity)/cuenta/workspace-recovery-panel.js'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const own=(value,key)=>Object.hasOwn(value,key);
function requireProof(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'CONSUMPTION_FEEDBACK_CI_REJECTED'});}
function same(actual,expected,message){requireProof(JSON.stringify(actual)===JSON.stringify(expected),message);}
function sourcePath(value){return typeof value==='string'&&!value.includes('\\')&&!value.includes('\0')&&!path.posix.isAbsolute(value)&&path.posix.normalize(value)===value&&!value.startsWith('../')&&/^(?:src|scripts)\//.test(value);}
function importPaths(bytes,filename){
 if(filename.endsWith('.css')){requireProof(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'External stylesheet dependency: '+filename);return [];}
 const ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx']}),imports=[];
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);
  if(node.type==='ImportExpression'){requireProof(node.source.type==='StringLiteral','Nonliteral import: '+filename);imports.push(node.source.value);}
  if(node.type==='CallExpression'&&node.callee?.type==='Import'){requireProof(node.arguments[0]?.type==='StringLiteral','Nonliteral import: '+filename);imports.push(node.arguments[0].value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(ast.program);return imports;
}

// The reader supplies committed Git blob bytes in the CLI, or isolated bytes in
// unit tests. No producer executes and no database/browser/provider is created.
export function consumptionFeedbackSourceClosure(readSource,{ui=false}={}){
 const files=new Set(ui?[]:['package.json','package-lock.json']),external=new Set();
 for(const file of files)requireProof(readSource(file)!==null,'Missing committed dependency: '+file);
 function visit(file){
  requireProof(sourcePath(file),'Unsafe relative source dependency: '+file);if(files.has(file))return;
  const bytes=readSource(file);requireProof(bytes!==null,'Missing committed dependency: '+file);files.add(file);
  for(const specifier of importPaths(bytes,file)){
   if(!specifier.startsWith('.')){external.add(specifier);continue;}
   const absolute=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));
   const dependency=[absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.posix.join(absolute,'index.js')].find(candidate=>sourcePath(candidate)&&readSource(candidate)!==null);
   requireProof(Boolean(dependency),'Missing relative dependency '+specifier+' from '+file);visit(dependency);
  }
 }
 for(const entry of ui?uiEntries:[pgHarness])visit(entry);
 return {files:[...files].sort(),externalImports:[...external].sort()};
}
function manifest(proof,files,readSource,label){
 requireProof(Array.isArray(proof.sourceManifest)&&proof.sourceManifest.length===files.length,label+' source manifest is incomplete');
 const found=new Map();
 for(const record of proof.sourceManifest){
  requireProof(record&&typeof record==='object'&&typeof record.path==='string'&&hash(record.sha256)&&!found.has(record.path),label+' duplicate or malformed source record');
  found.set(record.path,record.sha256);
 }
 same([...found.keys()].sort(),files,label+' manifest must equal the full recursive committed dependency closure');
 for(const file of files)requireProof(found.get(file)===sha(readSource(file)),label+' stale committed source hash: '+file);
}
function provenance(proof,{expectedHead,sourceTree},sourceState,label){
 requireProof(proof&&proof.status==='PASS'&&proof.sourceRevision===expectedHead&&proof.sourceTree===sourceTree&&proof.trackedClean===true&&proof.sourceState===sourceState,label+' requires exact clean CI commit/tree provenance');
 requireProof(proof.productionDataWritten===false,label+' cannot certify production data');
}
function uiChecks(proof){
 same(proof.widths,CONSUMPTION_FEEDBACK_UI_WIDTHS,'UI viewport matrix must be complete');
 requireProof(Array.isArray(proof.checks)&&proof.checks.length===12,'UI needs all 12 checks');
 const identities=proof.checks.map(check=>check?.check==='true-consumption-history-progressive-references-long-content'?check.check+':'+check.width:check?.check);
 const expected=[...CONSUMPTION_FEEDBACK_UI_WIDTHS.map(width=>'true-consumption-history-progressive-references-long-content:'+width),...CONSUMPTION_FEEDBACK_UI_CASES];
 same(identities,expected,'UI checks must match all named scenarios once in the complete viewport matrix');
 for(const check of proof.checks.slice(0,4)){
  requireProof(Number.isSafeInteger(check.documentWidth)&&check.documentWidth>0&&check.documentWidth<=check.width,'UI viewport must not overflow');
  requireProof(Array.isArray(check.targets)&&check.targets.length>0&&check.targets.every(target=>Number.isFinite(target?.height)&&target.height>=44&&Number.isFinite(target.width)&&target.width>=44),'UI requires measured accessible touch targets');
  requireProof(Array.isArray(check.cards)&&check.cards.length===4,'UI must start with four real rendered fixture states');
  same(check.cards[3].dates,['2026-10-12T13:00:00.000Z','2026-10-12T16:00:00.000Z'],'UI must preserve separate decision/reversal timestamps');
 }
 const operations=proof.checks.slice(5,9).map(check=>check.operationId);
 requireProof(operations.every(uuid)&&new Set(operations).size===operations.length,'UI recovery scenarios need independent exact original UUIDs');
 for(const check of proof.checks.slice(9,11))requireProof(check.beforeCards===4&&check.afterCards===0&&check.afterReceipts===0&&check.afterForms===0&&check.postCount===0,'UI loaded-denial scenarios must clear private state without POST');
}

// Denial-only checks apply to inert JSON data. Accessors, proxies, custom
// prototypes, cycles and non-JSON values retain the original source-first order.
function ordinaryJsonDto(value,ancestors=new Set()){
 if(value===null||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value==='number')return Number.isFinite(value);
 if(typeof value!=='object'||earlyDtoTypes.isProxy(value)||ancestors.has(value))return false;
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);if(keys.some(key=>typeof key!=='string'))return false;
 if(array&&(!Object.hasOwn(descriptors,'length')||!Number.isSafeInteger(descriptors.length.value)||descriptors.length.value<0||keys.length!==descriptors.length.value+1))return false;
 ancestors.add(value);try{for(const key of keys){if(array&&key==='length')continue;const row=descriptors[key];if(!Object.hasOwn(row,'value')||row.enumerable!==true||array&&!/^(?:0|[1-9][0-9]*)$/.test(key)||!ordinaryJsonDto(row.value,ancestors))return false;}return true;}finally{ancestors.delete(value);}
}

// Denial only: LF pins establish eligibility; RAW copies never become authority.
// An exotic source map keeps every existing caller read and late check in order.
function earlySourceDescriptors(gitSources){
 if(earlyDtoTypes.isProxy(gitSources))return null;
 const prototype=Object.getPrototypeOf(gitSources);if(prototype!==Object.prototype&&prototype!==null)return null;
 const descriptors=Object.getOwnPropertyDescriptors(gitSources),keys=Reflect.ownKeys(descriptors),bufferReadKeys=['toString','valueOf','length','byteLength','byteOffset','buffer','parent','offset','constructor','toJSON','slice','subarray','copy','equals',Symbol.toPrimitive,Symbol.iterator];
 for(const key of keys){if(typeof key!=='string')return null;const row=descriptors[key];if(!Object.hasOwn(row,'value')||row.enumerable!==true||row.configurable!==true||row.writable!==true||earlyDtoTypes.isProxy(row.value)||!Buffer.isBuffer(row.value)||Object.getPrototypeOf(row.value)!==Buffer.prototype||bufferReadKeys.some(name=>Object.hasOwn(row.value,name)))return null;}
 return descriptors;
}
function earlySourceCopy(buffer){
 const length=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'length').get.call(buffer),copy=Buffer.alloc(length);
 Uint8Array.prototype.set.call(copy,buffer);return copy;
}
function earlySourceText(copy){const text=copy.toString('utf8');return Buffer.from(text).equals(copy)?text:null;}
function earlyCurrentFamily(contract,family){
 const section=contract?.planBudgetCurrentRevision;if(!section?.captureQualityRuntime||!Array.isArray(section.sourceFamilies))return null;
 const matches=section.sourceFamilies.filter(row=>row?.family===family);if(matches.length!==1)return null;
 const {currentFiles:files,currentManifest:pins}=matches[0];if(!Array.isArray(files)||files.length===0||!Array.isArray(pins)||pins.length!==files.length)return null;
 for(let index=0;index<files.length;index++){const file=files[index],pin=pins[index];if(typeof file!=='string'||!(['package.json','package-lock.json'].includes(file)||sourcePath(file))||index>0&&files[index-1]>=file||!pin||Object.keys(pin).sort().join('|')!=='path|sha256'||pin.path!==file||!hash(pin.sha256))return null;}
 return {files,pins};
}
function earlyFamilyCopies(descriptors,families){
 const pins=new Map();for(const family of families)for(const pin of family.pins){if(pins.has(pin.path)&&pins.get(pin.path)!==pin.sha256)return null;pins.set(pin.path,pin.sha256);}
 const copies=new Map();try{for(const [file,pin]of pins){if(!Object.hasOwn(descriptors,file))return null;const copy=earlySourceCopy(descriptors[file].value),text=earlySourceText(copy);if(text===null||sha(Buffer.from(text.replaceAll('\r\n','\n')))!==pin)return null;copies.set(file,copy);}}catch{return null;}
 return copies;
}
function preflightConsumptionUiDto(ui){
 requireProof(ui.environment==='isolated-localhost-next-exact-jsx-synthetic-api'&&ui.productionLoginVerified===false&&ui.physicalDeviceAccepted===false&&ui.providerRequests===0,'UI requires intercepted synthetic API/authentication only');
 for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'UI '+key+' must be empty');
 const cleanup=ui.cleanup;
 requireProof(cleanup&&cleanup.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.postcondition?.absent===true,'UI browser/server/owned fixture cleanup must be confirmed');
 uiChecks(ui);
}
function preflightConsumptionFeedbackDenials(gitSources,postgres,ui){
 if(!ordinaryJsonDto(postgres)||!ordinaryJsonDto(ui))return;
 const descriptors=earlySourceDescriptors(gitSources),contractPath='.github/workspace-acceptance-contract.json';if(!descriptors||!Object.hasOwn(descriptors,contractPath))return;
 let contract;try{const text=earlySourceText(earlySourceCopy(descriptors[contractPath].value));if(text===null)return;contract=JSON.parse(text);}catch{return;}
 const native=earlyCurrentFamily(contract,'CONSUMPTION_FEEDBACK'),browser=earlyCurrentFamily(contract,'CONSUMPTION_FEEDBACK_UI');if(!native||!browser)return;
 const copies=earlyFamilyCopies(descriptors,[native,browser]);if(!copies||!copies.has(pgHarness))return;
 const privateRead=file=>copies.get(file);
 manifest(postgres,native.files,privateRead,'PostgreSQL');
 requireProof(postgres.harnessSha256===sha(privateRead(pgHarness)),'PostgreSQL producer hash must match committed Git bytes');
 preflightConsumptionUiDto(ui);manifest(ui,browser.files,privateRead,'UI');
 same(ui.externalImports,['react'],'UI fixture package dependency boundary changed');
}

export function validateConsumptionFeedbackCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres,ui}){
 requireProof(revision(expectedHead)&&head===expectedHead&&revision(sourceTree)&&trackedClean===true,'Expected Git HEAD/tree must be exact and tracked source clean');
 requireProof(gitSources&&typeof gitSources==='object'&&!Array.isArray(gitSources),'Committed Git blob map required');
 const readSource=file=>own(gitSources,file)?gitSources[file]:null;
 for(const file of [pgHarness,uiHarness,cleanupHelper])requireProof(readSource(file)!==null,'Missing committed producer: '+file);
 provenance(postgres,{expectedHead,sourceTree},'EXACT_CI_SOURCE','PostgreSQL');provenance(ui,{expectedHead,sourceTree},'clean','UI');
 requireProof(postgres.version===MATERIAL_CONSUMPTION_FEEDBACK_PROOF_VERSION&&postgres.environment==='local-disposable-postgresql'&&postgres.postgresExecuted===true,'PostgreSQL proof must use the native disposable producer');
 requireProof(postgres.realIdentityDocuments===false&&postgres.providerCalls===0&&postgres.poolClosed===true&&postgres.databaseRemoved===true,'PostgreSQL provider/identity/cleanup boundary must be closed');
 requireProof(postgres.totalCheckCount===23&&Array.isArray(postgres.checks),'PostgreSQL requires all 23 native checks');
 same(postgres.checks,MATERIAL_CONSUMPTION_FEEDBACK_CHECKS,'PostgreSQL checks must equal the exported native contract');
 preflightConsumptionFeedbackDenials(gitSources,postgres,ui);
 const currentSourceContract=JSON.parse(readSource('.github/workspace-acceptance-contract.json'));if(currentSourceContract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])verifyWorksiteLiveHoursCurrentSources(currentSourceContract,readSource);
 const pgClosure=consumptionFeedbackSourceClosure(readSource);if(currentSourceContract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])verifyWorksiteLiveHoursActualClosure(currentSourceContract,'CONSUMPTION_FEEDBACK',pgClosure,readSource);let historicalNativeFiles,sourceLineage;try{historicalNativeFiles=participantPreanalysisConsumerSourceFiles('CONSUMPTION_FEEDBACK',pgClosure.files,readSource);sourceLineage=validatePlanMeasurementConsumerSourceLineage({family:'CONSUMPTION_FEEDBACK',files:pgClosure.files,readSource});}catch(error){requireProof(false,error.message);}requireProof(historicalNativeFiles.length===110,'PostgreSQL committed closure must contain the previous 108 sources and exactly two source import dependencies');manifest(postgres,pgClosure.files,readSource,'PostgreSQL');
 requireProof(['src/lib/plan-baseline-policy.mjs','src/lib/plan-import-document-curve.mjs'].every(file=>pgClosure.files.includes(file)),'Current native document curve dependency lineage');
 requireProof(['src/lib/participant-civil-store.mjs','src/lib/participant-civil-policy.mjs','src/lib/bindx-civil-data-client.mjs'].every(file=>pgClosure.files.includes(file)),'The current native lineage requires every durable civil source');
 requireProof(postgres.harnessSha256===sha(readSource(pgHarness)),'PostgreSQL producer hash must match committed Git bytes');
 requireProof(ui.environment==='isolated-localhost-next-exact-jsx-synthetic-api'&&ui.productionLoginVerified===false&&ui.physicalDeviceAccepted===false&&ui.providerRequests===0,'UI requires intercepted synthetic API/authentication only');
 for(const key of ['pageErrors','interceptErrors','externalRequests'])requireProof(Array.isArray(ui[key])&&ui[key].length===0,'UI '+key+' must be empty');
 const cleanup=ui.cleanup;
 requireProof(cleanup&&cleanup.browserClosed===true&&cleanup.serverClosed===true&&cleanup.gracefulCloseAcknowledged===true&&cleanup.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.fixtureRemoved===true&&cleanup.fixtureCleanupProof?.postcondition?.absent===true,'UI browser/server/owned fixture cleanup must be confirmed');
 uiChecks(ui);
 const uiClosure=consumptionFeedbackSourceClosure(readSource,{ui:true}),contract=currentSourceContract;if(contract[WORKSITE_LIVE_HOURS_CURRENT_SECTION])verifyWorksiteLiveHoursActualClosure(contract,'CONSUMPTION_FEEDBACK_UI',uiClosure,readSource);let publishedUiFiles;
 try{publishedUiFiles=restoreWeeklyCypConsumerSourceSet('CONSUMPTION_FEEDBACK_UI',uiClosure.files,contract);}catch(error){requireProof(false,error.message);}
 if(contract.whatsappFieldContinuityCurrentRevision){const delta=contract.whatsappFieldContinuityCurrentRevision.sourceSetDeltas.find(row=>row.family==='CONSUMPTION_FEEDBACK_UI');requireProof(delta?.previousCount===20&&delta.currentCount===22,'The exact current consumption UI source revision is required');same(delta.additions,['src/app/(identity)/cuenta/worksite-task-selector.js','src/app/(identity)/cuenta/worksite-task-selector.module.css'],'Only the two reviewed task selector UI dependencies may be added');let previous;try{verifyWhatsappFieldContinuityCurrentSources(contract,readSource);previous=restoreWhatsappFieldContinuitySourceSet('CONSUMPTION_FEEDBACK_UI',publishedUiFiles,contract);}catch(error){requireProof(false,error.message);}requireProof(previous.length===20&&sha(JSON.stringify(previous))===delta.previousPathsSha256&&publishedUiFiles.length===22&&sha(JSON.stringify(publishedUiFiles))===delta.currentPathsSha256,'Published UI22 must restore exact historical UI20 without changing observed bytes');}else requireProof(publishedUiFiles.length===20,'Historical UI committed closure must contain all 20 sources');
 manifest(ui,uiClosure.files,readSource,'UI');
 same(ui.externalImports,uiClosure.externalImports,'UI package imports must match committed JSX graph');same(ui.externalImports,['react'],'UI fixture package dependency boundary changed');
 requireProof(ui.harnessSha256===sha(readSource(uiHarness))&&ui.cleanupHelperSha256===sha(readSource(cleanupHelper)),'UI producer and owned cleanup hashes must match committed Git bytes');
 return {version:CONSUMPTION_FEEDBACK_CI_VERSION,status:'PASS',sourceRevision:expectedHead,sourceTree,sourceState:'EXACT_CI_SOURCE',trackedClean:true,postgres:{version:postgres.version,totalCheckCount:23,sourceCount:pgClosure.files.length,harnessSha256:postgres.harnessSha256,sourceLineage},ui:{totalCheckCount:12,sourceCount:uiClosure.files.length,widths:[...CONSUMPTION_FEEDBACK_UI_WIDTHS],harnessSha256:ui.harnessSha256,cleanupHelperSha256:ui.cleanupHelperSha256},providerCalls:0,productionDataWritten:false,productionLoginVerified:false,physicalDeviceAccepted:false};
}

function main(){
 const args=process.argv.slice(2);requireProof(args.length===2&&args[0]==='--expected-head'&&revision(args[1]),'Usage: --expected-head <full Git SHA>');
 const root=process.cwd(),expectedHead=args[1],git=(...values)=>execFileSync('git',values,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).trim();
 const head=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';
 requireProof(head===expectedHead&&trackedClean,'CLI requires the exact clean expected checkout');
 const committed=new Set(git('ls-tree','-r','--name-only',expectedHead).split('\n')),gitSources=Object.create(null);
 const readSource=file=>{if(!committed.has(file))return null;if(!own(gitSources,file))gitSources[file]=execFileSync('git',['show',expectedHead+':'+file],{cwd:root,maxBuffer:16*1024*1024,windowsHide:true});return gitSources[file];};
 const validatorPath='scripts/verify-consumption-feedback-ci.mjs',validatorBytes=readFileSync(fileURLToPath(import.meta.url));
 requireProof(readSource(validatorPath)!==null&&sha(validatorBytes)===sha(readSource(validatorPath)),'CI validator itself must match the committed expected source');
 consumptionFeedbackSourceClosure(readSource);consumptionFeedbackSourceClosure(readSource,{ui:true});for(const file of [uiHarness,cleanupHelper,PLAN_MEASUREMENT_CONSUMER_CI_HELPER])requireProof(readSource(file)!==null,'Missing committed producer: '+file);
 requireProof(sha(readFileSync(path.join(root,PLAN_MEASUREMENT_CONSUMER_CI_HELPER)))===sha(readSource(PLAN_MEASUREMENT_CONSUMER_CI_HELPER)),'Consumer lineage helper must equal committed Git bytes');
 const pgBytes=readFileSync(path.join(root,'.vercel/private/material-consumption-feedback-postgres.json')),uiBytes=readFileSync(path.join(root,'.vercel/private/consumption-feedback-evidence/browser.json'));
 preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});
 const result=validateConsumptionFeedbackCi({expectedHead,head,sourceTree,trackedClean,gitSources,postgres:JSON.parse(pgBytes),ui:JSON.parse(uiBytes)});
 preloadParticipantPreanalysisConsumerSources({readSource,readCheckout:file=>readFileSync(path.join(root,file))});requireProof(git('rev-parse','HEAD')===head&&git('rev-parse','HEAD^{tree}')===sourceTree&&git('status','--porcelain','--untracked-files=no')==='','Source changed during CI proof validation');requireProof(sha(readFileSync(path.join(root,PLAN_MEASUREMENT_CONSUMER_CI_HELPER)))===sha(readSource(PLAN_MEASUREMENT_CONSUMER_CI_HELPER)),'Consumer lineage helper changed during validation');
 const output=path.join(root,'.vercel/private/consumption-feedback-ci.json');mkdirSync(path.dirname(output),{recursive:true});
 const proof={...result,checkedAt:new Date().toISOString(),validatorSha256:sha(validatorBytes),inputProofs:[{path:'.vercel/private/material-consumption-feedback-postgres.json',sha256:sha(pgBytes)},{path:'.vercel/private/consumption-feedback-evidence/browser.json',sha256:sha(uiBytes)}]};
 writeFileSync(output,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,sourceRevision:head,output:path.relative(root,output).split(path.sep).join('/'),nativeChecks:23,uiChecks:12}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(error){console.error(JSON.stringify({status:'FAIL',code:error.code==='CONSUMPTION_FEEDBACK_CI_REJECTED'?error.code:'CONSUMPTION_FEEDBACK_CI_UNCONFIRMED',reason:error.message}));process.exitCode=1;}}
