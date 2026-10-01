import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import puppeteer from 'puppeteer';
assert.ok(!process.env.VERCEL&&!process.env.VERCEL_ENV);
const root=process.cwd(),output=path.join(root,'.vercel/field-operations-evidence');mkdirSync(output,{recursive:true});
const fixture=mkdtempSync(path.join(root,'.vercel/field-ui-')),app=path.join(fixture,'app');mkdirSync(app);
for(const file of ['field-operations-panel.js','field-operations-panel.module.css'])copyFileSync(path.join(root,'src/app/(identity)/cuenta',file),path.join(app,file));
writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'isolated-field-operations-ui',private:true}));
writeFileSync(path.join(fixture,'next.config.mjs'),`export default {devIndicators:false,turbopack:{root:${JSON.stringify(root)}}};`);
writeFileSync(path.join(app,'layout.js'),`export default function Layout({children}){return <html lang="es"><body style={{margin:0,padding:12,background:'#f0f4f7',fontFamily:'Arial,sans-serif'}}>{children}</body></html>}`);
const scope='a'.repeat(64),projectId='project-fixture',rev='2026-10-01T10:00:00.000001';
writeFileSync(path.join(app,'page.js'),`'use client';import {useCallback,useState} from 'react';import {FieldOperationsPanel} from './field-operations-panel';export default function Page(){const [tasks,setTasks]=useState([{id:'task-a',title:'Mampostería de ensayo',progress:0,status:'BACKLOG',revision:'${rev}'}]);const [pending,setPending]=useState(false);const onPending=useCallback(value=>setPending(value),[]);return <main style={{maxWidth:1000,margin:'0 auto'}}><button data-testid="project-switch" disabled={pending}>Cambiar obra</button><p data-approved>Avance aprobado: {tasks[0].progress}%</p><FieldOperationsPanel projectId="${projectId}" scope="${scope}" tasks={tasks} onPending={onPending} onTasksChanged={task=>setTasks(previous=>previous.map(t=>t.id===task.id?{...t,...task}:t))}/></main>}`);
const port=3117,origin='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev',fixture,'--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:root,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data.toString()).slice(-12000);});
const picturePath=path.join(fixture,'synthetic.png'),picture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2l8AAAAASUVORK5CYII=','base64');writeFileSync(picturePath,picture);
let browser;const errors=[],checks=[];
async function click(page,title){await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===text&&!b.disabled),{timeout:20000},title);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text),title);assert.ok(handle.asElement(),'Missing button '+title);await handle.asElement().click();await handle.dispose();}
const wait=(page,text)=>page.waitForFunction(value=>document.body.innerText.includes(value),{timeout:20000},text);
async function fill(page,label,value){const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('form label')].find(item=>item.childNodes[0]?.textContent===text)?.querySelector('input,textarea,select'),label);const node=handle.asElement();assert.ok(node,'Missing field '+label);await node.type(value);await handle.dispose();}
const idle=page=>page.waitForFunction(()=>!document.querySelector('form'),{timeout:20000});
async function scenario(width,mode='normal'){
 const context=await browser.createBrowserContext(),page=await context.newPage();await page.setViewport({width,height:1000});
 await page.evaluateOnNewDocument(()=>{Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition:success=>setTimeout(()=>success({coords:{latitude:0,longitude:0,accuracy:5},timestamp:Date.now()}),10)}});});
 page.on('pageerror',error=>errors.push({width,mode,error:error.message}));await page.setRequestInterception(true);
 const state={scope,projectId,projectRevision:rev,canConfigure:true,canReview:true,canApproveProgress:true,selfWorkers:[{id:'w-a',name:'Operario de ensayo'}],workers:[{id:'w-a',name:'Operario de ensayo'}],sectors:[{id:'sector-main',name:'Planta baja',latitude:0,longitude:0,radius:100},{id:'sector-other',name:'Sector que se conserva',latitude:0,longitude:0,radius:100}],attendance:[],evidence:[],proposals:[],truncated:false},receipts=new Map(),posts=[];
 if(mode==='expired-proposal')state.proposals.push({id:'expired-a',summary:'Mampostería de ensayo · propuesta vencida',status:'EXPIRED',statusStored:'PENDING',expiresAt:'2026-09-29T12:00:00.000Z',revision:rev,taskId:'task-a',workerId:'w-a',progress:25,quantity:null,baseline:null,unit:null,reason:'Propuesta sin decisión antes de su vencimiento.',evidenceIds:[]});
 let counter=1,failed=false;const revision=()=>`2026-10-01T10:00:00.${String(++counter).padStart(6,'0')}`;
 page.on('request',async request=>{
  try{
   const url=new URL(request.url());if(url.origin!==origin){if(['data:','blob:'].includes(url.protocol))return request.continue();return request.abort();}
   if(!['/api/identity/field-operations','/api/identity/field-media'].includes(url.pathname))return request.continue();
   let body,status=200;
   if(mode==='denied'){status=403;body={code:'WORKSPACE_PROJECT_UNAVAILABLE'};}
   else if(request.method()==='POST'){
    const multipart=request.headers()['content-type']?.startsWith('multipart/form-data');
    if(multipart){const buffer=await request.fetchPostData();assert.ok(buffer.includes('task-a'));assert.ok(buffer.includes('w-a'));assert.ok(buffer.includes('image/png'));const op=/name="operationId"\r\n\r\n([^\r]+)/.exec(buffer)[1];posts.push({action:'UPLOAD_EVIDENCE',operationId:op});
     const evidence={id:'e-a',title:'Fotografía de obra',taskId:'task-a',workerId:'w-a',caption:'Registro privado de la mampostería.',sectorId:'sector-main',status:'PENDING',revision:revision(),media:{kind:'image',contentType:'image/png',bytes:picture.length},processing:{status:'QUEUED'},review:null};state.evidence.push(evidence);body={scope,saved:true,receiptId:'fieldmedia_'+op,kind:'EVIDENCE',evidence};receipts.set(op,body);
    }else{
     const input=JSON.parse(request.postData());posts.push(input);assert.equal(input.projectId,projectId);assert.equal(input.scope,scope);const p=input.payload;
     if(input.action==='CONFIGURE_SITE'){assert.equal(p.sectors.length,2);assert.equal(p.sectors[1].id,'sector-other');state.projectRevision=revision();state.sectors=p.sectors;body={scope,saved:true,receiptId:'field_'+input.operationId,kind:'CONFIGURATION',qrTokens:[{sectorId:'sector-main',token:'b'.repeat(64)}]};}
     else if(input.action==='ATTENDANCE'){assert.equal(p.workerId,'w-a');assert.equal(p.location.noticeVersion,'field-location-v1');assert.equal(p.qrToken,'b'.repeat(64));const event={id:'attendance-'+counter,workerId:'w-a',eventType:p.eventType,phase:'WORKING',sectorName:'Planta baja',sectorId:'sector-main',recordedAt:new Date().toISOString(),verificationStatus:'VERIFIED',qrStatus:'MATCHED',location:{accuracyMeters:5,distanceMeters:0},review:null};state.attendance.unshift(event);body={scope,saved:true,receiptId:'field_'+input.operationId,kind:'ATTENDANCE',event};}
     else if(input.evidenceId&&!input.action){const e=state.evidence.find(e=>e.id===input.evidenceId);assert.equal(e.revision,input.revision);e.revision=revision();e.processing={status:'ANALYZED_UNREVIEWED',result:{aiAnalysis:'Respuesta sintética de la prueba de interfaz.'}};body={scope,saved:true,receiptId:'fieldmedia_'+input.operationId,kind:'EVIDENCE_PROCESSING',evidence:e};}
     else if(input.action==='REVIEW_EVIDENCE'){const e=state.evidence.find(e=>e.id===p.evidenceId);assert.equal(e.revision,p.revision);e.revision=revision();e.status='APPROVED';e.review={decision:p.decision,reason:p.reason};body={scope,saved:true,receiptId:'field_'+input.operationId,kind:'EVIDENCE_REVIEW',evidence:e};}
     else if(input.action==='PROPOSE_PROGRESS'){assert.equal(p.progress,25);assert.deepEqual(p.evidenceIds,['e-a']);assert.equal(p.quantity,'2.5');const proposal={id:'proposal-a',summary:'Mampostería de ensayo · 25%',status:'PENDING',revision:revision(),taskId:'task-a',workerId:'w-a',progress:25,quantity:'2.5000',baseline:'10.0000',unit:'M2',reason:p.reason,evidenceIds:p.evidenceIds};state.proposals.push(proposal);body={scope,saved:true,receiptId:'field_'+input.operationId,kind:'PROGRESS_PROPOSAL',proposal,taskUnchanged:true};}
     else if(input.action==='DECIDE_PROGRESS'){const q=state.proposals[0];assert.equal(q.revision,p.revision);q.status='APPLIED';q.result={reason:p.reason};body={scope,saved:true,receiptId:'field_'+input.operationId,kind:'PROGRESS_DECISION',proposal:q,task:{id:'task-a',title:'Mampostería de ensayo',progress:25,status:'IN_PROGRESS',revision:revision()}};}
     else throw new Error('Unexpected action '+input.action);
     receipts.set(input.operationId,body);
     if(mode==='uncertain'&&!failed){failed=true;status=503;body={code:'FIELD_OPERATION_UNCONFIRMED'};}
     if(mode==='conflict'&&!failed){failed=true;status=409;body={code:'FIELD_REVISION_CHANGED'};}
    }
   }else if(url.searchParams.has('operationId'))body={state:'RECORDED',...receipts.get(url.searchParams.get('operationId'))};
   else body=state;
   await request.respond({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Cache-Control':'no-store'}});
  }catch(error){errors.push({width,mode,error:error.message});if(!request.isInterceptResolutionHandled())await request.abort().catch(()=>{});}
 });
 await page.goto(origin,{waitUntil:'networkidle0',timeout:90000});await click(page,'Abrir operaciones');
 if(mode==='denied'){await wait(page,'No se pudo confirmar');assert.equal(posts.length,0);assert.equal(await page.$('form'),null);checks.push('denied-project-never-shows-example-records');await context.close();return;}
 if(mode==='expired-proposal'){await click(page,'Avance');await wait(page,'Vencida');await wait(page,'Venció:');assert.ok(!(await page.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.textContent))).includes('Decidir propuesta'));assert.equal(await page.$eval('[data-approved]',e=>e.innerText),'Avance aprobado: 0%');assert.equal(posts.length,0);checks.push('expired-proposal-displays-deadline-without-authorizing-or-changing-progress');await context.close();return;}
 await click(page,'Sectores y QR');await click(page,'Configurar sector principal');await page.waitForFunction(()=>document.querySelector('[data-testid="project-switch"]').disabled);assert.ok(!(await page.$eval('form input',e=>e.disabled)));
 if(mode==='draft-cancel'){await fill(page,'Nombre',' editado');await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('[data-testid="project-switch"]').disabled);assert.equal(posts.length,0);checks.push('field-draft-locks-project-until-explicit-cancel');await context.close();return;}
 await click(page,'Guardar con recibo');
 if(mode==='uncertain'){await wait(page,'resultado quedó sin confirmar');assert.equal(posts.length,1);await click(page,'Comprobar guardado');await idle(page);assert.equal(posts.length,1);checks.push('uncertain-save-recovery-does-not-send-a-second-POST');await context.close();return;}
 if(mode==='conflict'){await wait(page,'El registro cambió');assert.ok(await page.$('form'));assert.equal(await page.$eval('form input',el=>el.value),'Planta baja');checks.push('stale-revision-preserves-the-complete-form');await context.close();return;}
 await idle(page);await wait(page,'Descargar QR de sector-main');assert.equal(new URL(await page.$eval('a',a=>a.href)).pathname,'/api/identity/field-qr');
 await click(page,'Jornada');await click(page,'Ingreso');await fill(page,'Contenido del QR (opcional; sin QR requiere revisión)',JSON.stringify({version:1,projectId,sectorId:'sector-main',token:'b'.repeat(64)}));await click(page,'Obtener ubicación para este fichaje');await wait(page,'precisión aproximada');await click(page,'Guardar con recibo');await idle(page);await wait(page,'Ubicación y QR coinciden');
 await click(page,'Evidencia');await click(page,'Adjuntar evidencia');const upload=await page.$('input[type="file"]');await upload.uploadFile(picturePath);await fill(page,'Qué muestra o registra','Registro privado de la mampostería.');assert.ok(await page.$eval('[data-testid="project-switch"]',e=>e.disabled));assert.ok(!(await page.$eval('input[type="file"]',e=>e.disabled)));
 if(mode==='file-cancel'){await click(page,'Cancelar');await page.waitForFunction(()=>!document.querySelector('form')&&!document.querySelector('[data-testid="project-switch"]').disabled);assert.equal(posts.length,2);assert.equal(state.evidence.length,0);checks.push('field-private-file-draft-locks-project-until-explicit-cancel');await context.close();return;}
 await click(page,'Guardar con recibo');await idle(page);await wait(page,'Descargar archivo privado');assert.equal(new URL(await page.$eval('a',a=>a.href)).pathname,'/api/identity/field-media');assert.ok(!(await page.$eval('a',a=>a.href)).includes('blob.vercel-storage'));
 await click(page,'Analizar fotografía');await click(page,'Guardar con recibo');await idle(page);await wait(page,'Análisis orientativo');await click(page,'Revisar evidencia');await fill(page,'Fundamento','Se revisó el original privado de esta tarea.');await click(page,'Guardar con recibo');await idle(page);await wait(page,'Aprobada');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`evidence-${width}.png`),fullPage:true});
 await click(page,'Avance');await click(page,'Proponer avance');await fill(page,'Avance propuesto (%)','25');await fill(page,'Cantidad ejecutada acumulada (opcional)','2.5');await fill(page,'Cantidad base','10');await fill(page,'Fundamento','Cantidad medida en la mampostería de ensayo.');await page.click('input[type="checkbox"]');await click(page,'Guardar con recibo');await idle(page);assert.equal(await page.$eval('[data-approved]',e=>e.innerText),'Avance aprobado: 0%');
 await click(page,'Decidir propuesta');await fill(page,'Fundamento','El director revisó la cantidad y la evidencia.');await click(page,'Guardar con recibo');await idle(page);await wait(page,'Avance aprobado: 25%');await wait(page,'Aprobado y aplicado');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,`progress-${width}.png`),fullPage:true});
 checks.push(`configure-qr-location-private-evidence-review-and-approval-${width}`);await context.close();
}
try{
 let ready=false;for(let count=0;count<120;count++){if(server.exitCode!==null)throw new Error('Fixture exited');try{if((await fetch(origin)).ok){ready=true;break;}}catch{}await new Promise(done=>setTimeout(done,500));}assert.ok(ready);
 browser=await puppeteer.launch({headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),args:['--no-sandbox','--disable-setuid-sandbox']});
 for(const width of [320,390,768,1280])await scenario(width);for(const mode of ['draft-cancel','file-cancel','expired-proposal','uncertain','conflict','denied'])await scenario(390,mode);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'actual-component-with-intercepted-synthetic-api',widths:[320,390,768,1280],checks,errors,productionDataWritten:false,physicalGeolocationAccepted:false,cameraQrAccepted:false,providerCalls:0,metaMessagesSent:0};writeFileSync(path.join(output,'browser.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(path.join(output,'browser-failure.json'),JSON.stringify({message:error.message,errors,serverLog},null,2));throw error;}
finally{await browser?.close();try{if(process.platform!=='win32')process.kill(-server.pid,'SIGTERM');else server.kill();}catch{}await new Promise(done=>setTimeout(done,500));const resolved=path.resolve(fixture);assert.ok(resolved.startsWith(path.resolve(root,'.vercel')+path.sep));rmSync(resolved,{recursive:true,force:true});}
