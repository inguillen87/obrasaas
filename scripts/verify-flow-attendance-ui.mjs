import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
registerHooks({resolve(s,c,n){if(s==='@clerk/nextjs/server')return{url:'mock:clerk',shortCircuit:true};if(s==='next/headers')return{url:'mock:headers',shortCircuit:true};if(s.startsWith('@/'))return n(new URL('../src/'+s.slice(2)+(s.startsWith('@/generated/')?'.ts':'.js'),import.meta.url).href,c);return n(s,c);},load(u,c,n){if(u==='mock:clerk')return{format:'module',shortCircuit:true,source:"export async function auth(){throw Error('Unexpected Clerk')} export async function clerkClient(){throw Error('Unexpected Clerk')}"};if(u==='mock:headers')return{format:'module',shortCircuit:true,source:"export async function cookies(){throw Error('Unexpected cookies')}"};return n(u,c);}});
const {createFlowAttendanceFixture,attendanceAccess,ATTENDANCE_NOW}=await import('../tests/helpers/flow-attendance-fixture.js');
const {createWhatsAppProactiveFlowHandlers}=await import('../src/app/api/whatsapp/inbox/[conversationId]/proactive-flows/route.js');
const {ATTENDANCE_GEO_WINDOW_MS}=await import('../src/lib/attendance.js');
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/flow-attendance-ui');mkdirSync(out,{recursive:true});
const entry=`import React,{useEffect,useState}from'react';import{createRoot}from'react-dom/client';import Reply from'./src/app/dashboard/inbox/proactive-flow-reply';import './src/app/globals.css';function App(){const[chat,setChat]=useState('conversation-a'),[online,setOnline]=useState(true);useEffect(()=>{const change=e=>{if(e.detail.chat)setChat(e.detail.chat);if(typeof e.detail.online==='boolean')setOnline(e.detail.online)};window.addEventListener('fixture-context',change);return()=>window.removeEventListener('fixture-context',change)},[]);return <main><p>INGRESO VINCULADO · ENSAYO SIN MENSAJERÍA REAL</p><Reply organizationId="organization-a" projectId="project-a" conversationId={chat} sourceMessageId="message-attendance" online={online}/></main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
let f=createFlowAttendanceFixture(),mode='normal',held=null,permit=true;const requests=[],errors=[],cases=[];
const json=(res,body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store'});res.end(JSON.stringify(body));};
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+server.address().port);
 if(url.pathname.startsWith('/api/')){
  requests.push({method:req.method,mode:url.searchParams.get('mode')});assert.equal(req.method,'GET');
  if(url.searchParams.get('mode')==='attendance'&&mode==='fail'){json(res,{error:'Synthetic unavailable'},503);return;}
  const access={...attendanceAccess,isSuperadmin:permit};
  const h=createWhatsAppProactiveFlowHandlers({resolveAccess:async()=>access,authorize:(a,p)=>{if(p==='org:attendance:read'&&!permit)throw Object.assign(new Error('denied'),{status:403});},prismaFactory:()=>f.prisma,clock:()=>ATTENDANCE_NOW});
  if(url.searchParams.get('mode')==='attendance'&&mode==='denied'){json(res,{error:'Permission removed'},403);return;}
  const response=await h.GET(new Request(url,{headers:req.headers}),{params:Promise.resolve({conversationId:url.pathname.split('/')[4]})});let body=await response.json();
  if(url.searchParams.get('mode')==='attendance'){
   if(mode==='foreign')body={...body,sourceMessageId:'other'};
   if(mode==='hold'){held={res,body,status:response.status};return;}
  }
  json(res,body,response.status);return;
 }
 if(['/bundle.js','/bundle.css'].includes(url.pathname)){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;background:#060913;color:#f8fafc;font-family:Arial}main{max-width:850px;margin:auto;padding:12px}main>p{font-size:10px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser,page;
function release(){if(held){const current=held;held=null;json(current.res,current.body,current.status);}}
try{
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});page=await browser.newPage({viewport:{width:390,height:844},locale:'es-AR'});page.on('pageerror',e=>errors.push(e.message));
 const url='http://127.0.0.1:'+server.address().port,view=page.getByRole('region',{name:'Ingreso vinculado al formulario'});
 async function open(){await page.goto(url);await page.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();await expect(view.getByRole('button',{name:'Consultar ingreso vinculado'})).toBeEnabled();}
 async function load(){await view.getByRole('button',{name:'Consultar ingreso vinculado'}).click();}
 await page.goto(url);assert.equal(requests.length,0);await page.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();assert.equal(requests.filter(r=>r.mode==='attendance').length,0);await load();await expect(view.getByText('Ubicación pendiente',{exact:true})).toBeVisible();await expect(view.getByText('entry-a',{exact:true})).toBeVisible();assert.equal(requests.filter(r=>r.mode==='attendance').length,1);cases.push('explicit-read-through-verified-reply-no-automatic-query');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});await view.scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'attendance-'+width+'.png')});}cases.push('responsive-four-widths-no-overflow');
 f.entry.occurredAt=new Date(ATTENDANCE_NOW.getTime()-ATTENDANCE_GEO_WINDOW_MS-60000);await view.getByRole('button',{name:'Actualizar ingreso'}).click();await expect(view.getByText('Plazo de ubicación vencido',{exact:true})).toBeVisible();assert.equal(f.entry.verificationStatus,'PENDING');cases.push('deadline-does-not-complete-or-expire-database-row');
 f.entry.verificationStatus='VERIFIED';f.entry.shiftId='shift-a';f.state.shift={id:'shift-a',projectId:'project-a',workerId:'worker-a',status:'CLOSED',revision:2,workDate:new Date('2026-09-24')};await view.getByRole('button',{name:'Actualizar ingreso'}).click();await expect(view.getByText('Jornada cerrada',{exact:true})).toBeVisible();await expect(view.getByText('Ubicación verificada',{exact:true})).toBeVisible();cases.push('current-linked-shift-separate-from-form-state');
 mode='fail';await view.getByRole('button',{name:'Actualizar ingreso'}).click();await expect(view.getByRole('alert')).toBeVisible();await expect(view.getByText('entry-a',{exact:true})).toHaveCount(0);mode='normal';await view.getByRole('button',{name:'Actualizar ingreso'}).click();await expect(view.getByText('entry-a',{exact:true})).toBeVisible();cases.push('failed-read-clears-content-explicit-retry');
 mode='foreign';await view.getByRole('button',{name:'Actualizar ingreso'}).click();await expect(view.getByRole('alert')).toContainText('no corresponde');await expect(view.getByText('entry-a',{exact:true})).toHaveCount(0);cases.push('foreign-response-not-displayed');
 mode='normal';delete f.inbound.metadata.flowAttendanceReceipt;await view.getByRole('button',{name:'Actualizar ingreso'}).click();await expect(view.getByText(/no conserva un vínculo/)).toBeVisible();cases.push('legacy-response-never-infers-record');
 f=createFlowAttendanceFixture();await open();mode='hold';await load();await expect.poll(()=>Boolean(held)).toBe(true);await view.getByRole('button',{name:'Cerrar ingreso'}).click();release();await page.waitForTimeout(100);await expect(view.getByText('entry-a',{exact:true})).toHaveCount(0);cases.push('closed-read-discards-late-result');
 mode='normal';await load();await expect(view.getByText('entry-a',{exact:true})).toBeVisible();await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:false}})));await expect(page.getByText('entry-a',{exact:true})).toHaveCount(0);const before=requests.length;await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{online:true}})));assert.equal(requests.length,before);await expect(page.getByText('entry-a',{exact:true})).toHaveCount(0);cases.push('offline-reconnect-does-not-reuse-or-query');
 await open();mode='denied';await load();await expect(view.getByRole('alert')).toBeVisible();await expect(view.getByRole('button',{name:'Actualizar ingreso'})).toBeDisabled();cases.push('revocation-blocks-retry');
 mode='normal';permit=false;await page.goto(url);await page.getByRole('button',{name:'Consultar respuesta vinculada',exact:true}).click();await expect(page.getByText('Origen de la respuesta verificado',{exact:true})).toBeVisible();await expect(view).toHaveCount(0);cases.push('without-attendance-permission-no-affordance');
 permit=true;await open();mode='hold';await load();await expect.poll(()=>Boolean(held)).toBe(true);await page.evaluate(()=>window.dispatchEvent(new CustomEvent('fixture-context',{detail:{chat:'conversation-other'}})));release();await page.waitForTimeout(100);await expect(page.getByText('entry-a',{exact:true})).toHaveCount(0);cases.push('conversation-switch-does-not-adopt-late-read');
 assert.ok(requests.every(r=>r.method==='GET'));assert.deepEqual(errors,[]);const proof={status:'PASS',environment:'real-reply-attendance-components-route-and-services-with-controlled-identity-HTTP-database',cases,widths:[320,390,768,1280],pageErrors:0,networkWrites:0,providerCalls:0,realMessagesSent:0,clerkVerified:false};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message},null,2));await page?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}
finally{release();await browser?.close();await new Promise(done=>server.close(done));}
