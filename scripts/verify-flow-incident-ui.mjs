import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@clerk/nextjs/server') return { url: 'mock:clerk', shortCircuit: true };
    if (specifier === 'next/headers') return { url: 'mock:headers', shortCircuit: true };
    if (specifier.startsWith('@/')) return next(new URL('../src/' + specifier.slice(2) + (specifier.startsWith('@/generated/') ? '.ts' : '.js'), import.meta.url).href, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'mock:clerk') return { format: 'module', shortCircuit: true, source: "export async function auth(){throw Error('Unexpected identity provider call')} export async function clerkClient(){throw Error('Unexpected identity provider call')}" };
    if (url === 'mock:headers') return { format: 'module', shortCircuit: true, source: "export async function cookies(){throw Error('Unexpected cookie access')}" };
    return next(url, context);
  },
});


const {createFlowIncidentFixture}=await import('../tests/helpers/flow-incident-fixture.js');
const {historyAccess,historyScope,HISTORY_NOW}=await import('../tests/helpers/flow-history-fixture.js');
const {createWhatsAppProactiveFlowHandlers}=await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/flow-incident-ui');mkdirSync(out,{recursive:true});
const entry=`import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';import Reply from'./src/app/dashboard/inbox/proactive-flow-reply';import './src/app/globals.css';function App(){const[chat,setChat]=useState('conversation-a'),[online,setOnline]=useState(true);useEffect(()=>{const fn=e=>{if(e.detail.chat)setChat(e.detail.chat);if(typeof e.detail.online==='boolean')setOnline(e.detail.online)};window.addEventListener('fixture-context',fn);return()=>window.removeEventListener('fixture-context',fn)},[]);return <main><p>INCIDENCIA VINCULADA · DATOS DE ENSAYO</p><Reply organizationId="organization-a" projectId="project-a" conversationId={chat} sourceMessageId="message-0000" online={online}/></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const f=createFlowIncidentFixture(),requests=[],errors=[],cases=[];let mode='normal',held=null;
const json=(res,payload,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(payload));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
 if(url.pathname.startsWith('/api/')){
  requests.push({method:req.method,mode:url.searchParams.get('mode')});
  if(url.searchParams.get('mode')==='incident'&&mode==='fail'){json(res,{},503);return;}
  if(url.searchParams.get('mode')==='incident'&&mode==='denied'){json(res,{},403);return;}
  const access={...historyAccess,orgId:mode==='no-project-permission'?null:'clerk-test',tenantRole:'ADMIN'};
  const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:()=>{},prismaFactory:()=>f.prisma,clock:()=>HISTORY_NOW});
  const before=JSON.stringify({messages:f.messages,sessions:f.sessions,snapshot:f.snapshot});
  const response=await h.GET(new Request(url,{headers:req.headers}),{params:Promise.resolve({conversationId:url.pathname.split('/')[4]})});let payload=await response.json();
  assert.equal(JSON.stringify({messages:f.messages,sessions:f.sessions,snapshot:f.snapshot}),before);
  if(url.searchParams.get('mode')==='incident'){
   if(mode==='foreign')payload={...payload,sourceMessageId:'other'};
   if(mode==='hold'){held={res,payload,status:response.status};return;}
  }
  json(res,payload,response.status);return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;font-family:Arial}main{max-width:860px;margin:auto;padding:12px}main>p{font-size:10px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
const release=()=>{if(held){const r=held;held=null;json(r.res,r.payload,r.status);}};
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port,section=page.getByRole('region',{name:'Incidencia vinculada al formulario'});
 async function open(){await page.goto(url);await page.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();await expect(section.getByRole('button',{name:'Consultar incidencia vinculada',exact:true})).toBeVisible();}
 await open();assert.equal(requests.some(r=>r.mode==='incident'),false);await section.getByRole('button',{name:'Consultar incidencia vinculada',exact:true}).click();await expect(section).toContainText(f.incident.id);await expect(section).toContainText('Sin estado de resolución registrado');await expect(section).toContainText('Crítica');cases.push('explicit-chain-reply-to-incident-with-no-extra-read');
 for(const bad of ['PRIVATE_','wamid.','flowToken','worker-a'])assert.equal((await section.innerText()).includes(bad),false);cases.push('private-detail-not-exposed');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await section.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'incident-'+width+'.png')});}cases.push('responsive-four-widths');
 f.incident.status='resolved';f.snapshot.version++;await section.getByRole('button',{name:'Actualizar incidencia',exact:true}).click();await expect(section).toContainText('Resuelta en el registro');cases.push('current-resolution-observed-without-changing-record');
 mode='fail';await section.getByRole('button',{name:'Actualizar incidencia',exact:true}).click();await expect(section.getByRole('alert')).toBeVisible();await expect(section.getByText(f.incident.id,{exact:true})).toHaveCount(0);mode='normal';await section.getByRole('button',{name:'Actualizar incidencia',exact:true}).click();await expect(section).toContainText(f.incident.id);cases.push('failed-refresh-clears-data-and-can-retry');
 mode='foreign';await section.getByRole('button',{name:'Actualizar incidencia',exact:true}).click();await expect(section.getByRole('alert')).toContainText('no corresponde');await expect(section.getByText(f.incident.id,{exact:true})).toHaveCount(0);cases.push('foreign-response-rejected');
 mode='normal';const receipt=f.reply.metadata.flowIncidentReceipt;delete f.reply.metadata.flowIncidentReceipt;await section.getByRole('button',{name:'Actualizar incidencia',exact:true}).click();await expect(section).toContainText('no conserva el vínculo');f.reply.metadata.flowIncidentReceipt=receipt;cases.push('legacy-never-backfilled');
 mode='hold';await section.getByRole('button',{name:'Actualizar incidencia',exact:true}).click();await expect.poll(()=>Boolean(held)).toBe(true);await section.getByRole('button',{name:'Cerrar incidencia',exact:true}).click();release();await page.waitForTimeout(80);await expect(section.getByText(f.incident.id,{exact:true})).toHaveCount(0);cases.push('closed-reader-ignores-late-response');
 mode='normal';await section.getByRole('button',{name:'Consultar incidencia vinculada',exact:true}).click();await expect(section).toContainText(f.incident.id);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:false}})));await expect(section).toHaveCount(0);const before=requests.length;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:true}})));await expect(section.getByRole('button',{name:'Consultar incidencia vinculada',exact:true})).toBeVisible();assert.equal(requests.length,before);await expect(section.getByText(f.incident.id,{exact:true})).toHaveCount(0);cases.push('reconnect-neither-reads-nor-restores-old-data');
 mode='denied';await section.getByRole('button',{name:'Consultar incidencia vinculada',exact:true}).click();await expect(section.getByRole('alert')).toBeVisible();await expect(section.getByRole('button',{name:'Actualizar incidencia',exact:true})).toBeDisabled();cases.push('permission-revocation-blocks-retry');
 mode='no-project-permission';await page.goto(url);await page.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();await expect(page.getByText('Origen de la respuesta verificado',{exact:true})).toBeVisible();await expect(section).toHaveCount(0);cases.push('permission-aware-affordance');
 mode='normal';await open();mode='hold';await section.getByRole('button',{name:'Consultar incidencia vinculada',exact:true}).click();await expect.poll(()=>Boolean(held)).toBe(true);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{chat:'other'}})));release();await expect(section).toHaveCount(0);cases.push('conversation-change-discards-late-reader');
 assert.equal(requests.some(r=>r.method!=='GET'),false);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-reply-incident-components-route-and-reader-controlled-identity-HTTP-database',cases,widths:[320,390,768,1280],pageErrors:0,httpWrites:0,providerCalls:0,clerkVerified:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:e.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw e;}
finally{release();await browser?.close();await new Promise(done=>server.close(done));}
