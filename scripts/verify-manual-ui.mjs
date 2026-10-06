import assert from 'node:assert/strict';
import {copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer';

assert.ok(!process.env.VERCEL && !process.env.VERCEL_ENV, 'Manual browser fixture is local only');
const root = process.cwd(), parent = path.resolve(root, '.vercel'), evidence = path.join(parent, 'manual-evidence');
mkdirSync(evidence, {recursive:true});
const fixture = mkdtempSync(path.join(parent, 'manual-ui-')), app = path.join(fixture, 'app');
mkdirSync(path.join(app, 'manual'), {recursive:true});
mkdirSync(path.join(app, 'brand'));
for (const file of ['page.js', 'manual.module.css']) copyFileSync(path.join(root, 'src/app/manual', file), path.join(app, 'manual', file));
for (const file of ['brand-logo.js', 'brand-logo.module.css', 'brand-geometry.js']) copyFileSync(path.join(root, 'src/app/brand', file), path.join(app, 'brand', file));
copyFileSync(path.join(root,'src/app/globals.css'),path.join(app,'globals.css'));
writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({name:'actual-public-manual-ui', private:true}));
writeFileSync(path.join(fixture, 'next.config.mjs'), `export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app, 'layout.js'), `import './globals.css';export default function Layout({children}) { return <html lang="es"><body style={{margin:0,fontFamily:'Arial'}}>{children}</body></html> }`);
// Only destination pages are controlled. The manual, logo and styles are actual application source.
for (const route of ['', 'cuenta', 'sign-in', 'sign-up']) {
 const directory = path.join(app, route); mkdirSync(directory, {recursive:true});
 writeFileSync(path.join(directory, 'page.js'), `export default function Page(){return <main><h1>Destino local de prueba</h1><a href="/manual">Volver al manual</a></main>}`);
}
const port = '3184', origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',port], {cwd:root, env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}, stdio:['ignore','pipe','pipe'], detached:process.platform!=='win32'});
let browser, page, log = '', failure;
const checks = [], errors = [], requests = [], widths = [320,390,768,1280];
for (const stream of [server.stdout,server.stderr]) stream.on('data', chunk => { log = (log + chunk.toString()).slice(-10000); });
const sectionIds = ['empezar','equipo','trabajo','cronograma','inventario','clientes','whatsapp','menu','recuperacion','equipo-tecnico'];
const luminance = values => values.map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,index)=>sum+n*[.2126,.7152,.0722][index],0);
function ratio(foreground,background){const a=luminance(foreground),b=luminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
function stopOwned(pid){if(process.platform!=='win32'){try{process.kill(-pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}return;}const result=spawnSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{stdio:'ignore'});if(result.status!==0){try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}assert.equal(result.status,0,'Owned process cleanup failed');}}
try {
 let ready=false;
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw new Error('Manual fixture server exited');try{if((await fetch(origin+'/manual')).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 assert.ok(ready,'Manual fixture became ready');
 const html=await (await fetch(origin+'/manual')).text();
 assert.ok(html.includes('Tu primera obra'));assert.ok(html.includes('comparación facial'));checks.push('anonymous-server-rendered-manual-without-session');
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
 await page.setRequestInterception(true);
 page.on('request',async request=>{const url=new URL(request.url()),controlledFont=url.origin==='https://fonts.googleapis.com'&&url.pathname==='/css2'&&request.method()==='GET';requests.push({method:request.method(),path:url.pathname,external:url.origin!==origin,controlledFont});if(controlledFont)return request.respond({status:200,contentType:'text/css',body:''});if(url.origin!==origin||url.pathname.startsWith('/api/')||!['GET','HEAD'].includes(request.method())){errors.push('Unexpected non-readonly manual request');return request.abort();}return request.continue();});
 for(const width of widths){
  await page.setViewport({width,height:1050});const response=await page.goto(origin+'/manual',{waitUntil:'networkidle0',timeout:90000});assert.equal(response.status(),200);
  assert.equal(await page.$$eval('h1',nodes=>nodes.length),1);assert.equal(await page.$eval('html',node=>node.lang),'es');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Manual overflow at ${width}`);
  assert.ok(await page.$('[data-brand="obrasaas-v3"]'));
  assert.ok(await page.$eval('header nav a[href="/cuenta"]',node=>node.getClientRects().length>0),'Account navigation remains visible under global mobile CSS');
  await page.screenshot({path:path.join(evidence,`manual-${width}.png`),fullPage:true});
  checks.push('readable-canonical-brand-and-no-horizontal-overflow-'+width);
 }
 await page.setViewport({width:390,height:1050});await page.goto(origin+'/manual',{waitUntil:'networkidle0'});
 const links=await page.$$eval('a',nodes=>nodes.map(node=>({href:node.getAttribute('href'),name:node.textContent.trim()||node.getAttribute('aria-label')})));
 for(const link of links){assert.ok(link.name);assert.ok(link.href.startsWith('#')||['/','/cuenta','/sign-in','/sign-up'].includes(link.href));if(link.href.startsWith('#'))assert.ok(await page.$(link.href));}
 for(const id of sectionIds){const section=await page.$('#'+id);assert.ok(section);assert.ok(await section.evaluate(node=>document.getElementById(node.getAttribute('aria-labelledby'))?.textContent));}
 checks.push('all-index-links-and-heading-landmarks-resolve');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Ir al contenido del manual');
 const outline=await page.evaluate(()=>getComputedStyle(document.activeElement).outlineWidth);assert.equal(outline,'3px');await page.keyboard.press('Enter');assert.ok(page.url().endsWith('#contenido-manual'));checks.push('keyboard-visible-skip-link');
 await page.$eval('#whatsapp details summary',node=>node.focus());await page.keyboard.press('Enter');assert.equal(await page.$eval('#whatsapp details',node=>node.open),true);await page.keyboard.press('Enter');assert.equal(await page.$eval('#whatsapp details',node=>node.open),false);checks.push('native-keyboard-expand-and-collapse');
 await page.$$eval('details',nodes=>nodes.forEach(node=>{node.open=true;}));
 const text=await page.evaluate(()=>document.body.innerText);
 for(const phrase of ['requieren autorizaciones independientes','La selfie es una imagen estática','no certifica prueba de vida','Pendientes de aceptación de cuenta','IDENTIDAD','recordatorio de jornada abierta','aviso de revisión de avance','distinto de su autor','ficha, KYC, vínculo de WhatsApp y consentimiento vigentes','Una propuesta ya notificada no genera otro aviso','El envío y la entrega no aprueban avances ni modifican tareas o el Gantt','sus envíos proactivos siguen pendientes de completar sus circuitos','no genera cotizaciones','No son una copia de tus borradores','no repite el envío','no se presume activo','Ese PIN no es el código de verificación recibido','Una implementación local o un recibo de preparación no acreditan']) assert.ok(text.includes(phrase),`Missing truthful boundary: ${phrase}`);
 assert.ok(!/sk_(live|test)_|whsec_|eyJ[a-zA-Z0-9_-]+\./.test(text));
  for(const phrase of ['coexistencia','Cloud API o un proveedor','no se garantiza un historial completo','no abre la ventana de respuesta ni ejecuta jornada, identidad o avance','no desconecta el proveedor existente','ventana de 24 horas','Sólo guardar','WhatsApp personal requiere primero el traslado oficial a Business App con respaldo','no borres tu cuenta ni desinstales la app'])assert.ok(text.includes(phrase),`Missing number-preservation boundary: ${phrase}`);
 assert.equal(await page.$$eval('form,input,textarea',nodes=>nodes.length),0);
 checks.push('truthful-identity-whatsapp-crm-offline-and-publication-boundaries');
 checks.push('public-manual-does-not-collect-credentials-or-personal-data');
 const contrast=await page.$eval('#empezar p:not([class])',node=>{const color=getComputedStyle(node).color.match(/[\d.]+/g).slice(0,3).map(Number);let parent=node,background;while(parent){const value=getComputedStyle(parent).backgroundColor;if(value!=='rgba(0, 0, 0, 0)'){background=value.match(/[\d.]+/g).slice(0,3).map(Number);break;}parent=parent.parentElement;}return {color,background};});
 const contrastRatio=ratio(contrast.color,contrast.background);assert.ok(contrastRatio>=4.5);checks.push('body-text-contrast-at-least-4point5');
 await page.screenshot({path:path.join(evidence,'manual-390-expanded.png'),fullPage:true});
 await page.$eval('a[href="/cuenta"]',node=>node.focus({preventScroll:true}));assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'/cuenta');await page.keyboard.press('Enter');await page.waitForFunction(()=>location.pathname==='/cuenta',{timeout:15000});checks.push('keyboard-account-navigation-uses-local-destination');
 assert.deepEqual(errors,[]);assert.ok(requests.every(request=>(!request.external||request.controlledFont)&&!request.path.startsWith('/api/')&&['GET','HEAD'].includes(request.method)));checks.push('no-private-api-provider-request-or-business-write');
 writeFileSync(path.join(evidence,'browser.json'),JSON.stringify({status:'PASS',environment:'actual-static-manual-global-styles-local-next-and-chrome',checkedAt:new Date().toISOString(),checks,widths,errors,contrastRatio,requestCount:requests.length,controlledExternalFontRequests:requests.filter(row=>row.controlledFont).length,privateApiRequests:0,realProviderCalls:0,businessWrites:0,realLoginTested:false,humanPilotAccepted:false},null,2));
}catch(error){failure=error;await page?.screenshot({path:path.join(evidence,'browser-failure.png'),fullPage:true}).catch(()=>{});writeFileSync(path.join(evidence,'browser-failure.json'),JSON.stringify({message:error.message,checks,errors,log},null,2));}
finally{if(browser){if(process.platform==='win32'){const pid=browser.process().pid;browser.disconnect();stopOwned(pid);}else await browser.close();}stopOwned(server.pid);const target=path.resolve(fixture);assert.ok(target.startsWith(parent+path.sep)&&path.basename(target).startsWith('manual-ui-'));rmSync(target,{recursive:true,force:true});}
if(failure)throw failure;
console.log(JSON.stringify({status:'PASS',checks:checks.length,pageErrors:errors.length,widths}));
