import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {chromium,expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'.vercel/pilot-token-ui');mkdirSync(out,{recursive:true});
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import Panel from './src/app/dashboard/integrations/pilot-import-panel';import './src/app/globals.css';createRoot(document.getElementById('root')).render(<Panel currentProjectId="internal" targets={[{organizationId:'org-pilot',organizationName:'Empresa de ensayo',projects:[{id:'pilot-project',name:'Obra de ensayo'}]}]} assets={[{whatsappBusinessId:'123456789',phoneNumberId:'987654321'}]}/>);`;
await build({stdin:{contents:entry,resolveDir:root,loader:'jsx'},outfile:resolve(out,'bundle.js'),bundle:true,platform:'browser',format:'esm',jsx:'automatic',loader:{'.js':'jsx'},alias:{'@':resolve(root,'src')},define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'router',setup(api){api.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'fixture'}));api.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRouter=()=>({refresh(){}});',loader:'js'}));}}]});
let mode='diagnostic';const calls=[],errors=[];
const server=createServer((req,res)=>{
 const path=new URL(req.url,'http://test').pathname;
 if(path==='/api/integrations/whatsapp/pilot-import'){
  let raw='';req.on('data',data=>raw+=data);req.on('end',()=>{const body=JSON.parse(raw);calls.push({body,key:req.headers['idempotency-key']});res.setHeader('Content-Type','application/json');
   if(mode==='diagnostic'){res.statusCode=400;res.end(JSON.stringify({code:'PILOT_IMPORT_VALIDATION_FAILED',diagnosticCode:'PILOT_TOKEN_NOT_TEMPORARY'}));return;}
   if(mode==='uncertain'){res.statusCode=502;res.end(JSON.stringify({code:'PILOT_IMPORT_VALIDATION_FAILED',diagnosticCode:'unknown-secret-do-not-display'}));return;}
   res.end(JSON.stringify({connection:{projectId:body.projectId}}));});return;
 }
 if(path==='/bundle.js'||path==='/bundle.css'){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync(resolve(out,path.slice(1))));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><style>body{margin:0;background:#060913;color:#fff;font:16px Arial}</style><div id="root"></div><script type="module" src="/bundle.js"></script></html>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:950}});
 async function open(){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('combobox',{name:'Tenant piloto',exact:true}).selectOption('org-pilot');await page.getByRole('combobox',{name:'Obra activa',exact:true}).selectOption('pilot-project');await page.getByRole('combobox',{name:'Número de prueba autorizado',exact:true}).selectOption('123456789:987654321');await page.locator('input[name="metaPilotTemporaryCredential"]').fill('synthetic-pilot-token-not-a-real-secret');await page.getByRole('checkbox').check();return page;}
 const page=await open();await page.getByRole('button',{name:'Importar conexión piloto',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('El token no es temporal');
 await expect(page.getByRole('button',{name:'Revisá los datos del intento',exact:true})).toBeDisabled();
 await expect(page.locator('input[name="metaPilotTemporaryCredential"]')).toHaveAttribute('type','password');assert.equal(calls.length,1);
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if([390,1280].includes(width))await page.screenshot({path:resolve(out,'token-'+width+'.png'),fullPage:true});}
 mode='ok';await page.locator('input[name="metaPilotTemporaryCredential"]').fill('different-synthetic-temporary-token');await expect(page.getByRole('checkbox')).not.toBeChecked();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Importar conexión piloto',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('guardada cifrada');await expect(page.locator('input[name="metaPilotTemporaryCredential"]')).toHaveValue('');assert.notEqual(calls[0].key,calls[1].key);await page.close();
 mode='uncertain';const retry=await open();await retry.getByRole('button',{name:'Importar conexión piloto',exact:true}).click();await expect(retry.getByRole('alert')).not.toContainText('unknown-secret-do-not-display');await expect(retry.getByRole('button',{name:'Reintentar importación',exact:true})).toBeEnabled();assert.equal(calls.length,3);
 mode='ok';await retry.getByRole('button',{name:'Reintentar importación',exact:true}).click();await expect(retry.getByRole('status')).toContainText('guardada cifrada');assert.deepEqual(calls[2],calls[3]);assert.deepEqual(errors,[]);
 const proof={result:'PASS',environment:'real-pilot-import-component-with-synthetic-HTTP',knownRejectionRequiresInputChange:true,unknownFailureKeepsIdempotentRetry:true,credentialMaskedAndClearedAfterSuccess:true,noAutomaticRetry:true,widths:[320,390,768,1280],requests:calls.length,pageErrors:0};writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{await browser?.close();await new Promise(done=>server.close(done));}
