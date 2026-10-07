import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,copyFileSync,existsSync,realpathSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import puppeteer from 'puppeteer';
import {bankFixture,syntheticBankNumber} from '../tests/fixtures/private-bank-fixture.mjs';
import {RECOVERY_DATABASE_NAME} from '../src/app/(identity)/cuenta/workspace-recovery-storage.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV&&!process.env.VERCEL_TARGET);
const root=realpathSync(process.cwd()),parent=path.join(root,'.vercel'),out=path.join(parent,'private-bank-evidence');mkdirSync(out,{recursive:true});
const fixture=mkdtempSync(path.join(parent,'private-bank-ui-')),app=path.join(fixture,'app');mkdirSync(app,{recursive:true});
const copied=new Set(),sources=new Set();
function visit(file,copy=false){
 if(sources.has(file)&&(!copy||copied.has(file)))return;sources.add(file);const absolute=path.join(root,file),text=readFileSync(absolute,'utf8');
 if(copy){const target=path.join(fixture,file.startsWith('src/')?file.slice(4):file);mkdirSync(path.dirname(target),{recursive:true});copyFileSync(absolute,target);copied.add(file);}
 if(/\.(mjs|js)$/.test(file))for(const match of text.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)){
  const relative=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));const dependency=[relative,relative+'.js',relative+'.mjs'].find(value=>existsSync(path.join(root,value)));assert.ok(dependency,'Resolvable source dependency '+file);visit(dependency,copy);
 }
}
visit('src/app/(identity)/cuenta/private-bank-account-panel.js',true);visit('src/app/(identity)/cuenta/participant-panel.js',true);visit('tests/fixtures/private-bank-fixture.mjs');
const sourceManifest=[...sources].sort().map(file=>({path:file,sha256:createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')}));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'synthetic-private-bank-ui',private:true}));writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export const viewport={width:'device-width',initialScale:1};export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#fff',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const initial=bankFixture();
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useEffect,useState} from 'react';import {PrivateBankAccountPanel} from './(identity)/cuenta/private-bank-account-panel';import {ParticipantPanel} from './(identity)/cuenta/participant-panel';import {browserRecoveryJournal} from './(identity)/cuenta/workspace-recovery-journal.mjs';const token=async()=>'synthetic-bank-session';export default function Page(){const[pending,setPending]=useState(false),[mode,setMode]=useState(null);const onPending=useCallback((id,value)=>setPending(value),[]);useEffect(()=>{window.bankJournal=browserRecoveryJournal;setMode(window.bankMode);},[]);return <main style={{maxWidth:1000,margin:'0 auto'}}><button id="context" disabled={pending}>Cambiar obra</button>{mode==='integrated'?<ParticipantPanel scope="${initial.scope}" projectId="${initial.projectId}" getSessionToken={token} onPending={setPending}/>:mode?<PrivateBankAccountPanel scope="${initial.scope}" projectId="${initial.projectId}" workerId="${initial.row.id}" getSessionToken={token} onPending={onPending}/>:null}</main>}`);
const origin='http://127.0.0.1:3337',modes=['normal','invalid-cancel','lost-reload','unknown-close-reload','same-retry','stale','denied-forged','integrated'],checks=[],errors=[];
const selected=(process.env.PRIVATE_BANK_UI_CASES||modes.join(',')).split(',');assert.ok(selected.length&&selected.every(value=>modes.includes(value)));
const widths=(process.env.PRIVATE_BANK_UI_WIDTHS||'320,390,768,1280').split(',').map(Number);assert.ok(widths.length&&widths.every(value=>[320,390,768,1280].includes(value)));
const harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const sourceRevision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:root}).trim();
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port','3337'],{env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let log='',browser,active;
for(const stream of [server.stdout,server.stderr])stream.on('data',value=>{log=(log+value).slice(-20000);});
const wait=(page,value)=>page.waitForFunction(text=>document.body.innerText.includes(text),{timeout:20000},value);
const idle=page=>page.waitForFunction(()=>document.querySelector('[data-private-bank-account]')?.getAttribute('aria-busy')==='false',{timeout:20000});
async function click(page,label){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===text&&!el.disabled),{timeout:20000},label);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text),label);if(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches))await handle.asElement().tap();else await handle.asElement().click();await handle.dispose();}
async function references(page,scope){const refs=await page.evaluate(value=>window.bankJournal.list(value),scope);for(const ref of refs)assert.deepEqual(Object.keys(ref).sort(),['action','createdAt','operationId','projectId','resource','scope','version','workerId']);return refs;}
async function privacy(page){const text=await page.evaluate(async name=>{const records=await new Promise((resolve,reject)=>{const open=indexedDB.open(name);open.onerror=()=>reject(Error('Storage'));open.onsuccess=()=>{const db=open.result,tx=db.transaction('references','readonly'),get=tx.objectStore('references').getAll();get.onsuccess=()=>resolve(get.result);tx.oncomplete=()=>db.close();};});return JSON.stringify({records,local:Object.values(localStorage),session:Object.values(sessionStorage)});},RECOVERY_DATABASE_NAME);for(const value of [syntheticBankNumber,'synthetic-bank-session','requestCommitment','envelope','noticeVersion','consent'])assert.equal(text.includes(value),false);}
async function open(page){await click(page,'Consultar mi cuenta privada');await idle(page);await wait(page,'Sin cuenta declarada.');}
async function edit(page,number=syntheticBankNumber){await click(page,'Declarar o corregir mi cuenta');await page.waitForFunction(()=>document.activeElement?.getAttribute('inputmode')==='numeric',{timeout:20000});assert.equal(await page.$eval('form input[type=text]',el=>el.value),'');await page.type('form input[type=text]',number);await page.click('form input[type=checkbox]');}
async function save(page){await click(page,'Guardar declaración privada');await idle(page);}
async function scenario(mode,width){
 active={mode,width};const f=bankFixture(),context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000,isMobile:width<=390,hasTouch:width<=390});await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);await page.evaluateOnNewDocument(value=>{window.bankMode=value;},mode);page.on('pageerror',error=>errors.push({mode,width,message:error.message}));
 let first=true,recovery=0;const posts=[],rawBodies=[],external=[];await page.setRequestInterception(true);
 page.on('request',async request=>{try{
  const url=new URL(request.url());if(url.origin!==origin){external.push(url.origin);return request.abort();}if(!url.pathname.startsWith('/api/'))return request.continue();assert.equal(url.pathname,'/api/identity/participants');let response;
  if(request.method()==='POST'){
   const raw=request.postData(),body=JSON.parse(raw);posts.push(body);rawBodies.push(raw);
   if(first&&['unknown-close-reload','same-retry','denied-forged'].includes(mode)){first=false;if(mode==='denied-forged')return request.respond({status:403,contentType:'application/json',body:JSON.stringify({code:'PARTICIPANT_ACCESS_REQUIRED'})});return request.abort('failed');}
   if(mode==='stale'&&first){first=false;f.row.revision='2026-10-01T00:00:00.000999';}
   response=await f.post(body);
   if(mode==='lost-reload'&&first){first=false;assert.equal(response.status,200);return request.abort('failed');}
  }else{
   assert.equal(url.search.includes(syntheticBankNumber),false);const params=Object.fromEntries(url.searchParams);response=await f.handlers.GET(f.request(params));
   if(params.operationId){recovery++;if(mode==='denied-forged'&&recovery===1)return request.respond({status:403,contentType:'application/json',body:JSON.stringify({code:'PARTICIPANT_ACCESS_REQUIRED'})});if(mode==='denied-forged'&&recovery===2){const original=posts[0];return request.respond({status:200,contentType:'application/json',body:JSON.stringify({scope:f.scope,actorId:f.member.actorId,organizationId:f.member.organizationId,projectId:f.projectId,workerId:f.row.id,operationId:original.operationId,action:original.action,state:'REJECTED',saved:false,definitive:true,replayed:false,receipt:{id:'participant_'+'a'.repeat(64),actorId:f.member.actorId,organizationId:f.member.organizationId,projectId:f.projectId,workerId:f.row.id,operationId:original.operationId,action:original.action,state:'REJECTED',bankRevision:0,code:'SOME_CLIENT_CODE'}})});}}
  }
  await request.respond({status:response.status,contentType:'application/json',headers:Object.fromEntries(response.headers),body:await response.text()});
 }catch(error){errors.push({mode,width,message:error.message});if(!request.isInterceptResolutionHandled())await request.abort();}});
 await page.goto(origin,{waitUntil:'networkidle0'});assert.equal(await page.evaluate(()=>innerWidth),width);
 if(mode==='integrated'){await click(page,'Consultar participantes');await wait(page,'Mi cuenta bancaria privada');}
 await open(page);
 if(mode==='invalid-cancel'){
  await edit(page,syntheticBankNumber.slice(1));await save(page);await wait(page,'exactamente 22 dígitos');assert.equal(posts.length,0);assert.equal((await references(page,f.scope)).length,0);await click(page,'Cancelar borrador privado');await page.waitForFunction(()=>!document.querySelector('form')&&document.querySelector('#context').disabled===false,{timeout:20000});assert.equal(await page.$('form'),null);assert.equal(await page.$eval('#context',el=>el.disabled),false);await edit(page);await click(page,'Cerrar cuenta privada');assert.equal(await page.$('form'),null);assert.equal(posts.length,0);
 }else{
  await edit(page);assert.equal(await page.$eval('#context',el=>el.disabled),true);const geometry=await page.$$eval('form input[type=text],form select,form button',els=>els.map(el=>({font:parseFloat(getComputedStyle(el).fontSize),height:el.getBoundingClientRect().height})));assert.ok(geometry.every(value=>value.font>=16&&value.height>=44));await save(page);
  if(['normal','integrated'].includes(mode)){
   await wait(page,'Declaración registrada con recibo.');assert.equal((await references(page,f.scope)).length,0);assert.equal(await page.$('form'),null);await click(page,'Actualizar referencia privada');await idle(page);await wait(page,'termina en 0001');assert.equal((await page.evaluate(()=>document.body.innerText)).includes(syntheticBankNumber),false);await click(page,'Eliminar mi declaración');await idle(page);await wait(page,'Recibo privado:');await click(page,'Actualizar referencia privada');await idle(page);await wait(page,'Declaración eliminada.');assert.equal(posts.length,2);assert.equal(f.counts.writes,2);
  }else if(mode==='stale'){await wait(page,'El rechazo quedó registrado');assert.equal((await references(page,f.scope)).length,0);assert.equal(f.counts.writes,0);assert.equal(f.audits.size,1);await click(page,'Actualizar referencia privada');await idle(page);await edit(page);await save(page);await wait(page,'Declaración registrada con recibo.');assert.equal(posts.length,2);assert.equal(f.counts.writes,1);}
  else{
   await wait(page,'La confirmación no llegó');assert.equal((await references(page,f.scope)).length,1);assert.equal(await page.$('form'),null);
   if(mode==='lost-reload'){await page.reload({waitUntil:'networkidle0'});await wait(page,'Hay una declaración privada por comprobar');await click(page,'Comprobar mi declaración pendiente');await idle(page);await wait(page,'Declaración registrada con recibo.');assert.equal(posts.length,1);assert.equal(f.counts.writes,1);}
   else{
    if(mode==='denied-forged'){await click(page,'Comprobar mi declaración pendiente');await idle(page);await wait(page,'Tu acceso actual');assert.equal((await references(page,f.scope)).length,1);await click(page,'Comprobar mi declaración pendiente');await idle(page);await wait(page,'No se pudo comprobar');assert.equal((await references(page,f.scope)).length,1);}
    await click(page,'Comprobar mi declaración pendiente');await idle(page);await wait(page,'Todavía no se observa el recibo');
    if(mode==='same-retry'){await click(page,'Reintentar exactamente la misma declaración');await idle(page);await wait(page,'Declaración registrada con recibo.');assert.equal(posts.length,2);assert.equal(rawBodies[0],rawBodies[1]);assert.equal(f.counts.writes,1);}
    else{
     await click(page,'Cerrar cuenta privada');await page.waitForFunction(()=>document.querySelector('#context').disabled===false,{timeout:20000});assert.equal(await page.$eval('#context',el=>el.disabled),false);assert.equal((await references(page,f.scope)).length,1);assert.equal(await page.$('form'),null);await page.reload({waitUntil:'networkidle0'});await wait(page,'Hay una declaración privada por comprobar');await click(page,'Comprobar mi declaración pendiente');await idle(page);await wait(page,'Todavía no se observa el recibo');assert.equal((await page.evaluate(()=>document.body.innerText)).includes('Reintentar exactamente la misma declaración'),false);await page.click('[data-private-bank-account] input[type=checkbox]');await click(page,'Cancelar intento con recibo');await idle(page);await wait(page,'El intento pendiente quedó cancelado');assert.equal((await references(page,f.scope)).length,0);assert.equal(posts.length,2);assert.equal(posts[0].operationId,posts[1].operationId);assert.equal(posts[1].action,'CANCEL_PENDING_PRIVATE_BANK_ACCOUNT');assert.equal((await (await f.post(posts[0])).json()).state,'CANCELLED');assert.equal(f.counts.writes,0);
    }
   }
  }
 }
 await privacy(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(external,[]);assert.equal(f.counts.remote,0);checks.push({mode,width,postCount:posts.length,bankWrites:f.counts.writes,realProviderCalls:0});await context.close();
}
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}assert.ok(ready,log);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});for(const width of widths)for(const mode of selected)await scenario(mode,width);assert.deepEqual(errors,[]);
 for(const source of sourceManifest)assert.equal(createHash('sha256').update(readFileSync(path.join(root,source.path))).digest('hex'),source.sha256,'Source changed during UI proof: '+source.path);assert.equal(createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),harnessSha256);
 const proof={status:'PASS',sourceRevision,environment:'real-components-and-canonical-HTTP/workspace/participant-bank-core-with-synthetic-SQL-boundary',fullSuite:selected.length===modes.length&&widths.length===4,widths,checks,sourceManifest,harnessSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),errors,realProviderCalls:0,productionDataWritten:false,postgresExecuted:false};writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({status:'PASS',checks:checks.length,fullSuite:proof.fullSuite}));
}catch(error){writeFileSync(path.join(out,'failure.json'),JSON.stringify({status:'FAILED',active,message:error.message,errors,log},null,2));throw error;}
finally{await browser?.close();try{if(process.platform==='win32')server.kill();else process.kill(-server.pid,'SIGTERM');}catch{}await new Promise(resolve=>setTimeout(resolve,500));const resolved=realpathSync(fixture);assert.equal(path.dirname(resolved),realpathSync(parent));assert.ok(path.basename(resolved).startsWith('private-bank-ui-'));rmSync(resolved,{recursive:true,force:true});}
