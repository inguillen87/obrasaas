import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
import { inspectWhatsAppCredentialLifecycle } from '../src/lib/whatsapp/credential-lifecycle.js';
const root = fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'.vercel/channel-recovery-ui');mkdirSync(output,{recursive:true});
const now=new Date('2026-09-19T18:00:00.000Z');
let mode='expired',reads=0;const errors=[];
const row=()=>({enabled:true,connectionStatus:'CONNECTED',metadata:{channelHealth:{tokenStatus:'VALID',checkedAt:now.toISOString(),
 expiresAt:mode==='current'?now.getTime()/1000+172800:mode==='near'?now.getTime()/1000+2:now.getTime()/1000-60}}});
const entry=`import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import Panel from './src/app/dashboard/integrations/channel-recovery-panel';
import Connect from './src/app/dashboard/integrations/whatsapp-connect-experience';
import './src/app/globals.css';
function App(){const [view,setView]=useState(null),[pin,setPin]=useState('');window.testCounts ||= {authorizations:0,verifications:0};
const blocked=!view||view.state!=='ready'||view.credential?.blocksProviderActions!==false;
return <main style={{maxWidth:780,margin:'auto',padding:12}}><Panel organizationId="org-a" projectId="project-a" onStatus={setView} onVerify={()=>window.testCounts.verifications++}/>
<button data-testid="provider-action" disabled={blocked}>Acción de canal verificada</button>
<div id="customer-whatsapp-authorization" tabIndex={-1}><Connect companyName="Empresa de ensayo" projectName="Obra A" linked={true} reconnectRequired={view?.credential?.reauthorizationRequired===true} configured={true} sdkReady={true} pending={false} blocked={view?.state==='blocked'} pin={pin} onPinChange={setPin} onConnect={()=>window.testCounts.authorizations++} diagnostics={{}} canReadInbox={false}/></div></main>}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(output,'bundle.js'),bundle:true,format:'esm',platform:'browser',jsx:'automatic',
 loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',plugins:[{name:'fixture-link',setup(api){
 api.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
 api.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'jsx',resolveDir:root,contents:`import React from'react';export default function Link({href,onNavigate,prefetch,...props}){return <a href={href} {...props}/>}`}));
}}]});
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname==='/api/integrations/whatsapp/lifecycle'){
   reads++;assert.equal(req.method,'GET');assert.equal(req.headers['x-obrasaas-organization'],'org-a');assert.equal(req.headers['x-obrasaas-project'],'project-a');
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
   if(mode==='unavailable'){res.statusCode=503;res.end('{"error":"private-provider-secret"}');return;}
   if(mode==='denied'){res.statusCode=403;res.end('{"error":"blocked"}');return;}
   const context={organizationId:'org-a',projectId:mode==='wrong-context'?'other':'project-a'};
   res.end(JSON.stringify(mode==='malformed'?{context,credential:{}}:{context,credential:inspectWhatsAppCredentialLifecycle(row(),{now})}));return;
 }
 if(pathname==='/bundle.js'||pathname==='/bundle.css'){res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(output,pathname.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>:root{--font-geist:Arial;--font-manrope:Arial}body{margin:0}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:950}});
 async function open(){const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);return page;}
 const page=await open();const panel=page.getByRole('region',{name:'Vigencia y recuperación de WhatsApp'});
 await expect(panel.getByRole('heading',{name:'La autorización de WhatsApp venció'})).toBeVisible();
 await expect(page.getByTestId('provider-action')).toBeDisabled();await expect(page.getByRole('button',{name:'Reconectar WhatsApp',exact:true})).toBeVisible();
 assert.deepEqual(await page.evaluate(()=>window.testCounts),{authorizations:0,verifications:0});
 await panel.getByRole('link',{name:'Preparar reautorización'}).click();await expect(page.locator('#customer-whatsapp-authorization')).toBeFocused();
 await page.getByRole('button',{name:'Reconectar WhatsApp',exact:true}).click();await page.getByLabel('PIN de protección',{exact:true}).fill('123456');
 assert.deepEqual(await page.evaluate(()=>window.testCounts),{authorizations:0,verifications:0});
 mode='unavailable';await panel.getByRole('button',{name:'Actualizar estado',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('No se pudo actualizar');
 await expect(page.getByLabel('PIN de protección',{exact:true})).toHaveValue('123456');assert.ok(!(await page.textContent('body')).includes('private-provider-secret'));
 mode='expired';await panel.getByRole('button',{name:'Actualizar estado',exact:true}).click();await expect(panel.getByRole('alert')).toHaveCount(0);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});const box=await panel.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1);assert.equal(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(output,'recovery-'+width+'.png'),fullPage:true});}
 await page.getByRole('button',{name:'Continuar en Meta',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.testCounts),{authorizations:1,verifications:0});
 mode='current';await panel.getByRole('button',{name:'Actualizar estado',exact:true}).click();await expect(panel.getByRole('heading',{name:'Autorización verificada recientemente'})).toBeVisible();await expect(page.getByTestId('provider-action')).toBeEnabled();
 await panel.getByRole('button',{name:'Verificar con Meta',exact:true}).click();assert.equal(await page.evaluate(()=>window.testCounts.verifications),1);
 mode='denied';await panel.getByRole('button',{name:'Actualizar estado',exact:true}).click();await expect(panel.getByRole('alert')).toContainText('El acceso o la obra cambiaron');await expect(page.getByTestId('provider-action')).toBeDisabled();await expect(panel.getByRole('link')).toHaveCount(0);await page.close();
 mode='near';const near=await open();const nearPanel=near.getByRole('region',{name:'Vigencia y recuperación de WhatsApp'});await expect(nearPanel.getByRole('heading',{name:'La autorización vence pronto'})).toBeVisible();const baselineReads=reads;
 await expect(nearPanel.getByRole('heading',{name:'La autorización de WhatsApp venció'})).toBeVisible({timeout:5000});assert.equal(reads,baselineReads);await expect(near.getByTestId('provider-action')).toBeDisabled();assert.deepEqual(await near.evaluate(()=>window.testCounts),{authorizations:0,verifications:0});await near.close();
 for(const scenario of ['wrong-context','malformed']){mode=scenario;const trial=await open();await expect(trial.getByRole('alert')).toContainText('No se confirmó el estado');await expect(trial.getByTestId('provider-action')).toBeDisabled();await trial.close();}
 assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-recovery-and-existing-connect-components-with-controlled-host-and-HTTP',readOnlyChecks:true,noAutomaticMetaCalls:true,
 expirationWithoutReload:true,expiryWithoutAdditionalRequest:true,sameChannelRecovery:true,explicitAuthorizationOnly:true,formPreservedOnTransientError:true,scopeMismatchBlocked:true,incompleteResponseBlocked:true,
 widths:[320,390,768,1280],pageErrors:errors.length};writeFileSync(resolve(output,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
