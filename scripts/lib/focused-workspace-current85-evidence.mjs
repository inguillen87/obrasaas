import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {parse as parseJavaScript} from '@babel/parser';
import {CURRENT85_SPEC} from './focused-workspace-current85-spec.mjs';
import {focusedWorkspaceUiSourceFiles,focusedWorkspaceUiSourceClosure,focusedCompanyBootstrapUiSourceClosure,focusedWorkspaceTaskPagingCopy,FOCUSED_WORKSPACE_WIDTHS} from '../verify-focused-workspace-ui.mjs';
const producer='scripts/verify-focused-workspace-ui.mjs';
const specPath='scripts/lib/focused-workspace-current85-spec.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const loadedProducer=readFileSync(new URL('../verify-focused-workspace-ui.mjs',import.meta.url));
const loadedSpec=readFileSync(new URL('./focused-workspace-current85-spec.mjs',import.meta.url));
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex=(value,size)=>typeof value==='string'&&new RegExp('^[a-f0-9]{'+size+'}$').test(value);
const fail=(condition,reason)=>{if(!condition)throw Object.assign(new Error(reason),{code:'CURRENT85_EVIDENCE_REJECTED',reason});};
const keys=(v,names,label)=>fail(plain(v)&&equal(Object.keys(v).sort(),names.slice().sort()),'SHAPE_'+label);
const safe=p=>typeof p==='string'&&p.length>0&&p.length<=500&&!p.includes('\\')&&!p.includes('\0')&&!p.includes(':')&&!p.startsWith('/')&&path.posix.normalize(p)===p&&!p.split('/').includes('..');
const bytes=(reader,file,label)=>{fail(typeof reader==='function'&&safe(file),'READER_'+label);const b=reader(file);fail(Buffer.isBuffer(b)&&b.length>0&&b.length<=16*1024*1024,'BYTES_'+label);return b;};
const parse=(b,label)=>{try{return JSON.parse(b.toString('utf8'));}catch{fail(false,'JSON_'+label);}};
const reference=(row,label)=>{keys(row,['path','bytes','sha256'],label);fail(safe(row.path)&&Number.isSafeInteger(row.bytes)&&row.bytes>0&&hex(row.sha256,64),'REFERENCE_'+label);};
const rawKeys=['version','status','sourceState','sourceRevision','sourceTree','trackedClean','checkedAt','widths','continuityWidths','historicalCheckCount','continuityCheckLedger','previousTotalCheckCount','taskPagingWidths','taskPagingCheckLedger','taskPagingFixture','homeDecisionsWidths','homeDecisionsCheckLedger','expectedTotalCheckCount','bootstrapSourceManifest','bootstrapExternalImports','checks','totalCheckCount','sourceManifest','sourceBytesUnchanged','externalImports','requests','errors','screenshots','providerCalls','businessPosts','navigationPosts','productionDataTouched','actualAccountWorkspaceMounted','actualClerkOrSSRVerified','syntheticPixelsOnly','transport','cleanup'];

function validateCleanup(value){
 keys(value,['browserClosed','serverClosed','gracefulCloseAcknowledged','fixtureRemoved','fixtureCleanupProof'],'CLEANUP');
 fail(value.browserClosed===true&&value.serverClosed===true&&value.gracefulCloseAcknowledged===true&&value.fixtureRemoved===true,'POSITIVE_CLEANUP');
 const p=value.fixtureCleanupProof;keys(p,['fixtureRemoved','attempts','postcondition'],'CLEANUP_PROOF');keys(p.postcondition,['absent'],'CLEANUP_POSTCONDITION');
 fail(p.fixtureRemoved===true&&p.postcondition.absent===true&&Array.isArray(p.attempts)&&p.attempts.length>=1&&p.attempts.length<=3,'BOUNDED_CLEANUP');
 p.attempts.forEach((r,i)=>{keys(r,['attempt','phase','postcondition','removalAttempted','retryScheduled','rmCompleted'],'CLEANUP_ATTEMPT');fail(r.attempt===i+1&&typeof r.removalAttempted==='boolean'&&typeof r.rmCompleted==='boolean'&&typeof r.retryScheduled==='boolean','CLEANUP_SEQUENCE');if(i===p.attempts.length-1)fail(r.postcondition==='ABSENT'&&r.retryScheduled===false&&(r.phase==='POSTCONDITION'&&r.removalAttempted&&r.rmCompleted||r.phase==='GUARD'&&!r.removalAttempted&&!r.rmCompleted),'CLEANUP_FINAL');else fail(r.phase==='DELAY'&&r.postcondition==='PRESENT'&&r.removalAttempted&&r.rmCompleted&&r.retryScheduled,'CLEANUP_RETRY');});
}

function validateChecks(raw,spec){
 fail(raw.totalCheckCount===85&&raw.expectedTotalCheckCount===85&&Array.isArray(raw.checks)&&raw.checks.length===85&&new Set(raw.checks).size===85,'COMPLETE_85');
 fail(spec.currentCaseCount===85&&equal(spec.partitions,[20,25,14,20,6]),'SPEC_PARTITIONS');
 spec.checks.forEach((row,i)=>{const actual=raw.checks[i];if(row.rawNameRule==='exact name')fail(actual===row.name,'CHECK_ORDER_'+i);else{fail(row.rawNameRule==='name + colon + positive safe integer at least5'&&typeof actual==='string'&&actual.startsWith(row.name+':'),'CHECK_MEASUREMENT_'+i);const n=actual.slice(row.name.length+1);fail(/^[1-9][0-9]*$/.test(n)&&Number.isSafeInteger(Number(n))&&Number(n)>=5,'CHECK_MEASUREMENT_VALUE_'+i);}});
 fail(raw.historicalCheckCount===20&&raw.previousTotalCheckCount===45,'HISTORICAL_COUNTS');
 fail(equal(raw.widths,[390,1440])&&equal(raw.continuityWidths,[320,390,1440])&&equal(raw.taskPagingWidths,[320,390,1440])&&equal(raw.homeDecisionsWidths,[320,390,768,1440]),'WIDTHS');
 for(const [key,start,end]of [['continuityCheckLedger',20,45],['taskPagingCheckLedger',45,59],['homeDecisionsCheckLedger',59,79]])fail(equal(raw[key],spec.checks.slice(start,end).map(r=>r.name)),'LEDGER_'+key);
}

function validateRequests(raw,spec,source){
 fail(Array.isArray(raw.requests)&&raw.requests.length>0,'REQUESTS_REQUIRED');
 const legacy=spec.frozenHistory.legacy59Requests,allowedCases=new Set([...legacy,...spec.homeCases,...spec.identityCases].map(r=>[r.width,r.role,r.mode].join('|'))),allowedPaths=new Set([...legacy.map(r=>r.path),'/api/identity/operations-status']);
 const general=spec.requestFactShapes.general.slice().sort(),post=general.concat(spec.requestFactShapes.wizardAdded).sort();
 const forms=[general,post,spec.requestFactShapes.continuity.slice().sort(),spec.requestFactShapes.taskPaging.slice().sort()];
 fail(source.homeQueueReadEndpoint==='/api/identity/field-operations','SOURCE_HOME_QUEUE_ENDPOINT');
 for(const r of raw.requests){const ownHomeQueue=plain(r)&&r.mode==='home-normal'&&r.role==='ADMIN'&&r.method==='GET'&&r.projectId==='project-a'&&r.path===source.homeQueueReadEndpoint;fail(plain(r)&&allowedCases.has([r.width,r.role,r.mode].join('|'))&&(allowedPaths.has(r.path)||ownHomeQueue),'REQUEST_CASE_OR_ROUTE');fail(forms.some(k=>equal(Object.keys(r).sort(),k)),'REQUEST_FACT_SHAPE');fail(r.method==='GET'||r.mode==='wizard'&&r.method==='POST','REQUEST_METHOD');if(r.mode.startsWith('home-')||r.mode.startsWith('identity-'))fail(equal(Object.keys(r).sort(),general),'GENERAL_FACTS_CANNOT_INVENT_STATUS_QUERY_OR_TIMING');}
 const posts=raw.requests.filter(r=>r.method==='POST');fail(posts.length===2&&equal(posts.map(r=>r.width),[390,1440]),'TWO_WIZARD_POSTS');
 for(const r of posts)fail(equal(Object.keys(r).sort(),post)&&r.path==='/api/identity/participants'&&r.role==='ADMIN'&&r.projectId==='project-a'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(r.operationId)&&r.explicitFinalStep===true&&r.actualRecoveryJournalReferencePreserved===true&&hex(r.recoveryReferenceSha256,64)&&Array.isArray(r.syntheticImageSha256)&&r.syntheticImageSha256.length===3&&new Set(r.syntheticImageSha256).size===3&&r.syntheticImageSha256.every(x=>hex(x,64)),'EXPLICIT_SYNTHETIC_WIZARD');
 fail(new Set(posts.map(r=>r.operationId)).size===2&&new Set(posts.map(r=>r.recoveryReferenceSha256)).size===2,'SEPARATE_WIZARD_REFERENCES');
 const same=(r,c)=>r.width===c.width&&r.role===c.role&&r.mode===c.mode;let homeReads=0;
 for(const c of spec.homeCases){const rows=raw.requests.filter(r=>same(r,c)),ops=rows.filter(r=>r.path==='/api/identity/operations-status');fail(ops.length===c.operationsStatusRequestsAsserted&&rows.every(r=>r.method==='GET')&&ops.every(r=>r.projectId===c.projectId),'HOME_SOURCE_ASSERTED_READS_'+c.name);homeReads+=ops.length;}
 fail(spec.homeCases.length===20&&spec.identityCases.length===6&&spec.sourceDerivedHomeOperationsRequestTotal===32&&homeReads===32,'20_HOME_6_IDENTITY_32_READS');
 for(const c of spec.identityCases){const rows=raw.requests.filter(r=>same(r,c));fail(rows.length>0&&rows.every(r=>r.method==='GET'&&r.projectId!=='foreign-project'),'IDENTITY_GET_AND_NO_FOREIGN');if(c.afterExplicitChoice)fail(rows.some(r=>r.path==='/api/identity/workspace'&&r.projectId===c.afterExplicitChoice.requiredWorkspaceProject)&&rows.every(r=>r.projectId===null||r.projectId===c.afterExplicitChoice.requiredWorkspaceProject),'IDENTITY_SELECTED_CANONICAL_PROJECT');else fail(rows.every(r=>r.projectId===null),'IDENTITY_NO_IMPLICIT_PROJECT');}
 return {observedRequestCount:raw.requests.length,homeOperationsStatusReads:homeReads};
}

function validateHistorical59Projection(raw,spec,source){
 // These selectors describe source families, never observed array indices or a fitted597 digest.
 fail(equal(source.navigationInitialHomeWidths,[390,1440])&&source.navigationInitialHomeContextsPerWidth===2,'SOURCE_INITIAL_HOME_CONTEXTS');
 const omitted=new Set(spec.frozenHistory.legacy59RequestFieldsOmitted),selected=[],selectedIndices=[],navigationHome=[];
 raw.requests.forEach((row,index)=>{
  if(row.mode.startsWith('home-')||row.mode.startsWith('identity-'))return;
  if(row.mode==='navigation'&&row.path==='/api/identity/operations-status'){
   keys(row,spec.requestFactShapes.general,'NAVIGATION_HOME_FACT');
   fail(row.role==='ADMIN'&&row.method==='GET'&&row.projectId==='project-a'&&source.navigationInitialHomeWidths.includes(row.width),'SOURCE_DEFINED_NAVIGATION_HOME');navigationHome.push({index,width:row.width});return;
  }
  selected.push(Object.fromEntries(Object.entries(row).filter(([key])=>!omitted.has(key))));selectedIndices.push(index);
 });
 for(const width of source.navigationInitialHomeWidths)fail(navigationHome.filter(row=>row.width===width).length>=source.navigationInitialHomeContextsPerWidth,'INITIAL_HOME_MOUNTS_'+width);
 const legacy=spec.frozenHistory;
 fail(legacy.legacy59RequestCount===406&&legacy.legacy59Requests.length===406&&digest(Buffer.from(JSON.stringify(legacy.legacy59Requests)))===legacy.legacy59MatrixSha256Declared,'INDEPENDENT_FROZEN406_SPEC');
 fail(selected.length===406&&equal(selected,legacy.legacy59Requests),'STRICT_HISTORICAL406_SUBSEQUENCE');
 return {baseChecks:59,selectedRequestCount:406,selectedRequestIndices:selectedIndices,frozenRequestMatrixSha256:legacy.legacy59MatrixSha256Declared,navigationHomeObservedReads:navigationHome.length,navigationHomeSourceInitialContexts:4,navigationHomeTimerReadsHaveNoFittedExactCount:true,rawNeverRewritten:true,raw59Or77Fabricated:false};
}


export const CURRENT85_CLAIMS=Object.freeze({scenarioConformanceAttestedByExactOriginalProducer:true,fullRequestVectorIsNotClaimedOrRequiredByThisNewContract:true,generalHttpStatusQueryCorrelationTimingObserved:false,providerCallsIsInstrumentalCounter:false,historical77CompatibilityAccepted:false,productionAccepted:false,humanAccepted:false});
export function deriveCurrent85SourceContract(readSource){
 const source=bytes(readSource,producer,'PRODUCER');fail(source.equals(loadedProducer)&&digest(source)===CURRENT85_SPEC.producerSha256,'LOADED_PRODUCER_BYTES');
 const ast=parseJavaScript(source.toString('utf8'),{sourceType:'module'}),find=(tree,predicate)=>{const rows=[];const walk=n=>{if(!n||typeof n!=='object')return;if(predicate(n))rows.push(n);for(const[k,v]of Object.entries(n)){if(['loc','extra','comments','leadingComments','trailingComments'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}};walk(tree);fail(rows.length===1,'UNIQUE_SOURCE_LITERAL');return rows[0];};
 const literal=name=>{const p=find(ast,n=>n.type==='ObjectProperty'&&n.key?.name===name);fail(p.value.type==='StringLiteral','SOURCE_LITERAL');return p.value.value;};
 const page=find(ast,n=>n.type==='VariableDeclarator'&&n.id?.name==='pageSource').init;fail(page.type==='StringLiteral','PAGE_LITERAL');
 const copy=focusedWorkspaceTaskPagingCopy(readSource),bootstrap=focusedCompanyBootstrapUiSourceClosure(readSource),closure=focusedWorkspaceUiSourceClosure(readSource);
 const field=parseJavaScript(bytes(readSource,'src/app/(identity)/cuenta/field-operations-panel.js','FIELD').toString('utf8'),{sourceType:'module',plugins:['jsx']}),endpoint=find(field,n=>n.type==='VariableDeclarator'&&n.id?.name==='endpoint').init;fail(endpoint.type==='StringLiteral','FIELD_ENDPOINT_LITERAL');
 const text=source.toString('utf8');for(const needle of ['for(const width of FOCUSED_WORKSPACE_WIDTHS){const preview=await context(width);',"await check('one-mounted-visible-overview-and-hidden-panels-'+width,async()=>{const item=await context(width);"])fail(text.split(needle).length===2,'TWO_INITIAL_HOME_LOOPS');
 return{sourcePaths:focusedWorkspaceUiSourceFiles(readSource),bootstrapSourcePaths:bootstrap.files,externalImports:closure.externalImports,bootstrapExternalImports:bootstrap.externalImports,transport:literal('transport'),homeQueueReadEndpoint:endpoint.value,navigationInitialHomeWidths:[...FOCUSED_WORKSPACE_WIDTHS],navigationInitialHomeContextsPerWidth:2,taskPagingFixture:{version:1,route:'/task-pages',actualParentAndPagerCopies:true,copiedSources:copy.files.map(r=>({path:r.path,sha256:digest(r.bytes)})),overrides:copy.overrides.map(r=>({path:r.path,exportName:r.exportName,originalSha256:digest(bytes(readSource,r.path,'OVERRIDE')),controlledConsumerSha256:digest(r.source)})),pageSha256:digest(page.value),consumerAuthority:literal('consumerAuthority'),original45TreeUnmodified:true}};
}
export function validateCurrent85Raw(original,authority){
 fail(Buffer.isBuffer(original)&&original.length>0,'ORIGINAL_RAW_BYTES');
 fail(plain(authority)&&hex(authority.expectedHead,40)&&hex(authority.expectedTree,40)&&typeof authority.resolveGitTree==='function'&&typeof authority.readGitBlob==='function','EXTERNAL_GIT_AUTHORITY');
 fail(['LOCAL_REVIEW_SOURCE','EXACT_CI_SOURCE'].includes(authority.expectedSourceState),'DECLARED_SOURCE_STATE');
 fail(authority.resolveGitTree(authority.expectedHead)===authority.expectedTree,'EXACT_GIT_TREE');
 fail(bytes(authority.readWorkingSource,specPath,'SPEC').equals(loadedSpec)&&authority.readGitBlob(authority.expectedHead,specPath)?.equals(loadedSpec),'AUTHENTIC_SPEC_BYTES');
 const workingProducer=bytes(authority.readWorkingSource,producer,'PRODUCER'),gitProducer=authority.readGitBlob(authority.expectedHead,producer);
 fail(Buffer.isBuffer(gitProducer)&&workingProducer.equals(gitProducer)&&workingProducer.equals(loadedProducer)&&digest(gitProducer)===CURRENT85_SPEC.producerSha256,'AUTHENTIC_ORIGINAL_PRODUCER');
 const source=deriveCurrent85SourceContract(authority.readWorkingSource),spec=CURRENT85_SPEC;fail(Array.isArray(authority.expectedRawSourceFiles)&&source.sourcePaths.length>0&&new Set(source.sourcePaths).size===source.sourcePaths.length&&equal(source.sourcePaths,authority.expectedRawSourceFiles),'EXACT_DECLARED_RAW_SOURCE_CLOSURE');
 reference(authority.rawReference,'RAW');fail(/^\.vercel\/private\/focused-workspace-ui-evidence\/run-[A-Za-z0-9-]+\/browser\.json$/.test(authority.rawReference.path),'OWNED_RAW_REFERENCE');
 fail(original.length===authority.rawReference.bytes&&digest(original)===authority.rawReference.sha256&&bytes(authority.readEvidence,authority.rawReference.path,'RAW').equals(original),'RAW_INTEGRITY');
 const raw=parse(original,'RAW');keys(raw,authority.expectedSourceState==='EXACT_CI_SOURCE'?[...rawKeys,'ciRun']:rawKeys,'RAW');
 fail(raw.version===4&&raw.status==='PASS'&&raw.sourceState===authority.expectedSourceState&&raw.sourceRevision===authority.expectedHead&&raw.sourceTree===authority.expectedTree&&raw.trackedClean===true&&raw.sourceBytesUnchanged===true,'RAW_SOURCE_AND_STATUS');
 if(authority.expectedSourceState==='EXACT_CI_SOURCE')fail(equal(raw.ciRun,authority.ciRun),'RAW_CI_IDENTITY');
 fail(typeof raw.checkedAt==='string'&&Number.isFinite(Date.parse(raw.checkedAt))&&new Date(raw.checkedAt).toISOString()===raw.checkedAt,'CHECKED_AT');
 const references=[];
 for(const file of source.sourcePaths){fail(safe(file),'SOURCE_PATH');const current=bytes(authority.readWorkingSource,file,'SOURCE'),blob=authority.readGitBlob(authority.expectedHead,file);fail(Buffer.isBuffer(blob)&&current.equals(blob),'SOURCE_BYTES_DIFFER_FROM_GIT_'+file);references.push({path:file,sha256:digest(blob)});}
 fail(equal(raw.sourceManifest,references),'COMPLETE_GIT_SOURCE_MANIFEST');
 const byPath=new Map(references.map(r=>[r.path,r.sha256]));
 fail(equal(raw.bootstrapSourceManifest,source.bootstrapSourcePaths.map(p=>({path:p,sha256:byPath.get(p)})))&&equal(raw.externalImports,source.externalImports)&&equal(raw.bootstrapExternalImports,source.bootstrapExternalImports),'BOOTSTRAP_AND_EXTERNAL_CLOSURES');
 fail(equal(raw.taskPagingFixture,source.taskPagingFixture)&&raw.taskPagingFixture.actualParentAndPagerCopies===true&&raw.taskPagingFixture.original45TreeUnmodified===true&&raw.taskPagingFixture.overrides.length===2,'ORIGINAL_TASK_PAGING_BOUNDARY');
 validateChecks(raw,spec);
 fail(equal(raw.errors,[])&&raw.providerCalls===0&&raw.businessPosts===2&&raw.navigationPosts===0&&raw.productionDataTouched===false&&raw.actualAccountWorkspaceMounted===true&&raw.actualClerkOrSSRVerified===false&&raw.syntheticPixelsOnly===true&&raw.transport===source.transport,'SYNTHETIC_BOUNDARIES');
 validateCleanup(raw.cleanup);const requestSummary=validateRequests(raw,spec,source),legacy59Projection=validateHistorical59Projection(raw,spec,source);
 fail(Array.isArray(raw.screenshots)&&raw.screenshots.length===78&&equal(raw.screenshots.map(r=>r.path),spec.screenshots.rows.map(r=>r.path)),'ORDERED_78_SCREENSHOTS');
 const directory=path.posix.dirname(authority.rawReference.path);
 raw.screenshots.forEach((r,i)=>{keys(r,['path','sha256','geometry'],'SCREENSHOT');keys(r.geometry,['width','height','scrollWidth','identityActionTop'],'GEOMETRY');const expected=spec.screenshots.rows[i],g=r.geometry;fail(safe(r.path)&&path.posix.basename(r.path)===r.path&&hex(r.sha256,64)&&g.width===expected.width&&g.height===expected.viewportHeight&&Number.isSafeInteger(g.scrollWidth)&&g.scrollWidth>0&&(g.identityActionTop===null||Number.isFinite(g.identityActionTop)),'SOURCE_SCREENSHOT_GEOMETRY');if(r.path.startsWith('home-pending-decisions-')||r.path.startsWith('bootstrap-ready-'))fail(g.scrollWidth<=g.width+1,'HOME_BOOTSTRAP_OVERFLOW');if(r.path.startsWith('identity-entry-'))fail(g.identityActionTop===null,'IDENTITY_PRECHOICE_GEOMETRY');const png=bytes(authority.readEvidence,directory+'/'+r.path,'PNG');fail(digest(png)===r.sha256&&png.length>=24&&png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&png.toString('ascii',12,16)==='IHDR'&&png.readUInt32BE(16)>0&&png.readUInt32BE(20)>0,'ORIGINAL_PNG_BYTES');});
 fail(bytes(authority.readEvidence,authority.rawReference.path,'RAW_FINAL').equals(original),'RAW_CHANGED_DURING_REVIEW');
 for(const row of references)fail(digest(bytes(authority.readWorkingSource,row.path,'SOURCE_FINAL'))===row.sha256,'SOURCE_CHANGED_DURING_REVIEW_'+row.path);
 fail(authority.resolveGitTree(authority.expectedHead)===authority.expectedTree,'GIT_TREE_CHANGED_DURING_REVIEW');
 return {status:'PASS',sourceState:raw.sourceState,sourceRevision:raw.sourceRevision,sourceTree:raw.sourceTree,checks:85,homeCases:20,identityCases:6,screenshots:78,sourceFiles:source.sourcePaths.length,...requestSummary,legacy59Projection,requestCountIsOracle:false,claims:CURRENT85_CLAIMS};
}
