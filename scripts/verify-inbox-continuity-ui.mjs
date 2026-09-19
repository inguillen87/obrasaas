import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/inbox-continuity-ui');
mkdirSync(out, { recursive: true });
const entry = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Inbox from './src/app/dashboard/inbox/inbox-client';import{requestWorkspaceNavigation}from'./src/lib/workspace-leave-policy';import './src/app/globals.css';
function App(){const[scope,setScope]=useState('project-a');window.testLeave=()=>requestWorkspaceNavigation('route');return <><button onClick={()=>setScope('project-b')}>Cambiar ámbito de ensayo</button><Inbox organizationId="org-a" viewerId="viewer-a" projectId={scope} projectName="Obra sintética · Norte" organizationName="Constructora de ensayo"/></>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'local-links', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', resolveDir: root, contents: `import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href}/>} ` }));
} }] });
const now = new Date().toISOString();
const chats = ['chat-a','chat-b'].map((id,i) => ({ id, displayName: i ? 'Contacto B · Ensayo' : 'Contacto A · Ensayo', phone: i ? '540000000002' : '540000000001', unreadCount: 0, updatedAt: now, lastMessage: { id: 'in-'+id, body: 'Entrada de ensayo '+id, direction: 'INBOUND', kind: 'text', sentAt: now } }));
const windowState = { isOpen: true, expiresAt: new Date(Date.now()+3600000).toISOString(), remainingSeconds: 3600 };
const receipts = new Map(), calls = [], errors = []; let deferred = null, mode = 'DELAY', wrongHistory = false;
const json = (res, data, status=200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)); };
function acknowledge(res, id, input, projectId) {
  const key = projectId+'|'+id+'|'+input.idempotencyKey;
  if (!receipts.has(key)) receipts.set(key,{ id: 'out-'+receipts.size, direction:'OUTBOUND', status:'accepted', body:input.body, kind:'text', sentAt:new Date().toISOString(), conversationId:id, projectId });
  json(res, { context:{organizationId:'org-a',projectId,conversationId:id,idempotencyKey:input.idempotencyKey}, message:receipts.get(key), window:windowState, composerCapability:{allowed:true} });
}
const server = createServer((req,res) => {
  const url = new URL(req.url,'http://local'), projectId = url.searchParams.get('projectId') || 'project-a';
  if (url.pathname === '/api/whatsapp/inbox') return json(res,{conversations:chats, connection:{operational:true,status:'CONNECTED'}, pageInfo:{hasMore:false}, unreadTotal:0});
  const match = url.pathname.match(/^\/api\/whatsapp\/inbox\/(chat-[ab])\/messages$/);
  if(match){
    const id=match[1];
    if(req.method==='GET') return json(res,{context:{organizationId:'org-a',projectId:wrongHistory?'other-project':projectId,conversationId:id},conversation:chats.find(c=>c.id===id),messages:[chats.find(c=>c.id===id).lastMessage,...[...receipts.values()].filter(row=>row.conversationId===id&&row.projectId===projectId)],window:windowState,composerCapability:{allowed:true},onboarding:{state:'closed'},pageInfo:{hasMore:false}});
    let text='';req.on('data',part=>text+=part);req.on('end',()=>{
      const input=JSON.parse(text);calls.push({id,projectId,input,key:req.headers['idempotency-key'],organization:req.headers['x-obrasaas-organization']});
      if(mode==='DELAY'){deferred=()=>acknowledge(res,id,input,projectId);return;}
      if(mode==='MALFORMED'){mode='SUCCESS';json(res,{});return;}
      acknowledge(res,id,input,projectId);
    });return;
  }
  if(url.pathname.endsWith('/read-state')) return json(res,{unreadCount:0,unreadTotal:0});
  if(url.pathname.endsWith('/proactive-flows')) return json(res,{flows:[],catalog:[],available:false});
  if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;padding:12px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try {
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:960},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const textarea=page.getByRole('textbox',{name:'Escribir respuesta'});
  const chatA=page.getByRole('button',{name:/Contacto A · Ensayo/}),chatB=page.getByRole('button',{name:/Contacto B · Ensayo/});
  await chatA.click();await expect(textarea).toBeEnabled();await textarea.fill('Respuesta A pendiente');
  await chatB.click();await expect(textarea).toBeEnabled();await expect(textarea).toHaveValue('');await textarea.fill('Respuesta B pendiente');
  await chatA.click();await expect(textarea).toHaveValue('Respuesta A pendiente');
  page.once('dialog',dialog=>dialog.dismiss());assert.equal(await page.evaluate(()=>window.testLeave()),false);
  await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  await expect.poll(()=>Boolean(deferred)).toBe(true);
  await chatB.click();await expect(textarea).toHaveValue('Respuesta B pendiente');
  deferred();deferred=null;mode='SUCCESS';
  await expect(chatA).not.toContainText('Enviando');
  await expect(textarea).toHaveValue('Respuesta B pendiente');
  await expect(page.getByText('Respuesta A pendiente',{exact:true})).toHaveCount(0);
  await chatA.click();await expect(textarea).toBeEnabled();await expect(textarea).toHaveValue('');
  await expect(page.getByText('La entrega todavía no está confirmada.',{exact:true})).toBeVisible();
  const firstReceipt=[...receipts.values()][0];firstReceipt.status='delivered';
  await chatB.click();await chatA.click();await expect(page.getByText('Estado confirmado en el historial del canal.',{exact:true})).toBeVisible();
  await textarea.fill('Texto de ensayo conservado');mode='MALFORMED';
  await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  await expect(page.getByRole('button',{name:'Comprobar / reintentar seguro'})).toBeVisible();
  await expect(textarea).toHaveValue('Texto de ensayo conservado');await expect(textarea).toBeDisabled();
  await chatB.click();await expect(textarea).toHaveValue('Respuesta B pendiente');await chatA.click();
  await expect(textarea).toHaveValue('Texto de ensayo conservado');
  await page.getByRole('button',{name:'Comprobar / reintentar seguro'}).click();
  await expect(textarea).toBeEnabled();await expect(textarea).toHaveValue('');
  assert.equal(calls[1].key,calls[2].key);assert.deepEqual(calls[1].input,calls[2].input);
  await chatB.click();await expect(textarea).toHaveValue('Respuesta B pendiente');
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:1000});
    if(width<=760){if(await chatB.isVisible())await chatB.click();}
    const box=await page.locator('[aria-label="Destinatario y continuidad de la respuesta"]').boundingBox();
    assert.ok(box&&box.x>=0&&box.x+box.width<=width+1,'Composer overflow at '+width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Page overflow at '+width);
    if([390,1280].includes(width))await page.screenshot({path:resolve(out,'inbox-'+width+'.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Copiar texto',exact:true}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toBe('Respuesta B pendiente');
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Descartar borrador'}).click();await expect(textarea).toHaveValue('Respuesta B pendiente');
  wrongHistory=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('La respuesta de la conversación no coincide con la obra abierta.',{exact:true})).toBeVisible({timeout:25000});
  await expect(page.getByRole('region',{name:'Historial reciente con Contacto B Â· Ensayo'}).getByText('Entrada de ensayo chat-b',{exact:true})).toHaveCount(0);await expect(textarea).toBeDisabled();
  wrongHistory=false;await page.getByRole('button',{name:'Cambiar ámbito de ensayo'}).click();
  await chatB.click();await expect(textarea).toBeEnabled();await expect(textarea).toHaveValue('');
  assert.equal(calls.length,3);assert.ok(calls.every(call=>call.id==='chat-a'&&call.projectId==='project-a'&&call.organization==='org-a'));
  assert.deepEqual(errors,[]);
  const proof={result:'PASS',environment:'real-InboxClient-with-synthetic-HTTP-and-external-providers',draftIsolation:true,lateSendStaysInOriginalChat:true,incompleteResponseRetainsAttempt:true,identicalRetry:true,acceptedIsNotDelivered:true,deliveryRefresh:true,leaveGuard:true,copyAndDiscardProtection:true,foreignHistoryBlocked:true,scopeRemountClearsDrafts:true,widths:[320,390,768,1280],capturedSendRequests:calls.length,pageErrors:errors.length};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
