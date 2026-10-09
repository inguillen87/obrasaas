import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,readFileSync,existsSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),scratch=path.join(root,'.vercel/private');mkdirSync(scratch,{recursive:true});
const fixture=mkdtempSync(path.join(scratch,'portfolio-ui-')),app=path.join(fixture,'app');mkdirSync(app);
const files=['portfolio-overview-panel.js','portfolio-overview-panel.module.css','portfolio-overview-view.mjs','workspace-session-request.mjs','workspace-request-lifecycle.js','workspace-request-lifecycle.mjs','workspace-recovery-journal.mjs','own-company-number-view.mjs','own-company-templates-view.mjs','private-bank-account-format.mjs','site-purchase-view.mjs','company-channel-view.mjs','workspace-recovery-storage.mjs'];
const sha=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const sourceManifest=files.map(name=>({path:'src/app/(identity)/cuenta/'+name,sha256:sha(path.join(root,'src/app/(identity)/cuenta',name))}));
for(const name of files)copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,fontFamily:'Arial'}}>{children}</body></html>}`);
const scope='a'.repeat(64),otherScope='b'.repeat(64);
writeFileSync(path.join(app,'page.js'),`'use client';import {useState} from 'react';import {PortfolioOverviewPanel} from './portfolio-overview-panel';const token=async()=>window.__tokenEpoch===2?'synthetic-portfolio-2':'synthetic-portfolio-1';export default function Page(){const [visible,setVisible]=useState(true),[context,setContext]=useState(false),[locked,setLocked]=useState(false),[selected,setSelected]=useState(''),[denied,setDenied]=useState(false);return <main style={{maxWidth:980,margin:'0 auto'}}><button onClick={()=>setContext(true)}>Cambiar contexto</button><button onClick={()=>setVisible(false)}>Desmontar</button><button onClick={()=>setLocked(value=>!value)}>Acción en curso</button><p data-selected>{selected}</p><p data-denied>{denied?'Acceso invalidado':''}</p>{visible&&<PortfolioOverviewPanel scope={context?'${otherScope}':'${scope}'} role={context?'FINANCE':'ADMIN'} getSessionToken={token} locked={locked} onOpenProject={setSelected} onAccessRejected={()=>setDenied(true)}/>}</main>}`);
const port=3184,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform!=='win32'});
const serverClosed=new Promise(resolve=>server.once('close',resolve));let log='',browser,removed=false;
for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-16000);});
async function stopServer(){if(server.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/pid',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else try{process.kill(-server.pid,'SIGTERM');}catch{}await serverClosed;}}
const widths=[320,390,768,1280],modes=['success','pagination','503','401','403','409','503-html','401-html','403-html','409-html','invalid-json','wrong-scope','wrong-role','stale','unmount','locked','dark'],checks=[],errors=[];
const taskRow=n=>({id:'p-'+String(n).padStart(3,'0'),name:'Obra de ensayo '+n,status:'ACTIVE',totalTasks:6,completedTasks:1,inProgressTasks:2,blockedTasks:1,unscheduledTasks:3,nextEndsOn:'2026-11-03'});
const payload=(projects=[taskRow(1)],cursor=null)=>({scope,organizationName:'Administración de ensayo',role:'ADMIN',projects,nextCursor:cursor});
async function click(page,label){const handle=await page.evaluateHandle(name=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===name),label);const element=handle.asElement();assert.ok(element,'Missing button '+label);await element.click();await handle.dispose();}
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{},text);
try{
 for(let i=0;i<90;i++){if(server.exitCode!==null)throw Error(log);try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));if(i===89)throw Error(log);}
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox']});
 for(const width of widths)for(const mode of modes){
  const context=await browser.createBrowserContext(),page=await context.newPage(),requests=[];let held=null,reads=0;
  await page.setViewport({width,height:1000});if(mode==='dark')await page.emulateMediaFeatures([{name:'prefers-color-scheme',value:'dark'}]);
  page.on('pageerror',error=>errors.push({mode,width,message:error.message}));await page.setRequestInterception(true);
  page.on('request',async request=>{try{
   const url=new URL(request.url());if(url.origin!==origin){if(['blob:','data:'].includes(url.protocol))return request.continue();throw Error('External request '+url.origin);}
   if(url.pathname!=='/api/identity/workspace')return request.continue();
   assert.equal(request.method(),'GET');assert.deepEqual([...url.searchParams.keys()].sort(),url.searchParams.has('afterProject')?['afterProject','portfolio','scope']:['portfolio','scope']);assert.equal(url.searchParams.get('portfolio'),'1');assert.equal(url.searchParams.get('scope'),scope);assert.match(request.headers().authorization,/^Bearer synthetic-portfolio-[12]$/);
   requests.push({method:request.method(),query:url.search,authorization:request.headers().authorization});reads++;
   const respond=(value,status=200)=>request.respond({status,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(value)});
   if(mode==='stale'||mode==='unmount'){held=()=>respond(payload()).catch(()=>{});return;}
   if(['503','401','403','409'].includes(mode)&&reads===1)return respond({code:'SYNTHETIC_DENIAL'},Number(mode));
   if(mode.endsWith('-html')&&reads===1)return request.respond({status:Number(mode.slice(0,3)),contentType:'text/html',body:'<h1>PRIVATE_PROXY_DIAGNOSTIC_MUST_NOT_RENDER</h1>'});
   if(mode==='invalid-json'&&reads===1)return request.respond({status:200,contentType:'application/json',body:'{"PRIVATE_PARSE_DIAGNOSTIC_MUST_NOT_RENDER":'});
   if(mode==='wrong-scope')return respond({...payload(),scope:otherScope});if(mode==='wrong-role')return respond({...payload(),role:'DIRECTOR'});
   if(mode==='pagination'){if(reads===1){assert.equal(url.searchParams.has('afterProject'),false);return respond(payload(Array.from({length:50},(_,i)=>taskRow(i+1)),'p-050'));}assert.equal(url.searchParams.get('afterProject'),'p-050');return respond(payload([taskRow(51)]));}
   return respond(payload());
  }catch(error){errors.push({mode,width,message:error.message});await request.abort().catch(()=>{});}});
  await page.goto(origin,{waitUntil:'networkidle0'});await wait(page,'Consultar resumen');assert.equal(requests.length,0,'No automatic aggregate/provider read');
  if(mode==='locked'){await click(page,'Acción en curso');assert.equal(await page.$eval('section button',node=>node.disabled),true);assert.equal(requests.length,0);await click(page,'Acción en curso');}
  await click(page,'Consultar resumen');
  if(mode==='stale'||mode==='unmount'){
   for(let i=0;i<40&&!held;i++)await new Promise(resolve=>setTimeout(resolve,50));assert.ok(held);
   await click(page,mode==='stale'?'Cambiar contexto':'Desmontar');await held();await new Promise(resolve=>setTimeout(resolve,200));
   assert.equal(await page.$$('article').then(rows=>rows.length),0);assert.doesNotMatch(await page.$eval('body',node=>node.innerText),/Obra de ensayo 1|1 obra consultada/);assert.equal(requests.length,1);
  }else if(['wrong-scope','wrong-role'].includes(mode)){
   await wait(page,'La respuesta no coincide');assert.equal(await page.$$('article').then(rows=>rows.length),0);assert.equal(requests.length,1);
  }else if(['503','401','403','409','503-html','401-html','403-html','409-html','invalid-json'].includes(mode)){
   const status=mode.slice(0,3);
   await wait(page,mode==='invalid-json'?'La respuesta del resumen no pudo leerse':status==='503'?'No se pudo consultar':status==='409'?'Cambió el contexto':'Tu acceso cambió');assert.equal(await page.$$('article').then(rows=>rows.length),0);assert.equal(requests.length,1);
   assert.doesNotMatch(await page.$eval('body',node=>node.innerText),/PRIVATE_PROXY_DIAGNOSTIC|PRIVATE_PARSE_DIAGNOSTIC|SyntaxError|Unexpected token/);
   if(['401','403','409'].includes(status))await wait(page,'Acceso invalidado');else assert.equal(await page.$eval('[data-denied]',node=>node.textContent),'');
   await page.evaluate(()=>{window.__tokenEpoch=2;});await click(page,'Actualizar resumen');await wait(page,'1 obra consultada');assert.equal(requests.length,2);assert.equal(requests.at(-1).authorization,'Bearer synthetic-portfolio-2');
  }else{
   await wait(page,mode==='pagination'?'50 obras consultadas':'1 obra consultada');
   if(mode==='pagination'){await click(page,'Consultar más obras');await wait(page,'51 obras consultadas');assert.equal(await page.$$('article').then(rows=>rows.length),51);assert.equal(await page.$$eval('button',nodes=>nodes.some(node=>node.textContent==='Consultar más obras')),false);assert.equal(requests.length,2);}
   else assert.equal(requests.length,1);
   assert.ok(await page.$$eval('article dl',nodes=>nodes.every(node=>node.innerText.includes('Bloqueadas')&&node.innerText.includes('Por planificar'))));
   await click(page,'Abrir Obra de ensayo 1');assert.equal(await page.$eval('[data-selected]',node=>node.textContent),'p-001');assert.equal(requests.length,mode==='pagination'?2:1);
   const button=await page.$('section button');await button.focus();await page.keyboard.press('Tab');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');assert.equal(await page.$eval('section button',node=>node===document.activeElement),true);assert.equal(await button.evaluate(node=>getComputedStyle(node).outlineStyle),'solid');
   assert.ok(await page.$$eval('section button',nodes=>nodes.every(node=>node.getBoundingClientRect().height>=44)));
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow '+mode+' '+width);
  assert.deepEqual(await page.evaluate(()=>[Object.keys(localStorage),Object.keys(sessionStorage)]),[[],[]],'No portfolio persistence');
  if(mode==='success'||mode==='dark')await page.screenshot({path:path.join(scratch,`portfolio-${mode}-${width}.png`),fullPage:true});
  checks.push({mode,width,reads:requests.length,providerCalls:0,mutations:0,horizontalOverflow:false});await context.close();
 }
 assert.deepEqual(errors,[]);
}catch(error){writeFileSync(path.join(scratch,'portfolio-overview-ui-failure.json'),JSON.stringify({error:error.message,log,errors,checks,sourceManifest},null,2));throw error;}
finally{await browser?.close();await stopServer();const target=realpathSync(fixture);assert.equal(path.dirname(target),realpathSync(scratch));assert.ok(path.basename(target).startsWith('portfolio-ui-'));rmSync(target,{recursive:true,force:true});removed=!existsSync(target);}
assert.equal(removed,true);for(const source of sourceManifest)assert.equal(sha(source.path),source.sha256,'Source changed during UI checks');
const result={state:'PASS_LOCAL_UI_NOT_RELEASE_ACCEPTANCE',sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceManifest,harnessSha256:sha('scripts/verify-portfolio-overview-ui.mjs'),checks,widths,errors,fixtureRemoved:true,providerCalls:0,productionDataWritten:false};
writeFileSync(path.join(scratch,'portfolio-overview-ui-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,sourceManifest:sourceManifest.length,checks:checks.length}));
