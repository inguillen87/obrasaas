import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { database, context as reportContext } from '../tests/helpers/message-report-fixture.js';
import { prepareWhatsAppProgressReport, createWhatsAppProgressReport } from '../src/lib/whatsapp/progress-report.js';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/message-report-ui');mkdirSync(out,{recursive:true});
const tasks=[{id:'task-a',title:'Mampostería · Sector norte',type:'TASK'}];
const entry=`import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';import Action,{MessageReportDialog}from'./src/app/dashboard/inbox/message-report-action';function App(){const[open,setOpen]=useState(false),[saved,setSaved]=useState(null),[message,setMessage]=useState('message-a');useEffect(()=>{const change=e=>setMessage(e.detail);window.addEventListener('test-message-context',change);return()=>window.removeEventListener('test-message-context',change)},[]);return <main><h1>Bandeja de ensayo</h1><Action sourceKind="TEXT" saved={saved} onOpen={()=>setOpen(true)}/>{open&&<MessageReportDialog organizationId="org-a" projectId="project-a" projectName="Obra sintética" conversationId="conversation-a" messageId={message} tasks={${JSON.stringify(tasks)}} onClose={()=>setOpen(false)} onSaved={record=>{if(window.testCallbackFailure)throw Error('parent-refresh-failed');setSaved(record);setOpen(false)}}/>}</main>}createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'fixture-link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a href={href} {...props}/>}`}));}}]});
let store=database(),mode='normal',held=null;const requests=[],errors=[],cases=[];
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(data));};
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path.endsWith('/progress-report')){
  try{
   requests.push({method:req.method,path});assert.equal(req.headers['x-obrasaas-organization'],'org-a');assert.equal(req.headers['x-obrasaas-project'],'project-a');
   const context={...reportContext,messageId:decodeURIComponent(path.split('/')[6])};
   if(mode==='denied'){json(res,{error:'Origen no disponible para este rol',code:'PERMISSION_DENIED'},403);return;}
   if(req.method==='GET'){
    if(mode==='read-fail'){json(res,{error:'Consulta temporalmente no disponible'},503);return;}
    const data=await prepareWhatsAppProgressReport(store.prisma,context);
    if(mode==='foreign-existing'&&data.existing)data.existing.id='wa_report_'+'c'.repeat(64);
    if(mode==='hold-read'){held={res,data};return;}
    json(res,data);return;
   }
   assert.equal(req.method,'POST');let raw='';for await(const chunk of req)raw+=chunk;const input=JSON.parse(raw);requests.at(-1).key=req.headers['idempotency-key'];requests.at(-1).input=input;
   if(mode==='absent-uncertain'){json(res,{error:'Resultado sin confirmar'},503);return;}
   if(mode==='source-changed'){store.state.message.body+=' Actualizado';}
   const data=await createWhatsAppProgressReport(store.prisma,{...context,input,operationKey:req.headers['idempotency-key']});
   if(mode==='lost'){json(res,{error:'Respuesta perdida después de guardar'},502);return;}
   if(mode==='empty'){json(res,{});return;}
   if(mode==='foreign-receipt'){data.context.conversationId='other';}
   if(mode==='hold-post'){held={res,data};return;}
   json(res,data,data.replayed?200:201);
  }catch(error){json(res,{error:error.message,code:error.code},error.status||503);}return;
 }
 if(['/bundle.js','/bundle.css'].includes(path)){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,path.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:#f8fafc;font:16px Arial}main{padding:24px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
const posts=()=>requests.filter(r=>r.method==='POST').length;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.type()==='beforeunload'?d.accept():d.dismiss());
 const url='http://127.0.0.1:'+server.address().port,dialog=page.getByRole('dialog',{name:'Preparar parte de obra'});
 async function open(){await page.goto(url);await page.getByRole('button',{name:/Preparar parte/}).click();}
 async function fill(){await dialog.getByRole('button',{name:'Usar este texto como borrador'}).click();await dialog.getByRole('combobox',{name:'Tarea de destino',exact:true}).selectOption('task-a');await dialog.getByRole('textbox',{name:'Título del parte',exact:true}).fill('Material pendiente');await dialog.getByRole('checkbox').check();}
 const save=()=>dialog.getByRole('button',{name:'Crear borrador vinculado a la tarea',exact:true}).click();
 const recover=()=>dialog.getByRole('button',{name:'Consultar recibo sin guardar de nuevo',exact:true}).click();
 await open();await expect(dialog.getByRole('button',{name:'Cerrar preparación del parte'})).toBeFocused();await fill();assert.equal(posts(),0);
 await dialog.getByRole('button',{name:'Volver a mensajes'}).click();await expect(dialog.getByRole('textbox',{name:'Título del parte',exact:true})).toHaveValue('Material pendiente');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'report-'+width+'.png')});}
 await save();await expect(dialog).toHaveCount(0);await expect(page.getByRole('link',{name:/Parte registrado/})).toHaveAttribute('href',new RegExp('#daily-log-wa_report_[a-f0-9]{64}$'));assert.equal(store.state.logs.length,1);assert.equal(store.state.audits.length,1);cases.push('reviewed-create-exact-link-responsive-and-draft-close-guard');
 await open();await expect(dialog.getByRole('heading',{name:'Este mensaje ya tiene un parte'})).toBeVisible();assert.equal(store.state.logs.length,1);cases.push('reload-finds-the-same-existing-part');
 mode='foreign-existing';await open();await expect(dialog.getByRole('alert')).toContainText('no confirmó');await expect(dialog.getByRole('link')).toHaveCount(0);mode='normal';await dialog.getByRole('button',{name:'Volver a consultar el origen'}).click();await expect(dialog.getByRole('link',{name:'Consultar parte registrado'})).toBeVisible();cases.push('foreign-existing-record-never-produces-link');
 store=database();mode='read-fail';await open();await expect(dialog.getByRole('alert')).toBeVisible();const beforeReadRetry=posts();mode='normal';await dialog.getByRole('button',{name:'Volver a consultar el origen'}).click();await fill();assert.equal(posts(),beforeReadRetry);cases.push('failed-initial-get-recovers-without-closing');
 mode='source-changed';await save();await expect(dialog.getByRole('button',{name:'Actualizar mensaje de origen'})).toBeVisible();mode='read-fail';await dialog.getByRole('button',{name:'Actualizar mensaje de origen'}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByRole('textbox',{name:'Título del parte',exact:true})).toHaveValue('Material pendiente');await expect(dialog.getByRole('checkbox')).toBeDisabled();mode='normal';await dialog.getByRole('button',{name:'Volver a consultar el origen'}).click();await expect(dialog.getByRole('checkbox')).not.toBeChecked();await expect(dialog.getByRole('textbox',{name:'Título del parte',exact:true})).toHaveValue('Material pendiente');await dialog.getByRole('checkbox').check();await save();await expect(dialog).toHaveCount(0);assert.equal(store.state.logs.length,1);cases.push('source-refresh-retains-draft-and-requires-new-consent');
 for(const failure of ['lost','empty','foreign-receipt']){
  store=database();mode='normal';await open();await fill();mode=failure;const start=posts();await save();await expect(dialog.getByRole('button',{name:'Consultar recibo sin guardar de nuevo'})).toBeVisible();await expect(dialog.getByRole('link')).toHaveCount(0);assert.equal(store.state.logs.length,1);
  store.state.logs[0].status='APPROVED';store.state.logs[0].revision=2;mode='normal';await recover();await expect(dialog.getByRole('link',{name:'Consultar parte registrado'})).toBeVisible();assert.equal(posts(),start+1);assert.equal(store.state.logs[0].status,'APPROVED');assert.equal(store.state.audits.length,1);cases.push(failure+'-recovered-by-read-without-post-or-state-reset');
 }
 store=database();mode='normal';await open();await fill();mode='absent-uncertain';await save();await expect(dialog.getByRole('button',{name:'Consultar recibo sin guardar de nuevo'})).toBeVisible();mode='normal';const before=posts();await recover();await expect(dialog.getByRole('alert')).toContainText('aún no está disponible');await expect(dialog.getByRole('button',{name:'Crear borrador vinculado a la tarea'})).toBeDisabled();assert.equal(posts(),before);assert.equal(store.state.logs.length,0);cases.push('absent-receipt-never-unlocks-another-post');
 store=database();mode='normal';await open();await fill();mode='hold-post';const dblStart=posts();await save();await expect.poll(()=>Boolean(held)).toBe(true);await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));assert.equal(posts(),dblStart+1);json(held.res,held.data);held=null;await expect(dialog).toHaveCount(0);cases.push('double-submit-guarded-before-dispatch');
 store=database();mode='normal';await open();await fill();await page.evaluate(()=>window.testCallbackFailure=true);await save();await expect(dialog.getByRole('alert')).toContainText('quedó confirmado');await expect(dialog.getByRole('link',{name:'Consultar parte registrado'})).toBeVisible();await expect(dialog.getByRole('button',{name:'Consultar recibo sin guardar de nuevo'})).toHaveCount(0);cases.push('parent-refresh-failure-preserves-confirmed-record');
 store=database();mode='normal';await open();await fill();mode='hold-post';await save();await expect.poll(()=>Boolean(held)).toBe(true);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('test-message-context',{detail:'other-message'})));mode='normal';json(held.res,held.data);held=null;await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByRole('link')).toHaveCount(0);cases.push('changed-source-unmount-discards-late-write-response');
 store=database();mode='denied';await open();await expect(dialog.getByRole('alert')).toContainText('este rol');await expect(dialog.getByRole('textbox')).toHaveCount(0);await expect(dialog.getByRole('button',{name:'Volver a consultar el origen'})).toHaveCount(0);cases.push('revoked-access-does-not-retry-or-disclose');
 store=database();store.state.message.kind='AUDIO';store.state.message.body='[audio]';store.state.message.metadata.transcription={status:'completed',text:'Terminamos el muro norte. Revisar medición.'};mode='normal';await open();await expect(dialog.getByText('Transcripción ya procesada',{exact:true})).toBeVisible();cases.push('audio-transcription-remains-explicit');
 assert.deepEqual(errors,[]);const proof={result:'PASS',environment:'real-report-dialog-and-domain-services-with-controlled-HTTP-identity-and-database',cases,widths:[320,390,768,1280],pageErrors:0,providerCalls:0,realMessagesSent:0,clerkVerified:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({name:error.name,message:error.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{if(held)json(held.res,held.data);await browser?.close();await new Promise(done=>server.close(done));}
