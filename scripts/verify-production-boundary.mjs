import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
const folder = path.resolve('.vercel/production-boundary-evidence'); mkdirSync(folder,{recursive:true});
const port=3229, base=`http://127.0.0.1:${port}`, secret=randomBytes(32).toString('hex');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  env:{...process.env,INTERNAL_API_SECRET:secret,META_APP_SECRET:'unit-only-meta-secret',PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'unit-only-no-storage-calls',NODE_ENV:'production'},stdio:['ignore','pipe','pipe']});
let startup='';server.stdout.on('data',data=>{startup+=data;});server.stderr.on('data',data=>{startup+=data;});
let browser;const checks=[];
try {
  let ready=false;
  for(let i=0;i<60;i++){
    if(server.exitCode!==null)throw new Error('Server stopped before test: '+startup);
    try {if((await fetch(base+'/api/health')).status===200){ready=true;break;}} catch {}
    await new Promise(done=>setTimeout(done,500));
  }
  assert.ok(ready,'Next production server did not start');
  for(const route of ['/api/state','/api/v1/calendario','/api/v1/workers','/api/v1/system/db-status','/api/realtime','/api/webview/kyc','/api/billing/webhook']){
    for(const method of ['GET','POST','DELETE']){
      const response=await fetch(base+route,{method,headers:{'content-type':'application/json'},...(method==='POST'?{body:'{}'}:{})});
      assert.equal(response.status,401,method+' '+route);assert.match(response.headers.get('cache-control'),/private, no-store/);
      assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');checks.push({method,route,status:response.status});
    }
  }
  for(const headers of [{origin:base,referer:base+'/dashboard'},{'x-api-key':'internal'},{'x-api-key':'obrasaas_admin_key'},{cookie:'obrasaas_logged_in=true'},{'x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy'}]){
    const response=await fetch(base+'/api/state',{headers});assert.equal(response.status,401);
  }
  assert.equal((await fetch(base+'/api/does-not-exist',{headers:{authorization:'Bearer '+secret}})).status,404);
  assert.equal((await fetch(base+'/api/whatsapp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
  for(const route of ['/dashboard','/superadmin','/calendario','/documentos','/bim','/portal']){
    const response=await fetch(base+route,{redirect:'manual'});assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location'),base).pathname,'/sign-in');
  }
  for(const route of ['/','/sign-in','/sign-up','/bim_render.png','/cctv_render.png','/api/health']) assert.equal((await fetch(base+route)).status,200,route);
  for(const body of ['{', '[]', '{}', JSON.stringify({workerId:'unit',dniFrontBase64:'invalid',selfieBase64:'invalid'})]){
    const response=await fetch(base+'/api/webview/kyc',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body});
    assert.equal(response.status,400);const result=await response.json();assert.equal(result.success,false);assert.equal(result.verified,false);
    assert.ok(result.code.startsWith('PRIVATE_IMAGE_'));assert.match(response.headers.get('cache-control'),/no-store/);
  }
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/api/health');
  await page.evaluate(async()=>{
    const cache=await caches.open('obrasaas-v3');await cache.put('/api/state',new Response('{"privateFixture":"cached"}'));
    await caches.open('unrelated-cache');
    localStorage.setItem('obrasaas_logged_in','true');localStorage.setItem('obrasaas_user_role','admin');
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('obrasaas-offline',1);request.onupgradeneeded=()=>request.result.createObjectStore('obrasaas-offline-queue',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=reject;});
    await new Promise((resolve,reject)=>{const tx=db.transaction('obrasaas-offline-queue','readwrite');tx.objectStore('obrasaas-offline-queue').put({id:1,body:'unit-pending-operation'});tx.oncomplete=resolve;tx.onerror=reject;});db.close();
  });
  await page.goto(base+'/dashboard',{waitUntil:'networkidle0'});
  assert.equal(new URL(page.url()).pathname,'/sign-in');
  await page.waitForFunction(()=>localStorage.getItem('obrasaas_logged_in')===null);
  assert.equal(await page.$('input[type=password]'),null);
  for(const width of [320,390,768,1280]){
    await page.setViewport({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width);
    if([390,1280].includes(width))await page.screenshot({path:path.join(folder,`access-${width}.png`),fullPage:true});
  }
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  const cacheKeys=await page.evaluate(()=>caches.keys());assert.ok(!cacheKeys.includes('obrasaas-v3'));assert.ok(cacheKeys.includes('unrelated-cache'));
  // Page-scoped offline emulation does not disable a service worker's network.
  // Stop this disposable origin instead, and prove its socket is unreachable.
  const stopped=new Promise(done=>server.once('exit',done));server.kill('SIGTERM');await stopped;
  let unavailable=false;try{await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)});}catch{unavailable=true;}
  assert.equal(unavailable,true,'Test origin must be disconnected before offline assertion');
  const offline=await page.evaluate(async()=>{const r=await fetch('/api/state');return {status:r.status,body:await r.text()};});
  assert.equal(offline.status,503);assert.ok(!offline.body.includes('privateFixture'));
  const pendingCount=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('obrasaas-offline',1);request.onerror=reject;request.onsuccess=()=>{const db=request.result;const tx=db.transaction('obrasaas-offline-queue','readonly');const count=tx.objectStore('obrasaas-offline-queue').count();count.onsuccess=()=>{resolve(count.result);db.close();};};
  }));assert.equal(pendingCount,1);assert.deepEqual(errors,[]);
  const proof={status:'PASS',environment:'local-built-Next-production-server',realDatabase:false,syntheticCredentials:true,acceptedBusinessWrites:0,
    protectedRequests:checks,forgedCredentialsRejected:true,authorizedUnknownRoute:404,privateNavigationProtected:true,kycInvalidRequestsRejectedBeforeProviders:4,
    publicSiteAccessible:true,viewports:[320,390,768,1280],legacyCacheRemoved:true,offlinePrivateReadBlocked:true,offlineMechanism:'disposable-origin-stopped',pendingQueueRetained:true,pageErrors:errors};
  writeFileSync(path.join(folder,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(folder,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,startup},null,2));throw error;
}finally{await browser?.close();server.kill('SIGTERM');}
