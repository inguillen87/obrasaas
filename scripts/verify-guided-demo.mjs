import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer';
const live=process.env.GUIDED_DEMO_LIVE_ORIGIN;
assert.ok(!live||live==='https://obrasaas.com');
const base=live||'http://127.0.0.1:3237',folder=resolve('.vercel/guided-demo-evidence'+(live?'-live':''));mkdirSync(folder,{recursive:true});
let server,browser,page;
const errors=[],unexpected=[],calls=[];
if(!live){server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3237'],{env:{...process.env,NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});server.stdout.resume();server.stderr.resume();}
try{
 if(server){let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base+'/api/health')).status===200){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}assert.ok(ready);}
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);page.on('request',request=>{const url=new URL(request.url());
  if(!['GET','HEAD','OPTIONS'].includes(request.method())){unexpected.push({method:request.method(),path:url.pathname});request.abort();return;}
  if(url.pathname.startsWith('/api/'))calls.push(url.pathname);request.continue();});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.goto(base+'/demo',{waitUntil:'networkidle2'});await page.waitForSelector('[data-demo-only="true"]');
 assert.equal(await page.$('input,form,textarea'),null);assert.ok(await page.$('[data-brand="obrasaas-v3"]'));
 const count=type=>page.$eval(`[data-demo-count="${type}"]`,element=>Number(element.textContent));
 const click=label=>page.evaluate(text=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent.trim()===text);if(!button)throw new Error('Missing control '+text);button.click();},label);
 const view=label=>page.evaluate(text=>{const title=[...document.querySelectorAll('nav button strong')].find(node=>node.textContent===text);if(!title)throw new Error('Missing view '+text);title.parentElement.click();},label);
 assert.equal(await count('total'),0);
 for(const label of ['Identidad','Foto de obra','Nota de voz']){await click(label);await click('Añadir ejemplo a la bandeja');await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(node=>node.textContent==='Ejemplo añadido'&&node.disabled));}
 assert.equal(await count('total'),3);assert.equal(await count('pending'),3);
 const surfaces=[];
 for(const label of ['Operario','Encargado','Director']){
  await view(label);if(label==='Encargado'){await click('Simular revisión');await page.waitForFunction(()=>document.querySelector('[data-demo-count="reviewed"]').textContent==='1');}
  for(const width of [320,390,768,1280]){await page.setViewport({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' overflow '+width);
   if([390,1280].includes(width))await page.screenshot({path:resolve(folder,label.toLowerCase()+'-'+width+'.png'),fullPage:true});}
  surfaces.push({view:label,widths:[320,390,768,1280]});
 }
 assert.equal(await count('reviewed'),1);assert.equal(await count('pending'),2);
 await click('Reiniciar demo');await page.waitForFunction(()=>document.querySelector('[data-demo-count="total"]').textContent==='0');
 await click('Añadir ejemplo a la bandeja');assert.equal(await count('total'),1);await page.reload({waitUntil:'networkidle2'});assert.equal(await count('total'),0);
 await page.goto(base+'/demo?tenantId=other&role=superadmin',{waitUntil:'networkidle2'});assert.equal(await count('total'),0);
 const selectedView=await page.$eval('nav button[aria-pressed="true"] strong',node=>node.textContent);assert.equal(selectedView,'Operario');
 assert.deepEqual(calls,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
 const denied=await fetch(base+'/api/state',{redirect:'manual'});assert.equal(denied.status,401);await denied.body?.cancel();
 const nested=await fetch(base+'/demo/private',{redirect:'manual'});assert.ok([307,401,403,404].includes(nested.status));await nested.body?.cancel();
 const proof={status:'PASS',base,environment:live?'live-public-demo':'built-local-demo',businessWrites:0,apiRequestsFromDemo:0,realPeopleTested:false,
  perspectiveChangesDoNotGrantRoles:true,exampleReviewWorks:true,reloadClearsExamples:true,resetWorks:true,privateApiStatus:401,surfaces,pageErrors:errors};
 writeFileSync(resolve(folder,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(folder,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,errors,unexpected,calls},null,2));await page?.screenshot({path:resolve(folder,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await browser?.close();server?.kill('SIGTERM');}
