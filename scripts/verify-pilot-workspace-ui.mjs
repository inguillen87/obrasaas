import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, expect } from '@playwright/test';
const root = fileURLToPath(new URL('../', import.meta.url)), out = resolve(root, '.vercel/pilot-workspace-ui'); mkdirSync(out, { recursive: true });
await build({ stdin: { resolveDir: root, loader: 'jsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Panel from './src/app/dashboard/integrations/pilot-workspace-panel';createRoot(document.getElementById('root')).render(<Panel organizationId="org-internal" projectId="project-internal"/>);` }, outfile: resolve(out,'bundle.js'), bundle: true, jsx:'automatic', platform:'browser', format:'esm', loader:{'.js':'jsx'}, alias:{'@':resolve(root,'src')}, define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}, plugins:[{name:'router-fixture',setup(api){api.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRouter=()=>({refresh(){window.__refreshed=true}});',loader:'js'}));}}] });
let mode='ok', calls=[],errors=[];
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://local').pathname;
 if(path==='/api/integrations/whatsapp/pilot-workspace'){
  let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>{
   const body=JSON.parse(data);calls.push({body,organization:req.headers['x-obrasaas-organization'],project:req.headers['x-obrasaas-project']});res.setHeader('Content-Type','application/json');
   if(mode==='lost'){mode='ok';res.statusCode=503;res.end('{"error":"Alta no confirmada"}');return;}
   if(mode==='denied'){res.statusCode=403;res.end('{"error":"Acceso denegado"}');return;}
   res.end(JSON.stringify({context:{organizationId:mode==='foreign'?'other':'org-internal',projectId:'project-internal'},organization:{id:'org-pilot',name:body.organizationName},project:{id:'project-pilot',name:body.projectName},status:'READY_FOR_CONNECTION',messagesSent:false,connectionCreated:false}));
  });return;
 }
 if(path==='/bundle.js'||path==='/bundle.css'){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,path.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:white;font:16px Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:950}});
 const open=async()=>{const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:'+server.address().port);return page;};
 const page=await open();await expect(page.getByRole('button',{name:'Crear empresa piloto'})).toBeDisabled();assert.equal(calls.length,0);
 await page.getByRole('checkbox').check();
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'pilot-'+width+'.png'),fullPage:true});}
 await page.getByRole('button',{name:'Crear empresa piloto'}).click();await expect(page.getByRole('status')).toContainText('Ahora podés seleccionar');assert.equal(calls.length,1);await expect(page.getByRole('button',{name:'Piloto preparado'})).toBeDisabled();await page.close();
 mode='lost';const retry=await open();await retry.getByRole('checkbox').check();await retry.getByRole('button',{name:'Crear empresa piloto'}).click();await expect(retry.getByRole('alert')).toHaveText('Alta no confirmada');await expect(retry.getByRole('textbox',{name:'Empresa piloto'})).toBeDisabled();await retry.getByRole('button',{name:'Verificar el mismo intento'}).click();await expect(retry.getByRole('status')).toContainText('Ahora podés seleccionar');assert.deepEqual(calls[1],calls[2]);await retry.close();
 mode='denied';const denied=await open();await denied.getByRole('checkbox').check();await denied.getByRole('button',{name:'Crear empresa piloto'}).click();await expect(denied.getByRole('alert')).toHaveText('Acceso denegado');await expect(denied.getByRole('button',{name:'Crear empresa piloto'})).toBeDisabled();await denied.close();
 mode='foreign';const foreign=await open();await foreign.getByRole('checkbox').check();await foreign.getByRole('button',{name:'Crear empresa piloto'}).click();await expect(foreign.getByRole('alert')).toContainText('Respuesta no confirmada');await expect(foreign.getByText('Destino preparado',{exact:true})).toHaveCount(0);await foreign.close();
 assert.equal(calls.length,5);assert.ok(calls.every(c=>c.organization==='org-internal'&&c.project==='project-internal'&&c.body.confirmIsolatedPilot===true));assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-component-with-synthetic-identity-provider-responses',explicitConfirmation:true,identicalRetry:true,scopeMismatchRejected:true,roleFailureBlocked:true,widths:[320,390,768,1280],requests:5,pageErrors:0};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(error){console.error(JSON.stringify({pageErrors:errors}));throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
