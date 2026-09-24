import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
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

const { createFlowReplyFixture } = await import('../tests/helpers/flow-reply-fixture.js');
const { historyAccess, HISTORY_NOW } = await import('../tests/helpers/flow-history-fixture.js');
const { createWhatsAppProactiveFlowHandlers } = await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/proactive-flow-reply-ui');mkdirSync(out,{recursive:true});
const entry=`import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';import History from'./src/app/dashboard/inbox/proactive-flow-history';import './src/app/globals.css';function App(){const[chat,setChat]=useState('conversation-a'),[online,setOnline]=useState(true);useEffect(()=>{const change=e=>{if(e.detail.chat)setChat(e.detail.chat);if(typeof e.detail.online==='boolean')setOnline(e.detail.online)};window.addEventListener('fixture-context',change);return()=>window.removeEventListener('fixture-context',change)},[]);return <main><p>RESPUESTA CORRELACIONADA · DATOS DE ENSAYO</p><History organizationId="organization-a" projectId="project-a" conversationId={chat} online={online}/></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const f=createFlowReplyFixture(),requests=[],errors=[],cases=[],before=JSON.stringify({messages:f.messages,sessions:f.sessions});let mode='normal',held=null;
const json=(res,payload,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(payload));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
 if(url.pathname.startsWith('/api/')){
  requests.push({method:req.method,path:url.pathname,mode:url.searchParams.get('mode')});
  if(url.searchParams.get('mode')==='reply'&&mode==='fail'){json(res,{error:'Controlled failure'},503);return;}
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>historyAccess,authorize:()=>{},prismaFactory:()=>f.prisma,clock:()=>HISTORY_NOW});
  const response=await handlers.GET(new Request(url,{headers:req.headers}),{params:Promise.resolve({conversationId:url.pathname.split('/')[4]})});let payload=await response.json();
  if(url.searchParams.get('mode')==='reply'){
   if(mode==='foreign')payload={...payload,sourceMessageId:'another-outbound'};
   if(mode==='not-recorded')payload={...payload,state:'not_recorded',reply:null};
   if(mode==='unavailable')payload={...payload,state:'unavailable',reply:null};
   if(mode==='hold'){held={res,payload,status:response.status};return;}
  }
  json(res,payload,response.status);return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;font-family:Arial}main{max-width:860px;margin:auto;padding:12px}main>p{font-size:10px;color:#94a3b8}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));
 const url='http://127.0.0.1:'+server.address().port,history=page.getByRole('region',{name:'Seguimiento de formularios'}),reply=history.getByRole('region',{name:'Respuesta vinculada al formulario'});
 const openHistory=()=>history.getByRole('button',{name:'Consultar envíos anteriores',exact:true}).click();
 const openReply=()=>reply.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();
 const refresh=()=>reply.getByRole('button',{name:'Actualizar respuesta',exact:true}).click();
 await page.goto(url);assert.equal(requests.length,0);await openHistory();await expect(history.getByRole('listitem')).toHaveCount(3);assert.equal(requests.filter(row=>row.mode==='reply').length,0);await expect(reply).toHaveCount(1);
 await reply.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).focus();await page.keyboard.press('Enter');await expect(reply.getByText('Origen de la respuesta verificado',{exact:true})).toBeVisible();await expect(reply.getByText(f.reply.body,{exact:true})).toBeVisible();assert.equal(requests.filter(row=>row.mode==='reply').length,1);cases.push('lazy-exact-correlation-keyboard-and-read-only');
 assert.ok(!(await reply.innerText()).includes('PRIVATE_TOKEN_CANARY'));assert.ok(!(await reply.innerText()).includes('wamid.'));await expect(reply.getByText(/no certifica un parte/)).toBeVisible();cases.push('restricted-contract-and-no-business-approval-claim');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await reply.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await reply.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await reply.screenshot({path:resolve(out,'reply-'+width+'.png')});}
 cases.push('responsive-320-390-768-1280');
 await page.reload();await openHistory();await openReply();await expect(reply.getByText(f.reply.body,{exact:true})).toBeVisible();cases.push('reload-finds-persisted-reply-without-client-attempt-key');
 mode='fail';await refresh();await expect(reply.getByRole('alert')).toBeVisible();await expect(reply.getByText(f.reply.body,{exact:true})).toHaveCount(0);mode='normal';await refresh();await expect(reply.getByText(f.reply.body,{exact:true})).toBeVisible();cases.push('failure-clears-stale-body-and-explicit-retry');
 mode='foreign';await refresh();await expect(reply.getByRole('alert')).toContainText('no corresponde');await expect(reply.getByText(f.reply.body,{exact:true})).toHaveCount(0);cases.push('foreign-source-response-never-presented');
 mode='not-recorded';await refresh();await expect(reply.getByText(/no encontró una respuesta procesada/)).toBeVisible();mode='unavailable';await refresh();await expect(reply.getByText(/No se pudo vincular un mensaje visible/)).toBeVisible();cases.push('absence-and-unavailable-distinct-no-guessed-record');
 mode='hold';await refresh();await expect.poll(()=>Boolean(held)).toBe(true);await reply.getByRole('button',{name:'Cerrar respuesta'}).click();mode='normal';json(held.res,held.payload,held.status);held=null;await page.waitForTimeout(100);await expect(reply.getByText(f.reply.body,{exact:true})).toHaveCount(0);await expect(reply.getByRole('button',{name:'Consultar respuesta vinculada'})).toBeVisible();cases.push('closed-panel-discards-late-response');
 await openReply();await expect(reply.getByText(f.reply.body,{exact:true})).toBeVisible();const count=requests.length;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:false}})));await expect(reply).toHaveCount(0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:true}})));await expect(reply).toHaveCount(1);assert.equal(requests.length,count);await expect(reply.getByText(f.reply.body,{exact:true})).toHaveCount(0);cases.push('offline-reconnect-requires-new-explicit-read');
 mode='hold';await openReply();await expect.poll(()=>Boolean(held)).toBe(true);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{chat:'other'}})));mode='normal';json(held.res,held.payload,held.status);held=null;await page.waitForTimeout(100);await expect(reply).toHaveCount(0);await expect(page.getByText(f.reply.body,{exact:true})).toHaveCount(0);cases.push('conversation-switch-discards-inflight-reply');
 assert.equal(requests.some(row=>row.method!=='GET'),false);assert.equal(JSON.stringify({messages:f.messages,sessions:f.sessions}),before);assert.deepEqual(errors,[]);
 const proof={status:'PASS',environment:'real-history-reply-components-route-and-reader-with-controlled-identity-HTTP-database',cases,widths:[320,390,768,1280],pageErrors:0,networkWrites:0,providerCalls:0,realMessagesSent:0,clerkVerified:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({name:error.name,message:error.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{if(held)json(held.res,held.payload,held.status);await browser?.close();await new Promise(done=>server.close(done));}
