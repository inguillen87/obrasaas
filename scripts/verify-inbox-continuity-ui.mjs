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
function App(){const[scope,setScope]=useState('project-a');window.testLeave=()=>requestWorkspaceNavigation('route');window.fixtureChangeScope=()=>setScope('project-b');return <><button onClick={()=>setScope('project-b')}>Cambiar ámbito de ensayo</button><Inbox organizationId="org-a" viewerId="viewer-a" projectId={scope} projectName="Obra sintética · Norte" organizationName="Constructora de ensayo"/></>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({ stdin: { contents: entry, resolveDir: root, loader: 'jsx' }, outfile: resolve(out, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic', loader: { '.js': 'jsx' }, alias: { '@': resolve(root, 'src') }, define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'silent', plugins: [{ name: 'local-links', setup(api) {
  api.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
  api.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ loader: 'jsx', resolveDir: root, contents: `import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a {...props} href={href}/>} ` }));
} }] });
const now = new Date().toISOString();
const chats = ['chat-a','chat-b'].map((id,i) => ({ id, displayName: i ? 'Contacto B · Ensayo' : 'Contacto A · Ensayo', phone: i ? '540000000002' : '540000000001', unreadCount: 0, updatedAt: now, lastMessage: { id: 'in-'+id, body: 'Entrada de ensayo '+id, direction: 'INBOUND', kind: 'text', sentAt: now } }));
const windowState = { isOpen: true, expiresAt: new Date(Date.now()+3600000).toISOString(), remainingSeconds: 3600 };
const receipts = new Map(), calls = [], errors = []; let deferred = null, mode = 'DELAY', wrongHistory = false;
const followupReads = [], followupCases = []; let followupMode = 'normal', heldFollowup = null;
const historyRows = Array.from({ length: 23 }, (_, i) => ({ messageId: 'history-' + i, blueprintKey: 'incident-report', body: 'Control de hormig\u00f3n sector ' + i, recordedAt: now, status: i === 0 ? 'unknown' : 'delivered', correlation: 'verified', reply: { state: 'not_recorded', recordedAt: null }, expiresAt: new Date(Date.now() + 3600000).toISOString(), riskDecision: false }));
function releaseFollowup() { if (heldFollowup) { const held = heldFollowup; heldFollowup = null; json(held.res, held.body, held.status); } }
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
  if(url.pathname.endsWith('/proactive-flows')) {
    if (url.searchParams.get('mode') !== 'history') return json(res,{flows:[],catalog:[],available:false});
    const chat = url.pathname.split('/')[4], cursor = url.searchParams.get('cursor');
    followupReads.push({ method: req.method, chat, projectId, cursor });
    assert.equal(req.headers['x-obrasaas-organization'], 'org-a'); assert.equal(req.headers['x-obrasaas-project'], projectId);
    const rows = historyRows.map(row => ({ ...row, messageId: chat + '-' + row.messageId }));
    const body = { context: { organizationId: 'org-a', projectId, conversationId: followupMode === 'foreign' ? 'wrong-chat' : chat }, cursor, nextCursor: cursor ? null : 'older-page', pageSize: 20, observedAt: new Date().toISOString(), items: cursor ? rows.slice(20) : rows.slice(0,20) };
    if (followupMode === 'hold' || followupMode === 'hold-error') { heldFollowup = { res, body: followupMode === 'hold-error' ? {error:'Late read failure'} : body, status: followupMode === 'hold-error' ? 503 : 200 }; followupMode = 'normal'; return; }
    if (followupMode === 'denied') return json(res,{error:'Read denied'},403);
    if (followupMode === 'fail') return json(res,{error:'Read failed'},503);
    return json(res,body);
  }
  if(url.pathname==='/bundle.js'||url.pathname==='/bundle.css'){res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,url.pathname.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0;padding:12px}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser, activePage;
try {
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:960},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();activePage=page;page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);
  const textarea=page.getByRole('textbox',{name:'Escribir respuesta'});
  const chatA=page.getByRole('button',{name:/Contacto A · Ensayo/}),chatB=page.getByRole('button',{name:/Contacto B · Ensayo/});
  await chatA.click();await expect(textarea).toBeEnabled();await textarea.fill('Respuesta A pendiente');
  const trigger = page.getByRole('button', { name: 'Abrir seguimiento de formularios', exact: true });
  const panel = page.getByRole('dialog', { name: 'Seguimiento de formularios', exact: true });
  const followup = panel.getByRole('region', { name: 'Seguimiento de formularios', exact: true });
  const closePanel = () => panel.getByRole('button', { name: 'Cerrar panel de seguimiento', exact: true }).click();
  const openPanel = async () => { await trigger.click(); await expect(followup.getByRole('listitem')).toHaveCount(20); };
  assert.equal(followupReads.length,0);assert.equal(await page.locator('form').getByRole('region',{name:'Seguimiento de formularios'}).count(),0);
  await openPanel();await expect(panel.getByRole('heading',{name:'Seguimiento de formularios',level:2})).toBeFocused();
  await expect(panel.getByLabel('Contexto del seguimiento')).toContainText('Contacto A');
  assert.equal(followupReads.length,1);assert.equal(calls.length,0);
  const visibleFocusInside = async () => panel.evaluate(el => el.contains(document.activeElement));
  await panel.getByRole('button',{name:'Volver a la conversación',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await visibleFocusInside(),true);
  await panel.getByRole('button',{name:'Cerrar panel de seguimiento',exact:true}).focus();await page.keyboard.press('Shift+Tab');assert.equal(await visibleFocusInside(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
  followupCases.push('single-explicit-read-context-heading-focus-trap-no-composer-nesting');
  const search = followup.getByRole('searchbox', {name:'Buscar en esta página',exact:true});
  await search.fill('hormigon');await search.press('Enter');assert.equal(calls.length,0);assert.equal(followupReads.length,1);
  await search.press('Escape');await expect(search).toHaveValue('');await expect(panel).toBeVisible();
  await search.press('Escape');await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();await expect(textarea).toHaveValue('Respuesta A pendiente');
  assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
  followupCases.push('enter-no-send-first-escape-clears-second-closes-and-restores-draft-focus');
  await openPanel();await followup.getByRole('button',{name:'Más antiguos',exact:true}).click();await expect(followup.getByRole('listitem')).toHaveCount(3);
  await closePanel();await openPanel();await expect(followup.getByText('Página 1 · hasta 20 registros',{exact:true})).toBeVisible();await closePanel();
  followupCases.push('close-and-reopen-requeries-first-page-not-old-snapshot');
  for (const scenario of ['hold','hold-error']) {
    followupMode=scenario;await trigger.click();await expect.poll(()=>Boolean(heldFollowup)).toBe(true);await closePanel();releaseFollowup();await page.waitForTimeout(80);
    await expect(panel).toHaveCount(0);await expect(textarea).toHaveValue('Respuesta A pendiente');
  }
  followupCases.push('closing-during-read-discards-late-success-and-error');
  followupMode='fail';await trigger.click();await expect(followup.getByRole('alert')).toBeVisible();followupMode='normal';await followup.getByRole('button',{name:'Consultar últimos registros',exact:true}).click();await expect(followup.getByRole('listitem')).toHaveCount(20);await closePanel();
  followupMode='foreign';await trigger.click();await expect(followup.getByRole('alert')).toContainText('no corresponde');await expect(followup.getByRole('listitem')).toHaveCount(0);await closePanel();
  followupMode='denied';await trigger.click();await expect(followup.getByRole('button',{name:'Consultar últimos registros',exact:true})).toBeDisabled();await closePanel();followupMode='normal';
  followupCases.push('retry-known-read-failure-foreign-response-and-permission-denial');
  await openPanel();await context.setOffline(true);await expect(panel).toHaveCount(0);await expect(trigger).toBeDisabled();
  const afterOffline=followupReads.length;await context.setOffline(false);await expect(trigger).toBeEnabled();await page.waitForTimeout(150);assert.equal(followupReads.length,afterOffline);await expect(textarea).toHaveValue('Respuesta A pendiente');
  followupCases.push('offline-closes-and-reconnect-requires-explicit-read-without-losing-draft');
  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:900});if (width<=760 && await chatA.isVisible()) await chatA.click();
    await openPanel();const box=await panel.boundingBox();assert.ok(box && box.x>=0 && box.x+box.width<=width+1);
    assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    assert.equal(await followup.getByRole('list').evaluate(el=>getComputedStyle(el).overflowY),'visible');
    await panel.getByRole('button',{name:'Volver a la conversación',exact:true}).scrollIntoViewIfNeeded();
    if ([390,1280].includes(width)) { await search.fill('sector 4');await panel.evaluate(el=>el.scrollTop=0);await panel.screenshot({path:resolve(out,'followup-'+width+'.png')}); }
    await closePanel();await expect(textarea).toHaveValue('Respuesta A pendiente');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.setViewportSize({width:1280,height:960});followupCases.push('drawer-four-widths-one-scroll-and-composer-draft-preserved');

  await chatB.click();await expect(textarea).toBeEnabled();await expect(textarea).toHaveValue('');await textarea.fill('Respuesta B pendiente');
  await chatA.click();await expect(textarea).toHaveValue('Respuesta A pendiente');
  page.once('dialog',dialog=>dialog.dismiss());assert.equal(await page.evaluate(()=>window.testLeave()),false);
  await page.getByRole('button',{name:'Enviar mensaje',exact:true}).click();
  await expect.poll(()=>Boolean(deferred)).toBe(true);
  await openPanel();await closePanel();await expect(textarea).toHaveValue('Respuesta A pendiente');assert.equal(calls.length,1);followupCases.push('opening-while-text-send-pending-does-not-remount-or-repeat-it');
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
  const callsBeforePanel=calls.length;await openPanel();await closePanel();await expect(textarea).toHaveValue('Texto de ensayo conservado');await expect(textarea).toBeDisabled();assert.equal(calls.length,callsBeforePanel);followupCases.push('uncertain-send-and-recovery-controls-survive-read-panel');
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
  wrongHistory=false;followupMode='hold';await trigger.click();await expect.poll(()=>Boolean(heldFollowup)).toBe(true);await page.evaluate(()=>window.fixtureChangeScope());releaseFollowup();await expect(panel).toHaveCount(0);assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');followupCases.push('scope-change-closes-panel-and-discards-old-request');
  await chatB.click();await expect(textarea).toBeEnabled();await expect(textarea).toHaveValue('');
  assert.equal(calls.length,3);assert.ok(calls.every(call=>call.id==='chat-a'&&call.projectId==='project-a'&&call.organization==='org-a'));
  assert.deepEqual(errors,[]);
  assert.ok(followupReads.every(call=>call.method==='GET'));
  const proof={followupCases,followupReadOnly:true,result:'PASS',environment:'real-InboxClient-with-synthetic-HTTP-and-external-providers',draftIsolation:true,lateSendStaysInOriginalChat:true,incompleteResponseRetainsAttempt:true,identicalRetry:true,acceptedIsNotDelivered:true,deliveryRefresh:true,leaveGuard:true,copyAndDiscardProtection:true,foreignHistoryBlocked:true,scopeRemountClearsDrafts:true,widths:[320,390,768,1280],capturedSendRequests:calls.length,pageErrors:errors.length};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){writeFileSync(resolve(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack},null,2));await activePage?.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});throw error;}finally{releaseFollowup();await browser?.close();await new Promise(done=>server.close(done));}
