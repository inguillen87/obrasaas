import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {applyPurchase,normalizePurchase} from '../src/lib/site-purchase-policy.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),output=path.join(root,'.vercel/purchase-evidence');mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/purchase-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const name of ['site-purchase-panel.js','site-purchase-panel.module.css'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',name),path.join(app,name));
for(const dependency of ['workspace-session-request.mjs','workspace-request-lifecycle.mjs','workspace-request-lifecycle.js','workspace-recovery-journal.mjs','workspace-recovery-storage.mjs','private-workspace-download.js'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',dependency),path.join(app,dependency));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({private:true,name:'controlled-purchase-ui'}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081c2d',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-a';
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {SitePurchasePanel} from './site-purchase-panel';const getSessionToken=async()=>window.__missingTabSession?null:'active-tab-controlled-token';export default function Page(){const [pending,setPending]=useState(false);const onPending=useCallback(value=>setPending(value),[]);return <main style={{maxWidth:1000,margin:'0 auto'}}><button data-testid="project-switch" disabled={pending}>Cambiar obra</button><SitePurchasePanel getSessionToken={getSessionToken} projectId="${projectId}" scope="${scope}" onPending={onPending}/></main>}`);
const origin='http://127.0.0.1:3118',server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port','3118'],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let log='',browser;const errors=[],checks=[];for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{log=(log+chunk).slice(-15000);});
const wait=(page,value)=>page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:15000},value);
async function click(page,title){const h=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),title);assert.ok(h.asElement(),'Missing '+title);await h.asElement().click();await h.dispose();}
async function fill(page,title,value){const h=await page.evaluateHandle(text=>[...document.querySelectorAll('label')].find(l=>l.textContent.trim()===text)?.querySelector('input,textarea'),title);assert.ok(h.asElement(),'Missing '+title);await h.asElement().click({clickCount:3});await h.asElement().type(value);await h.dispose();}
async function scenario(width,mode='normal') {
 const ctx=await browser.createBrowserContext(),page=await ctx.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',e=>errors.push(e.message));await page.setRequestInterception(true);
 let version=1,metadata={siteRegister:{version:1,type:'MATERIAL_REQUEST',state:'OPEN',quantity:'12.5',unit:'bolsa',sector:'Planta baja'}};
 const revision=()=>`2026-10-01T12:00:00.${String(version).padStart(6,'0')}`;
 const publicRecord=()=>({id:'request-a',material:'Cemento de ensayo',requestedQuantity:'12.5',unit:'bolsa',sector:'Planta baja',requestState:metadata.siteRegister.state,revision:revision(),order:metadata.procurement||null});
 const posts=[],receipts=new Map();let applications=0,statusChecks=0;
 page.on('request',async request=>{
  try {
   const url=new URL(request.url());if(url.pathname.startsWith('/api/identity/'))assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');if(url.origin!==origin)return request.abort();if(url.pathname!=='/api/identity/site-purchases')return request.continue();
   let body,status=200;
   if(mode==='denied'){status=403;body={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
   else if(request.method()==='POST') {
    const command=normalizePurchase(JSON.parse(request.postData()));posts.push(command);assert.equal(command.projectId,projectId);assert.equal(command.scope,scope);assert.equal(command.payload.revision,revision());
    if(mode==='conflict'){status=409;body={code:'PURCHASE_REVISION_CHANGED'};}
    else if(mode==='not-arrived'&&posts.length===1){await request.abort('failed');return;}
    else if(['rollback','session-after-unknown-retry'].includes(mode)&&posts.length===1){status=503;body={code:'PURCHASE_OPERATION_UNCONFIRMED'};}
    else {metadata=applyPurchase(metadata,command,'controlled-actor','2026-10-01T12:00:00Z');applications++;version++;body={scope,saved:true,replayed:false,receiptId:'receipt-'+command.operationId,record:publicRecord()};receipts.set(command.operationId,body);if(mode==='uncertain'){status=503;body={code:'PURCHASE_OPERATION_UNCONFIRMED'};}}
   }else if(url.searchParams.has('operationId')){statusChecks++;const found=receipts.get(url.searchParams.get('operationId'));body=found?{...found,state:'RECORDED'}:{scope,state:'NOT_OBSERVED',definitive:false};}
   else body={scope,projectId,records:[publicRecord()],total:1,nextCursor:null};
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(e){errors.push(e.message);if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Abrir compras');
 if(mode==='denied'){await wait(page,'No se pudo confirmar');assert.equal(posts.length,0);checks.push('denied-no-example-purchases');await ctx.close();return;}
 await wait(page,'Cemento de ensayo');await click(page,'Preparar compra');
 await fill(page,'Proveedor','Proveedor de ensayo');await fill(page,'Precio unitario','123.45');await fill(page,'Referencia de cotización','Cotización 01');await fill(page,'Motivo o detalle','Cotización documentada en este ensayo.');
 assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));assert.ok(!(await page.$eval('form input',e=>e.disabled)));
 if(mode==='draft-cancel'){await click(page,'Volver');await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('[data-testid="project-switch"]').disabled);assert.equal(posts.length,0);checks.push('purchase-draft-locks-project-until-explicit-cancel');await ctx.close();return;}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(mode==='session-before-send')await page.evaluate(()=>{window.__missingTabSession=true;});await click(page,'Confirmar operación');
 if(mode==='session-before-send'){await wait(page,'Tu sesión terminó');assert.equal(posts.length,0);assert.equal(applications,0);assert.equal(await page.$eval('form input',e=>e.value),'Proveedor de ensayo');assert.equal(await page.$eval('form input',e=>e.disabled),false);assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Comprobar compra guardada'));await page.evaluate(()=>{window.__missingTabSession=false;});await click(page,'Confirmar operación');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);assert.equal(applications,1);checks.push('missing-session-before-first-post-preserves-draft-with-no-phantom-receipt');await ctx.close();return;}
 if(mode==='uncertain'){await wait(page,'El resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar compra guardada');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovery-without-second-post');await ctx.close();return;}
 if(['rollback','not-arrived','session-after-unknown-retry'].includes(mode)) {
  await wait(page,'El resultado quedó sin confirmar');assert.equal(posts.length,1);assert.equal(applications,0);
  assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Reintentar la misma operación'));
  assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>['Actualizar compras','Volver','Confirmar operación'].includes(b.textContent.trim())).every(b=>b.disabled)));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea,form select')].every(e=>e.disabled)));
  await click(page,'Comprobar compra guardada');await wait(page,'No se observa un recibo todavía');
  assert.equal(statusChecks,1);assert.equal(posts.length,1);assert.equal(await page.$eval('input',e=>e.value),'Proveedor de ensayo');
  assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
  if(mode==='session-after-unknown-retry'){await page.evaluate(()=>{window.__missingTabSession=true;});await click(page,'Reintentar la misma operación');await wait(page,'Tu sesión terminó');assert.equal(posts.length,1);assert.equal(applications,0);assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));await page.evaluate(()=>{window.__missingTabSession=false;});await click(page,'Comprobar compra guardada');await wait(page,'No se observa un recibo todavía');assert.equal(posts.length,1);checks.push('unsent-retry-keeps-the-previous-uncertain-operation-and-its-receipt-path');}await click(page,'Reintentar la misma operación');await wait(page,'Recibo confirmado');
  assert.equal(posts.length,2);assert.deepEqual(posts[1],posts[0]);assert.equal(applications,1);assert.equal(metadata.procurement.state,'DRAFT');
  assert.ok(!(await page.$eval('[data-testid="project-switch"]',e=>e.disabled)));
  assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Reintentar la misma operación'));
  checks.push(mode+'-checked-then-exact-retry-with-one-persisted-order');await ctx.close();return;
 }
 if(mode==='conflict'){await wait(page,'Otra persona cambió');assert.equal(await page.$eval('input',e=>e.value),'Proveedor de ensayo');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo confirmado'));checks.push('conflict-preserves-entered-quote');await ctx.close();return;}
 await wait(page,'1543.13 ARS');await click(page,'Autorizar compra');await fill(page,'Motivo o detalle','Importe autorizado por responsable en este ensayo.');await click(page,'Confirmar operación');await wait(page,'Compra autorizada');
 await click(page,'Registrar entrega');await fill(page,'Cantidad recibida (bolsa)','4.25');await fill(page,'Remito o referencia de entrega','Remito 01');await fill(page,'Motivo o detalle','Entrega parcial comprobada en este ensayo.');await click(page,'Confirmar operación');await wait(page,'Recepción parcial');
 assert.equal(metadata.procurement.received,'4.250');await click(page,'Registrar entrega');await fill(page,'Cantidad recibida (bolsa)','8.25');await fill(page,'Remito o referencia de entrega','Remito 02');await fill(page,'Motivo o detalle','Entrega final comprobada en este ensayo.');await click(page,'Confirmar operación');await wait(page,'Recibida completa');
 assert.equal(posts.length,4);assert.equal(metadata.procurement.received,'12.500');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(output,`purchase-${width}.png`),fullPage:true});checks.push('purchase-approval-and-partial-receipts-'+width);await ctx.close();
}
try {
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw new Error('Fixture exited');const response=await fetch(origin).catch(()=>null);if(response?.status>=500)throw new Error('Fixture compilation failed');if(response?.ok){ready=true;break;}await new Promise(done=>setTimeout(done,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario(width);for(const mode of ['draft-cancel','uncertain','rollback','not-arrived','conflict','denied','session-before-send','session-after-unknown-retry'])await scenario(390,mode);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-component-controlled-api',widths:[320,390,768,1280],checks,errors,productionDataWritten:false,paymentRecorded:false,stockLedgerChanged:false};
 writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:e.message,errors,log},null,2));throw e;}
finally{await browser?.close();try{if(process.platform==='win32')server.kill();else process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(done=>setTimeout(done,500));assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});}
