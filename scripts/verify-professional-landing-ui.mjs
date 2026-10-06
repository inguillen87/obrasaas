import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer';

assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV,'Local UI evidence only');
const root=process.cwd(),parent=path.join(root,'.vercel'),output=path.join(parent,'professional-landing-evidence');
mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(parent,'professional-landing-ui-')),app=path.join(fixture,'app');
const files=['src/app/page.js','src/app/page.module.css','src/app/landing-interactions.js','src/app/layout.js','src/app/globals.css','src/app/brand/brand-logo.js','src/app/brand/brand-logo.module.css','src/app/brand/brand-geometry.js'];
for(const source of files){const target=path.join(app,source.replace('src/app/',''));mkdirSync(path.dirname(target),{recursive:true});copyFileSync(path.join(root,source),target);assert.deepEqual(readFileSync(path.join(root,source)),readFileSync(target));}
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
const port=3136,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let log='',browser;for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{log=(log+data).slice(-14000);});
const checks=[],errors=[],mutations=[],widths=[320,390,768,1280];
const legal=['ObraSaaS, un producto de Inmovar LATAM','Ing. Marcelo Ariel Guillén Alba · Fundador','Arq. María Victoria Schiaffino · Socia','Titular: GUILLEN ALBA, MARCELO ARIEL','Nombre registrado en ARCA: GUILLEN MARCELO ARIEL'];
const sourceManifest=files.map(file=>({path:file,sha256:createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')}));
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const wait=(page,fn,...args)=>page.waitForFunction(fn,{},...args);
const legacyRoutes=['/pricing','/api-docs','/onboarding','/dashboard','/bim','/portal','/marketplace','/superadmin'];
async function canonicalNavigation(page){
 // Inspect every rendered link, including the closed mobile menu and server-only
 // fallback. Presentation must not expose legacy promises or internal entrypoints.
 const paths=await page.$$eval('a[href]',links=>links.map(link=>decodeURIComponent(new URL(link.href).pathname).replace(/\/+$/,'')));
 const legacy=paths.filter(route=>legacyRoutes.some(prefix=>route===prefix||route.startsWith(prefix+'/')));
 assert.deepEqual(legacy,[],'Public landing links to a legacy route');
}
async function geometry(page){return page.evaluate(()=>{
 const visible=element=>{const closed=element.closest('details:not([open])');if(closed&&!element.closest('summary'))return false;const r=element.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(element).visibility!=='hidden';};
 const main=document.querySelector('main'),h1=main.querySelector('h1'),targets=[...document.querySelectorAll('a,summary')].filter(visible).map(element=>({label:(element.getAttribute('aria-label')||element.textContent).trim().slice(0,80),height:Math.round(element.getBoundingClientRect().height)}));
 const overflow=[...document.querySelectorAll('main *,header *,footer *')].filter(element=>visible(element)&&!element.closest('svg')).map(element=>({element:element.tagName,label:element.textContent.trim().slice(0,45),rect:element.getBoundingClientRect()})).filter(({rect})=>rect.left<-.6||rect.right>innerWidth+.6).map(({element,label})=>({element,label}));
 return {documentOverflow:document.documentElement.scrollWidth>innerWidth,overflow,targets,heroOpacity:getComputedStyle(h1).opacity,heroVisible:h1.getBoundingClientRect().height>0,headline:h1.textContent,exampleLabels:[...document.querySelectorAll('[data-landing-example]')].map(example=>({kind:example.dataset.landingExample,visibleLabel:/Ejemplo ilustrativo|Conversación de ejemplo/.test(example.textContent)})),activeAnimations:document.getAnimations().filter(animation=>animation.playState==='running'&&animation.effect?.target?.closest?.('main')).length};
 });}
try{
 let ready=false;for(let i=0;i<90;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,'Landing server did not start');
 const raw=await(await fetch(origin)).text();assert.ok(raw.includes('La obra avanza.')&&raw.includes('El control,'),'Main content missing from server HTML');for(const value of legal)assert.ok(raw.includes(value.replace('Titular: ','').replace('Nombre registrado en ARCA: ','')),'Public identity text missing from server HTML');assert.equal(readFileSync(path.join(root,'src/app/page.js'),'utf8').includes('use client'),false,'The full page must remain a Server Component');
 for(const route of ['src/app/(identity)/sign-up/[[...sign-up]]/page.js','src/app/(identity)/cuenta/page.js','src/app/manual/page.js','src/app/demo/page.js'])assert.ok(existsSync(path.join(root,route)),'Real CTA route missing: '+route);
 browser=await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of widths)for(const reduced of [false,true]){
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/hydration|hydrated|didn't match/i.test(message.text()))errors.push('Hydration warning: '+message.text().slice(0,120));});await page.setViewport({width,height:1000});await page.setBypassServiceWorker(true);await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]);await page.setRequestInterception(true);
  page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method())){mutations.push({method:request.method(),path:new URL(request.url()).pathname});void request.abort();}else void request.continue();});
  await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await page.evaluate(()=>document.fonts.ready);await wait(page,()=>document.querySelector('[data-landing-motion]')?.dataset.landingMotion==='assisted');await new Promise(resolve=>setTimeout(resolve,800));
  const measured=await geometry(page);assert.equal(measured.documentOverflow,false,'Document overflow '+width);assert.deepEqual(measured.overflow,[],'Content clipping '+width);assert.equal(measured.heroOpacity,'1');assert.equal(measured.heroVisible,true);assert.ok(measured.exampleLabels.every(example=>example.visibleLabel));for(const target of measured.targets)assert.ok(target.height>=48,'Small target '+width+' '+target.label+' '+target.height);
  const identity=await page.$eval('[data-public-site-identity]',node=>node.innerText);for(const value of legal)assert.ok(identity.includes(value),'Legal footer changed');
  const footer=await page.$eval('footer',node=>({height:node.getBoundingClientRect().height,legalLines:[...node.querySelectorAll('[data-public-site-identity] p')].map(line=>({fontSize:parseFloat(getComputedStyle(line).fontSize),wraps:line.scrollWidth<=line.clientWidth}))}));assert.ok(footer.legalLines.every(line=>line.fontSize>=12.8&&line.wraps),'Canonical public identity readability');if(width<=768)assert.ok(footer.height<=400,'Compact mobile footer '+width+' '+footer.height);
  const hrefs=await page.$$eval('a',links=>links.map(link=>link.getAttribute('href')));for(const href of ['/sign-up','/cuenta','/manual','/demo'])assert.ok(hrefs.includes(href),'CTA missing '+href);await canonicalNavigation(page);assert.equal(await page.$$eval('a button,button a',nodes=>nodes.length),0,'Nested interactive controls');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Saltar al contenido');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'contenido');
  if(width<=820){const summary=await page.$('header details summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.$eval('header details',node=>node.open),true);await wait(page,()=>document.querySelector('header details a').getBoundingClientRect().height>0);assert.deepEqual((await geometry(page)).overflow,[],'Open menu overflow '+width);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'La plataforma');await page.keyboard.press('Escape');assert.equal(await page.$eval('header details',node=>node.open),false);assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');await page.keyboard.press('Enter');await page.click('header details a[href="#whatsapp"]');assert.equal(await page.$eval('header details',node=>node.open),false);assert.equal(new URL(page.url()).hash,'#whatsapp');}
  const faq=await page.$('[data-landing-faq="0"] summary');await faq.focus();await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-landing-faq="0"]',node=>node.open),true);await page.keyboard.press('Enter');assert.equal(await page.$eval('[data-landing-faq="0"]',node=>node.open),false);
  await page.$eval('[data-landing-transition="receipt"]',node=>node.scrollIntoView({block:'center'}));
  if(reduced){await new Promise(resolve=>setTimeout(resolve,150));assert.equal(await page.$eval('[data-landing-transition="receipt"]',node=>getComputedStyle(node).opacity),'1');assert.equal(await page.$eval('[data-landing-transition="receipt"]',node=>node.dataset.landingTransitionState),'idle');}
  else await wait(page,()=>document.querySelector('[data-landing-transition="receipt"]').dataset.landingTransitionState==='finished');
  if(reduced){assert.equal(measured.activeAnimations,0,'Reduced motion animation still running');assert.ok(await page.$$eval('[data-landing-motion]',elements=>elements.every(element=>getComputedStyle(element).transform==='none')));}
  await page.evaluate(()=>scrollTo(0,0));if(!reduced){await page.screenshot({path:path.join(output,'landing-'+width+'.png'),fullPage:true});await page.screenshot({path:path.join(output,'hero-'+width+'.png'),fullPage:false});}
  checks.push({width,reducedMotion:reduced,ssrVisible:true,receiptTransition:reduced?'disabled':'viewport-once-completed',overflow:false,keyboardSkip:true,nativeFaq:true,menuKeyboard:width<=820,legalFooterExact:true,labeledExamples:true,targetsAtLeast48px:true,legacyNavigationExposed:false,activeMainAnimations:measured.activeAnimations});await page.close();
 }
 for(const width of [320,1280]){const page=await browser.newPage();await page.setJavaScriptEnabled(false);await page.setViewport({width,height:1000});await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await canonicalNavigation(page);const measured=await geometry(page);assert.equal(measured.heroVisible,true);assert.equal(measured.heroOpacity,'1');assert.equal(measured.documentOverflow,false);await page.click('[data-landing-faq="0"] summary');assert.equal(await page.$eval('[data-landing-faq="0"]',node=>node.open),true);if(width===320){await page.click('header details summary');assert.equal(await page.$eval('header details',node=>node.open),true);}checks.push({width,javascript:false,ssrVisible:true,nativeFaq:true,nativeMenu:width===320,overflow:false,legacyNavigationExposed:false});await page.close();}
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
 const proof={status:'PASS',environment:'isolated-next-server-with-exact-landing-brand-global-layout-sources',widths,checks,errors,mutations,rawServerHtmlBytes:Buffer.byteLength(raw),sourceManifest,harnessSha256,productionWritten:false,providerWrites:0,authenticatedUserTested:false,physicalMobileAccepted:false};writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:proof.status,checks:checks.length,widths,ssrWithoutJavascript:true,reducedMotion:true,providerWrites:0}));
}catch(error){writeFileSync(path.join(output,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,checks,errors,mutations,log},null,2));console.error(log);throw error;}
finally{await browser?.close();server.kill();const resolved=path.resolve(fixture);assert.ok(resolved.startsWith(path.resolve(parent)+path.sep)&&path.basename(resolved).startsWith('professional-landing-ui-'));rmSync(resolved,{recursive:true,force:true});}
