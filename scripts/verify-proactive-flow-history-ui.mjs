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

const { createHistoryFixture, historyScope, historyAccess, HISTORY_NOW } = await import('../tests/helpers/flow-history-fixture.js');
const { createWhatsAppProactiveFlowHandlers } = await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/proactive-flow-history-ui'); mkdirSync(out,{recursive:true});
const entry=`import React,{useState,useEffect}from'react';import{createRoot}from'react-dom/client';import History from'./src/app/dashboard/inbox/proactive-flow-history';import './src/app/globals.css';function App(){const[chat,setChat]=useState('conversation-a'),[online,setOnline]=useState(true);useEffect(()=>{const change=e=>{if(e.detail.chat)setChat(e.detail.chat);if(typeof e.detail.online==='boolean')setOnline(e.detail.online)};window.addEventListener('fixture-context',change);return()=>window.removeEventListener('fixture-context',change)},[]);return <main><p>PRUEBA CONTROLADA · NO ENVÍA MENSAJES</p><History organizationId="organization-a" projectId="project-a" conversationId={chat} online={online}/></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const store = createHistoryFixture(), requests = [], errors = [], cases = []; let mode = 'normal', held = null;
store.messages[0].status='delivered';store.sessions[0].consumedAt=HISTORY_NOW;
store.messages[4].body='Revisión de hormigón en sector norte';
store.messages[1].status='unknown';store.messages[1].providerMessageId=null;
store.sessions[2].expiresAt=new Date(HISTORY_NOW.getTime()-60000);
store.messages[3].status='failed';store.messages[3].providerMessageId=null;store.sessions[3].providerMessageId=null;store.sessions[3].sentAt=null;
store.messages[3].metadata.uncertaintyResolution={decision:'ALLOW_NEW_ATTEMPT',riskAccepted:true};
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
 if(url.pathname.startsWith('/api/')){
  requests.push({method:req.method,path:url.pathname,cursor:url.searchParams.get('cursor')});
  if(mode==='fail'){json(res,{error:'Internal failure'},503);return;}
  const handlers=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>historyAccess,authorize:()=>{},prismaFactory:()=>store.prisma,clock:()=>HISTORY_NOW});
  const response=await handlers.GET(new Request(url,{headers:req.headers}),{params:Promise.resolve({conversationId:url.pathname.split('/')[4]})});let body=await response.json();
  if(mode==='foreign')body.context={...body.context,organizationId:'other'};
  if(mode==='hold'){held={res,body,status:response.status};return;}
  json(res,body,response.status);return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;font-family:Arial}main{max-width:860px;margin:auto;padding:12px}main>p{font-size:10px;color:#94a3b8}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port;
 const history=page.getByRole('region',{name:'Seguimiento de formularios'});
 const open=()=>history.getByRole('button',{name:'Consultar envíos anteriores',exact:true}).click();
 const refresh=()=>history.getByRole('button',{name:'Consultar últimos registros',exact:true}).click();
 await page.goto(url);assert.equal(requests.length,0);await open();await expect(history.getByRole('listitem')).toHaveCount(20);await expect(history.getByText('Respuesta registrada',{exact:true}).first()).toBeVisible();
 await expect(history.getByText('Intento cerrado por decisión manual',{exact:true})).toHaveCount(1);
 cases.push('read-on-demand-and-distinct-outcomes');
 const search=history.getByRole('searchbox',{name:'Buscar en esta página',exact:true});
 const order=history.getByRole('combobox',{name:'Ordenar esta página',exact:true});
 const beforeTools=requests.length;
 await search.fill('HORMIGON norte');await expect(history.getByRole('listitem')).toHaveCount(1);
 await expect(history.getByRole('listitem').first()).toContainText('message-0004');
 await search.press('Enter');assert.equal(requests.length,beforeTools);
 await search.fill('.*');await expect(history.getByRole('listitem')).toHaveCount(0);await expect(history.getByText(/No hay coincidencias con esta b/)).toBeVisible();
 await search.fill('PRIVATE_TOKEN_CANARY');await expect(history.getByRole('listitem')).toHaveCount(0);assert.equal(requests.length,beforeTools);
 await history.getByRole('button',{name:'Limpiar búsqueda',exact:true}).click();await expect(search).toBeFocused();await expect(history.getByRole('listitem')).toHaveCount(20);
 cases.push('literal-accent-search-enter-no-dispatch-private-data-not-indexed-and-clear-focus');
 await order.selectOption('attention');await expect(history.getByRole('listitem').nth(0)).toContainText('message-0001');await expect(history.getByRole('listitem').nth(1)).toContainText('message-0003');await expect(history.getByRole('listitem').nth(2)).toContainText('message-0002');
 await search.fill('0019');await expect(history.getByRole('listitem')).toHaveCount(1);assert.equal(requests.length,beforeTools);
 await history.getByRole('button',{name:'Más antiguos',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(0);await expect(search).toHaveValue('0019');await expect(order).toHaveValue('attention');await expect(history.getByRole('button',{name:'Más antiguos',exact:true})).toBeEnabled();
 await history.getByRole('button',{name:'Más recientes',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(1);await refresh();await expect(history.getByRole('listitem')).toHaveCount(1);await expect(order).toHaveValue('attention');
 cases.push('priority-stable-and-query-order-survive-pagination-and-refresh');
 mode='fail';await refresh();await expect(history.getByRole('alert')).toBeVisible();await expect(search).toHaveValue('0019');await expect(history.getByRole('listitem')).toHaveCount(0);
 mode='normal';await refresh();await expect(history.getByRole('listitem')).toHaveCount(1);await search.press('Escape');await expect(search).toHaveValue('');await expect(search).toBeFocused();await expect(history.getByRole('listitem')).toHaveCount(20);
 await order.selectOption('recent');await expect(history.getByRole('listitem').first()).toContainText('message-0000');
 cases.push('failed-read-preserves-search-not-data-escape-clears-without-network');
 await search.fill('hormigon');await history.getByRole('button',{name:'Con respuesta (1)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(0);await history.getByRole('button',{name:'Sin respuesta (16)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(1);
 await history.getByRole('button',{name:'Todos en esta página (20)',exact:true}).click();await search.fill('');cases.push('query-category-intersection-keeps-page-counts');

 await history.getByRole('button',{name:'Más antiguos',exact:true}).click();await expect(history.getByText('Página 2 · hasta 20 registros',{exact:true})).toBeVisible();await expect(history.getByRole('listitem')).toHaveCount(20);
 await history.getByRole('button',{name:'Más antiguos',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(6);await expect(history.getByRole('button',{name:'Más antiguos',exact:true})).toBeDisabled();
 await history.getByRole('button',{name:'Más recientes',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(20);cases.push('keyset-next-and-previous');
 await refresh();await expect(history.getByText('Respuesta registrada',{exact:true}).first()).toBeVisible();await history.getByRole('button',{name:'Revisar envío (2)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(2);await history.getByRole('button',{name:'Todos en esta página (20)',exact:true}).click();
 const filterRequests=requests.length;
 await history.getByRole('button',{name:'Sin respuesta (16)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(16);
 await history.getByRole('button',{name:'Enlace vencido (1)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(1);await expect(history.getByText('Enlace vencido sin respuesta registrada',{exact:true})).toBeVisible();
 await expect(history.getByText(/no autoriza reenviar/)).toBeVisible();
 await history.getByRole('button',{name:'Con respuesta (1)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(1);await expect(history.getByText('Respuesta registrada',{exact:true}).first()).toBeVisible();
 await history.getByRole('button',{name:'Revisar envío (2)',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(2);assert.equal(requests.length,filterRequests);cases.push('reply-expiry-and-send-issues-separated-without-network');
 await history.getByRole('button',{name:'Enlace vencido (1)',exact:true}).click();await history.getByRole('button',{name:'Más antiguos',exact:true}).click();
 await expect(history.getByRole('button',{name:'Enlace vencido (0)',exact:true})).toHaveAttribute('aria-pressed','true');await expect(history.getByRole('listitem')).toHaveCount(0);await expect(history.getByText(/El filtro no evalúa las demás páginas; podés seguir/)).toBeVisible();
 await expect(history.getByRole('button',{name:'Más antiguos',exact:true})).toBeEnabled();await history.getByRole('button',{name:'Más recientes',exact:true}).click();await expect(history.getByRole('listitem')).toHaveCount(1);
 await refresh();await expect(history.getByRole('button',{name:'Enlace vencido (1)',exact:true})).toHaveAttribute('aria-pressed','true');await expect(history.getByRole('listitem')).toHaveCount(1);cases.push('filter-persists-through-pages-and-explicit-refresh');
 await history.getByRole('button',{name:'Sin respuesta (16)',exact:true}).focus();await page.keyboard.press('Enter');await expect(history.getByRole('button',{name:'Sin respuesta (16)',exact:true})).toHaveAttribute('aria-pressed','true');await expect(history.getByRole('listitem')).toHaveCount(16);cases.push('keyboard-filter-selection');
 await history.getByRole('button',{name:'Todos en esta página (20)',exact:true}).click();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:width<500?844:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await expect(history).toBeVisible();if(width<=390){assert.equal(await history.getByRole('list').evaluate(el=>getComputedStyle(el).overflowY),'visible');assert.equal(await search.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=16),true);}if([390,1280].includes(width))await history.screenshot({path:resolve(out,'history-'+width+'.png')});}
 await search.fill('hormigon');await expect(history.getByRole('listitem')).toHaveCount(1);for(const width of [390,1280]){await page.setViewportSize({width,height:900});await history.scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'search-'+width+'.png'),fullPage:true});}await search.fill('');
 await history.getByRole('listitem').first().getByText('Ver mensaje y registro',{exact:true}).click();await expect(history.getByText('Mensaje conservado 0000',{exact:true})).toBeVisible();assert.ok(!(await page.locator('body').innerText()).includes('PRIVATE_TOKEN_CANARY'));cases.push('page-filter-responsive-and-content');
 await page.reload();await open();await expect(history.getByRole('listitem')).toHaveCount(20);assert.equal(requests.some(r=>r.method!=='GET'),false);cases.push('reload-recovers-persisted-history-without-operation-key');
 mode='fail';await refresh();await expect(history.getByRole('alert')).toBeVisible();await expect(history.getByRole('listitem')).toHaveCount(0);mode='normal';await refresh();await expect(history.getByRole('listitem')).toHaveCount(20);cases.push('failed-query-removes-stale-results-and-retry');
 mode='foreign';await refresh();await expect(history.getByRole('alert')).toContainText('no corresponde');await expect(history.getByRole('listitem')).toHaveCount(0);cases.push('foreign-response-rejected');
 mode='normal';await refresh();await expect(history.getByRole('listitem')).toHaveCount(20);const count=requests.length;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:false}})));await expect(history.getByRole('listitem')).toHaveCount(0);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:true}})));assert.equal(requests.length,count);await expect(history.getByRole('listitem')).toHaveCount(0);await expect(history.getByRole('button',{name:'Consultar envíos anteriores',exact:true})).toBeVisible();cases.push('reconnect-clears-observation-without-dispatch');
 mode='hold';await open();await expect.poll(()=>Boolean(held)).toBe(true);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{chat:'other'}})));
 mode='normal';json(held.res,held.body,held.status);held=null;await page.waitForTimeout(100);await expect(history.getByRole('listitem')).toHaveCount(0);await expect(history.getByRole('button',{name:'Consultar envíos anteriores',exact:true})).toBeVisible();cases.push('late-response-cannot-cross-chat');
 assert.deepEqual(errors,[]);assert.equal(requests.some(r=>r.method!=='GET'),false);
 const proof={status:'PASS',environment:'real-history-component-HTTP-route-query-service-with-controlled-session-and-in-memory-database',cases,widths:[320,390,768,1280],pageErrors:0,networkWrites:0,filterQueries:0,providerCalls:0,realMessagesSent:0,clerkVerified:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({name:error.name,message:error.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{if(held)json(held.res,held.body,held.status);await browser?.close();await new Promise(done=>server.close(done));}
