import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'An isolated local fixture is required');
const root=process.cwd(),output=path.join(root,'.vercel/pwa-evidence');
mkdirSync(output,{recursive:true});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=name=>readFileSync(path.join(root,name));
const manifest=JSON.parse(file('public/manifest.json'));
const publicPaths=['/manifest.json','/icon-192.svg','/icon-512.svg','/brand/obrasaas-app-icon.svg','/brand/obrasaas-app-icon-192.png','/brand/obrasaas-app-icon-512.png','/brand/obrasaas-maskable-512.png'];
const tracked=['public/sw.js',...publicPaths.map(name=>'public'+name),'src/app/fonts/inter-latin-variable.woff2','scripts/verify-pwa-browser.mjs','tests/production-access-boundary.test.mjs','tests/production-brand-v3.test.mjs','scripts/verify-brand-v3-browser.mjs','.github/workflows/production-boundary.yml'];
const sourceManifest=tracked.map(name=>({path:name,sha256:digest(file(name))}));
const checks=[],screenshots=[],externalRequests=[],pageErrors=[],requests=[];
const state={actor:'A',authorized:true};
const privateMarker=actor=>'PRIVATE_TENANT_'+actor+'_SENTINEL';
const documentHtml=actor=>'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PWA fixture</title><body><h1 id="fixture-title">Ensayo aislado</h1><p id="fixture-data">'+privateMarker(actor)+'</p></body></html>';
const mime=name=>name.endsWith('.json')?'application/manifest+json':name.endsWith('.png')?'image/png':'image/svg+xml';
const server=createServer((request,response)=>{
 const url=new URL(request.url,'http://fixture.invalid');
 const log={method:request.method,path:url.pathname,query:url.search};requests.push(log);
 let status=200,contentType='text/plain; charset=utf-8',body='Controlled fixture',cacheControl='private, no-store';
 if(request.method!=='GET') {status=503;contentType='application/json';body=JSON.stringify({code:'SYNTHETIC_UNCONFIRMED'});}
 else if(url.pathname==='/sw.js'){contentType='application/javascript; charset=utf-8';body=file('public/sw.js');cacheControl='no-store';}
 else if(publicPaths.includes(url.pathname)){contentType=mime(url.pathname);body=file('public'+url.pathname);cacheControl='no-store';}
 else if(url.pathname==='/api/identity/workspace'){status=state.authorized?200:401;contentType='application/json';body=JSON.stringify(state.authorized?{scope:'synthetic-'+state.actor,marker:privateMarker(state.actor)}:{code:'SYNTHETIC_SESSION_REQUIRED'});}
 else if(url.pathname==='/cuenta'||url.pathname==='/dashboard'){status=state.authorized?200:401;contentType='text/html; charset=utf-8';body=state.authorized?documentHtml(state.actor):'<html><body><h1>Synthetic access denied</h1></body></html>';}
 else if(url.pathname==='/fixture'){contentType='text/html; charset=utf-8';body='<!doctype html><html><title>PWA public fixture</title><body>Public fixture bootstrap</body></html>';}
 else if(url.pathname==='/_next/static/fixture.js'){contentType='application/javascript';body='window.__fixtureScriptLoaded=true;';}
 else if(url.pathname==='/_next/static/fixture.css'){contentType='text/css';body='body{color:#102a3c}';}
 else if(url.pathname==='/_next/static/fixture.woff2'){contentType='font/woff2';body=file('src/app/fonts/inter-latin-variable.woff2');}
 else if(url.pathname==='/media/private-image.png'){contentType='image/png';body=file('public/brand/obrasaas-app-icon-192.png');}
 else {status=404;body='Controlled fixture route not found';}
 log.status=status;response.writeHead(status,{'Content-Type':contentType,'Cache-Control':cacheControl,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self'; img-src 'self'"});response.end(body);
});
let browser,page,origin,workerSession;
const postCount=()=>requests.filter(request=>request.method==='POST').length;
const documentCount=()=>requests.filter(request=>request.method==='GET'&&request.path==='/cuenta').length;
async function json(pathname,options){return page.evaluate(async(target,init)=>{const response=await fetch(target,init);return {status:response.status,type:response.headers.get('content-type'),cache:response.headers.get('cache-control'),body:await response.json()};},pathname,options);}
async function snapshotCaches(){return page.evaluate(async()=>{
 const result=[];for(const name of await caches.keys()){const cache=await caches.open(name);result.push({name,urls:(await cache.keys()).map(request=>new URL(request.url).pathname+new URL(request.url).search)});}return result;
});}
async function setOffline(offline){
 await page.setOfflineMode(offline);
 await workerSession.send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:-1,uploadThroughput:-1});
}
try {
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 origin='http://127.0.0.1:'+server.address().port;
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
 // The fixture and worker responses restrict requests to this origin with CSP.
 // Avoid Puppeteer's Fetch interception: it can hide controlled navigations'
 // HTTPResponse objects, which are needed to assert actual offline status/MIME.
 page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin&&!['data:','blob:'].includes(url.protocol))externalRequests.push({url:request.url(),method:request.method()});});
 await page.goto(origin+'/fixture',{waitUntil:'load'});
 await page.evaluate(async()=>{
  const old=await caches.open('obrasaas-public-v5');
  await old.put('/manifest.json',new Response('{"oldOwnManifest":true}'));
  await old.put('/cuenta',new Response('PRIVATE_OLD_OWN_DOCUMENT_SENTINEL'));
  await old.put('/api/identity/workspace',new Response('PRIVATE_OLD_OWN_API_SENTINEL'));
  const unrelated=await caches.open('unrelated-pwa-fixture');
  await unrelated.put('/manifest.json',new Response('{"poisonedUnrelatedManifest":true}'));
  await unrelated.put('/cuenta',new Response('PRIVATE_UNRELATED_DOCUMENT_SENTINEL'));
  await unrelated.put('/api/identity/workspace',new Response('PRIVATE_UNRELATED_API_SENTINEL'));
  await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
 });
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:15000});
 const workerTarget=browser.targets().find(target=>target.type()==='service_worker'&&target.url()===origin+'/sw.js');
 assert.ok(workerTarget,'Activated worker target is missing');workerSession=await workerTarget.createCDPSession();await workerSession.send('Network.enable');
 const cacheState=await snapshotCaches();
 assert.deepEqual(cacheState.map(cache=>cache.name).sort(),['obrasaas-public-v6','unrelated-pwa-fixture']);
 assert.deepEqual(cacheState.find(cache=>cache.name==='obrasaas-public-v6').urls.sort(),[...publicPaths].sort());
 assert.equal(cacheState.find(cache=>cache.name==='unrelated-pwa-fixture').urls.length,3);
 checks.push({case:'real-sw-activation-purges-own-private-old-cache-and-preserves-unrelated',cacheState});

 const deliveredManifest=await json('/manifest.json');assert.equal(deliveredManifest.status,200);assert.deepEqual(deliveredManifest.body,manifest);
 assert.equal(manifest.id,'/dashboard');assert.equal(manifest.start_url,'/cuenta');assert.equal(manifest.scope,'/');assert.equal(manifest.icons.length,4);
 assert.doesNotMatch(manifest.description,/KYC biométrico|compliance normativo/i);
 assert.equal(deliveredManifest.body.poisonedUnrelatedManifest,undefined);
 checks.push({case:'installed-id-stable-canonical-start-and-named-public-cache',id:manifest.id,startUrl:manifest.start_url});
 for(const icon of manifest.icons){
  assert.ok(publicPaths.includes(icon.src));
  const response=await fetch(origin+icon.src);assert.equal(response.status,200);assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(file('public'+icon.src)));
  const decoded=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};},icon.src);
  assert.ok(decoded.width>0&&decoded.height>0);if(icon.sizes!=='any')assert.equal(decoded.width+'x'+decoded.height,icon.sizes);
  checks.push({case:'real-manifest-icon-delivery-and-decode',path:icon.src,...decoded});
 }
 await page.goto(origin+manifest.start_url,{waitUntil:'load'});
 assert.equal(await page.$eval('#fixture-data',element=>element.textContent),privateMarker('A'));
 const first=await json('/api/identity/workspace');assert.equal(first.body.marker,privateMarker('A'));assert.match(first.cache,/private, no-store/);
 state.authorized=false;
 const denied=await json('/api/identity/workspace');assert.equal(denied.status,401);assert.equal(denied.body.marker,undefined);
 const deniedPage=await page.goto(origin+'/cuenta?fixture=logout',{waitUntil:'load'});assert.equal(deniedPage.status(),401);assert.ok(!(await page.content()).includes(privateMarker('A')));
 state.actor='B';state.authorized=true;
 await page.goto(origin+'/cuenta?fixture=tenant-B',{waitUntil:'load'});assert.equal(await page.$eval('#fixture-data',element=>element.textContent),privateMarker('B'));
 const changed=await json('/api/identity/workspace');assert.equal(changed.body.marker,privateMarker('B'));
 assert.deepEqual((await snapshotCaches()).find(cache=>cache.name==='obrasaas-public-v6').urls.sort(),[...publicPaths].sort());
 checks.push({case:'controlled-logout-401-and-tenant-change-use-network-never-cache-private-responses',realAuthentication:false});

 const failedPost=await json('/api/synthetic-operation',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"operation":"explicit-synthetic-attempt"}'});assert.equal(failedPost.status,503);assert.equal(postCount(),1);
 await setOffline(true);
 const offlineApi=await json('/api/identity/workspace');assert.equal(offlineApi.status,503);assert.match(offlineApi.type,/application\/json/);assert.match(offlineApi.cache,/private, no-store/);assert.equal(offlineApi.body.code,'OFFLINE_AUTH_REQUIRED');assert.doesNotMatch(JSON.stringify(offlineApi.body),/PRIVATE_.*SENTINEL/);
 checks.push({case:'offline-api-is-json-503-no-store-without-private-cache-sentinels'});
 const resourcePaths=['/_next/static/fixture.js','/_next/static/fixture.css','/_next/static/fixture.woff2','/media/private-image.png','/cuenta','/cuenta?_rsc=synthetic','/manifest.json?stale=1','/brand/obrasaas-app-icon.svg/extra','/brand/private.json'];
 const resourceFailures=await page.evaluate(async targets=>{
  const failures=[];for(const target of targets){try{const response=await fetch(target,{headers:target.includes('_rsc')?{'RSC':'1'}:{}});failures.push({target,resolved:true,status:response.status,type:response.headers.get('content-type')});}catch(error){failures.push({target,resolved:false,name:error.name});}}return failures;
 },resourcePaths);
 assert.ok(resourceFailures.every(result=>result.resolved===false&&result.name==='TypeError'),JSON.stringify(resourceFailures));
 const nativeLoads=await page.evaluate(async()=>{
  const load=(tag,url)=>new Promise(resolve=>{const element=document.createElement(tag);element.onload=()=>resolve('loaded');element.onerror=()=>resolve('error');if(tag==='link'){element.rel='stylesheet';element.href=url;}else element.src=url;document.head.append(element);});
  const [script,style,image,font]=await Promise.all([load('script','/_next/static/fixture.js'),load('link','/_next/static/fixture.css'),load('img','/media/private-image.png'),new FontFace('FixtureOffline','url(/_next/static/fixture.woff2)').load().then(()=> 'loaded',()=> 'error')]);return {script,style,image,font};
 });
 assert.deepEqual(nativeLoads,{script:'error',style:'error',image:'error',font:'error'});
 checks.push({case:'offline-js-css-font-image-rsc-query-and-near-allowlist-requests-fail-without-html',resourceFailures,nativeLoads});
 const offlinePosts=await page.evaluate(async()=>{const results=[];for(const method of ['POST','PUT','PATCH','DELETE']){try{await fetch('/api/synthetic-operation',{method,body:'synthetic-offline-command'});results.push({method,resolved:true});}catch(error){results.push({method,resolved:false,name:error.name});}}return results;});
 assert.ok(offlinePosts.every(result=>!result.resolved&&result.name==='TypeError'));assert.equal(postCount(),1);
 checks.push({case:'explicit-failed-post-and-offline-mutations-are-not-queued',offlinePosts,serverPostCount:postCount()});

 const invitation='invite_'+'c'.repeat(32),target='/cuenta?participar='+invitation;
 const offlinePage=await page.goto(origin+target,{waitUntil:'load'});assert.equal(offlinePage.status(),503);
 assert.match(offlinePage.headers()['content-type'],/text\/html/);assert.match(offlinePage.headers()['cache-control'],/private, no-store/);
 const offlineHtml=await page.content();assert.doesNotMatch(offlineHtml,/PRIVATE_.*SENTINEL|poisonedUnrelatedManifest|invite_c+/);assert.ok(offlineHtml.includes('no se reenvían automáticamente'));
 assert.equal(await page.$eval('main img',element=>element.complete&&element.naturalWidth>0),true);
 const offlineManifest=await json('/manifest.json');assert.deepEqual(offlineManifest.body,manifest);
 checks.push({case:'offline-document-is-generic-branded-503-and-only-exact-public-assets-survive'});
 for(const width of [320,390,768,1280]){
  await page.setViewport({width,height:950,hasTouch:width<768});
  const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brandVisible:(()=>{const rectangle=document.querySelector('.brand').getBoundingClientRect();return rectangle.top>=0&&rectangle.left>=0&&rectangle.right<=innerWidth;})(),targets:[...document.querySelectorAll('a,button')].map(element=>({text:element.textContent.trim(),width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}))}));
  assert.equal(geometry.overflow,false);assert.equal(geometry.brandVisible,true);assert.ok(geometry.targets.every(target=>target.height>=44&&target.width>=44));
  await page.focus('#offline-retry button');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'/cuenta');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');
  const screenshot='offline-'+width+'.png';await page.screenshot({path:path.join(output,screenshot),fullPage:true});screenshots.push(screenshot);
  checks.push({case:'offline-mobile-keyboard-targets-brand-and-no-overflow',width,...geometry});
 }
 const beforeReconnect={documents:documentCount(),posts:postCount()};
 await page.evaluate(()=>{window.__onlineEvents=0;window.addEventListener('online',()=>{window.__onlineEvents++;});});
 await setOffline(false);await page.waitForFunction(()=>navigator.onLine&&window.__onlineEvents===1,{timeout:15000});
 // Observe the settled online event before the only user-initiated GET. No
 // framework, session provider or background queue runs in this isolated page.
 await new Promise(resolve=>setTimeout(resolve,500));
 assert.equal(documentCount(),beforeReconnect.documents);assert.equal(postCount(),beforeReconnect.posts);assert.ok(await page.$('#offline-title'));
 await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.keyboard.press('Enter')]);
 assert.equal(documentCount(),beforeReconnect.documents+1);assert.equal(postCount(),1);assert.equal(page.url(),origin+target);assert.equal(await page.$eval('#fixture-data',element=>element.textContent),privateMarker('B'));
 checks.push({case:'reconnection-never-navigates-or-replays-until-one-explicit-keyboard-get',explicitGetCount:1,postCount:postCount(),invitationContextPreserved:true});
 await page.setViewport({width:390,height:950,hasTouch:true});await setOffline(true);
 const touchOffline=await page.goto(origin+'/cuenta?fixture=touch',{waitUntil:'load'});assert.equal(touchOffline.status(),503);
 const beforeTouch={documents:documentCount(),posts:postCount()};await setOffline(false);
 await page.waitForFunction(()=>navigator.onLine,{timeout:15000});assert.equal(documentCount(),beforeTouch.documents);
 await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.tap('#offline-retry button')]);
 assert.equal(documentCount(),beforeTouch.documents+1);assert.equal(postCount(),beforeTouch.posts);assert.equal(await page.$eval('#fixture-data',element=>element.textContent),privateMarker('B'));
 checks.push({case:'one-explicit-emulated-mobile-tap-get-without-mutation-replay',width:390,explicitGetCount:1});
 assert.equal(requests.some(request=>request.path==='/dashboard'),false);
 assert.deepEqual((await snapshotCaches()).find(cache=>cache.name==='obrasaas-public-v6').urls.sort(),[...publicPaths].sort());
 assert.deepEqual(pageErrors,[]);assert.deepEqual(externalRequests,[]);
 const proof={status:'PASS',environment:'real-chrome-service-worker-trusted-http-loopback-controlled-public-and-private-fixtures',checks,sourceManifest,screenshots,requests,externalRequests,pageErrors,actualServiceWorkerTested:true,cacheUpgradeFrom:'obrasaas-public-v5',cacheVersion:'obrasaas-public-v6',realAuthentication:false,realClerkLogin:false,realProviderCalls:0,productionDataWritten:false,physicalDeviceAccepted:false,installedHomeScreenAccepted:false,automaticRecoveryPostCount:0};
 for(const name of ['failure.json','failure.png']){const file=path.join(output,name);if(existsSync(file))unlinkSync(file);}
 writeFileSync(path.join(output,'proof.json'),JSON.stringify(proof,null,2));
 console.log(JSON.stringify({status:'PASS',checks:checks.length,widths:[320,390,768,1280],automaticRecoveryPosts:0,providerCalls:0,evidence:path.join(output,'proof.json')}));
} catch(error) {
 writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,sourceManifest,requests,externalRequests,pageErrors},null,2));
 await page?.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;
} finally {
 await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
