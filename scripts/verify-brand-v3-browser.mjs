import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import puppeteer from 'puppeteer';
import {BRAND_PUBLIC_ASSETS} from '../src/lib/brand-assets.mjs';
import {OBRA_SAAS_STRUCTURE_PATH,OBRA_SAAS_TRACE_PATH} from '../src/app/brand/brand-geometry.js';
const live=process.env.BRAND_LIVE_ORIGIN;
assert.ok(!live||live==='https://obrasaas.com','Only the ObraSaaS production origin is accepted for live checks');
const base=live||'http://127.0.0.1:3231',folder=resolve('.vercel/brand-v3-evidence'+(live?'-live':''));
mkdirSync(folder,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
let server,browser,startup='',page;
const checks=[],pageErrors=[];
if(!live){
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3231'],{
  env:{...process.env,NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',data=>{startup+=data;});server.stderr.on('data',data=>{startup+=data;});
}
try{
 if(server){let ready=false;for(let i=0;i<60;i++){
  if(server.exitCode!==null)throw new Error('Next test server exited before acceptance');
  try{if((await fetch(base+'/api/health')).status===200){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }assert.ok(ready,'Next test server not available');}

 for(const path of [...BRAND_PUBLIC_ASSETS,'/favicon.ico','/icon-192.svg','/icon-512.svg']){
  const response=await fetch(base+path,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,path);assert.match(response.headers.get('content-type')||'',/image\//,path);
  const local=(path.startsWith('/brand/')||path.startsWith('/icon-'))?'public'+path:'src/app'+path;
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(digest(bytes),digest(readFileSync(resolve(local))),path);
  checks.push({path,status:200,sha256:digest(bytes)});
 }
 const response=await fetch(base+'/manifest.json',{cache:'no-store'}),manifest=await response.json();
 assert.equal(manifest.id,'/dashboard');assert.equal(manifest.icons.length,4);assert.equal(manifest.screenshots,undefined);
 for(const icon of manifest.icons)assert.ok(icon.src.startsWith('/brand/'));checks.push({path:'/manifest.json',status:response.status});
 for(const path of ['/api/state','/api/v1/workers']){
  const denied=await fetch(base+path,{redirect:'manual',cache:'no-store'});assert.equal(denied.status,401,path);await denied.body?.cancel();checks.push({path,status:401});
 }
 for(const path of ['/brand/private.json','/brand/obrasaas-app-icon-192.png/extra']){
  const denied=await fetch(base+path,{redirect:'manual'});assert.ok([307,401,403,404].includes(denied.status),path);await denied.body?.cancel();
 }
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',request=>{
  const url=new URL(request.url());
  // Anonymous Clerk component bootstrap creates only its browser client.
  // No user, sign-in attempt or business operation is submitted by this test.
  const bootstrap=request.method()==='POST'&&url.origin==='https://clerk.obrasaas.com'&&url.pathname==='/v1/client';
  return ['GET','HEAD','OPTIONS'].includes(request.method())||bootstrap?request.continue():request.abort();
 });
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await page.goto(base+'/api/health',{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{const old=await caches.open('obrasaas-public-v4');await old.put('/manifest.json',new Response('{"oldLogoFixture":true}'));await caches.open('unrelated-cache-brand-fixture');});

 const surfaces=[];
 for(const route of ['/','/sign-in','/sign-up','/cuenta']){
  await page.goto(base+route,{waitUntil:'networkidle2'});
  await page.waitForSelector('[data-brand="obrasaas-v3"]',{timeout:15000});
  const geometry=await page.$$eval('[data-brand="obrasaas-v3"]',nodes=>nodes.map(node=>({
   text:node.textContent.replace(/\s/g,''),paths:[...node.querySelectorAll('path')].map(path=>path.getAttribute('d')),
   rect:node.getBoundingClientRect().toJSON(),font:getComputedStyle(node.querySelector('strong')).fontFamily,
   animations:[...node.querySelectorAll('path')].map(path=>getComputedStyle(path).animationName)})));
  assert.ok(geometry.length>=(route==='/'?2:1),route);
  for(const item of geometry){assert.equal(item.text,'ObraSaaS');assert.deepEqual(item.paths,[OBRA_SAAS_STRUCTURE_PATH,OBRA_SAAS_TRACE_PATH]);assert.ok(item.rect.width>=120&&item.rect.height>=24);assert.match(item.font,/Manrope/);assert.ok(item.animations.every(name=>name==='none'));}
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('header div,header span,main a span')].some(node=>node.childElementCount===0&&node.textContent.trim()==='OS')),false);
  const sizes=[];
  for(const width of [320,390,768,1280]){
   await page.setViewport({width,height:950});await new Promise(resolve=>setTimeout(resolve,100));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+' overflow '+width);
   if([390,1280].includes(width)&&['/','/sign-in'].includes(route))await page.screenshot({path:resolve(folder,(route==='/'?'home':'access')+'-'+width+'.png'),fullPage:route!=='/'});
   sizes.push(width);
  }
  const icons=await page.$$eval('link[rel="icon"],link[rel="apple-touch-icon"]',nodes=>nodes.map(node=>new URL(node.href).pathname));
  assert.ok(icons.includes('/icon.png'),route+' metadata icon');assert.ok(icons.includes('/apple-icon.png'),route+' Apple metadata');
  surfaces.push({route,logoCount:geometry.length,widths:sizes,canonicalPathsMatch:true,reducedMotion:true,metadataIcons:icons});
 }

 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 const cachesNow=await page.evaluate(()=>caches.keys());
 assert.ok(cachesNow.includes('obrasaas-public-v5'));assert.ok(!cachesNow.includes('obrasaas-public-v4'));assert.ok(cachesNow.includes('unrelated-cache-brand-fixture'));
 const freshManifest=await page.evaluate(async()=>{const result=await fetch('/manifest.json');return result.json();});
 assert.equal(freshManifest.oldLogoFixture,undefined);assert.ok(freshManifest.icons.every(icon=>icon.src.startsWith('/brand/')));
 const privateStatus=await page.evaluate(async()=>(await fetch('/api/state')).status);assert.equal(privateStatus,401);
 assert.deepEqual(pageErrors,[]);
 const proof={status:'PASS',base,environment:live?'live-production-anonymous':'built-Next-local',approvedSource:'1677ff72773c95140535603093e5cb8624d1f063',checks,surfaces,
  staleBrandCacheRemoved:true,unrelatedCachePreserved:true,privateApiStatus:privateStatus,authenticatedUserTested:false,businessWrites:0,pageErrors};
 writeFileSync(resolve(folder,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){
 writeFileSync(resolve(folder,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,pageErrors,checks,startup},null,2));
 await page?.screenshot({path:resolve(folder,'failure.png'),fullPage:true}).catch(()=>{});throw error;
}finally{await browser?.close();server?.kill('SIGTERM');}
