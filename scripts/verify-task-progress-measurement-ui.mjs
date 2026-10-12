import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:net';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {deriveTaskMeasurement,TASK_MEASUREMENT_VERSION} from '../src/lib/task-progress-measurement.js';
import {createVoiceProgressDraft} from '../src/lib/voice-progress-draft.mjs';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';

// Exact production JSX/CSS rendered by Next. API responses, authentication and
// money are synthetic; no real provider or financial request is authorized.
assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV,'Run only against the disposable localhost fixture');
const root = realpathSync(process.cwd()),privateRoot = path.join(root,'.vercel','private');
const git=args=>{const value=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(value.status,0,value.stderr);return value.stdout.trim();};
const sourceRevision=git(['rev-parse','HEAD']),sourceTree=git(['rev-parse','HEAD^{tree}']),trackedClean=git(['status','--porcelain=v1','--untracked-files=no'])==='';
for (const filename of [root,path.join(root,'.vercel'),privateRoot]) {
  if (!existsSync(filename)) mkdirSync(filename);
  assert.ok(lstatSync(filename).isDirectory() && !lstatSync(filename).isSymbolicLink());
  assert.equal(realpathSync(filename),filename);
}
const output = path.join(privateRoot,'task-progress-measurement-evidence');
mkdirSync(output,{recursive:true});
const runId = new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
const screenshots = path.join(output,'screenshots-'+runId);mkdirSync(screenshots);
const fixturePrefix = 'task-progress-measurement-ui-',fixture = mkdtempSync(path.join(privateRoot,fixturePrefix));
const ownership = captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix:fixturePrefix});
const scopeA = 'a'.repeat(64),scopeB = 'b'.repeat(64),fixedNow = '2026-10-12T12:00:00.000Z';
const seenSources = new Set();
const sourceManifest = [],externalImports = new Set(),checks = [],pageErrors = [],interceptErrors = [],externalRequests = [];
const sha = value => createHash('sha256').update(value).digest('hex');
const wait = milliseconds => new Promise(resolve => setTimeout(resolve,milliseconds));
const harnessSha256 = sha(readFileSync(new URL(import.meta.url))),cleanupHelperSha256 = sha(readFileSync(new URL('./lib/owned-fixture-cleanup.mjs',import.meta.url)));
let child,browser,origin,serverLog = '',failure,browserClosed = false,serverClosed = false,fixtureCleanupProof,closeAck = false;
let childClose;

function inside(filename,base) {const relative = path.relative(base,filename);return relative !== '' && !relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative);}
function importsOf(bytes,filename) {
  if (filename.endsWith('.css')) {assert.ok(!/@import\s|url\(\s*['"]?(?!data:|#)/i.test(bytes.toString()),'A fixture stylesheet cannot reference external resources');return [];}
  const ast = parse(bytes.toString(),{sourceType:'module',plugins:['jsx']}),imports = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type) && node.source) imports.push(node.source.value);
    if (node.type === 'ImportExpression') {assert.equal(node.source.type,'StringLiteral');imports.push(node.source.value);}
    if (node.type === 'CallExpression' && node.callee?.type === 'Import') {assert.equal(node.arguments[0]?.type,'StringLiteral');imports.push(node.arguments[0].value);}
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit);else if (value && typeof value === 'object') visit(value);
  }
  visit(ast.program);return imports;
}
function copyClosure(entry) {
  const seen = seenSources;
  function copy(filename) {
    filename = realpathSync(filename);assert.ok(inside(filename,path.join(root,'src')));if (seen.has(filename)) return;seen.add(filename);
    const relative = path.relative(root,filename),bytes = readFileSync(filename),destination = path.join(fixture,relative);
    assert.ok(inside(destination,fixture));mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(filename,destination);assert.deepEqual(readFileSync(destination),bytes);
    sourceManifest.push({path:relative.split(path.sep).join('/'),sha256:sha(bytes)});
    for (const specifier of importsOf(bytes,filename)) {
      if (!specifier.startsWith('.')) {assert.ok(['react','lucide-react','jsqr'].includes(specifier),'Unexpected browser dependency '+specifier);externalImports.add(specifier);continue;}
      const absolute = path.resolve(path.dirname(filename),specifier);
      const dependency = [absolute,absolute+'.js',absolute+'.mjs',absolute+'.css',path.join(absolute,'index.js')].find(candidate => existsSync(candidate) && lstatSync(candidate).isFile());
      assert.ok(dependency,'Missing dependency '+specifier);copy(dependency);
    }
  }
  copy(path.join(root,entry));sourceManifest.sort((a,b) => a.path.localeCompare(b.path));
}
async function bounded(promise,message,milliseconds = 15000) {let timer;try {return await Promise.race([promise,new Promise((_,reject) => {timer = setTimeout(() => reject(new Error(message)),milliseconds);})]);} finally {clearTimeout(timer);}}
async function freePort() {const server = createServer();await new Promise((resolve,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port = server.address().port;await new Promise(resolve => server.close(resolve));return port;}

const stamp = '2026-10-12T10:00:00.000001',nextStamp = n => '2026-10-12T10:00:00.'+String(n).padStart(6,'0');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXxkAAAAASUVORK5CYII=','base64');
const audio = Buffer.alloc(44+3200);
audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(16000,24);audio.writeUInt32LE(32000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(3200,40);
for(let n=0;n<1600;n++)audio.writeInt16LE(Math.round(Math.sin(n*Math.PI/20)*1500),44+n*2);
function taskFixture(scope=scopeA,configured=false,executed='0.0000',index=0){
 const id='task-synthetic-'+(scope===scopeA?'a':'b')+(index?'-units':'');
 const baseline=index?'1000.0000':'200.0000',unit=index?'UNIT':'M2',progress=index?0:Number(BigInt(executed.replace('.',''))*100n/BigInt(baseline.replace('.','')));
 return {id,title:index?'Colocación sintética por unidades':'Revoque sintético '+(scope===scopeA?'A':'B'),status:progress?'IN_PROGRESS':'BACKLOG',progress,startsOn:'2026-10-12',endsOn:'2026-10-24',revision:stamp,...(configured?{measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'definition-'+id,baseline,unit,executed:index?'0.0000':executed,sourceReference:'Cómputo sintético revisado '+(index?'unidades':'superficie'),configuredAt:fixedNow,approvedProposalId:progress?'previous-synthetic-proposal':null,approvedAt:progress?fixedNow:null}}:{})};
}
function evidenceFixture(task,voice=false){
 const text='Hoy completamos 50 m2 de revoque.',bytes=voice?audio:png;
 const e={id:'evidence-synthetic',title:voice?'Audio sintético revisado':'Imagen sintética revisada',taskId:task.id,workerId:'worker-synthetic',sectorId:'sector-synthetic',revision:nextStamp(2),status:'APPROVED',caption:'Archivo de prueba sintético',capturedAt:fixedNow,media:{kind:voice?'audio':'image',contentType:voice?'audio/wav':'image/png',bytes:bytes.length,sha256:sha(bytes)},processing:{status:voice?'TRANSCRIBED_UNREVIEWED':'NOT_REQUESTED'},review:{decision:'APPROVE',reason:'Revisión sintética independiente',recordedAt:fixedNow}};
 if(voice)e.processing.result={text,progressDraft:createVoiceProgressDraft({transcript:text,evidenceId:e.id,evidenceRevision:e.revision,mediaSha256:e.media.sha256,transcriptSha256:sha(text),task})};
 return e;
}
function fieldSnapshot(scope,task,proposal,reviewer=false,voice=false){
 return {scope,projectId:'project-synthetic',reviewAccessStamp:'c'.repeat(64),projectRevision:stamp,canConfigure:false,canReview:true,canApproveProgress:reviewer,sectors:[{id:'sector-synthetic',name:'Sector sintético'}],selfWorkers:reviewer?[]:[{id:'worker-synthetic',name:'Participante sintético',permissions:{report:true,attendance:false}}],workers:[{id:'worker-synthetic',name:'Participante sintético',permissions:{report:true,attendance:false}}],attendance:[],evidence:[evidenceFixture(task,voice)],proposals:proposal?[proposal]:[],incidents:[],materialRequests:[],truncated:false,inventory:{version:1,materials:[],consumptions:[],movements:[],adjustments:[]}};
}
async function textOf(page,selector='body'){return page.$eval(selector,node=>node.innerText);}
async function waitText(page,value,selector='body'){await page.waitForFunction((text,selector)=>document.querySelector(selector)?.innerText.includes(text),{timeout:20000},value,selector);}
async function click(page,value,selector='button'){
 await page.waitForFunction((text,selector)=>[...document.querySelectorAll(selector)].some(node=>node.textContent.trim()===text&&!node.disabled),{timeout:20000},value,selector);
 const handle=await page.evaluateHandle((text,selector)=>[...document.querySelectorAll(selector)].find(node=>node.textContent.trim()===text&&!node.disabled),value,selector);
 const element=handle.asElement();assert.ok(element,'Missing enabled control: '+value);await element.click();await handle.dispose();
}
async function fill(page,label,value){
 const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('label')].find(node=>[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent).join('').trim()===text)?.querySelector('input,textarea,select'),label);
 const element=handle.asElement();assert.ok(element,'Missing field: '+label);const tag=await element.evaluate(node=>node.tagName);
 if(tag==='SELECT')await element.select(value);else{await element.click();await element.evaluate(node=>node.select());await page.keyboard.press('Backspace');await element.type(value);}await handle.dispose();
}
async function check(page,contains){
 const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('label')].find(node=>node.innerText.includes(text))?.querySelector('input[type=checkbox]'),contains);
 const element=handle.asElement();assert.ok(element,'Missing checkbox: '+contains);if(!await element.evaluate(node=>node.checked))await element.click();await handle.dispose();
}
async function idle(page){await page.waitForFunction(()=>!document.querySelector('[data-measurement-editor] button[type=submit]')||!document.querySelector('[data-measurement-editor] button[type=submit]').textContent.includes('Guardando'));await wait(80);}
async function references(page){return page.evaluate(()=>window.__journal.list('a'.repeat(64)));}
async function layout(page,width){
 const result=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('main button,main input:not([type=checkbox]),main select,main textarea,main label:has(input[type=checkbox])')].filter(node=>node.getClientRects().length).map(node=>({tag:node.tagName,text:node.textContent.slice(0,100),width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}))}));
 assert.equal(result.width,width);assert.ok(result.documentWidth<=width,'Horizontal overflow at '+width);assert.ok(result.targets.every(target=>target.height>=44&&target.width>=44),'Small target '+JSON.stringify(result.targets.filter(target=>target.height<44||target.width<44)));return result;
}
async function makePage(label,{width=390,configured=false,executed='0.0000',voice=false,allowed=true}={}){
 const context=await browser.createBrowserContext(),page=await context.newPage(),requests=[];let kind='ready',task=taskFixture(scopeA,configured,executed),proposal=null,configuration=null,originalCommand=null;
 await page.setViewport({width,height:1080,deviceScaleFactor:1});page.on('pageerror',error=>pageErrors.push({label,message:error.message}));
 await page.evaluateOnNewDocument(()=>{
  const json=Response.prototype.json;Response.prototype.json=async function(...args){const value=await json.apply(this,args);if(window.__holdNextBody&&this.url.includes('/api/identity/field-operations')){window.__holdNextBody=false;window.__heldBodyEntered=true;return new Promise(resolve=>{window.__releaseBody=()=>resolve(value);});}return value;};
 });
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol)){await request.continue();return;}externalRequests.push({label,method:request.method(),host:url.hostname});await request.abort();return;}
   if(!url.pathname.startsWith('/api/')){await request.continue();return;}
   assert.match(request.headers().authorization,/^Bearer synthetic-measurement-(?:worker|director)-\d+$/);
   if(url.pathname==='/api/identity/field-media'){assert.equal(request.method(),'GET');await request.respond({status:200,contentType:voice?'audio/wav':'image/png',headers:{'Content-Length':String(voice?audio.length:png.length)},body:voice?audio:png});return;}
   assert.equal(url.pathname,'/api/identity/field-operations');const reviewer=request.headers().authorization.includes('-director-');
   let value,command;const scope=url.searchParams.get('scope')||JSON.parse(request.postData()).scope;
   assert.ok([scopeA,scopeB].includes(scope));
   if(scope===scopeB)task=taskFixture(scopeB,true);
   if(request.method()==='POST'){
    command=JSON.parse(request.postData());assert.equal(command.projectId,'project-synthetic');assert.equal(command.scope,scope);
    const reference=(await page.evaluate(s=>window.__journal.list(s),scope)).find(row=>row.operationId===command.operationId);assert.ok(reference||kind==='delayed'&&configuration?.state==='CANCELLED','Reference must commit before POST');
    requests.push({method:'POST',scope,action:command.action,operationId:command.operationId,taskId:command.payload.taskId||proposal?.taskId,durable:Boolean(reference)});
    if(command.action==='CONFIGURE_PROGRESS_MEASUREMENT'){
     assert.deepEqual(Object.keys(command.payload).sort(),['baseline','reason','revision','sourceReference','taskId','unit']);if(reference){assert.equal(reference.action,command.action);assert.equal(reference.taskId,command.payload.taskId);}
     if(kind==='delayed'&&configuration?.state==='CANCELLED'){await request.respond({status:200,contentType:'application/json',body:JSON.stringify({...configuration,replayed:true})});return;}
     originalCommand=structuredClone(command);
     if(kind==='unreserved-lost'){await request.respond({status:503,contentType:'application/json',body:JSON.stringify({saved:false,code:'FIELD_OPERATION_UNCONFIRMED'})});return;}
     if(kind==='deny'){await request.respond({status:403,contentType:'application/json',body:JSON.stringify({saved:false,code:'FIELD_PROGRESS_PERMISSION_REQUIRED'})});return;}
     task={...task,revision:nextStamp(3),measurement:{version:TASK_MEASUREMENT_VERSION,definitionId:'definition-'+task.id,baseline:command.payload.baseline,unit:command.payload.unit,executed:'0.0000',sourceReference:command.payload.sourceReference,configuredAt:fixedNow,approvedProposalId:null,approvedAt:null}};
     configuration={scope,projectId:'project-synthetic',operationId:command.operationId,action:command.action,state:'RECORDED',saved:true,kind:'MEASUREMENT_CONFIGURATION',receiptId:'field_'+sha(command.operationId),task};
     if(kind==='lost'){await request.abort('failed');return;}value=configuration;
    }else if(command.action==='CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION'){
     assert.deepEqual(Object.keys(command.payload),['taskId']);assert.equal(reference.action,'CONFIGURE_PROGRESS_MEASUREMENT');assert.equal(reference.taskId,command.payload.taskId);
     if(!configuration)configuration={scope,projectId:'project-synthetic',operationId:command.operationId,action:'CONFIGURE_PROGRESS_MEASUREMENT',state:'CANCELLED',saved:false,replayed:false,receiptId:'field_'+sha(command.operationId),kind:'MEASUREMENT_CONFIGURATION_CANCELLED',taskId:command.payload.taskId,taskProgressUnchanged:true};value=configuration;
    }else if(command.action==='PROPOSE_PROGRESS'){
     assert.deepEqual(Object.keys(command.payload).sort(),['evidenceIds','measurement','reason','revision','taskId','workerId']);assert.deepEqual(Object.keys(command.payload.measurement).sort(),['mode','quantity']);
     const derived=deriveTaskMeasurement(task,command.payload.measurement);proposal={id:'proposal-synthetic',revision:nextStamp(4),summary:task.title+' · '+derived.progress+'%',status:'PENDING',statusStored:'PENDING',expiresAt:'2026-10-19T12:00:00.000Z',taskId:task.id,workerId:'worker-synthetic',progress:derived.progress,quantity:derived.executed,baseline:derived.baseline,unit:derived.unit,reason:command.payload.reason,evidenceIds:command.payload.evidenceIds,measurement:derived,result:null};
     value={scope,saved:true,receiptId:'field_'+sha(command.operationId),kind:'PROGRESS_PROPOSAL',proposal,taskUnchanged:true};
    }else if(command.action==='DECIDE_PROGRESS'){
     assert.ok(reviewer,'An independent reviewer must decide');assert.equal(command.payload.proposalId,proposal.id);
     const snapshot=proposal.measurement;task={...task,status:snapshot.progress===100?'DONE':'IN_PROGRESS',progress:snapshot.progress,revision:nextStamp(5),measurement:{...task.measurement,executed:snapshot.executed,approvedProposalId:proposal.id,approvedAt:fixedNow}};proposal={...proposal,status:'APPLIED',statusStored:'APPLIED',revision:nextStamp(6),result:{decision:'APPROVE',reason:command.payload.reason,recordedAt:fixedNow}};
     value={scope,saved:true,receiptId:'field_'+sha(command.operationId),kind:'PROGRESS_DECISION',proposal,task};
    }else throw new Error('Unsupported mutation '+command.action);
   }else{
    assert.equal(request.method(),'GET');requests.push({method:'GET',scope,operationId:url.searchParams.get('operationId')});
    if(url.searchParams.has('operationId'))value=kind==='unknown'||!configuration?{scope,projectId:'project-synthetic',operationId:url.searchParams.get('operationId'),state:'NOT_OBSERVED',definitive:false}:configuration;
    else if(url.searchParams.has('proposalId'))value={scope,projectId:'project-synthetic',proposalId:proposal.id,proposalRevision:proposal.revision,evidence:[evidenceFixture(task,voice)]};
    else if(url.searchParams.has('reviewSection')){const section=url.searchParams.get('reviewSection'),records=section==='PROGRESS'?(proposal?[proposal]:[]):[evidenceFixture(task,voice)];value={scope,projectId:'project-synthetic',reviewAccessStamp:'c'.repeat(64),reviewSection:section,reviewFilter:url.searchParams.get('reviewFilter'),afterReview:null,reviewId:url.searchParams.get('reviewId'),records,total:records.length,nextCursor:null,canReview:true,canApproveProgress:reviewer};}
    else value=fieldSnapshot(scope,task,proposal,reviewer,voice);
   }
   assert.ok(value,'No synthetic response prepared');await request.respond({status:200,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(value)});
  }catch(error){interceptErrors.push({label,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});
 await page.evaluate((task,allowed)=>window.__fixture({task,allowed}),task,allowed);await waitText(page,task.title);return {page,context,requests,setKind:value=>{kind=value;},getTask:()=>structuredClone(task),getProposal:()=>structuredClone(proposal),getOriginal:()=>structuredClone(originalCommand)};
}
async function configure(state){
 await click(state.page,'Definir base de medición');await fill(state.page,'Cantidad base','200');await fill(state.page,'Unidad','M2');await fill(state.page,'Fuente de la cantidad base','Fuente sintética revisada');await fill(state.page,'Motivo','Base comprobada para esta prueba sintética.');await check(state.page,'Revisé la cantidad, la unidad y su fuente');await click(state.page,'Guardar base con recibo');
}
async function startProposal(state,mode='DELTA',quantity='50'){
 await click(state.page,'Abrir operaciones');await waitText(state.page,'Avance');await click(state.page,'Avance');await click(state.page,'Proponer avance');await fill(state.page,'Alcance de la cantidad',mode);await fill(state.page,'Cantidad medida (m²)',quantity);await check(state.page,'Imagen sintética revisada');await fill(state.page,'Fundamento','Medición sintética comprobada en el sector de prueba.');await check(state.page,'Revisé la cantidad, su alcance y el acumulado');
}
async function viewportScenario(width){
 const state=await makePage('viewport-'+width,{width});try{
  await configure(state);await state.page.waitForFunction(()=>!document.querySelector('[data-measurement-editor]'));await waitText(state.page,'0 / 200 m²');const configLayout=await layout(state.page,width);
  await startProposal(state);await waitText(state.page,'Acumulado propuesto');const proposalLayout=await layout(state.page,width);assert.ok((await textOf(state.page,'[data-task-measurement]')).includes('0 / 200'));
  await state.page.screenshot({path:path.join(screenshots,width+'-proposal.png'),fullPage:true});await click(state.page,'Guardar con recibo');await waitText(state.page,'Operación guardada con recibo');assert.equal(state.getTask().progress,0);assert.equal(state.getProposal().status,'PENDING');
  await state.page.evaluate(()=>window.__reviewer());await click(state.page,'Abrir operaciones');await click(state.page,'Avance');await click(state.page,'Decidir propuesta');await waitText(state.page,'Revisar propuesta y evidencia');await state.page.waitForFunction(()=>document.querySelector('form textarea'));
  await fill(state.page,'Fundamento','Decisión sintética independiente con evidencia revisada.');
  await state.page.$$eval('form input[type=checkbox]',nodes=>nodes.filter(node=>!node.disabled&&!node.checked).forEach(node=>node.click()));await click(state.page,'Guardar con recibo');await waitText(state.page,'50 / 200 m²','[data-task-measurement]');assert.equal(state.getTask().progress,25);assert.equal(state.getProposal().status,'APPLIED');
  await state.page.screenshot({path:path.join(screenshots,width+'-approved.png'),fullPage:true});assert.ok((await textOf(state.page,'[data-gantt-measurement]')).includes('50 / 200'));
  checks.push({check:'define-daily-propose-independent-approve-gantt',width,configLayout,proposalLayout,mutations:state.requests.filter(row=>row.method==='POST')});
 }finally{await state.context.close();}
}
async function uncertaintyScenario(){
 const state=await makePage('configuration-uncertainty');try{
  state.setKind('lost');await configure(state);await state.page.waitForFunction(()=>[...document.querySelectorAll('[data-measurement-editor] button')].some(node=>node.textContent==='Comprobar la base guardada'&&!node.disabled));const original=state.requests.find(row=>row.method==='POST');assert.equal((await references(state.page))[0].operationId,original.operationId);
  state.setKind('unknown');await click(state.page,'Comprobar la base guardada');await waitText(state.page,'Todavía no se observa');assert.equal(state.requests.filter(row=>row.method==='POST').length,1);
  await click(state.page,'Cerrar y conservar el intento');await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Operaciones por comprobar');assert.equal(state.requests.filter(row=>row.method==='POST').length,1);
  state.setKind('ready');await click(state.page,'Comprobar recibo');await waitText(state.page,'0 / 200 m²');await state.page.waitForFunction(async()=>!(await window.__journal.list('a'.repeat(64))).length);assert.equal(state.requests.filter(row=>row.method==='POST').length,1);
  checks.push({check:'lost-configuration-readonly-recovery-reload-no-repeat-post',requests:state.requests});
 }finally{await state.context.close();}
}
async function denialScenario(){
 const state=await makePage('configuration-role-denial');try{
  state.setKind('deny');await configure(state);await waitText(state.page,'Tu acceso cambió');const content=await textOf(state.page,'[data-measurement-editor]');assert.ok(!content.includes('Revoque sintético')&&!content.includes('Fuente sintética revisada')&&!content.includes('200'));assert.equal(await state.page.$$eval('[data-measurement-editor] input,[data-measurement-editor] textarea,[data-measurement-editor] select',nodes=>nodes.length),0);assert.equal((await references(state.page)).length,1);
  await click(state.page,'Cerrar y conservar la referencia');await state.page.waitForFunction(()=>!document.querySelector('[data-measurement-editor]'));checks.push({check:'denied-editor-redacts-fields-source-title-preserves-reference'});
 }finally{await state.context.close();}
}
async function taskChangeScenario(){
 const state=await makePage('task-change',{configured:true,executed:'30.0000'});try{
  await startProposal(state);const counts=await state.page.$$eval('form label',nodes=>nodes.filter(node=>node.firstChild?.textContent.trim()==='Tarea').length);assert.equal(counts,1);
  await fill(state.page,'Tarea','task-synthetic-a-units');const values=await state.page.$eval('form',form=>({mode:[...form.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value==='DELTA'))?.value,quantity:[...form.querySelectorAll('input')].find(node=>node.inputMode==='decimal')?.value,reason:form.querySelector('textarea')?.value,checked:[...form.querySelectorAll('input[type=checkbox]')].filter(node=>node.checked).length}));assert.deepEqual(values,{mode:'',quantity:'',reason:'',checked:0});assert.equal(state.requests.filter(row=>row.method==='POST').length,0);checks.push({check:'single-task-selector-clears-measurement-and-evidence-context'});
 }finally{await state.context.close();}
}
async function voiceScenario(){
 const state=await makePage('voice-reference',{configured:true,executed:'30.0000',voice:true});try{
  await click(state.page,'Abrir operaciones');await click(state.page,'Evidencia');await click(state.page,'Revisar borrador de avance');const values=await state.page.$eval('form',form=>({mode:[...form.querySelectorAll('select')].find(node=>[...node.options].some(option=>option.value==='DELTA'))?.value,quantity:[...form.querySelectorAll('input')].find(node=>node.inputMode==='decimal')?.value}));assert.deepEqual(values,{mode:'',quantity:''});assert.equal(state.requests.filter(row=>row.method==='POST').length,0);checks.push({check:'audio-reference-never-prefills-or-sums-quantity'});
 }finally{await state.context.close();}
}
async function lateScenario(kind){
 const state=await makePage('late-'+kind);try{
  await click(state.page,'Definir base de medición');await fill(state.page,'Cantidad base','200');await fill(state.page,'Unidad','M2');await fill(state.page,'Fuente de la cantidad base','Fuente sintética revisada');await fill(state.page,'Motivo','Base comprobada para esta prueba sintética.');await check(state.page,'Revisé la cantidad, la unidad y su fuente');await state.page.evaluate(()=>{window.__holdNextBody=true;});await click(state.page,'Guardar base con recibo');await state.page.waitForFunction(()=>window.__heldBodyEntered===true);
  if(kind==='scope'){await state.page.evaluate(()=>window.__scope());await state.page.waitForFunction(()=>window.__effectScope==='b'.repeat(64)&&window.__effectEditing===false);}else{await state.page.evaluate(()=>window.__token());await state.page.waitForFunction(()=>window.__effectEpoch===1&&window.__effectEditing===false);}await state.page.evaluate(()=>window.__releaseBody());await wait(160);assert.ok(!(await textOf(state.page)).includes('Fuente sintética revisada'));assert.equal(state.requests.filter(row=>row.method==='POST').length,1);assert.equal((await references(state.page)).length,1);checks.push({check:'late-configuration-response-discarded-after-'+kind});
 }finally{await state.context.close();}
}
async function cancellationScenario(){
 const state=await makePage('unreserved-cancellation');try{
  state.setKind('unreserved-lost');await configure(state);await state.page.waitForFunction(()=>[...document.querySelectorAll('[data-measurement-editor] button')].some(node=>node.textContent==='Comprobar la base guardada'&&!node.disabled));assert.equal(await state.page.$$eval('[data-measurement-editor] button',nodes=>nodes.filter(node=>node.textContent==='Cerrar intento pendiente').length),0);
  await state.page.evaluate(()=>{window.__failNextToken=true;});await click(state.page,'Comprobar la base guardada');await state.page.waitForFunction(()=>[...document.querySelectorAll('[data-measurement-editor] button')].some(node=>node.textContent==='Comprobar la base guardada'&&!node.disabled));assert.equal((await references(state.page)).length,1);assert.equal(state.requests.filter(row=>row.method==='POST').length,1);
  await click(state.page,'Comprobar la base guardada');await waitText(state.page,'Todavía no se observa');await state.page.evaluate(()=>{window.__failNextToken=true;});await click(state.page,'Cerrar intento pendiente');await state.page.waitForFunction(()=>[...document.querySelectorAll('[data-measurement-editor] button')].some(node=>node.textContent==='Comprobar la base guardada'&&!node.disabled));assert.equal((await references(state.page)).length,1);assert.equal(state.requests.filter(row=>row.method==='POST').length,1);
  await click(state.page,'Cerrar y conservar el intento');await state.page.reload({waitUntil:'networkidle0'});await waitText(state.page,'Operaciones por comprobar');await click(state.page,'Comprobar recibo');await waitText(state.page,'Cerrar intento pendiente');await click(state.page,'Cerrar intento pendiente');await waitText(state.page,'Intento cerrado con recibo');await state.page.waitForFunction(async()=>!(await window.__journal.list('a'.repeat(64))).length);
  const commands=state.requests.filter(row=>row.method==='POST');assert.equal(commands.length,2);assert.equal(commands[0].operationId,commands[1].operationId);assert.equal(commands[1].action,'CANCEL_PROGRESS_MEASUREMENT_CONFIGURATION');assert.equal(state.getTask().progress,0);assert.equal(state.getTask().measurement,undefined);
  state.setKind('delayed');const result=await state.page.evaluate(async command=>{const response=await fetch('/api/identity/field-operations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic-measurement-worker-0'},body:JSON.stringify(command)});return response.json();},state.getOriginal());assert.equal(result.state,'CANCELLED');assert.equal(result.taskProgressUnchanged,true);assert.equal(state.getTask().measurement,undefined);
  checks.push({check:'same-uuid-cancel-after-absent-read-reload-and-delayed-original-cannot-change-task',mutations:state.requests.filter(row=>row.method==='POST'),syntheticDelayedRequestOnly:true});
 }finally{await state.context.close();}
}
async function cumulativeScenario(){
 const state=await makePage('cumulative',{configured:true,executed:'30.0000'});try{
  await startProposal(state,'CUMULATIVE','80');await state.page.waitForFunction(()=>document.querySelector('[data-measurement-preview]')?.innerText.includes('80 / 200'));assert.equal(state.requests.filter(row=>row.method==='POST').length,0);
  await fill(state.page,'Cantidad medida (m²)','29');await wait(80);assert.ok((await textOf(state.page,'[data-measured-proposal]')).includes('no puede ser menor'),await textOf(state.page,'[data-measured-proposal]'));assert.equal(await state.page.$eval('form button[type=submit]',node=>node.disabled),true);assert.equal(state.requests.filter(row=>row.method==='POST').length,0);
  await fill(state.page,'Cantidad medida (m²)','80');await check(state.page,'Revisé la cantidad, su alcance y el acumulado');await click(state.page,'Guardar con recibo');await waitText(state.page,'Operación guardada con recibo');assert.equal(state.getProposal().measurement.previous,'30.0000');assert.equal(state.getProposal().measurement.delta,'50.0000');assert.equal(state.getProposal().measurement.executed,'80.0000');assert.equal(state.getTask().measurement.executed,'30.0000');checks.push({check:'cumulative-preview-regression-block-and-pending-task-unchanged'});
 }finally{await state.context.close();}
}

try {
  for(const entry of ['schedule-workbench.js','task-progress-measurement-editor.js','field-operations-panel.js','workspace-recovery-panel.js'])copyClosure('src/app/(identity)/cuenta/'+entry);
  const app = path.join(fixture,'src/app');
  writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-task-progress-measurement-ui',private:true}));
  writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};\n`);
  writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#0b1526',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
  writeFileSync(path.join(app,'page.js'),"'use client';\nimport {useCallback,useEffect,useState} from 'react';\nimport {ScheduleWorkbench} from './(identity)/cuenta/schedule-workbench';\nimport {TaskProgressMeasurementEditor} from './(identity)/cuenta/task-progress-measurement-editor';\nimport {FieldOperationsPanel} from './(identity)/cuenta/field-operations-panel';\nimport {WorkspaceRecoveryPanel} from './(identity)/cuenta/workspace-recovery-panel';\nimport {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';\nexport default function Page(){\n const [scope,setScope]=useState('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),[task,setTask]=useState({id:'task-synthetic-a',title:'Revoque sintético A',status:'BACKLOG',progress:0,startsOn:'2026-10-12',endsOn:'2026-10-24',revision:'2026-10-12T10:00:00.000001'}),[allowed,setAllowed]=useState(true),[editing,setEditing]=useState(false),[reviewer,setReviewer]=useState(false),[epoch,setEpoch]=useState(0);\n const token=useCallback(async()=> {if(window.__failNextToken){window.__failNextToken=false;throw new Error('synthetic token unavailable');}return 'synthetic-measurement-'+(reviewer?'director':'worker')+'-'+epoch;},[reviewer,epoch]);\n useEffect(()=>{window.__effectScope=scope;window.__effectEpoch=epoch;window.__effectEditing=editing;},[scope,epoch,editing]);\n const sibling={...task,id:task.id+'-units',title:'Colocación sintética por unidades',progress:0,status:'BACKLOG',measurement:{version:'task-progress-measurement-v1',definitionId:'definition-units',baseline:'1000.0000',unit:'UNIT',executed:'0.0000',sourceReference:'Cómputo sintético de unidades',configuredAt:'2026-10-12T12:00:00.000Z',approvedProposalId:null,approvedAt:null}};\n if(typeof window!=='undefined'){window.__journal=browserRecoveryJournal;window.__fixture=value=>{setTask(value.task);setAllowed(value.allowed);};window.__reviewer=()=>setReviewer(true);window.__scope=()=>{setScope('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');setTask({...task,id:'task-synthetic-b',title:'Revoque sintético B'});setEditing(false);};window.__token=()=>{setEpoch(value=>value+1);setEditing(false);};}\n return <main data-fixture=\"TASK_MEASUREMENT_FIXTURE\" style={{maxWidth:1080,margin:'0 auto',minWidth:0}}>\n  <WorkspaceRecoveryPanel key={'recovery:'+scope} scope={scope} projects={[{id:'project-synthetic',name:'Obra sintética'}]} getSessionToken={token} onRecovered={value=>{if(value.task)setTask(value.task);}}/>\n  <ScheduleWorkbench tasks={[task,sibling]} totalTasks={2} canPlan={false} canConfigureMeasurement={allowed} locked={editing} onConfigureMeasurement={()=>setEditing(true)}/>\n  {editing&&<TaskProgressMeasurementEditor key={scope} task={task} scope={scope} projectId=\"project-synthetic\" allowed={allowed} getSessionToken={token} onClose={()=>setEditing(false)} onChanged={setTask}/>}\n  <FieldOperationsPanel key={scope+':'+reviewer+':'+epoch} scope={scope} projectId=\"project-synthetic\" tasks={[task,sibling]} getSessionToken={token} onTasksChanged={setTask}/>\n </main>;\n}");
  const port = await freePort(),nonce = randomUUID(),childFile = path.join(fixture,'owned-server.cjs');origin = 'http://127.0.0.1:'+port;
  // Own one IPC child and its HTTP server directly. Next's custom server close
  // drains its bundler resources; no CLI watcher, PID lookup or tree stop exists.
  writeFileSync(childFile,`const {createServer}=require('node:http');const next=require(${JSON.stringify(path.join(root,'node_modules/next'))});const nonce=${JSON.stringify(nonce)};let app,server,closing=false;let ready;async function close(){if(closing)return;closing=true;try{await ready.catch(()=>{});if(server?.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}if(app)await app.close();if(process.connected)process.send({type:'closed',nonce},()=>process.exit(0));else process.exit(0);}catch{if(process.connected)process.send({type:'close-failed',nonce},()=>process.exit(1));else process.exit(1);}}process.on('message',message=>{if(message&&Object.keys(message).sort().join('|')==='nonce|type'&&message.type==='close'&&message.nonce===nonce)void close();});process.on('disconnect',()=>void close());process.on('SIGTERM',()=>void close());ready=(async()=>{server=createServer((req,res)=>app.getRequestHandler()(req,res));app=next({dev:true,dir:${JSON.stringify(fixture)},hostname:'127.0.0.1',port:${port},httpServer:server,webpack:true,turbopack:false});await app.prepare();server.on('upgrade',(req,socket,head)=>app.getUpgradeHandler()(req,socket,head));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(${port},'127.0.0.1',resolve);});if(process.connected)process.send({type:'ready',nonce});})();ready.catch(error=>{console.error(error);process.exitCode=1;if(process.connected)process.send({type:'failed',nonce});});`);
  const serverEnv = Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','ComSpec','COMSPEC'].filter(key => process.env[key] !== undefined).map(key => [key,process.env[key]]));
  child = spawn(process.execPath,[childFile],{cwd:fixture,env:{...serverEnv,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'development'},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  child.__closeNonce = nonce;
  childClose = new Promise(resolve => child.once('close',resolve));
  for (const stream of [child.stdout,child.stderr]) stream.on('data',chunk => {serverLog = (serverLog+chunk.toString()).slice(-20000);});
  child.on('message',message => {if (message?.nonce === nonce && message.type === 'closed') closeAck = true;});
  await bounded(new Promise((resolve,reject) => {child.once('error',reject);child.on('message',message => {if (message?.nonce !== nonce) return;if (message.type === 'ready') resolve();if (message.type === 'failed') reject(new Error('Owned fixture preparation failed'));});child.once('exit',() => reject(new Error('Owned fixture exited before readiness')));}), 'Owned fixture readiness timed out',90000);
  const response = await fetch(origin,{signal:AbortSignal.timeout(60000)});assert.ok(response.ok && (await response.text()).includes('TASK_MEASUREMENT_FIXTURE'));
  const runnerArgs = process.env.GITHUB_ACTIONS === 'true' && process.platform === 'linux'?['--no-sandbox','--disable-setuid-sandbox']:[];
  browser = await puppeteer.launch({headless:true,args:[...runnerArgs,'--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-sync','--metrics-recording-only','--no-first-run','--disable-features=MediaRouter']});

  for(const width of [320,390,768,1280])await viewportScenario(width);
  await uncertaintyScenario();await denialScenario();await taskChangeScenario();await voiceScenario();await cancellationScenario();await cumulativeScenario();for(const kind of ['scope','token-getter'])await lateScenario(kind);
  assert.deepEqual(pageErrors,[]);assert.deepEqual(interceptErrors,[]);assert.deepEqual(externalRequests,[]);
  for(const source of sourceManifest)assert.equal(sha(readFileSync(path.join(root,source.path))),source.sha256,'Dependency changed while rendering');
  assert.equal(git(['rev-parse','HEAD']),sourceRevision,'Source HEAD changed while rendering');
}catch(error){failure=error;}
finally{
 try{if(browser)await bounded(browser.close(),'Owned browser close timed out');browserClosed=true;}catch(error){failure ||=error;}
 try{
  if(!child)serverClosed=true;
  else{if(child.exitCode===null&&child.signalCode===null&&child.connected)child.send({type:'close',nonce:child.__closeNonce});await bounded(childClose,'Owned fixture close timed out');serverClosed=closeAck&&child.exitCode===0;assert.ok(serverClosed,'Owned server close acknowledgment required');}
 }catch(error){failure ||=error;}
 try{fixtureCleanupProof=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:serverClosed});assert.ok(fixtureCleanupProof.fixtureRemoved);}catch(error){failure ||=error;fixtureCleanupProof=error.cleanupProof;}
}
const target=process.argv[2]?path.resolve(process.argv[2]):path.join(output,'browser-'+runId+'.json');
assert.ok(inside(target,output),'Evidence must stay within task-progress-measurement-evidence');
const proof={status:failure?'FAILED':'PASS',recordedAt:new Date().toISOString(),runId,sourceRevision,sourceTree,sourceState:trackedClean?'clean':'working-tree',trackedClean,environment:'isolated-localhost-next-exact-jsx-synthetic-api',widths:[320,390,768,1280],checks,sourceManifest,externalImports:[...externalImports].sort(),harnessSha256,cleanupHelperSha256,pageErrors,interceptErrors,externalRequests,cleanup:{browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:fixtureCleanupProof?.fixtureRemoved===true,fixtureCleanupProof},productionLoginVerified:false,productionDataWritten:false,providerRequests:0,physicalDeviceAccepted:false,...(failure?{failure:failure.message,serverLog}:{})};
writeFileSync(target,JSON.stringify(proof,null,2),{flag:'wx'});console.log(JSON.stringify({status:proof.status,evidence:path.relative(root,target).split(path.sep).join('/'),checks:checks.length,widths:proof.widths,cleanup:proof.cleanup}));if(failure)throw failure;

