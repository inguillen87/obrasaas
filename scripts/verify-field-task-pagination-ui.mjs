import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,lstatSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {captureOwnedFixture,removeOwnedFixture} from './lib/owned-fixture-cleanup.mjs';
import {inventoryQuery,inventorySnapshot} from '../src/app/(identity)/cuenta/material-inventory-view.mjs';

export const FIELD_TASK_PAGE_WIDTHS=Object.freeze([320,390,1440]);
export const FIELD_TASK_PAGE_MODES=Object.freeze(['evidence','progress','material-request','consumption']);
const entries=['src/app/(identity)/cuenta/field-operations-panel.js','src/app/(identity)/cuenta/material-inventory-panel.js','src/app/(identity)/cuenta/workspace-task-page.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const guard=(condition,message)=>{if(!condition)throw new Error(message);};

export function fieldTaskPaginationSourceClosure(readSource){
 const files=new Set(),external=new Set();
 function visit(file){
  guard(file.startsWith('src/')&&path.posix.normalize(file)===file&&!/[\\\0]/.test(file),'Unsafe fixture dependency');
  if(files.has(file))return;const bytes=readSource(file);guard(Buffer.isBuffer(bytes),'Missing actual fixture dependency '+file);files.add(file);
  if(file.endsWith('.css')){guard(!/@import\b|url\(\s*['"]?https?:/i.test(bytes.toString('utf8')),'External fixture CSS');return;}
  const tree=parse(bytes.toString('utf8'),{sourceType:'module',plugins:['jsx']}),refs=[];
  function walk(node){if(!node||typeof node!=='object')return;
   if(['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)refs.push(node.source.value);
   if(node.type==='CallExpression'&&node.callee?.type==='Import'){guard(node.arguments.length===1&&node.arguments[0].type==='StringLiteral','Computed fixture import');refs.push(node.arguments[0].value);}
   for(const [key,value]of Object.entries(node)){if(['loc','start','end','extra','comments'].includes(key))continue;if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
  }
  walk(tree);
  for(const ref of refs){
   guard(typeof ref==='string'&&!/^(?:https?:|file:|data:)/.test(ref),'Remote executable fixture dependency');
   if(!ref.startsWith('.')&&!ref.startsWith('@/')){external.add(ref);continue;}
   const base=ref.startsWith('@/')?'src/'+ref.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));
   const dependency=[base,base+'.js',base+'.mjs',base+'.css'].find(candidate=>readSource(candidate)!==null);
   guard(Boolean(dependency),'Missing dependency '+ref);visit(dependency);
  }
 }
 entries.forEach(visit);return{files:[...files].sort(),externalImports:[...external].sort()};
}

const deadline=async(promise,label,ms)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]);}finally{clearTimeout(timer);}};
async function freePort(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}

// The host below is wired to the production pager factory. Only its canonical
// input snapshot and consumer mounting are fixture code, not a second pager.
function fixturePageSource(){
 return `'use client';
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {FieldOperationsPanel} from './(identity)/cuenta/field-operations-panel';
import {MaterialInventoryPanel} from './(identity)/cuenta/material-inventory-panel';
import {useWorkspaceRequest} from './(identity)/cuenta/workspace-request-lifecycle';
import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';
import {createWorksiteTaskPager} from './(identity)/cuenta/workspace-task-page.mjs';
import {mergeLoadedTasks} from './(identity)/cuenta/schedule-workbench.mjs';
const scope='a'.repeat(64),projectId='project-page-fixture',revision='2026-10-16T12:00:00.000001';
const tasks=Array.from({length:205},(_,index)=>({id:'task-'+String(index+1).padStart(4,'0'),title:'Partida sintética '+(index+1),status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision}));
export default function Page(){
 const token=useCallback(async()=>'controlled-task-page-token',[]),transport=useWorkspaceRequest(token);
 const request=useCallback((query,options)=>transport('/api/identity/workspace'+query,options,async response=>{const value=await response.json();if(!response.ok)throw Object.assign(new Error('No pudimos consultar más tareas.'),{status:response.status,code:value?.code});return value;}),[transport]);
 const [rows,setRows]=useState(tasks.slice(0,100)),[paging,setPaging]=useState({totalTasks:205,nextCursor:'task-0100',loading:false,error:null}),[pending,setPending]=useState(false),[readBusy,setReadBusy]=useState(false),[shown,setShown]=useState(true),[mode,setMode]=useState('');
 const current=useRef(null);current.current={scope,projectId,role:'ADMIN',generation:1,cursor:paging.nextCursor,blocked:readBusy,officeReviewOnly:false};
 const onPending=useCallback(value=>setPending(value),[]),onTaskReadBusy=useCallback(value=>setReadBusy(value),[]);
 // The production factory owns cursor, authority-context and late-read checks.
 const pager=useRef(null);
 useLayoutEffect(()=>{const value=createWorksiteTaskPager({request,getContext:()=>current.current,onState:value=>setPaging(previous=>({...previous,...value})),onPage:value=>{setRows(previous=>mergeLoadedTasks(previous,value.tasks));setPaging(previous=>({...previous,totalTasks:value.totalTasks,nextCursor:value.nextCursor}));},onAccessRejected:()=>setShown(false)});pager.current=value;return()=>{if(pager.current===value)pager.current=null;value.dispose();};},[request]);
 useEffect(()=>{setMode(new URLSearchParams(location.search).get('mode')||'progress');window.__taskReferences=()=>browserRecoveryJournal.list(scope);window.__forceTaskPage=()=>pager.current?.loadMore();window.__unmountTaskPage=()=>{pager.current?.dispose();setShown(false);};},[]);
 return <main style={{maxWidth:1000,margin:'auto'}}><button data-context-switch disabled={pending||paging.loading}>Cambiar obra de ensayo</button>{shown&&(mode==='consumption'?<MaterialInventoryPanel projectId={projectId} scope={scope} tasks={rows} taskPaging={paging} onLoadMoreTasks={()=>pager.current?.loadMore()} onTaskReadBusy={onTaskReadBusy} onPending={onPending} getSessionToken={token}/>:mode&&<FieldOperationsPanel projectId={projectId} scope={scope} tasks={rows} taskPaging={paging} onLoadMoreTasks={()=>pager.current?.loadMore()} onTaskReadBusy={onTaskReadBusy} onPending={onPending} getSessionToken={token}/>)}</main>;
}`;
}

export function fieldTaskPaginationUiCiOptions(args,{environment={}}={}){
 guard(!environment.VERCEL&&!environment.VERCEL_ENV,'Owned browser fixture cannot use a deployed environment');
 guard(Array.isArray(args),'Explicit browser arguments required');
 if(args.length===0){guard(environment.CI!=='true'&&environment.GITHUB_ACTIONS!=='true'&&!environment.GITHUB_RUN_ID,'CI requires its explicit authenticated entry point');return{ci:false,expectedHead:null,ciRun:null};}
 guard(args.length===3&&args[0]==='--ci'&&args[1]==='--expected-head'&&/^[a-f0-9]{40}$/.test(args[2]),'Exact --ci --expected-head arguments required');
 guard(environment.CI==='true'&&environment.GITHUB_ACTIONS==='true','The CI entry point requires the actual GitHub Actions environment');
 const workflow='.github/workflows/workspace-acceptance.yml',repository='inguillen87/obrasaas',ref=environment.GITHUB_REF;
 guard(environment.GITHUB_REPOSITORY===repository&&environment.GITHUB_JOB==='field'&&['push','workflow_dispatch'].includes(environment.GITHUB_EVENT_NAME),'Only the current field acceptance lane can issue CI browser evidence');
 guard(typeof ref==='string'&&/^refs\/heads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref)&&!ref.includes('..')&&environment.GITHUB_WORKFLOW_REF===repository+'/'+workflow+'@'+ref,'Exact workflow and branch identity required');
 guard(environment.GITHUB_SHA===args[2],'The expected source must equal the actual workflow event SHA');
 for(const key of ['GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'])guard(/^[1-9]\d*$/.test(environment[key]||'')&&Number.isSafeInteger(Number(environment[key])),'A canonical current run and attempt are required');
 return{ci:true,expectedHead:args[2],ciRun:{repository,workflow,runId:Number(environment.GITHUB_RUN_ID),runAttempt:Number(environment.GITHUB_RUN_ATTEMPT),event:environment.GITHUB_EVENT_NAME,job:'field'}};
}

export async function verifyFieldTaskPaginationUi({args=process.argv.slice(2),environment=process.env}={}){
 const options=fieldTaskPaginationUiCiOptions(args,{environment});
 const root=realpathSync(process.cwd()),readSource=file=>{const name=path.join(root,file);return existsSync(name)&&lstatSync(name).isFile()?readFileSync(name):null;};
 const closure=fieldTaskPaginationSourceClosure(readSource),sourcePaths=[...new Set([...closure.files,'package.json','package-lock.json','scripts/verify-field-task-pagination-ui.mjs','scripts/lib/owned-fixture-cleanup.mjs'])].sort(),sourceManifest=sourcePaths.map(path=>({path,sha256:sha(readSource(path))}));
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim(),tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
 const assertCiSource=()=>{if(!options.ci)return;guard(head===options.expectedHead&&execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()===head&&execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()===tree&&execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8',windowsHide:true})==='','CI requires the exact clean current commit and tree');for(const row of sourceManifest)guard(readSource(row.path).equals(execFileSync('git',['show',head+':'+row.path],{cwd:root,windowsHide:true})),'Every executed CI source must equal its current Git blob: '+row.path);};assertCiSource();
 const privateRoot=path.join(root,'.vercel/private');mkdirSync(privateRoot,{recursive:true});
 const outputRoot=path.join(privateRoot,'field-task-pagination-ui-evidence');mkdirSync(outputRoot,{recursive:true});const output=mkdtempSync(path.join(outputRoot,'run-'));
 const prefix='field-task-pagination-ui-',fixture=mkdtempSync(path.join(privateRoot,prefix)),ownership=captureOwnedFixture({workspaceRoot:root,privateRoot,fixture,prefix}),app=path.join(fixture,'src/app');
 for(const file of closure.files){const destination=path.join(fixture,file);mkdirSync(path.dirname(destination),{recursive:true});copyFileSync(path.join(root,file),destination);assert.deepEqual(readFileSync(destination),readSource(file));}
 writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true,name:'owned-field-task-pagination-ui'}));
 writeFileSync(path.join(fixture,'next.config.mjs'),'export default {agentRules:false,devIndicators:false,experimental:{externalDir:true}};');
 writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f0f4f7',fontFamily:'Arial,sans-serif'}}>{children}</body></html>;}`);
 writeFileSync(path.join(app,'page.js'),fixturePageSource());
 const imagePath=path.join(fixture,'synthetic-geometric.png');writeFileSync(imagePath,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl7nWQAAAAASUVORK5CYII=','base64'));
 const port=await freePort(),origin='http://127.0.0.1:'+port,nonce=randomUUID(),serverFile=path.join(fixture,'owned-server.cjs');
 writeFileSync(serverFile,`const {createServer}=require('node:http');const next=require(${JSON.stringify(path.join(root,'node_modules/next'))});const nonce=${JSON.stringify(nonce)};let app,server,closing=false,ready;async function close(){if(closing)return;closing=true;try{await ready.catch(()=>{});if(server?.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}if(app)await app.close();if(process.connected)process.send({type:'closed',nonce},()=>process.exit(0));else process.exit(0);}catch{process.exit(1);}}process.on('message',message=>{if(message?.type==='close'&&message.nonce===nonce)void close();});process.on('disconnect',()=>void close());ready=(async()=>{server=createServer((req,res)=>app.getRequestHandler()(req,res));app=next({dev:true,dir:${JSON.stringify(fixture)},hostname:'127.0.0.1',port:${port},httpServer:server,webpack:true,turbopack:false});await app.prepare();server.on('upgrade',(req,socket,head)=>app.getUpgradeHandler()(req,socket,head));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(${port},'127.0.0.1',resolve);});process.send({type:'ready',nonce});})();ready.catch(error=>{console.error(error);process.send({type:'failed',nonce});});`);
 let child,childClose,browser,closeAck=false,serverClosed=false,browserClosed=false,cleanupProof,failure,serverLog='';const checks=[],requests=[],errors=[],screenshots=[],mediaActions=[];
 const scope='a'.repeat(64),projectId='project-page-fixture',revision='2026-10-16T12:00:00.000001',rows=Array.from({length:205},(_,index)=>({id:'task-'+String(index+1).padStart(4,'0'),title:'Partida sintética '+(index+1),status:'BACKLOG',progress:0,startsOn:null,endsOn:null,revision}));
 const baseData={scope,projectId,projectRevision:revision,configurationRevision:'config-fixture',canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[{id:'worker-fixture',name:'Participante sintético',canAttendance:true,canReport:true}],workers:[{id:'worker-fixture',name:'Participante sintético'}],sectors:[{id:'sector-fixture',name:'Sector sintético',latitude:0,longitude:0,radius:100}],attendance:[],evidence:[],proposals:[],incidents:[],materialRequests:[],truncated:false,reviewAccessStamp:'b'.repeat(64)};
 const inventory={version:1,catalogVersion:1,catalogHash:'c'.repeat(64),catalogLimit:200,canManage:true,materials:[{id:'material-fixture',name:'Material sintético',unit:'bolsa',active:true,balance:'50.000'}],consumptions:[],consumptionsTruncated:false,nextConsumptionCursor:null,movements:[],nextMovementCursor:null,adjustments:[],nextAdjustmentCursor:null,priorReceipts:[],priorReceiptsTruncated:false};
 async function click(page,label){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(node=>node.textContent.trim()===text&&node.getClientRects().length&&!node.disabled),{timeout:20000},label);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text&&node.getClientRects().length),label);assert.ok(handle.asElement(),'Missing button '+label);assert.equal(await handle.evaluate(node=>node.disabled),false,'Disabled '+label);if(label==='Cargar más tareas'){await handle.asElement().focus();await page.keyboard.press('Enter');}else await handle.asElement().click();await handle.dispose();}
 async function field(page,label,value){const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('form label')].find(node=>[...node.childNodes].filter(child=>child.nodeType===3).map(child=>child.textContent).join('').trim()===text)?.querySelector('input,textarea,select'),label);assert.ok(handle.asElement(),'Missing field '+label);const tag=await handle.evaluate(node=>node.tagName);if(tag==='SELECT')await handle.asElement().select(value);else{await handle.asElement().click();await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');if(value)await handle.asElement().type(value);}assert.equal(await handle.evaluate(node=>node.value),value);await handle.dispose();}
 const snapshot=page=>page.$eval('form',form=>({heading:form.querySelector('h4')?.textContent,fields:[...form.querySelectorAll('input,textarea,select')].map(node=>({tag:node.tagName,type:node.type,value:node.value,checked:node.checked})),image:form.querySelector('img[alt="Vista previa local de la foto que se enviará"]')?.src||null,chosen:form.innerText.includes('Archivo elegido para guardar')}));
 async function settled(page,count){await page.waitForFunction(count=>{const node=document.querySelector('[data-worksite-task-selector]');return node?.innerText.includes(count+' de 205 tareas cargadas.')&&node.getAttribute('aria-busy')==='false';},{timeout:20000},count);}
 async function createCase(width,mode,{failPage=false,holdPage=false}={}){
  const context=await browser.createBrowserContext(),page=await context.newPage(),facts=[];let failed=false,holding=false,releaseHold,holdUsed=false;
  await page.evaluateOnNewDocument(()=>{window.__taskCommands=[];const original=window.fetch.bind(window);window.fetch=async(input,options)=>{if(options?.method==='POST'){const body=options.body;if(body instanceof FormData){const file=body.get('file'),bytes=new Uint8Array(await file.arrayBuffer()),digest=await crypto.subtle.digest('SHA-256',bytes);window.__taskCommands.push({operationId:body.get('operationId'),projectId:body.get('projectId'),scope:body.get('scope'),taskId:body.get('taskId'),caption:body.get('caption'),file:{name:file.name,type:file.type,size:file.size,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}});}else if(typeof body==='string')window.__taskCommands.push(JSON.parse(body));}return original(input,options);};});
  await page.setViewport({width,height:1000,deviceScaleFactor:1});page.on('pageerror',error=>errors.push({width,mode,message:error.message}));await page.setRequestInterception(true);
  page.on('request',async request=>{try{const url=new URL(request.url());if(url.origin!==origin){guard(['data:','blob:'].includes(url.protocol),'No external browser requests');return request.continue();}if(!url.pathname.startsWith('/api/'))return request.continue();
   assert.equal(request.headers().authorization,'Bearer controlled-task-page-token');const fact={width,mode,path:url.pathname,method:request.method(),afterTask:url.searchParams.get('afterTask')};facts.push(fact);requests.push(fact);let body,status=200;
   if(url.pathname==='/api/identity/workspace'){
    assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('scope'),scope);assert.deepEqual([...url.searchParams.keys()].sort(),['afterTask','projectId','scope']);
    const after=url.searchParams.get('afterTask');assert.ok(['task-0100','task-0200'].includes(after));
    if(holdPage&&!holdUsed){holdUsed=true;holding=true;await new Promise(resolve=>{releaseHold=resolve;});holding=false;}
    if(failPage&&!failed){failed=true;status=503;body={saved:false,code:'WORKSPACE_OPERATION_UNCONFIRMED'};}else{const start=after==='task-0100'?100:200;body={scope,project:{id:projectId,name:'Obra sintética de paginación',status:'ACTIVE'},roleLabel:'Administrador',canPlanSchedule:true,tasks:rows.slice(start,start+100),totalTasks:205,nextCursor:start===100?'task-0200':null};}
   }else if(['/api/identity/field-operations','/api/identity/field-media'].includes(url.pathname)){
    if(request.method()==='POST'){status=503;body={saved:false,code:'FIELD_OPERATION_UNCONFIRMED'};fact.bodySha256=sha(Buffer.from(request.postData()||''));fact.operationId=(request.postData()||'').match(/"operationId":"([^"]+)"/)?.[1]||null;}
    else {
     assert.equal(url.pathname,'/api/identity/field-operations');assert.equal(request.method(),'GET');assert.equal(url.searchParams.get('projectId'),projectId);assert.equal(url.searchParams.get('scope'),scope);
     const inventoryFilter=url.searchParams.get('inventoryFilter');assert.deepEqual([...url.searchParams.keys()].sort(),mode==='consumption'&&inventoryFilter!==null?['inventoryFilter','projectId','scope']:['projectId','scope']);
     if(mode==='consumption'){
      assert.ok(inventoryFilter===null||inventoryFilter==='PENDING','Only the initial inventory and its pending queue are expected');fact.inventoryFilter=inventoryFilter;
      const expected={projectId,scope,...(inventoryFilter===null?{}:{inventoryFilter})};
      // The full synthetic inventory has no proposals. Counts are independent
      // of the requested page and match the real inventory history contract.
      body=inventoryFilter===null?{...baseData,inventory}:{scope,projectId,inventory:{...inventory,inventoryFilter,inventoryQuery:inventoryQuery(expected),pendingCounts:{consumptions:inventory.consumptions.filter(row=>row.state==='PENDING').length,adjustments:inventory.adjustments.filter(row=>row.state==='PENDING').length}}};
      inventorySnapshot(body,expected,{history:inventoryFilter!==null});
     }else body={...baseData,inventory};
    }
   }else throw Error('Unexpected fixture API '+url.pathname);
   fact.responseStatus=status;await request.respond({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(body)});
  }catch(error){errors.push({width,mode,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}});
  await page.goto(origin+'/?mode='+mode,{waitUntil:'networkidle0',timeout:120000});await click(page,mode==='consumption'?'Abrir inventario':'Abrir operaciones');
  if(mode==='consumption'){await click(page,'Proponer consumo');assert.deepEqual(facts,[{width,mode,path:'/api/identity/field-operations',method:'GET',afterTask:null,inventoryFilter:null,responseStatus:200},{width,mode,path:'/api/identity/field-operations',method:'GET',afterTask:null,inventoryFilter:'PENDING',responseStatus:200}]);await field(page,'Sector','sector-fixture');await field(page,'Material del catálogo','material-fixture');await field(page,'Cantidad utilizada','2.125');await field(page,'Motivo o detalle','Consumo sintético conservado durante la consulta.');}
  else if(mode==='evidence'){await click(page,'Evidencia');await click(page,'Adjuntar evidencia');const input=await page.$('form input[type=file]');assert.ok(input);await input.uploadFile(imagePath);await page.waitForSelector('form img[alt="Vista previa local de la foto que se enviará"]');await click(page,'Usar este archivo');await field(page,'Qué muestra o registra','Archivo sintético conservado durante la consulta.');}
  else if(mode==='progress'){await click(page,'Avance');await click(page,'Proponer avance');await field(page,'Avance propuesto (%)','25');await field(page,'Cantidad ejecutada acumulada (opcional)','2.5');await field(page,'Cantidad base','10');await field(page,'Unidad','M2');await field(page,'Fundamento','Medición sintética conservada durante la consulta.');}
  else {await click(page,'Incidencias y materiales');await click(page,'Solicitar material');await field(page,'Material solicitado','Material sintético por consultar');await field(page,'Cantidad solicitada','2.125');await field(page,'Para qué hace falta','Pedido sintético conservado durante la consulta.');}
  await settled(page,100);return{context,page,facts,width,mode,release:()=>releaseHold?.(),holding:()=>holding};
 }
 async function check(name,fn){await fn();checks.push(name);}
 async function readableMediaActions(item){const geometry=await item.page.$eval('form img[alt="Vista previa local de la foto que se enviará"]',image=>[...image.parentElement.querySelectorAll('button')].map(button=>{const box=button.getBoundingClientRect(),text=button.firstChild,words=[];if(text?.nodeType!==Node.TEXT_NODE)throw Error('Expected native media action text');for(const word of text.textContent.matchAll(/\S+/g)){const range=document.createRange();range.setStart(text,word.index);range.setEnd(text,word.index+word[0].length);words.push({word:word[0],lineRects:[...range.getClientRects()].filter(rect=>rect.width>0).length});}return{label:button.textContent.trim(),width:box.width,height:box.height,words};}));assert.deepEqual(geometry.map(button=>button.label),['Girar foto 90°','Usar este archivo','Quitar archivo']);for(const button of geometry){assert.ok(button.width>=44&&button.height>=44,'Media action must keep a44px target');assert.ok(button.words.every(word=>word.lineRects===1),'Media action must wrap between complete words');}mediaActions.push({width:item.width,buttons:geometry});}
 async function screenshot(item,name){const filename=name+'-'+item.width+'.png',target=path.join(output,filename);await item.page.screenshot({path:target,fullPage:true});screenshots.push({path:filename,sha256:sha(readFileSync(target)),geometry:await item.page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}))});}
 try{
  const environment=Object.fromEntries(['APPDATA','COMSPEC','ComSpec','LOCALAPPDATA','PATH','Path','PATHEXT','SystemRoot','TEMP','TMP','USERPROFILE','WINDIR'].filter(name=>process.env[name]!==undefined).map(name=>[name,process.env[name]]));
  child=spawn(process.execPath,[serverFile],{cwd:fixture,env:environment,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});child.stdout.on('data',chunk=>{serverLog+=chunk;});child.stderr.on('data',chunk=>{serverLog+=chunk;});childClose=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
  await deadline(new Promise((resolve,reject)=>{child.on('message',message=>{if(message?.nonce!==nonce)return;if(message.type==='ready')resolve();if(message.type==='closed')closeAck=true;if(message.type==='failed')reject(new Error('Owned fixture server failed'));});child.once('error',reject);child.once('exit',()=>reject(new Error('Owned fixture server exited before ready')));}), 'Owned fixture server readiness',120000);
  browser=await puppeteer.launch({headless:true,env:environment,args:['--no-sandbox','--disable-dev-shm-usage']});
  for(const width of FIELD_TASK_PAGE_WIDTHS)for(const mode of FIELD_TASK_PAGE_MODES)await check('real-form-keeps-draft-through-pages-2-and-3-'+mode+'-'+width,async()=>{
   const item=await createCase(width,mode,{holdPage:true});try{const before=await snapshot(item.page);await click(item.page,'Cargar más tareas');await item.page.waitForFunction(()=>document.querySelector('[data-worksite-task-selector]').getAttribute('aria-busy')==='true');
    assert.equal(await item.page.$eval('form button[type=submit]',node=>node.disabled),true);await item.page.$eval('form',form=>form.requestSubmit());assert.equal(item.facts.filter(fact=>fact.method==='POST').length,0);item.release();await settled(item.page,200);assert.deepEqual(await snapshot(item.page),before);
    await click(item.page,'Cargar más tareas');await settled(item.page,205);assert.deepEqual(await snapshot(item.page),before);assert.deepEqual(item.facts.filter(fact=>fact.path==='/api/identity/workspace').map(fact=>fact.afterTask),['task-0100','task-0200']);
    const label=mode==='consumption'?'Tarea (opcional)':mode==='material-request'?'Tarea relacionada (opcional)':'Tarea';await field(item.page,label,'task-0205');assert.equal(await item.page.$eval('[data-worksite-task-selector] select',node=>node.value),'task-0205');assert.equal(item.facts.filter(fact=>fact.method!=='GET').length,0);assert.equal(await item.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);if(mode==='evidence')await readableMediaActions(item);await screenshot(item,mode+'-page-three');
   }finally{item.release();await item.context.close();}
  });
  for(const width of FIELD_TASK_PAGE_WIDTHS)for(const mode of FIELD_TASK_PAGE_MODES)await check('page-503-keeps-form-and-explicit-retry-'+mode+'-'+width,async()=>{const item=await createCase(width,mode,{failPage:true});try{const before=await snapshot(item.page);await click(item.page,'Cargar más tareas');await item.page.waitForSelector('[data-worksite-task-selector] [role=alert]');assert.deepEqual(await snapshot(item.page),before);await click(item.page,'Reintentar cargar más tareas');await settled(item.page,200);assert.deepEqual(await snapshot(item.page),before);assert.equal(item.facts.filter(fact=>fact.method!=='GET').length,0);}finally{await item.context.close();}});
  for(const width of FIELD_TASK_PAGE_WIDTHS)for(const mode of ['evidence','progress','consumption'])await check('uncertain-original-command-blocks-task-paging-'+mode+'-'+width,async()=>{const item=await createCase(width,mode);try{await click(item.page,'Cargar más tareas');await settled(item.page,200);const before=await snapshot(item.page);await click(item.page,mode==='consumption'?'Confirmar operación':'Guardar con recibo');await item.page.waitForFunction(()=>document.body.innerText.includes('El resultado quedó sin confirmar.'));const posts=item.facts.filter(fact=>fact.method==='POST');assert.equal(posts.length,1);assert.deepEqual(await snapshot(item.page),before);const references=await item.page.evaluate(()=>window.__taskReferences()),commands=await item.page.evaluate(()=>window.__taskCommands);assert.equal(references.length,1);assert.equal(commands.length,1);assert.match(commands[0].operationId,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(references[0].operationId,commands[0].operationId);assert.equal(commands[0].projectId,projectId);assert.equal(commands[0].scope,scope);if(mode==='evidence'){assert.equal(commands[0].taskId,'task-0001');assert.equal(commands[0].caption,'Archivo sintético conservado durante la consulta.');assert.equal(commands[0].file.sha256,sha(readFileSync(imagePath)));}else if(mode==='progress'){assert.equal(commands[0].payload.taskId,'task-0001');assert.equal(commands[0].payload.reason,'Medición sintética conservada durante la consulta.');assert.equal(commands[0].payload.quantity,'2.5');}else{assert.equal(commands[0].payload.taskId,null);assert.equal(commands[0].payload.reason,'Consumo sintético conservado durante la consulta.');assert.equal(commands[0].payload.quantity,'2.125');}const count=item.facts.length;assert.equal(await item.page.$eval('[data-worksite-task-selector] button',node=>node.disabled),true);await item.page.$eval('[data-worksite-task-selector] button',node=>node.click());await item.page.evaluate(()=>window.__forceTaskPage());assert.equal(item.facts.length,count);assert.deepEqual(await item.page.evaluate(()=>window.__taskReferences()),references);assert.equal(item.facts.filter(fact=>fact.method==='POST').length,1);}finally{await item.context.close();}});
  assert.deepEqual(errors,[]);assert.equal(checks.length,33);assert.equal(requests.filter(fact=>fact.method==='POST').length,9);
 }catch(error){failure=error;}finally{
  try{if(browser)await deadline(browser.close(),'Owned browser close',15000);browserClosed=true;}catch(error){failure||=error;}
  try{if(child?.connected)child.send({type:'close',nonce});if(child){const exit=await deadline(childClose,'Owned server close',30000);assert.equal(exit.code,0);}serverClosed=!child||closeAck;assert.equal(serverClosed,true);}catch(error){failure||=error;}
  try{cleanupProof=await removeOwnedFixture(ownership,{serverClosedBeforeFixtureRemoval:serverClosed});}catch(error){failure||=error;cleanupProof=error.cleanupProof;}
 }
 let sourceBytesUnchanged=false;try{sourceBytesUnchanged=sourceManifest.every(source=>sha(readSource(source.path))===source.sha256);assert.equal(sourceBytesUnchanged,true);assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),head);assertCiSource();}catch(error){failure||=error;}
 const proof={version:1,status:failure?'FAIL':'PASS',sourceState:options.ci?'EXACT_CI_SOURCE':'LOCAL_REVIEW_SOURCE',...(options.ci?{trackedClean:true,ciRun:options.ciRun}:{}),sourceRevision:head,sourceTree:tree,checkedAt:new Date().toISOString(),sourceManifest,sourceBytesUnchanged,externalImports:closure.externalImports,widths:FIELD_TASK_PAGE_WIDTHS,checks,totalCheckCount:checks.length,requests,errors,screenshots,mediaActions,actualConsumerComponentsMounted:true,productionPagerFactoryReused:true,pagingActivatedWithKeyboard:true,syntheticOnly:true,providerCalls:0,productionDataTouched:false,humanAccepted:false,posts:requests.filter(fact=>fact.method==='POST').length,cleanup:{browserClosed,serverClosed,gracefulCloseAcknowledged:closeAck,fixtureRemoved:cleanupProof?.fixtureRemoved===true,fixtureCleanupProof:cleanupProof},...(failure?{failure:failure.message,serverLog}:{})};
 const target=path.join(output,'browser.json');writeFileSync(target,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:proof.status,totalCheckCount:checks.length,target,sha256:sha(readFileSync(target)),cleanup:proof.cleanup}));if(failure)throw failure;return proof;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await verifyFieldTaskPaginationUi();
