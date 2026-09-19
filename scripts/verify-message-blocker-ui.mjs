import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium,expect } from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/message-blocker-ui');mkdirSync(out,{recursive:true});
const tasks=[{id:'task-a',title:'Mampostería · Sector norte',type:'TASK'}],workers=[{id:'manager-a',name:'Responsable de ensayo',role:'SITE_MANAGER'}];
const source={organizationId:'org-a',projectId:'project-a',conversationId:'chat-a',messageId:'message-a',kind:'TEXT',text:'Faltan diez bolsas de cemento para continuar la mampostería.',version:'a'.repeat(64),sentAt:new Date().toISOString()};
const entry=`import React,{useState,useEffect,useSyncExternalStore}from'react';import{createRoot}from'react-dom/client';import Inbox from './src/app/dashboard/inbox/inbox-client';import Execution from './src/app/dashboard/execution/execution-client';import './src/app/globals.css';
function subscribe(fn){window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn)}
function App(){const path=useSyncExternalStore(subscribe,()=>location.href,()=>'/dashboard/inbox');const[data,setData]=useState(null);useEffect(()=>{if(path.includes('/dashboard/execution'))fetch('/fixture-state').then(r=>r.json()).then(setData)},[path]);return <main style={{maxWidth:1200,margin:'auto',padding:12}}><p>ENSAYO LOCAL · DATOS SINTÉTICOS</p>{path.includes('/dashboard/execution')?(data?<Execution initialData={data} tasks={${JSON.stringify(tasks)}} workers={${JSON.stringify(workers)}} organizationId="org-a" projectId="project-a" permissions={{canManage:true,canReadTasks:true}} focusedBlockerId={new URL(path).searchParams.get('blockerId')}/>:<p>Cargando registro…</p>):<Inbox organizationId="org-a" viewerId="manager-a" projectId="project-a" projectName="Obra sintética Norte" organizationName="Constructora de ensayo" canCreateProgressReport={!path.includes('readonly')} progressEvidenceTasks={${JSON.stringify(tasks)}}/>}</main>};createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
const link=`import React from'react';export default function Link({href,onClick,onNavigate,prefetch,...props}){return <a {...props} href={href} onClick={e=>{onClick?.(e);if(!e.defaultPrevented){onNavigate?.(e);if(!e.defaultPrevented){e.preventDefault();history.pushState({},'',href);window.dispatchEvent(new Event('popstate'));}}}}/>}`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'fixture-link',setup(api){api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:link}));}}]});
const conversation={id:'chat-a',displayName:'Contacto de ensayo',phone:'540000000001',unreadCount:0,lastMessage:{id:'message-a',body:source.text,direction:'INBOUND',kind:'text',sentAt:source.sentAt,progressReportKind:'TEXT'}};
let blocker=null,firstLost=true,resolveLost=true;const commands=[],errors=[];
const respond=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=createServer((req,res)=>{
  const path=new URL(req.url,'http://local').pathname;
  if(path==='/api/whatsapp/inbox')return respond(res,{conversations:[conversation],connection:{operational:true,status:'CONNECTED'},pageInfo:{hasMore:false}});
  if(path==='/api/whatsapp/inbox/chat-a/messages')return respond(res,{context:{organizationId:'org-a',projectId:'project-a',conversationId:'chat-a'},conversation,messages:[conversation.lastMessage],window:{isOpen:true,expiresAt:new Date(Date.now()+3600000).toISOString()},composerCapability:{allowed:true},onboarding:{state:'closed'},pageInfo:{hasMore:false}});
  if(path.endsWith('/proactive-flows'))return respond(res,{flows:[],catalog:[],available:false});
  if(path.endsWith('/read-state'))return respond(res,{unreadCount:0,unreadTotal:0});
  if(path==='/fixture-state')return respond(res,{teams:[],assignments:[],blockers:blocker?[blocker]:[]});
  if(path.endsWith('/messages/message-a/blocker')){
    assert.equal(req.headers['x-obrasaas-project'],'project-a');assert.equal(req.headers['x-obrasaas-organization'],'org-a');
    if(req.method==='GET')return respond(res,{source,existing:blocker,owners:{workers,teams:[],truncated:false}});
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{
      const input=JSON.parse(text);commands.push({kind:'create',key:req.headers['idempotency-key'],input});
      const replayed=Boolean(blocker);blocker||={id:'wa_blocker_'+'b'.repeat(64),projectId:'project-a',taskId:input.taskId,title:input.title,description:input.description,severity:input.severity,ownerWorkerId:input.ownerWorkerId,ownerTeamId:input.ownerTeamId,status:'OPEN',revision:0};
      if(firstLost){firstLost=false;return respond(res,{error:'Respuesta perdida después de persistir.'},503);}
      respond(res,{source,blocker,replayed},replayed?200:201);
    });return;
  }
  if(path.startsWith('/api/execution/blockers/')){
    assert.equal(req.headers['x-obrasaas-project'],'project-a');
    if(req.method==='GET'){commands.push({kind:'verify'});return respond(res,{blocker});}
    let text='';req.on('data',chunk=>text+=chunk);req.on('end',()=>{
      const input=JSON.parse(text);commands.push({kind:'resolve',input});assert.equal(input.expectedRevision,blocker.revision);
      blocker={...blocker,status:input.status,resolution:input.resolution,revision:blocker.revision+1};
      if(resolveLost){resolveLost=false;return respond(res,{error:'Se perdió la confirmación de resolución.'},503);}respond(res,{blocker});
    });return;
  }
  if(path==='/bundle.js'||path==='/bundle.css'){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,path.slice(1))));return;}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));const origin='http://127.0.0.1:'+server.address().port;
  await page.goto(origin+'/dashboard/inbox');await page.getByRole('button',{name:/Contacto de ensayo/}).click();
  await page.getByRole('button',{name:'Registrar una restricción',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'Registrar restricción de obra'});
  await expect(modal.getByText(source.text,{exact:true})).toBeVisible();await expect(modal.getByRole('button',{name:'Crear restricción abierta'})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(modal).toHaveCount(0);assert.equal(commands.length,0);
  await page.getByRole('button',{name:'Registrar una restricción',exact:true}).click();await expect(modal.getByLabel('Título de la restricción',{exact:true})).toBeVisible();
  await modal.getByLabel('Título de la restricción',{exact:true}).fill('Faltante de cemento · Sector norte');
  await modal.getByLabel('Detalle revisado',{exact:true}).fill('Revisar disponibilidad de diez bolsas para continuar la actividad.');
  await modal.getByLabel('Actividad afectada',{exact:true}).selectOption('task-a');
  await modal.getByLabel('Responsable de resolver',{exact:true}).selectOption('worker:manager-a');
  await modal.getByRole('checkbox').check();page.once('dialog',dialog=>dialog.dismiss());await modal.getByRole('button',{name:'Cerrar restricción'}).click();
  await expect(modal.getByLabel('Detalle revisado',{exact:true})).toHaveValue('Revisar disponibilidad de diez bolsas para continuar la actividad.');
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:1000});const box=await modal.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1,'Dialog overflow '+width);
    assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    if([390,1280].includes(width))await page.screenshot({path:resolve(out,'message-blocker-'+width+'.png')});
  }
  await modal.getByRole('button',{name:'Crear restricción abierta'}).click();await expect(modal.getByRole('alert')).toContainText('Respuesta perdida');
  await expect(modal.getByLabel('Detalle revisado',{exact:true})).toBeDisabled();
  await modal.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(modal).toHaveCount(0);
  assert.equal(commands.length,2);assert.equal(commands[0].key,commands[1].key);assert.deepEqual(commands[0].input,commands[1].input);
  const target=page.getByRole('link',{name:'Restricción registrada · abrir seguimiento'});await expect(target).toHaveAttribute('href','/dashboard/execution?blockerId='+blocker.id);await target.click();
  const card=page.locator('#blocker-'+blocker.id);await expect(card.getByRole('heading',{name:blocker.title})).toBeVisible();
  await expect(card.getByText('Responsable de ensayo',{exact:true})).toBeVisible();await expect(card.getByText('Abierta',{exact:true})).toBeVisible();
  await card.getByRole('button',{name:'Preparar resolución'}).click();await expect(card.getByRole('button',{name:'Confirmar resolución'})).toBeDisabled();assert.equal(commands.length,2);
  await card.getByRole('textbox',{name:'Resolución de '+blocker.title}).fill('Se verificó el acopio y quedaron disponibles diez bolsas para la actividad.');await card.getByRole('checkbox').check();
  await card.getByRole('button',{name:'Confirmar resolución'}).click();await expect(card.getByRole('button',{name:'Consultar estado sin reenviar'})).toBeVisible();
  await card.getByRole('button',{name:'Consultar estado sin reenviar'}).click();await expect(card.getByText('Resuelta',{exact:true})).toBeVisible();
  await expect(card.getByText('Se verificó el acopio y quedaron disponibles diez bolsas para la actividad.',{exact:true})).toBeVisible();
  assert.equal(commands.filter(item=>item.kind==='resolve').length,1);assert.equal(commands.filter(item=>item.kind==='verify').length,1);assert.equal(blocker.revision,1);
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Page overflow '+width);
    if([390,1280].includes(width))await card.screenshot({path:resolve(out,'blocker-resolved-'+width+'.png')});
  }
  const existing=await context.newPage();existing.on('pageerror',error=>errors.push(error.message));await existing.goto(origin+'/dashboard/inbox');await existing.getByRole('button',{name:/Contacto de ensayo/}).click();await existing.getByRole('button',{name:'Registrar una restricción',exact:true}).click();
  await expect(existing.getByRole('heading',{name:'Este mensaje ya tiene una restricción'})).toBeVisible();await expect(existing.getByRole('button',{name:'Crear restricción abierta'})).toHaveCount(0);await existing.close();
  const reader=await context.newPage();await reader.goto(origin+'/dashboard/inbox?readonly=1');await reader.getByRole('button',{name:/Contacto de ensayo/}).click();await expect(reader.getByRole('button',{name:'Registrar una restricción',exact:true})).toHaveCount(0);await reader.close();
  assert.equal(commands.length,4);assert.equal(conversation.lastMessage.body,source.text);assert.deepEqual(errors,[]);
  const proof={result:'PASS',environment:'real-InboxClient-ExecutionClient-and-dialogs-with-synthetic-HTTP',sourcePreserved:true,openAndCancelReadOnly:true,reviewedOwnerAndTask:true,identicalCreationRetry:true,exactRecordNavigation:true,resolutionRequiresExplanation:true,lostResolutionUsesReadOnlyVerification:true,terminalRestrictionNotReopened:true,unauthorizedActionHidden:true,widths:[320,390,768,1280],mutationRequests:3,readOnlyReconciliations:1,pageErrors:0};
  writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
