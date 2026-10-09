import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync,existsSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import puppeteer from 'puppeteer';
import {SITE_ROLES,MATERIAL_UNITS} from '../src/lib/site-register-policy.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const startedAt=Date.now(),root=process.cwd(),output=path.join(root,'.vercel/site-register-evidence');mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/site-register-ui-')),app=path.join(fixture,'app');mkdirSync(app);
const sourceManifest=[],harnessSha256=createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
for(const file of ['site-register-panel.js','site-register-panel.module.css','field-media-preparation.mjs','workspace-session-request.mjs','workspace-request-lifecycle.mjs','workspace-request-lifecycle.js','workspace-recovery-journal.mjs','own-company-number-view.mjs','own-company-templates-view.mjs', 'private-bank-account-format.mjs','company-channel-view.mjs','site-purchase-view.mjs','workspace-recovery-storage.mjs','private-workspace-download.js']){copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));sourceManifest.push({path:'src/app/(identity)/cuenta/'+file,sha256:createHash('sha256').update(readFileSync(path.join(app,file))).digest('hex')});}
for(const file of ['src/lib/site-register-policy.mjs','src/lib/workspace-policy.mjs'])sourceManifest.push({path:file,sha256:createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')});
assert.equal(new Set(sourceManifest.map(row=>row.path)).size,sourceManifest.length);
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-site-register-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081b2c',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-fixture';
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useEffect,useState} from 'react';import {SiteRegisterPanel} from './site-register-panel';import {browserRecoveryJournal} from './workspace-recovery-journal.mjs';const getSessionToken=async()=>window.__activeTabFixtureToken||'active-tab-controlled-token';export default function Page(){useEffect(()=>{window.__siteHydrated=true;window.__sitePhotoReferences=()=>browserRecoveryJournal.list('${scope}');return()=>{delete window.__siteHydrated;delete window.__sitePhotoReferences;};},[]);const [pending,setPending]=useState(false),[currentProject,setCurrentProject]=useState('${projectId}'),[currentScope,setCurrentScope]=useState('${scope}');const onPending=useCallback(value=>setPending(value),[]);return <main style={{maxWidth:1000,margin:'0 auto'}}><button data-testid="project-switch" disabled={pending}>Cambiar obra</button><button data-testid="forced-project-switch" onClick={()=>setCurrentProject('project-other')}>Cambiar obra de ensayo</button><button data-testid="forced-context-switch" onClick={()=>setCurrentScope('b'.repeat(64))}>Cambiar contexto de ensayo</button><SiteRegisterPanel getSessionToken={getSessionToken} projectId={currentProject} scope={currentScope} onPending={onPending}/></main>}`);
const port=3112,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-12000);});
const picture=syntheticPng(8,8);
const picturePath=path.join(fixture,'synthetic.png');writeFileSync(picturePath,picture);
const invalidPath=path.join(fixture,'not-an-image.txt');writeFileSync(invalidPath,'Not an image');
function syntheticPng(width=1600,height=1200){
 const raw=Buffer.alloc(height*(width*3+1));let seed=123456789;
 for(let row=0;row<height;row++)for(let column=1;column<=width*3;column++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;raw[row*(width*3+1)+column]=seed&255;}
 const table=Array.from({length:256},(_,n)=>{for(let bit=0;bit<8;bit++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const chunk=(name,data)=>{const type=Buffer.from(name),body=Buffer.concat([type,data]);let crc=0xffffffff;for(const byte of body)crc=table[(crc^byte)&255]^(crc>>>8);const length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,body,checksum]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const largePicture=syntheticPng(),largePicturePath=path.join(fixture,'synthetic-phone-5mb.png'),largePictureSha256=createHash('sha256').update(largePicture).digest('hex');
assert.ok(largePicture.length>5*1024*1024&&largePicture.length<20*1024*1024);writeFileSync(largePicturePath,largePicture);
const corruptPicturePath=path.join(fixture,'corrupt-photo.png');writeFileSync(corruptPicturePath,Buffer.concat([picture.subarray(0,24),Buffer.from('Not decodable pixels')]));
let browser,activeScenario=null;const errors=[],checks=[];
async function click(page,title){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text&&!b.disabled),{timeout:15000},title);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),title);assert.ok(handle.asElement(),'Missing button '+title);await handle.asElement().click();await handle.dispose();}
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:15000},text);
async function fill(page,label,value){await page.waitForFunction(text=>[...document.querySelectorAll('form label')].some(item=>item.childNodes[0]?.textContent===text&&item.querySelector('input,textarea,select')),{timeout:15000},label);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('form label')].find(item=>item.childNodes[0]?.textContent===text)?.querySelector('input,textarea,select'),label);const node=handle.asElement();assert.ok(node,'Missing field '+label);await node.type(value);await handle.dispose();}
async function retryUnobserved(page,posts,expectedPosts){
 await wait(page,'resultado quedó sin confirmar');assert.equal(posts.length,expectedPosts);
 assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Reintentar la misma operación'));
 assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('form input,form textarea,form select,nav button')].every(e=>e.disabled)));
 assert.ok(!(await page.evaluate(()=>[...document.querySelectorAll('form button')].map(b=>b.textContent))).includes('Cancelar'));
 await click(page,'Comprobar guardado');await wait(page,'No se observa un recibo todavía');assert.equal(posts.length,expectedPosts);
 assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
 await click(page,'Reintentar la misma operación');await wait(page,'Recibo confirmado');assert.equal(posts.length,expectedPosts+1);assert.deepEqual(posts.at(-1),posts.at(-2));
 await page.waitForFunction(()=>!document.querySelector('[data-testid="project-switch"]').disabled);
}
async function downloaded(downloadPath,name){const file=path.join(downloadPath,name);for(let n=0;n<200;n++){if(existsSync(file))return readFileSync(file);await new Promise(resolve=>setTimeout(resolve,50));}throw new Error('Controlled download did not complete: '+name);}
async function scenario(width,mode='normal'){
 activeScenario={suite:'lifecycle',mode,width};
 const downloadPath=path.join(fixture,'downloads-'+width+'-'+mode);mkdirSync(downloadPath,{recursive:true});const context=await browser.createBrowserContext({downloadBehavior:{policy:'allow',downloadPath}}),page=await context.newPage();await context.setCookie({name:'__session',value:'other-tab-org-controlled-cookie',domain:'127.0.0.1',path:'/'});await page.setViewport({width,height:1000});
 page.on('pageerror',error=>errors.push({width,mode,error:error.message}));await page.setRequestInterception(true);
 const records={PEOPLE:[],ISSUES:[],MATERIALS:[]},receipts=new Map(),posts=[];let counter=0,photoAttempts=0,statusChecks=0;
 const revision=()=>`2026-10-01T10:00:00.${String(++counter).padStart(6,'0')}`;
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.pathname.startsWith('/api/identity/'))assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw new Error('Unexpected external request');}
   if(!['/api/identity/site-register','/api/identity/site-photo'].includes(url.pathname))return request.continue();
   if(url.pathname==='/api/identity/site-photo'&&request.method()==='GET'&&url.searchParams.has('photoId')){assert.equal(url.searchParams.get('scope'),scope);assert.equal(url.searchParams.get('projectId'),projectId);await request.respond({status:200,contentType:'image/png',body:picture});return;}let body,status=200;
   if(mode==='denied'){status=403;body={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
   else if(request.method()==='POST'){
    const input=JSON.parse(request.postData());posts.push(input);assert.equal(input.projectId,projectId);assert.equal(input.scope,scope);const p=input.payload;
    const photo=url.pathname==='/api/identity/site-photo';if(photo)photoAttempts++;
    const failure=(['rollback','not-arrived'].includes(mode)&&posts.length===1)||(mode.startsWith('photo-')&&photo&&photoAttempts===1);
    if(failure){if(mode.endsWith('not-arrived'))await request.abort('failed');else await request.respond({status:503,contentType:'application/json',body:JSON.stringify({code:'SITE_OPERATION_UNCONFIRMED'})});return;}
    let receiptId='site_receipt_'+input.operationId;let person,report;
    if(url.pathname==='/api/identity/site-photo'){
     assert.deepEqual(Buffer.from(input.image.split(',').at(-1),'base64'),picture);const record=records.ISSUES.find(row=>row.id===input.reportId);assert.ok(record);assert.equal(record.revision,input.revision);receiptId='sitephoto_'+createHash('sha256').update(input.operationId).digest('hex');const photo={id:receiptId,bytes:picture.length,contentType:'image/png',sha256:createHash('sha256').update(picture).digest('hex')};record.photos=[photo];record.revision=revision();body={scope,saved:true,receiptId,photo};receipts.set(input.operationId,body);await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});return;
    }else if(input.action==='ADD_PERSON'){
     person={id:'person-1',name:p.name,phone:p.phone,job:p.job,roleLabel:SITE_ROLES[p.job],active:true,editable:true,revision:revision(),identityVerified:false,whatsappAccessGranted:false,loginAccessGranted:false};records.PEOPLE.push(person);
    }else if(input.action==='SET_PERSON_ACTIVE'){person=records.PEOPLE.find(row=>row.id===p.personId);assert.equal(p.revision,person.revision);Object.assign(person,{active:p.active,revision:revision()});}
    else if(input.action==='REPORT_ISSUE'||input.action==='REQUEST_MATERIAL'){
     const material=input.action==='REQUEST_MATERIAL';report={id:'report-'+counter,title:material?p.material:p.title,details:p.details,sector:p.sector,type:material?'MATERIAL_REQUEST':'ISSUE',quantity:p.quantity||null,unit:p.unit||null,severity:p.severity||'INFO',state:'OPEN',revision:revision(),review:null};records[material?'MATERIALS':'ISSUES'].push(report);
    }else if(input.action==='REVIEW_REPORT'){report=[...records.ISSUES,...records.MATERIALS].find(row=>row.id===p.reportId);assert.equal(report.revision,p.revision);Object.assign(report,{state:p.decision,revision:revision(),review:{decision:p.decision,reason:p.reason}});}
    else throw new Error('Unexpected mutation '+input.action);
    body={scope,saved:true,receiptId,kind:person?'PERSON':'REPORT',...(person?{person}:{report})};receipts.set(input.operationId,body);
    if(mode==='uncertain'){status=503;body={code:'SITE_OPERATION_UNCONFIRMED'};}
    if(mode==='conflict'){status=409;body={code:'SITE_REVISION_CHANGED'};records.PEOPLE=[];receipts.clear();}
   }else if(url.searchParams.has('operationId')){statusChecks++;const found=receipts.get(url.searchParams.get('operationId'));body=found?{state:'RECORDED',...found}:{scope,state:'NOT_OBSERVED',definitive:false};}
   else{const section=url.searchParams.get('section');assert.ok(records[section]);body={scope,projectId,section,records:records[section],total:records[section].length,nextCursor:null,roles:SITE_ROLES,units:MATERIAL_UNITS,workerSelfServiceEnabled:false};}
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(error){errors.push({width,mode,error:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Abrir registro');
 if(mode==='denied'){await wait(page,'no permite administrar');assert.equal(posts.length,0);checks.push('unauthorized-view-has-no-example-records');await context.close();return;}
 await wait(page,'Agregar persona');await click(page,'Agregar persona');await fill(page,'Nombre','Persona de ensayo');await fill(page,'Teléfono internacional','+5491100001111');await page.select('form select','FOREMAN');
 assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));assert.ok(!(await page.$eval('form input',e=>e.disabled)));
 if(mode==='draft-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('[data-testid="project-switch"]').disabled);assert.equal(posts.length,0);checks.push('site-register-draft-locks-project-until-explicit-cancel');await context.close();return;}
 await click(page,'Guardar registro');
 if(mode==='uncertain'){await wait(page,'resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar guardado');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-without-another-POST');await context.close();return;}
 if(['rollback','not-arrived'].includes(mode)){
  assert.equal(records.PEOPLE.length,0);await retryUnobserved(page,posts,1);assert.equal(records.PEOPLE.length,1);assert.equal(statusChecks,1);checks.push(mode+'-checks-receipt-and-retries-exact-register-command-once');await context.close();return;
 }
 if(mode==='conflict'){await wait(page,'El registro cambió');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo confirmado'));assert.equal(await page.$eval('input[type="tel"]',el=>el.value),'+5491100001111');checks.push('conflict-preserves-form-and-never-shows-saved');await context.close();return;}
 await wait(page,'Persona de ensayo');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('La ficha no certifica identidad'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:path.join(output,`roster-${width}.png`),fullPage:true});
 await click(page,'Dar de baja en esta obra');await fill(page,'Motivo','Terminó la participación en esta obra de ensayo.');await click(page,'Guardar registro');await wait(page,'Inactivo');assert.equal(posts.length,2);
 await click(page,'Pedidos de materiales');await wait(page,'Solicitar material');await click(page,'Solicitar material');
 await fill(page,'Material','Cemento de ensayo');await fill(page,'Cantidad','12.5');await fill(page,'Sector','Planta baja');await fill(page,'Detalle','Pedido para la etapa inicial de la obra.');await click(page,'Guardar registro');await wait(page,'Cemento de ensayo');await wait(page,'Recibo confirmado');
 await click(page,'Gestionar registro');await fill(page,'Motivo','Se asignó al responsable para seguimiento.');await click(page,'Guardar registro');await wait(page,'En seguimiento');
 await click(page,'Gestionar registro');await fill(page,'Motivo','Se resolvió administrativamente este pedido.');await click(page,'Guardar registro');await wait(page,'Resuelto');
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('no es una orden de compra'));
 await page.screenshot({path:path.join(output,`materials-${width}.png`),fullPage:true});
 await click(page,'Incidencias');await wait(page,'Registrar incidencia');await click(page,'Registrar incidencia');await fill(page,'Título','Acceso bloqueado');await fill(page,'Sector','Sector norte');await fill(page,'Detalle','Hace falta retirar el obstáculo para ingresar.');await click(page,'Guardar registro');await wait(page,'Acceso bloqueado');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click(page,'Adjuntar foto privada');const upload=await page.$('input[type="file"]');assert.ok(upload);await upload.uploadFile(picturePath);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Guardar registro'&&!b.disabled));await upload.uploadFile(invalidPath);await wait(page,'Elegí JPEG, PNG o WebP');assert.equal(await page.$$eval('button',all=>all.find(b=>b.textContent==='Guardar registro').disabled),true);await upload.uploadFile(picturePath);await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Guardar registro'&&!b.disabled));assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));
 if(mode==='photo-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('[data-testid="project-switch"]').disabled);assert.equal(posts.length,6);assert.equal(records.ISSUES[0].photos?.length||0,0);checks.push('site-register-photo-draft-locks-project-until-explicit-cancel');await context.close();return;}
 await click(page,'Guardar registro');
 if(mode.startsWith('photo-')){await retryUnobserved(page,posts,7);assert.equal(photoAttempts,2);assert.equal(statusChecks,1);assert.equal(records.ISSUES[0].photos.length,1);checks.push(mode+'-retries-exact-private-image-command-once');await context.close();return;}
 await wait(page,'Fotografía privada adjunta');await wait(page,'Descargar foto');
 await click(page,'Descargar foto 1 · 1 KB');assert.deepEqual(await downloaded(downloadPath,'obrasaas-foto.png'),picture);assert.equal(posts.length,7);checks.push(`private-photo-active-tab-bearer-download-exact-bytes-${width}`);
 checks.push(`roster-issue-material-lifecycle-${width}`);await context.close();
}
// Photo/access cases start with an authorized report: no repeated roster/material writes.
async function photoScenario(width,mode='large'){
 activeScenario={suite:'photo',mode,width};
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 const rev='2026-10-01T10:00:00.000001',record={id:'report-photo',title:'Incidencia privada de ensayo',sector:'Sector privado',details:'Detalle privado del registro de ensayo.',type:'ISSUE',severity:'MEDIUM',state:'OPEN',revision:rev,photos:[]};
 const posts=[],receipts=new Map();let deny=null,postFault=null,recoveryFault=null,refreshFault=null,photoReads=0,deniedReads=0;
 page.on('pageerror',error=>errors.push({width,mode,error:error.message}));
 await page.evaluateOnNewDocument(mode=>{
  window.__sitePhotoTest={pending:[],releases:[],closed:0};
  const bitmap=window.createImageBitmap?.bind(window),read=FileReader.prototype.readAsDataURL;
  if(['cancel-decode','context-decode','project-decode'].includes(mode)&&bitmap)window.createImageBitmap=async(...args)=>{await new Promise(resolve=>window.__sitePhotoTest.releases.push(resolve));const image=await bitmap(...args),close=image.close.bind(image);image.close=()=>{window.__sitePhotoTest.closed++;close();};window.__sitePhotoTest.pending.push('decoded');return image;};
  if(['cancel-reader','context-reader','access-reader'].includes(mode))FileReader.prototype.readAsDataURL=function(file){window.__sitePhotoTest.releases.push(()=>{this.addEventListener('loadend',()=>window.__sitePhotoTest.pending.push('read-ended'),{once:true});read.call(this,file);});};
 },mode);
 await page.setRequestInterception(true);
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw new Error('Unexpected external request');}
   if(!url.pathname.startsWith('/api/identity/'))return request.continue();assert.equal(request.headers().authorization,'Bearer active-tab-controlled-token');
   const fault=async value=>{if(value.context)return request.respond({status:200,contentType:'application/json',body:JSON.stringify({scope:'b'.repeat(64),projectId:'foreign-project',section:'ISSUES',records:[{...record,title:'Registro de otra organización'}]})});return request.respond({status:value.status||403,contentType:value.html?'text/html':'application/json',body:value.html?'<html>Access denied</html>':JSON.stringify({code:value.status===401?'SESSION_REQUIRED':'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'})});};
   if(request.method()==='POST'){
    assert.equal(url.pathname,'/api/identity/site-photo');const input=JSON.parse(request.postData());posts.push(input);assert.deepEqual(Object.keys(input).sort(),['image','operationId','projectId','reportId','revision','scope']);assert.equal(input.projectId,projectId);assert.equal(input.scope,scope);assert.equal(input.reportId,record.id);assert.equal(input.revision,rev);
    const bytes=Buffer.from(input.image.split(',').at(-1),'base64');assert.ok(bytes.length>0&&bytes.length<=2*1024*1024);assert.equal(bytes[0],mode==='large'?255:137);assert.equal(bytes[1],mode==='large'?216:80);
    if(postFault){const value=postFault;postFault=null;return fault(value);}
    const receiptId='sitephoto_'+createHash('sha256').update(input.operationId).digest('hex'),photo={id:receiptId,bytes:bytes.length,contentType:mode==='large'?'image/jpeg':'image/png',sha256:createHash('sha256').update(bytes).digest('hex')};
    const result={scope,saved:true,receiptId,photo};receipts.set(input.operationId,result);record.photos=[photo];record.revision='2026-10-01T10:00:01.000001';
    if(mode==='uncertain')return request.respond({status:503,contentType:'application/json',body:JSON.stringify({code:'SITE_PHOTO_STORAGE_UNCONFIRMED'})});
    return request.respond({status:200,contentType:'application/json',body:JSON.stringify(result)});
   }
   if(url.pathname==='/api/identity/site-photo'){
    photoReads++;if(recoveryFault)return fault(recoveryFault);
    const result=receipts.get(url.searchParams.get('operationId'));return request.respond({status:200,contentType:'application/json',body:JSON.stringify(result?{state:'RECORDED',...result}:{scope,state:'NOT_OBSERVED',definitive:false})});
   }
   if(deny){deniedReads++;return fault(deny);}if(refreshFault&&posts.length)return fault(refreshFault);
   const section=url.searchParams.get('section');return request.respond({status:200,contentType:'application/json',body:JSON.stringify({scope,projectId,section,records:section==='ISSUES'?[record]:[],total:section==='ISSUES'?1:0,nextCursor:null,roles:SITE_ROLES,units:MATERIAL_UNITS,workerSelfServiceEnabled:false})});
  }catch(error){errors.push({width,mode,error:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 const hidden=async()=>{await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('img[src^="data:"]')&&!document.body.innerText.includes('Incidencia privada de ensayo')&&!document.body.innerText.includes('Detalle privado del registro')&&!document.body.innerText.includes('Registro de otra organización'));};
 const references=()=>page.evaluate(()=>window.__sitePhotoReferences());
 const idle=()=>page.waitForFunction(()=>![...document.querySelectorAll('button')].find(button=>button.textContent==='Comprobar guardado'&&button.disabled));
 await page.goto(origin,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__siteHydrated);await click(page,'Abrir registro');await click(page,'Incidencias');await wait(page,record.title);
 if(mode.startsWith('load-')){
  deny={status:mode.includes('401')?401:403,html:mode.includes('html'),context:mode.includes('context')};await click(page,'Actualizar registro');await hidden();assert.equal(posts.length,0);deny=null;await click(page,'Abrir registro');await click(page,'Incidencias');await wait(page,record.title);assert.equal(posts.length,0);checks.push(mode+'-hides-private-record-and-allows-explicit-authorized-GET');await context.close();return;
 }
 await click(page,'Adjuntar foto privada');assert.ok(await page.$eval('form',(form,title)=>form.innerText.includes('Registro: '+title),record.title));const upload=await page.$('input[type="file"]');
 if(mode==='corrupt'){
  await upload.uploadFile(corruptPicturePath);await wait(page,'Conservamos el borrador');assert.ok(await page.$('form'));assert.equal(await page.$('img[src^="data:"]'),null);assert.equal(await page.$$eval('button',buttons=>buttons.find(button=>button.textContent==='Guardar registro').disabled),true);assert.equal(posts.length,0);await upload.uploadFile(picturePath);await wait(page,'Fotografía verificada sin reducir');await click(page,'Guardar registro');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);checks.push('corrupt-image-preserves-report-draft-and-reselection-uses-original-revision');await context.close();return;
 }
 await upload.uploadFile(mode==='large'||mode.includes('decode')?largePicturePath:picturePath);
 if(mode.includes('decode')||mode.includes('reader')){
  await page.waitForFunction(()=>window.__sitePhotoTest.releases.length===1);
  if(mode.startsWith('cancel'))await click(page,'Cancelar preparación');
  else if(mode.startsWith('project'))await page.click('[data-testid="forced-project-switch"]');
  else if(mode.startsWith('context'))await page.click('[data-testid="forced-context-switch"]');
  else{
   // Deliberate stress interleaving: ordinary UI blocks GET while preparing.
   // Invoke the fixture's actual React handler, then deliver the late reader event.
   deny={status:403,html:true};await page.evaluate(()=>{const button=[...document.querySelectorAll('button')].find(button=>button.textContent==='Abrir registro'),key=Object.keys(button).find(value=>value.startsWith('__reactProps$')),handler=button[key]?.onClick;if(typeof handler!=='function')throw new Error('Controlled GET handler unavailable');handler();});await wait(page,'Tu acceso cambió');await hidden();assert.equal(deniedReads,1);
  }
  await page.evaluate(()=>window.__sitePhotoTest.releases.shift()());await page.waitForFunction(mode=>window.__sitePhotoTest.pending.length===1&&(!mode.includes('decode')||window.__sitePhotoTest.closed===1),{},mode);if(mode.startsWith('cancel')){await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('img[src^="data:"]'));await wait(page,record.title);}else await hidden();assert.equal(posts.length,0);checks.push(mode+'-late-photo-result-cannot-restore-private-draft');await context.close();return;
 }
 await wait(page,mode==='large'?'Copia JPEG preparada':'Fotografía verificada sin reducir');await page.waitForFunction(()=>document.querySelector('img[src^="data:"]')?.naturalWidth>0);assert.equal(posts.length,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(mode==='large'){assert.equal(createHash('sha256').update(readFileSync(largePicturePath)).digest('hex'),largePictureSha256);await page.screenshot({path:path.join(output,'prepared-phone-'+width+'.png'),fullPage:true});checks.push('valid-5MiB-phone-original-reviewed-as-local-copy-at-most-2MiB-'+width);}
 if(mode.startsWith('post-'))postFault={status:mode.includes('401')?401:403,html:mode.includes('html'),context:mode.includes('context')};
 if(mode.startsWith('refresh-'))refreshFault={status:401,html:true};
 await click(page,'Guardar registro');
 if(mode.startsWith('refresh-')){await hidden();await wait(page,'El guardado está confirmado');assert.equal(posts.length,1);assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Comprobar guardado')),false);checks.push('confirmed-photo-refresh-denial-hides-private-state-with-no-pending-attempt');await context.close();return;}
 if(mode.startsWith('post-')){
  await hidden();assert.equal(posts.length,1);const initialReferences=await references();assert.equal(initialReferences.length,1);assert.equal(initialReferences[0].operationId,posts[0].operationId);assert.equal(initialReferences[0].resource,'site-photo');assert.equal(JSON.stringify(initialReferences).includes('data:'),false);assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reintentar la misma operación')),false);
  recoveryFault={status:403,html:true};await click(page,'Comprobar guardado');await idle();assert.equal(posts.length,1);assert.deepEqual(await references(),initialReferences);assert.equal(await page.$$eval('button',buttons=>buttons.some(button=>button.textContent==='Reintentar la misma operación')),false);
  recoveryFault=null;await click(page,'Comprobar guardado');await wait(page,'No se observa un recibo todavía');assert.equal(photoReads,2);assert.equal(posts.length,1);await click(page,'Reintentar la misma operación');await wait(page,'Recibo confirmado');assert.equal(posts.length,2);assert.deepEqual(posts[0],posts[1]);assert.equal((await references()).length,0);checks.push(mode+'-retains-private-attempt-through-denied-GET-before-exact-retry');await context.close();return;
 }
 if(mode==='uncertain'){await wait(page,'resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar guardado');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);assert.equal((await references()).length,0);checks.push('uncertain-photo-recovers-receipt-without-another-POST');}
 else{await wait(page,'Recibo confirmado');assert.equal(posts.length,1);if(mode==='large')assert.ok(Buffer.from(posts[0].image.split(',').at(-1),'base64').length<largePicture.length);}
 await context.close();
}
try{
 let ready=false;for(let count=0;count<120;count++){if(server.exitCode!==null)throw new Error('Fixture exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 const focus=process.env.SITE_PHOTO_UI_FOCUS||null;
 if(focus)await photoScenario(390,focus);else{for(const width of [320,390,768,1280]){await scenario(width);await photoScenario(width,'large');}for(const mode of ['draft-cancel','photo-cancel','uncertain','rollback','not-arrived','photo-rollback','photo-not-arrived','conflict','denied'])await scenario(390,mode);for(const mode of ['corrupt','cancel-decode','cancel-reader','context-decode','project-decode','context-reader','access-reader','load-401','load-html-403','load-context','post-403','post-html-401','post-context','refresh-401','uncertain'])await photoScenario(390,mode);}assert.deepEqual(errors,[]);
 const proof={status:'PASS',checkedAt:new Date().toISOString(),durationMs:Date.now()-startedAt,fullSuite:!focus,focusedScenario:focus,environment:'actual-component-with-intercepted-synthetic-api',widths:focus?[390]:[320,390,768,1280],checks,errors,sourceManifest,harnessSha256,syntheticPhonePhoto:{bytes:largePicture.length,sha256:largePictureSha256,width:1600,height:1200,source:'deterministic synthetic PNG, not a physical camera'},controlledStressCases:checks.some(value=>value.startsWith('access-reader-'))?[{scenario:'access-reader',trigger:'fixture invokes the React GET handler despite the ordinary preparation lock',ordinaryUserGesture:false,deniedGetObserved:true,lateReaderBarrier:'loadend'}]:[],productionDataWritten:false,workerPhoneVerified:false,physicalPhonePhotoAccepted:false,providerCalls:0,metaMessagesSent:0};
 writeFileSync(path.join(output,focus?'browser-'+focus+'.json':'browser.json'),JSON.stringify(proof,null,2));rmSync(path.join(output,'browser-failure.json'),{force:true});console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,activeScenario,completedCheckCount:checks.length,checks,errors,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(done=>setTimeout(done,500));assert.equal(path.dirname(path.resolve(fixture)),path.resolve(root,'.vercel'));rmSync(fixture,{recursive:true,force:true});}
