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
const { createDatabase, access, NOW, CONFIGURED_META_ENV, FLOW_SECRET } = await import('../tests/helpers/proactive-flow-fixture.js');
const { createWhatsAppProactiveFlowHandlers } = await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const { sendProactiveWhatsAppFlowTemplate } = await import('../src/lib/whatsapp/proactive-flows.js');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/proactive-flow-confirmation-ui');mkdirSync(out,{recursive:true});
const entry=`import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import Launcher from './src/app/dashboard/inbox/proactive-flow-launcher';import './src/app/globals.css';window.callbackResults=[];window.throwCallback=false;function App(){const[chat,setChat]=useState('conversation-a'),[online,setOnline]=useState(true);useEffect(()=>{const change=e=>{if(e.detail.chat)setChat(e.detail.chat);if(typeof e.detail.online==='boolean')setOnline(e.detail.online)};window.addEventListener('fixture-context',change);return()=>window.removeEventListener('fixture-context',change)},[]);return <main><p>PRUEBA CONTROLADA · SIN MENSAJES REALES</p><Launcher organizationId="organization-a" projectId="project-a" conversationId={chat} canManageIntegrations online={online} onMessageSent={result=>{window.callbackResults.push(result);if(window.throwCallback)return Promise.reject(Error('Historial desconectado'))}}/></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'fixture-links',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a href={href} {...props}/>} `}));}}]});
let store=createDatabase(),mode='normal',posts=0,providerCalls=0,patches=0,held=null;const history=[],errors=[],scenarios=[];
function reset(nextMode='normal'){assert.equal(held,null);store=createDatabase();mode=nextMode;posts=0;providerCalls=0;patches=0;history.length=0;}
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
 if(url.pathname.startsWith('/api/whatsapp/inbox/')){
  const chat=url.pathname.split('/')[4];const method=req.method;let raw='';for await(const chunk of req)raw+=chunk;
  const body=raw?JSON.parse(raw):null;history.push({method,chat,mode:url.searchParams.get('mode'),key:req.headers['idempotency-key'],body});
  if(method==='POST')posts++;if(method==='PATCH')patches++;
  if(mode==='receipt-fail'&&url.searchParams.get('mode')==='receipt'){json(res,{error:'Consulta de recibo interrumpida.'},503);return;}
  if(mode==='absent'&&method==='POST'){json(res,{error:'Respuesta incierta.'},503);return;}
  const localStore=store;
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access(),authorize:()=>{},prismaFactory:()=>localStore.prisma,clock:()=>new Date(NOW.getTime()+180000),env:CONFIGURED_META_ENV,
   sendFlow:input=>sendProactiveWhatsAppFlowTemplate({...input,flowSessionSecret:FLOW_SECRET,sendTemplate:async()=>{providerCalls++;if(mode==='provider-unknown')throw new TypeError('Controlled provider timeout');return {messages:[{id:'wamid.controlled-send-'+providerCalls}]};}})});
  try{
   const response=await handlers[method](new Request(url,{method,headers:req.headers,...(raw?{body:raw}:{})}),{params:Promise.resolve({conversationId:chat})});
   const result=await response.json();
   if(method==='POST'&&mode==='empty'){json(res,{});return;}
   if(method==='POST'&&mode==='foreign'){json(res,{...result,context:{...result.context,conversationId:'conversation-other'},conversationId:'conversation-other',flow:{key:'shift-check-in'}});return;}
   if(method==='PATCH'&&mode==='patch-empty'){json(res,{});return;}
   if(method==='POST'&&mode==='hold-send'||method==='GET'&&mode==='hold-read'){held={res,result,status:response.status};return;}
   json(res,result,response.status);
  }catch(error){json(res,{error:'Controlled test request failed',code:error.code},500);}return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#0b1120;color:#e2e8f0;font-family:Arial}main{max-width:760px;padding:16px;margin:auto}main>p{font-size:11px;color:#94a3b8}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
function release(){if(held){const old=held;held=null;json(old.res,old.result,old.status);}}
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
 const url='http://127.0.0.1:'+server.address().port;
 const review=page.getByRole('group',{name:'Revisar envío de formulario'});
 const send=()=>page.getByRole('button',{name:'Enviar formulario',exact:true});
 const receipt=()=>page.getByRole('button',{name:'Consultar recibo sin reenviar',exact:true});
 async function choose(){await page.goto(url);await page.getByRole('button',{name:/Incidencia de obra/}).click();await expect(review).toBeVisible();await expect(send()).toBeDisabled();await review.getByRole('checkbox').check();}

 for(const scenario of ['empty','foreign']){
  reset(scenario);await choose();await expect(review).toContainText(store.template.bodyText);await expect(review).toContainText(store.template.buttonText);await expect(review).toContainText('1111');
  if(scenario==='empty')for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});await review.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'send-review-'+width+'.png')});}
  await send().click();await expect(page.getByText('Resultado sin confirmar',{exact:true})).toBeVisible();await expect(receipt()).toBeEnabled();assert.equal(await page.evaluate(()=>window.callbackResults.length),0);
  assert.equal(posts,1);assert.equal(providerCalls,1);const key=history.find(row=>row.method==='POST').key;
  mode='receipt-fail';await receipt().click();await expect(page.getByRole('alert')).toContainText('Consulta de recibo interrumpida.');assert.equal(posts,1);
  mode='normal';await receipt().click();await expect(page.getByText('Aceptado por Meta',{exact:true})).toBeVisible();await expect(receipt()).toHaveCount(0);
  assert.equal(await page.evaluate(()=>window.callbackResults.length),1);assert.equal(posts,1);assert.equal(providerCalls,1);assert.equal(store.messages.length,1);
  assert.ok(history.filter(row=>row.mode==='receipt').every(row=>row.method==='GET'&&row.key===key));
  scenarios.push({scenario,corrected:true,senderCalls:providerCalls,messageRows:store.messages.length,receiptReads:history.filter(row=>row.mode==='receipt').length});
 }
 reset('absent');await choose();await send().click();await expect(receipt()).toBeEnabled();mode='normal';await receipt().click();await expect(page.getByRole('alert')).toContainText('El recibo todavía no aparece');await expect(receipt()).toBeEnabled();await expect(send()).toHaveCount(0);assert.equal(providerCalls,0);assert.equal(store.messages.length,0);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:false}})));await expect(receipt()).toBeDisabled();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:true}})));await expect(receipt()).toBeEnabled();await page.waitForTimeout(100);assert.equal(posts,1);scenarios.push({scenario:'absent-receipt-and-reconnect',newSends:0});
 reset();await choose();await page.evaluate(()=>{window.throwCallback=true;});await send().evaluate(button=>{button.click();button.click();});await expect(page.getByText('Aceptado por Meta',{exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('El recibo está confirmado');assert.equal(posts,1);assert.equal(providerCalls,1);await expect(receipt()).toHaveCount(0);scenarios.push({scenario:'double-click-and-history-error',senderCalls:1});
 reset('hold-send');await choose();await send().click();await expect.poll(()=>Boolean(held)).toBe(true);mode='normal';await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{chat:'conversation-other'}})));await expect(page.getByRole('alert')).toContainText('conversación');release();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.callbackResults.length),0);await expect(page.getByText('Aceptado por Meta',{exact:true})).toHaveCount(0);scenarios.push({scenario:'chat-switch-during-send',crossChatCallbacks:0});
 reset('hold-read');await page.goto(url);await expect.poll(()=>Boolean(held)).toBe(true);mode='normal';await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{chat:'conversation-other'}})));await expect(page.getByRole('alert')).toContainText('conversación');release();await page.waitForTimeout(100);await expect(page.getByRole('button',{name:/Incidencia de obra/})).toHaveCount(0);scenarios.push({scenario:'late-catalog-after-chat-switch',staleOptions:0});
 reset();await choose();store.worker.id='different-worker';await send().click();await expect(page.getByRole('alert')).toContainText('cambiaron');await expect(receipt()).toHaveCount(0);assert.equal(providerCalls,0);assert.equal(store.messages.length,0);await page.getByRole('button',{name:'Actualizar catálogo'}).click();await page.getByRole('button',{name:/Incidencia de obra/}).click();await expect(send()).toBeDisabled();scenarios.push({scenario:'recipient-changes-after-review',senderCalls:0,reconfirmationRequired:true});
 reset('provider-unknown');await choose();await send().click();await expect(receipt()).toBeEnabled();mode='normal';await page.getByRole('button',{name:'Actualizar catálogo'}).click();await page.getByRole('button',{name:'Revisar bloqueo',exact:true}).click();
 const decision=page.getByRole('group',{name:'Decisión sobre bloqueo'});await decision.getByRole('checkbox').check();mode='patch-empty';await page.getByRole('button',{name:'Habilitar nuevo intento'}).click();await expect(page.getByText('La decisión no está confirmada.',{exact:false})).toBeVisible();assert.equal(providerCalls,1);assert.equal(patches,1);
 mode='normal';await page.getByRole('button',{name:'Verificar la misma decisión'}).click();await expect(page.getByText('Decisión registrada',{exact:true})).toBeVisible();assert.equal(providerCalls,1);assert.equal(patches,2);assert.equal(store.audits.filter(row=>row.action==='whatsapp.inbox.flow_template_uncertainty_resolved').length,1);scenarios.push({scenario:'empty-resolution-response',sameDecisionRequests:2,decisionAudits:1,automaticMessages:0});
 assert.deepEqual(errors,[]);
 const report={status:'PASS',scenarios,environment:'real-React-HTTP-route-and-domain-with-injected-identity-in-memory-database-and-provider',widths:[320,390,768,1280],pageErrors:0,realProviderCalls:0,realMessagesSent:0,authenticatedClerk:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({name:error.name,message:error.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{release();await browser?.close();await new Promise(done=>server.close(done));}
