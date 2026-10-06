import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { IDENTITY_ORIGIN, IDENTITY_PUBLIC_KEY, IDENTITY_INSTANCE } from '../src/lib/production-identity-config.mjs';
const folder = path.resolve(process.env.PRODUCTION_BOUNDARY_OUTPUT_DIR || '.vercel/production-boundary-evidence'); mkdirSync(folder,{recursive:true});
const port=3229, base=`http://127.0.0.1:${port}`, secret=randomBytes(32).toString('hex'),customerVerifyToken=randomBytes(32).toString('hex');
let startup='';
function startServer(configured){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  env:{...process.env,INTERNAL_API_SECRET:secret,META_APP_SECRET:'unit-only-meta-secret',META_CUSTOMER_VERIFY_TOKEN:customerVerifyToken,META_VERIFY_TOKEN:customerVerifyToken,META_CUSTOMER_CREDENTIALS_KEY:randomBytes(32).toString('base64'),PRIVATE_MEDIA_PROVIDER:'vercel-blob',BLOB_READ_WRITE_TOKEN:'unit-only-no-storage-calls',NODE_ENV:'production',VERCEL_ENV:'development',NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:configured?IDENTITY_PUBLIC_KEY:'',CLERK_EXPECTED_INSTANCE_ID:configured?IDENTITY_INSTANCE:'',NEXT_PUBLIC_APP_URL:configured?IDENTITY_ORIGIN:'',CLERK_AUTHORIZED_PARTIES:configured?IDENTITY_ORIGIN:''},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',data=>{startup+=data;});child.stderr.on('data',data=>{startup+=data;});return child;
}
let server=startServer(true);
async function waitForServer(){
 for(let i=0;i<60;i++){
  if(server.exitCode!==null)throw new Error('Server stopped before test: '+startup);
  try {if((await fetch(base+'/api/health')).status===200)return;}catch{}
  await new Promise(done=>setTimeout(done,500));
 }
 throw new Error('Next production server did not start');
}
async function stopServer(){if(server.exitCode!==null)return;const stopped=new Promise(done=>server.once('exit',done));server.kill('SIGTERM');await stopped;}
let browser;const checks=[];
const publicIdentityText=['ObraSaaS, un producto de Inmovar LATAM','Ing. Marcelo Ariel Guillén Alba · Fundador','Arq. María Victoria Schiaffino · Socia','Titular: GUILLEN ALBA, MARCELO ARIEL','Nombre registrado en ARCA: GUILLEN MARCELO ARIEL'];
const publicIdentityViewports=[];
try {
  await waitForServer();
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
  const customerCallbackChecks=[];
  const unsigned=await fetch(base+'/api/meta/customer-callback',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(unsigned.status,403);assert.equal((await unsigned.json()).code,'META_CUSTOMER_SIGNATURE_REJECTED');customerCallbackChecks.push({method:'POST',result:'unsigned-rejected',status:403});
  const handshake=await fetch(base+'/api/meta/customer-callback?'+new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'123456'}));
  assert.equal(handshake.status,403);assert.equal((await handshake.json()).code,'META_CUSTOMER_SIGNATURE_REJECTED');customerCallbackChecks.push({method:'GET',result:'wrong-handshake-token-rejected',status:403});
  for(const method of ['HEAD','OPTIONS','PUT','PATCH','DELETE']){
    const response=await fetch(base+'/api/meta/customer-callback',{method});assert.equal(response.status,401);customerCallbackChecks.push({method,result:'method-not-allowlisted',status:401});
  }
  for(const route of ['/api/meta/customer-callback/fake','/api/meta/customer-callback-extra','/api/identity/meta-onboarding/fake','/api/identity/participants/fake']){
    const response=await fetch(base+route);assert.equal(response.status,401);assert.equal((await response.json()).code,'AUTHENTICATION_REQUIRED');customerCallbackChecks.push({route,result:'prefix-not-allowlisted',status:401});
  }
  for(const method of ['GET','POST']) {
    const url=base+'/api/webhooks/whatsapp'+(method==='GET'?'?'+new URLSearchParams({'hub.mode':'subscribe','hub.verify_token':'wrong','hub.challenge':'123456'}):'');
    const response=await fetch(url,{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:'{}'}:{})});
    assert.equal(response.status,403);assert.equal((await response.json()).code,'META_CUSTOMER_SIGNATURE_REJECTED');customerCallbackChecks.push({route:'/api/webhooks/whatsapp',method,result:'unsigned-protocol-rejected',status:403});
  }
  for(const method of ['HEAD','OPTIONS','PUT','PATCH','DELETE'])assert.equal((await fetch(base+'/api/webhooks/whatsapp',{method})).status,401);
  for(const route of ['/api/webhooks/whatsapp/fake','/api/webhooks/whatsapp-extra','/api/identity/demo-pilot/fake','/manual/private'])assert.equal((await fetch(base+route,{redirect:'manual'})).status,route==='/manual/private'?307:401);
  const workspaceSessionChecks=[];
  for(const [route,methods] of [
    ['/api/identity/participants',['GET','POST']],['/api/identity/participant-join',['GET','POST']],['/api/identity/worker-channel',['GET','POST']],
    ['/api/identity/field-operations',['GET','POST']],['/api/identity/field-media',['GET','POST']],
    ['/api/identity/field-qr',['GET']],['/api/identity/site-purchases',['GET','POST']],
    ['/api/identity/operations-status',['GET']],['/api/identity/meta-onboarding',['GET','POST']],
    ['/api/identity/demo-pilot',['GET','POST']],
  ])for(const method of methods){
    const response=await fetch(base+route,{method,headers:{'content-type':'application/json',origin:IDENTITY_ORIGIN},...(method==='POST'?{body:'{}'}:{})});
    assert.equal(response.status,401,method+' '+route);assert.equal((await response.json()).code,'SESSION_REQUIRED');assert.match(response.headers.get('cache-control'),/private, no-store/);workspaceSessionChecks.push({route,method,status:401});
  }
  for(const method of ['GET','POST']){const response=await fetch(base+'/api/meta/customer-process',{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:'{}'}:{})});assert.equal(response.status,403);assert.equal((await response.json()).code,'META_CUSTOMER_JOB_SIGNATURE_REJECTED');customerCallbackChecks.push({route:'/api/meta/customer-process',method,result:'missing-job-credential-rejected',status:403});}
  for(const route of ['/dashboard','/superadmin','/calendario','/documentos','/bim','/portal']){
    const response=await fetch(base+route,{redirect:'manual'});assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location'),base).pathname,'/sign-in');
  }
  for(const route of ['/','/manual','/sign-in','/sign-up','/bim_render.png','/cctv_render.png','/api/health']) assert.equal((await fetch(base+route)).status,200,route);
  const homeHtml=await (await fetch(base+'/',{redirect:'manual'})).text();
  const footerHtml=homeHtml.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footerHtml,'The public home must serve its footer in the initial HTML');
  const footerText=footerHtml.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  for(const text of publicIdentityText)assert.ok(footerText.includes(text),'Initial footer HTML must identify '+text);
  assert.match(homeHtml,/<title>ObraSaaS[^<]*<\/title>/,'The home metadata must retain the product identity');
  for(const body of ['{', '[]', '{}', JSON.stringify({workerId:'unit',dniFrontBase64:'invalid',selfieBase64:'invalid'})]){
    const response=await fetch(base+'/api/webview/kyc',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},body});
    assert.equal(response.status,400);const result=await response.json();assert.equal(result.success,false);assert.equal(result.verified,false);
    assert.ok(result.code.startsWith('PRIVATE_IMAGE_'));assert.match(response.headers.get('cache-control'),/no-store/);
  }
  const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==';
  const kyc=await fetch(base+'/api/webview/kyc',{method:'POST',headers:{authorization:'Bearer '+secret,'content-type':'application/json'},
    body:JSON.stringify({workerId:'unit-worker',dniFrontBase64:pixel,selfieBase64:pixel,verified:true,voiceEnrolled:true})});
  const kycResult=await kyc.json();assert.equal(kyc.status,503);assert.equal(kycResult.code,'KYC_REVIEW_WORKFLOW_REQUIRED');
  assert.equal(kycResult.verified,false);assert.equal(kycResult.evidenceStored,false);assert.equal(kycResult.attendanceRegistered,false);
  // API denial checks use only public identity configuration and no session.
  // The original browser checks require the pending identity page, without
  // loading a real Clerk provider or making external authentication requests.
  await stopServer();server=startServer(false);await waitForServer();
  browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request',request=>new URL(request.url()).origin===base?request.continue():request.abort());
  await page.setJavaScriptEnabled(false);
  await page.goto(base+'/',{waitUntil:'networkidle0'});
  for(const width of [320,390,768,1280]){
    await page.setViewport({width,height:900});
    const identity=await page.$eval('[data-public-site-identity]',node=>{
      const bounds=node.getBoundingClientRect();
      return {text:node.innerText.replace(/\s+/g,' ').trim(),visible:getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility==='visible'&&Number(getComputedStyle(node).opacity)>0,
        withinViewport:bounds.left>=0&&bounds.right<=innerWidth,linesFit:[...node.querySelectorAll('p')].every(line=>{
          const range=document.createRange();range.selectNodeContents(line);const style=getComputedStyle(line);
          return line.scrollWidth<=line.clientWidth&&parseFloat(style.fontSize)>=12.8&&style.visibility==='visible'&&Number(style.opacity)>0&&[...range.getClientRects()].every(rect=>rect.left>=0&&rect.right<=innerWidth);
        })};
    });
    assert.equal(identity.visible,true,'Public identity must remain visible without JavaScript at '+width);
    assert.equal(identity.withinViewport,true,'Public identity must fit the viewport at '+width);
    assert.equal(identity.linesFit,true,'Public identity text must wrap at '+width);
    for(const text of publicIdentityText)assert.ok(identity.text.includes(text),'Public identity at '+width+': '+text);
    const footerHeight=await page.$eval('footer',node=>node.getBoundingClientRect().height);
    if(width<=768)assert.ok(footerHeight<=400,'Mobile footer must remain compact at '+width+': '+footerHeight+'px');
    assert.equal(await page.$$eval('footer a',links=>links.every(link=>link.getBoundingClientRect().height>=44)),true,'Footer touch targets at '+width);
    if([320,1280].includes(width))await (await page.$('footer')).screenshot({path:path.join(folder,`public-identity-${width}.png`)});
    publicIdentityViewports.push({width,javascript:false,visible:true,withinViewport:true,textWraps:true,footerHeight,touchTargetsAtLeast44:true});
  }
  await page.setJavaScriptEnabled(true);
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
    protectedRequests:checks,workspaceSessionChecks,customerCallbackChecks,customerCallbackDatabaseCalls:0,identityPhases:['configured-public-values-no-session-api-denials','configuration-pending-original-browser-and-offline-checks'],forgedCredentialsRejected:true,authorizedUnknownRoute:404,privateNavigationProtected:true,kycInvalidRequestsRejectedBeforeProviders:4,validImagePairCannotAutoApprove:true,
    publicSiteAccessible:true,publicSiteIdentity:{initialHtml:true,metadataBrandRetained:true,text:publicIdentityText,viewports:publicIdentityViewports,externalBrowserRequestsBlocked:true},viewports:[320,390,768,1280],legacyCacheRemoved:true,offlinePrivateReadBlocked:true,offlineMechanism:'disposable-origin-stopped',pendingQueueRetained:true,pageErrors:errors};
  writeFileSync(path.join(folder,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(folder,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,startup},null,2));throw error;
}finally{await browser?.close();server.kill('SIGTERM');}
