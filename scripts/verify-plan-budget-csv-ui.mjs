import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {parse} from '@babel/parser';
import puppeteer from 'puppeteer';
import {createPlanImportHandlers} from '../src/lib/plan-import-http.mjs';
import {extractPlanBudgetCsvSource,PLAN_BUDGET_CSV_CONSENT} from '../src/lib/plan-budget-csv-source.mjs';
import {budgetStoreHarness,budgetContext,budgetSession} from '../tests/fixtures/plan-budget-store-synthetic.mjs';
import {syntheticBudgetCsv} from '../tests/fixtures/plan-budget-csv-synthetic.mjs';

// Separate synthetic CSV browser acceptance. The historical 203 cases are
// neither executed nor replaced. Only controlled in-memory adapters are used.
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=fs.realpathSync(process.cwd()),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const producer='scripts/verify-plan-budget-csv-ui.mjs',client='src/app/(identity)/cuenta/plan-import-panel.js';
const scratch=path.join(root,'.vercel/private');fs.mkdirSync(scratch,{recursive:true});
const runDirectory=fs.mkdtempSync(path.join(scratch,'plan-budget-csv-browser-'));
const fixture=path.join(runDirectory,'fixture');fs.mkdirSync(fixture);
const sourceFiles=new Set(),copiedFiles=new Set();
function dependency(file,specifier){
 if(specifier.startsWith('@/'))return 'src/'+specifier.slice(2);
 if(!specifier.startsWith('.'))return null;
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),specifier));
 assert.match(base,/^(src|tests|scripts)\//);assert.equal(base.includes('..'),false);
 const selected=[base,base+'.js',base+'.mjs',base+'.jsx',base+'/index.js'].find(value=>fs.existsSync(path.join(root,value))&&fs.statSync(path.join(root,value)).isFile());
 assert.ok(selected,'Unresolved relative dependency: '+file+' -> '+specifier);return selected;
}
function collect(file,set){
 if(set.has(file))return;set.add(file);assert.ok(fs.statSync(path.join(root,file)).isFile());
 if(!/\.[cm]?jsx?$/.test(file))return;
 const ast=parse(fs.readFileSync(path.join(root,file),'utf8'),{sourceType:'module',plugins:['jsx']});
 const visit=node=>{
  if(!node||typeof node!=='object')return;
  const specifier=['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)?node.source?.value:node.type==='ImportExpression'?node.source?.value:node.type==='CallExpression'&&node.callee?.type==='Import'?node.arguments?.[0]?.value:null;
  if(typeof specifier==='string'){const next=dependency(file,specifier);if(next)collect(next,set);}
  for(const child of Object.values(node))if(Array.isArray(child))child.forEach(visit);else if(child&&typeof child==='object')visit(child);
 };visit(ast);
}
collect(client,copiedFiles);
for(const file of copiedFiles){const target=path.join(fixture,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);assert.ok(fs.readFileSync(target).equals(fs.readFileSync(path.join(root,file))));sourceFiles.add(file);}
collect(producer,sourceFiles);
sourceFiles.add('package.json');sourceFiles.add('package-lock.json');
const sourceManifest=[...sourceFiles].sort().map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const sourceRevision=git('rev-parse','HEAD'),sourceTree=git('rev-parse','HEAD^{tree}'),trackedClean=git('status','--porcelain','--untracked-files=no')==='';
assert.match(sourceRevision,/^[a-f0-9]{40}$/);
const app=path.join(fixture,'app');fs.mkdirSync(app);
fs.writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));
fs.writeFileSync(path.join(fixture,'next.config.mjs'),'export default {devIndicators:false,turbopack:{root:'+JSON.stringify(root)+'}};\n');
fs.writeFileSync(path.join(app,'layout.js'),'export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:16,fontFamily:"Arial",background:"#fff"}}>{children}</body></html>}\n');
fs.writeFileSync(path.join(app,'page.js'),"'use client';import {PlanImportPanel} from '../"+client+"';const context="+JSON.stringify(budgetContext)+";const token=async()=> 'synthetic-csv-budget-token';export default function Page(){return <main style={{maxWidth:1040,margin:'auto'}}><PlanImportPanel projectId={context.projectId} scope={context.scope} canonicalAccess={true} getSessionToken={token} onApplied={()=>{throw Error('CSV must not apply tasks');}}/></main>}\n");
const bytes=syntheticBudgetCsv({count:68}),source=extractPlanBudgetCsvSource(bytes,'text/csv'),sourcePath=path.join(runDirectory,'synthetic-budget.csv');
fs.writeFileSync(sourcePath,bytes);assert.equal(source.rows.length,68);
const reserve=createServer();await new Promise((resolve,reject)=>{reserve.once('error',reject);reserve.listen(0,'127.0.0.1',resolve);});
const port=reserve.address().port;await new Promise((resolve,reject)=>reserve.close(error=>error?reject(error):resolve()));
const origin='http://127.0.0.1:'+port,endpoint='/api/identity/plan-import',widths=[320,390,768,1280];
const startedAt=new Date().toISOString(),checks=[],errors=[],externalRequests=[];
let browser,server,serverLog='',failure=null,browserClosed=false,serverClosed=false,fixtureRemoved=false;
const serverEnvironment=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|PATHEXT|SystemRoot|WINDIR|COMSPEC|SystemDrive|TEMP|TMP|NUMBER_OF_PROCESSORS)$/i.test(key)));
Object.assign(serverEnvironment,{NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',TZ:'UTC'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const waitText=(page,value)=>page.waitForFunction(value=>document.body.innerText.includes(value),{},value);
async function clickText(page,value){
 await page.waitForFunction(value=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent.trim()===value&&!button.disabled),{},value);
 const handle=await page.evaluateHandle(value=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent.trim()===value&&!button.disabled),value);
 try{await handle.asElement().click();}finally{await handle.dispose();}
}
async function storageSnapshot(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{
  const plain={local:Object.values(localStorage),session:Object.values(sessionStorage)},request=indexedDB.open('obrasaas-pending-receipts-v1');
  request.onerror=()=>reject(Error('Recovery storage unavailable'));
  request.onsuccess=()=>{const db=request.result;if(!db.objectStoreNames.contains('references')){db.close();resolve({...plain,references:[]});return;}
   const transaction=db.transaction('references','readonly'),read=transaction.objectStore('references').getAll();let result;
   read.onsuccess=()=>{result=read.result;};read.onerror=()=>reject(Error('Recovery read failed'));transaction.oncomplete=()=>{db.close();resolve({...plain,references:result});};transaction.onerror=()=>reject(Error('Recovery transaction failed'));
  };
 }));
}
function noPrivateStorage(value){assert.doesNotMatch(JSON.stringify(value),/rawUnitPrice|rawLineAmount|budgetSource|999999999999999999999|synthetic-csv-budget-token|synthetic-budget\.csv/);}
async function observedRow(page){
 return page.$eval('[data-csv-budget-reading]',node=>({quantity:node.querySelector('[data-csv-budget-quantity]').textContent,unit:node.querySelector('[data-csv-budget-unit]').textContent,price:node.querySelector('[data-csv-budget-unit-price]').textContent,amount:node.querySelector('[data-csv-budget-line-amount]').textContent}));
}
function expectedRow(row){return {quantity:row.rawQuantity||'Sin valor en la fuente',unit:row.rawUnit||'Sin unidad en la fuente',price:row.rawUnitPrice||'Sin valor en la fuente',amount:row.rawLineAmount||'Sin valor en la fuente'};}
async function geometry(page,width){
 const result=await page.$eval('[aria-label="Presupuesto de obra (lectura)"]',node=>{
  const box=node.getBoundingClientRect(),controls=[...node.querySelectorAll('button,select,summary')].filter(element=>{const b=element.getBoundingClientRect();return b.width>0&&b.height>0;});
  return {left:box.left,right:box.right,width:box.width,minimumTarget:Math.min(...controls.map(element=>element.getBoundingClientRect().height)),overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.ok(result.left>=0&&result.right<=width+1&&result.width>0);assert.ok(result.minimumTarget>=44);assert.equal(result.overflow,false);return result;
}
async function stopServer(){
 if(!server){serverClosed=true;return;}
 if(server.exitCode!==null||server.signalCode!==null){serverClosed=true;return;}
 if(process.platform==='win32')execFileSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 else process.kill(-server.pid,'SIGTERM');
 for(let i=0;i<100&&server.exitCode===null&&server.signalCode===null;i++)await pause(100);
 if(server.exitCode===null&&server.signalCode===null){if(process.platform!=='win32')process.kill(-server.pid,'SIGKILL');throw Error('Owned Next process did not stop');}
 serverClosed=true;
}
try{
 server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:serverEnvironment,detached:process.platform!=='win32',windowsHide:true,stdio:['ignore','pipe','pipe']});
 server.on('error',error=>{errors.push('server: '+error.message);});for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{serverLog=(serverLog+chunk.toString()).slice(-300000);});
 let ready=false;for(let i=0;i<180;i++){assert.equal(server.exitCode,null,'Next stopped before ready');try{const response=await fetch(origin,{signal:AbortSignal.timeout(1000)});ready=response.ok;await response.body?.cancel();if(ready)break;}catch{/* The owned local listener is still starting. */}await pause(500);}
 assert.equal(ready,true,'CSV fixture did not become ready');
 browser=await puppeteer.launch({headless:true,...(process.env.PUPPETEER_EXECUTABLE_PATH?{executablePath:process.env.PUPPETEER_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']});
 for(const width of widths){
  const context=await browser.createBrowserContext(),page=await context.newPage();page.setDefaultTimeout(30000);await page.setViewport({width,height:1000});
  const h=budgetStoreHarness(),http=createPlanImportHandlers({verify:async()=>budgetSession,imports:h.imports}),ledger={uploads:0,lists:0,details:0,denials:0},pending=new Set();let originalBrowserFile=null,draftId=null;
  page.on('pageerror',error=>errors.push({width,error:error.message}));await page.setRequestInterception(true);
  page.on('request',request=>{
   const job=(async()=>{
    const url=new URL(request.url());if(['data:','blob:'].includes(url.protocol))return request.continue();
    if(url.origin!==origin){externalRequests.push({origin:url.origin,path:url.pathname});return request.abort();}
    if(url.pathname!==endpoint)return request.continue();
    assert.equal(request.headers().authorization,'Bearer synthetic-csv-budget-token');
    let response;
    if(request.method()==='GET'){
     assert.equal(url.searchParams.get('scope'),budgetContext.scope);assert.equal(url.searchParams.get('projectId'),budgetContext.projectId);
     const keys=[...url.searchParams.keys()].sort();assert.deepEqual(keys,url.searchParams.has('draftId')?['draftId','projectId','scope']:['projectId','scope']);
     if(url.searchParams.has('draftId')){assert.equal(url.searchParams.get('draftId'),draftId);ledger.details++;}else ledger.lists++;
     response=await http.GET(new Request('https://obrasaas.com'+endpoint+url.search));
    }else{
     assert.equal(request.method(),'POST');assert.equal(url.search,'');assert.equal(++ledger.uploads,1);assert.ok(originalBrowserFile);
     assert.deepEqual({name:originalBrowserFile.name,bytes:originalBrowserFile.bytes,sha256:originalBrowserFile.sha256},{name:'synthetic-budget.csv',bytes:bytes.length,sha256:source.sourceSha256});assert.equal(typeof originalBrowserFile.type,'string');
     const contentType=request.headers()['content-type'];assert.ok(contentType.startsWith('multipart/form-data;'));
     const raw=request.postData()||await request.fetchPostData();assert.equal(typeof raw,'string');const multipart=raw.startsWith('--')?raw:Buffer.from(raw,'base64').toString('utf8');
     assert.ok(multipart.includes('filename="synthetic-budget.csv"'));assert.ok(multipart.includes('Content-Type: text/csv'));
     assert.deepEqual([...multipart.matchAll(/Content-Disposition: form-data; name="([^"]+)"/g)].map(match=>match[1]).sort(),['consent','file','operationId','projectId','scope']);
     const fields={};for(const key of ['consent','operationId','projectId','scope']){const matches=[...multipart.matchAll(new RegExp('name="'+key+'"\\r\\n\\r\\n([^\\r\\n]+)\\r\\n','g'))];assert.equal(matches.length,1);fields[key]=matches[0][1];}
     assert.equal(fields.consent,PLAN_BUDGET_CSV_CONSENT);assert.equal(fields.scope,budgetContext.scope);assert.equal(fields.projectId,budgetContext.projectId);assert.match(fields.operationId,/^[a-f0-9-]{36}$/);
     const form=new FormData();for(const [key,value]of Object.entries(fields))form.append(key,value);form.append('file',new File([bytes],'synthetic-budget.csv',{type:'text/csv'}));
     response=await http.POST(new Request('https://obrasaas.com'+endpoint,{method:'POST',headers:{origin:'https://obrasaas.com'},body:form}));
    }
    const body=await response.text(),payload=JSON.parse(body);
    if(response.status===403){ledger.denials++;assert.equal(payload.code,'PLAN_IMPORT_PERMISSION_REQUIRED');assert.equal(Object.hasOwn(payload,'draft'),false);}
    else{
     assert.equal(response.status,200,body);
     if(request.method()==='POST'){draftId=payload.draft.id;assert.equal(payload.draft.budgetDescriptor.rowCount,68);assert.equal(Object.hasOwn(payload.draft,'budgetSource'),false);}
     else if(url.searchParams.has('draftId')){assert.equal(payload.canApprove,true);assert.deepEqual(payload.draft.budgetSource,source);}
     else for(const draft of payload.drafts){assert.equal(draft.id,draftId);assert.equal(draft.budgetDescriptor.rowCount,68);assert.equal(Object.hasOwn(draft,'budgetSource'),false);}
    }
    await request.respond({status:response.status,headers:Object.fromEntries(response.headers),body});
   })().catch(async error=>{errors.push({width,error:error.stack});if(!request.isInterceptResolutionHandled())await request.respond({status:500,contentType:'application/json',body:JSON.stringify({code:'SYNTHETIC_CSV_FIXTURE_FAILED'})}).catch(()=>{});});
   pending.add(job);void job.finally(()=>pending.delete(job));
  });
  await page.goto(origin,{waitUntil:'networkidle0'});await clickText(page,'Importar cronograma o presupuesto');
  await page.waitForSelector('[data-plan-import] input[type=file]:not(:disabled)');
  await (await page.$('[data-plan-import] input[type=file]')).uploadFile(sourcePath);
  await page.waitForSelector('[aria-label="Alcance del presupuesto CSV"]');
  const checkbox='[data-plan-import] form input[type=checkbox]',submit='[data-plan-import] form button[type=submit]';
  assert.equal(await page.$eval(checkbox,node=>node.checked),false);assert.equal(await page.$eval(submit,node=>node.disabled),true);assert.equal(ledger.uploads,0);
  originalBrowserFile=await page.$eval('[data-plan-import] input[type=file]',async node=>{const file=node.files[0],digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(value=>value.toString(16).padStart(2,'0')).join('');return {name:file.name,type:file.type,bytes:file.size,sha256:digest};});
  await page.click(checkbox);await page.waitForFunction(selector=>{const button=document.querySelector(selector);return button&&!button.disabled;},{},submit);await page.click(submit);
  await waitText(page,'Lectura privada guardada.');assert.equal(ledger.uploads,1);assert.equal(ledger.details,0);assert.equal(await page.$('[data-csv-budget-reading]'),null);
  noPrivateStorage(await storageSnapshot(page));
  await page.reload({waitUntil:'networkidle0'});await clickText(page,'Importar cronograma o presupuesto');
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-plan-import] button')].some(button=>button.textContent.includes('Presupuesto · sólo lectura')&&!button.disabled));
  assert.equal(await page.$('[data-csv-budget-reading]'),null);
  const listed=await page.evaluateHandle(()=>[...document.querySelectorAll('[data-plan-import] button')].find(button=>button.textContent.includes('Presupuesto · sólo lectura')&&!button.disabled));try{await listed.asElement().click();}finally{await listed.dispose();}
  await page.waitForSelector('[data-csv-budget-unit-price]');await waitText(page,'Estado actualizado. La consulta del presupuesto se completó.');assert.ok(ledger.lists>=2);assert.equal(ledger.details,1);assert.equal(ledger.uploads,1);
  assert.deepEqual(await page.$$eval('[data-budget-partida-selection] option',nodes=>nodes.map(node=>node.value)),source.rows.map(row=>row.code));
  assert.deepEqual(await observedRow(page),expectedRow(source.rows[0]));await waitText(page,'Partida 1 de 68');
  await page.select('[data-budget-partida-selection]',source.rows.at(-1).code);await waitText(page,'Partida 68 de 68');assert.deepEqual(await observedRow(page),expectedRow(source.rows.at(-1)));
  const nextDisabled=await page.$$eval('[aria-label="Recorrer partidas originales"] button',buttons=>buttons.find(button=>button.textContent==='Siguiente').disabled);assert.equal(nextDisabled,true);
  await page.click('[data-csv-budget-provenance] > summary');await waitText(page,'Página declarada en la fuente');
  assert.equal(await page.$eval('[data-csv-budget-original-code]',node=>node.textContent),source.rows.at(-1).code);
  const layout=await geometry(page,width);assert.equal(await page.$$eval('[aria-label="Presupuesto de obra (lectura)"] button',buttons=>buttons.some(button=>/Aplicar|Aprobar|Guardar correcciones/.test(button.textContent))),false);
  noPrivateStorage(await storageSnapshot(page));const imagePath=path.join(runDirectory,'csv-'+width+'.png');await page.screenshot({path:imagePath,fullPage:true});
  h.setRole('SITE_MANAGER');await page.click('[data-budget-consult]');await waitText(page,'Tu permiso actual no autoriza esta acción.');
  await page.waitForFunction(()=>!document.querySelector('[data-csv-budget-reading],[data-csv-budget-unit-price],[data-csv-budget-line-amount]'));noPrivateStorage(await storageSnapshot(page));
  await Promise.all([...pending]);assert.equal(ledger.denials,1);assert.equal(ledger.details,2);assert.equal(ledger.uploads,1);
  assert.equal(h.calls.analyzer,1);assert.equal(h.calls.put,1);assert.equal(h.calls.provider,0);assert.equal(h.calls.providerConfiguration,0);assert.equal(h.calls.taskReads,0);assert.equal(h.calls.taskWrites,0);assert.equal(h.state().tasks.size,0);assert.ok([...h.state().logs.values()].every(row=>row.action==='plan.import.draft'));
  assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
  checks.push({width,consentRequired:true,originalBrowserFile,transport:'RECONSTRUCTED_NODE_FORMDATA_FROM_VERIFIED_BROWSER_FILE',descriptorOnlyList:true,exactDetailBound:true,all68OptionsVerified:true,firstAndLastOriginalValuesVerified:true,lastRow:source.rows.at(-1).code,roleDenialClearsPrivateUi:true,noPrivateBrowserStorage:true,ledger,analyzerCalls:h.calls.analyzer,archivePuts:h.calls.put,providerCalls:0,taskReads:0,taskWrites:0,layout,screenshot:{path:path.relative(root,imagePath).split(path.sep).join('/'),sha256:sha(fs.readFileSync(imagePath))}});
  await context.close();console.log(JSON.stringify({csvWidth:width,state:'PASS'}));
 }
 assert.equal(checks.length,4);assert.deepEqual(checks.map(check=>check.width),widths);
 for(const ref of sourceManifest)assert.equal(sha(fs.readFileSync(path.join(root,ref.path))),ref.sha256,'Source changed during browser acceptance: '+ref.path);
 for(const file of copiedFiles)assert.ok(fs.readFileSync(path.join(root,file)).equals(fs.readFileSync(path.join(fixture,file))),'Fixture copy changed: '+file);
 assert.equal(git('rev-parse','HEAD'),sourceRevision);assert.deepEqual(errors,[]);assert.deepEqual(externalRequests,[]);
}catch(error){failure=error;errors.push({final:error.stack});}
finally{
 try{if(browser)await browser.close();browserClosed=!browser||!browser.connected;}catch(error){errors.push({cleanup:error.message});failure??=error;}
 try{await stopServer();}catch(error){errors.push({cleanup:error.message});failure??=error;}
 try{assert.equal(fs.realpathSync(fixture),path.join(fs.realpathSync(runDirectory),'fixture'));if(serverClosed&&browserClosed){fs.rmSync(fixture,{recursive:true,maxRetries:10,retryDelay:100});fixtureRemoved=!fs.existsSync(fixture);}}catch(error){errors.push({cleanup:error.message});failure??=error;}
 fs.writeFileSync(path.join(runDirectory,'server.log'),serverLog);
}
const proof={status:failure?'FAIL':'PASS',synthetic:true,fullSuite:false,focusedScenario:'CSV_BUDGET',historical203Executed:false,humanAccepted:false,productionDataWritten:false,realProviderCalls:0,sourceRevision,sourceTree,trackedClean,sourceState:'LOCAL_REVIEW_SOURCE',startedAt,completedAt:new Date().toISOString(),widths,checks,sourceManifest,fixtureCopiedSources:[...copiedFiles].sort(),fixtureTransforms:[],externalRequests,errors,cleanup:{browserClosed,serverClosed,fixtureRemoved}};
const proofPath=path.join(runDirectory,'validation.json');fs.writeFileSync(proofPath,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:proof.status,checks:checks.length,proofPath,cleanup:proof.cleanup}));
if(failure)throw failure;assert.ok(browserClosed&&serverClosed&&fixtureRemoved);
