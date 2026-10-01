import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
import {SITE_ROLES,MATERIAL_UNITS} from '../src/lib/site-register-policy.mjs';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),output=path.join(root,'.vercel/site-register-evidence');mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/site-register-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const file of ['site-register-panel.js','site-register-panel.module.css'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-site-register-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#081b2c',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-fixture';
writeFileSync(path.join(app,'page.js'),`import {SiteRegisterPanel} from './site-register-panel';export default function Page(){return <main style={{maxWidth:1000,margin:'0 auto'}}><SiteRegisterPanel projectId="${projectId}" scope="${scope}"/></main>}`);
const port=3112,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-12000);});
const picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==','base64');
const picturePath=path.join(fixture,'synthetic.png');writeFileSync(picturePath,picture);
let browser;const errors=[],checks=[];
async function click(page,title){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text&&!b.disabled),{timeout:15000},title);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),title);assert.ok(handle.asElement(),'Missing button '+title);await handle.asElement().click();await handle.dispose();}
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:15000},text);
async function fill(page,label,value){await page.waitForFunction(text=>[...document.querySelectorAll('form label')].some(item=>item.childNodes[0]?.textContent===text&&item.querySelector('input,textarea,select')),{timeout:15000},label);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('form label')].find(item=>item.childNodes[0]?.textContent===text)?.querySelector('input,textarea,select'),label);const node=handle.asElement();assert.ok(node,'Missing field '+label);await node.type(value);await handle.dispose();}
async function scenario(width,mode='normal'){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 page.on('pageerror',error=>errors.push({width,mode,error:error.message}));await page.setRequestInterception(true);
 const records={PEOPLE:[],ISSUES:[],MATERIALS:[]},receipts=new Map(),posts=[];let counter=0;
 const revision=()=>`2026-10-01T10:00:00.${String(++counter).padStart(6,'0')}`;
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();throw new Error('Unexpected external request');}
   if(!['/api/identity/site-register','/api/identity/site-photo'].includes(url.pathname))return request.continue();
   let body,status=200;
   if(mode==='denied'){status=403;body={code:'WORKSPACE_INTEGRATION_PERMISSION_REQUIRED'};}
   else if(request.method()==='POST'){
    const input=JSON.parse(request.postData());posts.push(input);assert.equal(input.projectId,projectId);assert.equal(input.scope,scope);const p=input.payload;
    const receiptId='site_receipt_'+input.operationId;let person,report;
    if(url.pathname==='/api/identity/site-photo'){
     assert.deepEqual(Buffer.from(input.image.split(',').at(-1),'base64'),picture);const record=records.ISSUES.find(row=>row.id===input.reportId);assert.ok(record);assert.equal(record.revision,input.revision);const photo={id:'sitephoto_'+'a'.repeat(64),bytes:picture.length,contentType:'image/png'};record.photos=[photo];record.revision=revision();body={scope,saved:true,receiptId,photo};receipts.set(input.operationId,body);await request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});return;
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
   }else if(url.searchParams.has('operationId')){assert.ok(receipts.has(url.searchParams.get('operationId')));body={state:'RECORDED',...receipts.get(url.searchParams.get('operationId'))};}
   else{const section=url.searchParams.get('section');assert.ok(records[section]);body={scope,projectId,section,records:records[section],total:records[section].length,nextCursor:null,roles:SITE_ROLES,units:MATERIAL_UNITS,workerSelfServiceEnabled:false};}
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(error){errors.push({width,mode,error:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Abrir registro');
 if(mode==='denied'){await wait(page,'no permite administrar');assert.equal(posts.length,0);checks.push('unauthorized-view-has-no-example-records');await context.close();return;}
 await wait(page,'Agregar persona');await click(page,'Agregar persona');await fill(page,'Nombre','Persona de ensayo');await fill(page,'Teléfono internacional','+5491100001111');await page.select('form select','FOREMAN');
 await click(page,'Guardar registro');
 if(mode==='uncertain'){await wait(page,'resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar guardado');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);checks.push('uncertain-save-recovers-without-another-POST');await context.close();return;}
 if(mode==='conflict'){await wait(page,'El registro cambió');assert.ok(!(await page.evaluate(()=>document.body.innerText)).includes('Recibo confirmado'));assert.equal(await page.$eval('input[type="tel"]',el=>el.value),'+5491100001111');checks.push('conflict-preserves-form-and-never-shows-saved');await context.close();return;}
 await wait(page,'Persona de ensayo');await wait(page,'Recibo confirmado');assert.equal(posts.length,1);
 assert.ok((await page.evaluate(()=>document.body.innerText)).includes('Identidad y canal pendientes'));
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
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await click(page,'Adjuntar foto privada');const upload=await page.$('input[type="file"]');assert.ok(upload);await upload.uploadFile(picturePath);await click(page,'Guardar registro');await wait(page,'Fotografía privada adjunta');await wait(page,'Descargar foto');
 assert.equal(await page.$eval('a',a=>new URL(a.href).pathname),'/api/identity/site-photo');assert.ok(!(await page.$eval('a',a=>a.href)).includes('blob.vercel-storage'));assert.equal(posts.length,7);
 checks.push(`roster-issue-material-lifecycle-${width}`);await context.close();
}
try{
 let ready=false;for(let count=0;count<120;count++){if(server.exitCode!==null)throw new Error('Fixture exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario(width);for(const mode of ['uncertain','conflict','denied'])await scenario(390,mode);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'actual-component-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,errors,productionDataWritten:false,workerPhoneVerified:false,metaMessagesSent:0};
 writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,errors,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(done=>setTimeout(done,500));rmSync(fixture,{recursive:true,force:true});}
