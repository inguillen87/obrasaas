import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';

export const PARTICIPANT_CIVIL_UI_VERSION='participant-civil-ui-v1';
export const PARTICIPANT_CIVIL_UI_WIDTHS=Object.freeze([320,390,768,1280]);
export const PARTICIPANT_CIVIL_UI_CHECKS=Object.freeze([
 ...PARTICIPANT_CIVIL_UI_WIDTHS.map(width=>'responsive-keyboard-explicit-consent:'+width),
 'closed-default-manual-get-only','holder-three-gestures-one-operation','manager-cannot-consent',
 'unknown-transport-reload-get-only','context-change-clears-consent-draft','mismatched-response-hides-private-facts',
]);
export const PARTICIPANT_CIVIL_UI_DEPENDENCIES=Object.freeze(['package-lock.json','package.json']);
const sourceRoot='src/app/(identity)/cuenta/participant-civil-data-panel.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
const inside=(filename,base)=>{const relative=path.relative(base,filename);return relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
function guard(condition,message){if(!condition)throw Object.assign(new Error(message),{code:'PARTICIPANT_CIVIL_UI_FIXTURE_REJECTED'});}

export function participantCivilUiOptions(args,{repoRoot,environment={}}){
 guard(!environment.VERCEL&&!environment.VERCEL_ENV&&!environment.VERCEL_TARGET_ENV,'Only an isolated local fixture is supported');
 guard(Array.isArray(args)&&typeof repoRoot==='string'&&path.isAbsolute(repoRoot),'Explicit fixture arguments/root required');
 let expectedHead=environment.GITHUB_SHA||null,outputFile=null;
 if(args[0]==='--expected-head'){guard(args.length===2||args.length===3,'Unsupported fixture arguments');expectedHead=args[1];outputFile=args[2]||null;}
 else{guard(args.length<=1&&!args[0]?.startsWith('--'),'Unsupported fixture arguments');outputFile=args[0]||null;}
 guard(expectedHead===null||typeof expectedHead==='string'&&/^[a-f0-9]{40}$/.test(expectedHead),'A full expected Git commit is required');
 if(environment.GITHUB_SHA)guard(expectedHead===environment.GITHUB_SHA,'Expected HEAD must match the CI event');
 const outputRoot=path.join(repoRoot,'.vercel/private/participant-civil-evidence'),target=outputFile?path.resolve(repoRoot,outputFile):null;
 guard(!target||path.dirname(target)===outputRoot&&path.extname(target)==='.json','Evidence must be a direct JSON child of participant-civil-evidence');
 return {expectedHead,outputRoot,target};
}

function importsOf(bytes,filename){
 if(filename.endsWith('.css')){guard(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'External stylesheet dependencies are forbidden');return [];}
 const imports=[],ast=parse(bytes.toString(),{sourceType:'module',plugins:['jsx']});
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)imports.push(node.source.value);
  if(node.type==='ImportExpression'){guard(node.source.type==='StringLiteral','Only literal imports');imports.push(node.source.value);}
  if(node.type==='CallExpression'&&node.callee?.type==='Import'){guard(node.arguments[0]?.type==='StringLiteral','Only literal imports');imports.push(node.arguments[0].value);}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
 }
 visit(ast.program);return imports;
}

export function participantCivilUiSourceFiles(repoRoot){
 const root=realpathSync(repoRoot),seen=new Set();
 function walk(filename){
  filename=realpathSync(filename);guard(inside(filename,path.join(root,'src')),'Only production src dependencies');
  if(seen.has(filename))return;seen.add(filename);
  for(const specifier of importsOf(readFileSync(filename),filename)){
   if(!specifier.startsWith('.')){guard(specifier==='react','Unexpected browser package dependency');continue;}
   const absolute=path.resolve(path.dirname(filename),specifier),dependency=[absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.join(absolute,'index.js')].find(file=>existsSync(file)&&lstatSync(file).isFile());
   guard(Boolean(dependency),'Missing relative source dependency');walk(dependency);
  }
 }
 walk(path.join(root,sourceRoot));return [...seen].map(file=>path.relative(root,file).split(path.sep).join('/')).sort();
}

export function participantCivilUiServerEnvironment(environment){
 const keys=['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','ComSpec','COMSPEC'];
 return {...Object.fromEntries(keys.filter(key=>environment[key]!==undefined).map(key=>[key,environment[key]])),NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'};
}
async function bounded(promise,message,milliseconds=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds);})]);}finally{clearTimeout(timer);}}
async function freePort(){const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}

export async function verifyParticipantCivilUi(args=process.argv.slice(2)){
 const root=realpathSync(process.cwd()),options=participantCivilUiOptions(args,{repoRoot:root,environment:process.env});
 const git=args=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
 const sourceRevision=git(['rev-parse','HEAD']),sourceTree=git(['rev-parse','HEAD^{tree}']),trackedClean=git(['status','--porcelain','--untracked-files=no'])==='';
 if(options.expectedHead)assert.equal(sourceRevision,options.expectedHead);if(process.env.CI==='true')assert.ok(options.expectedHead&&trackedClean,'Exact clean CI source required');
 const harnessSha256=sha(readFileSync(fileURLToPath(import.meta.url))),cleanupHelperSha256=sha(readFileSync(new URL('./lib/owned-fixture-cleanup.mjs',import.meta.url)));
 const dependencyManifest=PARTICIPANT_CIVIL_UI_DEPENDENCIES.map(relative=>({path:relative,sha256:sha(readFileSync(path.join(root,relative)))}));
 const stamp=new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8),privateDir=options.outputRoot;
 const target=options.target||path.join(privateDir,'browser-'+stamp+'.json');guard(!existsSync(target),'Evidence is immutable');
 mkdirSync(privateDir,{recursive:true});guard(!lstatSync(privateDir).isSymbolicLink()&&realpathSync(privateDir)===privateDir,'Evidence directory cannot be redirected');
 const privateRoot=path.join(root,'.vercel/private'),fixture=mkdtempSync(path.join(privateRoot,'participant-civil-ui-'));
 const ownership=captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix:'participant-civil-ui-'});
 const screenshots=path.join(privateDir,'screenshots-'+stamp);
 const sourceManifest=[],externalImports=new Set(),screenshotManifest=[],pageErrors=[],interceptErrors=[],externalRequests=[],apiRequests=[],checks=[];
 const scopeA='a'.repeat(64),scopeB='b'.repeat(64),revision='2026-10-13T12:00:00.000001',operation='abcdefab-1234-4abc-9abc-abcdef123456';
 const base={scope:scopeA,projectId:'project_synthetic',workerId:'worker_synthetic',submissionId:'submission_synthetic',revision,sourceKey:'c'.repeat(64),self:true,canManage:false};
 const noticeText='Aviso sintético: autorizo una consulta civil opcional para esta presentación. No acredita identidad ni prueba de vida.',notice={version:'bindx-civil-data-consent-v1',text:noticeText,sha256:sha(noticeText)};
 const civilData={nombres:'CIVIL PRIVADO SINTÉTICO',apellido:'PARA REVISIÓN',ejemplar:'A',fecha_nacimiento:'12/02/2000',emision:'01/10/2025',vencimiento:'01/10/2030',codigo_fallecido:0};
 let browser,child,childClose,origin,closeAck=false,browserClosed=false,serverClosed=false,cleanupProof,failure,serverLog='';
 function envelope(context,state,op=operation){
  const has=['CONSENT_PENDING','CONSENT_RECORDED','DISPATCHING','UNKNOWN','OBSERVED'].includes(state),consented=has&&state!=='CONSENT_PENDING';
  return {detail:'civil-data',scope:context.scope,projectId:context.projectId,workerId:context.workerId,submissionId:context.submissionId,civil:{version:1,state,available:state!=='CONTRACT_PENDING',code:state==='CONTRACT_PENDING'?'BINDX_CIVIL_CONTRACT_PENDING':null,notice:state==='CONTRACT_PENDING'?null:{...notice},canPrepare:state==='NOT_OBSERVED',canConsent:context.self&&state==='CONSENT_PENDING',canQuery:state==='CONSENT_RECORDED',canRevokeConsent:context.self&&consented,attempt:has?{operationId:op,state,attemptDigest:'d'.repeat(64),operatorId:'operator_synthetic',noticeVersion:notice.version,noticeSha256:notice.sha256,consentRecorded:consented,observedAt:state==='OBSERVED'?'2026-10-13T12:00:00.000Z':null,queryAttempted:['UNKNOWN','OBSERVED'].includes(state),code:state==='UNKNOWN'?'BINDX_CIVIL_TRANSPORT_UNCONFIRMED':null,data:state==='OBSERVED'?{...civilData}:null}:null,identityCertified:false,biometricsVerified:false,livenessVerified:false,permissionsGranted:false,requiresHumanReview:true}};
 }
 async function pageFixture(label,{width=390,state='NOT_OBSERVED',manager=false,queryTransportFailure=false,mismatch=null}={}){
  const context=await browser.createBrowserContext(),page=await context.newPage(),requests=[];
  let currentContext={...base,self:!manager,canManage:manager},currentState=state,reservedOperation=['NOT_OBSERVED','CONTRACT_PENDING'].includes(state)?null:operation,queryCount=0;
  await page.setViewport({width,height:1050,deviceScaleFactor:1});page.on('pageerror',error=>pageErrors.push({label,message:error.message}));
  await page.setRequestInterception(true);page.on('request',async request=>{try{
   const url=new URL(request.url());
   if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();externalRequests.push({label,url:request.url()});await request.abort();return;}
   if(!url.pathname.startsWith('/api/'))return request.continue();
   assert.equal(url.pathname,'/api/identity/participants');assert.equal(request.headers().authorization,'Bearer synthetic-participant-civil-session');
   const record={label,path:url.pathname,method:request.method()};let value;
   if(request.method()==='GET'){
    const query=Object.fromEntries(url.searchParams);assert.deepEqual(Object.keys(query).sort(),['detail','projectId','scope','submissionId','workerId',...(query.operationId?['operationId']:[])].sort());
    assert.equal(query.detail,'civil-data');for(const key of ['scope','projectId','workerId','submissionId'])assert.equal(query[key],currentContext[key],'Current explicit presentation only');
    if(query.operationId)assert.equal(query.operationId,reservedOperation,'Recovery must keep the admitted operation');
    Object.assign(record,{query});value=envelope(currentContext,currentState,reservedOperation||operation);
   }else{
    assert.equal(request.method(),'POST');const command=JSON.parse(request.postData());assert.deepEqual(Object.keys(command).sort(),['scope','projectId','operationId','action','payload'].sort());
    for(const key of ['scope','projectId'])assert.equal(command[key],currentContext[key]);for(const key of ['workerId','submissionId'])assert.equal(command.payload[key],currentContext[key]);
    assert.match(command.operationId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    if(command.action==='PREPARE_CIVIL_DATA'){
     assert.equal(currentState,'NOT_OBSERVED');assert.equal(reservedOperation,null,'No new operation for an existing presentation');assert.deepEqual(Object.keys(command.payload).sort(),['revision','submissionId','workerId']);assert.equal(command.payload.revision,revision);reservedOperation=command.operationId;currentState='CONSENT_PENDING';
    }else{
     assert.equal(command.operationId,reservedOperation);
     if(command.action==='CONSENT_CIVIL_DATA'){
      assert.equal(currentContext.self,true,'Manager cannot authorize holder consent');assert.equal(currentState,'CONSENT_PENDING');assert.deepEqual(command.payload,{workerId:currentContext.workerId,submissionId:currentContext.submissionId,attemptDigest:'d'.repeat(64),noticeVersion:notice.version,noticeSha256:notice.sha256,consent:true,dni:'00000000',gender:'F'});currentState='CONSENT_RECORDED';
     }else{
      assert.equal(command.action,'QUERY_CIVIL_DATA');assert.equal(currentState,'CONSENT_RECORDED');assert.deepEqual(Object.keys(command.payload).sort(),['submissionId','workerId']);assert.equal(++queryCount,1,'No second synthetic paid dispatch');currentState=queryTransportFailure?'UNKNOWN':'OBSERVED';
     }
    }
    Object.assign(record,{command});value=envelope(currentContext,currentState,reservedOperation);
    if(mismatch&&command.action==='QUERY_CIVIL_DATA'){if(mismatch==='operationId')value.civil.attempt.operationId='abcdefab-1234-4abc-9abc-abcdef123457';else value[mismatch]=mismatch==='scope'?scopeB:'foreign_synthetic';}
   }
   requests.push(record);apiRequests.push(record);
   if(queryTransportFailure&&record.command?.action==='QUERY_CIVIL_DATA'){await request.abort('failed');return;}
   await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(value)});
  }catch(error){interceptErrors.push({label,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>Boolean(window.__civilContext)&&typeof window.__changeCivilContext==='function');
  if(manager){await page.evaluate(()=>window.__changeCivilContext({self:false,canManage:true}));await page.waitForFunction(()=>window.__civilContext.self===false&&window.__civilContext.canManage===true);}
  await page.waitForSelector('[data-participant-civil]');
  return {page,context,requests,operation:()=>reservedOperation,queryCount:()=>queryCount,change:async changes=>{currentContext={...currentContext,...changes};currentState='CONSENT_PENDING';reservedOperation=operation;await page.evaluate(value=>window.__changeCivilContext(value),changes);await page.waitForFunction(expected=>Object.entries(expected).every(([key,value])=>window.__civilContext[key]===value),{},changes);}};
 }
 const waitText=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:15000},text);
 const bodyText=page=>page.$eval('body',node=>node.innerText);
 const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 async function button(page,text,{keyboard=false}={}){
  const handles=await page.$$('[data-participant-civil] button');let found=false;
  for(const handle of handles){if(await handle.evaluate((node,value)=>node.textContent.trim()===value,text)){assert.equal(found,false,'Button label must identify one control');if(keyboard){await handle.focus();await page.keyboard.press('Enter');}else await handle.click();found=true;}await handle.dispose();}
  assert.ok(found,'Missing button: '+text);
 }
 async function open(page){await page.$eval('[data-participant-civil] summary',node=>node.focus());await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('[data-participant-civil]')?.open===true);}
 async function consult(item){await button(item.page,item.requests.length?'Consultar este intento civil':'Consultar disponibilidad civil',{keyboard:true});}
 async function blanks(page){await page.waitForSelector('[name=civil-dni]');assert.deepEqual(await page.evaluate(()=>({dni:document.querySelector('[name=civil-dni]').value,gender:document.querySelector('[name=civil-gender]').value,consent:document.querySelector('[type=checkbox]').checked,save:[...document.querySelectorAll('button')].find(node=>node.textContent.trim()==='Guardar autorización civil').disabled})),{dni:'',gender:'',consent:false,save:true});}
 async function fill(page){
  await page.focus('[name=civil-dni]');await page.keyboard.type('00000000');await page.focus('[name=civil-gender]');await page.keyboard.press('f');await page.keyboard.press('Tab');
  assert.equal(await page.$eval('[name=civil-gender]',node=>node.value),'F');assert.equal(await page.$eval('[type=checkbox]',node=>node.checked),false);
  await page.focus('[type=checkbox]');await page.keyboard.press('Space');assert.equal(await page.$eval('[type=checkbox]',node=>node.checked),true);
 }
 async function metrics(page,width){
  const value=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('[data-participant-civil] button,[data-participant-civil] summary,[data-participant-civil] input:not([type=checkbox]),[data-participant-civil] select,[data-participant-civil] label:has(input[type=checkbox])')].filter(node=>node.getClientRects().length).map(node=>({tag:node.tagName,label:(node.getAttribute('name')||node.textContent.trim()).slice(0,100),height:node.getBoundingClientRect().height,width:node.getBoundingClientRect().width}))}));
  assert.equal(value.width,width);assert.ok(value.documentWidth<=width,'No horizontal overflow');assert.ok(value.targets.length>=5&&value.targets.every(target=>target.height>=44&&target.width>=44),'Visible touch targets must be 44px: '+JSON.stringify(value.targets.filter(target=>target.height<44||target.width<44)));return value;
 }
 async function viewport(width){const item=await pageFixture('viewport-'+width,{width,state:'CONSENT_PENDING'});try{
  assert.equal(item.requests.length,0,'Mount never reads or mutates');await open(item.page);assert.equal(item.requests.length,0,'Opening never opts in');await consult(item);await blanks(item.page);await fill(item.page);
  const value=await metrics(item.page,width),name=width+'-civil-explicit-consent.png',filename=path.join(screenshots,name);assert.ok((await bodyText(item.page)).includes(noticeText));assert.equal(item.requests.filter(row=>row.method==='POST').length,0);
  await item.page.screenshot({path:filename,fullPage:true});screenshotManifest.push({path:path.relative(root,filename).split(path.sep).join('/'),width,sha256:sha(readFileSync(filename))});
  checks.push({check:'responsive-keyboard-explicit-consent:'+width,postCount:0,blankConsentConfirmed:true,keyboardNoticeOptIn:true,...value});
 }finally{await item.context.close();}}
 async function closed(){const item=await pageFixture('closed-default-manual-get-only',{state:'CONTRACT_PENDING'});try{
  assert.equal(item.requests.length,0);await open(item.page);assert.equal(item.requests.length,0);await consult(item);await waitText(item.page,'no está habilitada');assert.equal(await item.page.$('[data-participant-civil] form'),null);assert.equal(await item.page.$('[data-participant-civil] input'),null);assert.equal(item.requests.length,1);assert.equal(item.requests[0].method,'GET');checks.push({check:'closed-default-manual-get-only',getCount:1,postCount:0});
 }finally{await item.context.close();}}
 async function holder(){const item=await pageFixture('holder-three-gestures-one-operation');try{
  await open(item.page);await consult(item);await waitText(item.page,'Podés preparar');assert.equal(item.requests.filter(row=>row.method==='POST').length,0);
  await button(item.page,'Preparar consulta opcional',{keyboard:true});await blanks(item.page);assert.deepEqual(item.requests.filter(row=>row.method==='POST').map(row=>row.command.action),['PREPARE_CIVIL_DATA']);
  await fill(item.page);assert.equal(item.requests.filter(row=>row.method==='POST').length,1);await button(item.page,'Guardar autorización civil',{keyboard:true});await waitText(item.page,'La autorización está registrada.');assert.equal(item.queryCount(),0);assert.equal(await item.page.$('[data-participant-civil] form'),null);
  await button(item.page,'Consultar datos civiles',{keyboard:true});await waitText(item.page,civilData.nombres);assert.ok((await bodyText(item.page)).includes('no verifican a la persona presente'));const posts=item.requests.filter(row=>row.method==='POST');assert.deepEqual(posts.map(row=>row.command.action),['PREPARE_CIVIL_DATA','CONSENT_CIVIL_DATA','QUERY_CIVIL_DATA']);assert.equal(new Set(posts.map(row=>row.command.operationId)).size,1);assert.equal(item.queryCount(),1);
  checks.push({check:'holder-three-gestures-one-operation',operationId:item.operation(),postCount:3,queryCount:1,noticeSha256:notice.sha256,consentDefault:false});
 }finally{await item.context.close();}}
 async function manager(){const item=await pageFixture('manager-cannot-consent',{state:'CONSENT_PENDING',manager:true});try{
  assert.equal(item.requests.length,0);await open(item.page);await consult(item);await waitText(item.page,'El titular debe revisar');assert.equal(await item.page.$('[data-participant-civil] form'),null);assert.equal(await item.page.$('[data-participant-civil] input'),null);assert.equal(item.requests.filter(row=>row.method==='POST').length,0);checks.push({check:'manager-cannot-consent',getCount:1,postCount:0,holderControls:0});
 }finally{await item.context.close();}}
 async function unknown(){const item=await pageFixture('unknown-transport-reload-get-only',{state:'CONSENT_RECORDED',queryTransportFailure:true});try{
  await open(item.page);await consult(item);await waitText(item.page,'La autorización está registrada.');await button(item.page,'Consultar datos civiles',{keyboard:true});await waitText(item.page,'No se pudo confirmar la respuesta.');assert.equal(await item.page.$('[data-participant-civil] form'),null);assert.ok(!(await bodyText(item.page)).includes(civilData.nombres));
  await consult(item);await waitText(item.page,'El resultado sigue pendiente');assert.equal(item.requests.at(-1).query.operationId,operation);assert.equal(await item.page.$eval('[data-fixture-pending]',node=>node.textContent),'Libre');
  const before=item.requests.length;await item.page.reload({waitUntil:'domcontentloaded'});await item.page.waitForFunction(()=>Boolean(window.__civilContext));await settle(item.page);assert.equal(item.requests.length,before,'Reload never sends an automatic recovery');await open(item.page);await button(item.page,'Consultar disponibilidad civil',{keyboard:true});await waitText(item.page,'El resultado sigue pendiente');assert.equal(item.requests.at(-1).query.operationId,undefined,'Fresh instance recovers through current worker');await button(item.page,'Consultar este intento civil',{keyboard:true});await waitText(item.page,'El resultado sigue pendiente');assert.equal(item.requests.at(-1).query.operationId,operation);assert.equal(item.requests.filter(row=>row.method==='POST').length,1);assert.equal(item.queryCount(),1);assert.ok(!(await bodyText(item.page)).includes('Consultar datos civiles'));
  checks.push({check:'unknown-transport-reload-get-only',operationId:operation,getCount:item.requests.filter(row=>row.method==='GET').length,postCount:1,queryCount:1,reloadAutomaticRequestCount:0});
 }finally{await item.context.close();}}
 async function changeContext(){const item=await pageFixture('context-change-clears-consent-draft',{state:'CONSENT_PENDING'});try{
  await open(item.page);await consult(item);await blanks(item.page);await fill(item.page);
  const transitions=[{scope:scopeB,workerId:'worker_other_synthetic'},{submissionId:'submission_new_synthetic',sourceKey:'e'.repeat(64)},{revision:'2026-10-13T12:00:00.000002'}];
  for(const changes of transitions){const count=item.requests.length;await item.change(changes);await settle(item.page);assert.equal(item.requests.length,count,'Changing source never dispatches');assert.equal(await item.page.$('[data-participant-civil] form'),null);assert.ok(!(await bodyText(item.page)).includes(noticeText));await open(item.page);await button(item.page,'Consultar disponibilidad civil',{keyboard:true});await blanks(item.page);await fill(item.page);}
  assert.equal(item.requests.filter(row=>row.method==='POST').length,0);checks.push({check:'context-change-clears-consent-draft',contextChanges:transitions,blankAfterEachChange:true,postCount:0});
 }finally{await item.context.close();}}
 async function mismatches(){const results=[];for(const key of ['scope','projectId','workerId','submissionId','operationId']){const item=await pageFixture('mismatch-'+key,{state:'CONSENT_RECORDED',mismatch:key});try{
  await open(item.page);await consult(item);await waitText(item.page,'La autorización está registrada.');await button(item.page,'Consultar datos civiles',{keyboard:true});await waitText(item.page,'No se pudo confirmar la respuesta.');assert.ok(!(await bodyText(item.page)).includes(civilData.nombres));assert.ok(!(await bodyText(item.page)).includes('foreign_synthetic'));assert.equal(await item.page.$('[data-participant-civil] form'),null);assert.equal(await item.page.$eval('[data-fixture-pending]',node=>node.textContent),'Libre');await consult(item);await waitText(item.page,civilData.nombres);assert.equal(item.requests.at(-1).query.operationId,operation);assert.equal(item.queryCount(),1);assert.equal(item.requests.filter(row=>row.method==='POST').length,1);results.push({field:key,privateFactsAfterMismatch:false,recoveryMethod:'GET',queryCount:1});
 }finally{await item.context.close();}}checks.push({check:'mismatched-response-hides-private-facts',mismatches:results,postCount:5,queryCount:5});}
 try{
  mkdirSync(screenshots);
  for(const relative of participantCivilUiSourceFiles(root)){
   const source=path.join(root,relative),bytes=readFileSync(source),destination=path.join(fixture,relative);guard(inside(destination,fixture),'Owned copy target only');mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(source,destination);assert.deepEqual(readFileSync(destination),bytes);sourceManifest.push({path:relative,sha256:sha(bytes)});for(const specifier of importsOf(bytes,source))if(!specifier.startsWith('.'))externalImports.add(specifier);
  }
  const app=path.join(fixture,'src/app');writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-participant-civil-ui',private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);
  writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial,sans-serif',background:'#edf3fa'}}>{children}</body></html>}`);
  writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useEffect,useState} from 'react';import {ParticipantCivilDataPanel} from './(identity)/cuenta/participant-civil-data-panel';import styles from './(identity)/cuenta/participant-panel.module.css';export default function Page(){const [context,setContext]=useState(${JSON.stringify(base)}),[pending,setPending]=useState(false);const token=useCallback(async()=> 'synthetic-participant-civil-session',[]);useEffect(()=>{window.__civilContext=context;window.__changeCivilContext=value=>setContext(prior=>({...prior,...value}));},[context]);return <main data-fixture="PARTICIPANT_CIVIL_FIXTURE" style={{maxWidth:1080,margin:'auto',minWidth:0}}><h1>Consulta civil opcional</h1><p>Perfil, sesión y datos exclusivamente sintéticos.</p><p data-fixture-pending>{pending?'En curso':'Libre'}</p><section className={styles.panel}><div className={styles.card}><h3>Presentación vigente</h3><ParticipantCivilDataPanel {...context} getSessionToken={token} onPending={setPending}/></div></section></main>;}`);
  const port=await freePort(),nonce=randomUUID(),childFile=path.join(fixture,'owned-server.cjs');origin='http://127.0.0.1:'+port;
  writeFileSync(childFile,`const {createServer}=require('node:http');const next=require(${JSON.stringify(path.join(root,'node_modules/next'))});const nonce=${JSON.stringify(nonce)};let app,server,closing=false;let ready;async function close(){if(closing)return;closing=true;try{await ready.catch(()=>{});if(server?.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}if(app)await app.close();if(process.connected)process.send({type:'closed',nonce},()=>process.exit(0));else process.exit(0);}catch{if(process.connected)process.send({type:'close-failed',nonce},()=>process.exit(1));else process.exit(1);}}process.on('message',message=>{if(message&&Object.keys(message).sort().join('|')==='nonce|type'&&message.type==='close'&&message.nonce===nonce)void close();});process.on('disconnect',()=>void close());process.on('SIGTERM',()=>void close());ready=(async()=>{server=createServer((req,res)=>app.getRequestHandler()(req,res));app=next({dev:true,dir:${JSON.stringify(fixture)},hostname:'127.0.0.1',port:${port},httpServer:server,webpack:true,turbopack:false});await app.prepare();server.on('upgrade',(req,socket,head)=>app.getUpgradeHandler()(req,socket,head));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(${port},'127.0.0.1',resolve);});if(process.connected)process.send({type:'ready',nonce});})();ready.catch(error=>{console.error(error);process.exitCode=1;if(process.connected)process.send({type:'failed',nonce});});`);
  child=spawn(process.execPath,[childFile],{cwd:fixture,env:participantCivilUiServerEnvironment(process.env),stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});child.__closeNonce=nonce;childClose=new Promise(resolve=>child.once('close',resolve));for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-16000);});child.on('message',message=>{if(message?.nonce===nonce&&message.type==='closed')closeAck=true;});
  await bounded(new Promise((resolve,reject)=>{child.once('error',reject);child.on('message',message=>{if(message?.nonce!==nonce)return;if(message.type==='ready')resolve();if(message.type==='failed')reject(new Error('Owned Next preparation failed'));});child.once('exit',()=>reject(new Error('Owned Next exited before readiness')));}), 'Owned Next readiness timed out',90000);
  const response=await fetch(origin,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok&&(await response.text()).includes('PARTICIPANT_CIVIL_FIXTURE'));
  const runnerArgs=process.env.GITHUB_ACTIONS==='true'&&process.platform==='linux'?['--no-sandbox','--disable-setuid-sandbox']:[];browser=await puppeteer.launch({headless:true,args:[...runnerArgs,'--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--metrics-recording-only','--no-first-run','--disable-features=MediaRouter']});
  for(const width of PARTICIPANT_CIVIL_UI_WIDTHS)await viewport(width);await closed();await holder();await manager();await unknown();await changeContext();await mismatches();
  assert.deepEqual(checks.map(check=>check.check),PARTICIPANT_CIVIL_UI_CHECKS);assert.deepEqual(pageErrors,[]);assert.deepEqual(interceptErrors,[]);assert.deepEqual(externalRequests,[]);assert.equal(apiRequests.filter(row=>row.command?.action==='QUERY_CIVIL_DATA').length,7);assert.equal(apiRequests.filter(row=>row.method==='POST').length,9);
  for(const ref of [...sourceManifest,...dependencyManifest])assert.equal(sha(readFileSync(path.join(root,ref.path))),ref.sha256,'Rendered source/dependency changed');assert.equal(sha(readFileSync(fileURLToPath(import.meta.url))),harnessSha256);assert.equal(sha(readFileSync(new URL('./lib/owned-fixture-cleanup.mjs',import.meta.url))),cleanupHelperSha256);assert.equal(git(['rev-parse','HEAD']),sourceRevision);assert.equal(git(['rev-parse','HEAD^{tree}']),sourceTree);if(process.env.CI==='true')assert.equal(git(['status','--porcelain','--untracked-files=no']),'');
 }catch(error){failure=error;}
 finally{
  try{if(browser)await bounded(browser.close(),'Owned browser close timed out');browserClosed=true;}catch(error){failure ||=error;}
  try{if(!child)serverClosed=true;else{if(child.exitCode===null&&child.signalCode===null&&child.connected)child.send({type:'close',nonce:child.__closeNonce});await bounded(childClose,'Owned Next close timed out');serverClosed=closeAck&&child.exitCode===0;assert.ok(serverClosed,'Nonce-bound graceful close acknowledgment required');}}catch(error){failure ||=error;}
  try{cleanupProof=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:serverClosed});assert.ok(cleanupProof.fixtureRemoved);}catch(error){failure ||=error;cleanupProof=error.cleanupProof;}
 }
 const proof={version:PARTICIPANT_CIVIL_UI_VERSION,status:failure?'FAILED':'PASS',recordedAt:new Date().toISOString(),sourceRevision,sourceTree,trackedClean,sourceState:process.env.CI==='true'?'EXACT_CI_SOURCE':trackedClean?'clean':'working-tree',environment:'isolated-localhost-next-exact-jsx-synthetic-api',widths:PARTICIPANT_CIVIL_UI_WIDTHS,totalCheckCount:checks.length,checks,sourceManifest,dependencyManifest,externalImports:[...externalImports].sort(),harnessSha256,cleanupHelperSha256,screenshots:screenshotManifest,pageErrors,interceptErrors,externalRequests,apiRequests,explicitSyntheticPostCount:apiRequests.filter(row=>row.method==='POST').length,explicitSyntheticQueryCount:apiRequests.filter(row=>row.command?.action==='QUERY_CIVIL_DATA').length,automaticPostCount:0,providerRequests:0,productionLoginVerified:false,productionDataWritten:false,realIdentityDocuments:false,realHolderConsent:false,physicalDeviceAccepted:false,cleanup:{browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:cleanupProof?.fixtureRemoved===true,fixtureCleanupProof:cleanupProof},...(failure?{failure:failure.message,serverLog}:{})};
 writeFileSync(target,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,evidence:path.relative(root,target).split(path.sep).join('/'),totalCheckCount:checks.length,sourceCount:sourceManifest.length,cleanup:proof.cleanup}));if(failure)throw failure;return proof;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyParticipantCivilUi();
